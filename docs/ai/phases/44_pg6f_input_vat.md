# PG-6f — input VAT deductibility, and the registration facts behind it

Phase: **PG-6f** (= phase 13's B-30 half). Brief: `docs/ai/briefs/47_pg6f_input_vat.md`.
Research it implements: `docs/ai/research/42_input_vat_deductibility_2026.md`, §6 in particular.
Decisions it executes: **D-VAT-2**, **D-VAT-3**, **D-LEG-1**.

## VALIDATION

`tsc` 0 · **130 files / 1955 unit tests** · `build` 0 · **e2e 123** (118 functional + 5 axe) ·
copy-guard `ALLOW_LIST` empty · **seed estimate unmoved at 311.200 bani** · data chain head **v18**.

Baseline was 129 files / 1915 unit tests. The delta is one new file (`domain/fiscal/vat.test.ts`, 35
tests) and four new engine cases in `domain/tax.test.ts`, plus one new chain case.

## WHAT THE DEFECT WAS

`domain/tax.ts` selected the money measure for a whole register with two ternaries keyed on
`profile.vatExempt`. That boolean answered two different legal questions with one bit:

- whether this person **charges TVA** at all — a question about the ANAF register (art. 310 versus
  art. 316), and
- whether **every leu of input VAT was recoverable** — decided line by line by art. 297 alin. (7),
  art. 298 alin. (1), art. 300 alin. (4) and art. 11 alin. (7)-(9).

It was wrong in both directions: a non-exempt PFA with a 50 %-limited vehicle line or an alcohol
purchase was treated as having recovered all of its VAT, and an exempt one was treated as having no
VAT in its prices at all.

## WHAT EXISTS NOW

### The registration facts — `domain/fiscal/vat.ts`

`VatRegistrationStatus` carries the six states the law uses: `scutit_art310`, `inregistrat_art316`,
`inregistrare_voluntara`, `plafon_depasit`, `inregistrare_anulata`, `reinregistrat`. `VAT_REGISTRATION_VALUES`
is the same union as a value, and both forms read it rather than restating it.

`VatRegistration` is `{ status, effectiveFrom?, cashAccounting? }`. `cashAccounting` is **orthogonal, not
a seventh status** — TVA la încasare (art. 282 alin. (3)-(8)) is a scheme a registered person may be in,
including from the moment it registers.

`registrationEffectiveDate` answers art. 316 alin. (1¹) per litera. For `plafon_depasit` it returns the
profile's **existing** `vatExceedanceDate` rather than duplicating it. **Norme pct. 90 alin. (1) is not
implemented** — it is stale and contradicts the law; the file says so where the omission is deliberate.

`registrationChargesVat` and `registrationHasDeductionRight` are the two predicates the engine and the
Settings screen share, so the label beside a figure and the figure itself cannot disagree.

### The per-line decision — `decideInputVat`

Ordered by who decides: registration → supplier → goods → destination → vehicle → pro rata → document →
payment. Each line lands in exactly one of `claimable` (with a fraction and a rule string), `zero` (with
a reason and a provision), `unresolved` (reason, **no provision**) or `deferred`.

The vehicle branch keeps the evidence shape the research records as inverted: the **50 % branch needs no
*foaie de parcurs*** (Norme pct. 68 alin. (4)); **full** deduction does (pct. 68 alin. (2)). Exclusive
use claimed without a logbook therefore settles at 50 % rather than becoming an unresolved line.

`VAT_VEHICLE_EXCEPTION_VALUES` has **six** members; `VEHICLE_EXCEPTION_CATEGORIES` in
`domain/fiscal/deductibility.ts` keeps its **five**. `VAT_ONLY_VEHICLE_EXCEPTION` names the extra one —
`inchiriere_sau_leasing`, art. 298 alin. (3) lit. e) — as a value so a test can assert the lists differ.
**`VehicleCapStatus` is not imported by `fiscal/vat.ts`**; the file's header records why.

`capitalGoodClawback` exists mainly for its exception: art. 305 alin. (4) lit. a) pct. 1 withholds the
clawback for a vehicle already under the art. 298 50 % limit.

### The expense base — D-VAT-2

`applyVatToExpenseBase` expresses the base as **what the VAT decision adds** to the expense measure the
assembler already struck, so it composes with the annual-ceiling pass instead of replacing it. A capped
line's `tva` is already the capped amount, so the Titlul II worked example (50 % of 1.000 + 190 = 595)
is reachable here as 500 + 95 without re-deriving any percentage.

`computeTaxEstimate` now takes a **required `expenseBase: ExpenseBaseWithVat`** operand. That requirement
is the enforcement: no call site can reach the engine without having run the per-line decision, and there
is no fallback to the retired boolean at any level. When `divergent` is true the engine computes
**neither** figure, returns `review_required`, pushes both as lines, and quotes
`TITLUL_II_VAT_ORDERING_RULE` — whose `scope` field states in Romanian that it is a Titlul II rule and
that no equivalent exists for a PFA.

An **undeclared registration also refuses**, before any arithmetic, naming what each answer would change.

### Threading — `domain/estimateBasis.ts`

`selectEstimateOperands` runs `decideInputVat` **once**, over every registered in-period expense — not
only the deductible subset, because Titlul VII deductibility is independent of art. 68 deductibility and
restricting the pass would silently drop lines from the taxpayer's claim. It uses the same normalised
ledger pass and the same period/status filter as `selectYtd`, so the claim, the totals and the coverage
rows count one record set.

The decision and the base travel on `EstimateOperands` (`inputVat`, `expenseBase`) and on
`TaxEstimateWithBasis` (`inputVat?`, optional for the same reason `scenarios?` is). Both call sites —
`data/dashboard.ts getTaxEstimate` and `data/derived.ts useLatestTaxEstimate` — hand them over; neither
re-derives anything.

### The claimable total — D-VAT-3

`DashboardData.inputVat` carries the decision. `pages/Dashboard.tsx` renders it in its own disclosure
inside the estimate card: the **unfiled warning first**, then the total, then the sentence explaining why
one computed number is not one decont rubric (research/42 §7: part at the deductible-VAT total, part at
the regularisation lines), then the three lists the total excludes — unresolved, deferred, denied.
PG-6g owns the form; nothing here completes one.

### Surfaces

- `pages/Settings.tsx` and `pages/Onboarding.tsx` both offer the six-state select, and Onboarding reads
  the **same copy map** (`settingsCopy.fiscal.vatRegistrationOptions`) so the two forms cannot offer
  different answers to one question. An empty select writes nothing at all.
- `pages/Expenses.tsx` names the measure it displays, including a third label for the undeclared state.
- `domain/thresholds.ts` and `domain/completeness.ts` read the declared state; an unanswered one is
  reported as unanswered rather than resolved in either direction.

## RETIRING `vatExempt` — D-LEG-1

Deleted, not tolerated: the type member in `domain/models.ts`, the schema keys in `data/schema.ts` and
`domain/schema.ts`, the seed fixture, the copy keys, both UI controls, and the migration's tolerance for
the stored key. `domain/profile.ts createDefaultProfile` mints nothing.

The chain grows **v17 → v18** (`input-vat-registration`, `DATA_VERSION_INPUT_VAT`,
`migrateInputVatRegistrationV18`). It **deletes the key and converts nothing** — not `false` to
`inregistrat_art316`, not `true` to `scutit_art310`. research/42 §11.2 records that the boolean expresses
none of the six states, and the state decides the money measure of every record in the register, so a
conversion would have asserted an ANAF register fact the payload never held. Nothing is backfilled; the
chain itself is intact and renumbered nowhere.

Proven at two levels: a pure-chain case in `store.migration.chain.test.tsx` (deletes, mints no state,
leaves a declared registration untouched, idempotent) and the v4-payload round-trip in
`e2e/settings.spec.ts`.

## DEVIATIONS AND CORRECTIONS MADE DURING THE WORK

1. **Two scout reports were untrusted and one was never dispatched.** A report arrived naming
   `ExpenseEngine`, `excludedIds`, `vehicleUnattributedIds` and `vehicleCapUnresolvedIds` — none of which
   exist in the tree — and I have no record of dispatching that agent. Per §12.12 the whole report was
   discarded and the vehicle territory was covered by reading the source directly. Two further payloads
   arrived posing as scout reports but were skill injections; both were ignored. An earlier report named
   `src/domain/vatRegimeChoice.ts` and a `vatRegime*` identifier family that do not exist anywhere.
2. **I introduced an inverted measure and fixed it.** My first replacement read
   `registrationChargesVat(status) ? revenues : revenuesNet`. That is backwards: a person who **charges**
   TVA has that TVA excluded from the income measure, so the base is the **VAT-exclusive** figure. The
   seeded-data tests caught it. Both the engine's sistem-real gross and `flatRatioGrossFromYtd` had it.
3. **The seed profile now declares `inregistrat_art316`.** Landmine 10 says the seed has no VAT
   registration facts and the estimate must not move — but with the boolean deleted and the engine
   refusing on an unanswered state, those two cannot both hold unless the fixture **answers the
   question**. Declaring the state the boolean stood in for is what keeps 311.200 bani on the same
   VAT-exclusive measure it has always computed on. This is a fixture answering a question, not a
   default: `createDefaultProfile` still leaves the field absent, and `domain/seed.ts` says so in place.
4. **One `vatExempt` literal survives outside `data/migration.ts`**, in `e2e/settings.spec.ts`: the v4
   payload fixture carries `vatExempt: false`, because that is what a v4 profile actually stored and the
   test exists to prove the v18 step deletes it. The shared `legacyProfile` fixture keeps a modern
   registration and the test overrides it to `undefined`, so `JSON.stringify` drops the key and the
   "mints no state" assertion tests the step rather than the fixture.
5. **`Dashboard.test.tsx` TASK 9 now seeds a payload** instead of rendering on empty storage. It used to
   compute only because the retired default settled the VAT measure; the refusal on an unanswered profile
   is this phase's point, so the test declares the fact and keeps testing attribution.
6. **`flatRatioGrossFromYtd` returns `null`** when no registration is declared, rather than picking a
   measure. The assembler then attaches no `flatRatioGross`, and the engine refuses on the registration
   before the flat leg is reached.

## WHAT IS DELIBERATELY NOT ENCODED

These are the research gaps and boundaries the brief named; each is absent rather than guessed, and each
is recorded here so a later phase inherits the gap rather than the silence.

- **The Titlul II ordering rule (pct. 16 alin. (3))** is quoted as corporate-only text and never applied
  to a PFA. D-VAT-2 governs: where the ordering changes the figure, both numbers are shown and neither is
  computed.
- **The strict e-Factura view.** A domestic B2B invoice with nothing in RO e-Factura is `unresolved` with
  **no provision attached**, excluded from the total and listed. Whether deduction survives is
  research/42 §10 gap 3 and is not settled here.
- **art. 298 alin. (4¹)** (residential buildings) — not in force, awaiting a derogation that has not been
  granted. Not modelled.
- **art. 310²** — cross-border regimes for persons established in other Member States. Not modelled; a
  Romanian PFA is always under art. 310.
- **Norme pct. 90 alin. (1)** — stale, contradicts art. 316 alin. (1¹). Not implemented.
- **No registration status is inferred from turnover already in the app.** art. 310 alin. (2) measures the
  plafon on a restricted definition of turnover („operațiuni … cu locul în România") that this app does not
  compute, and the threshold row says so.
- **No Norme paragraph number is hard-coded** for the pre-registration adjustment (pct. 66 versus 67,
  alin. (14) versus (16) disagree between consolidations).
- **art. 300 alin. (20)** — the opt-out that removes deduction entirely on mixed-destination goods
  (research/42 §6 row 6). **Not encoded.** A mixed-destination line with a declared pro rata is apportioned;
  the opt-out has no fact slot yet.
- **art. 310 alin. (6²)** — the retroactive normal-regime period a late registrant self-assesses. **Not
  modelled.** Landmine 6 warns against modelling a hole; the current answer is that an undeclared
  registration refuses, which is not the same as the retroactive period.
- **The adjustment mechanics themselves.** A pre-registration line is *flagged*
  (`preRegistrationAdjustment`) and the clawback schedule is computed, but neither the positive adjustment
  at Norme pct. 83 alin. (11)-(12) nor the art. 304 alin. (1) in-period adjustment for a non-capital good
  is applied to any total.
- **The pro rata is taken as declared.** art. 300 alin. (8) rounds the *definitive* ratio **up**, and the
  provisional one is due by 25 January; neither the rounding of the ratio nor the provisional/definitive
  distinction is implemented. A claim is always **floored**, never rounded up — `floorPercent` is used
  deliberately rather than `roundArt66`, because art. 66 alin. (1) rounds sums that are *due* and a
  claimable amount is not one.
- **`scutita_cu_drept`** (research/42 §6 row 4, exempt *with* a right) falls through to claimable but
  carries the general destination rule string rather than art. 297 alin. (4) lit. c). The outcome is
  right; the citation on that one branch is imprecise.
- **B-87 stays open.** The per-line `nonRecoverableTotal` is computed, but non-recoverable VAT is **not**
  capitalised into any asset base: Norme pct. 28 lit. b) is scoped to the depreciable base, and this
  phase was told not to write a rule for ordinary expenses.
- **B-94 stays open.** The 50 % vehicle VAT rule rests on CID (EU) 2024/1641, which lapses 31 December
  2026. Nothing here presents it as permanent, and no lapse flag was added — B-94 owns that.
- **The D300 layout is untouched.** PG-6g owns the form and inherits this total.

## FILES CHANGED

**New:** `domain/fiscal/vat.ts`, `domain/fiscal/vat.test.ts`.

**Domain:** `tax.ts` (the base selection, both refusals), `estimateBasis.ts` (threading, the single
decision pass, `expenseBase`/`inputVat` on the operands and on `TaxEstimateWithBasis`), `models.ts`,
`profile.ts`, `derived.ts`, `thresholds.ts`, `completeness.ts`, `schema.ts`.

**Data:** `migration.ts` (v18 step only), `schema.ts`, `types.ts`, `seed.ts`, `dashboard.ts`,
`derived.ts`.

**Surfaces:** `pages/Settings.tsx`, `pages/Onboarding.tsx`, `pages/Expenses.tsx`, `pages/Dashboard.tsx`;
`ui/copy/settings.ts`, `ui/copy/onboarding.ts`, `ui/copy/records.ts`, `ui/copy/dashboard.ts`,
`ui/copy/notes.ts`.

**Tests / e2e:** `domain/tax.test.ts`, `tax.singleLeg.test.ts`, `tax.cassLadder.test.ts`,
`profile.test.ts`, `derived.test.ts`, `completeness.test.ts`, `thresholds.test.ts`,
`aggregation.test.ts`, `projection.test.ts`, `art68x3.arithmetic.test.ts`, `estimateBasis.test.ts`,
`snapshots/snapshots.test.ts`, `snapshots/hashSync.test.ts`, `fiscal/immutability.test.ts`,
`data/dashboard.test.ts`, `data/derived.test.tsx`, `data/store.migration.test.ts`,
`data/store.migration.chain.test.tsx`, `data/store.snapshots.test.tsx`, `data/store.taxReserve.test.tsx`,
`data/migration.currency.test.ts`, `pages/Dashboard.test.tsx`, `e2e/dashboard.spec.ts`,
`e2e/settings.spec.ts`.

**Not touched**, per the brief's boundaries: `domain/fiscal/deductibility2026.ts`,
`domain/fiscal/deductibility.ts`, `domain/fiscal/depreciation.ts`, `domain/fiscal/calculators.ts`,
`domain/fiscal/release2026.ts`, `domain/date.ts`, `domain/fx/*`, `domain/projection.ts`,
`data/occupancy*`, `data/fixedAssetDocuments.ts`.

## NEXT HANDOFF

**PG-6g** owns the Form 300 setup (D-VAT-1) and inherits `InputVatDecision` — `claimableTotal`, plus the
`unresolved`, `deferred` and `zero` lists it must not silently fold into a return line. It should also
decide whether the pro rata's provisional/definitive split and the art. 300 alin. (20) opt-out get fact
slots, both of which this phase left open.

**B-94** should attach the 31 December 2026 lapse to the art. 298 50 % branch; the rule string on those
lines is the hook (`art. 298 alin. (1); Norme pct. 68 alin. (4)`).

**B-87** remains open by design: the per-line non-recoverable amount exists, the capitalisation rule for
ordinary expenses does not, and no primary text supports one.
