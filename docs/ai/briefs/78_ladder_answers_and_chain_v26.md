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

**§12.20 — these are the default `npm run test` / `npm run test:e2e` scripts.** The uncapped forms are `test:uncapped` and `test:e2e:uncapped` and **you must not use them.**

**Neither gate may be a bare foreground command.** Background to a log, read the log once, one at a time, never re-run:

```
npm run test > /tmp/unit.log 2>&1 &
tail -n 30 /tmp/unit.log
```

**§12.18 — search `docs/ai/research/` before you re-derive a fact.** Cite the file.

**§12.19 — when you close a register row, rewrite its first sentence.**

---

# Brief 78 — the ladder answers, not the ladder guesses: D-DPI-2 and chain step v26

**This brief implements D-DPI-2 (`docs/ai/USER_DECISIONS.md`) and, in doing so, finally closes D-DPI-1 / B-116.** Read both decisions before anything else.

**This is the highest-risk brief of the phase.** Not because the code is hard — because **the failure mode is silently undercharging a real taxpayer's health contribution.** Read §1 twice.

---

## 1. The one sentence that governs everything

**`declared none` and `not asked yet` must be different stored facts, forever.**

If they ever collapse — through a default, an optional field, a `?? 0`, a zod default, a `Number(x) || 0`, or a UI that submits an untouched control as „nu am avut" — **the app treats silence as „no other income" and undercharges CASS.** That is precisely the failure `calcCassLadder`'s refusal was built to prevent.

**We are not removing the refusal. We are narrowing its trigger** from *„not all six are numbers"* to *„not all six are answered."*

**Acceptance requires proving the collapse is impossible, not asserting it is absent.** §6 lists the tests that do that.

---

## 2. What D-DPI-2 chose

The art. 170 alin. (4) ladder needs six categories. Today `calcCassLadder` refuses unless all six are numbers, and only the hand-typed `CassLadderYear.proprietateIntelectuala` net can supply them.

**New rule: the ladder proceeds when every category is either a number or an explicit declared-absence. It still refuses when a category is unknown.**

Per category, exactly three states, and **all three must be representable in the persisted payload**:

| State | Meaning |
|---|---|
| `amount` | the person stated a figure |
| `none` | the person was asked and said **nu am avut** |
| `unknown` | nobody has asked, or they declined to say |

**`unknown` is the only state that blocks the ladder.** `none` unblocks it, and `none` must be a fact the person asserted — never a fallback.

---

## 3. Where the six categories come from

**Do not invent six new input boxes in a vacuum.** §12.18 — the corpus already resolves most of this:

- **DPI (art. 170 alin. (4) lit. a))** — **already computed.** Brief 72 gave `calcDpiFlatQuota` its call site at `tax.ts:925`. **This is the category that stops needing a typed number.**
- The remaining five — the definitions and the chapeau are in **`research/41` §1–§2**, and the DPI correction in **`research/48` §5**. **Quote from those files; do not paraphrase the statute.**
- **B-122 already recorded that two of the three CASS withholding sources are not modelled** (art. 174¹ alin. (3): DPI, *arendă*, *asocieri cu persoane juridice*). **Check that row before designing the questions** — the same six categories appear in two places, and building a second vocabulary for them is how this app acquires its contradictions.

**The questions must be asked in the person's words, not the statute's.** Art. 155 alin. (1) lit. c)–h) are not something a person recognises. Brief 75 established the pattern: **article plus quoted text for the citation, plain Romanian for the question.**

---

## 4. Chain step v26

**Append v26. Do not touch v22–v25.** Brief 76 established the ordering discipline and the reason for each rung; **B-116's row already notes it owes v26, not v23.**

**Read-wide, write-narrow, and mind the trap brief 76 named: zod strips undeclared keys.** Declare the new field in the load gate **before** the step that reads it, and pin that with a test. An undeclared tri-state field silently becomes `unknown` for every existing payload — which is *safe* here, but only by accident, and an accident that reads as a passing test.

**Existing payloads have never been asked these questions, so every existing payload must migrate to `unknown`, not to `none`.** A step that defaults them to `none` would take a user who has never seen the screen and silently assert they have no other income. **That is the single most dangerous line you could write in this brief, and it will look like a reasonable default.**

---

## 5. Retiring the typed net — the point of all this

Once DPI is computed and the other five are explicit, the set is complete and **`CassLadderYear.proprietateIntelectuala` can be retired.** That closes **B-116 / D-DPI-1**, which has been open since 2026-10-15.

**Sequence it, and do not collapse it:**

1. Land the tri-state and the narrowed ladder. **The typed net still works.**
2. Land the questions.
3. **Only then** retire the typed net, with its own chain step if a key must be dropped — and **the load gate widened first**, exactly as v22 did.

**If you cannot finish all three, stop after the step you have completed and report.** A half-retired typed net is worse than no retirement: the double representation would still exist while the guard that made it safe had been loosened.

**The `dpiRecordConflict` gate from B-149 is load-bearing until step 3 lands.** Do not remove it early.

---

## 6. Proof required — the collapse tests

**These are not optional colour. They are the acceptance criteria that matter most.**

1. **A payload with the new field absent migrates to `unknown`, and the ladder refuses.** Not to `none`.
2. **A payload with an explicitly `none` category lets the ladder proceed**, and the resulting CASS figure is asserted.
3. **A payload with one `unknown` and five answered still refuses**, and says which category is missing.
4. **No `?? 0`, no `|| 0`, no zod default, no optional-number coercion** anywhere on the path from payload to `calcCassLadder`. **Grep your own diff for these and report what you found.**
5. **The UI cannot submit an untouched control as `none`.** Prove it with a test that renders the question and asserts the stored state is `unknown` until a human chooses.
6. **The computed DPI amount and a previously typed net disagreeing still trips `dpiRecordConflict`** until step 3 lands.

---

## 7. Boundaries

- **Chain head is v25.** Append v26 (and v27 only if retiring the typed net needs a key dropped).
- **The 311.200-lei seed pin at `src/data/seed.identityHygiene.test.ts:339` and every persona hero must not move** unless a figure genuinely changes — then report old → new → reason **before** re-pinning. **A CASS figure moving is expected if a persona gains answered categories; a figure moving because a category defaulted to `none` is the bug.**
- **Do not touch `src/domain/fx/**`, `caen_rev3.csv`, or the rule package digests.**
- **B-153 stays open. Do not fix it in passing.**
- **B-151's six unreachable `calculatorId`s are not in scope** unless one of them is one of the five categories — if it is, report that rather than silently wiring it.

---

## 8. Acceptance criteria

1. `npx tsc --noEmit` → 0. `npm run build` → 0. Both gates → all pass, **once each, backgrounded**, using the **capped defaults**.
2. **All six §6 collapse tests exist and pass.** Name each one in the handoff.
3. **Chain head stated**, with the ordering reason for v26 (and v27 if added).
4. **Every existing payload migrates to `unknown`** — asserted against a real v25 payload, not the current schema.
5. **The five questions, in plain Romanian, each citing its article and quoted text from `research/41` or `research/48`** — list the file for each.
6. **The typed net's status stated**: retired, or not, and why.
7. **Your own diff grepped for `?? 0`, `|| 0`, `|| 0.0`, zod `.default(`, and `Number(`** on the CASS path, with results reported.
8. **Newly measured** unit and e2e counts.

---

## 9. Checkpoint discipline

**Commit after each of the three sequenced steps in §5, by name.** This engine has SIGKILLed four Workers this cycle, and every loss was exactly the uncommitted work. **A crash between step 1 and step 3 must leave the tree in a state where the typed net still works and the guard is still up** — that is what makes the commits the right boundaries.
