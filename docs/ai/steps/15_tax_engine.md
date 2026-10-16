# Step 15 — Deterministic Tax Calculation Engine

## Purpose

Implements the 2026 PFA real-system tax formula as a pure, deterministic
domain function: `computeTaxEstimate()`. Given a profile, a
`TaxInputsReference` (Step 14), gross revenues/expenses, and the active
fiscal rule release, it computes CAS, CASS, deductible expenses, net
income, and income tax — or returns `review_required` with a reason when
the inputs fall outside the rule store's computable domain. No UI, no
store, no React.

## Files created/modified

- **`src/domain/tax.ts`** (new) — the engine. Pure domain module: no
  React, DOM, localStorage, or store imports. Consumes
  `TaxInputsReference` from `derived.ts`, calculators from
  `fiscal/calculators.ts`, rule selection from `fiscal/select.ts`, and
  snapshot creation from `snapshots/snapshot.ts`.
- **`src/domain/tax.test.ts`** (new) — 12 boundary tests.
- **`src/domain/fiscal/package2026.ts`** (modified) — `base_limit` parameter
  removed from the income-tax rule (the 16% bracket cap is not specified
  in the baseline; see Unresolved issues). CAS `min_base` corrected to
  48,600 (12 SM annual), `max_base` added at 97,200 (24 SM annual); CASS
  `min_base` corrected to 24,300 (6 SM annual), `max_annual_base` corrected
  to 291,600 (72 SM).
- **`src/domain/fiscal/calculators.ts`** (modified) — `calcIncomeTax`
  no longer requires `base_limit`; applies 10% base rate only, with the
  16% progressive surcharge flagged as REVIEW_REQUIRED in the breakdown.
- **`src/domain/fiscal/index.ts`** (modified) — exports updated to
  reflect the new module layout.
- **`src/domain/fiscal/engine.ts`** (removed) — an earlier draft of the
  engine lived inside the `fiscal/` subpackage. It was moved to
  `src/domain/tax.ts` because the engine is a domain-level orchestrator
  (it consumes `derived.ts` types and `snapshots/` types, not just
  fiscal internals). Keeping it in `fiscal/` created a circular
  dependency risk and mislocated the abstraction. The file was deleted;
  all logic now lives in `tax.ts`.

## Engine design

`computeTaxEstimate(input: TaxCalculationInput): Promise<TaxEstimateResult>`

**Input** (`TaxCalculationInput`):
- `inputs: TaxInputsReference` — Step 14 tax-input reference
- `profile: PfaProfile` — full profile (id used for snapshot provenance)
- `revenues: number` — gross revenue (lei)
- `expenses: number` — gross expenses (lei)
- `ruleRelease: RuleRelease` — the active rule release
- `rules: FiscalRule[]` — the full rule package

**Computation pipeline** (deterministic, order-sensitive):

1. **Input validation** — reject non-finite or negative revenues/expenses,
   missing profile id → `review_required`.
2. **Rule selection** — `selectApplicableRules(rules, { taxYear, asOfDate })`
   filters to rules active for the fiscal year. Look up `cas`, `cass`,
   and `income-tax` rules by `taxRegime`. Missing any → `review_required`.
3. **Regime gate** — `impozit_pe_venit` → `review_required` (the 30%
   deductible limit for this regime is not in the rule store).
4. **Deductible expenses** — `min(expenses, gross)`. Capped at gross revenue.
5. **Net income** — `net = gross − deductible` (net annual business income,
   per the baseline). CAS/CASS are computed on this net, not on gross.
6. **CAS** — `calc-cas(casRule, { base: net })`. 25% rate, minimum base
   floor (48,600 lei = 12 SM annual), maximum base cap (97,200 lei = 24 SM
   annual), minimum CAS amount (12,150 lei), maximum CAS (24,300 lei).
7. **CASS** — only when `socialInsuranceStatus === 'obligatoriu'`.
   `calc-cass(cassRule, { base: net })`. 10% rate capped at the annual
   base limit (291,600 lei = 72 SM), minimum base (24,300 lei = 6 SM
   annual), minimum CASS (2,430 lei), maximum CASS (29,160 lei).
   Non-obligatoriu → CASS = 0 (line recorded).
8. **Taxable income** — `taxable = net − CAS − CASS`.
9. **Income tax** — only when taxable > 0. 10% flat rate applied to all
   taxable income (verified). The 16% progressive surcharge threshold
   (6× national average gross salary) is NOT a fixed statutory number →
   the surcharge portion is REVIEW_REQUIRED. The engine applies 10% flat
   to all taxable income. Taxable ≤ 0 → 0.
10. **Total** — `CAS + CASS + incomeTax`.
10. **Snapshot** — `createCalculationSnapshot()` produces an immutable
    `TaxCalculationSnapshot` with embedded inputs, rule release, lines,
    and output.

**REVIEW_REQUIRED behavior** — returns
`{ status: 'review_required', reason, lines }` when:
- revenues or expenses are negative or non-finite
- profile id is missing
- any of the three required rules is absent from the applicable set
- a calculator returns `reviewRequired` (e.g. CASS base below minimum)
- regime is `impozit_pe_venit` (deductible limit not in rule store)
- (removed) the 200,000 lei guard is no longer needed since the 16% surcharge
  threshold is not a fixed number; income tax is computed as 10% flat on all
  taxable income

**Parameters** — all rates, floors, caps, and limits come from the rule
store (`PFA_2026_SYSTEM_REAL_PACKAGE` via `PFA_2026_TAX_REFERENCE`
release). The engine hard-codes no fiscal parameters.

**Profile dependency** — the profile's `id` is used for snapshot
provenance. Tax-relevant profile fields (regime, socialInsuranceStatus,
fiscalYear) are read from the `TaxInputsReference` (Step 14), not
directly from the profile, keeping the engine decoupled from profile
schema changes.

## TaxCalculationSnapshot shape

Produced by `createCalculationSnapshot()` (Step 12). Fields:

| Field | Type | Source |
|---|---|---|
| `calculationId` | `string` | `calc-<taxYear>-<uuid>` |
| `taxYear` | `number` | rule release |
| `calculatedAt` | `string` | ISO 8601, execution time |
| `ruleRelease` | `RuleRelease` | embedded, not referenced |
| `inputSnapshot` | `CalculationInput` | `{ profile, revenues, expenses }` — embedded |
| `inputsHash` | `string` | SHA-256 of canonical `inputSnapshot` |
| `calculationLines` | `CalculationLine[]` | per-line breakdown (label + value) |
| `output` | `CalculationOutput` | `{ total }` |
| `status` | `SnapshotStatus` | `'computed'` at creation |

The snapshot embeds (not references) the rule release and input data, so
later changes to profile, data, or rules cannot retroactively alter a
stored snapshot.

## Boundary tests added

`src/domain/tax.test.ts` — 16 tests:

| # | Test | Boundary covered |
|---|---|---|
| 1 | Computes CAS + CASS + income tax for a basic profile | Happy path: G=50,000, E=10,000 → net=40,000; CAS=12,150, CASS=4,000, income tax=2,385; total = 18,535 lei |
| 2 | Skips CASS for non-obligatoriu status | CASS = 0 when `socialInsuranceStatus` is not `obligatoriu`; total = 14,935 |
| 3 | Returns REVIEW_REQUIRED when net = 0 | net = 0 → CASS base 0 < 24,300 minimum → review_required |
| 4 | Returns REVIEW_REQUIRED for impozit_pe_venit regime | Regime gate: 30% deductible limit not in rule store |
| 5 | Returns REVIEW_REQUIRED for negative revenues | Input validation: `revenues < 0` |
| 6 | Returns REVIEW_REQUIRED for negative expenses | Input validation: `expenses < 0` |
| 7 | Returns REVIEW_REQUIRED for missing profile id | Input validation: `profile.id` empty |
| 8 | Returns REVIEW_REQUIRED when rules are empty | Rule selection: no applicable rules → all three lookups fail |
| 9 | Creates a snapshot with correct provenance for computed results | Snapshot fields: profile id, revenues, expenses, ruleRelease id, lines, output.total match last line |
| 10 | Returns REVIEW_REQUIRED for zero revenues | CASS calculator rejects base below minimum (0 < 24,300) → review_required |
| 11 | Applies 10% flat income tax at 50,000 net | G=60,000, E=10,000 → net=50,000; CAS=12,500, CASS=5,000, income tax=3,250; total = 20,750 lei |
| 12 | Caps CAS at max_base for high income | G=250,000, E=0 → net=250,000; CAS=24,300 (capped), CASS=25,000, income tax=20,070; total = 69,370 lei |
| 13 | Applies 10% flat income tax above 200,000 (no progressive bracket) | G=300,000, E=0 → net=300,000; CAS=24,300 (capped), CASS=29,160 (capped), income tax=24,654; total = 78,114 lei |
| 14 | Is deterministic for identical inputs | Same inputs → same output, same lines |
| 15 | Computes at 71,280 net (CAS below max_base) | G=71,280, E=0 → net=71,280; CAS=17,820, CASS=7,128, income tax=4,633.2; total = 29,581.2 lei |
| 16 | Computes at 72,000 net (CAS below max_base) | G=72,000, E=0 → net=72,000; CAS=18,000, CASS=7,200, income tax=4,680; total = 29,880 lei |

## Commands run

| Command | Result |
|---|---|
| `npx vitest run src/domain/tax.test.ts` | 16/16 pass |
| `npx vitest run` (full suite) | 9/9 files, 97 tests pass |
| `npx tsc --noEmit` | clean, no errors |

## Results

- `computeTaxEstimate()` is a pure, deterministic domain function with no
  UI/store/React dependencies.
- All fiscal parameters come from the rule store; the engine hard-codes
  no rates, floors, caps, or limits.
- `review_required` is returned (not thrown) for all out-of-domain inputs,
  with a human-readable reason and partial calculation lines.
- Computed results produce an immutable `TaxCalculationSnapshot` with
  embedded inputs, rule release, SHA-256 input hash, and per-line
  breakdown.
- 16 boundary tests pass; TypeScript compilation is clean.

## Unresolved issues

- `impozit_pe_venit` regime returns `review_required` because the 30%
  deductible expense limit is not in the rule store. Adding this rule
  would enable full computation for that regime.
- The CASS minimum base (24,300 lei) means zero-revenue profiles return
  `review_required` rather than a zero-tax result. This is correct
  behavior per the rule store but may need a UI-level explanation.
- The engine does not handle partial-year proration (e.g. mid-year PFA
  registration). This is out of scope for Step 15.
- **Income tax 16% surcharge** — the threshold (6× national average gross
  salary) is NOT a fixed statutory number. The engine applies 10% flat to
  all taxable income. The 16% surcharge portion is REVIEW_REQUIRED pending
  confirmation of the exact statutory wording and the MoF-published 2026
  average salary.
