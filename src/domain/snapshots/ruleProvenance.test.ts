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
import {
  describeSnapshotRuleProvenance,
  engineAsOf,
  noRulePackageProvenance,
  resolveSnapshotRules,
  snapshotRuleState,
} from './ruleProvenance';
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
    // B-109: this fixture is about rule provenance and has no asset leg in hand, so it records `null` — the
    // value that says "this number's register was never addressed" — rather than an empty-register digest,
    // which would claim the register was checked and found empty.
    depreciation: null,
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

/**
 * TASK 9 — the shape the surfaces render. Pinned here because these are the invariants the UI depends
 * on and cannot enforce itself: the recorded digest is never recomputed, `drifted` is shown with both
 * digests and repaired with neither, and a record whose rules cannot be reconstructed cites nothing.
 */
describe('describeSnapshotRuleProvenance', () => {
  it('pinned: names the release, shows the recorded digest, and cites the provisions behind the money', async () => {
    const snap = await snapshotOf(ruleSetDigest(effective2026));
    const view = describeSnapshotRuleProvenance(snap);
    expect(view.state).toBe('pinned');
    expect(view.releaseId).toBe('PFA_2026_SYSTEM_REAL');
    expect(view.recordedHash).toBe(snap.ruleSetHash);
    expect(view.registeredHash).toBe(snap.ruleSetHash);
    // The three calculators whose results `Total taxe` adds up, and no others: the 39 art. 68
    // deductibility letters and the deadline rules are not what produced the lei figure.
    expect(view.citations.map((c) => c.act)).toContain(
      'Cod fiscal — OUG nr. 128/2024, Art. I pct. 20 (MO 1125/11.11.2024)',
    );
    expect(view.citations.some((c) => c.article.includes('art. 174'))).toBe(true);
    expect(view.citations.some((c) => c.article.includes('art. 118'))).toBe(true);
    expect(view.citations.length).toBeGreaterThan(0);
  });

  it('drifted: shows the recorded digest AND what the package hashes to now, and writes neither back', async () => {
    const recorded = 'b'.repeat(64);
    const snap = await snapshotOf(recorded);
    const view = describeSnapshotRuleProvenance(snap);
    expect(view.state).toBe('drifted');
    expect(view.recordedHash).toBe(recorded);
    // The mismatch, displayed. This is the evidence of an in-place edit of a published release.
    expect(view.registeredHash).toBe(ruleSetDigest(effective2026));
    expect(view.registeredHash).not.toBe(view.recordedHash);
    // Surfaced, never repaired: the record still carries the digest it was written with.
    expect(snap.ruleSetHash).toBe(recorded);
    expect(describeSnapshotRuleProvenance(snap).recordedHash).toBe(recorded);
  });

  it("drifted compares like with like: the EFFECTIVE digest, not the release's full contentHash", async () => {
    const snap = await snapshotOf('c'.repeat(64));
    const view = describeSnapshotRuleProvenance(snap);
    // phases/20 §3: `RuleRelease.contentHash` covers the full named set (48 rules), `ruleSetHash` the
    // effective applied set. Showing the full-set digest beside an effective-set digest would report a
    // mismatch that is only a difference of granularity.
    expect(view.registeredHash).not.toBe(ruleSetDigest(PFA_2026_SYSTEM_REAL_PACKAGE));
    expect(view.registeredHash).toBe(ruleSetDigest(effective2026));
  });

  it('unpinned: no digest, and no citations invented from the package this build happens to carry', async () => {
    const snap = await snapshotOf(null);
    const view = describeSnapshotRuleProvenance(snap);
    expect(view.state).toBe('unpinned');
    expect(view.recordedHash).toBeNull();
    // The honest half: the app cannot say which rules produced this figure, so it names no provisions.
    expect(view.citations).toEqual([]);
  });

  it('unregistered: names the release the record refers to, cites nothing', async () => {
    const snap = await snapshotOf(ruleSetDigest(effective2026), 'REL_2024_IESIT');
    const view = describeSnapshotRuleProvenance(snap);
    expect(view.state).toBe('unregistered');
    expect(view.releaseId).toBe('REL_2024_IESIT');
    expect(view.registeredHash).toBeNull();
    expect(view.citations).toEqual([]);
  });

  it('never mutates the record it is reading', async () => {
    const snap = await snapshotOf('d'.repeat(64));
    const before = { ...snap };
    describeSnapshotRuleProvenance(snap);
    expect(snap.ruleSetHash).toBe(before.ruleSetHash);
    expect(snap.ruleRelease.releaseId).toBe(before.ruleRelease.releaseId);
    expect(snap.inputsHash).toBe(before.inputsHash);
  });

  it('no_release is the answer a surface gives when there is no record to ask', () => {
    const view = noRulePackageProvenance();
    expect(view.state).toBe('no_release');
    expect(view.releaseId).toBeNull();
    expect(view.recordedHash).toBeNull();
    expect(view.registeredHash).toBeNull();
    expect(view.citations).toEqual([]);
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
