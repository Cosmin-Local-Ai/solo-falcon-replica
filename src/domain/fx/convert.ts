/**
 * Converting a foreign-currency amount to lei — TASK 10a.
 *
 * ## Why `basis` is a required, discriminated argument
 *
 * The research this task rests on (`docs/ai/research/23_fx_conversion_and_bnr_rates_2026.md`) found that
 * the same-looking question — „what is this euro amount worth in lei?" — has **at least three different
 * correct answers**, and which one is correct depends on what is being converted:
 *
 * | What is being converted | Which rate | Citation |
 * | --- | --- | --- |
 * | EUR **income**, recognised on collection | BNR **daily reference rate on the date the sum is received** | CF art. 68 alin. (2) lit. a) („sumele încasate") + art. 9 alin. (3) lit. b) + alin. (4) |
 * | EUR **expense** amounts, and the art. 68 alin. (5) caps | BNR **average rate for the year of payment** | HG 1/2016, Titlul IV, Cap. II, pct. 7 alin. (6): „cursul mediu comunicat de Banca Națională a României pentru anul în care s-a efectuat plata" |
 * | The **25.000 EUR** sistem-real threshold | BNR average for the **year of income realisation** | „anului de realizare a venitului" — ANAF Cluj, 22.04.2026; OPANAF 2.736/2025 instructions |
 *
 * The last two anchor to **different years**. A payment made in 2026 for income realised in 2025 is the
 * ordinary case, not a corner case. So a single function that takes „a year" and picks a rate would be
 * correct for one rule and wrong for another, silently.
 *
 * That is why `ConversionAnchor` is a **discriminated union**: each basis carries its own anchor field, and
 * a call site that omits `basis` — or supplies the wrong anchor for the basis it named — does not compile.
 * The test file pins that with `@ts-expect-error`, so the guarantee cannot quietly decay.
 *
 * ## The conflict this module records rather than resolves
 *
 * The two conversion rules are not reconciled by any primary text:
 *
 * - **HG 1/2016, Titlul IV, Cap. II, pct. 7 alin. (6)** prescribes the **annual average of the payment
 *   year**. It remains in force in the official text, and ANAF Brașov and ANAF București both restate the
 *   rule with that citation in their PFA brochures.
 * - **CF art. 9 alin. (3) lit. b) + alin. (4)** prescribes the **daily rate on the date the sum is
 *   received**, and alin. (4) limits the permitted methods to those „prevăzute expres în **prezentul cod**"
 *   — a phrase that, read strictly, does not admit a rule sitting in a 2016 methodology norm.
 *
 * **This is unresolved and this module does not resolve it.** Both readings are on record
 * (`CONVERSION_HIERARCHY_CONFLICT`), the function implements whichever basis the caller names, and no
 * default is provided — because choosing a default *is* resolving the conflict, and the app is not
 * entitled to do that on the user's behalf. The UI must show both readings wherever a converted figure
 * appears.
 *
 * ## Rounding, and what is not claimed
 *
 * The product of an amount and a rate is generally fractional. This module rounds it **to the nearest ban**
 * (half-up), because the money type's unit is the ban and a fraction of a ban is not representable.
 *
 * It deliberately does **not** apply `roundArt66` (CF art. 66, which rounds to a whole **leu**) to
 * that product. art. 66 is the rule for rounding a sum of tax that is being calculated; whether it also
 * reaches an intermediate currency-conversion product is **not established by any text I read**, and
 * applying it here would move every converted amount by up to 0,50 lei on an unverified reading. The
 * existing art. 66 rounding stays exactly where it was — on the tax due. This choice is recorded in
 * `ROUNDING_CHOICE` so it can be reviewed rather than assumed.
 */

import { Decimal } from 'decimal.js-light';
import { type Bani, type Money, type RonMoney, isRon, money, toBaniNearest } from '../money';
import type { FxRateRecord } from './rates';
import type { FxRateProvider, RateCurrency } from './provider';

/** The three conversion rules the research identified. No fourth is assumed. */
export const CONVERSION_BASES = [
  'payment_date_daily',
  'payment_year_annual_average',
  'income_realisation_year_annual_average',
] as const;
export type ConversionBasis = (typeof CONVERSION_BASES)[number];

/**
 * The anchor each rule needs. Discriminated on `basis`, so the basis cannot be omitted and cannot be
 * paired with the wrong anchor.
 */
export type ConversionAnchor =
  | { basis: 'payment_date_daily'; onDate: string }
  | { basis: 'payment_year_annual_average'; paymentYear: number }
  | { basis: 'income_realisation_year_annual_average'; incomeRealisationYear: number };

/** What each basis means, in the words used on screen and in the phase doc. */
export const BASIS_LABELS: Record<ConversionBasis, string> = {
  payment_date_daily: 'cursul BNR pe data plății / încasării',
  payment_year_annual_average: 'cursul mediu BNR pe anul plății',
  income_realisation_year_annual_average: 'cursul mediu BNR pe anul realizării venitului',
};

/** The citation each basis rests on. Kept next to the basis so a call site cannot cite the wrong one. */
export const BASIS_CITATIONS: Record<ConversionBasis, string> = {
  payment_date_daily: 'art. 9 alin. (3) lit. b) + alin. (4) Codul fiscal; art. 68 alin. (2) lit. a)',
  payment_year_annual_average: 'HG 1/2016, Titlul IV, Cap. II, pct. 7 alin. (6)',
  income_realisation_year_annual_average: 'ANAF Cluj 22.04.2026; instrucțiuni OPANAF 2.736/2025',
};

/**
 * The unresolved hierarchy conflict, as data.
 *
 * Recorded here so the UI and the phase doc cite one source of truth, and so no later task can present one
 * reading as settled. TASK 10b must keep both readings visible when it computes the euro caps.
 */
export const CONVERSION_HIERARCHY_CONFLICT = {
  id: 'FX-CONVERSION-HIERARCHY-2026',
  status: 'unresolved' as const,
  readings: [
    {
      id: 'annual-average-payment-year',
      rule: 'BNR annual average for the year of payment',
      authority: 'HG 1/2016, Titlul IV, Cap. II, pct. 7 alin. (6)',
      support: 'In force in the official text; restated with this citation by ANAF Brașov and ANAF București PFA brochures.',
    },
    {
      id: 'daily-rate-on-receipt',
      rule: 'BNR daily reference rate on the date the sum is received',
      authority: 'CF art. 9 alin. (3) lit. b) + alin. (4)',
      support: 'alin. (4) admits only methods „prevăzute expres în prezentul cod", which on a strict reading excludes a rule stated outside the code.',
    },
  ],
  note: 'No primary text reconciles the two. The app applies the basis the caller names and shows both readings; it does not choose between them.',
} as const;

/** The rounding decision, stated rather than assumed. */
export const ROUNDING_CHOICE = {
  applied: 'nearest ban, half-up',
  notApplied: 'art. 66 rounding to a whole leu',
  reason: 'art. 66 governs the sum of tax being calculated; whether it reaches an intermediate conversion product is not established by any text read for this task, and applying it would move every converted amount by up to 0,50 lei on an unverified reading.',
  status: 'app decision, not a cited rule',
  /**
   * B-113 — where this decision was researched, and what the research graded it. Recorded here rather than
   * left in a commit message, because the honest form of this decision is a citation to a corpus that says
   * it does not know.
   *
   * The article's text is CONFIRMED verbatim in three research files — Titlul IV, Capitolul I, titled
   * „Stabilirea sumelor fixe", one unnumbered paragraph: „Sumele sunt calculate prin rotunjire la un leu,
   * prin neglijarea fracțiunilor de până la 50 de bani inclusiv și majorarea la leu a fracțiunilor ce
   * depășesc 50 de bani." What is not confirmed is whether „Sumele" reaches a converted amount on its way
   * into the base. The corpus grades that question UNVERIFIED, twice, in the very file that cites the
   * article for the conversion rules this app runs.
   */
  scopeResearch: {
    textConfirmedAt: [
      'docs/ai/research/20_cf_art66_rounding_and_art154_cass_exemption_2026.md:17',
      'docs/ai/research/23_fx_conversion_and_bnr_rates_2026.md:185',
      'docs/ai/research/49_proration_precision_fy2026.md:61',
    ],
    scopeGradedUnverifiedAt: [
      'docs/ai/research/23_fx_conversion_and_bnr_rates_2026.md:193',
      'docs/ai/research/23_fx_conversion_and_bnr_rates_2026.md:207',
    ],
    /**
     * The finding that turns B-113 from a bug into a decision request. The engine already implements art.
     * 66 correctly — `money.ts roundArt66` neglects a fraction of **50 bani or less** and raises a larger
     * one, which is the article's own boundary. Applied to the conversion product it reproduces every
     * published ANAF figure in the Sector 4 example: 2.488,50 → 2.488, and the forfetar 2.985,60 → 2.986
     * with net 11.942. So the disagreement is not about the rounding **mode**, which already matches ANAF,
     * and not about the rate or the basis — the control case at 4,974 agrees exactly. It is only about
     * **where the rule applies**, which is the part no primary text in this corpus settles.
     *
     * Pinned as passing assertions in `golden/fxTruncation.test.ts`, labelled as what art. 66 WOULD give,
     * so the decision can be taken on numbers rather than on a comment.
     */
    roundingModeAlreadyMatchesAnaf: true,
  },
} as const;

/**
 * B-144 — the evidence a lei figure carries when the rate behind it was not the final published one.
 *
 * This is `CapRateEvidence` (`fx/capCeiling.ts`) with the ceiling-specific fields dropped, and it exists so
 * the five-point honesty note has exactly ONE shape to render. A provisional ceiling and a provisional
 * threshold are two consequences of one fact: a lei number this app did not derive, standing in for a
 * published number that does not exist yet. `capCeiling.ts` imports this module, so the shared shape lives
 * here and not there.
 */
export interface ProvisionalRateEvidence {
  currency: RateCurrency;
  /** The printed decimal exactly as the record holds it — never re-formatted, never recomputed. */
  rate: string;
  /** The year (or, for a daily rate, the date) the record is anchored to, as the note names it. */
  anchor: string;
  seriesCode: string;
  /**
   * `false` never reaches this shape through `provisionalRateEvidence`, which returns `undefined` for a
   * final rate. It is `boolean` rather than the literal `true` so `CapRateEvidence` — which carries the
   * flag for both states — stays structurally assignable and the note needs no adapter.
   */
  provisional: boolean;
  entryMode: FxRateRecord['entryMode'];
  fetchedAt: string;
  sourceUrl: string;
}

/**
 * The evidence for one provisional conversion, read off the record the conversion actually used.
 *
 * Deliberately not a re-read of the store: the caller hands over the `FxRateRecord` from the
 * `ConversionResult`, so a note can never name a rate other than the one that produced the figure beside it.
 * Returns `undefined` for a final rate — the absence IS the answer, and it is why a surface can render
 * nothing without inventing a „not provisional” row.
 */
export function provisionalRateEvidence(rate: FxRateRecord): ProvisionalRateEvidence | undefined {
  if (!rate.provisional) return undefined;
  return {
    currency: rate.currency as RateCurrency,
    rate: rate.rate,
    anchor: rate.rateYear !== undefined ? String(rate.rateYear) : (rate.rateDate ?? ''),
    seriesCode: rate.seriesCode,
    provisional: true,
    entryMode: rate.entryMode,
    fetchedAt: rate.fetchedAt,
    sourceUrl: rate.sourceUrl,
  };
}

/** Why a conversion could not be performed. */
export type ConversionFailure =
  | { ok: false; reason: 'no_rate'; basis: ConversionBasis; currency: RateCurrency; anchor: string; detail: string }
  | { ok: false; reason: 'already_ron' }
  | { ok: false; reason: 'unsupported_currency'; currency: string };

export type ConversionResult =
  | {
      ok: true;
      ron: RonMoney;
      /** The record actually used, with its provenance and, if applicable, `carriedFrom`. */
      rate: FxRateRecord;
      basis: ConversionBasis;
      /** `true` when the daily rate used was carried forward from an earlier banking day (app policy). */
      carriedForward: boolean;
      /** `true` when the rate was not the final published figure — a 2026 annual average, for instance. */
      provisional: boolean;
      /**
       * B-144 — the provenance of that provisional rate, present exactly when `provisional` is `true`.
       * A caller that turns a provisional conversion into a lei figure can carry this to whatever surface
       * renders the figure, which is what stops the honesty note from re-reading the store and guessing
       * which rate was in play.
       */
      provisionalEvidence?: ProvisionalRateEvidence;
    }
  | ConversionFailure;

/** The currencies a BNR rate can be quoted in. `GBP`/`HUF` are storable; they are not offered for entry. */
const RATE_CURRENCIES: readonly string[] = ['EUR', 'USD', 'GBP', 'HUF'];
function isRateCurrency(value: string): value is RateCurrency {
  return RATE_CURRENCIES.includes(value);
}

/**
 * Convert a foreign-currency amount to lei, under a named rule.
 *
 * The function **refuses** rather than guesses. If no rate is recorded for the date or year the basis names,
 * it returns `no_rate` naming exactly what is missing. It never averages, never interpolates, and never
 * reaches for a nearby year — those are the fabrications this task exists to prevent.
 */
export function convertToRon(amount: Money, anchor: ConversionAnchor, provider: FxRateProvider): ConversionResult {
  if (isRon(amount)) return { ok: false, reason: 'already_ron' };

  // `Money`'s currency parameter is not narrowed away by `isRon`, so the RON case is checked again rather
  // than trusted, and a currency the app has no BNR series for is refused instead of converted at a
  // guessed rate.
  const currency = amount.currency;
  if (currency === 'RON') return { ok: false, reason: 'already_ron' };
  if (!isRateCurrency(currency)) return { ok: false, reason: 'unsupported_currency', currency };

  switch (anchor.basis) {
    case 'payment_date_daily': {
      const exact = provider.dailyRate(currency, anchor.onDate);
      if (exact) return product(amount, exact, anchor.basis, false);
      // No row for that calendar date. BNR publishes on banking days only, so a weekend or holiday
      // genuinely has no rate. The app's carry-forward policy may still answer — and when it does, the
      // record says so, because the substitution is an app decision and not a rule the code can cite.
      const carried = carryFromProvider(provider, currency, anchor.onDate);
      if (!carried) {
        return {
          ok: false,
          reason: 'no_rate',
          basis: anchor.basis,
          currency,
          anchor: anchor.onDate,
          detail: `niciun curs BNR înregistrat pentru ${currency} la data ${anchor.onDate}, niciun curs anterior în arhivă`,
        };
      }
      return product(amount, carried, anchor.basis, true);
    }
    case 'payment_year_annual_average': {
      const rate = provider.annualAverage(currency, anchor.paymentYear);
      if (!rate) {
        return {
          ok: false,
          reason: 'no_rate',
          basis: anchor.basis,
          currency,
          anchor: String(anchor.paymentYear),
          detail:
            `niciun curs mediu anual publicat pentru ${currency} în ${anchor.paymentYear}. BNR publică media `
            + 'anuală abia după închiderea anului — nu se calculează din cursurile zilnice, oricâte cursuri '
            + 'zilnice ar exista în registru. Media se înregistrează așa cum a fost publicată; până atunci '
            + 'plafonul rămâne nemăsurat.',
        };
      }
      return product(amount, rate, anchor.basis, false);
    }
    case 'income_realisation_year_annual_average': {
      const rate = provider.annualAverage(currency, anchor.incomeRealisationYear);
      if (!rate) {
        return {
          ok: false,
          reason: 'no_rate',
          basis: anchor.basis,
          currency,
          anchor: String(anchor.incomeRealisationYear),
          detail:
            `niciun curs mediu anual publicat pentru ${currency} în ${anchor.incomeRealisationYear} — nu se `
            + 'calculează din cursurile zilnice, oricâte cursuri zilnice ar exista în registru.',
        };
      }
      return product(amount, rate, anchor.basis, false);
    }
    default: {
      // Unreachable through the type: the union is exhaustive and every member is handled above. It is
      // reachable from untyped JavaScript — a basis read out of a payload, a hand-edited call. Returning
      // `undefined` there would let a conversion silently produce nothing, which is worse than a crash.
      // SAFETY: `anchor` is `never` here by construction, so the only way to inspect what actually arrived
      // is through an unknown; the value is used solely to name it in the error.
      const seen = (anchor as unknown as { basis?: unknown }).basis;
      throw new RangeError(`convertToRon: unknown conversion basis ${JSON.stringify(seen)}`);
    }
  }
}

/**
 * Look for the last published daily rate at or before `date`.
 *
 * Kept separate from the store's own lookup so the carry-forward remains a decision visible in the
 * converter's control flow, with the flag it sets on the record.
 */
function carryFromProvider(provider: FxRateProvider, currency: RateCurrency, date: string): FxRateRecord | null {
  // `dailyRates` is not part of the minimal `FxRateProvider` contract — a fixture that only answers exact
  // lookups is still a valid provider. So the carry-forward is attempted only when the provider can
  // enumerate, and a provider that cannot simply yields „no rate".
  const enumerate = (provider as { dailyRates?: (c: RateCurrency) => FxRateRecord[] }).dailyRates;
  if (typeof enumerate !== 'function') return null;
  const published = enumerate.call(provider, currency);
  let best: FxRateRecord | undefined;
  for (const row of published) {
    const when = row.rateDate;
    if (when === undefined || when > date) continue;
    if (best === undefined || (best.rateDate ?? '') < when) best = row;
  }
  if (best === undefined || best.rateDate === undefined) return null;
  return { ...best, carriedFrom: best.rateDate };
}

/**
 * amount × rate, in bani, rounded to the nearest ban. See `ROUNDING_CHOICE` for why not to a whole leu.
 *
 * The rate is parsed from its printed decimal string through `Decimal`, so no binary float ever touches a
 * money figure — the same reason `Bani` is an integer.
 */
function product(amount: Money, rate: FxRateRecord, basis: ConversionBasis, carriedForward: boolean): ConversionResult {
  const value = new Decimal(amount.amount).times(new Decimal(rate.rate));
  const rounded: Bani = toBaniNearest(value);
  return {
    ok: true,
    ron: money(rounded, 'RON'),
    rate,
    basis,
    carriedForward,
    provisional: rate.provisional,
    provisionalEvidence: provisionalRateEvidence(rate),
  };
}
