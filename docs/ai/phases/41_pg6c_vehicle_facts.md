# PG-6c — the vehicle facts, per car and per fiscal year (D-VEH-1, D-VEH-2, D-VEH-3)

The first task in the register that has to distinguish **two things that look identical on screen**. Until
now the application held one vehicle fact for a whole classification run, which meant two cars always got
the same answer — including when the law gives them different ones.

This phase adds a vehicle entity, moves the use fact from the run to the car, and stops there. It adds **no
new arithmetic rule and no new percentage**: art. 68 alin. (5) lit. j) is a *selection over cars expressed
through* the 50 % rule at alin. (7) lit. k), not a rate of its own.

**The premise this phase was briefed under was wrong, and it was corrected before any code was written.**
Brief 28 said a vehicle expense with no usage fact must be `incomplete`. Normele HG 1/2016 pct. 7 alin. (7)
puts the burden in one direction only — „**În vederea acordării deductibilității integrale** … se efectuează
pe baza documentelor justificative **și prin întocmirea foii de parcurs**". Full deductibility is what must
be evidenced; the 50 % cut is what the law itself applies when it isn't. So `unknown` **computes at 50 %**.
Refusing instead would have been the D-VEH-1 error, and it **understates** a liability.

## Baseline and result

| | before | after |
|---|---|---|
| `tsc --noEmit` | 0 | 0 |
| unit tests | 118 files / 1762 | **121 files / 1817** |
| `npm run build` | 0 | 0 |
| e2e | 102 (97 functional + 5 axe) | **108 (103 functional + 5 axe)** |
| copy-guard `ALLOW_LIST` | empty | **empty** (unchanged) |
| seed estimate | 311.200 bani | **311.200 bani** (unchanged) |
| PG-5C actuals-basis enforcement | green | **green** (unchanged) |
| data version | 14 | **15** |

## What was built

### The record — `src/data/types.ts`

`Vehicle` is an identity the person recognises plus a list of per-year declarations:

- `id`, `label` (their own name for the car — required, because every sentence the app writes about a car
  names this string), `plate?` (optional, only so two identical cars can be told apart; nothing reads it),
- `years: VehicleYearFacts[]` — **absence of a year entry means that year was never answered**. It is not
  read as "no", "not used" or "unknown".

`VehicleYearFacts` is declared in `src/domain/fiscal/deductibility.ts`, the layer that reads it, so the
stored shape and the classifier vocabulary are one spelling (the B-70 discipline: a vocabulary spelled twice
drifts). Its four fields — `use`, `exceptionCategory`, `usedByPerson`, `designatedForRunningCosts` — are all
optional and **nothing anywhere defaults them**.

`Expense` gained `vehicleId?: string`. That is the whole link: a running cost belongs to a car only because
the person said so.

Two things the entity deliberately does **not** carry: no depreciation data and no asset-register fields.
lit. k) excludes amortisation from the running-cost rules, and the art. 28 alin. (14) M1 ceiling is stated
per vehicle and belongs to 6e.

### The gate — `src/data/schema.ts`

`vehicleYearFactsSchema` and `vehicleSchema`, with `vehicles` optional on the persisted dataset and
`vehicleId` optional on the expense. The load gate is permissive about *absence* and strict about *values*:
the enums are the same `VEHICLE_USE_VALUES` / `VEHICLE_EXCEPTION_CATEGORIES` arrays the form renders, so a
stored value and a UI option cannot drift apart. `label` is a `nonEmptyString` — an unlabelled car cannot be
designated, refused or recognised in a refusal sentence.

Type-level assertions tie `z.output<typeof vehicleSchema>` to `Vehicle` and
`z.output<typeof vehicleYearFactsSchema>` to `VehicleYearFacts`, the same way the rest of the file does it.

### The chain step — `src/data/migration.ts`

`DATA_VERSION_VEHICLE_FACTS = 15`, `CURRENT_DATA_VERSION` moved to it, and one appended step named
`vehicle-facts`. `migrateVehicleFactsV15` **writes a version and touches nothing**: it does not create the
`vehicles` key, does not create a car, does not attribute an expense and does not designate anything.

The key staying **absent** rather than `[]` is not cosmetic. A payload written as `vehicles: []` would make
every `vehicle_related` expense in it *unattributable* — which moves money out of the deductible base. A
migration must not do that, so absence is preserved and the store normalises it.

### The store — `src/data/store.tsx`

`vehicles` on the store value, plus the smallest write surface that can state these facts: `addVehicle`
(refuses an empty label and reports that), `setVehicleYearFacts` (replaces one year's facts; an all-empty
year is **removed** rather than stored as a row of blanks, so „answered with nothing" and „never answered"
do not become two shapes of one claim), and `deleteVehicle`.

`deleteVehicle` deliberately leaves an expense pointing at the removed id. Silently clearing that link would
be the app repairing a record nobody asked it to repair; the resolver treats the stale id as unattributed
and says so instead.

### The vocabulary and the cap resolver — `src/domain/fiscal/deductibility.ts`

- `VehicleUseFact` (`exclusive` / `mixed` / `not_used` / `unknown`) and `VehicleExceptionCategory` (the five
  categories at alin. (7) lit. k) points 1–5) stay here, now exported as value arrays too.
- `VehicleYesNo = 'da' | 'nu'`. **Absence is not a member of this union**, and the difference matters: an
  unanswered car is counted as a *possible* candidate for the cap, an answered `nu` is not.
- `VehicleCapStatus` — `outside_cap`, `sole_candidate`, `designated`, `not_designated`,
  `designation_missing`, `designation_conflict` — with `isVehicleCapUnresolved` naming the three that leave
  a car's running costs unsettled. **There is no tie-breaker in this union.** No most-expensive, no
  first-registered, no highest-mileage, no CAEN, no category token.
- `vehicleCapStatuses(vehicles, fiscalYear)` resolves the whole register for one year. It reads
  `usedByPerson` and `designatedForRunningCosts` and **nothing else** — no `cui`, no price, no registration
  date. That is what "the cap is per person, not per register" means in code: two taxpayer-used cars inside
  one CUI are two candidates, because „aferent **fiecărei persoane**" is not a per-CUI allowance.
- `vehicleExpenseResolver(vehicles, fiscalYear)` returns a per-expense `resolveVehicleExpense` function, so
  a run binds the register once instead of re-walking the cars per record.
- `VehicleExpenseResolution` has three shapes: `no_vehicles` (the register records no car at all — the
  statutory default applies exactly as before PG-6c), `unattributed` (cars exist, this expense names none or
  names a deleted one — the vehicle treatment is refused), and `attributed` (this car's own facts decide).
- `oneCarUnresolvedFact` and the two quoted readings, `ONE_CAR_READING_PERSONAL_USE` and
  `ONE_CAR_READING_HALF_DEDUCTIBLE`, plus `VEHICLE_ATTRIBUTION_MISSING_FACT`.

### The classifier — the context stops carrying a vehicle fact

`ExpenseClassificationContext` no longer has `vehicleUse` or `vehicleExceptionCategory`. Those fields were
one value per classification run, which cannot say "this car is used by the taxpayer, that one is not" — the
only distinction lit. j) itself draws.

The vehicle answer now arrives as `VehicleConditionFacts`, a **separate parameter** resolved for that one
expense. `conditionMatches` reads it, and the classifier handles two cases before category matching:

1. `unattributed` → `status: 'undetermined'`, `rule: null`, with a sentence that says plainly this is the
   **app's** limit and not the law's answer — for a car whose exclusive use is not evidenced the law stays
   at 50 %.
2. `attributed` and `isVehicleCapUnresolved(...)` → `status: 'undetermined'`, carrying the existing
   `EXPENSE_VEHICLE_MIXED_USE_2026` rule and both readings verbatim.

`no_vehicles` falls through to the ordinary rules on purpose. With no car recorded there is no per-car fact
to bypass and no cap to enforce, so alin. (7) lit. k)'s 50 % default is the answer — not a gap.

**No fourth rule was added.** `src/domain/fiscal/deductibility2026.ts` is untouched: its three vehicle
rules and its pre-existing `ONE_CAR_SELECTION_CONFLICT` note (from PG-6b) are what the new code drives.

### The threading — `src/domain/estimateBasis.ts`

One call site. `selectDeductibleExpenses` binds `vehicleExpenseResolver(data.vehicles ?? [], fiscalYear)`
once and passes `vehicle: resolveVehicle(e.vehicleId)` into `classifyExpenseDeductibility`. Nothing in
`estimateBasis.ts` reads a car list, compares a fact or picks a car — threading, not mechanism. The
`?? []` is what keeps a profile that never declared a car on the statutory default instead of making its
costs unattributable.

### The surfaces — `src/pages/Settings.tsx` and `src/pages/Expenses.tsx`

**Settings**, on the fiscal tab: a vehicle block present for every profile, listing the cars with a label
field, an optional plate, the four facts for the profile's declared fiscal year, and a status line under
each car rendered from `vehicleCapStatuses` — the same resolver the classifier runs, so the screen cannot
describe a different car-situation from the one the calculation acted on. Every select starts empty.
`data-vehicle-block`, `data-vehicle-row`, `data-vehicle-status`, `data-vehicle-empty`,
`data-vehicle-used-by-person`, `data-vehicle-use`, `data-vehicle-exception`, `data-vehicle-designation`,
`data-vehicle-use-default`.

**Expenses**: the attribution select (`data-vehicle-select`) appears **only once the register declares a
car**; with no cars there is nothing to attribute a cost to and the form is unchanged. The row names its car
(`data-expense-vehicle`). A new per-reason banner (`data-vehicle-unresolved`, with
`data-vehicle-unresolved-detail`) collects the vehicle costs the app could not decide and prints the
assembler's own sentence — which is where both readings become readable by a person rather than only by a
test. This reuses the existing `capBlocked` / `foreignBlocked` pattern rather than inventing a second one.

### The copy — `src/ui/copy/vehicles.ts`

A new module, exported from `src/ui/copy/index.ts`, with `block`, `facts`, `status` and `expense` sections.
It quotes lit. j) („cel mult un singur autoturism aferent fiecărei persoane"), states that the cap is per
person, states that leased and rented-in cars are inside the rules because alin. (7) lit. k) says
„proprietate sau în folosință", states the *foaie de parcurs* contents, and says in as many places as needed
that **the choice is the person's, not the app's**. The copy module never names a car and never mentions
depreciation — a test asserts that last point on the rendered block.

## Acceptance evidence

1. **Entity with per-car, per-year facts, no defaults, no backfill; an existing profile behaves as today.**
   `src/domain/vehicleFacts.test.ts` (a vehicle with no year entry has no facts, and a fact from another
   year is not borrowed; the seed declares no vehicle, and a vehicle cost added to that unchanged profile
   still computes at 50 % with no exclusion and no `undetermined` count), `src/data/store.migration.chain.test.tsx`
   (the `vehicle-facts` step leaves the key absent, attributes nothing and is idempotent),
   `src/data/store.save.test.tsx` (the `vehicles` key is in the serialized key list).
2. **`unknown` deducts at 50 % and is not `incomplete`, with the note visible.** Same file, D-VEH-1 block:
   the record is in the base at 50 %, `counts.undetermined` is 0, the line cites
   `EXPENSE_VEHICLE_MIXED_USE_2026` with `cap.baseArticle` = art. 68 alin. (7) lit. k). The note is asserted
   in `src/pages/Settings.vehicles.test.tsx` (`data-vehicle-use-default`) and in
   `e2e/vehicle-facts.spec.ts`.
3. **`unknown` and `mixed` are distinct stored facts that both compute at 50 %.** Asserted directly: equal
   money, different stored values, and the two values are not equal to each other.
4. **A car not personally used by the taxpayer is outside the cap and still gets 100 % / 50 % by the
   exclusive-use test.** `src/domain/vehicleFacts.test.ts` (two cars answered `nu`: one at 50 % mixed, one
   at 100 % exclusive, nothing excluded; an outside-cap car is not displaced by a designated one;
   `vehicleCapStatuses` returns `outside_cap`), `src/pages/Expenses.vehicles.test.tsx`, and
   `e2e/vehicle-facts.spec.ts` (both rows carry no out-of-estimate note, the hero stays `complete`).
5. **Two taxpayer-used cars: the designated one carries the allowance, the other is unsettled with both
   readings quoted.** The refusal detail is asserted to contain `CITEȘTE A`, the alin. (7) lit. a) quote
   („sumele sau bunurile utilizate de contribuabil pentru uzul personal"), `CITEȘTE B`, the Normele quote
   („conform art. 68 alin. (4) și (5)") and the litera itself — at the assembler level, at the estimate
   level, on the register banner, and in the browser. A double designation is `designation_conflict`, which
   the app does not arbitrate.
6. **No selection rule exists anywhere.** A grep for any picking heuristic returns only negations — the
   comments and copy that say no such rule exists. The behavioural form of the same guarantee is a test:
   with two candidates and no designation, **neither** car's costs compute; if any heuristic had picked one,
   exactly one record would have.
7. **The global context value is no longer the mechanism.** `vehicleUse` appears nowhere in `src/` or `e2e/`
   except in comments explaining what replaced it. An unattributed vehicle cost while cars are declared is
   refused, and a link to a deleted car is refused rather than repaired.
8. **No depreciation touched.** The only occurrences of art. 28 / amortisation in the diff are comments
   stating that they belong to 6e; a test asserts the rendered vehicle block contains no depreciation
   wording at all.
9. **The cap is keyed to the person, not the CUI.** `vehicleCapStatuses` takes only the cars and the year;
   the test asserts two taxpayer-used cars in one register are two candidates.
10. **Gates.** `tsc` 0 · 121 files / 1817 unit tests · `build` 0 · 108 e2e including the 5 axe tests ·
    copy-guard `ALLOW_LIST` still `[]` · seed estimate still 311.200 bani · PG-5C enforcement green.

## Tests that moved, old → new

- `e2e/settings.spec.ts` — the B-26 round-trip assertion re-pinned from version 14 to 15, with the running
  commentary extended. The test's subject is untouched: one notice, `original` still the verbatim 674.504,
  `converted` still 67450 bani. The `vehicle-facts` step is the third consecutive step of the kind that
  opens a collection and touches no value.
- Fixtures that hand-build an `AppData` literal gained `vehicles: []` (`src/data/dashboard.test.ts`,
  `src/domain/aggregation.test.ts`, `src/domain/completeness.test.ts`, `src/domain/derived.test.ts`,
  `src/domain/estimateBasis.test.ts`, `src/domain/insights.test.ts`, `src/domain/projection.test.ts`,
  `src/pages/Dashboard.test.tsx`, `src/pages/Dashboard.empty.test.tsx`,
  `src/pages/Dashboard.scenarios.test.tsx`, `src/data/store.fxRates.test.tsx`,
  `src/data/store.taxReserve.test.tsx`). This is the honest direction: the *test* declares an empty car
  list, the *product* never does.
- `src/data/schema.test.ts` — the new key in the persisted-shape assertion.
- `src/data/migration.currency.test.ts` and `src/data/store.migration.chain.test.tsx` — every `stepsApplied`
  expectation extended with `vehicle-facts`.
- `src/domain/fiscal/deductibility.test.ts` — the pre-existing vehicle cases were rewritten to the per-car
  shape; the one that asserted a global `vehicleUse` fact no longer describes the product.

## Findings

1. **The contested premise was a live understatement, not a wording problem.** Before this phase an
   unevidenced vehicle expense could be pushed out of the base by a missing fact. That is the direction the
   law does not go in, and it makes the displayed liability too small. The correction is a default, not a
   relaxation: 50 % is what alin. (7) lit. k) says.
2. **A single per-run fact could not express the one distinction the texts do support.** Two identical cars
   can sit on opposite sides of lit. j) purely because of *who drives them*. That is why an entity, and not
   another field, was the minimum change.
3. **Absence had to be protected in three places, not one.** The migration must leave the `vehicles` key
   absent (writing `[]` would make existing costs unattributable and move money out of the base); the store
   normalises absence to an empty list only in memory; and the resolver distinguishes `no_vehicles` from
   `unattributed` so a profile that never declared a car keeps the statutory default.
4. **A stray unary `+` in the concatenation of the two readings turned reading A into `NaN`** in the middle
   of a Romanian sentence. It was caught by the acceptance test that asserts the detail contains both
   readings — the kind of defect that a "does it render" check would have waved through, because the string
   was still a string.
5. **The two readings had nowhere to live on screen.** The exclusion detail existed in the domain, but the
   coverage panel groups by reason and shows a label and a count, so a person could not read what was
   unresolved. The register banner is what makes acceptance 5 observable rather than merely asserted.
6. **`designation_conflict` is a state the brief did not name.** Two cars marked designated is a legal
   impossibility under „cel mult un singur autoturism", and the app cannot arbitrate it, so it is reported
   rather than resolved.

## Boundary notes

- `src/domain/fiscal/deductibility2026.ts` was **not** modified. The brief allowed it; it turned out not to
  need it, and its existing `ONE_CAR_SELECTION_CONFLICT` note already records the same research finding.
- `src/pages/Onboarding.tsx` was **not** modified. Asking about a car during onboarding would front-load a
  legal assertion before the person has a reason to make one; the facts are declared where the register is
  edited.
- No change to `domain/tax.ts`, `domain/fiscal/calculators.ts`, `domain/fiscal/package2026.ts`,
  `domain/scenarios.ts`, or to any existing rule value or citation. No new fiscal constant was introduced,
  so the "no constant without a citation" rule was not exercised.
- `e2e/settings.spec.ts` is in the diff only for the version re-pin.

## What 6e inherits

The vehicle entity gives the fixed-asset phase three things it would otherwise have to invent:

- **A per-vehicle identity that is stable across years** — `Vehicle.id`, with a person-chosen `label` and an
  optional `plate`. An asset register keyed to anything else would not match the running-cost records.
- **A per-year fact container** — `years: VehicleYearFacts[]`, where a missing year entry means "never
  answered". 6e can add its own per-year facts to the same record without touching the vehicle semantics.
- **The boundary itself, stated in code and copy**: lit. k) **excludes amortisation** from the running-cost
  rules, and nothing in this phase computes, stores or displays depreciation.

What it does **not** provide, and what 6e must supply:

- **No acquisition data at all** — no purchase date, no cost basis, no useful life, no asset category, no
  register entry. `Vehicle` deliberately carries none of it.
- **No per-vehicle ceiling arithmetic.** `research/40` §4 records the asymmetry 6e has to handle:
  depreciation under the Normele for art. 28 alin. (14) is expressly **per vehicle** („pentru fiecare"),
  1.500 lei/lună for an M1, with **no one-car limit**. So several M1 cars can each be depreciated while only
  one carries deductible running costs. Nothing in PG-6c should be read across to that ceiling, and the
  `VehicleCapStatus` vocabulary must not be reused for it — it is a selection status, not a cap amount.
- **No link from a car to an asset-register row.** If 6e wants one, it has to add it; `vehicleId` on an
  expense is not it.

## The VAT-in-the-50 %-base question — recorded, not solved

`research/40` §6 records that the base for the 50 % haircut **includes non-deductible VAT** — but the
provision that says so is **Normele pct. 16 alin. (3), which is the corporate Normele for art. 25**, not the
Normele for art. 68. It was **not imported into the PFA path**. PG-6c implements what the existing VAT
handling already does: the deductible base is the expense's `valoareFaraTva`, and the cap is applied to that
record in integer bani, floored. No amount in the seed moved, and no VAT figure was re-based.

This needs its own brief with its own citation question. It should not be inherited by the next phase as an
assumption, and it should not be "fixed" as a side effect of a later task.

## Handoff

- **6e (fixed assets, B-31)** owns depreciation and the art. 28 alin. (14) M1 ceiling, per vehicle.
- **6f (deductible input VAT, B-30)** is the natural place to brief the VAT-in-the-base question above,
  because it is a VAT-base question and not a vehicle question.
- If a later phase wants vehicle facts during onboarding, it should say why the person is being asked before
  they have a register to attribute anything to.
- The register banner for unresolved vehicle costs groups by `reason === 'undetermined'` and
  `category === 'vehicle_related'`. If a future phase adds another vehicle-shaped refusal, it will appear in
  that banner; if it adds a non-vehicle refusal, it will not.
