import type { AppData } from './types';
import {
  selectYtd,
  selectMonthly,
  auditFiscalDates,
  type YtdTotals,
  type MonthlyTotals,
  type DashboardSnapshot,
} from '../domain/aggregation';
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
import { getInsights as buildInsights, type Insight } from '../domain/insights';
import { selectTaxDerived } from '../domain/derived';
import { selectRuleSet } from '../domain/fiscal';
import type { FiscalRule } from '../domain/fiscal/rules';
import { selectApplicableRules } from '../domain/fiscal/select';
import { localDateISO, now } from '../domain/date';
import type { Bani } from '../domain/money';

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

export interface DashboardSnapshotView extends DashboardSnapshot {
  pfaRevenue: Bani;
}

export interface DashboardData {
  taxYear: number;
  snapshot: DashboardSnapshotView;
  /**
   * The engine's result plus the basis that produced it (`estimateBasis.ts`). A consumer can tell
   * actuals-to-date from run-rate projected without inferring it from a label.
   */
  tax: TaxEstimateWithBasis;
  thresholds: FiscalThreshold[];
  deadlines: Deadline[];
  completeness: CompletenessReport;
  actions: ActionItem[];
  reserve: TaxReserveRecommendation;
  insights: Insight[];
  pendingCounts: PendingCounts;
  legislation: LegislationState;
}

function isoToday(instant: Date = now()): string {
  return localDateISO(instant);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
}

export function getFinancialSummary(data: AppData, asOfDate: string): YtdTotals {
  return selectYtd(data, asOfDate);
}

export function getMonthlyFinancialSeries(data: AppData, asOfDate: string): Map<string, MonthlyTotals> {
  return selectMonthly(data, asOfDate);
}

export function getProjectedFinancialSeries(data: AppData, asOfDate: string): ProjectionV1 {
  return selectProjectionV1(data, asOfDate);
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
export function buildThresholdBases(ytd: YtdTotals, tax: TaxEstimateResult): ThresholdBases {
  const bases: ThresholdBases = {
    'revenue-incl-vat': ytd.revenue,
    'revenue-excl-vat': ytd.revenueNet,
    'expense-incl-vat': ytd.expenses,
    'expense-excl-vat': ytd.expenseNet,
  };
  if (tax.status === 'computed') {
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
  tax: TaxEstimateWithBasis,
): Partial<Record<FiscalBase, MeasuredBasis>> {
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
  tax: TaxEstimateResult | TaxEstimateWithBasis,
): FiscalThreshold[] {
  const ytd = selectYtd(data, asOfDate);
  const estimate = withEstimateBasis(tax);
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
  tax: TaxEstimateResult,
): TaxReserveRecommendation {
  const state = createTaxReserveState(data.reservedAmount);
  return computeTaxReserve(tax, state, {
    asOfDate,
    fiscalYear: data.profile.fiscalYear,
  });
}

export function getInsights(data: AppData, snapshot: DashboardSnapshot, tax?: TaxEstimateResult): Insight[] {
  return buildInsights({
    snapshot,
    expenses: data.expenses,
    tax,
    // B-21: the aggregate excludes records with an unusable date; this is what makes that
    // exclusion visible instead of silent.
    fiscalDateIssues: auditFiscalDates(data),
  });
}

export interface ActionItem {
  id: string;
  label: string;
  source: 'deadline' | 'completeness' | 'tax';
}

export function getActionItems(data: AppData, instant: Date = now()): ActionItem[] {
  const asOfDate = isoToday(instant);
  const items: ActionItem[] = [];

  for (const d of getUpcomingDeadlines(data, asOfDate)) {
    items.push({ id: `deadline-${d.deadlineId}`, label: d.appliesTo, source: 'deadline' });
  }

  for (const c of getDataCompleteness(data).checks.filter((c) => !c.satisfied)) {
    items.push({ id: `completeness-${c.key}`, label: c.key, source: 'completeness' });
  }

  if (selectYtd(data, asOfDate).revenue > 0) {
    items.push({ id: 'tax-review', label: 'Revizuire estimări fiscale', source: 'tax' });
  }

  return items;
}

export interface LegislationItem {
  id: string;
  source: string;
  publishedDate: string;
  effectiveDate: string;
  status: 'CURRENT' | 'UPCOMING';
  affectedArea: string;
  summary: string;
}

export interface LegislationState {
  updatedAt: string | null;
  items: LegislationItem[];
}

export function getLegislationState(data: AppData): LegislationState {
  // AppData has no legislation data — placeholder boundary only, no ingestion.
  void data;
  return { updatedAt: null, items: [] };
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
  tax: TaxEstimateResult,
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
  const ytd = selectYtd(data, asOfDate);
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
  tax: TaxEstimateResult | TaxEstimateWithBasis,
  instant: Date = now(),
): DashboardData {
  // Normalise once, here, so every consumer of `DashboardData.tax` can read a basis. A result that
  // never had one is labelled `unknown` rather than assumed projected or assumed actual.
  const estimate = withEstimateBasis(tax);
  const asOfDate = isoToday(instant);
  const snapshot = buildSnapshot(data, asOfDate, estimate);
  return {
    taxYear: data.profile.fiscalYear,
    snapshot,
    tax: estimate,
    thresholds: getThresholdStatuses(data, asOfDate, estimate),
    deadlines: getUpcomingDeadlines(data, asOfDate),
    completeness: getDataCompleteness(data),
    actions: getActionItems(data, instant),
    reserve: getTaxReserve(data, asOfDate, estimate),
    insights: getInsights(data, snapshot, estimate),
    pendingCounts: getPendingCounts(data),
    legislation: getLegislationState(data),
  };
}
