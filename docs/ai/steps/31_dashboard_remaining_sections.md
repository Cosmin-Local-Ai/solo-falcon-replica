# Step 31 — Dashboard: Remaining Sections

## Objective

Implement the remaining dashboard sections on `src/pages/Dashboard.tsx`:

1. **Tax Thresholds** (`ThresholdSection`)
2. **Next Tax Deadline** (`DeadlineSection`)
3. **Data Completeness** (`CompletenessSection`)
4. **What You Need To Do** (`ActionSection`)
5. **Upcoming Legislation** (`LegislationSection`)

All sections are presentational only: they consume state from the deterministic
data layer (`useDashboardData()` → `DashboardData`) and never perform domain
calculations in JSX. The legislation section consumes the existing data
boundary and shows the exact empty state "No verified upcoming changes." when
there is no verified upcoming legislation — no legislation, dates, or sources
are fabricated, and no external data is fetched.

## Files changed (all of Step 31)

| File | Reason |
|---|---|
| `src/data/dashboard.ts` | Worker 1: `getUpcomingDeadlines` now applies the domain `filterUpcoming` (previously returned all deadlines, including past and null-dated ones). Worker 2: added `actions: ActionItem[]` to `DashboardData` and wired the existing `getActionItems` into `buildDashboardData`. |
| `src/components/dashboard/ThresholdSection.tsx` | Worker 1: surfaces the domain `breachMeaning` ("If breached: …"), added the missing `income` case to `labelFor`, demoted the progress bar to a 6px visual convenience. |
| `src/components/dashboard/DeadlineSection.tsx` | Worker 1: defensive upcoming-only guard via domain `classifyDeadline` (past / due-today / null-dated deadlines can never render), singular/plural remaining days, honest empty state "No upcoming deadlines". |
| `src/components/dashboard/checkLabels.ts` | Worker 2 (new): presentation-only map from the 9 completeness check keys to plain-language labels; unknown keys fall back to the raw key so no check is dropped. |
| `src/components/dashboard/CompletenessSection.tsx` | Worker 2: plain-language check labels with domain `detail` hints; ✓/✗ glyphs replaced by calm Complete/Missing status badges; unsatisfied rows keep the `var(--danger-soft)` background. |
| `src/components/dashboard/ActionSection.tsx` | Worker 2: rewritten to be driven by the real `ActionItem[]` from the data layer (was `pendingCounts`); Card/CardHeader pattern standardized; neutral source badge per item (Deadline / Completeness / Tax); honest empty state "Everything is up to date — nothing needs your attention." |
| `src/components/dashboard/ActionSection.test.tsx` | Worker 2: tests rewritten for the new `ActionItem[]` contract (5 tests). |
| `src/pages/Dashboard.tsx` | Worker 2: one-line wiring — `<ActionSection actions={data.actions} />` (was `pendingCounts`). No other composition changes. |
| `docs/ai/steps/31_dashboard_remaining_sections.md` | Worker 3 (this file): step documentation. |

Worker 3 (legislation verification + final integration check) made **no code
changes** — `LegislationSection.tsx` was verified compliant as implemented in
Step 23.

## Data consumed per section

| Section | `DashboardData` field | Source in the data layer |
|---|---|---|
| ThresholdSection | `data.thresholds: FiscalThreshold[]` | `getThresholdStatuses` → domain `computeThresholds` (PFA 2026 real package) |
| DeadlineSection | `data.deadlines: Deadline[]` + `data.snapshot.asOf` as `asOfDate` | `getUpcomingDeadlines` → domain `computeDeadlines` + `filterUpcoming` (upcoming only) |
| CompletenessSection | `data.completeness: CompletenessReport` | `getDataCompleteness` → domain `assessCompleteness` |
| ActionSection | `data.actions: ActionItem[]` | `getActionItems` — upcoming deadlines, then unsatisfied completeness checks, then tax review (deterministic order) |
| LegislationSection | `data.legislation: LegislationState` | `getLegislationState` — placeholder boundary (always `{ updatedAt: null, items: [] }` today) |

All five are wired in `src/pages/Dashboard.tsx` inside `<div className="grid grid-2">`:

```tsx
<ThresholdSection thresholds={data.thresholds} />
<DeadlineSection deadlines={data.deadlines} asOfDate={data.snapshot.asOf} />
<CompletenessSection completeness={data.completeness} />
<ActionSection actions={data.actions} />
<LegislationSection state={data.legislation} />
```

## Validation results

- **Typecheck** (`npx tsc --noEmit`): **6 errors, all pre-existing** and all in
  test files from earlier steps — none in files changed by Step 31:
  - `src/domain/deadlines.test.ts` ×2 (missing `asOfDate` in `DeadlineQuery` args)
  - `src/domain/derived.test.ts` (`"nota-impozit"` not assignable)
  - `src/domain/fiscal/rules.test.ts` (`"DRAFT"` not assignable to `FiscalRuleStatus`)
  - `src/domain/completeness.test.ts` (`""` not assignable to `PfaRegime`)
  - `src/components/Insights.test.tsx` (`eventType` not in `Insight`)
- **Tests** (`npx vitest run`): **341/341 passed (28 test files)**, including
  LegislationSection (4), ActionSection (5), and the dashboard data layer (13).

## Known limitations

- **Legislation data is a stub**: `getLegislationState` always returns
  `{ updatedAt: null, items: [] }` — there are no verified legislation sources
  and Step 23/31 forbid ingestion, fetches, or fabrication. The section
  therefore always renders the exact empty state "No verified upcoming
  changes." The item-rendering path (source, published, effective, status,
  affected area) is implemented and unit-tested, ready for real data.
- **`src/domain/legislation.ts` does not exist**: the task brief referenced it,
  but the `LegislationItem` / `LegislationState` types live in
  `src/data/dashboard.ts` (the data boundary). No code change was needed.
- **Pre-existing tsc errors** in the five test files above are out of scope
  (earlier steps' in-flight work); they do not affect the build of `src/`
  production code or the test suite.
- LegislationSection also renders the item's `summary` field in addition to
  the five required metadata fields; `summary` is a real field of
  `LegislationItem`, not a fabrication.
