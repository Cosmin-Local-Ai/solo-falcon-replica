import { describe, expect, it } from 'vitest';
import { calculatorRegistry } from './calculators';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';
import { PFA_2026_RELEASE } from './release2026';
import { selectApplicableRules } from './select';

describe('PFA 2026 system-real package', () => {
  it('contains exactly 8 rules', () => {
    expect(PFA_2026_SYSTEM_REAL_PACKAGE).toHaveLength(8);
  });

  it('every rule has 16 defined fields and valid provenance', () => {
    const fields = [
      'ruleId',
      'name',
      'jurisdiction',
      'entityType',
      'taxRegime',
      'taxYear',
      'effectiveFrom',
      'effectiveTo',
      'parameters',
      'calculatorId',
      'sourceAct',
      'sourceArticle',
      'sourceUrl',
      'verifiedAt',
      'status',
      'version',
    ] as const;
    for (const rule of PFA_2026_SYSTEM_REAL_PACKAGE) {
      for (const field of fields) {
        expect(rule, `${rule.ruleId} missing ${field}`).toHaveProperty(field);
      }
      expect(rule.jurisdiction).toBe('RO');
      expect(rule.entityType).toBe('PFA');
      expect(rule.taxYear).toBe(2026);
      expect(rule.status).toBe('ACTIVE');
      expect(rule.version).toBe(1);
      expect(rule.parameters.length).toBeGreaterThan(0);
    }
  });

  it('every ruleId referenced by the release exists in the package', () => {
    const ids = new Set(PFA_2026_SYSTEM_REAL_PACKAGE.map((r) => r.ruleId));
    for (const id of PFA_2026_RELEASE.ruleIds) {
      expect(ids.has(id), `release references unknown rule ${id}`).toBe(true);
    }
  });
});

describe('selectApplicableRules', () => {
  it('returns 7 rules for a date in H1 2026 (H2 wage rule not yet effective)', () => {
    const selected = selectApplicableRules(PFA_2026_SYSTEM_REAL_PACKAGE, {
      taxYear: 2026,
      asOfDate: '2026-03-15',
    });
    expect(selected).toHaveLength(7);
  });

  it('excludes the H1 minimum wage rule after 2026-06-30', () => {
    const selected = selectApplicableRules(PFA_2026_SYSTEM_REAL_PACKAGE, {
      taxYear: 2026,
      asOfDate: '2026-09-01',
    });
    const ids = selected.map((r) => r.ruleId);
    expect(ids).not.toContain('GENERAL_MINIMUM_WAGE_2026_H1');
    expect(ids).toContain('GENERAL_MINIMUM_WAGE_2026_H2');
    expect(selected).toHaveLength(7);
  });

  it('returns nothing for a year without rules', () => {
    expect(
      selectApplicableRules(PFA_2026_SYSTEM_REAL_PACKAGE, {
        taxYear: 2025,
        asOfDate: '2025-06-01',
      }),
    ).toHaveLength(0);
  });
});

describe('calculators', () => {
  const byId = (id: string) =>
    PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === id)!;

  it('wage reference returns 4050', () => {
    const result = calculatorRegistry['calc-wage-reference'](
      byId('PFA_2026_TAX_REFERENCE'),
    );
    expect(result).toMatchObject({ value: 4050 });
  });

  // CF art. 148 alin. (1)-(2): the CAS base is "venitul ales de contribuabil", floored at
  // 12 SM when realized income is 12–24 SM and at 24 SM once it reaches 24 SM. It is a
  // ladder of floors with NO upper cap; below 12 SM the obligation never arises.
  // These assertions replaced the old clamp (base capped at 97,200, minimum 12,150 even
  // with no income) — see docs/ai/phases/03_cas.md.
  it('CAS is 0 when no income is provided', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'));
    expect(result).toMatchObject({ value: 0 });
  });

  it('CAS is 0 for a loss-making base', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), { base: -5000 });
    expect(result).toMatchObject({ value: 0 });
  });

  it('CAS is 0 just below 12 SM (48,599), not 12,150', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), { base: 48599 });
    expect(result).toMatchObject({ value: 0 });
  });

  it('CAS at exactly 12 SM (48,600) is 12,150', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), { base: 48600 });
    expect(result).toMatchObject({ value: 12150 });
  });

  it('CAS in the 12–24 SM band stays on the 12 SM floor: 60,000 → 12,150', () => {
    // The old clamp charged 25% × 60,000 = 15,000, over-stating CAS by 2,850 lei.
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), { base: 60000 });
    expect(result).toMatchObject({ value: 12150 });
  });

  it('CAS at exactly 24 SM (97,200) is 24,300', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), { base: 97200 });
    expect(result).toMatchObject({ value: 24300 });
  });

  it('CAS above 24 SM stays on the 24 SM floor: 200,000 → 24,300', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), { base: 200000 });
    expect(result).toMatchObject({ value: 24300 });
  });

  it('CAS is not capped: a voluntarily chosen base above the floor is charged in full', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), {
      base: 200000,
      chosenBase: 150000,
    });
    expect(result).toMatchObject({ value: 37500 });
  });

  it('a chosen base below the applicable floor is clamped up to that floor', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), {
      base: 200000,
      chosenBase: 50000,
    });
    expect(result).toMatchObject({ value: 24300 });
  });

  it('pensioners owe no CAS (CF art. 150 alin. (1))', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), {
      base: 200000,
      pensionStatus: 'da',
    });
    expect(result).toMatchObject({ value: 0 });
  });

  it('the CAS exemption does not depend on the income amount', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), {
      base: 60000,
      pensionStatus: 'da',
    });
    expect(result).toMatchObject({ value: 0 });
  });

  it('pensionStatus nu is not exempt — only the art. 150 alin. (1) categories are', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), {
      base: 60000,
      pensionStatus: 'nu',
    });
    expect(result).toMatchObject({ value: 12150 });
  });

  it('the CAS breakdown states the applicable floor and that there is no upper cap', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), { base: 200000 });
    expect(result).toMatchObject({ value: 24300 });
    if ('breakdown' in result) {
      const text = result.breakdown.join('\n');
      expect(text).toContain('97200');
      expect(text).toContain('nu prevede nicio plafonare superioara');
    }
  });

  it('CASS at the minimum base is 2430', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: 24300 });
    expect(result).toMatchObject({ value: 2430 });
  });

  it('CASS caps at max_annual_base (291600) → 29160', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: 500000 });
    expect(result).toMatchObject({ value: 29160 });
  });

  it('CASS returns review_required when base is below min_base', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: 10000 });
    expect(result).toMatchObject({ reviewRequired: true });
  });

  it('income tax applies 10% flat at 48600', () => {
    const result = calculatorRegistry['calc-income-tax'](byId('INCOME_TAX_2026'), {
      base: 48600,
    });
    expect(result).toMatchObject({ value: 4860 });
  });

  it('income tax applies 10% flat above 48600 (no progressive bracket)', () => {
    const result = calculatorRegistry['calc-income-tax'](byId('INCOME_TAX_2026'), {
      base: 60000,
    });
    expect(result).toMatchObject({ value: 6000 });
  });

  it('income tax requires review when no base provided', () => {
    const result = calculatorRegistry['calc-income-tax'](byId('INCOME_TAX_2026'));
    expect(result).toMatchObject({ reviewRequired: true });
  });

  it('VAT threshold is 395000', () => {
    const result = calculatorRegistry['calc-vat-threshold'](
      byId('VAT_THRESHOLD_2026'),
    );
    expect(result).toMatchObject({ value: 395000 });
  });

  it('deadline calculator returns the 2027-05-25 deadline', () => {
    const result = calculatorRegistry['calc-deadline'](byId('PFA_DEADLINE_2026'));
    expect(result).toMatchObject({ value: 0 });
  });
});
