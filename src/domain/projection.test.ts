import { describe, expect, it } from 'vitest';
import type { AppData, Expense, Revenue, SettingsState } from '../data/types';
import type { PfaIdentity, PfaProfile } from './models';
import { selectProjectionV1 } from './projection';

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
    pensionStatus: 'nu',
    otherIncome: [],
    socialInsuranceStatus: 'obligatoriu',
    vatExempt: false,
    cashFloorLei: 0,
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

function revenue(date: string, valoareFaraTva: number, tva: number, status: Revenue['status'] = 'inregistrata'): Revenue {
  return {
    id: `rev-${date}-${valoareFaraTva}`,
    tip: 'factura',
    nr: '1',
    date,
    client: 'Client Test',
    cui: '12345678',
    valoareFaraTva,
    tva,
    status,
  };
}

function expense(date: string, valoareFaraTva: number, tva: number, status: Expense['status'] = 'inregistrata'): Expense {
  return {
    id: `exp-${date}-${valoareFaraTva}`,
    tip: 'factura',
    nr: '1',
    date,
    furnizor: 'Furnizor Test',
    cui: '87654321',
    valoareFaraTva,
    tva,
    status,
  };
}

// YTD (asOfDate 2026-09-15, 9 elapsed months):
// revenue: 357 + 714 = 1071  → run rate 119/month
// expenses: 90        → run rate 10/month
// net: 981            → run rate 109/month
function midYearData(): AppData {
  return makeData({
    revenues: [
      revenue('2026-03-10', 300, 57),
      revenue('2026-06-20', 600, 114),
    ],
    expenses: [expense('2026-04-15', 71, 19)],
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
    expect(p.runRate.revenuePerMonth).toBe(126); // 1071 / 8.5
    expect(p.runRate.expensesPerMonth).toBeCloseTo(180 / 17, 10); // 90 / 8.5
    expect(p.runRate.netPerMonth).toBeCloseTo(1962 / 17, 10); // 981 / 8.5
  });

  it('computes annual projection as run rate x 12', () => {
    const p = selectProjectionV1(midYearData(), '2026-09-15');
    expect(p.annualProjected.revenue).toBe(1512); // 126 * 12
    expect(p.annualProjected.expenses).toBeCloseTo(2160 / 17, 10); // (180/17) * 12
    expect(p.annualProjected.net).toBeCloseTo(23544 / 17, 10); // (1962/17) * 12
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
    expect(p.series[2]).toEqual({ month: '2026-03', revenue: 357, expenses: 0, net: 357, kind: 'actual' });
    expect(p.series[3]).toEqual({ month: '2026-04', revenue: 0, expenses: 90, net: -90, kind: 'actual' });
    expect(p.series[8]).toEqual({ month: '2026-09', revenue: 0, expenses: 0, net: 0, kind: 'actual' });
    expect(p.series[9]).toEqual({ month: '2026-10', revenue: 126, expenses: 180 / 17, net: 1962 / 17, kind: 'projected' });
    expect(p.series[11]).toEqual({ month: '2026-12', revenue: 126, expenses: 180 / 17, net: 1962 / 17, kind: 'projected' });
  });

  it('marks all 12 months actual when asOfDate is the last day of the fiscal year', () => {
    const data = makeData({ revenues: [revenue('2026-05-05', 1000, 200)] });
    const p = selectProjectionV1(data, '2026-12-31');
    expect(p.series.every((m) => m.kind === 'actual')).toBe(true);
    expect(p.annualProjected).toEqual({ revenue: 1200, expenses: 0, net: 1200 });
  });

  it('handles asOfDate before the fiscal year start with zero run rate and all-projected series', () => {
    const p = selectProjectionV1(midYearData(), '2025-06-15');
    expect(p.runRate).toEqual({ revenuePerMonth: 0, expensesPerMonth: 0, netPerMonth: 0 });
    expect(p.annualProjected).toEqual({ revenue: 0, expenses: 0, net: 0 });
    expect(p.series).toHaveLength(12);
    expect(p.series.every((m) => m.kind === 'projected' && m.revenue === 0 && m.expenses === 0 && m.net === 0)).toBe(true);
  });

  it('is deterministic for the same data and asOfDate', () => {
    const data = midYearData();
    expect(selectProjectionV1(data, '2026-09-15')).toEqual(selectProjectionV1(data, '2026-09-15'));
  });

  it('uses denominator 1 for asOfDate on the first day of the fiscal year', () => {
    const data = makeData({
      revenues: [revenue('2026-01-01', 100, 19)],
    });
    const p = selectProjectionV1(data, '2026-01-01');
    expect(p.runRate.revenuePerMonth).toBe(119);
    expect(p.annualProjected.revenue).toBe(1428);
    expect(p.series[0]).toEqual({ month: '2026-01', revenue: 119, expenses: 0, net: 119, kind: 'actual' });
    expect(p.series.slice(1).every((m) => m.kind === 'projected')).toBe(true);
  });

  it('uses denominator 1 for asOfDate on the last day of the first month', () => {
    const data = makeData({
      revenues: [revenue('2026-01-15', 100, 19)],
    });
    const p = selectProjectionV1(data, '2026-01-31');
    expect(p.runRate.revenuePerMonth).toBe(119);
    expect(p.series[0].kind).toBe('actual');
    expect(p.series[1].kind).toBe('projected');
  });

  it('uses a fractional denominator for asOfDate on the first day of the second month', () => {
    const data = makeData({
      revenues: [revenue('2026-01-15', 100, 19)],
    });
    const p = selectProjectionV1(data, '2026-02-01');
    // elapsed = 1 + 1/28 = 29/28
    expect(p.elapsedMonths).toBeCloseTo(29 / 28, 10);
    expect(p.runRate.revenuePerMonth).toBeCloseTo(3332 / 29, 10); // 119 * 28 / 29
    expect(p.series[0].kind).toBe('actual');
    expect(p.series[1].kind).toBe('actual');
    expect(p.series[2].kind).toBe('projected');
  });

  it('projects negative net when expenses exceed revenue (zero income)', () => {
    const data = makeData({
      expenses: [expense('2026-03-15', 500, 95)],
    });
    const p = selectProjectionV1(data, '2026-09-15');
    expect(p.runRate.revenuePerMonth).toBe(0);
    expect(p.runRate.expensesPerMonth).toBeCloseTo(70, 10); // 595 / 8.5
    expect(p.runRate.netPerMonth).toBeCloseTo(-70, 10);
    expect(p.annualProjected.net).toBeCloseTo(-840, 10); // -70 * 12
  });

  it('computes fractional run rates when YTD is not evenly divisible', () => {
    const data = makeData({
      revenues: [revenue('2026-03-10', 100, 19)],
    });
    const p = selectProjectionV1(data, '2026-09-15');
    expect(p.runRate.revenuePerMonth).toBeCloseTo(14, 10); // 119 / 8.5
    expect(p.annualProjected.revenue).toBeCloseTo(168, 10); // 14 * 12
  });

  it('computes elapsed months as a fraction: full months + day/daysInMonth', () => {
    const data = midYearData();
    expect(selectProjectionV1(data, '2026-01-15').elapsedMonths).toBe(1);
    expect(selectProjectionV1(data, '2026-09-15').elapsedMonths).toBe(8.5);
    expect(selectProjectionV1(data, '2026-12-31').elapsedMonths).toBe(12);
  });

  it('floors the denominator to 1 for early dates inside the fiscal year', () => {
    const data = makeData({ revenues: [revenue('2026-01-01', 119, 23)] });
    const p = selectProjectionV1(data, '2026-01-01');
    expect(p.elapsedMonths).toBe(1);
    expect(p.runRate.revenuePerMonth).toBe(142);
  });

  it('uses zero denominator before the fiscal year (no run rate)', () => {
    const data = makeData({ revenues: [revenue('2025-12-15', 119, 23)] });
    const p = selectProjectionV1(data, '2025-06-15');
    expect(p.elapsedMonths).toBe(0);
    expect(p.runRate.revenuePerMonth).toBe(0);
  });

  it('computes the fractional denominator for a mid-month date in a 31-day month', () => {
    const data = makeData({ revenues: [revenue('2026-01-15', 119, 23)] });
    const p = selectProjectionV1(data, '2026-01-31');
    expect(p.elapsedMonths).toBe(1);
    expect(p.runRate.revenuePerMonth).toBe(142);
  });

  it('integer elapsed boundaries: month-end dates give exact integer elapsed months', () => {
    const data = makeData({ revenues: [revenue('2026-02-10', 100, 19)] }); // YTD gross 119

    // 2026-02-28: 1 full month + 28/28 = exactly 2
    const p28 = selectProjectionV1(data, '2026-02-28');
    expect(p28.elapsedMonths).toBe(2);
    expect(p28.runRate.revenuePerMonth).toBe(119 / 2);
    expect(p28.series[1].kind).toBe('actual'); // February is actual
    expect(p28.series[2].kind).toBe('projected'); // March is projected

    // 2026-06-30: 5 full months + 30/30 = exactly 6
    const p30 = selectProjectionV1(data, '2026-06-30');
    expect(p30.elapsedMonths).toBe(6);
    expect(p30.runRate.revenuePerMonth).toBe(119 / 6);
    expect(p30.series[5].kind).toBe('actual'); // June is actual
    expect(p30.series[6].kind).toBe('projected'); // July is projected
  });

  it('leap-year February: 2028-02-29 gives exactly 2 elapsed months (daysInMonth = 29)', () => {
    const data = makeData({
      profile: profile(2028),
      revenues: [revenue('2028-02-10', 100, 19)], // YTD gross 119
    });
    const p = selectProjectionV1(data, '2028-02-29');
    expect(p.elapsedMonths).toBe(2); // 1 full month + 29/29
    expect(p.runRate.revenuePerMonth).toBe(119 / 2);
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
      revenues: [revenue('2028-02-10', 100, 19)],
    });
    const p = selectProjectionV1(data, '2028-02-28');
    expect(p.elapsedMonths).toBeCloseTo(57 / 29, 10); // 1 + 28/29
  });

  it('empty data → all-zero run rate, zero annual projection, zero series', () => {
    const p = selectProjectionV1(makeData(), '2026-09-15');
    expect(p.runRate).toEqual({ revenuePerMonth: 0, expensesPerMonth: 0, netPerMonth: 0 });
    expect(p.annualProjected).toEqual({ revenue: 0, expenses: 0, net: 0 });
    expect(p.elapsedMonths).toBe(8.5);
    expect(p.series).toHaveLength(12);
    expect(p.series.every((m) => m.revenue === 0 && m.expenses === 0 && m.net === 0)).toBe(true);
  });
});
