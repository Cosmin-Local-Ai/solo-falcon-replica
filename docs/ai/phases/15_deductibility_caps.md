# Phase 15 — TASK 2c: the annual / cross-record deductibility caps

**Date:** 2026-10-09
**Brief:** `docs/ai/briefs/17_task2c_annual_caps.md` (including `## ORCHESTRATOR DECISIONS`, which is binding)
**Legal input:** `docs/ai/research/22_deductibility_caps_and_conversion_2026.md` (caps, base, rate, date mechanics)
and research 21 / the TASK 2a rule set. No new legal research was done in this task.
**Depends on:** TASK 2b (`1490bdb`, `docs/ai/phases/14_expense_deductibility_wiring.md`)

---

## 1. What the task was

TASK 2b applied only the per-record 50 % vehicle cap and **excluded everything with a cross-record
base**, counting it `capUnresolved`. That was correct while no base existed. TASK 2c strikes the bases
the sources fully determine, and keeps honest the ones they do not.

The circularity that made this "TASK 2c" rather than a per-record fix: art. 68 alin. (6) defines the
protocol base as „venitul brut și cheltuielile deductibile, **altele decât** cheltuielile pentru acordarea
de burse private și cheltuielile de protocol". The base must exclude the very categories it caps, so it
cannot be struck while a single record is being classified.

## 2. The mechanism: a single two-pass, never an iteration

`selectDeductibleExpenses` (pass 1) classifies every in-period record and now splits the capped ones
into three groups instead of two:

| cap base | where the ceiling is struck |
|---|---|
| `expense_itself` (50 % vehicle haircut) | on the record, as before (unchanged) |
| `art68_alin6_base`, `gross_income` | **held** in `DeductibleExpenseSet.annualCapped` for the assembler |
| `annual_eur_per_person`, `annual_salary_expense` | still excluded, `reason: 'cap_unresolved'`, with the missing datum named |

`selectEstimateOperands` (pass 2) then:

1. aggregates the records that carry **no** annual ceiling — this is the record set alin. (6) asks for,
   because burse private and protocol are absent from it by construction;
2. feeds that same `AppData` to `selectYtd` **and** `selectProjectionV1` (unchanged from 2b: the
   projection re-runs `selectYtd` internally, so both must see one record set);
3. strikes the ceilings and adds `min(claimed, ceiling)` back into the expense operands.

**It is one pass, not a fixed-point loop.** alin. (6) removes protocol and burse private from the base
*entirely*, so the base cannot move when their ceilings are struck, and the two ceilings cannot feed
each other. Pinned by a test that asserts both adjustments report **the same base object**
(`estimateBasis.annualCaps.test.ts`, „burse private is capped at 5 % of the SAME base").

Order inside the pass is forced, not chosen: the lit. q) ceiling is measured on the gross and needs
nothing; the alin. (6) base is measured *after* the other alin. (5) caps (decision 4), so it needs
lit. q)'s answer first.

**Both money measures are capped separately.** `tax.ts:143-144` picks the measure with `vatExempt`
(`gross = vatExempt ? revenues : revenuesNet`, `deductibleBase = vatExempt ? expenses : expensesNet`),
and the assembler does not hold that profile fact. So each ceiling is struck against **its own
measure's gross**, and each measure stays internally consistent with whichever one the engine uses.
No measure is ever mixed with the other's base — that would have been a new B-15-class defect.

## 3. Caps now enforced

| Cap | Rule | Rate / base |
|---|---|---|
| Cheltuieli de protocol | `EXPENSE_PROTOCOL_2026` | 2 % of the art. 68 alin. (6) base |
| Burse private | `EXPENSE_PRIVATE_SCHOLARSHIP_2026` | 5 % of the same alin. (6) base |
| Contribuții profesionale obligatorii | `EXPENSE_PROFESSIONAL_CONTRIBUTION_2026` | 5 % of the gross (lit. q)) |

A ceiling is a ceiling: `capBaniCeiling` floors to the ban (`ROUND_FLOOR`), never `roundArt66` — CF
art. 66 alin. (1) rounds the sums that are **due**, and a cap is neither a sum due nor a base. A base
eaten by other deductible expenses clamps to **0**, never to a negative allowance (a negative ceiling
would *add* to the deductible total).

## 4. Caps that stay unresolved, and the datum each one needs

| Cap base | Rules | Why it stays out | Datum needed |
|---|---|---|---|
| `annual_eur_per_person` | `EXPENSE_PRIVATE_PENSION_2026` (400 EUR, lit. g), `EXPENSE_OCCUPATIONAL_PENSION_2026` (400, g^1)), `EXPENSE_PEPP_2026` (400, g^2)), `EXPENSE_VOLUNTARY_HEALTH_INSURANCE_2026` (400, h), `EXPENSE_SPORTS_SUBSCRIPTION_2026` (100, r), `EXPENSE_PROFESSIONAL_BODY_DUES_2026` (4.000, p), `EXPENSE_ETF_PURCHASE_2026` (400, s) | The rule is settled but the app holds no FX rate, and **the two operative conversion rules conflict**: HG 1/2016 Norme Titlul IV Cap. II Secțiunea a 2-a pct. 7 alin. (6) says BNR **annual average for the payment year**; CF art. 9 alin. (3) lit. b) + alin. (4) say BNR rate **on the payment date**, excepted only by rules „prevăzute expres în prezentul cod" — and the norms are not „prezentul cod". No primary text reconciles them. | A BNR rate **and** a decision on which rule governs. **No rate is hard-coded and none may be.** |
| `annual_salary_expense` | `EXPENSE_SOCIAL_EXPENSES_2026` (5 % of annual payroll, lit. c)) | The app has **no payroll concept**. Research 22 §4 notes that with no personnel the base is arithmetically 0 — but „no data" is not „no employees", so the ceiling is **not declared 0**. | A salary/payroll record (or an explicit "this PFA has no personnel" fact). |
| one car per person (lit. j)) | folded into `EXPENSE_VEHICLE_MIXED_USE_2026` | No primary source selects **which** car carries the cap: the norms for Titlul IV Cap. II never use „autoturism" (zero occurrences), and Registrul-inventar (pct. 7 alin. (8)) identifies goods without choosing one. | A designation rule that does not exist in the sources. **No car is picked.** Only the per-record 50 % haircut of alin. (7) lit. k) is applied — it needs no selection. |

Every one of these is surfaced, not dropped: `ExcludedExpenseRecord.detail` names the datum **and** the
rule, and `src/pages/Expenses.tsx` now renders a banner with that sentence. Pinned in
`src/pages/Expenses.capBanner.test.tsx`.

## 5. The four judgement calls, as taken

1. **Euro conversion conflict — surfaced, not resolved.** Carried as a `conflict` parameter on all seven
   euro rules and interpolated into the exclusion detail. The app converts nothing.
2. **„pentru fiecare persoană" — one cap per taxpayer**, recorded as an interpretation on the six letters
   that carry the wording. `EXPENSE_PROFESSIONAL_BODY_DUES_2026` (lit. p), „în limita a 4.000 euro
   anual") is the one euro letter **without** the per-person wording, so the multiplier question does not
   arise for it — pinned by a test that asserts the interpretation is absent there.
3. **alin. (4) lit. i) (uncapped) vs alin. (5) lit. q) (5 %)** — the cap is applied, and the conflict is
   disclosed on the adjustment (`AnnualCapAdjustment.conflict`).
4. **alin. (6) base before or after the other alin. (5) caps — post-cap reading used**, and the other
   reading is computed and reported (`baseAlt`, `ceilingAlt`) so the delta is on the record.

   **Correction to brief 17's rationale.** The brief says the post-cap reading „yields the smaller base
   and the smaller protocol allowance". It does not: post-cap subtracts the *allowed* lit. q) amount,
   which is smaller than the recorded one, so it leaves a **larger** base and a **larger** allowance.
   Worked example (pinned): post-cap base 7.315,00 lei → protocol allowance **146,30 lei**; pre-cap base
   2.700,00 lei → **54,00 lei**. The *reading* chosen is the binding one and is implemented as instructed;
   the direction is corrected here rather than repeated wrongly. Note the consequence: on this point the
   chosen reading is the **less** conservative of the two, and that is worth knowing before TASK 4.

## 6. The annual-basis decision (the trap)

**Decision: the statutory annual ceiling is struck on the annual quantity the estimate runs on — the
run-rate projection when one exists — and that same annual ceiling also bounds the actuals-to-date
figure recorded in `basis.actual`.**

Reasoning: art. 65 alin. (1) makes the fiscal year the calendar year; art. 68 alin. (4) lit. b)
attributes an expense to the year it was **paid**; pct. 7 alin. (6) pins the rate to the payment year.
So the ceiling is a whole-year number. A payment already made cannot deduct more than the whole year is
allowed to, which is why the annual ceiling bounds `basis.actual` too.

Capping the YTD amount against a YTD base and letting the projection scale it would turn an annual
statutory limit into a per-elapsed-months limit. **Under a uniform run rate the projected figure is
identical either way** — `min()` and the ×12 scaling commute — so the headline number cannot detect the
wrong basis. `basis.actual` can, and that is what the pinning test asserts:

| fixture (2026-10-31, 10 months, ×1,2) | annual basis (implemented) | YTD-struck basis (would fail) |
|---|---|---|
| protocol 300,00 lei — `basis.actual.expensesNet` | **184,80 lei** | 154,00 lei |
| protocol 170,00 lei — `basis.actual.expensesNet` | **170,00 lei** (inside the annual ceiling) | 154,00 lei (cut) |
| both — `amounts.expensesNet` | 184,80 lei | 184,80 lei (identical — which is the point) |

The projection's denominator floor (`denom = max(1, months)`) is pinned too: at 2026-01-05 the annual
figure is YTD × 12, the ceiling follows it (240,00 lei), and a YTD-struck ceiling would have given
20,00 lei.

## 7. FY2026 date gates — fixed on the rule, not the caller

| Gate | Before | After |
|---|---|---|
| lit. g^1)/g^2) — contribuții plătite începând cu 1 martie 2026 | already encoded (`effectiveFrom: '2026-03-01'`) | unchanged |
| lit. s) ETF — „plătite **și decontate** începând cu 1 martie 2026" (art. 10 alin. (7)) | **missing**: the rule inherited `effectiveFrom: '2026-01-01'` and was selectable for a January payment | `effectiveFrom: '2026-03-01'` added. The „decontate" half is **not representable** — `Expense` carries `date`/`paid` only and no settlement concept exists in `src/`; the rule's `note` says so instead of pretending the payment date settles the whole test. |
| pensii facultative — art. 10 alin. (9): the 2026 400 EUR test also counts payments 1 ianuarie–28 februarie 2026 | **missing** | new `cap_counts_payments_from: '2026-01-01'` parameter. It is deliberately **not** `effectiveFrom`: this is which payments the *ceiling* counts, not whether the letter is in force, and `effectiveFrom` would be wrong in both directions. No code reads it yet — the cap it governs is unresolved — but the fact now lives on the rule, and a test pins it. |

No entry-into-force date was hard-coded for Legea 227/2015 or HG 1/2016 (research 22 verified only the
publication dates).

## 8. Figures that moved: none

Re-derived by hand before running, and confirmed by the suite. **No pinned figure changed**, because
neither `seed.ts` nor any e2e fixture holds a protocol, burse private or contribuții profesionale
expense: the seed's three expenses are `postal_and_telecom` (deductible), `personal_or_family_use`
(non-deductible) and `business_space_upkeep` (rejected status). The deductible total for the seed stays
**120,00 lei YTD / 144,00 lei projected at 2026-10-31**, so every downstream figure — VNA 9.096,00 lei,
impozit 819,00 lei, total 3.249,00 lei, reserve 1.083,00 lei, the four threshold rows — is unchanged.

The one assertion that had to change is the one that pinned the old behaviour, and it was **replaced,
not deleted**:

| `estimateBasis.deductibility.test.ts` | before | after |
|---|---|---|
| protocol expense → `counts.capUnresolved` | 1 | **0** |
| protocol expense → `excluded` length | 1 (`reason: 'cap_unresolved'`) | **0** |
| protocol expense → `counts.annualCapped` | (field did not exist) | **1** |
| protocol expense → `records` length | 0 | 0 (unchanged: it must not enter unbounded) |

No assertion was deleted, no matcher loosened, no timeout widened.

## 9. Snapshot digests — no migration, and none needed

`snapshot.ts` digests `profile` + two aggregate numbers (`revenues`, `expenses` = the deductible base),
not record arrays. `AppData` stores **no aggregate at all**, and `seed.ts:101` has `snapshots: []`.
The deductible base is derived at calculation time and frozen into an append-only snapshot. Since the
seed's deductible total is unchanged, **no stored digest moves and no future snapshot content changes
either**. No migration step was added; adding one would have been the forbidden blanket re-hash.

## 10. Files changed

| File | Change |
|---|---|
| `src/domain/estimateBasis.ts` | the two-pass: `AnnualCapLine`, `AnnualCapAdjustment`, `MeasurePair`, `unresolvedCapDetail`, `applyAnnualDeductibilityCaps`, `claimAnnualMeasure`; `selectDeductibleExpenses` holds capped categories instead of excluding them; `selectEstimateOperands` returns `capAdjustments` and an adjusted basis |
| `src/domain/fiscal/deductibility.ts` | `ClassifiedExpense.conflict`, read from the new `conflict` rule parameter |
| `src/domain/fiscal/deductibility2026.ts` | `conflict` + `capCountsPaymentsFrom` spec fields and parameters; five conflict constants; conflicts attached to the seven euro rules, protocol, burse, lit. q), and the vehicle rule; ETF `effectiveFrom: '2026-03-01'`; pensii facultative window parameter |
| `src/pages/Expenses.tsx` | one banner naming the unmeasurable ceilings, with the rule's own sentence for the missing datum |
| tests | **new** `estimateBasis.annualCaps.test.ts` (11), **new** `pages/Expenses.capBanner.test.tsx` (3); `estimateBasis.deductibility.test.ts` 15 → 17; `fiscal/deductibility.test.ts` 26 → 33 |

## 11. Validation (measured, 2026-10-09)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run test` | **53 files / 855 tests passed** (baseline 51 / 832 → +2 files, +23 tests) |
| `npm run build` | exit 0 (chunk 801 kB — was 793 kB; the pre-existing >500 kB warning, unchanged in kind) |
| `npm run test:e2e` | **36 passed** (baseline 36) |

All four run with `set -o pipefail` and the runner's own exit status — no piped `grep`.

## 12. Corrections to brief 17's table

* `annual_per_vehicle` **does not exist** as a `cap_base` token. `CapBase` has exactly five members
  (`expense_itself`, `art68_alin6_base`, `gross_income`, `annual_salary_expense`,
  `annual_eur_per_person`); the one-car limit is prose inside `EXPENSE_VEHICLE_MIXED_USE_2026`, and it
  now also carries the `ONE_CAR_SELECTION_CONFLICT` parameter.
* `EXPENSE_PRIVATE_SCHOLARSHIP_2026` is **not** an `annual_eur_per_person` rule — it is 5 % of
  `art68_alin6_base`. The seven euro rules are the ones listed in §4.
* The post-cap base direction is inverted in the brief's rationale (§5.4 above).

## 13. Still open after this task

* **The euro caps** — one datum (a BNR rate) and one unresolved conflict (pct. 7 alin. (6) vs art. 9).
  Nothing may be computed until both exist.
* **Cheltuieli sociale** — needs a payroll concept, or an explicit "no personnel" fact.
* **One car per person** — unenforceable on the sources read; no designation rule exists.
* **ETF „și decontate"** — no settlement concept in the record model.
* **`cap_counts_payments_from` is written but unread** — it becomes load-bearing only when the 400 EUR
  cap can be struck.
* **B-30 unchanged** — the amount entering the assembler is still `valoareFaraTva`; the VAT half is not
  modelled, so for a VAT-registered profile the deductible amount is still understated.

## 14. Exact implication for TASK 3 (tax reserve)

**The quantity now entering the operands is still `EstimateAmounts.expensesNet` / `expenses`, but it is
no longer a bare sum of records** — it is
`Σ (records with no annual ceiling) + Σ min(claimed, annual ceiling)`, computed in both money measures,
with the annual ceiling struck on the projected figures. For the seed nothing changed: no seed expense
falls in a capped category, so it remains **12.000 bani = 120,00 lei YTD** and **14.400 bani = 144,00
lei projected at 2026-10-31**.

TASK 3 must not re-derive it. The two read sites are unchanged:

* `getTaxReserve` — `src/data/dashboard.ts:199`, `computeTaxReserve(tax, …)` at `:205`
  (`estimatedTaxLiability` set at `src/domain/taxReserve.ts:133`)
* `buildSnapshot` — `src/data/dashboard.ts:298`, `computeTaxReserve(tax, createTaxReserveState(null), …)`

Both consume `tax.output.total`. **The reserve must consume the estimate, never recompute it.** Call
`selectEstimateOperands` and pass `operands.amounts` / `operands.data` to whichever selector is needed;
if TASK 3 ever needs the capped expense figure itself, read `operands.amounts` or
`operands.capAdjustments` — do not re-run the caps, and do not re-project: `selectProjectionV1` already
re-runs `selectYtd` internally, and the ceilings are struck on *its* output.

TASK 3 must not disturb: the `basis` attached by `attachEstimateBasis` (its `actual` / `projected`
expense operands are now cap-adjusted, and `basis.actual` is bounded by the annual ceiling — a reserve
that reads `basis.actual` is reading a legally bounded figure, not a raw YTD sum), and the thresholds
(TASK 4), which read `tax.bases.venitulNetDinActivitate`.
