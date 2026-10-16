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
