/**
 * The rate boundary — TASK 10a.
 *
 * ## The one interface
 *
 * Everything that needs a rate asks an `FxRateProvider`. Nothing else in the app knows that BNR exists,
 * that XML is the format, or that a fetch is involved. That is the boundary the brief asks for, and it is
 * what makes the no-network rule testable rather than aspirational: a test constructs a provider from a
 * fixture and the network code is simply never reached.
 *
 * ## Why the interface is synchronous
 *
 * `dailyRate` and `annualAverage` are **reads of a recorded fact**. A rate is a statement about a day that
 * has already happened, so once it is in the store it never needs re-deriving — BNR does not revise a
 * published daily rate, and an annual average appears once and then stands. Making the read synchronous
 * removes, by type, the temptation to "just fetch it again" on every call, which is the behaviour the brief
 * rules out („cache it, never re-derive on read").
 *
 * Getting rates *into* the store is a separate, explicit, asynchronous act — `loadDailyRates` below, or a
 * human typing one. The split is the design: **fetch is a deliberate write, read is a pure lookup.**
 *
 * ## Manual entry is a first-class path, not a consolation prize
 *
 * The annual average has no working machine-readable export (research 23, gap 4: the BNRStat export was
 * never captured, and the „Serii anuale – valori medii –" table at bnr.ro/1975-… is JS-rendered, so a plain
 * fetch cannot read it). So for `annual_average` a human copying the printed figure is the normal route,
 * and `manualAnnualAverage` builds a record that says so — `entryMode: 'manual'`, `sourceUrl` pointing at
 * the table it was read from.
 */

import { BNR_ENDPOINTS, type FxRateRecord, type RateRecordRejection, validateRateRecord } from './rates';
import type { CurrencyCode } from '../money';
import { cubeRecords, fetchBnrXml, parseBnrXml, type FetchText } from './bnrXml';
import { selectCarriedRate, stampCarriedFrom } from './carryForward';

/** A currency a rate can be quoted in. `RON` is the target of a conversion, never its source. */
export type RateCurrency = Exclude<CurrencyCode, 'RON'>;

/**
 * The boundary. Two reads, no side effects, no promises.
 *
 * Returning `null` — rather than throwing, rather than returning a nearby rate — is deliberate: a missing
 * rate is a normal state of the world (a weekend, a year not yet published, a currency BNR does not list),
 * and the caller must decide what to do about it. `convert.ts` refuses the conversion; it does not invent a
 * number.
 */
export interface FxRateProvider {
  /** The rate BNR published for `currency` on exactly `date`, or `null` if none is recorded. */
  dailyRate(currency: RateCurrency, date: string): FxRateRecord | null;
  /** The published annual average for `currency` and `year`, or `null` if none is recorded. */
  annualAverage(currency: RateCurrency, year: number): FxRateRecord | null;
}

/**
 * An in-memory store of rate records, and the default `FxRateProvider`.
 *
 * Reads never fetch and never compute. A record is either in the store or the answer is `null`.
 */
export class RateStore implements FxRateProvider {
  private readonly records: FxRateRecord[] = [];

  /** Number of records held — exposed so a caller can tell „loaded" from „loaded but empty". */
  get size(): number {
    return this.records.length;
  }

  /**
   * Add a record, refusing one that would not be usable.
   *
   * The refusal is not swallowed: a store that quietly drops a malformed rate ends up reporting „no rate
   * available", which reads like a gap in coverage and is actually a bug. The caller gets the reasons.
   */
  add(candidate: unknown): { ok: true; record: FxRateRecord } | { ok: false; problems: RateRecordRejection[] } {
    const checked = validateRateRecord(candidate);
    if (!checked.ok) return { ok: false, problems: checked.problems };
    this.records.push(checked.record);
    return { ok: true, record: checked.record };
  }

  /** Replace a record for the same (currency, kind, date|year) — the provisional → final path TASK 10b uses. */
  replace(record: FxRateRecord): void {
    const key = rateKey(record);
    const existing = this.records.findIndex((r) => rateKey(r) === key);
    if (existing >= 0) this.records[existing] = record;
    else this.records.push(record);
  }

  all(): readonly FxRateRecord[] {
    return this.records;
  }

  dailyRate(currency: RateCurrency, date: string): FxRateRecord | null {
    let best: FxRateRecord | null = null;
    for (const r of this.records) {
      if (r.currency !== currency || r.rateKind !== 'daily_reference') continue;
      if (r.rateDate === date) return r;
      if (r.rateDate !== undefined && r.rateDate < date && (best === null || (best.rateDate ?? '') < r.rateDate)) best = r;
    }
    return null;
  }

  /**
   * Every daily rate recorded for a currency, oldest first — what `carryForward` needs in order to find
   * the last published banking day before a date that has no row of its own.
   */
  dailyRates(currency: RateCurrency): FxRateRecord[] {
    return this.records
      .filter((r) => r.currency === currency && r.rateKind === 'daily_reference' && r.rateDate !== undefined)
      .sort((a, b) => (a.rateDate ?? '').localeCompare(b.rateDate ?? ''));
  }

  annualAverage(currency: RateCurrency, year: number): FxRateRecord | null {
    for (const r of this.records) {
      if (r.currency === currency && r.rateKind === 'annual_average' && r.rateYear === year) return r;
    }
    return null;
  }
}

/** Identity of a rate: one record per (currency, kind, date-or-year). */
export function rateKey(record: FxRateRecord): string {
  const when = record.rateKind === 'daily_reference' ? record.rateDate ?? '?' : String(record.rateYear ?? '?');
  return `${record.currency}|${record.rateKind}|${when}`;
}

/**
 * Build a manually-entered annual average.
 *
 * `sourceUrl` is required rather than defaulted, because the licence term is *indicarea sursei* and a
 * manual figure with no stated source is unauditable. The natural value is
 * `https://www.bnr.ro/1975-cursul-de-schimb-serii-statistice`, the page that prints the „Serii anuale –
 * valori medii –" table.
 */
export function manualAnnualAverage(input: {
  currency: RateCurrency;
  rate: string;
  year: number;
  seriesCode: string;
  sourceUrl: string;
  enteredAt: string;
  provisional?: boolean;
}): { ok: true; record: FxRateRecord } | { ok: false; problems: string[] } {
  const checked = validateRateRecord({
    currency: input.currency,
    rate: input.rate,
    rateKind: 'annual_average',
    rateYear: input.year,
    seriesCode: input.seriesCode,
    sourceUrl: input.sourceUrl,
    fetchedAt: input.enteredAt,
    // A 2026 annual average cannot be final: BNR publishes a year's average after the year closes. The
    // flag is not left to the entrant to remember — the year decides it.
    provisional: input.provisional ?? input.year >= currentYearOf(input.enteredAt),
    entryMode: 'manual',
  });
  if (!checked.ok) return { ok: false, problems: checked.problems.map((p) => `${p.field}: ${p.message}`) };
  return { ok: true, record: checked.record };
}

function currentYearOf(isoTimestamp: string): number {
  const match = /^(\d{4})/.exec(isoTimestamp);
  if (!match) throw new RangeError(`expected an ISO timestamp, got ${JSON.stringify(isoTimestamp)}`);
  return Number(match[1]);
}

/**
 * A provider backed by a fixed list — the fixture every test uses.
 *
 * It is exported from production code rather than written per-test because the point is that production
 * code never knows the difference: the same `FxRateProvider` interface is what the converter sees.
 */
export function fixtureRateProvider(records: readonly FxRateRecord[]): FxRateProvider {
  const store = new RateStore();
  for (const r of records) {
    const added = store.add(r);
    if (!added.ok) {
      throw new Error(`fixture rate record rejected: ${added.problems.map((p) => `${p.field}: ${p.message}`).join('; ')}`);
    }
  }
  return store;
}

/**
 * Fetch BNR's daily XML and load it into a store. **The only network path in the FX layer, and no test
 * calls it** — tests hand `fixtureRateProvider` a list instead.
 *
 * BNR recommends local caching; `RateStore` is that cache. Once a day's rate is in the store, reading it
 * again performs no I/O.
 */
export async function loadDailyRates(
  store: RateStore,
  options: { fetchText: FetchText; year: number; today: number; fetchedAt: string; currencies?: readonly string[] },
): Promise<{ loaded: number; sourceUrl: string; errors: string[] }> {
  const { xml, sourceUrl } = await fetchBnrXml(options.fetchText, options.year, options.today);
  const parsed = parseBnrXml(xml);
  if (!parsed.ok) return { loaded: 0, sourceUrl, errors: parsed.errors };
  let loaded = 0;
  for (const cube of parsed.cubes) {
    for (const record of cubeRecords(cube, { sourceUrl, fetchedAt: options.fetchedAt, currencies: options.currencies })) {
      store.replace(record);
      loaded += 1;
    }
  }
  return { loaded, sourceUrl, errors: [] };
}

/**
 * The read path the converter uses: an exact date first, then the app's carry-forward policy, then nothing.
 *
 * Kept here rather than inside `RateStore` so the carry-forward stays a named, visible decision instead of
 * an implicit behaviour of a lookup.
 */
export function readDailyRate(
  store: RateStore,
  currency: RateCurrency,
  date: string,
): { record: FxRateRecord; substituted: boolean } | null {
  const exact = store.dailyRate(currency, date);
  if (exact) return { record: exact, substituted: false };
  const carried = selectCarriedRate(store.dailyRates(currency), date);
  if (carried === null) return null;
  // `carriedFrom` is stamped on the way out, not stored: the same underlying record may answer a Tuesday
  // exactly and a Saturday by substitution, and only the second one deserves the flag.
  return { record: stampCarriedFrom(carried.rate, date, true), substituted: true };
}

/** Where a human should look for the annual average table. Surfaced in copy, not invented at a call site. */
export const ANNUAL_AVERAGE_SOURCE_URL = 'https://www.bnr.ro/1975-cursul-de-schimb-serii-statistice';
export const DAILY_SOURCE_URL = BNR_ENDPOINTS.latest;
