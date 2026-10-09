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
  type FiscalThreshold,
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
import { PFA_2026_RELEASE, PFA_2026_SYSTEM_REAL_PACKAGE } from '../domain/fiscal';
import { localDateISO, now } from '../domain/date';
import type { Bani } from '../domain/money';

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
  const operands = selectEstimateOperands(data, asOfDate, PFA_2026_SYSTEM_REAL_PACKAGE);
  if (operands.kind === 'refused') {
    return Promise.resolve(attachEstimateBasis(operands.result, operands.basis));
  }
  const { basis, amounts } = operands;
  const derived = selectTaxDerived(data, PFA_2026_SYSTEM_REAL_PACKAGE);
  return computeTaxEstimate({
    inputs: derived.inputs,
    profile: data.profile,
    revenues: amounts.revenues,
    expenses: amounts.expenses,
    revenuesNet: amounts.revenuesNet,
    expensesNet: amounts.expensesNet,
    ruleRelease: PFA_2026_RELEASE,
    rules: PFA_2026_SYSTEM_REAL_PACKAGE,
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

export function getThresholdStatuses(
  data: AppData,
  asOfDate: string,
  tax: TaxEstimateResult,
): FiscalThreshold[] {
  const ytd = selectYtd(data, asOfDate);
  return computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, {
    taxYear: data.profile.fiscalYear,
    asOfDate,
    bases: buildThresholdBases(ytd, tax),
    ruleRelease: PFA_2026_RELEASE.ruleIds[0],
  });
}

export function getUpcomingDeadlines(data: AppData, asOfDate: string): Deadline[] {
  // Step 31: only applicable upcoming deadlines — past, due-today, and
  // null-dated deadlines are excluded by the domain `filterUpcoming`.
  return filterUpcoming(
    computeDeadlines(PFA_2026_SYSTEM_REAL_PACKAGE, {
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

export function getTaxReserve(
  data: AppData,
  asOfDate: string,
  tax: TaxEstimateResult,
): TaxReserveRecommendation {
  const state = createTaxReserveState(null); // honest "no data recorded"
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
  const deadlines = computeDeadlines(PFA_2026_SYSTEM_REAL_PACKAGE, {
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
  const reserve = computeTaxReserve(tax, createTaxReserveState(null), {
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
    })),
    // No unit conversion here. `reserve` is already in bani and the snapshot contract is in bani; the
    // `* 100` that used to sit on these lines was a lei→cents bridge that, with the domain now storing
    // bani, would have scaled every amount by 100 twice.
    taxReserve: {
      projectedLiabilityBani: reserve.estimatedTaxLiability ?? (0 as Bani),
      targetReserveBani: reserve.remainingTarget,
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
