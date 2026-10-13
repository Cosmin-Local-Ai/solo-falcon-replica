import type { AppData } from './types';
import { isFiledVatReturn } from './types';
import {
  selectYtd,
  selectMonthly,
  auditFiscalDates,
  selectUnconvertedRecords,
  type YtdTotals,
  type MonthlyTotals,
  type DashboardSnapshot,
  type UnconvertedRecord,
} from '../domain/aggregation';
import { normaliseStoredLedger, type LedgerConversion } from '../domain/fx/ledger';
import { assessCompleteness, type CompletenessReport } from '../domain/completeness';
import { selectProjectionV1, type ProjectionV1 } from '../domain/projection';
import {
  attachEstimateBasis,
  coverageFromUnconverted,
  estimateBasisOf,
  isGapReason,
  scenarioCoverageGaps,
  selectEstimateCoverage,
  selectEstimateOperands,
  withEstimateBasis,
  type EstimateCoverageGap,
  type TaxEstimateWithBasis,
} from '../domain/estimateBasis';
import { computeTaxEstimate, type TaxEstimateResult } from '../domain/tax';
// PG-6f (D-VAT-3) — the decision type only. The decision itself is produced once, in the assembler, and
// carried here; re-running it over the ledger would be a second producer of one legal figure.
import type { InputVatDecision } from '../domain/fiscal/vat';
import {
  computeThresholds,
  readMinimumWageVintages,
  type FiscalBase,
  type FiscalThreshold,
  type MeasuredBasis,
  type ThresholdBases,
} from '../domain/thresholds';
import { computeDeadlines, classifyDeadline, filingForDeadline, vatObligationDeadlines, vatReturnForDeadline, resolveDeadlineOutcome, type DeadlineView } from '../domain/deadlines';
// B-105 — the lease facts and the fact families they put in force. Read from `domain/models.ts`, the one
// place the cedare regime facts are interpreted: this file is an adapter and a second reading of the same
// facts here is how the deadline card and the estimate start disagreeing about whose tax is whose.
import { cedareDeadlineFactFamilies, leaseFactsForYear, singleDeclarationScopeForYear } from '../domain/models';
// PG-6g — the art. 322 fiscal period and the art. 322/323 filing calendar. Imported from the domain, never
// re-derived here: `data/dashboard.ts` is an adapter, and a second calendar in this file is how two
// surfaces start disagreeing about whether a decont is owed.
import {
  vatPeriodicityForYear,
  type VatPeriodicityOutcome,
} from '../domain/fiscal/vatPeriodicity';
import {
  aicFlipForQuarter,
  aicMentiuniObligation,
  alin8PremiseForYear,
  annualMentiuniObligation,
  decontObligations,
  type AicFlip,
  type VatObligation,
} from '../domain/fiscal/vatReturn';
import { recordedRateProvider } from '../domain/fx/ledger';
import {
  computeTaxReserve,
  createTaxReserveState,
  type TaxReserveRecommendation,
} from '../domain/taxReserve';
import { getInsights as buildInsights } from '../domain/insights';
import {
  isFigureSource,
  partitionAttention,
  type AttentionItem,
  type AttentionSurfaces,
} from '../domain/attention';
import {
  describeSnapshotRuleProvenance,
  noRulePackageProvenance,
  type SnapshotRuleProvenance,
} from '../domain/snapshots/ruleProvenance';
import { recordAttentionItems } from './attention';
import { legislation as legislationCopy } from '../ui/copy';
import { selectTaxDerived } from '../domain/derived';
import { selectRuleSet } from '../domain/fiscal';
import type { FiscalRule } from '../domain/fiscal/rules';
import { selectApplicableRules } from '../domain/fiscal/select';
import { localDateISO, localYear, now } from '../domain/date';
import { formatBaniLei, type Bani } from '../domain/money';

/**
 * TASK 6: the rules in force for this profile's fiscal year on `asOfDate`, or none.
 *
 * One helper, one question — "which rules apply here?" — so no call site in this file can reach for a
 * year-named constant instead. An empty array is an honest answer, not a fallback: the engines already
 * report a missing rule rather than inventing one.
 */
function selectionRules(data: AppData, asOfDate: string): FiscalRule[] {
  const selection = selectRuleSet(data.profile.fiscalYear, asOfDate);
  return selection ? [...selection.rules] : [];
}

export interface PendingCounts {
  revenuesInAsteptare: number;
  revenuesRespinsa: number;
  expensesRespinsa: number;
  /**
   * PG-5: annual returns recorded in the app but not yet filed. It replaces
   * `declarationsInAsteptare`, which counted monthly rows whose own status said „în așteptare” — rows
   * for a return this profile does not owe.
   */
  filingsInAsteptare: number;
}

/**
 * Phase 10c (B-37) — the ledger the money surfaces actually read, and the two lists that make it honest.
 *
 * `conversions` names every record that entered the lei totals only because a recorded rate converted it,
 * with the rate, the date it was keyed to, the citation, the series and whether it is provisional.
 * `unconverted` names every foreign record the lei totals still leave out, with the datum that is missing.
 * The second list is the one that stops a total reading as complete.
 */
export interface LedgerDisclosure {
  conversions: LedgerConversion[];
  unconverted: UnconvertedRecord[];
}

/**
 * THE one normalised ledger boundary for every money surface in this file (Phase 10c, B-37).
 *
 * Summary, the monthly series, the projection behind the graph, the threshold rows and the snapshot all
 * read the ledger this returns, and the tax estimate reads the same function through
 * `estimateBasis.ts selectEstimateOperands`. Before 10c the estimate normalised and these selectors did
 * not, so a user with one EUR invoice saw two revenue totals — the defect B-37 names.
 *
 * The pass is idempotent (`domain/fx/ledger.ts`), so calling it per selector cannot drift and cannot
 * convert an already-converted record.
 */
function ledgerOf(data: AppData) {
  return normaliseStoredLedger(data);
}

/** The conversions and the still-unconverted records behind the totals this dashboard renders. */
export function getLedgerDisclosure(data: AppData): LedgerDisclosure {
  const ledger = ledgerOf(data);
  return {
    conversions: ledger.conversions,
    // The disclosure mechanism is the one `aggregation.ts` already had — `selectUnconvertedRecords` —
    // extended with the reason the conversion pass found, not a second list invented beside it.
    unconverted: selectUnconvertedRecords(ledger.data, ledger.unconverted),
  };
}

export interface DashboardSnapshotView extends DashboardSnapshot {
  pfaRevenue: Bani;
}

/**
 * TASK 8 — the epistemic states of the tax estimate, widened by PG-1 to an explicit status union.
 *
 * `TaxEstimateResult` has two members (`computed` | `review_required`), and the dashboard adapter used
 * to paper over the absence of an estimate with a `review_required` sentinel whose reason was the
 * internal token `loading` — which reached the screen through the chart note. A missing calculation and
 * a refused one are different claims: the first says nothing was produced, the second says the engine
 * ran and withheld a conclusion. `unavailable` is the third state, and it is derived here from the
 * estimate actually being absent, never from a sentinel's reason string. **That must stay true:**
 * `unavailable` is not a spelling of `review_required`, and nothing here reintroduces a sentinel.
 *
 * PG-1 splits the old `computed` in two, because "the engine produced a figure" and "the figure covers
 * what was recorded" are different claims and the hero was making only the first one:
 *
 * - `complete` — every recorded record is either in the figure or accounted for by a reason the app
 *   settled (a legal non-deductibility), and nothing is missing.
 * - `incomplete` — a record is out of the figure for a reason the app could NOT settle: no category, no
 *   rule answer, no asset register, no rate, no measurable ceiling.
 *
 * `refused` is PG-6a's. It is produced by the scenario registry, and only by it: a scenario whose effect
 * is `refuse` stops the calculation before the engine is reached, and the basis carries which one. It is
 * deliberately not a spelling of `review_required` — that word stays the engine's own withheld conclusion,
 * which is a calculation that ran and declined to answer. `closed_final` is still declared and produced by
 * nobody: PG-6 owns its trigger. Declaring it here is what makes the surfaces exhaustive over the union
 * instead of adding a seventh word later.
 */export type TaxEstimateState =
  | 'complete'
  | 'incomplete'
  | 'review_required'
  | 'refused'
  | 'closed_final'
  | 'unavailable';

function estimateStateOf(
  tax: TaxEstimateResult | TaxEstimateWithBasis | null,
  coverage: readonly EstimateCoverageGap[],
): TaxEstimateState {
  if (tax === null) return 'unavailable';
  // PG-6a — a scenario refusal is read off the basis the assembler stamped, not off `status`.
  //
  // Both arrive as `status: 'review_required'`, and collapsing them would be the exact defect this state
  // exists to prevent: `review_required` says an engine ran and withheld a conclusion, `refused` says the
  // calculation was never allowed to run. The basis is the only place that distinction survives, because
  // it records whether the engine was reached at all — and a hand-built result with no basis stays
  // `review_required` rather than being guessed into a refusal.
  if (estimateBasisOf(tax)?.kind === 'refused') return 'refused';
  if (tax.status === 'review_required') return 'review_required';
  return coverage.some(g => isGapReason(g.reason)) ? 'incomplete' : 'complete';
}

/**
 * PG-4 (D-YEAR-1) — the fiscal-year lifecycle, as data rather than as a page-level guess.
 *
 * Until now the fiscal year was only a Settings field: nothing in the app noticed 1 January. On
 * 1 Jan 2027 that is not a cosmetic gap — the build carries no 2027 rule release, so the year the
 * clock names has nothing to select, and a view that cannot say so falls back to a stale 2026 figure
 * or to a zero. Both are the worst failure this app can have, and both are prevented by naming the
 * state here instead of inferring it from a label.
 *
 * `closed` is the other half: once the as-of date is past 31 Dec the year is finished, its figures are
 * final actuals, and no surface may dress them in run-rate wording.
 */
export interface FiscalYearView {
  /** The fiscal year this view describes — the year the estimate, the thresholds and the ledger are for. */
  year: number;
  /** True when the as-of date is past 31 Dec of `year`: the year is closed and its figures are final. */
  closed: boolean;
  /** True when this build registers a rule release in force for `year` on the as-of date. */
  rulesAvailable: boolean;
  /** The calendar year the clock is in. */
  currentYear: number;
  /**
   * The year the clock says this view should move to, or `null` when it should not move.
   * See `yearAdvanceTarget` for what makes a move automatic and what makes it a deliberate choice.
   */
  advanceTo: number | null;
}

/**
 * Should the stored fiscal year advance to the year the clock is in?
 *
 * D-YEAR-1 says the app switches automatically on 1 January — but a switch the user can undo has to
 * stay undone, or the "toggle back to a previous year" the same decision asks for is not a toggle. So
 * the advance fires once, when the stored profile was last maintained BEFORE the boundary. Writing a
 * year deliberately re-stamps `profile.updatedAt` (store.tsx `updateProfile`), which puts the choice
 * on the far side of the boundary and stops the automatic move from overwriting it on the next load.
 *
 * A profile with no `updatedAt` has never been written, so there is no choice to respect and the
 * advance proceeds.
 */
export function yearAdvanceTarget(profile: AppData['profile'], instant: Date = now()): number | null {
  const currentYear = localYear(instant);
  if (currentYear <= profile.fiscalYear) return null;
  // `updatedAt` is a UTC instant (`toInstantISO`), and the boundary is a Romanian calendar-day fact.
  // At 00:30 on 1 Jan 2027 in Bucharest the UTC stamp still reads 2026, so reading the year off the
  // string would treat a choice made after the boundary as one made before it — and the automatic
  // advance would overwrite the toggle back a second after the person pressed it.
  const touched = new Date(String(profile.updatedAt ?? ''));
  if (!Number.isNaN(touched.getTime()) && localYear(touched) >= currentYear) return null;
  return currentYear;
}

function fiscalYearView(data: AppData, asOfDate: string, instant: Date): FiscalYearView {
  const year = data.profile.fiscalYear;
  return {
    year,
    closed: asOfDate > `${year}-12-31`,
    rulesAvailable: selectRuleSet(year, asOfDate) !== undefined,
    currentYear: localYear(instant),
    advanceTo: yearAdvanceTarget(data.profile, instant),
  };
}

export interface DashboardData {
  taxYear: number;
  snapshot: DashboardSnapshotView;
  /**
   * The engine's result plus the basis that produced it (`estimateBasis.ts`). A consumer can tell
   * actuals-to-date from run-rate projected without inferring it from a label.
   *
   * TASK 8: `null` is now representable. It used to be replaced by a `review_required` sentinel, which
   * made "nothing has been calculated yet" and "the engine refused to calculate" the same value on the
   * way to the screen. `estimateState` is the field the surfaces read.
   */
  tax: TaxEstimateWithBasis | null;
  estimateState: TaxEstimateState;
  /**
   * PG-6f (D-VAT-3) — the per-line input-VAT decision for this period, carried from the single assembler
   * pass rather than recomputed here. `null` when no estimate was produced at all, which is a different
   * state from a decision that found nothing claimable.
   *
   * The claimable total it carries is **not a return figure**. `research/42` §7 records that the amount
   * lands on D300 rd. 30 *plus* the corrections on rd. 33/34, because the 50 % vehicle cut and the pro
   * rata fall partly inside rd. 20-28 and partly outside it. PG-6g owns the form; nothing here may
   * present this as a filed or filable number.
   */
  inputVat: InputVatDecision | null;
  /**
   * PG-6g (D-VAT-1) — the CF art. 322 fiscal period for this profile's fiscal year, **derived**.
   *
   * Four states, and the fourth is the one the phase exists to make rare: `derived` (the facts and the
   * arithmetic give the answer), `user_confirmed` (they do not, and the person answered after the app
   * stated the rule — labelled as their answer, never as the app's conclusion), and `ask` (the app says
   * which fact is missing and where to give it, and states the statutory default meanwhile). **There is no state in which the app
   * silently picks a cadence**, which is what the old monthly D300 cadence did.
   */
  vatPeriodicity: VatPeriodicityOutcome;
  /**
   * PG-6g — the art. 322/323 filing calendar for this fiscal year: the deconturi, the alin. (6) mențiuni
   * until 25 ianuarie, and the alin. (8) 5-working-day mențiuni for an intra-community goods acquisition.
   *
   * Empty when the periodicity is not settled — a decont cannot be dated without knowing the period it
   * covers, and guessing the period would put a false term on screen. The unanswered case reaches the
   * person through the completeness channel, not through a dateless row here.
   */
  vatObligations: VatObligation[];
  /**
   * PG-4 — which fiscal year this view is about, whether it is closed, and whether this build has the
   * rules for it. The banner and the hero label both read this instead of re-deriving a year from the
   * clock, which is how a stale year could previously be presented as the current one.
   */
  year: FiscalYearView;
  /**
   * PG-1 — every recorded record the estimate figure does not describe, with the reason, the amount at
   * stake and the route that fixes it. Assembled from two lists that already exist and never overlap:
   * the assembler's own exclusions (`estimateBasis.ts selectEstimateCoverage`) and the Phase 10c ledger
   * disclosure (`ledger.unconverted`, via `coverageFromUnconverted`). Foreign records come from the
   * ledger disclosure ONLY — the assembler's `foreign_currency` entries are dropped rather than
   * re-reported, so one record carries one reason and reaches one surface.
   *
   * Not every entry is a defect in the estimate: a legally non-deductible record is listed so a row can
   * say why it is out, but it does not make the estimate incomplete. `isGapReason` is the test that
   * separates the two, and it is the same test the hero badge and the weighted percentage use.
   */
  coverage: EstimateCoverageGap[];
  thresholds: FiscalThreshold[];
  /**
   * The dated terms still ahead, each carrying whether the dataset already discharges it.
   * PG-5 widened the row from `Deadline` to `DeadlineView` so the card can say „Depusă” instead of
   * showing a term as still open after the return was filed.
   */
  deadlines: DeadlineView[];
  completeness: CompletenessReport;
  /**
   * TASK 8: the action surface is a projection of the attention model, not a second pipeline. It used
   * to be `ActionItem[]` computed independently of `insights`, over the same deadlines and completeness
   * checks, which is how one problem reached the screen twice in two vocabularies.
   */
  actions: AttentionItem[];
  reserve: TaxReserveRecommendation;
  /** The observation surface — the other projection of the same list. */
  insights: AttentionItem[];
  pendingCounts: PendingCounts;
  legislation: LegislationState;
  /**
   * Phase 10c — what the lei totals in this view did with the foreign-currency records: which ones a
   * recorded rate brought in, and which ones are still out. A total with something still missing from it
   * must not read as complete, and this is what says so.
   */
  ledger: LedgerDisclosure;
  /**
   * TASK 9 — which rule package produced the figure the hero shows, and whether the digest that record
   * carries still verifies against the registered rules. `null` when there is no calculation to ask.
   */
  provenance: SnapshotRuleProvenance | null;
}

function isoToday(instant: Date = now()): string {
  return localDateISO(instant);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
}

export function getFinancialSummary(data: AppData, asOfDate: string): YtdTotals {
  return selectYtd(ledgerOf(data).data, asOfDate);
}

export function getMonthlyFinancialSeries(data: AppData, asOfDate: string): Map<string, MonthlyTotals> {
  return selectMonthly(ledgerOf(data).data, asOfDate);
}

export function getProjectedFinancialSeries(data: AppData, asOfDate: string): ProjectionV1 {
  return selectProjectionV1(ledgerOf(data).data, asOfDate);
}

export function getDataCompleteness(
  data: AppData,
  coverage: readonly EstimateCoverageGap[] = [],
  asOfDate?: string,
  filingTerm: string | null = null,
): CompletenessReport {
  return assessCompleteness(data, coverage, asOfDate, filingTerm);
}

export function getPendingCounts(data: AppData): PendingCounts {
  return {
    revenuesInAsteptare: data.revenues.filter((r) => r.status === 'in-asteptare').length,
    revenuesRespinsa: data.revenues.filter((r) => r.status === 'respinsa').length,
    expensesRespinsa: data.expenses.filter((e) => e.status === 'respinsa').length,
    filingsInAsteptare: data.filings.filter((f) => f.status === 'in_pregatire').length,
  };
}

/**
 * The annual tax estimate.
 *
 * Task 1 (pre-Phase-11): the engine is no longer fed raw YTD totals. It is fed the annual figures
 * from the projection model (`domain/projection.ts`, `run-rate-v1`) whenever that model has a run
 * rate to project with, and the choice is recorded on the result as `basis`. When the model has no
 * run rate — an `asOfDate` before the fiscal year start, where its own denominator is 0 — the engine
 * runs on actuals-to-date and the basis says so, instead of annualising a zero into a
 * plausible-looking number.
 *
 * TASK 2b adds the step in front of that: the operands come from `estimateBasis.ts`
 * `selectEstimateOperands`, which classifies every expense under CF art. 68 and aggregates only the
 * confirmed-deductible subset. This call site no longer decides what enters the engine — it cannot,
 * which is the point: the live path (`data/derived.ts useLatestTaxEstimate`) calls the same
 * assembler, so the two cannot drift. When the law supplies no expense engine for the activity
 * (art. 68^3 cazare, defect B-29) the assembler returns a `review_required` result naming the rule,
 * and `computeTaxEstimate` is never reached.
 *
 * The YTD financial summary is a separate path (`getFinancialSummary`) and is deliberately not
 * touched here: it reports what the user recorded, not what the law lets them deduct.
 */
export function getTaxEstimate(data: AppData, asOfDate: string): Promise<TaxEstimateWithBasis> {
  // TASK 6: the rule set is SELECTED by the profile's fiscal year and the as-of date, not imported. An
  // imported `PFA_2026_*` constant is a call site that hard-codes the law: it would keep feeding the 2026
  // rules to a profile that says another year, and — the part that mattered — it would let a new rule set
  // silently re-bind calculations that were supposed to be pinned to an old one. When no release is
  // registered for the year, `rules` is empty and `ruleRelease` is null, and `computeTaxEstimate` refuses
  // rather than computing under a year it was not asked about.
  const selection = selectRuleSet(data.profile.fiscalYear, asOfDate);
  const rules = selection ? [...selection.rules] : [];
  const operands = selectEstimateOperands(data, asOfDate, rules);
  if (operands.kind === 'refused') {
    return Promise.resolve(attachEstimateBasis(operands.result, operands.basis, operands.scenarios));
  }
  const { basis, amounts } = operands;
  // TASK 6 also closes a drift Scout-level review found: this path used to hand the UNFILTERED package to
  // `selectTaxDerived` while the live path (`data/derived.ts`) handed it the year/date-filtered set, so the
  // two could report different rule sets from the same data. Both now filter.
  const derived = selectTaxDerived(
    data,
    selectApplicableRules(rules, { taxYear: data.profile.fiscalYear, asOfDate }),
  );
  return computeTaxEstimate({
    inputs: derived.inputs,
    profile: data.profile,
    revenues: amounts.revenues,
    expenses: amounts.expenses,
    revenuesNet: amounts.revenuesNet,
    expensesNet: amounts.expensesNet,
    // PG-6f (B-30) — threading only, identical to `data/derived.ts useLatestTaxEstimate` by construction:
    // both read the base the assembler's single per-line VAT decision produced, so the rendered figure and
    // the tested figure cannot disagree about which measure the engine ran on.
    expenseBase: operands.expenseBase,
    // PG-6h-1 — threading only. The assembler decided whether this register has an art. 68^3 source and
    // measured its gross on the same ledger pass as every other operand; this call site only hands it over.
    flatRatioGross: amounts.flatRatioGross ?? null,
    // B-88 — threading only, same discipline as the line above: the assembler decided which flat article
    // this gross belongs to, and a call site that left the field out would hand the engine a 30 % ratio
    // with no way to know which article gave it.
    flatRatioMethod: amounts.flatRatioMethod ?? null,
    // B-105 — whether art. 84^1 alin. (8) switched the withholding off. Threaded, not re-read: the assembler
    // resolved it from the declared lease facts, and the engine decides with it whether the 10 % is the
    // payer's to withhold or this taxpayer's to pay.
    flatRatioWithholdingBlocked: amounts.flatRatioWithholdingBlocked ?? false,
    ruleRelease: selection ? selection.release : null,
    rules,
  }).then((result) => attachEstimateBasis(result, basis, operands.scenarios, operands.inputVat));
}

/**
 * Assemble the amount map `computeThresholds` reads. Each key is one named amount concept,
 * so a threshold can never borrow a neighbouring quantity by accident.
 *
 * The contribution base (`net-income`) is a legal quantity owned by the tax engine: CF
 * art. 148 alin. (1)-(2) for CAS and art. 170 alin. (1) / art. 174 alin. (2), (6) for CASS.
 * It is deliberately NOT taken from `YtdTotals.net`, which subtracts VAT-inclusive operands
 * and therefore is a different number. When the engine declined to compute, there is no
 * contribution base to report and the three contribution rows come back `review_required`.
 */
export function buildThresholdBases(ytd: YtdTotals, tax: TaxEstimateResult | null): ThresholdBases {
  const bases: ThresholdBases = {
    'revenue-incl-vat': ytd.revenue,
    'revenue-excl-vat': ytd.revenueNet,
    'expense-incl-vat': ytd.expenses,
    'expense-excl-vat': ytd.expenseNet,
  };
  if (tax !== null && tax.status === 'computed') {
    // PG-6h-1: when an art. 68^3 source was in play, the engine measured CAS and CASS on the CUMULATED
    // art. 148 alin. (3) / art. 170 alin. (1) amount, not on the sistem-real net alone. A threshold row
    // that tests a different amount than the engine did is the B-71 defect class — the percentage and the
    // figure disagreeing about the same record — so the row reads the amount the engine names.
    bases['net-income'] =
      tax.bases.venitulNetCumulatPentruContributii ?? tax.bases.venitulNetDinActivitate;
  }
  return bases;
}

/**
 * TASK 4 — record HOW each supplied amount was produced, so each threshold row can state which
 * basis it measured instead of the reader having to guess.
 *
 * The asymmetry is deliberate and must stay: CF art. 148 / art. 170 / art. 174 measure an ANNUAL
 * value, and since PG-5C the annual value the app holds IS the realised one — the receipts collected
 * and the payments paid, which art. 118 alin. (3) deems to be the annual income even for a fraction of
 * a year. CF art. 310 alin. (1) measures the turnover realised in the year so far, so `VAT_REGISTRATION`
 * stays YTD. Unifying them would make one of the two rows state a quantity the law does not measure.
 *
 * PG-5C also removed `'annual-projected'` from `MeasuredBasis` rather than leaving it unproduced. A
 * label that can no longer be emitted is a dead enum member; a label that cannot be emitted is a guard.
 * With the member gone, `measuredBasisLabels` no longer compiles if anything ever tries to attribute a
 * contribution row to a forecast again.
 */
export function buildThresholdBasisProvenance(
  tax: TaxEstimateWithBasis | null,
): Partial<Record<FiscalBase, MeasuredBasis>> {
  if (tax === null) {
    // Nothing was computed, so nothing can be attributed. An empty provenance map makes the rows say
    // they are unmeasured; labelling them `annual-actual` would name a basis that does not exist.
    return {};
  }
  const turnover: MeasuredBasis = 'ytd-turnover';
  // `unattributed` is only reachable for a `refused` or `unknown` basis — a result that never had
  // amounts to attribute. A computed one always says which realised quantity it measured on.
  const annual: MeasuredBasis = tax.basis.kind === 'recorded-actuals' ? 'annual-actual' : 'unattributed';
  return {
    'revenue-incl-vat': turnover,
    'revenue-excl-vat': turnover,
    'expense-incl-vat': turnover,
    'expense-excl-vat': turnover,
    'net-income': annual,
  };
}

export function getThresholdStatuses(
  data: AppData,
  asOfDate: string,
  tax: TaxEstimateResult | TaxEstimateWithBasis | null,
): FiscalThreshold[] {
  const ytd = selectYtd(ledgerOf(data).data, asOfDate);
  const estimate = tax === null ? null : withEstimateBasis(tax);
  // TASK 6: selected, not imported. `ruleRelease` on a threshold row is the releaseId of the release that
  // produced the row — it used to be `PFA_2026_RELEASE.ruleIds[0]`, i.e. the first RULE id stamped on a
  // field named `ruleRelease`, which is how a hard-coded constant quietly becomes a wrong label.
  const selection = selectRuleSet(data.profile.fiscalYear, asOfDate);
  return computeThresholds(selection ? [...selection.rules] : [], {
    taxYear: data.profile.fiscalYear,
    asOfDate,
    bases: buildThresholdBases(ytd, estimate),
    ruleRelease: selection ? selection.release.releaseId : null,
    // TASK 4: applicability is derived from the profile, never assumed. Passing no profile would
    // make every row `applicability: 'unknown'`, and `dashboard.test.ts` pins that the production
    // path never does that.
    profile: data.profile,
    measuredBasis: buildThresholdBasisProvenance(estimate),
  });
}

/**
 * PG-5 — the annotated deadline row lives in the domain (`domain/deadlines.ts DeadlineView`) so the
 * card can read it without importing the data layer. Re-exported here because this is the file every
 * surface already reads from.
 */
export type { DeadlineView };

/**
 * PG-6g — the art. 322 fiscal period for this profile, derived rather than stored.
 *
 * One call per dashboard build, read by the Form 300 surface, the completeness channel and the calendar
 * below. The cap (the 100.000-euro equivalent in lei, with the BNR rate and the date it is valid for) is
 * struck inside it, so no surface can render a lei threshold it derived itself.
 */
export function getVatPeriodicity(data: AppData): VatPeriodicityOutcome {
  return vatPeriodicityForYear(
    data.profile.vatPeriodicityYears,
    data.profile.fiscalYear,
    recordedRateProvider(data),
    data.profile.vatRegistration,
    // B-102 — alin. (8) is a rule about two years, so the derivation has to be able to see the previous
    // two. The premise is computed here from the per-year fact array and the filed returns; nothing about
    // it is stored. `domain/completeness.ts` builds it the same way from the same inputs, and
    // `src/domain/vatPeriodicitySurfaces.test.ts` is the guard that keeps the two surfaces from ever
    // answering differently for one profile-year.
    {
      alin8: alin8PremiseForYear(
        data.profile.vatPeriodicityYears,
        data.profile.fiscalYear,
        data.vatReturns ?? [],
        isFiledVatReturn,
      ),
    },
  );
}

/**
 * PG-6g — the filing calendar for this profile's fiscal year, from art. 322 and art. 323.
 *
 * **It is empty when the periodicity is not settled, and that is the correct output.** A decont cannot be
 * dated without knowing the fiscal period it covers, and dating one by guessing the period would put a
 * false term on a taxpayer who has not answered the question yet. The unanswered case is carried by the
 * completeness channel (`domain/completeness.ts`), which states the rule and asks — not by a dateless row
 * in this list.
 *
 * Three kinds of obligation, never collapsed into one date list:
 * - the deconturi, one per fiscal period, art. 323 alin. (1) — including the Q4 term that falls on 25
 *   ianuarie of the following year;
 * - the art. 322 alin. (6) mențiuni until 25 ianuarie, which is **not** a decont and is owed by a person
 *   quarterly „potrivit alin. (2) și (5)”, and — B-102 — by the person alin. (8) teza a III-a sends back
 *   through that same declaration in order to return to the quarter;
 * - the art. 322 alin. (8) 5-working-day mențiuni for an intra-community goods acquisition.
 *
 * The alin. (7) split is applied only when the month of exigibility is declared; a bare `da` cannot pick
 * between lit. a), lit. b) and lit. c), and picking one would invent a fiscal period.
 */
export function getVatObligations(data: AppData, asOfDate: string): VatObligation[] {
  const periodicity = getVatPeriodicity(data);
  if (periodicity.kind !== 'derived' && periodicity.kind !== 'user_confirmed') return [];
  const year = data.profile.fiscalYear;
  const facts = (data.profile.vatPeriodicityYears ?? []).find((y) => y.year === year);

  const flips: AicFlip[] = [];
  const extra: VatObligation[] = [];
  if (facts?.aicGoodsWhileQuarterly === 'da' && facts.aicGoodsExigibilityMonth) {
    const q = Math.ceil(facts.aicGoodsExigibilityMonth / 3);
    const flip = aicFlipForQuarter(year, q, facts.aicGoodsExigibilityMonth);
    if (flip) flips.push(flip);
    const aic = aicMentiuniObligation({ year, monthOfExigibility: facts.aicGoodsExigibilityMonth });
    if (aic) extra.push(aic);
  }

  // Which alineat put this person on the quarter decides whether the alin. (6) mențiuni duty exists: the
  // article names alin. (2) and alin. (5) only, so a quarterly status that came from the registration-year
  // estimate (alin. (3)) or the registration-year annualised actual (alin. (4)) does not carry it.
  const quarterlyUnder: 'alin2' | 'alin5' | 'alin3' | 'alin4' | null =
    periodicity.periodicity !== 'quarter' ? null
      : periodicity.branch === 'alin2' || periodicity.branch === 'alin5' ? periodicity.branch
      : periodicity.branch === 'alin3' || periodicity.branch === 'alin4' ? periodicity.branch
      : null;
  // B-102 — the second route to the alin. (6) declaration, and the one the defect was. A person in the
  // alin. (8) return year is on the month, so `quarterlyUnder` is null for them and the very duty that
  // *effects* the return never appeared. `eligibleToReturn` is the honest gate: the record does not
  // disprove the return. It is not a claim that the return happened — that still needs the filing, and
  // this row is the filing.
  const alin8 = periodicity.kind === 'derived' ? periodicity.alin8 : undefined;
  const alin8ReturnYear = alin8 && alin8.position === 2 && alin8.eligibleToReturn ? alin8.flipYear : null;
  const mentiuni = annualMentiuniObligation({
    year,
    quarterlyUnder,
    alin8ReturnYear,
    requestingArt310Return: facts?.art310ReturnRequested === 'da',
    art310ReturnUnknown: facts?.art310ReturnRequested === undefined || facts?.art310ReturnRequested === 'nedeclarat',
  });

  return [
    // B-101 — the segment travels with the periodicity, not with the flip. Art. 322 alin. (7) fixes the
    // month the calendar month begins at, and only the derivation knows whether this person was on the
    // quarter at all; `decontObligations` walks quarters up to that point and months after it. A person
    // already monthly on some other branch has no segment and keeps the year they already had.
    ...decontObligations(periodicity.periodicity, year, {
      flips,
      closedThrough: asOfDate,
      segment: periodicity.segment,
    }),
    ...(mentiuni ? [mentiuni] : []),
    ...extra,
  ];
}

/**
 * Every deadline this profile has, annotated once.
 *
 * One `computeDeadlines` call per dashboard build feeds the card, the snapshot and the completeness
 * check. Before this, each of them called the engine separately; three calls that could disagree about
 * whether a term exists is exactly the drift the rest of this file keeps closing off.
 *
 * PG-6g appends the art. 322/323 VAT calendar to the same list and annotates both halves in the same map,
 * so the card and the attention pipeline cannot disagree about whether a decont is owed. The two halves
 * have different producers — a registered rule package, and a calendar generated from the article because
 * `release2026.ts` is off-limits to this phase and `registry.ts` refuses an unregistered rule — but one
 * annotation path, which is what keeps `done` meaning the same thing on every row.
 */
export function getDeadlineRows(data: AppData, asOfDate: string): DeadlineView[] {
  const filings = data.filings;
  const vatReturns = data.vatReturns;
  const rows: DeadlineView[] = [
    ...computeDeadlines(selectionRules(data, asOfDate), {
      taxYear: data.profile.fiscalYear,
      asOfDate,
    // Phase 9b: `pfaStartDate` is passed but read by NO deadline rule, and none may be — the only
    // rule that ever consumed it implemented an obligation abrogated on 01-01-2025, and the CPF
    // 30-day fiscal-registration term does not reach a PFA (OUG 44/2008 art. 13 alin. (3) is itself
    // the act of fiscal taking-into-evidence). A PFA start date therefore resolves ZERO deadlines:
    // silence is the correct outcome, asserted in src/domain/deadlines.test.ts.
    // `vatExceedanceDate` is the input `VAT_REGISTRATION_DEADLINE_2026` had been missing since
    // Phase 9b: the rule was correct, cited and rule-driven, but nothing recorded the date, so it
    // could only ever resolve `date: null, status: 'not_applicable'`. It is still optional, and an
    // absent value still produces NO dated deadline — the engine has no source for the exceedance
    // date and must not invent one. Passing it is a data-model fix, not a rule change.
      pfaStartDate: data.profile.pfaStartDate,
      vatExceedanceDate: data.profile.vatExceedanceDate,
      // B-105 — the two inputs `CEDARE_CONTRACT_REGISTRATION_DEADLINE_2026` had been missing since it was
      // written. Both are optional and both stay honest when absent: an absent contract date leaves the row
      // undated and `not_applicable` rather than guessed, and an absent fact family makes the rule emit
      // NOTHING — which is how art. 83 alin. (5) reaches an ordinary *cedarea folosinței* register and skips
      // the short-term-rooms register the alineat carves out. The families come from declared facts only.
      leaseContractDate: leaseFactsForYear(data.profile.leaseFactsYears, data.profile.fiscalYear)?.contractDate,
      factFamilies: cedareDeadlineFactFamilies(data.profile, data.profile.fiscalYear),
    }),
    ...vatObligationDeadlines(getVatObligations(data, asOfDate), data.profile.fiscalYear),
  ].map((d) => {
    const filing = filingForDeadline(filings, d);
    const vatReturn = vatReturnForDeadline(vatReturns, d);
    return {
      ...d,
      done: filing !== null || vatReturn !== null,
      filedOn: filing?.filedOn ?? vatReturn?.filedOn ?? null,
      outcome: resolveDeadlineOutcome(d, filings, asOfDate, vatReturns),
      // B-105 — the D212 row says what it covers. art. 122 alin. (6) lit. a) takes the income tax out of the
      // return when the payer withheld it; art. 122 alin. (7) puts the contributions back in, because CASS on
      // ordinary rent is not withheld (art. 174^1 alin. (3) reaches only daily wage, arendă and associations).
      // Resolved in `domain/models.ts` from the declared tenant fact — not re-derived here.
      declarationScope:
        d.eventType === 'd212_filing' ? singleDeclarationScopeForYear(data.profile, data.profile.fiscalYear) : null,
    };
  });
  return rows;
}

/**
 * The dated terms that still lie ahead. Unchanged in meaning since Step 31: past, due-today and
 * null-dated terms are excluded by the domain `filterUpcoming`. A term already discharged still
 * appears here while its date is ahead — with `done: true`, so the card can say so rather than
 * silently dropping the one piece of good news it has.
 */
export function getUpcomingDeadlines(data: AppData, asOfDate: string): DeadlineView[] {
  return getDeadlineRows(data, asOfDate).filter((d) => classifyDeadline(d, asOfDate) === 'upcoming');
}

/**
 * PG-5 / B-35 — the terms the engine resolved but could not date.
 *
 * These are not absent obligations; they are obligations whose date the recorded facts cannot fix. The
 * VAT filing period is the live case. They are NOT rendered as a second warning surface: the sentence
 * goes through the one completeness channel (`domain/completeness.ts vatFilingPeriodCheck`), which is
 * where the brief asks for it and where it reaches both the card and the action list. This function
 * exists for the tests that pin the engine's silence is an undated term, not a missing one.
 */
export function getUndatedDeadlines(data: AppData, asOfDate: string): DeadlineView[] {
  return getDeadlineRows(data, asOfDate).filter((d) => d.date === null);
}

/**
 * The reserve read site #1 — the one the cockpit cards and the „Rezervă fiscală” card render from.
 *
 * TASK 3: the reserved amount is read from the persisted dataset (`AppData.reservedAmount`), not
 * invented here. `null` stays `null` („no reserve recorded”) and `0` stays `0` (an explicit zero the
 * user recorded); `createTaxReserveState` carries the tri-state through verbatim.
 *
 * `tax` is the estimate the caller already computed — the same `TaxEstimateResult` the tax figures on
 * the screen come from. This function must never re-derive it: re-running `selectEstimateOperands`
 * here would re-run `selectYtd` inside `selectProjectionV1` and strike the annual ceilings on a
 * different output, so the reserve could disagree with the dashboard by exactly the two ceilings
 * apart (TASK 2d made that gap real) with nothing in the UI to say which figure is right.
 */
export function getTaxReserve(
  data: AppData,
  asOfDate: string,
  tax: TaxEstimateResult | null,
): TaxReserveRecommendation {
  const state = createTaxReserveState(data.reservedAmount);
  return computeTaxReserve(tax, state, {
    asOfDate,
    fiscalYear: data.profile.fiscalYear,
  });
}

export function getInsights(
  data: AppData,
  snapshot: DashboardSnapshot,
  tax?: TaxEstimateResult,
): AttentionItem[] {
  return buildInsights({
    snapshot,
    expenses: data.expenses,
    tax,
    // B-21: the aggregate excludes records with an unusable date; this is what makes that
    // exclusion visible instead of silent.
    fiscalDateIssues: auditFiscalDates(data),
  });
}

/**
 * TASK 8 — the reconciliation of the two attention pipelines, in one place.
 *
 * `getInsights` (domain) and `getActionItems` (data layer) used to be two independent computations over
 * the same deadlines and completeness checks. They could not know about each other, so the same problem
 * reached the screen twice: `completeness` as a collapsed card *and* `completeness-<key>` as an action,
 * `deadline-<id>` as an alert *and* as an action, `tax` as a card *and* `tax-review` as an action.
 *
 * There is now one list. The domain families and the record family are produced once, `dedupeAttention`
 * collapses any id two producers both claimed (the more severe copy wins), and `partitionAttention`
 * routes every item to exactly one surface from its `state`. An item cannot be a card and an action at
 * the same time, because the routing is a function of one field and there is no call site that can
 * override it.
 */
export function getAttentionItems(
  data: AppData,
  snapshot: DashboardSnapshot,
  tax?: TaxEstimateResult,
): AttentionSurfaces {
  // TASK 9 — the rows that report a computed figure carry the rule provenance of that calculation. One
  // view, computed once, attached to every figure-bearing row, so two rows about the same number can
  // never disagree about which package produced it. A row about a document or a date carries nothing.
  const provenance = estimateProvenance(tax) ?? noRulePackageProvenance();
  const items = [...getInsights(data, snapshot, tax), ...recordAttentionItems(data)].map((item) =>
    isFigureSource(item.source) ? { ...item, provenance } : item,
  );
  return partitionAttention(items);
}

/**
 * TASK 9 — the provenance of the calculation this dashboard is showing.
 *
 * `null` is a real answer, not a gap: a `review_required` result carries no snapshot (the engine
 * withheld one) and `unavailable` is the absence of any calculation, so in both cases there is no
 * record to attribute and the surfaces say so instead of showing a digest. This function never
 * constructs a snapshot, never re-hashes one and never fills in a `ruleSetHash`.
 */
export function estimateProvenance(
  tax?: TaxEstimateResult | TaxEstimateWithBasis | null,
): SnapshotRuleProvenance | null {
  if (!tax || tax.status !== 'computed') return null;
  return describeSnapshotRuleProvenance(tax.snapshot);
}

/**
 * The action surface, as a projection of the attention model. Kept under this name because it is the
 * entry point the tests and any external caller reach for; it no longer computes anything of its own.
 */
export function getActionItems(
  data: AppData,
  instant: Date = now(),
  tax: TaxEstimateResult | null = null,
): AttentionItem[] {
  const asOfDate = isoToday(instant);
  const snapshot = buildSnapshot(data, asOfDate, tax);
  return getAttentionItems(data, snapshot, tax ?? undefined).actions;
}

export interface LegislationItem {
  id: string;
  source: string;
  /** Optional: the rule package records when a change is in force, not when it was published. */
  publishedDate?: string;
  effectiveDate: string;
  /** `PAST` is a window that has already closed — a superseded vintage, not a live change. */
  status: 'CURRENT' | 'UPCOMING' | 'PAST';
  affectedArea: string;
  summary: string;
  /**
   * TASK 8 — the half that makes a published change worth reading: whether it lands on THIS user in
   * THIS fiscal year. A change that is in force and changes nothing for the taxpayer is a different
   * sentence from one that does, and the old card had only the first.
   */
  impact: {
    affects: 'yes' | 'no' | 'unknown';
    note: string;
  };
  /**
   * TASK 9 — the rule package these rows were read out of, and whether its recorded digest verifies.
   * The card's `source` names the act; this says which registered rule set the app actually applied and
   * whether that rule set still hashes to what the calculation recorded. Optional so a fixture can
   * describe a card without inventing a calculation behind it.
   */
  provenance?: SnapshotRuleProvenance | null;
}

export interface LegislationState {
  updatedAt: string | null;
  items: LegislationItem[];
  /**
   * TASK 8 — whether anything verified these items at all. `unavailable` means there is no monitor: no
   * ingestion, no source checked. The section must say that, because „no verified change” and „nothing
   * is being watched” are different statements and only the first one reassures the user.
   */
  monitor: 'active' | 'unavailable';
}

/**
 * CF art. 135¹ alin. (3) — the anchor for every annual SM multiple in the fiscal year. Verified verbatim
 * in `docs/ai/research/25_pension_cass_exception_2026.md` (legislatie.just.ro 171282, as amended by
 * OUG 128/2024 art. I pct. 19) and recorded in `docs/ai/phases/02_fiscal_baseline.md`; the rule package
 * carries the same anchor on its CAS and CASS rules (`sourceArticle`).
 */
const SM_ANCHOR_CITATION = 'art. 135¹ alin. (3)';

/**
 * What the app can report with no monitor: the minimum-wage vintages its own rule package carries, and
 * whether each one re-anchors the fiscal year.
 *
 * It does not. art. 135¹ alin. (3) takes „valoarea … în vigoare la data de 1 ianuarie a anului de
 * realizare a venitului”, „indiferent dacă în cursul aceluiași an se utilizează mai multe valori”. So
 * HG 146/2026 — 4.325 lei from 1 iulie 2026 — is in force, and the FY2026 thresholds still measure
 * against the 1 January value. Saying only „the minimum wage rose” would leave the user to guess the
 * part that matters; saying only „it does not affect you” would hide a real published change.
 */
function rulePackageLegislation(
  data: AppData,
  asOfDate: string,
  provenance: SnapshotRuleProvenance | null,
): LegislationItem[] {
  const rules = selectionRules(data, asOfDate);
  const taxYear = data.profile.fiscalYear;
  return readMinimumWageVintages(rules, taxYear).map((v) => {
    const isAnchor = v.from <= `${taxYear}-01-01`;
    const status: LegislationItem['status'] =
      v.from > asOfDate ? 'UPCOMING' : v.to !== null && v.to < asOfDate ? 'PAST' : 'CURRENT';
    return {
      id: `sm-vintage-${v.from}`,
      source: v.act,
      effectiveDate: v.from,
      status,
      affectedArea: legislationCopy.minimumWageArea,
      summary: legislationCopy.minimumWageSummary(formatBaniLei(v.valueBani), v.from, v.act),
      provenance,
      impact: isAnchor
        ? {
            affects: 'yes',
            note: legislationCopy.minimumWageAnchor(taxYear, SM_ANCHOR_CITATION, v.from),
          }
        : {
            affects: 'no',
            note: legislationCopy.minimumWageNoImpact(taxYear, SM_ANCHOR_CITATION),
          },
    };
  });
}

export function getLegislationState(
  data: AppData,
  asOfDate: string,
  provenance: SnapshotRuleProvenance | null = null,
): LegislationState {
  // AppData has no legislation data — there is no ingestion and no monitor, and that is what the
  // section has to say. What is reported here is narrower and honest: the changes the rule package
  // under this calculation already carries, each with whether it re-anchors this fiscal year.
  return {
    updatedAt: null,
    monitor: 'unavailable',
    items: rulePackageLegislation(data, asOfDate, provenance),
  };
}

/**
 * The snapshot's coarse threshold family. The ladder step must survive into the snapshot because
 * `insights.ts` reads this field to word the alert — crossing a tier floor is not a limit breach
 * (CF art. 148 alin. (2) lit. b) raises a FLOOR). Everything else keeps the previous vat/income split.
 */
function snapshotThresholdType(t: FiscalThreshold): 'income' | 'vat' | 'tier-floor' {
  if (t.affectedTax === 'vat') return 'vat';
  if (t.type === 'tier-floor') return 'tier-floor';
  return 'income';
}

function buildSnapshot(
  data: AppData,
  asOfDate: string,
  tax: TaxEstimateResult | null,
  coverage: readonly EstimateCoverageGap[] = [],
  deadlineRows: DeadlineView[] = [],
): DashboardSnapshotView {
  const taxYear = data.profile.fiscalYear;
  const filingTerm = deadlineRows.find((d) => d.eventType === 'd212_filing')?.date ?? null;
  const completeness = assessCompleteness(data, coverage, asOfDate, filingTerm);
  // PG-5: a term the dataset already discharges leaves this list. `insights.ts` builds the
  // „Termen depășit” row out of exactly these rows, so before PG-5 a profile that filed the FY2026
  // return on time still got a high-priority overdue item after 25 May 2027 — the record of the filing
  // existed, and nothing consulted it. Dropping the discharged term here keeps ONE producer for the
  // deadline family (insights) instead of adding a second one that knows about filings.
  const deadlines = deadlineRows.filter((d) => !d.done);
  const ytd = selectYtd(ledgerOf(data).data, asOfDate);
  // Single source for both the snapshot rows and `DashboardData.thresholds` — the inline
  // duplicate that used to live here is what let the two paths drift.
  const thresholds = getThresholdStatuses(data, asOfDate, tax);
  // Reserve read site #2. It used to hardcode `createTaxReserveState(null)`, which is why the
  // „Rezervă fiscală sub țintă” warning could never be cleared: even with a recorded reserve, this
  // path reported nothing reserved. Same persisted value as site #1, same already-computed `tax`.
  const reserve = computeTaxReserve(tax, createTaxReserveState(data.reservedAmount), {
    asOfDate,
    fiscalYear: taxYear,
  });

  return {
    asOf: asOfDate,
    taxYear,
    pfaRevenue: ytd.revenue,
    missing: completeness.checks.filter((c) => !c.satisfied).map((c) => c.key),
    stale: [],
    deadlines: deadlines.map((d) => ({
      id: d.deadlineId,
      label: d.appliesTo,
      daysUntil: d.date ? daysBetween(asOfDate, d.date) : 0,
      date: d.date ?? '',
    })),
    thresholds: thresholds.map((t) => ({
      id: t.thresholdId,
      label: t.affectedDomain,
      current: t.currentValue,
      limit: t.thresholdValue,
      ratio:
        t.thresholdValue === 0 || t.currentValue === null
          ? 0
          : t.currentValue / t.thresholdValue,
      // B-20: driven off the DOMAIN status, not re-derived from `distance` here.
      // `distance` is `currentValue - thresholdValue`, so for a `min-base` (floor) row being *below*
      // the floor is a breach — `distance < 0`. The old `distance > 0` inverted exactly the floor
      // rows (CAS_MIN_BASE / CASS_MIN_BASE), so `breached` contradicted `thresholds.ts` `statusFor`,
      // which already branches on the threshold type. `insights.ts` filters on this flag, which is
      // why two real breaches were missing from Observații while Praguri showed `Depășit`.
      breached: t.status === 'breached',
      type: snapshotThresholdType(t),
      affectedTax: t.affectedTax,
      // TASK 4: the semantic fields travel through the flattening instead of being re-invented
      // downstream. `insights.ts` used to derive its own severity from `breached` + `ratio >= 0.8`
      // and to re-write the CF citation in a second file; both decisions now have exactly one home.
      kind: t.kind,
      engaged: t.engaged,
      severity: t.severity,
      consequence: t.consequence,
      reviewReason: t.reviewReason,
    })),
    // No unit conversion here. `reserve` is already in bani and the snapshot contract is in bani; the
    // `* 100` that used to sit on these lines was a lei→cents bridge that, with the domain now storing
    // bani, would have scaled every amount by 100 twice.
    taxReserve: {
      projectedLiabilityBani: reserve.estimatedTaxLiability ?? (0 as Bani),
      targetReserveBani: reserve.remainingTarget,
      // The snapshot aggregate is a numeric cash-planning aggregate, so an unrecorded reserve counts
      // as 0 *in the arithmetic only* — exactly what `computeTaxReserve` already does for
      // `remainingTarget`. The tri-state itself is not collapsed anywhere a user reads: the card
      // renders `TaxReserveRecommendation.reservedAmount`, which stays `null`. Nothing consumes
      // `currentReserveBani` for display (insights.ts reads `projectedLiabilityBani` and `gapBani`).
      currentReserveBani: reserve.reservedAmount ?? (0 as Bani),
      gapBani: reserve.remainingTarget,
      coverageMonths: reserve.monthsRemaining,
      projectedQ4LiabilityBani: 0 as Bani,
      taxYear,
    },
  };
}

export function buildDashboardData(
  data: AppData,
  tax: TaxEstimateResult | TaxEstimateWithBasis | null,
  instant: Date = now(),
): DashboardData {
  // Normalise once, here, so every consumer of `DashboardData.tax` can read a basis. A result that
  // never had one is labelled `unknown` rather than assumed projected or assumed actual. A `null`
  // stays `null`: it is the absence of a calculation, and `estimateState` says so.
  const estimate = tax === null ? null : withEstimateBasis(tax);
  const asOfDate = isoToday(instant);
  // PG-1, landmine 2: the ledger is disclosed ONCE here, and the FX half of the coverage is read off
  // that disclosure instead of walking the records for a second time. A second currency pass would
  // drift from the first the moment either changed, which is what Phase 10c's handoff warned about.
  const ledger = getLedgerDisclosure(data);
  const coverage: EstimateCoverageGap[] = [
    ...selectEstimateCoverage(data, asOfDate, selectionRules(data, asOfDate)),
    ...coverageFromUnconverted(ledger.unconverted),
    // PG-6a — a scenario whose effect is `incomplete` joins this same list rather than starting a second
    // warning surface beside it (brief 28 §0 rule 6). It is projected onto the `fact_missing` reason PG-1
    // reserved for exactly this, so the badge, the rows, the attention items and the weighted percentage
    // all keep reading one channel. The scenarios themselves were produced once, by the assembler, and
    // travel here on the estimate; nothing in this file runs the registry.
    ...scenarioCoverageGaps(estimate?.scenarios ?? []),
  ];
  // PG-5: the deadline engine runs ONCE per build. The card, the snapshot's attention rows and the
  // completeness check's filing term all read this one list, so they cannot disagree about whether a
  // term exists or whether it has been discharged.
  const deadlineRows = getDeadlineRows(data, asOfDate);
  const filingTerm = deadlineRows.find((d) => d.eventType === 'd212_filing')?.date ?? null;
  const snapshot = buildSnapshot(data, asOfDate, estimate, coverage, deadlineRows);
  const attention = getAttentionItems(data, snapshot, estimate ?? undefined);
  return {
    taxYear: data.profile.fiscalYear,
    snapshot,
    tax: estimate,
    estimateState: estimateStateOf(estimate, coverage),
    inputVat: estimate?.inputVat ?? null,
    vatPeriodicity: getVatPeriodicity(data),
    vatObligations: getVatObligations(data, asOfDate),
    year: fiscalYearView(data, asOfDate, instant),
    coverage,
    thresholds: getThresholdStatuses(data, asOfDate, estimate),
    deadlines: deadlineRows.filter((d) => classifyDeadline(d, asOfDate) === 'upcoming'),
    completeness: getDataCompleteness(data, coverage, asOfDate, filingTerm),
    actions: attention.actions,
    reserve: getTaxReserve(data, asOfDate, estimate),
    insights: attention.observations,
    pendingCounts: getPendingCounts(data),
    ledger,
    legislation: getLegislationState(data, asOfDate, estimateProvenance(estimate)),
    provenance: estimateProvenance(estimate),
  };
}
