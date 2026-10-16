/**
 * The FX rate record — TASK 10a.
 *
 * ## What this type is for
 *
 * A rate in this app is **a recorded fact about a published number**, not a computed one. Every field on
 * `FxRateRecord` either names the number, names which published series it came from, or says how current
 * it is. There is no field a caller can fill in by arithmetic, and that is deliberate: the one figure this
 * domain must never produce is an annual average.
 *
 * `docs/ai/research/23_fx_conversion_and_bnr_rates_2026.md` §„Annual average" records why. BNR publishes
 * the annual EUR/RON average as its own series (`CURSA_EURM`, table „Serii anuale – valori medii –"), and
 * its printed methodology is the **average of the 12 monthly averages**, each monthly average itself an
 * average of daily rates. A mean of the daily rates is a *different number*. So the annual average is
 * **obtainable, not computable**, and this module has no way to compute one — only a way to store one that
 * was fetched or typed in.
 *
 * ## Why `rate` is a string
 *
 * BNR prints four decimals (`5.3470`). A `number` cannot hold that as an exact value and would let a
 * rounding policy sneak into a rate the way it snuck into stored money in Phase 10 (defect B-17). The
 * string is the printed datum; arithmetic goes through `decimal.js-light` via `rateDecimal()`.
 *
 * ## Provenance is not decoration
 *
 * BNR's terms require **indicarea sursei** on redistribution, and BNR states that its list „nu implică
 * obligativitatea utilizării … în înregistrări contabile". A conversion the app cannot trace to a dated,
 * sourced rate is a conversion the user cannot defend, so `sourceUrl`, `seriesCode` and `fetchedAt` are
 * required fields, not optional extras.
 */

import { z } from 'zod';
import { CURRENCY_CODES, type CurrencyCode } from '../money';

/**
 * Which published figure the record holds.
 *
 * - `daily_reference` — the reference rate BNR publishes for one banking day. This is what art. 9 alin.
 *   (3) lit. b) + alin. (4) of the Codul fiscal points at for a sum received in a foreign currency.
 * - `annual_average` — the published annual average. This is the HG 1/2016 Titlul IV, Cap. II, pct. 7
 *   alin. (6) figure: „cursul mediu comunicat de Banca Națională a României pentru anul în care s-a
 *   efectuat plata". It is fetched or entered; it is never derived here.
 */
export const RATE_KINDS = ['daily_reference', 'annual_average'] as const;
export type RateKind = (typeof RATE_KINDS)[number];

/**
 * How the record got here. `manual` is not a degraded mode to hide: the annual average has no working
 * machine-readable export (research 23, gap 4 — the BNRStat export was never captured and the „Serii
 * anuale" table at bnr.ro/1975-… is JS-rendered), so for that series manual entry is the normal path and
 * the record says so.
 */
export const RATE_ENTRY_MODES = ['fetched', 'manual'] as const;
export type RateEntryMode = (typeof RATE_ENTRY_MODES)[number];

/**
 * A published exchange rate, with the evidence for it.
 *
 * Exactly one of `rateDate` / `rateYear` applies, and `validateRateRecord` enforces it: a daily rate
 * without a date is unusable (the whole rule is „on the date the sum is received"), and an annual average
 * without a year names nothing (pct. 7 alin. (6) is keyed to *the year the payment was made*).
 */
export interface FxRateRecord {
  /** The currency the rate is quoted against — never `RON`; RON is the target. */
  currency: Exclude<CurrencyCode, 'RON'>;
  /**
   * **RON per 1 unit of `currency`**, exactly as BNR prints it — BNR quotes „1 EUR = 5.3470 RON”.
   * A decimal string, four decimals as published.
   */
  rate: string;
  rateKind: RateKind;
  /** `YYYY-MM-DD`. Present iff `rateKind === 'daily_reference'`. */
  rateDate?: string;
  /** Calendar year. Present iff `rateKind === 'annual_average'`. */
  rateYear?: number;
  /**
   * The BNR series this number came from — `CURSZ_EUR` for a daily reference rate, `CURSA_EURM` for the
   * annual average. Verified for EUR only; a code for another currency is recorded as entered and is not
   * asserted to exist (see `SERIES_CODE_STATUS`).
   */
  seriesCode: string;
  /** Where it was read from. BNR's licence requires the source to be indicated. */
  sourceUrl: string;
  /** When this record was read or entered — ISO timestamp. Not the rate's own date. */
  fetchedAt: string;
  /**
   * `true` when the record is not yet the final published figure. The case that exists today: **no FY2026
   * annual average has been published** (`CURSA_EURM` for a year appears only after the year closes), so a
   * 2026 annual average is either absent or provisional. TASK 10b drives the provisional → final
   * lifecycle from this flag; 10a only makes it expressible.
   */
  provisional: boolean;
  /**
   * Set when the requested calendar date has no BNR row of its own and the app used the last published
   * banking day instead. Holds the date actually used.
   *
   * This is **app policy, not a statutory rule** — see `carryForward.ts`. The flag keeps the substitution
   * visible on the record rather than buried in a fetcher.
   */
  carriedFrom?: string;
  entryMode: RateEntryMode;
}

/** A rate record that has been checked, not merely shaped. */
export type ValidRateRecord = FxRateRecord;

/**
 * Structural schema. Mirrors the shape; `validateRateRecord` adds the rules a schema cannot state cleanly
 * (exactly one of date/year, and which one depends on the kind).
 */
export const fxRateRecordSchema = z.object({
  currency: z.enum(['EUR', 'USD', 'GBP', 'HUF']),
  // A decimal string as published. The pattern rejects `5,3470` (BNR's XML uses `.`), a bare integer
  // written without decimals is still accepted because that is what a manual entry may legitimately be.
  rate: z
    .string()
    .min(1)
    .regex(/^\d+(?:\.\d+)?$/, 'rate must be a decimal string, e.g. "5.3470"'),
  rateKind: z.enum(RATE_KINDS),
  rateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rateYear: z.number().int().min(1990).max(2999).optional(),
  seriesCode: z.string().min(1),
  sourceUrl: z.string().min(1),
  fetchedAt: z.string().min(1),
  provisional: z.boolean(),
  carriedFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  entryMode: z.enum(RATE_ENTRY_MODES),
});

/** Why a candidate rate record was refused. */
export type RateRecordRejection = { field: string; message: string };

/**
 * Check a candidate record and say what is wrong with it if it is not usable.
 *
 * The refusals are the ones that matter for a tax figure: a daily rate with no date cannot answer „which
 * day?", an annual average with no year cannot answer „which year?", and a rate that is not a positive
 * number cannot be multiplied by anything safely.
 */
export function checkRateRecord(candidate: unknown): RateRecordRejection[] {
  const parsed = fxRateRecordSchema.safeParse(candidate);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => ({
      field: i.path.join('.') || '(root)',
      message: i.message,
    }));
  }
  const record = parsed.data as FxRateRecord;
  const problems: RateRecordRejection[] = [];

  if (record.rateKind === 'daily_reference') {
    if (!record.rateDate) problems.push({ field: 'rateDate', message: 'a daily reference rate needs the date it was published for' });
    if (record.rateYear !== undefined) problems.push({ field: 'rateYear', message: 'a daily reference rate must not carry a rateYear' });
  } else {
    if (record.rateYear === undefined) problems.push({ field: 'rateYear', message: 'an annual average needs the year it averages' });
    if (record.rateDate !== undefined) problems.push({ field: 'rateDate', message: 'an annual average must not carry a single rateDate' });
  }

  if (!(Number.parseFloat(record.rate) > 0)) {
    problems.push({ field: 'rate', message: 'a rate must be a positive decimal' });
  }

  // A carried-forward substitution only makes sense for a dated rate. An annual average is already the
  // whole year; there is no earlier year to fall back to without changing which rule is being applied.
  if (record.carriedFrom !== undefined && record.rateKind !== 'daily_reference') {
    problems.push({ field: 'carriedFrom', message: 'only a daily reference rate can be carried forward from another date' });
  }

  return problems;
}

/** Parse-and-check. Returns the record, or the reasons it was refused. */
export function validateRateRecord(candidate: unknown): { ok: true; record: ValidRateRecord } | { ok: false; problems: RateRecordRejection[] } {
  const problems = checkRateRecord(candidate);
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, record: candidate as ValidRateRecord };
}

/**
 * Series codes, and how much is actually known about each.
 *
 * `CURSZ_EUR` (daily) and `CURSA_EURM` (annual average) are **verified** — read off the BNR series page in
 * research 23, which enumerates 280 codes and prints the EUR set. A code for another currency follows the
 * same visible pattern but was **not** read from that page, so it is recorded as `unverified` and the app
 * must not claim it exists. This map exists so nothing downstream can present a pattern as a fact.
 */
export const SERIES_CODE_STATUS: Record<string, 'verified' | 'unverified'> = {
  CURSZ_EUR: 'verified',
  CURSA_EURM: 'verified',
};

export function seriesCodeStatus(seriesCode: string): 'verified' | 'unverified' {
  return SERIES_CODE_STATUS[seriesCode] ?? 'unverified';
}

/**
 * The endpoints BNR publishes. `curs.bnr.ro` is authoritative **from 6 August 2026**; the old
 * `www.bnr.ro/nbrfxrates.xml` is dead (BNR notice of 04.08.2026: „nu vor mai fi disponibile direct …
 * ci vor putea fi accesate exclusiv prin subdomeniul curs.bnr.ro"). The file names did not change, only
 * the domain — so a fetcher that still points at `www.bnr.ro` is not merely stale, it is broken.
 */
export const BNR_ENDPOINTS = {
  latest: 'https://curs.bnr.ro/nbrfxrates.xml',
  lastTenDays: 'https://curs.bnr.ro/nbrfxrates10days.xml',
  yearArchive: (year: number) => `https://curs.bnr.ro/files/xml/years/nbrfxrates${year}.xml`,
  xsd: 'https://curs.bnr.ro/xsd/nbrfxrates.xsd',
} as const;
