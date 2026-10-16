# Phase 25 — TASK 10b: the euro caps compute, and a provisional rate says so

Brief: `docs/ai/briefs/27_task10b_euro_caps_provisional_rates.md`. Handoff from TASK 10a:
`docs/ai/phases/24_currency_fx_store.md` §9 (the money type, the rate record, `convertToRon`,
`FxRateProvider`, `RateStore.replace`, `ExcludedReason: 'foreign_currency'` — none of it re-derived here).
Law and series codes: `docs/ai/research/23_fx_conversion_and_bnr_rates_2026.md`. Why the caps were
excluded in the first place: `docs/ai/phases/15_deductibility_caps.md`.

**Date:** 2026-10-09. **Baseline before any change, measured at `ad3aceb`:** `tsc` 0 · 72 files / 1271
tests · `build` 0 · `e2e` 37 passed. **After:** `tsc` 0 · **77 files / 1332 tests** (+5 files, +61 tests) ·
`build` 0 · **`e2e` 37 passed**. **No money figure moved. No snapshot digest moved. No data version moved.**

---

## 1. What was actually missing

TASK 2c recorded seven annual caps as `cap_unresolved` because the datum they need — *the lei equivalent of
a euro figure* — was not a datum the app held. TASK 10a built the store that can hold it. TASK 10b is the
wire between them: the ceiling is struck from a recorded rate, the record that needed it becomes
measurable, and the state of that rate (provisional or final) travels with the ceiling to the screen.

The distinction that decides the whole design: **the law states the ceiling, and the conversion produces a
different number depending on which law is read.** So the ceiling is not "the euro figure × a rate"; it is
*a reading*, and the other reading has to stay on the record.

## 2. The seven ceilings, enumerated from the rules

Not hardcoded — enumerated by reading the package for a currency-bearing cap parameter. All seven are CF art.
68 alin. (5), and all seven carry the same `conflict` parameter:

| ruleId | category | ceiling as stated |
| --- | --- | --- |
| `EXPENSE_PRIVATE_PENSION_2026` | `private_pension_contribution` | 400 EUR (+ `cap_counts_payments_from: 2026-01-01`) |
| `EXPENSE_OCCUPATIONAL_PENSION_2026` | `occupational_pension_contribution` | 400 EUR |
| `EXPENSE_PEPP_2026` | `pepp_contribution` | 400 EUR |
| `EXPENSE_VOLUNTARY_HEALTH_INSURANCE_2026` | `voluntary_health_insurance` | 400 EUR |
| `EXPENSE_SPORTS_SUBSCRIPTION_2026` | `sports_subscription` | 100 EUR |
| `EXPENSE_PROFESSIONAL_BODY_DUES_2026` | `professional_body_dues` | 4.000 EUR |
| `EXPENSE_ETF_PURCHASE_2026` | `etf_purchase` | 400 EUR |

`capBaseArticle` on each quotes the statute: „în limita **echivalentului în lei** a 400 euro anual pentru
fiecare persoană". The statute asks for a lei equivalent; it does not say which rate produces it. That is
the conflict in §5, and it is why the ceiling is struck rather than looked up.

`cap_counts_payments_from` (OUG 8/2026 art. 10 alin. (9), recorded by TASK 2c as a parameter and read by
nobody until now) is **load-bearing from this task on**: a pensii facultative payment before 1 ianuarie 2026
is excluded from the window rather than folded into a ceiling that does not cover it. Two tests pin both
sides of that date.

## 3. The currency is a property of the amount, not of the calculator

`src/domain/fiscal/deductibility.ts` now reads the cap parameter's **own `unit`** (`capCurrencyParam`) and
carries it as `DeductibilityCap.currency` + `.amount`. `capAmount()` is the only place a rule's foreign
figure becomes money, and it becomes `Money<'EUR'>` — never `Bani`.

**The guard was not weakened.** `paramBani` in `calculators.ts` is untouched and still refuses any unit but
`lei`; the existing test that pins this (`fiscal/deductibility.test.ts`, "no deductibility parameter has
unit 'lei'") is still green. A euro ceiling reaches arithmetic only through `capMoney` → `convertToRon` →
`Bani`, and the path is one-way: `fx/capCeiling.test.ts` asserts the cap is still a euro amount after the
strike, and asserts with `@ts-expect-error` that a lei amount is not a ceiling.

**Currency-generic is not a licence to invent.** CF art. 68 alin. (5) states its ceilings in euro and only
in euro, so the seven above are the whole set and **no USD ceiling exists in this package**. The generic
path exists so a future *verified* non-euro ceiling can use it; `fx/capCeiling.test.ts` proves the generality
with a hand-typed USD ceiling and says in the test name that no rule states one. If a future task finds
itself writing a USD cap into a rule, that is the signal it has invented a legal figure.

## 4. The conversion path — `src/domain/fx/capCeiling.ts`

```text
strikeCapCeiling({ cap, paymentDates, provider })
  ├─ applied     : capCeilingAtPaymentYear  — basis 'payment_year_annual_average'
  │                HG 1/2016 Titlul IV Cap. II pct. 7 alin. (6): the BNR annual average of the
  │                YEAR OF PAYMENT. One lei ceiling per category per year, not per payment.
  └─ alternative : capCeilingAtPaymentDate  — basis 'payment_date_daily'
                   CF art. 9 alin. (3) lit. b) + alin. (4): the rate on the PAYMENT DATE.
```

`CapRateEvidence` carries what produced the number: `rate` as the **printed decimal string** (a double
cannot hold `5.3470`), `citation` from `BASIS_CITATIONS[basis]` and never a paraphrase, `anchor`,
`provisional`, `carriedFrom?`, `seriesCode`, `sourceUrl`, `fetchedAt`.

Refusals are named, not swallowed: `no_payment_date`, `unusable_payment_date`, `ambiguous_payment_year`
(a category paid in two calendar years has no single annual average, and picking one would be picking a
year), `no_rate`. The refusal detail says the average **is not computable from the daily rates** — the
landmine in research 23 item 4: `CURSA_EURM` is an average of the 12 monthly averages, so a mean of daily
rates is a different number, and the app never computes one.

**Rounding stays nearest-ban**, as 10a decided (CF art. 66 whole-leu rounding is not applied to the
conversion product; art. 66's scope for intermediate products is UNVERIFIED). Hand-derived in the tests:
100 EUR × 5,3100 = **531,00 lei**; 100 EUR × 5,3470 (the one rate research 23 actually captured,
2026-10-08) = **534,70 lei**; 400 EUR × 5,0415 (FY2025, a published figure) = **2.016,60 lei**.

## 5. The conflict disclosure — the rule owns the sentence

`EUR_CONVERSION_CONFLICT` is a `conflict` **parameter on each of the seven rules** (TASK 2c's mechanism).
`AnnualCapAdjustment.conflict` carries it to the UI, and `pages/Expenses.tsx` renders it verbatim. No
component writes a sentence about which reading applies, and `src/domain` imports nothing from `src/ui/copy`
— the copy guard's allow-list is still empty and still passes.

Applied figures live on `ceiling` / `base`; the alternative on `ceilingAlt` / `baseAlt` — the same shape
TASK 2d established for the pre-cap / post-cap flip, so the two uncertainties do not need two vocabularies.
When the alternative cannot be struck (payments on different days, no daily rate recorded),
`euro.alternative` is a `{ ok: false, detail }` that **says why**, because an absent alternative reads as an
oversight.

Applying pct. 7 alin. (6) is not a ruling that art. 9 is wrong. The hierarchy stays unresolved.

## 6. The ledger is read in lei — `src/domain/fx/ledger.ts`

`normaliseLedgerToRon(data, provider)` runs once, before the deductibility assembly, and returns a lei copy
of the expenses and revenues plus `conversions: LedgerConversion[]` and `unconverted: UnconvertedLedgerRecord[]`.

* **Expenses convert at the payment date; revenues at the collection date** — art. 68 alin. (2) lit. a)
  attributes income when *încasat*, and art. 9 alin. (3) lit. b) + alin. (4) is not EUR-specific, so it
  carries USD with the same authority as EUR.
* A non-banking day falls back to the carried rate and the conversion records `carriedFrom` — app policy by
  analogy, surfaced through the existing `InterpretationNote`, not presented as statute.
* **No half-conversion:** one missing field keeps the whole record out (`valoareFaraTva` converted and `tva`
  not is a record whose VAT base no longer matches its net).
* **Idempotent:** a RON ledger passes through untouched, and a second pass cannot drift.
* A record with no rate stays `ExcludedReason: 'foreign_currency'` and the exclusion **names the date it
  asked for** — the refusal is a datum, not a shrug.

`EstimateOperands.conversions` carries the conversions to the screen, which shows
`USD · 2026-03-15 · curs 4.5000 · 450,00 RON` beside the record.

## 7. The provisional → final lifecycle (defect B-33)

`provisional` was a field on the rate record and nothing consumed it. Now:

1. `strikeCapCeiling` copies `record.provisional` onto the strike and onto
   `AnnualCapAdjustment.euro.provisional`;
2. `pages/Expenses.tsx` renders `copy.fx.provisionalBadge` / `finalBadge` on the ceiling row and
   `copy.expenses.euroCapProvisionalTail` beside it (`copy.fx.provisionalBadge` was already on the rate
   panel from 10a, via `notes.fxProvisionalAnnual`);
3. the transition is reachable: **`recordFxRate` in `src/data/store.tsx`** upserts into `AppData.fxRates`
   keyed by `rateKey` — the same key `RateStore.replace` and `loadDailyRates` use, so the store, the
   in-memory cache and the persisted payload cannot hold two records for one anchor. An unusable candidate
   returns `{ ok: false, problems }` naming the field, is toasted, and stores nothing: a rate that vanishes
   is indistinguishable from one never entered.

**Proven by replacing the rate and re-reading the ceiling**, at three layers:

| layer | provisional | final |
| --- | --- | --- |
| `fx/capCeiling.test.ts` | 100 EUR × 5,3100 = 531,00 lei | × 5,4000 = 540,00 lei |
| `estimateBasis.euroCaps.test.ts` | ceiling 531,00, `provisional: true` | ceiling 540,00, `provisional: false`, deductible total moves |
| `pages/Expenses.euroCap.test.tsx` | „540,00 RON" absent, „Provizoriu" present | „540,00 RON" present, „Provizoriu" absent |

**Fixture discipline.** BNR publishes no FY2026 average — that is the whole of B-33. Every FY2026 average in
these tests is labelled **test scaffolding**, carries `seriesCode: 'CURSA_EURM-TEST'` and a
`sourceUrl` on `example.invalid`. No test was allowed to *need* a published FY2026 figure; where one would
have needed it, the expectation changed to the provisional behaviour, never the rate.

## 8. USD end to end, and the ingress that was widened on purpose

The Orchestrator's answer to the currency question was **D-FX-5** (`docs/ai/USER_DECISIONS.md`): USD must
work end to end, not merely parse; brief 27 under-specified that and the gap was the Orchestrator's.

* **The store writer is the widening.** `recordFxRate` is manual/store ingress through the existing
  `FxRateProvider` boundary — the same door the provisional → final lifecycle already uses. The brief's
  „no new network path, no crawler, no scheduler" ruled out ingress *from the internet*; **nothing here
  fetches**. This is recorded here rather than left implicit so the next reader does not read it as creep.
* **Daily USD is real:** BNR's XML genuinely carries USD reference rates. **The USD annual-average series
  code is pattern-derived** and keeps its `-PATTERN` suffix and its unverified label exactly as 10a designed
  it (`CURSZ_USD-PATTERN` in the fixtures). A code that looks official will be trusted; an ugly one cannot be.
* **Where USD bites is the record, not the cap** — §6. Proven with a USD expense, a USD daily rate, the lei
  figure (100,00 USD × 4,5000 = **450,00 lei**), the provenance, and the carry-forward note.

## 9. Explicitly out of scope, with reasons

* **The 25.000 euro sistem-real threshold.** Research 23 „What must stay unresolved" item 7: it uses „cursul
  de schimb mediu anual comunicat de BNR, **pentru anul de realizare a venitului**" — the year of income
  realisation, **not** the year of payment. A different anchor, so it must not share a conversion call with
  the caps. `ConversionBasis` is already a parameter, so the follow-up is a **new basis value plus the
  regime-selection question**, not a refactor; regime selection is a boolean today, and wiring it here would
  have been a model change wearing a cap's clothes. Left alone.
* **`cheltuieli sociale` (`EXPENSE_SOCIAL_EXPENSES_2026`).** Its cap is **5 % of the annual value of salary
  expenses** (art. 68 alin. (5) lit. c)) — a percentage of a payroll base the app does not model, not a euro
  figure. Research 23 verified no euro equivalent for it. It stays `cap_unresolved` with the missing datum
  named. **No rate fixes this one**; it needs a wage ledger.
* **Phases 11–34** (`docs/ai/roadmap_11_34_mapping.md`) — not started.

## 10. Validation, and every re-pin

`tsc` 0 · **77 files / 1332 tests** (+5 files, +61 tests: `fx/capCeiling.test.ts` 16, `fx/ledger.test.ts` 10,
`estimateBasis.euroCaps.test.ts` 23, `data/store.fxRates.test.tsx` 6, `pages/Expenses.euroCap.test.tsx` 6) ·
`build` 0 (the pre-existing >500 kB chunk warning stands, unchanged in kind) · **`e2e` 37 passed**
(27 dashboard + 10 settings).

**No money figure moved, verified by running rather than assumed:** deductible **120,00 / 144,00 lei**, VNA
**9.096,00**, impozit **819,00**, clock total **3.249,00**, reserve **1.083,00**, year-end **3.112,00**, hero
**51.510 lei** — every one of those is still pinned green in the e2e suite. The reason TASK 2c gave (no seed
or e2e fixture holds a capped expense) still holds, and `estimateBasis.euroCaps.test.ts` pins it twice: the
seed's deductible total at the e2e clock with no rate recorded, and the seed **with** a FY2026 average
recorded, where the caps are now measurable and the total still does not move because no seed expense is in a
capped category.

**No snapshot digest moved.** `inputSnapshot` is still exactly `{ profile, revenues, expenses }` — aggregate
lei totals — so a currency on a record, a rate in the store and a converted ceiling in the operands are all
unreachable from the hashed bytes. **No data version moved:** `AppData.fxRates` and its `persistedAppDataSchema`
entry already exist from 10a (v10); `store.fxRates.test.tsx` proves the round trip through the load gate
rather than assuming it.

**No assertion deleted, no matcher loosened, no timeout widened.** The only date-helper change is inside
`fx/ledger.ts`, which uses the existing `isISOCalendarDate` so the conversion path and the aggregation path
agree on what a usable date is; `domain/date.ts` was not touched. The wall-clock guard (`test/wallClockGuard.test.ts`)
is green: no new test reads the clock.

**Two test expectations were corrected before they were ever green, both mine, both arithmetic:** the
art. 68 alin. (6) base with a converted ceiling in it is **6.900,00 lei** pre-cap (protocol ceiling **138,00
lei**) against **7.169,00 lei** post-cap (**143,38 lei**) — the first draft read 690,00 lei by dropping three
zeros; and a payment outside the profile's fiscal year is filtered by the period rule (art. 65 alin. (1) /
art. 68 alin. (4) lit. b)), not by the rate, so a FY2025 payment never reaches a FY2026 ceiling at all.

## 11. What Phases 11–34 inherit

* **Measurable now, and at what basis:** all seven CF art. 68 alin. (5) euro ceilings, at the **BNR annual
  average of the payment year** (pct. 7 alin. (6)), with the **payment-date daily** reading struck alongside
  as the alternative. Any foreign-currency **record** (expense or revenue, EUR or USD) is measurable at the
  **daily rate of its payment / collection date**.
* **Still `cap_unresolved`, and why:** `cheltuieli sociale` (needs a payroll base, not a rate), the
  art. 68 alin. (6) percentage caps that depend on bases the app does not hold, and any category whose
  payment dates fall in more than one calendar year (`ambiguous_payment_year`). A missing rate keeps the cap
  unresolved with the currency, the year and the rule named.
* **Provisional is represented** as `provisional: boolean` on the rate record, on `CapRateEvidence`, on
  `CapCeilingStrike` and on `AnnualCapAdjustment.euro`, and it reaches the screen as a badge plus a sentence.
  A rate becomes final only by `recordFxRate` upserting the same `rateKey`.
* **A new conversion basis is a new `ConversionBasis` value with its own citation** in `BASIS_CITATIONS`,
  never a shared call. The 25.000 euro threshold is the known case (year of income realisation).
* **No snapshot digest moved**, so any Phase 11+ work that re-reads stored snapshots sees the same bytes as
  before this task.

---

NEXT HANDOFF: **the seven CF art. 68 alin. (5) euro ceilings are measurable** — 400 / 400 / 400 / 400 / 100 /
4.000 / 400 EUR — struck at the **BNR annual average of the payment year** (HG 1/2016 Titlul IV Cap. II
pct. 7 alin. (6)), with the **CF art. 9 alin. (3) lit. b) + alin. (4) payment-date daily** reading struck
beside them as `ceilingAlt` / `euro.alternative` and the rule's own `conflict` parameter saying the law does
not settle which applies. **Provisional is a boolean that travels** from the rate record to the ceiling to the
badge on the Expenses screen, and it flips only when `recordFxRate` upserts the same `rateKey` — proven by
531,00 lei provisional → 540,00 lei final at three layers. **Still `cap_unresolved`:** `cheltuieli sociale`
(5 % of a payroll base the app does not model; research 23 verified no euro equivalent), the percentage caps
whose base the app does not hold, and any category paid across two calendar years. **No snapshot digest
moved** — `inputSnapshot` is still `{ profile, revenues, expenses }`, no data version moved, and the seed's
deductible 120,00 / 144,00 lei, VNA 9.096,00, total 3.249,00, reserve 1.083,00, year-end 3.112,00 and hero
51.510 lei are all still pinned green. **B-33 is closed.** Phases 11–34 are next and were not started.
