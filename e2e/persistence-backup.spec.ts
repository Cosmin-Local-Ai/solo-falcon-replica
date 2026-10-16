import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fixedInstant } from '../src/test/fixedInstant';
import { seedBrowserOnce, seedPayload } from './fixtures';
import { seedData } from '../src/data/seed';
import { documentBlobId } from '../src/data/blobStore';
import { BLOB_DB_NAME, BLOB_OBJECT_STORE } from '../src/data/blobStore.idb';
import type { AppData } from '../src/data/types';

/**
 * PG-11 (phase 29) — persistence, export and import, in a browser.
 *
 * ## Why this file exists next to the unit tests
 *
 * jsdom does not implement IndexedDB, so the unit suite runs against an in-memory double and proves the
 * app's side of the contract. **The store's side is only reachable in a real browser**, and this spec is
 * where it is reached: the bytes are read back out of IndexedDB itself, not out of a stand-in for it.
 *
 * ## What each test pins
 *
 *  1. **Relocation actually happens in the browser** — after a reload, the record in `localStorage` carries
 *     a pointer and no bytes, and the bytes are in IndexedDB. That is the whole premise of the phase, and
 *     it is the claim the unit tests cannot make.
 *  2. **Export → import round trip** — a file is downloaded, the document is deleted through the UI, the
 *     file is imported, and the bytes come back identical. The download is read as bytes, not as a toast.
 *  3. **A failed save is on screen** — with `setItem` throwing, the banner renders. Before this phase the
 *     app's only response was `console.warn`.
 *  4. **No blob store is a state the app stays correct in** — with IndexedDB removed, the app says the
 *     larger store is unavailable, keeps the document working, and loses nothing.
 */

const STORAGE_KEY = 'pfa-app-data-v2';

/** A data URL with recognizable contents, so a digest mismatch is obvious when it happens. */
const DOC_BYTES = 'data:application/pdf;base64,JVBERi0xLjAKUGdJSSByb3VuZCB0cmlwIHBnMTE=';

function payloadWithDocument(): AppData & { version: number } {
  const base = JSON.parse(JSON.stringify(seedData)) as AppData;
  base.companyDocs.facturi = [
    {
      id: 'doc-1',
      nume: 'factura-rotunda.pdf',
      tip: 'pdf',
      content: DOC_BYTES,
      marime: DOC_BYTES.length,
      data: '2026-04-02',
    },
  ];
  return { ...base, version: seedPayload().version };
}

/**
 * Read one blob straight out of IndexedDB.
 *
 * This deliberately does not go through the app: the point is to check what the *store* holds, so a bug in
 * the app's own reader could not make the assertion pass.
 */
async function readBlobFromBrowser(page: import('@playwright/test').Page, blobId: string): Promise<string | null> {
  return page.evaluate(
    async ({ db, store, id }) =>
      new Promise<string | null>((resolve, reject) => {
        const open = indexedDB.open(db, 1);
        open.onupgradeneeded = () => {
          const database = open.result;
          if (!database.objectStoreNames.contains(store)) database.createObjectStore(store, { keyPath: 'id' });
        };
        open.onsuccess = () => {
          const database = open.result;
          if (!database.objectStoreNames.contains(store)) {
            resolve(null);
            return;
          }
          const request = database.transaction(store, 'readonly').objectStore(store).get(id);
          request.onsuccess = () => resolve(request.result ? request.result.bytes : null);
          request.onerror = () => reject(request.error);
        };
        open.onerror = () => reject(open.error);
      }),
    { db: BLOB_DB_NAME, store: BLOB_OBJECT_STORE, id: blobId },
  );
}

/** The document record as it sits in `localStorage`, read straight from the browser. */
async function readPersistedDocument(
  page: import('@playwright/test').Page,
): Promise<{ content?: string; blobRef?: string } | null> {
  return page.evaluate(
    key => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        companyDocs: { facturi: { id: string; content?: string; blobRef?: string }[] };
      };
      return parsed.companyDocs.facturi.find(d => d.id === 'doc-1') ?? null;
    },
    STORAGE_KEY,
  );
}

test.describe('PG-11 — document bytes leave localStorage', () => {
  test('a document is relocated into IndexedDB and survives a reload with its bytes', async ({ page }) => {
    // `seedBrowserOnce`, not `seedBrowser`: an init script re-runs on every document, including the reload,
    // and would re-write the pre-relocation payload the test is about to inspect. `fixtures.ts` records the
    // same trap. Seeding once means the bytes inspected after the reload are the ones the app wrote.
    await seedBrowserOnce(page, payloadWithDocument());
    await page.clock.setFixedTime(fixedInstant());
    const blobId = documentBlobId('facturi', 'doc-1');
    await page.goto('/documents#!/company');
    await expect(page.getByText('factura-rotunda.pdf')).toBeVisible();

    // The order the phase is built on: the bytes are written to the store, and only after that is the
    // record's inline copy dropped and the new shape persisted. Waiting for each of those in that order —
    // rather than sleeping and hoping — is what makes the reload assertion mean something.
    // `expect.poll`, not `expect(promise).resolves`: the latter awaits once and does not retry, and the
    // write being waited for is the one that has to land before the record may change shape at all.
    await expect.poll(() => readBlobFromBrowser(page, blobId)).toBe(DOC_BYTES);
    await expect.poll(() => readPersistedDocument(page)).toMatchObject({ blobRef: blobId });

    // Reload: what is inspected now is what storage holds, not what the app rendered.
    await page.reload();
    await expect(page.getByText('factura-rotunda.pdf')).toBeVisible();
    await page.goto('/settings#!/data');
    // The store is connected on this second load too — the connection is not a one-shot per page view.
    await expect(page.locator('[data-backup-status]')).toContainText('în afara datelor aplicației');
    // Nothing left to move. A second load does not re-run a pass over records it already moved, which is the
    // idempotence the chain contract asks of every other step too.
    await expect(page.locator('[data-blob-relocated]')).toHaveCount(0);
    // And the pass left no stray behind: the one blob that exists is the one the record names, so no orphan
    // is reported. (This line caught a real bug — the orphan count was reading a stale dataset snapshot and
    // reported the freshly relocated blob as belonging to nothing.)
    await expect(page.locator('[data-blob-orphans]')).toHaveCount(0);

    const persisted = await readPersistedDocument(page);
    expect(persisted, 'the document record disappeared from storage').not.toBeNull();
    expect(persisted!.blobRef).toBe(blobId);
    // The bytes are no longer travelling through `localStorage` — that is the ceiling going away.
    expect(persisted!.content).toBeUndefined();

    // And they are really in IndexedDB, byte for byte.
    await expect(readBlobFromBrowser(page, blobId)).resolves.toBe(DOC_BYTES);


  });

  test('without IndexedDB the app says so and loses nothing', async ({ page }) => {
    await page.addInitScript(() => {
      // Not a failing store — no store at all. The app must stay correct in this state.
      // @ts-expect-error deliberately removing a browser global for the test
      delete window.indexedDB;
    });
    await seedBrowserOnce(page, payloadWithDocument());
    await page.clock.setFixedTime(fixedInstant());
    await page.goto('/settings#!/data');

    await expect(page.getByText('Depozitul de documente nu este disponibil aici', { exact: false })).toBeVisible();

    // The document still exists and still opens: 'unavailable' is not 'gone'.
    await page.goto('/documents#!/company');
    await expect(page.getByText('factura-rotunda.pdf')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Descarcă' })).toBeVisible();
  });
});

test.describe('PG-11 — export and import', () => {
  test('a backup round-trips: export, delete the document, import, and the bytes are identical', async ({ page }) => {
    await seedBrowserOnce(page, payloadWithDocument());
    await page.clock.setFixedTime(fixedInstant());

    // --- export ---
    await page.goto('/settings#!/data');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-export-dataset]'),
    ]);
    const fileName = download.suggestedFilename();
    expect(fileName).toMatch(/^pfa-backup-.*\.json$/);
    const downloadPath = await download.path();
    expect(downloadPath, 'the backup file was not written').not.toBeNull();

    const exported = JSON.parse(await readFile(downloadPath!, 'utf8')) as {
      kind: string;
      data: { version: number; companyDocs: { facturi: { id: string; content?: string }[] } };
    };
    expect(exported.kind).toBe('pfa-dataset-export');
    // The backup carries the document bytes even though storage no longer does — a backup without the
    // user's documents is not a backup.
    expect(exported.data.companyDocs.facturi.find(d => d.id === 'doc-1')!.content).toBe(DOC_BYTES);

    // --- destroy the document through the UI, including its blob ---
    await page.goto('/documents#!/company');
    await page.getByRole('button', { name: 'Șterge' }).first().click();
    await expect(page.getByText('factura-rotunda.pdf')).toHaveCount(0);
    await expect(readBlobFromBrowser(page, documentBlobId('facturi', 'doc-1'))).resolves.toBeNull();

    // --- import the file back ---
    await page.goto('/settings#!/data');
    await page.setInputFiles('[data-import-file]', downloadPath!);
    await expect(page.getByText('Datele au fost restaurate', { exact: false })).toBeVisible();

    await page.goto('/documents#!/company');
    await expect(page.getByText('factura-rotunda.pdf')).toBeVisible();
    // The bytes came back from the file and are identical to the ones that went out.
    await expect(readBlobFromBrowser(page, documentBlobId('facturi', 'doc-1'))).resolves.toBe(DOC_BYTES);
  });

  test('a rejected import changes nothing and says it was refused', async ({ page }) => {
    await seedBrowserOnce(page, payloadWithDocument());
    await page.clock.setFixedTime(fixedInstant());
    await page.goto('/settings#!/data');

    // Wait for the relocation pass to finish before taking the snapshot. Without this the "before" is the
    // pre-relocation payload and the comparison fails on a write the app *should* have made, which would
    // hide the thing this test is about.
    await expect(page.locator('[data-blob-relocated]')).toBeVisible();
    const before = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);

    // A payload-shaped file whose dataset is not a dataset. `setInputFiles` can take the bytes directly,
    // so no temp file is needed to hand the app a bad one.
    const corrupt = Buffer.from(
      '{ "kind": "pfa-dataset-export", "exportVersion": 1, "data": { "revenues": "nu e listă" } }',
      'utf8',
    );
    await page.setInputFiles('[data-import-file]', {
      name: 'stricat.json',
      mimeType: 'application/json',
      buffer: corrupt,
    });

    await expect(page.getByText('Fișierul a fost respins', { exact: false })).toBeVisible();

    const after = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
    // Byte-identical: the import validated the whole file before it wrote anything, and it wrote nothing.
    expect(after).toBe(before);
  });
});

test.describe('PG-11 — a failed save is visible', () => {
  test('a storage write that throws puts a banner on screen, not only a console line', async ({ page }) => {
    // Seeding and failing live in ONE init script, in that order. If the wrapper were installed first, the
    // seed write itself would throw and the app would start from 'empty' — a state that never writes, so the
    // banner under test could not appear and the test would pass for no reason at all.
    await page.addInitScript(
      ({ key, payload }) => {
        localStorage.setItem(key, JSON.stringify(payload));
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k: string, v: string) {
          // Only the dataset key fails: the quarantine key and everything else keep working, so the failure
          // under test is a quota on the user's data, not a broken browser.
          if (k === key) throw new DOMException('QuotaExceededError');
          return original.call(this, k, v);
        };
      },
      { key: STORAGE_KEY, payload: payloadWithDocument() },
    );
    await page.clock.setFixedTime(fixedInstant());
    await page.goto('/dashboard');

    const banner = page.locator('[data-save-failure]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('nu a fost salvată pe acest dispozitiv');
    await expect(banner.locator('[data-save-retry]')).toBeVisible();
  });
});
