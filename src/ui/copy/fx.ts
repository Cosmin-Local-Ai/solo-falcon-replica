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

  /**
   * Phase 10c (B-36) — the entry form. A rate is a legal datum, so the form asks for everything the record
   * has to carry: the currency, the printed decimal, the kind, the date or year it anchors to, the series,
   * the source and whether it is final. There is no „fetch” button on purpose: nothing in this app reads
   * BNR over the network, and a rate that arrives by itself would be a rate nobody can name a source for.
   */
  entry: {
    title: 'Înregistrare manuală a unui curs',
    intro:
      'Aplicația nu citește niciun curs de pe internet. Cursul se înregistrează aici, din tabelul publicat '
      + 'de BNR, și rămâne înregistrat până când o nouă înregistrare cu aceeași monedă, același tip și '
      + 'aceeași dată sau același an îl înlocuiește.',
    fields: {
      currency: 'Moneda',
      rate: 'Curs (lei pentru o unitate)',
      rateKind: 'Tip de curs',
      rateDate: 'Valabil pentru data',
      rateYear: 'Anul mediei',
      seriesCode: 'Serie BNR',
      sourceUrl: 'Sursa (adresa paginii BNR)',
      status: 'Stare',
    },
    rateHelp:
      'Câți lei face o unitate din monedă, scris exact cum îl publică BNR — de exemplu 5.3470, nu 5,35.',
    save: 'Înregistrează cursul',
    /** The upsert, said plainly: this is the correction route, not an edit hidden behind a pencil icon. */
    upsertHint:
      'Corectura unui curs deja folosit la o conversie se face tot aici: aceeași monedă, același tip și '
      + 'aceeași dată sau același an înlocuiesc înregistrarea, iar totalurile se recalculează la următorul calcul.',
    saved: (currency: string, validFor: string) =>
      `Cursul ${currency} valabil pentru ${validFor} este înregistrat.`,
    replaced: (currency: string, validFor: string) =>
      `Înregistrarea existentă pentru ${currency} / ${validFor} a fost înlocuită — aceeași cheie: monedă, tip și dată sau an.`,
    /** `problems[]` from `recordFxRate` is shown verbatim under this lead; the app does not reword it. */
    problemsLead: 'Cursul nu a fost salvat. Motivele, exact cum le-a dat verificarea:',
    seriesUnverified: (code: string) =>
      `Seriea „${code}” nu este una dintre seriile BNR verificate în acest proiect; este păstrată așa cum `+
      'a fost scrisă și nu este prezentată ca o serie oficială.',
    /** Mirrors `manualAnnualAverage`: the year decides, the entrant does not. */
    provisionalForced:
      'Media anuală a unui an care nu s-a încheiat încă se înregistrează provizorie; BNR publică media abia '
      + 'după închiderea anului.',
  },

  /**
   * Phase 10c (B-37) — the disclosure that makes one money path visible. Every lei total on the dashboard
   * is built on the same normalised ledger; this block says which foreign records a recorded rate brought
   * in, at which rate, and which ones are still out. The second half is the one that matters: a total with
   * something missing from it must not read as complete.
   */
  ledger: {
    title: 'Inregistrările în valută și totalurile în lei',
    lead:
      'Totalurile în lei de pe acest ecran sunt calculate pe aceeași listă de înregistrări pe care o citește '
      + 'și calculul de impozit. O înregistrare în valută intră în ele numai când există un curs înregistrat '
      + 'pentru data la care suma a fost încasată sau plătită.',
    convertedTitle: 'Intrate în totaluri, cu cursul care le-a adus',
    unconvertedTitle: 'Lăsate în afara totalurilor în lei',
    /** Lead/Tail split so the count can sit inside a `<strong>` without splitting the sentence. */
    unconvertedLead: (n: number) => `${n} înregistrări în valută`,
    unconvertedTail:
      'nu sunt în niciun total în lei. Cifrele de pe acest ecran nu sunt complete până când pentru ele este '
      + 'înregistrat un curs.',
    convertedCount: (n: number) =>
      `${n} înregistrări au intrat în totaluri prin curs înregistrat.`,
    provisionalInTotal:
      'Cel puțin una dintre conversii folosește un curs provizoriu: cifra care o conține nu este o cifră '
      + 'definitivă.',
    columns: {
      record: 'Inregistrare',
      kind: 'Tip',
      original: 'Suma înregistrată',
      rate: 'Curs folosit',
      onDate: 'Data care ancorează cursul',
      basis: 'Temei',
      status: 'Stare',
      currency: 'Moneda',
      detail: 'De ce lipsește',
    },
    /**
     * The anchor date named honestly. `collected` / `paid` are the money dates art. 9 alin. (3) lit. b) asks
     * for; PG-2 gave the registers fields for both, so a conversion still anchored on the document date now
     * means what it says — this record has no money date recorded — and the sentence says that instead of
     * letting the anchor read as if a payment date were known.
     */
    anchoredOnDocumentDate:
      'Cursul este ancorat pe data documentului, pentru că înregistrarea nu are dată de încasare sau de '
      + 'plată. Data documentului nu este data la care suma a fost încasată ori plătită.',
    anchoredOnMoneyDate:
      'Cursul este ancorat pe data încasării ori a plății, așa cum cere art. 9 alin. (3) lit. b).',
    kinds: {
      revenue: 'Venit',
      expense: 'Cheltuială',
    },
  },
};
