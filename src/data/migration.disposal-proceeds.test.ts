import { describe, expect, it } from 'vitest';
import {
  fixedAssetSchema,
  parseAppDataResult,
  type PersistedAppData,
} from './schema';
import {
  CURRENT_DATA_VERSION,
  DATA_VERSION_EXPENSE_ASSET_LINK,
  DATA_VERSION_DISPOSAL_PROCEEDS,
  migratePersistedData,
} from './migration';
import { seedData } from './seed';
import { lei } from '../domain/money';

/**
 * B-65 (carried from brief 74) — `FixedAsset.disposalProceeds` opens at v23→v24, and the step fills in nothing.
 *
 * Two provisions cap the same number. Titlul II norm pct. 27 caps the unamortised residual of an M1 taken out
 * of the register at 1.500 lei × the months left of the duration the taxpayer declared. Titlul IV norm pct. 7
 * alin. (5) lit. o) caps **that same residual a second time**, „la nivelul venitului realizat din
 * înstrăinare" — the proceeds. Brief 74 implemented the first, surfaced it as a coverage row, and deliberately
 * did not post it, because nothing in the app held the second: posting pct. 27's figure would over-deduct
 * every time the asset sold for less than it was still worth, which is the ordinary case.
 *
 * The property this file guards is that the step opens the fact without inventing it. A sale price is a fact
 * about a transaction; no stored field records one, and deriving it from the fiscal value, from the residual
 * or from the declared duration would mint the very number the norm measures the deduction against. Absence is
 * not zero either — it means the second limit exists and cannot be measured, which is a different statement
 * from „the asset sold for nothing".
 *
 * And what this step does NOT settle, pinned rather than implied: **B-153 stays open.** The schedule keeps
 * amortising past the month of the *scoatere din gestiune* while `disposalFigure` counts only the months
 * actually used, so the residual this field caps is measured off a month count the posted schedule does not
 * match. The reported figure is the correct ceiling; it is still not a deductible amount.
 */

/** A disposed M1, in the shape a **v23** payload stored it: no `disposalProceeds` key at all. */
const PRE_STEP_ASSET = {
  id: 'asset-m1-v23',
  label: 'Autoturism de test',
  entryDate: '2025-12-10',
  putInFunctionDate: '2025-12-31',
  fiscalValue: lei(120000),
  normalLifeMonths: 48,
  method: 'liniar',
  acquisition: 'cumparare',
  paymentState: 'achitat',
  isM1Vehicle: true,
  disposedOn: '2027-12-31',
  disposalKind: 'vanzare',
};

/**
 * A payload as a **v23 install** stored it — the shape immediately before this step. One rung behind, with the
 * e-Factura preference already retired and the expense link already opened, so the fixture tests this step
 * rather than the three before it.
 */
function payloadAtV23(overrides: Record<string, unknown> = {}): PersistedAppData {
  return {
    version: DATA_VERSION_EXPENSE_ASSET_LINK,
    profile: seedData.profile,
    revenues: seedData.revenues,
    expenses: seedData.expenses,
    clients: seedData.clients,
    documents: seedData.documents,
    companyDocs: seedData.companyDocs,
    statements: seedData.statements,
    snapshots: seedData.snapshots,
    settings: seedData.settings,
    reservedAmount: null,
    fixedAssets: [PRE_STEP_ASSET],
    ...overrides,
  } as unknown as PersistedAppData;
}

describe('B-65 — the `fixed-asset-disposal-proceeds` step (v23 → v24)', () => {
  it('is present at exactly this edge, appended and never renumbered', () => {
    const outcome = migratePersistedData(payloadAtV23());
    expect(outcome.fromVersion).toBe(DATA_VERSION_EXPENSE_ASSET_LINK);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    expect(outcome.stepsApplied).toEqual(['fixed-asset-disposal-proceeds']);
    expect(CURRENT_DATA_VERSION).toBe(DATA_VERSION_DISPOSAL_PROCEEDS);
  });

  it('backfills nothing: a v23 asset still has no `disposalProceeds` after the whole chain ran', () => {
    const parsed = parseAppDataResult(JSON.stringify(payloadAtV23()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const outcome = migratePersistedData(parsed.data);
    const asset = outcome.data.fixedAssets!.find(a => a.id === 'asset-m1-v23')!;
    // Absence stays absence. A zero would be a sale for nothing — a much lower ceiling, and a fact the
    // taxpayer never recorded.
    expect('disposalProceeds' in asset).toBe(false);
    // The disposal facts that DO exist are untouched: the step opens a field, it does not reinterpret a sale.
    expect(asset.disposedOn).toBe('2027-12-31');
    expect(asset.disposalKind).toBe('vanzare');
  });

  it('keeps every asset it did, and gains no key anywhere', () => {
    const before = payloadAtV23();
    const outcome = migratePersistedData(before);
    expect(outcome.data.fixedAssets!.map(a => a.id)).toEqual(before.fixedAssets!.map(a => a.id));
    expect(outcome.data.fixedAssets![0]!.fiscalValue).toBe(lei(120000));
    expect(outcome.data.fixedAssets![0]!.normalLifeMonths).toBe(48);
    expect(Object.keys(outcome.data).sort()).toEqual(Object.keys(before).sort());
  });

  it('a payload that already records a price keeps it, which is what makes the step a no-op and not a wipe', () => {
    const priced = { ...PRE_STEP_ASSET, disposalProceeds: lei(20000) };
    const parsed = parseAppDataResult(JSON.stringify(payloadAtV23({ fixedAssets: [priced] })));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const outcome = migratePersistedData(parsed.data);
    expect(outcome.data.fixedAssets![0]!.disposalProceeds).toBe(lei(20000));
    expect(migratePersistedData(outcome.data).stepsApplied).toEqual([]);
  });

  it('the load gate declares the field, so zod cannot strip a price the person entered', () => {
    // The standing reason every optional field is declared here: zod strips undeclared keys. An undeclared
    // price would be erased on the next save-and-load and the second ceiling would silently stop being
    // measured — the exact state brief 74 stopped at, arrived at by accident instead of by decision.
    const parsed = fixedAssetSchema.safeParse({ ...PRE_STEP_ASSET, disposalProceeds: 2000000 });
    expect(parsed.success).toBe(true);
    expect((parsed as { data: { disposalProceeds?: number } }).data.disposalProceeds).toBe(2000000);
    // And nil is a recorded fact, not an absence: zero must survive the gate as zero.
    const nil = fixedAssetSchema.safeParse({ ...PRE_STEP_ASSET, disposalProceeds: 0 });
    expect(nil.success).toBe(true);
    expect((nil as { data: { disposalProceeds?: number } }).data.disposalProceeds).toBe(0);
  });
});
