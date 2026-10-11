/**
 * Phase 11 / PG-3 — the first run.
 *
 * This page exists because empty storage used to mean "hand out the demo fixture". A fresh browser
 * profile opened on four invoices nobody filed and a name nobody typed, and nothing said so: production
 * code only ever branched on `dataOrigin === 'quarantined'`, never on `'seed'`. So the fix is not a
 * banner on the demo — it is a screen that asks for the facts before the app has any.
 *
 * What it collects is the set the engine actually reads (the fan-out is `domain/derived.ts:181-200`, and
 * the pension/CASS facts go through `domain/pensionFacts.ts`):
 *   name and CUI as applicable · regime · **PFA start date (required)** · VAT status and, when it applies,
 *   the exceedance date · salary status and amount · pension status and receipt fact · other-income flags.
 *
 * What it deliberately does NOT collect, and says so on screen:
 *   the activity FAMILY is collected here (PG-6b), as a declared fact — what is NOT collected is any
 *   attempt to derive it: no CAEN code is read as an answer, because OMFP 925/2017 art. 2 alin. (4) keys
 *   the determination method to the activity description „independent de codurile CAEN menționate cu titlu
 *   exemplificativ” (research 30 §3); the CAEN list itself stays an identity field, not a fiscal input;
 *   other-income AMOUNTS — 12F owns them, and `otherIncome: PfaOtherIncomeFlag[]` models the flag only.
 *
 * And what it refuses: `norma_venit`. D-NORMA-2 gates the regime, not the research, and the requirement is
 * an explicit "nu este suportat" screen with **no estimate** — which is what `refusal` below renders.
 *
 * A future start date is accepted rather than rejected. Phase 12 owns the active-period arithmetic and
 * lists "future start date" as one of its cases; refusing the date here would decide that phase's question
 * from the wrong end.
 */
import { useState } from 'react';
import { useStore } from '../data/store';
import { onboarding as copy_, settings as settingsCopy, validation } from '../ui/copy';
import { Card } from '../components/ui';
import { isoCalendarDateProblem, isoCalendarDateProblemText, localYear } from '../domain/date';
import { parseLeiInput } from '../domain/money';
import { PFA_REGIME_DESCRIPTORS, PFA_REGIME_VALUES, isComputableRegime } from '../domain/regimes';
// PG-6b (B-29) — the declared activity family, typed from the classifier that reads it.
import type { ActivityFamily } from '../domain/fiscal/deductibility';
import type {
  PfaOtherIncomeFlag,
  PfaPensionStatus,
  PfaRegime,
  PfaSalaryStatus,
} from '../domain/models';

/**
 * The three answers a yes/no fact can hold. `''` is "not recorded" and is NOT the same answer as `nu`:
 * `nu` asserts that the fact was checked and found not to hold. Same shape `Settings.tsx` uses.
 */
type TriState = 'da' | 'nu' | '';

/** Narrow a `TriState` to a recorded answer, or `undefined` for "leave the fact unrecorded". */
function recorded<T extends string>(value: TriState): T | undefined {
  return value === '' ? undefined : (value as T);
}

const OTHER_INCOME_KEYS: PfaOtherIncomeFlag[] = ['imobiliare', 'autovehicule', 'dividende', 'concesiune', 'alte'];

/**
 * The regime a first run starts on, derived rather than spelled out: the one regime in the package that
 * the engine can compute. Writing the literal here would put an internal token in a page — the language
 * layer guard fails on it, and correctly so.
 */
const DEFAULT_REGIME: PfaRegime = PFA_REGIME_VALUES.find(isComputableRegime) ?? PFA_REGIME_VALUES[0];

interface FormErrors {
  nume?: string;
  startDate?: string;
  salaryAmount?: string;
}

export default function OnboardingPage() {
  const { profile, updateProfile, loadSandbox, sandboxActive, toast } = useStore();

  const [nume, setNume] = useState('');
  const [cui, setCui] = useState('');
  const [cnp, setCnp] = useState('');
  const [regCom, setRegCom] = useState('');
  const [regime, setRegime] = useState<PfaRegime>(DEFAULT_REGIME);
  // PG-6b — `''` is "not recorded", the same third state the VAT, salary and pension questions use.
  // It is NOT collapsed into `'other'`: answering nothing leaves the estimate `incomplete` and reported,
  // while answering `other` is a claim the person made.
  const [activityFamily, setActivityFamily] = useState<ActivityFamily | ''>('');
  const [startDate, setStartDate] = useState('');
  const [vatRegistered, setVatRegistered] = useState<TriState>('');
  const [vatDate, setVatDate] = useState('');
  const [salaryStatus, setSalaryStatus] = useState<TriState>('');
  const [salaryAmount, setSalaryAmount] = useState('');
  const [pensionerStatus, setPensionerStatus] = useState<TriState>('');
  const [pensionReceipt, setPensionReceipt] = useState<TriState>('');
  const [otherIncome, setOtherIncome] = useState<PfaOtherIncomeFlag[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  // The refusal is a screen, not a validation message: choosing the regime routes to it immediately, so a
  // person never has to fill the rest of the form to discover the app cannot compute their case.
  const refused = isComputableRegime(regime) ? null : PFA_REGIME_DESCRIPTORS[regime];

  function toggleOther(flag: PfaOtherIncomeFlag) {
    setOtherIncome(current =>
      current.includes(flag) ? current.filter(x => x !== flag) : [...current, flag],
    );
  }

  function finish() {
    const next: FormErrors = {};
    if (nume.trim() === '') next.nume = copy_.errors.nameRequired;

    if (startDate.trim() === '') {
      next.startDate = copy_.errors.startDateRequired;
    } else {
      const problem = isoCalendarDateProblem(startDate.trim());
      if (problem) next.startDate = isoCalendarDateProblemText(problem);
    }

    let salaryBani: ReturnType<typeof parseLeiInput> = null;
    if (salaryStatus === 'da') {
      salaryBani = parseLeiInput(salaryAmount);
      if (salaryAmount.trim() === '') next.salaryAmount = copy_.errors.salaryAmountRequired;
      else if (salaryBani === null) next.salaryAmount = copy_.errors.salaryAmountInvalid;
    }

    if (Object.keys(next).length > 0) {
      setErrors(next);
      toast('error', copy_.errors.finish);
      return;
    }

    const startYear = Number(startDate.trim().slice(0, 4));
    const fiscalYear = localYear();

    updateProfile({
      pfaStartYear: startYear,
      pfaStartDate: startDate.trim(),
      regime,
      // The trading name of a PFA is the person's own name — a PFA has no legal personality separate from
      // the person — so `denumire` mirrors `nume` rather than inventing a brand. The rest of the identity
      // block is carried through untouched: `identity` is one object on the profile, and a partial patch
      // would erase the address, bank details and CAEN list the user may already have.
      identity: {
        ...profile.identity,
        nume: nume.trim(),
        cui: cui.trim(),
        cnp: cnp.trim(),
        numarRegComert: regCom.trim(),
        denumire: nume.trim(),
      },
      // `vatExempt` is a required boolean in the model, so an unanswered question keeps the value the
      // default profile already carries rather than asserting a third state the type cannot hold.
      ...(vatRegistered === '' ? {} : { vatExempt: vatRegistered === 'nu' }),
      ...(vatDate.trim() === '' ? {} : { vatExceedanceDate: vatDate.trim() }),
      ...(recorded<PfaSalaryStatus>(salaryStatus) === undefined
        ? {}
        : { salaryStatus: recorded<PfaSalaryStatus>(salaryStatus) }),
      ...(salaryBani === null || salaryStatus !== 'da' ? {} : { salaryIncomeLei: salaryBani }),
      ...(recorded<PfaPensionStatus>(pensionerStatus) === undefined
        ? {}
        : { pensionerStatus: recorded<PfaPensionStatus>(pensionerStatus) }),
      ...(pensionReceipt === ''
        ? {}
        : { pensionReceiptYears: [{ fiscalYear, received: pensionReceipt }] }),
      // PG-6b (B-29) — an unanswered question writes nothing at all, so the profile keeps the third state
      // and `scenarios.ts activity-family-undeclared` reports it. There is no `?? 'other'` here: that one
      // token would turn "nobody asked" into "the ordinary rules apply", which is the defect this field
      // exists to remove.
      ...(activityFamily === '' ? {} : { activityFamily }),
      otherIncome,
    });

    toast('success', copy_.toasts.profileSaved);
  }

  if (refused) {
    return (
      <div className="onboarding" data-onboarding="refusal">
        <div className="row between">
          <h1>{copy_.title}</h1>
        </div>
        <Card title={copy_.refusal.title}>
          <div className="stack">
            <p>{copy_.refusal.body(refused.label)}</p>
            {/* The reason comes from the regime descriptor — the same source the engine's own refusal
                uses — so the screen cannot state something the engine does not already hold. */}
            <p className="hint">{refused.note}</p>
            <p className="hint estimate-state-note" data-onboarding="no-estimate">
              {copy_.refusal.noEstimate}
            </p>
            <div className="row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setRegime(DEFAULT_REGIME)}
              >
                {copy_.refusal.back}
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="onboarding" data-onboarding="form">
      <div className="row between">
        <h1>{copy_.title}</h1>
      </div>
      <p className="sub">{copy_.subtitle}</p>
      <p>{copy_.intro}</p>

      <Card title={settingsCopy.data.sandboxCard}>
        <div className="stack">
          <p className="hint">{copy_.demo.body}</p>
          <div className="row">
            <button type="button" className="btn" onClick={loadSandbox} disabled={sandboxActive}>
              {copy_.demo.action}
            </button>
          </div>
        </div>
      </Card>

      <Card title={copy_.sections.identity}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="ob-nume">{copy_.fields.nume}</label>
            <input
              id="ob-nume"
              className="input"
              value={nume}
              onChange={e => setNume(e.target.value)}
            />
            <span className="hint">{copy_.fields.numeHint}</span>
            {errors.nume && <span className="error">{errors.nume}</span>}
          </div>
          <div className="field">
            <label htmlFor="ob-cui">{copy_.fields.cui}</label>
            <input id="ob-cui" className="input" value={cui} onChange={e => setCui(e.target.value)} />
            <span className="hint">{copy_.fields.cuiHint}</span>
          </div>
          <div className="field">
            <label htmlFor="ob-cnp">{copy_.fields.cnp}</label>
            <input id="ob-cnp" className="input" value={cnp} onChange={e => setCnp(e.target.value)} />
            <span className="hint">{copy_.fields.cnpHint}</span>
          </div>
          <div className="field">
            <label htmlFor="ob-regcom">{copy_.fields.regCom}</label>
            <input
              id="ob-regcom"
              className="input"
              value={regCom}
              onChange={e => setRegCom(e.target.value)}
            />
            <span className="hint">{copy_.fields.regComHint}</span>
          </div>
        </div>
      </Card>

      <Card title={copy_.sections.regime}>
        <div className="stack">
          <span className="hint">{copy_.fields.regimeHint}</span>
          {PFA_REGIME_VALUES.map(value => {
            const descriptor = PFA_REGIME_DESCRIPTORS[value];
            return (
              <label key={value} className="row" data-regime={value}>
                <input
                  type="radio"
                  name="regime"
                  value={value}
                  checked={regime === value}
                  onChange={() => setRegime(value)}
                />
                {descriptor.label}
              </label>
            );
          })}
        </div>
      </Card>

      <Card title={copy_.sections.activityFamily}>
        <div className="stack">
          <span className="hint">{copy_.fields.activityFamilyHint}</span>
          <label className="row" data-activity-family="">
            <input
              type="radio"
              name="activity-family"
              value=""
              checked={activityFamily === ''}
              onChange={() => setActivityFamily('')}
            />
            {copy_.notRecorded}
          </label>
          {(['other', 'cazare'] as ActivityFamily[]).map(value => (
            <label key={value} className="row" data-activity-family={value}>
              <input
                type="radio"
                name="activity-family"
                value={value}
                checked={activityFamily === value}
                onChange={() => setActivityFamily(value)}
              />
              {copy_.fields.activityFamilyOptions[value]}
            </label>
          ))}
        </div>
      </Card>

      <Card title={copy_.sections.start}>
        <div className="field">
          <label htmlFor="ob-start">{copy_.fields.startDate}</label>
          <input
            id="ob-start"
            className="input"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
          <span className="hint">{copy_.fields.startDateHint}</span>
          {errors.startDate && <span className="error">{errors.startDate}</span>}
        </div>
      </Card>

      <Card title={copy_.sections.vat}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="ob-vat">{copy_.fields.vatRegistered}</label>
            <select
              id="ob-vat"
              className="input"
              value={vatRegistered}
              onChange={e => setVatRegistered(e.target.value as TriState)}
            >
              <option value="">{copy_.notRecorded}</option>
              <option value="da">{copy_.yes}</option>
              <option value="nu">{copy_.no}</option>
            </select>
            <span className="hint">{copy_.fields.vatRegisteredHint}</span>
          </div>
          <div className="field">
            <label htmlFor="ob-vat-exceedance">{copy_.fields.vatExceedanceDate}</label>
            <input
              id="ob-vat-exceedance"
              className="input"
              type="date"
              value={vatDate}
              onChange={e => setVatDate(e.target.value)}
            />
            <span className="hint">{copy_.fields.vatExceedanceDateHint}</span>
          </div>
        </div>
      </Card>

      <Card title={copy_.sections.salary}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="ob-salary">{copy_.fields.salaryStatus}</label>
            <select
              id="ob-salary"
              className="input"
              value={salaryStatus}
              onChange={e => setSalaryStatus(e.target.value as TriState)}
            >
              <option value="">{copy_.notRecorded}</option>
              <option value="da">{copy_.yes}</option>
              <option value="nu">{copy_.no}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="ob-salary-amount">{copy_.fields.salaryAmount}</label>
            <input
              id="ob-salary-amount"
              className="input"
              value={salaryAmount}
              onChange={e => setSalaryAmount(e.target.value)}
            />
            <span className="hint">{copy_.fields.salaryAmountHint}</span>
            {errors.salaryAmount && <span className="error">{errors.salaryAmount}</span>}
          </div>
        </div>
      </Card>

      <Card title={copy_.sections.pension}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="ob-pensioner">{copy_.fields.pensionerStatus}</label>
            <select
              id="ob-pensioner"
              className="input"
              value={pensionerStatus}
              onChange={e => setPensionerStatus(e.target.value as TriState)}
            >
              <option value="">{copy_.notRecorded}</option>
              <option value="da">{copy_.yes}</option>
              <option value="nu">{copy_.no}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="ob-pension-receipt">{copy_.fields.pensionReceipt}</label>
            <select
              id="ob-pension-receipt"
              className="input"
              value={pensionReceipt}
              onChange={e => setPensionReceipt(e.target.value as TriState)}
            >
              <option value="">{copy_.notRecorded}</option>
              <option value="da">{copy_.yes}</option>
              <option value="nu">{copy_.no}</option>
            </select>
            <span className="hint">{copy_.fields.pensionReceiptHint}</span>
          </div>
        </div>
      </Card>

      <Card title={copy_.sections.other}>
        <div className="stack">
          <span className="hint">{copy_.fields.otherIncomeHint}</span>
          {OTHER_INCOME_KEYS.map(flag => (
            <label key={flag} className="row" data-other-income={flag}>
              <input
                type="checkbox"
                checked={otherIncome.includes(flag)}
                onChange={() => toggleOther(flag)}
              />
              {copy_.fields.otherIncomeOptions[flag]}
            </label>
          ))}
        </div>
      </Card>

      <Card title={copy_.sections.deferred}>
        <div className="stack">
          <p>{copy_.deferred.intro}</p>
          <p className="hint">{copy_.deferred.otherAmounts}</p>
        </div>
      </Card>

      <div className="row">
        <button type="button" className="btn btn-primary" onClick={finish} data-onboarding-finish>
          {copy_.actions.finish}
        </button>
        {Object.keys(errors).length > 0 && <span className="error">{validation.checkForm}</span>}
      </div>
    </div>
  );
}
