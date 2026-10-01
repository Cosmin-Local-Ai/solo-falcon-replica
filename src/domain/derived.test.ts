import { describe, expect, it } from 'vitest';
import type { AppData, Expense, Revenue } from '../data/types';
import type { PfaIdentity, PfaProfile } from './models';
import { selectFinancialDerived, selectTaxDerived } from './derived';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import { selectApplicableRules } from './fiscal/select';
import type { FiscalRule } from './fiscal/rules';

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

function activeRules2026(asOf: string = AS_OF): FiscalRule[] {
  return selectApplicableRules(PFA_2026_SYSTEM_REAL_PACKAGE, { taxYear: 2026, asOfDate: asOf });
}

describe('selectFinancialDerived (Step 14)', () => {
  it('composes ytd, monthly, and projection from existing selectors', () => {
    const data = makeData({ revenues: [revenue()], expenses: [expense()] });
    const view = selectFinancialDerived(data, AS_OF);
    expect(view.fiscalYear).toBe(2026);
    expect(view.asOfDate).toBe(AS_OF);
    expect(view.ytd.revenue).toBe(1190);
    expect(view.ytd.expenses).toBe(595);
    expect(view.ytd.net).toBe(595);
    expect(view.monthly.get('2026-03')?.revenue).toBe(1190);
    expect(view.monthly.get('2026-04')?.expenses).toBe(595);
    expect(view.projection).toHaveProperty('annualProjected');
    expect(view.projection).toHaveProperty('runRate');
  });

  it('case 1: income added → derived revenue/net change', () => {
    const before = selectFinancialDerived(makeData({ revenues: [revenue()] }), AS_OF);
    const after = selectFinancialDerived(
      makeData({ revenues: [revenue(), revenue({ id: 'rev-2', nr: 'FCT-002', date: '2026-05-20', valoareFaraTva: 800, tva: 152 })] }),
      AS_OF,
    );
    expect(after.ytd.revenue).toBe(before.ytd.revenue + 952);
    expect(after.ytd.net).toBe(before.ytd.net + 952);
    expect(after.lines.revenues).toHaveLength(2);
  });

  it('case 2: expense added → derived expenses/net change', () => {
    const before = selectFinancialDerived(makeData({ expenses: [expense()] }), AS_OF);
    const after = selectFinancialDerived(
      makeData({ expenses: [expense(), expense({ id: 'exp-2', nr: 'FCT-PRO-002', date: '2026-06-11', valoareFaraTva: 300, tva: 57 })] }),
      AS_OF,
    );
    expect(after.ytd.expenses).toBe(before.ytd.expenses + 357);
    expect(after.ytd.net).toBe(before.ytd.net - 357);
    expect(after.lines.expenses).toHaveLength(2);
  });

  it('case 3: expense deleted → derived expenses/net change', () => {
    const data = makeData({ expenses: [expense(), expense({ id: 'exp-2', valoareFaraTva: 200, tva: 38 })] });
    const before = selectFinancialDerived(data, AS_OF);
    const after = selectFinancialDerived({ ...data, expenses: [data.expenses[0]] }, AS_OF);
    expect(after.ytd.expenses).toBe(before.ytd.expenses - 238);
    expect(after.ytd.net).toBe(before.ytd.net + 238);
    expect(after.lines.expenses).toHaveLength(1);
  });

  it('case 4: expense reclassified → counting rule changes, line provenance updates', () => {
    const before = selectFinancialDerived(makeData({ expenses: [expense()] }), AS_OF);
    const after = selectFinancialDerived(makeData({ expenses: [expense({ status: 'respinsa', statusDetail: 'Document neconform' })] }), AS_OF);
    expect(before.ytd.expenses).toBe(595);
    expect(after.ytd.expenses).toBe(0);
    expect(after.lines.expenses[0].counted).toBe(false);
    expect(after.lines.expenses[0].status).toBe('respinsa');
  });

  it('case 5: document-linked expense changed → provenance changes, totals unchanged', () => {
    const before = selectFinancialDerived(makeData({ expenses: [expense()] }), AS_OF);
    const after = selectFinancialDerived(makeData({ expenses: [expense({ tip: 'bon-fiscal', nr: 'BF-999' })] }), AS_OF);
    expect(after.lines.expenses[0].document).toEqual({ tip: 'bon-fiscal', nr: 'BF-999' });
    expect(before.lines.expenses[0].document).toEqual({ tip: 'factura', nr: 'FCT-PRO-001' });
    // Amounts are untouched — only the document link state changed.
    expect(after.ytd).toEqual(before.ytd);
    expect(after.lines.expenses[0].total).toBe(before.lines.expenses[0].total);
  });

  it('unrelated change (client added) → derived financial view unchanged', () => {
    const base = makeData({ revenues: [revenue()], expenses: [expense()] });
    const before = selectFinancialDerived(base, AS_OF);
    const after = selectFinancialDerived({ ...base, clients: [{ id: 'c1', denumire: 'New Client', cui: '123', email: '', telefon: '', oras: '' }] }, AS_OF);
    expect(after).toEqual(before);
  });

  it('is deterministic for identical inputs', () => {
    const data = makeData({ revenues: [revenue()], expenses: [expense()] });
    expect(selectFinancialDerived(data, AS_OF)).toEqual(selectFinancialDerived(data, AS_OF));
  });

  it('counts a record exactly on asOfDate, excludes one the day after', () => {
    const data = makeData({
      revenues: [
        revenue({ id: 'rev-on', date: '2026-10-01' }),
        revenue({ id: 'rev-after', date: '2026-10-02' }),
      ],
    });
    const view = selectFinancialDerived(data, '2026-10-01');
    expect(view.lines.revenues.find((l) => l.id === 'rev-on')?.counted).toBe(true);
    expect(view.lines.revenues.find((l) => l.id === 'rev-after')?.counted).toBe(false);
    expect(view.ytd.revenue).toBe(1190);
  });

  it('counts a record exactly on fiscal year start, excludes one the day before', () => {
    const data = makeData({
      revenues: [
        revenue({ id: 'rev-start', date: '2026-01-01' }),
        revenue({ id: 'rev-before', date: '2025-12-31' }),
      ],
    });
    const view = selectFinancialDerived(data, AS_OF);
    expect(view.lines.revenues.find((l) => l.id === 'rev-start')?.counted).toBe(true);
    expect(view.lines.revenues.find((l) => l.id === 'rev-before')?.counted).toBe(false);
    expect(view.ytd.revenue).toBe(1190);
  });

  it('lists out-of-period records with counted: false', () => {
    const data = makeData({
      revenues: [
        revenue({ id: 'rev-in', date: '2026-03-15' }),
        revenue({ id: 'rev-out', date: '2025-06-15' }),
      ],
    });
    const view = selectFinancialDerived(data, AS_OF);
    expect(view.lines.revenues).toHaveLength(2);
    expect(view.lines.revenues.find((l) => l.id === 'rev-out')?.counted).toBe(false);
    expect(view.ytd.revenue).toBe(1190);
  });

  it('preserves full revenue-line provenance (all fields)', () => {
    const data = makeData({
      revenues: [revenue({ id: 'rev-p', tip: 'nota-impozit', nr: 'NI-42', date: '2026-05-20', valoareFaraTva: 800, tva: 152 })],
    });
    const view = selectFinancialDerived(data, AS_OF);
    expect(view.lines.revenues[0]).toEqual({
      id: 'rev-p',
      date: '2026-05-20',
      total: 952,
      status: 'inregistrata',
      counted: true,
      document: { tip: 'nota-impozit', nr: 'NI-42' },
    });
  });

  it('preserves source order in lines', () => {
    const data = makeData({
      revenues: [
        revenue({ id: 'rev-a', date: '2026-01-10' }),
        revenue({ id: 'rev-b', date: '2026-03-10' }),
        revenue({ id: 'rev-c', date: '2026-02-10' }),
      ],
    });
    const view = selectFinancialDerived(data, AS_OF);
    expect(view.lines.revenues.map((l) => l.id)).toEqual(['rev-a', 'rev-b', 'rev-c']);
  });

  it('returns empty lines and zero totals for empty data', () => {
    const view = selectFinancialDerived(makeData(), AS_OF);
    expect(view.lines.revenues).toEqual([]);
    expect(view.lines.expenses).toEqual([]);
    expect(view.ytd).toEqual({ revenue: 0, expenses: 0, net: 0 });
    expect(view.monthly.size).toBe(0);
  });

  it('computes negative net when expenses exceed revenue', () => {
    const data = makeData({
      revenues: [revenue({ valoareFaraTva: 100, tva: 19 })],
      expenses: [expense({ valoareFaraTva: 500, tva: 95 })],
    });
    const view = selectFinancialDerived(data, AS_OF);
    expect(view.ytd.revenue).toBe(119);
    expect(view.ytd.expenses).toBe(595);
    expect(view.ytd.net).toBe(-476);
  });
});

describe('selectTaxDerived (Step 14, structural — no formula)', () => {
  it('returns the REVIEW_REQUIRED sentinel with profile tax inputs and active release provenance', () => {
    const view = selectTaxDerived(makeData(), activeRules2026());
    expect(view.status).toBe('REVIEW_REQUIRED');
    expect(view.fiscalYear).toBe(2026);
    expect(view.inputs.regime).toBe('impozit_pe_venit');
    expect(view.inputs.cashFloorLei).toBe(0);
    expect(view.inputs.vatExempt).toBe(false);
    expect(view.activeRelease.ruleIds.length).toBeGreaterThan(0);
    expect(view.activeRelease.ruleIds).toEqual([...view.activeRelease.ruleIds].sort());
    expect(view.activeRelease.ruleCount).toBe(view.activeRelease.ruleIds.length);
  });

  it('case 6: profile tax input changed → inputs reference changes', () => {
    const before = selectTaxDerived(makeData(), activeRules2026());
    const after = selectTaxDerived(
      makeData({ profile: profile({ cashFloorLei: 5000, vatExempt: true, salaryStatus: 'da', otherIncome: ['alte'] }) }),
      activeRules2026(),
    );
    expect(after.inputs.inputsKey).not.toBe(before.inputs.inputsKey);
    expect(after.inputs.cashFloorLei).toBe(5000);
    expect(after.inputs.vatExempt).toBe(true);
    expect(after.inputs.salaryStatus).toBe('da');
    // Release provenance is untouched by a profile change.
    expect(after.activeRelease).toEqual(before.activeRelease);
  });

  it('case 7: fiscal rule release changed → active release provenance changes', () => {
    const all = activeRules2026();
    const before = selectTaxDerived(makeData(), all);
    const after = selectTaxDerived(makeData(), all.filter(r => r.ruleId !== 'PFA_2026_TAX_REFERENCE'));
    expect(after.activeRelease.ruleIds).not.toEqual(before.activeRelease.ruleIds);
    expect(after.activeRelease.ruleCount).toBe(before.activeRelease.ruleCount - 1);
    // Profile inputs are untouched by a release change.
    expect(after.inputs).toEqual(before.inputs);
  });

  it('unrelated change (client added) → tax derived view unchanged', () => {
    const base = makeData({ clients: [] });
    const before = selectTaxDerived(base, activeRules2026());
    const after = selectTaxDerived({ ...base, clients: [{ id: 'c1', denumire: 'New Client', cui: '123', email: '', telefon: '', oras: '' }] }, activeRules2026());
    expect(after).toEqual(before);
  });

  it('is deterministic for identical inputs', () => {
    const data = makeData();
    expect(selectTaxDerived(data, activeRules2026())).toEqual(selectTaxDerived(data, activeRules2026()));
  });

  it('produces a canonical inputsKey that is stable for the same inputs', () => {
    const data = makeData();
    const a = selectTaxDerived(data, activeRules2026());
    const b = selectTaxDerived(data, activeRules2026());
    expect(a.inputs.inputsKey).toBe(b.inputs.inputsKey);
    expect(typeof a.inputs.inputsKey).toBe('string');
    expect(a.inputs.inputsKey.length).toBeGreaterThan(0);
  });

  it('changes inputsKey when a tax input changes', () => {
    const base = makeData();
    const before = selectTaxDerived(base, activeRules2026());
    const after = selectTaxDerived(
      makeData({ profile: profile({ cashFloorLei: 10000 }) }),
      activeRules2026(),
    );
    expect(after.inputs.inputsKey).not.toBe(before.inputs.inputsKey);
    expect(after.inputs.cashFloorLei).toBe(10000);
  });
});
