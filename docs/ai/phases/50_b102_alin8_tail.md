# 50 — B-102: art. 322 alin. (8)'s two-year tail, and the return that is not self-executing

Written from my own diff. No line numbers, per §12.11.

## What the defect was

The derivation for a year read only that year's own facts. An alin. (7) flip in 2026 therefore made 2026
monthly and left 2027 to be answered from 2027's facts alone — where alin. (2) happily answers `quarter`,
in direct contradiction of alin. (8)'s „pentru anul curent și pentru anul următor".

## (a) The asymmetry — the reason the implementation looks the way it does

**The switch *to* the month is fact-driven and ANAF enforces it din oficiu. The return *to* the quarter is
not self-executing.**

- **To the month** is created by alin. (7) itself. The 5-working-day mențiuni declaration is a *separate
  duty* — late filing „constituie contravenție potrivit art. 336 alin. (1) lit. a)" — and **not a condition
  precedent**. ANAF builds the list from the 300 returns and updates the register din oficiu when nobody
  files anything. So the tail is keyed to the **acquisition**, never to a filing. This is landmine 2, and it
  is why `Alin8Premise.position === 1` (the second monthly year) consults no filing at all: the month in
  N+1 follows from the fact in N, full stop.
- **Back to the quarter** needs **three** things: no intra-community acquisition in the following year, the
  art. 322 alin. (2) 100.000 euro cap not exceeded, **and** the alin. (6) mențiuni declaration actually filed
  by 25 January. Two of those three are facts the record can disprove; the third is an act the taxpayer must
  have performed.

The consequence for the code: the branch that returns someone to the quarter is the only place in this area
that reads a filing, and it is gated on all three conditions independently. `Alin8State.returned` is
deliberately **not** the same thing as „two years have passed" — that equivalence is landmine 1, the wrong
fix that looks right. `Alin8State.eligibleToReturn` is a separate flag: it means *nothing in the record
disproves the return*, which is what the calendar uses to decide the 25 ianuarie duty exists. It is not a
claim that the return has happened.

## The shape of the fix

`Alin8Premise` — the two years *before* the year being derived — is **computed, never stored**.
`alin8PremiseForYear` in `domain/fiscal/vatReturn.ts` builds it from the same
`PfaProfile.vatPeriodicityYears` array the derivation already reads, which is already per-year and already
carries `aicGoodsWhileQuarterly` and `aicGoodsExigibilityMonth`. **No new field, no schema change, no chain
step** — and that is load-bearing beyond tidiness: a cross-year answer that could be seeded from outside the
facts would depend on which surface built it, which is exactly landmine 7.

The premise is threaded into **all three** call sites of `vatPeriodicityForYear`, so a year has one answer
wherever it is asked:

1. `data/dashboard.ts` → `getVatPeriodicity` — the Form 300 panel and the filing calendar;
2. `domain/completeness.ts` → `vatFilingPeriodCheck` — the completeness channel;
3. `pages/Settings.tsx` → the alin. (7) question gate.

Call site 3 is not cosmetic. Alin. (7) applies only to „persoana … care utilizează trimestrul calendaristic
ca perioadă fiscală". Once the tail makes a person monthly in N+1, asking them the alin. (7) question there
invites a `da` that would record a quarter that never existed. The gate now reads the same premise and
answers `notAskedMonthly(N+1)` instead.

The year description is **one function, `vatPeriodicityYearSentence`**, called by both the panel and the
completeness check. Two copies of that sentence is how B-103 happened, so there is now one producer.

## (b) The N+2 date is interpretation, not statute

„Începând cu primul trimestru al anului următor" **does not appear in alin. (8)**. The statute states no
effective date for the return at all. Year N+2 is a supported inference from the alin. (6) mechanism and
ANAF's worked examples.

Where the UI says so: the alin. (6) mențiuni calendar row carries the word **„interpretare"** in its own
text, and a unit test asserts that the derivation's explanation of the N+2 date never presents it as a
quoted rule. The row cites alin. (6) for the *obligation* — which is statutory — while the *date* is marked
as inference. Landmine 4.

## (c) Acceptance 2 — does a second ICAB in N+1 restart the tail?

**Unresolved in the sources, and the app invents no reset rule.**

Alin. (7) is conditioned on using the quarter. An acquisition made while already monthly is therefore not an
alin. (7) event, and cannot start a fresh two-year tail on its own — the field name says as much
(`aicGoodsWhileQuarterly`). What a second acquisition *does* do is fail alin. (8) teza a II-a's
no-acquisition condition, so the month continues.

Whether a **new** two-year clock starts from it is not stated anywhere in the text I have. The test asserts
the conservative reading and names it as such: the month continues, and the app does **not** mint a new
two-year window. When neither of a year's two predecessors declares a flip, the tail has run out and the
derivation says so — falling back to alin. (2) rather than extending the month indefinitely or restarting it.
No reset rule was guessed.

## (d) research/43 §Gaps-3 stays open

**Does a missed alin. (6) filing permanently forfeit the return, or does a late filing still effect a
retroactive return?** No authority found; it remains open, and it is the mirror of the ex officio finding.

The app's default sits on the **safe side** of that uncertainty: **N+2 stays monthly until a filing is on
record.** That matches ANAF's own behaviour (Procedura pct. 8.4 — the register is updated din oficiu, and a
person who files nothing stays where they are). If the open question later resolves in favour of a
retroactive return, the change is to relax this gate, not to restructure it.

## The boundary widening — `domain/completeness.ts`

This file was **not** on the brief's "may touch" list. I widened it, with the orchestrator's authorisation,
because leaving it alone would have created landmine 7 outright: two surfaces answering the same question
for the same profile-year, one threading the premise and one not.

**Threading only.** The diff adds the fifth argument to the existing `vatPeriodicityForYear` call and imports
`alin8PremiseForYear`, `isFiledVatReturn` and `vatPeriodicityYearSentence`. What it does **not** change:

- the check's **gating** — same `profile.vatRegistration` premise, same `satisfied: true` in both branches,
  same `key`;
- the **cap arithmetic** — the `plafonul de 100.000 euro … cursul BNR … valabil pentru …` clause is
  character-for-character unchanged;
- the **citation** — still `ART322_RULE_TEXT[outcome.branch].citation`;
- the **user-confirmed branch** — same wording, same `confirmedOn`, same „aplicația nu a putut deriva
  răspunsul".

The only wording change is replacing the inline `outcome.periodicity === 'month' ? … : …` ternary with a call
to `vatPeriodicityYearSentence(outcome, profile.fiscalYear)` — which is condition 3 of the authorisation: one
producer, not a second copy of the sentence at the second call site.

**The divergence guard is what makes this widening safe rather than a one-time fix.**
`src/domain/vatPeriodicitySurfaces.test.ts` takes the **same profile and the same year** through **both**
surfaces — `getVatPeriodicity` and `vatFilingPeriodCheck` via `assessCompleteness` — for every year of a
three-year alin. (8) span, and asserts they say the same thing. It also pins both directions: the return year
where a channel that dropped the premise would answer `month` while the panel answers `quarter`, and the
no-filing year where both must still answer `month`. A guard testing only one direction would not notice a
channel returning to the quarter too early.

**Proven to fail.** With the premise removed from `completeness.ts`, **4 of the 6 guard tests fail**, and the
failure output shows the divergence exactly as predicted — the completeness channel answering
„trimestrul calendaristic … derivat din CF art. 322 alin. (2)" where the panel answers „luna calendaristică".
The file was then restored and the guard re-run green. Without this test the two calls would drift again the
next time either changed, and nothing would notice. That is the reason the boundary widening is acceptable.

## The defect this pass exposes, stated plainly

**The calendar can show an alin. (6) mențiuni obligation that the user has no way to mark as filed.**
`recordFiling` only acts on calendar rows carrying a fiscal period, and a declarație de mențiuni has none.
**So the return to the quarter is currently reachable only from a record built in a test — acceptance 3 and
acceptance 4 are domain-level truths with no user-facing path.** This is a different kind of unfinished than
a wrong rule, and it is not papered over here: the e2e test that proves the return loads the filed
declaration from stored bytes and says so in its own header. Recording a mențiuni filing is 6g's form
vocabulary; bolting it on here would have made this diff unreviewable. **Minted as a follow-up defect, not
fixed in this pass.**

## Acceptance evidence

1. **Three-year span asserted.** `vatPeriodicity.test.ts` acceptance 1: N monthly, N+1 monthly — and N+1
   stays monthly *even though its own facts answer `quarter`*. Asserted at the derivation level and in the
   browser (`2027 is monthly, though its own facts would answer quarter` — twelve monthly deconturi).
2. **Second ICAB in N+1.** See (c) — asserted as "the month continues, no reset rule is minted", recorded as
   unresolved.
3. **N+2 returns only when all three conditions hold.** One test for the all-three case, then one per
   condition (ICAB in N+1; cap exceeded; no filing), then one where **two hold and one fails**. Plus the
   browser case for the ICAB condition.
4. **No filing → N+2 stays monthly.** Unit and browser.
5. **The alin. (6) obligation appears in N+2, exactly once.** The browser asserts `toHaveCount(1)` on the
   mențiuni row — landmine 5, because the obligation is now reachable from a second gate. The existing
   obligation builder was extended, not duplicated.
6. **No new chain step.** `git diff --stat` on `domain/schema.ts` and `data/migration.ts` is empty; head is
   still `DATA_VERSION_VAT_RETURNS = 19`.
7. **B-103.** The panel now reads „trimestrul calendaristic până la 06.2026, apoi luna calendaristică de la
   07.2026" for a year that since B-101 opens with two quarterly returns, and the calendar is asserted in the
   same test — eight deconturi (T1, T2, 07–12), not twelve. The confirmation wording still matches the
   calendar.
8. **`git diff --stat` empty** on `domain/fiscal/vat.ts`, `domain/tax.ts`, `domain/fx/` — and also on
   `domain/date.ts`, `deductibility2026.ts`, `deductibility.ts`, `calculators.ts`, `depreciation.ts`,
   `release2026.ts`.
9. `tsc` 0 · unit **135 files / 2092 tests** · `build` 0 · e2e **134** (128 functional + 6 axe, including the
   live `/settings#!/fiscal` axe scan) · copy-guard `ALLOW_LIST` still `[]` · **seed estimate still 311.200
   bani** · chain head **v19**.

## Test changes

**No existing assertion was moved, weakened or re-pinned.** The baseline suite — 134 files / 2063 tests —
was run against the source changes *before* any new test was written, and passed unchanged. Everything added
is new: `vatPeriodicity.test.ts` (B-102 derivation + B-103 sentence), `vatReturn.test.ts` (the alin. (6)
gate), `Declarations.test.tsx` (calendar), `Settings.aic.test.tsx` (the question gate), the new
`vatPeriodicitySurfaces.test.ts` divergence guard, and the new `e2e/vat-alin8-tail.spec.ts`.

The new browser specs pin the clock explicitly (`page.clock.setFixedTime`) rather than at the shared
`fixedInstant()`, because these cases are about 2027–2028 and the shared constant is a 2026 instant; the unit
page tests do the same with `pinClock`. Without a pin the calendar answers „nothing has closed yet" for a
2028 register and every row count would pass or fail for the wrong reason.

## Landmines checked

- **1** — no auto-return; the quarter requires all three conditions.
- **2** — the tail is keyed to the acquisition, never to the 5-working-day filing.
- **3** — two years, N and N+1, asserted across a three-year span.
- **4** — the N+2 date is labelled „interpretare" in the UI and tested as such.
- **5** — the existing obligation fires in the new case; the row is asserted to appear exactly once.
- **6** — the B-97 confirmation and B-101 start-month text still match the calendar.
- **7** — three call sites, one premise builder, one sentence producer, plus the divergence guard; and a test
  that the answer does not depend on which year was derived last.
- **8** — no formular 092/094 anywhere in the diff; the app still cites neither number.
- **9** — seed estimate unmoved; cap arithmetic and pro-rating untouched.
- **10** — `Bani` stays integer lei; the clock helper used is `pinClock(at)`.

## (e) For B-100 and B-98

- **B-100** — unaffected, by design. It stays open and paired with the persona phase; nothing in this pass
  touches how a persona is chosen, and the tail is a property of the periodicity derivation only.
- **B-98** (rd. 33/34) — unaffected. This pass changes no `domain/fiscal/vat.ts` line and no cap arithmetic,
  so the rd. 33/34 figures cannot move; the seed estimate holding at 311.200 bani is the check that says so.

## Follow-ups minted

1. **The alin. (6) mențiuni declaration cannot be recorded from the UI** — see the section above. Until it
   can, the return to the quarter is a domain truth with no user-facing path.
2. **research/43 §Gaps-3** remains open (late alin. (6) filing / retroactive return). The app's default is
   the safe side; revisit if authority appears.
3. **Acceptance 2's reset question** is unresolved in the text. If it resolves, the premise builder is the
   single place to change.
