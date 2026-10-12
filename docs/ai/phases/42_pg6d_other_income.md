# PG-6d — the art. 155 alin. (1) lit. c)-h) ladder, per fiscal year (D-OTH-1, D-OTH-2, D-LEG-1, B-41)

The app used to ask a person to tick five boxes: `imobiliare`, `autovehicule`, `dividende`, `concesiune`,
`alte`. `research/41` §5 established that those five are not the six categories of CF art. 155 alin. (1) lit.
c)-h): three of the six were missing altogether, `concesiune` has no referent anywhere in the Cod fiscal, and
`alte` is wider than art. 114. A sum built over that vocabulary would have been wrong in both directions —
missing inputs, and inputs that never attract CASS. So the flags were **removed, not extended** (D-LEG-1:
there are no users, so legacy vocabulary is cleaned rather than preserved), and what replaced them is
**six amounts per fiscal year plus the two facts that decide whether an amount belongs in the basin at all**.

The arithmetic that the flags could never drive is now in the engine: a cliff, one base per person, a
condition precedent below 6 SM, and a refusal wherever the answer set is incomplete.

## Baseline and result

Baseline measured at `6269d5c`: `tsc` 0 · 121 files / 1817 unit tests · `build` 0 · e2e 108 · copy-guard
`ALLOW_LIST` empty · seed estimate 311.200 bani.

Result at this commit: `tsc` 0 · **123 files / 1842 unit tests** · `build` 0 · **e2e 112** (107 functional +
5 axe) · copy-guard `ALLOW_LIST` still empty · **seed estimate still 311.200 bani** · PG-5C enforcement
still green.

## What was built

### The record — `src/domain/models.ts`

`CassLadderCategory` is the six-member union of the litera, and `CASS_LADDER_CATEGORIES` fixes their order —
the order art. 155 alin. (1) lists them, which is also the order the form renders them. `CassLadderYear` is
one declared fact-set for one fiscal year: six optional `Bani` amounts, the two measurement selectors
(`activitatiAgricoleBaza`, `investitiiBaza`), the two letter-deciding facts (`cedareaSursa`,
`alteSurseArt114`), the non-cumulating `neimpozabil` and the credited `cassRetinutLaSursa`. Every amount is
optional, and **absent means unanswered, not zero** — that distinction is the whole of B-41, and it is a
type-level property, not a convention.

`CASS_LADDER_CATEGORY_NAMES` carries the Romanian name of each category beside its identifier, so a refusal
can name the gap in the language the person reads. `cassLadderForYear` and `withCassLadderYear` read and
merge a year without touching the others, following the pattern already set by `AccommodationRoomCountYear`
and `PensionReceiptYear`.

The three measurement option sets (`CASS_AGRI_BAZA_VALUES`, `CASS_INVEST_BAZA_VALUES`,
`CASS_CEDARE_SURSA_VALUES`) are exported from here rather than spelled out in the page, so the type and the
`<option>` list cannot drift, and so the copy guard finds no enum literal on a surface.

Retired: `PfaOtherIncomeFlag` and the `otherIncome` member of `PfaProfile`.

### The gate — `src/domain/schema.ts`

The `otherIncome` array is **removed from the schema, not deprecated**: no tolerated value, no empty-array
default. The `cassLadderYears` array is added with the per-year shape the model declares.

### The chain step — `src/data/migration.ts`

`DATA_VERSION_OTHER_INCOME_LADDER = 16`, appended after `DATA_VERSION_VEHICLE_FACTS`; `CURRENT_DATA_VERSION`
moves to it. The step `other-income-ladder` does exactly two things:

- it **deletes** `profile.otherIncome` from a stored payload — not emptied, not renamed, deleted;
- it opens the per-year slot and **backfills nothing**.

The second half is the part that could have been a defect. Six invented zeros would have moved a stored
person between "no CASS at all" and a base of 6, 12 or 24 minimum wages, which is precisely the defect this
phase closes; and no tick could have been converted into an amount, because a tick says a source exists and
art. 170 alin. (4) compares amounts to minimum wages. The step's own `description` text says both, in
Romanian, in the migration report the person can read.

### The threading — `src/domain/derived.ts` and `src/domain/tax.ts`

`TaxInputs` carries `cassLadderYears`, materialised from the profile and sorted by year. `computeTaxEstimate`
reads the year matching `inputs.fiscalYear` and, when one exists, calls `calculatorRegistry['calc-cass-ladder']`
with a `cassLadder` input built field by field — no spread of the whole record, so a new model field cannot
silently become an engine input. A refusal from the ladder aborts the composition with the reason and the
partial lines, exactly as the other refusals do.

The base the ladder chose travels back as `determinedNet` and is published as
`bases.bazaDeCalculCassArt155LitCH`, because the art. 174 alin. (7) lit. b) test compares **that** number to
6 SM; recomputing it at the call site would be a second calculation of a legal figure, free to disagree with
the number printed beside it.

### The constants — `src/domain/fiscal/package2026.ts`

Three new parameters on the existing `CASS_2026` rule, each with its citation: `ladder_tier2_base` (12 SM =
48.600 lei) and `ladder_tier3_base` (24 SM = 97.200 lei), plus `ladder_condition_precedent`, the sentence
the breakdown quotes when alin. (2) is not satisfied. **Rung 1 is the existing `min_base`** — 24.300 lei was
already on this rule, and duplicating it as a second "6 SM" parameter is the drift this file's own history
records (Phase 4 deleted `min_cass`/`max_cass`, Phase 5 deleted `multiple_6x`…`multiple_72x` for exactly that
reason). No existing value, label or citation moved, and `immutability.test.ts` still passes.

**Deviation from the brief, recorded:** the brief expected new registry entries in `domain/fiscal/rules.ts`.
There are none. The ladder is not a second contribution and does not get a second rule: art. 174¹ alin. (1)
applies „cota de 10 % … la baza anuală de calcul menționată la art. 170 alin. (3)", i.e. the same rate
already registered on `CASS_2026`, on a different base. The new calculator is therefore dispatched
explicitly from `tax.ts` rather than reached through a rule's `calculatorId`, and the constants live on the
rule that already owns the rate and the 6 SM anchor.

### The calculator — `src/domain/fiscal/calculators.ts`

`calcCassLadder`, registered as `calc-cass-ladder`, kept separate from `calcCass` because the two tracks are
different provisions: art. 170 alin. (1) makes the lit. b) net the base, floored at 6 SM by art. 174 alin. (6)
and capped at 72 SM; art. 170 alin. (2)-(4) only lets the cumulated lit. c)-h) amount **select** one of three
bases, with no floor and no cap. Four refusals and one computation:

- **partial answer set** → refuses, counts the gap, and names each missing category in Romanian. The sum at
  alin. (4) runs over all six, so one blank makes the sum unknown, not smaller.
- **nothing declared** → refuses, and says explicitly that this is not a claim the person had no such income.
- **`alte_surse` without the art. 114 answer** → refuses to cumulate it. Art. 61 lit. g) *premii și jocuri de
  noroc* and lit. h) *transferul proprietăților imobiliare* appear nowhere in art. 155 alin. (1) and never
  attract CASS, so an unqualified "other" manufactures a liability.
- **letting declared as the PFA's own activity** → refuses. Art. 83 alin. (1) expressly excludes income from
  an independent activity, so those receipts are art. 67 alin. (1) — lit. b) — and travel the other
  contribution path. This is the fact D-OTH-2 asked to be asked instead of a `concesiune` tick.
- **the cliff** → `cumulated < 6 SM` gives base 0; `< 12 SM` gives 6 SM; `< 24 SM` gives 12 SM; at or above
  24 SM gives 24 SM. Inclusive at each lower bound, one rounding at the end via the existing `roundArt66`.

Two further behaviours are reported rather than resolved. Where the measured cumulation is under 6 SM but the
realised income — counting the art. 93 / art. 105 neimpozabile amounts that art. 170 alin. (5) excludes —
reaches it, the two readings of art. 174 alin. (7) lit. b) part, and the result carries a
`readingDivergence` naming both instead of picking one; everywhere they converge, nothing is reported. And a
declared `cassRetinutLaSursa` beside a computed contribution refuses outright: art. 174¹ alin. (6) makes it a
deduction (rd. 6 of DU subsecțiunea 2.2), this build does not model the deduction, and charging both halves
would bill the same contribution twice.

The breakdown states the rung, the six category amounts, the single base, and — in words — that the 72 SM cap
does not reach this basin and that the PFA's own net never enters the 6/12/24 test.

### The surfaces — `src/pages/Settings.tsx` and `src/pages/Onboarding.tsx`

`Settings.tsx` gains the ladder section on the fiscal tab: the six amount inputs (rendered from
`LADDER_AMOUNT_FIELDS`, so the form's order is the law's order and a category cannot be dropped from the
form without being dropped from the list), the two measurement selects, the two letter-deciding selects, the
neimpozabil and the withheld-CASS fields, and a live note that counts the six and names what is still open.
Nothing is pre-filled: an empty box writes absence, a typed `0` writes a declared zero, and an unparseable
amount is an error rather than a silently dropped input. The year is replaced rather than merged, so editing
2026 cannot erase a year held for 2027, and clearing every box makes that year unanswered again.

The form deliberately does **not** demand all six. A partial answer set is a state a person may genuinely be
in; it is the engine that refuses to sum it, on the calculation screen, with the missing categories named.

`Onboarding.tsx` loses `OTHER_INCOME_KEYS` and the five checkboxes. What remains is a card that says what the
law asks — an amount per category, per year, in Settings — and says out loud that the app does not ask it
here and does not fill it in.

### The copy — `src/ui/copy/settings.ts` and `src/ui/copy/onboarding.ts`

The `ladder*` keys carry the measurement rule for each category (net for four, **brut** for „alte surse",
net **or** normă for agriculture where the normă alone survives), the deletion of the rental normă by Legea
239/2025 art. XII pct. 19, the dividend formula „dividendele plătite, diminuate cu impozitul reținut", the
art. 114 constraint on „alte surse", the art. 170 alin. (5) treatment of neimpozabile amounts, and the
statement that a blank category is not a zero. The retired `otherIncome` label and `otherIncomeOptions` keys
are gone.

## Acceptance evidence

1. **Six per-year amounts, one per litera, no defaults, no backfill** — `CassLadderYear` in
   `src/domain/models.ts`; the v16 step backfills nothing; `e2e/cass-ladder.spec.ts` shows six empty inputs on
   a seeded profile.
2. **An unanswered category makes the ladder unknown** — `cassLadder.test.ts`: five answered and one blank
   refuses and names the gap; the same holds for five gaps. `tax.cassLadder.test.ts` shows the whole
   composition stopping, and `e2e/cass-ladder.spec.ts` shows it on the dashboard.
3. **Below 6 SM: no CASS at all** — value 0 and base 0, with `ladder_condition_precedent` quoted in the
   breakdown.
4. **The cliff is exact at 24.300 / 48.600 / 97.200, inclusive at the lower bound** — boundary tests at
   24.299/24.300, 48.599/48.600, 97.199/97.200, each asserting base **and** contribution.
5. **One base per person** — three categories answered produce one total, one base and one contribution; the
   breakdown is asserted to contain exactly one base line and one contribution line.
6. **lit. b) never enters the ladder; the ladder never enters the 72 SM cap** — `tax.cassLadder.test.ts`
   runs the real composition in both directions: adding 60.000 lei of lit. c)-h) income leaves the CAS and
   CASS lines and the activity net untouched, and doubling the register (91.000 → 182.000 net, which moves
   CAS) leaves the ladder line and the ladder base identical. A 400.000 lei cumulation stays on the 24 SM
   rung, above where a 72 SM cap would have bitten.
7. **`PfaOtherIncomeFlag` is gone** — a grep for `PfaOtherIncomeFlag`, `OTHER_INCOME_KEYS` and
   `otherIncome:` over `src` and `e2e` returns only the migration's own deletion (`const { otherIncome:
   _dropped, ...profile }`) and prose in comments and in the migration description. The e2e fixtures that
   carried `otherIncome: []` no longer do.
8. **A divergent alin. (7) lit. b) case refuses to choose; a convergent one computes** — the divergence test
   asserts both `Citește A` and `Citește B` are present; the convergence test asserts no divergence is
   reported.
9. **No CAEN inference anywhere** — the ladder path (`models.ts` ladder block, `calcCassLadder`,
   `tax.cassLadder.test.ts`) contains no CAEN reference; the categories attach to the person, and the only
   CAEN list in `models.ts` is the pre-existing tourism prompt, which answers nothing.
10. **Gates** — `tsc` 0 · 123 files / 1842 unit tests · `build` 0 · e2e 112 green including the 5 axe scans ·
    `ALLOW_LIST` empty · seed estimate 311.200 bani asserted in `dashboard.accommodation.test.ts` and
    `occupancy.privacy.test.tsx` · PG-5C enforcement asserted in `dashboard.test.ts` and
    `partialYear2026.test.ts`.

## Tests that moved, old → new

The migration chain is pinned by name and by version in four places, and each moved by one step — the
standing re-pin, never a deletion:

- `store.migration.chain.test.tsx` — every `stepsApplied` list gains `'other-income-ladder'`; the
  `[from, to]` table gains the v15→v16 pair; `CURRENT_DATA_VERSION` re-pinned to
  `DATA_VERSION_OTHER_INCOME_LADDER`.
- `migration.currency.test.ts` — the chain-length assertions move from "six steps above v10" to seven, and
  the head-of-chain pin from `DATA_VERSION_VEHICLE_FACTS` to `DATA_VERSION_OTHER_INCOME_LADDER`.
- `store.taxReserve.test.tsx`, `store.migration.test.ts`, `profile.test.ts`, `thresholds.test.ts`,
  `Onboarding.test.tsx` — fixtures lose `otherIncome`, and the language tests lose the retired copy keys.
- `e2e/settings.spec.ts` — the B-26 round-trip re-pins the written version 15 → 16, and the fixture now
  **carries** `otherIncome: ['imobiliare']` into a v4 payload so the new assertion that the written bytes
  carry no such key proves the deletion rather than the absence of an input.

New: `src/domain/fiscal/cassLadder.test.ts` (20 tests, the arithmetic and the refusals),
`src/domain/tax.cassLadder.test.ts` (5 tests, the two tracks kept apart through the real composition),
`e2e/cass-ladder.spec.ts` (4 tests, the facts reaching a person in a browser).

## Findings

- **The refusal had to be re-worded before it could be read.** The first version named the missing categories
  by their stored identifiers, which put `alte_surse` on a screen — an enum value posing as a sentence. The
  names now come from `CASS_LADDER_CATEGORY_NAMES`, one list shared by the engine's refusal and the form's
  labels.
- **The model follows the code's litera order; the DU form does not.** Art. 155 alin. (1) lists agricole
  (lit. f)) before investiții (lit. g)), while subsecțiunea 2.2 of the brochure numbers investiții at 1.4 and
  agricole at 1.5. The record and the form use the litera order. If a future task renders a DU-shaped
  worksheet, the two orders must be mapped explicitly rather than assumed identical.
- **A declared zero and an unanswered category are two different facts, and both directions had to be
  tested.** A build that refuses both is as wrong as one that defaults both, so `cassLadder.test.ts` pins
  six declared zeros computing to no CASS, and five answered plus one blank refusing.

## Recorded, not solved

- **The DU 212 structure rests on a mirror copy.** `research/41` §3 — the six per-category lines, the one
  cumulated total, the one set of three tick-boxes — was read from the completion instructions for form 212
  (Monitorul Oficial nr. 1207 bis, 29 Dec 2025) **via a mirror copy**. It should be re-read against the
  official copy when reachable. The arithmetic in this phase does not depend on the form's layout, but the
  claim that the form is "six lines feeding one total feeding one base" does.
- **Portal Legislativ was unreachable during the research pass.** The consolidation used was
  `legislatie.just.ro` document 171282 (whole-code search for „concesiune"), corroborated by per-article
  consolidated views dated 08.08.2026. `legislativ.ro` failed DNS.
- **Every `research/41` §7 unknown stayed unencoded**, specifically: the art. 174 alin. (6) floor against a
  pierdere fiscală or a net of 0 (art. 170 alin. (1) territory, untouched here); the shape of the FY2026 DU
  form and its 60-SM/72-SM footnote; **art. 154 alin. (1) exemptions**, which this phase deliberately does
  not model — an art. 154 question stays unanswered and is allowed to drive the divergence refusal rather
  than being resolved; whether neimpozabile amounts attach per category rather than per person (this build
  stores one `neimpozabil` figure per year and never adds it); whether a non-agricultural „concesiune" could
  be treated as arendă under art. 80 (no category was invented for it); and the reading of art. 174 alin. (7)
  lit. b), which is reported as a divergence wherever the two readings part.
- **CASS withheld at source is modelled as a fact, not as a credit.** `cassRetinutLaSursa` is stored and
  shown, and its presence beside a computed contribution is a refusal. Whoever implements the deduction of
  art. 174¹ alin. (6) replaces that refusal with arithmetic; nothing in this phase pretends the credit exists.
- **`/settings#!/fiscal` fails axe, and did so before this phase.** The tab was scanned because PG-6d added a
  form section to it. The scan returned critical `label` violations on controls PG-6d did not touch — the
  regime select, the CAEN input, the start-year and fiscal-year inputs, the establishment-date input and the
  two vehicle inputs, each a `<label>` with no `htmlFor` beside an `<input>` with no `id`. The new ladder
  fields carry explicit `htmlFor`/`id` pairs and are clean. The scan was **not** added to the gate, because
  that would have made the gate red on pre-existing debt; the loader and the reason are recorded in a comment
  in `e2e/a11y.spec.ts` so the tab does not stay unscanned by accident. Clearing that debt is a small,
  self-contained task of its own.

## What 6e inherits

The ladder contributes nothing to fixed assets, and one discipline: a per-year declared fact set keyed to
the person, with absence as a first-class state. `research/40` §4 already records the asymmetry 6e must
handle — depreciation is expressly per vehicle („pentru fiecare", 1.500 lei/lună for M1) with no one-car
limit, while only one car carries running costs — and the VAT-in-the-50 %-base question from PG-6c stays
surfaced for briefing rather than inherited silently.

## Handoff

Three commits: the six per-year facts with the flag retirement and the v16 step; the Settings collection of
those facts with the copy; the arithmetic tests, the browser spec and the refusal wording. The ladder is
fully wired: it computes where the law converges and refuses where it does not, and it never fills a gap with
a zero.
