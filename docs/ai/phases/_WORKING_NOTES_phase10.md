# PHASE 10 — WORKING NOTES (survive compaction)

**If my context is compacted: re-read `/home/agent/workspace/solo-falcon-replica/docs/ai/briefs/12_phase10_money.md`
FIRST. It is the authoritative scope. Then resume from this file.**

Status: **WAITING FOR SCOUTS — ZERO FILES MODIFIED.** No edit has been made to any source file.

---

## 0. Hard rules I must not violate (from the brief)

1. Two decisions are MADE — do not re-litigate:
   - **Representation = HYBRID**: integer **bani** for persisted/aggregated/displayed money; `decimal.js-light` for
     intermediate rate arithmetic.
   - **Rounding = CF art. 66 alin. (1) applied to income tax + CAS + CASS, explicitly LABELLED AS AN EXTENSION**
     (art. 66 is a Titlul IV rule; Titlul V has no rounding rule).
2. **Tie-break: a fraction of exactly 50 bani rounds DOWN** („până la 50 de bani **inclusiv**"). `Math.round` is WRONG
   at that boundary (`Math.round(0.5)` → up). One named function is the only place money rounds.
3. Never invent a legal rule, threshold, rate, date or citation. **Never report a note count or amendment count.**
4. Migration must not silently change anyone's money; must not drop or zero anything; an unconvertible value must
   **surface**, not vanish.
5. No assertion may read the wall clock. Use the documented `PIN` exemption in `src/test/wallClockGuard.test.ts`;
   **do not weaken the guard**.
6. Preserve previous pass's invariants (`phases/11_pre_phase10_leftovers.md` §8): strict date parsing at the write
   boundary; `inPeriod` never defaults to "in period"; a stored CASS exemption flag never renders as a computed zero
   (renders `Necunoscut` + `de verificat` chip + `review_required`); a `tier-floor` threshold is never labelled a
   ceiling; `vatExceedanceDate` is write-only; **explicit `null` / `undefined` distinction** on fiscal inputs — this is
   what keeps "no value" from becoming `0 lei` once money is integers.
7. Docs namespace: never rename/delete/renumber/overwrite `docs/ai/steps/*` (frozen archive, never cite as current
   behaviour). New deliverable = `docs/ai/phases/10_money_precision.md`. New doc wins over archive — say so in one line.
8. Do not touch: §7.8 CAEN-keyed rules / §7.9 richer VAT regime (blocked on source); the remaining production
   wall-clock reads (`domain/date.ts:21`, `data/dashboard.ts`, `domain/fiscal/deadlines.ts`,
   `components/dashboard/DeadlineSection.tsx`, `pages/Documents.tsx:426`, `Revenues.tsx:28`, `Expenses.tsx:26`,
   `Declarations.tsx:28`, `Settings.tsx:226`) and the 4 wall-clock-dependent e2e assertions
   (`e2e/dashboard.spec.ts:216,219,223,289`); B-24.
9. One commit per task. Handoff headings exactly: `COMPLETED:` / `FILES CHANGED:` / `TESTS:` / `VALIDATION:` /
   `DECISIONS:` / `BLOCKERS:` / `NEXT HANDOFF:`

## 0b. Tasks (T1–T5)

- **T1** integer bani as persisted+domain currency, `decimal.js-light` intermediates. Convert float sites. A raw `67450`
  must never reach a screen — the lei-rendering boundary is a single named conversion. Migration is the risky part:
  state how `674.504` converts and prove no record changes by an unintended amount.
- **T2** one rounding function implementing art. 66 exactly (≤50 bani → down, >50 → up), provenance states the
  extension. Delete scattered `Math.round`/`toFixed` on money. **Fix B-17**: exactly one path stored→displayed; add a
  test pinning the two previously-disagreeing cases to one value.
- **T3** make `totalDue` tell the truth — compute it or change the type, **no cast**.
- **T4** no money arithmetic in JSX (chart layer's float accumulation included).
- **T5** write `docs/ai/phases/10_money_precision.md`.

## 0c. Baseline that must reproduce before AND after

At `d1d2e9b` (brief says): `npx tsc --noEmit` **0** · `npm run test` **44 files / 685 tests** · `npm run build` **0** ·
`npm run test:e2e` **34 passed**. If red at start → stop and report, never fix by deleting/weakening assertions.
**My own re-measurement at HEAD `f6d7cd8`, 2026-10-07: `npx tsc --noEmit` → 0 errors · `npm run test` → 44 files /
685 tests passed · `npm run build` → exit 0 (only the >500 kB chunk warning) · `npm run test:e2e` → 34 passed.**
**Baseline is GREEN — matches the brief exactly. Cleared to start.**

HEAD at start: `f6d7cd8 docs(ai): brief 12 — Phase 10 scope, with both user decisions recorded`.

---

## 1. FINDING (verified by me, before scouts) — the brief's register IDs are WRONG for three of the four rows

The defect register in `docs/ai/STATE.md` contains exactly `B-1 … B-24`. What those rows actually say:

| Brief claims | What `docs/ai/STATE.md` actually records | Verdict |
|---|---|---|
| **B-17** = two display paths disagree by a half-cent (674,51 vs 674,50) | `STATE.md:104` B-17 = "There is no rounding policy anywhere in the fiscal domain — the cent a user sees is decided by IEEE-754", seed tax exactly **674,505 lei**, `0.10*6745.05 = 674.5050000000001` vs `0.09*7494.5 = 674.505` → `toFixed(2)` `674.50` / `Intl` `674,51`. Status: **Phase 10** | **MATCHES** (the brief's wording is a narrower restatement; the row is genuinely open and genuinely Phase 10's) |
| **B-18** = float accumulation + `Math.round` in the chart layer | `STATE.md:105` B-18 = "**FIXED (Phase 6, 2026-10-06)** — the regime gate fell through for an unrecognised regime value" (`regimes.ts` `regimeRefusalReason`). Status: **closed (Phase 6)** | **DOES NOT MATCH.** B-18 is a different, already-closed defect. There is **no register row** for chart-layer float accumulation. |
| **B-20** = "the `totalDue` type is a lie" | `STATE.md:107` B-20 = "A snapshot threshold is flagged `breached` only when `distance > 0`, which is wrong for `min-base` rows". Status: **CLOSED 2026-10-07 (Phase 9)** | **DOES NOT MATCH.** B-20 is a different, already-closed defect. There is **no register row** for a `totalDue` type problem. |
| **B-16** = "a rounding rule asserted with no legal basis" | `STATE.md:103` B-16 = "**PART FIXED (Phase 5)** — fiscal losses were silently discarded". Status: rule+surfacing closed; **still open: persisting the record and reading prior-year losses back** | **DOES NOT MATCH.** B-16 is fiscal-loss persistence, not rounding. |

Consequences I must act on (do not silently "close" rows that are already closed for other reasons):
- I must **not** write "B-18 closed" or "B-20 closed" into `STATE.md` — those rows are closed and describe other
  defects. Writing them would corrupt the register. Instead: close **B-17** (real, matches), and record the
  chart-layer / `totalDue` / rounding-assertion defects under **new, correctly-numbered rows** (next free IDs after
  B-24) or as named sub-items of B-17, and annotate the brief's mis-numbering.
- **B-16 stays open** (loss persistence) unless I actually persist losses — which is NOT in this brief's tasks. So
  B-16 must be reported as **not closed by this phase**.

### 1b. Code facts I verified with a narrow grep (not broad search)

- `Math.round` / `toFixed` sites in `src/` excluding tests:
  - `src/pages/Documents.tsx:417` — `r.venit.toFixed(2).replace('.', ',')` and `r.cheltuiala.toFixed(2)…` → **CSV export,
    money, bypasses the formatter. Real B-17-class defect (a third display path).**
  - `src/data/dashboard.ts:59` — `Math.round` of a **day count**, not money. Leave alone.
  - `src/data/types.ts:264-265` — `toFixed(1)` on **file sizes (MB/KB)**, not money. Leave alone.
  - `src/domain/deadlines.ts:110` — `Math.round` of a **day count**, not money. Leave alone.
  - `src/domain/insights.ts:125` — `Math.round(t.ratio * 100)` → a **percentage**, not money. Needs a decision: a
    percent is not money, so it is out of the money-rounding function's reach (but must not be mislabelled as money).
  - **No `Math.round` found in `src/components/FinancialChart.tsx`** by this grep — contradicts the brief's "B-18's
    `Math.round` is in the chart layer". Awaiting Scout B to settle what the chart layer actually does.
- `grep -rn "totalDue" src/ --include=*.ts --include=*.tsx | grep -v .test.` → **ZERO matches in non-test source.**
  So the field named `totalDue` (which `STATE.md:104` attributes to `computeTaxEstimate`) does not exist under that name
  in current source. Awaiting Scout A/B for the current name of the total field.

---

## 2. SCOUT REPORTS (append verbatim as they arrive, then the decision each one drives)

### Scout A — float money sites (`ScoutA-float-sites`)
STATUS: running. REPORT: _pending_

### Scout A — float money sites (`ScoutA-float-sites`) — REPORT RECEIVED

**No `src/domain/amounts.ts` exists.** Root origin of all money: `src/data/types.ts:26-27,53-54` (`valoareFaraTva`,
`tva`) and `total()` at `:196`.

**LEI sites (must become integer bani):**
- `fiscal/package2026.ts` all `unit:'lei'`: :32 `reference` 4050 · :58 `monthly` 4050 · :73 `monthly` 4325 (SM anchor)
  · :89 `min_base` 48600 · :90 `tier2_base` 97200 · :91 `tier1_cas` 12150 · :92 `tier2_cas` 24300 · :124 `min_base`
  24300 · :125 `max_annual_base` 291600 · :224 `threshold` 395000
- `fiscal/calculators.ts`: :28 `CalculatorInput.base?` (VNA; selects CAS floor, IS the CASS base) · :66
  `salaryIncomeLei?` · :76 `chosenBase?` · :7-9 `CalculatorResult.value` · :19 `nonDeductible?` · :95-104
  `calcWageReference` · :324 `calcVatThreshold`
- `tax.ts`: :18-23 `revenues/expenses/revenuesNet/expensesNet` · :31 `FiscalLossCarryForward.amount` · :48/50/57
  `TaxAmountBases.venitulBrut/cheltuieliDeductibile/venitulNetDinActivitate` · locals `net`, `gross`, `deductibleBase`,
  :247 `casDeductibila`, :248 `cassDeductibila`, :255 `deduceriCalculat`, :256 `plafonDeduceri`, :257 `deduceriRetinute`,
  :262 `taxable`, :279 `total`
- `aggregation.ts`: :29-36 `YtdTotals.revenue/expenses/net/revenueNet/expenseNet` · :40-43 `MonthlyTotals` · :59-60
  `Threshold.current/limit` · :90 `recordTotal`
- `snapshots/types.ts`: :23-25 `CalculationInput.revenues/expenses` (hashed → `inputsHash`) · :30 `CalculationLine.value`
  · :42 `CalculationOutput.total`
- `models.ts`: :173 `salaryIncomeLei?` · :199 `cashFloorLei` · `thresholds.ts`: :53-57 input map, :64-66
  `currentValue/thresholdValue/distance`, :75 `warningDistance`, :359-360 `current/limit`
- `taxReserve.ts`: :32,58,60 `reservedAmount`, `estimatedTaxLiability`, `remainingTarget`,
  `recommendedMonthlyReserve` · `projection.ts`:27-35 · `derived.ts`:29,52-53,106,111

**NOT money — must stay as-is:** `package2026.ts` :88 `rate` 25, :123 `rate` 10, :174 `base_rate` 10 (integer PERCENT);
`tax.ts` :33 `capPercent: 70`, :32 `years: 5`; :295 `offset_days: 0`; `aggregation.ts` :62 `ratio`, :86
`coverageMonths`; `thresholds.ts` :364 `ratio`; `calculators.ts` :113/188/301 `paramNumber(...)/100` (rate→fraction,
keep percent unscaled); `deadlines.ts:110` `Math.round` (days); `insights.ts:125` `Math.round(ratio*100)` (percent).

**Arithmetic on money (line-exact):** `calculators.ts` :113 `/100` · :146 `Math.max(chosen,floor)` · :147 `base*rate` ·
:188 `/100` · :192 `floorBase*rate` · :193 `maxBase*rate` · :212/:241/:264 `vna*rate` · :265 `floorCass-due` ·
:284 `Math.min(vna,maxBase)` · :285 `base*rate` · :301 `/100` · :306 `base*baseRate` · comparisons :131,143,196,207,236,283,306.
`tax.ts` :237 `Math.max(net,0)` · :243-244 proration ratios · :247 `ratioCas*casRes.value` ·
:248 `Math.max(0,ratioCass*(cassValue-cassNonDeductibila))` · :255 `+` · :256 `Math.max(0,…)` · :257 `Math.min` ·
:260/:262 `-` · :271 `-vnaRecalculat` · :279 `casRes.value+cassValue` · :96-99 `Number.isFinite` guards.
`aggregation.ts` :90 `valoareFaraTva+tva` · **:224,225,231,232 `+=`** · :236 `revenue-expenses` · :249 `entry[field]+=amount` ·
:250 `net=revenue-expenses`. `taxReserve.ts` :75,86,133. `thresholds.ts` :209-210.
`data/dashboard.ts` **:299-302 `*100` lei→cents (the only existing bridge)** · `insights.ts` :44 `cents/100`.

**Key constraints Scout A raised:** (1) `unit` (`rules.ts:19`) is the only machine-readable money marker; `paramNumber`
(`calculators.ts:86`) is the single funnel — make it unit-aware there. (2) `*rate` after `/100` is the float generator;
prefer integer math `bani * rate / 100`. (3) `tier1_cas`/`tier2_cas` (declared) vs `floorCass`/`ceilingCass` (derived,
:192-193) must convert together — "one figure, one source" rule at `package2026.ts:126-135`. (4) `aggregation.ts:82-87`
`taxReserve.*Cents` are **already integer cents** — do not double-convert; delete the bridge or make it identity.
(5) `preMigrationInputsHash` already exists (`snapshots/types.ts:74`) for exactly the hash-change case.
(6) Tests pinning lei literals: `fiscal/fiscal.test.ts:389,403`, `tax.test.ts:593,612`, `thresholds.test.ts:107`,
`derived.test.ts:284-351`, `profile.test.ts:60-63`.

#### Decisions driven by Scout A
- **A-1 REJECTED Scout A's rounding suggestion.** Scout A wrote "RO tax rounding is per-lei/cents-half-up; pick one
  place". That is **not** the law and **not** the user's decision. The brief's settled policy is **CF art. 66 alin. (1)**:
  rotunjire **la un leu**, fracţiuni **până la 50 de bani inclusiv neglijate**, **peste 50 bani majorare la leu**.
  Scout A's "half-up" is wrong at the exact-50-bani boundary. Art. 66 wins; Scout A is overruled on this point.
- **A-2 What art. 66 rounds: to a whole LEU, not to a cent.** The verbatim text rounds *to un leu* (100 bani). So the
  named function maps a bani amount to the nearest multiple of 100 bani, ties (exactly 50 bani) DOWN.
  `674.505 lei` = 674 lei + 50.5 bani → 50.5 > 50 → **675 lei**. `674.50 lei` → exactly 50 → **674 lei**.
- **A-3 Where art. 66 applies — the three lines only.** The user's decision says "applied to all three lines": the
  computed **income tax, CAS and CASS amounts owed**. It does **not** apply to transaction amounts, thresholds, bases,
  VNA, or ratios — rounding a *base* would change the base and therefore the tax, which art. 66 does not say (it
  rounds the calculated sums). Bases stay exact in bani. This boundary is an inference about where the line falls, and
  I will label it explicitly in code + phase doc and flag it under `DECISIONS:`.
- **A-4 Round once per line, then sum exact integers.** `totalDue`/total = sum of already-rounded integer lines, so no
  second rounding happens anywhere. Keeps "one named function is the only place money rounds" literally true.
- **A-5 Integer math for rates:** keep rates as integer percent in the rule store (do NOT scale them), and compute
  `bani * rate` then divide by 100 through `decimal.js-light`, converting back to integer bani only through the art. 66
  function at the line boundary. `paramNumber` becomes the unit-aware funnel.
- **A-6 Delete the lei→cents bridge** (`data/dashboard.ts:299-302`) and the `cents/100` divide-back
  (`insights.ts:44`) rather than keeping them — they are the drift mechanism the brief names.
- **A-7 The brief's line numbers are stale; Scout A/B/C's are current.** Brief says aggregation `+=` at :97-104 (actual
  :224-232), cents conversion at :60-65 (actual `Threshold` :59-60, `*Cents` :82-87), dashboard cents at :230-235
  (actual :299-302), insights divide-back at :36-37 (actual :44). I work from the scouts' line numbers, not the brief's.

### Scout B — stored money → rendered number, the B-17 formatter pair (`ScoutB-display-paths`) — REPORT RECEIVED (after one resume)

**Seven display paths, FIVE distinct formatter implementations:**
| # | Source | Formatter | Output for the same money |
|---|---|---|---|
| A | `recordTotal` (`aggregation.ts:92`) → `revenue +=` (`:224`) → `selectYtd` → `snapshot.pfaRevenue` (`dashboard.ts:271`) | `fmtRON` (`data/types.ts:187,189`) | `674,50 RON` |
| B | `selectYtd` → `getThresholdStatuses` → `t.currentValue` | `formatLei` (`lib/format.ts:8-15`) | `674,50 lei` |
| C | `tax.output.total` → `computeTaxReserve` → `reserve.remainingTarget` (`taxReserve.ts:133`) | `fmtRON` | `674,50 RON` |
| D | `remainingTarget * 100` → `gapCents` (`dashboard.ts:302`) → `formatCents` = `gap/100` (`insights.ts:43-44`) | private `Intl` `ron` (`insights.ts:36`) | `674,50 RON` |
| **E** | `r.venit` accumulated by `rows.reduce` **inside the component** (`Documents.tsx:462`) | **`toFixed(2).replace('.',',')`** (`Documents.tsx:417`, CSV export) | **`674,51` ← DISAGREES** |
| F | same `venit` | `toLocaleString('ro-RO',{minimumFractionDigits:2})` (`Documents.tsx:496,500,505`) | `674,50` |
| G | `ytd.revenue / denom * 12` (`projection.ts:67,73`) | `fmtRON` | `674,50 RON` |

**The B-17 pair, proven.** Formatter 1 = `Intl.NumberFormat` (paths A–D,F; three separate instances at
`data/types.ts:187`, `lib/format.ts:8`, `insights.ts:36`) — **banker's / round-half-to-even per ECMA-402, operating on
the raw IEEE-754 double**. The double nearest 674.505 is `674.50499999999999545…`, below the midpoint, so it rounds
DOWN → `674,50`. Formatter 2 = `Number.prototype.toFixed(2)` (path E) — **round-half-up on the shortest decimal repr**;
the shortest repr of that same double is `"674.505"`, so it rounds UP → `674,51`. Same stored money, two algorithms,
one half-cent apart. Origin of the value: `reserve.remainingTarget = Math.max(0, estimatedTaxLiability -
(reservedAmount ?? 0))` (`taxReserve.ts:133`) where `estimatedTaxLiability = tax.output.total` is a computed float.

**Formatter call sites.** `fmtRON` — 22 sites: `FinancialSummary.tsx:25,26,29`; `FinancialChart.tsx:91,237,264,267,270`;
`TaxReserve.tsx:25,29,30,44,50`; `Revenues.tsx:219,220,221`; `Declarations.tsx:170,171,172`;
`Dashboard.tsx:80,83,86,87,104,107`; `Expenses.tsx:208,209,210,226`; `EFactura.tsx:79`.
`formatLei` (`lib/format.ts`) — `dashboard/ThresholdSection.tsx:96,99,102`. Private `formatLei` (`insights.ts:38`) —
`insights.ts:247` (via `formatCents`), `:280`. `toFixed(2)` — `Documents.tsx:417`. `toLocaleString` —
`Documents.tsx:496,500,505`.

**`FinancialChart.tsx` has NO `Math.round`** (Scout B confirms my grep independently). What it really does: calls
`getProjectedFinancialSeries` → `selectProjectionV1` (`projection.ts:59`), where `runRate.revenuePerMonth = ytd.revenue /
denom` (:67, float division) and `annualProjected.revenue = runRate.revenuePerMonth * 12` (:73, float multiplication);
monthly series come from `selectMonthly` (float accumulation). **In JSX the values are passed straight to `fmtRON` — no
arithmetic in JSX.** The YAxis uses `plain.format(v)` with `maximumFractionDigits: 0` (`:35`). The float accumulation is
upstream: `selectYtd` (`revenue += recordTotal(r)`, `aggregation.ts:224`) and `projection.ts:67,73`.

#### Decisions driven by Scout B
- **B-1 One conversion boundary, and it performs NO rounding.** Once money is integer bani, rendering is exact
  (`bani/100` with 2 decimals is exact for every integer), so the formatter's rounding behaviour stops mattering —
  which is the structural fix for B-17, not a tie-break patch. Collapse the five formatter instances into **one**
  exported function taking `Bani` and returning the display string; delete `lib/format.ts`'s private `Intl`, the private
  `Intl` in `insights.ts`, `toLocaleString` at `Documents.tsx:496,500,505` and `toFixed(2)` at `:417`.
- **B-2 `Documents.tsx:417` is a third display path (CSV export) and the one that actually disagrees.** Route it through
  the same single conversion. (CSV is a file, not a screen, but the same "raw bani must never escape" rule applies.)
- **B-3 T4's real target is `Documents.tsx:462`** — `rows.reduce` accumulating `venit`/`cheltuiala` **inside the
  component**. That is money arithmetic in the view layer and must move to the data/domain layer. `FinancialChart.tsx`
  itself does no arithmetic, so T4 for the chart means moving `projection.ts`'s div/mul out of the render path's reach
  (it is already in `domain/`, so the fix is integer bani + one rounding, not relocation).
- **B-4 Chart YAxis `maximumFractionDigits: 0` (`FinancialChart.tsx:35`) is a scale-tick label, not an amount due.**
  It must still go through the single bani→lei conversion, but its 0-decimal rendering is a label affordance. Every
  *amount* the user reads (tooltip, legend, summary, table) must be exact and unrounded outside the one art. 66
  function. I will state this boundary explicitly rather than pretend the axis never rounds.
- **B-5 B-18 as the brief describes it ("float accumulation + `Math.round` in the chart layer") does not exist.**
  Two independent checks (my grep + Scout B) find no `Math.round` on money anywhere in the render layer. The real defect
  is float accumulation upstream (`aggregation.ts:224-232`, `projection.ts:67,73`). I will fix the real defect and
  report the mis-description — not claim to have deleted a `Math.round` that was never there.
- **B-6 The B-17 pin test** must assert that the previously-disagreeing value renders identically through every path
  (screen + CSV), and that the value is the art. 66 result — not merely that two formatters now agree by luck.

### Scout C — persisted shape + migration chain (`ScoutC-persistence`) — REPORT RECEIVED

**Version + chain.** `CURRENT_DATA_VERSION = 4` at `src/data/migration.ts:52` (= `DATA_VERSION_VAT_DATE`).
Constants: `DATA_VERSION_BASE=0` (:33), `PROFILE=1` (:35), `IDENTITY=2` (:37), `DATES=3` (:43), `VAT_DATE=4` (:50).
Chain (`migration.ts:305-337`): `0→1 profile-materialization` · `1→2 identity-absorption` ·
`2→3 payment-dates` (no-op) · `3→4 vat-exceedance-date` (no-op). Runner `migratePersistedData` (:348-377): steps run
in order only when `step.from === currentVersion`; absent `version` ⇒ base 0 (deliberately no zod `.default()`,
`schema.ts:245-248`); `fromVersion > CURRENT` ⇒ `UnsupportedDataVersionError`; after each step, if
`readVersion(data) !== step.to` it throws `migration step '<name>' did not set version N` (:362-365).
Storage key never changes: `STORAGE_KEY = 'pfa-app-data-v2'` (`store.tsx:31`).

**Every persisted money field** (`src/data/schema.ts`):
| field | zod | required? |
|---|---|---|
| `revenues[].valoareFaraTva` / `.tva` | `nonNegative` = `z.number().min(0)` (:36,48,49) | required |
| `expenses[].valoareFaraTva` / `.tva` | `nonNegative` (:65,66) | required (collection optional) |
| `declarations[].venituri` / `.cheltuieli` | `nonNegative` (:84,85) | required (collection optional) |
| `snapshots[].inputSnapshot.revenues` / `.expenses` | plain `z.number()` (:145,146) — **no min, no finite** | required |
| `snapshots[].calculationLines[].value` | plain `z.number()` (:155) | required |
| `snapshots[].output.total` | plain `z.number()` (:164) | required |
| `profile.cashFloorLei` | `z.number().min(0)` (`domain/schema.ts:82`) | **required** |
| `profile.salaryIncomeLei` | `z.number().min(0).finite().optional()` (`domain/schema.ts:71`) | optional |

Not money: `settings.cotaTva` (int 0-100 percent), `companyDocs[].marime` (bytes).

**null vs undefined — CRITICAL:** **no persisted field anywhere is `.nullable()`.** `.optional()` accepts a missing
key / `undefined` but **rejects `null`** (zod `invalid_type`) ⇒ a `null` in any money field fails
`persistedAppDataSchema.safeParse` ⇒ whole payload quarantined + seed loaded. So the migration must **omit keys, never
write `null`**, for optional money (`salaryIncomeLei`); `cashFloorLei` must always be present as a number.
Also: zod **strips unknown keys**, and parse happens **before** migration ⇒ a field my step adds survives that load but
is silently erased on the next load unless declared in `schema.ts`. And `Equal<z.output<…>, Revenue|Expense|…>`
assertions (`schema.ts:411-424`) force zod output and the TS types in `src/data/types.ts` to stay identical.

**What a FAILED migration does** (`store.tsx:169-177`): a throwing step ⇒ `rejected(raw, 'schema-invalid',
'migration failed: <msg>')`. `rejected()` (`store.tsx:131-149`) copies the **raw string verbatim** to
`pfa-app-data-v2:quarantine` *before* anything else, then returns `{ data: seedData, dataOrigin: 'quarantined' }`.
The **main key IS then overwritten with seed data** by the save effect (`store.tsx:186-197` writes
`{...data, version: CURRENT_DATA_VERSION}` on mount); the original bytes survive only in the sibling quarantine key.
History capped at `QUARANTINE_HISTORY_LIMIT = 10`. **If the quarantine write itself fails (quota), `record` is `null`
⇒ `dataOrigin: 'seed'`, no banner, and the original data is genuinely lost** (`quarantine.ts:96-100`,
`store.tsx:141-147`). No rollback, no partial load.
`MigrationStep.apply: (data: PersistedAppData) => PersistedAppData` (`migration.ts:61`) is synchronous — **there is no
Result/error channel; the only failure mode is `throw`**, which quarantines the whole payload. User surface: `App.tsx:267-270`
`role="alert"` banner „Datele salvate nu au putut fi citite.” + `quarantineSummary`.

**Tests that pin the chain** (`src/data/store.migration.chain.test.tsx`): :163-172 pins the exact `[from,to]` list AND
`CURRENT_DATA_VERSION === DATA_VERSION_VAT_DATE`; :184-199, :203-212, :214-223, :381-396 assert `stepsApplied` equals
an exact array of the 4 step names; :296-303 current-version payload is a strict no-op; **:265-292 asserts the fiscal
inputs inside a snapshot stay byte-identical** (`inputSnapshot.revenues/expenses`, `output`, `fiscalKeys(profile)`
incl. `cashFloorLei`, `salaryIncomeLei ?? null`) — **that test forbids exactly the change T1 makes, by design.**
`store.load.test.tsx:196-273` covers seed/persisted/quarantined but **no test pins the "step threw" quarantine path**
(`migration failed` appears only at `store.tsx:176`) — a gap I can close.

**Scout C handoff constraints:** add `DATA_VERSION_MONEY_BANI = 5`, `CURRENT_DATA_VERSION = 5`, append one step
`4→5` at the end of `MIGRATION_CHAIN` with a unique never-reused name that **must** return `version: 5`. Convert
`revenues[].valoareFaraTva|tva`, `expenses[].valoareFaraTva|tva`, `declarations[].venituri|cheltuieli`,
`profile.cashFloorLei`, `profile.salaryIncomeLei` (omit if absent), and inside every snapshot
`inputSnapshot.revenues|expenses`, `calculationLines[].value`, `output.total`, embedded `profile.*`. Never emit
`null`/`NaN` (`NaN` passes `z.number()` but fails `.finite()`). Snapshot digests: any `inputSnapshot` change requires
`inputsHash = computeInputsHashSync(next)` and `preMigrationInputsHash = snapshot.preMigrationInputsHash ??
snapshot.inputsHash` (pattern: `backfillSnapshotIdentity`, `migration.ts:242-270`). Seed money at `seed.ts:38-46,51-55,96-100`
must become integer bani (fractional: `tva: 25.2`, `valoareFaraTva: 85.5`, `tva: 17.96`, `tva: 71.4`). Display layer
`fmtRON` (`src/data/types.ts:186-188`) and `total()` (`:196`) currently treat the number as lei.

#### Decisions driven by Scout C
- **C-1** Migration = one appended step `4→5`, name `money-bani`, `CURRENT_DATA_VERSION = 5`. Never rewrite the chain
  order or reuse a name.
- **C-2** Because a throwing step quarantines the whole payload and overwrites the main key with seed, the money step
  **must not throw on an unconvertible value**. It must convert what it can and **surface** the rest — a per-record
  `review_required`/report channel, not a `throw`. (Brief: "A persisted value that cannot be converted must surface,
  not vanish." Throwing would *destroy* access to it.) Design: collect unconvertible values and carry them forward
  visibly rather than dropping them.
- **C-3** Never write `null` into an optional money field during migration — **omit the key** (no persisted field is
  `.nullable()`). This is also what preserves the `null`/`undefined` invariant the previous pass added.
- **C-4** `Math.round(x*100)` is NOT acceptable for the migration conversion: it is the very function the brief forbids
  (`Math.round(0.5)` → up). The conversion must go through the **one named art. 66 rounding function** (T2), so the
  migration and the domain round identically. And it must reject non-finite input explicitly.
- **C-5** `store.migration.chain.test.tsx:265-292` (snapshot fiscal inputs byte-identical) must be **deliberately
  re-scoped in the same commit**, with the reason written down: the money-unit change is a unit change, not a value
  change — `674.505 lei` and `67450.5 bani` must be provably the same money. I will keep the byte-identity idea but
  re-express it as *value-preserving* (bani = lei×100) rather than *digit-identical*, and keep
  `preMigrationInputsHash` pointing at the pre-change digest.
- **C-6** Add the missing test for the "step threw → quarantine, reason `schema-invalid`, detail `migration failed:`"
  path, since Scout C confirms nothing pins it and my step is the first one that can plausibly hit it.
- **C-7** Any new persisted field must be declared in `data/schema.ts` (zod strips unknown keys and parses before
  migration) and mirrored in `src/data/types.ts` because of the `Equal<>` assertions at `schema.ts:411-424`.

### Scout D — snapshot/hash layer (`ScoutD-hash-layer`)
STATUS: running. REPORT: _pending_

### Scout D — snapshot/hash layer (`ScoutD-hash-layer`) — REPORT RECEIVED

**How the hash works.** `canonicalize` (`src/domain/snapshots/serialize.ts:9-30`) is the only serialiser feeding both
digests. Numbers: `serialize.ts:14-17` → `Number.isFinite(value) ? String(value) : 'null'`. **`JSON.stringify` never
serialises a number in the hashed payload** (only strings at :19 and object keys at :23). So `1000.5` → `"1000.5"`,
`0.1+0.2` → `"0.30000000000000004"`, `NaN/Infinity` → `"null"`. Key order: `Object.keys(value).sort()` (:22), every own
key emitted, arrays keep order. Both entry points hash identical bytes: `hash.ts:10` (async, `crypto.subtle`, used at
snapshot creation) and `hashSync.ts:110` (used only by the migration).

**Hashed payload = `{ profile, revenues, expenses }` only** (`types.ts:20-27`). `calculationLines` and `output` are
**not** hashed. Money into the hash: `revenues`/`expenses` (`types.ts:23,25`; assembled `snapshot.ts:33-34`; hashed
:snapshot.ts:40), production source `tax.ts:282,299` (`revenues: gross, expenses: deductibleBase`), plus embedded
`profile.cashFloorLei` (`models.ts:199`) and `profile.salaryIncomeLei` (`models.ts:173`).

**Are digests persisted and compared?** Persisted by schema (`schema.ts:148 inputsHash: z.string()`, `:151
preMigrationInputsHash: z.string().optional()`) and written by `store.tsx:192` — **but never actually written today**:
`addSnapshot` has **no production caller** (declared `store.tsx:95`, implemented `:316`, called only in
`store.snapshots.test.tsx:98,101`) and `seed.ts:86` ships `snapshots: []`. `computeTaxEstimate` builds a snapshot and
returns it, nothing appends it. **The load path never re-hashes** (proved by `store.migration.chain.test.tsx:419-420`
and by a bogus `'abc123'` surviving load at `store.load.test.tsx:99`). Only re-derivation is
`migration.ts:252-261` (`backfillSnapshotIdentity`): re-derive `inputsHash = computeInputsHashSync(nextInputSnapshot)`,
preserve `preMigrationInputsHash = snapshot.preMigrationInputsHash ?? snapshot.inputsHash`, with a guard at :249 that
leaves the digest untouched when nothing changed.

**No test pins a digest of a specific money input** → a lei→bani change breaks **no pinned digest**. The only literal
digest in the repo is `hashSync.test.ts:39` = SHA-256 of `"abc"` (money-independent). Placeholders (`'0'.repeat(64)`,
`'abc123'`) are never computed. No hash assertions in `e2e/`.

**Scout D constraints:** (1) lei-float → bani-int changes the canonical bytes of every `inputSnapshot`, invalidating
every digest — theoretical today because no snapshot is stored. (2) `canonicalize` emits **every own key**, so adding a
`unit`/`currency` marker to `CalculationInput` also changes the digest. (3) `schema.ts:144-145,156` use `z.number()`,
not `.int()`. (4) Float noise is digest-visible — convert to whole bani through one rounding function *before*
`buildInputSnapshot`. (5) `store.migration.chain.test.tsx:345-359` pins fiscal keys inside a snapshot byte-identical
across migration — a money-unit backfill intentionally violates it. (6) `derived.ts:132-142` `canonicalKey` is a
**separate** runtime key (`inputsKey`) that *does* use `JSON.stringify` for primitives — do not unify it with `inputsHash`.

#### Decisions driven by Scout D
- **D-1 Enforcement = a branded nominal type.** `type Bani = number & { readonly __brand: 'bani' }` (plus explicit
  `Lei`/`Percent`/`Days` where needed). This is what satisfies Q-MONEY-UNIT's "the boundary must be enforced (types plus
  a test) or it rots" without a runtime cost.
- **D-2 Do NOT add a `unit`/`currency` field to the hashed payload.** It would change digest bytes for no benefit; the
  unit lives in the *type*, not the payload. Keep `inputSnapshot` key names (`revenues`, `expenses`) unchanged so the
  migration converts values, not keys.
- **D-3 TRAP: do not tighten the load gate to `.int()`.** Scout C proved parse happens **before** migration, so
  `.int()` on `persistedAppDataSchema` money fields would reject every pre-migration float payload and quarantine the
  user's data. The load gate stays permissive (`z.number()`); integer-ness is enforced **after** migration, in the
  domain, and asserted by test.
- **D-4 The money migration step must re-derive `inputsHash` for every stored snapshot** following the
  `backfillSnapshotIdentity` pattern (`migration.ts:252-261`), preserving the old digest in `preMigrationInputsHash`.
  Even though no real digest exists today, the pattern is the repo's contract and it is what keeps the provenance
  invariant tests (`snapshots.test.ts:161,328`) true after the change.
- **D-5 Convert to whole bani before `buildInputSnapshot`** so digests are stable (no `7128.100000000001` noise).
- **D-6 Leave `derived.ts` `canonicalKey`/`inputsKey` alone** — separate concern, not the digest.

### Scout E — assertions pinning money numbers (`ScoutE-money-assertions`) — PARTIAL REPORT RECEIVED (hit output limit; resumed for the remainder)

**FIRST: the brief's `PIN` exemption does not exist.** `src/test/wallClockGuard.test.ts` has **no `PIN` marker, no
token, no allowlist**. Its actual design (lines 1-72): offender regexes `/new\s+Date\s*\(\s*\)/`,
`/\bDate\s*\.\s*now\s*\(\s*\)/`, `/\bperformance\s*\.\s*now\s*\(\s*\)/` (:26-30); scanned set
`import.meta.glob('/src/**/*.test.{ts,tsx}', { query: '?raw' })` at :37 — **`e2e/**` is never scanned** (documented
:17-20); the only textual exemption is `stripComments` (:34-45), which blanks lines starting `//`, `/*`, `*` and strips
trailing `\s//` comments. The sanctioned way to get "now" is an injectable `instant` or fake timers (:22-24). A **pinned**
`new Date('2026-06-01T12:00:00Z')` is legal because the regex requires an **empty arg list** (asserted at :71). :69 builds
the forbidden token by `join('')` so the guard file never contains it.
→ **So the brief's "use the documented `PIN` exemption" is false. The real exemption is a pinned (argument-bearing)
`new Date('…')` literal or fake timers. I will use that, and will NOT weaken the guard.**

**Money assertions received so far (partial — tail truncated):**
- `e2e/dashboard.spec.ts`: :66 `'9.317,00 RON'` (YTD VAT-inclusive); **:78 `'3.104,51 RON'` = computed total tax
  (CASS 2430 + income tax 674,505 = 3104,505)**; :84 `'1.034,84 RON'` (= 3104,505/3); :88 `'3.104,51 RON'`
  (`remainingTarget`); :132 `'3.104,51 RON'` (tax hero); :155 `'1.034,84 RON'`; :157 sentence
  `'Rămâne de pus deoparte 3.104,51 RON în următoarele 3 luni.'`; :176 `'Prag: 48.600,00 lei'`; :182 `'Prag: 97.200,00 lei'`;
  :187 `'Prag: 24.300,00 lei'`; :188 `'Prag: 291.600,00 lei'`; :192 `'Prag: 395.000,00 lei'`; :198 `/Curent: 7\.494,50 lei/` ×4;
  :199 `/Curent: 7\.700,00 lei/` ×1; :202 negative guard `/Curent: 9\.317,00 lei/` ×0;
  :603-604,618-620,643,656,675 `'202.000,00 RON — Realizat'` (`MONTHLY_TOTAL = 202_000` at :510);
  ~:767,775,782 `/46\.570/` ×3 (CAS 24.300 + CASS 13.000 + tax 9.270); :831 negative `/Curent: 0\.000,00 lei/` ×0;
  :835 `/Curent: 130\.000,00 lei/`; :836 `'Prag: 395.000,00 lei'`.
- `e2e/settings.spec.ts`: :148 `salaryIncomeLei` `30000` (stored raw); :170 `salaryIncomeLei` `undefined`;
  :222 `/3\.800/` (CASS 2.000 + tax 1.800); :233 `/4\.230/` (CASS 2.430 + tax 1.800).
- `src/data/dashboard.test.ts`: :141,143,148-150,160,220 `1190`,`595`; :242 `7700`; :245 `9317`; :250,416 `395000`,`97200`;
  :267,417 `7494.5`; :271 `not.toBe(ytd.net)` (9068.34); ~:312 `7700`; :320-324
  `{venitulBrut:7700, cheltuieliDeductibile:205.5, venitulNetDinActivitate:7494.5}`; :326-328 `7700`,`205.5`,`7494.5`;
  **:329 `6745.05` (taxable base)**; **:330 `3104.505` (total tax — the half-cent case)**; ~:443,449 `120000`,`24300`.
- `src/domain/tax.test.ts` (computed, unformatted): :206 `24_478.2`; :243 `0`; :255 `0`; :264 `24_615`; :275 CASS `2430`;
  :291-292 `15_000`/`10_000`; :305 CAS `12_150`; :314 `0`; :323 `12_150`; :334 `0` + total `38_000`; :343 `12_150`;
  :353 `24_300`; :362 `24_300`; :372,381 `29_160`; **:415-420 CAS `12_150`, CASS `7_128.1`, tax `5_200.29`,
  total `24_478.39`**; :466-467 `24_300`/`12_150`; :483 `50_000`; :491 `55_000`; :497 `2_430`; :502 `2_000`;
  :504 taxable `18_000`; :505 tax `1_800`; :507 total `4_230`; :512-517 ded `12_150`, `7_128.1`, taxable `52_002.9`,
  total `24_478.39`; :534-541 `48_600`,`5_000`,`3_600`,`0`,`53_600`; :553 `0` + loss `10_000`; :600 `2_000`,`2_000`,`3_800`;
  :625 `4_230`; fixtures :591-634 `30_000`/`20_000`/`24_300`/6 SM.
- `src/domain/taxReserve.test.ts`: :44-53 `18_535`,`5_000`,`13_535`,`13_535/7`; :63-65 `5_000`,`0`; :74-76 `1_000`,`0`;
  :82-85 `20_750`→`15_750`, **`1_312.5`**; :92-95 `18_535`/`0`.
- `src/domain/thresholds.test.ts`: :162 `300000-291600`; :174 `400000-395000`; :181-184 warningDistance
  `4860`/`2430`/`29160`/`39500`; :193-194 `4860`; :201 `4861`; :210 `-29160`; :217 `-29161`; :226 `-39500`;
  :233 `-39501`; :313 `100000`; :369 `97200`; :385-387 `60000→12150`, `97199→12150`, `97200→24300`.
- `src/domain/aggregation.test.ts`: :110-112 `119`/`59.5`/`59.5`; :122-124 `1190`/`474.4`/`715.6`;
  :135-139 `110`/`100`/`55`/`50`/`55`; :153 `595`; :167 `119`; :179 `119`; :188-190 zeros; :196-198 `0`/`595`/`-595`;
  :205,212,224 `119`/`100`; :236 zeros; :257-259 `178.5/47.4/131.1`, `238/119/119`, `357/0/357`; :275 `476`;
  :303-304,315-316 `119`,`238`; :361-362 `+238`; :371 `-238`; :383-384 `119`/`59.5`; :393,399 `0`/`119`.
- `src/domain/projection.test.ts`: :119-122 `8.5`,`126`,`180/17`,`1962/17`; :128-130 `1512`,`2160/17`,`23544/17`;
  :148-152 `357`,`90/-90`,`126`,`180/17`,`1962/17`; :158 `{1200,0,1200}`; :186-187 `119`,`1428`; :196 `119`;
  :212 `70`; :222 `14`. **Note the `/17` fractions — projection is where non-integer bani will bite hardest.**
- `src/components/FinancialSummary.test.tsx`: :11-13 `'156.000,00 RON'`,`'54.000,00 RON'`,`'102.000,00 RON'`;
  :21 `'0,00 RON'`×3; :26 `'-20.000,00 RON'` — **all formatter-dependent**.
- `src/components/TaxReserve.test.tsx`: :21 `'15.000,00 RON'`; :27 `'120.000,00 RON'`; :40 `not /0,00 RON/`;
  :45 sentence with `'90.000,00 RON'`; :50 fixtures `120000`/`0`.
- `src/components/FinancialChart.test.tsx`: :170 `/1.234,56 RON/` (tax estimate `1234.56`);
  :197-199 `'Venituri · Proiecție: 13.000,00 RON'`, `'Cheltuieli · Proiecție: 4.600,00 RON'`,
  `'Profit net · Proiecție: 8.400,00 RON'`.
- `src/components/dashboard/ThresholdSection.test.tsx`: :36-38 `'12.000,00 lei'`,`'6.000,00 lei'`,`'1.000,00 lei'`;
  :92 `not '0,00 lei'`; :116 `'97.200,00 lei'` — **report cut off here.**

#### Decisions driven by Scout E
- **E-1 The `PIN` claim is false; use a pinned `new Date('…')` argument or fake timers.** Do not add an exemption
  mechanism to the guard and do not weaken it. Report the false claim.
- **E-2 Rounding the three lines to a whole leu moves exactly these assertions** (and only these, among the rendered
  amounts): `e2e/dashboard.spec.ts:78,84,88,132,155,157` (`3.104,51` → `3.105,00`; `1.034,84` → `1.035,00`),
  `src/data/dashboard.test.ts:330` (`3104.505` → `3105`), `src/domain/tax.test.ts:415-420` and `:512-517`
  (`7_128.1`→`7_128`, `5_200.29`→`5_200`, `24_478.39`→`24_478`), `src/domain/taxReserve.test.ts:82-85` (`1_312.5`).
  `e2e/settings.spec.ts:222,233` and `dashboard.spec.ts:~767,775,782` are already whole-lei (`3.800`, `4.230`, `46.570`)
  so they must **not** move — that is a useful negative control.
- **E-3 Bases and thresholds must NOT move.** `dashboard.test.ts:329` `6745.05` is a **taxable base**, `:267,417` `7494.5`
  is VNA, `:320-324` are bases, `thresholds.test.ts` values are rule params. Under my A-3 boundary these stay exact
  (they become integer bani, e.g. `7494.5` → `749450` bani, value-preserving). If any of them shifts by a rounding
  decision, that is a bug.
- **E-4 `projection.test.ts`'s `/17` fractions are the hardest part of T1.** A per-month split of integer bani cannot
  stay exact for every denominator. Decision: keep the projection in **decimal intermediates** and convert to integer
  bani only at the point a month is *displayed or summed*, with the split pinned by test so the months still sum to the
  total (no drift, no invented rounding of a projection — a projection is not a "sum due" under art. 66).
- **E-5 Formatter-dependent vs amount-dependent split (derived from Scout E's list, item 3):** formatter-sensitive =
  every `… lei`/`… RON` string in `FinancialSummary.test.tsx`, `TaxReserve.test.tsx`, `FinancialChart.test.tsx`,
  `ThresholdSection.test.tsx`, and the `e2e` rendered strings. Amount-sensitive = every bare number in `tax.test.ts`,
  `aggregation.test.ts`, `thresholds.test.ts`, `projection.test.ts`, `taxReserve.test.ts`, `dashboard.test.ts`,
  `e2e/settings.spec.ts:148,170`. I will keep the formatter-sensitive set **unchanged in wording** wherever the amount
  is unchanged, so a formatter regression cannot hide behind a mass expectation rewrite.

### Partial Scout E coverage from Scout D (not a substitute — recorded so I know what I still lack)
Scout D enumerated engine line-value assertions: `tax.test.ts:52,65,163,221,232,274(2_430),282,308(15_000),309(10_000),
488,490(2_430),495(2_000),497(18_000),498(1_800),512(12_150),513(7_128.1),514(52_002.9),533(48_600),534(5_000),
535(3_600),537,539,557(10_000),602(2_000),620(2_430),712(20_000)`; `data/dashboard.test.ts:442` `casLine.value` 24300;
`fiscal/fiscal.test.ts:102-228` ~18 `toMatchObject({value:…})` (4050, 12150, 24300, 37500, 2430…).
**`tax.test.ts:513` `7_128.1` and `:514` `52_002.9` are the only fractional-lei literals** → become `712810` / `5200290`
bani, and are exactly where the rounding policy becomes observable. Still missing from Scout E: the rendered-string
assertions (`… lei`) in `src/**` and `e2e/**`, and the `PIN` exemption syntax.

---

## 3. DECISIONS LOG (append; each decision cites the evidence that drove it)

- **D-0** Do not re-number or "close" B-18/B-20/B-16 in `STATE.md`; the brief's IDs for those three do not match the
  register. Evidence: `docs/ai/STATE.md:103-107`. Report the discrepancy under `BLOCKERS:`/`NOTES` instead.

### Scout E part 2 — REMOVED. The block that was here was my own inference, not a report.
It has been deleted. The real Scout E report is at the end of this file under
`## 4. SCOUT E — FULL REPORT (received, verified)`. Nothing from the deleted block survives.
Three of its claims were **wrong** and are corrected there: `e2e:84,155` is `1.034,84` (not `1.035,00`);
`Dashboard.test.tsx:106,152` and `fiscal.test.ts:414,426` are **NO-MOVE**, not move.

### research/20 confirmation (read directly, not from a Scout) — settles the rounding UNIT

`docs/ai/research/20_cf_art66_rounding_and_art154_cass_exemption_2026.md` lines 15–40, verbatim:
> „Sumele sunt calculate prin rotunjire **la un leu**, prin neglijarea fracțiunilor de până la 50 de bani **inclusiv** și
> majorarea la leu a fracțiunilor ce depășesc 50 de bani." — CF (Legea 227/2015) Titlul IV, Capitolul I, CONFIRMED.

1. **„It rounds to a LEU, not to a ban."** The legal unit for Titlul IV income tax is the whole leu.
2. **Tie-break is half-DOWN at exactly 50 bani** („inclusiv"). Neither half-up nor half-even.
3. **„The seeded case is not a tie."** `674.505` lei → fracțiune **50,5 bani** → exceeds 50 → **675 lei**. A true tie at
   `674.50` would give **674**. So the e2e figure moves to `3.105,00 RON` *because of the arithmetic*.
4. **„Both current formatters are wrong, because both are rounding to bani. The legal answer is neither."**
5. Line 126: **art. 66 is PER-SUM** and sits in Titlul IV Capitolul I, so it governs the *stabilirea* of each sum. Its
   extension to the amount entered on DU 212 is **PARTLY CONFIRMED (inference)** → this is exactly the "extension" the
   brief requires me to mark. **No separate rounding rule exists for CAS/CASS** (0 hits in Titlul V) → NOT FOUND.
6. DU 212 instructions: `zecimale` → **0** hits, `rotunj` → **0** hits; the only format language is „se înscrie suma
   (**în lei**)". Consistent with whole-leu amounts.

**⇒ A-2 and A-4 are CONFIRMED by the authoritative source. Rounding is to a whole leu, per line, ties down.**

### CORRECTION to C-4 (I was wrong; recorded here so it does not propagate)

C-4 said the lei→bani migration must go through the art. 66 function. **That is wrong**: art. 66 rounds to a whole leu,
so applying it to a *stored* value would turn a stored revenue of `85.5` lei into `86` lei — exactly the silent money
change the brief forbids. Two distinct operations, both in `src/domain/money.ts`, both named, no arithmetic elsewhere:
- **`roundLeiArt66(bani) → bani`** — the ONE policy rounding: to a whole leu, ≤50 bani neglected, >50 majorated,
  ties down. Used only at the three tax lines.
- **`baniFromLei(lei) → { bani, exact }`** — a pure **unit conversion** for the migration: `Decimal(lei).times(100)`
  (decimal.js-light uses `String(n)`, so `674.505 → 67450.5` exactly). If the result is an integer, it is exact. If it
  is not (a stored value with sub-ban precision, e.g. a snapshot's `674.505`), it rounds to the nearest ban with
  **half-DOWN** (`ROUND_HALF_DOWN`, ties toward zero, consistent with art. 66's „inclusiv") and returns `exact: false`
  so the migration **reports** it instead of silently changing it.
`ROUND_HALF_DOWN` is confirmed present in `node_modules/decimal.js-light/decimal.js`.

---

## 4. SCOUT E — FULL REPORT (received 2026-10-07, complete, verified as a real report)

Session `ScoutE-money-assertions`. **Legend as Scout E wrote it: (R) = the value changes because of art. 66 rounding;
(I) = the literal is re-expressed because the unit becomes integer bani; (F) = the string is formatter-sensitive.**
**My reading (see E-9): MOVE = "sensitive on this axis, must be re-verified", NOT "the number changes".** A whole-lei
amount marked NO is unchanged *in value* but still gets ×100 when it is a persisted/domain amount.

### A. `src/domain/tax.test.ts` — computed engine amounts (unrendered)
| line | literal | pins | MOVE |
|---|---|---|---|
| 206 | `toBeCloseTo(24_478.2, 1)` | total tax @ net 71 280 | YES (R) |
| 243, 255 | `toBe(0)` ×2 | CASS + total, zero/loss year | NO |
| 264 | `toBe(24_615)` | total @ net 72 000 | NO (whole lei) |
| 275 | `toBe(2430)` | CASS at 6 SM min | NO |
| 291, 292 | `15_000` / `10_000` | CASS cap param-driven | NO |
| 305, 323, 343 | `12_150` ×3 | CAS 12 SM floor | NO |
| 314 | `0` | CAS below 12 SM | NO |
| 334 | `0` + `38_000` | pensioner CAS / total | NO |
| 353, 362 | `24_300` ×2 | CAS 24 SM floor | NO |
| 372, 381 | `29_160` ×2 | CASS ceiling | NO |
| 415-420 | `12_150` / `7_128.1` / `5_200.29` / `24_478.39` | CAS, CASS, tax, total @ 71 281 | **YES (R)** |
| 466, 467 | `24_300` / `12_150` | tier2_base param | NO |
| 483, 491 | `50_000` / `55_000` | gross base VAT semantics | NO |
| 497 | `2_430` | CASS owed (art. 174(6)) | NO |
| 502 | `2_000` | deductible CASS | NO |
| 504, 505 | `18_000` / `1_800` | taxable base / income tax | NO |
| 507 | `4_230` | total (B-13) | NO |
| 512-514 | `12_150` / `7_128.1` / `52_002.9` | CAS ded, CASS ded, taxable | **YES (R)** |
| 517 | `24_478.39` | total | **YES (R)** |
| 534-541 | `48_600`/`5_000`/`3_600`/`0`/`53_600` | art. 118(2⁴) cap | NO |
| 553, 556 | `0` / `10_000` | loss year total / loss | NO |
| 600, 601, 606 | `2_000`/`2_000`/`3_800` | CASS, ded CASS, total (salary ≥ 6 SM) | NO |
| 625 | `4_230` (+43 lei) | total, salary < 6 SM | NO |

### B. `src/domain/fiscal/fiscal.test.ts` — calculator line values
`102:4050` · `112,117,122,167,175,201,213,304,329,360:0` · `127,133,183:12150` · `138,143,159,188:24300` ·
`151:37500` · `218,223,228:2430` · `244,272:10000` · `249,254:29160` · `274:15000` · `287,319,391,405,436:1000` ·
`299,324:10000` · `336:4860` · `343:6000` · `355:395000` · `414,426:2_430` + `nonDeductible:1_430` · `445:4_000`.
**All marked NO** — every one is a whole-lei calculator value. **My correction to my earlier guess: `414,426` do NOT move
in value.** They still become `243_000`/`143_000` bani as domain values.

### C. `src/domain/thresholds.test.ts` — all NO
`162:300000-291600` · `174:400000-395000` · `181-184:4860,2430,29160,39500` (warningDistance = 10 %) ·
`193,201:4860/4861` (min-base band edge) · `210,217:-29160/-29161` · `226,233:-39500/-39501` · `313:100000` ·
`369:97200` · `385-387:60000→12150, 97199→12150, 97200→24300` (tier ladder).
**These are the band-edge tests — the ±1 lei boundary. Under integer bani the edge becomes ±100 bani. Highest-risk
rewrite in the suite: an off-by-one here silently moves a threshold.**

### D. `src/domain/aggregation.test.ts`
NO: `135-139:110,100,55,50,55` · `153,167,179:595,119,119` · `188-190,236:0` · `196-198:0,595,-595` · `205,212,224:119,100`
· `275:476` · `303-304,315-316:119,238` · `361-362,371:+238,-238` · `393,399:0,119`.
**YES (I):** `110-112:119/59.5/59.5` · `122-124:1190/474.4/715.6` · `257-259:178.5/47.4/131.1, 238/119/119, 357/0/357` ·
`383-384:119/59.5`.

### E. `src/domain/projection.test.ts`
NO: `119:8.5` (**months, not money**) · `158:{revenue:1200,expenses:0,net:1200}` · `186-187:119,1428,119` · `196:119` ·
`212:70` · `222:14`.
**YES (I): `120-122:126, 180/17, 1962/17` · `128-130:1512, 2160/17, 23544/17` · `148-152:357, 90/-90, 126, 180/17, 1962/17`.**
Scout E: *"projection is where non-integer bani will bite hardest."*

### F. `src/domain/taxReserve.test.ts`
NO: `44-46:18_535/5_000/13_535` · `63-65:5_000/0/0` · `74-76:1_000/0/0` (review_required) · `92-95:18_535/0/0`.
**YES (R): `52:13_535/7` (fractional monthly reserve) · `82-85:20_750→15_750, toBe(1_312.5)`.**

### G. `src/domain/derived.test.ts` — all NO
`111-115:1190,595,595,1190,595` · `154:595` · `192,205,218:1190` · `252:0` · `262-263:119,595` · `274:cashFloorLei 0` ·
`288:5000` · `334:10000` · `345,351,364:30_000` · `357:null`.

### H. `src/domain/insights.test.ts`
**`528: \`${formatLei(1234.567)} RON\` → '1.234,57 RON'` — YES (R+F).** `formatLei` here is a **local mirror**, see O.

### I. `src/data/dashboard.test.ts`
NO: `141,143:1190` · `148-150:1190,595,595` · `160:1190` · `220:1190` · `242:7700` · `245:9317` · `250:395000` ·
`312:7700` · `416:97200` · `443:120000` · `449:24300` · `271: not.toBe(ytd.net)` (9068.34, semantic guard).
**YES (I): `267,417:7494.5` (engine VNA) · `320-324:{7700, 205.5, 7494.5}` · `326-328:7700,205.5,7494.5`.**
**YES (R): `329: toBeCloseTo(6745.05, 6)` taxable base · `330: toBeCloseTo(3104.505, 6)` TOTAL TAX — the half-cent case.**

### J. store / snapshot persistence
| file:line | literal | MOVE |
|---|---|---|
| `store.save.test.tsx:128` | `toBe(750)` persisted `valoareFaraTva` | NO (value) — **but ×100 as a persisted field, see E-9** |
| `store.save.test.tsx:130` | `toBe(142.5)` persisted **fractional** `tva` | **YES (I)** |
| `store.profileBackfill.test.tsx:191` | `toBe(30000)` `salaryIncomeLei` backfill | NO (value) — ×100 as persisted |
| `store.profileBackfill.test.tsx:222` | `-1` rejected | NO |
| `snapshots/hashSync.test.ts:77` | `523456.78`, `6000` hash input | **YES (I)** |
| `Settings.test.tsx:282,343` | `toBe(30000)` ×2 saved salary | NO (value) — ×100 as persisted |
| `Settings.test.tsx:332,359` | `undefined` ×2 backfill absence | NO — **invariant, must stay `undefined`** |
| `Settings.test.tsx:374` | `toBe(0)` `cashFloorLei` | NO |

### K. components (rendered strings) — all YES (F)
`FinancialSummary.test.tsx:11-13 '156.000,00 RON','54.000,00 RON','102.000,00 RON'` · `:21 '0,00 RON'×3` ·
`:26 '-20.000,00 RON'` (negative display — must keep working).
`TaxReserve.test.tsx:21 '15.000,00 RON'` · `:27 '120.000,00 RON'` · `:40 not /0,00 RON/` (no fabricated zero) ·
`:45 'Rămâne de pus deoparte 90.000,00 RON în următoarele 6 luni.'` · `:50 fixtures 120000/0`.
`FinancialChart.test.tsx:170 /1.234,56 RON/` (tax estimate) · `:197-199 'Venituri · Proiecție: 13.000,00 RON'`,
`'Cheltuieli · Proiecție: 4.600,00 RON'`, `'Profit net · Proiecție: 8.400,00 RON'`.
`ThresholdSection.test.tsx:36-38 '12.000,00 lei','6.000,00 lei','1.000,00 lei'` · `:92 not '0,00 lei'` ·
`:116 '97.200,00 lei'`.

### L. pages
`Declarations.test.tsx:17 '9.680,00 RON'` (seed d3 rendered) · `:36,:66 '10.000,00 RON'` ×2 — YES (F).
**`Dashboard.test.tsx:106 /20\.435/` and `:152 /46\.570/` → NO (whole lei).** ← corrects my earlier guess.

### M. e2e
| line | literal | MOVE |
|---|---|---|
| `dashboard.spec.ts:66` | `'9.317,00 RON'` YTD revenue | YES (F) |
| `:78` | **`'3.104,51 RON'`** total tax 3104.505 | **YES (R+F)** |
| `:84` | **`'1.034,84 RON'`** monthly reserve = 3104.505/3 | **YES (R+F)** |
| `:88` | `'3.104,51 RON'` remainingTarget | **YES (R+F)** |
| `:132` | `'3.104,51 RON'` tax hero | **YES (R+F)** |
| `:155` | `'1.034,84 RON'` reserve figure | **YES (R+F)** |
| `:157` | `'Rămâne de pus deoparte 3.104,51 RON în următoarele 3 luni.'` | **YES (R+F)** |
| `:176,182,187,188,192` | `'Prag: 48.600,00 lei'`, `97.200,00`, `24.300,00`, `291.600,00`, `395.000,00` | YES (F) |
| `:198` | `/Curent: 7\.494,50 lei/` ×4 (VNA) | **YES (R+F)** |
| `:199` | `/Curent: 7\.700,00 lei/` ×1 | YES (F) |
| `:202` | `/Curent: 9\.317,00 lei/` ×0 (negative guard) | YES (F) |
| `:603-604,618-620,643,656,675` | `'202.000,00 RON — Realizat'` (`MONTHLY_TOTAL = 202_000` at `:510`) | YES (F) |
| `~:767,775,782` | `/46\.570/` ×3 (CAS 24.300 + CASS 13.000 + tax 9.270) | YES (F) — **whole lei, must NOT change value** |
| `:831` | `/Curent: 0\.000,00 lei/` ×0 | YES (F) |
| `:835` | `/Curent: 130\.000,00 lei/` | YES (F) |
| `:836` | `'Prag: 395.000,00 lei'` | YES (F) |
| `settings.spec.ts:148` | `toBe(30000)` persisted salary | NO (value) — **×100, it is a persisted field** |
| `:170` | `toBeUndefined()` | NO — invariant |
| `:222` | `/3\.800/` total tax (salary ≥ 6 SM) | NO (whole lei) |
| `:233` | `/4\.230/` total tax (alin. (6)) | NO (whole lei) |

### N. money TEXT / citation assertions — **NO-MOVE, changing one is a regression**
`Settings.test.tsx:373 'Valoare invalidă (lei, ≥ 0).'` · `regimes.test.ts:77 not.toMatch(/\d+\s*lei/)` ·
`deadlines.test.ts:186` title cites `395.000 lei` (no numeric assert) · `thresholds.test.ts:409 not.toMatch(/\d{3}/)` ·
**`fiscal/fiscal.test.ts:259 toContain('derivata din 291600 x 0.1')`** · `ThresholdSection.test.tsx:115` comment naming
`97.200 lei`.

### O. local mirror formatters defined INSIDE tests — must be deleted, they hide formatter regressions
| file:line | mirror | pins |
|---|---|---|
| **`e2e/dashboard.spec.ts:577-579`** | `fmtRON = Intl.NumberFormat('ro-RO',{min/max 2}) + ' RON'` | drives **every `RON` cell in that file** — a 7th formatter instance, in the test itself |
| **`src/domain/insights.test.ts:102-107`** | `formatLei = Intl.NumberFormat('ro-RO',{min/max 2})` | `1234.567 → '1.234,57'` |
| `src/data/dashboard.test.ts:270` | comment pins `9068.34` as VAT-incl net | documents, not asserts |

### P. seed money (`src/data/seed.ts`) and who asserts it
`r1 4500/945`, `r4 3200/672` (inregistrata) → `dashboard.test.ts:242 7700`; `e2e:66 9.317,00`, `:199 7.700,00`.
`r2 1200/252`, `r3 800/168` (excluded) → implied by `9317` vs `7700`.
`e1 120/25.2`, `e2 85.5/17.96` (inregistrata) → `dashboard.test.ts:322,327 205.5`.
`e3 340/71.4` (respinsa) → implied by `205.5`. `d1 12500/1800`, `d2 14200/2100` → not asserted.
`d3 9680/546` → `Declarations.test.tsx:17 '9.680,00 RON'`. `cotaTva: 9` → Settings (indirect).
`cashFloorLei: 0` → `Settings.test.tsx:374`, `store.migration.test.ts:93`.
derived `9317 / 7700 / 205.5 / 7494.5` → `dashboard.test.ts:245,242,327,267,323,328,417`; `e2e:66,198,199`.
derived **`6745.05 / 3104.505 / 1034.835`** → `dashboard.test.ts:329-330`; `e2e:78,84,88,132,155,157`.
**Fractional seed values needing exact ×100: `tva 25.2`, `valoareFaraTva 85.5`, `tva 17.96`, `tva 71.4` → `2520, 8550, 1796, 7140` bani. All exact.**

### Q. fractional money round-tripped through save/load
`store.save.test.tsx:130 tva: 142.5` written then read back `toBe(142.5)` — **the only fractional persisted round-trip.**
`store.save.test.tsx:128 valoareFaraTva: 750` (whole, same cycle). `hashSync.test.ts:77 revenues: 523456.78` (hash input).
`schema.test.ts:95,117,285,301` and `store.load.test.tsx:98` use whole `inputSnapshot: { revenues: 1000 }`.
**No test round-trips a fractional tax amount through storage.**

### Decisions driven by Scout E (these REPLACE the E-1…E-6 I wrote from inference)
- **E-1 The brief's `PIN` exemption does not exist.** Real exemption: a pinned `new Date('…')` **with an argument** (the
  guard regex requires an empty arg list, asserted at `wallClockGuard.test.ts:71`) or fake timers. `e2e/**` is never
  scanned (`:37` globs `/src/**` only). **Do not weaken the guard.** Report the false claim.
- **E-2 Only genuinely fractional amounts change value under art. 66.** Confirmed set: `tax.test.ts:206,415-420,512-517`;
  `taxReserve.test.ts:52,82-85`; `dashboard.test.ts:329,330`; `insights.test.ts:528`;
  `e2e/dashboard.spec.ts:78,84,88,132,155,157`. **Negative controls that must NOT change value: `24_615`, `2430`,
  `12_150`, `24_300`, `29_160`, `2_430`, `4_230`, `3_800`, `46.570`, `20.435`, `4860/4861`, `-29160/-29161`,
  `-39500/-39501`, `60000→12150 / 97199→12150 / 97200→24300`.** If one of those moves, I broke something.
- **E-3 Bases stay exact, never rounded** (A-3 boundary): `6745.05` taxable base, `7494.5` VNA, `205.5` deductible
  expenses, all `thresholds.test.ts` params. They become integer bani (`749450`, `20550`, `674505`) — value-preserving.
  **`6745.05` is a base, so it must NOT be art. 66-rounded to `6745`.** This is the single easiest place to over-round.
- **E-4 Projection (`/17` fractions) is the hardest part of T1.** A per-month split of integer bani cannot be exact for
  every denominator. Decision: keep projection in **decimal intermediates**; convert to integer bani only when a month is
  displayed or summed; pin by test that the months still sum to the total. **A projection is not a "sum due" — art. 66
  does not apply to it.** Do not invent rounding there.
- **E-5 Keep formatter-sensitive strings word-for-word unchanged wherever the amount is unchanged**, so a formatter
  regression cannot hide inside a mass expectation rewrite.
- **E-6 Delete both test-local mirror formatters** (`e2e/dashboard.spec.ts:577-579`, `insights.test.ts:102-107`) as part
  of T2. They are the reason half-up rounding looked pinned, and the e2e one means the e2e suite currently asserts a
  formatter that is not the app's formatter.
- **E-7 `fiscal.test.ts:259` and the five other NO-MOVE text assertions in N are untouchable.** Any diff there is a bug.
- **E-8 `thresholds.test.ts` band edges (`4860/4861`, `-29160/-29161`, `-39500/-39501`, the tier ladder) are the
  highest-risk rewrite.** Under bani the ±1 lei edge becomes ±100 bani. Rewrite them as `lei(4860)`/`lei(4861)` and keep
  the adjacency explicit.
- **E-9 Scout E's MOVE column is about VALUE change, not unit re-expression.** Evidence: it marks `store.save.test.tsx:128
  toBe(750)` and `settings.spec.ts:148 toBe(30000)` NO, yet both are **persisted** money that must become `75000`/
  `3000000` bani. So: treat every persisted/domain money literal as re-expressed in bani; use Scout E's (R)/(I)/(F) tags
  to find which ones change *value*. **Mitigation: introduce a test helper `lei(n) → Bani` and write expectations as
  `lei(2430)`, so the unit change does not destroy readability and the negative controls stay visible.**

---

## 5. STATE AT 2026-10-07 ~15:50 — foundation LANDED and green

**Commit `a232576`** `feat(money): Phase 10 foundation — Bani representation, art. 66 rounding, single display
conversion` — 2 files, +418. HEAD before it: `f6d7cd8`.
**Verified: `npx tsc --noEmit` → 0 · `npm run test` → 45 files / 705 tests passed** (baseline was 44/685; +1 file,
+20 tests). No existing test was touched. No source file other than the two new ones was modified.

### What `src/domain/money.ts` actually provides (the API everything else must use)
- `type Bani = number & { __brand:'bani' }` — branded, so a plain `number` cannot be passed as money (D-1).
- `lei(n): Bani` — exact lei→bani for literals/seed/tests; **throws** on a fractional-lei literal.
- `baniFromLei(n): { bani: Bani|null, exact: boolean }` — the **migration's unit conversion**, deliberately
  *not* art. 66 (see the C-4 correction). `Decimal(value).times(100)`; exact when ≤2 decimals; otherwise
  `toDecimalPlaces(0, ROUND_HALF_DOWN)` and `exact:false` so the caller must surface it. Non-finite ⇒
  `bani: null`, **never 0**.
- **`roundArt66(Decimal | number): Bani`** — the ONE policy rounding. Takes the **unrounded Decimal sum**.
  `wholeLei = magnitude.div(100).toDecimalPlaces(0, ROUND_FLOOR)`; `fraction = magnitude − wholeLei×100`;
  `fraction <= 50` → down, else up. `roundLeiArt66` is an exported alias.
- `sumBani(Bani[])`, `applyRateDecimal(baseBani, ratePercent): Decimal` (rate math in decimal, unrounded),
  `formatBani` / `formatBaniRON` / `formatBaniLei` / `formatBaniOrDash`, `isBani`.
- **`formatBani` performs NO rounding** — integer arithmetic + `.`/`,` grouping. That is the structural fix
  for B-17: there is no formatter rounding policy left to disagree about.
- Guards reject floats: `formatBani`, `sumBani`, `applyRateDecimal`, `roundArt66` all throw on a non-integer.

### Two bugs the tests caught (recorded so they are not re-introduced)
1. **`roundArt66` must floor to LEI, not to bani.** First version did `magnitude.toDecimalPlaces(0,FLOOR)`,
   which floored the *bani*, giving `67450.5 → 6.745.000` bani. Fixed to `magnitude.div(100)…`.
2. **Order matters: art. 66 must see the unrounded sum.** `674.505 lei` = `67450.5` bani → fraction `50,5` > 50
   → **675 lei**. If you truncate to `67450` bani first you get **674 lei** — a different tax. Pinned by test.

### Facts the tests now pin (verified, not assumed)
- `roundArt66`: `49→0`, `50→0` (tie down), `51→100`, `99→100`, `149→100`, `150→100`, `151→200`,
  `lei(2430)→243000` unchanged; `Math.round(674.5)*100 = 67500 ≠ roundArt66(67450) = 67400`.
- `applyRateDecimal(lei(6745.05), 10).toString() === '67450.5'` exactly → `roundArt66` → `67500` = **675 lei**.
  So the seeded total becomes `243000 + 67500 = 310500` bani → **`3.105,00 RON`**, monthly `103500` → `1.035,00`.
- `71.4 * 100 === 7140.000000000001` in float (71.4 is a real seed value, `expenses.e3.tva`) but
  `baniFromLei(71.4)` → `7140`, `exact:true`. `1.005*100 === 100.49999999999999` while the true midpoint is
  `100.5`; the Decimal path resolves it by stated policy (half-DOWN → `100`), not by which side the noise fell.
- The old B-17 pair is characterised in-test: `Intl` on `674.505` → `'674,51'`, `toFixed(2)` → `'674,50'`,
  and they are asserted **unequal** — so a future regression that re-introduces either is caught.

### OPEN DECISION put to the orchestrator (I stopped rather than guess)
T1's true size, from the Scouts: ~15 source files + ~22 `fmtRON` call sites in 9 components + **~200 numeric
literals across 20 test files** + e2e expectations + the two in-test formatter mirrors. Options put: (a) full T1
now, (b) land T2/T3/T4/T5 green and hand T1 back as an executable spec, (c) storage-only T1 with a permanent
conversion boundary. **Recommendation given: (b).** I have not started T1 and will not until the answer lands.
