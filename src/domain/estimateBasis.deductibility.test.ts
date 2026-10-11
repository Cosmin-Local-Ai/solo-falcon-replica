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
  selectDeductibleExpenses,
  selectEstimateOperands,
} from './estimateBasis';
import { estimateRefusalReason } from './scenarios';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal';
import { seedData } from '../data/seed';
import type { AppData, Expense } from '../data/types';
import { lei, ron } from './money';

const AS_OF_YEAR_END = '2026-12-31';

function expense(over: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    tip: 'factura',
    nr: 'FCT-TEST-1',
    date: '2026-06-10',
    furnizor: 'Furnizor Test',
    cui: 'RO00000000',
    valoareFaraTva: ron(1000),
    tva: ron(190),
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
      expense({ id: 'a', category: 'postal_and_telecom', valoareFaraTva: ron(1000), tva: ron(190) }),
      expense({ id: 'b', category: 'rent_business_space', valoareFaraTva: ron(500), tva: ron(95) }),
      expense({ id: 'c', category: 'postal_and_telecom', valoareFaraTva: ron(200), tva: ron(38) }),
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
    expect(set.records[0].valoareFaraTva).toEqual(ron(500)); // 1.000,00 x 50 %
    expect(set.records[0].tva).toEqual(ron(95)); // 190,00 x 50 %
    const line = set.lines[0];
    expect(line.treatment).toBe('capped');
    expect(line.cap).toMatchObject({ percent: 50, base: 'expense_itself' });
    expect(line.cap?.baseArticle).toBe('art. 68 alin. (7) lit. k)');
  });

  it('a cap is a ceiling: the fractional ban is floored, never rounded up', () => {
    // 10,01 lei = 1.001 bani; 50 % is 500,5 bani. Rounding up would deduct more than the law allows.
    const set = assemble([expense({ category: 'vehicle_related', valoareFaraTva: ron(10.01), tva: ron(0) })]);
    expect(set.records[0].valoareFaraTva).toEqual(ron(5)); // 500 bani, not 501
  });

  it('capping does not rewrite the stored record — the capped entry is a copy', () => {
    const e = expense({ id: 'orig', category: 'vehicle_related' });
    const set = assemble([e]);
    expect(e.valoareFaraTva).toEqual(ron(1000));
    expect(set.records[0]).not.toBe(e);
    expect(set.records[0].id).toBe('orig');
  });

  it('an annual cap the law fully determines is held for the assembler’s second pass, not excluded (TASK 2c)', () => {
    // TASK 2b pinned this OUT, and that was correct while no base existed: `counts.capUnresolved` was 1,
    // `excluded[0].reason` was 'cap_unresolved' and its detail named 'art68_alin6_base'. TASK 2c strikes
    // the base in `selectEstimateOperands`, so at THIS stage the category is neither entered nor excluded
    // — it is held. `records` stays empty (it must not enter unbounded) and `excluded` becomes empty.
    const set = assemble([expense({ category: 'protocol' })]);
    expect(set.records).toHaveLength(0);      // unchanged: not entered before the ceiling is struck
    expect(set.excluded).toHaveLength(0);     // was 1 — no longer an exclusion
    expect(set.counts.capUnresolved).toBe(0); // was 1
    expect(set.counts.annualCapped).toBe(1);  // new bucket
    expect(set.annualCapped).toHaveLength(1);
    expect(set.annualCapped[0]).toMatchObject({
      category: 'protocol',
      ruleId: 'EXPENSE_PROTOCOL_2026',
      count: 1,
      exclVat: lei(1000), // 1.000,00 lei claimed, before any ceiling
      inclVat: lei(1190), // 1.000,00 + 190,00 lei
    });
    expect(set.annualCapped[0].cap).toMatchObject({ percent: 2, base: 'art68_alin6_base' });
    // The unresolved reading of alin. (6) travels with the line, so the number it produces can never be
    // presented as settled law (research 22 §6).
    expect(set.annualCapped[0].conflict).toContain('nicio normă nu prescrie o ordine');
  });

  it('a euro-denominated annual cap stays unresolved, and names the datum AND the rule that is missing', () => {
    const set = assemble([expense({ category: 'private_pension_contribution', date: '2026-03-15' })]);
    expect(set.records).toHaveLength(0);
    expect(set.annualCapped).toHaveLength(0);
    expect(set.counts.capUnresolved).toBe(1);
    expect(set.excluded[0].ruleId).toBe('EXPENSE_PRIVATE_PENSION_2026');
    expect(set.excluded[0].detail).toContain('annual_eur_per_person');
    // TASK 2c acceptance: the missing fact is the DATUM and the RULE, not a vague "not implemented".
    expect(set.excluded[0].detail).toContain('nu stochează niciun curs BNR');
    expect(set.excluded[0].detail).toContain('pct. 7 alin. (6)');
    expect(set.excluded[0].detail).toContain('cursul mediu comunicat de Banca Națională a României');
    expect(set.excluded[0].detail).toContain('art. 9 alin. (3) lit. b)');
  });

  it('cheltuieli sociale stays unresolved: no payroll datum is not the same as a zero ceiling', () => {
    // research 22 §4: the ceiling is 5 % of „valoarea anuală a cheltuielilor efectuate cu salariile
    // personalului", and with no personnel that base is arithmetically 0 — but the app holds no payroll
    // concept at all, so it cannot assert the taxpayer HAS no personnel. "No data" is not "no employees".
    const set = assemble([expense({ category: 'social_expenses' })]);
    expect(set.records).toHaveLength(0);
    expect(set.annualCapped).toHaveLength(0);
    expect(set.counts.capUnresolved).toBe(1);
    expect(set.excluded[0].ruleId).toBe('EXPENSE_SOCIAL_EXPENSES_2026');
    expect(set.excluded[0].detail).toContain('annual_salary_expense');
    expect(set.excluded[0].detail).toContain('nu are niciun concept de pontaj');
    expect(set.excluded[0].detail).toContain('nu este declarat 0');
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
    // art. 68 alin. (4) lit. b) attributes by year of payment; g^1)/g^2)/s) bind only from 2026-03-01
    // (OUG 8/2026 art. 10 alin. (10) for g^1)/g^2), art. 10 alin. (7) for s).
    const before = assemble([expense({ id: 'ian', category: 'pepp_contribution', date: '2026-01-15' })]);
    expect(before.counts.undetermined).toBe(1);
    const after = assemble([
      expense({ id: 'mar', category: 'pepp_contribution', date: '2026-01-15', paid: '2026-03-15' }),
    ]);
    // Same issue date, different payment date: the rule is now in force, so the category is capped —
    // and an annual euro cap has no rate to strike it with, so it is still excluded, but for a
    // different reason.
    expect(after.counts.undetermined).toBe(0);
    expect(after.counts.capUnresolved).toBe(1);
  });

  it('lit. s) ETF turns on the same 2026-03-01 payment date, through the assembler too', () => {
    const jan = assemble([expense({ id: 'ian', category: 'etf_purchase', date: '2026-01-20' })]);
    expect(jan.counts.undetermined).toBe(1);
    expect(jan.counts.capUnresolved).toBe(0);
    const mar = assemble([expense({ id: 'mar', category: 'etf_purchase', date: '2026-01-20', paid: '2026-03-02' })]);
    expect(mar.counts.undetermined).toBe(0);
    expect(mar.counts.capUnresolved).toBe(1);
    expect(mar.excluded[0].ruleId).toBe('EXPENSE_ETF_PURCHASE_2026');
  });
});

describe('selectEstimateOperands — one assembler, feeding both selectors the same subset', () => {
  it('the engine is fed the DEDUCTIBLE subset, not the recorded total', () => {
    // PG-5C re-premise of a TASK 2b assertion. The test's point was never the multiplier — it was that
    // the assembler applies the art. 68 subset to the records BEFORE aggregation, so the quantity the
    // engine sees and the quantity the basis reports come from one set. With the grossing-up removed the
    // assertion is sharper, not weaker: 1.000,00 lei deductible goes in, 6.000,00 lei recorded does not.
    //
    // Before: amounts.expensesNet was lei(2107.14) — the deductible 1.000,00 lei multiplied by 354/168,
    // the run rate over an 11 13/31-month active period. That figure was not money anyone paid.
    const operands = selectEstimateOperands(
      dataWith([
        expense({ id: 'deduct', category: 'postal_and_telecom', valoareFaraTva: ron(1000), tva: ron(190) }),
        expense({ id: 'not', category: 'donation', valoareFaraTva: ron(5000), tva: ron(950) }),
      ]),
      '2026-06-30',
      PFA_2026_SYSTEM_REAL_PACKAGE,
    );
    if (operands.kind !== 'run') throw new Error('expected the estimate to run');
    // If the subset were applied only to the YTD argument, `amounts.expensesNet` would be the recorded
    // 6.000,00 lei while `actual.expensesNet` said 1.000,00 — the drift this assembler exists to make
    // impossible. Both are now the same number, which is the whole guarantee.
    expect(operands.basis.actual.expensesNet).toBe(lei(1000));
    expect(operands.amounts.expensesNet).toBe(lei(1000));
    expect(operands.amounts.expenses).toBe(lei(1190)); // 1.000 + 190 TVA — the VAT-inclusive measure
    expect(operands.amounts.expensesNet).not.toBe(lei(6000));
    expect(operands.deductible.records).toHaveLength(1);
  });

  it('an uncategorised payload — the migrated-data case — contributes nothing to the base', () => {
    const operands = selectEstimateOperands(
      dataWith([expense({ valoareFaraTva: ron(5000), tva: ron(950) })]),
      AS_OF_YEAR_END,
      PFA_2026_SYSTEM_REAL_PACKAGE,
    );
    if (operands.kind !== 'run') throw new Error('expected the estimate to run');
    expect(operands.amounts.expensesNet).toBe(lei(0));
    expect(operands.deductible.counts.undetermined).toBe(1);
  });

  it('art. 68^3 cazare still refuses the estimate instead of computing one (defect B-29)', () => {
    // PG-6h-1 re-premised this test rather than deleting it. The estimate is still refused and still
    // refuses to produce a plausible number — what changed is WHICH answer stops it. `no-expense-engine`
    // said this build had no method for the activity; the flat-ratio method now exists, so that sentence
    // would be false for FY2026. The stop is now the gross: art. 68^3 alin. (3) leaves the platform-
    // commission scope open and alin. (1) puts the eligibility gate in tourism law.
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
    expect(operands.result.reason).toContain('art. 68^3');
    expect(operands.deductible.records).toHaveLength(0);
    // The basis says nothing was computed — it does not pretend the operands were zero.
    expect(operands.basis.kind).toBe('refused');
    expect(estimateFigureLabel(operands.basis)).toBe('Nu putem calcula');
    // The classifier's own refusal is still produced and still says the art. 68 expense engine does not
    // apply — that is what the expense register shows, and PG-6h-1 did not change it.
    expect(estimateRefusalReason(operands.deductible.refusal!)).toContain('EXPENSE_ENGINE_CAZARE_2026');
    // PG-6a — the refusal is the registry's answer, not a branch of this function. The scenario id and
    // its fix route travel on the basis, so the hero can name the case and link to what settles it.
    if (operands.basis.kind !== 'refused') return;
    expect(operands.basis.scenario.id).toBe('accommodation-gross-undetermined');
    expect(operands.basis.scenario.effect).toBe('refuse');
    expect(operands.basis.scenario.fixTarget).toEqual({ page: 'settings', tab: 'fiscal' });
    // PG-6h-2b (B-85) — the attribution refusal now fires on the same payload, because a cazare register
    // cannot say which of its receipts the flat method applies to. It is the SECOND refusal, not a second
    // mechanism: the surfaced one stays the gross question, which is registry order doing its job.
    expect(operands.scenarios.map(s => s.id)).toEqual([
      'accommodation-gross-undetermined',
      'accommodation-method-attribution-missing',
    ]);
  });

  it('with no flat-ratio rule selected, the missing expense engine is itself the stop', () => {
    // The other half of the same line: `no-expense-engine` was not deleted, it was scoped. Where the rule
    // set offers no art. 68^3 method, "this package does not implement the method" is still the truth and
    // still the answer the app gives.
    const withoutFlatRatio = PFA_2026_SYSTEM_REAL_PACKAGE.filter(
      (r) => r.taxRegime !== 'accommodation-flat-ratio',
    );
    const operands = selectEstimateOperands(
      dataWith([expense({ category: 'postal_and_telecom' })]),
      AS_OF_YEAR_END,
      withoutFlatRatio,
      { activityFamily: 'cazare' },
    );
    expect(operands.kind).toBe('refused');
    if (operands.kind !== 'refused') return;
    if (operands.result.status !== 'review_required') return;
    expect(operands.result.reason).toContain('EXPENSE_ENGINE_CAZARE_2026');
    if (operands.basis.kind !== 'refused') return;
    expect(operands.basis.scenario.id).toBe('no-expense-engine');
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
