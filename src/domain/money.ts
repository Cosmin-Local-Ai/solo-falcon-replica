/**
 * Money representation and rounding policy — Phase 10.
 *
 * ## The two decisions this file encodes
 *
 * **Representation — HYBRID.** Money that is persisted, aggregated or displayed is an **integer number of
 * bani** (`Bani`). Money that is mid-calculation (a rate applied to a base) is a `decimal.js-light` value
 * that is converted back to `Bani` at exactly one place. A raw `67450` must never reach a screen: the
 * bani→lei boundary is `formatBani`, a single named conversion that performs **no rounding**.
 *
 * **Rounding — CF art. 66 alin. (1).** `roundLeiArt66` is the only place money rounds.
 *
 * > „Sumele sunt calculate prin rotunjire la un leu, prin neglijarea fracțiunilor de până la 50 de bani
 * > inclusiv și majorarea la leu a fracțiunilor ce depășesc 50 de bani."
 * > — Codul fiscal (Legea nr. 227/2015), Titlul IV, Capitolul I, consolidated text, Portal Legislativ
 * > doc 312601. **CONFIRMED** — verbatim from primary consolidated text.
 * > Amendment note as printed in that consolidation: art. 66 din Capitolul I, Titlul IV was modified by
 * > Punctul 29, Articolul I din LEGEA nr. 296 din 18 decembrie 2020, MO nr. 1269 din 21 decembrie 2020.
 *
 * Three consequences, all load-bearing:
 *
 * 1. **It rounds to a LEU, not to a ban.** The legal unit is the whole leu, so this function maps bani to a
 *    multiple of 100 bani. `Intl.NumberFormat` and `toFixed(2)` are both wrong here — both round to bani.
 * 2. **The tie is half-DOWN.** „până la 50 de bani **inclusiv**" — a fraction of exactly 50 bani is
 *    neglected. `Math.round` is wrong at that boundary (`Math.round(0.5)` goes up).
 * 3. **It is per-sum.** Art. 66 sits in Titlul IV Capitolul I and governs the *stabilirea* of the sums.
 *
 * ## EXTENSION — explicitly marked, not settled law
 *
 * Art. 66 is a **Titlul IV** (income tax) rule. **No rounding provision was found for CAS/CASS** — a
 * case-insensitive search of the consolidated Codul fiscal returned 0 hits for `rotunj` in Titlul V, and
 * 0 hits for `zecimale` / `sute de bani` / `prin lipsire`. Applying art. 66 to the CAS and CASS lines as
 * well is therefore **an extension we chose**, not a rule the text states. Its extension to the amount
 * *entered on DU 212* is likewise an inference: the ANAF instructions for the 2026 model contain no
 * rounding sentence at all (`rotunj` → 0 hits, `zecimale` → 0 hits); the only format language is
 * „se înscrie suma (**în lei**)". See `docs/ai/research/20_cf_art66_rounding_and_art154_cass_exemption_2026.md`.
 *
 * ## Where rounding does NOT apply
 *
 * Bases, thresholds, rule parameters, transaction amounts, ratios and projections are **never** rounded by
 * this function. Rounding a *base* would change the base and therefore the tax; art. 66 rounds calculated
 * sums. A projection is not a sum due.
 */

import Decimal from 'decimal.js-light';

/** An integer number of bani. Branded so a plain `number` cannot be passed off as money. */
export type Bani = number & { readonly __brand: 'bani' };

export const BANIS_PER_LEI = 100 as const;

/** True only for a safe integer — the representation invariant for `Bani`. */
export function isBani(value: number): value is Bani {
  return Number.isSafeInteger(value);
}

/** Shared guard: money that has already been represented must be an integer number of bani. */
function assertIntegralBani(value: number, fn: string): Bani {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(
      `${fn} requires an integer number of bani, got ${value}. A computed sum must arrive as a Decimal — ` +
        `rounding a float is the bug this module exists to prevent.`,
    );
  }
  return value as Bani;
}

/**
 * Exact lei → bani, for literals in source, seed data and tests: `lei(2430)` is 2 430 lei,
 * `lei(25.2)` is 2 520 bani. Throws rather than silently accepting a fractional-bani literal
 * (`lei(0.005)`) — use `baniFromLei` for a value that genuinely has sub-ban precision.
 *
 * The scaling goes through `Decimal`, **not** `amount * 100`. This is not a micro-optimisation: `71.4 * 100`
 * is `7140.000000000001` in IEEE-754, so a float multiply would make `lei(71.4)` — a real seeded value, the
 * TVA on expense `e3` — throw for no reason, while `lei(17.96)` happened to pass. Whether a literal works
 * must not depend on which side the noise falls.
 */
export function lei(amount: number): Bani {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new RangeError(`lei(${amount}) requires a finite number of lei`);
  }
  const scaled = new Decimal(amount).times(BANIS_PER_LEI);
  if (!scaled.isInteger() || !Number.isSafeInteger(scaled.toNumber())) {
    throw new RangeError(`lei(${amount}) is not a whole number of bani; use baniFromLei()`);
  }
  return scaled.toNumber() as Bani;
}

/** Result of converting a legacy float-lei value to bani. */
export interface BaniConversion {
  /** `null` when the value cannot be represented at all (non-finite). It is never replaced by 0. */
  bani: Bani | null;
  /**
   * `false` means the stored value had **sub-ban precision** (e.g. a snapshot line of `674.505` lei), so a
   * decision was taken to make it an integer number of bani. Callers must surface this, not swallow it.
   */
  exact: boolean;
}

/**
 * The **unit conversion** used by the v4→v5 migration. This is *not* the art. 66 rounding: art. 66 rounds
 * to a whole leu, and applying it to a stored value would turn a stored revenue of `85.5` lei into `86`
 * lei — a silent change to the user's money, which the migration must never do.
 *
 * `Decimal` is constructed from the number's shortest decimal representation, so `674.505 × 100` is exactly
 * `67450.5` with no IEEE-754 noise. A value with at most two decimals therefore converts **exactly**.
 * Anything finer is taken to the nearest ban with **half-DOWN** ties, matching art. 66's „inclusiv"
 * direction, and reported as `exact: false`.
 */
export function baniFromLei(value: number): BaniConversion {
  if (typeof value !== 'number' || !Number.isFinite(value)) return { bani: null, exact: false };
  const scaled = new Decimal(value).times(BANIS_PER_LEI);
  if (scaled.isInteger()) return { bani: scaled.toNumber() as Bani, exact: true };
  // decimal.js-light's ROUND_HALF_DOWN rounds a tie toward zero, i.e. down for the positive sums we store.
  const rounded = scaled.toDecimalPlaces(0, Decimal.ROUND_HALF_DOWN);
  if (!Number.isSafeInteger(rounded.toNumber())) return { bani: null, exact: false };
  return { bani: rounded.toNumber() as Bani, exact: false };
}

/**
 * **The only place money rounds.** CF art. 66 alin. (1): rotunjire **la un leu** — fracțiuni de până la
 * 50 de bani **inclusiv** sunt neglijate, fracțiuni peste 50 de bani sunt majorate la leu.
 *
 * It takes the **unrounded** sum, as a `Decimal` of bani, and returns whole lei. Order matters and is the
 * whole point: rounding a computed sum to integer bani *first* and then applying art. 66 gives the wrong
 * answer. The seeded income tax is `674.505` lei = `67450.5` bani, a fraction of **50,5 bani**, which
 * exceeds 50 → **675 lei**. Truncate that to `67450` bani first and you get `674` lei — a different tax.
 *
 * A true tie, `67450` bani (a fraction of exactly 50 bani), is neglected → **674 lei**. `Math.round` gets
 * that case wrong, which is why it is banned here.
 *
 * A plain `number` is accepted only when it is already a safe integer number of bani; a float is rejected
 * outright, because rounding a float is the defect this function exists to prevent.
 *
 * Negative sums are handled on magnitude and the sign is restored. Art. 66 speaks of sums *due*; no
 * negative sum arises in this domain (`tax.ts` clamps to `Math.max(0, …)`), and the law does not say how a
 * negative would round — so that part is a convention, not a legal claim.
 */
export function roundArt66(amount: Decimal | number): Bani {
  const value = amount instanceof Decimal ? amount : new Decimal(assertIntegralBani(amount, 'roundArt66'));
  const sign = value.isNegative() ? -1 : 1;
  const magnitude = value.abs();
  const wholeLei = magnitude.div(BANIS_PER_LEI).toDecimalPlaces(0, Decimal.ROUND_FLOOR);
  const fraction = magnitude.minus(wholeLei.times(BANIS_PER_LEI));
  const roundedLei = fraction.lte(50) ? wholeLei : wholeLei.plus(1);
  const result = roundedLei.times(BANIS_PER_LEI).times(sign);
  if (!result.isInteger() || !Number.isSafeInteger(result.toNumber())) {
    throw new RangeError(`roundArt66 produced an unrepresentable amount: ${result.toString()}`);
  }
  return result.toNumber() as Bani;
}

/** Legacy alias kept so the policy has one obvious name at every call site. */
export const roundLeiArt66 = roundArt66;

/** Sum bani without ever letting a `+=` on a float reappear. Throws on a non-integer addend. */
export function sumBani(values: readonly Bani[]): Bani {
  let total = 0;
  for (const value of values) {
    total += assertIntegralBani(value, 'sumBani');
  }
  if (!Number.isSafeInteger(total)) throw new RangeError(`sumBani overflowed: ${total}`);
  return total as Bani;
}

/** Rate arithmetic in decimal, returned as unrounded bani (the caller rounds once, at the line boundary). */
export function applyRateDecimal(baseBani: Bani, ratePercent: number): Decimal {
  assertIntegralBani(baseBani, 'applyRateDecimal');
  return new Decimal(baseBani).times(new Decimal(ratePercent)).div(BANIS_PER_LEI);
}

/**
 * The **single** bani → displayed-lei conversion. It performs **no rounding**: an integer number of bani
 * maps to an exact two-decimal string by construction. This is the structural fix for the B-17 defect, in
 * which `Intl.NumberFormat` (round-half-even on the raw double) and `toFixed(2)` (round-half-up on the
 * shortest repr) disagreed by a half-cent on the same stored money.
 *
 * Built from integer arithmetic rather than `Intl`, so no formatter rounding policy can ever reappear.
 * Output matches `ro-RO`: `.` thousands, `,` decimal.
 */
export function formatBani(amount: Bani): string {
  assertIntegralBani(amount, 'formatBani');
  const sign = amount < 0 ? '-' : '';
  const magnitude = Math.abs(amount);
  const whole = Math.floor(magnitude / BANIS_PER_LEI);
  const fraction = magnitude % BANIS_PER_LEI;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${grouped},${String(fraction).padStart(2, '0')}`;
}

/** Bani as `1.234,56 RON`. */
export function formatBaniRON(amount: Bani): string {
  return `${formatBani(amount)} RON`;
}

/** Bani as `1.234,56 lei`. */
export function formatBaniLei(amount: Bani): string {
  return `${formatBani(amount)} lei`;
}

/** Non-finite guard for the display boundary: an unknown amount renders as an em dash, never as `0`. */
export function formatBaniOrDash(amount: Bani | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isSafeInteger(amount)) return '—';
  return formatBani(amount);
}

/**
 * Bani as a plain machine-readable lei string for an `<input value>`: `2430000` → `'24300'`,
 * `8550` → `'85.50'`. Exact — no rounding, no locale grouping, `.` as the decimal separator.
 *
 * This exists because a form field is a screen. Pre-filling one with the stored integer would show the
 * user `2430000` for 24 300 lei, which is the "a raw `67450` must never reach a screen" rule.
 */
export function leiInputValue(amount: Bani): string {
  const bani = assertIntegralBani(amount, 'leiInputValue');
  const whole = Math.trunc(bani / BANIS_PER_LEI);
  const fraction = Math.abs(bani - whole * BANIS_PER_LEI);
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0')}`;
}

/**
 * Parse a lei amount typed by a user into integer bani. Accepts `,` or `.` as the decimal separator.
 *
 * Returns `null` when the input is not a finite number **or** carries sub-ban precision (`85.555`).
 * The second case is a refusal, not a silent round: a fraction of a ban cannot be stored, and rounding a
 * number on the way INTO someone's ledger is exactly the silent money change this phase forbids. The
 * caller shows its existing invalid-value message rather than inventing new copy.
 */
export function parseLeiInput(text: string): Bani | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  const { bani, exact } = baniFromLei(value);
  return exact ? bani : null;
}

/**
 * Bani as the shortest exact lei string, for **prose** — calculator breakdown notes, review reasons,
 * migration reports. Not for a screen: a screen amount goes through `formatBani*`, which groups.
 *
 * Why this exists: the breakdown notes in `fiscal/calculators.ts` interpolate amounts into sentences
 * („CASS la plafon = 29160 lei, derivata din 291600 x 0.1”), and one of those sentences is pinned by a
 * test (`fiscal/fiscal.test.ts:259`). Once the stored number is bani, interpolating it directly would
 * print `29160000` inside a Romanian sentence about leu — the "raw bani must never reach a human" rule,
 * applied to prose. `Decimal.div(100)` is exact, so `29160000` renders back as `29160` and `749450` as
 * `7494.5`: the sentences keep the wording they have always had.
 */
export function leiText(amount: Bani): string {
  assertIntegralBani(amount, 'leiText');
  return new Decimal(amount).div(BANIS_PER_LEI).toString();
}

/** Exact integer subtraction of two bani amounts. No rounding: a difference of integers is an integer. */
export function subBani(a: Bani, b: Bani): Bani {
  assertIntegralBani(a, 'subBani');
  assertIntegralBani(b, 'subBani');
  return (a - b) as Bani;
}

/**
 * Exact pairwise addition of two bani amounts — the accumulator form of `sumBani`.
 *
 * `+=` cannot be used on a `Bani`: `Bani + Bani` widens to plain `number` and silently drops the brand,
 * which is precisely the leak this type exists to catch. Integers plus integers is exact, so this adds no
 * rounding and no error budget.
 */
export function addBani(a: Bani, b: Bani): Bani {
  assertIntegralBani(a, 'addBani');
  assertIntegralBani(b, 'addBani');
  return (a + b) as Bani;
}

/**
 * The larger of two bani amounts, keeping the brand.
 *
 * `Math.max(a, b)` returns a plain `number` and silently drops `Bani`, which is how a money value ends up
 * unbranded inside a view. Use this wherever a comparison picks an amount.
 */
export function maxBani(a: Bani, b: Bani): Bani {
  assertIntegralBani(a, 'maxBani');
  assertIntegralBani(b, 'maxBani');
  return a >= b ? a : b;
}

/**
 * Split a bani amount into `parts` equal shares — for a **cash-planning suggestion only**.
 *
 * This is deliberately NOT `roundArt66`. Art. 66 rounds the sums a taxpayer owes; a recommended monthly
 * reserve is a planning figure and the code has no legal basis to round it to a whole leu. The share is
 * therefore rounded to the nearest **ban** (half-DOWN, the same tie direction `baniFromLei` uses), which is
 * the smallest unit the representation can hold at all.
 *
 * Consequence, stated rather than hidden: `divBani(total, n) * n` can differ from `total` by up to `n/2`
 * bani. The authoritative figure stays the total; a share is an estimate.
 */
export function divBani(total: Bani, parts: number): Bani {
  assertIntegralBani(total, 'divBani');
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new RangeError(`divBani needs a positive whole number of parts, got ${parts}`);
  }
  if (parts === 1) return total;
  return new Decimal(total).div(parts).toDecimalPlaces(0, Decimal.ROUND_HALF_DOWN).toNumber() as Bani;
}

/**
 * Turn a **fractional bani intermediate** into integer bani — half-DOWN on an exact .5 tie.
 *
 * This is the only sanctioned way a value that is not already whole bani becomes money. It is a
 * representation necessity (the storage unit is one ban), not a legal rule, and it is deliberately NOT
 * `roundArt66`: art. 66 rounds sums a taxpayer owes to a whole leu, and applying it to an intermediate
 * would change the input of the next calculation.
 */
export function toBaniNearest(value: Decimal | number): Bani {
  const d = value instanceof Decimal ? value : new Decimal(value);
  // decimal.js-light exposes no `isFinite` (instance or static) in its typings; `toNumber()` is the exact
  // conversion this function is about to perform, so it is the honest place to catch NaN/Infinity.
  const asNumber = d.toNumber();
  if (!Number.isFinite(asNumber)) {
    throw new RangeError(`toBaniNearest needs a finite value, got ${d.toString()}`);
  }
  return d.toDecimalPlaces(0, Decimal.ROUND_HALF_DOWN).toNumber() as Bani;
}

/**
 * Split an exact integer bani total into `parts` shares that **sum back to the total**.
 *
 * `floor(total/parts)` for every share, then the first `total % parts` shares take one extra ban. No share
 * is rounded independently, so the parts cannot drift away from the whole — which is the failure mode when a
 * per-month figure is produced by dividing and rounding each month on its own.
 */
export function allocateBani(total: Bani, parts: number): Bani[] {
  assertIntegralBani(total, 'allocateBani');
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new RangeError(`allocateBani needs a positive whole number of parts, got ${parts}`);
  }
  if (parts === 1) return [total];
  const negative = total < 0;
  const magnitude = Math.abs(total);
  const base = Math.floor(magnitude / parts);
  const remainder = magnitude % parts;
  return Array.from({ length: parts }, (_, i) => {
    const share = base + (i < remainder ? 1 : 0);
    return (negative ? -share : share) as Bani;
  });
}

/**
 * A chart **axis tick** in lei. Not an amount: it labels a position on a scale.
 *
 * Recharts chooses tick values itself, so they are not necessarily values the app produced, and they are
 * not necessarily whole lei. This divides by 100 through `Decimal` (no float noise) and prints decimals
 * only when the tick actually has them, so an axis stays readable without inventing a rounded amount.
 * Every figure the user reads as *money* — tooltip, legend, table, summary — goes through `formatBani*`
 * instead and is exact.
 */
export function formatBaniAxis(value: number): string {
  if (!Number.isFinite(value)) return '';
  const d = new Decimal(value);
  const magnitude = d.abs();
  const wholeLei = magnitude.div(BANIS_PER_LEI).toDecimalPlaces(0, Decimal.ROUND_FLOOR);
  const fractionBani = magnitude.minus(wholeLei.times(BANIS_PER_LEI));
  const grouped = wholeLei.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const fraction = fractionBani.isZero() ? '' : `,${fractionBani.toString()}`;
  return `${d.isNegative() ? '-' : ''}${grouped}${fraction}`;
}
