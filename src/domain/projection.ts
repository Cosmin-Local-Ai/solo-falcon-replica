import type { AppData } from '../data/types';
import { selectMonthly, selectYtd } from './aggregation';

/**
 * Projection v1 — transparent current run rate (Step 13, Part B).
 *
 * Pure domain module: no React, no DOM, no localStorage, no store imports.
 * Deterministic for the same (data, asOfDate) inputs. No ML, no statistical
 * forecasting, no tax logic. The method is exactly:
 *
 *   run rate   = YTD totals / elapsed months (fiscal-year start → asOfDate,
 *                inclusive of both end months)
 *   annual     = run rate × 12
 *
 * Every projected value is explicitly tagged: series entries carry
 * `kind: 'projected'`, and annual totals live under `annualProjected`.
 */

export interface ProjectionPeriod {
  from: string; // 'YYYY-MM-DD'
  to: string; // 'YYYY-MM-DD'
}

export interface RunRate {
  revenuePerMonth: number;
  expensesPerMonth: number;
  netPerMonth: number;
}

export interface Totals {
  revenue: number;
  expenses: number;
  net: number;
}

export interface ProjectionMonth extends Totals {
  month: string; // 'YYYY-MM'
  kind: 'actual' | 'projected';
}

export interface ProjectionV1 {
  periodActual: ProjectionPeriod;
  runRate: RunRate;
  annualProjected: Totals;
  series: ProjectionMonth[];
  method: 'run-rate-v1';
}

function elapsedMonths(fiscalYear: number, asOfDate: string): number {
  const asOfYear = Number(asOfDate.slice(0, 4));
  const asOfMonth = Number(asOfDate.slice(5, 7));
  return (asOfYear - fiscalYear) * 12 + (asOfMonth - 1) + 1;
}

export function selectProjectionV1(data: AppData, asOfDate: string): ProjectionV1 {
  const fiscalYear = data.profile.fiscalYear;
  const months = elapsedMonths(fiscalYear, asOfDate);
  const denom = months > 0 ? months : 0;

  const ytd = selectYtd(data, asOfDate);
  const runRate: RunRate = {
    revenuePerMonth: denom > 0 ? ytd.revenue / denom : 0,
    expensesPerMonth: denom > 0 ? ytd.expenses / denom : 0,
    netPerMonth: denom > 0 ? ytd.net / denom : 0,
  };

  const annualProjected: Totals = {
    revenue: runRate.revenuePerMonth * 12,
    expenses: runRate.expensesPerMonth * 12,
    net: runRate.netPerMonth * 12,
  };

  const monthly = selectMonthly(data, asOfDate);
  const asOfMonth = asOfDate.slice(0, 7);
  const series: ProjectionMonth[] = [];
  for (let m = 1; m <= 12; m++) {
    const month = `${fiscalYear}-${String(m).padStart(2, '0')}`;
    if (month <= asOfMonth) {
      const actual = monthly.get(month) ?? { revenue: 0, expenses: 0, net: 0 };
      series.push({ month, ...actual, kind: 'actual' });
    } else {
      series.push({
        month,
        revenue: runRate.revenuePerMonth,
        expenses: runRate.expensesPerMonth,
        net: runRate.netPerMonth,
        kind: 'projected',
      });
    }
  }

  return {
    periodActual: { from: `${fiscalYear}-01-01`, to: asOfDate },
    runRate,
    annualProjected,
    series,
    method: 'run-rate-v1',
  };
}
