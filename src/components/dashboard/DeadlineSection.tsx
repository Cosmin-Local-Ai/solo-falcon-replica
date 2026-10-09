import type { Deadline } from '../../domain/deadlines';
import { classifyDeadline, daysRemaining } from '../../domain/deadlines';
import { formatRoCalendarDate } from '../../domain/date';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { deadlineAppliesToLabels, deadlines as deadlineCopy } from '../../ui/copy';

/**
 * DeadlineSection (Step 22, verified Step 31) — presentational only.
 *
 * Formats and presents upcoming `Deadline` items: no deadline calculation,
 * no data fetching, no persistence. Temporal classification uses the domain
 * `classifyDeadline(deadline, asOfDate)` and days remaining come from the
 * pure `daysRemaining(deadlineDate, asOfDate)` helper — no local date math.
 * Only deadlines classified as `'upcoming'` are shown; past, due-today, and
 * null-dated deadlines are excluded (defensively, on top of the data layer's
 * `filterUpcoming`).
 */

/** Human-readable label derived from the event type (presentation only).
 *
 * Phase 9b removed the four cases whose obligations do not exist in fiscal year 2026 —
 * `cas_quarterly`, `cass_quarterly`, `income_tax_advance` and `pfa_estimated_declaration`. See the
 * `DeadlineEventType` doc comment in src/domain/deadlines.ts for the abrogation evidence. The map is
 * `Record<DeadlineEventType, string>`, so a label can no longer exist for an event type that has no
 * rule behind it, and an event type cannot be rendered without a label.
 */
function labelFor(d: Deadline): string {
  return deadlineCopy.eventLabels[d.eventType];
}

export interface DeadlineSectionProps {
  deadlines: Deadline[];
  asOfDate: string;
}

export default function DeadlineSection({ deadlines, asOfDate }: DeadlineSectionProps) {
  // Defensive upcoming-only guard (domain classification, not local date
  // math): null-dated and past deadlines never render as upcoming.
  const upcoming = deadlines.filter((d) => classifyDeadline(d, asOfDate) === 'upcoming');

  return (
    <Card
      header={
        <CardHeader>
          <CardTitle>{deadlineCopy.title}</CardTitle>
          <CardDescription>
            {deadlineCopy.descriptionLead} {formatRoCalendarDate(asOfDate)}
          </CardDescription>
        </CardHeader>
      }
    >
      {upcoming.length === 0 ? (
        <p className="hint">{deadlineCopy.empty}</p>
      ) : (
        upcoming.map((d) => {
          // Guard: after the filter d.date is non-null; kept defensively.
          const days = d.date === null ? null : daysRemaining(d.date, asOfDate);
          return (
            <div key={d.deadlineId} className="item-row">
              <div>
                <strong className="item-title">{labelFor(d)}</strong>
                <div className="hint">{deadlineAppliesToLabels[d.appliesTo] ?? d.appliesTo}</div>
                <div className="item-meta">
                  {d.date === null || days === null
                    ? deadlineCopy.notApplicable
                    : `${formatRoCalendarDate(d.date)} (${days === 1 ? deadlineCopy.oneDayLeft : deadlineCopy.daysLeft(days)})`}
                </div>
              </div>
              <span className={`badge ${d.status === 'active' ? 'badge-info' : 'badge-neutral'}`}>
                {deadlineCopy.statusLabels[d.status]}
              </span>
            </div>
          );
        })
      )}
    </Card>
  );
}
