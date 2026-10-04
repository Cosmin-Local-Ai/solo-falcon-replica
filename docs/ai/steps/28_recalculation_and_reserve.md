# Step 28 — Recalculation & Reserve Honesty

## Status
complete

## Objective
Give the Dashboard a live, auto-recomputing tax estimate (derived state on top of the flat store) and make the tax-reserve `reservedAmount` an honest tri-state: `null` = no data recorded, `0` = explicit zero, `> 0` = real amount. No new persistence, no new UI actions.

## Result

| | Before | Final |
|---|---|---|
| Full test suite | 328 | **332** (+4 in `taxReserve.test.ts`) |
| Pass | — | **332/332** (28 files) |
| `tsc --noEmit` errors from Step 28 files | — | **0** (6 pre-existing in unrelated test files, unchanged from Step 27) |

## What changed (6 files)

### 1. `src/data/derived.ts` — MODIFIED (new hook)
`useLatestTaxEstimate(asOfDate)` — the derived tax estimate:
- Reads the flat store via `useStore()`; recomputes when the store reference or `asOfDate` changes.
- Builds the `TaxCalculationInput` from Step 14 selectors: `selectFinancialDerived` (YTD revenue/expenses) + `selectTaxDerived` over `selectApplicableRules(PFA_2026_SYSTEM_REAL_PACKAGE, { taxYear, asOfDate })`.
- Calls `computeTaxEstimate` (Step 15 engine, async — `crypto.subtle` inputs hash) inside a `useEffect`, with a `cancelled` flag guarding stale async updates.
- Exposes `{ estimate: TaxEstimateResult | null, loading: boolean }`.

### 2. `src/data/dashboardAdapter.tsx` — MODIFIED
`useDashboardData` now wires the hook:
- `const { estimate } = useLatestTaxEstimate(localDateISO())`
- `buildDashboardData(data, estimate ?? LOADING_TAX)` where `LOADING_TAX` is a `review_required` sentinel (`reason: 'loading'`) — the Dashboard degrades to the "no estimate available" state until the async estimate resolves, instead of crashing on `undefined`.

### 3. `src/domain/taxReserve.ts` — MODIFIED (tri-state)
- `TaxReserveState.reservedAmount: number | null` — **tri-state**: `null` = no data recorded, `0` = explicit zero, `> 0` = real amount (always >= 0 when a number).
- `createTaxReserveState(reservedAmount: number | null)` — `null` passes through unchanged; numbers clamped at 0.
- `addToTaxReserve(state, amount)` — returns a NEW state (pure, no mutation). `null + amount` = clamped `amount` (records the first explicit amount); `number + amount` = clamped sum (negative = withdrawal, clamped at 0).
- `computeTaxReserve(estimate, state, query)` — `remainingTarget = max(0, estimatedTaxLiability − (reservedAmount ?? 0))`; `null` is treated as 0 for the math only, and is carried through verbatim in `TaxReserveRecommendation.reservedAmount`.
- Liability/reserve separation invariant unchanged: `estimatedTaxLiability` is the engine total verbatim, never reduced by the reserve.

### 4. `src/data/dashboard.ts` — MODIFIED
- `getTaxReserve` / `buildSnapshot` create the state via `createTaxReserveState(null)` — honest "no data recorded" (no fabricated zero).
- `currentReserveCents: (reserve.reservedAmount ?? 0) * 100` — cents conversion treats null as 0 for display math only.

### 5. `src/components/TaxReserve.tsx` — MODIFIED
- `reservedAmount === null` → renders `—` with hint `Nicio sumă înregistrată.` (no amount recorded) — visually distinct from rendering `0 lei` for an explicit zero.

### 6. `src/domain/taxReserve.test.ts` — MODIFIED
15 → 19 tests (+4 tri-state coverage), all pass:
- `carries a null reserve through verbatim and targets the full liability`
- `keeps an explicit zero reserve as zero (distinct from null)`
- `passes null through as "no data recorded"`
- `adds to a null state, recording the clamped amount`

## How the Dashboard now gets a live tax estimate

`useDashboardData` (dashboardAdapter.tsx) → `useLatestTaxEstimate` (derived.ts) → on every store change: Step 14 selectors build the `TaxCalculationInput` → Step 15 `computeTaxEstimate` (async) → result stored in hook state → `buildDashboardData(data, estimate)` → `DashboardData.tax`, `reserve`, `snapshot.taxReserve`, and `insights` all derive from the live estimate. No manual "recalculate" call site is needed — the estimate follows the data.

## Verification

- `npx vitest run` → **28 files, 332/332 pass** (11.07s).
- `npx tsc --noEmit` → 6 errors, all pre-existing in unrelated test files (`completeness.test.ts` ×1, `deadlines.test.ts` ×2, `derived.test.ts` ×1, `fiscal/rules.test.ts` ×1, `thresholds.test.ts` ×1) — the exact set documented in Step 27. Zero errors in any Step 28 file.
- `grep -rn "addToTaxReserve" src` (non-test) → only the definition in `taxReserve.ts` — confirms no UI caller yet.

## Known limitations / follow-ups
- **No "record reserve" UI**: `reservedAmount` is only ever set to `null` by the adapter (`createTaxReserveState(null)` in `dashboard.ts`); `addToTaxReserve` exists in the domain but has no UI caller. Users see the `—` / "Nicio sumă înregistrată." state until a reserve-recording step lands.
- **Async estimate**: first render shows the `LOADING_TAX` sentinel (`review_required`, reason `loading`); tax-dependent panels show the "no estimate available" state until `crypto.subtle` resolves.
- **No persistence**: the tri-state is in-memory only; `createTaxReserveState(null)` is reconstructed on every dashboard build (by design — nothing has been recorded yet).
- **Pre-existing tsc errors** in 5 unrelated test files remain (documented since Step 27); fixing them is a separate task.

## Constraints honored
- No tri-state semantics changes beyond the design (`null` / `0` / `> 0` as specified).
- No hook architecture changes: `useLatestTaxEstimate` reuses the flat store + `useEffect`; no new reactive infrastructure.
- Pure domain: `taxReserve.ts` has no React/DOM/store imports; `computeTaxReserve` is synchronous and deterministic.
- No test/type fixes were needed — the Worker 1/2 changes were clean on first run.
