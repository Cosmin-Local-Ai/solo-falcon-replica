# Step 34 — Final Automated Validation & Documentation

## Status

✅ Complete — full validation suite green, coverage map produced for all 17
functional areas. This document supersedes the earlier Step 34 snapshot
(35 files / 412 tests) taken before Workers 1 and 2 finished adding tests.

## Objective

Final validation + documentation for the SOLO Replica AI project. Re-run the
full automated suite (typecheck, unit/integration, build, e2e) against the
current tree and produce a coverage map across the 17 functional areas. This
step is **read-only with respect to source** — it validates and documents; it
does not change expected results to match code. No assertions were weakened,
no tests removed, no sleeps added.

Source material: the Phase-1 scout reports in `/tmp/solo-task-34/`
(`01-test-infra.md`, `02-playwright.md`, `03a-tax-coverage.md`,
`03b-projection-thresholds.md`, `03c-deadlines-insights.md`,
`03d-persistence.md`, `04-regressions.md`, `05-dashboard-browser.md`),
verified against `src/` and `e2e/` before use.

## Validation results (all green)

Run on 2026-10-04 against the final tree (after Worker 1 domain/regression and
Worker 2 dashboard/browser test additions).

| # | Check | Command | Result |
|---|-------|---------|--------|
| 1 | Typecheck | `npm run typecheck` (`tsc --noEmit`) | ✅ Pass — 0 errors |
| 2 | Unit + integration | `npm test` (vitest) | ✅ **450 / 450 passed**, 36 files, 0 failed, 0 pending — 5.86 s |
| 3 | Build | `npm run build` (Vite) | ✅ Success — 762 modules transformed, built in 1.58 s |
| 4 | E2E | `npx playwright test` (chromium, 16 workers) | ✅ **23 / 23 passed** — 1.8 s |

### Build output detail

```
dist/index.html                   0.42 kB │ gzip:   0.30 kB
dist/assets/index-67L-b1BV.css   16.40 kB │ gzip:   3.97 kB
dist/assets/index-UTpyXRpB.js   715.51 kB │ gzip: 209.18 kB
✓ built in 1.58s
```

Warnings only (none blocking): a chunk-size warning (JS bundle > 500 kB —
candidate for code-splitting) and Rollup notes about `@__PURE__` annotations in
`node_modules/zod/v4/core/` that it cannot interpret.

> Note: the `act(...)` messages in the vitest output are React 19
> development warnings, not failures. The playwright config
> (`playwright.config.ts`) defines a single project (chromium, the default)
> with `webServer` auto-starting `npm run dev` on `localhost:5173`
> (`reuseExistingServer: true`).

## Coverage map (17 functional areas)

| # | Area | Primary test file(s) | Status |
|---|------|----------------------|--------|
| 1 | Income tax (10% flat) | `src/domain/tax.test.ts` (33) | ✅ COVERED |
| 2 | CAS boundaries (min base 48,600 / max base 97,200) | `src/domain/tax.test.ts`, `src/domain/thresholds.test.ts` | ✅ COVERED |
| 3 | CASS minimum base / non-obligatoriu exception | `src/domain/tax.test.ts`, `src/domain/thresholds.test.ts` | ✅ COVERED |
| 4 | CASS cap (291,600) | `src/domain/tax.test.ts`, `src/domain/thresholds.test.ts` | ✅ COVERED |
| 5 | 10% income tax (no progressive bracket) | `src/domain/tax.test.ts` | ✅ COVERED |
| 6 | VAT not becoming taxable income | `src/domain/tax.test.ts` (2 Area-6 tests), `src/domain/aggregation.test.ts` | ✅ COVERED — see Area 6 section |
| 7 | Thresholds (5 specs, warning bands, breach semantics) | `src/domain/thresholds.test.ts` (45) | ✅ COVERED |
| 8 | Deadlines (15 per tax year, D212, event-relative, classify) | `src/domain/deadlines.test.ts` (31) | ✅ COVERED |
| 9 | Insights (threshold/deadline/reserve/completeness/tax + invariants) | `src/domain/insights.test.ts` (36), `src/components/Insights.test.tsx` | ✅ COVERED |
| 10 | Persistence (schema/parse/load/save/migration/snapshots) | `src/data/schema.test.ts` (29), `store.load` (17), `store.save` (3), `store.migration` (5), `store.snapshots` (3), `src/domain/snapshots/snapshots.test.ts` (18) | ✅ COVERED |
| 11 | cotaTva boundaries (0/100 inclusive, out-of-range rejected) | `src/data/schema.test.ts`, `src/pages/Revenues.test.tsx` | ✅ COVERED |
| 12 | Client edit (in-place update, no duplication) | `src/pages/Clients.test.tsx` (2), `src/data/store.edit.test.tsx` (8) | ✅ COVERED |
| 13 | Declaration edit (in-place update, status preserved) | `src/pages/Declarations.test.tsx` (2), `src/data/store.edit.test.tsx` (8) | ✅ COVERED |
| 14 | Settings persistence (save/restore, no bank-row duplication) | `src/pages/Settings.test.tsx` (3) | ✅ COVERED |
| 15 | Revenues Back/Forward (URL tab sync, data preservation) | `src/pages/Revenues.test.tsx` (5) | ✅ COVERED |
| 16 | Dashboard (browser / render / mobile 390px) | `e2e/dashboard.spec.ts` (23), `src/pages/Dashboard.test.tsx` (4), `src/components/dashboard/*.test.tsx` (23), `src/data/dashboard.test.ts` (13), `FinancialChart` (11), `FinancialSummary` (3), `TaxReserve` (5) | ✅ COVERED |
| 17 | Navigation / routing + remaining pages | `e2e/dashboard.spec.ts` (nav tests: `/` normalization, sidebar, direct URL), `src/App.test.tsx` | ✅ COVERED |

**Result: 17 / 17 areas COVERED.**

### Notes on specific areas

- **Areas 2–5 — tax engine boundaries.** `src/domain/tax.test.ts` pins the
  exact boundary values: net exactly at CASS min base (24,300 → CASS 2,430)
  vs. just below (24,299 → `review_required`); CAS min base floor (48,600 →
  12,150; 48,599 floored; 48,601 → 12,150.25); CAS cap (97,200 → 24,300,
  97,201 still capped); CASS cap (291,600 → 29,160, 291,601 still capped);
  10% flat income tax at 50,000 net and above 200,000 (no progressive
  bracket); CASS skipped for non-obligatoriu status; `review_required` for
  zero/negative inputs, missing profile id, empty rules package, and
  pre-2026 fiscal years (rules `effectiveFrom` 2026-01-01).
- **Area 7 — thresholds.** 45 tests: the 5 threshold specs (CAS min/max,
  CASS min/max, VAT 395,000 registration), distance arithmetic (below /
  exactly / above), warning bands at exactly ±10% of the threshold value,
  breach semantics per threshold type, `breachMeaning` content, fiscal-base
  mismatch → empty result, and the Step-29 income/ratio-rule status logic.
- **Area 8 — deadlines.** 31 tests: 15 deadlines for tax year 2026,
  chronological ordering, D212 resolution (2027-05-25) and its
  effective-date applicability (including the exact boundary day),
  CAS/CASS quarterly dates, income-tax advance dates, event-relative
  deadlines, `daysRemaining` (including leap-year February), and
  `classifyDeadline` boundary tests (past / due_today / upcoming).
- **Area 9 — insights.** 36 tests: threshold danger/warning boundaries
  (ratio exactly 0.8, exactly 1.0), CASS+CAS canonicalization (worst
  severity wins, tie broken by highest ratio), deadline urgency bands
  (overdue, 0, 1, 15, 30, > 30 days; non-finite days skipped), tax-reserve
  gap logic, completeness (all 9 Romanian labels, unknown-key fallback,
  integration with real `assessCompleteness` output), and invariants
  (no raw key strings, no English leaks, severity sort, determinism).
- **Area 10 — persistence.** `schema.test.ts` (29) covers
  `parseAppData` valid/corrupt payloads per collection (including the
  cotaTva boundary pair), `store.load` (17) covers seed fallback, valid
  load, corrupt recovery, optional-field backfills and the `dataOrigin`
  flag through `StoreProvider`, `store.save` (3) covers the serialization
  contract and controlled write-failure behavior, `store.migration` (5)
  the v1→v2 migration, and `domain/snapshots` (18) the snapshot
  provenance rules.
- **Area 11 — cotaTva.** `schema.test.ts` asserts `cotaTva` at the
  inclusive bounds 0 and 100 is accepted and an out-of-range value
  rejects the whole payload; `Revenues.test.tsx` covers the form-side
  behavior.
- **Area 14 — Settings persistence.** `src/pages/Settings.test.tsx`
  (3 tests) asserts company data persists to localStorage on
  "Salvează", restores on remount, and does not duplicate bank account
  rows on save.
- **Area 15 — Revenues Back/Forward.** `src/pages/Revenues.test.tsx`
  (5 tests) covers URL-sync behavior: resets to the default tab when the
  URL becomes bare `/revenues` (back/forward), re-syncs on a valid tab
  change, defaults to the registered tab on initial mount, plus data
  preservation and stable tab-count badges across tab navigation.
- **Area 16 — Dashboard.** Covered at four levels: (a) the 5 section
  components in isolation (`dashboard/*.test.tsx` — 23 tests: render,
  happy path, empty states, Romanian labels, no raw-enum leakage); (b)
  the data layer (`dashboard.test.ts` — 13); (c) the page render
  (`src/pages/Dashboard.test.tsx` — 4: onboarding CTA, full cockpit,
  em-dash for `review_required`, computed CIT estimate); (d) browser e2e
  (`e2e/dashboard.spec.ts` — 23: cockpit cards, all 8 sections with
  Romanian titles, seeded-FY2025 financial chart & KPI table across
  An/Lunar/YTD ranges, computed-tax CIT seed state, 390×844 mobile
  viewport without horizontal overflow, navigation, empty state).
- **Area 17 — Navigation/routing.** `e2e/dashboard.spec.ts` covers the
  `/` → `/dashboard` normalization, sidebar navigation to `/revenues`,
  and direct-URL access; `src/App.test.tsx` covers the app shell.

## Area 6 — RESOLVED: VAT not becoming taxable income

**Status: RESOLVED — the requirement is met by the implementation.**

### Resolution

The tax engine nets VAT out of the taxable base for non-exempt profiles and
branches on `vatExempt` (exempt profiles keep the gross base).

- `src/domain/tax.ts` — `computeTaxEstimate` reads `inputs.vatExempt` and,
  for non-exempt profiles, uses the VAT-excluded net figures
  (`revenuesNet`/`expensesNet`) as the taxable base; exempt profiles keep
  the gross figures. `revenuesNet`/`expensesNet` are **required** on
  `TaxCalculationInput` and validated up front (missing/undefined →
  `review_required`, never a silent fallback to gross).
- `src/domain/aggregation.ts` — `YtdTotals` carries `revenueNet`/`expenseNet`
  (sums of `valoareFaraTva`), flowing through `selectYtd` into the tax
  inputs.
- `src/domain/tax.test.ts` — Area 6 tests assert VAT exclusion for a
  non-exempt profile (gross 55,000 → net 50,000 base) and the `vatExempt`
  branch (gross base retained).
- `src/domain/aggregation.test.ts` — asserts `revenueNet`/`expenseNet` on
  `YtdTotals`, including the `tva=0` edge case (net equals gross).

Previous state (before fix), for reference — verified evidence:

1. `src/domain/tax.ts` contained **no VAT handling at all**.
   `computeTaxEstimate` took `revenues` as a gross figure and computed
   `net = gross - deductible` with no VAT netting — VAT was never
   subtracted from the taxable base.
2. `src/domain/aggregation.ts` documented the old design explicitly:
   `recordTotal(r) = r.valoareFaraTva + r.tva`. Aggregated revenue
   **included VAT**, and that revenue flowed into the tax base.
3. `vatExempt` was a profile field passed into the tax inputs
   (`src/domain/derived.ts` → `TaxInputsReference.inputs.vatExempt`) but
   was **never read** by `computeTaxEstimate` — a dead input with no
   effect.

**Previous behavior:** VAT **was** part of the taxable net, which
contradicted the Area 6 requirement ("VAT not becoming taxable income").
The original recommendation (net VAT out of the taxable base for
non-exempt profiles, branch on `vatExempt`, add tests asserting VAT
exclusion) has been **implemented and is now covered by passing tests** —
no open action remains for this area.

## Test inventory (36 vitest files, 450 tests + 23 e2e tests)

| Count | File |
|-------|------|
| 45 | `src/domain/thresholds.test.ts` |
| 36 | `src/domain/insights.test.ts` |
| 33 | `src/domain/tax.test.ts` |
| 31 | `src/domain/deadlines.test.ts` |
| 29 | `src/data/schema.test.ts` |
| 24 | `src/domain/aggregation.test.ts` |
| 22 | `src/domain/derived.test.ts` |
| 21 | `src/domain/projection.test.ts` |
| 19 | `src/domain/taxReserve.test.ts` |
| 18 | `src/domain/profile.test.ts` |
| 18 | `src/domain/snapshots/snapshots.test.ts` |
| 17 | `src/domain/fiscal/fiscal.test.ts` |
| 17 | `src/data/store.load.test.tsx` |
| 13 | `src/data/dashboard.test.ts` |
| 12 | `src/domain/fiscal/rules.test.ts` |
| 11 | `src/components/FinancialChart.test.tsx` |
| 10 | `src/domain/completeness.test.ts` |
| 8 | `src/data/store.edit.test.tsx` |
| 5 | `src/components/dashboard/ActionSection.test.tsx` |
| 5 | `src/components/dashboard/CompletenessSection.test.tsx` |
| 5 | `src/components/dashboard/DeadlineSection.test.tsx` |
| 5 | `src/components/TaxReserve.test.tsx` |
| 5 | `src/data/store.migration.test.ts` |
| 5 | `src/pages/Revenues.test.tsx` |
| 4 | `src/components/dashboard/LegislationSection.test.tsx` |
| 4 | `src/components/dashboard/ThresholdSection.test.tsx` |
| 4 | `src/components/Insights.test.tsx` |
| 4 | `src/pages/Dashboard.test.tsx` |
| 3 | `src/data/derived.test.tsx` |
| 3 | `src/data/store.save.test.tsx` |
| 3 | `src/data/store.snapshots.test.tsx` |
| 3 | `src/components/FinancialSummary.test.tsx` |
| 3 | `src/pages/Settings.test.tsx` |
| 2 | `src/pages/Clients.test.tsx` |
| 2 | `src/pages/Declarations.test.tsx` |
| 1 | `src/App.test.tsx` |

E2E (Playwright, chromium):

| Count | File |
|-------|------|
| 23 | `e2e/dashboard.spec.ts` |

> The inventory above is the authoritative snapshot for this run (36 files /
> 450 vitest tests, verified against `find src -name '*.test.*'`; 23 e2e
> tests, verified against `npx playwright test --list`). It supersedes the
> earlier Step 34 snapshot (35 files / 412 tests).

## Findings

1. **All 4 validation commands pass** on the final tree: typecheck (0
   errors), vitest (450/450, 36 files), build (762 modules, 1.58 s),
   Playwright (23/23, chromium).
2. **Area 6 (VAT not taxable income) — RESOLVED.** See the dedicated
   section above. VAT is netted out of the taxable base for non-exempt
   profiles, `vatExempt` branches the computation, and tests assert VAT
   exclusion.
3. **`vatExempt` is a live input** — read by `computeTaxEstimate` to branch
   between the net (non-exempt) and gross (exempt) bases.
4. **17 / 17 functional areas covered** by the test suite (see coverage
   map). No area required a failing test; the suite is green end-to-end.
5. **No failures, no bugs found** during this validation run. No source
   changes were made by this step.

## Follow-up recommendations

1. **Bundle size** — the production JS bundle is 715.51 kB (209.18 kB
   gzip), triggering Vite's > 500 kB chunk warning. Consider code-splitting
   (dynamic `import()`) or `manualChunks` in a future step. Cosmetic; not a
   functional issue.
2. No other action required for this validation step — all 17 areas are
   covered and the suite is green.
