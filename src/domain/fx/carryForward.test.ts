import { describe, it, expect } from 'vitest';
import { isIsoDate, selectCarriedRate, stampCarriedFrom } from './carryForward';
import type { FxRateRecord } from './rates';

/**
 * TASK 10a — what happens on a date BNR has no row for.
 *
 * The dates below are the real October 2026 banking pattern read in research 23: the daily series page
 * showed `08.10, 07.10, 06.10, 05.10, 02.10` and **no rows for 3–4 October**, a weekend. So the weekend
 * case is not hypothetical, and the Friday→Monday carry is what the app actually does.
 *
 * What these tests guard is the *labelling*, not just the arithmetic. `substituted` must be `false` when
 * BNR published a row for the date itself — a conversion that needed no substitution must not be flagged,
 * or the flag stops meaning anything.
 */

function rate(date: string, value: string): FxRateRecord {
  return {
    currency: 'EUR',
    rate: value,
    rateKind: 'daily_reference',
    rateDate: date,
    seriesCode: 'CURSZ_EUR',
    sourceUrl: 'https://curs.bnr.ro/files/xml/years/nbrfxrates2026.xml',
    fetchedAt: '2026-10-09T09:00:00Z',
    provisional: false,
    entryMode: 'fetched',
  };
}

// The published pattern, verbatim from the BNR daily series page as captured in research 23.
const PUBLISHED = [rate('2026-10-02', '5.3410'), rate('2026-10-05', '5.3450'), rate('2026-10-06', '5.3460'), rate('2026-10-07', '5.3470'), rate('2026-10-08', '5.3480')];

describe('selectCarriedRate', () => {
  it('returns the exact row when BNR published one for that date, and does not flag it', () => {
    const found = selectCarriedRate(PUBLISHED, '2026-10-07');
    expect(found).not.toBeNull();
    expect(found!.rate.rateDate).toBe('2026-10-07');
    expect(found!.substituted).toBe(false);
  });

  it('carries Friday forward over the weekend, and says it substituted', () => {
    // 3–4 October 2026 are Sat/Sun: no BNR datum exists keyed to them.
    for (const weekend of ['2026-10-03', '2026-10-04']) {
      const found = selectCarriedRate(PUBLISHED, weekend);
      expect(found!.rate.rateDate).toBe('2026-10-02');
      expect(found!.substituted).toBe(true);
    }
  });

  it('never reaches forward to a later date — a later rate is not evidence about an earlier day', () => {
    const found = selectCarriedRate(PUBLISHED, '2026-10-01');
    expect(found).toBeNull();
  });

  it('returns null when nothing at or before the date is known, rather than guessing', () => {
    expect(selectCarriedRate([], '2026-10-05')).toBeNull();
  });

  it('picks the nearest earlier date, not the first or the last in the list', () => {
    const shuffled = [...PUBLISHED].reverse();
    expect(selectCarriedRate(shuffled, '2026-10-06')!.rate.rate).toBe('5.3460');
  });

  it('ignores rows with no date instead of treating them as usable', () => {
    const dirty = [{ currency: 'EUR', rate: '5.0000' } as unknown as FxRateRecord, ...PUBLISHED];
    expect(selectCarriedRate(dirty, '2026-10-04')!.rate.rateDate).toBe('2026-10-02');
  });

  it('refuses a malformed date rather than comparing strings it cannot trust', () => {
    expect(() => selectCarriedRate(PUBLISHED, '03.10.2026')).toThrow(RangeError);
    expect(() => selectCarriedRate(PUBLISHED, '2026-10-3')).toThrow(RangeError);
  });

  it('isIsoDate accepts only the format the ordering argument depends on', () => {
    expect(isIsoDate('2026-10-03')).toBe(true);
    expect(isIsoDate('2026-13-03')).toBe(true); // shape only — the calendar is not this function's job
    expect(isIsoDate('3 Oct 2026')).toBe(false);
    expect(isIsoDate('2026-10-03T00:00:00Z')).toBe(false);
  });
});

describe('stampCarriedFrom', () => {
  it('leaves an exact-date record untouched — no flag on a conversion that needed none', () => {
    const record = rate('2026-10-07', '5.3470');
    const stamped = stampCarriedFrom(record, '2026-10-07', false);
    expect(stamped).toBe(record);
    expect('carriedFrom' in stamped).toBe(false);
  });

  it('records the date actually used when it substituted', () => {
    const record = rate('2026-10-02', '5.3410');
    const stamped = stampCarriedFrom(record, '2026-10-04', true);
    expect(stamped.carriedFrom).toBe('2026-10-02');
    // The rate itself is unchanged: the substitution is a disclosure, not an adjustment.
    expect(stamped.rate).toBe('5.3410');
  });

  it('does not mutate the stored record — the same row may answer a Tuesday exactly', () => {
    const record = rate('2026-10-02', '5.3410');
    stampCarriedFrom(record, '2026-10-04', true);
    expect('carriedFrom' in record).toBe(false);
  });
});
