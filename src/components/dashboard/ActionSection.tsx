import type { ActionItem } from '../../data/dashboard';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { actionAppliesToLabels, actions as actionsCopy, checkLabel } from '../../ui/copy';

/**
 * ActionSection (Step 22, upgraded in Step 31) — presentational only.
 *
 * Renders the real action items from the deterministic data layer
 * (`ActionItem[]` — sources: 'deadline' | 'completeness' | 'tax'). No
 * actions are invented, none are dropped: every item is listed with its
 * source, in the data layer's order. Completeness items carry the raw
 * check key as `label`; it is mapped to a plain-language display label
 * here (presentation only). Deadline items carry the raw `appliesTo` key;
 * it is mapped to a Romanian display label here as well. When there are
 * no action items, an honest "up to date" state is shown — never a blank
 * panel.
 */

export interface ActionSectionProps {
  actions: ActionItem[];
}

export default function ActionSection({ actions }: ActionSectionProps) {
  const labelFor = (item: ActionItem): string => {
    if (item.source === 'completeness') return checkLabel(item.label);
    if (item.source === 'deadline') {
      return actionAppliesToLabels[item.label] ?? item.label;
    }
    return item.label;
  };

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
          <div key={item.id} className="row between">
            <span className="action-label">{labelFor(item)}</span>
            <span className="badge badge-neutral">{actionsCopy.sourceLabels[item.source]}</span>
          </div>
        ))
      )}
    </Card>
  );
}
