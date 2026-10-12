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
 *   the other-income AMOUNTS for the six CF art. 155 alin. (1) lit. c)-h) categories are collected per
 *   fiscal year in Settings (PG-6d); onboarding asks nothing about them, because a category with no answer
 *   makes the art. 170 alin. (4) cumulation unknown and the ladder refuses — an empty onboarding answer set
 *   is therefore left as „not asked”, never written as six zeros.
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
import { onboarding as copy_, scope as scopeCopy, settings as settingsCopy, validation } from '../ui/copy';
import { Card } from '../components/ui';
import { isoCalendarDateProblem, isoCalendarDateProblemText, localYear } from '../domain/date';
import { parseLeiInput } from '../domain/money';
import { PFA_REGIME_DESCRIPTORS, PFA_REGIME_VALUES, isComputableRegime } from '../domain/regimes';
// PG-6b (B-29) — the declared activity family, typed from the classifier that reads it.
import type { ActivityFamily } from '../domain/fiscal/deductibility';
// PG-6f (B-30) — the onboarding question asks the question the law asks. The retired yes/no could only
// ever answer „not exempt”, which is not the same claim as „registered under art. 316”, and the
// difference decides both the money measure and whether any input VAT can be claimed at all.
import { VAT_REGISTRATION_VALUES, type VatRegistrationStatus } from '../domain/fiscal/vat';
import type {
  AccommodationCommissionReading,
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

/**
 * PG-6d (D-OTH-2, D-LEG-1, B-41): the other-income flag list is GONE from this screen.
 *
 * It used to offer five checkboxes — `imobiliare`, `autovehicule`, `dividende`, `concesiune`, `alte`. None
 * of them is a category of CF art. 155 alin. (1): three of the six ladder categories were missing
 * altogether, `concesiune` has no referent in the Cod fiscal, and `alte` is wider than art. 114. A checkbox
 * also cannot answer the question the law asks, which is *how much*, and `calcCass` said so: art. 174 alin.
 * (7) lit. b) „nu a putut fi evaluat — nu a fost nici predat”. What replaces it is a per-year amount per
 * category, collected in Settings; onboarding asks nothing, and absence stays absence.
 */

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
  // PG-6h-2 — the room count is optional, but an answer that is not a whole number ≥ 0 is an error, not a
  // silent absence: 7 and 8 rooms are two different income titles.
  accommodationRooms?: string;
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
  // PG-6h-2 (B-82, B-84) — the three accommodation facts, each with the same third state as the question
  // above it. All start empty and stay empty unless the person answers: a pre-filled room count would
  // assert an income title (art. 83 alin. (2) / art. 85 versus art. 83 alin. (4) / art. 68^3), and a
  // pre-selected commission reading would settle B-80 on somebody's behalf.
  const [accommodationRooms, setAccommodationRooms] = useState('');
  const [accommodationEligibility, setAccommodationEligibility] = useState<TriState>('');
  const [accommodationCommission, setAccommodationCommission] = useState<AccommodationCommissionReading | ''>('');
  const [startDate, setStartDate] = useState('');
  const [vatRegistration, setVatRegistration] = useState<VatRegistrationStatus | ''>('');
  const [vatDate, setVatDate] = useState('');
  const [salaryStatus, setSalaryStatus] = useState<TriState>('');
  const [salaryAmount, setSalaryAmount] = useState('');
  const [pensionerStatus, setPensionerStatus] = useState<TriState>('');
  const [pensionReceipt, setPensionReceipt] = useState<TriState>('');
  const [errors, setErrors] = useState<FormErrors>({});

  // The refusal is a screen, not a validation message: choosing the regime routes to it immediately, so a
  // person never has to fill the rest of the form to discover the app cannot compute their case.
  const refused = isComputableRegime(regime) ? null : PFA_REGIME_DESCRIPTORS[regime];

  function finish() {
    const next: FormErrors = {};
    if (nume.trim() === '') next.nume = copy_.errors.nameRequired;

    if (startDate.trim() === '') {
      next.startDate = copy_.errors.startDateRequired;
    } else {
      const problem = isoCalendarDateProblem(startDate.trim());
      if (problem) next.startDate = isoCalendarDateProblemText(problem);
    }
    // PG-6h-2 — the room count is a count, not an amount, and the difference between 7 and 8 is the
    // difference between two income titles. A value that is not a whole number ≥ 0 is an error on screen,
    // never a silently dropped answer that would leave the profile looking unanswered.
    if (accommodationRooms.trim() !== '') {
      const typed = Number(accommodationRooms.trim());
      if (!Number.isInteger(typed) || typed < 0) next.accommodationRooms = validation.roomsInvalid;
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
      // PG-6f — an unanswered question writes nothing at all, so the profile keeps the third state and
      // the estimate says it does not know the money measure. There is no default here: the retired
      // boolean used to answer this by existing.
      ...(vatRegistration === '' ? {} : { vatRegistration: { status: vatRegistration } }),
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
      // PG-6h-2 — same rule as the family above: an unanswered question writes nothing at all, so the
      // profile keeps the third state and the scenario registry reports the gap instead of asserting a
      // title. The count is stored under the fiscal year this form is being filled for, which is the year
      // art. 83 alin. (4) speaks about. And the whole group is written only under a declared `cazare`:
      // accommodation facts on a profile that says its activity is something else would be a fact about an
      // activity this person has just said they do not have.
      ...(activityFamily !== 'cazare' || accommodationRooms.trim() === ''
        ? {}
        : { accommodationRoomCounts: [{ fiscalYear, rooms: Number(accommodationRooms.trim()) }] }),
      ...(activityFamily !== 'cazare' || accommodationEligibility === ''
        ? {}
        : { accommodationTourismEligibility: accommodationEligibility }),
      ...(activityFamily !== 'cazare' || accommodationCommission === ''
        ? {}
        : { accommodationCommissionReading: accommodationCommission }),
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

      {/* B-51 — the scope statement, on the one screen where it costs nothing to say it: the person has
          not yet trusted a figure, and the sentence is read before any figure exists on screen. It is a
          card of its own rather than a line under the hero or beside an amount, because a hedge parked next
          to a single number reads as a caveat about *that* number — and that number may be exactly right.
          The wording is one shared key (`ui/copy/common.ts` → `scope`), reused verbatim in Settings → Date;
          the paragraph carries no class, so it inherits the body colour rather than the low-contrast
          `.hint`/`.muted` ladder that B-52 is open on. */}
      <Card title={scopeCopy.title}>
        <div className="stack">
          <p data-scope-statement>{scopeCopy.statement}</p>
        </div>
      </Card>

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

      {activityFamily === 'cazare' && (
      <Card title={copy_.sections.accommodation}>
        <div className="stack">
          {/*
            PG-6h-2 (B-82, B-83, B-84). Shown when the family question above is answered `cazare` — the
            declared fact is the trigger, never a CAEN code, because at onboarding the profile has no CAEN
            list at all and `research/39` §1 shows the likeliest accommodation taxpayer never gets one.
            Every control starts empty and writes nothing when left empty: a pre-filled count would assert
            an income title, and a pre-selected reading would settle B-80 for the person.
          */}
          <div className="field">
            <label htmlFor="ob-accommodation-rooms">{copy_.fields.accommodationRooms}</label>
            <input
              id="ob-accommodation-rooms"
              className="input"
              type="number"
              min={0}
              step={1}
              data-accommodation-rooms
              value={accommodationRooms}
              onChange={e => setAccommodationRooms(e.target.value)}
            />
            <span className="hint">{copy_.fields.accommodationRoomsHint}</span>
            {errors.accommodationRooms && <span className="error">{errors.accommodationRooms}</span>}
          </div>

          <span className="hint">{copy_.fields.accommodationEligibility}</span>
          <label className="row" data-accommodation-eligibility="">
            <input
              type="radio"
              name="accommodation-eligibility"
              value=""
              checked={accommodationEligibility === ''}
              onChange={() => setAccommodationEligibility('')}
            />
            {copy_.notRecorded}
          </label>
          {(['da', 'nu'] as const).map(value => (
            <label key={value} className="row" data-accommodation-eligibility={value}>
              <input
                type="radio"
                name="accommodation-eligibility"
                value={value}
                checked={accommodationEligibility === value}
                onChange={() => setAccommodationEligibility(value)}
              />
              {copy_.fields.accommodationEligibilityOptions[value]}
            </label>
          ))}
          <span className="hint">{copy_.fields.accommodationEligibilityHint}</span>

          <span className="hint">{copy_.fields.accommodationCommission}</span>
          <label className="row" data-accommodation-commission="">
            <input
              type="radio"
              name="accommodation-commission"
              value=""
              checked={accommodationCommission === ''}
              onChange={() => setAccommodationCommission('')}
            />
            {copy_.notRecorded}
          </label>
          {(['reading_a', 'reading_b'] as const).map(value => (
            <label key={value} className="row" data-accommodation-commission={value}>
              <input
                type="radio"
                name="accommodation-commission"
                value={value}
                checked={accommodationCommission === value}
                onChange={() => setAccommodationCommission(value)}
              />
              {copy_.fields.accommodationCommissionOptions[value]}
            </label>
          ))}
          <span className="hint">{copy_.fields.accommodationCommissionHint}</span>
        </div>
      </Card>
      )}

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
            {/* PG-6f — the six states come from `VAT_REGISTRATION_VALUES`, and the labels come from the
                same copy map the Settings screen reads, so the two forms cannot offer different answers
                to one question. */}
            <label htmlFor="ob-vat">{copy_.fields.vatRegistration}</label>
            <select
              id="ob-vat"
              className="input"
              value={vatRegistration}
              onChange={e => setVatRegistration(e.target.value as VatRegistrationStatus | '')}
            >
              <option value="">{copy_.notRecorded}</option>
              {VAT_REGISTRATION_VALUES.map(status => (
                <option key={status} value={status}>
                  {settingsCopy.fiscal.vatRegistrationOptions[status]}
                </option>
              ))}
            </select>
            <span className="hint">{copy_.fields.vatRegistrationHint}</span>
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
          <p className="hint">{copy_.fields.otherIncomeHint}</p>
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
