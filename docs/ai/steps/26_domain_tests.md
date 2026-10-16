# Step 26 — Domain Tests (QA)

## Status
complete

## Objective
Extend the domain test suite across Steps 10–17 (profile, fiscal rules, snapshots, aggregation, projection, derived state, tax engine, thresholds, deadlines, reserve, insights, completeness) to close the coverage gaps identified by the Phase 1 scout reports (`/tmp/solo-task-26/*.md`). Test-only work: no source changes, no UI changes. Every scout report was verified against source before being used to brief a worker.

## Result

| | Baseline | Final |
|---|---|---|
| Tests | 190 | **286** (+96) |
| Files | 17 | 17 |
| Pass | 190/190 | **286/286** |

Verified by running `npx vitest run src/domain/ src/data/` after each worker (226 → 252 → 259 → 286).

## What changed (per worker)

### Worker 1 — Profile, fiscal rules, snapshots (Steps 10–12)
- `src/domain/profile.test.ts` — 12 → 18: added profile validation/normalization edge cases.
- `src/domain/fiscal/rules.test.ts` — **new, 12 tests**: against the real `selectApplicableRules` API (`src/domain/fiscal/select.ts`): taxYear + ACTIVE status + effective-date window (inclusive boundaries), one-day-before/after exclusions, open-ended `effectiveTo`, deterministic `ruleId` sort, provenance fields.
- `src/domain/snapshots/snapshots.test.ts` — **new, 18 tests**: hash stability, release identity.
- `src/data/store.snapshots.test.tsx` — 3 tests, **fixed a stale-closure bug** in the existing test (test-only fix; no source change).
- Scope note: only the 2026 fiscal package exists in the codebase, so per-year/patch selection coverage is a scope limitation, not a defect.

### Worker 2 — Aggregation, projection, derived state (Steps 13–14)
- `src/domain/aggregation.test.ts` — 9 → 21: zero income, fiscal-year boundaries, `inPeriod` boundary semantics, source reactivity.
- `src/domain/projection.test.ts` — 8 → 13: denominator boundaries (Jan 1 / Jan 31 / Feb 1), fractional run rate.
- `src/domain/derived.test.ts` — 13 → 22: `asOfDate`/fiscal-start boundary records, provenance, `inputsKey` stability.
- No domain defects found.

### Worker 3 — Tax engine, thresholds, deadlines (Steps 15–16)
- `src/domain/tax.test.ts` — 25 → 28: CASS minimum base (24,300 → 2,430 / 24,299 → review_required), CAS cap (97,200/97,201 → 24,300), CASS cap (291,600/291,601 → 29,160), raw float math (29,581.615 exact), release awareness (modified `max_base` → different CAS).
- `src/domain/thresholds.test.ts` — 10 → 13: exact threshold values, REVIEW_REQUIRED triggers, just-above-threshold positive distance.
- `src/domain/deadlines.test.ts` — 17 (no additions; existing coverage confirmed adequate).

### Worker 4 — Reserve, insights, completeness (Step 17)
- `src/domain/insights.test.ts` — ~40 → 58: no-fabrication test (clean `DashboardSnapshot` → `[]`); `conditions` key-set stability (machine-readable `Record`, no personal data); exhaustive 12-event-type severity/priority matrix (via `it.each`).
- `src/domain/completeness.test.ts` — 9 → 10: `regime: ''` (empty string) → profile check unsatisfied.
- `src/domain/taxReserve.test.ts` — 14 → 15: `recommendedMonthlyReserve === remainingTarget / monthsRemaining` consistency using the function's own returned fields.

## Final test inventory (verified via vitest JSON)

| File | Tests |
|---|---|
| `src/data/dashboard.test.ts` | 13 |
| `src/data/derived.test.tsx` | 3 |
| `src/data/store.migration.test.ts` | 5 |
| `src/data/store.snapshots.test.tsx` | 3 |
| `src/domain/aggregation.test.ts` | 21 |
| `src/domain/completeness.test.ts` | 10 |
| `src/domain/deadlines.test.ts` | 17 |
| `src/domain/derived.test.ts` | 22 |
| `src/domain/fiscal/fiscal.test.ts` | 17 |
| `src/domain/fiscal/rules.test.ts` | 12 |
| `src/domain/insights.test.ts` | 58 |
| `src/domain/profile.test.ts` | 18 |
| `src/domain/projection.test.ts` | 13 |
| `src/domain/snapshots/snapshots.test.ts` | 18 |
| `src/domain/tax.test.ts` | 28 |
| `src/domain/taxReserve.test.ts` | 15 |
| `src/domain/thresholds.test.ts` | 13 |
| **Total** | **286** |

## Findings (flagged, not fixed — test-only step)

1. **Stale comment in `src/domain/insights.ts` (line 206)**: comment says PROJECTED_TAX_INCREASE fires at "≥ 5,000,000 cents (50,000 lei)" but the code checks `>= 500000` (500,000 cents = **5,000 lei**). The new tests lock in the **actual** behavior (500,000 cents). The comment should be corrected in a future step.
2. **Doc ≠ code for Step 17**: `docs/ai/steps/17_dashboard_intelligence.md` describes an outdated API (`generateInsights`, `CompletenessAssessment` with `score`, numeric priorities 1–10). The real API is `buildInsights` / `assessCompleteness` with string severity/priority and no score. Tests were written against the source, per the scout's instruction.
3. **`selectFiscalRules` does not exist** — the real API is `selectApplicableRules` (`src/domain/fiscal/select.ts`). An initial worker placeholder targeting the nonexistent name was deleted; tests were rewritten against the real API.
4. **Only the 2026 fiscal package exists** in `src/domain/fiscal/` — per-year/patch selection coverage is a scope limitation.

## Constraints honored
- No source files modified (the one exception was a stale-closure bug **inside an existing test file**).
- No UI/React/store changes.
- No existing tests deleted or weakened.
- Pure tests: no mocks, no network, no clock (dates injected).
- One worker at a time; each worker's claims verified independently (test counts + full suite run) before acceptance.
