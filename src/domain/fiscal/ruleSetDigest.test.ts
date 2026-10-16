/**
 * TASK 6 — the canonical serialisation, pinned.
 *
 * A hash over an object graph is only as stable as its key order, and key order is an artefact of how the
 * object happened to be built. These tests do not ask whether the digest is deterministic when nothing
 * changes — they ask the two questions that matter:
 *
 *   1. does the SAME rule set produce the same digest when it is built a different way? (key order, array
 *      order, a fresh object per rule)
 *   2. does a rule set that differs in a formula-bearing parameter produce a DIFFERENT digest?
 *
 * Plus the boundary between them: a digest that moved for a citation or a version number would be a hash
 * of prose, not of arithmetic, and would turn every wording correction into a fake legal revision.
 */
import { describe, expect, it } from 'vitest';
import type { FiscalRule } from './rules';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';
import {
  DuplicateRuleIdError,
  RULE_SET_SCHEME,
  canonicalRuleSet,
  ruleDigest,
  ruleSetDigest,
} from './ruleSetDigest';

/**
 * Rebuild a rule as a fresh object literal with the keys declared in (almost) reverse order, and the
 * parameters likewise. Structurally identical, built by a different path — which is exactly what a
 * content address has to be indifferent to.
 */
function rebuilt(rule: FiscalRule): FiscalRule {
  const copy: FiscalRule = {
    version: rule.version,
    status: rule.status,
    verifiedAt: rule.verifiedAt,
    sourceUrl: rule.sourceUrl,
    sourceArticle: rule.sourceArticle,
    sourceAct: rule.sourceAct,
    calculatorId: rule.calculatorId,
    parameters: rule.parameters.map((p) => ({
      description: p.description,
      unit: p.unit,
      value: p.value,
      label: p.label,
      id: p.id,
    })),
    effectiveTo: rule.effectiveTo,
    effectiveFrom: rule.effectiveFrom,
    taxYear: rule.taxYear,
    taxRegime: rule.taxRegime,
    entityType: rule.entityType,
    jurisdiction: rule.jurisdiction,
    name: rule.name,
    ruleId: rule.ruleId,
  };
  if (rule.supersededBy !== undefined) copy.supersededBy = rule.supersededBy;
  return copy;
}

function casRule(): FiscalRule {
  return PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'CAS_2026')!;
}

describe('ruleSetDigest — stability across construction path', () => {
  it('gives the 48-rule package the same digest when every rule is rebuilt with keys in a different order', () => {
    const asDefined = ruleSetDigest(PFA_2026_SYSTEM_REAL_PACKAGE);
    const rebuiltForward = ruleSetDigest(PFA_2026_SYSTEM_REAL_PACKAGE.map(rebuilt));
    expect(rebuiltForward).toBe(asDefined);
  });

  it('is indifferent to the order the rules are listed in', () => {
    const forward = ruleSetDigest(PFA_2026_SYSTEM_REAL_PACKAGE);
    const reversed = ruleSetDigest([...PFA_2026_SYSTEM_REAL_PACKAGE].reverse());
    const shuffled = ruleSetDigest([
      ...PFA_2026_SYSTEM_REAL_PACKAGE.slice(20),
      ...PFA_2026_SYSTEM_REAL_PACKAGE.slice(0, 20),
    ]);
    expect(reversed).toBe(forward);
    expect(shuffled).toBe(forward);
  });

  it('is indifferent to the order the parameters are listed in', () => {
    const rule = casRule();
    const a = ruleSetDigest([rule]);
    const b = ruleSetDigest([{ ...rule, parameters: [...rule.parameters].reverse() }]);
    expect(b).toBe(a);
  });

  it('is a 64-char lowercase hex digest, and the same every time it is asked', () => {
    const first = ruleSetDigest(PFA_2026_SYSTEM_REAL_PACKAGE);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(ruleSetDigest(PFA_2026_SYSTEM_REAL_PACKAGE)).toBe(first);
  });

  it('mixes the scheme tag into the canonical bytes, so two schemes can never be compared', () => {
    expect(canonicalRuleSet([casRule()])).toMatch(new RegExp(`^${RULE_SET_SCHEME}\\|`));
  });
});

describe('ruleSetDigest — sensitivity to formula-bearing content', () => {
  it('changes when one formula-bearing parameter value changes', () => {
    const rule = casRule();
    const before = ruleSetDigest([rule]);
    const rateChanged = ruleSetDigest([
      {
        ...rule,
        parameters: rule.parameters.map((p) => (p.id === 'rate' ? { ...p, value: 26 } : p)),
      },
    ]);
    expect(rateChanged).not.toBe(before);
  });

  it('changes when a lei parameter is re-labelled as euro — the unit is load-bearing, not decoration', () => {
    const rule = casRule();
    const unitChanged = ruleSetDigest([
      {
        ...rule,
        parameters: rule.parameters.map((p) => (p.id === 'min_base' ? { ...p, unit: 'eur' } : p)),
      },
    ]);
    expect(unitChanged).not.toBe(ruleSetDigest([rule]));
  });

  it('changes when a parameter is added or removed', () => {
    const rule = casRule();
    const base = ruleSetDigest([rule]);
    expect(ruleSetDigest([{ ...rule, parameters: rule.parameters.slice(1) }])).not.toBe(base);
    expect(
      ruleSetDigest([
        { ...rule, parameters: [...rule.parameters, { id: 'extra', label: 'x', value: 1, unit: 'count' }] },
      ]),
    ).not.toBe(base);
  });

  it.each([
    ['taxYear', (r: FiscalRule) => ({ ...r, taxYear: 2027 })],
    ['effectiveFrom', (r: FiscalRule) => ({ ...r, effectiveFrom: '2026-02-01' })],
    ['effectiveTo', (r: FiscalRule) => ({ ...r, effectiveTo: '2026-06-30' })],
    ['status', (r: FiscalRule) => ({ ...r, status: 'SUPERSEDED' as const })],
    ['calculatorId', (r: FiscalRule) => ({ ...r, calculatorId: 'calc-other' })],
    ['taxRegime', (r: FiscalRule) => ({ ...r, taxRegime: 'cass' as const })],
    ['ruleId', (r: FiscalRule) => ({ ...r, ruleId: 'CAS_2026_B' })],
  ])('changes when the gate field %s changes, because selectApplicableRules reads it', (_field, mutate) => {
    const rule = casRule();
    expect(ruleSetDigest([mutate(rule)])).not.toBe(ruleSetDigest([rule]));
  });
});

describe('ruleSetDigest — what it deliberately ignores', () => {
  it.each([
    ['name', (r: FiscalRule) => ({ ...r, name: 'CAS 2026, al doilea nume' })],
    ['jurisdiction', (r: FiscalRule) => ({ ...r, jurisdiction: 'XX' })],
    ['entityType', (r: FiscalRule) => ({ ...r, entityType: 'PF' })],
    ['sourceAct', (r: FiscalRule) => ({ ...r, sourceAct: 'Alt act' })],
    ['sourceArticle', (r: FiscalRule) => ({ ...r, sourceArticle: 'art. 0' })],
    ['sourceUrl', (r: FiscalRule) => ({ ...r, sourceUrl: 'https://example.com/other' })],
    ['verifiedAt', (r: FiscalRule) => ({ ...r, verifiedAt: '2027-01-01' })],
    ['version', (r: FiscalRule) => ({ ...r, version: 99 })],
    ['supersededBy', (r: FiscalRule) => ({ ...r, supersededBy: 'CAS_2027' })],
  ])('does NOT move for the descriptive field %s — a hash is not a citation and not a display number', (_field, mutate) => {
    const rule = casRule();
    expect(ruleSetDigest([mutate(rule)])).toBe(ruleSetDigest([rule]));
  });

  it('does NOT move for a parameter label or description', () => {
    const rule = casRule();
    const relabelled = ruleSetDigest([
      {
        ...rule,
        parameters: rule.parameters.map((p) => ({ ...p, label: 'Alta eticheta', description: 'altă explicație' })),
      },
    ]);
    expect(relabelled).toBe(ruleSetDigest([rule]));
  });
});

describe('ruleDigest — one rule on the same scheme', () => {
  it('moves with a parameter and not with a version number', () => {
    const rule = casRule();
    expect(ruleDigest({ ...rule, version: rule.version + 1 })).toBe(ruleDigest(rule));
    expect(
      ruleDigest({
        ...rule,
        parameters: rule.parameters.map((p) => (p.id === 'rate' ? { ...p, value: 26 } : p)),
      }),
    ).not.toBe(ruleDigest(rule));
  });

  it('is not the same string as a one-rule rule-set digest, so the two are never confused', () => {
    const rule = casRule();
    expect(ruleDigest(rule)).not.toBe(ruleSetDigest([rule]));
  });
});

describe('canonicalRuleSet — refusals', () => {
  it('refuses a rule set that lists the same ruleId twice, because the order would then decide the bytes', () => {
    const rule = casRule();
    expect(() => canonicalRuleSet([rule, { ...rule, name: 'dublura' }])).toThrow(DuplicateRuleIdError);
    expect(() => ruleSetDigest([rule, rule])).toThrow(/more than once/);
  });
});
