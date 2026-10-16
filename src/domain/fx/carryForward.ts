/**
 * What to do when a date has no BNR rate of its own — TASK 10a.
 *
 * ## The gap this fills
 *
 * BNR publishes on **banking days only**: „Actualizarea datelor se face în timp real, imediat după ora
 * 13:00, **în fiecare zi bancară**." The daily series page (bnr.ro/9100-…) showed rows `08.10.2026,
 * 07.10.2026, 06.10.2026, 05.10.2026, 02.10.2026` — there is literally no row for 3–4 October 2026, a
 * weekend. So a payment or collection dated Saturday has no rate keyed to it. Something has to happen, and
 * the app must be honest about which something.
 *
 * ## What the law actually says, and what it does not
 *
 * There **is** a carry-forward rule in the Codul fiscal, and it is worth quoting because it is the model:
 *
 * > „În cazul în care la data de referință nu există curs de schimb publicat de Banca Națională a
 * > României, se utilizează cursul de schimb publicat în prima zi bancară anterioară datei de referință."
 * > — Codul fiscal, art. 68^3 alin. (4) (CASS) and, in the same words, art. 85 alin. (4) (CASS for
 * > payroll). **CONFIRMED as to wording**; both occurrences were read in the consolidated text.
 *
 * That phrase occurs **exactly twice in the whole code**, and both times inside the CASS articles. It does
 * **not** appear in Titlul IV (income tax) or in art. 9 alin. (3) lit. b) / alin. (4), which is the rule
 * that governs a PFA's foreign-currency income. And art. 9 alin. (4) narrows the gap rather than closing
 * it: the methods it allows are those „prevăzute expres în **prezentul cod**".
 *
 * ## The stance this module takes
 *
 * Applying the CASS carry-forward to an income-tax conversion is **an app policy adopted by analogy, not a
 * statutory rule the app can cite**. So:
 *
 * - the substitution is applied, because refusing to convert a Saturday payment would be worse than
 *   converting it at a clearly-labelled rate;
 * - the record carries `carriedFrom` with the date actually used, so the substitution is visible on the
 *   fact rather than hidden in a fetcher;
 * - the UI must surface it through `InterpretationNote`, never as a sentence that reads like law. The copy
 *   says the rule is borrowed from the CASS articles and is not stated for income tax.
 *
 * This is the same discipline the repo already applies to an inference that has no primary text behind it:
 * name the source of the reasoning, and do not let the wording imply more authority than it has.
 */

import type { FxRateRecord } from './rates';

/** A daily rate, paired with the date it was published for. */
type DatedRate = Pick<FxRateRecord, 'rateDate'>;

/**
 * Compare `YYYY-MM-DD` strings. Lexicographic order on that format **is** chronological order, which is
 * why no date parsing is needed here — and why the format is enforced by the schema rather than trusted.
 */
export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * The latest published rate at or before `requestedDate`, and whether using it means substituting.
 *
 * `substituted` is the load-bearing field: `false` means BNR published a row for exactly that date, so the
 * conversion rests on a rate keyed to the date the rule names. `true` means the app carried an earlier
 * date forward, and the caller must label it.
 *
 * Returns `null` when nothing at or before the date is known. That is a real answer, not a failure to
 * handle the case: the caller must then refuse the conversion rather than reach for a later date or a
 * guessed one.
 */
export function selectCarriedRate<T extends DatedRate>(
  published: readonly T[],
  requestedDate: string,
): { rate: T; substituted: boolean } | null {
  if (!isIsoDate(requestedDate)) {
    throw new RangeError(`selectCarriedRate needs a YYYY-MM-DD date, got ${JSON.stringify(requestedDate)}`);
  }
  let best: T | undefined;
  for (const row of published) {
    const date = row.rateDate;
    if (date === undefined || !isIsoDate(date)) continue;
    if (date > requestedDate) continue; // a later rate is not evidence about an earlier day
    if (best === undefined || best.rateDate === undefined || date > best.rateDate) best = row;
  }
  if (best === undefined) return null;
  return { rate: best, substituted: best.rateDate !== requestedDate };
}

/**
 * Stamp a carried-forward rate onto the record that will be stored.
 *
 * When BNR published a row for the date itself the record is returned unchanged — `carriedFrom` must not
 * appear on a rate that needed no substitution, or the UI would flag a conversion that deserves no flag.
 */
export function stampCarriedFrom(record: FxRateRecord, requestedDate: string, substituted: boolean): FxRateRecord {
  if (!substituted) return record;
  if (record.rateDate === undefined) {
    throw new RangeError('stampCarriedFrom requires a dated (daily_reference) record');
  }
  if (record.rateDate === requestedDate) return record;
  return { ...record, carriedFrom: record.rateDate };
}
