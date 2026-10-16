/**
 * TASK 7 wrote these keys; **TASK 9 wired them.** They are what the surfaces render from
 * `snapshotRuleState(snapshot)` / `resolveSnapshotRules(snapshot)` /
 * `describeSnapshotRuleProvenance(snapshot)` (`src/domain/snapshots/ruleProvenance.ts`). All four
 * record states plus `no_release` are renderable, and the rule TASK 9 must not break is written into
 * the copy: a digest is a content address, never a legal citation, so the article stays on screen next
 * to it, not instead of it.
 *
 * Wording note (TASK 9): `noRelease` used to read `Acest prag nu este legat…`. It is now generic
 * because it is rendered by every attention row and by the legislation card, not only by a threshold
 * row. `digest` stays `digest` here: `phases/21_language_layer.md` §13 lists the `digest` → `amprentă`
 * question as awaiting the user's native-speaker ruling, and half-renaming the family would be worse
 * than leaving it consistent.
 *
 * - `severity` is what TASK 8 renders from `FiscalThreshold.severity` / `Insight.severity`. TASK 7
 *   supplies the words; TASK 8 decides what ranks first and how it is styled.
 */
import type { ThresholdSeverity } from '../../domain/thresholds';

export const provenance = {
  /** The disclosure caption TASK 9 opens for a figure. */
  label: 'Regulile din spatele acestei cifre',
  /** The same disclosure on a card that lists rows rather than one figure (Legislație). */
  labelRules: 'Regulile din spatele acestor rânduri',
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
  /**
   * `no_release` — this surface has no calculation record to ask, so there is no digest to verify.
   * `FiscalThreshold.ruleRelease` is `string | null` for exactly this case.
   */
  noRelease: 'Această cifră nu este legată de un pachet de reguli înregistrat.',
  /** Labels the digest the RECORD carries — the one nothing may overwrite. */
  digestRecorded: 'Digest consemnat în înregistrare',
  /** Labels the digest the registered package hashes to today. Display only; never written back. */
  digestRegisteredNow: 'Digestul pachetului înregistrat acum',
  /** The provisions the money-producing rules cite — printed beside the digest, never after it. */
  citationsLabel: 'Prevederi pe care se sprijină calculul',
  /**
   * The same list under `drifted`. It cannot carry the first label: once the package no longer hashes to
   * what the record says, the app no longer knows which articles produced the figure, so it names these
   * as the ones the package holds now.
   */
  citationsLabelCurrent: 'Prevederi din pachetul înregistrat acum',
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
