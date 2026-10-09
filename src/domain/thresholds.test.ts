import { describe, expect, it } from 'vitest';
import { calculatorRegistry } from './fiscal/calculators';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import { createDefaultProfile } from './profile';
import {
  applicabilityFor,
  computeThresholds,
  engagedSide,
  severityFor,
  statusFor,
  statusForRatioRule,
  withRatioRuleStatus,
  THRESHOLD_SPECS,
  type FiscalThreshold,
  type RatioRule,
  type RatioRuleStatus,
  type ThresholdKind,
  type ThresholdQuery,
} from './thresholds';
import type { PfaProfile } from './models';
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

/**
 * TASK 4 — a profile for which EVERY shipped threshold applies: not a pensioner (CF art. 150 alin. (1)
 * would remove the CAS rows), CASS obligatory (B-19 makes any other flag `unknown`), no salary relief
 * (art. 174 alin. (7) lit. a)), and inside the VAT scutire so the art. 310 alin. (1) plafon still
 * decides something. The arithmetic tests below are about distance, so they need the rows applicable.
 */
const APPLICABLE_PROFILE: PfaProfile = createDefaultProfile({
  fiscalYear: 2026,
  pensionerStatus: 'nu',
  salaryStatus: 'nu',
  socialInsuranceStatus: 'obligatoriu',
  vatExempt: true,
});

const QUERY: ThresholdQuery = {
  taxYear: 2026,
  asOfDate: '2026-03-15',
  bases: allBases(lei(100000)),
  ruleRelease: 'PFA_2026_RELEASE',
  profile: APPLICABLE_PROFILE,
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
    expect(casMin.distance).toBe(lei(100_000) - lei(48_600));
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

  it('below threshold → negative distance, and never a breach for a contribution floor', () => {
    const q: ThresholdQuery = { taxYear: 2026, asOfDate: '2026-06-15', bases: allBases(lei(10000)), ruleRelease: '2026-01-01' };
    const r = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, q);
    // 10000 < 48600 (CAS_MIN_BASE) → distance = 10000 - 48600 = -38600
    const casMin = r.find(t => t.thresholdId === 'CAS_MIN_BASE')!;
    expect(casMin.distance).toBe(lei(-38600));
    // TASK 4 acceptance: no row can render a breach for income below a contribution floor. CF
    // art. 148 alin. (1) makes 12 SM the condition for the CAS obligation to exist at all, and
    // research 24 found no provision attaching any adverse consequence to a below-12-SM income. The
    // old expectation here was `breached`, which asserted exactly the consequence the law does not create.
    expect(casMin.kind).toBe('tier_transition');
    // The level IS in play — that is what the row exists to say — but "in play" is not "breached":
    // the worst a tier_transition row may claim is `warning`, and its severity is never `high`.
    expect(casMin.engaged).toBe(true);
    expect(casMin.status).toBe('warning');
    expect(casMin.status).not.toBe('breached');
    expect(casMin.severity).toBe('medium');
    expect(casMin.severity).not.toBe('high');
    expect(casMin.consequence).toContain('nu se datorează contribuția de asigurări sociale');
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
    expect(cassMax.distance).toBe(lei(300_000) - lei(291_600));
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
    expect(vat.distance).toBe(lei(400_000) - lei(395_000));
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

  it('every threshold carries a factual consequence that cites the provision it rests on', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    for (const t of result) {
      expect(typeof t.consequence).toBe('string');
      expect(t.consequence.length).toBeGreaterThan(0);
      // A consequence without a citation is an assertion, not a legal statement.
      expect(t.consequence).toMatch(/art\. \d+/);
    }
  });

  it('no consequence asserts a decălificare, a regime change or a penalty, in either direction', () => {
    // TASK 4: `breachMeaningFor` said 'Sub baza minimă — dezcalificare din regim' and 'Peste plafonul
    // maxim al bazei — schimbare de regim'. Both are deleted, not reworded: research 24 searched the
    // consolidated Cod fiscal and found zero occurrences of „decălificare" and no provision making a
    // below-floor income a breach, a regime change, a rectification duty, a penalty or a reportable
    // event. A reworded sentence would still assert a consequence the law does not create, so the
    // assertion is now the OPPOSITE of the one that lived here.
    const forbidden = ['dezcalificare', 'decălificare', 'schimbare de regim', 'penalizare', 'amendă', 'rectificare obligatorie'];
    for (const bases of [allBases(lei(10000)), allBases(lei(400000)), allBases(lei(900000))]) {
      for (const t of computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, { ...QUERY, bases })) {
        for (const phrase of forbidden) {
          expect(t.consequence, `${t.thresholdId}: ${t.consequence}`).not.toContain(phrase);
          expect(t.applicabilityReason ?? '').not.toContain(phrase);
        }
      }
    }
  });

  it('the CASS cap consequence states the cap on the base, not a regime change', () => {
    // Re-pointed from CAS_MAX_BASE in Phase 3: only CASS has a statutory ceiling (CF art. 170 alin. (1)).
    const cassMax = byId(
      computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, { ...QUERY, bases: allBases(lei(300000)) }),
      'CASS_MAX_BASE',
    );
    expect(cassMax.kind).toBe('over_limit');
    expect(cassMax.engaged).toBe(true);
    expect(cassMax.consequence).toContain('art. 170 alin. (1)');
    expect(cassMax.consequence).toContain('plafon');
  });

  it('registration consequence mentions the registration obligation, with its article', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    const vat = byId(result, 'VAT_REGISTRATION');
    expect(vat.consequence).toContain('obligația de înregistrare');
    expect(vat.consequence).toContain('art. 310 alin. (1)');
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

  it('is crossed at the tier, inclusive — the same predicate calcCas uses, and never a breach', () => {
    // art. 148 alin. (2) lit. b) applies once realised income is "cel puțin egal cu" 24 SM, so the
    // boundary is INCLUSIVE. But crossing a ladder rung is not exceeding a limit: with kind
    // `tier_transition` the most `statusFor` may say is `warning`. The old expectations here were
    // `breached`, which is the false claim TASK 4 removes.
    expect(statusFor('tier-floor', lei(0), lei(100), 'tier_transition')).toBe('warning');
    expect(statusFor('tier-floor', lei(1000), lei(100), 'tier_transition')).toBe('warning');
    expect(statusFor('tier-floor', lei(-1), lei(0), 'tier_transition')).toBe('ok');
    expect(statusFor('tier-floor', lei(-50), lei(100), 'tier_transition')).toBe('warning');
    expect(statusFor('tier-floor', lei(-101), lei(100), 'tier_transition')).toBe('ok');
    // The same arithmetic under a kind that CAN be exceeded is a breach — proof that the gate is the
    // kind, not the arithmetic shape.
    expect(statusFor('tier-floor', lei(0), lei(100), 'over_limit')).toBe('breached');
  });

  it('crossing the tier and the doubled CAS floor move together on the same input', () => {
    // This is the acceptance condition: the visible threshold event and the doubled amount must be
    // two readings of ONE figure, not two independently hardcoded numbers.
    for (const { netIncome, cas, status } of [
      { netIncome: lei(60000), cas: lei(12150), status: 'ok' },
      // 97.199 is one leu below the tier, i.e. inside the app-chosen 10% warning band — the tier-1
      // floor still applies, but the step is close enough that `ok` would understate it.
      { netIncome: lei(97199), cas: lei(12150), status: 'warning' },
      // TASK 4: crossing the tier is `warning`, not `breached`. The CAS amount doubles — that is the
      // fact worth showing — but nothing went wrong and no limit was exceeded.
      { netIncome: lei(97200), cas: lei(24300), status: 'warning' },
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

  it('its consequence states the minimum base, never a ceiling or a regime change', () => {
    // Replaces the assertion that pinned `breachMeaningFor('tier-floor')`. The row must say what
    // art. 148 alin. (2) provides — a higher MINIMUM base — and must not imply a cap (research 24,
    // "What the app must not state" item 7) or a regime change (item 1).
    const row = byId(
      computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, { ...QUERY, bases: allBases(lei(120000)) }),
      'CAS_TIER2_FLOOR',
    );
    expect(row.engaged).toBe(true);
    expect(row.consequence).toContain('baza minimă de calcul pentru CAS crește');
    expect(row.consequence).toContain('art. 148 alin. (2) lit. b)');
    expect(row.consequence).not.toContain('schimbare de regim');
    expect(row.consequence).not.toContain('dezcalificare');
    // No lei amount lives in this string — 12.150 and 24.300 come from the `tier1_cas` / `tier2_cas`
    // rule parameters, and the 24 SM level itself is rendered from `thresholdValue` and labelled as
    // computed. Only the statutory multipliers (12 SM / 24 SM) and the article number appear here.
    expect(row.consequence).not.toMatch(/\d[\d.]*\s*lei/);
    expect(row.consequence).not.toContain('12.150');
    expect(row.consequence).not.toContain('24.300');
    // And the lei threshold itself is labelled as computed, with the SM value and its act cited.
    expect(row.computedFrom?.multiplier).toBe(24);
    expect(row.computedFrom?.smAct).toBe('HG 1506/2024');
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

describe('statusFor — the kind decides, not the arithmetic (Step 29 / TASK 4)', () => {
  it('statusFor: income breached when distance > 0', () => {
    expect(statusFor('income', lei(1), lei(100), 'over_limit')).toBe('breached');
    expect(statusFor('income', lei(1000), lei(100), 'over_limit')).toBe('breached');
  });

  it('statusFor: income warning when approaching the threshold (distance near 0)', () => {
    expect(statusFor('income', lei(0), lei(100), 'over_limit')).toBe('warning');
    expect(statusFor('income', lei(-50), lei(100), 'over_limit')).toBe('warning');
  });

  it('statusFor: income ok when distance < -warningDistance', () => {
    expect(statusFor('income', lei(-101), lei(100), 'over_limit')).toBe('ok');
    expect(statusFor('income', lei(-500), lei(100), 'over_limit')).toBe('ok');
  });

  it('statusFor: a floor is never breached under a tier_transition kind, in either direction', () => {
    // This is the acceptance criterion in unit form: the arithmetic says "below the minimum", the law
    // says "nu datorează contribuția". Only the kind can tell those apart, so it is a parameter.
    expect(statusFor('min-base', lei(-100), lei(50), 'tier_transition')).toBe('warning');
    expect(statusFor('min-base', lei(100), lei(50), 'tier_transition')).toBe('ok');
    expect(statusFor('min-base', lei(-100), lei(50), 'informational')).toBe('warning');
    // The same arithmetic under a kind the law does cap is a breach — the gate is the kind.
    expect(statusFor('min-base', lei(-100), lei(50), 'over_limit')).toBe('breached');
  });

  it('statusFor: max-base breached when above maximum, ok when below', () => {
    expect(statusFor('max-base', lei(100), lei(50), 'over_limit')).toBe('breached');
    expect(statusFor('max-base', lei(-100), lei(50), 'over_limit')).toBe('ok');
  });

  it('statusFor: registration breached at/above threshold, ok below', () => {
    expect(statusFor('registration', lei(100), lei(50), 'registration')).toBe('breached');
    expect(statusFor('registration', lei(0), lei(50), 'registration')).toBe('breached'); // exactly at threshold
    expect(statusFor('registration', lei(-100), lei(50), 'registration')).toBe('ok');
  });

  it('statusFor: min-base warning band outer boundary (exactly +warningDistance → warning, beyond → ok)', () => {
    expect(statusFor('min-base', lei(50), lei(50), 'tier_transition')).toBe('warning'); // exactly at +warningDistance
    expect(statusFor('min-base', lei(49), lei(50), 'tier_transition')).toBe('warning'); // inside the band
    expect(statusFor('min-base', lei(0), lei(50), 'tier_transition')).toBe('warning'); // exactly at threshold
    expect(statusFor('min-base', lei(51), lei(50), 'tier_transition')).toBe('ok'); // just outside the band
  });

  it('statusFor: max-base warning band outer boundary (exactly -warningDistance → warning, beyond → ok)', () => {
    expect(statusFor('max-base', lei(-50), lei(50), 'over_limit')).toBe('warning'); // exactly at -warningDistance
    expect(statusFor('max-base', lei(-49), lei(50), 'over_limit')).toBe('warning'); // inside the band
    expect(statusFor('max-base', lei(0), lei(50), 'over_limit')).toBe('warning'); // exactly at threshold
    expect(statusFor('max-base', lei(-51), lei(50), 'over_limit')).toBe('ok'); // just outside the band
  });

  it('statusFor: registration warning band (negative distance within the band → warning, beyond → ok)', () => {
    expect(statusFor('registration', lei(-50), lei(50), 'registration')).toBe('warning'); // exactly at -warningDistance
    expect(statusFor('registration', lei(-49), lei(50), 'registration')).toBe('warning'); // inside the band
    expect(statusFor('registration', lei(-51), lei(50), 'registration')).toBe('ok'); // just outside the band
  });

  it('engagedSide names the side of the level where the consequence applies', () => {
    // A floor is engaged BELOW it; a cap or a duty level is engaged AT/ABOVE it. Replaces the
    // `breachMeaningFor('income')` assertion that pinned a string no spec ever rendered.
    expect(engagedSide('min-base', lei(-1))).toBe(true);
    expect(engagedSide('min-base', lei(0))).toBe(false);
    expect(engagedSide('max-base', lei(1))).toBe(true);
    expect(engagedSide('max-base', lei(0))).toBe(false);
    expect(engagedSide('income', lei(1))).toBe(true);
    expect(engagedSide('income', lei(0))).toBe(false); // reaching a cap exactly is not exceeding it
    expect(engagedSide('registration', lei(0))).toBe(true);
    expect(engagedSide('tier-floor', lei(0))).toBe(true);
  });

  it('the kind union is exactly the four TASK 4 members, and every spec declares one', () => {
    const kinds: ThresholdKind[] = ['registration', 'tier_transition', 'over_limit', 'informational'];
    expect(kinds).toEqual(['registration', 'tier_transition', 'over_limit', 'informational']);
    for (const spec of THRESHOLD_SPECS) {
      expect(kinds, spec.thresholdId).toContain(spec.kind);
    }
    // The shipped mapping: the three contribution levels are ladder rungs, the CASS ceiling is a cap,
    // the VAT plafon is a registration duty.
    expect(THRESHOLD_SPECS.map((s) => `${s.thresholdId}:${s.kind}`).sort()).toEqual([
      'CASS_MAX_BASE:over_limit',
      'CASS_MIN_BASE:tier_transition',
      'CAS_MIN_BASE:tier_transition',
      'CAS_TIER2_FLOOR:tier_transition',
      'VAT_REGISTRATION:registration',
    ]);
  });

  it('income has no fiscal rule spec (conceptual completeness only)', () => {
    const result = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    expect(result.every((t) => t.type !== 'income')).toBe(true);
  });
});

describe('TASK 4 — severity, applicability and the measured basis', () => {
  const specOf = (id: string) => THRESHOLD_SPECS.find((s) => s.thresholdId === id)!;
  const rowsFor = (profile: PfaProfile | undefined, netIncome: Bani, extra: Partial<ThresholdQuery> = {}) =>
    computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, {
      ...QUERY,
      bases: allBases(netIncome),
      profile,
      ...extra,
    });

  it('severity never reads the legal kind: identical facts give one severity, and no kind can even be passed', () => {
    // The independence is structural: `severityFor`'s parameter has no `kind` field, so a caller
    // CANNOT make a row urgent by pointing at its legal family. The line below would not compile with
    // a `kind` added, which is the guarantee the acceptance criterion asks for.
    const facts = { applicability: 'applicable' as const, status: 'warning' as const, distance: lei(-100), warningDistance: lei(500) };
    const kinds: ThresholdKind[] = ['registration', 'tier_transition', 'over_limit', 'informational'];
    const severities = kinds.map(() => severityFor(facts));
    expect(new Set(severities).size).toBe(1);
    expect(severities[0]).toBe('medium');
    expect(Object.keys(facts).sort()).toEqual(['applicability', 'distance', 'status', 'warningDistance']);

    // And the same kind at different distances gives DIFFERENT severities: urgency tracks the
    // measurement, not the legal label.
    expect(severityFor({ applicability: 'applicable', status: 'ok', distance: lei(-10), warningDistance: lei(500) })).toBe('low');
    expect(severityFor({ applicability: 'applicable', status: 'ok', distance: lei(-99999), warningDistance: lei(500) })).toBe('none');
    expect(severityFor({ applicability: 'applicable', status: 'breached', distance: lei(1), warningDistance: lei(500) })).toBe('high');
  });

  it('a legally non-breached row can still carry severity, and a breached one can be demoted', () => {
    // `review_required` is not a breach of anything, yet the user has work to do: severity medium.
    expect(severityFor({ applicability: 'applicable', status: 'review_required', distance: lei(0), warningDistance: lei(500) })).toBe('medium');
    // A crossing whose applicability the profile never established is reported, not shouted about.
    expect(severityFor({ applicability: 'unknown', status: 'breached', distance: lei(1), warningDistance: lei(500) })).toBe('medium');
    expect(severityFor({ applicability: 'applicable', status: 'breached', distance: lei(1), warningDistance: lei(500) })).toBe('high');
  });

  it('an inapplicable row carries severity none whatever its status says', () => {
    for (const status of ['ok', 'warning', 'breached', 'review_required'] as const) {
      expect(
        severityFor({ applicability: 'not_applicable', status, distance: lei(10), warningDistance: lei(500) }),
        `status ${status}`,
      ).toBe('none');
    }
  });

  it('a pensioner profile makes both CAS rows not applicable, with the art. 150 alin. (1) reason', () => {
    // TASK 5: CAS still keys on the STATUS — the one provision in this area where a status is the right
    // key. It now reads `pensionerStatus`, not the deprecated `pensionStatus`.
    const rows = rowsFor({ ...APPLICABLE_PROFILE, pensionerStatus: 'da' }, lei(100000));
    for (const id of ['CAS_MIN_BASE', 'CAS_TIER2_FLOOR']) {
      const row = byId(rows, id);
      expect(row.applicability, id).toBe('not_applicable');
      expect(row.applicabilityReason ?? '', id).toContain('art. 150 alin. (1)');
      expect(row.severity, id).toBe('none');
      // The row is still measured and still shown — it just cannot render as a breach.
      expect(row.currentValue, id).toBe(lei(100000));
    }
  });

  // TASK 5 — the art. 174 alin. (2) zero/loss branch used to return `not_applicable` for BOTH CASS rows
  // on the same citation. That settled by inference a question research 25 gap 2 records as unresolved:
  // whether the alin. (6) 6-SM difference survives a zero/loss year. The cap row keeps the citation (no
  // base, nothing to cap); the top-up row is now undecided and says why.
  it('a zero net income leaves the CASS top-up row unknown, not decided by inference (art. 174 alin. (2) vs alin. (6))', () => {
    const rows = rowsFor(APPLICABLE_PROFILE, lei(0));
    const topUp = byId(rows, 'CASS_MIN_BASE');
    expect(topUp.applicability).toBe('unknown');
    expect(topUp.applicabilityReason ?? '').toContain('Notă de interpretare');
    expect(topUp.applicabilityReason ?? '').toContain('art. 174 alin. (6)');
    expect(topUp.applicabilityReason ?? '').toContain('research 25');
    expect(topUp.status).not.toBe('breached');
  });

  it('a zero net income still makes the CASS cap row not applicable (art. 174 alin. (2))', () => {
    const rows = rowsFor(APPLICABLE_PROFILE, lei(0));
    const cap = byId(rows, 'CASS_MAX_BASE');
    expect(cap.applicability).toBe('not_applicable');
    expect(cap.applicabilityReason ?? '').toContain('art. 174 alin. (2)');
    expect(cap.applicabilityReason ?? '').toContain('art. 180 alin. (1)');
    expect(cap.severity).toBe('none');
    expect(cap.status).not.toBe('breached');
  });

  it('a fiscal loss splits the same way as a zero year', () => {
    const rows = rowsFor(APPLICABLE_PROFILE, lei(-50000));
    expect(byId(rows, 'CASS_MIN_BASE').applicability).toBe('unknown');
    expect(byId(rows, 'CASS_MAX_BASE').applicability).toBe('not_applicable');
  });

  it('pension sums received in the fiscal year remove the CASS 6 SM top-up row but keep the cap row applicable', () => {
    // CF art. 174 alin. (7) lit. c) removes ONLY the art. 174 alin. (6) difference; 10 % × net is still
    // owed, so the 72-SM cap row still applies. Never mirror the CAS pensioner exemption into CASS.
    const rows = rowsFor(
      { ...APPLICABLE_PROFILE, pensionReceiptYears: [{ fiscalYear: 2026, received: 'da' }] },
      lei(10000),
    );
    expect(byId(rows, 'CASS_MIN_BASE').applicability).toBe('not_applicable');
    expect(byId(rows, 'CASS_MIN_BASE').applicabilityReason ?? '').toContain('art. 174 alin. (7) lit. c)');
    expect(byId(rows, 'CASS_MIN_BASE').applicabilityReason ?? '').toContain('art. 99 alin. (1)');
    expect(byId(rows, 'CASS_MAX_BASE').applicability).toBe('applicable');
  });

  // TASK 5 — the defect: the relief used to fire on `pensionStatus === 'da'`. Status is not the fact
  // alin. (7) tests, so a status with no receipt fact for the year decides nothing.
  it('pensioner status alone does NOT remove the top-up row: the receipt fact is missing, so it is unknown', () => {
    const rows = rowsFor({ ...APPLICABLE_PROFILE, pensionerStatus: 'da' }, lei(10000));
    const row = byId(rows, 'CASS_MIN_BASE');
    expect(row.applicability).toBe('unknown');
    expect(row.applicabilityReason ?? '').toContain('art. 174 alin. (7) lit. c)');
    expect(row.applicabilityReason ?? '').toContain('alin. (8) nu extinde excepția la pensionari');
  });

  it('a receipt fact recorded for another year does not relieve this year', () => {
    const rows = rowsFor(
      { ...APPLICABLE_PROFILE, pensionReceiptYears: [{ fiscalYear: 2025, received: 'da' }] },
      lei(10000),
    );
    expect(byId(rows, 'CASS_MIN_BASE').applicability).toBe('applicable');
  });

  it('a recorded `nu` receipt for the year leaves the top-up applicable — the pensioner did not qualify', () => {
    const rows = rowsFor(
      { ...APPLICABLE_PROFILE, pensionerStatus: 'da', pensionReceiptYears: [{ fiscalYear: 2026, received: 'nu' }] },
      lei(10000),
    );
    expect(byId(rows, 'CASS_MIN_BASE').applicability).toBe('applicable');
  });

  // lit. c) carries no monetary qualifier. The profile holds no pension amount at all, and the row is
  // still relieved — an invented 6-SM test on lit. c) has nowhere to attach.
  it('lit. c) has no amount threshold: relief fires with no pension quantum anywhere in the profile', () => {
    const rows = rowsFor(
      { ...APPLICABLE_PROFILE, pensionReceiptYears: [{ fiscalYear: 2026, received: 'da' }] },
      lei(100),
    );
    expect(byId(rows, 'CASS_MIN_BASE').applicability).toBe('not_applicable');
    expect(byId(rows, 'CASS_MIN_BASE').applicabilityReason ?? '').toContain('nu are niciun prag valoric');
  });

  // CF art. 174 alin. (8): the previous-year route, with no pension fact present at all.
  it('the art. 174 alin. (8) previous-year art. 154 category removes the top-up row', () => {
    const rows = rowsFor(
      { ...APPLICABLE_PROFILE, cassPreviousYearContext: { previousFiscalYear: 2025, inExceptedCategory: 'da' } },
      lei(10000),
    );
    expect(byId(rows, 'CASS_MIN_BASE').applicability).toBe('not_applicable');
    expect(byId(rows, 'CASS_MIN_BASE').applicabilityReason ?? '').toContain('art. 174 alin. (8)');
    expect(byId(rows, 'CASS_MIN_BASE').applicabilityReason ?? '').toContain('nu include pensionarii');
    // alin. (8) reaches the top-up only — the cap row keeps applying.
    expect(byId(rows, 'CASS_MAX_BASE').applicability).toBe('applicable');
  });

  it('the art. 174 alin. (8) art. 180 alin. (1) option route removes the top-up row', () => {
    const rows = rowsFor(
      { ...APPLICABLE_PROFILE, cassPreviousYearContext: { previousFiscalYear: 2025, optedUnderArt180Alin1: 'da' } },
      lei(10000),
    );
    expect(byId(rows, 'CASS_MIN_BASE').applicability).toBe('not_applicable');
  });

  // alin. (8) is previous-year-scoped: a context attributed to the income year is not the fact it asks
  // for, and pensioner status may never stand in for it.
  it('an art. 174 alin. (8) context attributed to the wrong year relieves nothing', () => {
    const rows = rowsFor(
      { ...APPLICABLE_PROFILE, cassPreviousYearContext: { previousFiscalYear: 2026, inExceptedCategory: 'da' } },
      lei(10000),
    );
    expect(byId(rows, 'CASS_MIN_BASE').applicability).toBe('applicable');
  });

  // CF art. 153 alin. (2) removes the CASS taxpayer quality itself, so it reaches BOTH CASS rows — the
  // one ground in this area that does, and it is unrelated to pensions.
  it('proved foreign sickness/maternity insurance makes BOTH CASS rows not applicable (art. 153 alin. (2))', () => {
    const rows = rowsFor(
      { ...APPLICABLE_PROFILE, foreignSicknessInsurance: { fiscalYear: 2026, held: 'da', proved: 'da' } },
      lei(100000),
    );
    for (const id of ['CASS_MIN_BASE', 'CASS_MAX_BASE']) {
      expect(byId(rows, id).applicability, id).toBe('not_applicable');
      expect(byId(rows, id).applicabilityReason ?? '', id).toContain('art. 153 alin. (2)');
      expect(byId(rows, id).severity, id).toBe('none');
    }
    // CAS is untouched by it — art. 153 alin. (2) is a CASS provision.
    expect(byId(rows, 'CAS_MIN_BASE').applicability).toBe('applicable');
  });

  it('foreign insurance held but not proved is not the art. 153 alin. (2) exclusion', () => {
    const rows = rowsFor(
      { ...APPLICABLE_PROFILE, foreignSicknessInsurance: { fiscalYear: 2026, held: 'da' } },
      lei(100000),
    );
    expect(byId(rows, 'CASS_MAX_BASE').applicability).toBe('applicable');
  });

  // CF art. 174 alin. (7) lit. b): other art. 155 alin. (1) lit. c)-h) income at least 6 SM. The profile
  // declares such incomes but the app holds no amount, so the condition is undecided — never assumed.
  it('declared other income leaves the top-up row unknown: art. 174 alin. (7) lit. b) cannot be tested', () => {
    const rows = rowsFor({ ...APPLICABLE_PROFILE, otherIncome: ['imobiliare'] }, lei(10000));
    const row = byId(rows, 'CASS_MIN_BASE');
    expect(row.applicability).toBe('unknown');
    expect(row.applicabilityReason ?? '').toContain('art. 174 alin. (7) lit. b)');
    // The cap row is unaffected — lit. b) reaches only the top-up.
    expect(byId(rows, 'CASS_MAX_BASE').applicability).toBe('applicable');
  });

  it('the art. 174 alin. (7) lit. a) salary relief: decided with the amount, unknown without it', () => {
    const cassMin = (profile: PfaProfile) => byId(rowsFor(profile, lei(10000)), 'CASS_MIN_BASE');
    // Salary at least 6 SM (the row's own threshold, 24.300 lei) → the top-up row does not apply.
    const relieved = cassMin({ ...APPLICABLE_PROFILE, salaryStatus: 'da', salaryIncomeLei: lei(30000) });
    expect(relieved.applicability).toBe('not_applicable');
    expect(relieved.applicabilityReason ?? '').toContain('art. 174 alin. (7) lit. a)');
    // Salary declared but the amount missing → the app has no input for the comparison and says so.
    expect(cassMin({ ...APPLICABLE_PROFILE, salaryStatus: 'da' }).applicability).toBe('unknown');
    // Salary below 6 SM → the condition is not met and the top-up stands.
    expect(cassMin({ ...APPLICABLE_PROFILE, salaryStatus: 'da', salaryIncomeLei: lei(20000) }).applicability).toBe('applicable');
  });

  it('an unverified CASS status flag leaves the CASS rows unknown, never assumed applicable (B-19)', () => {
    for (const flag of ['exempt', 'neplata'] as const) {
      const rows = rowsFor({ ...APPLICABLE_PROFILE, socialInsuranceStatus: flag }, lei(100000));
      for (const id of ['CASS_MIN_BASE', 'CASS_MAX_BASE']) {
        expect(byId(rows, id).applicability, `${id} / ${flag}`).toBe('unknown');
        expect(byId(rows, id).applicabilityReason ?? '', `${id} / ${flag}`).toContain('art. 154 alin. (1)');
      }
    }
  });

  it('VAT_REGISTRATION applies only while the profile is inside the VAT scutire (art. 310 alin. (1))', () => {
    const registered = byId(rowsFor({ ...APPLICABLE_PROFILE, vatExempt: false }, lei(100000)), 'VAT_REGISTRATION');
    expect(registered.applicability).toBe('not_applicable');
    expect(registered.applicabilityReason ?? '').toContain('art. 310 alin. (1)');
    expect(registered.severity).toBe('none');
    // The row is still measured — the plafon and the YTD turnover stay visible.
    expect(registered.currentValue).toBe(lei(100000));

    const exempt = byId(rowsFor(APPLICABLE_PROFILE, lei(100000)), 'VAT_REGISTRATION');
    expect(exempt.applicability).toBe('applicable');
  });

  it('an inapplicable row cannot render as a breach even when its level is engaged', () => {
    // The VAT profile is already registered (row not applicable) while the turnover is far above the
    // plafon: the status may say the level was passed, the severity must still be none.
    const row = byId(rowsFor({ ...APPLICABLE_PROFILE, vatExempt: false }, lei(900000)), 'VAT_REGISTRATION');
    expect(row.engaged).toBe(true);
    expect(row.applicability).toBe('not_applicable');
    expect(row.severity).toBe('none');
  });

  it('no profile supplied → every row is unknown, never assumed applicable', () => {
    const rows = rowsFor(undefined, lei(100000));
    for (const t of rows) {
      expect(t.applicability, t.thresholdId).toBe('unknown');
      expect(t.applicabilityReason ?? '', t.thresholdId).toBeTruthy();
      // Unknown is never allowed to escalate to the top of the severity scale.
      expect(t.severity, t.thresholdId).not.toBe('high');
    }
  });

  it('applicabilityFor is total over the shipped specs: every spec names a test that answers', () => {
    for (const spec of THRESHOLD_SPECS) {
      const decision = applicabilityFor(spec, APPLICABLE_PROFILE, lei(100000), lei(24300));
      expect(['applicable', 'not_applicable', 'unknown'], spec.thresholdId).toContain(decision.applicability);
      if (decision.applicability !== 'applicable') expect(decision.reason, spec.thresholdId).toBeTruthy();
    }
  });

  it('each row states which basis it measured: annual for contributions, YTD for the VAT plafon', () => {
    const rows = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, {
      ...QUERY,
      measuredBasis: { 'net-income': 'annual-projected', 'revenue-excl-vat': 'ytd-turnover' },
    });
    for (const id of ['CAS_MIN_BASE', 'CAS_TIER2_FLOOR', 'CASS_MIN_BASE', 'CASS_MAX_BASE']) {
      expect(byId(rows, id).measuredBasis, id).toBe('annual-projected');
    }
    expect(byId(rows, 'VAT_REGISTRATION').measuredBasis).toBe('ytd-turnover');
  });

  it('an unmeasured row says it was unmeasured, and claims no legal consequence', () => {
    const rows = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, { ...QUERY, bases: {} });
    for (const t of rows) {
      expect(t.measuredBasis, t.thresholdId).toBe('unmeasured');
      expect(t.engaged, t.thresholdId).toBe(false);
      expect(t.consequence, t.thresholdId).toContain('nu poate fi stabilit');
      expect(t.severity, t.thresholdId).toBe('medium');
    }
  });

  it('every SM-multiple threshold carries its computed-amount label, and the label verifies', () => {
    const rows = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    for (const spec of THRESHOLD_SPECS) {
      const row = byId(rows, spec.thresholdId);
      if (spec.statutorySmMultiplier === undefined) {
        // CF art. 310 alin. (1) states 395.000 lei itself: labelling it as computed would be false.
        expect(row.computedFrom, spec.thresholdId).toBeUndefined();
        continue;
      }
      // The lei amount is labelled as computed, with the SM value and the act that set it.
      expect(row.computedFrom, spec.thresholdId).toBeDefined();
      expect(row.computedFrom?.multiplier, spec.thresholdId).toBe(spec.statutorySmMultiplier);
      expect(row.computedFrom?.smValueBani, spec.thresholdId).toBe(lei(4050));
      expect(row.computedFrom?.smAct, spec.thresholdId).toBe('HG 1506/2024');
      // Drift guard: the label is only attached when the arithmetic checks out, so a parameter that
      // stops being a multiple of the package SM would fail here instead of silently losing the label.
      expect(row.computedFrom!.multiplier * row.computedFrom!.smValueBani, spec.thresholdId).toBe(row.thresholdValue);
      // And the law is stated as a multiplier, never as a lei amount (research 24, must-not-state 6).
      expect(row.computedFrom?.note, spec.thresholdId).toContain('nu în lei');
      expect(row.computedFrom?.note, spec.thresholdId).toContain('HG 146/2026');
    }
  });

  it('the 10 % warning distance stays application policy and never acquires a citation', () => {
    const rows = computeThresholds(PFA_2026_SYSTEM_REAL_PACKAGE, QUERY);
    for (const t of rows) {
      // The band is derived from the threshold by the app's own rule, not read from any rule parameter.
      expect(t.warningDistance, t.thresholdId).toBe(Math.floor(t.thresholdValue / 10) as Bani);
      // No sentence the user reads presents the band as a legal distance, and the row carries no
      // source/citation attached to it — only `thresholdValue` has a `source`.
      expect(t.consequence, t.thresholdId).not.toMatch(/band[ăa] de avertizare/i);
      expect(t.applicabilityReason ?? '', t.thresholdId).not.toMatch(/band[ăa] de avertizare/i);
      const citedFields = Object.keys(t).filter((k) => /source|citation|article/i.test(k));
      expect(citedFields, t.thresholdId).toEqual(['source']);
      expect(Object.keys(t), t.thresholdId).not.toContain('warningSource');
    }
  });

  it('every spec names an applicability test, so no row silently defaults to applicable', () => {
    for (const spec of THRESHOLD_SPECS) {
      expect(['cas-art-150-1', 'cass-art-174-6', 'cass-art-170-1', 'vat-art-310'], spec.thresholdId).toContain(
        spec.applicabilityTest,
      );
    }
    expect(specOf('CASS_MIN_BASE').applicabilityTest).toBe('cass-art-174-6');
    expect(specOf('CASS_MAX_BASE').applicabilityTest).toBe('cass-art-170-1');
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
