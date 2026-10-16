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

**§12.17 / §12.20 — the gates.** `npm run test` and `npm run test:e2e` are the **capped** forms and are the only ones you may use; `test:uncapped` and `test:e2e:uncapped` exist and **you must not run them.** Background each to a log, one at a time, read the log once, never re-run.

**§12.21 — quote each gate log's verbatim summary line**, failure counts included.

**§12.18 — search `docs/ai/research/` before you re-derive a fact.** **§12.19 — when you close a register row, rewrite its first sentence.**

**§12.22 — the `### 4a` roll-up is generated.** After any register row edit run `python3 docs/ai/tools/register_rollup.py` and commit its output. **Never hand-edit the table.**

**Register convention:** rows open their `Defect` cell with a status token — `[OPEN]`, `[CLOSED 2026-MM-DD]`, `[BLOCKED: research]`, `[BLOCKED: decision]`, `[BLOCKED: chain]`, `[PARKED]`, `[REFUTED]` — and non-open ids are `~~**B-nn**~~`.

---

# Brief 82 — Phase 12C: the dates that decide which fiscal year a record belongs to

**B-38. This is the only genuinely unstarted phase in the 12–15 band, and it is the last thing standing between the plan and a releasable 12–15.**

**The user's instruction is to finish 12–15 so the app can go to audit.** This brief is step one of that. **Do not start 13, 14 or 15 — a later brief gates them.**

---

## 1. The defect, in one sentence

**Payment and collection dates are modelled but cannot be entered**, so a document issued in Decembrie and paid in Ianuarie is attributed to the wrong fiscal year.

`paid?` and `collected?` exist on the record. **There is no way for a person to tell the app when the money actually moved.**

**Why this is not cosmetic:** cash-basis measurement is what most of this app rests on. Art. 68 alin. (2) lit. a) measures *„sumele încasate"*; art. 68 alin. (4) lit. b) assigns a cost to the year it was **paid**. **A record in the wrong year is not a slightly wrong number — it is a different tax year's return.**

---

## 2. What to build

**Enterable dates on revenue and expense records, with honest defaults.**

- A revenue record needs **when it was collected**. An expense record needs **when it was paid**.
- **A default is allowed, but it must be visible and it must be labelled as a default.** If the app assumes „paid on the invoice date" when nobody said so, the screen has to say that it assumed it, and the person has to be able to correct it. **An invisible default is how B-38 survives a fix.**
- **Fixed assets already have `paidOn` and a `paymentState`** (`Assets.tsx:107`, `:148`). **Do not invent a second vocabulary for the same fact.** Reuse the existing shape and naming unless there is a real reason not to, and say the reason if there is.

**Check before you design (§12.18):** `research/26_midyear_start_partial_year_2026.md` and `research/27_norme_metodologice_prorating_2026.md` cover the attribution question, and **PG-2 already closed the UTC/local-date defaults (B-46)** — `localDateISO()` is in place. **You are not re-doing B-46. You are making the date enterable, which B-46 assumed existed.**

---

## 3. The chain step, and a collision you must know about

**If a new persisted field is needed, this brief owes a chain step — and v27 is contested.**

**Brief 76 established the discipline: append only, never renumber, and read-wide/write-narrow.** Declare any new field in the load gate **before** the step that reads it, because **zod strips undeclared keys** — an undeclared date silently reverts to the default and the fix disappears without a test failing.

**Two briefs currently want v27:** this one, and **DPI step 3** (retiring the typed net, B-116/B-152). **Whoever lands first takes v27; the other takes v28.** **Do not assume a number — read `CURRENT_DATA_VERSION` when you write the step, and state in your handoff which number you took and why.** A collision resolved silently is a chain that skips a rung.

**And test the step against a real pre-step payload** — the house pattern in `src/data/stored-status.transmisa.test.ts`. Load an older payload, run the chain, assert what was kept, what was added, and that nothing else was lost.

---

## 4. What must not change

- **The 311.200-lei seed pin at `src/data/seed.identityHygiene.test.ts:339` and every persona hero.** **This is the brief most likely to move them legitimately** — if a seed record's attribution year changes, a total changes, and that is the fix working. **For every moved figure: old → new → reason, with the arithmetic, reported BEFORE re-pinning.** If a figure moves for a record whose dates were never touched, that is a regression — stop and report.
- **Do not touch `src/domain/fx/**`, `caen_rev3.csv`, or the rule package digests.**
- **Do not change any calculator.** This is data entry and attribution, not arithmetic. If you believe a calculator must change, **stop and report.**

---

## 5. Acceptance criteria

1. `npx tsc --noEmit` → 0. `npm run build` → 0. Both gates → all pass, **once each, backgrounded**, capped forms, **logs quoted verbatim**.
2. **A person can enter, on a revenue and on an expense record, when the money moved** — and an e2e proves it reaches the estimate, not just the form.
3. **The December-invoice-paid-in-January case is pinned by a test** that shows the record landing in the correct year, and shows it landing in the wrong year before.
4. **Every default is visible on screen and labelled as a default.** Show the copy.
5. **Any chain step is appended, tested against a real pre-step payload, and its number stated with the reason.**
6. **Every moved figure: old → new → reason.** The 311.200 pin's status stated.
7. **B-38 closed with its first sentence rewritten** (§12.19), roll-up regenerated by the script (§12.22) and its stdout pasted.
8. **Newly measured** unit and e2e counts.

---

## 6. If it is bigger than it looks

**Stop and report rather than half-finishing it.** A half-entered date field is worse than none: the app would have a persisted fact that some paths read and others ignore, which is exactly the class of defect the audit keeps finding. **Land the entry, the attribution and the test, or report where it stopped.**

**Commit as you go, by name.** This engine has SIGKILLed eight Workers this cycle and every loss was exactly the uncommitted work.
