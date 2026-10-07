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
  getThresholdStatuses,
  buildThresholdBases,
  buildDashboardData,
  getUpcomingDeadlines,
} from './dashboard';
import { seedData } from './seed';
import { selectYtd } from '../domain/aggregation';
import { THRESHOLD_SPECS } from '../domain/thresholds';

const AS_OF = '2026-10-01';
// B-23 standing rule: no test may read the wall clock. `buildDashboardData` and `getActionItems` take an
// injectable `instant`; without it their `asOfDate` comes from `now()`. Pinned to the same local day as
// AS_OF (Romania is UTC+3 on 2026-10-01), so the pinned instant and the pinned as-of date agree.
const AS_OF_INSTANT = new Date('2026-10-01T12:00:00+03:00');

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
    const dashboard = buildDashboardData(data, tax, AS_OF_INSTANT);

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

// Phase 8 — amount semantics. These run against the REAL app seed (`seedData`), because the
// acceptance criteria are about the figures the dashboard actually shows, not synthetic inputs.
// Seeded `inregistrata` amounts: revenues 4500+945 and 3200+672; expenses 120+25.2 and 85.5+17.96.
describe('threshold bases (Phase 8 — amount semantics, on seeded data)', () => {
  const AS_OF_SEED = '2026-12-31';

  it('VAT_REGISTRATION is measured on VAT-exclusive turnover, which differs from the VAT-inclusive figure', async () => {
    const tax = await getTaxEstimate(seedData, AS_OF_SEED);
    const rows = getThresholdStatuses(seedData, AS_OF_SEED, tax);
    const ytd = selectYtd(seedData, AS_OF_SEED);
    const vat = rows.find((t) => t.thresholdId === 'VAT_REGISTRATION')!;

    expect(vat.fiscalBase).toBe('revenue-excl-vat');
    expect(vat.currentValue).toBe(7700); // 4500 + 3200, valoareFaraTva only
    // The figure it used to be measured on — and it is a different number, because the seed
    // carries non-zero TVA. This is the assertion that would fail before Phase 8.
    expect(ytd.revenue).toBe(9317);
    expect(vat.currentValue).not.toBe(ytd.revenue);
    expect(vat.thresholdValue).toBe(395000);
  });

  it('the three contribution rows are measured on the engine contribution base, never on gross revenue', async () => {
    const tax = await getTaxEstimate(seedData, AS_OF_SEED);
    const rows = getThresholdStatuses(seedData, AS_OF_SEED, tax);
    const ytd = selectYtd(seedData, AS_OF_SEED);
    const contribution = rows.filter((t) => t.affectedTax === 'cas' || t.affectedTax === 'cass');

    expect(contribution.map((t) => t.thresholdId).sort()).toEqual([
      'CASS_MAX_BASE',
      'CASS_MIN_BASE',
      'CAS_MIN_BASE',
    ]);
    for (const t of contribution) {
      expect(t.fiscalBase).toBe('net-income');
      expect(t.currentValue).toBe(7494.5); // 7700 - 205.5, net of VAT
      // No contribution row may compare a contribution base to a turnover figure.
      expect(t.currentValue).not.toBe(ytd.revenue);
      // `YtdTotals.net` is VAT-INCLUSIVE profit (9068.34) and is NOT the fiscal VNA (7494.50).
      expect(t.currentValue).not.toBe(ytd.net);
    }
  });

  it('the contribution base is the engine value, not a re-derived aggregate', async () => {
    const tax = await getTaxEstimate(seedData, AS_OF_SEED);
    expect(tax.status).toBe('computed');
    if (tax.status !== 'computed') return;
    expect(buildThresholdBases(selectYtd(seedData, AS_OF_SEED), tax)['net-income']).toBe(
      tax.bases.venitulNetDinActivitate,
    );
  });

  it('the production caller supplies a base for every spec — no card is dropped', async () => {
    const tax = await getTaxEstimate(seedData, AS_OF_SEED);
    const rows = getThresholdStatuses(seedData, AS_OF_SEED, tax);
    // This is the guard against the silent-skip trap firing in the app: every spec must come
    // back measured, on the base its spec declares.
    expect(rows).toHaveLength(THRESHOLD_SPECS.length);
    for (const spec of THRESHOLD_SPECS) {
      const row = rows.find((t) => t.thresholdId === spec.thresholdId)!;
      expect(row, `${spec.thresholdId} was dropped`).toBeDefined();
      expect(row.fiscalBase).toBe(spec.requiredFiscalBase);
      expect(row.status).not.toBe('review_required');
      expect(row.currentValue).not.toBeNull();
    }
  });

  it('when the engine declines, contribution rows become review_required rather than claiming a base', () => {
    const rows = getThresholdStatuses(seedData, AS_OF_SEED, {
      status: 'review_required',
      reason: 'test',
      lines: [],
    });
    expect(rows).toHaveLength(THRESHOLD_SPECS.length); // still four, none vanished
    for (const id of ['CAS_MIN_BASE', 'CASS_MIN_BASE', 'CASS_MAX_BASE']) {
      const row = rows.find((t) => t.thresholdId === id)!;
      expect(row.status).toBe('review_required');
      expect(row.currentValue).toBeNull();
    }
    // VAT turnover is still measurable without the engine, so it stays measured.
    expect(rows.find((t) => t.thresholdId === 'VAT_REGISTRATION')!.currentValue).toBe(7700);
  });

  it('acceptance 6: the seeded taxable base is identical before and after the semantics change', async () => {
    const tax = await getTaxEstimate(seedData, AS_OF_SEED);
    expect(tax.status).toBe('computed');
    if (tax.status !== 'computed') return;
    // Measured on HEAD before Phase 8 and re-measured after: byte-identical.
    expect(tax.bases).toEqual({
      venitulBrut: 7700,
      cheltuieliDeductibile: 205.5,
      venitulNetDinActivitate: 7494.5,
    });
    const line = (l: string) => tax.lines.find((x) => x.label === l)!.value;
    expect(line('Venit brut')).toBe(7700);
    expect(line('Cheltuieli deductibile')).toBe(205.5);
    expect(line('Venit net din activitate')).toBe(7494.5);
    expect(line('Venit net anual impozabil (art. 118 alin. (2) lit. b))')).toBeCloseTo(6745.05, 6);
    expect(tax.output.total).toBeCloseTo(3104.505, 6);
  });
});

describe('getActionItems (sync)', () => {
  it('returns an array of well-formed action items', () => {
    const items = getActionItems(makeData({ revenues: [revenue()] }), AS_OF_INSTANT);
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

// --- Phase 9, item 2: B-20 — `snapshot.thresholds[].breached` must agree with the domain ------
// `buildSnapshot` used to re-derive the flag as `distance > 0`. `distance` is
// `currentValue - thresholdValue`, so for a `min-base` (floor) row a breach is `distance < 0`:
// the old expression inverted exactly the floor rows and contradicted `thresholds.ts` `statusFor`,
// which already branches on the threshold type. `insights.ts` filters on this flag, so two real
// breaches (CAS_MIN_BASE, CASS_MIN_BASE) never reached Observații while Praguri showed `Depășit`.
describe('snapshot.thresholds[].breached (B-20)', () => {
  const AS_OF_SEED = '2026-12-31';
  // `buildDashboardData` derives asOfDate from `instant` in LOCAL time, so pass an unambiguous
  // local date rather than an ISO string that a timezone could shift.
  const INSTANT = new Date(2026, 11, 31, 12);

  it('agrees with the domain status for every threshold row', async () => {
    const tax = await getTaxEstimate(seedData, AS_OF_SEED);
    const dashboard = buildDashboardData(seedData, tax, INSTANT);
    for (const row of dashboard.thresholds) {
      const snapRow = dashboard.snapshot.thresholds.find((s) => s.id === row.thresholdId);
      expect(snapRow, `no snapshot row for ${row.thresholdId}`).toBeDefined();
      expect(snapRow!.breached).toBe(row.status === 'breached');
    }
  });

  it('marks a floor (min-base) row breached when the measured value is BELOW the floor', async () => {
    const tax = await getTaxEstimate(seedData, AS_OF_SEED);
    const dashboard = buildDashboardData(seedData, tax, INSTANT);
    const floors = dashboard.thresholds.filter((t) => t.type === 'min-base');
    expect(floors.map((t) => t.thresholdId).sort()).toEqual(['CASS_MIN_BASE', 'CAS_MIN_BASE']);
    for (const floor of floors) {
      // The seed's net income (7,494.50) is far below both statutory floors.
      expect(floor.distance).toBeLessThan(0);
      expect(floor.status).toBe('breached');
      const snapRow = dashboard.snapshot.thresholds.find((s) => s.id === floor.thresholdId)!;
      // This is the assertion that fails under the old `distance > 0` derivation.
      expect(snapRow.breached).toBe(true);
    }
  });

  it('surfaces the floor breach in Observații (the flag is what insights.ts filters on)', async () => {
    const tax = await getTaxEstimate(seedData, AS_OF_SEED);
    const dashboard = buildDashboardData(seedData, tax, INSTANT);
    const breaches = dashboard.insights.filter((i) => i.title.startsWith('Prag depășit:'));
    // CASS and CAS collapse into at most ONE canonical alert (canonicalCassCas), so exactly one.
    expect(breaches).toHaveLength(1);
    expect(breaches[0].severity).toBe('danger');
    expect(breaches[0].id).toMatch(/^threshold-(CAS|CASS)_MIN_BASE$/);
  });
});

// --- Phase 9b: a PFA start date resolves NO deadline (brief 10 §2c) ---------------------------
// Phase 9 wired `pfaStartDate` into the deadline engine to resolve a "declarație estimativă" 15 days
// after the start date. That obligation does not exist in 2026: its basis (CF art. 120) is `Abrogat.`
// from 01-01-2025 (OUG 128/2024 pct. 11 Art. I, MO 1125/11.11.2024), and the CPF art. 82 alin. (6)
// lit. c) 30-day `declarație de înregistrare fiscală` excludes precisely the persons who register at
// registrul comerțului — which OUG 44/2008 art. 7 alin. (1) makes mandatory for a PFA, while art. 13
// alin. (3) of that act makes the ONRC certificate itself the act of fiscal taking-into-evidence.
// A first D.212 for a PFA opened at any point in 2026 is due by 25 May 2027: CF art. 122 alin. (3)
// extends the term to the alin. (2) start-of-activity case verbatim. The field stays on the query and
// these tests pin the silence: it must resolve nothing.
describe('a PFA start date resolves no deadline', () => {
  it('produces exactly the same upcoming deadlines with and without a start date', () => {
    const withStart = getUpcomingDeadlines(
      makeData({ profile: profile({ pfaStartDate: '2026-11-01' }) }),
      '2026-11-05',
    );
    const withoutStart = getUpcomingDeadlines(makeData(), '2026-11-05');
    expect(withStart).toEqual(withoutStart);
  });

  it('resolves nothing but the D212 filing deadline, whatever the start date', () => {
    for (const pfaStartDate of ['2026-01-01', '2026-11-01', '2026-12-20']) {
      const upcoming = getUpcomingDeadlines(
        makeData({ profile: profile({ pfaStartDate }) }),
        '2026-11-05',
      );
      expect(upcoming.map((d) => d.deadlineId)).toEqual(['PFA_DEADLINE_2026']);
      expect(upcoming.map((d) => d.date)).toEqual(['2027-05-25']);
    }
  });

  it('never surfaces a VAT registration deadline, because no profile records an exceedance date', () => {
    const upcoming = getUpcomingDeadlines(
      makeData({ profile: profile({ pfaStartDate: '2026-11-01' }) }),
      '2026-11-05',
    );
    expect(upcoming.some((d) => d.eventType === 'vat_registration')).toBe(false);
  });
});
