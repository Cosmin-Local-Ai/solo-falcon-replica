/**
 * PG-6e acceptance 9 — an asset in the register moves **no** fiscal figure.
 *
 * This is the same proof PG-6h-3 ran for the occupancy sheet, and it is the load-bearing one for a phase
 * that adds arithmetic. The depreciation figures this phase computes are **not** wired into the estimate:
 * a depreciation expense reaches the deductible set only when the taxpayer records one under
 * `depreciation_business_asset`, exactly as before. Adding an asset to the register therefore has to leave
 * every stored digest and every computed figure exactly where it was. If it does not, one of two things
 * has happened, and both are defects this phase forbids:
 *
 *  - the asset entered `inputSnapshot.profile`, and so every stored `inputsHash` — which is why
 *    `fixedAssets` lives on `AppData` and never on the profile (`data/types.ts` records the mechanism:
 *    `snapshots/snapshot.ts` canonicalises `{ profile, revenues, expenses }`); or
 *  - the engine started computing depreciation on its own from a fact the taxpayer never entered as an
 *    expense, which would be an inference from the register to the expense side that art. 68 alin. (4)
 *    lit. d) does not license.
 *
 * The seed's published figure — **311.200 bani** — is asserted by name, because it is the number the
 * brief's baseline names.
 */
import { describe, expect, it } from 'vitest';
import { getTaxEstimate, getFinancialSummary } from './dashboard';
import { seedData } from './seed';
import type { FixedAsset } from './types';
import { lei } from '../domain/money';
import { localDateISO, now } from '../domain/date';
import { pinClock } from '../test/clock';

/**
 * A synthetic asset, commented as synthetic. It is not a seed fixture: the seed declares no asset, and a
 * seeded one would assert an entry into the patrimony the demo taxpayer never made.
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

describe('an asset in the register moves no fiscal figure', () => {
  it('the seed estimate is byte-identical with an asset present, and still 311.200 bani', async () => {
    const asOf = pinClock().toISOString().slice(0, 10);
    const bare = await getTaxEstimate(seedData, asOf);
    const withAsset = await getTaxEstimate(
      { ...seedData, fixedAssets: [SYNTHETIC_ASSET] },
      asOf,
    );

    // `TaxEstimateWithBasis` is a union: only the computed member carries the figures. Narrowing is also
    // the assertion — the seed profile must still compute, and an asset must not be what stops it.
    expect(bare.status).toBe('computed');
    expect(withAsset.status).toBe('computed');
    if (bare.status !== 'computed' || withAsset.status !== 'computed') {
      throw new Error('the seed estimate stopped computing — an asset must not change that');
    }

    // Compared on the fiscal payload, not the whole snapshot: `calculationId` carries a random UUID, so a
    // full-object comparison would fail for a reason unrelated to this boundary.
    expect(JSON.stringify(withAsset.lines)).toBe(JSON.stringify(bare.lines));
    expect(JSON.stringify(withAsset.output)).toBe(JSON.stringify(bare.output));
    expect(JSON.stringify(withAsset.bases)).toBe(JSON.stringify(bare.bases));
    expect(JSON.stringify(withAsset.basis)).toBe(JSON.stringify(bare.basis));

    // The digest is the strongest form of the claim: the bytes the calculation ran on did not change.
    expect(withAsset.snapshot.inputsHash).toBe(bare.snapshot.inputsHash);
    expect(JSON.stringify(withAsset.snapshot.inputSnapshot))
      .toBe(JSON.stringify(bare.snapshot.inputSnapshot));

    // The seed's published figure itself.
    expect(withAsset.output.total).toBe(bare.output.total);
    expect(bare.output.total).toBe(311_200);

    expect(JSON.stringify(getFinancialSummary({ ...seedData, fixedAssets: [SYNTHETIC_ASSET] }, asOf)))
      .toBe(JSON.stringify(getFinancialSummary(seedData, asOf)));
  });

  it('the seed declares no asset, so the estimate has no depreciation to fold in', () => {
    expect(seedData.fixedAssets).toEqual([]);
  });

  it('the register is not part of the profile the snapshot canonicalises', () => {
    // The structural half of the same claim: if `fixedAssets` ever moves onto the profile, the digest test
    // above stops being a proof and becomes a coincidence. This pins where the key lives.
    expect('fixedAssets' in seedData.profile).toBe(false);
    expect('fixedAssets' in seedData).toBe(true);
  });

  it('the as-of date used above is a plain calendar date', () => {
    expect(localDateISO(now())).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
