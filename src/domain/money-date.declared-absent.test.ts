import { describe, expect, it } from 'vitest';
import type { AppData, Expense, Revenue, SettingsState } from '../data/types';
import type { PfaIdentity, PfaProfile } from './models';
import {
  auditFiscalDates,
  countPostedOnDocumentDate,
  expenseDeclaredUnpaid,
  expenseFiscalDate,
  NO_MONEY_DATE,
  revenueDeclaredUncollected,
  revenueFiscalDate,
  selectYtd,
} from './aggregation';
import { lei, money, type Bani } from './money';

/**
 * B-159 — the app's words and its engine disagreed about an uncollected receipt.
 *
 * `moneyDate.revenueEmpty` has said since PG-2 that without a collection the sum is not `venit brut`
 * (CF art. 68 alin. (2) lit. a) — a sentence `docs/ai/research/37` §5 clears and §2.1 states as fact.
 * `revenueFiscalDate` answered `?? date`, so the receipt entered the gross base in the document's year.
 *
 * What gives is NOT the legal sentence and NOT the legacy fallback. Reading a *blank* money date as
 * „never collected” was rejected outright: every pre-Phase-9 payload — the whole published seed included —
 * carries only `date`, so that reading deletes the seed's entire base. That is a regression, not a fix.
 * What was missing is a state that says the money has not moved, and this file is the proof it now works:
 *
 * - `collected === null` / `paid === null` → no fiscal date at all, so no base;
 * - absence → the Phase 9 reading, unchanged, and pinned here so it cannot silently change;
 * - a date → unchanged.
 */

function identity(): PfaIdentity {
  return {
    nume: 'Test SRL', cnp: '', adresa: 'Str. Test 1', telefon: '0700000000', email: 'test@example.com',
    denumire: 'Test SRL', cui: '12345678', formaJuridica: 'SRL', numarRegComert: 'J40/123/2026',
    adresaSocietate: 'Str. Test 1', telefonSocietate: '0700000000', emailSocietate: 'test@example.com',
    contBancar: 'RO49BANK1234', banca: 'Test Bank',
  };
}

function profile(fiscalYear = 2026): PfaProfile {
  return {
    id: 'profile-test', pfaStartYear: 2026, fiscalYear, regime: 'impozit_pe_venit', caen: '6201',
    salaryStatus: 'nu', pensionerStatus: 'nu', socialInsuranceStatus: 'obligatoriu',
    vatRegistration: { status: 'inregistrat_art316' as const }, cashFloorLei: lei(0),
    identity: identity(), updatedAt: '2026-01-01T00:00:00.000Z',
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
    reservedAmount: null, profile: profile(), revenues: [], expenses: [], clients: [], filings: [],
    vatReturns: [], occupancySheets: [], vehicles: [], fixedAssets: [], documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] }, statements: [], snapshots: [],
    settings: emptySettings, ...overrides,
  };
}

function revenue(date: string, valoareFaraTva: Bani, tva: Bani): Revenue {
  return {
    id: `rev-${date}-${valoareFaraTva}`, tip: 'factura', nr: '1', date, client: 'Client Test', cui: '12345678',
    valoareFaraTva: money(valoareFaraTva, 'RON'), tva: money(tva, 'RON'), status: 'inregistrata',
  };
}

function expense(date: string, valoareFaraTva: Bani, tva: Bani): Expense {
  return {
    id: `exp-${date}-${valoareFaraTva}`, tip: 'factura', nr: '1', date, furnizor: 'Furnizor Test', cui: '87654321',
    valoareFaraTva: money(valoareFaraTva, 'RON'), tva: money(tva, 'RON'), status: 'inregistrata',
  };
}

describe('B-159: a declared non-collection has no fiscal date and no base', () => {
  it('resolves a declared-uncollected receipt to no fiscal date, not to the document date', () => {
    const uncollected: Revenue = { ...revenue('2026-05-04', lei(100), lei(19)), collected: null };
    expect(revenueDeclaredUncollected(uncollected)).toBe(true);
    expect(revenueFiscalDate(uncollected)).toBe(NO_MONEY_DATE);
    // The legacy reading of the SAME record with the key absent is untouched — that is the 311.200 pin.
    expect(revenueFiscalDate(revenue('2026-05-04', lei(100), lei(19)))).toBe('2026-05-04');
  });

  it('keeps a declared-uncollected receipt out of venit brut in every year', () => {
    const uncollected: Revenue = { ...revenue('2026-12-20', lei(100), lei(19)), collected: null };
    expect(selectYtd(makeData({ revenues: [uncollected] }), '2026-12-31').revenue).toBe(0);
    expect(
      selectYtd(makeData({ profile: profile(2027), revenues: [uncollected] }), '2027-12-31').revenue,
    ).toBe(0);
    // Same document, money in: the sum is back, in the year the money moved.
    const collected: Revenue = { ...uncollected, collected: '2027-01-10' };
    expect(selectYtd(makeData({ revenues: [collected] }), '2026-12-31').revenue).toBe(0);
    expect(
      selectYtd(makeData({ profile: profile(2027), revenues: [collected] }), '2027-12-31').revenue,
    ).toBe(lei(119));
  });

  it('keeps a declared-unpaid cost out of the deductible base — art. 68 alin. (4) lit. b) is a condition, not a deadline', () => {
    const unpaid: Expense = { ...expense('2026-05-06', lei(50), lei(9.5)), paid: null };
    expect(expenseDeclaredUnpaid(unpaid)).toBe(true);
    expect(expenseFiscalDate(unpaid)).toBe(NO_MONEY_DATE);
    // research/37 §3.3: a never-paid expense is permanently non-deductible. Before B-159 the app had no
    // way to record this at all, and the cost was deducted in the document's year.
    expect(selectYtd(makeData({ expenses: [unpaid] }), '2026-12-31').expenses).toBe(0);
    expect(
      selectYtd(makeData({ profile: profile(2027), expenses: [unpaid] }), '2027-12-31').expenses,
    ).toBe(0);
    // The legacy reading is unchanged: absent key, deducted in the document year.
    expect(selectYtd(makeData({ expenses: [expense('2026-05-06', lei(50), lei(9.5))] }), '2026-12-31').expenses)
      .toBe(lei(59.5));
  });

  it('a declared non-movement is an answer, not a broken date: the fiscal-date audit stays silent', () => {
    // `auditFiscalDates` flags dates that cannot be read. Asking the person to correct a fact they have
    // already stated correctly would be a new defect wearing the old machinery.
    const data = makeData({
      revenues: [{ ...revenue('2026-05-04', lei(100), lei(19)), collected: null }],
      expenses: [{ ...expense('2026-05-06', lei(50), lei(9.5)), paid: null }],
    });
    expect(auditFiscalDates(data)).toEqual([]);
  });

  it('a declared non-movement is not counted as posted on the document date (B-67)', () => {
    // B-67's count is the number of records whose YEAR was chosen on paper. A record with no money
    // movement has no year at all, so counting it would overstate the disclosure.
    const revenues = [
      { date: '2026-05-04', collected: undefined as string | null | undefined },
      { date: '2026-05-05', collected: null as string | null | undefined },
    ];
    expect(countPostedOnDocumentDate(revenues, [], '2026')).toBe(1);
  });
});
