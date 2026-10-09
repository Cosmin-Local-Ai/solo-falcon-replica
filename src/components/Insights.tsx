import type { AttentionItem } from '../domain/attention';
import { insights as insightCopy, attention as attentionCopy } from '../ui/copy';
import { severityBadgeClass, severityLabel } from './ui/severityBadge';

interface InsightsProps {
  insights: AttentionItem[];
}

/**
 * Observații — the observation surface of the attention model.
 *
 * These are the items whose `state` says something the person has to KNOW (a legal level that is in
 * play, a conclusion the engine withheld, a date the aggregate could not place). Everything whose
 * state says something they have to DO is routed to *Ce trebuie să faci* instead, by
 * `partitionAttention` in the domain — so no issue appears here and there at the same time.
 *
 * TASK 8 also collapsed the empty card: a section with nothing to say is not mounted at all. The old
 * component rendered a full card captioned „Ești la zi…”, which read as a result rather than as the
 * absence of one.
 */
export default function Insights({ insights }: InsightsProps) {
  if (insights.length === 0) return null;

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">{insightCopy.title}</h2>
      </div>
      <div className="card-body">
        {insights.map((item) => (
          <div
            key={item.id}
            className="attention-row"
            data-severity={item.severity}
            data-state={item.state}
            data-source={item.source}
          >
            <div className="row between">
              <div>{item.title}</div>
              <span className={`badge ${severityBadgeClass(item.severity)}`}>
                {severityLabel(item.severity)}
              </span>
            </div>
            <div className="hint">{item.description}</div>
            {item.action ? <div className="hint">{item.action}</div> : null}
            {item.target ? (
              <a className="attention-target" href={item.target.href}>
                {attentionCopy.openTarget}
                {item.target.record
                  ? ` ${attentionCopy.recordReference(item.target.record.reference)}`
                  : ''}
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
