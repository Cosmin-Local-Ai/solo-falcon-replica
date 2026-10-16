import type { SnapshotRuleProvenance } from '../../domain/snapshots/ruleProvenance';
import { provenance as provenanceCopy } from '../../ui/copy';

/**
 * TASK 9 — the one place a rule-provenance answer reaches the screen.
 *
 * Every surface that attributes a figure (the estimate hero, an attention row, a legislation card)
 * renders through this component, so the four record states cannot be worded differently in different
 * files and the two invariants cannot be dropped by one careless call site:
 *
 * 1. **The digest shown is the digest the record carries.** `recordedHash` is printed verbatim and a
 *    missing one is printed as missing. Nothing here re-hashes anything: for `drifted` the component
 *    shows the recorded digest *and* what the registered package hashes to now, which is the mismatch,
 *    and it writes neither back. Re-hashing to silence that warning would destroy the only evidence
 *    that a published rule set was edited in place.
 * 2. **A digest never travels alone.** Wherever a digest is printed, the provisions the
 *    money-producing rules cite are printed with it, and `copy.provenance.digestIsNotACitation` says
 *    plainly that the digest is a content address and not a provision.
 *
 * `data-provenance-state` is exposed for tests and for a reader inspecting the DOM; it is deliberately
 * unstyled beyond the row border, so the state decision stays in the domain.
 */

export interface RuleProvenanceProps {
  view: SnapshotRuleProvenance;
  id?: string;
  className?: string;
}

/** One sentence per state, all of them from `copy.provenance`. No state renders without one. */
export function provenanceSentence(view: SnapshotRuleProvenance): string {
  switch (view.state) {
    case 'pinned':
      // `pinned` cannot be reached without the record naming a release.
      return provenanceCopy.pinned(view.releaseId ?? '');
    case 'drifted':
      return provenanceCopy.drifted;
    case 'unregistered':
      return provenanceCopy.unregistered(view.releaseId ?? '');
    case 'unpinned':
      return provenanceCopy.unpinned;
    case 'no_release':
      return provenanceCopy.noRelease;
  }
}

export function RuleProvenance({ view, id, className }: RuleProvenanceProps) {
  const classes = className ? `rule-provenance ${className}` : 'rule-provenance';
  return (
    <div className={classes} data-provenance-state={view.state} id={id}>
      <p className="hint">{provenanceSentence(view)}</p>
      {view.recordedHash !== null ? (
        <p className="hint" data-digest-recorded={view.recordedHash}>
          <span className="label">{provenanceCopy.digestRecorded}</span>{' '}
          <span className="mono">{view.recordedHash}</span>
        </p>
      ) : null}
      {view.state === 'drifted' && view.registeredHash !== null ? (
        <p className="hint" data-digest-registered={view.registeredHash}>
          <span className="label">{provenanceCopy.digestRegisteredNow}</span>{' '}
          <span className="mono">{view.registeredHash}</span>
        </p>
      ) : null}
      {view.citations.length > 0 ? (
        <div className="provenance-citations">
          <div className="label">
            {view.state === 'drifted'
              ? provenanceCopy.citationsLabelCurrent
              : provenanceCopy.citationsLabel}
          </div>
          <ul>
            {view.citations.map((citation) => (
              <li key={`${citation.act}|${citation.article}`}>
                {citation.act} — {citation.article}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {view.recordedHash !== null ? <p className="hint">{provenanceCopy.digestIsNotACitation}</p> : null}
    </div>
  );
}
