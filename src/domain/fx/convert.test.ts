import { describe, it, expect } from 'vitest';
import {
  BASIS_CITATIONS,
  BASIS_LABELS,
  CONVERSION_BASES,
  CONVERSION_HIERARCHY_CONFLICT,
  convertToRon,
  ROUNDING_CHOICE,
  type ConversionAnchor,
} from './convert';
import { fixtureRateProvider, RateStore } from './provider';
import { eur, majorToMinor, money, type Money } from '../money';
import type { FxRateRecord } from './rates';

/**
 * TASK 10a — conversion requires an explicit `basis`.
 *
 * The research found at least three correct answers to „what is this euro amount worth in lei?", and which
 * one is correct depends on what is being converted. A function that took „a year" and picked a rate would
 * be right for one rule and silently wrong for another. So the anchor is a discriminated union, and these
 * tests pin three things:
 *
 * 1. a call site that omits the basis **does not compile** (`@ts-expect-error` — an unused directive is
 *    itself a `tsc` error, so the guarantee cannot quietly decay);
 * 2. the payment-year anchor and the income-realisation-year anchor are genuinely different inputs and can
 *    legitimately name different years;
 * 3. a missing rate is a refusal, never a fabricated number — and nothing here averages.
 */

/** Amounts stated in major units, built through `majorToMinor` so no test hand-writes a branded integer. */
const ronBani = (lei: number) => money(majorToMinor(lei, 'RON'), 'RON');
const eurBani = (euro: number) => money(majorToMinor(euro, 'EUR'), 'EUR');

const DAILY: FxRateRecord[] = [
  {
    currency: 'EUR', rate: '5.3470', rateKind: 'daily_reference', rateDate: '2026-03-15',
    seriesCode: 'CURSZ_EUR', sourceUrl: 'https://curs.bnr.ro/files/xml/years/nbrfxrates2026.xml',
    fetchedAt: '2026-03-15T13:05:00Z', provisional: false, entryMode: 'fetched',
  },
  {
    currency: 'EUR', rate: '5.3410', rateKind: 'daily_reference', rateDate: '2026-02-27',
    seriesCode: 'CURSZ_EUR', sourceUrl: 'https://curs.bnr.ro/files/xml/years/nbrfxrates2026.xml',
    fetchedAt: '2026-02-27T13:05:00Z', provisional: false, entryMode: 'fetched',
  },
];

const ANNUAL: FxRateRecord[] = [
  {
    currency: 'EUR', rate: '4.9631', rateKind: 'annual_average', rateYear: 2025,
    seriesCode: 'CURSA_EURM', sourceUrl: 'https://www.bnr.ro/1975-cursul-de-schimb-serii-statistice',
    fetchedAt: '2026-01-15T09:00:00Z', provisional: false, entryMode: 'manual',
  },
  {
    currency: 'EUR', rate: '5.3100', rateKind: 'annual_average', rateYear: 2026,
    seriesCode: 'CURSA_EURM', sourceUrl: 'https://www.bnr.ro/1975-cursul-de-schimb-serii-statistice',
    fetchedAt: '2026-10-09T09:00:00Z', provisional: true, entryMode: 'manual',
  },
];

const provider = fixtureRateProvider([...DAILY, ...ANNUAL]);

describe('the three bases are distinct', () => {
  it('names exactly the three the research identified', () => {
    expect(CONVERSION_BASES).toEqual([
      'payment_date_daily',
      'payment_year_annual_average',
      'income_realisation_year_annual_average',
    ]);
  });

  it('each basis carries its own citation, so a call site cannot cite the wrong rule', () => {
    expect(BASIS_CITATIONS.payment_date_daily).toContain('art. 9 alin. (3) lit. b)');
    expect(BASIS_CITATIONS.payment_year_annual_average).toContain('pct. 7 alin. (6)');
    expect(BASIS_CITATIONS.income_realisation_year_annual_average).toContain('OPANAF 2.736/2025');
    expect(BASIS_LABELS.payment_date_daily).toBe('cursul BNR pe data plății / încasării');
  });

  it('the daily basis uses the rate for the exact date', () => {
    const result = convertToRon(eur(100), { basis: 'payment_date_daily', onDate: '2026-03-15' }, provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 10.000 bani × 5,3470 = 53.470 bani = 534,70 lei. D-ROUND-2 rounds the product to a whole leu and 70
    // bani exceeds 50, so the converted amount is 535 lei. Before 2026-10-15 this pinned 534,70 lei.
    expect(result.ron).toEqual(ronBani(535));
    expect(result.rate.rate).toBe('5.3470');
    expect(result.carriedForward).toBe(false);
  });

  it('the payment-year basis uses the annual average of the payment year', () => {
    const result = convertToRon(eur(100), { basis: 'payment_year_annual_average', paymentYear: 2025 }, provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 10.000 × 4,9631 = 49.631 bani = 496,31 lei; 31 bani is at or under 50, so it is neglected → 496 lei.
    expect(result.ron).toEqual(ronBani(496));
    expect(result.rate.seriesCode).toBe('CURSA_EURM');
  });

  it('the bases give different numbers for the same amount', () => {
    const amount = eur(1000);
    const results = [
      convertToRon(amount, { basis: 'payment_date_daily', onDate: '2026-03-15' }, provider),
      convertToRon(amount, { basis: 'payment_year_annual_average', paymentYear: 2025 }, provider),
      convertToRon(amount, { basis: 'income_realisation_year_annual_average', incomeRealisationYear: 2025 }, provider),
      convertToRon(amount, { basis: 'payment_year_annual_average', paymentYear: 2026 }, provider),
    ];
    const values = results.map((r) => (r.ok ? r.ron.amount : r.reason));
    // daily 534.700 vs annual-2025 496.310 vs annual-2026 531.000 — the choice of rule is worth money,
    // which is exactly why it cannot be implicit.
    expect(new Set(values).size).toBe(3);
  });
});

describe('omitting the basis does not compile', () => {
  it('rejects a call with no anchor at all', () => {
    // @ts-expect-error — the basis is required; there is no default, because a default WOULD be resolving
    // the unresolved hierarchy conflict on the user's behalf.
    expect(() => convertToRon(eur(100))).toThrow();
  });

  it('rejects an anchor with no basis discriminant', () => {
    // @ts-expect-error — `onDate` alone does not say which rule is being applied.
    expect(() => convertToRon(eur(100), { onDate: '2026-03-15' }, provider)).toThrow(/unknown conversion basis/);
  });

  it('rejects a year paired with the daily basis', () => {
    // @ts-expect-error — a daily basis needs a date, not a year.
    const anchor: ConversionAnchor = { basis: 'payment_date_daily', paymentYear: 2026 };
    expect(anchor.basis).toBe('payment_date_daily');
  });

  it('rejects a payment year paired with the income-realisation basis', () => {
    // @ts-expect-error — the threshold is keyed to the year of income realisation, not of payment.
    const anchor: ConversionAnchor = { basis: 'income_realisation_year_annual_average', paymentYear: 2025 };
    expect(anchor.basis).toBe('income_realisation_year_annual_average');
  });
});

describe('the payment year and the income-realisation year may legitimately differ', () => {
  it('converts a 2026 payment of 2025 income at two different rates, under two different bases', () => {
    const amount = eur(10_000);
    const onPaymentYear = convertToRon(amount, { basis: 'payment_year_annual_average', paymentYear: 2026 }, provider);
    const onIncomeYear = convertToRon(amount, { basis: 'income_realisation_year_annual_average', incomeRealisationYear: 2025 }, provider);
    expect(onPaymentYear.ok && onIncomeYear.ok).toBe(true);
    if (!onPaymentYear.ok || !onIncomeYear.ok) return;
    // 2026 average (provisional) vs 2025 average. One conversion function serving both without a basis
    // would silently pick one of these — the failure the brief names explicitly.
    expect(onPaymentYear.ron.amount).not.toBe(onIncomeYear.ron.amount);
    expect(onPaymentYear.rate.rateYear).toBe(2026);
    expect(onIncomeYear.rate.rateYear).toBe(2025);
  });

  it('carries the provisional flag out, so a 2026 figure cannot read as final', () => {
    const result = convertToRon(eur(100), { basis: 'payment_year_annual_average', paymentYear: 2026 }, provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provisional).toBe(true);
    expect(result.rate.provisional).toBe(true);
  });
});

describe('a missing rate is a refusal, never a number', () => {
  it('refuses a date with no recorded rate and no earlier row, naming the date it asked for', () => {
    const result = convertToRon(eur(100), { basis: 'payment_date_daily', onDate: '2025-01-01' }, provider);
    if (result.ok || result.reason !== 'no_rate') throw new Error('expected a no_rate refusal');
    expect(result.anchor).toBe('2025-01-01');
    expect(result.currency).toBe('EUR');
  });

  it('refuses a year with no published annual average, and says the average is not computable', () => {
    const result = convertToRon(eur(100), { basis: 'payment_year_annual_average', paymentYear: 2023 }, provider);
    if (result.ok || result.reason !== 'no_rate') throw new Error('expected a no_rate refusal');
    // The refusal itself teaches: it names the reason no figure is available rather than leaving the
    // reader to reach for a mean of the daily rates.
    expect(result.detail).toContain('nu se calculează din cursurile zilnice');
  });

  it('refuses a RON amount — there is nothing to convert', () => {
    const result = convertToRon(ronBani(100), { basis: 'payment_date_daily', onDate: '2026-03-15' }, provider);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('already_ron');
  });

  it('carries forward over a gap only when an earlier row exists, and flags it', () => {
    // 2026-03-01 is a Sunday; the last published row before it is Friday 2026-02-27.
    const result = convertToRon(eur(100), { basis: 'payment_date_daily', onDate: '2026-03-01' }, provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.carriedForward).toBe(true);
    expect(result.rate.rateDate).toBe('2026-02-27');
    expect(result.rate.carriedFrom).toBe('2026-02-27');
    // 10.000 × 5,3410 = 53.410 bani = 534,10 lei → 10 bani neglected → 534 lei.
    expect(result.ron).toEqual(ronBani(534));
  });

  it('a provider that cannot enumerate simply yields no_rate rather than guessing', () => {
    const minimal = { dailyRate: () => null, annualAverage: () => null };
    const result = convertToRon(eur(100), { basis: 'payment_date_daily', onDate: '2026-03-15' }, minimal);
    expect(result.ok).toBe(false);
  });
});

describe('rounding at the conversion product is stated, not assumed (D-ROUND-2)', () => {
  it('a product whose leu fraction exceeds 50 bani is raised to the next leu', () => {
    // 12,34 EUR = 1.234 bani × 5,3470 = 6.598,198 bani = 65,98198 lei. The fraction above the whole leu is
    // 58,198 bani — over 50 — so art. 66 raises it: 66 lei = 6.600 bani. Under the pre-D-ROUND-2 rule this
    // pinned 6.598 bani (65,98 lei).
    const result = convertToRon(eurBani(12.34), { basis: 'payment_date_daily', onDate: '2026-03-15' }, provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ron.amount).toBe(6600);
  });

  it('a product whose leu fraction is 50 bani or less is neglected — even when that erases the amount', () => {
    // 5 bani × 5,3470 = 26,735 bani = 0,26735 lei. The fraction is 26,735 bani, at or under 50, so it is
    // neglected and the converted amount is **0 lei**.
    //
    // This is the cost of D-ROUND-2, pinned rather than hidden. Until 2026-10-15 this test asserted 27 bani
    // and its comment argued that rounding to a whole leu here would erase „a real amount on an unverified
    // reading”. That argument was heard and the decision went the other way anyway — so the case stays
    // pinned with its consequence stated, not deleted. A sub-lei conversion is now 0 lei, and a record that
    // converts to 0 lei contributes nothing to a lei total. The contrary argument stays in
    // `ROUNDING_CHOICE.contraryArguments` in the source, where a reader can find it.
    const result = convertToRon(eurBani(0.05), { basis: 'payment_date_daily', onDate: '2026-03-15' }, provider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ron.amount).toBe(0);
  });

  it('the boundary itself is pinned, not just the example: 50 bani neglected, 51 bani raised', () => {
    // The ANAF chain cannot separate art. 66 from a plain floor — 2.488,50 sits exactly ON the inclusive
    // boundary (research/53 §3). A rate of exactly 1,0000 makes the product's leu fraction equal to the
    // amount's own bani remainder, so both sides of the boundary can be pinned directly.
    const atOne = fixtureRateProvider([{
      currency: 'EUR', rate: '1.0000', rateKind: 'daily_reference', rateDate: '2026-03-15',
      seriesCode: 'CURSZ_EUR', sourceUrl: 'https://example.invalid/rate', fetchedAt: '2026-03-15T00:00:00Z',
      provisional: false, entryMode: 'manual',
    }]);
    const at = (euro: number) => {
      const r = convertToRon(eurBani(euro), { basis: 'payment_date_daily', onDate: '2026-03-15' }, atOne);
      if (!r.ok) throw new Error(`the conversion refused: ${JSON.stringify(r)}`);
      return r.ron.amount;
    };
    expect(at(1.49)).toBe(100); // 1,49 lei — 49 bani neglected
    expect(at(1.50)).toBe(100); // 1,50 lei — exactly 50, and the article says „inclusiv”
    expect(at(1.51)).toBe(200); // 1,51 lei — 51 bani exceeds 50, raised
    expect(at(2.00)).toBe(200); // already whole: rounding changes nothing
  });

  it('one rounding on the exact product, not two: a half-ban product is decided on its exact value', () => {
    // 100 bani × 1,5040 = 150,4 bani = 1,504 lei. Art. 66 on the exact value sees a fraction of 50,4 bani,
    // which exceeds 50, and raises to 2 lei. Rounding to bani first would give 150 bani and then neglect
    // it, yielding 1 lei. The two procedures disagree, and this pins which one the app runs.
    const odd = fixtureRateProvider([{
      currency: 'EUR', rate: '1.5040', rateKind: 'daily_reference', rateDate: '2026-03-15',
      seriesCode: 'CURSZ_EUR', sourceUrl: 'https://example.invalid/rate', fetchedAt: '2026-03-15T00:00:00Z',
      provisional: false, entryMode: 'manual',
    }]);
    const r = convertToRon(eurBani(1.00), { basis: 'payment_date_daily', onDate: '2026-03-15' }, odd);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ron.amount).toBe(200);
  });

  it('records that the rule behind the rounding is undetermined, and names the contrary readings', () => {
    // The status string is the guard: it must keep saying this is an app decision, and it must not claim
    // art. 66 governs conversion. If someone later “fixes” the comment into a legal assertion, this fails.
    expect(ROUNDING_CHOICE.status).toContain('app decision on an undetermined point');
    expect(ROUNDING_CHOICE.status).toContain('NOT a cited rule');
    // The denial is pinned verbatim: if someone later smooths the comment into a legal assertion, the
    // sentence disappears and this fails.
    expect(ROUNDING_CHOICE.status).toContain('not a claim that art. 66 governs conversion');
    // The field meanings inverted with the decision, and that inversion is itself pinned: `applied` is now
    // the whole-leu rule and `notApplied` is the nearest-ban behaviour this file used to defend.
    expect(ROUNDING_CHOICE.applied).toContain('whole leu');
    expect(ROUNDING_CHOICE.notApplied).toContain('nearest ban');
    // The self-contradiction that made this a judgement, not a lookup, stays on the record.
    expect(ROUNDING_CHOICE.scopeResearch.publishedChainsContradictEachOther).toBe(true);
    expect(ROUNDING_CHOICE.scopeResearch.contraryArguments.join(' ')).toContain('OUG 59/2005');
    expect(ROUNDING_CHOICE.scopeResearch.contraryArguments.join(' ')).toContain('art. 310 alin. (1)');
  });
});

describe('the hierarchy conflict stays on the record, unresolved', () => {
  it('carries both readings and neither is marked the winner', () => {
    expect(CONVERSION_HIERARCHY_CONFLICT.status).toBe('unresolved');
    expect(CONVERSION_HIERARCHY_CONFLICT.readings.map((r) => r.id).sort()).toEqual([
      'annual-average-payment-year',
      'daily-rate-on-receipt',
    ]);
    for (const reading of CONVERSION_HIERARCHY_CONFLICT.readings) {
      expect(reading.authority).toBeTruthy();
      expect(reading.rule).toBeTruthy();
    }
  });

  it('names both authorities: HG 1/2016 pct. 7 alin. (6) and CF art. 9 alin. (3) lit. b) + alin. (4)', () => {
    const authorities = CONVERSION_HIERARCHY_CONFLICT.readings.map((r) => r.authority).join(' | ');
    expect(authorities).toContain('HG 1/2016');
    expect(authorities).toContain('art. 9 alin. (3) lit. b)');
    expect(CONVERSION_HIERARCHY_CONFLICT.note).toContain('does not choose');
  });
});

describe('the store is the only source: a conversion never reaches for a rate it was not given', () => {
  it('a store loaded with nothing refuses every basis', () => {
    const empty = new RateStore();
    const anchors: ConversionAnchor[] = [
      { basis: 'payment_date_daily', onDate: '2026-03-15' },
      { basis: 'payment_year_annual_average', paymentYear: 2025 },
      { basis: 'income_realisation_year_annual_average', incomeRealisationYear: 2025 },
    ];
    for (const anchor of anchors) {
      const result = convertToRon(eur(100), anchor, empty);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('no_rate');
    }
  });

  it('never converts a currency the store holds no series for', () => {
    const result = convertToRon(money(majorToMinor(10, 'HUF'), 'HUF') as Money, { basis: 'payment_date_daily', onDate: '2026-03-15' }, provider);
    expect(result.ok).toBe(false);
  });
});
