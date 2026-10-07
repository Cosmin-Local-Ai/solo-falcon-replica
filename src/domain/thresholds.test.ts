import { describe, expect, it } from 'vitest';
import { calculatorRegistry } from './fiscal/calculators';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import {
  breachMeaningFor,
  computeThresholds,
  statusFor,
  statusForRatioRule,
  withRatioRuleStatus,
  THRESHOLD_SPECS,
  type FiscalThreshold,
  type RatioRule,
  type RatioRuleStatus,
  type ThresholdQuery,
} from './thresholds';
import { lei, type Bani } from './money'

/**
 * Supply the same amount for every base. The status-math tests below are about distance and
 * the warning band, not about which base a spec reads, so they hold the bases equal rather
 * than encoding a legal claim.
 */
const allBases = (value: Bani) => ({
  'revenue-incl-vat': value,
  'revenue-excl-vat': value,
  'expense-incl-vat': value,
  'expense-excl-vat': value,
  'net-income': value,
});

const QUERY: ThresholdQuery = {
  taxYear: 2026,
  asOfDate: '2026-03-15',
  bases: allBases(lei(100000)),
  ruleRelease: 'PFA_2026_RELEASE',
};

const byId = (thresholds: FiscalThreshold[], id: string) =>
  thresholds.find((t) => t.thresholdId === id)!;

describe('computeThresholds', () => {
  it('returns one row per spec for 2026', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    expect(result).toHaveLength(THRESHOLD_SPECS.length);
    // CAS_MIN_BASE survives the CAS correction: crossing 12 SM is what triggers the
    // contribution obligation at all (CF art. 148 alin. (1)).
    expect(byId(result, 'CAS_MIN_BASE').thresholdValue).toBe(lei(48600));
  });

  it('CAS min base: thresholdValue 48600, distance = currentValue - 48600', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    const casMin = byId(result, 'CAS_MIN_BASE');
    expect(casMin.type).toBe('min-base');
    expect(casMin.affectedTax).toBe('cas');
    expect(casMin.thresholdValue).toBe(lei(48600));
    expect(casMin.distance).toBe(100000 - 48600);
  });

  it('has no CAS max-base row — CF art. 148 alin. (2) sets floors, not a ceiling', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    expect(result.find((t) => t.thresholdId === 'CAS_MAX_BASE')).toBeUndefined();
    expect(result.filter((t) => t.affectedTax === 'cas').map((t) => t.thresholdId)).toEqual([
      'CAS_MIN_BASE',
      // The 24 SM figure is back as what the law makes it — a ladder step (`tier-floor`), never a
      // `max-base` row. It reads the same `tier2_base` parameter `calcCas` doubles the floor on.
      'CAS_TIER2_FLOOR',
    ]);
    // CASS really does have a ceiling (CF art. 170 alin. (1), "nu poate fi mai mare decât"
    // 72 SM), so the max-base row survives where the law provides one.
    expect(byId(result, 'CASS_MAX_BASE').type).toBe('max-base');
    expect(byId(result, 'CASS_MAX_BASE').thresholdValue).toBe(lei(291600));
  });

  it('CASS min base: thresholdValue 24300', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    const cassMin = byId(result, 'CASS_MIN_BASE');
    expect(cassMin.type).toBe('min-base');
    expect(cassMin.affectedTax).toBe('cass');
    expect(cassMin.thresholdValue).toBe(lei(24300));
  });

  it('CASS max base: thresholdValue 291600', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    const cassMax = byId(result, 'CASS_MAX_BASE');
    expect(cassMax.type).toBe('max-base');
    expect(cassMax.affectedTax).toBe('cass');
    expect(cassMax.thresholdValue).toBe(lei(291600));
  });

  it('VAT: thresholdValue 395000, effectiveDate 2025-09-01', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    const vat = byId(result, 'VAT_REGISTRATION');
    expect(vat.type).toBe('registration');
    expect(vat.affectedTax).toBe('vat');
    expect(vat.thresholdValue).toBe(lei(395000));
    expect(vat.effectiveDate).toBe('2025-09-01');
  });

  it('is deterministic: same input produces equal output', () => {
    const first = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    const second = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    expect(second).toEqual(first);
  });

  it('below threshold → negative distance', () => {
    const q: ThresholdQuery = { taxYear: 2026, asOfDate: '2026-06-15', bases: allBases(lei(10000)), ruleRelease: '2026-01-01' };
    const r = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q);
    // 10000 < 48600 (CAS_MIN_BASE) → distance = 10000 - 48600 = -38600
    const casMin = r.find(t => t.thresholdId === 'CAS_MIN_BASE')!;
    expect(casMin.distance).toBe(lei(-38600));
    expect(casMin.status).toBe('breached');
  });

  it('exactly at threshold → zero distance', () => {
    const q: ThresholdQuery = { taxYear: 2026, asOfDate: '2026-06-15', bases: allBases(lei(48600)), ruleRelease: '2026-01-01' };
    const r = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q);
    const casMin = r.find(t => t.thresholdId === 'CAS_MIN_BASE')!;
    expect(casMin.distance).toBe(0);
    expect(casMin.status).toBe('warning'); // at threshold = warning boundary
  });

  it('returns thresholds for 2025', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, {
      taxYear: 2025,
      asOfDate: '2025-06-15',
      bases: allBases(lei(100000)),
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
    const q1: ThresholdQuery = { taxYear: 2026, asOfDate: '2026-06-15', bases: allBases(lei(100000)), ruleRelease: '2026-01-01' };
    const q2: ThresholdQuery = { taxYear: 2026, asOfDate: '2026-06-15', bases: allBases(lei(100000)), ruleRelease: '2026-01-01' };
    const r1 = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q1);
    const r2 = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q2);
    expect(r1).toEqual(r2);
  });

  it('just above threshold → positive distance', () => {
    const q: ThresholdQuery = { taxYear: 2026, asOfDate: '2026-06-15', bases: allBases(lei(48601)), ruleRelease: '2026-01-01' };
    const r = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q);
    const casMin = r.find(t => t.thresholdId === 'CAS_MIN_BASE')!;
    expect(casMin.distance).toBeGreaterThan(0);
  });

  it('max-base breach: CASS currentValue above 291600 → status breached', () => {
    const q: ThresholdQuery = {
      taxYear: 2026,
      asOfDate: '2026-03-15',
      bases: allBases(lei(300000)),
      ruleRelease: 'PFA_2026_RELEASE',
    };
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q);
    const cassMax = byId(result, 'CASS_MAX_BASE');
    expect(cassMax.distance).toBe(300000 - 291600);
    expect(cassMax.status).toBe('breached');
  });

  it('registration breach: currentValue at/above 395000 → status breached', () => {
    const q: ThresholdQuery = {
      taxYear: 2026,
      asOfDate: '2026-03-15',
      bases: allBases(lei(400000)),
      ruleRelease: 'PFA_2026_RELEASE',
    };
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q);
    const vat = byId(result, 'VAT_REGISTRATION');
    expect(vat.distance).toBe(400000 - 395000);
    expect(vat.status).toBe('breached');
  });

  it('warningDistance is exactly 10% of the threshold value', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    expect(byId(result, 'CAS_MIN_BASE').warningDistance).toBe(lei(4860)); // 48600 * 0.1
    expect(byId(result, 'CASS_MIN_BASE').warningDistance).toBe(lei(2430)); // 24300 * 0.1
    expect(byId(result, 'CASS_MAX_BASE').warningDistance).toBe(lei(29160)); // 291600 * 0.1
    expect(byId(result, 'VAT_REGISTRATION').warningDistance).toBe(lei(39500)); // 395000 * 0.1
  });

  it('min-base warning band end-to-end: distance exactly at +warningDistance → warning, just beyond → ok', () => {
    const q: ThresholdQuery = {
      taxYear: 2026,
      asOfDate: '2026-03-15',
      bases: allBases(lei(53460)), // 48600 + 4860 → distance exactly +warningDistance
      ruleRelease: 'PFA_2026_RELEASE',
    };
    const casMin = byId(computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q), 'CAS_MIN_BASE');
    expect(casMin.distance).toBe(lei(4860));
    expect(casMin.status).toBe('warning');

    const casMin2 = byId(
      computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, { ...q, bases: allBases(lei(53461)) }),
      'CAS_MIN_BASE',
    );
    expect(casMin2.distance).toBe(lei(4861));
    expect(casMin2.status).toBe('ok'); // just outside the band
  });

  it('max-base warning band end-to-end: distance exactly at -warningDistance → warning, just beyond → ok', () => {
    const q: ThresholdQuery = {
      taxYear: 2026,
      asOfDate: '2026-03-15',
      bases: allBases(lei(262440)), // 291600 - 29160 → distance exactly -warningDistance
      ruleRelease: 'PFA_2026_RELEASE',
    };
    const cassMax = byId(computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q), 'CASS_MAX_BASE');
    expect(cassMax.distance).toBe(lei(-29160));
    expect(cassMax.status).toBe('warning');

    const cassMax2 = byId(
      computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, { ...q, bases: allBases(lei(262439)) }),
      'CASS_MAX_BASE',
    );
    expect(cassMax2.distance).toBe(lei(-29161));
    expect(cassMax2.status).toBe('ok'); // just outside the band
  });

  it('registration warning band end-to-end: negative distance within the band → warning, beyond → ok', () => {
    const q: ThresholdQuery = {
      taxYear: 2026,
      asOfDate: '2026-03-15',
      bases: allBases(lei(355500)), // 395000 - 39500 → distance exactly -warningDistance
      ruleRelease: 'PFA_2026_RELEASE',
    };
    const vat = byId(computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q), 'VAT_REGISTRATION');
    expect(vat.distance).toBe(lei(-39500));
    expect(vat.status).toBe('warning');

    const vat2 = byId(
      computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, { ...q, bases: allBases(lei(355499)) }),
      'VAT_REGISTRATION',
    );
    expect(vat2.distance).toBe(lei(-39501));
    expect(vat2.status).toBe('ok'); // just outside the band
  });

  // --- Step 29: fiscal base, breachMeaning, and validation ---

  it('every threshold carries the base its spec declares, not the caller\'s single base', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    for (const t of result) {
      const spec = THRESHOLD_SPECS.find((s) => s.thresholdId === t.thresholdId)!;
      expect(t.fiscalBase).toBe(spec.requiredFiscalBase);
    }
    // The three contribution rows are contribution bases; VAT is a turnover base.
    expect(byId(result, 'CAS_MIN_BASE').fiscalBase).toBe('net-income');
    expect(byId(result, 'CASS_MIN_BASE').fiscalBase).toBe('net-income');
    expect(byId(result, 'CASS_MAX_BASE').fiscalBase).toBe('net-income');
    expect(byId(result, 'VAT_REGISTRATION').fiscalBase).toBe('revenue-excl-vat');
  });

  it('every spec cites the provision that defines its BASE, not just its value', () => {
    for (const spec of THRESHOLD_SPECS) {
      expect(spec.baseSourceArticle.length).toBeGreaterThan(0);
    }
    expect(byId(computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY), 'VAT_REGISTRATION').fiscalBase)
      .toBe('revenue-excl-vat');
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
    // Re-pointed from CAS_MAX_BASE to CASS_MAX_BASE in Phase 3: only CASS has a statutory
    // ceiling (CF art. 170 alin. (1)); CF art. 148 alin. (2) has no cap for CAS.
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    const cassMax = byId(result, 'CASS_MAX_BASE');
    expect(cassMax.breachMeaning).toContain('schimbare de regim');
  });

  it('registration breachMeaning mentions registration obligation', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    const vat = byId(result, 'VAT_REGISTRATION');
    expect(vat.breachMeaning).toContain('obligația de înregistrare');
  });

  // The old behaviour here was `toHaveLength(0)`: a base mismatch silently DELETED the
  // threshold card. That is the trap this phase exists to close, so the assertion is now the
  // opposite — an unsupplied base must produce a loud `review_required` row, never a gap.
  it('unsupplied base → loud review_required row, never a dropped threshold', () => {
    const q: ThresholdQuery = {
      taxYear: 2026,
      asOfDate: '2026-03-15',
      bases: { 'revenue-incl-vat': lei(100000), 'revenue-excl-vat': lei(100000) },
      ruleRelease: 'PFA_2026_RELEASE',
    };
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q);
    // Every spec still returns a row — nothing vanished.
    expect(result).toHaveLength(THRESHOLD_SPECS.length);
    const casMin = byId(result, 'CAS_MIN_BASE');
    expect(casMin.status).toBe('review_required');
    expect(casMin.currentValue).toBeNull();
    expect(casMin.reviewReason).toBeTruthy();
    // The VAT row, whose base WAS supplied, is still measured normally.
    expect(byId(result, 'VAT_REGISTRATION').status).not.toBe('review_required');
    expect(byId(result, 'VAT_REGISTRATION').currentValue).toBe(lei(100000));
  });

  it('no base supplied at all → every spec is review_required, none dropped', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, {
      taxYear: 2026,
      asOfDate: '2026-03-15',
      bases: {},
      ruleRelease: 'PFA_2026_RELEASE',
    });
    expect(result).toHaveLength(THRESHOLD_SPECS.length);
    for (const t of result) {
      expect(t.status).toBe('review_required');
      expect(t.currentValue).toBeNull();
    }
  });

  it('a spec is never silently dropped by a base mismatch (silent-skip guard)', () => {
    // Whatever bases we hand over, the row count equals the spec count. This is the test
    // that fails if someone reintroduces `continue` on a base mismatch.
    for (const bases of [allBases(lei(100000)), {}, { 'net-income': lei(1) }, { 'revenue-excl-vat': lei(1) }]) {
      const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, {
        taxYear: 2026,
        asOfDate: '2026-03-15',
        bases,
        ruleRelease: 'PFA_2026_RELEASE',
      });
      expect(result).toHaveLength(THRESHOLD_SPECS.length);
      expect(result.map((t) => t.thresholdId).sort()).toEqual(
        THRESHOLD_SPECS.map((s) => s.thresholdId).sort(),
      );
    }
  });
});

// Phase 6 §7 item 5: the 24 SM CAS boundary as a threshold of its own kind.
// CF art. 148 alin. (2): the chosen base "nu poate fi mai mic decât" 12 SM, and lit. b) raises that
// floor to 24 SM "în cazul veniturilor realizate cel puțin egale cu 24 de salarii minime brute pe
// țară". It is a LADDER STEP — not a ceiling (Phase 3 deleted CAS_MAX_BASE for asserting one) and
// not a regime change. The citation is the one Phase 3 established; no new provision is invented here.
describe('tier-floor — the 24 SM CAS ladder step', () => {
  const casRule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'CAS_2026')!;
  const casParamIds = casRule.parameters.map((p) => p.id);

  it('reads the 24 SM floor from the CAS rule, on the contribution base, with the ladder citation', () => {
    const spec = THRESHOLD_SPECS.find((s) => s.thresholdId === 'CAS_TIER2_FLOOR')!;
    expect(spec.type).toBe('tier-floor');
    expect(spec.ruleId).toBe('CAS_2026');
    // The SAME parameter calcCas compares against — the row and the amount cannot drift apart.
    expect(spec.paramId).toBe('tier2_base');
    expect(spec.affectedTax).toBe('cas');
    expect(spec.requiredFiscalBase).toBe('net-income');
    expect(spec.baseSourceArticle).toContain('art. 148 alin. (2) lit. b)');

    const row = byId(computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY), 'CAS_TIER2_FLOOR');
    expect(row.thresholdValue).toBe(lei(97200));
    expect(row.fiscalBase).toBe('net-income');
    expect(row.source).toContain('art. 148');
  });

  it('is crossed at the tier, inclusive — the same predicate calcCas uses', () => {
    // art. 148 alin. (2) lit. b) applies once realised income is "cel puțin egal cu" 24 SM.
    expect(statusFor('tier-floor', lei(0), lei(100))).toBe('breached');
    expect(statusFor('tier-floor', lei(1000), lei(100))).toBe('breached');
    expect(statusFor('tier-floor', lei(-1), lei(0))).toBe('ok');
    expect(statusFor('tier-floor', lei(-50), lei(100))).toBe('warning');
    expect(statusFor('tier-floor', lei(-101), lei(100))).toBe('ok');
  });

  it('crossing the tier and the doubled CAS floor move together on the same input', () => {
    // This is the acceptance condition: the visible threshold event and the doubled amount must be
    // two readings of ONE figure, not two independently hardcoded numbers.
    for (const { netIncome, cas, status } of [
      { netIncome: lei(60000), cas: lei(12150), status: 'ok' },
      // 97.199 is one leu below the tier, i.e. inside the app-chosen 10% warning band — the tier-1
      // floor still applies, but the step is close enough that `ok` would understate it.
      { netIncome: lei(97199), cas: lei(12150), status: 'warning' },
      { netIncome: lei(97200), cas: lei(24300), status: 'breached' },
    ] as const) {
      const row = byId(
        computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, { ...QUERY, bases: allBases(netIncome) }),
        'CAS_TIER2_FLOOR',
      );
      const computed = calculatorRegistry['calc-cas'](casRule, { base: netIncome });
      expect(computed, `CAS at ${netIncome}`).toMatchObject({ value: cas });
      expect(row.status, `threshold row at ${netIncome}`).toBe(status);
      expect(row.currentValue).toBe(netIncome);
    }
  });

  it('its breach meaning never claims a ceiling or a regime change', () => {
    const meaning = breachMeaningFor('tier-floor');
    expect(meaning).toContain('baza minimă');
    expect(meaning).not.toContain('schimbare de regim');
    expect(meaning).not.toContain('dezcalificare');
    // The only numbers are the statutory tier names (12 SM / 24 SM). No lei amount lives in this
    // string — 12.150 and 24.300 come from the `tier1_cas` / `tier2_cas` rule parameters.
    expect(meaning).not.toMatch(/\d{3}/);
  });

  it('no max_cas parameter returns anywhere in the package (Phase 3 guard)', () => {
    for (const rule of PFA_2026_SYSTEM_REAL_PACKAGE) {
      for (const param of rule.parameters) {
        expect(param.id).not.toBe('max_cas');
      }
    }
    expect(casParamIds).toContain('tier2_base');
    expect(casParamIds).not.toContain('max_base');
  });
});

describe('income threshold type (Step 29)', () => {
  it('statusFor: income breached when distance > 0', () => {
    expect(statusFor('income', lei(1), lei(100))).toBe('breached');
    expect(statusFor('income', lei(1000), lei(100))).toBe('breached');
  });

  it('statusFor: income warning when approaching the threshold (distance near 0)', () => {
    expect(statusFor('income', lei(0), lei(100))).toBe('warning');
    expect(statusFor('income', lei(-50), lei(100))).toBe('warning');
  });

  it('statusFor: income ok when distance < -warningDistance', () => {
    expect(statusFor('income', lei(-101), lei(100))).toBe('ok');
    expect(statusFor('income', lei(-500), lei(100))).toBe('ok');
  });

  it('statusFor: min-base breached when below minimum, ok when above', () => {
    expect(statusFor('min-base', lei(-100), lei(50))).toBe('breached');
    expect(statusFor('min-base', lei(100), lei(50))).toBe('ok');
  });

  it('statusFor: max-base breached when above maximum, ok when below', () => {
    expect(statusFor('max-base', lei(100), lei(50))).toBe('breached');
    expect(statusFor('max-base', lei(-100), lei(50))).toBe('ok');
  });

  it('statusFor: registration breached at/above threshold, ok below', () => {
    expect(statusFor('registration', lei(100), lei(50))).toBe('breached');
    expect(statusFor('registration', lei(0), lei(50))).toBe('breached'); // exactly at threshold
    expect(statusFor('registration', lei(-100), lei(50))).toBe('ok');
  });

  it('statusFor: min-base warning band outer boundary (exactly +warningDistance → warning, beyond → ok)', () => {
    expect(statusFor('min-base', lei(50), lei(50))).toBe('warning'); // exactly at +warningDistance
    expect(statusFor('min-base', lei(49), lei(50))).toBe('warning'); // inside the band
    expect(statusFor('min-base', lei(0), lei(50))).toBe('warning'); // exactly at threshold
    expect(statusFor('min-base', lei(51), lei(50))).toBe('ok'); // just outside the band
  });

  it('statusFor: max-base warning band outer boundary (exactly -warningDistance → warning, beyond → ok)', () => {
    expect(statusFor('max-base', lei(-50), lei(50))).toBe('warning'); // exactly at -warningDistance
    expect(statusFor('max-base', lei(-49), lei(50))).toBe('warning'); // inside the band
    expect(statusFor('max-base', lei(0), lei(50))).toBe('warning'); // exactly at threshold
    expect(statusFor('max-base', lei(-51), lei(50))).toBe('ok'); // just outside the band
  });

  it('statusFor: registration warning band (negative distance within the band → warning, beyond → ok)', () => {
    expect(statusFor('registration', lei(-50), lei(50))).toBe('warning'); // exactly at -warningDistance
    expect(statusFor('registration', lei(-49), lei(50))).toBe('warning'); // inside the band
    expect(statusFor('registration', lei(-51), lei(50))).toBe('ok'); // just outside the band
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
    current: lei(0),
    limit: lei(100),
    breached: false,
    ratio: 0,
    ...over,
  });

  it('ok below the warning band (ratio < 0.8)', () => {
    expect(statusForRatioRule(rule({ current: lei(50), ratio: 0.5 }))).toBe('ok');
    expect(statusForRatioRule(rule({ current: lei(79), ratio: 0.79 }))).toBe('ok');
  });

  it('warning at the boundary (ratio >= 0.8)', () => {
    expect(statusForRatioRule(rule({ current: lei(80), ratio: 0.8 }))).toBe('warning');
    expect(statusForRatioRule(rule({ current: lei(95), ratio: 0.95 }))).toBe('warning');
  });

  it('breached flag always wins over ratio', () => {
    expect(statusForRatioRule(rule({ current: lei(120), limit: lei(100), ratio: 1.2, breached: true }))).toBe('breached');
    // Even a low ratio is 'breached' when the caller flags it (e.g. zero-limit rule).
    expect(statusForRatioRule(rule({ current: lei(10), limit: lei(0), ratio: null, breached: true }))).toBe('breached');
  });

  it('zero-limit rule ("no cap"): current > 0 → breached, ratio stays null', () => {
    const r = rule({ current: lei(10), limit: lei(0), ratio: null, breached: true });
    expect(r.ratio).toBeNull();
    expect(statusForRatioRule(r)).toBe('breached');
  });

  it('zero-limit rule ("no cap"): current === 0 → ok, ratio stays null', () => {
    const r = rule({ current: lei(0), limit: lei(0), ratio: null, breached: false });
    expect(r.ratio).toBeNull();
    expect(statusForRatioRule(r)).toBe('ok');
  });

  it('withRatioRuleStatus attaches the derived status without mutating the input', () => {
    const r = rule({ current: lei(90), ratio: 0.9 });
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
      current: lei(100000),
      limit: lei(48600),
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
