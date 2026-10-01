# Step 18 — Dashboard Data Layer

The dashboard data layer sits between the store and the domain. It reads `AppData` from the store,
runs it through domain selectors, and hands UI-ready results to the React layer.

```
store (useStore) → AppData → get* functions (dashboard.ts) → domain → DashboardData
```

`dashboard.ts` is pure (no React, no store) — every function takes `AppData` as its first argument,
so it is trivially testable with a fixture. The only impure piece is the adapter hook, which wires
the store and the async tax estimate into the pure functions.

## `src/data/dashboard.ts`

Every function that needs a fiscal period takes a **required** `asOfDate: string` (ISO date). There
is no optional `asOf` and **no `rule?`/`rules?` parameter on any function** — fiscal rules are not
passed in. The module imports the fixed PFA 2026 package constants from `../domain/fiscal` and uses
them directly:

- `PFA_2026_RELEASE` — the rule release (used as `ruleRelease`)
- `PFA_2026_SYSTEM_REAL_PACKAGE` — the full rule package (used as `rules`)

There is no `activeRulesFor(asOf)` — the package is a static import, not resolved per call.

| Function | Signature | Returns |
| --- | --- | --- |
| `getFinancialSummary` | `(data: AppData, asOfDate: string) => YtdTotals` | Revenue / expense / net YTD |
| `getMonthlyFinancialSeries` | `(data: AppData, asOfDate: string) => Map<string, MonthlyTotals>` | Totals keyed by `YYYY-MM` |
| `getProjectedFinancialSeries` | `(data: AppData, asOfDate: string) => ProjectionV1` | Run-rate / annual projection |
| `getDataCompleteness` | `(data: AppData) => CompletenessReport` | Data-completeness checks |
| `getPendingCounts` | `(data: AppData) => PendingCounts` | Counts of entries awaiting action |
| `getTaxEstimate` | `(data: AppData, asOfDate: string) => Promise<TaxEstimateResult>` | Async tax estimate |
| `getThresholdStatuses` | `(data: AppData, asOfDate: string) => FiscalThreshold[]` | Fiscal threshold statuses |
| `getUpcomingDeadlines` | `(data: AppData, asOfDate: string) => Deadline[]` | Upcoming filing deadlines |
| `getTaxReserve` | `(data: AppData, asOfDate: string, tax: TaxEstimateResult) => TaxReserveRecommendation` | Tax-reserve recommendation |
| `getInsights` | `(data: AppData, snapshot: DashboardSnapshot) => Insight[]` | Derived insights |
| `getActionItems` | `(data: AppData) => ActionItem[]` | Action items (deadline / completeness / tax) |
| `getLegislationState` | `(data: AppData) => LegislationState` | Placeholder legislation boundary |
| `buildDashboardData` | `(data: AppData, tax: TaxEstimateResult) => DashboardData` | Composes the full dashboard |

`getActionItems` and `getLegislationState` take no `asOfDate` — `getActionItems` resolves "today"
internally (`isoToday()`) where needed. `buildDashboardData` also resolves `asOfDate` internally and
takes only `(data, tax)`.

`buildDashboardData` is the single entry point the UI consumes. It calls the sync selectors above,
then folds in the (already-resolved) tax result to produce `snapshot`, `tax`, `thresholds`,
`deadlines`, `completeness`, `reserve`, `insights`, and `pendingCounts`.

Exported types: `PendingCounts`, `DashboardSnapshotView`, `DashboardData`, `ActionItem`,
`LegislationState`.

## Unresolved limitations

- `getLegislationState` is a **placeholder boundary only**. `AppData` has no legislation data, so it
  always returns `{ updatedAt: null, items: [] }`. No legislation ingestion exists — this is a stub
  for a future data source.

## `src/data/dashboardAdapter.tsx`

```ts
function useDashboardData(): DashboardData
```

The only React-facing piece. It:

1. Reads `AppData` from the store via `useStore()`.
2. Runs `getTaxEstimate(data, today)` in a `useEffect` (cancelled on re-run / unmount) and holds the
   result in local state. While it resolves it shows a `review_required` placeholder.
3. Returns `buildDashboardData(data, tax)` — a fully composed `DashboardData`.

Re-exports `DashboardData` and `PendingCounts` for consumers.

## Running

```sh
npx vitest run     # full test suite (201 tests), incl. src/data/dashboard.test.ts (13 tests)
npx tsc --noEmit   # type-check the whole project
```
