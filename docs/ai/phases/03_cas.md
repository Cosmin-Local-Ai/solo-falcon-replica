# Phase 3 — CAS 2026: clamp → floor ladder, plus the art. 150 exemption

Status: **done**. Legal source: `docs/ai/research/07_cas_2026_research.md` (verbatim CF text + sources).
Fiscal source of truth: `docs/ai/phases/02_fiscal_baseline.md` §2 / §2.1. This file records what Phase 3
changed and why; it does not restate the research.

## 1. The law as implemented

SM anchor: CF art. 135^1 alin. (3) — the SM in force on 1 January of the income year governs the annual
bases. SM 2026 = 4,050 lei → 12 SM = 48,600 lei, 24 SM = 97,200 lei. Rate 25% (art. 138 alin. (1)).

CF art. 148 alin. (2): the base is `venitul ales de contribuabil, care nu poate fi mai mic decât` 12 SM
(lit. a)) or 24 SM (lit. b)). That is a **ladder of floors, not a clamp**. Realized income only selects
which floor applies; it is not itself the base. **There is no upper cap.** Contrast CASS art. 170 alin. (1)
(`nu poate fi mai mare decât` 72 SM), which genuinely is a cap and is still implemented as one.

| condition | base | CAS 2026 |
| --- | --- | --- |
| pensioner / insured in own social insurance system — art. 150 alin. (1) | — | **0** |
| cumulated income < 12 SM, no art. 148 alin. (4) election | — | **0** (art. 148 alin. (1)) |
| 12 SM ≤ income < 24 SM | floor 48,600 | **12,150** |
| income ≥ 24 SM | floor 97,200 | **24,300** |
| voluntarily chosen higher base | chosen ≥ floor | 25% × chosen |

The exemption is **art. 150, not art. 147**. Art. 147 is the monthly declarative duty (Declarația 112).
Art. 150 alin. (2) exempts salary earners **only** for art. 137 alin. (1) lit. b^1) (drepturi de
proprietate intelectuală), not lit. b) — so `salaryStatus === 'da'` must NOT exempt a PFA owner.

## 2. Defects fixed

- **B-2** (`calculators.ts` `calcCas`): the flat clamp `min(max(base, min_base), max_base)` with a
  `Math.max(…, min_cas)` floor. Three separate legal errors:
  - income below 12 SM charged 12,150 instead of 0 (over-statement of the whole amount);
  - income in the 12–24 SM band charged 25% of realized income (e.g. 60,000 → 15,000 instead of 12,150,
    an over-statement of 2,850 lei);
  - the `max_base` cap was presented as statutory. Above 24 SM the correct headline is the 24 SM floor
    (24,300), which the old clamp reached only by coincidence.
- **U-5 / Q-CAS-EXEMPTION**: no rule or calculator read `pensionStatus`. Now implemented via
  `CalculatorInput.pensionStatus` at `tax.ts`, with a code comment recording that `salaryStatus` is
  deliberately excluded per art. 150 alin. (2).
- **B-6 (CAS part)**: `max_cas` was declared and read by nothing — the parameter that encoded the phantom
  cap. It is gone; the two floor figures are now `tier1_cas` / `tier2_cas` and `calcCas` actually reads
  them. `max_cass` and the `multiple_*` params are untouched (Phases 4/5).

## 3. Parameter changes (`package2026.ts`, rule `CAS_2026`)

| before | after | note |
| --- | --- | --- |
| `rate` 25 | `rate` 25 | unchanged |
| `min_base` 48,600 | `min_base` 48,600 | id kept — `thresholds.ts` `CAS_MIN_BASE` reads it by string |
| `max_base` 97,200 | `tier2_base` 97,200 | tier-2 **floor**, label says "not a ceiling" |
| `min_cas` 12,150 | `tier1_cas` 12,150 | read by `calcCas` |
| `max_cas` 24,300 | `tier2_cas` 24,300 | read by `calcCas`; **not** a cap |

No label says "Maximum" any more. The calculator reads every floor from parameters — there is no
hardcoded 48,600 or 97,200 in `calculators.ts`. `tax.test.ts` proves this: mutating `tier2_base` to
120,000 moves the boundary and changes CAS at net 100,001 from 24,300 to 12,150.

## 4. `CAS_MAX_BASE` threshold removed

`thresholds.ts` no longer emits a `CAS_MAX_BASE` row. It compared YTD gross revenue to 97,200 and, on
breach, rendered "Peste plafonul maxim al bazei — schimbare de regim": a statutory cap for CAS that does
not exist in art. 148.

Retargeting it to the 24 SM boundary is **not possible without a UI change**, which Phase 3 forbids:
`ThresholdSection.tsx:43` `labelFor` and `thresholds.ts` `breachMeaningFor` are keyed by `ThresholdType`,
so the only available types would label it "Prag maxim CAS" (a cap) or "Prag minim CAS" + "dezcalificare"
(a PFA in tier 1 would show "Depășit" for merely being under 24 SM). A correct surface needs a new
`ThresholdType` plus a UI label — recorded as a follow-up in `docs/ai/PLAN.md`.

The 24 SM floor stays visible in the calculator `breakdown`, which names the applicable floor, the CAS at
each floor, and states that art. 148 alin. (2) provides no upper cap. `max-base` remains in
`ThresholdType` because CASS legitimately has one.

Consequences, all re-pointed rather than weakened: `thresholds.test.ts` now asserts 4 rows, that
`CAS_MIN_BASE` survives at 48,600, and that no `CAS_MAX_BASE` row exists; the max-base breach, warning-band
and breachMeaning tests moved to `CASS_MAX_BASE` (291,600 / 29,160). `e2e/dashboard.spec.ts` asserts 4
`.item-row`s, still asserts `Prag minim CAS` + `Prag: 48.600,00 lei`, and asserts `Prag maxim CAS` is
absent. The assertion on the CAS cap's value (`Prag: 97.200,00 lei`) was deleted, not repurposed.

## 5. `chosenBase` — the elected base is representable, wired to nothing

`CalculatorInput.chosenBase?: number` models the third row of the table: an explicitly chosen base is
honoured, but clamped up to the applicable floor (never `review_required` — the floor is well defined).
It is wired to **no** persisted field, no `schema.ts` change, no profile field and no UI input: Phase 7
owns persisted shape. When the election is implemented it must be its own field, never an override of
realized income. With `chosenBase` absent the headline `value` is `rate × floor`, i.e. the statutory
minimum — 12,150 or 24,300. The `breakdown` states the floor and that a higher base may be chosen
voluntarily, which is the "shown as an option" half of the product decision.

## 6. Out of scope, deliberately not modelled

- art. 148 alin. (4) — voluntary election while below 12 SM (mentioned in the `breakdown`, not computed);
- art. 151 alin. (3) — prorated base for mid-year start/stop;
- art. 148 alin. (3) — cumulation across multiple income sources (the app only carries art. 68 sistem real);
- the `CAS_MIN_BASE` breach wording ("Sub baza minimă — dezcalificare din regim") is shared with CASS via
  `breachMeaningFor(type)`; for CAS, being under 12 SM means no CAS is owed, not disqualification. Fixing
  that needs a type- or tax-specific wording map — UI-adjacent, left for a later phase.

## 7. Verification

`npx tsc --noEmit` 0 errors · `npm run build` exit 0 · `npm run test` 36 files / 463 tests passed
(baseline 450; +13 CAS tests) · `npm run test:e2e` 23 passed. Package unchanged at 8 rules, `version: 1`,
no new ACTIVE rule. CASS, income tax and UI untouched. 48,600 / 97,200 / 291,600 unchanged.
