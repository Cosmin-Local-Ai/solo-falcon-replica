# Step 11 — Fiscal rules

## Objective

Pure domain layer for fiscal rules: typed `FiscalRule` / `FiscalParameter` /
`RuleRelease` models, a verified 2026 system-real package (8 rules, Task 6
baseline only), a calculator registry, and a date/year selector. No Dashboard,
no legislation ingestion, no eval/interpreter.

## Files created

- `src/domain/fiscal/rules.ts` — types (16-field `FiscalRule`, `FiscalParameter`, `RuleRelease`)
- `src/domain/fiscal/package2026.ts` — `PFA_2026_SYSTEM_REAL_PACKAGE` (8 rules)
- `src/domain/fiscal/release2026.ts` — `PFA_2026_RELEASE` (SAFE_ACTIVATION)
- `src/domain/fiscal/calculators.ts` — `calculatorRegistry` (6 calculators)
- `src/domain/fiscal/select.ts` — `selectApplicableRules`
- `src/domain/fiscal/index.ts` — re-exports
- `src/domain/fiscal/fiscal.test.ts` — vitest suite

## 2026 rule package (verified Task 6 baseline)

| Rule | Value | Source |
|---|---|---|
| PFA_2026_TAX_REFERENCE | 4050 lei; 6x/12x/24x/72x multiples | HG 1506/2024 |
| GENERAL_MINIMUM_WAGE_2026_H1 | 4050 lei (Jan–Jun) | HG 1506/2024 |
| GENERAL_MINIMUM_WAGE_2026_H2 | 4325 lei (Jul–Dec) | HG 146/2026 |
| CAS_2026 | 25%, min base 4050, min CAS 1012.5 | ANAF 2026 |
| CASS_2026 | 10%, min base 4050, max annual 48600, min CASS 405 | ANAF 2026 |
| INCOME_TAX_2026 | 10% up to 48600 lei; 16% above (review-required) | ANAF 2026 |
| VAT_THRESHOLD_2026 | 300000 lei | ANAF 2026 |
| PFA_DEADLINE_2026 | single deadline 2027-05-25 | ANAF 2026 |

## Calculator semantics

- `calc-wage-reference` → reference / monthly parameter
- `calc-cas` → 25% of base (min base floor, min CAS floor)
- `calc-cass` → 10% of base (min base floor, annual max cap, min CASS floor); below min base → reviewRequired
- `calc-income-tax` → 10% up to the 48600 lei base limit; above → reviewRequired (progressive portion needs the unsourced 2026 average gross salary)
- `calc-vat-threshold` → threshold value
- `calc-deadline` → deadline date string

## Validation

- `npx tsc --noEmit` — clean
- `npm run build` — ok
- `npm test` — all pass
