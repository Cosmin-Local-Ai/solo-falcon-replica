import { useEffect, useState } from 'react';
import { leiInputValue, parseLeiInput } from '../domain/money';
import { useStore } from '../data/store';
import { Card, Badge, Modal } from '../components/ui';
import { Disclosure } from '../components/ui/Disclosure';
import { InterpretationNote } from '../components/ui/InterpretationNote';
import { FxRateProvenance } from '../components/ui/FxRateProvenance';
import { FxRateEntryForm } from '../components/ui/FxRateEntryForm';
import { copy, fields, settings as settingsCopy, validation } from '../ui/copy';
import {
  isSelectableRegime,
  regimeRefusalReason,
  selectableRegimes,
} from '../domain/regimes';
import { epochMs, isoCalendarDateProblem, isoCalendarDateProblemText } from '../domain/date';
// PG-6b (B-29) — the declared activity family. The type comes from the classifier that reads the fact, so
// the option list on this form and the rule condition cannot drift into two vocabularies.
import type { ActivityFamily } from '../domain/fiscal/deductibility';
import type {
  PfaRegime,
  PfaSalaryStatus,
  PfaSocialInsuranceStatus,
} from '../domain/models';

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
  const { settings, updateSettings, profile, updateProfile, toast, fxRates, dataOrigin, sandboxActive, loadSandbox, unloadSandbox, resetAllData } = useStore();
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
    vatExempt: profile.vatExempt ? 'da' : 'nu',
    // Optional: an empty field means "the app does not know the date", which is not
    // the same as "there is no VAT deadline" — see VAT_REGISTRATION_DEADLINE_2026.
    vatExceedanceDate: profile.vatExceedanceDate ?? '',
    cashFloorLei: leiInputValue(profile.cashFloorLei),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const regimeOptions = selectableRegimes();

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
    updateProfile({
      regime: fiscal.regime,
      pfaStartYear: year,
      fiscalYear: fy,
      pfaStartDate: fiscal.pfaStartDate || undefined,
      // PG-6b — `''` writes absence, never `'other'`. A stored empty string would be a third value the
      // type cannot hold, and defaulting it here would mint the fact whose absence the estimate reports.
      activityFamily: fiscal.activityFamily || undefined,
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
      vatExempt: fiscal.vatExempt === 'da',
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
                <label>{settingsCopy.fiscal.regime} <span className="req">*</span></label>
                <select
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
                <label>{settingsCopy.fiscal.caen}</label>
                <input
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

              <div className="field">
                <label>{settingsCopy.fiscal.startYear} <span className="req">*</span></label>
                <input
                  className="input"
                  value={fiscal.pfaStartYear}
                  onChange={e => setFiscal({ ...fiscal, pfaStartYear: e.target.value })}
                />
                {errors.pfaStartYear && <span className="error">{errors.pfaStartYear}</span>}
              </div>

              <div className="field">
                <label>{settingsCopy.fiscal.fiscalYear} <span className="req">*</span></label>
                <input
                  className="input"
                  value={fiscal.fiscalYear}
                  onChange={e => setFiscal({ ...fiscal, fiscalYear: e.target.value })}
                />
                {errors.fiscalYear && <span className="error">{errors.fiscalYear}</span>}
              </div>

              <div className="field">
                <label>{settingsCopy.fiscal.establishmentDate}</label>
                <input
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
                <label>{settingsCopy.fiscal.salaryStatus}</label>
                <select
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
                <label>{settingsCopy.fiscal.salaryAmount}</label>
                <input
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
                <label>{settingsCopy.fiscal.pensionerStatus}</label>
                <select
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
                <label>{settingsCopy.fiscal.pensionReceipt}</label>
                <select
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
                <label>{settingsCopy.fiscal.suspensionMonths}</label>
                <input
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
                <label>{settingsCopy.fiscal.previousYearException}</label>
                <select
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
                <label>{settingsCopy.fiscal.previousYearOption}</label>
                <select
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
                <label>{settingsCopy.fiscal.foreignInsurance}</label>
                <select
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
                <label>{settingsCopy.fiscal.foreignInsuranceProof}</label>
                <select
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
                <label>{settingsCopy.fiscal.cassStatus}</label>
                <select
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
                <label>{settingsCopy.fiscal.vatExempt}</label>
                <select
                  className="input"
                  value={fiscal.vatExempt}
                  onChange={e => setFiscal({ ...fiscal, vatExempt: e.target.value })}
                >
                  <option value="nu">{copy.ui.answerNo}</option>
                  <option value="da">{copy.ui.answerYes}</option>
                </select>
              </div>

              <div className="field">
                <label>{settingsCopy.fiscal.vatExceedanceDate}</label>
                <input
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

              <div className="field">
                <label>{settingsCopy.fiscal.cashFloor}</label>
                <input
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
