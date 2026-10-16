# PG-6a — the scenario-support registry

**Brief:** `docs/ai/briefs/38_pg6a_scenario_framework.md` · **Phase:** PG-6, part 6a of six
**Baseline measured before any change (at `350518a`):** `tsc` 0 · 100 files / 1558 unit tests · `build` 0 · e2e 72 · copy-guard `ALLOW_LIST` empty · seed completeness **7/9**, weighted coverage **100 %**

---

## What this phase is, and what it deliberately is not

PG-6 has six parts. This one is the framework only: **one registry, one evaluation point, and one
existing refusal routed through it.** No detector for the activity family (6b), vehicle and
documentation facts (6c), other income (6d), fixed assets (6e), deductible input VAT (6f) or the Form 300
setup path (6g) was written here, and none of those defects — B-29, B-39, B-41, B-31, B-30, the B-35
residual — is closed by this commit.

The one thing that had to be true is that the framework carries a case the app already runs today, so
that 6b…6g inherit a channel rather than a scaffold.

---

## The mechanism

`src/domain/scenarios.ts` is new and holds the whole mechanism:

- `ScenarioSupport` — `{ id, effect, message, fixTarget, detect }`, exactly the shape the brief prescribes.
  `message` is a `ScenarioMessageKey`, a key into `src/ui/copy/scenarios.ts`; the registry carries no
  sentence.
- `ScenarioEffect = 'incomplete' | 'refuse'`.
- `ScenarioFixTarget = { page, tab? }` and `scenarioFixHref`, which builds the `/<page>#!/<tab>` form
  `parseRoute` in `src/App.tsx` reads. It is a typed route rather than a free string, and
  `src/domain/scenarios.routes.test.ts` pushes each registered target through `parseRoute` and asserts the
  page and tab come back — a `fixTarget` that goes nowhere is the failure the brief names, and a test that
  only checks the string would not catch it.
- `ScenarioFacts = { data, classifierRefusal }` — everything a detector may look at.
- `SCENARIO_SUPPORT` — the registry. Order is precedence.
- `evaluateScenarios` — **the one evaluation point.** Its only production call site is
  `selectEstimateOperands` in `src/domain/estimateBasis.ts`.
- `scenarioRefusal` / `scenarioGaps` — the two projections of an outcome list.

Two entries are registered:

| id | effect | what it reads |
|---|---|---|
| `no-expense-engine` | `refuse` | the `RefusedExpense` the expense classifier already returned |
| `regime-not-computable` | `refuse` | `profile.regime`, through `regimeRefusalReason` in `src/domain/regimes.ts` |

`estimateRefusalReason` moved from `src/domain/estimateBasis.ts` to `src/domain/scenarios.ts`. It is the
refusal's sentence, and the channel that renders it now owns it.

---

## The special case that was deleted

`selectEstimateOperands` used to carry this branch directly after the deductible set was assembled:

```ts
if (deductible.refusal) {
  const reason = estimateRefusalReason(deductible.refusal);
  return { kind: 'refused', basis: { kind: 'refused', …, reason }, result: { status: 'review_required', reason, lines: [] }, … };
}
```

It is gone. In its place:

```ts
const scenarios = evaluateScenarios({ data: ledger.data, classifierRefusal: deductible.refusal ?? null });
const refusal = scenarioRefusal(scenarios);
if (refusal !== null) { … }
```

The decision is unchanged — a classifier with no expense engine must not reach `computeTaxEstimate` — and
`EstimateOperands` still has its `run` / `refused` union, so the guard that keeps a refused result out of
the engine is untouched. What changed is who makes the decision. `RefusedEstimateBasis` now also carries
`scenario: ScenarioOutcome`, so the id, the copy key and the fix route travel with the refusal instead of
being re-derived at the surface.

`EstimateOperands` gained `scenarios: ScenarioOutcome[]` on both branches, and `TaxEstimateWithBasis`
gained an optional `scenarios`, filled by the third parameter of `attachEstimateBasis` at both call sites
(`useLatestTaxEstimate` in `src/data/derived.ts` and `getTaxEstimate` in `src/data/dashboard.ts`). It is
optional because a result that never went through the assembler — a hand-built fixture, a stored snapshot
— genuinely has no scenario answer rather than an empty one.

---

## One channel, not two

This is the landmine the brief calls the most likely way to pass every test and fail the task, so the
rule applied here is: **the registry feeds PG-1's channel; it never stands beside it.**

An outcome whose effect is `incomplete` is projected by `scenarioCoverageGaps` in
`src/domain/estimateBasis.ts` onto `CoverageReason.fact_missing` — the reason PG-1 declared and produced
nothing for — and appended to the same `coverage` array `buildDashboardData` already assembles from
`selectEstimateCoverage` and `coverageFromUnconverted`. Nothing else was added to the surface: the hero
badge, the rows under `EstimateCoverageRows`, the attention items and the weighted percentage all keep
reading the one list, so a later part that registers a detector gets all four without writing a surface.

Two fields carry the difference between a missing record and a missing fact, and both exist for that
reason: `EstimateCoverageGap.kind` gained `'profile'`, and `amount` became `Bani | null`. A fact the
register never held took no sum out of the figure, and writing `0` beside it would print a lei amount for
a number nobody recorded. Consequences, both small:

- `groupByReason` in `src/components/dashboard/EstimateCoverage.tsx` suppresses a group total when any row
  in it has no amount, instead of counting that row as zero.
- `amountCoverage` in `src/domain/completeness.ts` now sums with a `flatMap` that skips nulls. Its
  `eligible.has(g.recordId)` test already excludes a scenario row from the weighted denominator, because
  the row's `recordId` is `scenario:<id>` and no register row answers to it.

`src/data/dashboard.scenarios.test.ts` pins both halves: a scenario gap moves the estimate state from
`complete` to `incomplete` and moves the weighted percentage and the recorded denominator by nothing.

---

## The estimate states, and which are reachable now

`estimateStateOf` in `src/data/dashboard.ts` gained one test, before the status test:

```ts
if (estimateBasisOf(tax)?.kind === 'refused') return 'refused';
if (tax.status === 'review_required') return 'review_required';
```

| situation | `tax.status` | `basis.kind` | `estimateState` |
|---|---|---|---|
| nothing computed yet | — (`tax === null`) | — | `unavailable` |
| the engine ran and withheld a conclusion | `review_required` | `recorded-actuals` | `review_required` |
| a scenario stopped the calculation | `review_required` | `refused` | `refused` |
| a figure exists, a record is outside it | `computed` | `recorded-actuals` | `incomplete` |
| a figure covers everything | `computed` | `recorded-actuals` | `complete` |

Acceptance 6, stated as the brief asks:

- **`refused` is now reachable.** It is produced by the registry and by nothing else. The route that is
  reachable from stored data today is `regime-not-computable` — a payload whose `profile.regime` is
  `impozit_pe_cit` or `norma_venit`. The `no-expense-engine` entry is registered and unit-proven, but it
  cannot fire from a payload yet, because no caller supplies `activityFamily` to the classifier; that is
  B-29, and 6b supplies the fact.
- **`closed_final` is still declared and still produced by nobody.** Grep for it in non-test `src/` returns
  only the union member in `src/data/dashboard.ts` and the badge word in `src/ui/copy/attention.ts`. It was
  not triggered to make a test pass.
- **`fact_missing` has a producer (`scenarioCoverageGaps`) and no live source**, because no registered
  scenario has effect `incomplete` yet. The seam is tested with a detector built inside
  `src/domain/scenarios.test.ts` that is deliberately **not** in `SCENARIO_SUPPORT` — a demo scenario in
  the registry is what the brief rules out.

`src/data/dashboard.scenarios.test.ts` also pins that a hand-built `review_required` result with no basis
stays `review_required` rather than being guessed into a refusal, and that a refusal outranks a coverage
gap in the badge while the coverage rows stay on the page.

---

## How a refusal renders

`src/components/dashboard/ScenarioRefusal.tsx` is new. It renders the language layer's framing sentence
(`copy.scenarios.messages[message]`), the rule's own sentence verbatim, and one link built by
`scenarioFixHref`. It renders no figure.

`src/pages/Dashboard.tsx` reads the outcome off `data.tax.basis.scenario` — it does not run the registry —
and for a refusal: the badge is `refused` (`badge-danger`, word `Nu putem calcula`), the state paragraph
is the new `copy.estimateState.refused` rather than `reviewRequired`, the hero value and the cockpit cell
both carry `copy.ui.noValue` (`—`), the label slot says `Nu putem calcula` instead of a basis label, and
the date beside it becomes `copy.scenarios.registerReadAsOf` because a refused estimate measured nothing.

**The rule's sentence is rendered once.** The first cut put it in the hero block, in the arithmetic
disclosure (`estimateBasisExplanation`) and in the chart note at once, and the B-14 unit tests failed on a
duplicate-element error before anything else did. `estimateBasisExplanation`'s refused branch no longer
appends `basis.reason`, and `src/components/FinancialChart.tsx` gained a `refused` branch that points at
the estimate section (`copy.chart.taxNoteRefused`) instead of quoting the paragraph again. The same
paragraph, three times on one screen, is the defect `src/ui/copy/attention.ts` already names for the hero.

`estimateBasisLabel` and `estimateFigureLabel` now return `Nu putem calcula` for a refused basis, so no
surface can label a refusal with a word that implies a figure exists.

---

## Boundary deviation, recorded

`src/components/FinancialChart.tsx` is **not** on the brief's may-touch list. It was changed anyway, in
one branch: the third chart note stopped hard-coding `data-estimate-state="review_required"` and reads
`dashboard.estimateState`, and a `refused` branch was added. Leaving it would have put two answers to one
question on the same screen — hero `refused`, chart `review_required` — which is the B-70 defect class this
phase exists to prevent, and the brief's own Scout A flagged this file as the second status branch. The
`computed` branch and the `unavailable` branch are untouched, and
`src/components/FinancialChart.test.tsx` is untouched and green.

---

## Scout deviation, recorded

Scout A and Scout B were dispatched sequentially and both reported. Every path and identifier in both
reports was grepped against the tree before acting. Scout A's report named `estimateStateStateBadgeClass`,
which does not exist — the real identifier is `estimateStateBadgeClass` — and referred to `tax-hero-value`
as an identifier when it is a CSS class in `src/styles.css`; both were transcription slips in a quoted
snippet, every other name resolved, and the reports were used. No scout was re-dispatched.

---

## Tests that moved, before → after

No test was deleted, skipped or re-baselined. Counts moved **100 files / 1558 tests → 105 files / 1589
tests**, and **e2e 72 → 77**.

1. `src/domain/estimateBasis.deductibility.test.ts`, the art. 68^3 cazare test.
   - Before: `estimateFigureLabel(operands.basis)` expected `'Estimare impozit (calculată nu s-a făcut)'`.
    After: `'Nu putem calcula'`. The old label described a figure that had merely not been calculated;
    the new one is the word the badge uses, so a label and a state cannot disagree.
   - `estimateRefusalReason` is now imported from `./scenarios` instead of `./estimateBasis`, because the
     function moved with the channel that renders it.
   - Added: `basis.scenario.id === 'no-expense-engine'`, `effect === 'refuse'`,
     `fixTarget === { page: 'settings', tab: 'fiscal' }`, and `operands.scenarios` containing the id.

2. `e2e/dashboard.spec.ts`, the B-14 describe.
   - Before: the cited paragraph was asserted on `.chart-tax-note`.
     After: on `[data-scenario-refusal="regime-not-computable"]`, with the same four assertions
     (`nu poate aparține unui PFA`, `art. 13 alin. (1)`, `art. 120`, `abrogată`) plus a new one that the
     chart carries `data-estimate-state="refused"` and does **not** repeat the paragraph. The regime case
     is now a scenario refusal, so the reason is rendered beside the control that fixes it rather than
     under the graph. Substance — the verbatim citations reach the screen — is preserved.

3. `src/pages/Dashboard.test.tsx` — untouched. Its two B-14 tests failed once during the change, on
   `Found multiple elements with the text: /nu poate aparține unui PFA/`, which is the duplicate-rendering
   defect surfacing rather than an assertion that needed moving; they pass unmodified after the
   single-render fix.

New files: `src/domain/scenarios.test.ts` (13), `src/domain/scenarios.routes.test.ts` (3),
`src/data/dashboard.scenarios.test.ts` (7), `src/components/dashboard/ScenarioRefusal.test.tsx` (3),
`src/pages/Dashboard.scenarios.test.tsx` (3), `e2e/scenario-refusal.spec.ts` (5).
`src/components/dashboard/EstimateCoverage.test.tsx` gained 2 cases for a `profile` gap with no amount.

---

## Completeness figures, before and after

Unchanged, and that is the finding rather than an omission. Measured on the seed profile at 31.10.2026
before the change and after it: **7/9 checks, weighted coverage 100 %, `recordedBani` 790550,
`includedBani` 790550, estimate state `complete`.** Those two amounts are `Bani` — integer lei, not a
formatted sum — because `amountCoverage` in `src/domain/completeness.ts` divides bani by bani. No
registered scenario has effect `incomplete`, so no `fact_missing` row exists in any live profile yet, and
the weighted denominator is untouched by the `flatMap` change because it already excluded rows whose
`recordId` is not in the register.

---

## What 6b–6g must route through

A later part adds **one entry to `SCENARIO_SUPPORT`** and nothing else. Concretely:

1. `detect(facts)` is a total predicate over `facts.data` and `facts.classifierRefusal`. It must not throw
   on an empty register, a profile with no start date, or a payload with no profile object —
   `src/domain/scenarios.test.ts` runs the registry against exactly those, and a new entry is covered by
   that loop automatically. It must not infer a fact: no CAEN-to-activity-family guess, no assumed asset
   register, no assumed vehicle use.
2. Choose the effect honestly. A case the law does not let the app compute is `refuse` and replaces the
   number. A fact the user can supply is `incomplete`, keeps the number, and becomes a `fact_missing`
   coverage row through `scenarioCoverageGaps` — do not add a surface, a banner or a second warning list.
3. Add the sentence to `copy.scenarios.messages`. The `satisfies Record<ScenarioMessageKey, string>` makes
   a missing one a compile error; add the key to `ScenarioMessageKey` in the same change.
4. Give a `fixTarget` that resolves. If the control does not exist yet, the control is part of the part —
   `src/domain/scenarios.routes.test.ts` follows every registered target through `parseRoute`.
5. Do not add a detector for a fact the app does not store. 6b is the case in point: `no-expense-engine`
   is registered and cannot fire, because nothing supplies `activityFamily`. Supplying that fact is 6b's
   job; making the scenario fire by guessing would manufacture the fact whose absence it reports.

---

## Validation

`npx tsc --noEmit` 0 · `npx vitest run` **105 files / 1589 tests, all passing** · `npm run build` 0 ·
`npx playwright test` **77 passing** (73 functional + 4 axe, axe routes unchanged) · copy-guard
`ALLOW_LIST` still empty · wall-clock guard passes.

PG-5C's enforcement is intact and green: the `@ts-expect-error` test that a `ForecastAmounts` is not
assignable to an `EstimateAmounts`, and the assertion that `amountsForEstimate.toString()` contains
neither `forecast` nor `projected`, are untouched in `src/domain/estimateBasis.test.ts`.

## Handed forward

- **B-29 stays open.** The `no-expense-engine` scenario is registered but unreachable from stored data
  until a caller supplies `activityFamily`. That is 6b, and it is now a fact-supplying change, not a
  mechanism change.
- **`closed_final` remains declared and untriggered.**
- Nothing date-shaped arose in this phase; nothing goes to PG-2's line of work.
