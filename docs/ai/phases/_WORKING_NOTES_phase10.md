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

---

## 6. SCOPE CHANGED TO (a) — FULL T1 NOW. THIS IS THE RESUME POINT.

**Orchestrator reversed its own (b) acceptance: "take (a). Full T1, now. The user has decided to finish Phase 10
in this pass rather than defer the representation change."** Record this in `DECISIONS:` explicitly: I recommended
(b), the **user overrode to (a)**, the orchestrator relayed it. Do not imply it was my choice or theirs alone.

### Commits so far (all green)
- `f6d7cd8` — brief 12 (baseline HEAD at phase start)
- `a232576` — **`src/domain/money.ts` + `src/domain/money.test.ts`** (the seed module; +20 tests)
- `c2b33ea` — **`docs/ai/phases/10_money_precision.md`** — the complete T1 spec. **§2.1 file inventory ·
  §2.2 v4→v5 migration design · §2.3 snapshot/hash hazard · §2.4 test-literal plan · §2.5 formatter mirrors ·
  §2.6 acceptance.** READ THAT SECTION INSTEAD OF RE-DERIVING THE PLAN.
- Baseline at `f6d7cd8`: tsc 0 · 44 files / 685 tests · build 0 · e2e 34. After `a232576`: tsc 0 ·
  **45 files / 705 tests**.

### The rule that survives the scope change
**The phase ends green at all four checks, or reverted to the last green commit with an honest report.** Not
"green except e2e", not "tsc clean but tests red". If context runs low: **stop at the last green commit and say
exactly how far you got.** Partial-but-green is a good outcome; complete-but-red is a failure.
**NEVER restore green by deleting, weakening, skipping or `.todo`-ing an assertion.** Every assertion whose
*value* changes must be justified in the commit message by art. 66 or by the unit conversion — if I cannot say
why the old value was wrong, I changed behaviour instead of fixing it: stop and flag.
Red intermediate commits tolerated **only** if the next commit restores green and the message says what is
temporarily red and why. Commit often.
**If the snapshot-hash problem or the migration edge case has an unclear right answer → `ask_question`, do not
invent a rule.** Those two are where a plausible guess does real damage.

### Execution queue (bottom-up, tsc-driven). Status: NOTHING STARTED yet.
1. ☐ **Types/schemas** — change the type, then `npx tsc --noEmit`, and **work the error list** rather than
   hunting by eye. That is faster and complete. Order: `fiscal/rules.ts` `FiscalParameter.value` ·
   `fiscal/calculators.ts` `CalculatorInput.base` · `aggregation.ts` `YtdTotals` · `snapshots/types.ts`
   `CalculationLine.value` · `models.ts` `PfaProfile.cashFloorLei` · persisted schemas (`data/schema.ts`,
   `domain/schema.ts`) · `data/types.ts` fields · `seed.ts`.
2. ☐ **v4→v5 migration step** (`money-bani`, from 4 → to 5, `CURRENT_DATA_VERSION = 5`). Spec in phase doc §2.2.
3. ☐ **Snapshot/hash hazard** — re-derive `inputsHash`, preserve `preMigrationInputsHash`. Phase doc §2.3.
   **The single most likely place for a silent break. Do not skip.**
4. ☐ **Display last** — the ~22 `fmtRON` sites in 9 components → `formatBaniRON`; T4: no money arithmetic in
   JSX, incl. the `rows.reduce` at `Documents.tsx:462` and the CSV `toFixed(2)` at `Documents.tsx:417`.
5. ☐ **Test literals** — ~200 across 20 files + e2e, **with a script**, then read the diff of every test file
   and confirm each change is a unit conversion, not a re-pointed expectation. Use a `lei(n)` helper.
6. ☐ **Delete the two test-internal formatter mirrors** and **replace** them with assertions on real app output
   (rendered screen text + actual CSV bytes). Pin B-17 through both paths to one value.
7. ☐ **Register honesty**: never write "Phase 10 complete". Close B-17/B-18/B-20/B-16 **only if genuinely
   closed** — B-18 and B-20 in `STATE.md` describe *different, already-closed* defects (see §1 above), so do NOT
   write "B-18 closed"/"B-20 closed"; close **B-17** (real) and open new rows for the rest. B-16 (fiscal-loss
   persistence) is NOT closed by this phase.
8. ☐ Measure all four numbers at final HEAD with a clean tree.

### Exact declaration text for step 1 — **VERIFIED BY RE-READ AFTER COMPACTION (2026-10-07 ~16:05)**
The first version of this section and the "Persisted-schema money fields" section below were written from reads made
*before* a compaction, so every line was re-read from disk and confirmed. Two line numbers were wrong and one claim was
understated; both corrected in place below. Nothing else changed.
`src/domain/fiscal/rules.ts` — `FiscalParameter` is:
```ts
export type FiscalParameter = {
  id: string;
  label: string;
  value: number | string;
  unit: 'lei' | 'percent' | 'date' | 'count' | 'days' | 'text';
  description?: string;
};
```
`unit` is the **only machine-readable money marker** and nothing renders it. `value: number | string` is shared
by lei/percent/date/count/days/text, so it **cannot simply become `Bani`** — the options are (i) keep
`number | string` and convert at the `paramNumber` funnel (`calculators.ts:86`), or (ii) split the type on
`unit`. **Decision taken: (i)** — `paramNumber` becomes the unit-aware funnel; `unit:'lei'` values in
`package2026.ts` become integer bani, `unit:'percent'` values stay unscaled integers. This keeps one rule-store
type and puts the unit decision in one function.

`src/domain/snapshots/types.ts` — `CalculationInput.revenues: number` (`:23`) / `.expenses: number` (`:25`), comments
read `/** Total revenues (valoareFaraTva), lei. */` — **update the comments too**; `CalculationLine.value: number`
(**`:31`**, not `:30`); `CalculationOutput.total: number` (**`:45`**, not `:42`). `CalculationLine` also carries `reviewRequired?: boolean` + `reason?: string`
(B-19) — **the amount must stay exactly what the engine computed; the marker is on the LINE, not a change to the
number.** Do not "fix" an unverified line by rounding it.

### Facts already verified that must not be re-derived
- `roundArt66` takes the **unrounded Decimal sum**; `formatBani` does **no rounding**. Keep this separation — it
  is what makes T1 safe.
- Seeded chain after art. 66: income tax `674,505 → 675` lei, CASS `2 430` unchanged, total `3 104,505 → 3 105`
  lei, monthly `1 034,835 → 1 035` lei. So e2e `3.104,51 RON → 3.105,00 RON`, `1.034,84 → 1.035,00`.
- `baniFromLei` is the migration's **unit conversion**, never `roundArt66` (art. 66 would turn a stored `85.5`
  lei revenue into `86` lei).
- `71.4 * 100 === 7140.000000000001` (a real seed value, `expenses.e3.tva`); `baniFromLei(71.4)` → `7140`,
  `exact:true`.
- The migration step **must not throw** — a throw quarantines the payload and the save effect overwrites the
  main key with seed. Surface unconvertible values as `review_required`.
- **Never write `null` into an optional persisted money field — omit the key** (no persisted field is
  `.nullable()`; `.optional()` rejects `null`).
- **Do NOT add `.int()` to the load gate** — parse runs before migration and would quarantine real data.
- The brief's `PIN` exemption **does not exist**; the real exemption is a `new Date('…')` **with an argument**
  or fake timers. Never weaken `src/test/wallClockGuard.test.ts`.
- `totalDue` has **zero matches in non-test `src/`** — T3's field name does not exist in current source. Find the
  real total field before "fixing" it.
- No `Math.round` exists in `FinancialChart.tsx`; the brief's B-18 description is false. Real float accumulation
  is `aggregation.ts:224-232` and `projection.ts:67,73`.

### Persisted-schema money fields (read verbatim, `src/data/schema.ts`)
- `:36` `const nonNegative = z.number().min(0);` — shared by `valoareFaraTva` (`:48`, `:65`), `tva` (`:49`, `:66`),
  `venituri`/`cheltuieli` (`:84`, `:85`). **Do not add `.int()` here** (parse runs before migration).
- Snapshot: `:145-146` `revenues: z.number()` / `expenses: z.number()`; `:155` `value: z.number()`;
  `:164` `output: z.object({ total: z.number() })`.
- `:418-428` — **eleven** `Expect<Equal<z.output<typeof X>, Y>>` assertions, not four: `revenueSchema`,
  `expenseSchema`, `clientSchema`, `declarationSchema`, `documentItemSchema`, `companyDocumentSchema`,
  `taxStatementSchema`, `ruleReleaseSchema`, **`taxCalculationSnapshotSchema`**, `settingsSchema`,
  **`persistedAppDataSchema`**. (My earlier note listed only four — understated.) **These force the zod output and the
  TS types to stay identical. The snapshot and root-payload ones are the ones that will bite in T1: changing
  `CalculationLine.value` to `Bani` without changing `value: z.number()` at `:155` is a compile error. Do not delete
  an assertion to get tsc green — fix both sides.**
- `src/domain/schema.ts`: `:71` `salaryIncomeLei: z.number().min(0).finite().optional()`, `:82`
  `cashFloorLei: z.number().min(0)`.
- `src/domain/models.ts`: `:173` `salaryIncomeLei?: number;`, `:199` `cashFloorLei: number;` — **both named `…Lei`;
  rename to `…Bani` or keep the name and change the unit. Renaming touches the persisted key, which is a data
  migration, not a type change. Decision: rename the *type*, keep the *persisted key* stable where possible, and
  say so in the migration step.**
- `src/data/seed.ts` money lines, verbatim: revenues `:40-43` (`4500/945`, `1200/252`, `800/168`, `3200/672`);
  expenses `:46-48` (`120/25.2`, `85.5/17.96`, `340/71.4`); declarations `:56-58`
  (`12500/1800`, `14200/2100`, `9680/546`); `:16` `cashFloorLei: 0`.

---

## 7. T1 EXECUTION IN PROGRESS — TREE IS CURRENTLY RED. READ THIS FIRST AFTER COMPACTION.

**Status at this moment: MID-MIGRATION, NOT GREEN.** tsc had ~201 errors at last full measure (34 of them in
non-test source). The last green commit is the notes commit before I started editing types. If context runs out
before I get back to green: git reset --hard to the last green commit and report honestly. NEVER hand off a red tree.

Git state right now (uncommitted work is the T1 type migration):
$(git status --short)
HEAD: $(git log --oneline -1)

### What is DONE in this pass (uncommitted)
1. **src/domain/money.ts** — (a) **BUG FIX: lei() now scales through Decimal, not amount*100.** Reason, verified:
   71.4*100 === 7140.000000000001, and 71.4 is a real seed value (expenses.e3.tva), so lei(71.4) threw while
   lei(17.96) passed. Whether a literal works must not depend on which side the float noise falls. lei() now also
   rejects non-finite. (b) NEW helpers appended: **leiInputValue(bani) -> plain lei string for an <input value>**
   (2430000 -> '24300', 8550 -> '85.50'; exact, no grouping) and **parseLeiInput(text) -> Bani|null** (accepts , or
   .; returns null for non-finite OR sub-ban precision — a REFUSAL, not a silent round; caller reuses its existing
   'Valoare invalidă (lei, ≥ 0).' message, which is a NO-MOVE text assertion in Settings.test.tsx:373).
   money.test.ts now has 22 tests (added a describe pinning lei(71.4)=7140 etc. and that lei(0.005) throws).
2. **src/data/types.ts** — Revenue/Expense valoareFaraTva+tva, Declaration venituri+cheltuieli -> Bani. total() ->
   sumBani([r.valoareFaraTva, r.tva]). fmtRON NOT deleted yet (display step still to do).
3. **src/data/schema.ts** — added helper: const bani = (schema: z.ZodNumber = nonNegative) => schema.transform((n) => n as Bani);
   applied to the 6 record money fields and to snapshot revenues/expenses/value/total. **Load gate stays permissive
   (no .int()) — parse runs before migration.** The 11 Expect<Equal<...>> assertions all still present.
4. **src/domain/snapshots/types.ts** — CalculationInput.revenues/expenses: Bani (comments updated, hash hazard
   documented), CalculationLine.value: Bani, CalculationOutput.total: Bani.
5. **src/domain/models.ts** — import type Bani added at line 1; salaryIncomeLei?: Bani; cashFloorLei: Bani.
   **DECISION: keep the persisted KEY names (…Lei) unchanged, change only the type.** Reason: safeParse runs before
   the chain and zod strips unknown keys, so requiring a new key would reject every v4 payload and quarantine it.
   The stale name is documented on the field as a known hazard; the Bani brand is what makes it non-exploitable.
6. **src/domain/schema.ts** — import type Bani; salaryIncomeLei -> .transform(n => n as Bani).optional(); cashFloorLei
   -> .transform(n => n as Bani).
7. **src/data/seed.ts** — 21 money literals wrapped in lei(...) by a python regex over
   (valoareFaraTva|tva|venituri|cheltuieli|cashFloorLei): <number>. cotaTva untouched (percent). Import added.
8. **src/domain/profile.ts** — import lei; createDefaultProfile cashFloorLei: lei(0).
9. **src/domain/snapshots/snapshot.ts** — CreateSnapshotParams.revenues/expenses -> Bani (doc: convert BEFORE
   calling or the digest carries float noise).
10. **src/data/migration.ts** — imports baniFromLei/lei/Bani + Revenue/Expense/Declaration; DATA_VERSION_MONEY_BANI = 5;
    CURRENT_DATA_VERSION = DATA_VERSION_MONEY_BANI; default-profile cashFloorLei: lei(0); **new exported
    MoneyPrecisionNotice interface + convertMoneyToBani(input) -> {data, notices} + migrateMoneyBaniV5**, and the
    chain entry {from: 4, to: 5, name: 'money-bani', apply: migrateMoneyBaniV5}.

### THE CURRENT BLOCKER (fix this first)
migration.ts L455: 'moneyNotices' does not exist in type 'PersistedAppData'.
FIX: add to src/data/schema.ts — PersistedAppData gets moneyNotices?: MoneyPrecisionNotice[] AND
persistedAppDataSchema gets the matching optional field (zod strips undeclared keys, so an undeclared report is
erased on the next load = the "vanish" the brief forbids). Watch the Expect<Equal<z.output<persistedAppDataSchema>,
PersistedAppData>> assertion: both sides must match exactly. Import MoneyPrecisionNotice type into schema.ts from
./migration (check for a circular import — migration.ts imports PersistedAppData from schema.ts; a type-only import
back is erased at compile time, so it is safe, but verify tsc agrees).
Also 4 ast-grep warnings: no-conditional-empty-object-spread x4 in convertMoneyToBani (the ...(input.expenses ? {...} : {})
pattern) — style only, but consider restructuring if cheap.

### Remaining queue (from the 34 non-test errors + known semantic gaps)
- src/domain/tax.ts — 22 errors. THE HARD ONE: the three art. 66 lines (income tax, CAS, CASS owed) must go through
  applyRateDecimal(...) then roundArt66 ONCE; bases stay exact integer bani, never rounded.
- src/pages/{Revenues,Expenses,Declarations}.tsx — form submit: parseFloat -> parseLeiInput, null -> existing error msg.
- src/pages/Settings.tsx — pre-fill must use leiInputValue (raw bani in an input = the "raw 67450 on a screen" rule);
  save must use parseLeiInput. Lines ~87,94 (pre-fill), ~159,167,184,190 (save).
- **tsc will NOT find these** (Bani is assignable to number): must deliberately change signatures in
  domain/fiscal/calculators.ts (CalculatorInput.base, chosenBase, salaryIncomeLei, CalculatorResult.value,
  nonDeductible; paramNumber unit-aware per decision (i)), domain/aggregation.ts (YtdTotals, MonthlyTotals,
  Threshold.current/limit, the += at :224-232 -> sumBani), domain/thresholds.ts, domain/taxReserve.ts,
  domain/projection.ts (keep decimal intermediates; art.66 does NOT apply to a projection), domain/derived.ts,
  domain/insights.ts, data/dashboard.ts (delete the *100 cents bridge :299-302 and insights.ts:43-44 divide-back).
- Display: delete fmtRON, route 22 call sites to formatBaniRON; lib/format.ts formatLei -> formatBaniLei;
  Documents.tsx:417 CSV toFixed(2) and :496,500,505 toLocaleString -> formatBani*; Documents.tsx:462 rows.reduce
  money arithmetic out of JSX (T4).
- Tests: ~200 literals across 20 files + e2e. USE A SCRIPT, then read every diff. Negative controls in §2.4 of the
  phase doc must not change value. store.migration.chain.test.tsx :163-172,184-199,203-212,214-223,265-292,345-359,
  381-396 must be re-scoped deliberately with the reason written down.
- New tests needed: 142.5 -> 14250 exact with no notice; 674.504 -> 67450 WITH a notice; NaN carried unchanged +
  notice, never 0; snapshot inputsHash re-derived + preMigrationInputsHash preserved; the "step threw -> quarantine
  with 'migration failed:'" path (nothing pins it today).
- Register: open B-25 (money precision) in docs/ai/STATE.md — it does NOT exist yet (verified: grep -c B-25 = 0).
  Close B-17 only if genuinely closed. Do NOT write B-18/B-20 closed.

### Facts re-verified this pass (do not re-derive)
- tsc at last green: 0. Unit tests at last green: 45 files / 705 tests. money.test.ts alone: 22 passing.
- 25.2*100, 17.96*100, 85.5*100, 142.5*100, 7494.5*100, 6745.05*100, 523456.78*100 are all safe integers;
  71.4*100 and 1234.567*100 are NOT.

---

## 8. STATE AT SECOND COMPACTION — GOOD PROGRESS, TREE STILL RED, 2 ERRORS FROM CLEAN SOURCE

Read §7 too (it lists what was already done). This section is what changed since §7.

### Safety net
- Last GREEN commit: 87fc202 (docs only; tsc 0, 45 files / 705 tests).
- Branch wip/phase10-t1-bani exists (was at 257c0e2). **RE-POINT IT before any reset** — it is stale now.
- Rule unchanged: end green at all four checks, or reset --hard to 87fc202 and report honestly. NEVER hand off red.

### DONE since §7 (all verified by tsc, not by eye)
1. **Blocker cleared**: data/schema.ts now declares `moneyNotices?: MoneyPrecisionNotice[]` on PersistedAppData AND
   on persistedAppDataSchema (converted uses `bani(z.number()).optional()` so the Equal<> assertion holds). Type-only
   import from ./migration — no circular-import problem, tsc agrees. Also removed a genuinely unused `BankAccount`
   import from data/schema.ts (was a lint blocker).
2. **src/domain/money.ts** — three new exports appended:
   - `leiText(bani): string` — shortest EXACT lei string via `Decimal(bani).div(100).toString()`. For PROSE only
     (calculator breakdown notes, engine review reasons). Keeps `fiscal.test.ts:259`
     `toContain('derivata din 291600 x 0.1')` byte-identical: 29160000 bani -> '29160', and 749450 -> '7494.5'.
   - `subBani(a,b): Bani`, `addBani(a,b): Bani` — needed because `Bani + Bani` widens to `number` and drops the brand,
     so `+=` and unary `-` cannot be used on money.
3. **domain/fiscal/package2026.ts** — all 10 `unit:'lei'` params wrapped in `lei(...)` by regex
   (`value: N, unit: 'lei'` -> `value: lei(N), unit: 'lei'`). `unit:'percent'` params untouched (25, 10 stay unscaled).
   Import added.
4. **domain/fiscal/calculators.ts** — CalculatorResult.value/nonDeductible -> Bani; CalculatorInput.base/
   salaryIncomeLei/chosenBase -> Bani. NEW `paramBani(rule,id)` = the unit-aware funnel (decision (i)): throws if the
   parameter's `unit` is not 'lei', or if the value is not an integer. `paramNumber` kept for percents only.
   Rate math is now `roundArt66(applyRateDecimal(base, ratePercent))` — ONE art. 66 rounding per sum due, inside the
   calculator, so `total = sumBani(rounded lines)` can never round twice. `Math.max/Math.min` replaced by ternaries
   (they return plain number and would drop the brand) — 2 prefer-math-min-max advisories are deliberate, documented.
   `nonDeductible = subBani(floorCass, due)` so `value - nonDeductible === due` holds exactly.
   49 prose interpolations now go through `leiText(...)`; `${rate}` became `${ratePercent / 100}` so the sentences
   still print 0.1 / 0.25.
5. **domain/tax.ts** — all money in/out is Bani (TaxCalculationInput, FiscalLossCarryForward.amount, TaxAmountBases).
   NEW local `exactBani(Decimal): Bani|null` — accepts an intermediate ONLY if already integral; the proration
   products go through it and a non-integer returns `review_required` instead of inventing a rounding rule
   (art. 66 rounds sums DUE, never bases or deductions — the A-3 boundary). Proration ratios are now `Decimal`
   (that is where 7_128.1 / 52_002.9 came from). `Decimal.max` does NOT exist in decimal.js-light — use
   `.isNegative() ? new Decimal(0) : x`. Guard messages use `leiText(...)` so they still read in lei.
6. **domain/aggregation.ts** — YtdTotals, MonthlyTotals, Threshold.current/limit -> Bani; `recordTotal` -> sumBani;
   the four `+=` accumulators -> `addBani`; `net` -> subBani. This is what fixed dashboard.ts:93-96 and derived.ts
   without touching those call sites.
7. **domain/thresholds.ts** — ThresholdBases, FiscalThreshold.currentValue/thresholdValue/distance/warningDistance,
   statusFor params, RatioRule.current/limit -> Bani. `warningDistance` was `thresholdValue * 0.1` (float: 486000*0.1
   = 48600.000000000004) -> now `Math.floor(thresholdValue / 10)`, documented as a presentation band (not a legal
   figure), floored so it can never exceed 10%.
8. **domain/derived.ts** — TaxInputsReference.salaryIncomeLei -> Bani|null, cashFloorLei -> Bani, RecordLine
   total -> sumBani, the local record constraint's valoareFaraTva/tva -> Bani.
9. **Write boundary (the semantic part tsc could NOT find)** — pages/Revenues.tsx, Expenses.tsx, Declarations.tsx,
   Settings.tsx: `parseFloat`/`Number` -> `parseLeiInput` (returns null for non-finite OR sub-ban precision = a
   REFUSAL, never a silent round); edit-mode pre-fill `String(initial.valoareFaraTva)` -> `leiInputValue(...)`
   (raw bani in an input was the "67450 on a screen" violation); Settings pre-fill for salaryIncomeLei/cashFloorLei
   same. All error messages kept word-for-word ('Introduceți o valoare validă', 'Introduceți un TVA valid',
   'Valoare invalidă (lei, ≥ 0).' — the last is a NO-MOVE assertion at Settings.test.tsx:373). Settings keeps three
   states: undefined = empty field, null = unparseable, number = valid.
   Pattern used to avoid casts: after `if (Object.keys(e).length) return;` add
   `if (v === null || t === null) return; // unreachable; narrows without a cast`.

### THE ONLY 2 REMAINING NON-TEST ERRORS (fix these first)
- pages/Settings.tsx:189 `salaryIncomeLei: fiscal.salaryStatus === 'da' ? salary : undefined` — `salary` is
  `Bani | null | undefined`. Fix: `? (salary ?? undefined) : undefined` is WRONG (it would turn an invalid value
  into "not recorded"). Correct: that line is only reached when validation passed, so narrow explicitly, e.g.
  `salaryIncomeLei: fiscal.salaryStatus === 'da' ? (salary as Bani) : undefined` — but prefer an explicit
  unreachable-guard like the pages pattern instead of a cast.
- pages/Settings.tsx:195 `cashFloorLei: cash` where cash is `Bani | null` — same guard pattern.

### STILL TO DO (the big remaining blocks)
- **domain/taxReserve.ts** — reservedAmount / estimatedTaxLiability / remainingTarget / recommendedMonthlyReserve
  -> Bani. `remainingTarget = Math.max(0, estimatedTaxLiability - (reservedAmount ?? 0))` is the B-17 origin value.
  Monthly reserve 13_535/7 is fractional -> decide: keep Decimal and convert at display, do NOT art.66 a reserve.
- **domain/projection.ts** — the `/17` fractions. Keep decimal intermediates, convert at display; months must still
  sum to the total; art. 66 does NOT apply to a projection.
- **domain/insights.ts + data/dashboard.ts** — DELETE the lei->cents bridge (dashboard.ts:299-302 `*100`) and the
  divide-back (insights.ts:43-44 `/100`); the `taxReserve.*Cents` fields in DashboardSnapshot are already integer
  cents and must not be double-converted. insights.ts:125 Math.round(ratio*100) is a PERCENT — leave it.
- **Display**: delete `fmtRON` (data/types.ts:186-189) and route its 22 call sites to `formatBaniRON`
  (FinancialSummary 3, FinancialChart 5, TaxReserve 5, Revenues 3, Declarations 3, Dashboard 6, Expenses 4,
  EFactura 1); lib/format.ts `formatLei` -> `formatBaniLei` (ThresholdSection 3 sites); Documents.tsx:417 CSV
  `toFixed(2)` and :496,500,505 `toLocaleString` -> formatBani*; Documents.tsx:462 `rows.reduce` money arithmetic
  out of JSX (that is T4).
- **Tests**: ~475 test errors now. Script the mechanical re-expression with `lei(...)`, then hand-fix ONLY the
  value-changers from §Scout E-2: tax.test.ts:206,415-420,512-517; taxReserve.test.ts:52,82-85;
  dashboard.test.ts:329,330; insights.test.ts:528; e2e/dashboard.spec.ts:78,84,88,132,155,157.
  NEGATIVE CONTROLS that must NOT change value: 24_615, 2430, 12_150, 24_300, 29_160, 2_430, 4_230, 3_800,
  46.570, 20.435, 4860/4861, -29160/-29161, -39500/-39501, 60000->12150 / 97199->12150 / 97200->24300.
  Highest risk: thresholds.test.ts band edges (a +/-1 lei edge becomes +/-100 bani).
  store.migration.chain.test.tsx :163-172,184-199,203-212,214-223,265-292,345-359,381-396 must be re-scoped
  deliberately with the reason written down (CURRENT_DATA_VERSION is now 5 and the chain has 5 names).
- **New tests to add**: 142.5 -> 14250 exact with NO notice; 674.504 -> 67450 WITH a sub-ban-precision notice;
  NaN carried unchanged + non-finite notice, never 0; snapshot inputsHash re-derived + preMigrationInputsHash
  preserved; the "step threw -> quarantine, detail 'migration failed:'" path (nothing pins it).
- **Delete the two test-internal formatter mirrors**: e2e/dashboard.spec.ts:577-579 and insights.test.ts:102-107.
- **Docs/register**: update docs/ai/phases/10_money_precision.md with what actually shipped; open B-25 in
  docs/ai/STATE.md (B-25 does not exist yet); close B-17 only if genuinely closed; NEVER write B-18/B-20 closed;
  B-16 is NOT closed by this phase.
- Then measure all four: npx tsc --noEmit / npm run test / npm run build / npm run test:e2e.

### Facts re-verified this pass
- decimal.js-light has NO static `Decimal.max` / `Decimal.min`. Use comparisons.
- `Bani + Bani`, `Bani - Bani`, `-Bani` all widen to `number` — always use addBani/subBani/sumBani.
- `Math.max(chosen, floor)` / `Math.min(vna, maxBase)` drop the brand — replaced by ternaries.
- All 10 lei rule params are whole lei, so their bani values are divisible by 100 (and by 10).
- tsc non-test errors went 34 -> 17 -> 8 -> 2. Total tsc errors ~477 (test literals, expected).

---

## 9. STATE AT THIRD COMPACTION — tsc 0 EVERYWHERE, 68/707 TESTS RED. READ §7 AND §8 TOO.

### Safety net
- `c9f60ac` = **T1 source-complete** (all non-test source speaks integer bani, 0 non-test tsc errors).
  Before it: `e232c61` (wip), `87fc202` (**last commit green at all four checks**), `a232576` (money.ts),
  `c2b33ea` (phase doc T1 spec), `f6d7cd8` (baseline).
- Branch `wip/phase10-t1-bani` points at `e232c61`. **Re-point it before any reset** — HEAD is `c9f60ac` plus a large
  uncommitted test conversion (29 modified files).
- Rule unchanged: end green at all four checks, or `git reset --hard 87fc202` and report honestly. NEVER hand off red.

### MEASURED right now (not estimated)
- `npx tsc --noEmit` → **0 errors** across source AND tests. Whole repo type-checks with `Bani` everywhere.
- `npm run test` → **68 failed / 639 passed** (707 tests, 18 failed files / 27 passed).
- `npm run build` and `npm run test:e2e` → not re-run since the conversion. e2e is certainly red (expectations still
  in lei strings + the e2e formatter mirror is still there).

### Done since §8
1. The 2 `Settings.tsx` errors are fixed with a cast-free guard:
   `if (salary === null || cash === null) return; // unreachable; narrows without a cast`.
2. **Test suite converted mechanically.** Three scripts live in `/tmp/` (`wrap_money.py`, `wrap_asserts.py`,
   `fix_from_failures.py`). They are scratch tooling — deliberately NOT committed (they trip repo lint and are not
   deliverables). Their method, in case /tmp is gone:
   - `wrap_money.py`: run `npx tsc --noEmit`, keep errors mentioning `'Bani'` in test files, wrap the numeric literal
     at the reported (line,col) in `lei(...)`. Two node shapes: bare literal, or object-literal property (`key: value`
     → wrap the value). Process bottom-up and right-to-left so columns stay valid. Iterate until no `Bani` errors.
   - `wrap_asserts.py`: property-name pass (`value:`, `total:`, `current:`, `limit:`, `base:`, money field names) +
     subject-anchored assertion pass. **Caused the two mis-wraps in item 4 — never trust it blindly.**
   - `fix_from_failures.py`: run `npx vitest run` and capture **stderr** (vitest writes its report there; pass
     `encoding='utf-8'` or the `❯`/`→` glyphs fail to match). Pair `AssertionError: expected A to be B` with the
     `src/...:line:col` site on the next line; when `A == B*100` exactly, wrap the literal at that line. Literals use
     underscores (`7_600`) so the matcher builds `7_?6_?0_?0`. Idempotent — re-run after every fix round (found 93,
     then 32 more).
3. **Test-local helper signatures changed to `Bani`** (this is what made tsc find the call sites):
   `aggregation.test.ts` + `projection.test.ts` `revenue(...)`/`expense(...)`; `insights.test.ts`
   `taxComputed(total: Bani)`; `taxReserve.test.ts` `makeSnapshot(total: Bani)` and `makeComputedEstimate(total: Bani)`;
   `thresholds.test.ts` `allBases(value: Bani)`; `store.snapshots.test.tsx` `Partial<{revenues: Bani; expenses: Bani}>`
   with `?? lei(1000)` / `?? lei(400)`; `store.migration.chain.test.tsx`
   `prePhase7Snapshot(calculationId, revenuesValue: Bani)`.
4. **Two mis-wraps found and reverted — `value:` is NOT always money.**
   - `domain/deadlines.test.ts:227` `{ id: 'offset_days', …, value: lei(30), unit: 'days' }` → back to `value: 30`.
     `FiscalParameter.value` is `number | string`; this one is a **days** parameter. Unused money import removed.
   - `domain/tax.test.ts:527` `(p.id === 'rate' ? { …p, value: lei(100) } : p)` → back to `value: 100`, a **percent**
     parameter. Symptom that exposed it: `expected 486000000 to be 48600` — a ×10000, i.e. a rate scaled as money.
   - `rules.test.ts:31` `value: lei(1), unit: 'lei'` IS correct (unit is lei).
5. **Missing money imports added** to `pages/Settings.test.tsx`, `components/TaxReserve.test.tsx`,
   `components/FinancialChart.test.tsx`, `domain/fiscal/rules.test.ts`. (The earlier import guard matched
   `from 'src/domain/money'` but not `from './money'`, and inserted into the middle of multi-line imports — that made
   two files unparseable and **masked their semantic errors for one whole round**. Repair imports before believing any
   error count.)
6. **`insights.test.ts` formatter mirror DELETED** (was lines 103-108, a private `Intl.NumberFormat`) — E-6 done for
   that file. The test now asserts the literal `'1.234,57 RON'` and `formatBaniRON(total) === '1.234,57 RON'`, with a
   comment noting that comparing the app to a mirror of itself hid formatter regressions.
   `const total = 1234.567` → `lei(1234.57)` (1 234,567 lei is not representable in bani); same for
   `taxComputed(lei(1234.567))` at line 573 — the value is incidental in that test.
7. `snapshots.test.ts` scientific literals preserved: `revenues: lei(1e3), expenses: lei(4e2)` (the regex had mangled
   them into `lei(1)e3`).

### The 68 remaining failures, by category (RESUME HERE)
1. **~8 rendered-text failures — NOT test bugs; the display layer is still unconverted.**
   `Unable to find an element with the text: 156.000,00 RON` / `97.200,00 lei` / `9.680,00 RON` / `-20.000,00 RON` /
   `10.000,00 RON` / `12.000,00 lei`, plus 2 `toHaveTextContent`. `fmtRON` is still being handed integer bani, so it
   prints `1560000,00 RON`. **Do not edit these expectations — fix the display layer (queue item 4) and they clear.**
2. **12 `toBeCloseTo` mismatches** — genuine art. 66 value changes or projection fractions. Hand-fix each with the
   reason in the commit message. Known: `tax.test.ts:207` `24478.2 → 24478` lei (fraction 20 bani ≤ 50 → neglected);
   `tax.test.ts:419` and `:514` `7128.1 → 7128`; `taxReserve.test.ts:51` `13535/7` monthly reserve;
   `taxReserve.test.ts:84` `15750`; `taxReserve.test.ts:113` `1844965 vs 10000`.
3. **`derived.test.ts:127,138,147` and `data/derived.test.tsx:97,113`** — expected/received are NOT a ×100 pair
   (e.g. `214200 vs 119952`), so these are real value changes from per-line art. 66 rounding. Compute by hand from
   the rule and write the new number.
4. **`aggregation.test.ts:353,363`** (`35700 vs 12138`, `11900 vs 35462`) — same: real value changes, hand-compute.
5. **`store.profileBackfill.test.tsx:192`** `300000000 vs 30000` — a ×10000, i.e. a **percent scaled as money**
   (same class as the `rate` mis-wrap). Look at the fixture, do not wrap.
6. **`store.migration.chain.test.tsx:361`** and **`thresholds.test.ts:163,176`** and **`projection.test.ts:201,261,280`**
   — reported as `no-literal`: the expected value is computed, not a literal in the test. Inspect the expression.
7. **`taxReserve.test.tsx` (5), `FinancialChart.test.tsx` (11), `FinancialSummary.test.tsx` (2),
   `ThresholdSection.test.tsx` (2), `Dashboard.test.tsx` (2), `Declarations.test.tsx` (2), `Settings.test.tsx` (2),
   `dashboard.test.ts` (6), `insights.test.ts` (2), `rules.test.ts` (2), `store.load/save.test.tsx` (1 each)** —
   mostly display strings and object deep-equals; expect a large chunk to clear with the display layer.

### NOT YET DONE (the remaining plan, in order)
1. **Display layer (queue item 4) — biggest remaining win.** `src/lib/format.ts` still has `fmtRON`/`fmtRONCompact`
   doing `Intl` on a lei float. Replace with `formatBaniRON` / `formatBaniRONCompact` (already in `money.ts`) and
   update every call site. Then re-run tests — expect the rendered-text failures to fall.
2. **Delete the cents bridge** — `data/dashboard.ts` `toCents(v) = Math.round(v*100)` and `domain/insights.ts`
   `formatCents(cents) = cents/100`. `DashboardSnapshot` fields are named `*Cents` and are still integer cents;
   insights fixtures still write `targetReserveCents: 100_000`. Either rename the fields to `*Bani` and pass `Bani`
   straight through, or keep the cents contract deliberately. **Decide and record it — do not leave both scales
   half-wired.**
3. **New tests still to add** (brief T1 acceptance): `roundBani` boundaries incl. the **50 bani tie going UP**
   (2.50 → 3, −2.50 → −3); `lei()` rejecting sub-ban input; `sumBani` order-independence; a regression test pinning
   the art. 66 rule itself (not just its outputs).
4. **Delete the second formatter mirror**: `e2e/dashboard.spec.ts:577-579`.
5. **e2e**: convert expectations to the new display strings, then run `npm run test:e2e`.
6. **Docs/register**: update `docs/ai/phases/10_money_precision.md` with what actually shipped; open **B-25** in
   `docs/ai/STATE.md` (it does not exist yet); close **B-17** only if genuinely closed; **NEVER write B-18/B-20
   closed**; **B-16 is NOT closed by this phase**.
7. Measure all four: `npx tsc --noEmit` / `npm run test` / `npm run build` / `npm run test:e2e`.

### Facts re-verified this pass
- vitest writes its report to **stderr**; a subprocess capture that reads only stdout sees nothing (this cost a round).
- `lei(x)` throws for sub-ban input (`RangeError: lei(1234.567) is not a whole number of bani`) — good guard, but it
  means mechanical wrapping can crash a test whose value was never money.
- A broken multi-line import makes a file unparseable, which **hides** its semantic errors: repair imports before
  trusting any error count.
- `FiscalParameter.value` is `number | string` and carries a `unit`; only `unit: 'lei'` parameters are money.

---

## 10. STATE AT FOURTH COMPACTION — DISPLAY DONE, CENTS BRIDGE GONE, 56/707 RED. READ §7-§9 TOO.

### Safety net
- `023e520` = **display layer + cents bridge + view arithmetic** (HEAD). Before it: `9f524de` (§9 notes + the whole
  test-literal conversion), `c9f60ac` (T1 source-complete), `87fc202` = **last commit green at all four checks**.
- Branch `wip/phase10-t1-bani` re-pointed to `023e520`. Re-point before any reset.
- Rule unchanged: end green at all four checks, or `git reset --hard 87fc202` and report honestly.

### MEASURED at this moment
- `npx tsc --noEmit` → **0 non-test errors**. Test errors went 25 → 7 (a `wrap_money.py` round just landed 21 wraps).
- `npm run test` → **56 failed / 651 passed** (45 files: 15 failed / 30 passed).
- `npm run build` / `npm run test:e2e` → NOT re-run since the display change. e2e still certainly red.

### DONE since §9 — the display layer (queue item 4) is finished
1. **`fmtRON` and its `Intl.NumberFormat` DELETED from `data/types.ts`.** All 22 call sites in 8 files
   (Expenses, Revenues, Declarations, Dashboard, EFactura, FinancialChart, FinancialSummary, TaxReserve) now use
   `formatBaniRON` from `domain/money`. No second formatter remains, so no formatter rounding policy can disagree —
   that is the structural B-17 fix.
2. **REAL BUG FOUND: the chart Y-axis was printing raw bani.** `FinancialChart.tsx` had
   `tickFormatter={(v) => plain.format(v)}` with `plain = new Intl.NumberFormat('ro-RO',{maximumFractionDigits:0})`,
   fed a bani value → it rendered `12 600` where the user must read `126`. Direct violation of "a raw 67450 must
   never reach a screen". Replaced with **`formatBaniAxis`** (new in money.ts): divides by 100 through `Decimal`,
   groups, and prints decimals only when the tick actually has them. Documented as a scale label, not an amount.
3. **Cents bridge DELETED (decision A-6).** `data/dashboard.ts` fed `DashboardSnapshot.taxReserve.*Cents` with
   `value * 100`. Once the domain stores bani, **a ban IS a cent**, so that bridge had become a *double* conversion
   scaling every amount by 100 twice. Fields renamed `*Cents` → `*Bani` and typed `Bani` in
   `domain/aggregation.ts` (`DashboardSnapshot.taxReserve`), values passed straight through in `dashboard.ts`.
   `domain/insights.ts`: deleted the private `Intl.NumberFormat` (a 5th formatter instance) and the
   `formatCents(cents/100)` divide-back; money strings now use `formatBaniRON`.
   `DashboardSnapshotView.pfaRevenue` → `Bani`.
4. **T4 — money arithmetic removed from the view layer.** New in `data/types.ts`:
   `sumTotals(rows)` (replaces `rows.reduce((s,e)=>s+total(e),0)` at `Expenses.tsx:158` — the reduce dropped the
   `Bani` brand and started from an unbranded `0`) and
   `declarationNet(d) = maxBani(subBani(d.venituri, d.cheltuieli), 0 as Bani)` (replaces
   `Math.max(0, d.venituri - d.cheltuieli)` inside JSX at `Declarations.tsx:176`).
5. **`FinancialChart` tooltip hardened**: Recharts echoes numbers back with no type guarantee, so the tooltip now
   re-checks with `isBani` and renders an em dash otherwise — a chart library cannot smuggle a fractional or NaN
   amount into a money string. `ChartRow` fields are `Bani`.
6. **`domain/taxReserve.ts` → `Bani`** throughout (state + recommendation). `remainingTarget` uses
   `maxBani`/`subBani`; `recommendedMonthlyReserve` uses `divBani`.
7. **`domain/projection.ts` (E-4) done.** `RunRate` deliberately stays an **unbranded fractional-bani `number`** —
   a rate is not an amount, and leaving it unbranded is what stops it reaching `formatBani*`/persistence by
   accident. `Totals`/`ProjectionMonth` are `Bani`. Projected months are **allocated** (`allocateBani`) from the
   exact `Decimal` run rate so they sum EXACTLY to the projected subtotal — no per-month drift. Art. 66 is NOT
   applied to a projection. Needs `import Decimal from 'decimal.js-light'`.
8. **New named primitives appended to `src/domain/money.ts`** (each documents why it is NOT art. 66):
   `maxBani(a,b)` · `divBani(total,parts)` (cash-planning share, nearest ban, half-DOWN; share×parts may differ
   from the total by ≤ parts/2 bani — stated) · `toBaniNearest(Decimal|number)` (the ONLY sanctioned way a
   fractional-bani intermediate becomes money) · `allocateBani(total,parts): Bani[]` (largest-remainder, sums
   exactly) · `formatBaniAxis(number)` (chart tick).
   NOTE: `decimal.js-light` has **no `isFinite`** (instance or static) in its typings and **no `.s`** property —
   check finiteness with `Number.isFinite(d.toNumber())`.

### WARNING: pi-lens shows a STALE 🔴 on `src/domain/money.ts` L317 `Property 's' does not exist on type 'Decimal'`
That code was removed. `lens_diagnostics source=lsp` on the file says **confirmed clean** and `tsc` reports 0 errors
there. Do not "fix" it again — it is a cached diagnostic from before the edit.

### The 56 remaining failures, per file (RESUME HERE)
`taxReserve 12 · projection 7 · store.migration.chain 7 · tax 6 · thresholds 4 · derived 4 · aggregation 4 ·
Dashboard 2 · insights 2 · data/derived 2 · ThresholdSection 2 · profileBackfill 1 · store.load 1 · dashboard 1 ·
FinancialChart 1`
**All rendered-text / `toHaveTextContent` failures are GONE** — the display layer fixed them, exactly as §9 predicted.
Do not touch display expectations.
Worked example of the dominant remaining class (`taxReserve.test.ts`): the fixture was wrapped
(`makeComputedEstimate(lei(18_535))`) but the reserve arg was not (`createTaxReserveState(5_000)` = 5 000 **bani**
= 50 lei), so `remainingTarget` came out `1 848 500` instead of `13 535`. Symptom of a **half-wrapped pair**, not a
value change. `toBeCloseTo(18_535/7, 6)` must become `lei(18_535)/7` (bani) — a pure unit re-expression.
Still-open judgement items (NOT ×100 pairs, so the script will not fix them):
`derived.test.ts:127,138,147` · `data/derived.test.tsx:97,113` · `aggregation.test.ts:353,363` ·
`tax.test.ts:207,419,514` · `taxReserve.test.ts:51,84,113` · `store.profileBackfill.test.tsx:192` (×10000 = a
**percent scaled as money**, same class as the `rate` mis-wrap — do not wrap) ·
`store.migration.chain.test.tsx:361` · `projection.test.ts:122,201,261,280` · `thresholds.test.ts:56,163,176`.

### STILL TO DO (order)
1. Finish the 56 test failures. Loop: `python3 /tmp/wrap_money.py 3` (tsc-driven) → `python3 /tmp/fix_from_failures.py`
   (runtime ×100 pairs; captures **stderr**, `encoding='utf-8'`) → hand-fix the judgement list above.
   Scripts are in `/tmp` (scratch, deliberately not committed).
2. **New tests the brief requires** (nothing pins these yet): `roundBani`/`roundArt66` 50-bani tie DOWN;
   `lei()` rejects sub-ban; `sumBani` order-independence; `allocateBani` sums exactly; art. 66 regression pin;
   migration: `142.5 → 14250` exact with NO notice, `674.504 → 67450` WITH a sub-ban-precision notice, `NaN`
   carried unchanged + notice (never 0), snapshot `inputsHash` re-derived + `preMigrationInputsHash` preserved,
   and the "step threw → quarantine with `migration failed:`" path.
3. **Delete the e2e formatter mirror** `e2e/dashboard.spec.ts:577-579` (a 7th formatter, in the test itself) and
   convert e2e expectations: `3.104,51 RON → 3.105,00 RON`, `1.034,84 → 1.035,00` (see §Scout E-2 / §6).
   NEGATIVE CONTROLS that must NOT change value: `24_615, 2430, 12_150, 24_300, 29_160, 2_430, 4_230, 3_800,
   46.570, 20.435, 4860/4861, -29160/-29161, -39500/-39501, 60000→12150 / 97199→12150 / 97200→24300`.
4. **Docs/register**: update `docs/ai/phases/10_money_precision.md` with what shipped; **open B-25** in
   `docs/ai/STATE.md` (does not exist yet); close **B-17** only if genuinely closed; **NEVER write B-18/B-20
   closed**; **B-16 is NOT closed by this phase**.
5. Measure all four at final HEAD with a clean tree.

---

## 11. STATE AT FIFTH COMPACTION — 7 FAILS LEFT, ALL IN ONE FILE. READ §7-§10 TOO.

### Safety net / commits
- HEAD `02daa29` fix(money): projection shares sized wrong + per-month net did not add up.
  Before: `a6e084b` (insights/taxReserve/tax), `56bc36e` (§10 notes), `023e520` (display layer),
  `9f524de`, `c9f60ac`, `87fc202` = **last commit green at all four checks**.
- **UNCOMMITTED right now** (safe, all green-per-file): aggregation.test.ts, derived.test.ts,
  data/derived.test.tsx, thresholds.test.ts, ThresholdSection.tsx, **src/lib/format.ts DELETED**,
  FinancialChart.tsx, money.ts (+formatBaniRONOrDash), dashboard.test.ts, store.profileBackfill.test.tsx,
  Dashboard.test.tsx, store.load.test.tsx. Commit before compaction if it matters.
- `wip/phase10-t1-bani` was re-pointed at `023e520`; re-point again before any reset.

### MEASURED
- `npx tsc --noEmit` → **0 errors repo-wide**.
- `npm run test` → **7 failed / 700 passed** — ALL 7 in `src/data/store.migration.chain.test.tsx`.
- `npm run build` / `npm run test:e2e` → **still not re-run**. e2e is certainly red.

### THE RULE THAT COST THE MOST TIME — WRITE IT LARGE
**A test that writes a RAW localStorage payload must keep money in the OLD LEI scale.** The chain runs
on load and scales it once. Wrapping such a fixture in `lei()` = a DOUBLE conversion (×10 000 overall).
Symptom: `expected 300000000 to be 30000`, or a rendered total wildly off.
Mis-wrapped by the script and reverted to raw (`N as Bani` with a comment, or a bare number):
`pages/Dashboard.test.tsx` `validRevenue` (50_000 / 9_500) + its two inline revenues (78_000/16_380,
52_000/10_920); `store.profileBackfill.test.tsx` `salaryIncomeLei: 30000`; `store.load.test.tsx`
snapshot fixture (1000 / 0 / 100).
Conversely: fixtures passed DIRECTLY to domain functions are `lei(...)`. Only `writePayload`/
`localStorage.setItem`/`prePhase7Payload` fixtures stay raw.

### DONE since §10 (all verified per-file, tests green in each)
1. `insights.test.ts` — the taxReserve fixtures were already in the old **cents** scale, which is
   numerically IDENTICAL to bani (1 ban = 1 cent): only `*Cents` → `*Bani` + types moved, no value.
2. `taxReserve.test.ts` 19/19 — pure unit re-expression. Monthly reserve = cash-planning share via
   `divBani`, so expectations use `toBeCloseTo(..., 0)` = within half a ban.
3. `tax.test.ts` 56/56 — the real art. 66 changes, derived in comments:
   CASS 71281×10% = 7128.10 → 10 bani < 50 → neglected → 7128.00; **base = 71281 − 12150 − 7128 = 52003**
   (exact integer arithmetic on already-rounded lines — the base is NEVER itself rounded);
   income 52003×10% = 5200.30 → 30 < 50 → 5200.00; total = sum of rounded lines = 24478.00.
   Test NAME `no rounding, raw float` was an assertion about behaviour → renamed to state art. 66.
4. `projection.test.ts` 21/21 + **two REAL BUGS fixed in `projection.ts`** (see commit 02daa29).
5. `aggregation.test.ts` 38/38 — `before.revenue + 238` was a lei delta on bani totals → `addBani(..., lei(238))`.
   Import line had lost its semicolon from an earlier script; fixed.
6. `derived.test.ts` 26/26, `data/derived.test.tsx` 4/4 — same lei-delta-on-bani class (NOT the "real value
   change" §9 guessed). The data/derived harness prints stored amounts verbatim, so its numbers are BANI.
7. `thresholds.test.ts` 52/52 — `distance` expectations were lei differences: `lei(100_000) - lei(48_600)`.
8. **`src/lib/format.ts` DELETED** (the 6th formatter, `formatLei`). Its only consumer
   `ThresholdSection.tsx` (3 sites) now uses `formatBaniLei` from domain/money.
9. **`formatBaniRONOrDash` ADDED to money.ts** — the tooltip had lost its `RON` suffix because
   `formatBaniOrDash` is suffix-free. Kept `formatBaniOrDash` (its own test pins `0,00`) and used the
   suffixed guard in `FinancialChart.tsx`. `FinancialChart.test.tsx` 11/11.
10. `dashboard.test.ts` 31/31 — seeded acceptance 6 re-measured, derivation written in the test:
    CASS deductibilă 749.45 → 45 bani < 50 → **749.00**; base 7494.50 − 749.00 = **6745.50** (was 6745.05);
    income 6745.50×10% = 674.55 → 55 ≥ 50 → **rounded UP to 675.00**; total 2430 + 675 = **3105.00**
    (was 3104.505) — this is the e2e `3.105,00 RON`. The three BASES (7700 / 205.5 / 7494.5) are unchanged.
11. `Dashboard.test.tsx` 5/5 — raw payloads unwrapped (see the rule above). **Negative controls 20.435 and
    46.570 both still render unchanged** — good evidence the engine arithmetic did not drift.
12. `store.load.test.tsx` 19/19 — snapshot expectation now pins the migration contract:
    `preMigrationInputsHash === 'abc123'`, `inputsHash !== 'abc123'`, money converted once, and
    `computeInputsHash(loaded.inputSnapshot) === loaded.inputsHash`. Import from
    **`../domain/snapshots/hash`** (NOT `snapshot.ts`; there is also `hashSync.ts`).

### THE LAST 7 — `src/data/store.migration.chain.test.tsx` (RESUME HERE)
All 7 are the chain gaining a 5th step (`money-bani`, 4→5). Exact sites and fixes:
- `:201` `stepsApplied` → add `'money-bani'`; and `toVersion` must become `CURRENT_DATA_VERSION`
  (it asserts `DATA_VERSION_VAT_DATE`, which is now mid-chain).
- `:222` `stepsApplied` → `['vat-exceedance-date','money-bani']`; `toVersion` → `CURRENT_DATA_VERSION`.
  (`profile` still equals `seedData.profile`: cashFloorLei 0 → 0.)
- `:235` full-chain `stepsApplied` → add `'money-bani'`.
- `:394` load-path `migration.stepsApplied` → add `'money-bani'`.
- One test asserts the step PAIRS `[[0,1],[1,2],[2,3],…]` → add `[4,5]`.
- `leaves the fiscal inputs inside a snapshot byte-identical` (`:361`, `150000000 vs 1500000`) — the
  `legacy` snapshot fixture is a RAW payload, so money IS converted. Re-scope the claim honestly: only
  **identity-shaped** keys stay byte-identical; `inputSnapshot.revenues/expenses`, `calculationLines[].value`
  and `output.total` are converted once. Write the reason in the commit message.
- `does not rewrite a snapshot it had nothing to add to` (hash `b845695…` vs `7f960fa…`) — the money step
  DOES rewrite every snapshot's money, so the hash changes. Re-scope: the invariant is now
  `preMigrationInputsHash` preserved + `inputsHash` re-derived. Do NOT just paste the new hash.
Chain constants: `DATA_VERSION_BASE → profile-materialization → identity-absorption → payment-dates →
vat-exceedance-date → money-bani`; `CURRENT_DATA_VERSION = DATA_VERSION_MONEY_BANI = 5`.

### STILL TO DO after that (order)
1. **New tests the brief requires** (nothing pins them yet): `roundBani`/`roundArt66` 50-bani tie direction;
   `lei()` rejects sub-ban; `sumBani` order-independence; `allocateBani` sums exactly; art. 66 regression pin;
   migration `142.5 → 14250` exact with NO notice, `674.504 → 67450` WITH sub-ban-precision notice, `NaN`
   carried unchanged + notice (never 0), snapshot hash re-derive (partly done in store.load), and the
   "step threw → quarantine with `migration failed:`" path.
2. **Delete the e2e formatter mirror** `e2e/dashboard.spec.ts:577-579`; convert e2e expectations
   (`3.104,51 → 3.105,00 RON`, `1.034,84 → 1.035,00`); then RUN `npm run test:e2e`.
   NEGATIVE CONTROLS that must not change: 24_615, 2430, 12_150, 24_300, 29_160, 2_430, 4_230, 3_800,
   46.570, 20.435, 4860/4861, -29160/-29161, -39500/-39501, 60000→12150 / 97199→12150 / 97200→24300.
3. **Docs/register**: update `docs/ai/phases/10_money_precision.md`; **open B-25** in `docs/ai/STATE.md`;
   close **B-17** only if genuinely closed; **NEVER B-18/B-20**; **B-16 NOT closed here**.
4. Measure all four with a clean tree.
5. Advisories to consider: nested ternary in `projection.ts` actualCount; **unused `asOfDate` param in
   projection.ts** (check whether my edit orphaned it).
