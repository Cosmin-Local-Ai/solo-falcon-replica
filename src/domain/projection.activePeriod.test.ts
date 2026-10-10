/**
 * PG-4 (B-44) — the projection runs over the PFA's ACTIVE period, not the calendar year.
 *
 * The defect this file exists for: `selectProjectionV1` divided by months elapsed since 1 January and
 * multiplied by 12, whatever the PFA's own start date said. A PFA that opened on 1 October 2026 with
 * 10.000 lei in October was therefore projected as if it had been trading since January — nine months
 * of activity the taxpayer never had.
 *
 * Every figure below is derived by hand from the active window `[max(Jan 1, pfaStartDate), Dec 31]`,
 * with the partial first month counted as a fraction (no rule makes it a whole month).
 */
import { describe, expect, it } from 'vitest';
import { selectProjectionV1 } from './projection';
import { seedData } from '../data/seed';
import type { AppData, Expense, Revenue } from '../data/types';
import { lei, ron } from './money';

function revenue(over: Partial<Revenue> = {}): Revenue {
  return {
    id: 'rev-1',
    tip: 'factura',
    nr: 'FCT-AP-1',
    date: '2026-10-03',
    client: 'Client AP SRL',
    cui: 'RO00000000',
    valoareFaraTva: ron(10_000),
    tva: ron(0),
    status: 'inregistrata',
    ...over,
  };
}

function expense(over: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    tip: 'factura',
    nr: 'CH-AP-1',
    date: '2026-10-05',
    furnizor: 'Furnizor AP SRL',
    cui: 'RO00000000',
    valoareFaraTva: ron(4_000),
    tva: ron(0),
    status: 'inregistrata',
    ...over,
  };
}

/** A clean register: one start date, one list of revenues, one list of expenses, nothing inherited. */
function dataWith(start: string | undefined, revenues: Revenue[], expenses: Expense[] = []): AppData {
  return {
    ...seedData,
    profile: { ...seedData.profile, pfaStartDate: start, fiscalYear: 2026 },
    revenues,
    expenses,
  };
}

describe('the active period (B-44)', () => {
  it('projects an October start to the end of the year, not twelve times the month', () => {
    // Active period 2026-10-01 .. 2026-12-31 = 3 months. At 31 Oct the elapsed measure is exactly 1,
    // so the run rate is 10.000 lei/month and the year-end figure is 30.000 lei — NOT 120.000 lei,
    // which is what the calendar denominator produced.
    const p = selectProjectionV1(dataWith('2026-10-01', [revenue()]), '2026-10-31');
    expect(p.activePeriod).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    expect(p.activeMonths).toBe(3);
    expect(p.elapsedMonths).toBe(1);
    expect(p.annualProjected.revenue).toBe(lei(30_000));
    expect(p.annualProjected.revenue).not.toBe(lei(120_000));
    expect(p.closed).toBe(false);
  });

  it('counts the partial first month as a fraction, not as a whole month', () => {
    // 19 Jan .. 31 Dec: 11 whole months (Feb..Dec) plus 13/31 of January — the 18 days before the
    // start are not activity.
    const p = selectProjectionV1(dataWith('2026-01-19', [revenue({ date: '2026-10-03' })]), '2026-10-31');
    expect(p.activeMonths).toBeCloseTo(354 / 31, 10);
    expect(p.elapsedMonths).toBeCloseTo(292 / 31, 10);
    // A whole first month would have made the horizon 12 and the elapsed measure 10.
    expect(p.activeMonths).not.toBe(12);
  });

  it('with no start date the active period IS the calendar year, unchanged', () => {
    // The regression guard for every figure the app produced before PG-4: `pfaStartDate` absent means
    // no assumption is invented and the old denominator still applies.
    const p = selectProjectionV1(dataWith(undefined, [revenue()]), '2026-10-31');
    expect(p.activeMonths).toBe(12);
    expect(p.elapsedMonths).toBe(10);
    expect(p.annualProjected.revenue).toBe(lei(12_000)); // 10.000 x 12/10
  });

  it('a start date before the fiscal year does not shorten the window', () => {
    const p = selectProjectionV1(dataWith('2021-04-01', [revenue()]), '2026-10-31');
    expect(p.activePeriod).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(p.activeMonths).toBe(12);
  });

  it('a malformed start date is not guessed at', () => {
    const p = selectProjectionV1(dataWith('2026-13-45', [revenue()]), '2026-10-31');
    expect(p.activePeriod.from).toBe('2026-01-01');
    expect(p.activeMonths).toBe(12);
  });
});

describe('the closed year', () => {
  const data = dataWith('2026-01-19', [revenue({ date: '2026-10-03' })], [expense()]);

  it('gives the same projection on 31 Dec, 15 Jan and 26 May — no daily drift', () => {
    const a = selectProjectionV1(data, '2026-12-31');
    const b = selectProjectionV1(data, '2027-01-15');
    const c = selectProjectionV1(data, '2027-05-26');
    expect(b.annualProjected).toEqual(a.annualProjected);
    expect(c.annualProjected).toEqual(a.annualProjected);
    expect(b.elapsedMonths).toBe(a.elapsedMonths);
    expect(c.elapsedMonths).toBe(a.elapsedMonths);
    // The drift this prevents: an elapsed measure that keeps growing past 31 December.
    expect(b.elapsedMonths).toBeLessThanOrEqual(12);
    expect(c.elapsedMonths).toBeLessThanOrEqual(12);
  });

  it('collapses onto the actuals exactly, and says it is closed', () => {
    const p = selectProjectionV1(data, '2027-05-26');
    expect(p.closed).toBe(true);
    expect(p.elapsedMonths).toBe(p.activeMonths);
    // rate x horizon with rate = YTD / horizon is YTD. No rounding step, no run-rate residue.
    expect(p.annualProjected.revenue).toBe(lei(10_000));
    expect(p.annualProjected.expenses).toBe(lei(4_000));
    expect(p.annualProjected.net).toBe(lei(6_000));
    // A closed year has nothing left to project: the series is twelve actual months.
    expect(p.series.every((m) => m.kind === 'actual')).toBe(true);
  });

  it('an open year is not closed, on the last day of the year', () => {
    expect(selectProjectionV1(data, '2026-12-31').closed).toBe(false);
    expect(selectProjectionV1(data, '2027-01-01').closed).toBe(true);
  });
});

describe('no division by zero, no false precision', () => {
  it('a PFA that starts after the fiscal year has no active period and no run rate', () => {
    const p = selectProjectionV1(dataWith('2027-03-01', [revenue()]), '2026-10-31');
    expect(p.activeMonths).toBe(0);
    expect(p.elapsedMonths).toBe(0);
    expect(p.annualProjected).toEqual({ revenue: 0, expenses: 0, net: 0 });
    expect(p.runRate).toEqual({ revenuePerMonth: 0, expensesPerMonth: 0, netPerMonth: 0 });
    expect(Number.isNaN(p.runRate.revenuePerMonth)).toBe(false);
  });

  it('a PFA that has not started yet at the as-of date has no run rate either', () => {
    const p = selectProjectionV1(dataWith('2026-06-01', [revenue({ date: '2026-06-02' })]), '2026-03-31');
    expect(p.elapsedMonths).toBe(0);
    expect(p.annualProjected.revenue).toBe(0);
    expect(p.activeMonths).toBeCloseTo(7, 10); // 1 Jun .. 31 Dec
  });

  it('no transactions at all projects zeros, not NaN', () => {
    const p = selectProjectionV1(dataWith('2026-01-01', []), '2026-10-31');
    expect(p.annualProjected).toEqual({ revenue: 0, expenses: 0, net: 0 });
    expect(p.runRate.netPerMonth).toBe(0);
    expect(p.series.every((m) => !Number.isNaN(m.net))).toBe(true);
  });

  it('a loss-making year keeps a negative net and still adds up', () => {
    const p = selectProjectionV1(
      dataWith('2026-01-01', [revenue({ valoareFaraTva: ron(1_000) })], [expense({ valoareFaraTva: ron(4_000) })]),
      '2026-10-31',
    );
    expect(p.annualProjected.net).toBe(lei(-3_600)); // (1.000 - 4.000) x 12/10
    expect(p.annualProjected.net).toBe(p.annualProjected.revenue - p.annualProjected.expenses);
  });

  it('elapsed never exceeds the active period, and neither exceeds twelve months', () => {
    const data = dataWith('2026-04-15', [revenue({ date: '2026-05-02' })]);
    for (const d of ['2026-01-01', '2026-04-14', '2026-04-15', '2026-06-30', '2026-12-31', '2027-06-30', '2028-01-01']) {
      const p = selectProjectionV1(data, d);
      expect(p.elapsedMonths, d).toBeLessThanOrEqual(p.activeMonths);
      expect(p.elapsedMonths, d).toBeLessThanOrEqual(12);
      expect(p.activeMonths, d).toBeLessThanOrEqual(12);
      expect(p.elapsedMonths, d).toBeGreaterThanOrEqual(0);
    }
  });

  it('a leap-year window is measured in the real days of February', () => {
    // 10 Feb .. 31 Dec 2024 = 10 whole months plus 20/29 of February, because February 2024 has 29
    // days. The elapsed measure on 29 Feb is 20/29 of a month, but the denominator the run rate uses
    // is floored at 1 — a business three weeks old gets no finer precision than "one month".
    const data = {
      ...seedData,
      profile: { ...seedData.profile, pfaStartDate: '2024-02-10', fiscalYear: 2024 },
      revenues: [revenue({ date: '2024-02-11' })],
      expenses: [],
    } as AppData;
    const p = selectProjectionV1(data, '2024-02-29');
    expect(p.activeMonths).toBeCloseTo(10 + 20 / 29, 10);
    expect(p.elapsedMonths).toBe(1); // the floor, not the raw 20/29
    // 10.000 lei = 1.000.000 bani, rate = 1.000.000 / 1, annual = x (10 + 20/29) = 10.689.655,17 bani.
    expect(p.annualProjected.revenue).toBe(10_689_655);
  });
});
