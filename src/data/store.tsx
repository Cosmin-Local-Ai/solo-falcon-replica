import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Revenue, Expense, Client, Declaration, Document, Toast } from './types';
import { seedRevenues, seedExpenses, seedClients, seedDeclarations, seedDocuments } from './seed';

interface Store {
  revenues: Revenue[];
  expenses: Expense[];
  clients: Client[];
  declarations: Declaration[];
  documents: Document[];
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
  addDocument: (d: Omit<Document, 'id'>) => void;
  deleteDocument: (id: string) => void;
  toast: (kind: Toast['kind'], text: string) => void;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<Store | null>(null);
const uid = () => Math.random().toString(36).slice(2, 10);

// --- localStorage persistence (survives refresh) ---
const STORAGE_KEY = 'solo-replica-data-v1';

interface PersistedData {
  revenues: Revenue[];
  expenses: Expense[];
  clients: Client[];
  declarations: Declaration[];
  documents: Document[];
}

function loadPersisted(): PersistedData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (
      p &&
      Array.isArray(p.revenues) &&
      Array.isArray(p.expenses) &&
      Array.isArray(p.clients) &&
      Array.isArray(p.declarations) &&
      Array.isArray(p.documents)
    ) {
      return p as PersistedData;
    }
  } catch {
    /* corrupt storage — fall back to seed */
  }
  return null;
}

const persisted = loadPersisted();

export function StoreProvider({ children }: { children: ReactNode }) {
  const [revenues, setRevenues] = useState<Revenue[]>(persisted?.revenues ?? seedRevenues);
  const [expenses, setExpenses] = useState<Expense[]>(persisted?.expenses ?? seedExpenses);
  const [clients, setClients] = useState<Client[]>(persisted?.clients ?? seedClients);
  const [declarations, setDeclarations] = useState<Declaration[]>(persisted?.declarations ?? seedDeclarations);
  const [documents, setDocuments] = useState<Document[]>(persisted?.documents ?? seedDocuments);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const dismissToast = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);
  const toast = useCallback((kind: Toast['kind'], text: string) => {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, kind, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);

  // Persist every collection change to localStorage.
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ revenues, expenses, clients, declarations, documents })
      );
    } catch {
      /* storage unavailable (private mode etc.) — app still works in-memory */
    }
  }, [revenues, expenses, clients, declarations, documents]);

  const value = useMemo<Store>(() => ({
    revenues, expenses, clients, declarations, documents, toasts,
    addRevenue: r => setRevenues(s => [{ ...r, id: uid() }, ...s]),
    updateRevenue: r => setRevenues(s => s.map(x => (x.id === r.id ? r : x))),
    deleteRevenue: id => setRevenues(s => s.filter(x => x.id !== id)),
    addExpense: e => setExpenses(s => [{ ...e, id: uid() }, ...s]),
    updateExpense: e => setExpenses(s => s.map(x => (x.id === e.id ? e : x))),
    deleteExpense: id => setExpenses(s => s.filter(x => x.id !== id)),
    addClient: c => setClients(s => [...s, { ...c, id: uid() }]),
    addDeclaration: d => setDeclarations(s => [{ ...d, id: uid() }, ...s]),
    sendDeclaration: id => setDeclarations(s => s.map(x =>
      x.id === id ? { ...x, status: 'transmisa' as const, dataTrimitere: new Date().toISOString().slice(0, 10) } : x)),
    addDocument: d => setDocuments(s => [{ ...d, id: uid() }, ...s]),
    deleteDocument: id => setDocuments(s => s.filter(x => x.id !== id)),
    toast, dismissToast,
  }), [revenues, expenses, clients, declarations, documents, toasts, toast, dismissToast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore outside StoreProvider');
  return ctx;
}
