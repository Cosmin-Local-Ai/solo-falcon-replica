/**
 * B-144 — a provisional annual average that measured **income** is reported, not just a provisional
 * annual average that measured a **ceiling**.
 *
 * B-137 closed the ceiling half. This is the other half, and it is the more consequential one. A ceiling
 * converted at a stand-in rate changes one deduction. The art. 84 gross converted at a stand-in rate is the
 * number the threshold rows are measured on — `data/dashboard.ts` hands the same estimate to
 * `getThresholdStatuses` — so a provisional rate here can move which contribution tier a person lands in.
 * That is a change to the shape of the year, not to a line inside it.
 *
 * The ledger disclosure cannot see this. `CurrencySection` reports `normaliseStoredLedger`'s conversions,
 * which are anchored on money dates and are daily by construction. art. 84 alin. (3¹) measures at the BNR
 * average **of the year the income is realised**, through a second pass the ledger never walks. So the
 * provisional-ness had to be produced where the gross is produced — here — or no surface could state it.
 *
 * What these tests refuse, in the same order the brief lists them:
 * - a provisional rate that decided the gross is named, with the record that produced it;
 * - a **final** rate reports nothing, because the absence is the answer and a "not provisional" row would
 *   be noise that trains the reader to ignore the note;
 * - a declared lei contract rent that drove the gross reports **no** rate, even though the documents were
 *   converted at a provisional one — the conversion only checked that two producers agreed, and naming it
 *   as though it had measured the income would claim more than happened;
 * - the never-derive refusal still holds on this path: twelve daily rates for the year and no recorded
 *   average is a refusal, not an average, and a refusal reports no provisional rate either.
 */
import { describe, expect, it } from 'vitest';
import { selectCedareGross, selectEstimateOperands, selectIncomeDeterminationMethod } from './estimateBasis';
import type { AppData, Revenue, SettingsState } from '../data/types';
import type { PfaProfile, LeaseFactsYear } from './models';
import type { FxRateRecord } from './fx/rates';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import { lei, money } from './money';

const emptySettings: SettingsState = {
  cotaTva: 0.19,
  company: { denumire: 'Test SRL', cui: '12345678', numarRegComert: 'J40/123/2026', adresa: 'Str. Test 1', caen: [] },
  personal: { nume: 'Test', cnp: '', adresa: 'Str. Test 1', telefon: '0700000000', email: 'test@example.com' },
  bankAccounts: [],
  eFactura: { trimitere: 'manual', dateContact: '' },
};

function profile(over: Partial<PfaProfile> = {}): PfaProfile {
  return {
    id: 'p-b144',
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
    vatRegistration: { status: 'inregistrat_art316' },
    leaseFactsYears: [lease()],
    ...over,
  };
}

/** A natural-person tenant: the fact that selects art. 84 over art. 84¹. */
function lease(over: Partial<LeaseFactsYear> = {}): LeaseFactsYear {
  return { fiscalYear: 2026, tenantNature: 'persoana_fizica', ...over };
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

/** 1.000 EUR of rent documented inside FY2026 and collected in 2027 — art. 84 counts it in 2026. */
function euroRent(): Revenue {
  return {
    id: 'rev-b144-1',
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

/** The FY2026 average a person recorded while the year is still open. */
const PROVISIONAL_2026: FxRateRecord = {
  currency: 'EUR', rate: '5.3100', rateKind: 'annual_average', rateYear: 2026,
  seriesCode: 'CURSA_EURM', sourceUrl: 'https://www.bnr.ro', fetchedAt: '2026-10-01T21:30:00Z',
  provisional: true, entryMode: 'manual',
};

/** The same number once BNR publishes it: same rate, different state. */
const FINAL_2026: FxRateRecord = { ...PROVISIONAL_2026, provisional: false, entryMode: 'fetched' };

/**
 * Twelve 2026 dailies, deliberately averaging to something **other** than 5,3100 so that a change which
 * started deriving the annual average from them would produce a different gross and fail, rather than
 * quietly passing. Their plain mean is 5,4100 — 100 bani per euro away from the recorded figure.
 */
const DAILIES_2026: FxRateRecord[] = Array.from({ length: 12 }, (_, i) => ({
  currency: 'EUR' as const,
  rate: (5.4 + i * 0.001).toFixed(4),
  rateKind: 'daily_reference' as const,
  rateDate: `2026-${String(i + 1).padStart(2, '0')}-15`,
  seriesCode: 'CURSZ_EUR',
  sourceUrl: 'https://www.bnr.ro',
  fetchedAt: '2026-10-01T00:00:00Z',
  provisional: false,
  entryMode: 'fetched' as const,
}));

describe('B-144 — the provisional annual average behind an income measure is reported where it is used', () => {
  it('a provisional average that measured the gross is named, with the record that produced it', () => {
    const d = data({ revenues: [euroRent()], fxRates: [PROVISIONAL_2026] });
    const g = selectCedareGross(d, '2026-12-31', 'cedare-art84');
    // 1.000 EUR × 5,3100 = 5.310,00 lei. The money is unchanged by this task; only the disclosure is new.
    expect(g.gross).toBe(lei(5_310));
    expect(g.provisionalAnnualAverage).toHaveLength(1);
    const [rate] = g.provisionalAnnualAverage!;
    // The printed decimal, exactly as the record holds it — a note that re-formats a rate has started
    // inventing a second representation of it.
    expect(rate.rate).toBe('5.3100');
    expect(rate.currency).toBe('EUR');
    expect(rate.anchor).toBe('2026');
    expect(rate.seriesCode).toBe('CURSA_EURM');
    expect(rate.entryMode).toBe('manual');
    expect(rate.sourceUrl).toBe('https://www.bnr.ro');
    expect(rate.fetchedAt).toBe('2026-10-01T21:30:00Z');
  });

  it('one rate behind twelve documents is named once, not twelve times', () => {
    const d = data({
      revenues: [
        euroRent(),
        { ...euroRent(), id: 'rev-b144-2', nr: 'CH-02', date: '2026-06-30' },
        { ...euroRent(), id: 'rev-b144-3', nr: 'CH-03', date: '2026-03-15' },
      ],
      fxRates: [PROVISIONAL_2026],
    });
    const g = selectCedareGross(d, '2026-12-31', 'cedare-art84');
    expect(g.gross).toBe(lei(15_930));
    expect(g.provisionalAnnualAverage).toHaveLength(1);
  });

  it('a FINAL average reports nothing: the absence is the answer, not an empty warning', () => {
    const d = data({ revenues: [euroRent()], fxRates: [FINAL_2026] });
    const g = selectCedareGross(d, '2026-12-31', 'cedare-art84');
    // Same rate, same money — only the state differs, and only the state changes what the screen says.
    expect(g.gross).toBe(lei(5_310));
    expect(g.provisionalAnnualAverage).toBeUndefined();
  });

  it('a declared lei contract rent drove the gross, so no conversion rate is blamed for it', () => {
    // The person declared 5.310 lei of contract rent for the year; the register documents 1.000 EUR, which
    // converts to exactly that. The two producers agree, so the gross is the declared lei figure and the
    // conversion only tested the agreement. Reporting the provisional rate here would say "this rate
    // measured your income" when it did not.
    const d = data({
      profile: profile({ leaseFactsYears: [lease({ contractRentAnnual: lei(5_310) })] }),
      revenues: [euroRent()],
      fxRates: [PROVISIONAL_2026],
    });
    const g = selectCedareGross(d, '2026-12-31', 'cedare-art84');
    expect(g.gross).toBe(lei(5_310));
    expect(g.provisionalAnnualAverage).toBeUndefined();
  });

  it('art. 84¹ measures at a daily rate, and this disclosure stays out of its way', () => {
    // The ledger pass already reports provisional dailies (`fx.ledger.provisionalInTotal`). This field is
    // the annual-average blind spot only; duplicating the daily report here would be two surfaces answering
    // one question.
    const d = data({
      profile: profile({ leaseFactsYears: [lease({ tenantNature: 'entitate_cu_evidenta_contabila' })] }),
      revenues: [{ ...euroRent(), collected: '2026-05-20' }],
      fxRates: [
        {
          currency: 'EUR', rate: '5.3100', rateKind: 'daily_reference', rateDate: '2026-05-19',
          seriesCode: 'CURSZ_EUR', sourceUrl: 'https://www.bnr.ro', fetchedAt: '2026-10-01T21:30:00Z',
          provisional: true, entryMode: 'manual',
        },
      ],
    });
    const g = selectCedareGross(d, '2026-12-31', 'cedare-art84x1');
    expect(g.provisionalAnnualAverage).toBeUndefined();
  });

  it('twelve daily rates and no recorded average still refuse, and a refusal reports no provisional rate', () => {
    // The trap, one level over. BNR's method is the mean of the twelve MONTHLY averages; a mean of these
    // twelve dailies is 5,4100 and would produce a gross of 5.410 lei. The engine refuses instead, and the
    // refusal is not a provisional figure — so nothing may be reported as one.
    const d = data({ revenues: [euroRent()], fxRates: DAILIES_2026 });
    const g = selectCedareGross(d, '2026-12-31', 'cedare-art84');
    expect(g.gross).toBeNull();
    expect(g.detail).toContain('nu se calculează din cursurile zilnice');
    expect(g.detail).toContain('oricâte cursuri zilnice ar exista în registru');
    expect(g.provisionalAnnualAverage).toBeUndefined();
  });
});

describe('B-144 — the fact travels with the estimate, so the threshold card can read it', () => {
  const rules = [...PFA_2026_SYSTEM_REAL_PACKAGE];

  it('the assembler resolves this register to art. 84, which is the only annual-average income path', () => {
    const d = data({ revenues: [euroRent()], fxRates: [PROVISIONAL_2026] });
    expect(selectIncomeDeterminationMethod(d, rules, '2026-12-31')).toBe('cedare-art84');
  });

  it('selectEstimateOperands carries the provisional rate on both branches', () => {
    // Both branches of the union carry the field, so the assertion is written without a branch: whether the
    // registry later refuses this register is a different question from whether the pass that ran used a
    // stand-in rate.
    const d = data({ revenues: [euroRent()], fxRates: [PROVISIONAL_2026] });
    const operands = selectEstimateOperands(d, '2026-12-31', rules);
    expect(operands.provisionalIncomeRates).toHaveLength(1);
    expect(operands.provisionalIncomeRates[0]!.rate).toBe('5.3100');
  });

  it('the same call with a final average carries an empty list, not an absent field', () => {
    const d = data({ revenues: [euroRent()], fxRates: [FINAL_2026] });
    const operands = selectEstimateOperands(d, '2026-12-31', rules);
    expect(operands.provisionalIncomeRates).toEqual([]);
  });

  it('a sistem-real register carries an empty list rather than an undefined one', () => {
    // `undefined` is reserved for an estimate that never went through the assembler — a stored snapshot, a
    // hand-built fixture. A register that went through it and used no provisional rate answers `[]`.
    const d = data({ profile: profile({ leaseFactsYears: [] }), revenues: [euroRent()], fxRates: [PROVISIONAL_2026] });
    const operands = selectEstimateOperands(d, '2026-12-31', rules);
    expect(operands.provisionalIncomeRates).toEqual([]);
  });
});
