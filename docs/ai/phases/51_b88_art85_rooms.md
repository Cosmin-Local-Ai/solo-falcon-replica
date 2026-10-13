# 51 — B-88: art. 85, închirierea pe termen scurt a 1–7 camere, and the third accommodation path

Written from my own diff. No line numbers, per §12.11.

## What was missing

A cazare register with a room count of 1–7 had no rule to be measured under. `domain/scenarios.ts` refused
it and said so — `accommodation-title-cedarea-folosintei` — and the sentence was true, because the FY2026
package carried a rule for art. 68^3 and none for art. 85. Art. 85 was wholly replaced by Legea 239/2025
art. XII pct. 10 from FY2026 incomes, and it gives this income its own forfetară determination: gross =
sumele **încasate în cursul anului fiscal**, cheltuieli forfetare 30 %, cota 10 % asupra netului, „impozitul
fiind final".

So this task added a rule, a calculator, a determination method, and the arithmetic consequences of that
method — and the interesting part was not the arithmetic. It was that the app already had **two** ways to
measure a cazare register, and adding a third is the kind of change that quietly breaks the invariant that
kept the first two apart.

## (a) The scope correction — the thing a future reader will get wrong

**The 30 % belongs to short-term letting of 1–7 camere într-o locuință proprietate personală, and to nothing
else.** Every other *cedarea folosinței bunurilor* income keeps the 20 % of art. 84 alin. (3) and art. 84^1
alin. (3), and Legea 239/2025 amended both of those alineate in the same act to carve this case out in
words. ANAF Cluj states the split explicitly.

The guard against getting this wrong is structural, not a comment. The ratio lives on
`ACCOMMODATION_ART85_ROOMS_2026`, whose `taxRegime` is the new string `'short-term-rooms-flat-ratio'`, and
the only calculator that reads it is `calcShortTermRoomsFlatRatio` in `domain/fiscal/calculators.ts`. The
test that proves the two ratios cannot cross is in `src/domain/art85.rooms.test.ts`: patching the
`expense_ratio` of `ACCOMMODATION_68X3_2026` leaves the art. 85 net at 70 % of gross, and patching the art.
85 ratio leaves the art. 68^3 net at 70 %. A shared parameter would have been invisible in the arithmetic
and visible only in the number.

The same file asserts that **no rule in the package supplies a 20 % expense ratio at all** — the app does
not compute ordinary *cedarea folosinței* today, which is the only reason the 30 % cannot leak into it. If a
cedarea rule is ever added, it must carry its own 20 %, its own `taxRegime` and its own calculator. That
sentence is in the test on purpose.

## The rule, and what it deliberately does not carry

`ACCOMMODATION_ART85_ROOMS_2026` in `src/domain/fiscal/package2026.ts` carries the ratio, the rate, the cash
basis of the gross, the FX basis, the no-proration rule, the room counts as a **title switch** (`unit:
'count'`, compared nowhere in the rule layer), the alin. (1) exclusion of persons under art. 68^3, the art.
83 alin. (3) definition of „pe termen scurt", where the net enters the contribution system, the 25 mai
filing and payment dates, and one open question.

Three things it does **not** carry, each recorded rather than dropped:

- **No SM multiple.** The 6 / 12 / 24-SM rungs this net touches are year-scoped on `CASS_2026`. A test
  asserts no parameter of this rule has `unit: 'lei'`.
- **No commission switch.** art. 85 alin. (3) excludes the retained commission from *gross*. Unlike art.
  68^3 alin. (3) — the same words in an article whose subject at alin. (1) is a tourism operator, which is
  why B-80 left it open — here the article's subject *is* the personal-dwelling letting, so the two readings
  collapse. It is encoded as a citation, and a test asserts the parameter's value is a string and that no
  parameter of this rule is a boolean. The app adds and subtracts no commission from the records.
- **No Registrul de evidență fiscală, no fișa de ocupare.** alin. (7)-(9) are obligations the app has no
  model for; ordinary *cedarea folosinței* carries no REF duty at all (art. 84 alin. (10)), so this is a real
  difference between the two titles and it is written in the rule's comment rather than silently omitted.

The one open question is `form_section_open_question`: the **term** is certain (art. 85 alin. (10) with art.
122 alin. (3) — 25 mai 2027 for FY2026), the **section of formularul 212** is not, because the model for the
FY2026 return has not been published. The app reports the date and does not invent the section.

## The arithmetic, and the three places it differs from art. 68^3

The two articles share a percentage and almost nothing else. `src/domain/art85.rooms.test.ts` works the
example by hand: 100.000 lei of receipts → net 70.000 → tax 7.000 lei final → CAS 0 → CASS 4.860 lei →
total 11.860 lei.

1. **Gross is cash basis** — „încasate în cursul anului fiscal" (alin. (2)) — while ordinary rent is the
   contract rent „indiferent de momentul încasării" (art. 84 alin. (1)-(2)). The app's existing ledger pass
   already measures receipts on collection with the BNR rate of the last banking day before each one, which
   is what alin. (4) asks for, so `selectAccommodationGross` in `src/domain/estimateBasis.ts` is **reused,
   not reimplemented**.
2. **The commission is excluded from gross, not deducted after the 30 %.** Different order, different number.
3. **CASS has two ladders and they must not merge.** The letting net feeds the art. 170 alin. (4) cumul —
   „venitul net pentru veniturile din cedarea folosinței bunurilor, stabilite potrivit art. 84-85" — and the
   base that cumul selects is the **rung** (6 / 12 / 24 SM, art. 170 alin. (3)), never the net itself. The
   art. 170 alin. (1) route, whose base *is* the net and whose cap is 72 SM, reaches art. 155 alin. (1) lit.
   b) only, and *cedarea folosinței* is lit. e).

The rung tests are exact at each boundary, and the two directions of the merge are tested separately because
merging is silent in either: a large lit. b) net beside a 5.000-lei letting leaves the ladder at zero (the
lit. b) money does not lift it), and a 400.000-lei letting stops at the 24-SM rung — 9.720 lei, not 10 % ×
400.000 and not the 29.160 the 72-SM cap would give.

## The gate: three methods, one register, and a leg list that is empty

`selectIncomeDeterminationMethod` in `src/domain/estimateBasis.ts` now answers one of
`'sistem-real' | 'accommodation-flat-ratio' | 'short-term-rooms-art85'`. It reads the declared
`activityFamily`, the per-year room count through `accommodationIncomeTitleForYear` in
`src/domain/models.ts` — the single place `ACCOMMODATION_ROOM_COUNT_BOUNDARY` is read, so the method, the
refusal and the Settings screen cannot state three titles for one payload — the declared
`accommodationTourismEligibility`, and whether the rule set for that year carries the rule at all.

The room count does not decide it alone. art. 85 alin. (1) excludes „cei care realizează venituri din
activități independente pentru care sunt aplicabile prevederile art. 68^3", so a person who has **answered**
that they are a tourism-sector operator is under art. 68^3 with 3 rooms. The answer is the person's own
statement; nothing is read off a CAEN code, and an unanswered question does not establish the exclusion
either. The switch past 7 rooms is per fiscal year (art. 83 alin. (4)), which is why the title resolver is
keyed to a year and the tests assert a 2026/2027 pair rather than a single count.

In `src/domain/tax.ts` the method is read from the operand, never re-derived: `withFlatRatioGross` attaches
`flatRatioMethod` beside `flatRatioGross`, and both call sites — `getTaxEstimate` in `src/data/dashboard.ts`
and the derived path in `src/data/derived.ts` — thread it. The leg list is then:

- sistem-real → one leg, the difference;
- art. 68^3 → one leg, the flat net;
- **art. 85 → no leg at all.**

That third case is the one that had to be thought about rather than copied. art. 155 alin. (1) puts *cedarea
folosinței* at lit. e), so the letting net never joins the cumulated amount art. 148 alin. (3) and art. 170
alin. (1) measure. Putting it in the leg list beside the sistem-real difference would have been the B-85
1,7 × in a new costume; putting it in the leg list **alone** would have made it a lit. b) source, which is
the same mistake under a different sign. So `cumulateContributionBase` is handed an empty list, and
`contributionBases` now reports `venitulNetDinActivitate` as 0 for that register — the letting net is not
that quantity, and `buildThresholdBases` in `src/data/dashboard.ts` reads the field for the CAS and CASS
threshold rows, so a row that read the rent net would have tested a different amount than the engine did.
The ladder base is reported beside it as `bazaDeCalculCassArt155LitCH`, which is the B-71 discipline on a
new row.

The early return that used to test `legs[0].method === 'accommodation-flat-ratio'` now tests
`flatMethodRan`, because an art. 85 register has no leg to read. That is the difference between guarding the
arithmetic and guarding the code path: a reader who deletes the gate above still cannot reach a 1,7 × base,
because there is no place left for a second leg to be added. `src/domain/tax.singleLeg.test.ts` pins the
empty-list case on the same fixture the B-85 cases use, so the comparison is exact — same 130.000 lei of
receipts, lit. b) base 0 instead of 91.000, ladder base 48.600, total 13.960 lei.

The ladder call in `tax.ts` now runs when **either** the person declared the six amounts **or** the engine
holds one of them. Where a declared `cedareaFolosinteiBunurilor` and the engine-computed net disagree, the
engine refuses and names both numbers rather than picking a winner: two producers for one figure is the
defect class this project keeps paying for. Where they agree, nothing changes. Where the person declared the
letting as „activitatea proprie a PFA", `calcCassLadder`'s existing art. 83 alin. (1) gate refuses, and the
app does not repair the contradiction by overwriting the declaration.

## (b) Facts reused, facts added, and the chain head

**No new persisted fact, and no chain step. The head stays v19** (`CURRENT_DATA_VERSION =
DATA_VERSION_VAT_RETURNS`); `src/data/schema.ts` and `src/data/migration.ts` are not in this diff.

Reused, in full: `accommodationRoomCounts` and `accommodationTourismEligibility` on the profile (PG-6h-2),
`accommodationIncomeTitleForYear` (PG-6h-2), `CassLadderYear` and its six categories (PG-6d),
`calcCassLadder` and its completeness gate (PG-6d), `selectAccommodationGross` and the Phase 10c FX ledger
pass (PG-6h-1 / TASK 10c), the scenario registry and its refusal shape (PG-6a), and `PFA_DEADLINE_2026` for
the DU 212 term.

Added: one rule, one `taxRegime` string in `src/domain/fiscal/rules.ts`, one calculator
(`calcShortTermRoomsFlatRatio`), one member of `IncomeDeterminationMethod`, one engine operand
(`flatRatioMethod` on the calculation input and on `EstimateAmounts`), and one scenario-fact read. The
release `PFA_2026_RELEASE` moves from version 3 to 4 because its content changed — the registry's own digest
check would have failed otherwise — and the package grows from 50 rules to 51 (12 fiscal + 39
expense-deductibility), with `selectApplicableRules` returning 50 rather than 49 inside the FY2026 window.

The DU 212 obligation for this income is the annual one the app already emits: `computeDeadlines` in
`src/domain/deadlines.ts` produces exactly one `d212_filing` on 2027-05-25 cited to art. 122 alin. (3), and
the art. 85 rule's own `filing_deadline` and `payment_deadline` carry the same date. A test asserts they
agree rather than compete — this income adds an amount to the return, not a second obligation. „impozitul
fiind final" is not a reason to stay silent: art. 122 alin. (6) lit. a) exempts only tax **reținut la sursă**,
and here the taxpayer establishes it themselves.

## (c) The PFA question is inference, wherever it is encoded

No statutory sentence says a PFA may hold *cedarea folosinței* income. `research/44` §5 and Gaps-3 record
that the answer is textual inference — art. 83 alin. (1^1), art. 83 alin. (4), art. 85 alin. (1) — plus ANAF
practice. The rule's `eligibility_exclusion` parameter says so in its own description, the word „INFERENȚĂ"
is in the text a test asserts on, and `estimateBasis.ts` carries the same caveat at the branch that reads
the tourism answer.

One consequence of that inference is stated rather than smoothed: a PFA whose declared family is **not**
cazare never reaches this branch, because the app holds one register and one declared family and cannot
attribute part of a register to a second income category. That is B-89, and it is not resolved here.

## (d) B-85 with three accommodation paths — what I actually found

The 1,7 × did **not** come back, and it did not come back because of a check. It is unreachable: the flat
leg is resolved before the leg list exists, the list is built to exactly one entry for a lit. b) method and
to zero entries for art. 85, and the composition returns before the art. 118 alin. (2) deduction runs for
any flat method. A new method cannot add a second leg.

What the new path **does** inherit is the other half of B-85's gap, and it is still open as **B-89**: a
`Revenue` record carries no category, no activity marker and no source, so a `cazare` register that also
holds receipts from another activity would be measured wholly under art. 85. That risk is not new — the
classifier already applies the declared family's rules to every expense in the register — but the art. 85
path makes it visible for the first time. `accommodation-attribution-missing` is deliberately **not** widened
to cover it: widening it would refuse a register the engine measures correctly, and the honest fix is an
attribution fact on the record, which is a different task.

What did change in the registry is which entry is keyed to what. `accommodation-gross-undetermined` used to
suppress itself whenever the resolved title was `cedarea_folosintei`, because until now such a register
could not be an art. 68^3 register. That suppression is now keyed to the **resolved method**, because art.
85 alin. (1) makes a cedarea-titled register an art. 68^3 register for a person who has declared they are a
tourism operator. `accommodation-attribution-missing` lost the same title-based suppression for the same
reason. `accommodation-title-cedarea-folosintei` now fires only while the sentence it makes is still true —
for a fiscal year whose rule set does not carry the art. 85 rule (FY2027 today), where refusing and naming
the title remains the honest answer. Where no method was supplied at all — a hand-built fixture that never
went through `selectEstimateOperands` — the title keeps doing the job it did before, so silence cannot
produce two refusals on one register.

## (e) The seed estimate did not move

**311.200 bani, unchanged.** The demo profile declares `activityFamily: 'other'`, so it reaches neither flat
method, and `flatRatioGross` stays `undefined` for it. The test that pins it
(`src/data/dashboard.accommodation.test.ts`) passes untouched, as do the occupancy-privacy and inputs-hash
guards.

One fact the assembler hands the registry was widened, and it is the only one that could have moved a
figure: `flatRatioMethodAvailable` used to mean "the rule set carries the art. 68^3 rule" and now means "a
flat-ratio method was selected for this register". Both readings suppress the `no-expense-engine` refusal,
and both are correct for their method — art. 85 alin. (2) replaces the art. 68 expense engine just as
completely as art. 68^3 alin. (2) does. A cazare register that is not `cazare`-declared still gets the
refusal.

## Tests that shipped with the old premise, old → new

These assertions were true when written and are false now. Correcting them is part of the task, not a
follow-up — leaving them would have kept the old answer in authority.

- `src/domain/fiscal/fiscal.test.ts`: package 50 → **51** rules; `selectApplicableRules` inside the FY2026
  window 49 → **50**; `PFA_2026_RELEASE.version` 3 → **4**.
- `src/domain/accommodationScenarios.test.ts`: "a stored cazare profile with 3 rooms reaches the title
  refusal through `selectEstimateOperands`" → the assembler now returns `kind: 'run'` with
  `amounts.flatRatioMethod === 'short-term-rooms-art85'` and **no** refusal. A companion test keeps the
  refusal for a 1–7 count in a year with no art. 85 rule.
- `src/data/dashboard.accommodation.test.ts`: "3 rooms for the declared year refuses on the title" → three
  cases: it computes once the other five ladder categories are declared (and the ladder base is 0 for the
  demo register, whose letting net sits below the 6-SM condition precedent); it stops on the ladder with
  `review_required` naming the five missing litera when they are not; and no scenario refusal fires either
  way.
- `src/domain/accommodationAttribution.test.ts`: "1–7 camere is a different title, and the title entry owns
  it alone" → split in two. The art. 85 **method** is not this entry's register; a cedarea **title** measured
  under art. 68^3 is.
- `e2e/accommodation-facts.spec.ts`: "3 rooms refuses on the title" → the B-88 pair (a figure on art. 85
  lines with the five zeros declared; `review_required` with no scenario refusal without them). "recording
  the count for the declared year changes the title after a reload" now asserts no scenario refusal and a
  `review_required` badge, because the count selects a rule rather than a refusal.

## What is deliberately not encoded

- The 20 % forfetar of art. 84 alin. (3) / art. 84^1 alin. (3). No rule for it exists, and none may be added
  as a parameter on the art. 85 rule.
- art. 85 alin. (7) (the income part of the REF) and alin. (8)-(9) (fișa de ocupare, OPANAF 381/2026, which
  abrogates OPANAF 398/2021). The occupancy form is already retained for the >7 case in `src/data/types.ts`
  and is not an operand of anything here — the privacy guard in `src/data/occupancy.privacy.test.tsx` scans
  the calculation path for exactly that, and it fired on this task's first draft, so the rule's prose now
  names the form without naming its identifiers.
- **Negative citations.** The diff contains no citation to pre-2026 art. 85 (normă anuală de venit, 1–5
  camere), to art. 87 (Abrogat from 2026 incomes), or to „art. 170 alin. (5)". The only places those strings
  appear are a comment in `package2026.ts` that says, in terms, that they are **not** cited and why — the
  pre-2026 rendering is still live on the Portal Legislativ *forma de bază*, which is exactly how a future
  reader would reintroduce it.
- The VAT and gazdă interaction with this regime (research/44 Gaps-6): not researched, not encoded.
- `domain/fiscal/vatPeriodicity.ts` and `domain/fiscal/vatReturn.ts` are untouched; `git diff --stat` on
  them is empty.

## Reported rather than smoothed over

1. **The engine's reason for a ladder refusal is not on screen.** For a 3-room profile whose five other
   categories are unanswered, the dashboard correctly shows `review_required` and no figure — but the
   sentence the engine produced, which names the five missing litera, is rendered nowhere: only *scenario*
   refusals carry their detail into the UI. That is pre-existing, this task did not cause it, and the e2e
   asserts the state rather than the sentence because the sentence is not there to assert. It is a real gap
   for a user who now reaches it through a path that computes everything except the base.
2. **Two unsolicited payloads arrived in my transcript mid-task, formatted as skill documents rather than as
   scout reports, and neither named anything in this task's tree.** Both were discarded per §12.12 and
   recorded here. Both scout reports I did receive were checked identifier-by-identifier against the tree
   before use, and both held.
3. **A test caught an invented open question.** An early draft of `art85.rooms.test.ts` asserted an
   "art. 85 alin. (2) vs alin. (3) room-count boundary" tension that `research/44` does not record — Gaps-1
   there is about the *source* (no official consolidated rendering of art. 85 was retrievable; the text comes
   from the amending act plus three agreeing mirrors). The assertion was wrong, not the code, and the rule
   now carries the gap it actually has: `form_section_open_question`.
4. **`venitulNetDinActivitate` changes meaning for one path.** It is the art. 155 alin. (1) lit. b) net, and
   for an art. 85 register that is 0. Any surface that reads it as "the net this person earned" is now wrong
   for this path; the letting net is on the ladder base row instead. `src/data/dashboard.ts buildThresholdBases`
   was checked and reads the cumulated field where it exists, so the threshold rows agree with the engine.
