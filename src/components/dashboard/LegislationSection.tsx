import type { LegislationItem, LegislationState } from '../../data/dashboard';
import { fmtDate } from '../../data/types';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface LegislationSectionProps {
  state: LegislationState;
}

export default function LegislationSection({ state }: LegislationSectionProps) {
  if (state.items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Legislation</CardTitle>
          <CardDescription>No verified upcoming changes.</CardDescription>
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
          <CardTitle>{isCurrent ? 'Legislation Change Affecting You' : 'Upcoming Change'}</CardTitle>
          <span className={isCurrent ? 'badge badge-danger' : 'badge badge-warning'}>
            {item.status}
          </span>
        </div>
      </CardHeader>
      <h4>{item.summary}</h4>
      <dl className="kv">
        <dt>Source</dt>
        <dd>{item.source}</dd>
        <dt>Published</dt>
        <dd>{fmtDate(item.publishedDate)}</dd>
        <dt>Effective</dt>
        <dd>{fmtDate(item.effectiveDate)}</dd>
        <dt>Status</dt>
        <dd>{item.status}</dd>
        <dt>Affected Area</dt>
        <dd>{item.affectedArea}</dd>
      </dl>
    </Card>
  );
}
