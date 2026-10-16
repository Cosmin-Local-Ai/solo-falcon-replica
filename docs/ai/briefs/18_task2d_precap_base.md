# Brief 18 — TASK 2d: the protocol base becomes the pre-cap reading, and the post-cap figure becomes visible

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
- **Validation uses the runner's own exit status** (`set -o pipefail`, never a piped `grep`). A piped grep reports the grep's status and has already caused a commit on a red suite here.

## THE DECISION — already made, do not re-litigate
**The operative reading of the art. 68 alin. (6) base is now PRE-CAP.** The user chose it on 2026-10-09, with the explicit condition that **the user must still be informed about the post-cap reading**.

Why: the law does not settle it. Art. 68 alin. (6) says the base is „venitul brut și cheltuielile deductibile, altele decât cheltuielile pentru acordarea de burse private și cheltuielile de protocol", and never says whether „cheltuielile deductibile" means the amounts as recorded or the amounts after the other alin. (5) ceilings have cut them. Research 22 established this is a genuine gap — **zero** occurrences of „protocol", „ordinea" or „în ordine" in the whole norms chapter for Titlul IV Cap. II.

**Pre-cap subtracts more, so the base is smaller, so the protocol allowance is smaller — it can never cause an underpayment.** Post-cap (what TASK 2c shipped) is the more generous reading: on the pinned example **146,30 lei post-cap vs 54,00 lei pre-cap**.

TASK 2c already records both: `baseAlt` / `ceilingAlt` on `AnnualCapAdjustment` (`src/domain/estimateBasis.ts:268-269`). **This task flips which one is operative and promotes the other from internal bookkeeping to something the user actually sees.**

## SCOPE
1. **Flip the operative reading** in `applyAnnualDeductibilityCaps` so the base subtracts the **recorded** amounts of the other alin. (5) capped categories, not the post-ceiling allowed amounts. Keep the two-pass structure — the base is still stable, still no iteration.
2. **Keep the post-cap figure, and surface it.** The cap explanation must name: the ceiling actually applied, the alternative ceiling under the other reading, the article, and the fact that the law does not settle which applies. This is the user's explicit condition — a silent flip is a failed task.
3. **Do not change the categories that are capped, their percentages, or which rules carry `capBase: 'art68_alin6_base'`.** Only the base composition.
4. **Tests:** the pinned example must now assert **54,00 lei operative** with **146,30 lei as the recorded alternative** (TASK 2c pinned it the other way round). Add a test that the surfaced alternative is present in the result object, not merely computed. Re-derive the arithmetic **by hand before running** and put it in the test comment.

## WHAT IS NOT IN SCOPE
- **TASK 10 — currency + FX rate store.** `docs/ai/research/23_fx_conversion_and_bnr_rates_2026.md` has just landed and unblocks it. Do not start it, do not stub it, do not add a `currency` field.
- **TASK 3 — persist the tax reserve.** `getTaxReserve` (`dashboard.ts:199`, `computeTaxReserve` at `:205`) and `buildSnapshot` (`:298`) consume `tax.output.total`; the reserve must consume the estimate, never recompute it.
- **TASK 4 — threshold semantics.** Note for later: research 23 §"What must stay unresolved" item 7 found the **25.000 euro** sistem-real threshold is anchored to „anul de realizare a venitului", a **different anchor** from pct. 7 alin. (6)'s year of payment. One conversion function must not serve both without a `basis` parameter.
- **`tax.ts` formulas.** Caps live in the assembler.

## LANDMINES
- **Figures.** Neither `seed.ts` nor any e2e fixture holds a protocol / burse / contribuții profesionale expense, so the seed deductible should stay **120,00 lei YTD / 144,00 lei projected @ 2026-10-31**, and VNA 9.096,00 · impozit 819,00 · total 3.249,00 · reserve 1.083,00 should be unchanged. **Verify that rather than assume it** — if a figure moves, re-derive it by hand first and record old → new.
- **Never** delete an assertion, loosen a matcher or widen a timeout. Replacing an assertion that pinned the *old* reading is correct and expected; deleting one is not. I diff the test files.
- **No floating-point money.** `Bani` + `decimal.js-light`.
- **Snapshot digests.** `AppData` stores no aggregate and `seed.snapshots: []`, so nothing should move. If you find a stored digest moving, report it; never add a blanket re-hash migration.

## BASELINE (measured by the Orchestrator at `f1caa36`)
`tsc` 0 · **53 files / 855 tests** · `build` 0 · `e2e` **36 passed**.

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
- **TASK 2d — pre-cap operative, post-cap surfaced ← THIS BRIEF**
- TASK 3 — persist tax-reserve state (two read sites: `dashboard.ts:169` **and** `:263`)
- TASK 4 — threshold semantics and applicability
- TASK 5 — pension / CASS input model
- TASK 6 — rule-release immutability
- TASK 7 — user-facing language layer
- TASK 8 — prioritisation, severity, rendering
- TASK 9 — provenance + seed + layout hygiene
- TASK 10 — currency on the money record + FX rate store (defect B-32; research 23)

11. e-Factura reader (XML only) · 12. XML schema validation · 13. mapping to internal model · 14. import preview + duplicate detection · 15. import commit · 16. reconciliation · 17. D430 generation · 18. D430 validation · 19. D430 export · 20. e-Tachigraphe graph · 21. VIES + ANAF status · 22. Dashboard UX polish · 23. testing + hardening · 24. documentation + handoff

## ACCEPTANCE
- The operative protocol and burse ceilings are computed on the **pre-cap** base.
- The **post-cap** ceiling is present in the result and rendered to the user, with the article and an explicit statement that the law does not settle which reading applies.
- The pinned example asserts 54,00 lei operative / 146,30 lei alternative, arithmetic derived by hand in the test comment.
- `tsc` 0 · `npm run test` green with **new counts reported** · `build` 0 · `e2e` **36 passed**, every re-pinned figure recorded old → new.
- `docs/ai/phases/16_precap_base.md` records the flip, what the user now sees, files changed, and the implication for TASK 10 (the euro caps will need the same two-readings-disclosed treatment for the conversion rule itself).

## HANDOFF
`NEXT HANDOFF:` must state the operative base formula as implemented, where the alternative ceiling is exposed in the result type, and what TASK 3 must not disturb.
