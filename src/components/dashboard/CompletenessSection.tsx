import type { CompletenessReport } from '../../domain/completeness';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { checkLabel } from './checkLabels';

/**
 * CompletenessSection (Step 22, upgraded in Step 31) — presentational only.
 *
 * Formats and presents a `CompletenessReport`: no completeness calculation,
 * no data fetching, no persistence. Only the real satisfied/total counts
 * from the report are shown (no invented percentage or score); every check
 * is listed with its real satisfied/unsatisfied state and `detail`, and
 * unsatisfied checks stay visible with the calm danger-soft row styling.
 */

export interface CompletenessSectionProps {
  completeness: CompletenessReport;
}

export default function CompletenessSection({ completeness }: CompletenessSectionProps) {
  const { checks, satisfiedCount, totalCount } = completeness;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Completitudine date</CardTitle>
        <CardDescription>
          {satisfiedCount} din {totalCount} verificări îndeplinite
        </CardDescription>
      </CardHeader>
      {checks.length === 0 ? (
        <p className="hint">Nicio verificare de completitudine</p>
      ) : (
        checks.map((c) => (
          <div key={c.key} className={`row between check-row${c.satisfied ? '' : ' missing'}`}>
            <div>
              <div className="check-title">{checkLabel(c.key)}</div>
              <div className="hint">{c.detail}</div>
            </div>
            <span className={c.satisfied ? 'badge badge-success' : 'badge badge-danger'}>
              {c.satisfied ? 'Complet' : 'Lipsă'}
            </span>
          </div>
        ))
      )}
    </Card>
  );
}
