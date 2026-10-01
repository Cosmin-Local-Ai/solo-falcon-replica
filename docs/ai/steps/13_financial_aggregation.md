# Step 13 — Financial Aggregation

## Purpose

Deterministic financial aggregation as **pure domain selectors**: given the
same `(data, asOfDate)` inputs, they always return the same numbers. The
selectors own the aggregation rules (which records count, how totals are
computed, where the fiscal-year boundary is), so UI components never
re-implement them.

All selectors are **pure**: no React, no DOM, no localStorage, no store
imports. They read `AppData` and return plain value objects.

> **Explicit scope statement:** the projection is **not** a forecast model.
> There is **no ML**, no statistical forecasting, and **no tax
> calculations** anywhere in this step. It is a transparent run-rate
> extrapolation, and every projected number is explicitly tagged as such.

## Data rules (shared by all selectors)

- **Status filter** — only records with `status === 'inregistrata'` are
  aggregated. `in-asteptare` and `respinsa` records are excluded.
- **Record total** — `total = valoareFaraTva + tva`. There is no stored
  total field; the total is always derived.
- **Fiscal-year boundary** — the fiscal period starts on
  `${profile.fiscalYear}-01-01` (calendar year taken from the profile).
- **`asOfDate`** — ISO `'YYYY-MM-DD'`, the **inclusive** upper bound of the
  period. ISO date strings compare lexicographically == chronologically.

## Public API

`src/domain/aggregation.ts`:

```ts
interface YtdTotals    { revenue: number; expenses: number; net: number }
interface MonthlyTotals { revenue: number; expenses: number; net: number }

selectYtd(data: AppData, asOfDate: string): YtdTotals
selectMonthly(data: AppData, asOfDate: string): Map<string, MonthlyTotals>
```

- `selectYtd` — year-to-date totals for fiscal year
  `data.profile.fiscalYear`, from `${fiscalYear}-01-01` up to and including
  `asOfDate`.
- `selectMonthly` — the same totals grouped by month, keyed by `'YYYY-MM'`.

`src/domain/projection.ts`:

```ts
interface ProjectionPeriod { from: string; to: string }            // 'YYYY-MM-DD'
interface RunRate          { revenuePerMonth: number; expensesPerMonth: number; netPerMonth: number }
interface Totals           { revenue: number; expenses: number; net: number }
interface ProjectionMonth  extends Totals { month: string; kind: 'actual' | 'projected' }
interface ProjectionV1 {
  periodActual: ProjectionPeriod
  runRate: RunRate
  annualProjected: Totals
  series: ProjectionMonth[]
  method: 'run-rate-v1'
}

selectProjectionV1(data: AppData, asOfDate: string): ProjectionV1
```

## Projection v1 — transparent run rate

The method is exactly:

```
period actual  = fiscal-year start (${fiscalYear}-01-01) → asOfDate
elapsed months = months from fiscal-year start to asOfDate (inclusive)
run rate       = YTD totals ÷ elapsed months
annual         = run rate × 12
```

The `series` field is a list of **12 months** for the fiscal year, each
tagged `kind: 'actual'` (months with real data up to `asOfDate`) or
`kind: 'projected'` (the remaining months, filled with the run rate).
Annual totals live under `annualProjected` — never mixed into `series`
totals — and the `method` tag is the literal `'run-rate-v1'`.

**What this is not:** no forecasting model, no ML, no seasonality, no tax
calculations. Anyone reading the output can re-derive every number from the
stored inputs by hand.

## Dashboard consumption

`src/pages/Dashboard.tsx` consumes **selector outputs only** — no
aggregation happens in JSX:

- Stat cards (`Venituri înregistrate`, `Cheltuieli înregistrate`,
  `Sold curent`) read `selectYtd(store, asOfDate)`.
- The run-rate projection line reads
  `selectProjectionV1(store, asOfDate).annualProjected`.

The store value (`StoreValue extends AppData`) is passed straight to the
selectors.

## Test coverage

| File | Tests | Covers |
|---|---|---|
| `src/domain/aggregation.test.ts` | 9 | status filtering, total derivation, fiscal-year boundary, `asOfDate` inclusivity, monthly grouping |
| `src/domain/projection.test.ts` | 8 | elapsed-month math, run-rate values, annual = rate × 12, series length/kinds, `method` tag |

## Verification results

Run in `/c/AI/projects/pi-test`:

### `npx tsc --noEmit`

```
(exit 0, no errors)
```

### `npx vitest run`

```
 RUN  v3.2.7 /c/AI/projects/pi-test

 ✓ src/domain/fiscal/fiscal.test.ts (13 tests)
 ✓ src/domain/profile.test.ts (15 tests)
 ✓ src/domain/aggregation.test.ts (9 tests)
 ✓ src/domain/snapshots/snapshots.test.ts (11 tests)
 ✓ src/domain/projection.test.ts (8 tests)
 ✓ src/data/store.migration.test.ts (5 tests)

 Test Files  6 passed (6)
      Tests  61 passed (61)
```

### `npm run build`

```
> solo-falcon-replica@0.1.0 build
> tsc && vite build

vite v5.4.21 building for production...
✓ 46 modules transformed.
dist/index.html                   0.42 kB │ gzip:  0.30 kB
dist/assets/index-EHjOQuDc.css   11.46 kB │ gzip:  2.98 kB
dist/assets/index-DdQQ1pZ_.js   215.31 kB │ gzip: 62.72 kB
✓ built in 564ms
```
