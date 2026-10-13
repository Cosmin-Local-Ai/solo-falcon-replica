import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AnnualFiling, AppData, Client, CompanyDocument, DocTypeCode, DocumentItem,
  Expense, OccupancySheet, OccupancyStay, Revenue, SettingsState, TaxStatement, Toast, ToastKind,
  Vehicle, FixedAsset, VatReturnRecord,
} from './types';
import type { VehicleYearFacts } from '../domain/fiscal/deductibility';
import type { PfaProfile } from '../domain/models';
import type { TaxCalculationSnapshot } from '../domain/snapshots/types';
import { epochMs, isoCalendarDateProblemText, toInstantISO, now } from '../domain/date';
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
import {
  applyRelocation,
  countInlineBlobBearers,
  findOrphanBlobIds,
  relocateInlineBlobs,
  referencedBlobIds,
  type RelocationFailure,
} from './blobRelocation';
import { connectDefaultBlobStore, getBlobStore, hasIndexedDB } from './blobStore';
import { buildDatasetExport, type DatasetExportResult } from './datasetExport';
import { validateDatasetImport } from './datasetImport';

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

/**
 * PG-11 (phase 29) — a write to storage that did not happen.
 *
 * Before this phase the save effect answered a failed `setItem` with `console.warn` and moved on. That is
 * the defect the brief names: the app can lose the user's most recent work — a quota failure, a blocked or
 * private-mode store, a browser that refuses the write — and say nothing at all. The in-memory state stays
 * usable, the screen keeps showing the record that was just typed, and the bytes on disk are the ones from
 * before it. On reload, the work is gone and nothing ever claimed otherwise to the person.
 *
 * The state is structured, not a sentence: the fact lives here, the wording lives in `ui/copy`, and
 * `App.tsx` renders it. That is the same one-producer rule the deadline labels follow.
 */
export interface SaveFailure {
  /** Instant the failed write was attempted, from the domain's clock seam. */
  at: string;
  /** The storage error's own message — shown under the banner's technical disclosure, never as the banner. */
  message: string;
  /** How many writes in a row have failed. A retry that fails again must not look like the first one. */
  attempts: number;
}

/**
 * Whether this runtime has a store for document bytes.
 *
 * `'unavailable'` is a state the app stays correct in: records keep their bytes inline, the ceiling stays
 * where it was, and the person is told. It is never treated as "no documents", and it never becomes a
 * reason to drop anything.
 */
export type BlobStoreStatus = 'unknown' | 'connected' | 'unavailable';

/** What the relocation pass did after load. `failed` records keep their inline bytes. */
export interface BlobRelocationSummary {
  moved: number;
  failed: RelocationFailure[];
}

/** A blob that could not be reclaimed when its document was deleted. Reported; never retried silently. */
export interface BlobReclaimFailure {
  blobId: string;
  label: string;
  reason: string;
}

export type DatasetImportOutcome =
  | {
      status: 'imported';
      fromVersion: number;
      toVersion: number;
      stepsApplied: string[];
      /** Document bytes moved out of the file and into the blob store. */
      blobsStored: number;
      /** Bytes that stayed inline in the dataset because the blob write failed. */
      blobFailures: RelocationFailure[];
      /** When the backup declared it was produced. Never inferred. */
      exportedAt: string | null;
    }
  | { status: 'rejected'; reason: QuarantineReason; detail: string; quarantined: boolean };

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
  /**
   * PG-11 — non-null while the last write to storage failed. The banner in `App.tsx` renders it; the fact
   * is produced here, in one place. Cleared by the next write that succeeds.
   */
  saveFailure: SaveFailure | null;
  /** PG-11 — try the last write again, without changing any data. */
  retrySave: () => void;
  /** PG-11 — whether document bytes have somewhere larger than `localStorage` to live. */
  blobStoreStatus: BlobStoreStatus;
  /** PG-11 — what the relocation pass did after load, once it has run. */
  blobRelocation: BlobRelocationSummary | null;
  /** PG-11 — blobs that could not be reclaimed after their document was deleted. */
  blobReclaimFailures: BlobReclaimFailure[];
  /**
   * PG-11 — build a complete, restorable backup: the whole dataset verbatim, version included, with the
   * document bytes read back out of the blob store and embedded.
   *
   * Refuses rather than emitting a partial file: a backup with a silently missing document is a corrupt
   * backup, which is worse than no backup because the person now believes they are safe.
   */
  exportDataset: () => Promise<DatasetExportResult>;
  /**
   * PG-11 — restore a backup. Validates the whole payload, and runs an older `version` through the existing
   * migration chain, **before** anything is written. On failure nothing changes and the payload goes to
   * quarantine under the D-3 contract.
   *
   * This is not the document upload path and shares no code with it: one adds a file to a record, the other
   * replaces the person's whole world.
   */
  importDataset: (raw: string) => Promise<DatasetImportOutcome>;
  /**
   * PG-11 — blobs no record points at. **Reported, never removed**: an orphan is usually a crash between
   * "blob written" and "dataset saved", and these are retained documents.
   */
  orphanBlobIds: () => Promise<string[]>;
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
   * PG-5b removed the monthly record type itself: the store has no monthly collection to read.
   */
  addFiling: (f: Omit<AnnualFiling, 'id'>) => boolean;
  updateFiling: (f: AnnualFiling) => boolean;
  /**
   * PG-6g — the periodic VAT return (formular 300, OPANAF 174/2026).
   *
   * A separate collection with its own status vocabulary, deliberately not `addFiling` under another form:
   * a decont is keyed by a fiscal period rather than by the year it declares, and only `depusa` says one
   * was filed. `deleteVatReturn` exists because a mis-recorded filing must be retractable — leaving it
   * would mean a typo could permanently mark a legal term discharged.
   */
  addVatReturn: (r: Omit<VatReturnRecord, 'id'>) => boolean;
  updateVatReturn: (r: VatReturnRecord) => boolean;
  deleteVatReturn: (id: string) => void;
  uploadDocument: (code: DocTypeCode, doc: Omit<CompanyDocument, 'id'>) => boolean;
  deleteDocument: (code: DocTypeCode, id: string) => void;
  addStatement: (s: Omit<TaxStatement, 'id'>) => boolean;
  deleteStatement: (id: string) => void;
  /**
   * PG-6h-3 (D-OCC-1) — the occupancy sheet, OPANAF 381/2026.
   *
   * Four writes and no more. There is deliberately **no update path for a sheet's identity fields and no
   * bulk import**: every additional write path over third-party personal data is another place a guest
   * name or CNP can be written wrongly or swept somewhere it should not go, and none of them is needed to
   * complete or to keep a sheet. A sheet is made, filled with stays, and deleted.
   *
   * `deleteOccupancySheet` is the acceptance-5 path: it removes the record from the dataset the save
   * effect writes, so the bytes in localStorage stop containing it. It is not a view filter.
   */
  addOccupancySheet: (s: Omit<OccupancySheet, 'id'>) => boolean;
  deleteOccupancySheet: (id: string) => void;
  addOccupancyStay: (sheetId: string, stay: Omit<OccupancyStay, 'id'>) => boolean;
  deleteOccupancyStay: (sheetId: string, stayId: string) => void;
  /**
   * PG-6c (D-VEH-3) — the vehicle entity and its per-year declared facts.
   *
   * Three writes, and what is deliberately absent from them: there is **no write path that sets a default
   * for any fact**, no path that copies facts from one year to another, and no path that attributes an
   * expense to a car on the app's own initiative. Every one of those would mint a legal fact: `usedByPerson`
   * decides whether a car is inside art. 68 alin. (5) lit. j) at all, and `designatedForRunningCosts`
   * decides which car the single allowance follows — a choice `docs/ai/research/40_vehicle_one_car_limit.md`
   * §1 records that no primary source makes for us.
   *
   * `deleteVehicle` leaves any expense still pointing at the id in place. Repairing that link silently
   * would attribute a cost to a car by accident; the expense becomes unattributed and is reported.
   */
  addVehicle: (v: Omit<Vehicle, 'id'>) => boolean;
  deleteVehicle: (id: string) => void;
  /** Replace ONE year's facts for one vehicle without disturbing the other years. */
  setVehicleYearFacts: (vehicleId: string, facts: VehicleYearFacts) => void;
  /**
   * PG-6e (B-31, D-FA-1) — the fixed-asset register.
   *
   * Three writes. What is deliberately absent: **no write path defaults any fact.** An asset arrives with
   * whatever the person declared and nothing more, because every one of those facts is a legal assertion —
   * a defaulted *punerea în funcțiune* picks the year depreciation starts in, a defaulted duration picks
   * both the cota and the pct. 27 disposal ceiling, and a defaulted alin. (21) election picks between two
   * branches pct. 31 says are chosen at entry into the patrimony and cannot be flipped afterwards.
   *
   * `updateFixedAsset` patches only the keys it is handed, so clearing a fact back to „never asked” is
   * possible and is not the same as leaving it alone.
   */
  addFixedAsset: (a: Omit<FixedAsset, 'id'>) => boolean;
  deleteFixedAsset: (id: string) => void;
  updateFixedAsset: (id: string, patch: Partial<Omit<FixedAsset, 'id'>>) => void;
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
    // PG-5: the annual returns. Absent defaults to empty rather than to anything derived — an absent
    // `filings` key means nobody recorded a filing, which is a fact about the data, not a filing that
    // did not happen. PG-5b: the monthly rows a pre-v11 payload carried do not reach here at all; the
    // v10→v11 step drops them.
    filings: parsed.filings ?? [],
    // PG-6g: the periodic VAT returns. Absent resolves to empty here and nowhere else — the v18→v19 step
    // opens the collection, and an absent key on an older payload means „no decont was ever recorded”,
    // which is a fact about the data and not a decont that was not filed.
    vatReturns: parsed.vatReturns ?? [],
    // PG-6h-3: the occupancy sheets. Absent resolves to empty here and nowhere else — the v13→v14 step
    // deliberately leaves the key off, because „no sheet has been made” and „sheets were made and none
    // exist” are different claims about the taxpayer's own documents.
    occupancySheets: parsed.occupancySheets ?? [],
    // PG-6c (D-VEH-3): the vehicles. Absent resolves to empty here and nowhere else — the v14→v15 step
    // leaves the key off, because „no vehicle has been declared” and „vehicles were declared and none
    // exist” are different claims, and an empty register is what keeps a `vehicle_related` expense on the
    // statutory 50 % default instead of making it unattributable.
    vehicles: parsed.vehicles ?? [],
    // PG-6e (B-31, D-FA-1): the fixed-asset register. Absent resolves to empty here and nowhere else — the
    // v16→v17 step leaves the key off, because „no asset has ever been declared” and „assets were declared
    // and none exist” are different claims.
    fixedAssets: parsed.fixedAssets ?? [],
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

  // ── PG-11: the save path's own failure state ──────────────────────────────────────────────────────
  // A ref mirrors the state so the save effect can decide "first failure or another one" without reading
  // state captured at render time, and without a setState on every successful write.
  const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null);
  const saveFailureRef = useRef<SaveFailure | null>(null);
  // Bumped by `retrySave`: the effect keys on `data`, and a retry changes no data, so without this the
  // person would have to edit a record to ask the app to try writing again.
  const [saveNonce, setSaveNonce] = useState(0);

  // ── PG-11: document bytes ─────────────────────────────────────────────────────────────────────────
  // The initial value is decided synchronously: a runtime with no `indexedDB` global never had a chance of
  // connecting, so saying so at once is both honest and free — it keeps an asynchronous `setState` out of
  // every render of the store in environments that cannot have a blob store (which is every jsdom test).
  const [blobStoreStatus, setBlobStoreStatus] = useState<BlobStoreStatus>(() =>
    hasIndexedDB() ? 'unknown' : 'unavailable',
  );
  const [blobRelocation, setBlobRelocation] = useState<BlobRelocationSummary | null>(null);
  const [blobReclaimFailures, setBlobReclaimFailures] = useState<BlobReclaimFailure[]>([]);
  // The dataset as it is right now, for the asynchronous paths that cannot close over a render's value.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const relocationStarted = useRef(false);

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
      if (saveFailureRef.current) {
        // A write that succeeds ends the failure state: the banner must not outlive the problem.
        saveFailureRef.current = null;
        setSaveFailure(null);
      }
    } catch (err) {
      // Controlled write failure (e.g. storage quota exceeded, setItem throwing): the in-memory state stays
      // usable and the next mutation retries the write. What must NOT happen — and was the whole of this
      // branch before PG-11 — is the failure staying inside `console.warn`, where only a developer sees it.
      // The person has just been told nothing while their most recent work sits unwritten.
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[store] failed to persist app data to localStorage', err);
      const failure: SaveFailure = {
        at: toInstantISO(now()),
        message,
        attempts: (saveFailureRef.current?.attempts ?? 0) + 1,
      };
      saveFailureRef.current = failure;
      setSaveFailure(failure);
    }
  }, [data, dataOrigin, saveNonce]);

  const retrySave = useCallback(() => setSaveNonce(n => n + 1), []);

  useEffect(() => {
    // PG-11 — connect the blob store, then move any inline bytes, **after load and outside the migration
    // chain**. The chain is synchronous end to end; the store is not, so no step in it can do this.
    //
    // The order inside `relocateInlineBlobs` is the data safety: write, confirm, only then drop the inline
    // copy. A rejected write leaves that document's bytes exactly where they were.
    let cancelled = false;
    // A runtime with no `indexedDB` global and no store handed to the seam has nothing to connect to, so it
    // returns here rather than resolving a promise to say so. The status was already decided synchronously
    // at `useState`; this also keeps an asynchronous `setState` out of every store render in an environment
    // that cannot have a blob store — which is every jsdom test that has not injected one.
    if (!hasIndexedDB() && !getBlobStore()) return;
    void (async () => {
      const store = await connectDefaultBlobStore();
      if (cancelled) return;
      if (!store) {
        setBlobStoreStatus('unavailable');
        return;
      }
      setBlobStoreStatus('connected');
      if (relocationStarted.current) return;
      // The demo fixture is a view, not the person's data: its documents must never be written into a store
      // that outlives the reload.
      if (initial.dataOrigin === 'sandbox') return;
      relocationStarted.current = true;
      const snapshot = dataRef.current;
      if (countInlineBlobBearers(snapshot) === 0) {
        setBlobRelocation({ moved: 0, failed: [] });
        return;
      }
      const result = await relocateInlineBlobs(snapshot, store);
      if (cancelled) return;
      setBlobRelocation({ moved: result.moved, failed: result.failed });
      // Not `result.data`: the person may have typed while these writes were in flight, and applying the
      // snapshot's shape over live state would drop what they entered. `applyRelocation` re-checks each
      // record's bytes against what was actually written before it drops them.
      const applied = applyRelocation(dataRef.current, result.relocated);
      if (applied !== dataRef.current) setData(applied);
    })();
    return () => {
      cancelled = true;
    };
    // Mount only. The dataset it reads is the one `loadInitial` produced; later changes are relocated by the
    // upload path itself, not by a re-run of this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * PG-11 — reclaim a document's bytes when the person deletes the document.
   *
   * **Explicit delete only.** No expiry, no sweep, no garbage collection on a timer: these are retained
   * documents, and `pages/Documents.tsx` records that one *fișă* exists only because a retention obligation
   * has to be producible in order to be kept at all. A failure here is recorded and surfaced, not retried
   * behind the person's back — an orphan is reported, never silently removed.
   */
  const reclaimBlob = useCallback((blobRef: string | undefined, label: string) => {
    if (!blobRef) return;
    const store = getBlobStore();
    if (!store) return;
    void store.deleteBlob(blobRef).catch(err => {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn('[store] blob reclaim failed after delete', blobRef, err);
      setBlobReclaimFailures(prev => [...prev, { blobId: blobRef, label, reason }]);
    });
  }, []);

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
    saveFailure,
    retrySave,
    blobStoreStatus,
    blobRelocation,
    blobReclaimFailures,
    exportDataset: () => buildDatasetExport(dataRef.current, getBlobStore(), now()),
    importDataset: async raw => {
      // Validate the whole payload before anything is written. Nothing below this line touches state until
      // the payload is known to be a dataset this build can hold.
      const validation = validateDatasetImport(raw);
      if (!validation.ok) {
        // The D-3 contract, reused rather than re-invented: the rejected bytes are preserved verbatim, the
        // first copy wins, and the app says so. The dataset already on screen is not touched.
        const { record } = quarantinePayload(
          QUARANTINE_STORAGE_KEY,
          raw,
          validation.reason,
          `import: ${validation.detail}`,
        );
        if (record) setQuarantine(record);
        return { status: 'rejected', reason: validation.reason, detail: validation.detail, quarantined: !!record };
      }

      const staged = toAppData(validation.data);
      // Split the bytes out **before** the dataset that will point at them is written: a record must never
      // be persisted with a reference to a blob that is not there yet. If a write fails, that document keeps
      // its bytes inline — the same rule the relocation pass follows, and the reason an import that cannot
      // reach the blob store still imports the person's documents rather than losing them.
      const store = getBlobStore();
      let blobsStored = 0;
      let blobFailures: RelocationFailure[] = [];
      let applied = staged;
      if (store) {
        const relocated = await relocateInlineBlobs(staged, store);
        applied = relocated.data;
        blobsStored = relocated.moved;
        blobFailures = relocated.failed;
      }
      // An import replaces what is on screen, so the sandbox view it may have been sitting on is over; the
      // pre-sandbox snapshot must not come back underneath the restored dataset.
      preSandbox.current = null;
      setData(applied);
      // An import is stored data from this moment on, whatever the origin was — including 'empty', where the
      // save effect deliberately does not write.
      setDataOrigin('persisted');
      return {
        status: 'imported',
        fromVersion: validation.fromVersion,
        toVersion: validation.toVersion,
        stepsApplied: validation.stepsApplied,
        blobsStored,
        blobFailures,
        exportedAt: validation.exportedAt,
      };
    },
    orphanBlobIds: async () => {
      const store = getBlobStore();
      if (!store) return [];
      // The render's `data`, not `dataRef.current`: a child component's effect runs before its parent's, so
      // the ref can still hold the pre-relocation dataset at the moment a surface asks this question — and a
      // freshly relocated blob would be reported as an orphan it is not.
      return findOrphanBlobIds(data, store);
    },
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

    addVatReturn: r => {
      if (rejectInvalidDates('vatReturn', r, 'Decontul periodic de TVA')) return false;
      setData(d => ({ ...d, vatReturns: [{ ...r, id: uid() }, ...d.vatReturns] }));
      return true;
    },
    updateVatReturn: r => {
      if (rejectInvalidDates('vatReturn', r, 'Decontul periodic de TVA', r.id)) return false;
      setData(prev => ({ ...prev, vatReturns: prev.vatReturns.map(x => (x.id === r.id ? r : x)) }));
      return true;
    },
    deleteVatReturn: id => setData(d => ({ ...d, vatReturns: d.vatReturns.filter(x => x.id !== id) })),

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
    deleteDocument: (code, id) => {
      const doomed = data.companyDocs[code]?.find(x => x.id === id);
      setData(d => ({
        ...d,
        companyDocs: { ...d.companyDocs, [code]: d.companyDocs[code].filter(x => x.id !== id) },
      }));
      reclaimBlob(doomed?.blobRef, doomed?.nume ?? id);
    },

    addStatement: s => {
      if (rejectInvalidDates('statement', s, 'Declarație fiscală')) return false;
      setData(d => ({ ...d, statements: [{ ...s, id: uid() }, ...d.statements] }));
      return true;
    },
    deleteStatement: id => {
      const doomed = data.statements.find(x => x.id === id);
      setData(d => ({ ...d, statements: d.statements.filter(x => x.id !== id) }));
      reclaimBlob(doomed?.blobRef, doomed?.nume ?? doomed?.tip ?? id);
    },

    // PG-6h-3 (D-OCC-1). The sheet is retained data about other people, so the write surface is small and
    // the delete is real: `filter` on the stored collection, which the save effect then writes back, so
    // the guest's name and identifier leave the persisted bytes rather than merely the screen. Nothing
    // here copies a sheet into a snapshot, a log, an export or a calculation operand — see
    // `src/data/occupancy.privacy.test.tsx`, which pins that.
    addOccupancySheet: s => {
      setData(d => ({ ...d, occupancySheets: [...d.occupancySheets, { ...s, id: uid() }] }));
      return true;
    },
    deleteOccupancySheet: id => setData(d => ({
      ...d,
      occupancySheets: d.occupancySheets.filter(x => x.id !== id),
    })),
    addOccupancyStay: (sheetId, stay) => {
      setData(d => ({
        ...d,
        occupancySheets: d.occupancySheets.map(x =>
          x.id === sheetId ? { ...x, stays: [...x.stays, { ...stay, id: uid() }] } : x,
        ),
      }));
      return true;
    },
    deleteOccupancyStay: (sheetId, stayId) => setData(d => ({
      ...d,
      occupancySheets: d.occupancySheets.map(x =>
        x.id === sheetId ? { ...x, stays: x.stays.filter(s => s.id !== stayId) } : x,
      ),
    })),
    // PG-6c (D-VEH-3). The write surface is deliberately the smallest one that can state the facts: a car
    // is added, one year's facts are replaced, and a car is deleted. Nothing here infers a fact, copies one
    // across years, or links an expense to a car — see the interface note above for why each of those is
    // a legal assertion rather than a convenience.
    addVehicle: v => {
      if (!v.label.trim()) return false;
      setData(d => ({ ...d, vehicles: [...d.vehicles, { ...v, id: uid() }] }));
      return true;
    },
    deleteVehicle: id => setData(d => ({ ...d, vehicles: d.vehicles.filter(x => x.id !== id) })),
    setVehicleYearFacts: (vehicleId, facts) => setData(d => ({
      ...d,
      vehicles: d.vehicles.map(x => {
        if (x.id !== vehicleId) return x;
        const others = x.years.filter(y => y.fiscalYear !== facts.fiscalYear);
        // An all-empty year is removed rather than stored as a row of blanks: „answered with nothing” and
        // „never answered” must not become two shapes of the same claim.
        const filled = Object.keys(facts).filter(k => k !== 'fiscalYear' && facts[k as keyof VehicleYearFacts] !== undefined);
        return { ...x, years: filled.length > 0 ? [...others, facts] : others };
      }),
    })),
    // PG-6e (B-31, D-FA-1). The fixed-asset register: added, corrected, deleted. No write path here
    // defaults a fact — see the interface note for why each one is a legal assertion. `updateFixedAsset`
    // patches only the keys it is handed, so putting a fact back to `undefined` is how a person clears an
    // answer given by mistake, and that is a different act from never having answered.
    addFixedAsset: a => {
      if (!a.label.trim()) return false;
      setData(d => ({ ...d, fixedAssets: [...d.fixedAssets, { ...a, id: uid() }] }));
      return true;
    },
    deleteFixedAsset: id => setData(d => ({ ...d, fixedAssets: d.fixedAssets.filter(x => x.id !== id) })),
    updateFixedAsset: (id, patch) => setData(d => ({
      ...d,
      fixedAssets: d.fixedAssets.map(x => (x.id === id ? { ...x, ...patch } : x)),
    })),
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
      // PG-11 — a wipe is an **explicit** delete of every record, including every document, and the
      // confirmation screen says so by name ("…documentele…"). Leaving the bytes behind in the browser while
      // the records that named them are gone would be the one case where "orphans are reported, not removed"
      // turns into "the person deleted their data and their scans stayed". This is not a sweep and not a
      // timer: it runs because the person asked for everything to go.
      const doomedBlobs = [...referencedBlobIds(dataRef.current)];
      const store = getBlobStore();
      if (store) {
        for (const blobId of doomedBlobs) {
          void store.deleteBlob(blobId).catch(err => {
            console.warn('[store] blob not cleared with the rest of the data', blobId, err);
          });
        }
      }
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
