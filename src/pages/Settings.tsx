import { useEffect, useState } from 'react';
import { leiInputValue, parseLeiInput } from '../domain/money';
import { useStore } from '../data/store';
import { Card, Badge, Modal } from '../components/ui';
import { Disclosure } from '../components/ui/Disclosure';
import { InterpretationNote } from '../components/ui/InterpretationNote';
import { FxRateProvenance } from '../components/ui/FxRateProvenance';
import { FxRateEntryForm } from '../components/ui/FxRateEntryForm';
import { copy, fields, scope as scopeCopy, settings as settingsCopy, validation, occupancy as occupancyCopy, vehicles as vehiclesCopy } from '../ui/copy';
// PG-6c (D-VEH-3) — the vehicle facts are read and written through the same resolver the classifier runs,
// so the screen and the calculation cannot disagree about which car the one-car allowance follows. The
// option lists come from the rule vocabulary, not from a list written here.
import {
  VEHICLE_EXCEPTION_CATEGORIES,
  VEHICLE_USE_VALUES,
  vehicleCapStatuses,
  vehicleYearFacts,
  type VehicleExceptionCategory,
  type VehicleUseFact,
  type VehicleYearFacts,
  type VehicleYesNo,
} from '../domain/fiscal/deductibility';
import type { Vehicle } from '../data/types';
import { isFiledVatReturn } from '../data/types';

/** The four per-car facts the section can write. `fiscalYear` is never edited from a control. */
type VehicleFactField = 'use' | 'exceptionCategory' | 'usedByPerson' | 'designatedForRunningCosts';
import {
  isSelectableRegime,
  regimeRefusalReason,
  selectableRegimes,
} from '../domain/regimes';
import { epochMs, formatRoCalendarDate, isoCalendarDateProblem, isoCalendarDateProblemText, localDateISO } from '../domain/date';
import type { Bani } from '../domain/money';
// PG-6b (B-29) — the declared activity family. The type comes from the classifier that reads the fact, so
// the option list on this form and the rule condition cannot drift into two vocabularies.
import type { ActivityFamily } from '../domain/fiscal/deductibility';
// PG-6f (B-30) — the registration state and its six values come from the domain, not from a list written
// here. A select whose options drift from the union the engine switches on is the same defect class as a
// rule constant hard-coded at a call site.
import {
  VAT_REGISTRATION_VALUES,
  type VatRegistrationStatus,
} from '../domain/fiscal/vat';
// B-97 (D-AIC-1, D-AIC-2) — the art. 322 alin. (7)-(8) facts. The derivation and the calendar are imported,
// never reimplemented: `vatPeriodicityForYear` answers whether a quarter exists to flip, `aicFlipForQuarter`
// says which litera applies and which periods replace the quarter, and `aicMentiuniObligation` counts the
// five working days of alin. (8). This file writes facts; it computes nothing fiscal.
import {
  vatPeriodicityForYear,
  alin7MonthStart,
  type VatPeriodicityFacts,
} from '../domain/fiscal/vatPeriodicity';
import {
  aicFlipForQuarter,
  aicMentiuniObligation,
  alin8PremiseForYear,
  periodLabel,
} from '../domain/fiscal/vatReturn';
import { recordedRateProvider } from '../domain/fx/ledger';
import type {
  AccommodationCommissionReading,
  PfaProfile,
  PfaRegime,
  PfaSalaryStatus,
  PfaSocialInsuranceStatus,
} from '../domain/models';
// PG-6h-2 — the title shown under the accommodation fields is resolved by the same function the scenario
// registry reads, so the screen and the refusal cannot disagree about which title a profile is in. The
// CAEN prompt is read through `profileHasTourismCaen`, whose list is this app's own choice (HG 656/1997
// art. 4 alin. (1)-(2)) and which answers nothing.
import {
  accommodationIncomeTitleForYear,
  profileHasTourismCaen,
  withAccommodationRoomCount,
} from '../domain/models';
// PG-6d (D-OTH-1, D-OTH-2, B-41) — the six art. 155 alin. (1) lit. c)-h) amounts, read and written per
// fiscal year. `withCassLadderYear` is used rather than a wholesale replace so editing 2026 cannot erase a
// year the profile already holds for 2027.
import {
  CASS_AGRI_BAZA_VALUES,
  CASS_CEDARE_SURSA_VALUES,
  CASS_INVEST_BAZA_VALUES,
  cassLadderForYear,
  withCassLadderYear,
  type CassAgriBaza,
  type CassCedareSursa,
  type CassInvestBaza,
  type CassLadderYear,
} from '../domain/models';

/**
 * PG-6d — the six amount fields of the ladder section, in the order art. 155 alin. (1) lists them.
 *
 * A list rather than six hand-written blocks, so the order the law uses is the order the screen uses and a
 * category cannot be dropped from the form without being dropped from the list. The list is also what the
 * "answered N of six" note counts — the same six the engine sums.
 */
const LADDER_AMOUNT_FIELDS = [
  'proprietateIntelectuala',
  'asocierePersoanaJuridica',
  'cedareaFolosinteiBunurilor',
  'activitatiAgricole',
  'investitii',
  'alteSurse',
] as const;
type LadderAmountField = (typeof LADDER_AMOUNT_FIELDS)[number];

/**
 * The stored amount for one ladder category, rendered back into an input.
 *
 * `''` when the category was never answered. That is not the same string as `'0'`, and the difference is
 * the whole content of B-41: an empty box writes absence, a `0` writes a declared zero. `leiInputValue`,
 * not `String(...)` — the stored value is integer bani and an input is a screen.
 */
function ladderAmountInput(profile: PfaProfile, key: LadderAmountField): string {
  const value = cassLadderForYear(profile.cassLadderYears, profile.fiscalYear)?.[key];
  return typeof value === 'number' ? leiInputValue(value) : '';
}

/**
 * B-97 (D-AIC-2) — the three consequences of answering „da”, computed rather than typed.
 *
 * `aicFlipForQuarter` decides which litera of art. 322 alin. (7) applies and which fiscal periods replace
 * the quarter; `aicMentiuniObligation` counts the five working days of alin. (8) and returns the term. The
 * split and the date are **not** written out in this file: a hand-counted working-day term here would be a
 * second calendar, and the second calendar is always the one that drifts from the first.
 *
 * The quarter is derived from the month, exactly as the calendar in `data/dashboard.ts` derives it. Asking a
 * person for the quarter would let them type an answer off by one month that no arithmetic downstream could
 * detect.
 */
function aicEffectLines(year: number, month: number): string[] {
  const a = settingsCopy.fiscal.aic;
  const quarter = Math.ceil(month / 3);
  const flip = aicFlipForQuarter(year, quarter, month);
  const lines: string[] = [];
  if (flip) {
    // B-101 — the sentence the panel owes the calendar. `alin7MonthStart` is the same authority the
    // derivation and the obligation builder read, so the point named here cannot be a hand-written month
    // that the calendar then contradicts.
    const start = alin7MonthStart(month);
    const since = start === null
      ? ''
      : start > 12
      ? ` ${a.effectSinceNextYear(year + 1)}`
      : ` ${a.effectSince(`${String(start).padStart(2, '0')}.${year}`)}`;
    lines.push(`${a.effectMonthly} ${flip.note}${since}`);
  }
  lines.push(
    flip && flip.periods.length > 1
      ? a.effectReturnsSplit(
          flip.quarter,
          flip.periods.length,
          flip.periods.map(periodLabel).join(', '),
        )
      : a.effectReturnsOne(quarter),
  );
  const mentiuni = aicMentiuniObligation({ year, monthOfExigibility: month });
  if (mentiuni) {
    lines.push(a.effectMentiuni(formatRoCalendarDate(mentiuni.dueOn), a.monthNames[month - 1], year));
  }
  return lines;
}

/** The quarter a month of exigibility falls in — derived, shown, never asked. */
function aicQuarterOf(month: number): number {
  return Math.ceil(month / 3);
}

/**
 * PG-6c (D-VEH-3) — the vehicle facts, per car and per fiscal year.
 *
 * This section writes through the store directly rather than through the profile form's save button, for
 * the same reason the FX-rate entry does: these are records in their own collection, not profile fields,
 * and a pending edit that is never saved would leave a car half-declared — which for these facts is not
 * untidiness but a legal state the screen would be inventing.
 *
 * Three things the controls must not do, and each is a control that is **absent** rather than a control
 * that behaves well:
 *  - no control pre-fills anything. Every select starts empty, and an empty select writes nothing back —
 *    `setVehicleYearFacts` drops an all-empty year rather than storing a row of blanks.
 *  - no control picks the deductible car for the person. The designation select records the person's own
 *    choice under art. 68 alin. (5) lit. j); the app never sets it, copies it across years, or resolves a
 *    tie (`docs/ai/research/40_vehicle_one_car_limit.md` §1).
 *  - no control asks about depreciation. lit. k) excludes amortisation from these rules and the art. 28
 *    alin. (14) ceiling belongs to the fixed-asset phase.
 *
 * The status line under each car is read from `vehicleCapStatuses` — the same resolver the classifier runs
 * — so the screen and the calculation cannot state different things about which car the allowance follows.
 */
function VehicleSection() {
  const { vehicles, profile, addVehicle, deleteVehicle, setVehicleYearFacts, toast } = useStore();
  const fiscalYear = profile.fiscalYear;
  const statuses = vehicleCapStatuses(vehicles, fiscalYear);
  const [draft, setDraft] = useState({ label: '', plate: '' });

  const patch = (vehicle: Vehicle, field: VehicleFactField, value: string) => {
    const current = vehicleYearFacts(vehicle, fiscalYear) ?? { fiscalYear };
    const cleared = value === '';
    // One write per control. An empty select clears that fact rather than storing an empty string, and the
    // store then drops the year entry entirely if nothing is left in it — so "answered with nothing" never
    // becomes a second shape of "never answered".
    const next: VehicleYearFacts = {
      ...current,
      fiscalYear,
      ...(field === 'use' ? { use: cleared ? undefined : (value as VehicleUseFact) } : {}),
      ...(field === 'exceptionCategory'
        ? { exceptionCategory: cleared ? undefined : (value as VehicleExceptionCategory) }
        : {}),
      ...(field === 'usedByPerson'
        ? { usedByPerson: cleared ? undefined : (value as VehicleYesNo) }
        : {}),
      ...(field === 'designatedForRunningCosts'
        ? { designatedForRunningCosts: cleared ? undefined : (value as VehicleYesNo) }
        : {}),
    };
    setVehicleYearFacts(vehicle.id, next);
  };

  return (
    <div className="field" data-vehicle-block>
      <label>{vehiclesCopy.block.label}</label>
      <span className="hint">{vehiclesCopy.block.intro}</span>
      <span className="hint">{vehiclesCopy.block.perPerson}</span>
      <span className="hint">{vehiclesCopy.block.ownership}</span>

      {vehicles.length === 0 && <span className="hint" data-vehicle-empty>{vehiclesCopy.block.empty}</span>}

      {vehicles.map(v => {
        const facts = vehicleYearFacts(v, fiscalYear);
        const status = statuses.get(v.id);
        return (
          <div key={v.id} data-vehicle-row style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <strong>{v.label}</strong>
            {v.plate ? <span className="muted"> · {v.plate}</span> : null}
            {status && (
              <span className="hint" data-vehicle-status>
                {vehiclesCopy.status[status]}
              </span>
            )}

            <label htmlFor={`set-vehicle-used-by-person-${v.id}`}>{vehiclesCopy.facts.usedByPerson}</label>
            <select
              id={`set-vehicle-used-by-person-${v.id}`}
              className="input"
              data-vehicle-used-by-person
              value={facts?.usedByPerson ?? ''}
              onChange={e => patch(v, 'usedByPerson', e.target.value)}
            >
              <option value="">{copy.ui.answerUnrecorded}</option>
              <option value="da">{vehiclesCopy.facts.yes}</option>
              <option value="nu">{vehiclesCopy.facts.no}</option>
            </select>
            <span className="hint">{vehiclesCopy.facts.usedByPersonHint}</span>
            {facts?.usedByPerson === undefined && (
              <span className="hint">{vehiclesCopy.facts.usedByPersonUnanswered}</span>
            )}

            <label htmlFor={`set-vehicle-use-${v.id}`}>{vehiclesCopy.facts.use}</label>
            <select
              id={`set-vehicle-use-${v.id}`}
              className="input"
              data-vehicle-use
              value={facts?.use ?? ''}
              onChange={e => patch(v, 'use', e.target.value)}
            >
              <option value="">{copy.ui.answerUnrecorded}</option>
              {VEHICLE_USE_VALUES.map(u => (
                <option key={u} value={u}>{vehiclesCopy.facts.useOptions[u]}</option>
              ))}
            </select>
            <span className="hint">{vehiclesCopy.facts.useHint}</span>
            {(facts?.use === undefined || facts?.use === 'unknown') && (
              <span className="hint" data-vehicle-use-default>{vehiclesCopy.facts.useUnanswered}</span>
            )}

            <label htmlFor={`set-vehicle-exception-${v.id}`}>{vehiclesCopy.facts.exception}</label>
            <select
              id={`set-vehicle-exception-${v.id}`}
              className="input"
              data-vehicle-exception
              value={facts?.exceptionCategory ?? ''}
              onChange={e => patch(v, 'exceptionCategory', e.target.value)}
            >
              <option value="">{vehiclesCopy.facts.exceptionOptions.none}</option>
              {VEHICLE_EXCEPTION_CATEGORIES.map(c => (
                <option key={c} value={c}>{vehiclesCopy.facts.exceptionOptions[c]}</option>
              ))}
            </select>
            <span className="hint">{vehiclesCopy.facts.exceptionHint}</span>

            <label htmlFor={`set-vehicle-designation-${v.id}`}>{vehiclesCopy.facts.designation}</label>
            <select
              id={`set-vehicle-designation-${v.id}`}
              className="input"
              data-vehicle-designation
              value={facts?.designatedForRunningCosts ?? ''}
              onChange={e => patch(v, 'designatedForRunningCosts', e.target.value)}
            >
              <option value="">{copy.ui.answerUnrecorded}</option>
              <option value="da">{vehiclesCopy.facts.yes}</option>
              <option value="nu">{vehiclesCopy.facts.no}</option>
            </select>
            <span className="hint">{vehiclesCopy.facts.designationHint}</span>

            <button
              className="btn btn-sm btn-ghost"
              data-vehicle-remove
              onClick={() => { deleteVehicle(v.id); toast('success', vehiclesCopy.block.remove); }}
            >
              {vehiclesCopy.block.remove}
            </button>
          </div>
        );
      })}

      <label htmlFor="set-vehicle-label">{vehiclesCopy.block.labelField}</label>
      <input
        id="set-vehicle-label"
        className="input"
        data-vehicle-label
        value={draft.label}
        onChange={e => setDraft({ ...draft, label: e.target.value })}
        placeholder={vehiclesCopy.block.labelPlaceholder}
      />
      <label htmlFor="set-vehicle-plate">
        {vehiclesCopy.block.plateField} <span className="muted">{vehiclesCopy.block.plateOptional}</span>
      </label>
      <input
        id="set-vehicle-plate"
        className="input"
        data-vehicle-plate
        value={draft.plate}
        onChange={e => setDraft({ ...draft, plate: e.target.value })}
      />
      <button
        className="btn btn-sm"
        data-vehicle-add
        onClick={() => {
          if (!addVehicle({ label: draft.label.trim(), plate: draft.plate.trim() || undefined, years: [] })) {
            return;
          }
          setDraft({ label: '', plate: '' });
        }}
      >
        {vehiclesCopy.block.add}
      </button>
      <span className="hint">{vehiclesCopy.block.yearNote}</span>
    </div>
  );
}

// Canonical route hash keys (must match VALID_TABS.settings in App.tsx).
// Mirrors the live SOLO settings page (docs/reference/settings.md);
// the real app's "Abonament" tab is intentionally not replicated.
// `fiscal` is NOT in the live SOLO page: it is where this replica edits the
// PfaProfile contract (Phase 6) — the profile had no write path at all before.
const TABS = [
  { key: 'company', label: settingsCopy.tabs.pfa },
  { key: 'fiscal', label: settingsCopy.tabs.fiscal },
  { key: 'einvoice', label: settingsCopy.tabs.eFactura },
  { key: 'bankaccounts', label: settingsCopy.tabs.bankAccounts },
  { key: 'account', label: settingsCopy.tabs.personal },
  // Phase 11: where demo data is opted into and where all data is removed. Neither belonged on an
  // existing tab — "delete everything" next to "change your bank details" is how a destructive control
  // gets clicked by accident.
  { key: 'data', label: settingsCopy.tabs.data },
] as const;
type TabKey = (typeof TABS)[number]['key'];

/**
 * TASK 7 — the one shape a legal hint takes in this form.
 *
 * A person filling a form gets one plain sentence about what the field means. Where the law does not
 * settle something, the reusable „Notă de interpretare" says what is undecided and what the app does
 * about it. The Cod fiscal text itself — which used to sit in the middle of every field, and at the
 * CASS field printed the internal token `review_required` — moves behind „Surse și note de
 * interpretare", a real `<details>` control, keyboard-operable, with the citation kept. Nothing was
 * deleted; it is no longer inline.
 */
function FieldLegal({ hint, note, source }: { hint: string; note?: string; source?: string }) {
  return (
    <>
      <span className="hint">{hint}</span>
      {note ? <InterpretationNote note={note} /> : null}
      {source ? (
        <Disclosure label={copy.disclosure.sources}>
          <p className="hint">{source}</p>
        </Disclosure>
      ) : null}
    </>
  );
}

interface SettingsProps {
  initialTab?: string;
  onTabChange?: (tab: string) => void;
}

/**
 * TASK 5 — the three states a pension/CASS-exception select can hold. `''` is "not recorded", which is
 * NOT the same answer as `nu`: `nu` asserts a checked negative, `''` leaves the fact unknown. Without
 * this label TypeScript widens the empty option to `string` and the save path loses the union.
 */
type TriState = 'da' | 'nu' | '';

/** Narrow a `TriState` to the two recorded answers, or `undefined` for "not recorded". */
function recorded(value: TriState): 'da' | 'nu' | undefined {
  return value === '' ? undefined : value;
}

/**
 * TASK 5 — parse the recorded suspension months. Returns `null` for anything that is not a list of
 * whole months 1-12, and `[]` for an empty field ("not recorded"), which the save path turns into
 * `undefined` rather than an empty record.
 */
function parseSuspensionMonths(raw: string): number[] | null {
  const trimmed = raw.trim();
  if (trimmed === '') return [];
  const months: number[] = [];
  for (const part of trimmed.split(',')) {
    const token = part.trim();
    if (token === '') continue;
    const n = Number(token);
    if (!Number.isInteger(n) || n < 1 || n > 12) return null;
    if (!months.includes(n)) months.push(n);
  }
  return months.sort((a, b) => a - b);
}

export default function Settings({ initialTab, onTabChange }: SettingsProps) {
  // Identity/contact fields come from ONE store: `profile.identity` (D-1). The
  // legacy `settings.company` / `settings.personal` blocks are not read here at
  // all — they are frozen legacy data, read only by the migration chain.
  // `settings` itself stays live for what is genuinely settings: e-Factura
  // behaviour and the bank-account list.
  const store = useStore();
  const { settings, updateSettings, profile, updateProfile, toast, fxRates, dataOrigin, sandboxActive, loadSandbox, unloadSandbox, resetAllData } = store;
  const identity = profile.identity;
  const [wipeOpen, setWipeOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>(
    TABS.some(t => t.key === initialTab) ? (initialTab as TabKey) : 'company'
  );

  // Sync tab when the URL changes (back/forward navigation).
  useEffect(() => {
    if (TABS.some(t => t.key === initialTab)) setTab(initialTab as TabKey);
  }, [initialTab]);

  // --- PFA tab: editable registration data ---
  const [company, setCompany] = useState({
    denumire: identity.denumire,
    cui: identity.cui,
    numarRegComert: identity.numarRegComert,
    adresaSocietate: identity.adresaSocietate,
  });
  const [mentiuni, setMentiuni] = useState(identity.mentiuniFactura ?? '');

  // --- Personal tab: now a real write path (Phase 7 scope item 2). These inputs
  // were `disabled` in the mock because the data had no owner; `profile.identity`
  // is that owner.
  const [personal, setPersonal] = useState({
    nume: identity.nume,
    email: identity.email,
    telefon: identity.telefon,
  });

  // --- e-Factura tab ---
  const [ef, setEf] = useState(settings.eFactura);

  // --- Regim fiscal tab: the PfaProfile write path (Phase 6) ---
  // Numbers are held as strings so an empty/invalid input can be shown as invalid
  // instead of being coerced to 0 (the Revenues.tsx validation pattern).
  const [fiscal, setFiscal] = useState({
    regime: profile.regime,
    // CAEN is identity data now (D-1); the field stays on this tab because that
    // is where its "does not change the regime" caveat belongs, but it reads and
    // writes `identity.caen`, not the deprecated `profile.caen` string.
    caen: identity.caen?.[0]?.cod ?? '',
    // PG-6b (B-29) — a THREE-state field, like the pension facts below it: `''` means the person has never
    // answered, which is not the same answer as `other`. `other` asserts that the sistem real rules apply;
    // leaving it unanswered keeps the estimate `incomplete` and says so. The app never fills this in from
    // the CAEN field above — `research/30` §3 records that the CAEN columns of the nomenclator are
    // „menționate cu titlu exemplificativ”, so a code is not a statement about the taxation method.
    activityFamily: (profile.activityFamily ?? '') as ActivityFamily | '',
    // PG-6h-2 (B-82, B-84) — the three accommodation facts, each read back for the fiscal year the profile
    // declares, each with the same third state the pension facts above use. `''` for the room count means
    // "never recorded", which is NOT 1 room and NOT 7 rooms: the count decides the TITLE the income falls
    // under (art. 83 alin. (2) / art. 85 versus art. 83 alin. (4) / art. 68^3), so a form that showed a
    // number by default would mint a tax category. The commission reading and the eligibility answer are
    // the person's own statements; nothing here is filled in from `fiscal.caen`, and the block below the
    // CAEN field says so out loud (D-COM-2, B-83).
    accommodationRooms:
      profile.accommodationRoomCounts?.find((r) => r.fiscalYear === profile.fiscalYear)?.rooms.toString() ?? '',
    accommodationCommission: (profile.accommodationCommissionReading ?? '') as
      | AccommodationCommissionReading
      | '',
    accommodationEligibility: (profile.accommodationTourismEligibility ?? '') as TriState,
    // PG-6d (D-OTH-1, B-41) — the six art. 155 alin. (1) lit. c)-h) amounts, read back for the fiscal year
    // the profile declares. Every one has a THIRD state: an empty box means "never answered", which is not
    // 0 lei and not "no income". The engine refuses to sum a partial answer set, so the form must be able
    // to express a hole rather than fill it in.
    ladderAmounts: {
      proprietateIntelectuala: ladderAmountInput(profile, 'proprietateIntelectuala'),
      asocierePersoanaJuridica: ladderAmountInput(profile, 'asocierePersoanaJuridica'),
      cedareaFolosinteiBunurilor: ladderAmountInput(profile, 'cedareaFolosinteiBunurilor'),
      activitatiAgricole: ladderAmountInput(profile, 'activitatiAgricole'),
      investitii: ladderAmountInput(profile, 'investitii'),
      alteSurse: ladderAmountInput(profile, 'alteSurse'),
    } as Record<LadderAmountField, string>,
    // Which of the two measurements the law offers for that category the typed figure actually is.
    ladderAgricoleBaza: (cassLadderForYear(profile.cassLadderYears, profile.fiscalYear)
      ?.activitatiAgricoleBaza ?? '') as CassAgriBaza | '',
    ladderInvestitiiBaza: (cassLadderForYear(profile.cassLadderYears, profile.fiscalYear)
      ?.investitiiBaza ?? '') as CassInvestBaza | '',
    // D-OTH-2 — the two facts that decide whether an amount belongs in this basin at all.
    ladderCedareSursa: (cassLadderForYear(profile.cassLadderYears, profile.fiscalYear)
      ?.cedareaSursa ?? '') as CassCedareSursa | '',
    ladderAlteSurseArt114: (cassLadderForYear(profile.cassLadderYears, profile.fiscalYear)
      ?.alteSurseArt114 ?? '') as TriState,
    // Stored, never added (art. 170 alin. (5)); and the credit this app does not model (art. 174¹).
    ladderNeimpozabil: (() => {
      const v = cassLadderForYear(profile.cassLadderYears, profile.fiscalYear)?.neimpozabil;
      return typeof v === 'number' ? leiInputValue(v) : '';
    })(),
    ladderCassRetinut: (() => {
      const v = cassLadderForYear(profile.cassLadderYears, profile.fiscalYear)?.cassRetinutLaSursa;
      return typeof v === 'number' ? leiInputValue(v) : '';
    })(),
    pfaStartYear: String(profile.pfaStartYear),
    fiscalYear: String(profile.fiscalYear),
    pfaStartDate: profile.pfaStartDate ?? '',
    salaryStatus: profile.salaryStatus,
    // `leiInputValue`, not `String(...)`: the stored amount is integer bani and an input is a screen.
    // The `undefined` branch stays a separate case — an empty field means "not recorded", which is not 0.
    salaryIncomeLei: profile.salaryIncomeLei === undefined ? '' : leiInputValue(profile.salaryIncomeLei),
    // TASK 5 — the pension facts, each read back for the fiscal year the profile declares. Every one of
    // them is a THREE-state select: '' means "not recorded", which is a different state from answering
    // `nu` (a checked negative) and from `da`. Collapsing '' into 'nu' would assert a fact the user
    // never stated, and for art. 174 alin. (7) lit. c) it would decide a tax relief.
    pensionerStatus: (profile.pensionerStatus ?? '') as TriState,
    pensionReceipt: (profile.pensionReceiptYears?.find((r) => r.fiscalYear === profile.fiscalYear)?.received ??
      '') as TriState,
    pensionSuspensionMonths:
      profile.pensionSuspensionYears?.find((s) => s.fiscalYear === profile.fiscalYear)?.months.join(',') ?? '',
    previousYearExcepted: (
      profile.cassPreviousYearContext?.previousFiscalYear === profile.fiscalYear - 1
        ? profile.cassPreviousYearContext.inExceptedCategory ?? ''
        : ''
    ) as TriState,
    previousYearOption: (
      profile.cassPreviousYearContext?.previousFiscalYear === profile.fiscalYear - 1
        ? profile.cassPreviousYearContext.optedUnderArt180Alin1 ?? ''
        : ''
    ) as TriState,
    foreignInsuranceHeld: (
      profile.foreignSicknessInsurance?.fiscalYear === profile.fiscalYear
        ? profile.foreignSicknessInsurance.held ?? ''
        : ''
    ) as TriState,
    foreignInsuranceProved: (
      profile.foreignSicknessInsurance?.fiscalYear === profile.fiscalYear
        ? profile.foreignSicknessInsurance.proved ?? ''
        : ''
    ) as TriState,
    socialInsuranceStatus: profile.socialInsuranceStatus,
    // PG-6f (B-30) — the retired `vatExempt` yes/no is replaced by the registration STATE the law
    // actually uses, plus the orthogonal TVA la încasare flag. Empty means „never asked”, which is a
    // third state and not `scutit_art310`: the app does not know whether this person charges TVA, and
    // either guess moves the money measure of every record in the register.
    vatRegistration: (profile.vatRegistration?.status ?? '') as VatRegistrationStatus | '',
    vatCashAccounting: (profile.vatRegistration?.cashAccounting ?? '') as TriState,
    // Optional: an empty field means "the app does not know the date", which is not
    // the same as "there is no VAT deadline" — see VAT_REGISTRATION_DEADLINE_2026.
    vatExceedanceDate: profile.vatExceedanceDate ?? '',
    cashFloorLei: leiInputValue(profile.cashFloorLei),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const regimeOptions = selectableRegimes();

  // ── B-97 (D-AIC-1, D-AIC-2) — art. 322 alin. (7)-(8), collected per fiscal year ──────
  //
  // The two facts live in `PfaProfile.vatPeriodicityYears`, which is a record **per calendar year**, and
  // `getVatObligations` in `data/dashboard.ts` reads them for `profile.fiscalYear`. A profile-level toggle
  // would therefore be a different model from the one the arithmetic already reads: it could not answer
  // „was the period a quarter in 2026, and is it one in 2027?” separately, which is what alin. (7) turns
  // on. So this block is keyed to the year the tab already declares, exactly like the room count, the
  // pension facts and the ladder amounts above it.
  //
  // It writes through the store on its own rather than waiting for „Salvează”, for the same reason the
  // vehicle facts and the FX form do: the confirmation *is* the save action, and a pending alin. (7)
  // answer sitting in a form nobody re-saves would be a fiscal state the screen invented.
  const aicYear = profile.fiscalYear;
  const aicStored = (profile.vatPeriodicityYears ?? []).find((y) => y.year === aicYear);
  const [aic, setAic] = useState<{ answer: '' | 'da' | 'nu'; month: string }>({
    answer:
      aicStored?.aicGoodsWhileQuarterly === 'da' || aicStored?.aicGoodsWhileQuarterly === 'nu'
        ? aicStored.aicGoodsWhileQuarterly
        : '',
    month: aicStored?.aicGoodsExigibilityMonth ? String(aicStored.aicGoodsExigibilityMonth) : '',
  });
  const [aicConfirmOpen, setAicConfirmOpen] = useState(false);

  /*
   * The block is keyed to the year the profile declares, so it has to re-seed when that year changes.
   *
   * This is not tidiness. The other per-year fields on this tab are staged in the form and written by
   * „Salvează”, so a stale value is at worst an edit the person can still see and correct. This block
   * writes on its own, the moment the confirmation is pressed — so a control still showing 2026's answer
   * after the profile moved to 2027 would record last year's fact against this year, which is exactly the
   * kind of fiscal statement this app must not make by accident.
   */
  useEffect(() => {
    setAic({
      answer:
        aicStored?.aicGoodsWhileQuarterly === 'da' || aicStored?.aicGoodsWhileQuarterly === 'nu'
          ? aicStored.aicGoodsWhileQuarterly
          : '',
      month: aicStored?.aicGoodsExigibilityMonth ? String(aicStored.aicGoodsExigibilityMonth) : '',
    });
    setAicConfirmOpen(false);
    // Keyed to the year and to the two stored facts, not to the whole record: a pending „da” plus a month
    // changes neither, so the person's unconfirmed answer survives while they read the consequences.
  }, [aicYear, aicStored?.aicGoodsWhileQuarterly, aicStored?.aicGoodsExigibilityMonth]);

  /*
   * Can this answer change anything, and if it cannot — why not, said out loud?
   *
   * The derivation is run over the year's facts **with the two alin. (7) facts removed**. That is not a
   * second rule and not a re-derivation: it is the same `vatPeriodicityForYear` asked the question art.
   * 322 alin. (7) itself asks — what would the period be *but for* this exception? Asking it against the
   * full fact set would make the question vanish the moment it is answered, because the answer is precisely
   * what makes the period monthly, and an answered fact that becomes invisible is a fact nobody can check
   * or correct.
   */
  const aicFactsWithoutFlip = (profile.vatPeriodicityYears ?? []).map((y) => {
    if (y.year !== aicYear) return y;
    const without: VatPeriodicityFacts = { ...y };
    delete without.aicGoodsWhileQuarterly;
    delete without.aicGoodsExigibilityMonth;
    return without;
  });
  const aicPeriodWithoutFlip = vatPeriodicityForYear(
    aicFactsWithoutFlip,
    aicYear,
    recordedRateProvider(store),
    profile.vatRegistration,
    // B-102 — the same premise the dashboard and the completeness channel pass, for the same reason:
    // three call sites, one answer. Without it this gate reads only the year's own facts and would offer
    // the alin. (7) question to a person the previous year's acquisition already put on the month — and
    // alin. (7) applies only to someone „care utilizează trimestrul calendaristic ca perioadă fiscală”, so
    // the question would be one the person cannot truthfully answer `da` to.
    {
      alin8: alin8PremiseForYear(
        aicFactsWithoutFlip,
        aicYear,
        store.vatReturns ?? [],
        isFiledVatReturn,
      ),
    },
  );
  const aicPeriodButForFlip =
    aicPeriodWithoutFlip.kind === 'ask' ? null : aicPeriodWithoutFlip.periodicity;
  const aicRegistrationStatus = profile.vatRegistration?.status;
  const aicRecorded =
    aicStored?.aicGoodsWhileQuarterly === 'da' || aicStored?.aicGoodsWhileQuarterly === 'nu';
  /** `null` means the question is worth asking. Every other value is the reason it is not, and is shown. */
  let aicNotAsked:
    | null
    | 'registration_unknown'
    | 'not_registered'
    | 'monthly'
    | 'monthly_by_user' = null;
  if (aicRegistrationStatus === undefined) {
    aicNotAsked = 'registration_unknown';
  } else if (aicRegistrationStatus === 'scutit_art310') {
    aicNotAsked = 'not_registered';
  } else if (aicPeriodButForFlip === 'month') {
    aicNotAsked = aicPeriodWithoutFlip.kind === 'user_confirmed' ? 'monthly_by_user' : 'monthly';
  }
  const aicMonthNumber = aic.month === '' ? null : Number(aic.month);
  const aicEffectsPending = aic.answer === 'da' && aicMonthNumber !== null;
  const aicEffectLinesForYear = aicEffectsPending
    ? aicEffectLines(aicYear, aicMonthNumber as number)
    : [];

  // PG-6h-2 (B-82) — which income TITLE the accommodation block currently describes.
  //
  // It follows the form rather than only the stored profile, so the person sees which title a number would
  // put them under *before* saving; the initial value is read from the profile, so on load the two are the
  // same. The comparison itself is not written here — `accommodationIncomeTitleForYear` is the single place
  // the art. 83 alin. (4) boundary is read, and it is the same resolver `scenarios.ts` reads, so the form
  // and the refusal cannot state different titles for one profile. An unparseable or empty field resolves
  // to `null`, which renders the "the app does not know the title" line rather than a default.
  const accommodationRoomsTyped = fiscal.accommodationRooms.trim();

  // PG-6d — how many of the six categories the form currently answers, and which ones are still open. The
  // sum at art. 170 alin. (4) runs over ALL six, so a hole is not a small gap: it is the reason no base
  // exists at all. Naming the missing categories is what turns "no estimate" into something the person can
  // close, and it is the same six the engine sums — one list, used by both.
  const ladderMissing = LADDER_AMOUNT_FIELDS.filter((k) => fiscal.ladderAmounts[k].trim() === '');
  const ladderAnsweredCount = LADDER_AMOUNT_FIELDS.length - ladderMissing.length;
  const accommodationRoomsParsed =
    accommodationRoomsTyped === '' ? Number.NaN : Number(accommodationRoomsTyped);
  const accommodationTitle = Number.isInteger(accommodationRoomsParsed) && accommodationRoomsParsed >= 0
    ? accommodationIncomeTitleForYear(
        [{ fiscalYear: profile.fiscalYear, rooms: accommodationRoomsParsed }],
        profile.fiscalYear,
      )
    : null;
  const accommodationTitleText =
    accommodationTitle === 'cedarea_folosintei'
      ? settingsCopy.fiscal.accommodationTitleCedarea(profile.fiscalYear)
      : accommodationTitle === 'activitate_independenta_68x3'
        ? settingsCopy.fiscal.accommodationTitleIndependent(profile.fiscalYear)
        : settingsCopy.fiscal.accommodationTitleUnknown(profile.fiscalYear);
  // PG-6h-2 (D-COM-2, B-83) — whether a CAEN class on the profile additionally prompts the accommodation
  // questions. This is the whole authority the list has: it opens a question, it never fills one in, and it
  // is never the only way the block appears (the declared family above it is).
  const tourismCaenPresent = profileHasTourismCaen(identity);

  // --- Modals ---
  const [tvaOpen, setTvaOpen] = useState(false);
  const [tvaCode, setTvaCode] = useState('');
  const [tvaFound, setTvaFound] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [newBank, setNewBank] = useState({ banca: '', moneda: 'RON' });

  /** Write identity fields through the profile — the one canonical store. */
  function updateIdentity(patch: Partial<typeof identity>) {
    updateProfile({ identity: { ...identity, ...patch } });
  }

  function saveCompany() {
    updateIdentity(company);
    toast('success', settingsCopy.toasts.pfaSaved);
  }

  function savePersonal() {
    const nume = personal.nume.trim();
    if (!nume) {
      toast('error', validation.nameRequired);
      return;
    }
    updateIdentity({ ...personal, nume });
    toast('success', settingsCopy.toasts.personalSaved);
  }

  function saveMentiuni() {
    updateIdentity({ mentiuniFactura: mentiuni.trim() });
    toast('success', settingsCopy.toasts.invoiceNotesSaved);
  }

  function saveEf() {
    updateSettings(s => ({ ...s, eFactura: ef }));
    toast('success', settingsCopy.toasts.eFacturaSaved);
  }

  function saveFiscal() {
    const e: Record<string, string> = {};
    const year = Number(fiscal.pfaStartYear);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      e.pfaStartYear = validation.yearInvalid;
    }
    const fy = Number(fiscal.fiscalYear);
    if (!Number.isInteger(fy) || fy < 2000 || fy > 2100) {
      e.fiscalYear = validation.yearInvalid;
    }
    if (fiscal.pfaStartDate) {
      const problem = isoCalendarDateProblem(fiscal.pfaStartDate);
      if (problem) e.pfaStartDate = isoCalendarDateProblemText(problem);
    }
    // Same rule as the write path: a date the engine cannot order is refused here rather
    // than stored and dropped later. Empty is legal and means "unknown".
    if (fiscal.vatExceedanceDate) {
      const problem = isoCalendarDateProblem(fiscal.vatExceedanceDate);
      if (problem) e.vatExceedanceDate = isoCalendarDateProblemText(problem);
    }
    // art. 174 alin. (7) lit. a) is a numeric condition, so when a salary exists the
    // amount is mandatory — without it the engine cannot decide the 6 SM test and
    // calcCass() must halt instead of guessing.
    // Three states, not two: `undefined` = the field is empty ("not recorded"), `null` = what was typed
    // cannot be stored (not a number, or a fraction of a ban). Collapsing them would turn "unknown" into 0.
    const salary = fiscal.salaryIncomeLei.trim() === '' ? undefined : parseLeiInput(fiscal.salaryIncomeLei);
    if (fiscal.salaryStatus === 'da') {
      if (salary === undefined) {
        e.salaryIncomeLei = validation.salaryAmountNeededForSixSm;
      } else if (salary === null || salary < 0) {
        e.salaryIncomeLei = validation.leiInvalid;
      }
    }
    const cash = parseLeiInput(fiscal.cashFloorLei);
    if (cash === null || cash < 0) e.cashFloorLei = validation.leiInvalid;
    // A suspension is recorded as months, because that is the fact; whether those months change
    // anything under art. 174 alin. (7) is UNVERIFIED and is not decided here.
    const suspensionMonths = parseSuspensionMonths(fiscal.pensionSuspensionMonths);
    if (suspensionMonths === null) {
      e.pensionSuspensionMonths = validation.monthsInvalid;
    }
    if (!isSelectableRegime(fiscal.regime)) {
      e.regime = validation.regimeNotComputable;
    }
    // PG-6h-2 — the room count is a count, not an amount: an integer ≥ 0, or no value at all. A non-number
    // must not fall through as "unanswered", because the difference between 7 and 8 rooms is the
    // difference between two income titles and a silently dropped input would leave the wrong one standing.
    let rooms: number | undefined;
    if (fiscal.accommodationRooms.trim() !== '') {
      const typed = Number(fiscal.accommodationRooms.trim());
      if (!Number.isInteger(typed) || typed < 0) {
        e.accommodationRooms = validation.roomsInvalid;
      } else {
        rooms = typed;
      }
    }
    // PG-6d (D-OTH-1, B-41) — the six amounts, each three-state: an empty box writes absence, a typed `0`
    // writes a declared zero, and anything unparseable is an error rather than a silently dropped input.
    // The form does NOT demand all six: a partial answer set is a state the person may genuinely be in,
    // and it is the engine that refuses to sum it — on the calculation screen, with the missing
    // categories named — not a form that blocks a save.
    const ladderAmounts: Partial<Record<LadderAmountField, Bani>> = {};
    for (const key of LADDER_AMOUNT_FIELDS) {
      const typed = fiscal.ladderAmounts[key].trim();
      if (typed === '') continue;
      const parsed = parseLeiInput(typed);
      if (parsed === null || parsed < 0) e[`ladder.${key}`] = validation.leiInvalid;
      else ladderAmounts[key] = parsed;
    }
    const ladderNeimpozabil =
      fiscal.ladderNeimpozabil.trim() === '' ? undefined : parseLeiInput(fiscal.ladderNeimpozabil);
    if (ladderNeimpozabil === null) e.ladderNeimpozabil = validation.leiInvalid;
    const ladderCassRetinut =
      fiscal.ladderCassRetinut.trim() === '' ? undefined : parseLeiInput(fiscal.ladderCassRetinut);
    if (ladderCassRetinut === null) e.ladderCassRetinut = validation.leiInvalid;
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast('error', validation.checkForm);
      return;
    }
    // Both money fields above already recorded an error when they could not be parsed, so a null
    // cannot reach here. Guarding explicitly instead of casting keeps the narrowing honest: if a
    // future edit adds a path that skips validation, this stops compiling rather than writing
    // `null` into a `Bani` field.
    if (salary === null || cash === null || suspensionMonths === null) return;
    if (ladderNeimpozabil === null || ladderCassRetinut === null) return;
    // PG-6d — the year is replaced, not merged, so clearing every box makes that year unanswered again
    // rather than leaving six zeros standing; other years are untouched, exactly as the room counts above.
    const ladderOthers = (profile.cassLadderYears ?? []).filter((y) => y.fiscalYear !== fy);
    const ladderDeclared =
      Object.keys(ladderAmounts).length > 0 ||
      fiscal.ladderAgricoleBaza !== '' ||
      fiscal.ladderInvestitiiBaza !== '' ||
      fiscal.ladderCedareSursa !== '' ||
      fiscal.ladderAlteSurseArt114 !== '' ||
      ladderNeimpozabil !== undefined ||
      ladderCassRetinut !== undefined;
    const ladderYear: CassLadderYear | undefined = ladderDeclared
      ? {
          fiscalYear: fy,
          ...ladderAmounts,
          ...(fiscal.ladderAgricoleBaza ? { activitatiAgricoleBaza: fiscal.ladderAgricoleBaza } : {}),
          ...(fiscal.ladderInvestitiiBaza ? { investitiiBaza: fiscal.ladderInvestitiiBaza } : {}),
          ...(fiscal.ladderCedareSursa ? { cedareaSursa: fiscal.ladderCedareSursa } : {}),
          ...(fiscal.ladderAlteSurseArt114 ? { alteSurseArt114: fiscal.ladderAlteSurseArt114 } : {}),
          ...(ladderNeimpozabil !== undefined ? { neimpozabil: ladderNeimpozabil } : {}),
          ...(ladderCassRetinut !== undefined ? { cassRetinutLaSursa: ladderCassRetinut } : {}),
        }
      : undefined;
    updateProfile({
      regime: fiscal.regime,
      pfaStartYear: year,
      fiscalYear: fy,
      pfaStartDate: fiscal.pfaStartDate || undefined,
      // PG-6b — `''` writes absence, never `'other'`. A stored empty string would be a third value the
      // type cannot hold, and defaulting it here would mint the fact whose absence the estimate reports.
      activityFamily: fiscal.activityFamily || undefined,
      // PG-6h-2 — each fact writes absence when the field is empty, never a stand-in value. The room count
      // is merged per year rather than replaced wholesale, so editing 2026 does not erase a count the
      // profile already holds for 2027; clearing the field makes that one year unanswered again.
      accommodationRoomCounts: withAccommodationRoomCount(
        profile.accommodationRoomCounts,
        fy,
        rooms,
      ),
      accommodationCommissionReading: fiscal.accommodationCommission || undefined,
      accommodationTourismEligibility:
        fiscal.accommodationEligibility === '' ? undefined : fiscal.accommodationEligibility,
      // PG-6d — written per fiscal year, and only when the person actually declared something. An untouched
      // section writes the year list back unchanged; a cleared one writes absence, never six zeros.
      cassLadderYears: ladderYear
        ? withCassLadderYear(ladderOthers, ladderYear)
        : ladderOthers.length > 0
          ? ladderOthers
          : undefined,
      salaryStatus: fiscal.salaryStatus,
      // No salary ⇒ no art. 174 alin. (7) lit. a) relief, and no stale amount left behind.
      salaryIncomeLei: fiscal.salaryStatus === 'da' ? salary : undefined,
      // TASK 5 — each pension fact is written under the fiscal year the profile will declare, and an
      // empty select writes `undefined` (absent), never `nu`. `pensionerStatus` is the CAS key under CF
      // art. 150 alin. (1); the art. 174 alin. (7) lit. c) relief keys on `pensionReceiptYears`.
      pensionerStatus: recorded(fiscal.pensionerStatus),
      pensionReceiptYears:
        fiscal.pensionReceipt === '' ? undefined : [{ fiscalYear: fy, received: fiscal.pensionReceipt }],
      pensionSuspensionYears:
        suspensionMonths.length === 0
          ? undefined
          : [{ fiscalYear: fy, months: suspensionMonths }],
      cassPreviousYearContext:
        fiscal.previousYearExcepted === '' && fiscal.previousYearOption === ''
          ? undefined
          : {
              previousFiscalYear: fy - 1,
              inExceptedCategory: recorded(fiscal.previousYearExcepted),
              optedUnderArt180Alin1: recorded(fiscal.previousYearOption),
            },
      foreignSicknessInsurance:
        fiscal.foreignInsuranceHeld === '' && fiscal.foreignInsuranceProved === ''
          ? undefined
          : {
              fiscalYear: fy,
              held: recorded(fiscal.foreignInsuranceHeld),
              proved: recorded(fiscal.foreignInsuranceProved),
            },
      socialInsuranceStatus: fiscal.socialInsuranceStatus,
      // PG-6f — an empty select writes nothing at all, so the field stays absent rather than becoming a
      // default. `cashAccounting` is only attached when it was answered; it is a scheme, not a status.
      ...(fiscal.vatRegistration === ''
        ? {}
        : {
            vatRegistration: {
              status: fiscal.vatRegistration,
              ...(recorded(fiscal.vatCashAccounting) === undefined
                ? {}
                : { cashAccounting: recorded(fiscal.vatCashAccounting) }),
            },
          }),
      // '' ⇒ undefined, never '': a stored empty string would be a malformed date.
      vatExceedanceDate: fiscal.vatExceedanceDate || undefined,
      cashFloorLei: cash,
      // CAEN is written into the single CAEN model (D-1), keeping any description
      // the entry already had. The deprecated `profile.caen` string is not written.
      identity: {
        ...identity,
        caen: [
          ...(fiscal.caen.trim()
            ? [{ cod: fiscal.caen.trim(), descriere: identity.caen?.[0]?.descriere ?? '' }]
            : []),
          ...(identity.caen?.slice(1) ?? []),
        ],
      },
    });
    toast('success', settingsCopy.toasts.fiscalProfileSaved);
  }

  /**
   * B-97 — write the two art. 322 alin. (7)-(8) facts for the year this tab declares.
   *
   * Per year, and merged rather than replaced: the record for that year also carries the registration route,
   * the turnover figures and the periodicity answer collected on the Declarații page, and a form that saves
   * one fact must not erase the others.
   *
   * `confirmed` writes the provenance PG-6g established — `confirmedBy: 'user'` is a **literal** in the
   * schema precisely so there is no way to record that the app decided. That confirmation is dropped when
   * the answer it belongs to goes away or the month moves, but only when its branch is `alin7`: a
   * periodicity answer the person gave on the Declarații page is a different answer and stays put.
   */
  function saveAicFacts(answer: '' | 'da' | 'nu', month: number | null, confirmed: boolean): void {
    const years = profile.vatPeriodicityYears ?? [];
    const current = years.find((y) => y.year === aicYear);
    const next: VatPeriodicityFacts = { year: aicYear };
    if (current) {
      const withoutAic: VatPeriodicityFacts = { ...current };
      delete withoutAic.aicGoodsWhileQuarterly;
      delete withoutAic.aicGoodsExigibilityMonth;
      Object.assign(next, withoutAic);
    }
    // An unanswered select writes absence, never `nu`. A checked negative is a fact the person stated; an
    // empty field is the app still not knowing, and the two lead the derivation to different places.
    if (answer !== '') {
      next.aicGoodsWhileQuarterly = answer;
      if (answer === 'da' && month !== null) next.aicGoodsExigibilityMonth = month;
    }
    const confirmationStillFits =
      answer === 'da'
      && month !== null
      && current?.aicGoodsWhileQuarterly === 'da'
      && current?.aicGoodsExigibilityMonth === month;
    if (confirmed) {
      next.userChoice = {
        periodicity: 'month',
        branch: 'alin7',
        confirmedBy: 'user',
        confirmedOn: localDateISO(),
      };
    } else if (!confirmationStillFits && current?.userChoice?.branch === 'alin7') {
      delete next.userChoice;
    }
    updateProfile({
      vatPeriodicityYears: [...years.filter((y) => y.year !== aicYear), next],
    });
  }

  function copyAdresa() {
    navigator.clipboard
      ?.writeText(identity.adresaSocietate)
      .then(() => toast('success', settingsCopy.toasts.addressCopied))
      .catch(() => toast('error', settingsCopy.toasts.addressCopyFailed));
  }

  function openTva() {
    setTvaCode(identity.codTvaIntra ?? '');
    setTvaFound(false);
    setTvaOpen(true);
  }

  function searchTva() {
    // Simulated ANAF lookup: any non-empty code is accepted.
    setTvaFound(tvaCode.trim().length > 0);
  }

  function addTva() {
    updateIdentity({ codTvaIntra: tvaCode.trim() });
    setTvaOpen(false);
    toast('success', settingsCopy.toasts.vatCodeAdded);
  }

  function addBank() {
    if (!newBank.banca.trim()) {
      toast('error', validation.bankNameRequired);
      return;
    }
    updateSettings(s => ({
      ...s,
      bankAccounts: [
        ...s.bankAccounts,
        // PG-4 hygiene: the id comes from the domain's own clock seam, not from a raw `Date.now()`.
        // A wall-clock read in a page is the B-46 class — it is the one date in this file no fixed clock
        // can pin, and `epochMs()` is the seam the standing wall-clock guard recognises.
        { id: `ba-${epochMs().toString(36)}`, banca: newBank.banca.trim(), moneda: newBank.moneda },
      ],
    }));
    setNewBank({ banca: '', moneda: 'RON' });
    setBankOpen(false);
    toast('success', settingsCopy.toasts.bankAdded);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{settingsCopy.title}</h1>
          <p className="sub">{settingsCopy.subtitle}</p>
        </div>
        <div className="actions">
          {tab === 'company' && (
            <button className="btn btn-primary" onClick={saveCompany}>
              {copy.ui.save}
            </button>
          )}
          {tab === 'fiscal' && (
            <button className="btn btn-primary" onClick={saveFiscal}>
              {copy.ui.save}
            </button>
          )}
          {tab === 'einvoice' && (
            <button className="btn btn-primary" onClick={saveEf}>
              {copy.ui.save}
            </button>
          )}
          {tab === 'account' && (
            <button className="btn btn-primary" onClick={savePersonal}>
              {copy.ui.save}
            </button>
          )}
        </div>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => {
              setTab(t.key);
              onTabChange?.(t.key);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'company' && (
        <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
          <Card title={settingsCopy.pfaCard.identity}>
            <div className="form-grid">
              <div className="field">
                <label>{settingsCopy.pfaCard.denumire}</label>
                <input
                  className="input"
                  value={company.denumire}
                  onChange={e => setCompany({ ...company, denumire: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{settingsCopy.pfaCard.cui}</label>
                <input
                  className="input"
                  value={company.cui}
                  onChange={e => setCompany({ ...company, cui: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{settingsCopy.pfaCard.regCom}</label>
                <input
                  className="input"
                  value={company.numarRegComert}
                  onChange={e => setCompany({ ...company, numarRegComert: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{settingsCopy.pfaCard.adresa}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    value={company.adresaSocietate}
                    onChange={e => setCompany({ ...company, adresaSocietate: e.target.value })}
                  />
                  <button className="btn btn-outline" onClick={copyAdresa}>
                    {settingsCopy.pfaCard.copy}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card title={settingsCopy.pfaCard.caen}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}
            >
              <Badge kind="info">{settingsCopy.pfaCard.caenPrincipal}</Badge>
              <span style={{ fontWeight: 600 }}>{identity.caen?.[0]?.cod}</span>
              <span style={{ color: 'var(--text-2)', fontSize: 13 }}>
                {identity.caen?.[0]?.descriere}
              </span>
            </div>
          </Card>

          <Card title={settingsCopy.pfaCard.invoiceNotes}>
            <div className="field">
              <input
                className="input"
                value={mentiuni}
                placeholder={settingsCopy.pfaCard.invoiceNotesPlaceholder}
                onChange={e => setMentiuni(e.target.value)}
              />
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={saveMentiuni}>
                {copy.ui.save}
              </button>
            </div>
          </Card>

          <Card title={settingsCopy.pfaCard.vatCode}>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 12px' }}>
              {settingsCopy.pfaCard.vatCodeIntro}
            </p>
            {identity.codTvaIntra ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}
              >
                <Badge kind="success">{settingsCopy.pfaCard.vatCodeAddedBadge}</Badge>
                <span style={{ fontWeight: 600 }}>{identity.codTvaIntra}</span>
              </div>
            ) : (
              <button className="btn btn-outline" onClick={openTva}>
                {settingsCopy.pfaCard.vatCodeAdd}
              </button>
            )}
          </Card>
        </div>
      )}

      {tab === 'einvoice' && (
        <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
          <Card title={settingsCopy.eFactura.connect}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                {settingsCopy.eFactura.connected}
              </span>
              <Badge kind="warning">{settingsCopy.eFactura.inProgress}</Badge>
            </div>
          </Card>

          <Card title={settingsCopy.eFactura.preferences}>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="field">
                <label>{settingsCopy.eFactura.sending}</label>
                <select
                  className="input"
                  value={ef.trimitere}
                  onChange={e => setEf({ ...ef, trimitere: e.target.value as typeof ef.trimitere })}
                >
                  <option value="2-zile">{settingsCopy.eFactura.sendWithinTwoDays}</option>
                  <option value="imediat">{settingsCopy.eFactura.sendAsap}</option>
                </select>
                <FieldLegal
                  hint={settingsCopy.eFactura.sendingHint}
                  source={copy.sources.eFacturaDeadline}
                />
              </div>
              <div className="field">
                <label>{settingsCopy.eFactura.contactData}</label>
                <select
                  className="input"
                  value={ef.dateContact}
                  onChange={e => setEf({ ...ef, dateContact: e.target.value as typeof ef.dateContact })}
                >
                  <option value="nu">{settingsCopy.eFactura.contactOmitted}</option>
                  <option value="da">{settingsCopy.eFactura.contactIncluded}</option>
                </select>
                <span className="hint">{settingsCopy.eFactura.contactHint}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'bankaccounts' && (
        <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
          <Card title={settingsCopy.security.title}>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
              {settingsCopy.security.bankBody}
            </p>
          </Card>

          <Card
            title={settingsCopy.bank.title}
            action={
              <button className="btn btn-primary btn-sm" onClick={() => setBankOpen(true)}>
                {settingsCopy.bank.add}
              </button>
            }
          >
            <table className="table">
              <thead>
                <tr>
                  <th>{settingsCopy.bank.bank}</th>
                  <th>{settingsCopy.bank.currency}</th>
                </tr>
              </thead>
              <tbody>
                {settings.bankAccounts.map(b => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text)' }}>{b.banca}</td>
                    <td>{b.moneda}</td>
                  </tr>
                ))}
                {settings.bankAccounts.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ color: 'var(--text-3)' }}>
                      {settingsCopy.bank.empty}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div style={{ marginTop: 12 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  toast(
                    'info',
                    settingsCopy.toasts.bankAdvice
                  )
                }
              >
                {settingsCopy.bank.why}
              </button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'account' && (
        <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
          <Card title={settingsCopy.security.title}>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
              {settingsCopy.security.personalBody}
            </p>
          </Card>

          <Card title={settingsCopy.personal.card}>
            <div className="form-grid">
              <div className="field">
                <label>{fields.name}</label>
                <input
                  className="input"
                  value={personal.nume}
                  onChange={e => setPersonal({ ...personal, nume: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{fields.email}</label>
                <input
                  className="input"
                  value={personal.email}
                  onChange={e => setPersonal({ ...personal, email: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{fields.phone}</label>
                <input
                  className="input"
                  value={personal.telefon}
                  onChange={e => setPersonal({ ...personal, telefon: e.target.value })}
                />
              </div>
            </div>
          </Card>

          <Card title={settingsCopy.personal.options}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-outline"
                onClick={() => toast('info', settingsCopy.toasts.passwordSimulated)}
              >
                {settingsCopy.personal.changePassword}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => toast('info', settingsCopy.toasts.cookiesSimulated)}
              >
                {settingsCopy.personal.manageCookies}
              </button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'fiscal' && (
        /*
         * B-91 — every control on this tab carries `<label htmlFor>` plus a matching `id` on the control.
         *
         * This tab is now scanned by the axe gate (`e2e/a11y.spec.ts`). It got into B-91 because most of its
         * fields rendered a bare `<label>` as a *sibling* of a control with no `id`: the text was visible but
         * was never the control's accessible name, and axe reported it as critical `label` / `select-name`.
         * A `placeholder` does not close that gap either — it is not a label, and it disappears the moment
         * the person types. Any control added here inherits the scan, so it must carry the association too.
         */
        <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
          {!isSelectableRegime(fiscal.regime) && (
            <Card title={settingsCopy.fiscal.unsupported}>
              <p style={{ fontSize: 13, color: 'var(--danger)', margin: 0 }}>
                {regimeRefusalReason(fiscal.regime)}
              </p>
            </Card>
          )}

          <Card title={settingsCopy.fiscal.profile}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="set-regime">{settingsCopy.fiscal.regime} <span className="req">*</span></label>
                <select
                  id="set-regime"
                  className="input"
                  value={fiscal.regime}
                  onChange={e => setFiscal({ ...fiscal, regime: e.target.value as PfaRegime })}
                >
                  {!isSelectableRegime(fiscal.regime) && (
                    <option value={fiscal.regime} disabled>
                      {settingsCopy.fiscal.regimeNotComputable(fiscal.regime)}
                    </option>
                  )}
                  {regimeOptions.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <FieldLegal
                  hint={settingsCopy.fiscal.regimeHint}
                  source={copy.sources.regimeOffered}
                />
                {errors.regime && <span className="error">{errors.regime}</span>}
              </div>

              <div className="field">
                <label htmlFor="set-caen">{settingsCopy.fiscal.caen}</label>
                <input
                  id="set-caen"
                  className="input"
                  value={fiscal.caen}
                  onChange={e => setFiscal({ ...fiscal, caen: e.target.value })}
                />
                <FieldLegal
                  hint={settingsCopy.fiscal.caenHint}
                  source={copy.sources.caenDoesNotChangeRegime}
                />
              </div>

              <div className="field">
                <label htmlFor="set-activity-family">{settingsCopy.fiscal.activityFamily}</label>
                <select
                  id="set-activity-family"
                  className="input"
                  data-activity-family
                  value={fiscal.activityFamily}
                  onChange={e => setFiscal({ ...fiscal, activityFamily: e.target.value as ActivityFamily | '' })}
                >
                  <option value="">{copy.ui.answerUnrecorded}</option>
                  <option value="other">{settingsCopy.fiscal.activityFamilyOptions.other}</option>
                  <option value="cazare">{settingsCopy.fiscal.activityFamilyOptions.cazare}</option>
                </select>
                <span className="hint" data-activity-family-hint>
                  {fiscal.activityFamily === ''
                    ? settingsCopy.fiscal.activityFamilyUnanswered
                    : settingsCopy.fiscal.activityFamilyHint}
                </span>
              </div>

              {/*
                PG-6h-2 (B-82, B-83, B-84) — the accommodation facts.

                The block is shown when the declared family is `cazare` **or** the profile carries a CAEN
                class from `TOURISM_CAEN_CLASSES`. The declared family is the primary trigger and the code
                is only ever an additional one (D-COM-2): `research/39` §1 establishes that the likeliest
                affected taxpayer — a natural person letting 1–7 rooms — has no registered business activity
                and therefore no CAEN code at all, so a code-only trigger would never reach them. And a code
                never fills anything in: every control below starts empty, including when the block is open
                because of a code, and the note under the CAEN field says the list is this app's own choice
                under HG 656/1997 art. 4 alin. (1)-(2), not a mapping in law.

                The title line is rendered from `accommodationIncomeTitleForYear` — the same resolver the
                scenario registry reads — so the form and the refusal cannot state different titles for one
                profile. It has a third branch, and that branch is the point: an unrecorded count means the
                app does not know the title, and the screen says so instead of leaving the reader to infer
                one from a number that is not there.
              */}
              {(fiscal.activityFamily === 'cazare' || tourismCaenPresent) && (
                <div className="field" data-accommodation-block>
                  <label htmlFor="set-accommodation-rooms">{settingsCopy.fiscal.accommodationRooms}</label>
                  <input
                    id="set-accommodation-rooms"
                    className="input"
                    type="number"
                    min={0}
                    step={1}
                    data-accommodation-rooms
                    value={fiscal.accommodationRooms}
                    onChange={e => setFiscal({ ...fiscal, accommodationRooms: e.target.value })}
                  />
                  <span className="hint" data-accommodation-rooms-hint>
                    {fiscal.accommodationRooms === ''
                      ? settingsCopy.fiscal.accommodationRoomsUnanswered
                      : settingsCopy.fiscal.accommodationRoomsHint}
                  </span>
                  {errors.accommodationRooms && <span className="error">{errors.accommodationRooms}</span>}

                  <label htmlFor="set-accommodation-eligibility">{settingsCopy.fiscal.accommodationEligibility}</label>
                  <select
                    id="set-accommodation-eligibility"
                    className="input"
                    data-accommodation-eligibility
                    value={fiscal.accommodationEligibility}
                    onChange={e =>
                      setFiscal({ ...fiscal, accommodationEligibility: e.target.value as TriState })
                    }
                  >
                    <option value="">{copy.ui.answerUnrecorded}</option>
                    <option value="da">{settingsCopy.fiscal.accommodationEligibilityOptions.da}</option>
                    <option value="nu">{settingsCopy.fiscal.accommodationEligibilityOptions.nu}</option>
                  </select>
                  <span className="hint">{settingsCopy.fiscal.accommodationEligibilityHint}</span>

                  <label htmlFor="set-accommodation-commission">{settingsCopy.fiscal.accommodationCommission}</label>
                  <select
                    id="set-accommodation-commission"
                    className="input"
                    data-accommodation-commission
                    value={fiscal.accommodationCommission}
                    onChange={e =>
                      setFiscal({
                        ...fiscal,
                        accommodationCommission: e.target.value as AccommodationCommissionReading | '',
                      })
                    }
                  >
                    <option value="">{copy.ui.answerUnrecorded}</option>
                    <option value="reading_a">{settingsCopy.fiscal.accommodationCommissionOptions.reading_a}</option>
                    <option value="reading_b">{settingsCopy.fiscal.accommodationCommissionOptions.reading_b}</option>
                  </select>
                  <span className="hint">{settingsCopy.fiscal.accommodationCommissionHint}</span>
                  {/* Which reading the app applied, with the alternative kept visible beside it (D-COM-1).
                      A choice shown without its alternative reads like a finding. */}
                  <span className="hint" data-accommodation-commission-applied>
                    {fiscal.accommodationCommission === ''
                      ? settingsCopy.fiscal.accommodationCommissionUnanswered
                      : settingsCopy.fiscal.accommodationCommissionApplied[fiscal.accommodationCommission]}
                  </span>

                  <span className="hint" data-accommodation-title>
                    {accommodationTitleText}
                  </span>

                  {tourismCaenPresent && (
                    <span className="hint" data-accommodation-caen-prompt>
                      {settingsCopy.fiscal.accommodationCaenPromptHint}
                    </span>
                  )}
                </div>
              )}

              {/* PG-6h-3 — the entry point to the occupancy sheet.

                  Deliberately **outside** the accommodation block above, and deliberately not conditioned on
                  `activityFamily`, on the room count, or on the resolved fiscal title. OPANAF 381/2026
                  addresses two different beneficiary groups — 1–7 rooms in a personal dwelling, and
                  independent-activity accommodation above 7 — and the app does not know which one a given
                  person is. Gating this link on any of those facts would use a fiscal classification to
                  decide whether a retention duty is reachable, which is the mistake in reverse: the sheet
                  is owed under both titles, and under neither answer to "we could not work out your title".

                  It is a link, not a form: the sheet itself lives on the Documents page, beside the other
                  documents this person keeps. */}
              <div className="field" data-occupancy-entry>
                <label>{occupancyCopy.entry.label}</label>
                <a className="btn btn-ghost" href="/documents#!/occupancy" data-occupancy-entry-link>
                  {occupancyCopy.entry.label}
                </a>
                <span className="hint">{occupancyCopy.entry.hint}</span>
              </div>

              {/* PG-6c (D-VEH-3) — the vehicle facts. Shown unconditionally: whether a person has a car is
                  not something the app may infer from a CAEN code, from an expense category or from a
                  supplier name, and the 50 % default of art. 68 alin. (7) lit. k) applies to a register
                  that declares no car at all. */}
              <VehicleSection />

              {/* PG-6d (D-OTH-1, D-OTH-2, B-41) — the six CF art. 155 alin. (1) lit. c)-h) amounts.

                  Shown unconditionally and never pre-filled. Whether a person has any of these six kinds of
                  income is not something the app may infer from a CAEN code, from the register, or from a
                  default, and the ladder below them is a cliff: the difference between an unanswered
                  category and a declared `0` is the difference between "no base can be computed" and "no
                  CASS is owed". So every box starts empty, an empty box writes absence, and the note counts
                  the six out loud instead of hiding the gap. */}
              <div className="field" data-cass-ladder>
                <label>{settingsCopy.fiscal.ladderSection}</label>
                <span className="hint">{settingsCopy.fiscal.ladderIntro}</span>
                <span className="hint" data-ladder-answered>
                  {ladderAnsweredCount === 0
                    ? settingsCopy.fiscal.ladderUnasked
                    : settingsCopy.fiscal.ladderAnswered(
                        ladderAnsweredCount,
                        ladderMissing.map(k => settingsCopy.fiscal.ladderShortNames[k]).join(', '),
                      )}
                </span>

                {LADDER_AMOUNT_FIELDS.map(key => (
                  <div className="field" key={key} data-ladder-field={key}>
                    <label htmlFor={`set-ladder-${key}`}>{settingsCopy.fiscal.ladderAmounts[key]}</label>
                    <input
                      className="input"
                      id={`set-ladder-${key}`}
                      inputMode="decimal"
                      data-ladder-amount={key}
                      value={fiscal.ladderAmounts[key]}
                      onChange={ev =>
                        setFiscal({
                          ...fiscal,
                          ladderAmounts: { ...fiscal.ladderAmounts, [key]: ev.target.value },
                        })
                      }
                    />
                    <span className="hint">{settingsCopy.fiscal.ladderAmountHints[key]}</span>
                    {errors[`ladder.${key}`] && <span className="error">{errors[`ladder.${key}`]}</span>}
                  </div>
                ))}

                {/* The measurement, per category — because art. 170 alin. (4) does not measure one thing.
                    Net for four of the six, BRUT for „alte surse”, and „venitul net SAU norma de venit” for
                    agriculture, where the normă survives and nowhere else in this basin from 2026. */}
                <label htmlFor="set-ladder-agricole-baza">{settingsCopy.fiscal.ladderAgricoleBaza}</label>
                <select
                  className="input"
                  id="set-ladder-agricole-baza"
                  data-ladder-agricole-baza
                  value={fiscal.ladderAgricoleBaza}
                  onChange={ev =>
                    setFiscal({ ...fiscal, ladderAgricoleBaza: ev.target.value as typeof fiscal.ladderAgricoleBaza })
                  }
                >
                  <option value="">{copy.ui.answerUnrecorded}</option>
                  {CASS_AGRI_BAZA_VALUES.map(v => (
                    <option key={v} value={v}>
                      {settingsCopy.fiscal.ladderAgricoleBazaOptions[v]}
                    </option>
                  ))}
                </select>

                <label htmlFor="set-ladder-investitii-baza">{settingsCopy.fiscal.ladderInvestitiiBaza}</label>
                <select
                  className="input"
                  id="set-ladder-investitii-baza"
                  data-ladder-investitii-baza
                  value={fiscal.ladderInvestitiiBaza}
                  onChange={ev =>
                    setFiscal({
                      ...fiscal,
                      ladderInvestitiiBaza: ev.target.value as typeof fiscal.ladderInvestitiiBaza,
                    })
                  }
                >
                  <option value="">{copy.ui.answerUnrecorded}</option>
                  {CASS_INVEST_BAZA_VALUES.map(v => (
                    <option key={v} value={v}>
                      {settingsCopy.fiscal.ladderInvestitiiBazaOptions[v]}
                    </option>
                  ))}
                </select>

                {/* D-OTH-2 — the question that decides the LETTER. A lease taken out by the PFA as its own
                    activity is art. 67 alin. (1) / art. 155 alin. (1) lit. b) and travels a different
                    contribution path; a good of the personal patrimony is lit. e) and belongs in this sum. */}
                <label htmlFor="set-ladder-cedare-sursa">{settingsCopy.fiscal.ladderCedareSursa}</label>
                <select
                  className="input"
                  id="set-ladder-cedare-sursa"
                  data-ladder-cedare-sursa
                  value={fiscal.ladderCedareSursa}
                  onChange={ev =>
                    setFiscal({ ...fiscal, ladderCedareSursa: ev.target.value as typeof fiscal.ladderCedareSursa })
                  }
                >
                  <option value="">{copy.ui.answerUnrecorded}</option>
                  {CASS_CEDARE_SURSA_VALUES.map(v => (
                    <option key={v} value={v}>
                      {settingsCopy.fiscal.ladderCedareSursaOptions[v]}
                    </option>
                  ))}
                </select>
                <span className="hint">{settingsCopy.fiscal.ladderCedareSursaHint}</span>

                <label htmlFor="set-ladder-alte-surse-art114">{settingsCopy.fiscal.ladderAlteSurseArt114}</label>
                <select
                  className="input"
                  id="set-ladder-alte-surse-art114"
                  data-ladder-alte-surse-art114
                  value={fiscal.ladderAlteSurseArt114}
                  onChange={ev =>
                    setFiscal({ ...fiscal, ladderAlteSurseArt114: ev.target.value as TriState })
                  }
                >
                  <option value="">{copy.ui.answerUnrecorded}</option>
                  <option value="da">{settingsCopy.fiscal.ladderAlteSurseArt114Options.da}</option>
                  <option value="nu">{settingsCopy.fiscal.ladderAlteSurseArt114Options.nu}</option>
                </select>
                <span className="hint">{settingsCopy.fiscal.ladderAlteSurseArt114Hint}</span>

                <div className="field" data-ladder-field="neimpozabil">
                  <label htmlFor="set-ladder-neimpozabil">{settingsCopy.fiscal.ladderNeimpozabil}</label>
                  <input
                    className="input"
                    id="set-ladder-neimpozabil"
                    inputMode="decimal"
                    data-ladder-amount="neimpozabil"
                    value={fiscal.ladderNeimpozabil}
                    onChange={ev => setFiscal({ ...fiscal, ladderNeimpozabil: ev.target.value })}
                  />
                  <span className="hint">{settingsCopy.fiscal.ladderNeimpozabilHint}</span>
                  {errors.ladderNeimpozabil && <span className="error">{errors.ladderNeimpozabil}</span>}
                </div>

                <div className="field" data-ladder-field="cassRetinut">
                  <label htmlFor="set-ladder-cass-retinut">{settingsCopy.fiscal.ladderCassRetinut}</label>
                  <input
                    className="input"
                    id="set-ladder-cass-retinut"
                    inputMode="decimal"
                    data-ladder-amount="cassRetinut"
                    value={fiscal.ladderCassRetinut}
                    onChange={ev => setFiscal({ ...fiscal, ladderCassRetinut: ev.target.value })}
                  />
                  <span className="hint">{settingsCopy.fiscal.ladderCassRetinutHint}</span>
                  {errors.ladderCassRetinut && <span className="error">{errors.ladderCassRetinut}</span>}
                </div>

                <span className="hint">{settingsCopy.fiscal.ladderZeroIsAFact}</span>
              </div>

              <div className="field">
                <label htmlFor="set-start-year">{settingsCopy.fiscal.startYear} <span className="req">*</span></label>
                <input
                  id="set-start-year"
                  className="input"
                  value={fiscal.pfaStartYear}
                  onChange={e => setFiscal({ ...fiscal, pfaStartYear: e.target.value })}
                />
                {errors.pfaStartYear && <span className="error">{errors.pfaStartYear}</span>}
              </div>

              <div className="field">
                <label htmlFor="set-fiscal-year">{settingsCopy.fiscal.fiscalYear} <span className="req">*</span></label>
                <input
                  id="set-fiscal-year"
                  className="input"
                  value={fiscal.fiscalYear}
                  onChange={e => setFiscal({ ...fiscal, fiscalYear: e.target.value })}
                />
                {errors.fiscalYear && <span className="error">{errors.fiscalYear}</span>}
              </div>

              <div className="field">
                <label htmlFor="set-establishment">{settingsCopy.fiscal.establishmentDate}</label>
                <input
                  id="set-establishment"
                  className="input"
                  type="date"
                  value={fiscal.pfaStartDate}
                  onChange={e => setFiscal({ ...fiscal, pfaStartDate: e.target.value })}
                />
                <FieldLegal
                  hint={settingsCopy.fiscal.establishmentDateHint}
                  source={copy.sources.establishmentDate}
                />
                {errors.pfaStartDate && <span className="error">{errors.pfaStartDate}</span>}
              </div>

              <div className="field">
                <label htmlFor="set-salary-status">{settingsCopy.fiscal.salaryStatus}</label>
                <select
                  id="set-salary-status"
                  className="input"
                  value={fiscal.salaryStatus}
                  onChange={e => setFiscal({ ...fiscal, salaryStatus: e.target.value as PfaSalaryStatus })}
                >
                  <option value="">{copy.ui.answerUnrecorded}</option>
                  <option value="nu">{copy.ui.answerNo}</option>
                  <option value="da">{copy.ui.answerYes}</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="set-salary-amount">{settingsCopy.fiscal.salaryAmount}</label>
                <input
                  id="set-salary-amount"
                  className="input"
                  value={fiscal.salaryIncomeLei}
                  disabled={fiscal.salaryStatus !== 'da'}
                  onChange={e => setFiscal({ ...fiscal, salaryIncomeLei: e.target.value })}
                />
                <FieldLegal
                  hint={settingsCopy.fiscal.salaryAmountHint}
                  note={
                    fiscal.salaryStatus === 'da' && fiscal.salaryIncomeLei.trim() === ''
                      ? copy.notes.salaryWithoutAmount
                      : undefined
                  }
                  source={copy.sources.salarySixSm}
                />
                {errors.salaryIncomeLei && <span className="error">{errors.salaryIncomeLei}</span>}
              </div>

              <div className="field">
                <label htmlFor="set-pensioner-status">{settingsCopy.fiscal.pensionerStatus}</label>
                <select
                  id="set-pensioner-status"
                  className="input"
                  value={fiscal.pensionerStatus}
                  onChange={e => setFiscal({ ...fiscal, pensionerStatus: e.target.value as TriState })}
                >
                  <option value="">{copy.ui.answerUnrecorded}</option>
                  <option value="nu">{copy.ui.answerNo}</option>
                  <option value="da">{copy.ui.answerYes}</option>
                </select>
                <FieldLegal
                  hint={settingsCopy.fiscal.pensionerStatusHint}
                  source={copy.sources.pensionerStatus}
                />
              </div>

              <div className="field">
                <label htmlFor="set-pension-receipt">{settingsCopy.fiscal.pensionReceipt}</label>
                <select
                  id="set-pension-receipt"
                  className="input"
                  value={fiscal.pensionReceipt}
                  onChange={e => setFiscal({ ...fiscal, pensionReceipt: e.target.value as TriState })}
                >
                  <option value="">{copy.ui.answerUnrecorded}</option>
                  <option value="nu">{copy.ui.answerNo}</option>
                  <option value="da">{copy.ui.answerYes}</option>
                </select>
                <FieldLegal
                  hint={settingsCopy.fiscal.pensionReceiptHint}
                  note={fiscal.pensionReceipt === '' ? copy.notes.cassPensionReceipt : undefined}
                  source={copy.sources.pensionReceipt}
                />
              </div>

              <div className="field">
                <label htmlFor="set-suspension-months">{settingsCopy.fiscal.suspensionMonths}</label>
                <input
                  id="set-suspension-months"
                  className="input"
                  value={fiscal.pensionSuspensionMonths}
                  placeholder={settingsCopy.fiscal.suspensionPlaceholder}
                  onChange={e => setFiscal({ ...fiscal, pensionSuspensionMonths: e.target.value })}
                />
                <FieldLegal
                  hint={settingsCopy.fiscal.suspensionHint}
                  note={copy.notes.pensionSuspension}
                  source={copy.sources.pensionSuspension}
                />
                {errors.pensionSuspensionMonths && <span className="error">{errors.pensionSuspensionMonths}</span>}
              </div>

              <div className="field">
                <label htmlFor="set-previous-year-exception">{settingsCopy.fiscal.previousYearException}</label>
                <select
                  id="set-previous-year-exception"
                  className="input"
                  value={fiscal.previousYearExcepted}
                  onChange={e => setFiscal({ ...fiscal, previousYearExcepted: e.target.value as TriState })}
                >
                  <option value="">{copy.ui.answerUnrecorded}</option>
                  <option value="nu">{copy.ui.answerNo}</option>
                  <option value="da">{copy.ui.answerYes}</option>
                </select>
                <FieldLegal
                  hint={settingsCopy.fiscal.previousYearExceptionHint}
                  note={fiscal.previousYearExcepted === '' ? copy.notes.previousYearRoute : undefined}
                  source={copy.sources.previousYearException}
                />
              </div>

              <div className="field">
                <label htmlFor="set-previous-year-option">{settingsCopy.fiscal.previousYearOption}</label>
                <select
                  id="set-previous-year-option"
                  className="input"
                  value={fiscal.previousYearOption}
                  onChange={e => setFiscal({ ...fiscal, previousYearOption: e.target.value as TriState })}
                >
                  <option value="">{copy.ui.answerUnrecorded}</option>
                  <option value="nu">{copy.ui.answerNo}</option>
                  <option value="da">{copy.ui.answerYes}</option>
                </select>
                <FieldLegal
                  hint={settingsCopy.fiscal.previousYearOptionHint}
                  note={fiscal.previousYearOption === '' ? copy.notes.previousYearRoute : undefined}
                  source={copy.sources.previousYearOption}
                />
              </div>

              <div className="field">
                <label htmlFor="set-foreign-insurance">{settingsCopy.fiscal.foreignInsurance}</label>
                <select
                  id="set-foreign-insurance"
                  className="input"
                  value={fiscal.foreignInsuranceHeld}
                  onChange={e => setFiscal({ ...fiscal, foreignInsuranceHeld: e.target.value as TriState })}
                >
                  <option value="">{copy.ui.answerUnrecorded}</option>
                  <option value="nu">{copy.ui.answerNo}</option>
                  <option value="da">{copy.ui.answerYes}</option>
                </select>
                <FieldLegal
                  hint={settingsCopy.fiscal.foreignInsuranceHint}
                  source={copy.sources.foreignInsurance}
                />
              </div>

              <div className="field">
                <label htmlFor="set-foreign-insurance-proof">{settingsCopy.fiscal.foreignInsuranceProof}</label>
                <select
                  id="set-foreign-insurance-proof"
                  className="input"
                  value={fiscal.foreignInsuranceProved}
                  onChange={e => setFiscal({ ...fiscal, foreignInsuranceProved: e.target.value as TriState })}
                >
                  <option value="">{copy.ui.answerUnrecorded}</option>
                  <option value="nu">{copy.ui.answerNo}</option>
                  <option value="da">{copy.ui.answerYes}</option>
                </select>
                <FieldLegal
                  hint={settingsCopy.fiscal.foreignInsuranceProofHint}
                  note={fiscal.foreignInsuranceProved !== 'da' ? copy.notes.foreignInsuranceProof : undefined}
                  source={copy.sources.foreignInsuranceProof}
                />
              </div>

              <div className="field">
                <label htmlFor="set-cass-status">{settingsCopy.fiscal.cassStatus}</label>
                <select
                  id="set-cass-status"
                  className="input"
                  value={fiscal.socialInsuranceStatus}
                  onChange={e =>
                    setFiscal({ ...fiscal, socialInsuranceStatus: e.target.value as PfaSocialInsuranceStatus })
                  }
                >
                  <option value="obligatoriu">{settingsCopy.fiscal.cassStatusOptions.obligatoriu}</option>
                  <option value="exempt">{settingsCopy.fiscal.cassStatusOptions.exempt}</option>
                  <option value="neplata">{settingsCopy.fiscal.cassStatusOptions.neplata}</option>
                </select>
                {/* TASK 7, the loudest instance of the defect: this hint used to print the internal token
                    `review_required` to the user, next to a paragraph of the Cod fiscal. The person is now
                    told what is uncertain and what the app does, and the statute text sits behind the
                    sources disclosure with its citation kept. The withheld conclusion itself did not move:
                    the row is still undecided and the computed amount is still 0 lei. */}
                <FieldLegal
                  hint={settingsCopy.fiscal.cassStatusHint}
                  note={copy.notes.cassExemptionUnconfirmed}
                  source={copy.sources.cassStatus}
                />
              </div>

              <div className="field">
                <label htmlFor="set-vat-registration">{settingsCopy.fiscal.vatRegistration}</label>
                <select
                  id="set-vat-registration"
                  className="input"
                  value={fiscal.vatRegistration}
                  onChange={e =>
                    setFiscal({
                      ...fiscal,
                      vatRegistration: e.target.value as VatRegistrationStatus | '',
                    })
                  }
                >
                  <option value="">{settingsCopy.fiscal.vatRegistrationUnanswered}</option>
                  {VAT_REGISTRATION_VALUES.map(status => (
                    <option key={status} value={status}>{settingsCopy.fiscal.vatRegistrationOptions[status]}</option>
                  ))}
                </select>
                <FieldLegal
                  hint={settingsCopy.fiscal.vatRegistrationHint}
                  source={copy.sources.vatRegistration}
                />
              </div>

              <div className="field">
                <label htmlFor="set-vat-cash-accounting">{settingsCopy.fiscal.vatCashAccounting}</label>
                <select
                  id="set-vat-cash-accounting"
                  className="input"
                  value={fiscal.vatCashAccounting}
                  onChange={e => setFiscal({ ...fiscal, vatCashAccounting: e.target.value as TriState })}
                >
                  <option value="">{copy.ui.answerUnrecorded}</option>
                  <option value="nu">{copy.ui.answerNo}</option>
                  <option value="da">{copy.ui.answerYes}</option>
                </select>
                <FieldLegal
                  hint={settingsCopy.fiscal.vatCashAccountingHint}
                  source={copy.sources.vatCashAccounting}
                />
              </div>

              <div className="field">
                <label htmlFor="set-vat-exceedance">{settingsCopy.fiscal.vatExceedanceDate}</label>
                <input
                  id="set-vat-exceedance"
                  className="input"
                  type="date"
                  value={fiscal.vatExceedanceDate}
                  onChange={e => setFiscal({ ...fiscal, vatExceedanceDate: e.target.value })}
                />
                <FieldLegal
                  hint={settingsCopy.fiscal.vatExceedanceDateHint}
                  source={copy.sources.vatExceedanceDate}
                />
                {errors.vatExceedanceDate && <span className="error">{errors.vatExceedanceDate}</span>}
              </div>

              {/*
                B-97 (D-AIC-1, D-AIC-2) — art. 322 alin. (7)-(8), asked in the VAT area because that is
                where the registration state that makes the question possible is already answered.

                The question is asked about goods bought in another EU country, not about an „achiziție
                intracomunitară de bunuri”: the code's term is not vocabulary a PFA owns, and a person who
                cannot parse the question cannot answer it. The term and the citation stay attached beside the
                answer, so the fact remains traceable to the article that asks for it.

                The **month** is collected, never the quarter — the model derives the quarter from the month,
                and a quarter typed by hand can be off by one month in a way no downstream arithmetic notices.

                Answering „da” shows the three consequences and opens a confirmation before anything is
                written (D-AIC-2): a single click must not apply a legal change, and the saved record carries
                `confirmedBy: 'user'` so it can never read as the app's own conclusion.
              */}
              {(aicNotAsked === null || aicRecorded) && (
                <div className="field" data-aic-block>
                  <label htmlFor="set-aic-goods">{settingsCopy.fiscal.aic.title}</label>
                  <span className="hint" data-aic-question>
                    {settingsCopy.fiscal.aic.question(aicYear)}
                  </span>
                  <select
                    id="set-aic-goods"
                    className="input"
                    data-aic-answer
                    value={aic.answer}
                    onChange={ev => {
                      const v = ev.target.value as '' | 'da' | 'nu';
                      setAic({ answer: v, month: v === 'da' ? aic.month : '' });
                      // Only „da” moves a fiscal period, so only „da” waits for a confirmation. „nu” and
                      // clearing the answer change nothing about the calendar and write straight away.
                      if (v !== 'da') saveAicFacts(v, null, false);
                    }}
                  >
                    <option value="">{settingsCopy.fiscal.aic.answerUnanswered}</option>
                    <option value="da">{settingsCopy.fiscal.aic.answerDa}</option>
                    <option value="nu">{settingsCopy.fiscal.aic.answerNu}</option>
                  </select>
                  <span className="hint" data-aic-term>
                    {settingsCopy.fiscal.aic.termNote} {settingsCopy.fiscal.aic.citation}
                  </span>

                  {aic.answer === 'da' && (
                    <>
                      <label htmlFor="set-aic-month">{settingsCopy.fiscal.aic.monthLabel(aicYear)}</label>
                      <select
                        id="set-aic-month"
                        className="input"
                        data-aic-month
                        value={aic.month}
                        onChange={ev => setAic({ ...aic, month: ev.target.value })}
                      >
                        <option value="">{settingsCopy.fiscal.aic.monthPlaceholder}</option>
                        {settingsCopy.fiscal.aic.monthNames.map((name, i) => (
                          <option key={name} value={String(i + 1)}>{name}</option>
                        ))}
                      </select>
                      {aicMonthNumber !== null && (
                        <span className="hint" data-aic-quarter>
                          {settingsCopy.fiscal.aic.quarterDerived(aicQuarterOf(aicMonthNumber))}
                        </span>
                      )}
                    </>
                  )}

                  {aicEffectsPending && (
                    <>
                      <div className="hint" data-aic-effects>
                        <div>{settingsCopy.fiscal.aic.effectsTitle}</div>
                        <ul>
                          {aicEffectLinesForYear.map(line => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="row-actions">
                        <button
                          className="btn btn-sm btn-primary"
                          data-aic-review
                          onClick={() => setAicConfirmOpen(true)}
                        >
                          {settingsCopy.fiscal.aic.review}
                        </button>
                      </div>
                      <span className="hint" data-aic-pending>
                        {settingsCopy.fiscal.aic.pendingNote}
                      </span>
                    </>
                  )}

                  {aicRecorded && (
                    <span className="hint" data-aic-recorded>
                      {settingsCopy.fiscal.aic.recordedForYear(aicYear)}
                    </span>
                  )}
                  {/* The consequence is shown where PG-6g already shows it — the Form 300 panel on
                      Declarații, with the split calendar and the mențiuni row. Linking to that panel is the
                      whole point: a second calendar rendered here would be the B-70 defect class, two
                      producers for one series. */}
                  {aicStored?.aicGoodsWhileQuarterly === 'da' && (
                    <span className="hint" data-aic-saved>
                      {settingsCopy.fiscal.aic.savedNote(aicYear)}{' '}
                      <a href="/declarations" data-aic-calendar-link>
                        {settingsCopy.fiscal.aic.calendarLink}
                      </a>
                    </span>
                  )}
                </div>
              )}

              {/* The question is conditional, and the refusal is spoken. Silence here would hide art. 322
                  alin. (7) from exactly the person who may be in it, so each case says why it is not
                  asking instead of rendering nothing. */}
              {aicNotAsked !== null && !aicRecorded && (
                <div className="field" data-aic-not-asked>
                  <span className="hint">
                    {aicNotAsked === 'registration_unknown'
                      ? settingsCopy.fiscal.aic.notAskedRegistrationUnknown
                      : aicNotAsked === 'not_registered'
                        ? settingsCopy.fiscal.aic.notAskedNotRegistered
                        : aicNotAsked === 'monthly_by_user'
                          ? settingsCopy.fiscal.aic.notAskedMonthlyByUser(aicYear)
                          : settingsCopy.fiscal.aic.notAskedMonthly(aicYear)}
                  </span>
                </div>
              )}

              <div className="field">
                <label htmlFor="set-cash-floor">{settingsCopy.fiscal.cashFloor}</label>
                <input
                  id="set-cash-floor"
                  className="input"
                  value={fiscal.cashFloorLei}
                  onChange={e => setFiscal({ ...fiscal, cashFloorLei: e.target.value })}
                />
                {errors.cashFloorLei && <span className="error">{errors.cashFloorLei}</span>}
              </div>
            </div>
          </Card>

          {/*
            TASK 10a put the recorded rates on this card read-only; Phase 10c (B-36) opens the door they
            come in through. The form calls the store's existing validated upsert (`recordFxRate`, keyed by
            `rateKey`) and surfaces its refusals verbatim — it adds no validation of its own and no network
            path. A user holding a EUR record can now resolve the missing-rate condition here, without a
            developer: the rate is entered, the record reconciles on the next calculation, and the register
            above shows what is stored, with its provisional/final state and its source.
          */}
          <Card title={copy.fx.card}>
            <p className="hint">{copy.fx.explanation}</p>
            <FxRateProvenance records={fxRates ?? []} id="fx-rate-provenance" />
            <FxRateEntryForm id="fx-rate-entry" />
            <p className="hint">{copy.fx.manualEntryHint}</p>
            <InterpretationNote note={copy.notes.fxAnnualNotComputable} />
            <InterpretationNote
              note={copy.notes.fxRoundingAtConversion}
              citation="art. 66 alin. (1) Codul fiscal"
            />
          </Card>
        </div>
      )}

      {/* Phase 11 — the two controls that make demo data optional and stored data reversible.
          Before this phase there was no "start from scratch" path anywhere in the UI: the fixture WAS the
          initial state, and the only way out was to delete each record by hand. The sandbox is in-memory
          (`store.tsx` refuses to write while it is active), so loading it cannot damage real records and
          unloading it restores exactly what was there. */}
      {tab === 'data' && (
        <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
          {/* B-51 — the durable half of the scope statement. Onboarding says it once, before any figure
              exists; this is where it can be found again after the first run, on the tab that already
              answers "where do these numbers come from". Same key, same sentence, no second wording —
              `copy.guard.test.ts` fails a sentence spelled twice, and two near-identical disclaimers drift
              apart exactly like two status vocabularies do. No class on the paragraph: `.muted` and
              `.hint` sit on the low-contrast ladder B-52 is open on. */}
          <Card title={scopeCopy.title}>
            <div className="stack">
              <p data-scope-statement>{scopeCopy.statement}</p>
            </div>
          </Card>

          <Card title={settingsCopy.data.card}>
            <div className="stack">
              <p data-settings-origin>
                {dataOrigin === 'empty' && settingsCopy.data.originEmpty}
                {dataOrigin === 'persisted' && settingsCopy.data.originPersisted}
                {dataOrigin === 'quarantined' && settingsCopy.data.originQuarantined}
                {dataOrigin === 'sandbox' && settingsCopy.data.originSandbox}
              </p>
            </div>
          </Card>

          <Card title={settingsCopy.data.sandboxCard}>
            <div className="stack">
              <p className="hint">{settingsCopy.data.sandboxBody}</p>
              <div className="row">
                {!sandboxActive && (
                  <button className="btn" onClick={() => { loadSandbox(); toast('success', settingsCopy.dataToasts.sandboxLoaded); }}>
                    {settingsCopy.data.sandboxLoad}
                  </button>
                )}
                {sandboxActive && (
                  <button className="btn btn-primary" onClick={() => { unloadSandbox(); toast('success', settingsCopy.dataToasts.sandboxUnloaded); }}>
                    {settingsCopy.data.sandboxUnload}
                  </button>
                )}
              </div>
            </div>
          </Card>

          <Card title={settingsCopy.data.dangerCard}>
            <div className="stack">
              <p className="hint">{settingsCopy.data.dangerBody}</p>
              <div className="row">
                <button className="btn btn-danger" onClick={() => setWipeOpen(true)}>
                  {settingsCopy.data.dangerAction}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* B-97 (D-AIC-2) — the confirmation is a legal consequence, not a „are you sure”. It names the three
          changes the answer produces, in the order the article produces them, and nothing is written until
          the person presses „Confirm și salvez”. */}
      {aicConfirmOpen && aicMonthNumber !== null && (
        <Modal
          title={settingsCopy.fiscal.aic.confirmTitle}
          onClose={() => setAicConfirmOpen(false)}
          footer={
            <>
              <button
                className="btn btn-ghost"
                data-aic-confirm-cancel
                onClick={() => setAicConfirmOpen(false)}
              >
                {settingsCopy.fiscal.aic.confirmCancel}
              </button>
              <button
                className="btn btn-primary"
                data-aic-confirm-go
                onClick={() => {
                  saveAicFacts('da', aicMonthNumber, true);
                  setAicConfirmOpen(false);
                  toast('success', settingsCopy.fiscal.aic.toastSaved);
                }}
              >
                {settingsCopy.fiscal.aic.confirmGo}
              </button>
            </>
          }
        >
          <p>{settingsCopy.fiscal.aic.effectsIntro(aicYear)}</p>
          <ul>
            {aicEffectLines(aicYear, aicMonthNumber).map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="hint">{settingsCopy.fiscal.aic.confirmWarning}</p>
        </Modal>
      )}

      {wipeOpen && (
        <Modal
          title={settingsCopy.data.confirmTitle}
          onClose={() => setWipeOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setWipeOpen(false)}>
                {settingsCopy.data.confirmCancel}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setWipeOpen(false);
                  resetAllData();
                  toast('success', settingsCopy.dataToasts.allCleared);
                }}
              >
                {settingsCopy.data.confirmGo}
              </button>
            </>
          }
        >
          <p>{settingsCopy.data.confirmBody}</p>
        </Modal>
      )}

      {tvaOpen && (
        <Modal
          title={settingsCopy.vatModal.title}
          onClose={() => setTvaOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setTvaOpen(false)}>
                {copy.ui.discard}
              </button>
              <button className="btn btn-primary" onClick={searchTva}>
                {settingsCopy.vatModal.search}
              </button>
              {tvaFound && (
                <button className="btn btn-primary" onClick={addTva}>
                  {settingsCopy.vatModal.add}
                </button>
              )}
            </>
          }
        >
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 12px' }}>
            {settingsCopy.vatModal.intro}
          </p>
          <div className="field">
            <input
              className="input"
              value={tvaCode}
              placeholder={settingsCopy.vatModal.placeholder}
              onChange={e => {
                setTvaCode(e.target.value);
                setTvaFound(false);
              }}
            />
            {tvaFound && (
              <span className="hint">{settingsCopy.vatModal.validated}</span>
            )}
          </div>
        </Modal>
      )}

      {bankOpen && (
        <Modal
          title={settingsCopy.bank.add}
          onClose={() => setBankOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setBankOpen(false)}>
                {copy.ui.discard}
              </button>
              <button className="btn btn-primary" onClick={addBank}>
                {copy.ui.add}
              </button>
            </>
          }
        >
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="field">
              <label>{settingsCopy.bank.bank}</label>
              <input
                className="input"
                value={newBank.banca}
                placeholder={settingsCopy.bank.bankPlaceholder}
                onChange={e => setNewBank({ ...newBank, banca: e.target.value })}
              />
            </div>
            <div className="field">
              <label>{settingsCopy.bank.currency}</label>
              <select
                className="input"
                value={newBank.moneda}
                onChange={e => setNewBank({ ...newBank, moneda: e.target.value })}
              >
                <option value="RON">RON</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
