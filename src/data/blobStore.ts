/**
 * PG-11 (phase 29) — the seam between the app and wherever document bytes live.
 *
 * ## Why this file exists
 *
 * Document bytes used to be base64 data-URL strings carried **inside the record**, and the record travels
 * through `localStorage`. That gives the app a hard, invisible ceiling of roughly a hundred documents,
 * because the whole dataset — every document included — is serialized as one string on every save.
 *
 * The fix is to stop carrying the bytes in the record. But the only browser store large enough for this
 * (IndexedDB) is **asynchronous**, and the migration chain is **entirely synchronous** — every step in
 * `data/migration.ts` is a pure `apply(data) => data`, with not one `async` or `Promise` in the file. So
 * bytes cannot be moved by a chain step, and they cannot be moved by anything that assumes a synchronous
 * store either.
 *
 * This module is what makes both halves true at once: everything in the app talks to the **interface**,
 * and exactly one implementation — `data/blobStore.idb.ts` — is coupled to a browser API.
 *
 * ## Why there is no dependency here
 *
 * `package.json` carries no IndexedDB package, and **jsdom does not implement IndexedDB**. So the unit
 * suite runs against `createMemoryBlobStore()` below. That is a deliberate double, not a simulation of
 * IndexedDB: it proves the app's contract with a store, not the store's behaviour. What remains unproven
 * is recorded in `docs/ai/phases/54_pg11_persistence_export_import.md`.
 *
 * ## What a blob id is
 *
 * A blob id is derived from the record that owns it, never generated. `doc:facturi:f1` is the bytes of
 * document `f1` in the `facturi` section. Deriving it means a relocation is idempotent — running it twice
 * writes the same key with the same bytes rather than minting a second copy — and it means an orphan can
 * be traced back to the record that used to point at it.
 *
 * ## Retention
 *
 * `deleteBlob` is called from **explicit delete only**. There is no expiry, no garbage collection on a
 * timer, and no sweep of orphans. `pages/Documents.tsx` records that the taxpayer's copy of one *fișă*
 * exists only because a retention obligation has to be producible in order to be kept at all; a blob that
 * disappears on a schedule is a document that disappears. Orphans are **reported** — see
 * `findOrphanBlobIds` — and never removed on the app's own initiative.
 */
import type { CompanyDocument, DocTypeCode, TaxStatement } from './types';

/** The contract the app writes against. Every method is async: the real store is. */
export interface BlobStore {
  /** The bytes stored under `id`, or `null` when nothing is stored there. */
  getBlob(id: string): Promise<string | null>;
  /** Store `bytes` under `id`. MUST reject if the bytes are not durably stored — the caller relies on
   *  a resolved promise meaning "confirmed", because it drops the inline copy on that strength alone. */
  putBlob(id: string, bytes: string): Promise<void>;
  /** Reclaim `id`. Explicit delete only; nothing else may call this. */
  deleteBlob(id: string): Promise<void>;
  hasBlob(id: string): Promise<boolean>;
  /** Every id currently held. Needed to report orphans; not needed to move or delete anything. */
  listBlobIds(): Promise<string[]>;
}

// ── blob ids ────────────────────────────────────────────────────────────────

/** Prefix for a company document's blob. A section code is part of the id because the same record id is
 *  not unique across the four document sections. */
export const DOC_BLOB_PREFIX = 'doc';
/** Prefix for a filed tax statement's blob. */
export const STATEMENT_BLOB_PREFIX = 'statement';

export function documentBlobId(code: DocTypeCode, id: string): string {
  return `${DOC_BLOB_PREFIX}:${code}:${id}`;
}

export function statementBlobId(id: string): string {
  return `${STATEMENT_BLOB_PREFIX}:${id}`;
}

// ── the in-memory double ────────────────────────────────────────────────────

export interface MemoryBlobStore extends BlobStore {
  /** A copy of what the double holds, for tests that assert bytes rather than counts. */
  snapshot(): Record<string, string>;
  /** Make the next `putBlob` reject — the failure path the relocation and import tests depend on. */
  failNextPut(reason?: string): void;
  /** Make **every** following `putBlob` reject: the whole-store failure — a full quota, a denied permission. */
  failPuts(reason?: string): void;
  /** Make the next `getBlob` reject or return null. */
  failNextGet(reason?: string): void;
}

/**
 * The test double, and the only blob store the unit suite ever sees.
 *
 * It is exported from production code rather than from `src/test/` because the store and the pages reach
 * it through the same seam they reach the real one — a double that lives somewhere the app cannot import
 * would leave the "which store is live" question answered in two places.
 */
export function createMemoryBlobStore(initial: Record<string, string> = {}): MemoryBlobStore {
  const map = new Map<string, string>(Object.entries(initial));
  let putFailure: string | null = null;
  let stickyPutFailure: string | null = null;
  let getFailure: string | null | undefined;

  return {
    async getBlob(id) {
      if (getFailure !== undefined) {
        const reason = getFailure;
        getFailure = undefined;
        if (reason !== null) throw new Error(reason);
        return null;
      }
      return map.has(id) ? map.get(id)! : null;
    },
    async putBlob(id, bytes) {
      // Sticky first: a full quota or a denied permission does not heal after one attempt, and a test that
      // wants "the store is unusable" must not have to re-arm it between every record.
      if (stickyPutFailure !== null) throw new Error(stickyPutFailure);
      if (putFailure !== null) {
        const reason = putFailure;
        putFailure = null;
        throw new Error(reason);
      }
      map.set(id, bytes);
    },
    async deleteBlob(id) {
      map.delete(id);
    },
    async hasBlob(id) {
      return map.has(id);
    },
    async listBlobIds() {
      return [...map.keys()];
    },
    snapshot() {
      return Object.fromEntries(map.entries());
    },
    failNextPut(reason = 'blob write failed') {
      putFailure = reason;
    },
    failPuts(reason = 'blob write failed') {
      stickyPutFailure = reason;
    },
    failNextGet(reason = 'blob read failed') {
      getFailure = reason;
    },
  };
}

// ── which store is live ─────────────────────────────────────────────────────

/**
 * The store the app is currently using, or `null` when there is none.
 *
 * `null` is a real state and the app must stay correct in it: records keep their inline bytes, relocation
 * does not run, and the person is told the larger store is unavailable. It is NOT treated as "no
 * documents" and it is never a reason to drop anything.
 */
let activeStore: BlobStore | null = null;

export function setBlobStore(store: BlobStore | null): void {
  activeStore = store;
}

export function getBlobStore(): BlobStore | null {
  return activeStore;
}

/**
 * Whether this runtime has IndexedDB at all.
 *
 * Reading the global rather than calling into it is deliberate: jsdom defines no `indexedDB`, so this is
 * the one place the browser coupling is tested for, and everything below it stays out of the unit path.
 */
export function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

/**
 * Connect the browser store, if this runtime has one.
 *
 * The IndexedDB module is imported **dynamically and only behind the `hasIndexedDB()` guard**, so a jsdom
 * run never evaluates it. That is what keeps `data/blobStore.idb.ts` the only browser-coupled piece: it is
 * not merely isolated by convention, it is not reachable in the environment that cannot exercise it.
 *
 * Resolves `null` when there is no IndexedDB or when opening it fails — a blocked or private-mode browser,
 * a denied permission, an upgrade the user refused. The caller reports that; it does not retry and it does
 * not fall back to a store that would silently lose bytes on reload.
 */
export async function connectDefaultBlobStore(): Promise<BlobStore | null> {
  if (activeStore) return activeStore;
  if (!hasIndexedDB()) return null;
  try {
    const mod = await import('./blobStore.idb');
    const store = await mod.openIdbBlobStore();
    activeStore = store;
    return store;
  } catch {
    return null;
  }
}

// ── reading bytes back for a record ─────────────────────────────────────────

/** The two record kinds that can carry document bytes. */
export type BlobBearer =
  | { kind: 'document'; code: DocTypeCode; record: CompanyDocument }
  | { kind: 'statement'; record: TaxStatement };

/** The blob id a record's bytes would live under, or `null` for a record that has no bytes at all. */
export function blobIdFor(bearer: BlobBearer): string | null {
  if (bearer.record.blobRef) return bearer.record.blobRef;
  if (bearer.kind === 'document') return documentBlobId(bearer.code, bearer.record.id);
  return statementBlobId(bearer.record.id);
}

/**
 * Resolve the bytes for a record: the inline copy if it still has one, otherwise the blob.
 *
 * Returns `null` when neither exists — which is the honest answer for a record whose blob could not be
 * read, and the caller must say so rather than hand the person an empty download.
 */
export async function resolveBlobContent(bearer: BlobBearer, store: BlobStore | null): Promise<string | null> {
  const inline = bearer.record.content;
  if (inline) return inline;
  if (!bearer.record.blobRef || !store) return null;
  try {
    return await store.getBlob(bearer.record.blobRef);
  } catch {
    return null;
  }
}
