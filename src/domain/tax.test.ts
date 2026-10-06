import { describe, it, expect } from 'vitest';
import type { PfaProfile } from './models';
import type { TaxInputsReference } from './derived';
import { computeTaxEstimate } from './tax';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import { PFA_2026_RELEASE } from './fiscal/release2026';

function makeProfile(overrides: Partial<PfaProfile> = {}): PfaProfile {
  return { id: 'p1', regime: 'impozit_pe_cit', fiscalYear: 2026, socialInsuranceStatus: 'obligatoriu', ...overrides } as PfaProfile;
}

function makeInputs(overrides: Partial<TaxInputsReference> = {}): TaxInputsReference {
  return { regime: 'impozit_pe_cit', salaryStatus: 'da', pensionStatus: 'nu', otherIncome: [], socialInsuranceStatus: 'obligatoriu', vatExempt: false, cashFloorLei: 0, fiscalYear: 2026, inputsKey: 'p1:2026:impozit_pe_cit:obligatoriu', ...overrides };
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

  it('returns REVIEW_REQUIRED when net = 0 (CASS base below minimum)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 10_000, expenses: 10_000, revenuesNet: 10_000, expensesNet: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  it('returns REVIEW_REQUIRED for impozit_pe_venit regime', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ regime: 'impozit_pe_venit' }), profile: makeProfile({ regime: 'impozit_pe_venit' }), revenues: 50_000, expenses: 10_000, revenuesNet: 50_000, expensesNet: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
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

  it('returns REVIEW_REQUIRED for zero revenues (CASS base below minimum)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 0, expenses: 0, revenuesNet: 0, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
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

  it('returns review_required for zero revenues', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 0, expenses: 0, revenuesNet: 0, expensesNet: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  it('returns review_required when expenses exceed revenues', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 10_000, expenses: 20_000, revenuesNet: 10_000, expensesNet: 20_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
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
});
