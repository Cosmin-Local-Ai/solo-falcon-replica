import { describe, expect, it } from 'vitest';
import type {
  AppData,
  Client,
  CompanyDocument,
  Declaration,
  DocumentItem,
  Expense,
  Revenue,
  SettingsState,
  TaxStatement,
} from '../data/types';
import type { RuleRelease } from './fiscal/rules';
import type { PfaProfile, PfaRegime } from './models';
import { assessCompleteness } from './completeness';
import type { TaxCalculationSnapshot } from './snapshots/types';

function makeProfile(): PfaProfile {
  return {
    id: 'profile-test',
    pfaStartYear: 2024,
    fiscalYear: 2026,
    regime: 'impozit_pe_venit',
    caen: '6201',
    salaryStatus: 'nu',
    pensionStatus: 'nu',
    otherIncome: [],
    socialInsuranceStatus: 'obligatoriu',
    vatExempt: false,
    cashFloorLei: 0,
    identity: {
      nume: 'Test Person',
      cnp: '1234567890123',
      adresa: 'Adresa Test',
      telefon: '0700000000',
      email: 'test@example.com',
      denumire: 'Test SRL',
      cui: 'RO12345678',
      formaJuridica: 'SRL',
      numarRegComert: 'J40/123/2024',
      adresaSocietate: 'Adresa Societate',
      telefonSocietate: '0700000001',
      emailSocietate: 'firma@example.com',
      contBancar: 'RO44BANK',
      banca: 'Test Bank',
    },
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
}

function makeRevenue(overrides: Partial<Revenue> = {}): Revenue {
  return {
    id: 'rev-1',
    tip: 'factura',
    nr: 'F1/1',
    date: '2026-06-01',
    client: 'Client A',
    cui: 'RO12345678',
    valoareFaraTva: 1000,
    tva: 190,
    status: 'inregistrata',
    ...overrides,
  };
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    tip: 'bon-fiscal',
    nr: 'A1/1',
    date: '2026-06-02',
    furnizor: 'Furnizor A',
    cui: 'RO87654321',
    valoareFaraTva: 500,
    tva: 95,
    status: 'inregistrata',
    ...overrides,
  };
}

function makeClient(): Client {
  return {
    id: 'cli-1',
    denumire: 'Client A',
    cui: 'RO12345678',
    email: 'client@example.com',
    telefon: '0700000002',
    oras: 'Bucuresti',
  };
}

function makeDeclaration(): Declaration {
  return {
    id: 'dec-1',
    an: 2026,
    luna: 6,
    venituri: 100_000,
    cheltuieli: 20_000,
    status: 'inregistrata',
    dataInregistrare: '2026-07-25',
  };
}

function makeDocument(): DocumentItem {
  return {
    id: 'doc-1',
    nume: 'factura.pdf',
    data: '2026-06-01',
    categoria: 'factura',
  };
}

function makeCompanyDocument(overrides: Partial<CompanyDocument> = {}): CompanyDocument {
  return {
    id: 'cdoc-1',
    nume: 'im-2026-06.pdf',
    tip: 'pdf',
    content: 'data:application/pdf;base64,test',
    marime: 2345,
    data: '2026-07-25',
    perioada: '2026-06',
    ...overrides,
  };
}

function makeStatement(): TaxStatement {
  return {
    id: 'st-1',
    tip: 'im',
    perioada: '2026-06',
    depunere: 'SOLO',
    dataDepunere: '2026-07-25',
    nume: 'im-2026-06.pdf',
  };
}

function makeSnapshot(status: TaxCalculationSnapshot['status']): TaxCalculationSnapshot {
  return {
    calculationId: 'calc-2026-test',
    taxYear: 2026,
    calculatedAt: '2026-06-15T10:00:00.000Z',
    ruleRelease: {} as RuleRelease,
    inputSnapshot: { profile: makeProfile(), revenues: 100_000, expenses: 0 },
    inputsHash: '0'.repeat(64),
    calculationLines: [{ label: 'total', value: 10_000 }],
    output: { total: 10_000 },
    status,
  };
}

/** Fully-populated AppData — every completeness check should pass. */
function makeData(overrides: Partial<AppData> = {}): AppData {
  return {
    profile: makeProfile(),
    revenues: [
      makeRevenue(),
      makeRevenue({ id: 'rev-2' }),
      makeRevenue({ id: 'rev-3', status: 'in-asteptare' }),
    ],
    expenses: [makeExpense()],
    clients: [makeClient()],
    declarations: [makeDeclaration()],
    documents: [makeDocument()],
    companyDocs: {
      im: [makeCompanyDocument()],
      cs: [],
      tva: [],
      facturi: [makeCompanyDocument({ id: 'cdoc-2', tip: 'pdf' })],
    },
    statements: [makeStatement()],
    snapshots: [makeSnapshot('computed')],
    settings: {} as SettingsState,
    ...overrides,
  };
}

/** Empty AppData (seed-like: snapshots: []) — every check should fail. */
function makeEmptyData(): AppData {
  return {
    profile: null as unknown as PfaProfile,
    revenues: [],
    expenses: [],
    clients: [],
    declarations: [],
    documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] },
    statements: [],
    snapshots: [],
    settings: {} as SettingsState,
  };
}

const CHECK_KEYS = [
  'profile',
  'income',
  'expenses',
  'clients',
  'documents',
  'companyDocuments',
  'declarations',
  'statements',
  'taxEstimate',
];

describe('assessCompleteness', () => {
  it('reports every check unsatisfied for empty data without crashing', () => {
    const report = assessCompleteness(makeEmptyData());
    expect(report.totalCount).toBe(9);
    expect(report.satisfiedCount).toBe(0);
    expect(report.checks.map(c => c.key)).toEqual(CHECK_KEYS);
    for (const check of report.checks) {
      expect(check.satisfied).toBe(false);
    }
    expect(report.checks[0].detail).toBe('profil lipsă');
    expect(report.checks[1].detail).toBe('nu există înregistrări de venituri');
    expect(report.checks[8].detail).toBe('nu există instantanee de taxe');
  });

  it('reports every check satisfied for fully-populated data', () => {
    const report = assessCompleteness(makeData());
    expect(report.totalCount).toBe(9);
    expect(report.satisfiedCount).toBe(9);
    for (const check of report.checks) {
      expect(check.satisfied).toBe(true);
    }
  });

  it('reports a mixed report for partial data', () => {
    const data = makeData({
      expenses: [],
      statements: [],
      snapshots: [makeSnapshot('superseded')],
    });
    const report = assessCompleteness(data);
    expect(report.totalCount).toBe(9);
    expect(report.satisfiedCount).toBe(6);
    const byKey = Object.fromEntries(report.checks.map(c => [c.key, c]));
    expect(byKey.expenses.satisfied).toBe(false);
    expect(byKey.expenses.detail).toBe('nu există înregistrări de cheltuieli');
    expect(byKey.statements.satisfied).toBe(false);
    expect(byKey.statements.detail).toBe('nu există situații de taxe');
    expect(byKey.taxEstimate.satisfied).toBe(false);
    expect(byKey.taxEstimate.detail).toBe('nicio estimare de taxe calculată (0 din 1 instantanee calculate)');
  });

  it('satisfies the tax estimate check only when a snapshot is computed', () => {
    const withComputed = assessCompleteness(
      makeData({ snapshots: [makeSnapshot('computed'), makeSnapshot('superseded')] }),
    ).checks.find(c => c.key === 'taxEstimate')!;
    expect(withComputed.satisfied).toBe(true);
    expect(withComputed.detail).toBe('1 estimare de taxe calculată disponibilă');

    const withoutComputed = assessCompleteness(
      makeData({ snapshots: [makeSnapshot('superseded'), makeSnapshot('void')] }),
    ).checks.find(c => c.key === 'taxEstimate')!;
    expect(withoutComputed.satisfied).toBe(false);
    expect(withoutComputed.detail).toBe('nicio estimare de taxe calculată (0 din 2 instantanee calculate)');
  });

  it('satisfies the company documents check when any section has entries', () => {
    const onlyIm = assessCompleteness(
      makeData({
        companyDocs: {
          im: [makeCompanyDocument()],
          cs: [],
          tva: [],
          facturi: [],
        },
      }),
    ).checks.find(c => c.key === 'companyDocuments')!;
    expect(onlyIm.satisfied).toBe(true);
    expect(onlyIm.detail).toBe('1 document de firmă prezent (im: 1)');

    const onlyFacturi = assessCompleteness(
      makeData({
        companyDocs: {
          im: [],
          cs: [],
          tva: [],
          facturi: [makeCompanyDocument({ id: 'cdoc-2', tip: 'pdf' })],
        },
      }),
    ).checks.find(c => c.key === 'companyDocuments')!;
    expect(onlyFacturi.satisfied).toBe(true);
    expect(onlyFacturi.detail).toBe('1 document de firmă prezent (facturi: 1)');
  });

  it('notes inregistrata income records in the income detail', () => {
    const income = assessCompleteness(makeData()).checks.find(c => c.key === 'income')!;
    // 3 revenues, 2 with status 'inregistrata'
    expect(income.detail).toBe('3 înregistrări de venituri prezente (2 înregistrate)');
  });

  it('reports profile details with fiscal year and regime', () => {
    const ok = assessCompleteness(makeData()).checks.find(c => c.key === 'profile')!;
    expect(ok.satisfied).toBe(true);
    expect(ok.detail).toBe('profil prezent (an fiscal 2026, regim impozit pe venit)');

    const noFiscalYear = assessCompleteness(
      makeData({ profile: { ...makeProfile(), fiscalYear: 0 } }),
    ).checks.find(c => c.key === 'profile')!;
    expect(noFiscalYear.satisfied).toBe(false);
    expect(noFiscalYear.detail).toBe('profil prezent, dar an fiscal nesetat');
  });

  it('reports profile unsatisfied when regime is an empty string', () => {
    const noRegime = assessCompleteness(
      makeData({ profile: { ...makeProfile(), regime: '' as unknown as PfaRegime } }),
    ).checks.find(c => c.key === 'profile')!;
    expect(noRegime.satisfied).toBe(false);
    expect(noRegime.detail).toBe('profil prezent, dar regim nesetat');
  });

  it('is deterministic for identical inputs', () => {
    const data = makeData();
    expect(assessCompleteness(data)).toEqual(assessCompleteness(data));
  });

  it('carries no percentage or score field — only counts', () => {
    const report = assessCompleteness(makeData());
    expect(Object.keys(report).sort()).toEqual(['checks', 'satisfiedCount', 'totalCount']);
  });
});
