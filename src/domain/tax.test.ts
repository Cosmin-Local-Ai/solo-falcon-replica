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
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 50_000, expenses: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net=40000, CAS=12150 (min base), CASS=4000, taxable=23850, income=2385, total=18535
    expect(res.output.total).toBe(18_535);
    expect(res.lines.length).toBeGreaterThanOrEqual(5);
    expect(res.snapshot).toBeDefined();
  });

  it('skips CASS for non-obligatoriu status', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ socialInsuranceStatus: 'exempt' }), profile: makeProfile({ socialInsuranceStatus: 'exempt' }), revenues: 50_000, expenses: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.output.total).toBe(14_935);
  });

  it('returns REVIEW_REQUIRED when net = 0 (CASS base below minimum)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 10_000, expenses: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  it('returns REVIEW_REQUIRED for impozit_pe_venit regime', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ regime: 'impozit_pe_venit' }), profile: makeProfile({ regime: 'impozit_pe_venit' }), revenues: 50_000, expenses: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  it('returns REVIEW_REQUIRED for negative revenues', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: -1, expenses: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  it('returns REVIEW_REQUIRED for negative expenses', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 50_000, expenses: -1, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  it('returns REVIEW_REQUIRED when profile id is missing', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile({ id: '' }), revenues: 50_000, expenses: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  it('returns REVIEW_REQUIRED when rules package is empty', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 50_000, expenses: 10_000, ruleRelease: PFA_2026_RELEASE, rules: [] });
    expect(res.status).toBe('review_required');
  });

  it('creates a snapshot with provenance', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 50_000, expenses: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    const snap = res.snapshot;
    expect(snap.inputSnapshot.profile.id).toBe('p1');
    expect(snap.ruleRelease.releaseId).toBe('PFA_2026_SYSTEM_REAL');
    expect(snap.inputsHash).toBeTruthy();
    expect(snap.inputsHash).toHaveLength(64);
    expect(snap.inputSnapshot.revenues).toBe(50_000);
    expect(snap.inputSnapshot.expenses).toBe(10_000);
    expect(snap.output.total).toBe(18_535);
  });

  it('returns REVIEW_REQUIRED for zero revenues (CASS base below minimum)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 0, expenses: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  it('applies 10% flat income tax at 50,000 net', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 60_000, expenses: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net=50000, CAS=12500, CASS=5000, taxable=32500, income=3250, total=20750
    expect(res.output.total).toBe(20_750);
  });

  it('caps CAS at max_base for high income', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 250_000, expenses: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net=250000, CAS=min(250000,97200)*0.25=24300, CASS=25000, taxable=200700, income=20070, total=69370
    expect(res.output.total).toBe(69_370);
  });

  it('applies 10% flat income tax above 200,000 (no progressive bracket)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 300_000, expenses: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net=300000, CAS=24300 (capped), CASS=29160 (capped at 291600), taxable=246540, income=24654, total=78114
    expect(res.output.total).toBe(78_114);
  });

  it('is deterministic for identical inputs', async () => {
    const a = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 123_456, expenses: 78_900, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    const b = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 123_456, expenses: 78_900, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(a.status).toBe('computed');
    expect(b.status).toBe('computed');
    if (a.status !== 'computed' || b.status !== 'computed') return;
    expect(a.output.total).toBe(b.output.total);
    expect(a.lines).toEqual(b.lines);
  });

  it('computes at 71,280 net (CAS below max_base)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 71_280, expenses: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net=71280, CAS=71280*0.25=17820, CASS=7128, taxable=46332, income=4633.2, total=29581.2
    expect(res.output.total).toBeCloseTo(29_581.2, 1);
  });

  it('computes for a high-revenue profile', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 100_000, expenses: 10_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res).toBeDefined();
  });

  it('returns review_required for zero revenues', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 0, expenses: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  it('returns review_required when expenses exceed revenues', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 10_000, expenses: 20_000, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  it('computes at 72,000 net (CAS below max_base)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 72_000, expenses: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net=72000, CAS=72000*0.25=18000, CASS=7200, taxable=46800, income=4680, total=29880
    expect(res.output.total).toBe(29_880);
  });

  // ── Boundary: CASS minimum base ──

  it('net exactly at CASS min base (24,300) → computed with CASS = 2430', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 24_300, expenses: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CASS = max(min(24300, 291600) * 0.10, 2430) = max(2430, 2430) = 2430
    const cass = res.lines.find(l => l.label === 'CASS (10%)')?.value;
    expect(cass).toBe(2430);
  });

  it('net just below CASS min base (24,299) → review_required', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 24_299, expenses: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  // ── Boundary: CAS cap ──

  it('net exactly at CAS cap (97,200) → CAS = 24,300', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 97_200, expenses: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CAS = max(clamp(97200, 48600, 97200) * 0.25, 12150) = max(24300, 12150) = 24300
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(cas).toBe(24_300);
  });

  it('net just above CAS cap (97,201) → CAS still 24,300 (capped)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 97_201, expenses: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CAS = max(clamp(97201, 48600, 97200) * 0.25, 12150) = max(97200*0.25, 12150) = 24300
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(cas).toBe(24_300);
  });

  // ── Boundary: CASS cap ──

  it('net exactly at CASS cap (291,600) → CASS = 29,160', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 291_600, expenses: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CASS = max(min(291600, 291600) * 0.10, 2430) = max(29160, 2430) = 29160
    const cass = res.lines.find(l => l.label === 'CASS (10%)')?.value;
    expect(cass).toBe(29_160);
  });

  it('net just above CASS cap (291,601) → CASS still 29,160 (capped)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 291_601, expenses: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CASS = max(min(291601, 291600) * 0.10, 2430) = max(29160, 2430) = 29160
    const cass = res.lines.find(l => l.label === 'CASS (10%)')?.value;
    expect(cass).toBe(29_160);
  });

  // ── Rounding: no rounding, raw floats ──

  it('net = 71,281 → total = 29581.615 (no rounding, raw float)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 71_281, expenses: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CAS = 71281 * 0.25 = 17820.25
    // CASS = 71281 * 0.10 = 7128.1
    // taxable = 71281 - 17820.25 - 7128.1 = 46332.65
    // incomeTax = 46332.65 * 0.10 = 4633.265
    // total = 17820.25 + 7128.1 + 4633.265 = 29581.615
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    const cass = res.lines.find(l => l.label === 'CASS (10%)')?.value;
    const incomeTax = res.lines.find(l => l.label === 'Income tax (10% base rate)')?.value;
    expect(cas).toBeCloseTo(17_820.25, 3);
    expect(cass).toBeCloseTo(7_128.1, 3);
    expect(incomeTax).toBeCloseTo(4_633.265, 3);
    expect(res.output.total).toBeCloseTo(29_581.615, 3);
  });

  // ── Rule-release awareness ──

  it('modified CAS max_base (100,000) → different CAS at net = 97,201', async () => {
    const modifiedRules = PFA_2026_SYSTEM_REAL_PACKAGE.map((rule) => {
      if (rule.ruleId === 'CAS_2026') {
        return {
          ...rule,
          parameters: rule.parameters.map((p) =>
            p.id === 'max_base' ? { ...p, value: 100_000 } : p,
          ),
        };
      }
      return rule;
    });

    const original = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 97_201, expenses: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    const modified = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: 97_201, expenses: 0, ruleRelease: PFA_2026_RELEASE, rules: modifiedRules });

    expect(original.status).toBe('computed');
    expect(modified.status).toBe('computed');
    if (original.status !== 'computed' || modified.status !== 'computed') return;
    // Original: CAS = min(97201, 97200) * 0.25 = 24300
    // Modified: CAS = min(97201, 100000) * 0.25 = 24300.25
    const origCas = original.lines.find(l => l.label === 'CAS (25%)')?.value;
    const modCas = modified.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(origCas).toBe(24_300);
    expect(modCas).toBeCloseTo(24_300.25, 3);
    expect(modCas).not.toBe(origCas);
  });

  // ── Effective-date awareness ──

  it('fiscalYear 2025 (asOfDate 2025-01-01) → review_required (rules effectiveFrom 2026-01-01)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ fiscalYear: 2025 }), profile: makeProfile(), revenues: 100_000, expenses: 0, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });
});
