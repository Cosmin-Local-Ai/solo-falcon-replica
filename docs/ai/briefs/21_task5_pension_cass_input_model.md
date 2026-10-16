# Brief 21 — TASK 5: the pension / CASS input model

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
4. **OVERRIDE — Scouts run SEQUENTIALLY.** Spawn Scouts **one at a time, waiting for each report before spawning the next.** Parallel scouting is suspended this round. Do not run a Researcher concurrently with a Worker.
5. Each Scout inspects the smallest relevant territory and returns a compact report: exact files, symbols, current behavior, constraints, handoff notes.
6. If the Worker finds missing local information, it spawns another narrow Scout — it does not search broadly.
7. One Worker = one coherent, tightly scoped job. It changes only what its job requires.
8. Do NOT spawn a post-Worker Scout verification pass. The Worker self-validates instead.
9. The Worker MUST self-validate with the narrowest useful checks: npx tsc --noEmit, npm run build, npm run test, npm run test:e2e, scoped to what it changed.
10. Do not start future phases. Stop when this phase's acceptance criteria are met.

**Scout infrastructure — known defect.** The scout profile's default model produces no output. **Use the explicit override `llama-cpp/qwen3.8-flash-next-iq3_s` from the start.** If it fails too, STOP and report a BLOCKER; never substitute broad self-directed searching.

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

## HYGIENE
- Phase docs → `docs/ai/phases/NN_<name>.md`. Never touch `docs/ai/steps/` (frozen archive).
- `docs/ai/PLAN.md` / `docs/ai/STATE.md` are the live shared state.
- **Date stamps from the tool:** `date +%F` or `git log -1 --format=%cd --date=short`.
- **Validation uses the runner's own exit status** (`set -o pipefail`, never a piped `grep`).

## SOURCE AUTHORITY
**`docs/ai/research/25_pension_cass_exception_2026.md`** is the legal basis for this task. Its closing sections — **`## What the app may switch off, and for whom`**, **`## What the app must not do`**, **`## What fact the input model must actually hold`** — are the acceptance boundary. `docs/ai/research/24_cas_floor_consequence_2026.md` covers the CAS side. `research/06_2026_fiscal_research.md` and `decisions/09_IMPLEMENTATION_ARCHITECTURE.md` are **not** authoritative and must never be cited as `sourceUrl`.

## WHAT TASK 4 ALREADY GOT RIGHT — do not undo it
`applicabilityFor` in `src/domain/thresholds.ts` (the `cass-art-174-6` / `cass-art-170-1` branch, ~lines 519-560) **already scopes the relief correctly**: the pensioner branch makes only the **art. 174 alin. (6) top-up row** `not_applicable`, and the comment *"The cap rides on the art. 170 alin. (1) contribution itself, which a pensioner still owes: art. 174 alin. (7) lit. c) removes ONLY the art. 174 alin. (6) top-up. Never mirror the CAS pensioner exemption into CASS"* is exactly what research 25 verified. **Keep that scoping.**

## THE DEFECT THIS TASK FIXES — the key is wrong, not the scope
That same branch decides the relief on **`profile.pensionStatus === 'da'`**. Research 25 shows that is the wrong fact:

- art. 174 alin. (7) lit. c) keys on **„în anul fiscal … persoana fizică a realizat venituri: … c) venituri din pensii, definite conform art. 99"** — art. 99 alin. (1) defines those as **„sume primite ca pensii"**. So the test is **receipt of pension sums in the fiscal year**, not a status.
- A person who **was** a pensioner during the year but received no pension sums in it does **not** qualify. A person who was **not** a pensioner for the whole year but received pension sums in it **does**.
- **lit. c) carries no amount threshold.** lit. a) (salaries) and lit. b) carry „cel puțin egal cu 6 salarii minime brute"; **applying a threshold to lit. c) would be an invented rule.**
- The only status-based extension of alin. (7) is **alin. (8)**, and its list — art. 154 alin. (1) lit. **a), b), e), f)** — **excludes pensioners**.
- **art. 154 alin. (2)** expressly preserves CASS on other art. 155 alin. (1) incomes for people inside the excepted categories.

**So: replace the status flag with the year-scoped receipt fact, and keep pensioner status as a separate, independently recorded fact** — because status *is* the correct key for **CAS** (art. 150 alin. (1), already used correctly at `thresholds.ts:497`) and for **pension-income** CASS (art. 154 alin. (1) lit. h²), and from 2028 art. 220⁸ alin. (4)). One boolean currently serves all three.

## SCOPE
1. **Model the facts research 25 lists under `## What fact the input model must actually hold`**, each **attributed to a fiscal year**: pension sums received (yes/no, which year), pensioner status (separate), previous-year membership of art. 154 alin. (1) lit. a)/b)/e)/f) or a prior art. 180 alin. (1) option (the alin. (8) route), and valid foreign sickness/maternity insurance proved under art. 153 alin. (2) (which *does* remove CASS taxpayer quality entirely).
2. **`REVIEW_REQUIRED` where the data cannot establish the treatment** — absence of a fact is not evidence of the opposite. `unknown` is a real third state and must stay one.
3. **Do not encode the pension-suspension rule.** Research 25 marks it **UNVERIFIED** — no Cod fiscal, HG 1/2016 or OPANAF provision addresses it for art. 174 alin. (7). Record the fact (suspended, which months) and mark the legal consequence `REVIEW_REQUIRED`.
4. **Do not resolve the art. 174 alin. (2) vs alin. (6) tension by inference — and note that current code already does.** `applicabilityFor` currently returns `not_applicable` for `measured <= 0` citing art. 174 alin. (2). Research 25 gap #2 records that the code does **not** say whether the 6-SM *difference* survives a zero/loss year. That branch is therefore an **inference presented as law**. Either justify it against a primary source you find, or make it `REVIEW_REQUIRED` with a „Notă de interpretare". **Do not silently keep it.**
5. **art. 174 alin. (7) lit. b)** (other art. 155 alin. (1) lit. c)-h) income ≥ 6 SM) — model it only if the profile actually holds those incomes; otherwise `unknown`, never assumed.
6. **Persistence:** this changes the profile shape, so it needs a **migration** (current schema version is **7** after TASK 3 → **8**). A migration must not invent a receipt fact from an old status flag: an old `pensionStatus: 'da'` does **not** imply pension sums were received in the year. Backfill to `unknown` / `REVIEW_REQUIRED`, not to a derived legal conclusion.
7. **Tests:** the relief fires on receipt-in-year and not on status alone; no amount threshold on lit. c); the 10 % CASS contribution still applies when the top-up is disapplied; CAS still keys on status; an old record migrates to `unknown` rather than to a legal conclusion.

## SETTLED — the minimum-wage question is no longer open
Research 25 found **art. 135¹ alin. (3) CF**: for art. 148, 151, 170, 174 și 174¹ the SM value is the one **in force on 1 January of the income year**, *„indiferent dacă în cursul aceluiași an se utilizează mai multe valori"*. For FY2026 that is **4.050 lei** (HG 1.506/2024), **not** the 4.325 lei from 1 iulie 2026 (HG 146/2026). So **6 SM = 24.300 lei · 12 SM = 48.600 lei · 24 SM = 97.200 lei · 72 SM = 291.600 lei** are all derivable from law, and research 24's "which vintage" UNVERIFIED is **closed**. TASK 4's copy cites both vintages out of caution — you may simplify it to the 1 January rule with the art. 135¹ alin. (3) citation, but do not otherwise rework user-facing copy (that is TASK 7).

## LANDMINES
- **Do not apply the 1 ianuarie 2028 pensioner exception (art. 220⁸ alin. (4)) to FY2026**, and never to independent-activity income — it concerns pension income.
- **Do not apply the 72-SM cap to revenue**; it caps the *bază de calcul* (art. 170 alin. (1)), and fiscal losses under art. 118 are excluded from that base.
- **Do not rely on the ANAF ianuarie 2026 slide's exception list** — it recites the superseded art. 174 alin. (8) lit. a) wording and omits pensions.
- **No floating-point money.** `Bani` + `decimal.js-light`.
- **Keep consuming `snapshot.taxReserve` / `DashboardData.reserve`** — never re-derive the reserve gap.
- **Do not invent a lei figure for the 25.000 euro trigger** (art. 69 alin. (9)) — the FX store is TASK 10.
- **Never** delete an assertion, loosen a matcher or widen a timeout. I diff the test files.
- **Figures should not move:** seed deductible 120,00 / 144,00 lei, VNA 9.096,00 · impozit 819,00 · total 3.249,00 · reserve 1.083,00. The seed profile's pension facts may change shape, but if any computed figure moves, re-derive by hand first and record old → new.

## BASELINE (measured by the Orchestrator at `8750402`)
`tsc` 0 · **56 files / 926 tests** · `build` 0 · `e2e` **36 passed**.

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
1. Real baseline + documentation truth — DONE
2. Verified 2026 fiscal baseline + rule provenance — DONE
3. CAS correction — DONE
4. CASS correction — DONE
5. 2026 income tax correction — DONE
6. Fiscal regime + profile foundation — DONE
7. Identity source of truth + persistence versioning/migration — DONE
8. Financial amount semantics — DONE
9. Payment / collection dates — DONE
9b. Rule-driven deadlines + legal citations — DONE
10. Money precision (integer bani + decimal.js-light) — DONE

**Pre-Phase-11 corrections (this round):**
- TASK 1 — projection feeds the annual estimate — DONE (`c49d88f`)
- TASK 2a — the deductibility rule set (39 rules on CF art. 68) — DONE (`1583d9e`)
- TASK 2b — record, migration, wiring, minimal UI — DONE (`1490bdb`)
- TASK 2c — annual caps, single two-pass — DONE (`f1caa36`)
- TASK 2d — pre-cap operative, post-cap surfaced — DONE (`431afaf`)
- TASK 3 — persist the tax reserve — DONE (`698e180`)
- TASK 4 — threshold semantics and applicability — DONE (`8750402`)
- **TASK 5 — pension / CASS input model ← THIS BRIEF**
- TASK 6 — rule-release immutability
- TASK 7 — user-facing language layer
- TASK 8 — prioritisation, severity, rendering
- TASK 9 — provenance + seed + layout hygiene (includes the browser reload test, which takes e2e 36 → 37)
- TASK 10 — currency on the money record + FX rate store (defect B-32; research 23)

11. e-Factura reader (XML only) · 12. XML schema validation · 13. mapping to internal model · 14. import preview + duplicate detection · 15. import commit · 16. reconciliation · 17. D430 generation · 18. D430 validation · 19. D430 export · 20. e-Tachigraphe graph · 21. VIES + ANAF status · 22. Dashboard UX polish · 23. testing + hardening · 24. documentation + handoff

## ACCEPTANCE
- The CASS top-up relief fires on **pension sums received in the fiscal year**, never on status alone, and never with an amount threshold.
- The 10 % CASS contribution still applies whenever the top-up is disapplied.
- Pensioner status remains the key for CAS (art. 150 alin. (1)) and is modelled separately from pension-income receipt.
- Every new fact is year-attributed; missing facts yield `unknown` / `REVIEW_REQUIRED`, never a derived legal conclusion.
- The art. 174 alin. (2) zero/loss branch is either justified against a primary source or converted to `REVIEW_REQUIRED` with a „Notă de interpretare".
- Migration 7 → 8 backfills to `unknown`, not to a legal conclusion, and an old record still renders.
- `tsc` 0 · `npm run test` green with **new counts reported** · `build` 0 · `e2e` **36 passed**, every re-pinned figure recorded old → new.
- `docs/ai/phases/19_pension_cass_input_model.md` records the fact model, the migration, what was `REVIEW_REQUIRED` and why (citing research 25), and the implication for TASK 7 and TASK 8.

## HANDOFF
`NEXT HANDOFF:` must state the exact new profile fields and their types, the migration behaviour for old records, every place a legal conclusion is now withheld, and what TASK 7 must say about the alin. (2)/alin. (6) uncertainty.
