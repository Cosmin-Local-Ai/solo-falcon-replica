/**
 * TASK 6 — reading the rule provenance back out of a stored snapshot.
 *
 * A digest nobody can act on is decoration. This is the function that turns `snapshot.ruleSetHash` into
 * an answer, and it is what TASK 9 (provenance) should surface: for any stored figure, either the rules
 * that produced it are still available and verified, or the app says plainly that they are not.
 *
 * Four states, and the fourth is the honest one:
 *   - `pinned`      — the release is registered, its rules are still resolvable, and their digest matches
 *                     what the snapshot recorded. The figure can be re-run and audited.
 *   - `drifted`     — the release is registered but its rules no longer hash to the recorded digest. That
 *                     is the in-place edit this phase exists to prevent, and if it ever appears it must be
 *                     reported, never papered over by re-hashing the snapshot.
 *   - `unregistered`— the snapshot names a release this build does not carry.
 *   - `unpinned`    — the snapshot carries no digest at all: it predates content addressing (the v9
 *                     migration writes `null` for exactly this). Nothing may be inferred about its rules.
 */
import type { FiscalRule } from '../fiscal/rules';
import { defaultRuleReleaseRegistry, type RuleReleaseRegistry, type RuleSetEntry } from '../fiscal/registry';
import { ruleSetDigest } from '../fiscal/ruleSetDigest';
import { selectApplicableRules } from '../fiscal/select';
import type { TaxCalculationSnapshot } from './types';

export type SnapshotRuleState = 'pinned' | 'drifted' | 'unregistered' | 'unpinned';

/**
 * TASK 9 — the four record states, plus the one case a record cannot answer.
 *
 * `no_release` is not a fifth state of a record: it is a surface that has no calculation record to ask.
 * `FiscalThreshold.ruleRelease` is `string | null` for exactly this reason — a threshold row is measured
 * against the registered package, and when there is no calculation it has no digest to be checked
 * against either. It is rendered, never smoothed into `unpinned`.
 */
export type RuleProvenanceState = SnapshotRuleState | 'no_release';

/**
 * A legal citation, kept as data so a surface can put it on screen **beside** a digest.
 * A digest is a content address; it is not, and never becomes, a provision.
 */
export interface RuleCitation {
  act: string;
  article: string;
}

export interface ResolvedSnapshotRules {
  releaseId: string;
  /** The rules the snapshot applied, re-derived from the registered release. */
  rules: FiscalRule[];
  /** Their digest — asserted equal to `snapshot.ruleSetHash` before this is returned. */
  digest: string;
}

/**
 * The as-of date `computeTaxEstimate` used. The engine pins it to 1 January of the fiscal year
 * (`tax.ts`, `const asOf = `${inputs.fiscalYear}-01-01``), so reproducing a stored calculation's effective
 * rule set has to use the same window or it is not a reproduction. If that engine line ever changes, this
 * is the other half of it — and `ruleProvenance.test.ts` pins the pairing.
 */
export function engineAsOf(snapshot: TaxCalculationSnapshot): string {
  return `${snapshot.taxYear}-01-01`;
}

export function resolveSnapshotRules(
  snapshot: TaxCalculationSnapshot,
  registry: RuleReleaseRegistry = defaultRuleReleaseRegistry,
): ResolvedSnapshotRules | null {
  if (snapshot.ruleSetHash === null || snapshot.ruleSetHash === undefined) return null;
  const entry = registry.entryByReleaseId(snapshot.ruleRelease.releaseId);
  if (!entry) return null;
  const rules = selectApplicableRules([...entry.rules], {
    taxYear: snapshot.taxYear,
    asOfDate: engineAsOf(snapshot),
  });
  const digest = ruleSetDigest(rules);
  if (digest !== snapshot.ruleSetHash) return null;
  return { releaseId: entry.release.releaseId, rules, digest };
}

/**
 * The rule set the registry would apply to this record today — the same year and the same effective-date
 * window the engine used, so a comparison is between like and like. `RuleRelease.contentHash` is the
 * digest of the FULL named set; `snapshot.ruleSetHash` is the digest of the EFFECTIVE applied set
   (phases/20 §3). Comparing those two would report a mismatch that is only a difference of granularity.
 */
function effectiveRulesOf(entry: RuleSetEntry, snapshot: TaxCalculationSnapshot): FiscalRule[] {
  return selectApplicableRules([...entry.rules], {
    taxYear: snapshot.taxYear,
    asOfDate: engineAsOf(snapshot),
  });
}

export function snapshotRuleState(
  snapshot: TaxCalculationSnapshot,
  registry: RuleReleaseRegistry = defaultRuleReleaseRegistry,
): SnapshotRuleState {
  if (snapshot.ruleSetHash === null || snapshot.ruleSetHash === undefined) return 'unpinned';
  const entry = registry.entryByReleaseId(snapshot.ruleRelease.releaseId);
  if (!entry) return 'unregistered';
  return ruleSetDigest(effectiveRulesOf(entry, snapshot)) === snapshot.ruleSetHash
    ? 'pinned'
    : 'drifted';
}

/**
 * TASK 9 — the same answer, in the shape a surface renders.
 *
 * Three rules this function exists to keep:
 *
 * 1. **It reads the digest the record carries; it never mints one.** `recordedHash` is
 *    `snapshot.ruleSetHash` verbatim. A `null` stays `null` — that is the v9 migration admitting the
 *    rules behind an old figure cannot be reconstructed, and filling it in would be the fabrication
 *    TASK 6 refused to make.
 * 2. **`drifted` is shown with both digests and repaired with neither.** `registeredHash` is what the
 *    registered package hashes to *today*, computed for display only. Nothing here writes it back to the
 *    record: re-hashing to silence the warning would destroy the only evidence that a published rule set
 *    was edited in place.
 * 3. **A digest never travels alone.** `citations` carries the acts and articles of the rules that
 *    produced the money lines — the three calculators whose results `Total taxe` adds up — so every
 *    surface that prints a digest has the provision to print beside it. For `drifted` those citations
 *    come from the *edited* package, which is why the copy says the package changed after the
 *    calculation; the app does not pretend to still know what was in force then.
 */
export interface SnapshotRuleProvenance {
  state: RuleProvenanceState;
  /** The release the record names, or `null` when the surface has no record at all. */
  releaseId: string | null;
  /** The digest the record carries. `null` = none was ever recorded. Never backfilled. */
  recordedHash: string | null;
  /** What the registered package hashes to now — display only, never written back. */
  registeredHash: string | null;
  citations: RuleCitation[];
}

/** The calculators whose results the `Total taxe` line adds up (`tax.ts`, `calculatorRegistry`). */
const MONEY_CALCULATORS: readonly string[] = ['calc-cas', 'calc-cass', 'calc-income-tax'];

function moneyCitations(rules: readonly FiscalRule[]): RuleCitation[] {
  const seen = new Map<string, RuleCitation>();
  for (const rule of rules) {
    if (!MONEY_CALCULATORS.includes(rule.calculatorId)) continue;
    const key = `${rule.sourceAct}|${rule.sourceArticle}`;
    if (!seen.has(key)) seen.set(key, { act: rule.sourceAct, article: rule.sourceArticle });
  }
  return [...seen.values()];
}

export function describeSnapshotRuleProvenance(
  snapshot: TaxCalculationSnapshot,
  registry: RuleReleaseRegistry = defaultRuleReleaseRegistry,
): SnapshotRuleProvenance {
  const state = snapshotRuleState(snapshot, registry);
  const entry = registry.entryByReleaseId(snapshot.ruleRelease.releaseId);
  const rules = entry ? effectiveRulesOf(entry, snapshot) : [];
  return {
    state,
    releaseId: snapshot.ruleRelease.releaseId,
    recordedHash: snapshot.ruleSetHash ?? null,
    registeredHash: entry ? ruleSetDigest(rules) : null,
    // Only the two states where a release is actually named can cite anything. For `unpinned` and
    // `unregistered` the app cannot say which rules produced the figure, so it cites none — naming the
    // current package's articles under a record that predates content addressing would be exactly the
    // fabricated history TASK 6 refused to write.
    citations: state === 'pinned' || state === 'drifted' ? moneyCitations(rules) : [],
  };
}

/** The view for a surface that has no calculation record to ask. */
export function noRulePackageProvenance(): SnapshotRuleProvenance {
  return { state: 'no_release', releaseId: null, recordedHash: null, registeredHash: null, citations: [] };
}
