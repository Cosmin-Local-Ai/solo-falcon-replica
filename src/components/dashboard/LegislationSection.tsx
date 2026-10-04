import type { LegislationItem, LegislationState } from '../../data/dashboard';
import { fmtDate } from '../../data/types';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';

/** Status → Romanian badge text (raw enum values are never rendered). */
const STATUS_LABEL: Record<LegislationItem['status'], string> = {
  CURRENT: 'În vigoare',
  UPCOMING: 'Viitoare',
};

interface LegislationSectionProps {
  state: LegislationState;
}

export default function LegislationSection({ state }: LegislationSectionProps) {
  if (state.items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Legislație</CardTitle>
          <CardDescription>Nicio modificare viitoare verificată.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="stack">
      {state.items.map((item) => (
        <LegislationCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function LegislationCard({ item }: { item: LegislationItem }) {
  const isCurrent = item.status === 'CURRENT';
  return (
    <Card>
      <CardHeader>
        <div className="row">
          <CardTitle>{isCurrent ? 'Modificare legislativă care te afectează' : 'Modificare viitoare'}</CardTitle>
          <span className={isCurrent ? 'badge badge-danger' : 'badge badge-warning'}>
            {STATUS_LABEL[item.status] ?? item.status}
          </span>
        </div>
      </CardHeader>
      <h4>{item.summary}</h4>
      <dl className="kv">
        <dt>Sursă</dt>
        <dd>{item.source}</dd>
        <dt>Publicat</dt>
        <dd>{fmtDate(item.publishedDate)}</dd>
        <dt>În vigoare de la</dt>
        <dd>{fmtDate(item.effectiveDate)}</dd>
        <dt>Stare</dt>
        <dd>{STATUS_LABEL[item.status] ?? item.status}</dd>
        <dt>Zonă afectată</dt>
        <dd>{item.affectedArea}</dd>
      </dl>
    </Card>
  );
}
