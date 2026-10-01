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

  it('computes run rate as YTD totals / elapsed months (inclusive)', () => {
    const p = selectProjectionV1(midYearData(), '2026-09-15');
    expect(p.runRate.revenuePerMonth).toBe(119); // 1071 / 9
    expect(p.runRate.expensesPerMonth).toBe(10); // 90 / 9
    expect(p.runRate.netPerMonth).toBe(109); // 981 / 9
  });

  it('computes annual projection as run rate x 12', () => {
    const p = selectProjectionV1(midYearData(), '2026-09-15');
    expect(p.annualProjected).toEqual({ revenue: 1428, expenses: 120, net: 1308 });
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
    expect(p.series[9]).toEqual({ month: '2026-10', revenue: 119, expenses: 10, net: 109, kind: 'projected' });
    expect(p.series[11]).toEqual({ month: '2026-12', revenue: 119, expenses: 10, net: 109, kind: 'projected' });
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

  it('uses denominator 2 for asOfDate on the first day of the second month', () => {
    const data = makeData({
      revenues: [revenue('2026-01-15', 100, 19)],
    });
    const p = selectProjectionV1(data, '2026-02-01');
    expect(p.runRate.revenuePerMonth).toBeCloseTo(59.5, 10);
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
    expect(p.runRate.expensesPerMonth).toBeCloseTo(595 / 9, 10);
    expect(p.runRate.netPerMonth).toBeCloseTo(-595 / 9, 10);
    expect(p.annualProjected.net).toBeCloseTo(-595 / 9 * 12, 10);
  });

  it('computes fractional run rates when YTD is not evenly divisible', () => {
    const data = makeData({
      revenues: [revenue('2026-03-10', 100, 19)],
    });
    const p = selectProjectionV1(data, '2026-09-15');
    expect(p.runRate.revenuePerMonth).toBeCloseTo(119 / 9, 10);
    expect(p.annualProjected.revenue).toBeCloseTo(119 / 9 * 12, 10);
  });
});
