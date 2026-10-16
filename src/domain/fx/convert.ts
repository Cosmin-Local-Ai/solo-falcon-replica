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
 * The product of an amount and a rate is generally fractional. Since **D-ROUND-2 (2026-10-15)** this module
 * rounds it **to a whole leu, at the point of conversion**, using `roundArt66` — the same function the tax
 * calculators already use. Before that date it rounded to the nearest ban (half-up) and left the fraction
 * for downstream sums; `ROUNDING_CHOICE.notApplied` keeps that behaviour on the record.
 *
 * **This is a reasoned choice on an undetermined point, not a cited rule, and nothing here claims that
 * art. 66 governs currency conversion.** What is established: ANAF converts and then publishes a whole-leu
 * figure and multiplies *that* downstream (2.488, not 2.488,50; 2.488 × 6 = 14.928), so the product is
 * rounded before use. What is **not** established: which rule rounds it. The Sector 4 leaflet contains two
 * chains and applies art. 66 at two intermediate steps and a plain floor at a third — it contradicts itself
 * — and the conversion line itself separates neither way, because 2.488,50 sits exactly on art. 66's
 * inclusive-50 boundary. `ROUNDING_CHOICE.scopeResearch` carries the separating cases and the contrary
 * readings (art. 310 alin. (1), HG 1/2016 Titlul VII, OUG 59/2005 art. 7), and
 * `docs/ai/research/53_anaf_sector4_rounding_inconsistency.md` is the source. The full argument, including
 * why the scope of the decision stops at the conversion product and does not extend to deduction lines, is
 * on `product()` below.
 */

import { Decimal } from 'decimal.js-light';
import { type Bani, type Money, type RonMoney, isRon, money, roundArt66 } from '../money';
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

/**
 * The rounding decision, stated rather than assumed. **Changed 2026-10-15 by D-ROUND-2 (B-113).** The
 * previous choice is quoted below rather than deleted, because the change is a judgement and a reader has
 * to be able to see what was replaced and on what grounds.
 */
export const ROUNDING_CHOICE = {
  applied: 'art. 66 rounding to a whole leu, at the point of conversion (D-ROUND-2)',
  notApplied:
    'nearest ban, half-up — the behaviour until 2026-10-15, kept on the record because the change is a '
    + 'reasoned choice and the alternative has to stay visible',
  reason:
    'ANAF converts and then publishes a whole-leu figure, and multiplies that figure downstream (2.488, not '
    + '2.488,50; 2.488 × 6 = 14.928), so the product is rounded before use. Which rule rounds it is NOT '
    + 'settled: the same document applies art. 66 at two intermediate steps and a plain floor at the final '
    + 'one. Art. 66\'s rule was chosen because HG 1/2016 Norme metodologice, Titlul IV, Cap. I, Secț. 1, '
    + 'pct. 4 applies it to bazele de calcul, which defeats the "only final sums owed" reading, and because '
    + 'roundArt66 is already the rule everywhere else in this codebase.',
  status: 'app decision on an undetermined point — NOT a cited rule, and not a claim that art. 66 governs conversion',
  /**
   * Where this was researched, and what the research graded. Recorded here rather than left in a commit
   * message, because the honest form of this decision is a citation to a corpus that says it does not know.
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
    decisionResearch: 'docs/ai/research/53_anaf_sector4_rounding_inconsistency.md',
    /**
     * **CORRECTED 2026-10-15, and the correction is carried rather than smoothed over.** The brief-68 pass
     * recorded at this spot that „the engine's rounding mode already matches ANAF's". That was **true of the
     * payment-date chain only.** The same ANAF Sector 4 document prices the same rent a second time at the
     * BNR annual average, and across the two chains it produces three separating cases pointing opposite
     * ways — so the document is not an oracle for any single rule, and no test in this repo may treat its
     * published chain as a specification. See `docs/ai/research/53_anaf_sector4_rounding_inconsistency.md` §3.
     */
    publishedChainsContradictEachOther: true,
    separatingCases: [
      { step: 'chain 1 forfetar', exact: '2.985,60', anaf: '2.986', art66: '2.986', floor: '2.985', follows: 'art. 66' },
      { step: 'chain 2 net', exact: '11.937,60', anaf: '11.938', art66: '11.938', floor: '11.937', follows: 'art. 66' },
      { step: 'chain 2 impozit', exact: '1.193,80', anaf: '1.193', art66: '1.194', floor: '1.193', follows: 'floor' },
    ],
    /** The conversion line itself separates neither way: 2.488,50 sits exactly on the inclusive-50 boundary. */
    conversionLineSeparates: false,
    contraryArguments: [
      'CF art. 310 alin. (1) and HG 1/2016 Titlul VII prescribe a DIFFERENT rounding for the conversions they do regulate; HG 1/2016 Titlul II prescribes none at all.',
      'OUG 59/2005 art. 7 expressly declines to round intermediate conversion elements — for local taxes.',
      'Art. 66 says „Sumele"; „fixe" appears only in the heading. No official source reads it either way here.',
      'Art. 6 alin. (2) CPPF (UNVERIFIED against a primary source) has the OPPOSITE 50-bani boundary for a sum actually paid.',
    ],
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
 * amount × rate, **rounded to a whole leu at the point of conversion**.
 *
 * **D-ROUND-2 (B-113, 2026-10-15) — this is a reasoned choice, not a rule the record settles.** Read
 * `docs/ai/research/53_anaf_sector4_rounding_inconsistency.md` before changing anything here.
 *
 * What **is** established: ANAF converts, then publishes a **whole-leu** figure, and it is that whole-leu
 * figure — 2.488 lei, not 2.488,50 — that it multiplies by 6 to reach the gross of 14.928. The product is
 * rounded before it is used. research/53 §4.
 *
 * What is **not** established: **which rule** produces that whole-leu figure. The ANAF București Sector 4
 * document that generated our two examples contains **two chains** for the same rent — the payment-date rate
 * 4,977 and the BNR annual average 4,974 — and across them it produces three cases where art. 66 and a
 * plain floor disagree: `2.985,60 → 2.986` (art. 66), `11.937,60 → 11.938` (art. 66), `1.193,80 → 1.193`
 * (floor). **It contradicts itself.** The conversion line itself separates neither way: 2.488,50 sits
 * exactly on art. 66's inclusive-50 boundary, and 2.487,00 has no fraction at all. So nothing in this file
 * may be read as "art. 66 governs currency conversion" — **no primary text says that, and this file does
 * not claim it.**
 *
 * Why art. 66's rule was chosen anyway: HG nr. 1/2016, Norme metodologice, Titlul IV, Cap. I, Secț. 1,
 * pct. 4 applies the same rounding to „bazele de calcul al impozitului”, which defeats the „only the final
 * sum owed” reading this file used to rest on; and `roundArt66` is already the rule this codebase applies in
 * some twenty places across income tax, CAS and CASS, so a converted amount now arrives at those places in
 * the shape they already expect.
 *
 * The contrary arguments, kept reachable rather than buried:
 * - Where the legislator **does** round a conversion product, it writes a **different** rule into the
 *   converting provision: CF art. 310 alin. (1) rounds the 88.500-euro ceiling to the next thousand, and
 *   HG 1/2016 Titlul VII rounds the 10.000-euro ceiling to thousands; HG 1/2016 Titlul II prescribes **no
 *   rounding at all** on the 15.000-euro nonprofit conversion. *A contrario*, that can read as Title IV
 *   conversions falling outside art. 66 rather than inside it.
 * - OUG nr. 59/2005 art. 7 says the opposite expressly for local taxes: „elementele de calcul intermediare
 *   utilizate la stabilirea acestora se convertesc fără rotunjirea zecimalelor la ordinul sutelor”. There
 *   is no equivalent express rule for Title IV — which cuts both ways.
 * - Art. 66's operative word is „Sumele”; „fixe” appears only in its heading. No official source was found
 *   reading it either way for a converted amount.
 * - Unverified lead, worth a primary check: art. 6 alin. (2) CPPF is quoted in secondary material with the
 *   **opposite** 50-bani boundary — in the taxpayer's favour below 50, in the budget's at 50 or above. If
 *   accurate, that is an independent reason not to treat art. 66 as the rule for a sum actually owed.
 *
 * **One rounding, on the exact product.** `roundArt66` is applied to the `Decimal` product, not to a
 * ban-rounded intermediate, because two roundings disagree at the boundary: an exact product of 61.450,4
 * bani is 614,504 lei, which art. 66 raises (50,4 bani exceeds 50), whereas rounding to bani first would
 * give 61.450 and then neglect it. One rounding on the exact value is what the article's words describe.
 *
 * **Ordering, and it is not neutral.** Every producer in this app converts **per record** and sums
 * afterwards — `fx/ledger.ts` maps each record through `convertField`, and `estimateBasis.ts
 * selectCedareGross` converts each document before `sumBani`. So rounding here is rounding **per part**,
 * which is what reproduces ANAF's published gross (2.488 × 6 = **14.928**) — but only when the rent is
 * recorded as six monthly documents. One document covering the same half-year converts 3.000 EUR once and
 * gives **14.931** lei. Both are pinned in `golden/fxTruncation.test.ts`: the difference is a fact about
 * record granularity, not something this function can decide.
 */
function product(amount: Money, rate: FxRateRecord, basis: ConversionBasis, carriedForward: boolean): ConversionResult {
  const value = new Decimal(amount.amount).times(new Decimal(rate.rate));
  // `roundArt66` takes the exact Decimal and returns integer bani at a whole leu. It is the same function
  // the calculators use, deliberately: a second rounding function would be a second rule.
  const rounded: Bani = roundArt66(value);
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
