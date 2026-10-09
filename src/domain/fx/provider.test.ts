import { describe, it, expect, vi } from 'vitest';
import {
  ANNUAL_AVERAGE_SOURCE_URL,
  fixtureRateProvider,
  loadDailyRates,
  manualAnnualAverage,
  RateStore,
  readDailyRate,
  type FxRateProvider,
} from './provider';
import { parseBnrXml } from './bnrXml';
import type { FxRateRecord } from './rates';

/**
 * TASK 10a — the fetcher boundary and the cache.
 *
 * The behaviour these tests exist for is the one the brief states as a rule: **„A rate is a fact about the
 * past: cache it, never re-derive on read."** So the central assertion is that a read performs no I/O —
 * checked by injecting a fetch that counts calls, loading once, and then reading many times.
 */

const daily: FxRateRecord = {
  currency: 'EUR',
  rate: '5.3470',
  rateKind: 'daily_reference',
  rateDate: '2026-10-07',
  seriesCode: 'CURSZ_EUR',
  sourceUrl: 'https://curs.bnr.ro/nbrfxrates10days.xml',
  fetchedAt: '2026-10-07T13:05:00Z',
  provisional: false,
  entryMode: 'fetched',
};

const friday: FxRateRecord = { ...daily, rateDate: '2026-10-02', rate: '5.3410' };

const SAMPLE = `<Cursor><Body><Cube date="2026-10-08">
  <Rate currency="EUR">5.3480</Rate><Rate currency="USD">4.5123</Rate>
</Cube></Body></Cursor>`;

describe('RateStore — reads are pure lookups', () => {
  it('answers an exact date from the cache', () => {
    const store = new RateStore();
    store.add(daily);
    expect(store.dailyRate('EUR', '2026-10-07')?.rate).toBe('5.3470');
  });

  it('returns null for a date it has no row for — it does not substitute on a bare lookup', () => {
    const store = new RateStore();
    store.add(daily);
    // Substitution is `readDailyRate`'s decision, made visibly, not a side effect of a lookup.
    expect(store.dailyRate('EUR', '2026-10-08')).toBeNull();
  });

  it('returns null for a currency it holds nothing for', () => {
    const store = new RateStore();
    store.add(daily);
    expect(store.dailyRate('USD', '2026-10-07')).toBeNull();
    expect(store.annualAverage('EUR', 2025)).toBeNull();
  });

  it('never mixes a daily rate into an annual-average lookup, or the reverse', () => {
    const store = new RateStore();
    store.add(daily);
    expect(store.annualAverage('EUR', 2026)).toBeNull();
  });

  it('refuses an unusable record and says why, instead of dropping it silently', () => {
    const store = new RateStore();
    const added = store.add({ ...daily, rateDate: undefined });
    expect(added.ok).toBe(false);
    expect(store.size).toBe(0);
  });

  it('replaces by (currency, kind, date) so a provisional figure can become final', () => {
    const store = new RateStore();
    store.replace({ ...daily, provisional: true });
    expect(store.size).toBe(1);
    store.replace({ ...daily, provisional: false, rate: '5.3500' });
    expect(store.size).toBe(1);
    expect(store.dailyRate('EUR', '2026-10-07')).toMatchObject({ provisional: false, rate: '5.3500' });
  });

  it('lists daily rates oldest first, which is what the carry-forward needs', () => {
    const store = new RateStore();
    store.add(daily);
    store.add(friday);
    expect(store.dailyRates('EUR').map((r) => r.rateDate)).toEqual(['2026-10-02', '2026-10-07']);
  });
});

describe('the cache is a cache: a read never re-fetches', () => {
  it('calls the fetcher exactly once, then answers from memory', async () => {
    const fetchText = vi.fn(async () => SAMPLE);
    const store = new RateStore();
    const loaded = await loadDailyRates(store, { fetchText, year: 2026, today: 2026, fetchedAt: '2026-10-08T13:05:00Z' });
    expect(loaded.loaded).toBe(2);
    expect(fetchText).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 25; i += 1) {
      expect(store.dailyRate('EUR', '2026-10-08')?.rate).toBe('5.3480');
      expect(store.dailyRate('USD', '2026-10-08')?.rate).toBe('4.5123');
    }
    // The assertion that carries the rule: 25 reads, still exactly one fetch.
    expect(fetchText).toHaveBeenCalledTimes(1);
  });

  it('reports a parse failure instead of leaving the caller with an empty store and no explanation', async () => {
    const fetchText = async () => '<html>not found</html>';
    const store = new RateStore();
    const loaded = await loadDailyRates(store, { fetchText, year: 2026, today: 2026, fetchedAt: 'x' });
    expect(loaded.loaded).toBe(0);
    expect(loaded.errors.length).toBeGreaterThan(0);
    expect(loaded.sourceUrl).toContain('curs.bnr.ro');
  });

  it('a malformed XML document is reported through the same path the fetcher uses', async () => {
    // Kept as a separate check because the fetcher and the validator are separate seams: a transport that
    // returns 200 with an HTML error page must fail here, not later at a conversion.
    const parsed = parseBnrXml('<html>not found</html>');
    expect(parsed.ok).toBe(false);
  });
});

describe('manual entry — the normal path for an annual average', () => {
  it('builds a storable record that says it was entered by hand', () => {
    const built = manualAnnualAverage({
      currency: 'EUR',
      rate: '4.9631',
      year: 2025,
      seriesCode: 'CURSA_EURM',
      sourceUrl: ANNUAL_AVERAGE_SOURCE_URL,
      enteredAt: '2026-10-09T09:00:00Z',
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.record.entryMode).toBe('manual');
    expect(built.record.rateKind).toBe('annual_average');
    expect(built.record.rateYear).toBe(2025);
    expect(built.record.provisional).toBe(false);
    expect(built.record.sourceUrl).toContain('bnr.ro');
  });

  it('marks a current-year average provisional without being told to', () => {
    // BNR publishes a year's average only after the year closes, so a 2026 average entered in 2026 cannot
    // be final. Leaving that to the entrant to remember is how an estimate ends up looking like a legal
    // figure — the flag is derived from the year, not from memory.
    const built = manualAnnualAverage({
      currency: 'EUR',
      rate: '5.3000',
      year: 2026,
      seriesCode: 'CURSA_EURM',
      sourceUrl: ANNUAL_AVERAGE_SOURCE_URL,
      enteredAt: '2026-10-09T09:00:00Z',
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.record.provisional).toBe(true);
  });

  it('refuses an annual average with no stated source', () => {
    const built = manualAnnualAverage({
      currency: 'EUR', rate: '4.9631', year: 2025, seriesCode: 'CURSA_EURM', sourceUrl: '',
      enteredAt: '2026-10-09T09:00:00Z',
    });
    expect(built.ok).toBe(false);
  });

  it('refuses a rate that is not a printed decimal', () => {
    const built = manualAnnualAverage({
      currency: 'EUR', rate: '4,9631', year: 2025, seriesCode: 'CURSA_EURM', sourceUrl: 'y',
      enteredAt: '2026-10-09T09:00:00Z',
    });
    expect(built.ok).toBe(false);
  });

  it('refuses a malformed entry timestamp rather than guessing which year is "current"', () => {
    // The provisional flag is derived from the year the entry was made. Guessing that year from a
    // timestamp that does not state one would decide final-vs-provisional by accident.
    expect(() => manualAnnualAverage({
      currency: 'EUR', rate: '4.9631', year: 2025, seriesCode: 'CURSA_EURM', sourceUrl: 'y', enteredAt: 'nu-sigur',
    })).toThrow(RangeError);
  });
});

describe('readDailyRate — the carry-forward is a named decision, not a lookup side effect', () => {
  it('returns the exact row unflagged when one exists', () => {
    const store = new RateStore();
    store.add(daily);
    const found = readDailyRate(store, 'EUR', '2026-10-07');
    expect(found!.substituted).toBe(false);
    expect('carriedFrom' in found!.record).toBe(false);
  });

  it('carries the last published banking day forward and stamps the date used', () => {
    const store = new RateStore();
    store.add(friday);
    // 3–4 October 2026: weekend, no BNR row.
    const found = readDailyRate(store, 'EUR', '2026-10-04');
    expect(found!.substituted).toBe(true);
    expect(found!.record.rateDate).toBe('2026-10-02');
    expect(found!.record.carriedFrom).toBe('2026-10-02');
  });

  it('returns null when nothing earlier is known', () => {
    const store = new RateStore();
    store.add(daily);
    expect(readDailyRate(store, 'EUR', '2026-09-01')).toBeNull();
  });

  it('does not mutate the stored record when it stamps a substitution', () => {
    const store = new RateStore();
    store.add(friday);
    readDailyRate(store, 'EUR', '2026-10-04');
    expect('carriedFrom' in store.dailyRates('EUR')[0]!).toBe(false);
  });
});

describe('fixtureRateProvider — the seam every test uses instead of the network', () => {
  it('is a valid FxRateProvider built from a list', () => {
    const provider: FxRateProvider = fixtureRateProvider([daily, friday]);
    expect(provider.dailyRate('EUR', '2026-10-07')?.rate).toBe('5.3470');
    expect(provider.annualAverage('EUR', 2025)).toBeNull();
  });

  it('refuses a bad fixture loudly, so a broken fixture cannot masquerade as a missing rate', () => {
    expect(() => fixtureRateProvider([{ ...daily, rateDate: undefined } as FxRateRecord])).toThrow(/rejected/);
  });
});
