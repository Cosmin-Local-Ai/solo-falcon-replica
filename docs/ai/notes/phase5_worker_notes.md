# P5 WORKER WORKING NOTES (durable scratch — survives compaction)

Repo: `/home/agent/workspace/solo-falcon-replica` · branch `master` · Phase 5 ONLY (2026 PFA sistem-real INCOME TAX)
Deliverable: `docs/ai/phases/05_income_tax.md` + update `docs/ai/STATE.md` rows B-6, B-13…B-16.
**Do NOT start Phase 6.**

---

## A. ORCHESTRATOR BRIEF — ESSENTIALS (from /tmp/p5-brief.md)

### Working rules
1. Only Worker running; never spawn another Worker; never run 2 Workers at once.
2. Spawn Scouts BEFORE modifying anything; use their reports instead of broad self-search.
   Parallel Scouts OK. Scout failure → retry once with explicit working-model override → if that fails, **STOP and report BLOCKER**; do not substitute self-inspection.
3. One coherent job. Change only what Phase 5 requires.
4. **No post-Worker Scout verification pass.** Self-validate.
5. Self-validate: `npx tsc --noEmit`, `npm run build`, `npm run test` (MUST run full unit suite — shared engine), `npm run test:e2e`.
6. Orchestrator addendum mid-run: **do not read local files myself — Scouts do that; preserve context.**
7. No new internet research. Missing legal fact ⇒ report as BLOCKER, never guess/invent a citation. App renders citations to users.

### Handoff format (mandatory, exactly these keys)
```
COMPLETED:
FILES CHANGED:
TESTS:
VALIDATION:
DECISIONS:
BLOCKERS:
NEXT HANDOFF:
```

### Documentation namespace
- `docs/ai/steps/` (02–34) = FROZEN archive. Never rename/delete/renumber/overwrite. Never cite as evidence of current behaviour. New phase doc wins over archived step file (say so in one line).
- Phase deliverables → `docs/ai/phases/NN_<name>.md`. Live state: `docs/ai/PLAN.md`, `docs/ai/STATE.md`.

### Source authority
- `research/06_2026_fiscal_research.md` = **NOT authoritative** (self-contradicts CAS min base + VAT threshold). `decisions/09_*` inherits some of it → also not law. Never cite as `sourceUrl`.
- Authoritative: `phases/02_fiscal_baseline.md`, `research/08_art118_income_tax_2026.md`, `research/09_u8_amendment_scan_and_optare.md`.
- **TRAP:** Portal Legislativ doc **200491** = stale pre-2024 art. 118 (7 ani, CAS-only deduction). Source of record = **08.08.2026 consolidation, doc 312601**. Any quote saying "7 ani" or deducting CAS only is WRONG.
- **CASS rate is 10% (art. 156), NOT 16%.** 16% is the pre-2018 rate. Never reintroduce.

### Complete phase list (do not invent a boundary)
1 real baseline ✅ · 2 fiscal baseline ✅ · 3 CAS ✅ · 4 CASS ✅ · **5 income tax = MINE** · 6 fiscal regime+profile foundation (profile fields feed engine; `salaryStatus`/`pensionStatus`/`otherIncome`/`caen`/`cashFloorLei` read by nothing; `updateProfile` has no UI caller) · 7 identity source of truth + persisted-schema versioning/migration (owns B-10,B-11,B-12) · 8 financial amount semantics (cash/VAT/net/gross/deductible/tax-relevant; Q-VAT-BASIS) · 9 payment/collection dates · 10 money precision (integer bani, decimal.js-light, rounding policy).

### Verified legal basis (HIGH unless noted; verbatim in research/08)
- **10% flat** on venitul net anual impozabil — CF **art. 123 alin. (1)**, unchanged 2026.
- **16% does not apply** to this entity type — CF art. 114 alin. (1), art. 115 alin. (1) lit. b).
- **No 30% deductible-expense cap inside sistem real.** Only 30% in Titlul IV = art. 68^3 alin. (2) (forfetar switch, cazare >7 camere, art. 67 alin. (1^1)) — outside sistem real. Do not re-import via a CAEN-aware rule.
- **Art. 118** (Titlul IV, Cap. XI, „Stabilirea venitului anual impozabil"), no 2025/2026 amendment. Order:
  1. per source: `VNA recalculat = VNA (art. 68 sistem real) − pierderi fiscale reportate` — alin. (2) lit. a)
  2. sum across sources — alin. (2) lit. b)
  3. deduct CAS and CASS **each prorated**:
     - CAS deductibilă = (VNA în sistem real ÷ total venituri cumulate art. 148 alin. (3)) × CAS calculată art. 151 alin. (1) — alin. (2^2)
     - CASS deductibilă = (VNA în sistem real ÷ total venituri cumulate art. 170 alin. (1)) × CASS calculată art. 174 alin. (1) — alin. (2^3)
     - the art. 174 alin. (6) CASS difference is **excluded outright** — alin. (2) lit. b) „cu excepția…"
  4. **hard cap alin. (2^4):** CAS deductibilă + CASS deductibilă ≤ venitul net anual recalculat.
- **Loss carry-forward art. 118 alin. (4)-(5),(7):** „în limita a **70%** din veniturile nete anuale, obținute din **aceeași sursă de venit** în următorii **5 ani fiscali consecutivi**"; chronological by age; personal & non-transferable; unabsorbed → pierdere definitivă. No election language (mandatory).
- **A PFA cannot be a CIT taxpayer in 2026 — HIGH.** CF art. 13 alin. (1) / art. 14 / art. 15 confine Titlul II to persoane juridice (art. 13 alin. (2) only *removes*; the only „persoanele fizice" string in 13–15 is art. 15 alin. (2) lit. o), a venit neimpozabil line for the 2% redirection — not a hook). Art. 68 alin. (1) exception list is closed (art. 68^1, 68^3, 69). Option vehicle **art. 120 CF is Abrogat** (OUG 128/2024 pct. 11 Art. I, MO 1125/11.11.2024, eff. 01.01.2025). Settled — do not re-litigate.
- **No turnover-based minimum tax reaches a Titlul IV sistem-real PFA.** 1% IMCA is art. 40^1 (Titlul II). No art. 10^1 / art. 118^1 exists in the current consolidation.
- **Attribution settled:** across Legea 239/2025, OUG 89/2025, OUG 8/2026, Legea 141/2025 read in full — **no 2025-2026 act amends CF art. 118**; only Legea 239/2025 amends art. 123 (alin. (1^2), (2) — neither touches PFA sistem real). `research/09` §5.
- **CASS 10% verbatim art. 156** (OUG 79/2017 pct. 69 Art. I, MO 885/10.11.2017, eff. 01.01.2018). Consequence: art. 180 alin. (2) elective CASS and art. 174 alin. (6) minimum are **same rate, same base** (10% × 6 SM = 2,430). Difference is the **route**: alin. (6) tops a low base *up to* 6 SM; art. 180 alin. (2) is a *flat elective* 6 SM. Must not double-count — art. 174 alin. (9): the art. 180 alin. (2) contribution „este luată în calcul" when establishing the annual contribution under art. 170 alin. (1).
- **CASS ceiling verbatim art. 170 alin. (1):** base „…nu poate fi mai mare decât cea corespunzătoare unei baze anuale de calcul egale cu nivelul de **72 de salarii minime brute pe țară**" (291,600 = 72 × 4,050).
- **U-8 CLOSED:** OUG 89/2025 and OUG 8/2026 touch none of CF art. 154/170/174/180 (`research/09` §1). CAS/CASS from Phases 3–4 stand. Do not re-open.

### SCOPE — every item is an acceptance criterion, none optional
**5.1 B-14 invert the regime gate (highest priority; nothing else testable until right).**
`tax.ts:52-54` returns `review_required` for `impozit_pe_venit` = the DEFAULT regime (`profile.ts:41`) and the only regime this package exists for. All numeric income-tax assertions in `tax.test.ts` currently run under `impozit_pe_cit` (12 vs 2, and those 2 are the short-circuit assertion), while `INCOME_TAX_2026` is a Titlul IV rule (`sourceArticle: "art. 123 alin. (1) + art. 118"`).
- Delete the phantom-cap short-circuit.
- Compute for `impozit_pe_venit`.
- `impozit_pe_cit` → `REVIEW_REQUIRED` framed as a **data-integrity failure** (regime cannot legally apply to a PFA / entity is actually a persoană juridică), citing **art. 13 alin. (1) / art. 14 / art. 15** + abrogation of **art. 120** — **NOT** "a different base applies".
- **Re-point numeric tests to `impozit_pe_venit`.** Expect to touch most of `tax.test.ts`.
- Do NOT change the `PfaRegime` union or the profile model → Phase 6. Note the handoff.

**5.2 B-13 art. 174 alin. (6) top-up is NOT deductible.** `tax.ts` subtracts `cassValue` in full. Art. 118 alin. (2) lit. b) excludes it. `calcCass` already names the difference in its breakdown — surface it as a distinct non-deductible component, deduct only the deductible part. Today `0 < VNA < 6 SM` over-deducts → **understates tax**. Add a test pinning the difference.

**5.3 B-15 prorate + cap the CAS/CASS deduction.** Implement alin. (2^2), (2^3), (2^4). Single-source ratio = 1 ⇒ **today's numbers must not move** — that is the test: prove behaviour-preserving for single-source while mechanism is correct and the cap enforced. Make the ratio explicit in the calculation lines so a future second source cannot silently break it.

**5.4 B-16 stop discarding fiscal losses.** Art. 118 alin. (2) lit. a) applies reported losses BEFORE summing sources; alin. (4)-(5) = 5 ani / 70% / aceeași sursă. `tax.ts:112-118` zeroes tax and stores nothing.
- Implement what is possible **without inventing a persistence layer**: a loss year must **surface the loss + the statutory 5-year/70% rule**.
- Do NOT invent prior-year storage → Phase 7. State exactly which half is done vs deferred, in the phase doc AND `STATE.md`.

**5.5 Delete the stale 16% NOTE string** in `calcIncomeTax`'s breakdown (asserts a "16% progressive surcharge threshold … REVIEW_REQUIRED for the surcharge portion"). NOTE: the claim that `progressive_rate` still exists at `package2026.ts:109` is **stale** — verify, don't "fix" a parameter already gone.

**5.6 B-6 remainder — resolve `multiple_6x/12x/24x/72x`** (`package2026.ts:33-36`, on the `wage-reference` rule). Verified unreferenced; only parameter of that rule any code reads is `reference` (`calculators.ts:69`). They duplicate `reference × 6/12/24/72` — same second-source-of-truth problem Phase 4 removed for `min_cass`/`max_cass`. **Remove them or derive them.** Do not leave open.

**5.7 Provenance.** Update `INCOME_TAX_2026.sourceArticle` to what was actually implemented: art. 123 alin. (1), art. 118 alin. (2) lit. b) + alin. (2^2)-(2^4), plus the regime gate's art. 14 lit. a) / art. 120 abrogation where relevant. `verifiedAt` must reflect the real verification date. No invented citations.

**5.8 Explicitly OUT of scope**
- CAS/CASS **amounts** (Phases 3–4 closed them) — only the *deduction* treatment (5.2, 5.3) is mine.
- UI changes.
- Profile model / `PfaRegime` union → Phase 6.
- Persisted-schema versioning, prior-year storage → Phase 7.
- Money precision (float lei) → Phase 10. Do not convert to bani.
- **Q-NONDEDUCT-VAT (U-1)** — non-deductible VAT for a neplătitor is UNVERIFIED. Must stay `REVIEW_REQUIRED` if it surfaces at all. Never a computed rule.
- art. 68 alin. (4) deductibility **per expense** — app has no per-expense nature data; do not fake it. Record as an input gap (Phase 6/9), not a rule.
- art. 174 alin. (8) prior-year CASS relief + art. 180 optare — need prior-year inputs the app does not hold (alin. (8) triggers on „în anul precedent"; optare is an election with no field). Both verbatim in `research/09` §2-3, both = 2,430 at the same rate ⇒ leaving them unimplemented is a deliberate **input-gap** decision, not a modelling gap. Say why in the phase doc.

### Known state — do not rediscover
- Baseline before my change: `tsc --noEmit` exit 0 · `npm run build` exit 0 · **482 unit tests / 482** across 36 files · **23 e2e** passing.
- `min_cass`/`max_cass` removed in Phase 4; `max_cas` removed in Phase 3. Do not reintroduce. `min_base`/`max_annual_base` keep their ids because `thresholds.ts` reads them **by string** — renaming/deleting a parameter id can break a threshold with no type error.
- `calcCass` returns `reviewRequired` when `salaryStatus === 'da'` and net < 6 SM, because art. 174 alin. (7) lit. a) depends on a salary amount the profile does not carry. Correct; Phase 6 owns it. Do not paper over.
- CAS and CASS treat pensioners **differently** (CAS art. 150 alin. (1) exempts entirely; CASS art. 174 alin. (7) lit. c) removes only the top-up). Never mirror one branch into the other.
- `playwright.config.ts:9` LSP-only diagnostic — NOT a defect. Leave it.

### Acceptance criteria (1-10)
1 `impozit_pe_venit` produces a computed estimate with correct numbers · 2 `impozit_pe_cit` → REVIEW_REQUIRED with data-integrity reason + correct citations · 3 numeric tests run on `impozit_pe_venit` · 4 alin. (6) top-up excluded from base, test pins it · 5 CAS/CASS prorated+cap, single-source unchanged · 6 loss year surfaces loss + 5-year/70% rule · 7 16% NOTE gone, `multiple_*` resolved · 8 tsc 0 / build 0 / full unit green / e2e green · 9 `docs/ai/phases/05_income_tax.md` written (implemented, deliberately unimplemented + why, Phase 6/7 inherit) · 10 `STATE.md` B-13…B-16 + B-6 updated to reality, including anything NOT finished.

---

## B. SCOUT RESULTS

### B1. phase-docs (COMPLETE) — phases/02, 03, 04

Files: `phases/02_fiscal_baseline.md` (§0 supersession, §2 CAS, §3 SM anchor, §4 CASS, §5 income tax, §6 art. 68 verbatim, §7 VAT, §8 OUG screen, §12 UNVERIFIED register, §13 forward deps) · `phases/03_cas.md` (§1 law, §2 defects, §3 params, §4 threshold removal, §5 chosenBase) · `phases/04_cass.md` (§1 law, §2 decision table, §3 defects, §4 pension asymmetry, §5 params, §6 handoff, §7 not modelled, §9 U-8)

**2026 numeric baseline**
| Item | Value | Citation |
|---|---|---|
| SM 1 Jan 2026 | 4,050 lei/mo | HG 1.506/2024, MO I 1185/28.11.2024; anchor CF art. 135^1 alin. (3) |
| 6 SM | 24,300 | 6 × 4,050 |
| 12 SM | 48,600 | |
| 24 SM | 97,200 | |
| 72 SM | 291,600 | |
| CAS rate | 25% | CF art. 138 alin. (1) |
| CASS rate | 10% | CF art. 170 alin. (1) [rate article itself = art. 156] |
| Income tax | 10% flat | CF art. 123 alin. (1) „prin aplicarea cotei de 10% asupra venitului net anual impozabil determinat potrivit art. 118" |
| VAT threshold | 395,000 lei | CF art. 310 alin. (1) + **Ordonanța nr. 22 din 28.08.2025** (an OG, NOT OUG), MO 806/29.08.2025, in force 01.09.2025 |

SM anchor verbatim: „se ia în calcul valoarea salariului minim brut pe țară … în vigoare la data de 1 ianuarie a anului de realizare a venitului" — CF art. 135^1 alin. (3). HG 146/2026 (4,325 from 1 Jul 2026) does NOT re-anchor 2026.

**Phase 2 on income tax:** Q-16PCT = 16% applies only to art. 115 alin. (1) lit. b) = art. 114 alin. (2) lit. h)/i); PFA sistem real = art. 61 lit. a)/art. 68 → outside art. 114, 10%. `progressive_rate: 16` already REMOVED. Q-30PCT-CAP = PHANTOM (only art. 68^3 alin. (2), art. 85 alin. (2), art. 106). §5: „Phase 5 is therefore a **deletion, not an implementation**". Real gate = art. 68 alin. (4) (verbatim captured in phases/02 §6; amended OUG 79/2017 pct. 16, lit. a) OUG 50/2015 pct. 8; no 2025/2026 amendment to alin. (4)). OUG 8/2026 Art. 6 pct. 26-28 add art. 68 alin. (5) capped items: lit. g) rewritten (pensii facultative, €400/yr/person), new g^1) (pensii ocupaționale, Legea 1/2020), g^2) (produse paneuropene de pensii personale, Reg. (UE) 2019/1.238, €400), new s) (sume plătite în scopul personal pentru acțiuni/obligațiuni/ETF via art. 961 alin. (1), €400, fără costurile tranzacției).

**Phase 3 CAS ladder (art. 148 alin. (2))**
| condition | base | CAS 2026 |
|---|---|---|
| pensioner / own social insurance system (art. 150 alin. (1)) | — | 0 |
| cumulated income < 12 SM, no alin. (4) election | — | 0 (art. 148 alin. (1)) |
| 12 SM ≤ income < 24 SM | floor 48,600 | 12,150 |
| income ≥ 24 SM | floor 97,200 | 24,300 |
| voluntary higher chosen base | chosen ≥ floor | 25% × chosen |

`calcCas` reads ids: `rate` (25), `min_base` (48,600 — id kept, `thresholds.ts` `CAS_MIN_BASE` reads by string), `tier2_base` (97,200, label "not a ceiling"), `tier1_cas` (12,150), `tier2_cas` (24,300, not a cap). Removed: `max_base`→`tier2_base`, `max_cas`→`tier2_cas`, `min_cas`→`tier1_cas`. `CAS_MAX_BASE` threshold row REMOVED from `thresholds.ts` (intentional string-lookup break); `max-base` stays in `ThresholdType` because CASS legitimately has one. `salaryStatus` must NOT suppress CAS.

**Phase 4 CASS shape:** alin. (6) = „respectiv o diferență de contribuție … până la nivelul celei corespunzătoare bazei de calcul egale cu 6 salarii minime brute pe țară". Breakdown must contain `CF art. 174 alin. (6)`, `NU art. 170 alin. (2)-(3)`, `art. 155 alin. (1) lit. c)-h)`. `min_base` label: „Top-up floor (6 SM annual) — CF art. 174 alin. (6); conditional, not an unconditional minimum". alin. (2): pierdere fiscală or VNA = 0 ⇒ **no CASS at all** (breakdown notes art. 180 alin. (1) optare exists, not modelled). alin. (7) lit. a) salary ≥ 6 SM ⇒ top-up not owed → implemented as `reviewRequired` when `salaryStatus === 'da'` && VNA < 6 SM (profile carries no salary amount); lit. b) not modelled (has `otherIncome` flag, not CASS paid on it); lit. c) pension „venituri din pensii, definite conform art. 99" ⇒ removes **only** the top-up, 10% × VNA still stands. Pension checked BEFORE salary. Derived/removed: `min_cass` (2,430) = rate × min_base; `max_cass` (29,160) = rate × max_annual_base (never read). Ids kept for string lookups: `min_base` (24,300 → `CASS_MIN_BASE`), `max_annual_base` (291,600 → `CASS_MAX_BASE`). No threshold spec ever read `min_cass`/`max_cass`.

**Handoffs recorded:** → P5: 30% cap phantom = deletion; 16% N/A; real gate art. 68 alin. (4). → P6: `socialInsuranceStatus === 'obligatoriu'` gate unchanged, Phase 6 owns the profile. → P7: CAS alin. (4) election wired to no persisted field; when implemented it must be its own field, never an override of realized income. → P8: fiscal base is net of VAT; 395,000 test against a turnover basis, not VAT-inclusive `ytd.revenue`. → P9: art. 68 alin. (2) lit. a) measures venit brut by „sumele încasate" (cash-receipt basis) + U-3, U-4. → any CAEN-aware rule: do not re-import the phantom cap as a deductibility floor.

**Architecture invariants:** `package2026.ts` = exactly **8 rules, version: 1** (asserted `fiscal.test.ts:9`, `:39`). `tax.ts:45-47` resolves rules by `applicable.find((r) => r.taxRegime === …)` over a `ruleId`-sorted list ⇒ a second ACTIVE rule sharing a `taxRegime` silently changes results. `thresholds.ts` reads parameter values by string id.

### B2. engine-map (COMPLETE)

**`src/domain/tax.ts` (1-127).** Exports: `TaxCalculationInput` (14-25), `TaxEstimateResult` (27-29), `computeTaxEstimate` (35-127, **async**). Local `rr` (31-33).
```ts
export interface TaxCalculationInput { inputs: TaxInputsReference; profile: PfaProfile; revenues: number; expenses: number; revenuesNet: number; expensesNet: number; ruleRelease: RuleRelease; rules: FiscalRule[] }
export type TaxEstimateResult = { status:'computed'; lines: CalculationLine[]; output: CalculationOutput; snapshot: TaxCalculationSnapshot } | { status:'review_required'; reason: string; lines: CalculationLine[] };
function rr(reason, lines = []): TaxEstimateResult
```
Flow: 37-40 four numeric guards (`!Number.isFinite(x)||x<0` → `rr(msg)`, lines omitted); 41 `if (!profile?.id) return rr('Profilul lipsește sau nu are id')`; 42 `lines=[]`; 43 `asOf = \`${inputs.fiscalYear}-01-01\``; 44 `applicable = selectApplicableRules(rules,{taxYear:inputs.fiscalYear, asOfDate:asOf})`.
**Gate 45-54:**
```ts
const casRule = applicable.find((r) => r.taxRegime === 'cas');
const cassRule = applicable.find((r) => r.taxRegime === 'cass');
const incomeTaxRule = applicable.find((r) => r.taxRegime === 'income-tax');
if (!casRule) return rr(`Regula CAS nu a fost găsită pentru anul fiscal ${inputs.fiscalYear}`, lines);
if (!cassRule) return rr(`Regula CASS nu a fost găsită ...`, lines);
if (!incomeTaxRule) return rr(`Regula de impozit pe venit nu a fost găsită ...`, lines);
if (inputs.regime === 'impozit_pe_venit') { return rr('Plafonul cheltuielilor deductibile pentru impozit pe venit (30% din brut) nu este în stocul de reguli.', lines); }
```
58-65: `gross = inputs.vatExempt ? revenues : revenuesNet`; `deductibleBase = inputs.vatExempt ? expenses : expensesNet`; line `'Venit brut'`; `deductible = Math.min(deductibleBase, gross)` → `'Cheltuieli deductibile'`; `net = gross - deductible` → `'Venit net din activitate'`.
75-80 CAS: `calculatorRegistry['calc-cas'](casRule, { base: net, pensionStatus: inputs.pensionStatus })`; `if ('reviewRequired' in casRes) return rr(casRes.reason, lines)`; line `'CAS (25%)'`.
96-107 CASS: only if `inputs.socialInsuranceStatus === 'obligatoriu'` → `calculatorRegistry['calc-cass'](cassRule,{base:net,pensionStatus,salaryStatus})`, line `'CASS (10%)'`; else line `CASS (${inputs.socialInsuranceStatus})` value 0.
109-110: `const taxable = net - casRes.value - cassValue;` line `'Venit impozabil (net - CAS - CASS)'`.
**Loss branch 112-118:** `if (taxable <= 0) { const total = casRes.value + cassValue; lines.push({label:'Impozit pe venit (fără bază impozabilă)', value:0}); lines.push({label:'Total taxe', value:total}); const snap = await createCalculationSnapshot({profile, revenues: gross, expenses: deductibleBase, ruleRelease, calculationLines: lines, output:{total}}); return {status:'computed', lines, output:{total}, snapshot: snap}; }`
120-126 happy path: `calculatorRegistry['calc-income-tax'](incomeTaxRule,{base:taxable})` → line `'Impozit pe venit (rată de bază 10%)'`, `'Total taxe'`, snapshot, `status:'computed'`.
Types: `CalculationLine {label:string; value:number}` `snapshots/types.ts:29-32`; `CalculationOutput {total:number}` `:35-37`; `TaxCalculationSnapshot` `:40+`; separate `SnapshotStatus='computed'|'superseded'|'void'` `:17`.

**`src/domain/fiscal/calculators.ts` (1-287).**
```ts
export type ReviewRequired = { reviewRequired: true; reason: string };                       // :3
export type CalculatorResult = { value:number; breakdown:string[] } | ReviewRequired;        // :5-7
export type CalculatorInput = { base?:number; pensionStatus?:'da'|'nu'; salaryStatus?:'da'|'nu'; chosenBase?:number }; // :9-50
export type CalculatorFunction = (rule: FiscalRule, input?: CalculatorInput) => CalculatorResult;
// :56-66 paramValue = rule.parameters.find(p=>p.id===id)?.value ; paramNumber THROWS `Missing numeric parameter '${id}' for rule ${rule.ruleId}`
```
- `calcWageReference` (68-78): `paramValue(rule,'reference') ?? paramValue(rule,'monthly')`.
- `calcCas` (86-141): ids `rate`,`min_base`(12 SM),`tier2_base`(24 SM),`tier1_cas`,`tier2_cas`. `pensionStatus==='da'`→0; `realized<tier1Base`→0; else `floor = inTier2?tier2Base:tier1Base`, `base = chosen===undefined?floor:Math.max(chosen,floor)`, `cas = base*rate`.
- `calcCass` (161-233): ids `rate`,`min_base`(6 SM top-up floor),`max_annual_base`(72 SM). `floorCass=floorBase*rate`, `ceilingCass=maxBase*rate` (derived). `vna<=0`→0; `vna<floorBase` + `pensionStatus==='da'`→`vna*rate`; + `salaryStatus==='da'`→`reviewRequired`; else→`floorCass`. Else `base=Math.min(vna,maxBase)`, `cass=base*rate`.
- **exact alin.(6) breakdown strings:** `:213` `CASS = ${floorBase} x ${rate} = ${floorCass} lei — o diferenta de contributie pana la baza de 6 SM, nu inlocuirea bazei`; `:214` `CF art. 118 alin. (2) lit. b): diferenta de la art. 174 alin. (6) NU se scade din baza impozabila (reparație de coerență, nu de calcul)`; `:191` `VNA sub pragul de 6 SM (${floorBase} lei): art. 174 alin. (6) ar cere o diferenta de contributie pana la ${floorCass} lei`; `:205` reviewRequired reason names art. 174 alin. (7) lit. a) + "Profilul nu contine cuantumul salarial".
- **`calcIncomeTax` (235-250): reads ONLY `base_rate`.** `base` not a number → `reviewRequired: 'No base provided for income tax calculation'`. Returns `{value: tax, breakdown: ['base: …', `income tax = ${base} x ${baseRate} = ${tax} lei (10% base rate)`, 'NOTE: 16% progressive surcharge threshold (6x national avg gross salary) is not a fixed number — REVIEW_REQUIRED for the surcharge portion']}`. **breakdown is never surfaced by tax.ts — only `.value`.**
- `calcVatThreshold` (252-255) `threshold`; `calcDeadline` (257-266) `paramValue(rule,'deadline')`, value 0. `computeFiscal(release, ruleId, input)` (268-278) unused by tax.ts. `calculatorRegistry` (280-287) keys: `calc-wage-reference|calc-cas|calc-cass|calc-income-tax|calc-vat-threshold|calc-deadline`.

**`src/domain/fiscal/package2026.ts` (1-231).** `PROVENANCE_2026` (4-11): `jurisdiction:'RO'`, `entityType:'PFA'`, `taxYear:2026`, `verifiedAt:'2026-10-05'`, `status:'ACTIVE' as const`, `version:1`.
`INCOME_TAX_2026` verbatim (159-185):
```ts
{ ...PROVENANCE_2026, ruleId:'INCOME_TAX_2026', name:'Income tax 2026 (10%)', taxRegime:'income-tax',
  effectiveFrom:'2026-01-01', effectiveTo:null,
  parameters:[ { id:'base_rate', label:'Base rate', value:10, unit:'percent' },
    // REMOVED in Phase 2: `progressive_rate: 16` was legally unfounded for this entity type. … ],
  calculatorId:'calc-income-tax',
  // CF art. 123 alin. (1) … GAP U-1 (UNVERIFIED — must stay REVIEW_REQUIRED, never a computed rule) …
  sourceAct:'Cod fiscal (consolidat)',
  sourceArticle:'art. 123 alin. (1) + art. 118; 16% inapplicable per art. 114 alin. (1), art. 115 alin. (1) lit. b)',
  sourceUrl:'https://legislatie.just.ro/Public/DetaliiDocument/312601' }
```
`wage-reference` rule verbatim (24-42): `ruleId:'PFA_2026_TAX_REFERENCE'`, `name:'PFA 2026 tax reference (4050 lei)'`, params `reference` 4050 lei, `multiple_6x` 24300, `multiple_12x` 48600, `multiple_24x` 97200, `multiple_72x` 291600; `calculatorId:'calc-wage-reference'`, `sourceAct:'HG 1506/2024'`, `sourceArticle:'art. 1'`, `sourceUrl:'https://www.legalteka.ro/act/1506/2024'`. Also `GENERAL_MINIMUM_WAGE_2026_H1` (43-57, `monthly:4050`, effectiveTo `'2026-06-30'`) and `_H2` (58-72, `monthly:4325`, effectiveFrom `'2026-07-01'`) — both `taxRegime:'wage-reference'`.
`rules.ts`: `FiscalRegime = 'cass'|'cas'|'income-tax'|'vat'|'deadlines'|'wage-reference'` (:1); `FiscalParameter {id,label,value:number|string,unit:'lei'|'percent'|'date'|'count',description?}` (:11-17); `FiscalRule` 17 fields (:19-36); `RuleRelease` (:38-51).
⚠ engine-map says "7 rules"; phase-docs says 8 and `fiscal.test.ts:9,39` asserts the count. **Verify with grep before relying on either.**

**Parameter-id reads (src/):** `multiple_6x/12x/24x/72x` → ONLY `package2026.ts:33,34,35,36`, no reader anywhere. `reference` → `package2026.ts:32`, read `calculators.ts:69`, error text `:73`. `min_base` → `package2026.ts:82`(CAS),`:117`(CASS); read `calculators.ts:88`,`:163`; `thresholds.ts:75` (`CAS_MIN_BASE`), `thresholds.ts:93` (`CASS_MIN_BASE`). `max_annual_base` → `package2026.ts:118`; read `calculators.ts:164`; `thresholds.ts:102` (`CASS_MAX_BASE`). Tests mutating ids by string: `tax.test.ts:222`, `fiscal.test.ts:256`; assertions `fiscal.test.ts:267-268`.

**Call sites of `computeTaxEstimate`:** `data/derived.ts:66` in `useLatestTaxEstimate` (47-90), `.then(setEstimate)`, **no `.catch`**. `data/dashboard.ts:85` in `getTaxEstimate(data, asOfDate)` (82-95) passing `selectTaxDerived(data, PFA_2026_SYSTEM_REAL_PACKAGE).inputs` + `PFA_2026_RELEASE`. Status consumers: `data/dashboardAdapter.tsx:13-16` `LOADING_TAX={status:'review_required',reason:'loading',lines:[]}` → `buildDashboardData(data, estimate ?? LOADING_TAX)`; `dashboard.ts:252`→`taxReserve.ts:126-127` (`status==='computed' ? output.total : null`); `dashboard.ts:253`→`insights.ts:237-252` (review_required → info insight "Datele nu permit o estimare completă a impozitului."); `components/FinancialChart.tsx:235-241` renders `tax.reason` **verbatim in UI**; `pages/Dashboard.tsx:48` `taxTotal = tax.status==='computed' ? tax.output.total : null`.

**`models.ts:14`** `export type PfaRegime = 'impozit_pe_cit' | 'impozit_pe_venit';` (used `models.ts:71`). **`profile.ts:38`** `regime: 'impozit_pe_venit'` (in `createDefaultProfile`, 31-49) → default profile always hits the gate.

**Pipeline:** profile → `domain/derived.ts:selectTaxDerived` (129-150) builds `TaxInputsReference` (89-100: regime, salaryStatus, pensionStatus, otherIncome, socialInsuranceStatus, vatExempt, cashFloorLei, fiscalYear, inputsKey) → `computeTaxEstimate` → `selectApplicableRules` (`select.ts`, taxYear + status==='ACTIVE' + effectiveFrom<=asOf<=effectiveTo, then `.sort()` by ruleId) → `find()` by taxRegime → `calculatorRegistry[...]` → lines + `output.total` → `createCalculationSnapshot` (async, `crypto.randomUUID()`) → dashboard/reserve/insights/UI.

**Invariants a regime-gate change can silently break**
1. `find()` by `taxRegime` over sorted filtered list (`tax.ts:44-47` + `select.ts:14`): `wage-reference` has 3 rules; a second ACTIVE `cas`/`cass`/`income-tax` rule silently picks alphabetically-first ruleId. No duplicate detection.
2. `paramNumber` **throws and nothing catches it** (tax.ts has no try/catch; `data/derived.ts:66` has no `.catch`). Renaming/removing `base_rate`,`min_base`,`tier2_base`,`tier1_cas`,`tier2_cas`,`max_annual_base`,`rate` → unhandled rejection, `estimate` stays null → `LOADING_TAX` forever.
3. String-id coupling across 3 modules: `thresholds.ts:75/93/102` + tests `tax.test.ts:222`, `fiscal.test.ts:256`.
4. `'computed'` overloaded (`TaxEstimateResult.status` vs `SnapshotStatus` `snapshots/types.ts:17`); `completeness.ts:185` filters snapshots by it. Snapshot created in BOTH computed paths (112-118, 120-126) — any new computed path must create a snapshot or completeness degrades silently.
5. `review_required` is the app's universal error channel (reserve→null, insights→info, UI prints `tax.reason` verbatim at `FinancialChart.tsx:240`). New gate reasons leak raw Romanian text to users; `LOADING_TAX` fakes `reason:'loading'` through the same shape.
6. Default profile regime short-circuits at `:52`; most engine tests pass an explicit regime, so the default path is untested.
7. `calcIncomeTax` breakdown (incl. stale 16% NOTE) is discarded by tax.ts — only `.value` flows. Do not rely on breakdown for surcharge signalling.

**Start Here (scout):** `tax.ts:44-54`, then `calculators.ts:235-250`, then `package2026.ts:159-185`.
### B3. test-map (COMPLETE)

Files: `src/domain/tax.test.ts` (1-407, 39 `it()` cases) · `tax.ts` gate **L53-55**, taxable L109-110, income-tax line L120-122 · `fiscal/fiscal.test.ts` (rule count 8, selected 7) · `fiscal/rules.test.ts` (synthetic only) · `thresholds.test.ts` (4 thresholds: 48600/24300/291600/395000) · `pages/Dashboard.test.tsx:96-148` (pins computed `46.570` for a `impozit_pe_cit` profile) · `e2e/dashboard.spec.ts` (L57-124,135-143,196-222,224-236,245-263,525-615) · `package2026.ts:33-36` multiple_*, stale 16% NOTE at `calculators.ts:247` · `data/seed.ts:8` **seed regime = `impozit_pe_venit`**.

Fixtures `tax.test.ts:8-14` verbatim:
```ts
function makeProfile(overrides: Partial<PfaProfile> = {}): PfaProfile {
  return { id: 'p1', regime: 'impozit_pe_cit', fiscalYear: 2026, socialInsuranceStatus: 'obligatoriu', ...overrides } as PfaProfile;
}
function makeInputs(overrides: Partial<TaxInputsReference> = {}): TaxInputsReference {
  return { regime: 'impozit_pe_cit', salaryStatus: 'da', pensionStatus: 'nu', otherIncome: [], socialInsuranceStatus: 'obligatoriu', vatExempt: false, cashFloorLei: 0, fiscalYear: 2026, inputsKey: 'p1:2026:impozit_pe_cit:obligatoriu', ...overrides };
}
```
**38 cases use `impozit_pe_cit`, 1 uses `impozit_pe_venit` (L47).** `profile.regime` is never read by the engine — only `inputs.regime`.

Case inventory (L, regime, rev/exp, assertions): 1 L17 cit 50000/10000 total 7600, lines>=5, snapshot · 2 L27 cit+exempt total 4000 · 3 L35 10000/10000 CASS 0 total 0 · **4 L47 venit → review_required** · 5 L52 -1/10000 rr · 6 L57 50000/-1 rr · 7 L62 id:'' rr · 8 L67 rules:[] rr · 9 L72 snapshot provenance (profile.id p1, releaseId PFA_2026_SYSTEM_REAL, inputsHash len 64, revenues 50000, expenses 10000, total 7600) · 10 L86 0/0 CASS 0 total 0 · 11 L94 60000/10000 total 20435 · 12 L102 250000/0 total 69370 · 13 L110 300000/0 total 78114 · 14 L118 123456/78900 deterministic + lines toEqual · 15 L128 71280/0 total closeTo 24478.2 · 16 L136 100000/10000 toBeDefined only · 17 L141 0/0 · 18 L152 10000/20000 CASS 0 total 0 · 19 L163 72000/0 total 24615 · 20 L173 24300/0 CASS 2430 · 21 L182 24299/0 review_required · 22 L190 24299 salary da → reason contains 'art. 174 alin. (7) lit. a)' · 23 L197 24299 nu/nu CASS 2430 (total NOT asserted) · 24 L204 pension da 10000/0 CAS 0 CASS 1000 total 1900 · 25 L215 150000/0 CASS 15000 vs 10000 (mutates `max_annual_base`) · 26 L241 48600/0 CAS 12150 · 27 L250 48599 CAS 0 · 28 L260 48601 CAS 12150 · 29 L271 pension da 200000/0 CAS 0 total 38000 · 30 L281 salary da 60000/0 CAS 12150 · 31 L291 97200/0 CAS 24300 · 32 L300 97201 CAS 24300 · 33 L312 291600/0 CASS 29160 · 34 L321 291601 CASS 29160 · 35 L332 71281/0 CAS 12150 CASS 7128.1 income-tax line 5200.29 total 24478.39 · 36 L352 mutated `tier2_base` 120000, 100001/0 CAS 24300 vs 12150 · 37 L383 fiscalYear 2025 → rr · 38 L390 VAT excluded 55000/11000 net 50000/10000 'Venit brut' 50000 · 39 L399 vatExempt 'Venit brut' 55000.
Line labels the suite depends on: `'Venit brut'`, `'CAS (25%)'`, `'CASS (10%)'`, `'Impozit pe venit (rată de bază 10%)'`.

Other tests: `fiscal.test.ts:9` `toHaveLength(8)` rule count; `:58,:69` selected `toHaveLength(7)`; `:78` 0; `:12-41` field list + `parameters.length > 0` (survives deleting multiple_* since `reference` remains); **`:265-271` is the ONLY parameter-id-set assertion** (CASS_2026 must contain `min_base`,`max_annual_base`, must NOT contain `min_cass`/`max_cass`) — no test asserts `PFA_2026_TAX_REFERENCE`'s id set. Income-tax calculator cases `:319` 48600→4860, `:326` 60000→6000, `:332` no base → reviewRequired. Breakdown-string assertions (fragile): `:179-180` ('97200','nu prevede nicio plafonare superioara'), `:192-195` ('art. 174 alin. (2)','art. 180 alin. (1)','NEMODELATA'), `:223-227` ('CF art. 174 alin. (6)','NU art. 170 alin. (2)-(3)','diferenta de contributie','art. 155 alin. (1) lit. c)-h)'), `:245-247` ('CF art. 170 alin. (1)','derivata din 291600 x 0.1'), `:278-281` ('art. 174 alin. (7) lit. c)','elimina DOAR diferenta','art. 150 alin. (1)'), `:298` reason contains 'art. 174 alin. (7) lit. a)'. `thresholds.test.ts:29` 4 rows, values 48600/24300/291600/395000, `:46-49` no CAS_MAX_BASE, `:167-170` warningDistance 10%. `derived.test.ts:271-278` selectTaxDerived structural (`inputs.regime` 'impozit_pe_venit'), `:300` ruleCount-1. `pages/Dashboard.test.tsx:103` `/—/` (seed venit), `:147` `/46\.570/` with `regime:'impozit_pe_cit'` (L112). `taxReserve.test.ts`/`TaxReserve.test.tsx`/`insights.test.ts` use synthetic totals — safe. No `__snapshots__` anywhere.

**e2e assertions tied to engine output** (all currently assume seed `impozit_pe_venit` → review_required): L71 `impozit .value` '—'; L72 `.hint` 'de pus deoparte'; L77/L81 'Rezervă lunară'/'Rămâne de pus deoparte' '0,00 RON'; L86 'Date complete' '8/9'; L118 `.tax-hero-value` '—'; L141 'Nu există o estimare fiscală disponibilă — rezerva recomandată nu poate fi calculată.'; L200/202 '8 din 9 verificări îndeplinite', `.check-row` 9; L218-221 'Estimare impozit','nu există instantanee de taxe',Complet×8,Lipsă×1; L228/230/235 '8 item de rezolvat', `.action-label` 6 deadlines, 'Revizuire estimări fiscale'; L256-257/260-262 'Lipsă: Estimare impozit.','Estimarea impozitului necesită verificare',Urgent×7/Atenție×3/Info×1. CIT-seed block: L596/604/612 `/46\.570/` (hero, section, cell) from `citDataset()` L533-570 (regime `impozit_pe_cit`, revenues 50k+80k, no expenses). Threshold/deadline e2e L149-193 read rule params, not the engine.

Scripts: `dev: vite`, `build: tsc && vite build`, `preview`, `typecheck: tsc --noEmit`, `test: vitest run`, `test:watch`, `test:e2e: playwright test`. `vitest.config.ts`: globals true, jsdom, setupFiles `./src/test/setup.ts`, css false, `include: ['src/**/*.test.{ts,tsx}']`. `playwright.config.ts`: testDir './e2e', fullyParallel, baseURL :5173, webServer `npm run dev`.

**Predicted failures:** (A) inversion → 30/39 tax.test cases fail `status==='computed'` (#1-3,9-15,17-20,23-36,38-39; #16 survives); L47 fails; L190 reason assertion fails; #5,6,7,8,21,37 stay green for the wrong reason. Fix = flip fixture defaults at `:9` and `:13` (+ inputsKey) to `impozit_pe_venit`, flip L47 to `impozit_pe_cit`. (B) top-up change: no unit test asserts a total in the top-up branch (#23 asserts only the CASS line) → silent gap, must add. `fiscal.test.ts:223-227` locks breakdown wording at `calculators.ts:216`. (C) prorate/cap breaks exact totals at `:22,:83,:100,:108,:116,:134,:170,:212,:279,:349` + Dashboard `:147` + e2e 596/604/612 IF totals shift. (D) loss surfacing breaks `:152` (total 0 computed); `lines.length>=5` (L23) and lines toEqual (L126) are tolerant. (E) deleting multiple_* is safe (only guard: `fiscal.test.ts:40` needs ≥1 param). (F) deleting the 16% NOTE string is safe (no assertion). (G) e2e: seed is `impozit_pe_venit`, so inversion flips the whole seed dashboard to computed → all L71-L262 rows fail, and the CIT-seed block flips to '—' and fails.

---

## C. MY DECISIONS / PLAN (update as I go)

Order of work (per brief): **B-14 first** → B-13 → B-15 → B-16 → 5.5 NOTE string → 5.6 `multiple_*` → 5.7 provenance → phase doc + STATE.md.

Planned shape of the income-tax computation (art. 118 alin. (2) order):
1. `vnaRecalculat = venitNetAnual − pierderiReportate` (per source; today single source)
2. sum sources
3. `casDeductibila = ratioCas × casValue`, `ratioCas = vnaSistemReal / totalCumulatArt148(3)` (=1 single-source)
   `cassDeductibila = ratioCass × cassDeductibilaBase`, `ratioCass = vnaSistemReal / totalCumulatArt170(1)` (=1 single-source)
   where `cassDeductibilaBase = cassValue − cassTopup174_6` (B-13)
4. cap: `min(casDed + cassDed, vnaRecalculat)` (alin. (2^4))
5. `impozit = 10% × max(0, vnaRecalculat − casDed − cassDed)`

Constraints to respect: do not change `PfaRegime` union or profile model; do not add ACTIVE rules (8-rule invariant); do not rename `min_base`/`max_annual_base`; keep CAS/CASS amounts untouched; keep `calcCass` `reviewRequired` for `salaryStatus === 'da'`.

## SUPERSEDED — old C2/D/E (kept for history)

## C2. KEY DECISIONS TAKEN

D1. **Fixture flip**: flip `tax.test.ts:9` and `:13` defaults (+ `inputsKey`) to `impozit_pe_venit`; flip the L47 case to `impozit_pe_cit` asserting the data-integrity reason.
D2. **B-13 mechanism**: `calcCass` gains an explicit non-deductible component. `CalculatorResult` success branch gets `topupDifference174_6?: number` (0 unless the alin. (6) branch fired). `tax.ts` deducts `cassValue - topupDifference`. In the top-up band deductible CASS = `vna * rate`; difference = `floorCass - vna*rate`.
D3. **B-15 mechanism** (in `tax.ts`, not the calculators — CAS/CASS amounts are Phase 3/4 property): compute `ratioCas = vnaSistemReal / totalCumulatCas` and `ratioCass = vnaSistemReal / totalCumulatCass` (both = 1 today, single source), `casDed = ratioCas*casValue`, `cassDed = ratioCass*(cassValue - topupDiff)`, then alin. (2^4) cap `deductii = min(casDed+cassDed, max(0, vnaRecalculat))`, `taxable = vnaRecalculat - deductii`. Numerically identical to today for single source → existing totals must not move. Add explicit calculation lines for the ratios and the capped deduction.
D4. **B-16**: keep `status: 'computed'` with total 0 in a loss year, but add lines naming the loss amount and the art. 118 alin. (4)-(5) 5-ani/70%/aceeași-sursă rule, plus an optional `lossCarryForward` field on the computed result. NO persistence.
D5. **e2e**: seed regime stays `impozit_pe_venit` (a `impozit_pe_cit` seed would encode a legally impossible regime). Update e2e expectations to the computed reality — but FIRST check whether the seed profile still yields review_required via the `salaryStatus==='da'` + VNA<6 SM CASS gate. Must measure, not guess.
D6. `multiple_6x/12x/24x/72x` → **delete** (not derive): nothing reads them, and `reference` × n is derivable at the point of use. Keep `reference`.
D7. `INCOME_TAX_2026.sourceArticle` → art. 123 alin. (1) + art. 118 alin. (2) lit. b) + alin. (2^2)-(2^4); regime gate cites art. 13 alin. (1)/art. 14/art. 15 + art. 120 Abrogat. `verifiedAt` → 2026-10-06 (override after the PROVENANCE spread).

## D. VALIDATION LOG
(empty — nothing run yet)

## E. OPEN QUESTIONS / POSSIBLE BLOCKERS
(none yet)

## C2. KEY DECISIONS TAKEN (final)
- Regime gate inverted in `tax.ts:78-80`: compute for `impozit_pe_venit`; `impozit_pe_cit` ->
  REVIEW_REQUIRED as a DATA-INTEGRITY failure (art. 13 alin. (1), art. 14, art. 15, art. 120 Abrogat
  by OUG 128/2024 pct. 11 Art. I). Fixtures `makeProfile`/`makeInputs` default to impozit_pe_venit.
- B-13: consume `calcCass`'s existing `nonDeductible` field -> `cassDeductibila = ratioCass *
  (cassValue - cassNonDeductibila)`. Did NOT add a new helper (an earlier draft idea,
  `computeCassBaseContribution`, does not exist and was not needed).
- B-15: explicit `ratioCas`/`ratioCass` (both 1 today) + alin. (2^4) cap with a
  'Deduceri blocate de plafonul art. 118 alin. (2^4)' line. Cap proven by patching CAS rate to 100
  (net 50,000 -> 53,600 deductions, 3,600 blocked, taxable 0, totalDue still 53,600).
- B-16: removed the `Math.min(deductibleBase, gross)` clamp so a loss is representable; loss surfaced
  as a line + `lossCarryForward {amount, years:5, capPercent:70, sameSourceOnly:true, rule}`.
  Zero net is NOT a loss. Persistence deferred to Phase 7 (NOT "Declarations & payments" - that phase
  does not exist in the plan).
- B-4 leftover: 16% NOTE string removed from calcIncomeTax breakdown.
- B-6 leftover: multiple_6x/12x/24x/72x deleted from the wage-reference rule (no reader in src/ or e2e/).
- Code comments that mislabelled these two cleanups as "defect B-12" corrected to B-4 / B-6
  (B-12 in the register = persisted-schema version, Phase 7).
- `fiscalPackageVersion` stays '2026'; `verifiedAt: '2026-10-06'`; sourceUrl = doc 312601.

## D. VALIDATION LOG (final, 2026-10-06)
- `npx tsc --noEmit` -> exit 0, no errors
- `npm run build` -> exit 0
- `npm run test` -> 36 files, **489 passed** (baseline 482; +7 new income-tax tests)
- `npx playwright test` -> **24 passed** (baseline 23; +1 impozit_pe_cit data-integrity case)
- Probe files removed: e2e/__probe.spec.ts, src/domain/__probe.test.ts, test-results/
- git status: M docs/ai/PLAN.md, docs/ai/STATE.md, e2e/dashboard.spec.ts,
  src/domain/fiscal/calculators.ts, src/domain/fiscal/package2026.ts, src/domain/tax.test.ts,
  src/domain/tax.ts, src/pages/Dashboard.test.tsx; ?? docs/ai/phases/05_income_tax.md

## E. FACT-CHECK PASS (post-compaction) - errors found in my own draft doc and fixed
The first draft of phases/05_income_tax.md was written from memory after compaction and DRIFTED.
Wrong in it (all corrected in the rewrite, verified against research/08 Q118-A/B/C + the real code):
- quoted art. 118 alin. (4) with "7 ani" = the STALE doc-200491 text (correct: 70% / aceeasi sursa /
  5 ani fiscali consecutivi, OUG 115/2023 pct. 70 Art. LIII)
- claimed alin. (3) is a "not less than zero" clamp (alin. (3) = fracțiuni de an; the floor is alin. (2^4))
- invented `IncomeTaxInput.fiscalLossCarriedForward`, a FiscalLossRecord gate on remainingYears/year,
  and `computeCassBaseContribution` - none of these exist in the code
- described the wrong multiple_* parameters (multiple_cas_rules etc.) and a non-existent
  MultipleRulesMatchError in a non-existent engine.ts
- described B-1 as an art. 120 alin. (2) expense cap (art. 120 is ABROGAT; B-1 = the regime short-circuit)
- wrong calculation-line keys/labels and wrong verifiedAt ('2026-08-08' -> actual '2026-10-06')
Also fixed: stale comment in tax.test.ts:174 claiming the deductible clamp still exists.

## F. FOLLOW-UP (orchestrator, post-acceptance) — seed arithmetic + B-17
My earlier doubt was inverted: the aggregation is innocent. Seed FY2026 'inregistrata': revenues
4.500 + 3.200 = 7.700; expenses 120 + 85,50 = 205,50 -> VNA 7.494,50 exact. CASS ded 749,45;
taxable 6.745,05; tax 674,505 (HALF-CENT); total 3.104,505 -> displayed 3.104,51. Before B-13:
2.936,45 (not 2.936,46).
Fixed the wrong figures in e2e/dashboard.spec.ts:70-75 and phases/05_income_tax.md §4 (comments only,
no assertion touched). Verified no other occurrence remains.
Measured in node (the real finding, stronger than a slip):
  0.10*6745.05 = 674.5050000000001  -> Intl 674,51 / toFixed(2) 674.51
  0.09*7494.5  = 674.505            -> Intl 674,51 / toFixed(2) 674.50
  6745.05/10   = 674.505            -> Intl 674,51 / toFixed(2) 674.50
So identical algebra, different doubles, and the two formatters disagree. Only rounding in the app is
src/lib/format.ts:6-9 (Intl.NumberFormat ro-RO 2,2). Registered as defect B-17 in STATE.md ->
Phase 10 (representation + rounding policy WITH its legal basis; the half-cent tie-break is a legal
question, unresearched), Phase 8 (which amount is rounded where). Did NOT fix it.
Also added B-17 to STATE.md Phase 8 and Phase 10 prerequisite cells, and to phase doc §4/§5/§9.
Re-validated: tsc 0, 489 unit, 24 e2e.
