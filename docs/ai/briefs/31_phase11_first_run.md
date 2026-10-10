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

## HYGIENE
- Phase docs → `docs/ai/phases/NN_<name>.md`. **Never touch `docs/ai/steps/`** (33-file frozen archive; `steps/15_tax_engine.md` is not this task's file).
- `docs/ai/PLAN.md` / `docs/ai/STATE.md` are the live shared state.
- **Date stamps from the tool.** Validation via the runner's own exit status (`set -o pipefail`, never a piped `grep`).


## READ FIRST
- **`docs/ai/PHASE_PLAN_11_34.md` §6 — "11 — Coherent 2026 seed + first-run separation" AND `briefs/28_pg_production_gate.md` §PG-3.** **This brief merges them.** They are the same work under two names: same files, same decision, one root cause. Do not treat them as sequential.
- **`docs/ai/USER_DECISIONS.md` — D-SEED-2.** This is already decided and you do not reopen it: **no preloaded data, no banner-on-demo compromise, seed data is test-only.** It closes D1 at its root.
- `docs/ai/phases/26_fx_end_to_end.md` §on `hasData` and **B-68** — the empty-state lesson.
- `docs/ai/phases/27_pg0_groundwork.md` — the clock seam you must use, and the expected test counts.
- `docs/ai/STATE.md` defects **B-47**, **B-68**.

## WHAT ALREADY EXISTS — verified in-tree at `def8a3c` on 2026-10-10. Do not re-derive it.

**There is no onboarding.** `src/pages/` contains `Clients`, `Dashboard`, `Declarations`, `Documents`, `EFactura`, `Expenses`, `Revenues`, `Settings` and their tests. **No `Onboarding.tsx`.**

**First run hands out the seed.** `src/data/store.tsx`: `:14` imports `seedData`; `:166` `data: seedData`; `:169` `dataOrigin: record ? 'quarantined' : 'seed'`; `:185` returns `{ data: seedData, dataOrigin: 'seed', migration: null, quarantine: null }`; `:197` `'persisted'`; `:216` `const [dataOrigin] = useState(initial.dataOrigin)`. **`'seed'` renders no banner — only `'quarantined'` does.** That is D1.

**The seed is the wrong PFA.** `src/data/seed.ts`: `pfaStartYear: 2020`, `fiscalYear: 2026`, `numarRegComert: 'J40/1234/2020'`, `updatedAt: '2026-09-28T10:00:00.000Z'`. Revenues `r1`–`r4` are dated **2026-09-02 / 09-10 / 09-18 / 09-25**; expenses `e1`–`e2` are **2026-09-05 / 09-12**. So it is a **2020-start PFA with six September-2026 transactions** — not a 2026-start PFA, and not the "transactions Jan–Oct coherent with it" PG-3 asks for. **TASK 9 already removed the false quarterly filings and that removal stays**; verify what declaration-shaped facts remain rather than assuming the old list.

**The profile already carries most facts onboarding must collect.** `PfaProfile` (`src/domain/models.ts:230-348`): `id`, `pfaStartYear`, `pfaStartDate?`, `fiscalYear`, `regime`, `salaryStatus`, `salaryIncomeLei?: Bani`, `pensionerStatus?`, `pensionReceiptYears?`, `pensionSuspensionYears?`, `cassPreviousYearContext?`, `foreignSicknessInsurance?`, `otherIncome: PfaOtherIncomeFlag[]`, `socialInsuranceStatus`, `vatExempt: boolean`, `vatExceedanceDate?`, `cashFloorLei: Bani`, `identity: PfaIdentity`, `updatedAt`. **Deprecated and not to be written:** `caen?` (Phase 7 — the CAEN model is `identity.caen: CaenCode[]`), `pensionStatus?` (TASK 5 — renamed to `pensionerStatus`).

**Completeness is already a domain concept.** `src/domain/completeness.ts` exports `CompletenessCheck`, `CompletenessReport` and `assessCompleteness(data: AppData)`. **Do not build a second completeness model.**

**The clock seam exists — use it, do not hand-roll.** `src/test/fixedInstant.ts` is the single pinned instant (vitest-free, importable from `e2e/`); `src/test/clock.ts` gives `pinClock` / `unpinClock` / `assertClockSeam`. **Never hand-roll `vi.useFakeTimers` and never invent a date constant.**

### Refusals that are decisions, not gaps — leave them alone
- **Do not model normă de venit.** `12H` is gated on **D-NORMA-2**, not on research. Onboarding must recognise the regime and **refuse it with an explicit "nu este suportat" screen and no estimate** — that is the whole requirement.
- **Do not collect an activity family or map CAEN to one.** `12E` is blocked on a CAEN → activity-family decision that research 21 §7(c) left undecided.
- **Do not collect other-income amounts.** `12F` owns them. Onboarding takes **yes/no only**, which `otherIncome: PfaOtherIncomeFlag[]` already models.

## SCOPE — Phase 11 + PG-3, merged

1. **Empty storage means onboarding, not seed data.** A fresh browser profile must not open on a populated demo workspace. `'seed'` stops being a first-run state.
2. **Onboarding collects, with validation:** name / CUI as applicable (`identity`); regime — with `norma_venit` routed to an explicit refusal screen carrying **no estimate**; **PFA start date, required**; VAT status plus registration date; salary and pension facts; other income **yes/no**. **Defer the activity declaration and the other-income amounts to PG-6** — say so on screen rather than inventing placeholders.
3. **Hero shows "Completează profilul" until the required facts exist**, using `assessCompleteness`, not a new model.
4. **Demo data becomes an opt-in sandbox**: visibly marked, removable, and never the initial state. Add **"Șterge toate datele și începe de la zero"** in Settings with confirmation.
5. **Rewrite the seed as a 2026 PFA**: start date in 2026, transactions coherent with that start date, no prior-year filings, no SRL remnants in `companyDocs`. **It stays test-only** — a fixture, not a first run. **Do not seed an FX rate: a seeded rate is a fabricated legal figure.**
6. **With zero records the Dashboard still shows the next deadline, profile completeness and next steps.** Today those sections hide behind the empty state.

## SCOUT DISPATCH — mandatory, and **SEQUENTIAL**

You have a `subagent` tool; your own definition says *"A good rhythm: **scout to find, read to edit**."* **Dispatch one scout at a time and wait for its report — never two concurrently.** §12.6, resolved by the user as **C5**: one engine slot, ~390 MiB headroom, two Workers already SIGKILLed mid-run. The parallel-scout permission in your agent definition is **not adopted here**.

**Scout these, one at a time, before you read:**
- **Scout A — every consumer of `dataOrigin` and `seedData` across `src/`.** Where `'seed'` is branched on, where the banner logic lives, what reads `initial.data`. **You are not going to read those files whole.**
- **Scout B — every consumer of `PfaProfile` and `parsePfaProfile`**, plus which fields the engine actually reads today. This is the blast radius of changing the seed and of adding onboarding writes; **you will not edit `models.ts`**.
- **Scout C — every empty-state / "no data" branch in `Dashboard.tsx`, `components/dashboard/*` and `FinancialChart.tsx`**, with line ranges. **You may not need to edit most of these.**

Keep each task **narrow and short** — the scout model produced no output at all on three runs during PG-0 and only answered on a re-dispatch with a tighter, shorter task. **Never scout a file you are going to edit**: a scout returns a summary, not verbatim source, and you must re-read the files you actually change regardless.

> **⚠️ The contract block's scout remedy is a no-op — do not rely on it.** It says *“The scout profile's default model produces no output. Use the explicit override `llama-cpp/qwen3.8-flash-next-iq3_s` from the start.”* **That model is already `~/.pi/agent/agents/scout.md:5`'s default**, so the "override" changes nothing, and it is the model that went silent three times in PG-0. Practical rule: keep every scout task short and single-purpose; if a scout returns nothing, **re-dispatch it narrower once**; if it fails twice, **stop and report a BLOCKER** rather than substituting a broad repository search of your own.

## BOUNDARIES
- **May touch:** `data/seed.ts`, `data/store.tsx` (initial state and `DataOrigin` only), new `pages/Onboarding.tsx`, `pages/Dashboard.tsx`, `pages/Settings.tsx`, `components/dashboard/*`, `data/migration.ts` (only if a new persisted shape demands a step), `ui/copy/*`, new tests, `e2e/*`.
- **Must not touch:** any calculator, rule value, threshold, rule registry, snapshot digest, or the FX layer. **Do not touch `src/domain/date.ts`, `src/test/clock.ts` or `src/test/fixedInstant.ts`.**
- **Never touch `docs/ai/steps/`** — the frozen archive.

## LANDMINES
1. **`DataOrigin` is a union and the banner logic branches on it.** Adding a state is fine; leaving `'seed'` reachable from a fresh profile is not. Grep every branch before you change it.
2. **B-68, the lesson from 10c:** `Dashboard.tsx` once gated the whole dashboard on `pfaRevenue > 0`, so a ledger whose records were all excluded rendered the *"start from scratch"* empty state. **Every empty-state gate you touch must be tested against a ledger that is present but excluded, not only one that is absent.**
3. **A new persisted profile shape must not quarantine real users.** `safeParse` runs **before** the migration chain and zod strips unknown keys, so a schema requiring a new key rejects every stored payload and quarantines it. That is why `pfaStartDate`, `salaryIncomeLei` and the pension fields are all optional. **Follow that pattern; if you need a required field, add a migration step and say so.**
4. **Do not seed an FX rate.** A rate is a legal datum. Seeding one fabricates it.
5. **`salaryIncomeLei` keeps a stale suffix on purpose** — it holds integer **bani**. Renaming a persisted key is not a type change. Do not "fix" the name.
6. **Do not write the deprecated fields** `caen` and `pensionStatus`. `pensionFacts.test.ts` fails if a new reader of `pensionStatus` appears.
7. **Use `pinClock()` and `fixedInstant.ts`.** The expected counts after PG-0 are **81 unit files / 1375 tests** and **e2e 42 = 39 functional + 3 axe** — do not read 42 as a regression, and do not run the axe spec as if it were functional.

## BASELINE (from the PG-0 handoff at `def8a3c`)
`tsc` 0 · **81 test files / 1375 unit tests, all passing** · `build` 0 · **e2e 42** (39 functional + 3 axe) · copy-guard allow-list empty · CI exists but has never run on Actions.

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
Roadmap 1–10 DONE · pre-Phase-11 TASKS 1–9, 10a, 10b DONE · research closed (`research/28`…`research/37`) · **Phase 10c DONE (`ab7df41`), B-36/B-37 closed, B-68 minted and fixed** · **PG-0 DONE (`def8a3c`), B-69 minted, §12.2's gate now open.**
- **Phase 11 + PG-3 ← THIS BRIEF.**
- Then **PG-1** (estimate coverage: no silent exclusions — read `DashboardData.ledger`, don't re-walk records), then **PG-2 / 12C** (payment and collection dates — **B-46**, **B-66** and the `onDateSource` vocabulary all land there), then PG-4 … PG-13.

## ACCEPTANCE
1. A fresh browser profile with **zero stored entries** opens on onboarding — **no demo invoices, no pre-filled name in the topbar.** Prove it in Playwright, not in a unit test.
2. Onboarding validates and refuses to proceed without a **PFA start date**; `norma_venit` reaches an explicit refusal screen that shows **no estimate**.
3. The hero shows **"Completează profilul"** while required facts are missing, and it is driven by `assessCompleteness`.
4. The seed is a **2026** PFA whose transactions are coherent with its start date, has no prior-year filings, no SRL remnants, and **no seeded FX rate** — and it is reachable only as an opt-in sandbox.
5. **"Șterge toate datele și începe de la zero"** works, with confirmation, and lands the user back on onboarding rather than on the seed.
6. With zero records the Dashboard still shows the next deadline, profile completeness and next steps.
7. **A ledger that is present but excluded does not trigger the empty state** — the B-68 test, for every gate you touch.
8. `tsc` 0 · unit tests pass · `build` 0 · e2e green including the axe spec · guard allow-list empty.

## HANDOFF
Write **`docs/ai/phases/28_phase11_first_run.md`** — `phases/27_pg0_groundwork.md` is the latest, so **28** is next. State plainly which profile facts onboarding collects and which it **defers to PG-6 / 12E / 12F**, and hand anything date-shaped to PG-2 rather than fixing it here.
