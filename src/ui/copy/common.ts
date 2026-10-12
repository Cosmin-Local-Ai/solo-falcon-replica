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

/**
 * B-51 — the scope statement. One sentence, one key, two surfaces.
 *
 * Until now nothing in user-facing copy said what these figures are and are not: a grep for
 * `consultan`, `nu constituie`, `informativ` across `src/ui/copy/` and `src/pages/` returned one hit, and
 * it was a code comment. That silence sits on top of a claimable-VAT total that is filed nowhere
 * (D-VAT-3), a Form 300 rubric drawn with lines deliberately left without values (B-98), and figures the
 * corpus records as INFERRED or CORROBORATED rather than FACT.
 *
 * Four things the sentence has to say, and nothing else:
 *  - the figures are **estimates computed from what the person entered** — they are not measurements;
 *  - **nothing is filed or transmitted from here** — stated as a negative, because B-56 is open and some
 *    success messages already claim operations that do not happen; this sentence must not add another;
 *  - it is **not a substitute for a consultant or for the ANAF window**, and a figure can be wrong because
 *    the law moves during the year;
 *  - it must **not undersell the arithmetic**: the legal bases are displayed and the calculations are
 *    tested, and that is the app's whole value. A disclaimer that reads as "this is a toy" is its own
 *    defect, so the sentence says what the work rests on before it says what it does not replace.
 *
 * Deliberately absent: no product self-reference (no „software", no „program"), no English calque, no
 * hedge repeated beside individual figures. It is keyed here, in the shared half of the layer, because it
 * is one statement read from two places — Onboarding, where expectations are set, and Settings → Date,
 * where it can be found again after the first run. A third copy of the string would be the drift the
 * duplicate-sentence test in `copy.guard.test.ts` exists to stop.
 */
export const scope = {
  title: 'Estimări, nu declarații',
  statement:
    'Cifrele de aici sunt estimări: le calculăm din ce ai introdus și din regulile anului fiscal '
    + 'respectiv. Nimic nu se depune și nimic nu se trimite la ANAF din acest cont — declarația o depui '
    + 'tu, la ghișeu sau în SPV. Un consultant fiscal și ANAF pot ajunge la o altă cifră, iar o cifră de '
    + 'aici poate fi greșită pentru că legea se schimbă în timpul anului. Temeiurile legale ale '
    + 'calculelor sunt afișate, iar calculele sunt testate; totuși ele nu înlocuiesc consultanța fiscală.',
} as const;

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
  // PG-6h-2 — the room count is a count, not an amount. A fraction or a negative is not a number of rooms,
  // and letting a non-number through would silently read as "unanswered" instead of an error on screen.
  roomsInvalid: 'Număr invalid de camere: număr întreg, ≥ 0.',
  // PG-6e — a declared *durată normală de funcționare* is a count of months, not a month-of-year list and
  // not an amount. Reusing `monthsInvalid` would tell the reader to write „3,4”.
  monthsCountInvalid: 'Număr invalid de luni: număr întreg, ≥ 1.',
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
  // PG-6e (B-31, D-FA-1): the fixed-asset register. Its own page rather than a tab under Cheltuieli,
  // because a capital purchase is not an expense (art. 68 alin. (7) lit. h)), and folding the register in
  // there would invite exactly that reading.
  assets: 'Mijloace fixe',
  clients: 'Clienți',
  settings: 'Setări',
} as const;

/** The chrome around the pages: the brand, the mobile drawer, and the storage banners. */
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
  /**
   * Phase 11 — the sandbox has to be marked where it is seen, not only where it was switched on. The
   * words say what it is (example data), what it is not (your data), and how it leaves (reload, or the
   * control in Setări). A demo that is not labelled is the D1 defect with a nicer layout.
   */
  sandboxTitle: 'Datele de exemplu sunt încărcate.',
  sandboxBody:
    'Ce vezi mai jos este un sandbox cu date de exemplu, nu datele tale. Nu se salvează și dispar la reîncărcare.',
  sandboxRemove: 'Elimină sandboxul',
  /** Where the topbar would otherwise print an empty name: an empty profile has no name to show. */
  noProfile: 'Profil incomplet',
} as const;
