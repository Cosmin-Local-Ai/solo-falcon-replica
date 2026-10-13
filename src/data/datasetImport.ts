/**
 * PG-11 (phase 29) — dataset import: validate everything, then write anything.
 *
 * ## The contract, in order
 *
 * 1. Parse and validate the **whole** payload **before any write.**
 * 2. If it carries an older `version`, run it through the **existing migration chain** — that is why the
 *    version is in the file at all.
 * 3. **On any failure: write nothing at all.** The dataset that was there is byte-identical afterwards, and
 *    the rejected payload goes to quarantine under the D-3 contract.
 *
 * Point 3 is not a new contract and must not become one. `data/quarantine.ts` already decides what happens
 * to a payload this app refuses: the bytes are copied verbatim to a sibling key before anything else
 * happens, the first rejected copy is never overwritten, later rejections append to a bounded history, and
 * the app says so. Import calls that same function with the same reasons. A second quarantine path would be
 * the B-70 mistake in a new coat — two producers answering one question, drifting the first time either
 * moves.
 *
 * ## What this module does *not* do
 *
 * It does not write. It reads a string and answers a question: is this a dataset this build can hold, and
 * at which version did it arrive? The caller — `data/store.tsx` — is the only thing that can change state,
 * which is what makes "write nothing on failure" a structural fact rather than a promise.
 *
 * ## Do not confuse this with the document upload path
 *
 * `pages/Documents.tsx` puts a file onto a record. This replaces the person's whole world. They look similar
 * — both take a `File` — and sharing code between them would mean the path that adds an attachment inherits
 * the path that can erase a fiscal year, or the reverse.
 */
import {
  UnsupportedDataVersionError,
  CURRENT_DATA_VERSION,
  migratePersistedData,
  readStoredVersion,
} from './migration';
import { validateAppDataPayload } from './schema';
import type { PersistedAppData } from './schema';
import type { QuarantineReason } from './quarantine';
import { DATASET_EXPORT_KIND, DATASET_EXPORT_VERSION } from './datasetExport';

export type DatasetImportValidation =
  | {
      ok: true;
      /** The payload at `CURRENT_DATA_VERSION`, ready for the load path to hand to the store. */
      data: PersistedAppData;
      fromVersion: number;
      toVersion: number;
      /** Chain steps that actually ran — so the UI can say the backup was from an older version. */
      stepsApplied: string[];
      /** When the backup was produced, if the envelope declared it. Never inferred. */
      exportedAt: string | null;
    }
  | { ok: false; reason: QuarantineReason; detail: string };

function fail(reason: QuarantineReason, detail: string): DatasetImportValidation {
  return { ok: false, reason, detail };
}

/**
 * Validate an export file without touching anything.
 *
 * The reasons returned are the load path's own `QuarantineReason` values, so a rejected import lands in the
 * same quarantine envelope, with the same banner, as a corrupt stored payload.
 */
export function validateDatasetImport(raw: string): DatasetImportValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return fail('unparseable-json', err instanceof Error ? err.message : String(err));
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return fail('schema-invalid', 'expected a dataset backup object');
  }
  const envelope = parsed as Partial<{
    kind: unknown;
    exportVersion: unknown;
    exportedAt: unknown;
    data: unknown;
  }>;

  if (envelope.kind !== DATASET_EXPORT_KIND) {
    return fail('schema-invalid', `not a dataset backup (kind is ${JSON.stringify(envelope.kind) ?? 'absent'})`);
  }
  if (envelope.exportVersion !== DATASET_EXPORT_VERSION) {
    return fail(
      'schema-invalid',
      `unsupported backup format version ${JSON.stringify(envelope.exportVersion) ?? 'absent'}`,
    );
  }
  if (!envelope.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) {
    return fail('schema-invalid', 'the backup carries no dataset');
  }

  const validated = validateAppDataPayload(envelope.data);
  if (!validated.ok) return fail(validated.reason, validated.detail);

  const fromVersion = readStoredVersion(validated.data);
  if (fromVersion > CURRENT_DATA_VERSION) {
    // A backup from a newer build. Refused, not down-migrated: silently dropping the fields this build does
    // not know would replace the person's data with a smaller version of it.
    return fail('unsupported-version', `backup declares version ${fromVersion}, this build understands ${CURRENT_DATA_VERSION}`);
  }

  try {
    const outcome = migratePersistedData(validated.data);
    return {
      ok: true,
      data: outcome.data,
      fromVersion: outcome.fromVersion,
      toVersion: outcome.toVersion,
      stepsApplied: outcome.stepsApplied,
      exportedAt: typeof envelope.exportedAt === 'string' ? envelope.exportedAt : null,
    };
  } catch (err) {
    if (err instanceof UnsupportedDataVersionError) return fail('unsupported-version', err.message);
    return fail('schema-invalid', `migration failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
