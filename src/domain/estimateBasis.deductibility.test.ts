/**
 * TASK 2b — the deductible subset, assembled in `estimateBasis.ts`.
 *
 * These tests are the acceptance criteria for "taxable income is no longer all expenses":
 * every expense that reaches the engine has a deterministic treatment and a rule behind it, and
 * everything that does not reach it is counted and explained rather than silently dropped.
 *
 * They run against the real 2026 rule package, not a stub: the point is that the RULES decide, so a
 * fixture with a hand-written treatment would prove nothing.
 */
import { describe, expect, it } from 'vitest';
import {
  estimateFigureLabel,
  estimateRefusalReason,
  selectDeductibleExpenses,
  selectEstimateOperands,
} from './estimateBasis';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal';
import { seedData } from '../data/seed';
import type { AppData, Expense } from '../data/types';
import { lei } from './money';

const AS_OF_YEAR_END = '2026-12-31';

function expense(over: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    tip: 'factura',
    nr: 'FCT-TEST-1',
    date: '2026-06-10',
    furnizor: 'Furnizor Test',
    cui: 'RO00000000',
    valoareFaraTva: lei(1000),
    tva: lei(190),
    status: 'inregistrata',
    ...over,
  };
}

function dataWith(expenses: Expense[]): AppData {
  return { ...seedData, expenses };
}

function assemble(expenses: Expense[], asOfDate = AS_OF_YEAR_END) {
  return selectDeductibleExpenses(dataWith(expenses), asOfDate, PFA_2026_SYSTEM_REAL_PACKAGE);
}

describe('selectDeductibleExpenses — the law decides, the record only states', () => {
  it('an uncategorised expense never enters the deductible total, and says which fact is missing', () => {
    const set = assemble([expense()]);
    expect(set.records).toHaveLength(0);
    expect(set.counts.undetermined).toBe(1);
    expect(set.counts.entered).toBe(0);
    expect(set.excluded).toHaveLength(1);
    expect(set.excluded[0]).toMatchObject({
      id: 'exp-1',
      category: null,
      reason: 'undetermined',
      ruleId: null,
    });
    // The missing fact is named, not swallowed — this is the string the one action surfaces.
    expect(set.excluded[0].detail).toContain('no category');
  });

  it('a category the 2026 rules do not cover is undetermined, never deductible by silence', () => {
    // art. 68 alin. (7) lit. l) is an open clause; TASK 2a deliberately did not encode it, so an
    // uncited token must not be treated as deductible.
    const set = assemble([expense({ category: 'home_office_shared_cost' })]);
    expect(set.records).toHaveLength(0);
    expect(set.counts.undetermined).toBe(1);
    expect(set.excluded[0].ruleId).toBe('EXPENSE_HOME_OFFICE_SHARED_2026');
    expect(set.excluded[0].detail).toContain('aferentă activității');
  });

  it('an express non-deductible category is excluded and names the litera that disqualifies it', () => {
    const set = assemble([expense({ category: 'donation' })]);
    expect(set.records).toHaveLength(0);
    expect(set.counts.nonDeductible).toBe(1);
    expect(set.excluded[0]).toMatchObject({
      reason: 'non_deductible',
      ruleId: 'EXPENSE_DONATION_2026',
    });
    expect(set.excluded[0].sourceArticle).toContain('art. 68 alin. (7) lit. e)');
  });

  it('the deductible total is explainable per category, each line carrying the rule that justified it', () => {
    const set = assemble([
      expense({ id: 'a', category: 'postal_and_telecom', valoareFaraTva: lei(1000), tva: lei(190) }),
      expense({ id: 'b', category: 'rent_business_space', valoareFaraTva: lei(500), tva: lei(95) }),
      expense({ id: 'c', category: 'postal_and_telecom', valoareFaraTva: lei(200), tva: lei(38) }),
    ]);
    expect(set.counts.entered).toBe(3);
    expect(set.lines).toHaveLength(2); // sorted by category: postal_and_telecom, rent_business_space
    const postal = set.lines.find((l) => l.category === 'postal_and_telecom')!;
    // 1.000,00 + 200,00 net; 1.190,00 + 238,00 incl VAT.
    expect(postal).toMatchObject({
      count: 2,
      ruleId: 'EXPENSE_POSTAL_TELECOM_2026',
      treatment: 'deductible',
    });
    expect(postal.exclVat).toBe(lei(1200));
    expect(postal.inclVat).toBe(lei(1428));
    const rent = set.lines.find((l) => l.category === 'rent_business_space')!;
    expect(rent.ruleId).toBe('EXPENSE_RENT_BUSINESS_SPACE_2026');
    expect(rent.exclVat).toBe(lei(500));
  });

  it('the per-expense 50 % vehicle cap is applied to the record, from art. 68 alin. (7) lit. k)', () => {
    // No `vehicleUse` fact is held anywhere, and the statutory default is 50 % — `unknown` behaves
    // like `mixed`, never like `exclusive`.
    const set = assemble([expense({ category: 'vehicle_related' })]);
    expect(set.records).toHaveLength(1);
    expect(set.records[0].valoareFaraTva).toBe(lei(500)); // 1.000,00 x 50 %
    expect(set.records[0].tva).toBe(lei(95)); // 190,00 x 50 %
    const line = set.lines[0];
    expect(line.treatment).toBe('capped');
    expect(line.cap).toMatchObject({ percent: 50, base: 'expense_itself' });
    expect(line.cap?.baseArticle).toBe('art. 68 alin. (7) lit. k)');
  });

  it('a cap is a ceiling: the fractional ban is floored, never rounded up', () => {
    // 10,01 lei = 1.001 bani; 50 % is 500,5 bani. Rounding up would deduct more than the law allows.
    const set = assemble([expense({ category: 'vehicle_related', valoareFaraTva: lei(10.01), tva: lei(0) })]);
    expect(set.records[0].valoareFaraTva).toBe(lei(5)); // 500 bani, not 501
  });

  it('capping does not rewrite the stored record — the capped entry is a copy', () => {
    const e = expense({ id: 'orig', category: 'vehicle_related' });
    const set = assemble([e]);
    expect(e.valoareFaraTva).toBe(lei(1000));
    expect(set.records[0]).not.toBe(e);
    expect(set.records[0].id).toBe('orig');
  });

  it('an annual cap is NOT computed here: the category is excluded and counted for TASK 2c', () => {
    // art. 68 alin. (6) defines the protocol cap base as gross minus deductible expenses OTHER THAN
    // protocol and private scholarships — the base depends on a total that must itself exclude the
    // category being capped. Computing it here would need a deductible total that does not exist yet.
    const set = assemble([expense({ category: 'protocol' })]);
    expect(set.records).toHaveLength(0);
    expect(set.counts.capUnresolved).toBe(1);
    expect(set.excluded[0]).toMatchObject({
      reason: 'cap_unresolved',
      ruleId: 'EXPENSE_PROTOCOL_2026',
    });
    expect(set.excluded[0].detail).toContain('art68_alin6_base');
  });

  it('a euro-denominated annual cap is unresolved for the same reason — no rate, no year aggregate', () => {
    const set = assemble([expense({ category: 'private_pension_contribution', date: '2026-03-15' })]);
    expect(set.records).toHaveLength(0);
    expect(set.counts.capUnresolved).toBe(1);
    expect(set.excluded[0].ruleId).toBe('EXPENSE_PRIVATE_PENSION_2026');
    expect(set.excluded[0].detail).toContain('annual_eur_per_person');
  });

  it('the period and status filter is the aggregate’s, so the count is not a different population', () => {
    const set = assemble(
      [
        expense({ id: 'out-of-year', date: '2025-06-10' }), // previous fiscal year
        expense({ id: 'after-as-of', date: '2026-07-05' }), // after the inclusive asOf cut
        expense({ id: 'rejected', date: '2026-06-10', status: 'respinsa' }), // never aggregated
        expense({ id: 'in', date: '2026-06-10' }),
      ],
      '2026-06-30',
    );
    expect(set.excluded).toHaveLength(1);
    expect(set.excluded[0].id).toBe('in');
  });

  it('the classification date is the PAYMENT date, and the OUG 8/2026 letters turn on it', () => {
    // art. 68 alin. (4) lit. b) attributes by year of payment; g^1)/g^2) bind only from 2026-03-01
    // (OUG 8/2026 art. 10 alin. (10): contribuții plătite începând cu 1 martie 2026).
    const before = assemble([expense({ id: 'ian', category: 'pepp_contribution', date: '2026-01-15' })]);
    expect(before.counts.undetermined).toBe(1);
    const after = assemble([
      expense({ id: 'mar', category: 'pepp_contribution', date: '2026-01-15', paid: '2026-03-15' }),
    ]);
    // Same issue date, different payment date: the rule is now in force, so the category is capped —
    // and an annual euro cap is TASK 2c, so it is still excluded, but for a different reason.
    expect(after.counts.undetermined).toBe(0);
    expect(after.counts.capUnresolved).toBe(1);
  });
});

describe('selectEstimateOperands — one assembler, feeding both selectors the same subset', () => {
  it('the projection annualises the DEDUCTIBLE subset, not the recorded total', () => {
    // 2026-06-30 -> 6 elapsed months -> x 2.
    const operands = selectEstimateOperands(
      dataWith([
        expense({ id: 'deduct', category: 'postal_and_telecom', valoareFaraTva: lei(1000), tva: lei(190) }),
        expense({ id: 'not', category: 'donation', valoareFaraTva: lei(5000), tva: lei(950) }),
      ]),
      '2026-06-30',
      PFA_2026_SYSTEM_REAL_PACKAGE,
    );
    if (operands.kind !== 'run') throw new Error('expected the estimate to run');
    // If the subset were applied only to the YTD argument, `expensesNet` here would be
    // (1.000 + 5.000) x 2 = 12.000 lei while `actual.expensesNet` said 1.000 — the drift this
    // assembler exists to make impossible.
    expect(operands.basis.actual.expensesNet).toBe(lei(1000));
    expect(operands.amounts.expensesNet).toBe(lei(2000));
    expect(operands.amounts.expenses).toBe(lei(2380)); // (1.000 + 190) x 2
    expect(operands.deductible.records).toHaveLength(1);
  });

  it('an uncategorised payload — the migrated-data case — contributes nothing to the base', () => {
    const operands = selectEstimateOperands(
      dataWith([expense({ valoareFaraTva: lei(5000), tva: lei(950) })]),
      AS_OF_YEAR_END,
      PFA_2026_SYSTEM_REAL_PACKAGE,
    );
    if (operands.kind !== 'run') throw new Error('expected the estimate to run');
    expect(operands.amounts.expensesNet).toBe(lei(0));
    expect(operands.deductible.counts.undetermined).toBe(1);
  });

  it('art. 68^3 cazare refuses the estimate instead of computing one (defect B-29)', () => {
    const operands = selectEstimateOperands(
      dataWith([expense({ category: 'postal_and_telecom' })]),
      AS_OF_YEAR_END,
      PFA_2026_SYSTEM_REAL_PACKAGE,
      { activityFamily: 'cazare' },
    );
    expect(operands.kind).toBe('refused');
    if (operands.kind !== 'refused') return;
    // A plausible number here would be a failure, not a result.
    expect(operands.result.status).toBe('review_required');
    if (operands.result.status !== 'review_required') return;
    expect(operands.result.reason).toContain('EXPENSE_ENGINE_CAZARE_2026');
    expect(operands.result.reason).toContain('art. 68^3');
    expect(operands.deductible.records).toHaveLength(0);
    // The basis says nothing was computed — it does not pretend the operands were zero.
    expect(operands.basis.kind).toBe('refused');
    expect(estimateFigureLabel(operands.basis)).toBe('Estimare impozit (calculată nu s-a făcut)');
    expect(estimateRefusalReason(operands.deductible.refusal!)).toContain(
      'nu lasă niciun motor de cheltuieli',
    );
  });

  it('without the cazare fact the engine still runs — the app holds no activity-family fact and invents none', () => {
    const operands = selectEstimateOperands(
      dataWith([expense({ category: 'postal_and_telecom' })]),
      AS_OF_YEAR_END,
      PFA_2026_SYSTEM_REAL_PACKAGE,
    );
    expect(operands.kind).toBe('run');
  });
});
