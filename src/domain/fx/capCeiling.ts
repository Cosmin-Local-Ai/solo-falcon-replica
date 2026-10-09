/**
 * TASK 10b — a statutory ceiling written in a foreign currency becomes a lei ceiling ONLY through an
 * explicit conversion, and that conversion is a legal act with a named basis.
 *
 * The rule that supplies the basis is HG 1/2016, Norme, Titlul IV, Cap. II, Secțiunea a 2-a, pct. 7
 * alin. (6): „Limita echivalentului în euro a cheltuielilor deductibile limitat, prevăzută la art. 68
 * din Codul fiscal, se transformă în lei la cursul mediu comunicat de Banca Națională a României pentru
 * anul în care s-a efectuat plata." So the ceiling converts at the BNR **annual average of the payment
 * year** — and the year is the year of PAYMENT, because art. 68 alin. (4) lit. b) attributes an expense
 * to the year it was paid.
 *
 * What this module refuses, and why:
 *
 * - **It never computes an annual average.** BNR publishes `CURSA_EURM` as the average of the 12 monthly
 *   averages; a mean of daily rates is a different number (research 23 §Q2). The only way a rate enters
 *   here is through `FxRateProvider`, which is a synchronous lookup.
 * - **It never guesses a missing rate.** A missing average is a refusal naming the currency, the year and
 *   the reason, and the caller keeps the cap `cap_unresolved`.
 * - **It does not choose a side of the hierarchy conflict.** CF art. 9 alin. (3) lit. b) + alin. (4)
 *   convert at the BNR rate on the date the sum is paid, and alin. (4) admits only methods „prevăzute
 *   expres în prezentul cod" — the Norme are not „prezentul cod". No primary text reconciles the two
 *   (research 22 §1, research 23 §Q1). So the applied reading is struck on `ceiling`, the other reading
 *   is struck alongside it as `alternative`, and the conflict itself travels on the RULE as a `conflict`
 *   parameter (`EUR_CONVERSION_CONFLICT` in `fiscal/deductibility2026.ts`), never as prose here.
 * - **The currency is a property of the amount, not of this module.** The cap arrives as `Money<C>` and
 *   leaves as `Bani` only through `convertToRon`. That is deliberate: CF art. 68 alin. (5) states its
 *   caps in euro and ONLY in euro, so no USD ceiling exists to strike and none may be added — the
 *   generic signature is what lets a future *verified* non-euro ceiling use the same path without
 *   re-deriving the law, not a licence to manufacture one.
 */
import { majorToMinor, money, type Bani, type Money } from '../money';
import { BASIS_CITATIONS, convertToRon, type ConversionBasis, type ConversionResult } from './convert';
import { isISOCalendarDate } from '../date';
import type { FxRateProvider, RateCurrency } from './provider';
import type { FxRateRecord, RateKind } from './rates';

/** The basis the app applies to a statutory ceiling: pct. 7 alin. (6). */
export const CAP_CEILING_BASIS: ConversionBasis = 'payment_year_annual_average';
/** The basis the competing reading would use: CF art. 9 alin. (3) lit. b) + alin. (4). */
export const CAP_CEILING_ALTERNATIVE_BASIS: ConversionBasis = 'payment_date_daily';

/** The rate a ceiling was actually struck at, with everything needed to defend it. */
export interface CapRateEvidence {
  currency: RateCurrency;
  basis: ConversionBasis;
  /** The article that supplies this basis — `BASIS_CITATIONS[basis]`, never a paraphrase. */
  citation: string;
  /** The printed decimal exactly as the store holds it. A double cannot hold `5.3470`. */
  rate: string;
  rateKind: RateKind;
  /** What the rate is anchored to: the payment year, or the payment date. */
  anchor: string;
  /** A current-year average is provisional by construction (B-33); a cap struck from one says so. */
  provisional: boolean;
  /** Set only when a daily rate had to be carried from an earlier banking day — app policy by analogy. */
  carriedFrom?: string;
  seriesCode: string;
  sourceUrl: string;
  fetchedAt: string;
}

export type CapCeilingReading =
  | { ok: true; ceiling: Bani; evidence: CapRateEvidence }
  | { ok: false; basis: ConversionBasis; citation: string; detail: string };

export interface CapCeilingStrike {
  currency: RateCurrency;
  /** The ceiling in the currency the law states it in, in minor units. Never `Bani`. */
  cap: Money<RateCurrency>;
  /** The year of payment — art. 68 alin. (4) lit. b) attributes by payment, pct. 7 alin. (6) anchors to it. */
  paymentYear: number;
  /** The lei ceiling under the reading the app applies. */
  ceiling: Bani;
  applied: CapRateEvidence;
  /**
   * The other reading, struck at the payment date. It is a reading, not a suggestion: when it cannot be
   * struck the reason is named, because an absent alternative reads as an oversight.
   */
  alternative: CapCeilingReading;
  provisional: boolean;
}

export type CapCeilingRefusal =
  | 'no_payment_date'
  | 'unusable_payment_date'
  | 'ambiguous_payment_year'
  | 'no_rate';

export type CapCeilingAttempt =
  | { ok: true; strike: CapCeilingStrike }
  | { ok: false; reason: CapCeilingRefusal; paymentYear?: number; detail: string };

/** Build the money a ceiling is stated in. `400` euros is 40000 euro cents, never 400 bani. */
export function capMoney(currency: RateCurrency, major: number): Money<RateCurrency> {
  return money(majorToMinor(major, currency), currency);
}

function evidence(record: FxRateRecord, basis: ConversionBasis, anchor: string): CapRateEvidence {
  return {
    currency: record.currency,
    basis,
    citation: BASIS_CITATIONS[basis],
    rate: record.rate,
    rateKind: record.rateKind,
    anchor,
    provisional: record.provisional,
    ...(record.carriedFrom !== undefined ? { carriedFrom: record.carriedFrom } : {}),
    seriesCode: record.seriesCode,
    sourceUrl: record.sourceUrl,
    fetchedAt: record.fetchedAt,
  };
}

function failureDetail(failure: Extract<ConversionResult, { ok: false }>): string {
  if (failure.reason === 'no_rate') return failure.detail;
  return `conversia a fost refuzată de stratul valutar: ${failure.reason}`;
}

/** The applied reading: pct. 7 alin. (6), the BNR annual average of the payment year. */
export function capCeilingAtPaymentYear(
  cap: Money<RateCurrency>,
  paymentYear: number,
  provider: FxRateProvider,
): CapCeilingReading {
  const result = convertToRon(cap, { basis: 'payment_year_annual_average', paymentYear }, provider);
  if (!result.ok) {
    return {
      ok: false,
      basis: CAP_CEILING_BASIS,
      citation: BASIS_CITATIONS[CAP_CEILING_BASIS],
      detail: failureDetail(result),
    };
  }
  return { ok: true, ceiling: result.ron.amount, evidence: evidence(result.rate, result.basis, String(paymentYear)) };
}

/** The competing reading: CF art. 9 alin. (3) lit. b) + alin. (4), the daily rate on the payment date. */
export function capCeilingAtPaymentDate(
  cap: Money<RateCurrency>,
  paymentDate: string,
  provider: FxRateProvider,
): CapCeilingReading {
  const result = convertToRon(cap, { basis: 'payment_date_daily', onDate: paymentDate }, provider);
  if (!result.ok) {
    return {
      ok: false,
      basis: CAP_CEILING_ALTERNATIVE_BASIS,
      citation: BASIS_CITATIONS[CAP_CEILING_ALTERNATIVE_BASIS],
      detail: failureDetail(result),
    };
  }
  return {
    ok: true,
    ceiling: result.ron.amount,
    evidence: evidence(
      { ...result.rate, ...(result.carriedForward && result.rate.rateDate !== undefined ? { carriedFrom: result.rate.rateDate } : {}) },
      result.basis,
      paymentDate,
    ),
  };
}

/**
 * Strike a foreign-currency ceiling for a whole category.
 *
 * `paymentDates` are the payment dates of the records the ceiling bounds. They decide two things: the
 * year the average is keyed to, and whether the competing reading can be struck at all. A category paid
 * in two different years genuinely has two pct. 7 alin. (6) ceilings and no primary text says which one
 * an annual limit uses, so the whole strike refuses rather than picking one.
 */
export function strikeCapCeiling(input: {
  cap: Money<RateCurrency>;
  paymentDates: readonly string[];
  provider: FxRateProvider;
}): CapCeilingAttempt {
  const dates = [...input.paymentDates].sort((a, b) => a.localeCompare(b));
  if (dates.length === 0) {
    return {
      ok: false,
      reason: 'no_payment_date',
      detail: 'plafonul se raportează la anul plății, dar nicio înregistrare din această categorie nu are o dată de plată.',
    };
  }
  for (const d of dates) {
    if (!isISOCalendarDate(d)) {
      return {
        ok: false,
        reason: 'unusable_payment_date',
        detail: `data plății „${d}” nu este o dată calendaristică ISO (AAAA-LL-ZZ), deci nu poate fi raportată la nicio serie BNR.`,
      };
    }
  }
  const years = [...new Set(dates.map(d => Number(d.slice(0, 4))))].sort((a, b) => a - b);
  if (years.length > 1) {
    return {
      ok: false,
      reason: 'ambiguous_payment_year',
      paymentYear: years[0],
      detail:
        `plățile din această categorie au fost efectuate în mai mulți ani (${years.join(', ')}), iar pct. 7 alin. (6) `
        + 'raportează plafonul la „anul în care s-a efectuat plata" la singular; nicio sursă primară nu spune a cărui '
        + 'an medie anuală se aplică unui plafon anual cu plăți în ani diferiți, deci plafonul rămâne nemăsurat.',
    };
  }

  const paymentYear = years[0];
  const applied = capCeilingAtPaymentYear(input.cap, paymentYear, input.provider);
  if (!applied.ok) {
    return { ok: false, reason: 'no_rate', paymentYear, detail: applied.detail };
  }

  const alternative: CapCeilingReading =
    dates.length === 1
      ? capCeilingAtPaymentDate(input.cap, dates[0], input.provider)
      : {
          ok: false,
          basis: CAP_CEILING_ALTERNATIVE_BASIS,
          citation: BASIS_CITATIONS[CAP_CEILING_ALTERNATIVE_BASIS],
          detail:
            `cealaltă citire convertește plafonul la cursul BNR valabil la data plății, dar această categorie are `
            + `${dates.length} date de plată diferite (${dates.join(', ')}); un plafon anual convertit la date diferite `
            + 'dă plafonuri diferite, iar nicio sursă primară nu spune la care dintre ele se raportează.',
        };

  return {
    ok: true,
    strike: {
      currency: input.cap.currency,
      cap: input.cap,
      paymentYear,
      ceiling: applied.ceiling,
      applied: applied.evidence,
      alternative,
      provisional: applied.evidence.provisional,
    },
  };
}
