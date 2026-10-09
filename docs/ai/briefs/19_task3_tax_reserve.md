# Brief 19 — TASK 3: persist the tax reserve

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
4. **OVERRIDE — Scouts run SEQUENTIALLY.** Spawn Scouts **one at a time, waiting for each report before spawning the next.** Parallel scouting is suspended for this round (the user is timing sequential vs parallel on their own machine). Do not run a Researcher concurrently with a Worker.
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

## SCOPE
The tax reserve is computed but never stored, so the „Rezervă sub țintă" warning can never be cleared — the user has no way to record what they have actually set aside. Persist it.

1. **`reservedAmount: Bani | null` on `AppData`**, using the existing store/migration architecture. Additive: bump the persisted `DATA_VERSION` chain in `src/data/migration.ts` (singular) with a step that **backfills nothing**.
2. **`null` means "no reserve recorded" and renders as such — never `0`.** `0` is a real, different fact (the user recorded that they have set aside nothing). Do not collapse them, and do not let a migration invent one.
3. **Both read sites must change.** The plan names `dashboard.ts:169` **and** `dashboard.ts:263`; TASK 2c/2d moved the code, and its handoff reports `getTaxReserve` at `dashboard.ts:199` (`computeTaxReserve` at `:205`, `estimatedTaxLiability` set at `taxReserve.ts:133`) and `buildSnapshot` at `:298`. **Treat those line numbers as historical — locate both sites yourself and change both.** Fixing one leaves the bug live, which is exactly the defect the original brief recorded.
4. **The reserve must consume the estimate, never recompute it.** Call `selectEstimateOperands` and pass `operands.amounts` / `operands.data`. If you need the capped expense figure, read `operands.amounts` or `operands.capAdjustments`. **Never re-run the caps and never re-project** — `selectProjectionV1` re-runs `selectYtd` internally and the annual ceilings are struck on *its* output.
5. **The reserve must not feed the tax calculation.** It is downstream of the estimate, never an input to it.
6. **Acceptance includes a reload test:** enter a reserve → reload → same value. And a test that a payload with no reserve field loads as `null`, not `0`.

## WHY POINT 4 IS NOW MORE DANGEROUS THAN IT WAS
TASK 2d changed the operative art. 68 alin. (6) base to the **pre-cap** reading, which **lowered `tax.output.total`** for any profile holding a capped expense. A reserve that recomputes the estimate on its own can therefore disagree with the dashboard by exactly the difference between the two ceilings — and **nothing in the UI reveals which one is right**. Consume the estimate; do not derive it.

## LANDMINES
- **Snapshot digests.** `src/domain/snapshots/snapshot.ts` hashes the estimate **aggregate**, not record arrays (TASK 2b established this and pinned it with a test). Adding a *stored* `AppData` field should not move a stored digest — but **verify it, do not assume it**. If a stored digest genuinely moves, report it; a blanket re-hash migration is forbidden, and only a targeted id-scoped tier in `src/data/migration.ts` is acceptable.
- **No floating-point money.** `Bani` + `decimal.js-light`.
- **Never** delete an assertion, loosen a matcher or widen a timeout. Replacing an assertion that pinned the old behaviour is fine; deleting one is not. I diff the test files.
- **Figures should not move.** Seed deductible **120,00 lei YTD / 144,00 lei projected @ 2026-10-31**, VNA 9.096,00 · impozit 819,00 · total 3.249,00 · reserve 1.083,00. If any moves, re-derive it by hand before running and record old → new.

## OUT OF SCOPE
- **TASK 4 — threshold semantics** (typed `kind` + separate severity; delete `breachMeaningFor`).
- **TASK 10 — currency and the FX rate store** (defect B-32, `docs/ai/research/23_fx_conversion_and_bnr_rates_2026.md`). No `currency` field, no FX code, no rate.
- **`tax.ts` formulas**, and anything that changes what enters the estimate operands.

## BASELINE (measured by the Orchestrator at `431afaf`)
`tsc` 0 · **54 files / 860 tests** · `build` 0 · `e2e` **36 passed**.

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
- **TASK 3 — persist the tax reserve ← THIS BRIEF**
- TASK 4 — threshold semantics and applicability
- TASK 5 — pension / CASS input model
- TASK 6 — rule-release immutability
- TASK 7 — user-facing language layer
- TASK 8 — prioritisation, severity, rendering
- TASK 9 — provenance + seed + layout hygiene
- TASK 10 — currency on the money record + FX rate store (defect B-32; research 23)

11. e-Factura reader (XML only) · 12. XML schema validation · 13. mapping to internal model · 14. import preview + duplicate detection · 15. import commit · 16. reconciliation · 17. D430 generation · 18. D430 validation · 19. D430 export · 20. e-Tachigraphe graph · 21. VIES + ANAF status · 22. Dashboard UX polish · 23. testing + hardening · 24. documentation + handoff

## ACCEPTANCE
- A recorded reserve survives a reload unchanged; an unrecorded reserve is `null` and renders as "no reserve recorded", never as 0.
- Both read sites consume the persisted value; neither recomputes the estimate.
- The reserve is never an input to the tax calculation.
- Migration is additive and non-destructive; a payload without the field loads as `null`.
- `tsc` 0 · `npm run test` green with **new counts reported** · `build` 0 · `e2e` **36 passed**, every re-pinned figure recorded old → new.
- `docs/ai/phases/17_tax_reserve_persistence.md` records what changed, both read sites as actually located, the digest finding, files changed, and the implication for TASK 4.

## HANDOFF
`NEXT HANDOFF:` must state where the persisted value lives, its exact type, which sites read it, and whether any stored snapshot digest moved.
