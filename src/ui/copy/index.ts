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
 * Enforced by `src/ui/copy/copy.guard.test.ts`.
 */
export * from './common';
export * from './dashboard';
export * from './thresholds';
export * from './notes';
export * from './provenance';
export * from './settings';
export * from './records';

import * as common from './common';
import * as dashboardCopy from './dashboard';
import * as thresholdsCopy from './thresholds';
import * as notesCopy from './notes';
import * as provenanceCopy from './provenance';
import * as settingsCopy from './settings';
import * as recordsCopy from './records';

/** The whole layer as one namespaced object, for call sites that prefer `copy.x.y`. */
export const copy = {
  ...common,
  ...dashboardCopy,
  ...thresholdsCopy,
  ...notesCopy,
  ...provenanceCopy,
  ...settingsCopy,
  ...recordsCopy,
} as const;
