import type { AppData } from '../data/types';
import Decimal from 'decimal.js-light';
import { selectMonthly, selectYtd } from './aggregation';
import { daysInMonth } from './date';
import { allocateBani, toBaniNearest, type Bani } from './money';

/**
 * Projection v1 — transparent current run rate (Step 13, Part B).
 *
 * Pure domain module: no React, no DOM, no localStorage, no store imports.
 * Deterministic for the same (data, asOfDate) inputs. No ML, no statistical
 * forecasting, no tax logic. The method is exactly:
 *
 *   run rate   = YTD totals / elapsed months, where elapsed months is a fraction:
 *                full months elapsed + day/daysInMonth for the current partial month;
 *                denominator floored to 1 for dates inside the fiscal year, 0 before the fiscal year start.
 *   annual     = run rate × 12
 *
 * Every projected value is explicitly tagged: series entries carry
 * `kind: 'projected'`, and annual totals live under `annualProjected`.
 */

export interface ProjectionPeriod {
  from: string; // 'YYYY-MM-DD'
  to: string; // 'YYYY-MM-DD'
}

/**
 * A monthly **rate**, in bani, deliberately NOT branded `Bani`.
 *
 * A run rate is a division and is usually not a whole number of bani (1071 lei over 8.5 months is
 * 12 600 bani, but 90 lei over 8.5 months is 1 058.82 bani). Leaving it unbranded is what stops it
 * reaching `formatBani*` or a persisted field by accident: only `Totals` below carries the brand, and
 * every value there has already been made whole.
 *
 * Art. 66 does NOT apply here. It rounds sums a taxpayer owes; a projection is not a sum owed, so
 * rounding a projected month to a whole leu would invent a rule that does not exist.
 */
export interface RunRate {
  revenuePerMonth: number;
  expensesPerMonth: number;
  netPerMonth: number;
}

/** Money amounts in integer bani — safe to display and to sum. */
export interface Totals {
  revenue: Bani;
  expenses: Bani;
  net: Bani;
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
  elapsedMonths: number; // actual denominator used (after the lower bound)
}

function elapsedMonths(fiscalYear: number, asOfDate: string): number {
  const asOfYear = Number(asOfDate.slice(0, 4));
  const asOfMonth = Number(asOfDate.slice(5, 7));
  const asOfDay = Number(asOfDate.slice(8, 10));
  return (asOfYear - fiscalYear) * 12 + (asOfMonth - 1) + asOfDay / daysInMonth(asOfYear, asOfMonth);
}

export function selectProjectionV1(data: AppData, asOfDate: string): ProjectionV1 {
  const fiscalYear = data.profile.fiscalYear;
  const months = elapsedMonths(fiscalYear, asOfDate);
  const denom = months > 0 ? Math.max(1, months) : 0;

  const ytd = selectYtd(data, asOfDate);
  // The run rate stays a Decimal so no intermediate is rounded before it is used.
  const zero = new Decimal(0);
  const rate = {
    revenue: denom > 0 ? new Decimal(ytd.revenue).div(denom) : zero,
    expenses: denom > 0 ? new Decimal(ytd.expenses).div(denom) : zero,
    net: denom > 0 ? new Decimal(ytd.net).div(denom) : zero,
  };
  const runRate: RunRate = {
    revenuePerMonth: rate.revenue.toNumber(),
    expensesPerMonth: rate.expenses.toNumber(),
    netPerMonth: rate.net.toNumber(),
  };

  const annualProjected: Totals = {
    revenue: toBaniNearest(rate.revenue.times(12)),
    expenses: toBaniNearest(rate.expenses.times(12)),
    net: toBaniNearest(rate.net.times(12)),
  };

  const monthly = selectMonthly(data, asOfDate);
  const asOfMonth = asOfDate.slice(0, 7);

  // Projected months are ALLOCATED, not divided-and-rounded one at a time. Rounding each month on its
  // own would let the 12 entries drift away from the year they are drawn from. `allocateBani` hands the
  // leftover bani to the earliest months, so the projected months sum exactly to the projected subtotal.
  const actualCount = Math.min(12, Math.max(0, Number(asOfMonth.slice(5, 7)) || 0));
  const projectedCount = 12 - actualCount;
  const shares =
    projectedCount > 0
      ? {
          revenue: allocateBani(toBaniNearest(rate.revenue.times(projectedCount)), projectedCount),
          expenses: allocateBani(toBaniNearest(rate.expenses.times(projectedCount)), projectedCount),
          net: allocateBani(toBaniNearest(rate.net.times(projectedCount)), projectedCount),
        }
      : { revenue: [] as Bani[], expenses: [] as Bani[], net: [] as Bani[] };

  const series: ProjectionMonth[] = [];
  let projectedIndex = 0;
  for (let m = 1; m <= 12; m++) {
    const month = `${fiscalYear}-${String(m).padStart(2, '0')}`;
    if (month <= asOfMonth) {
      const actual = monthly.get(month) ?? { revenue: 0 as Bani, expenses: 0 as Bani, net: 0 as Bani };
      series.push({ month, ...actual, kind: 'actual' });
    } else {
      const i = projectedIndex++;
      series.push({
        month,
        revenue: shares.revenue[i],
        expenses: shares.expenses[i],
        net: shares.net[i],
        kind: 'projected',
      });
    }
  }

  return {
    periodActual: { from: `${fiscalYear}-01-01`, to: asOfDate },
    elapsedMonths: denom,
    runRate,
    annualProjected,
    series,
    method: 'run-rate-v1',
  };
}
