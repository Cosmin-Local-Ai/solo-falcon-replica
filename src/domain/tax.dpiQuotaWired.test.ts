/**
 * B-147 / B-150 — the recorded art. 70 gross reaches a calculator, and the art. 72 alin. (3) exception is
 * the reason that is safe to do.
 *
 * **Why these tests drive a register and not an operand.** B-147 is a defect of exactly one shape: the
 * calculator existed, the rule declared it, the function had its own green tests, and no call site ever
 * reached it. A test that hands the engine a `dpiQuotaGross` proves the engine honours an operand; it does
 * not prove a recorded document produces one. So the primary tests here start from `AppData.revenues` and go
 * through `data/dashboard.getTaxEstimate` — the same function the live page calls — and assert a contribution
 * figure at the end. `fiscal/calculatorReachability.test.ts` is the guard that keeps the wiring in place;
 * this file is the proof the wiring means money.
 *
 * **The two consequences of one flag.** `research/48` §1 reads *„one flag, two consequences”** on moștenitori,
 * drept de suită and copia privată: no flat quota (art. 72 alin. (3) / art. 72¹ alin. (2), net = gross) and
 * no CAS (art. 137 alin. (1) lit. b¹) excludes the art. 72 alin. (3) receipts from the DPI category *at the
 * definition*). Wiring the quota without the exclusion would apply a 40 % deduction the law expressly
 * withholds from those three categories — a worse defect than the silence it replaces, because a silent
 * understatement is at least not a fabricated deduction. So both halves land together or neither does, and
 * the mixed-register test below is the one that pins that.
 *
 * **The single predicate.** `domain/dpi.ts isDpiArt72Alin3Excluded` is the only place the app reads that
 * field, and `aggregation.selectYtd` is the only place that predicate cuts a set. The engine, the coverage
 * row and the withholding source all read the *result* of that one cut. Nothing downstream re-decides it —
 * that is the B-70 defect class this brief could have reintroduced.
 */
import { describe, expect, it } from 'vitest';
import { getTaxEstimate } from '../data/dashboard';
import type { AppData, Revenue } from '../data/types';
import type { PfaProfile } from './models';
import { dpiCoverageGaps, selectEstimateOperands } from './estimateBasis';
import { selectRuleSet } from './fiscal';
import { calculatorRegistry } from './fiscal/calculators';
import { PFA_2026_RELEASE } from './fiscal/release2026';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import { DPI_RULES_2026 } from './fiscal/dpi2026';
import { computeTaxEstimate } from './tax';
import type { TaxInputsReference } from './derived';
import { addBani, lei, money, type Bani } from './money';

const EXPENSES = lei(32_000);
const AI_NET = lei(72_000);

function dpiRecord(nr: string, amountLei: number, excluded = false): Revenue {
  return {
    id: `dpi-${nr}`,
    tip: 'factura',
    nr,
    date: '2026-03-10',
    client: 'Client',
    cui: '12345678',
    valoareFaraTva: money(lei(amountLei), 'RON'),
    tva: money(lei(0), 'RON'),
    status: 'inregistrata',
    incomeCategory: 'drepturi_de_proprietate_intelectuala',
    ...(excluded ? { dpiExcludedKind: 'mostenitori' as const } : {}),
  } as Revenue;
}

function register(revenues: Revenue[], over: Partial<PfaProfile> = {}): AppData {
  return {
    reservedAmount: null,
    profile: {
      id: 'p-quota',
      pfaStartYear: 2026,
      fiscalYear: 2026,
      regime: 'impozit_pe_venit',
      caen: '6201',
      salaryStatus: 'nu',
      pensionerStatus: 'nu',
      socialInsuranceStatus: 'obligatoriu',
      vatRegistration: { status: 'scutit_art310' as const },
      cashFloorLei: lei(0),
      // No ladder year answered. The typed net is the other producer, and these tests want the recorded one
      // alone so the chain is attributable.
      cassLadderYears: [],
      identity: { nume: 'x' } as never,
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...over,
    } as PfaProfile,
    revenues: [
      {
        id: 'ai-1',
        tip: 'factura',
        nr: 'AI-1',
        date: '2026-03-05',
        client: 'Client',
        cui: '12345678',
        valoareFaraTva: money(addBani(AI_NET, EXPENSES), 'RON'),
        tva: money(lei(0), 'RON'),
        status: 'inregistrata',
      },
      ...revenues,
    ],
    expenses: [
      {
        id: 'ex-1',
        tip: 'factura',
        nr: 'CH-1',
        date: '2026-03-06',
        paid: '2026-03-06',
        furnizor: 'Furnizor',
        cui: '12345678',
        valoareFaraTva: money(EXPENSES, 'RON'),
        tva: money(lei(0), 'RON'),
        status: 'inregistrata',
        category: 'rent_business_space',
      },
    ] as never,
    clients: [], filings: [], vatReturns: [], documents: [],
    occupancySheets: [], vehicles: [], fixedAssets: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] }, statements: [], snapshots: [],
    settings: {
      cotaTva: 0.19, company: { denumire: 'x', cui: '', numarRegComert: '', adresa: '', caen: [] },
      personal: { nume: 'x', cnp: '', adresa: '', telefon: '', email: '' },
      bankAccounts: [], eFactura: { trimitere: 'manual', dateContact: '' },
    },
  } as unknown as AppData;
}

const AS_OF = '2026-10-31';

const lineOf = (res: { lines: { label: string; value: Bani }[] }, prefix: string) =>
  res.lines.find((l) => l.label.startsWith(prefix));
const line = (res: { lines: { label: string; value: Bani }[] }, prefix: string) =>
  lineOf(res, prefix)?.value;

describe('B-147 — a recorded art. 70 document produces a contribution figure, not only a caption', () => {
  it('the assembler turns the recorded document into a quota-bearing gross', () => {
    const data = register([dpiRecord('DPI-1', 60_000)]);
    const rules = [...(selectRuleSet(2026, AS_OF)?.rules ?? [])];
    const ops = selectEstimateOperands(data, AS_OF, rules);
    if (ops.kind !== 'run') throw new Error(`assembler refused: ${JSON.stringify(ops.result.status)}`);
    expect(ops.amounts.dpiQuotaGross).toBe(lei(60_000));
    expect(ops.amounts.dpiExcludedGross).toBe(lei(0));
    // And it is still NOT sistem-real income: an art. 70 receipt must not run through the art. 68 expense
    // engine, which is the reason it has its own operand instead of a bump to `revenuesNet`.
    expect(ops.amounts.revenuesNet).toBe(addBani(AI_NET, EXPENSES));
  });

  it('the recorded gross, through the rule that states the quota, selects the 24-SMN CAS floor', async () => {
    const res = await getTaxEstimate(register([dpiRecord('DPI-1', 60_000)]), AS_OF);
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.reason}`);
    // 0,6 × 60.000 = 36.000 lei of net, and the line naming it cites the article that gives the quota.
    expect(line(res, 'Venit net din drepturi de proprietate intelectuală')).toBe(lei(36_000));
    expect(lineOf(res, 'Venit net din drepturi de proprietate intelectuală')!.label).toContain('art. 72 alin. (2)');
    // 72.000 lei of art. 67 net + 36.000 lei of computed DPI net = 108.000 lei, over 24 SMN (97.200).
    expect(line(res, 'Venit cumulat pentru CAS')).toBe(addBani(AI_NET, lei(36_000)));
    expect(line(res, 'CAS (25%)')).toBe(lei(24_300));
    // The art. 151 alin. (6) source is the DPI net alone — 36.000 lei is under 12 SMN (48.600), so the
    // payer withholds nothing and the whole CAS falls due. This is the second limb B-112 stage 4 opened,
    // now fed by a recorded document instead of a typed amount.
    expect(line(res, 'CAS reținută la sursă')).toBe(lei(0));
    expect(line(res, 'CAS de plătit')).toBe(lei(24_300));
    // And the art. 170 alin. (1) CASS base is the art. 67 net alone: DPI is not that article's subject.
    expect(line(res, 'Venit cumulat pentru CASS')).toBe(AI_NET);
  });

  it('the engine reads `determinedNet`; it does not apply a percentage of its own', async () => {
    // The load-bearing claim of B-147 is not "the quota is right" — the calculator was always right. It is
    // that the engine obtains the net FROM the rule's calculator. Cross-checked against the calculator
    // itself, on the same rule, so a composition that quietly re-derived 0,6 would fail here even if the
    // arithmetic happened to agree.
    const gross = lei(60_000);
    const quotaRule = DPI_RULES_2026.find((r) => r.taxRegime === 'dpi-flat-quota');
    if (quotaRule === undefined) throw new Error('the DPI package no longer declares a dpi-flat-quota rule');
    const direct = calculatorRegistry['calc-dpi-flat-quota'](quotaRule, { gross });
    if ('reviewRequired' in direct) throw new Error('calculator refused');
    expect(typeof direct.determinedNet).toBe('number');
    const res = await getTaxEstimate(register([dpiRecord('DPI-1', 60_000)]), AS_OF);
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.reason}`);
    expect(line(res, 'Venit net din drepturi de proprietate intelectuală')).toBe(direct.determinedNet as Bani);
  });

  it('a register with no DPI document produces no DPI line and no refusal', async () => {
    const res = await getTaxEstimate(register([]), AS_OF);
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.reason}`);
    expect(lineOf(res, 'Venit net din drepturi de proprietate intelectuală')).toBeUndefined();
    expect(lineOf(res, 'Venit brut din drepturi de proprietate intelectuală')).toBeUndefined();
    expect(line(res, 'CAS (25%)')).toBe(lei(12_150));
  });

  it('a DPI gross with no art. 72 rule in the package refuses rather than inventing a percentage', async () => {
    // The year-scoping reason this block resolves the rule by lookup instead of hard-wiring a ruleId, stated
    // in `tax.ts` since B-112 stage 2 and never tested until the path existed. `PFA_2026_SYSTEM_REAL_PACKAGE`
    // (v5) carries no `dpi-flat-quota` rule: a fiscal year with no art. 72 rule must not compute a DPI gross
    // under 2026 percentages it was never handed.
    const res = await computeTaxEstimate({
      inputs: {
        regime: 'impozit_pe_venit', salaryStatus: 'nu', salaryIncomeLei: null, pensionerStatus: 'nu',
        pensionReceiptYears: [], pensionSuspensionYears: [], cassPreviousYearContext: null,
        foreignSicknessInsurance: null, cassLadderYears: [], socialInsuranceStatus: 'obligatoriu',
        vatRegistration: { status: 'scutit_art310' as const }, cashFloorLei: lei(0), fiscalYear: 2026,
        pfaStartDate: null, inputsKey: 'p-quota:2026',
      } as TaxInputsReference,
      profile: { id: 'p-quota', regime: 'impozit_pe_venit', fiscalYear: 2026, socialInsuranceStatus: 'obligatoriu' } as PfaProfile,
      revenues: addBani(AI_NET, EXPENSES), expenses: EXPENSES,
      revenuesNet: addBani(AI_NET, EXPENSES), expensesNet: EXPENSES,
      expenseBase: { netFirst: EXPENSES, grossFirst: EXPENSES, divergent: false },
      flatRatioGross: null, flatRatioMethod: null,
      dpiQuotaGross: lei(60_000), dpiExcludedGross: null,
      ruleRelease: PFA_2026_RELEASE, rules: PFA_2026_SYSTEM_REAL_PACKAGE as never,
    });
    if (res.status !== 'review_required') throw new Error(`expected a refusal, got ${res.status}`);
    expect(res.reason).toContain('art. 72');
    // And the refusal is a refusal, not a silent zero: no contribution line is offered.
    expect(res.lines.filter((l) => l.label.startsWith('CAS')).length).toBe(0);
  });
});

describe('B-150 — art. 72 alin. (3): no quota AND no CAS, from one flag read once', () => {
  it('consequence one: a moștenitori / drept de suită / copia privată receipt gets no flat quota', () => {
    const data = register([dpiRecord('DPI-M', 60_000, true)]);
    const rules = [...(selectRuleSet(2026, AS_OF)?.rules ?? [])];
    const ops = selectEstimateOperands(data, AS_OF, rules);
    if (ops.kind !== 'run') throw new Error('assembler refused');
    // The gross is still known — the receipt happened — but it is filed on the no-quota side of the split.
    expect(ops.amounts.dpiExcludedGross).toBe(lei(60_000));
    expect(ops.amounts.dpiQuotaGross).toBe(lei(0));
  });

  it('consequence two: the same receipt never enters the art. 148 alin. (3) CAS cumul', async () => {
    const res = await getTaxEstimate(register([dpiRecord('DPI-M', 60_000, true)]), AS_OF);
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.reason}`);
    // art. 137 alin. (1) lit. b¹) reads „venituri din drepturi de proprietate intelectuală, definite la
    // art. 70, cu excepția veniturilor prevăzute la art. 72 alin. (3)”. The exclusion is at the definition of
    // the category, so the amount is outside the cumul — not deducted from it.
    expect(lineOf(res, 'Venit cumulat pentru CAS')).toBeUndefined();
    expect(line(res, 'CAS (25%)')).toBe(lei(12_150));
    // It is disclosed rather than dropped: the line says the quota was withheld and that CAS does not see it.
    expect(line(res, 'Venit din DPI fără cotă forfetară')).toBe(lei(60_000));
    expect(lineOf(res, 'Venit din DPI fără cotă forfetară')!.label).toContain('art. 72 alin. (3)');
    expect(lineOf(res, 'Venit din DPI fără cotă forfetară')!.label).toContain('exclus din CAS');
  });

  it('a mixed register applies the quota to one receipt and withholds it from the other', async () => {
    // The test that keeps B-147 and B-150 from being separable. With the quota wired and the exception
    // missing, this register would deduct 40 % from 100.000 lei of gross; the law withholds that deduction
    // from 40.000 of it, and a deduction the law does not give is not a conservative estimate — it is a
    // fabricated one.
    const data = register([dpiRecord('DPI-1', 60_000), dpiRecord('DPI-M', 40_000, true)]);
    const res = await getTaxEstimate(data, AS_OF);
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.reason}`);
    // Only the 60.000 lei carries a quota: net 36.000. The 40.000 lei is outside CAS entirely.
    expect(line(res, 'Venit net din drepturi de proprietate intelectuală')).toBe(lei(36_000));
    expect(line(res, 'Venit cumulat pentru CAS')).toBe(addBani(AI_NET, lei(36_000)));
    expect(line(res, 'Venit din DPI fără cotă forfetară')).toBe(lei(40_000));
    expect(line(res, 'CAS (25%)')).toBe(lei(24_300));
    // Had the exception been missing, the cumul would have been 72.000 + 0,6 × 100.000 = 132.000 lei — a
    // different CAS base, and a CAS deduction the statute does not authorise for those three categories.
    expect(line(res, 'Venit cumulat pentru CAS')).not.toBe(addBani(AI_NET, lei(60_000)));
  });

  it('the coverage row now names which limb is fed and which is not', () => {
    // B-147 fed the CAS limb. The art. 170 alin. (4) CASS ladder is still not fed from records, and the row
    // that tells the person about the DPI income has to say so — a row that still claims neither path exists
    // would be a false disclosure after this brief, which is B-106's class. Read off the producer, which is
    // the same call `data/dashboard.ts` makes when it assembles the coverage list.
    const data = register([dpiRecord('DPI-1', 60_000)]);
    const rules = [...(selectRuleSet(2026, AS_OF)?.rules ?? [])];
    const row = dpiCoverageGaps(data, AS_OF, rules).find((g) => g.reason === 'dpi_income_not_modelled');
    expect(row).toBeDefined();
    expect(row!.detail).toContain('art. 148 alin. (3)');
    expect(row!.detail).toContain('ACUM');
    expect(row!.detail).toContain('art. 170 alin. (4) lit. c)');
    expect(row!.detail).toContain('CE NU ALIMENTEAZĂ ÎNCĂ');
    // And the amount is still the gross, because the row is about a document, not about the derived net.
    expect(row!.amount).toBe(lei(60_000));
  });
});
