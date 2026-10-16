# PG-6h-2 — the accommodation facts: the room count is a category switch, not a threshold (B-82, B-83, B-84)

Brief: `docs/ai/briefs/41_pg6h2_accommodation_facts.md`. Facts consumed from: `docs/ai/phases/36_pg6b_activity_family.md`
(the activity-family rail this task copies) and `docs/ai/phases/37_pg6h1_art68x3_arithmetic.md` (the arithmetic this task
feeds, and does not touch).
Legal grounding read before writing: `docs/ai/research/39_caen_tourism_and_detection.md` in full, and D-CAZ-1, D-COM-1,
D-COM-2 and D-OCC-1 in `docs/ai/USER_DECISIONS.md` — D-COM-2 amends D-COM-1, and the amendment is why this task exists.

Written from this task's own diff. No line numbers are cited.

---

## What this task was

6h-1 built the art. 68^3 arithmetic and deliberately left the gross as an input. 6h-2 supplies the facts that decide
**whether a user is on that path at all**, and the one question the law cannot answer for us. It is a fact-supplying task:
three new declared profile facts, one migration step, one scenario entry, and no arithmetic.

The reason it is not a form task is the room count. CF art. 83 alin. (2) gives a „proprietar, uzufructuar sau alt deținător
legal” who lets **1–7 camere** in a personal dwelling to the *cedarea folosinței bunurilor* title, and art. 85 alin. (1)
treats that taxpayer as a category of its own; art. 83 alin. (4) moves the same person into a activitate independentă only
**„începând cu anul fiscal în care numărul camerelor … este de peste 7”**, and art. 68^3 alin. (12) is the route by which
that activity is measured on the flat ratio. So 3 rooms and 9 rooms are not two magnitudes of one calculation — they are
two titles, and the flat-ratio arithmetic PG-6h-1 built belongs to the second one only. A model that treated the count as a
number feeding a formula would have applied one title's rules to the other title's taxpayer.

D-COM-2 is the other half of why this exists. D-COM-1 had assumed a tourism CAEN code would trigger the commission
question; `research/39` §1 established that the trigger cannot reach the likeliest affected user — a natural person letting
1–7 rooms has no registered business activity, therefore no CAEN code at all. The trigger is now the **declared
`activityFamily` plus the room count**, with CAEN demoted to an additional prompt that may never be the only trigger and
may never supply an answer.

---

## The three facts, and where they live

All three are on `PfaProfile` in `src/domain/models.ts`, all optional, none with a default anywhere:

| field | type | what it decides |
|---|---|---|
| `accommodationRoomCounts` | `AccommodationRoomCountYear[]` — `{ fiscalYear, rooms }` | **which income title** the receipts fall under |
| `accommodationCommissionReading` | `'reading_a' \| 'reading_b'` | what the gross contains (B-80) |
| `accommodationTourismEligibility` | `PfaYesNo` | whether the art. 68^3 alin. (1) gate is asserted to hold |

Four properties, each asserted somewhere:

- **Asked, never inferred.** Nothing derives any of them from `identity.caen`, from a revenue amount, from the expense
  categories or from a seed value. `src/domain/accommodationFacts.test.ts` pins that a profile carrying a Division 55 code
  and no answers still has all three fields absent and still resolves to no title.
- **Absence is the third state.** `src/domain/schema.ts` persists them as `.optional()` with no `.default()`;
  `migrateAccommodationFactsV13` writes nothing; `Settings.tsx` writes `undefined` for an empty field; `Onboarding.tsx`
  writes nothing at all. `src/data/dashboard.accommodation.test.ts` and `src/pages/Settings.accommodation.test.tsx` both
  assert the unanswered state directly, not just the answered ones — acceptance 1's requirement.
- **Per year, deliberately.** The count is an array keyed by `fiscalYear`, copied from the `PensionReceiptYear` /
  `ForeignSicknessInsurance` pattern already in `models.ts`, because art. 83 alin. (4) speaks per fiscal year. One scalar
  could not represent a taxpayer who crosses 7 rooms in 2027.
- **`activityFamily` and the room count are not the same fact.** A profile can be `cazare` with an unknown count: the app
  then knows the family and not the title. `src/data/dashboard.accommodation.test.ts` pins the converse too — a profile
  with a room count and no declared family is `incomplete`, not `cazare`, because reading the count as the family would be
  an inference.

### The category decision, in one place

`accommodationIncomeTitleForYear(years, fiscalYear)` in `src/domain/models.ts` is the only place
`ACCOMMODATION_ROOM_COUNT_BOUNDARY` is compared. It returns `'cedarea_folosintei'`, `'activitate_independenta_68x3'`, or
`null` when the count is not recorded for that year. `null` is not a default in either direction: reading it as
`cedarea_folosintei` would apply art. 85 to a taxpayer art. 83 alin. (4) has already moved, and reading it as
`activitate_independenta_68x3` would apply art. 68^3 to a taxpayer art. 83 alin. (2) puts elsewhere.

Both the scenario registry and the Settings screen call that one function, so the refusal and the form cannot state
different titles for one profile. `accommodationRoomCountForYear` and `withAccommodationRoomCount` are the reader and the
per-year editor — the latter because a plain `[{ fiscalYear, rooms }]` write from the form would silently erase the counts
recorded for other years.

**The two sevens stay apart.** `ACCOMMODATION_ROOM_COUNT_BOUNDARY` is art. 83 alin. (4)'s „peste 7 camere”. Ordin ANT
65/2013 alin. (12) caps a natural person's right to *request tourism classification* at „7 camere/14 locuri”. Different
authors, different purposes, different consequences; `research/39` §3 is the source, and the constant's comment and the
Settings hint both say the two are not the same rule. The boundary test asserts 7 → cedarea and 8 → art. 68^3.

### The CAEN list is the app's own choice, and it is labelled as one

`TOURISM_CAEN_CLASSES` in `src/domain/models.ts` is CAEN **Rev. 3**'s five Division 55 classes — 5510, 5520, 5530, **5540**,
5590 — with `caveat` strings annotating the two false positives: **5540 is intermediation, not accommodation** (a Division
55 code with no bed), and **5590 is not necessarily tourism** (lets shorter than a year). Rev. 2 had four classes, so a
list copied from a Rev. 2 source is silently one short; `src/domain/accommodationFacts.test.ts` pins the five.

Its own comment states, and `accommodationCaenPromptHint` in `src/ui/copy/settings.ts` says out loud on screen, that this
list is **this app's normative choice, not a rule of Romanian law**: HG 656/1997 art. 4 alin. (1) says classification into
a CAEN entity „nu presupune crearea de drepturi sau obligații”, alin. (2) puts administrative use of CAEN on the institution
doing it, and `research/39` §3 records that **no official mapping from „tip de structură de primire turistică” to CAEN
codes exists in any source retrieved**. `profileHasTourismCaen` is read in exactly one place — whether the Settings block
is shown — and it answers nothing.

---

## The migration step: v12 → v13, `accommodation-facts`

The head was confirmed in-tree before choosing the number: `DATA_VERSION_ACTIVITY_FAMILY = 12`. The new step is
`DATA_VERSION_ACCOMMODATION_FACTS = 13`, `migrateAccommodationFactsV13`, appended to `MIGRATION_CHAIN`; `CURRENT_DATA_VERSION`
now points at 13. No step was renumbered, reordered or deleted.

The step's entire content is that it **backfills nothing**:

```ts
export function migrateAccommodationFactsV13(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_ACCOMMODATION_FACTS };
}
```

The forbidden version is `accommodationRoomCounts: [{ fiscalYear: profile.fiscalYear, rooms: 1 }]`. For this field that is
not a convenience default, it is a legal assertion: the count picks the title, so a migrated payload given a number was
given a tax category it never claimed. The same argument covers the other two — a default commission reading would close
B-80, which two live readings and no primary source leave open, and a default eligibility answer would decide a tourism-law
classification the Codul fiscal does not decide.

`src/data/store.migration.chain.test.tsx` asserts the absence of all three keys on the migrated payload, that a declared
count passes through untouched, and that the step is idempotent-safe (a payload already at 13 applies no step and comes
back byte-equal). `e2e/settings.spec.ts` asserts the same absence on the store's own written bytes.

---

## The scenario wiring — one new entry, one re-premised entry

`SCENARIO_SUPPORT` in `src/domain/scenarios.ts` gained exactly one entry:

- **`accommodation-title-cedarea-folosintei`** (`effect: 'refuse'`, `message: 'accommodationTitleCedareaFolosintei'`,
  `fixTarget: { page: 'settings', tab: 'fiscal' }`). It fires when the resolved title is `cedarea_folosintei`. It reads the
  resolved title and compares nothing — not the count, not the boundary, not the CAEN list, not the amounts.

`accommodation-gross-undetermined` was **not deleted and not duplicated — it was narrowed**. It now returns null when the
title is `cedarea_folosintei`, because that register's problem is not an unsettled gross, it is a different title; leaving
both firing would put two refusals on one page and make the reader guess which one the app means. Its detail is now built
by `openAccommodationQuestions`, which shows only the rule questions the person has not answered:

| state | what the refusal shows |
|---|---|
| count unrecorded | both rule questions — the title itself is undecided, so neither can be retired |
| count > 7, commission unanswered, eligibility unanswered | both |
| count > 7, commission answered | only the alin. (1) eligibility question |
| count > 7, eligibility answered | only the alin. (3) gross-scope question |
| count > 7, both answered | nothing — the framing sentence alone |

That selection **is** what "apply the answer" means for a question the app is not entitled to settle: a recorded answer
retires its own question, and the answer never manufactures a figure. The rule's words stay the only producer —
`accommodationOpenQuestions` in `src/domain/estimateBasis.ts` lifts them from `ACCOMMODATION_68X3_2026` verbatim, and the
result is now keyed (`AccommodationOpenQuestions = { grossScope, eligibility }`) rather than positional, because "drop the
second array element" is not the same instruction as "drop the gross-scope question" and the rule's parameter order is not
a contract anyone declared.

`ScenarioFacts` gained three members — `accommodationIncomeTitle`, `accommodationCommissionReading`,
`accommodationTourismEligibility` — all threaded from the profile at the one `evaluateScenarios` call in
`selectEstimateOperands`. `accommodationIncomeTitle` distinguishes `undefined` (the assembler supplied nothing) from `null`
(the assembler answered, and the answer is "no count recorded for this year").

---

## The finding that changes the handoff: answering everything still refuses

`docs/ai/phases/37_pg6h1_art68x3_arithmetic.md` handed forward the expectation that "the refusal must then stop firing for
a taxpayer who has answered". **It does not, and making it stop would have produced a wrong number.**

The reason is visible in the diff and was verified by reading, not inferred. For a `cazare` register,
`selectDeductibleExpenses` in `src/domain/estimateBasis.ts` returns an **empty expense set plus a classifier refusal**
(`EXPENSE_ENGINE_CAZARE_2026`, `treatment: 'no_expense_engine'`). If the scenario stopped firing, `selectEstimateOperands`
would hand the engine both legs over the same receipts: the sistem-real leg would measure the register's revenue with zero
deductions, and the flat-ratio leg would measure 70 % of that same revenue. `computeTaxEstimate` in `src/domain/tax.ts`
would then cumulate them (`cumulatedNet = vnaSistemReal + flatNet`, i.e. 1.7 × revenue) for CAS and CASS **and** emit an
art. 118-style sistem-real income tax alongside the ring-fenced art. 68^3 tax. That is a confident double-counted figure —
the exact defect class this whole series exists to remove.

Separating the two legs means changing `domain/tax.ts` and the operands it is fed. This brief forbids both: acceptance 8
requires `git diff --stat` to show no change under `domain/fiscal/`, and `estimateBasis.ts` is threading only. So the
answered case keeps refusing, with the framing sentence in `src/ui/copy/scenarios.ts` now saying why — that the only
register-level calculation this app runs is the effective-expense one, and that the flat ratio beside it would measure the
same receipts twice. That is stated rather than discovered by the reader when the answers change nothing.

**This is the top item for the next task in this area.** The facts are in place; what is missing is a calculation path that
runs one leg, not two.

---

## Surfaces

- **Settings, fiscal tab** (`src/pages/Settings.tsx`): a block with three controls — `set-accommodation-rooms` (a number
  input, empty = unrecorded), `set-accommodation-eligibility` and `set-accommodation-commission` (three-state selects),
  plus `data-accommodation-title`, `data-accommodation-commission-applied` and `data-accommodation-caen-prompt`. The block
  is shown when the declared family is `cazare` **or** the profile carries a Division 55 code — the declared family is the
  primary trigger and the code only ever adds to it, which is D-COM-2 in one line of code. The title line follows the form
  so the person sees which title a number would put them under before saving, and it has a third branch for the unknown
  state. The commission line names the reading applied **and the alternative**, as D-COM-1 requires.
- **Onboarding** (`src/pages/Onboarding.tsx`): a card with the same three questions, shown when the family question is
  answered `cazare`, writing under the fiscal year the form is being filled for. An unanswered question writes nothing.
- **Dashboard**: no new surface. The refusal block PG-6a built renders the new scenario; the framing sentence and the
  cedarea sentence live once each in `src/ui/copy/scenarios.ts`.

No fiscal value, no rate and no legal conclusion was added to any component.

---

## Acceptance evidence

1. **Unknown stays unknown.** A cazare profile with no room count is `review_required`, the badge is „Nu putem calcula”,
   both rule questions are still shown, and `accommodation-title-cedarea-folosintei` does **not** fire. Proven in the
   domain (`src/domain/accommodationScenarios.test.ts`), at the view-model seam
   (`src/data/dashboard.accommodation.test.ts`) and in a browser (`e2e/accommodation-facts.spec.ts`).
2. **1–7 → cedarea folosinței; >7 → art. 68^3, and the UI says which.** 3 rooms refuses on the title and the block states
   *cedarea folosinței bunurilor* with art. 83 alin. (2) and art. 85 cited; 9 rooms refuses on the gross instead. Settings
   shows the same title line, with the articles, in both cases and in the unknown case.
3. **Per year.** `src/domain/accommodationFacts.test.ts` asserts 2026 with 5 rooms → cedarea and 2027 with 9 rooms →
   art. 68^3, one test per year, plus a crossing-year pair. `src/data/dashboard.accommodation.test.ts` and
   `e2e/accommodation-facts.spec.ts` assert that a count recorded for a year the profile does not declare decides nothing
   for the year it does.
4. **The commission answer is the user's choice, shown with the alternative.** `src/pages/Settings.accommodation.test.tsx`
   and `e2e/accommodation-facts.spec.ts` both assert the stored value survives a reload and that the applied line names the
   other reading. A grep for `reading_a` / `reading_b` across `src/` shows only: the type, the `.optional()` schema entry,
   the form's `?? ''` read and `|| undefined` write, the copy labels, a doc comment in `src/data/migration.ts` naming the
   forbidden default, and test assertions. **No default anywhere**, and the migration comment records the forbidden form.
5. **CAEN prompts, never answers.** A Division 55 code with no answers leaves all three facts absent and the title unknown;
   the same profile with and without the code produces identical scenario outcomes; in a browser a `other` + 5510 profile
   computes and an unanswered + 5590 profile is `incomplete`, never refused for its code.
6. **The list is labelled as the app's own choice** and cites HG 656/1997 art. 4 alin. (1)-(2) both in code and on screen;
   it is Rev. 3's five classes with 5540 and 5590 annotated.
7. **The migration adds a step and backfills nothing.** Every test that moved moved because the chain grew; each is listed
   below, old → new.
8. **No arithmetic file changed.** `git diff --stat` lists 16 files and **none of them is under `src/domain/fiscal/`**.
9. `tsc` 0 · **114 files / 1705 unit tests** · `build` 0 · **e2e 95 passed (91 functional + 4 axe)** · copy-guard
   `ALLOW_LIST` still empty · the wall-clock guard passes · **the seed estimate is still 311.200 bani (3.112 lei)**, asserted
   with the new fields absent and again with all three filled in on a profile that does not use them. Seed completeness is
   unchanged at 7 din 9 verificări, 100 % weighted — the demo profile declares `other`, so no accommodation scenario fires
   for it.

---

## Tests that moved, before → after

Every one of these moved because the chain grew by one step or because a copy sentence was reworded. **No fiscal figure
moved anywhere.**

| file | before | after | why |
|---|---|---|---|
| `src/data/store.migration.chain.test.tsx` | chain edges end at `[DATA_VERSION_ANNUAL_FILING, DATA_VERSION_ACTIVITY_FAMILY]`; `CURRENT_DATA_VERSION` = `DATA_VERSION_ACTIVITY_FAMILY`; every `stepsApplied` list ends at `'activity-family'` | edge `[DATA_VERSION_ACTIVITY_FAMILY, DATA_VERSION_ACCOMMODATION_FACTS]` added; current = `DATA_VERSION_ACCOMMODATION_FACTS`; every list gains `'accommodation-facts'` | one more step, appended |
| `src/data/store.migration.chain.test.tsx` | — | +1 test: the v13 step backfills nothing (all three keys absent), a declared count passes through, and re-running at 13 applies no step | the step's whole contract |
| `src/data/migration.currency.test.ts` | `CURRENT_DATA_VERSION` = v12; `record-currency` at `length - 3`; v9 → `[…, 'activity-family']`; v10 → `['annual-filing', 'activity-family']` | v13; `length - 4`; `+ 'accommodation-facts'` in both | the money guard's re-pin discipline; the guarded property — no amount moves — is intact |
| `src/data/store.taxReserve.test.tsx` | reserve load applies six steps | seven | same |
| `e2e/settings.spec.ts` | `saved.version` = 12 | 13, plus three new byte-level assertions that none of the accommodation keys is present on a migrated legacy profile | the save effect stamps the version this build writes |
| `e2e/activity-family.spec.ts` | framing sentence asserted to contain `nu alege în locul tău` | asserts it contains `Niciunul nu se completează din codul CAEN` and `câte camere închiriezi pe termen scurt` | the sentence was reworded (replaced, not deleted): it now names the room count as one of the three answers and states the stronger version of the same guarantee |
| `src/domain/scenarios.routes.test.ts` | one route test per registered scenario (4 + 1) | 5 + 1 | the file builds a test per entry in `SCENARIO_SUPPORT`; the new entry is covered automatically |

No test was deleted.

Four new unit files — `src/domain/accommodationFacts.test.ts` (16), `src/domain/accommodationScenarios.test.ts` (16),
`src/data/dashboard.accommodation.test.ts` (11), `src/pages/Settings.accommodation.test.tsx` (15) — and one new e2e spec,
`e2e/accommodation-facts.spec.ts` (12 tests).

---

## Deviations from the brief, and why

Six, all inside the spirit of the "may touch" list except where noted.

1. **`src/domain/schema.ts`, not `src/data/schema.ts`.** The brief's boundary names `data/schema.ts`, but the persisted
   profile shape lives in `domain/schema.ts` (`pfaProfileSchema`); `data/schema.ts` validates the profile through
   `z.custom` → `parsePfaProfile` and needed no change. `docs/ai/phases/36_pg6b_activity_family.md` says the enum is
   persisted in `src/data/schema.ts` — that is not where it lives, and this task followed the tree rather than the doc.
2. **`accommodationOpenQuestions` changed shape**, from a positional `string[]` to the keyed `AccommodationOpenQuestions`.
   The registry now retires the *answered* question, and retiring "index 1" is not the same instruction as retiring the
   gross-scope question. `estimateBasis.ts` is otherwise threading only: three new lines in the one `evaluateScenarios`
   call, no formula touched.
3. **`domain/models.ts` gained five small pure functions** — `accommodationRoomCountForYear`,
   `accommodationIncomeTitleForYear`, `withAccommodationRoomCount`, `profileHasTourismCaen`, and the
   `TOURISM_CAEN_CLASSES` list. The file was types-only before. The reason is the one-boundary requirement: the art. 83
   alin. (4) comparison must exist in exactly one place, and the natural home (the rule layer) is off-limits to this task.
4. **`ACCOMMODATION_ROOM_COUNT_BOUNDARY = 7` lives in `domain/models.ts`, not in the rule store.** Acceptance 8 forbids any
   change under `domain/fiscal/`. It carries its citation and an explicit note that it is not Ordin 65/2013 alin. (12)'s
   classification ceiling, and it is used only to choose a title — never as an arithmetic input.
5. **The answered case still refuses** — see the section above. This is the deviation the next task needs to see first.
6. **No new scenario entry for the answered-but-uncomputable case.** It reuses `accommodation-gross-undetermined` with a
   null detail rather than adding a second entry, because the brief allows one entry and a second refusal for the same
   register would be the two-producers defect this project already treats as a bug class.

**Scout reports (§12.12).** Scout A (the `activityFamily` fact path) and Scout B (every place the app branches on an income
category) were each checked against the tree before acting: every file and identifier either one named resolves in the
tree, so neither report was untrusted and no territory had to be covered by hand. Scout A's two premise corrections — that
the zod profile shape lives in `domain/schema.ts`, and that `ScenarioFacts` is built only in
`estimateBasis.ts selectEstimateOperands` — were confirmed by reading and are reflected above. No deviation to record.

---

## What is still not modelled — this is not finished work

- **The 68^3 path still produces no figure from stored data**, for the reason given above: the register-level calculation
  is single-legged and the two legs would double-count. The facts are now in place for a task that may touch
  `domain/tax.ts`.
- **The 1–7 room case is not computed either.** D-CAZ-1 path (c) — that the 1–7 room taxpayer is *also* on a 30 % flat
  expense basis from 2026, under **art. 85 alin. (1)-(2)** rather than art. 68^3 — is a separate rule with a separate
  citation, and no art. 85 rule exists in the FY2026 package. Refusing and naming the title is the honest answer until one
  does.
- **B-80 is still open as a question, not closed as a value.** The commission reading is stored and shown; it changes which
  question the refusal asks, not what the gross is, because the app holds no commission amount per receipt.
- **The alin. (1) eligibility answer is the person's statement, never verified.** The app cannot see the tourism register,
  and `research/39` §2 leaves whether classification is even mandatory for an unregistered natural person unresolved.
- **No D212 cell map (B-81).** OPANAF 2736/2025 has no 68^3 subsection and still cites the abrogated OPANAF 398/2021.
- **FY2027 still yields no 68^3 figure.** With no rule package, `flatRatioMethodAvailable` is false and `no-expense-engine`
  is the truthful stop; the room-count facts do not manufacture a rule for a year that has none.

---

## Handoff for 6h-3 (the occupancy sheet, D-OCC-1)

**What the app now knows about a user's accommodation situation** — all of it declared, none of it inferred, none of it
backfilled:

| fact | where | shape |
|---|---|---|
| the activity family | `profile.activityFamily` | `'other' \| 'cazare'`, optional, migrated at v12 |
| how many rooms, **per fiscal year** | `profile.accommodationRoomCounts` | `{ fiscalYear, rooms }[]`, optional, migrated at v13 |
| which reading of art. 68^3 alin. (3) they chose | `profile.accommodationCommissionReading` | `'reading_a' \| 'reading_b'`, optional |
| whether they say they are a tourism-sector operator | `profile.accommodationTourismEligibility` | `'da' \| 'nu'`, optional |
| the income title that follows from the count | `accommodationIncomeTitleForYear` | cedarea folosinței / activitate independentă / unknown |

**What it still does not know**, and what 6h-3 must not assume it knows:

- **Whether the rooms are in a personal dwelling.** That distinction is what art. 68^3 alin. (3) turns on, and nothing in
  the profile records it. The eligibility answer's `nu` option hints at it and is not the same fact.
- **Whether the structure is actually classified.** The eligibility answer is a statement, not a verification; the app has
  no path to the MEDAT registers or to SITUR.
- **Anything about occupancy.** No stays, no nights, no per-room day counts, no guest identity data. The room count is a
  declared annual figure and **must not be used as an occupancy record** — it is the fact that picks a tax title, and the
  fișa de ocupare a capacității de cazare (OPANAF 381/2026, art. 85 alin. (8)-(9)) is a per-stay document.
- **Any commission amount per receipt**, which is why the commission reading cannot yet change the gross.
- **The number of dwellings versus rooms.** art. 83 alin. (2) counts rooms „situate în locuințe proprietate personală,
  indiferent de numărul de locuințe"; the profile records only the room count.

Two constraints to carry forward from D-OCC-1: the sheet is a store of **third-party personal data** with no ANAF filing
that requires the app to hold it, so it is local-only with no network path, no export default and no guest data or real CNP
in any fixture. And the year scoping the sheet will want already exists — `fiscalYear`-keyed records on the profile — so the
occupancy data should follow the same pattern rather than invent a second one.

**B-79 (`closed_final`) is still declared and still produced by nobody.** This task did not touch it, and the
accommodation facts do not make it reachable. It remains unowned in this series.

---

## Counts

| | before (`5323e18`) | after |
|---|---|---|
| `tsc --noEmit` | 0 | 0 |
| unit test files | 110 | 114 |
| unit tests | 1645 | 1705 |
| `npm run build` | 0 | 0 |
| e2e (functional + axe) | 83 (79 + 4) | 95 (91 + 4) |
| copy-guard `ALLOW_LIST` | empty | empty |
| wall-clock guard | passes | passes |
| seed estimate | 311.200 bani (3.112 lei) | **unchanged** |
| seed completeness | 7/9, 100 % weighted | unchanged |
| data version head | 12 | 13 |
| files changed under `src/domain/fiscal/` | — | **0** |
