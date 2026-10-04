import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AppData, Client, CompanyDocument, Declaration, DocTypeCode, DocumentItem,
  Expense, Revenue, SettingsState, TaxStatement, Toast, ToastKind,
} from './types';
import type { PfaProfile } from '../domain/models';
import type { TaxCalculationSnapshot } from '../domain/snapshots/types';
import { todayISO } from './types';
import { seedData } from './seed';
import { parseAppData } from './schema';
import { epochMs, localYear, now, toInstantISO } from '../domain/date';

const STORAGE_KEY = 'pfa-app-data-v2';

/**
 * Where the initial dataset came from.
 * - 'seed': storage was empty OR the stored payload failed validation and
 *   the app recovered to seed data.
 * - 'persisted': a valid stored dataset was loaded.
 * Store-level only — never part of the persisted `AppData` shape.
 */
export type DataOrigin = 'seed' | 'persisted';

interface LoadedData {
  data: AppData;
  dataOrigin: DataOrigin;
}

interface StoreValue extends AppData {
  toasts: Toast[];
  /** 'seed' when the app started from/recovered to seed data, 'persisted'
   *  when a valid stored dataset was loaded. */
  dataOrigin: DataOrigin;
  addRevenue: (r: Omit<Revenue, 'id'>) => void;
  updateRevenue: (r: Revenue) => void;
  deleteRevenue: (id: string) => void;
  addExpense: (e: Omit<Expense, 'id'>) => void;
  updateExpense: (e: Expense) => void;
  deleteExpense: (id: string) => void;
  addClient: (c: Omit<Client, 'id'>) => void;
  updateClient: (c: Client) => void;
  addDeclaration: (d: Omit<Declaration, 'id'>) => void;
  updateDeclaration: (d: Declaration) => void;
  sendDeclaration: (id: string) => void;
  uploadDocument: (code: DocTypeCode, doc: Omit<CompanyDocument, 'id'>) => void;
  deleteDocument: (code: DocTypeCode, id: string) => void;
  addStatement: (s: Omit<TaxStatement, 'id'>) => void;
  deleteStatement: (id: string) => void;
  addSnapshot: (s: TaxCalculationSnapshot) => void;
  getSnapshot: (id: string) => TaxCalculationSnapshot | undefined;
  updateProfile: (patch: Partial<PfaProfile>) => void;
  updateSettings: (patch: Partial<SettingsState> | ((current: SettingsState) => SettingsState)) => void;
  toast: (kind: ToastKind, text: string) => void;
  dismissToast: (id: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

let counter = 0;
const uid = () => `${epochMs().toString(36)}-${(counter++).toString(36)}`;

/**
 * Backfill a profile for data saved before the profile collection existed.
 * Identity/contact fields are carried over from the legacy settings so the
 * profile becomes the source of truth without losing user data.
 */
export function legacyProfileFromSettings(s: SettingsState, instant: Date = now()): PfaProfile {
  const c = s.company;
  const p = s.personal;
  return {
    id: 'profile-1',
    pfaStartYear: localYear(instant),
    fiscalYear: localYear(instant),
    regime: 'impozit_pe_venit',
    caen: c.caen?.[0]?.cod ?? c.codCAEN ?? '',
    salaryStatus: 'nu',
    pensionStatus: 'nu',
    otherIncome: [],
    socialInsuranceStatus: 'neplata',
    vatExempt: false,
    cashFloorLei: 0,
    identity: {
      nume: p.nume,
      cnp: p.cnp,
      adresa: p.adresa,
      telefon: p.telefon,
      email: p.email,
      denumire: c.denumire,
      cui: c.cui,
      formaJuridica: c.formaJuridica ?? '',
      numarRegComert: c.numarRegComert,
      adresaSocietate: c.adresa,
      telefonSocietate: c.telefon ?? '',
      emailSocietate: c.email ?? '',
      contBancar: c.contBancar ?? '',
      banca: c.banca ?? '',
    },
    updatedAt: toInstantISO(instant),
  };
}

function loadInitial(): LoadedData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { data: seedData, dataOrigin: 'seed' };
    }
    const parsed = parseAppData(raw);
    if (!parsed) {
      // Corrupt stored dataset (bad JSON, wrong types, invalid numbers,
      // missing required collections, invalid profile/settings/snapshots):
      // recover to seed data and let the save effect persist the clean state.
      return { data: seedData, dataOrigin: 'seed' };
    }
    return {
      data: {
        profile: parsed.profile ?? legacyProfileFromSettings(parsed.settings),
        revenues: parsed.revenues,
        expenses: parsed.expenses ?? [],
        clients: parsed.clients ?? [],
        declarations: parsed.declarations ?? [],
        documents: parsed.documents ?? [],
        companyDocs: parsed.companyDocs ?? { im: [], cs: [], tva: [], facturi: [] },
        statements: parsed.statements ?? [],
        snapshots: parsed.snapshots ?? [],
        settings: parsed.settings,
      },
      dataOrigin: 'persisted',
    };
  } catch {
    return { data: seedData, dataOrigin: 'seed' };
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadInitial);
  const [data, setData] = useState<AppData>(initial.data);
  const [dataOrigin] = useState<DataOrigin>(initial.dataOrigin);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      // Controlled write failure (e.g. storage quota exceeded, setItem
      // throwing): log and continue. The in-memory state stays usable and
      // the next mutation retries the write; no retry/backoff machinery.
      console.warn('[store] failed to persist app data to localStorage', err);
    }
  }, [data]);

  useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t)); }, []);

  const toast = useCallback((kind: ToastKind, text: string) => {
    const id = uid();
    setToasts(prev => [...prev, { id, kind, text }]);
    const t = window.setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== id));
    }, 3500);
    timers.current.push(t);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(x => x.id !== id));
  }, []);

  const value: StoreValue = {
    ...data,
    toasts,
    dataOrigin,
    toast,
    dismissToast,

    addRevenue: r => setData(d => ({ ...d, revenues: [{ ...r, id: uid() }, ...d.revenues] })),
    updateRevenue: r => setData(d => ({ ...d, revenues: d.revenues.map(x => x.id === r.id ? r : x) })),
    deleteRevenue: id => setData(d => ({ ...d, revenues: d.revenues.filter(x => x.id !== id) })),

    addExpense: e => setData(d => ({ ...d, expenses: [{ ...e, id: uid() }, ...d.expenses] })),
    updateExpense: e => setData(d => ({ ...d, expenses: d.expenses.map(x => x.id === e.id ? e : x) })),
    deleteExpense: id => setData(d => ({ ...d, expenses: d.expenses.filter(x => x.id !== id) })),

    addClient: c => setData(d => ({ ...d, clients: [...d.clients, { ...c, id: uid() }] })),
    updateClient: c => setData(d => ({ ...d, clients: d.clients.map(x => x.id === c.id ? c : x) })),

    addDeclaration: decl => setData(d => ({ ...d, declarations: [{ ...decl, id: uid() }, ...d.declarations] })),
    updateDeclaration: d => setData(prev => ({ ...prev, declarations: prev.declarations.map(x => x.id === d.id ? d : x) })),
    sendDeclaration: id => setData(d => ({
      ...d,
      declarations: d.declarations.map(x =>
        x.id === id ? { ...x, status: 'transmisa', dataTrimitere: todayISO() } : x
      ),
    })),

    uploadDocument: (code, doc) => setData(d => ({
      ...d,
      companyDocs: {
        ...d.companyDocs,
        [code]: [{ ...doc, id: uid() }, ...d.companyDocs[code]],
      },
    })),
    deleteDocument: (code, id) => setData(d => ({
      ...d,
      companyDocs: { ...d.companyDocs, [code]: d.companyDocs[code].filter(x => x.id !== id) },
    })),

    addStatement: s => setData(d => ({ ...d, statements: [{ ...s, id: uid() }, ...d.statements] })),
    deleteStatement: id => setData(d => ({ ...d, statements: d.statements.filter(x => x.id !== id) })),
    addSnapshot: s => setData(d => ({ ...d, snapshots: [...d.snapshots, s] })),
    getSnapshot: id => data.snapshots.find(x => x.calculationId === id),

    updateProfile: patch => setData(d => ({
      ...d,
      profile: { ...d.profile, ...patch, updatedAt: toInstantISO() },
    })),

    updateSettings: patch => setData(d => ({
      ...d,
      settings: typeof patch === 'function' ? patch(d.settings) : { ...d.settings, ...patch },
    })),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

const TOAST_STYLES: Record<ToastKind, { icon: string; border: string }> = {
  success: { icon: '✓', border: 'var(--green)' },
  info: { icon: 'ℹ', border: 'var(--blue)' },
  error: { icon: '✕', border: 'var(--red)' },
};

export function ToastHost() {
  const { toasts } = useStore();
  if (toasts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 1000 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `4px solid ${TOAST_STYLES[t.kind].border}`,
          borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, minWidth: 220,
        }}>
          <span style={{ color: TOAST_STYLES[t.kind].border, fontWeight: 700 }}>{TOAST_STYLES[t.kind].icon}</span>
          {t.text}
        </div>
      ))}
    </div>
  );
}
