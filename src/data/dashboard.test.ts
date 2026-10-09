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
  getTaxReserve,
} from './dashboard';
import { selectEstimateOperands } from '../domain/estimateBasis';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../domain/fiscal';
import { seedData } from './seed';
import { selectYtd } from '../domain/aggregation';
import { computeInputsHashSync } from '../domain/snapshots/hashSync';
import { backfillSnapshotIdentity } from './migration';
import { THRESHOLD_SPECS } from '../domain/thresholds';
import { lei, subBani, type Bani } from '../domain/money';

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
    cashFloorLei: lei(0),
    identity: identity(),
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

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
    valoareFaraTva: lei(1000),
    tva: lei(190),
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
    valoareFaraTva: lei(500),
    tva: lei(95),
    status: 'inregistrata',
    ...overrides,
  };
}

function declaration(overrides: Partial<Declaration> = {}): Declaration {
  return {
    id: 'decl-1',
    an: 2026,
    luna: 3,
    venituri: lei(0),
    cheltuieli: lei(0),
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
    expect(ytd.revenue).toBe(lei(1190));
    expect(ytd.expenses).toBe(0);
    expect(ytd.net).toBe(lei(1190));
  });

  it('revenue + expense → net is the difference', () => {
    const ytd = getFinancialSummary(makeData({ revenues: [revenue()], expenses: [expense()] }), AS_OF);
    expect(ytd.revenue).toBe(lei(1190));
    expect(ytd.expenses).toBe(lei(595));
    expect(ytd.net).toBe(lei(595));
  });
});

describe('getMonthlyFinancialSeries (sync)', () => {
  it('empty data → empty map', () => {
    const monthly = getMonthlyFinancialSeries(makeData(), AS_OF);
    expect(monthly.size).toBe(0);
  });

  it('a revenue → bucketed under its month', () => {
    const monthly = getMonthlyFinancialSeries(makeData({ revenues: [revenue()] }), AS_OF);
    expect(monthly.get('2026-03')?.revenue).toBe(lei(1190));
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
    expect(dashboard.snapshot.pfaRevenue).toBe(lei(1190));
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
    expect(vat.currentValue).toBe(lei(7700)); // 4500 + 3200, valoareFaraTva only
    // The figure it used to be measured on — and it is a different number, because the seed
    // carries non-zero TVA. This is the assertion that would fail before Phase 8.
    expect(ytd.revenue).toBe(lei(9317));
    expect(vat.currentValue).not.toBe(ytd.revenue);
    expect(vat.thresholdValue).toBe(lei(395000));
  });

  it('every contribution row is measured on the engine contribution base, never on gross revenue', async () => {
    const tax = await getTaxEstimate(seedData, AS_OF_SEED);
    const rows = getThresholdStatuses(seedData, AS_OF_SEED, tax);
    const ytd = selectYtd(seedData, AS_OF_SEED);
    const contribution = rows.filter((t) => t.affectedTax === 'cas' || t.affectedTax === 'cass');

    expect(contribution.map((t) => t.thresholdId).sort()).toEqual([
      'CASS_MAX_BASE',
      'CASS_MIN_BASE',
      'CAS_MIN_BASE',
      'CAS_TIER2_FLOOR',
    ]);
    for (const t of contribution) {
      expect(t.fiscalBase).toBe('net-income');
      // TASK 2b moved this figure: the engine's `net-income` base is built from the CONFIRMED-DEDUCTIBLE
      // subset, not from every recorded expense. Seed expenseNet was 205,50 lei (e1 120,00 + e2 85,50);
      // e2 is a Carrefour bon fiscal categorised `personal_or_family_use`, nedeductibilă expres prin
      // CF art. 68 alin. (7) lit. a), so the base is now 7.700,00 - 120,00 = 7.580,00 lei.
      expect(t.currentValue).toBe(lei(7580));
      // No contribution row may compare a contribution base to a turnover figure.
      expect(t.currentValue).not.toBe(ytd.revenue);
      // `YtdTotals.net` is VAT-INCLUSIVE profit (9068.34) and is NOT the fiscal VNA (7580.00).
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
    expect(rows).toHaveLength(THRESHOLD_SPECS.length); // still one row per spec, none vanished
    for (const id of ['CAS_MIN_BASE', 'CAS_TIER2_FLOOR', 'CASS_MIN_BASE', 'CASS_MAX_BASE']) {
      const row = rows.find((t) => t.thresholdId === id)!;
      expect(row.status).toBe('review_required');
      expect(row.currentValue).toBeNull();
    }
    // VAT turnover is still measurable without the engine, so it stays measured.
    expect(rows.find((t) => t.thresholdId === 'VAT_REGISTRATION')!.currentValue).toBe(lei(7700));
  });

  it('acceptance 6: the seeded taxable base is identical before and after the semantics change (Phase 10 moved only the art. 66 lines)', async () => {
    const tax = await getTaxEstimate(seedData, AS_OF_SEED);
    expect(tax.status).toBe('computed');
    if (tax.status !== 'computed') return;
    // Measured on HEAD before Phase 8 and re-measured after: byte-identical. Phase 10 leaves these
    // three BASES untouched — art. 66 rounds sums DUE, never a base or a deduction input.
    //
    // TASK 2b moves `cheltuieliDeductibile`, and that is the whole point of the task: the label stops
    // meaning "every expense" and starts meaning "the expenses a rule says are deductible". Derived by
    // hand before running, from seed.ts:
    //   e1 120,00 lei `postal_and_telecom`  -> deductibilă (Normele pct. 7 alin. (5) lit. j))
    //   e2  85,50 lei `personal_or_family_use` -> nedeductibilă (art. 68 alin. (7) lit. a))
    //   e3 340,00 lei `business_space_upkeep` -> exclusă de statusul 'respinsa', ca și până acum
    //   cheltuieli deductibile = 120,00 lei (a fost 205,50 lei)
    expect(tax.bases).toEqual({
      venitulBrut: lei(7700),
      cheltuieliDeductibile: lei(120),
      venitulNetDinActivitate: lei(7580),
    });
    const line = (l: string) => tax.lines.find((x) => x.label === l)!.value;
    expect(line('Venit brut')).toBe(lei(7700));
    expect(line('Cheltuieli deductibile')).toBe(lei(120));
    expect(line('Venit net din activitate')).toBe(lei(7580));
    // Phase 10 DOES move the deduction and everything downstream of it, because the deduction is a
    // sum DUE and is therefore rounded once by art. 66:
    //   CASS deductibilă 10% x 7.580,00 = 758,00 lei -> 0 bani -> 758,00 (a fost 749,00 din 7.494,50)
    //   base = 7.580,00 - 758,00 = 6.822,00 (a fost 6.745,50; baza e aritmetică întreagă pe linia deja
    //   rotunjită, nu se rotunjește ea însăși)
    expect(line('CASS deductibilă (art. 118 alin. (2^3), fără diferența art. 174 alin. (6))')).toBe(lei(758));
    expect(line('Venit net anual impozabil (art. 118 alin. (2) lit. b))')).toBe(lei(6822));
    //   income tax = 6.822,00 x 10% = 682,20 -> 20 bani <= 50 -> neglijat -> 682,00 (a fost 675,00)
    expect(line('Impozit pe venit (rată de bază 10%)')).toBe(lei(682));
    //   total = CASS owed 2430 + income tax 682 = 3.112,00 lei (a fost 3.105,00). CASS datorată rămâne
    //   2.430 lei — pragul de 6 SM din art. 174 alin. (6) nu depinde de cheltuieli.
    expect(tax.output.total).toBe(lei(3112));
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

// --- Phase 6 §7 item 5: the 24 SM CAS ladder step is a threshold of its own -------------------
// CF art. 148 alin. (2) sets FLOORS, never a ceiling (Phase 3 deleted CAS_MAX_BASE for asserting
// one), and lit. b) raises the floor to 24 SM once realised net income is "cel puțin egal cu" 24 SM.
// The step is therefore typed `tier-floor` and must be VISIBLE: the row and the doubled CAS amount
// read the same `tier2_base` parameter, so they cannot drift apart.
describe('CAS_TIER2_FLOOR — the 24 SM ladder step is surfaced (Phase 6 §7 item 5)', () => {
  const INSTANT = new Date(2026, 11, 31, 12);
  const AS_OF_SEED = '2026-12-31';

  it('is present on the seed, measured on the contribution base, and not crossed', async () => {
    const tax = await getTaxEstimate(seedData, AS_OF_SEED);
    const rows = getThresholdStatuses(seedData, AS_OF_SEED, tax);
    const row = rows.find((t) => t.thresholdId === 'CAS_TIER2_FLOOR')!;
    expect(row.type).toBe('tier-floor');
    expect(row.thresholdValue).toBe(lei(97200));
    expect(row.currentValue).toBe(lei(7580)); // TASK 2b: 7.700,00 - 120,00 (was 7.494,50)
    // Far below the tier, so the tier-1 floor applies and nothing is flagged.
    expect(row.status).toBe('ok');

    const dashboard = buildDashboardData(seedData, tax, INSTANT);
    const snapRow = dashboard.snapshot.thresholds.find((s) => s.id === 'CAS_TIER2_FLOOR')!;
    // The family survives into the snapshot: `insights.ts` words the alert from it, and a ladder
    // step must not be described as a limit breach.
    expect(snapRow.type).toBe('tier-floor');
    expect(snapRow.breached).toBe(false);
  });

  it('crossing 24 SM flags the row AND doubles the CAS the engine computes, from one figure', async () => {
    const data = makeData({ revenues: [revenue({ valoareFaraTva: lei(120000), tva: lei(0) })] });
    const tax = await getTaxEstimate(data, AS_OF_SEED);
    expect(tax.status).toBe('computed');

    const row = getThresholdStatuses(data, AS_OF_SEED, tax).find(
      (t) => t.thresholdId === 'CAS_TIER2_FLOOR',
    )!;
    expect(row.currentValue).toBe(lei(120000));
    expect(row.status).toBe('breached');

    // The same input, read through the calculator, lands on the tier-2 floor (25% × 97.200).
    const casLine = tax.lines.find((l) => l.label === 'CAS (25%)')!;
    expect(casLine.value).toBe(lei(24300));

    const dashboard = buildDashboardData(data, tax, INSTANT);
    const snapRow = dashboard.snapshot.thresholds.find((s) => s.id === 'CAS_TIER2_FLOOR')!;
    expect(snapRow.breached).toBe(true);
    expect(snapRow.type).toBe('tier-floor');
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

// --- P-PROFILE-VAT-DATE: the rule was wired, the input was missing ---------------------------
// Since Phase 9b `VAT_REGISTRATION_DEADLINE_2026` has been correct, cited and rule-driven: the
// deadline is the exceedance date itself (`offset_days = 0`, CF art. 316 alin. (1) lit. b)
// „cel târziu la data depășirii plafonului” + alin. (1^1) lit. b), OG 22/2025 Art. I pct. 18-19,
// MO 806/29.08.2025; ceiling art. 310 alin. (1)). It still never fired, because no profile field
// recorded the date and `DeadlineQuery.vatExceedanceDate` was populated nowhere in production.
// The fix is the field, not the rule: nothing in `deadlines.ts` or `package2026.ts` changed here.
describe('the VAT exceedance date reaches the deadline engine (P-PROFILE-VAT-DATE)', () => {
  it('produces a vat_registration deadline dated on the exceedance date itself', () => {
    const upcoming = getUpcomingDeadlines(
      makeData({ profile: profile({ vatExceedanceDate: '2026-11-20' }) }),
      '2026-11-05',
    );
    const vat = upcoming.filter((d) => d.eventType === 'vat_registration');
    expect(vat).toHaveLength(1);
    // offset_days = 0: the obligation lands on the day the ceiling was crossed, not a month end
    // and not a 30-day term (that was B-22's `month_end + 30` fabrication).
    expect(vat[0].date).toBe('2026-11-20');
    expect(vat[0].status).toBe('active');
    expect(vat[0].appliesTo).toBe('vat-registered-pfa');
    expect(vat[0].dateFormula).toContain('vat_exceedance');
    // The citation travels with the rule, not with the caller.
    expect(vat[0].legalSource.article).toContain('art. 316');
  });

  it('still produces NO VAT deadline when the profile records no exceedance date', () => {
    // Silence is the correct outcome, and it must stay correct: the engine has no source for the
    // date and must not invent one. This is the half of the acceptance criterion that keeps the
    // pre-fix behaviour honest.
    const upcoming = getUpcomingDeadlines(makeData(), '2026-11-05');
    expect(upcoming.some((d) => d.eventType === 'vat_registration')).toBe(false);
    expect(upcoming.map((d) => d.deadlineId)).toEqual(['PFA_DEADLINE_2026']);
  });

  it('the dashboard snapshot and the deadline section cannot disagree about it', async () => {
    const data = makeData({ profile: profile({ vatExceedanceDate: '2026-11-20' }) });
    const view = buildDashboardData(data, await getTaxEstimate(data, AS_OF), AS_OF_INSTANT);
    const snapshotVat = view.snapshot.deadlines.filter((d) => d.id === 'VAT_REGISTRATION_DEADLINE_2026');
    expect(snapshotVat).toHaveLength(1);
    expect(snapshotVat[0].date).toBe('2026-11-20');
    // Same query, same obligations: for this data the card and the snapshot list the same set.
    expect(view.snapshot.deadlines.map((d) => d.id).sort()).toEqual(
      getUpcomingDeadlines(data, AS_OF).map((d) => d.deadlineId).sort(),
    );
  });

  it('an exceedance date already in the past is not shown as upcoming, but is still resolved', async () => {
    // The rule's own comment is explicit: a resolved VAT registration deadline can only classify as
    // `past` or `due_today`, so `filterUpcoming` never shows it — "N zile rămase" would be a lie.
    // Hiding it from the card must not mean the engine forgot the obligation: the snapshot keeps the
    // real date, which is what distinguishes "no input" from "input, already elapsed".
    const data = makeData({ profile: profile({ vatExceedanceDate: '2026-01-10' }) });
    const upcoming = getUpcomingDeadlines(data, AS_OF);
    expect(upcoming.some((d) => d.eventType === 'vat_registration')).toBe(false);
    const view = buildDashboardData(data, await getTaxEstimate(data, AS_OF), AS_OF_INSTANT);
    const resolved = view.snapshot.deadlines.find((d) => d.id === 'VAT_REGISTRATION_DEADLINE_2026');
    expect(resolved?.date).toBe('2026-01-10');
  });
});

/**
 * Task 1 (pre-Phase-11) - the annual estimate is fed the projection, and the record says so.
 *
 * getTaxEstimate is the test-facing twin of the live path (derived.ts useLatestTaxEstimate); both go
 * through estimateBasis.ts, so pinning the operands here pins the quantity the dashboard renders.
 */
describe('getTaxEstimate - the projected basis enters the engine and the snapshot records it', () => {
  it('feeds the run-rate operands and reports both the actuals and the projection', async () => {
    const est = await getTaxEstimate(seedData, '2026-10-31');
    if (est.status !== 'computed') throw new Error('expected a computed estimate');
    if (est.basis.kind !== 'annual-projected') throw new Error('expected an annual-projected basis');

    // Seed YTD (every record is September 2026, only 'inregistrata' counts). TASK 2b: the operand is the
    // CONFIRMED-DEDUCTIBLE subset, so expenseNet is e1's 120,00 lei — e2 (85,50 lei,
    // `personal_or_family_use`, art. 68 alin. (7) lit. a)) is classified out before aggregation.
    // 2026-10-31 -> 10 elapsed months -> x 12/10.
    expect(est.basis.elapsedMonths).toBe(10);
    expect(est.basis.actual.revenuesNet).toBe(lei(7700));
    expect(est.basis.actual.expensesNet).toBe(lei(120));
    expect(est.basis.projected.revenuesNet).toBe(lei(9240));
    expect(est.basis.projected.expensesNet).toBe(lei(144)); // 120,00 x 1,2
    // The engine ran on the projected pair and says so in its own bases:
    expect(est.bases.venitulBrut).toBe(lei(9240));
    expect(est.bases.cheltuieliDeductibile).toBe(lei(144));
    expect(est.bases.venitulNetDinActivitate).toBe(lei(9096)); // 9.240,00 - 144,00
    // CASS owed 2.430 (art. 174 alin. (6) difference to the 6 SM floor; only 10% x VNA = 909,60 ->
    // art. 66, 60 bani > 50 -> 910,00 is deductible) + impozit 10% x 8.186,00 = 818,60 ->
    // art. 66, 60 bani > 50 -> 819,00. Total 2.430 + 819 = 3.249,00 lei.
    expect(est.output.total).toBe(lei(3249));
  });

  it('the estimate tracks the basis: another date is another run rate and another record', async () => {
    const oct = await getTaxEstimate(seedData, '2026-10-31');
    const sep = await getTaxEstimate(seedData, '2026-09-30');
    if (oct.status !== 'computed' || sep.status !== 'computed') throw new Error('expected both to compute');
    if (sep.basis.kind !== 'annual-projected') throw new Error('expected an annual-projected basis');

    expect(sep.basis.elapsedMonths).toBe(9);
    // 2026-09-30 -> 9 elapsed months -> x 12/9. Derived by hand:
    //   revenueNet 7.700,00 x 12/9 = 10.266,67 lei; expenseNet 120,00 x 12/9 = 160,00 lei
    //   VNA 10.106,67; CASS deductibilă 10% x 10.106,67 = 1.010,667 -> art. 66 -> 1.011,00
    //   bază 10.106,67 - 1.011,00 = 9.095,67; impozit 909,567 -> art. 66 -> 910,00
    //   total 2.430 + 910 = 3.340,00 lei (a fost 3.329,00)
    expect(sep.output.total).toBe(lei(3340)); // shorter year -> higher run rate -> higher annual figure
    expect(oct.output.total).toBe(lei(3249));
    // The snapshot digests the operands that entered the engine, so the two runs are distinguishable in
    // the persisted record, not only on screen.
    expect(sep.snapshot.inputsHash).not.toBe(oct.snapshot.inputsHash);
    // And each record is self-verifying: the digest matches the operands it stores.
    expect(computeInputsHashSync(oct.snapshot.inputSnapshot)).toBe(oct.snapshot.inputsHash);
    expect(computeInputsHashSync(sep.snapshot.inputSnapshot)).toBe(sep.snapshot.inputsHash);
  });

  it('at year end the projection is the identity, reproducing the pre-Task-1 figure exactly', async () => {
    const est = await getTaxEstimate(seedData, '2026-12-31');
    if (est.status !== 'computed') throw new Error('expected a computed estimate');
    expect(est.bases.venitulBrut).toBe(lei(7700));
    expect(est.bases.cheltuieliDeductibile).toBe(lei(120));
    expect(est.output.total).toBe(lei(3112));
  });

  it('TASK 2b: the classification reaches the engine — recategorising one expense moves the taxable base', async () => {
    // The acceptance criterion in one pair of assertions: `cheltuieliDeductibile` is no longer "every
    // expense". e2 is seeded as `personal_or_family_use` (art. 68 alin. (7) lit. a), nedeductibilă);
    // giving it a deductible category puts the same 85,50 lei back into the base.
    const recategorised = {
      ...seedData,
      expenses: seedData.expenses.map((e) =>
        e.id === 'e2' ? { ...e, category: 'postal_and_telecom' as const } : e,
      ),
    };
    const excluded = await getTaxEstimate(seedData, '2026-12-31');
    const included = await getTaxEstimate(recategorised, '2026-12-31');
    if (excluded.status !== 'computed' || included.status !== 'computed') {
      throw new Error('expected both to compute');
    }
    expect(excluded.bases.cheltuieliDeductibile).toBe(lei(120));
    // 120,00 (e1) + 85,50 (e2) = 205,50 — the pre-Task-2b figure, now reachable only because the
    // category says the expense is deductible.
    expect(included.bases.cheltuieliDeductibile).toBe(lei(205.5));
  });

  it('TASK 2b: a payload whose expenses carry no category deducts nothing — the migrated-data case', async () => {
    const stripped = {
      ...seedData,
      expenses: seedData.expenses.map((e) => {
        const { category: _category, ...rest } = e;
        return rest;
      }),
    };
    const est = await getTaxEstimate(stripped, '2026-12-31');
    if (est.status !== 'computed') throw new Error('expected a computed estimate');
    expect(est.bases.cheltuieliDeductibile).toBe(lei(0));
    // It still computes: `undetermined` excludes an expense, it does not stop the estimate.
    expect(est.bases.venitulNetDinActivitate).toBe(lei(7700));
  });

  it('a post-Task-1 snapshot needs no hash migration: the guards leave an untouched digest alone', async () => {
    // Phase 10 established the rule this pins: a migration step re-derives inputsHash ONLY when it
    // actually changed the bytes inside inputSnapshot. Task 1 changes what FUTURE snapshots contain, not
    // a single stored byte, so no new step is required - and adding one would be a blanket re-hash that
    // rewrites what every stored record claims it ever contained.
    const est = await getTaxEstimate(seedData, '2026-10-31');
    if (est.status !== 'computed') throw new Error('expected a computed estimate');
    const backfilled = backfillSnapshotIdentity(est.snapshot);
    expect(backfilled).toBe(est.snapshot); // nothing to add -> the same object, digest intact
    expect(backfilled.preMigrationInputsHash).toBeUndefined();
    expect(computeInputsHashSync(backfilled.inputSnapshot)).toBe(backfilled.inputsHash);
  });
});

/**
 * TASK 3 — the reserve is persisted, and BOTH read sites consume it.
 *
 * Before this task both sites hardcoded `createTaxReserveState(null)`, so the „Rezervă fiscală sub
 * țintă” warning could never be cleared: whatever the user had actually set aside, the app reported
 * nothing reserved. The two properties pinned here are:
 *  1. the tri-state survives — `null` („no reserve recorded”) is not `0` („recorded nothing”); and
 *  2. the liability the reserve reports is the total of the estimate it was handed, never one it
 *     derived for itself. After TASK 2d a self-derived reserve can disagree with the dashboard by
 *     exactly the two alin. (6) ceilings apart, with nothing on screen saying which figure is right.
 *
 * Every figure below is hand-derived: the seed at 2026-10-31 gives total 3.249,00 lei over the 3
 * remaining months of the fiscal year (the same arithmetic the e2e suite pins at 1.083,00 lei/month).
 */
describe('TASK 3 — the persisted reserve feeds both read sites', () => {
  const AS_OF = '2026-10-31';
  // `buildDashboardData` derives its asOfDate from an injectable instant (B-23: no test reads the
  // wall clock). 12:00 Europe/Bucharest on the same calendar day as AS_OF.
  const INSTANT = new Date('2026-10-31T12:00:00+03:00');

  const withReserve = (reservedAmount: Bani | null): AppData => ({ ...seedData, reservedAmount });

  it('an unrecorded reserve stays null at both sites, and the target is the whole liability', async () => {
    const data = withReserve(null);
    const est = await getTaxEstimate(data, AS_OF);
    if (est.status !== 'computed') throw new Error('expected a computed estimate');
    expect(est.output.total).toBe(lei(3249));

    const rec = getTaxReserve(data, AS_OF, est);
    expect(rec.estimatedTaxLiability).toBe(lei(3249));
    // null, not 0: the user recorded nothing, and the card must say so rather than show 0,00 lei.
    expect(rec.reservedAmount).toBeNull();
    expect(rec.remainingTarget).toBe(lei(3249));
    expect(rec.monthsRemaining).toBe(3);
    expect(rec.recommendedMonthlyReserve).toBe(lei(1083));

    const view = buildDashboardData(data, est, INSTANT);
    expect(view.reserve.reservedAmount).toBeNull();
    expect(view.snapshot.taxReserve.gapBani).toBe(lei(3249));
  });

  it('an explicit 0 lei reserve is a different fact from null', async () => {
    const data = withReserve(lei(0));
    const est = await getTaxEstimate(data, AS_OF);
    const rec = getTaxReserve(data, AS_OF, est);
    // The arithmetic coincides with the null case — and that is exactly why the STATE has to survive:
    // a reader must be able to tell „recorded nothing” from „never recorded anything”.
    expect(rec.reservedAmount).toBe(lei(0));
    expect(rec.reservedAmount).not.toBeNull();
    expect(rec.remainingTarget).toBe(lei(3249));
    expect(buildDashboardData(data, est, INSTANT).reserve.reservedAmount).toBe(lei(0));
  });

  it('a recorded reserve shrinks the target at BOTH sites, by the same amount', async () => {
    const data = withReserve(lei(1050));
    const est = await getTaxEstimate(data, AS_OF);
    if (est.status !== 'computed') throw new Error('expected a computed estimate');

    const rec = getTaxReserve(data, AS_OF, est);
    // 3.249,00 − 1.050,00 = 2.199,00 lei over 3 months = 733,00 lei/month, exact.
    expect(rec.reservedAmount).toBe(lei(1050));
    expect(rec.remainingTarget).toBe(lei(2199));
    expect(rec.recommendedMonthlyReserve).toBe(lei(733));

    // Site #2 — the snapshot that feeds the „Rezervă fiscală sub țintă” insight. It used to report 0
    // reserved no matter what, which is why the warning was unclearable.
    const view = buildDashboardData(data, est, INSTANT);
    expect(view.snapshot.taxReserve.currentReserveBani).toBe(lei(1050));
    expect(view.snapshot.taxReserve.gapBani).toBe(lei(2199));
    // The two sites cannot disagree: same persisted value, same handed-in estimate.
    expect(view.snapshot.taxReserve.gapBani).toBe(view.reserve.remainingTarget);
    expect(view.snapshot.taxReserve.currentReserveBani).toBe(view.reserve.reservedAmount);
  });

  it('a reserve larger than the liability leaves a zero target, never a negative one', async () => {
    const data = withReserve(lei(5000));
    const est = await getTaxEstimate(data, AS_OF);
    const rec = getTaxReserve(data, AS_OF, est);
    expect(rec.remainingTarget).toBe(lei(0));
    expect(rec.recommendedMonthlyReserve).toBe(lei(0));
    // Over-reserving is a fact the user recorded, so it is reported verbatim, not clamped away.
    expect(rec.reservedAmount).toBe(lei(5000));
    // And the warning is gone: the gap is 0, which is what makes it clearable at all.
    expect(buildDashboardData(data, est, INSTANT).snapshot.taxReserve.gapBani).toBe(lei(0));
  });

  it('the reserve consumes the estimate it is handed — it never re-derives one', async () => {
    const data = withReserve(null);
    const est = await getTaxEstimate(data, AS_OF);
    if (est.status !== 'computed') throw new Error('expected a computed estimate');
    // A total the data cannot produce (9.999,99 lei is not the seed estimate at any date). If either
    // site re-ran the estimate instead of reading the result it was given, this figure could not
    // appear — it would report 3.249,00 lei.
    const doctored = { ...est, output: { ...est.output, total: lei(9999.99) } };
    const rec = getTaxReserve(data, AS_OF, doctored);
    expect(rec.estimatedTaxLiability).toBe(lei(9999.99));
    expect(rec.remainingTarget).toBe(lei(9999.99));
    expect(buildDashboardData(data, doctored, INSTANT).snapshot.taxReserve.projectedLiabilityBani).toBe(
      lei(9999.99),
    );
  });

  it('on a profile with a struck alin. (6) ceiling the reserve reports the ENGINE total, not a re-derived one', async () => {
    // TASK 2d is why this is pinned: the operative alin. (6) base is pre-cap, so the engine's total for
    // a profile holding a capped expense is LOWER than the other reading's. A reserve that re-ran the
    // caps, or re-projected, would disagree with the dashboard by exactly the two ceilings apart.
    const capped: AppData = {
      ...seedData,
      reservedAmount: lei(500),
      expenses: [
        ...seedData.expenses,
        {
          id: 'e-cap',
          tip: 'factura',
          nr: 'FCT-CAP-1',
          date: '2026-06-10',
          furnizor: 'Furnizor Test',
          cui: 'RO00000000',
          valoareFaraTva: lei(1000),
          tva: lei(190),
          status: 'inregistrata',
          category: 'protocol',
        },
      ],
    };
    // Hand-derived at 2026-12-31 (projection = identity, revenuesNet 7.700,00 lei):
    //   alin. (6) base (pre-cap) = 7.700,00 − 120,00 (e1, the only uncapped deductible) = 7.580,00 lei
    //   protocol ceiling         = floor(7.580,00 × 2 %) = 151,60 lei; claimed 1.000,00 → allowed 151,60
    //   deductible total         = 120,00 + 151,60 = 271,60 lei
    const operands = selectEstimateOperands(capped, '2026-12-31', PFA_2026_SYSTEM_REAL_PACKAGE);
    if (operands.kind !== 'run') throw new Error('expected the estimate to run');
    expect(operands.capAdjustments).toHaveLength(1); // the profile genuinely exercises a ceiling

    const est = await getTaxEstimate(capped, '2026-12-31');
    if (est.status !== 'computed') throw new Error('expected a computed estimate');
    expect(est.bases.cheltuieliDeductibile).toBe(lei(271.6));

    const rec = getTaxReserve(capped, '2026-12-31', est);
    // The reserve's liability IS the engine's total — the capped, pre-cap-base one the dashboard shows.
    expect(rec.estimatedTaxLiability).toBe(est.output.total);
    expect(rec.remainingTarget).toBe(subBani(est.output.total, lei(500)));
  });
});
