# Step 19 — Dashboard Shell

## What was built

The dashboard page (`src/pages/Dashboard.tsx`) is a **shell**: the header, the cockpit strip, and the tax
hero are real; everything below the hero is a structural placeholder for later steps.

## Shell structure (top to bottom)

1. **Header** — page title ("Tablou de bord") plus tax year and last-updated date (`snapshot.taxYear`,
   `snapshot.asOf` via `fmtDate`).
2. **Cockpit strip** — 5 headline stat cards:
   - Venituri PFA (an) — `snapshot.pfaRevenue`
   - Impozit estimat — `tax.output.total` (when computed)
   - Rezervă lunară — `reserve.recommendedMonthlyReserve`
   - Rămâne de pus deoparte — `reserve.remainingTarget`
   - Date complete — `completeness.satisfiedCount/totalCount`
3. **Tax hero** (the only fully implemented content card) shows:
   - **Tax year** — "An fiscal {snapshot.taxYear}"
   - **Estimated total tax** — large `fmtRON(tax.output.total)` value (ESTIMARE wording in the header row)
   - **Data completeness** — "Date complete: X/Y"
   - **Recommended reserve** — "Pune deoparte {fmtRON(reserve.recommendedMonthlyReserve)} pe lună"
   - **Calculation access** — "Deschide calculul" link (`href="/calcul"`)
4. **Financial graph** — structural placeholder (Step 20).
5. **Summary** — structural placeholder (Step 20).
6. **Insights** — structural placeholder (no premature implementation).
7. **Lower sections** — structural placeholders only: Rezervă fiscală, Praguri fiscale (Step 21);
   Termene limită, Date necesare, În așteptare (Step 22).

## Empty state

When there is no recorded data (no PFA revenue and no pending documents), the page shows an onboarding
empty state with imperative CTAs ("Adaugă un venit", "Adaugă o cheltuială") instead of a blank screen.

## Data source

All data comes from the single hook `useDashboardData()` in `src/data/dashboardAdapter.tsx`
(`DashboardData`: `snapshot`, `tax`, `thresholds`, `deadlines`, `completeness`, `reserve`, `insights`,
`pendingCounts`). No direct localStorage/store access in the page.

## Styling

Plain CSS classes (no Tailwind). Pre-existing utilities, untouched: `.card`, `.stat-card`, `.btn`
(`src/styles.css`); `.badge`, `.muted`, `.stack` (`src/components.css`). Dashboard additions in
`src/styles.css`: `.dashboard`, `.grid-5`, `.card-head`, `.card-title`, `.card-body`,
`.tax-hero-value`, `.num`, plus seven new utilities (`.grid`, `.row`, `.hint`, `.grid-2`,
`.between`, `.mono`, `.empty-state`) — these were missing and were added in the fix round.

## Navigation

Plain `<a href>` links matching the app's custom `pushState` routing (no react-router).

## Tests/validation

Re-run after the fix round (2026-10-01):

- `npx tsc --noEmit` — passed, no errors (exit 0).
- `npm run build` (runs `tsc && vite build`) — success: 64 modules transformed; `dist/assets/index-*.css` 12.21 kB, `dist/assets/index-*.js` 239.53 kB; built in ~0.5 s.
- `npm test` (runs `vitest run`) — 15 test files passed, 201/201 tests passed.
