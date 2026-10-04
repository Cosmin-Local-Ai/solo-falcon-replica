import type { AppData } from './types';
import {
  selectYtd,
  selectMonthly,
  type YtdTotals,
  type MonthlyTotals,
  type DashboardSnapshot,
} from '../domain/aggregation';
import { assessCompleteness, type CompletenessReport } from '../domain/completeness';
import { selectProjectionV1, type ProjectionV1 } from '../domain/projection';
import { computeTaxEstimate, type TaxEstimateResult } from '../domain/tax';
import { computeThresholds, type FiscalThreshold } from '../domain/thresholds';
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

export interface PendingCounts {
  revenuesInAsteptare: number;
  revenuesRespinsa: number;
  expensesRespinsa: number;
  declarationsInAsteptare: number;
}

export interface DashboardSnapshotView extends DashboardSnapshot {
  pfaRevenue: number;
}

export interface DashboardData {
  taxYear: number;
  snapshot: DashboardSnapshotView;
  tax: TaxEstimateResult;
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

export function getTaxEstimate(data: AppData, asOfDate: string): Promise<TaxEstimateResult> {
  const ytd = selectYtd(data, asOfDate);
  const derived = selectTaxDerived(data, PFA_2026_SYSTEM_REAL_PACKAGE);
  return computeTaxEstimate({
    inputs: derived.inputs,
    profile: data.profile,
    revenues: ytd.revenue,
    expenses: ytd.expenses,
    revenuesNet: ytd.revenueNet,
    expensesNet: ytd.expenseNet,
    ruleRelease: PFA_2026_RELEASE,
    rules: PFA_2026_SYSTEM_REAL_PACKAGE,
  });
}

export function getThresholdStatuses(data: AppData, asOfDate: string): FiscalThreshold[] {
  const ytd = selectYtd(data, asOfDate);
  return computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, {
    taxYear: data.profile.fiscalYear,
    asOfDate,
    currentValue: ytd.revenue,
    fiscalBase: 'gross-revenue',
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

function buildSnapshot(
  data: AppData,
  asOfDate: string,
  tax: TaxEstimateResult,
): DashboardSnapshotView {
  const taxYear = data.profile.fiscalYear;
  const completeness = assessCompleteness(data);
  const deadlines = computeDeadlines(PFA_2026_SYSTEM_REAL_PACKAGE, { taxYear, asOfDate });
  const ytd = selectYtd(data, asOfDate);
  const thresholds = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, {
    taxYear,
    asOfDate,
    currentValue: ytd.revenue,
    fiscalBase: 'gross-revenue',
    ruleRelease: PFA_2026_RELEASE.ruleIds[0],
  });
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
      ratio: t.thresholdValue === 0 ? 0 : t.currentValue / t.thresholdValue,
      breached: t.distance > 0,
      type: t.affectedTax === 'vat' ? 'vat' : 'income',
      affectedTax: t.affectedTax,
    })),
    taxReserve: {
      projectedLiabilityCents: (reserve.estimatedTaxLiability ?? 0) * 100,
      targetReserveCents: reserve.remainingTarget * 100,
      currentReserveCents: (reserve.reservedAmount ?? 0) * 100,
      gapCents: reserve.remainingTarget * 100,
      coverageMonths: reserve.monthsRemaining,
      projectedQ4LiabilityCents: 0,
      taxYear,
    },
  };
}

export function buildDashboardData(data: AppData, tax: TaxEstimateResult, instant: Date = now()): DashboardData {
  const asOfDate = isoToday(instant);
  const snapshot = buildSnapshot(data, asOfDate, tax);
  return {
    taxYear: data.profile.fiscalYear,
    snapshot,
    tax,
    thresholds: getThresholdStatuses(data, asOfDate),
    deadlines: getUpcomingDeadlines(data, asOfDate),
    completeness: getDataCompleteness(data),
    actions: getActionItems(data, instant),
    reserve: getTaxReserve(data, asOfDate, tax),
    insights: getInsights(data, snapshot, tax),
    pendingCounts: getPendingCounts(data),
    legislation: getLegislationState(data),
  };
}
