/**
 * PG-11 (phase 29) — the relocation pass, and the failure path that protects the bytes.
 *
 * The property this file exists for is acceptance 5 of the brief: **a blob store whose write rejects leaves
 * the inline content in place, and the app says so.** Everything else here is in service of that one claim —
 * a relocation that loses a document is worse than no relocation, and it is the specific catastrophe this
 * phase could cause.
 *
 * The store under test is `createMemoryBlobStore()`, the in-memory double. jsdom does not implement
 * IndexedDB, so the real store is not reachable here; what is proven is the app's contract with a store,
 * not IndexedDB's behaviour. That gap is stated in `docs/ai/phases/54_pg11_persistence_export_import.md`.
 */
import { describe, expect, it } from 'vitest';
import { documentBlobId, statementBlobId, createMemoryBlobStore } from './blobStore';
import {
  applyRelocation,
  countInlineBlobBearers,
  findOrphanBlobIds,
  relocateInlineBlobs,
  referencedBlobIds,
} from './blobRelocation';
import { emptyData } from './seed';
import type { AppData } from './types';

const DOC_BYTES = 'data:application/pdf;base64,JVBERi0xLjAKJeStvK6z';
const STMT_BYTES = 'data:application/pdf;base64,0MT3ZXJ5IG90aGVy';

function dataset(): AppData {
  const base = emptyData();
  return {
    ...base,
    companyDocs: {
      ...base.companyDocs,
      facturi: [
        { id: 'd1', nume: 'factura.pdf', tip: 'pdf', content: DOC_BYTES, marime: DOC_BYTES.length, data: '2026-03-01' },
        // A record with no bytes at all: relocation must leave it exactly as it is and mint nothing.
        { id: 'd2', nume: 'fara-octeți.pdf', tip: 'pdf', marime: 0, data: '2026-03-02' },
      ],
    },
    statements: [
      { id: 's1', tip: 'D212', perioada: '2026', depunere: 'SOLO', nume: 'd212.pdf', content: STMT_BYTES },
    ],
  };
}

describe('relocation — the happy path', () => {
  it('moves the bytes, points at them, and drops the inline copy only after the write confirms', async () => {
    const store = createMemoryBlobStore();
    const result = await relocateInlineBlobs(dataset(), store);

    expect(result.moved).toBe(2);
    expect(result.failed).toEqual([]);
    expect(result.data.companyDocs.facturi[0]).toEqual({
      id: 'd1',
      nume: 'factura.pdf',
      tip: 'pdf',
      marime: DOC_BYTES.length,
      data: '2026-03-01',
      blobRef: documentBlobId('facturi', 'd1'),
    });
    // The bytes are in the store, byte for byte.
    await expect(store.getBlob(documentBlobId('facturi', 'd1'))).resolves.toBe(DOC_BYTES);
    await expect(store.getBlob(statementBlobId('s1'))).resolves.toBe(STMT_BYTES);
  });

  it('leaves a record that never had bytes untouched, and mints no pointer for it', async () => {
    const store = createMemoryBlobStore();
    const result = await relocateInlineBlobs(dataset(), store);

    const untouched = result.data.companyDocs.facturi[1];
    expect('content' in untouched).toBe(false);
    expect('blobRef' in untouched).toBe(false);
    expect(await store.listBlobIds()).toEqual([documentBlobId('facturi', 'd1'), statementBlobId('s1')]);
  });

  it('is idempotent: a second pass moves nothing and mints no second home for the same bytes', async () => {
    const store = createMemoryBlobStore();
    const first = await relocateInlineBlobs(dataset(), store);
    const second = await relocateInlineBlobs(first.data, store);

    expect(second.moved).toBe(0);
    expect(second.data).toBe(first.data);
    expect(await store.listBlobIds()).toHaveLength(2);
  });
});

describe('relocation — the failure path (acceptance 5)', () => {
  it('a rejected blob write leaves the inline bytes exactly where they were, and reports it', async () => {
    const store = createMemoryBlobStore();
    store.failNextPut('QuotaExceededError');

    const input = dataset();
    const result = await relocateInlineBlobs(input, store);

    // The document that failed keeps its bytes, inline, in the record.
    const failedDoc = result.data.companyDocs.facturi[0];
    expect(failedDoc.content).toBe(DOC_BYTES);
    expect('blobRef' in failedDoc).toBe(false);

    // And the failure is a fact the caller can render, not a swallowed exception.
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({
      blobId: documentBlobId('facturi', 'd1'),
      label: 'factura.pdf',
      reason: 'QuotaExceededError',
    });

    // The other document still moved: one failed write does not strand every document.
    expect(result.moved).toBe(1);
    expect(result.data.statements[0].blobRef).toBe(statementBlobId('s1'));
    expect(result.data.statements[0].content).toBeUndefined();
  });

  it('when every write fails, the dataset is returned unchanged and every record keeps its bytes', async () => {
    const store = createMemoryBlobStore();
    store.failPuts('QuotaExceededError');

    const input = dataset();
    const result = await relocateInlineBlobs(input, store);

    expect(result.moved).toBe(0);
    expect(result.failed).toHaveLength(2);
    // Identity preserved: the caller can tell "nothing to do" from "something changed".
    expect(result.data).toBe(input);
    expect(result.data.companyDocs.facturi[0].content).toBe(DOC_BYTES);
    expect(result.data.statements[0].content).toBe(STMT_BYTES);
    expect(await store.listBlobIds()).toEqual([]);
  });
});

describe('relocation — applying it to live state', () => {
  it('re-points only records whose bytes still match what was written', async () => {
    const store = createMemoryBlobStore();
    const snapshot = dataset();
    const result = await relocateInlineBlobs(snapshot, store);

    // The person edited this document's bytes while the writes were in flight.
    const live: AppData = {
      ...snapshot,
      companyDocs: {
        ...snapshot.companyDocs,
        facturi: [{ ...snapshot.companyDocs.facturi[0], content: 'data:application/pdf;base64,EDITAT' }],
      },
    };
    const applied = applyRelocation(live, result.relocated);

    // The edited record keeps the new inline bytes; pointing it at the blob written from the older
    // snapshot would have replaced what the person just did.
    expect(applied.companyDocs.facturi[0].content).toBe('data:application/pdf;base64,EDITAT');
    expect('blobRef' in applied.companyDocs.facturi[0]).toBe(false);
    // The untouched statement still gets re-pointed.
    expect(applied.statements[0].blobRef).toBe(statementBlobId('s1'));
  });

  it('returns the same object when there is nothing to apply', async () => {
    const store = createMemoryBlobStore();
    const result = await relocateInlineBlobs(dataset(), store);
    const live = dataset();
    expect(applyRelocation(live, [])).toBe(live);
    expect(applyRelocation(result.data, result.relocated)).toBe(result.data);
  });
});

describe('orphans — reported, never removed', () => {
  it('lists blobs no record points at and leaves them in the store', async () => {
    const store = createMemoryBlobStore();
    const result = await relocateInlineBlobs(dataset(), store);

    // The dataset after relocation points at both blobs, so there are no orphans.
    expect(referencedBlobIds(result.data).size).toBe(2);
    expect(await findOrphanBlobIds(result.data, store)).toEqual([]);

    // Delete one record's pointer: its blob is now an orphan, and it is still in the store.
    const withoutStatement: AppData = { ...result.data, statements: [] };
    expect(await findOrphanBlobIds(withoutStatement, store)).toEqual([statementBlobId('s1')]);
    await expect(store.hasBlob(statementBlobId('s1'))).resolves.toBe(true);
  });

  it('counts what still needs moving', () => {
    expect(countInlineBlobBearers(dataset())).toBe(2);
  });
});
