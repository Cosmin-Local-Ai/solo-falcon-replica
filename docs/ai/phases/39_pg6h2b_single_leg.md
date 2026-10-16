# 39 — PG-6h-2b: the art. 68^3 path is single-legged (B-85)

Task: brief 42. Defect **B-85**, recorded in `docs/ai/PHASE_PLAN_11_34.md` §4 and minted by the PG-6h-2
register pass. This was found by reading the tree, not by a run.

## The defect, and the figures it produced

`src/domain/tax.ts` computed two nets from one record set and added them:

```ts
const vnaSistemReal: Bani = net > 0 ? net : lei(0);
const cumulatedNet: Bani = flatNet === null ? net : addBani(vnaSistemReal, flatNet);
```

`revenues`/`expenses` and `flatRatioGross` are not two sources. `src/domain/estimateBasis.ts`
`selectEstimateOperands` measures the flat gross with `flatRatioGrossFromYtd` on the same `selectYtd`
pass it takes the sistem-real operands from. For a `cazare` register `selectDeductibleExpenses` returns an
empty deductible set — the rule `EXPENSE_ENGINE_CAZARE_2026` fires through `expenseEngineRefusal` — so the
sistem-real leg was the register's receipts with zero deductions and the flat leg was 70 % of those same
receipts. `cumulatedNet` came out at **1,7 × the register's money**, and an art. 123 income tax and an
art. 68^3 alin. (6) income tax were charged one after the other.

Nothing structural prevented it. Only `accommodation-gross-undetermined` in `src/domain/scenarios.ts` did,
and a refusal that lives in another module is not a guard: resolving B-80, building 6h-3 or adding the
art. 85 rule would each have removed that refusal and left the arithmetic in place.

### Before → after, on the fixture `src/domain/art68x3.arithmetic.test.ts` already used

One register: receipts 130.000 lei, recorded expenses 100.000 lei, flat gross 100.000 lei.

| figure | before | after | why the old number was wrong |
|---|---|---|---|
| `cumulatedNet` / CASS base | 100.000 | 70.000 | the sistem-real half was the same receipts seen a second time |
| `CASS (10%)` | 10.000 | 7.000 | art. 170 alin. (1) cumulates **sources**; one register is one source |
| `Impozit pe venit (rată de bază 10%)` | 1.971 | line absent | the taxpayer was never measured under art. 123; a zero line would still claim they were |
| `CAS deductibilă` / `CASS deductibilă` | 7.290 / 3.000 | both absent | art. 118 alin. (2^2)-(2^3) apportion a deduction onto a sistem-real base this register does not have |
| `Venit net anual impozabil` | 19.710 | absent | same reason |
| `Total taxe` | 43.271 | 26.150 | one income tax, not two |
| `bases.venitulNetDinActivitate` | 0 | 70.000 | the old zero was the defect wearing a zero: it reported a sistem-real net for a register that has none |
| `bases.venitulNetCumulatPentruContributii` | 100.000 | absent | one source, so there is no second number for the same quantity |

For a sole art. 68^3 taxpayer below the floor, `bases.venitulNetCumulatPentruContributii` 14.000 moved the
same way: it is now `bases.venitulNetDinActivitate` 14.000 with the cumulated field absent. The CASS figure
itself — 2.430 lei, the 6 SM floor of art. 174 alin. (6) — and the total of 3.830 lei did not move.

## The fix

### `src/domain/tax.ts` — composition only

The engine now holds income as **one leg per source**, and the method gate decides which leg exists.

- `IncomeDeterminationMethodTag`, `ContributionLeg`, `FlatRatioLeg` — the shape. A leg is a source with the
  net its determination method produced, not "a method" and not "a record set".
- `cumulateContributionBase(legs)` — art. 148 alin. (3) and art. 170 alin. (1) over a list of **sources**.
  With one leg it returns that leg's net with its sign intact, because `calcCass` reads a negative as the
  art. 174 alin. (2) zero/loss case; the floor at zero applies only from the second leg onward.
- `sistemRealContributionRatio(legs)` — art. 118 alin. (2^2) and (2^3). Exported so the ratio a test reads
  is the ratio the engine used.
- The flat leg is resolved **before** the leg list is built and before any line is pushed. `git diff` shows
  the suppression upstream of the combination: `legs` is built from `flatLeg === null`, and the sistem-real
  operands (`sistemRealGross`, `sistemRealExpenseBase`) never enter the list when a flat leg exists. There
  is no zeroing after the addition anywhere in the file.
- A second half of the gate returns before the art. 118 alin. (2) block when the leg is the flat one, so
  there is no code path left in which a second leg could be added and recombined.
- `contributionBases` now takes `legs` and writes `venitulNetCumulatPentruContributii` only when
  `legs.length > 1` — not whenever a flat ratio was supplied.

`src/data/dashboard.ts` `buildThresholdBases` was not touched. It reads
`tax.bases.venitulNetCumulatPentruContributii ?? tax.bases.venitulNetDinActivitate`, and the fallback is now
the flat net, so the threshold row measures on the same amount the engine did. That is asserted in
`src/domain/tax.singleLeg.test.ts` against `buildThresholdBases` directly.

### `src/domain/scenarios.ts` — one entry

`accommodation-method-attribution-missing`, `effect: 'refuse'`, message key
`accommodationAttributionMissing`, `fixTarget: { page: 'settings', tab: 'fiscal' }`. It is a registry entry,
not a branch in `selectEstimateOperands`.

It reads the one new fact in `ScenarioFacts`: `incomeDeterminationMethod`, threaded from
`selectEstimateOperands`. The registry does not re-derive the method from `activityFamily` plus
`flatRatioMethodAvailable` — those answer whether the rule set carries the method, which is a narrower
question than whether this register is determined by it, and two answers to it would let the refusal and the
engine be about different registers.

It sits **after** `accommodation-gross-undetermined` in `SCENARIO_SUPPORT`. Registry order is precedence, so
the reason a person sees today is still the gross question with the rule's own open questions rendered under
it; the attribution refusal travels beside it. It is the backstop for the day that question is retired.
`src/domain/scenarios.routes.test.ts` walks `SCENARIO_SUPPORT` through `parseRoute`, so the new `fixTarget`
is checked against the live router without a new test.

### `src/ui/copy/scenarios.ts` — one sentence

`accommodationAttributionMissing`. It names what is missing — which receipts the method applies to — and
claims nothing further. It does not say the law forbids two methods in one year (art. 68^3 alin. (11)
contemplates a taxpayer who has both), and it does not say the activity can never be computed, which
D-CAZ-1 already decided against. The copy guard's `ALLOW_LIST` in `src/ui/copy/copy.guard.test.ts` is still
empty.

## What was deliberately not done

No attribution was invented. A `Revenue` record carries no category, no activity marker and no source; its
`tip` is `'factura' | 'notafactura'`, a document type. So there is nothing to partition the register on, and
three tempting fixes were rejected:

- a category tag on `Revenue` — a new field on stored data, and a fact the person never recorded;
- a percentage split — a number out of thin air feeding a tax;
- "assume all revenue is accommodation when the family is `cazare`" — silently reclassifies a mixed year
  between fiscal titles, which is a worse error than a bigger number.

No new arithmetic, no new rule value, no new fiscal constant, no new migration step, no new field on
`Revenue`. `git diff --stat` touches only `src/domain/tax.ts`, `src/domain/estimateBasis.ts`,
`src/domain/scenarios.ts`, `src/ui/copy/scenarios.ts` and tests. Nothing under `src/domain/fiscal/`,
`src/data/schema.ts`, `src/data/migration.ts`, `src/data/types.ts` or `src/pages/` changed.

## Tests that moved, and why

`src/domain/art68x3.arithmetic.test.ts` — six assertions re-premised, all of them because the old premise
was the defect:

1. `the 68^3 tax is NOT reduced by CAS and CASS` — asserted the art. 123 line existed and was zero. It now
   asserts the line is absent, together with `Venit net anual impozabil`, `CAS deductibilă` and
   `CASS deductibilă`.
2. `the same amount is what the CAS row is measured on` — `venitulNetDinActivitate` 0 → 70.000,
   `venitulNetCumulatPentruContributii` 70.000 → absent.
3. `a sole art. 68^3 taxpayer below 6 SM owes the 6 SM figure` — the cumulated field 14.000 → absent, the
   net field 14.000. CASS 2.430 and total 3.830 unchanged.
4. `CASS cumulates the two lit. b) sources into one base` → `one register is one source: the flat ratio
   beside a sistem-real difference does not cumulate`. CASS 10.000 → 7.000, with explicit negatives against
   both 10.000 (the 1,7 × cumulation) and 3.000 (the sistem-real net alone).
5. `the income tax is ring-fenced…` — the art. 123 line 1.971 → absent; total 43.271 → 26.150; the result
   now asserts exactly one line beginning `Impozit`.
6. `the sistem-real deduction is prorated, not inherited whole` → re-premised onto **two genuine sources**
   through `cumulateContributionBase` and `sistemRealContributionRatio`: 30.000 + 70.000 = 100.000, ratio
   0,3, and 0,3 × 24.300 = 7.290 and 0,3 × 10.000 = 3.000 — the same arithmetic the old fixture claimed, now
   reachable only from two actual sources.

`src/domain/accommodationScenarios.test.ts` — the registry id list gained
`accommodation-method-attribution-missing`; the test was renamed, because "gained exactly one entry" was a
PG-6h-2 statement and is no longer true of one task.

`src/domain/activityFamily.test.ts` and `src/domain/estimateBasis.deductibility.test.ts` — both pinned the
exact list of scenarios the live assembler reports for a `cazare` payload. That list is now
`['accommodation-gross-undetermined', 'accommodation-method-attribution-missing']`. The surfaced refusal is
unchanged in both, and both still assert its id, its `effect` and its `fixTarget`.

## Tests added

- `src/domain/tax.singleLeg.test.ts` — **the deliverable.** Every test calls `computeTaxEstimate` directly:
  no `selectEstimateOperands`, no `evaluateScenarios`, no `selectDeductibleExpenses`. The scenario registry
  is not disabled on this path, it is not on the path at all, so nothing here can pass because a refusal
  fired. It asserts `cumulatedNet` equals one method's net and is neither 221.000 (1,7 × receipts) nor
  130.000 (the receipts taken as a sistem-real net); that the sistem-real income-tax, taxable-base and
  deduction lines are absent; that `buildThresholdBases` lands on the flat net; that the same register
  without a flat gross is an ordinary sistem-real year to the ban; and that two genuine lit. b) sources
  still cumulate and prorate.
- `src/domain/accommodationAttribution.test.ts` — the new entry: it fires once for a flat-ratio register with
  recorded receipts; it stays silent for a sistem-real register, an empty register, a non-`inregistrata`
  receipt, a `cedarea_folosintei` year, a payload with no profile, and a tourism CAEN code with no declared
  family; and with every rule question retired — 9 camere, the alin. (1) answer, a reading of alin. (3) —
  the attribution refusal still fires on its own, so removing the gross refusal does not let the 1,7 × back.

## Verification

- `npx tsc --noEmit` — 0.
- `npx vitest run` — **116 files / 1729 tests, all passing.** Baseline at the start of this task was
  114 files / 1705. The move is +2 files and +24 tests: 10 in `tax.singleLeg.test.ts`, 13 in
  `accommodationAttribution.test.ts`, and 1 more in `src/domain/scenarios.routes.test.ts`, which generates
  one case per `SCENARIO_SUPPORT` entry and so picked up the new `fixTarget` for free. No test was deleted —
  the six re-premised assertions still assert, and the four touched test files hold their same counts.
- `npm run build` — 0.
- `npx playwright test` — **95 passed**, unchanged from the baseline of 95 (91 functional + 4 axe).
- Copy guard: `ALLOW_LIST` in `src/ui/copy/copy.guard.test.ts` is `[]` and the guard passes.
- **The seed estimate is unmoved: 311.200 bani (3.112 lei)**, still pinned by
  `src/data/dashboard.accommodation.test.ts`. The seed profile is not a `cazare` register, so the gate does
  not touch it — and if that figure ever moves, something outside the brief changed.
- **The deduction apportionment is unchanged for every profile that was computing before.** With one leg
  `sistemRealContributionRatio` returns exactly 1, which is what the previous inline expression produced.
  All 60 tests in `src/domain/tax.test.ts` pass with no edit.

## Scout deviation

Scout A and Scout B were both dispatched, sequentially, and both reports were checked against the tree
before acting (§12.12). Every path and identifier each named — `cumulatedNet`, `vnaSistemReal`, `flatNet`,
`ratioCas`, `ratioCass`, `venitulNetCumulatPentruContributii`, `buildThresholdBases`,
`selectDeductibleExpenses`, `selectEstimateOperands`, `flatRatioGrossFromYtd`, `expenseEngineRefusal`,
`EXPENSE_ENGINE_CAZARE_2026`, `SCENARIO_SUPPORT`, `ScenarioFacts`, `accommodationIncomeTitleForYear` — was
confirmed present by `rg`. No deviation to record: neither report named anything absent.

## What a mixed-method year would need in order to become computable

This is the question 6h-3 and the art. 85 rule both inherit, so it is written down once here.

**The minimum fact:** each `Revenue` record would have to carry which activity its receipt came from — one
value naming the determination method, or one naming the activity that a rule maps to a method. Nothing
smaller works. The record today has `id`, `tip` (`'factura' | 'notafactura'`, a document type), `nr`, `date`,
`collected`, `client`, `cui`, `valoareFaraTva`, `tva`, `status`, `statusDetail`, `eFacturaStatus`. None of
them distinguishes an accommodation receipt from a consulting invoice, and `client`/`cui` cannot be made to:
the same guest and the same client appear in both.

**What it would cost, in full:**

1. **A migration step.** A new optional field on `revenueSchema` in `src/data/schema.ts`, a new version in
   `src/data/migration.ts` appended after the current head — never a renumbered step — and, per the standing
   rule that an unanswered question is not a default, **no backfill**. Existing records stay unattributed and
   the year stays refused, so shipping the field does not by itself make any current profile computable.
2. **A UI question, not a UI guess.** The person would have to state the activity per receipt, at entry and
   on the existing rows. It cannot be derived from a CAEN code — the same reasoning PG-6b recorded for
   `activityFamily` and PG-6h-2 recorded for the room count — and it cannot be defaulted from
   `profile.activityFamily`, because that is a whole-profile declaration and the whole point of the field is
   that a profile can hold two activities in one year.
3. **A seed change.** `src/data/seed.ts` would need attributed receipts, which changes the demo register and
   therefore the 311.200 bani figure every dashboard and rollover test pins. That is a re-baseline of the
   published seed estimate and has to be stated, not absorbed.
4. **A rule for the other title.** With attribution in place, a 1–7 room year is *cedarea folosinței
   bunurilor*, and this rule package has no art. 85 rule — D-CAZ-1 path (c) is a separate rule with its own
   citation. Attribution without that rule moves a mixed year from "refused" to "computed under the wrong
   title", which is the B-29 defect in better clothing.
5. **The engine needs no further change.** The leg list is already keyed by method, so a second attributed
   source arrives as a second `ContributionLeg` and `cumulateContributionBase` and
   `sistemRealContributionRatio` do what art. 148 alin. (3), art. 170 alin. (1) and art. 118 alin. (2^2)-
   (2^3) say. That is the part this task made safe in advance.

**Not built here, deliberately.** None of the above. The refusal stands, and it now names the missing
attribution rather than hiding behind the gross question.

## Open items handed forward

- **B-85 is closed structurally, not by a refusal.** The 1,7 × base is no longer constructible in
  `src/domain/tax.ts`, and `accommodation-method-attribution-missing` refuses the register that would have
  produced it.
- **The mixed-method gap is now a named gap, not an unowned one.** Whoever supplies receipt attribution
  inherits the five costs above.
- **1–7 rooms is still uncomputed** — the art. 85 rule does not exist in this package, and
  `accommodation-title-cedarea-folosintei` refuses it.
- **B-80 is still open.** The commission reading is a recorded user choice; `accommodation-gross-undetermined`
  still refuses while it is unanswered, and answering it no longer opens a figure, because the attribution
  refusal is behind it.
- **B-79** (`closed_final` declared, produced by nobody) is untouched by this task and still unowned.
