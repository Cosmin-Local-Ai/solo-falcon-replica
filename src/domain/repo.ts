/**
 * Persistence contract for a domain collection.
 *
 * Domain code depends only on this interface, never on the storage adapter.
 * The store implements this shape today through the AppData load/save cycle
 * on the localStorage key `pfa-app-data-v2` (load-once, write-on-change, CRUD).
 */
export interface Repository<T> {
  /** Load the stored collection, or null when nothing is stored. */
  load(): T | null;
  /** Persist the collection (write-on-change). */
  save(value: T): void;
  /** Subscribe to collection changes. Returns an unsubscribe function. */
  subscribe(listener: (value: T) => void): () => void;
}
