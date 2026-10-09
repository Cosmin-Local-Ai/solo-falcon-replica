import { describe, expect, it } from 'vitest';
import type { AppData, Expense, Revenue, SettingsState } from '../data/types';
import type { PfaIdentity, PfaProfile } from './models';
import { selectProjectionV1 } from './projection';
import { lei, money, ron, type Bani } from './money'

function identity(): PfaIdentity {
  return {
    nume: 'Test SRL',
    cnp: '',
    adresa: 'Str. Test 1',
    telefon: '0700000000',
    email: 'test@example.com',
    denumire: 'Test SRL',
    cui: '12345678',
    formaJuridica: 'SRL',
    numarRegComert: 'J40/123/2026',
    adresaSocietate: 'Str. Test 1',
    telefonSocietate: '0700000000',
    emailSocietate: 'test@example.com',
    contBancar: 'RO49BANK1234',
    banca: 'Test Bank',
  };
}

function profile(fiscalYear = 2026): PfaProfile {
  return {
    id: 'profile-test',
    pfaStartYear: 2026,
    fiscalYear,
    regime: 'impozit_pe_venit',
    caen: '6201',
    salaryStatus: 'nu',
    pensionerStatus: 'nu',
    otherIncome: [],
    socialInsuranceStatus: 'obligatoriu',
    vatExempt: false,
    cashFloorLei: lei(0),
    identity: identity(),
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const emptySettings: SettingsState = {
  cotaTva: 0.19,
  company: { denumire: 'Test SRL', cui: '12345678', numarRegComert: 'J40/123/2026', adresa: 'Str. Test 1', caen: [] },
  personal: { nume: 'Test', cnp: '', adresa: 'Str. Test 1', telefon: '0700000000', email: 'test@example.com' },
  bankAccounts: [],
  eFactura: { trimitere: 'manual', dateContact: '' },
};

function makeData(overrides: Partial<AppData> = {}): AppData {
  return {
    reservedAmount: null,
    profile: profile(),
    revenues: [],
    expenses: [],
    clients: [],
    declarations: [],
    documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] },
    statements: [],
    snapshots: [],
    settings: emptySettings,
    ...overrides,
  };
}

function revenue(date: string, valoareFaraTva: Bani, tva: Bani, status: Revenue['status'] = 'inregistrata'): Revenue {
  return {
    id: `rev-${date}-${valoareFaraTva}`,
    tip: 'factura',
    nr: '1',
    date,
    client: 'Client Test',
    cui: '12345678',
    // TASK 10a: plain bani in, RON money on the record — call sites and figures unchanged.
    valoareFaraTva: money(valoareFaraTva, 'RON'),
    tva: money(tva, 'RON'),
    status,
  };
}

function expense(date: string, valoareFaraTva: Bani, tva: Bani, status: Expense['status'] = 'inregistrata'): Expense {
  return {
    id: `exp-${date}-${valoareFaraTva}`,
    tip: 'factura',
    nr: '1',
    date,
    furnizor: 'Furnizor Test',
    cui: '87654321',
    valoareFaraTva: money(valoareFaraTva, 'RON'),
    tva: money(tva, 'RON'),
    status,
  };
}

// YTD (asOfDate 2026-09-15, 9 elapsed months):
// revenue: lei(357) + 714 = 1071  → run rate 119/month
// expenses: lei(90)        → run rate 10/month
// net: lei(981)            → run rate 109/month
function midYearData(): AppData {
  return makeData({
    revenues: [
      revenue('2026-03-10', lei(300), lei(57)),
      revenue('2026-06-20', lei(600), lei(114)),
    ],
    expenses: [expense('2026-04-15', lei(71), lei(19))],
  });
}

describe('selectProjectionV1', () => {
  it('reports the actual period and method', () => {
    const p = selectProjectionV1(midYearData(), '2026-09-15');
    expect(p.method).toBe('run-rate-v1');
    expect(p.periodActual).toEqual({ from: '2026-01-01', to: '2026-09-15' });
  });

  it('computes run rate as YTD totals / elapsed months (inclusive fraction)', () => {
    const p = selectProjectionV1(midYearData(), '2026-09-15');
    // elapsed = 8 full months + 15/30 = 8.5
    expect(p.elapsedMonths).toBe(8.5);
    expect(p.runRate.revenuePerMonth).toBe(lei(126)); // 1071 / 8.5
    // A run rate is NOT money: it is an unbranded FRACTIONAL BANI figure, so it is 100x the lei
    // number and may legitimately keep fractions. It can never reach formatBani*() or persistence.
    expect(p.runRate.expensesPerMonth).toBeCloseTo(18_000 / 17, 10); // 9 000 bani / 8.5
    expect(p.runRate.netPerMonth).toBeCloseTo(196_200 / 17, 10); // 98 100 bani / 8.5
  });

  it('computes annual projection as run rate x 12', () => {
    const p = selectProjectionV1(midYearData(), '2026-09-15');
    expect(p.annualProjected.revenue).toBe(lei(1512)); // 126 * 12
    // annualProjected IS money, so it is a whole number of bani: 12 705.88 -> 12 706.
    expect(p.annualProjected.expenses).toBeCloseTo(216_000 / 17, 0); // (18 000/17) * 12
    // net is DERIVED from the two rounded figures (151 200 - 12 706), never rounded on its own.
    expect(p.annualProjected.net).toBe(151_200 - 12_706);
  });

  it('builds a 12-month series with the correct actual/projected split', () => {
    const p = selectProjectionV1(midYearData(), '2026-09-15');
    expect(p.series).toHaveLength(12);
    expect(p.series.map((m) => m.month)).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
      '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
    ]);
    expect(p.series.slice(0, 9).every((m) => m.kind === 'actual')).toBe(true);
    expect(p.series.slice(9).every((m) => m.kind === 'projected')).toBe(true);
  });

  it('uses real values for actual months and run-rate values for projected months', () => {
    const p = selectProjectionV1(midYearData(), '2026-09-15');
    expect(p.series[2]).toEqual({ month: '2026-03', revenue: lei(357), expenses: lei(0), net: lei(357), kind: 'actual' });
    expect(p.series[3]).toEqual({ month: '2026-04', revenue: lei(0), expenses: lei(90), net: lei(-90), kind: 'actual' });
    expect(p.series[8]).toEqual({ month: '2026-09', revenue: lei(0), expenses: lei(0), net: lei(0), kind: 'actual' });
    // The 3 projected months share 3 176 bani of expenses (1 058.82 x 3 = 3 176.47 -> 3 176),
    // ALLOCATED by largest remainder as 1 059 + 1 059 + 1 058 so they sum EXACTLY to the subtotal.
    // net is the row's own revenue - expenses, so every row adds up on the screen.
    expect(p.series[9]).toEqual({ month: '2026-10', revenue: lei(126), expenses: lei(10.59), net: lei(115.41), kind: 'projected' });
    expect(p.series[11]).toEqual({ month: '2026-12', revenue: lei(126), expenses: lei(10.58), net: lei(115.42), kind: 'projected' });
  });

  it('marks all 12 months actual when asOfDate is the last day of the fiscal year', () => {
    const data = makeData({ revenues: [revenue('2026-05-05', lei(1000), lei(200))] });
    const p = selectProjectionV1(data, '2026-12-31');
    expect(p.series.every((m) => m.kind === 'actual')).toBe(true);
    expect(p.annualProjected).toEqual({ revenue: lei(1200), expenses: lei(0), net: lei(1200) });
  });

  it('handles asOfDate before the fiscal year start with zero run rate and all-projected series', () => {
    const p = selectProjectionV1(midYearData(), '2025-06-15');
    expect(p.runRate).toEqual({ revenuePerMonth: lei(0), expensesPerMonth: 0, netPerMonth: 0 });
    expect(p.annualProjected).toEqual({ revenue: lei(0), expenses: lei(0), net: lei(0) });
    expect(p.series).toHaveLength(12);
    expect(p.series.every((m) => m.kind === 'projected' && m.revenue === 0 && m.expenses === 0 && m.net === 0)).toBe(true);
  });

  it('is deterministic for the same data and asOfDate', () => {
    const data = midYearData();
    expect(selectProjectionV1(data, '2026-09-15')).toEqual(selectProjectionV1(data, '2026-09-15'));
  });

  it('uses denominator 1 for asOfDate on the first day of the fiscal year', () => {
    const data = makeData({
      revenues: [revenue('2026-01-01', lei(100), lei(19))],
    });
    const p = selectProjectionV1(data, '2026-01-01');
    expect(p.runRate.revenuePerMonth).toBe(lei(119));
    expect(p.annualProjected.revenue).toBe(lei(1428));
    expect(p.series[0]).toEqual({ month: '2026-01', revenue: lei(119), expenses: lei(0), net: lei(119), kind: 'actual' });
    expect(p.series.slice(1).every((m) => m.kind === 'projected')).toBe(true);
  });

  it('uses denominator 1 for asOfDate on the last day of the first month', () => {
    const data = makeData({
      revenues: [revenue('2026-01-15', lei(100), lei(19))],
    });
    const p = selectProjectionV1(data, '2026-01-31');
    expect(p.runRate.revenuePerMonth).toBe(lei(119));
    expect(p.series[0].kind).toBe('actual');
    expect(p.series[1].kind).toBe('projected');
  });

  it('uses a fractional denominator for asOfDate on the first day of the second month', () => {
    const data = makeData({
      revenues: [revenue('2026-01-15', lei(100), lei(19))],
    });
    const p = selectProjectionV1(data, '2026-02-01');
    // elapsed = 1 + 1/28 = 29/28
    expect(p.elapsedMonths).toBeCloseTo(29 / 28, 10);
    expect(p.runRate.revenuePerMonth).toBeCloseTo(11_900 * 28 / 29, 10); // 11 900 bani x 28/29
    expect(p.series[0].kind).toBe('actual');
    expect(p.series[1].kind).toBe('actual');
    expect(p.series[2].kind).toBe('projected');
  });

  it('projects negative net when expenses exceed revenue (zero income)', () => {
    const data = makeData({
      expenses: [expense('2026-03-15', lei(500), lei(95))],
    });
    const p = selectProjectionV1(data, '2026-09-15');
    expect(p.runRate.revenuePerMonth).toBe(0);
    expect(p.runRate.expensesPerMonth).toBeCloseTo(lei(70), 10); // 595 / 8.5
    expect(p.runRate.netPerMonth).toBeCloseTo(lei(-70), 10);
    expect(p.annualProjected.net).toBeCloseTo(lei(-840), 10); // -70 * 12
  });

  it('computes fractional run rates when YTD is not evenly divisible', () => {
    const data = makeData({
      revenues: [revenue('2026-03-10', lei(100), lei(19))],
    });
    const p = selectProjectionV1(data, '2026-09-15');
    expect(p.runRate.revenuePerMonth).toBeCloseTo(lei(14), 10); // 119 / 8.5
    expect(p.annualProjected.revenue).toBeCloseTo(lei(168), 10); // 14 * 12
  });

  it('computes elapsed months as a fraction: full months + day/daysInMonth', () => {
    const data = midYearData();
    expect(selectProjectionV1(data, '2026-01-15').elapsedMonths).toBe(1);
    expect(selectProjectionV1(data, '2026-09-15').elapsedMonths).toBe(8.5);
    expect(selectProjectionV1(data, '2026-12-31').elapsedMonths).toBe(12);
  });

  it('floors the denominator to 1 for early dates inside the fiscal year', () => {
    const data = makeData({ revenues: [revenue('2026-01-01', lei(119), lei(23))] });
    const p = selectProjectionV1(data, '2026-01-01');
    expect(p.elapsedMonths).toBe(1);
    expect(p.runRate.revenuePerMonth).toBe(lei(142));
  });

  it('uses zero denominator before the fiscal year (no run rate)', () => {
    const data = makeData({ revenues: [revenue('2025-12-15', lei(119), lei(23))] });
    const p = selectProjectionV1(data, '2025-06-15');
    expect(p.elapsedMonths).toBe(0);
    expect(p.runRate.revenuePerMonth).toBe(0);
  });

  it('computes the fractional denominator for a mid-month date in a 31-day month', () => {
    const data = makeData({ revenues: [revenue('2026-01-15', lei(119), lei(23))] });
    const p = selectProjectionV1(data, '2026-01-31');
    expect(p.elapsedMonths).toBe(1);
    expect(p.runRate.revenuePerMonth).toBe(lei(142));
  });

  it('integer elapsed boundaries: month-end dates give exact integer elapsed months', () => {
    const data = makeData({ revenues: [revenue('2026-02-10', lei(100), lei(19))] }); // YTD gross 119

    // 2026-02-28: 1 full month + 28/28 = exactly 2
    const p28 = selectProjectionV1(data, '2026-02-28');
    expect(p28.elapsedMonths).toBe(2);
    expect(p28.runRate.revenuePerMonth).toBe(lei(119) / 2);
    expect(p28.series[1].kind).toBe('actual'); // February is actual
    expect(p28.series[2].kind).toBe('projected'); // March is projected

    // 2026-06-30: 5 full months + 30/30 = exactly 6
    const p30 = selectProjectionV1(data, '2026-06-30');
    expect(p30.elapsedMonths).toBe(6);
    expect(p30.runRate.revenuePerMonth).toBe(lei(119) / 6);
    expect(p30.series[5].kind).toBe('actual'); // June is actual
    expect(p30.series[6].kind).toBe('projected'); // July is projected
  });

  it('leap-year February: 2028-02-29 gives exactly 2 elapsed months (daysInMonth = 29)', () => {
    const data = makeData({
      profile: profile(2028),
      revenues: [revenue('2028-02-10', lei(100), lei(19))], // YTD gross 119
    });
    const p = selectProjectionV1(data, '2028-02-29');
    expect(p.elapsedMonths).toBe(2); // 1 full month + 29/29
    expect(p.runRate.revenuePerMonth).toBe(lei(119) / 2);
    expect(p.series.map((m) => m.month)).toEqual([
      '2028-01', '2028-02', '2028-03', '2028-04', '2028-05', '2028-06',
      '2028-07', '2028-08', '2028-09', '2028-10', '2028-11', '2028-12',
    ]);
    expect(p.series[1].kind).toBe('actual');
    expect(p.series[2].kind).toBe('projected');
  });

  it('leap-year February: 2028-02-28 is a fractional 57/29 elapsed months', () => {
    const data = makeData({
      profile: profile(2028),
      revenues: [revenue('2028-02-10', lei(100), lei(19))],
    });
    const p = selectProjectionV1(data, '2028-02-28');
    expect(p.elapsedMonths).toBeCloseTo(57 / 29, 10); // 1 + 28/29
  });

  it('empty data → all-zero run rate, zero annual projection, zero series', () => {
    const p = selectProjectionV1(makeData(), '2026-09-15');
    expect(p.runRate).toEqual({ revenuePerMonth: lei(0), expensesPerMonth: 0, netPerMonth: 0 });
    expect(p.annualProjected).toEqual({ revenue: lei(0), expenses: lei(0), net: lei(0) });
    expect(p.elapsedMonths).toBe(8.5);
    expect(p.series).toHaveLength(12);
    expect(p.series.every((m) => m.revenue === 0 && m.expenses === 0 && m.net === 0)).toBe(true);
  });
});

/**
 * Task 1 (pre-Phase-11): the VAT-exclusive pair.
 *
 * selectProjectionV1 used to annualise only the VAT-inclusive trio, which is NOT what the tax engine
 * consumes for a profile that is not vatExempt (tax.ts: gross = vatExempt ? revenues : revenuesNet).
 * These tests pin that the pair is annualised by the SAME rule with the SAME denominator, and - the
 * part that matters fiscally - that it is annualised from its OWN YTD totals rather than scaled down
 * from the VAT-inclusive pair, which would assume a constant VAT rate across the whole year.
 */
describe('selectProjectionV1 - annualProjectedExclVat', () => {
  it('applies the identical run-rate rule to the VAT-exclusive totals', () => {
    const p = selectProjectionV1(midYearData(), '2026-09-15'); // elapsed 8,5
    // revenueNet YTD lei(900) -> 900 x 12 / 8,5 = 127.058,82 bani -> toBaniNearest -> 127.059
    // expenseNet  YTD lei(71)  ->   71 x 12 / 8,5 =  10.023,53 bani -> toBaniNearest ->  10.024
    expect(p.annualProjectedExclVat).toEqual({ revenueNet: lei(1270.59), expenseNet: lei(100.24) });
  });

  it('is annualised from its own totals, not scaled from the VAT-inclusive pair', () => {
    // Same net turnover, different VAT. The gross pair must move with the VAT while the net pair does
    // not: that is what "annualised from its own totals" means, and it is what keeps a constant-VAT-rate
    // assumption out of a model that has no such rule.
    const lowVat = makeData({ revenues: [revenue('2026-03-10', lei(100), lei(19))] });
    const highVat = makeData({ revenues: [revenue('2026-03-10', lei(100), lei(50))] });
    const a = selectProjectionV1(lowVat, '2026-03-31'); // elapsed 3
    const b = selectProjectionV1(highVat, '2026-03-31');
    expect(a.annualProjected.revenue).not.toBe(b.annualProjected.revenue);
    expect(a.annualProjectedExclVat.revenueNet).toBe(b.annualProjectedExclVat.revenueNet);
    expect(a.annualProjectedExclVat.revenueNet).toBe(lei(400)); // 100 x 12 / 3
  });

  it('at 12 elapsed months it is the identity on the YTD actuals', () => {
    const p = selectProjectionV1(midYearData(), '2026-12-31');
    expect(p.elapsedMonths).toBe(12);
    expect(p.annualProjectedExclVat).toEqual({ revenueNet: lei(900), expenseNet: lei(71) });
  });

  it('before the fiscal year start it is zero, matching the zero denominator', () => {
    const p = selectProjectionV1(midYearData(), '2025-12-31');
    expect(p.elapsedMonths).toBe(0);
    expect(p.annualProjectedExclVat).toEqual({ revenueNet: lei(0), expenseNet: lei(0) });
  });

  it('carries no net field of its own', () => {
    // The engine owns venitulNetDinActivitate. Adding a second "net" here would put a competing
    // definition of net income in the domain, and one of them would eventually be wrong.
    const keys = Object.keys(selectProjectionV1(midYearData(), '2026-09-15').annualProjectedExclVat).sort();
    expect(keys).toEqual(['expenseNet', 'revenueNet']);
  });
});
