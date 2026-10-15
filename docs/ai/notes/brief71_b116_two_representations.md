# B-116 — the two representations of DPI income: the comparison, for D-DPI-1

**Brief 71, 2026-10-15. This is a report, not a change.** Nothing in it was implemented. The B-112
stage-1 refusal (`dpi_income_double_represented`) is untouched and still behaves exactly as before.
The decision belongs to the user (`USER_DECISIONS.md` D-DPI-1). A recommendation is at the end and is
labelled as a recommendation.

Every claim below was read off the code on 2026-10-15 and carries its file:line. Where the code does
not yet do something the register implies, that is said plainly rather than smoothed over — and it
turns out to matter more than the principle.

---

## The two representations, as the code holds them

| | (1) Hand-typed net | (2) Recorded documents |
|---|---|---|
| Where | `CassLadderYear.proprietateIntelectuala` — `domain/models.ts:500`, zod `domain/schema.ts:145`, entered on Settings (`pages/Settings.tsx:110`, `:672`) | `Revenue.incomeCategory` / `dpiContractType` / `dpiExcludedKind` — `data/types.ts:70,80,90`, zod `data/schema.ts:136-148`, entered on Revenues (`pages/Revenues.tsx:155-183`) |
| Persisted at | `profile.cassLadderYears[n].proprietateIntelectuala` | `revenues[n].{incomeCategory,dpiContractType,dpiExcludedKind}` |
| Reaches a figure? | **Yes — all four DPI paths** | **No — none** |

**The asymmetry is not a matter of maturity; it is structural today.**

The typed net is read at `domain/tax.ts:872` (`const dpiNet = ladderYear?.proprietateIntelectuala ?? null`)
and from that one line feeds:

- the **CAS ceiling** of art. 148 alin. (3) — `casCumulationBase(legs, dpiNet)`, `tax.ts:407-411,878`;
- the **CASS ladder** of art. 170 alin. (4) — `amounts.proprietate_intelectuala`, `tax.ts:1052` → `calcCassLadder`;
- the **CAS withholding** derivation — `casWithholdingSourceNet: dpiNet ?? undefined`, `tax.ts:921`;
- the **CASS withholding** across the three art. 174¹ alin. (3) sources — `cassWithheldForLadder`.

The recorded documents reach **no calculator at all**. They are scoped *out* of the sistem-real engine at
`estimateBasis.ts:2462` (`revenues.filter(r => !isDpiIncome(r))`), and `selectYtd`'s `dpiGross` /
`dpiGrossNet` (`aggregation.ts:424-425`) have exactly one production reader: the sentence inside the
double-representation refusal (`estimateBasis.ts:1378`). Their only other effect is the coverage rows.

**The 40 % quota is never applied to produce a number.** `calcDpiFlatQuota` exists and is tested
(`fiscal/calculators.ts:1658`, registered at `:1809`), but grep finds no production caller, and
`fiscal/dpi2026.ts:65` states the reason in its own words: *„`calculatorId` is a label only … no
calculator is registered for this rule [that the engine calls]"*. `dpiQuotaPercentOf` is read in one
place — `estimateBasis.ts:1358` — to **quote** the percentage inside a coverage sentence.

So: gross → quota → net, the step that would make the recorded representation a number, **does not
exist yet**. That is the single most decision-relevant fact in this file, and it cuts against the
principled reading rather than with it.

**And the typed net is what reproduces ANAF.** The golden fixture that *minted* B-112 — ANAF DU-2026
Exemplul 3, AI 68.000 + DPI 50.000 → bază CAS 97.200 → CAS 24.300 — is reproduced today by typing the
DPI net onto the ladder: `golden/regimeSplit.test.ts:114` and `:157` set
`proprietateIntelectuala: lei(50_000)` and assert `CAS (25%)` = **24.300 lei** (`:166`). The app's only
working DPI arithmetic runs on representation (1), against ANAF's own published figures.

---

## 1. What each can express that the other cannot

### The typed net can express

- **A net the app cannot derive.** Today that is not a hypothetical — it is the *only* net the app has.
  Concretely reachable and not derivable: a net for a year with no recorded documents; a net under the
  art. 72 alin. (3) exclusion set, where **no quota applies at all** (see §3); a split of one economic
  receipt across categories; a figure adjusted by something the app holds no field for.
- **A person's own answer, with no inference.** `dpi.ts` is explicit that the app records the
  classification and never derives it (ÎCCJ dec. 1793/2021). The typed net is the same stance one level
  up: the person states the net; the app does not second-guess it.

### The records can express

- **Gross** — the quantity the statute actually names, and the only input a quota can be applied to.
- **The art. 72 alin. (3) exclusion flag**, one flag with two consequences (no quota; outside CAS under
  art. 137 alin. (1) lit. b¹)) — `dpi.ts:79-98`. The typed net cannot carry it at all.
- **The object of the contract** (`cesiune_licenta` vs `contract_de_comanda`), which is the fact ÎCCJ
  1793/2021 makes load-bearing, and which `dpiRecordConflict` checks. The typed net cannot carry it.
- **The DPI part of turnover as a named subset**, which is what keeps the art. 310 alin. (1) VAT plafon
  honest: 300.000 lei art. 67 + 120.000 lei art. 70 measures **420.000 lei**, not 300.000
  (`dpi.path.test.ts`, the art. 310 block). Retiring the records understates the VAT registration duty.
- **The coverage surface** — `dpi_income_not_modelled`, `dpi_income_double_represented`, and the B-117
  contradiction row.

### Which of these actually matters here — and which is rhetoric

**Matters:** gross as the statutory input; the exclusion flag; the contract object; the turnover subset;
the coverage rows. Each of these is a fact the app either holds or cannot hold, and three of them
(exclusion flag, contract object, turnover) have no representation at all on the typed side.

**Matters less than it sounds:** *provenance and per-document dates.* They are real, but today they
drive no figure — DPI receipts are out of the sistem-real engine, so a DPI document's date decides only
which fiscal-year coverage row it produces. Arguing the records from "dates and provenance" argues a
benefit the app does not currently deliver.

**Cuts the other way:** the records' advantage is *potential*. The typed net's advantage is *realised*.
Anyone choosing the records on statutory-purity grounds is choosing a representation that currently
produces no number, and deleting the one that does.

---

## 2. What retiring each costs

### Retiring the typed net — a data-shape decision, and it owes a chain step

- **Persisted key:** `profile.cassLadderYears[].proprietateIntelectuala`. Declaration to remove:
  `domain/schema.ts:145`. A retired key needs a chain step that **drops** it — the precedent is
  `annual-filing` (v10→v11), which drops `declarations` rather than leaving zod to strip it
  (`data/schema.ts:588-592` says exactly why). **Chain head is v21 (`document-blob-ref`); B-145 is
  already minted and queued as the next step**, so this fork's step is v23 or must be ordered after
  B-145. That ordering is a chain decision, not a detail.
- **Personas (not the Worker's to edit — reported, not touched):** five set the key.
  `persona6Investor.ts:153` → `lei(30000)`; `persona4Host.ts:147`, `persona5Landlord.ts:145`,
  `persona7Agricultural.ts:161`, `persona9NormaVenit.ts:127` → `lei(0)`. Persona 6 is the one that
  *moves*: it declares DPI **only** this way and holds **zero** recorded DPI documents
  (`personaCoverage.test.ts:874-877` asserts `dpiRecords` is empty).
- **Production readers to re-point:** `tax.ts:872` (the single read), `:878`, `:921`, `:1052`;
  `casCumulationBase` loses its second operand; `calcCassLadder` loses a category;
  `CASS_LADDER_CATEGORY_HAS_CAS` (`models.ts:426-433`) loses its only `da`;
  `cassLadderMissingCategories` changes the "answered N of six" gate to five;
  `pages/Settings.tsx:110,672` and `ui/copy/settings.ts:299,307,351`.
- **Tests that move:** roughly 35 files reference the key. The ones that carry real money:
  `golden/regimeSplit.test.ts` (ANAF Exemplul 3 — 24.300 lei CAS, and the fixture that minted B-112),
  `tax.dpiCas.test.ts`, `tax.dpiWithholding.test.ts`, `fiscal/cassLadder.test.ts`,
  `tax.cassLadder.test.ts`, `dpi.path.test.ts`, `personaCoverage.test.ts`,
  `e2e/cass-ladder.spec.ts` (4 tests, including *"five amounts answered and one blank stops the
  estimate and names the missing category"*), `e2e/persona-6-investor.spec.ts:42`,
  `e2e/accommodation-facts.spec.ts`.
- **The blocking cost, and it is the register's own:** until a gross→quota→net path exists, retiring
  this key leaves users **unable to report DPI CASS or DPI CAS at all**. The register already says
  *"once records can compute it — not before."* This report confirms the "before" is still now.

### Retiring the records — deleting documents a person entered

- **Persisted keys:** `revenues[].incomeCategory`, `dpiContractType`, `dpiExcludedKind`
  (`data/schema.ts:136-148`). Also a chain step, to drop three keys from stored records.
- **Data destroyed:** the DPI half of persona 2 — 15 records, **150.000 lei of DPI gross**
  (`persona2ContentCreator.ts:12`, pinned at `personas.test.ts:254-266` as 15.000.000 bani) — and, for
  a real user, the only record of *which* receipts were art. 70.
- **It does not just remove a feature; it mints a defect.** With `incomeCategory` gone,
  `estimateBasis.ts:2462` has nothing to filter on, so art. 70 receipts **re-enter the sistem-real
  engine** and are taxed as art. 67 income — a different base, no quota, the wrong contribution limbs.
  That is B-112's original failure restored, not a cleanup. The art. 310 turnover split goes with it.
- **Also removed:** the category select and both conditional selects on Revenues; `dpiCoverageGaps`
  and both DPI coverage reasons; `dpiGross` / `dpiGrossNet` / `dpiRecordIds` /
  `dpiDeclaredRecordIds`; `dpiRecordConflict` and the ÎCCJ check; the art. 72 alin. (3) one-flag-two-
  consequences model; **and B-117 as fixed in this brief**, whose whole subject is a record carrying a
  DPI contract fact.
- **Tests that move:** ~10 files, plus `e2e/persona-2-content-creator.spec.ts` — the only browser proof
  that DPI exists in the product at all (B-123 was minted precisely because there was none) — plus
  `personaCoverage.test.ts:869-878` and `personas.test.ts:254`.

---

## 3. Which is closer to the statute — stated plainly, then argued from the code

**Plainly, as the brief asks:** art. 154 alin. (1) lit. h) / art. 170 alin. (4) put a **net** on the
ladder, and that net is fixed by art. 72 alin. (2) / art. 72¹ alin. (1) as **40 % of gross deducted
from gross**. The quota is a statutory percentage, not a number a taxpayer types. So on the ordinary
case: **the recorded representation encodes the quota** — the rule `DPI_ART72_2026` carries the 40 % and
gross is what it applies to — **and the typed representation lets a person override it.** The app says
so on screen: `ui/copy/settings.ts:307` tells the person the app does not compute the forfetar. That is
the strongest single argument on the records' side, and it should not be softened.

**Argued from what the code actually does, three things qualify it.**

1. **The quota is never applied.** `calcDpiFlatQuota` is registered and tested and never called
   (`calculators.ts:1658,1809`; `dpi2026.ts:65` says `calculatorId` is a label only). The recorded
   representation is closer to the statute *in intention*; the typed one is closer *in execution*, and
   demonstrably so — it reproduces ANAF's 24.300 lei (`regimeSplit.test.ts:114,166`).
2. **The quota is not always a quota.** Art. 72 alin. (3) / art. 72¹ alin. (2) take *moștenitori*,
   *drept de suită* and *remunerația pentru copia privată* out of the forfetară mechanism entirely —
   there is no 40 % to apply, and those sums are also outside CAS under art. 137 alin. (1) lit. b¹).
   For that case the statute does **not** supply a percentage of gross, and the app has no path that
   turns the exclusion flag into a net. A hand-typed net is currently the only way that person's DPI
   position can be stated at all.
3. **A hand-typed net is not the same thing as a wrong net.** `dpi.ts` refuses to infer the income
   category because ÎCCJ 1793/2021 shows the *paper's label* is not the test. The same epistemic
   humility applies to the net: a person with DPI income and no recorded documents is not hypothetical
   (persona 6 is built as exactly that), and a figure they read off their own D212 is evidence, not a
   guess the app should refuse in favour of nothing.

**Verdict on §3, as a finding and not a decision:** the records are the representation the statute
describes; the typed net is the representation the app uses. The gap between them is one missing call
site, not a missing concept — and that is the cheapest place in this whole fork to spend effort.

---

## 4. What the user would lose in the UI

**If the typed net is retired:**
- The `#set-ladder-proprietateIntelectuala` input disappears from Settings → Fiscal; the ladder becomes
  five amounts and the "answered N of six" gate becomes N of five.
- **A person with DPI income and no recorded documents loses the ability to report DPI CASS and DPI CAS
  entirely.** Persona 6 is that person: salariat, 30.000 lei of DPI typed on the ladder, zero DPI
  documents. Its 9.720,00 RON hero, its CAS cumulation line and its 97.200,00 CASS base
  (`e2e/persona-6-investor.spec.ts:42-53`) all go to a refusal or a zero.
- Nothing else on screen can take its place today.

**If the records are retired:**
- The Revenues category select loses its *drepturi de proprietate intelectuală* option, and the two
  conditional selects (`dpiContractType`, `dpiExcludedKind`) vanish with it.
- The `dpi_income_not_modelled` rows vanish — so the hero can read **„Calculat"** over a register whose
  art. 70 receipts are being run through the art. 67 engine. That is precisely the B-112 failure mode:
  *"the number was small **and said nothing**."*
- Persona 2's 15 DPI documents silently become art. 67 receipts, and the demo's only DPI browser proof
  (`e2e/persona-2-content-creator.spec.ts`) goes with them.

---

## Recommendation — **a recommendation, not a decision, and nothing was implemented**

**Recommended: retire the hand-typed net, and not before a gross → quota → net path exists — with the
added finding that the missing piece is one call site, not a subsystem.**

Why, in one paragraph: the register's existing intent (retire the typed net once records can compute
it) is still right, and the four points above support it — the records hold three facts the typed net
cannot hold at all, and the typed net lets a person override a statutory percentage. What this report
adds is that the "once records can compute it" clause is nearer than it looks: `calcDpiFlatQuota` is
already written and already tested; what is missing is the call from `tax.ts`, plus a decision about
the art. 72 alin. (3) case where no quota exists. That makes the cheapest next step *finishing the
records' path*, not choosing between two half-paths.

**The honest case against the recommendation**, for the user to weigh: retiring the typed net strands
every taxpayer with DPI income and no documents — persona 6 is built as exactly that, and they lose the
only DPI reporting route the app has. If that population matters more than statutory tidiness right
now, the fork should resolve the other way, or the typed net should stay as an explicit override with a
recorded reason — which is a third option the register does not currently contemplate.

**What is NOT recommended, and was not done:** no precedence rule; no quiet preference; no retirement
of either side; no change to the B-112 refusal. The refusal is the correct behaviour while the fork is
open, and it is pinned unchanged by this brief (`dpi.path.test.ts`, the B-117 block).

**Two facts the user needs before choosing, so they do not have to open a file:**
1. Either retirement owes a migration chain step. Chain head is **v21**; **B-145 is already minted and
   queued** as the next step, so this fork's step is v23 or must be ordered after B-145.
2. Whichever way the fork goes, the art. 72 alin. (3) exclusion case has **no** quota to apply and
   therefore needs an explicit answer that neither representation currently gives in a figure.
