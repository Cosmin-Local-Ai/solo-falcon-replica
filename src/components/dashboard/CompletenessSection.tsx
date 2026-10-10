import type { CompletenessReport } from '../../domain/completeness';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { checkLabel, completeness as completenessCopy } from '../../ui/copy';

/**
 * CompletenessSection (Step 22, upgraded in Step 31, weighted in PG-1) — presentational only.
 *
 * Formats and presents a `CompletenessReport`: no completeness calculation, no data fetching, no
 * persistence. Only the real satisfied/total counts and the real amount coverage from the report are
 * shown (no invented score); every check is listed with its real satisfied/unsatisfied state and
 * `detail`, and unsatisfied checks stay visible with the calm danger-soft row styling.
 *
 * PG-1 added the weighted line and removed the row that used to be labelled „Estimare impozit”. That
 * row asked whether a calculation had run and counted running as evidence of completeness — the same
 * profile that dropped a five-thousand-lei expense out of the base still satisfied it. The weighted
 * line measures the thing the old row only gestured at: how much of the recorded money the estimate
 * actually describes.
 */

export interface CompletenessSectionProps {
  completeness: CompletenessReport;
}

export default function CompletenessSection({ completeness }: CompletenessSectionProps) {
  const { checks, satisfiedCount, totalCount, coverage } = completeness;
  return (
    <Card
      header={
        <CardHeader>
          <CardTitle>{completenessCopy.title}</CardTitle>
          <CardDescription>
            {satisfiedCount} {completenessCopy.ofWord} {totalCount} {completenessCopy.checksSatisfied}
          </CardDescription>
        </CardHeader>
      }
    >
      <div className="row between amount-coverage" data-amount-coverage>
        <div>
          <div className="check-title">{completenessCopy.amountLead}</div>
          <div className="hint">{completenessCopy.amountNote}</div>
        </div>
        {coverage.percent === null ? (
          <span className="badge badge-neutral">{completenessCopy.amountNothingRecorded}</span>
        ) : (
          <span
            className={`badge ${coverage.percent === 100 ? 'badge-success' : 'badge-warning'}`}
            data-amount-percent={coverage.percent}
          >
            {coverage.percent}%
          </span>
        )}
      </div>
      {checks.length === 0 ? (
        <p className="hint">{completenessCopy.empty}</p>
      ) : (
        checks.map((c) => (
          <div key={c.key} className={`row between check-row${c.satisfied ? '' : ' missing'}`}>
            <div>
              <div className="check-title">{checkLabel(c.key)}</div>
              <div className="hint">{c.detail}</div>
            </div>
            <span className={c.satisfied ? 'badge badge-success' : 'badge badge-danger'}>
              {c.satisfied ? completenessCopy.satisfiedBadge : completenessCopy.unsatisfiedBadge}
            </span>
          </div>
        ))
      )}
    </Card>
  );
}
