import { fmtDate } from '../../data/types';
import { fx, notes } from '../../ui/copy';
import { InterpretationNote } from './InterpretationNote';
import type { FxRateRecord } from '../../domain/fx/rates';

/**
 * TASK 10a — what a recorded exchange rate looks like on screen.
 *
 * Three things this component is responsible for, none of which a plain table would do:
 *
 * 1. **Provenance is rendered, not optional.** BNR's terms require *indicarea sursei*, and a converted
 *    figure the user cannot trace to a dated, sourced rate is a figure they cannot defend. So the series
 *    code, the source and the fetch date are always shown — they are not hidden behind a disclosure.
 *
 * 2. **An internal token never reaches the screen.** `rateKind` and `entryMode` are `snake_case` codes;
 *    they render through `copy.fx.rateKindLabels` / `entryModeLabels`. This is the exact defect TASK 7's
 *    guard was written for (`personal_or_family_use` was once a dropdown label).
 *
 * 3. **Every uncertainty the record carries gets a note, and the note never resolves it.** A carried-forward
 *    rate, a provisional annual average and the unresolved conversion-rule conflict each get one plain
 *    sentence through `InterpretationNote`, saying what the law does not settle and what the app does.
 *    The carry-forward in particular must never read as a statute: the rule it borrows lives in the CASS
 *    articles, and the note names that analogy rather than implying the analogy is the law.
 */
export interface FxRateProvenanceProps {
  records: readonly FxRateRecord[];
  /** Stable id so a test or a disclosure can point at the block. */
  id?: string;
  className?: string;
}

/** The date a record is keyed to — a day for a daily rate, a year for an average. */
function validForLabel(record: FxRateRecord): string {
  return record.rateKind === 'daily_reference' && record.rateDate !== undefined
    ? fmtDate(record.rateDate)
    : String(record.rateYear ?? '');
}

export function FxRateProvenance({ records, id, className }: FxRateProvenanceProps) {
  const carried = records.filter((r) => r.carriedFrom !== undefined);
  const provisional = records.filter((r) => r.provisional);

  return (
    <div className={className ? `fx-rate-provenance ${className}` : 'fx-rate-provenance'} id={id} data-surface="fx-rates">
      {records.length === 0 ? <p className="hint">{fx.empty}</p> : (
        <table className="table">
          <thead>
            <tr>
              <th>{fx.columns.currency}</th>
              <th>{fx.columns.rate}</th>
              <th>{fx.columns.kind}</th>
              <th>{fx.columns.validFor}</th>
              <th>{fx.columns.source}</th>
              <th>{fx.columns.status}</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={`${record.currency}-${record.rateKind}-${record.rateDate ?? record.rateYear}`}>
                <td>{record.currency}</td>
                {/* The printed decimal, verbatim. A rate is a published datum, not a money amount:                re-formatting it would put a display convention between the user and the number BNR                published, the same reason `Bani` never passes through `Intl`. */}
                <td>{record.rate}</td>
                <td>{fx.rateKindLabels[record.rateKind]}</td>
                <td>{validForLabel(record)}</td>
                <td>
                  <span>{record.seriesCode}</span>
                  {/* A separate element, not a template literal glued to the series: an interpolated
                      separator would split the label across text nodes and make it unselectable. */}
                  <span className="hint"> · </span>
                  <span>{fx.entryModeLabels[record.entryMode]}</span>
                </td>
                <td>{record.provisional ? fx.provisionalBadge : fx.finalBadge}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {carried.map((record) => (
        <InterpretationNote
          key={`carry-${record.currency}-${record.rateDate}`}
          note={`${fx.carriedFrom(record.carriedFrom ?? '')} ${notes.fxCarryForward}`}
          citation="art. 68^3 alin. (4); art. 85 alin. (4)"
        />
      ))}

      {provisional.length > 0 ? <InterpretationNote note={notes.fxProvisionalAnnual} /> : null}

      <InterpretationNote
        note={notes.fxConversionConflict}
        citation="HG 1/2016, Titlul IV, Cap. II, pct. 7 alin. (6); art. 9 alin. (3) lit. b) + alin. (4) Codul fiscal"
      />
    </div>
  );
}
