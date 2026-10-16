# Pre-Phase-11 TASK 1 — the annual tax estimate must be fed the annual projection

**Date:** 2026-10-08 · **Brief:** `docs/ai/briefs/14_task1_projection_estimate.md` · **Baseline HEAD:** `53ca9c4`
**Commits:** `beb4b56` (domain + data + UI) · `8572be9` (tests, e2e, wording hardening) · this docs commit
**Measured at close:** `npx tsc --noEmit` **0 errors** · `npm run test` **49 files / 784 tests passing** ·
`npm run build` **exit 0** · `npm run test:e2e` **36 passed**. Baseline at `53ca9c4` was
0 / 48 files / 760 tests / exit 0 / 36. Every number here was measured by the person writing it.

This is **TASK 1 of four pre-Phase-11 corrections**, not a phase. TASK 2 (expense deductibility),
TASK 3 (tax-reserve persistence) and TASK 4 (threshold semantics) come after and were **not** entered here.

---

## 1. The defect, in one sentence

The dashboard labelled the tax figure an annual estimate — "Estimare impozit", "An fiscal 2026" — while
the engine was fed **totals-to-date**. On the seed dataset in a September fiscal year that meant a
full-year liability was presented as if the year were over: **3.105,00 lei** where the year's own run
rate says **3.239,00 lei** at the end of October.

The annualisation rule already existed in the repo. `src/domain/projection.ts` (`run-rate-v1`, Step 13
Part B) computes it, `FinancialChart` renders it, and `getTaxEstimate` never called it. So this was not
a missing capability; it was **two disconnected halves of the same idea**.

## 2. What was fenced off, and honoured

Not touched: `src/domain/tax.ts` (every formula, every gate), `src/domain/money.ts`, the YTD financial
summary (`getFinancialSummary` → `FinancialSummary`: "Rezumat / Venituri / Cheltuieli / Profit net"),
expense deductibility (TASK 2), reserve persistence (TASK 3), threshold semantics (TASK 4 — see §6, which
records a consequence rather than fixing it). No legal rule, rate, threshold, parameter or citation was
introduced. Every value still traces to the existing rule package.

---

## 3. The model as found — its real semantics, because they are the spec

Read out of `src/domain/projection.ts` before changing anything:

- `selectProjectionV1(data, asOfDate)` → `run rate = YTD / elapsedMonths`, `annual = run rate × 12`.
- `elapsedMonths = (asOfYear − fiscalYear) × 12 + (asOfMonth − 1) + asOfDay / daysInMonth(asOfYear, asOfMonth)`.
  The denominator is a **fraction**, and it is `months > 0 ? Math.max(1, months) : 0`: **floored to 1 inside
  the fiscal year, 0 before the fiscal year start** (malformed → 0).
- Division and multiplication run in `decimal.js-light`; the annual figure is made whole with
  `toBaniNearest` (nearest ban, ROUND_HALF_DOWN) — **deliberately not** `roundArt66`, because art. 66
  rounds sums a taxpayer *owes* and a projection is not one.
- Projected monthly shares are `allocateBani`-allocated so the 12 rows sum exactly to the annual subtotal;
  `net` is **derived by subtraction**, never allocated.
- `series[].kind` already distinguishes `'actual'` from `'projected'`; `method` is `'run-rate-v1'`;
  `runRate` is deliberately **not** branded `Bani`. There is **no `annualActual`**.

**The judgement that mattered most:** the model **annualises a partial year and refuses nothing**. It has
no `status`, no `reason`, no null, no refusal channel. So the brief's instruction — "if the model cannot
honestly project something, the correct output is `REVIEW_REQUIRED` or an explicit actuals-only result" —
could **not** be satisfied by inventing a partial-year refusal, because that would contradict the model
and would have made the current-year dashboard (the normal case) refuse. The one honest guard available
is the model's **own degenerate signal**: `elapsedMonths === 0` means its denominator is zero and every total
is zero. That is the absence of a projection, not a projection of zero, and annualising it would print a
plausible `0,00 RON` annual estimate. That case, and only that case, becomes **actuals-only**.

## 4. The gap that decided the design

The projection model annualised exactly three quantities: `ytd.revenue`, `ytd.expenses`, `ytd.net` — all
**VAT-inclusive**. The engine selects its operands itself (`tax.ts`):

    gross          = vatExempt ? revenues    : revenuesNet
    deductibleBase = vatExempt ? expenses    : expensesNet

The seed profile — and the ordinary PFA — is **not** `vatExempt`. So feeding the projection as it stood would
have annualised the two operands the default profile **never uses**, and left the operative base
(`revenuesNet` / `expensesNet`) an actual while the gross slots were dressed as projected. That is the
worst possible outcome: a projected *label* over an actual *number*.

Fix: `projection.ts` gains `annualProjectedExclVat: { revenueNet, expenseNet }` — **the identical rule, with
the same denominator**, applied to `ytd.revenueNet` / `ytd.expenseNet`.

Two constraints on that extension, both load-bearing:

1. **It is annualised from its own YTD totals, never derived from the VAT-inclusive pair.** Deriving
   `revenueNet` from `revenue` would assume a constant VAT rate across the whole year — a fiscal assumption
   this model does not have and no rule in the package supports. `projection.test.ts` now pins this with two
   datasets that have the **same net turnover and different VAT**: the gross projection moves, the net
   projection does not.
2. **There is no `net` in the new pair.** The engine owns `venitulNetDinActivitate`; a second "net" in the
   domain would be a competing definition, and one of them would eventually be wrong.

No second method, no new annualisation rule, no new fiscal value. `method` is still `'run-rate-v1'`.

## 5. The assembler — `src/domain/estimateBasis.ts` (new)

One module decides what may enter the engine, and **records that decision in the data**:

    TaxEstimateBasis =
      | { kind: 'annual-projected'; method: 'run-rate-v1'; elapsedMonths; actual; projected }
      | { kind: 'actuals-only';    method: null;           elapsedMonths; actual; reason }
      | { kind: 'unknown';         method: null;           elapsedMonths: null; reason }

- `actual` is kept even in the projected case, so a consumer can show or audit both quantities.
- `'unknown'` exists for results that arrived without a basis (a hand-built fixture, the loading sentinel).
  `withEstimateBasis` labels those `unknown` rather than guessing — guessing is how a label ends up claiming
  more than the data supports.
- `TaxEstimateWithBasis = TaxEstimateResult & { basis }` is an **intersection, not a new shape**: it stays
  assignable to `TaxEstimateResult`, so `tax.ts` is untouched and every existing consumer keeps reading
  exactly the fields it read before.
- `buildDashboardData` normalises **once**, so every downstream consumer (snapshot, thresholds, reserve,
  insights) reads the same attributed estimate.

**Both feeds were changed, and that mattered.** There are two YTD→engine paths, not one:
`data/dashboard.ts getTaxEstimate` (the test-facing entry) and `data/derived.ts useLatestTaxEstimate`
(**the live path** the dashboard renders through, via `dashboardAdapter`). Changing only the first would have
made the tests green and the app unchanged. Both now go through `selectTaxEstimateBasis` →
`amountsForEstimate`, so they cannot drift.

## 6. Consequence, recorded and NOT fixed here — the threshold rows

`buildThresholdBases` takes `revenue-*` / `expense-*` from `selectYtd` but takes `net-income` from
`tax.bases.venitulNetDinActivitate`. Since the engine now runs on the annual projection, the four
contribution rows measure the **annual projected VNA** while `VAT_REGISTRATION` in the same row set still
measures **YTD excl-VAT turnover**:

| Row | Before | After (asOf 2026-10-31) |
|---|---|---|
| CAS_MIN_BASE / CAS_TIER2_FLOOR / CASS_MIN_BASE / CASS_MAX_BASE | Curent: 7.494,50 lei | **Curent: 8.993,40 lei** (annual projected VNA) |
| VAT_REGISTRATION | Curent: 7.700,00 lei | **7.700,00 lei — unchanged (still YTD)** |

Arguably more correct — the CAS/CASS floors are annual bases, and the VAT registration threshold is
measured on realised turnover — but it is a **mixing of bases inside one row set**, and a consumer can
misread it. Statuses did not change (2 breached, 3 within limits). **TASK 4 owns threshold semantics**;
this pass deliberately did not touch it. The e2e comment at the Praguri spec points at this section.

## 7. The wording rule

A run-rate projection is an assumption about the rest of the year, not a forecast of fact. So:

- the hero line is `estimateBasisLabel(basis)` — e.g. **"Estimare anuală pe rată de desfășurare (10 din 12
  luni scurse)"** — instead of the bare "ESTIMARE";
- a new hint states: *"Valorile anuale sunt extrapolate din rata de desfășurare a lunilor înregistrate
  până acum (10 din 12). Nu sunt o previziune a cifrelor reale: se ajustează pe măsură ce anul fiscal
  avansează."*;
- `FinancialChart` used to print the literal **"Estimare impozit YTD:"**, which became false the moment the
  basis was annual. It now prints `estimateFigureLabel(basis)`: **"Estimare impozit anuală (rată de
  desfășurare)"** for a projected basis, and **"Estimare impozit YTD"** *only* when the numbers really are
  actuals-to-date. `YTD` is never said about an annual figure.
- The cockpit StatCard label ("Impozit estimat") and its hint ("de pus deoparte") were left alone — they
  are still true, and the e2e pins them exactly.

The three wording functions accept `null` **and** `undefined`: a result that never had a basis attached is a
real case (the mocked adapter fixture hit it immediately), and the honest answer is the neutral label —
never a crash, never a guess.

## 8. Snapshots and the input hash — why there is **no** migration

The brief asked specifically about the hash tier Phase 10 added. Verdict: **no new migration step,
deliberately.**

- `createCalculationSnapshot` digests `CalculationInput = { profile, revenues, expenses }`, where those two
  are the engine's **selected** `gross` / `deductibleBase`. `calculationLines` and `output.total` are outside
  the digest.
- `inputsHash` is therefore a function of the **stored** `inputSnapshot` bytes. Task 1 changes what **future**
  snapshots contain; it changes **no stored byte**.
- Phase 10's id-scoped tier (`migration.ts convertSnapshot`) re-derives `inputsHash` **only when the step
  actually changed the bytes** (`untouched` guard), and keeps `preMigrationInputsHash`. The identity tier has
  the same guard. The load path never re-runs the chain for a current-version payload.
- Adding a tier here would be exactly the **blanket re-hash** the brief forbids: it would rewrite what
  every stored record claims it ever contained. A pre-Task-1 snapshot recorded YTD operands, and its
  digest is still true of those bytes.

Pinned by tests in `src/data/dashboard.test.ts`: a post-Task-1 snapshot's digest verifies against its own
stored `inputSnapshot`; two different as-of dates produce **different digests** (the operands are inside the
record, so the runs are distinguishable in the persisted data, not only on screen); and
`backfillSnapshotIdentity` returns an untouched current snapshot **by identity**, with no
`preMigrationInputsHash` — the guard that makes a new tier unnecessary.

## 9. Figures, old → new (seed dataset, FY2026; every record is September 2026)

Seed YTD: revenueNet **7.700,00 lei**, expenseNet **205,50 lei** (VAT-inclusive: 9.317,00 / 248,66).

| asOf | elapsed | operands into the engine (net / excl-VAT) | total | monthly reserve |
|---|---|---|---|---|
| 2026-09-30 | 9 | 10.266,67 / 274,00 lei | **3.329,00 lei** | — |
| **2026-10-31** (the pinned e2e/unit instant) | **10** | **9.240,00 / 246,60 lei** | **3.239,00 lei** (was 3.105,00) | **1.079,67 lei** (was 1.035,00) |
| 2026-12-31 | 12 | 7.700,00 / 205,50 lei — the identity | **3.105,00 lei — unchanged** | — |
| before the fiscal year | 0 | actuals-only, never annualised zeros | — | — |

Hand-check at 2026-10-31 (elapsed 10 → × 1,2):
VNA 9.240,00 − 246,60 = **8.993,40 lei**; CAS 0 (VNA < 12 SM); CASS owed **2.430** (art. 174 alin. (6)
difference to the 6 SM floor), of which only 10% × VNA = 899,34 → art. 66 → **899,00** is deductible;
base 8.094,40; impozit 10% × 8.094,40 = 809,44 → art. 66 → **809,00**; total 2.430 + 809 = **3.239,00 lei**.
Reserve: 3 months remaining → `divBani(323900, 3)` = 107.967 bani = **1.079,67 lei**.

Other re-pinned figures, all derived the same way and all verified by running the code:

| Site | Before | After |
|---|---|---|
| `src/pages/Dashboard.test.tsx` (50.000 lei net, no expenses) | 20.435 | **22.335** |
| `src/pages/Dashboard.test.tsx` (130.000 lei net) | 46.570 | **51.510** |
| `e2e/dashboard.spec.ts` computed-state fixture (130.000 lei net) | 46.570 | **51.510** |
| `e2e/settings.spec.ts` salaried, salary ≥ 6 SM (20.000 lei net) | 3.800 | **4.560** |
| `e2e/settings.spec.ts` salaried, salary < 6 SM | 4.230 | **4.590** |

The last two rows are the pair worth reading: the difference between them is the **non-deductible** part
of the CASS top-up (art. 118 alin. (2) lit. b)) — 30 lei at the projected base, 430 lei at the YTD base,
because the 6 SM floor is absolute while 10% × VNA grows with the base. The arithmetic did not change;
the operand's basis did.

## 10. Tests — what moved, what was added, and the clock decision

**49 files / 784 tests** (baseline 48 / 760): +13 in the new `src/domain/estimateBasis.test.ts`, +5 in
`projection.test.ts`, +4 in `dashboard.test.ts`, +2 in `FinancialChart.test.tsx`.

New coverage: the excl-VAT annualisation and its "not derived from gross" property; the identity at
elapsed 12; the `elapsedMonths === 0` actuals-only guard; that a different as-of date and a different run-rate
change the operands; that the basis travels on the result and that an unattributed result is labelled
`unknown`; the wording rules; and the snapshot-hash properties in §8.

**No assertion was deleted, no matcher loosened, no timeout widened.** Every changed literal is a figure
that *had* to move, with the arithmetic written out beside it.

**The clock.** An annual run-rate figure is legitimately date-dependent, so pinning a new literal against
the real "today" would be wrong the day after it was written — the B-23 failure class. Both surfaces now
pin the instant instead:

- `e2e/dashboard.spec.ts` and `e2e/settings.spec.ts`: `page.clock.setFixedTime` at **2026-10-31**.
- `src/pages/Dashboard.test.tsx`: `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime` at the same
  instant. Only `Date` is faked, so `setTimeout` and promises stay real and the macrotask wait documented on
  `expectTaxFigure` still behaves. `src/test/wallClockGuard.test.ts` sanctions exactly this: "A test that
  genuinely needs 'now' must inject an instant … or install fake timers explicitly."

**2026-10-31 was chosen, not found.** It makes the model's denominator a whole **10** (9 full months +
31/31), so every expected figure is hand-checkable as **YTD × 12/10 = YTD × 1,2**, and it leaves
`monthsRemaining` at 3 — the same value the real seed date produced, so the reserve arithmetic is unchanged
in kind. The unit-test instant is `2026-10-31T10:00:00Z` = 13:00 Europe/Bucharest, so the Romanian calendar
date cannot shift across a midnight boundary.

## 11. Files changed

| File | Change |
|---|---|
| `src/domain/projection.ts` | +`ProjectionExclVat`, `annualProjectedExclVat`, two extra Decimal rate lines. Nothing else. |
| `src/domain/estimateBasis.ts` | **new** — the basis union, the assembler, the wording functions. |
| `src/data/dashboard.ts` | `getTaxEstimate` feeds the basis operands and returns `TaxEstimateWithBasis`; `buildDashboardData` normalises once. `getFinancialSummary` untouched. |
| `src/data/derived.ts` | the live path `useLatestTaxEstimate` does the same. |
| `src/pages/Dashboard.tsx` | hero label + explanation from the basis. |
| `src/components/FinancialChart.tsx` | the tax note label from the basis. |
| tests | `estimateBasis.test.ts` (new), `projection.test.ts`, `dashboard.test.ts`, `FinancialChart.test.tsx`, `Dashboard.test.tsx` |
| e2e | `dashboard.spec.ts`, `settings.spec.ts` — clock pinned, literals re-derived with the arithmetic in comments |

## 12. What is still open

1. **The threshold base mixing (§6)** — TASK 4.
2. **Every expense is still treated as deductible**, at the projected base as at the YTD base — TASK 2.
3. **The reserve is still recomputed, never persisted** — TASK 3.
4. **A projection has no confidence band and no seasonality.** `run-rate-v1` assumes the rest of the year
   repeats the months so far. That is now stated on screen; it is still a crude assumption, and the model
   carries no `annualActual` to compare itself against.
5. **B-28 stands unchanged**: the cockpit renders the same `—` for "still computing" and for "refused".
   Task 1 did not touch that ambiguity.

## 13. Handoff to TASK 2 — the exact seam

The quantity that enters the engine as the expense figure is **`TaxCalculationInput.expensesNet`** (and
`expenses`, for the `vatExempt` branch). It is assembled in **one place**:
`src/domain/estimateBasis.ts`, `selectTaxEstimateBasis(projection, ytd)` → `amountsForEstimate(basis)`, and
handed over at exactly two call sites: `data/dashboard.ts getTaxEstimate` and
`data/derived.ts useLatestTaxEstimate`.

Today it is `YtdTotals.expenseNet` annualised by `run-rate-v1`
(`projection.annualProjectedExclVat.expenseNet`) — i.e. **100 % of paid expenses, all still treated as
deductible**. TASK 2 should introduce the deductible subset **inside this assembler or upstream of it**,
not at the two call sites, so the live path and the test path cannot drift. The engine's own selection
line (`deductibleBase = vatExempt ? expenses : expensesNet`) is in `tax.ts` and was deliberately left alone.
