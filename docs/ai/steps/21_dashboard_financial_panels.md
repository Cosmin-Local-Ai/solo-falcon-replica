# Step 21 — Dashboard Financial Panels

## What was built

The three structural placeholders from Step 19 that belong to the financial panels are now real
components, wired into `src/pages/Dashboard.tsx` in place (no reordering, no redesign of the
shell):

1. **"Rezumat"** placeholder → `<FinancialSummary summary={summary} />`
2. **"Insights"** placeholder → `<Insights insights={data.insights} />`
3. **"Rezervă fiscală"** placeholder → `<TaxReserve reserve={data.reserve} />`

The remaining lower-section placeholders (Praguri fiscale, Termene limită, Date necesare,
În așteptare) are untouched and stay as `PlaceholderCard`s for the later steps.

## The three components and their prop interfaces

All three are presentational: one prop each, no hooks, no store access, no business logic.

- `src/components/FinancialSummary.tsx` — `FinancialSummary({ summary: YtdTotals })`,
  where `YtdTotals = { revenue: number; expenses: number; net: number }` (lei, from
  `src/domain/aggregation.ts`). Renders three stat cards: Venituri, Cheltuieli, Profit net
  (net shown with a `neg` tone when negative).
- `src/components/Insights.tsx` — `Insights({ insights: Insight[] })`, where `Insight` is
  from `src/domain/insights.ts` (`id`, `eventType`, `severity: 'info' | 'warning' | 'danger'`,
  `priority`, `title`, `description`, `action`, `conditions`). Renders each insight as
  title + severity label (Info / Atenție / Urgent) + description + action.
- `src/components/TaxReserve.tsx` — `TaxReserve({ reserve: TaxReserveRecommendation })`,
  where `TaxReserveRecommendation = { estimatedTaxLiability: number | null; reservedAmount:
  number; remainingTarget: number; monthsRemaining: number; recommendedMonthlyReserve:
  number }` (lei, from `src/domain/taxReserve.ts`).

## Where each value comes from (Step 18 data layer)

The page is the only place that touches data; components present only:

- **Rezumat** — `const summary = getFinancialSummary(appData, snapshot.asOf)` in the page.
  `getFinancialSummary(data: AppData, asOfDate: string): YtdTotals` is a pure Step 18 selector
  (`src/data/dashboard.ts`, delegating to `selectYtd` in `src/domain/aggregation.ts`); it
  sums `valoareFaraTva + tva` over `inregistrata` records from `${fiscalYear}-01-01` to
  `asOf` (inclusive). `appData` comes from `useStore()`; `snapshot.asOf` is the reference
  date, so the summary is consistent with the rest of the dashboard snapshot.
- **Insights** — `data.insights` from `useDashboardData()` (`DashboardData.insights`,
  built by Step 18's `buildDashboardData` via `getInsights(data, snapshot)`).
- **Rezervă fiscală** — `data.reserve` from `useDashboardData()`
  (`DashboardData.reserve`, built by Step 18's `getTaxReserve(data, asOf, tax)`).

No component imports a data-layer function, the store, or localStorage.

## Architectural rule

No business calculations in components, no direct persistence access. Unavailable,
incomplete, and review-required states are **preserved, not invented and not zeroed**:

- `TaxReserve` renders a "no estimate" message when `reserve.estimatedTaxLiability ===
  null` (which is exactly the state Step 18 produces for a `review_required`/loading tax
  estimate) — it does not fabricate a number and does not display `0` as if it were real.
- `Insights` treats the empty array as the legitimate "all clear" state.
- `FinancialSummary` renders plain numbers as produced by the selector (Step 18 has no
  missing-state for YTD totals; `0` is a literal zero).

## Empty states implemented

- **Insights** — `insights.length === 0` → "Ești la zi. Nu există probleme de rezolvat în
  momentul de față."
- **Rezervă fiscală** — `estimatedTaxLiability === null` → "Nu există o estimare fiscală
  disponibilă — rezerva recomandată nu poate fi calculată."
- **Rezumat** — no empty state: always shows the three stat cards (zeros when no data).
- The page-level `hasData` onboarding gate from Step 19 is unchanged and still gates the
  whole dashboard content.

## Tax reserve vs. estimated tax liability — visual distinction

The two are kept strictly separate in the UI, mirroring the Step 17 invariant:

- **Recommended monthly reserve** is the panel's hero figure — large `.tax-hero-value`
  number ("Recomandat de pus deoparte lunar"), with the remaining target and months left
  as supporting text.
- **Estimated tax liability** is a small, secondary muted figure (`.hint mono`) in a
  corner stat card ("Estimare obligație fiscală") — clearly *not* the amount to set aside.
- The reserve is presented as a cash-planning recommendation ("de pus deoparte"), never as
  the amount owed; the component never subtracts `reservedAmount` from the liability.

## Tests

New component tests (vitest + `@testing-library/react`, same pattern as
`src/components/FinancialChart.test.tsx` — props passed directly, no mocks, since all
three components are presentational):

- `src/components/FinancialSummary.test.tsx` — Venituri / Cheltuieli / Profit net with
  formatted values; plain `0,00 RON` when totals are zero (no invented empty state);
  negative net rendered honestly with the `neg` tone.
- `src/components/TaxReserve.test.tsx` — hero value "Recomandat de pus deoparte lunar";
  "Estimare obligație fiscală" as a distinct stat when present;
  `estimatedTaxLiability === null` → "Nu există o estimare fiscală disponibilă — rezerva
  recomandată nu poate fi calculată." (never zero); remaining-target / "Rezerva este
  complet acoperită." supporting text.
- `src/components/Insights.test.tsx` — empty array → "Ești la zi. Nu există probleme de
  rezolvat în momentul de față." (no fabricated warnings); severity badge (Info /
  Atenție / Urgent), title, description, action per insight; multiple insights all render.

Existing domain tests cover the intelligence layer the panels present:
`src/domain/insights.test.ts`, `src/domain/taxReserve.test.ts`,
`src/domain/aggregation.test.ts`, `src/data/dashboard.test.ts`.

## Commands / results

- `npx tsc --noEmit` — passed, no errors (exit 0).
- `npm run build` — passed (vite build, no errors; pre-existing chunk-size warning only).
- `npm test` (vitest run) — all pass: 19 test files, 224 tests (including the 12 new
  component tests: 3 FinancialSummary + 5 TaxReserve + 4 Insights).

## Limitations

- `Insight.priority` is preserved in the data but not visually rendered — the visual
  contract shows `severity` (Info / Atenție / Urgent).
- `FinancialSummary` renders zero values as plain `0,00 RON` per the domain contract —
  there is no missing-state for YTD totals; `0` is a literal zero, not an empty state.
- `TaxReserve.estimatedTaxLiability === null` means "no estimate" (a `review_required`
  tax estimate maps to `null` in the domain) — the panel shows the honest no-estimate
  message and never displays `0` as if it were a real liability.
