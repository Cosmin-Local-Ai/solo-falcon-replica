# PG-5C — the engine is fed recorded actuals, not a run-rate annualisation

**Brief:** `docs/ai/briefs/37_pg5c_actuals_basis.md` · **Register:** B-76 · **Decision:** D-PROJ-1
**Prescription:** `docs/ai/research/26_midyear_start_partial_year_2026.md` §9
**Baseline measured before any change:** `tsc` 0 · 99 files / 1547 unit tests · `build` 0 · e2e 68

Before this phase, `amountsForEstimate` in `src/domain/estimateBasis.ts` chose the engine's operands with
one expression: `basis.kind === 'annual-projected' ? basis.projected : basis.actual`. That expression is
the whole defect. It put a grossing-up inside `computeTaxEstimate`, and because
`buildThresholdBasisProvenance` in `src/data/dashboard.ts` sets the contribution rows' base to the
engine's own `venitulNetDinActivitate`, it put the same grossing-up inside every CAS and CASS threshold
row as well. The projection was not a caption next to the number; it was the number.

CF art. 118 alin. (3) deems the amount realised in a fraction of a year to **be** the annual amount.
Nothing in Titlul IV or Titlul V grosses it up, and the statutory proration for mid-year starters was
deleted from 1 January 2024. So the multiplication had no provision behind it, and it changed which
rules applied — not merely what they were applied to.

---

## The October fixture — before → after

A PFA authorised **1 October 2026**, one invoice of **10.000,00 lei** net with no VAT, no expenses, read
at a fixed clock of **31.10.2026** — one month into a three-month active period.

| | before PG-5C | after PG-5C | the law |
|---|---|---|---|
| venitul net din activitate | **30.000,00 lei** (10.000 × 3, the run rate) | **10.000,00 lei** | 10.000,00 lei — art. 118 alin. (3) |
| CAS (25%) | 0,00 lei | 0,00 lei | none due — 10.000,00 < 12 SM (48.600,00 lei) |
| CASS (10%) | **3.000,00 lei** | **2.430,00 lei** | art. 174 alin. (6) top-up to the 6 SM base, **not prorated** |
| — of which deductible | 3.000,00 lei | 1.000,00 lei | the 1.430,00 lei difference is excluded by art. 118 alin. (2) lit. b) |
| impozit (10%) | 2.700,00 lei | 900,00 lei | 10 % × (10.000,00 − 1.000,00) |
| **total** | **5.700,00 lei** | **3.330,00 lei** | **3.330,00 lei** |

Both columns were measured, not derived: the before column by running this same fixture against the
pre-PG-5C tree, the after column by the passing test. The old figure was 2.370,00 lei too high on a
register of one invoice.

The CASS line is the one to look at, and it does something worse than inflate. On the law's 10.000,00 lei
the net income is **below** the 6 SM floor, so art. 174 alin. (6) applies: 2.430,00 lei is owed and only
1.000,00 lei of it is deductible. On the annualised 30.000,00 lei the net income is **above** the floor,
so the rule switches off entirely and a larger, fully deductible 3.000,00 lei appears. The grossing-up
did not change the size of a contribution; it changed which contribution rule applied. The same mechanism,
crossing the 12 SM level instead of the 6 SM one, is the next section.

## The finding to read loudly: the annualisation manufactured a CAS liability that does not exist

Same October starter, one month further in (**15.11.2026**), with a real expense base — 40.000,00 lei of
revenue and 15.000,00 lei of deductible rent (`rent_business_space`). The three-month period is half
elapsed, so the run rate doubles it.

| | before PG-5C (VNA 50.000,00 lei) | after PG-5C (VNA 25.000,00 lei) |
|---|---|---|
| CAS (25%) | **12.150,00 lei — owed** | **0,00 lei — not owed** |
| CASS (10%) | 5.000,00 lei | 2.500,00 lei |
| impozit (10%) | 3.285,00 lei | 2.250,00 lei |
| **total** | **20.435,00 lei** | **4.750,00 lei** |

Both columns measured against the pre-PG-5C tree and the post-PG-5C tree at the same clock.

The recorded net income is 25.000,00 lei, below the 12 SM level of 48.600,00 lei, so art. 148 alin. (1)
is not met and **no CAS is due**. Doubling three months to six put the taxpayer inside
[12 SM, 24 SM) and made a 12.150,00 lei contribution appear. This is not a line shrinking; it is a line
going from owed to not owed, and it is the reason B-76 was broken out of the queue ahead of PG-6.

The 12 SM, 24 SM, 6 SM and 72 SM figures themselves are **not** prorated — art. 151 alin. (2). A
three-month taxpayer is tested against the same whole-year thresholds as a twelve-month one. The test
`the fixture is not secretly prorated anywhere: the SM multiples stay whole` in
`src/data/partialYear2026.test.ts` pins all four so that a proration cannot come back quietly.

---

## What changed in the code

**`src/domain/estimateBasis.ts` — the pick-off point is gone.** `amountsForEstimate` now returns
`basis.actual` with no branch. The basis union lost `annual-projected` and `actuals-only` and has one
computed member, `recorded-actuals`, which carries `asOfDate`, `closed`, the `actual` pair, and an
optional `forecast` of type `RunRateForecast`.

The enforcement is structural. `EstimateAmounts` — the operand type — carries `asOfDate`. `ForecastAmounts`
is identical except that it does not, because a grossing-up was never measured as of anything. So a
forecast is not assignable to an engine operand and no call site can hand one to `computeTaxEstimate` or
to a threshold base without a cast. That single omitted field is the whole guarantee, and it is why the
two types were deliberately left structurally near-identical rather than merged.

**`src/domain/thresholds.ts` — `MeasuredBasis` lost `'annual-projected'`.** It is not an unused member;
it is a claim that a legal figure was measured on a grossing-up. Because `measuredBasisLabels` in
`src/ui/copy/thresholds.ts` is a `Record<MeasuredBasis, string>`, re-adding the member is a compile error
until someone also writes the sentence that would put it on screen. The surviving annual member is
`'annual-actual'`, rendered as „venit net anual realizat — încasări încasate și plăți plătite, fără
annualizare".

**`src/data/dashboard.ts` — `buildThresholdBasisProvenance` derives the label from the basis the engine
ran on.** `recorded-actuals` gives `'annual-actual'`; a `refused` or `unknown` result gives
`'unattributed'`, and a refused estimate supplies no base at all so the rows fall to `'unmeasured'`. The
label is not written next to the row.

**`src/components/dashboard/ThresholdSection.tsx` — the section now names the date.** D-PROJ-1's
unresolved half was that a mid-year reader cannot tell whether a threshold is settled. The card takes an
`asOfDate` prop — passed in, because a card must not own a clock — and renders
„Valoare măsurată la data de 31.10.2026." through `formatRoCalendarDate` from `src/domain/date.ts`. No
date passed, no line invented.

**`src/pages/Dashboard.tsx` — the forecast moved beside the figure.** It is a separate
`.forecast-aside` block with its own title, „Previziune — nu este o cifră fiscală", showing only the
projected net. It does not compute anything; the model's own `net` is carried on `ForecastAmounts`
rather than re-subtracted at the surface, because a page doing `Bani` arithmetic is how a second,
slightly different net reaches the screen.

**`src/ui/copy/dashboard.ts` and `src/ui/copy/thresholds.ts`** carry the new sentences. `estimateFigureLabel`
in `src/domain/estimateBasis.ts` no longer says „YTD" or „anuală (rată de desfășurare)" — it says
„Impozit calculat din încasări și plăți înregistrate", and „Impozit final pe înregistrările anului" when
`closed` is true.

**Not touched:** `src/domain/tax.ts`, `src/domain/fiscal/calculators.ts`, `src/domain/aggregation.ts`,
`src/domain/date.ts`, the FX modules, the clock helpers, the migration chain, and every rule value,
threshold value, statutory citation and registry entry. This phase changed what feeds the engine, not how
it computes.

---

## Tests that moved, with before → after

Every figure below was derived by hand from the recorded amounts and the 2026 rule package before it was
written down; none was copied out of a failing diff. Where the old comment already named the new number,
it said so.

| test | before | after | why the old figure was wrong |
|---|---|---|---|
| `src/data/dashboard.test.ts` — the engine's operands and bases | VNA 9.189,45 lei; total 3.257,00 lei | VNA 7.580,00 lei; total 3.112,00 lei | the seed's 7.700,00 / 120,00 lei grossed up by 354/292 |
| `src/data/dashboard.test.ts` — „another date is another run rate and another record" | 30 Sep 3.355,00 lei vs 31 Oct 3.257,00 lei | both 3.112,00 lei | one September register, read two months apart, produced two different tax figures, and the earlier date gave the **higher** one. The test was renamed: the drift is the defect |
| same test — `inputsHash` | asserted the two runs **differ** | asserted they are **equal** | two reads of one register now hash identically; the old assertion was a fingerprint of the defect. A changed record still changes the digest, and that is now asserted instead |
| `src/data/dashboard.test.ts` — reserve, no recorded reserve | target 3.257,00; monthly 1.085,67 | target 3.112,00; monthly 1.037,33 | the reserve is derived from the liability |
| `src/data/dashboard.test.ts` — reserve of 1.050,00 lei | remaining 2.207,00; monthly 735,67 | remaining 2.062,00; monthly 687,33 | same |
| `src/data/dashboard.test.ts` — threshold rows | `annual-projected`, 9.189,45 lei | `annual-actual`, 7.580,00 lei | a CAS floor compared against money the taxpayer had not received |
| `src/data/dashboard.yearLifecycle.test.ts` — closed-year figures | `annual-projected`, projected == actual | `recorded-actuals`, `closed: true`, no forecast | the closed year is no longer a case where the projection *happens* to equal the actuals; it is the ordinary case plus the fact that the year is over |
| `src/domain/estimateBasis.annualCaps.test.ts` — art. 68 alin. (6) ceiling at 31 Oct | 186,69 lei excl / 225,90 lei incl; claimed 363,70 lei | 154,00 lei excl / 186,34 lei incl; claimed 300,00 lei | a statutory ceiling that moved with the calendar. The test's discriminator changed: the same register at 31 Oct and at 31 Dec must now give the **same** ceiling |
| same file — protocol 170,00 lei | 186,69 / 206,10 lei | 154,00 / 170,00 lei | same |
| same file — the `Math.max(1, months)` floor at 5 Jan | 240,00 lei excl / 285,60 lei incl | 20,00 lei excl / 23,80 lei incl | twelve times the allowance the year's realised turnover supports, on a register four days old. The floor still shapes the forecast; it no longer shapes a limit |
| same file — before the active period starts | kind `actuals-only`, `elapsedMonths` 0 | kind `recorded-actuals`, `forecast` undefined | the engine runs on actuals in every case, so the state is now "no forecast" rather than a separate basis kind |
| `src/domain/estimateBasis.deductibility.test.ts` — the deductible subset | 2.107,14 lei | 1.000,00 lei | the deductible 1.000,00 lei multiplied by 354/168. The test's point was never the multiplier — it was that the art. 68 subset is applied before aggregation, which the new figure proves more directly |
| `src/domain/estimateBasis.euroCaps.test.ts` — the seed at the e2e clock | 145,48 lei | 120,00 lei | the run rate; no cap and no FX figure moved |
| `src/pages/Dashboard.test.tsx` — 50.000 lei single revenue | 22.452,00 lei | 20.435,00 lei | the old comment already named 20.435,00 lei and called it "the raw YTD operand" |
| `src/pages/Dashboard.test.tsx` — 130.000 lei, two revenues | 51.814,00 lei | 46.570,00 lei | 5.244,00 lei of the old total was the run rate's contribution to an assessment |
| `src/components/FinancialChart.test.tsx` — the tax note | required „Estimare impozit anuală (rată de desfășurare)" | forbids any run-rate label | the wording rule it defended was right; the figure it labelled should never have been a run rate |
| `src/components/dashboard/ThresholdSection.test.tsx` — the basis label | „venit net anual estimat pentru întreg anul" | „venit net anual realizat — …", and the old string asserted absent | the label asserted a projection |
| `e2e/dashboard.spec.ts` — cockpit, hero, reserve | 3.257,00 / 1.085,67 lei | 3.112,00 / 1.037,33 lei | as above |
| `e2e/dashboard.spec.ts` — Praguri rows | 4 × `Curent: 9.189,45 lei` | 4 × `Curent: 7.580,00 lei`, and 9.189,45 asserted absent | as above |
| `e2e/dashboard.spec.ts` — computed tax state | 51.510 lei × 3 | 46.570 lei × 3 | as above |
| `e2e/settings.spec.ts` — salaried PFA pair | 4.560 / 4.590 lei | 3.800 / 4.230 lei | the 430,00 lei art. 174 alin. (6) gap the pair exists to prove survives; only the base it sits on changed |

`src/domain/projection.activePeriod.test.ts` was **not** re-premised. It tests `selectProjectionV1`
directly and pins 30.000,00 lei for an October starter — which is a correct *forecast*, and is exactly
what the model should still say. It is the number's new status that changed, not its value.

## New tests

- `src/data/partialYear2026.test.ts` — the acceptance fixture, six cases: the mid-year figures, the
  closed-year figures, the forecast's status, the threshold rows, the manufactured-CAS case, and the
  un-prorated SM multiples.
- `e2e/partial-year-2026.spec.ts` — the same fixture in the browser: the cockpit and hero at 3.330,00
  lei, the engine's own breakdown lines with CAS at 0,00 RON, the threshold rows at 10.000,00 lei with
  the basis label and the measured-at date, and the forecast aside showing 30.000,00 lei under
  „Previziune — nu este o cifră fiscală". The clock is pinned **inside** the active period on purpose:
  after the year closed the old code already fell back to the actuals, so a 2027 clock would pass against
  the defect.

## The guarantee, not the habit

Acceptance 3 asked for a test that the engine and the thresholds **cannot** receive a projected operand,
not merely that they currently don't. Two:

- `src/domain/estimateBasis.test.ts` — `a forecast amount is not assignable to an engine operand`, with
  `@ts-expect-error` on `const operand: EstimateAmounts = basis.forecast.amounts`. If the `asOfDate`
  guard ever stops working, the `@ts-expect-error` itself fails the test. The same file asserts that
  `amountsForEstimate.toString()` contains `basis.actual` and contains neither `forecast` nor
  `projected` — read off the source, so the function cannot grow a branch back.
- `src/domain/thresholds.test.ts` — `no basis label a row can carry claims a projection`, with
  `@ts-expect-error` on `const forbidden: MeasuredBasis = 'annual-projected'`, plus an assertion that no
  rendered label in `measuredBasisLabels` matches `estimat|proiect|prognoz|rată de desfășurare|run rate`.
  `src/data/dashboard.test.ts` adds the wiring half: a refused estimate leaves every contribution row
  `unmeasured` with a null value.

## The forecast survives, demoted

D-PROJ-1 protects it and the brief forbids deleting it. `selectProjectionV1` is untouched;
`getProjectedFinancialSeries` still produces the monthly series and `annualProjected`; the chart still
draws the dashed projected lines and still drops them, and their legend entry, when the year is closed.
`RunRateForecast` carries `method`, `elapsedMonths` and `activeMonths` so the sentence beside the number
names the same window the arithmetic used — the B-72 lesson. Phase 22 still owes the projected series a
non-colour cue; that was not done here.

---

## Scout process — recorded, not glossed

- **Scout A ran and its report was used.** It covered the consumers of `ProjectionV1`,
  `selectProjectionV1`, `annualProjected`, `run-rate-v1` and the `basis` field, and it verified clean:
  every file and identifier it named existed, and its claim that the e2e specs carried no projection
  references was confirmed independently.
- **Two Scout A payloads and one Scout B payload were delivered before the real reports and were not
  trustworthy.** They named `src/components/dashboard/ThresholdPanel.tsx`,
  `src/components/dashboard/EstimateBasisDisclosure.tsx`, `AttentionRow.tsx`, `ExpenseCoveragePanel.tsx`,
  `LedgerDisclosure.tsx` and `estimateBasis.capUnresolved/foreignCurrency/venitNorma.test.ts`, none of
  which exist — `src/components/dashboard/` contains `ThresholdSection.tsx`, `EstimateCoverage.tsx`,
  `CompletenessSection.tsx`, `DeadlineSection.tsx`, `ActionSection.tsx`, `CurrencySection.tsx`,
  `LegislationSection.tsx` and `YearLifecycleBanner.tsx` — and identifiers (`selectDashboardData`,
  `selectThresholds`, `selectTaxEstimateWithBasis`, `selectInsights`, `selectAttentionRows`,
  `selectContributionStatus`, `selectTaxReserve`, `ThresholdEvaluation`, `EstimateBasisResult`,
  `BasisAmounts`, `targetValue`) that appear nowhere in `src/`. Same contamination class PG-4 recorded.
  None of it reached the code.
- **§12.9 was not followed for Scout A's territory, on the orchestrator's explicit instruction.** After
  three payloads failed the §12.12 check, the orchestrator authorised covering it with a bounded grep
  over the fixed identifier list — `ProjectionV1`, `selectProjectionV1`, `annualProjected`,
  `run-rate-v1` and the `basis` field — with the condition that the hits be followed by reading rather
  than inferred from the match list. Every file that was edited was read before editing. The deviation
  is recorded here rather than presented as if the scout ran.
- **Scout B ran once and verified clean**, covering the threshold evaluation path and the tests that pin
  threshold rows. One apparent miss in its report was my own shell escaping, not an absent identifier.
- **The fabricated names are not noise.** `ThresholdPanel`, `EstimateBasisDisclosure` and a `select*`
  selector layer describe a plausible architecture. Had any change in this phase been *easier* under that
  shape, that would have been the signal to stop; no change was.

## Verification

- `npx tsc --noEmit` — 0 errors.
- `npm run build` — succeeds (the pre-existing recharts chunk-size warning only).
- `npm run test` — **100 files / 1558 tests, all passing** (baseline 99 / 1547: +1 file, +11 tests).
- `npm run test:e2e` — **72 tests, all passing** (baseline 68: +4 functional).
- `src/ui/copy/copy.guard.test.ts` passes with the allow-list still empty; the wall-clock guard passes.
- The completeness card still reads 7/9 at the pinned clock — no completeness figure moved in this phase.

## Left open

- **`research/26` §10.3** remains the highest-priority open gap: the prorating language still present in
  the ANAF edition of the Norme metodologice, and its status after HG 602/2025, is unverified. Nothing in
  the UI claims proration no longer exists in the norms — the wording is scoped to what this app measured.
- **Phase 22's non-colour cue** for the chart's projected series is still owed.
- **B-76's register entry** is closed by this phase; the D-VAT-1 Form 300 path and the unsupported
  scenarios stay with PG-6.
