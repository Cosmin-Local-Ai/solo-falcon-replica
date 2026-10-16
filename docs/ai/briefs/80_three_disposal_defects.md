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

**§12.21 — quote each gate log's verbatim summary line**, failure counts included. Brief 76 reported „222 passed" and one of those tests was red.

**§12.18 — search `docs/ai/research/` before you re-derive a fact.** **§12.19 — when you close a register row, rewrite its first sentence.**

**Register convention (new since brief 79):** every row opens its `Defect` cell with a status token — `[OPEN]`, `[CLOSED 2026-MM-DD]`, `[BLOCKED: research]`, `[BLOCKED: decision]`, `[BLOCKED: chain]`, `[PARKED]`, `[REFUTED]` — and non-open ids are struck through as `~~**B-nn**~~`. **Follow it, and re-count the roll-up by grep when you close anything.**

---

# Brief 80 — three disposal defects from one piece of research

**B-153, B-156, B-157.** All three came out of **`docs/ai/research/55_art28i1_and_the_missing_stop_rule.md`**, all three live in `src/domain/fiscal/depreciation.ts`, and **B-153 and B-156 are the same rule read twice.** That is why they are one brief.

**Read `research/55` and `docs/ai/USER_DECISIONS.md` → D-DEPR-1 before touching anything.**

---

## 1. B-153 — the schedule must stop in the disposal month

**D-DEPR-1 is decided: depreciation stops in the month the asset leaves the register.** An asset disposed on 20 Octombrie 2026 charges **through Octombrie** and no further.

**The constraint that is NOT a choice, and is the actual defect:** pct. 7 lit. o) defines the disposal residual by *„amortizarea inclusă pe costuri în cursul exploatării"*, and art. 28 alin. (17) computes the disposal result on *„amortizarea fiscală"* actually taken. **The schedule and the disposal figure must use one month count.** Today they use two — the 2026 schedule row charges 12 months while `disposal.remainingMonths` counts 38 of 48. **Two counts on the same asset is indefensible under any reading, including the one we did not pick.**

**Label the truncation as a reading, in the code and on screen.** `research/55` §4 established that **no stop rule exists anywhere**: art. 28 alin. (12) lit. a)–n) never address *vânzare* or *scoatere din evidență*; Titlul II norms pct. 25–31 contain none; OMFP 170/2015 contains none. **The rejected alternative — stopping the month after — argues from symmetry with the explicit start rule at art. 28 alin. (12) lit. a), and that argument must be recorded rather than hidden.** A reading presented as a rule is how this project gets a citation it cannot defend.

**Do not invent a "last year takes the remainder" rule.** `research/55` confirms art. 28 alin. (6) (liniară) has **no remainder clause**; the remainder mechanics are method-specific (alin. (8) lit. b) accelerată, alin. (8^1)–(8^3) super-accelerată). The existing last-year convention at `depreciation.ts:595` is an arithmetic absorption of rounding and is **already labelled as unstated at `:607`** — leave it labelled.

---

## 2. B-156 — pct. 27 covers M1 vehicles only, and we apply it to everything

`disposalFigure` is called whenever `disposedOn` is set (`depreciation.ts:662-664`) and is **not gated on `isM1Vehicle`**. Titlul II norm pct. 27 is expressly *„la momentul scăderii din gestiune a **mijloacelor de transport din categoria M1**"* and is keyed to art. 28 alin. (14).

**So a disposed laptop or electrotherapy apparatus currently carries an M1 disposal ceiling.** And because pct. 27 is a **deductibility limit on the residual**, applying it where it does not belong **understates a deduction the taxpayer is entitled to** — this is not a conservative error, it costs the person money.

**Gate it on `isM1Vehicle`.** `isM1Vehicle` is declared, never inferred (`depreciation.ts:232`) — keep it that way. **A non-M1 disposed asset still has a residual, and it is still capped — by pct. 7 lit. o), at the disposal proceeds.** So this is not "remove the cap"; it is "apply the right cap to the right asset". **Prove both: an M1 disposal gets the pct. 27 limit, a non-M1 disposal gets the proceeds limit and no M1 figure.**

**And fix the corpus note, not just the code.** The code already cites pct. 27 correctly as a **Titlul II** norm at `:215`; the sloppy Titlul IV labelling is in the notes. §12.19.

---

## 3. B-157 — we print a citation whose alineat we never verified

We cite **pct. 7 alin. (5) lit. o)**. `research/55` §3 confirmed **the letter (o) and the verbatim text** in the 2026-updated Titlul IV norms, and **could not confirm the alineat number** — the free extract doesn't render the marker and the Portal Legislativ consolidated norms (~5 MB) wouldn't fetch whole.

**D-CITE-1 is the answer, and it is already the house rule: the quoted text carries the meaning and the locator is secondary.** So the fix is to **drop the unverified alineat from user-facing citation text**, keeping `pct. 7 lit. o)` plus the quote — **not** to go hunting for a locator we have already failed to find.

**Do not invent the alineat. Do not copy it from a commercial restatement.** If you find it in a primary source, cite the source; if you don't, the shorter citation is the honest one.

---

## 4. What will move, and why that is fine

**Persona 3's car is disposed on 20 Octombrie 2026** — brief 77 put it there. **Truncating the schedule changes its figures, and that is the proof the fix works.** For every moved figure report **old → new → reason**, with the arithmetic: months charged before and after, the depreciation delta, and how the disposal residual and the proceeds cap move with it.

**The 311.200-lei seed pin at `src/data/seed.identityHygiene.test.ts:339` must not move.** If it does, **stop and report** — no seed persona carries a disposed asset, so a seed movement would mean the truncation leaked beyond disposals.

**A figure moving on a non-disposed asset is a regression.** The change must be reachable only when `disposedOn` is set.

---

## 5. Boundaries

- **No persisted-shape changes. Chain head stays v26.**
- **Do not touch `src/domain/fx/**`, `caen_rev3.csv`, the rule package or its digests.** If the M1 gate needs a rule parameter, **report it rather than adding one.**
- **Do not encode art. 28 alin. (12) lit. i^1).** `research/55` §1 establishes it is real but is a **residential head-office** rule, reaches a PFA only via art. 68 alin. (4) lit. d), has **no prescribed evidence**, and has **no ANAF position for a PFA**. That is a separate decision, not this brief.
- **Do not model super-accelerated alin. (8^1)–(8^3).** `depreciation.ts:71` already records why it isn't, and that reason still holds.
- **Do not „fix" the last-year remainder convention.**

---

## 6. Acceptance criteria

1. `npx tsc --noEmit` → 0. `npm run build` → 0. Both gates → all pass, **once each, backgrounded**, capped forms only.
2. **One month count, asserted.** A test that computes the schedule and the disposal figure for the same disposed asset and asserts they agree — and that they disagreed before.
3. **B-156 both branches:** M1 disposal carries the pct. 27 limit; non-M1 disposal carries the pct. 7 lit. o) proceeds cap and **no M1 figure**.
4. **The reading is labelled** in code and in on-screen copy, with the symmetry argument for the rejected alternative recorded.
5. **B-157:** no unverified locator reaches a user.
6. **Every moved figure: old → new → reason**, with arithmetic.
7. **The 311.200 pin's status stated.**
8. **Register rows closed with their first sentences rewritten** (§12.19), tokens applied, **roll-up re-counted by grep** and the greps reported verbatim.
9. **Newly measured** unit and e2e counts, and **both gate logs quoted verbatim** (§12.21).

---

## 7. Checkpoint discipline

**Commit per defect, by name** — B-153, then B-156, then B-157. This engine has SIGKILLed six Workers this cycle and every loss was exactly the uncommitted work. **A crash must leave the tree consistent, never half-truncated** — a schedule truncated while the disposal figure still counts the old way is precisely the two-count bug this brief exists to remove.
