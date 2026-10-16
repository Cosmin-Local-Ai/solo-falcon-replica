# Step 27 — State sync: documentation aligned with actual implementation

Date: 2026-10-02
Scope: documentation/state cleanup only. No application code modified.

## Purpose

`docs/ai/STATE.md` and `docs/ai/PLAN.md` had fallen behind the repository. STATE.md tracked
only through step 21 while step files up to 26 already existed, and PLAN.md described an
older 18-step plan that no longer matched the step files. This step re-verified the actual
state of the repository and rewrote both documents to match it.

## Method

Claims from the documentation were not taken at face value. Each was checked against the
repository:

- `src/` tree enumerated and compared to documented modules.
- `npx vitest run` executed: **28 test files, 102 tests, all passing**.
- `src/domain/fiscal/package2026.ts`, `src/domain/fiscal/calculators.ts`, `src/domain/tax.ts`
  inspected against `docs/ai/research/06_2026_fiscal_research.md`.
- `src/data/dashboard.ts` exported functions enumerated (15 public functions).
- `src/pages/Dashboard.tsx` panel wiring inspected (9 panels/sections rendered).
- Store methods (`markExpenseAsPaid`, `addDeclaration`, `completeDeclaration`) confirmed in
  `src/store.ts`.
- Test files counted by path: 28 total (1 app, 6 components, 4 data, 13 domain, 4 pages).

## Verified implementation status

### Implemented (verified in repo)

- Domain foundation (`src/domain/`): aggregation, completeness, deadlines, derived,
  profile, projection, snapshots, taxReserve, thresholds, tax, insights.
- Profile domain.
- Fiscal rule package (fiscal 2026 rules, calculators, package2026).
- Calculation snapshots (serialize + hash).
- Aggregation.
- Derived state.
- Tax engine.
- Thresholds/deadlines.
- Dashboard intelligence (data layer: `src/data/dashboard.ts`).
- Dashboard shell (`src/pages/Dashboard.tsx`).
- Recharts financial graph (`src/components/FinancialChart.tsx`).
- Financial summary / insights / tax reserve panels.
- Additional dashboard sections: Threshold, Deadline, Completeness, Action, Legislation.
- Unit tests across domain, data, components, pages (102 passing).
- Store methods for dashboard actions.

### Partially implemented

- **e2e coverage**: unit tests exist and pass, but no e2e/Playwright specs exist.
  `playwright.config.ts` is present (scaffolded) with no spec files.
- **Regression fixes (step 25)**: the store methods exist and are covered by unit tests,
  but no e2e regression tests exist.

### Scaffolded

- Playwright config (`playwright.config.ts`) — no specs written.

### Known broken / requires correction

- **Fiscal implementation requires correction before being treated as trustworthy**:
  - 16% surcharge (suplimentar) not implemented — impozit pe venit returns
    `review_required` in the engine.
  - CASS minimum-base handling halts the engine.
  - Fiscal-loss (prior-year loss deduction) handling absent.
  - Fiscal package values must be re-verified against
    `docs/ai/research/06_2026_fiscal_research.md` before the engine's outputs are trusted.
- Stale doc references in thresholds/deadlines documentation (noted in step 26).

### Not implemented

- e2e/Playwright test specs.
- 16% surcharge calculation.
- Fiscal-loss carry-forward.
- CASS minimum-base handling.

## Result

- `docs/ai/STATE.md` rewritten to reflect the verified state above.
- `docs/ai/PLAN.md` updated so the completed-step history matches reality (steps 02–26).
- No application code changed.
