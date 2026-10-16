import type { AttentionSeverity } from '../../domain/attention';
import { severity as severityCopy } from '../../ui/copy';

/**
 * TASK 8 — the one place a severity becomes a colour.
 *
 * The rule this exists to enforce: severity is **styled from `severity`**. It is not re-derived here,
 * and no surface may derive it from `kind`, from `status`, or from a distance — the same independence
 * TASK 4 made structural in `thresholds.ts` `severityFor`, which has no `kind` parameter to read. A
 * component that coloured a row from `status === 'breached'` would put the collapse back, one layer
 * further from the decision than the one it replaced.
 *
 * The word comes from `copy.severity` (TASK 7 supplied it, unwired); the colour is chosen here.
 */
export function severityBadgeClass(severity: AttentionSeverity): string {
  switch (severity) {
    case 'high':
      return 'badge-danger';
    case 'medium':
      return 'badge-warning';
    case 'low':
      return 'badge-info';
    case 'none':
      return 'badge-neutral';
  }
}

/** The Romanian word for a severity — never the raw enum token. */
export function severityLabel(severity: AttentionSeverity): string {
  return severityCopy[severity];
}
