import { describe, expect, it } from 'vitest';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import {
  breachMeaningFor,
  computeThresholds,
  statusFor,
  statusForRatioRule,
  withRatioRuleStatus,
  type FiscalThreshold,
  type RatioRule,
  type RatioRuleStatus,
  type ThresholdQuery,
} from './thresholds';

const QUERY: ThresholdQuery = {
  taxYear: 2026,
  asOfDate: '2026-03-15',
  currentValue: 100000,
  fiscalBase: 'gross-revenue',
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
    const q: ThresholdQuery = { taxYear: 2026, asOfDate: '2026-06-15', currentValue: 10000, fiscalBase: 'gross-revenue', ruleRelease: '2026-01-01' };
    const r = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q);
    // 10000 < 48600 (CAS_MIN_BASE) → distance = 10000 - 48600 = -38600
    const casMin = r.find(t => t.thresholdId === 'CAS_MIN_BASE')!;
    expect(casMin.distance).toBe(-38600);
    expect(casMin.status).toBe('breached');
  });

  it('exactly at threshold → zero distance', () => {
    const q: ThresholdQuery = { taxYear: 2026, asOfDate: '2026-06-15', currentValue: 48600, fiscalBase: 'gross-revenue', ruleRelease: '2026-01-01' };
    const r = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q);
    const casMin = r.find(t => t.thresholdId === 'CAS_MIN_BASE')!;
    expect(casMin.distance).toBe(0);
    expect(casMin.status).toBe('warning'); // at threshold = warning boundary
  });

  it('returns thresholds for 2025', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, {
      taxYear: 2025,
      asOfDate: '2025-06-15',
      currentValue: 100000,
      fiscalBase: 'gross-revenue',
      ruleRelease: '2025-01-01',
    });
    expect(result).toBeDefined();
  });

  it('every threshold has a source field', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    for (const t of result) {
      expect(t.source).toBeDefined();
    }
  });

  it('daysUntilWarning is deterministic', () => {
    const q1: ThresholdQuery = { taxYear: 2026, asOfDate: '2026-06-15', currentValue: 100000, fiscalBase: 'gross-revenue', ruleRelease: '2026-01-01' };
    const q2: ThresholdQuery = { taxYear: 2026, asOfDate: '2026-06-15', currentValue: 100000, fiscalBase: 'gross-revenue', ruleRelease: '2026-01-01' };
    const r1 = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q1);
    const r2 = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q2);
    expect(r1).toEqual(r2);
  });

  it('just above threshold → positive distance', () => {
    const q: ThresholdQuery = { taxYear: 2026, asOfDate: '2026-06-15', currentValue: 48601, fiscalBase: 'gross-revenue', ruleRelease: '2026-01-01' };
    const r = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q);
    const casMin = r.find(t => t.thresholdId === 'CAS_MIN_BASE')!;
    expect(casMin.distance).toBeGreaterThan(0);
  });

  it('max-base breach: currentValue above 97200 → status breached', () => {
    const q: ThresholdQuery = {
      taxYear: 2026,
      asOfDate: '2026-03-15',
      currentValue: 100000,
      fiscalBase: 'gross-revenue',
      ruleRelease: 'PFA_2026_RELEASE',
    };
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q);
    const casMax = byId(result, 'CAS_MAX_BASE');
    expect(casMax.distance).toBe(100000 - 97200);
    expect(casMax.status).toBe('breached');
  });

  it('registration breach: currentValue at/above 395000 → status breached', () => {
    const q: ThresholdQuery = {
      taxYear: 2026,
      asOfDate: '2026-03-15',
      currentValue: 400000,
      fiscalBase: 'gross-revenue',
      ruleRelease: 'PFA_2026_RELEASE',
    };
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q);
    const vat = byId(result, 'VAT_REGISTRATION');
    expect(vat.distance).toBe(400000 - 395000);
    expect(vat.status).toBe('breached');
  });

  it('warningDistance is exactly 10% of the threshold value', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    expect(byId(result, 'CAS_MIN_BASE').warningDistance).toBe(4860); // 48600 * 0.1
    expect(byId(result, 'CAS_MAX_BASE').warningDistance).toBe(9720); // 97200 * 0.1
    expect(byId(result, 'CASS_MIN_BASE').warningDistance).toBe(2430); // 24300 * 0.1
    expect(byId(result, 'CASS_MAX_BASE').warningDistance).toBe(29160); // 291600 * 0.1
    expect(byId(result, 'VAT_REGISTRATION').warningDistance).toBe(39500); // 395000 * 0.1
  });

  it('min-base warning band end-to-end: distance exactly at +warningDistance → warning, just beyond → ok', () => {
    const q: ThresholdQuery = {
      taxYear: 2026,
      asOfDate: '2026-03-15',
      currentValue: 53460, // 48600 + 4860 → distance exactly +warningDistance
      fiscalBase: 'gross-revenue',
      ruleRelease: 'PFA_2026_RELEASE',
    };
    const casMin = byId(computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q), 'CAS_MIN_BASE');
    expect(casMin.distance).toBe(4860);
    expect(casMin.status).toBe('warning');

    const casMin2 = byId(
      computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, { ...q, currentValue: 53461 }),
      'CAS_MIN_BASE',
    );
    expect(casMin2.distance).toBe(4861);
    expect(casMin2.status).toBe('ok'); // just outside the band
  });

  it('max-base warning band end-to-end: distance exactly at -warningDistance → warning, just beyond → ok', () => {
    const q: ThresholdQuery = {
      taxYear: 2026,
      asOfDate: '2026-03-15',
      currentValue: 87480, // 97200 - 9720 → distance exactly -warningDistance
      fiscalBase: 'gross-revenue',
      ruleRelease: 'PFA_2026_RELEASE',
    };
    const casMax = byId(computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q), 'CAS_MAX_BASE');
    expect(casMax.distance).toBe(-9720);
    expect(casMax.status).toBe('warning');

    const casMax2 = byId(
      computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, { ...q, currentValue: 87479 }),
      'CAS_MAX_BASE',
    );
    expect(casMax2.distance).toBe(-9721);
    expect(casMax2.status).toBe('ok'); // just outside the band
  });

  it('registration warning band end-to-end: negative distance within the band → warning, beyond → ok', () => {
    const q: ThresholdQuery = {
      taxYear: 2026,
      asOfDate: '2026-03-15',
      currentValue: 355500, // 395000 - 39500 → distance exactly -warningDistance
      fiscalBase: 'gross-revenue',
      ruleRelease: 'PFA_2026_RELEASE',
    };
    const vat = byId(computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q), 'VAT_REGISTRATION');
    expect(vat.distance).toBe(-39500);
    expect(vat.status).toBe('warning');

    const vat2 = byId(
      computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, { ...q, currentValue: 355499 }),
      'VAT_REGISTRATION',
    );
    expect(vat2.distance).toBe(-39501);
    expect(vat2.status).toBe('ok'); // just outside the band
  });

  // --- Step 29: fiscal base, breachMeaning, and validation ---

  it('every threshold carries the query fiscalBase', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    for (const t of result) {
      expect(t.fiscalBase).toBe('gross-revenue');
    }
  });

  it('every threshold has a non-empty breachMeaning', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    for (const t of result) {
      expect(typeof t.breachMeaning).toBe('string');
      expect(t.breachMeaning.length).toBeGreaterThan(0);
    }
  });

  it('min-base breachMeaning mentions disqualification', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    const casMin = byId(result, 'CAS_MIN_BASE');
    expect(casMin.breachMeaning).toContain('dezcalificare');
  });

  it('max-base breachMeaning mentions regime change', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    const casMax = byId(result, 'CAS_MAX_BASE');
    expect(casMax.breachMeaning).toContain('schimbare de regim');
  });

  it('registration breachMeaning mentions registration obligation', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    const vat = byId(result, 'VAT_REGISTRATION');
    expect(vat.breachMeaning).toContain('obligația de înregistrare');
  });

  it('mismatched fiscal base → all specs skipped (empty result)', () => {
    const q: ThresholdQuery = {
      taxYear: 2026,
      asOfDate: '2026-03-15',
      currentValue: 100000,
      fiscalBase: 'net-income',
      ruleRelease: 'PFA_2026_RELEASE',
    };
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q);
    expect(result).toHaveLength(0);
  });

  it('gross-expenses base → all specs skipped (empty result)', () => {
    const q: ThresholdQuery = {
      taxYear: 2026,
      asOfDate: '2026-03-15',
      currentValue: 100000,
      fiscalBase: 'gross-expenses',
      ruleRelease: 'PFA_2026_RELEASE',
    };
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q);
    expect(result).toHaveLength(0);
  });
});

describe('income threshold type (Step 29)', () => {
  it('statusFor: income breached when distance > 0', () => {
    expect(statusFor('income', 1, 100)).toBe('breached');
    expect(statusFor('income', 1000, 100)).toBe('breached');
  });

  it('statusFor: income warning when approaching the threshold (distance near 0)', () => {
    expect(statusFor('income', 0, 100)).toBe('warning');
    expect(statusFor('income', -50, 100)).toBe('warning');
  });

  it('statusFor: income ok when distance < -warningDistance', () => {
    expect(statusFor('income', -101, 100)).toBe('ok');
    expect(statusFor('income', -500, 100)).toBe('ok');
  });

  it('statusFor: min-base breached when below minimum, ok when above', () => {
    expect(statusFor('min-base', -100, 50)).toBe('breached');
    expect(statusFor('min-base', 100, 50)).toBe('ok');
  });

  it('statusFor: max-base breached when above maximum, ok when below', () => {
    expect(statusFor('max-base', 100, 50)).toBe('breached');
    expect(statusFor('max-base', -100, 50)).toBe('ok');
  });

  it('statusFor: registration breached at/above threshold, ok below', () => {
    expect(statusFor('registration', 100, 50)).toBe('breached');
    expect(statusFor('registration', 0, 50)).toBe('breached'); // exactly at threshold
    expect(statusFor('registration', -100, 50)).toBe('ok');
  });

  it('statusFor: min-base warning band outer boundary (exactly +warningDistance → warning, beyond → ok)', () => {
    expect(statusFor('min-base', 50, 50)).toBe('warning'); // exactly at +warningDistance
    expect(statusFor('min-base', 49, 50)).toBe('warning'); // inside the band
    expect(statusFor('min-base', 0, 50)).toBe('warning'); // exactly at threshold
    expect(statusFor('min-base', 51, 50)).toBe('ok'); // just outside the band
  });

  it('statusFor: max-base warning band outer boundary (exactly -warningDistance → warning, beyond → ok)', () => {
    expect(statusFor('max-base', -50, 50)).toBe('warning'); // exactly at -warningDistance
    expect(statusFor('max-base', -49, 50)).toBe('warning'); // inside the band
    expect(statusFor('max-base', 0, 50)).toBe('warning'); // exactly at threshold
    expect(statusFor('max-base', -51, 50)).toBe('ok'); // just outside the band
  });

  it('statusFor: registration warning band (negative distance within the band → warning, beyond → ok)', () => {
    expect(statusFor('registration', -50, 50)).toBe('warning'); // exactly at -warningDistance
    expect(statusFor('registration', -49, 50)).toBe('warning'); // inside the band
    expect(statusFor('registration', -51, 50)).toBe('ok'); // just outside the band
  });

  it('breachMeaningFor: income returns the tax obligation message', () => {
    expect(breachMeaningFor('income')).toBe(
      'Peste pragul de venit — se declanșează obligația fiscală suplimentară',
    );
  });

  it('income has no fiscal rule spec (conceptual completeness only)', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    expect(result.every((t) => t.type !== 'income')).toBe(true);
  });
});

describe('ratio rule status (Step 29)', () => {
  const rule = (over: Partial<RatioRule> = {}): RatioRule => ({
    id: 'rule-1',
    label: 'Test rule',
    current: 0,
    limit: 100,
    breached: false,
    ratio: 0,
    ...over,
  });

  it('ok below the warning band (ratio < 0.8)', () => {
    expect(statusForRatioRule(rule({ current: 50, ratio: 0.5 }))).toBe('ok');
    expect(statusForRatioRule(rule({ current: 79, ratio: 0.79 }))).toBe('ok');
  });

  it('warning at the boundary (ratio >= 0.8)', () => {
    expect(statusForRatioRule(rule({ current: 80, ratio: 0.8 }))).toBe('warning');
    expect(statusForRatioRule(rule({ current: 95, ratio: 0.95 }))).toBe('warning');
  });

  it('breached flag always wins over ratio', () => {
    expect(statusForRatioRule(rule({ current: 120, limit: 100, ratio: 1.2, breached: true }))).toBe('breached');
    // Even a low ratio is 'breached' when the caller flags it (e.g. zero-limit rule).
    expect(statusForRatioRule(rule({ current: 10, limit: 0, ratio: null, breached: true }))).toBe('breached');
  });

  it('zero-limit rule ("no cap"): current > 0 → breached, ratio stays null', () => {
    const r = rule({ current: 10, limit: 0, ratio: null, breached: true });
    expect(r.ratio).toBeNull();
    expect(statusForRatioRule(r)).toBe('breached');
  });

  it('zero-limit rule ("no cap"): current === 0 → ok, ratio stays null', () => {
    const r = rule({ current: 0, limit: 0, ratio: null, breached: false });
    expect(r.ratio).toBeNull();
    expect(statusForRatioRule(r)).toBe('ok');
  });

  it('withRatioRuleStatus attaches the derived status without mutating the input', () => {
    const r = rule({ current: 90, ratio: 0.9 });
    const withStatus = withRatioRuleStatus(r);
    expect(withStatus.status).toBe('warning');
    expect(withStatus.breached).toBe(false);
    // Input is not mutated and keeps its other fields.
    expect(r.status).toBeUndefined();
    expect(withStatus.id).toBe(r.id);
    expect(withStatus.current).toBe(r.current);
  });

  it('withRatioRuleStatus preserves extra fields (structural compatibility with the dashboard rule shape)', () => {
    // Mirrors the anonymous shape produced by src/data/dashboard.ts, which
    // carries an extra `type` field.
    const dashboardRule = {
      id: 'CAS_MIN_BASE',
      label: 'pfa-revenue',
      current: 100000,
      limit: 48600,
      ratio: 100000 / 48600,
      breached: true,
      type: 'income' as const,
    };
    const withStatus = withRatioRuleStatus(dashboardRule);
    expect(withStatus.status).toBe('breached');
    expect(withStatus.type).toBe('income');
  });

  it('status union is exhaustive', () => {
    const all: RatioRuleStatus[] = ['ok', 'warning', 'breached'];
    expect(all).toEqual(['ok', 'warning', 'breached']);
  });
});
