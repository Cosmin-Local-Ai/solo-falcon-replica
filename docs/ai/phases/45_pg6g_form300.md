# PG-6g — Form 300: the periodic VAT return, derived and asked

**Brief:** `docs/ai/briefs/48_pg6g_form300.md` · **Branch point:** `4177008` (PG-6f) · **Landed:** 2026-10-12
**Closes:** **B-35** (both halves), **18B** · **Honours:** **D-VAT-1**, **D-VAT-3**, **D-LEG-1**, **B-56** discipline

---

## 1. What this phase was

D-VAT-1 was taken on 2026-10-10, before any VAT machinery existed: *ask the two facts the user knows,
derive the cadence where the facts and recorded income give it, and where they do not, state the rule in
plain words and ask the user to confirm — labelled as **their** answer. Never a guessed cadence, and never
the dead end of „nu poate fi stabilită" with no way forward.*

PG-6f built the money: `decideInputVat`, `InputVatDecision`, `claimableTotal`, and three parked lists it
refused to fold in. What was still missing was the **period** that money is claimed for, the **calendar**
that says when, the **record** of what was actually filed, and the **place on the form** where 6f's numbers
sit. That is 6g.

**Before:** the completeness card admitted the VAT filing period could not be established and stopped there.
`domain/deadlines.ts` had no TVA entry at all — a grep for `300` returned nothing. There was no periodic
return record, and the data chain head was v18.

**After:** the fiscal period is derived from the art. 322 branches, or asked for with the rule stated in
Romanian and the statutory default named as the law's interim answer. The art. 323 calendar exists as
three different kinds of obligation. A `VatReturnRecord` exists, on chain step v18 → v19, opened empty.
The D300 rubric layout is drawn — lines, not a facsimile — and 6f's parked lists are shown as excluded with
their reasons.

---

## 2. Modules added

| Path | What it owns |
| --- | --- |
| `src/domain/fiscal/vatPeriodicity.ts` | The art. 322 branches. `deriveVatPeriodicity`, `vatPeriodicityForYear`, `periodicityCapForYear`, `proRateCap`, `monthsRemainingToYearEnd`, `ART322_RULE_TEXT`, `VAT_ROUTE_LABELS`, the `VatPeriodicityOutcome` union (`derived` / `user_confirmed` / `ask` / `not_registered`) |
| `src/domain/fiscal/vatReturn.ts` | The fiscal periods and the calendar. `vatFiscalPeriods`, `decontTerm`, `decontObligations`, `annualMentiuniObligation`, `aicMentiuniObligation`, `addWorkingDays`, `aicFlipForQuarter`, `D300_DEDUCTIBLE_LINES`, `parkedGroups`, `unfiledFigureNote` |
| `src/data/types.ts` | `VatReturnRecord`, `VatReturnStatus`, `isFiledVatReturn`, the `vatReturns` collection on `AppData` |
| `src/data/schema.ts` | `VatPeriodicityFacts` and `VatPeriodicityChoice` as stored profile records |
| `src/data/migration.ts` | `DATA_VERSION_VAT_RETURNS = 19`, the `vat-returns` step, `CURRENT_DATA_VERSION` moved to it |
| `src/domain/deadlines.ts` | `vatObligationDeadlines`, `vatReturnForDeadline`, and two new `DeadlineEventType` values — `vat_return`, `vat_mentiuni` |
| `src/data/dashboard.ts` | `vatPeriodicity` and `vatObligations` on `DashboardData`, assembled once from the recorded rate provider |
| `src/pages/Declarations.tsx` | `VatPeriodicityPanel` — the only place these facts are shown or answered |
| `src/ui/copy/records.ts` | `vatReturn` copy, `vatReturnStatusLabels`, `parkedReasonLabels` |

The panel reads `useDashboardData()`, not a second pass over the store. `Dashboard.tsx` reads the same
producer, so the two surfaces cannot disagree about the fiscal period.

---

## 3. Acceptance 1 — which art. 322 branches are encoded, and which are not

**Encoded**, each with its own test in `src/domain/fiscal/vatPeriodicity.test.ts`:

- **alin. (1)** — the calendar month is the **rule**, and it is stated on every unanswered branch as the
  statutory default, attributed to the article. It is never presented as an option in a list.
- **alin. (2)** — the standing annual test on the **preceding calendar year** turnover, with the
  intra-community **goods** carve-out that removes the quarter at any turnover. `„nu depășește"` is
  modelled inclusive: exactly the cap keeps the quarter.
- **alin. (3)** — mid-year registration: a **forecast** for the stub, against the cap **pro-rated by months
  remaining**.
- **alin. (4)** — the branch that actually fits a PFA coming from art. 310: an **actual turnover annualised
  to a full year**, against the **full** cap, **no pro-rating**, with the pre-registration intra-community
  goods exception.
- **alin. (5)** — automatic and recurring: the annualised actuals of the registration year decide the
  **next** year, with no taxpayer election and no *cerere*.
- **alin. (6)** — the recurring **declarație de mențiuni by 25 ianuarie**, its own obligation with its own
  citation, and the art. 316 → art. 310 return request as its stated exception.
- **alin. (7)** — the mid-quarter flip, per litera: lit. a) monthly from month 1 with no distinct period;
  lit. b) months 1–2 become **one distinct fiscal period** with its own decont; lit. c) the quarter is
  untouched. The split really does add a decont to the calendar.
- **alin. (8)** — the **5 working days from month end** mențiuni after an intra-community acquisition,
  counted with `addWorkingDays`, which never lands on a weekend and reports the weekend days it skipped.
- **Norme pct. 103 alin. (1)** — *din oficiu* registration is the month, with no estimate asked for and
  none invented.

**Landmine 1 is the headline test.** `alin. (3) versus alin. (4) — the landmine, on one set of numbers`
drives one registration date and one month count through both alineate and asserts they come out **on
opposite sides**. A separate assertion computes both comparators side by side and shows that feeding
alin. (3)'s forecast against the full cap, or alin. (4)'s annualised figure against the pro-rated cap,
would flip the answer.

**NOT encoded — deliberately, and each is a stated gap rather than an omission:**

- **Norme pct. 103 alin. (4)–(5) — the alternative periods (semestrul / anul), requested by *cerere* until
  25 February under art. 322 alin. (9).** Not modelled. `VatPeriodicity` is `'month' | 'quarter'` only.
  Encoding it would mean accepting an *application* the app cannot file, and would put a semester on the
  same union as a statutory outcome — the two are different kinds of fact.
- **Norme pct. 103 alin. (3)** — the exclusion of operations made with no VAT code from „cifrei de afaceri".
  `research/33` §8 records this as an **unresolved tension** with alin. (4)'s „cifra de afaceri obținută,
  recalculată": the norm speaks of the alin. (2) turnover, and whether it also prunes the alin. (4) figure
  changes the mid-year answer materially. The app therefore **asks which turnover the declared figure
  covers** instead of silently pruning pre-registration receipts.
- **Any rounding of the pro-rated cap.** See §5.

---

## 4. Acceptance 2 — the lei equivalent of the cap

`periodicityCapForYear` strikes the lei equivalent **through `domain/fx/capCeiling.ts`** — specifically
`capCeilingAtPaymentDate` and `capMoney` — from `VAT_PERIODICITY_CAP_EUR_MAJOR = 100_000`. **No lei figure
for the cap appears anywhere in `src/`.** The only place the number from `research/33` is written is in a
test comment that exists to assert it is *not* used.

- **Rate used:** the BNR EUR/RON daily reference **valabil pentru 31.12.2025**, i.e. **5,0963** in
  `research/33`. The rate is not hard-coded: it is read from the recorded rate store through
  `recordedRateProvider`, and the panel prints the rate and the date it is valid for.
- **The date choice is attributed to Norme pct. 103 alin. (2)** — „cursul de schimb valabil pentru data de
  31 decembrie a anului precedent" — **not** to the fx layer it borrowed. That distinction is pinned by its
  own test, because `capCeilingAtPaymentDate`'s own basis citation is art. 9 alin. (3) lit. b) + alin. (4)
  CF, which is the *payment-date* basis and is the wrong basis for this cap. Reusing the fx layer's
  citation would have attached a legal basis to the wrong rule — the exact danger **B-60** warns about.
- **Where no rate is recorded for 31 December, the cap refuses.** `PeriodicityCapFailure` is a distinct
  outcome; the panel says the cap is unresolved and names the missing rate. It does not fall back to a
  prior-year average and it does not carry a lei figure forward from a previous year.
- **Status of the figure.** `research/33` marks **509.630 lei** for FY2026 as **CORROBORATED, secondary**,
  and flags the rate-date question as the trap. This phase treats it accordingly: the number is *derived
  at render time from a recorded rate*, never stored, and the surface shows the rate and its date so a
  reader can check the derivation rather than trust the constant.

---

## 5. Acceptance 3 — the pro-rated cap has no rounding rule

`research/33` §8 records a **negative finding**: there is no rounding rule for the alin. (3) pro-rated cap,
in the law or in the norms, and „numărului de luni rămase" occurs once in the whole Cod fiscal
consolidation — in alin. (3) itself.

`proRateCap` therefore keeps the `Decimal` and returns the fraction. `deriveVatPeriodicity` carries a
`boundaryNote` onto the outcome that used it, and the panel renders it under the arithmetic. When the
pro-rated figure happens to be a whole number of bani, nothing is said about rounding — a gap note that
fires on every calculation would stop being read.

`Bani` stays integer lei and the `Decimal` is kept until the final comparison. Landmine 11.

---

## 6. Acceptance 4 — three kinds of obligation, not one list of dates

`VatObligationKind` is `'decont' | 'mentiuni_annuale' | 'mentiuni_achizitie'`, and each kind is produced by
its own function with its own citation:

- **`decont`** — art. 323 alin. (1). The term is the 25th of the month following the one in which the
  period ends. **The fourth quarter is due in the following calendar year**, and a December decont is keyed
  to the year of the *period*, not the year of the term — pinned, because that is how a Q4 record and a Q4
  deadline end up in different years. Payment falls on the same day (art. 326 alin. (1)) and is shown as a
  separate column rather than folded into the term.
- **`mentiuni_annuale`** — art. 322 alin. (6), 25 ianuarie. It exists for a person quarterly **potrivit
  alin. (2) și (5)** and **not** for alin. (3) or alin. (4), because alin. (6) names those two and no
  others. The Q4 decont and the mențiuni fall on the same day and stay **two separate rows**.
- **`mentiuni_achizitie`** — art. 322 alin. (8), five working days from month end.

A missed mențiuni declaration was previously invisible to the app; it is now a deadline with a citation.

`vatObligationDeadlines` is the **only** place a `VatObligation` becomes a `Deadline`, so the Termene limită
card, the attention pipeline and the Declarations table all read one mapping. `vatReturnForDeadline` joins
a record to its term by `obligationId` — which is why `VatReturnRecord` carries that field: the store mints
ids, and a decont whose term sits in the next calendar year must still join the row it discharges.

Periods that have not closed are dropped by `closedThrough`. An open quarter produces no decont row — the
app does not date a return for a period it has not finished — and an **overdue closed** period is never
dropped.

---

## 7. Acceptance 5 — the filing record

`VatReturnRecord` follows the `AnnualFiling` discipline that PG-5 set for B-34: the period it covers
(`periodKind`, `periodIndex`, `periodToMonth` for the alin. (7) distinct periods), the date it was filed,
and a status vocabulary **kept separate** from the monthly legacy one. A test hands the monthly
`DeclStatus` value to it and is refused at compile time. `isFiledVatReturn` is the only test that says a
return was filed, and only `depusa` passes it.

**Absent means none recorded.** Chain step `vat-returns` (v18 → v19) opens `vatReturns` **empty** and mints
nothing — the step's own user-visible note says so at length. `emptyData()` and `seedData` both carry
`vatReturns: []`. A payload that already has the key keeps it unchanged: the step opens a collection, it
does not rewrite one.

The migration note records why a seeded `depusa` row would have been the worst possible fixture: it would
fabricate exactly the false evidence that the v10 → v11 step removed, and would let a term be badged
„Depusă" from a record nobody made.

---

## 8. Acceptance 6 — 6f's parked lists stay parked

`parkedGroups` groups the excluded lines by the reason `decideInputVat` already gave — the three D-VAT-3
mitigations (e-Factura-less domestic B2B, unknown pro rata, 100–400 euro simplified invoice) — and the
panel lists them with the amount at stake. `parkedReasonLabels` is exhaustive over
`InputVatUnresolvedReason`, `InputVatDeferredReason` and `InputVatZeroReason`, so a new reason in 6f's
unions fails the copy guard rather than rendering `undefined`.

Two things keep the parked sums out of the form:

- A claimable line never appears in a parked group (pinned), and an empty register parks nothing rather
  than parking a zero row.
- The D300 rubric table **carries no currency at all**. A page test asserts that every `rd.` row is free of
  lei figures, and that the rows are exactly `rd. 20–28`, `rd. 30`, `rd. 33`, `rd. 34` — four rows, not one
  total under one label.

`unfiledFigureNote` sits beside the computed total and says plainly that the figure is a computed amount,
not a filed one.

---

## 9. Acceptance 7 — no cadence is ever guessed

`src/pages/Declarations.test.tsx` drives the likeliest user of this screen — a PFA registered on 1 Oct 2026
from under the art. 310 ceiling, with nothing declared about how it got there — and asserts the whole loop:

- the rule is on screen in Romanian with the article that states it, both alin. (3) and alin. (4);
- the question is phrased so a person can answer it;
- the statutory default is shown **attributed to art. 322 alin. (1)**, as the law's answer in the meantime;
- **no calendar is built from a guessed period**, and the panel states that there is no obligation it can
  date;
- clicking an answer stores it with `confirmedBy: 'user'` and the branch the person was shown, and only
  then does the calendar appear.

There is **no periodicity dropdown anywhere**. The confirm buttons appear only on an unanswered branch, and
they record which rule was on screen when the answer was given. `confirmedBy: 'user'` is a literal in the
schema for a reason: there is no way to write down that the app decided.

`deriveVatPeriodicity` is a thin wrapper over the branch logic for one purpose: **any** `ask` outcome plus a
recorded `userChoice` becomes `user_confirmed`. Without that, the confirm path was gated on a known branch
and the mid-year registration case — the likeliest user — had a question with no way to answer it. That was
found by the acceptance-7 test, not by reading.

Two related decisions taken while building this:

- **The registration date is asked once.** `vatPeriodicityForYear` copies `profile.vatRegistration.effectiveFrom`
  into the art. 322 facts. PG-6f already asked it, as the answer to art. 316 alin. (1¹). Demanding it again
  would be a second question with one answer, and would tell a person who had answered it that the app does
  not know it. This is a copy of a declared fact, not an inference.
- **The registration status is NOT copied into an art. 316 route.** `inregistrat_art316` says the person is
  registered; it does not say they came from the art. 310 exemption, and that is precisely the fact that
  decides alin. (3) versus alin. (4). Carrying the status across as a route would be the app choosing a
  branch it was never told. Pinned by its own test.

---

## 10. Acceptance 8 — nothing claims a return was or will be filed

B-56 is open because success messages elsewhere already claim operations that do not happen. 6g adds none:

- The only write the panel performs records that **the person** filed something, and the row says
  `Depusă` about the app's own record. The button is labelled *Înregistrează depunerea*, not *Depune*.
- `unfiledFigureNote` and the calendar's own footnote state that a term listed here is an obligation set by
  law, not a filing, and that the absence of a record means nobody recorded one — not that it never existed.
- A mențiuni row carries its term and its citation and **no filing control at all**. The app models one
  return form (`300`); a declarație de mențiuni is not it, and minting a `300` record to close a mențiuni
  term would put the wrong form on the record.
- The page test asserts the body text matches none of the phrasings that would claim a submission.

---

## 11. Acceptance 9 — boundaries held

`git diff --stat` between `4177008` and the tip is **empty** for every path the brief put off-limits:
`domain/fiscal/vat.ts`, `domain/tax.ts`, `domain/fx/*`, `domain/date.ts`,
`domain/fiscal/deductibility.ts`, `domain/fiscal/deductibility2026.ts`, `domain/fiscal/depreciation.ts`,
`domain/fiscal/calculators.ts`, `domain/fiscal/release2026.ts`, `domain/projection.ts`,
`data/occupancy*`, `data/fixedAssetDocuments.ts`, `docs/ai/steps/`.

`decideInputVat` is called, never changed. The `expenseBase: ExpenseBaseWithVat` contract is untouched.
The monthly `LegacyMonthlyDeclaration` shape was not resurrected and `addDecl` was not re-exposed — the
`annual-filing` migration step still drops those rows before any page can read them, and the pin that
guarded it was re-premised rather than deleted (it now scopes to `table[data-register="d212"]`, because
6g added other tables to that page).

---

## 12. Gate

| Check | Baseline at `4177008` | After PG-6g |
| --- | --- | --- |
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 130 files / 1955 | **132 files / 2027** |
| `npm run build` | 0 | **0** |
| e2e | 123 (118 functional + 5 axe) | **123 passed** (118 functional + 5 axe) |
| Copy-guard `ALLOW_LIST` | empty | **empty** |
| Seed estimate | 311.200 bani | **311.200 bani — unmoved** |
| Data chain head | v18 | **v19** (`vat-returns`) |
| PG-5C enforcement | green | **green** (`src/data/partialYear2026.test.ts`, `e2e/partial-year-2026.spec.ts`) |

Landmine 10 held on the first run and stayed held: the seed profile has no VAT filing history, and the
periodicity machinery never defaults one. The seed's `vatRegistration` records a status with **no**
`effectiveFrom`, so the derivation asks and the estimate is untouched.

**e2e re-pinned, not deleted** — three assertions moved, each for a reason the change makes correct:

- `e2e/settings.spec.ts` — the saved `version` moves 18 → 19, because `vat-returns` follows
  `input-vat-registration`. The B-26 notice this test exists for is untouched.
- `e2e/annual-filing.spec.ts` — „no table on the page" becomes „no `d212` register", because 6g added the
  calendar, the rubric layout and the parked tables to that page.
- `e2e/dashboard.spec.ts` — the completeness row's wording. The B-35 admission is still asserted; what
  changed is that it now names the two missing facts, the route to answer them, and the art. 322 alin. (1)
  default that stands meanwhile. The assertion that **no cadence is concluded** stays, unchanged.

---

## 13. What was found on the way, and is recorded here

1. **The confirm path was gated on a known branch.** The first version of the panel only offered the
   answer buttons when the derivation could say which alineat applied — which is exactly the case that does
   not need them. The mid-year registration case, the likeliest user of this screen, was left with a
   question and no way to answer it: the dead end D-VAT-1 exists to remove. Fixed by making the wrapper
   honour a recorded `userChoice` on **any** `ask` outcome.
2. **The same fact was about to be asked twice.** PG-6f asks for the registration date; the art. 322 record
   asked for it again. A person who had answered it in Settings would have been told the app does not know
   it. Fixed by copying the declared date into the facts, with the route deliberately **not** copied.
3. **Scout payloads (§12.12).** Two payloads arrived in this transcript posing as scout reports and were
   skill documents, not reports. Both were discarded and not acted on. The ground they would have covered
   was covered by reading `domain/deadlines.ts`, `data/schema.ts`, `data/types.ts`, `data/migration.ts` and
   `pages/Declarations.tsx` directly. No identifier from an untrusted payload reached the diff.

---

## 14. For the demo-persona phase (D-DEMO-1) — what each persona must carry

D-DEMO-1 will replace the single seed profile with five. **The seed estimate it pins will move, and that is
its business, not a regression from here.** What it must not do is leave a persona's VAT cadence
undetermined by accident, or determine it by default.

Each persona's `profile.vatPeriodicityYears` entry for the persona's fiscal year needs, at minimum:

- `registrationEffectiveFrom` — or leave it absent and let `profile.vatRegistration.effectiveFrom` carry it.
  One of the two must exist for any branch to run.
- `registrationRoute` — one of `VAT_REGISTRATION_ROUTE_VALUES`: `a` (before any operations), `b` (over the
  plafon), `c` (by option), `d`, or `din_oficiu`. This is **not** derivable from
  `VatRegistrationStatus`; a persona that is `inregistrat_art316` still needs its route stated.
- Then exactly one of the branch figures, matching the route:
  - a persona whose quarter comes from **alin. (2)** needs `precedingYearTurnover` and `precedingYearAicGoods`;
  - a persona registered mid-year needs `inArt310BeforeRegistration` (`da` / `nu`) to select alin. (3) or
    alin. (4), and then `forecastStubTurnover` for alin. (3), or `actualTurnover` with
    `actualActivityMonths` for alin. (4) — and `actualTurnoverScope` as well, because Norme pct. 103
    alin. (3) leaves open whether the pre-registration receipts are pruned from that figure;
  - a persona whose next year is decided automatically needs `actualTurnover` and `actualActivityMonths`
    for the registration year — alin. (5) reads the same pair alin. (4) does, annualised over the months of
    activity rather than over the months remaining.
- If a persona is quarterly under alin. (2) or alin. (5), the **25 ianuarie mențiuni** obligation will
  appear for them. That is correct and should not be suppressed; it is one of the things the demo should
  show, because the app used to be silent about it.
- **Do not seed `vatReturns`.** A persona with a `depusa` decont is a persona who filed, and the app cannot
  support that claim. If a demo needs to show the filed state, it should be reached by the user pressing
  *Înregistrează depunerea* in the demo script, not by a fixture.
- **B-96** (the demo persona's declared VAT status) is resolved by D-DEMO-1, not here. What 6g adds to it:
  a declared VAT *status* is not enough to establish a *cadence*. The route and the branch figure are
  separate facts and must be declared per persona.

---

## 15. Explicitly not implemented

- **B-94 — the 50 % VAT vehicle rule lapsing 31 Dec 2026: not implemented.** No expiry flag, no
  release-boundary warning, and no rule-version handling was added. `domain/fiscal/deductibility2026.ts`
  and `domain/fiscal/release2026.ts` are off-limits to this phase, so the flag cannot live where the rule
  does. **B-94 stays open and needs its own brief.** Anyone rendering the 50 % cut for a 2027 period today
  is rendering a rule that no longer applies, and nothing in the app says so.
- **Norme pct. 103 alin. (4)–(5)** — semester and year periods by *cerere*. See §3.
- **The alin. (7) / alin. (8) facts are modelled but not collected in the UI.** `aicFlipForQuarter`,
  `aicMentiuniObligation` and the distinct-period shape exist and are tested at the domain level, but
  `pages/Settings.tsx` has no field where a person reports the month an intra-community goods acquisition
  made the tax exigible. Until it does, the split calendar and the 5-working-day duty can be computed but
  cannot be triggered from the app. **This is the single largest remaining gap in 6g and it is a UI gap, not
  a modelling gap.**
- **The art. 305 capital-goods regularisation schedule and the art. 300 alin. (14) annual adjustment are
  not applied to any figure.** 6f left them unimplemented and 6g did not change that, so `rd. 33` and
  `rd. 34` are drawn **without a value** and say why. Presenting a number there would be inventing one.
- **No allocation across the letters of `rd. 20–28`.** The same register line carries no rubric indicator,
  so any split across those letters would be an invented attribution. The layout states the range and says
  the app does not distribute across it.
- **No reminder for the art. 322 alin. (9) *cerere* deadline** (25 February), because the alternative
  periods it applies to are not modelled.

---

## 16. Research gaps left open

From `research/33` Part 2:

- **The rounding rule for the pro-rated alin. (3) cap** — recorded as a negative finding; surfaced as a gap
  note, not resolved. Needs a decision, not more searching: the search already came back empty.
- **Whether Norme pct. 103 alin. (3) prunes the alin. (4) figure as well as the alin. (2) figure** —
  unresolved tension; the app asks which turnover a declared figure covers rather than choosing.
- **The rate-date question itself** — pct. 103 alin. (2) fixes 31 December of the preceding year, and that
  is what is used. `research/33` marks the resulting **509.630 lei** as **CORROBORATED, secondary**: no
  primary source states the lei figure, only the derivation. If a future phase wants to publish a lei
  threshold for the periodicity cap, it must re-derive it and show the rate, exactly as here.

From `research/42` §7:

- **Where exactly the 50 % vehicle cut lands between `rd. 20–28` and `rd. 33/34`.** §7 records that it
  lands partly inside and partly outside `rd. 20–28`; it does not record the split. The layout therefore
  names both places and places nothing.
- **The OPANAF order that approves the 2026 form** — `OPANAF nr. 174 din 05.02.2026`, MO I nr. 105 din
  09.02.2026 — is cited on every rubric row and in the v19 migration note. The rubric numbers themselves
  come from that order as recorded in `research/42`; they were not re-verified against the published form
  in this task, and the panel says plainly that it shows the schema of the rubrics and not a facsimile.
