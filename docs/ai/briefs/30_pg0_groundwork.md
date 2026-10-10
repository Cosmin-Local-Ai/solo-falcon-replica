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
- **`docs/ai/PHASE_PLAN_11_34.md` §12.2** — *"PG-0 is a hard prerequisite for any date-dependent acceptance criterion."* §12.9 and §12.10 are new and binding on you.
- `docs/ai/briefs/28_pg_production_gate.md` **§PG-0** — the gate's own wording. **This brief supersedes parts of it; see "WHAT IS ALREADY DONE" below.**
- `docs/ai/STATE.md` — defect **B-46** (the UTC date defaults).

## WHAT IS ALREADY DONE — do not re-do it, and do not scout it

I verified every premise below in-tree at `ab7df41` on 2026-10-10. **The gate doc overstates PG-0; this is the real scope.**

- **The E2E clock is already pinned.** `e2e/dashboard.spec.ts:75` calls `await page.clock.setFixedTime(FIXED_AS_OF)`, with the reasoning at `:63` and `:94`. **Both spec files contain zero `new Date()`.** The gate's *"re-pin every date-dependent E2E assertion"* is largely finished — your job is to find any that escaped, not to build the mechanism.
- **`src/domain/date.ts` is already the single wall-clock seam.** `now()` at `:21` is the only place the domain reads the clock; **every other function takes an injectable `instant: Date`** (see the comment at `:14`). Exports: `now`, `localDateISO`, `localYear`, `toInstantISO`, `epochMs`, `daysInMonth`, plus the ISO-validation and Romanian-formatting helpers.
- **Two unit tests already fake time**: `src/pages/Dashboard.test.tsx` and `src/pages/Settings.fx.test.tsx`. There is **no shared helper** — that is the gap.
- **There is no CI whatsoever.** No `.github/` directory exists.
- **There is no `scripts/` directory.** `scripts/today` does not exist.
- **`axe-core` is not installed** — no `axe` entry in `package.json`.
- `playwright.config.ts` is minimal: `testDir: './e2e'`, `fullyParallel: true`, `reporter: 'list'`, `baseURL: http://localhost:5173`, `trace: 'on-first-failure'`, and a `webServer` running `npm run dev` with `reuseExistingServer: true`.
- **Scripts available:** `test` = `vitest run`, `test:watch`, `test:e2e` = `playwright test`.

## SCOPE — PG-0

1. **A shared fixed-clock helper for vitest.** One importable seam that pins the clock for a test or a file, so no unit test reads the wall clock. **Mock `domain/date.ts`'s `now()` — do not monkey-patch the global `Date`.** The domain was built around an injectable `instant`; breaking that invariant to fake a date is the wrong seam and will fight every later phase.
2. **`scripts/today`** — one command that prints the date stamp the docs and ledgers use, so stamps stop being typed by hand.
3. **CI**: typecheck → vitest → build → Playwright (with browsers installed) → **axe-core on `/dashboard`, failing on `serious` and `critical` only**. Green on a clean clone.
4. **Reconcile `STATE.md`'s numbers.** They are stale in at least three places: `:26` still quotes *"28 test files, 102 tests"*, `:50` still says *"64 test files, 1149 unit tests"*, and the header carries a third figure. **The true current figures are 80 test files / 1368 unit tests, e2e 39** — taken from the Phase 10c handoff, not re-measured.

## SCOUT DISPATCH — mandatory, see §12.9

**You have a `subagent` tool. Use it before you read.** Your own agent definition says it: *"Reading large or unfamiliar codebases directly will burn it before you can edit anything"*, and *"A good rhythm: **scout to find, read to edit**."* Independent investigations go out **in the same turn** so they run in parallel.

**Dispatch these scouts up front:**
- **Scout A — the blast radius of `domain/date.ts`.** Every caller of `now`, `localDateISO`, `localYear`, `toInstantISO`, `epochMs`, `daysInMonth` across `src/`, grouped by file with line ranges, and which of those call sites pass an explicit `instant` versus relying on the default. **You are not going to edit `domain/date.ts` or its callers** — you need the map, not the bytes.
- **Scout B — every date-dependent assertion in `e2e/`.** Which are already pinned to `FIXED_AS_OF`, which assert against a value that drifts with the real date, and what `FIXED_AS_OF` actually is. **You may not need to edit these files at all.**
- **Scout C — how `Dashboard.test.tsx` and `Settings.fx.test.tsx` currently fake time**, so the shared helper matches the pattern already in the house instead of inventing a second one. **You are not editing those tests.**

**Then scout again mid-task** if you reach a subsystem this brief did not predict.

**Never send a scout at a file you are going to edit.** A scout returns a summary, not verbatim source; you must re-read the 1–3 files you actually change regardless, so scouting them is pure waste. Re-read those yourself with `read`.

## BOUNDARIES
- **May touch:** new `src/test/` or `src/testing/` clock helper, `vitest.config.ts`, `vite.config.ts`, `playwright.config.ts`, `e2e/*.spec.ts` (pinning only), new `.github/workflows/*`, new `scripts/today`, `package.json` (devDependencies only), `docs/ai/STATE.md` (numbers only).
- **Must not touch:** any domain rule, calculator, threshold, registry, migration, seed figure, or copy string. **Do not fix B-46** — the three UTC defaults in `Expenses.tsx:47`, `Revenues.tsx:30` and `Declarations.tsx:31` belong to **PG-2**.
- **Never touch `docs/ai/steps/`** — the 33-file frozen archive.

## LANDMINES
1. **A fixed clock will make B-46 visible.** If pinning the clock makes an existing test fail, **that is a true finding, not breakage.** Report it; do not widen a matcher or delete the assertion to get green.
2. **`reuseExistingServer: true` is deliberate** — it keeps local dev fast. Make CI work without changing that behaviour for humans.
3. **axe must fail only on `serious` and `critical`.** Minor/moderate findings are noise at this stage and will stall every later Worker.
4. **Do not re-measure the suite to update STATE.** Use the figures above. §12.10.
5. **`scripts/today` must emit the local date, not the UTC date** — the same class of bug as B-46. A stamp tool that stamps the wrong day is worse than typing it.

## BASELINE (from the Phase 10c handoff at `ab7df41`)
`tsc` 0 · **80 test files / 1368 unit tests, all passing** · `build` 0 · **e2e 39 passed** · copy-guard allow-list empty.

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
Roadmap 1–10 DONE · pre-Phase-11 TASKS 1–9, 10a, 10b DONE · research phase closed 2026-10-10 (`research/28`…`research/37`) · **Phase 10c DONE (`ab7df41`), B-36 and B-37 closed, B-68 minted and fixed in passing.**
- **PG-0 ← THIS BRIEF.**
- Then **Phase 11 + PG-3** (seed and first-run separation — both halves already decided by **D-SEED-2**: no preloaded data, seed data is test-only), then **PG-1** (estimate coverage: no silent exclusions), **PG-2 / 12C** (payment and collection dates, and B-46 and B-66 live there).

## ACCEPTANCE
1. CI runs green from a clean clone: typecheck, vitest, build, Playwright with browsers installed, and the axe step.
2. **No test reads the wall clock.** Prove it by the helper being the only seam, not by grepping for `new Date()` and hoping.
3. `scripts/today` prints the correct **local** date.
4. `STATE.md`'s test figures match the Phase 10c handoff, in every place they appear.
5. The axe step demonstrably fails when a `serious` violation is introduced, and does not fail on a `minor` one. **Show both.**
6. `tsc` 0 · all unit tests pass · `build` 0 · e2e green · guard allow-list empty.

## HANDOFF
Write **`docs/ai/phases/27_pg0_groundwork.md`** — note the numbering: `phases/25_euro_caps_provisional_rates.md` and `phases/26_fx_end_to_end.md` both exist, so **27** is next. State plainly any assertion a fixed clock exposed as already-wrong, and hand it to PG-2 rather than fixing it yourself.
