# Brief 16 — TASK 2b: make the deductible subset real (record, migration, wiring, minimal UI)

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

**Scout infrastructure — known defect.** The scout profile's default model produces no output. **Use the explicit override `llama-cpp/qwen3.8-flash-next-iq3_s` from the start.** If it fails too, STOP and report a BLOCKER; do not substitute broad self-directed searching.

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

## DOCUMENT NAMESPACE & HYGIENE
- Phase docs go to `docs/ai/phases/NN_<name>.md`. Never touch `docs/ai/steps/` (frozen archive, never evidence of current behaviour).
- `docs/ai/PLAN.md` and `docs/ai/STATE.md` are the live shared state.
- **Date stamps from the tool, never typed:** `date +%F` or `git log -1 --format=%cd --date=short`.
- **Validation uses the runner's own exit status** (`set -o pipefail`, never a piped `grep`). A previous phase committed on a red suite because of exactly that.

## SOURCE AUTHORITY
`docs/ai/research/06_2026_fiscal_research.md` and `docs/ai/decisions/09_IMPLEMENTATION_ARCHITECTURE.md` are **not** authoritative and must never be cited as `sourceUrl`. The legal basis for this task is **`docs/ai/research/21_expense_deductibility_framework_2026.md`** (CF art. 68, Normele HG 1/2016 pct. 7, OMF 170/2015).

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
- TASK 1 — projection feeds the annual tax estimate — DONE (`c49d88f`)
- TASK 2a — the expense-deductibility rule set — DONE (`1583d9e`, `phases/13_expense_deductibility_ruleset.md`)
- **TASK 2b — record, migration, wiring, minimal UI ← THIS BRIEF**
- TASK 2c (queued, not yours) — cross-record annual caps and the one-vehicle limit
- TASK 3 — persist tax-reserve state (two read sites: `dashboard.ts:169` **and** `:263`)
- TASK 4 — threshold semantics and applicability
- TASK 5 — pension / CASS input model
- TASK 6 — rule-release immutability
- TASK 7 — user-facing language layer
- TASK 8 — prioritisation, severity, rendering
- TASK 9 — provenance + seed + layout hygiene

11. e-Factura reader (XML only) · 12. XML schema validation · 13. mapping to internal model · 14. import preview + duplicate detection · 15. import commit · 16. reconciliation · 17. D430 generation · 18. D430 validation · 19. D430 export · 20. e-Tachigraphe graph · 21. VIES + ANAF status · 22. Dashboard UX polish · 23. testing + hardening · 24. documentation + handoff

## WHAT TASK 2a GAVE YOU (verified by the Orchestrator at `1583d9e`)
- `src/domain/fiscal/deductibility.ts` — `ExpenseCategory`, `EXPENSE_CATEGORIES`, `ExpenseClassificationContext`, the four treatments plus a refusal state, and:
  ```ts
  classifyExpenseDeductibility(
    expense: { category: ExpenseCategory | null | undefined; context?: ExpenseClassificationContext },
    rules: FiscalRule[],                    // pass PFA_2026_SYSTEM_REAL_PACKAGE
    query: { taxYear: number; asOfDate: string },
  ): ExpenseClassification
  ```
  Returns `{status:'classified', treatment, category, rule, cap?, condition?}` · `{status:'undetermined', category, rule|null, missingFact}` · `{status:'refused', rule, reason}`.
  `expenseEngineRefusal(context, rules, query)` is exported separately so you can check **once** before classifying N expenses.
- `src/domain/fiscal/deductibility2026.ts` — **39 rules**, all `taxRegime: 'expense-deductibility'`, each citing its own litera. Package is now 48 rules.
- **`Expense` (`src/data/types.ts:39`) has no category field at all.** You are adding one, not replacing free text.
- Baseline: `tsc` 0 · **50 files / 810 tests** · `build` 0 · `e2e` **36 passed**.

## SCOPE
Make the deductible subset real: an expense carries a category, the classifier runs, and **only confirmed-deductible expenses enter the tax calculation**.

1. **Add `category?: ExpenseCategory` to `Expense`.** Optional. A missing category is legal input and classifies as `undetermined` — that is the safe target for migrated user data.
2. **Persistence:** additive field, bump the persisted schema version, follow the existing chain in `src/data/migration.ts` (singular). **Never** reset a payload to seed on an unknown/missing category.
3. **Classify before aggregation**, and feed the deductible subset into **`src/domain/estimateBasis.ts`** — never at a call site. Standing rule: the operands are assembled in one place and consumed at two (`data/dashboard.ts getTaxEstimate`, `data/derived.ts useLatestTaxEstimate`). Adding the subset at a call site makes the live path and the test path drift; that is how the Phase 10 flake happened.
4. **Pass `asOfDate: expense.paid ?? expense.date`.** Art. 68 alin. (4) lit. b) attributes by year of **payment**, and the OUG 8/2026 letters bind only from 2026-03-01. The date is load-bearing, not cosmetic.
5. **`status: 'refused'` must stop the estimate** (art. 68^3 cazare, defect **B-29**). A refused engine is a `REVIEW_REQUIRED` result naming the reason — never a computed number.
6. **Per-expense caps only.** `_VEHICLE_MIXED_USE_` (50 %, `cap_base: expense_itself`) applies here. **Cross-record annual caps are TASK 2c** — see the trap below.
7. **`undetermined` surfaces as a count with one action** naming `missingFact`. Never a per-expense form, never a checklist the user must clear.
8. **Minimal UI:** one category control on the expense form, and the unclassified count where it is actionable. Nothing else.
9. **Tests:** classification reaches the engine (a non-deductible expense changes the taxable base); `undetermined` is excluded from the deductible total but visible; `refused` produces `REVIEW_REQUIRED`; a migrated payload without a category survives intact; the deductible total is explainable per category with its rule.

## THE TRAP THAT DECIDES THIS TASK — the protocol cap base is circular
Art. 68 alin. (6) defines the protocol cap base as **gross minus deductible expenses *other than* protocol and private scholarships**. So the base depends on a deductible total that must itself exclude the very categories being capped. A naive implementation caps 2 % of the ordinary deductible total and produces a confident wrong number.

**That is why the annual caps are TASK 2c and not yours.** Do **not** implement a partial annual cap here. If you find yourself computing a year-level cap base, stop — you are in 2c.

## SEED DATA — an explicit decision, do not deviate
Seed/demo records are **fixtures, not user data**, so they get **explicit categories**. Migrated user data stays uncategorised → `undetermined`.

Consequence you must expect: the cockpit's figures **move**, because the deductible base is now the confirmed subset rather than every expense. That is the point of the task. Follow the re-pin protocol: derive each new figure **by hand before running**, put the arithmetic in a comment, and record old → new in `DECISIONS:`. **Never** delete an assertion, loosen a matcher or widen a timeout.

## LANDMINES
- **Do not change `tax.ts` formulas.** You change what is fed to them, at the assembler.
- **B-30 (non-deductible VAT added back) is explicitly OUT of scope.** It needs a per-record "which VAT is actually deductible" fact (art. 298 alin. (1) 50 % vehicle cap, art. 300 pro-rata, art. 297 alin. (7)) and would balloon this change. Leave the row open and say so in `NEXT HANDOFF:`.
- **No floating-point money.** `Bani` and `decimal.js-light` only.
- **Snapshot digests.** `snapshot.ts:35-39` hashes exactly `{profile, revenues, expenses}`. If the stored expense bytes change shape, existing digests move. Report it; do **not** add a blanket re-hash migration. A targeted id-scoped tier in `src/data/migration.ts` is the only acceptable pattern, and only if stored bytes genuinely change.
- **Do not touch** `estimateBasis.test.ts` expectations to accommodate new behaviour without deriving them.

## ACCEPTANCE
- Taxable income is no longer "all expenses are deductible": every expense entering the calculation has a deterministic, auditable treatment, and the deductible total is explainable per category with the rule that justified it.
- Uncategorised expense ⇒ `undetermined`, excluded from the deductible total, surfaced as a count with one action.
- Art. 68^3 cazare ⇒ the estimate refuses rather than computes.
- Migration is additive and non-destructive; a payload without the new field loads unchanged.
- `tsc` 0 · `npm run test` green with **new counts reported** · `build` 0 · `e2e` **36 passed**, with every re-pinned figure recorded old → new.
- `docs/ai/phases/14_expense_deductibility_wiring.md` records what changed, what is still uncapped (and why that is TASK 2c), files changed, and the exact implication for TASK 3.

## HANDOFF
`NEXT HANDOFF:` must state: the exact quantity now entering `estimateBasis.ts`, where the classification happens, what TASK 2c must compute (which `cap_base` values are unresolved), and what TASK 3 must not disturb.
