import { describe, expect, it } from 'vitest';
import { selectApplicableRules } from './select';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';
import type { FiscalRule } from './rules';

/**
 * Deterministic domain tests for fiscal rule selection (Step 11).
 *
 * These ADD to `fiscal.test.ts` (which already covers package integrity, the
 * 7-rule H1 2026 selection, H1 exclusion after 2026-06-30, and empty-for-2025).
 * This file fills the remaining gaps in the `selectApplicableRules` contract:
 *   - exact boundary inclusivity (asOfDate === effectiveFrom / effectiveTo)
 *   - off-by-one exclusion (one day before effectiveFrom / after effectiveTo)
 *   - non-ACTIVE status exclusion
 *   - open-ended effectiveTo (null) staying applicable
 *   - determinism / ruleId sort order
 *   - provenance fields present on returned rules
 */

/** Build a minimal valid rule; override fields per test. */
function makeRule(overrides: Partial<FiscalRule> = {}): FiscalRule {
  return {
    ruleId: 'TEST_RULE',
    name: 'Test rule',
    jurisdiction: 'RO',
    entityType: 'PFA',
    taxRegime: 'cas',
    taxYear: 2026,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    parameters: [{ id: 'x', label: 'x', value: 1, unit: 'lei' }],
    calculatorId: 'calc-test',
    sourceAct: 'TEST',
    sourceArticle: 'art. 1',
    sourceUrl: 'https://example.test',
    verifiedAt: '2026-01-01',
    status: 'ACTIVE',
    version: 1,
    ...overrides,
  };
}

const PKG = PFA_2026_SYSTEM_REAL_PACKAGE;
const select = (asOfDate: string, taxYear = 2026) =>
  selectApplicableRules(PKG, { taxYear, asOfDate });
const idsOf = (rules: FiscalRule[]) => rules.map((r) => r.ruleId);

describe('selectApplicableRules — effective-date boundaries', () => {
  it('includes a rule on its exact effectiveFrom date (inclusive)', () => {
    // H2 wage rule is effective from 2026-07-01.
    const ids = idsOf(select('2026-07-01'));
    expect(ids).toContain('GENERAL_MINIMUM_WAGE_2026_H2');
  });

  it('includes a rule on its exact effectiveTo date (inclusive)', () => {
    // H1 wage rule is effective until 2026-06-30.
    const ids = idsOf(select('2026-06-30'));
    expect(ids).toContain('GENERAL_MINIMUM_WAGE_2026_H1');
  });

  it('excludes a rule one day before its effectiveFrom', () => {
    // 2026-06-30 is one day before H2's effectiveFrom (2026-07-01).
    const ids = idsOf(select('2026-06-30'));
    expect(ids).not.toContain('GENERAL_MINIMUM_WAGE_2026_H2');
  });

  it('excludes a rule one day after its effectiveTo', () => {
    // 2026-07-01 is one day after H1's effectiveTo (2026-06-30).
    const ids = idsOf(select('2026-07-01'));
    expect(ids).not.toContain('GENERAL_MINIMUM_WAGE_2026_H1');
  });

  it('includes a rule whose effectiveFrom precedes the tax year', () => {
    // VAT threshold is effective from 2025-09-01 but belongs to taxYear 2026.
    const ids = idsOf(select('2025-12-31'));
    expect(ids).toContain('VAT_THRESHOLD_2026');
  });

  it('keeps a rule with an open-ended effectiveTo (null) applicable late in the year', () => {
    // CAS has no effectiveTo; it must still apply on 2026-12-31.
    const ids = idsOf(select('2026-12-31'));
    expect(ids).toContain('CAS_2026');
  });
});

describe('selectApplicableRules — status filtering', () => {
  it('excludes non-ACTIVE rules (PROPOSED / SUPERSEDED) and keeps ACTIVE', () => {
    const proposed = makeRule({ ruleId: 'TEST_PROPOSED', status: 'PROPOSED' });
    const superseded = makeRule({ ruleId: 'TEST_SUPERSEDED', status: 'SUPERSEDED' });
    const active = makeRule({ ruleId: 'TEST_ACTIVE', status: 'ACTIVE' });

    const selected = selectApplicableRules(
      [proposed, superseded, active],
      { taxYear: 2026, asOfDate: '2026-03-15' },
    );
    expect(idsOf(selected)).toEqual(['TEST_ACTIVE']);
  });

  it('excludes a non-ACTIVE rule even when its date window matches', () => {
    const draft = makeRule({
      ruleId: 'TEST_DRAFT',
      status: 'PROPOSED',
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
    });
    expect(idsOf(selectApplicableRules([draft], { taxYear: 2026, asOfDate: '2026-03-15' }))).toEqual([]);
  });
});

describe('selectApplicableRules — determinism and ordering', () => {
  it('returns the same ruleId order for identical input (deterministic)', () => {
    const a = select('2026-03-15');
    const b = select('2026-03-15');
    expect(idsOf(a)).toEqual(idsOf(b));
  });

  it('orders results by ruleId (localeCompare)', () => {
    const ids = idsOf(select('2026-03-15'));
    expect(ids).toEqual([...ids].sort((x, y) => x.localeCompare(y)));
  });
});

describe('selectApplicableRules — provenance on returned rules', () => {
  it('keeps sourceAct / sourceArticle / sourceUrl present and non-empty', () => {
    for (const rule of select('2026-03-15')) {
      expect(rule.sourceAct).toBeTypeOf('string');
      expect(rule.sourceArticle).toBeTypeOf('string');
      expect(rule.sourceUrl).toBeTypeOf('string');
      expect(rule.sourceAct.length).toBeGreaterThan(0);
      expect(rule.sourceArticle.length).toBeGreaterThan(0);
      expect(rule.sourceUrl.length).toBeGreaterThan(0);
    }
  });

  it('returns a fresh array (not a reference to the input package)', () => {
    const selected = select('2026-03-15');
    expect(selected).not.toBe(PKG);
  });
});
