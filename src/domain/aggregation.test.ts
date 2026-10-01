import { describe, expect, it } from 'vitest';
import type { AppData, Expense, Revenue, SettingsState } from '../data/types';
import type { PfaIdentity, PfaProfile } from './models';
import { inPeriod, selectMonthly, selectYtd } from './aggregation';

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

describe('selectYtd', () => {
  it('aggregates only records with status === inregistrata', () => {
    const data = makeData({
      revenues: [
        revenue('2026-02-10', 100, 19, 'inregistrata'),
        revenue('2026-02-11', 200, 38, 'in-asteptare'),
        revenue('2026-02-12', 300, 57, 'respinsa'),
      ],
      expenses: [
        expense('2026-02-15', 50, 9.5, 'inregistrata'),
        expense('2026-02-16', 60, 11.4, 'respinsa'),
      ],
    });

    const ytd = selectYtd(data, '2026-12-31');
    expect(ytd.revenue).toBe(119);
    expect(ytd.expenses).toBe(59.5);
    expect(ytd.net).toBe(59.5);
  });

  it('computes total as valoareFaraTva + tva', () => {
    const data = makeData({
      revenues: [revenue('2026-03-01', 1000, 190)],
      expenses: [expense('2026-03-02', 400, 74.4)],
    });

    const ytd = selectYtd(data, '2026-12-31');
    expect(ytd.revenue).toBe(1190);
    expect(ytd.expenses).toBe(474.4);
    expect(ytd.net).toBe(715.6);
  });

  it('respects the fiscalYear boundary (profile.fiscalYear, calendar year)', () => {
    const data = makeData({
      revenues: [
        revenue('2025-12-31', 100, 19),
        revenue('2026-01-01', 200, 38),
        revenue('2026-06-15', 300, 57),
        revenue('2027-01-01', 400, 76),
      ],
    });

    const ytd = selectYtd(data, '2026-12-31');
    expect(ytd.revenue).toBe(595);
  });

  it('uses the fiscal year of the profile, not the asOfDate year', () => {
    const data = makeData({
      profile: profile(2025),
      revenues: [
        revenue('2025-05-05', 100, 19),
        revenue('2026-05-05', 200, 38),
      ],
    });

    // asOfDate is in 2026, but the fiscal year is 2025.
    const ytd = selectYtd(data, '2026-06-30');
    expect(ytd.revenue).toBe(119);
  });

  it('treats asOfDate as an inclusive upper bound', () => {
    const data = makeData({
      revenues: [
        revenue('2026-03-31', 100, 19),
        revenue('2026-04-01', 200, 38),
      ],
    });

    const ytd = selectYtd(data, '2026-03-31');
    expect(ytd.revenue).toBe(119);
  });

  it('returns zeros for empty data', () => {
    const ytd = selectYtd(makeData(), '2026-06-30');
    expect(ytd).toEqual({ revenue: 0, expenses: 0, net: 0 });
  });

  it('computes negative net when expenses exceed revenue (zero income)', () => {
    const data = makeData({
      expenses: [expense('2026-03-15', 500, 95)],
    });
    const ytd = selectYtd(data, '2026-12-31');
    expect(ytd.revenue).toBe(0);
    expect(ytd.expenses).toBe(595);
    expect(ytd.net).toBe(-595);
  });

  it('includes records on the first day of the fiscal year (Jan 1)', () => {
    const data = makeData({
      revenues: [revenue('2026-01-01', 100, 19)],
    });
    const ytd = selectYtd(data, '2026-12-31');
    expect(ytd.revenue).toBe(119);
  });

  it('includes records on the last day of the fiscal year (Dec 31)', () => {
    const data = makeData({
      revenues: [revenue('2026-12-31', 100, 19)],
    });
    const ytd = selectYtd(data, '2026-12-31');
    expect(ytd.revenue).toBe(119);
  });
});

describe('selectMonthly', () => {
  it('groups totals by YYYY-MM', () => {
    const data = makeData({
      revenues: [
        revenue('2026-01-10', 100, 19),
        revenue('2026-01-20', 50, 9.5),
        revenue('2026-02-05', 200, 38),
        revenue('2026-03-01', 300, 57),
      ],
      expenses: [
        expense('2026-01-15', 40, 7.4),
        expense('2026-02-10', 80, 15.2),
        expense('2026-02-20', 20, 3.8),
      ],
    });

    const monthly = selectMonthly(data, '2026-12-31');
    expect(monthly.get('2026-01')).toEqual({ revenue: 178.5, expenses: 47.4, net: 131.1 });
    expect(monthly.get('2026-02')).toEqual({ revenue: 238, expenses: 119, net: 119 });
    expect(monthly.get('2026-03')).toEqual({ revenue: 357, expenses: 0, net: 357 });
    expect(monthly.size).toBe(3);
  });

  it('excludes out-of-period and non-inregistrata records', () => {
    const data = makeData({
      revenues: [
        revenue('2025-12-31', 100, 19),
        revenue('2026-04-01', 200, 38),
        revenue('2026-02-10', 300, 57, 'in-asteptare'),
        revenue('2026-02-11', 400, 76, 'inregistrata'),
      ],
    });

    const monthly = selectMonthly(data, '2026-03-31');
    expect(monthly.size).toBe(1);
    expect(monthly.get('2026-02')).toEqual({ revenue: 476, expenses: 0, net: 476 });
  });

  it('is deterministic for the same data and asOfDate', () => {
    const data = makeData({
      revenues: [
        revenue('2026-01-10', 100, 19),
        revenue('2026-02-10', 200, 38),
      ],
      expenses: [expense('2026-01-15', 50, 9.5)],
    });

    const first = selectMonthly(data, '2026-06-30');
    const second = selectMonthly(data, '2026-06-30');
    expect(second).toEqual(first);
    expect(selectYtd(data, '2026-06-30')).toEqual(selectYtd(data, '2026-06-30'));
  });

  it('omits months with no records (no gap-filling)', () => {
    const data = makeData({
      revenues: [
        revenue('2026-01-10', 100, 19),
        revenue('2026-03-10', 200, 38),
      ],
    });
    const monthly = selectMonthly(data, '2026-12-31');
    expect(monthly.size).toBe(2);
    expect(monthly.has('2026-02')).toBe(false);
    expect(monthly.get('2026-01')).toEqual({ revenue: 119, expenses: 0, net: 119 });
    expect(monthly.get('2026-03')).toEqual({ revenue: 238, expenses: 0, net: 238 });
  });

  it('groups by calendar month across the Jan/Dec boundary', () => {
    const data = makeData({
      revenues: [
        revenue('2026-12-31', 100, 19),
        revenue('2026-01-01', 200, 38),
      ],
    });
    const monthly = selectMonthly(data, '2026-12-31');
    expect(monthly.size).toBe(2);
    expect(monthly.get('2026-12')).toEqual({ revenue: 119, expenses: 0, net: 119 });
    expect(monthly.get('2026-01')).toEqual({ revenue: 238, expenses: 0, net: 238 });
  });
});

describe('inPeriod', () => {
  it('includes the fiscal year start date', () => {
    expect(inPeriod('2026-01-01', '2026-12-31', 2026)).toBe(true);
  });

  it('includes the asOfDate', () => {
    expect(inPeriod('2026-06-15', '2026-06-15', 2026)).toBe(true);
  });

  it('excludes the day after asOfDate', () => {
    expect(inPeriod('2026-06-16', '2026-06-15', 2026)).toBe(false);
  });

  it('excludes dates before the fiscal year', () => {
    expect(inPeriod('2025-12-31', '2026-12-31', 2026)).toBe(false);
  });

  it('excludes dates after the fiscal year', () => {
    expect(inPeriod('2027-01-01', '2026-12-31', 2026)).toBe(false);
  });
});

describe('source-data reactivity', () => {
  it('adding a record changes aggregates', () => {
    const before = selectYtd(makeData({ revenues: [revenue('2026-03-10', 100, 19)] }), '2026-12-31');
    const after = selectYtd(
      makeData({
        revenues: [revenue('2026-03-10', 100, 19), revenue('2026-04-10', 200, 38)],
      }),
      '2026-12-31',
    );
    expect(after.revenue).toBe(before.revenue + 238);
    expect(after.net).toBe(before.net + 238);
  });

  it('removing a record changes aggregates', () => {
    const data = makeData({
      revenues: [revenue('2026-03-10', 100, 19), revenue('2026-04-10', 200, 38)],
    });
    const before = selectYtd(data, '2026-12-31');
    const after = selectYtd({ ...data, revenues: [data.revenues[0]] }, '2026-12-31');
    expect(after.revenue).toBe(before.revenue - 238);
  });
});
