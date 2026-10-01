import type { Deadline } from '../../domain/deadlines';
import { daysRemaining } from '../../domain/deadlines';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';

/**
 * DeadlineSection (Step 22) — presentational only.
 *
 * Formats and presents `Deadline` items: no deadline calculation, no data
 * fetching, no persistence. Days remaining come from the imported pure
 * `daysRemaining(deadlineDate, asOfDate)` helper, only when date !== null.
 */

/** Status → badge class. */
const STATUS_BADGE: Record<Deadline['status'], string> = {
  active: 'badge-info',
  not_applicable: 'badge-neutral',
};

/** Human-readable label derived from the event type (presentation only). */
function labelFor(d: Deadline): string {
  switch (d.eventType) {
    case 'd212_filing':
      return 'D212 filing';
    case 'cas_quarterly':
      return 'CAS quarterly';
    case 'cass_quarterly':
      return 'CASS quarterly';
    case 'income_tax_advance':
      return 'Income tax advance';
    case 'pfa_estimated_declaration':
      return 'PFA estimated declaration';
    case 'vat_registration':
      return 'VAT registration';
  }
}

/** Presentation-only date formatting (ISO YYYY-MM-DD → DD.MM.YYYY). */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export interface DeadlineSectionProps {
  deadlines: Deadline[];
  asOfDate: string;
}

export default function DeadlineSection({ deadlines, asOfDate }: DeadlineSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deadlines</CardTitle>
        <CardDescription>Filing deadlines as of {asOfDate}</CardDescription>
      </CardHeader>
      {deadlines.length === 0 ? (
        <p className="hint">No deadlines</p>
      ) : (
        deadlines.map((d) => (
          <div
            key={d.deadlineId}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 12,
            }}
          >
            <div>
              <strong style={{ fontSize: 13 }}>{labelFor(d)}</strong>
              <div className="hint">{d.appliesTo}</div>
              <div style={{ fontSize: 13 }}>
                {d.date === null
                  ? 'Not applicable'
                  : `${formatDate(d.date)} (${daysRemaining(d.date, asOfDate)} days remaining)`}
              </div>
            </div>
            <span className={`badge ${STATUS_BADGE[d.status]}`}>{d.status}</span>
          </div>
        ))
      )}
    </Card>
  );
}
