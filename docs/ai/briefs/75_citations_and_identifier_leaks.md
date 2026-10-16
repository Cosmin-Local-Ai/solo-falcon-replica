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

**§12.18 — search `docs/ai/research/` before you re-derive a fact.** Cite the file; do not re-litigate a settled correction.

**§12.19 — when you close a register row, rewrite its first sentence.** A refuted claim left as the headline booby-traps the next briefing pass. B-65 cost a whole phase this way.

---

# Brief 75 — citations that survive a letter shifting, and six places where the app reads a code to a person

**B-120 and B-142.** Both are the same underlying problem: **the app shows an internal identifier where it should show the law, or shows a locator as if it were the identity.**

---

## B-120 — cite by article and quoted text, not by letter

**Decision already taken — D-CITE-1 in `docs/ai/USER_DECISIONS.md`. You are implementing a settled decision.**

Article-letter instability across consolidations is inside the rule package. The same provision can appear as one letter in one consolidation and another in the next. Concretely in this repo: the DPI rule cites **art. 170 alin. (4) lit. a)** while `CASS_LADDER_CATEGORY_NAMES` cites **art. 155 alin. (1) lit. c)**; and the register already carries an **art. 154 alin. (1) lit. h) vs h¹)** dispute.

**Chosen: prefer the article number plus the quoted statutory text over the letter.** A shifted letter must not break a citation. Where a sub-letter is genuinely load-bearing — the art. 68 alin. (5) lit. g) ceilings, for example — **the quoted text carries the meaning and the letter becomes a locator, not the identity.**

**Tests already assert operative content rather than the letter, which is correct.** The exposure is **user-facing citation text.**

**Three cautions:**

1. **Do not delete the letter.** It is how a reader finds the provision. The change is that the letter stops being what makes the citation true.
2. **A quoted text must be a quote you have actually read.** §12.18: the corpus holds most of these verbatim already. **If a provision's text is not in `docs/ai/research/`, do not paraphrase it into a citation — report it.** Inventing statutory wording is the one error in this class that cannot be walked back.
3. **The rule package's governance is „the rule set grows, never a rule changes", enforced by a per-rule digest.** Brief 73 hit this and worked around it by keeping a change in copy rather than a rule parameter. **Check whether your citation change moves a digest, and if it does, report it rather than re-pinning silently.**

---

## B-142 — six identifier leaks the widened guard found and its own brief was told not to fix

`src/domain/regimes.ts:91`, `:99`, `:104` quote a **regime code** at a person. **`PFA_REGIME_DESCRIPTORS[regime].label` already exists, in Romanian, and is unused in those very sentences.** `src/ui/copy/onboarding.ts:157` does the same. `src/domain/estimateBasis.ts:1803` quotes a rule-package treatment code. The migration summaries quote storage keys (`„declarations"`, `„inregistrata"`, `„pensionerStatus"`).

**The migration-summary sites are NOT leaks.** There the key is genuinely the **subject** of the sentence — the app is talking *about* the stored field. They carry named exemptions, and **a guard test fails if an exemption outlives its site.** Re-check each and let some stay.

**The regime trio is the strongest identifier leak in the corpus** and the fix is nearly free: the correct Romanian label is sitting in a map one line away.

**But it re-pins four wording tests deliberately.** B-9 and B-14 pin the refusal text, and brief 67 §4 kept the regime vocabulary out of scope. **Those tests were written against what the code said, not against what the person should read.** Re-pin them with the new wording and say plainly that you did — this is the B-99/B-101/B-138 pattern the register already documents, and the honest way through it is to name the re-pin, not to hide it.

---

## Boundaries

- **No persisted-shape changes. Chain head stays v21.**
- **Do not touch `src/domain/fx/**`, `tax.ts`'s DPI wiring, `caen_rev3.csv`, or persona figures.** Report any figure movement with old → new → reason.
- **Do not widen the B-139 guard's exemption lists** to make a site pass. Brief 73 refused to do exactly that and fixed the sentence instead. **Follow that precedent.**
- The 311.200-lei seed pin at `src/data/seed.identityHygiene.test.ts:339`: if it moves, report before touching.

---

## Acceptance criteria

1. `npx tsc --noEmit` → 0. `npm run build` → 0. Both capped gates → all pass, **once each, backgrounded to a log**.
2. **B-120:** user-facing citations carry the article and the quoted text; the letter remains as a locator. **Every quoted text traces to a file in `docs/ai/research/`** — list the file for each.
3. **B-142:** the three regime sentences and the onboarding sentence show the Romanian label; the `estimateBasis` treatment code stops being quoted at a person.
4. **The migration-summary exemptions are re-checked and the result reported**, whether they stay or go.
5. **Every re-pinned wording test named as a re-pin**, with what it asserted before and after.
6. **Any rule-package digest movement reported, not silently re-pinned.**
7. Report **newly measured** unit and e2e counts.

---

## Register hygiene, since you are editing the register anyway

Brief 74 found that **B-65's row still led with a claim refuted three days earlier**, and that the row **directly above it** carried the closure. §12.19 is now in the contract. **If you close a row, rewrite its first sentence.**
