/**
 * TASK 6 — the fixture, in the order the acceptance criteria demand.
 *
 *   R1 ACTIVE  →  R2 becomes ACTIVE later  →  an R1 snapshot still reproduces R1's numbers  →  a new
 *   calculation uses R2.
 *
 * The third step is the one that matters, so the fixture makes R2 differ in a real formula-bearing
 * parameter: the Titlul IV base rate goes from 10 % to 11 %. Everything else in the 48-rule set is
 * byte-identical. If R2 changed nothing, "the old snapshot still reproduces" would be vacuous — it would
 * pass because both releases compute the same thing.
 *
 * The numbers are hand-checkable. On the fixture profile: venit brut 50.000,00 lei − cheltuieli
 * deductibile 10.000,00 lei = VNA 40.000,00 lei; CAS 0 (sub 12 SM, CF art. 148 alin. (1)); CASS 4.000,00
 * lei (10 % × VNA, art. 170 alin. (1)); impozit 10 % × 36.000,00 = 3.600,00 lei; total 7.600,00 lei.
 * Under R2 the rate is 11 %, so impozit 3.960,00 lei and total 7.960,00 lei — 360,00 lei apart, which is
 * exactly 1 % of 36.000,00 lei.
 */
import { describe, expect, it } from 'vitest';
import type { PfaProfile } from '../models';
import type { TaxInputsReference } from '../derived';
import { computeTaxEstimate } from '../tax';
import { lei } from '../money';
import type { FiscalRule, RuleRelease } from './rules';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';
import { createRuleReleaseRegistry } from './registry';
import { ruleSetDigest } from './ruleSetDigest';
import { selectApplicableRules } from './select';

const PACKAGE_IDS = PFA_2026_SYSTEM_REAL_PACKAGE.map((r) => r.ruleId);

function makeProfile(): PfaProfile {
  return {
    id: 'p1',
    regime: 'impozit_pe_venit',
    fiscalYear: 2026,
    socialInsuranceStatus: 'obligatoriu',
  } as PfaProfile;
}

function makeInputs(): TaxInputsReference {
  return {
    regime: 'impozit_pe_venit',
    salaryStatus: 'nu',
    pensionerStatus: 'nu',
    pensionReceiptYears: [],
    pensionSuspensionYears: [],
    cassPreviousYearContext: null,
    foreignSicknessInsurance: null,
    otherIncome: [],
    socialInsuranceStatus: 'obligatoriu',
    vatExempt: false,
    cashFloorLei: lei(0),
    fiscalYear: 2026,
    salaryIncomeLei: null,
    pfaStartDate: null,
    inputsKey: 'p1:2026:impozit_pe_venit:obligatoriu',
  };
}

function release(releaseId: string, over: Partial<RuleRelease> = {}): RuleRelease {
  return {
    releaseId,
    name: `fixture release ${releaseId}`,
    jurisdiction: 'RO',
    entityType: 'PFA',
    taxYear: 2026,
    ruleIds: PACKAGE_IDS,
    status: 'SAFE_ACTIVATION',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    createdAt: '2026-10-09T09:05:44+03:00',
    evidence: ['https://legislatie.just.ro/Public/DetaliiDocument/312601'],
    lifecycle: 'ACTIVE',
    version: 1,
    ...over,
  };
}

/** R2: the same 48 rules, one formula-bearing parameter moved, and that rule's version bumped. */
function revisedRules(): FiscalRule[] {
  return PFA_2026_SYSTEM_REAL_PACKAGE.map((r) =>
    r.ruleId === 'INCOME_TAX_2026'
      ? {
          ...r,
          version: r.version + 1,
          parameters: r.parameters.map((p) => (p.id === 'base_rate' ? { ...p, value: 11 } : p)),
        }
      : r,
  );
}

/** The effective set `computeTaxEstimate` actually applies for a year — the tax engine pins as-of to
 *  1 January of the fiscal year, so reproduction has to use the same window to be a reproduction. */
function effectiveFor(rules: readonly FiscalRule[], taxYear: number): FiscalRule[] {
  return selectApplicableRules([...rules], { taxYear, asOfDate: `${taxYear}-01-01` });
}

describe('TASK 6 fixture — R1 ACTIVE, then R2, and R1 still reproduces', () => {
  const registry = createRuleReleaseRegistry();

  // ---- 1. R1 is ACTIVE, and a calculation is made under it. -------------------------------------
  const r1 = registry.register(release('R1'), PFA_2026_SYSTEM_REAL_PACKAGE);

  it('R1 produces the hand-checked 2026 figure and records the digest of the rules it applied', async () => {
    const est = await computeTaxEstimate({
      inputs: makeInputs(),
      profile: makeProfile(),
      revenues: lei(50_000),
      expenses: lei(10_000),
      revenuesNet: lei(50_000),
      expensesNet: lei(10_000),
      ruleRelease: r1.release,
      rules: [...r1.rules],
    });
    expect(est.status).toBe('computed');
    if (est.status !== 'computed') return;
    expect(est.output.total).toBe(lei(7_600));
    expect(est.snapshot.ruleSetHash).toBe(ruleSetDigest(effectiveFor(r1.rules, 2026)));
    expect(est.snapshot.ruleSetHash).toMatch(/^[0-9a-f]{64}$/);
  });

  // ---- 2. R2 becomes ACTIVE later. -------------------------------------------------------------
  const r2 = registry.register(release('R2', { effectiveFrom: '2026-07-01', lifecycle: 'SCHEDULED' }), revisedRules());
  registry.supersede('R1', 'R2', '2026-06-30');
  registry.advance('R2', 'ACTIVE');

  it('R2 is a different rule set, not a relabelled one', () => {
    expect(r2.digest).not.toBe(r1.digest);
    // Only one rule moved, and it moved in a parameter the arithmetic reads.
    const moved = PFA_2026_SYSTEM_REAL_PACKAGE.filter(
      (r, i) => JSON.stringify(r) !== JSON.stringify(revisedRules()[i]),
    ).map((r) => r.ruleId);
    expect(moved).toEqual(['INCOME_TAX_2026']);
  });

  it('the registry refuses to register R2 under R1 identity — the historical mistake is now impossible', () => {
    expect(() => registry.register(release('R1'), revisedRules())).toThrow(/already registered with content hash/);
  });

  // ---- 3. An R1 snapshot still reproduces R1's numbers. ----------------------------------------
  it('an R1 snapshot still reproduces the R1 numbers after R2 is the release in force', async () => {
    const underR1 = await computeTaxEstimate({
      inputs: makeInputs(),
      profile: makeProfile(),
      revenues: lei(50_000),
      expenses: lei(10_000),
      revenuesNet: lei(50_000),
      expensesNet: lei(10_000),
      ruleRelease: r1.release,
      rules: [...r1.rules],
    });
    expect(underR1.status).toBe('computed');
    if (underR1.status !== 'computed') return;
    const snapshot = underR1.snapshot;
    expect(snapshot.output.total).toBe(lei(7_600));

    // R1 is SUPERSEDED. It must still be resolvable, or the snapshot is unreadable.
    const historical = registry.entryByReleaseId('R1');
    expect(historical).toBeDefined();
    expect(historical!.release.lifecycle).toBe('SUPERSEDED');
    expect(historical!.release.supersededBy).toBe('R2');

    // The rules come back byte-identical, and their digest still matches what the snapshot recorded.
    const replayRules = effectiveFor(historical!.rules, 2026);
    expect(ruleSetDigest(replayRules)).toBe(snapshot.ruleSetHash);

    // Re-running them reproduces the figure and every line — not merely a total that happens to agree.
    const replay = await computeTaxEstimate({
      inputs: makeInputs(),
      profile: makeProfile(),
      revenues: lei(50_000),
      expenses: lei(10_000),
      revenuesNet: lei(50_000),
      expensesNet: lei(10_000),
      ruleRelease: historical!.release,
      rules: replayRules,
    });
    expect(replay.status).toBe('computed');
    if (replay.status !== 'computed') return;
    expect(replay.output.total).toBe(snapshot.output.total);
    expect(replay.lines).toEqual(snapshot.calculationLines);
    expect(replay.snapshot.ruleSetHash).toBe(snapshot.ruleSetHash);
  });

  // ---- 4. A new calculation uses R2. -----------------------------------------------------------
  it('a calculation made under the release now in force uses R2, and the difference is real', async () => {
    const inForce = registry.activeEntry(2026, '2026-12-31');
    expect(inForce!.release.releaseId).toBe('R2');
    const est = await computeTaxEstimate({
      inputs: makeInputs(),
      profile: makeProfile(),
      revenues: lei(50_000),
      expenses: lei(10_000),
      revenuesNet: lei(50_000),
      expensesNet: lei(10_000),
      ruleRelease: inForce!.release,
      rules: [...inForce!.rules],
    });
    expect(est.status).toBe('computed');
    if (est.status !== 'computed') return;
    // 11 % of 36.000,00 lei instead of 10 % — 360,00 lei more, and the snapshot says which rules did it.
    expect(est.output.total).toBe(lei(7_960));
    expect(est.snapshot.ruleSetHash).not.toBe(r1.digest);
    expect(est.snapshot.ruleSetHash).toBe(ruleSetDigest(effectiveFor(r2.rules, 2026)));
  });

  it('the same inputs under the two releases give the same inputsHash and different rule digests', async () => {
    const common = {
      inputs: makeInputs(),
      profile: makeProfile(),
      revenues: lei(50_000),
      expenses: lei(10_000),
      revenuesNet: lei(50_000),
      expensesNet: lei(10_000),
    };
    const a = await computeTaxEstimate({ ...common, ruleRelease: r1.release, rules: [...r1.rules] });
    const b = await computeTaxEstimate({ ...common, ruleRelease: r2.release, rules: [...r2.rules] });
    if (a.status !== 'computed' || b.status !== 'computed') throw new Error('fixture must compute');
    expect(b.snapshot.inputsHash).toBe(a.snapshot.inputsHash);
    expect(b.snapshot.ruleSetHash).not.toBe(a.snapshot.ruleSetHash);
    expect(b.output.total).not.toBe(a.output.total);
  });

  it('a date inside the R1 window still resolves to R1, not to the newer law', () => {
    expect(registry.activeEntry(2026, '2026-03-01')!.release.releaseId).toBe('R1');
    expect(registry.activeEntry(2026, '2026-09-01')!.release.releaseId).toBe('R2');
  });
});
