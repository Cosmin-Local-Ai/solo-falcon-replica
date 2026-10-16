/**
 * PG-0 — the shared fixed-clock seam for vitest.
 *
 * WHAT THIS IS
 * One importable way to pin the clock for a unit test, so no test under `src/` ever
 * reads the wall clock. `src/test/wallClockGuard.test.ts` (the standing B-23 rule)
 * sanctions exactly two mechanisms: inject an `instant`, or install fake timers
 * explicitly. This wraps the second one. It does not add a third.
 *
 * WHY FAKE TIMERS AND NOT `vi.mock('../domain/date')`
 * Brief 30 asked for the `now()` export to be mocked rather than the global `Date`
 * patched, and gave its reason: "the domain was built around an injectable `instant`;
 * breaking that invariant to fake a date is the wrong seam." That reason does not
 * apply to `vi.useFakeTimers({ toFake: ['Date'] })` — it pins what the clock reads
 * without touching the injectable-`instant` invariant at all, and an injected instant
 * is still an injected instant. It is also what the house already does
 * (`pages/Dashboard.test.tsx:146-147`, `pages/Settings.fx.test.tsx:208`) and what the
 * existing guard already sanctions. Mocking `domain/date` instead would have added a
 * THIRD mechanism the guard does not sanction — widening an existing control to satisfy
 * a brief, which is backwards. Recorded in `docs/ai/phases/27_pg0_groundwork.md`.
 *
 * WHY `toFake: ['Date']` AND NOT THE DEFAULT
 * The default fakes every timer kind. `Dashboard.test.tsx` deliberately fakes `Date`
 * only, so `setTimeout` and microtasks stay real and its documented macrotask wait in
 * `expectTaxFigure` still works. That is the safer default for this suite, so it is
 * inherited here; `fakeAllTimers: true` opts out for the rarer case.
 *
 * ─── IMPORT DIRECTION — SEE ALSO `fixedInstant.ts` ──────────────────────────────
 * This file MAY import vitest. It must NEVER be imported by an `e2e/` spec — Playwright
 * has no vitest module graph, and the failure would be an e2e-only break with every
 * unit test still green.
 */

import { vi } from 'vitest';
import { now } from '../domain/date';
import { fixedInstant } from './fixedInstant';

/** Named so a failure can point at the seam instead of at the assertion that tripped. */
export const CLOCK_SEAM = 'src/domain/date.ts → now()';

/** Thrown when the domain's clock seam does not report the instant it was pinned to. */
export class ClockSeamError extends Error {
  constructor(expected: Date, observed: Date) {
    super(
      `${CLOCK_SEAM} is not pinned: expected ${expected.toISOString()} but ${CLOCK_SEAM} ` +
        `returned ${observed.toISOString()} (a ${Math.abs(observed.getTime() - expected.getTime())} ms drift).\n` +
        'Every date in this app reaches the clock through that one function, so a test that ' +
        'pins the clock and still sees a moving `now()` is reading the real clock somewhere. ' +
        'Either the fake timers were not installed, or the code under test reads the clock ' +
        'itself instead of calling the seam — which is defect B-46 (`Expenses.tsx:47`, ' +
        '`Revenues.tsx:30`, `Declarations.tsx:31`), not a problem with this helper.',
    );
    this.name = 'ClockSeamError';
  }
}

/**
 * Assert that the domain's own clock seam reports `expected`.
 *
 * This is the proof behind PG-0 acceptance criterion 2 — "no test reads the wall
 * clock … prove it by the helper being the only seam, not by grepping for
 * `new Date()` and hoping." `domain/date.ts:21` is the only place the domain reads
 * the clock, so if `now()` reports the pinned instant, everything downstream of it
 * is pinned too. If anything ever starts reading the clock directly, this throws and
 * names the function that was bypassed.
 */
export function assertClockSeam(expected: Date): void {
  const observed = now();
  if (observed.getTime() !== expected.getTime()) throw new ClockSeamError(expected, observed);
}

export interface PinClockOptions {
  /** Fake every timer kind, not just `Date`. Rare; see the header note. */
  readonly fakeAllTimers?: boolean;
}

/**
 * Pin the clock. Defaults to the repository's one pinned instant
 * (`fixedInstant.ts`), which is the same instant the Playwright specs pin — so a unit
 * figure and a browser figure are comparable without anyone re-deriving a date.
 *
 * Throws `ClockSeamError` if the pin did not reach the domain seam.
 */
export function pinClock(at: Date = fixedInstant(), options: PinClockOptions = {}): Date {
  vi.useFakeTimers(
    options.fakeAllTimers === true ? { now: at.getTime() } : { toFake: ['Date'], now: at.getTime() },
  );
  assertClockSeam(at);
  return at;
}

/** Release the clock. Pair it with `pinClock` in an `afterEach`. */
export function unpinClock(): void {
  vi.useRealTimers();
}
