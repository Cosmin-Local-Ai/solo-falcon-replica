# Step 30 — Dashboard Insights Correction

## Step

Step 30 of the SOLO Replica AI build: make the Dashboard insights engine correct — deadline overdue vs. approaching, CASS/CAS dedup, Romanian localization, severity alignment, and the `REVIEW_REQUIRED` guard. Worker 1 rewrote the engine; **Worker 2 (this step) wrote the tests, this document, and ran the validation.** No source file was modified in Worker 2's part.

## Role

Worker 2 of Step 30 — **tests + documentation + validation only**. The behavioral spec is the Emission table in Worker 1's final report (`/tmp/solo-task-30/06-insights.md`); the tests encode that table verbatim.

## Objective

1. Replace the stale `src/domain/insights.test.ts` (it imported `buildInsights`, `InsightEventType`, `InsightPriority`, `InsightSeverity` — none of which exist anymore) with a fresh test file against the new contract: `getInsights(input: InsightInput): Insight[]` with `Insight = { id, severity: 'info' | 'warning' | 'danger', title, description, action }`.
2. Document the 7 required fixes, the changed files, the emission table, and the residual risks.
3. Validate: `npx tsc --noEmit` (zero NEW errors) and `npx vitest run` (all tests pass).

## Work performed

1. Read Worker 1's report (the Emission table is the behavioral spec), the current `src/domain/insights.ts`, the related domain modules (`aggregation.ts`, `tax.ts`, `snapshots/types.ts`), the project's test style (`aggregation.test.ts`), and the step-doc format (`_TEMPLATE.md`, `29_thresholds_and_deadlines.md`).
2. Recorded a baseline: `npx tsc --noEmit` and `npx vitest run` before touching anything. Baseline: 27/28 test files passing (307 tests); the only failures were the 58 tests in the stale `insights.test.ts`; tsc reported 13 errors in that same stale file plus 7 pre-existing errors in unrelated files.
3. Deleted the stale test file and wrote a fresh `src/domain/insights.test.ts` — 32 tests covering the full emission table plus the raw-key / Romanian / ordering / determinism invariants.
4. Wrote this document.
5. Re-ran `npx tsc --noEmit` and `npx vitest run` for the final validation.

## Files inspected

- `src/domain/insights.ts` — the corrected engine (Worker 1's rewrite).
- `src/domain/aggregation.ts` — `DashboardSnapshot` / `Threshold` types consumed by the engine.
- `src/domain/tax.ts` — `TaxEstimateResult` shape (`status: 'computed' | 'review_required'`).
- `src/domain/snapshots/types.ts` — `TaxCalculationSnapshot` (needed for the test factory).
- `src/data/dashboard.ts` — the data-layer consumer (read-only; not modified).
- `src/domain/aggregation.test.ts`, `src/domain/thresholds.test.ts` — project test style (vitest, small factory helpers).
- `docs/ai/steps/_TEMPLATE.md`, `docs/ai/steps/29_thresholds_and_deadlines.md` — step-doc format and style.
- `/tmp/solo-task-30/06-insights.md` — Worker 1's final report (the spec).

## Files changed

| File | Change | Who |
|------|--------|-----|
| `src/domain/insights.ts` | Full rewrite of emission logic: breached thresholds → danger, CASS/CAS canonical dedup, deadline overdue/today → danger with invalid-date guard, reserve gap guard, RO label maps for all three domains, `tax` handling (`computed` / `review_required` / `undefined`), inlined pure formatters (no data-layer imports). Exports `getInsights(input: InsightInput): Insight[]`. | Worker 1 |
| `src/data/dashboard.ts` | (a) thresholds mapping now includes `affectedTax: t.affectedTax` (was missing → dedup dead code); (b) `getInsights(data, snapshot, tax?)` passes `tax` through as `buildInsights({ snapshot, expenses, tax })`; (c) `buildDashboardData` calls `insights: getInsights(data, snapshot, tax)`; (d) import renamed to `getInsights as buildInsights`. | Worker 1 |
| `src/domain/insights.test.ts` | **Deleted and rewritten** — 32 tests against the Step 30 emission contract (was 58 stale tests importing removed exports). | Worker 2 |
| `docs/ai/steps/30_insights_correction.md` | This document (new). | Worker 2 |

`src/domain/aggregation.ts` was inspected by Worker 1 and required no changes — `DashboardSnapshot.deadlines` already carries `daysUntil`, and `taxReserve` is non-optional with `gapCents` / `projectedLiabilityCents`.

## Findings

### The 7 required fixes

| # | Required fix | How addressed |
|---|--------------|---------------|
| 1 | Split deadline approaching vs. overdue; render overdue as "overdue", not "approaching in N days" | `daysUntil <= 0` → danger, title `Termen depășit: <label>`; `daysUntil < 0` → "a expirat pe <date>", `=== 0` → "este astăzi (<date>)". `1..30` → warning `Termen apropiat`. `> 30` → no insight. |
| 2 | Validate `d.date` non-empty and `d.daysUntil` finite before emitting | Both guarded: `typeof d.daysUntil !== 'number' \|\| !Number.isFinite(d.daysUntil)` → skip; `typeof d.date !== 'string' \|\| d.date.length === 0` → skip. |
| 3 | Dedup CASS/CAS to a single canonical insight; no double-emission | All threshold alerts collected first (breached → danger, `!breached && ratio >= 0.8` → warning); alerts with `affectedTax ∈ {cass, cas}` collapsed to at most ONE canonical (worst severity wins; tie → highest ratio). Others stay distinct. `dashboard.ts` now maps `affectedTax` so the dedup key is live. |
| 4 | Map raw keys → Romanian labels; never render raw keys | `DEADLINE_LABELS` (10 `appliesTo` values, fallback `Termen fiscal`), `THRESHOLD_LABELS` (fallback `Prag fiscal`), `COMPLETENESS_LABELS` (9 keys, fallback `date`). Unknown keys → generic RO label, never the raw key. |
| 5 | Localize all strings to Romanian | Every title/description/action is Romanian; dates rendered `DD.MM.YYYY`; amounts rendered `ro-RO` RON with 2 decimals. |
| 6 | Align severity to the situation | danger: breached threshold, overdue/today deadline; warning: approaching threshold (≥80%), deadline 1–30 days, reserve gap, missing data; info: tax estimate states only. No invented 'urgent' tier (contract is info/warning/danger). |
| 7 | REVIEW_REQUIRED guard — don't treat unresolved values as facts | `tax === undefined` → no tax insight; `tax.status === 'review_required'` → ONE info `Estimarea impozitului necesită verificare` (no numbers, no raw reason); `tax.status === 'computed'` → ONE info with `tax.output.total` formatted in lei. Reserve additionally guarded: no insight when `projectedLiabilityCents <= 0` (no data recorded) or `gapCents <= 0`. |

### Emission table (final behavior)

| Source | Condition | Severity | id | Title (RO) |
|--------|-----------|----------|----|------------|
| Threshold breached | `t.breached === true` | danger | `threshold-<id>` | `Prag depășit: <label>` |
| Threshold approaching | `!breached && ratio >= 0.8` | warning | `threshold-<id>` | `Aproape de prag: <label>` |
| Deadline overdue/today | `daysUntil <= 0` (finite, non-empty date) | danger | `deadline-<id>` | `Termen depășit: <label>` |
| Deadline approaching | `1 <= daysUntil <= 30` | warning | `deadline-<id>` | `Termen apropiat: <label>` |
| Deadline far | `daysUntil > 30` | — (no insight) | — | — |
| Deadline invalid | non-finite `daysUntil` or empty `date` | — (skipped) | — | — |
| Reserve gap | `projectedLiabilityCents > 0 && gapCents > 0` | warning | `reserve` | `Rezervă fiscală sub țintă` |
| Completeness | `missing.length > 0` | warning | `completeness` | `Date incomplete` |
| Tax computed | `tax.status === 'computed'` | info | `tax` | `Estimare impozit` |
| Tax review | `tax.status === 'review_required'` | info | `tax` | `Estimarea impozitului necesită verificare` |
| Tax absent | `tax === undefined` | — (no insight) | — | — |

- CASS/CAS collapse: at most ONE canonical alert among `affectedTax ∈ {cass, cas}` (worst severity; tie → highest ratio).
- Ordering: sorted danger → warning → info, stable within a severity.
- `expenses` field kept in `InsightInput` (unused, contract compatibility).

## Decisions

- **Tests encode the Emission table verbatim** — one test per row, plus boundary cases (`ratio === 0.8` → warning, `daysUntil === 0` → danger, `daysUntil === 30` → warning) and the CASS/CAS tie-break rule.
- **Small factory helpers** (`snapshot(...)`, `threshold(...)`, `deadline(...)`, `taxComputed(...)`, `taxReviewRequired(...)`) matching the project's existing test style; every factory takes `Partial` overrides.
- **Invariants get dedicated tests**: (a) raw keys never leak into `title`/`description`/`action`; (b) no English leak patterns (`Missing`, `Deadline`, `Urgent`, `Warning`, `Approaching`) in user-facing text; (c) output sorted danger → warning → info, stable within a severity; (d) deterministic for identical input.
- **`expenses` is intentionally NOT tested** — it is kept in `InsightInput` for contract compatibility only and is unused by the engine.
- **The `review_required` tax test asserts the negative contract**: no digit appears in title/description and the raw `reason` string is not rendered.

## Tests

`src/domain/insights.test.ts` — **32 tests, all passing**:

| Block | Tests | Covers |
|-------|-------|--------|
| `thresholds` | 7 | breached → one danger; `ratio >= 0.8` → warning; boundary `0.8`; `< 0.8` → nothing; CASS+CAS canonical (worst severity wins; tie → highest ratio); CASS+VAT → two distinct |
| `deadlines` | 10 | `daysUntil < 0` → danger ("a expirat pe"); `=== 0` → danger ("este astăzi"); `1/15/30` → warning; `> 30` → nothing; NaN/±Infinity → skipped; empty `date` → skipped |
| `tax reserve` | 4 | `liability > 0 && gap > 0` → one warning; `gap === 0` / `gap < 0` / `liability === 0` → nothing |
| `completeness` | 4 | known key → RO label (`profile` → "Profil"); multiple keys; unknown key → "date" fallback; empty → nothing |
| `tax` | 3 | `undefined` → nothing; `review_required` → one info, no numbers, no raw reason; `computed` → one info with formatted total |
| `invariants` | 4 | no raw keys in user-facing text; no English leaks; severity ordering (stable within a severity); determinism |

Full suite: **28 files, 339 tests, 339 passing** (baseline before this step: 307 passing + 58 failing in the stale file).

## Problems

- **No genuine implementation bugs found** — every test in the new file passes against Worker 1's engine as-is.
- **Pre-existing `src/components/dashboard/ThresholdSection.tsx` tsc error** (switch-exhaustiveness in `labelFor`) — unrelated to Step 30, tolerated, NOT fixed (per task constraints).
- **Other pre-existing tsc errors** in unrelated test files (`Insights.test.tsx`, `completeness.test.ts`, `deadlines.test.ts`, `derived.test.ts`, `fiscal/rules.test.ts`) — present in the baseline, unchanged by this step.

## Handoff

Residual risks carried forward:

1. **Threshold labels are generic** — snapshot `threshold.label` is `t.affectedDomain`; only `'pfa-revenue'` is in `THRESHOLD_LABELS`, so CASS/CAS/VAT thresholds render as `Prag fiscal` (generic, not raw). Extend the map if specific RO names are wanted.
2. **No `conditions` field** — the `Insight` shape is pinned to `{ id, severity, title, description, action }`, so raw keys are emitted nowhere (stronger than the original "raw keys only in conditions" requirement).
3. **`daysUntil` trusted from the data layer** — `insights.ts` guards finiteness but not staleness relative to `asOf`; correctness depends on `deadlines.ts` (out of scope).
4. **Pre-existing `ThresholdSection.tsx` tsc error** — unrelated (switch exhaustiveness in `labelFor`), not touched.

Validation results (final):

| Check | Result |
|-------|--------|
| `npx vitest run` | **28 files, 339/339 passing** |
| `npx vitest run src/domain/insights.test.ts` | **32/32 passing** |
| `npx tsc --noEmit` | **0 NEW errors** — 7 pre-existing errors remain (incl. the tolerated `ThresholdSection.tsx` one); all 13 baseline errors in the stale `insights.test.ts` are gone |
