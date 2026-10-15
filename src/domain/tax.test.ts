import { describe, it, expect } from 'vitest';
import type { PfaProfile } from './models';
import type { TaxInputsReference } from './derived';
import { computeTaxEstimate } from './tax';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import { PFA_2026_RELEASE } from './fiscal/release2026';
import { TITLUL_II_VAT_ORDERING_RULE } from './fiscal/vat';
import { lei } from './money';

// B-14: the fixtures used to default to `impozit_pe_cit`, which is the regime a PFA can NEVER have in
// 2026 (CF art. 13 alin. (1), art. 14, art. 15 — Titlul II is for persoane juridice only; the art. 120
// option is Abrogat from 01.01.2025). The engine rejected that regime, so 38 of the 39 cases were
// exercising a path no user can reach while the real default (`impozit_pe_venit`, profile.ts:38) was
// untested. The defaults are now the only lawful PFA regime; the CIT case is tested explicitly below.
function makeProfile(overrides: Partial<PfaProfile> = {}): PfaProfile {
  return { id: 'p1', regime: 'impozit_pe_venit', fiscalYear: 2026, socialInsuranceStatus: 'obligatoriu', ...overrides } as PfaProfile;
}

function makeInputs(overrides: Partial<TaxInputsReference> = {}): TaxInputsReference {
  return { regime: 'impozit_pe_venit', salaryStatus: 'da', pensionerStatus: 'nu', pensionReceiptYears: [], pensionSuspensionYears: [], cassPreviousYearContext: null, foreignSicknessInsurance: null, cassLadderYears: [], socialInsuranceStatus: 'obligatoriu', vatRegistration: { status: 'inregistrat_art316' as const }, cashFloorLei: lei(0), fiscalYear: 2026, salaryIncomeLei: null, pfaStartDate: null, inputsKey: 'p1:2026:impozit_pe_venit:obligatoriu', ...overrides };
}

describe('computeTaxEstimate', () => {
  it('computes CAS + CASS + income tax for a basic profile', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(50_000), expenses: lei(10_000), revenuesNet: lei(50_000), expensesNet: lei(10_000), expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net=40000, CAS=0 (below 12 SM — CF art. 148 alin. (1)), CASS=4000, taxable=36000, income=3600, total=7600
    expect(res.output.total).toBe(lei(7_600));
    expect(res.lines.length).toBeGreaterThanOrEqual(5);
    expect(res.snapshot).toBeDefined();
  });

  it('skips CASS for non-obligatoriu status', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ socialInsuranceStatus: 'exempt' }), profile: makeProfile({ socialInsuranceStatus: 'exempt' }), revenues: lei(50_000), expenses: lei(10_000), revenuesNet: lei(50_000), expensesNet: lei(10_000), expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CAS=0 (below 12 SM), CASS skipped, taxable=40000, income=4000
    expect(res.output.total).toBe(lei(4_000));
  });

  /*
   * B-19 — the flag short-circuit used to emit a silent `CASS (exempt) = 0`, indistinguishable from a
   * contribution a rule actually relieved. These tests pin the fix: the money does not move by a single
   * leu, and the line now says out loud that no legal basis was found.
   */
  it('marks the flag-driven CASS zero review_required for both flag values, and moves no money', async () => {
    for (const status of ['exempt', 'neplata'] as const) {
      const res = await computeTaxEstimate({ inputs: makeInputs({ socialInsuranceStatus: status }), profile: makeProfile({ socialInsuranceStatus: status }), revenues: lei(50_000), expenses: lei(10_000), revenuesNet: lei(50_000), expensesNet: lei(10_000), expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
      expect(res.status).toBe('computed');
      if (res.status !== 'computed') continue;
      const cass = res.lines.find((l) => l.label.startsWith('CASS ('));
      expect(cass, `no CASS line for ${status}`).toBeDefined();
      expect(cass!.value).toBe(0); // exactly the amount the pre-B-19 engine produced
      expect(cass!.reviewRequired).toBe(true); // and it is no longer a silent zero
      expect(cass!.reason?.toLowerCase()).toContain('art. 154 alin. (1)');
      // CAS 0 (below 12 SM) + CASS 0 + 10% x 40 000 — the same total as before the marker existed.
      expect(res.output.total).toBe(lei(4_000));
    }
  });

  it('does NOT mark a CASS zero that a rule does relieve (art. 174 alin. (2) is not a flag)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(10_000), expenses: lei(10_000), revenuesNet: lei(10_000), expensesNet: lei(10_000), expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    const cass = res.lines.find((l) => l.label === 'CASS (10%)');
    expect(cass?.value).toBe(0);
    expect(cass?.reviewRequired).toBeUndefined();
  });

  it('never labels a CASS line „scutit" or „scutire" — neither word exists in Titlul V (B-19)', async () => {
    for (const status of ['obligatoriu', 'exempt', 'neplata'] as const) {
      const res = await computeTaxEstimate({ inputs: makeInputs({ socialInsuranceStatus: status }), profile: makeProfile({ socialInsuranceStatus: status }), revenues: lei(50_000), expenses: lei(10_000), revenuesNet: lei(50_000), expensesNet: lei(10_000), expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
      if (res.status !== 'computed') continue;
      for (const line of res.lines) {
        if (!line.label.startsWith('CASS')) continue;
        expect(line.label.toLowerCase()).not.toContain('scutit');
        expect(line.label.toLowerCase()).not.toContain('scutire');
        expect(line.label.toLowerCase()).not.toContain('exempt');
      }
    }
  });

  it('carries the CASS provenance into the snapshot, not only onto a screen', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ socialInsuranceStatus: 'exempt' }), profile: makeProfile({ socialInsuranceStatus: 'exempt' }), revenues: lei(50_000), expenses: lei(10_000), revenuesNet: lei(50_000), expensesNet: lei(10_000), expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    const provenance = res.snapshot.calculationLines.find((l) => l.label.startsWith('PROVENANȚĂ CASS'));
    expect(provenance).toBeDefined();
    expect(provenance!.label.toLowerCase()).toContain('art. 154 alin. (1)');
    // The admission is stored with the calculation, so an audit of a past snapshot sees the same
    // caveat the engine had at compute time — it is not a UI-only decoration.
    expect(res.snapshot.calculationLines.find((l) => l.label.startsWith('CASS ('))?.reviewRequired).toBe(true);
  });

  it('net = 0 → CASS 0, NOT review_required (CF art. 174 alin. (2): zero net income owes no CASS)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(10_000), expenses: lei(10_000), revenuesNet: lei(10_000), expensesNet: lei(10_000), expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
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
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(50_000), expenses: lei(10_000), revenuesNet: lei(50_000), expensesNet: lei(10_000), expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
  });

  it('impozit_pe_cit on a PFA is a DATA-INTEGRITY failure, not "a different base applies" (B-14)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ regime: 'impozit_pe_cit' }), profile: makeProfile({ regime: 'impozit_pe_cit' }), revenues: lei(50_000), expenses: lei(10_000), revenuesNet: lei(50_000), expensesNet: lei(10_000), expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
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
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(-1), expenses: lei(10_000), revenuesNet: lei(-1), expensesNet: lei(10_000), expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  it('returns REVIEW_REQUIRED for negative expenses', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(50_000), expenses: lei(-1), revenuesNet: lei(50_000), expensesNet: lei(-1), expenseBase: { netFirst: lei(-1), grossFirst: lei(-1), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  it('returns REVIEW_REQUIRED when profile id is missing', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile({ id: '' }), revenues: lei(50_000), expenses: lei(10_000), revenuesNet: lei(50_000), expensesNet: lei(10_000), expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  it('returns REVIEW_REQUIRED when rules package is empty', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(50_000), expenses: lei(10_000), revenuesNet: lei(50_000), expensesNet: lei(10_000), expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: [] });
    expect(res.status).toBe('review_required');
  });

  it('creates a snapshot with provenance', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(50_000), expenses: lei(10_000), revenuesNet: lei(50_000), expensesNet: lei(10_000), expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    const snap = res.snapshot;
    expect(snap.inputSnapshot.profile.id).toBe('p1');
    expect(snap.ruleRelease.releaseId).toBe('PFA_2026_SYSTEM_REAL');
    expect(snap.inputsHash).toBeTruthy();
    expect(snap.inputsHash).toHaveLength(64);
    expect(snap.inputSnapshot.revenues).toBe(lei(50_000));
    expect(snap.inputSnapshot.expenses).toBe(lei(10_000));
    expect(snap.output.total).toBe(lei(7_600));
  });

  it('zero revenues → computed with CASS 0 (CF art. 174 alin. (2)), not review_required', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(0), expenses: lei(0), revenuesNet: lei(0), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.lines.find(l => l.label === 'CASS (10%)')?.value).toBe(0);
    expect(res.output.total).toBe(0);
  });

  it('applies 10% flat income tax at 50,000 net', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(60_000), expenses: lei(10_000), revenuesNet: lei(60_000), expensesNet: lei(10_000), expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net=50000, CAS=12150 (12 SM floor, not 25% of net), CASS=5000, taxable=32850, income=3285, total=20435
    expect(res.output.total).toBe(lei(20_435));
  });

  it('keeps CAS on the 24 SM floor for high income (no cap, CF art. 148 alin. (2) lit. b))', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(250_000), expenses: lei(0), revenuesNet: lei(250_000), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net=250000, CAS=24300 (24 SM floor), CASS=25000, taxable=200700, income=20070, total=69370
    expect(res.output.total).toBe(lei(69_370));
  });

  it('applies 10% flat income tax above 200,000 (no progressive bracket)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(300_000), expenses: lei(0), revenuesNet: lei(300_000), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net=300000, CAS=24300 (24 SM floor), CASS=29160 (capped at 291600 — CASS does have a cap), taxable=246540, income=24654, total=78114
    expect(res.output.total).toBe(lei(78_114));
  });

  it('is deterministic for identical inputs', async () => {
    const a = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(123_456), expenses: lei(78_900), revenuesNet: lei(123_456), expensesNet: lei(78_900), expenseBase: { netFirst: lei(78_900), grossFirst: lei(78_900), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    const b = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(123_456), expenses: lei(78_900), revenuesNet: lei(123_456), expensesNet: lei(78_900), expenseBase: { netFirst: lei(78_900), grossFirst: lei(78_900), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(a.status).toBe('computed');
    expect(b.status).toBe('computed');
    if (a.status !== 'computed' || b.status !== 'computed') return;
    expect(a.output.total).toBe(b.output.total);
    expect(a.lines).toEqual(b.lines);
  });

  it('computes at 71,280 net (CAS on the 12 SM floor)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(71_280), expenses: lei(0), revenuesNet: lei(71_280), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net=71280, CAS=12150 (12 SM floor), CASS=7128, base=52002, income=5200.20 -> art. 66
    // neglects the 20-bani fraction -> 5200. total = 12150 + 7128 + 5200 = 24478.
    expect(res.output.total).toBe(lei(24_478));
  });

  it('computes for a high-revenue profile', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(100_000), expenses: lei(10_000), revenuesNet: lei(100_000), expensesNet: lei(10_000), expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res).toBeDefined();
  });

  it('zero revenues → computed with CASS 0 (CF art. 174 alin. (2))', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(0), expenses: lei(0), revenuesNet: lei(0), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    // Re-pointed from review_required: that expectation was defect B-3 wearing a test's
    // clothes. A zero net income year owes no CASS at all (art. 174 alin. (2)); the 6-SM
    // top-up of art. 174 alin. (6) is not self-executing there.
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.lines.find(l => l.label === 'CASS (10%)')?.value).toBe(0);
    expect(res.output.total).toBe(0);
  });

  it('expenses exceed revenues → computed with CASS 0 (net is not positive, art. 174 alin. (2))', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(10_000), expenses: lei(20_000), revenuesNet: lei(10_000), expensesNet: lei(20_000), expenseBase: { netFirst: lei(20_000), grossFirst: lei(20_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    // Re-pointed with the same reasoning: no positive net, so no CASS base and no CASS.
    // (The old deductible clamp in tax.ts is gone — Phase 5/B-16 lets net go negative so the fiscal
    // loss is representable; the loss itself is surfaced, not stored. Persistence is Phase 7.)
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.lines.find(l => l.label === 'CASS (10%)')?.value).toBe(0);
    expect(res.output.total).toBe(0);
  });

  it('computes at 72,000 net (CAS on the 12 SM floor)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(72_000), expenses: lei(0), revenuesNet: lei(72_000), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net=72000, CAS=12150 (12 SM floor), CASS=7200, taxable=52650, income=5265, total=24615
    expect(res.output.total).toBe(lei(24_615));
  });

  // ── Boundary: CASS minimum base ──

  it('net exactly at CASS min base (24,300) → computed with CASS = 2430', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(24_300), expenses: lei(0), revenuesNet: lei(24_300), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CASS = max(min(24300, 291600) * 0.10, 2430) = max(2430, 2430) = 2430
    const cass = res.lines.find(l => l.label === 'CASS (10%)')?.value;
    expect(cass).toBe(lei(2430));
  });

  it('net just below CASS min base (24,299) → review_required', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(24_299), expenses: lei(0), revenuesNet: lei(24_299), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  // makeInputs defaults to salaryStatus 'da', so the test above is the art. 174 alin. (7)
  // lit. a) case: the top-up is waived only if salary income reaches 6 SM, and the profile
  // carries no salary amount — so it must surface as review_required, never as a number.
  it('net 24,299 with salaryStatus da → review_required names art. 174 alin. (7) lit. a)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ salaryStatus: 'da', pensionerStatus: 'nu' }), profile: makeProfile(), revenues: lei(24_299), expenses: lei(0), revenuesNet: lei(24_299), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
    if (res.status !== 'review_required') return;
    expect(res.reason).toContain('art. 174 alin. (7) lit. a)');
  });

  it('net 24,299 with no salary and no pension → CASS 2,430 (art. 174 alin. (6) top-up)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ salaryStatus: 'nu', pensionerStatus: 'nu' }), profile: makeProfile({ salaryStatus: 'nu', pensionerStatus: 'nu' }), revenues: lei(24_299), expenses: lei(0), revenuesNet: lei(24_299), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.lines.find(l => l.label === 'CASS (10%)')?.value).toBe(lei(2_430));
  });

  it('pension sums received in the year, net below 6 SM → CASS = 10% x net, NOT 0 (art. 174 alin. (7) lit. c) waives only the top-up)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ pensionerStatus: 'da', pensionReceiptYears: [{ fiscalYear: 2026, received: 'da' }] }), profile: makeProfile({ pensionerStatus: 'da', pensionReceiptYears: [{ fiscalYear: 2026, received: 'da' }] }), revenues: lei(10_000), expenses: lei(0), revenuesNet: lei(10_000), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CAS = 0 (art. 150 alin. (1)) but CASS = 1000 (art. 170 alin. (1)) — the asymmetry.
    expect(res.lines.find(l => l.label === 'CAS (25%)')?.value).toBe(0);
    const cass = res.lines.find(l => l.label === 'CASS (10%)')?.value;
    expect(cass).toBe(lei(1_000));
    // taxable = 10000 - 0 - 1000 = 9000 → income 900 → total 1900.
    expect(res.output.total).toBe(lei(1_900));
  });

  // TASK 5 — the key, not the scope. A pensioner STATUS with no receipt fact for the year must NOT get
  // the relief: the top-up stands, and the app says the exception is undecided rather than refusing it.
  it('pensioner status with no receipt fact for the year → top-up stands, relief withheld', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ salaryStatus: 'nu', pensionerStatus: 'da' }), profile: makeProfile({ salaryStatus: 'nu', pensionerStatus: 'da' }), revenues: lei(10_000), expenses: lei(0), revenuesNet: lei(10_000), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.lines.find(l => l.label === 'CAS (25%)')?.value).toBe(0);
    expect(res.lines.find(l => l.label === 'CASS (10%)')?.value).toBe(lei(2_430));
  });

  // alin. (7) is year-scoped: a receipt recorded for another fiscal year is not this year's fact.
  it('pension receipt attributed to another year does not relieve this year', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ salaryStatus: 'nu', pensionReceiptYears: [{ fiscalYear: 2025, received: 'da' }] }), profile: makeProfile({ salaryStatus: 'nu', pensionReceiptYears: [{ fiscalYear: 2025, received: 'da' }] }), revenues: lei(10_000), expenses: lei(0), revenuesNet: lei(10_000), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.lines.find(l => l.label === 'CASS (10%)')?.value).toBe(lei(2_430));
  });

  // CF art. 174 alin. (8): the previous-year route, reached with no pension fact at all.
  it('previous-year art. 154 alin. (1) category relieves the top-up through the engine (art. 174 alin. (8))', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ salaryStatus: 'nu', cassPreviousYearContext: { previousFiscalYear: 2025, inExceptedCategory: 'da' } }), profile: makeProfile({ salaryStatus: 'nu', cassPreviousYearContext: { previousFiscalYear: 2025, inExceptedCategory: 'da' } }), revenues: lei(10_000), expenses: lei(0), revenuesNet: lei(10_000), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.lines.find(l => l.label === 'CASS (10%)')?.value).toBe(lei(1_000));
  });

  // CF art. 153 alin. (2) is the one ground that removes CASS entirely — and it is not a pension rule.
  it('proved foreign sickness/maternity insurance → no CASS at all (art. 153 alin. (2))', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ salaryStatus: 'nu', foreignSicknessInsurance: { fiscalYear: 2026, held: 'da', proved: 'da' } }), profile: makeProfile({ salaryStatus: 'nu', foreignSicknessInsurance: { fiscalYear: 2026, held: 'da', proved: 'da' } }), revenues: lei(60_000), expenses: lei(0), revenuesNet: lei(60_000), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.lines.find(l => l.label === 'CASS (10%)')?.value).toBe(lei(0));
  });

  it('CASS ceiling is parameter-driven: max_annual_base 100,000 → CASS 10,000 at net 150,000', async () => {
    const modifiedRules = PFA_2026_SYSTEM_REAL_PACKAGE.map((rule) => {
      if (rule.ruleId === 'CASS_2026') {
        return {
          ...rule,
          parameters: rule.parameters.map((p) =>
            p.id === 'max_annual_base' ? { ...p, value: lei(100_000) } : p,
          ),
        };
      }
      return rule;
    });
    const original = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(150_000), expenses: lei(0), revenuesNet: lei(150_000), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    const modified = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(150_000), expenses: lei(0), revenuesNet: lei(150_000), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: modifiedRules });
    expect(original.status).toBe('computed');
    expect(modified.status).toBe('computed');
    if (original.status !== 'computed' || modified.status !== 'computed') return;
    // 29,160 is not a hardcoded figure and there is no max_cass parameter: it is rate x
    // max_annual_base, so moving the base parameter moves the ceiling.
    expect(original.lines.find(l => l.label === 'CASS (10%)')?.value).toBe(lei(15_000));
    expect(modified.lines.find(l => l.label === 'CASS (10%)')?.value).toBe(lei(10_000));
  });

  // ── Boundary: CAS tier-1 floor (12 SM) ──

  it('net exactly at CAS tier-1 floor (48,600) → CAS = 12,150', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(48_600), expenses: lei(0), revenuesNet: lei(48_600), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CAS = 48600 * 0.25 = 12150 (the 12 SM floor applies from 48,600 up).
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(cas).toBe(lei(12_150));
  });

  it('net just below CAS tier-1 floor (48,599) → CAS = 0, not 12,150', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(48_599), expenses: lei(0), revenuesNet: lei(48_599), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CF art. 148 alin. (1): below 12 SM the obligation never arises. The old clamp
    // charged the 12 SM figure here — an over-statement of 12,150 lei.
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(cas).toBe(0);
  });

  it('net just above CAS tier-1 floor (48,601) → CAS stays 12,150 (floor, not 25% of net)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(48_601), expenses: lei(0), revenuesNet: lei(48_601), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // Realized income only selects the floor; the base stays 48,600 → 12,150.
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(cas).toBe(lei(12_150));
  });

  // ── CF art. 150 alin. (1): pension exemption. Salary is NOT an exemption. ──

  it('pensionerStatus da → CAS = 0 regardless of income (CF art. 150 alin. (1))', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ pensionerStatus: 'da' }), profile: makeProfile({ pensionerStatus: 'da' }), revenues: lei(200_000), expenses: lei(0), revenuesNet: lei(200_000), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(cas).toBe(0);
    // CAS = 0 flows through taxable and the total: CASS 20000, taxable 180000, income 18000.
    expect(res.output.total).toBe(lei(38_000));
  });

  it('salaryStatus da does NOT exempt from CAS (CF art. 150 alin. (2) covers only lit. b^1))', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ salaryStatus: 'da', pensionerStatus: 'nu' }), profile: makeProfile({ salaryStatus: 'da', pensionerStatus: 'nu' }), revenues: lei(60_000), expenses: lei(0), revenuesNet: lei(60_000), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(cas).toBe(lei(12_150));
  });

  // ── Boundary: CAS tier-2 floor (24 SM) — a floor, not a cap ──

  it('net exactly at CAS tier-2 floor (97,200) → CAS = 24,300', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(97_200), expenses: lei(0), revenuesNet: lei(97_200), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CAS = 97200 * 0.25 = 24300 (crossing 24 SM doubles the floor, it does not cap anything).
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(cas).toBe(lei(24_300));
  });

  it('net just above CAS tier-2 floor (97,201) → CAS stays 24,300 (floor, no cap applied)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(97_201), expenses: lei(0), revenuesNet: lei(97_201), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // Same figure as the old clamp produced, but for the right reason: art. 148 alin. (2)
    // sets a 24 SM MINIMUM, it never caps the base.
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(cas).toBe(lei(24_300));
  });

  // ── Boundary: CASS cap ──

  it('net exactly at CASS cap (291,600) → CASS = 29,160', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(291_600), expenses: lei(0), revenuesNet: lei(291_600), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CASS = max(min(291600, 291600) * 0.10, 2430) = max(29160, 2430) = 29160
    const cass = res.lines.find(l => l.label === 'CASS (10%)')?.value;
    expect(cass).toBe(lei(29_160));
  });

  it('net just above CASS cap (291,601) → CASS still 29,160 (capped)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(291_601), expenses: lei(0), revenuesNet: lei(291_601), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CASS = max(min(291601, 291600) * 0.10, 2430) = max(29160, 2430) = 29160
    const cass = res.lines.find(l => l.label === 'CASS (10%)')?.value;
    expect(cass).toBe(lei(29_160));
  });

  // ── Rounding: CF art. 66 — sums DUE are rounded to the last ban ──

  it('net = 71,281 → total = 24478 (art. 66: fractions under 50 bani are neglected)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(71_281), expenses: lei(0), revenuesNet: lei(71_281), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CAS = 48600 * 0.25 = 12150 (12 SM floor — the old clamp charged 17820.25)
    // CASS = 71281 * 0.10 = 7128.10 lei -> art. 66 neglects the 10-bani fraction -> 7128.00
    // BASE = net - (rounded deductible lines) = 71281 - 12150 - 7128 = 52003, exact integer bani.
    //   Nothing is re-rounded here: art. 66 rounds each sum DUE once, and the base is then plain
    //   integer arithmetic on those already-rounded amounts (it is never itself a rounded figure).
    // incomeTax = 52003 * 0.10 = 5200.30 lei -> art. 66 neglects the 30-bani fraction -> 5200.00
    // total = sum of the ROUNDED lines = 12150 + 7128 + 5200 = 24478.00
    const cas = res.lines.find(l => l.label === 'CAS (25%)')?.value;
    const cass = res.lines.find(l => l.label === 'CASS (10%)')?.value;
    const incomeTax = res.lines.find(l => l.label === 'Impozit pe venit (rată de bază 10%)')?.value;
    expect(cas).toBeCloseTo(lei(12_150), 3);
    expect(cass).toBe(lei(7_128));
    expect(incomeTax).toBe(lei(5_200));
    expect(res.output.total).toBe(lei(24_478));
  });

  // ── Rule-release awareness ──

  it('modified CAS tier2_base (120,000) → different CAS at net = 100,001', async () => {
    const modifiedRules = PFA_2026_SYSTEM_REAL_PACKAGE.map((rule) => {
      if (rule.ruleId === 'CAS_2026') {
        return {
          ...rule,
          parameters: rule.parameters.map((p) =>
            p.id === 'tier2_base' ? { ...p, value: lei(120_000) } : p,
          ),
        };
      }
      return rule;
    });

    const original = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(100_001), expenses: lei(0), revenuesNet: lei(100_001), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    const modified = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(100_001), expenses: lei(0), revenuesNet: lei(100_001), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: modifiedRules });

    expect(original.status).toBe('computed');
    expect(modified.status).toBe('computed');
    if (original.status !== 'computed' || modified.status !== 'computed') return;
    // The 24 SM tier boundary comes from the tier2_base parameter, not a hardcoded 97200:
    // Original: 100001 >= 97200 → tier-2 floor 97200 → CAS = 97200 * 0.25 = 24300
    // Modified: 100001 < 120000 → tier-1 floor 48600 → CAS = 48600 * 0.25 = 12150
    const origCas = original.lines.find(l => l.label === 'CAS (25%)')?.value;
    const modCas = modified.lines.find(l => l.label === 'CAS (25%)')?.value;
    expect(origCas).toBe(lei(24_300));
    expect(modCas).toBe(lei(12_150));
    expect(modCas).not.toBe(origCas);
  });

  // ── Effective-date awareness ──

  it('fiscalYear 2025 (asOfDate 2025-01-01) → review_required (rules effectiveFrom 2026-01-01)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ fiscalYear: 2025 }), profile: makeProfile(), revenues: lei(100_000), expenses: lei(0), revenuesNet: lei(100_000), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('review_required');
  });

  // ── Area 6: VAT not becoming taxable income ──

  it('excludes VAT from the taxable base for non-exempt profiles (Area 6)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(55_000), expenses: lei(11_000), revenuesNet: lei(50_000), expensesNet: lei(10_000), expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // A VAT-registered person's TVA is not their income, so the base is the VAT-exclusive figure:
    // gross 55.000 → net 50.000.
    const gross = res.lines.find((l) => l.label === 'Venit brut')?.value;
    expect(gross).toBe(lei(50_000));
  });

  it('keeps the gross base for a profile in the art. 310 exemption (Area 6)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ vatRegistration: { status: 'scutit_art310' as const } }), profile: makeProfile(), revenues: lei(55_000), expenses: lei(11_000), revenuesNet: lei(50_000), expensesNet: lei(10_000), expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // Exempt: base stays gross (VAT kept in), 55000.
    const gross = res.lines.find((l) => l.label === 'Venit brut')?.value;
    expect(gross).toBe(lei(55_000));
  });

  // ── Phase 5 / B-13: the CF art. 174 alin. (6) difference is OWED but never DEDUCTIBLE ──

  it('net 20,000 (0 < VNA < 6 SM): CASS 2,430 owed, only 2,000 deductible, tax on 18,000 (B-13)', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs({ salaryStatus: 'nu' }), profile: makeProfile({ salaryStatus: 'nu' }), revenues: lei(20_000), expenses: lei(0), revenuesNet: lei(20_000), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CAS 0 — net is under the 12 SM floor of art. 151 alin. (1).
    expect(res.lines.find((l) => l.label === 'CAS (25%)')?.value).toBe(0);
    // CASS owed = the 6 SM floor: art. 174 alin. (6).
    expect(res.lines.find((l) => l.label === 'CASS (10%)')?.value).toBeCloseTo(lei(2_430), 6);
    // Deductible CASS = 10% x VNA only: art. 118 alin. (2) lit. b) deducts the contributions
    // „datorate potrivit prevederilor titlului V” „cu excepția diferenței de contribuție … prevăzută la
    // art. 174 alin. (6)”, and alin. (2^3) prorates over the contribution „calculată potrivit art. 174
    // alin. (1)”. The 6 SM floor comes from art. 174 alin. (6), so the difference never enters the base.
    expect(res.lines.find((l) => l.label === 'CASS deductibilă (art. 118 alin. (2^3), fără diferența art. 174 alin. (6))')?.value).toBeCloseTo(lei(2_000), 6);
    // taxable = 20,000 − 2,000 = 18,000 (was 17,570 while the difference was wrongly deducted).
    expect(res.lines.find((l) => l.label === 'Venit net anual impozabil (art. 118 alin. (2) lit. b))')?.value).toBeCloseTo(lei(18_000), 6);
    expect(res.lines.find((l) => l.label === 'Impozit pe venit (rată de bază 10%)')?.value).toBeCloseTo(lei(1_800), 6);
    // total = 2,430 owed CASS + 1,800 tax = 4,230 (was 4,187: the bug understated the bill by 43 lei).
    expect(res.output.total).toBe(lei(4_230));
  });

  // ── Phase 5 / B-15: art. 118 alin. (2^2)/(2^3) proration and the alin. (2^4) cap are explicit ──

  it('single source: both art. 118 alin. (2^2)/(2^3) ratios are exactly 1, so the deduction lines equal the contributions', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(71_281), expenses: lei(0), revenuesNet: lei(71_281), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // One sursă ⇒ each denominator (total venituri cumulate, art. 148 alin. (3) / art. 170 alin. (1))
    // IS the sistem-real net. The proration must be a no-op today — it is written out so a second
    // income source (Phase 6) cannot inherit a full deduction it is not entitled to.
    expect(res.lines.find((l) => l.label === 'CAS deductibilă (art. 118 alin. (2^2))')?.value).toBe(lei(12_150));
    expect(res.lines.find((l) => l.label === 'CASS deductibilă (art. 118 alin. (2^3), fără diferența art. 174 alin. (6))')?.value).toBe(lei(7_128));
    // The base is the exact difference of the already-rounded lines: 71281 - 12150 - 7128 = 52003.
    expect(res.lines.find((l) => l.label === 'Venit net anual impozabil (art. 118 alin. (2) lit. b))')?.value).toBe(lei(52_003));
    // No cap line when the deductions stay under the recalculated net income.
    expect(res.lines.find((l) => l.label.startsWith('Deduceri blocate'))).toBeUndefined();
    // total = 12150 + 7128 + 5200 = 24478 (income tax 52003 x 10% = 5200.30 -> art. 66 -> 5200.00)
    expect(res.output.total).toBe(lei(24_478));
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
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(50_000), expenses: lei(0), revenuesNet: lei(50_000), expensesNet: lei(0), expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: modifiedRules });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // CAS 48,600 (100% x the 12 SM base) + CASS 5,000 = 53,600 of deductions against a net of 50,000.
    expect(res.lines.find((l) => l.label === 'CAS (25%)')?.value).toBe(lei(48_600));
    expect(res.lines.find((l) => l.label === 'CASS (10%)')?.value).toBeCloseTo(lei(5_000), 6);
    expect(res.lines.find((l) => l.label === 'Deduceri blocate de plafonul art. 118 alin. (2^4)')?.value).toBeCloseTo(lei(3_600), 6);
    // The base stops at 0 — it never goes negative, so no phantom negative tax.
    expect(res.lines.find((l) => l.label === 'Venit net anual impozabil (art. 118 alin. (2) lit. b))')?.value).toBeCloseTo(0, 6);
    expect(res.lines.find((l) => l.label === 'Impozit pe venit (rată de bază 10%)')).toBeUndefined();
    expect(res.lines.find((l) => l.label === 'Impozit pe venit (fără bază impozabilă)')?.value).toBe(0);
    // The contributions are still owed in full: the cap limits the DEDUCTION, not the liability.
    expect(res.output.total).toBeCloseTo(lei(53_600), 6);
  });

  // ── Phase 5 / B-16: a loss year is computed, and the loss is surfaced ──

  it('loss year: status stays computed, total = the contributions owed, and the art. 118 alin. (4)-(5) carry-forward is surfaced', async () => {
    // Reachable only because the old Math.min(expenses, gross) clamp is gone: art. 118 alin. (2) lit. a)
    // requires the taxpayer to determine „pierderea netă recalculată pe fiecare sursă”, so expenses above
    // revenues must produce a negative net, not a silent zero.
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(10_000), expenses: lei(20_000), revenuesNet: lei(10_000), expensesNet: lei(20_000), expenseBase: { netFirst: lei(20_000), grossFirst: lei(20_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // A loss is a fact, not a review item: no CASS (art. 174 alin. (2)), no CAS (below 12 SM), no tax.
    expect(res.output.total).toBe(0);
    expect(res.lines.find((l) => l.label === 'Impozit pe venit (rată de bază 10%)')).toBeUndefined();
    // But the loss itself must be visible, not hidden behind a bare 0.
    expect(res.lines.find((l) => l.label === 'Pierdere fiscală pe sursă (art. 118 alin. (2) lit. a))')?.value).toBe(lei(10_000));
    expect(res.lossCarryForward?.amount).toBe(lei(10_000));
    expect(res.lossCarryForward?.years).toBe(5);
    expect(res.lossCarryForward?.capPercent).toBe(70);
    expect(res.lossCarryForward?.sameSourceOnly).toBe(true);
    expect(res.lossCarryForward?.rule).toContain('5 ani fiscali consecutivi');
    expect(res.lossCarryForward?.rule).toContain('70%');
    expect(res.lossCarryForward?.rule).toContain('aceeași sursă');
  });

  it('a zero net income is NOT a loss: no carry-forward is reported (art. 118 alin. (2) lit. a))', async () => {
    const res = await computeTaxEstimate({ inputs: makeInputs(), profile: makeProfile(), revenues: lei(10_000), expenses: lei(10_000), revenuesNet: lei(10_000), expensesNet: lei(10_000), expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false }, ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.lines.find((l) => l.label === 'Pierdere fiscală pe sursă (art. 118 alin. (2) lit. a))')).toBeUndefined();
    expect(res.lossCarryForward).toBeUndefined();
  });
});

/**
 * Phase 6 — the profile now supplies the engine the salary amount that CF art. 174 alin. (7)
 * lit. a) actually tests („venituri din salarii și asimilate salariilor la un nivel cel puțin
 * egal cu 6 salarii minime brute”). Before Phase 6 a salaried PFA with net income under the
 * 6 SM floor got no CASS estimate at all (REVIEW_REQUIRED). Both branches must compute now
 * (docs/ai/phases/06_fiscal_profile.md §6).
 */
describe('salaried PFA under the 6 SM floor — both art. 174 alin. (7) lit. a) branches compute', () => {
  const money = {
    revenues: lei(30_000),
    expenses: lei(10_000),
    revenuesNet: lei(30_000),
    expensesNet: lei(10_000),
    // PG-6f — no line here is both half-count-limited and carrying non-recoverable VAT, so the two
    // candidate bases coincide and the engine runs on the single number.
    expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false },
  };

  it('salary at least 6 SM (24,300 lei in 2026): CASS = 10% × net, no top-up', async () => {
    const res = await computeTaxEstimate({
      inputs: makeInputs({ salaryStatus: 'da', salaryIncomeLei: lei(30_000) }),
      profile: makeProfile(),
      ...money,
      ruleRelease: PFA_2026_RELEASE,
      rules: PFA_2026_SYSTEM_REAL_PACKAGE,
    });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // VNA 20,000 < 24,300, so alin. (6) would ask for a top-up; alin. (7) lit. a) removes it.
    expect(res.lines.find((l) => l.label === 'CASS (10%)')?.value).toBe(lei(2_000));
    expect(
      res.lines.find((l) => l.label === 'CASS deductibilă (art. 118 alin. (2^3), fără diferența art. 174 alin. (6))')?.value,
    ).toBe(lei(2_000));
    // CAS 0 (net < 12 SM) + CASS 2,000 + impozit 10% × (20,000 − 2,000) = 1,800.
    expect(res.output.total).toBe(lei(3_800));
  });

  it('salary below 6 SM: the alin. (6) difference is owed and is not deductible (B-13 shape)', async () => {
    const res = await computeTaxEstimate({
      inputs: makeInputs({ salaryStatus: 'da', salaryIncomeLei: lei(20_000) }),
      profile: makeProfile(),
      ...money,
      ruleRelease: PFA_2026_RELEASE,
      rules: PFA_2026_SYSTEM_REAL_PACKAGE,
    });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.lines.find((l) => l.label === 'CASS (10%)')?.value).toBe(lei(2_430));
    // Only 10% × VNA is deductible — art. 118 alin. (2) lit. b) excludes the alin. (6) difference.
    expect(
      res.lines.find((l) => l.label === 'CASS deductibilă (art. 118 alin. (2^3), fără diferența art. 174 alin. (6))')?.value,
    ).toBe(lei(2_000));
    // Same taxable base as the relieved branch, but 430 lei more payable.
    expect(
      res.lines.find((l) => l.label === 'Venit net anual impozabil (art. 118 alin. (2) lit. b))')?.value,
    ).toBe(lei(18_000));
    expect(res.output.total).toBe(lei(4_230));
  });

  it('with no salary amount the engine still refuses to guess the 6 SM test', async () => {
    const res = await computeTaxEstimate({
      inputs: makeInputs({ salaryStatus: 'da', salaryIncomeLei: null }),
      profile: makeProfile(),
      ...money,
      ruleRelease: PFA_2026_RELEASE,
      rules: PFA_2026_SYSTEM_REAL_PACKAGE,
    });
    expect(res.status).toBe('review_required');
    if (res.status !== 'review_required') return;
    expect(res.reason).toContain('art. 174 alin. (7) lit. a)');
  });
});

/**
 * Phase 6 regime surface: `norma_venit` parses (so an old or foreign payload is never
 * discarded) but must never produce a number, and no norm-of-income value is invented.
 */
describe('uncomputable regimes surface as REVIEW_REQUIRED with a reason', () => {
  it('norma_venit → review_required naming art. 68 alin. (1) and refusing to invent values', async () => {
    const res = await computeTaxEstimate({
      inputs: makeInputs({ regime: 'norma_venit' }),
      profile: makeProfile({ regime: 'norma_venit' }),
      revenues: lei(50_000),
      expenses: lei(10_000),
      revenuesNet: lei(50_000),
      expensesNet: lei(10_000),
      // PG-6f — the base is supplied, not inferred; the two candidates coincide here.
      expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false },
      ruleRelease: PFA_2026_RELEASE,
      rules: PFA_2026_SYSTEM_REAL_PACKAGE,
    });
    expect(res.status).toBe('review_required');
    if (res.status !== 'review_required') return;
    expect(res.reason).toContain('norma_venit');
    expect(res.reason).toContain('art. 68 alin. (1)');
    expect(res.reason).toContain('nu inventăm valori');
  });

  it('impozit_pe_cit keeps the data-integrity wording pinned by Phase 5 (B-14)', async () => {
    const res = await computeTaxEstimate({
      inputs: makeInputs({ regime: 'impozit_pe_cit' }),
      profile: makeProfile({ regime: 'impozit_pe_cit' }),
      revenues: lei(50_000),
      expenses: lei(10_000),
      revenuesNet: lei(50_000),
      expensesNet: lei(10_000),
      // PG-6f — the base is supplied, not inferred; the two candidates coincide here.
      expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false },
      ruleRelease: PFA_2026_RELEASE,
      rules: PFA_2026_SYSTEM_REAL_PACKAGE,
    });
    expect(res.status).toBe('review_required');
    if (res.status !== 'review_required') return;
    expect(res.reason).toContain('nu poate aparține unui PFA');
    expect(res.reason).toContain('art. 13 alin. (1)');
    expect(res.reason).toContain('art. 120');
  });
});

/**
 * CF art. 118 alin. (3): „Veniturile … ce se realizează într-o fracțiune de an … se consideră
 * venit anual.” A mid-year start date must therefore NOT prorate the base — it is recorded so
 * the user can see the rule was applied, not silently multiplied by a fraction.
 */
describe('mid-year start date (art. 118 alin. (3))', () => {
  const money = {
    revenues: lei(30_000),
    expenses: lei(10_000),
    revenuesNet: lei(30_000),
    expensesNet: lei(10_000),
    // PG-6f — no line here is both half-count-limited and carrying non-recoverable VAT, so the two
    // candidate bases coincide and the engine runs on the single number.
    expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false },
  };

  it('adds an explicit line and leaves the base unprorated', async () => {
    const res = await computeTaxEstimate({
      inputs: makeInputs({ pfaStartDate: '2026-04-01', salaryStatus: 'nu' }),
      profile: makeProfile({ pfaStartDate: '2026-04-01' }),
      ...money,
      ruleRelease: PFA_2026_RELEASE,
      rules: PFA_2026_SYSTEM_REAL_PACKAGE,
    });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    const line = res.lines.find((l) => l.label === 'Fracțiune de an (art. 118 alin. (3)): venit anual');
    expect(line?.value).toBe(lei(20_000));
    expect(
      res.lines.find((l) => l.label === 'Venit net anual impozabil (art. 118 alin. (2) lit. b))')?.value,
    ).toBe(lei(18_000));
  });

  it('a 1 January start adds no line (nothing to explain)', async () => {
    const res = await computeTaxEstimate({
      inputs: makeInputs({ pfaStartDate: '2026-01-01', salaryStatus: 'nu' }),
      profile: makeProfile({ pfaStartDate: '2026-01-01' }),
      ...money,
      ruleRelease: PFA_2026_RELEASE,
      rules: PFA_2026_SYSTEM_REAL_PACKAGE,
    });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(
      res.lines.find((l) => l.label === 'Fracțiune de an (art. 118 alin. (3)): venit anual'),
    ).toBeUndefined();
  });
});

/**
 * PG-6f (B-30, D-VAT-2) — the expense base is an operand the caller supplies from the per-line input-VAT
 * decision, and the engine refuses rather than choose where the choice is not settled.
 *
 * The two Area 6 cases above pin the money MEASURE; these pin what happens when the measure is unknown,
 * and what happens when a half-count rule meets VAT the taxpayer could not claim back and the ordering of
 * the two changes the figure.
 */
describe('PG-6f — the expense base as an operand, and the two refusals', () => {
  it('an undeclared registration refuses instead of picking a money measure', async () => {
    const res = await computeTaxEstimate({
      inputs: makeInputs({ vatRegistration: null }),
      profile: makeProfile(),
      revenues: lei(55_000),
      expenses: lei(11_000),
      revenuesNet: lei(50_000),
      expensesNet: lei(10_000),
      expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false },
      ruleRelease: PFA_2026_RELEASE,
      rules: PFA_2026_SYSTEM_REAL_PACKAGE,
    });
    expect(res.status).toBe('review_required');
    if (res.status !== 'review_required') return;
    // The reason must name what is missing and what each answer would have changed, so the refusal is
    // readable as a question and not as a fault.
    expect(res.reason).toContain('Starea de înregistrare în scopuri de TVA nu este declarată');
    expect(res.reason).toContain('art. 310 alin. (10) lit. a)');
  });

  it('acceptance 8: a divergent base refuses, shows BOTH figures, and quotes the Titlul II rule as corporate-only', async () => {
    const res = await computeTaxEstimate({
      inputs: makeInputs(),
      profile: makeProfile(),
      revenues: lei(50_000),
      expenses: lei(10_000),
      revenuesNet: lei(50_000),
      expensesNet: lei(10_000),
      // A half-count rule met non-recoverable VAT: measuring it on the net base gives 10.000 lei, on the
      // base that also carries the VAT the PFA could not claim back it gives 10.950 lei.
      expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_950), divergent: true },
      ruleRelease: PFA_2026_RELEASE,
      rules: PFA_2026_SYSTEM_REAL_PACKAGE,
    });
    expect(res.status).toBe('review_required');
    if (res.status !== 'review_required') return;
    // Both numbers are on the record, neither presented as the answer.
    expect(res.lines.find((l) => l.label === 'Cheltuieli deductibile — jumătate din baza fără TVA')?.value).toBe(lei(10_000));
    expect(res.lines.find((l) => l.label === 'Cheltuieli deductibile — jumătate din baza cu TVA nedeductibilă')?.value).toBe(lei(10_950));
    // The only ordering text that exists anywhere is quoted — and labelled for what it is, so it can
    // never be read as a rule that governs this PFA.
    expect(res.reason).toContain(TITLUL_II_VAT_ORDERING_RULE.quote);
    expect(res.reason).toContain('Titlului II');
    expect(res.reason).toContain('Nicio regulă echivalentă nu există pentru un PFA');
  });

  it('a convergent base computes on the single figure the decision produced', async () => {
    const res = await computeTaxEstimate({
      inputs: makeInputs({ salaryStatus: 'nu' }),
      profile: makeProfile({ salaryStatus: 'nu' }),
      revenues: lei(30_000),
      expenses: lei(10_000),
      revenuesNet: lei(30_000),
      expensesNet: lei(10_000),
      expenseBase: { netFirst: lei(10_000), grossFirst: lei(10_000), divergent: false },
      ruleRelease: PFA_2026_RELEASE,
      rules: PFA_2026_SYSTEM_REAL_PACKAGE,
    });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.lines.find((l) => l.label === 'Cheltuieli deductibile')?.value).toBe(lei(10_000));
  });

  it('the base the caller supplies is the one the engine uses, not a re-derivation of it', async () => {
    // Same profile, same recorded totals, a different base: the figure moves. This is what makes the
    // operand load-bearing — the engine cannot quietly fall back to `expenses` or `expensesNet`.
    const res = await computeTaxEstimate({
      inputs: makeInputs({ salaryStatus: 'nu' }),
      profile: makeProfile({ salaryStatus: 'nu' }),
      revenues: lei(30_000),
      expenses: lei(10_000),
      revenuesNet: lei(30_000),
      expensesNet: lei(10_000),
      expenseBase: { netFirst: lei(10_950), grossFirst: lei(10_950), divergent: false },
      ruleRelease: PFA_2026_RELEASE,
      rules: PFA_2026_SYSTEM_REAL_PACKAGE,
    });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.lines.find((l) => l.label === 'Cheltuieli deductibile')?.value).toBe(lei(10_950));
  });
});
