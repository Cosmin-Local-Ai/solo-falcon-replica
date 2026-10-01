# Step 17 — Dashboard Intelligence (non-UI)

## Objective

Build the non-UI intelligence layer for the SOLO replica dashboard: three pure-function modules that turn existing domain data and the step 15 tax engine output into (1) a tax reserve recommendation, (2) a data completeness assessment, and (3) a deterministic list of insight events.

Scope is strictly non-UI: no dashboard rendering, no LLM calls, no new fiscal research. All three modules are pure functions over `src/data/types.ts` records plus `TaxEstimateResult` from `src/domain/tax.ts` — no clock access, no I/O, no network, fully deterministic.

## Tax Reserve

`src/domain/taxReserve.ts` — computes how much cash the user should still set aside for the estimated full-year tax bill.

### The four values

`computeTaxReserve(estimate, reserve, { asOfDate, fiscalYear })` returns a `TaxReserveRecommendation`:

| Value | Meaning | Source |
|---|---|---|
| `estimatedTaxLiability` | Estimated full-year tax (CZK) | `estimate.output.total` when `estimate.status === 'computed'`, else `null` |
| `reservedAmount` | Already reserved (CZK) | `reserve.reservedAmount`, clamped to ≥ 0 |
| `remainingTarget` | Still to reserve (CZK) | `max(0, estimatedTaxLiability − reservedAmount)`; `0` when no estimate is available |
| `recommendedMonthlyReserve` | Suggested monthly set-aside (CZK) | `remainingTarget / monthsRemaining`; `0` when the fiscal year is over |

### Computation

- `monthsRemainingInFiscalYear(asOfDate, fiscalYear)` counts months **inclusively** from the asOf month through December of the fiscal year: Jan → 12, Jun → 7, Dec → 1. Dates before the fiscal year count as 12; dates after it as 0.
- `remainingTarget` is clamped at 0, so an over-reserved position (reserve > liability) reports 0 remaining and 0 monthly.
- A `review_required` estimate (engine failed or no profile) is treated as **no estimate**: `null` liability, zero targets — the UI must not show a fabricated number.
- State helpers: `createTaxReserveState(amount)` clamps at 0; `addToTaxReserve(state, delta)` is immutable and treats negative deltas as withdrawals clamped at 0.

### Liability vs. cash-planning recommendation

`estimatedTaxLiability` is the **tax engine's output verbatim** — it is never reduced by the reserve. `recommendedMonthlyReserve` is a **cash-flow planning figure** derived from what is still owed. The two are strictly separate values in the return type, and the UI must never subtract the reserved amount from the liability.

## Data Completeness

`src/domain/completeness.ts` — `assessCompleteness(input: CompletenessInput): CompletenessAssessment`.

Completeness is derived from **actual data presence**, never a fabricated percentage. The score is the ratio of passed checks (rounded to 4 decimals); each check reports its own evidence in `detail`.

### The 9 checks

| Check id | Satisfied when | Detail text (examples) |
|---|---|---|
| `profile` | `profile !== null` | `profile present (fiscal year 2026, regime micro)` |
| `income` | ≥ 1 revenue entry | `3 revenue entries` / `no revenue entries` |
| `expenses` | ≥ 1 expense entry | `2 expense entries` / `no expense entries` |
| `clients` | ≥ 1 client with a name | `2 clients` / `no clients` |
| `documents` | ≥ 1 document with a name | `1 document` / `no documents` |
| `companyDocuments` | ≥ 1 entry in any section (registration, bank, insurance, other) | `1 company document` / `no company documents` |
| `declarations` | ≥ 1 declaration | `1 declaration` / `no declarations` |
| `statements` | ≥ 1 bank statement | `1 bank statement` / `no bank statements` |
| `taxEstimate` | a **computed** estimate with a total exists | `computed estimate (total 18,535)` / `no computed tax estimate` |

`CompletenessCheck` = `{ id, label, ok, detail }`; `CompletenessAssessment` = `{ score, checks }`. `score` is `passedChecks / 9`. The module is pure and deterministic — no clock, no I/O.

## Deterministic Insights

`src/domain/insights.ts` — `generateInsights(input: InsightInput): Insight[]`.

`InsightInput` carries the same records as the completeness input plus `estimate: TaxEstimateResult | null` and `reserve: TaxReserveRecommendation`. Each `Insight` is:

```ts
{
  id: string;          // e.g. "insight-<type>"
  type: InsightType;   // one of the 10 types below
  severity: 'info' | 'warning' | 'critical';
  priority: number;    // 1–10, higher = more urgent
  title: string;       // human-readable, no personal data
  detail: string;      // human-readable explanation
  conditions: string;  // machine-readable, e.g. "revenue=48000, threshold=50000, ratio=0.96"
  timestamp: string;   // from the injected asOfDate, never a live clock
}
```

### The 10 event types

| # | Type | Severity | Priority | Condition |
|---|---|---|---|---|
| 1 | `INCOME_THRESHOLD_APPROACHING` | warning | 8 | annual revenue ≥ 80% of the micro→small regime threshold (€50,000) |
| 2 | `EXPENSE_RATIO_HIGH` | info | 4 | total expenses ≥ 60% of revenue (revenue > 0) |
| 3 | `DATA_MISSING` | warning | 6 | 0 revenue entries, 0 expense entries, 0 clients, 0 documents, or no profile |
| 4 | `RESERVE_BEHIND` | warning | 7 | `remainingTarget > 0` and `recommendedMonthlyReserve > 0` and reserved < 50% of liability |
| 5 | `RESERVE_ADEQUATE` | info | 3 | liability > 0 and reserved ≥ liability |
| 6 | `FISCAL_YEAR_ENDING` | warning | 9 | asOfDate falls in Oct/Nov/Dec |
| 7 | `DECLARATION_DUE_SOON` | critical | 10 | a `scheduled` declaration with dueDate within 30 days of asOfDate |
| 8 | `STATEMENT_INCOMPLETE` | info | 2 | 0 bank statements |
| 9 | `COMPANY_DOCS_MISSING` | info | 5 | 0 company documents and `profile.regime === 'micro'` |
| 10 | `TAX_ESTIMATE_UNAVAILABLE` | warning | 6 | estimate is `null` or `status !== 'computed'` |

### Conditions format

`conditions` is a flat, comma-separated key=value string built from the **actual values that triggered the check** (e.g. `revenue=48000, threshold=50000, ratio=0.96`, `reserved=5000, liability=18535, ratio=0.27`). It is machine-readable for the UI to render or filter on, and contains no personal data.

### No-LLM guarantee

The module has **no dependency on any LLM/agent module** — no `llmClient.ts` import, no model calls, no prompt building. Output is a deterministic function of the inputs: identical inputs produce identical `Insight[]` (same ids, severities, priorities, conditions). `llmClient.ts` remains reserved for the LLM tab only.

## Architecture

### Files

```
src/domain/
  taxReserve.ts          # reserve recommendation (pure)
  taxReserve.test.ts
  completeness.ts        # completeness assessment (pure)
  completeness.test.ts
  insights.ts            # deterministic insights (pure)
  insights.test.ts
```

All three sit alongside the existing step 13–16 domain modules (`aggregations.ts`, `tax.ts`, `snapshots/`, `fiscal/`) and consume only their types — no changes to any existing file.

### Public API

| Module | Exports |
|---|---|
| `taxReserve.ts` | `TaxReserveState`, `TaxReserveRecommendation`, `createTaxReserveState`, `addToTaxReserve`, `computeTaxReserve`, `monthsRemainingInFiscalYear` |
| `completeness.ts` | `CompletenessCheck`, `CompletenessAssessment`, `CompletenessInput`, `assessCompleteness` |
| `insights.ts` | `Insight`, `InsightType`, `InsightInput`, `generateInsights` |

### Composition

```
estimateTax() [step 15]
      │  TaxEstimateResult
      ├──────────────► computeTaxReserve(estimate, reserve, { asOfDate, fiscalYear })
      │                        │  TaxReserveRecommendation
      │                        ▼
      └────────────────► generateInsights(records…, estimate, reserve)
                                   │  Insight[]

assessCompleteness(records…, estimate)   # independent, same records
                                   │  CompletenessAssessment
```

The dashboard UI (a later step) calls the three functions with in-memory records from `src/data/store.tsx` plus the engine result, and renders the values. No module in this layer knows about React, the store, or any UI.

## What is NOT built

- **Dashboard UI** — no cards, charts, layout, or store wiring; that is a later step.
- **LLM integration** — no model calls anywhere in this layer; `llmClient.ts` is untouched and unused by it.
- **New fiscal research** — no new rates, brackets, or deadlines were researched; the only fiscal constant the insights module references is the €50,000 micro→small regime threshold.
- **Persistence** — `TaxReserveState` is an in-memory pure state object; nothing is written to the store or localStorage.
- **Live data fetching** — all modules operate on records passed in as arguments.

## Test coverage

All tests are pure: no mocks, no network, no clock (dates are injected).

| File | Tests | Covers |
|---|---|---|
| `taxReserve.test.ts` | 14 | liability/reserve separation; null and `review_required` estimates; partial reserve; full coverage; over-reserve clamping; Dec → 1 month, Jan → 12 months, before/after fiscal year; zero monthly when year is past; determinism; state creation clamping; immutable add; negative add clamped at 0 |
| `completeness.test.ts` | 9 | empty data (all checks fail, no crash); fully-populated data (all pass); partial data; tax estimate check requires a computed snapshot; company documents pass on any section; inregistrata income noted in detail; profile detail carries fiscal year and regime; determinism; no percentage/score field on checks |
| `insights.test.ts` | 11 | each of the 10 event types fires under its condition; no false positives on clean data; determinism |

## Unresolved issues

- `src/domain/insights.ts` and `src/domain/insights.test.ts` are **not present in the working tree** at the time of writing; the insights section above is documented from the worker 7 checkpoint, which reports both files created with 11 passing tests. The files need to be committed. The `FISCAL_THRESHOLDS` constant the checkpoint references for the income threshold is also absent from the tree — the €50,000 micro→small value must be sourced (or the constant restored) when the module is committed.
- `TaxReserveState` is not persisted — the UI step must decide where the reserve amount lives (store field vs. local state) and how `addToTaxReserve` is invoked.
- The completeness score is an unweighted check ratio (9 checks); weighting (e.g. income > statements) was deliberately not introduced.
- Insight `timestamp` is derived from the injected `asOfDate`; a live "generated at" time would require a UI-layer concern, not a domain one.
