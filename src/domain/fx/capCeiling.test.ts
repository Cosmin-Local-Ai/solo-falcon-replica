/**
 * TASK 10b — the statutory ceiling stated in a foreign currency becomes a lei ceiling, and only through a
 * rate the app was GIVEN.
 *
 * Every expected figure was derived BY HAND before the suite ran, and the arithmetic is written out above
 * it. Nothing here was read off a failing diff.
 *
 * The two FY2025/FY2026-daily rates are real published BNR figures captured in
 * `docs/ai/research/23_fx_conversion_and_bnr_rates_2026.md`: the FY2025 EUR annual average (`CURSA_EURM`)
 * is 5,0415 lei, and the daily reference rate published for 2026-10-08 (`CURSZ_EUR`) is 5,3470 lei.
 *
 * THE FY2026 AVERAGE IS NOT A LEGAL FIGURE AND CANNOT BE. BNR publishes a year's average only after the
 * year closes, so no FY2026 average exists to cite (research 23 §"What must stay unresolved" item 4). The
 * two FY2026 records below are test scaffolding for the provisional → final mechanism: round numbers, a
 * non-BNR source URL and a series code that is deliberately not the official one, so they can never be
 * mistaken for a publication. A test that needed a real FY2026 average would be asking for a fabricated
 * legal figure, and the expectation would change — never the rate.
 */
import { describe, expect, it } from 'vitest';
import {
  capCeilingAtPaymentDate,
  capCeilingAtPaymentYear,
  capMoney,
  strikeCapCeiling,
} from './capCeiling';
import { fixtureRateProvider, RateStore } from './provider';
import { seriesCodeStatus, type FxRateRecord } from './rates';
import { lei } from '../money';

const BNR_SERIES_PAGE = 'https://www.bnr.ro/1975-cursul-de-schimb-serii-statistice';

/** Verified: the FY2025 EUR annual average, as printed in the „Serii anuale – valori medii –" table. */
const EUR_ANNUAL_2025: FxRateRecord = {
  currency: 'EUR',
  rate: '5.0415',
  rateKind: 'annual_average',
  rateYear: 2025,
  seriesCode: 'CURSA_EURM',
  sourceUrl: BNR_SERIES_PAGE,
  fetchedAt: '2026-10-08T09:00:00Z',
  provisional: false,
  entryMode: 'manual',
};

/** Verified: the daily reference rate BNR published for 2026-10-08, the live payload in research 23. */
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

/** TEST SCAFFOLDING, NOT A PUBLISHED RATE — see the header. A hand-typed FY2026 average, provisional. */
const EUR_ANNUAL_2026_PROVISIONAL: FxRateRecord = {
  currency: 'EUR',
  rate: '5.3100',
  rateKind: 'annual_average',
  rateYear: 2026,
  seriesCode: 'CURSA_EURM-TEST',
  sourceUrl: 'https://example.invalid/hand-entered-test-average',
  fetchedAt: '2026-10-09T09:00:00Z',
  provisional: true,
  entryMode: 'manual',
};

/** TEST SCAFFOLDING, NOT A PUBLISHED RATE — the same year after „BNR published it", for the lifecycle. */
const EUR_ANNUAL_2026_FINAL: FxRateRecord = {
  ...EUR_ANNUAL_2026_PROVISIONAL,
  rate: '5.4000',
  provisional: false,
  fetchedAt: '2026-12-31T13:00:00Z',
};

const provider = fixtureRateProvider([
  EUR_ANNUAL_2025,
  EUR_ANNUAL_2026_PROVISIONAL,
  EUR_DAILY_2026_10_08,
]);

describe('the euro ceilings in the rule package become lei ceilings', () => {
  it('converts 400 EUR at the FY2025 average of 5,0415 lei', () => {
    // 400,00 EUR = 40.000 cents × 5,0415 = 201.660,00 bani = 2.016,60 lei. D-ROUND-2 rounds the product to a
    // whole leu and 60 bani exceeds 50, so the ceiling is 2.017 lei. Before 2026-10-15 this pinned 2.016,60.
    const attempt = strikeCapCeiling({
      cap: capMoney('EUR', 400),
      paymentDates: ['2025-06-10'],
      provider,
    });
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    expect(attempt.strike.ceiling).toBe(lei(2017));
    expect(attempt.strike.paymentYear).toBe(2025);
    expect(attempt.strike.provisional).toBe(false);
  });

  it('converts every distinct ceiling the package states — 400, 100 and 4.000 euro', () => {
    // 100 × 5,0415 = 504,15 lei → 15 bani neglected → 504 lei. 4.000 × 5,0415 = 20.166,00 lei, already
    // whole, so rounding changes nothing — the control that shows the movement is the fraction, not the size.
    const sports = strikeCapCeiling({ cap: capMoney('EUR', 100), paymentDates: ['2025-06-10'], provider });
    const dues = strikeCapCeiling({ cap: capMoney('EUR', 4000), paymentDates: ['2025-06-10'], provider });
    expect(sports.ok && sports.strike.ceiling).toBe(lei(504));
    expect(dues.ok && dues.strike.ceiling).toBe(lei(20166));
  });

  it('the euro figure never becomes bani on the way through: the cap stays a euro amount', () => {
    const attempt = strikeCapCeiling({ cap: capMoney('EUR', 400), paymentDates: ['2025-06-10'], provider });
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    // 400 EUR is 40.000 euro cents — a different quantity from the 201.700 bani it converts to, and a
    // different unit. Reading one as the other is exactly what `paramBani` refuses and what B-32 was.
    expect(attempt.strike.cap).toEqual({ amount: 40000, currency: 'EUR' });
    expect(attempt.strike.currency).toBe('EUR');
    expect(attempt.strike.ceiling).not.toBe(attempt.strike.cap.amount);
  });

  it('names pct. 7 alin. (6) as the applied basis, with the rate and its provenance attached', () => {
    const attempt = strikeCapCeiling({ cap: capMoney('EUR', 400), paymentDates: ['2025-06-10'], provider });
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    expect(attempt.strike.applied.basis).toBe('payment_year_annual_average');
    expect(attempt.strike.applied.citation).toContain('pct. 7 alin. (6)');
    expect(attempt.strike.applied.rate).toBe('5.0415');
    expect(attempt.strike.applied.seriesCode).toBe('CURSA_EURM');
    expect(attempt.strike.applied.sourceUrl).toBe(BNR_SERIES_PAGE);
    expect(attempt.strike.applied.anchor).toBe('2025');
  });

  it('strikes the competing reading at the payment date, and it is a different number', () => {
    // CF art. 9 alin. (3) lit. b) + alin. (4): 400 × 5,3470 = 2.138,80 lei → 80 bani exceeds 50 → 2.139 lei,
    // against the 2.017 lei pct. 7 alin. (6) gives. Both are shown; the app does not decide which rule wins.
    const attempt = strikeCapCeiling({ cap: capMoney('EUR', 400), paymentDates: ['2026-10-08'], provider });
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    expect(attempt.strike.alternative.ok).toBe(true);
    if (!attempt.strike.alternative.ok) return;
    expect(attempt.strike.alternative.ceiling).toBe(lei(2139));
    expect(attempt.strike.alternative.evidence.basis).toBe('payment_date_daily');
    expect(attempt.strike.alternative.evidence.citation).toContain('art. 9 alin. (3) lit. b)');
  });
});

describe('a missing rate is a refusal, and the refusal names the datum', () => {
  it('refuses a year with no recorded average, and says the average is not computable', () => {
    const attempt = strikeCapCeiling({ cap: capMoney('EUR', 400), paymentDates: ['2024-06-10'], provider });
    expect(attempt.ok).toBe(false);
    if (attempt.ok) return;
    expect(attempt.reason).toBe('no_rate');
    expect(attempt.paymentYear).toBe(2024);
    expect(attempt.detail).toContain('2024');
    expect(attempt.detail).toContain('nu se calculează din cursurile zilnice');
  });

  it('refuses rather than reaching for a neighbouring year', () => {
    // 2025 is recorded and 2024 is not; a strike for 2024 must not quietly use 2025.
    const attempt = strikeCapCeiling({ cap: capMoney('EUR', 400), paymentDates: ['2024-12-30'], provider });
    expect(attempt.ok).toBe(false);
  });

  it('refuses a category paid in two different years instead of choosing one average', () => {
    const attempt = strikeCapCeiling({
      cap: capMoney('EUR', 400),
      paymentDates: ['2025-06-10', '2026-10-08'],
      provider,
    });
    expect(attempt.ok).toBe(false);
    if (attempt.ok) return;
    expect(attempt.reason).toBe('ambiguous_payment_year');
    expect(attempt.detail).toContain('2025, 2026');
  });

  it('refuses an unusable payment date rather than coercing it', () => {
    const attempt = strikeCapCeiling({ cap: capMoney('EUR', 400), paymentDates: ['2026-6-1'], provider });
    expect(attempt.ok).toBe(false);
    if (attempt.ok) return;
    expect(attempt.reason).toBe('unusable_payment_date');
  });

  it('refuses a category with no payment date at all', () => {
    const attempt = strikeCapCeiling({ cap: capMoney('EUR', 400), paymentDates: [], provider });
    expect(attempt.ok).toBe(false);
    if (attempt.ok) return;
    expect(attempt.reason).toBe('no_payment_date');
  });

  it('the alternative reading says why it cannot be struck when the payments fall on different days', () => {
    // The applied ceiling is unaffected — pct. 7 alin. (6) anchors to the year, not the day. But the art. 9
    // reading anchors to the day, and a year with two payment days has two answers.
    const attempt = strikeCapCeiling({
      cap: capMoney('EUR', 400),
      paymentDates: ['2026-10-08', '2026-10-09'],
      provider,
    });
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    expect(attempt.strike.alternative.ok).toBe(false);
    if (attempt.strike.alternative.ok) return;
    expect(attempt.strike.alternative.detail).toContain('2 date de plată diferite');
  });
});

describe('provisional → final, at the rate layer', () => {
  it('a ceiling struck from a provisional average is provisional', () => {
    const attempt = strikeCapCeiling({ cap: capMoney('EUR', 400), paymentDates: ['2026-10-08'], provider });
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    // 400 × 5,3100 = 2.124,00 lei — provisional, because BNR has published no FY2026 average.
    expect(attempt.strike.ceiling).toBe(lei(2124));
    expect(attempt.strike.provisional).toBe(true);
    expect(attempt.strike.applied.provisional).toBe(true);
  });

  it('replacing the rate by rateKey turns the same ceiling final, with a different number', () => {
    const store = new RateStore();
    store.add(EUR_ANNUAL_2026_PROVISIONAL);

    const before = strikeCapCeiling({ cap: capMoney('EUR', 400), paymentDates: ['2026-10-08'], provider: store });
    expect(before.ok && before.strike.ceiling).toBe(lei(2124));
    expect(before.ok && before.strike.provisional).toBe(true);

    // The provisional → final door: same (currency, kind, year), so `replace` overwrites in place.
    store.replace(EUR_ANNUAL_2026_FINAL);
    expect(store.size).toBe(1);

    const after = strikeCapCeiling({ cap: capMoney('EUR', 400), paymentDates: ['2026-10-08'], provider: store });
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    // 400 × 5,4000 = 2.160,00 lei.
    expect(after.strike.ceiling).toBe(lei(2160));
    expect(after.strike.provisional).toBe(false);
  });
});

describe('the strike is currency-generic, and that is not a licence to invent a ceiling', () => {
  it('the same path converts a hand-typed USD ceiling — no rule in the package states one', () => {
    // CF art. 68 alin. (5) states its ceilings in euro and ONLY in euro. This fixture exists to prove the
    // converter does not hardcode EUR, not to assert that any USD ceiling exists: the USD annual-average
    // series code is pattern-derived, and the `-PATTERN` label is what keeps it honest.
    const usdAnnual: FxRateRecord = {
      currency: 'USD',
      rate: '4.5000',
      rateKind: 'annual_average',
      rateYear: 2025,
      seriesCode: 'CURSA_USD-PATTERN',
      sourceUrl: BNR_SERIES_PAGE,
      fetchedAt: '2026-10-08T09:00:00Z',
      provisional: false,
      entryMode: 'manual',
    };
    const usdProvider = fixtureRateProvider([usdAnnual]);
    const attempt = strikeCapCeiling({ cap: capMoney('USD', 500), paymentDates: ['2025-06-10'], provider: usdProvider });
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    // 500,00 USD = 50.000 cents × 4,5000 = 225.000 bani = 2.250,00 lei.
    expect(attempt.strike.ceiling).toBe(lei(2250));
    expect(attempt.strike.currency).toBe('USD');
    expect(seriesCodeStatus(attempt.strike.applied.seriesCode)).toBe('unverified');
  });

  it('a lei amount is not a ceiling, and does not compile as one', () => {
    // A `Money<'RON'>` is not a ceiling in a foreign currency — there is nothing to convert. The type
    // refuses the call, and `convertToRon` refuses it again at runtime for a caller arriving untyped.
    // @ts-expect-error — 'RON' is the target of a conversion, never its source.
    const reading = capCeilingAtPaymentYear({ amount: 40000, currency: 'RON' }, 2025, provider);
    expect(reading.ok).toBe(false);
  });

  it('the payment-date reading carries the carry-forward when the day had no published rate', () => {
    const daily = fixtureRateProvider([
      { ...EUR_DAILY_2026_10_08, rateDate: '2026-10-07' },
    ]);
    const reading = capCeilingAtPaymentDate(capMoney('EUR', 400), '2026-10-08', daily);
    expect(reading.ok).toBe(true);
    if (!reading.ok) return;
    expect(reading.evidence.carriedFrom).toBe('2026-10-07');
  });
});
