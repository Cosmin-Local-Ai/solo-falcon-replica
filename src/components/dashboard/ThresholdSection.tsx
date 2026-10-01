import type { FiscalThreshold } from '../../domain/thresholds';
import { formatLei } from '../../lib/format';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';

/**
 * ThresholdSection (Step 22) — presentational only.
 *
 * Formats and presents `FiscalThreshold` items: no threshold calculation,
 * no data fetching, no persistence. The only derived value is the progress
 * bar width from currentValue/thresholdValue (allowed presentation math).
 */

/** Status → badge class (green / amber / red). */
const STATUS_BADGE: Record<FiscalThreshold['status'], string> = {
  ok: 'badge-success',
  warning: 'badge-warning',
  breached: 'badge-danger',
};

/** Status → bar color (green / amber / red). */
const STATUS_COLOR: Record<FiscalThreshold['status'], string> = {
  ok: 'var(--success-text)',
  warning: 'var(--warning-text)',
  breached: 'var(--danger-text)',
};

/** Human-readable label derived from type + affected tax (presentation only). */
function labelFor(t: FiscalThreshold): string {
  const tax = t.affectedTax.toUpperCase();
  switch (t.type) {
    case 'min-base':
      return `${tax} minimum base`;
    case 'max-base':
      return `${tax} maximum base`;
    case 'registration':
      return `${tax} registration threshold`;
  }
}

/**
 * Progress percentage from currentValue/thresholdValue only.
 * Capped at 100%, floored at 0; guarded for thresholdValue === 0.
 */
function progressPercent(currentValue: number, thresholdValue: number): number {
  if (thresholdValue === 0) return 0;
  const pct = (currentValue / thresholdValue) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}

export interface ThresholdSectionProps {
  thresholds: FiscalThreshold[];
}

export default function ThresholdSection({ thresholds }: ThresholdSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Thresholds</CardTitle>
        <CardDescription>Fiscal thresholds vs. current values</CardDescription>
      </CardHeader>
      {thresholds.length === 0 ? (
        <p className="hint">No thresholds</p>
      ) : (
        thresholds.map((t) => (
          <div key={t.thresholdId}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 12,
              }}
            >
              <div>
                <strong style={{ fontSize: 13 }}>{labelFor(t)}</strong>
                <div className="hint">{t.affectedDomain}</div>
              </div>
              <span className={`badge ${STATUS_BADGE[t.status]}`}>{t.status}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
              <span>
                Current: <strong>{formatLei(t.currentValue)}</strong>
              </span>
              <span>
                Threshold: <strong>{formatLei(t.thresholdValue)}</strong>
              </span>
              <span>
                Distance: <strong>{formatLei(t.distance)}</strong>
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: 'var(--border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progressPercent(t.currentValue, t.thresholdValue)}%`,
                  height: '100%',
                  background: STATUS_COLOR[t.status],
                }}
              />
            </div>
            <p className="hint" style={{ margin: 0 }}>
              {t.source}
            </p>
          </div>
        ))
      )}
    </Card>
  );
}
