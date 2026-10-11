## GLOBAL CONTRACT — APPLY TO EVERY PROMPT

You are the LEAD ORCHESTRATOR for this step only.

The project AI ecosystem is:
- SCOUT = local repository inspection only; read-only; NEVER modifies files
- RESEARCHER = internet research only; primary/official sources only
- WORKER = implementation, focused testing, documentation, self-validation
- ORCHESTRATOR = coordination, sequencing, synthesis, handoff

Worker rules
1. Never run more than ONE Worker at a time. Workers are sequential.
2. The Orchestrator spawns the Worker and MUST give it the complete phase list, not a partial one.
3. The Worker MUST spawn the Scouts it needs before modifying anything, and MUST use their reports rather than broadly searching the repository itself.
4. **OVERRIDE — Scouts run SEQUENTIALLY.** One at a time, waiting for each report. Standing user decision (2026-10-10); the roadmap's parallel-Scout permission is not adopted.
5. Each Scout inspects the smallest relevant territory and returns a compact report.
6. If the Worker finds missing local information, it spawns another narrow Scout — it does not search broadly.
6a. **UNDER NO CIRCUMSTANCES does the Worker do any work while a Scout is running.** After dispatching a Scout, **stop and end the turn.** No side-quests, no "meanwhile I'll read this", no drafting, no edits, no repository searching while waiting. Strict sequence: **dispatch one Scout → stop → receive report → read only the files you will actually edit → edit → dispatch the next Scout if needed → stop → …** If work was already started in parallel with a Scout, stop, discard that parallel searching, and wait. The failure mode this prevents: the Scout's report arrives after the Worker has already searched the repository itself, which wastes the Scout, burns the Worker's context, and defeats §12.9 entirely.
7. One Worker = one coherent, tightly scoped job.
8. Do NOT spawn a post-Worker Scout verification pass. The Worker self-validates instead.
9. Self-validate: npx tsc --noEmit, npm run build, npm run test, npm run test:e2e.
10. Do not start future phases. Stop when this phase's acceptance criteria are met.

**Scout infrastructure — known defect.** The scout profile's default model produces no output. **Use the explicit override `llama-cpp/qwen3.8-flash-next-iq3_s` from the start.** If it fails too, STOP and report a BLOCKER.

**Engine instability — known.** 262k context, ~390 MiB free, one slot, SIGKILLed under load. If killed, **on-disk work survives** — resume and continue. Checkpoint early and often.

Worker handoff format (mandatory)
```
COMPLETED:
FILES CHANGED:
TESTS:
VALIDATION:
DECISIONS:
BLOCKERS:
NEXT HANDOFF:
```



## READ FIRST
- **`docs/ai/briefs/28_pg_production_gate.md` §PG-1 and §7.** PG-1 is the gate on Phase 13 and the biggest trust defect on record: **the hero badge stays green while records are dropped.**
- **`docs/ai/phases/26_fx_end_to_end.md`** — the normalised ledger, `DashboardData.ledger`, and **B-68**.
- `docs/ai/phases/28_phase11_first_run.md` §12 — B-68 is closed **for the dashboard only**; other pages' empty-state gates were never checked against a present-but-excluded ledger.
- `docs/ai/PHASE_PLAN_11_34.md` §12.9 (scouts, sequential, and **rule 6a: no work while a scout runs**), §12.10, §12.11.

## WHAT ALREADY EXISTS — verified in-tree at `4007836` on 2026-10-10

**This is not a green-field modelling task. Exclusions are already modelled and already surfaced — in one place.**

- **`src/domain/estimateBasis.ts:210`** — `export type ExcludedReason = 'undetermined' | 'non_deductible' | 'cap_unresolved' | 'foreign_currency';` **`foreign_currency` is already in the union**, which overlaps the FX disclosure Phase 10c added. **Reconcile the two; do not let one record be reported twice under two vocabularies.**
- **`estimateBasis.ts:229`** — `ExcludedExpenseRecord` carries the reason **and the rule behind it**. Refusal is already a concept: `:117` *"The basis a refused estimate carries: a reason, and nothing else."*
- **`src/pages/Expenses.tsx:222-233`** already branches exclusions by reason — `unclassifiedIds`, `capBlocked` (`reason === 'cap_unresolved'`), `foreignBlocked` (`reason === 'foreign_currency'`). **A per-reason UI pattern already exists in this house. Reuse it; do not invent a second one.**
- **`src/domain/tax.ts:71-79`** — the result union is only two members: `{ status: 'computed' }` and `{ status: 'review_required'; reason; lines }`. **PG-1 asks for a wider, explicit status union.**
- **`src/data/dashboard.ts:136-151`** — `DashboardData` carries `tax: TaxEstimateWithBasis | null`, `estimateState: TaxEstimateState`, `thresholds`, `deadlines`, `completeness`, and (from 10c) `ledger: { conversions, unconverted }`. The `null`-vs-sentinel distinction was fixed in TASK 8 — *"nothing has been calculated yet"* and *"the engine refused"* are no longer the same value. **Preserve that.**
- **`src/domain/completeness.ts:205-207`** — the circular check PG-1 must remove: it reports completeness from *"estimare de taxe calculată disponibilă"* over `list.length` **instantanee calculate**. **A check that says "the estimate ran" is not evidence the estimate is complete.** Its copy lives at `src/ui/copy/dashboard.ts:53` (`title: 'Estimare impozit'`).

**The gap is therefore surfacing and status, not modelling:** the estimate's exclusions exist in the domain but do not reach the hero, the estimate status, or the completeness percentage.

## SCOPE — PG-1

**The hero may say "Calculat" only when every recorded record is either included or deliberately, visibly excluded.**

1. **Coverage on the estimate result:** `{ recordId, kind, reason, amount, fixTarget }`, with reasons at least `unclassified`, `undetermined`, `asset_not_modelled`, `missing_fx_rate`, `rejected`, `pending`, `fact_missing` (reserved for PG-6). **Map the existing `ExcludedReason` values onto this rather than running a parallel vocabulary.**
2. **Estimate status becomes an explicit union:** `complete | incomplete | review_required | refused | closed_final`. The last two are used by PG-4 / PG-6 — **declare them now, do not implement their triggers.**
3. **Hero badge + count + deep link**, one attention row per reason group, reusing the existing `…#!/rejected?f=<id>` link pattern.
4. **Completeness becomes a weighted percentage** — share of recorded **amount** included — plus profile-fact completeness. **Remove the circular "Estimare impozit" check.**
5. **Expense and Revenue rows show `nu intră în estimare: <motiv>`.**
6. **Read `DashboardData.ledger` rather than re-walking records** — Phase 10c's handoff asks for this explicitly, and it is the same pass and the same list.

## SCOUT DISPATCH — mandatory, **SEQUENTIAL**, and **no work while a scout runs**

**Dispatch one scout, then STOP and end the turn. No side-quests, no reading, no editing, no repository searching while a scout is in flight.** Wait for the report, act on it, then dispatch the next. §12.6 (C5) and §12.9 rule 6a. The parallel-scout guidance in your agent definition is **not adopted here.**

**Scout these, one at a time:**
- **Scout A — every consumer of `estimateState` and `TaxEstimateWithBasis` across `src/`.** Which surfaces read it, which branch on `'computed'` vs `'review_required'`, and where the hero badge is decided. **You will not read those files whole.**
- **Scout B — every consumer of `ExcludedReason` and `ExcludedExpenseRecord`**, including the tests that pin them. This is the vocabulary you must not fork. **You are not editing `estimateBasis.ts`'s exclusion logic.**
- **Scout C — every empty-state / zero-record gate in `pages/Expenses.tsx`, `pages/Revenues.tsx`, `pages/Documents.tsx` and `components/dashboard/*`**, with line ranges. **B-68 is only closed for the dashboard** — this scout is what tells you whether the other pages have the same bug. **You may not need to edit most of these.**

Keep each task **short and single-purpose** — the scout model went silent on 3 of 5 runs in PG-0. If a scout returns nothing, re-dispatch it **once**, narrower; if it fails twice, **stop and report a BLOCKER.** **Never scout a file you are going to edit.**

## BOUNDARIES
- **May touch:** `domain/estimateBasis.ts` (result shape and coverage only), `domain/completeness.ts`, `domain/tax.ts` (**result shape only**), `data/dashboard.ts`, `components/dashboard/*`, `pages/Expenses.tsx`, `pages/Revenues.tsx`, `ui/copy/*`, new tests, `e2e/*`.
- **Must not touch:** the calculators, rule values, the rule registry, thresholds, snapshots, the migration chain, or the FX layer. **Do not touch `domain/date.ts`, `src/test/clock.ts`, `src/test/fixedInstant.ts`.**
- **Never touch `docs/ai/steps/`.**

## LANDMINES
1. **Do not fork the exclusion vocabulary.** `ExcludedReason` already exists with four members, one of which (`foreign_currency`) overlaps Phase 10c's ledger disclosure. **One record, one reason, one surface.** A record reported twice under two names is worse than a record reported once wrongly.
2. **Do not re-walk the ledger.** `DashboardData.ledger` is the same pass. A second traversal will drift from the first the moment either changes.
3. **Removing the circular completeness check will move the percentage.** Expect existing tests to fail. **That is a true finding — report the new numbers, do not re-baseline them to keep the suite green.**
4. **`null` and `review_required` are not the same value** (TASK 8). Do not reintroduce the sentinel.
5. **B-68 again:** every gate you touch must be tested against a ledger that is **present but excluded**, not only one that is absent.
6. **`Bani` is integer lei** — the weighted percentage divides bani by bani. Never `toFixed` on a `Bani`, and guard the zero-denominator case.
7. **Use `pinClock()` and `fixedInstant.ts`.** Expected counts after Phase 11: **85 unit files / 1409 tests**, **e2e 49 = 46 functional + 3 axe**.

## BASELINE (from the Phase 11 handoff at `05ab925`)
`tsc` 0 · **85 test files / 1409 unit tests, all passing** · `build` 0 · **e2e 49** (46 functional + 3 axe) · copy-guard allow-list empty.

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
Roadmap 1–10 DONE · pre-Phase-11 TASKS 1–9, 10a, 10b DONE · research closed (`research/28`…`research/37`) · **10c DONE (`ab7df41`)** · **PG-0 DONE (`def8a3c`)** · **Phase 11 + PG-3 DONE (`05ab925`), B-47 and D1 closed, B-68 closed for the dashboard.**
- **PG-1 ← THIS BRIEF.**
- Then **PG-2 / 12C** (payment and collection dates — **B-46**, **B-66**, and the `onDateSource` vocabulary all land there), then PG-3 … PG-13.

## ACCEPTANCE
Each of the gate's five evidence rows — no-category expense, `depreciable_asset_purchase`, undetermined `home_office_shared_cost`, €5.000 expense with no rate, €5.000 revenue with no rate — must produce:
1. estimate status **`incomplete`**, hero **"Estimare incompletă"**, a count, and an action row with a **working** deep link;
2. a badge on the offending row and `nu intră în estimare: <motiv>` on the record itself;
3. a **lower** weighted completeness percentage than the same profile without that record;
4. **fixing the cause returns it to `complete`** — prove the round trip, not just the failure.
5. The €5.000 cases must be reported by the **ledger disclosure path**, not by a second FX walk.
6. The circular "Estimare impozit" check is gone, and the completeness percentage is stated in the phase doc **before and after**.
7. `tsc` 0 · unit tests pass · `build` 0 · e2e green including axe · guard allow-list empty.

## HANDOFF
Write **`docs/ai/phases/29_pg1_estimate_coverage.md`**. State the before/after completeness figures, name any page whose empty-state gate you found to have the B-68 bug, and hand anything date-shaped to PG-2. **§12.11 applies to this document: if a sentence in it names a file, an identifier, a data version, a migration step or a line number, you must have opened that source in this task.** Do not write any of it from memory or from your own earlier summary — you will not be able to tell that your context was compacted, so do not rely on noticing it.


## READ FIRST
- **`docs/ai/briefs/28_pg_production_gate.md` §PG-2.**
- **`docs/ai/research/37_cash_basis_date_semantics.md` — §2, §4 and especially §5.** §5 contains the **approved Romanian sentences** the UI may show, and the list of what must **not** be claimed. Use that file's wording; do not paraphrase the law yourself.
- `docs/ai/phases/26_fx_end_to_end.md` — `onDateSource`, the ledger disclosure, and **B-66**.
- `docs/ai/phases/29_pg1_estimate_coverage.md` — Decision 2 (assemble once, surfaces read it) and the **B-70** findings.
- `docs/ai/PHASE_PLAN_11_34.md` §12.9 (sequential scouts, **rule 6a: no work while a scout runs**) and §12.11 (write the doc from the diff).

## WHAT ALREADY EXISTS — verified in-tree at `a871a68` on 2026-10-10

**The domain is finished. This is a UI and export task. Do not build fiscal-date logic.**

- **`src/data/schema.ts:101` `collected: z.string().optional()`** and **`:118` `paid: z.string().optional()`**. Both already appear in the field-descriptor list at `:482` / `:486` with labels *„data încasării"* and *„data plății"*.
- **`src/domain/aggregation.ts:295` `revenueFiscalDate(r) → r.collected ?? r.date`** and **`:308` `expenseFiscalDate(e) → e.paid ?? e.date`**. `inPeriod(date, asOfDate, fiscalYear)` at `:205`.
- **`aggregation.ts:274-277` `auditFiscalDates` already reports which source each date resolved from** — `'collected' | 'paid' | 'date'`. Phase 10c added the same vocabulary as `LedgerConversion.onDateSource` (`fx/ledger.ts:234-237`). **That is the vocabulary the UI should show. It already exists in two places — reuse it, do not add a third.**
- **`src/domain/fiscal/deductibility.ts:366`** already documents the intended call: *"`asOfDate` should be `expense.paid ?? expense.date`."*
- **The three UTC defaults (B-46), exactly:** `src/pages/Expenses.tsx:47`, `src/pages/Revenues.tsx:30`, `src/pages/Declarations.tsx:31` — all `new Date().toISOString().slice(0, 10)`. At 00:30 local on 1 Jan 2027 that seeds **31 Dec 2026** — the wrong fiscal year.
- **The fix already exists:** `src/domain/date.ts` exports `localDateISO(instant?)` and `localYear(instant?)`, with `now()` at `:21` as the single wall-clock seam.
- **B-66, still live:** `src/pages/Documents.tsx` builds RJIP rows from `r.date` / `e.date` and filters the year with `date.slice(0,4)`, never reading `collected` / `paid`.
- **B-70, still live:** the same file answers the FX question with its own `isRon` filter and a `foreignCount` memo instead of `getLedgerDisclosure`.

### Refusals that are decisions, not gaps — leave them alone
- **Do not backfill `collected` / `paid` from the document date, and do not bump the data version.** Both fields are already optional, so no migration is needed. Backfilling would **mint a money date nobody recorded** — the same reasoning that closed D6 in Phase 11 without a chain step. Absence must stay representable.
- **Do not change `revenueFiscalDate` / `expenseFiscalDate`.** The `?? date` fallback is a deliberate Phase 9 decision and PG-1's weighted coverage already depends on it.

## SCOPE — PG-2

1. **Expose „Data încasării" on the revenue form and „Data plății" on the expense form**, persisting to `collected` / `paid`, each keeping the document date separately.
2. **Show the fiscal date actually used**, in the record list and the breakdown, using the existing `'collected' | 'paid' | 'date'` vocabulary — so a user can see *why* a record landed in a given year.
3. **Fix the three UTC defaults** with `localDateISO()`.
4. **Fix the RJIP export (B-66):** post on the money date and filter the year by the money date, falling back to the document date only when no money date exists — and **say which one it used**. OMFP 170/2015 cap. V makes „data efectuării operațiunii de încasare/plată" the register's mandatory date column, with the document as a separate cross-reference column.
5. **Fix B-70 in the same file:** `Documents.tsx` must read `getLedgerDisclosure` instead of running its own `isRon` filter and `foreignCount` memo.
6. **B-67 — the wording.** The document-date stand-in has **no legal footing for Titlul IV**. The existing note is safe as written; what must not appear anywhere is any claim that the document date determines the fiscal year, that the law presumes document date = money date, or that the app's default is „conform Codului fiscal". **Use the sentences in `research/37` §5.**

## SCOUT DISPATCH — mandatory, **SEQUENTIAL**, and **no work while a scout runs**

**Dispatch one scout, then STOP and end the turn.** No reading, no editing, no searching while one is in flight. Wait for the report, act on it, then dispatch the next. §12.6 (C5), §12.9 rule 6a. The parallel-scout guidance in your agent definition is **not adopted here.**

**Scout these, one at a time:**
- **Scout A — every consumer of `revenueFiscalDate`, `expenseFiscalDate`, `inPeriod` and `auditFiscalDates` across `src/`.** This is the blast radius of making the money date writable; **you are not editing `aggregation.ts`.**
- **Scout B — every place a date default is seeded across `src/`** (`new Date()`, `toISOString().slice`, any date input's initial value), plus what `domain/date.ts` already offers. **You are not editing `domain/date.ts`.**
- **Scout C — every existing assertion in `e2e/` and in the unit tests that pins a fiscal year or a date default**, so you know before you start which of them will move. **You may not need to edit most of them.**

Keep each task **short and single-purpose**; the scout model went silent on 3 of 5 runs in PG-0. If a scout returns nothing, re-dispatch it **once**, narrower; twice → **stop and report a BLOCKER.** **Never scout a file you are going to edit.**

## BOUNDARIES
- **May touch:** `pages/Revenues.tsx`, `pages/Expenses.tsx`, `pages/Declarations.tsx`, `pages/Documents.tsx`, `components/*` for the date fields, `data/dashboard.ts` only if the disclosure needs threading, `ui/copy/*`, new tests, `e2e/*`.
- **Must not touch:** `domain/aggregation.ts`, `domain/date.ts`, `domain/fx/*`, `domain/tax.ts`, `domain/estimateBasis.ts`, the calculators, rule values, the registry, the migration chain, `src/test/clock.ts`, `src/test/fixedInstant.ts`.
- **Never touch `docs/ai/steps/`.**

## LANDMINES
1. **Do not backfill and do not bump the data version.** A required or backfilled money date invents a legal fact. Absence is the honest third state and the schema already allows it.
2. **The RJIP is a document the tax office reads.** A wrong date there is not a display bug. Use `formatBani`, never `toFixed`, and keep the BOM and semicolon format the existing tests pin.
3. **Fixing B-46 will move existing tests** that were written against a UTC-seeded default. **That is a true finding — report which ones moved and why; do not re-baseline silently.**
4. **Do not claim a legal rule the research does not support.** `research/37` §5 lists the forbidden claims explicitly, including citing norm pct. 7 alin. (5) lit. v¹) as the timing rule (it is an entry in a list „cu titlu de exemplu") and citing REF art. 4 alin. (2) „venituri … realizate" as accrual recognition.
5. **One vocabulary for the date source.** `auditFiscalDates` and `onDateSource` already say `'collected' | 'paid' | 'date'`. A third spelling of the same idea is the B-70 mistake repeated.
6. **Use `pinClock()` and `fixedInstant.ts`.** To prove B-46 you need a clock at **00:30 local on 1 Jan 2027** — `fixedInstant()` is 2026-10-31, so use `pinClockAt()` for that case rather than editing the shared constant.
7. **Expected counts after PG-1: 90 unit files / 1453 tests, e2e 54 = 51 functional + 3 axe.**

## BASELINE (from the PG-1 handoff at `a871a68`)
`tsc` 0 · **90 test files / 1453 unit tests, all passing** · `build` 0 · **e2e 54** (51 functional + 3 axe) · copy-guard allow-list empty.

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
Roadmap 1–10 DONE · pre-Phase-11 TASKS 1–9, 10a, 10b DONE · research closed (`research/28`…`research/37`) · **10c DONE (`ab7df41`)** · **PG-0 DONE (`def8a3c`)** · **Phase 11 + PG-3 DONE (`05ab925`)** · **PG-1 DONE (`a871a68`)**.
- **PG-2 ← THIS BRIEF.**
- Then **PG-3** (onboarding depth), **PG-4** (the `refused` trigger), **PG-5**, **PG-6** (`closed_final`, `fact_missing`, activity family, other income), **PG-7 … PG-13**.

## ACCEPTANCE
1. An invoice dated **20 Dec 2026** collected **10 Jan 2027** is **excluded from the FY2026 estimate** and shown as încasat în 2027 — **after a reload**, proven in Playwright.
2. An expense documented **Dec 2026** paid **Jan 2027** behaves the same way.
3. **At 00:30 local on 1 Jan 2027 under a fixed clock, a new record defaults to 1 Jan 2027**, not 31 Dec 2026 — for all three forms.
4. The record list and the breakdown **show which date the fiscal year was taken from**, using the existing vocabulary.
5. **The RJIP export posts the 10 Jan 2027 collection in the 2027 register under 10 Jan 2027**, and the year selector offers 2027 for it. Prove it by reading the exported CSV in a test.
6. `Documents.tsx` no longer carries its own `isRon` / `foreignCount` derivation.
7. No UI string anywhere claims the document date sets the fiscal year or that the default is legally mandated. **Quote `research/37` §5 for anything the UI does say.**
8. `tsc` 0 · unit tests pass · `build` 0 · e2e green including axe · guard allow-list empty.

## HANDOFF
Write **`docs/ai/phases/30_pg2_payment_dates.md`**. Per §12.11: **write it from your own diff** — every path and identifier you name must appear in that diff or in a file you opened this task, and **cite no line numbers**, because they rot within one commit. List every test that moved because of the B-46 fix.


## READ FIRST
- **`docs/ai/briefs/28_pg_production_gate.md` §PG-4** — the drift table and the closed-year evidence.
- **`docs/ai/USER_DECISIONS.md` — D-YEAR-1 and D-YEAR-2.** Both are **decided**; you implement them, you do not re-open them. D-YEAR-1: on 1 January the app switches to the new fiscal year **automatically**, with **a toggle back to a previous year** and **a banner**. D-YEAR-2: carry forward, update when the datum arrives.
- `docs/ai/research/26_midyear_start_partial_year_2026.md`, `research/27_norme_metodologice_prorating_2026.md`, `research/32_fy2027_sunsets_carry_forward.md`, `research/29_anaf_calendar_2026_and_rollover_authority.md`.
- `docs/ai/phases/30_pg2_payment_dates.md` — the four findings handed forward, one of which (**B-71**) is in this brief.
- `docs/ai/PHASE_PLAN_11_34.md` §12.9 (sequential scouts, **rule 6a**) and §12.11 (write the doc from the diff).

## WHY THIS IS URGENT, NOT ROUTINE
**The first real date boundary is about twelve weeks away.** On 1 Jan 2027 the app switches year and then computes nothing — there is **no 2027 rule package** (`B-58`). And until then, **a closed fiscal year drifts every single day**, because a finished year is still being annualised:

| as-of | today's behaviour |
|---|---|
| 31 Dec 2026 23:30 | „12 din 12 luni", estimate 3.112 — correct |
| 15 Jan 2027 | still „An fiscal 2026", „12,5 din 12 luni", estimate **3.086** |
| 26 May 2027 | „16,8 din 12 luni", estimate **2.916** |

## WHAT ALREADY EXISTS — verified in-tree at `3292a31` on 2026-10-10

- **`src/domain/projection.ts:98 selectProjectionV1(data, asOfDate)`** — `:100` takes `months = elapsedMonths(fiscalYear, asOfDate)` and `:101` `denom = months > 0 ? Math.max(1, months) : 0`. **That is the fiscal-year denominator, not the PFA's active period.** This is **B-44**: a PFA started 1 Oct 2026 with 10.000 lei on 3 Oct is divided by elapsed calendar months.
- **`pfaStartDate` exists** (`domain/models.ts:242`) and is optional; its own comment says it is read by the engine **only** to surface CF art. 118 alin. (3) — *„Veniturile din categoriile prevăzute la art. 61 lit. a) … ce se realizează într-o fracțiune de an … se consideră venit anual."* **It does not drive the projection today.**
- **`selectRuleSet` lives in `src/domain/fiscal`** and is called at `src/data/derived.ts:44` and `:81`, both as `selectRuleSet(store.profile.fiscalYear, asOfDate)`. **There is no 2027 release**, so a 2027 year has nothing to select.
- **The fiscal year is currently only a manual Settings field** — there is no lifecycle.
- **PG-2 shipped the money date.** `revenueFiscalDate` / `expenseFiscalDate` resolve `collected ?? date` and `paid ?? date`, and `auditFiscalDates` reports the source as `'collected' | 'paid' | 'date'`.

## SCOPE — PG-4

1. **Projection runs over the PFA's actual active period**, not the calendar year: `[max(Jan 1, pfaStartDate), Dec 31]`. For a mid-year start, **project to year end, not ×12**. Handle: newly started, zero elapsed active time, future start date, no transactions, losses, partial first month, leap years — **no division by zero, no false precision.** `elapsedMonths ≤ activeMonths`, never > 12.
2. **Closed-year state.** When `asOf` is after 31 Dec, the estimate is a **final calculation from actuals**, labelled *„Calcul final pentru 2026"*, with **no run-rate wording and no daily drift**; thresholds use actual figures.
3. **Year lifecycle per D-YEAR-1**: automatic advance on 1 Jan, a toggle back to a previous year, and a banner. **A year with no rule package yields `review_required` + „Regulile pentru 2027 nu sunt încărcate" — never a silent zero, never a stale 2026 figure presented as current.**
4. **The hero figure is computed from actuals only**, labelled with the as-of date. A forecast may sit beside it, **visually distinct**, and must **never** feed the engine or the thresholds.
5. **B-71 — fix the coverage denominator.** `src/domain/completeness.ts:247` filters revenues with `inPeriod(r.date, …)` while `:252` filters expenses with `inPeriod(expenseFiscalDate(e), …)`. **Use `revenueFiscalDate(r)`.** This is live now that `collected` is writable: a revenue documented 20 Dec 2026 and collected 10 Jan 2027 stays in the **2026** denominator while the estimate correctly excludes it from 2026 — **the percentage and the figure disagree about the same record.** **It moves PG-1's published completeness figures: restate before and after, do not silently re-baseline.**
6. **Hygiene folded in:** `src/pages/Settings.tsx:372` builds a bank-account id with `Date.now()` when `epochMs()` exists; and two label maps spell the same three words (`insights.ts` `FISCAL_DATE_FIELD_LABEL` vs `copy/records.ts` `fiscalDateSource`) — **fold them into one.**

### Refusals that are decisions, not gaps — leave them alone
- **Do not prorate the 12-SM, 24-SM, 6-SM or 72-SM figures** for a mid-year starter — **art. 151 alin. (2)**. Keep **art. 151 alin. (3)** (the newly-exempt case) **visibly separate**; it is a different rule.
- **Cite art. 118 alin. (3), not alin. (2).** The pre-2024 numbering is a live trap in this area.
- **Scope the "proration was removed" claim to the code.** The Norme metodologice reproduced in ANAF's current edition **still contain prorating language and worked examples**; their status after HG 602/2025 is recorded in `research/27`. Do not assert in the UI that proration no longer exists in the norms.
- **Do not build a continuous 24-month chart.** The fiscal series belongs to one fiscal year: 2026 is *final from actuals*, 2027 is *projected*, and one line blends two different kinds of number. **Tax paid in May 2027 is not a 2027 expense** — it settles a 2026 obligation, and putting it in the 2027 series double-counts the burden. **The chart stays per-year; what crosses the boundary is the obligation, not the chart.**
- **Do not invent a 2027 rule package.** No verified 2027 figures exist and the 2027 minimum wage is not published (D-YEAR-1 records this explicitly; `research/32` shows why every SM-derived figure is unsafe to carry forward).

## SCOUT DISPATCH — mandatory, **SEQUENTIAL**, and **no work while a scout runs**

**Dispatch one scout, then STOP and end the turn.** No reading, no editing, no searching while one is in flight. Wait for the report, act on it, then dispatch the next. §12.6 (C5), §12.9 rule 6a. **The parallel-scout guidance in your agent definition is not adopted here.**

**Scout these, one at a time:**
- **Scout A — every consumer of `ProjectionV1`, `selectProjectionV1` and `elapsedMonths` across `src/`.** This is the blast radius of changing the denominator; **you will not read most of those files.**
- **Scout B — the rule-release registry: what releases exist, how `selectRuleSet` resolves a year, and what a missing year currently yields** at `derived.ts:44` and `:81`. **You are not editing the registry's values.**
- **Scout C — every surface that renders run-rate wording („din 12 luni", „scurse") and every place the chart's projected series is built**, with line ranges. **You may not need to edit most of them.**

Keep each task **short and single-purpose**; the scout model went silent on 3 of 5 runs in PG-0. If a scout returns nothing, re-dispatch it **once**, narrower; twice → **stop and report a BLOCKER.** **Never scout a file you are going to edit.**

## BOUNDARIES
- **May touch:** `domain/projection.ts`, `domain/completeness.ts`, `domain/fiscal/select.ts` (**selection logic only — never rule values**), `data/derived.ts`, `data/dashboard.ts`, `components/dashboard/*`, `components/FinancialChart.tsx`, `pages/Dashboard.tsx`, `pages/Settings.tsx`, `ui/copy/*`, new tests, `e2e/*`.
- **Must not touch:** any rule value, threshold value, statutory citation or registry entry; `domain/aggregation.ts`, `domain/date.ts`, `domain/fx/*`, `domain/tax.ts`, the migration chain, `src/test/clock.ts`, `src/test/fixedInstant.ts`.
- **Never touch `docs/ai/steps/`.**

## LANDMINES
1. **Never let a missing 2027 package produce a zero or a stale 2026 number.** `review_required` plus an explicit message is the only acceptable outcome. A silent zero on 1 Jan 2027 is the worst failure this app can have.
2. **`elapsedMonths` is used by tests as a known quantity** (`estimateBasis.annualCaps.test.ts` pins 10 at 2026-10-31, 12 at year end). Changing the denominator **will** move those. **Report which and why; do not re-baseline silently.**
3. **B-71's fix moves PG-1's completeness figures.** Restate them in the phase doc, before and after.
4. **Do not divide by zero and do not imply precision you don't have.** A PFA with zero elapsed active time has no run rate at all — that is a state, not a number.
5. **The clock helper's export is `pinClock(at)` — there is no `pinClockAt()`.** PG-2 confirmed this the hard way. `fixedInstant()` is 2026-10-31; for the year-boundary cases pass an explicit instant to `pinClock` rather than editing the shared constant.
6. **Expected counts after PG-2: 93 unit files / 1474 tests, e2e 58 = 55 functional + 3 axe.**
7. **`Bani` is integer lei**; the projection stays in Decimal until the end, as `projection.ts:104` already does.

## BASELINE (from the PG-2 handoff at `700bd2a`)
`tsc` 0 · **93 test files / 1474 unit tests, all passing** · `build` 0 · **e2e 58** (55 functional + 3 axe) · copy-guard allow-list empty.

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
Roadmap 1–10 DONE · pre-Phase-11 TASKS 1–9, 10a, 10b DONE · research closed (`research/28`…`research/37`) · **10c DONE (`ab7df41`)** · **PG-0 DONE (`def8a3c`)** · **Phase 11 + PG-3 DONE (`05ab925`)** · **PG-1 DONE (`a871a68`)** · **PG-2 DONE (`700bd2a`), B-46 / B-66 / B-70 closed.**
- **PG-4 ← THIS BRIEF** (Phase 12 projection + B-58 year lifecycle + B-71).
- Then **PG-5** (annual declaration model + deadline "done" state), **PG-6** (unsupported-scenario framework: `closed_final`, `fact_missing`, activity family, other income), **PG-8 … PG-13**.

## ACCEPTANCE — all under a fixed clock
1. **2026-12-31, 2027-01-15 and 2027-05-26 give an identical estimate** for identical data. **No „N din 12" with N > 12 anywhere.**
2. A fixture for an **October-2026 start with 10.000 lei** projects to year end, **not ×12**, and the first partial month is not treated as a full month unless a documented rule says so.
3. A closed year is labelled **„Calcul final pentru 2026"**, shows no run-rate wording, and does not drift day to day.
4. On 1 Jan 2027 with no 2027 package: **`review_required` + „Regulile pentru 2027 nu sunt încărcate"**, a visible banner, and a working toggle back to 2026. **Prove in Playwright that no zero and no stale 2026 figure is presented as current.**
5. The hero figure is actuals-only; any forecast is visually distinct and demonstrably does not feed the engine or the thresholds.
6. **B-71:** the revenue collected 10 Jan 2027 is out of the 2026 weighted-coverage denominator, and the before/after completeness figures are stated in the phase doc.
7. `Settings.tsx` uses `epochMs()`; the two fiscal-date label maps are one.
8. `tsc` 0 · unit tests pass · `build` 0 · e2e green including axe · guard allow-list empty.

## HANDOFF
Write **`docs/ai/phases/31_pg4_active_period.md`**. Per §12.11: **write it from your own diff** — every path and identifier you name must appear in that diff or in a file you opened this task, and **cite no line numbers**, because they rot within one commit. List every test that moved because of the denominator change, and every completeness figure that moved because of B-71.


## READ FIRST
- **`docs/ai/briefs/28_pg_production_gate.md` §PG-5** — the annual-filing model and the deadline "done" rule.
- `docs/ai/phases/31_pg4_active_period.md` — what PG-4 left for you (**B-72**, **B-73**, and the `FiscalYearView` shape on `DashboardData`).
- `docs/ai/PHASE_PLAN_11_34.md` §12.9 (sequential scouts) and §12.11 (write the doc from the diff).

## WHY THIS IS A RELEASE GATE
Phase 18A is listed in §10 as something the app **cannot ship without**. The situation today: this profile files **one** Declarația Unică per year, but the record type is **monthly**, so the app cannot represent the thing the user actually did. The consequence is a trust failure, not a missing feature — **after 25 May 2027 the Dashboard raises an overdue item at high priority even if you filed on time**, and calls it "PFA".

## WHAT ALREADY EXISTS — verified in-tree at `ace252b` on 2026-10-10

- **`src/data/schema.ts` `declarationSchema`** is `{ id, an, luna, venituri, cheltuieli, status, dataInregistrare, dataTrimitere? }` with `luna` constrained 1–12. **It cannot hold a single annual filing.** That is **B-34**, and it is the root of everything below.
- **`src/domain/deadlines.ts`** already has the right event vocabulary: `DeadlineEventType = 'd212_filing' | 'vat_registration'`. Its header records that `pfa_estimated_declaration` was **removed** — its basis (art. 120) was abrogated on 01-01-2025 and it duplicated an obligation. **Do not resurrect it.**
- **Nothing anywhere resolves a deadline from a filing.** `src/data/dashboard.ts` computes `declarationsInAsteptare` as a count of `status === 'in-asteptare'` and nothing consults declarations to decide done/overdue. **This is the gap.**
- **`src/domain/completeness.ts` `declarationCheck`** uses the predicate `list.length > 0` — literally "any declaration exists". PG-5 replaces it.
- **`src/domain/migration.ts` `DATA_VERSION_BASE = 0`** is the base of the chain; the head at `02c6ecf` was **10**. **Confirm the current head yourself before choosing the new version — do not trust this number.**

## SCOPE — PG-5

1. **An annual filing record.** `AnnualFiling { taxYear, form: 'D212', status, filedOn?, reference? }`. The Declarations page becomes **annual**. Migrate from the monthly records through the chain — **see the migration landmine below before you write a line of it.**
2. **The deadline resolver gains a "done" state.** A deadline is **done** when a filing exists for that tax year with a filed status; **overdue only when it is not done.** Label it **„Declarația unică (D212) pentru <an>"** — not "PFA".
3. **Replace the completeness predicate.** "Any declaration exists" becomes "the annual filing for the relevant year exists / is due". Route it through the **one** completeness channel PG-1 built — no parallel warning mechanism (brief 28 §0 rule 6).
4. **B-35 — D300 periodicity.** The seed records **no VAT registration date**, so the periodicity is undetermined by its own facts. **Do not assert a period.** Either require the VAT registration date and prior-year taxable-supplies facts, or show **„Perioada de depunere nu poate fi stabilită — completează…"**. **Remove the monthly D300 cadence.**
5. **B-72 — the basis wording.** `src/domain/estimateBasis.ts` still renders the „N din 12 luni scurse" note. PG-4 clamped N at 12 so it can no longer overstate the count, but for a mid-year starter the „din 12" half describes the **calendar** year while the figure beside it is computed over `activeMonths`. **Make the sentence match the arithmetic.** Wording only — do not touch the calculation.
6. **B-73 — the advance trigger.** The year banner is mounted on the dashboard only, so the automatic advance fires only on the first dashboard open of a new year. A user who lands on Revenues on 2 January sees last year's register. **Move the trigger so it does not depend on which page opens first.** PG-4 already persists the advance and yields to a deliberate choice — keep that, and keep the **local** comparison of `profile.updatedAt`'s year (a UTC prefix comparison silently re-advanced over the toggle-back and Playwright caught it).

## SCOUT DISPATCH — **sequential**, one at a time, no work in flight
- **Scout A — every consumer of `declarationSchema` / `Declaration` and every reader of `data.declarations` across `src/`.** This is the blast radius of changing the record type; you will not edit most of what it finds.
- **Scout B — how `deadlines.ts` currently derives each deadline's state end to end**, with the call path from `data/dashboard.ts` down. **You are not editing the calendar rules it encodes.**

Keep each short and single-purpose. If one returns nothing, re-dispatch it once, narrower; twice, cover the territory with a bounded grep over the files the other scout already named and say so in the handoff. **Never scout a file you are going to edit.** Before you act on any scout report, **grep every file and identifier it names against the tree** (§12.12) — if it names something absent, the report is untrusted in full.

## BOUNDARIES
- **May touch:** `data/schema.ts`, `data/migration.ts`, `domain/deadlines.ts`, `domain/completeness.ts`, `domain/estimateBasis.ts` (**wording only**), `pages/Declarations.tsx`, `data/dashboard.ts`, `ui/copy/*`, `components/dashboard/*`, the app shell for B-73, new tests, `e2e/*`.
- **Added mid-task, orchestrator authorization 2026-10-10:** `domain/insights.ts` — its `DEADLINE_LABELS` map turns the rule's `applies_to` key into 'PFA' and `deadlineLabel()` falls back to 'Termen fiscal' for unknown keys, so acceptance 1's label cannot be produced from `data/dashboard.ts` alone. The wording moves to `ui/copy/dashboard.ts` with **one producer** for the deadline family; `applies_to: 'pfa'` stays untouched as a rule value. Rejected alternative: having `data/dashboard.ts` drop the `d212_filing` rows and emit its own item, which would leave two producers for one family — the B-70 defect class. `data/seed.ts` is also in scope for the monthly D300 rows, with the fact-versus-cadence distinction stated in the phase doc.
- **Must not touch:** any rule value, threshold value, statutory citation or registry entry; `domain/aggregation.ts`, `domain/date.ts`, `domain/fx/*`, `domain/tax.ts`, `domain/projection.ts`, the clock helpers, `docs/ai/steps/`.
- **Never touch `docs/ai/steps/`.**

## LANDMINES
1. **The migration is the dangerous part, and it is where this task can destroy data.** The monthly records are the only place some facts exist. **Do not silently drop them and do not invent an annual filing the user never made.** If a monthly record cannot be mapped to an annual filing without inventing a fact, keep it readable and say what happened. **Bump the data version, and state the mapping explicitly in the phase doc.**
2. **Never mark a deadline done from a record that is not a filing.** `status: 'inregistrata'` on a monthly row is **not** proof anyone filed anything. Only an explicit filed status on an annual filing counts.
3. **B-35: never assert a D300 period the seed cannot support.** A confidently wrong deadline is worse than an admitted unknown.
4. **Do not resurrect `pfa_estimated_declaration`.** Its legal basis was abrogated on 01-01-2025.
5. **The clock helper's export is `pinClock(at)` — there is no `pinClockAt()`.** `fixedInstant()` is 2026-10-31; pass an explicit instant for the 25 May 2027 cases.
6. **Expected counts after PG-4: 97 unit files / 1507 tests, e2e 61 = 58 functional + 3 axe.**
7. **`Bani` is integer lei.**

## BASELINE (from the PG-4 handoff at `c44efb0`)
`tsc` 0 · **97 files / 1507 unit tests passing** · `build` 0 · **e2e 61** (58 functional + 3 axe) · copy-guard allow-list empty · wall-clock guard passes.

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
Roadmap 1–10 DONE · 10a, 10b, **10c** DONE · research closed (`research/28`…`research/37`) · **PG-0** `def8a3c` · **Phase 11 + PG-3** `05ab925` · **PG-1** `a871a68` · **PG-2** `700bd2a` · **PG-4** `c44efb0` (B-44, B-48, B-58, B-71 closed).
- **PG-5 ← THIS BRIEF** (18A + 18B + B-72 + B-73).
- Then **PG-6** (unsupported scenarios; owns `refused` and `closed_final`, both still declared and untriggered), **PG-8** (evidence + snapshots, phase 15 + 20, and PG-2's handoff of the per-record fiscal date into the estimate's own breakdown), **PG-9 … PG-13**.

## ACCEPTANCE — all under a fixed clock
1. **After 25 May 2027 with a recorded filing → no overdue item.** Without one → **exactly one**, labelled **„Declarația unică (D212) pentru 2026"**, linking to the filing form. Prove both in Playwright.
2. A monthly declaration record with `status: 'inregistrata'` **does not** mark the deadline done.
3. The completeness check reports the **annual filing for the relevant year**, not a count of any declarations.
4. **B-35:** with no VAT registration date, the app states the period cannot be established and asks for the fact. **No asserted D300 cadence anywhere.**
5. **B-72:** the basis note no longer describes a calendar year when the figure is computed over the active period.
6. **B-73:** opening Revenues on 2 January 2027 advances the year; the toggle back still works and still survives a reload.
7. The migration is lossless or its losses are stated. `tsc` 0 · unit tests pass · `build` 0 · e2e green including axe · guard allow-list empty.

## HANDOFF
Write **`docs/ai/phases/32_pg5_annual_filing.md`**. Per §12.11: **write it from your own diff** — every path and identifier you name must appear in that diff or in a file you opened this task, and **cite no line numbers**. State the migration mapping explicitly, and list every test that moved with before → after.


## READ FIRST
- **`docs/ai/USER_DECISIONS.md` — D-USER-1 (new).** **There are no active users.** That is the whole reason for this task.
- `docs/ai/phases/32_pg5_annual_filing.md` — PG-5's migration mapping, which this task partially undoes.
- `docs/ai/PHASE_PLAN_11_34.md` §12.11 (write the doc from the diff).

## WHY
PG-5 moved every monthly `declaration` row into a new `legacyDeclarations` bucket **byte-for-byte**, and kept the whole monthly vocabulary alive alongside the new filing vocabulary — purely to protect stored data. **There is no stored data to protect.** A PFA does not file monthly returns, so the product has no use for the shape, and keeping it costs:

- a **second vocabulary kept separate forever** (`'inregistrata' | 'in-asteptare' | 'transmisa' | 'respinsa'` vs `'in_pregatire' | 'depusa' | 'respinsa'`), whose only job is to make sure a monthly row can never be mistaken for a filing;
- a legacy bucket in the schema, the store and the types;
- **B-75**, which exists *only* because those rows were kept — legacy monthly money is bare integer `bani` with no currency record.

**Delete it.** This is cleanup, not a feature.

## WHAT EXISTS — verified in-tree at `d48df68` on 2026-10-10
- `src/data/schema.ts` declares `declarations`, `filings` **and** `legacyDeclarations` — the third exists only for this.
- `src/data/migration.ts` — the **v11 `annual-filing` step** moves `declarations` → `legacyDeclarations` byte-for-byte, opens `filings` as `[]`, writes **no** `legacyDeclarations` key for a payload that never had monthly rows, and derives nothing.
- `src/data/types.ts` still carries `Declaration` as the legacy shape.
- `src/data/seed.ts` has `filings: []` in two places; the three TASK 9 monthly rows were **reused as test fixtures** rather than deleted.
- `src/pages/Declarations.tsx` no longer offers to create a monthly declaration and the store exposes no monthly write path.

## SCOPE
1. **Remove `legacyDeclarations`** from the schema, the store and the types. Remove `Declaration` as a live application type.
2. **Keep the v11 step and its number.** Never renumber or delete a chain step — **change what it does**: a pre-v11 payload's monthly rows are **dropped**, not preserved. `filings` still opens as `[]`. The step must stay idempotent-safe under the chain contract.
3. **Fix the fixtures that were rewritten to depend on monthly rows.** Three tests reuse the TASK 9 monthly rows. Re-premise them on something the product actually supports — **do not delete the assertion they carry.** Say what each became.
4. **B-75 becomes moot — close it**, and say that it was closed by removal rather than by fixing it.

## NO SCOUT NEEDED
Every file here is one you touched in PG-5 and is named above. **If you open a file that is not on this list, stop and read it before editing it** — that is the whole requirement. Do not go repository-hunting.

## BOUNDARIES
- **May touch:** `data/schema.ts`, `data/types.ts`, `data/migration.ts`, `data/store.tsx`, `data/seed.ts`, `pages/Declarations.tsx`, their tests, `e2e/*`.
- **Must not touch:** `domain/projection.ts`, `domain/dashboard` paths, any rule value, threshold, citation or registry entry; `domain/aggregation.ts`, `domain/date.ts`, `domain/fx/*`, `domain/tax.ts`, `domain/estimateBasis.ts`; the clock helpers; `docs/ai/steps/`.
- **Never touch `docs/ai/steps/`.**

## LANDMINES
1. **Do not renumber, reorder or delete a migration step.** Change v11's behaviour in place. The chain's version guard is loud on purpose — PG-5's own first attempt tripped it ("did not set version 11 (got 10)") and that is the mechanism working, not failing.
2. **`isFiledFiling` and the filing vocabulary must survive untouched.** The separation that stops a monthly `'inregistrata'` reading as a submission is worth keeping as a *principle*; what goes is the monthly record type itself.
3. **The axe gate now covers `/declarations`.** Keep it covering that route.
4. **Expected counts after PG-5: 99 unit files / 1549 tests, e2e 68 = 64 functional + 4 axe.** Removing fixtures will move these — report the before/after.
5. **The clock helper's export is `pinClock(at)`** — there is no `pinClockAt()`.

## BASELINE (from the PG-5 handoff at `ab7461d`)
`tsc` 0 · **99 files / 1549 unit tests passing** · `build` 0 · **e2e 68** (64 functional + 4 axe) · copy-guard `ALLOW_LIST` empty · wall-clock guard passes.

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
Roadmap 1–10 DONE · 10a/10b/10c DONE · **PG-0** `def8a3c` · **Phase 11 + PG-3** `05ab925` · **PG-1** `a871a68` · **PG-2** `700bd2a` · **PG-4** `c44efb0` · **PG-5** `ab7461d` (B-34, B-35, B-72, B-73 closed).
- **This brief is a small cleanup task, not a phase.** It closes **B-77** and moots **B-75**.
- **The next phase after it is a new one broken out of the queue: B-76** — the engine is fed an annualised run-rate, contradicting **D-PROJ-1**. Do not start it here.
- Then **PG-6** (unsupported scenarios; owns `refused` and `closed_final`, plus the D-VAT-1 Form 300 setup path), **PG-8 … PG-13**.

## ACCEPTANCE
1. **No `legacyDeclarations` identifier anywhere in `src/`.** No monthly declaration type in the application's vocabulary.
2. The v11 step still exists, still numbered 11, and now **drops** monthly rows. A pre-v11 payload migrates cleanly and ends with `filings: []`.
3. The three reused fixtures are re-premised, each still asserting what it asserted before in substance. **List each one before → after.**
4. `isFiledFiling`, the filing vocabulary and the deadline done-state are **unchanged**.
5. `tsc` 0 · unit tests pass · `build` 0 · e2e green including the `/declarations` axe route · copy-guard `ALLOW_LIST` still empty.

## HANDOFF
Write **`docs/ai/phases/33_pg5b_remove_legacy_monthly.md`**. Per §12.11: **write it from your own diff** — every path and identifier named must appear in that diff or in a file you opened this task, and **cite no line numbers**. State plainly that B-75 was closed by removal, not by fixing it.


## READ FIRST — in this order
1. **`docs/ai/research/26_midyear_start_partial_year_2026.md` §9 "What this changes for the app"** — the prescription. Read it before anything else.
2. **`docs/ai/USER_DECISIONS.md` — D-PROJ-1.** This phase implements a decision that was already made and is currently not honoured.
3. `docs/ai/phases/31_pg4_active_period.md` — what PG-4 did and what it explicitly flagged.
4. `docs/ai/PHASE_PLAN_11_34.md` §12.9 (sequential scouts) and §12.11 (write the doc from the diff).

## WHY THIS IS THE MOST SERIOUS ITEM ON THE REGISTER
Every other open defect makes the app say something imprecise. **This one makes it assert a tax the law does not produce.**

`src/data/dashboard.ts` says it outright in its own comment: the engine *"is fed the annual figures from the projection model (`domain/projection.ts`, `run-rate-v1`) whenever that model has a run rate to project with"*. **D-PROJ-1 forbids exactly that** — the hero is computed only from records that actually exist, with **no multiplying and no dividing by months elapsed**, and a forecast *"must never be what the engine or the contribution thresholds are measured on"*.

**The October case, from `research/26` §97–104** — a PFA authorised October 2026, net income (încasări − cheltuieli plătite) Oct–Dec 2026 = **10.000 lei**:

| | figure the app uses | CAS |
|---|---|---|
| before PG-4 | 120.000 lei | due |
| **today** | **30.000 lei** — pinned by `projection.activePeriod.test.ts` | **due** |
| **the law** | **10.000 lei** — art. 68 alin. (1), (2)(a), (4)(b) + art. 118 alin. (3) | **none due**: 10.000 < 12 SM, and the 12-SM test is **not** cut to 3 months |

PG-4's fix was real and correct for what it was asked — it stopped projecting an October starter as if it had traded since January. **It still annualises.** `research/26` §9.1: *"The ×12 annualisation must go from anything presented as a fiscal figure. No provision supports grossing up, and art. 118 alin. (3) deems partial-year income to **be** the annual income. A run-rate may exist as a forecast for planning, clearly labelled, but it is not the legal base and must not be what the engine and the thresholds are measured on."*

## WHAT TO BUILD
1. **The engine, the hero and the contribution thresholds are measured on actuals** — receipts actually collected, expenses actually paid — labelled with the as-of date.
2. **The run-rate projection is demoted to a forecast beside it**, visually distinct, clearly labelled as a forecast, and **provably not consumed by the engine or the thresholds**. Make that provable in a test, not just true by accident.
3. **Every threshold states which basis it was tested on.** D-PROJ-1's unresolved half: mid-year, whether a threshold will be crossed by December is unknowable, so the app must name the basis rather than imply the answer is settled.
4. **The chart's projected series stays** as a visual aid — D-PROJ-1 protects it. Phase 22 still owes it a non-colour cue; do not do that here.
5. **The closed-year state PG-4 built is already correct** — a closed year is final from actuals. Do not regress it; this phase makes mid-year behave on the same principle.

## THE ACCEPTANCE FIXTURE — use it verbatim
A PFA authorised **October 2026** with **10.000 lei** net for Oct–Dec 2026, at a fixed clock in 2027:
- **Venit net anual FY2026 = 10.000 lei — not 40.000, not 30.000, not 120.000.**
- **CAS: none due.** 10.000 < 12 SM. The 12-SM test is **not** prorated to three months. The taxpayer may opt in.
- **CASS: base 10.000 lei, but below 6 SM, so art. 174 alin. (6) imposes the 6-SM base** unless alin. (7) exempts. **Not prorated to three months.**
- **Impozit: 10 % × venitul net anual impozabil**, with CAS/CASS deductible per art. 118 alin. (2).

## Refusals that are decisions, not gaps
- **Do not prorate the 12-SM, 24-SM, 6-SM or 72-SM figures** for a mid-year starter — **art. 151 alin. (2)**. Keep **art. 151 alin. (3)** (the newly-exempt case) **visibly separate**; it is a different rule.
- **Cite art. 118 alin. (3), not alin. (2).** The pre-2024 numbering is a live trap in exactly this area.
- **Scope the "proration was removed" claim to the code.** The Norme metodologice reproduced in ANAF's current edition still contain prorating language and worked examples; their status after HG 602/2025 is **unverified** and is the highest-priority open gap in `research/26` §10.3. Do not assert in the UI that proration no longer exists in the norms.
- **Do not present a 30-day filing deadline as current law**, and keep the start-of-activity screen `REVIEW_REQUIRED` until the D212 instructions and the non-CF registration duties are checked.

## SCOUT DISPATCH — mandatory, **SEQUENTIAL**, no work while one runs
- **Scout A — every consumer of `ProjectionV1`, `annualProjected` and the `basis` field across `src/`.** This is the blast radius of removing annualisation from the live path; you will not edit most of what it finds.
- **Scout B — how each contribution threshold is tested and where the basis it was tested on is recorded and displayed**, with the call path. **You are not editing the threshold values or their citations.**

Dispatch one, then **stop and end the turn.** If one returns nothing, re-dispatch once, narrower; twice, cover it with a bounded grep over files the other scout named and say so. **Never scout a file you are going to edit.** Before acting on a report, **grep every file and identifier it names against the tree** (§12.12) — if it names something absent, the whole report is untrusted.

## BOUNDARIES
- **May touch:** `domain/projection.ts` (**this phase owns it — it was off-limits to PG-6, not to you**), `data/dashboard.ts`, `data/derived.ts`, `domain/estimateBasis.ts`, `domain/thresholds.ts`, `domain/insights.ts`, `components/dashboard/*`, `components/FinancialChart.tsx`, `pages/Dashboard.tsx`, `ui/copy/*`, new tests, `e2e/*`.
- **Must not touch:** any rule value, threshold value, statutory citation or registry entry; `domain/aggregation.ts`, `domain/date.ts`, `domain/fx/*`, `domain/tax.ts` (**the engine's arithmetic — you change what feeds it, not how it computes**), the migration chain, the clock helpers, `docs/ai/steps/`.
- **Never touch `docs/ai/steps/`.**

## LANDMINES
1. **A large number of tests pin annualised figures.** `projection.activePeriod.test.ts` pins the 30.000; `dashboard.test.ts`, `estimateBasis.annualCaps.test.ts`, `estimateBasis.deductibility.test.ts`, `estimateBasis.euroCaps.test.ts`, `Dashboard.test.tsx` and the e2e specs all carry numbers derived from a run-rate. **Re-premise them, do not re-baseline silently.** Every one needs before → after and a sentence on why the old number was wrong.
2. **Removing annualisation will make some figures go *down*, and that is the point.** If a CAS line disappears, say so loudly — that is the defect being fixed, not a regression.
3. **Do not delete the projection.** It is still a legitimate forecast and the chart still uses it. Demote it; don't destroy it.
4. **`elapsedMonths` and the active-period work PG-4 shipped stays correct** for the forecast. This phase changes what the *legal* figures are measured on.
5. **The clock helper's export is `pinClock(at)`** — there is no `pinClockAt()`.
6. **`Bani` is integer lei**; keep Decimal until the final rounding, as the projection already does.

## BASELINE
**From PG-5b at `de44a3a`:** `tsc` 0 · **99 files / 1547 unit tests** · `build` 0 · **e2e 68** (64 functional + 4 axe) · copy-guard `ALLOW_LIST` empty · wall-clock guard passes. PG-5b removed the legacy monthly declarations and moved the counts twice (1549 → 1547), so **re-measure before you change anything** rather than trusting either figure above.

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
Roadmap 1–10 DONE · 10a/10b/10c DONE · **PG-0** `def8a3c` · **Phase 11 + PG-3** `05ab925` · **PG-1** `a871a68` · **PG-2** `700bd2a` · **PG-4** `c44efb0` · **PG-5** `ab7461d` · **PG-5b** legacy monthly removal (brief 36).
- **PG-5C ← THIS BRIEF.** Broken out of the queue because it is the only defect that changes a number the user could be billed for.
- Then **PG-6** (unsupported scenarios; owns `refused` and `closed_final`, and the **D-VAT-1** Form 300 setup path), **PG-8 … PG-13**.

## ACCEPTANCE
1. **The October fixture above produces the law's figures**, under a fixed clock, and the CAS line is empty. Prove it in Playwright, not only in a unit test.
2. **No fiscal figure presented to the user is annualised.** A forecast may appear beside it, labelled, visually distinct.
3. **A test proves the engine and the thresholds cannot receive a projected operand** — not just that they currently don't.
4. **Every threshold names the basis it was tested on.**
5. The closed-year final state still works and still says it is final.
6. The chart's projected series still renders as a forecast.
7. Every moved test is listed with before → after and why the old figure was wrong.
8. `tsc` 0 · unit tests pass · `build` 0 · e2e green including axe · copy-guard `ALLOW_LIST` empty.

## HANDOFF
Write **`docs/ai/phases/34_pg5c_actuals_basis.md`**. Per §12.11: **write it from your own diff** — every path and identifier you name must appear in that diff or in a file you opened this task, and **cite no line numbers**. Lead with the October fixture's before → after, because that is the thing a reader needs to see first.


## READ FIRST
- **`docs/ai/briefs/28_pg_production_gate.md` §PG-6** — read the whole section, then stop. **This brief is 6a only.**
- `docs/ai/phases/34_pg5c_actuals_basis.md` — what PG-5C just changed in the same file you are about to edit. Read it before touching `estimateBasis.ts`.
- `docs/ai/PHASE_PLAN_11_34.md` §12.9 (sequential scouts), §12.11 (write the doc from the diff), §12.12 (a scout report is unverified input).

## THIS IS ONE TASK IN A SIX-PART PHASE — DO NOT DO THE OTHER FIVE
PG-6 is scoped at 5–8 days and has six sub-items. **This brief is 6a, the framework.** The others are separate tasks and will be briefed separately:

| part | what it is | defect |
|---|---|---|
| **6a** | **the scenario-support framework — THIS BRIEF** | — |
| 6b | activity family supplied by the live pipeline | B-29 |
| 6c | per-expense vehicle and documentation facts | B-39 |
| 6d | other-income amounts behind the flags | B-41 |
| 6e | fixed assets and depreciation | B-31 |
| 6f | actually-deductible input VAT | B-30 |
| 6g | the Form 300 setup path per **D-VAT-1** | B-35 residual |

**Do not implement 6b–6g here.** If you find yourself adding a scenario detector for vehicles, assets or other income, you have left the brief. The only scenario you wire up is one that **already refuses today**, to prove the framework carries a real case.

## WHY 6a MATTERS
The target is production, not a pilot, so every unsupported case must be **really supported or explicitly refused**. Today the app has one refusal, from one place, and the remaining unsupported cases produce **confident wrong numbers**. 6a is the single channel the other five will route through — brief 28 §0 rule 6: **one channel for "the estimate is not complete."** If 6a grows a second mechanism, every later part inherits the duplication.

## WHAT ALREADY EXISTS — verified in-tree at `76302d1` on 2026-10-11
- **There is no `ScenarioSupport` anywhere in `src/`.** 6a is greenfield.
- **A refusal channel already exists and is live.** `selectEstimateOperands` in `src/domain/estimateBasis.ts` returns `kind: 'refused'` when `deductible.refusal` is set, and that branch builds `basis: { kind: 'refused', method: null, elapsedMonths: null, reason }` plus `result: { status: 'review_required', reason, lines: [] }`. The comment on it states the rule: *"a refused engine must not be handed to `computeTaxEstimate`."*
- **So the shape is right and the source is single.** The refusal today can only originate from the expense classifier. That is exactly B-29's complaint: the channel exists but **no caller supplies the fact that would trigger it.**
- **PG-5C just changed this same file.** The basis union lost `annual-projected` and `actuals-only` and now has one computed member, `recorded-actuals`, carrying `asOfDate`, `closed` and an optional `RunRateForecast`. **Do not reintroduce a projected operand.**

## SCOPE — 6a only
1. **A scenario-support registry.** Per brief 28: `{ id, detect(profile, records), effect: 'incomplete' | 'refuse', message (a copy key, never inline text), fixTarget }`. Detection is a pure predicate over data the app already holds — **it must not invent facts or guess from CAEN codes.**
2. **One evaluation point** that runs the registry and produces the outcome, so a later part adds a detector rather than a new mechanism.
3. **Route the existing classifier refusal through the registry** rather than leaving it as a special case beside it. Prove the framework carries a real, already-live case — do not build a framework with only demo scenarios in it.
4. **A refusal replaces the number** with „Nu putem calcula" + the reason + a **working link to the thing that fixes it**. `fixTarget` must resolve to a real route or control, not a string.
5. **`incomplete` and `refuse` stay distinct.** Missing facts the user can supply are `incomplete`; a case the law does not let the app compute is `refuse`. Do not collapse them — PG-1's completeness channel and this one must not become two answers to the same question.
6. **`closed_final` and `refused` in the estimate state**: PG-4 and PG-5 both reported them as declared and untriggered. **Confirm their current state yourself** and say in the handoff which are now reachable and which are still dead. Do not trigger one just to make a test pass.

## SCOUT DISPATCH — **sequential**, one at a time, no work in flight
- **Scout A — every place an estimate result is consumed and rendered**, from `data/derived.ts` and `data/dashboard.ts` down through the dashboard components. This is where a refusal has to be able to appear; you will not edit most of it.
- **Scout B — every existing path that can already produce `review_required`, `incomplete` or a refusal**, with the call path. You are consolidating channels, so you need to know how many there are.

Dispatch one, then **stop and end the turn.** Before acting on any report, **grep every file and identifier it names against the tree** (§12.12). **Three consecutive scout payloads in the previous task named files and identifiers that do not exist in this repository.** If a report names something absent, the whole report is untrusted — cover the territory yourself with a bounded grep over identifiers you have confirmed exist, follow every hit by **reading** it, and record the deviation in the phase doc in one line, authorised by the orchestrator. **Do not loop on scout retries.**

## BOUNDARIES
- **May touch:** `domain/estimateBasis.ts`, `domain/attention.ts`, `domain/completeness.ts`, `domain/insights.ts`, `data/dashboard.ts`, `data/derived.ts`, new scenario module under `domain/`, `components/dashboard/*`, `pages/Dashboard.tsx`, `ui/copy/*`, new tests, `e2e/*`.
- **Must not touch:** `domain/tax.ts` and `domain/fiscal/calculators.ts` — **brief 28 says it outright: the CAS / CASS / income-tax calculators are off-limits**; any rule value, threshold value, statutory citation or registry entry; `domain/aggregation.ts`, `domain/date.ts`, `domain/fx/*`, `domain/projection.ts`, the migration chain, the clock helpers, `docs/ai/steps/`.
- **Never touch `docs/ai/steps/`.**

## LANDMINES
1. **Do not add a second "the estimate is not complete" mechanism.** PG-1 built one; brief 28 §0 rule 6 says PG-4…PG-8 route through it. A parallel warning channel is the most likely way to fail this task while making every test pass.
2. **A refusal must not be reachable only in tests.** Wire at least the existing live refusal through the registry, and prove it renders.
3. **`fixTarget` that goes nowhere is worse than no link.** It must resolve to a real route or control, and a test should follow it.
4. **PG-5C's change is recent and load-bearing.** It removed annualisation from the engine operand and made the type system enforce it (`@ts-expect-error` tests, and an assertion that `amountsForEstimate.toString()` contains no `forecast`/`projected`). **Do not undo that enforcement while restructuring the same file.**
5. **`detect` must be total.** A detector that throws on a profile with no records, no start date, or an empty register turns a refusal into a crash.
6. **The clock helper's export is `pinClock(at)`** — there is no `pinClockAt()`.
7. **`Bani` is integer lei.**

## BASELINE (measured at `76302d1`)
`tsc` 0 · **100 files / 1558 unit tests** · `build` 0 · **e2e 72** (68 functional + 4 axe) · copy-guard `ALLOW_LIST` empty · wall-clock guard passes · completeness 7/9.

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
Roadmap 1–10 DONE · 10a/10b/10c DONE · **PG-0** `def8a3c` · **Phase 11 + PG-3** `05ab925` · **PG-1** `a871a68` · **PG-2** `700bd2a` · **PG-4** `c44efb0` · **PG-5** `ab7461d` · **PG-5b** `de44a3a` · **PG-5C** `407d47e` (B-76 closed — the engine now runs on recorded actuals).
- **PG-6a ← THIS BRIEF.** Then 6b → 6c → 6d → 6e → 6f → 6g as separate briefs.
- Then **PG-8** (evidence + snapshots, phase 15 + 20, plus PG-2's handoff of the per-record fiscal date into the estimate's own breakdown), **PG-9 … PG-13**.

## ACCEPTANCE
1. **One registry, one evaluation point.** Adding a scenario in a later part means adding a detector, not a mechanism. Show it by routing the existing classifier refusal through the registry and deleting the special case.
2. **A refusal renders as „Nu putem calcula" + reason + a working fix link**, and no number appears beside it. Prove it in Playwright.
3. **`incomplete` and `refuse` are distinguishable in the UI and in the data**, and neither is a proxy for the other.
4. **No new scenario detectors for vehicles, assets, other income or activity family.** They belong to 6b–6f.
5. **PG-5C's enforcement still passes** — the `@ts-expect-error` tests and the `amountsForEstimate` assertion are untouched and green.
6. State which of `refused` / `closed_final` are now reachable and which are still declared-but-dead.
7. `tsc` 0 · unit tests pass · `build` 0 · e2e green including axe · copy-guard `ALLOW_LIST` empty.

## HANDOFF
Write **`docs/ai/phases/35_pg6a_scenario_framework.md`**. Per §12.11: **write it from your own diff** — every path and identifier you name must appear in that diff or in a file you opened this task, and **cite no line numbers**. List what 6b–6g must route through, so the next Worker inherits a contract rather than a guess.
