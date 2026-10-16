/**
 * PG-6e acceptance 2 — **a capital purchase is still never a direct expense.**
 *
 * This file exists because the phase adds depreciation arithmetic, and arithmetic next to a register is
 * exactly where the old mistake would come back: someone computes 70.000 lei of amortisation for a laptop
 * and, seeing the laptop in the same screen, deducts the 350.000 lei too. art. 68 alin. (7) lit. h) keeps
 * „cheltuielile de dobândire a bunurilor și drepturilor amortizabile” out of the deductible set, and the
 * only route by which a capital asset reaches the expense side is the *depreciation* of a business asset
 * under art. 68 alin. (4) lit. d).
 *
 * The three classification rules that carry this are **correct as they stand** — `research/36` §5.1 records
 * that the brief's premise about art. 68 alin. (7) lit. k¹) was inverted, and the code already had it
 * right. The last test pins their treatment and citation so a later phase cannot quietly re-purpose
 * k¹) into an allowance.
 */
import { describe, expect, it } from 'vitest';
import { lei, ron } from '../money';
import { seedData } from '../../data/seed';
import type { Expense } from '../../data/types';
import { selectDeductibleExpenses } from '../estimateBasis';
import { sumBani } from '../money';
import { classifyExpenseDeductibility } from './deductibility';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';
import { depreciationSchedule, FISCAL_DEPRECIATION_RULE_ID, type FixedAssetFacts } from './depreciation';

const RULES = PFA_2026_SYSTEM_REAL_PACKAGE;
const AS_OF = '2026-12-15';
const depreciationRule = RULES.find((r) => r.ruleId === FISCAL_DEPRECIATION_RULE_ID)!;

/** The pct. 25 asset, used here as a laptop rather than as the norms' abstract „bun”. */
const laptop: Expense = {
  id: 'exp-laptop',
  tip: 'factura',
  nr: 'F-2026-0001',
  date: '2026-03-10',
  paid: '2026-03-11',
  furnizor: 'Furnizor IT',
  cui: 'RO12345678',
  valoareFaraTva: ron(350000),
  tva: ron(0),
  status: 'inregistrata',
  category: 'depreciable_asset_purchase',
};

/** The same asset's first year of amortisation — the only figure of the two that can be deducted. */
const firstYearDepreciation: Expense = {
  ...laptop,
  id: 'exp-amortizare',
  nr: 'Înreg-2026-0001',
  date: '2026-12-10',
  paid: '2026-12-10',
  category: 'depreciation_business_asset',
  valoareFaraTva: ron(70000),
};

describe('a capital purchase is never a direct expense, only its depreciation is', () => {
  const data = {
    ...seedData,
    expenses: [laptop, firstYearDepreciation],
  };
  const set = selectDeductibleExpenses(data, AS_OF, RULES);

  it('the 350.000-lei purchase is excluded from the deductible set', () => {
    const ids = set.records.map((e) => e.id);
    expect(ids).not.toContain('exp-laptop');
    const excluded = set.excluded.find((e) => e.id === 'exp-laptop');
    expect(excluded, 'the purchase must be excluded by name, not merely absent').toBeDefined();
    expect(excluded!.sourceArticle).toContain('art. 68 alin. (7) lit. h)');
  });

  it('the 70.000-lei depreciation is in the deductible set', () => {
    const ids = set.records.map((e) => e.id);
    expect(ids).toContain('exp-amortizare');
  });

  it('the classifier cites art. 68 alin. (7) lit. h) for the purchase and alin. (4) lit. d) for the depreciation', () => {
    const purchase = classifyExpenseDeductibility(
      { category: 'depreciable_asset_purchase' },
      RULES,
      { taxYear: 2026, asOfDate: AS_OF },
    );
    expect(purchase.status === 'classified' && purchase.treatment).toBe('non_deductible');
    if (purchase.status !== 'classified') throw new Error('expected a classification');
    expect(purchase.rule.sourceArticle).toContain('art. 68 alin. (7) lit. h)');

    const depreciation = classifyExpenseDeductibility(
      { category: 'depreciation_business_asset' },
      RULES,
      { taxYear: 2026, asOfDate: AS_OF },
    );
    expect(depreciation.status === 'classified' && depreciation.treatment).toBe('deductible');
    if (depreciation.status !== 'classified') throw new Error('expected a classification');
    expect(depreciation.rule.sourceArticle).toContain('art. 68 alin. (4) lit. d)');
  });

  it('the schedule for the laptop sums to the purchase price, so the price re-enters only as amortisation', () => {
    const asset: FixedAssetFacts = {
      label: 'Laptop de lucru',
      entryDate: '2025-12-10',
      putInFunctionDate: '2025-12-31',
      fiscalValue: lei(350000),
      normalLifeMonths: 120,
      method: 'degresiv',
      acquisition: 'cumparare',
      paymentState: 'achitat',
      paidOn: '2025-12-11',
    };
    const out = depreciationSchedule(depreciationRule, asset);
    if (out.status !== 'computed') throw new Error('expected a computed schedule');
    // pct. 25's first year, which is the figure the deductible expense above carries.
    expect(out.years[0]!.uncapped).toBe(lei(70000));
    // And the whole schedule is the price, spread over the duration — never more than it.
    const total = sumBani(out.years.map(y => y.uncapped));
    expect(total).toBe(lei(350000));
  });
});

describe('the three depreciation-adjacent classification rules are unchanged by this phase', () => {
  const byId = (id: string) => RULES.find((r) => r.ruleId === id)!;

  it('art. 68 alin. (7) lit. k^1) stays an EXCLUSION — the brief had it inverted, the code did not', () => {
    const rule = byId('EXPENSE_DEPRECIATION_PERSONAL_PATRIMONY_2026');
    const r = classifyExpenseDeductibility(
      { category: 'depreciation_personal_patrimony' },
      RULES,
      { taxYear: 2026, asOfDate: AS_OF },
    );
    expect(r.status === 'classified' && r.treatment).toBe('non_deductible');
    expect(rule.sourceArticle).toContain('art. 68 alin. (7) lit. k');
  });

  it('a capital purchase stays non_deductible, and a business depreciation stays deductible', () => {
    expect(byId('EXPENSE_DEPRECIABLE_ASSET_PURCHASE_2026').sourceArticle).toContain('lit. h)');
    expect(byId('EXPENSE_DEPRECIATION_BUSINESS_ASSET_2026').sourceArticle).toContain('alin. (4) lit. d)');
  });
});
