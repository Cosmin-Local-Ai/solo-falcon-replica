import { describe, expect, it } from 'vitest';
import type { AppData, Declaration, Expense, Revenue } from './types';
import type { PfaIdentity, PfaProfile } from '../domain/models';
import {
  getFinancialSummary,
  getMonthlyFinancialSeries,
  getProjectedFinancialSeries,
  getDataCompleteness,
  getPendingCounts,
  getTaxEstimate,
  getActionItems,
  getLegislationState,
  buildDashboardData,
} from './dashboard';

const AS_OF = '2026-10-01';

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

function profile(overrides: Partial<PfaProfile> = {}): PfaProfile {
  return {
    id: 'profile-test',
    pfaStartYear: 2026,
    fiscalYear: 2026,
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
    ...overrides,
  };
}

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
    settings: {
      cotaTva: 0.19,
      company: { denumire: 'Test SRL', cui: '12345678', numarRegComert: 'J40/123/2026', adresa: 'Str. Test 1', caen: [] },
      personal: { nume: 'Test', cnp: '', adresa: 'Str. Test 1', telefon: '0700000000', email: 'test@example.com' },
      bankAccounts: [],
      eFactura: { trimitere: 'manual', dateContact: '' },
    },
    ...overrides,
  };
}

function revenue(overrides: Partial<Revenue> = {}): Revenue {
  return {
    id: 'rev-1',
    tip: 'factura',
    nr: 'FCT-001',
    date: '2026-03-15',
    client: 'Client Test',
    cui: '12345678',
    valoareFaraTva: 1000,
    tva: 190,
    status: 'inregistrata',
    ...overrides,
  };
}

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    tip: 'factura',
    nr: 'FCT-PRO-001',
    date: '2026-04-10',
    furnizor: 'Furnizor Test',
    cui: 'RO12345678',
    valoareFaraTva: 500,
    tva: 95,
    status: 'inregistrata',
    ...overrides,
  };
}

function declaration(overrides: Partial<Declaration> = {}): Declaration {
  return {
    id: 'decl-1',
    an: 2026,
    luna: 3,
    venituri: 0,
    cheltuieli: 0,
    status: 'inregistrata',
    dataInregistrare: '2026-03-31',
    ...overrides,
  };
}

describe('getFinancialSummary (sync)', () => {
  it('empty data → zero totals', () => {
    const ytd = getFinancialSummary(makeData(), AS_OF);
    expect(ytd.revenue).toBe(0);
    expect(ytd.expenses).toBe(0);
    expect(ytd.net).toBe(0);
  });

  it('a revenue entry → matching YTD revenue', () => {
    const ytd = getFinancialSummary(makeData({ revenues: [revenue()] }), AS_OF);
    expect(ytd.revenue).toBe(1190);
    expect(ytd.expenses).toBe(0);
    expect(ytd.net).toBe(1190);
  });

  it('revenue + expense → net is the difference', () => {
    const ytd = getFinancialSummary(makeData({ revenues: [revenue()], expenses: [expense()] }), AS_OF);
    expect(ytd.revenue).toBe(1190);
    expect(ytd.expenses).toBe(595);
    expect(ytd.net).toBe(595);
  });
});

describe('getMonthlyFinancialSeries (sync)', () => {
  it('empty data → empty map', () => {
    const monthly = getMonthlyFinancialSeries(makeData(), AS_OF);
    expect(monthly.size).toBe(0);
  });

  it('a revenue → bucketed under its month', () => {
    const monthly = getMonthlyFinancialSeries(makeData({ revenues: [revenue()] }), AS_OF);
    expect(monthly.get('2026-03')?.revenue).toBe(1190);
  });
});

describe('getProjectedFinancialSeries (sync)', () => {
  it('returns a projection with annual and run-rate fields', () => {
    const projection = getProjectedFinancialSeries(makeData({ revenues: [revenue()] }), AS_OF);
    expect(projection).toHaveProperty('annualProjected');
    expect(projection).toHaveProperty('runRate');
  });
});

describe('getDataCompleteness (sync)', () => {
  it('returns a report with a checks array', () => {
    const report = getDataCompleteness(makeData());
    expect(report).toHaveProperty('checks');
    expect(Array.isArray(report.checks)).toBe(true);
  });
});

describe('getPendingCounts (sync)', () => {
  it('empty data → all zero', () => {
    expect(getPendingCounts(makeData())).toEqual({
      revenuesInAsteptare: 0,
      revenuesRespinsa: 0,
      expensesRespinsa: 0,
      declarationsInAsteptare: 0,
    });
  });

  it('counts entries by status', () => {
    const counts = getPendingCounts(
      makeData({
        revenues: [revenue({ id: 'r1', status: 'in-asteptare' }), revenue({ id: 'r2', status: 'respinsa' })],
        expenses: [expense({ status: 'respinsa' })],
        declarations: [declaration({ status: 'in-asteptare' })],
      }),
    );
    expect(counts.revenuesInAsteptare).toBe(1);
    expect(counts.revenuesRespinsa).toBe(1);
    expect(counts.expensesRespinsa).toBe(1);
    expect(counts.declarationsInAsteptare).toBe(1);
  });
});

describe('getTaxEstimate (async)', () => {
  it('resolves to a tax estimate object', async () => {
    const result = await getTaxEstimate(makeData({ revenues: [revenue()] }), AS_OF);
    expect(result).toBeTypeOf('object');
    expect(result).not.toBeNull();
  });
});

describe('buildDashboardData (sync composer)', () => {
  it('composes the full dashboard from data + tax', async () => {
    const data = makeData({ revenues: [revenue()], expenses: [expense()] });
    const tax = await getTaxEstimate(data, AS_OF);
    const dashboard = buildDashboardData(data, tax);

    expect(dashboard.taxYear).toBe(2026);
    expect(dashboard.snapshot.pfaRevenue).toBe(1190);
    expect(dashboard.tax).toBe(tax);
    expect(Array.isArray(dashboard.thresholds)).toBe(true);
    expect(Array.isArray(dashboard.deadlines)).toBe(true);
    expect(Array.isArray(dashboard.insights)).toBe(true);
    expect(dashboard.completeness).toHaveProperty('checks');
    expect(dashboard.pendingCounts.revenuesInAsteptare).toBe(0);
  });
});

describe('getActionItems (sync)', () => {
  it('returns an array of well-formed action items', () => {
    const items = getActionItems(makeData({ revenues: [revenue()] }));
    expect(Array.isArray(items)).toBe(true);
    for (const item of items) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.label).toBe('string');
      expect(['deadline', 'completeness', 'tax']).toContain(item.source);
    }
  });
});

describe('getLegislationState (sync)', () => {
  it('returns a placeholder state with no items', () => {
    const state = getLegislationState(makeData());
    expect(state.updatedAt).toBeNull();
    expect(state.items).toEqual([]);
  });
});
