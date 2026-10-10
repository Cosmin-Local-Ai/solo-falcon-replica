# PG-2 — payment and collection dates, and the local-date defaults

**Brief:** `docs/ai/briefs/33_pg2_payment_dates.md` (PG-2 of the production gate).
**Commit:** `700bd2a` (code + tests), this document follows it.
**Baseline it started from:** `a871a68` — `tsc` 0 · 90 unit files / 1453 tests · `build` 0 · e2e 54 (51 functional + 3 axe) · copy-guard allow-list empty.

---

## The gate

PG-2 promised four things: the money date becomes writable where it is missing, the fiscal date actually
used becomes visible, the three UTC-seeded date defaults stop seeding the wrong calendar day (**B-46**),
and the RJIP export stops posting on the document date (**B-66**). The domain was already finished before
this phase started, and nothing in this phase pretends otherwise.

---

## What already existed, and what this phase deliberately did not rebuild

Opened and confirmed in this task, not assumed:

- `src/data/schema.ts` — `collected: z.string().optional()` on the revenue and `paid: z.string().optional()`
  on the expense, and both already appear in the field-descriptor list labelled *„data încasării"* and
  *„data plății"*.
- `src/data/types.ts` — `Revenue.collected` and `Expense.paid` are already optional on the runtime type,
  with the fiscal reading written next to them.
- `src/domain/aggregation.ts` — `revenueFiscalDate` returns `r.collected ?? r.date`, `expenseFiscalDate`
  returns `e.paid ?? e.date`, `inPeriod` is the single eligibility test, and `auditFiscalDates` already
  reports **which field each fiscal date resolved from**, typed as `FiscalDateField = 'date' | 'collected' | 'paid'`
  on `ExcludedFiscalDate.field`.
- `src/domain/fx/ledger.ts` — `LedgerConversion.onDateSource` is typed `LedgerDateSource`, the same three
  values. `src/domain/insights.ts` renders that field with a `FISCAL_DATE_FIELD_LABEL` map.

So the whole gap was: **no screen could write either field, and the surfaces that showed a date never said
which field it came from.** This phase is forms, the export and wording. It changed no fiscal-date rule.

**Not done, on purpose:** no backfill of `collected` / `paid`, and no data-version bump. Both fields are
already optional, so no migration is needed, and `research/37` §4.4 found *no* statutory presumption that
fills in a missing money date — the only provision in that direction is CPF art. 109 alin. (7), which lets
the fiscal body use whatever evidence the taxpayer keeps. Minting a collection date from the invoice date
would invent a legal fact, which is the same reasoning that closed D6 in Phase 11 without a chain step.
`src/data/store.migration.chain.test.tsx` already pins that the payment-dates step backfills nothing, and
this phase left that test untouched.

Absence is representable end to end: an empty money-date input is stored as an **absent field**, never as
`''` (an empty string would fail the load gate and quarantine the payload), and the new tests assert
`'collected' in record === false` / `'paid' in record === false` rather than asserting an empty value.

---

## B-46 — the three UTC-seeded defaults

`Revenues.tsx`, `Expenses.tsx` and `Declarations.tsx` each seeded their date field with
`new Date().toISOString().slice(0, 10)` — the **UTC** calendar day. `src/domain/date.ts` opens by stating
that calendar dates in this app must come from the Romanian local calendar date, never the UTC one, and
that the module is the only place `src/` touches the real clock. Three form defaults contradicted that
header. At 00:30 in Bucharest on 1 Jan 2027 all three seeded **31 Dec 2026**, so a record was created in
the previous fiscal year.

All three now call `localDateISO()`, which reads the day through `now()` — the one clock seam — and is
therefore pinned by `pinClock()` like everything else. `Documents.tsx` also dropped its
`new Date().getFullYear()` in favour of `localYear()`, so the year the RJIP selector opens on comes from
the same seam.

**A guard, not a comment.** `src/test/wallClockGuard.test.ts` policed test files only, which is why the
defect could live in production code while the suite stayed green. It now has a second rule: no file under
`src/pages/` or `src/components/` may construct a `Date` with no arguments. The rule is non-vacuous by
construction — it asserts the glob still covers `Revenues`, `Expenses`, `Declarations` and `Documents`.
The epoch accessor (`Date.now()`) is deliberately outside that scan, with the reason recorded in the test
itself; see the findings below for the one call that motivated the carve-out.

### Which tests moved — none, and that is the finding

**No existing test moved because of the B-46 fix, because none of the three defaults had any coverage at
all.** That was checked before editing (the recon found no assertion anywhere in `src/` or `e2e/` on a
date input's initial value, and `Declarations.test.tsx` only ever opens the form over an existing row, so
the `new Date()` branch was never exercised). Nothing was re-baselined: the only line removed from any
existing test file in this commit is an `import` in `Documents.rjip.test.ts`.

Because nothing protected the defaults, coverage was added rather than adjusted:

- `src/pages/Revenues.dates.test.tsx`, `src/pages/Expenses.dates.test.tsx`,
  `src/pages/Declarations.dates.test.tsx` — each pins the clock at `2026-12-31T22:30:00Z`, which is
  00:30 on 1 Jan 2027 in Europe/Bucharest and still 31 Dec 2026 in UTC, and asserts the form field reads
  `2027-01-01`. The instant is written as an explicit `Z` instant so the assertion cannot pass by
  accident on a runner in another time zone. `pinClock()` takes that instant directly; `fixedInstant()` is
  2026-10-31 and the shared constant was **not** edited for one test.
- `e2e/payment-dates.spec.ts` pins the browser clock to the same instant and checks all three forms.
- The new production-surface rule in `wallClockGuard.test.ts`.

**Proof that the new tests bite.** With `Revenues.tsx` reverted to the UTC expression,
`Revenues.dates.test.tsx` fails with `expected '2026-12-31' to be '2027-01-01'`. With `Declarations.tsx`
reverted, the new guard fails naming `src/pages/Declarations.tsx — a Date constructed with no arguments`.
Both were run against the pre-fix source and restored.

---

## Writing the money date

The revenue form gained **„Data încasării"** and the expense form **„Data plății"**, each optional, each
kept separate from the document date — writing the money date never overwrites the document date, and the
tests assert both values come back.

- An empty field is written as an absent field.
- A non-empty value is checked with `isoCalendarDateProblem` / `isoCalendarDateProblemText` from
  `src/domain/date.ts`, so the form names the bad field and stays open instead of letting
  `rejectInvalidDates` in `src/data/store.tsx` refuse the whole record behind a toast.
- The store's existing date validation already covered `collected` and `paid` (`validateRecordDates` in
  `src/data/schema.ts`, whose labels are the same two field names), so no write-path rule was added.

## Showing which date the fiscal year was taken from

`src/components/ui/FiscalDateNote.tsx` renders, on every revenue and expense register row, the field the
aggregate actually used — `data documentului`, `data încasării: 10.01.2027`, or `data plății: 12.01.2027` —
and when the money date puts the record in a different year from the document it appends
`încasat în 2027` / `plătit în 2027`. The prop is typed `FiscalDateField`, and the labels come from
`fiscalDateSource`, a `Record<FiscalDateField, string>` in `src/ui/copy/records.ts`. That is the same
three-value vocabulary `auditFiscalDates` and `LedgerConversion.onDateSource` already speak; no third
spelling was introduced, and a fourth one is a compile error rather than a sentence on screen.

The breakdown that already named a date anchor — the FX conversion rows in `ui/copy/fx.ts`
(`anchoredOnDocumentDate` / `anchoredOnMoneyDate`, headed by `onDate: 'Data care ancorează cursul'`) —
needed no change of behaviour, only a stale comment corrected: it claimed no screen could write
`collected` / `paid`, which stopped being true in this phase. The note now means exactly what it says:
this record has no money date recorded.

The RJIP register states its own date column and counts the rows that rest on the fallback — see below.

---

## B-66 — the RJIP posts on the money date

`src/pages/Documents.tsx` built its register rows with `r.date` / `e.date` and filtered the year with
`date.slice(0, 4)`, never reading `collected` or `paid`. `research/37` §4.1 quotes OMFP 170/2015 cap. V:
the register is kept „în funcție de data efectuării operațiunii de încasare/plată", and its mandatory
information list opens with that date, followed by „denumirea și numărul documentului justificativ". The
money date is the register's date column; the document is a separate cross-reference — which is what the
`Descriere` cell already carries (fel + număr + counterparty).

The rows are now built by an exported `buildRjipRegister(data, year)`, returning `RjipRow[]` plus the two
counts the surface renders:

- the posting date and the year filter both come from `revenueFiscalDate` / `expenseFiscalDate` — the same
  two functions the estimate and the FX anchor use, so the register and the money figure cannot disagree
  about which year a record belongs to;
- the year list the selector offers is built from the money dates too, so a collection on 10 Jan 2027 makes
  **2027** selectable — otherwise the register for the year the money actually moved could not be produced;
- rows are sorted by the money date, which is the column the chronology is defined on;
- the fallback is counted and said: `documents.rjip.postedOnDocumentDate(n)` states how many of the year's
  rows were posted on the document date because no money date is recorded. The file itself cannot say it —
  the register has one date column — so the surface does.

**The exported bytes did not change shape.** `rjipCsv` is untouched: same BOM, same semicolon separator,
same four columns, same `formatBani` money rendering. `src/pages/Documents.rjip.test.ts`, which pins the
header string and the four-cell row width, passes with its existing assertions unmodified.

Proof in Playwright: `e2e/payment-dates.spec.ts` seeds a revenue dated 2026-12-20 and collected
2027-01-10, opens `/documents#!/reports`, selects 2026 and reads the exported file back (the Blob is
captured before `downloadText` revokes its object URL) — the record is absent from the 2026 register and
absent from any `2026-12-20` cell; selecting 2027 exports it as
`2027-01-10;"Factură FCT-PG2-E2E-003 – Presta Consulting SRL";1.200,00;0,00`.

---

## B-70 — the register reads the ledger disclosure

`Documents.tsx` was the one place in the app that answered „what is foreign and unconvertible?" without
going through `getLedgerDisclosure`: it skipped rows with `!isRon(valoareFaraTva) || !isRon(tva)` and
counted the skips with a separate `foreignCount` memo that tested only `valoareFaraTva`. Both are gone.
The register now reads the disclosure the dashboard's money surfaces read:

- a record in `LedgerConversion` (a recorded BNR rate converted it) enters the leu register at
  `sumBani([netLei, vatLei])` — the same lei amount the totals already contain;
- a record in `UnconvertedRecord` (no rate) stays out, and `register.unconverted` is the count rendered
  beside the register.

**This is a behaviour change, and it is the point of B-70.** Before this phase a EUR expense with a
recorded rate was excluded from the RJIP while the dashboard counted it in lei — two answers to one
question, one commit apart. It also removes a smaller inconsistency the old code carried: the row filter
tested both amounts while the count tested only `valoareFaraTva`, so a record with a lei net and a foreign
VAT was silently dropped from the register **and** not counted as excluded.

No existing test moved here either: `ReportsTab` was never rendered by any test, and `buildRjipRegister`
is new. The new cases in `src/pages/Documents.rjip.test.ts` pin the converted-foreign case at the published
BNR figure and the no-rate case as counted-and-excluded.

---

## Wording — what the app may claim

Every sentence is `research/37` §5's, and they live in one module (`moneyDate` and the `documents.rjip`
keys in `src/ui/copy/records.ts`) so the two forms and the register cannot each grow their own paraphrase
of art. 68:

- the field hints are §5's second sentence, split along the clause each form owns — completing the money
  date moves the sum to the year the money moved;
- the empty-field hints are §5's third sentence — leaving it empty while the money has not moved is a
  legal state, not an unfinished field;
- `moneyDate.rule` is §5's first sentence: the fiscal year follows the collection date and the payment
  date, not the document date;
- `documents.rjip.postedOn` names OMFP 170/2015 cap. V as the reason the register's date column is the
  money date, and says the document is the cross-reference in `Descriere`.

The claims §5 forbids appear nowhere in the diff. In particular: no string says the document date
determines or stands in for the fiscal year; none says the law presumes document date = money date or
treats a blank money date as the document date for tax purposes; none calls the app's default „conform
Codului fiscal"; none cites norm pct. 7 alin. (5) lit. v¹) as a timing rule; none uses OMFP 3254/2017
art. 4 alin. (2) „venituri … realizate". The fallback is described as what the app did with the data it
has, never as what the law prescribes.

One note for the record: the D-DATE-1 sentence §5 calls „safe as written" („completează acest câmp dacă ai
încasat plata într-un an fiscal diferit de cel al facturii") is **not in the tree** — no copy key carries
it. The new field hints are the §5 sentence in its place.

The copy guard still passes with `ALLOW_LIST` empty, and its „no sentence spelled twice" rule is what kept
the §5 sentences in one module instead of three call sites.

---

## Findings, not acted on

1. **The coverage denominator keys revenues on the document date.** `amountCoverage` in
   `src/domain/completeness.ts` tests the revenue half with `inPeriod(r.date, asOf, fiscalYear)` while the
   expense half uses `inPeriod(expenseFiscalDate(e), asOf, fiscalYear)`. PG-1's handoff claimed the
   denominator „follows automatically because it calls `inPeriod`" — that is true of the expense side only.
   While `collected` was unwritable the asymmetry was unreachable; now that the form can write it, a
   revenue collected on 10 Jan 2027 stays inside the **2026** weighted-coverage denominator while the
   estimate excludes it from 2026, so the percentage and the figure disagree about the same record.
   `src/domain/completeness.ts` is outside PG-2's may-touch list, and fixing it moves PG-1's completeness
   figures, which is a decision for the orchestrator rather than a change to slip in here. **It should go
   on the defect register.**
2. **`Settings.tsx` builds a bank-account id with `Date.now()`.** Not a calendar date, so it cannot land a
   record in the wrong year, but it is an unpinned clock read in a surface, and `epochMs()` in
   `src/domain/date.ts` exists for exactly that use. `Settings.tsx` is outside this phase's boundary; the
   new guard excludes the epoch accessor and says why, so the exclusion cannot be mistaken for an oversight.
3. **`src/domain/date.ts`'s header claim is now enforced rather than asserted** for pages and components —
   the module really is the only clock access point in those surfaces, and the guard fails if it stops
   being true. Finding 2 above is the remaining exception elsewhere in `src/`.
4. **Two label maps spell the same three words.** `FISCAL_DATE_FIELD_LABEL` in `src/domain/insights.ts`
   and `fiscalDateSource` in `src/ui/copy/records.ts` both render `data` / `data încasării` / `data plății`.
   Same vocabulary, same values, two maps. Folding them means either moving a domain label map into the
   language layer or exporting one from the domain; `insights.ts` is outside this phase's boundary.

---

## Handoff

- **Nothing date-shaped is left unwritten.** `collected` and `paid` have fields, the registers name the
  field they used, and the export posts on it. PG-3 (onboarding) may ask for the money date during first
  run; the form fields and the copy keys are already there to reuse.
- **PG-4 / PG-6** own the `refused` and `closed_final` triggers and `fact_missing`; nothing in this phase
  touched the status union.
- **PG-8** (the calculation breakdown) is where the per-record fiscal date would belong inside the
  estimate's own „Cum am ajuns la această sumă" table; that table renders engine lines only, and
  `src/pages/Dashboard.tsx` is outside PG-2's boundary.
- **Finding 1** is the one item that should be scheduled, not filed: it is a live disagreement between two
  surfaced numbers, created by this phase making `collected` writable.

---

## Validation

- `npx tsc --noEmit` — 0 errors.
- `npx vitest run` — **93 files / 1 474 tests, all passing** (baseline 90 / 1 453: +3 files, +21 tests).
- `npm run build` — 0 errors (the pre-existing chunk-size advisory only).
- `npx playwright test` — **58 passing** (55 functional + 3 axe; baseline 54 = 51 + 3).
- `src/ui/copy/copy.guard.test.ts` passes with `ALLOW_LIST` still empty.
- `src/test/wallClockGuard.test.ts` now carries the B-46 rule over `src/pages/` and `src/components/`, and
  was checked against the pre-fix source to confirm it fires.

Tests written for this phase: `src/pages/Revenues.dates.test.tsx`, `src/pages/Expenses.dates.test.tsx`,
`src/pages/Declarations.dates.test.tsx`, the `buildRjipRegister` block added to
`src/pages/Documents.rjip.test.ts`, the B-46 rule added to `src/test/wallClockGuard.test.ts`, and
`e2e/payment-dates.spec.ts`.
