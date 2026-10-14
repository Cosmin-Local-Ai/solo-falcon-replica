/**
 * B-93 re-premises this file. It was written as PG-6e acceptance 9 — "an asset in the register moves **no**
 * fiscal figure" — and for one phase that was the right assertion: the schedule existed, the estimate did
 * not read it, and wiring it in early would have been an inference from the register to the expense side
 * that art. 68 alin. (4) lit. d) does not license.
 *
 * B-93 is the phase that licenses it, and the assertion therefore inverts: **an asset with declared facts
 * now moves the estimate, by exactly its own schedule.** The claim that survives is the narrower one the
 * original file was really protecting:
 *
 *  - the seed still declares no asset, so the seed's published figure is unchanged by this phase;
 *  - `fixedAssets` still lives on `AppData` and not on the profile, so the snapshot's canonicalised input
 *    subset is still `{ profile, revenues, expenses }`;
 *  - the financial summary still reports recorded money, not deductions.
 *
 * ⚠️ What the digest does and does not prove, restated by B-109. `inputsHash` covers the canonicalised
 * subset `{ profile, revenues, expenses }`, where the last two are the **bani totals** the engine was fed —
 * not the record lists. So the digest does move when a schedule is posted, which is right: a snapshot whose
 * digest survived a change to its own figure would be worse. What it could not do was say **which asset**
 * changed it, because the register is not in the subset — two registers adding up to the same total produced
 * byte-identical records. B-109 closes that the way TASK 6 closed the rule-set case: a **sibling digest on
 * the calculation record**, `assetRegisterHash`, beside `inputsHash`, with `inputSnapshot` left exactly as
 * TASK 3 pinned it. Widening the subset would have changed every stored `inputsHash`, which is a
 * persisted-format change and needs a chain step; there is still no chain step, and the head is still v21.
 * See `docs/ai/phases/57_b109_asset_register_digest.md`.
 */
import { describe, expect, it } from 'vitest';
import { getTaxEstimate, getFinancialSummary } from './dashboard';
import { seedData } from './seed';
import type { FixedAsset, Expense } from './types';
import { lei, ron } from '../domain/money';
import { assetRegisterDigest } from '../domain/snapshots/assetRegisterDigest';
import { localDateISO, now } from '../domain/date';
import { pinClock } from '../test/clock';
import { selectEstimateOperands } from '../domain/estimateBasis';
import { selectRuleSet } from '../domain/fiscal';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../domain/fiscal/package2026';

/**
 * A synthetic asset, commented as synthetic. It is not a seed fixture: the seed declares no asset, and a
 * seeded one would assert an entry into the patrimony the demo taxpayer never made.
 *
 * The arithmetic, so the expected delta below is not a magic number: 120.000 lei, 60 months, degresiv with
 * the art. 28 alin. (7) coefficient of 1,5 for a 2–5-year duration. Cota liniară 20 %, degresivă 30 % anual
 * = 3.600.000 bani; art. 28 alin. (12) lit. a) starts with the month after *punerea în funcțiune*, so 2026
 * carries 10 months; 3.600.000 × 10/12 = **3.000.000 bani = 30.000 lei**.
 */
const SYNTHETIC_ASSET: FixedAsset = {
  id: 'asset-synthetic',
  label: 'Utilaj de test',
  entryDate: '2026-02-10',
  putInFunctionDate: '2026-02-15',
  fiscalValue: lei(120000),
  normalLifeMonths: 60,
  method: 'degresiv',
  acquisition: 'cumparare',
  paymentState: 'achitat',
  paidOn: '2026-02-11',
};

/** An asset whose facts are incomplete, so the schedule refuses and nothing is posted. */const REFUSING_ASSET: FixedAsset = {
  id: 'asset-incomplete',
  label: 'Utilaj fără durată',
  entryDate: '2026-02-10',
  putInFunctionDate: '2026-02-15',
  fiscalValue: lei(120000),
  acquisition: 'cumparare',
  paymentState: 'achitat',
  paidOn: '2026-02-11',
};

/** The hand-recorded depreciation expense that makes every computed schedule unsafe to post (B-93). */
const TYPED_DEPRECIATION: Expense = {
  id: 'exp-amortizare-tipita-impact',
  tip: 'factura',
  nr: 'Înreg-2026-0001',
  date: '2026-03-10',
  paid: '2026-03-10',
  furnizor: 'Registrul de amortizare',
  cui: 'RO00000000',
  valoareFaraTva: ron(70000),
  tva: ron(0),
  status: 'inregistrata',
  category: 'depreciation_business_asset',
};

const rulesFor = (asOf: string) => {
  const selection = selectRuleSet(seedData.profile.fiscalYear, asOf);
  return selection ? [...selection.rules] : [];
};

describe('an asset in the register now moves the estimate — B-93', () => {
  it('the seed estimate is still 311.200 bani, because the seed declares no asset', async () => {
    const asOf = pinClock().toISOString().slice(0, 10);
    const bare = await getTaxEstimate(seedData, asOf);
    expect(bare.status).toBe('computed');
    if (bare.status !== 'computed') throw new Error('the seed estimate must still compute');
    expect(bare.output.total).toBe(311_200);
  });

  it('an asset with declared facts moves the expense leg by exactly its own schedule', () => {
    const asOf = pinClock().toISOString().slice(0, 10);
    const rules = rulesFor(asOf);
    const bare = selectEstimateOperands(seedData, asOf, rules);
    const posted = selectEstimateOperands({ ...seedData, fixedAssets: [SYNTHETIC_ASSET] }, asOf, rules);
    if (bare.kind !== 'run' || posted.kind !== 'run') throw new Error('both must run');
    expect(posted.amounts.expensesNet - bare.amounts.expensesNet).toBe(lei(30000));
  });

  it('an asset whose schedule refuses moves nothing — a refusal is not a zero deduction', () => {
    const asOf = pinClock().toISOString().slice(0, 10);
    const rules = rulesFor(asOf);
    const bare = selectEstimateOperands(seedData, asOf, rules);
    const refused = selectEstimateOperands({ ...seedData, fixedAssets: [REFUSING_ASSET] }, asOf, rules);
    if (bare.kind !== 'run' || refused.kind !== 'run') throw new Error('both must run');
    expect(refused.amounts.expensesNet).toBe(bare.amounts.expensesNet);
    expect(refused.depreciation.refused).toHaveLength(1);
    expect(refused.depreciation.total).toBe(lei(0));
  });

  it('the financial summary is unchanged: it reports what was recorded, not what the law deducts', () => {
    const asOf = pinClock().toISOString().slice(0, 10);
    expect(JSON.stringify(getFinancialSummary({ ...seedData, fixedAssets: [SYNTHETIC_ASSET] }, asOf)))
      .toBe(JSON.stringify(getFinancialSummary(seedData, asOf)));
  });
});

describe('what still holds after B-93', () => {
  it('the seed declares no asset, so the seed has no depreciation to fold in', () => {
    expect(seedData.fixedAssets).toEqual([]);
  });

  it('the register is not part of the profile the snapshot canonicalises', () => {
    // The structural half of the claim. If `fixedAssets` ever moves onto the profile, every stored
    // `inputsHash` changes — which is why the register lives on `AppData` and why widening the canonicalised
    // subset is a chain step, not a one-line edit. See the header for what the digest no longer proves.
    expect('fixedAssets' in seedData.profile).toBe(false);
    expect('fixedAssets' in seedData).toBe(true);
  });

  it('the snapshot digest moves with the figure, and the register is now addressed beside it', async () => {
    const asOf = pinClock().toISOString().slice(0, 10);
    const bare = await getTaxEstimate(seedData, asOf);
    const withAsset = await getTaxEstimate({ ...seedData, fixedAssets: [SYNTHETIC_ASSET] }, asOf);
    // `snapshot` lives only on the computed member, and narrowing is itself part of the assertion: an asset
    // must not be what stops the seed profile from computing.
    if (bare.status !== 'computed' || withAsset.status !== 'computed') {
      throw new Error('the seed estimate must still compute with an asset present');
    }
    // `inputsHash` covers `{ profile, revenues, expenses }` where the last two are the **bani totals** the
    // engine was fed (`snapshots/snapshot.ts` `CreateSnapshotParams`). So the digest does move here, and
    // that is correct: a snapshot whose digest survived a change to its own figure would be worse than one
    // that records the change.
    expect(withAsset.snapshot.inputsHash).not.toBe(bare.snapshot.inputsHash);
    // What is still true — and still a gap — is that the register itself is not in the recorded subset. The
    // digest says the expense total changed; it cannot say which asset changed it. See the header.
    expect(JSON.stringify(withAsset.snapshot.inputSnapshot))
      .toBe(JSON.stringify({ ...bare.snapshot.inputSnapshot, expenses: withAsset.snapshot.inputSnapshot.expenses }));
    expect(JSON.stringify(withAsset.snapshot.inputSnapshot.profile))
      .toBe(JSON.stringify(bare.snapshot.inputSnapshot.profile));
    expect('fixedAssets' in withAsset.snapshot.inputSnapshot).toBe(false);
    // B-109: the register is still not IN the subset — and now it is still addressable, as a sibling.
    expect(withAsset.snapshot.assetRegisterHash).toMatch(/^[0-9a-f]{64}$/);
    expect(withAsset.snapshot.assetRegisterHash).not.toBe(bare.snapshot.assetRegisterHash);
    // The seed has no asset, so its record says so with a digest of the empty leg rather than a silence.
    expect(bare.snapshot.assetRegisterHash).not.toBeNull();
  });

  it('the as-of date used above is a plain calendar date', () => {
    expect(localDateISO(now())).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('the rule package this phase reads is the one already registered — no new rule, no new value', () => {
    expect(PFA_2026_SYSTEM_REAL_PACKAGE.length).toBe(54);
  });
});

/*
 * B-109 — the defect, at the production path, made unforgivable.
 *
 * Two registers that add up to the same posted total feed the engine the same expense operand, so they
 * produce the same `inputsHash`. Before B-109 the two calculation records were then indistinguishable in
 * every field that could explain the number. They no longer are.
 *
 * The arithmetic, so the equality below is not an accident: `SYNTHETIC_ASSET` is 120.000 lei over 60 months,
 * degresiv, coefficient 1,5 — 3.600.000 bani a year, 10 months in 2026, so 3.000.000 bani. One asset at
 * 240.000 lei therefore posts exactly what two assets at 120.000 lei post: 6.000.000 bani.
 */
describe('two registers, one total, one digest — and now two named records (B-109)', () => {
  it('identical inputsHash, different register: the records differ in assetRegisterHash', async () => {
    const asOf = pinClock().toISOString().slice(0, 10);
    const oneBig: FixedAsset = { ...SYNTHETIC_ASSET, id: 'asset-synthetic-big', fiscalValue: lei(240000) };
    const twoSmall: FixedAsset[] = [SYNTHETIC_ASSET, { ...SYNTHETIC_ASSET, id: 'asset-synthetic-2' }];

    const a = await getTaxEstimate({ ...seedData, fixedAssets: [oneBig] }, asOf);
    const b = await getTaxEstimate({ ...seedData, fixedAssets: twoSmall }, asOf);
    if (a.status !== 'computed' || b.status !== 'computed') {
      throw new Error('both registers must still compute');
    }
    // Same money, same figure — the two registers really are interchangeable as far as the totals go.
    expect(b.snapshot.inputSnapshot.expenses).toBe(a.snapshot.inputSnapshot.expenses);
    expect(b.output.total).toBe(a.output.total);
    expect(b.snapshot.inputsHash).toBe(a.snapshot.inputsHash);
    // And the records are no longer identical.
    expect(b.snapshot.assetRegisterHash).not.toBe(a.snapshot.assetRegisterHash);
    expect(a.snapshot.assetRegisterHash).toMatch(/^[0-9a-f]{64}$/);
    expect(b.snapshot.assetRegisterHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a withheld schedule is recorded too: the figure did not move, and the record says why', async () => {
    // A hand-recorded depreciation expense makes every computed schedule unsafe to post (B-93), so the
    // posted total is zero — the same total a register with no assets at all would post. The money cannot
    // tell those two states apart; the register digest can, and the conflict still names the asset.
    const asOf = pinClock().toISOString().slice(0, 10);
    const rules = rulesFor(asOf);
    const bare = selectEstimateOperands(seedData, asOf, rules);
    const conflicted = selectEstimateOperands(
      { ...seedData, fixedAssets: [SYNTHETIC_ASSET], expenses: [...seedData.expenses, TYPED_DEPRECIATION] },
      asOf,
      rules,
    );
    if (bare.kind !== 'run' || conflicted.kind !== 'run') throw new Error('both must run');
    // B-93's refusal, intact: nothing posted, and the asset is named.
    expect(conflicted.depreciation.total).toBe(lei(0));
    expect(bare.depreciation.total).toBe(lei(0));
    expect(conflicted.depreciation.conflicts).toHaveLength(1);
    expect(conflicted.depreciation.conflicts[0].assetId).toBe(SYNTHETIC_ASSET.id);
    expect(conflicted.depreciation.conflicts[0].label).toBe(SYNTHETIC_ASSET.label);
    expect(conflicted.depreciation.conflicts[0].withheld).toBe(lei(30000));
    // Two zero totals, two different registers, and the digest says so.
    expect(assetRegisterDigest(conflicted.depreciation)).not.toBe(assetRegisterDigest(bare.depreciation));
  });
});
