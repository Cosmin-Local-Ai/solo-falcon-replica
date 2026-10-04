import type { AppData, Expense, Revenue } from '../data/types';

/**
 * Deterministic financial aggregation selectors (Step 13, Part A).
 *
 * Pure domain module: no React, no DOM, no localStorage, no store imports.
 * Every function is deterministic for the same (data, asOfDate) inputs.
 *
 * Rules:
 * - Only records with `status === 'inregistrata'` are aggregated.
 * - Record total = `valoareFaraTva + tva` (there is no stored total field).
 * - Fiscal year boundary = `profile.fiscalYear` (calendar year): the
 *   fiscal period starts on `${fiscalYear}-01-01`.
 * - `asOfDate` (ISO 'YYYY-MM-DD') is the inclusive upper bound of the period.
 */

export interface YtdTotals {
  revenue: number;
  expenses: number;
  net: number;
  /** Total revenues without VAT (valoareFaraTva only), lei. */
  revenueNet: number;
  /** Total expenses without VAT (valoareFaraTva only), lei. */
  expenseNet: number;
}

export interface MonthlyTotals {
  revenue: number;
  expenses: number;
  net: number;
}

/**
 * Dashboard-level snapshot consumed by the insights engine (Step 17).
 * Aggregated, presentation-ready view: completeness gaps, near deadlines,
 * threshold breaches, and the tax-reserve position as of `asOf`.
 */
/** Threshold status as surfaced in the dashboard snapshot. */
export interface Threshold {
  id: string;
  label: string;
  current: number;
  limit: number;
  ratio: number;
  breached: boolean;
  /** Which threshold family this belongs to, when known. */
  type?: 'income' | 'vat';
  /** Tax this threshold affects (e.g. 'cass', 'vat'). */
  affectedTax?: string;
}

export interface DashboardSnapshot {
  asOf: string;
  taxYear: number;
  missing: string[];
  stale: string[];
  deadlines: Array<{ id: string; label: string; daysUntil: number; date: string }>;
  thresholds: Threshold[];
  taxReserve: {
    projectedLiabilityCents: number;
    targetReserveCents: number;
    currentReserveCents: number;
    gapCents: number;
    coverageMonths: number;
    projectedQ4LiabilityCents: number;
    taxYear: number;
  };
}

function recordTotal(r: Pick<Revenue, 'valoareFaraTva' | 'tva'>): number {
  return r.valoareFaraTva + r.tva;
}

function inFiscalYear(date: string, fiscalYear: number): boolean {
  return Number(date.slice(0, 4)) === fiscalYear;
}

export function inPeriod(date: string, asOfDate: string, fiscalYear: number): boolean {
  // ISO 'YYYY-MM-DD' strings compare lexicographically == chronologically.
  return inFiscalYear(date, fiscalYear) && date <= asOfDate;
}

function monthKey(date: string): string {
  return date.slice(0, 7); // 'YYYY-MM'
}

/**
 * Year-to-date totals for the fiscal year `data.profile.fiscalYear`,
 * from `${fiscalYear}-01-01` up to and including `asOfDate`.
 */
export function selectYtd(data: AppData, asOfDate: string): YtdTotals {
  const fiscalYear = data.profile.fiscalYear;
  let revenue = 0;
  let expenses = 0;
  let revenueNet = 0;
  let expenseNet = 0;

  for (const r of data.revenues) {
    if (r.status === 'inregistrata' && inPeriod(r.date, asOfDate, fiscalYear)) {
      revenue += recordTotal(r);
      revenueNet += r.valoareFaraTva;
    }
  }
  for (const e of data.expenses) {
    if (e.status === 'inregistrata' && inPeriod(e.date, asOfDate, fiscalYear)) {
      expenses += recordTotal(e);
      expenseNet += e.valoareFaraTva;
    }
  }

  return { revenue, expenses, net: revenue - expenses, revenueNet, expenseNet };
}

/**
 * Monthly breakdown (keys 'YYYY-MM') of the same YTD period:
 * `${fiscalYear}-01-01` up to and including `asOfDate`.
 */
export function selectMonthly(data: AppData, asOfDate: string): Map<string, MonthlyTotals> {
  const fiscalYear = data.profile.fiscalYear;
  const monthly = new Map<string, MonthlyTotals>();

  const add = (key: string, field: 'revenue' | 'expenses', amount: number): void => {
    const entry = monthly.get(key) ?? { revenue: 0, expenses: 0, net: 0 };
    entry[field] += amount;
    entry.net = entry.revenue - entry.expenses;
    monthly.set(key, entry);
  };

  for (const r of data.revenues) {
    if (r.status === 'inregistrata' && inPeriod(r.date, asOfDate, fiscalYear)) {
      add(monthKey(r.date), 'revenue', recordTotal(r));
    }
  }
  for (const e of data.expenses) {
    if (e.status === 'inregistrata' && inPeriod(e.date, asOfDate, fiscalYear)) {
      add(monthKey(e.date), 'expenses', recordTotal(e));
    }
  }

  return monthly;
}
