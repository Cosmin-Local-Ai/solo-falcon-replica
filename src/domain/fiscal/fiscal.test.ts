import { describe, expect, it } from 'vitest';
import { calculatorRegistry } from './calculators';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';
import { PFA_2026_RELEASE } from './release2026';
import { selectApplicableRules } from './select';
import { ruleSetDigest } from './ruleSetDigest';
import { lei } from '../money';

describe('PFA 2026 system-real package', () => {
  // 9 fiscal-parameter rules (CAS/CASS/income-tax/VAT/wage/deadlines) + 39 expense-deductibility
  // rules added by TASK 2a under taxRegime 'expense-deductibility' (CF art. 68). The count moved from
  // 9 because the deductibility rule set is data in this package, which is what makes a later legal
  // correction a new rule release rather than a code change. No parameter value, formula or computed
  // figure in the original 9 rules changed.
  it('contains exactly 48 rules (9 fiscal + 39 expense-deductibility)', () => {
    expect(PFA_2026_SYSTEM_REAL_PACKAGE).toHaveLength(48);
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

  // Phase 9b: the mirror of the test above. A rule that exists in the package but is not listed in
  // the release is never selected, so a deadline it would produce silently does not exist — which is
  // exactly the failure mode this phase is about. VAT_REGISTRATION_DEADLINE_2026 must be activated.
  it('every rule in the package is activated by the release', () => {
    for (const rule of PFA_2026_SYSTEM_REAL_PACKAGE) {
      expect(
        PFA_2026_RELEASE.ruleIds,
        `rule ${rule.ruleId} is not in PFA_2026_RELEASE.ruleIds`,
      ).toContain(rule.ruleId);
    }
  });
});

describe('selectApplicableRules', () => {
  // 48 - 1 = 47: only GENERAL_MINIMUM_WAGE_2026_H2 is outside the window on 2026-03-15. The two
  // art. 68 alin. (5) letters added by OUG 8/2026 (g^1 occupational pensions, g^2 PEPP) ARE selected
  // here because they take effect 2026-03-01 - contributions paid before that date must not reach them.
  it('returns 47 rules for a date in H1 2026 (H2 wage rule not yet effective)', () => {
    const selected = selectApplicableRules(PFA_2026_SYSTEM_REAL_PACKAGE, {
      taxYear: 2026,
      asOfDate: '2026-03-15',
    });
    expect(selected).toHaveLength(47);
  });

  it('excludes the H1 minimum wage rule after 2026-06-30', () => {
    const selected = selectApplicableRules(PFA_2026_SYSTEM_REAL_PACKAGE, {
      taxYear: 2026,
      asOfDate: '2026-09-01',
    });
    const ids = selected.map((r) => r.ruleId);
    expect(ids).not.toContain('GENERAL_MINIMUM_WAGE_2026_H1');
    expect(ids).toContain('GENERAL_MINIMUM_WAGE_2026_H2');
    // 48 - 1 = 47: only GENERAL_MINIMUM_WAGE_2026_H1 has expired by 2026-09-01.
    expect(selected).toHaveLength(47);
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
    expect(result).toMatchObject({ value: lei(4050) });
  });

  // CF art. 148 alin. (1)-(2): the CAS base is "venitul ales de contribuabil", floored at
  // 12 SM when realized income is 12–24 SM and at 24 SM once it reaches 24 SM. It is a
  // ladder of floors with NO upper cap; below 12 SM the obligation never arises.
  // These assertions replaced the old clamp (base capped at 97,200, minimum 12,150 even
  // with no income) — see docs/ai/phases/03_cas.md.
  it('CAS is 0 when no income is provided', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'));
    expect(result).toMatchObject({ value: lei(0) });
  });

  it('CAS is 0 for a loss-making base', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), { base: lei(-5000) });
    expect(result).toMatchObject({ value: lei(0) });
  });

  it('CAS is 0 just below 12 SM (48,599), not 12,150', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), { base: lei(48599) });
    expect(result).toMatchObject({ value: lei(0) });
  });

  it('CAS at exactly 12 SM (48,600) is 12,150', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), { base: lei(48600) });
    expect(result).toMatchObject({ value: lei(12150) });
  });

  it('CAS in the 12–24 SM band stays on the 12 SM floor: 60,000 → 12,150', () => {
    // The old clamp charged 25% × 60,000 = 15,000, over-stating CAS by 2,850 lei.
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), { base: lei(60000) });
    expect(result).toMatchObject({ value: lei(12150) });
  });

  it('CAS at exactly 24 SM (97,200) is 24,300', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), { base: lei(97200) });
    expect(result).toMatchObject({ value: lei(24300) });
  });

  it('CAS above 24 SM stays on the 24 SM floor: 200,000 → 24,300', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), { base: lei(200000) });
    expect(result).toMatchObject({ value: lei(24300) });
  });

  it('CAS is not capped: a voluntarily chosen base above the floor is charged in full', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), {
      base: lei(200000),
      chosenBase: lei(150000),
    });
    expect(result).toMatchObject({ value: lei(37500) });
  });

  it('a chosen base below the applicable floor is clamped up to that floor', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), {
      base: lei(200000),
      chosenBase: lei(50000),
    });
    expect(result).toMatchObject({ value: lei(24300) });
  });

  it('pensioners owe no CAS (CF art. 150 alin. (1))', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), {
      base: lei(200000),
      pensionerStatus: 'da',
    });
    expect(result).toMatchObject({ value: lei(0) });
  });

  it('the CAS exemption does not depend on the income amount', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), {
      base: lei(60000),
      pensionerStatus: 'da',
    });
    expect(result).toMatchObject({ value: lei(0) });
  });

  it('pensionerStatus nu is not exempt — only the art. 150 alin. (1) categories are', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), {
      base: lei(60000),
      pensionerStatus: 'nu',
    });
    expect(result).toMatchObject({ value: lei(12150) });
  });

  // TASK 5: CAS keys on the STATUS (CF art. 150 alin. (1)). An unrecorded status is no exemption
  // either — the exception needs a recorded `da`, so `unknown` leaves the obligation in place.
  it('CAS: an unrecorded pensioner status is not an exemption (unknown is not da)', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), {
      base: lei(60000),
      pensionerStatus: 'unknown',
    });
    expect(result).toMatchObject({ value: lei(12150) });
  });

  // The reverse half of the split: the RECEIPT fact, which is what CASS keys on, must never reach CAS.
  it('CAS: pension sums received in the year do NOT exempt CAS — only status does (art. 150 alin. (1))', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), {
      base: lei(60000),
      pensionSumsReceived: 'da',
    });
    expect(result).toMatchObject({ value: lei(12150) });
  });

  it('the CAS breakdown states the applicable floor and that there is no upper cap', () => {
    const result = calculatorRegistry['calc-cas'](byId('CAS_2026'), { base: lei(200000) });
    expect(result).toMatchObject({ value: lei(24300) });
    if ('breakdown' in result) {
      const text = result.breakdown.join('\n');
      expect(text).toContain('97200');
      expect(text).toContain('nu prevede nicio plafonare superioara');
    }
  });

  // ── CASS 2026 — CF art. 170 alin. (1) ceiling, art. 174 alin. (6) top-up floor,
  // art. 174 alin. (2) zero/loss, art. 174 alin. (7) lit. a)/c) relief. See phases/04_cass.md.

  it('CASS: VNA = 0 → 0, no CASS at all (CF art. 174 alin. (2))', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: lei(0) });
    expect(result).toMatchObject({ value: lei(0) });
    if ('breakdown' in result) {
      const text = result.breakdown.join('\n');
      expect(text).toContain('art. 174 alin. (2)');
      // The art. 180 alin. (1) optare exists but is deliberately not modelled.
      expect(text).toContain('art. 180 alin. (1)');
      expect(text).toContain('NEMODELATA');
    }
  });

  it('CASS: VNA < 0 (fiscal loss) → 0 (CF art. 174 alin. (2))', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: lei(-50000) });
    expect(result).toMatchObject({ value: lei(0) });
  });

  it('CASS: VNA just above 0 → 2430, the 6 SM top-up applies (CF art. 174 alin. (6))', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: lei(1) });
    expect(result).toMatchObject({ value: lei(2430) });
  });

  it('CASS: VNA just below 6 SM (24299) → 2430 (top-up, not 10% of VNA)', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: lei(24299) });
    expect(result).toMatchObject({ value: lei(2430) });
  });

  it('CASS: VNA exactly 6 SM (24300) → 2430', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: lei(24300) });
    expect(result).toMatchObject({ value: lei(2430) });
  });

  it('CASS: the 6 SM floor is attributed to art. 174 alin. (6), NOT art. 170 alin. (2)-(3)', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: lei(10000) });
    if (!('breakdown' in result)) throw new Error('expected a computed result');
    const text = result.breakdown.join('\n');
    expect(text).toContain('CF art. 174 alin. (6)');
    expect(text).toContain('NU art. 170 alin. (2)-(3)');
    expect(text).toContain('diferenta de contributie');
    // A re-attribution to art. 170 alin. (2)-(3) must fail here.
    expect(text).toContain('art. 155 alin. (1) lit. c)-h)');
  });

  it('CASS: VNA between 6 SM and 72 SM → 10% x VNA', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: lei(100000) });
    expect(result).toMatchObject({ value: lei(10000) });
  });

  it('CASS: VNA exactly 72 SM (291600) → 29160', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: lei(291600) });
    expect(result).toMatchObject({ value: lei(29160) });
  });

  it('CASS: VNA above 72 SM → 29160, capped by max_annual_base (CF art. 170 alin. (1))', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: lei(500000) });
    expect(result).toMatchObject({ value: lei(29160) });
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
        p.id === 'max_annual_base' ? { ...p, value: lei(100000) } : p,
      ),
    };
    // No hardcoded 291600: with a 100000 ceiling, VNA 150000 caps at 100000 → 10000.
    expect(calculatorRegistry['calc-cass'](mutated, { base: lei(150000) })).toMatchObject({ value: lei(10000) });
    // and the unmutated rule still caps at 291600 → 29160.
    expect(calculatorRegistry['calc-cass'](rule, { base: lei(150000) })).toMatchObject({ value: lei(15000) });
  });

  it('CASS: min_cass / max_cass are NOT independent parameters (derived from rate x base)', () => {
    const params = byId('CASS_2026').parameters.map((p) => p.id);
    expect(params).toContain('min_base');
    expect(params).toContain('max_annual_base');
    expect(params).not.toContain('min_cass');
    expect(params).not.toContain('max_cass');
  });

  it('CASS: pension sums received in the year, below 6 SM → 10% x VNA, NOT 0 and NOT 2430 (art. 174 alin. (7) lit. c))', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: lei(10000), pensionSumsReceived: 'da' });
    expect(result).toMatchObject({ value: lei(1000) });
    if ('breakdown' in result) {
      const text = result.breakdown.join('\n');
      expect(text).toContain('art. 174 alin. (7) lit. c)');
      expect(text).toContain('elimina DOAR diferenta');
      // The asymmetry against CAS must stay documented where the branch lives.
      expect(text).toContain('art. 150 alin. (1)');
    }
  });

  // TASK 5 — the defect this task removes. The relief keys on receipt in the year, so a STATUS alone
  // must not switch the top-up off: the fact stays undecided and the top-up keeps standing.
  it('CASS: pensioner STATUS alone does not remove the top-up — the receipt fact is what decides', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: lei(10000), pensionerStatus: 'da' });
    expect(result).toMatchObject({ value: lei(2430) });
    if ('breakdown' in result) {
      const text = result.breakdown.join('\n');
      expect(text).toContain('EXCEPTIE NESTABILITA');
      expect(text).toContain('art. 99 alin. (1)');
    }
  });

  it('CASS: a recorded `nu` receipt does not relieve and needs no withheld-conclusion note', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: lei(10000), pensionSumsReceived: 'nu' });
    expect(result).toMatchObject({ value: lei(2430) });
    if ('breakdown' in result) expect(result.breakdown.join('\n')).not.toContain('EXCEPTIE NESTABILITA');
  });

  // lit. c) carries no monetary qualifier — lit. a) and lit. b) carry „cel puțin egal cu 6 salarii minime
  // brute”, lit. c) does not. The calculator receives no pension quantum at all, so an invented
  // threshold has nowhere to live; this pins that receipt alone fires the relief.
  it('CASS: lit. c) has NO amount threshold — receipt alone triggers it, with no pension quantum supplied', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: lei(100), pensionSumsReceived: 'da' });
    expect(result).toMatchObject({ value: lei(10) });
    if ('breakdown' in result) expect(result.breakdown.join('\n')).toContain('fara prag valoric');
  });

  // CF art. 174 alin. (8): the previous-year route. Its category list excludes pensioners, so it needs
  // its own fact and is pinned here independently of any pension input.
  it('CASS: art. 174 alin. (8) previous-year art. 154 category removes the top-up, with no pension fact at all', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: lei(10000),
      previousYearExceptedCategory: 'da',
    });
    expect(result).toMatchObject({ value: lei(1000) });
    if ('breakdown' in result) {
      const text = result.breakdown.join('\n');
      expect(text).toContain('CF art. 174 alin. (8)');
      expect(text).toContain('nu include pensionarii');
    }
  });

  it('CASS: art. 174 alin. (8) via the art. 180 alin. (1) option in the previous year', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: lei(10000),
      previousYearArt180Option: 'da',
    });
    expect(result).toMatchObject({ value: lei(1000) });
  });

  // CF art. 153 alin. (2) is the one ground that removes CASS taxpayer quality entirely — and it is
  // unrelated to pensions, so it is pinned separately from every art. 174 alin. (7) branch.
  it('CASS: proved foreign sickness/maternity insurance removes the contribution entirely (art. 153 alin. (2))', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: lei(100000),
      foreignSicknessInsuranceProved: 'da',
    });
    expect(result).toMatchObject({ value: lei(0) });
    if ('breakdown' in result) {
      const text = result.breakdown.join('\n');
      expect(text).toContain('art. 153 alin. (2)');
      expect(text).toContain('NU are calitatea de contribuabil');
      expect(text).toContain('art. 154 alin. (2)');
    }
  });

  it('CASS: foreign insurance held but not proved is NOT the art. 153 alin. (2) exclusion', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: lei(10000),
      foreignSicknessInsuranceProved: 'unknown',
    });
    expect(result).toMatchObject({ value: lei(2430) });
  });

  // Research 25 gap 1: a suspension is a recorded fact whose legal effect is UNVERIFIED. It must be
  // visible and must change nothing.
  it('CASS: recorded suspension months are reported as a fact and change no amount', () => {
    const withSuspension = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: lei(10000),
      pensionSumsReceived: 'da',
      pensionSuspensionMonths: [3, 4],
    });
    const without = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: lei(10000),
      pensionSumsReceived: 'da',
    });
    expect(withSuspension).toMatchObject({ value: lei(1000) });
    expect(without).toMatchObject({ value: lei(1000) });
    if ('breakdown' in withSuspension) {
      const text = withSuspension.breakdown.join('\n');
      expect(text).toContain('FAPTA, NU CONCLUZIE');
      expect(text).toContain('3,4');
    }
  });

  it('CASS: pension receipt above 6 SM → 10% x VNA, unchanged (relief is irrelevant there)', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: lei(100000), pensionSumsReceived: 'da' });
    expect(result).toMatchObject({ value: lei(10000) });
  });

  it('CASS: pension receipt with VNA = 0 → still 0 (art. 174 alin. (2) is upstream of any relief)', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: lei(0), pensionSumsReceived: 'da' });
    expect(result).toMatchObject({ value: lei(0) });
  });

  it('CASS: salaryStatus da below 6 SM → review_required, the profile has no salary amount', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: lei(10000), salaryStatus: 'da' });
    expect(result).toMatchObject({ reviewRequired: true });
    if ('reason' in result) expect(result.reason).toContain('art. 174 alin. (7) lit. a)');
  });

  it('CASS: pension relief is checked before salary relief (lit. c) has no threshold)', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: lei(10000),
      salaryStatus: 'da',
      pensionSumsReceived: 'da',
    });
    expect(result).toMatchObject({ value: lei(1000) });
  });

  it('CASS: salaryStatus da above 6 SM → normal 10% (lit. a) relief is irrelevant there)', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), { base: lei(100000), salaryStatus: 'da' });
    expect(result).toMatchObject({ value: lei(10000) });
  });

  it('CASS: no base supplied → 0, treated as a zero/loss year rather than a floor', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {});
    expect(result).toMatchObject({ value: lei(0) });
  });

  it('income tax applies 10% flat at 48600', () => {
    const result = calculatorRegistry['calc-income-tax'](byId('INCOME_TAX_2026'), {
      base: lei(48600),
    });
    expect(result).toMatchObject({ value: lei(4860) });
  });

  it('income tax applies 10% flat above 48600 (no progressive bracket)', () => {
    const result = calculatorRegistry['calc-income-tax'](byId('INCOME_TAX_2026'), {
      base: lei(60000),
    });
    expect(result).toMatchObject({ value: lei(6000) });
  });

  it('income tax requires review when no base provided', () => {
    const result = calculatorRegistry['calc-income-tax'](byId('INCOME_TAX_2026'));
    expect(result).toMatchObject({ reviewRequired: true });
  });

  it('VAT threshold is 395000', () => {
    const result = calculatorRegistry['calc-vat-threshold'](
      byId('VAT_THRESHOLD_2026'),
    );
    expect(result).toMatchObject({ value: lei(395000) });
  });

  it('deadline calculator returns the 2027-05-25 deadline', () => {
    const result = calculatorRegistry['calc-deadline'](byId('PFA_DEADLINE_2026'));
    expect(result).toMatchObject({ value: lei(0) });
  });

  // KNOWN LIMITATION, flagged for Phase 10 (brief 10 §3.5 forbids touching the calculators).
  // `calcDeadline` reads only a fixed `deadline` parameter, so it cannot express an event-relative
  // rule and answers reviewRequired for VAT_REGISTRATION_DEADLINE_2026. There is no production
  // impact — `computeDeadlines` reads `parameters` directly and never routes deadline rules through
  // the calculator registry — but the calculator must be extended before any deadline rule can feed
  // the money path. This test pins the current behaviour so the gap cannot be forgotten.
  it('deadline calculator cannot express an event-relative rule (Phase 10 follow-up)', () => {
    const result = calculatorRegistry['calc-deadline'](byId('VAT_REGISTRATION_DEADLINE_2026'));
    expect(result).toMatchObject({ reviewRequired: true });
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
      base: lei(10_000),
      salaryStatus: 'da',
      salaryIncomeLei: lei(30_000),
    });
    expect(result).toMatchObject({ value: lei(1_000) });
    expect(result).not.toHaveProperty('nonDeductible');
    if ('breakdown' in result) {
      expect(result.breakdown.join(' ')).toContain('art. 174 alin. (7) lit. a)');
      expect(result.breakdown.join(' ')).toContain('art. 118 alin. (2) lit. b)');
    }
  });

  it('exactly 6 SM satisfies the condition („cel puțin egal”, not „mai mare”)', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: lei(10_000),
      salaryStatus: 'da',
      salaryIncomeLei: lei(24_300),
    });
    expect(result).toMatchObject({ value: lei(1_000) });
  });

  it('salary below 6 SM: the alin. (6) top-up stands and stays non-deductible', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: lei(10_000),
      salaryStatus: 'da',
      salaryIncomeLei: lei(20_000),
    });
    expect(result).toMatchObject({ value: lei(2_430), nonDeductible: lei(1_430) });
    if ('breakdown' in result) {
      expect(result.breakdown.join(' ')).toContain('nu este indeplinita');
    }
  });

  it('a salary of zero lei does not trigger the relief', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: lei(10_000),
      salaryStatus: 'da',
      salaryIncomeLei: lei(0),
    });
    expect(result).toMatchObject({ value: lei(2_430), nonDeductible: lei(1_430) });
  });

  it('pension relief is still evaluated first, even when a salary amount exists', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: lei(10_000),
      pensionSumsReceived: 'da',
      salaryStatus: 'da',
      salaryIncomeLei: lei(10_000),
    });
    expect(result).toMatchObject({ value: lei(1_000) });
  });

  it('once VNA reaches the floor the salary amount is irrelevant', () => {
    const result = calculatorRegistry['calc-cass'](byId('CASS_2026'), {
      base: lei(40_000),
      salaryStatus: 'da',
      salaryIncomeLei: lei(100_000),
    });
    expect(result).toMatchObject({ value: lei(4_000) });
  });
});

/*
 * TASK 6 — the release identity, pinned.
 *
 * `releaseId: 'PFA_2026_SYSTEM_REAL'` and `createdAt: '2026-01-01'` were the whole identity, and neither
 * moved across the CAS, CASS and income-tax corrections. These assertions are what stop that recurring
 * quietly: the release now carries a digest of its own rules, `createdAt` is an instant rather than the
 * effective date copied twice, and the citations stay citations.
 */
describe('PFA 2026 release identity (TASK 6)', () => {
  it('createdAt is a real ISO instant, not a bare calendar date', () => {
    expect(PFA_2026_RELEASE.createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/,
    );
  });

  it('createdAt is not the effective date — the law biting and the record being made are different facts', () => {
    expect(PFA_2026_RELEASE.createdAt).not.toBe(PFA_2026_RELEASE.effectiveFrom);
    expect(PFA_2026_RELEASE.effectiveFrom).toBe('2026-01-01');
  });

  it('the release carries the digest of the rule set it names', () => {
    expect(PFA_2026_RELEASE.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(PFA_2026_RELEASE.contentHash).toBe(ruleSetDigest(PFA_2026_SYSTEM_REAL_PACKAGE));
  });

  it('the release declares a lifecycle, a version and an open window', () => {
    expect(PFA_2026_RELEASE.lifecycle).toBe('ACTIVE');
    expect(PFA_2026_RELEASE.version).toBe(1);
    expect(PFA_2026_RELEASE.effectiveTo).toBeNull();
    expect(PFA_2026_RELEASE.supersededBy).toBeUndefined();
  });

  it('every rule sits on the lifecycle ladder and carries a usable version', () => {
    const ladder = ['PROPOSED', 'VALIDATED', 'STAGED', 'SCHEDULED', 'ACTIVE', 'SUPERSEDED'];
    for (const rule of PFA_2026_SYSTEM_REAL_PACKAGE) {
      expect(ladder, `${rule.ruleId} status`).toContain(rule.status);
      expect(Number.isInteger(rule.version), `${rule.ruleId} version`).toBe(true);
      expect(rule.version).toBeGreaterThanOrEqual(1);
    }
  });

  it('no rule cites a project document as its legal source — a hash pins parameters, the citation stays authoritative', () => {
    for (const rule of PFA_2026_SYSTEM_REAL_PACKAGE) {
      expect(rule.sourceUrl, `${rule.ruleId} sourceUrl`).toMatch(/^https?:\/\//);
      expect(rule.sourceUrl).not.toContain('research/');
      expect(rule.sourceUrl).not.toContain('decisions/');
    }
    for (const url of PFA_2026_RELEASE.evidence) {
      expect(url).toMatch(/^https?:\/\//);
    }
  });

  it('TASK 9: every citation is published by an official source, never a commercial mirror', () => {
    // The package used to cite `www.legalteka.ro` for both minimum-wage acts. A mirror re-types the text
    // it reproduces, so it cannot settle a question about what the act says — and the digest pins the
    // PARAMETERS, which is exactly why the citation has to stay authoritative on its own. This is an
    // allow-list, not a block-list: a new mirror passes a block-list by being new.
    //   legislatie.just.ro — Portal Legislativ, Ministerul Justiției (the state register of acts)
    //   static.anaf.ro     — ANAF, the administering authority (its own forms and instructions)
    const OFFICIAL_HOSTS = ['legislatie.just.ro', 'static.anaf.ro'];
    const cited = new Set<string>();
    for (const rule of PFA_2026_SYSTEM_REAL_PACKAGE) cited.add(rule.sourceUrl);
    for (const url of PFA_2026_RELEASE.evidence) cited.add(url);
    for (const url of cited) {
      const host = new URL(url).host;
      expect(OFFICIAL_HOSTS, `${url} host`).toContain(host);
    }
    // And the two wage acts are cited by their register document, not by a search page: a bare search URL
    // is a pointer to a query, not to an act.
    const wageRules = PFA_2026_SYSTEM_REAL_PACKAGE.filter(r => r.taxRegime === 'wage-reference');
    expect(wageRules.length).toBeGreaterThan(0);
    for (const rule of wageRules) {
      expect(rule.sourceUrl).toMatch(/^https:\/\/legislatie\.just\.ro\/Public\/DetaliiDocument\/\d+$/);
    }
  });
});
