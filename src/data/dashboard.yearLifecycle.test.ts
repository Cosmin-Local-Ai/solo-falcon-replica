/**
 * PG-4 (D-YEAR-1 / B-58) — the fiscal-year lifecycle, and what a year with no rule package yields.
 *
 * The scenario this file exists for is twelve weeks away: on 1 January the app moves to a fiscal year
 * for which this build registers nothing. The only acceptable answer is a refusal that says which year
 * is missing. A zero, or last year's figure wearing this year's label, is the worst failure this app
 * can have — so both are asserted against here, at the data layer, where the banner and the hero read
 * from.
 *
 * No fake timers: `buildDashboardData` and `yearAdvanceTarget` take the instant as an argument, which
 * is the injectable-clock seam the standing wall-clock guard requires (B-23).
 */
import { describe, expect, it } from 'vitest';
import { buildDashboardData, getTaxEstimate, yearAdvanceTarget } from './dashboard';
import { seedData } from './seed';
import type { AppData } from './types';

/**
 * The instant the brief names: 00:30 LOCAL on 1 January 2027, the first half hour of the new year.
 * The offset is written down on purpose — `src/test/fixedInstant.ts` records why. A date-time with no
 * offset is parsed in the runner's own zone, and this container's zone is not Europe/Bucharest, so the
 * naive string would land on 31 December and the test would prove nothing.
 */
const NEW_YEAR_EVE_OF_2027 = new Date('2027-01-01T00:30:00+02:00');

function profileWith(over: Partial<AppData['profile']> = {}): AppData {
  return {
    ...seedData,
    profile: { ...seedData.profile, fiscalYear: 2026, updatedAt: '2026-11-20T09:00:00+02:00', ...over },
  };
}

describe('yearAdvanceTarget — when the stored year moves automatically', () => {
  it('advances a profile last maintained before the boundary', () => {
    expect(yearAdvanceTarget(profileWith().profile, NEW_YEAR_EVE_OF_2027)).toBe(2027);
  });

  it('advances a profile that has never been written', () => {
    const data = profileWith({ updatedAt: '' });
    expect(yearAdvanceTarget(data.profile, NEW_YEAR_EVE_OF_2027)).toBe(2027);
  });

  it('does NOT advance over a year the person chose after the boundary', () => {
    // This is the "toggle back to a previous year" surviving a reload. `updateProfile` re-stamps
    // `updatedAt`, so a deliberate choice sits on the far side of the boundary and the automatic
    // advance stands down. Without this, the toggle would be undone on the next load.
    const data = profileWith({ fiscalYear: 2026, updatedAt: '2027-01-01T00:31:00+02:00' });
    expect(yearAdvanceTarget(data.profile, NEW_YEAR_EVE_OF_2027)).toBeNull();
  });

  it('does not move a year that is already current, and never moves backwards', () => {
    expect(yearAdvanceTarget(profileWith({ fiscalYear: 2027 }).profile, NEW_YEAR_EVE_OF_2027)).toBeNull();
    expect(yearAdvanceTarget(profileWith({ fiscalYear: 2027 }).profile, new Date('2026-06-01T12:00:00'))).toBeNull();
  });
});

describe('the year view the surfaces read', () => {
  it('a closed 2026 viewed from 2027 is closed, and still has its rules', () => {
    const view = buildDashboardData(profileWith(), null, NEW_YEAR_EVE_OF_2027);
    expect(view.year.year).toBe(2026);
    expect(view.year.closed).toBe(true);
    // The 2026 release is in force on 1 Jan 2027 (it has no end date), so the closed year remains
    // computable — that is what makes the toggle back to 2026 a real answer rather than a dead end.
    expect(view.year.rulesAvailable).toBe(true);
    expect(view.year.currentYear).toBe(2027);
    expect(view.year.advanceTo).toBe(2027);
  });

  it('a year with no rule package is named as such, and yields no figure', async () => {
    const data = profileWith({ fiscalYear: 2027, updatedAt: '2027-01-01T00:31:00+02:00' });
    const estimate = await getTaxEstimate(data, '2027-01-01');
    const view = buildDashboardData(data, estimate, NEW_YEAR_EVE_OF_2027);

    expect(view.year.rulesAvailable).toBe(false);
    expect(view.estimateState).toBe('review_required');
    // Not a zero, and not last year's number: there is no computed result to read a figure from.
    expect(estimate.status).toBe('review_required');
    if (estimate.status !== 'review_required') throw new Error('unreachable');
    expect(estimate.reason).toContain('2027');
    expect(view.tax === null || view.tax.status !== 'computed').toBe(true);
  });

  it('the refusal is the engine naming the year, not a local guess', async () => {
    const data = profileWith({ fiscalYear: 2027, updatedAt: '2027-01-01T00:31:00+02:00' });
    const estimate = await getTaxEstimate(data, '2027-01-01');
    if (estimate.status !== 'review_required') throw new Error('expected a refusal');
    // `domain/tax.ts` refuses when no release is in force; the banner states the same fact in the
    // user's words. Neither invents a rule value for 2027.
    expect(estimate.reason).toContain('Niciun set de reguli înregistrat pentru anul fiscal 2027');
  });
});

describe('a closed year stops drifting (the drift table in brief 34)', () => {
  it('31 Dec 2026, 15 Jan 2027 and 26 May 2027 give the same estimate for the same data', async () => {
    const data = profileWith();
    const figures: Array<{ total: number; vna: number }> = [];
    for (const asOf of ['2026-12-31', '2027-01-15', '2027-05-26']) {
      const est = await getTaxEstimate(data, asOf);
      if (est.status !== 'computed') throw new Error(`expected a computed estimate at ${asOf}`);
      figures.push({ total: est.output.total, vna: est.bases.venitulNetDinActivitate });
    }
    expect(figures[1]).toEqual(figures[0]);
    expect(figures[2]).toEqual(figures[0]);
  });

  it('the closed-year figures are the actuals, so the thresholds measure what happened', async () => {
    const data = profileWith();
    const est = await getTaxEstimate(data, '2027-05-26');
    if (est.status !== 'computed') throw new Error('expected a computed estimate');
    // The projection's horizon equals its elapsed measure, so the annual operands ARE the YTD pair.
    if (est.basis.kind !== 'annual-projected') {
      throw new Error(`expected an annual-projected basis, got ${est.basis.kind}`);
    }
    expect(est.basis.projected.revenuesNet).toBe(est.basis.actual.revenuesNet);
    expect(est.basis.projected.expensesNet).toBe(est.basis.actual.expensesNet);
    const view = buildDashboardData(data, est, new Date('2027-05-26T12:00:00'));
    const contribution = view.thresholds.filter((t) => t.affectedTax !== 'vat');
    for (const row of contribution) {
      if (row.currentValue === null) continue;
      expect(row.currentValue, row.thresholdId).toBe(est.bases.venitulNetDinActivitate);
    }
  });
});
