# WORKING NOTES - TASK 1 (projection feeds the annual tax estimate)

SCRATCH/WORKING FILE, not the deliverable. The deliverable is
docs/ai/phases/12_projection_annual_estimate.md (NOT YET WRITTEN - an e2e comment already
references it, so it MUST be created).

Repo: /home/agent/workspace/solo-falcon-replica. HEAD at start: 53ca9c4.
Brief: docs/ai/briefs/14_task1_projection_estimate.md

## 0. The task
Make the user-facing ANNUAL tax estimate be fed the ANNUAL PROJECTION instead of raw YTD totals,
while the YTD financial summary stays YTD and unchanged. Wording must not imply more certainty than
a run-rate assumption carries. Actual vs projected must be distinguishable IN THE DATA. No formula
changes in src/domain/tax.ts, nothing in src/domain/money.ts. Out of scope: expense deductibility
(TASK 2), tax-reserve persistence (TASK 3), threshold semantics (TASK 4).

Report format: COMPLETED / FILES CHANGED / TESTS / VALIDATION / DECISIONS / BLOCKERS / NEXT HANDOFF.
NEXT HANDOFF must tell TASK 2 which quantity enters the engine as the expense figure and where.

Baseline: tsc 0; npm run test = 48 files / 760 tests; npm run build 0; npm run test:e2e = 36.
Scripts: test = vitest run, build = tsc && vite build, test:e2e = playwright test.

## 1. Scout findings
Scouts only work with model override "qwen3.8-flash-next-iq3_s"; the default scout model exits
without output (known defect) - worked around by override, reported not hidden.

### A. src/domain/projection.ts (was 154 lines; 21 tests in projection.test.ts)
- selectProjectionV1(data, asOfDate) -> ProjectionV1. Rule: run rate = YTD / elapsedMonths;
  annual = run rate x 12.
  elapsedMonths = (asOfYear-fiscalYear)*12 + (asOfMonth-1) + asOfDay/daysInMonth(asOfYear,asOfMonth).
  denom = months > 0 ? Math.max(1, months) : 0  -> floored to 1 inside the FY, 0 before FY start
  (NaN -> 0).
- decimal.js-light for div/mul; toBaniNearest (ROUND_HALF_DOWN, nearest ban, NOT roundArt66);
  monthly projected shares via allocateBani; net derived by subtraction, never allocated.
- IT ANNUALISES A PARTIAL YEAR; IT REFUSES NOTHING. No status/reason/null. Degenerate input ->
  elapsedMonths === 0, all-zero rates and annualProjected, 12 all-projected zero months.
- Output: periodActual, runRate (unbranded number, deliberately NOT Bani),
  annualProjected: Totals{revenue,expenses,net} (Bani), series with kind 'actual'|'projected',
  method 'run-rate-v1', elapsedMonths. NO annualActual.
- Originally annualised ONLY the VAT-inclusive trio; never read ytd.revenueNet/expenseNet.
- Callers before change: data/dashboard.ts:11,71-72 (getProjectedFinancialSeries),
  domain/derived.ts:11,42,90, components/FinancialChart.tsx, tests. tax.ts had ZERO coupling.
  e2e had zero references (only a comment at dashboard.spec.ts:521).

### B. Tax data flow
- Engine input type is TaxCalculationInput: {inputs, profile, revenues, expenses, revenuesNet,
  expensesNet, ruleRelease, rules}, money as Bani.
- computeTaxEstimate is async (B-27) and selects internally:
  gross = vatExempt ? revenues : revenuesNet; deductibleBase = vatExempt ? expenses : expensesNet
  (tax.ts ~118-121/144). Seed profile vatExempt:false -> OPERATIVE OPERANDS ARE revenuesNet /
  expensesNet.
- TaxEstimateResult = {status:'computed', lines, output, snapshot, bases: TaxAmountBases,
  lossCarryForward?} | {status:'review_required', reason, lines}.
- TWO FEEDS, BOTH HAD TO CHANGE: data/dashboard.ts getTaxEstimate (TEST-ONLY) and
  data/derived.ts useLatestTaxEstimate (THE LIVE PATH, via dashboardAdapter's
  "estimate ?? LOADING_TAX").
- getFinancialSummary (dashboard.ts:63-65) -> selectYtd -> Dashboard.tsx:43 ->
  FinancialSummary.tsx ("Rezumat / Venituri / Cheltuieli / Profit net"). Shares only selectYtd.
  UNTOUCHED.
- buildThresholdBases: revenue-*/expense-* from selectYtd; net-income from
  tax.bases.venitulNetDinActivitate -> the 4 contribution rows inherit the engine's basis; the VAT
  row stays YTD. Sharpest consequence (see section 5).
- computeTaxReserve uses tax.output.total; recommendedMonthlyReserve = divBani(remainingTarget,
  monthsRemaining); monthsRemaining = 13 - month inside the FY.
- insights.ts:261-277 reads status + output.total; emits "Estimarea totala a impozitului: {X}."
  (e2e pins the text, not the number). completeness.ts taxEstimate check reads data.snapshots.
- store.addSnapshot has NO production caller; seed.ts:87 snapshots: [].

### C. Pinned assertions
- Real migration file is src/data/migration.ts (the brief's migrations.ts does not exist).
  DATA_VERSION_BASE 0 ... DATA_VERSION_MONEY_BANI 5 = CURRENT_DATA_VERSION. Phase 10 id-scoped tier
  = convertSnapshot (migration.ts:387-421): re-derives inputsHash ONLY when
  inputSnapshot.revenues/expenses/profile changed ("untouched" guard), keeps
  preMigrationInputsHash ?? inputsHash; identity tier guard at :253; load path never re-runs the
  chain for a current-version payload.
- Hash inputs: CalculationInput = {profile, revenues, expenses} = the engine's SELECTED
  gross/deductibleBase (tax.ts:315,338). calculationLines and output.total are OUTSIDE the digest.
  serialize.ts writes numbers as String(value).
- Only real hex literal: hashSync.test.ts:40. No .snap files anywhere.
- e2e pins before change: 9.317,00 RON (YTD, must NOT move), 3.105,00 RON x3, 1.035,00 RON x2, the
  reserve sentence, /Curent: 7.494,50 lei/ x4, /Curent: 7.700,00 lei/ x1, /Curent: 9.317,00 lei/ x0,
  Depasit 2 / In limite 3, 8/9, all "Prag:" statutory values, /46.570/ x3, settings /3.800/ and
  /4.230/.
- "1.350" DOES NOT EXIST ANYWHERE IN THE REPO - the brief's landmine number is wrong; the reserve
  card pins 1.035,00 RON.
- FinancialChart.test.tsx:170 pins /Estimare impozit YTD/; :180 pins "revizuire necesara - {reason}".
- Dashboard.test.tsx:133 pins /20.435/, :181 pins /46.570/, :203 pins em dash.
- dashboard.test.ts "acceptance 6" (~322-342) pins bases lei(7700)/lei(205.5)/lei(7494.5), six
  engine lines, total lei(3105) - all via getTaxEstimate(seedData,'2026-12-31') -> elapsed 12 ->
  UNCHANGED (verified by running the code).
- wallClockGuard.test.ts forbids zero-arg Date/Date.now() in src/**/*.test.{ts,tsx} only (e2e is not
  scanned); asserts file count > 30. No test asserts total test counts.

## 2. Judgement calls (must appear in DECISIONS:)
1. The model's semantics are the spec: it annualises a partial year and refuses nothing, so I did
   NOT invent a partial-year refusal. The only honest guard is the model's own elapsedMonths === 0.
2. THE GAP THAT DECIDED THE DESIGN: the engine's operative operands for the default non-vatExempt
   profile are revenuesNet/expensesNet, which the model did not annualise. Feeding projection as-is
   would dress the UNUSED gross slots as projected and leave the operative base an actual. So I
   extended projection.ts with annualProjectedExclVat: {revenueNet, expenseNet}, applying the
   IDENTICAL run-rate-v1 rule and the same denominator to ytd.revenueNet/expenseNet - annualised
   FROM THEIR OWN TOTALS, never derived from the VAT-inclusive pair (deriving them would smuggle in
   a constant-VAT-rate assumption no rule supports). One deliberate extension; no second method, no
   new annualisation rule, no new fiscal value.
3. elapsedMonths === 0 -> explicit "actuals-only" basis, never an annualised zero.
4. The basis rides on the result as an intersection type (TaxEstimateWithBasis = TaxEstimateResult
   & {basis}), so tax.ts is untouched and every existing consumer keeps compiling.
5. NO SNAPSHOT HASH MIGRATION - DELIBERATELY. The digest is a function of the STORED inputSnapshot
   bytes; Task 1 changes no stored byte, only what FUTURE snapshots contain. Adding a tier would be
   exactly the blanket re-hash the brief forbids. Must be pinned by a test and explained in the doc.
6. e2e determinism: an annual run-rate figure is legitimately date-dependent, so a new literal
   against the real "today" would rot (the B-23 class). I pinned the BROWSER CLOCK
   (page.clock.setFixedTime) at 2026-10-31, where the denominator is a whole 10 and monthsRemaining
   is still 3. No assertion deleted, no matcher loosened, no timeout widened.

## 3. Numbers (measured by running the code, not hand-waved)
Seed YTD (any asOf >= 2026-09-25 in FY2026; all seed records are Sept 2026, only 'inregistrata'):
revenue 931700, expenses 24866, revenueNet 770000, expenseNet 20550 bani.

  asOf        elapsed  projected rev/exp/revNet/expNet (bani)  basis           total            bases brut/deduct/VNA
  2026-09-30     9     1242267/33155/1026667/27400             annual-projected 332900=3.329,00  1026667/27400/999267
  2026-10-31    10     1118040/29839/924000/24660              annual-projected 323900=3.239,00  924000/24660/899340
  2026-12-31    12     == YTD (identity)                       annual-projected 310500=3.105,00  770000/20550/749450
  2025-06-15     0     0                                       ACTUALS-ONLY     0                0/0/0

At 2026-10-31 thresholds: CAS_MIN_BASE breached 899340/4860000; CAS_TIER2_FLOOR ok; CASS_MIN_BASE
breached 899340/2430000; CASS_MAX_BASE ok; VAT_REGISTRATION ok 770000/39500000 (STILL YTD).
Statuses unchanged -> Depasit 2 / In limite 3 still hold.

Hand-check at 2026-10-31 (elapsed 10 -> x1,2): VNA 9.240,00 - 246,60 = 8.993,40; CAS 0 (<12 SM);
CASS owed 2.430 (art. 174 alin. (6) top-up); CASS deductible 899,34 -> art. 66 -> 899; base 8.094,40;
tax 809,44 -> art. 66 -> 809; TOTAL 2.430 + 809 = 3.239 lei. Reserve: monthsRemaining 3 ->
divBani(323900,3) = 107967 = 1.079,67 RON.

e2e computed-state fixture (50.000 + 80.000 lei net, no expenses, Feb/Mar 2026): YTD revNet 130.000
-> at elapsed 10 -> 156.000; CAS 24.300 (>=24 SM), CASS 15.600, base 116.100, tax 11.610 ->
TOTAL 51.510 (was 46.570).

settings salaried fixture (revNet 30.000, expNet 10.000, VNA 20.000 -> at elapsed 10: 36.000/12.000,
VNA 24.000): salary 30.000 (>=6 SM) -> CASS 2.400, base 21.600, tax 2.160 -> TOTAL 4.560 (was 3.800).
salary 20.000 (<6 SM) -> CASS 2.430 owed, nonDeductible 30, deductible 2.400, base 21.600, tax 2.160
-> TOTAL 4.590 (was 4.230).

Live cockpit at the real sandbox date (2026-10-08, elapsed 9.2580645) would be 3.304 lei - pinned
nowhere, which is why the clock pin matters.

## 4. DONE (all applied; npx tsc --noEmit = 0 at this point)
1. src/domain/projection.ts - added ProjectionExclVat{revenueNet,expenseNet},
   ProjectionV1.annualProjectedExclVat, rate.revenueNet/rate.expenseNet Decimal lines, and the
   annualProjectedExclVat computation (toBaniNearest(rate.X.times(12))). Module doc updated.
   series/allocateBani/runRate/net untouched.
2. NEW src/domain/estimateBasis.ts - EstimateAmounts; TaxEstimateBasis 3-way ('annual-projected' |
   'actuals-only' | 'unknown'); AttributedEstimateBasis (= Exclude unknown); actualEstimateAmounts(ytd);
   selectTaxEstimateBasis(projection,ytd): AttributedEstimateBasis (!(elapsedMonths>0) || !isFinite ->
   actuals-only with Romanian reason); amountsForEstimate; TaxEstimateWithBasis; attachEstimateBasis;
   estimateBasisOf; withEstimateBasis (bare result -> 'unknown'); formatElapsedMonths;
   estimateBasisLabel; estimateFigureLabel ('Estimare impozit YTD' ONLY for actuals; 'Estimare impozit
   anuala (rata de desfasurare)' for projected); estimateBasisExplanation.
3. src/data/dashboard.ts - imports basis helpers; DashboardData.tax: TaxEstimateWithBasis;
   getTaxEstimate computes projection+basis+amounts and returns Promise<TaxEstimateWithBasis> via
   .then(r => attachEstimateBasis(r, basis)); buildDashboardData(data, tax: TaxEstimateResult |
   TaxEstimateWithBasis, instant) normalises once with withEstimateBasis and passes "estimate" to
   snapshot/thresholds/reserve/insights. getFinancialSummary UNTOUCHED.
4. src/data/derived.ts (LIVE path) - same assembly from selectFinancialDerived(...).projection and
   .ytd; returns {estimate: TaxEstimateWithBasis | null, loading}.
5. src/pages/Dashboard.tsx - hero line now "{estimateBasisLabel(tax.basis)} . An fiscal
   {snapshot.taxYear}" (was 'ESTIMARE . An fiscal ...') plus a new
   <p className="hint">{estimateBasisExplanation(tax.basis)}</p>. StatCard label 'Impozit estimat'
   and hint 'de pus deoparte' UNCHANGED (e2e pins the hint exactly).
6. src/components/FinancialChart.tsx - note is now "{estimateFigureLabel(tax.basis)}: <strong>"
   (was the literal 'Estimare impozit YTD:').
7. e2e/dashboard.spec.ts - added FIXED_AS_OF = new Date('2026-10-31T12:00:00') + fixClock() with a
   long justification comment; fixClock added to the cockpit-cards test, the dashboard-sections test,
   the Rezerva fiscala test and the Praguri test; literals 3.105,00 -> 3.239,00 x3, 1.035,00 ->
   1.079,67 x2, the reserve sentence, and /Curent: 7.494,50 lei/ -> /Curent: 8.993,40 lei/; the
   B-13/B-17 arithmetic comment rewritten.

## 5. Known consequence to DOCUMENT (not a TASK 4 fix)
buildThresholdBases gives net-income from the engine, so the four contribution rows now measure the
ANNUAL PROJECTED VNA (8.993,40 lei) while VAT_REGISTRATION still measures YTD excl-VAT turnover
(7.700,00 lei) in the same row set. Arguably more correct (CAS/CASS floors are annual bases; the VAT
threshold is measured on realised turnover) but it is a semantic mixing a consumer can misread.
DO NOT FIX HERE (TASK 4 owns threshold semantics). The e2e comment at the Praguri test already points
at docs/ai/phases/12_projection_annual_estimate.md section 5 - that file and section MUST exist.

## 6. TODO, in order
1. DELETE the scratch file src/data/scratch.test.ts (it prints numbers; must not ship).
2. New src/domain/estimateBasis.test.ts:
   - projected amounts = YTD x 12/elapsed at 2026-10-31 -> exact bani 924000/24660/1118040/29839;
   - elapsedMonths === 0 -> kind 'actuals-only', reason present, amountsForEstimate returns the
     actuals, not annualised zeros;
   - asOf 2026-12-31 -> projected == actual (identity);
   - same data, two dates (2026-09-30 vs 2026-10-31) -> different operands AND different totals
     (3.329 vs 3.239 lei on the seed);
   - a different run-rate (add a revenue record) -> projected changes;
   - withEstimateBasis on a bare result -> kind 'unknown';
   - wording: estimateFigureLabel says YTD only for actuals; estimateBasisLabel names the run-rate
     and the month count.
   - HASH/TAMPER TEST: a stored snapshot's inputsHash still verifies against its stored inputSnapshot
     after Task 1, and the load path does not re-derive it. Model on store.load.test.tsx:92-129 and
     store.migration.chain.test.tsx:354-460.
3. Extend src/domain/projection.test.ts: excl-VAT annualisation, plus a test proving revenueNet is
   NOT derived from revenue (dataset with differing VAT rates so a derived value would differ).
4. Fix unit tests the change breaks (expected):
   - FinancialChart.test.tsx:170 /Estimare impozit YTD/ - the mocked useDashboardData fixture has no
     basis, so the label becomes 'Estimare impozit'. Give the fixture an explicit actuals-only basis
     (keeps the YTD assertion honest) AND add a case with an annual-projected basis asserting the
     run-rate wording.
   - Dashboard.test.tsx:133 /20.435/ and :181 /46.570/ - READ THE PINNED INSTANT IN THAT TEST FIRST,
     recompute, update literals WITH the arithmetic in a comment. Do NOT delete/loosen.
   - derived.test.tsx - check the +119_000 / +23_800 bani deltas and the REVIEW_REQUIRED sentinel
     (YTD deltas unaffected; engine numbers move).
   - dashboard.test.ts 'acceptance 6' at 2026-12-31 should pass unchanged (verified). Re-check
     threshold-base pins at 246/268/313/429.
5. e2e still to update:
   - computed-state describe (~763-783): add "await fixClock(page);" to its test.beforeEach, and
     /46.570/ -> /51.510/ x3 with the arithmetic comment.
   - e2e/settings.spec.ts salaried describe: needs its OWN local fixClock helper (the one in
     dashboard.spec.ts is file-local) + the same justification; /3.800/ -> /4.560/,
     /4.230/ -> /4.590/ with arithmetic comments.
   - B-14 refusal describe: no engine numbers, should be unaffected.
   - Then npm run test:e2e; expect 36 passing.
6. Write docs/ai/phases/12_projection_annual_estimate.md: what changed; the projection model's real
   semantics AS FOUND (quote denominator, floor, absence of refusal, toBaniNearest vs roundArt66,
   allocateBani, derived net); the excl-VAT extension and why it is not a new rule; files changed;
   the actual-vs-projected data contract; the wording rule; SECTION 5 = threshold base mixing; the
   snapshot-hash analysis (why NO migration, citing the Phase 10 pattern and why a tier would be the
   forbidden blanket re-hash); old->new figure table; unresolved issues; the exact TASK 2 implication.
7. Update docs/ai/STATE.md: add a pre-Phase-11 TASK 1 row to the phase table + note the new pinned
   e2e clock. Keep short.
8. Self-validate with REAL counts: tsc 0, npm run test (report new files/tests vs 48/760), build 0,
   npm run test:e2e (36).
9. Commit, message naming the cause, e.g.
   "fix(tax): the annual estimate was fed raw YTD totals; feed the run-rate projection instead".
10. Produce the mandatory handoff report.

## 7. NEXT HANDOFF content for TASK 2 (decided)
The quantity entering the engine as the expense figure is TaxCalculationInput.expensesNet (and
"expenses" for the vatExempt branch), assembled in src/domain/estimateBasis.ts by
selectTaxEstimateBasis(projection, ytd) -> amountsForEstimate(basis), handed over at exactly two call
sites: src/data/dashboard.ts getTaxEstimate and src/data/derived.ts useLatestTaxEstimate. Today
expensesNet = YtdTotals.expenseNet annualised by run-rate-v1
(projection.annualProjectedExclVat.expenseNet) - i.e. 100% OF PAID EXPENSES, STILL ALL TREATED AS
DEDUCTIBLE, which is TASK 2's target. TASK 2 should introduce the deductible subset INSIDE the
assembler or upstream of it, not at the two call sites, so both feeds stay identical. The engine's own
line "deductibleBase = vatExempt ? expenses : expensesNet" is out of scope here.

## 8. Environment
- Sandbox clock reads 2026-10-08 EEST. FIXED_AS_OF uses T12:00:00 so a TZ shift cannot move the date.
- Playwright 1.63 (page.clock.setFixedTime available), fullyParallel, webServer reuses :5173.
- docs/ai/phases/ holds 02-11 + _WORKING_NOTES_phase10.md, so 12 is free.
