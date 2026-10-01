import { describe, expect, it } from 'vitest';
import { computeDeadlines, daysRemaining } from './deadlines';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import type { FiscalRule } from './fiscal/rules';

const rules = PFA_2026_SYSTEM_REAL_PACKAGE;
const baseQuery = { taxYear: 2026, asOfDate: '2026-06-01' };

const makeRule = (overrides: Partial<FiscalRule> = {}): FiscalRule => ({
  ruleId: 'PFA_DEADLINE_2026',
  name: 'PFA single deadline 2026',
  jurisdiction: 'RO',
  entityType: 'PFA',
  taxRegime: 'deadlines',
  taxYear: 2026,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  parameters: [
    { id: 'deadline', label: 'Single deadline', value: '2027-05-25', unit: 'date' },
  ],
  calculatorId: 'calc-deadline',
  sourceAct: 'ANAF 2026',
  sourceArticle: 'art. 122(3)',
  sourceUrl: 'https://www.anaf.ro',
  verifiedAt: '2026-01-01',
  status: 'ACTIVE',
  version: 1,
  ...overrides,
});

describe('computeDeadlines', () => {
  it('returns 15 deadlines for taxYear 2026 without eventDate', () => {
    const result = computeDeadlines(rules, baseQuery);
    expect(result).toHaveLength(15);
  });

  it('resolves D212 date from the rule (2027-05-25)', () => {
    const result = computeDeadlines(rules, baseQuery);
    const d212 = result.find((d) => d.eventType === 'd212_filing');
    expect(d212?.date).toBe('2027-05-25');
    expect(d212?.status).toBe('active');
    expect(d212?.effectiveFrom).toBe('2026-01-01');
  });

  it('computes CAS quarterly dates', () => {
    const result = computeDeadlines(rules, baseQuery);
    const cas = result.filter((d) => d.eventType === 'cas_quarterly');
    expect(cas.map((d) => d.date)).toEqual([
      '2026-04-15',
      '2026-07-15',
      '2026-10-15',
      '2027-01-15',
    ]);
  });

  it('computes CASS quarterly dates', () => {
    const result = computeDeadlines(rules, baseQuery);
    const cass = result.filter((d) => d.eventType === 'cass_quarterly');
    expect(cass.map((d) => d.date)).toEqual([
      '2026-04-15',
      '2026-07-15',
      '2026-10-15',
      '2027-01-15',
    ]);
  });

  it('computes income tax advance dates', () => {
    const result = computeDeadlines(rules, baseQuery);
    const adv = result.filter((d) => d.eventType === 'income_tax_advance');
    expect(adv.map((d) => d.date)).toEqual([
      '2026-03-25',
      '2026-06-25',
      '2026-09-25',
      '2026-12-25',
    ]);
  });

  it('respects tax-year applicability (no 2026 deadlines for taxYear 2027)', () => {
    const result = computeDeadlines(rules, { taxYear: 2027, asOfDate: '2027-06-01' });
    expect(result.filter((d) => d.taxYear === 2026)).toHaveLength(0);
  });

  it('computes event-relative deadlines when eventDate is given', () => {
    const result = computeDeadlines(rules, {
      taxYear: 2026,
      asOfDate: '2026-06-01',
      eventDate: '2026-03-01',
    });
    const pfa = result.find((d) => d.eventType === 'pfa_estimated_declaration');
    expect(pfa?.date).toBe('2026-03-16');
    const vat = result.find((d) => d.eventType === 'vat_registration');
    expect(vat?.date).toBe('2026-04-30');
  });

  it('leaves event-relative dates null without eventDate', () => {
    const result = computeDeadlines(rules, baseQuery);
    const pfa = result.find((d) => d.eventType === 'pfa_estimated_declaration');
    expect(pfa?.date).toBeNull();
    const vat = result.find((d) => d.eventType === 'vat_registration');
    expect(vat?.date).toBeNull();
  });

  it('omits d212 when no deadlines rule is applicable', () => {
    const noDeadlineRules = rules.filter((r) => r.taxRegime !== 'deadlines');
    const result = computeDeadlines(noDeadlineRules, baseQuery);
    expect(result.find((d) => d.eventType === 'd212_filing')).toBeUndefined();
    expect(result).toHaveLength(14);
  });

  it('is deterministic (two calls return equal results)', () => {
    const a = computeDeadlines(rules, baseQuery);
    const b = computeDeadlines(rules, baseQuery);
    expect(b).toEqual(a);
  });
});

describe('effective-date applicability', () => {
  it('excludes the d212 rule when asOfDate is before effectiveFrom', () => {
    const result = computeDeadlines([makeRule()], { taxYear: 2026, asOfDate: '2025-12-31' });
    expect(result.find((d) => d.eventType === 'd212_filing')).toBeUndefined();
  });

  it('includes the d212 rule when asOfDate is on/after effectiveFrom', () => {
    const result = computeDeadlines([makeRule()], { taxYear: 2026, asOfDate: '2026-06-01' });
    const d212 = result.find((d) => d.eventType === 'd212_filing');
    expect(d212?.date).toBe('2027-05-25');
    expect(d212?.status).toBe('active');
  });
});

describe('daysRemaining', () => {
  it('counts days before the deadline', () => {
    expect(daysRemaining('2027-05-25', '2027-05-20')).toBe(5);
  });

  it('is zero on the deadline', () => {
    expect(daysRemaining('2027-05-25', '2027-05-25')).toBe(0);
  });

  it('is negative after the deadline', () => {
    expect(daysRemaining('2027-05-25', '2027-05-26')).toBe(-1);
  });

  it('computes deadlines for taxYear 2025', () => {
    const result = computeDeadlines(rules, { taxYear: 2025 });
    expect(result).toBeDefined();
  });

  it('returns a result for a year with no matching rules', () => {
    const result = computeDeadlines(rules, { taxYear: 1999 });
    expect(result).toBeDefined();
  });
});
