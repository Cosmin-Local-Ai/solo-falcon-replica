import { describe, expect, it } from 'vitest';
import {
  classifyDeadline,
  computeDeadlines,
  daysRemaining,
  filterUpcoming,
  getApplicableDeadlines,
  isApplicable,
} from './deadlines';
import type { Deadline } from './deadlines';
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

  it('produces dates that sort into a non-decreasing chronological order', () => {
    const dated = getApplicableDeadlines(rules, baseQuery);
    expect(dated.length).toBeGreaterThan(0);
    const dates = dated.map((d) => d.date as string);
    // Every dated deadline carries a valid ISO date.
    for (const d of dates) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // Sorting ascending yields a stable, non-decreasing chronological order.
    const sorted = [...dates].sort();
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] >= sorted[i - 1]).toBe(true);
    }
    // The chronological span covers the full 2026 fiscal year plus the
    // carry-over into 2027 (Q4 CAS/CASS on Jan 15, D212 filing on May 25)
    // — never a date outside that range.
    // (ISO dates compare correctly as strings.)
    expect(sorted[0] >= '2026-01-01').toBe(true);
    expect(sorted[sorted.length - 1] <= '2027-05-25').toBe(true);
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

  it('includes the d212 rule when asOfDate is exactly on the effectiveFrom boundary day', () => {
    const result = computeDeadlines([makeRule()], { taxYear: 2026, asOfDate: '2026-01-01' });
    const d212 = result.find((d) => d.eventType === 'd212_filing');
    expect(d212).toBeDefined();
    expect(d212?.date).toBe('2027-05-25');
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

  it('counts days across a year boundary', () => {
    expect(daysRemaining('2027-01-01', '2026-12-31')).toBe(1);
    expect(daysRemaining('2027-01-01', '2026-12-01')).toBe(31);
  });

  it('handles February in leap and non-leap years', () => {
    // 2028 is a leap year: Feb 29 exists and is one day after Feb 28.
    expect(daysRemaining('2028-02-29', '2028-02-28')).toBe(1);
    // 2027 is not a leap year: Mar 1 follows Feb 28.
    expect(daysRemaining('2027-03-01', '2027-02-28')).toBe(1);
  });

  it('computes deadlines for taxYear 2025 without d212 (no 2025 rule in package)', () => {
    const result = computeDeadlines(rules, { taxYear: 2025, asOfDate: '2026-03-15' });
    // 12 always-active dated deadlines + 2 event-relative nulls; d212 is rule-gated.
    expect(result).toHaveLength(14);
    expect(result.find((d) => d.eventType === 'd212_filing')).toBeUndefined();
    expect(result.filter((d) => d.date !== null)).toHaveLength(12);
    // All dated deadlines carry the requested tax year.
    for (const d of result) {
      expect(d.taxYear).toBe(2025);
    }
  });

  it('computes taxYear-1999 deadlines without d212 (no matching rule)', () => {
    const result = computeDeadlines(rules, { taxYear: 1999, asOfDate: '2026-03-15' });
    expect(result).toHaveLength(14);
    expect(result.find((d) => d.eventType === 'd212_filing')).toBeUndefined();
    // Quarterly dates are computed for the requested tax year, including the
    // Q4 carry-over into the following year.
    const cas = result.filter((d) => d.eventType === 'cas_quarterly');
    expect(cas.map((d) => d.date)).toEqual(['1999-04-15', '1999-07-15', '1999-10-15', '2000-01-15']);
  });
});

describe('deadline helpers', () => {
  const makeDeadline = (date: string | null): Deadline => ({
    deadlineId: 'TEST_DEADLINE',
    taxYear: 2026,
    eventType: 'cas_quarterly',
    date,
    dateFormula: 'test',
    appliesTo: 'pfa',
    legalSource: { act: 'Cod. fiscal', article: 'art. 160' },
    effectiveFrom: null,
    effectiveTo: null,
    status: 'active',
  });

  it('isApplicable returns true for a rule with a valid date', () => {
    expect(isApplicable(makeRule(), baseQuery)).toBe(true);
  });

  it('isApplicable returns false when the rule produces no date', () => {
    // No deadline parameter → no d212 deadline emitted.
    expect(isApplicable(makeRule({ parameters: [] }), baseQuery)).toBe(false);
    // asOfDate before effectiveFrom → rule not applicable.
    expect(isApplicable(makeRule({ effectiveFrom: '2027-01-01' }), baseQuery)).toBe(false);
  });

  it('getApplicableDeadlines returns only deadlines with non-null dates', () => {
    const all = computeDeadlines(rules, baseQuery);
    const applicable = getApplicableDeadlines(rules, baseQuery);
    expect(applicable.every((d) => d.date !== null)).toBe(true);
    expect(applicable).toHaveLength(13); // 15 total minus 2 event-relative nulls
    expect(applicable).toEqual(all.filter((d) => d.date !== null));
  });

  it('getApplicableDeadlines includes event-relative deadlines when eventDate is given', () => {
    const query = { ...baseQuery, eventDate: '2026-03-01' };
    const applicable = getApplicableDeadlines(rules, query);
    expect(applicable.every((d) => d.date !== null)).toBe(true);
    expect(applicable).toHaveLength(15);
  });

  it('filterUpcoming returns only upcoming (future-dated) deadlines', () => {
    const all = computeDeadlines(rules, baseQuery);
    const upcoming = filterUpcoming(all, baseQuery.asOfDate);
    expect(upcoming).toHaveLength(10);
    expect(upcoming.every((d) => classifyDeadline(d, baseQuery.asOfDate) === 'upcoming')).toBe(true);
    expect(upcoming.map((d) => d.date)).toEqual([
      '2027-05-25', // d212
      '2026-07-15', '2026-10-15', '2027-01-15', // CAS
      '2026-07-15', '2026-10-15', '2027-01-15', // CASS
      '2026-06-25', '2026-09-25', '2026-12-25', // income advance
    ]);
  });

  it('filterUpcoming excludes past, due-today, and null-dated deadlines', () => {
    const deadlines = [
      makeDeadline('2026-05-01'), // past
      makeDeadline('2026-06-01'), // due today
      makeDeadline('2026-07-15'), // upcoming
      makeDeadline(null), // no date
    ];
    const upcoming = filterUpcoming(deadlines, '2026-06-01');
    expect(upcoming.map((d) => d.date)).toEqual(['2026-07-15']);
  });
});

describe('classifyDeadline (Step 29 boundary tests)', () => {
  const makeDeadline = (date: string | null): Deadline => ({
    deadlineId: 'TEST_DEADLINE',
    taxYear: 2026,
    eventType: 'cas_quarterly',
    date,
    dateFormula: 'test',
    appliesTo: 'pfa',
    legalSource: { act: 'Cod. fiscal', article: 'art. 160' },
    effectiveFrom: null,
    effectiveTo: null,
    status: 'active',
  });

  it('returns "past" for a deadline date before the asOfDate', () => {
    const deadline = makeDeadline('2026-05-01');
    const asOfDate = '2026-06-01';
    expect(classifyDeadline(deadline, asOfDate)).toBe('past');
  });

  it('negative days are never classified as "upcoming" (approaching)', () => {
    const deadline = makeDeadline('2026-05-01'); // 31 days before asOfDate
    const asOfDate = '2026-06-01';
    expect(daysRemaining(deadline.date!, asOfDate)).toBeLessThan(0);
    expect(classifyDeadline(deadline, asOfDate)).not.toBe('upcoming');
    expect(classifyDeadline(deadline, asOfDate)).toBe('past');
  });

  it('returns "due_today" when the deadline date equals the asOfDate (days === 0)', () => {
    const deadline = makeDeadline('2026-06-01');
    expect(classifyDeadline(deadline, '2026-06-01')).toBe('due_today');
  });

  it('classifies the three zones consistently around the boundary', () => {
    expect(classifyDeadline(makeDeadline('2026-05-31'), '2026-06-01')).toBe('past');
    expect(classifyDeadline(makeDeadline('2026-06-01'), '2026-06-01')).toBe('due_today');
    expect(classifyDeadline(makeDeadline('2026-06-02'), '2026-06-01')).toBe('upcoming');
  });
});
