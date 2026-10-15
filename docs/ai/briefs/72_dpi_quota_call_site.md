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
4. **OVERRIDE — Scouts run SEQUENTIALLY.** One at a time, waiting for each report. Standing user decision (2026-10-10).
5. Each Scout inspects the smallest relevant territory and returns a compact report.
6. If the Worker finds missing local information, it spawns another narrow Scout — it does not search broadly.
6a. **UNDER NO CIRCUMSTANCES does the Worker do any work while a Scout is running.** Dispatch → **stop** → receive → read only the files you will edit → edit.
7. One Worker = one coherent, tightly scoped job.
8. Do NOT spawn a post-Worker Scout verification pass. The Worker self-validates instead.
9. Self-validate: npx tsc --noEmit, npm run build, the two capped suite commands in §12.17.
10. Do not start future phases. Stop when this phase's acceptance criteria are met.

**Scout infrastructure — known defect.** Use the explicit override `llama-cpp/qwen3.8-flash-next-iq3_s` from the start. If it fails, STOP and report a BLOCKER.

**Engine instability — known.** 262k context, ~390 MiB free, one slot, SIGKILLed under load. On-disk work survives; resume and continue. Checkpoint early and often.

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

**§12.17 — the commands are mandatory, not the intention.** During development use `npx vitest run <path>` and `npx playwright test <spec>`. **Never `npm run test` as an iteration loop.** The full-suite gate is exactly these two commands, **once each, never concurrently**:

```
npx vitest run --pool=threads --poolOptions.threads.maxThreads=2
npx playwright test --workers=2
```

`npm run test` and `npm run test:e2e` use the default full-parallel pool and exhaust the user's machine. Slower is the point.

**Neither gate may be a bare foreground command — a multi-minute foreground call kills your own connection.** Run each in the background to a log, then read the log once:

```
npx vitest run --pool=threads --poolOptions.threads.maxThreads=2 > /tmp/unit.log 2>&1 &
tail -n 30 /tmp/unit.log
```

Same shape for `npx playwright test --workers=2 > /tmp/e2e.log 2>&1 &`. **One gate at a time.** If the log is incomplete, wait once and re-read — never re-run the suite, never start the second gate while the first is writing.

---

# Brief 72 — give the DPI quota its missing call site, and the exception that goes with it

**B-147, B-148, B-150. One subsystem: the DPI arithmetic.**

**This brief is a prerequisite.** The user has decided the DPI fork (D-DPI-1): **the typed net is retired and the recorded documents survive — but only once a gross → quota → net path actually computes.** Retiring the typed net before that path exists would strand every taxpayer with DPI income and no recorded documents. **You are building the thing that makes that retirement possible.** Do not retire anything here.

---

## B-147 — the 40 % quota is a calculator the engine never runs

`calcDpiFlatQuota` exists at `calculators.ts:1658`, is registered as `'calc-dpi-flat-quota'` at `:1809`, and is declared by the rule package at `dpi2026.ts:286`. **Its only invocation in the whole tree is `dpi2026.test.ts:23`.**

**The quota is settled and cited — do not re-litigate it.** `research/48` §1 and §3: **art. 72 alin. (2)** and **art. 72¹ alin. (1)**, *„prin deducerea din venitul brut a cheltuielilor determinate prin aplicarea cotei forfetare de **40 %** asupra venitului brut"* → **venit net = 0,6 × venit brut**. The register records **40 %, not 20 %** as a correction, and records the quota as **automatic, not elective, applied by the payer**.

**Wire it.** A recorded DPI document must reach this calculator and produce a net that the contribution arithmetic can consume.

**The bar you have to clear:** today, the ANAF fixture that *minted* B-112 — **CAS 24.300 lei** — is reproduced by *typing* the net (`regimeSplit.test.ts:114,166`). **After your change it must be reproduced by computing it from a gross.** If it can't, the wiring is decorative and you have not finished.

---

## B-150 — the exception, and it is not optional

Art. 72 alin. (3) / art. 72¹ alin. (2): *moștenitori*, *drept de suită* and *remunerație compensatorie pentru copia privată* get **no flat quota** — net = gross — **and** are **excluded from CAS** by art. 137 alin. (1) lit. b¹), which carves them out of the DPI CAS category at the definition. `research/48` states it as **„one flag, two consequences."**

**This belongs in the same brief as B-147 for one reason:** wiring the quota *without* the exclusion applies a 40 % deduction the law expressly withholds from these three categories. **That is a worse defect than the silence it replaces.** If you can only land one of the two, land neither and report.

---

## B-148 — the class that let B-147 hide

Dispatch is **seven hardcoded literal call sites** in `tax.ts` — 681, 706, 726, 902, 1040, 1113, 1378. **Nothing ever dispatches on `rule.calculatorId`.** A rule package can declare any id, register a function for it, and **nothing fails if no call site exists.**

`ruleSetDigest.ts:24` actively documents the opposite — *„`calculatorRegistry[rule.calculatorId]` picks the calculator"* — which is false. `dpi2026.ts:65` and `deductibility2026.ts:27` both concede in their own comments that their `calculatorId` is *„a label only"*.

**What is wanted here is not a refactor.** Do not rewrite dispatch. What is wanted is **a guard**: a test that fails when a rule package declares a `calculatorId` that no production code path can reach. **The rule package is the source of truth for what must be computable; the engine currently isn't.**

**Why this matters more than the one DPI fix:** B-137's annual-average lifecycle was implemented, unit-tested and had **no e2e route for an entire phase**. Same shape here — implemented-and-unreachable reads as done — and here there was not even a browser route to discover it. **A test that calls the registry entry directly proves the function works and proves nothing about whether the engine uses it.** That is exactly how `dpi2026.test.ts` stayed green while the quota did nothing.

---

## Boundaries

- **Do not retire `CassLadderYear.proprietateIntelectuala`.** Do not remove the typed net, do not build a precedence, do not "temporarily" prefer the computed path. The retirement is a **consolidated chain brief** (v21 → v22) that will also carry B-145, B-108 and B-140, and it happens **after** yours works.
- **Both representations stay live, and the B-112 stage-1 refusal stays exactly as it is.** Once your computed path produces a figure, the refusal will start firing on data that previously only had the typed route. **If it does, report that rather than loosening the refusal.**
- **No migration chain step. Chain head stays v21.** If wiring needs a persisted field, **stop and report** — that is the chain brief's job.
- **Do not touch `src/domain/fx/**`, `caen_rev3.csv`, or persona figures.** Report any figure movement with old → new → reason.
- The 311.200-lei seed pin at `seed.identityHygiene.test.ts:339`: if it moves, report before touching.

---

## Acceptance criteria

1. `npx tsc --noEmit` → 0. `npm run build` → 0. Both capped gates → all pass, **once each, backgrounded to a log**.
2. **A recorded DPI document produces a net through `calcDpiFlatQuota`**, and a contribution figure consumes it. Assert the chain, not just the function.
3. **The ANAF CAS 24.300 fixture is reproduced by computing from a gross**, not by typing a net. State explicitly that this is what changed.
4. **The art. 72 alin. (3) flag carries both consequences**: no quota (net = gross) and no CAS. One test per consequence, and one proving they come from the same flag.
5. **A guard test for B-148** that fails on a declared-but-unreachable `calculatorId`. Prove the guard works by showing it catches the current `calc-dpi-flat-quota` state **before** your wiring, or an equivalent synthetic case.
6. **`ruleSetDigest.ts:24`'s false claim corrected** — a comment that describes a mechanism the engine does not have is how the next agent re-introduces this defect.
7. **The B-112 refusal behaves identically**, or its change is reported.
8. Report **newly measured** unit and e2e counts.

---

## What to expect

**This will move figures.** Persona 2 carries 15 DPI documents and 150.000 lei gross; today those documents reach no calculator. Once they do, contribution bases that were previously only ever fed by typed nets can change. **That is the point of the change, not a regression** — but every moved figure must be listed with old → new → reason, and **if a figure moves somewhere you cannot explain from the quota arithmetic, stop and report it.**
