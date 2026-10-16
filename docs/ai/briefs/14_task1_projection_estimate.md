# Brief 14 — TASK 1 of 4: the projection must feed the annual tax estimate

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
4. Scouts may run in parallel when their questions are independent.
5. Each Scout inspects the smallest relevant territory and returns a compact report: exact files, symbols, current behavior, constraints, handoff notes.
6. If the Worker finds missing local information, it spawns another narrow Scout — it does not search broadly.
7. One Worker = one coherent, tightly scoped job. It changes only what its job requires.
8. Do NOT spawn a post-Worker Scout verification pass. The Worker self-validates instead.
9. The Worker MUST self-validate with the narrowest useful checks: npx tsc --noEmit, npm run build, npm run test, npm run test:e2e, scoped to what it changed.
10. Do not start future phases. Stop when this phase's acceptance criteria are met.

Scout infrastructure (known defect — do not work around it silently)
The scout agent profile's configured model is unreachable: every attempt in Phase 1 failed with Connection error in ~2s. If a Scout fails:
1. Retry once with an explicit working-model override.
2. If that also fails, STOP and report the failure to the Orchestrator.
3. Do NOT silently substitute direct self-inspection for the Scout. Report it as a BLOCKER.

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

## DOCUMENT NAMESPACE
- New phase deliverables go to `docs/ai/phases/NN_<name>.md`. Never rename, delete, renumber or overwrite anything under `docs/ai/steps/` — that is a frozen archive and is never evidence of current behaviour.
- `docs/ai/PLAN.md` and `docs/ai/STATE.md` are the live shared state.
- When a new phase contradicts an archived step file, the new phase document wins. Say so in one line.

## SOURCE AUTHORITY
`docs/ai/research/06_2026_fiscal_research.md` is NOT authoritative (self-contradictory on the CAS minimum base and the VAT threshold; self-rated Medium on its CAS-maximum claim). Neither is `docs/ai/decisions/09_IMPLEMENTATION_ARCHITECTURE.md`. Never cite either as `sourceUrl`. Every fiscal value must trace to primary official sources. A contradiction inside a discredited doc is evidence the doc is unreliable, not evidence of a legal ambiguity.

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

**Pre-Phase-11 corrections (this round, four tasks, strictly sequential):**
- **TASK 1 — projection feeds the annual tax estimate ← THIS BRIEF**
- TASK 2 — expense deductibility model (replaces "all expensesNet are deductible")
- TASK 3 — persist tax-reserve state (currently recreated as `null`)
- TASK 4 — threshold semantics and applicability (below-a-floor must not read as a breach)

11. e-Factura reader (XML only)
12. e-Factura XML schema validation
13. e-Factura mapping to internal model
14. e-Factura import preview + duplicate detection
15. e-Factura import commit
16. e-Factura reconciliation
17. D430 form generation
18. D430 validation
19. D430 export
20. e-Tachigraphe graph integration
21. VIES + ANAF status checking
22. Dashboard UX polish
23. Testing + hardening
24. Documentation + handoff

## WHAT IS TRUE IN THE TREE RIGHT NOW (measured by the Orchestrator, 2026-10-08, HEAD `ac84f37`)
- `src/data/dashboard.ts:88-101` — `getTaxEstimate()` calls `selectYtd(data, asOfDate)` and passes `ytd.revenue`, `ytd.expenses`, `ytd.revenueNet`, `ytd.expenseNet` **straight into `computeTaxEstimate`**. The annual projection is not involved.
- `src/domain/projection.ts` exists and has its own test file. It is **not** used by the tax-estimate path.
- Money is **integer `Bani` end to end** since Phase 10. `src/domain/money.ts` owns `Bani`, `lei()`, `toBani`, `baniToLei`, `roundArt66`, `addBani`/`subBani`. There is **no `src/domain/types.ts`** — older briefs reference it and it does not exist.
- `src/domain/tax.ts:144` — `const deductibleBase = inputs.vatExempt ? expenses : expensesNet;` i.e. **every** expense is treated as deductible. **That is TASK 2. Do not touch it here.**
- `src/data/dashboard.ts:169` and `:263` — `createTaxReserveState(null)`. **That is TASK 3. Do not touch it here.**
- `src/domain/thresholds.ts:232` + `breachMeaningFor` — below a minimum is reported as `breached` and explained as *"disqualification from the regime"*. **That is TASK 4. Do not touch it here.**
- Baseline that must stay green: `npx tsc --noEmit` 0 · `npm run test` **48 files / 760 tests** · `npm run build` 0 · `npm run test:e2e` **36 passed**.

## SCOPE — one task only
Make the user-facing **annual tax estimate** represent the intended **annual/projection** model instead of raw YTD totals, while the YTD financial summary stays YTD.

Required:
1. **Read `src/domain/projection.ts` and its test first** and establish from the code what the projection model actually computes — its basis, its run-rate assumption, how it treats a partial year, and what it refuses to project. Do not assume; the model's own semantics are the spec.
2. Feed the **annual projection** into the tax estimate where the projection model supports it. Keep the **actual-vs-projected** distinction explicit in the result, so a consumer can tell which figures are actuals-to-date and which are projected.
3. Keep the **YTD financial summary** exactly as it is. This task changes the tax estimate, not the summary.
4. **Wording must not imply more certainty than the model has.** The projection is a run-rate assumption, not a forecast of fact; any user-facing label must say so.
5. The tax engine stays deterministic and rule-driven. No new legal values, no new rules, no rate changes.
6. Add **focused tests** proving the estimate changes correctly as the projection basis changes (months elapsed, a different run-rate), and that a partial year is handled per the projection model rather than silently annualised.

Explicitly OUT of scope: expense deductibility (TASK 2), tax-reserve persistence (TASK 3), threshold semantics (TASK 4), e-Factura, UI redesign, any change to the formulas in `tax.ts`, any change to `money.ts`.

## LANDMINES — read before you start
- **e2e specs pin specific currency figures** (e.g. `46.570` on the cockpit, `1.350` in the reserve card). If the estimate basis changes, those figures change. **Record each one in `DECISIONS:` as old → new with the reason.** Do **not** delete an assertion or loosen a matcher to make it pass. A test that stops failing because it stopped checking is a failed task.
- **`computeTaxEstimate` feeds the snapshot input hash** (`src/domain/snapshots/hashSync.ts`). Changing what feeds the engine changes existing snapshot hashes. Phase 10 solved exactly this with a **targeted, id-scoped legacy hash tier** in `src/data/migrations.ts`. Read it and follow the same pattern. Do **not** re-key the storage namespace, and do **not** add a blanket hash migration — a blanket migration silently destroys every user's tamper evidence.
- **Do not weaken the `REVIEW_REQUIRED` path.** If the projection model cannot project something, the honest output is `REVIEW_REQUIRED` or an explicit actuals-only result — never a plausible-looking number.
- **No floating-point money.** Everything is `Bani`; use the `money.ts` helpers and `decimal.js-light` for intermediates. Never reintroduce a float intermediate.

## ACCEPTANCE
- A current-year Dashboard can show an **annual** tax estimate derived from the existing projection model, with wording that names the run-rate assumption.
- The YTD financial summary is unchanged and still labelled YTD.
- Actual vs projected is distinguishable in the **data**, not only in the label.
- Focused tests prove the estimate tracks the projection basis.
- `tsc` 0 · `npm run test` green (report file and test counts) · `npm run build` 0 · `npm run test:e2e` **36 passed**.
- A document under `docs/ai/phases/` records: what changed, the projection model's real semantics **as found in the code**, files changed, unresolved issues, and the exact implication for TASK 2.

## HANDOFF
Report in the mandatory format. `NEXT HANDOFF:` must state precisely what TASK 2 (expense deductibility) needs to know: which quantity now enters the engine as the expense figure, and where it is assembled.
