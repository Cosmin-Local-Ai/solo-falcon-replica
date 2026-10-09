import type { PfaProfile } from '../domain/models';
import type { ExpenseCategory } from '../domain/fiscal/deductibility';
import type { TaxCalculationSnapshot } from '../domain/snapshots/types';
import type { MoneyPrecisionNotice } from './migration';
import { localDateISO, now } from '../domain/date';
import { maxBani, subBani, type Bani, sumBani } from '../domain/money';

// ── Venituri ──────────────────────────────────────────────
export type RevenueStatus = 'inregistrata' | 'in-asteptare' | 'respinsa';
export type EFacturaStatus = 'Acceptată' | 'În așteptare' | 'Respinsă';

export interface Revenue {
  id: string;
  tip: 'factura' | 'notafactura';
  nr: string;
  date: string;
  /**
   * The date the amount was actually **collected** — the date that attributes this revenue to a
   * fiscal year. CF art. 68 alin. (2) lit. a) measures venit brut by „sumele încasate" (amounts
   * collected), so collection is the fiscally load-bearing date.
   *
   * Optional by design: a payload written before Phase 9 recorded a single `date`, and that date is
   * read as the fiscal date (`domain/aggregation.ts` `revenueFiscalDate`). The v2→v3 migration
   * deliberately does **not** invent a collection event. The invoice issue date is not a timing gate.
   */
  collected?: string;
  client: string;
  cui: string;
  /** Integer **bani** (Phase 10). A persisted lei value became bani through the `money-bani` migration step. */
  valoareFaraTva: Bani;
  tva: Bani;
  status: RevenueStatus;
  statusDetail?: string;
  eFacturaStatus?: EFacturaStatus;
}

// ── Cheltuieli ────────────────────────────────────────────
export type ExpenseStatus = 'inregistrata' | 'respinsa';

export interface Expense {
  id: string;
  tip: 'factura' | 'bon-fiscal';
  nr: string;
  date: string;
  /**
   * The date the expense was actually **paid** — the date that attributes it to a fiscal year.
   * CF art. 68 alin. (4) lit. b) requires expenses be „cuprinse în cheltuielile exercițiului
   * financiar al anului în cursul căruia au fost plătite", i.e. the year of PAYMENT. The consequence
   * is attribution, not punishment: a late-paid expense is not disallowed, it falls into the payment year.
   *
   * Optional by design; never invented by a migration. Art. 68 alin. (4) lit. a) only requires the
   * expense be „justificate prin documente" — the invoice is the justificativ, its issue date is not a gate.
   */
  paid?: string;
  furnizor: string;
  cui: string;
  /** Integer **bani** (Phase 10). */
  valoareFaraTva: Bani;
  tva: Bani;
  status: ExpenseStatus;
  statusDetail?: string;
  /**
   * TASK 2b — the token the deductibility classifier reads (`domain/fiscal/deductibility.ts`, CF art. 68).
   *
   * **Optional by design, and never invented by a migration.** Absence is legal input, not a defect: an
   * uncategorised expense classifies as `undetermined`, is EXCLUDED from the deductible total, and is
   * surfaced as a count with one action. That is the safe target for data written before this field
   * existed — the v5→v6 step widens the schema and backfills nothing, exactly as `paid` (v2→v3) and
   * `vatExceedanceDate` (v3→v4) did.
   *
   * The vocabulary is `EXPENSE_CATEGORIES`. A token outside it is not deductible by silence:
   * `classifyExpenseDeductibility` answers `undetermined` with `rule: null`, because art. 68 alin. (7)
   * lit. l) is an open clause and an uncited category may never be treated as deductible.
   */
  category?: ExpenseCategory;
}

// ── Clienți ───────────────────────────────────────────────
export interface Client {
  id: string;
  denumire: string;
  cui: string;
  email?: string;
  telefon?: string;
  oras?: string;
}

// ── Declarații ────────────────────────────────────────────
export type DeclStatus = 'inregistrata' | 'in-asteptare' | 'transmisa' | 'respinsa';

export interface Declaration {
  id: string;
  an: number;
  luna: number;
  /** Integer **bani** (Phase 10). */
  venituri: Bani;
  cheltuieli: Bani;
  status: DeclStatus;
  dataInregistrare: string;
  dataTrimitere?: string;
}

// ── Documente (dashboard) ─────────────────────────────────
export interface DocumentItem {
  id: string;
  nume: string;
  data: string;
  categoria: string;
}

// ── Documente ale firmei ──────────────────────────────────
export type DocTypeCode = 'im' | 'cs' | 'tva' | 'facturi';

export interface CompanyDocument {
  id: string;
  nume: string;
  tip: 'factura' | 'notafactura' | 'bon-fiscal' | 'pdf' | 'png' | 'jpg';
  content: string;
  marime: number;
  data: string;
  dataDepunere?: string;
  depunere?: string;
  perioada?: string;
}

// ── Declarații fiscale depuse ────────────────────────────
export interface TaxStatement {
  id: string;
  tip: string;
  perioada: string;
  depunere: 'SOLO' | 'personală';
  dataDepunere?: string;
  nume?: string;
  content?: string;
}

// ── Setări ────────────────────────────────────────────────
export interface CompanyCaen {
  cod: string;
  descriere: string;
}

export interface BankAccount {
  id: string;
  banca: string;
  moneda: string;
}

export interface SettingsState {
  cotaTva: number;
  company: {
    denumire: string;
    cui: string;
    numarRegComert: string;
    adresa: string;
    codTvaIntra?: string;
    caen: CompanyCaen[];
    mentiuniFactura?: string;
    cnp?: string;
    formaJuridica?: string;
    codFiscal?: string;
    codCAEN?: string;
    regComerț?: string;
    telefon?: string;
    email?: string;
    contBancar?: string;
    banca?: string;
  };
  personal: {
    nume: string;
    cnp: string;
    adresa: string;
    telefon: string;
    email: string;
  };
  bankAccounts: BankAccount[];
  eFactura: {
    trimitere: 'manual' | 'automat';
    dateContact: string;
  };
}

// ── Toasts ────────────────────────────────────────────────
export type ToastKind = 'success' | 'info' | 'error';

export interface Toast {
  id: string;
  kind: ToastKind;
  text: string;
}

// ── App data ──────────────────────────────────────────────
export interface AppData {
  profile: PfaProfile;
  revenues: Revenue[];
  expenses: Expense[];
  clients: Client[];
  declarations: Declaration[];
  documents: DocumentItem[];
  companyDocs: Record<DocTypeCode, CompanyDocument[]>;
  statements: TaxStatement[];
  snapshots: TaxCalculationSnapshot[];
  settings: SettingsState;
  /**
   * TASK 3: the cash the user has actually set aside for this year's taxes, in integer **bani**.
   *
   * Tri-state, and the two empty states are NOT the same fact:
   * - `null` — **no reserve recorded**. The user has never entered an amount; it renders as
   *   „Nicio sumă înregistrată”, never as `0,00 lei`;
   * - `0` — an explicit, real fact: the user recorded that they have set aside nothing.
   *
   * Required on the runtime object (never `undefined`) so a consumer cannot mistake „absent from an
   * old payload” for a fourth state: the load path normalises an absent stored field to `null`, and
   * the migration chain backfills nothing — the v6→v7 step invents no money.
   *
   * Strictly DOWNSTREAM of the estimate: nothing in the tax calculation may read this field.
   */
  reservedAmount: Bani | null;
  /**
   * Phase 10 (B-26): the report the `money-bani` step produced when a stored value could not be
   * reproduced exactly as an integer number of bani. It lives on the **loaded dataset**, not only on the
   * migration result, because the save effect spreads this object back into localStorage — a report that
   * lived only in the migration result was erased by the first write after a load, which is the
   * "surface, not vanish" rule failing silently. `undefined` means "nothing had to be decided", and
   * `JSON.stringify` drops the key rather than writing an empty array.
   */
  moneyNotices?: MoneyPrecisionNotice[];
}

// ── Formatare ─────────────────────────────────────────────
// Money formatting lives in exactly one place: `src/domain/money.ts` (`formatBani*`).
// There is deliberately no formatter here — a second `Intl` instance is what let the B-17
// half-cent disagreement happen (round-half-even here vs round-half-up in `toFixed`).

export const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

/**
 * Phase 10: money is an integer number of bani, so a record total is an exact integer sum —
 * `sumBani` throws rather than let a float accumulate here (`aggregation.ts` was the float origin).
 */
export const total = (r: Revenue | Expense) => sumBani([r.valoareFaraTva, r.tva]);

/**
 * Sum of record totals for a list of records.
 *
 * This lives here rather than in a `rows.reduce(...)` inside a component: accumulating money in the view
 * layer is how float drift reappears, and `reduce((s, e) => s + total(e), 0)` also drops the `Bani` brand
 * and starts from an unbranded `0`. `sumBani` rejects a non-integer instead of absorbing one.
 */
export const sumTotals = (rows: readonly (Revenue | Expense)[]): Bani => sumBani(rows.map(total));

/**
 * Declared net for one month, floored at zero — the figure the declarations table shows.
 *
 * A named function so the subtraction and the floor are domain arithmetic on `Bani` (`subBani`/`maxBani`
 * keep the brand; `Math.max(0, a - b)` in JSX would not).
 */
export const declarationNet = (d: Pick<Declaration, 'venituri' | 'cheltuieli'>): Bani =>
  maxBani(subBani(d.venituri, d.cheltuieli), 0 as Bani);

// ── Statusuri ─────────────────────────────────────────────
// The Romanian words for these statuses used to be spelled three times here — `REV_STATUS_LABEL`,
// `EXP_STATUS_LABEL`, `DECL_STATUS_LABEL` — with 'Înregistrată' and 'Respinsă' identical in all three.
// They are gone: `copy.recordStatus.revenueLabels / expenseLabels / declarationLabels` is the one place,
// and the status codes stay here as data only. `statusBadge` below keeps the code→colour mapping,
// which is presentation logic, not language.

export type BadgeKind = 'badge-neutral' | 'badge-info' | 'badge-success' | 'badge-warning' | 'badge-danger';

export const statusBadge = (status: string): BadgeKind => {
  switch (status) {
    case 'in-asteptare': return 'badge-warning';
    case 'respinsa': return 'badge-danger';
    case 'transmisa': return 'badge-success';
    case 'inregistrata': return 'badge-neutral';
    default: return 'badge-neutral';
  }
};

// ── Secțiuni documente ────────────────────────────────────
/**
 * A document section is a code, an icon and whether it takes several files. The Romanian words that
 * name a section are not here — they live in `copy.documents.sections`, keyed by the same code. This
 * file is the data shape; it used to carry the labels too, which put UI wording below the data layer
 * where no language test could reach it.
 */
export interface DocSection {
  code: DocTypeCode;
  icon: string;
  allowMultiple: boolean;
}

export const DOC_SECTIONS: DocSection[] = [
  { code: 'im', icon: '📋', allowMultiple: false },
  { code: 'cs', icon: '🏥', allowMultiple: false },
  { code: 'tva', icon: '🧾', allowMultiple: false },
  { code: 'facturi', icon: '📄', allowMultiple: true },
];

export const DOC_SECTION_MAP: Record<DocTypeCode, DocSection> = Object.fromEntries(
  DOC_SECTIONS.map(s => [s.code, s])
) as Record<DocTypeCode, DocSection>;

// ── Utilitare fișiere ─────────────────────────────────────
export const MAX_DOC_BYTES = 5 * 1024 * 1024;

export const docTipFromName = (name: string): CompanyDocument['tip'] => {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'pdf';
  if (n.endsWith('.png')) return 'png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'jpg';
  if (n.includes('bon')) return 'bon-fiscal';
  if (n.includes('nota')) return 'notafactura';
  return 'factura';
};

export const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

export const todayISO = (instant: Date = now()) => localDateISO(instant);

export const downloadDataUrl = (content: string, name: string) => {
  const a = document.createElement('a');
  a.href = content;
  a.download = name;
  a.click();
};

export const downloadText = (text: string, name: string) => {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};
