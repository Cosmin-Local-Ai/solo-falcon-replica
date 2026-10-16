/**
 * Quarantine for payloads the app refuses to load (decision D-3).
 *
 * Before Phase 7 a payload that failed validation caused a silent, total reset:
 * `store.tsx` swapped in `seedData` and the save effect immediately overwrote the
 * user's stored dataset with it. Nothing was recoverable and nothing was said.
 * B-11.
 *
 * The contract now:
 * - The rejected payload is copied VERBATIM to a separate key before anything
 *   else happens, so the bytes are recoverable by the user or by support.
 * - The first rejected copy is never overwritten. Later rejections are appended
 *   to a bounded history, newest first.
 * - The app then loads seed data and says so (`dataOrigin: 'quarantined'`),
 *   which the shell renders as a banner.
 * - The normal save path writes ONLY the data key, so a quarantine can never be
 *   clobbered by the next save (acceptance criterion 4).
 */
import { epochMs, toInstantISO, now } from '../domain/date';

/** Data key + `:quarantine`. Deliberately a sibling, not a replacement. */
export const QUARANTINE_KEY_SUFFIX = ':quarantine';

/**
 * Bound on retained rejected copies (the preserved first copy plus history).
 * Unbounded growth would eventually make the quota failure that corrupts data
 * more likely, so old history is dropped oldest-first — while the FIRST copy,
 * the one most likely to be the user's original data, is never dropped.
 */
export const QUARANTINE_HISTORY_LIMIT = 10;

export type QuarantineReason =
  /** Not JSON at all (truncated write, hand-edited value, foreign key content). */
  | 'unparseable-json'
  /** Parsed as JSON but not a valid dataset: missing/extra/wrong-typed fields. */
  | 'schema-invalid'
  /** Written by a newer build than this one. */
  | 'unsupported-version'
  /** Reading the key itself threw (disabled/blocked storage, private-mode limits). */
  | 'storage-read-error';

export interface QuarantineAttempt {
  quarantinedAt: string;
  reason: QuarantineReason;
  /** Human-usable detail: the JSON error, or the failing schema paths. */
  detail: string;
  /** The rejected payload exactly as stored. `null` only when the read itself failed. */
  raw: string | null;
}

export interface QuarantineRecord extends QuarantineAttempt {
  /** Shape of the quarantine envelope itself, so it can evolve independently. */
  envelopeVersion: 1;
  /**
   * Later rejections, newest first, capped at `QUARANTINE_HISTORY_LIMIT - 1`.
   * The top-level fields are the FIRST rejection and are never overwritten.
   */
  laterAttempts: QuarantineAttempt[];
}

let counter = 0;
const uid = () => `${epochMs().toString(36)}-${(counter++).toString(36)}`;

/** The quarantine key for a data key. */
export function quarantineKey(dataKey: string): string {
  return `${dataKey}${QUARANTINE_KEY_SUFFIX}`;
}

/**
 * Copy the rejected payload to the quarantine key.
 *
 * Returns the record that now stands in quarantine (which, when one was already
 * there, is the pre-existing one — the first copy wins and is never replaced).
 * Best-effort: if the write itself fails (quota, blocked storage) the caller
 * still proceeds to seed data, and the failure is logged rather than thrown —
 * losing the quarantine copy must never turn into losing the session.
 */
export function quarantinePayload(
  key: string,
  raw: string | null,
  reason: QuarantineReason,
  detail: string,
  instant: Date = now(),
): { record: QuarantineRecord | null; writeFailed: boolean } {
  const attempt: QuarantineAttempt = {
    quarantinedAt: toInstantISO(instant),
    reason,
    detail,
    raw,
  };
  try {
    const existing = readQuarantine(key);
    if (existing) {
      const record: QuarantineRecord = {
        ...existing,
        laterAttempts: [attempt, ...existing.laterAttempts].slice(0, QUARANTINE_HISTORY_LIMIT - 1),
      };
      localStorage.setItem(key, JSON.stringify(record));
      return { record, writeFailed: false };
    }
    const record: QuarantineRecord = { ...attempt, envelopeVersion: 1, laterAttempts: [] };
    localStorage.setItem(key, JSON.stringify(record));
    return { record, writeFailed: false };
  } catch (err) {
    console.warn('[quarantine] failed to preserve rejected payload', err);
    return { record: null, writeFailed: true };
  }
}

/** Read the quarantined payload, or null when there is none / it is unreadable. */
export function readQuarantine(key: string): QuarantineRecord | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<QuarantineRecord>;
    if (typeof candidate.quarantinedAt !== 'string' || typeof candidate.reason !== 'string') {
      return null;
    }
    return {
      envelopeVersion: 1,
      quarantinedAt: candidate.quarantinedAt,
      reason: candidate.reason as QuarantineReason,
      detail: typeof candidate.detail === 'string' ? candidate.detail : '',
      raw: typeof candidate.raw === 'string' ? candidate.raw : null,
      laterAttempts: Array.isArray(candidate.laterAttempts) ? candidate.laterAttempts : [],
    };
  } catch {
    return null;
  }
}

/** One-line, user-facing summary for the banner. No stack traces, no jargon. */
const QUARANTINE_REASON_TEXT: Record<QuarantineReason, string> = {
  'unsupported-version': 'datele au fost salvate de o versiune mai nouă a aplicației',
  'unparseable-json': 'datele salvate sunt corupte',
  'storage-read-error': 'nu am putut citi datele salvate',
  'schema-invalid': 'datele salvate nu sunt valide',
};

export function quarantineSummary(record: QuarantineRecord): string {
  const count = record.laterAttempts.length + 1;
  const when = record.quarantinedAt.slice(0, 10);
  const what = QUARANTINE_REASON_TEXT[record.reason] ?? QUARANTINE_REASON_TEXT['schema-invalid'];
  return (
    `${what}. Am păstrat o copie din ${when}` +
    `${count > 1 ? ` (${count} copii)` : ''} și am încărcat datele de exemplu.`
  );
}
