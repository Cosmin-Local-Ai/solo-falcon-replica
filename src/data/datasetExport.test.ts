/**
 * PG-11 (phase 29) — the export must be a backup, or it must not exist.
 *
 * Acceptance 1 is proven here by a **digest of the bytes**, not by their length: a file that carries a
 * document of the right size and the wrong contents passes a length check and fails the only question that
 * matters, which is whether the document can be produced again.
 *
 * Acceptance 6 is the other half: a blob that cannot be read fails the export loudly. There is no branch of
 * this function that emits a file with a document missing from it.
 */
import { afterEach, describe, expect, it } from 'vitest';
// The digest helper is the one the fiscal snapshots already use — a pure-JS SHA-256, browser-safe, no
// `@types/node` and no new dependency. Reusing it also means the hash asserted here is the same hash the
// rest of this repository trusts.
import { sha256Hex } from '../domain/snapshots/hashSync';
import { now, toInstantISO } from '../domain/date';
import { pinClock, unpinClock } from '../test/clock';
import { fixedInstant } from '../test/fixedInstant';
import { DATASET_EXPORT_KIND, DATASET_EXPORT_VERSION, buildDatasetExport } from './datasetExport';
import { createMemoryBlobStore, documentBlobId, statementBlobId } from './blobStore';
import { relocateInlineBlobs } from './blobRelocation';
import { CURRENT_DATA_VERSION } from './migration';
import { emptyData } from './seed';
import type { AppData } from './types';

const DOC_BYTES = 'data:application/pdf;base64,JVBERi0xLjAKMSAwIG9iajw8L1R5cGUgL0NhdGFsb2c+Pj4=';
const STMT_BYTES = 'data:application/pdf;base64,0MT3ZXJ5IG90aGVyIHBkZiBieXRlcyBhcmUgaGVyZQ==';

const sha256 = (value: string): string => sha256Hex(value);

/**
 * The export's timestamp is asserted through the domain's clock seam rather than against a spelled UTC
 * string. A date-time literal with no offset is parsed as **local** time, so a hard-coded
 * `…T12:00:00.000Z` would pass on a UTC runner and fail on one set to Europe/Bucharest — the B-46 class of
 * bug, and the reason `fixedInstant.ts` writes the pinned instant without an offset.
 */
afterEach(() => unpinClock());

function stamp(): Date {
  pinClock();
  return now();
}

function dataset(): AppData {
  const base = emptyData();
  return {
    ...base,
    revenues: [],
    companyDocs: {
      ...base.companyDocs,
      facturi: [
        { id: 'd1', nume: 'factura.pdf', tip: 'pdf', content: DOC_BYTES, marime: DOC_BYTES.length, data: '2026-03-01' },
      ],
    },
    statements: [
      { id: 's1', tip: 'D212', perioada: '2026', depunere: 'SOLO', nume: 'd212.pdf', content: STMT_BYTES },
    ],
  };
}

/** The dataset as it looks after relocation: pointers in the records, bytes in the store. */
async function relocated(): Promise<{ data: AppData; store: ReturnType<typeof createMemoryBlobStore> }> {
  const store = createMemoryBlobStore();
  const result = await relocateInlineBlobs(dataset(), store);
  return { data: result.data, store };
}

describe('export — the bytes are in the file (acceptance 1)', () => {
  it('reads the blobs back out of the store and embeds them, byte for byte', async () => {
    const { data, store } = await relocated();
    const result = await buildDatasetExport(data, store, stamp());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const doc = result.envelope.data.companyDocs!.facturi[0]!;
    const statement = result.envelope.data.statements![0]!;

    // The digest, not the length: this is the assertion that proves the *document* survived, not a
    // same-sized stand-in for it.
    expect(sha256(doc.content!)).toBe(sha256(DOC_BYTES));
    expect(sha256(statement.content!)).toBe(sha256(STMT_BYTES));
    expect(doc.content).toBe(DOC_BYTES);

    // The file carries no pointer into a store it cannot reach.
    expect('blobRef' in doc).toBe(false);
    expect('blobRef' in statement).toBe(false);
    expect(result.embeddedBlobs).toBe(2);
    expect(result.inlineBlobs).toBe(0);
  });

  it('carries the data version, so an older file can be run through the chain on the way back in', async () => {
    const { data, store } = await relocated();
    const result = await buildDatasetExport(data, store, stamp());
    if (!result.ok) throw new Error('export should have succeeded');

    expect(result.envelope.kind).toBe(DATASET_EXPORT_KIND);
    expect(result.envelope.exportVersion).toBe(DATASET_EXPORT_VERSION);
    expect(result.envelope.exportedAt).toBe(toInstantISO(fixedInstant()));
    expect(result.envelope.data.version).toBe(CURRENT_DATA_VERSION);
    // The file is the envelope serialized — what a person downloads is what the validator will read.
    expect(JSON.parse(result.file)).toEqual(result.envelope);
  });

  it('keeps a document that still has its bytes inline inline, and counts it separately', async () => {
    const store = createMemoryBlobStore();
    const result = await buildDatasetExport(dataset(), store, stamp());
    if (!result.ok) throw new Error('export should have succeeded');
    expect(result.embeddedBlobs).toBe(0);
    expect(result.inlineBlobs).toBe(2);
    expect(result.envelope.data.companyDocs!.facturi[0]!.content).toBe(DOC_BYTES);
  });
});

describe('export — refuses rather than emitting a corrupt backup (acceptance 6)', () => {
  it('fails loudly when a blob read throws, and emits no file at all', async () => {
    const { data, store } = await relocated();
    store.failNextGet('IOError');

    const result = await buildDatasetExport(data, store, stamp());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.unreadable).toHaveLength(1);
    expect(result.unreadable[0]).toMatchObject({ blobId: documentBlobId('facturi', 'd1'), label: 'factura.pdf' });
    // There is no partial file to hand over: the failure branch carries no `file` member at all.
    expect('file' in result).toBe(false);
  });

  it('treats a pointer to bytes the store does not hold as unreadable, not as an empty document', async () => {
    const store = createMemoryBlobStore(); // empty: the pointers exist, the bytes do not
    const { data } = await relocated();

    const result = await buildDatasetExport(data, store, stamp());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.unreadable.map(u => u.blobId).sort()).toEqual([
      documentBlobId('facturi', 'd1'),
      statementBlobId('s1'),
    ]);
  });

  it('refuses when no blob store is connected but records still point at one', async () => {
    const { data } = await relocated();
    const result = await buildDatasetExport(data, null, stamp());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.unreadable[0]!.reason).toContain('no blob store');
  });
});
