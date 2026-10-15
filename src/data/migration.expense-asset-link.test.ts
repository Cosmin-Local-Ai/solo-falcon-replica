import { describe, expect, it } from 'vitest';
import {
  expenseSchema,
  parseAppDataResult,
  type PersistedAppData,
} from './schema';
import {
  CURRENT_DATA_VERSION,
  DATA_VERSION_EFACTURA_DEADLINE,
  DATA_VERSION_EXPENSE_ASSET_LINK,
  migratePersistedData,
} from './migration';
import { seedData } from './seed';
import { lei, ron } from '../domain/money';
import type { Expense } from './types';

/**
 * B-108 — `Expense.assetId` opens at v22→v23, and the step fills in nothing.
 *
 * The field exists because a refusal is currently broader than the truth. There are two routes to the
 * expense side of one capital asset — the schedule the fixed-asset register computes, and a hand-typed
 * `depreciation_business_asset` expense — and art. 68 alin. (4) lit. d) is the provision that connects them.
 * With no link on the expense the app cannot say which asset a typed line covers, so it withholds **every**
 * schedule as soon as **one** typed expense exists: one hand-typed line silences the schedules of assets it
 * has nothing to do with.
 *
 * The property this file guards is the one that separates this step from a helpful one: **it attributes
 * nothing.** Matching a line to an asset by amount, by date or by supplier is the inference that was already
 * rejected as one art. 68 alin. (4) lit. d) does not license, and that rejection stands. A backfilled link
 * would narrow the refusal on a fiction, which is worse than a refusal that says it is broad.
 *
 * The pre-step payload is a real one: a v22 install, with expenses in the shape a v22 install stored them
 * (bani, currency-tagged, `assetId` never written). Brief 67's finding is the reason the shape matters — a
 * step tested only against the current schema cannot see what the step would have done to the data that
 * actually exists.
 */

/** A hand-recorded depreciation expense, in the shape a **v22** payload stored it: no `assetId` key at all. */
const PRE_STEP_EXPENSE = {
  id: 'exp-amortizare-v22',
  tip: 'factura',
  nr: 'Înreg-2026-0001',
  date: '2026-12-10',
  paid: '2026-12-10',
  furnizor: 'Registrul de amortizare',
  cui: 'RO00000000',
  valoareFaraTva: ron(70000),
  tva: ron(0),
  status: 'inregistrata',
  category: 'depreciation_business_asset',
} satisfies Omit<Expense, 'assetId'>;

/**
 * A payload as a **v22 install** stored it — the shape immediately before this step. It carries a fixed
 * asset, a typed depreciation expense with no link, and the retired e-Factura preference already dropped by
 * v22, so the fixture is one rung behind and not two.
 */
function payloadAtV22(overrides: Record<string, unknown> = {}): PersistedAppData {
  return {
    version: DATA_VERSION_EFACTURA_DEADLINE,
    profile: seedData.profile,
    revenues: seedData.revenues,
    expenses: [...seedData.expenses, PRE_STEP_EXPENSE as Expense],
    clients: seedData.clients,
    documents: seedData.documents,
    companyDocs: seedData.companyDocs,
    statements: seedData.statements,
    snapshots: seedData.snapshots,
    settings: seedData.settings,
    reservedAmount: null,
    fixedAssets: [
      {
        id: 'asset-laptop',
        label: 'Laptop de lucru',
        entryDate: '2026-02-10',
        putInFunctionDate: '2026-02-15',
        fiscalValue: lei(120000),
        normalLifeMonths: 60,
        method: 'liniar',
        acquisition: 'cumparare',
      },
    ],
    ...overrides,
  } as unknown as PersistedAppData;
}

describe('B-108 — the `expense-asset-link` step (v22 → v23)', () => {
  it('is present at exactly this edge, appended and never renumbered', () => {
    const step = (name: string) => name;
    const chain = migratePersistedData(payloadAtV22());
    expect(chain.fromVersion).toBe(DATA_VERSION_EFACTURA_DEADLINE);
    expect(chain.toVersion).toBe(CURRENT_DATA_VERSION);
    expect(chain.stepsApplied).toEqual([step('expense-asset-link')]);
    expect(CURRENT_DATA_VERSION).toBe(DATA_VERSION_EXPENSE_ASSET_LINK);
  });

  it('backfills nothing: a v22 expense still has no `assetId` after the whole chain ran', () => {
    const parsed = parseAppDataResult(JSON.stringify(payloadAtV22()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const outcome = migratePersistedData(parsed.data);
    const typed = outcome.data.expenses!.find(e => e.id === 'exp-amortizare-v22')!;
    // Absence survives as absence. A `0`, an empty string or a guessed id would each be a fact the person
    // never recorded, and a guessed id would additionally narrow a refusal on a fiction.
    expect('assetId' in typed).toBe(false);
    // And every other expense in the register is in the same state.
    for (const e of outcome.data.expenses!) expect('assetId' in e).toBe(false);
  });

  it('keeps every record it did: ids, amounts and the category token are untouched', () => {
    const before = payloadAtV22();
    const outcome = migratePersistedData(before);
    expect(outcome.data.expenses!.map(e => e.id)).toEqual(before.expenses!.map(e => e.id));
    expect(outcome.data.expenses!.map(e => e.valoareFaraTva.amount)).toEqual(
      before.expenses!.map(e => e.valoareFaraTva.amount),
    );
    expect(outcome.data.expenses!.map(e => e.category)).toEqual(
      before.expenses!.map(e => e.category),
    );
    // The fixed-asset register rides through untouched — this step opens a field on the OTHER collection.
    expect(outcome.data.fixedAssets).toBe(before.fixedAssets);
    // Nothing else in the payload gained or lost a key.
    expect(Object.keys(outcome.data).sort()).toEqual(Object.keys(before).sort());
  });

  it('a payload that already carries a link keeps it, which is what makes the step a no-op and not a wipe', () => {
    const linked = {
      ...PRE_STEP_EXPENSE,
      assetId: 'asset-laptop',
    };
    const payload = payloadAtV22({
      expenses: [...seedData.expenses, linked as Expense],
    });
    const parsed = parseAppDataResult(JSON.stringify(payload));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const outcome = migratePersistedData(parsed.data);
    const typed = outcome.data.expenses!.find(e => e.id === 'exp-amortizare-v22')!;
    // Identity, not just equality: the record is not rebuilt.
    expect(typed.assetId).toBe('asset-laptop');
    expect(migratePersistedData(outcome.data).stepsApplied).toEqual([]);
  });

  it('the load gate declares `assetId`, so zod cannot strip a link the person made', () => {
    // The standing reason every optional field is declared in this schema: zod strips undeclared keys. An
    // undeclared `assetId` would be erased on the next save-and-load and the depreciation conflict would
    // silently widen back to register-wide, undoing the one thing the person did.
    const parsed = expenseSchema.safeParse({ ...PRE_STEP_EXPENSE, assetId: 'asset-laptop' });
    expect(parsed.success).toBe(true);
    expect((parsed as { data: { assetId?: string } }).data.assetId).toBe('asset-laptop');
    // And an id pointing at a deleted asset is still accepted rather than quarantining the payload — the
    // house rule for a dangling link is "report it, do not repair it", and quarantining would be worse.
    expect(expenseSchema.safeParse({ ...PRE_STEP_EXPENSE, assetId: 'asset-gone' }).success).toBe(true);
  });
});
