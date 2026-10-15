/**
 * TASK 10b — a ledger record written in a foreign currency enters the lei base at the BNR daily reference
 * rate on the date the sum was PAID or RECEIVED. That rule is CF art. 9 alin. (3) lit. b) + alin. (4), and
 * it is not EUR-specific, so USD travels it with exactly the same authority as EUR.
 *
 * Every expected figure was derived BY HAND before the suite ran; the arithmetic is written above it.
 *
 * WHAT IS VERIFIED HERE AND WHAT IS NOT. BNR's XML genuinely carries USD daily reference rates, so the
 * USD *daily path* is real and is what these tests exercise. The NUMBERS are test scaffolding: research 23
 * captured the EUR row (5,3470 lei on 2026-10-08) and no USD figure, so no USD rate below is attributed to
 * BNR, and the USD annual-average series code keeps its `-PATTERN` suffix because it was never read off the
 * series page. A real USD rate would arrive through the store, not through a fixture.
 */
import { describe, expect, it } from 'vitest';
// B-139: the test asserts the Romanian wording of the money field, so it reads the same map the domain writes from.
import { moneyFieldLabels } from '../../ui/copy/records';
import { normaliseLedgerToRon, normaliseStoredLedger } from './ledger';
import { fixtureRateProvider } from './provider';
import type { FxRateRecord } from './rates';
import { seedData } from '../../data/seed';
import type { AppData, Expense, Revenue } from '../../data/types';
import { money, majorToMinor, ron, lei, type Bani } from '../money';

const usd = (major: number) => money(majorToMinor(major, 'USD'), 'USD');
const eur = (major: number) => money(majorToMinor(major, 'EUR'), 'EUR');

/** Test scaffolding — see the header. The daily path for USD is real; this number is not a BNR figure. */
const USD_DAILY_2026_10_08: FxRateRecord = {
  currency: 'USD',
  rate: '4.5000',
  rateKind: 'daily_reference',
  rateDate: '2026-10-08',
  seriesCode: 'CURSZ_USD-PATTERN',
  sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
  fetchedAt: '2026-10-08T13:05:00Z',
  provisional: false,
  entryMode: 'fetched',
};

/** The EUR row research 23 actually captured from the live BNR payload on 2026-10-08. */
const EUR_DAILY_2026_10_08: FxRateRecord = {
  currency: 'EUR',
  rate: '5.3470',
  rateKind: 'daily_reference',
  rateDate: '2026-10-08',
  seriesCode: 'CURSZ_EUR',
  sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
  fetchedAt: '2026-10-08T13:05:00Z',
  provisional: false,
  entryMode: 'fetched',
};

const provider = fixtureRateProvider([USD_DAILY_2026_10_08, EUR_DAILY_2026_10_08]);

function expense(over: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-usd',
    tip: 'factura',
    nr: 'FCT-USD-1',
    date: '2026-10-08',
    furnizor: 'Furnizor Test',
    cui: 'RO00000000',
    valoareFaraTva: usd(100),
    tva: usd(19),
    status: 'inregistrata',
    ...over,
  };
}

function revenue(over: Partial<Revenue> = {}): Revenue {
  return {
    id: 'rev-usd',
    tip: 'factura',
    nr: 'FCT-USD-R1',
    date: '2026-01-03',
    client: 'Codexa SRL',
    cui: 'RO12345678',
    valoareFaraTva: usd(1000),
    tva: usd(190),
    status: 'inregistrata',
    ...over,
  };
}

function ledger(revenues: Revenue[], expenses: Expense[]): AppData {
  return { ...seedData, revenues, expenses };
}

describe('a foreign-currency record enters the lei base at the payment-date daily rate', () => {
  it('converts a USD expense at the rate of the day it was paid', () => {
    // 100,00 USD = 10.000 cents × 4,5000 = 45.000 bani = 450,00 lei
    //  19,00 USD =  1.900 cents × 4,5000 =  8.550 bani =  85,50 lei
    const outcome = normaliseLedgerToRon(ledger([], [expense()]), provider);
    expect(outcome.conversions).toHaveLength(1);
    const converted = outcome.data.expenses[0];
    expect(converted.valoareFaraTva).toEqual({ amount: 45000 as Bani, currency: 'RON' });
    expect(converted.tva).toEqual({ amount: 8550 as Bani, currency: 'RON' });
    expect(outcome.unconverted).toHaveLength(0);
  });

  it('carries the provenance with the conversion, because BNR requires indicarea sursei', () => {
    const outcome = normaliseLedgerToRon(ledger([], [expense()]), provider);
    const c = outcome.conversions[0];
    expect(c).toMatchObject({
      recordKind: 'expense',
      recordId: 'exp-usd',
      currency: 'USD',
      onDate: '2026-10-08',
      basis: 'payment_date_daily',
      rate: '4.5000',
      seriesCode: 'CURSZ_USD-PATTERN',
      sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
      fetchedAt: '2026-10-08T13:05:00Z',
      provisional: false,
    });
    expect(c.citation).toContain('art. 9 alin. (3) lit. b)');
  });

  it('converts income at the COLLECTION date, not the invoice date (art. 68 alin. (2) lit. a)', () => {
    // The invoice is dated January; the money arrived on 2026-10-08. „sumele încasate" is the anchor, so
    // the rate is the October one. An invoice-date conversion would be a different, uncited rule.
    const outcome = normaliseLedgerToRon(
      ledger([revenue({ collected: '2026-10-08' })], []),
      fixtureRateProvider([
        { ...USD_DAILY_2026_10_08, rate: '4.0000', rateDate: '2026-01-03' },
        USD_DAILY_2026_10_08,
      ]),
    );
    expect(outcome.conversions[0].onDate).toBe('2026-10-08');
    expect(outcome.conversions[0].rate).toBe('4.5000');
    // 1.000,00 USD × 4,5000 = 4.500,00 lei — not the 4.000,00 lei the January rate would have given.
    expect(outcome.data.revenues[0].valoareFaraTva.amount).toBe(450000 as Bani);
  });

  it('flags the carry-forward when the payment day had no published rate', () => {
    // 2026-10-10 is a Saturday; BNR publishes on banking days only. The substitution is app policy by
    // analogy (art. 68^3 alin. (4) / art. 85 alin. (4)), so it must be visible, never silent.
    const outcome = normaliseLedgerToRon(
      ledger([], [expense({ date: '2026-10-10', paid: '2026-10-10' })]),
      fixtureRateProvider([{ ...USD_DAILY_2026_10_08, rateDate: '2026-10-09' }]),
    );
    expect(outcome.conversions).toHaveLength(1);
    expect(outcome.conversions[0].carriedFrom).toBe('2026-10-09');
    expect(outcome.conversions[0].onDate).toBe('2026-10-10');
  });

  it('leaves a record with no rate for its date unconverted, and names the date it asked for', () => {
    const outcome = normaliseLedgerToRon(
      ledger([], [expense({ date: '2026-01-03', paid: '2026-01-03' })]),
      provider,
    );
    expect(outcome.conversions).toHaveLength(0);
    expect(outcome.unconverted).toHaveLength(1);
    expect(outcome.unconverted[0].detail).toContain('2026-01-03');
    // The stored record is untouched — no rate was invented for it.
    expect(outcome.data.expenses[0].valoareFaraTva).toEqual(usd(100));
  });

  it('never half-converts a record: one missing field keeps the whole record out', () => {
    const mixed = expense({ id: 'exp-mixed', valoareFaraTva: ron(500), tva: usd(19) });
    const outcome = normaliseLedgerToRon(
      ledger([], [mixed]),
      fixtureRateProvider([EUR_DAILY_2026_10_08]), // no USD row at all
    );
    expect(outcome.conversions).toHaveLength(0);
    // B-139: this used to read `toContain('tva')`, pinning the raw property name as the correct thing to
    // show a person. It now pins the wording, and that the code is absent.
    expect(outcome.unconverted[0].detail).toContain(moneyFieldLabels.tva);
    expect(outcome.unconverted[0].detail).not.toContain('„tva”');
    expect(outcome.data.expenses[0].valoareFaraTva).toEqual(ron(500));
    expect(outcome.data.expenses[0].tva).toEqual(usd(19));
  });

  it('returns a RON ledger untouched, so the pass is idempotent', () => {
    const ronOnly = ledger([], [expense({ valoareFaraTva: ron(100), tva: ron(19) })]);
    const once = normaliseLedgerToRon(ronOnly, provider);
    expect(once.conversions).toHaveLength(0);
    // Identity, not equality: an untouched record is the same object, so nothing downstream can drift.
    expect(once.data.expenses[0]).toBe(ronOnly.expenses[0]);
    const twice = normaliseLedgerToRon(once.data, provider);
    expect(twice.conversions).toHaveLength(0);
    expect(twice.data.expenses[0].valoareFaraTva).toEqual({ amount: 10000 as Bani, currency: 'RON' });
  });

  it('converting twice cannot drift: the lei copy is stable under a second pass', () => {
    const once = normaliseLedgerToRon(ledger([], [expense()]), provider);
    const twice = normaliseLedgerToRon(once.data, provider);
    expect(twice.data.expenses[0].valoareFaraTva).toEqual(once.data.expenses[0].valoareFaraTva);
    expect(twice.conversions).toHaveLength(0);
  });

  it('refuses to convert against a date that is not a calendar date', () => {
    const outcome = normaliseLedgerToRon(
      ledger([], [expense({ date: '2026-13-45', paid: '2026-13-45' })]),
      provider,
    );
    expect(outcome.conversions).toHaveLength(0);
    expect(outcome.unconverted[0].detail).toContain('nu este');
  });

  it('an EUR record converts on the same path, at the rate research 23 actually captured', () => {
    // 100,00 EUR × 5,3470 = 534,70 lei — the verified figure, as the EUR control for the USD tests above.
    const outcome = normaliseLedgerToRon(
      ledger([], [expense({ valoareFaraTva: eur(100), tva: eur(19) })]),
      provider,
    );
    expect(outcome.conversions[0].rate).toBe('5.3470');
    expect(outcome.data.expenses[0].valoareFaraTva).toEqual({ amount: 53470 as Bani, currency: 'RON' });
    expect(outcome.conversions[0].netLei).toBe(lei(534.7));
  });
});

/**
 * Phase 10c — the conversion says which date it is anchored on, and the boundary every surface reads.
 *
 * `onDate` is a fiscal date: collection for income, payment for an expense. When the record carries no
 * money date, `aggregation.ts` falls back to the document date — a standing Phase 9 reading of a field
 * older payloads only ever had, not a per-record guess. What Phase 10c adds is that the fallback is NAMED
 * on the conversion, so a rate keyed to an invoice date can never be read as a rate keyed to a payment.
 * The money dates themselves are PG-2's inputs; no screen writes them yet, and nothing here invents one.
 */
describe('Phase 10c — the anchor date is named, and the boundary is one call', () => {
  it('names the document date as the anchor when the record has no money date', () => {
    const outcome = normaliseLedgerToRon(ledger([], [expense()]), provider);
    expect(outcome.conversions[0].onDate).toBe('2026-10-08');
    expect(outcome.conversions[0].onDateSource).toBe('date');
  });

  it('names the payment date when the record carries one', () => {
    const outcome = normaliseLedgerToRon(
      ledger([], [expense({ date: '2026-09-02', paid: '2026-10-08' })]),
      provider,
    );
    expect(outcome.conversions[0].onDate).toBe('2026-10-08');
    expect(outcome.conversions[0].onDateSource).toBe('paid');
  });

  it('names the collection date for a revenue, not the invoice date', () => {
    const outcome = normaliseLedgerToRon(
      ledger(
        [revenue({ date: '2026-01-03', collected: '2026-10-08', valoareFaraTva: eur(1000), tva: eur(190) })],
        [],
      ),
      provider,
    );
    expect(outcome.conversions[0].onDate).toBe('2026-10-08');
    expect(outcome.conversions[0].onDateSource).toBe('collected');
  });

  it('carries the amounts as recorded, each with its own currency, beside the lei result', () => {
    const c = normaliseLedgerToRon(ledger([], [expense()]), provider).conversions[0];
    expect(c.netRecorded).toEqual(usd(100));
    expect(c.vatRecorded).toEqual(usd(19));
    expect(c.netLei).toBe(45000 as Bani);
    expect(c.vatLei).toBe(8550 as Bani);
  });

  it('normaliseStoredLedger reads the rates the app stores, and a second pass converts nothing', () => {
    const data = { ...ledger([], [expense()]), fxRates: [EUR_DAILY_2026_10_08, USD_DAILY_2026_10_08] };
    const once = normaliseStoredLedger(data);
    expect(once.conversions).toHaveLength(1);
    expect(once.data.expenses[0].valoareFaraTva).toEqual({ amount: 45000 as Bani, currency: 'RON' });

    const twice = normaliseStoredLedger(once.data);
    expect(twice.conversions).toHaveLength(0);
    expect(twice.data.expenses[0].valoareFaraTva).toEqual(once.data.expenses[0].valoareFaraTva);
  });

  it('normaliseStoredLedger with no stored rate converts nothing and says what is missing', () => {
    const outcome = normaliseStoredLedger({ ...ledger([], [expense()]), fxRates: [] });
    expect(outcome.conversions).toHaveLength(0);
    expect(outcome.unconverted).toHaveLength(1);
    expect(outcome.unconverted[0].detail).toContain('USD');
    expect(outcome.unconverted[0].onDate).toBe('2026-10-08');
  });
});
