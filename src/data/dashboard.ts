import type { AppData } from './types';
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
  selectEstimateOperands,
  withEstimateBasis,
  type TaxEstimateWithBasis,
} from '../domain/estimateBasis';
import { computeTaxEstimate, type TaxEstimateResult } from '../domain/tax';
import {
  computeThresholds,
  readMinimumWageVintages,
  type FiscalBase,
  type FiscalThreshold,
  type MeasuredBasis,
  type ThresholdBases,
} from '../domain/thresholds';
import { computeDeadlines, filterUpcoming, type Deadline } from '../domain/deadlines';
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
import { localDateISO, now } from '../domain/date';
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
  declarationsInAsteptare: number;
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
 * TASK 8 — the three epistemic states of the tax estimate.
 *
 * `TaxEstimateResult` has two members (`computed` | `review_required`), and the dashboard adapter used
 * to paper over the absence of an estimate with a `review_required` sentinel whose reason was the
 * internal token `loading` — which reached the screen through the chart note. A missing calculation and
 * a refused one are different claims: the first says nothing was produced, the second says the engine
 * ran and withheld a conclusion. `unavailable` is the third state, and it is derived here from the
 * estimate actually being absent, never from a sentinel's reason string.
 */
export type TaxEstimateState = 'computed' | 'review_required' | 'unavailable';

function estimateStateOf(tax: TaxEstimateResult | TaxEstimateWithBasis | null): TaxEstimateState {
  if (tax === null) return 'unavailable';
  return tax.status === 'computed' ? 'computed' : 'review_required';
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
  thresholds: FiscalThreshold[];
  deadlines: Deadline[];
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

export function getDataCompleteness(data: AppData): CompletenessReport {
  return assessCompleteness(data);
}

export function getPendingCounts(data: AppData): PendingCounts {
  return {
    revenuesInAsteptare: data.revenues.filter((r) => r.status === 'in-asteptare').length,
    revenuesRespinsa: data.revenues.filter((r) => r.status === 'respinsa').length,
    expensesRespinsa: data.expenses.filter((e) => e.status === 'respinsa').length,
    declarationsInAsteptare: data.declarations.filter((d) => d.status === 'in-asteptare').length,
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
    return Promise.resolve(attachEstimateBasis(operands.result, operands.basis));
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
    ruleRelease: selection ? selection.release : null,
    rules,
  }).then((result) => attachEstimateBasis(result, basis));
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
    bases['net-income'] = tax.bases.venitulNetDinActivitate;
  }
  return bases;
}

/**
 * TASK 4 — record HOW each supplied amount was produced, so each threshold row can state which
 * basis it measured instead of the reader having to guess.
 *
 * The asymmetry is deliberate and must stay: CF art. 148 / art. 170 / art. 174 measure an ANNUAL
 * value, so the four contribution rows are measured against the engine's annual figure — the
 * projection when the projection model ran, the actuals when it could not (TASK 1). CF art. 310
 * alin. (1) measures the turnover realised in the year so far, so `VAT_REGISTRATION` stays YTD.
 * Unifying them would make one of the two rows state a quantity the law does not measure.
 */
export function buildThresholdBasisProvenance(
  tax: TaxEstimateWithBasis | null,
): Partial<Record<FiscalBase, MeasuredBasis>> {
  if (tax === null) {
    // Nothing was computed, so nothing can be attributed. An empty provenance map makes the rows say
    // they are unmeasured; labelling them `annual-projected` would name a basis that does not exist.
    return {};
  }
  const turnover: MeasuredBasis = 'ytd-turnover';
  let annual: MeasuredBasis = 'unattributed';
  if (tax.basis.kind === 'annual-projected') annual = 'annual-projected';
  else if (tax.basis.kind === 'actuals-only') annual = 'annual-actual';
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

export function getUpcomingDeadlines(data: AppData, asOfDate: string): Deadline[] {
  // Step 31: only applicable upcoming deadlines — past, due-today, and
  // null-dated deadlines are excluded by the domain `filterUpcoming`.
  return filterUpcoming(
    computeDeadlines(selectionRules(data, asOfDate), {
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
      // absent value still produces NO deadline — the engine has no source for the exceedance date
      // and must not invent one. Passing it is a data-model fix, not a rule change.
      pfaStartDate: data.profile.pfaStartDate,
      vatExceedanceDate: data.profile.vatExceedanceDate,
    }),
    asOfDate,
  );
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
): DashboardSnapshotView {
  const taxYear = data.profile.fiscalYear;
  const completeness = assessCompleteness(data);
  const deadlines = computeDeadlines(selectionRules(data, asOfDate), {
    taxYear,
    asOfDate,
    pfaStartDate: data.profile.pfaStartDate,
    // Same query as `getUpcomingDeadlines`: the snapshot and the deadline section must not be able
    // to disagree about whether a VAT registration deadline exists.
    vatExceedanceDate: data.profile.vatExceedanceDate,
  });
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
  const snapshot = buildSnapshot(data, asOfDate, estimate);
  const attention = getAttentionItems(data, snapshot, estimate ?? undefined);
  return {
    taxYear: data.profile.fiscalYear,
    snapshot,
    tax: estimate,
    estimateState: estimateStateOf(estimate),
    thresholds: getThresholdStatuses(data, asOfDate, estimate),
    deadlines: getUpcomingDeadlines(data, asOfDate),
    completeness: getDataCompleteness(data),
    actions: attention.actions,
    reserve: getTaxReserve(data, asOfDate, estimate),
    insights: attention.observations,
    pendingCounts: getPendingCounts(data),
    ledger: getLedgerDisclosure(data),
    legislation: getLegislationState(data, asOfDate, estimateProvenance(estimate)),
    provenance: estimateProvenance(estimate),
  };
}
