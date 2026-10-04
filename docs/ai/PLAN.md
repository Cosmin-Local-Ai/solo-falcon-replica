# SOLO Replica AI Plan

Last synced: 2026-10-02 (step 27 — state sync). The step files in `docs/ai/steps/` are the
source of truth for history. Statuses below were verified against the repository on the
sync date, not taken from the step documents.

## Completed steps (verified)

| Step | Title | File | Status |
|---|---|---|---|
| 02 | Repository Scout Report | `02_repo_scout.md` | complete |
| 03 | Dashboard Data Scout | `03_dashboard_data_scout.md` | complete |
| 04 | Defect Verification | `04_defect_scout.md` | complete |
| 07 | Legislation System Specification | `07_legislation_spec.md` | complete |
| 08 | Development Dependencies (Test & Tooling Stack) | `08_stack_setup.md` | complete |
| 10 | PFA/Profile Domain Foundation | `10_profile_domain.md` | complete |
| 11 | Fiscal Rules | `11_fiscal_rules.md` | complete — values need verification (see Known issues) |
| 12 | Calculation Snapshots | `12_calculation_snapshots.md` | complete |
| 13 | Financial Aggregation | `13_financial_aggregation.md` | complete |
| 14 | Derived State (Invalidation/Recomputation) | `14_derived_state.md` | complete |
| 15 | Deterministic Tax Calculation Engine | `15_tax_engine.md` | complete — engine has known gaps (see Known issues) |
| 16 | Threshold & Deadline Engines | `16_thresholds_deadlines.md` | complete |
| 17 | Dashboard Intelligence (non-UI) | `17_dashboard_intelligence.md` | complete |
| 18 | Dashboard Data Layer | `18_dashboard_data_layer.md` | complete |
| 19 | Dashboard Shell | `19_dashboard_shell.md` | complete |
| 20 | Financial Graph | `20_financial_graph.md` | complete (Recharts) |
| 21 | Dashboard Financial Panels | `21_dashboard_financial_panels.md` | complete |
| 22 | Dashboard Action & Intelligence Panels | `22_dashboard_actions.md` | complete (store methods present) |
| 23 | Dashboard Legislation Awareness Surface | `23_dashboard_legislation.md` | complete |
| 24 | Dashboard Polish | `24_dashboard_polish.md` | complete |
| 25 | Regression Fixes | `25_regression_fixes.md` | partial — store methods unit-tested; no e2e regression tests |
| 26 | Domain Tests (QA) | `26_domain_tests.md` | complete — 28 test files, 102 tests passing |
| 27 | State Sync (documentation) | `27_state_sync.md` | complete |

Notes:

- No step files exist for numbers 01, 05, 06, 09; the plan numbering above follows the
  files that actually exist.
- Steps 12–26 were shipped in a single commit (`952ac07`, 109 files).

## Known issues (verified 2026-10-02)

- **The fiscal implementation requires correction before being treated as trustworthy**:
  - 16% surcharge (suplimentar) not implemented — impozit pe venit returns
    `review_required`.
  - CASS minimum-base handling halts the engine.
  - Fiscal-loss (prior-year loss deduction) handling absent.
  - Fiscal package values must be re-verified against
    `docs/ai/research/06_2026_fiscal_research.md`.
- Stale doc references in the thresholds/deadlines documentation (noted in step 26).
- No e2e/Playwright specs exist; `playwright.config.ts` is scaffolded only.

## Next

1. Correct the fiscal engine (16% surcharge, CASS minimum base, loss carry-forward,
   verify package values against research doc 06).
2. Write e2e/Playwright specs (config already in place).
3. Browser QA.
4. Final audit.
5. ADRs for the fiscal corrections.
