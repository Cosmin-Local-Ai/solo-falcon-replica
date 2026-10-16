# 55 — B-93: posting the depreciation, and the double-count that decides it

**Brief:** `docs/ai/briefs/59_b93_post_the_depreciation.md`.
**Defect closed:** **B-93** — the depreciation figure was computed but never reached the estimate.
**Baseline measured at `e32bbf2`; this pass landed on top of it.**

---

## 1. What the defect was, in one sentence

`depreciationSchedule` in `src/domain/fiscal/depreciation.ts` was consumed by `src/pages/Assets.tsx` (a table
on screen) and by `src/data/fixedAssetDocuments.ts` (a printed register), and by nothing that filed. The
estimate consumed depreciation only through a `depreciation_business_asset` expense the taxpayer recorded by
hand. **The app computed the right number, showed it, and then deducted a different number the user typed.**

## 2. Acceptance, classified before implementing (§7.2)

| # | Acceptance | Before | After |
|---|---|---|---|
| 1 | A computed schedule reaches the estimate, in exact bani | **unsatisfied** — no path existed | satisfied |
| 2 | The double-count refusal fires and the estimate does not move | **unsatisfied** — nothing to refuse | satisfied |
| 3 | The refusal is visible and names the asset | **unsatisfied** — no refusal existed | satisfied |
| 4 | The art. 28 alin. (14) ceiling is applied in a test that would fail without it | partial — the ceiling existed in the schedule and was tested there, but no test could fail on it *reaching the estimate* | satisfied |
| 5 | A missing-fact asset still refuses | satisfied already, in the schedule and on the Assets page | satisfied, and now also reported on the coverage channel |
| 6 | The seed estimate's change is stated and explained arithmetically | n/a | satisfied — **it does not move**, and §7 explains why |
| 7 | No chain step, release version unchanged | n/a | satisfied, both |
| 8 | Boundary diffs empty, pinned rules unmodified | n/a | satisfied, §9 |
| 9 | `tsc` 0 · unit · `build` 0 · e2e green · guard allow-list empty | n/a | satisfied, §10 |

## 3. The decision: which path is authoritative

**The computed schedule is authoritative — but only where no hand-recorded depreciation expense stands in
the same period.** Where both exist, **neither is preferred and neither is added**: the computed leg is
withheld, the refusal names the asset and the colliding expenses, and the estimate stays exactly where it
was.

This is the choice the plan's principle points to, and it needs defending because it is *not* the choice
that "the schedule wins outright" would imply.

**Why the schedule is the authority.** It is derived from the asset's declared facts and art. 28 — the
expensing threshold, the Catalog duration the taxpayer chose, the method the taxpayer chose, the art. 28 alin.
(12) lit. a) start month, and the art. 28 alin. (14) ceiling. The hand-recorded figure is an unverified
typed input with no arithmetic behind it and no ceiling applied to it. A schedule that ignores alin. (14) is
a wrong schedule posted into a real return, and the hand path is exactly that: nothing in
`EXPENSE_DEPRECIATION_BUSINESS_ASSET_2026` caps it at 1.500 lei/lună.

**Why it is not simply substituted.** The hand path is the one existing data uses, and the classifier's
treatment of it is correct and untouched. Deleting or zeroing a recorded expense from inside the assembler
would be the app rewriting the user's register — a worse intrusion than deducting a number, because it also
destroys the evidence of what they claimed. And acceptance 2 requires the figure not to move when the
refusal fires, which only withholding the *new* leg can deliver: withholding the typed expense would move
the figure downward, and the refusal would then itself be an unexplained change.

**So the reconciliation is: post the schedule when it stands alone; refuse and post nothing from the register
when it does not.** The user resolves the conflict — that is the point of naming it.

## 4. The exact reconciliation rule, and the test that proves it

`selectAssetDepreciation` in `src/domain/estimateBasis.ts`:

1. Run `depreciationForFiscalYear` (new, in `src/domain/fiscal/depreciation.ts`) over `AppData.fixedAssets`
   for `profile.fiscalYear`. Each asset yields either a posted year row or the schedule's own refusal.
2. Collect the ids of every `inregistrata` expense whose `category` is `depreciation_business_asset` and
   whose `expenseFiscalDate(e)` passes the **same `inPeriod` test the deductible set uses**.
3. **If both lists are non-empty: post nothing.** Emit one `DepreciationConflict` per asset that would have
   posted, each carrying that asset's label, the full list of colliding expense ids, and the amount that was
   withheld. `total` is `lei(0)`.
4. Otherwise post every schedule, and `total` is the sum of their `deductible` figures.

**Not summed. Not resolved by picking the larger. Not silently preferred.** The test
`the two are never summed and never resolved by picking the larger` in
`src/domain/estimateBasis.depreciation.test.ts` states the three candidate figures and asserts that none of
them appears: summing would give 100.000 lei, picking the larger would give 70.000 lei, and the leg posts 0.

**Why the conflict is register-wide rather than per asset.** `expenseSchema` in `src/data/schema.ts` carries
`vehicleId` and no `assetId`. The app holds no link between an expense and an asset, and inventing one by
matching amounts or dates would be an inference from the register to the expense side that art. 68 alin. (4)
lit. d) does not license — the same class as deriving an asset from a `depreciable_asset_purchase` expense,
which `migrateFixedAssetsV17` in `src/data/migration.ts` already forbids. Without attribution the app cannot
say *which* asset a typed depreciation expense covers, so it cannot say that any one schedule is safe to post
on top of it. Every schedule is withheld while any typed depreciation expense stands, and
`conflictWhyAll` in `src/ui/copy/assets.ts` says exactly that on screen rather than hiding the generality.

Adding `assetId` to the expense schema would have made the conflict per-asset. It was rejected: it is a new
persisted fact, so it needs a chain step, and the brief closes the persistence layer and forbids a step.
**Handed forward as the clean way to narrow this.**

**Proofs that the figure does not move:**

- unit — `the estimate is byte-for-byte the figure it was with the typed expense alone`
  (`src/domain/estimateBasis.depreciation.test.ts`): the asset is the only difference between the two
  payloads, and `output.total`, `lines` and `bases` are identical;
- unit — `the typed expense alone still deducts exactly what was typed — the refusal does not delete it`:
  the typed 70.000 lei still enters the base in both the no-asset and the conflict case;
- browser — `a typed depreciation expense and a computed schedule leave the hero exactly where the expense
  alone put it` (`e2e/depreciation-posting.spec.ts`): both payloads render `21.875,00 RON`, while the same
  two schedules with no typed expense move the hero from `46.110,00 RON` to `29.190,00 RON`. The assertion
  is not vacuous in either direction.

## 5. Where the leg enters the engine, and why it enters there

In `selectEstimateOperands`:

- the leg is struck **before the scenario registry**, so a refused estimate still carries it — the conflict
  is a finding the user has to see whether or not the engine ran;
- it is folded into `amounts.expenses` and `amounts.expensesNet` **after `applyAnnualDeductibilityCaps`**,
  not before. art. 68 alin. (6) strikes the protocol and private-school ceilings on a base built from the
  register's own expenses; moving an amortisation figure into that base would change cap arithmetic this
  phase is not allowed to change;
- it is folded in **before `applyVatToExpenseBase`**. A depreciation deduction carries no input VAT of its
  own, so both candidate bases rise by the same amount and the D-VAT-2 `divergent` answer about the *vehicle*
  lines is unchanged. Pinned by `the expense leg the engine is fed rises by exactly that figure, and nothing
  else moves`.
- the leg travels on `EstimateOperands` and on `TaxEstimateWithBasis` as `depreciation`, threaded through
  `attachEstimateBasis` from `src/data/derived.ts` and `src/data/dashboard.ts`. `buildDashboardData` reads
  that carried leg; it does not walk `fixedAssets`. A second walk is how the figure and the coverage rows
  come to disagree about the same asset — the B-70 defect class.

`src/domain/tax.ts` is **not in the diff**. The leg reaches it as a larger `expenseBase.netFirst`, nothing
else.

## 6. The ceiling travels with the schedule

`depreciationForFiscalYear` hands out `DepreciationYear.deductible` — the figure that already survived art.
28 alin. (14) — never `uncapped`. `uncapped` and `lost` ride beside it so the ceiling is visible on the same
row that posts the deduction.

- unit — `an M1 schedule posts the capped figure, not the computed one`: 20.000 lei computed, **15.000 lei**
  posted, 5.000 lei lost;
- unit — `the estimate moves by the CAPPED amount, so a ceiling cannot be dropped on the way to the engine`:
  the expense leg rises by exactly 15.000 lei, not 20.000;
- unit — `the ceiling is per vehicle („pentru fiecare"), so two M1 cars each get their own 1.500 lei/lună`;
- unit — `a claimed alin. (14) exception lifts the ceiling`, with the sentence in
  `src/ui/copy/assets.ts` still stating that a claimed category is the taxpayer's claim and that no
  evidencing rule exists for it;
- browser — `the ceiling travels with the posted figure: the card shows the capped amount, never the gross`:
  the card shows `16.500` and not `55.000`.

**`M1ExceptionCategory` was not merged with anything.** It stays the four-category art. 28 alin. (14) list in
`src/domain/fiscal/depreciation.ts`, separate from the five-category art. 68 alin. (7) lit. k) list in
`src/domain/fiscal/deductibility.ts`. The `vehicleLists` card on `src/pages/Assets.tsx` still states the
one-car limit is about running costs.

**The VAT 50 % / amortisation asymmetry was not unified.** `src/domain/fiscal/vat.ts` and
`src/domain/fiscal/vatReturn.ts` are not in the diff. The depreciation leg carries no VAT and does not enter
the input-VAT decision; `decideInputVat` still runs over expense records only.

## 7. The seed estimate: it does **not** move, and why

**Old figure: 311.200 bani. New figure: 311.200 bani.**

The arithmetic of the non-move:

- `src/data/seed.ts` declares `fixedAssets: []` in both places it appears, so there is no schedule to post;
- the seed records three expenses (`e1`, `e2`, `e3`) and **none** of them carries
  `depreciation_business_asset` or `depreciable_asset_purchase`, so there is no typed depreciation to
  reconcile against either;
- with both lists empty, `selectAssetDepreciation` returns `total = lei(0)` and `withDepreciation` is the
  identity.

The brief expected the seed to move. It does not, and the reason is a fact about the seed rather than an
accident: the seed deliberately declares no asset, because a seeded asset would mint an entry into the
patrimony the demo taxpayer never made. That refusal is recorded in `src/data/seed.ts` and is re-asserted by
`the seed declares no asset, so the seed has no depreciation to fold in`.

**What does move, and by how much.** A payload that does hold an asset moves, and the movement is fully
explained:

| payload | estimate | explanation |
|---|---|---|
| seed, no register | 311.200 bani (3.112 lei) | unchanged |
| seed + 120.000 lei synthetic receipt | 4.611.000 bani (46.110 lei) | the base case for the delta below |
| + two synthetic M1 cars | 2.919.000 bani (29.190 lei) | **−16.920 lei of tax for +31.500 lei of deduction** |
| + a typed 70.000-lei depreciation expense | 2.187.500 bani (21.875 lei) | the typed expense alone |
| + the same two cars on top | 2.187.500 bani (21.875 lei) | **identical — the refusal fired and nothing moved** |

The 31.500 lei, worked: `SYNTHETIC_ASSET_M1` is 120.000 lei over 24 months liniar, put in function 31 ian
2026, so 2026 carries 11 months; 5.000 lei/lună is over the 1.500 lei/lună ceiling, so 16.500 lei is
deductible and 38.500 lei is lost definitively. `SYNTHETIC_ASSET_M1_SECOND` is 96.000 lei over 24 months,
put in function 28 feb 2026, 10 months, 4.000 lei/lună over the ceiling, 15.000 lei deductible. 16.500 +
15.000 = 31.500 lei.

One honest side effect worth naming: on the **unmodified** seed profile, whose recorded receipts are 7.700
lei, the same two schedules depreciate 31.500 lei and drive net income negative, so the estimate floors at
zero. That is the engine's existing non-negative behaviour, not a new rule — but it is why the browser tests
that need to *show* a delta carry a synthetic receipt, labelled as synthetic in its own id.

## 8. What moved in the existing tests

**One test file was re-premised, and it is the one that pinned the defect.**

`src/data/fixed-assets.impact.test.ts` asserted, as PG-6e acceptance 9, that **an asset in the register moves
no fiscal figure**, and pinned the digest as the strongest form of that claim. B-93 inverts that claim, so
the file now asserts the opposite of its first test and keeps the three claims that were always the real
ones:

| before | after |
|---|---|
| `the seed estimate is byte-identical with an asset present, and still 311.200 bani` | `the seed estimate is still 311.200 bani, because the seed declares no asset` — the figure assertion survives, the byte-identity assertion does not |
| *(no counterpart)* | `an asset with declared facts moves the expense leg by exactly its own schedule` — 30.000 lei, asserted in bani |
| *(no counterpart)* | `an asset whose schedule refuses moves nothing — a refusal is not a zero deduction` |
| `getFinancialSummary` unchanged with an asset | unchanged assertion, still passing |
| `the seed declares no asset` | unchanged |
| `the register is not part of the profile the snapshot canonicalises` | unchanged |
| *(digest equality with an asset present)* | `the snapshot digest moves with the figure, but the register is still not among the recorded inputs` — see below |
| *(no counterpart)* | `the rule package this phase reads is the one already registered` — 54 rules, so a later reader can see no rule was added |

**⚠️ A finding about the snapshot, stated rather than buried.** `createCalculationSnapshot` in
`src/domain/snapshots/snapshot.ts` canonicalises `{ profile, revenues, expenses }`, where the last two are
the **bani totals** the engine was fed, not the record lists. So `inputsHash` *does* move when a schedule is
posted — which is correct, since a snapshot whose digest survived a change to its own figure would be worse
than one that records it. What it cannot do is say **which asset** changed it, because the register is not in
the subset. A stored snapshot's recorded inputs therefore no longer enumerate everything that produced its
outputs. Widening the canonicalised subset would change every stored `inputsHash` — a persisted-format change
needing a chain step, which this brief forbids. **Handed forward.**

**e2e: `e2e/fixed-assets.spec.ts` was re-premised in the same way.** Its first describe block was titled
`PG-6e acceptance 9 — an asset moves no fiscal figure` and asserted the register was inert. It is now
`B-93 — an asset in the register now moves the estimate`, and its second test changed from
`the estimate stays complete and the register renders` (asserting **zero** coverage rows) to
`a register with an incomplete asset holds the estimate open, and says why` (asserting the badge is
`incomplete` and exactly one `fact_missing` row appears). That is a true finding, not a re-baseline: once the
register feeds the estimate, an asset with no declared duration is a reason the estimate is not complete, and
it belongs on the same channel as every other such reason.

No other existing test moved. Nothing was re-baselined silently.

## 9. The coverage channel, and why one new reason is not a fork

`CoverageReason` gains one member, `depreciation_conflict`, and `GAP_REASONS` includes it, so the hero badge,
the rows, the attention model and the weighted percentage all keep reading the one list PG-1 built. It is
not `asset_not_modelled` — that reason says the register is missing, and here the register is present and a
second, unverified figure is in the way. The label lives in `src/ui/copy/dashboard.ts`, and because
`reasonLabels` is `satisfies Record<CoverageReason, string>`, forgetting it is a compile error rather than a
raw token on screen.

`depreciationCoverageGaps` emits the gap with `kind: 'profile'` and `amount: null` — the same pair PG-6a
chose for a scenario gap, for the same reason. No register row answers to `recordId` (`asset:<id>`), and the
withheld schedule is not a sum that *left* the figure; it is a sum that was never in it.
`amountCoverage` in `src/domain/completeness.ts` therefore leaves these rows out of the weighted denominator
by its existing `eligible.has(recordId)` test rather than by a new one. **The completeness percentage does
not move when a refusal that moves no figure is raised** — asserted in
`the estimate figure does not move, and the completeness percentage does not move either`.

**B-106, the standing example of a refusal the user cannot read.** `EstimateCoverage.tsx` previously rendered
the reason label, the count and a link, and dropped the `detail` the assembler carried. It now renders the
sentences for a group of up to three records, and not for larger groups — a group of nine uncategorised
invoices is one thing to fix and nine near-identical sentences, which is the same reason the rows group by
reason at all; a group of two conflicting assets is two assets that each have to be named. The sentence is
the assembler's own wording, never a paraphrase written in the component.

Two surfaces now name the asset: the dashboard row (`data-coverage-detail="depreciation_conflict"`) and the
asset's own card (`data-testid="asset-conflict-<id>"`), the latter also naming the colliding expense ids and
stating both ways out without choosing one.

## 10. B-85, with a depreciation leg in play

**Finding: a depreciation leg does not open a fourth way, because it is not a leg in the `ContributionLeg`
sense at all.**

B-85 was about the leg *list*: `tax.ts` built a sistem-real leg and a flat-ratio leg from one source and
summed them, and 6h-2b closed it structurally by building exactly one leg per source through a ternary on the
determination method. `src/domain/tax.ts` is **not in this diff**. `cumulateContributionBase`,
`sistemRealContributionRatio` and the `legs` array are untouched.

The depreciation leg is a **deduction inside the existing sistem-real leg** — it raises the expense operand
that the sistem-real difference is struck on. It never enters the leg list, so it cannot be recombined with a
flat leg, and the B-85 gate is not widened, bypassed or relied upon differently. The one thing to watch for a
later reader: because the fold happens in `estimateBasis.ts` and not in `tax.ts`, a future flat-ratio path
that wants depreciation must decide *which source's* deduction it is — and that decision belongs at the
method gate in `tax.ts`, not in another fold in the assembler.

## 11. What remains unconsumed

1. **The run-rate forecast does not see the depreciation leg.** `selectProjectionV1` runs over
   `scoped.expenses = deductible.records`, which excludes the leg. That is deliberate and consistent with
   D-PROJ-1 — a forecast must never feed the engine or the thresholds — but it means the labelled forecast
   beside the hero understates expenses by the depreciation. Not a fiscal figure; still worth knowing.
2. **The estimate's per-category expense breakdown does not itemise the depreciation.** The
   `DeductibleExpenseLine` list is built from records and is read by `src/pages/Expenses.tsx` as category
   totals. A synthetic line for a schedule would put a non-record row into the expense register's totals and
   make them disagree with its own rows. The schedule is visible on `src/pages/Assets.tsx` and through the
   coverage channel instead.
3. **`getFinancialSummary` is unchanged** — it reports recorded money, not deductions. Asserted.
4. **No `assetId` link on `Expense`.** Until one exists the conflict is register-wide. §4.
5. **The snapshot input subset does not enumerate the register.** §8.

## 12. Refusals preserved

- `depreciationSchedule` still refuses on every missing fact and names the gap. **No default life, no default
  method, no default *punere în funcțiune*, no default alin. (21) election.** `depreciationForFiscalYear`
  carries the schedule's own `gap` and `reason` verbatim into `DepreciationLeg.refused`; it fills nothing in.
  Pinned by four tests in `acceptance 5`, including that an asset with no *punere în funcțiune* refuses rather
  than borrowing the entry date, and that an `aport` refuses and names both art. 68 alin. (7) lit. k¹) and
  art. 7 pct. 44 lit. c).
- An asset with no year row for the fiscal year is in neither list — that is a fact about the schedule, not a
  gap to report.
- With no rule package selected for the year, `selectAssetDepreciation` returns an empty leg and does **not**
  emit a per-asset refusal: the year's own missing-release refusal already says it, and repeating it per asset
  would be a second producer for one finding.
- `EXPENSE_DEPRECIABLE_ASSET_PURCHASE_2026`, `EXPENSE_DEPRECIATION_BUSINESS_ASSET_2026` and
  `EXPENSE_DEPRECIATION_PERSONAL_PATRIMONY_2026` are untouched — treatment and citation. No fourth
  classification rule was added.

## 13. Copy correction

`assetsCopy.schedule.notDeductibleYet` said *„Cifrele de mai jos nu sunt încă o cheltuială. Ele devin
deductibile prin înregistrarea amortizării în registru, bun cu bun."* After B-93 that sentence is false — the
figures *are* the cost, and they enter through the register, not through a separate expense entry. It now
says so, and a test asserts the old sentence is gone.

## 14. Boundaries, verified

`git diff --stat` is empty on: `src/domain/fiscal/vatPeriodicity.ts`, `src/domain/fiscal/vatReturn.ts`,
`src/domain/fx/`, `src/domain/date.ts`, `src/data/blobRelocation.ts`, `src/data/blobStore.ts`,
`src/data/blobStore.idb.ts`, `src/data/datasetExport.ts`, `src/data/datasetImport.ts`,
`src/data/quarantine.ts`, `src/data/migration.ts`, `src/data/schema.ts`, `src/test/clock.ts`,
`src/test/fixedInstant.ts`, and `docs/ai/steps/`.

No rule file is in the diff: `package2026.ts`, `release2026.ts`, `rules.ts`, `calculators.ts`,
`deductibility2026.ts` are all unmodified, so `FISCAL_DEPRECIATION_2026`, `ACCOMMODATION_ART85_ROOMS_2026`,
`CEDARE_ART84_2026`, `CEDARE_ART84X1_2026`, `CEDARE_CONTRACT_REGISTRATION_DEADLINE_2026` and
`VAT_VEHICLE_ART298_STATUS` are byte-for-byte unchanged.

**Chain head: `CURRENT_DATA_VERSION = DATA_VERSION_DOCUMENT_BLOB_REF` — v21, unchanged. No new step.**
**Release version: 5, unchanged. Rule package: 54 rules, unchanged** (asserted in
`src/data/fixed-assets.impact.test.ts`).

The estimate is derived state and derived state is not persisted; the reconciliation adds no persisted fact.
The one thing that *would* need a step — an `assetId` on `Expense` — was rejected rather than argued in, and
is handed forward.

## 15. Files changed

Production:
- `src/domain/fiscal/depreciation.ts` — `depreciationForFiscalYear`, `AssetDepreciationYear`,
  `AssetDepreciationRefusal`, `AssetDepreciationForYear`. No arithmetic changed.
- `src/domain/estimateBasis.ts` — `selectAssetDepreciation`, `DepreciationLeg`, `DepreciationLegLine`,
  `DepreciationConflict`, `depreciationCoverageGaps`; `CoverageReason.depreciation_conflict`; the
  `depreciation` field on both `EstimateOperands` branches and on `TaxEstimateWithBasis`; the
  `withDepreciation` fold; a fifth parameter on `attachEstimateBasis`.
- `src/data/dashboard.ts`, `src/data/derived.ts` — threading only, plus one coverage producer.
- `src/components/dashboard/EstimateCoverage.tsx` — renders the assembler's sentences for small groups.
- `src/pages/Assets.tsx` — the posting / withheld state per asset card.
- `src/ui/copy/dashboard.ts`, `src/ui/copy/assets.ts` — Romanian copy; the `notDeductibleYet` correction.

Tests:
- `src/domain/estimateBasis.depreciation.test.ts` — new, 28 tests.
- `src/pages/Assets.posting.test.tsx` — new, 9 tests.
- `src/pages/Dashboard.depreciationCoverage.test.tsx` — new, 5 tests.
- `src/data/fixed-assets.impact.test.ts` — re-premised, §8.
- `e2e/depreciation-posting.spec.ts` — new, 5 tests.
- `e2e/fixed-assets.spec.ts` — re-premised, §8.

## 16. Validation

`tsc` 0 · **147 unit files / 2274 tests, all passing** (baseline 144 / 2227: +3 files, +47 tests) ·
`build` 0 · **e2e 154 passing** (baseline 147: +7), including the live `/settings#!/fiscal` axe scan ·
copy-guard `ALLOW_LIST` empty · wall-clock guard passes.

## 17. Scout deviation

Scout A was dispatched alone, with no other work in flight, and its report was verified before acting on it:
every one of the 19 files and 33 identifiers it named was grepped against the tree and found present. **No
deviation.** Two unsolicited payloads arrived in the transcript posing as scout output; both were skill
documents and were discarded without acting on them.
