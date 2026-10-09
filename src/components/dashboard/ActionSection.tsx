import type { AttentionItem } from '../../domain/attention';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';
import {
  actions as actionsCopy,
  attention as attentionCopy,
} from '../../ui/copy';
import { severityBadgeClass, severityLabel } from '../ui/severityBadge';

/**
 * Ce trebuie să faci — the action surface of the attention model.
 *
 * This list used to be computed by `getActionItems` from the deadlines and the completeness checks,
 * while `insights.ts` computed the same two families again for Observații. The two pipelines could not
 * see each other, so one problem reached the screen twice: a missing tax snapshot was a card
 * („Date incomplete”) and an action („Estimare impozit”), a deadline was an alert and an action, the
 * tax estimate was a card and an action.
 *
 * Now the data layer produces one list and `partitionAttention` routes each item to exactly one
 * surface from its `state` (`domain/attention.ts` `surfaceFor`). This component renders whatever it is
 * handed and decides nothing: the severity badge is styled from `item.severity`, which the domain
 * decided, and is never re-derived here from the item's kind, its status or how far away its date is.
 *
 * The empty state stays a single line rather than a card body: an empty action list is a fact worth
 * one sentence, not a panel.
 */

export interface ActionSectionProps {
  actions: AttentionItem[];
}

export default function ActionSection({ actions }: ActionSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{actionsCopy.title}</CardTitle>
        <CardDescription>
          {actions.length === 0 ? actionsCopy.emptyDescription : actionsCopy.count(actions.length)}
        </CardDescription>
      </CardHeader>
      {actions.length === 0 ? (
        <p className="muted">{actionsCopy.emptyBody}</p>
      ) : (
        actions.map((item) => (
          <div
            key={item.id}
            className="attention-row"
            data-severity={item.severity}
            data-state={item.state}
            data-source={item.source}
          >
            <div className="row between">
              <span className="action-label">{item.title}</span>
              <span className="row attention-controls">
                <span className={`badge ${severityBadgeClass(item.severity)}`}>
                  {severityLabel(item.severity)}
                </span>
                <span className="badge badge-neutral">{actionsCopy.sourceLabels[item.source]}</span>
                {item.target ? (
                  <a className="attention-target" href={item.target.href}>
                    {attentionCopy.openTarget}
                    {item.target.record
                      ? ` ${attentionCopy.recordReference(item.target.record.reference)}`
                      : ''}
                  </a>
                ) : null}
              </span>
            </div>
            {/* The reason the record carries, on the row itself: "a rejected document" is not
                actionable, "rejected: CUI nevalid" is. */}
            <div className="hint">{item.description}</div>
          </div>
        ))
      )}
    </Card>
  );
}
