import type { FiscalThreshold } from '../../domain/thresholds';
import { formatLei } from '../../lib/format';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';

/**
 * ThresholdSection (Step 22, verified Step 31) — presentational only.
 *
 * Formats and presents `FiscalThreshold` items: no threshold calculation,
 * no data fetching, no persistence. The only derived value is the progress
 * bar width from currentValue/thresholdValue (allowed presentation math,
 * kept as a visual convenience). The threshold's meaning comes from the
 * domain fields — `type` + `affectedTax` (label), `status`,
 * `breachMeaning`, `affectedDomain`, and `source` — never from the
 * percentage.
 */

/** Status → badge class (green / amber / red / neutral). */
const STATUS_BADGE: Record<FiscalThreshold['status'], string> = {
  ok: 'badge-success',
  warning: 'badge-warning',
  breached: 'badge-danger',
  // An unmeasured threshold is not a safe threshold — it gets its own neutral badge rather
  // than being folded into `ok`.
  'review_required': 'badge-neutral',
};

/** Status → Romanian badge text (raw enum values are never rendered). */
const STATUS_LABEL: Record<FiscalThreshold['status'], string> = {
  ok: 'În limite',
  warning: 'Atenție',
  breached: 'Depășit',
  'review_required': 'De verificat',
};

/** Romanian labels for raw affected-domain keys (never render raw keys). */
const DOMAIN_LABEL: Record<string, string> = {
  'pfa-revenue': 'Venit PFA',
};

/** Human-readable label derived from type + affected tax (presentation only). */
function labelFor(t: FiscalThreshold): string {
  const tax = t.affectedTax.toUpperCase();
  switch (t.type) {
    case 'min-base':
      return `Prag minim ${tax}`;
    case 'max-base':
      return `Prag maxim ${tax}`;
    case 'registration':
      return `Prag de înregistrare ${tax}`;
    case 'income':
      return `Prag de venit ${tax}`;
  }
}

/**
 * Progress percentage from currentValue/thresholdValue only.
 * Capped at 100%, floored at 0; guarded for thresholdValue === 0 and for an unmeasured
 * threshold (`currentValue === null`), which renders an empty bar rather than a fake 0%.
 */
function progressPercent(currentValue: number | null, thresholdValue: number): number {
  if (thresholdValue === 0 || currentValue === null) return 0;
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
        <CardTitle>Praguri</CardTitle>
        <CardDescription>Praguri fiscale față de valorile curente</CardDescription>
      </CardHeader>
      {thresholds.length === 0 ? (
        <p className="hint">Niciun prag</p>
      ) : (
        thresholds.map((t) => (
          <div key={t.thresholdId}>
            <div className="item-row">
              <div>
                <strong className="item-title">{labelFor(t)}</strong>
                <div className="hint">{DOMAIN_LABEL[t.affectedDomain] ?? t.affectedDomain}</div>
              </div>
              <span className={`badge ${STATUS_BADGE[t.status]}`}>{STATUS_LABEL[t.status] ?? t.status}</span>
            </div>
            <div className="kv-row">
              <span>
                Curent: <strong>{t.currentValue === null ? '—' : formatLei(t.currentValue)}</strong>
              </span>
              <span>
                Prag: <strong>{formatLei(t.thresholdValue)}</strong>
              </span>
              <span>
                Distanță: <strong>{t.currentValue === null ? '—' : formatLei(t.distance)}</strong>
              </span>
            </div>
            {t.reviewReason ? (
              <p className="hint">{t.reviewReason}</p>
            ) : (
              <p className="hint">La depășire: {t.breachMeaning}</p>
            )}
            <div className="bar-track">
              <div
                className={`bar-fill ${t.status}`}
                style={{ width: `${progressPercent(t.currentValue, t.thresholdValue)}%` }}
              />
            </div>
            <p className="hint">{t.source}</p>
          </div>
        ))
      )}
    </Card>
  );
}
