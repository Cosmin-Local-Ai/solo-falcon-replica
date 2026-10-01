# Step 20 — Financial Graph

## What was built

The financial graph (`src/components/FinancialChart.tsx`) replaces the "Grafic financiar"
placeholder in the Step 19 Dashboard shell. It is **presentation-only**: it consumes the
existing Step 18 dashboard data layer and renders it with recharts. No domain calculation,
no aggregation, no projection logic was duplicated or modified.

## Data source (Step 18 — consumed, not recomputed)

- `getProjectedFinancialSeries(data, asOf)` from `src/data/dashboard` — the 12-month
  `ProjectionMonth[]` series (actual Jan–asOf month, projected remainder, `run-rate-v1`),
  obtained via `useStore()` + `snapshot.asOf`.
- `useDashboardData()` — `snapshot.asOf` and the `tax` estimate result.

The component only **reshapes/filters** the existing series for chart rows (splitting each
metric into `*_actual` / `*_projected` columns so recharts can break the line at the
actual/projected boundary). No totals, run rates, tax math, or percentages of financial
values are computed in JSX.

## What the chart shows

- **Lines (6):** Venituri, Cheltuieli, Profit net — each drawn as **two** series:
  - `*_actual` — solid stroke
  - `*_projected` — dashed stroke (`strokeDasharray="6 4"`), same color
- `connectNulls={false}` so the line breaks at the actual→projected boundary.
- **Ranges** (toggle group, default = Lunar):
  - **Lunar** — the selected month (month `<select>`), 1 data point.
  - **YTD** — Jan through the asOf month (actual only).
  - **An** — full-year projection: 12 months, 6 actual + 6 projected.
- **Tooltips** (custom `FinancialChartTooltip`): period, and per line — metric, value in
  lei, and the **Realizat / Proiecție** state.
- **Tax estimate** — shown only where meaningful: below the chart as
  "Estimare impozit YTD: {fmtLei(tax.output.total)}" when `tax.status === 'computed'`;
  when `review_required`, a non-numeric note ("revizuire necesară — {reason}"). No tax
  math in the component.
- **Legend** — metric colors + dashed = proiecție.

## Accessible representation

- The chart container has `role="img"` with a descriptive `aria-label` (range, metrics,
  solid = realizat, dashed = proiecție).
- A `visually-hidden` `<table>` mirrors the exact data currently shown: period rows with
  Venituri / Cheltuieli / Profit net in lei plus the Realizat/Proiecție state, and a
  `<caption>` naming the active range. It updates with the range/month selection.
- Range buttons use `aria-pressed`; the month select has an accessible name.

## Files

- `src/components/FinancialChart.tsx` — new component (default export) + exported
  `FinancialChartTooltip`.
- `src/pages/Dashboard.tsx` — placeholder replaced with `<FinancialChart />`.
- `src/components/FinancialChart.test.tsx` — tests.
- `src/styles.css` — chart controls, legend, tooltip, tax note, `.visually-hidden`.

## Tests

`npx vitest run src/components/FinancialChart.test.tsx` (mocks `useStore`,
`useDashboardData`, `getProjectedFinancialSeries`; fakes `ResizeObserver` for the
recharts `ResponsiveContainer` under jsdom).

Coverage: data-layer consumption with asOf; three metric lines; accessible table
(headers + rows, actual state); YTD range (6 actual rows, no projected); full-year
range (12 rows = 6 actual + 6 projected); monthly range month switching; dashed vs
solid line segments (6/6); tax note (computed + review_required); tooltip content
(metric, period, value, state) and empty state.

## Boundaries

- No ML, no domain calculation changes, no unrelated charts.
- No localStorage / persistence access, no Step 13 business logic.
- Step 18 data layer used as-is; Dashboard shell not redesigned; other Step 20/21/22
  panels remain placeholders.
