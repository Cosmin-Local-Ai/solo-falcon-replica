/**
 * TASK 7 — copy keys for the two tasks that come after this one. **Nothing here is wired yet.**
 *
 * - `provenance` is what TASK 9 renders from `snapshotRuleState(snapshot)` /
 *   `resolveSnapshotRules(snapshot)` (`src/domain/snapshots/ruleProvenance.ts`). All four states must
 *   be renderable, and the rule TASK 9 must not break is written into the copy: a digest is a content
 *   address, never a legal citation, so the article stays on screen next to it, not instead of it.
 * - `severity` is what TASK 8 renders from `FiscalThreshold.severity` / `Insight.severity`. TASK 7
 *   supplies the words; TASK 8 decides what ranks first and how it is styled.
 */
import type { ThresholdSeverity } from '../../domain/thresholds';

export const provenance = {
  /** The disclosure caption TASK 9 opens for a figure. */
  label: 'Regulile din spatele acestei cifre',
  /** `pinned` — the release is registered and the recorded digest verifies. */
  pinned: (releaseId: string): string =>
    `Calculul folosește pachetul de reguli ${releaseId}, iar digestul înregistrat se potrivește cu cel al pachetului.`,
  /**
   * `drifted` — the registered rules no longer match the recorded digest. This is an in-place edit of
   * a published rule set and must be surfaced, never repaired by re-hashing.
   */
  drifted:
    'Regulile înregistrate acum nu mai corespund digestului consemnat la acest calcul: pachetul a fost modificat după calcul. Aplicația afișează neconcordanța și nu recalculează digestul.',
  /** `unregistered` — this build does not carry the release the record names. */
  unregistered: (releaseId: string): string =>
    `Această aplicație nu conține pachetul de reguli ${releaseId} la care face referire calculul.`,
  /** `unpinned` — the record predates content addressing (`ruleSetHash === null`). */
  unpinned:
    'Înregistrarea este anterioară adresării prin digest, așa că regulile din spatele acestei cifre nu pot fi reconstituite.',
  /** Shown wherever a digest appears next to the article it rests on. */
  digestIsNotACitation:
    'Digestul este o adresă de conținut, nu o prevedere legală; articolul rămâne afișat alături de el.',
  /** `FiscalThreshold.ruleRelease` is `string | null` — TASK 9 must render both. */
  noRelease: 'Acest prag nu este legat de un pachet de reguli înregistrat.',
} as const;

/**
 * Severity words for TASK 8. The ranking and the styling are TASK 8's decision, not this file's.
 * Each word says what the person should do about it, and `none` says that honestly: a row that is
 * far from its level does not need attention now — it is not labelled with a word that sounds like
 * a milder version of the next one.
 */
export const severity: Record<ThresholdSeverity, string> = {
  none: 'nu necesită atenție imediată',
  low: 'prioritate scăzută',
  medium: 'prioritate medie',
  high: 'prioritate ridicată',
};
