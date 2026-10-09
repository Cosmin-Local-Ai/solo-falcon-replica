/**
 * TASK 7 — copy for the record pages: Venituri, Cheltuieli, Clienți, Declarații, Documente,
 * e-Factura.
 *
 * These pages repeat each other more than anywhere else in the app — the same tab names, the same
 * modal captions, the same „Niciun rezultat pentru căutare." — and each copy used to keep its own
 * copy-paste of the sentence. One key now, shared.
 */
import type { DeclStatus, ExpenseStatus, RevenueStatus } from '../../data/types';

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
    withoutVat: 'Fără TVA',
    vat: 'TVA',
    total: 'Total',
    status: 'Status',
  },
  /** The unclassified-expense banner: how many, and what happens to them. */
  unclassifiedLead: (n: number): string =>
    n === 1
      ? 'O cheltuială este neclasificată'
      : `${n} cheltuieli sunt neclasificate`,
  unclassifiedTail: 'în acest an fiscal și nu intră în cheltuielile deductibile (CF art. 68 alin. (4) și (7)).',
  /** The cap banner. */
  capTitle: 'Plafonul calculat',
  capAppliedLead: (measure: string): string => `Plafon aplicat (${measure}):`,
  capAlternativeLead: '· cealaltă lectură, post-plafon:',
  capCitation: (article: string, percent: number): string =>
    `· ${article} · plafon ${percent}% din baza art. 68 alin. (6)`,
  measureWithVat: 'cu TVA inclus',
  measureWithoutVat: 'fără TVA',
  /** A legal ceiling the app cannot measure — a missing fact, not a completion error. */
  capBlockedRest: (n: number): string =>
    `Celelalte ${n} sunt excluse pentru temeiuri identice sau analoage; fiecare poartă motivul ei.`,
} as const;

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
  subtitle: 'Declarații fiscale lunare — IM, CS, TVA',
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
  uploadManyBody: 'Se pot încărca mai multe documente deodată, în format PDF, JPG sau PNG, maximum 2 MB fiecare.',
  hideExamples: 'Ascunde exemplele',
  showExamples: 'Vezi exemple',
  uploadOther: 'Încarcă alt document',
  upload: 'Încarcă document',
  preview: 'Previzualizează',
  download: 'Descarcă',
  empty: 'Nicio document încărcat.',
  acceptedFormats: 'Format acceptat: PDF, JPG, PNG',
  tooLarge: 'Fișierul depășește 2 MB — stocarea locală nu e suficientă',
  uploaded: (name: string): string => `„${name}" a fost încărcat`,
  readFailed: 'Nu am putut citi fișierul',
  deleted: (name: string): string => `„${name}" a fost șters`,
  declaration: {
    addTitle: 'Adaugă declarație depusă',
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
