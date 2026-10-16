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

**Register convention (since brief 79):** rows open their `Defect` cell with a status token — `[OPEN]`, `[CLOSED 2026-MM-DD]`, `[BLOCKED: research]`, `[BLOCKED: decision]`, `[BLOCKED: chain]`, `[PARKED]`, `[REFUTED]` — and non-open ids are `~~**B-nn**~~`.

---

# Brief 81 — four small honesty fixes, bundled

**B-154, B-155 (re-scoped), B-158, and one housekeeping item.** All four are low-risk, none touches persisted shape, and three of them are the same failure: **the app computed something and did not say.**

They are bundled deliberately. **Work them in the order below and commit each separately** — a crash between items must leave every completed item complete.

---

## 1. B-154 — a declared carried-in loss that is silently discarded

**A carried-in fiscal loss on a flat-ratio-only register is neither applied nor refused — it is silently ignored.** Persona 6 holds `priorYearFiscalLosses` and produces **no art. 118 row at all**: no offset, no refusal, no explanation.

**This is the worst shape a field can have.** The person stated a fact and the app threw it away without a word. **A field that accepts an input and does nothing with it is worse than a field that refuses it**, because the person has no way to know the answer didn't count.

**Decide which of the two it is — applied, or refused with a reason — and implement that.** Do not leave the third state.

**Check the corpus before deciding (§12.18):** `research/52` settled art. 118 alin. (4)–(5) — **5 ani fiscali, 70 % of the net of that same source, per source, chronological by age, not elective** — and brief 70 asserted it twelve ways. The question here is narrower: **does art. 118 reach income measured by a flat ratio at all, or only net income?** If the corpus answers it, cite the file. **If it does not, stop and report — that is a Researcher question, not a guess.**

**Whichever way it goes, the person must see it.** Either the loss offsets, or a row says why it cannot.

---

## 2. B-155 — re-scoped: the conflict wording ignores the scope it was given

Brief 77 minted this as two halves. **Brief 80 already fixed the first half** (the second disposal ceiling never reaching the asset card) as a side effect of the B-156 proceeds row. **Do not re-fix it; the row must be re-scoped, not silently closed.**

**What remains:** the asset card's conflict sentence **ignores `ConflictScope` and always reads register-wide.** `ConflictScope = 'asset' | 'register'` exists in `depreciation.ts`, and `estimateBasis` produces two scope-specific sentences — **but the card never consults the scope.** Harmless for a one-asset register, **wrong for any register with two assets**, where it tells the person that unrelated assets are affected when they are not.

**Fix: render the scope-specific sentence.** Assert both branches on a register with **two** assets — one narrowed, one register-wide — so the difference is actually proven rather than assumed.

---

## 3. B-158 — the unverified citation marker is still on three sites

B-157 correctly swept `pct. 7 alin. (5) lit. o)`. **But `pct. 7 alin. (5)` still appears at `src/data/dashboard.test.ts:369`, `src/data/seed.ts:241` and `src/domain/fiscal/deductibility2026.ts:217`** — for the postal/telecom line and for the illustrative list as a whole.

**`research/55` §3 could not confirm the alineat marker for that list at all.** The doubt is about **the list**, not about one letter. **Leaving the marker on three sites and off the others is not a defensible position** — it implies a verification we never did.

**Two acceptable outcomes, and one unacceptable one:**
- **Drop the alineat from every pct. 7 citation**, keeping letter + quoted text (D-CITE-1: the text carries the meaning, the locator is secondary). **This is the default.**
- **Or** verify it once from a primary source and keep it everywhere — **but only with the source named.**
- **Unacceptable:** inventing the marker, or copying it from a commercial restatement.

---

## 4. Housekeeping — make the register roll-up generated, not hand-maintained

**Measured this cycle:** brief 79 built a roll-up table by hand. **Within one day it was stale by two rows** — brief 80 found the table said 34/85/131 while the greps said 36/85/133, because B-156 and B-157 were minted open and never counted.

**That is the same failure §12.19 was written about, one level up: a hand-maintained derived table is just a new place to be stale.**

**Write a small script** — `docs/ai/tools/register_rollup.py` or equivalent — that reads the register, counts the status tokens, and **regenerates the `### 4a` roll-up in place.** Requirements:

- **Idempotent:** running it twice produces the same file.
- **It must not count its own output.** Brief 79 handled this by having the roll-up spell no bracketed token literally; keep that property or make the script exclude the roll-up section from its own counts.
- **Print the counts to stdout** so a Worker can paste them into a handoff per §12.21.
- **Fail loudly if the token sum ≠ the row count** — that disagreement is the whole point.
- **No dependencies.** Standard library only.

**Then run it, commit the regenerated roll-up, and note in §12.21 or the register's own header that the roll-up is generated** so nobody hand-edits it again.

---

## 5. Boundaries

- **No persisted-shape changes. Chain head stays v26.**
- **Do not touch `src/domain/fx/**`, `caen_rev3.csv`, the rule package or its digests.**
- **The 311.200-lei seed pin at `src/data/seed.identityHygiene.test.ts:339` and every persona hero must not move.** B-154 could move persona 6's figures **if the loss turns out to apply** — if so, report old → new → reason **before** re-pinning, and note that persona 6's header currently asserts it holds no loss.
- **Do not re-fix what brief 80 already fixed.** Re-scope B-155's row instead.
- **Do not encode art. 28 alin. (12) lit. i^1)** — separate decision, see `research/55` §1.

---

## 6. Acceptance criteria

1. `npx tsc --noEmit` → 0. `npm run build` → 0. Both gates → all pass, **once each, backgrounded**, capped forms only, **logs quoted verbatim**.
2. **B-154:** the silent third state is gone — applied, or refused with a visible reason. **The corpus citation, or a report that the corpus doesn't answer it.**
3. **B-155:** both scope branches asserted **on a two-asset register**, and the row re-scoped rather than closed whole.
4. **B-158:** no unverified marker remains anywhere, or every remaining one names a primary source.
5. **The roll-up script exists, is idempotent, fails on a token/row mismatch, and has been run** — with its stdout pasted.
6. **Register rows updated with first sentences rewritten** (§12.19) and tokens applied.
7. **Newly measured** unit and e2e counts.

---

## 7. Checkpoint discipline

**One commit per item, by name.** This engine has SIGKILLed seven Workers this cycle and every loss was exactly the uncommitted work. **These four items are independent — a crash should cost at most the item in flight, never the three already done.**
