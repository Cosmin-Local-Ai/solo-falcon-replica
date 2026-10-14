/**
 * B-112 STAGE 0 — rule-release governance for the FY2026 DPI revision.
 *
 * Two things are being proved here, and the second matters more than the first.
 *
 * 1. A new FY2026 release exists at `version: 6`, supersedes `PFA_2026_SYSTEM_REAL` v5, and the registry
 *    accepted it — which it can only do if v5 was **not** edited in place.
 * 2. **A snapshot pinned to v5 still selects v5's rules and reproduces v5's number.** That is the whole
 *    point of release immutability, and it is the property a supersession is most likely to break: the
 *    temptation is to treat "superseded" as "replaced", re-point the old id at the new rules, and keep
 *    every figure-looking test green while destroying the audit trail. So this file does not assert that
 *    v5 is still readable — it re-runs the engine against the rules the registry hands back for v5 and
 *    asserts the money comes out identical, line for line.
 *
 * The dating is asserted rather than described, because `selectRuleSet(taxYear, asOfDate)` resolves
 * through `activeEntry` and two FY2026 releases active on the same date would make selection
 * non-deterministic. Every month-end of 2026 is walked, and the assertion is that exactly one release is
 * in force and that it is the revision — never v5, and never both.
 *
 * **What is deliberately NOT asserted:** any DPI figure. The DPI rules land in the following stages; at
 * this one the revision carries v5's 54 rules unchanged, so no computed amount may move. That is itself
 * pinned below — the same inputs through v5's rules and through the selected revision give the same
 * total, which is the proof that minting the release moved nothing.
 */
import { describe, expect, it } from 'vitest';
import {
  RuleReleaseImmutableError,
  activeRuleRelease,
  defaultRuleReleaseRegistry,
  selectRuleSet,
} from './registry';
import { ruleSetDigest } from './ruleSetDigest';
import { selectApplicableRules } from './select';
import { PFA_2026_RELEASE } from './release2026';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';
import { PFA_2026_DPI_RELEASE, PFA_2026_DPI_RELEASE_ID } from './release2026dpi';
import { computeTaxEstimate } from '../tax';
import { resolveSnapshotRules, snapshotRuleState } from '../snapshots/ruleProvenance';
import type { TaxCalculationSnapshot } from '../snapshots/types';
import type { PfaProfile } from '../models';
import type { TaxInputsReference } from '../derived';
import type { RuleRelease, FiscalRule } from './rules';
import { lei, type Bani } from '../money';

const V5 = 'PFA_2026_SYSTEM_REAL';

/**
 * The v5 rule set as the engine would actually apply it, i.e. after the year and the effective-date window
 * have filtered it. `snapshot.ruleSetHash` is the digest of this EFFECTIVE set, not of the whole package —
 * `snapshots/ruleProvenance.ts` says so explicitly and `phases/20` §3 names the granularity — and the
 * 2026-07-01 minimum-wage rule is filtered out at the engine's 1 January as-of. Comparing a package digest
 * against a snapshot digest would report a mismatch that is only a difference of granularity.
 */
const effectiveV5 = selectApplicableRules(PFA_2026_SYSTEM_REAL_PACKAGE, {
  taxYear: 2026,
  asOfDate: '2026-01-01',
});

/** Every date the app might ask the selector about inside FY2026, plus both window boundaries. */
const FY2026_DATES = [
  '2026-01-01',
  '2026-01-31',
  '2026-02-28',
  '2026-03-31',
  '2026-04-30',
  '2026-05-31',
  '2026-06-15',
  '2026-06-30',
  '2026-07-31',
  '2026-08-31',
  '2026-09-30',
  '2026-10-31',
  '2026-11-30',
  '2026-12-31',
];

// ── A minimal, explicit engine driver ────────────────────────────────────────────────────────────────
// The release and the rule set are handed in by the test, on purpose: the audit-trail case has to run the
// engine against the rules the registry still holds for a SUPERSEDED release, and a driver that always
// went through `selectRuleSet` could not express that question.
function fixtureProfile(): PfaProfile {
  return {
    id: 'p-audit',
    regime: 'impozit_pe_venit',
    fiscalYear: 2026,
    pfaStartYear: 2026,
    salaryStatus: 'nu',
    cashFloorLei: lei(0),
    identity: {
      nume: 'Audit', cnp: '', adresa: 'Str. Audit 1', telefon: '0700000000', email: 'audit@example.invalid',
      denumire: 'PFA Audit', cui: '0000000000', formaJuridica: 'PFA', numarRegComert: 'J00/0000/0000',
      adresaSocietate: 'Str. Audit 1', telefonSocietate: '', emailSocietate: '', contBancar: '', banca: '',
    },
    updatedAt: '2026-01-01T00:00:00Z',
    socialInsuranceStatus: 'obligatoriu',
    vatRegistration: { status: 'scutit_art310' },
  };
}

function fixtureInputs(): TaxInputsReference {
  return {
    regime: 'impozit_pe_venit',
    salaryStatus: 'nu',
    salaryIncomeLei: null,
    pensionerStatus: 'nu',
    pensionReceiptYears: [],
    pensionSuspensionYears: [],
    cassPreviousYearContext: null,
    foreignSicknessInsurance: null,
    cassLadderYears: [],
    socialInsuranceStatus: 'obligatoriu',
    vatRegistration: { status: 'scutit_art310' },
    cashFloorLei: lei(0),
    fiscalYear: 2026,
    pfaStartDate: null,
    inputsKey: 'p-audit:2026',
  };
}

interface RunResult {
  total: Bani;
  lines: { label: string; value: Bani }[];
  snapshot: TaxCalculationSnapshot;
}

async function runEngine(release: RuleRelease, rules: readonly FiscalRule[]): Promise<RunResult> {
  const gross = lei(100_000);
  const expenses = lei(32_000);
  const res = await computeTaxEstimate({
    inputs: fixtureInputs(),
    profile: fixtureProfile(),
    revenues: gross,
    expenses,
    revenuesNet: gross,
    expensesNet: expenses,
    expenseBase: { netFirst: expenses, grossFirst: expenses, divergent: false },
    flatRatioGross: null,
    flatRatioMethod: null,
    ruleRelease: release,
    rules: [...rules],
  });
  if (res.status !== 'computed') throw new Error(`the engine refused instead of computing: ${res.reason}`);
  return { total: res.output.total, lines: res.lines.map((l) => ({ label: l.label, value: l.value })), snapshot: res.snapshot };
}

// ── 1. The revision is registered, and v5 was not edited in place ─────────────────────────────────────
describe('B-112 stage 0 — the FY2026 DPI revision is registered without editing v5 in place', () => {
  it('the default registry carries both FY2026 releases, and seeding it did not throw', () => {
    const entries = defaultRuleReleaseRegistry.entries(2026);
    expect(entries.map((e) => e.release.releaseId).sort()).toEqual([V5, PFA_2026_DPI_RELEASE_ID].sort());
  });

  it('the revision is version 6, ACTIVE, and open-ended from 1 January 2026', () => {
    const entry = defaultRuleReleaseRegistry.entryByReleaseId(PFA_2026_DPI_RELEASE_ID)!;
    expect(entry.release.version).toBe(6);
    expect(entry.release.lifecycle).toBe('ACTIVE');
    expect(entry.release.effectiveFrom).toBe('2026-01-01');
    expect(entry.release.effectiveTo).toBeNull();
    expect(entry.release.taxYear).toBe(2026);
    // The id says what the revision adds; a reader in 2027 should not have to open the file.
    expect(PFA_2026_DPI_RELEASE_ID).toContain('DPI');
    expect(entry.release.name).toContain('DPI');
  });

  it('v5 keeps its releaseId, its version, its digest and its rules — the in-place edit is what did NOT happen', () => {
    const v5 = defaultRuleReleaseRegistry.entryByReleaseId(V5)!;
    expect(v5.release.version).toBe(5);
    expect(v5.release.lifecycle).toBe('SUPERSEDED');
    expect(v5.release.supersededBy).toBe(PFA_2026_DPI_RELEASE_ID);
    expect(v5.digest).toBe(ruleSetDigest(PFA_2026_SYSTEM_REAL_PACKAGE));
    expect(v5.rules).toHaveLength(PFA_2026_SYSTEM_REAL_PACKAGE.length);
    expect(ruleSetDigest(v5.rules)).toBe(v5.digest);
    // Re-registering v5 with its own rule set is a no-op, which is only true if the stored content is
    // byte-for-byte what the module exports.
    const again = defaultRuleReleaseRegistry.register(PFA_2026_RELEASE, PFA_2026_SYSTEM_REAL_PACKAGE);
    expect(again.digest).toBe(v5.digest);
    expect(defaultRuleReleaseRegistry.entries(2026)).toHaveLength(2);
  });

  it('the immutability gate is still live: v5 offered with one extra rule throws instead of being edited', () => {
    const extra: FiscalRule = {
      ...PFA_2026_SYSTEM_REAL_PACKAGE[0]!,
      ruleId: 'B112_STAGE0_PROBE',
      parameters: [{ id: 'reference', label: 'Probe', value: lei(1), unit: 'lei' }],
      calculatorId: 'calc-wage-reference',
      version: 1,
    };
    expect(() =>
      defaultRuleReleaseRegistry.register(PFA_2026_RELEASE, [...PFA_2026_SYSTEM_REAL_PACKAGE, extra]),
    ).toThrow(RuleReleaseImmutableError);
    // And the refusal left v5 exactly as it was.
    expect(defaultRuleReleaseRegistry.entryByReleaseId(V5)!.digest).toBe(
      ruleSetDigest(PFA_2026_SYSTEM_REAL_PACKAGE),
    );
  });

  it('supersede moved lifecycle and window only — the rules and the digest did not move', () => {
    const v5 = defaultRuleReleaseRegistry.entryByReleaseId(V5)!;
    expect(v5.release.effectiveFrom).toBe('2026-01-01');
    expect(v5.release.effectiveTo).toBe('2025-12-31');
    // The rules inside the historical set keep their own status: superseding a release does not void it.
    expect(v5.rules.every((r) => r.status === 'ACTIVE')).toBe(true);
    expect(v5.digest).toBe(ruleSetDigest(PFA_2026_SYSTEM_REAL_PACKAGE));
  });
});

// ── 2. Selection is deterministic: exactly one FY2026 release per asOfDate ────────────────────────────
describe('B-112 stage 0 — exactly one FY2026 release is in force for any asOfDate', () => {
  it('only one FY2026 release sits at ACTIVE, and it is the revision', () => {
    const active = defaultRuleReleaseRegistry.entries(2026).filter((e) => e.release.lifecycle === 'ACTIVE');
    expect(active).toHaveLength(1);
    expect(active[0]!.release.releaseId).toBe(PFA_2026_DPI_RELEASE_ID);
  });

  it('the two windows do not overlap, so no date can resolve two FY2026 releases', () => {
    const v5 = defaultRuleReleaseRegistry.entryByReleaseId(V5)!.release;
    const v6 = defaultRuleReleaseRegistry.entryByReleaseId(PFA_2026_DPI_RELEASE_ID)!.release;
    // v5's window ends the day before v6's opens.
    expect(v5.effectiveTo).toBe('2025-12-31');
    expect(v6.effectiveFrom).toBe('2026-01-01');
    expect(v5.effectiveTo! < v6.effectiveFrom).toBe(true);
  });

  it('every FY2026 date resolves the revision, and never v5', () => {
    for (const date of FY2026_DATES) {
      const entry = defaultRuleReleaseRegistry.activeEntry(2026, date);
      expect(entry, `activeEntry(2026, ${date})`).toBeDefined();
      expect(entry!.release.releaseId, `activeEntry(2026, ${date})`).toBe(PFA_2026_DPI_RELEASE_ID);
      expect(selectRuleSet(2026, date)?.release.releaseId, `selectRuleSet(2026, ${date})`).toBe(
        PFA_2026_DPI_RELEASE_ID,
      );
      expect(activeRuleRelease(2026, date)?.releaseId, `activeRuleRelease(2026, ${date})`).toBe(
        PFA_2026_DPI_RELEASE_ID,
      );
    }
  });

  it('the engine as-of date — 1 January of the fiscal year — selects the revision, so the new rules are reachable', () => {
    // `tax.ts` pins `asOf = `${fiscalYear}-01-01``, and `snapshots/ruleProvenance.ts` `engineAsOf`
    // reproduces it. A revision that opened later than this date would be selected by no calculation at
    // all, which is why the boundary is 1 January and not the revision's own createdAt.
    expect(selectRuleSet(2026, '2026-01-01')?.release.releaseId).toBe(PFA_2026_DPI_RELEASE_ID);
  });

  it('a date outside both windows still yields nothing, and no neighbouring year is reached for', () => {
    expect(selectRuleSet(2026, '2025-12-31')).toBeUndefined();
    expect(selectRuleSet(2025, '2025-06-15')).toBeUndefined();
    expect(selectRuleSet(2027, '2027-06-15')).toBeUndefined();
  });
});

// ── 3. The audit trail: a v5-pinned snapshot still resolves v5 and reproduces its number ──────────────
describe('B-112 stage 0 — a snapshot pinned to v5 still selects v5 and reproduces its number', () => {
  it('the snapshot resolves to v5, is `pinned`, and its rules are v5 rules — not the revision’s', async () => {
    const v5Entry = defaultRuleReleaseRegistry.entryByReleaseId(V5)!;
    const run = await runEngine(v5Entry.release, v5Entry.rules);
    const snap = run.snapshot;

    expect(snap.ruleRelease.releaseId).toBe(V5);
    expect(snapshotRuleState(snap)).toBe('pinned');
    const resolved = resolveSnapshotRules(snap)!;
    expect(resolved).not.toBeNull();
    expect(resolved.releaseId).toBe(V5);
    expect(resolved.digest).toBe(snap.ruleSetHash);
    // The rules that come back are the ones the registry still holds for v5, and they are the v5 package.
    expect(ruleSetDigest(resolved.rules)).toBe(ruleSetDigest(effectiveV5));
    expect(defaultRuleReleaseRegistry.rulesOf(V5)!.map((r) => r.ruleId)).toEqual(
      PFA_2026_SYSTEM_REAL_PACKAGE.map((r) => r.ruleId),
    );
  });

  it('re-running the engine on the rules the registry hands back for v5 reproduces the money, line for line', async () => {
    const v5Entry = defaultRuleReleaseRegistry.entryByReleaseId(V5)!;
    const original = await runEngine(v5Entry.release, v5Entry.rules);
    // Re-read the registry rather than reusing the object: the point is that supersession left the rules
    // themselves addressable and unchanged.
    const reread = defaultRuleReleaseRegistry.rulesOf(V5)!;
    const rerelease = defaultRuleReleaseRegistry.entryByReleaseId(V5)!.release;
    const replay = await runEngine(rerelease, reread);

    expect(replay.total).toBe(original.total);
    expect(replay.total).toBeGreaterThan(0);
    expect(replay.lines).toEqual(original.lines);
    expect(
      ruleSetDigest(selectApplicableRules([...reread], { taxYear: 2026, asOfDate: '2026-01-01' })),
    ).toBe(original.snapshot.ruleSetHash);
    expect(snapshotRuleState(original.snapshot)).toBe('pinned');
  });

  it('the same inputs through the selected revision give the same total — minting the release moved no figure', async () => {
    const v5Entry = defaultRuleReleaseRegistry.entryByReleaseId(V5)!;
    const v6Entry = defaultRuleReleaseRegistry.entryByReleaseId(PFA_2026_DPI_RELEASE_ID)!;
    const throughV5 = await runEngine(v5Entry.release, v5Entry.rules);
    const throughV6 = await runEngine(v6Entry.release, v6Entry.rules);
    // At this stage the revision carries v5's 54 rules unchanged, so equality here is the proof that the
    // supersession is governance only. It is expected to STOP holding once the DPI rules land, and that is
    // the point of the DPI fixtures, not a regression of this one.
    expect(throughV6.total).toBe(throughV5.total);
    expect(throughV6.lines).toEqual(throughV5.lines);
  });
});

// ── 4. The staged state, stated as a fact rather than left to be discovered ───────────────────────────
describe('B-112 stage 0 — the revision is content-identical to v5 until the DPI rules land', () => {
  it('both FY2026 releases share one content hash, and entryByContentHash resolves the first registered', () => {
    const v5 = defaultRuleReleaseRegistry.entryByReleaseId(V5)!;
    const v6 = defaultRuleReleaseRegistry.entryByReleaseId(PFA_2026_DPI_RELEASE_ID)!;
    // This is a staged state, not a defect: the DPI rules are added on top of this release in the following
    // stages, and until they are, the two rule sets hash alike. Pinned here so that when the digests
    // separate, the separation is a change someone chose rather than one someone noticed.
    expect(v6.digest).toBe(v5.digest);
    expect(PFA_2026_DPI_RELEASE.contentHash).toBe(v5.digest);
    // The consequence of the shared digest, asserted rather than assumed: a content-address lookup finds
    // the release registered first. Release-id lookup is what distinguishes them, and that is what
    // snapshots use (`resolveSnapshotRules` reads `entryByReleaseId`).
    expect(defaultRuleReleaseRegistry.entryByContentHash(v5.digest)!.release.releaseId).toBe(V5);
  });

  it('the revision names its whole rule set, not a DPI-only fragment', () => {
    const v6 = defaultRuleReleaseRegistry.entryByReleaseId(PFA_2026_DPI_RELEASE_ID)!;
    expect(v6.release.ruleIds).toEqual(v6.rules.map((r) => r.ruleId));
    expect(v6.rules.length).toBe(PFA_2026_SYSTEM_REAL_PACKAGE.length);
  });
});
