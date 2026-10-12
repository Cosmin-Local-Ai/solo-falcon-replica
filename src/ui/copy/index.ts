/**
 * TASK 7 — the user-facing language layer. One import for every sentence a person can read.
 *
 * `copy.<surface>.<key>` is the addressing. Keys are camelCase and grouped by the surface that
 * speaks them, so a key reads as a sentence's location: `copy.reserve.noEstimate`,
 * `copy.thresholds.warningBandPolicy`, `copy.notes.capReading`.
 *
 * Where a sentence is parameterised it is a function, never a `%s` template — TypeScript checks the
 * call site. Where markup has to survive inside a sentence (an amount in a `<strong>`, an
 * interpolated date), the sentence is split into `…Lead` / `…Tail` fragments so the DOM keeps the
 * shape the tests and the screen reader already depend on.
 *
 * The re-exports below are named rather than `export *` on purpose: the public surface of the copy
 * layer is then visible in one place, and a key that no call site imports is easy to spot.
 *
 * Enforced by `src/ui/copy/copy.guard.test.ts`.
 */
export { ui, disclosure, noteLabel, fields, validation, empty, nav, shell } from './common';
export {
  dashboard,
  chart,
  summary,
  insights,
  reserve,
  actions,
  deadlines,
  completeness,
  legislation,
  moneyPrecision,
  CHECK_LABELS,
  checkLabel,
  deadlineAppliesToLabels,
  deadlineLabels,
  deadlineLabelFor,
  vatFilingPeriodUnknown,
} from './dashboard';
export {
  thresholds,
  thresholdStatusLabels,
  measuredBasisLabels,
  thresholdDomainLabels,
  thresholdRowLabels,
  thresholdKindLabels,
} from './thresholds';
export { notes, sources } from './notes';
export { fx } from './fx';
export { provenance, severity } from './provenance';
export { attention, estimateState } from './attention';
export { scenarios } from './scenarios';
export { settings } from './settings';
export { onboarding } from './onboarding';
export { occupancy } from './occupancy';
export {
  revenues,
  expenses,
  expenseCategoryLabels,
  clients,
  declarations,
  recordStatus,
  moneyDate,
  fiscalDateSource,
  documents,
  eFactura,
} from './records';

import {
  ui, disclosure, noteLabel, fields, validation, empty, nav, shell,
} from './common';
import {
  dashboard, chart, summary, insights, reserve, actions, deadlines, completeness,
  legislation, moneyPrecision, checkLabel, deadlineAppliesToLabels, deadlineLabels,
  deadlineLabelFor, vatFilingPeriodUnknown,
} from './dashboard';
import {
  thresholds, thresholdStatusLabels, measuredBasisLabels, thresholdDomainLabels,
  thresholdRowLabels, thresholdKindLabels,
} from './thresholds';
import { notes, sources } from './notes';
import { fx } from './fx';
import { provenance, severity } from './provenance';
import { attention, estimateState } from './attention';
import { scenarios } from './scenarios';
import { settings } from './settings';
import { onboarding } from './onboarding';
import { occupancy } from './occupancy';
import {
  revenues, expenses, expenseCategoryLabels, clients, declarations, recordStatus,
  moneyDate, fiscalDateSource, documents, eFactura,
} from './records';

/** The whole layer as one namespaced object, for call sites that prefer `copy.x.y`. */
export const copy = {
  ui, disclosure, noteLabel, fields, validation, empty, nav, shell,
  dashboard, chart, summary, insights, reserve, actions, deadlines, completeness,
  legislation, moneyPrecision, checkLabel, deadlineAppliesToLabels, deadlineLabels,
  deadlineLabelFor, vatFilingPeriodUnknown,
  thresholds, thresholdStatusLabels, measuredBasisLabels, thresholdDomainLabels,
  thresholdRowLabels, thresholdKindLabels,
  notes, sources,
  fx,
  provenance, severity,
  attention, estimateState,
  scenarios,
  settings,
  onboarding,
  occupancy,
  revenues, expenses, expenseCategoryLabels, clients, declarations, recordStatus,
  moneyDate, fiscalDateSource, documents, eFactura,
};
