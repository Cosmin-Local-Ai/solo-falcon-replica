/**
 * B-45 — the minimum-wage vintage a derived base was built from, and the proof that saying it is not a
 * rule-package release.
 *
 * The FY2026 SM question is closed in the register, twice: `STATE.md` `Q-SM-VALUES (U-6)` and the CORECTIE
 * under it, corroborated by `research/26` §11 — **CF art. 135¹ alin. (3)** fixes the governing value as the
 * one in force on **1 January of the year the income is realised**, „indiferent dacă în cursul aceluiași an
 * se utilizează mai multe valori". So 6 SM = 24.300, 12 SM = 48.600, 24 SM = 97.200 and 72 SM = 291.600 lei
 * are derivable for FY2026, and the mid-year rise to 4.325 lei (HG 146/2026) does not re-anchor them.
 *
 * What B-45 actually carries is not that legal question — it is that the **calculation record** could not
 * show which SM a derived base came from. The CAS/CASS floors are stored as absolute lei
 * (`package2026.ts`: 48.600 / 97.200 / 12.150 / 24.300 / 24.300 / 291.600); the multiplier and the anchor
 * lived only on the threshold surface (`thresholds.ts` `ComputedLeiAmount`), so a stored number named a
 * cause it could not name. The anchor is now written on the parameters themselves, beside the ladder
 * parameters that already carried one.
 *
 * **Why this is not a rule-package release, and the test that proves it rather than asserting it.**
 * `digestRule` (`ruleSetDigest.ts:90`) projects a rule onto `{ruleId, taxRegime, taxYear, effectiveFrom,
 * effectiveTo, status, calculatorId, parameters:[{id, value, unit}]}`. A parameter's `label` and
 * `description` are outside that projection, so adding provenance to them cannot move a digest. The frozen
 * hex below was captured from the tree BEFORE the edit and re-measured AFTER: byte-identical, canonical
 * string 60.780 characters both times. If a later change moves it, that is a release and must be taken
 * deliberately, under `docs/ai/phases/20_rule_release_immutability.md` §6 — not slipped through as prose.
 */
import { describe, expect, it } from 'vitest';
import { canonicalRuleSet, digestRule, ruleSetDigest } from './ruleSetDigest';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';

/** Captured from the tree before the B-45 wording landed; re-measured after. Do not edit to make a test pass. */
const PFA_2026_RULE_SET_DIGEST = 'd1be810b734ce16432edf6a64d4b79964b6c4919eb6474df3a6c5a5e49a22da8';
const PFA_2026_CANONICAL_LENGTH = 60780;

/** The SM-derived absolute-lei bases the contribution engine reads. Each must name its anchor. */
const SM_DERIVED_PARAMETERS: readonly [ruleId: string, paramId: string, expectedBani: number][] = [
  ['CAS_2026', 'min_base', 4860000],
  ['CAS_2026', 'tier2_base', 9720000],
  ['CAS_2026', 'tier1_cas', 1215000],
  ['CAS_2026', 'tier2_cas', 2430000],
  ['CASS_2026', 'min_base', 2430000],
  ['CASS_2026', 'max_annual_base', 29160000],
];

describe('B-45 — the SM anchor on the derived bases, and the digest that did not move', () => {
  it('the 2026 rule-set digest is the frozen one: adding the SM anchor moved nothing', () => {
    expect(ruleSetDigest(PFA_2026_SYSTEM_REAL_PACKAGE)).toBe(PFA_2026_RULE_SET_DIGEST);
    expect(canonicalRuleSet(PFA_2026_SYSTEM_REAL_PACKAGE).length).toBe(PFA_2026_CANONICAL_LENGTH);
  });

  it('a parameter label and description are outside the digest projection — which is WHY this is not a release', () => {
    // Pinned as a mechanism, not as a one-off: the next person who wants to add provenance needs to know
    // which fields are safe to touch and which are a release.
    const cas = PFA_2026_SYSTEM_REAL_PACKAGE.find(r => r.ruleId === 'CAS_2026')!;
    const projected = digestRule(cas);
    const parameterIds = projected.parameters.map(p => p.id);
    expect(parameterIds).toContain('min_base');
    // The projection carries id/value/unit and nothing else.
    for (const p of projected.parameters) {
      expect(Object.keys(p).sort()).toEqual(['id', 'unit', 'value']);
    }
    // And the real parameter DOES carry text the hash never sees.
    const minBase = cas.parameters.find(p => p.id === 'min_base')!;
    expect(minBase.description).toBeTruthy();
    expect(JSON.stringify(projected)).not.toContain(minBase.description!);
  });

  it('every SM-derived base names the SM it was derived from and the article that fixes it', () => {
    for (const [ruleId, paramId, expectedBani] of SM_DERIVED_PARAMETERS) {
      const rule = PFA_2026_SYSTEM_REAL_PACKAGE.find(r => r.ruleId === ruleId);
      expect(rule, `rule ${ruleId} is in the 2026 package`).toBeTruthy();
      const param = rule!.parameters.find(p => p.id === paramId);
      expect(param, `${ruleId}.${paramId} exists`).toBeTruthy();
      expect(Number(param!.value)).toBe(expectedBani);
      const text = `${param!.label} ${param!.description ?? ''}`;
      // The value alone is not the assumption: 48.600 lei is only explainable as 12 × the SM that governs
      // the year, and the article that says which SM that is is art. 135^1 alin. (3).
      expect(text).toMatch(/4\.050/);
      expect(text).toMatch(/135(¹|\^1) alin\. \(3\)/);
    }
  });

  it('the two minimum-wage rules still carry both FY2026 values, so the record can show the rise it did NOT use', () => {
    const h1 = PFA_2026_SYSTEM_REAL_PACKAGE.find(r => r.ruleId === 'GENERAL_MINIMUM_WAGE_2026_H1')!;
    const h2 = PFA_2026_SYSTEM_REAL_PACKAGE.find(r => r.ruleId === 'GENERAL_MINIMUM_WAGE_2026_H2')!;
    expect(Number(h1.parameters[0].value)).toBe(405000);
    expect(Number(h2.parameters[0].value)).toBe(432500);
    // The honest pairing: the year contains two wages, and the bases use the January one.
    expect(h1.effectiveFrom).toBe('2026-01-01');
    expect(h2.effectiveFrom).toBe('2026-07-01');
  });
});
