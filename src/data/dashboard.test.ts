import { describe, expect, it } from 'vitest';
import type { AppData, Expense, Revenue } from './types';
import type { LegacyMonthlyDeclaration } from './schema';
import type { PfaIdentity, PfaProfile } from '../domain/models';
import {
  getFinancialSummary,
  getMonthlyFinancialSeries,
  getProjectedFinancialSeries,
  getDataCompleteness,
  getPendingCounts,
  getTaxEstimate,
  getActionItems,
  estimateProvenance,
  getLegislationState,
  getThresholdStatuses,
  buildThresholdBases,
  buildDashboardData,
  getUpcomingDeadlines,
  getTaxReserve,
} from './dashboard';
import { selectEstimateOperands } from '../domain/estimateBasis';
import type { TaxEstimateResult } from '../domain/tax';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../domain/fiscal';
import { seedData } from './seed';
import { selectYtd } from '../domain/aggregation';
import { computeInputsHashSync } from '../domain/snapshots/hashSync';
import { backfillSnapshotIdentity } from './migration';
import { THRESHOLD_SPECS } from '../domain/thresholds';
import { lei, ron, subBani, type Bani } from '../domain/money';

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
    pensionerStatus: 'nu',
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
    filings: [],
    occupancySheets: [],
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
    valoareFaraTva: ron(1000),
    tva: ron(190),
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
    valoareFaraTva: ron(500),
    tva: ron(95),
    status: 'inregistrata',
    ...overrides,
  };
}

function declaration(overrides: Partial<LegacyMonthlyDeclaration> = {}): LegacyMonthlyDeclaration {
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
      filingsInAsteptare: 0,
    });
  });

  it('counts entries by status', () => {
    const counts = getPendingCounts(
      makeData({
        revenues: [revenue({ id: 'r1', status: 'in-asteptare' }), revenue({ id: 'r2', status: 'respinsa' })],
        expenses: [expense({ status: 'respinsa' })],
        // PG-5: `filingsInAsteptare` counts annual returns recorded but not yet filed. It replaces
        // `declarationsInAsteptare`, which counted monthly rows for a return this profile does not owe.
        filings: [{ id: 'f26', taxYear: 2026, form: 'D212', status: 'in_pregatire' }],
      }),
    );
    expect(counts.revenuesInAsteptare).toBe(1);
    expect(counts.revenuesRespinsa).toBe(1);
    expect(counts.expensesRespinsa).toBe(1);
    expect(counts.filingsInAsteptare).toBe(1);
  });

  it('a filed annual return is not pending', () => {
    const counts = getPendingCounts(
      makeData({
        filings: [{ id: 'f26', taxYear: 2026, form: 'D212', status: 'depusa', filedOn: '2027-05-12' }],
      }),
    );
    expect(counts.filingsInAsteptare).toBe(0);
  });

  it('monthly rows are never counted as pending filings', () => {
    // PG-5b re-premise: the input cannot carry monthly rows at all any more — the key is gone from
    // `AppData`. They are handed over the way an un-migrated payload would arrive, cast through `unknown`,
    // so the assertion still runs: a monthly row is not a filing, and it is not counted as one.
    const counts = getPendingCounts(
      makeData({
        declarations: [declaration({ id: 'd2', an: 2026, luna: 6, status: 'in-asteptare', dataInregistrare: '2026-07-08' })],
      } as unknown as Partial<AppData>),
    );
    expect(counts.filingsInAsteptare).toBe(0);
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
  it('returns the action projection of the attention model', () => {
    // Re-pinned from the old `{id, label, source}` shape. `ActionItem` is gone: the action list is now
    // `AttentionItem[]`, produced by the same pipeline that produces the observations, so the two
    // cannot disagree and one problem cannot appear on both surfaces.
    const items = getActionItems(makeData({ revenues: [revenue()] }), AS_OF_INSTANT);
    expect(Array.isArray(items)).toBe(true);
    for (const item of items) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.title).toBe('string');
      expect(typeof item.description).toBe('string');
      expect(['none', 'low', 'medium', 'high']).toContain(item.severity);
      expect(item.severity).not.toBe('none');
      expect(['revenue', 'expense', 'declaration', 'threshold', 'deadline', 'completeness', 'tax', 'reserve', 'integrity']).toContain(item.source);
      // Every action is something to do, which is what routes it here.
      expect(['rejected', 'awaiting_acceptance', 'not_submitted', 'data_missing', 'deadline_open', 'deadline_overdue']).toContain(item.state);
    }
  });

  it('surfaces the three unresolved seed records as actions, each with a target that reaches the record', () => {
    // TASK 9 re-pin (replaced, not deleted): this test used to cover four records, the fourth being the
    // seed's `d2`. The seed no longer holds declaration records — the three it carried recorded monthly
    // filings that do not exist for this profile (see the note in `data/seed.ts`). The declaration case
    // is still covered, against a fixture this file owns.
    const items = getActionItems(seedData, AS_OF_INSTANT);
    const byId = new Map(items.map(i => [i.id, i]));

    const r2 = byId.get('record-revenue-r2')!;
    expect(r2.state).toBe('awaiting_acceptance');
    expect(r2.description).toContain('În așteptare');
    expect(r2.target?.href).toBe('/revenues#!/pending?f=r2');

    const r3 = byId.get('record-revenue-r3')!;
    expect(r3.state).toBe('rejected');
    expect(r3.description).toContain('CUI nevalid');
    expect(r3.target?.href).toBe('/revenues#!/rejected?f=r3');

    const e3 = byId.get('record-expense-e3')!;
    expect(e3.description).toContain('Document neconform');
    expect(e3.target?.href).toBe('/expenses#!/rejected?f=e3');

    // No declaration row is produced from the seed, because the seed holds no declaration record.
    expect(byId.has('record-declaration-d2')).toBe(false);

    // PG-5 re-pin (replaced, not deleted): a legacy monthly row produces no action item at all. The old
    // case asserted `not_submitted` for `d2`, which asserts a submission this profile does not owe — a
    // PFA în sistem real files one Declarația Unică per fiscal year, not a monthly return.
    // PG-5 re-pin (replaced, not deleted): a monthly row produces no action item at all. The old case
    // asserted `not_submitted` for `d2`, which asserts a submission this profile does not owe — a PFA în
    // sistem real files one Declarația Unică per fiscal year, not a monthly return.
    // PG-5b re-pin (again, not deleted): the monthly key is gone from the dataset, so the rows are handed
    // over as an un-migrated payload would carry them. The assertion is the same one the test has always
    // carried — adding monthly rows changes nothing at all about the action list.
    const withLegacy = getActionItems(
      { ...seedData, declarations: [declaration({ id: 'd2', an: 2026, luna: 6, status: 'in-asteptare', dataInregistrare: '2026-07-08' })] } as unknown as AppData,
      AS_OF_INSTANT,
    );
    expect(withLegacy.find(i => i.id === 'record-declaration-d2')).toBeUndefined();
    // Adding the legacy rows changes nothing at all about the action list.
    expect(withLegacy.map(i => i.id).sort()).toEqual(items.map(i => i.id).sort());
  });

  it('no issue appears on both surfaces, and the two together cover the whole list', async () => {
    // The reconciliation, asserted end to end rather than incidentally. `insights.ts` and
    // `getActionItems` used to be two pipelines over the same deadlines and completeness checks, and
    // the same problem reached the screen twice in two vocabularies.
    const tax = await getTaxEstimate(seedData, AS_OF);
    const dashboard = buildDashboardData(seedData, tax, AS_OF_INSTANT);
    const obsIds = dashboard.insights.map(i => i.id);
    const actIds = dashboard.actions.map(i => i.id);

    expect(obsIds.filter(id => actIds.includes(id))).toEqual([]);
    // The three duplications the two pipelines used to produce are gone.
    // PG-1: `completeness-taxEstimate` is gone with the check behind it. That row asked whether an
    // estimate had been calculated and counted the calculation as a completeness fact, so the seed —
    // which does have a computed estimate — satisfied it while records sat outside the figure. A real
    // missing register still surfaces.
    expect(actIds).not.toContain('completeness-taxEstimate');
    // PG-5: `completeness-declarations` is gone with the predicate behind it. Two completeness rows take
    // its place on the seed — the empty tax-statement register (the seed's D300 row went with the
    // cadence it asserted) and the VAT filing period the recorded facts cannot fix. The annual filing is
    // NOT a row: at the pinned date the FY2026 return is not yet due, and "not owed yet" is not missing
    // data.
    expect(actIds).not.toContain('completeness-declarations');
    expect(actIds).not.toContain('completeness-annualFiling');
    expect(actIds).toContain('completeness-statements');
    expect(actIds).toContain('completeness-vatFilingPeriod');
    expect(obsIds).not.toContain('completeness');
    expect(obsIds).not.toContain('tax-review');
    expect(obsIds).not.toContain('deadline-PFA_DEADLINE_2026');
    expect(actIds).toContain('deadline-PFA_DEADLINE_2026');
    // A computed estimate is not an attention item: the figure is on the hero, in three states.
    expect(obsIds).not.toContain('tax');
  });
});

describe('getLegislationState (sync)', () => {
  it('states that monitoring is unavailable, and reports only what the rule package carries', () => {
    // Re-pinned. The old state was `{updatedAt: null, items: []}` behind the sentence „Nicio modificare
    // viitoare verificată.” — a reassurance built on a placeholder boundary with no ingestion behind it.
    const state = getLegislationState(makeData(), '2026-10-31');
    expect(state.updatedAt).toBeNull();
    expect(state.monitor).toBe('unavailable');
  });

  it('surfaces the HG 146/2026 minimum-wage change with whether it re-anchors this fiscal year', () => {
    const state = getLegislationState(seedData, '2026-10-31');
    const sm = state.items.find(i => i.source === 'HG 146/2026');
    expect(sm).toBeDefined();
    expect(sm!.effectiveDate).toBe('2026-07-01');
    expect(sm!.status).toBe('CURRENT');
    expect(sm!.summary).toContain('4.325,00 lei');
    // The half that matters: it does not re-anchor FY2026, and the provision that fixes the anchor is
    // named. Read from the rule package — no lei amount is invented here.
    expect(sm!.impact.affects).toBe('no');
    expect(sm!.impact.note).toContain('art. 135¹ alin. (3)');
    expect(sm!.impact.note).toContain('2026');
  });

  it('names the 1 January vintage as the anchor the thresholds are measured on', () => {
    const state = getLegislationState(seedData, '2026-10-31');
    const anchor = state.items.find(i => i.source === 'HG 1506/2024');
    expect(anchor).toBeDefined();
    expect(anchor!.impact.affects).toBe('yes');
    expect(anchor!.summary).toContain('4.050,00 lei');
    expect(anchor!.impact.note).toContain('art. 135¹ alin. (3)');
  });
});

/**
 * TASK 9 — provenance reaches the data layer exactly once, so no surface can invent its own answer.
 */
describe('estimateProvenance and the surfaces that consume it (TASK 9)', () => {
  it('the seed estimate is pinned: the release is named and the recorded digest verifies', async () => {
    const tax = await getTaxEstimate(seedData, AS_OF);
    const view = estimateProvenance(tax)!;
    expect(view.state).toBe('pinned');
    expect(view.releaseId).toBe('PFA_2026_SYSTEM_REAL');
    expect(view.recordedHash).toBe(tax.status === 'computed' ? tax.snapshot.ruleSetHash : null);
    expect(view.registeredHash).toBe(view.recordedHash);
    // A digest never travels alone: the provisions behind the money come with it.
    expect(view.citations.length).toBeGreaterThan(0);
  });

  it('a withheld conclusion has no snapshot, so there is no provenance to show — and none is invented', () => {
    const refused: TaxEstimateResult = { status: 'review_required', reason: 'engine refused', lines: [] };
    expect(estimateProvenance(refused)).toBeNull();
    expect(estimateProvenance(null)).toBeNull();
  });

  it('buildDashboardData carries the view, and the legislation items carry the same one', async () => {
    const tax = await getTaxEstimate(seedData, AS_OF);
    const dashboard = buildDashboardData(seedData, tax, AS_OF_INSTANT);
    expect(dashboard.provenance?.state).toBe('pinned');
    expect(dashboard.legislation.items.length).toBeGreaterThan(0);
    for (const item of dashboard.legislation.items) {
      expect(item.provenance?.state).toBe('pinned');
      expect(item.provenance?.releaseId).toBe('PFA_2026_SYSTEM_REAL');
    }
  });

  it('the figure-bearing rows carry provenance; the rows about records and dates carry none', async () => {
    const tax = await getTaxEstimate(seedData, AS_OF);
    const dashboard = buildDashboardData(seedData, tax, AS_OF_INSTANT);
    const all = [...dashboard.insights, ...dashboard.actions];
    const withProvenance = all.filter(i => i.provenance != null);
    // Every row that carries one is a row about a computed figure.
    for (const item of withProvenance) {
      expect(['tax', 'reserve', 'threshold']).toContain(item.source);
    }
    // And on the seed there is at least one such row, so this is not a vacuous pass.
    expect(withProvenance.length).toBeGreaterThan(0);
    // A row about a document or a date carries nothing: no calculation produced it.
    for (const item of all.filter(i => i.source === 'revenue' || i.source === 'expense' || i.source === 'declaration' || i.source === 'deadline')) {
      expect(item.provenance ?? null).toBeNull();
    }
  });

  it('a withheld conclusion gives the figure-bearing rows the no_release answer, not a digest', () => {
    const refused: TaxEstimateResult = { status: 'review_required', reason: 'engine refused', lines: [] };
    const dashboard = buildDashboardData(seedData, refused, AS_OF_INSTANT);
    const all = [...dashboard.insights, ...dashboard.actions];
    const figureRows = all.filter(i => ['tax', 'reserve', 'threshold'].includes(i.source));
    expect(figureRows.length).toBeGreaterThan(0);
    for (const item of figureRows) {
      expect(item.provenance?.state).toBe('no_release');
      expect(item.provenance?.recordedHash).toBeNull();
    }
    // The hero gets nothing at all: there is no record to attribute, and the estimate state already
    // says the figure is withheld.
    expect(dashboard.provenance).toBeNull();
  });
});

// --- Phase 9, item 2: B-20 — `snapshot.thresholds[].breached` must agree with the domain ------
// `buildSnapshot` used to re-derive the flag as `distance > 0`. `distance` is
// `currentValue - thresholdValue`, so for a `min-base` (floor) row a breach is `distance < 0`:
// the old expression inverted exactly the floor rows and contradicted `thresholds.ts` `statusFor`,
// which already branches on the threshold type. `insights.ts` filtered on this flag, so two real
// breaches (CAS_MIN_BASE, CASS_MIN_BASE) never reached Observații while Praguri showed `Depășit`.
//
// TASK 4 re-opened this fix from the other side: the flag was right about the ARITHMETIC and wrong
// about the LAW. Being below a contribution floor is not a breach — CF art. 148 alin. (1) makes the
// 12-SM figure the condition for the CAS obligation to exist, and below it the consequence is
// `nu datorează contribuția`, with an optional election under art. 148 alin. (4). So `breached` is now
// reserved for kinds the law actually caps or triggers, and the floor rows carry `kind` + `severity`.
describe('snapshot.thresholds[].breached (B-20, re-typed by TASK 4)', () => {
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
      // The semantic fields travel through the flattening, so `insights.ts` never has to guess them.
      expect(snapRow!.kind).toBe(row.kind);
      expect(snapRow!.engaged).toBe(row.engaged);
      expect(snapRow!.severity).toBe(row.severity);
      expect(snapRow!.consequence).toBe(row.consequence);
    }
  });

  it('never marks a contribution-floor row breached when the value is BELOW the floor', async () => {
    const tax = await getTaxEstimate(seedData, AS_OF_SEED);
    const dashboard = buildDashboardData(seedData, tax, INSTANT);
    const floors = dashboard.thresholds.filter((t) => t.type === 'min-base');
    expect(floors.map((t) => t.thresholdId).sort()).toEqual(['CASS_MIN_BASE', 'CAS_MIN_BASE']);
    for (const floor of floors) {
      // The seed's net income (7.580,00 lei) is far below both statutory floors.
      expect(floor.distance).toBeLessThan(0);
      // TASK 4 replaces the assertion that pinned `status: 'breached'` here. The level is in play —
      // that is what the row reports — but the law attaches no adverse consequence to being under it.
      expect(floor.kind, floor.thresholdId).toBe('tier_transition');
      expect(floor.engaged, floor.thresholdId).toBe(true);
      expect(floor.status, floor.thresholdId).toBe('warning');
      expect(floor.status, floor.thresholdId).not.toBe('breached');
      expect(floor.severity, floor.thresholdId).not.toBe('high');
      const snapRow = dashboard.snapshot.thresholds.find((s) => s.id === floor.thresholdId)!;
      // The B-20 derivation still holds — it is driven off the domain status — it just can no longer
      // come out true for a floor row.
      expect(snapRow.breached).toBe(false);
    }
  });

  it('surfaces the below-floor fact in Observații without calling it a breach', async () => {
    const tax = await getTaxEstimate(seedData, AS_OF_SEED);
    const dashboard = buildDashboardData(seedData, tax, INSTANT);
    // Replaces the assertion that pinned a `Prag depășit:` danger for the floor rows: that wording
    // claimed a fiscal limit had been exceeded, which research 24 found no support for.
    expect(dashboard.insights.filter((i) => i.title.startsWith('Prag depășit:'))).toHaveLength(0);
    const floorAlerts = dashboard.insights.filter((i) => /^threshold-(CAS|CASS)_MIN_BASE$/.test(i.id));
    // CASS and CAS collapse into at most ONE canonical alert (canonicalCassCas), so exactly one.
    expect(floorAlerts).toHaveLength(1);
    expect(floorAlerts[0].severity).toBe('medium');
    expect(floorAlerts[0].description).toMatch(/art\. 14[48]|art\. 174/);
    const allText = dashboard.insights.map((i) => `${i.title} ${i.description} ${i.action}`).join(' ');
    expect(allText).not.toContain('dezcalificare');
    expect(allText).not.toContain('schimbare de regim');
  });

  it('the production caller derives applicability from the profile — no row comes back unknown', async () => {
    // `ThresholdQuery.profile` is optional so the domain can be called with hand-built queries, where
    // `unknown` is the honest answer. The app must never be in that position.
    const tax = await getTaxEstimate(seedData, AS_OF_SEED);
    const rows = getThresholdStatuses(seedData, AS_OF_SEED, tax);
    for (const row of rows) {
      expect(row.applicability, row.thresholdId).not.toBe('unknown');
      expect(row.measuredBasis, row.thresholdId).not.toBe('unattributed');
    }
  });

  it('the VAT plafon row is inapplicable for a profile that already applies VAT', async () => {
    // The seed profile is not in the TVA scutire (`vatExempt: false`), so the art. 310 alin. (1)
    // registration test has already been decided. The row stays visible and measured, but it cannot
    // alert.
    const tax = await getTaxEstimate(seedData, AS_OF_SEED);
    const dashboard = buildDashboardData(seedData, tax, INSTANT);
    const vat = dashboard.thresholds.find((t) => t.thresholdId === 'VAT_REGISTRATION')!;
    expect(vat.applicability).toBe('not_applicable');
    expect(vat.applicabilityReason ?? '').toContain('art. 310 alin. (1)');
    expect(vat.severity).toBe('none');
    expect(vat.currentValue).toBe(lei(7700));
    expect(dashboard.insights.filter((i) => i.id === 'threshold-VAT_REGISTRATION')).toHaveLength(0);
  });

  it('each row states the basis it measured: realised annual for contributions, YTD for the VAT plafon', async () => {
    // TASK 4's asymmetry, re-premised by PG-5C. The contribution rows and the VAT row still measure two
    // different quantities and the rows still say which is which. What changed is the annual one: it is
    // no longer a grossed-up projection but the realised net income, which art. 118 alin. (3) makes the
    // annual amount even for a fraction of a year. `'annual-projected'` is gone from `MeasuredBasis`, so
    // the label this test pins is the only annual label the row type can carry.
    const asOf = '2026-10-31';
    const instant = new Date(2026, 9, 31, 12);
    const tax = await getTaxEstimate(seedData, asOf);
    const rows = getThresholdStatuses(seedData, asOf, tax);
    const contribution = rows.filter((t) => t.fiscalBase === 'net-income');
    expect(contribution.map((t) => t.thresholdId).sort()).toEqual([
      'CASS_MAX_BASE',
      'CASS_MIN_BASE',
      'CAS_MIN_BASE',
      'CAS_TIER2_FLOOR',
    ]);
    for (const row of contribution) {
      expect(row.measuredBasis, row.thresholdId).toBe('annual-actual');
    }
    const vat = rows.find((t) => t.thresholdId === 'VAT_REGISTRATION')!;
    expect(vat.measuredBasis).toBe('ytd-turnover');
    // The two bases are still different quantities on the seed at this date — 7.580,00 lei of realised
    // net income against 7.700,00 lei of YTD VAT-exclusive turnover — but they now differ by the 120,00
    // lei of deductible expense rather than by a run rate. Before PG-5C this row read 9.189,45 lei, the
    // seed's VNA grossed up by 354/292; a CAS floor compared against that figure was compared against
    // money the taxpayer had not received.
    expect(contribution[0].currentValue).toBe(lei(7580));
    expect(vat.currentValue).toBe(lei(7700));
    expect(instant.getMonth()).toBe(9);
  });

  it('a refused estimate leaves no row able to claim an annual basis', async () => {
    // PG-5C, the wiring half of the guarantee. The label is derived from the basis the engine actually
    // ran on — it is not written next to the row — so when nothing ran there is nothing to attribute,
    // and `annual-actual` would name a measurement that never happened. Together with the type-level
    // test in src/domain/thresholds.test.ts this is what makes "the thresholds cannot be handed a
    // projection" a property rather than a habit: there is no member of `MeasuredBasis` that means it,
    // and no path from a forecast to a row's value.
    const data: AppData = { ...seedData, profile: { ...seedData.profile, regime: 'impozit_pe_cit' } };
    const tax = await getTaxEstimate(data, '2026-10-31');
    if (tax.status !== 'review_required') throw new Error('expected the estimate to refuse the regime');
    const rows = getThresholdStatuses(data, '2026-10-31', tax);
    const contribution = rows.filter((t) => t.fiscalBase === 'net-income');
    expect(contribution.length).toBeGreaterThan(0);
    for (const row of contribution) {
      // A refused estimate supplies no base at all, so the rows fall to `unmeasured` — one step further
      // from an annual label than `unattributed`, which is what a computed-but-unlabelled basis gives.
      // Either way the row cannot read as measured on an annual figure it never measured.
      expect(row.measuredBasis, row.thresholdId).toBe('unmeasured');
      expect(row.currentValue, row.thresholdId).toBeNull();
    }
  });

  it('a pensioner profile removes the CAS rows from applicability, with the art. 150 alin. (1) reason', async () => {
    // The seed records are kept: with no records the VNA would be zero and art. 174 alin. (2) would
    // switch CASS off for a different reason, hiding the asymmetry this test is about.
    const data: AppData = { ...seedData, profile: { ...seedData.profile, pensionerStatus: 'da' } };
    const tax = await getTaxEstimate(data, AS_OF_SEED);
    const rows = getThresholdStatuses(data, AS_OF_SEED, tax);
    for (const id of ['CAS_MIN_BASE', 'CAS_TIER2_FLOOR']) {
      const row = rows.find((t) => t.thresholdId === id)!;
      expect(row.applicability, id).toBe('not_applicable');
      expect(row.applicabilityReason ?? '', id).toContain('art. 150 alin. (1)');
      expect(row.severity, id).toBe('none');
    }
    // CASS is NOT mirrored: CF art. 174 alin. (7) lit. c) removes only the art. 174 alin. (6) top-up, and
    // it keys on pension sums RECEIVED in the year. A status alone therefore leaves the top-up row
    // undecided — neither relieved (that would grant a relief from a boolean) nor refused as settled.
    expect(rows.find((t) => t.thresholdId === 'CASS_MAX_BASE')!.applicability).toBe('applicable');
    const topUp = rows.find((t) => t.thresholdId === 'CASS_MIN_BASE')!;
    expect(topUp.applicability).toBe('unknown');
    expect(topUp.applicabilityReason ?? '').toContain('art. 174 alin. (7) lit. c)');
  });

  // TASK 5 — the relief, keyed on the right fact, at the level the user actually reads.
  it('pension sums received in the year remove the top-up row, and the 10 % CASS contribution survives', async () => {
    const data: AppData = {
      ...seedData,
      profile: {
        ...seedData.profile,
        pensionerStatus: 'da',
        pensionReceiptYears: [{ fiscalYear: 2026, received: 'da' as const }],
      },
    };
    const tax = await getTaxEstimate(data, AS_OF_SEED);
    const rows = getThresholdStatuses(data, AS_OF_SEED, tax);
    expect(rows.find((t) => t.thresholdId === 'CASS_MIN_BASE')!.applicability).toBe('not_applicable');
    // The cap row rides on the art. 170 alin. (1) contribution itself, which is still owed.
    expect(rows.find((t) => t.thresholdId === 'CASS_MAX_BASE')!.applicability).toBe('applicable');
    // The 10 % CASS contribution still applies whenever the top-up is disapplied. At this as-of date the
    // seed is read from actuals: venit brut 7.700,00 lei − cheltuieli deductibile 120,00 lei = VNA
    // 7.580,00 lei; 10 % = 758,00 lei exactly (art. 66 rounding is a no-op here). Not 0, and not the
    // 2.430,00 lei art. 174 alin. (6) top-up.
    expect(tax.status).toBe('computed');
    if (tax.status !== 'computed') return;
    expect(tax.lines.find((l) => l.label === 'CASS (10%)')?.value).toBe(lei(758));
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

  it('crossing 24 SM changes the calculation base AND doubles the CAS the engine computes, from one figure', async () => {
    const data = makeData({ revenues: [revenue({ valoareFaraTva: ron(120000), tva: ron(0) })] });
    const tax = await getTaxEstimate(data, AS_OF_SEED);
    expect(tax.status).toBe('computed');

    const row = getThresholdStatuses(data, AS_OF_SEED, tax).find(
      (t) => t.thresholdId === 'CAS_TIER2_FLOOR',
    )!;
    expect(row.currentValue).toBe(lei(120000));
    // TASK 4 replaces `status: 'breached'` here. Crossing a ladder rung is not exceeding a limit:
    // art. 148 alin. (2) lit. b) raises the MINIMUM base. The row is flagged as engaged and worth
    // showing, and the doubled amount below is the fact that makes it worth showing.
    expect(row.engaged).toBe(true);
    expect(row.kind).toBe('tier_transition');
    expect(row.status).toBe('warning');
    expect(row.status).not.toBe('breached');
    expect(row.consequence).toContain('art. 148 alin. (2) lit. b)');

    // The same input, read through the calculator, lands on the tier-2 floor (25% × 97.200).
    const casLine = tax.lines.find((l) => l.label === 'CAS (25%)')!;
    expect(casLine.value).toBe(lei(24300));

    const dashboard = buildDashboardData(data, tax, INSTANT);
    const snapRow = dashboard.snapshot.thresholds.find((s) => s.id === 'CAS_TIER2_FLOOR')!;
    expect(snapRow.breached).toBe(false);
    expect(snapRow.engaged).toBe(true);
    expect(snapRow.type).toBe('tier-floor');
    expect(snapRow.kind).toBe('tier_transition');
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
describe('getTaxEstimate — the engine is fed the recorded actuals, and the forecast travels beside them', () => {
  it('feeds the actuals to the engine and reports the forecast separately, never as an operand', async () => {
    // PG-5C re-premise of the TASK 1 contract. Every assertion below survived; what changed is which
    // side of the contract each one sits on. The 9.334,93 / 145,48 / 9.189,45 / 3.257,00 lei figures are
    // still computed and still reported — as a forecast. They are no longer what the engine ran on, and
    // the total the taxpayer would have been shown drops from 3.257,00 lei to 3.112,00 lei.
    const est = await getTaxEstimate(seedData, '2026-10-31');
    if (est.status !== 'computed') throw new Error('expected a computed estimate');
    if (est.basis.kind !== 'recorded-actuals') throw new Error('expected a recorded-actuals basis');

    // Seed YTD (every record is September 2026, only 'inregistrata' counts). TASK 2b: the operand is the
    // CONFIRMED-DEDUCTIBLE subset, so expenseNet is e1's 120,00 lei — e2 (85,50 lei,
    // `personal_or_family_use`, art. 68 alin. (7) lit. a)) is classified out before aggregation.
    expect(est.basis.asOfDate).toBe('2026-10-31');
    expect(est.basis.closed).toBe(false);
    expect(est.basis.actual.revenuesNet).toBe(lei(7700));
    expect(est.basis.actual.expensesNet).toBe(lei(120));
    // The forecast is still produced, over the PFA's active period (PG-4/B-44: 11 13/31 months from
    // 19 Jan, 9 13/31 elapsed at 31 Oct, so x 354/292). It is a forecast, and it is not an operand.
    expect(est.basis.forecast?.amounts.revenuesNet).toBe(lei(9334.93));
    expect(est.basis.forecast?.amounts.expensesNet).toBe(lei(145.48)); // 120,00 x 354/292
    // The engine ran on the recorded pair and says so in its own bases:
    expect(est.bases.venitulBrut).toBe(lei(7700));
    expect(est.bases.cheltuieliDeductibile).toBe(lei(120));
    expect(est.bases.venitulNetDinActivitate).toBe(lei(7580)); // 7.700,00 - 120,00
    // CASS owed 2.430 (art. 174 alin. (6) difference to the 6 SM floor; only 10% x VNA = 758,00 is
    // deductible, the 1.672,00 difference being excluded by art. 118 alin. (2) lit. b)) + bază
    // 7.580,00 - 758,00 = 6.822,00, impozit 10% = 682,20 -> art. 66 -> 682,00. CAS: 7.580,00 < 12 SM
    // (48.600,00), so art. 148 alin. (1) is not met and none is owed. Total 2.430 + 682 = 3.112,00 lei.
    expect(est.output.total).toBe(lei(3112));
  });

  it('the estimate no longer tracks the date: another as-of date is the same figure', async () => {
    // PG-5C re-premise, and the sharpest single statement of the defect. This test used to be called
    // "another date is another run rate and another record", and it pinned 3.355,00 lei at 30 Sep
    // against 3.257,00 lei at 31 Oct — the same September register, read two months apart, producing two
    // different tax figures, with the earlier date giving the HIGHER one because a shorter elapsed
    // period implied a faster run rate. Nothing in Titlul IV or Titlul V does that.
    const oct = await getTaxEstimate(seedData, '2026-10-31');
    const sep = await getTaxEstimate(seedData, '2026-09-30');
    if (oct.status !== 'computed' || sep.status !== 'computed') throw new Error('expected both to compute');
    if (sep.basis.kind !== 'recorded-actuals') throw new Error('expected a recorded-actuals basis');

    expect(sep.output.total).toBe(lei(3112));
    expect(oct.output.total).toBe(lei(3112));
    expect(sep.bases.venitulNetDinActivitate).toBe(oct.bases.venitulNetDinActivitate);
    // The forecast DOES move with the date — that is what a forecast is for, and it is why the model is
    // kept rather than deleted.
    if (oct.basis.kind !== 'recorded-actuals' || sep.basis.kind !== 'recorded-actuals') {
      throw new Error('expected both to carry a recorded-actuals basis');
    }
    expect(oct.basis.forecast?.amounts.revenuesNet).toBe(lei(9334.93));
    expect(sep.basis.forecast?.amounts.revenuesNet).toBe(lei(10443.68)); // 7.700,00 x 354/261

    // The snapshot digests the operands that entered the engine. Since the operands no longer move with
    // the date, two reads of one register now hash identically — the old assertion that they differed
    // was a fingerprint of the defect. What must still separate two runs is a change in the register.
    expect(sep.snapshot.inputsHash).toBe(oct.snapshot.inputsHash);
    const withMore = await getTaxEstimate(
      { ...seedData, revenues: [...seedData.revenues, seedData.revenues[0]] },
      '2026-10-31',
    );
    if (withMore.status !== 'computed') throw new Error('expected a computed estimate');
    expect(withMore.snapshot.inputsHash).not.toBe(oct.snapshot.inputsHash);
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
    expect(est.output.total).toBe(lei(3112));

    const rec = getTaxReserve(data, AS_OF, est);
    expect(rec.estimatedTaxLiability).toBe(lei(3112));
    // null, not 0: the user recorded nothing, and the card must say so rather than show 0,00 lei.
    expect(rec.reservedAmount).toBeNull();
    expect(rec.remainingTarget).toBe(lei(3112));
    expect(rec.monthsRemaining).toBe(3);
    // PG-5C moved the liability from 3.257,00 to 3.112,00 lei, and the reserve with it. The reserve
    // arithmetic is untouched — 3.112,00 / 3 months = 1.037,33 lei/month.
    expect(rec.recommendedMonthlyReserve).toBe(lei(1037.33));

    const view = buildDashboardData(data, est, INSTANT);
    expect(view.reserve.reservedAmount).toBeNull();
    expect(view.snapshot.taxReserve.gapBani).toBe(lei(3112));
  });

  it('an explicit 0 lei reserve is a different fact from null', async () => {
    const data = withReserve(lei(0));
    const est = await getTaxEstimate(data, AS_OF);
    const rec = getTaxReserve(data, AS_OF, est);
    // The arithmetic coincides with the null case — and that is exactly why the STATE has to survive:
    // a reader must be able to tell „recorded nothing” from „never recorded anything”.
    expect(rec.reservedAmount).toBe(lei(0));
    expect(rec.reservedAmount).not.toBeNull();
    expect(rec.remainingTarget).toBe(lei(3112));
    expect(buildDashboardData(data, est, INSTANT).reserve.reservedAmount).toBe(lei(0));
  });

  it('a recorded reserve shrinks the target at BOTH sites, by the same amount', async () => {
    const data = withReserve(lei(1050));
    const est = await getTaxEstimate(data, AS_OF);
    if (est.status !== 'computed') throw new Error('expected a computed estimate');

    const rec = getTaxReserve(data, AS_OF, est);
    // 3.112,00 − 1.050,00 = 2.062,00 lei over 3 months = 687,33 lei/month. PG-5C moved the liability
    // from 3.257,00 (the run-rate figure) to 3.112,00 (the realised one); the reserve arithmetic itself
    // is untouched.
    expect(rec.reservedAmount).toBe(lei(1050));
    expect(rec.remainingTarget).toBe(lei(2062));
    expect(rec.recommendedMonthlyReserve).toBe(lei(687.33));

    // Site #2 — the snapshot that feeds the „Rezervă fiscală sub țintă” insight. It used to report 0
    // reserved no matter what, which is why the warning was unclearable.
    const view = buildDashboardData(data, est, INSTANT);
    expect(view.snapshot.taxReserve.currentReserveBani).toBe(lei(1050));
    expect(view.snapshot.taxReserve.gapBani).toBe(lei(2062));
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
          valoareFaraTva: ron(1000),
          tva: ron(190),
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
