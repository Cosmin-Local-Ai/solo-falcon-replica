import { describe, expect, it } from 'vitest';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import { computeThresholds, type FiscalThreshold, type ThresholdQuery } from './thresholds';

const QUERY = {
  taxYear: 2026,
  asOfDate: '2026-03-15',
  currentValue: 100000,
  ruleRelease: 'PFA_2026_RELEASE',
};

const byId = (thresholds: FiscalThreshold[], id: string) =>
  thresholds.find((t) => t.thresholdId === id)!;

describe('computeThresholds', () => {
  it('returns 5 thresholds for 2026', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    expect(result).toHaveLength(5);
  });

  it('CAS min base: thresholdValue 48600, distance = currentValue - 48600', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    const casMin = byId(result, 'CAS_MIN_BASE');
    expect(casMin.type).toBe('min-base');
    expect(casMin.affectedTax).toBe('cas');
    expect(casMin.thresholdValue).toBe(48600);
    expect(casMin.distance).toBe(100000 - 48600);
  });

  it('CAS max base: thresholdValue 97200', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    const casMax = byId(result, 'CAS_MAX_BASE');
    expect(casMax.type).toBe('max-base');
    expect(casMax.affectedTax).toBe('cas');
    expect(casMax.thresholdValue).toBe(97200);
  });

  it('CASS min base: thresholdValue 24300', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    const cassMin = byId(result, 'CASS_MIN_BASE');
    expect(cassMin.type).toBe('min-base');
    expect(cassMin.affectedTax).toBe('cass');
    expect(cassMin.thresholdValue).toBe(24300);
  });

  it('CASS max base: thresholdValue 291600', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    const cassMax = byId(result, 'CASS_MAX_BASE');
    expect(cassMax.type).toBe('max-base');
    expect(cassMax.affectedTax).toBe('cass');
    expect(cassMax.thresholdValue).toBe(291600);
  });

  it('VAT: thresholdValue 395000, effectiveDate 2025-09-01', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    const vat = byId(result, 'VAT_REGISTRATION');
    expect(vat.type).toBe('registration');
    expect(vat.affectedTax).toBe('vat');
    expect(vat.thresholdValue).toBe(395000);
    expect(vat.effectiveDate).toBe('2025-09-01');
  });

  it('is deterministic: same input produces equal output', () => {
    const first = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    const second = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    expect(second).toEqual(first);
  });

  it('below threshold → negative distance', () => {
    const q: ThresholdQuery = { taxYear: 2026, asOfDate: '2026-06-15', currentValue: 10000, ruleRelease: '2026-01-01' };
    const r = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q);
    // 10000 < 48600 (CAS_MIN_BASE) → distance = 10000 - 48600 = -38600
    const casMin = r.find(t => t.thresholdId === 'CAS_MIN_BASE')!;
    expect(casMin.distance).toBe(-38600);
    expect(casMin.status).toBe('breached');
  });

  it('exactly at threshold → zero distance', () => {
    const q: ThresholdQuery = { taxYear: 2026, asOfDate: '2026-06-15', currentValue: 48600, ruleRelease: '2026-01-01' };
    const r = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q);
    const casMin = r.find(t => t.thresholdId === 'CAS_MIN_BASE')!;
    expect(casMin.distance).toBe(0);
    expect(casMin.status).toBe('warning'); // at threshold = warning boundary
  });

  it('returns thresholds for 2025', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, { taxYear: 2025 });
    expect(result).toBeDefined();
  });

  it('every threshold has a source field', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    for (const t of result) {
      expect(t.source).toBeDefined();
    }
  });

  it('daysUntilWarning is deterministic', () => {
    const q1: ThresholdQuery = { taxYear: 2026, asOfDate: '2026-06-15', currentValue: 100000, ruleRelease: '2026-01-01' };
    const q2: ThresholdQuery = { taxYear: 2026, asOfDate: '2026-06-15', currentValue: 100000, ruleRelease: '2026-01-01' };
    const r1 = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q1);
    const r2 = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q2);
    expect(r1).toEqual(r2);
  });

  it('just above threshold → positive distance', () => {
    const q: ThresholdQuery = { taxYear: 2026, asOfDate: '2026-06-15', currentValue: 48601, ruleRelease: '2026-01-01' };
    const r = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q);
    const casMin = r.find(t => t.thresholdId === 'CAS_MIN_BASE')!;
    expect(casMin.distance).toBeGreaterThan(0);
  });
});
