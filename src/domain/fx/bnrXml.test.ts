import { describe, it, expect } from 'vitest';
import { cubeRecords, fetchBnrXml, parseBnrXml } from './bnrXml';

/**
 * TASK 10a — the BNR XML client.
 *
 * **No test in this file performs a network call.** The brief states it as a hard rule, and the design
 * makes it natural: `fetchBnrXml` takes an injected `FetchText`, and every test here hands it a string.
 * The `fetchBnrXml` tests below pass a function that would *throw* if it were ever called over a real
 * transport — the assertion is on which URL was requested, not on what came back.
 *
 * The XML below is written in the shape BNR serves (`Cursor` → `Body` → `Cube date=…` → `Rate currency=…`),
 * with the four-decimal values BNR prints.
 */

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<Cursor xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://curs.bnr.ro/xsd/nbrfxrates.xsd">
  <Header>
    <Name>BNR</Name>
    <Date>2026-10-08</Date>
  </Header>
  <Body>
    <Cube date="2026-10-08">
      <Rate currency="USD">4.5123</Rate>
      <Rate currency="GBP">6.0741</Rate>
      <Rate currency="EUR">5.3470</Rate>
      <Rate currency="HUF">1.2741</Rate>
    </Cube>
    <Cube date="2026-10-07">
      <Rate currency="USD">4.5099</Rate>
      <Rate currency="EUR">5.3450</Rate>
    </Cube>
  </Body>
</Cursor>`;

describe('parseBnrXml — a well-formed document', () => {
  it('reads every cube, its date, and the printed rate strings verbatim', () => {
    const parsed = parseBnrXml(SAMPLE);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.cubes.map((c) => c.date)).toEqual(['2026-10-08', '2026-10-07']);
    const eur = parsed.cubes[0]!.rates.find((r) => r.currency === 'EUR');
    // The string, not a number: `5.3470` as a double is not `5.3470`, and a rate that drifts in the last
    // decimal is how Phase 10's B-17 half-cent disagreement would reappear inside a conversion.
    expect(eur!.rate).toBe('5.3470');
  });

  it('ignores the <Header> block rather than mistaking it for rates', () => {
    const parsed = parseBnrXml(SAMPLE);
    if (!parsed.ok) throw new Error('expected a valid document');
    expect(parsed.cubes[0]!.rates.some((r) => r.currency === 'Name')).toBe(false);
  });
});

describe('parseBnrXml — a document that has drifted', () => {
  it('rejects a non-XML body', () => {
    const parsed = parseBnrXml('<html><body>Not found</body></html>');
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors[0]).toContain('root element must be <Cursor>');
  });

  it('rejects an empty string and a truncated document', () => {
    expect(parseBnrXml('').ok).toBe(false);
    expect(parseBnrXml('<Cursor><Body><Cube date="2026-10-08">').ok).toBe(false);
  });

  it('rejects a document with cubes but no rates at all', () => {
    const parsed = parseBnrXml('<Cursor><Body><Cube date="2026-10-08"></Cube></Body></Cursor>');
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.join(' ')).toContain('no <Rate> children');
  });

  it('rejects a cube with no date — an undated rate cannot answer „which day?”', () => {
    const parsed = parseBnrXml('<Cursor><Body><Cube><Rate currency="EUR">5.3470</Rate></Cube></Body></Cursor>');
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.join(' ')).toContain('without a date attribute');
  });

  it('rejects a rate whose text is not a decimal, and names the currency and date', () => {
    const parsed = parseBnrXml('<Cursor><Body><Cube date="2026-10-08"><Rate currency="EUR">5,3470</Rate></Cube></Body></Cursor>');
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.join(' ')).toContain('currency="EUR"');
    expect(parsed.errors.join(' ')).toContain('2026-10-08');
  });

  it('reports every problem at once, not only the first', () => {
    const parsed = parseBnrXml(
      '<Cursor><Body>' +
        '<Cube date="2026-10-08"><Rate>5.3470</Rate></Cube>' +
        '<Cube date="not-a-date"><Rate currency="EUR">5.3470</Rate></Cube>' +
      '</Body></Cursor>',
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('cubeRecords — provenance is mandatory, and an unverified series says so', () => {
  it('stamps source URL, fetch time and series code on every record', () => {
    const parsed = parseBnrXml(SAMPLE);
    if (!parsed.ok) throw new Error('expected a valid document');
    const records = cubeRecords(parsed.cubes[0]!, {
      sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
      fetchedAt: '2026-10-08T13:05:00Z',
    });
    const eur = records.find((r) => r.currency === 'EUR')!;
    expect(eur.rate).toBe('5.3470');
    expect(eur.rateKind).toBe('daily_reference');
    expect(eur.rateDate).toBe('2026-10-08');
    expect(eur.sourceUrl).toBe('https://curs.bnr.ro/nbrfxrates.xml');
    expect(eur.fetchedAt).toBe('2026-10-08T13:05:00Z');
    expect(eur.entryMode).toBe('fetched');
    expect(eur.provisional).toBe(false);
    // The one code read directly off the BNR series page.
    expect(eur.seriesCode).toBe('CURSZ_EUR');
  });

  it('marks a non-EUR series code as pattern-derived, never as an official code', () => {
    const parsed = parseBnrXml(SAMPLE);
    if (!parsed.ok) throw new Error('expected a valid document');
    const records = cubeRecords(parsed.cubes[0]!, { sourceUrl: 'x', fetchedAt: 'y' });
    const usd = records.find((r) => r.currency === 'USD')!;
    // `CURSZ_USD` is a guess from the visible pattern. The `-PATTERN` suffix is deliberate ugliness: a code
    // that looks official and was never read from the page is exactly the kind of figure this repo refuses
    // to assert.
    expect(usd.seriesCode).toBe('CURSZ_USD-PATTERN');
    expect(usd.seriesCode).not.toBe('CURSZ_USD');
  });

  it('throws rather than half-loading a rate the store would refuse', () => {
    const parsed = parseBnrXml(SAMPLE);
    if (!parsed.ok) throw new Error('expected a valid document');
    const broken = { ...parsed.cubes[0]!, rates: [{ currency: 'EUR', rate: '0' }] };
    expect(() => cubeRecords(broken, { sourceUrl: 'x', fetchedAt: 'y' })).toThrow(/not storable/);
  });
});

describe('fetchBnrXml — the URL is chosen by what is asked for, and no test hits the network', () => {
  it('asks the 10-day file for the current year and the year archive for a past year', async () => {
    const asked: string[] = [];
    const fakeFetch = async (url: string) => {
      asked.push(url);
      return SAMPLE;
    };
    const current = await fetchBnrXml(fakeFetch, 2026, 2026);
    expect(current.sourceUrl).toBe('https://curs.bnr.ro/nbrfxrates10days.xml');
    const past = await fetchBnrXml(fakeFetch, 2024, 2026);
    expect(past.sourceUrl).toBe('https://curs.bnr.ro/files/xml/years/nbrfxrates2024.xml');
    expect(asked).toHaveLength(2);
  });

  it('never asks the dead www.bnr.ro path', async () => {
    const asked: string[] = [];
    await fetchBnrXml(async (u) => { asked.push(u); return SAMPLE; }, 2026, 2026);
    await fetchBnrXml(async (u) => { asked.push(u); return SAMPLE; }, 2019, 2026);
    for (const url of asked) expect(url.startsWith('https://curs.bnr.ro/')).toBe(true);
  });
});
