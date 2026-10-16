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


## READ FIRST
- **`docs/ai/phases/35_pg6a_scenario_framework.md`** — read the contract section first. **6b adds one registry entry, it does not build a mechanism.**
- **`docs/ai/research/30_…` §5** — the scope of art. 68^3 is wider than this brief implements. Read it so you know what you are *not* doing.
- `docs/ai/PHASE_PLAN_11_34.md` §12.9, §12.11, §12.12.

## WHY
**A profile whose whole activity is accommodation currently gets the same estimate as any other business, and the app presents it as computed.** `ActivityFamily` exists in the classifier but **the live pipeline never supplies it**, so the refusal that would catch this case is dead code. PG-6a registered the scenario — `no-expense-engine` — and proved it in a unit test, then reported honestly that **it cannot fire from stored data**. 6b is the fact that makes it fire.

This is B-29, and it is the clearest remaining case of the app being confidently wrong rather than honestly silent.

## WHAT ALREADY EXISTS — verified in-tree at `9ff88de` on 2026-10-11
- **`ActivityFamily = 'other' | 'cazare'`** in `src/domain/fiscal/deductibility.ts`, and the classifier context carries **`activityFamily?`** — optional, which is exactly why nothing refuses.
- **The scenario is already registered.** `SCENARIO_SUPPORT` in `src/domain/scenarios.ts` has `no-expense-engine`, and `evaluateScenarios` is the single evaluation point. `estimateBasis.ts` passes `classifierRefusal` into it.
- **CAEN is stored in two shapes** — `caen: z.array(companyCaenSchema)` and `codCAEN: z.string().optional()` in `src/data/schema.ts`. `domain/models.ts` says Phase 7 (D-1) made it the single CAEN model. **Confirm which one is the profile's main activity yourself before you touch either.**
- **PG-6a's contract:** add one `SCENARIO_SUPPORT` entry; `detect` must be total; choose `refuse` vs `incomplete` honestly; the sentence lives in `copy.scenarios.messages`; `fixTarget` must resolve through `parseRoute`.

## SCOPE — 6b
1. **Ask the user explicitly.** Per brief 28: an onboarding/Settings question about activities taxed by a **different statutory method**. **Do not guess from CAEN.** A code is not a statement about how the law taxes this person, and the app has no authority to infer it.
2. **Persist the answer** on the profile, through the migration chain — a new version step, confirmed against the current head, not assumed.
3. **Supply it to the classifier** so `no-expense-engine` fires with **no further framework work**. If you find yourself changing `scenarios.ts` or `estimateBasis.ts` beyond wiring, stop — the framework is done.
4. **Show the answer in Settings for review**, so the user can see and change what the app believes about them.
5. **`yes` → refuse.** Not a warning beside a number. The refusal block PG-6a built already renders this.

## WHAT 6b DELIBERATELY DOES NOT DO
**It does not model art. 68^3.** `research/30` §5 records that art. 68^3 is **new from 01-01-2026** (Legea 239/2025 art. XII pct. 5), is a **30 % flat-expense ratio taxed at 10 % — an effective 7 % of gross** — reaches private landlords **above 7 rented rooms** via art. 83 alin. (4), and involves art. 85. Implementing that regime is a **product decision that has not been made**, not a task that was forgotten. **Refuse, and say what is missing.** If you think the regime should be implemented instead, stop and report it as a BLOCKER rather than deciding it yourself.

## SCOUT DISPATCH — **sequential**, one at a time, no work in flight
- **Scout A — every caller of the expense classifier and every place `ExpenseClassificationContext` is constructed**, with the call path from the live estimate down. This is where the fact has to be threaded.
- **Scout B — the profile/onboarding surface: how a profile field is asked, stored, migrated and re-displayed**, using an existing field as the worked example. You are copying a proven path, not inventing one.

Before acting on any report, **grep every file and identifier it names against the tree** (§12.12). PG-6a's scout named `estimateStateStateBadgeClass`, which does not exist — the real name is `estimateStateBadgeClass`. **If a report names something absent, the whole report is untrusted**: cover it yourself with a bounded grep over identifiers you confirmed exist, follow every hit by **reading**, and record the deviation in one line. **Do not loop on retries.**

## BOUNDARIES
- **May touch:** `domain/fiscal/deductibility.ts` (**the context type and its use — not the rule arithmetic**), `domain/scenarios.ts` (**one registry entry only**), `domain/estimateBasis.ts` and `data/derived.ts` (**threading only**), `data/schema.ts`, `data/migration.ts`, `data/types.ts`, `data/seed.ts`, `pages/Settings.tsx`, the onboarding surface, `ui/copy/*`, new tests, `e2e/*`.
- **Must not touch:** `domain/tax.ts` and `domain/fiscal/calculators.ts`; any rule value, threshold value, statutory citation or registry entry; `domain/aggregation.ts`, `domain/date.ts`, `domain/fx/*`, `domain/projection.ts`, the clock helpers, `docs/ai/steps/`.
- **Never touch `docs/ai/steps/`.**

## LANDMINES
1. **Do not infer the activity family from a CAEN code.** That is the explicit refusal in brief 28, and it is the kind of plausible inference that later becomes an unappealable number.
2. **The migration must not silently default an existing profile to `'other'`.** An unanswered question is **unknown**, and unknown must not quietly mean "the ordinary rules apply". If you must pick a default for a stored payload, make it visible and make it `incomplete` rather than a silent pass.
3. **`detect` must be total** — no records, no start date, empty CAEN array, a profile mid-onboarding. A detector that throws turns a refusal into a crash.
4. **`fixTarget` must resolve through `parseRoute`** to a real control. PG-6a has a routes test proving this; yours must too.
5. **Do not renumber or reorder a migration step.** Confirm the current head in-tree.
6. **The clock helper's export is `pinClock(at)`** — there is no `pinClockAt()`.
7. **`Bani` is integer lei.**

## BASELINE (measured at `9ff88de`)
`tsc` 0 · **105 files / 1589 unit tests** · `build` 0 · **e2e 77** (73 functional + 4 axe) · copy-guard `ALLOW_LIST` empty · wall-clock guard passes · seed completeness 7/9 at 100 % weighted.

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
Roadmap 1–10 DONE · 10a/10b/10c DONE · **PG-0** `def8a3c` · **Phase 11 + PG-3** `05ab925` · **PG-1** `a871a68` · **PG-2** `700bd2a` · **PG-4** `c44efb0` · **PG-5** `ab7461d` · **PG-5b** `de44a3a` · **PG-5C** `407d47e` · **PG-6a** `ce245be` (scenario framework; `refused` now reachable).
- **6b ← THIS BRIEF.** Then **6c** vehicle facts (B-39), **6d** other income (B-41), **6e** fixed assets (B-31), **6f** deductible input VAT (B-30), **6g** Form 300 setup per **D-VAT-1**.
- **B-79** (`closed_final` declared, produced by nobody, unowned) is open and belongs to this series — **do not trigger it here** unless the activity-family work genuinely makes it reachable.
- Then **PG-8 … PG-13**.

## ACCEPTANCE
1. **A profile that answers "yes, an activity taxed differently" produces the refusal in a browser** — `Nu putem calcula`, the rule's sentence once, and a working link to the control that changes the answer. Prove it in Playwright, from stored data, not from a hand-built context.
2. **A profile that answers no is unaffected** — same figures as before, with the before/after stated.
3. **An unanswered question is not silently `'other'`.** It is `incomplete`, and it says what to do about it.
4. **The answer is visible and editable in Settings.**
5. **No CAEN inference anywhere.** A test should pin that a CAEN 5510 profile with no answer is *not* refused on the basis of its code.
6. **`scenarios.ts` gains one entry and nothing else; `estimateBasis.ts` is threading only.** Show it in the diff.
7. `tsc` 0 · unit tests pass · `build` 0 · e2e green including axe · copy-guard `ALLOW_LIST` empty · PG-5C's enforcement still green.

## HANDOFF
Write **`docs/ai/phases/36_pg6b_activity_family.md`**. Per §12.11: **write it from your own diff** — every path and identifier named must appear in that diff or in a file you opened this task, and **cite no line numbers**. State explicitly that art. 68^3 remains unmodelled and that this is an open product decision, not completed work.


## READ FIRST — in this order
1. **`docs/ai/research/38_art68x3_cass_and_occupancy_order.md`** — the whole file. It is the specification for this task, not background.
2. **`docs/ai/USER_DECISIONS.md` — D-CAZ-1, D-COM-1, D-OCC-1.** All three are decided; you implement them.
3. `docs/ai/phases/36_pg6b_activity_family.md` — the activity-family fact you will consume.
4. `docs/ai/PHASE_PLAN_11_34.md` §12.9, §12.11, §12.12.

## PG-6h IS THREE TASKS. THIS IS THE FIRST ONE.
| part | what | this brief? |
|---|---|---|
| **6h-1 the arithmetic** | the 68^3 computation and its CAS/CASS consequences | **← THIS BRIEF** |
| 6h-2 the questions | the eligibility and commission questions in Settings/onboarding, CAEN-triggered | no |
| 6h-3 the occupancy sheet | the OPANAF 381/2026 form and its personal-data obligations | no |

**Do not build the Settings questions or the occupancy form here.** If you are adding a form field to `Settings.tsx` or a guest table, you have left the brief. The one exception is in scope note 4 below, and it is deliberate.

## WHY THIS IS THE VALUABLE ONE
`research/38` §4 states the verdict plainly: the **income-tax leg and the CASS/CAS arithmetic leg can be built correctly** on primary sources. The gross-determination leg cannot, because alin. (3) is ambiguous. So this task builds the part that is certain, and leaves the uncertain part as an explicit question — which is exactly the shape the rest of the project has been converging on.

## WHAT ALREADY EXISTS — verified in-tree at `18ee28c` on 2026-10-11
- **`ActivityFamily = 'other' | 'cazare'`** with `ACTIVITY_FAMILY_VALUES`, stored on the profile as `activityFamily?` with **no default**, migrated at **v12**. PG-6b made it a declared fact. **This is the input your path selects on.**
- **`src/domain/fiscal/calculators.ts`** exposes `computeFiscal`, `CalculatorFunction`, `CalculatorInput`, `CalculatorResult`, `ReviewRequired`, and a **`calculatorRegistry: Record<string, CalculatorFunction>`**. `src/domain/tax.ts` consumes the registry. **A new regime is a registered calculator plus rule entries — not a branch inside an existing one.**
- **`package2026.ts`** already carries CAS (`rate` 25 %, `min_base` 12 SM, `tier2_base` 24 SM, `tier1_cas`, `tier2_cas`), CASS (`rate` 10 %, `min_base` 6 SM, `max_annual_base` 72 SM) and income tax (`base_rate` 10 %), plus **both** SM values — 4.050 lei and 4.325 lei — with **art. 135^1 alin. (3)** cited for using the 1 January figure. **That part is already right; do not "fix" it.**
- **`release2026.ts`** is `version: 1`. **Bump it the way the existing governance expects** — check how prior additions were versioned before choosing.

## SCOPE — 6h-1
1. **A 68^3 computation path.** Gross (cash basis, „încasate în cursul anului fiscal") → **net = 70 % × gross** (alin. (2): a flat 30 % expense ratio, *not* a tax rate) → **tax = 10 % × net, „impozitul fiind final"** (alin. (6)). Effective 7 % of gross. Cite **art. 68^3 alin. (2) and (6)**.
2. **FX per alin. (4):** foreign receipts convert at the **BNR rate of the last banking day before each collection** — not an annual average, not year-end. The FX machinery from Phase 10c already exists; **use it, do not reimplement it.**
3. **CAS consequence:** the 68^3 net **feeds the 12/24-SM threshold test only** (art. 148 alin. (3), amended by L239/2025 art. XII pct. 18). The CAS **base** remains the chosen 12 or 24 SM. **Do not make the net the CAS base.**
4. **CASS consequence — the one most likely to be got backwards:** for 68^3 the net **is** the base (art. 170 alin. (1), amended by **pct. 19**), **floored at 6 SM** (art. 174 alin. (6)), **capped at 72 SM**, rate 10 % (art. 156). The 6/12/24-SM ladder in art. 170 alin. (2)–(4) is **expressly limited to lit. c)–h)** and does **not** apply to 68^3, which is lit. b). And **alin. (11) ring-fences income tax only** — for contributions the net **cumulates** with the taxpayer's other lit. b) income. **Separate for tax, combined for contributions.**
5. **The sole-68^3-income case must produce the 6-SM minimum.** `research/38` §1.7 proves none of the three art. 174 alin. (7) exemptions can fire for such a taxpayer. This is a firm, encodable rule and it needs a test.
6. **Deadlines:** DU filing **and** payment both by **25 May** — cite **art. 68^3 alin. (9)–(10) + art. 122 alin. (3)**, **not art. 121**.
7. **Every new value is a rule-store entry with a citation.** No number in a calculator. Ledger entries citing Portal Legislativ / MO per `research/38`.
8. **Year-scope every SM-derived constant.** FY2027 SM is unknown; a hard-coded 24.300 or 291.600 that survives into 2027 is a defect waiting to happen.

## WHAT MUST STAY `review_required` — do not resolve these
- **The alin. (3) platform-commission scope (B-80).** Two live readings, no primary resolution. **Gross for a 68^3 taxpayer who uses a platform is not computable by the app yet.** Build the path so gross is an input, and leave the commission question to 6h-2. **Do not default it either way.**
- **The alin. (1) eligibility gate** — „operatorii economici definiți potrivit legislației specifice domeniului turismului" is a tourism-law classification outside the fiscal code. The app asks; it does not decide.
- **The art. 174 alin. (7) floor exemptions.** They need salary, pension and lit. c)–h) data this module does not hold. The app may say **"the floor applies unless you have other qualifying income"**, never **"no floor"**.
- **A D212 cell map (B-81).** OPANAF 2736/2025 has **no 68^3 subsection** and still cites the abrogated OPANAF 398/2021. **Do not derive form cells from it.**
- **Do not encode ANAF Brașov's list of art. 154 alin. (1) letters** — it is stale after Legea 141/2025. The current list is in art. 174 alin. (8).

## SCOUT DISPATCH — **sequential**, one at a time, no work in flight
- **Scout A — how `calculatorRegistry`, `computeFiscal` and `tax.ts` compose a rule into a computed figure**, end to end, including how `review_required` propagates. You are adding a calculator; you must not guess the contract.
- **Scout B — how the CAS and CASS figures are currently assembled and where a second income source would have to be cumulated**, with the call path. The cumulation point is the heart of item 4.

Before acting on any report, **grep every file and identifier it names against the tree** (§12.12). Scout reports in this project have named files that do not exist. **If a report names something absent, the whole report is untrusted** — cover it yourself with a bounded grep over identifiers you confirmed exist, follow every hit by **reading**, and record the deviation in one line. **Do not loop on retries.**

## BOUNDARIES
- **May touch:** `domain/fiscal/calculators.ts` (**a new registered calculator — do not rewrite the existing CAS/CASS/income-tax calculators' arithmetic**), `domain/fiscal/package2026.ts` and `release2026.ts` (**new rule entries and version bump only**), `domain/fiscal/rules.ts` (**types only if needed**), `domain/tax.ts` (**composition only**), `domain/estimateBasis.ts`, `domain/aggregation.ts` (**reading the gross — no formula changes**), `domain/scenarios.ts` (**one entry, and only if a case genuinely cannot compute**), `data/dashboard.ts`, `ui/copy/*`, new tests, `e2e/*`.
- **Must not touch:** any **existing** rule value, threshold value or statutory citation; `domain/date.ts`, `domain/fx/*` (**use them**), `domain/projection.ts`, `data/schema.ts`, `data/migration.ts`, `pages/Settings.tsx`, `pages/Onboarding.tsx`, the clock helpers, `docs/ai/steps/`.
- **Never touch `docs/ai/steps/`.**

## LANDMINES
1. **The 30 % is an expense ratio, not a tax rate.** Net = 70 % of gross. Getting this backwards is a 10× error in the wrong direction.
2. **CAS and CASS use the same net for different jobs.** Net → threshold test for CAS; net → **base** for CASS. A single "68^3 base" variable fed to both is the mistake to avoid.
3. **Cumulation for contributions, ring-fencing for tax** (alin. (11) vs art. 170 alin. (1)). If you find yourself excluding 68^3 income from the CASS base because the tax is ring-fenced, re-read `research/38` §1.3.
4. **Do not "correct" the SM values.** 4.050 lei is right for FY2026 because art. 135^1 alin. (3) fixes the 1 January value; 4.325 from 1 July is deliberately not used for contributions.
5. **PG-5C's enforcement is still load-bearing.** The engine runs on recorded actuals; a 68^3 gross must come from recorded receipts, never from a projection.
6. **No real CNP or guest data anywhere in this task** — that surface is 6h-3, and D-OCC-1 governs it when it comes.
7. **The clock helper's export is `pinClock(at)`** — there is no `pinClockAt()`. **`Bani` is integer lei**; keep Decimal until the final rounding.

## BASELINE (measured at `18ee28c`)
`tsc` 0 · **109 files / 1617 unit tests** · `build` 0 · **e2e 83** (79 functional + 4 axe) · copy-guard `ALLOW_LIST` empty · wall-clock guard passes · seed completeness 7/9 at 100 % weighted.

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
Roadmap 1–10 DONE · 10a/10b/10c DONE · **PG-0** `def8a3c` · **Phase 11 + PG-3** `05ab925` · **PG-1** `a871a68` · **PG-2** `700bd2a` · **PG-4** `c44efb0` · **PG-5** `ab7461d` · **PG-5b** `de44a3a` · **PG-5C** `407d47e` · **PG-6a** `ce245be` · **PG-6b** `5b913a7`.
- **6h-1 ← THIS BRIEF.** Then **6h-2** (the questions, D-COM-1), **6h-3** (the occupancy sheet, D-OCC-1).
- Then **6c** vehicle facts (B-39 — **note: its premise is contested, see the phase doc for this task**), **6d** other income (B-41), **6e** fixed assets (B-31), **6f** deductible input VAT (B-30), **6g** Form 300 setup (D-VAT-1). Then **PG-8 … PG-13**.
- **B-79** (`closed_final` declared, produced by nobody) is still open and unowned.

## ACCEPTANCE
1. **A worked example, stated in the phase doc and pinned by a test:** a 68^3 taxpayer with a known gross produces net = 70 % × gross, tax = 10 % × net, and the CASS figure at the correct base with the 6-SM floor applied.
2. **The sole-68^3-income case owes the 6-SM CASS minimum**, and a test says so.
3. **The 68^3 net raises the CAS threshold test without becoming the CAS base.** A test must distinguish these two, or the requirement is not met.
4. **A mixed profile — 68^3 plus real-system income — cumulates for CASS and ring-fences for income tax.** One test per direction.
5. **Foreign-currency receipts convert at the BNR rate of the last banking day before each collection**, proven against a fixture with two receipts on different days.
6. **No commission default anywhere.** A grep for the commission handling must show it unresolved and surfaced, not applied.
7. **Every new number is a rule entry with a citation**; no literal fiscal value in a calculator.
8. **FY2027 yields no silent 68^3 figure** — the year with no rule package still refuses.
9. `tsc` 0 · unit tests pass · `build` 0 · e2e green including axe · copy-guard `ALLOW_LIST` empty · PG-5C enforcement still green.

## HANDOFF
Write **`docs/ai/phases/37_pg6h1_art68x3_arithmetic.md`**. Per §12.11: **write it from your own diff** — every path and identifier named must appear in that diff or in a file you opened this task, and **cite no line numbers**.

**And add one short section for the next task:** in it, record the state of **6c's contested premise** — brief 28 says a vehicle expense with no usage fact must be `incomplete` rather than silently deducted at 50 %, while `VehicleUseFact` in `fiscal/deductibility.ts` documents that **the law itself defaults to 50 % absent a foaie de parcurs**, so `unknown` deliberately behaves like `mixed`. **Do not resolve it in this task.** State which reading the code currently implements, with the citation it carries, so whoever briefs 6c can settle it against art. 68 alin. (4) lit. a) instead of inheriting a guess.


## READ FIRST — in this order
1. **`docs/ai/research/39_caen_tourism_and_detection.md`** — the whole file. It is the specification for this task.
2. **`docs/ai/USER_DECISIONS.md` — D-COM-1, D-COM-2, D-OCC-1, D-CAZ-1.** D-COM-2 **amends** D-COM-1. Read both.
3. `docs/ai/phases/36_pg6b_activity_family.md` — how the activity family became a stored, migrated, declared fact. **You are repeating that pattern for a second fact.**
4. `docs/ai/phases/37_pg6h1_art68x3_arithmetic.md` — what the arithmetic already consumes and where the open questions are carried.
5. `docs/ai/PHASE_PLAN_11_34.md` §12.9, §12.11, §12.12.

## WHY THIS TASK EXISTS
PG-6h-1 built the arithmetic and deliberately left gross as an input. This task supplies the two facts that decide **whether a user is on the 68^3 path at all**, and the one question the law cannot answer for us. It is a **fact-supplying** task, not a mechanism task.

## WHAT ALREADY EXISTS — verified in-tree at `5323e18` on 2026-10-11
- **`activityFamily: 'other' | 'cazare'`** on the profile, **no default**, migrated at **v12** (`DATA_VERSION_ACTIVITY_FAMILY = 12`, `migrateActivityFamilyV12`). UI already exists: `Settings.tsx` renders `set-activity-family` and writes `profile.activityFamily`. **Do not re-litigate it.**
- **A per-year fact pattern already exists** in `domain/models.ts` — several records carry `fiscalYear: number`, and one is explicitly year-scoped because alin. (8) says „în anul precedent". **The room count must follow that pattern, not sit on the profile as a single scalar.**
- **`release2026.ts` is now `version: 2`** and the rule store carries `gross_scope_open_question` and `eligibility_open_question` as **text, never values**.
- **`scenarios.ts`** has `accommodation-gross-undetermined` (`refuse`) and `ScenarioFacts` already carries `activityFamily`.

## SCOPE
1. **The room count becomes a stored, migrated, declared fact (B-82, B-84).** New migration step appended after v12 — **never edit a shipped step**. No default, no backfill: an existing profile with no room count stays unanswered and the app must behave as if it does not know.
2. **It is per-year, not one scalar.** The count changes across years and the category consequence follows the year. Store it the way the existing `fiscalYear` records do.
3. **The category consequence is the point, and it is not a number.** **1–7 rooms ⇒ *cedarea folosinței bunurilor*** (art. 83 alin. (2), art. 85). **More than 7 ⇒ independent activity under art. 68^3** (art. 83 alin. (4)). **Getting this wrong does not shift a figure, it moves income into a different title.** Say which title the app is using, in copy the user can read.
4. **The commission question (D-COM-1).** Ask it, apply the answer, and **show which reading was used and why**, with the alternative visible. It is a **choice the user makes**, recorded as such.
5. **The eligibility question (alin. (1)).** „operatorii economici definiți potrivit legislației specifice domeniului turismului" is a tourism-law classification outside the fiscal code. **Ask; never decide.**
6. **CAEN's reduced, bounded role (D-COM-2, B-83).** A tourism CAEN code may **additionally** prompt these questions. It may **never** be the only trigger, and may **never** supply an answer. If you encode a CAEN list, it must be labelled in code and in the phase doc as **this app's own normative choice**, citing **HG 656/1997 art. 4 alin. (1)–(2)** — because **no official CAEN ↔ tourism-structure-type mapping exists**. If you use a list, it is Rev. 3's **five** classes (5510, 5520, 5530, **5540**, 5590), and you must state that **5540 is intermediation, not accommodation** and **5590 is a sub-year residential let, not necessarily tourism**.
7. **Wire the facts into the existing refusal.** The `accommodation-gross-undetermined` refusal must now read as what it is: **the app does not compute this regime yet**, not a permanent verdict. PG-6b set this copy rule; keep it.

## WHAT MUST NOT HAPPEN
- **No inference.** Room count, eligibility and commission are **asked**. A CAEN code, an income amount, a CAEN-adjacent class or a seed value may **trigger a question** but never **answer one**. An unanswered question stays unanswered and the path stays `review_required`.
- **No D212 cell mapping (B-81).** OPANAF 2736/2025 has no 68^3 subsection and cites the abrogated OPANAF 398/2021.
- **No occupancy sheet, no guest data, no CNP field.** That is 6h-3 under D-OCC-1. If a guest table appears, you have left the brief.
- **No change to the 68^3 arithmetic** PG-6h-1 landed, and no existing rule value, threshold or citation.

## SCOUT DISPATCH — **sequential**, one at a time, no work in flight
- **Scout A — the full path a declared profile fact takes from `Settings.tsx` through `data/schema.ts`, `data/migration.ts`, `data/dashboard.ts` into `ScenarioFacts` and the calculators**, using `activityFamily` as the worked example. You are adding a second fact on the same rails; do not guess the rail count.
- **Scout B — every place the app currently branches on the income *category* (art. 68 vs art. 83/85 vs 68^3)**, with the call path. The room count decides a category, so you need to know where categories are decided.

Before acting on any report, **grep every file and identifier it names against the tree** (§12.12). Reports in this project have named files that do not exist. **If a report names something absent, the whole report is untrusted** — cover it yourself with a bounded grep over identifiers you confirmed exist, follow every hit by **reading**, and record the deviation in one line. **Do not loop on retries.**

## BOUNDARIES
- **May touch:** `domain/models.ts`, `data/schema.ts`, `data/migration.ts` (**new step only**), `data/seed.ts`, `pages/Settings.tsx`, `pages/Onboarding.tsx`, `ui/copy/*`, `domain/scenarios.ts` (**one entry, and only if a case genuinely cannot compute**), `domain/estimateBasis.ts` (**threading the facts, no formula changes**), `data/dashboard.ts`, new tests, `e2e/*`.
- **Must not touch:** `domain/fiscal/calculators.ts`, `domain/fiscal/package2026.ts`, `domain/fiscal/release2026.ts`, `domain/fiscal/rules.ts`, `domain/tax.ts` — **the arithmetic is done**; any change there means this task broke the contract. Also `domain/date.ts`, `domain/fx/*`, `domain/projection.ts`, `domain/estimateBasis.ts` formulas, `docs/ai/steps/`.
- **Never touch `docs/ai/steps/`.**

## LANDMINES
1. **The room count is a category switch, not a threshold.** 1–7 vs >7 chooses which title the income belongs to. Do not model it as a number feeding a formula.
2. **The 7-room boundary is fiscal and the 7-room cap in the tourism norms are different rules.** Ordin 65/2013 alin. (12) caps natural-person *classification* at „7 camere/14 locuri"; art. 83 alin. (4) sets the fiscal boundary at „peste 7 camere". **Do not merge them.**
3. **`activityFamily` and the room count are not the same fact and must not be collapsed.** A user can be `cazare` with an unknown room count; the app then knows the family but not the title.
4. **No default on the new field, and no backfill.** A migration that invents a room count invents a tax category.
5. **PG-5C's enforcement is still load-bearing** — the engine runs on recorded actuals; a new fact must not become a projection operand.
6. **The clock helper's export is `pinClock(at)`** — there is no `pinClockAt()`. **`Bani` is integer lei**; keep Decimal until the final rounding.

## BASELINE (measured at `5323e18`)
`tsc` 0 · **110 files / 1645 unit tests** · `build` 0 · **e2e 83** (79 functional + 4 axe) · copy-guard `ALLOW_LIST` empty · seed completeness 7/9 at 100 % weighted · **seed estimate 3.112 lei — it must not move.**

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
Roadmap 1–10 DONE · 10a/10b/10c DONE · **PG-0** `def8a3c` · **Phase 11 + PG-3** `05ab925` · **PG-1** `a871a68` · **PG-2** `700bd2a` · **PG-4** `c44efb0` · **PG-5** `ab7461d` · **PG-5b** `de44a3a` · **PG-5C** `407d47e` · **PG-6a** `ce245be` · **PG-6b** `5b913a7` · **PG-6h-1** `d17ef1c`.
- **6h-2 ← THIS BRIEF.** Then **6h-3** (the occupancy sheet, D-OCC-1).
- Then **6c** vehicle facts (B-39 — **premise contested, see `phases/37`**), **6d** other income (B-41), **6e** fixed assets (B-31), **6f** deductible input VAT (B-30), **6g** Form 300 setup (D-VAT-1). Then **PG-8 … PG-13**.
- **B-79** (`closed_final` declared, produced by nobody) is still open and unowned.

## ACCEPTANCE
1. **A profile with no room count is treated as unknown** — the 68^3 path stays `review_required`, and no category is asserted. A test must prove the unknown state, not just the answered ones.
2. **1–7 rooms puts the income in *cedarea folosinței*; more than 7 puts it under art. 68^3**, and the UI states which title is in use, in Romanian, with the article cited.
3. **The room count is per-year**: two years with different counts produce two different categories. One test per year.
4. **The commission answer is recorded as the user's choice and the app shows which reading it applied**, with the alternative visible. A grep must show no default.
5. **A CAEN code can prompt a question but cannot answer one.** Prove it with a test: a profile carrying a tourism CAEN code and no answers must still be `review_required`.
6. **Any encoded CAEN list is labelled as the app's own choice** and cites HG 656/1997 art. 4 alin. (1)–(2); if a list is used it is the **five** Rev. 3 classes with 5540 and 5590 annotated.
7. **The migration adds a step and backfills nothing**; every test that moves moves because the chain grew, and each is recorded old → new.
8. **No arithmetic file changed.** `git diff --stat` must show no change under `domain/fiscal/`.
9. `tsc` 0 · unit tests pass · `build` 0 · e2e green including axe · copy-guard `ALLOW_LIST` empty · **seed estimate still 3.112 lei** · PG-5C enforcement still green.

## HANDOFF
Write **`docs/ai/phases/38_pg6h2_accommodation_facts.md`**. Per §12.11: **write it from your own diff** — every path and identifier named must appear in that diff or in a file you opened this task, and **cite no line numbers**.

**Add one short section for 6h-3:** state what the app now knows about a user's accommodation situation (family, room count, per year, commission choice, eligibility answer) and what it still does not know, so the occupancy-sheet task starts from the real state rather than from `research/39`.


## READ FIRST — in this order
1. `docs/ai/phases/37_pg6h1_art68x3_arithmetic.md` and `docs/ai/phases/38_pg6h2_accommodation_facts.md` — the second one's **Decisions** section is the reason this task exists.
2. **`docs/ai/PHASE_PLAN_11_34.md` — defect B-85**, and §12.9, §12.11, §12.12.
3. `docs/ai/USER_DECISIONS.md` — D-CAZ-1, D-COM-2.

## THE DEFECT, IN ONE PARAGRAPH
`tax.ts` computes `vnaSistemReal` and `flatNet` from **one record set**, then:

> `const cumulatedNet: Bani = flatNet === null ? net : addBani(vnaSistemReal, flatNet);`

For a `cazare` register the expense engine returns an **empty** deductible set, so the sistem-real leg is **revenue with zero deductions** and the flat leg is **70 % of the same revenue**. `cumulatedNet` becomes **1.7 × revenue**, with two income taxes on top. **Nothing structural prevents this.** Today only an upstream scenario refusal keeps the legs apart — so the moment any later task stops that refusal (resolving B-80, building 6h-3, adding the art. 85 rule), the engine silently produces an inflated base. **This is the same class of defect PG-5C spent a phase removing: a figure that manufactures a liability.**

## THE PREMISE THAT DECIDES THE FIX — verified in-tree at the current HEAD
**A `Revenue` record carries no category, no activity marker and no source.** Its fields are `id`, `tip` (**`'factura' | 'notafactura'` — a document type, not an activity**), `nr`, `date`, `collected`, `client`, `cui`, `valoareFaraTva`, `tva`, `status`, `statusDetail`, `eFacturaStatus`.

**Consequence, and it is the core of this brief:** the app **cannot attribute a revenue record to a determination method**. So the fix is **not** "partition the records by method" — the data does not support partitioning. The honest shape is:

1. **One determination method per profile-year.** When the law supplies the flat-ratio method for this income, **the sistem-real expense leg must not run at all** for that profile-year. Not zeroed after the fact — not run.
2. **A genuinely mixed year — accommodation plus real-system activity under art. 68^3 alin. (11) — is not determinable with the current record shape, and must be refused with a named reason.** Do **not** invent an attribution rule, a percentage split, or a category tag to make it compute. Mint the gap in your handoff instead.

## SCOPE
1. **Make the composition single-legged.** Where the flat-ratio method applies, the sistem-real leg is absent from `cumulatedNet`, from the income-tax lines, and from the thresholds. `git diff` must show the suppression happening **before** the two figures are combined, not as a correction afterwards.
2. **Keep the contributions cumulation intact.** art. 170 alin. (1) and art. 148 alin. (3) cumulate across **lit. b) sources** — that is about *different* income sources, not about running two methods over one source. **Do not "fix" the double count by dropping the cumulation.** The distinction is the whole task.
3. **Refuse a mixed-method year explicitly**, naming why: the record set carries no attribution. A new `SCENARIO_SUPPORT` entry, not a branch in `selectEstimateOperands`.
4. **A test that would fail if the refusal were removed.** This is the point of the task: the guard must survive the refusal going away. Write the test that asserts `cumulatedNet` equals one method's net, with the scenario refusal disabled or bypassed.
5. **No new arithmetic, no new rule values, no new fiscal constants.** If you need one, stop and report a BLOCKER.

## WHAT MUST NOT HAPPEN
- **No attribution invented.** No category tag on `Revenue`, no percentage split, no "assume all revenue is accommodation when the family is `cazare`". The last one is tempting and it is wrong: it silently reclassifies a mixed year.
- **No change to the 68^3 calculator itself** (`calc-accommodation-flat-ratio` is correct — it refuses without a gross and refuses to round a base).
- **No occupancy sheet, no guest data.** That is 6h-3 under D-OCC-1.
- **No D212 cell mapping (B-81).**
- **No new migration step.** This task changes composition, not stored shape.

## SCOUT DISPATCH — **sequential**, one at a time, no work in flight
- **Scout A — every consumer of `cumulatedNet`, `vnaSistemReal` and `flatNet` in `tax.ts` and downstream**, including the CAS/CASS threshold bases, the deduction apportionment (`ratioCas`, `ratioCass`) and every line label. Suppressing a leg moves all of them; you need the full list before you touch anything.
- **Scout B — how `selectDeductibleExpenses` and the scenario registry interact for a `cazare` register**, end to end, including where the empty deductible set is produced and what the refusal currently prevents.

Before acting on any report, **grep every file and identifier it names against the tree** (§12.12). Reports in this project have named files that do not exist — and the last two briefs each contained a wrong file path of my own. **If a report names something absent, the whole report is untrusted**: cover it yourself with a bounded grep over identifiers you confirmed exist, follow every hit by **reading**, and record the deviation in one line. **Do not loop on retries.**

## BOUNDARIES
- **May touch:** `domain/tax.ts` (**composition only**), `domain/estimateBasis.ts` (**the method gate and one scenario fact**), `domain/scenarios.ts` (**one new entry**), `domain/aggregation.ts` (**reading only — no formula changes**), `ui/copy/*`, new tests, `e2e/*`.
- **Must not touch:** `domain/fiscal/calculators.ts`, `domain/fiscal/package2026.ts`, `domain/fiscal/release2026.ts`, `domain/fiscal/rules.ts`, `data/schema.ts`, `domain/schema.ts`, `data/migration.ts`, `data/types.ts` (**no new field on `Revenue`**), `pages/Settings.tsx`, `pages/Onboarding.tsx`, `domain/date.ts`, `domain/fx/*`, `domain/projection.ts`, `docs/ai/steps/`.
- **Never touch `docs/ai/steps/`.**

## LANDMINES
1. **Do not fix it by zeroing one leg after the addition.** The suppression must be upstream of the combination, or a later refactor reintroduces the 1.7×.
2. **`ratioCas` and `ratioCass` divide by the cumulated totals.** Change the numerator's meaning and the deduction apportionment silently changes with it. Check what those ratios are for before you move anything.
3. **The contributions cumulation is correct and must survive.** Two *sources* cumulate; two *methods over one source* do not.
4. **PG-5C's enforcement is still load-bearing** — the engine runs on recorded actuals, and `flatRatioGross` must stay absent from `ForecastAmounts`.
5. **The seed estimate must not move** unless the seed profile is a `cazare` register, which it is not. If it moves, you changed something you should not have.
6. **The clock helper's export is `pinClock(at)`** — there is no `pinClockAt()`. **`Bani` is integer lei**; keep Decimal until the final rounding.

## BASELINE (measured at the current HEAD)
`tsc` 0 · **114 files / 1705 unit tests** · `build` 0 · **e2e 95** (91 functional + 4 axe) · copy-guard `ALLOW_LIST` empty · seed completeness 7/9 at 100 % weighted · **seed estimate 311.200 bani (3.112 lei)**.

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
Roadmap 1–10 DONE · 10a/10b/10c DONE · **PG-0** `def8a3c` · **Phase 11 + PG-3** `05ab925` · **PG-1** `a871a68` · **PG-2** `700bd2a` · **PG-4** `c44efb0` · **PG-5** `ab7461d` · **PG-5b** `de44a3a` · **PG-5C** `407d47e` · **PG-6a** `ce245be` · **PG-6b** `5b913a7` · **PG-6h-1** `d17ef1c` · **PG-6h-2** `7f6f718`.
- **6h-2b ← THIS BRIEF.** Then **6h-3** (occupancy sheet, D-OCC-1).
- Then **6c** vehicle facts (B-39 — **premise contested, see `phases/37`**), **6d** other income (B-41), **6e** fixed assets (B-31), **6f** deductible input VAT (B-30), **6g** Form 300 setup (D-VAT-1). Then **PG-8 … PG-13**.
- **1–7 rooms is still uncomputed** — D-CAZ-1 path (c) needs an art. 85 rule with its own citation; the FY2026 package does not have one.
- **B-79** (`closed_final` declared, produced by nobody) is still open and unowned.

## ACCEPTANCE
1. **With the scenario refusal bypassed, `cumulatedNet` equals one method's net — never 1.7 × revenue.** This test is the deliverable. If it only passes because a refusal fires, the task is not done.
2. **For a flat-ratio profile the sistem-real expense leg does not run**: no sistem-real income-tax line, no sistem-real VNA in the threshold bases.
3. **A mixed-method year is refused with a reason naming the missing attribution**, and the refusal comes from the registry, not from a branch in `selectEstimateOperands`.
4. **The contributions cumulation still works for two genuine sources** — a test with two lit. b) sources must still cumulate.
5. **The deduction apportionment ratios are unchanged** for every profile that was computing before.
6. **No new field on `Revenue`, no new migration step, no new rule value.**
7. `tsc` 0 · unit tests pass · `build` 0 · e2e green including axe · copy-guard `ALLOW_LIST` empty · **seed estimate still 311.200 bani** · PG-5C enforcement still green.

## HANDOFF
Write **`docs/ai/phases/39_pg6h2b_single_leg.md`**. Per §12.11: **write it from your own diff** — every path and identifier named must appear in that diff or in a file you opened this task, and **cite no line numbers**.

**Add one short section: what would a mixed-method year need to become computable?** State the minimum fact a `Revenue` record would have to carry, and what it would cost (a migration, a UI question, a seed change). **Do not build it.** 6h-3 and the art. 85 rule both inherit this question, so it needs to be written down once, properly.


## READ FIRST — in this order
1. **`docs/ai/research/38_art68x3_cass_and_occupancy_order.md` §2** — the form, its fields, its legal basis. This is the specification.
2. **`docs/ai/USER_DECISIONS.md` — D-OCC-1.** The user chose to reproduce the **full** form including guest names and CNPs, over the orchestrator's recommendation to record counts only. **D-OCC-1's numbered consequences are acceptance criteria, not commentary.**
3. `docs/ai/phases/38_pg6h2_accommodation_facts.md` — what the app already knows about an accommodation user.
4. `docs/ai/PHASE_PLAN_11_34.md` §12.9, §12.11, §12.12.

## WHAT THIS IS
The occupancy sheet — *fișa de ocupare a capacității de cazare* — approved by **OPANAF nr. 381 din 24.03.2026, MO I nr. 250 din 31.03.2026**, which **abrogates OPANAF 398/2021**. Legal basis: art. 68^3 alin. (8) and art. 85 alin. (8)–(9).

**It is a retention obligation, not a filing.** The wording is „să completeze și să păstreze"; Annex 3: „Se întocmește **un exemplar**, de către contribuabil. **Se păstrează de către contribuabil.**" **Nothing is submitted to ANAF.** That single fact drives every privacy requirement below.

## WHAT ALREADY EXISTS — verified in-tree at `8e58087` on 2026-10-11
- **No network write path exists anywhere in `src`.** A grep for `fetch(`, `XMLHttpRequest` and `navigator.sendBeacon` returns **nothing** outside tests. D-OCC-1's "no network path for guest data" is therefore a property you must **keep true**, not one you must build. A test should assert it stays true.
- **`Documents.tsx` already has an export path** — `rjipCsv` — plus an upload/preview surface and a `Modal` preview. **This is where guest data could leak.** Any CSV the app can produce must be provable not to contain a guest name or CNP unless the user explicitly asked for the sheet itself.
- **Migration chain is at v13** (`DATA_VERSION_ACCOMMODATION_FACTS = 13`). **Append v14; never edit a shipped step.**
- **The per-year record pattern already exists twice**: `AccommodationRoomCountYear` (`{ fiscalYear, rooms }[]`) and `PensionReceiptYear`. **Follow it.**
- **`accommodationIncomeTitleForYear`** in `domain/models.ts` already resolves 1–7 vs >7 into a title. **Do not re-decide the category here** — the sheet is for both beneficiary groups.

## SCOPE
1. **The sheet, as approved.** Per **room**, per **year**: the year; the property address (Secțiunea I); the room / amenaged-space identifier (Secțiunea II); then per stay — **guest name**, **guest CNP** (or ID series and number where there is no CNP), **first day**, **last day**. One form per room, per year.
2. **The definitional rule the model carries.** Short-term is „închirierea neîntreruptă a unei camere aceleiași persoane, pentru perioade de **maximum 30 de zile**, într-un an calendaristic", and **„Închirierea/ocuparea … pentru o fracție de zi, se consideră închiriere/ocupare pentru o zi."** If the app computes nights or days, that rule is the citation.
3. **Both beneficiary groups**, per the order's Instructions pct. 1: (a) 1–7 rooms in personal dwellings, „indiferent de numărul de locuințe"; (b) independent-activity accommodation plus >7 rooms. **The app must not gate the sheet on the fiscal title.**
4. **Deletion must be real.** Deleting removes the record from persisted data, not just from a view. Say plainly, in copy the user can read, that **this is their own copy of a document they are legally required to keep** — the app is not ANAF's archive and clearing it does not discharge the obligation.
5. **Export is an explicit, deliberate act.** Producing the sheet is fine. **Silently including guest data in any existing export is not.**

## THE PRIVACY REQUIREMENTS ARE ACCEPTANCE CRITERIA (D-OCC-1)
1. **Local storage only.** No guest name, CNP, ID series or stay date may reach a network call, a log, an analytics surface, or an export the user did not explicitly request. **A test must assert the no-network property still holds after your change.**
2. **No real CNP in any fixture, seed, test or e2e file.** Use obviously synthetic values and say so in a comment. **A grep for a plausible real CNP must come back empty.**
3. **Deletion is real and tested** — persisted data no longer contains the record.
4. **No guest data in any existing CSV path by default.** Prove it with a test against `rjipCsv` or whatever export surface you touch.
5. **Guest data must not appear in any diagnostic, error message, breakdown line, or fiscal figure.** It is not an engine operand and must never become one.

## WHAT MUST NOT HAPPEN
- **The sheet is not a revenue source.** Do not derive gross income, room counts, occupancy or any fiscal figure from guest records. `research/39` and `phases/38` both warn that the room count **must not** be used as an occupancy record; the reverse is equally true. **The engine must not read this data at all.**
- **No CNP checksum validation that blocks the user.** A CNP has a check digit; you may **format-check length and charset and flag** a suspect value, but the app records what the taxpayer records. Do not refuse a stay because a CNP looks wrong.
- **No D212 cell mapping (B-81).** OPANAF 2736/2025 has no 68^3 subsection and still cites the abrogated OPANAF 398/2021.
- **No change under `domain/fiscal/`, `domain/tax.ts`, `domain/scenarios.ts` or `domain/estimateBasis.ts`.** This task adds a retained document, not a computation.
- **No inference of the room count or the fiscal title from the sheet.**

## SCOUT DISPATCH — **sequential**, one at a time, no work in flight
- **Scout A — how a persisted record set is added end to end**: `data/types.ts` → `domain/schema.ts` (the zod profile/app shape) → `data/migration.ts` (append a step) → `data/seed.ts` → the page that renders and edits it. Use `AccommodationRoomCountYear` as the worked example.
- **Scout B — every export, download and serialisation path in the app**, including `rjipCsv` in `Documents.tsx`, anything that writes a file, and anything that stringifies app data. You need the complete list before guest data exists anywhere.

Before acting on any report, **grep every file and identifier it names against the tree** (§12.12). Recent briefs have each contained a wrong path of my own — the last one said `data/schema.ts` when the zod profile shape lives in `domain/schema.ts`. **If a report names something absent, the whole report is untrusted**: cover it yourself with a bounded grep over identifiers you confirmed exist, follow every hit by **reading**, and record the deviation in one line. **Do not loop on retries.**

## BOUNDARIES
- **May touch:** `data/types.ts`, `domain/schema.ts`, `data/migration.ts` (**new step only**), `data/seed.ts`, `pages/Documents.tsx`, `pages/Settings.tsx` (**entry point only**), `ui/copy/*`, new tests, `e2e/*`.
- **Must not touch:** anything under `domain/fiscal/`, `domain/tax.ts`, `domain/scenarios.ts`, `domain/estimateBasis.ts`, `domain/aggregation.ts`, `domain/date.ts` (**use it**), `domain/fx/*`, `data/dashboard.ts`, `data/derived.ts`, `docs/ai/steps/`.
- **Never touch `docs/ai/steps/`.**

## LANDMINES
1. **This is the first data in the app about people who are not the user.** Every existing assumption — that persisted data is the taxpayer's own, that it can be exported freely, that it is safe in a fixture — stops being automatically true.
2. **Retention, not filing.** Do not build a submission path, a "send to ANAF" affordance, or a deadline that implies one. The deadline that exists is the taxpayer's own retention.
3. **One sheet per room, not per stay and not per property.** The model is per room; stays are rows inside it.
4. **A fraction of a day counts as a day**, and the 30-day ceiling is per person per room per calendar year. If you compute either, cite the order.
5. **The abrogated order is still live in ANAF's own instructions.** OPANAF 2736/2025's D212 instructions still point at OPANAF 398/2021. If you cite a fișă, cite **381/2026**.
6. **The seed estimate must not move** — the engine must not read this data. If 311.200 bani changes, you broke the boundary.
7. **The clock helper's export is `pinClock(at)`** — there is no `pinClockAt()`. **`Bani` is integer lei.**

## BASELINE (measured at `8e58087`)
`tsc` 0 · **116 files / 1729 unit tests** · `build` 0 · **e2e 95** (91 functional + 4 axe) · copy-guard `ALLOW_LIST` empty · seed completeness 7/9 at 100 % weighted · **seed estimate 311.200 bani (3.112 lei)**.

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
Roadmap 1–10 DONE · 10a/10b/10c DONE · **PG-0** `def8a3c` · **Phase 11 + PG-3** `05ab925` · **PG-1** `a871a68` · **PG-2** `700bd2a` · **PG-4** `c44efb0` · **PG-5** `ab7461d` · **PG-5b** `de44a3a` · **PG-5C** `407d47e` · **PG-6a** `ce245be` · **PG-6b** `5b913a7` · **PG-6h-1** `d17ef1c` · **PG-6h-2** `7f6f718` · **PG-6h-2b** `353bfee`.
- **6h-3 ← THIS BRIEF.** PG-6h is then complete.
- Then **6c** vehicle facts (B-39 — **premise now settled, see D-VEH-1: the 50 % default is the law, `unknown` is not `incomplete`**), **6d** other income (B-41), **6e** fixed assets (B-31), **6f** deductible input VAT (B-30), **6g** Form 300 setup (D-VAT-1). Then **PG-8 … PG-13**.
- **1–7 rooms is still uncomputed** — D-CAZ-1 path (c) needs an art. 85 rule with its own citation; the FY2026 package does not have one.
- **B-79** (`closed_final` declared, produced by nobody) is still open and unowned.

## ACCEPTANCE
1. **A sheet exists per room per year** with the fields the order specifies, and a test renders one with synthetic guest data.
2. **No real CNP anywhere in the repo's fixtures, seeds or tests** — and you must run that grep and report its result.
3. **The no-network property still holds**: a test asserts no `fetch`/XHR/beacon was introduced, and the guest fields appear in no log or diagnostic.
4. **No existing export gains guest data by default** — a test against the CSV path proves it.
5. **Deletion removes the record from persisted data**, tested.
6. **The engine does not read this data**: `git diff --stat` shows nothing under `domain/fiscal/`, and **the seed estimate is still 311.200 bani**.
7. **The migration appends v14 and backfills nothing**; every test that moves moves because the chain grew, recorded old → new.
8. **Copy states, in Romanian, that this is the taxpayer's own retained copy of a document they must keep**, and that nothing is filed with ANAF.
9. `tsc` 0 · unit tests pass · `build` 0 · e2e green including axe · copy-guard `ALLOW_LIST` empty · PG-5C enforcement still green.

## HANDOFF
Write **`docs/ai/phases/40_pg6h3_occupancy_sheet.md`**. Per §12.11: **write it from your own diff** — every path and identifier named must appear in that diff or in a file you opened this task, and **cite no line numbers**.

**Add one short section: what the app now knows about an accommodation user end to end** — family, per-year room count, fiscal title, commission reading, eligibility statement, and now the occupancy record — and **what still blocks a computed figure for 68^3** (B-80's commission scope, the attribution gap recorded in `phases/39`, and the missing art. 85 rule). PG-6h ends with this task, so the next phase should start from your list rather than from the research notes.
