/**
 * TASK 10a — the language for foreign-currency rates.
 *
 * Two things live here that did not live anywhere before: the words for a rate record (which kind of
 * published figure it is, how it got here, whether it is final), and the four notes about what the law
 * does **not** settle about converting a sum in a foreign currency.
 *
 * What deliberately does **not** live here: the names of the conversion rules themselves
 * (`BASIS_LABELS`, `BASIS_CITATIONS`, `CONVERSION_HIERARCHY_CONFLICT` in `src/domain/fx/convert.ts`).
 * Those are the names of the rules, and `src/domain/**` must not import from `src/ui/copy/**` — a domain
 * module that needed the UI layer to say which statute it applied would be untestable on its own. The
 * rule names therefore stay beside the rules, and this module holds the labels and notes that only a
 * screen needs.
 */

import type { RateEntryMode, RateKind } from '../../domain/fx/rates';

export const fx = {
  /** The settings card that lists what this install has recorded. */
  card: 'Cursuri valutare înregistrate',
  /** Absence is a real state and is named as one: no rate was fetched and none was entered. */
  empty:
    'Niciun curs nu este înregistrat. Fără un curs înregistrat, o sumă în valută rămâne în afara calculelor, cu motivul afișat.',
  /** What a rate record is, in one line under the card title. */
  explanation:
    'Fiecare curs înregistrat păstrează de unde a fost luat, pe ce serie a BNR și la ce dată a fost preluat sau introdus.',

  rateKindLabels: {
    daily_reference: 'curs de referință zilnic',
    annual_average: 'medie anuală publicată',
  } satisfies Record<RateKind, string>,

  entryModeLabels: {
    fetched: 'preluat de la BNR',
    manual: 'introdus manual',
  } satisfies Record<RateEntryMode, string>,

  /** Column headers. Short on purpose: the guard treats a two-word header as UI language, not a sentence. */
  columns: {
    currency: 'Moneda',
    rate: 'Curs',
    kind: 'Tip',
    validFor: 'Valabil pentru',
    source: 'Sursă',
    status: 'Stare',
  },

  provisionalBadge: 'Provizoriu',
  finalBadge: 'Definitiv',

  labels: {
    series: 'Serie BNR',
    fetchedAt: 'Preluat la',
    carriedFrom: 'Preluat din',
    sourceUrl: 'Sursa',
  },

  /**
   * The substitution made visible. A rate record stores the date it was **taken from** (`carriedFrom`);
   * the date that was *asked for* belongs to the conversion, not to the record, so this names the one date
   * the record actually knows. Naming it is what keeps an app policy from reading like a published figure.
   */
  carriedFrom: (used: string) =>
    `Nu există curs publicat pentru data cerută; s-a folosit cursul din ${used}.`,

  /** The two readings of the conversion conflict, in the words shown on screen. */
  readings: {
    annualAverage: 'media anuală BNR a anului în care s-a făcut plata',
    dailyRate: 'cursul zilnic BNR de la data la care suma a fost încasată',
  },

  /** The source a human is pointed at when a machine-readable export does not exist. */
  manualEntryHint:
    'Media anuală se introduce manual: BNR o publică într-un tabel, nu într-un fișier pe care aplicația să-l poată citi.',
};
