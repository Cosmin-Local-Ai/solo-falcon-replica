import type { Deadline } from '../../domain/deadlines';
import { classifyDeadline, daysRemaining } from '../../domain/deadlines';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';

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

/** Status → badge class. */
const STATUS_BADGE: Record<Deadline['status'], string> = {
  active: 'badge-info',
  not_applicable: 'badge-neutral',
};

/** Status → Romanian badge text (raw enum values are never rendered). */
const STATUS_LABEL: Record<Deadline['status'], string> = {
  active: 'Activ',
  not_applicable: 'Neaplicabil',
};

/** Romanian labels for raw applies-to keys (never render raw keys). */
const APPLIES_TO_LABEL: Record<string, string> = {
  pfa: 'PFA',
  new_pfa: 'PFA nou',
  'vat-registered-pfa': 'PFA înregistrat în scop de TVA',
};

/** Human-readable label derived from the event type (presentation only). */
function labelFor(d: Deadline): string {
  switch (d.eventType) {
    case 'd212_filing':
      return 'Depunere D212';
    case 'cas_quarterly':
      return 'CAS trimestrial';
    case 'cass_quarterly':
      return 'CASS trimestrial';
    case 'income_tax_advance':
      return 'Avans impozit pe venit';
    case 'pfa_estimated_declaration':
      return 'Declarație estimativă PFA';
    case 'vat_registration':
      return 'Înregistrare TVA';
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
  // Defensive upcoming-only guard (domain classification, not local date
  // math): null-dated and past deadlines never render as upcoming.
  const upcoming = deadlines.filter((d) => classifyDeadline(d, asOfDate) === 'upcoming');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Termene limită</CardTitle>
        <CardDescription>Termene limită viitoare de depunere, la data de {formatDate(asOfDate)}</CardDescription>
      </CardHeader>
      {upcoming.length === 0 ? (
        <p className="hint">Niciun termen limită viitor</p>
      ) : (
        upcoming.map((d) => {
          // Guard: after the filter d.date is non-null; kept defensively.
          const days = d.date === null ? null : daysRemaining(d.date, asOfDate);
          return (
            <div key={d.deadlineId} className="item-row">
              <div>
                <strong className="item-title">{labelFor(d)}</strong>
                <div className="hint">{APPLIES_TO_LABEL[d.appliesTo] ?? d.appliesTo}</div>
                <div className="item-meta">
                  {d.date === null || days === null
                    ? 'Neaplicabil'
                    : `${formatDate(d.date)} (${days === 1 ? '1 zi rămasă' : `${days} zile rămase`})`}
                </div>
              </div>
              <span className={`badge ${STATUS_BADGE[d.status]}`}>{STATUS_LABEL[d.status] ?? d.status}</span>
            </div>
          );
        })
      )}
    </Card>
  );
}
