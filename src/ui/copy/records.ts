/**
 * TASK 7 — copy for the record pages: Venituri, Cheltuieli, Clienți, Declarații, Documente,
 * e-Factura.
 *
 * These pages repeat each other more than anywhere else in the app — the same tab names, the same
 * modal captions, the same „Niciun rezultat pentru căutare." — and each copy used to keep its own
 * copy-paste of the sentence. One key now, shared.
 */
import type { DeclStatus, ExpenseStatus, RevenueStatus } from '../../data/types';
import type { ExpenseCategory } from '../../domain/fiscal/deductibility';
import type { FiscalDateField } from '../../domain/aggregation';
import { validation } from './common';

export const revenues = {
  title: 'Venituri',
  subtitle: 'Facturi și notele fără factură emise de către dvs.',
  searchPlaceholder: 'Caută după nr. sau client…',
  add: 'Adaugă venit',
  addTitle: 'Adaugă venit',
  editTitle: (nr: string): string => `Editează ${nr}`,
  emptyTitle: 'Niciun venit în această categorie',
  emptyBody: 'Adăugați primul venit pentru a-l vedea aici.',
  added: (nr: string): string => `Venitul ${nr} a fost adăugat`,
  updated: (nr: string): string => `Venitul ${nr} a fost actualizat`,
  deleted: (nr: string): string => `${nr} a fost ștearsă`,
  documentTypes: {
    factura: 'Factură',
    nota: 'Notă fără factură',
  },
  documentTypeCell: {
    factura: 'Factură',
    nota: 'Notă f. factură',
  },
  documentNumberPlaceholder: 'FCT-2025-0045',
  clientSelectPlaceholder: '— alege clientul —',
  columns: {
    document: 'Document',
    type: 'Tip',
    client: 'Client',
    cui: 'CUI',
    date: 'Data',
    currency: 'Moneda',
    withoutVat: 'Fără TVA',
    vat: 'TVA',
    total: 'Total',
    status: 'Status',
  },
} as const;

export const expenses = {
  title: 'Cheltuieli',
  subtitle: 'Facturi și bonuri fiscale primite de la furnizori.',
  searchPlaceholder: 'Caută după nr. sau furnizor…',
  add: 'Adaugă cheltuială',
  addTitle: 'Adaugă cheltuială',
  editTitle: (nr: string): string => `Editează ${nr}`,
  emptyTitle: 'Nicio cheltuială în această categorie',
  emptyBody: 'Adăugați prima cheltuială pentru a o vedea aici.',
  added: (nr: string): string => `Cheltuiala ${nr} a fost adăugată`,
  updated: (nr: string): string => `Cheltuiala ${nr} a fost actualizată`,
  deleted: (nr: string): string => `${nr} a fost ștearsă`,
  documentTypes: {
    factura: 'Factură',
    bon: 'Bon fiscal',
  },
  documentTypeCell: {
    factura: 'Factură',
    bon: 'Bon fiscal',
  },
  documentNumberPlaceholder: 'FCT-09-112043',
  providerPlaceholder: 'SC … SA',
  deductibilityLabel: 'Categorie deductibilitate (CF art. 68)',
  deductibilityNone: '— fără categorie —',
  deductibilityNoneHint:
    'Fără categorie, cheltuiala este neclasificată și exclusă din calculul impozitului.',
  classify: 'Clasifică',
  totalDocuments: (n: number): string => `Total: ${n} ${n === 1 ? 'document' : 'documente'}`,
  columns: {
    document: 'Document',
    type: 'Tip',
    provider: 'Furnizor',
    cui: 'CUI',
    date: 'Data',
    currency: 'Moneda',
    withoutVat: 'Fără TVA',
    vat: 'TVA',
    total: 'Total',
    status: 'Status',
  },
  /**
   * TASK 10a (B-32) — the foreign-currency banner. A record written in EUR or USD is real data the app can
   * store, and it is NOT in the lei totals, because bringing it in needs a BNR rate and a legal basis the
   * assembler does not attach yet. The banner says so rather than letting the total quietly omit it.
   */
  foreignCurrencyLead: (n: number): string =>
    n === 1 ? 'O cheltuială este' : `${n} cheltuieli sunt`,
  foreignCurrencyTail:
    'într-o monedă pe care aplicația nu o poate aduce încă în lei, deci nu intră în cheltuielile deductibile.',
  /** The unclassified-expense banner: how many, and what happens to them. */
  unclassifiedLead: (n: number): string =>
    n === 1
      ? 'O cheltuială este neclasificată'
      : `${n} cheltuieli sunt neclasificate`,
  unclassifiedTail: 'în acest an fiscal și nu intră în cheltuielile deductibile (CF art. 68 alin. (4) și (7)).',
  /** The cap banner. */
  capTitle: 'Plafonul calculat',
  capHasOne: 'o cheltuială are',
  capHasMany: (n: number): string => `${n} cheltuieli au`,
  /** Names the reading that was applied, so the applied figure is never read as the only possible one. */
  capAppliedReading: 'plafonul măsurat pe baza art. 68 alin. (6) sub interpretarea «înregistrată» (pre-plafon).',
  capAppliedLead: (measure: string): string => `Plafon aplicat (${measure}):`,
  capAlternativeLead: '· cealaltă interpretare, post-plafon:',
  capCitation: (article: string, percent: number | undefined): string =>
    ` · ${article} · plafon ${percent}% din baza art. 68 alin. (6)`,
  measureWithVat: 'cu TVA inclus',
  measureWithoutVat: 'fără TVA',
  /** A legal ceiling the app cannot measure — a missing fact, not a completion error. */
  capBlockedOne: 'O cheltuială are',
  capBlockedMany: (n: number): string => `${n} cheltuieli au`,
  capBlockedTail:
    'un plafon legal care nu poate fi măsurat din datele înregistrate, deci nu intră în cheltuielile deductibile (CF art. 68 alin. (5)). Nu este o eroare de completare — este un fapt pe care aplicația nu îl deține.',
  capBlockedRest: (n: number): string =>
    `Celelalte ${n} sunt excluse pentru temeiuri identice sau analoage; fiecare poartă motivul ei.`,
  /**
   * TASK 10b — a ceiling the law states in euro, converted to lei. The banner has to say four things at
   * once: which reading was applied, at which rate, for which year, and that the other reading gives a
   * different number and the law does not settle which applies. A converted ceiling that does not name
   * its rate is the same defect B-32 was.
   */
  euroCapTitle: 'Plafonul în euro, convertit',
  euroCapAppliedReading:
    'plafonul exprimat în euro a fost convertit la media anuală BNR a anului plății, temeiul pct. 7 alin. (6) '
    + 'din Normele HG 1/2016; art. 9 alin. (3) lit. b) și alin. (4) CF dau un alt plafon, la cursul de la data '
    + 'plății, și legea nu stabilește care dintre cele două reguli se aplică — ambele sunt afișate.',
  euroCapCitation: (article: string): string => ` · ${article}`,
  euroCapRateLead: '· curs mediu anual',
  euroCapValidFor: (year: number): string => `pentru anul ${year}`,
  euroCapAlternativeLead: '· cealaltă citire, cursul BNR de la data plății:',
  euroCapAlternativeMissing: 'această citire nu poate fi măsurată din datele înregistrate:',
  euroCapProvisionalTail:
    'cursul mediu pentru acest an nu este încă publicat de BNR, deci plafonul este provizoriu și se recalculează '
    + 'singur când media definitivă intră în registru.',
  /**
   * TASK 10b — ledger records that entered the lei base only because a recorded BNR rate converted them.
   * The conversion is a legal act (art. 9 alin. (3) lit. b) + alin. (4)), so the rate that did it is shown
   * beside the record, not hidden behind a disclosure.
   */
  fxConvertedLead: (n: number): string =>
    n === 1
      ? 'înregistrare în valută a intrat în calcul la cursul BNR de la data plății'
      : 'înregistrări în valută au intrat în calcul la cursul BNR de la data plății',
  fxConvertedTail:
    ' (CF art. 9 alin. (3) lit. b) și alin. (4)); cursul, seria și sursa sunt afișate lângă fiecare.',
  fxConvertedRow: (currency: string, onDate: string, rate: string): string =>
    `${currency} · ${onDate} · curs ${rate}`,
  fxConvertedCarried: '· curs preluat din ultima zi bancară',
} as const;

/**
 * The deductibility categories in Romanian. The select and the cap banner used to print the internal
 * keys (`protocol`, `mandatory_professional_contribution`, `personal_or_family_use`) as if they were
 * words a person would use. Typed `Record<ExpenseCategory, string>`, so a new category in the rule set
 * is a compile error here rather than a raw key on screen.
 */
export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  personal_or_family_use: 'Cheltuială personală sau de uz familial',
  non_taxable_income_expense: 'Cheltuială cu venituri scutite de impozit',
  own_income_tax: 'Impozitul propriu pe venit',
  personal_insurance_premium: 'Primă de asigurare personală',
  donation: 'Donație',
  fine_or_penalty: 'Amendă sau penalitate',
  loan_principal_repayment: 'Rambursare de principal de împrumut',
  depreciable_asset_purchase: 'Achiziție de mijloc fix',
  inventory_shortage_uncovered: 'Lipsă de stoc neacoperită',
  tax_borne_for_beneficiary: 'Impozit plătit pentru altul',
  depreciation_personal_patrimony: 'Amortizare din patrimoniul personal',
  sponsorship_or_mecenat: 'Sponsorizare sau mecenat',
  corruption_related: 'Cheltuială legată de fapte de corupție',
  owner_social_contributions: 'Contribuții sociale ale titularului',
  employer_social_contributions: 'Contribuții sociale ale angajatorului',
  rent_business_space: 'Chirie pentru spațiul de lucru',
  bank_interest: 'Dobânzi bancare',
  postal_and_telecom: 'Cheltuieli poștale și telecomunicații',
  energy_and_water: 'Energie și apă',
  business_space_upkeep: 'Întreținerea spațiului de lucru',
  depreciation_business_asset: 'Amortizarea mijloacelor fixe din activitate',
  vehicle_related: 'Cheltuieli cu autoturismul',
  protocol: 'Cheltuieli de protocol',
  social_expenses: 'Cheltuieli sociale',
  private_scholarship: 'Bursă privată',
  private_pension_contribution: 'Contribuție la pensie privată',
  occupational_pension_contribution: 'Contribuție la pensie ocupațională',
  pepp_contribution: 'Contribuție la un produs de pensie personală paneuropeană',
  voluntary_health_insurance: 'Asigurare de sănătate voluntară',
  sports_subscription: 'Abonament sportiv',
  professional_body_dues: 'Cotizație la colegiul profesional',
  mandatory_professional_contribution: 'Contribuții profesionale obligatorii',
  etf_purchase: 'Achiziție de unități ETF',
  home_office_shared_cost: 'Cheltuială comună pentru biroul de acasă',
  comodat_immovable_share: 'Cota pentru imobil dat în comodat',
};

export const clients = {
  title: 'Clienți',
  count: (n: number): string =>
    `${n} ${n === 1 ? 'client înregistrat' : 'clienți înregistrați'} în evidența dvs.`,
  searchPlaceholder: 'Caută client…',
  add: 'Adaugă client',
  addTitle: 'Adaugă client',
  editTitle: (denumire: string): string => `Editează ${denumire}`,
  emptyTitle: 'Niciun client',
  emptyBody: 'Adăugați primul client pentru a-l selecta la emiterea facturilor.',
  added: (denumire: string): string => `Clientul ${denumire} a fost adăugat`,
  updated: (denumire: string): string => `Clientul ${denumire} a fost actualizat`,
  denumire: 'Denumire',
  denumirePlaceholder: 'SC EXEMPLU SRL / Nume (PFA)',
  cuiCnp: 'CUI / CNP',
  cityPlaceholder: 'Oraș',
  typePerson: 'Persoană',
  typeCompany: 'Firmă',
  columns: {
    denumire: 'Denumire',
    cuiCnp: 'CUI / CNP',
    email: 'Email',
    phone: 'Telefon',
    city: 'Oraș',
    type: 'Tip',
  },
} as const;

export const declarations = {
  title: 'Declarații',
  // TASK 9: this used to read 'Declarații fiscale lunare — IM, CS, TVA'. It stated a monthly filing
  // cadence that does not exist for this profile: a persoană fizică autorizată în sistem real files the
  // Declarația Unică 212 once a year, by 25 May of the following year (CF art. 122 alin. (3)), and the
  // estimated-advance filings art. 120 / 120¹ were abrogated by OUG 128/2024 from 01-01-2025
  // (docs/ai/research/12_quarterly_payment_deadlines_2026.md §6). The page is a register of the
  // declaration records the app holds; it cannot promise a statutory cadence it does not model, and the
  // seed no longer carries monthly rows for the old wording to describe.
  subtitle: 'Declarații fiscale — ce ai înregistrat în aplicație',
  searchPlaceholder: 'Caută după perioadă…',
  add: 'Adaugă declarație',
  addTitle: 'Adaugă declarație',
  editTitle: (perioada: string): string => `Editează declarația ${perioada}`,
  emptyTitle: 'Nicio declarație în această categorie',
  emptyBody: 'Adăugați prima declarație pentru a o vedea aici.',
  added: (perioada: string): string => `Declarația ${perioada} a fost adăugată`,
  updated: (perioada: string): string => `Declarația ${perioada} a fost actualizată`,
  submitted: (perioada: string): string => `Declarația ${perioada} a fost transmisă`,
  submit: 'Transmite',
  submittedOn: 'Trimisă',
  year: 'An',
  month: 'Lună',
  revenue: 'Venituri (RON)',
  expenses: 'Cheltuieli (RON)',
  registrationDate: 'Data înregistrării',
  columns: {
    period: 'Perioadă',
    year: 'An',
    month: 'Lună',
    revenue: 'Venituri',
    expenses: 'Cheltuieli',
    taxableBase: 'Baza impozabilă',
    status: 'Status',
  },
  months: [
    'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
    'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
  ],
} as const;

/**
 * The four record states, in the words a person reads. The tabs use the plural, the select uses the
 * singular — the same state, agreed with what it counts.
 */
export const recordStatus = {
  tabs: {
    inregistrata: 'Înregistrate',
    'in-asteptare': 'În așteptare',
    transmisa: 'Transmise',
    respinsa: 'Respinse',
  } satisfies Record<DeclStatus, string>,
  /** The badge and select wording — the same states, agreed with the single record they describe. */
  labels: {
    inregistrata: 'Înregistrată',
    'in-asteptare': 'În așteptare',
    transmisa: 'Transmisa',
    respinsa: 'Respinsă',
  } satisfies Record<DeclStatus, string>,
  revenueLabels: {
    inregistrata: 'Înregistrată',
    'in-asteptare': 'În așteptare',
    respinsa: 'Respinsă',
  } satisfies Record<RevenueStatus, string>,
  expenseLabels: {
    inregistrata: 'Înregistrată',
    respinsa: 'Respinsă',
  } satisfies Record<ExpenseStatus, string>,
  /**
   * PG-1 — the lead of the per-record note that says the row is NOT in the estimate figure. The motive
   * after it is the shared reason label from `dashboard.estimate.coverage.reasonLabels`, so the register
   * row and the hero row name the same cause with the same words.
   *
   * It belongs to the record, not to the register: the status badge above it answers „ce stare are
   * înregistrarea?”, this answers „intră în calcul?”. A record can be `Înregistrată` and still not enter.
   */
  notInEstimate: 'nu intră în estimare',
} as const;

/**
 * PG-2 — the field a fiscal date actually came from, in Romanian.
 *
 * Keyed by `domain/aggregation.ts FiscalDateField`, which is the SAME three values as
 * `domain/fx/ledger.ts LedgerDateSource` and the same three values `auditFiscalDates` reports. The
 * type is exhaustive, so a fourth spelling of the idea is a compile error rather than a fourth
 * sentence on screen (B-70's mistake, prevented rather than re-litigated).
 */
export const fiscalDateSource: Record<FiscalDateField, string> = {
  date: 'data documentului',
  collected: 'data încasării',
  paid: 'data plății',
};

/**
 * PG-2 — the money date: the day the money actually moved.
 *
 * `docs/ai/research/37_cash_basis_date_semantics.md` §5 fixes what this app may claim about the
 * difference between a document date and a money date. These keys ARE those sentences; they live in one
 * module so the revenue form, the expense form and the RJIP register cannot each grow their own
 * paraphrase of art. 68. What §5 forbids is deliberately absent: no key here says the document date
 * determines the fiscal year, that the law presumes document date = money date, or that the app's
 * fallback when a money date is missing is mandated by the Cod fiscal. The fallback is a display
 * default, and `revenueEmpty`/`expenseEmpty` (forms) and `documents.rjip.postedOnDocumentDate`
 * (the register) say so in those words.
 *
 * The two field labels are the words `data/schema.ts` already uses for the same two fields.
 */
export const moneyDate = {
  revenueField: 'Data încasării',
  expenseField: 'Data plății',
  optionalTag: '(opțional)',
  /** research/37 §5 sentence 2, split along the clause each form owns. */
  revenueHint:
    'Dacă ai încasat într-un an fiscal diferit de cel al documentului, completează data încasării: '
    + 'suma se duce în anul fiscal în care a intrat banul.',
  expenseHint:
    'Dacă ai plătit într-un an fiscal diferit de cel al documentului, completează data plății: '
    + 'suma se duce în anul fiscal în care a intrat banul.',
  /** research/37 §5 sentence 3: absence is a legal state, not an unfinished field. */
  revenueEmpty:
    'Poți lăsa câmpul gol cât timp banul nu s-a mișcat: fără încasare suma nu este venit brut '
    + '(art. 68 alin. (2) lit. a) din Codul fiscal).',
  expenseEmpty:
    'Poți lăsa câmpul gol cât timp banul nu s-a mișcat: fără plată cheltuiala nu este deductibilă '
    + '(art. 68 alin. (4) lit. b) din Codul fiscal).',
  /** research/37 §5 sentence 1, the claim the whole surface rests on. */
  rule:
    'Anul fiscal rezultă din data încasării, respectiv din data plății — nu din data documentului '
    + '(art. 68 alin. (2) lit. a) și alin. (4) lit. b) din Codul fiscal).',
  /** The register row: which year the money date put this record in, when it is not the document's year. */
  collectedIn: (year: number): string => `încasat în ${year}`,
  paidIn: (year: number): string => `plătit în ${year}`,
} as const;

export const documents = {
  title: 'Documente',
  subtitle: 'Documente de înregistrare, declarații fiscale și rapoarte de trezorerie — stocate local.',
  tabs: {
    pfa: 'Documente PFA',
    declarations: 'Declarații',
    reports: 'Rapoarte',
  },
  uploadManyHint: 'Se pot încărca mai multe documente',
  /**
   * The four registration sections, keyed by the same `DocTypeCode` the data layer uses. The words used
   * to sit in `DOC_SECTIONS` below the data layer, where no language test could reach them.
   */
  sections: {
    im: {
      title: 'Impozit pe venit (IM)',
      desc: 'Declarația 100 / impozit pe venit',
      helper: 'Un fișier pe perioadă (PDF).',
    },
    cs: {
      title: 'Contribuții sociale (CS)',
      desc: 'Declarația 220 / contribuții sociale',
      helper: 'Un fișier pe perioadă (PDF).',
    },
    tva: {
      title: 'TVA',
      desc: 'Declarația 300 / TVA',
      helper: 'Un fișier pe perioadă (PDF).',
    },
    facturi: {
      title: 'Facturi și documente',
      desc: 'Facturi, note fără factură, bonuri fiscale',
      helper: 'Poți adăuga mai multe fișiere.',
    },
  },
  hideExamples: 'Ascunde exemplele',
  showExamples: 'Vezi exemple',
  uploadOther: 'Încarcă alt document',
  upload: 'Încarcă document',
  preview: 'Previzualizează',
  download: 'Descarcă',
  empty: 'Niciun document încărcat.',
  acceptedFormats: 'Format acceptat: PDF, JPG, PNG',
  /**
   * The limit is stated by the caller from `MAX_DOC_BYTES`, not baked into the sentence. The copy used to
   * say 2 MB while the constant is 5 MB — a number in a message that the code never checked.
   */
  tooLarge: (limitMb: number): string =>
    `Fișierul depășește ${limitMb} MB — stocarea locală nu e suficientă`,
  pdfOnly: 'Doar fișiere PDF',
  maxSizeMb: (limitMb: number): string => `Maxim ${limitMb} MB`,
  uploaded: (name: string): string => `„${name}" a fost încărcat`,
  readFailed: 'Nu am putut citi fișierul',
  deleted: (name: string): string => `„${name}" a fost șters`,
  declaration: {
    addTitle: 'Adaugă declarație depusă',
    // One wording for "this field is required": the shared validation keys, not a second spelling.
    typeRequired: validation.declarationTypeRequired,
    periodRequired: validation.periodRequired,
    type: 'Tip declarație *',
    typePlaceholder: 'ex. D101, D112, D200, 220, 221…',
    period: 'Perioadă *',
    periodPlaceholder: 'ex. I–IV 2025, luna martie 2025',
    method: 'Mod de depunere',
    methodSolo: 'Prin SOLO',
    methodPersonal: 'Personală',
    depunereDate: 'Data depunerii',
    pdfLabel: 'Fișier PDF atașat (opțional)',
    changeFile: (name: string): string => `Schimbă: ${name}`,
    choosePdf: 'Alege un PDF',
    emptyTitle: 'Nicio declarație înregistrată',
    emptyBody:
      'Înregistrează aici declarațiile fiscale depuse (D101, D112, 220, 221…) cu perioada și modul de depunere.',
    add: 'Adaugă declarație',
    registered: (tip: string, perioada: string): string =>
      `Declarația ${tip} (${perioada}) a fost înregistrată`,
    deleteTitle: 'Șterge declarația?',
    deleted: 'Declarația a fost ștearsă',
    columns: {
      type: 'Tip',
      period: 'Perioadă',
      method: 'Depunere',
      date: 'Data',
      file: 'Fișier',
    },
  },
  rjip: {
    noCashflow: (year: number): string => `Niciun flux de trezorerie pentru ${year}`,
    generated: (year: number, rows: number): string =>
      `RJIP ${year} a fost generat (${rows} ${rows === 1 ? 'rând' : 'rânduri'})`,
    description:
      'Rapoarte de mișcări de trezorerie (RJIP) — generat din datele din Venituri și Cheltuieli.',
    downloadCsv: '⬇ Descarcă CSV',
    revenue: (year: number): string => `Venituri ${year}`,
    expenses: (year: number): string => `Cheltuieli ${year}`,
    balance: 'Sold',
    rows: 'Rânduri',
    csvHeader: 'Data;Descriere;Venit (RON);Cheltuiala (RON)',
    /**
     * PG-2 (B-66). OMFP 170/2015 cap. V Secțiunea a 2-a makes the register's date column „data
     * efectuării operațiunii de încasare/plată”, and the justificatory document a separate
     * cross-reference column — which is what `Descriere` carries (fel + număr). The sentence names the
     * rule the column follows, so the export never implies the document date is the posting date.
     */
    postedOn:
      'Data din registru este data încasării, respectiv data plății — „data efectuării operațiunii de '
      + 'încasare/plată” (OMFP 170/2015, cap. V). Documentul stă la baza înregistrării și este menționat '
      + 'în coloana Descriere.',
    /**
     * The honest remainder: a record with no money date is posted on its document date because nothing
     * else is recorded. That is stated as what the app did, never as what the law prescribes —
     * research/37 §4.4 found no statutory presumption that fills in a missing money date.
     */
    postedOnDocumentDate: (n: number): string =>
      n === 1
        ? 'O înregistrare a fost postată pe data documentului pentru că nu are dată de încasare sau de '
          + 'plată înregistrată.'
        : `${n} înregistrări au fost postate pe data documentului pentru că nu au dată de încasare sau de plată înregistrată.`,
    yearFromMoneyDate: (year: number): string => `Anul ${year} cuprinde operațiunile cu dată de încasare sau de plată în ${year}.`,
    /**
     * TASK 10a (B-32). The RJIP is a leu register — its own header says `(RON)`. A record written in euro
     * has no leu amount until a BNR rate is attached to it, so it is left out and said out loud, never
     * exported at its cents figure relabelled as lei.
     */
    foreignCurrencyExcluded: (n: number): string =>
      n === 1
        ? 'O înregistrare este într-o monedă străină și nu intră în RJIP, care se ține în lei.'
        : `${n} înregistrări sunt în monede străine și nu intră în RJIP, care se ține în lei.`,
    invoiceKind: {
      factura: 'Factură',
      nota: 'Notă de factură',
    },
  },
} as const;

export const eFactura = {
  title: 'e-Factura',
  subtitle: 'Starea facturilor transmise în sistemul e-Factura.',
  tabs: {
    accepted: 'Acceptate',
    pending: 'În așteptare',
    rejected: 'Respinse',
  },
  emptyTitle: 'Nicio factură în această stare',
  emptyBody: 'Facturile transmise către e-Factura vor apărea aici.',
  resend: 'Retransmite',
  resentDetail: 'Retransmisă către e-Factura',
  resentToast: (nr: string): string => `${nr} a fost retransmisă către e-Factura`,
  columns: {
    document: 'Document',
    client: 'Client',
    cui: 'CUI',
    date: 'Data',
    total: 'Total',
    status: 'Status e-Factura',
  },
} as const;
