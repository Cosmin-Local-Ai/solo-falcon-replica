/**
 * PG-11 (phase 29) — import validates the whole payload before anything is written.
 *
 * This file tests the **validator**, which is the half that decides whether an import happens at all. It is
 * deliberately pure: it takes a string and answers a question, and it cannot write. The store is the only
 * thing that can change state, which is what makes "on failure, write nothing" structural rather than a
 * promise the caller has to remember to keep. The store-level proof — that a rejected import leaves the
 * stored dataset byte-identical and quarantines the payload — lives in `data/store.persistence.test.tsx`.
 *
 * The reasons returned are the load path's own `QuarantineReason` values, because import reuses the D-3
 * quarantine contract rather than inventing a second one.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { CURRENT_DATA_VERSION, DATA_VERSION_ANNUAL_FILING, DATA_VERSION_VAT_RETURNS } from './migration';
import { DATASET_EXPORT_KIND, DATASET_EXPORT_VERSION } from './datasetExport';
import { validateDatasetImport } from './datasetImport';
import { STORAGE_KEY } from './store';
import { seedData } from './seed';

function envelope(data: unknown, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    kind: DATASET_EXPORT_KIND,
    exportVersion: DATASET_EXPORT_VERSION,
    exportedAt: '2026-10-13T09:00:00.000Z',
    data,
    ...overrides,
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe('import — a file this build cannot hold is refused', () => {
  it('refuses text that is not JSON, with the load path\'s own reason', () => {
    const outcome = validateDatasetImport('{ "kind": "pfa-da');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe('unparseable-json');
  });

  it('refuses a JSON value that is not an envelope', () => {
    for (const raw of ['null', '[]', '"date"', '{"nope":1}']) {
      const outcome = validateDatasetImport(raw);
      expect(outcome.ok).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.reason).toBe('schema-invalid');
    }
  });

  it('refuses a file from another producer rather than guessing at its shape', () => {
    const outcome = validateDatasetImport(envelope(seedData, { kind: 'some-other-backup' }));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.detail).toContain('not a dataset backup');
  });

  it('refuses an envelope whose dataset is not a dataset', () => {
    const broken = { ...(seedData as object), revenues: [{ tip: 'factura', valoareFaraTva: 'mult de prea mult' }] };
    const outcome = validateDatasetImport(envelope(broken));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe('schema-invalid');
    // The detail names where it broke, bounded the same way the load path bounds it.
    expect(outcome.detail).toContain('revenues');
  });

  it('refuses a backup written by a newer build instead of down-migrating it', () => {
    const outcome = validateDatasetImport(envelope({ ...seedData, version: CURRENT_DATA_VERSION + 7 }));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe('unsupported-version');
    // Silently dropping the fields this build does not know would replace the person's data with a
    // smaller version of it — which is the failure the load path already refuses for stored payloads.
    expect(outcome.detail).toContain(String(CURRENT_DATA_VERSION + 7));
  });
});

describe('import — an older file runs the existing chain (acceptance 3)', () => {
  it('accepts a payload one version behind and applies exactly the missing steps', () => {
    const outcome = validateDatasetImport(envelope({ ...seedData, version: DATA_VERSION_VAT_RETURNS }));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.fromVersion).toBe(DATA_VERSION_VAT_RETURNS);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    expect(outcome.stepsApplied).toEqual(['lease-facts', 'document-blob-ref']);
    expect(outcome.data.version).toBe(CURRENT_DATA_VERSION);
  });

  it('accepts a payload many versions behind, and the whole ladder runs in order', () => {
    const outcome = validateDatasetImport(envelope({ ...seedData, version: DATA_VERSION_ANNUAL_FILING }));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.fromVersion).toBe(DATA_VERSION_ANNUAL_FILING);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    // The chain is the same chain the load path runs — no import-specific migration path exists.
    expect(outcome.stepsApplied[0]).toBe('activity-family');
    expect(outcome.stepsApplied[outcome.stepsApplied.length - 1]).toBe('document-blob-ref');
  });

  it('reads the envelope\'s own timestamp when it declares one, and never invents one', () => {
    const declared = validateDatasetImport(envelope({ ...seedData, version: DATA_VERSION_VAT_RETURNS }));
    expect(declared.ok && declared.exportedAt).toBe('2026-10-13T09:00:00.000Z');

    const undeclared = validateDatasetImport(
      envelope({ ...seedData, version: DATA_VERSION_VAT_RETURNS }, { exportedAt: undefined }),
    );
    expect(undeclared.ok && undeclared.exportedAt).toBeNull();
  });
});

/*
 * B-109 — does the backup carry the new digest, and did anything have to change to make it? 
 *
 * It already does, and neither `datasetExport.ts` nor `datasetImport.ts` was touched to make that true. The
 * export embeds the dataset verbatim and never enumerates snapshot fields; the import validates through
 * `persistedAppDataSchema` and then runs the same migration chain the load path runs. So the only thing that
 * decides whether `assetRegisterHash` survives a backup is whether the key is declared in the schema — which
 * is why it is, and why these tests exist. Remove the declaration and the digest silently vanishes from
 * every restored file; this is the test that says so.
 */
const B109_RELEASE = {
  releaseId: 'rel-2025-001',
  name: 'PFA 2025 rules',
  jurisdiction: 'RO',
  entityType: 'PFA',
  taxYear: 2025,
  ruleIds: ['rule-2025-1'],
  status: 'SAFE_ACTIVATION',
  effectiveFrom: '2025-01-01',
  createdAt: '2025-01-01T00:00:00.000Z',
  evidence: ['https://example.com/legis-2025'],
};

describe('import — a calculation snapshot\'s digests travel through the backup (B-109)', () => {
  it('carries assetRegisterHash and inputsHash through the validator and the chain', () => {
    const snapshot = {
      calculationId: 'calc-2025-b109',
      taxYear: 2025,
      calculatedAt: '2026-10-14T15:56:00.672Z',
      ruleRelease: B109_RELEASE,
      ruleSetHash: 'df6ec4fcf54864070ff7e1f264f15e41046ffd68cd6742770e75d935a2892724',
      assetRegisterHash: '8f31fbe721e377fcce1fc4671f115f61d4646c6cb21d5e3b76ca825c1ede896c',
      inputSnapshot: { profile: seedData.profile, revenues: 100000, expenses: 40000 },
      inputsHash: '88215ab2b0aa3b03fd87f17225234f24458a494768da0b66ecb4f433a27b7b0a',
      calculationLines: [],
      output: { total: 0 },
      status: 'computed',
    };
    const outcome = validateDatasetImport(
      envelope({ ...seedData, version: CURRENT_DATA_VERSION, snapshots: [snapshot] }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const restored = outcome.data.snapshots?.[0];
    expect(restored?.assetRegisterHash).toBe('8f31fbe721e377fcce1fc4671f115f61d4646c6cb21d5e3b76ca825c1ede896c');
    expect(restored?.inputsHash).toBe('88215ab2b0aa3b03fd87f17225234f24458a494768da0b66ecb4f433a27b7b0a');
  });

  it('accepts a backup whose snapshot predates B-109, and does not mint a digest for it', () => {
    const preChange = {
      calculationId: 'calc-2025-pre-b109',
      taxYear: 2025,
      calculatedAt: '2026-10-14T15:56:00.672Z',
      ruleRelease: B109_RELEASE,
      inputSnapshot: { profile: seedData.profile, revenues: 100000, expenses: 40000 },
      inputsHash: '88215ab2b0aa3b03fd87f17225234f24458a494768da0b66ecb4f433a27b7b0a',
      calculationLines: [],
      output: { total: 0 },
      status: 'computed',
    };
    const outcome = validateDatasetImport(
      envelope({ ...seedData, version: CURRENT_DATA_VERSION, snapshots: [preChange] }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const restored = outcome.data.snapshots?.[0];
    // Absent stays absent. No step fills it in, because a digest minted from today's register would claim
    // that today's register produced a record this build never addressed.
    expect(restored?.assetRegisterHash).toBeUndefined();
    expect(restored?.inputsHash).toBe('88215ab2b0aa3b03fd87f17225234f24458a494768da0b66ecb4f433a27b7b0a');
  });
});

describe('import — validating writes nothing', () => {
  it('leaves the stored payload byte-identical, whatever the verdict', () => {
    const stored = JSON.stringify({ ...seedData, version: CURRENT_DATA_VERSION });
    localStorage.setItem(STORAGE_KEY, stored);

    for (const raw of ['{corrupt', envelope(seedData, { kind: 'x' }), envelope({ revenues: [] }), 'null']) {
      validateDatasetImport(raw);
    }

    expect(localStorage.getItem(STORAGE_KEY)).toBe(stored);
    // And it does not reach as far as the quarantine key either — that is the store's decision to make,
    // with the store's own reason strings, not the validator's.
    expect(localStorage.getItem(`${STORAGE_KEY}:quarantine`)).toBeNull();
  });
});
