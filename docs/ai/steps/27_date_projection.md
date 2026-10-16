# Step 27 — Date & Projection Correctness

## Status
complete

## Objective
Fix financial-domain date correctness and projection timing: Romanian local calendar date (`Europe/Bucharest`), a single injectable date source (no scattered `new Date()` in affected selectors), explicit `asOfDate` for deterministic tests, a pure-domain architecture, and a current run-rate projection where a partial current month is NOT counted as a full elapsed month. No advanced forecasting.

## Result

| | Before | Final |
|---|---|---|
| Tests in `projection.test.ts` | 13 | **17** (+4) |
| Pass | — | **17/17** |

Before-state confirmed from git (commit `952ac07`): 13 tests, `denom = months > 0 ? months : 0`, integer `elapsedMonths`.

## What changed (3 files)

### 1. `src/domain/date.ts` — NEW
Single real-clock access point for the financial domain:
- `now()` — the ONLY `new Date()` in `src/`.
- `localDateISO(instant = now())` — Romanian local calendar date `YYYY-MM-DD` via `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', ... })`.
- `localYear(instant = now())` — Romanian local calendar year.
- `toInstantISO(instant = now())` — full ISO instant string (UTC) for audit timestamps (`updatedAt` etc.) — instants stay UTC, that's correct.
- `epochMs(instant = now())` — epoch ms for time-based IDs.
- `daysInMonth(year, month)` — days in a calendar month.

Every other function takes an injectable `instant: Date`. Audit timestamps remain full ISO instant strings; calendar dates are Romanian local.

### 2. `src/domain/projection.ts` — MODIFIED (core projection fix)
- `elapsedMonths(fiscalYear, asOfDate)`:
  - **Before:** `(asOfYear - fiscalYear) * 12 + (asOfMonth - 1) + 1` — a partial current month was counted as a FULL month (the bug).
  - **After:** `(asOfYear - fiscalYear) * 12 + (asOfMonth - 1) + asOfDay / daysInMonth(asOfYear, asOfMonth)` — fractional: full months + day/daysInMonth for the current partial month.
- `denom`:
  - **Before:** `months > 0 ? months : 0`.
  - **After:** `months > 0 ? Math.max(1, months) : 0` — denominator floored to 1 for dates inside the fiscal year (so Jan 15 → 119/1 = 142, not 119/0.484), 0 before fiscal year start (no run rate).
- Added `elapsedMonths: number` to the `ProjectionV1` interface — the ACTUAL denominator used (after the lower bound), documented in the field comment.
- Updated module doc comment to state the exact method.
- Pure domain: no React/DOM/localStorage/store imports. Deterministic for the same (data, asOfDate).

### 3. `src/domain/projection.test.ts` — MODIFIED
13 → 17 tests. All 17 pass.

## Test coverage (17 tests in `src/domain/projection.test.ts`)

1. `reports the actual period and method`
2. `computes run rate as YTD totals / elapsed months (inclusive fraction)`
3. `computes annual projection as run rate x 12`
4. `builds a 12-month series with the correct actual/projected split`
5. `uses real values for actual months and run-rate values for projected months`
6. `marks all 12 months actual when asOfDate is the last day of the fiscal year`
7. `handles asOfDate before the fiscal year start with zero run rate and all-projected series`
8. `is deterministic for the same data and asOfDate`
9. `uses denominator 1 for asOfDate on the first day of the fiscal year`
10. `uses denominator 1 for asOfDate on the last day of the first month`
11. `uses a fractional denominator for asOfDate on the first day of the second month`
12. `projects negative net when expenses exceed revenue (zero income)`
13. `computes fractional run rates when YTD is not evenly divisible`
14. `computes elapsed months as a fraction: full months + day/daysInMonth`
15. `floors the denominator to 1 for early dates inside the fiscal year`
16. `uses zero denominator before the fiscal year (no run rate)`
17. `computes the fractional denominator for a mid-month date in a 31-day month`

## Verification

- `npx vitest run src/domain/projection.test.ts` → 17/17 pass.
- `npx tsc --noEmit` → 0 errors mentioning projection. 6 pre-existing errors, all in unrelated test files (`completeness.test.ts` ×1, `deadlines.test.ts` ×2, `derived.test.ts` ×1, `fiscal/rules.test.ts` ×1, `thresholds.test.ts` ×1) — NOT caused by Step 27 (none reference `date.ts`, `projection.ts`, or `projection.test.ts`).
- `grep -rn "new Date()" src/domain src/data` (excluding tests) → only `src/domain/date.ts:21`.

## Constraints honored
- Pure domain: no React/DOM/localStorage/store imports in affected modules.
- Deterministic: same (data, asOfDate) → same output; tests inject explicit `asOfDate`.
- Current run-rate projection only — no advanced forecasting, no ML, no statistical methods.
- Calendar dates are Romanian local; audit instants remain UTC ISO strings.
