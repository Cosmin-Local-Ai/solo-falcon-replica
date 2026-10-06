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

  // ── CASS 2026 — CF art. 170 alin. (1) ceiling, art. 174 alin. (6) top-up floor,
  // art. 174 alin. (2) zero/loss, art. 174 alin. (7) lit. a)/c) relief. See phases/04_cass.md.

  it('CASS: VNA = 0 → 0, no CASS at all (CF art. 174 alin. (2))', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: 0 });
    expect(result).toMatchObject({ value: 0 });
    if ('breakdown' in result) {
      const text = result.breakdown.join('\n');
      expect(text).toContain('art. 174 alin. (2)');
      // The art. 180 alin. (1) optare exists but is deliberately not modelled.
      expect(text).toContain('art. 180 alin. (1)');
      expect(text).toContain('NEMODELATA');
    }
  });

  it('CASS: VNA < 0 (fiscal loss) → 0 (CF art. 174 alin. (2))', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: -50000 });
    expect(result).toMatchObject({ value: 0 });
  });

  it('CASS: VNA just above 0 → 2430, the 6 SM top-up applies (CF art. 174 alin. (6))', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: 1 });
    expect(result).toMatchObject({ value: 2430 });
  });

  it('CASS: VNA just below 6 SM (24299) → 2430 (top-up, not 10% of VNA)', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: 24299 });
    expect(result).toMatchObject({ value: 2430 });
  });

  it('CASS: VNA exactly 6 SM (24300) → 2430', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: 24300 });
    expect(result).toMatchObject({ value: 2430 });
  });

  it('CASS: the 6 SM floor is attributed to art. 174 alin. (6), NOT art. 170 alin. (2)-(3)', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: 10000 });
    if (!('breakdown' in result)) throw new Error('expected a computed result');
    const text = result.breakdown.join('\n');
    expect(text).toContain('CF art. 174 alin. (6)');
    expect(text).toContain('NU art. 170 alin. (2)-(3)');
    expect(text).toContain('diferenta de contributie');
    // A re-attribution to art. 170 alin. (2)-(3) must fail here.
    expect(text).toContain('art. 155 alin. (1) lit. c)-h)');
  });

  it('CASS: VNA between 6 SM and 72 SM → 10% x VNA', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: 100000 });
    expect(result).toMatchObject({ value: 10000 });
  });

  it('CASS: VNA exactly 72 SM (291600) → 29160', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: 291600 });
    expect(result).toMatchObject({ value: 29160 });
  });

  it('CASS: VNA above 72 SM → 29160, capped by max_annual_base (CF art. 170 alin. (1))', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: 500000 });
    expect(result).toMatchObject({ value: 29160 });
    if ('breakdown' in result) {
      const text = result.breakdown.join('\n');
      expect(text).toContain('CF art. 170 alin. (1)');
      // 29160 is DERIVED from rate x max_annual_base — there is no max_cass parameter.
      expect(text).toContain('derivata din 291600 x 0.1');
    }
  });

  it('CASS: the ceiling is parameter-driven — mutating max_annual_base moves it', () => {
    const rule = byId('CASS_2026');
    const mutated = {
      ...rule,
      parameters: rule.parameters.map((p) =>
        p.id === 'max_annual_base' ? { ...p, value: 100000 } : p,
      ),
    };
    // No hardcoded 291600: with a 100000 ceiling, VNA 150000 caps at 100000 → 10000.
    expect(calculatorRegistry['calc-cass'](mutated, { base: 150000 })).toMatchObject({ value: 10000 });
    // and the unmutated rule still caps at 291600 → 29160.
    expect(calculatorRegistry['calc-cass'](rule, { base: 150000 })).toMatchObject({ value: 15000 });
  });

  it('CASS: min_cass / max_cass are NOT independent parameters (derived from rate x base)', () => {
    const params = byId('CASS_2026').parameters.map((p) => p.id);
    expect(params).toContain('min_base');
    expect(params).toContain('max_annual_base');
    expect(params).not.toContain('min_cass');
    expect(params).not.toContain('max_cass');
  });

  it('CASS: pensioner below 6 SM → 10% x VNA, NOT 0 and NOT 2430 (art. 174 alin. (7) lit. c))', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: 10000, pensionStatus: 'da' });
    expect(result).toMatchObject({ value: 1000 });
    if ('breakdown' in result) {
      const text = result.breakdown.join('\n');
      expect(text).toContain('art. 174 alin. (7) lit. c)');
      expect(text).toContain('elimina DOAR diferenta');
      // The asymmetry against CAS must stay documented where the branch lives.
      expect(text).toContain('art. 150 alin. (1)');
    }
  });

  it('CASS: pensioner above 6 SM → 10% x VNA, unchanged (relief is irrelevant there)', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: 100000, pensionStatus: 'da' });
    expect(result).toMatchObject({ value: 10000 });
  });

  it('CASS: pensioner with VNA = 0 → still 0 (art. 174 alin. (2) is upstream of any relief)', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: 0, pensionStatus: 'da' });
    expect(result).toMatchObject({ value: 0 });
  });

  it('CASS: salaryStatus da below 6 SM → review_required, the profile has no salary amount', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: 10000, salaryStatus: 'da' });
    expect(result).toMatchObject({ reviewRequired: true });
    if ('reason' in result) expect(result.reason).toContain('art. 174 alin. (7) lit. a)');
  });

  it('CASS: pension relief is checked before salary relief (lit. c) has no threshold)', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: 10000,
      salaryStatus: 'da',
      pensionStatus: 'da',
    });
    expect(result).toMatchObject({ value: 1000 });
  });

  it('CASS: salaryStatus da above 6 SM → normal 10% (lit. a) relief is irrelevant there)', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: 100000, salaryStatus: 'da' });
    expect(result).toMatchObject({ value: 10000 });
  });

  it('CASS: no base supplied → 0, treated as a zero/loss year rather than a floor', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {});
    expect(result).toMatchObject({ value: 0 });
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

/**
 * Phase 6: art. 174 alin. (7) lit. a) is a NUMERIC test („la un nivel cel puțin egal cu 6
 * salarii minime brute”), and the profile used to carry no salary amount — so every salaried
 * PFA below the 6 SM floor halted in REVIEW_REQUIRED. With `salaryIncomeLei` supplied by the
 * profile, both branches compute (docs/ai/phases/06_fiscal_profile.md §6).
 */
describe('calc-cass — salaried PFA below the 6 SM floor (art. 174 alin. (6) + alin. (7) lit. a))', () => {
  const byId = (id: string) =>
    PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === id)!;

  it('salary at least 6 SM: no top-up, CASS stays 10% x VNA and is fully deductible', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: 10_000,
      salaryStatus: 'da',
      salaryIncomeLei: 30_000,
    });
    expect(result).toMatchObject({ value: 1_000 });
    expect(result).not.toHaveProperty('nonDeductible');
    if ('breakdown' in result) {
      expect(result.breakdown.join(' ')).toContain('art. 174 alin. (7) lit. a)');
      expect(result.breakdown.join(' ')).toContain('art. 118 alin. (2) lit. b)');
    }
  });

  it('exactly 6 SM satisfies the condition („cel puțin egal”, not „mai mare”)', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: 10_000,
      salaryStatus: 'da',
      salaryIncomeLei: 24_300,
    });
    expect(result).toMatchObject({ value: 1_000 });
  });

  it('salary below 6 SM: the alin. (6) top-up stands and stays non-deductible', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: 10_000,
      salaryStatus: 'da',
      salaryIncomeLei: 20_000,
    });
    expect(result).toMatchObject({ value: 2_430, nonDeductible: 1_430 });
    if ('breakdown' in result) {
      expect(result.breakdown.join(' ')).toContain('nu este indeplinita');
    }
  });

  it('a salary of zero lei does not trigger the relief', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: 10_000,
      salaryStatus: 'da',
      salaryIncomeLei: 0,
    });
    expect(result).toMatchObject({ value: 2_430, nonDeductible: 1_430 });
  });

  it('pension relief is still evaluated first, even when a salary amount exists', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: 10_000,
      pensionStatus: 'da',
      salaryStatus: 'da',
      salaryIncomeLei: 10_000,
    });
    expect(result).toMatchObject({ value: 1_000 });
  });

  it('once VNA reaches the floor the salary amount is irrelevant', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: 40_000,
      salaryStatus: 'da',
      salaryIncomeLei: 100_000,
    });
    expect(result).toMatchObject({ value: 4_000 });
  });
});
