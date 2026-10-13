/**
 * PG-11 (phase 29) — the dataset export: a backup a person could actually restore from.
 *
 * ## The format decision, stated plainly
 *
 * **The export embeds the document bytes; the storage layer does not.** That is not an inconsistency, it is
 * the point of the phase:
 *
 *  - `localStorage` keeps bytes **out**, because a dataset whose every document is a base64 string inside a
 *    record hits a practical ceiling of roughly a hundred documents, and the failure arrives as a save that
 *    silently does not happen.
 *  - The backup keeps bytes **in**, because **a backup that omits the user's documents is not a backup.**
 *    A file that restores every number and loses every invoice is a corrupt file wearing a success message.
 *
 * So export reads the bytes back **out of the blob store** and inlines them into the records, and import
 * splits them back out. The emitted payload is therefore the *inline* shape at the *current* data version —
 * a shape `persistedAppDataSchema` already accepts, since `content` became optional at v21 rather than being
 * removed.
 *
 * ## What is in the file
 *
 * The dataset **verbatim**, including the `version` field. That version is why the file can be opened by a
 * build that is behind it: import runs an older payload through the existing migration chain rather than
 * guessing at its shape, and refuses a newer one instead of silently dropping fields it does not know.
 *
 * ## The failure this refuses to paper over
 *
 * **A blob that cannot be read fails the export loudly.** No partial file, no file with a note inside it, no
 * skipped document. A silently incomplete backup is worse than no backup, because the person now believes
 * they are safe.
 */
import { toInstantISO } from '../domain/date';
import { CURRENT_DATA_VERSION } from './migration';
import type { PersistedAppData } from './schema';
import type { AppData, CompanyDocument, DocTypeCode, TaxStatement } from './types';
import { DOC_SECTIONS } from './types';
import type { BlobStore } from './blobStore';

/** Distinguishes a dataset backup from any other JSON this app might one day write. */
export const DATASET_EXPORT_KIND = 'pfa-dataset-export';
/** The envelope's own version — independent of the dataset's `version`, which travels inside it. */
export const DATASET_EXPORT_VERSION = 1;

export interface DatasetExportEnvelope {
  kind: typeof DATASET_EXPORT_KIND;
  exportVersion: number;
  /** Instant the file was produced, from the domain's clock seam. */
  exportedAt: string;
  /** The dataset exactly as the save path would write it, with the document bytes inlined. */
  data: PersistedAppData;
}

/** One document whose bytes could not be read, so no file was produced. */
export interface UnreadableBlob {
  blobId: string;
  /** The file name the person would recognise, not the internal id. */
  label: string;
  reason: string;
}

export type DatasetExportResult =
  | { ok: true; envelope: DatasetExportEnvelope; file: string; embeddedBlobs: number; inlineBlobs: number }
  | { ok: false; unreadable: UnreadableBlob[] };

const DOC_CODES: DocTypeCode[] = DOC_SECTIONS.map(s => s.code);

/** A record with its bytes back where a backup can carry them: inline, and no pointer left pointing into
 *  a store the file cannot reach. */
function inlineInto<T extends CompanyDocument | TaxStatement>(record: T, bytes: string): T {
  // SAFETY: the generic keeps the record's own kind on the far side of the spread; only `content` is added
  // and `blobRef` removed, and both are optional on both bearer kinds.
  const inlined = { ...record, content: bytes } as T;
  delete inlined.blobRef;
  return inlined;
}

/**
 * Build the export file, or refuse.
 *
 * `store` may be `null` — no blob store is connected — and that is safe **only when no record points at
 * one**. A record carrying `blobRef` with no store to read it from is an unreadable document, and it goes
 * through the same loud refusal as a failed read.
 */
export async function buildDatasetExport(
  data: AppData,
  store: BlobStore | null,
  instant: Date,
): Promise<DatasetExportResult> {
  const payload: PersistedAppData = { ...data, version: CURRENT_DATA_VERSION };
  const unreadable: UnreadableBlob[] = [];
  let embeddedBlobs = 0;
  let inlineBlobs = 0;

  async function readOut(blobRef: string): Promise<{ bytes: string } | { reason: string }> {
    if (!store) return { reason: 'no blob store is connected, so the bytes cannot be read back' };
    try {
      const bytes = await store.getBlob(blobRef);
      // An absent blob is reported as loudly as a failed read. The record says its bytes are there; if the
      // store disagrees, something has already gone wrong, and the person must hear about it before a
      // backup is declared complete.
      if (bytes === null) return { reason: 'the blob store holds nothing under this reference' };
      return { bytes };
    } catch (err) {
      return { reason: err instanceof Error ? err.message : String(err) };
    }
  }

  // The four sections are rebuilt as a complete Record, because `PersistedAppData.companyDocs` is a
  // complete Record when present: spreading an optional one would widen every key to `| undefined`.
  const companyDocs = {} as Record<DocTypeCode, CompanyDocument[]>;
  for (const code of DOC_CODES) {
    const list = [...(payload.companyDocs?.[code] ?? [])];
    for (let i = 0; i < list.length; i += 1) {
      const doc = list[i];
      if (!doc.blobRef) {
        if (doc.content) inlineBlobs += 1;
        continue;
      }
      const outcome = await readOut(doc.blobRef);
      if ('reason' in outcome) {
        unreadable.push({ blobId: doc.blobRef, label: doc.nume, reason: outcome.reason });
        continue;
      }
      list[i] = inlineInto(doc, outcome.bytes);
      embeddedBlobs += 1;
    }
    companyDocs[code] = list;
  }

  const statements = [...(payload.statements ?? [])];
  for (let i = 0; i < statements.length; i += 1) {
    const statement = statements[i];
    if (!statement.blobRef) {
      if (statement.content) inlineBlobs += 1;
      continue;
    }
    const outcome = await readOut(statement.blobRef);
    if ('reason' in outcome) {
      unreadable.push({
        blobId: statement.blobRef,
        label: statement.nume ?? statement.tip,
        reason: outcome.reason,
      });
      continue;
    }
    statements[i] = inlineInto(statement, outcome.bytes);
    embeddedBlobs += 1;
  }

  if (unreadable.length > 0) return { ok: false, unreadable };

  const envelope: DatasetExportEnvelope = {
    kind: DATASET_EXPORT_KIND,
    exportVersion: DATASET_EXPORT_VERSION,
    exportedAt: toInstantISO(instant),
    data: { ...payload, companyDocs, statements },
  };

  return { ok: true, envelope, file: JSON.stringify(envelope, null, 2), embeddedBlobs, inlineBlobs };
}

/** The file name a backup is written under. The date is the local calendar date, not a UTC prefix. */
export function datasetExportFileName(instant: Date, localDate: string): string {
  return `pfa-backup-${localDate}-${toInstantISO(instant).replace(/[:.]/g, '-')}.json`;
}
