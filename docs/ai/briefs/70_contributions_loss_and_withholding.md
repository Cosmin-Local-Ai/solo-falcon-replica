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

**Neither gate may be a bare foreground command — a multi-minute foreground call kills your own connection, and a Worker lost to `Connection error` twice on exactly this in the previous phase.** Run each one in the background to a log, then read the log once:

```
npx vitest run --pool=threads --poolOptions.threads.maxThreads=2 > /tmp/unit.log 2>&1 &
tail -n 30 /tmp/unit.log
```

Same shape for `npx playwright test --workers=2 > /tmp/e2e.log 2>&1 &`. **One gate at a time.** If the log is incomplete, wait once and re-read — never re-run the suite, never start the second gate while the first is writing.

---

# Brief 70 — the contribution calculators: a loss that cannot come in, two withholding sources that are missing, and a refund that does not exist

**Three defects, one subsystem: `src/domain/fiscal/` contribution and income-tax calculators. B-121, B-122, B-125.**

**Brief 69 (B-113, rounding at conversion) lands before you.** Expect converted figures to have moved. Re-read the pins you are about to assert against what the tree actually holds rather than against what this brief says they contain.

---

## B-121 — the engine cannot consume a prior-year reported fiscal loss

`computeTaxEstimate` *produces* a `lossCarryForward` for the year being computed, but has **no input for a loss carried in from an earlier year.** So a person who reported a loss last year cannot tell the app about it, and the app overstates this year's tax.

**The rule, as corrected by `research/52` — read that file, the earlier register entry was wrong on three counts:**

- Carry-forward is **art. 118 alin. (4)**, not alin. (3). Alin. (3) is a different rule entirely.
- The period is **5 ani fiscali consecutivi**, not 6 — it was 7 until OUG 115/2023 pct. 70 art. LIII, from 2024 incomes.
- Compensation is capped at **70 % of net income**, is **per source of income**, runs **chronologically by age of loss**, and is **not elective.**

On D212 it is rd.5 → rd.6 = min(rd.5, 70 % × rd.3) → rd.7, entered as **one total with no per-year ageing.**

**The trap:** art. 118 alin. (2⁴) caps deductions against *„venitului anual impozabil recalculat"* — a figure that **only exists once the carried-in loss has been applied.** So the loss and the deduction cap are mutually dependent, and the order of operations is not obvious. **If you cannot derive a consistent ordering from the text, report the ambiguity rather than picking one.** A silently chosen order is how a calculator starts producing numbers nobody can reproduce.

**Scope discipline:** this is a *prior-year input*. Do not redesign the current-year loss output, and do not build a per-year ageing store — the return asks for one total.

---

## B-122 — two of three CASS withholding sources are not modelled

Art. 174¹ alin. (3) obliges the payer to calculate, withhold and remit for **DPI, *arendă*, and *asocieri cu persoane juridice*.** The code derives the withheld figure from the **DPI leg only** — `cassWithheldFromSource(…, dpiAmount, …)`. A taxpayer whose CASS is withheld on arendă or on an *asociere* sees `reținută = 0` and **is charged the full amount again.**

`calcCedareArt84x1Withheld`'s own comment already names this gap and leaves it. **This is wiring plus two more sources, not new law** — same article, same alineat.

**The harm is asymmetric and it is worth stating in the copy:** the failure is not "the app shows a slightly different number", it is "the app tells the person they owe the whole amount when someone already paid part of it to the state on their behalf."

---

## B-125 — over-withheld CAS is not returnable, and the app's wording implies it might be

`research/52` §Q4 scanned all of Titlul V (320.745 characters). The only CAS restitution text is a **denial** — art. 151 alin. (4): *„contribuția plătită **nu se restituie**, aceasta fiind valorificată la stabilirea elementelor necesare determinării dreptului de pensie."* Art. 174 alin. (12) is the sole compensate/restitute route and covers **only art. 68¹ sports income**; art. 174¹ alin. (12) points at art. 174 alin. (14)–(18), **deliberately excluding alin. (12)**. D212 Subsecțiunea 1 stops at rd.5 *„Diferența stabilită în plus"* — **there is no CAS minus row**, and in the Sumar no CAS amount can ever reach *„Diferență de restituit"*.

**The current wording — „0 lei payable, recovery not modelled" — is now known to be wrong.** The honest statement is that **the money is kept and credited toward pension service.** That is not a smaller problem; it is a different one, and it is better for the user to understand it.

**Do not build a refund path.** There is none. The fix is the sentence and the state it reports, plus a test that no CAS amount can reach a restitution row.

---

## Boundaries

- **`src/domain/fiscal/**` is yours.** `src/domain/fx/**` is not — brief 69 owns conversion rounding and you must not re-round there.
- **Do not modify `roundArt66`** or the never-derive refusal in `src/domain/fx/annualAverageNeverDerived.test.ts`.
- **No new legal claims.** Everything above is already in `research/52`. If you need a rule that is not in that file, **stop and report** — that is a Researcher task, not a Worker guess.
- **Persona figures are not yours to edit.** If a persona's totals move because the calculator is now correct, **report the movement with old value → new value → why.** That is a finding, not a re-pin.
- The 311.200-lei seed pin at `src/data/seed.identityHygiene.test.ts:339`: if it moves, report before touching.
- No `caen_rev3.csv`, no CAEN ingest, no migration chain changes without reporting first.

---

## Acceptance criteria

1. `npx tsc --noEmit` → 0. `npm run build` → 0. Both capped full-suite commands → all pass, **once each**.
2. **B-121:** a prior-year loss can be entered, and the 70 % cap, per-source separation, and chronological-by-age ordering are each asserted by a test. If the ordering is ambiguous, a reported ambiguity instead.
3. **B-122:** arendă and asociere withholding each produce a non-zero `reținută`, and a test proves a person is **not** charged twice for the same CASS.
4. **B-125:** no surface implies a CAS refund; the pension-credit explanation renders; a test proves no CAS amount reaches a restitution row.
5. **Every moved pin listed**, old → new → reason.
6. Report **newly measured** unit and e2e counts.

---

## One thing to watch for

These three defects all push in the same direction: **the app currently understates what has already been paid or lost, and overstates what is owed.** If your fixes make persona totals *larger*, that is a red flag — re-check the arithmetic before believing the test.
