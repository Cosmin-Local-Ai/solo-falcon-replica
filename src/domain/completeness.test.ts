import { describe, expect, it } from 'vitest';
import type {
  AnnualFiling,
  AppData,
  Client,
  CompanyDocument,
  DocumentItem,
  Expense,
  Revenue,
  SettingsState,
  TaxStatement,
} from '../data/types';
import type { RuleRelease } from './fiscal/rules';
import type { PfaProfile, PfaRegime } from './models';
import { assessCompleteness } from './completeness';
import type { CoverageReason, EstimateCoverageGap } from './estimateBasis';
import type { TaxCalculationSnapshot } from './snapshots/types';
import { lei, ron, type Bani } from './money';

/**
 * A coverage gap for the weighting tests: everything the weighting reads, with the rest defaulted.
 * The amounts are written in bani because that is what the weighting divides.
 */
function gap(over: { recordId: string; reason?: CoverageReason; amount?: Bani; kind?: 'revenue' | 'expense' }): EstimateCoverageGap {
  return {
    recordId: over.recordId,
    kind: over.kind ?? 'expense',
    reason: over.reason ?? 'unclassified',
    amount: over.amount ?? (10000 as Bani),
    currency: 'RON',
    fixTarget: `/${over.kind === 'revenue' ? 'revenues' : 'expenses'}#!/registered?f=${over.recordId}`,
    detail: 'test gap',
  };
}

function makeProfile(): PfaProfile {
  return {
    id: 'profile-test',
    pfaStartYear: 2024,
    // Phase 11 widened the `profile` completeness check to require the start date and the taxpayer's
    // name, because that is what the hero's „Completează profilul” now turns on. This fixture is the
    // fully-populated case, so it carries both.
    pfaStartDate: '2024-03-01',
    fiscalYear: 2026,
    regime: 'impozit_pe_venit',
    caen: '6201',
    salaryStatus: 'nu',
    pensionerStatus: 'nu',
    otherIncome: [],
    socialInsuranceStatus: 'obligatoriu',
    // PG-5: the fully-populated fixture is VAT-exempt, because that is the one VAT state the app can
    // call complete — a scutire de TVA removes the periodic return, so there is no filing period to
    // establish. The non-exempt case is tested on its own below, and it is NOT satisfied.
    vatExempt: true,
    cashFloorLei: lei(0),
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
    valoareFaraTva: ron(1000),
    tva: ron(190),
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
    valoareFaraTva: ron(500),
    tva: ron(95),
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

function makeFiling(): AnnualFiling {
  return {
    id: 'fil-2026',
    taxYear: 2026,
    form: 'D212',
    status: 'depusa',
    filedOn: '2027-05-12',
    reference: 'D212.2026.000042',
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
    inputSnapshot: { profile: makeProfile(), revenues: lei(100_000), expenses: lei(0) },
    inputsHash: '0'.repeat(64),
    calculationLines: [{ label: 'total', value: lei(10_000) }],
    output: { total: lei(10_000) },
    status,
  };
}

/** Fully-populated AppData — every completeness check should pass. */
function makeData(overrides: Partial<AppData> = {}): AppData {
  return {
    reservedAmount: null,
    profile: makeProfile(),
    revenues: [
      makeRevenue(),
      makeRevenue({ id: 'rev-2' }),
      makeRevenue({ id: 'rev-3', status: 'in-asteptare' }),
    ],
    expenses: [makeExpense()],
    clients: [makeClient()],
    filings: [makeFiling()],
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
    reservedAmount: null,
    profile: null as unknown as PfaProfile,
    revenues: [],
    expenses: [],
    clients: [],
    filings: [],
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
  // PG-5: `declarations` ("any declaration record exists") became `annualFiling` ("the return this
  // fiscal year owes is on the record"), and `vatFilingPeriod` states the one periodic obligation whose
  // period the recorded facts cannot fix.
  'annualFiling',
  'vatFilingPeriod',
  'statements',
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
    expect(report.checks[8].detail).toBe('nu există situații de taxe');
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
    expect(report.satisfiedCount).toBe(7);
    const byKey = Object.fromEntries(report.checks.map(c => [c.key, c]));
    expect(byKey.expenses.satisfied).toBe(false);
    expect(byKey.expenses.detail).toBe('nu există înregistrări de cheltuieli');
    expect(byKey.statements.satisfied).toBe(false);
    expect(byKey.statements.detail).toBe('nu există situații de taxe');
  });

  // PG-5, acceptance 3: the check reports the annual filing FOR THE RELEVANT YEAR. The predicate it
  // replaces was `list.length > 0` — literally "any declaration exists" — which a payload of monthly
  // rows satisfied while the one return that is actually owed sat unrecorded.
  describe('the annual filing check', () => {
    const byKey = (report: ReturnType<typeof assessCompleteness>) =>
      Object.fromEntries(report.checks.map(c => [c.key, c]));

    it('is satisfied when the return for the fiscal year is on the record as filed', () => {
      const report = assessCompleteness(makeData());
      const check = byKey(report).annualFiling;
      expect(check.satisfied).toBe(true);
      expect(check.detail).toBe('Declarația unică (D212) pentru 2026 depusă pe 12.05.2027');
    });

    it('is not satisfied by a filed return for a DIFFERENT year — the check is per year, not a count', () => {
      const data = makeData({
        filings: [{ id: 'fil-2025', taxYear: 2025, form: 'D212', status: 'depusa', filedOn: '2026-05-12' }],
      });
      const check = byKey(assessCompleteness(data, [], '2027-06-01', '2027-05-25')).annualFiling;
      expect(check.satisfied).toBe(false);
      expect(check.detail).toContain('pentru 2026');
    });

    it('is not satisfied by a full register of monthly rows', () => {
      // This is B-34 in one assertion: the old predicate returned true here.
      // PG-5b re-premise: the monthly record type is gone, so the register is handed over the way an
      // un-migrated payload holds it — cast through `unknown`, under the key the old bytes used. The
      // assertion is unchanged: rows that are not filings satisfy the annual check not at all, however
      // complete the register looks, and the v10→v11 step drops them before the app ever sees them.
      const data = makeData({
        filings: [],
        declarations: [
          { id: 'd1', an: 2026, luna: 3, venituri: lei(1000), cheltuieli: lei(100), status: 'inregistrata', dataInregistrare: '2026-04-10' },
          { id: 'd2', an: 2026, luna: 6, venituri: lei(1000), cheltuieli: lei(100), status: 'transmisa', dataInregistrare: '2026-07-08', dataTrimitere: '2026-07-15' },
        ],
      } as unknown as AppData);
      const check = byKey(assessCompleteness(data, [], '2027-06-01', '2027-05-25')).annualFiling;
      expect(check.satisfied).toBe(false);
      expect(check.detail).toBe('Declarația unică (D212) pentru 2026 nu este înregistrată; termenul a fost 25.05.2027');
    });

    it('a record that exists but was not filed is not a filing', () => {
      const data = makeData({
        filings: [{ id: 'fil-2026', taxYear: 2026, form: 'D212', status: 'in_pregatire' }],
      });
      const check = byKey(assessCompleteness(data, [], '2027-06-01', '2027-05-25')).annualFiling;
      expect(check.satisfied).toBe(false);
      expect(check.detail).toBe('Declarația unică (D212) pentru 2026 este înregistrată în aplicație dar nu este depusă');
    });

    it('before the term, an absent return is "not owed yet", not missing data', () => {
      // The distinction the whole phase turns on: absence before a due date is a state, not a gap.
      const report = assessCompleteness(makeData({ filings: [] }), [], '2026-10-31', '2027-05-25');
      const check = byKey(report).annualFiling;
      expect(check.satisfied).toBe(true);
      expect(check.detail).toBe('Declarația unică (D212) pentru 2026 nu se datorează încă — termenul este 25.05.2027');
    });

    it('with no rule package for the year it says the term cannot be established, and invents no date', () => {
      const report = assessCompleteness(makeData({ filings: [] }), [], '2027-06-01', null);
      const check = byKey(report).annualFiling;
      expect(check.satisfied).toBe(false);
      expect(check.detail).toBe('Declarația unică (D212) pentru 2026: termenul nu poate fi stabilit — niciun pachet de reguli pentru 2026');
    });
  });

  // PG-5, acceptance 4 (B-35): the VAT period is stated as the unknown it is.
  describe('the VAT filing period check (B-35)', () => {
    const byKey = (report: ReturnType<typeof assessCompleteness>) =>
      Object.fromEntries(report.checks.map(c => [c.key, c]));

    it('a non-exempt profile with no VAT registration date gets the admission, not a cadence', () => {
      const check = byKey(assessCompleteness(makeData({ profile: { ...makeProfile(), vatExempt: false } }))).vatFilingPeriod;
      expect(check.satisfied).toBe(false);
      expect(check.detail).toContain('nu poate fi stabilită');
      expect(check.detail).toContain('data înregistrării în TVA');
      expect(check.detail).toContain('CF art. 322 alin. (1)-(4)');
      // No asserted cadence, in either direction.
      expect(check.detail).not.toMatch(/trimestrial|lunar|D300/);
    });

    it('an exempt profile has no periodic return, which is a real satisfied state', () => {
      const check = byKey(assessCompleteness(makeData())).vatFilingPeriod;
      expect(check.satisfied).toBe(true);
      expect(check.detail).toContain('scutit de TVA');
    });

    it('a recorded exceedance date does not let the app name a period it has not been told', () => {
      // `vatExceedanceDate` is the date the ceiling was crossed; a taxpayer registered from the start
      // never had that event, so it still does not fix the period.
      const check = byKey(
        assessCompleteness(makeData({ profile: { ...makeProfile(), vatExempt: false, vatExceedanceDate: '2026-04-01' } })),
      ).vatFilingPeriod;
      expect(check.satisfied).toBe(false);
      expect(check.detail).toContain('nu poate fi stabilită');
    });
  });

  // PG-1, acceptance 6: the circular check is gone, and the reason it was circular is pinned so it
  // cannot come back under another name.
  it('has no check that reports whether an estimate was calculated', () => {
    const computed = assessCompleteness(makeData({ snapshots: [makeSnapshot('computed')] }));
    const neverCalculated = assessCompleteness(makeData({ snapshots: [] }));
    expect(computed.checks.map(c => c.key)).not.toContain('taxEstimate');
    // A computed snapshot and no snapshot at all produce the same checks: running a calculation is not
    // evidence about the data, and the old check was satisfied by exactly the failure it claimed to catch.
    expect(computed.checks.map(c => c.key)).toEqual(neverCalculated.checks.map(c => c.key));
    expect(computed.satisfiedCount).toBe(neverCalculated.satisfiedCount);
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

  /*
   * Phase 11 — the two facts the widened check adds. They are pinned here rather than only at the hero,
   * because the hero reads this report: if the check is wrong, the hero is wrong, and a second predicate
   * somewhere else would be the thing that finally makes the two disagree.
   */
  it('reports profile unsatisfied when the PFA start date is absent', () => {
    const noStart = assessCompleteness(
      makeData({ profile: { ...makeProfile(), pfaStartDate: undefined } }),
    ).checks.find(c => c.key === 'profile')!;
    expect(noStart.satisfied).toBe(false);
    expect(noStart.detail).toBe('profil prezent, dar data începerii activității nesetat');
  });

  it('reports profile unsatisfied when the taxpayer name is blank', () => {
    const noName = assessCompleteness(
      makeData({ profile: { ...makeProfile(), identity: { ...makeProfile().identity, nume: '   ' } } }),
    ).checks.find(c => c.key === 'profile')!;
    expect(noName.satisfied).toBe(false);
    expect(noName.detail).toBe('profil prezent, dar nume nesetat');
  });

  it('treats a malformed start date as absent, not as a date', () => {
    const badStart = assessCompleteness(
      makeData({ profile: { ...makeProfile(), pfaStartDate: '01.04.2026' } }),
    ).checks.find(c => c.key === 'profile')!;
    expect(badStart.satisfied).toBe(false);
  });

  it('is deterministic for identical inputs', () => {
    const data = makeData();
    expect(assessCompleteness(data)).toEqual(assessCompleteness(data));
  });

  it('carries the amount-weighted coverage beside the counts (PG-1)', () => {
    const report = assessCompleteness(makeData());
    expect(Object.keys(report).sort()).toEqual([
      'checks',
      'coverage',
      'satisfiedCount',
      'totalCount',
    ]);
  });

  describe('the weighted coverage (PG-1)', () => {
    // The fixture's eligible amounts: rev-1 1.000 lei + rev-2 1.000 lei + exp-1 500 lei = 2.500 lei,
    // i.e. 250 000 bani. `rev-3` is `in-asteptare`, so it is not eligible and does not sit in a
    // denominator nothing could ever satisfy.
    const RECORDED = 250000 as Bani;

    it('is 100 when nothing is kept out', () => {
      const coverage = assessCompleteness(makeData()).coverage;
      expect(coverage.recordedBani).toBe(RECORDED);
      expect(coverage.includedBani).toBe(RECORDED);
      expect(coverage.percent).toBe(100);
    });

    it('is null, not 0, when there is nothing recorded to weigh', () => {
      const coverage = assessCompleteness(makeEmptyData()).coverage;
      expect(coverage.recordedBani).toBe(0);
      expect(coverage.percent).toBeNull();
    });

    it('drops by the excluded amount, not by the record count', () => {
      const data = makeData();
      // One gap of a tenth of the recorded amount (250,00 lei) moves the figure ten points…
      const oneTenth = assessCompleteness(data, [gap({ recordId: 'exp-1', amount: 25000 as Bani })]).coverage;
      expect(oneTenth.percent).toBe(90);
      expect(oneTenth.includedBani).toBe(225000 as Bani);
      // …while three gaps of 2,50 lei each — three times as many records — move it by less than one.
      const threeTiny = assessCompleteness(data, [
        gap({ recordId: 'rev-1', kind: 'revenue', amount: 250 as Bani }),
        gap({ recordId: 'rev-2', kind: 'revenue', amount: 250 as Bani }),
        gap({ recordId: 'exp-1', amount: 250 as Bani }),
      ]).coverage;
      expect(threeTiny.percent).toBe(99);
    });

    it('does not let a legally non-deductible record lower the figure', () => {
      const settled = assessCompleteness(makeData(), [
        gap({ recordId: 'exp-1', reason: 'non_deductible' }),
      ]).coverage;
      expect(settled.percent).toBe(100);
    });

    it('never subtracts a gap for a record the denominator never counted', () => {
      const other = assessCompleteness(makeData(), [gap({ recordId: 'not-in-the-register' })]).coverage;
      expect(other.percent).toBe(100);
    });

    it('floors the percentage rather than rounding the last fraction up', () => {
      // 31 250 bani out of 250 000 is exactly 12,5 %: the app may claim 87 %, not 88 %.
      const odd = assessCompleteness(makeData(), [gap({ recordId: 'exp-1', amount: 31250 as Bani })]).coverage;
      expect(odd.percent).toBe(87);
    });

    it('excludes a record dated outside the fiscal year from the denominator', () => {
      const data = makeData({ expenses: [makeExpense({ date: '2025-06-02' })] });
      expect(assessCompleteness(data).coverage.recordedBani).toBe(200000 as Bani);
    });
  });
});
