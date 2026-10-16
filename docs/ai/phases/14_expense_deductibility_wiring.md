# Phase 14 — TASK 2b: expense deductibility is recorded, migrated and wired into the estimate

**Date:** 2026-10-09
**Brief:** `docs/ai/briefs/16_task2b_deductibility_wiring.md`
**Depends on:** TASK 2a (`1583d9e`, `docs/ai/phases/13_expense_deductibility_ruleset.md`)
**Legal input:** `docs/ai/research/21_expense_deductibility_framework_2026.md` and the rule package
`src/domain/fiscal/deductibility2026.ts`. No new legal research was done in this task.

---

## 1. What changed

`tax.ts:144` — `const cheltuieliDeductibile = vatExempt ? expenses : expensesNet` — is unchanged, and
that is the point. What changed is **what `expensesNet` means when it arrives**.

A new assembler, `selectDeductibleExpenses` in `src/domain/estimateBasis.ts`, runs the 2026
deductibility rules over the expense records that fall in the estimate's period and returns *the subset
the law lets through*, in the shape `selectYtd` returns. `tax.ts` therefore receives an expense total
that is already a legal conclusion, and the engine's own output records which rules produced it.

**The insertion point is not a call site.** `selectProjectionV1` (`projection.ts:100`) re-runs
`selectYtd(data, asOfDate)` on the `AppData` it is handed — it does not consume the `ytd` argument the
caller passes. Filtering the `ytd` argument at either consumer would have produced a projected
`expensesNet` built from *all* expenses while `basis.actual.expensesNet` reported the filtered one: two
figures in the same result, silently disagreeing. So the subset is applied to the **`AppData` fed to
both selectors**, inside `selectEstimateOperands`, which is now the only route to the estimate.

Both consumers call it:

| Consumer | Route |
|---|---|
| `getTaxEstimate` (`data/dashboard.ts:157`) | `selectEstimateOperands` → `computeTaxEstimate(operands.amounts, …)` |
| `useDerivedData` live path (`data/derived.ts:101`) | `operands.amounts` → `selectProjectionV1(operands.data, …)` |

`selectProjectionV1`'s signature is untouched, so `estimateBasis.test.ts` and `projection.test.ts`
still exercise it directly.

## 2. The record, the schema, the migration

* `Expense.category?: ExpenseCategory` — **absent**, not `null`, when no category has been chosen.
  `null` would fail `zod.enum` on the *next* load and quarantine a payload that is perfectly legal.
* `expenseSchema.category = z.enum(EXPENSE_CATEGORIES).optional()` — declared in **both** the TS type
  and the zod schema. zod strips undeclared keys, so a field declared only in TS would be erased on
  the next load and the user's classification would vanish. `schema.ts:458` (`_checks` drift guard)
  compares the two key sets and would have caught the omission.
* The vocabulary is the **rule tokens**, not a UI vocabulary: `EXPENSE_CATEGORIES` is
  `deductibility.ts`'s `ExpenseCategory`, re-exported from `data/types.ts`. A UI label layer is TASK 7.
* `DATA_VERSION_EXPENSE_CATEGORY = 6`; chain step `expense-category` (5→6). **It backfills nothing.**
  Every pre-v6 expense is a real invoice and a category could be guessed from the supplier name — but
  a category decides whether the amount enters the deductible base, so guessing would manufacture the
  user's tax position. Absence is carried forward; an uncategorised expense classifies as
  `undetermined`. The step also preserves a category already on the payload byte-for-byte (pinned).
* `quarantine.ts` is untouched: it stamps `version: CURRENT_DATA_VERSION` on the rejected copy, which
  is correct — the copy is a v6-shaped payload with one bad record, and re-running the chain over it
  would be a second mutation.
* **No snapshot hash migration, deliberately.** `snapshot.ts:109-113` digests the *aggregate*
  (`revenues` / `expenses` in `inputSnapshot`), not the record arrays, so an expense-only field moves
  no stored hash. The `inputHash` mismatch that would otherwise have appeared is a **stored-by-an-
  older-build** case, not a schema change. Pinned by a new test that strips `category` from every seed
  expense and asserts the stored digest still matches.

## 3. The subset rule

| Classifier result | Reaches the engine? | Counted as |
|---|---|---|
| `deductible` | yes, whole amount | `entered` |
| `capped`, base `expense_itself` (the 50 % vehicle cap, art. 68 alin. (7) lit. k)) | yes, **per record**, floored to the ban | `entered` |
| `capped`, any other base | **no** | `capUnresolved` |
| `non_deductible` | no | `nonDeductible` |
| `undetermined` | no | `undetermined` |
| `no_expense_engine` | **the estimate refuses** | — |

* A cap is a **ceiling**: `Math.floor`, never `roundBani` — rounding a cap up would deduct more than
  the law allows.
* The classification date is the **payment date** (`expense.paid ?? expense.date`), per art. 68 alin.
  (4) lit. b) ("se datorează pentru venitul realizat în anul fiscal, la momentul plății"). It is
  load-bearing, not cosmetic: the OUG 8/2026 letters `g^1)`/`g^2)` bind only for contributions paid
  from 2026-03-01, so a PEPP contribution paid 2026-01-15 classifies as `undetermined`.
* The period and status filter is `selectYtd`'s own (`inFiscalYear` + `status !== 'respinsa'`), so the
  unclassified count and the expense total are measured over the same population.
* **No cap base is computed here.** `art68_alin6_base` (protocol: gross minus deductible expenses
  *other than protocol and private scholarships*) is self-referential — the base must exclude the very
  category being capped — and `annual_eur_per_person` / `annual_per_vehicle` need a year aggregate and
  a EUR rate that do not exist in this app. Those categories are excluded and counted for **TASK 2c**.
* Every excluded record carries `ruleId` + `sourceArticle` + a `detail` naming the missing fact, and
  every line in the deductible set carries the rule that justified it. Nothing is silently dropped.

## 4. B-29 — art. 68^3 forfetar: the refusal channel exists, the fact does not

`selectEstimateOperands` accepts an optional `activityFamily: 'cazare'`. When it is supplied,
`expenseEngineRefusal` finds the `EXPENSE_ENGINE_CAZARE_2026` rule and returns a
`TaxEstimateResult` with `status: 'review_required'` naming the rule and art. 68^3, instead of a
number. `estimateBasisLabel` / `estimateFigureLabel` then say *„Estimare impozit (calculată nu s-a
făcut)"* and the basis records `kind: 'refused'` — it does not pretend the operands were zero.

**The honest limit.** The app holds **no activity-family fact**. `profile.caen` is stored and read
nowhere in `src/`, and research 21 §7(c) lists the *scope* of art. 68^3 as undecided (which CAEN
codes, which activity classification selects it). Inventing a CAEN→cazare mapping would be inventing
law, so **no caller supplies the fact today and B-29 remains OPEN.** What TASK 2b removes is the
possibility of computing a wrong cazare number silently: the channel is there, and wiring it is a
decision about the fact, not about the code.

## 5. Figures that moved, and why

Seed expenses: e1 CloudHost 120,00 lei (`postal_and_telecom`, deductibilă — Normele pct. 7 alin. (5)
lit. j)), e2 Carrefour bon fiscal 85,50 lei (`personal_or_family_use`, nedeductibilă expres — CF art.
68 alin. (7) lit. a)), e3 Office Supplies 340,00 lei (`business_space_upkeep`, excluded by
`status: 'respinsa'` as before). **e2 is the only record whose treatment changed.**

| Surface | Before | After |
|---|---|---|
| YTD deductible expenses | 205,50 lei | **120,00 lei** |
| YTD `net-income` base (VNA) | 7.494,50 | **7.580,00** |
| CASS deductibilă (year-end) | 749,00 | **758,00** |
| Venit net anual impozabil | 6.745,50 | **6.822,00** |
| Impozit pe venit (year-end) | 675,00 | **682,00** |
| Estimate total @ 2026-12-31 | 3.105,00 | **3.112,00** |
| Projected operands @ 2026-10-31 (×1,2) | 246,60 | **144,00** |
| Projected VNA @ 2026-10-31 | 8.993,40 | **9.096,00** |
| CASS deductibilă @ 2026-10-31 | 899,00 | **910,00** |
| Impozit @ 2026-10-31 | 809,00 | **819,00** |
| Estimate total @ 2026-10-31 (e2e hero, cockpit, „Rămâne") | 3.239,00 | **3.249,00** |
| Monthly reserve @ 2026-10-31 | 1.079,67 | **1.083,00** |
| Estimate total @ 2026-09-30 | 3.329,00 | **3.340,00** |

The direction is **up**: removing a non-deductible expense raises net income, and the art. 66 rounding
steps happen to round up at the new values (909,60 → 910,00 and 818,60 → 819,00, both 60 bani > 50).
CASS owed stays 2.430 lei — the 6 SM floor of art. 174 alin. (6) does not depend on expenses.

`e2e/settings.spec.ts`'s `EXPENSES` fixture gained an explicit `category: 'business_space_upkeep'`.
Left uncategorised it would have dropped out of the base, pushed the projected VNA from 24.000 to
36.000 lei past the 6 SM floor, and the two B-13 tests below it would have computed the **same**
number — deleting the art. 174 alin. (6) difference that spec exists to pin, without failing. The
migrated-data case (a payload with **no** category) is pinned separately, in unit tests: it survives
intact, deducts nothing, and still computes.

`e2e/settings.spec.ts:405` re-pinned from `saved.version === 5` to `6`: the payload enters at v4, the
chain runs `money-bani` (4→5) and `expense-category` (5→6), and the save effect stamps the version
this build writes.

## 6. Files

| File | Change |
|---|---|
| `src/domain/fiscal/deductibility.ts` | **untouched** (TASK 2a's) |
| `src/domain/estimateBasis.ts` | the assembler: `selectDeductibleExpenses`, `selectEstimateOperands`, `estimateBasisLabel` / `estimateFigureLabel`, `expenseEngineRefusal` |
| `src/data/dashboard.ts` | `getTaxEstimate` routes through the assembler |
| `src/data/derived.ts` | the live projection routes through the same assembler |
| `src/data/types.ts` | `Expense.category?`, `ExpenseCategory` re-export |
| `src/data/schema.ts` | `expenseSchema.category`, `EXPENSE_CATEGORIES` import |
| `src/data/migration.ts` | `DATA_VERSION_EXPENSE_CATEGORY = 6`, `migrateExpenseCategoryV5ToV6`, chain entry |
| `src/data/seed.ts` | three seed expenses categorised |
| `src/pages/Expenses.tsx` | one category `<select>` + the unclassified count with one action |
| tests | `estimateBasis.deductibility.test.ts` (new, 16 tests), `dashboard.test.ts`, `schema.test.ts`, `store.migration.chain.test.tsx`, `e2e/dashboard.spec.ts`, `e2e/settings.spec.ts` |

The UI is deliberately minimal: a `<select>` whose only entry is the rule token plus its source
article (no label layer exists yet), and a count of unclassified expenses in the existing table
caption with one action that selects the first one. No new card, no new design-system layer.

## 7. Validation (measured, 2026-10-09)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run test` | **51 files / 832 tests passed** (baseline 50 / 810) |
| `npm run build` | exit 0 (chunk 793 kB — was 757 kB; the existing >500 kB warning, unchanged in kind) |
| `npm run test:e2e` | **36 passed** (baseline 36) |

No assertion was deleted, no matcher loosened, no timeout widened. Every changed expectation is an
exact figure replaced by an exact figure, re-derived by hand from the seed before the suite was run.

## 8. Still open after this task

* **TASK 2c** — the cap bases. `art68_alin6_base`, `annual_eur_per_person`, `annual_per_vehicle` are
  counted as `capUnresolved` and excluded. The protocol base is self-referential by statute and needs
  a two-pass design; the euro caps need a rate policy that does not exist.
* **B-30** — the amount entering the assembler is still `valoareFaraTva` of the record. The VAT half
  (art. 298 alin. (1) 50 % vehicle VAT cap, art. 300 pro-rata, art. 297 alin. (7)) is not modelled, so
  for a VAT-registered profile the deductible amount is still understated. The per-expense 50 % cap is
  applied to `tva` on the record, but that is the *expense* cap, not the input-VAT deduction rule.
* **B-29** — the art. 68^3 refusal is reachable only once an activity-family fact exists. `caen` is
  still read nowhere; research 21 §7(c) leaves the scope undecided.
* **B-31** — capital purchases: `equipment_and_software` is categorised deductible-as-expense because
  the app has no asset model. art. 68 alin. (7) lit. h) says a depreciable good is never a direct
  expense. Unchanged by this task.
* One-vehicle-per-taxpayer limit for the 50 % cap: not modelled (no vehicle register).
* Category labels in Romanian: TASK 7. The UI currently shows the rule token, which is honest but not
  polished.

## 9. Exact implication for TASK 3 (tax reserve)

The reserve reads `tax.output.total` in **two** places, and both now read a total built from the
deductible subset:

* `getTaxReserve` — `src/data/dashboard.ts:199`, `computeTaxReserve(tax, …)` at `:205`
  (`estimatedTaxLiability` is set at `src/domain/taxReserve.ts:133`)
* `buildSnapshot` — `src/data/dashboard.ts:298`, `computeTaxReserve(tax, createTaxReserveState(null), …)`

The quantity that now enters `estimateBasis.ts` is `EstimateAmounts.expensesNet` = Σ `valoareFaraTva`
of the confirmed-deductible subset, with the per-expense 50 % cap already applied to each record. For
the seed at the e2e clock (2026-10-31) that is **14.400 bani = 144,00 lei** (120,00 lei YTD × 1,2),
against **24.660 bani = 246,60 lei** before this task. TASK 3 must not re-derive it: call
`selectEstimateOperands` and pass `operands.amounts` / `operands.data` to whichever selector it needs.
