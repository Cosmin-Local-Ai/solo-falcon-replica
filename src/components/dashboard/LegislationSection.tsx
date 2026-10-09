import type { LegislationItem, LegislationState } from '../../data/dashboard';
import { fmtDate } from '../../data/types';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { legislation as legislationCopy } from '../../ui/copy';

interface LegislationSectionProps {
  state: LegislationState;
}

export default function LegislationSection({ state }: LegislationSectionProps) {
  if (state.items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{legislationCopy.title}</CardTitle>
          <CardDescription>{legislationCopy.empty}</CardDescription>
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
          <CardTitle>
            {isCurrent ? legislationCopy.cardTitleCurrent : legislationCopy.cardTitleUpcoming}
          </CardTitle>
          <span className={isCurrent ? 'badge badge-danger' : 'badge badge-warning'}>
            {legislationCopy.statusLabels[item.status]}
          </span>
        </div>
      </CardHeader>
      <h4>{item.summary}</h4>
      <dl className="kv">
        <dt>{legislationCopy.source}</dt>
        <dd>{item.source}</dd>
        <dt>{legislationCopy.published}</dt>
        <dd>{fmtDate(item.publishedDate)}</dd>
        <dt>{legislationCopy.effectiveFrom}</dt>
        <dd>{fmtDate(item.effectiveDate)}</dd>
        <dt>{legislationCopy.state}</dt>
        <dd>{legislationCopy.statusLabels[item.status]}</dd>
        <dt>{legislationCopy.affectedArea}</dt>
        <dd>{item.affectedArea}</dd>
      </dl>
    </Card>
  );
}
