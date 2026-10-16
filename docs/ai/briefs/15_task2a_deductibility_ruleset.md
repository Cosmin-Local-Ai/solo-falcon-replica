# Brief 15 — TASK 2a: the expense-deductibility rule set (domain only)

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

**Scout infrastructure — known defect, do not work around it silently.** The scout profile's default model exits without producing output (observed: three scouts dead at ~27 s, one combined scout ran 12m32s and produced nothing). **Use the explicit working override `llama-cpp/qwen3.8-flash-next-iq3_s` from the start** — do not burn a run discovering this. If the override also fails, STOP and report it as a BLOCKER. Do not substitute your own broad searching.

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
- Phase deliverables go to `docs/ai/phases/NN_<name>.md`. Never rename, delete, renumber or overwrite anything under `docs/ai/steps/` — frozen archive, never evidence of current behaviour.
- `docs/ai/PLAN.md` and `docs/ai/STATE.md` are the live shared state.
- **Date stamps come from the tool, never typed:** `date +%F` or `git log -1 --format=%cd --date=short`. An external audit caught ~40 `STATE.md` lines dated ahead of the last commit. Do not repeat it.

## SOURCE AUTHORITY
`docs/ai/research/06_2026_fiscal_research.md` and `docs/ai/decisions/09_IMPLEMENTATION_ARCHITECTURE.md` are **not** authoritative and must never be cited as `sourceUrl`. Every fiscal value traces to a primary official source. A contradiction inside a discredited doc is evidence the doc is unreliable, not evidence of a legal ambiguity.

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

**Pre-Phase-11 corrections (this round, sequential):**
- TASK 1 — projection feeds the annual tax estimate — **DONE** (`beb4b56`→`c49d88f`, `phases/12_projection_annual_estimate.md`)
- **TASK 2a — the expense-deductibility rule set ← THIS BRIEF**
- TASK 2b — expense category vocabulary, persistence/migration, classification wiring into `estimateBasis.ts`, minimal UI
- TASK 3 — persist tax-reserve state (two read sites: `dashboard.ts:169` **and** `:263`)
- TASK 4 — threshold semantics and applicability
- TASK 5 — pension / CASS input model
- TASK 6 — rule-release immutability (content hash, real `createdAt`, per-rule versions)
- TASK 7 — user-facing language layer
- TASK 8 — prioritisation, severity, rendering
- TASK 9 — provenance + seed + layout hygiene

11. e-Factura reader (XML only) · 12. XML schema validation · 13. mapping to internal model · 14. import preview + duplicate detection · 15. import commit · 16. reconciliation · 17. D430 generation · 18. D430 validation · 19. D430 export · 20. e-Tachigraphe graph · 21. VIES + ANAF status · 22. Dashboard UX polish · 23. testing + hardening · 24. documentation + handoff

## WHY THIS TASK EXISTS
`src/domain/tax.ts:144` is `const deductibleBase = inputs.vatExempt ? expenses : expensesNet;` — **every** expense is treated as deductible. The product decision (see `docs/ai/pre_phase11_execution_plan.md` §3.1) is that **the law classifies the expense, not the user**. The user is asked only about the residue the law genuinely cannot reach.

The Researcher has produced `docs/ai/research/21_expense_deductibility_framework_2026.md`. **That document is your input.** Read it fully before anything else. Where it says UNVERIFIED, you must not invent a rule.

**The legal basis is CF art. 68 — not art. 21, not art. 123.** Title IV contains **zero** references to art. 21; the corporate rule is art. 25 alin. (1), and art. 68 borrows only four named Titlul II concepts. Encoding any other corporate limit for a PFA is a fabrication. Art. 68 alin. (7) is the express non-deductible list and alin. (5) is the capped-items list with its own cap base at alin. (6).

**Three defects this research opened, which your rule set must not contradict:** **B-29** art. 68^3 *cazare* is a flat 30 % of gross with **no expense engine at all** from FY2026 — your rules must make the app refuse for that CAEN family, not compute a wrong number; **B-30** the deductible amount is net of *actually deductible* VAT (the 50 % vehicle VAT cap, pro-rata, art. 297 alin. (7) all leave VAT in the cost); **B-31** purchases of depreciable goods are **never** a direct expense (art. 68 alin. (7) lit. h)) and the art. 28 threshold moved to 5.000 lei under OUG 8/2026.

## WHAT IS TRUE IN THE TREE (measured by the Orchestrator at `aa3c1ce`)
- Baseline: `npx tsc --noEmit` 0 · `npm run test` **49 files / 784 tests** · `npm run build` 0 · `npm run test:e2e` **36 passed**.
- `Expense` is declared at **`src/data/types.ts:39`** (not `src/domain/types.ts`, which does not exist). It carries a **free-text `categoria`**, which is why nothing can be derived from it today.
- Money is integer **`Bani`** end to end; `src/domain/money.ts` owns `lei()`, `toBani`, `addBani`, `subBani`, `roundArt66`.
- The tax operands are assembled in **one place**: `src/domain/estimateBasis.ts` → `selectTaxEstimateBasis(projection, ytd)` → `amountsForEstimate(basis)`, consumed at exactly two sites (`data/dashboard.ts getTaxEstimate`, `data/derived.ts useLatestTaxEstimate`).
- Rule model: `src/domain/fiscal/rules.ts` (`FiscalRule`, `RuleRelease`, status/version/effective dates, provenance fields). Active package: `src/domain/fiscal/package2026.ts`, release in `release2026.ts`.
- `src/data/migration.ts` is **singular** — `migrations.ts` does not exist.

## SCOPE — domain only
Encode the verified framework as **data in the rule store**, so that a later correction is a new rule release rather than a code change.

Required:
1. **Spawn Scouts first** (with the model override): the rule model and how rules are selected (`rules.ts`, `package2026.ts`, `release2026.ts`, `selectApplicableRules`); how `tax.ts` reads parameters; and how the snapshot input hash is computed (`src/domain/snapshots/hashSync.ts`).
2. Add a **deductibility rule set** to the 2026 package: each rule maps an expense category/context to a treatment — `deductible` · `non_deductible` · `capped(percentage)` · `undetermined` — and carries full provenance (`sourceAct`, `sourceArticle`, `sourceUrl`, `verifiedAt`, `status`, `version`) exactly like every existing rule.
3. **Every rule must trace to a citation in the research document.** No citation → no rule. Mark the category `undetermined` instead.
4. **Do not apply corporate-only limits to a PFA.** If the research says a cap exists only for impozit pe profit, encoding it for sistem real is a fabrication. This is the single most likely way to fail this task.
5. Add a pure domain function that, given an expense's category/context, returns the treatment **plus the rule that produced it** — so the estimate can later explain its own deductible total.
6. Focused tests: one per treatment, one proving an uncited category is `undetermined`, one proving a corporate-only limit is **not** applied to sistem real, and one proving provenance is present on every new rule.

Explicitly OUT of scope (TASK 2b): changing the `Expense` record shape, the category vocabulary, persistence/migration, wiring anything into `estimateBasis.ts` or `tax.ts`, and **any UI at all**. This task must not change any existing computed figure.

## LANDMINES
- **Do not change `tax.ts` formulas.** If you find yourself editing the deductible-base line, you are doing 2b.
- **Snapshot hashes.** Adding rules to the active package could change what the input hash covers. Read `hashSync.ts` and **report** whether existing snapshot hashes would move. Do **not** add a blanket re-hash migration — the digest covers stored `inputSnapshot` bytes; a blanket migration silently destroys every user's tamper evidence. If stored bytes genuinely change, follow the targeted id-scoped pattern in `src/data/migration.ts`.
- **No floating-point money.** `Bani` and `decimal.js-light` only.
- **The suite must not go quiet.** 784 tests must stay green. If a test starts failing, the cause is yours to explain, not to negotiate away. Never delete an assertion or loosen a matcher.

## ACCEPTANCE
- The deductibility rule set exists in the rule store with full provenance, and every rule cites the research document.
- A pure domain classifier returns treatment + justifying rule for an expense.
- Uncited categories are `undetermined`, never silently deductible.
- `tsc` 0 · `npm run test` green with **new counts reported** · `npm run build` 0 · `npm run test:e2e` 36 (no figure should move in this task — if one does, explain exactly why).
- A document at `docs/ai/phases/13_expense_deductibility_ruleset.md` records: what the law permits to be classified automatically, what it cannot, which categories were left `undetermined` and why, files changed, and the exact implication for TASK 2b.

## HANDOFF
`NEXT HANDOFF:` must state precisely: the rule ids and treatments now available, the classifier's signature, and what TASK 2b must do to make an `Expense` carry the category the classifier needs.
