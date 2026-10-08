# BRIEF 14 — The annual tax estimate must be fed by the projection, not by raw YTD

Owner: Worker 1 of 4 (orchestrator plan: projection→estimate, expense deductibility, tax-reserve
persistence, threshold semantics). This brief is the whole of your assignment. Do not start the next one.

## 1. The defect, precisely

Two call sites feed **raw YTD totals** into the tax engine:

- `src/data/dashboard.ts:88` `getTaxEstimate()` — `selectYtd(...)` → `computeTaxEstimate({ revenues: ytd.revenue, expenses: ytd.expenses, revenuesNet: ytd.revenueNet, expensesNet: ytd.expenseNet })`
- `src/data/derived.ts:47` `useLatestTaxEstimate()` — **this is the production path** (`dashboardAdapter.tsx:21` → `buildDashboardData`). It does the same thing with `derived.ytd`.

The engine's own vocabulary is **annual**:

- `TaxAmountBases.venitulNetDinActivitate` is documented as "the base CAS is chosen on (CF art. 148
  alin. (1)-(2)) and the base CASS is owed on (CF art. 170 alin. (1), art. 174 alin. (2) și (6))".
- CF art. 118 alin. (3) — „Veniturile … ce se realizează într-o fracțiune de an … se consideră venit
  anual" — is already surfaced as a line in `tax.ts`.
- The CAS ladder (art. 148 alin. (2)) and the CASS 6-SM top-up (art. 174 alin. (6)) are **annual** bases.

So on 15 Sept the „Impozit estimat" card reports the tax on 8.5 months of activity, while the app already
owns a deterministic annual model: `selectProjectionV1` in `src/domain/projection.ts`
(`method: 'run-rate-v1'`, `annualProjected`, `elapsedMonths`, `series[].kind: 'actual' | 'projected'`).

## 2. Binding decisions (orchestrator)

1. The user-facing tax estimate becomes the **annual** estimate, computed on the existing run-rate
   projection basis. No new forecasting model — `run-rate-v1` is the model.
2. `getFinancialSummary`, `FinancialSummary`, `selectYtd`, `selectMonthly`, `snapshot.pfaRevenue` stay
   **YTD**. Do not change them.
3. **Threshold bases stay YTD.** `buildThresholdBases` must not silently start receiving annualised
   amounts. The VAT registration ceiling (CF art. 310 alin. (1), 395.000 lei) is measured on turnover
   actually achieved, not on an annualised rate — annualising it would fabricate a breach.
4. The estimate must **carry its basis explicitly** on the result, so no consumer has to guess which
   quantities it was computed on (same discipline as Phase 8's `TaxAmountBases`).
5. Wording must state the run-rate assumption. Never imply certainty.

## 3. Required design

### 3.1 Projection must be able to produce the four fiscal amounts

`computeTaxEstimate` consumes exactly four amounts (`YtdTotals` shape): `revenue`, `expenses`
(VAT-inclusive) and `revenueNet`, `expenseNet` (VAT-exclusive). `ProjectionV1.annualProjected` today
carries only the VAT-inclusive family (`revenue`, `expenses`, `net`).

Extend the projection so the VAT-exclusive family is annualised too, **without changing the meaning of
any existing field** (`FinancialChart` consumes `series` and `annualProjected`; `projection.test.ts`
pins 21 behaviours — keep them green). Follow the existing rules in that file:

- the run rate stays a `Decimal`; only the annual totals become whole `Bani` via `toBaniNearest`;
- `net` is **derived by subtraction**, never independently rounded;
- art. 66 does **not** apply to a projection (it is not a sum owed) — that comment stays true.

### 3.2 A named estimate-basis concept

Introduce one named concept in the domain (suggested: `TaxEstimateBasis` in `src/domain/projection.ts`
or a small new `src/domain/estimateBasis.ts` — your call, prefer the smaller file) that says which
amounts were used and why, e.g.

- `{ kind: 'annual-run-rate', asOfDate, method: 'run-rate-v1', elapsedMonths, ytd: YtdTotals, annual: <the four annual amounts> }`
- `{ kind: 'ytd-actual', asOfDate, ytd: YtdTotals, reason: <why annualisation was refused> }`

`computeTaxEstimate` accepts the basis (or the four amounts **plus** the basis descriptor — do not break
the engine's existing explicit-amount contract, which its whole numeric test suite depends on) and echoes
it on `TaxEstimateResult`. Add **one** provenance `CalculationLine` naming the basis so the persisted
snapshot records it; expect snapshot digests and any line-count assertions to move, and update them
deliberately, not by hand-tuning a number.

### 3.3 Annualise only when annualisation is sound

`selectProjectionV1` divides by `elapsedMonths` with `Math.max(1, months)`. For an `asOfDate` **after**
the fiscal year that denominator is > 12 and `× 12` would **understate** the year. So:

- `asOfDate` inside the fiscal year (`fiscalYear-01-01 … fiscalYear-12-31`) → annual run-rate basis.
- `asOfDate` outside the fiscal year, or `elapsedMonths <= 0` → **fall back to `ytd-actual`** and say why.
  Never silently annualise a degenerate period.

### 3.4 One helper, two call sites

`getTaxEstimate` (test-facing) and `useLatestTaxEstimate` (production) must build the basis through the
**same named function**. A duplicate is exactly the drift this repo has been fixing for ten phases.

### 3.5 UI — minimal, honest

`src/pages/Dashboard.tsx` only: the „Impozit estimat" `StatCard` hint and the „Estimare impozit" hero
paragraph must state that the figure is an **estimate for the full fiscal year extrapolated from the
current run rate as of <date>**, not a settled liability. Do not restructure the page, do not touch other
sections, do not add a chart. Keep the existing `—` behaviour for a refused estimate untouched
(**B-27/B-28 stay open — do not fix them here**).

## 4. What you must NOT do

- Do not touch expense deductibility. `tax.ts` keeps deducting the expense total it is given; the
  comment at `tax.ts` ("whether each individual expense is deductibilă … the app holds no per-expense
  nature data") stays, and **Worker 2 owns that**.
- Do not change the tax rules, the calculators, `roundArt66`, `Bani`, or any rate.
- Do not change `getTaxReserve` / `createTaxReserveState(null)` — **Worker 3 owns that**.
- Do not change `src/domain/thresholds.ts` or `ThresholdSection` — **Worker 4 owns that**.
- No broad refactor. No test-suite rewrite.

## 5. Tests (focused regression only)

- `src/domain/projection.test.ts`: the new VAT-exclusive annual family; `net` derived not rounded;
  existing 21 tests unchanged.
- New/extended data-layer tests proving **the estimate moves when the projection basis moves**:
  same records, different `asOfDate` → different annual estimate; and at `asOfDate = fiscalYear-12-31`
  the annual estimate equals the YTD-basis estimate (elapsed = 12).
- A test that an `asOfDate` outside the fiscal year yields `kind: 'ytd-actual'` and does not annualise.
- A test pinning that **threshold bases are still YTD**: on the seed, the VAT row still measures
  **7.700 lei excl-VAT** (Phase 8 invariant) whatever the tax estimate's basis is.
- Engine tests in `src/domain/tax.test.ts` must keep passing **unchanged** — they pass explicit amounts,
  which is exactly why they should not move. If one does move, you broke the engine contract.
- Wording test in `src/pages/Dashboard.test.tsx`.

## 6. Known pinned figures you will legitimately move

`e2e/dashboard.spec.ts` pins `3.105,00 RON` (tax card + hero), `1.035,00 RON`/month, the
„Rămâne de pus deoparte 3.105,00 RON în următoarele 3 luni." sentence and the insights total;
`e2e/settings.spec.ts` pins two computed totals; `src/pages/Dashboard.test.tsx` pins `46.570,00 RON`.
These are YTD-basis figures evaluated at the sandbox wall clock (Oct 2026). They **will** change.
Recompute each one from the engine and show the arithmetic in the comment next to it — never tune a
number until a test passes. Record every moved figure in your notes file.

## 7. Validation you must run (in this order)

1. `npx tsc --noEmit`
2. `npx vitest run src/domain/projection.test.ts src/domain/tax.test.ts src/data/dashboard.test.ts src/pages/Dashboard.test.tsx`
3. `npm run test` (full suite; baseline is **48 files / 760 tests**, all green)
4. `npm run build`
5. `npm run test:e2e` (baseline **36 passing**)

Use the runner's own exit status — never `| grep` (STATE.md records a commit made on a red run that way).

## 8. Docs you must write

- `docs/ai/notes/brief14_projection_tax_estimate_worker_notes.md` (exact name) — what changed, files changed, every
  moved pinned figure with its arithmetic, unresolved issues, and the exact implication for Worker 2
  (expense deductibility) and Worker 3 (reserve persistence).
- `docs/ai/STATE.md` — a new "Last sync" line at the top, and correct any register row your change makes
  false. Do not rewrite history.
- If a legal statement is involved, cite it as the repo already does (act + article + MO/consolidation
  date). **Do not invent law.** CF art. 118 alin. (3) and art. 148/170/174 are already cited in the code;
  reuse those citations, and make clear the run-rate is an **application policy**, not a statutory rule.

## 9. Report back

files changed · behavioural change · legal/source basis (if any) · tests run + counts · remaining risk ·
exact handoff for Worker 2.
