# 13. TASK 2a — the expense-deductibility rule set (domain only)

**Worker:** TASK 2a. **Date:** 2026-10-09 (`date +%F`). **Brief:** `docs/ai/briefs/15_task2a_deductibility_ruleset.md`.
**Legal input:** `docs/ai/research/21_expense_deductibility_framework_2026.md` (the only legal source used; nothing here was derived from the discredited `research/06_…`).

`tax.ts`, `estimateBasis.ts`, the `Expense` record, persistence/migration and every UI file are untouched. No existing computed figure moved.

---

## 1. The legal basis, and the fabrication this task had to avoid

The governing article for a PFA on *sistem real* is **CF art. 68** (Titlul IV, cap. II). Art. 68 is self-contained: its own conditions (alin. (4)), its own capped items (alin. (5)), its own cap base (alin. (6)) and its own express non-deductible list (alin. (7)).

- **Titlul IV (art. 61–133) contains zero references to art. 21.** In the 2026 consolidation art. 21 is about IFRS taxpayers; the corporate general rule is **art. 25 alin. (1)**.
- Art. 68 borrows only a small number of **named** Titlul II concepts: the depreciation rules (alin. (4) lit. d) → art. 28), art. 28 alin. (20) (alin. (4) lit. e)), art. 28 alin. (4) (alin. (4) lit. k)), the *list of destinations* at art. 25 alin. (3) lit. b) (alin. (5) lit. c) — the list, **not** the corporate cap), and the reference rate at art. 27 alin. (7) lit. b) (alin. (5) lit. n)).
- **Any other corporate limit applied to a PFA is a fabrication.** The two traps in this area are the corporate protocol cap (art. 25 alin. (3) lit. a) — 2 % of *accounting profit*) and the corporate vehicle cap (art. 25 alin. (3) lit. l)). Neither is encoded. The PFA's protocol cap is 2 % of the **art. 68 alin. (6)** base; the PFA's vehicle cap is **art. 68 alin. (7) lit. k)**.

A test now enforces this: no deductibility rule cites art. 21, the protocol rule's cap base is the art. 68 alin. (6) formula and contains no reference to profit, and the vehicle cap is sourced to art. 68 alin. (7) lit. k).

## 2. What the rule set is

**39 rules** added under a new `taxRegime: 'expense-deductibility'`, spread into `PFA_2026_SYSTEM_REAL_PACKAGE` (9 → **48**) and listed in `PFA_2026_RELEASE.ruleIds`. Each rule is one litera of art. 68 (or one Normele pct. 7 alin. (5) example), and carries full provenance: `sourceAct`, `sourceArticle`, `sourceUrl`, `verifiedAt: '2026-10-09'`, `status: 'ACTIVE'`, `version: 1`.

Treatment is data, not code: parameters `category`, `treatment`, `condition`, `cap_percent`, `cap_eur`, `cap_base`, `cap_base_article`, `missing_fact`, `note`.

Two model extensions were needed, both additive:
- `FiscalRegime` gained `'expense-deductibility'`. It is a **fresh regime string on purpose**: `tax.ts` resolves `cas`/`cass`/`income-tax` with `applicable.find(r => r.taxRegime === …)`, so reusing one of those would let a second rule be silently shadowed by whichever `ruleId` sorts first. `deadlines` and `wage-reference` were added the same way.
- `FiscalParameter.unit` gained `'eur'`. The law states several caps in euro („în limita echivalentului în lei a 400 euro anual"). Storing them as `'eur'` keeps them machine-readable while making it impossible to read them as money: `paramBani` refuses any unit other than `'lei'`. A test asserts **no** deductibility rule carries a `'lei'` parameter, so no euro figure can leak into a bani calculation.

## 3. What the law permits to be classified automatically

From the category alone, with no user question:

| Treatment | Categories | Basis |
|---|---|---|
| `non_deductible` | personal/family use; expenses matching non-taxable income; own income tax; personal insurance premiums & medical subscriptions; donations; fines, penalties, late-payment interest, confiscated goods; loan principal; **purchase/manufacture of depreciable assets**; uncovered inventory shortage; tax borne for beneficiaries; depreciation of personal-patrimony assets; sponsorship/mecenat; corruption-related expenses | art. 68 alin. (7) lit. a), b), c), d), e), f), g), h), i), j), k^1), k^3), k^4) |
| `non_deductible` | owner's own CAS/CASS | not an art. 68 expense at all — alin. (5) lit. k) admits only employer-side; deducted later at art. 118 alin. (2) lit. b), capped by alin. (2^4). Deducting it here would double-count it. |
| `non_deductible` | **any** category, when no supporting document exists | art. 68 alin. (4) lit. a) — a cumulative condition, not a litera of alin. (7) |
| `deductible` | employer social contributions; rent of business space; bank interest; postal & telecom; energy & water; upkeep of business space; depreciation of a business asset | alin. (5) lit. k); Normele pct. 7 alin. (5) lit. d), e), i), j) + closing sentence; alin. (4) lit. d) → art. 28 |
| `capped` | protocol **2 %** of the art. 68 alin. (6) base; social expenses **5 %** of annual salary expense; burse private **5 %**; pensii facultative / ocupaționale / PEPP **400 EUR**; voluntary health insurance **400 EUR**; sports subscription **100 EUR**; professional body dues **4 000 EUR**; mandatory professional contributions **5 % of gross**; ETF purchases **400 EUR**; **mixed-use vehicle 50 %** | alin. (5) lit. b), c), a), g), g^1), g^2), h), r), p), q), s); alin. (7) lit. k) |
| `refused` | the whole activity family *prestarea de servicii de cazare* | art. 68 alin. (1) excepts art. 68^3; art. 68^3 alin. (2) and (7) |

Three behaviours worth naming:

- **B-29 — cazare refuses.** `classifyExpenseDeductibility` checks the regime-level refusal *before* any category. For a cazare activity it returns `status: 'refused'` with the art. 68^3 rule, never a treatment. The app declines instead of computing a confident wrong number.
- **B-31 — a capital purchase is never a direct expense.** `depreciable_asset_purchase` is `non_deductible` under alin. (7) lit. h); only `depreciation_business_asset` is deductible. The art. 28 alin. (2) lit. b) threshold (2 500 → **5 000 lei**, OUG 8/2026) is cited in the rule's note but deliberately **not stored as a parameter** — no rule in this set reads it, and an unread money parameter would create a second source of truth for the asset model B-31 still needs.
- **Effective dates carry legal meaning.** `g^1)` and `g^2)` (OUG 8/2026) are `effectiveFrom: '2026-03-01'` because art. 10 alin. (10) applies them to contributions *plătite începând cu 1 martie 2026*. A PEPP contribution paid on 2026-01-15 therefore classifies as `undetermined` rather than wrongly deductible — tested.

## 4. What the law cannot decide, and what was left `undetermined`

`undetermined` is produced in two ways, and the difference matters to TASK 2b:

**(a) By an explicit rule** — the law fixes the direction but supplies no method, so the residue is a fact about the expense:

| Category | Why it stays `undetermined` |
|---|---|
| `home_office_shared_cost` | alin. (5) lit. i) allows only „partea de cheltuială care este aferentă activității independente", but the law gives **no** m² rule, no time-share, no default percentage. Any split the app computed would be a user fact, not a legal rule. Art. 298 alin. (4^1) (50 % VAT cap on residential buildings) is **not yet in force** — conditional on an EU derogation, still pending in the 08.08.2026 consolidation — so it must not be applied in 2026. |
| `comodat_immovable_share` | Normele pct. 7 alin. (5) lit. r) admits the costs „pentru partea aferentă utilizării în scopul afacerii, potrivit înțelegerii din contract" — the share is a contract term the app does not hold. |

**(b) By absence of a rule** — any category not in the vocabulary returns `undetermined` with `rule: null`. Art. 68 alin. (7) lit. l) („alte sume prevăzute prin legislația în vigoare") is an open clause and is **deliberately not encoded**; a test asserts no rule leans on it. An uncited category is never treated as deductible.

Categories the research marks ambiguous, and how they were handled rather than papered over:

- **Protocol** is encoded as `capped`, because the cap is settled — but the rule's note records that neither art. 68 nor the Normele *define* „cheltuieli de protocol", so deciding whether an invoice is protocol rather than reclamă/publicitate is a judgement call. The cap is settled; the category assignment is not.
- **Vehicle exclusive vs mixed use** is a fact, decided by the **foaie de parcurs**. The classifier's statutory default is 50 %: `vehicleUse: 'unknown'` behaves like `'mixed'`, never like `'exclusive'`. The five exception categories give full deduction. Depreciation sits outside the cap and is a separate category.
- **Purpose** („în scopul realizării de venituri", alin. (1) and alin. (4) lit. j)) is not a category question at all, so no rule claims to settle it.
- **Rent paid by the PFA to its own owner's patrimony** is UNVERIFIED in the sources read; the rent rule records that and does not decide it.
- **Fines carve-out**: contractual penalties paid under commercial contracts stay deductible — flagged in the rule note so 2b does not auto-flag them.

**Deliberately not encoded at all:** the VAT treatment (B-30). §6 of research 21 settles that the deductible amount is net of *actually deductible* VAT, with the 50 % vehicle VAT cap, pro-rata and art. 297 alin. (7) all leaving VAT in the cost — but building that is a VAT treatment system, which §3.1 of the execution plan puts out of scope. No rule here contradicts B-30.

## 5. Snapshot hashes — the verdict

**Adding these rules moves zero stored bytes. No migration was added, and none is needed.**

`src/domain/snapshots/snapshot.ts:35-39` builds the digest input as exactly `{ profile, revenues, expenses }`, and `:46` hashes only that object; `ruleRelease` is assigned at `:44`, *beside* the digest, never inside it. `CalculationInput` (`snapshots/types.ts:21-36`) has no `ruleRelease`, `ruleIds`, package or `FiscalRule[]` member. Stored digests are inert bytes: `store.tsx:119` loads them without recomputation and `schema.ts:167` accepts any string. Only `migration.ts:265` and `:414` ever rewrite a stored digest, and both are gated on "did this record's own bytes change". The invariant is already pinned by `snapshots.test.ts:298` and `dashboard.test.ts:618`.

The `ruleIds` list embedded in a snapshot's `ruleRelease` grows for **newly created** snapshots only.

## 6. Files changed

| File | Change |
|---|---|
| `src/domain/fiscal/deductibility.ts` | **new** — category vocabulary, context types, the four treatments + refusal, and the pure classifier |
| `src/domain/fiscal/deductibility2026.ts` | **new** — the 39 rules, each citing its own litera |
| `src/domain/fiscal/deductibility.test.ts` | **new** — 26 focused tests |
| `src/domain/fiscal/rules.ts` | `FiscalRegime` + `'expense-deductibility'`; `FiscalParameter.unit` + `'eur'` (both additive) |
| `src/domain/fiscal/package2026.ts` | spreads `...DEDUCTIBILITY_RULES_2026` into the package (9 → 48) |
| `src/domain/fiscal/release2026.ts` | 39 rule ids; two primary evidence URLs; release note |
| `src/domain/fiscal/fiscal.test.ts` | three absolute rule-count assertions updated: 9 → 48, 8 → 47, 8 → 47 |

`fiscal.test.ts` is the only test file edited. No assertion was deleted and no matcher loosened — all three are still exact `toHaveLength` checks. The counts move because the deductibility rules are data in the package, which is the point of the task; the 47 = 48 − 1 at both test dates is the H1/H2 wage rule, and the two OUG 8/2026 letters are correctly inside the window on 2026-03-15.

## 7. Validation (measured, `set -o pipefail`, never a piped `grep`)

| Check | Before | After |
|---|---|---|
| `npx tsc --noEmit` | 0 | **0** |
| `npm run test` | 49 files / 784 tests | **50 files / 810 tests** (+26) |
| `npm run build` | 0 | **0** (known 757 kB chunk warning, unchanged) |
| `npm run test:e2e` | 36 passed | **36 passed** |

No pinned currency figure moved in any unit or e2e test.

## 8. Exact implication for TASK 2b

The classifier is live and tested, but **nothing calls it yet** — that is 2b's job.

1. **`Expense` has no category field today.** The brief's "measured tree state" is wrong on this point: `src/data/types.ts:39` carries **no** `categoria`. `categoria: string` exists only on `DocumentItem` (`types.ts:93`), an unrelated dashboard document list, with zero hits in `e2e/`. So 2b **adds** a field from scratch — to `Expense`, `expenseSchema` (`schema.ts:71-85`), the form (`pages/Expenses.tsx`), the store, and the 6 fixture sites (`seed.ts:46-50`, `aggregation.test.ts:82-93`, `derived.test.ts:87-99`, `completeness.test.ts:67-78`, `store.migration.chain.test.tsx:80-91`, `store.profileBackfill.test.tsx:55-66`).
2. **What an `Expense` must carry** for the classifier to work: a category token drawn from `EXPENSE_CATEGORIES` / `ExpenseCategory` in `deductibility.ts`. Everything else is optional context. A record with no category is legal input and classifies as `undetermined` — that is the migration target for legacy rows, and it is safe: undetermined is excluded from the deductible total.
3. **The classifier's signature:**
   ```ts
   classifyExpenseDeductibility(
     expense: { category: ExpenseCategory | null | undefined; context?: ExpenseClassificationContext },
     rules: FiscalRule[],          // pass PFA_2026_SYSTEM_REAL_PACKAGE
     query: { taxYear: number; asOfDate: string },
   ): ExpenseClassification
   ```
   Pass `asOfDate: expense.paid ?? expense.date` — art. 68 alin. (4) lit. b) attributes an expense to the year of **payment**, and the OUG 8/2026 letters only take effect 2026-03-01, so the date is load-bearing, not cosmetic.
   Returns one of: `{ status: 'classified', treatment, category, rule, cap?, condition? }` · `{ status: 'undetermined', category, rule | null, missingFact }` · `{ status: 'refused', rule, reason }`. The `rule` is the justification, so the estimate can name the article behind every line.
4. **Expenses reach the engine as aggregate sums only** (`aggregation.ts` → `projection.ts` → `estimateBasis.ts` → `tax.ts`). 2b must classify **before** aggregation and feed the deductible subset into the assembler — never at a call site (standing rule §2.6: one assembler, two call sites).
5. **`status: 'refused'` must stop the estimate, not be ignored.** If a profile's activity is cazare, the app has no expense engine (B-29); `tax.ts:144` must not run.
6. **Cross-record limits the per-expense classifier cannot enforce** and 2b must apply itself: one vehicle per person (alin. (5) lit. j)), and the annual euro/percentage caps, which are yearly aggregates — `cap_base` names which base each one uses (`expense_itself`, `art68_alin6_base`, `gross_income`, `annual_salary_expense`, `annual_eur_per_person`).
7. **`undetermined` must surface as a count with one action**, naming the missing fact from `missingFact` — never a per-expense form, and never silently deductible.

## 9. Scout infrastructure note

All three Scouts ran with the mandated override `llama-cpp/qwen3.8-flash-next-iq3_s` and all three reported (28m, 19m, 34m). No BLOCKER. Scout B's report is what caught the brief's incorrect claim about `Expense.categoria`.
