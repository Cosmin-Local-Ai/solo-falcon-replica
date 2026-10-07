import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AppData, Client, CompanyDocument, Declaration, DocTypeCode, DocumentItem,
  Expense, Revenue, SettingsState, TaxStatement, Toast, ToastKind,
} from './types';
import type { PfaProfile } from '../domain/models';
import type { TaxCalculationSnapshot } from '../domain/snapshots/types';
import { todayISO } from './types';
import { epochMs, isoCalendarDateProblemText, toInstantISO } from '../domain/date';
import { seedData } from './seed';
import { parseAppDataResult, validateRecordDates, type PersistedAppData, type RecordKind } from './schema';
import {
  CURRENT_DATA_VERSION,
  UnsupportedDataVersionError,
  migratePersistedData,
} from './migration';
import {
  quarantineKey,
  quarantinePayload,
  readQuarantine,
  type QuarantineReason,
  type QuarantineRecord,
} from './quarantine';

/**
 * The one storage key for the dataset. It does NOT change across versions —
 * D-2 versions the payload inside this key rather than moving to a new key, so
 * an existing install is upgraded in place instead of orphaned.
 * Exported so tests and the recovery UI read the same constant the store writes.
 */
export const STORAGE_KEY = 'pfa-app-data-v2';
/** Where rejected payloads are preserved (D-3). Never written by the save path. */
export const QUARANTINE_STORAGE_KEY = quarantineKey(STORAGE_KEY);

/**
 * Where the initial dataset came from.
 * - 'seed': storage was empty, so the app started from seed data.
 * - 'persisted': a valid stored dataset was loaded — at the current version, or
 *   upgraded in place by the migration chain. Either way it is the user's own
 *   data, so it stays one value (decision D-3b): the Phase 6 safety net asserts
 *   that a legacy payload yields 'persisted', and splitting that into
 *   'persisted'/'migrated' would weaken the very check that proves the app did
 *   not fall back to seed. Whether a migration ran is reported separately, on
 *   `StoreValue.migration`.
 * - 'quarantined': the stored payload was rejected. It was copied to
 *   `QUARANTINE_STORAGE_KEY` first, and the app fell back to seed data. This is
 *   the state the banner must show — B-11 was exactly this case being silent.
 * Store-level only — never part of the persisted `AppData` shape.
 */
export type DataOrigin = 'seed' | 'persisted' | 'quarantined';

export interface MigrationInfo {
  fromVersion: number;
  toVersion: number;
  stepsApplied: string[];
}

interface LoadedData {
  data: AppData;
  dataOrigin: DataOrigin;
  migration: MigrationInfo | null;
  quarantine: QuarantineRecord | null;
}

interface StoreValue extends AppData {
  toasts: Toast[];
  /** 'seed' when the app started from seed data, 'persisted' for a stored
   *  payload (current-version or migrated), 'quarantined' when the stored
   *  payload was rejected and preserved. */
  dataOrigin: DataOrigin;
  /** The version the loaded dataset carries after the migration chain ran. */
  dataVersion: number;
  /** Set when the migration chain actually changed something. */
  migration: MigrationInfo | null;
  /** Set when a payload was rejected; carries the preserved copy (D-3). */
  quarantine: QuarantineRecord | null;
  /** Re-read the preserved copy (it survives saves and reloads). */
  getQuarantinedPayload: () => string | null;
  addRevenue: (r: Omit<Revenue, 'id'>) => boolean;
  updateRevenue: (r: Revenue) => boolean;
  deleteRevenue: (id: string) => void;
  addExpense: (e: Omit<Expense, 'id'>) => boolean;
  updateExpense: (e: Expense) => boolean;
  deleteExpense: (id: string) => void;
  addClient: (c: Omit<Client, 'id'>) => void;
  updateClient: (c: Client) => void;
  addDeclaration: (d: Omit<Declaration, 'id'>) => boolean;
  updateDeclaration: (d: Declaration) => boolean;
  sendDeclaration: (id: string) => void;
  uploadDocument: (code: DocTypeCode, doc: Omit<CompanyDocument, 'id'>) => boolean;
  deleteDocument: (code: DocTypeCode, id: string) => void;
  addStatement: (s: Omit<TaxStatement, 'id'>) => boolean;
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

/** Turn a validated (and migrated) persisted payload into the runtime `AppData`. */
function toAppData(parsed: PersistedAppData): AppData {
  return {
    profile: parsed.profile as PfaProfile,
    revenues: parsed.revenues,
    expenses: parsed.expenses ?? [],
    clients: parsed.clients ?? [],
    declarations: parsed.declarations ?? [],
    documents: parsed.documents ?? [],
    companyDocs: parsed.companyDocs ?? { im: [], cs: [], tva: [], facturi: [] },
    statements: parsed.statements ?? [],
    snapshots: parsed.snapshots ?? [],
    settings: parsed.settings,
    // B-26: the migration report rides along with the data it describes. The save effect spreads this
    // object back into localStorage, so carrying it here is what keeps it alive past the first write.
    // Left `undefined` when absent so the key is not written at all for healthy data.
    moneyNotices: parsed.moneyNotices?.length ? parsed.moneyNotices : undefined,
  };
}

function rejected(
  raw: string | null,
  reason: QuarantineReason,
  detail: string,
): LoadedData {
  // Preserve first, recover second: the bytes must be in the quarantine key
  // before anything can overwrite the data key.
  const { record } = quarantinePayload(QUARANTINE_STORAGE_KEY, raw, reason, detail);
  return {
    data: seedData,
    // If the quarantine copy itself could not be written there is nothing to
    // tell the user they can recover — report the honest state instead.
    dataOrigin: record ? 'quarantined' : 'seed',
    migration: null,
    quarantine: record,
  };
}

function loadInitial(): LoadedData {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    // Reading threw (storage blocked): there is no payload to preserve, so the
    // quarantine record will usually be null and the app just starts from seed.
    return rejected(null, 'storage-read-error', err instanceof Error ? err.message : String(err));
  }
  if (!raw) {
    return { data: seedData, dataOrigin: 'seed', migration: null, quarantine: null };
  }

  const parsed = parseAppDataResult(raw);
  if (!parsed.ok) {
    return rejected(raw, parsed.reason, parsed.detail);
  }

  try {
    const outcome = migratePersistedData(parsed.data);
    return {
      data: toAppData(outcome.data),
      dataOrigin: 'persisted',
      migration: outcome.migrated
        ? { fromVersion: outcome.fromVersion, toVersion: outcome.toVersion, stepsApplied: outcome.stepsApplied }
        : null,
      quarantine: null,
    };
  } catch (err) {
    if (err instanceof UnsupportedDataVersionError) {
      return rejected(raw, 'unsupported-version', err.message);
    }
    // A migration step threw: never load a half-migrated dataset and never
    // silently reset. Preserve the payload and start from seed, visibly.
    return rejected(raw, 'schema-invalid', `migration failed: ${err instanceof Error ? err.message : String(err)}`);
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
      // The version is stamped at write time, not carried in `AppData`: that is
      // what guarantees a payload always declares the version this build
      // understands, even after a mutation, so the chain never has to guess.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, version: CURRENT_DATA_VERSION }));
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

  /**
   * B-21: a malformed calendar date used to be accepted here and then silently deleted the
   * record from every aggregate (`domain/aggregation.ts` `inPeriod`). The write path now
   * refuses it and names the record, the field and the offending value. Returns true when the
   * write was refused; the actions return it so a caller (and a test) can see the rejection.
   */
  const rejectInvalidDates = useCallback(
    (kind: RecordKind, record: Parameters<typeof validateRecordDates>[1], label: string, id?: string): boolean => {
      const violations = validateRecordDates(kind, record);
      for (const v of violations) {
        const shown = v.value === '' ? 'necompletat' : v.value;
        toast(
          'error',
          `${label}${id ? ` ${id}` : ''} — câmpul „${v.label}” conține „${shown}”: ` +
            `${isoCalendarDateProblemText(v.reason)}. Data trebuie să fie o dată calendaristică reală; ` +
            `înregistrarea nu a fost salvată.`,
        );
      }
      return violations.length > 0;
    },
    [toast],
  );

  const value: StoreValue = {
    ...data,
    toasts,
    dataOrigin,
    dataVersion: CURRENT_DATA_VERSION,
    migration: initial.migration,
    quarantine: initial.quarantine,
    getQuarantinedPayload: () => readQuarantine(QUARANTINE_STORAGE_KEY)?.raw ?? null,
    toast,
    dismissToast,

    addRevenue: r => {
      if (rejectInvalidDates('revenue', r, 'Venit')) return false;
      setData(d => ({ ...d, revenues: [{ ...r, id: uid() }, ...d.revenues] }));
      return true;
    },
    updateRevenue: r => {
      if (rejectInvalidDates('revenue', r, 'Venit', r.id)) return false;
      setData(d => ({ ...d, revenues: d.revenues.map(x => x.id === r.id ? r : x) }));
      return true;
    },
    deleteRevenue: id => setData(d => ({ ...d, revenues: d.revenues.filter(x => x.id !== id) })),

    addExpense: e => {
      if (rejectInvalidDates('expense', e, 'Cheltuială')) return false;
      setData(d => ({ ...d, expenses: [{ ...e, id: uid() }, ...d.expenses] }));
      return true;
    },
    updateExpense: e => {
      if (rejectInvalidDates('expense', e, 'Cheltuială', e.id)) return false;
      setData(d => ({ ...d, expenses: d.expenses.map(x => x.id === e.id ? e : x) }));
      return true;
    },
    deleteExpense: id => setData(d => ({ ...d, expenses: d.expenses.filter(x => x.id !== id) })),

    addClient: c => setData(d => ({ ...d, clients: [...d.clients, { ...c, id: uid() }] })),
    updateClient: c => setData(d => ({ ...d, clients: d.clients.map(x => x.id === c.id ? c : x) })),

    addDeclaration: decl => {
      if (rejectInvalidDates('declaration', decl, 'Declarație')) return false;
      setData(d => ({ ...d, declarations: [{ ...decl, id: uid() }, ...d.declarations] }));
      return true;
    },
    updateDeclaration: d => {
      if (rejectInvalidDates('declaration', d, 'Declarație', d.id)) return false;
      setData(prev => ({ ...prev, declarations: prev.declarations.map(x => x.id === d.id ? d : x) }));
      return true;
    },
    sendDeclaration: id => setData(d => ({
      ...d,
      declarations: d.declarations.map(x =>
        x.id === id ? { ...x, status: 'transmisa', dataTrimitere: todayISO() } : x
      ),
    })),

    uploadDocument: (code, doc) => {
      if (rejectInvalidDates('companyDocument', doc, 'Document')) return false;
      setData(d => ({
        ...d,
        companyDocs: {
          ...d.companyDocs,
          [code]: [{ ...doc, id: uid() }, ...d.companyDocs[code]],
        },
      }));
      return true;
    },
    deleteDocument: (code, id) => setData(d => ({
      ...d,
      companyDocs: { ...d.companyDocs, [code]: d.companyDocs[code].filter(x => x.id !== id) },
    })),

    addStatement: s => {
      if (rejectInvalidDates('statement', s, 'Declarație fiscală')) return false;
      setData(d => ({ ...d, statements: [{ ...s, id: uid() }, ...d.statements] }));
      return true;
    },
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
