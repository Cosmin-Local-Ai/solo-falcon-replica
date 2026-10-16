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

**§12.17 / §12.20 — the gates.** `npm run test` and `npm run test:e2e` are now the **capped** forms and are the only ones you may use; `test:uncapped` and `test:e2e:uncapped` exist and **you must not run them.** Background each to a log, one at a time, read the log once, never re-run.

**§12.21 — a gate report must quote the log's own summary line**, failure counts included, verbatim. A quoted line can be checked against a file; a remembered count cannot. Brief 76 reported „222 passed" and one of those tests was red.

**§12.18 — search `docs/ai/research/` before you re-derive a fact.**

**§12.19 — when you close a register row, rewrite its first sentence.**

---

# Brief 79 — make the defect register answer a question

**Documentation only. Touch no source file.** This brief exists because the register — the plan's memory — **can no longer be queried reliably, and that has already cost this project work.**

---

## 1. The measured problem

`docs/ai/PHASE_PLAN_11_34.md` is 843 lines and carries **85 defect ids, each appearing exactly once**, in two tables:

| Section | Rows |
|---|---|
| `## 4. New defect ids` | 15 |
| `### Already open in STATE.md — carried forward, not re-minted` | 70 |

**No id is duplicated.** The problem is not redundancy. It is this:

**There is no status column.** The table is `| Id | Defect | Closed by |`, and **status lives inside the prose of the `Defect` cell** — usually in its first sentence, sometimes appended below the original claim.

**There was a convention and it drifted.** Older closures read `~~**B-36**~~` — id struck through — with the cell opening `**CLOSED by Phase 10c (2026-10-10).**` **Newer closures do not strike the id at all**: B-140, B-108 and B-145 are closed and still render as live `| **B-140** |`.

**Consequence, measured this session:** an attempt to tally open vs closed from the register returned **75 open**, then **37 open**, and both were wrong. **The Orchestrator re-deriving the plan's own state from prose is exactly the failure §12.19 was written about** — B-65 was briefed as a missing rule because its *headline* still asserted a claim refuted three days earlier, and the correction sat below it where a briefing pass does not read.

**A plan whose current state must be re-derived is a plan that will be misread.**

---

## 2. What to do

### 2a. Make status structural, not prose

**Add an explicit status marker to every one of the 85 rows**, and make it machine-findable. Two parts, both required:

- **Strike the id for anything not open** — `~~**B-36**~~` — restoring the existing convention and applying it uniformly, including to B-140, B-108, B-145 and every other recent closure.
- **Open the `Defect` cell with a bracketed status token** in a fixed vocabulary, so a grep can count:

`[OPEN]` · `[CLOSED 2026-MM-DD]` · `[BLOCKED: research]` · `[BLOCKED: decision]` · `[BLOCKED: chain]` · `[PARKED]` · `[REFUTED]`

**`[BLOCKED: …]` is the most valuable token and the one most likely to be missing today.** A row that is open *because it waits on a Researcher* is a different row from one that is open because nobody has claimed it, and the register currently cannot tell them apart. **B-152 sat in exactly that ambiguity for a day** while it waited on a user decision.

### 2b. Add a roll-up near the top

Immediately after `## 4. New defect ids`'s intro — or as a new `## 4a`, your call — add a **roll-up the briefing pass reads first**:

- **Counts by status token.**
- **The open list, grouped by what unblocks it**: needs a Researcher · needs a user decision · needs a chain step · free to brief now.
- **The ids closed in the last two weeks**, with date and brief, so a briefing pass can see recent ground truth without reading 85 rows.

**Keep it short enough to read in one screen.** A roll-up that is itself 200 lines has not solved anything; it has added a second place to be stale.

### 2c. Fix the headlines you find

While you are in each row, apply §12.19: **if a row's first sentence asserts something no longer true, rewrite that sentence.** B-65 was fixed this way already; **find the others.** Report how many you changed and list them.

---

## 3. What you must NOT do

- **Do not delete, merge, shorten or paraphrase any row's substance.** This is a re-indexing, not an edit. **Every fact in every row must survive**, including the parts that are now wrong but are kept as evidence — B-65's struck-through claim stays precisely because it documents how a stale headline propagates.
- **Do not decide whether any defect is closed.** If a row's status is genuinely ambiguous, **mark it `[OPEN]` and report it in your handoff as ambiguous.** Getting a status wrong in the tidy direction is worse than leaving it visibly uncertain — that is how B-65 happened.
- **Do not renumber, reassign or invent ids.**
- **Do not touch any file other than `docs/ai/PHASE_PLAN_11_34.md`** — and do not touch the `## 0`–`## 3` sections, the phase-detail sections, or the standing rules §12.x. **Rows only, plus the new roll-up.**
- **Do not touch `docs/ai/STATE.md`** unless the roll-up needs a pointer to it.

---

## 4. Proof

**The acceptance test is that a stranger can count the register without reading it.** Run these and report the output verbatim:

```
grep -c '^| \*\*B-' docs/ai/PHASE_PLAN_11_34.md
grep -c '^| ~~\*\*B-' docs/ai/PHASE_PLAN_11_34.md
grep -c '\[OPEN\]' docs/ai/PHASE_PLAN_11_34.md
grep -c '\[CLOSED' docs/ai/PHASE_PLAN_11_34.md
grep -c '\[BLOCKED' docs/ai/PHASE_PLAN_11_34.md
```

**The counts must be internally consistent**: open + closed + blocked + parked + refuted must equal the total row count, and the roll-up must agree with the greps. **If they disagree, the job is not done.**

**And prove nothing was lost:** before you start, save a copy of the file; after, diff the row count and the total character count of the `Defect` cells, and report both. **A drop in total row-cell characters needs an explanation per row.**

---

## 5. Acceptance criteria

1. **All 85 rows carry a status token and the correct id strike-through.**
2. **The greps in §4 are reported verbatim and are internally consistent.**
3. **The roll-up exists**, fits one screen, and agrees with the greps.
4. **Headline fixes counted and listed** (§12.19).
5. **No substance lost** — row count and cell-character accounting reported.
6. **Ambiguous rows listed rather than guessed**, with what makes them ambiguous.
7. **`npx tsc --noEmit` and `npm run build` still 0** — you touched no source, so they must be, and saying so proves the tree is unchanged.
8. **§12.21: quote both gate logs' summary lines verbatim.**

---

## 6. Checkpoint discipline

**Commit in three stages, by name:** (1) status tokens, (2) roll-up, (3) headline fixes. This engine has SIGKILLed five Workers this cycle and every loss was exactly the uncommitted work. **A crash must leave the register more consistent than it found it, never half-marked.**
