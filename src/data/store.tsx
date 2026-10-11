import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AnnualFiling, AppData, Client, CompanyDocument, Declaration, DocTypeCode, DocumentItem,
  Expense, Revenue, SettingsState, TaxStatement, Toast, ToastKind,
} from './types';
import type { PfaProfile } from '../domain/models';
import type { TaxCalculationSnapshot } from '../domain/snapshots/types';
import { epochMs, isoCalendarDateProblemText, toInstantISO } from '../domain/date';
import { maxBani, type Bani } from '../domain/money';
import { rateKey } from '../domain/fx/provider';
import { validateRateRecord, type FxRateRecord } from '../domain/fx/rates';
import { emptyData, seedData } from './seed';
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
 * Where the dataset currently on screen came from.
 *
 * Phase 11 (D1, D-RUN-1) removed `'seed'` as a first-run state. Before it, an empty
 * storage key meant "start from `seedData`", and nothing in production code ever
 * branched on the literal `'seed'` — only `'quarantined'` rendered a banner — so a
 * fresh browser opened on four demo invoices and a name nobody typed, visibly
 * unlabelled. `'empty'` replaces it: an empty store is now an empty store.
 *
 * - `'empty'`: storage held nothing, so the app starts from `emptyData()` — no
 *   records, no name, no start date. This is the state that opens on onboarding.
 * - `'persisted'`: a valid stored dataset was loaded — at the current version, or
 *   upgraded in place by the migration chain. Either way it is the user's own
 *   data, so it stays one value (decision D-3b): the Phase 6 safety net asserts
 *   that a legacy payload yields 'persisted', and splitting that into
 *   'persisted'/'migrated' would weaken the very check that proves the app did
 *   not fall back to a fixture. Whether a migration ran is reported separately,
 *   on `StoreValue.migration`.
 * - `'quarantined'`: the stored payload was rejected. It was copied to
 *   `QUARANTINE_STORAGE_KEY` first, and the app fell back to an EMPTY dataset —
 *   not to a fixture. This is the state the banner must show; B-11 was exactly
 *   this case being silent.
 * - `'sandbox'`: the demo fixture is loaded on purpose, through the opt-in
 *   sandbox control. It is never written to storage and never survives a reload,
 *   which is what makes it removable and what keeps it from ever being the
 *   initial state. The banner is what marks it.
 * Store-level only — never part of the persisted `AppData` shape.
 */
export type DataOrigin = 'empty' | 'persisted' | 'quarantined' | 'sandbox';

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
  /** 'empty' when storage held nothing (first run), 'persisted' for a stored
   *  payload (current-version or migrated), 'quarantined' when the stored
   *  payload was rejected and preserved, 'sandbox' while the opt-in demo
   *  fixture is loaded in memory. */
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
  /**
   * PG-5: record an annual return. `addDeclaration` / `updateDeclaration` / `sendDeclaration` are gone
   * with them — the app no longer offers to mint monthly declaration rows, because it has no evidence
   * that a monthly return exists for this profile and no right to create records it cannot stand behind.
   * The monthly rows that already exist are preserved read-only as `legacyDeclarations`.
   */
  addFiling: (f: Omit<AnnualFiling, 'id'>) => boolean;
  updateFiling: (f: AnnualFiling) => boolean;
  uploadDocument: (code: DocTypeCode, doc: Omit<CompanyDocument, 'id'>) => boolean;
  deleteDocument: (code: DocTypeCode, id: string) => void;
  addStatement: (s: Omit<TaxStatement, 'id'>) => boolean;
  deleteStatement: (id: string) => void;
  addSnapshot: (s: TaxCalculationSnapshot) => void;
  getSnapshot: (id: string) => TaxCalculationSnapshot | undefined;
  updateProfile: (patch: Partial<PfaProfile>) => void;
  updateSettings: (patch: Partial<SettingsState> | ((current: SettingsState) => SettingsState)) => void;
  /**
   * TASK 3: record how much cash the user has actually set aside for taxes, in integer bani.
   * `null` records „no reserve recorded” (the tri-state, not a deletion of the field); `0` records an
   * explicit zero. A negative amount is clamped at 0 — a withdrawal below zero is not a fact.
   */
  setReservedAmount: (amount: Bani | null) => void;
  /**
   * TASK 10b — record or replace an FX rate, keyed by `rateKey` (currency, kind, date-or-year). This is
   * the provisional → final door: a final annual average replaces the provisional record that stands for
   * the same year, and every ceiling or ledger amount struck from it re-reads the store on the next
   * calculation. No network path is involved — a rate arrives here the same way a hand-typed one does,
   * through the store boundary the `FxRateProvider` reads.
   *
   * An unusable candidate is refused with its field-level problems and reported; it is never dropped
   * silently, because a rate that vanishes is indistinguishable from a rate that was never entered.
   */
  recordFxRate: (candidate: unknown) => { ok: true; record: FxRateRecord } | { ok: false; problems: string[] };
  /**
   * Phase 11 — load the demo fixture IN MEMORY. It is not written to storage, so a reload drops it and
   * the user's own data is exactly what it was. That is what makes the sandbox "removable" and "never the
   * initial state" without a second storage key and without a backup-and-restore dance that could lose
   * real records.
   */
  loadSandbox: () => void;
  /** Phase 11 — put the data that was on screen before the sandbox back, unchanged. */
  unloadSandbox: () => void;
  /** True while the demo fixture is what is on screen. */
  sandboxActive: boolean;
  /**
   * Phase 11 — "Șterge toate datele și începe de la zero". Clears the data key (and the preserved
   * quarantine copy, which is data too) and returns the store to the `'empty'` state, which is the state
   * that opens on onboarding. It does NOT fall back to the fixture: a reset that hands out demo records
   * is the defect this phase exists to close.
   */
  resetAllData: () => void;
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
    // PG-5: the annual returns, and the monthly rows the v10→v11 step preserved. Both default to empty
    // rather than to anything derived — an absent `filings` key means nobody recorded a filing, which is
    // a fact about the data, not a filing that did not happen.
    filings: parsed.filings ?? [],
    legacyDeclarations: parsed.legacyDeclarations ?? [],
    documents: parsed.documents ?? [],
    companyDocs: parsed.companyDocs ?? { im: [], cs: [], tva: [], facturi: [] },
    statements: parsed.statements ?? [],
    snapshots: parsed.snapshots ?? [],
    settings: parsed.settings,
    // TASK 3: an absent stored field becomes `null` — „no reserve recorded” — and never `0`.
    // The `tax-reserve` migration step backfills nothing, so this is the only place absence is
    // resolved, and it resolves it to the honest state rather than to an invented amount.
    reservedAmount: parsed.reservedAmount ?? null,
    // B-26: the migration report rides along with the data it describes. The save effect spreads this
    // object back into localStorage, so carrying it here is what keeps it alive past the first write.
    // Left `undefined` when absent so the key is not written at all for healthy data.
    moneyNotices: parsed.moneyNotices?.length ? parsed.moneyNotices : undefined,
    // TASK 10a: recorded FX rates ride along the same way. Left `undefined` when absent — an empty array
    // would be written back and would read as „rates were fetched and none existed”, which is a different
    // fact from „nothing has been recorded yet”. No migration step backfills this collection: a backfilled
    // rate would be a fabricated legal figure.
    fxRates: parsed.fxRates,
  };
}

/** Deep copy of a JSON-safe value, so the fixture is handed out without aliasing the module constant. */
function clone<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch (err) {
    // The value being copied is a module constant, so this cannot throw in practice; if it ever does,
    // handing back the original is strictly better than losing the sandbox.
    console.error('[store] could not copy the demo fixture; using it as-is', err);
    return value;
  }
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
    // Phase 11: a rejected payload falls back to an EMPTY dataset, not to the demo fixture. Handing a
    // user who just lost their data a screenful of someone else's invoices is the D1 failure again,
    // wearing a banner.
    data: emptyData(),
    // If the quarantine copy itself could not be written there is nothing to
    // tell the user they can recover — report the honest state instead.
    dataOrigin: record ? 'quarantined' : 'empty',
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
    // Phase 11 (D1, D-RUN-1): empty storage is empty storage. It used to mean "hand out `seedData`",
    // and because production code only ever branched on 'quarantined', nothing said so.
    return { data: emptyData(), dataOrigin: 'empty', migration: null, quarantine: null };
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
  const [dataOrigin, setDataOrigin] = useState<DataOrigin>(initial.dataOrigin);
  const [quarantine, setQuarantine] = useState<QuarantineRecord | null>(initial.quarantine);
  // What was on screen before the sandbox replaced it. A ref, not state: it is not rendered, and it must
  // survive every re-render of the sandbox without triggering one.
  const preSandbox = useRef<{ data: AppData; origin: DataOrigin } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    // Two states must never reach storage.
    //  - 'sandbox': the fixture is a view, not the user's data. Writing it would make the demo the
    //    persisted state and a reload would restore it — which is "never the initial state" failing.
    //  - 'empty': there is nothing recorded yet. Writing an empty shell would make the next load a
    //    'persisted' one and would drop the user out of onboarding before they had typed a name.
    if (dataOrigin === 'sandbox' || dataOrigin === 'empty') return;
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
  }, [data, dataOrigin]);

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
    quarantine,
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

    addFiling: f => {
      if (rejectInvalidDates('filing', f, 'Declarația unică')) return false;
      setData(d => ({ ...d, filings: [{ ...f, id: uid() }, ...d.filings] }));
      return true;
    },
    updateFiling: f => {
      if (rejectInvalidDates('filing', f, 'Declarația unică', f.id)) return false;
      setData(prev => ({ ...prev, filings: prev.filings.map(x => (x.id === f.id ? f : x)) }));
      return true;
    },

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

    // Phase 11: the first profile write ends the first-run state. Until now the store had nothing the
    // person entered, which is exactly what `'empty'` means; once it has, the origin is 'persisted' and
    // the save effect above starts writing.
    updateProfile: patch => {
      setData(d => ({
        ...d,
        profile: { ...d.profile, ...patch, updatedAt: toInstantISO() },
      }));
      if (dataOrigin === 'empty') setDataOrigin('persisted');
    },

    updateSettings: patch => setData(d => ({
      ...d,
      settings: typeof patch === 'function' ? patch(d.settings) : { ...d.settings, ...patch },
    })),

    // TASK 3: the reserve is a stored fact about the user's cash, so it lives on `AppData` and is
    // written through the same save effect as everything else. It is strictly downstream of the tax
    // estimate — nothing in the calculation path reads it back.
    setReservedAmount: amount => setData(d => ({
      ...d,
      reservedAmount: amount === null ? null : maxBani(amount, 0 as Bani),
    })),

    // TASK 10b (B-33). The provisional → final lifecycle needs a door, and the door is the store: the
    // rate layer refuses to invent a rate, so a rate only exists because it was recorded. `rateKey` is
    // the same key `RateStore.replace` and `loadDailyRates` use, so the store, the cache and the
    // persisted payload cannot hold two records for one (currency, kind, date-or-year).
    recordFxRate: candidate => {
      const checked = validateRateRecord(candidate);
      if (!checked.ok) {
        const problems = checked.problems.map(p => `${p.field}: ${p.message}`);
        toast('error', `Cursul de schimb nu a fost salvat — ${problems.join('; ')}. Cursul este o cifră legală: ` +
          'fără sursă, fără serie și fără data la care se ancorează, nu poate fi folosit la nicio conversie.');
        return { ok: false, problems };
      }
      const record = checked.record;
      const key = rateKey(record);
      setData(d => {
        const existing = d.fxRates ?? [];
        const next = existing.some(r => rateKey(r) === key)
          ? existing.map(r => (rateKey(r) === key ? record : r))
          : [...existing, record];
        return { ...d, fxRates: next };
      });
      return { ok: true, record };
    },

    loadSandbox: () => {
      if (dataOrigin === 'sandbox') return;
      preSandbox.current = { data, origin: dataOrigin };
      setData(clone(seedData));
      setDataOrigin('sandbox');
    },
    unloadSandbox: () => {
      const previous = preSandbox.current;
      if (!previous) return;
      preSandbox.current = null;
      setData(previous.data);
      setDataOrigin(previous.origin);
    },
    sandboxActive: dataOrigin === 'sandbox',
    resetAllData: () => {
      preSandbox.current = null;
      try {
        localStorage.removeItem(STORAGE_KEY);
        // The preserved copy of a rejected payload is data too, and "start from zero" says zero. The
        // confirmation screen names this explicitly before it is called.
        localStorage.removeItem(QUARANTINE_STORAGE_KEY);
      } catch (err) {
        console.error('[store] failed to clear app data from localStorage', err);
      }
      setQuarantine(null);
      setData(emptyData());
      setDataOrigin('empty');
    },
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
