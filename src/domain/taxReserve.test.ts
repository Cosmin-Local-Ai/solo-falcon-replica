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
import { lei, type Bani } from './money';

function makeSnapshot(total: Bani): TaxCalculationSnapshot {
  return {
    calculationId: 'calc-2026-test',
    taxYear: 2026,
    calculatedAt: '2026-06-15T10:00:00.000Z',
    ruleRelease: {} as RuleRelease,
    inputSnapshot: { profile: {} as PfaProfile, revenues: lei(100_000), expenses: lei(0) },
    inputsHash: '0'.repeat(64),
    calculationLines: [{ label: 'total', value: total }],
    output: { total },
    status: 'computed',
  };
}

function makeComputedEstimate(total: Bani): TaxEstimateResult {
  return {
    status: 'computed',
    lines: [{ label: 'total', value: total }],
    output: { total },
    snapshot: makeSnapshot(total),
    bases: { venitulBrut: total, cheltuieliDeductibile: lei(0), venitulNetDinActivitate: total },
    // B-129/B-130 added this field to the computed result. The fixture is a sistem-real PFA with a net,
    // which is the register shape where both category facts are 'da'.
    contributionCategories: { independentActivity: 'da', casBearing: 'da' },
  };
}

function makeReviewRequiredEstimate(): TaxEstimateResult {
  return { status: 'review_required', reason: 'test reason', lines: [] };
}

describe('computeTaxReserve', () => {
  it('keeps estimated tax liability and reserve recommendation strictly separate', () => {
    const rec = computeTaxReserve(makeComputedEstimate(lei(18_535)), createTaxReserveState(lei(5_000)), {
      asOfDate: '2026-06-15',
      fiscalYear: 2026,
    });
    // Liability is the engine total verbatim — NOT reduced by the reserve.
    expect(rec.estimatedTaxLiability).toBe(lei(18_535));
    expect(rec.reservedAmount).toBe(lei(5_000));
    expect(rec.remainingTarget).toBe(lei(13_535));
    // June–December inclusive = 7 months.
    expect(rec.monthsRemaining).toBe(7);
    // divBani() rounds the share to the nearest ban, so the relation holds within half a ban.
    expect(rec.recommendedMonthlyReserve).toBeCloseTo(lei(13_535) / 7, 0);
  });

  it('returns null liability and zero targets when no estimate is available', () => {
    const rec = computeTaxReserve(null, createTaxReserveState(lei(5_000)), {
      asOfDate: '2026-06-15',
      fiscalYear: 2026,
    });
    expect(rec.estimatedTaxLiability).toBeNull();
    expect(rec.reservedAmount).toBe(lei(5_000));
    expect(rec.remainingTarget).toBe(0);
    expect(rec.recommendedMonthlyReserve).toBe(0);
  });

  it('treats a review_required estimate as unavailable (no liability)', () => {
    const rec = computeTaxReserve(makeReviewRequiredEstimate(), createTaxReserveState(lei(1_000)), {
      asOfDate: '2026-03-01',
      fiscalYear: 2026,
    });
    expect(rec.estimatedTaxLiability).toBeNull();
    expect(rec.remainingTarget).toBe(0);
    expect(rec.recommendedMonthlyReserve).toBe(0);
  });

  it('computes a partial reserve against the full-year liability', () => {
    // total=20750 (from tax engine), reserved=5000, Jan → 12 months remaining.
    const rec = computeTaxReserve(makeComputedEstimate(lei(20_750)), createTaxReserveState(lei(5_000)), {
      asOfDate: '2026-01-01',
      fiscalYear: 2026,
    });
    expect(rec.remainingTarget).toBe(lei(15_750));
    expect(rec.monthsRemaining).toBe(12);
    expect(rec.recommendedMonthlyReserve).toBe(lei(1_312.5));
  });

  it('returns zero remaining target when the reserve fully covers the liability', () => {
    const rec = computeTaxReserve(makeComputedEstimate(lei(18_535)), createTaxReserveState(lei(18_535)), {
      asOfDate: '2026-06-15',
      fiscalYear: 2026,
    });
    expect(rec.remainingTarget).toBe(0);
    expect(rec.recommendedMonthlyReserve).toBe(0);
  });

  it('clamps remaining target at zero when the reserve exceeds the liability', () => {
    const rec = computeTaxReserve(makeComputedEstimate(lei(18_535)), createTaxReserveState(lei(25_000)), {
      asOfDate: '2026-06-15',
      fiscalYear: 2026,
    });
    expect(rec.remainingTarget).toBe(0);
    expect(rec.recommendedMonthlyReserve).toBe(0);
  });

  it('counts 1 month remaining when asOfDate is in December', () => {
    const rec = computeTaxReserve(makeComputedEstimate(lei(18_535)), createTaxReserveState(lei(8_535)), {
      asOfDate: '2026-12-15',
      fiscalYear: 2026,
    });
    expect(rec.monthsRemaining).toBe(1);
    expect(rec.remainingTarget).toBe(lei(10_000));
    expect(rec.recommendedMonthlyReserve).toBe(lei(10_000));
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
    const rec = computeTaxReserve(makeComputedEstimate(lei(18_535)), createTaxReserveState(lei(0)), {
      asOfDate: '2027-01-01',
      fiscalYear: 2026,
    });
    expect(rec.monthsRemaining).toBe(0);
    expect(rec.remainingTarget).toBe(lei(18_535));
    expect(rec.recommendedMonthlyReserve).toBe(0);
  });

  it('is deterministic for identical inputs', () => {
    const a = computeTaxReserve(makeComputedEstimate(lei(18_535)), createTaxReserveState(lei(5_000)), {
      asOfDate: '2026-06-15',
      fiscalYear: 2026,
    });
    const b = computeTaxReserve(makeComputedEstimate(lei(18_535)), createTaxReserveState(lei(5_000)), {
      asOfDate: '2026-06-15',
      fiscalYear: 2026,
    });
    expect(a).toEqual(b);
  });

  it('carries a null reserve through verbatim and targets the full liability', () => {
    const rec = computeTaxReserve(makeComputedEstimate(lei(18_535)), createTaxReserveState(null), {
      asOfDate: '2026-06-15',
      fiscalYear: 2026,
    });
    expect(rec.reservedAmount).toBeNull();
    // null is treated as 0 for the math: the full liability remains to reserve.
    expect(rec.remainingTarget).toBe(lei(18_535));
    expect(rec.monthsRemaining).toBe(7);
    // 1 853 500 bani / 7 = 264 785.714...; the share is rounded to the nearest ban.
    expect(rec.recommendedMonthlyReserve).toBeCloseTo(lei(18_535) / 7, 0);
  });

  it('keeps an explicit zero reserve as zero (distinct from null)', () => {
    const rec = computeTaxReserve(makeComputedEstimate(lei(18_535)), createTaxReserveState(lei(0)), {
      asOfDate: '2026-06-15',
      fiscalYear: 2026,
    });
    expect(rec.reservedAmount).toBe(lei(0));
    expect(rec.remainingTarget).toBe(lei(18_535));
    expect(rec.recommendedMonthlyReserve).toBeCloseTo(lei(18_535) / 7, 0);
  });

  it('derives recommendedMonthlyReserve from its own remainingTarget and monthsRemaining', () => {
    const rec = computeTaxReserve(
      makeComputedEstimate(lei(18_535)),
      createTaxReserveState(lei(5_000)),
      { asOfDate: '2026-06-15', fiscalYear: 2026 },
    );
    // Consistency check: the monthly recommendation must equal the remaining
    // target divided by the months remaining, using fields returned by
    // computeTaxReserve itself (no hardcoded division).
    // precision 0 = within half a ban, which is exactly the rounding error divBani() may introduce.
    expect(rec.recommendedMonthlyReserve).toBeCloseTo(rec.remainingTarget / rec.monthsRemaining, 0);
  });
});

describe('tax reserve state', () => {
  it('creates a state clamped at zero', () => {
    expect(createTaxReserveState(lei(5_000))).toEqual({ reservedAmount: lei(5_000) });
    expect(createTaxReserveState(lei(-10))).toEqual({ reservedAmount: lei(0) });
  });

  it('adds to the reserve without mutating the original state', () => {
    const s0 = createTaxReserveState(lei(5_000));
    const s1 = addToTaxReserve(s0, lei(2_000));
    expect(s1).toEqual({ reservedAmount: lei(7_000) });
    expect(s0).toEqual({ reservedAmount: lei(5_000) });
  });

  it('treats a negative add as a withdrawal clamped at zero', () => {
    const s0 = createTaxReserveState(lei(1_000));
    expect(addToTaxReserve(s0, lei(-400))).toEqual({ reservedAmount: lei(600) });
    expect(addToTaxReserve(s0, lei(-5_000))).toEqual({ reservedAmount: lei(0) });
  });

  it('passes null through as "no data recorded"', () => {
    expect(createTaxReserveState(null)).toEqual({ reservedAmount: null });
  });

  it('adds to a null state, recording the clamped amount', () => {
    const s0 = createTaxReserveState(null);
    expect(addToTaxReserve(s0, lei(3_000))).toEqual({ reservedAmount: lei(3_000) });
    expect(addToTaxReserve(s0, lei(-400))).toEqual({ reservedAmount: lei(0) });
    // The original null state is never mutated.
    expect(s0).toEqual({ reservedAmount: null });
  });
});
