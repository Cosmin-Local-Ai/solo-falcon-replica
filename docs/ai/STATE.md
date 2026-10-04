# STATE

Last sync: 2026-10-02 (step 27 — state sync). This document reflects the repository as
verified on that date, not what earlier documents claimed.

## Verification summary

- `npx vitest run`: **28 test files, 102 tests, all passing**.
- Test files by area: 1 app, 6 components, 4 data, 13 domain, 4 pages.
- Latest commit: `952ac07` — "Dashboard: financial intelligence, domain tax engine, and full docs"
  (109 files).
- No application code was modified during the state sync.

## Implemented (verified in repository)

- **Domain foundation** — `src/domain/`: aggregation, completeness, deadlines, derived,
  profile, projection, snapshots, taxReserve, thresholds, tax, insights.
- **Profile domain** — `src/domain/profile.ts`.
- **Fiscal rule package** — `src/domain/fiscal/` (rules, calculators, package2026).
- **Calculation snapshots** — `src/domain/snapshots/` (serialize + hash).
- **Aggregation** — `src/domain/aggregation.ts`.
- **Derived state** — `src/domain/derived.ts`.
- **Tax engine** — `src/domain/tax.ts` (with `review_required` handling).
- **Thresholds/deadlines** — `src/domain/thresholds.ts`, `src/domain/deadlines.ts`.
- **Dashboard intelligence / data layer** — `src/data/dashboard.ts`
  (15 public functions: summary, monthly series, projection, completeness, pending counts,
  tax estimate, thresholds, deadlines, tax reserve, insights, action items, legislation,
  snapshot builder).
- **Dashboard shell** — `src/pages/Dashboard.tsx`.
- **Recharts financial graph** — `src/components/FinancialChart.tsx`.
- **Financial summary / insights / tax reserve panels** — `FinancialSummary.tsx`,
  `Insights.tsx`, `TaxReserve.tsx`.
- **Additional dashboard sections** — Threshold, Deadline, Completeness, Action,
  Legislation sections (`src/components/dashboard/`).
- **Store methods** — `markExpenseAsPaid`, `addDeclaration`, `completeDeclaration` in
  `src/store.ts`.
- **Unit tests** — 102 passing tests across domain, data, components, pages.

## Partially implemented

- **e2e coverage (step 19)** — unit tests exist and pass; **no e2e/Playwright specs exist**.
  `playwright.config.ts` is present but no spec files are written.
- **Regression fixes (step 25)** — store methods exist and are unit-tested, but no e2e
  regression tests exist.

## Scaffolded

- **Playwright** — config present (`playwright.config.ts`), zero specs.

## Known broken / requires correction

- **The fiscal implementation currently requires correction before being treated as
  trustworthy**:
  - 16% surcharge (suplimentar) is not implemented — impozit pe venit returns
    `review_required` from the engine.
  - CASS minimum-base handling halts the engine.
  - Fiscal-loss (prior-year loss deduction) handling is absent.
  - Fiscal package values must be re-verified against
    `docs/ai/research/06_2026_fiscal_research.md` before engine outputs are trusted.
- Stale doc references in the thresholds/deadlines documentation (noted in step 26).

## Not implemented

- e2e/Playwright test specs.
- 16% surcharge calculation.
- Fiscal-loss carry-forward.
- CASS minimum-base handling.

## Documentation status

- `docs/ai/steps/` — steps 02–27 present (step 27 is this state sync; steps 02–26 are
  recorded in PLAN.md).
- `docs/ai/PLAN.md` — updated 2026-10-02 to match the actual completed-step history.
- `docs/ai/research/` — 2026 fiscal research present (doc 06); fiscal code has not yet
  been corrected to match it.
- `docs/ai/decisions/` — ADRs pending for the fiscal corrections listed above.
