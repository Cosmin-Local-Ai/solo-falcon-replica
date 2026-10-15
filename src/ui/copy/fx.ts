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
   * B-137 (D-FX-6) — the note that sits beside a euro ceiling converted at a provisional annual average.
   *
   * The user asked for this explicitly and it is part of the decision, not polish. It answers the five
   * questions in the order D-FX-6 lists them, in words that ask nothing of the reader: no `pct. 7 alin. (6)`-
   * shaped prior knowledge, no tooltip, no disclosure. A stand-in figure that has to be clicked open before
   * it can be understood is a stand-in figure that gets read as law.
   *
   * `replacedBeforeFiling` is the fourth point and the one that changes how the whole banner reads: the
   * return for the year is filed after BNR publishes that year's average, so a provisional ceiling never
   * reaches ANAF. Left out, the banner alarms someone; said, it informs them.
   */
  provisionalCeiling: {
    title: 'Ce înseamnă cifra de mai sus',
    /** 1. The law states the ceiling in euro; the expenses are in lei; something had to bridge them. */
    statedInEuro:
      'Plafonul este scris în euro în textul legii, iar cheltuielile dumneavoastră sunt în lei. Ca să le poată compara, aplicația a transformat plafonul în lei.',
    /** 2. Which rule, and why an open year can only ever produce a provisional figure. */
    ruleAndOpenYear: (year: number): string =>
      `Regula folosită este media anuală a BNR pentru anul în care s-a făcut plata, temei HG 1/2016, pct. 7 alin. (6). BNR publică acea medie abia după ce anul se încheie, așa că pentru ${year}, care nu s-a încheiat încă, cifra este provizorie.`,
    /** 3. The rival rule, kept on screen rather than hidden. */
    secondRule:
      'O a doua regulă aflată în vigoare cere un alt curs, cel de la data plății, temei art. 9 alin. (3) lit. b) și alin. (4) din Codul fiscal. Niciun text oficial nu spune care dintre cele două se aplică, așa că aplicația folosește una singură și o afișează și pe cealaltă, în loc s-o ascundă.',
    /** 4. It gets replaced, and the filing date means it never reaches ANAF. */
    replacedBeforeFiling: (year: number): string =>
      `Când BNR va publica media definitivă pentru ${year}, cifra de mai sus va fi înlocuită cu ea. Declarația pentru ${year} se depune abia în ${year + 1}, după publicare, deci o cifră provizorie nu ajunge niciodată la ANAF — vă ajută doar să planificați în timpul anului.`,
    /** 5. Where the number came from, since the app is forbidden from producing one itself. */
    enteredLead:
      'Aplicația nu și-a calculat singură această medie. Fiecare medie anuală folosită aici a fost înregistrată așa:',
    /** One line per rate actually used, so the provenance belongs to the figure it explains. */
    rateRow: (used: {
      rate: string;
      currency: string;
      year: number;
      how: string;
      when: string;
      source: string;
    }): string =>
      `media anuală ${used.rate} lei pentru un ${used.currency} în ${used.year} — ${used.how}, înregistrată la ${used.when}, de pe ${used.source}`,
    notDerived:
      'Aplicația nici nu are voie să-și facă singură media: media anuală a BNR se obține din mediile lunare, nu din cursurile zilnice, deci o medie calculată din cursuri zilnice ar fi un alt număr decât cel publicat.',

    /**
     * B-144 — the same five answers, one level over.
     *
     * A provisional ceiling changes a deduction. A provisional annual average applied to **income** changes
     * the number the thresholds are measured on, and a threshold that moves changes the shape of the whole
     * year: which tier, which contribution base, not just which deduction. The five answers are the same
     * five, so they are rendered by the same component; only the first three sentences differ, because the
     * rule, the currency direction and the rival reading differ. Points 4 and 5 are shared verbatim — the
     * filing date and the prohibition on deriving the average do not depend on which figure is at stake.
     */
    threshold: {
      /** Why the figure above is a converted one at all: income and threshold both had to reach lei. */
      lead:
        'Cifra de mai sus nu schimbă doar o deducere. Pe ea se măsoară dacă treceți de un prag, iar un prag '
        + 'care se mișcă schimbă forma întregului an: baza de calcul pentru contribuții, nu doar impozitul.',
      /** 1. The threshold is in euro, the income was recorded in euro, and the app brought both to lei. */
      statedInEuro:
        'Pragul este scris în euro în textul legii, iar venitul dumneavoastră a fost înregistrat în euro. '
        + 'Ca să le poată compara, aplicația a adus ambele cifre în lei cu un curs mediu anual.',
      /** 2. Which rule, and why an open year can only ever produce a provisional figure. */
      ruleAndOpenYear: (year: number): string =>
        'Regula folosită este media anuală a BNR pentru anul în care s-a realizat venitul, temei adresa ANAF '
        + `Cluj din 22.04.2026 și instrucțiunile OPANAF 2.736/2025. BNR publică acea medie abia după ce anul `
        + `se încheie, așa că pentru ${year}, care nu s-a încheiat încă, cifra este provizorie.`,
      /** 3. The rival rule, kept on screen rather than hidden. */
      secondRule:
        'Niciun text oficial nu spune după care dintre cele două reguli se aduce venitul în lei: media anului '
        + 'în care venitul s-a realizat, sau cursul BNR de la data încasării, temei art. 9 alin. (3) lit. b) '
        + 'și alin. (4) din Codul fiscal. Aplicația folosește una singură și o afișează și pe cealaltă, în '
        + 'loc s-o ascundă.',
    },
  },

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
