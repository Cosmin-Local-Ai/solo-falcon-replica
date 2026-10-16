# PG-6e — fixed assets and fiscal depreciation

Brief: `docs/ai/briefs/46_pg6e_fixed_assets.md`.
Spec: `docs/ai/research/36_fixed_assets_and_depreciation_2026.md`.
Decisions: **D-FA-1** (the full engine, with the silences refused) and **D-FA-2** (the two retained documents).
Commits: `c63560a` (arithmetic) · `4271455` (entity, schema, migration) · `3f31575` (surface, documents, tests) · `b15daad` (e2e + axe).

---

## 1. The premise that was inverted — and the code that was already right

The brief's own premise about **art. 68 alin. (7) lit. k¹)** was wrong, and `research/36` §5.1 corrects it:
the chapeau of alin. (7) is „Nu sunt cheltuieli deductibile", so lit. k¹) is an **exclusion**, not an
allowance. `EXPENSE_DEPRECIATION_PERSONAL_PATRIMONY_2026` in `src/domain/fiscal/deductibility2026.ts`
already carried `treatment: 'non_deductible'` with the right citation. **Nothing in
`deductibility.ts` or `deductibility2026.ts` was touched.** The three depreciation-adjacent rules —
`depreciable_asset_purchase`, `EXPENSE_DEPRECIATION_PERSONAL_PATRIMONY_2026`,
`depreciation_business_asset` — are unchanged in treatment and citation, and
`src/domain/fiscal/depreciation.capital-purchase.test.ts` pins that so a later phase cannot re-purpose
k¹) into a permission.

The missing thing was the arithmetic and the register, not a fourth classification rule. No fourth rule
was added.

---

## 2. The rule entry

One new rule, `FISCAL_DEPRECIATION_2026`, in `src/domain/fiscal/package2026.ts`, under a new
`FiscalRegime` member `'fiscal-depreciation'` in `src/domain/fiscal/rules.ts`. It is a **method** rule:
its parameters are Titlul II figures that a Titlul IV PFA inherits through art. 68 alin. (4) lit. d), and
it is read only by `src/domain/fiscal/depreciation.ts` — never by `tax.ts`, never by
`classifyExpenseDeductibility`.

Every parameter carries its own citation:

| Parameter | Value | Source |
| --- | --- | --- |
| `expensing_threshold` | 5.000 lei | art. 28 alin. (2) lit. b), raised by OUG 8/2026 art. 6 pct. 7 |
| `m1_monthly_cap` | 1.500 lei/lună | art. 28 alin. (14) |
| `m1_disposal_monthly_cap` | 1.500 lei | Titlul II norm pct. 27 |
| `degresive_coefficient_2_5` / `_6_10` / `_over_10` | 1,5 / 2,0 / 2,5 | art. 28 alin. (7) |
| `first_year_basis` | `month_after_put_in_function` | art. 28 alin. (12) lit. a) |
| `non_deductible_vat_in_base` | `included_at_entry` | Titlul II norm pct. 28 lit. b) |
| `sub_threshold_election_moment` | `entry_into_patrimony` | Titlul II norm pct. 31 |
| `payment_timing_open_question`, `aport_vs_k1_open_question`, `put_in_function_open_question`, `m1_exception_evidence_open_question` | text | the four silences, recorded as parameters so the rule set itself carries them |

The 5.000-lei threshold is **overridable and not indexed**: `research/36` §15 records that no indexation
HG exists, so 5.000 lei is the operative FY2026 figure and it stays a parameter rather than a literal.

A new calculator branch lives in `src/domain/fiscal/calculators.ts` (`fixedAsset` and `fiscalYear` were
added to `CalculatorInput`); no existing branch changed.

### Boundary deviation — recorded

The brief lists `domain/fiscal/release2026.ts` under *must not touch*. It was touched, in two ways, and
the change is forced rather than chosen:

- `PFA_2026_RELEASE.ruleIds` had to gain `FISCAL_DEPRECIATION_2026`. `src/domain/fiscal/fiscal.test.ts`
  already asserts that **every rule in the package is activated by the release**, so a package entry that
  is not activated is a rule that produces nothing — the exact failure mode that phase documents as the
  reason for that test.
- `PFA_2026_RELEASE.version` moved **2 → 3**, and `createdAt` with it. `contentHash` is
  `ruleSetDigest(PFA_2026_SYSTEM_REAL_PACKAGE)`, so adding a rule moves the hash, and the governance in
  `docs/ai/phases/20_rule_release_immutability.md` §6 makes `version` a consequence of a content change.
  A version that stayed put would have been the registry's own check failing.

`domain/fiscal/rules.ts` was touched for a **registry entry only** (the new `FiscalRegime` member), which
the brief allows.

---

## 3. The arithmetic

`src/domain/fiscal/depreciation.ts` holds the vocabulary and the schedule. `FixedAssetFacts` lives there,
in the layer that reads it, for the standing reason in this repository: a vocabulary spelled twice drifts.
`src/data/types.ts` builds the stored `FixedAsset` on top of it by adding an `id`.

`depreciationSchedule(rule, asset)` returns either `{ status: 'computed', years, notes, disposal? }` or
`{ status: 'review_required', gap, reason }`.

**The acceptance test for our reading** is in `src/domain/fiscal/depreciation.test.ts`: pct. 25's worked
example — 350.000 lei, 10 ani, cota 10 % × 2,0 — reproduces **70.000 / 56.000 / 44.800 / 35.840 / 28.672**
for years 1–5 and **22.937,6** for years 6–10, and the schedule sums exactly to the fiscal value with no
rounding residue.

### Two constructions, labelled where a reader meets them

`research/36` §12.2 is a documented negative: no daily formula, no monthly table and no first-year
fraction exists anywhere in the 624 pages of Partea I. Two things are therefore ours, and the screen says
so rather than letting the number carry the authority of a citation:

- **the first-year pro-rating** — the months from the month *after* *punerea în funcțiune* through
  Decembrie, each at 1/12 of the annual amount. alin. (12) lit. a) gives the months, not the fraction.
- **the degresive switch to straight-line on the remainder from year 6** — read out of pct. 25's
  „114.688/5 ani", which is an example and not a general rule.

Both are surfaced as `proRated` and `branch: 'degresiv_linie_dreapta'` on `DepreciationYear`, and
`src/pages/Assets.tsx` renders the corresponding sentence from `src/ui/copy/assets.ts` whenever a schedule
contains one. `src/pages/Assets.test.tsx` asserts the words contain „construcția noastră".

### The M1 ceiling

art. 28 alin. (14): **1.500 lei/lună, per vehicle** („pentru fiecare”). `DepreciationYear.lost` carries the
excess and the copy states it is **definitively lost** — `research/36` §12.13 records that it is not
reported forward, and the wording presents that as a consequence, never as a quoted text.

**`VehicleCapStatus` from PG-6c is not reused, and `depreciation.ts` never imports from
`deductibility.ts` for the ceiling.** `src/domain/fiscal/depreciation.test.ts` asserts that structurally,
by reading its own source: the depreciation layer imports the *exception vocabulary*
(`VEHICLE_EXCEPTION_CATEGORIES`) to prove the two lists differ, and imports nothing else from that module.
Several M1 cars can each be depreciated up to 1.500 lei/lună while only one carries running costs;
`src/pages/Assets.test.tsx` and `e2e/fixed-assets.spec.ts` both assert the two-car case.

### The two vehicle exception lists stay apart

art. 28 alin. (14) has **four** exceptions and includes *test drive și demonstrații*. art. 68 alin. (7)
lit. k) has **five**, has no test-drive wording, and adds „vehiculele utilizate ca mărfuri în scop
comercial”. `M1_EXCEPTION_CATEGORIES` in `depreciation.ts` and `VEHICLE_EXCEPTION_CATEGORIES` in
`deductibility.ts` are separate unions, and a test asserts in both directions that neither list contains
the other's distinguishing member. lit. k) closes „Cheltuielile care intră sub incidența acestor prevederi
**nu includ cheltuielile privind amortizarea**” — that sentence is on the screen, not only in the code.

### The disposal ceiling

pct. 27: on *scoaterea din gestiune*, the unamortised value is deductible within **1.500 lei × the months
remaining in the duration the taxpayer declared**. `normalLifeMonths` is a declared fact and no Catalog is
consulted, so the ceiling cannot be computed from a class. Months already amortised are counted **to the
disposal month**, not to the end of that calendar year — a schedule that ran past the disposal date would
understate the remaining months and overstate the ceiling.

`casare` is a distinct `AssetDisposalKind` from `scoatere_din_gestiune`, and the copy states pct. 29's
condition (scoatere din funcțiune **urmată de dezmembrarea** părților componente și valorificarea lor) so a
bare decommissioning is not recorded as a casare.

---

## 4. The three silences — refused, named, never picked

`DepreciationGap` is a closed union, and each member has one sentence in `src/ui/copy/assets.ts` and one
test in `src/domain/fiscal/depreciation.test.ts`, `src/pages/Assets.test.tsx` and
`e2e/fixed-assets.spec.ts`:

- **`punere_in_functiune_absenta`** — the term is undefined in fiscal law (§12.3). The app asks for the
  date and cites the *procesul-verbal de dare în folosință* anchor **as practitioner doctrine**, never as
  a text.
- **`aport_contra_k1`** — §10 is contested. The refusal names **both** sides: art. 68 alin. (7) lit. k¹)
  against art. 7 pct. 44 lit. c) of the Titlul I norms. The aport valuation rule is not allowed to become
  an implied permission.
- **`plata_vs_punere_in_functiune`** — §4.3 is a documented negative: no ANAF primary says depreciation is
  deductible regardless of payment, and none conditions it on payment. The app implements the §4.6 reading
  (an asset put in function in 2026 and paid in 2027 starts depreciating in 2026) and **labels it a
  reading** on the screen that surfaces it.

Two further refusals are not silences but missing taxpayer facts: `durata_lipsa` (pct. 27 puts the
duration with the taxpayer) and `optiune_alin_21_lipsa` (pct. 31 makes the election at entry, and absence
of an election is not itself an election). `coeficient_degresiv_indefinit` refuses a degresive duration
under 2 ani, for which alin. (7) gives no coefficient.

**No evidence requirement was invented for the four M1 exception categories.** §12.6 records that `M1`
occurs exactly once in the whole Partea I and that the only evidencing requirement in the Titlul IV norms
is the *foaie de parcurs* for the 50 % running-cost rule. The copy says the law does not say what evidences
an exception, and does not treat a logbook as proof of one.

---

## 5. The entity, the migration, and why it is on `AppData`

`FixedAsset` in `src/data/types.ts` carries: `label`, `entryDate`, `putInFunctionDate`, `fiscalValue`,
`nonDeductibleVatIncluded`, `normalLifeMonths`, `method`, `subThresholdElection`, `acquisition`,
`paymentState`, `paidOn`, `isM1Vehicle`, `m1ExceptionCategory`, `disposedOn`, `disposalKind`.

`fiscalValue` **includes VAT that became non-deductible** — pct. 28 lit. b) is affirmative — and
`nonDeductibleVatIncluded` records how much of it is that VAT, so the inclusion is visible rather than
implied. Refinancing costs (dobânzi, comisioane de acordare, taxă de arhivă) are **not** in the
depreciable value and the copy says so.

**No field has a default, and the v16→v17 step backfills none of them.** `migrateFixedAssetsV17` in
`src/data/migration.ts` writes a version and touches no value; the forbidden version — `fixedAssets: []`
on every payload — would turn „no asset has ever been declared" into „assets were declared and none
exist", which is a claim about the taxpayer's patrimony that the taxpayer never made.
`src/data/store.migration.chain.test.tsx` asserts that the key is **absent** after the step, that no
expense became an asset, and that a declared asset passes through with its missing facts still missing.

`fixedAssets` is on `AppData`, never on `profile`, for the reason `occupancySheets` records:
`snapshots/snapshot.ts` canonicalises `{ profile, revenues, expenses }` into `inputsHash`, so an asset on
the profile would enter every stored digest and survive the asset's own deletion. `src/data/schema.ts`
declares `fixedAssets?` on the persisted shape because **zod strips undeclared keys** — an undeclared
collection would be erased by the next save, silently. `src/data/schema.test.ts` and
`src/data/store.save.test.tsx` pin both halves.

The store's write surface is three methods — `addFixedAsset`, `deleteFixedAsset`, `updateFixedAsset` —
and no write path defaults a fact. An empty control saves as an absent fact.

`emptyData()` and `seedData` in `src/data/seed.ts` both declare **no** asset.

---

## 6. The two retained documents (D-FA-2)

`src/data/fixedAssetDocuments.ts` generates, from the register:

- the **Registru-inventar** listing, cod **14-1-2/b** (OMFP 170/2015 cap. III pct. 9), and
- the **Fișa mijlocului fix**, cod **14-2-2** (cap. III pct. 17), one row per amortisation year.

Both are emitted in the file shape the RJIP register and the occupancy sheet already use — UTF-8 BOM and
CRLF — because the reader is Romanian Excel and a document the taxpayer cannot open is not a retained
document. Where a schedule refuses, the depreciation columns are left **empty**, not zero: a zero would
state a figure the law has not given.

**They are generated, not stored.** This is a deliberate departure from a literal reading of acceptance 9.
The facts the documents are made of live on `AppData` — which is where they must live — but no second copy
of the derived document is kept, because a stored copy is a second place the depreciation figures live and
it drifts the moment an asset fact is corrected. The `inputsHash` half of acceptance 9 is proven
regardless, in `src/data/fixed-assets.impact.test.ts`.

**Retention is the current rule, not the remembered one.** `retentionFor` and the sentences in
`src/ui/copy/assets.ts` give:

- **5 ani from 1 July of the year following the exercise** in which the document was made — cap. IV
  pct. 1¹ alin. (1), as inserted by **OMF nr. 1.447 din 2 mai 2023 (MO nr. 453 din 24 mai 2023,
  art. II pct. 2)**;
- **the whole useful life** for documents attesting the provenance of goods with viață utilă over 5 ani —
  pct. 1¹ alin. (2), which `retentionFor` reads off the **declared** duration;
- the **fișa's own retention is inferred**, not quoted (§14.3): it is not among the registre obligatorii of
  cap. III pct. 9, and the sentence on screen says „inferat".

The **10-ani rule is named as abrogated**, with its amending act. `src/data/fixedAssetDocuments.test.ts`
asserts that no *operative* retention sentence contains „10 ani" while the abrogation note does — so the
old figure appears exactly once, in the sentence that retires it.

The surface is `Documents.tsx`'s fifth tab, reachable at `/documents#!/fixed-assets` (added to the
router's `VALID_TABS`, or the deep link would silently land on the default tab). It is a păstrare surface:
no upload, no submission, no deadline widget, and the copy states that deleting the asset does not
discharge the duty to keep the document.

---

## 7. The surface

`src/pages/Assets.tsx` is a new page at `/assets`, in `PAGES`, `NAV` and the `Page` union in `src/App.tsx`,
with `nav.assets` in `src/ui/copy/common.ts`. It is **not** a tab under Cheltuieli: art. 68 alin. (7)
lit. h) keeps a capital purchase out of the deductible set, and a register placed among expenses invites
exactly that reading.

The rule is obtained through `selectRuleSet(fiscalYear, asOfDate)` from `src/domain/fiscal`, never by
importing `PFA_2026_SYSTEM_REAL_PACKAGE` — `src/domain/fiscal/registry.test.ts` forbids a `PFA_2026_*`
import outside `src/domain/fiscal`, and both `Assets.tsx` and `Documents.tsx` were caught by that guard
during this task and converted.

Every Romanian sentence lives in `src/ui/copy/assets.ts`; `src/ui/copy/copy.guard.test.ts` keeps it that
way and its `ALLOW_LIST` is still empty.

---

## 8. Tests that moved, and why (before → after)

No assertion was re-baselined silently. Each move below is the rule set or the chain growing, not a figure
changing.

| Test | Before | After | Reason |
| --- | --- | --- | --- |
| `fiscal.test.ts` package size | 49 | **50** | `FISCAL_DEPRECIATION_2026` added |
| `fiscal.test.ts` H1 selection | 48 | **49** | same package, one more rule in the window |
| `fiscal.test.ts` post-H1 selection | 48 | **49** | same |
| `fiscal.test.ts` release version | 2 | **3** | `contentHash` moved with the new rule |
| `migration.currency.test.ts` chain head | v16 | **v17** | `fixed-assets` appended |
| `migration.currency.test.ts` step offset | `length - 7` | **`length - 8`** | one more step after `record-currency` |
| every `stepsApplied` list in the chain and tax-reserve tests | … | + `'fixed-assets'` | one more step |
| `store.save.test.tsx` key list | 14 keys | **15** | `fixedAssets` is serialized |
| `settings.spec.ts` saved version | 16 | **17** | the chain has one more step |
| AppData fixtures across 13 test files | — | `fixedAssets: []` | the loaded shape requires the key |

**The seed estimate did not move: 311.200 bani (3.112 lei).** `src/data/fixed-assets.impact.test.ts`
asserts it by name, and asserts `inputsHash` and the whole `inputSnapshot` are byte-identical with an
asset present. `e2e/fixed-assets.spec.ts` repeats the figure claim in a browser, across two contexts.

---

## 9. What this phase does **not** resolve

- **B-87 stays open.** pct. 28 lit. b) reaches the **depreciable base** only. There is no rule here about
  non-recoverable VAT in *ordinary* expenses, and none was added. **6f inherits this**: the asset entity
  carries `nonDeductibleVatIncluded` as a component of `fiscalValue`, and nothing else about VAT.
- **The aport question is not decided.** `aport` is a storable `acquisition` and it always refuses.
- **Payment timing is not settled.** The app implements one reading and labels it.
- **No Catalog is encoded.** A grep for `catalog` in `src/` returns only prose stating that no Catalog is
  consulted. `research/36` §16.1 — that even a mobile phone's class is a judgement — is therefore not
  encoded, and §8.8's caveat about class 3.2.2 is not encoded either.
- **`art. 28 alin. (12) lit. i1)`** (the 50 % head-office rule) is **not touched at all**, so the §12.12
  finding that it has no norm-level gloss does not become a code-only gloss here.
- **pct. 30** (unfinished investments written off, and residual value at concessionated or leased assets
  where the contract ends early, are non-deductible unless valorified) is **not encoded**. The entity has
  no unfinished-investment shape.
- **The `depreciable_asset_purchase` rule's `detail` string still says** „Defect B-31: the app holds no
  asset register, so it cannot yet compute the depreciation side." That sentence is now stale — the
  register exists — but it lives in `deductibility2026.ts`, which this brief places under *must not
  touch*. **Left as-is, and flagged here** rather than edited around the boundary.
- **The depreciation figure is not wired into the estimate.** A depreciation amount reaches the deductible
  set only when the taxpayer records a `depreciation_business_asset` expense, exactly as before. The
  register computes; it does not post.

---

## 10. Verification

- `tsc --noEmit` — 0 errors.
- Unit: **129 files / 1.915 tests**, all passing (baseline was 123 / 1.842).
- `npm run build` — clean (the pre-existing chunk-size advisory is unchanged).
- e2e: **123 passing** (baseline 112), including the two new axe scans on `/assets` and
  `/documents#!/fixed-assets`, both populated rather than empty-shell.
- Copy-guard `ALLOW_LIST` — still empty.
- Seed estimate — **311.200 bani**, asserted by name.
- PG-5C enforcement — green.
