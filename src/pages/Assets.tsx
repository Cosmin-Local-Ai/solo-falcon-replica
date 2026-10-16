/**
 * PG-6e (B-31, D-FA-1) — the fixed-asset register.
 *
 * **Why this is a page and not a tab under Cheltuieli.** art. 68 alin. (7) lit. h) keeps „cheltuielile de
 * dobândire a bunurilor și drepturilor amortizabile” out of the deductible set: a capital purchase is never
 * a direct expense. A register placed among expenses invites exactly the reading the law forbids, so the
 * asset lives on its own surface and the depreciation it produces is shown as a schedule, not as a row in
 * an expense table.
 *
 * **The form asks; it never fills.** Every field except the label and the entry date starts empty, and an
 * empty field is saved as absent rather than as a default. That is not a UX preference: a defaulted
 * *punerea în funcțiune* picks the year depreciation starts in, a defaulted duration picks both the cota
 * and the pct. 27 disposal ceiling, and a defaulted alin. (21) election picks between two branches that
 * pct. 31 says are chosen at entry into the patrimony. Where a fact is missing the card below refuses and
 * names the gap — see `gaps` in `ui/copy/assets.ts`.
 *
 * **Nothing here is inferred.** No asset is derived from an `Expense` row, from a supplier name or from a
 * CAEN code, and no `M1` flag is guessed from the label. `isM1Vehicle` is declared or absent.
 *
 * Every Romanian sentence is in `ui/copy/assets.ts`; this file holds none (enforced by
 * `ui/copy/copy.guard.test.ts`).
 */
import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import type { FixedAsset } from '../data/types';
import { Card, Badge, Modal, Empty } from '../components/ui';
import { assets as assetsCopy, copy, validation } from '../ui/copy';
import { formatBani, leiInputValue, parseLeiInput, sumBani, type Bani } from '../domain/money';
import { isoCalendarDateProblem, isoCalendarDateProblemText, localDateISO, now } from '../domain/date';
import { selectRuleSet } from '../domain/fiscal';
import type { FiscalRule } from '../domain/fiscal/rules';
import {
  depreciationSchedule,
  classifyAgainstThreshold,
  FISCAL_DEPRECIATION_RULE_ID,
  DEPRECIATION_METHODS,
  ASSET_ACQUISITIONS,
  ASSET_PAYMENT_STATES,
  SUB_THRESHOLD_ELECTIONS,
  M1_EXCEPTION_CATEGORIES,
  ASSET_DISPOSAL_KINDS,
  type DepreciationGap,
  type DepreciationMethod,
  type AssetAcquisition,
  type AssetPaymentState,
  type SubThresholdElection,
  type M1ExceptionCategory,
  type AssetDisposalKind,
} from '../domain/fiscal/depreciation';
// B-93 — the page shows what the estimate does with this asset's schedule, so it asks the same question the
// assembler asks, through the same function. It is not a second implementation of the reconciliation: one
// rule, one producer, called from two surfaces — the same shape `selectEstimateCoverage` already has.
import { selectAssetDepreciation, type DepreciationLeg } from '../domain/estimateBasis';

// The rule the arithmetic reads its parameters from — **selected, never imported by year name**. The
// registry guard in `domain/fiscal/registry.test.ts` forbids a `PFA_2026_*` import outside
// `src/domain/fiscal`, and the reason applies here exactly as it does to Expenses.tsx: a call site that
// names the year can only ever ask for that year. The year comes from the profile the store already holds.
function depreciationRule(fiscalYear: number): FiscalRule | undefined {
  const asOf = localDateISO(now());
  const selection = selectRuleSet(fiscalYear, asOf);
  return selection ? selection.rules.find(r => r.ruleId === FISCAL_DEPRECIATION_RULE_ID) : undefined;
}

const METHOD_LABEL: Record<DepreciationMethod, string> = {
  liniar: assetsCopy.form.methodLiniar,
  degresiv: assetsCopy.form.methodDegresiv,
};
const ACQUISITION_LABEL: Record<AssetAcquisition, string> = {
  cumparare: assetsCopy.form.acquisitionCumparare,
  aport: assetsCopy.form.acquisitionAport,
  productie: assetsCopy.form.acquisitionProductie,
};
const PAYMENT_LABEL: Record<AssetPaymentState, string> = {
  achitat: assetsCopy.form.paymentStateAchitat,
  in_rate: assetsCopy.form.paymentStateInRate,
  neachitat: assetsCopy.form.paymentStateNeachitat,
};
const ELECTION_LABEL: Record<SubThresholdElection, string> = {
  intreg_la_punere_in_functiune: assetsCopy.form.subThresholdElectionIntreg,
  amortizare: assetsCopy.form.subThresholdElectionAmortizare,
};
const DISPOSAL_LABEL: Record<AssetDisposalKind, string> = {
  vanzare: assetsCopy.form.disposalKindVanzare,
  casare: assetsCopy.form.disposalKindCasare,
  scoatere_din_gestiune: assetsCopy.form.disposalKindScoatere,
};
const M1_EXCEPTION_LABEL: Record<M1ExceptionCategory, string> = {
  urgenta_paza_curierat: assetsCopy.form.m1ExceptionUrgenta,
  vanzari_achizitii_test_drive_demonstratii: assetsCopy.form.m1ExceptionTestDrive,
  transport_persoane_cu_plata_inclusiv_taxi: assetsCopy.form.m1ExceptionTransport,
  servicii_inchiriere_leasing_opercional_scoli_soferi: assetsCopy.form.m1ExceptionServicii,
};

/** The form's shape: every optional fact is the empty string, which saves as absent. */
interface AssetFormState {
  label: string;
  entryDate: string;
  putInFunctionDate: string;
  fiscalValue: string;
  nonDeductibleVatIncluded: string;
  normalLifeMonths: string;
  method: string;
  subThresholdElection: string;
  acquisition: string;
  paymentState: string;
  paidOn: string;
  isM1Vehicle: string;
  m1ExceptionCategory: string;
  disposedOn: string;
  disposalKind: string;
  // B-65 / brief 76 — „venitul realizat din înstrăinare”. '' means "not recorded", which is not zero: it
  // means Titlul IV pct. 7 alin. (5) lit. o)'s second ceiling cannot be measured.
  disposalProceeds: string;
}

const blankForm = (): AssetFormState => ({
  label: '',
  entryDate: '',
  putInFunctionDate: '',
  fiscalValue: '',
  nonDeductibleVatIncluded: '',
  normalLifeMonths: '',
  method: '',
  subThresholdElection: '',
  acquisition: '',
  paymentState: '',
  paidOn: '',
  isM1Vehicle: '',
  m1ExceptionCategory: '',
  disposedOn: '',
  disposalKind: '',
  disposalProceeds: '',
});

const fromAsset = (a: FixedAsset): AssetFormState => ({
  label: a.label,
  entryDate: a.entryDate,
  putInFunctionDate: a.putInFunctionDate ?? '',
  fiscalValue: leiInputValue(a.fiscalValue),
  nonDeductibleVatIncluded:
    a.nonDeductibleVatIncluded === undefined ? '' : leiInputValue(a.nonDeductibleVatIncluded),
  normalLifeMonths: a.normalLifeMonths === undefined ? '' : String(a.normalLifeMonths),
  method: a.method ?? '',
  subThresholdElection: a.subThresholdElection ?? '',
  acquisition: a.acquisition ?? '',
  paymentState: a.paymentState ?? '',
  paidOn: a.paidOn ?? '',
  isM1Vehicle: a.isM1Vehicle === undefined ? '' : a.isM1Vehicle ? 'da' : 'nu',
  m1ExceptionCategory: a.m1ExceptionCategory ?? '',
  disposedOn: a.disposedOn ?? '',
  disposalKind: a.disposalKind ?? '',
  disposalProceeds: a.disposalProceeds === undefined ? '' : leiInputValue(a.disposalProceeds),
});

function AssetForm({ initial, onSave, onClose }: {
  initial?: FixedAsset;
  onSave: (a: Omit<FixedAsset, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<AssetFormState>(initial ? fromAsset(initial) : blankForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof AssetFormState, v: string) => setF(p => ({ ...p, [k]: v }));

  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.label.trim()) e.label = assetsCopy.form.labelRequired;
    if (!f.entryDate) e.entryDate = validation.dateRequired;
    else if (isoCalendarDateProblem(f.entryDate)) e.entryDate = isoCalendarDateProblemText(isoCalendarDateProblem(f.entryDate)!);
    const value = parseLeiInput(f.fiscalValue);
    if (value === null) e.fiscalValue = validation.leiInvalid;
    if (f.putInFunctionDate && isoCalendarDateProblem(f.putInFunctionDate)) {
      e.putInFunctionDate = isoCalendarDateProblemText(isoCalendarDateProblem(f.putInFunctionDate)!);
    }
    if (f.paidOn && isoCalendarDateProblem(f.paidOn)) e.paidOn = isoCalendarDateProblemText(isoCalendarDateProblem(f.paidOn)!);
    if (f.disposedOn && isoCalendarDateProblem(f.disposedOn)) e.disposedOn = isoCalendarDateProblemText(isoCalendarDateProblem(f.disposedOn)!);
    const months = f.normalLifeMonths.trim() === '' ? undefined : Number(f.normalLifeMonths);
    if (months !== undefined && (!Number.isInteger(months) || months <= 0)) {
      e.normalLifeMonths = validation.monthsCountInvalid;
    }
    const vat = f.nonDeductibleVatIncluded.trim() === '' ? undefined : parseLeiInput(f.nonDeductibleVatIncluded);
    if (f.nonDeductibleVatIncluded.trim() !== '' && vat === null) e.nonDeductibleVatIncluded = validation.leiInvalid;
    const proceeds = f.disposalProceeds.trim() === '' ? undefined : parseLeiInput(f.disposalProceeds);
    if (f.disposalProceeds.trim() !== '' && proceeds === null) e.disposalProceeds = validation.leiInvalid;
    setErrors(e);
    if (Object.keys(e).length) return;

    // Every empty control becomes an absent fact, never a default and never a zero.
    onSave({
      label: f.label.trim(),
      entryDate: f.entryDate,
      putInFunctionDate: f.putInFunctionDate || undefined,
      fiscalValue: value as Bani,
      nonDeductibleVatIncluded: vat ?? undefined,
      normalLifeMonths: months,
      method: (f.method || undefined) as DepreciationMethod | undefined,
      subThresholdElection: (f.subThresholdElection || undefined) as SubThresholdElection | undefined,
      acquisition: (f.acquisition || undefined) as AssetAcquisition | undefined,
      paymentState: (f.paymentState || undefined) as AssetPaymentState | undefined,
      paidOn: f.paidOn || undefined,
      isM1Vehicle: f.isM1Vehicle === '' ? undefined : f.isM1Vehicle === 'da',
      m1ExceptionCategory: (f.m1ExceptionCategory || undefined) as M1ExceptionCategory | undefined,
      disposedOn: f.disposedOn || undefined,
      disposalKind: (f.disposalKind || undefined) as AssetDisposalKind | undefined,
      disposalProceeds: proceeds ?? undefined,
    });
  };

  const select = (key: keyof AssetFormState, label: string, options: readonly string[], hint?: string) => (
    <div className="field">
      <label>{label}</label>
      <select value={f[key]} onChange={ev => set(key, ev.target.value)} data-testid={`asset-${key}`}>
        <option value="">{key === 'm1ExceptionCategory' ? assetsCopy.form.m1ExceptionNone : copy.ui.answerUnrecorded}</option>
        {options.map(o => <option key={o} value={o}>{optionLabel(key, o)}</option>)}
      </select>
      {hint && <span className="hint">{hint}</span>}
      {errors[key] && <span className="error">{errors[key]}</span>}
    </div>
  );

  const text = (key: keyof AssetFormState, label: string, type = 'text', hint?: string) => (
    <div className="field">
      <label>{label}</label>
      <input
        type={type}
        className={errors[key] ? 'invalid' : ''}
        value={f[key]}
        onChange={ev => set(key, ev.target.value)}
        data-testid={`asset-${key}`}
      />
      {hint && <span className="hint">{hint}</span>}
      {errors[key] && <span className="error">{errors[key]}</span>}
    </div>
  );

  return (
    <Modal
      wide
      title={initial ? assetsCopy.form.editAsset : assetsCopy.form.addAsset}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>{assetsCopy.form.cancel}</button>
        <button className="btn btn-primary" onClick={submit} data-testid="asset-save">{assetsCopy.form.save}</button>
      </>}
    >
      <div className="form-grid">
        <div className="field full">
          <label>{assetsCopy.form.label} <span className="req">*</span></label>
          <input
            className={errors.label ? 'invalid' : ''}
            value={f.label}
            onChange={ev => set('label', ev.target.value)}
            data-testid="asset-label"
          />
          {errors.label && <span className="error">{errors.label}</span>}
        </div>
        {text('entryDate', assetsCopy.form.entryDate, 'date', assetsCopy.form.entryDateHint)}
        {text('putInFunctionDate', assetsCopy.form.putInFunctionDate, 'date', assetsCopy.form.putInFunctionDateHint)}
        {text('fiscalValue', assetsCopy.form.fiscalValue, 'number', assetsCopy.form.fiscalValueHint)}
        {text('nonDeductibleVatIncluded', assetsCopy.form.nonDeductibleVatIncluded, 'number', assetsCopy.form.nonDeductibleVatIncludedHint)}
        {text('normalLifeMonths', assetsCopy.form.normalLifeMonths, 'number', assetsCopy.form.normalLifeMonthsHint)}
        {select('method', assetsCopy.form.method, DEPRECIATION_METHODS, assetsCopy.form.methodHint)}
        {select('subThresholdElection', assetsCopy.form.subThresholdElection, SUB_THRESHOLD_ELECTIONS, assetsCopy.form.subThresholdElectionHint)}
        {select('acquisition', assetsCopy.form.acquisition, ASSET_ACQUISITIONS)}
        {select('paymentState', assetsCopy.form.paymentState, ASSET_PAYMENT_STATES)}
        {text('paidOn', assetsCopy.form.paidOn, 'date')}
        {select('isM1Vehicle', assetsCopy.form.isM1Vehicle, ['da', 'nu'], assetsCopy.form.isM1VehicleHint)}
        {select('m1ExceptionCategory', assetsCopy.form.m1ExceptionCategory, M1_EXCEPTION_CATEGORIES)}
        {text('disposedOn', assetsCopy.form.disposedOn, 'date')}
        {select('disposalKind', assetsCopy.form.disposalKind, ASSET_DISPOSAL_KINDS, assetsCopy.form.disposalKindHint)}
        {/* B-65 / brief 76 — the second ceiling's input. Empty means "not recorded", and the hint says what
            that leaves unmeasurable; it is never defaulted and never read as zero. */}
        {text('disposalProceeds', assetsCopy.form.disposalProceeds, 'text', assetsCopy.form.disposalProceedsHint)}
      </div>
    </Modal>
  );
}

/** The option's own words — the internal enum value never reaches the screen. */
function optionLabel(key: keyof AssetFormState, value: string): string {
  switch (key) {
    case 'method': return METHOD_LABEL[value as DepreciationMethod];
    case 'acquisition': return ACQUISITION_LABEL[value as AssetAcquisition];
    case 'paymentState': return PAYMENT_LABEL[value as AssetPaymentState];
    case 'subThresholdElection': return ELECTION_LABEL[value as SubThresholdElection];
    case 'disposalKind': return DISPOSAL_LABEL[value as AssetDisposalKind];
    case 'm1ExceptionCategory': return M1_EXCEPTION_LABEL[value as M1ExceptionCategory];
    case 'isM1Vehicle': return value === 'da' ? copy.ui.answerYes : copy.ui.answerNo;
    default: return value;
  }
}

function Fact({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="text-sm">
      <span className="muted">{label}: </span>
      <span data-testid={`asset-fact-${label}`}>{value ?? '—'}</span>
    </div>
  );
}

function AssetCard({ asset, leg }: { asset: FixedAsset; leg: DepreciationLeg }) {
  const { deleteFixedAsset, toast, profile } = useStore();
  const rule = depreciationRule(profile.fiscalYear);

  // The schedule is computed from the declared facts on every render rather than stored: a stored figure
  // would be a second copy of the arithmetic, and the facts can change under it.
  const outcome = useMemo(
    () => (rule ? depreciationSchedule(rule, asset) : null),
    [rule, asset],
  );
  const classification = rule ? classifyAgainstThreshold(rule, asset) : null;

  const totalDeductible = sumBani(
    outcome?.status === 'computed' ? outcome.years.map(y => y.deductible) : [],
  );
  const totalLost = sumBani(
    outcome?.status === 'computed' ? outcome.years.map(y => y.lost) : [],
  );

  return (
    <Card
      title={asset.label}
      action={
        <button
          className="btn btn-ghost"
          data-testid={`asset-delete-${asset.id}`}
          onClick={() => {
            deleteFixedAsset(asset.id);
            toast('info', assetsCopy.form.deleted);
          }}
        >
          {assetsCopy.form.deleteAsset}
        </button>
      }
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {asset.isM1Vehicle === true && <Badge kind="badge-info">M1</Badge>}
        {asset.m1ExceptionCategory !== undefined && <Badge kind="badge-info">{assetsCopy.form.m1ExceptionCategory}</Badge>}
        {classification === 'below_threshold_elected' && <Badge kind="badge-warning">{assetsCopy.form.subThresholdElection}</Badge>}
        {asset.disposedOn !== undefined && <Badge kind="badge-neutral">{assetsCopy.form.disposedOn}</Badge>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 4 }}>
        <Fact label={assetsCopy.form.entryDate} value={asset.entryDate} />
        <Fact label={assetsCopy.form.putInFunctionDate} value={asset.putInFunctionDate} />
        <Fact label={assetsCopy.form.fiscalValue} value={formatBani(asset.fiscalValue)} />
        <Fact
          label={assetsCopy.form.nonDeductibleVatIncluded}
          value={asset.nonDeductibleVatIncluded === undefined ? undefined : formatBani(asset.nonDeductibleVatIncluded)}
        />
        <Fact
          label={assetsCopy.form.normalLifeMonths}
          value={asset.normalLifeMonths === undefined ? undefined : String(asset.normalLifeMonths)}
        />
        <Fact label={assetsCopy.form.method} value={asset.method ? METHOD_LABEL[asset.method] : undefined} />
        <Fact label={assetsCopy.form.acquisition} value={asset.acquisition ? ACQUISITION_LABEL[asset.acquisition] : undefined} />
        <Fact label={assetsCopy.form.paymentState} value={asset.paymentState ? PAYMENT_LABEL[asset.paymentState] : undefined} />
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{assetsCopy.schedule.heading}</div>
        {outcome === null ? (
          <div className="text-sm muted">{assetsCopy.gaps.durata}</div>
        ) : outcome.status === 'review_required' ? (
          <div className="card" style={{ padding: '12px 14px' }} data-testid={`asset-refusal-${asset.id}`}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{assetsCopy.gaps.heading}</div>
            <div className="text-sm" data-testid={`asset-gap-${asset.id}`}>
              {gapText(outcome.gap)}
            </div>
          </div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{assetsCopy.schedule.year}</th>
                  <th scope="col">{assetsCopy.schedule.months}</th>
                  <th scope="col">{assetsCopy.schedule.uncapped}</th>
                  <th scope="col">{assetsCopy.schedule.deductible}</th>
                  <th scope="col">{assetsCopy.schedule.lost}</th>
                </tr>
              </thead>
              <tbody>
                {outcome.years.map(y => (
                  <tr key={y.fiscalYear} data-testid={`asset-year-${asset.id}-${y.fiscalYear}`}>
                    <td>{y.fiscalYear}</td>
                    <td>{y.months}</td>
                    <td>{formatBani(y.uncapped)}</td>
                    <td>{formatBani(y.deductible)}</td>
                    <td>{y.lost > 0 ? formatBani(y.lost) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>{assetsCopy.schedule.total}</td>
                  <td data-testid={`asset-total-${asset.id}`}>{formatBani(totalDeductible)}</td>
                  <td>{totalLost > 0 ? formatBani(totalLost) : '—'}</td>
                </tr>
              </tfoot>
            </table>
            <div className="text-sm muted" style={{ marginTop: 8 }}>{assetsCopy.schedule.notDeductibleYet}</div>
            {outcome.truncatedByDisposal === true && (
              <div className="text-sm" style={{ marginTop: 6 }} data-testid={`asset-truncated-${asset.id}`}>
                {assetsCopy.schedule.stoppedAtDisposal}
              </div>
            )}
            {leg.conflicts.some(c => c.assetId === asset.id) && (
              <div className="card" style={{ padding: '12px 14px', marginTop: 8 }} data-testid={`asset-conflict-${asset.id}`}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{assetsCopy.posting.conflictHeading}</div>
                <div className="text-sm">{assetsCopy.posting.conflict}</div>
                <div className="text-sm" data-testid={`asset-conflict-expenses-${asset.id}`}>
                  {assetsCopy.posting.conflictExpenses.replace(
                    '{ids}',
                    leg.conflicts.find(c => c.assetId === asset.id)?.expenseIds.join(', ') ?? '',
                  )}
                </div>
                <div className="text-sm muted" style={{ marginTop: 6 }}>{assetsCopy.posting.conflictWhyAll}</div>
                <div className="text-sm" style={{ marginTop: 6 }}>{assetsCopy.posting.conflictFix}</div>
              </div>
            )}
            {leg.lines.some(l => l.assetId === asset.id) && (
              <div className="text-sm" style={{ marginTop: 6 }} data-testid={`asset-posted-${asset.id}`}>
                {assetsCopy.posting.posted
                  .replace('{year}', String(profile.fiscalYear))
                  .replace('{amount}', formatBani(leg.lines.find(l => l.assetId === asset.id)!.deductible))}
              </div>
            )}
            {leg.lines.some(l => l.assetId === asset.id) && (
              <div className="text-sm muted" style={{ marginTop: 6 }}>{assetsCopy.posting.ceilingTravels}</div>
            )}
            {outcome.years.some(y => y.proRated) && (
              <div className="text-sm" style={{ marginTop: 6 }}>{assetsCopy.schedule.firstYearProRated}</div>
            )}
            {outcome.years.some(y => y.branch === 'degresiv_linie_dreapta') && (
              <div className="text-sm" style={{ marginTop: 6 }}>{assetsCopy.schedule.degresivSwitch}</div>
            )}
            {outcome.years.some(y => y.lost > 0) && (
              <div className="text-sm" style={{ marginTop: 6 }}>{assetsCopy.schedule.m1Capped}</div>
            )}
            {outcome.disposal && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{assetsCopy.schedule.disposalHeading}</div>
                <div className="text-sm">
                  <span className="muted">{assetsCopy.schedule.disposalUnamortised}: </span>
                  <span data-testid={`asset-disposal-unamortised-${asset.id}`}>
                    {formatBani(outcome.disposal.unamortised)}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="muted">{assetsCopy.schedule.disposalRemainingMonths}: </span>
                  <span data-testid={`asset-disposal-months-${asset.id}`}>{outcome.disposal.remainingMonths}</span>
                </div>
                <div className="text-sm">
                  <span className="muted">{assetsCopy.schedule.disposalCap}: </span>
                  <span data-testid={`asset-disposal-cap-${asset.id}`}>{formatBani(outcome.disposal.cap)}</span>
                </div>
                <div className="text-sm">
                  <span className="muted">{assetsCopy.schedule.disposalDeductible}: </span>
                  <span data-testid={`asset-disposal-deductible-${asset.id}`}>
                    {formatBani(outcome.disposal.deductible)}
                  </span>
                </div>
                <div className="text-sm muted" style={{ marginTop: 6 }}>{assetsCopy.schedule.disposalRule}</div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function gapText(gap: DepreciationGap): string {
  switch (gap) {
    case 'punere_in_functiune_absenta': return assetsCopy.gaps.punereInFunctiune;
    case 'aport_contra_k1': return assetsCopy.gaps.aport;
    case 'plata_vs_punere_in_functiune': return assetsCopy.gaps.plata;
    case 'optiune_alin_21_lipsa': return assetsCopy.gaps.optiuneAlin21;
    case 'durata_lipsa': return assetsCopy.gaps.durata;
    case 'coeficient_degresiv_indefinit': return assetsCopy.gaps.coeficient;
  }
}

export default function Assets() {
  const store = useStore();
  const { fixedAssets, addFixedAsset, toast } = store;
  const [editing, setEditing] = useState<FixedAsset | 'new' | null>(null);

  // B-93 — one leg for the whole page, not one per card. The reconciliation between a computed schedule and
  // a hand-recorded depreciation expense is a question about the register AND the expense list together; a
  // per-card call would answer it once per asset against the same two lists.
  const leg = useMemo(() => {
    const asOf = localDateISO(now());
    const selection = selectRuleSet(store.profile.fiscalYear, asOf);
    return selectAssetDepreciation(store, asOf, selection ? [...selection.rules] : []);
  }, [store]);

  const rows = useMemo(
    () => [...fixedAssets].sort((a, b) => a.entryDate.localeCompare(b.entryDate)),
    [fixedAssets],
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{assetsCopy.title}</h1>
          <div className="sub">{assetsCopy.subtitle}</div>
        </div>
        <div className="actions">
          <button className="btn btn-primary" data-testid="asset-add" onClick={() => setEditing('new')}>
            + {assetsCopy.form.addAsset}
          </button>
        </div>
      </div>

      <Card>
        <div style={{ padding: '4px 2px' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{assetsCopy.intro.heading}</div>
          <div className="text-sm">{assetsCopy.intro.body}</div>
          <div className="text-sm muted" style={{ marginTop: 8 }}>{assetsCopy.intro.notInferred}</div>
          <div className="text-sm muted" style={{ marginTop: 6 }}>{assetsCopy.intro.purchaseIsNotAnExpense}</div>
        </div>
      </Card>

      <Card>
        <div style={{ padding: '4px 2px' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{assetsCopy.vehicleLists.heading}</div>
          <div className="text-sm">{assetsCopy.vehicleLists.body}</div>
          <div className="text-sm muted" style={{ marginTop: 8 }}>{assetsCopy.vehicleLists.closing}</div>
          <div className="text-sm muted" style={{ marginTop: 6 }}>{assetsCopy.vehicleLists.oneCarLimit}</div>
          <div className="text-sm muted" style={{ marginTop: 6 }}>{assetsCopy.schedule.m1CapPerVehicle}</div>
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <Empty
            icon="🏷"
            title={assetsCopy.form.emptyTitle}
            text={assetsCopy.form.empty}
            action={<button className="btn btn-primary" data-testid="asset-add-empty" onClick={() => setEditing('new')}>+ {assetsCopy.form.addAsset}</button>}
          />
        </Card>
      ) : (
        rows.map(a => <AssetCard key={a.id} asset={a} leg={leg} />)
      )}

      {editing && (
        <AssetForm
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={a => {
            addFixedAsset(a);
            toast('success', assetsCopy.form.added);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
