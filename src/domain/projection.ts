import type { AppData } from '../data/types';
import Decimal from 'decimal.js-light';
import { selectMonthly, selectYtd } from './aggregation';
import { daysInMonth, isoCalendarDateProblem } from './date';
import { allocateBani, subBani, toBaniNearest, type Bani } from './money';

/**
 * Projection v1 — transparent current run rate (Step 13, Part B).
 *
 * Pure domain module: no React, no DOM, no localStorage, no store imports.
 * Deterministic for the same (data, asOfDate) inputs. No ML, no statistical
 * forecasting, no tax logic. The method is exactly:
 *
 *   run rate   = YTD totals / elapsed months, where elapsed months is a fraction:
 *                full months elapsed + day/daysInMonth for the current partial month;
 *                denominator floored to 1 for dates inside the active period, 0 before it starts.
 *   annual     = run rate × activeMonths
 *
 * PG-4 (B-44) changed ONE term and nothing else: the multiplier is the PFA's **active period**,
 * `[max(Jan 1, profile.pfaStartDate), Dec 31]`, not the twelve calendar months, and the elapsed
 * denominator is measured from the same start and clamped at the same end. For a profile with no
 * start date the active period IS the calendar year, `activeMonths` is 12, and every figure this
 * module produced before is produced unchanged — which is why the change is safe to make here rather
 * than in a second, parallel projection.
 *
 * Two consequences that are the whole point of the change:
 *
 *   1. A PFA that started on 1 Oct 2026 is projected over three months, not twelve. Dividing its
 *      October money by elapsed *calendar* months and multiplying by 12 invented nine months of
 *      activity that never happened.
 *   2. Once the as-of date is past 31 Dec the elapsed measure is clamped to the active period, so
 *      run rate and horizon are the same number and `annual` collapses onto the actuals exactly.
 *      A closed year therefore stops drifting day to day, and the engine consumes actuals.
 *
 * The horizon is NOT prorated against the statutory thresholds. Art. 151 alin. (2) CF says the
 * 12-SM / 24-SM / 6-SM / 72-SM figures are NOT reduced for a fraction of a year, so shortening the
 * projection window changes the projected income and leaves the thresholds alone; that separation is
 * owned by the threshold layer, not here.
 *
 * Every projected value is explicitly tagged: series entries carry
 * `kind: 'projected'`, and annual totals live under `annualProjected`.
 *
 * Task 1 (pre-Phase-11) added ONE thing and changed nothing else: the same rule, with the same
 * denominator, applied to the two VAT-exclusive YTD totals (`revenueNet` / `expenseNet`) that
 * `selectYtd` already returns and that the tax engine consumes. That is still `run-rate-v1` — no
 * second method, no new annualisation rule. See `annualProjectedExclVat` below for why those two
 * are annualised from their own totals rather than derived from the VAT-inclusive pair.
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

/**
 * The run-rate annualisation of the **VAT-exclusive** YTD totals — `YtdTotals.revenueNet`
 * (cifră de afaceri, `valoareFaraTva` only) and `YtdTotals.expenseNet`.
 *
 * These are the two operands the tax engine selects for every profile that is not `vatExempt`
 * (`tax.ts`: `gross = vatExempt ? revenues : revenuesNet`), so without them the model can only
 * annualise the operands the default profile never uses.
 *
 * They are annualised **from their own YTD totals**, never derived from the VAT-inclusive pair:
 * deriving them would assume a constant VAT rate across the whole year, which is a fiscal
 * assumption this model does not have and no rule in the package supports.
 */
export interface ProjectionExclVat {
  revenueNet: Bani;
  expenseNet: Bani;
}

export interface ProjectionMonth extends Totals {
  month: string; // 'YYYY-MM'
  kind: 'actual' | 'projected';
}

export interface ProjectionV1 {
  periodActual: ProjectionPeriod;
  /**
   * PG-4 — the window the run rate is measured over: `[max(Jan 1, pfaStartDate), Dec 31]`.
   * `from > to` when the PFA is not active in this fiscal year at all.
   */
  activePeriod: ProjectionPeriod;
  /** Length of `activePeriod` in months, fractional. 12 with no start date; 0 when not active. */
  activeMonths: number;
  /**
   * PG-4 — true when the as-of date is past 31 Dec of the fiscal year. The year is closed: the
   * figures are final actuals, there is no run rate left to speak of, and no surface may show
   * run-rate wording ("N din 12 luni") for them.
   */
  closed: boolean;
  runRate: RunRate;
  annualProjected: Totals;
  /** VAT-exclusive annual projection — the operands a non-`vatExempt` profile's engine run consumes. */
  annualProjectedExclVat: ProjectionExclVat;
  series: ProjectionMonth[];
  method: 'run-rate-v1';
  elapsedMonths: number; // actual denominator used (after the lower bound)
}

/**
 * Months from the beginning of `start`'s day up to and including `asOf`'s month fraction.
 *
 * The `(sd - 1) / daysInMonth(sy, sm)` term is what makes a start on the first of a month cost
 * nothing: with `start = `${fiscalYear}-01-01`` this is algebraically the same expression the
 * calendar-year denominator always was, so a profile with no start date gets the same number it
 * got before PG-4. With a start on the 19th, January costs 18/31 of a month — the partial first
 * month is a fraction, not a whole month, because no rule says otherwise.
 */
function elapsedMonthsFrom(start: string, asOfDate: string): number {
  const startY = Number(start.slice(0, 4));
  const startM = Number(start.slice(5, 7));
  const startD = Number(start.slice(8, 10));
  const asOfYear = Number(asOfDate.slice(0, 4));
  const asOfMonth = Number(asOfDate.slice(5, 7));
  const asOfDay = Number(asOfDate.slice(8, 10));
  return (
    (asOfYear - startY) * 12 +
    (asOfMonth - startM) +
    asOfDay / daysInMonth(asOfYear, asOfMonth) -
    (startD - 1) / daysInMonth(startY, startM)
  );
}

/**
 * The first day the PFA was active inside this fiscal year.
 *
 * A missing or malformed start date is NOT guessed at: the active period falls back to the calendar
 * year, which is the same assumption the app made before the field existed. Inventing a start date
 * would invent activity, and inventing a later one would quietly shrink the projection.
 */
function activeStartOf(pfaStartDate: string | undefined, yearStart: string): string {
  if (pfaStartDate === undefined || isoCalendarDateProblem(pfaStartDate) !== null) return yearStart;
  return pfaStartDate > yearStart ? pfaStartDate : yearStart;
}

export function selectProjectionV1(data: AppData, asOfDate: string): ProjectionV1 {
  const fiscalYear = data.profile.fiscalYear;
  const yearStart = `${fiscalYear}-01-01`;
  const yearEnd = `${fiscalYear}-12-31`;
  const activeStart = activeStartOf(data.profile.pfaStartDate, yearStart);
  // The horizon. A PFA whose start date falls after 31 Dec has no active period in this year at all:
  // `activeMonths` is 0, the denominator is 0, and every projected figure is zero. That is a state,
  // not a number, and nothing here divides by it.
  const activeMonths = Math.max(0, elapsedMonthsFrom(activeStart, yearEnd));
  const closed = asOfDate > yearEnd;
  // Clamped at both ends: never negative before the active period starts, never past the period's
  // own end. The upper clamp is what stops a closed year re-annualising itself every day — on
  // 15 Jan 2027 the elapsed measure for FY2026 is still exactly `activeMonths`, so the run rate is
  // the year's own average and `annual` lands back on the actuals.
  const months = Math.min(Math.max(0, elapsedMonthsFrom(activeStart, asOfDate)), activeMonths);
  const denom = months > 0 ? Math.max(1, months) : 0;

  const ytd = selectYtd(data, asOfDate);
  // The run rate stays a Decimal so no intermediate is rounded before it is used.
  const zero = new Decimal(0);
  const rate = {
    revenue: denom > 0 ? new Decimal(ytd.revenue).div(denom) : zero,
    expenses: denom > 0 ? new Decimal(ytd.expenses).div(denom) : zero,
    net: denom > 0 ? new Decimal(ytd.net).div(denom) : zero,
    revenueNet: denom > 0 ? new Decimal(ytd.revenueNet).div(denom) : zero,
    expenseNet: denom > 0 ? new Decimal(ytd.expenseNet).div(denom) : zero,
  };
  const runRate: RunRate = {
    revenuePerMonth: rate.revenue.toNumber(),
    expensesPerMonth: rate.expenses.toNumber(),
    netPerMonth: rate.net.toNumber(),
  };

  // `× activeMonths`, not `× 12`: project to the end of the period the PFA was actually open for.
  const annualRevenue = toBaniNearest(rate.revenue.times(activeMonths));
  const annualExpenses = toBaniNearest(rate.expenses.times(activeMonths));
  const annualProjected: Totals = {
    revenue: annualRevenue,
    expenses: annualExpenses,
    // Derived, not independently rounded — see the note above the projected shares.
    net: subBani(annualRevenue, annualExpenses),
  };

  // The VAT-exclusive pair: the identical rule (`rate × 12`, made whole by `toBaniNearest`) applied
  // to `ytd.revenueNet` / `ytd.expenseNet`. There is no `net` here on purpose — the engine owns
  // `venitulNetDinActivitate`, and this model must not pre-empt it.
  const annualProjectedExclVat: ProjectionExclVat = {
    revenueNet: toBaniNearest(rate.revenueNet.times(activeMonths)),
    expenseNet: toBaniNearest(rate.expenseNet.times(activeMonths)),
  };

  const monthly = selectMonthly(data, asOfDate);
  const asOfMonth = asOfDate.slice(0, 7);

  // Projected months are ALLOCATED, not divided-and-rounded one at a time. Rounding each month on its
  // own would let the 12 entries drift away from the year they are drawn from. `allocateBani` hands the
  // leftover bani to the earliest months, so the projected months sum exactly to the projected subtotal.
  // actualCount MUST agree with the loop's own predicate below (`month <= asOfMonth`), otherwise the
  // share arrays are the wrong length and a projected month indexes past the end. An asOfDate before
  // January makes every month projected (0 actual), and one after December makes every month actual.
  const firstMonth = `${fiscalYear}-01`;
  const lastMonth = `${fiscalYear}-12`;
  const actualCount =
    asOfMonth >= lastMonth ? 12 : asOfMonth < firstMonth ? 0 : Number(asOfMonth.slice(5, 7));
  const projectedCount = 12 - actualCount;
  // `net` is DERIVED by subtraction, never allocated on its own. If each of the three were rounded
  // independently, a single row could show revenue 12 600 − expenses 1 059 = net 11 542 and fail the
  // reader's own arithmetic. Deriving it makes every row add up AND makes the rows sum exactly to
  // annualProjected.net, because allocateBani() sums exactly to its total.
  const shares =
    projectedCount > 0
      ? {
          revenue: allocateBani(toBaniNearest(rate.revenue.times(projectedCount)), projectedCount),
          expenses: allocateBani(toBaniNearest(rate.expenses.times(projectedCount)), projectedCount),
        }
      : { revenue: [] as Bani[], expenses: [] as Bani[] };

  const series: ProjectionMonth[] = [];
  let projectedIndex = 0;
  for (let m = 1; m <= 12; m++) {
    const month = `${fiscalYear}-${String(m).padStart(2, '0')}`;
    if (month <= asOfMonth) {
      // Fields picked, not spread. `ProjectionMonth extends Totals`, so `...actual` would let any field the
      // aggregation grows join the forecast series and its exhaustive renderers — which is how a B-112 DPI
      // subtotal would end up inside a chart that does not distinguish it. Picking keeps the row's shape
      // owned by this module rather than by whichever selector fed it.
      const actual = monthly.get(month);
      series.push({
        month,
        revenue: actual?.revenue ?? (0 as Bani),
        expenses: actual?.expenses ?? (0 as Bani),
        net: actual?.net ?? (0 as Bani),
        kind: 'actual',
      });
    } else {
      const i = projectedIndex++;
      series.push({
        month,
        revenue: shares.revenue[i],
        expenses: shares.expenses[i],
        net: subBani(shares.revenue[i], shares.expenses[i]),
        kind: 'projected',
      });
    }
  }

  return {
    periodActual: { from: yearStart, to: asOfDate },
    activePeriod: { from: activeStart, to: yearEnd },
    activeMonths,
    closed,
    elapsedMonths: denom,
    runRate,
    annualProjected,
    annualProjectedExclVat,
    series,
    method: 'run-rate-v1',
  };
}
