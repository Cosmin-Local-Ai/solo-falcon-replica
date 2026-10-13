/**
 * PG-11 (phase 29) — moving document bytes out of `localStorage`, **outside the migration chain**.
 *
 * ## The two things this phase does, and why they must not be conflated
 *
 * A chain step may change the **shape**. `document-blob-ref` (v20 → v21) declares that a document record
 * can carry a `blobRef` instead of inline `content`, and it fills nothing in — the same way `lease-facts`
 * and `expense-category` open a fact family by writing nothing.
 *
 * This module moves the **bytes**. It runs after load, asynchronously, and it is not a chain step, because
 * the chain is entirely synchronous: every step in `data/migration.ts` is a pure `apply(data) => data`, and
 * the store the bytes go into is not.
 *
 * ## The order of operations, which IS the data safety
 *
 * **read inline → write to blob store → confirm → only then drop the inline copy and persist the new
 * shape.**
 *
 * Per record, on one `await` boundary: `putBlob` must resolve before the record loses its `content`. A
 * rejected write leaves that record's bytes exactly where they were — inline, in the record, in
 * `localStorage` — and the failure is returned so the app can say so out loud. There is no version of this
 * function that clears `content` first, and no batch that waits for all writes before dropping any of them:
 * a document that survives the failure of another document's write is still a document the person can open.
 *
 * **A relocation that loses a document is worse than no relocation.** That is the judgement every choice
 * below makes, and `data/blobRelocation.test.ts` proves the failure path rather than asserting it.
 *
 * ## What is never deleted here
 *
 * Nothing. This module writes and re-points. Reclaiming a blob happens only when the person deletes the
 * document — see `deleteDocument` / `deleteStatement` in `data/store.tsx`. There is no expiry and no
 * garbage collection on a timer, because these are retained documents: `pages/Documents.tsx` records that
 * one *fișă* exists only because a retention obligation has to be producible in order to be kept at all.
 * Orphans are reported by `findOrphanBlobIds`, never removed.
 */
import type { AppData, CompanyDocument, DocTypeCode, TaxStatement } from './types';
import { DOC_SECTIONS } from './types';
import type { BlobStore } from './blobStore';
import { documentBlobId, statementBlobId } from './blobStore';

/** One record whose bytes could not be moved. */
export interface RelocationFailure {
  /** The blob id the write was attempted under — so a support read can find the record. */
  blobId: string;
  /** A label a person recognises: the file name, not the internal id. */
  label: string;
  reason: string;
}

/** One record whose bytes are now durably in the store. */
export interface RelocatedRecord {
  blobId: string;
  /** The exact bytes that were written. `applyRelocation` compares against them before re-pointing. */
  bytes: string;
}

export interface RelocationResult {
  /**
   * The dataset in the new shape, with **only** the records whose write was confirmed re-pointed.
   * When nothing moved, this is the input object — identity preserved so the caller can skip a save.
   *
   * Import applies this directly. The load path must not: see `applyRelocation`.
   */
  data: AppData;
  /** Records whose bytes are now in the blob store and whose inline copy was dropped. */
  moved: number;
  /** Records that keep their inline bytes because the write failed. */
  failed: RelocationFailure[];
  /** Records that had no inline bytes to move. */
  skipped: number;
  /** What moved, with the bytes that were written — the input to `applyRelocation`. */
  relocated: RelocatedRecord[];
}

// The four document sections, read from the one list the app already keeps rather than spelled a second
// time here — a second list is how a fifth section would be relocated by everything except this file.
const DOC_CODES: DocTypeCode[] = DOC_SECTIONS.map(s => s.code);

/** How many records still carry their bytes inline — the number the ceiling is made of. */
export function countInlineBlobBearers(data: AppData): number {
  let n = 0;
  for (const code of DOC_CODES) n += (data.companyDocs[code] ?? []).filter(d => hasInlineBytes(d)).length;
  n += data.statements.filter(s => hasInlineBytes(s)).length;
  return n;
}

function hasInlineBytes(record: CompanyDocument | TaxStatement): boolean {
  return typeof record.content === 'string' && record.content.length > 0;
}

/**
 * Move every record's inline bytes into `store`, one record at a time.
 *
 * `store` is required rather than nullable on purpose: the caller decides whether relocation runs at all
 * (there is no point when no blob store is connected), and this function should never be in a position to
 * silently no-op its way past a record that has bytes.
 */
export async function relocateInlineBlobs(data: AppData, store: BlobStore): Promise<RelocationResult> {
  const failed: RelocationFailure[] = [];
  const relocated: RelocatedRecord[] = [];
  let moved = 0;
  let skipped = 0;

  /**
   * The one place the order of operations lives.
   *
   * Returns the re-pointed record, or `null` when the write failed and the caller must keep `record`
   * exactly as it was.
   */
  async function move<T extends CompanyDocument | TaxStatement>(
    record: T,
    bytes: string,
    blobId: string,
    label: string,
  ): Promise<T | null> {
    try {
      // 1. write, and 2. wait for the confirmation.
      await store.putBlob(blobId, bytes);
    } catch (err) {
      // 3a. the write did not confirm: the bytes stay inline, in the record, where they already were.
      failed.push({ blobId, label, reason: err instanceof Error ? err.message : String(err) });
      return null;
    }
    // 3b. only now: drop the inline copy and point at the store.
    // SAFETY: the spread preserves every key of `T` — the generic is what keeps a `CompanyDocument` a
    // `CompanyDocument` through this call — and `content` is optional on both bearer kinds, which is the
    // only reason deleting it is legal.
    const next = { ...record, blobRef: blobId } as T;
    delete next.content;
    moved += 1;
    relocated.push({ blobId, bytes });
    return next;
  }

  const companyDocs = { ...data.companyDocs };
  for (const code of DOC_CODES) {
    const list = companyDocs[code] ?? [];
    const nextList: CompanyDocument[] = [];
    for (const doc of list) {
      if (!hasInlineBytes(doc)) {
        skipped += 1;
        nextList.push(doc);
        continue;
      }
      // A record that already carries a pointer keeps it: re-running relocation must not mint a second
      // home for the same bytes.
      const blobId = doc.blobRef ?? documentBlobId(code, doc.id);
      const movedDoc = await move(doc, doc.content!, blobId, doc.nume);
      nextList.push(movedDoc ?? doc);
    }
    companyDocs[code] = nextList;
  }

  const statements: TaxStatement[] = [];
  for (const statement of data.statements) {
    if (!hasInlineBytes(statement)) {
      skipped += 1;
      statements.push(statement);
      continue;
    }
    const blobId = statement.blobRef ?? statementBlobId(statement.id);
    const movedStatement = await move(statement, statement.content!, blobId, statement.nume ?? statement.tip);
    statements.push(movedStatement ?? statement);
  }

  if (moved === 0) return { data, moved, failed, skipped, relocated };
  return { data: { ...data, companyDocs, statements }, moved, failed, skipped, relocated };
}

/**
 * Re-point the records of `current` whose bytes `relocated` says are now in the store.
 *
 * **Why the load path cannot just use `relocateInlineBlobs`'s own result.** The writes are asynchronous,
 * and the person can mutate the dataset while they are in flight. Applying the snapshot's shape over live
 * state would drop whatever they typed in that window — and for the record being edited, it would point at
 * bytes that are no longer the ones on screen. So the apply step checks, per record, that the inline bytes
 * still match what was written before it drops them. A record that changed in the window keeps its inline
 * copy, and the blob written for it becomes an orphan — reported, not removed.
 */
export function applyRelocation(current: AppData, relocated: RelocatedRecord[]): AppData {
  if (relocated.length === 0) return current;
  const byId = new Map(relocated.map(r => [r.blobId, r.bytes]));
  let changed = false;

  function repoint<T extends CompanyDocument | TaxStatement>(record: T, blobId: string): T | null {
    if (record.blobRef) return null;
    const bytes = record.content;
    if (typeof bytes !== 'string' || bytes.length === 0) return null;
    if (byId.get(blobId) !== bytes) return null;
    changed = true;
    // SAFETY: same shape-preserving spread as in `relocateInlineBlobs`; `content` is optional on both kinds.
    const next = { ...record, blobRef: blobId } as T;
    delete next.content;
    return next;
  }

  const companyDocs = { ...current.companyDocs };
  for (const code of DOC_CODES) {
    companyDocs[code] = (current.companyDocs[code] ?? []).map(doc =>
      repoint(doc, doc.blobRef ?? documentBlobId(code, doc.id)) ?? doc,
    );
  }
  const statements = current.statements.map(s => repoint(s, s.blobRef ?? statementBlobId(s.id)) ?? s);

  if (!changed) return current;
  return { ...current, companyDocs, statements };
}

/** Every blob id the dataset currently points at. */
export function referencedBlobIds(data: AppData): Set<string> {
  const ids = new Set<string>();
  for (const code of DOC_CODES) {
    for (const doc of data.companyDocs[code] ?? []) {
      if (doc.blobRef) ids.add(doc.blobRef);
    }
  }
  for (const statement of data.statements) {
    if (statement.blobRef) ids.add(statement.blobRef);
  }
  return ids;
}

/**
 * Blobs the store holds that no record points at.
 *
 * **Reported, never removed.** An orphan is usually a crash between "blob written" and "dataset saved", and
 * the record that owned it may still be recoverable — deleting the bytes on suspicion is how a retention
 * obligation stops being producible. The count reaches the Settings → Date card so the person can see it.
 */
export async function findOrphanBlobIds(data: AppData, store: BlobStore): Promise<string[]> {
  const referenced = referencedBlobIds(data);
  const held = await store.listBlobIds();
  return held.filter(id => !referenced.has(id)).sort();
}
