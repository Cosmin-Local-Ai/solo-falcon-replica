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
import { defaultRuleReleaseRegistry, type RuleReleaseRegistry } from '../fiscal/registry';
import { ruleSetDigest } from '../fiscal/ruleSetDigest';
import { selectApplicableRules } from '../fiscal/select';
import type { TaxCalculationSnapshot } from './types';

export type SnapshotRuleState = 'pinned' | 'drifted' | 'unregistered' | 'unpinned';

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

export function snapshotRuleState(
  snapshot: TaxCalculationSnapshot,
  registry: RuleReleaseRegistry = defaultRuleReleaseRegistry,
): SnapshotRuleState {
  if (snapshot.ruleSetHash === null || snapshot.ruleSetHash === undefined) return 'unpinned';
  const entry = registry.entryByReleaseId(snapshot.ruleRelease.releaseId);
  if (!entry) return 'unregistered';
  const digest = ruleSetDigest(
    selectApplicableRules([...entry.rules], {
      taxYear: snapshot.taxYear,
      asOfDate: engineAsOf(snapshot),
    }),
  );
  return digest === snapshot.ruleSetHash ? 'pinned' : 'drifted';
}
