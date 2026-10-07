import type { PfaProfile } from '../domain/models';
import type { TaxCalculationSnapshot } from '../domain/snapshots/types';
import { localDateISO, now } from '../domain/date';
import { addBani, maxBani, subBani, type Bani, sumBani } from '../domain/money';

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
export const REV_STATUS_LABEL: Record<RevenueStatus, string> = {
  inregistrata: 'Înregistrată',
  'in-asteptare': 'În așteptare',
  respinsa: 'Respinsă',
};

export const EXP_STATUS_LABEL: Record<ExpenseStatus, string> = {
  inregistrata: 'Înregistrată',
  respinsa: 'Respinsă',
};

export const DECL_STATUS_LABEL: Record<DeclStatus, string> = {
  inregistrata: 'Înregistrată',
  'in-asteptare': 'În așteptare',
  transmisa: 'Transmisa',
  respinsa: 'Respinsă',
};

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
export interface DocSection {
  code: DocTypeCode;
  title: string;
  desc: string;
  icon: string;
  allowMultiple: boolean;
  helper: string;
}

export const DOC_SECTIONS: DocSection[] = [
  { code: 'im', title: 'Impozit pe venit (IM)', desc: 'Declarația 100 / impozit pe venit', icon: '📋', allowMultiple: false, helper: 'Un fișier pe perioadă (PDF).' },
  { code: 'cs', title: 'Contribuții sociale (CS)', desc: 'Declarația 220 / contribuții sociale', icon: '🏥', allowMultiple: false, helper: 'Un fișier pe perioadă (PDF).' },
  { code: 'tva', title: 'TVA', desc: 'Declarația 300 / TVA', icon: '🧾', allowMultiple: false, helper: 'Un fișier pe perioadă (PDF).' },
  { code: 'facturi', title: 'Facturi și documente', desc: 'Facturi, note fără factură, bonuri fiscale', icon: '📄', allowMultiple: true, helper: 'Poți adăuga mai multe fișiere.' },
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
