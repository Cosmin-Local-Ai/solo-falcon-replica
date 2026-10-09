/**
 * TASK 7 — the shared half of the user-facing language layer.
 *
 * Every sentence a person can read on screen lives here, typed and keyed. Components and pages
 * reference a key; they do not carry the sentence. `copy.guard.test.ts` walks the source tree and
 * fails when a sentence-shaped literal appears in `src/components/**` or `src/pages/**`.
 *
 * Two boundaries this module deliberately keeps:
 *
 * - **Domain sentences stay in the domain.** A threshold `consequence`, an `applicabilityReason`, an
 *   insight title/action or a tax line label is a computed legal fact with a citation attached, and
 *   `src/domain/thresholds.language.test.ts` pins its wording where it is produced. This module owns
 *   UI copy — labels, prompts, empty states, validation messages, disclosure captions and the
 *   interpretation notes — not the engine's legal conclusions.
 * - **Fragments where markup must survive.** When a sentence is broken by `<strong>` or an
 *   interpolated amount, the sentence is split into fragments so the DOM keeps the shape the tests
 *   and the screen reader already rely on. The fragments are still copy; only the interpolation is
 *   the component's job.
 *
 * Grammar rule for this file (the class TASK 5 shipped): a negated past participle needs an
 * auxiliary. `nu înregistrat` is not Romanian; `nu este înregistrat` is. Anything added here is
 * read as a native speaker would read it, not as a label token.
 */

/** Button and control captions shared across every page. */
export const ui = {
  save: 'Salvează',
  add: 'Adaugă',
  cancel: 'Anulează',
  discard: 'Renunță',
  remove: 'Șterge',
  edit: 'Editează',
  close: 'Închide',
  search: 'Caută',
  /** The three answers a fact question can hold. `nu este înregistrat` is the reference fix from
   *  `76f480b`: the app says it does not know, which is not the same as answering „nu". */
  answerYes: 'da',
  answerNo: 'nu',
  answerUnrecorded: 'nu este înregistrat',
  /** Nothing to show for an amount — never `0`, which would state a fact that was never recorded. */
  noValue: '—',
  recordsCount: 'înregistrări',
} as const;

/**
 * Disclosure captions. Both are real `<details>` controls (keyboard-operable, state visible, content
 * in the DOM) — never a hover tooltip. TASK 7 acceptance 5.
 */
export const disclosure = {
  /** How a figure was arrived at. */
  breakdown: 'Cum am ajuns la această sumă',
  /** The legal text and the interpretation notes behind a figure or a field. */
  sources: 'Surse și note de interpretare',
  /** The machine-readable detail under a recovery banner (pre-existing, kept). */
  technicalDetails: 'Detalii tehnice',
  /** The per-record list under the money-precision banner (pre-existing, kept). */
  whichAmounts: 'Ce sume anume',
} as const;

/** The label of the reusable „Notă de interpretare" component (`src/components/ui/InterpretationNote.tsx`). */
export const noteLabel = 'Notă de interpretare' as const;

/** Field labels repeated across pages — one key, one wording. */
export const fields = {
  date: 'Data',
  status: 'Status',
  cui: 'CUI',
  documentNumber: 'Număr document',
  documentType: 'Tip document',
  amountWithoutVat: 'Valoare fără TVA',
  vatAmount: 'TVA',
  /**
   * TASK 10a. These two labels used to say `(RON)`. They cannot any more: a record now carries its own
   * currency, and a label asserting RON next to a currency selector would contradict the field under it.
   * The currency is its own visible field, and every amount on screen prints its own currency suffix.
   */
  currency: 'Moneda',
  statusDetail: 'Detaliu status',
  statusDetailPlaceholder: 'motivul respingerii…',
  amountPlaceholder: '0,00',
  cuiPlaceholder: 'RO…',
  city: 'Oraș',
  email: 'Email',
  phone: 'Telefon',
  name: 'Nume',
} as const;

/**
 * Validation messages. Each is one sentence that says what is missing and, where it matters, what
 * the app did instead (nothing was saved, nothing was invented).
 */
export const validation = {
  dateRequired: 'Data este obligatorie',
  documentNumberRequired: 'Numărul documentului este obligatoriu',
  clientRequired: 'Clientul este obligatoriu',
  providerRequired: 'Furnizorul este obligatoriu',
  nameRequired: 'Denumirea este obligatorie',
  cuiRequired: 'CUI/CNP este obligatoriu',
  periodRequired: 'Perioada este obligatorie',
  declarationTypeRequired: 'Tipul declarației este obligatoriu',
  amountInvalid: 'Introduceți o valoare validă',
  vatInvalid: 'Introduceți un TVA valid',
  yearInvalid: 'An invalid (2000–2100).',
  leiInvalid: 'Valoare invalidă (lei, ≥ 0).',
  monthsInvalid: 'Luni invalide: numere întregi 1-12, separate prin virgulă (ex: 3,4).',
  nameNotEmpty: 'Numele nu poate fi gol',
  bankNameRequired: 'Introdu denumirea băncii',
  salaryAmountNeededForSixSm:
    'Venitul brut anual din salarii este necesar pentru pragul de 6 salarii minime.',
  regimeNotComputable: 'Regimul salvat nu poate fi calculat; alege un regim valabil pentru un PFA.',
  checkForm: 'Verifică datele din formular',
} as const;

/** Empty states — the honest sentence for "there is nothing here", never a fabricated one. */
export const empty = {
  noSearchResults: 'Niciun rezultat pentru căutare.',
  records: (n: number): string => `${n} ${n === 1 ? 'înregistrare' : 'înregistrări'}`,
} as const;

/**
 * The eight destinations in the sidebar. `App.tsx` used to spell these twice — once in `NAV`, once in
 * `TITLES` — which is how a rename ends up half-applied. One key now feeds both the link and the
 * page title.
 */
export const nav = {
  dashboard: 'Panou de control',
  revenues: 'Venituri',
  expenses: 'Cheltuieli',
  'e-factura': 'e-Factura',
  declarations: 'Declarații',
  documents: 'Documente',
  clients: 'Clienți',
  settings: 'Setări',
} as const;

/** The chrome around the pages: the brand, the mobile drawer, and the two storage banners. */
export const shell = {
  brand: 'SOLO',
  closeMenu: 'Închide meniul',
  menu: 'Meniu',
  /** The stored payload failed to parse and was quarantined. */
  quarantineTitle: 'Datele salvate nu au putut fi citite.',
  savedCopy: (when: string): string => `Copia salvată: ${when}`,
  /** D-3: a migration rewrote the stored data on load, and that has to be announced. */
  migrationToast: (steps: string): string => `Datele salvate au fost aduse la zi (${steps})`,
  migrationStepsFallback: 'format nou',
} as const;
