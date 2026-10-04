import { describe, it, expect } from 'vitest';
import type { PfaProfile } from './models';
import type { RuleRelease } from './fiscal/rules';
import type { TaxCalculationSnapshot } from './snapshots/types';
import type { TaxEstimateResult } from './tax';
import {
  computeTaxReserve,
  createTaxReserveState,
  addToTaxReserve,
  monthsRemainingInFiscalYear,
} from './taxReserve';

function makeSnapshot(total: number): TaxCalculationSnapshot {
  return {
    calculationId: 'calc-2026-test',
    taxYear: 2026,
    calculatedAt: '2026-06-15T10:00:00.000Z',
    ruleRelease: {} as RuleRelease,
    inputSnapshot: { profile: {} as PfaProfile, revenues: 100_000, expenses: 0 },
    inputsHash: '0'.repeat(64),
    calculationLines: [{ label: 'total', value: total }],
    output: { total },
    status: 'computed',
  };
}

function makeComputedEstimate(total: number): TaxEstimateResult {
  return {
    status: 'computed',
    lines: [{ label: 'total', value: total }],
    output: { total },
    snapshot: makeSnapshot(total),
  };
}

function makeReviewRequiredEstimate(): TaxEstimateResult {
  return { status: 'review_required', reason: 'test reason', lines: [] };
}

describe('computeTaxReserve', () => {
  it('keeps estimated tax liability and reserve recommendation strictly separate', () => {
    const rec = computeTaxReserve(makeComputedEstimate(18_535), createTaxReserveState(5_000), {
      asOfDate: '2026-06-15',
      fiscalYear: 2026,
    });
    // Liability is the engine total verbatim — NOT reduced by the reserve.
    expect(rec.estimatedTaxLiability).toBe(18_535);
    expect(rec.reservedAmount).toBe(5_000);
    expect(rec.remainingTarget).toBe(13_535);
    // June–December inclusive = 7 months.
    expect(rec.monthsRemaining).toBe(7);
    expect(rec.recommendedMonthlyReserve).toBeCloseTo(13_535 / 7, 6);
  });

  it('returns null liability and zero targets when no estimate is available', () => {
    const rec = computeTaxReserve(null, createTaxReserveState(5_000), {
      asOfDate: '2026-06-15',
      fiscalYear: 2026,
    });
    expect(rec.estimatedTaxLiability).toBeNull();
    expect(rec.reservedAmount).toBe(5_000);
    expect(rec.remainingTarget).toBe(0);
    expect(rec.recommendedMonthlyReserve).toBe(0);
  });

  it('treats a review_required estimate as unavailable (no liability)', () => {
    const rec = computeTaxReserve(makeReviewRequiredEstimate(), createTaxReserveState(1_000), {
      asOfDate: '2026-03-01',
      fiscalYear: 2026,
    });
    expect(rec.estimatedTaxLiability).toBeNull();
    expect(rec.remainingTarget).toBe(0);
    expect(rec.recommendedMonthlyReserve).toBe(0);
  });

  it('computes a partial reserve against the full-year liability', () => {
    // total=20750 (from tax engine), reserved=5000, Jan → 12 months remaining.
    const rec = computeTaxReserve(makeComputedEstimate(20_750), createTaxReserveState(5_000), {
      asOfDate: '2026-01-01',
      fiscalYear: 2026,
    });
    expect(rec.remainingTarget).toBe(15_750);
    expect(rec.monthsRemaining).toBe(12);
    expect(rec.recommendedMonthlyReserve).toBe(1_312.5);
  });

  it('returns zero remaining target when the reserve fully covers the liability', () => {
    const rec = computeTaxReserve(makeComputedEstimate(18_535), createTaxReserveState(18_535), {
      asOfDate: '2026-06-15',
      fiscalYear: 2026,
    });
    expect(rec.remainingTarget).toBe(0);
    expect(rec.recommendedMonthlyReserve).toBe(0);
  });

  it('clamps remaining target at zero when the reserve exceeds the liability', () => {
    const rec = computeTaxReserve(makeComputedEstimate(18_535), createTaxReserveState(25_000), {
      asOfDate: '2026-06-15',
      fiscalYear: 2026,
    });
    expect(rec.remainingTarget).toBe(0);
    expect(rec.recommendedMonthlyReserve).toBe(0);
  });

  it('counts 1 month remaining when asOfDate is in December', () => {
    const rec = computeTaxReserve(makeComputedEstimate(18_535), createTaxReserveState(8_535), {
      asOfDate: '2026-12-15',
      fiscalYear: 2026,
    });
    expect(rec.monthsRemaining).toBe(1);
    expect(rec.remainingTarget).toBe(10_000);
    expect(rec.recommendedMonthlyReserve).toBe(10_000);
  });

  it('counts 12 months remaining at the start of the fiscal year', () => {
    expect(monthsRemainingInFiscalYear('2026-01-01', 2026)).toBe(12);
    expect(monthsRemainingInFiscalYear('2026-01-31', 2026)).toBe(12);
  });

  it('counts 12 months before the fiscal year and 0 after it', () => {
    expect(monthsRemainingInFiscalYear('2025-12-31', 2026)).toBe(12);
    expect(monthsRemainingInFiscalYear('2027-01-01', 2026)).toBe(0);
  });

  it('returns zero monthly reserve when the fiscal year is already past', () => {
    const rec = computeTaxReserve(makeComputedEstimate(18_535), createTaxReserveState(0), {
      asOfDate: '2027-01-01',
      fiscalYear: 2026,
    });
    expect(rec.monthsRemaining).toBe(0);
    expect(rec.remainingTarget).toBe(18_535);
    expect(rec.recommendedMonthlyReserve).toBe(0);
  });

  it('is deterministic for identical inputs', () => {
    const a = computeTaxReserve(makeComputedEstimate(18_535), createTaxReserveState(5_000), {
      asOfDate: '2026-06-15',
      fiscalYear: 2026,
    });
    const b = computeTaxReserve(makeComputedEstimate(18_535), createTaxReserveState(5_000), {
      asOfDate: '2026-06-15',
      fiscalYear: 2026,
    });
    expect(a).toEqual(b);
  });

  it('carries a null reserve through verbatim and targets the full liability', () => {
    const rec = computeTaxReserve(makeComputedEstimate(18_535), createTaxReserveState(null), {
      asOfDate: '2026-06-15',
      fiscalYear: 2026,
    });
    expect(rec.reservedAmount).toBeNull();
    // null is treated as 0 for the math: the full liability remains to reserve.
    expect(rec.remainingTarget).toBe(18_535);
    expect(rec.monthsRemaining).toBe(7);
    expect(rec.recommendedMonthlyReserve).toBeCloseTo(18_535 / 7, 6);
  });

  it('keeps an explicit zero reserve as zero (distinct from null)', () => {
    const rec = computeTaxReserve(makeComputedEstimate(18_535), createTaxReserveState(0), {
      asOfDate: '2026-06-15',
      fiscalYear: 2026,
    });
    expect(rec.reservedAmount).toBe(0);
    expect(rec.remainingTarget).toBe(18_535);
    expect(rec.recommendedMonthlyReserve).toBeCloseTo(18_535 / 7, 6);
  });

  it('derives recommendedMonthlyReserve from its own remainingTarget and monthsRemaining', () => {
    const rec = computeTaxReserve(
      makeComputedEstimate(18_535),
      createTaxReserveState(5_000),
      { asOfDate: '2026-06-15', fiscalYear: 2026 },
    );
    // Consistency check: the monthly recommendation must equal the remaining
    // target divided by the months remaining, using fields returned by
    // computeTaxReserve itself (no hardcoded division).
    expect(rec.recommendedMonthlyReserve).toBeCloseTo(rec.remainingTarget / rec.monthsRemaining, 6);
  });
});

describe('tax reserve state', () => {
  it('creates a state clamped at zero', () => {
    expect(createTaxReserveState(5_000)).toEqual({ reservedAmount: 5_000 });
    expect(createTaxReserveState(-10)).toEqual({ reservedAmount: 0 });
  });

  it('adds to the reserve without mutating the original state', () => {
    const s0 = createTaxReserveState(5_000);
    const s1 = addToTaxReserve(s0, 2_000);
    expect(s1).toEqual({ reservedAmount: 7_000 });
    expect(s0).toEqual({ reservedAmount: 5_000 });
  });

  it('treats a negative add as a withdrawal clamped at zero', () => {
    const s0 = createTaxReserveState(1_000);
    expect(addToTaxReserve(s0, -400)).toEqual({ reservedAmount: 600 });
    expect(addToTaxReserve(s0, -5_000)).toEqual({ reservedAmount: 0 });
  });

  it('passes null through as "no data recorded"', () => {
    expect(createTaxReserveState(null)).toEqual({ reservedAmount: null });
  });

  it('adds to a null state, recording the clamped amount', () => {
    const s0 = createTaxReserveState(null);
    expect(addToTaxReserve(s0, 3_000)).toEqual({ reservedAmount: 3_000 });
    expect(addToTaxReserve(s0, -400)).toEqual({ reservedAmount: 0 });
    // The original null state is never mutated.
    expect(s0).toEqual({ reservedAmount: null });
  });
});
