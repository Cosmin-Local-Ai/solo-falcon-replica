/**
 * PG-11 (phase 29) — the v20 → v21 chain step, and the shape of the chain around it.
 *
 * The brief asks for three things of a chain step, and this file is where each is pinned:
 *
 *  - the head moves by **exactly one** (v20 → v21, no rung inserted, none renumbered, none skipped);
 *  - the step **fills nothing in** — it mints no `blobRef` for a record that never had bytes, and it does
 *    not move a byte out of any record;
 *  - it is **idempotent-safe** under the chain contract.
 *
 * The last one matters more here than anywhere else in the chain. The forbidden version of this step reaches
 * for the blob store: that would need `async`, `MigrationStep.apply` is not, and the honest results of
 * trying are a step that silently does nothing or a step that clears `content` before any write has been
 * confirmed. The second is how this phase would have lost a document.
 */
import { describe, expect, it } from 'vitest';
import {
  CURRENT_DATA_VERSION,
  DATA_VERSION_DOCUMENT_BLOB_REF,
  DATA_VERSION_LEASE_FACTS,
  MIGRATION_CHAIN,
  migrateDocumentBlobRefV21,
  migratePersistedData,
} from './migration';
import { seedData } from './seed';
import type { PersistedAppData } from './schema';

function v20Payload(): PersistedAppData {
  return {
    version: DATA_VERSION_LEASE_FACTS,
    profile: seedData.profile,
    revenues: seedData.revenues,
    expenses: seedData.expenses,
    clients: seedData.clients,
    filings: [],
    vatReturns: [],
    documents: [],
    companyDocs: JSON.parse(JSON.stringify(seedData.companyDocs)),
    statements: JSON.parse(JSON.stringify(seedData.statements)),
    snapshots: [],
    settings: seedData.settings,
    reservedAmount: null,
  };
}

describe('the document-blob-ref step', () => {
  it('stamps the version and changes nothing else, byte for byte', () => {
    const before = v20Payload();
    const after = migrateDocumentBlobRefV21(before);

    expect(after.version).toBe(DATA_VERSION_DOCUMENT_BLOB_REF);
    // The whole payload, serialized with the version removed, is the same text before and after. This is
    // the "fills nothing in" claim written as an assertion rather than a comment.
    const strip = (p: PersistedAppData) => JSON.stringify({ ...p, version: undefined });
    expect(strip(after)).toBe(strip(before));
  });

  it('mints no blob reference for a record that never had one', () => {
    const after = migrateDocumentBlobRefV21(v20Payload());
    const docs = Object.values(after.companyDocs!).flat();
    expect(docs.length).toBeGreaterThan(0);
    for (const doc of docs) {
      expect('blobRef' in doc).toBe(false);
    }
    for (const statement of after.statements!) {
      expect('blobRef' in statement).toBe(false);
    }
  });

  it('leaves inline bytes exactly where they are — moving them is not this step\'s job', () => {
    const before = v20Payload();
    const withBytes = JSON.parse(JSON.stringify(before)) as PersistedAppData;
    const docs = Object.values(withBytes.companyDocs!).flat();
    const inline = docs.filter(d => typeof d.content === 'string' && d.content.length > 0);
    expect(inline.length).toBeGreaterThan(0);

    const after = migrateDocumentBlobRefV21(withBytes);
    const afterDocs = Object.values(after.companyDocs!).flat();
    expect(JSON.stringify(afterDocs)).toBe(JSON.stringify(docs));
  });

  it('is idempotent-safe: running it again on a v21 payload is a no-op', () => {
    const once = migrateDocumentBlobRefV21(v20Payload());
    const twice = migrateDocumentBlobRefV21(once);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });
});

describe('the chain around it', () => {
  it('the head moved by exactly one when this step landed, and this step is no longer the head', () => {
    // Brief 76 re-pin (replaced, not deleted). PG-11 asserted that `document-blob-ref` was the head; the
    // chain has moved on, and the property this test guards is not "which rung is last" but "a rung moves
    // by exactly one and nothing was renumbered to put it there". Both edges are still stated: v20 → v21 is
    // still a one-step gap, and `document-blob-ref` still sits at that edge — it is now the second-to-last
    // rung rather than the last.
    expect(DATA_VERSION_DOCUMENT_BLOB_REF - DATA_VERSION_LEASE_FACTS).toBe(1);
    const previous = MIGRATION_CHAIN[MIGRATION_CHAIN.length - 5]!;
    expect(previous.from).toBe(DATA_VERSION_LEASE_FACTS);
    expect(previous.to).toBe(DATA_VERSION_DOCUMENT_BLOB_REF);
    expect(previous.name).toBe('document-blob-ref');
    const last = MIGRATION_CHAIN[MIGRATION_CHAIN.length - 1]!;
    expect(last.from).toBe(CURRENT_DATA_VERSION - 1);
    expect(last.to).toBe(CURRENT_DATA_VERSION);
  });

  it('the chain is contiguous: no gap, no overlap, no renumbered rung', () => {
    for (let i = 0; i < MIGRATION_CHAIN.length; i += 1) {
      const step = MIGRATION_CHAIN[i]!;
      expect(step.to).toBe(step.from + 1);
      if (i > 0) expect(step.from).toBe(MIGRATION_CHAIN[i - 1]!.to);
    }
    expect(MIGRATION_CHAIN[0]!.from).toBe(0);
    expect(MIGRATION_CHAIN[MIGRATION_CHAIN.length - 1]!.to).toBe(CURRENT_DATA_VERSION);
  });

  it('step names are unique — a reused name would make the migration report lie', () => {
    const names = MIGRATION_CHAIN.map(s => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('a v20 payload runs this step and the three that followed it, and no byte moves', () => {
    // Brief 76 re-pin: v20 used to run exactly one step. It now runs four — `document-blob-ref`, the
    // `efactura-deadline` retirement, the `expense-asset-link` opening and the `fixed-asset-disposal-proceeds`
    // opening. The guarded property is untouched: this step still declares a shape and relocates nothing.
    const outcome = migratePersistedData(v20Payload());
    expect(outcome.fromVersion).toBe(DATA_VERSION_LEASE_FACTS);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    expect(outcome.stepsApplied).toEqual(['document-blob-ref', 'efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds', 'prior-year-fiscal-losses']);
  });
});
