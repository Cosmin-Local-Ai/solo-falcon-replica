import { describe, it, expect } from 'vitest';
import type { PfaProfile } from './models';
import type { TaxInputsReference } from './derived';
import { computeTaxEstimate } from './tax';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import { PFA_2026_RELEASE } from './fiscal/release2026';

// B-14: the fixtures used to default to `impozit_pe_cit`, which is the regime a PFA can NEVER have in
// 2026 (CF art. 13 alin. (1), art. 14, art. 15 — Titlul II is for persoane juridice only; the art. 120
// option is Abrogat from 01.01.2025). The engine rejected that regime, so 38 of the 39 cases were
// exercising a path no user can reach while the real default (`impozit_pe_venit`, profile.ts:38) was
// untested. The defaults are now the only lawful PFA regime; the CIT case is tested explicitly below.
function makeProfile(overrides: Partial<PfaProfile> = {}): PfaProfile {
  return { id: 'p1', regime: 'impozit_pe_venit', fiscalYear: 2026, socialInsuranceStatus: 'obligatoriu', ...overrides } as PfaProfile;
}

function makeInputs(overrides: Partial<TaxInputsReference> = {}): TaxInputsReference {
  return { regime: 'impozit_pe_venit', salaryStatus: 'da', pensionStatus: 'nu', otherIncome: [], socialInsuranceStatus: 'obligatoriu', vatExempt: false, cashFloorLei: 0, fiscalYear: 2026, inputsKey: 'p1:2026:impozit_pe_venit:obligatoriu', ...overrides };
}

describe('computeTaxEstimate', () => {
  it('computes CAS + CASS + income tax for a basic profile', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 50_000, expenses: 10_000, revenuesNet: 50_000, expensesNet: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net=40000, CAS=0 (below 12 SM — CF art. 148 alin. (1)), CASS=4000, taxable=36000, income=3600, total=7600
    expect(res.output.total).toBe(7_600);
    expect(res.lines.length).toBeGreaterThanOrEqual(5);
    expect(res.snapshot).toBeDefined();
  });

  it('skips CASS for non-obligatoriu status', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ socialInsuranceStatus: 'exempt' }), profile: makeProfile({ socialInsuranceStatus: 'exempt' }), revenues: 50_000, expenses: 10_000, revenuesNet: 50_000, expensesNet: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CAS=0 (below 12 SM), CASS skipped, taxable=40000, income=4000
    expect(res.output.total).toBe(4_000);
  });

  it('net = 0 → CASS 0, NOT review_required (CF art. 174 alin. (2): zero net income owes no CASS)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 10_000, expenses: 10_000, revenuesNet: 10_000, expensesNet: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // Re-pointed from the old "review_required" expectation, which encoded defect B-3: the
    // 6-SM floor of art. 174 alin. (6) is NOT self-executing when net is zero.
    const cass = res.lines.find(l => l.label === 'CASS (10%)')?.value;
    expect(cass).toBe(0);
    // CAS 0 (below 12 SM), CASS 0, taxable 0 → no tax at all.
    expect(res.output.total).toBe(0);
  });

  it('computes the default PFA regime impozit_pe_venit — the gate must never reject the default path (B-14)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 50_000, expenses: 10_000, revenuesNet: 50_000, expensesNet: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
  });

  it('impozit_pe_cit on a PFA is a DATA-INTEGRITY failure, not "a different base applies" (B-14)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ regime: 'impozit_pe_cit' }), profile: makeProfile({ regime: 'impozit_pe_cit' }), revenues: 50_000, expenses: 10_000, revenuesNet: 50_000, expensesNet: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
    if (res.status !== 'review_required') return;
    // The reason has to name the provisions that make the regime impossible, and quote the bad value,
    // so the user can see WHICH record is wrong instead of being told a ceiling is missing.
    expect(res.reason).toContain('impozit_pe_cit');
    expect(res.reason).toContain('art. 13 alin. (1)');
    expect(res.reason).toContain('art. 14');
    expect(res.reason).toContain('art. 15');
    expect(res.reason).toContain('art. 120');
    expect(res.reason).toContain('abrogată');
  });

  it('returns REVIEW_REQUIRED for negative revenues', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: -1, expenses: 10_000, revenuesNet: -1, expensesNet: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  it('returns REVIEW_REQUIRED for negative expenses', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 50_000, expenses: -1, revenuesNet: 50_000, expensesNet: -1, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  it('returns REVIEW_REQUIRED when profile id is missing', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile({ id: '' }), revenues: 50_000, expenses: 10_000, revenuesNet: 50_000, expensesNet: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  it('returns REVIEW_REQUIRED when rules package is empty', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 50_000, expenses: 10_000, revenuesNet: 50_000, expensesNet: 10_000, ruleRelease: PFA_2026_RELEASE, rules: [] });
    expect(res.status).toBe('review_required');
  });

  it('creates a snapshot with provenance', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 50_000, expenses: 10_000, revenuesNet: 50_000, expensesNet: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    const snap = res.snapshot;
    expect(snap.inputSnapshot.profile.id).toBe('p1');
    expect(snap.ruleRelease.releaseId).toBe('PFA_2026_SYSTEM_REAL');
    expect(snap.inputsHash).toBeTruthy();
    expect(snap.inputsHash).toHaveLength(64);
    expect(snap.inputSnapshot.revenues).toBe(50_000);
    expect(snap.inputSnapshot.expenses).toBe(10_000);
    expect(snap.output.total).toBe(7_600);
  });

  it('zero revenues → computed with CASS 0 (CF art. 174 alin. (2)), not review_required', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 0, expenses: 0, revenuesNet: 0, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.lines.find(l => l.label === 'CASS (10%)')?.value).toBe(0);
    expect(res.output.total).toBe(0);
  });

  it('applies 10% flat income tax at 50,000 net', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 60_000, expenses: 10_000, revenuesNet: 60_000, expensesNet: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net=50000, CAS=12150 (12 SM floor, not 25% of net), CASS=5000, taxable=32850, income=3285, total=20435
    expect(res.output.total).toBe(20_435);
  });

  it('keeps CAS on the 24 SM floor for high income (no cap, CF art. 148 alin. (2) lit. b))', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 250_000, expenses: 0, revenuesNet: 250_000, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net=250000, CAS=24300 (24 SM floor), CASS=25000, taxable=200700, income=20070, total=69370
    expect(res.output.total).toBe(69_370);
  });

  it('applies 10% flat income tax above 200,000 (no progressive bracket)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 300_000, expenses: 0, revenuesNet: 300_000, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net=300000, CAS=24300 (24 SM floor), CASS=29160 (capped at 291600 — CASS does have a cap), taxable=246540, income=24654, total=78114
    expect(res.output.total).toBe(78_114);
  });

  it('is deterministic for identical inputs', async () => {
    const a = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 123_456, expenses: 78_900, revenuesNet: 123_456, expensesNet: 78_900, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    const b = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 123_456, expenses: 78_900, revenuesNet: 123_456, expensesNet: 78_900, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(a.status).toBe('computed');
    expect(b.status).toBe('computed');
    if (a.status !== 'computed' || b.status !== 'computed') return;
    expect(a.output.total).toBe(b.output.total);
    expect(a.lines).toEqual(b.lines);
  });

  it('computes at 71,280 net (CAS on the 12 SM floor)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 71_280, expenses: 0, revenuesNet: 71_280, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net=71280, CAS=12150 (12 SM floor), CASS=7128, taxable=52002, income=5200.2, total=24478.2
    expect(res.output.total).toBeCloseTo(24_478.2, 1);
  });

  it('computes for a high-revenue profile', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 100_000, expenses: 10_000, revenuesNet: 100_000, expensesNet: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res).toBeDefined();
  });

  it('zero revenues → computed with CASS 0 (CF art. 174 alin. (2))', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 0, expenses: 0, revenuesNet: 0, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    // Re-pointed from review_required: that expectation was defect B-3 wearing a test's
    // clothes. A zero net income year owes no CASS at all (art. 174 alin. (2)); the 6-SM
    // top-up of art. 174 alin. (6) is not self-executing there.
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.lines.find(l => l.label === 'CASS (10%)')?.value).toBe(0);
    expect(res.output.total).toBe(0);
  });

  it('expenses exceed revenues → computed with CASS 0 (net is not positive, art. 174 alin. (2))', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 10_000, expenses: 20_000, revenuesNet: 10_000, expensesNet: 20_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    // Re-pointed with the same reasoning: no positive net, so no CASS base and no CASS.
    // (The old deductible clamp in tax.ts is gone — Phase 5/B-16 lets net go negative so the fiscal
    // loss is representable; the loss itself is surfaced, not stored. Persistence is Phase 7.)
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.lines.find(l => l.label === 'CASS (10%)')?.value).toBe(0);
    expect(res.output.total).toBe(0);
  });

  it('computes at 72,000 net (CAS on the 12 SM floor)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 72_000, expenses: 0, revenuesNet: 72_000, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net=72000, CAS=12150 (12 SM floor), CASS=7200, taxable=52650, income=5265, total=24615
    expect(res.output.total).toBe(24_615);
  });

  // ── Boundary: CASS minimum base ──

  it('net exactly at CASS min base (24,300) → computed with CASS = 2430', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 24_300, expenses: 0, revenuesNet: 24_300, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CASS = max(min(24300, 291600) * 0.10, 2430) = max(2430, 2430) = 2430
    const cass = res.lines.find(l => l.label === 'CASS (10%)')?.value;
    expect(cass).toBe(2430);
  });

  it('net just below CASS min base (24,299) → review_required', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 24_299, expenses: 0, revenuesNet: 24_299, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  // makeInputs defaults to salaryStatus 'da', so the test above is the art. 174 alin. (7)
  // lit. a) case: the top-up is waived only if salary income reaches 6 SM, and the profile
  // carries no salary amount — so it must surface as review_required, never as a number.
  it('net 24,299 with salaryStatus da → review_required names art. 174 alin. (7) lit. a)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ salaryStatus: 'da', pensionStatus: 'nu' }), profile: makeProfile(), revenues: 24_299, expenses: 0, revenuesNet: 24_299, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
    if (res.status !== 'review_required') return;
    expect(res.reason).toContain('art. 174 alin. (7) lit. a)');
  });

  it('net 24,299 with no salary and no pension → CASS 2,430 (art. 174 alin. (6) top-up)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ salaryStatus: 'nu', pensionStatus: 'nu' }), profile: makeProfile({ salaryStatus: 'nu', pensionStatus: 'nu' }), revenues: 24_299, expenses: 0, revenuesNet: 24_299, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.lines.find(l => l.label === 'CASS (10%)')?.value).toBe(2_430);
  });

  it('pensioner with net below 6 SM → CASS = 10% x net, NOT 0 (art. 174 alin. (7) lit. c) waives only the top-up)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ pensionStatus: 'da' }), profile: makeProfile({ pensionStatus: 'da' }), revenues: 10_000, expenses: 0, revenuesNet: 10_000, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CAS = 0 (art. 150 alin. (1)) but CASS = 1000 (art. 170 alin. (1)) — the asymmetry.
    expect(res.lines.find(l => l.label === 'CAS (25%)')?.value).toBe(0);
    const cass = res.lines.find(l => l.label === 'CASS (10%)')?.value;
    expect(cass).toBe(1_000);
    // taxable = 10000 - 0 - 1000 = 9000 → income 900 → total 1900.
    expect(res.output.total).toBe(1_900);
  });

  it('CASS ceiling is parameter-driven: max_annual_base 100,000 → CASS 10,000 at net 150,000', async () => {
    const modifiedRules = PFA_2026_SYSTEM_REAL_PACKAGE.map((rule) => {
      if (rule.ruleId === 'CASS_2026') {
        return {
          ...rule,
          parameters: rule.parameters.map((p) =>
            p.id === 'max_annual_base' ? { ...p, value: 100_000 } : p,
          ),
        };
      }
      return rule;
    });
    const original = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 150_000, expenses: 0, revenuesNet: 150_000, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    const modified = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 150_000, expenses: 0, revenuesNet: 150_000, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: modifiedRules });
    expect(original.status).toBe('computed');
    expect(modified.status).toBe('computed');
    if (original.status !== 'computed' || modified.status !== 'computed') return;
    // 29,160 is not a hardcoded figure and there is no max_cass parameter: it is rate x
    // max_annual_base, so moving the base parameter moves the ceiling.
    expect(original.lines.find(l => l.label === 'CASS (10%)')?.value).toBe(15_000);
    expect(modified.lines.find(l => l.label === 'CASS (10%)')?.value).toBe(10_000);
  });

  // ── Boundary: CAS tier-1 floor (12 SM) ──

  it('net exactly at CAS tier-1 floor (48,600) → CAS = 12,150', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 48_600, expenses: 0, revenuesNet: 48_600, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CAS = 48600 * 0.25 = 12150 (the 12 SM floor applies from 48,600 up).
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(cas).toBe(12_150);
  });

  it('net just below CAS tier-1 floor (48,599) → CAS = 0, not 12,150', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 48_599, expenses: 0, revenuesNet: 48_599, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CF art. 148 alin. (1): below 12 SM the obligation never arises. The old clamp
    // charged the 12 SM figure here — an over-statement of 12,150 lei.
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(cas).toBe(0);
  });

  it('net just above CAS tier-1 floor (48,601) → CAS stays 12,150 (floor, not 25% of net)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 48_601, expenses: 0, revenuesNet: 48_601, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // Realized income only selects the floor; the base stays 48,600 → 12,150.
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(cas).toBe(12_150);
  });

  // ── CF art. 150 alin. (1): pension exemption. Salary is NOT an exemption. ──

  it('pensionStatus da → CAS = 0 regardless of income (CF art. 150 alin. (1))', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ pensionStatus: 'da' }), profile: makeProfile({ pensionStatus: 'da' }), revenues: 200_000, expenses: 0, revenuesNet: 200_000, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(cas).toBe(0);
    // CAS = 0 flows through taxable and the total: CASS 20000, taxable 180000, income 18000.
    expect(res.output.total).toBe(38_000);
  });

  it('salaryStatus da does NOT exempt from CAS (CF art. 150 alin. (2) covers only lit. b^1))', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ salaryStatus: 'da', pensionStatus: 'nu' }), profile: makeProfile({ salaryStatus: 'da', pensionStatus: 'nu' }), revenues: 60_000, expenses: 0, revenuesNet: 60_000, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(cas).toBe(12_150);
  });

  // ── Boundary: CAS tier-2 floor (24 SM) — a floor, not a cap ──

  it('net exactly at CAS tier-2 floor (97,200) → CAS = 24,300', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 97_200, expenses: 0, revenuesNet: 97_200, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CAS = 97200 * 0.25 = 24300 (crossing 24 SM doubles the floor, it does not cap anything).
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(cas).toBe(24_300);
  });

  it('net just above CAS tier-2 floor (97,201) → CAS stays 24,300 (floor, no cap applied)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 97_201, expenses: 0, revenuesNet: 97_201, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // Same figure as the old clamp produced, but for the right reason: art. 148 alin. (2)
    // sets a 24 SM MINIMUM, it never caps the base.
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(cas).toBe(24_300);
  });

  // ── Boundary: CASS cap ──

  it('net exactly at CASS cap (291,600) → CASS = 29,160', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 291_600, expenses: 0, revenuesNet: 291_600, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CASS = max(min(291600, 291600) * 0.10, 2430) = max(29160, 2430) = 29160
    const cass = res.lines.find(l => l.label === 'CASS (10%)')?.value;
    expect(cass).toBe(29_160);
  });

  it('net just above CASS cap (291,601) → CASS still 29,160 (capped)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 291_601, expenses: 0, revenuesNet: 291_601, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CASS = max(min(291601, 291600) * 0.10, 2430) = max(29160, 2430) = 29160
    const cass = res.lines.find(l => l.label === 'CASS (10%)')?.value;
    expect(cass).toBe(29_160);
  });

  // ── Rounding: no rounding, raw floats ──

  it('net = 71,281 → total = 24478.39 (no rounding, raw float)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 71_281, expenses: 0, revenuesNet: 71_281, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CAS = 48600 * 0.25 = 12150 (12 SM floor — the old clamp charged 17820.25)
    // CASS = 71281 * 0.10 = 7128.1
    // taxable = 71281 - 12150 - 7128.1 = 52002.9
    // incomeTax = 52002.9 * 0.10 = 5200.29
    // total = 12150 + 7128.1 + 5200.29 = 24478.39
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    const cass = res.lines.find(l => l.label === 'CASS (10%)')?.value;
    const incomeTax = res.lines.find(l => l.label === 'Impozit pe venit (rată de bază 10%)')?.value;
    expect(cas).toBeCloseTo(12_150, 3);
    expect(cass).toBeCloseTo(7_128.1, 3);
    expect(incomeTax).toBeCloseTo(5_200.29, 3);
    expect(res.output.total).toBeCloseTo(24_478.39, 3);
  });

  // ── Rule-release awareness ──

  it('modified CAS tier2_base (120,000) → different CAS at net = 100,001', async () => {
    const modifiedRules = PFA_2026_SYSTEM_REAL_PACKAGE.map((rule) => {
      if (rule.ruleId === 'CAS_2026') {
        return {
          ...rule,
          parameters: rule.parameters.map((p) =>
            p.id === 'tier2_base' ? { ...p, value: 120_000 } : p,
          ),
        };
      }
      return rule;
    });

    const original = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 100_001, expenses: 0, revenuesNet: 100_001, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    const modified = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 100_001, expenses: 0, revenuesNet: 100_001, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: modifiedRules });

    expect(original.status).toBe('computed');
    expect(modified.status).toBe('computed');
    if (original.status !== 'computed' || modified.status !== 'computed') return;
    // The 24 SM tier boundary comes from the tier2_base parameter, not a hardcoded 97200:
    // Original: 100001 >= 97200 → tier-2 floor 97200 → CAS = 97200 * 0.25 = 24300
    // Modified: 100001 < 120000 → tier-1 floor 48600 → CAS = 48600 * 0.25 = 12150
    const origCas = original.lines.find(l => l.label === 'CAS (25%)')?.value;
    const modCas = modified.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(origCas).toBe(24_300);
    expect(modCas).toBe(12_150);
    expect(modCas).not.toBe(origCas);
  });

  // ── Effective-date awareness ──

  it('fiscalYear 2025 (asOfDate 2025-01-01) → review_required (rules effectiveFrom 2026-01-01)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ fiscalYear: 2025 }), profile: makeProfile(), revenues: 100_000, expenses: 0, revenuesNet: 100_000, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  // ── Area 6: VAT not becoming taxable income ──

  it('excludes VAT from the taxable base for non-exempt profiles (Area 6)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 55_000, expenses: 11_000, revenuesNet: 50_000, expensesNet: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // Non-exempt: base is the net figure (VAT excluded), gross 55000 → net 50000.
    const gross = res.lines.find((l) => l.label === 'Venit brut')?.value;
    expect(gross).toBe(50_000);
  });

  it('keeps the gross base for vatExempt profiles (Area 6)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ vatExempt: true }), profile: makeProfile(), revenues: 55_000, expenses: 11_000, revenuesNet: 50_000, expensesNet: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // Exempt: base stays gross (VAT kept in), 55000.
    const gross = res.lines.find((l) => l.label === 'Venit brut')?.value;
    expect(gross).toBe(55_000);
  });

  // ── Phase 5 / B-13: the CF art. 174 alin. (6) difference is OWED but never DEDUCTIBLE ──

  it('net 20,000 (0 < VNA < 6 SM): CASS 2,430 owed, only 2,000 deductible, tax on 18,000 (B-13)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ salaryStatus: 'nu' }), profile: makeProfile({ salaryStatus: 'nu' }), revenues: 20_000, expenses: 0, revenuesNet: 20_000, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CAS 0 — net is under the 12 SM floor of art. 151 alin. (1).
    expect(res.lines.find((l) => l.label === 'CAS (25%)')?.value).toBe(0);
    // CASS owed = the 6 SM floor: art. 174 alin. (6).
    expect(res.lines.find((l) => l.label === 'CASS (10%)')?.value).toBeCloseTo(2_430, 6);
    // Deductible CASS = 10% x VNA only: art. 118 alin. (2) lit. b) deducts the contributions
    // „datorate potrivit prevederilor titlului V” „cu excepția diferenței de contribuție … prevăzută la
    // art. 174 alin. (6)”, and alin. (2^3) prorates over the contribution „calculată potrivit art. 174
    // alin. (1)”. The 6 SM floor comes from art. 174 alin. (6), so the difference never enters the base.
    expect(res.lines.find((l) => l.label === 'CASS deductibilă (art. 118 alin. (2^3), fără diferența art. 174 alin. (6))')?.value).toBeCloseTo(2_000, 6);
    // taxable = 20,000 − 2,000 = 18,000 (was 17,570 while the difference was wrongly deducted).
    expect(res.lines.find((l) => l.label === 'Venit net anual impozabil (art. 118 alin. (2) lit. b))')?.value).toBeCloseTo(18_000, 6);
    expect(res.lines.find((l) => l.label === 'Impozit pe venit (rată de bază 10%)')?.value).toBeCloseTo(1_800, 6);
    // total = 2,430 owed CASS + 1,800 tax = 4,230 (was 4,187: the bug understated the bill by 43 lei).
    expect(res.output.total).toBeCloseTo(4_230, 6);
  });

  // ── Phase 5 / B-15: art. 118 alin. (2^2)/(2^3) proration and the alin. (2^4) cap are explicit ──

  it('single source: both art. 118 alin. (2^2)/(2^3) ratios are exactly 1, so the deduction lines equal the contributions', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 71_281, expenses: 0, revenuesNet: 71_281, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // One sursă ⇒ each denominator (total venituri cumulate, art. 148 alin. (3) / art. 170 alin. (1))
    // IS the sistem-real net. The proration must be a no-op today — it is written out so a second
    // income source (Phase 6) cannot inherit a full deduction it is not entitled to.
    expect(res.lines.find((l) => l.label === 'CAS deductibilă (art. 118 alin. (2^2))')?.value).toBeCloseTo(12_150, 6);
    expect(res.lines.find((l) => l.label === 'CASS deductibilă (art. 118 alin. (2^3), fără diferența art. 174 alin. (6))')?.value).toBeCloseTo(7_128.1, 6);
    expect(res.lines.find((l) => l.label === 'Venit net anual impozabil (art. 118 alin. (2) lit. b))')?.value).toBeCloseTo(52_002.9, 6);
    // No cap line when the deductions stay under the recalculated net income.
    expect(res.lines.find((l) => l.label.startsWith('Deduceri blocate'))).toBeUndefined();
    expect(res.output.total).toBeCloseTo(24_478.39, 6);
  });

  it('art. 118 alin. (2^4): the deductions are capped at the recalculated net income of the same source', async () => {
    // Synthetic rate so the cap is reachable: with the real 2026 ladder (CAS 25% over a 12 SM floor,
    // CASS 10%) the sum of the two deductions can never exceed the net income, so the cap is a
    // structural guard here — proven by moving one parameter, exactly like the ceiling tests above.
    const modifiedRules = PFA_2026_SYSTEM_REAL_PACKAGE.map((rule) =>
      rule.ruleId === 'CAS_2026'
        ? { ...rule, parameters: rule.parameters.map((p) => (p.id === 'rate' ? { ...p, value: 100 } : p)) }
        : rule,
    );
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 50_000, expenses: 0, revenuesNet: 50_000, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: modifiedRules });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CAS 48,600 (100% x the 12 SM base) + CASS 5,000 = 53,600 of deductions against a net of 50,000.
    expect(res.lines.find((l) => l.label === 'CAS (25%)')?.value).toBe(48_600);
    expect(res.lines.find((l) => l.label === 'CASS (10%)')?.value).toBeCloseTo(5_000, 6);
    expect(res.lines.find((l) => l.label === 'Deduceri blocate de plafonul art. 118 alin. (2^4)')?.value).toBeCloseTo(3_600, 6);
    // The base stops at 0 — it never goes negative, so no phantom negative tax.
    expect(res.lines.find((l) => l.label === 'Venit net anual impozabil (art. 118 alin. (2) lit. b))')?.value).toBeCloseTo(0, 6);
    expect(res.lines.find((l) => l.label === 'Impozit pe venit (rată de bază 10%)')).toBeUndefined();
    expect(res.lines.find((l) => l.label === 'Impozit pe venit (fără bază impozabilă)')?.value).toBe(0);
    // The contributions are still owed in full: the cap limits the DEDUCTION, not the liability.
    expect(res.output.total).toBeCloseTo(53_600, 6);
  });

  // ── Phase 5 / B-16: a loss year is computed, and the loss is surfaced ──

  it('loss year: status stays computed, total = the contributions owed, and the art. 118 alin. (4)-(5) carry-forward is surfaced', async () => {
    // Reachable only because the old Math.min(expenses, gross) clamp is gone: art. 118 alin. (2) lit. a)
    // requires the taxpayer to determine „pierderea netă recalculată pe fiecare sursă”, so expenses above
    // revenues must produce a negative net, not a silent zero.
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 10_000, expenses: 20_000, revenuesNet: 10_000, expensesNet: 20_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // A loss is a fact, not a review item: no CASS (art. 174 alin. (2)), no CAS (below 12 SM), no tax.
    expect(res.output.total).toBe(0);
    expect(res.lines.find((l) => l.label === 'Impozit pe venit (rată de bază 10%)')).toBeUndefined();
    // But the loss itself must be visible, not hidden behind a bare 0.
    expect(res.lines.find((l) => l.label === 'Pierdere fiscală pe sursă (art. 118 alin. (2) lit. a))')?.value).toBe(10_000);
    expect(res.lossCarryForward?.amount).toBe(10_000);
    expect(res.lossCarryForward?.years).toBe(5);
    expect(res.lossCarryForward?.capPercent).toBe(70);
    expect(res.lossCarryForward?.sameSourceOnly).toBe(true);
    expect(res.lossCarryForward?.rule).toContain('5 ani fiscali consecutivi');
    expect(res.lossCarryForward?.rule).toContain('70%');
    expect(res.lossCarryForward?.rule).toContain('aceeași sursă');
  });

  it('a zero net income is NOT a loss: no carry-forward is reported (art. 118 alin. (2) lit. a))', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 10_000, expenses: 10_000, revenuesNet: 10_000, expensesNet: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.lines.find((l) => l.label === 'Pierdere fiscală pe sursă (art. 118 alin. (2) lit. a))')).toBeUndefined();
    expect(res.lossCarryForward).toBeUndefined();
  });
});
