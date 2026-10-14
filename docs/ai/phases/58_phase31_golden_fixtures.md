# Phase 31 — golden fiscal fixtures (queue step 10)

**Brief:** `docs/ai/briefs/62_phase31_golden_fixtures.md`. **Source of every expected value:**
`docs/ai/research/47_published_worked_examples_fy2026.md`, read in full before any fixture was written.

**Baseline at `fe05ed3`:** `tsc` 0 · 149 files / 2,332 unit tests · `build` 0 · e2e 154 · copy-guard
`ALLOW_LIST` empty · seed estimate 311.200 bani · chain head v21 · 54 rules, release version 5.

**After this task:** `tsc` 0 · **157 files / 2,394 unit tests, all passing** · `build` 0 · **e2e 154** ·
copy-guard `ALLOW_LIST` empty · **chain head still v21, release still version 5, still 54 rules.**

---

## 1. The answer to the question the brief asks first

> **Is every fixture green because the engine is right, or because something was adjusted?**

**Nothing was adjusted. Not one published expected value was changed to match the engine.** No expected
value anywhere in this task was computed by the engine and then asserted.

Sixty-two tests were added. **Four of them fail against the published value on purpose**, and are written so
that the published number is the assertion. They are described in §4 as findings, not as test failures. Every
other fixture is green because the engine reproduced a number copied out of `research/47`.

The distinction the brief says it cannot see from a passing suite is recorded here in full: **the four
disagreements are the FX truncation convention (three assertions) and the CAS cumulation of
drepturi de proprietate intelectuală (one assertion).** Their published values and the engine's values are in
§4 with both numbers named.

---

## 2. What was written

New files only. `git diff --stat` is empty; `git status --short` shows nine untracked paths.

| File | Fixtures | Tests |
|---|---|---|
| `src/domain/golden/harness.ts` | the driver — plumbing only, **no expected value lives here** | — |
| `src/domain/golden/regimeSplit.test.ts` | **1** — the regime split | 6 (1 failing-by-design) |
| `src/domain/golden/art84.test.ts` | **2** — art. 84, the 20 % flat expense | 7 |
| `src/domain/golden/fxTruncation.test.ts` | **3** — the FX truncation convention | 10 (3 failing-by-design) |
| `src/domain/golden/art84x1.test.ts` | **4** — art. 84¹, rent from a persoană juridică | 6 |
| `src/domain/golden/art85rooms.test.ts` | **5** — art. 85, 1–7 rooms | 7 |
| `src/domain/golden/vehicleFiftyPercent.test.ts` | **6** — the 50 % vehicle restriction, art. 298 alin. (1) | 11 |
| `src/domain/golden/depreciationCeiling.test.ts` | **7** — the 1.500 lei/lună ceiling, art. 28 alin. (14) | 10 |
| `src/data/golden.assetRegister.test.ts` | 6/7, second half — the published example against `assetRegisterHash` | 5 |

**No rule file, no `src/data/migration.ts`, no `src/data/schema.ts`, no `src/data/seed.ts`, no
`src/test/occupancyFixtures.ts`, no `index.html`, no `domain/date.ts`, no `domain/fx/*` internals, no
`vatPeriodicity.ts`, no `vatReturn.ts` was touched.** `src/domain/estimateBasis.ts` was read but not changed —
no fixture needed a seam. **No chain step. No rule change.**

### How the engine is driven

`computeTaxEstimate` in `src/domain/tax.ts` is called **directly**, the way `src/domain/tax.singleLeg.test.ts`
calls it — no `selectEstimateOperands`, no `evaluateScenarios`. A refusal upstream is not a guard: it can be
retired by the next phase, and a fixture that passes because something else refused asserts nothing. The one
exception is `src/data/golden.assetRegister.test.ts`, which deliberately goes through
`selectEstimateOperands` and `getTaxEstimate` in `src/data/dashboard.ts`, because the thing under test there is
the register digest on the stored record.

The rule set is **selected, never named**: `harness.ts` goes through `selectRuleSet` in
`src/domain/fiscal/registry.ts`, the same selector `src/data/dashboard.ts` and `src/data/derived.ts` use. This
was forced by an existing guard in `src/domain/fiscal/registry.test.ts`, which forbids any non-test file
outside `src/domain/fiscal/` from importing `PFA_2026_RELEASE` or `PFA_2026_SYSTEM_REAL_PACKAGE`. **That guard
is right and a fixture is a call site**: binding a golden example to a named release would let it keep
computing under the 2026 law after the selector had stopped selecting it. The four `.test.ts` fixture files
that do reach for `PFA_2026_SYSTEM_REAL_PACKAGE` do so only to pull a single rule out of it by `ruleId` in
order to call one calculator directly.

---

## 3. Every fixture, with its source, fiscal year, SMN and grade

| # | Fixture | Source | Fiscal year of the source | SMN the source used | Grade |
|---|---|---|---|---|---|
| 1 | PFA CASS is 10 % of the actual net — net 22.000 → **2.200**, net 26.640 → **2.664**, net 68.000 → **6.800**; the ladder on 98.000 cumulated → base **97.200** → **9.720** | ANAF DGFP București, „Noutăți privind DU 2026 – exemple", Examples 1, 2, 3 | **2025** | 4.050 lei | **FACT** |
| 2A | art. 84: brut 24.000 → forfetar **4.800** → net **19.200** → impozit **1.920** | same ANAF deck, Exemplul 4 (natural-person-tenant limb) | **2025** | 4.050 lei | **FACT** |
| 2B | art. 84 FY2026: 30.000 → **6.000** → **24.000** → **2.400**, CASS **0** because 24.000 < 24.300 | renzi.ro + completam.ro + declararatie-unica.ro | **2026** | 4.050 lei | **CORROBORATED** |
| 3 | 500 EUR × 4,977 = **2.488 lei** (truncated, not 2.489); 2.488 × 6 = **14.928**; forfetar **2.986**; net **11.942**; impozit **1.194** | ANAF București Sector 4, `Dec_Unica_PF_Cedare_Fol`, item 18 | **2024** | **3.300 lei** | **FACT for the convention only** — the thresholds in this example are FY2024 and are asserted nowhere as FY2026 rules |
| 4 | art. 84¹: 3.000 → **600** → **2.400** → **240 reținut**, 2.760 virat; annual 36.000 → **2.880**; CASS on net 28.800 → base **24.300** → **2.430** | firmaromania.com | **2026** | **4.050 lei, stated in terms by the source** | **FACT** (single source) |
| 4B | art. 84¹: 2.000 → **400** → **1.600** → **160**, **1.840** to the owner | renzi.ro | **2026** | 4.050 lei | **FACT** |
| 5 | art. 85: 30.000 → 9.000 → 21.000 → **2.100**, CASS **0**, total **2.100**; 60.000 → 18.000 → 42.000 → **4.200**, CASS **2.430**, total **6.630**; 150.000 → 45.000 → 105.000 → **10.500**, CASS **9.720**, total **20.220**; 50.000 (post-commission) → 15.000 → 35.000 → **3.500** | capital.ro, with the 60.000 case independently reproduced at declararatie-unica.ro | **2026** | 4.050 lei | **CORROBORATED** (the ladder rungs themselves are **FACT** from ANAF Ploiești / Brașov FY2026) |
| 6 | preț 100.000, TVA 21.000 → deductibilă **10.500**, nedeductibilă **10.500** → intrare **110.500** → **1.841,67 lei/lună**; neplătitor TVA: intrare **121.000** → **2.016,67**; fuel bon 605 lei (500 + 105 TVA) → **52,50** recovered | contabilitatedigitala.ro (FACT) + firmaromania.com (CORROBORATED) + expertcontabiltim.ro (FACT) | **2026** | — (TVA 21 %) | **CORROBORATED** |
| 7A | amortizare contabilă **1.841,67** → deductibilă **1.500** → nedeductibilă **341,67** lei/lună; **4.100 lei pe an** pierdut | contabilitatedigitala.ro + firmaromania.com | **2026** | — | **CORROBORATED** — and every example where the ceiling binds is an **SRL** |
| 7B | PFA utilaj 24.000 lei / 48 luni: **500 lei/lună**, **4.500 lei** în 2026 (9 luni), **6.000** în 2027-2029, **1.500** în 2030 (3 luni) | contapp.ro | **2026** | — | **FACT** — the only published PFA depreciation worked example; the ceiling is never engaged in it |
| 7C | that the ceiling reaches a PFA at all | statute reading via art. 68 alin. (4) lit. d) | 2026 | — | **INFERENCE** — see §5 |

**The FY2026 anchors the fixtures run against are unchanged and were not "fixed":** `package2026.ts` holds
`max_annual_base` = `lei(291600)` = 72 × 4.050 and `min_base` = `lei(24300)` = 6 × 4.050, with 4.325 lei held
as the second period. That matches the ANAF sentence `research/47` §5A quotes verbatim. **`fiscalitatelazi.ro`'s
4.325-lei reading is asserted only as a negative** in `golden/art84x1.test.ts`: the base is 24.300 lei and not
25.950 lei, the CASS is 2.430 lei and not 2.595 lei.

**ANAF's Exemplul 4 PJ limb was not used**, exactly as instructed — it states 30.000 lei and computes with
32.000 lei, and never multiplies the resulting net by 10 %, so it cannot pin the art. 84¹ withheld amount.
**`fiscalx.ro` was not used**, and its stale 19 %-TVA figure of 9.500 lei appears in
`golden/vehicleFiftyPercent.test.ts` only as a value the engine must *not* produce.

---

## 4. Findings — where the engine disagrees with a published value

These are findings about rules, written as findings. **In every case the published value stayed the assertion
and the engine's value is reported beside it.**

### Finding 3-A — the FX truncation convention

- **Published (ANAF București Sector 4, FY2024):** „500 euro x 4977 lei = **2488 lei lunar**". The product is
  2.488,5 lei; ANAF truncates to a whole leu.
- **Engine:** **2.488,50 lei** (248.850 bani).
- **Cause:** `product()` in `src/domain/fx/convert.ts` rounds the amount × rate **to the nearest ban** and
  deliberately does **not** apply CF art. 66 alin. (1)'s whole-leu rounding to that product. `ROUNDING_CHOICE`
  in the same file records the decision and says art. 66 governs sums of tax that are due, and that whether it
  also governs a converted amount is not established.
- **Size:** half a leu per month; **14.928 lei published against 14.931 lei** over the six months ANAF
  computes. Zero where the product is already whole — at the BNR 2024 annual average of 4,974 the engine
  reproduces ANAF's **2.487 lei** exactly, and that control case is pinned.
- **What it says about the rule:** this is not a wrong rule. It is two rounding conventions over one rule.
  Left unpinned it reads downstream as a rule error, which is exactly the day the brief warns about.

### Finding 3-B — the same convention inside the art. 84 chain

- **Published (same source, gross 14.928 lei):** forfetar **2.986**, net **11.942**, impozit **1.194 lei**.
- **Engine, on the same gross:** forfetar **2.985,60**, net **11.942,40**, impozit **1.194 lei**.
- **What it says:** the intermediates disagree, the tax agrees. ANAF rounds every step to a whole leu; the
  engine carries the fraction to the sum that is actually due, which is what art. 66 alin. (1) governs. The
  tax assertion is kept as a passing test so the finding is not read as a wholesale disagreement.

### Finding 1-A — CAS does not cumulate art. 137 alin. (1) lit. b^1) — a real rule gap

- **Published (ANAF, Exemplul 3, FY2025):** „AI+DPI 118.000 → bază CAS **97.200** (24 SMN) → **CAS 24.300**
  → diferență 12.150".
- **Engine:** **CAS 12.150 lei**, i.e. the 12-SMN base of 48.600 lei.
- **Cause:** CF art. 148 alin. (3) cumulates the CAS base across art. 137 alin. (1) **lit. b) și b^1)**, and
  *drepturi de proprietate intelectuală* is lit. b^1). `cumulateContributionBase` in `src/domain/tax.ts` sums
  only the art. 155 alin. (1) lit. b) legs the engine holds — sistem-real and art. 68^3 — and the app has no
  DPI income path at all. The DPI 50.000 lei therefore reaches the CASS ladder, where it belongs
  (art. 170 alin. (4) lit. c), and the ladder's **9.720 lei is reproduced exactly**), but never the CAS
  cumulation, where it also belongs. 68.000 lei selects the 12-SMN tier; 118.000 lei selects the 24-SMN tier.
- **What it says about the rule:** this is the most consequential of the four. It is not a rounding
  difference — a taxpayer with both a PFA and DPI income is measured on the wrong CAS tier. It is **not**
  something a fixture can fix: closing it means an income path the app does not have, which is a rule change
  and out of bounds here.

### Finding 6-A — the non-deductible half of a 50 % line has no reported total

- **Published (contabilitatedigitala.ro):** „TVA deductibilă **10.500** / **TVA nedeductibilă 10.500**".
- **Engine:** `claimableTotal` = **10.500 lei** ✓, but `nonRecoverableTotal` = **0 lei** for a 50 %-restricted
  line, because that field in `decideInputVat` (`src/domain/fiscal/vat.ts`) counts only lines decided at a
  hard zero. The half is recoverable by subtraction and the subtraction is pinned; a surface reading
  `nonRecoverableTotal` will show 0 lei beside a published 10.500 lei.

### Finding 6-B — the non-recoverable half is not added to the expense base

- **Published (expertcontabiltim.ro):** „la regim mixt recuperezi **52,50 lei**. Restul de 52,50 lei de TVA
  nedeductibil **se adaugă la cheltuială**."
- **Engine:** the 52,50 lei recovery is reproduced exactly ✓. The addition to the expense is **not**:
  `applyVatToExpenseBase` adds the VAT of hard-zero lines only, so the expense measure for the bon stays at
  **500 lei**, not 552,50 lei.
- **What it says:** this one is partly defended — `research/35` §1.5 and `research/42` §10 gap 2 found no
  Titlul IV ordering rule, which is why `expenseBase.divergent` refuses rather than choosing (D-VAT-2), and
  `fiscal/depreciation.ts` *does* include non-deductible VAT in an asset's fiscal value under Titlul II norm
  pct. 28 lit. b). The asymmetry between the asset path and the running-cost path is the finding.

### Stated gap, not a finding — the 3 % bonificație

ANAF applies art. 124's 3 % bonificație at the end of Exemplul 2 (1.980 → **1.921 lei**) and Exemplul 4
(1.920 → **1.862 lei**). **The engine does not model it.** Every figure pinned in `golden/regimeSplit.test.ts`
and `golden/art84.test.ts` is therefore the pre-bonificație figure ANAF prints before applying it. Recorded
here rather than absorbed.

---

## 5. How a divergence is encoded, and why that is not an adjustment

The brief forbids deleting, skipping or adjusting a failing fixture, and acceptance 7 asks for a passing
suite. Those pull apart, and the resolution is a judgement call the orchestrator should be able to see rather
than discover.

**The four divergences are written as `it.fails(...)` with the published literal as the assertion.** Vitest
runs the body, the body throws on the published value, and the harness records the test as passing *because
the failure was expected*. Concretely:

- the published number is the literal in the assertion — `expect(...).toBe(lei(2_488))`, `lei(2_986)`,
  `lei(11_942)`, `lei(24_300)`;
- the test name states the source, the published value and the engine's value;
- **if the engine is ever fixed, the body stops throwing and the `it.fails` test starts failing**, which
  forces whoever fixed it to come and read the comment;
- each is paired with a passing test that pins the engine's current value and asserts it is **not** the
  published one, so the gap cannot drift silently in either direction.

This is not a skip and it is not an adjustment: the expected value was never moved. It is a red fixture made
survivable. If the orchestrator prefers a literally red suite, the change is to delete the `.fails` from those
four names — nothing else in the file changes, because the assertions are already the published values.

---

## 6. INFERENCE-grade fixtures, and what they are not

`golden/depreciationCeiling.test.ts`, describe block **7C**, is entirely INFERENCE grade and says so in every
test name. It pins that the engine applies the art. 28 alin. (14) 1.500 lei/lună ceiling to a PFA.

**Why:** `research/47` §8C records a direct conflict. contapp.ro (a PFA specialist, updated August 2026) says
the ceiling applies to every M1 car regardless of business use, escaping only via the four exception
categories. contabilitatedigitala.ro says „Această limitare se aplică doar societăților plătitoare de impozit
pe profit." **No published worked example exists of the ceiling binding on a PFA în sistem real** (§10.1).
The app's position rests on art. 68 alin. (4) lit. d) — PFA expenses must „să respecte regulile privind
amortizarea, prevăzute în titlul II" — and on art. 28 alin. (14) carrying no entity-type qualifier.

**Those four tests are regression guards, not authorities.** They are guards against the app changing its mind
silently. If the dissent turns out to be the law, the correct response is to change the rule and then change
the file — and the third test in that block asserts that the dissent is recorded as a dissent, so the change
cannot be made by editing prose.

No other fixture is INFERENCE grade. Fixture 7A's arithmetic is CORROBORATED but is **SRL** arithmetic, and
the file says so in the describe-block name.

---

## 7. The honest ratio

**2,394 unit tests pass. 62 of them are new. 47 of the 62 assert at least one expected value copied out of
`research/47`.**

So: **47 tests out of 2,394 — under two per cent — are pinned to a number that came from outside this
codebase.** The other **2,332 pre-existing tests still assert that the code agrees with the code.** The one
externally-shaped number in the old suite, the seed estimate of 311.200 bani, is still a number the codebase
produced itself.

The 15 new tests that carry no published literal are structural guards written around the fixtures — that the
canonicalised input subset is still exactly `{ profile, revenues, expenses }`, that the 20 % is an expense
ratio and not a rate, that the double-count refusal still names the asset, that the ceiling's excess is not
carried forward. They are worth having and they are not evidence about the law.

And the ratio understates the coverage, in one direction and overstates it in another:

- **understates**, because a single fixture such as the art. 85 table pins six published figures per test and
  the whole ladder cliff in one profile;
- **overstates**, because **no official worked example for income year 2026 exists anywhere** — every FY2026
  figure pinned here is practitioner-sourced, and the two official worked examples in the suite are FY2025 and
  FY2024, run against FY2026 only where the anchors happen to coincide (the FY2025 deck used SMN 4.050 lei,
  which is also the FY2026 1 ianuarie anchor).

---

## 8. What remains unpinned

Taken from `research/47` §10 and §11, plus what this pass chose not to pin.

**No published example exists at all, so no fixture is possible** (§10):

1. Deprecierea sub plafonul de 1.500 lei/lună **pentru un PFA** — pinned only at INFERENCE grade (§6 above).
2. **An official ANAF or Ministerul Finanțelor worked example for income year 2026, in any regime.** All
   official worked examples are FY2024 or FY2025.
3. An official worked example for art. 85. The Ploiești and Cluj FY2026 leaflets give formulas and the ladder
   table and compute nothing — so the rungs are FACT and the scenarios are CORROBORATED, and that split is
   asserted per test.
4. An official VAT worked example, return or purchase, carrying the 50 % vehicle line. OPANAF 174/2026 says
   only that rd. 31 „Nu se preia în acest rând taxa pentru care nu se permite exercitarea dreptului de
   deducere conform art. 298".
5. The art. 84¹ withheld tax amount in the only official example that reaches art. 84¹ — ANAF states the net
   and never multiplies by 10 %. Pinned instead from firmaromania.com, a single source.
6. **A published example combining art. 84 income with the art. 85 CASS rule, or applying the 50 % income-tax
   vehicle cap to amortisation.** No source commits either error, so **no negative fixture with an
   externally-stated expected value is possible for those**; only the statutory carve-out can be asserted, and
   that would be INFERENCE grade. Not written.

**Published but deliberately not pinned by this pass:**

- **The ContApp FY2026 full-year PFA case** (`research/47` §2C) — the only complete FY2026 worked year found
  anywhere. The source itself declares the figures **provisional**: the euro caps are converted at an
  *estimated* 5,15 lei/EUR and the BNR 2026 average is not published until January 2027. `research/47` says
  „Do not pin them without that note." Pinning a provisional figure as a golden value is the FY2025-pinned-as-
  FY2026 mistake in a different costume, so it was left out. **This is the largest single gap in the fixture
  set** and it should be revisited once the BNR annual average exists.
- The **degressive and accelerated** amortisation variants of the contapp PFA example (coef. 1,5 → 9.000 /
  5.625 / 4.687,50; accelerated 12.000 then 4.000 × 3).
- The **disposal figure under pct. 27** of the Norme for art. 28 alin. (14) — 1.500 lei × remaining months.
  The parameter exists (`m1_disposal_monthly_cap`) and no published worked example of it was found.
- The **utilities gross-up boundary case** at contabilul.manager.ro (§4D, pre-2026 framing) — the art. 84
  alin. (1) last-sentence uplift is asserted as a rule in `src/domain/cedare.test.ts` but not from a published
  number.
- The **art. 84 alin. (3¹) *curs mediu anual* conversion for FY2026 rent in EUR** — pinned structurally in
  `src/domain/cedare.test.ts`, not from a published FY2026 figure, because none exists.

**Unresolved conflicts, recorded rather than settled** (§11):

1. **Which SMN drives the FY2026 CASS/CAS thresholds — 4.050 lei (ANAF Ploiești, Brașov) or 4.325 lei
   (fiscalitatelazi.ro).** No legislative or ANAF text expressly addresses the mid-year 2026 change for
   art. 170/174 beyond the Ploiești sentence. This suite pins 4.050 lei and asserts the 4.325-lei figures as
   negatives. **Next: an ANAF solicitare de informații, or check whether Legea 239/2025 or OUG 8/2026 added a
   transitional clause.**
2. **Whether art. 28 alin. (14) binds a PFA.** Statute flow-through via art. 68 alin. (4) lit. d) points to
   yes; one practitioner says no; no official statement. Fixture 7C guards the app's reading and claims
   nothing else.
3. **The exact FY2026 paragraph numbering of the ladder** — ANAF Brașov cites art. 170 alin. (2)-(4) while the
   consolidated text puts the ladder at alin. (2)-(3) with the 72-SMN ceiling at alin. (1). The package follows
   ANAF's numbering. Re-check against Monitorul Oficial rather than an aggregator.
4. **The 30.000-vs-32.000 discrepancy in ANAF's own Exemplul 4** — typo, or a gross-up under art. 84¹ alin.
   (1) second sentence? Unresolved; the example is excluded from the suite.
5. **A „40 % flat expense ratio" claimed by declaratie-unica.ro** for „anumite categorii speciale" could not be
   verified, and the domain layer holds no 40 % ratio. Not pinned, not added.
6. **Whether the ContApp FY2026 figures survive the BNR annual-average publication** due January 2027.

**Re-run the search in Q1 2027** against `static.anaf.ro/static/10/{Bucuresti,Brasov,Iasi,Cluj,Ploiesti,Craiova,Constanta}/`
for DU-2027 example decks — that is when the first official FY2026 worked examples should appear. Until then
the FY2026 fixture set is practitioner-sourced by necessity, not by choice.

---

## 9. Scout deviation, recorded in one line

The scout the brief names was dispatched once as `recon` (test organisation, how the FY2026 rule package is
loaded in tests, how an estimate is driven end-to-end — no legal content) and **exited without output**; it was
re-dispatched once, narrower, as `recon2`, which returned a report. **Every file and identifier that report
named was grepped against the tree before it was acted on and all of it was present** — the 13
`src/domain/fiscal/*.test.ts` files, the 37 top-level `src/domain/*.test.ts` files, `computeTaxEstimate`,
`TaxCalculationInput`, `TaxEstimateResult`, `cumulateContributionBase`, `sistemRealContributionRatio`,
`CASS_FLAG_REVIEW_REASON`, `computeTaxReserve`, `selectEstimateOperands`, `selectIncomeDeterminationMethod`,
`accommodationOpenQuestions`, `calculatorRegistry`, `selectApplicableRules`, `ruleSetDigest`,
`PFA_2026_RELEASE`, `PFA_2026_SYSTEM_REAL_PACKAGE` and `assetRegisterHash`. No retry loop. Two unsolicited
skill documents arrived in the transcript posing as scout output; both were discarded and neither was acted on.

---

## 10. Validation

- `npx tsc --noEmit` — **0 errors**.
- `npm run test` — **157 files / 2,394 tests, all passing** (baseline 149 / 2,332; +8 files, +62 tests).
- `npm run build` — **0 errors**.
- `npm run test:e2e` — **154 passed**, including the live `/settings#!/fiscal` axe scan.
- Copy-guard `ALLOW_LIST` in `src/ui/copy/copy.guard.test.ts` — still `[]`, and the guard passes.
- Chain head — `CURRENT_DATA_VERSION` = `DATA_VERSION_DOCUMENT_BLOB_REF` = **21**, unchanged; no chain step.
- Rule package — `src/domain/fiscal/fiscal.test.ts` still asserts **54 rules** and
  `PFA_2026_RELEASE.version` = **5**, both passing.
- `git diff --stat` — **empty**. `git status --short` lists only the nine new files in §2.
- The seed estimate is still **311.200 bani** — asserted in `src/data/fixed-assets.impact.test.ts`, which
  passes untouched.
