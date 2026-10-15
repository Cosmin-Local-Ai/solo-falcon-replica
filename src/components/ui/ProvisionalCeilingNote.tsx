import { fx } from '../../ui/copy';
import { fmtDate } from '../../data/types';
import { localDateISO } from '../../domain/date';
import type { ProvisionalRateEvidence } from '../../domain/fx/convert';

/**
 * B-137 (D-FX-6) — the five-point note beside a lei figure that rests on a provisional annual average.
 *
 * Why this is a component and not a longer sentence: D-FX-6 requires that a visible note answer **all five**
 * things wherever a provisional figure appears. `InterpretationNote` is deliberately one sentence and may not
 * be widened — that shape is what keeps a note from reading as a settled conclusion. Five answers is a
 * different shape, so it gets its own, and it gets it **once**, so no screen can render a provisional figure
 * with three of the five answers.
 *
 * Why it is not behind a `Disclosure`: the brief's own words are that the note "is not a tooltip for a
 * lawyer". A stand-in figure whose explanation has to be clicked open is a stand-in figure that gets read as
 * law — the failure mode this corpus has been burned by twice. So the list is always visible.
 *
 * **B-144 widened the same component rather than writing a second one, and that choice is the point.** A
 * provisional euro ceiling and a provisional income measure are two consequences of one fact: a lei number
 * this app did not derive, standing in for a published number that does not exist yet. Points 4 and 5 — the
 * figure gets replaced before the return is filed, and the app is forbidden from deriving the average itself
 * — do not depend on which figure is at stake, so they are shared verbatim. Only points 1 to 3 differ,
 * because the rule, the direction of the conversion and the rival reading differ. A parallel component would
 * have been two places where "all five answers" could silently drift to four.
 *
 * Why the provenance lines are here and not in `FxRateProvenance`: that component explains a *stored rate
 * record* on the Settings screen. This one explains *the figure on this screen*, and it has to name the rate
 * that produced the number the person is looking at. Point 5 is the answer to "where did this number come
 * from", and it only counts as an answer next to the number.
 *
 * The date shown for a rate is the calendar day it was entered **on the reader's calendar**. `fetchedAt` is a
 * UTC instant; rendering its UTC day would be off by one for a person entering a rate late in the evening —
 * the same boundary `data/dashboard.ts` records for `updatedAt`.
 */
export type ProvisionalNoteSubject = 'ceiling' | 'threshold';

export interface ProvisionalCeilingNoteProps {
  /**
   * One entry per figure struck from a provisional annual average, with the year the note has to name in
   * points 2 and 4. A category paid in two years never reaches this component — `strikeCapCeiling` refuses
   * that before a ceiling exists — but two categories in one banner can legitimately have different payment
   * years, so those two points are rendered per year.
   *
   * `rate` is typed as `ProvisionalRateEvidence`, which `CapRateEvidence` satisfies structurally: the note
   * takes the ceiling's evidence and the income's evidence through one door.
   */
  figures: readonly { year: number; rate: ProvisionalRateEvidence }[];
  /**
   * Which figure is being explained. Defaults to `ceiling`, so the B-137 call site reads unchanged; a
   * threshold passes `threshold` and gets points 1 to 3 in the income rule's words plus one lead sentence
   * saying what is actually at stake.
   */
  subject?: ProvisionalNoteSubject;
  id?: string;
  className?: string;
}

/** Identity of a rate for the provenance list: the same rate behind two figures is named once. */
function rateIdentity(rate: ProvisionalRateEvidence): string {
  return `${rate.currency}|${rate.rate}|${rate.anchor}|${rate.entryMode}|${rate.fetchedAt}|${rate.sourceUrl}`;
}

function enteredOn(rate: ProvisionalRateEvidence): string {
  return fmtDate(localDateISO(new Date(rate.fetchedAt)));
}

export function ProvisionalCeilingNote({ figures, subject = 'ceiling', id, className }: ProvisionalCeilingNoteProps) {
  const years = [...new Set(figures.map(f => f.year))].sort((a, b) => a - b);
  const seen = new Set<string>();

  const note = fx.provisionalCeiling;
  // Points 1-3 are the only ones the subject changes. Read from the copy table, never written here: a
  // sentence composed in a component is a second place the law gets paraphrased.
  const opening = subject === 'threshold' ? note.threshold : note;

  // The provenance rows name the year of the figure they belong to, taken from the figure itself rather
  // than parsed back out of the rate's anchor — an anchor is a string this component has no business
  // re-interpreting, and a `Number()` on it is how a date-anchored rate would render as `NaN`.
  const rateRows: { key: string; rate: ProvisionalRateEvidence; year: number }[] = [];
  for (const f of figures) {
    if (!f.rate.provisional) continue;
    const key = rateIdentity(f.rate);
    if (seen.has(key)) continue;
    seen.add(key);
    rateRows.push({ key, rate: f.rate, year: f.year });
  }

  // Structural, not per-call-site: a note about a stand-in figure must not render beside a published one,
  // and the check lives here so no caller has to remember it. A page that forgets to filter gets a card
  // with no note, which is the correct answer — not a five-paragraph warning about a final rate.
  if (rateRows.length === 0) return null;

  return (
    <div
      className={className ? `provisional-ceiling-note ${className}` : 'provisional-ceiling-note'}
      id={id}
      data-provisional-ceiling-note
      data-provisional-subject={subject}
      role="note"
    >
      <strong>{note.title}</strong>
      {subject === 'threshold' ? <p className="provisional-ceiling-note__lead">{note.threshold.lead}</p> : null}
      <ol className="provisional-ceiling-note__points">
        <li>{opening.statedInEuro}</li>
        <li>
          {years.map(y => (
            <span key={`rule-${y}`} data-provisional-rule={y}>{opening.ruleAndOpenYear(y)} </span>
          ))}
        </li>
        <li>{opening.secondRule}</li>
        <li>
          {years.map(y => (
            <span key={`filing-${y}`} data-provisional-filing={y}>{note.replacedBeforeFiling(y)} </span>
          ))}
        </li>
        <li>
          <span>{note.enteredLead}</span>
          <ul className="provisional-ceiling-note__provenance">
            {rateRows.map(r => (
              <li key={r.key} data-provisional-provenance={r.key}>
                {note.rateRow({
                  rate: r.rate.rate,
                  currency: r.rate.currency,
                  year: r.year,
                  how: fx.entryModeLabels[r.rate.entryMode],
                  when: enteredOn(r.rate),
                  source: r.rate.sourceUrl,
                })}
              </li>
            ))}
          </ul>
          <span>{note.notDerived}</span>
        </li>
      </ol>
    </div>
  );
}
