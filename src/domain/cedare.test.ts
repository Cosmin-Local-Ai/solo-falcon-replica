/**
 * B-105 — ordinary *cedarea folosinței bunurilor*: art. 84 and art. 84¹.
 *
 * The rule (docs/ai/research/46_art84_84_1_cedare_folosintei_2026.md, written for this task) is not a second
 * copy of art. 85. The two articles share a 20 % expense ratio and a 10 % rate, and share nothing else. Four
 * quantities differ, and each difference is a test below rather than a comment:
 *
 *   WHEN income is income
 *     art. 84 alin. (1)-(2)  — the rent stipulated by the contract „pentru fiecare an fiscal, indiferent de
 *                              momentul încasării”: annual accrual
 *     art. 84¹ alin. (1),(3) — the net is fixed „la fiecare plată”: per payment. alin. (1) of art. 84¹
 *                              OMITS the annual clause art. 84 alin. (1) carries, and that omission is the
 *                              regime, not a drafting accident.
 *     art. 85 alin. (2)      — „încasate în cursul anului fiscal”: cash.
 *   The three totals agree on 31 December and differ on every other day of the year, which is why a shared
 *   gross path would pass a casual review and be wrong in production.
 *
 *   FX
 *     art. 84 alin. (3¹)     — *curs mediu anual* din anul realizării venitului
 *     art. 84¹ alin. (2)     — cursul din ziua precedentă plății
 *     art. 85 alin. (4)      — ultima zi bancară anterioară încasării
 *
 *   WHO computes the tax
 *     art. 84                — the owner, and the tax is NOT final (art. 123 alin. (2))
 *     art. 84¹ alin. (5)-(6)  — the payer withholds it at the moment of payment, and it IS final
 *     art. 84¹ alin. (8)      — rent paid exclusively in kind, or a guarantee applied to the rent, puts the
 *                              whole duty back on the owner
 *
 *   WHAT the owner files
 *     art. 122 alin. (6) lit. a) exempts the Declarația Unică **for the income tax only**. CASS on ordinary
 *     rent is not withheld — art. 174¹ alin. (3) reaches daily wage, arendă and associations — so art. 122
 *     alin. (7) still requires a return. „Withheld and final” is not „nothing to file”.
 *
 * The tenant's legal nature is what selects between art. 84 and art. 84¹, and it is a declared fact: the app
 * does not read it off a CUI on a receipt.
 *
 * Every expected figure was derived BY HAND from those lines and from the FY2026 anchor: SM = 4.050 lei on
 * 1 ianuarie 2026 (HG 1.506/2024). 6 SM = 24.300 · 12 SM = 48.600 · 24 SM = 97.200 lei.
 */
import { describe, expect, it } from 'vitest';
import { computeTaxEstimate } from './tax';
import type { TaxInputsReference } from './derived';
import type { CassLadderYear, LeaseFactsYear, PfaProfile } from './models';
import {
  art84x1WithholdingBlocked,
  cedareDeadlineFactFamilies,
  leaseRegistrationDutyForYear,
  singleDeclarationScopeForYear,
} from './models';
import type { FiscalRule } from './fiscal/rules';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import { PFA_2026_RELEASE } from './fiscal/release2026';
import { calculatorRegistry } from './fiscal/calculators';
import { selectApplicableRules } from './fiscal/select';
import { lei, money, type Bani } from './money';
import { selectCedareGross, selectIncomeDeterminationMethod } from './estimateBasis';
import { computeDeadlines } from './deadlines';
import { normaliseStoredLedger } from './fx/ledger';
import type { AppData, Revenue, SettingsState } from '../data/types';
import type { FxRateRecord } from './fx/rates';

const SM12 = lei(48_600);

const emptySettings: SettingsState = {
  cotaTva: 0.19,
  company: { denumire: 'Test SRL', cui: '12345678', numarRegComert: 'J40/123/2026', adresa: 'Str. Test 1', caen: [] },
  personal: { nume: 'Test', cnp: '', adresa: 'Str. Test 1', telefon: '0700000000', email: 'test@example.com' },
  bankAccounts: [],
  eFactura: { trimitere: 'manual', dateContact: '' },
};

function profile(over: Partial<PfaProfile> = {}): PfaProfile {
  return {
    id: 'p-cedare',
    regime: 'impozit_pe_venit',
    fiscalYear: 2026,
    pfaStartYear: 2026,
    salaryStatus: 'nu',
    cashFloorLei: lei(0),
    identity: {
      nume: 'Test', cnp: '', adresa: 'Str. Test 1', telefon: '0700000000', email: 'test@example.com',
      denumire: 'Test PFA', cui: '12345678', formaJuridica: 'PFA', numarRegComert: 'J40/123/2026',
      adresaSocietate: 'Str. Test 1', telefonSocietate: '', emailSocietate: '', contBancar: '', banca: '',
    },
    updatedAt: '2026-01-01T00:00:00Z',
    socialInsuranceStatus: 'obligatoriu',
    // The measure of every leu in a gross is a registration fact, not a guess: a taxpayer registered under
    // art. 316 carries collected VAT out of the income base, one exempt under art. 310 does not.
    vatRegistration: { status: 'inregistrat_art316' },
    ...over,
  };
}

function data(over: Partial<AppData> = {}): AppData {
  return {
    reservedAmount: null,
    profile: profile(),
    revenues: [],
    expenses: [],
    clients: [],
    filings: [],
    vatReturns: [],
    documents: [],
    occupancySheets: [],
    vehicles: [],
    fixedAssets: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] },
    statements: [],
    snapshots: [],
    settings: emptySettings,
    ...over,
  };
}

function lease(over: Partial<LeaseFactsYear> = {}): LeaseFactsYear {
  return { fiscalYear: 2026, tenantNature: 'persoana_fizica', ...over };
}

/**
 * One EUR rent document, issued 20 Dec 2026 and collected 10 Jan 2027.
 *
 * That single record is the whole three-regime question. art. 84 counts it in FY2026 because the rent is for
 * that fiscal year „indiferent de momentul încasării”. art. 84¹ and art. 85 count it in FY2027 because the
 * money moved then. And each regime asks for a different BNR rate.
 */
function euroRent(): Revenue {
  return {
    id: 'rev-eur-1',
    tip: 'factura',
    nr: 'CH-01',
    date: '2026-12-20',
    collected: '2027-01-10',
    client: 'Chiriaș',
    cui: '',
    valoareFaraTva: money(lei(1_000), 'EUR'),
    tva: money(lei(0), 'RON'),
    status: 'inregistrata',
  };
}

/**
 * Three BNR numbers for one currency, so the three anchors cannot land on the same rate.
 *
 * 2027-01-10 is a Sunday. The day before it is Saturday the 9th, and the last banking day before it is
 * Friday the 8th. All three are recorded here — including the Saturday one, which BNR would not publish —
 * precisely so the test measures WHICH date each regime asks for rather than which date the store happens to
 * have.
 */
const fxRates: FxRateRecord[] = [
  { currency: 'EUR', rate: '4.9000', rateKind: 'annual_average', rateYear: 2026, seriesCode: 'CURSA_EURM', sourceUrl: 'https://www.bnr.ro', fetchedAt: '2027-01-15T00:00:00Z', provisional: false, entryMode: 'fetched' },
  { currency: 'EUR', rate: '5.1000', rateKind: 'daily_reference', rateDate: '2027-01-08', seriesCode: 'CURSZ_EUR', sourceUrl: 'https://www.bnr.ro', fetchedAt: '2027-01-15T00:00:00Z', provisional: false, entryMode: 'fetched' },
  { currency: 'EUR', rate: '5.1200', rateKind: 'daily_reference', rateDate: '2027-01-09', seriesCode: 'CURSZ_EUR', sourceUrl: 'https://www.bnr.ro', fetchedAt: '2027-01-15T00:00:00Z', provisional: false, entryMode: 'fetched' },
  { currency: 'EUR', rate: '5.1500', rateKind: 'daily_reference', rateDate: '2027-01-10', seriesCode: 'CURSZ_EUR', sourceUrl: 'https://www.bnr.ro', fetchedAt: '2027-01-15T00:00:00Z', provisional: false, entryMode: 'fetched' },
];

function ladder(over: Partial<CassLadderYear> = {}): CassLadderYear[] {
  return [
    {
      fiscalYear: 2026,
      proprietateIntelectuala: lei(0),
      asocierePersoanaJuridica: lei(0),
      activitatiAgricole: lei(0),
      investitii: lei(0),
      alteSurse: lei(0),
      cedareaSursa: 'patrimoniu_personal',
      ...over,
    },
  ];
}

function inputs(over: Partial<TaxInputsReference> = {}): TaxInputsReference {
  return {
    regime: 'impozit_pe_venit',
    salaryStatus: 'nu',
    salaryIncomeLei: null,
    pensionerStatus: 'nu',
    pensionReceiptYears: [],
    pensionSuspensionYears: [],
    cassPreviousYearContext: null,
    foreignSicknessInsurance: null,
    cassLadderYears: ladder(),
    socialInsuranceStatus: 'obligatoriu',
    vatRegistration: { status: 'inregistrat_art316' },
    cashFloorLei: lei(0),
    fiscalYear: 2026,
    pfaStartDate: null,
    inputsKey: 'p-cedare:2026',
    ...over,
  };
}

function engine(over: {
  gross?: Bani | null;
  method?: 'cedare-art84' | 'cedare-art84x1' | null;
  withholdingBlocked?: boolean;
  rules?: FiscalRule[];
}) {
  return computeTaxEstimate({
    inputs: inputs(),
    profile: profile(),
    revenues: lei(0),
    expenses: lei(0),
    revenuesNet: lei(0),
    expensesNet: lei(0),
    expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false },
    flatRatioGross: over.gross ?? null,
    flatRatioMethod: over.method ?? 'cedare-art84',
    flatRatioWithholdingBlocked: over.withholdingBlocked ?? false,
    ruleRelease: PFA_2026_RELEASE,
    rules: over.rules ?? PFA_2026_SYSTEM_REAL_PACKAGE,
  });
}

function line(res: { lines: { label: string; value: Bani }[] }, prefix: string) {
  return res.lines.find((l) => l.label.startsWith(prefix));
}

// ── Acceptance 7 — the regime is selected at the seam, from declared facts ────────────────────────────

describe('regime selection — the tenant decides between art. 84 and art. 84¹', () => {
  const rules = PFA_2026_SYSTEM_REAL_PACKAGE;

  it('a natural-person tenant puts the register under art. 84', () => {
    const d = data({ profile: profile({ leaseFactsYears: [lease({ tenantNature: 'persoana_fizica' })] }) });
    expect(selectIncomeDeterminationMethod(d, rules, '2026-06-30')).toBe('cedare-art84');
  });

  it('a tenant obliged to keep accounting records puts it under art. 84¹', () => {
    const d = data({
      profile: profile({ leaseFactsYears: [lease({ tenantNature: 'entitate_cu_evidenta_contabila' })] }),
    });
    expect(selectIncomeDeterminationMethod(d, rules, '2026-06-30')).toBe('cedare-art84x1');
  });

  it('1–7 rooms in a personal dwelling stays art. 85, not either ordinary regime', () => {
    const d = data({
      profile: profile({
        activityFamily: 'cazare',
        accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 3 }],
        leaseFactsYears: [lease({ tenantNature: 'persoana_fizica' })],
      }),
    });
    // The lease facts are present and the tenant is a natural person, and the answer is still art. 85:
    // art. 83 alin. (5) carves short-term letting out of the ordinary-rent duty set, and the room count is
    // what says this register is short-term letting.
    expect(selectIncomeDeterminationMethod(d, rules, '2026-06-30')).toBe('short-term-rooms-art85');
  });

  it('an undeclared tenant fact selects nothing: the register stays sistem-real', () => {
    // No lease facts at all, and a register with a CUI on the tenant column. The app does not read the
    // tenant's legal nature off a CUI — that inference would move income between titles from a guess.
    const d = data({
      revenues: [{ ...euroRent(), valoareFaraTva: money(lei(1_000), 'RON'), cui: '12345678' }],
    });
    expect(selectIncomeDeterminationMethod(d, rules, '2026-06-30')).toBe('sistem-real');
  });

  it('a year with no art. 84¹ rule selects no art. 84¹ method', () => {
    // FY2027 has no rule package. The declared fact is the same; the rule set is not. The method follows the
    // rule set, so a corporate-tenant register in a year without the rule is not measured under a rule that
    // does not exist in that year.
    const d = data({
      profile: profile({
        fiscalYear: 2027,
        leaseFactsYears: [lease({ fiscalYear: 2027, tenantNature: 'entitate_cu_evidenta_contabila' })],
      }),
    });
    expect(selectIncomeDeterminationMethod(d, [], '2027-06-30')).toBe('sistem-real');
  });
});

// ── Acceptance 1 — art. 84 in exact bani ─────────────────────────────────────────────────────────────

describe('art. 84 — contract rent for the year, uplift, 80 % net, 10 % tax', () => {
  it('the gross is the declared contract rent plus the owner-costs uplift, before the ratio', () => {
    // 12.000 lei of rent stipulated for FY2026, and the tenant paid 250 lei of costs that fall on the owner
    // (art. 84 alin. (1) last sentence). The uplift joins the GROSS, so the 20 % runs over it too — deducting
    // it after the ratio would produce a different net.
    const d = data({
      profile: profile({
        leaseFactsYears: [lease({ contractRentAnnual: lei(12_000), ownerCostsPaidByTenant: lei(250) })],
      }),
    });
    const g = selectCedareGross(d, '2026-12-31', 'cedare-art84');
    expect(g.gross).toBe(lei(12_250));
    expect(g.detail).toBeUndefined();
  });

  it('net is 80 % of that gross and the tax is 10 % of the net', () => {
    const rule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'CEDARE_ART84_2026')!;
    const res = calculatorRegistry['calc-cedare-art84-flat-ratio'](rule, { gross: lei(12_250) });
    if ('reviewRequired' in res) throw new Error(res.reason);
    expect(res.determinedNet).toBe(lei(9_800));
    expect(res.value).toBe(lei(980));
  });

  it('the whole chain in bani: 12.250 gross → 9.800 net → 980 tax, and the tax is not final', async () => {
    const res = await engine({ gross: lei(12_250), method: 'cedare-art84' });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(line(res, 'Venit brut art. 84')!.value).toBe(lei(12_250));
    expect(line(res, 'Cheltuieli forfetare 20 %')!.value).toBe(lei(2_450));
    expect(line(res, 'Venit net art. 84')!.value).toBe(lei(9_800));
    expect(line(res, 'Impozit art. 84')!.value).toBe(lei(980));
    // art. 123 alin. (2) taxes this income and nothing makes it final — unlike art. 84¹ alin. (6) and art. 85
    // alin. (6), the label must not read „impozit final”.
    expect(line(res, 'Impozit art. 84')!.label).not.toContain('final');
  });

  it('the 20 % is an expense ratio, not a tax rate: the net is 80 % of gross', () => {
    const rule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'CEDARE_ART84_2026')!;
    const expense = rule.parameters.find((p) => p.id === 'expense_ratio')!;
    const rate = rule.parameters.find((p) => p.id === 'tax_rate')!;
    expect(expense.value).toBe(20);
    expect(rate.value).toBe(10);
    // The brief's own title error, pinned: „20 %” is the flat expense ratio. The rate is 10 % of NET, and it
    // lives in a different article — art. 123 alin. (2), not art. 84.
    expect(String(rate.description)).toContain('art. 123 alin. (2)');
    expect(String(expense.description)).toContain('Nu este o cotă de impozitare');
  });

  it('a declared contract rent that disagrees with the register refuses rather than picking a winner', () => {
    // Two producers for one figure. The person says the contract stipulates 12.000 lei for the year; the
    // documents dated in the year total 10.000 lei. art. 84 alin. (2) measures the rent „prevăzută în
    // contract”, so the app does not quietly prefer either.
    const d = data({
      profile: profile({ leaseFactsYears: [lease({ contractRentAnnual: lei(12_000) })] }),
      revenues: [
        { ...euroRent(), valoareFaraTva: money(lei(10_000), 'RON'), tva: money(lei(0), 'RON'), collected: '2026-03-01' },
      ],
    });
    const g = selectCedareGross(d, '2026-12-31', 'cedare-art84');
    expect(g.gross).toBeNull();
    expect(g.detail).toContain('doi producători');
  });

  it('with no declared contract rent, the accrual measure is the rent documented for the year', () => {
    const d = data({
      profile: profile({ leaseFactsYears: [lease()] }),
      revenues: [
        { ...euroRent(), valoareFaraTva: money(lei(6_000), 'RON'), tva: money(lei(0), 'RON'), collected: '2027-02-01' },
      ],
    });
    // Documented for 2026, collected in 2027 — and it still counts, because art. 84 alin. (2) measures the
    // rent for the fiscal year „indiferent de momentul încasării chiriei”.
    const g = selectCedareGross(d, '2026-12-31', 'cedare-art84');
    expect(g.gross).toBe(lei(6_000));
  });
});

// ── Acceptance 4 — three regimes, three rate dates, three answers to „when” ──────────────────────────

describe('the three gross rules are three different measures, not one measure with three labels', () => {
  const oneEuroRent = data({
    profile: profile({ leaseFactsYears: [lease()] }),
    revenues: [euroRent()],
    fxRates,
  });

  it('art. 84 counts the December-2026 rent in FY2026 at the 2026 annual average', () => {
    const g = selectCedareGross(oneEuroRent, '2026-12-31', 'cedare-art84');
    // 1.000 EUR × 4,9000 (curs mediu anual 2026) = 4.900 lei.
    expect(g.gross).toBe(lei(4_900));
  });

  it('art. 84¹ does NOT count that rent in FY2026 — the money moved in 2027', () => {
    // This is the landmine. The same register, the same record, the same year: art. 84 has a gross and art.
    // 84¹ has none, because alin. (1) of art. 84¹ omits the annual clause and alin. (3) fixes the net „la
    // fiecare plată”.
    const g2026 = selectCedareGross(oneEuroRent, '2026-12-31', 'cedare-art84x1');
    expect(g2026.gross).toBe(lei(0));
  });

  it('art. 84¹ counts it in FY2027 at the rate of the day BEFORE the payment', () => {
    const d = data({
      profile: profile({ fiscalYear: 2027, leaseFactsYears: [lease({ fiscalYear: 2027 })] }),
      revenues: [euroRent()],
      fxRates,
    });
    const g = selectCedareGross(d, '2027-12-31', 'cedare-art84x1');
    // Payment 2027-01-10, anchor 2027-01-09 → 5,1200 → 5.120 lei. Not 5.1500 (the payment day) and not
    // 5.1000 (the last banking day, which is what art. 85 alin. (4) asks for).
    expect(g.gross).toBe(lei(5_120));
  });

  it('the ledger pass — the measure art. 85 uses — anchors on the collection day itself', () => {
    const ledger = normaliseStoredLedger(oneEuroRent);
    const converted = ledger.data.revenues[0];
    // 2027-01-10 has its own published rate, so the ledger's anchor is that day: 5,1500 → 5.150 lei.
    // Three numbers from one record: 4.900 / 5.120 / 5.150.
    expect(converted.valoareFaraTva.amount).toBe(lei(5_150));
  });

  it('a missing rate for the anchor an article names is reported, never filled in', () => {
    const d = data({
      profile: profile({ leaseFactsYears: [lease()] }),
      revenues: [euroRent()],
      fxRates: [], // nothing recorded at all
    });
    const g = selectCedareGross(d, '2026-12-31', 'cedare-art84');
    expect(g.gross).toBeNull();
    // The app does not average the daily rows into an annual average: BNR publishes CURSA_EURM after the year
    // closes, and computing one out of daily rows would be the app manufacturing the rate the law names.
    expect(g.detail).toContain('curs');
  });
});

// ── Acceptance 2, 3, 6 — withheld and final, and what the owner still files ──────────────────────────

describe('art. 84¹ — withheld at source, final, and still a declaration to file', () => {
  it('the withheld tax is reported and is NOT part of what the owner owes', async () => {
    const res = await engine({ gross: lei(100_000), method: 'cedare-art84x1' });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(line(res, 'Venit net art. 84^1')!.value).toBe(lei(80_000));
    const withheld = line(res, 'Impozit reținut la sursă');
    expect(withheld).toBeDefined();
    expect(withheld!.value).toBe(lei(8_000));
    expect(withheld!.label).toContain('final');
    // CASS rides the 12-SM rung (80.000 lei cumulated ∈ [48.600, 97.200)) and the withheld 8.000 lei is not
    // added to the owner's total. Adding it would tell a landlord to pay the same leu twice.
    expect(line(res, 'CASS pe veniturile')!.value).toBe(lei(4_860));
    expect(res.output.total).toBe(lei(4_860));
  });

  it('the withheld net still feeds the art. 170 alin. (4) lit. c) cumul', async () => {
    const res = await engine({ gross: lei(100_000), method: 'cedare-art84x1' });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // „stabilite potrivit art. 84-85” is a range that covers art. 84, art. 84¹ and art. 85. The payer having
    // settled the income tax does not remove the income from the contribution base.
    expect(res.bases.bazaDeCalculCassArt155LitCH).toBe(SM12);
  });

  it('alin. (8) puts the tax back on the owner: the same 8.000 lei is now owed', async () => {
    const res = await engine({ gross: lei(100_000), method: 'cedare-art84x1', withholdingBlocked: true });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(line(res, 'Impozit art. 84^1 alin. (8)')!.value).toBe(lei(8_000));
    expect(res.output.total).toBe(lei(12_860));
  });

  it('either alin. (8) trigger switches the withholding off, and absence of both does not', () => {
    expect(art84x1WithholdingBlocked(lease({ rentPaidExclusivelyInKind: 'da' }))).toBe(true);
    expect(art84x1WithholdingBlocked(lease({ guaranteeAppliedToRent: 'da' }))).toBe(true);
    expect(art84x1WithholdingBlocked(lease({ rentPaidExclusivelyInKind: 'nu' }))).toBe(false);
    // Absence is not `nu`: it means the question was never asked, and the app keeps the reading the tenant
    // fact gives rather than inventing a trigger.
    expect(art84x1WithholdingBlocked(lease())).toBe(false);
    expect(art84x1WithholdingBlocked(undefined)).toBe(false);
  });

  it('the D212 term says what it covers: contributions only, when the tax was withheld', () => {
    const withheld = profile({ leaseFactsYears: [lease({ tenantNature: 'entitate_cu_evidenta_contabila' })] });
    expect(singleDeclarationScopeForYear(withheld, 2026)).toBe('contributions_only');
    // …and the same person under alin. (8) owes the full return again.
    const blocked = profile({
      leaseFactsYears: [lease({ tenantNature: 'entitate_cu_evidenta_contabila', guaranteeAppliedToRent: 'da' })],
    });
    expect(singleDeclarationScopeForYear(blocked, 2026)).toBe('full');
    // art. 84 self-assessed: full.
    expect(singleDeclarationScopeForYear(profile({ leaseFactsYears: [lease()] }), 2026)).toBe('full');
  });
});

// ── Acceptance 5 — the contract-registration duty, and where it does not exist ──────────────────────

describe('art. 83 alin. (5) — the 30-day duty to register the lease contract', () => {
  const rule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'CEDARE_CONTRACT_REGISTRATION_DEADLINE_2026')!;

  function deadlinesFor(over: Partial<PfaProfile>) {
    return computeDeadlines(PFA_2026_SYSTEM_REAL_PACKAGE, {
      taxYear: 2026,
      asOfDate: '2026-03-01',
      leaseContractDate: '2026-02-01',
      factFamilies: cedareDeadlineFactFamilies(profile(over), 2026),
    });
  }

  it('appears 30 days after the contract for an art. 84 register', () => {
    const rows = deadlinesFor({ leaseFactsYears: [lease({ tenantNature: 'persoana_fizica', contractDate: '2026-02-01' })] });
    const row = rows.find((d) => d.eventType === 'lease_contract_registration');
    expect(row).toBeDefined();
    expect(row!.date).toBe('2026-03-03');
    expect(row!.legalSource.article).toContain('art. 83 alin. (5)');
  });

  it('appears for an art. 84¹ register too — a corporate tenant does not waive it', () => {
    const rows = deadlinesFor({
      leaseFactsYears: [lease({ tenantNature: 'entitate_cu_evidenta_contabila', contractDate: '2026-02-01' })],
    });
    expect(rows.some((d) => d.eventType === 'lease_contract_registration')).toBe(true);
  });

  it('does NOT appear for a short-term-rooms register, which the alineat carves out', () => {
    const rows = deadlinesFor({
      activityFamily: 'cazare',
      accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 3 }],
      leaseFactsYears: [lease()],
    });
    // Not an undated row, not a „neaplicabil” row: nothing. The carve-out is a fact about the law, and the
    // app states it by producing no obligation at all.
    expect(rows.some((d) => d.eventType === 'lease_contract_registration')).toBe(false);
  });

  it('is undated rather than guessed when the contract date was never declared', () => {
    const rows = computeDeadlines(PFA_2026_SYSTEM_REAL_PACKAGE, {
      taxYear: 2026,
      asOfDate: '2026-03-01',
      factFamilies: cedareDeadlineFactFamilies(profile({ leaseFactsYears: [lease()] }), 2026),
    });
    const row = rows.find((d) => d.eventType === 'lease_contract_registration');
    expect(row).toBeDefined();
    expect(row!.date).toBeNull();
    expect(row!.status).toBe('not_applicable');
  });

  it('the form is cited to the ANAF order, never to the Cod fiscal', () => {
    // The Cod fiscal names no form. The C168 request exists in an ANAF order, and collapsing the two would
    // attribute a procedure to the statute.
    const form = String(rule.parameters.find((p) => p.id === 'form')!.value);
    expect(form).toContain('C168');
    expect(form).toContain('OPANAF 114/2019');
    expect(rule.sourceAct).toContain('OPANAF');
    expect(rule.sourceArticle).toContain('art. 83 alin. (5)');
  });

  it('the duty is decided from declared facts, not from the tenant being a company', () => {
    const p = profile({ leaseFactsYears: [lease({ tenantNature: 'entitate_cu_evidenta_contabila' })] });
    expect(leaseRegistrationDutyForYear(p, 2026)).toBe(true);
    expect(leaseRegistrationDutyForYear(profile({}), 2026)).toBe(false);
  });
});

// ── Acceptance 8 — no bookkeeping obligation for either variant ─────────────────────────────────────

describe('no Registrul de evidență fiscală for art. 84 or art. 84¹', () => {
  it('each calculator states the absence, and no deadline rule emits a bookkeeping term', () => {
    const art84 = calculatorRegistry['calc-cedare-art84-flat-ratio'](
      PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'CEDARE_ART84_2026')!,
      { gross: lei(10_000) },
    );
    const art84x1 = calculatorRegistry['calc-cedare-art84x1-withheld'](
      PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'CEDARE_ART84X1_2026')!,
      { gross: lei(10_000) },
    );
    for (const res of [art84, art84x1]) {
      if ('reviewRequired' in res) throw new Error(res.reason);
      const text = (res.breakdown ?? []).join('\n');
      expect(text).toContain('fără Registrul de evidență fiscală');
    }
    const rows = computeDeadlines(PFA_2026_SYSTEM_REAL_PACKAGE, {
      taxYear: 2026,
      asOfDate: '2026-06-30',
      factFamilies: cedareDeadlineFactFamilies(
        profile({ leaseFactsYears: [lease({ tenantNature: 'entitate_cu_evidenta_contabila' })] }),
        2026,
      ),
    });
    expect(rows.some((d) => /eviden|registru/i.test(d.appliesTo) && d.eventType !== 'lease_contract_registration')).toBe(false);
  });
});

// ── Acceptance 9 — the citation hazards, pinned as absence ──────────────────────────────────────────

describe('citation hygiene in the shipped rules', () => {
  it('no cedare rule quotes the pre-2026 „în scop turistic” wording', () => {
    const cedareRules = PFA_2026_SYSTEM_REAL_PACKAGE.filter((r) => r.ruleId.startsWith('CEDARE_'));
    expect(cedareRules.length).toBeGreaterThan(0);
    for (const r of cedareRules) {
      const text = `${r.name} ${r.sourceArticle} ${r.parameters.map((p) => `${p.label} ${p.value} ${p.description ?? ''}`).join(' ')}`;
      expect(text).not.toContain('în scop turistic');
    }
  });

  it('no cedare rule cites the abrogated art. 84 alin. (11) or art. 87', () => {
    const cedareRules = PFA_2026_SYSTEM_REAL_PACKAGE.filter((r) => r.ruleId.startsWith('CEDARE_'));
    for (const r of cedareRules) {
      expect(r.sourceArticle).not.toContain('art. 84 alin. (11)');
      expect(r.sourceArticle).not.toContain('art. 87');
    }
  });
});

// ── The rule set keeps the three regimes apart ──────────────────────────────────────────────────────

describe('the three flat ratios cannot be confused', () => {
  it('patching the art. 84 ratio leaves art. 85 at 70 % net, and the reverse', async () => {
    const patch = (ruleId: string, ratio: number) =>
      PFA_2026_SYSTEM_REAL_PACKAGE.map((r) =>
        r.ruleId !== ruleId ? r : { ...r, parameters: r.parameters.map((p) => (p.id === 'expense_ratio' ? { ...p, value: ratio } : p)) },
      );

    const cedareWith85Ratio = await engine({
      gross: lei(100_000),
      method: 'cedare-art84',
      rules: patch('ACCOMMODATION_ART85_ROOMS_2026', 10),
    });
    expect(cedareWith85Ratio.status).toBe('computed');
    if (cedareWith85Ratio.status !== 'computed') return;
    // The cedare net is unmoved: 80 % of 100.000, not 90 %.
    expect(line(cedareWith85Ratio, 'Venit net art. 84')!.value).toBe(lei(80_000));

    const cedareWithOwnRatio = await engine({
      gross: lei(100_000),
      method: 'cedare-art84',
      rules: patch('CEDARE_ART84_2026', 30),
    });
    expect(cedareWithOwnRatio.status).toBe('computed');
    if (cedareWithOwnRatio.status !== 'computed') return;
    // Patching the cedare rule moves the cedare net — and only it.
    expect(line(cedareWithOwnRatio, 'Venit net art. 84')!.value).toBe(lei(70_000));
  });

  it('the art. 84 rule is selected only by a cedare method, never by the rooms rule', () => {
    const applicable = selectApplicableRules(PFA_2026_SYSTEM_REAL_PACKAGE, { taxYear: 2026, asOfDate: '2026-06-30' });
    const forRegime = (regime: string) => applicable.filter((r) => r.taxRegime === regime);
    expect(forRegime('cedare-art84-flat-ratio')).toHaveLength(1);
    expect(forRegime('cedare-art84x1-withheld')).toHaveLength(1);
    expect(forRegime('short-term-rooms-flat-ratio')).toHaveLength(1);
    // Three distinct calculators: a shared one would make the two ratios one parameter.
    const ids = new Set(
      [...forRegime('cedare-art84-flat-ratio'), ...forRegime('cedare-art84x1-withheld'), ...forRegime('short-term-rooms-flat-ratio')].map((r) => r.calculatorId),
    );
    expect(ids.size).toBe(3);
  });
});
