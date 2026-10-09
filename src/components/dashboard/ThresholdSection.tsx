import type { FiscalThreshold } from '../../domain/thresholds';
import { formatBaniLei } from '../../domain/money';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';

/**
 * ThresholdSection (Step 22, verified Step 31) — presentational only.
 *
 * Formats and presents `FiscalThreshold` items: no threshold calculation, no data fetching, no
 * persistence. The only derived value is the progress bar width from currentValue/thresholdValue
 * (allowed presentation math, kept as a visual convenience). Everything with a legal meaning comes
 * from the domain fields — `type` + `affectedTax` (label), `status`, `kind`, `applicability`,
 * `severity`, `measuredBasis`, `consequence`, `computedFrom`, `affectedDomain` and `source` — never
 * from the percentage and never from a sentence written in this file. TASK 7 owns the language layer;
 * the copy here is only what was needed to stop asserting a consequence the law does not create.
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

/**
 * Which quantity the row measured (TASK 4). The contribution rows and the VAT row are measured on
 * DIFFERENT bases on purpose — CF art. 148 / 170 / 174 measure an annual value, CF art. 310 alin. (1)
 * measures the turnover realised so far this year — so each row says which one it measured instead of
 * letting the reader assume they are the same quantity.
 */
const MEASURED_BASIS_LABEL: Record<FiscalThreshold['measuredBasis'], string> = {
  'annual-projected': 'venit net anual estimat pentru întreg anul',
  'annual-actual': 'venit net anual înregistrat până acum (fără proiecție disponibilă)',
  'ytd-turnover': 'cifra de afaceri înregistrată de la începutul anului',
  unattributed: 'bază măsurată, dar fără origine declarată',
  unmeasured: 'bază nemăsurată',
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
    case 'tier-floor':
      // A ladder step, not a ceiling: the label must not read as a maximum. The amount that changes
      // when this is crossed comes from the rule parameters, never from this component.
      return `Treaptă de calcul ${tax}`;
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
          <div
            key={t.thresholdId}
            // TASK 4: the row carries its legal kind, its applicability and its severity in the DOM.
            // Severity is a separate dimension from the kind, and TASK 8 owns how it is styled —
            // hooking it here keeps the data visible to tests and to the styling pass without
            // inventing a visual language in this task.
            data-kind={t.kind}
            data-applicability={t.applicability}
            data-severity={t.severity}
          >
            <div className="item-row">
              <div>
                <strong className="item-title">{labelFor(t)}</strong>
                <div className="hint">{DOMAIN_LABEL[t.affectedDomain] ?? t.affectedDomain}</div>
              </div>
              <span className={`badge ${STATUS_BADGE[t.status]}`}>{STATUS_LABEL[t.status] ?? t.status}</span>
            </div>
            <div className="kv-row">
              <span>
                Curent: <strong>{t.currentValue === null ? '—' : formatBaniLei(t.currentValue)}</strong>
              </span>
              <span>
                Prag: <strong>{formatBaniLei(t.thresholdValue)}</strong>
              </span>
              <span>
                Distanță: <strong>{t.currentValue === null ? '—' : formatBaniLei(t.distance)}</strong>
              </span>
            </div>
            <p className="hint">Bază măsurată: {MEASURED_BASIS_LABEL[t.measuredBasis]}</p>
            {t.computedFrom ? (
              <p className="hint">
                Sumă calculată de aplicație: {t.computedFrom.multiplier} × salariul minim de{' '}
                <strong>{formatBaniLei(t.computedFrom.smValueBani)}</strong> ({t.computedFrom.smAct}).{' '}
                {t.computedFrom.note}
              </p>
            ) : null}
            {t.reviewReason ? (
              <p className="hint">{t.reviewReason}</p>
            ) : t.applicability === 'not_applicable' ? (
              // An inapplicable row states why it does not apply and stops there. It shows no
              // consequence and no breach: the exception in the law removed the question.
              <p className="hint">Nu se aplică: {t.applicabilityReason}</p>
            ) : t.applicability === 'unknown' ? (
              <p className="hint">Aplicabilitate nesigură: {t.applicabilityReason}</p>
            ) : (
              // No "La depășire:" prefix: the row is not about a depășire. This is the factual
              // consequence of where the measured value sits, with the article it rests on.
              <p className="hint">{t.consequence}</p>
            )}
            {t.status === 'warning' && t.currentValue !== null ? (
              // The 10 % band is this app's presentation policy, and the label says so: it is not a
              // statutory distance and it must never acquire a citation.
              <p className="hint">
                Bandă de avertizare la 10 % din prag — politică de afișare a aplicației, nu o prevedere
                legală.
              </p>
            ) : null}
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
