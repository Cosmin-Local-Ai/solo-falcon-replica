import type { ActionItem } from '../../data/dashboard';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { checkLabel } from './checkLabels';

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

/** Presentation-only source labels (the data layer defines the sources). */
const SOURCE_LABEL: Record<ActionItem['source'], string> = {
  deadline: 'Termen limită',
  completeness: 'Completitudine',
  tax: 'Impozit',
};

/** Presentation-only Romanian labels for deadline `appliesTo` keys.
 *
 * Phase 9b removed `cas_quarterly`, `cass_quarterly` and `pfa_estimated_declaration`: those
 * obligations do not exist in fiscal year 2026 (see the `DeadlineEventType` doc comment in
 * src/domain/deadlines.ts). `new_pfa` keeps its key but no longer reads "Declarație estimativă
 * PFA" — that label named an obligation abrogated on 01-01-2025, and no rule emits `new_pfa` today.
 */
const DEADLINE_LABELS: Record<string, string> = {
  pfa: 'PFA',
  new_pfa: 'PFA nou',
  'vat-registered-pfa': 'Înregistrare în scop de TVA',
  cas_annual: 'CAS anual',
  cass_annual: 'CASS anual',
  vat_periodic: 'TVA periodic',
  vat_registration: 'Înregistrare în scop de TVA',
};

export interface ActionSectionProps {
  actions: ActionItem[];
}

export default function ActionSection({ actions }: ActionSectionProps) {
  const labelFor = (item: ActionItem): string => {
    if (item.source === 'completeness') return checkLabel(item.label);
    if (item.source === 'deadline') return DEADLINE_LABELS[item.label] ?? item.label;
    return item.label;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ce trebuie să faci</CardTitle>
        <CardDescription>
          {actions.length === 0
            ? 'Nimic nu necesită atenția ta în acest moment.'
            : `${actions.length} item de rezolvat`}
        </CardDescription>
      </CardHeader>
      {actions.length === 0 ? (
        <p className="muted">Totul este la zi — nimic nu necesită atenție.</p>
      ) : (
        actions.map((item) => (
          <div key={item.id} className="row between">
            <span className="action-label">{labelFor(item)}</span>
            <span className="badge badge-neutral">{SOURCE_LABEL[item.source]}</span>
          </div>
        ))
      )}
    </Card>
  );
}
