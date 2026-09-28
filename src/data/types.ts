export type RevenueStatus = 'inregistrata' | 'in-asteptare' | 'respinsa';
export type ExpenseStatus = 'inregistrata' | 'respinsa';
export type DeclStatus = 'inregistrata' | 'in-asteptare' | 'transmisa' | 'respinsa';

export interface Revenue {
  id: string;
  tip: 'factura' | 'notafactura';
  nr: string;
  date: string; // ISO
  client: string;
  cui: string;
  valoareFaraTva: number;
  tva: number;
  status: RevenueStatus;
  statusDetail?: string;
  eFacturaStatus?: string;
}
export interface Expense {
  id: string;
  tip: 'factura' | 'bon-fiscal';
  nr: string;
  date: string;
  furnizor: string;
  cui: string;
  valoareFaraTva: number;
  tva: number;
  status: ExpenseStatus;
  statusDetail?: string;
}
export interface Client {
  id: string;
  denumire: string;
  cui: string;
  email?: string;
  telefon?: string;
  oras?: string;
}
export interface Declaration {
  id: string;
  an: number;
  luna: number;
  venituri: number;
  cheltuieli: number;
  status: DeclStatus;
  dataInregistrare: string;
  dataTrimitere?: string;
}
export interface Document {
  id: string;
  nume: string;
  tip: 'pdf' | 'jpg' | 'xlsx';
  marime: string;
  data: string;
  categoria: string;
}
export interface Toast { id: number; kind: 'success' | 'error' | 'info'; text: string; }

export const fmtRON = (n: number) =>
  new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', minimumFractionDigits: 2 }).format(n);
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const total = (v: { valoareFaraTva: number; tva: number }) => v.valoareFaraTva + v.tva;

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
export const statusBadge = (s: string): string =>
  s === 'inregistrata' || s === 'transmisa' ? 'badge-success'
  : s === 'in-asteptare' ? 'badge-warning'
  : s === 'respinsa' ? 'badge-danger' : 'badge-neutral';
