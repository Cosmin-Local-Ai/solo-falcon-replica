/**
 * PHASE 31 FIXTURE 6/7, second half — a published example, checked against the register that produced it.
 *
 * **SOURCE** — the same FY2026 vehicle figures as `src/domain/golden/vehicleFiftyPercent.test.ts`:
 * contabilitatedigitala.ro (monografie 2026, TVA 21 %) and firmaromania.com (2026), recorded in
 * `docs/ai/research/47_published_worked_examples_fy2026.md` §7A and §7B. **FISCAL YEAR — 2026. TVA — 21 %.**
 * **GRADE — CORROBORATED** for the entry values, and **INFERENCE** for the ceiling reaching a PFA — see the
 * header of `golden/depreciationCeiling.test.ts` before reading any figure below as authority.
 *
 * ── Why this file exists at all ───────────────────────────────────────────────────────────────────────
 *
 * B-109 put a sibling digest, `assetRegisterHash`, beside `inputsHash` on the calculation record, because
 * the asset register is not in the canonicalised input subset and a snapshot could therefore change its own
 * number for a cause it could not name. That digest is only worth having if a real, published example can be
 * tied to the register that produced it. This file does the tying.
 *
 * ── What is asserted, and what is deliberately not ────────────────────────────────────────────────────
 *
 * **No digest literal is asserted here.** A digest computed by this build and then asserted by the same
 * build is the circularity Phase 31 exists to remove — it would be an expected value produced by the engine.
 * What is asserted instead is the property that makes the digest useful: two different published registers
 * produce two different digests, and the register behind a published figure is therefore addressable at all.
 * The pinned pre-change `inputsHash` literals live in `src/data/schema.test.ts`, where B-109 put them.
 *
 * The money figures below are **derived**, and say so: 16.500 lei is the published 1.500 lei/lună ceiling
 * times the eleven months art. 28 alin. (12) lit. a) puts in 2026. No source prints 16.500 lei.
 */
import { describe, expect, it } from 'vitest';
import { getTaxEstimate } from './dashboard';
import { seedData } from './seed';
import type { FixedAsset } from './types';
import { lei, ron } from '../domain/money';
import { selectEstimateOperands } from '../domain/estimateBasis';
import { selectRuleSet } from '../domain/fiscal';
import { pinClock } from '../test/clock';

/**
 * The VAT-payer case: preț 100.000 lei + the 10.500 lei of TVA that became non-deductible under the 50 %
 * rule = valoare de intrare 110.500 lei. Punerea în funcțiune in Ianuarie 2026, so art. 28 alin. (12) lit. a)
 * puts eleven months of amortisation in FY2026.
 */
const PUBLISHED_M1_VAT_PAYER: FixedAsset = {
  id: 'asset-golden-m1-110500',
  label: 'Autoturism M1 — intrare 110.500 lei',
  entryDate: '2026-01-10',
  putInFunctionDate: '2026-01-10',
  fiscalValue: lei(110_500),
  nonDeductibleVatIncluded: lei(10_500),
  normalLifeMonths: 60,
  method: 'liniar',
  acquisition: 'cumparare',
  paymentState: 'achitat',
  paidOn: '2026-01-10',
  isM1Vehicle: true,
};

/** The neplătitor de TVA case: the whole 21.000 lei of TVA enters the value, so intrare 121.000 lei. */
const PUBLISHED_M1_NON_VAT_PAYER: FixedAsset = {
  ...PUBLISHED_M1_VAT_PAYER,
  id: 'asset-golden-m1-121000',
  label: 'Autoturism M1 — intrare 121.000 lei',
  fiscalValue: lei(121_000),
  nonDeductibleVatIncluded: lei(21_000),
};

function rulesFor(asOf: string) {
  const selection = selectRuleSet(seedData.profile.fiscalYear, asOf);
  if (!selection) throw new Error(`no rule package registered for ${seedData.profile.fiscalYear}`);
  return [...selection.rules];
}

describe('FIXTURE 6/7 (B-109) — a published example is checkable against the register that produced it', () => {
  it('the register behind the published 110.500 lei case is addressed on the calculation record', async () => {
    const asOf = pinClock().toISOString().slice(0, 10);
    const res = await getTaxEstimate({ ...seedData, fixedAssets: [PUBLISHED_M1_VAT_PAYER] }, asOf);
    if (res.status !== 'computed') throw new Error(`the estimate refused: ${res.reason}`);
    // A digest exists and is a digest — not null, not a silence.
    expect(res.snapshot.assetRegisterHash).toMatch(/^[0-9a-f]{64}$/);
    expect(res.snapshot.assetRegisterHash).not.toBeNull();
  });

  it('the two published registers produce different digests, so the figure names the register that made it', async () => {
    const asOf = pinClock().toISOString().slice(0, 10);
    const vatPayer = await getTaxEstimate({ ...seedData, fixedAssets: [PUBLISHED_M1_VAT_PAYER] }, asOf);
    const nonPayer = await getTaxEstimate({ ...seedData, fixedAssets: [PUBLISHED_M1_VAT_PAYER, PUBLISHED_M1_NON_VAT_PAYER] }, asOf);
    if (vatPayer.status !== 'computed' || nonPayer.status !== 'computed') {
      throw new Error('both registers must compute');
    }
    expect(nonPayer.snapshot.assetRegisterHash).toMatch(/^[0-9a-f]{64}$/);
    expect(nonPayer.snapshot.assetRegisterHash).not.toBe(vatPayer.snapshot.assetRegisterHash);
  });

  it('the FY2026 amount the published register posts is 16.500 lei — derived, and labelled as derived', () => {
    // 1.500 lei/lună is the published art. 28 alin. (14) ceiling; eleven months is what art. 28 alin. (12)
    // lit. a) leaves in 2026 after a Ianuarie punere în funcțiune. **No source prints 16.500 lei** — this is
    // the published ceiling applied to the app's month count, and it is asserted as a regression guard on the
    // posting path, not as a published figure.
    const asOf = pinClock().toISOString().slice(0, 10);
    const rules = rulesFor(asOf);
    const bare = selectEstimateOperands(seedData, asOf, rules);
    const posted = selectEstimateOperands({ ...seedData, fixedAssets: [PUBLISHED_M1_VAT_PAYER] }, asOf, rules);
    if (bare.kind !== 'run' || posted.kind !== 'run') throw new Error('both must run');
    expect(posted.depreciation.total).toBe(lei(16_500));
    expect(posted.depreciation.lines).toHaveLength(1);
    expect(posted.depreciation.lines[0].months).toBe(11);
    // The uncapped leg is the published 110.500 / 60 monthly figure over eleven months, and the difference is
    // what the ceiling costs — the same 341,67 lei/lună the sources print, times eleven.
    expect(posted.depreciation.lines[0].deductible).toBe(lei(16_500));
    expect(posted.depreciation.lines[0].uncapped).toBeGreaterThan(posted.depreciation.lines[0].deductible);
  });

  it('the published register does NOT widen the canonicalised input subset — B-109\'s constraint still holds', async () => {
    // The tempting move this phase forbids: putting the register into `inputSnapshot` so `inputsHash` covers
    // it. That would change every stored digest and needs a chain step, and a golden fixture is not a licence
    // to mint one. Asserted so a future reader cannot "fix" the gap by widening the subset.
    const asOf = pinClock().toISOString().slice(0, 10);
    const res = await getTaxEstimate({ ...seedData, fixedAssets: [PUBLISHED_M1_VAT_PAYER] }, asOf);
    if (res.status !== 'computed') throw new Error(`the estimate refused: ${res.reason}`);
    expect('fixedAssets' in res.snapshot.inputSnapshot).toBe(false);
    expect(Object.keys(res.snapshot.inputSnapshot).sort()).toEqual(['expenses', 'profile', 'revenues']);
  });

  it('B-93\'s double-count refusal still fires beside a published register, and still names the asset', () => {
    // A hand-recorded amortisation expense makes every computed schedule unsafe to post, so nothing is
    // posted — and the refusal names the published asset. Acceptance 6 of B-109, re-checked against a
    // fixture whose numbers come from outside this codebase.
    const asOf = pinClock().toISOString().slice(0, 10);
    const rules = rulesFor(asOf);
    const typed: typeof seedData.expenses = [
      {
        id: 'exp-golden-amortizare-tipita',
        tip: 'factura',
        nr: 'Înreg-GOLD-0001',
        date: '2026-03-10',
        paid: '2026-03-10',
        furnizor: 'Registrul de amortizare',
        cui: '0000000000',
        valoareFaraTva: ron(lei(16_500)),
        tva: ron(lei(0)),
        status: 'inregistrata',
        category: 'depreciation_business_asset',
      },
    ];
    const conflicted = selectEstimateOperands(
      { ...seedData, fixedAssets: [PUBLISHED_M1_VAT_PAYER], expenses: [...seedData.expenses, ...typed] },
      asOf,
      rules,
    );
    if (conflicted.kind !== 'run') throw new Error('the estimate must still run');
    expect(conflicted.depreciation.total).toBe(lei(0));
    expect(conflicted.depreciation.conflicts).toHaveLength(1);
    expect(conflicted.depreciation.conflicts[0].assetId).toBe(PUBLISHED_M1_VAT_PAYER.id);
    expect(conflicted.depreciation.conflicts[0].label).toBe(PUBLISHED_M1_VAT_PAYER.label);
  });
});
