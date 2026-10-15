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

---

# Brief 74 — vehicles: a non-recoverable VAT figure that reads zero, and a depreciation cap that does not exist in the codebase

**B-114 and B-65.** Both are vehicle expense rules and both live in the same model.

**B-108 (`Expense.assetId`) is NOT in this brief.** It needs a persisted field and a chain step, and it has been moved to the consolidated chain brief with B-140, B-145 and the DPI typed-net retirement. **Do not add `assetId`.**

**Corpus first, per §12.18 — both defects are already covered:**
- **B-65:** `research/36_fixed_assets_and_depreciation_2026.md` — art. 28 alin. (14) at §78, the four exceptions at §251, and **pct. 27, the M1 disposal cap, verbatim at §246**. Also `research/40_vehicle_one_car_limit.md`.
- **B-114:** `research/42_input_vat_deductibility_2026.md`, `research/40_vehicle_one_car_limit.md`, `research/21_expense_deductibility_framework_2026.md`.

---

## B-114 — `nonRecoverableTotal` reports 0 under the art. 298 50 % vehicle restriction

`src/domain/fiscal/vat.ts:546` declares it, `:837` computes it. For a line under the art. 298 vehicle 50 % restriction it returns **0**, where the published source prints **„TVA nedeductibilă 10.500"**.

**The claimable half (10.500) is already correct.** Only the non-recoverable total is misreported. The register calls this a reporting surface rather than a computation error — **but it is what a user reads**, and a user who is told nothing is non-recoverable will conclude the restriction did not apply.

**Do not "fix" this by computing `total − claimable`.** That is arithmetic on the assumption that the two are complementary, and art. 298 has cases where they are not — the art. 28 alin. (14) exceptions, and the mixed-use carve-outs. **Derive the non-recoverable amount from the same rule that derives the claimable one, or report why you cannot.**

---

## B-65 — the 1.500 lei/lună M1 depreciation cap is absent entirely

**No rule, no constant, no test.** CF art. 28 alin. (14): for M1 passenger vehicles (≤ 9 seats incl. driver, RNTR 2 / OMMLTL 211/2003), *„cheltuielile cu amortizarea sunt deductibile, pentru fiecare, **în limita a 1.500 lei/lună**”*, with **four exception categories**: urgency/guarding/courier; sales and purchasing agents including test-drive; paid passenger transport including taxi; paid services including rental and driving schools.

**It reaches a PFA because art. 68 alin. (4) lit. d) borrows art. 28**, and **norm pct. 7 alin. (7) makes it the *only* cap on vehicle depreciation** — the 50 % mixed-use limit expressly does **not** apply to amortizare. Titlul II norm pct. 27 extends it at disposal.

**Three things to get right, in order:**

1. **The cap is per vehicle, per month** — *„pentru fiecare"*. A fleet is not a pool.
2. **It is the only cap.** If the code already applies the 50 % mixed-use limit to depreciation, applying both would be wrong. **Check whether the existing code double-caps, and say so either way.**
3. **The four exceptions are categories, not elections.** A vehicle does not choose one.

**The disposal side (pct. 27) is part of the rule, not a follow-up.** `research/36` §246 has it verbatim. If you implement the annual cap and not the disposal consequence, you have implemented half a rule and created a new inconsistency at disposal.

---

## Boundaries

- **No persisted-shape changes. Chain head stays v21.** If the cap needs a new field on `Asset` — a category, an M1 flag — **stop and report.** That is the chain brief's decision, and B-108 is already queued there with the same need. **Say what the field would be and let that brief decide.**
- **Do not touch `src/domain/fx/**`, `tax.ts`'s DPI wiring, `caen_rev3.csv`, or persona figures.** Report any figure movement with old → new → reason.
- The 311.200-lei seed pin at `src/data/seed.identityHygiene.test.ts:339`: if it moves, report before touching.
- **Do not re-derive the art. 28 alin. (14) text.** It is in `research/36` with its exceptions and its disposal rule.

---

## Acceptance criteria

1. `npx tsc --noEmit` → 0. `npm run build` → 0. Both capped gates → all pass, **once each, backgrounded to a log**.
2. **B-114:** the published **10.500 lei** non-recoverable figure appears where the user reads it, and a test pins it.
3. **B-65:** the 1.500 lei/lună cap applies per vehicle per month, with the four exceptions each asserted, and **a test proving the 50 % mixed-use limit is not also applied to depreciation.**
4. **The disposal consequence (pct. 27) is implemented or explicitly reported as not implemented, with the reason.**
5. **If a new persisted field is needed, a BLOCKER naming the field** — not a chain step taken in this brief.
6. Report **newly measured** unit and e2e counts.

---

## One thing to watch for

**A cap that reduces deductibility raises tax.** If persona vehicle figures move, they should move **toward more tax**, not less. If a figure moves the other way, the cap is being applied to the wrong quantity — most likely the annual amount instead of the monthly one, or the pool instead of each vehicle. **Re-check before believing the test.**
