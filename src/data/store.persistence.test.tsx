/**
 * PG-11 (phase 29) — the persistence gate, proven through the store rather than through a helper.
 *
 * These are the acceptance criteria that only the store can answer, because the store is where the load
 * path, the save path, the blob seam and the quarantine contract meet:
 *
 *  - **4** — a simulated quota failure on save produces a user-visible signal, not only `console.warn`;
 *  - **5** — a blob store whose write rejects leaves the inline content **in place**, and the app says so;
 *  - **7** — deleting a document reclaims its blob, and nothing else reclaims one automatically;
 *  - **2** — importing a corrupt payload leaves the existing dataset byte-identical and quarantines it;
 *  - **3** — importing a file with an older `version` runs the migration chain and succeeds;
 *  - **1** — a document's bytes round-trip export → import identically, asserted by digest.
 *
 * The blob store under test is `createMemoryBlobStore()`. jsdom does not implement IndexedDB, so the real
 * store is not reachable from here; what is proven is the app's side of the contract. The browser side is
 * exercised in `e2e/persistence-backup.spec.ts`, and what neither reaches is stated in the phase doc.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import {
  QUARANTINE_STORAGE_KEY,
  STORAGE_KEY,
  StoreProvider,
  useStore,
} from './store';
import { CURRENT_DATA_VERSION, DATA_VERSION_VAT_RETURNS } from './migration';
import { createMemoryBlobStore, documentBlobId, setBlobStore } from './blobStore';
import { DATASET_EXPORT_KIND, DATASET_EXPORT_VERSION } from './datasetExport';
import { sha256Hex } from '../domain/snapshots/hashSync';
import { seedData } from './seed';
import type { DatasetImportOutcome } from './store';
import { ron } from '../domain/money';
import { seedStorage } from '../test/storage';
import type { AppData } from './types';

const DOC_BYTES = 'data:application/pdf;base64,JVBERi0xLjAKJeStvK6zIHJvdW5kIHRyaXAgYnl0ZXM=';

let storeRef: ReturnType<typeof useStore> | null = null;
function Probe() {
  storeRef = useStore();
  return null;
}

/** The fixture with one document that carries bytes, written the way the app loads data. */
function payloadWithDocument(version: number = CURRENT_DATA_VERSION) {
  const base = JSON.parse(JSON.stringify(seedData)) as AppData;
  base.companyDocs.facturi = [
    { id: 'doc-1', nume: 'factura-rotunda.pdf', tip: 'pdf', content: DOC_BYTES, marime: DOC_BYTES.length, data: '2026-04-02' },
  ];
  return { ...base, version };
}

/** Render and let the store's asynchronous mount work (blob connect + relocation) settle. */
async function mount() {
  await act(async () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    // The relocation pass is a chain of awaited writes; one microtask flush is not enough for it to
    // finish and for the resulting state update to land.
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Read what is actually under the data key, as bytes. */
function storedRaw(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

function stored(): Record<string, unknown> {
  return JSON.parse(storedRaw()!) as Record<string, unknown>;
}

beforeEach(() => {
  localStorage.clear();
  storeRef = null;
  setBlobStore(null);
});

afterEach(() => {
  localStorage.clear();
  setBlobStore(null);
  vi.restoreAllMocks();
});

describe('relocation runs after load, outside the migration chain', () => {
  it('moves a document out of the record and rewrites the persisted shape', async () => {
    const store = createMemoryBlobStore();
    setBlobStore(store);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payloadWithDocument()));

    await mount();

    const doc = (storeRef!.companyDocs.facturi[0])!;
    expect(doc.blobRef).toBe(documentBlobId('facturi', 'doc-1'));
    expect(doc.content).toBeUndefined();
    await expect(store.getBlob(documentBlobId('facturi', 'doc-1'))).resolves.toBe(DOC_BYTES);

    // And the new shape is what reaches storage — the whole point of the phase is that the bytes stop
    // travelling through `localStorage`.
    await act(async () => {
      storeRef!.updateProfile({ fiscalYear: 2026 });
    });
    const persisted = stored().companyDocs as { facturi: { blobRef?: string; content?: string }[] };
    expect(persisted.facturi[0]!.blobRef).toBe(documentBlobId('facturi', 'doc-1'));
    expect(persisted.facturi[0]!.content).toBeUndefined();
    expect(storeRef!.blobStoreStatus).toBe('connected');
    expect(storeRef!.blobRelocation).toMatchObject({ moved: 1, failed: [] });
  });

  it('a rejected blob write leaves the inline bytes in place and reports the failure (acceptance 5)', async () => {
    const store = createMemoryBlobStore();
    store.failPuts('QuotaExceededError');
    setBlobStore(store);
    const payload = payloadWithDocument();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

    await mount();

    // The document keeps its bytes, inline, exactly where they were before the pass ran.
    const doc = storeRef!.companyDocs.facturi[0]!;
    expect(doc.content).toBe(DOC_BYTES);
    expect(doc.blobRef).toBeUndefined();

    // The failure is a fact on the store, which is what the Settings card renders.
    expect(storeRef!.blobRelocation).not.toBeNull();
    expect(storeRef!.blobRelocation!.moved).toBe(0);
    expect(storeRef!.blobRelocation!.failed).toHaveLength(1);
    expect(storeRef!.blobRelocation!.failed[0]).toMatchObject({
      blobId: documentBlobId('facturi', 'doc-1'),
      label: 'factura-rotunda.pdf',
      reason: 'QuotaExceededError',
    });

    // Nothing was written to the store, and nothing was taken out of localStorage.
    expect(await store.listBlobIds()).toEqual([]);
    expect((stored().companyDocs as { facturi: { content?: string }[] }).facturi[0]!.content).toBe(DOC_BYTES);
  });

  it('does not touch the demo fixture: sandbox documents never enter the blob store', async () => {
    const store = createMemoryBlobStore();
    setBlobStore(store);
    // Empty storage: the store starts at 'empty', and the sandbox is loaded afterwards, in memory only.
    await mount();
    act(() => storeRef!.loadSandbox());

    expect(storeRef!.sandboxActive).toBe(true);
    expect(await store.listBlobIds()).toEqual([]);
  });
});

describe('a failed save is visible (acceptance 4)', () => {
  it('a quota failure sets a user-visible failure state, not only console.warn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
    const payload = payloadWithDocument();
    const backing = new Map<string, string>([[STORAGE_KEY, JSON.stringify(payload)]]);
    const failing = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: () => {
        throw new DOMException('QuotaExceededError');
      },
      removeItem: (k: string) => backing.delete(k),
      clear: () => backing.clear(),
    };
    Object.defineProperty(window, 'localStorage', { value: failing, configurable: true, writable: true });

    try {
      await mount();

      // The state the shell renders as a banner. Before PG-11 this branch was `console.warn` and nothing
      // else, so the person kept typing into a store that was no longer accepting writes.
      expect(storeRef!.saveFailure).not.toBeNull();
      expect(storeRef!.saveFailure!.attempts).toBe(1);
      expect(storeRef!.saveFailure!.message).toContain('QuotaExceededError');
      expect(warn).toHaveBeenCalled();

      // A further mutation fails again, and the attempt count says so rather than looking like the first.
      act(() => {
        storeRef!.addRevenue({
          tip: 'factura', nr: 'FCT-900', date: '2026-07-01', client: 'C', cui: 'RO1',
          valoareFaraTva: ron(100), tva: ron(0),
          status: 'inregistrata',
        });
      });
      expect(storeRef!.saveFailure!.attempts).toBe(2);

      // The bytes on disk are exactly the ones that were there before: a failed write writes nothing.
      expect(backing.get(STORAGE_KEY)).toBe(JSON.stringify(payload));
    } finally {
      Object.defineProperty(window, 'localStorage', original);
    }
  });

  it('retrySave writes again without changing any data, and clears the failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
    const payload = payloadWithDocument();
    const backing = new Map<string, string>([[STORAGE_KEY, JSON.stringify(payload)]]);
    let failing = true;
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => backing.get(k) ?? null,
        setItem: (k: string, v: string) => {
          if (failing) throw new DOMException('QuotaExceededError');
          backing.set(k, v);
        },
        removeItem: (k: string) => backing.delete(k),
        clear: () => backing.clear(),
      },
      configurable: true,
      writable: true,
    });

    try {
      await mount();
      expect(storeRef!.saveFailure).not.toBeNull();

      failing = false;
      act(() => storeRef!.retrySave());

      expect(storeRef!.saveFailure).toBeNull();
      // The retry wrote the current state, not the state from before the failure.
      expect(backing.get(STORAGE_KEY)).toContain('factura-rotunda.pdf');
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'localStorage', original);
    }
  });
});

describe('blob reclaim — explicit delete only (acceptance 7)', () => {
  it('deleting a document reclaims its blob', async () => {
    const store = createMemoryBlobStore();
    setBlobStore(store);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payloadWithDocument()));
    await mount();

    const blobId = documentBlobId('facturi', 'doc-1');
    await expect(store.hasBlob(blobId)).resolves.toBe(true);

    act(() => storeRef!.deleteDocument('facturi', 'doc-1'));
    await act(async () => {
      await Promise.resolve();
    });

    await expect(store.hasBlob(blobId)).resolves.toBe(false);
    expect(storeRef!.blobReclaimFailures).toEqual([]);
  });

  it('nothing else reclaims a blob: an unrelated mutation leaves the bytes where they are', async () => {
    const store = createMemoryBlobStore();
    setBlobStore(store);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payloadWithDocument()));
    await mount();

    act(() => {
      storeRef!.addRevenue({
        tip: 'factura', nr: 'FCT-901', date: '2026-07-02', client: 'C', cui: 'RO1',
        valoareFaraTva: ron(100), tva: ron(0),
        status: 'inregistrata',
      });
      storeRef!.updateProfile({ fiscalYear: 2026 });
    });

    await expect(store.hasBlob(documentBlobId('facturi', 'doc-1'))).resolves.toBe(true);
  });

  it('a failed reclaim is reported, not retried behind the person', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createMemoryBlobStore();
    setBlobStore(store);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payloadWithDocument()));
    await mount();

    // Make the reclaim fail by swapping in a store whose delete rejects.
    const hostile = createMemoryBlobStore(store.snapshot());
    const originalDelete = hostile.deleteBlob.bind(hostile);
    hostile.deleteBlob = async (id: string) => {
      if (id === documentBlobId('facturi', 'doc-1')) throw new Error('delete refused');
      return originalDelete(id);
    };
    setBlobStore(hostile);

    act(() => storeRef!.deleteDocument('facturi', 'doc-1'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(storeRef!.blobReclaimFailures).toHaveLength(1);
    expect(storeRef!.blobReclaimFailures[0]).toMatchObject({
      blobId: documentBlobId('facturi', 'doc-1'),
      label: 'factura-rotunda.pdf',
      reason: 'delete refused',
    });
    expect(warn).toHaveBeenCalled();
  });

  it('reports no orphan for a blob it has just relocated', async () => {
    // The regression this pins: the orphan count used the store's ref to the dataset, and a child component's
    // effect runs before its parent's — so at the moment the count was taken, the record still had no
    // `blobRef`, and the blob that had just been written looked like it belonged to nothing. A person reading
    // "1 document has no record pointing at it" right after a clean pass would be told their file is loose.
    const store = createMemoryBlobStore();
    setBlobStore(store);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payloadWithDocument()));
    await mount();

    await expect(store.listBlobIds()).resolves.toEqual([documentBlobId('facturi', 'doc-1')]);
    await expect(storeRef!.orphanBlobIds()).resolves.toEqual([]);
  });

  it('orphans are reported and left alone', async () => {
    const store = createMemoryBlobStore({ 'doc:facturi:fantoma': 'data:text/plain;base64,ZmFudG9tYQ==' });
    setBlobStore(store);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payloadWithDocument()));
    await mount();

    const orphans = await storeRef!.orphanBlobIds();
    expect(orphans).toEqual(['doc:facturi:fantoma']);
    // Reported, not removed.
    await expect(store.hasBlob('doc:facturi:fantoma')).resolves.toBe(true);
  });
});

describe('import — non-destructive on failure (acceptance 2)', () => {
  it('a corrupt payload leaves the stored dataset byte-identical and quarantines the file', async () => {
    seedStorage();
    await mount();
    const before = storedRaw();
    const revenuesBefore = storeRef!.revenues.length;

    const corrupt = JSON.stringify({
      kind: DATASET_EXPORT_KIND,
      exportVersion: DATASET_EXPORT_VERSION,
      data: { revenues: 'nu sunt o listă', settings: seedData.settings },
    });

    let outcome: DatasetImportOutcome | undefined;
    await act(async () => {
      outcome = await storeRef!.importDataset(corrupt);
    });

    expect(outcome!.status).toBe('rejected');
    // Nothing moved: not the bytes, not the in-memory dataset, not the origin.
    expect(storedRaw()).toBe(before);
    expect(storeRef!.revenues).toHaveLength(revenuesBefore);
    expect(storeRef!.dataOrigin).toBe('persisted');

    // The rejected file is preserved verbatim under the D-3 quarantine key, first copy wins.
    const quarantined = JSON.parse(localStorage.getItem(QUARANTINE_STORAGE_KEY)!) as { raw: string; reason: string };
    expect(quarantined.raw).toBe(corrupt);
    expect(quarantined.reason).toBe('schema-invalid');
    expect(storeRef!.quarantine).not.toBeNull();
  });

  it('a file that is not JSON at all is refused the same way', async () => {
    seedStorage();
    await mount();
    const before = storedRaw();

    let outcome: DatasetImportOutcome | undefined;
    await act(async () => {
      outcome = await storeRef!.importDataset('{ nu json');
    });

    expect(outcome!.status).toBe('rejected');
    expect(storedRaw()).toBe(before);
  });
});

describe('import — an older file runs the chain (acceptance 3)', () => {
  it('migrates a payload one version behind and stores it at the current version', async () => {
    const store = createMemoryBlobStore();
    setBlobStore(store);
    // The app starts empty, so an import is the thing that creates the dataset.
    await mount();
    expect(storeRef!.dataOrigin).toBe('empty');

    const older = { ...payloadWithDocument(DATA_VERSION_VAT_RETURNS) };
    const file = JSON.stringify({
      kind: DATASET_EXPORT_KIND,
      exportVersion: DATASET_EXPORT_VERSION,
      exportedAt: '2026-10-13T09:00:00.000Z',
      data: older,
    });

    let outcome: DatasetImportOutcome | undefined;
    await act(async () => {
      outcome = await storeRef!.importDataset(file);
    });

    expect(outcome!.status).toBe('imported');
    if (outcome!.status !== 'imported') return;
    expect(outcome!.fromVersion).toBe(DATA_VERSION_VAT_RETURNS);
    expect(outcome!.toVersion).toBe(CURRENT_DATA_VERSION);
    expect(outcome!.stepsApplied).toEqual(['lease-facts', 'document-blob-ref', 'efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds']);

    // The restored dataset is on screen and is written back at the current version.
    expect(storeRef!.dataOrigin).toBe('persisted');
    expect(stored().version).toBe(CURRENT_DATA_VERSION);
    // Its document's bytes were split out into the blob store, not left in the record.
    expect(outcome!.blobsStored).toBe(1);
    expect(await store.getBlob(documentBlobId('facturi', 'doc-1'))).toBe(DOC_BYTES);
  });
});

describe('export → import round trip (acceptance 1)', () => {
  it('restores a document whose bytes are identical by digest', async () => {
    const store = createMemoryBlobStore();
    setBlobStore(store);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payloadWithDocument()));
    await mount();

    const exported = await storeRef!.exportDataset();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    // A second, empty store: the restore has to bring the bytes back from the file alone.
    const restored = createMemoryBlobStore();
    setBlobStore(restored);

    let outcome: DatasetImportOutcome | undefined;
    await act(async () => {
      outcome = await storeRef!.importDataset(exported.file);
    });
    expect(outcome!.status).toBe('imported');

    const bytes = await restored.getBlob(documentBlobId('facturi', 'doc-1'));
    // The digest, not the length: this is the assertion that the document survived rather than a
    // same-sized stand-in for it.
    expect(sha256Hex(bytes!)).toBe(sha256Hex(DOC_BYTES));
    expect(storeRef!.companyDocs.facturi[0]!.blobRef).toBe(documentBlobId('facturi', 'doc-1'));
  });

  it('refuses to export when a document cannot be read, and writes no file', async () => {
    const store = createMemoryBlobStore();
    setBlobStore(store);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payloadWithDocument()));
    await mount();

    // The record points at bytes the store no longer holds.
    const empty = createMemoryBlobStore();
    setBlobStore(empty);

    const exported = await storeRef!.exportDataset();
    expect(exported.ok).toBe(false);
    if (exported.ok) return;
    expect(exported.unreadable).toHaveLength(1);
    expect('file' in exported).toBe(false);
  });
});
