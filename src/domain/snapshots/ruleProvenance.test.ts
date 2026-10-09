/**
 * TASK 6 — reading rule provenance back out of a stored snapshot.
 *
 * These four states are what TASK 9 renders. The point of pinning them here is that `unpinned` and
 * `unregistered` are ANSWERS, not errors to be smoothed over: a figure whose rules cannot be
 * reconstructed must be presented as such, and the code must never invent a digest to make the UI tidy.
 */
import { describe, expect, it } from 'vitest';
import type { PfaProfile } from '../models';
import { lei } from '../money';
import { createCalculationSnapshot } from './snapshot';
import { engineAsOf, resolveSnapshotRules, snapshotRuleState } from './ruleProvenance';
import { createRuleReleaseRegistry } from '../fiscal/registry';
import { ruleSetDigest } from '../fiscal/ruleSetDigest';
import { selectApplicableRules } from '../fiscal/select';
import { PFA_2026_RELEASE } from '../fiscal/release2026';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../fiscal/package2026';
import type { TaxCalculationSnapshot } from './types';

const profile = { id: 'p1', fiscalYear: 2026, regime: 'impozit_pe_venit' } as PfaProfile;

/** The effective 2026 set the engine would apply, i.e. what a snapshot of the real release records. */
const effective2026 = selectApplicableRules(PFA_2026_SYSTEM_REAL_PACKAGE, {
  taxYear: 2026,
  asOfDate: '2026-01-01',
});

async function snapshotOf(
  ruleSetHash: string | null,
  releaseId = PFA_2026_RELEASE.releaseId,
): Promise<TaxCalculationSnapshot> {
  const snap = await createCalculationSnapshot({
    profile,
    revenues: lei(1000),
    expenses: lei(400),
    ruleRelease: { ...PFA_2026_RELEASE, releaseId },
    rules: effective2026,
    calculationLines: [],
    output: { total: lei(0) },
  });
  return { ...snap, ruleSetHash };
}

describe('snapshotRuleState', () => {
  it('pins a snapshot whose recorded digest matches the registered release', async () => {
    const snap = await snapshotOf(ruleSetDigest(effective2026));
    expect(snapshotRuleState(snap)).toBe('pinned');
    const resolved = resolveSnapshotRules(snap)!;
    expect(resolved.releaseId).toBe('PFA_2026_SYSTEM_REAL');
    expect(resolved.rules.map((r) => r.ruleId)).toEqual(effective2026.map((r) => r.ruleId));
    expect(resolved.digest).toBe(snap.ruleSetHash);
  });

  it('reports unpinned — not an error, not a guess — for a snapshot the v9 step stamped with null', async () => {
    const snap = await snapshotOf(null);
    expect(snapshotRuleState(snap)).toBe('unpinned');
    expect(resolveSnapshotRules(snap)).toBeNull();
  });

  it('reports unpinned when the field is simply absent (a payload that never migrated)', async () => {
    const snap = await snapshotOf('a'.repeat(64));
    const { ruleSetHash: _omitted, ...bare } = snap;
    expect(snapshotRuleState(bare as TaxCalculationSnapshot)).toBe('unpinned');
  });

  it('reports unregistered for a release this build does not carry', async () => {
    const snap = await snapshotOf(ruleSetDigest(effective2026), 'REL_2024_IESIT');
    expect(snapshotRuleState(snap)).toBe('unregistered');
    expect(resolveSnapshotRules(snap)).toBeNull();
  });

  it('reports drifted when the registered rules no longer hash to what the record says', async () => {
    const snap = await snapshotOf('b'.repeat(64));
    expect(snapshotRuleState(snap)).toBe('drifted');
    expect(resolveSnapshotRules(snap)).toBeNull();
  });

  it('does not resolve a superseded release to the newer one', async () => {
    // A registry where the 2026 release has been superseded: an old snapshot must still resolve to the
    // rules it actually used, not to whatever is in force now.
    const registry = createRuleReleaseRegistry();
    const r1 = registry.register(PFA_2026_RELEASE, PFA_2026_SYSTEM_REAL_PACKAGE);
    const revised = PFA_2026_SYSTEM_REAL_PACKAGE.map((r) =>
      r.ruleId === 'INCOME_TAX_2026'
        ? {
            ...r,
            version: r.version + 1,
            parameters: r.parameters.map((p) => (p.id === 'base_rate' ? { ...p, value: 11 } : p)),
          }
        : r,
    );
    const r2 = registry.register(
      {
        ...PFA_2026_RELEASE,
        releaseId: 'PFA_2026_SYSTEM_REAL_B',
        lifecycle: 'SCHEDULED',
        // No contentHash declared: the rule set changed, so the old digest must not travel. The registry
        // computes the new one, and refuses the registration if a caller brings a stale one.
        contentHash: undefined,
      },
      revised,
    );
    registry.supersede('PFA_2026_SYSTEM_REAL', 'PFA_2026_SYSTEM_REAL_B', '2026-06-30');
    registry.advance('PFA_2026_SYSTEM_REAL_B', 'ACTIVE');

    const recorded = ruleSetDigest(effective2026);
    const snap = await snapshotOf(recorded);
    expect(snapshotRuleState(snap, registry)).toBe('pinned');
    const resolved = resolveSnapshotRules(snap, registry)!;
    expect(resolved.digest).toBe(recorded);
    expect(resolved.rules.map((r) => r.ruleId)).toEqual(effective2026.map((r) => r.ruleId));
    // The successor's effective set is a different digest, so "pinned" here really did mean R1.
    const newerEffective = selectApplicableRules([...registry.rulesOf('PFA_2026_SYSTEM_REAL_B')!], {
      taxYear: 2026,
      asOfDate: '2026-01-01',
    });
    expect(ruleSetDigest(newerEffective)).not.toBe(recorded);
    expect(r2.digest).not.toBe(r1.digest);
  });
});

describe('engineAsOf', () => {
  it('is 1 January of the snapshot tax year, matching the window computeTaxEstimate selects with', async () => {
    const snap = await snapshotOf(ruleSetDigest(effective2026));
    expect(engineAsOf(snap)).toBe('2026-01-01');
    // The pairing that matters: the digest recorded by the engine is the digest of the set selected at
    // this date, so provenance resolves against the same window the calculation used.
    expect(ruleSetDigest(selectApplicableRules(PFA_2026_SYSTEM_REAL_PACKAGE, { taxYear: 2026, asOfDate: engineAsOf(snap) }))).toBe(
      snap.ruleSetHash,
    );
  });
});
