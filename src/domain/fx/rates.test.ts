import { describe, it, expect } from 'vitest';
import {
  BNR_ENDPOINTS,
  checkRateRecord,
  fxRateRecordSchema,
  seriesCodeStatus,
  validateRateRecord,
  type FxRateRecord,
} from './rates';

/**
 * TASK 10a — the FX rate store.
 *
 * A rate record is evidence, not a number. These tests hold the line on the fields that make it evidence:
 * which series it came from, where it was read, when, and whether it is the final published figure. They
 * also hold the line on what the store refuses, because a store that accepts a daily rate with no date has
 * accepted something that cannot answer the only question the rule asks.
 */

const daily: FxRateRecord = {
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

const annual: FxRateRecord = {
  currency: 'EUR',
  rate: '4.9631',
  rateKind: 'annual_average',
  rateYear: 2025,
  seriesCode: 'CURSA_EURM',
  sourceUrl: 'https://www.bnr.ro/1975-cursul-de-schimb-serii-statistice',
  fetchedAt: '2026-10-09T09:00:00Z',
  provisional: false,
  entryMode: 'manual',
};

describe('the rate record carries its own evidence', () => {
  it('accepts a dated daily reference rate with full provenance', () => {
    const checked = validateRateRecord(daily);
    expect(checked.ok).toBe(true);
  });

  it('accepts a dated annual average entered by hand', () => {
    expect(validateRateRecord(annual).ok).toBe(true);
  });

  it('refuses a daily rate with no date — the rule is keyed to the date the sum was received', () => {
    expect(checkRateRecord({ ...daily, rateDate: undefined }).some((p) => p.field === 'rateDate')).toBe(true);
  });

  it('refuses an annual average with no year — pct. 7 alin. (6) is keyed to the year of payment', () => {
    expect(checkRateRecord({ ...annual, rateYear: undefined }).some((p) => p.field === 'rateYear')).toBe(true);
  });

  it('refuses a daily rate that also carries a year, and an average that also carries a date', () => {
    expect(checkRateRecord({ ...daily, rateYear: 2026 }).some((p) => p.field === 'rateYear')).toBe(true);
    expect(checkRateRecord({ ...annual, rateDate: '2025-06-01' }).some((p) => p.field === 'rateDate')).toBe(true);
  });

  it('refuses a rate that is not a positive decimal, and a rate written with a comma', () => {
    expect(checkRateRecord({ ...daily, rate: '0' }).some((p) => p.field === 'rate')).toBe(true);
    expect(checkRateRecord({ ...daily, rate: '-5.3' }).some((p) => p.field === 'rate')).toBe(true);
    // BNR's XML uses `.`; `5,3470` is a display form, and accepting it here would let a scraped display
    // value pass for a published one.
    expect(checkRateRecord({ ...daily, rate: '5,3470' }).length).toBeGreaterThan(0);
  });

  it('refuses a record with no source — BNR\'s licence requires indicarea sursei', () => {
    expect(checkRateRecord({ ...daily, sourceUrl: '' }).length).toBeGreaterThan(0);
    expect(checkRateRecord({ ...daily, seriesCode: '' }).length).toBeGreaterThan(0);
    expect(checkRateRecord({ ...daily, fetchedAt: '' }).length).toBeGreaterThan(0);
  });

  it('refuses RON as a rate currency — RON is the target of a conversion, never its source', () => {
    expect(checkRateRecord({ ...daily, currency: 'RON' }).length).toBeGreaterThan(0);
  });

  it('only lets a dated rate be carried forward from another date', () => {
    expect(validateRateRecord({ ...daily, carriedFrom: '2026-10-07' }).ok).toBe(true);
    expect(checkRateRecord({ ...annual, carriedFrom: '2024-12-31' }).some((p) => p.field === 'carriedFrom')).toBe(true);
  });
});

describe('the provisional flag can express the FY2026 gap (B-33), and nothing computes it', () => {
  it('a record can be provisional, and that is a legal state of the store', () => {
    const provisional: FxRateRecord = { ...annual, rateYear: 2026, provisional: true };
    expect(validateRateRecord(provisional).ok).toBe(true);
  });

  it('the schema has no field an annual average could be computed into', () => {
    // There is deliberately no `dailyRates` / `monthlyAverages` field on a record: the only way to obtain
    // the annual average is to record the published one. BNR's printed methodology is the average of the
    // 12 monthly averages, so a mean of daily rates is a DIFFERENT number and would be a fabricated figure.
    expect(Object.keys(fxRateRecordSchema.shape).sort()).toEqual(
      ['carriedFrom', 'currency', 'entryMode', 'fetchedAt', 'provisional', 'rate', 'rateDate', 'rateKind', 'rateYear', 'seriesCode', 'sourceUrl'],
    );
  });
});

describe('series codes are labelled by what was actually verified', () => {
  it('knows the two EUR codes read from the BNR series page', () => {
    expect(seriesCodeStatus('CURSZ_EUR')).toBe('verified');
    expect(seriesCodeStatus('CURSA_EURM')).toBe('verified');
  });

  it('calls every other code unverified — a pattern is not a fact', () => {
    // `CURSA_USDM` follows the visible pattern and may well be right, but it was never read off the page.
    // Recording it as verified would put an unverified figure into a tax computation.
    expect(seriesCodeStatus('CURSA_USDM')).toBe('unverified');
    expect(seriesCodeStatus('CURSZ_GBP')).toBe('unverified');
    expect(seriesCodeStatus('anything')).toBe('unverified');
  });
});

describe('endpoints reflect the 6 August 2026 migration', () => {
  it('points at curs.bnr.ro, not the dead www.bnr.ro path', () => {
    expect(BNR_ENDPOINTS.latest).toBe('https://curs.bnr.ro/nbrfxrates.xml');
    expect(BNR_ENDPOINTS.lastTenDays).toBe('https://curs.bnr.ro/nbrfxrates10days.xml');
    expect(BNR_ENDPOINTS.yearArchive(2026)).toBe('https://curs.bnr.ro/files/xml/years/nbrfxrates2026.xml');
    expect(BNR_ENDPOINTS.xsd).toBe('https://curs.bnr.ro/xsd/nbrfxrates.xsd');
    for (const url of [BNR_ENDPOINTS.latest, BNR_ENDPOINTS.lastTenDays, BNR_ENDPOINTS.yearArchive(2025)]) {
      expect(url).not.toContain('www.bnr.ro/nbrfxrates');
    }
  });
});
