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
 * ⚠️ One thing the digest does not prove, stated here rather than discovered later. `inputsHash` covers the
 * canonicalised subset `{ profile, revenues, expenses }`, where the last two are the **bani totals** the
 * engine was fed — not the record lists. So the digest does move when a schedule is posted, which is right:
 * a snapshot whose digest survived a change to its own figure would be worse. What it cannot do is say
 * **which asset** changed it, because the register is not in the subset. A stored snapshot's recorded inputs
 * therefore no longer enumerate everything that produced its outputs. Widening the canonicalised subset
 * would change every stored `inputsHash`, which is a persisted-format change and needs a chain step; B-93's
 * brief forbids one, and the estimate is derived state. The gap is recorded in
 * `docs/ai/phases/55_b93_post_the_depreciation.md` rather than closed silently here.
 */
import { describe, expect, it } from 'vitest';
import { getTaxEstimate, getFinancialSummary } from './dashboard';
import { seedData } from './seed';
import type { FixedAsset } from './types';
import { lei } from '../domain/money';
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

/** An asset whose facts are incomplete, so the schedule refuses and nothing is posted. */
const REFUSING_ASSET: FixedAsset = {
  id: 'asset-incomplete',
  label: 'Utilaj fără durată',
  entryDate: '2026-02-10',
  putInFunctionDate: '2026-02-15',
  fiscalValue: lei(120000),
  acquisition: 'cumparare',
  paymentState: 'achitat',
  paidOn: '2026-02-11',
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

  it('the snapshot digest moves with the figure, but the register is still not among the recorded inputs', async () => {
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
  });

  it('the as-of date used above is a plain calendar date', () => {
    expect(localDateISO(now())).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('the rule package this phase reads is the one already registered — no new rule, no new value', () => {
    expect(PFA_2026_SYSTEM_REAL_PACKAGE.length).toBe(54);
  });
});
