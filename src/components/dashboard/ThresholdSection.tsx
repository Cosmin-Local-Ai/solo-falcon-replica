import type { FiscalThreshold } from '../../domain/thresholds';
import { formatBaniLei } from '../../domain/money';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Disclosure } from '../ui/Disclosure';
import { InterpretationNote } from '../ui/InterpretationNote';
import {
  copy,
  measuredBasisLabels,
  thresholdDomainLabels,
  thresholdRowLabels,
  thresholdStatusLabels,
  thresholds as thresholdCopy,
} from '../../ui/copy';

/**
 * ThresholdSection (Step 22, verified Step 31) — presentational only.
 *
 * Formats and presents `FiscalThreshold` items: no threshold calculation, no data fetching, no
 * persistence. The only derived value is the progress bar width from currentValue/thresholdValue
 * (allowed presentation math, kept as a visual convenience). Everything with a legal meaning comes
 * from the domain fields — `type` + `affectedTax` (label), `status`, `kind`, `applicability`,
 * `severity`, `measuredBasis`, `consequence`, `computedFrom`, `affectedDomain` and `source` — never
 * from the percentage and never from a sentence written in this file.
 *
 * TASK 7 changed two things here, and only these two:
 * - every label now comes from `src/ui/copy`, typed `Record<Union, string>`. The `?? t.status`
 *   fallbacks that used to sit on these lookups are gone: an unmapped union member is now a compile
 *   error, not a row that prints `review_required` on screen.
 * - an uncertainty is stated with the one reusable „Notă de interpretare" instead of an improvised
 *   sentence, and the citation sits behind „Surse și note de interpretare" — a real `<details>`,
 *   keyboard-operable, never a hover.
 * No calculation, no applicability rule and no `unknown` handling moved.
 */

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

/** Human-readable label derived from type + affected tax (presentation only). */
function labelFor(t: FiscalThreshold): string {
  return thresholdRowLabels[t.type](t.affectedTax.toUpperCase());
}

export interface ThresholdSectionProps {
  thresholds: FiscalThreshold[];
}

export default function ThresholdSection({ thresholds }: ThresholdSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{thresholdCopy.title}</CardTitle>
        <CardDescription>{thresholdCopy.description}</CardDescription>
      </CardHeader>
      {thresholds.length === 0 ? (
        <p className="hint">{thresholdCopy.empty}</p>
      ) : (
        thresholds.map((t) => (
          <ThresholdRow key={t.thresholdId} threshold={t} />
        ))
      )}
    </Card>
  );
}

function ThresholdRow({ threshold: t }: { threshold: FiscalThreshold }) {
  // The 10 % band is this app's presentation policy, and the note says so: it is not a statutory
  // distance and it must never acquire a citation.
  const bandExplained = t.status === 'warning' && t.currentValue !== null;

  return (
    <div
      className="threshold-row"
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
          <div className="hint">{thresholdDomainLabels[t.affectedDomain] ?? t.affectedDomain}</div>
        </div>
        <span className={`badge ${statusBadgeClass(t.status)}`}>{thresholdStatusLabels[t.status]}</span>
      </div>
      <div className="kv-row">
        <span>
          {thresholdCopy.current}{' '}
          <strong>{t.currentValue === null ? copy.ui.noValue : formatBaniLei(t.currentValue)}</strong>
        </span>
        <span>
          {thresholdCopy.threshold} <strong>{formatBaniLei(t.thresholdValue)}</strong>
        </span>
        <span>
          {thresholdCopy.distance}{' '}
          <strong>{t.currentValue === null ? copy.ui.noValue : formatBaniLei(t.distance)}</strong>
        </span>
      </div>
      <p className="hint">
        {thresholdCopy.measuredBasis} {measuredBasisLabels[t.measuredBasis]}
      </p>
      {t.computedFrom ? (
        <p className="hint">
          {thresholdCopy.computedAmountLead(t.computedFrom.multiplier)}{' '}
          <strong>{formatBaniLei(t.computedFrom.smValueBani)}</strong>{' '}
          {thresholdCopy.computedAmountTail(t.computedFrom.smAct, t.computedFrom.note)}
        </p>
      ) : null}
      {t.reviewReason ? (
        <p className="hint">{t.reviewReason}</p>
      ) : t.applicability === 'not_applicable' ? (
        // An inapplicable row states why it does not apply and stops there. It shows no
        // consequence and no breach: the exception in the law removed the question.
        <p className="hint">
          {thresholdCopy.notApplicable} {t.applicabilityReason}
        </p>
      ) : t.applicability === 'unknown' ? (
        <>
          <p className="hint">
            {thresholdCopy.applicabilityUnknown} {t.applicabilityReason}
          </p>
          <InterpretationNote note={copy.notes.applicabilityUndecided} />
        </>
      ) : (
        // No "La depășire:" prefix: the row is not about a depășire. This is the factual
        // consequence of where the measured value sits, with the article it rests on.
        <p className="hint">{t.consequence}</p>
      )}
      {bandExplained ? <InterpretationNote note={copy.notes.warningBand} /> : null}
      <div className="bar-track">
        <div
          className={`bar-fill ${t.status}`}
          style={{ width: `${progressPercent(t.currentValue, t.thresholdValue)}%` }}
        />
      </div>
      <Disclosure label={copy.disclosure.sources} className="threshold-sources">
        <p className="hint">{t.source}</p>
        {t.computedFrom ? (
          <InterpretationNote note={copy.notes.smDerivedAmount} />
        ) : null}
      </Disclosure>
    </div>
  );
}

/** Status → badge class (green / amber / red / neutral). */
function statusBadgeClass(status: FiscalThreshold['status']): string {
  switch (status) {
    case 'ok':
      return 'badge-success';
    case 'warning':
      return 'badge-warning';
    case 'breached':
      return 'badge-danger';
    // An unmeasured threshold is not a safe threshold — it gets its own neutral badge rather
    // than being folded into `ok`.
    case 'review_required':
      return 'badge-neutral';
  }
}
