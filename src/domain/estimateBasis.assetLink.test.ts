/**
 * B-108 — a linked expense narrows the depreciation conflict; an unlinked one still says it is register-wide.
 *
 * `selectAssetDepreciation` used to have one shape for the refusal: any typed `depreciation_business_asset`
 * expense in the period withheld every computed schedule in the register. That was honest — the app could not
 * say what the typed line covered — and it was broader than the truth, because it silenced assets the typed
 * line had nothing to do with.
 *
 * `Expense.assetId` is the only thing that may narrow it, and it is the person's own statement, never a
 * derivation. These tests pin the three states that now exist and must not collapse into one another:
 *
 * 1. **No typed expense** — every schedule posts.
 * 2. **A typed expense that names an asset** — that asset's schedule is withheld, the others post, and the
 *    conflict row says the link is the person's, not the app's guess.
 * 3. **A typed expense that names nothing** — every schedule is withheld, exactly as before, and the row says
 *    the app cannot tell what the line covers and tells the person how to narrow it.
 *
 * Plus the fourth state a link makes possible and nobody asked for: an `assetId` naming an asset the register
 * no longer holds. It withholds nothing — there is no schedule behind it — and it is reported rather than
 * quietly folded into "no conflict".
 */
import { describe, expect, it } from 'vitest';
import { lei, ron } from '../domain/money';
import { seedData } from '../data/seed';
import type { Expense, FixedAsset } from '../data/types';
import { depreciationCoverageGaps, selectAssetDepreciation } from '../domain/estimateBasis';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../domain/fiscal/package2026';

const RULES = PFA_2026_SYSTEM_REAL_PACKAGE;
const AS_OF = '2026-12-31';

/**
 * Two unrelated assets, both with a full schedule for 2026.
 *
 * 120.000 lei over 60 months, liniară, put in function in February 2026: 24.000 lei/an, and art. 28 alin.
 * (12) lit. a) starts amortisation with the month after *punerea în funcțiune*, so 2026 carries ten months
 * (Martie–Decembrie) = 20.000 lei = 2.000.000 bani each. Neither is an M1, so neither meets the art. 28
 * alin. (14) ceiling and the figures below are the uncapped ones — which is what makes them easy to read.
 */
const LAPTOP: FixedAsset = {
  id: 'asset-laptop',
  label: 'Laptop de lucru',
  entryDate: '2026-02-10',
  putInFunctionDate: '2026-02-15',
  fiscalValue: lei(120000),
  normalLifeMonths: 60,
  method: 'liniar',
  acquisition: 'cumparare',
  paymentState: 'achitat',
};
const MONITOR: FixedAsset = {
  id: 'asset-monitor',
  label: 'Monitor de lucru',
  entryDate: '2026-02-10',
  putInFunctionDate: '2026-02-15',
  fiscalValue: lei(120000),
  normalLifeMonths: 60,
  method: 'liniar',
  acquisition: 'cumparare',
  paymentState: 'achitat',
};

const typed = (id: string, assetId?: string): Expense => ({
  id,
  tip: 'factura',
  nr: `Înreg-${id}`,
  date: '2026-12-10',
  paid: '2026-12-10',
  furnizor: 'Registrul de amortizare',
  cui: 'RO00000000',
  valoareFaraTva: ron(70000),
  tva: ron(0),
  status: 'inregistrata',
  category: 'depreciation_business_asset',
  ...(assetId === undefined ? {} : { assetId }),
});

const withRegister = (assets: FixedAsset[], expenses: Expense[]) => ({
  ...seedData,
  fixedAssets: assets,
  expenses: [...seedData.expenses, ...expenses],
});

const BOTH = [LAPTOP, MONITOR];

describe('B-108 — the conflict narrows only on a link the person made', () => {
  it('no typed depreciation expense: both schedules post', () => {
    const leg = selectAssetDepreciation(withRegister(BOTH, []), AS_OF, RULES);
    expect(leg.conflicts).toEqual([]);
    expect(leg.lines.map(l => l.assetId).sort()).toEqual(['asset-laptop', 'asset-monitor']);
    expect(leg.total).toBe(lei(40000));
  });

  it('a typed expense that NAMES an asset withholds that asset alone', () => {
    const leg = selectAssetDepreciation(
      withRegister(BOTH, [typed('exp-1', 'asset-laptop')]),
      AS_OF,
      RULES,
    );
    expect(leg.conflicts).toHaveLength(1);
    expect(leg.conflicts[0]!.assetId).toBe('asset-laptop');
    expect(leg.conflicts[0]!.scope).toBe('asset');
    expect(leg.conflicts[0]!.expenseIds).toEqual(['exp-1']);
    expect(leg.conflicts[0]!.withheld).toBe(lei(20000));
    // The unrelated asset is not collateral damage any more. This is the whole of B-108.
    expect(leg.lines.map(l => l.assetId)).toEqual(['asset-monitor']);
    expect(leg.total).toBe(lei(20000));
  });

  it('a typed expense that names NOTHING still withholds every schedule, and says why', () => {
    const leg = selectAssetDepreciation(withRegister(BOTH, [typed('exp-2')]), AS_OF, RULES);
    expect(leg.conflicts).toHaveLength(2);
    for (const c of leg.conflicts) {
      expect(c.scope).toBe('register-wide');
      expect(c.expenseIds).toEqual(['exp-2']);
    }
    expect(leg.lines).toEqual([]);
    expect(leg.total).toBe(0);
  });

  it('one unlinked expense among linked ones keeps the refusal register-wide', () => {
    // The narrowing is not a majority vote. As long as any typed line in the period names no asset, the app
    // cannot say that any particular schedule is safe on top of it, so it withholds all of them — the same
    // honest breadth as before the field existed.
    const leg = selectAssetDepreciation(
      withRegister(BOTH, [typed('exp-3', 'asset-laptop'), typed('exp-4')]),
      AS_OF,
      RULES,
    );
    expect(leg.conflicts).toHaveLength(2);
    for (const c of leg.conflicts) expect(c.scope).toBe('register-wide');
    // Register-wide names the whole typed set, including the line that did name something.
    expect(leg.conflicts[0]!.expenseIds.sort()).toEqual(['exp-3', 'exp-4']);
    expect(leg.lines).toEqual([]);
  });

  it('the coverage row for a per-asset conflict does not read like a register-wide one', () => {
    // Printing the register-wide sentence over a per-asset collision would tell the person to delete an
    // expense that conflicts with exactly one asset, and the fix for that one is to leave the others alone.
    const narrow = depreciationCoverageGaps(
      selectAssetDepreciation(withRegister(BOTH, [typed('exp-5', 'asset-laptop')]), AS_OF, RULES),
    ).find(g => g.reason === 'depreciation_conflict')!;
    const wide = depreciationCoverageGaps(
      selectAssetDepreciation(withRegister(BOTH, [typed('exp-6')]), AS_OF, RULES),
    ).find(g => g.reason === 'depreciation_conflict')!;

    expect(narrow.detail).toContain('este legătura pe care');
    expect(narrow.detail).not.toContain('până când această legătură există, niciun plan din registru nu este postat');
    expect(wide.detail).toContain('până când această legătură există, niciun plan din registru nu este postat');
    expect(wide.detail).toContain('Fă legătura pe cheltuială');
  });

  it('a link naming an asset the register no longer holds withholds nothing and is reported', () => {
    const leg = selectAssetDepreciation(withRegister(BOTH, [typed('exp-7', 'asset-gone')]), AS_OF, RULES);
    // No schedule is silenced: there is no schedule behind the link.
    expect(leg.conflicts).toEqual([]);
    expect(leg.lines.map(l => l.assetId).sort()).toEqual(['asset-laptop', 'asset-monitor']);
    // And it is not silently "no conflict" either.
    expect(leg.danglingLinks).toEqual([{ expenseId: 'exp-7', assetId: 'asset-gone' }]);
    const row = depreciationCoverageGaps(leg).find(g => g.recordId === 'expense:exp-7:asset-link');
    expect(row).toBeDefined();
    expect(row!.detail).toContain('nu mai este în registru');
    expect(row!.detail).toContain('nu repară legătura');
  });

  it('a typed expense outside the period narrows nothing, linked or not', () => {
    // The period filter is the same one the deductible set uses; a line paid in 2027 is not in this year and
    // cannot collide with this year's schedule whether or not it names an asset.
    const outside = { ...typed('exp-8', 'asset-laptop'), paid: '2027-01-04', date: '2027-01-04' };
    const leg = selectAssetDepreciation(withRegister(BOTH, [outside]), AS_OF, RULES);
    expect(leg.conflicts).toEqual([]);
    expect(leg.danglingLinks).toEqual([]);
    expect(leg.total).toBe(lei(40000));
  });
});
