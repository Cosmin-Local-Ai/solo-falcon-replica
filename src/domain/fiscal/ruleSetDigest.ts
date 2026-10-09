/**
 * TASK 6 — content-addressing a rule set.
 *
 * The defect this exists to close: `RuleRelease` identified a rule set by a NAME and a DATE
 * (`releaseId: 'PFA_2026_SYSTEM_REAL'`, `createdAt: '2026-01-01'`), and neither value moved across the
 * Phase 3 (CAS), Phase 4 (CASS) and Phase 5 (income tax) formula corrections. The arithmetic the app
 * runs changed three times; the identity meant to pin it never did. A stored snapshot therefore could
 * not say which law produced its numbers.
 *
 * What this module computes is a digest over the **effective content** of a rule set: the parameter
 * values and every rule field the engine reads as a gate or a selector. It is deliberately NOT a digest
 * over the whole rule object.
 *
 * Included, and why:
 *   - `parameters` — every parameter, as `{id, value, unit}`. `id` is the lookup key every reader in
 *     `calculators.ts` / `deductibility.ts` matches by string, `value` is the number or token the
 *     formula consumes, and `unit` is load-bearing, not decoration: `paramBani` refuses any unit other
 *     than `'lei'` and refuses a non-integer, which is the guard that keeps a euro cap out of a bani
 *     calculation. Covering every parameter — including the text parameters the engine surfaces to the
 *     user (`condition`, `missing_fact`, `note`) — is the safe side of an unavoidable judgement: a
 *     digest that over-pins turns a prose change into a new release, which is what a release model is
 *     for, while a digest that under-pins lets a changed rule set masquerade as one already recorded.
 *   - `ruleId`, `taxRegime`, `calculatorId` — selectors. `tax.ts` resolves the CAS/CASS/income-tax rule
 *     by `taxRegime`, and `calculatorRegistry[rule.calculatorId]` picks the formula itself.
 *   - `taxYear`, `effectiveFrom`, `effectiveTo`, `status` — gates. `selectApplicableRules` filters on
 *     all four, so changing any of them changes which arithmetic runs.
 *
 * Excluded, and why:
 *   - `name`, `jurisdiction`, `entityType` — labels. Nothing branches on them.
 *   - `sourceAct`, `sourceArticle`, `sourceUrl`, `verifiedAt` — citations and provenance. **A hash is
 *     not a legal citation.** It pins which parameters were used; the article stays where it is, and a
 *     citation-only correction must not silently become a new arithmetic release.
 *   - `version`, `supersededBy` — lifecycle bookkeeping. `version` is a CONSEQUENCE of a content change
 *     (see `registry.ts`, which refuses a version bump without a digest change and a digest change
 *     without a version bump), so hashing it would make the digest move for a reason that is not a
 *     change in content.
 *
 * Canonicalisation is the whole point. A hash over `JSON.stringify` of an object graph is only stable if
 * key order is stable, and it is not: it is the order the object happened to be built in. So the rule
 * set is projected, the rules are ordered by `ruleId` and the parameters by `id`, and the result is
 * handed to the same `canonicalize` that already pins `inputsHash` (`../snapshots/serialize`), which
 * sorts object keys lexicographically. Rule and parameter ordering uses plain `<` on strings, NOT
 * `localeCompare`: locale comparison is environment-dependent, and an environment-dependent digest is
 * not a content address.
 */
import type { FiscalRule } from './rules';
import { canonicalize } from '../snapshots/serialize';
import { sha256Hex } from '../snapshots/hashSync';

/**
 * The digest scheme tag, mixed into the hashed bytes. If the projection ever changes — a field added to
 * or dropped from the formula-bearing subset — the tag changes with it, so two digests can never be
 * compared as if they came from the same scheme.
 */
export const RULE_SET_SCHEME = 'pfa-rules-v1';

/** One parameter as the digest sees it: the key, the value, the unit. Nothing else. */
export type DigestParameter = {
  id: string;
  value: number | string;
  unit: string;
};

/** One rule as the digest sees it: the selectors, the gates, and the parameters. */
export type DigestRule = {
  ruleId: string;
  taxRegime: string;
  taxYear: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  calculatorId: string;
  parameters: DigestParameter[];
};

/** Project one rule onto its formula-bearing subset. */
export function digestRule(rule: FiscalRule): DigestRule {
  return {
    ruleId: rule.ruleId,
    taxRegime: rule.taxRegime,
    taxYear: rule.taxYear,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    status: rule.status,
    calculatorId: rule.calculatorId,
    parameters: rule.parameters
      .map((p): DigestParameter => ({ id: p.id, value: p.value, unit: p.unit }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  };
}

/**
 * A rule set is a SET: two rules carrying the same `ruleId` make the digest ambiguous, because the
 * order of the two would then decide the bytes. Refuse rather than hash something order-dependent.
 */
export class DuplicateRuleIdError extends Error {
  constructor(readonly ruleId: string) {
    super(`Rule set carries the ruleId '${ruleId}' more than once; a rule set must be a set.`);
    this.name = 'DuplicateRuleIdError';
  }
}

/** The canonical string a digest is taken of. Exported so a test can assert the bytes, not just the hash. */
export function canonicalRuleSet(rules: readonly FiscalRule[]): string {
  const seen = new Set<string>();
  for (const rule of rules) {
    if (seen.has(rule.ruleId)) throw new DuplicateRuleIdError(rule.ruleId);
    seen.add(rule.ruleId);
  }
  const projected = rules
    .map(digestRule)
    .sort((a, b) => (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0));
  return `${RULE_SET_SCHEME}|${canonicalize(projected)}`;
}

/** SHA-256 hex of the canonical rule set. Deterministic, and independent of construction path. */
export function ruleSetDigest(rules: readonly FiscalRule[]): string {
  return sha256Hex(canonicalRuleSet(rules));
}

/**
 * The digest of ONE rule, on the same scheme. The registry uses it to decide whether a rule that
 * reappears in a later release is the same content (version must stay) or different content (version
 * must move) — see `registry.ts`.
 */
export function ruleDigest(rule: FiscalRule): string {
  return sha256Hex(`${RULE_SET_SCHEME}|${canonicalize(digestRule(rule))}`);
}
