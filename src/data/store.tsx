import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AppData, Client, CompanyDocument, Declaration, DocTypeCode, DocumentItem,
  Expense, Revenue, SettingsState, TaxStatement, Toast, ToastKind,
} from './types';
import { todayISO } from './types';
import { seedData } from './seed';

const STORAGE_KEY = 'pfa-app-data-v2';

interface StoreValue extends AppData {
  toasts: Toast[];
  addRevenue: (r: Omit<Revenue, 'id'>) => void;
  updateRevenue: (r: Revenue) => void;
  deleteRevenue: (id: string) => void;
  addExpense: (e: Omit<Expense, 'id'>) => void;
  updateExpense: (e: Expense) => void;
  deleteExpense: (id: string) => void;
  addClient: (c: Omit<Client, 'id'>) => void;
  addDeclaration: (d: Omit<Declaration, 'id'>) => void;
  sendDeclaration: (id: string) => void;
  uploadDocument: (code: DocTypeCode, doc: Omit<CompanyDocument, 'id'>) => void;
  deleteDocument: (code: DocTypeCode, id: string) => void;
  addStatement: (s: Omit<TaxStatement, 'id'>) => void;
  deleteStatement: (id: string) => void;
  updateSettings: (patch: Partial<SettingsState> | ((current: SettingsState) => SettingsState)) => void;
  toast: (kind: ToastKind, text: string) => void;
  dismissToast: (id: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

let counter = 0;
const uid = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

function loadInitial(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed && Array.isArray(parsed.revenues) && parsed.settings) return parsed;
    }
  } catch {
    // ignore corrupt storage
  }
  return seedData;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadInitial);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
    toast,
    dismissToast,

    addRevenue: r => setData(d => ({ ...d, revenues: [{ ...r, id: uid() }, ...d.revenues] })),
    updateRevenue: r => setData(d => ({ ...d, revenues: d.revenues.map(x => x.id === r.id ? r : x) })),
    deleteRevenue: id => setData(d => ({ ...d, revenues: d.revenues.filter(x => x.id !== id) })),

    addExpense: e => setData(d => ({ ...d, expenses: [{ ...e, id: uid() }, ...d.expenses] })),
    updateExpense: e => setData(d => ({ ...d, expenses: d.expenses.map(x => x.id === e.id ? e : x) })),
    deleteExpense: id => setData(d => ({ ...d, expenses: d.expenses.filter(x => x.id !== id) })),

    addClient: c => setData(d => ({ ...d, clients: [...d.clients, { ...c, id: uid() }] })),

    addDeclaration: decl => setData(d => ({ ...d, declarations: [{ ...decl, id: uid() }, ...d.declarations] })),
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
