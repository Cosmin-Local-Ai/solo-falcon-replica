import type { LegislationItem, LegislationState } from '../../data/dashboard';
import { fmtDate } from '../../data/types';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Disclosure } from '../ui/Disclosure';
import { RuleProvenance } from '../ui/RuleProvenance';
import { legislation as legislationCopy, provenance as provenanceCopy } from '../../ui/copy';

interface LegislationSectionProps {
  state: LegislationState;
}

/**
 * Legislație.
 *
 * TASK 8 fixed what the empty branch claimed. `getLegislationState` sits on a placeholder boundary —
 * there is no ingestion and no monitor — and the section used to answer that with
 * „Nicio modificare viitoare verificată.” To a user with no monitor, that reads as „there is nothing to
 * know”. It is not the same statement. The section now says the monitor is absent, and reports only
 * what the app can actually stand behind: the changes its own rule package carries, each with whether
 * it re-anchors this fiscal year.
 *
 * The HG 146/2026 case is the reason the impact line exists. The minimum wage rose to 4.325 lei on
 * 1 iulie 2026 and that changes nothing for FY2026, because CF art. 135¹ alin. (3) anchors the annual
 * multiples to the value in force on 1 January. A card that said only „the minimum wage rose” would
 * send the user to re-check thresholds that do not move; one that said only „you are unaffected” would
 * hide a published change. Both halves are on the card.
 */
export default function LegislationSection({ state }: LegislationSectionProps) {
  return (
    <div className="stack" data-monitor={state.monitor}>
      <Card
        header={
          <CardHeader>
            <CardTitle>{legislationCopy.title}</CardTitle>
            <CardDescription>
              {state.monitor === 'unavailable'
                ? legislationCopy.monitorUnavailable
                : legislationCopy.monitorActive}
            </CardDescription>
          </CardHeader>
        }
      >
        {state.items.length === 0 ? null : (
          <p className="hint">{legislationCopy.fromRulePackage}</p>
        )}
      </Card>
      {state.items.map((item) => (
        <LegislationCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function impactBadgeClass(affects: LegislationItem['impact']['affects']): string {
  if (affects === 'yes') return 'badge-danger';
  if (affects === 'unknown') return 'badge-warning';
  return 'badge-neutral';
}

function LegislationCard({ item }: { item: LegislationItem }) {
  const isCurrent = item.status === 'CURRENT';
  return (
    <Card
      header={
        <CardHeader>
          <div className="row">
            <CardTitle level="h3">
              {isCurrent ? legislationCopy.cardTitleCurrent : legislationCopy.cardTitleUpcoming}
            </CardTitle>
            <span
              className={`badge ${impactBadgeClass(item.impact.affects)}`}
              data-impact={item.impact.affects}
            >
              {legislationCopy.affectsLabels[item.impact.affects]}
            </span>
          </div>
        </CardHeader>
      }
    >
      <h4>{item.summary}</h4>
      <p className="hint" data-impact={item.impact.affects}>
        {legislationCopy.impactLabel}: {item.impact.note}
      </p>
      <dl className="kv">
        <dt>{legislationCopy.source}</dt>
        <dd>{item.source}</dd>
        {item.publishedDate ? (
          <>
            <dt>{legislationCopy.published}</dt>
            <dd>{fmtDate(item.publishedDate)}</dd>
          </>
        ) : null}
        <dt>{legislationCopy.effectiveFrom}</dt>
        <dd>{fmtDate(item.effectiveDate)}</dd>
        <dt>{legislationCopy.state}</dt>
        <dd>{legislationCopy.statusLabels[item.status]}</dd>
        <dt>{legislationCopy.affectedArea}</dt>
        <dd>{item.affectedArea}</dd>
      </dl>
      {/* TASK 9: these rows are read out of the app's own rule package, so the card says which package
          that is and whether its recorded digest still verifies. The card already names the act; the
          digest is shown beside it, never in place of it. */}
      {item.provenance ? (
        <Disclosure label={provenanceCopy.labelRules} className="legislation-provenance">
          <RuleProvenance view={item.provenance} />
        </Disclosure>
      ) : null}
    </Card>
  );
}
