# PG-6b — the activity family is a stored, migrated, declared fact (B-29)

Brief: `docs/ai/briefs/39_pg6b_activity_family.md`. Contract inherited from: `docs/ai/phases/35_pg6a_scenario_framework.md`.
Legal grounding read before writing: `docs/ai/research/30_norma_venit_2026.md` §3 and §5, and the rule record
`EXPENSE_ENGINE_CAZARE_2026` in `src/domain/fiscal/deductibility2026.ts`.

Written from this task's own diff. No line numbers are cited.

---

## What this task was

PG-6a built the scenario channel and registered `no-expense-engine`, then reported honestly that the scenario
**could not fire from stored data**: the expense classifier had accepted an `activityFamily` in its context since
the art. 68^3 rule was written, and no caller ever supplied one. That is B-29 — not a missing refusal, a refusal
nobody can reach. A PFA whose whole activity is *prestarea de servicii de cazare* and a software consultant got
the same confident figure, labelled „Calculat".

6b is the fact. One `SCENARIO_SUPPORT` entry, one migration step, one profile field, and one threading point. It
adds no mechanism, and it does not model art. 68^3.

---

## The fact, and where it lives

`PfaProfile.activityFamily?: ActivityFamily` in `src/domain/models.ts`. The type is imported **type-only** from
`src/domain/fiscal/deductibility.ts`, which is where the vocabulary is spelled; `ACTIVITY_FAMILY_VALUES` is the
same pair as a value, and `src/domain/schema.ts` persists it as `z.enum(ACTIVITY_FAMILY_VALUES).optional()` with
**no `.default()`**. One spelling of the pair, in the layer that matches on it — a second spelling is the B-70
defect class this project has already been burned by.

Three properties, each asserted somewhere:

- **Asked, never inferred.** No code in this repository derives the value from `identity.caen`. `research/30` §3
  records that OMFP 925/2017 art. 2 alin. (4) keys the determination method to the activity description
  „independent de codurile CAEN menționate cu titlu exemplificativ" — the nomenclator's CAEN columns are
  exemplary, so a code is not a statement about how the law taxes this person.
- **Optional means unanswered, not `other`.** Absence is a third state and is reported, not passed over.
- **A fact, not a conclusion.** The rule layer decides what a family means for a calculation; the field only
  records what the person said. That separation is what PG-6h needs — see the handoff.

`domain/profile.ts createDefaultProfile` leaves the field absent. `src/data/seed.ts` **declares** `'other'`,
because the demo profile is a fixture answering a question, and leaving it unanswered would have made every test
that reads the demo profile assert an incomplete estimate for a reason unrelated to what that test is about. That
is a fixture choice, not a product default, and the comment in `seed.ts` says so.

## The migration step: v11 → v12, `activity-family`

The head was confirmed in-tree before choosing the number: `DATA_VERSION_ANNUAL_FILING = 11`. The new step is
`DATA_VERSION_ACTIVITY_FAMILY = 12`, `migrateActivityFamilyV12`, appended to `MIGRATION_CHAIN` — no step was
renumbered or reordered.

The step's entire content is that it **backfills nothing**:

```ts
export function migrateActivityFamilyV12(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_ACTIVITY_FAMILY };
}
```

The forbidden version of this function is `activityFamily: profile.activityFamily ?? 'other'`. That one token
would have minted a legal fact for every stored profile, made the undeclared-family scenario unfireable, and
presented an accommodation taxpayer's register under rules the law does not apply to them. `src/data/store.migration.chain.test.tsx`
asserts the absence on the migrated payload (`'activityFamily' in outcome.data.profile!` is `false`) and that a
declared `'cazare'` passes through untouched. The step is idempotent-safe because it writes a version and touches
no value.

Why a version stamp at all, for a step that changes no value: without it, a stored payload that never answered
would be byte-indistinguishable from one that answered, and the third state would exist in the type but not on
disk.

## The scenario entry — one, as the contract requires

`activity-family-undeclared` in `src/domain/scenarios.ts`, `effect: 'incomplete'`, `message:
'activityFamilyUndeclared'`, `fixTarget: { page: 'settings', tab: 'fiscal' }`. It is appended to `SCENARIO_SUPPORT`
and nowhere else.

`detect` reads one field and infers nothing: no profile object → no outcome (a payload that describes no person
has no profile fact to have missed — the same answer `regimeScenario` gives for a missing regime); a declared
`'cazare'` or `'other'` → no outcome; anything else → the gap. It does not read `identity.caen`, the expense
categories or the regime. It is total: `src/domain/activityFamily.test.ts` runs it against an empty register, a
profile with no start date, an empty CAEN array and a payload with no profile object, and asserts no throw.

**`incomplete`, not `refuse`, and the two stay distinct.** An unanswered question is a fact the user can still
supply, and the figure beside it is still the figure the app can produce from the records it holds. A case the law
does not let this build compute is `no-expense-engine` above it. The gap rides PG-1's channel —
`scenarioCoverageGaps` turns it into a `fact_missing` coverage row with `kind: 'profile'`, `amount: null` and
`fixTarget: '/settings#!/fiscal'`, the route `scenarios.ts scenarioFixHref` produces and the routes test follows.
It adds **no** amount: the weighted percentage is a share of recorded bani, and a fact the register never held
took nothing out of the figure. Asserted in `src/data/dashboard.activityFamily.test.ts` — `percent`,
`recordedBani` and `includedBani` are identical with and without the gap; only `estimateState` moves.

## Threading — `estimateBasis.ts` is threading only

`selectDeductibleExpenses` now builds one context before it classifies anything:

```ts
const ctx: ExpenseClassificationContext = {
  activityFamily: data.profile.activityFamily,
  ...context,
};
```

and passes `ctx` to `expenseEngineRefusal` and to `classifyExpenseDeductibility`. That is the whole change to the
file. Three things it deliberately does:

- **one point, not five.** The estimate, the coverage rows and the expense register all funnel through this
  function; threading at the call sites would have put the same fact in five places where the sixth forgets it;
- **the caller's context still wins** — the spread comes second, so a test or a later phase supplying a per-call
  fact is not overwritten (asserted);
- **absence stays absence** — `undefined` is not coerced to `'other'`.

`data/derived.ts` needed no change: it already calls this assembler.

## The surfaces

- **Onboarding** (`src/pages/Onboarding.tsx`) asks the question with three radio states — not recorded / `other` /
  `cazare` — and `finish()` writes `...(activityFamily === '' ? {} : { activityFamily })`. An unanswered question
  writes **nothing at all**, so the profile keeps the third state.
  `src/ui/copy/onboarding.ts` lost the `deferred.activity` sentence: the first-run screen used to list the activity
  declaration as deliberately not asked, because 12E was blocked on a CAEN→family mapping. That mapping does not
  exist in law, so the deferral was not a deferral — it was a gap described as a decision. The card now defers one
  thing, the other-income amounts, which is 12F's and genuinely is.
- **Settings**, fiscal tab: a labelled `<select>` carrying the stored value, with a hint that changes with the
  state — the unanswered state says what the app is doing with the gap rather than leaving the person to find it
  from a badge on another page. It sits directly under the CAEN field, and the hint says out loud that the value
  is not read from that field, because a form that asks the same question twice in different words teaches the
  person that the second was guessed from the first.
- **Dashboard**: no new surface. The refusal block PG-6a built renders; the coverage row is PG-1's.

## Acceptance evidence

1. **A declared `cazare` profile refuses in a browser, from stored data.** `e2e/activity-family.spec.ts`: badge
   `Nu putem calcula`, the rule's own sentence rendered **once** (`[data-scenario-detail="no-expense-engine"]`,
   count 1 — the chart points at the block instead of quoting the paragraph again), hero and cockpit strip both
   `—`, and the fix link resolves to `/settings#!/fiscal` and lands on the control showing `cazare`. No
   hand-built classification context anywhere in the spec.
2. **A profile that answers no is unaffected.** Same register, same as-of, with and without the fact:
   **3.112 lei before, 3.112 lei after** (`getTaxEstimate(...).output.total` = 311200 bani both ways), and the
   whole `output` object is deep-equal. Pinned in `src/data/dashboard.activityFamily.test.ts`.
3. **An unanswered question is not silently `'other'`.** `estimateState` is `incomplete`, the badge is
   „Estimare incompletă", a `fact_missing` row names it and links to the control, and the refusal count is 0.
   Proven in the browser and in the domain.
4. **The answer is visible and editable in Settings.** `src/pages/Settings.activityFamily.test.tsx` covers the
   stored value, the write path, clearing to absence, and — the one that matters for landmine 1 — typing CAEN
   `5510` into the CAEN field and saving leaves `activityFamily` **absent** while the code itself persists.
5. **No CAEN inference anywhere.** A CAEN 5510 profile with no answer is `incomplete`, not refused; the same
   register declaring `other` computes; and the detector's output is identical across a payload with the 5510
   code and one with an empty CAEN list.
6. **`scenarios.ts` gains one entry; `estimateBasis.ts` is threading only.** See the two sections above. The
   deviations from that sentence are listed below and are all wording, all authorised.
7. `tsc` 0 · **109 files / 1617 unit tests** · `build` 0 · **e2e 83 passed (79 functional + 4 axe)** · copy-guard
   `ALLOW_LIST` still empty · PG-5C's enforcement untouched and green (no change to `amountsForEstimate`,
   `recorded-actuals`, or the `@ts-expect-error` tests).

Seed completeness is unchanged at **7 din 9 verificări**, weighted **100 %** — the demo profile declares a family,
so the new gap does not fire for it, and no completeness check was added or removed.

## Tests that moved, before → after

All of these moved because the chain grew by one step. None moved because a figure changed.

| file | before | after | why |
|---|---|---|---|
| `src/data/store.migration.chain.test.tsx` | chain edges end at `11 → 12` absent; `CURRENT_DATA_VERSION` = `DATA_VERSION_ANNUAL_FILING`; ten `stepsApplied` lists | edge `[DATA_VERSION_ANNUAL_FILING, DATA_VERSION_ACTIVITY_FAMILY]` added; current = `DATA_VERSION_ACTIVITY_FAMILY`; every list gains `'activity-family'` | one more step, appended |
| `src/data/store.migration.chain.test.tsx` | — | new test: the v12 step backfills nothing, and a declared family passes through | the step's whole contract |
| `src/data/migration.currency.test.ts` | `CURRENT_DATA_VERSION` = v11; `record-currency` at `length - 2`; v9 → `['record-currency','annual-filing']`; v10 → `['annual-filing']` | v12; `length - 3`; `+ 'activity-family'`; `['annual-filing','activity-family']` | the money guard's re-pin discipline: the guarded property — no amount moves — is intact |
| `src/data/store.taxReserve.test.tsx` | reserve load applies five steps | six | same |
| `e2e/settings.spec.ts` | `saved.version` = 11 | 12, plus a new byte-level assertion that `'activityFamily' in saved.profile` is `false` | the save effect stamps the version this build writes; the new assertion is the v12 non-write proven on the store's own bytes |
| `src/domain/scenarios.test.ts`, `src/domain/estimateBasis.deductibility.test.ts` | pinned the phrase `nu lasă niciun motor de cheltuieli` | `nu o implementă încă` | D-CAZ-1 wording, see below |

No fiscal figure moved anywhere. The 3.112 lei seed estimate, the seed completeness and every cap/threshold test
are unchanged.

## Deviations from the brief, and why

The brief said `scenarios.ts` gains **one entry and nothing else**, and that the rule layer was off-limits. Three
wording changes fall outside that, all of them required by **D-CAZ-1** (`docs/ai/USER_DECISIONS.md`, user decision
2026-10-11: art. 68^3 accommodation income will be *supported*, not permanently refused; PG-6h implements it):

- `estimateRefusalReason` in `src/domain/scenarios.ts` now says the rule *asks for a method this rule package does
  not implement **yet***, instead of *leaves no expense engine for this activity*. Two tests re-pinned to follow.
- `noExpenseEngine` in `src/ui/copy/scenarios.ts` says the law chose a different method — a flat expense ratio —
  and the app **does not implement it yet**, rather than that the app „nu are cum să calculeze". A user reading
  the old sentence would stop looking for a feature that has been decided.
- The rule record's `name` and the closing clause of its `missingFact` in `src/domain/fiscal/deductibility2026.ts`
  were reworded, and the `RefusedExpense` comment in `src/domain/fiscal/deductibility.ts` now names PG-6h as the
  owner of the flat-ratio engine. **No rule value, threshold, citation or registry entry changed**, and no
  arithmetic changed: the rule's `treatment`, `condition` and quoted articles are byte-identical. The old name
  („fără cheltuieli deductibile") was also legally imprecise — art. 68^3 alin. (2) *does* deduct a flat 30 % — and
  leaving it would have made the rule record contradict the paragraph quoted inside it.

Nothing else in the brief was exceeded: no 30 % ratio, no 10 % rate, no room threshold, no art. 85, no art. 83
alin. (4).

**Scout reports (§12.12).** Scout A (classifier call path and every `ExpenseClassificationContext` construction
site) and Scout B (how a profile field is asked, stored, migrated and re-displayed) were each checked against the
tree before acting: every file and identifier they named was grepped and found, so neither report was untrusted and
no territory had to be covered by hand. No deviation to record.

## What is still not modelled — this is not finished work

**art. 68^3 remains unimplemented, and that is a decision, not an omission.** 6b makes the app *notice* an
accommodation register and decline; it does not compute one. `research/30` §5 records the regime's real scope — new
from 01-01-2026 (Legea 239/2025 art. XII), a **30 % flat expense ratio** with tax at 10 % of the net and
„impozitul fiind final" (an effective 7 % of gross), reaching private landlords **above 7 rented rooms** through
art. 83 alin. (4), and art. 85 for the 1–7 room case. D-CAZ-1 has now decided all three paths are to be supported,
and assigns them to **PG-6h**, which is blocked on two open questions in `research/30` §10: whether the 68^3 net
enters the **CASS** base and the 6-SM floor, and whether the **ANAF order approving the new fișa de ocupare a
capacității de cazare** was ever published. A number built on either gap would be the exact defect this series
exists to remove.

## Handoff: what 6c–6g and PG-6h must route through

- **A new unsupported case is one entry in `SCENARIO_SUPPORT`**, with a `detect` that is total, an honest
  `effect`, a `message` key whose sentence lives in `ui/copy/scenarios.ts`, and a `fixTarget` that resolves
  through `scenarioFixHref` to a route a test follows. Nothing else in the framework changes; 6b added no
  mechanism and 6c–6g must not either.
- **A fact the user can supply is `incomplete` and joins PG-1's coverage channel** with `amount: null` unless the
  fact genuinely has an amount. Do not add a second "not complete" surface, and do not let a profile gap move the
  weighted percentage.
- **A case the law does not let this build compute is `refuse`**, and the refusal replaces the figure.
- **For PG-6h specifically:** the fact and the effect are deliberately separated. `profile.activityFamily` is a
  declared description, not a "refuse me" flag — PG-6h reads the same value to *choose a method*, so nothing about
  the stored payload changes and no new migration version is needed. The effect lives in the rule's
  `treatment: 'no_expense_engine'` and in `no-expense-engine`'s `detect`, which fires only while
  `facts.classifierRefusal` is non-null: replace the treatment with a computed path and the scenario stops firing
  on its own, leaving the id, the message key and the fix route in place.
- **B-79 (`closed_final`) is still declared and still produced by nobody.** 6b did not touch it, and the
  activity-family work does not make it reachable. It remains unowned in this series.
- **The refusal wording is now "not yet" wording.** Any later phase that re-reads these sentences should keep it
  that way until PG-6h actually ships the regime, and then delete the scenario rather than soften it further.

## Counts

Before (measured at `9ff88de`, the PG-6a handoff): 105 files / 1589 unit tests · e2e 77 (73 functional + 4 axe).
After this task: **109 files / 1617 unit tests · e2e 83 (79 functional + 4 axe)**. Four new unit files
(`src/domain/activityFamily.test.ts`, `src/data/dashboard.activityFamily.test.ts`,
`src/pages/Settings.activityFamily.test.tsx`, `src/pages/Onboarding.activityFamily.test.tsx`) and one new e2e spec
(`e2e/activity-family.spec.ts`, 6 tests).
