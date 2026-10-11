# PG-6h-1 — the art. 68^3 arithmetic: net is 70 % of gross, and one net does three different jobs

Brief: `docs/ai/briefs/40_pg6h1_art68x3_arithmetic.md`. Contract inherited from: `docs/ai/phases/36_pg6b_activity_family.md` (the activity-family fact) and `docs/ai/phases/35_pg6a_scenario_framework.md` (the scenario contract).
Legal grounding read before writing: `docs/ai/research/38_art68x3_cass_and_occupancy_order.md` §1 and §3 — the art. 68^3 text read in full against the Codul fiscal consolidation at 08.08.2026, plus Legea nr. 239/2025 art. XII pct. 5 and pct. 19.

Written from this task's own diff. No line numbers are cited.

---

## What this task was

6h-1 is the arithmetic only. It adds the determination method the law supplies for `prestarea de servicii de cazare` from FY2026 — a flat 30 % expense ratio and a 10 % rate on the resulting net — and it makes the contribution consequences of that net land in the right places. It does **not** add the Settings or onboarding questions that would settle what the gross contains (that is 6h-2, D-COM-1), and it does not touch the occupancy sheet (6h-3, D-OCC-1). No form field and no guest table was added.

The regime was decided in `docs/ai/USER_DECISIONS.md` as D-CAZ-1: supported, not permanently refused. Before this task the app could only *say* it had no method for the activity — `EXPENSE_ENGINE_CAZARE_2026` refused the expense engine and the `no-expense-engine` scenario carried that sentence to the hero. Now it has the method, and the honest refusal for an FY2026 cazare register has moved to a different question.

Two things this task is mostly about, because both are easy to get wrong and each was named as a landmine in the brief:

- **The 30 % is an expense ratio, not a tax rate.** `venitul net = venitul brut − 30 % × venitul brut = 70 % × venitul brut` (alin. (2)). Reading 30 as a rate on gross is a 10× error in the wrong direction.
- **CAS and CASS read the same net for different jobs.** For CAS the net feeds only the 12/24-SM **threshold test** (art. 148 alin. (3)); the base stays the chosen 12 or 24 SM (art. 148 alin. (2)). For CASS the net **is the base** (art. 170 alin. (1), which Legea 239/2025 pct. 19 amended to name art. 68^3 expressly), floored at 6 SM by art. 174 alin. (6) and capped at 72 SM. One shared "68^3 base" variable handed to both calculators is the defect.

---

## The worked example

Every figure below was derived by hand from the two statutory lines and from the FY2026 minimum-wage anchor: 4.050 lei on 1 ianuarie (HG 1.506/2024), fixed for art. 148 / 151 / 170 / 174 by CF art. 135^1 alin. (3). **Not** the 4.325 lei of HG 146/2026 from 1 July — that value does not re-anchor the annual bases, and `src/domain/fiscal/package2026.ts` already encoded this correctly, so nothing here changed it. 6 SM = 24.300 · 12 SM = 48.600 · 24 SM = 97.200 · 72 SM = 291.600.

A cazare taxpayer with 100.000 lei of receipts and no other income:

| Quantity | Derivation | Figure |
|---|---|---|
| venitul brut | încasări, alin. (2) „încasate în cursul anului fiscal" | 100.000 |
| cheltuieli forfetare | 30 % × 100.000 — alin. (2) | 30.000 |
| venitul net | 70 % × 100.000 | 70.000 |
| impozitul | 10 % × 70.000, „impozitul fiind final" — alin. (6) | 7.000 |
| CAS | net 70.000 is ≥ 12 SM and < 24 SM → base = 48.600 (venitul ales), × 25 % — art. 148 alin. (2) lit. a) | 12.150 |
| CASS | base = net = 70.000, × 10 % — art. 170 alin. (1) | 7.000 |
| **total** | | **26.150** |

The effective burden is 7 % of gross, and it stays 7 %: „impozitul fiind final" means CAS and CASS are **not** deducted from this base, unlike art. 123 alin. (1) read with art. 118 alin. (2).

Pinned by `src/domain/art68x3.arithmetic.test.ts`, which also asserts the wrong answers are not produced: the tax is neither 30.000 (30 % read as a rate on gross) nor 10.000 (10 % read on gross), and the CAS figure is not 17.500 (25 % of the net).

---

## The rule: `ACCOMMODATION_68X3_2026`

One new entry in `PFA_2026_SYSTEM_REAL_PACKAGE` in `src/domain/fiscal/package2026.ts`, under a new `taxRegime` string `'accommodation-flat-ratio'`, added to `FiscalRegime` in `src/domain/fiscal/rules.ts`.

**Why a fresh regime string rather than a reuse.** `src/domain/tax.ts` resolves the three money rules with `applicable.find(r => r.taxRegime === ...)`. A second rule sharing `'income-tax'` would have been silently shadowed by `INCOME_TAX_2026` — and art. 68^3 alin. (6) *does* produce an income tax, so this was the tempting reuse. Sharing `'cas'` or `'cass'` would have shadowed the Titlul V rules the contributions are actually computed under. The 68^3 rule supplies neither a contribution rule nor a rate for another regime; it supplies the **method**, and `tax.ts` reads it as a fourth, separate lookup.

Parameters, each with its own citation:

| `id` | value | basis |
|---|---|---|
| `expense_ratio` | 30 (percent) | alin. (2) — an expense ratio, stated as such in the parameter description |
| `tax_rate` | 10 (percent) | alin. (6), with „impozitul fiind final" |
| `fx_basis` | `last_banking_day_before_collection` | alin. (4) — not an annual average, not the year-end rate |
| `filing_deadline` | `2027-05-25` | alin. (9) with art. 122 alin. (3) — **not** art. 121 |
| `payment_deadline` | `2027-05-25` | alin. (10) with art. 122 alin. (3) — same date, **not** art. 121 |
| `gross_scope_open_question` | text | B-80: the two readings of alin. (3), neither chosen |
| `eligibility_open_question` | text | alin. (1): the tourism-law gate, outside the fiscal code |

**No SM multiple lives on this rule.** The 6/12/24/72-SM figures it touches are already year-scoped on `CAS_2026` and `CASS_2026` (`taxYear: 2026`). Hard-coding 24.300 or 291.600 here would put a 2026 minimum wage inside a rule that outlives it, and the FY2027 value is not published.

**Deliberately not encoded**, and recorded as such in the rule's own comment: alin. (3) (B-80), alin. (1) (eligibility), alin. (12) with art. 83 alin. (4) and art. 85 alin. (1)-(2) (who lands on this method — 6h-2's question), and alin. (8) (the occupancy sheet, OPANAF 381/2026 — 6h-3, under D-OCC-1).

### Release identity

`PFA_2026_RELEASE` in `src/domain/fiscal/release2026.ts` moved `version` **1 → 2**, `createdAt` to the real instant of this change, `ruleIds` gained `ACCOMMODATION_68X3_2026`, and `evidence` gained the Portal Legislativ consolidation the art. 68^3 text was read out of. `contentHash` is computed by `ruleSetDigest`, so it moved on its own.

This is the governance in `docs/ai/phases/20_rule_release_immutability.md` §6 working, not a number being bumped for appearance: a version that stayed at 1 while the rule set grew would be the registry's own check failing. **No existing rule was edited** — `CAS_2026`, `CASS_2026`, `INCOME_TAX_2026` and the 39 deductibility rules keep their parameters, citations and `version: 1` byte-for-byte.

---

## The calculator: `calc-accommodation-flat-ratio`

Registered in `calculatorRegistry` in `src/domain/fiscal/calculators.ts`. Two multiplications and nothing else. It takes `gross` and returns `{ value: tax, determinedNet: net, breakdown }`.

Three decisions in it worth recording:

- **`gross` is a new `CalculatorInput` field, not `base`.** In `calcCas` and `calcCass`, `base` means the *net* the contributions are measured on. One field meaning gross in one calculator and net in another is exactly how the 68^3 net would turn into the CAS base, which art. 148 alin. (2) does not allow.
- **`determinedNet` is a new `CalculatorResult` field.** The net is the rule's own intermediate legal quantity, and the composition layer needs it for two different jobs. Leaving the caller to re-subtract a ratio it does not hold is how a figure and the sentence beside it start disagreeing — the same reason `exactBani` in `src/domain/tax.ts` reports rather than repairs.
- **Rounding stays on the house boundary.** art. 66 alin. (1) rounds the sums that are *due*, so the tax is rounded once, by `roundArt66`. The net is a *base*: if `70 % × gross` is not a whole number of bani, the calculator returns `reviewRequired` instead of inventing a rounding rule for a base. `src/domain/art68x3.arithmetic.test.ts` pins this with a gross of one ban.

The calculator does not decide what the gross contains, and does not prorate anything (alin. (5) makes a fraction-of-year amount the annual amount; art. 151 alin. (2) keeps the SM figures whole).

---

## Composition in `tax.ts` — where the net goes

`computeTaxEstimate` gained one optional operand, `flatRatioGross`, and one block that calls the registered calculator. **There is no `0.7` and no `0.1` anywhere in `src/domain/tax.ts`** — the percentages are read from the rule. `src/domain/art68x3.arithmetic.test.ts` proves it by patching `expense_ratio` to 20 and `tax_rate` to 11 and watching both figures move.

The operand is a **gross beside `revenues`, not inside it**. art. 68^3 alin. (2) does not deduct the register's recorded expenses at all; feeding these receipts through the sistem-real expense path would apply art. 68 alin. (4) to a taxpayer art. 68 alin. (1) expressly excepts.

The composition computes one quantity, `cumulatedNet`, and hands it to the two contribution calculators, which use it differently:

- `calcCas` receives it as the amount that **selects the statutory tier**. It never becomes the base — that is encoded in `calcCas` already, and it is what art. 148 alin. (2) requires.
- `calcCass` receives it as **the base**, floored at 6 SM and capped at 72 SM. The 6/12/24-SM ladder of art. 170 alin. (2)-(4) is expressly limited to art. 155 alin. (1) lit. c)-h) and does not reach this income, which is lit. b) via art. 67 alin. (1^1). So the floor for a sole-68^3 taxpayer is 6 SM.
- The 68^3 tax is emitted as its own line, `Impozit art. 68^3 (10 %, impozitul fiind final)`, and is **not** routed through the art. 118 alin. (2) deduction composition. alin. (11) ring-fences the *income tax* only.

With a single sistem-real source, `cumulatedNet` is `net` itself — sign included, because `calcCass` reads a negative as the art. 174 alin. (2) zero/loss case. Only once a second source exists does it become a sum, and then the loss term is what drops out of the art. 170 alin. (1) base.

`TaxAmountBases` gained `venitulNetCumulatPentruContributii`, written **only** when a second lit. b) source was actually in play, by one helper `contributionBases` so the two return paths cannot report different quantities. `buildThresholdBases` in `src/data/dashboard.ts` reads it for the `net-income` threshold row. A threshold row that tests a different amount than the engine measured on is the B-71 defect class — the percentage and the figure disagreeing about the same record.

### The mixed register, derived by hand

sistem real 130.000 − 100.000 = 30.000 net, plus 68^3 gross 100.000 → net 70.000. Cumulated lit. b) amount = 100.000.

| Quantity | Derivation | Figure |
|---|---|---|
| CAS | 100.000 ≥ 24 SM → base 97.200 × 25 % | 24.300 |
| CASS | base = 100.000 (cumulated) × 10 % — art. 170 alin. (1) | 10.000 |
| CAS deductibilă | 30.000 ÷ 100.000 × 24.300 — art. 118 alin. (2^2) | 7.290 |
| CASS deductibilă | 30.000 ÷ 100.000 × 10.000 — art. 118 alin. (2^3) | 3.000 |
| venit net anual impozabil | 30.000 − 10.290 | 19.710 |
| impozit sistem real | 10 % × 19.710 — already whole bani, so art. 66 alin. (1) has nothing to round | 1.971 |
| impozit art. 68^3 | 10 % × 70.000, ring-fenced | 7.000 |
| **total** | | **43.271** |

Without cumulation the CASS base would be the sistem-real net alone and the figure would be 3.000 — an understatement art. 170 alin. (1) names art. 68^3 expressly to prevent. Both directions are pinned, one test each.

---

## Threading — `estimateBasis.ts` decides once, the call sites only hand it over

`EstimateAmounts` gained optional `flatRatioGross`. `ForecastAmounts` has no such field, so PG-5C's enforcement is untouched: a 68^3 gross cannot come from a projection, for the same `asOfDate` gap that keeps every other projected amount out of the engine.

Three new selectors in `src/domain/estimateBasis.ts`:

- `selectIncomeDeterminationMethod` — a **selection**, not a classification the app performs. Its two inputs are the declared `profile.activityFamily` (asked and stored by PG-6b, never inferred from a CAEN code) and whether the rule set selected for this fiscal year actually carries the art. 68^3 method rule, read through `selectApplicableRules` in `src/domain/fiscal/select.ts`. The second condition is the year-scoping guard.
- `selectAccommodationGross` — the gross, measured on the **same** `normaliseStoredLedger` pass and the same record set as every other operand. It reuses the Phase 10c ledger walk (`src/domain/fx/ledger.ts`, basis `payment_date_daily` with the labelled carry-forward from the last published banking day) rather than writing a second FX walk; a second walk is the B-70 defect class and would drift from the first the moment either changed. The VAT rule is the sistem-real one for the same reason — OMFP 3254/2017 art. 4 alin. (3): TVA colectată nu reprezintă venit.
- `accommodationOpenQuestions` — lifts the two open questions out of the rule verbatim, so the refusal quotes the rule rather than paraphrasing it.

`withFlatRatioGross` attaches the field at the assembler's `kind: 'run'` returns rather than at each call site, because two call sites attaching it independently is how one of them forgets. The two engine call sites — `getTaxEstimate` in `src/data/dashboard.ts` and `useLatestTaxEstimate` in `src/data/derived.ts` — are threading only, identical to each other by construction.

---

## The scenario entry — one new, and one re-premised

`SCENARIO_SUPPORT` in `src/domain/scenarios.ts` gained exactly one entry, `accommodation-gross-undetermined` (`effect: 'refuse'`, `fixTarget: { page: 'settings', tab: 'fiscal' }`).

`no-expense-engine` was **not deleted — it was scoped**. Its detector now returns null when `facts.flatRatioMethodAvailable === true`. The classifier's refusal is still produced and still reaches the expense register: what changed is that it no longer stops the estimate, because art. 68 alin. (1) excepts this activity from the expense engine precisely because alin. (2) replaces it with a flat ratio. The absence of an engine is the shape of a different regime, not a gap — but only where the rule set actually offers that regime, which is why it is a **fact** handed to the registry rather than a branch the registry takes itself.

The new entry is the honest half of D-CAZ-1: the arithmetic is built, the input is not, and the input cannot be built from the fiscal code alone. It is `refuse`, not `incomplete`, because unlike a missing profile fact there is no number beside the gap that would still be this taxpayer's number.

Two supporting facts were added to `ScenarioFacts`: `flatRatioMethodAvailable` and `flatRatioOpenQuestions`. Both are read from the rule set by the assembler; the registry never infers either.

### The FY2026 refusal, before → after

| | before 6h-1 | after 6h-1 |
|---|---|---|
| scenario id | `no-expense-engine` | `accommodation-gross-undetermined` |
| what it claims | this build has no method for the activity | the method is implemented; the gross is not settled |
| detail text | the rule's `EXPENSE_ENGINE_CAZARE_2026` reason | the two readings of alin. (3) and the alin. (1) gate, verbatim from `ACCOMMODATION_68X3_2026` |
| badge | `Nu putem calcula` | `Nu putem calcula` (unchanged) |
| figure | none | none (unchanged) |

`no-expense-engine` remains live for a rule set with no flat-ratio method, and `src/domain/activityFamily.test.ts` and `src/domain/estimateBasis.deductibility.test.ts` each pin that case by filtering the rule set, so the entry cannot rot into a stale sentence.

---

## Surfaces

`src/components/dashboard/ScenarioRefusal.tsx` renders two paragraphs: the framing sentence from `src/ui/copy/scenarios.ts` (`accommodationGrossUndetermined`) and the `detail`. The framing sentence says the calculation exists, says the gross is what is missing, and points down at the two readings, which are the rule's own words. No fiscal value and no legal conclusion was added to any component.

---

## Acceptance evidence

1. **Worked example** — stated above and pinned in `src/domain/art68x3.arithmetic.test.ts`: net = 70 % × gross, tax = 10 % × net, CASS at the correct base, 6-SM floor applied.
2. **Sole-68^3 income owes the 6-SM CASS minimum** — gross 20.000 → net 14.000 < 24.300 → CASS = 2.430, not 1.400; total 3.830. `research/38` §1 is the authority that none of the three art. 174 alin. (7) exemptions can fire for such a taxpayer: no salary at or above 6 SM, no art. 155 alin. (1) lit. c)-h) income bearing CASS, no pension sums received in the year. The fixture sets `salaryStatus: 'nu'` and no pension facts for exactly that reason.
3. **The net raises the CAS threshold test without becoming the CAS base** — in the 12/24-SM band CAS = 12.150 and explicitly **not** 17.500; at gross 140.000 the net 98.000 lifts the taxpayer into the 24 SM tier and CAS = 24.300, explicitly **not** 24.500.
4. **Mixed profile** — one test for cumulation (CASS 10.000, not 3.000) and one for ring-fencing (the 68^3 line is 7.000 = 10 % of its own net), plus one for the proration (7.290 / 3.000) and one proving a single-source register does not move by a single ban.
5. **Foreign receipts convert per collection** — two EUR receipts on 2026-03-02 (× 4,9000) and 2026-03-10 (× 5,0000) give a gross of 14.900 lei, with each conversion carrying its own rate and `basis: 'payment_date_daily'`. A third test collects on Saturday 2026-03-07 and asserts the Friday 2026-03-06 row is used and surfaced as `carriedFrom`.
6. **No commission default anywhere** — a grep for `comision`/`commission` across `src` returns only: the rule's `gross_scope_open_question` parameter, the release `notes`, a doc comment in `src/domain/fiscal/calculators.ts`, a doc comment in `src/domain/scenarios.ts`, the `src/ui/copy/scenarios.ts` sentence that says the app does not choose, and test assertions. No arithmetic anywhere. A test also asserts the rule carries no `commission_*` parameter and no boolean parameter at all.
7. **Every new number is a rule entry** — the parameter-patching test above; the rule carries no `unit: 'lei'` parameter, so no SM figure lives on it.
8. **FY2027 yields no silent 68^3 figure** — `selectIncomeDeterminationMethod` returns `'sistem-real'` when the selected rule set carries no art. 68^3 rule, and `computeTaxEstimate` refuses a `flatRatioGross` outright with a reason naming art. 68^3 and the year, emitting no `Impozit art. 68^3` line.
9. **Guards** — `tsc` 0 · 110 files / 1645 unit tests · `build` 0 · e2e 83 passed including the 4 axe tests · copy-guard `ALLOW_LIST` still empty · the wall-clock guard passes · PG-5C's enforcement test passes untouched.

---

## Tests that moved, before → after

| File | Before | After | Why |
|---|---|---|---|
| `src/domain/fiscal/fiscal.test.ts` | 48 rules | 49 rules | `ACCOMMODATION_68X3_2026` added |
| `src/domain/fiscal/fiscal.test.ts` | 47 selected on 2026-03-15 | 48 | same |
| `src/domain/fiscal/fiscal.test.ts` | 47 selected on 2026-09-01 | 48 | same; the 68^3 rule has no mid-year boundary |
| `src/domain/fiscal/fiscal.test.ts` | release `version` 1 | 2 | content hash moved — see the release section |
| `src/domain/activityFamily.test.ts` | cazare refused with `no-expense-engine`, detail contained `art. 68^3` | refused with `accommodation-gross-undetermined`, detail contains `Citește A` / `Citește B` | the sentence "this build has no method" is now false for FY2026 |
| `src/domain/activityFamily.test.ts` | — | +1 test | `no-expense-engine` still fires when the rule set carries no flat-ratio method |
| `src/domain/estimateBasis.deductibility.test.ts` | B-29 case asserted the stop was `no-expense-engine` and `nu o implementă încă` | still refused; the classifier's `EXPENSE_ENGINE_CAZARE_2026` refusal is still produced on the register, the stop is the gross | re-premised, not deleted |
| `src/domain/estimateBasis.deductibility.test.ts` | — | +1 test | the same case with the flat-ratio rule filtered out still stops at `no-expense-engine` |
| `src/data/dashboard.activityFamily.test.ts` | `no-expense-engine` | `accommodation-gross-undetermined` | same id move, at the dashboard seam |
| `src/domain/scenarios.routes.test.ts` | one route test per scenario | one more | the file builds a test per entry in `SCENARIO_SUPPORT`; the new entry is covered automatically |
| `e2e/activity-family.spec.ts` | `[data-scenario-refusal="no-expense-engine"]` | `[data-scenario-refusal="accommodation-gross-undetermined"]`, plus an assertion that the framing sentence states the 30 % / 10 % arithmetic once | same id move, in a browser |

No test was deleted.

---

## Deviations from the brief, and why

Three, all inside the "may touch" list.

1. **`ScenarioFacts.activityFamily`, and one precedence rule stated once.** `selectDeductibleExpenses` already let a per-call `context.activityFamily` win over the stored profile (PG-6b), but the new determination method read only the stored profile. A test passing `{ activityFamily: 'cazare' }` over a profile declaring `other` therefore selected the flat-ratio method while the detectors still described the stored profile — one register, two activities at once. `selectIncomeDeterminationMethod` now takes the declared family as an argument, `estimateBasis.ts` resolves it once, and `effectiveActivityFamily` in `src/domain/scenarios.ts` is the only place the precedence is written.
2. **The refusal's framing sentence was moved out of the domain.** An earlier shape composed a framing sentence in `src/domain/scenarios.ts` *and* had one in `src/ui/copy/scenarios.ts`; `ScenarioRefusal` renders both, so the same claim appeared twice in one block, and the copy sentence also restated what the rule's own text already says about what choosing costs. `accommodationOpenQuestionDetail` now carries only the rule's verbatim questions; the framing exists once, in copy. This is the one-producer-per-sentence rule the codebase already treats as a defect class, applied before it shipped.
3. **`release2026.ts` `version` 1 → 2 and `createdAt` moved.** The brief said "new rule entries and version bump only", which is what happened; the bump is recorded above as a consequence of `ruleSetDigest` moving, not as an edit to a display number.

No existing rule value, threshold or statutory citation was touched.

---

## What is still not modelled — this is not finished work

- **B-80, the alin. (3) platform-commission scope.** Two live readings, both written into the rule, neither chosen. ANAF Brașov leans broad, the statutory words lean narrow, and no primary source reconciles them. The choice moves gross, therefore the tax, the CASS base and the CAS threshold.
- **The alin. (1) eligibility gate** — „operatorii economici definiți potrivit legislației specifice domeniului turismului" is decided in tourism law and the ONRC authorisation, not in the Codul fiscal.
- **Who lands on this method** — alin. (12) with art. 83 alin. (4) for more than 7 rooms, art. 85 alin. (1)-(2) for the 1-7 room case. Not encoded.
- **alin. (8), the occupancy sheet** — OPANAF 381/2026 (MO I 250/31.03.2026). 6h-3, under D-OCC-1. No CNP or guest data exists anywhere in this task.
- **FY2027.** No release exists, the minimum wage is not published, and the app refuses rather than computing a 2027 figure with 2026 percentages.
- **The gross is an input everywhere.** No surface produces it from a commission setting, because there is no commission setting.

---

## Handoff: what 6h-2 and 6h-3 must route through

**6h-2 (D-COM-1, the questions).** The two questions already exist as data on `ACCOMMODATION_68X3_2026` — `gross_scope_open_question` and `eligibility_open_question` — and `accommodationOpenQuestions` lifts them for the refusal. When 6h-2 asks them, the answer must become a stored profile fact that reaches `selectAccommodationGross` / `flatRatioGrossFromYtd` and changes the gross, not a new sentence. The refusal must then stop firing for a taxpayer who has answered, and keep firing for one who has not. Do not add a second copy of either question text; the rule is the only producer, and the e2e and unit assertions quote its words.

**6h-3 (D-OCC-1, the occupancy sheet).** Nothing in this task pre-shapes it. The 68^3 gross is measured on the ledger pass; if the sheet feeds the gross it must feed it as the same `flatRatioGross` operand, not as a second revenue path.

**Anything that adds a second income source.** `cumulatedNet` is the single place the art. 155 alin. (1) lit. b) cumulation happens, and `contributionBases` is the single place the bases block is built. A new source that bypasses either will produce a CASS base and a threshold row that disagree.

---

## 6c's contested premise — recorded, not resolved

Brief 28 says a vehicle expense with no usage fact must be `incomplete` rather than silently deducted at 50 %. `VehicleUseFact` in `src/domain/fiscal/deductibility.ts` documents the opposite default: `exclusive` means exclusive use **evidenced by a foaie de parcurs**, and „absent that record the law defaults to 50 %, so `unknown` deliberately behaves like `mixed`".

**The reading the code currently implements is the second one.** In `conditionMatches` in `src/domain/fiscal/deductibility.ts`, the `'vehicle_use_not_exclusive'` condition matches `mixed`, `unknown` **and `undefined`**, with the comment „The statutory default: no logbook, no exception category => 50 %." That selects `EXPENSE_VEHICLE_MIXED_USE_2026` in `src/domain/fiscal/deductibility2026.ts`, which carries `treatment: 'capped'`, `capPercent: 50`, `capBase: 'expense_itself'` and `capBaseArticle: 'art. 68 alin. (7) lit. k)'`, with its citation line `art. 68 alin. (7) lit. k); art. 68 alin. (5) lit. j); Normele HG 1/2016 pct. 7 alin. (7) și pct. 68 alin. (2)`. The 100 % side, `EXPENSE_VEHICLE_EXCLUSIVE_USE_2026`, states in its own note that the foaie de parcurs must hold at least vehicle category, purpose, place, kilometres and the operator's own fuel norm per km, and that the burden of proof is on the taxpayer (Normele pct. 68 alin. (2)).

So the code treats the 50 % as the law's own default when the fact is absent, not as an app-side assumption over an unanswered question. Whoever briefs 6c should settle that against art. 68 alin. (4) lit. a) and the Normele rather than inherit either guess. **Not resolved in this task, and nothing here was changed on the strength of it.**

---

## Counts

| | before (`18ee28c`) | after |
|---|---|---|
| `tsc --noEmit` | 0 | 0 |
| unit test files | 109 | 110 |
| unit tests | 1617 | 1645 |
| `npm run build` | 0 | 0 |
| e2e (functional + axe) | 83 (79 + 4) | 83 (79 + 4) |
| copy-guard `ALLOW_LIST` | empty | empty |
| seed completeness | 7/9, 100 % weighted | 7/9, 100 % weighted (unchanged; `e2e/dashboard.spec.ts` still pins `7 din 9 verificări îndeplinite`) |
| fiscal rules in the 2026 package | 48 (9 + 39) | 49 (10 + 39) |
| release version | 1 | 2 |
