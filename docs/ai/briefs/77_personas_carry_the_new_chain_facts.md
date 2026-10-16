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

**§12.20 — these are now the default `npm run test` / `npm run test:e2e` scripts.** The uncapped forms exist as `test:uncapped` and `test:e2e:uncapped` and **you must not use them.** Brief 76 ran the uncapped forms and reported it; that is why the defaults changed.

**Neither gate may be a bare foreground command — a multi-minute foreground call kills your own connection.** Run each in the background to a log, then read the log once:

```
npm run test > /tmp/unit.log 2>&1 &
tail -n 30 /tmp/unit.log
```

Same shape for `npm run test:e2e > /tmp/e2e.log 2>&1 &`. **One gate at a time.** If the log is incomplete, wait once and re-read — never re-run the suite, never start the second gate while the first is writing.

**§12.18 — search `docs/ai/research/` before you re-derive a fact.** Cite the file; do not re-litigate a settled correction.

**§12.19 — when you close a register row, rewrite its first sentence.** A refuted claim left as the headline booby-traps the next briefing pass.

---

# Brief 77 — make the four new chain facts visible in the app

**User decision, 2026-10-16: extend existing personas rather than add new ones.**

Brief 76 shipped v22–v25 and reported the gap honestly: **the four chain steps are not exercised in a browser.** Unit tests went 3 077 → 3 131 while **e2e stayed at 222**, because no seed asset carries `disposedOn`, no seed expense carries `assetId`, and no seed profile carries a carried-in loss. **Four shipped migrations currently have no browser proof.**

**This brief closes that gap. It is a data brief, not a rule brief.** Do not change any rule, calculator, migration step or schema.

---

## What to add, and where

| Fact | Suggested persona | Why that one |
|---|---|---|
| `FixedAsset.disposalProceeds` + `disposedOn` | **persona 3 (driver)** | Already carries an M1 vehicle and the 42.390,00 RON hero. A disposal is the natural next event for a driver's car. |
| `Expense.assetId` | **persona 12 (physiotherapist)** | Already has both a register and hand-recorded expenses, so a link is a fact it can honestly state. |
| `profile.priorYearFiscalLosses` | **persona 6 (investor)** | Already the dividends/CASS persona, and already the one whose citations brief 75 corrected. |

**These are suggestions, not instructions.** If a different persona is the honest home for a fact, use it and **say why you moved it.** The test is: **would this persona plausibly have this fact, given everything else already declared about them?** A persona that gains an implausible fact is worse than an unexercised migration.

---

## The three things that will bite

1. **Extending personas moves figures, and persona heroes are pinned.** `e2e/persona-*.spec.ts` asserts visible totals — persona 3's **42.390,00 RON** is one of them. **A disposal, a linked expense and a carried-in loss can all move a total.** For every figure that moves, report **old → new → the reason**, **before** you re-pin. **Do not re-pin first and explain later.**
2. **The 311.200-lei seed pin at `src/data/seed.identityHygiene.test.ts:339` is the one to be most careful with.** If it moves, **stop and report rather than re-pinning.** A seed total moving because a persona gained a plausible fact is fine; a seed total moving because a rule started firing differently is a regression wearing a costume.
3. **A carried-in loss reduces a later year's tax.** That is its whole point. So persona 6's figures **will** move, and the movement is the proof the feature works. **Show the arithmetic** — what the loss was, which year it offsets, the 70 % ceiling applied, and the resulting difference. A moved total with no arithmetic beside it is not evidence.

---

## What "exercised" has to mean

Adding data that no screen renders proves nothing. **Each of the three facts must be visible somewhere a browser can reach it**, and the e2e must assert the visible thing:

- the disposal ceiling and the proceeds cap, on the assets screen;
- the narrowed conflict for a linked expense, on the expenses screen — **and the register-wide wording still appearing for an expense that is *not* linked**, so both branches are proven;
- the carried-in loss entry and its effect, on the Settings screen and in the estimate.

**That last pair matters: prove the negative too.** An unlinked expense must still say the conflict is register-wide. If both branches are asserted, the feature is proven; if only the happy path is, the e2e is decoration.

---

## Boundaries

- **No rule, calculator, migration step or schema changes.** If you believe one is needed, **stop and report** — that is a different brief.
- **B-153 is still open and you must not fix it in passing.** The schedule still amortises past the disposal month while `disposalFigure` counts only the months used. **If a persona disposal makes that disagreement visible on screen, that is a finding to report, not a thing to smooth over.** It may be the first time a user can see it.
- **Do not touch `src/domain/fx/**`, `caen_rev3.csv`, or the rule package and its digests.**
- **Chain head is v25. It stays v25.**

---

## Acceptance criteria

1. `npx tsc --noEmit` → 0. `npm run build` → 0. Both gates → all pass, **once each, backgrounded to a log**, using the **capped defaults** from §12.20.
2. **e2e count rises.** Report the new count and name each new spec.
3. **Every moved figure: old → new → reason**, with the arithmetic for the carried-in loss.
4. **Both branches asserted** for the expense link: linked narrows, unlinked stays register-wide.
5. **The 311.200-lei pin's status stated** — moved or untouched.
6. **B-153's visibility stated**: can a user now see the two month counts disagree?
7. Report **newly measured** unit and e2e counts.

---

## Checkpoint discipline

**Commit after each persona, by name.** Three personas, three commits minimum. This engine has SIGKILLed four Workers this cycle and every single time the loss was exactly the uncommitted work.
