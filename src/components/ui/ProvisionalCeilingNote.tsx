import { fx } from '../../ui/copy';
import { fmtDate } from '../../data/types';
import { localDateISO } from '../../domain/date';
import type { CapRateEvidence } from '../../domain/fx/capCeiling';

/**
 * B-137 (D-FX-6) — the five-point note beside a euro ceiling converted at a provisional annual average.
 *
 * Why this is a component and not a longer sentence: D-FX-6 requires that a visible note answer **all five**
 * things wherever a provisional ceiling figure appears. `InterpretationNote` is deliberately one sentence and
 * may not be widened — that shape is what keeps a note from reading as a settled conclusion. Five answers is
 * a different shape, so it gets its own, and it gets it once so no screen can render a provisional ceiling
 * with three of the five answers.
 *
 * Why it is not behind a `Disclosure`: the brief's own words are that the note "is not a tooltip for a
 * lawyer". A stand-in figure whose explanation has to be clicked open is a stand-in figure that gets read as
 * law — the failure mode this corpus has been burned by twice. So the list is always visible.
 *
 * Why the provenance lines are here and not in `FxRateProvenance`: that component explains a *stored rate
 * record* on the Settings screen. This one explains *the ceiling on this screen*, and it has to name the
 * rate that produced the number the person is looking at. Point 5 is the answer to "where did this number
 * come from", and it only counts as an answer next to the number.
 *
 * The date shown for a rate is the calendar day it was entered **on the reader's calendar**. `fetchedAt` is a
 * UTC instant; rendering its UTC day would be off by one for a person entering a rate late in the evening —
 * the same boundary `data/dashboard.ts` records for `updatedAt`.
 */
export interface ProvisionalCeilingNoteProps {
  /**
   * One entry per euro ceiling struck from a provisional annual average. A category paid in two years never
   * reaches this component — `strikeCapCeiling` refuses that before a ceiling exists — but two categories in
   * one banner can legitimately have different payment years, so points 2 and 4 are rendered per year.
   */
  ceilings: readonly { paymentYear: number; rate: CapRateEvidence }[];
  id?: string;
  className?: string;
}

/** Identity of a rate for the provenance list: the same rate behind two ceilings is named once. */
function rateIdentity(rate: CapRateEvidence): string {
  return `${rate.currency}|${rate.rate}|${rate.anchor}|${rate.entryMode}|${rate.fetchedAt}|${rate.sourceUrl}`;
}

function enteredOn(rate: CapRateEvidence): string {
  return fmtDate(localDateISO(new Date(rate.fetchedAt)));
}

export function ProvisionalCeilingNote({ ceilings, id, className }: ProvisionalCeilingNoteProps) {
  if (ceilings.length === 0) return null;

  const years = [...new Set(ceilings.map(c => c.paymentYear))].sort((a, b) => a - b);
  const seen = new Set<string>();
  const rates = ceilings
    .map(c => c.rate)
    .filter(r => r.provisional)
    .filter(r => {
      const key = rateIdentity(r);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const note = fx.provisionalCeiling;

  return (
    <div
      className={className ? `provisional-ceiling-note ${className}` : 'provisional-ceiling-note'}
      id={id}
      data-provisional-ceiling-note
      role="note"
    >
      <strong>{note.title}</strong>
      <ol className="provisional-ceiling-note__points">
        <li>{note.statedInEuro}</li>
        <li>
          {years.map(y => (
            <span key={`rule-${y}`} data-provisional-rule={y}>{note.ruleAndOpenYear(y)} </span>
          ))}
        </li>
        <li>{note.secondRule}</li>
        <li>
          {years.map(y => (
            <span key={`filing-${y}`} data-provisional-filing={y}>{note.replacedBeforeFiling(y)} </span>
          ))}
        </li>
        <li>
          <span>{note.enteredLead}</span>
          <ul className="provisional-ceiling-note__provenance">
            {rates.map(r => (
              <li key={rateIdentity(r)} data-provisional-provenance={rateIdentity(r)}>
                {note.rateRow({
                  rate: r.rate,
                  currency: r.currency,
                  year: Number(r.anchor),
                  how: fx.entryModeLabels[r.entryMode],
                  when: enteredOn(r),
                  source: r.sourceUrl,
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
