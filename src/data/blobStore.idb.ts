/**
 * PG-11 (phase 29) — the IndexedDB implementation of the blob store.
 *
 * **This is the only browser-coupled file in the persistence layer.** It is imported dynamically, from
 * `data/blobStore.ts`, behind a `hasIndexedDB()` guard — so a jsdom run never evaluates it, and nothing
 * under test depends on it. That is not tidiness: jsdom does not implement IndexedDB, so any static
 * coupling here would put untestable code in the path of every persistence test.
 *
 * ## What is stored
 *
 * The bytes are stored **verbatim as the data-URL string** the upload path produced
 * (`FileReader.readAsDataURL` in `pages/Documents.tsx`). Not decoded, not re-encoded. Two consumers read
 * that exact shape today — `downloadDataUrl` sets it on `a.href`, and the image preview sets it on
 * `<img src>` — and a round trip that changed the encoding would be a round trip that lost the document.
 *
 * ## Why a single object store
 *
 * One store, keyed by blob id, value `{ id, bytes, storedAt }`. No secondary indexes: the app never queries
 * by anything except the id it derived from the record, and an index is a thing that can drift from the
 * record it indexes.
 *
 * ## What this file does not do
 *
 * It does not delete anything on its own initiative, it has no expiry, and it runs no sweep. Reclaiming a
 * blob is a decision the caller makes when the person deletes a document — see the retention note in
 * `data/blobStore.ts`.
 */
import type { BlobStore } from './blobStore';

/** Database name. Versioned separately from the dataset's `CURRENT_DATA_VERSION`: this store holds bytes,
 *  not records, and its schema has no reason to move when a record shape does. */
export const BLOB_DB_NAME = 'pfa-document-blobs';
export const BLOB_DB_VERSION = 1;
export const BLOB_OBJECT_STORE = 'blobs';

interface BlobRow {
  id: string;
  /** The data-URL string exactly as uploaded. */
  bytes: string;
  storedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BLOB_DB_NAME, BLOB_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BLOB_OBJECT_STORE)) {
        db.createObjectStore(BLOB_OBJECT_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB.open failed'));
    request.onblocked = () => reject(new Error('indexedDB.open blocked by another tab'));
  });
}

/**
 * Run one transaction and resolve when it commits.
 *
 * Committing is what makes `putBlob`'s resolved promise mean "confirmed": the relocation pass drops the
 * inline copy on that strength alone, so a promise that resolved when the `put` request fired rather than
 * when the transaction completed would let a failed commit silently cost the user a document.
 */
// SAFETY: the bare `IDBRequest` is the DOM lib's own default (`IDBRequest<T = any>`). Naming the
// parameter would make the handler `this` types invariant and reject every call site below; the request
// type is pinned at each call site instead, one line under the `T` it must match.
function run<T>(mode: IDBTransactionMode, body: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDatabase().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(BLOB_OBJECT_STORE, mode);
        const request = body(tx.objectStore(BLOB_OBJECT_STORE));
        // SAFETY: `T` is chosen by each call site to match the request it hands to `body` — `get` yields
        // the row, `getAllKeys` the key list, `put`/`delete`/`getKey` their own result kinds. The DOM lib
        // types the request generically once it crosses this boundary, so the one place the pairing lives
        // is the call site two lines below each use, where it is visible.
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error('indexedDB request failed'));
        tx.oncomplete = () => db.close();
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error('indexedDB transaction aborted'));
        };
      }),
  );
}

/** Open the browser blob store. Rejects when IndexedDB is unavailable, blocked, or refuses the upgrade. */
export async function openIdbBlobStore(): Promise<BlobStore> {
  await openDatabase();

  return {
    async getBlob(id) {
      const row = await run<BlobRow | undefined>('readonly', store => store.get(id));
      return row ? row.bytes : null;
    },
    async putBlob(id, bytes) {
      const row: BlobRow = { id, bytes, storedAt: Date.now() };
      await run<IDBValidKey>('readwrite', store => store.put(row));
    },
    async deleteBlob(id) {
      await run<unknown>('readwrite', store => store.delete(id));
    },
    async hasBlob(id) {
      // `getKey` resolves to `undefined` when the key is absent — that is the absence answer IndexedDB
      // gives, and it is not the same as the request failing.
      const key = await run<IDBValidKey | undefined>('readonly', store => store.getKey(id));
      return key !== undefined;
    },
    async listBlobIds() {
      const keys = await run<IDBValidKey[]>('readonly', store => store.getAllKeys());
      return keys.map(String);
    },
  };
}
