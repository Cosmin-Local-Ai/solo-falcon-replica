# PG-1 — estimate coverage (brief 32)

Branch state: this phase was implemented on top of `73753df` (brief 32 itself) and the Phase 11 + PG-3
baseline at `05ab925`.

## The gate

> The hero may say „Calculat" only when every recorded record is either included or deliberately,
> visibly excluded.

Before this phase it said „Calculat" whenever the engine produced a number. The number was correct as
far as it went: the assembler had already decided which expenses reached the engine and had recorded
what it kept out. What was missing was not the decision — it was the **surfacing**. The exclusions lived
in `src/domain/estimateBasis.ts` and reached one page (`src/pages/Expenses.tsx`, three banners); the
hero, the estimate status and the completeness figure knew nothing about them.

## What already existed, and what this phase did not re-invent

`ExcludedReason` and `ExcludedExpenseRecord` were already in `src/domain/estimateBasis.ts`, with four
members (`undetermined`, `non_deductible`, `cap_unresolved`, `foreign_currency`), and
`DeductibleExpenseSet.excluded` already carried the reason plus the rule behind it. Phase 10c had
already added the ledger disclosure — `getLedgerDisclosure` in `src/data/dashboard.ts`, whose
`unconverted` list names every foreign record the lei totals leave out.

So this phase added **no second exclusion account**. `CoverageReason` is a projection of the two lists
that already existed, and the projection is total and mechanical:

| produced by | becomes |
|---|---|
| `ExcludedReason 'undetermined'` with no category | `unclassified` |
| `ExcludedReason 'undetermined'` with a category | `undetermined` |
| `ExcludedReason 'non_deductible'` for `depreciable_asset_purchase` | `asset_not_modelled` |
| `ExcludedReason 'non_deductible'` otherwise | `non_deductible` |
| `ExcludedReason 'cap_unresolved'` | `cap_unresolved` |
| `UnconvertedRecord` from the ledger disclosure | `missing_fx_rate` |

The mapping lives in one function, `coverageReasonForExclusion`, next to the vocabulary it maps from.

## One record, one reason, one surface

`foreign_currency` was the overlap the brief warned about: a foreign-currency expense appears in **both**
`DeductibleExpenseSet.excluded` and the ledger disclosure's `unconverted`. `selectEstimateCoverage`
therefore **drops** the `foreign_currency` entries and `coverageFromUnconverted` produces every
`missing_fx_rate` gap from the disclosure alone. The disclosure is the wider list (revenues included) and
it is the pass the money surfaces already read, so the €5.000 revenue — which the assembler never
classifies — reaches the hero at all. `src/data/dashboard.coverage.test.ts` pins that the FX gaps and
`DashboardData.ledger.unconverted` carry the same ids, and that no record id appears twice in the
coverage list.

`rejected` and `pending` are declared in `CoverageReason` but **produced by nobody**. A record whose own
status says it is unsettled is already surfaced by the attention model — `recordAttentionItems` in
`src/data/attention.ts`, with its own row badge and its own deep link. Listing it again under a second
vocabulary is the defect this section exists to avoid, not the feature.

`fact_missing` is declared and unproduced; PG-6 owns it. `refused` and `closed_final` are declared in the
status union and unproduced; PG-4 and PG-6 own their triggers.

## The status union

`TaxEstimateState` in `src/data/dashboard.ts` was `'computed' | 'review_required' | 'unavailable'`. It is
now:

```
'complete' | 'incomplete' | 'review_required' | 'refused' | 'closed_final' | 'unavailable'
```

`estimateStateOf` derives it from the estimate result **and** the coverage list:

- `tax === null` → `unavailable` — TASK 8's distinction is untouched. A missing calculation and a
  refused one are still different values, and no sentinel came back.
- `tax.status === 'review_required'` → `review_required`, outranking any coverage gap. The figure was
  withheld, so "what is missing from the figure" is not the sentence to show.
- otherwise → `incomplete` when a gap reason passes `isGapReason`, `complete` when none does.

`src/domain/tax.ts` was **not** touched. The engine's two-member `TaxEstimateResult` union stays as it
is: it is the calculator's answer, and widening it would have reached `FinancialChart.tsx`,
`taxReserve.ts`, `insights.ts` and `thresholds.ts`, none of which is in this phase's boundary. The
wider union is the status the **surfaces** read, which is what the gate asks for.

`complete` is not the same word as `computed`, and that is the whole point: the old badge claimed the
figure was finished because the figure existed.

## What counts as a gap, and what does not

`GAP_REASONS` in `src/domain/estimateBasis.ts` is the subset that makes an estimate incomplete:
`unclassified`, `undetermined`, `asset_not_modelled`, `missing_fx_rate`, `cap_unresolved`,
`fact_missing`.

`non_deductible` is deliberately **not** in it. A fine, a donation or a loan principal is out of the
deductible base because CF art. 68 alin. (7) says so — the app settled that record. Holding a profile at
„Estimare incompletă" forever because it once bought something the law will not let it deduct would be
a false claim, not a warning. The record still carries a row note in the register
(`nu intră în estimare: nu este deductibilă prin lege`) so a reader cannot infer it entered the figure;
it just does not make the estimate incomplete. Both directions are pinned, in
`src/data/dashboard.coverage.test.ts` and in `e2e/estimate-coverage.spec.ts`.

`depreciable_asset_purchase` is the exception inside `non_deductible`: the rule is right that the
purchase is not a direct expense, but the deductibility route is depreciation, and the app holds no
asset register (defect B-31). That is a missing capability, not a legal answer, so it is reported as
`asset_not_modelled` and it does make the estimate incomplete.

## Where the coverage is assembled, and why not on the estimate result

The brief asked for coverage on the estimate result. It is assembled in `buildDashboardData` instead,
through `selectEstimateCoverage` and `coverageFromUnconverted`, and the reason is a boundary: the live
estimate is built by `useLatestTaxEstimate` in `src/data/derived.ts`, which is outside this phase's
may-touch list. Attaching a `coverage` field to `TaxEstimateWithBasis` would have meant editing that
call site, and a field that one of the two estimate paths fills and the other does not is a field that
silently reads as "no gaps".

`selectEstimateCoverage` calls `selectDeductibleExpenses` — the same selector the estimate runs, over the
same normalised ledger — so the reasons cannot disagree with the total the engine used. It is a repeat
of one pass, not a second implementation of one; `src/pages/Expenses.tsx` already calls that selector
directly for its banners. **No new currency pass was added anywhere**: the FX half comes from
`getLedgerDisclosure`, which `buildDashboardData` already computed for `DashboardData.ledger`, and
`src/pages/Revenues.tsx` reads the same function rather than filtering its own register for foreign
amounts.

## Completeness: the circular check is gone

`taxEstimateCheck` is deleted from `src/domain/completeness.ts`, along with its label
`'Estimare impozit'` in `CHECK_LABELS` in `src/ui/copy/dashboard.ts`. It reported completeness from
whether a `TaxCalculationSnapshot` with status `computed` existed — i.e. whether the estimate **ran** —
and counted running as evidence the estimate was **complete**. The same profile that dropped a
two-thousand-lei expense out of the deductible base still had a computed snapshot, so the check was
satisfied by exactly the failure it claimed to catch.

`assessCompleteness` now takes the coverage gaps and an as-of date, and returns an `AmountCoverage`
alongside the checks: `recordedBani`, `includedBani`, `percent`.

- The denominator is the amounts the estimate **could** have consumed: records whose own status is
  `inregistrata` and whose money date passes `inPeriod` (the same predicate `selectYtd` uses, with
  `expenseFiscalDate` for expenses). A rejected document or a record from another fiscal year does not
  sit in a denominator nothing can ever satisfy.
- The numerator subtracts only gaps that pass `isGapReason` **and** whose record id is in that
  population — a gap for a record the denominator never counted is not subtracted from it.
- `percent` is **floored**, never rounded up: an app that cannot measure the last half point may claim
  the lower one.
- `percent` is `null` when nothing is recorded. A share of nothing is not 0 %, and
  `CompletenessSection` says „Nicio sumă înregistrată de ponderat." instead of printing a zero.

**The caveat, stated rather than hidden.** A record with no recorded BNR rate has no lei amount — that
is the finding. It is nevertheless counted in the denominator, in the minor units it is written in,
because leaving it out is precisely what made the old figure read as complete while a real sum was
missing from it. `CompletenessSection` carries that sentence next to the number
(`completeness.amountNote`), and the hero's coverage rows print every amount with its own currency and
refuse to sum a group whose records are written in different units.

### The figures, before and after

At the pinned instant (`fixedInstant()` — 2026-10-31), on the seed profile:

| | before | after |
|---|---|---|
| checks | 9 | 8 |
| satisfied | 7 | 7 |
| read as a ratio | 7/9 = 77,8 % | 7/8 = 87,5 % |
| the removed check | `taxEstimate`, unsatisfied: „nu există instantanee de taxe" | — |
| weighted amount coverage | did not exist | recorded 790 550 bani, included 790 550 bani → **100 %** |

The satisfied count did not move; the total did. That is the landmine the brief predicted, and it moved
in the direction that makes the old figure look generous: the seed was being marked down for a fact
("no persisted snapshot") that says nothing about coverage.

The five evidence rows, added one at a time to the same seed:

| record added | status | recorded / included (bani) | percent |
|---|---|---|---|
| — (seed) | `complete` | 790 550 / 790 550 | 100 |
| uncategorised expense, 2.000,00 lei | `incomplete` | 990 550 / 790 550 | 79 |
| `depreciable_asset_purchase`, 2.000,00 lei | `incomplete` | 990 550 / 790 550 | 79 |
| `home_office_shared_cost`, 2.000,00 lei | `incomplete` | 990 550 / 790 550 | 79 |
| €5.000,00 expense, no rate | `incomplete` | 1 290 550 / 790 550 | 61 |
| €5.000,00 revenue, no rate | `incomplete` | 1 290 550 / 790 550 | 61 |

The last two rows are the currency caveat made visible: 500 000 is the record's amount in EUR minor
units, and there is no lei number to put in its place until a rate is recorded. Recording the daily
reference rate for each money date returns both records to the lei totals, the estimate to `complete`,
and the figure to 100 — that round trip is asserted in `src/data/dashboard.coverage.test.ts`.

## The surfaces

- **Hero** (`src/pages/Dashboard.tsx`): the badge is driven by `estimateState` alone;
  `estimateStateBadgeClass` gives `complete` the success green, `incomplete` and `review_required` the
  warning, `refused` the danger, `closed_final` and `unavailable` neutral. The sentence under the figure
  counts the records left out (`estimateState.incompleteOne` / `incompleteMany`).
- **Coverage rows** (`src/components/dashboard/EstimateCoverage.tsx`, new): one row per **reason group**,
  never one per record — nine uncategorised invoices are one thing to fix. Each row carries the reason
  label, the count, the group amount with its unit, and a link to the first record of that group.
- **Deep links**: `estimateFixTarget` in `src/domain/estimateBasis.ts` builds
  `/<page>#!/registered?f=<id>`, the same form `recordTarget` in `src/data/attention.ts` uses and the
  form `parseRoute` in `src/App.tsx` resolves. `src/pages/Dashboard.coverage.test.tsx` asserts the link
  through `parseRoute` rather than by string match, and `e2e/estimate-coverage.spec.ts` clicks it and
  asserts the register lands on the row (`row-focus`) with the reason on it.
- **Registers** (`src/pages/Expenses.tsx`, `src/pages/Revenues.tsx`): a new `OutOfEstimateNote` in the
  status cell of each row, reading `nu intră în estimare: <motiv>` with the shared label from
  `dashboard.estimate.coverage.reasonLabels`. The expense side reads the exclusion list the page already
  computes; the revenue side reads `getLedgerDisclosure`.
- **Completeness card** (`src/components/dashboard/CompletenessSection.tsx`): the weighted line above the
  fact checks, with the caveat sentence beside it.

## Decisions

1. **`domain/tax.ts` untouched.** The engine's `computed | review_required` union is the calculator's
   answer; the five-member union is the surfaced status. Widening the engine's union would have forced
   edits in files outside this phase's boundary.
2. **`data/derived.ts` untouched, so coverage is assembled in `buildDashboardData`.** See above.
3. **FX gaps come only from the ledger disclosure.** The assembler's `foreign_currency` exclusions are
   dropped from the coverage list rather than re-reported.
4. **`non_deductible` is a reason, not a gap.** It gets a row note; it does not move the badge or the
   percentage.
5. **`rejected` / `pending` declared, not produced.** The attention model already owns those records.
6. **The weighted denominator is eligibility-scoped** (`inregistrata` + `inPeriod`), so the figure can
   reach 100 and the round trip can close.
7. **Amounts carry their currency** on `EstimateCoverageGap`. An amount rendered without its unit is a
   number invented twice over, and the €5.000 case is exactly the record whose unit the app does not
   have.

## Findings, not acted on

- **B-68 survey of the other pages.** `src/pages/Expenses.tsx` and `src/pages/Revenues.tsx` gate their
  tables on a status-tab-filtered record array, not on an aggregate, so a record excluded from the money
  totals still satisfies the gate and appears in the table. `src/pages/Documents.tsx` has no empty-state
  gate over its RJIP register. **No page other than the dashboard carries the B-68 shape.**
- **`src/pages/Documents.tsx` does run its own currency filter.** The RJIP `rows` builder skips records
  where `!isRon(...)` and a separate `foreignCount` memo counts the ones it skipped, instead of reading
  the ledger disclosure. It is not a second *implementation* of the conversion rule — it is the same
  `isRon` test — but it is a second traversal of the registers for the same question, and it is the one
  place in the app that answers "what is foreign and unconvertible?" without going through
  `getLedgerDisclosure`. It is outside this phase's may-touch list; it should be reconciled with the
  disclosure in a later phase.
- **`src/pages/Expenses.tsx` still calls `selectDeductibleExpenses` and `selectEstimateOperands`
  separately** from the dashboard's own run. Same functions, same inputs, so they cannot disagree — but
  the page recomputes what the dashboard computed. Worth one shared seam in a later phase.

## Handoff

- **PG-2 (payment and collection dates, B-46, B-66, `onDateSource`)** — nothing in this phase is
  date-shaped beyond the eligibility test already owned by `inPeriod`. The coverage denominator reads
  `expenseFiscalDate` (`paid ?? date`) for expenses and `date` for revenues; if PG-2 changes which date
  an amount is keyed to, `amountCoverage` in `src/domain/completeness.ts` follows it automatically
  because it calls `inPeriod` rather than comparing dates itself.
- **PG-4** owns the `refused` trigger; **PG-6** owns `closed_final` and `fact_missing`. The words for all
  three already exist in `estimateState.badges` and `CoverageReason`, so the surfaces are exhaustive over
  the union before the triggers arrive — a new state is a compile error in the copy map, not a raw token
  on screen.
- The `cap_unresolved` reason is now both a hero row and a banner in `src/pages/Expenses.tsx`
  (`capBlocked`). They read the same list, but the two surfaces should be reconciled when PG-6 touches
  ceilings.

## Validation

- `npx tsc --noEmit` — 0 errors.
- `npx vitest run` — **90 files / 1 453 tests, all passing** (baseline 85 / 1 409; +5 files, +44 tests).
- `npm run build` — 0 errors.
- `npx playwright test` — **54 passing** (51 functional + 3 axe; baseline 49 = 46 + 3).
- `src/ui/copy/copy.guard.test.ts` passes with `ALLOW_LIST` still empty.

Tests written for this phase: `src/data/dashboard.coverage.test.ts` (the five evidence rows, each run to
the round trip), `src/components/dashboard/EstimateCoverage.test.tsx`,
`src/pages/Dashboard.coverage.test.tsx`, `src/pages/Expenses.coverage.test.tsx`,
`src/pages/Revenues.coverage.test.tsx`, `e2e/estimate-coverage.spec.ts`, plus the re-pinned assertions
in `src/domain/completeness.test.ts`, `src/domain/insights.test.ts`, `src/data/dashboard.test.ts`,
`src/components/dashboard/CompletenessSection.test.tsx` and `e2e/dashboard.spec.ts`.

Every re-pinned assertion was changed because the behaviour it pinned was the defect, not to keep the
suite green: `7 din 9 verificări` → `7 din 8`, the `Estimare impozit` completeness row and its
„nu există instantanee de taxe" detail removed, the action list 6 → 5, the `Completitudine` badge count
2 → 1, and the `prioritate medie` band 4 → 3.
