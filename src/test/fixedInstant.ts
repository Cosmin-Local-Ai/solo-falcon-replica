/**
 * PG-0 — the ONE pinned instant in this repository.
 *
 * Before PG-0 the same instant was spelled four separate times: `FIXED_AS_OF` was
 * defined independently at `e2e/dashboard.spec.ts:72` and `e2e/settings.spec.ts:231`,
 * and two further tests bypassed even those constants with an inline
 * `setFixedTime(new Date('2026-10-31T12:00:00'))` at `e2e/settings.spec.ts:497` and
 * `:539`. Four copies of a pinned date is four chances for a later phase to move one
 * of them and leave the other three behind — which is how a date-dependent acceptance
 * criterion starts passing for the wrong reason.
 *
 * WHY 2026-10-31T12:00:00 (carried over from `e2e/dashboard.spec.ts:66-71`, where it
 * was first reasoned out): the projection model's own denominator is a whole number
 * there — 9 full months + 31/31 days = 10 elapsed months — so every expected figure
 * is hand-checkable as YTD × 12/10 = YTD × 1,2. It also leaves `monthsRemaining` at 3,
 * exactly as the real seed date did, so the reserve arithmetic is unchanged in kind.
 *
 * WHY NO OFFSET ON THE STRING: a date-time form with no offset is parsed as **local**
 * time, so the instant moves with the runner's zone while the *calendar day* does not.
 * `domain/date.ts` derives the calendar date through an explicit `Europe/Bucharest`
 * `Intl` format, so `localDateISO(fixedInstant())` is `2026-10-31` whether the runner
 * sits in UTC (CI) or EEST (a laptop in Bucharest). Pinned by `clock.test.ts`.
 * This is the B-46 class of bug — a UTC calendar date read where a local one was meant
 * — and it is pinned here rather than assumed.
 *
 * ─── IMPORT DIRECTION — THE RULE THAT KEEPS THIS FROM ROTTING QUIETLY ───────────
 *   1. THIS file must NEVER import `vitest`. It is imported by the Playwright specs in
 *      `e2e/`, which run in Node with no vitest module graph. One `import { vi }` here
 *      breaks every e2e run while every unit test stays green.
 *   2. `src/test/clock.ts` MAY import vitest — and must NEVER be imported by an `e2e/`
 *      spec. Same failure, mirrored.
 * Recorded again in `docs/ai/phases/27_pg0_groundwork.md`.
 */

/** The pinned instant as a local date-time string — no offset, on purpose (see above). */
export const FIXED_INSTANT_ISO = '2026-10-31T12:00:00';

/** A fresh `Date` for the pinned instant. Fresh per call: a `Date` is mutable, and a
 *  shared instance handed to both vitest and Playwright is an aliasing hazard waiting
 *  for someone to call `setTime` on it. */
export function fixedInstant(): Date {
  return new Date(FIXED_INSTANT_ISO);
}
