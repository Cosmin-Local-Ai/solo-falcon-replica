import type { CompletenessReport } from '../../domain/completeness';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';

/**
 * CompletenessSection (Step 22) — presentational only.
 *
 * Formats and presents a `CompletenessReport`: no completeness calculation,
 * no data fetching, no persistence. Only the satisfied/total counts from the
 * report are shown; missing checks are highlighted (no invented values).
 */

export interface CompletenessSectionProps {
  completeness: CompletenessReport;
}

export default function CompletenessSection({ completeness }: CompletenessSectionProps) {
  const { checks, satisfiedCount, totalCount } = completeness;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data completeness</CardTitle>
        <CardDescription>
          {satisfiedCount} of {totalCount} checks satisfied
        </CardDescription>
      </CardHeader>
      {checks.length === 0 ? (
        <p className="hint">No completeness checks</p>
      ) : (
        checks.map((c) => (
          <div
            key={c.key}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'baseline',
              padding: '6px 8px',
              borderRadius: 6,
              background: c.satisfied ? 'transparent' : 'var(--danger-soft)',
            }}
          >
            <span aria-hidden>{c.satisfied ? '✓' : '✗'}</span>
            <div>
              <strong style={{ fontSize: 13 }}>{c.key}</strong>
              <div className="hint">{c.detail}</div>
            </div>
          </div>
        ))
      )}
    </Card>
  );
}
