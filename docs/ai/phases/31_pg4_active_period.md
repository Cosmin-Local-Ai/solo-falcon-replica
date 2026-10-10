# PG-4 — the projection's active period, the year lifecycle, and B-71 (brief 34)

Scope as briefed: Phase 12 projection over the PFA's real active period (B-44), the closed-year state,
the D-YEAR-1 year lifecycle (B-58), B-71's coverage denominator, and the two hygiene items. No rule
value, threshold value, statutory citation, registry entry, calculator, migration step, FX module or
test-clock helper was touched.

## What was already true, and was not rebuilt

- `selectRuleSet` in `src/domain/fiscal/registry.ts` already returns `undefined` for a year this build
  registers no release for, and its own comment says returning `undefined` is the point. The only
  release registered is `PFA_2026_RELEASE` (`releaseId: 'PFA_2026_SYSTEM_REAL'`, `taxYear: 2026`,
  `lifecycle: 'ACTIVE'`, `effectiveFrom: '2026-01-01'`, `effectiveTo: null`), registered on
  `defaultRuleReleaseRegistry`. There is no 2027 release and none was invented.
- `computeTaxEstimate` in `src/domain/tax.ts` already refuses when `ruleRelease` is `null`: it returns
  the `review_required` result whose reason names the year („Niciun set de reguli înregistrat pentru
  anul fiscal …"). So the missing-2027 case was already a refusal at the engine. What was missing was
  that nothing on screen said so, and nothing moved the year at all.
- `selectApplicableRules` in `src/domain/fiscal/select.ts` was left exactly as it is; PG-4 needed no
  change to selection logic.
- `revenueFiscalDate` / `expenseFiscalDate` / `inPeriod` in `src/domain/aggregation.ts` were not
  touched. B-71 was a one-call fix in the consumer.
- `profile.pfaStartDate` already existed on `PfaProfile` in `src/domain/models.ts`, and the seed
  fixture already carries `pfaStartDate: '2026-01-19'`. The field was read by the engine only to
  surface CF art. 118 alin. (3); it did not drive the projection. That is what changed.

## 1. The projection runs over the active period (B-44)

`src/domain/projection.ts`:

- `elapsedMonths(fiscalYear, asOfDate)` became `elapsedMonthsFrom(start, asOfDate)`. With
  `start = `${fiscalYear}-01-01`` the expression is algebraically the one the app has always used, so a
  profile with no start date gets the number it got before — that is stated here because it is what
  makes the change safe to make in place rather than as a second projection.
- `activeStartOf(pfaStartDate, yearStart)` takes `max(Jan 1, pfaStartDate)` and falls back to the
  calendar year when the start date is absent or malformed. A malformed start date is not guessed at.
- `activeMonths` is the horizon: `elapsedMonthsFrom(activeStart, `${fiscalYear}-12-31`)`, floored at 0.
  A start on the 19th costs 18/31 of January — the partial first month is a fraction, because no rule
  makes it a whole month.
- The elapsed measure is clamped at both ends: never negative before the active period, never past the
  period's own end. `denom = months > 0 ? Math.max(1, months) : 0` is unchanged, so the floor that
  stops a three-week-old business reading as a twelve-times run rate still holds.
- The annualisation multiplier is `activeMonths`, not `12`, for `annualProjected` and for
  `annualProjectedExclVat`.
- `ProjectionV1` gained `activePeriod`, `activeMonths` and `closed`. `method` stays `'run-rate-v1'`:
  the method is the same rule over a different window, and renaming the literal would have moved
  consumers for a word.

Consequences that are the point of the change:

- A PFA that opened on 1 Oct 2026 with 10.000 lei in October projects to **30.000 lei**, not 120.000.
  Pinned in `src/domain/projection.activePeriod.test.ts`.
- Once the as-of date is past 31 Dec, `elapsed === activeMonths`, so `annual` collapses onto the
  actuals exactly and stops moving day to day. The seed's FY2026 estimate is **3.112,00 lei** at
  2026-12-31, 2027-01-15 and 2027-05-26 — the three rows of the brief's drift table, which used to read
  3.112 / 3.086 / 2.916.
- A PFA whose start date falls after the fiscal year, or after the as-of date, has no run rate at all:
  `activeMonths` or the elapsed measure is 0, the denominator is 0, every projected figure is zero and
  nothing divides. `estimateBasis.ts` then falls back to `actuals-only` — a state, not a number. That
  is pinned in `src/domain/estimateBasis.annualCaps.test.ts`
  („before the active period starts there is no run rate at all, and the engine runs on actuals").

The proration refusal was respected: shortening the projection window changes the projected income and
leaves the 12-SM / 24-SM / 6-SM / 72-SM thresholds alone (CF art. 151 alin. (2)). Art. 151 alin. (3) is
not implemented here and stays separate. The engine's own line
„Fracțiune de an (art. 118 alin. (3)): venit anual" is cited at alin. (3), as required.

## 2. The closed year

`ProjectionV1.closed` is the flag. Two surfaces change wording on it:

- `src/pages/Dashboard.tsx` renders `dashboardCopy.estimate.finalCalculation(year)` over the hero
  figure instead of `estimateBasisLabel(basis)`, and replaces `estimateBasisExplanation(basis)` inside
  the arithmetic disclosure with `dashboardCopy.estimate.finalCalculationNote(date)`.
- `src/components/FinancialChart.tsx` drops the projected legend swatch and renders
  `estimateFigureLabel(tax.basis)` → `finalCalculation(year)` in the note under the graph. For a closed
  year the projection's series is twelve actual months, so there is no projected series to draw.

The new copy lives in `src/ui/copy/dashboard.ts` (`estimate.finalCalculation`,
`estimate.finalCalculationNote`, and the `year` block). The copy guard's allow-list is still empty.

Thresholds measure actual figures in a closed year because the engine's operands *are* the actuals —
pinned in `src/data/dashboard.yearLifecycle.test.ts`, which asserts
`basis.projected.revenuesNet === basis.actual.revenuesNet` and that each contribution threshold's
`currentValue` equals the engine's `venitulNetDinActivitate`.

## 3. The year lifecycle (D-YEAR-1)

`src/data/dashboard.ts` gained `FiscalYearView` (`year`, `closed`, `rulesAvailable`, `currentYear`,
`advanceTo`), the exported `yearAdvanceTarget(profile, instant)`, and a `year` field on
`DashboardData`. `rulesAvailable` is `selectRuleSet(year, asOfDate) !== undefined` — the same selector
the estimate uses, not a second guess.

`src/components/dashboard/YearLifecycleBanner.tsx` is new and is mounted by `src/pages/Dashboard.tsx`.
It does three things and nothing else: writes the automatic advance through `updateProfile`, names a
year with no rule package in words („Regulile pentru 2027 nu sunt încărcate."), and offers the toggle
back to the previous year through the same store path the Settings form uses. There is one fiscal-year
model; the toggle is not a view-local override the estimate would ignore.

**When the advance fires, and when it stands down.** `yearAdvanceTarget` advances only when the clock's
local year is past the stored one **and** the stored profile was last maintained before the boundary —
read from `profile.updatedAt`, which `updateProfile` re-stamps. `updatedAt` is a UTC instant and the
boundary is a Romanian calendar-day fact, so the comparison goes through `localYear`, not through the
string prefix: at 00:30 on 1 Jan 2027 in Bucharest the UTC stamp still reads 2026, and a prefix
comparison would have re-advanced over the toggle-back a second after the person pressed it (this was
caught by `e2e/year-rollover.spec.ts`, not by reading). A deliberate year choice therefore survives a
reload; a stale one does not.

The Settings fiscal-year field is unchanged and remains the other way to set the year.

## 4. B-71 — the coverage denominator follows the money date

`src/domain/completeness.ts` `amountCoverage` filtered revenues with `inPeriod(r.date, …)` while the
expense loop used `inPeriod(expenseFiscalDate(e), …)`. It now uses `revenueFiscalDate(r)`, imported
alongside the two functions already imported from `src/domain/aggregation.ts`.

**PG-1's published completeness figures do not move.** The seed at the pinned instant is still
`recordedBani 790 550 / includedBani 790 550 → 100 %`, and the checks are still 7 of 8, because no PG-1
fixture carries a `collected` date. That is stated rather than glossed: the brief expected these figures
to move, and the honest finding is that they do not.

What does move is the case PG-1 could not get right. Same record — a €5.000,00 revenue documented
2026-12-20 with no BNR rate — read at as-of 2026-12-31:

| the record | before B-71 | after B-71 |
|---|---|---|
| `collected: '2027-01-10'` | recorded 1 290 550 / included 790 550 → **61 %** | recorded 790 550 / included 790 550 → **100 %** |
| no `collected` (document date is the fiscal date) | recorded 1 290 550 / included 790 550 → 61 % | recorded 1 290 550 / included 790 550 → 61 % |

The second row is the control: the fix is not a blanket exclusion. The expense side already behaved this
way and is pinned next to the new cases in `src/domain/completeness.fiscalDate.test.ts`.

## 5. Hygiene

- `src/pages/Settings.tsx` builds the bank-account id with `epochMs()` from `src/domain/date.ts`
  instead of `Date.now()`. A raw wall-clock read in a page is the B-46 class and is the one date in that
  file no fixed clock can pin.
- The two fiscal-date label maps are one. `src/domain/insights.ts` no longer carries
  `FISCAL_DATE_FIELD_LABEL`; it imports `fiscalDateSource` from `src/ui/copy/records.ts`, which already
  keyed the same three values off `FiscalDateField`. The wording that reaches the B-21 attention row for
  the document-date case changes from „data" to „data documentului"; the `collected` / `paid` wording
  the existing test pins is unchanged. The copy layer owns the words, so the domain reads them from
  there.

## Tests that moved, and why

Nothing was re-baselined silently. Every number below is the projection denominator, not a law.

Unit — `src/data/dashboard.test.ts` (seed PFA, active period 11 13/31 months, 9 13/31 elapsed at
2026-10-31, ratio 354/292 instead of 12/10):

| assertion | before | after |
|---|---|---|
| `basis.elapsedMonths` at 2026-10-31 | 10 | 292/31 (9,419…) |
| `basis.elapsedMonths` at 2026-09-30 | 9 | 261/31 (8,419…) |
| `basis.projected.revenuesNet` | lei(9240) | lei(9334.93) |
| `basis.projected.expensesNet` | lei(144) | lei(145.48) |
| `bases.venitulBrut` / `bases.cheltuieliDeductibile` | lei(9240) / lei(144) | lei(9334.93) / lei(145.48) |
| `bases.venitulNetDinActivitate` | lei(9096) | lei(9189.45) |
| estimate total at 2026-10-31 | lei(3249) | lei(3257) |
| estimate total at 2026-09-30 | lei(3340) | lei(3355) |
| threshold `currentValue` (contribution rows) | lei(9096) | lei(9189.45) |
| `remainingTarget` with no reserve | lei(3249) | lei(3257) |
| `recommendedMonthlyReserve` | lei(1083) | lei(1085.67) |
| `remainingTarget` with lei(1050) reserved | lei(2199) | lei(2207) |
| `recommendedMonthlyReserve` with lei(1050) reserved | lei(733) | lei(735.67) |

Unit — `src/domain/estimateBasis.annualCaps.test.ts`:

| assertion | before | after |
|---|---|---|
| `basis.elapsedMonths` at 2026-10-31 | 10 | 292/31 |
| `amounts.expensesNet` / `basis.actual.expensesNet` (protocol 300 lei) | lei(184.8) | lei(186.69) |
| `amounts.expenses` / `basis.actual.expenses` (incl measure) | lei(223.6) | lei(225.9) |
| `capAdjustments[0].claimed` | lei(360) / lei(360) | lei(363.7) / lei(363.7) |
| `capAdjustments[0].ceiling` | lei(223.6) / lei(184.8) | lei(225.9) / lei(186.69) |
| protocol 170 lei: `amounts.expensesNet` / `amounts.expenses` | lei(184.8) / lei(204) | lei(186.69) / lei(206.1) |

The „floors its denominator at 1" case was **not** re-baselined: it now pins a profile that was already
active before the year began (`runWithStart(…, '2025-11-01', …)`), because with the seed's own
2026-01-19 start, 5 Jan 2027-style „first days of the year" is outside the active period. The new
no-run-rate case is added beside it, not instead of it.

Unit — `src/domain/estimateBasis.deductibility.test.ts`: `amounts.expensesNet` lei(2000) → lei(2107.14),
`amounts.expenses` lei(2380) → lei(2507.5) at 2026-06-30 (ratio 354/168).

Unit — `src/domain/estimateBasis.euroCaps.test.ts`: the two „no money figure moves" reads of
`amounts.expensesNet` lei(144) → lei(145.48. No cap and no FX figure moved; the projection did.

Unit — `src/pages/Dashboard.test.tsx`: hero figure `/22\.335/` → `/22\.452/`, and `/51\.510/` →
`/51\.814/`.

e2e — `e2e/dashboard.spec.ts`: cockpit tax card and hero `3.249,00 RON` → `3.257,00 RON`; „Rămâne de
pus deoparte" `3.249,00 RON` → `3.257,00 RON`; „Rezervă lunară" `1.083,00 RON` → `1.085,67 RON`; the
four contribution threshold rows `Curent: 9.096,00 lei` → `Curent: 9.189,45 lei`.

e2e — `e2e/payment-dates.spec.ts`: the FY2026 read at mid-2027 `2.885,00 RON` → `3.112,00 RON`. That is
the drift fix, not a regression: a closed year is now computed from actuals, so mid-2027 gives the same
figure 31 Dec 2026 gave.

**Fixture change, stated because it is a semantic change.** The FY2025 fixture in
`e2e/dashboard.spec.ts` and the mid-2027 fixtures in `e2e/payment-dates.spec.ts` now stamp
`profile.updatedAt` after the year boundary. A profile that names an old fiscal year and was last
maintained before the boundary is exactly what D-YEAR-1 tells the app to advance, so an *intentional*
old-year view has to be expressed as a choice made after the boundary. Without that, those fixtures
were advanced to the current year on load and rendered an empty register — which is the lifecycle
working, not a chart bug.

## Tests added

- `src/domain/projection.activePeriod.test.ts` — October start projects to year end; partial first
  month is a fraction; no start date reproduces the old calendar behaviour; a start before the year does
  not shorten the window; a malformed start is not guessed at; the closed year gives the same projection
  on 31 Dec / 15 Jan / 26 May and collapses onto the actuals; a start after the year, a start after the
  as-of date, an empty register and a loss-making year produce zeros and never NaN; `elapsed ≤ active ≤
  12` across a sweep; a leap-year window counts the real days of February.
- `src/data/dashboard.yearLifecycle.test.ts` — `yearAdvanceTarget` in all four states; the closed 2026
  year viewed from 2027 is closed and still has its rules; a year with no rule package yields
  `review_required` naming 2027 and no computed figure; the three drift dates agree.
- `src/components/dashboard/YearLifecycleBanner.test.tsx` — the missing-rules sentence and the toggle
  write the year through the store; the automatic advance writes and says so; a closed year is labelled
  closed and can be left; an open, current, covered year says nothing.
- `src/domain/completeness.fiscalDate.test.ts` — the B-71 cases above, plus the expense-side control.
- `src/components/FinancialChart.test.tsx` — a closed year draws no projected series, drops the
  projected legend, and names the figure as a final calculation.
- `e2e/year-rollover.spec.ts` — three browser tests: the advance plus the named missing rules plus no
  invented figure (the hero and the cockpit card carry the em dash, and the closed year's 3.112,00 lei
  appears nowhere while the year reads 2027); the toggle back to 2026 works, is labelled
  „Calcul final pentru 2026", and survives a reload; the closed-year figure is identical at 31 Dec 2026
  23:30, 15 Jan 2027 and 26 May 2027 with no „N din 12" for N over 12 anywhere.

## Decisions

1. **„Hero from actuals only" was read as the closed-year state.** For a closed year the hero is the
   year's actuals, labelled and dated, and the forecast is gone from the chart. For an open year the
   estimate remains the run-rate projection — that is the Phase 12 decision PG-1's coverage model and
   the art. 68 alin. (6) annual ceilings depend on, and the basis label already refuses to let a
   projected figure read as collected money. If the brief meant that the engine must never consume a
   projected operand even mid-year, that is a different and much larger change and it is flagged here
   rather than assumed.
2. **The automatic advance is persisted, and it yields to a deliberate choice.** A view-only year
   override would have made the estimate, the thresholds and the ledger disagree about which year they
   were describing. Persisting through `updateProfile` keeps one model; the `updatedAt` test is what
   makes the toggle back real.
3. **No 2027 rule package was invented and no threshold was prorated.** The missing year yields
   `review_required` plus the banner sentence, at the data layer and on screen.
4. **`estimateState` was not changed.** `closed_final` remains declared and untriggered; PG-6 owns that
   trigger. PG-4 labels a closed year through `FiscalYearView.closed`, which is a different question
   from the estimate's status union.
5. **The chart stays per-year.** No 24-month series was built. The obligation crosses the boundary; the
   series does not.

## Findings handed forward

- **The basis label still says „din 12 luni".** `estimateBasisLabel` / `estimateBasisExplanation` in
  `src/domain/estimateBasis.ts` embed `basis.elapsedMonths` in „(N din 12 luni scurse)". The elapsed
  measure is now clamped so N is never over 12, but for a mid-year PFA the „din 12" half describes the
  calendar year while the projection runs over `activeMonths`. Fixing the sentence means editing
  `estimateBasis.ts`, which is outside PG-4's boundary. Not date-shaped; belongs with the next phase
  that touches the basis wording.
- **The year banner is mounted on the dashboard only.** The automatic advance therefore happens the
  first time the dashboard is opened in the new year, not on any other route. Deliberate — the dashboard
  is the landing route and the banner belongs where the figure is — but it is a boundary worth knowing.
- **`refused` still has no trigger.** PG-4 declared nothing new in the status union and produced no
  `refused`; that stays with PG-6.
- **A profile whose `pfaStartDate` is after the fiscal year projects nothing.** That is the honest
  reading of a start date that postdates the year, and it is pinned; but it means an old-year view of a
  profile with a later start date is a zero-run-rate state rather than a calendar-year projection. If a
  later phase wants records themselves to widen the window, that is a decision to make explicitly.

## Scout process — recorded, not glossed

- Scout A (`ProjectionV1` / `selectProjectionV1` / `elapsedMonths` consumers) and Scout B (the rule
  release registry and `selectRuleSet`) ran and reported, and their reports were used. Scout A's report
  arrived after roughly twelve minutes; the blast-radius list it produced is what the edits followed.
- **§12.9 rule 3 was not followed for Scout C** (run-rate wording and the projected series). The scout
  panes were being terminated externally; the orchestrator explicitly authorised covering Scout C's
  territory with a bounded grep over the files Scout A had already named, and required that the
  deviation be recorded here rather than presented as if the scout ran. The files grepped were the ones
  Scout A named — `src/domain/projection.ts`, `src/data/derived.ts`, `src/data/dashboard.ts`,
  `src/components/FinancialChart.tsx`, `src/domain/estimateBasis.ts`, `src/domain/taxReserve.ts`,
  `src/pages/Dashboard.tsx`, `src/ui/copy/dashboard.ts` — plus the run-rate wording strings
  („din 12", „luni", „scurse") searched across `src/` and `e2e/` to confirm nothing else carried them.
- **Two payloads were delivered into the worker's context before the real reports arrived and were not
  trustworthy.** They named `src/components/Breakdown.tsx` and `src/pages/Inspect.tsx`, which do not
  exist in this repository, and a rule registry with release ids `2026-baseline-v1` and
  `2024-legacy-v1`, neither of which is registered in `src/domain/fiscal/registry.ts`. Everything from
  them was re-verified against the tree before use; none of it reached the code.
- **How the scout failure looked:** `scoutC` exited without output after about eight seconds. There was
  no kernel OOM evidence on this host (`dmesg` showed no killed processes; `free` reported ~27,6 GiB
  available of ~30 GiB), so this does not look like the ~390 MiB memory ceiling in §12.6 — it looks like
  the known silent-exit defect, the same class as the 3-of-5 silences recorded in PG-0. The long
  successful run and the two fabricated-looking payloads are the more useful signal: scout output needs
  to be treated as unverified until it is checked against the tree.

## Verification

- `npx tsc --noEmit` — 0 errors.
- `npm run build` — succeeds (the pre-existing recharts chunk-size warning only).
- `npm run test` — **97 files / 1507 tests, all passing** (baseline 93 / 1474: +4 files, +33 tests).
- `npm run test:e2e` — **61 tests, all passing** (baseline 58: +3 functional; 58 functional + 3 axe).
- `src/ui/copy/copy.guard.test.ts` passes with the allow-list still empty.
- `src/test/wallClockGuard.test.ts` passes; the only new clock reads go through `now()` / `epochMs()`
  or take an injected instant.
