# Phase 16 — TASK 2d: the alin. (6) base becomes the pre-cap reading, and the post-cap figure becomes visible

**Date:** 2026-10-09
**Brief:** `docs/ai/briefs/18_task2d_precap_base.md`
**Depends on:** TASK 2c (`f1caa36`, `docs/ai/phases/15_deductibility_caps.md`)
**Legal input:** none new. research 22 §6 (the gap) and the user's decision of 2026-10-09 recorded in
`docs/ai/research/23_fx_conversion_and_bnr_rates_2026.md`. No new legal research was done in this task.

---

## 1. What changed, in one sentence

The art. 68 alin. (6) base is now struck **pre-cap** — it subtracts the other alin. (5) capped
categories **as recorded**, not as left after their ceilings — and the post-cap ceiling, which TASK 2c
kept as internal bookkeeping, is now a field the user actually sees.

The decision is the user's, made 2026-10-09, with the explicit condition that the flip must not be
silent. It is not re-litigated here.

## 2. Why the direction matters, and why brief 17 had it backwards

alin. (6) says „venitul brut și cheltuielile deductibile, altele decât cheltuielile pentru acordarea de
burse private și cheltuielile de protocol" and never says whether „cheltuielile deductibile" means the
amounts **as recorded** or the amounts **remaining after** the other alin. (5) ceilings. Research 22 §6
established this is a genuine gap: zero occurrences of „protocol", „ordinea" or „în ordine" in the whole
norms chapter for Titlul IV Cap. II.

Post-cap subtracts the *allowed* lit. q) amount, which is smaller than the recorded one, so it leaves a
**larger** base and a **larger** allowance. Pre-cap subtracts the recorded amount, so it leaves a
**smaller** base and a **smaller** allowance. **A smaller allowance can never cause an underpayment** —
that is the property the chosen reading has and the discarded one does not. (Brief 17's decision table
asserted the opposite direction; phase doc 15 §5.4 corrected it, and this task acts on the correction.)

On the pinned example: **54,00 lei operative** (pre-cap) with **146,30 lei recorded as the alternative**
(post-cap). TASK 2c pinned these the other way round.

## 3. The flip, and what did *not* change

`applyAnnualDeductibilityCaps` (`src/domain/estimateBasis.ts`) Pass B:

```ts
const base = zeroPair();    // operative — PRE-cap: lit. q) subtracted as RECORDED
const baseAlt = zeroPair(); // alternative — POST-cap: lit. q) subtracted as ALLOWED
for (const m of MEASURES) {
  const postCap = nonNegativeBani(subBani(grossOf(annual, m), deductibleOf(annual, m)));
  baseAlt[m] = postCap;
  base[m] = nonNegativeBani(subBani(postCap, subBani(profClaimed[m], profAllowed[m])));
}
```

`ceiling[m] = capBaniCeiling(base[m], percent)` and
`allowed[m] = minBani(claimed[m], ceiling[m])` are untouched, so the whole downstream chain — `annual`,
`actual`, `basis.actual`, the engine operands — follows the new reading automatically.

**The two-pass structure is unchanged.** The base is still struck **once**, after Pass A and before
Pass B, from a deductible total that by construction excludes protocol and burse private. Neither alin.
(6) letter can move it, so there is still no iteration and no fixed point. Pinned by a test asserting
both letters report the same `base` **and** the same `baseAlt`.

`profClaimed` changed status: under TASK 2c it was bookkeeping for the alternative; it is now
load-bearing arithmetic for the operative base. `profAllowed` survives so the post-cap reading can still
be computed.

**Unchanged, deliberately:** which categories are capped, their percentages (2 % protocol, 5 % burse,
5 % lit. q)), which rules carry `capBase: 'art68_alin6_base'`, the `tax.ts` formulas, the floor-to-ban
`capBaniCeiling`, the zero clamp on an eaten base, and the annual-basis decision of TASK 2c.

## 4. The operative base formula, as implemented

For each money measure `m` (`inclVat`, `exclVat`) independently:

```
base(m) = max 0,  gross(m)
                 − Σ (deductible records carrying NO annual ceiling)
                 − Σ (contribuții profesionale obligatorii AS RECORDED)     ← pre-cap
```

i.e. `base(m) = max(0, basePostCap(m) − (profClaimed(m) − profAllowed(m)))`, where
`basePostCap(m) = max(0, gross(m) − deductible(m) after Pass A)`.

The nested `max 0` is deliberate: an expense-heavy period clamps the post-cap base to 0 first, and the
pre-cap base then clamps to 0 as well. A base is never negative, so a ceiling is never negative, so a cap
can never *add* to the deductible total.

The alternative carried alongside it:

```
baseAlt(m) = max 0,  gross(m) − deductible(m) after Pass A      ← post-cap
```

## 5. Where the alternative lives, and what the user now sees

`AnnualCapAdjustment` (`src/domain/estimateBasis.ts:250-273`) — the field names are **role-based**, not
reading-based, so they did not need renaming:

| field | since TASK 2d |
|---|---|
| `ceiling` | the ceiling **actually applied** — struck on the pre-cap base |
| `base` | the base it was struck on — the **pre-cap** base |
| `ceilingAlt` | the ceiling the **post-cap** reading would have given |
| `baseAlt` | that **post-cap** base |

They reach the screen through `EstimateOperands.capAdjustments`. TASK 2c built that array and both
production call sites (`data/dashboard.ts:124`, `data/derived.ts:83`) discarded it. `src/pages/Expenses.tsx`
now calls `selectEstimateOperands` itself — the **same assembler the tax engine runs**, so the ceiling on
the screen and the deductible total the engine used cannot disagree — and renders, for every alin. (6)
ceiling struck:

- the category and the article (`sourceArticle`, plus „din baza art. 68 alin. (6)");
- the **ceiling applied**, labelled with the money measure the engine will actually use
  (`vatExempt` picks the measure at `tax.ts:143-144`; the page shows that one and says which it is);
- the **alternative ceiling under the other reading**;
- the statement that the law does not settle which reading applies — „Legea nu stabilește care lectură
  se aplică — nicio normă nu prescrie o ordine — deci ambele cifre sunt afișate."

The rule's own conflict text (`ALIN6_BASE_ORDER_CONFLICT`, `src/domain/fiscal/deductibility2026.ts`)
flipped with it: it now says „Aplicația citește **pre-plafon** (deduce cheltuielile înregistrate, nu
sumele rămase după plafon) — lectura cea mai puțin generoasă, care nu poate produce subimpozitare — și
afișează și plafonul celeilalte lecturi, post-plafon, pentru că legea nu stabilește care dintre ele se
aplică." That string travels on the adjustment and on the classified expense, so the disclosure is
attached to the number, not parked on a separate screen.

## 6. Figures that moved

**Seed and e2e: none.** Verified rather than assumed. Neither `seed.ts` nor any e2e fixture holds a
protocol / burse private / contribuții profesionale expense, so `claims.length === 0` and
`applyAnnualDeductibilityCaps` returns the basis untouched. Every pinning assertion lives in a file this
task did not modify, and the suite passes:

| figure | pinned at | value |
|---|---|---|
| deductible YTD / projected @ 2026-10-31 | `data/dashboard.test.ts:595,597` | **120,00 / 144,00 lei** — unchanged |
| VNA | `data/dashboard.test.ts:601` | **9.096,00 lei** — unchanged |
| impozit | `data/dashboard.test.ts:604-605` | **819,00 lei** — unchanged |
| total | `data/dashboard.test.ts:605` | **3.249,00 lei** — unchanged |
| rezervă | `e2e/dashboard.spec.ts:120,195` | **1.083,00 lei** — unchanged |

**The pinned cap example moved**, as intended. Old → new, all at 2026-12-31, protocol 1.000,00 / 190,00
lei + contribuții profesionale 5.000,00 / 950,00 lei:

| quantity | before (post-cap operative) | after (pre-cap operative) |
|---|---|---|
| `base` exclVat / inclVat | 7.315,00 / 8.851,15 lei | **2.700,00 / 3.367,00 lei** |
| `baseAlt` exclVat / inclVat | 2.700,00 / 3.367,00 lei | **7.315,00 / 8.851,15 lei** |
| `ceiling` exclVat / inclVat | 146,30 / 177,02 lei | **54,00 / 67,34 lei** |
| `ceilingAlt` exclVat / inclVat | 54,00 / 67,34 lei | **146,30 / 177,02 lei** |
| `amounts.expensesNet` | 531,30 lei | **439,00 lei** |
| `amounts.expenses` | 642,87 lei | **533,19 lei** |
| direction assertion | `ceiling > ceilingAlt` | **`ceiling < ceilingAlt`** |

Cross-check, derived by hand before running: the drop equals the two ceilings apart —
531,30 − 439,00 = 92,30 = 146,30 − 54,00, and 642,87 − 533,19 = 109,68 = 177,02 − 67,34.

No other test file pins a cap number. `estimateBasis.deductibility.test.ts` pins the pass-1 buckets,
which the flip cannot reach; `fiscal/deductibility.test.ts` pins rule metadata and the two conflict
substrings (`'art. 68 alin. (6)'`, `'nicio normă nu prescrie o ordine'`), both of which survive the prose
flip.

## 7. Tests

No assertion was deleted, no matcher loosened, no timeout widened. The only removed lines are the seven
that pinned the **old** reading, each replaced by its flipped counterpart.

| file | before | after |
|---|---|---|
| `estimateBasis.annualCaps.test.ts` | 11 tests | **13** — decision-4 block re-pinned as the TASK 2d block, plus „the alternative ceiling travels on the result object for BOTH alin. (6) letters" and „with no other alin. (5) cap the two readings coincide, and the alternative is still surfaced" |
| `pages/Expenses.capExplanation.test.tsx` | *(new)* | **3** — both figures rendered with the article and the unresolved-reading sentence; the applied figure is strictly the smaller; the alternative still appears when the readings coincide; no explanation is invented when no ceiling was struck |
| `pages/Expenses.capBanner.test.tsx` | 3 | 3 — untouched; its negative assertion (a protocol expense is not reported as *unmeasurable*) still holds, because the new banner uses different copy |

The new UI test pins the **relation** (both figures present, applied < alternative) rather than two exact
amounts, because the page runs on `localDateISO(now())` and the amounts are wall-clock dependent. The
exact amounts are pinned at a fixed date in the domain test.

## 8. Files changed

| File | Change |
|---|---|
| `src/domain/estimateBasis.ts` | Pass B base composition flipped to pre-cap; `base`/`baseAlt`/`ceilingAlt` roles and doc comments corrected; `profClaimed` is now operative arithmetic |
| `src/domain/fiscal/deductibility2026.ts` | `ALIN6_BASE_ORDER_CONFLICT` prose flipped to pre-plafon, stating both readings are shown and why |
| `src/pages/Expenses.tsx` | calls `selectEstimateOperands` and renders the struck alin. (6) ceilings: article, applied ceiling, alternative ceiling, unresolved-reading statement |
| tests | `estimateBasis.annualCaps.test.ts` 11 → 13; **new** `pages/Expenses.capExplanation.test.tsx` (3) |

## 9. Validation (measured, 2026-10-09)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit **0** |
| `npm run test` | **54 files / 860 tests passed** (baseline 53 / 855 → +1 file, +5 tests) |
| `npm run build` | exit **0** (chunk 803 kB — was 801 kB; the pre-existing >500 kB warning, unchanged in kind) |
| `npm run test:e2e` | **36 passed** (baseline 36) |

All four run with `set -o pipefail` and the runner's own exit status — no piped `grep`.

## 10. Snapshot digests

Unchanged, and no migration was added. `AppData` stores no aggregate and `seed.ts` has `snapshots: []`;
the deductible base is derived at calculation time. The seed's deductible total is unchanged, so no
stored digest moves.

## 11. Implication for TASK 10 (currency + FX rate store)

**The euro caps will need the same two-readings-disclosed treatment for the conversion rule itself.**
Research 22 §4 and §5 record two operative and conflicting conversion rules — HG 1/2016 Norme Titlul IV
Cap. II Secțiunea a 2-a pct. 7 alin. (6) (BNR **annual average for the payment year**) vs CF art. 9 alin.
(3) lit. b) + alin. (4) (BNR rate **on the payment date**) — and no primary text reconciles them. TASK 2d
is the template: when the sources do not settle a choice, compute **one** operative figure, carry the
other on the same result object, and render both with the article and an explicit statement that the law
does not settle it. A single `convertEurToRoe` returning one number would repeat exactly the defect this
task closed.

Concretely for TASK 10: the conversion needs a **`basis` parameter** (payment-date rate vs annual average),
the chosen one must be named on the result, the unchosen one must be computed and surfaced, and no rate
may be hard-coded. Note also research 23 §"What must stay unresolved" item 7: the 25.000 euro sistem-real
threshold (TASK 4) is anchored to „anul de realizare a venitului", a **different anchor** from pct. 7 alin.
(6)'s year of payment — one conversion function must not serve both without that parameter.

TASK 10 also owns the `currency` field and all FX code. Nothing was added or stubbed here.

## 12. What TASK 3 must not disturb

`getTaxReserve` (`src/data/dashboard.ts:199`, `computeTaxReserve(tax, …)` at `:205`) and `buildSnapshot`
(`src/data/dashboard.ts:298`) both consume `tax.output.total`. **The reserve must consume the estimate,
never recompute it.** Call `selectEstimateOperands` and pass `operands.amounts` / `operands.data`; if
TASK 3 needs the capped expense figure, read `operands.amounts` or `operands.capAdjustments` — do not
re-run the caps and do not re-project (`selectProjectionV1` already re-runs `selectYtd` internally, and
the ceilings are struck on *its* output).

TASK 2d changed the **value** of `tax.output.total` for any profile that holds a protocol or burse
expense — it went **down**, because the allowance went down. A reserve that recomputes the estimate on a
different base reading would now disagree with the dashboard by exactly the two ceilings apart, and
nothing in the UI would reveal which one is right. That is the concrete reason the consume-don't-recompute
rule matters more after this task than before it.

Also unchanged and still not to be disturbed: the `basis` attached by `attachEstimateBasis` (its
`actual` / `projected` expense operands are cap-adjusted, and `basis.actual` is bounded by the annual
ceiling — a reserve reading `basis.actual` reads a legally bounded figure, not a raw YTD sum), and the
thresholds (TASK 4), which read `tax.bases.venitulNetDinActivitate`.

## 13. Still open after this task

Unchanged from phase 15 §13: the euro caps (one datum + one unresolved conflict), cheltuieli sociale (no
payroll concept), one car per person (no designation rule in the sources), ETF „și decontate" (no
settlement concept), `cap_counts_payments_from` written but unread, and B-30 (the amount entering the
assembler is still `valoareFaraTva`; the VAT half is not modelled).
