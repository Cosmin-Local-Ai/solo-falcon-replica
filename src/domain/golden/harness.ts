/**
 * Phase 31 — the driver for the golden fiscal fixtures.
 *
 * **What lives here, and what deliberately does not.** Only the plumbing that builds a legal set of
 * *inputs*: a profile, a `TaxInputsReference`, a ladder with all six art. 170 alin. (4) categories
 * answered, and two thin wrappers over `computeTaxEstimate`. **No expected value lives here.** Every
 * expected number in Phase 31 is a numeric literal written in the fixture file that asserts it, next to
 * the comment naming the source that published it (`docs/ai/research/47_published_worked_examples_fy2026.md`).
 * Putting the expected figures in a shared module would be the circularity this phase exists to remove,
 * wearing a tidy costume: one place to edit, and every fixture following it.
 *
 * The engine is driven **directly**, the way `tax.singleLeg.test.ts` drives it. No `selectEstimateOperands`,
 * no `evaluateScenarios`. A scenario refusal upstream is not a guard: it can be retired by the next phase,
 * and a fixture that passes because something else refused is a fixture that asserts nothing.
 *
 * The rule set is **selected, never named**. `src/domain/fiscal/registry.test.ts` polices that no call
 * site outside `src/domain/fiscal/` hard-codes `PFA_2026_RELEASE` / `PFA_2026_SYSTEM_REAL_PACKAGE`, and a
 * fixture is a call site: binding a golden example to a named release would let it keep computing under the
 * 2026 law after the selector had stopped selecting it. `ruleSetFor` goes through `selectRuleSet`, the same
 * selector `data/dashboard.ts` and `data/derived.ts` use.
 *
 * Two facts every caller must supply, because the engine will not guess them:
 *
 * - **The VAT registration state.** `registrationChargesVat` decides whether the measure of a leu is the
 *   VAT-exclusive or the VAT-inclusive figure, and that follows from art. 310 vs art.316 registration, not
 *   from a flag. Most published examples are silent about it, so each fixture states which one it assumed.
 * - **All six art. 170 alin. (4) categories.** `calcCassLadder` refuses a partial answer set rather than
 *   defaulting the gap (defect B-41), so a rent or art. 85 fixture must answer the other five. `answeredLadder`
 *   does that with declared zeros — a declared zero is a fact the person recorded, which is why the helper
 *   exists rather than an empty array.
 */
import { computeTaxEstimate, type IncomeDeterminationMethodTag, type TaxEstimateResult } from '../tax';
import type { TaxInputsReference } from '../derived';
import type { CassLadderYear, PfaProfile } from '../models';
import { selectRuleSet } from '../fiscal';
import { lei, type Bani } from '../money';

/**
 * The rule release and rule set in force for a fiscal year on a date, via the production selector.
 * A year with no registered package yields `undefined`, and the engine then refuses — which is the correct
 * outcome for a fixture that asks about a year this build has no law for.
 */
export function ruleSetFor(fiscalYear: number, asOfDate = `${fiscalYear}-01-01`) {
  const entry = selectRuleSet(fiscalYear, asOfDate);
  if (!entry) {
    throw new Error(
      `no rule package is registered for fiscal year ${fiscalYear} on ${asOfDate}; a golden fixture must `
        + 'not run against a release from another year',
    );
  }
  return { ruleRelease: entry.release, rules: [...entry.rules] };
}

/** A neutral fixture identity. No real person, no real CUI, no resolvable email domain (B-110 hygiene). */
function fixtureIdentity() {
  return {
    nume: 'Fixture', cnp: '', adresa: 'Str. Fixture 1', telefon: '0700000000', email: 'fixture@example.invalid',
    denumire: 'PFA Fixture', cui: '0000000000', formaJuridica: 'PFA' as const, numarRegComert: 'J00/0000/0000',
    adresaSocietate: 'Str. Fixture 1', telefonSocietate: '', emailSocietate: '', contBancar: '', banca: '',
  };
}

export interface GoldenProfileOptions {
  /** art. 310 exempt, or art. 316 registered. The measure of every leu in the register follows from it. */
  vat?: 'scutit_art310' | 'inregistrat_art316';
  /** art. 174 alin. (7) lit. a) turns on a salary; the amount is what decides, not the status. */
  salaryStatus?: 'da' | 'nu';
  salaryIncomeLei?: Bani | null;
  fiscalYear?: number;
}

export function goldenProfile(over: GoldenProfileOptions = {}): PfaProfile {
  return {
    id: 'p-golden',
    regime: 'impozit_pe_venit',
    fiscalYear: over.fiscalYear ?? 2026,
    pfaStartYear: over.fiscalYear ?? 2026,
    salaryStatus: over.salaryStatus ?? 'nu',
    cashFloorLei: lei(0),
    identity: fixtureIdentity(),
    updatedAt: '2026-01-01T00:00:00Z',
    socialInsuranceStatus: 'obligatoriu',
    vatRegistration: { status: over.vat ?? 'scutit_art310' },
  };
}

/**
 * The six art. 170 alin. (4) categories, all answered with declared zeros, plus whatever the fixture adds.
 *
 * `cedareaFolosinteiBunurilor` is left unanswered by default: for an art. 84 / art. 84¹ / art. 85 register
 * the engine computes that net itself, and a declared figure beside a computed one is two producers for one
 * number — `tax.ts` refuses rather than picking a winner.
 */
export function answeredLadder(over: Partial<CassLadderYear> = {}, fiscalYear = 2026): CassLadderYear[] {
  return [
    {
      fiscalYear,
      proprietateIntelectuala: lei(0),
      asocierePersoanaJuridica: lei(0),
      activitatiAgricole: lei(0),
      investitii: lei(0),
      alteSurse: lei(0),
      cedareaSursa: 'patrimoniu_personal',
      ...over,
    },
  ];
}

export interface GoldenInputsOptions extends GoldenProfileOptions {
  ladderYears?: CassLadderYear[];
  fiscalYear?: number;
}

export function goldenInputs(over: GoldenInputsOptions = {}): TaxInputsReference {
  return {
    regime: 'impozit_pe_venit',
    salaryStatus: over.salaryStatus ?? 'nu',
    salaryIncomeLei: over.salaryIncomeLei ?? null,
    pensionerStatus: 'nu',
    pensionReceiptYears: [],
    pensionSuspensionYears: [],
    cassPreviousYearContext: null,
    foreignSicknessInsurance: null,
    cassLadderYears: over.ladderYears ?? [],
    socialInsuranceStatus: 'obligatoriu',
    vatRegistration: { status: over.vat ?? 'scutit_art310' },
    cashFloorLei: lei(0),
    fiscalYear: over.fiscalYear ?? 2026,
    pfaStartDate: null,
    inputsKey: 'p-golden:2026',
  };
}

/**
 * A sistem-real year (CF art. 68 / art. 123 alin. (1)): gross receipts and recorded expenses, in lei.
 *
 * The four money operands are passed the same way `estimateBasis.ts` hands them: for a taxpayer who does
 * not charge TVA the VAT-inclusive and VAT-exclusive measures coincide, and `expenseBase` is not divergent
 * because no line in these fixtures is both half-count-limited and carrying VAT the taxpayer cannot claim.
 */
export function driveSistemReal(o: {
  gross: Bani;
  expenses: Bani;
  profile?: GoldenProfileOptions;
  ladderYears?: CassLadderYear[];
}): Promise<TaxEstimateResult> {
  const opts = o.profile ?? {};
  return computeTaxEstimate({
    inputs: goldenInputs({ ...opts, ladderYears: o.ladderYears }),
    profile: goldenProfile(opts),
    revenues: o.gross,
    expenses: o.expenses,
    revenuesNet: o.gross,
    expensesNet: o.expenses,
    expenseBase: { netFirst: o.expenses, grossFirst: o.expenses, divergent: false },
    flatRatioGross: null,
    flatRatioMethod: null,
    ...ruleSetFor(opts.fiscalYear ?? 2026),
  });
}

/**
 * A flat-ratio year: the gross the article measures, and WHICH article it is the gross of.
 *
 * The method is an operand, never re-derived here — `selectIncomeDeterminationMethod` decides it from
 * declared facts, and the engine is not entitled to a second opinion.
 */
export function driveFlatRatio(o: {
  gross: Bani;
  method: Exclude<IncomeDeterminationMethodTag, 'sistem-real' | 'accommodation-flat-ratio'>;
  withholdingBlocked?: boolean;
  profile?: GoldenProfileOptions;
  ladderYears?: CassLadderYear[];
}): Promise<TaxEstimateResult> {
  const opts = o.profile ?? {};
  return computeTaxEstimate({
    inputs: goldenInputs({ ...opts, ladderYears: o.ladderYears ?? answeredLadder({}, o.profile?.fiscalYear ?? 2026) }),
    profile: goldenProfile(opts),
    revenues: lei(0),
    expenses: lei(0),
    revenuesNet: lei(0),
    expensesNet: lei(0),
    expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false },
    flatRatioGross: o.gross,
    flatRatioMethod: o.method,
    flatRatioWithholdingBlocked: o.withholdingBlocked ?? false,
    ...ruleSetFor(o.profile?.fiscalYear ?? 2026),
  });
}

/**
 * Unwrap a computed result, or fail the test with the engine's own refusal.
 *
 * A refusal is never silently read as a zero: every fixture below asserts money, and money is only on the
 * `computed` member.
 */
export function computed(res: TaxEstimateResult) {
  if (res.status !== 'computed') {
    throw new Error(`the engine refused instead of computing: ${res.reason}`);
  }
  return res;
}

/** Find an engine line by label prefix. Returns undefined rather than throwing, so absence is assertable. */
export function lineOf(res: { lines: { label: string; value: Bani }[] }, prefix: string) {
  return res.lines.find((l) => l.label.startsWith(prefix));
}

/** The value of a line that must exist. A missing line is a test failure, not a TypeError. */
export function lineValue(res: { lines: { label: string; value: Bani }[] }, prefix: string): Bani {
  const l = lineOf(res, prefix);
  if (l === undefined) {
    throw new Error(`no line starting ${JSON.stringify(prefix)} in: ${res.lines.map((x) => x.label).join(' | ')}`);
  }
  return l.value;
}
