/**
 * Step 17 — Dashboard intelligence: insight events.
 *
 * Pure, deterministic domain module. No React, no DOM, no localStorage,
 * no store, no randomness, no timestamps: the same input always produces
 * the same output.
 *
 * `buildInsights` inspects a `DashboardSnapshot` (plus optional context)
 * and emits `Insight` events for the dashboard intelligence panel.
 */

import type { DashboardSnapshot } from './aggregation.js';
import type { Expense } from '../data/types.js';

export type InsightSeverity = 'info' | 'warning' | 'danger';
export type InsightPriority = 'low' | 'medium' | 'high';

export type InsightEventType =
  | 'INCOME_THRESHOLD_APPROACHING'
  | 'MISSING_DOCUMENTS'
  | 'VAT_THRESHOLD_APPROACHING'
  | 'DEADLINE_APPROACHING'
  | 'DATA_INCOMPLETE'
  | 'TAX_ESTIMATE_CHANGED'
  | 'LEGISLATION_CHANGED'
  | 'PROJECTED_TAX_INCREASE'
  | 'PROJECTED_REVENUE_DROP'
  | 'STRUCTURE_COMPARISON_RELEVANT'
  | 'UNUSUAL_EXPENSE'
  | 'RESERVE_BEHIND';

export interface Insight {
  id: string;
  eventType: InsightEventType;
  severity: InsightSeverity;
  priority: InsightPriority;
  title: string;
  description: string;
  action: string;
  conditions: Record<string, number | string | boolean>;
}

export interface InsightInput {
  snapshot: DashboardSnapshot;
  /** Current projected tax estimate, in cents. */
  currentTaxEstimateCents?: number;
  /** Previous projected tax estimate, in cents. */
  previousTaxEstimateCents?: number;
  /** Revenue from the previous month, in cents. */
  previousMonthRevenueCents?: number;
  /** Revenue from the current month, in cents. */
  currentMonthRevenueCents?: number;
  /** ISO date of the latest legislation change, if any. */
  legislationChangeDate?: string;
  /** Recent expenses, used for unusual-expense detection. */
  expenses?: Expense[];
}

/** Round to one decimal place (deterministic). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Ratio as a percentage, rounded to one decimal. */
function pctOf(ratio: number): number {
  return round1(ratio * 100);
}

export function buildInsights(input: InsightInput): Insight[] {
  const { snapshot } = input;
  const insights: Insight[] = [];

  // 1. INCOME_THRESHOLD_APPROACHING — income thresholds within 20% of the limit.
  for (const t of snapshot.thresholds) {
    if (t.type !== 'income' || t.breached || t.ratio < 0.8) continue;
    const danger = t.ratio >= 0.95;
    insights.push({
      id: `income-threshold:${t.id}`,
      eventType: 'INCOME_THRESHOLD_APPROACHING',
      severity: danger ? 'danger' : 'warning',
      priority: danger ? 'high' : 'medium',
      title: `Income threshold approaching: ${t.label}`,
      description: `YTD income is at ${pctOf(t.ratio)}% of the ${t.label} limit (${t.current} of ${t.limit} cents).`,
      action: danger
        ? 'Review your income trajectory and consider structure options before year end.'
        : 'Monitor your income against this threshold; a structure change may be worthwhile soon.',
      conditions: { current: t.current, limit: t.limit, ratio: t.ratio },
    });
  }

  // 2. MISSING_DOCUMENTS — one insight per missing field.
  for (const field of snapshot.missing) {
    insights.push({
      id: `missing:${field}`,
      eventType: 'MISSING_DOCUMENTS',
      severity: 'warning',
      priority: 'high',
      title: `Missing document: ${field}`,
      description: `The "${field}" field is missing and may affect your filings.`,
      action: `Fill in the missing "${field}" data in your business profile.`,
      conditions: { field },
    });
  }

  // 2b. DATA_INCOMPLETE — aggregate data-completeness signal (one insight,
  //     summarizing all missing fields; distinct from the per-field
  //     MISSING_DOCUMENTS insights above).
  if (snapshot.missing.length > 0) {
    insights.push({
      id: 'data-incomplete',
      eventType: 'DATA_INCOMPLETE',
      severity: 'warning',
      priority: 'medium',
      title: 'Profile data incomplete',
      description: `${snapshot.missing.length} profile field${
        snapshot.missing.length === 1 ? '' : 's'
      } missing: ${snapshot.missing.join(', ')}.`,
      action: 'Complete your business profile so filings can be prepared accurately.',
      conditions: {
        missingCount: snapshot.missing.length,
        fields: snapshot.missing.join(', '),
      },
    });
  }

  // 3. VAT_THRESHOLD_APPROACHING — VAT thresholds within 20% of the limit.
  for (const t of snapshot.thresholds) {
    if (t.type !== 'vat' || t.breached || t.ratio < 0.8) continue;
    const danger = t.ratio >= 0.95;
    insights.push({
      id: `vat-threshold:${t.id}`,
      eventType: 'VAT_THRESHOLD_APPROACHING',
      severity: danger ? 'danger' : 'warning',
      priority: danger ? 'high' : 'medium',
      title: `VAT threshold approaching: ${t.label}`,
      description: `YTD turnover is at ${pctOf(t.ratio)}% of the ${t.label} limit (${t.current} of ${t.limit} cents).`,
      action: danger
        ? 'VAT registration is imminent — prepare for periodic VAT filings.'
        : 'Monitor your turnover against this threshold; VAT registration may be required soon.',
      conditions: { current: t.current, limit: t.limit, ratio: t.ratio },
    });
  }

  // 4. DEADLINE_APPROACHING — deadlines within 30 days (overdue included).
  for (const d of snapshot.deadlines) {
    if (d.daysUntil > 30) continue;
    const danger = d.daysUntil <= 7;
    insights.push({
      id: `deadline:${d.id}`,
      eventType: 'DEADLINE_APPROACHING',
      severity: danger ? 'danger' : 'warning',
      priority: danger ? 'high' : 'medium',
      title: `Tax deadline approaching: ${d.label}`,
      description: `The "${d.label}" deadline is in ${d.daysUntil} days (${d.date}).`,
      action: danger
        ? 'Prepare this filing immediately — the deadline is within a week.'
        : 'Plan to complete this filing within the next 30 days.',
      conditions: { daysUntil: d.daysUntil, date: d.date },
    });
  }

  // 5. TAX_ESTIMATE_CHANGED — estimate moved >= 10% vs previous.
  const { currentTaxEstimateCents, previousTaxEstimateCents } = input;
  if (
    typeof currentTaxEstimateCents === 'number' &&
    typeof previousTaxEstimateCents === 'number' &&
    previousTaxEstimateCents !== 0
  ) {
    const pctChange = round1(
      ((currentTaxEstimateCents - previousTaxEstimateCents) / previousTaxEstimateCents) * 100,
    );
    if (Math.abs(pctChange) >= 10) {
      const direction = pctChange > 0 ? 'increased' : 'decreased';
      insights.push({
        id: 'tax-estimate-changed',
        eventType: 'TAX_ESTIMATE_CHANGED',
        severity: 'warning',
        priority: 'high',
        title: 'Tax estimate changed significantly',
        description: `Your tax estimate ${direction} by ${Math.abs(pctChange)}% (from ${previousTaxEstimateCents} to ${currentTaxEstimateCents} cents).`,
        action: 'Review what changed in your income or expenses and adjust your tax reserve.',
        conditions: {
          previousCents: previousTaxEstimateCents,
          currentCents: currentTaxEstimateCents,
          pctChange,
        },
      });
    }
  }

  // 6. LEGISLATION_CHANGED — legislation changed since last review.
  if (typeof input.legislationChangeDate === 'string' && input.legislationChangeDate.length > 0) {
    insights.push({
      id: 'legislation-changed',
      eventType: 'LEGISLATION_CHANGED',
      severity: 'info',
      priority: 'low',
      title: 'Legislation updated',
      description: `Tax legislation changed on ${input.legislationChangeDate}.`,
      action: 'Review the updated rules to see how they affect your tax position.',
      conditions: { date: input.legislationChangeDate },
    });
  }

  // 7. PROJECTED_TAX_INCREASE — estimate up by >= 5,000,000 cents (50,000 lei).
  if (
    typeof currentTaxEstimateCents === 'number' &&
    typeof previousTaxEstimateCents === 'number' &&
    currentTaxEstimateCents - previousTaxEstimateCents >= 500000
  ) {
    const increaseCents = currentTaxEstimateCents - previousTaxEstimateCents;
    insights.push({
      id: 'projected-tax-increase',
      eventType: 'PROJECTED_TAX_INCREASE',
      severity: 'warning',
      priority: 'high',
      title: 'Projected tax increase',
      description: `Your projected tax liability increased by ${increaseCents} cents.`,
      action: 'Increase your monthly tax reserve to cover the higher liability.',
      conditions: { increaseCents },
    });
  }

  // 8. PROJECTED_REVENUE_DROP — revenue down >= 30% month over month.
  const { previousMonthRevenueCents, currentMonthRevenueCents } = input;
  if (
    typeof previousMonthRevenueCents === 'number' &&
    typeof currentMonthRevenueCents === 'number' &&
    previousMonthRevenueCents > 0
  ) {
    const dropPct = round1(
      ((previousMonthRevenueCents - currentMonthRevenueCents) / previousMonthRevenueCents) * 100,
    );
    if (dropPct >= 30) {
      insights.push({
        id: 'projected-revenue-drop',
        eventType: 'PROJECTED_REVENUE_DROP',
        severity: 'warning',
        priority: 'high',
        title: 'Projected revenue drop',
        description: `Revenue dropped by ${dropPct}% (from ${previousMonthRevenueCents} to ${currentMonthRevenueCents} cents).`,
        action: 'Review your cash flow and consider adjusting your spending plan.',
        conditions: {
          previousCents: previousMonthRevenueCents,
          currentCents: currentMonthRevenueCents,
          dropPct,
        },
      });
    }
  }

  // 9. STRUCTURE_COMPARISON_RELEVANT — CASS threshold within 20% of the limit.
  for (const t of snapshot.thresholds) {
    if (t.affectedTax !== 'cass' || t.breached || t.ratio < 0.8) continue;
    insights.push({
      id: `structure-comparison:${t.id}`,
      eventType: 'STRUCTURE_COMPARISON_RELEVANT',
      severity: 'info',
      priority: 'medium',
      title: `Structure comparison relevant: ${t.label}`,
      description: `You are at ${pctOf(t.ratio)}% of the ${t.label} limit — comparing PFA vs SRL structures may be worthwhile.`,
      action: 'Run a PFA vs SRL structure comparison to see the potential savings.',
      conditions: { current: t.current, limit: t.limit, ratio: t.ratio },
    });
  }

  // 10. UNUSUAL_EXPENSE — expense amount > mean + 3*std.
  const expenses = input.expenses;
  if (expenses && expenses.length >= 2) {
    const amounts = expenses.map((e) => e.valoareFaraTva + e.tva);
    const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const variance = amounts.reduce((sum, a) => sum + (a - mean) * (a - mean), 0) / amounts.length;
    const std = Math.sqrt(variance);
    for (let i = 0; i < amounts.length; i++) {
      if (amounts[i] > mean + 3 * std) {
        insights.push({
          id: `unusual-expense:${i}`,
          eventType: 'UNUSUAL_EXPENSE',
          severity: 'danger',
          priority: 'high',
          title: 'Unusual expense detected',
          description: `An expense of ${amounts[i]} cents is more than 3 standard deviations above the mean (${Math.round(mean)} cents).`,
          action: 'Verify this expense is legitimate and correctly categorized.',
          conditions: {
            amountCents: amounts[i],
            meanCents: Math.round(mean),
            stdCents: Math.round(std),
          },
        });
      }
    }
  }

  // 11. RESERVE_BEHIND — reserve gap or coverage below 3 months.
  const reserve = snapshot.taxReserve;
  if (reserve.gapCents > 0 || reserve.coverageMonths < 3) {
    insights.push({
      id: 'reserve-behind',
      eventType: 'RESERVE_BEHIND',
      severity: 'warning',
      priority: 'high',
      title: 'Tax reserve behind schedule',
      description: `You are ${reserve.gapCents} cents short of your reserve target with ${reserve.coverageMonths} months of coverage.`,
      action: 'Increase your monthly reserve contribution to close the gap.',
      conditions: { gapCents: reserve.gapCents, coverageMonths: reserve.coverageMonths },
    });
  }

  return insights;
}
