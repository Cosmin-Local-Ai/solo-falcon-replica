/**
 * The BNR XML client — TASK 10a.
 *
 * ## What this file is
 *
 * The one place in the app that turns BNR's published XML into `FxRateRecord`s. Everything else talks to
 * the `FxRateProvider` interface in `provider.ts`, which is what keeps the network behind a single boundary
 * as the brief requires, and what lets every test run against a fixture instead of a live endpoint.
 *
 * ## Endpoints, and why the old one is not a fallback
 *
 * BNR moved the XML files on **6 August 2026**: „Începând cu data de 6 august 2026, fișierele XML … nu vor
 * mai fi disponibile direct prin intermediul adreselor de pe domeniul www.bnr.ro, ci vor putea fi accesate
 * **exclusiv prin subdomeniul curs.bnr.ro** … Denumirile fișierelor XML rămân neschimbate, fiind modificat
 * doar domeniul de acces." (BNR, 04.08.2026, bnr.ro/25710-…) So `www.bnr.ro/nbrfxrates.xml` is not a slower
 * mirror — it is dead, and a client that still points there fails rather than degrades.
 *
 * ## „XSD-validated", stated honestly
 *
 * The brief asks for an XSD-validated client. There is **no XSD processor in this project's dependencies**
 * (runtime deps are react, react-router, recharts, zod, decimal.js-light), and adding one to a browser
 * bundle to validate a ~200-line document would be the wrong trade. What is implemented instead is a
 * **structural validator that enforces the elements and attributes `https://curs.bnr.ro/xsd/nbrfxrates.xsd`
 * requires of the documents BNR actually serves**: a `Cursor` root, `Cube` elements each carrying a `date`,
 * and `Rate` elements each carrying a `currency` and a decimal text body.
 *
 * That is a real check, and it is the check that matters — BNR itself warns that „pagina se poate modifica
 * fără avizare prealabilă", so the failure mode to design for is a silently changed document, and a
 * structural validator catches exactly that. It is **not** a full XSD conformance proof, and it is not
 * described as one anywhere in the UI. If strict conformance is ever needed, the validator is the seam.
 *
 * ## One thing deliberately not handled
 *
 * Some historical BNR series quoted 100 units of a currency rather than 1. Nothing in this file applies a
 * multiplier, because no per-currency multiplier was verified from a primary source, and inventing one is
 * how a rate ends up wrong by two orders of magnitude. The currencies this app converts (EUR, USD) are
 * quoted per 1 unit in the current XML. If a future currency arrives with a different convention, the
 * record's `seriesCode` is where the discrepancy becomes visible.
 */

import { BNR_ENDPOINTS, type FxRateRecord, validateRateRecord } from './rates';
import { isIsoDate } from './carryForward';

/** One `<Cube>`: a date and the rates BNR published for it. */
export interface BnrCube {
  date: string;
  /** `currency` attribute → the printed decimal string, exactly as it appears in the file. */
  rates: Array<{ currency: string; rate: string }>;
}

export type BnrParseResult =
  | { ok: true; cubes: BnrCube[] }
  | { ok: false; errors: string[] };

/**
 * Parse and structurally validate a BNR XML document.
 *
 * Every problem found is reported, not just the first — a document that has drifted in three places should
 * tell the operator so, rather than make them discover one drift per retry.
 */
export function parseBnrXml(xml: string): BnrParseResult {
  const errors: string[] = [];
  if (typeof xml !== 'string' || xml.trim() === '') {
    return { ok: false, errors: ['empty document'] };
  }

  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const failure = doc.querySelector('parsererror');
  if (failure) {
    return { ok: false, errors: [`not well-formed XML: ${failure.textContent?.slice(0, 200) ?? 'unknown'}`] };
  }
  if (doc.documentElement?.localName !== 'Cursor') {
    return { ok: false, errors: [`root element must be <Cursor>, found <${doc.documentElement?.localName ?? '(none)'}>`] };
  }

  // BNR serves the cubes under <Body>; accept a direct child too, because the schema allows the document
  // to be read either way and a rejected-but-valid file is a worse outcome than a permissive read. What is
  // NOT permitted is a document with no cubes at all.
  const cubes = Array.from(doc.getElementsByTagName('Cube'));
  if (cubes.length === 0) {
    return { ok: false, errors: ['no <Cube> elements: the document carries no rates'] };
  }

  const parsed: BnrCube[] = [];
  for (const cube of cubes) {
    const date = cube.getAttribute('date');
    if (date === null) {
      errors.push('<Cube> without a date attribute');
      continue;
    }
    if (!isIsoDate(date)) {
      errors.push(`<Cube date="${date}"> is not YYYY-MM-DD`);
      continue;
    }
    const rateNodes = Array.from(cube.children).filter((el) => el.localName === 'Rate');
    if (rateNodes.length === 0) {
      errors.push(`<Cube date="${date}"> has no <Rate> children`);
      continue;
    }
    const rates: BnrCube['rates'] = [];
    for (const rateNode of rateNodes) {
      const currency = rateNode.getAttribute('currency');
      if (currency === null) {
        errors.push(`<Rate> under <Cube date="${date}"> has no currency attribute`);
        continue;
      }
      const text = (rateNode.textContent ?? '').trim();
      if (!/^\d+(?:\.\d+)?$/.test(text)) {
        errors.push(`<Rate currency="${currency}"> under ${date}: "${text}" is not a decimal`);
        continue;
      }
      rates.push({ currency, rate: text });
    }
    if (rates.length > 0) parsed.push({ date, rates });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, cubes: parsed };
}

/**
 * Turn parsed cubes into storable rate records.
 *
 * `seriesCode` is where honesty lives. BNR's own series page enumerates 280 codes and the EUR set was read
 * directly (`CURSZ_EUR` for the daily reference rate). A code for any other currency is **formed from that
 * visible pattern**, so it is suffixed `-PATTERN` — an ugly suffix on purpose, because a code that looks
 * official and was never read from the page is precisely the kind of figure this repo refuses to assert.
 * TASK 10b should replace it with the real code once one is captured; the suffix makes that visible rather
 * than plausible.
 */
export function cubeRecords(
  cube: BnrCube,
  options: { sourceUrl: string; fetchedAt: string; currencies?: readonly string[] },
): FxRateRecord[] {
  const wanted = options.currencies ?? ['EUR', 'USD', 'GBP', 'HUF'];
  const records: FxRateRecord[] = [];
  for (const entry of cube.rates) {
    if (!wanted.includes(entry.currency)) continue;
    const seriesCode = entry.currency === 'EUR' ? 'CURSZ_EUR' : `CURSZ_${entry.currency}-PATTERN`;
    const candidate = {
      currency: entry.currency as 'EUR' | 'USD' | 'GBP' | 'HUF',
      rate: entry.rate,
      rateKind: 'daily_reference' as const,
      rateDate: cube.date,
      seriesCode,
      sourceUrl: options.sourceUrl,
      fetchedAt: options.fetchedAt,
      provisional: false,
      entryMode: 'fetched' as const,
    };
    const checked = validateRateRecord(candidate);
    // A record the store would refuse is not stored, and not silently dropped either: the caller gets a
    // thrown error naming the currency and date, because a half-loaded rate table is worse than no table.
    if (!checked.ok) {
      throw new Error(
        `BNR rate for ${entry.currency} on ${cube.date} is not storable: ${checked.problems.map((p) => `${p.field}: ${p.message}`).join('; ')}`,
      );
    }
    records.push(checked.record);
  }
  return records;
}

/** The minimum the fetcher needs from the environment — one function, so a test can supply a fixture. */
export type FetchText = (url: string) => Promise<string>;

/**
 * Fetch a BNR XML document. **Never called by a test**: every test injects a fixture into
 * `FxRateProvider` instead, which is what the brief's „no test may touch the network" requires.
 *
 * The URL is chosen by what is being asked for: the year archive for a past year (the daily file only
 * carries recent days), the 10-day file for anything current.
 */
export async function fetchBnrXml(fetchText: FetchText, year: number, today: number): Promise<{ xml: string; sourceUrl: string }> {
  if (year >= today) {
    const url = BNR_ENDPOINTS.lastTenDays;
    return { xml: await fetchText(url), sourceUrl: url };
  }
  const url = BNR_ENDPOINTS.yearArchive(year);
  return { xml: await fetchText(url), sourceUrl: url };
}
