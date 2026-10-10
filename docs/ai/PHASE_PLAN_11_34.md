# Phase plan — Phases 11–34, restructured after the independent audit

**This file is the authoritative forward plan.** It supersedes the phase list in `docs/ai/pre_phase11_execution_plan.md` (that round is finished) and merges the user's *SOLO Orchestrator Prompt Set — Updated Phases 11–34* with the findings of the independent audit of 2026-10-10.

## 0. How to use this file after a compaction

1. Read §1 for the baseline you must not regress.
2. Read §2 for what is **already good and must not be rewritten**.
3. Read §3 before repeating any audit claim — it says which claims were **verified in-repo** and which were not.
4. Read §5 for the order, §6 for what each phase actually has to do.
5. Read §9 before writing a brief — several phases are **blocked on a user decision**, and guessing them is how the last round produced rework.
6. Defect ids **B-36 … B-47** are defined in §4 and each phase names the ones it closes. `docs/ai/STATE.md` holds B-1 … B-35.
7. User decisions are logged in `docs/ai/USER_DECISIONS.md`; phase status in `docs/ai/phases/NN_*.md`; phase-vs-landed status of the user's original 11–34 list in `docs/ai/roadmap_11_34_mapping.md`.

---

## 1. Baseline — do not regress it

At `02c6ecf` (pushed to `origin/master`): `tsc` 0 · **77 files / 1332 unit tests** · `build` 0 · **e2e 37** · copy-guard allow-list **empty** · data version **10** (`record-currency`).

Money figures pinned green: deductible **120,00 / 144,00 lei**, VNA **9.096,00**, impozit **819,00**, clock total **3.249,00**, reserve **1.083,00**, year-end **3.112,00**, hero **51.510 lei**. Euro cap ceiling **531,00 lei provisional → 540,00 lei final**.

No snapshot digest may move: `inputSnapshot` is `{ profile, revenues: Bani, expenses: Bani }` — aggregate lei totals, not record arrays.

---

## 2. Preserve unchanged — do not rewrite these in any phase

| Area | Why it survives |
|---|---|
| Fiscal rule registry + content digest (`ruleSetDigest.ts`, `registry.ts`) | Lifecycle ladder enforced, reused `releaseId` refused, ACTIVE sets deep-frozen, R1/R2 fixture reproduces **7.600,00** while a new calculation gives **7.960,00** |
| `Bani` integer minor units + `Money<C>` | Consistent arithmetic; mixing currencies is a `tsc` error |
| `unknown` / `REVIEW_REQUIRED` / unavailable states | Honest uncertainty; never replace with a value |
| Expense-deductibility ruleset (48 rules on CF art. 68) | Extend with facts; do not replace |
| Shared attention model (`AttentionItem`, one producer, `partitionAttention`) | Do not rebuild a second alert engine |
| Copy layer `src/ui/copy/` + guard with empty allow-list | New sentences go there, never inline |
| `RuleProvenance` / `Disclosure` / `InterpretationNote` | Never repair a drifted digest by re-hashing |
| FX explicit-basis + interpretation policy | Keep both readings; complete the entry path instead |

---

## 3. Audit claim ledger — what I checked, and what I did not

The audit is external and its verification limits are stated in it (it could not run the suite). I re-checked its load-bearing claims against the tree.

**Verified in-repo (file:line is mine, not the auditor's):**

| Claim | Evidence |
|---|---|
| Projection denominator is **fiscal-year elapsed**, not PFA active period | `src/domain/projection.ts:91` `elapsedMonths(fiscalYear, asOfDate)`; doc comment `:14-15`. No PFA start input. **Confirmed** |
| `paid` / `collected` exist in the model but **no entry form writes them** | `src/data/types.ts:27` `collected?`, `:62` `paid?`; grep for `paid` in `pages/Expenses.tsx` and `collected` in `pages/Revenues.tsx` → **no hits** |
| FX rates have **no UI ingress at all** | grep `recordFxRate` / `loadDailyRates` / `manualAnnualAverage` across `src/pages` + `src/components` → **no callers**. 10b built the store door with no handle |
| Financial aggregation **skips** non-lei records while the tax pipeline normalises them | `src/domain/aggregation.ts:127-139` — lei total or `null`, callers skip `null` |
| No per-expense vehicle/documentation facts on the persisted record | grep `vehicleUse` / `usage` / `documentatie` in `src/data/types.ts` → **no hits** |
| Activity family is **not** an input to the estimate path | grep `ActivityFamily` / `activityFamily` in `estimateBasis.ts`, `data/derived.ts`, `data/dashboard.ts` → **no hits**, while the refusal exists: `fiscal/deductibility2026.ts:621` `treatment: 'no_expense_engine'`, handled at `fiscal/deductibility.ts:350` |
| Seed is a **2020** PFA with a 2025 D212, against the Phase 11 spec of a 2026-start PFA | `src/data/seed.ts:7` `pfaStartYear: 2020`, with the coherence reasoning at `:31-34` |
| e2e has date-dependent assertions valid only before 25 May 2027 | `e2e/dashboard.spec.ts:318` `25.05.2027`, `:340` `15.01.2027`, `:472` |

**Already registered before the audit said it.** Two of the audit's HIGH findings are defects this repo recorded on 2026-10-09 from research 21 and had deliberately left open: **Finding 3 (activity-specific treatment) is B-29** and **§5 (fixed assets and depreciation) is B-31**. The auditor had not seen the defect register. That does not make the findings wrong — both are confirmed — but it means the plan must not re-mint ids for them, and the reason they were left open (B-29 needs a CAEN→activity-family decision; B-31 needs a depreciation model decision) is the reason they are now phases rather than oversights.

Four open defects the audit **missed** are carried in §4: **B-30** (input-VAT deductibility), **B-16 remainder** (fiscal-loss persistence), **B-27** (a fake async boundary) and **B-28** (the em dash meaning two opposite things on one screen).

**Not independently verified — treat as reported, re-verify inside the phase that acts on it:** the exact place where operand evidence is dropped (`data/dashboard.ts` destructuring); the other-income ratios sitting at 1; the fixed-asset threshold not being encoded; the SM-vintage claim's reach into the *calculation* as opposed to the display.

---

## 4. New defect ids

| Id | Defect | Closed by |
|---|---|---|
| **B-36** | FX rate records cannot enter the app through any interface — `recordFxRate` has no caller, Settings is read-only. A user with an EUR/USD record cannot resolve the missing-rate exclusion | **10c** |
| **B-37** | The financial summary/graph and the tax estimate use different currency handling: aggregation skips non-lei records, the estimate normalises them. One user, two revenue totals | **10c** |
| **B-38** | Payment and collection dates are modelled (`paid?`, `collected?`) but not enterable; a document in December paid in January can be attributed to the wrong fiscal year | **12C** |
| **B-39** | Per-expense facts the classifier needs (vehicle exclusive/partly/not for the activity, supporting documentation present) are not persisted; unknown vehicle use defaults to non-exclusive, applying 50 % without a recorded fact | **12D** |
| ~~B-40~~ | **WITHDRAWN — this is B-29, already open since research 21.** The audit's Finding 3 is the hospitality / activity-family defect: TASK 2b built the channel (`activityFamily: 'cazare'` ⇒ `no_expense_engine` ⇒ `review_required` naming `EXPENSE_ENGINE_CAZARE_2026`), and **no caller supplies the fact**. Needs a CAEN→activity-family decision, not more plumbing | **12E** |
| **B-41** | Other-income flags are collected but the amounts those calculations depend on are not modelled; the estimate can look complete while a material input is absent | **12F** |
| ~~B-42~~ | **WITHDRAWN — this is B-31, already open since research 21.** No asset or depreciation model, so a capital purchase is deducted as if it were an ordinary expense; CF art. 68 alin. (7) lit. h) makes the purchase of depreciable goods **never** a direct expense, only depreciation under art. 28 is | **12G** |
| **B-43** | The estimate result loses the evidence that produced it — classifications, exclusion reasons, cap adjustments, FX conversions — so the calculation-detail view and the persisted snapshot cannot explain the expense total | **15**, **20** |
| **B-44** | Projection divides by fiscal-year elapsed months and multiplies by 12, ignoring the PFA's actual active period; a PFA starting in October is projected as if it had been trading since 1 January | **12** |
| **B-45** | The FY2026 minimum-wage vintage is recorded UNVERIFIED and is labelled on thresholds, but the same uncertainty applies wherever SM-derived values feed the **calculation**; the assumption is not identifiable later from the calculation record | **17**, **15** |
| **B-46** | UTC-based date defaults in page forms, and e2e assertions that only pass while today is before 25 May 2027 | **12C** (defaults), **32** (inject a controlled date) |
| **B-47** | The seed tells two product stories: a 2020-start PFA with a 2025 filing history, against a product specified as starting in 2026 with no prior-year history | **11** / **PG-3** |
| **B-48** | **No fiscal-year lifecycle.** Past 31 December the Dashboard still runs a run-rate: at 15 Jan 2027 it reads 12,5 din 12 luni and 3.086 lei; at 26 May 2027, 16,8 din 12 and 2.916 lei — same data, a different answer every day. There is no 2027 rule package and the fiscal year is only a manual Settings field. The first real boundary is about 12 weeks away | **PG-4** |
| **B-49** | **`addSnapshot` has no production caller** (`store.tsx:98`, `:349`; the only other mention is a comment). The app never persists a calculation record, so the rule-immutability and R1/R2 replay machinery has no live write path — and `completeness.ts:180` asks for at least one snapshot with status `computed`, which is why Date lipsă: Estimare impozit can never clear. One defect, two symptoms | **PG-8** |
| **B-50** | All 39 expense rules are ACTIVE with the same `verifiedAt` while most caps carry CONFLICT NEREZOLVAT — contradicting the repo's own rule that ambiguous law is staged for review | **PG-9** |
| **B-51** | **No disclaimer anywhere in user-facing copy** — consultanță, nu constituie and informativ all return zero hits. For production this is not polish | **PG-10** |
| **B-52** | Accessibility: `.muted` `#667085` is 4.43:1 against a 4.5 requirement in 6 places; no `<main>` landmark (54 elements outside landmarks); no skip link; 4-5 links read only Deschide | **PG-12** |
| **B-53** | Performance and coupling: `useDashboardData()` runs three times per view (shell, Dashboard, `FinancialChart`) with three separate async estimates; one 902 kB chunk; the headline Venituri is VAT-inclusive (9.317) while the estimate uses net (7.700) | **PG-12** |
| **B-54** | **The ×12 annualisation has no legal basis, and it is not only the mid-year case.** L-1 established that CF art. 118 alin. (3) deems income realised in a fraction of a year to **be** the annual income, that art. 68 alin. (2) lit. a) / alin. (4) lit. b) measure actual receipts and payments with no annualisation, and that the statutory proration for starters was deleted by OUG 115/2023 art. I pct. 101 from 1 Jan 2024. TASK 1 feeds the engine **projected** annual figures; a projection is a forecast, not the legal base, and the thresholds are measured on it | **PG-4** / **12** |
| **B-55** | **An internal identifier reaches a Romanian sentence.** `thresholds.ts:834` builds `Baza „${spec.requiredFiscalBase}” nu a fost furnizată`, printing `net-income` / `revenue-excl-vat` to a user. The copy guard cannot catch it — it scans `components/**` and `pages/**`, and domain sentences live where they are produced. `ThresholdSection.tsx:92` keeps the same leak path for `affectedDomain` | **PG-12** / 28 |
| **B-56** | **Success messages claim operations that do not happen.** `records.ts:248` says `Declarația … a fost transmisă` over `sendDeclaration`, which is a `setData` call (`store.tsx:93`, `:320`); `settings.ts:61-62` says `Contul este conectat la platforma e-Factura` with no integration anywhere (Q-EFACT-API not started). A user who believes a declaration was filed may not file it | **PG-10** / 28 |

### Already open in `STATE.md` — carried forward, not re-minted

The audit did not mention four of these. They are live defects and each now has an owner phase.

| Id | Defect | Closed by |
|---|---|---|
| **B-16** (remainder) | Fiscal losses: the rule and surfacing are closed, but the **record is not persisted and prior-year losses are not read back** into CF art. 118 alin. (2) lit. a) | **13** |
| **B-27** | `computeTaxEstimate` is declared `async` with no I/O behind it, so a pending state exists that can never resolve meaningfully | **21** (compute synchronously in the hook, together with B-28) |
| **B-28** | The em dash carries two opposite meanings on one screen — `—` for "no value" and `—` for "refused" | **21** |
| **B-29** | Art. 68^3 forfetar cazare is not modelled; the refusal channel exists but **no caller supplies the activity-family fact** | **12E** |
| **B-30** | The deductible expense is net of *actually deductible* VAT, not of all VAT on the invoice — `tax.ts:144` picks `expensesNet` whenever the profile is not `vatExempt`, which assumes every leu of input VAT is recoverable | **13** |
| **B-31** | No asset or depreciation model, so a capital purchase is deducted as an ordinary expense | **12G** |
| **B-34** | `Declaration` is monthly `{an, luna}` and cannot hold the one annual filing this profile makes | **18A** |
| **B-35** | D300 periodicity is undetermined by the seed's own facts; no VAT registration date is recorded | **18B** |
| **D1** | A clean first run is handed `seedData` (`store.tsx:166-167`) and only `'quarantined'` renders a banner (`App.tsx:275`) | **11**, proven in **26** |

B-46's content is the list B-23 recorded as *not touched, recorded instead* when it closed: `pages/Documents.tsx:426` `getFullYear()`; `pages/Revenues.tsx:28`, `pages/Expenses.tsx:26`, `pages/Declarations.tsx:28` taking a UTC date where the app's rule is the Romanian local date; `pages/Settings.tsx:226` `Date.now()` for an id; and the four `e2e/dashboard.spec.ts:216,219,223,289` assertions that hold only while today is before 2027-05-25.

Already open from before: **B-34** (`Declaration` is monthly `{an, luna}` and cannot hold an annual D212) → **18A**; **B-35** (D300 periodicity undetermined; `vatExempt` boolean insufficient) → **18B**; **D1** (a clean first run is handed `seedData` and never told, `store.tsx:166-167`) → **11**, verified in **26**.

## 4b. Open questions from `STATE.md` that constrain these phases

These are **not** research gaps to re-open. Check the register before a brief asks for one — a Researcher's UNVERIFIED label is not a new open question if the register already closed it (the TASK 4 lesson, recorded in the register itself).

| Question | State | Effect on the plan |
|---|---|---|
| **Q-VAT-PERIOD** | Not a research gap — **a missing input**. CF art. 322 alin. (3)-(4) turns on a pro-rated estimate the taxpayer makes | **18B cannot be closed by research.** It needs the §9 supported-scope decision, or an explicit refusal to assert a period |
| **Q-MULTI-SOURCE** | Would require inventing income categories the sources of record do not name | Bounds **12F**: model only what the sources name, refuse the rest |
| **Q-ROLLOVER-FIXED-DATE** | Still open, evidence on both sides. Adopted app position: surface the statutory date, treat any extension as an explicit dated sourced override | **Blocks any working-day primitive** in 18B, 24, 32 |
| **Q-WORKING-DAY-DEF** | Closed — Reg. 1182/71 art. 2 alin. (2): Saturday is **not** a working day | Only where a term is expressed în zile lucrătoare |
| **Q-ANAF-SAMBITA** | Authority gap, not knowledge gap — no ANAF instrument states how the current 5-working-day term is counted | Do not present a counting method as settled |
| **Q-PENDING-B4-2026**, **Q-PENDING-10MAI** | Pending bills, **not law** | Never encode; recorded so "no pending change" is never claimed |
| **Q-RESEARCHER-WRITE** | The `researcher` agent has **no file-write tool** | **Every Researcher report must be transcribed to `docs/ai/research/NN_*.md` by the Orchestrator before anything else is done**, or it is lost on compaction |
| **Q-METHOD-NOTECOUNTS** | Portal Legislativ publishes no note count | Doc id + consolidation date are the anchor; never a count |

---

## 5. Order

Phases in **bold** are new, inserted by the audit. The rest keep the user's numbering.

| # | Phase | Status | Closes |
|---|---|---|---|
| **10c** | **FX end to end: rate ingress and one normalised-ledger boundary** | not started | B-36, B-37 |
| 11 | Coherent 2026 seed state + first-run separation | partially done by TASK 9 | B-47, D1 |
| 12 | Run-rate projection over the **active period** | partial | B-44 |
| 12A | Expense deductibility model | **DONE** (TASK 2a–2d) — gap-check only | — |
| 12B | Pension fact for CASS | **DONE** (TASK 5) — gap-check only | — |
| **12C** | **Payment / collection dates enterable, and date defaults** | not started | B-38, B-46 |
| **12D** | **Per-expense facts the classifier needs** | not started | B-39 |
| **12E** | **Activity family wired to the estimate, or explicit refusal** | not started | B-29 |
| **12F** | **Other income: model the amounts or refuse** | not started | B-41 |
| **12G** | **Fixed assets and depreciation boundary** | not started | B-31 |
| 13 | Annual tax estimate pipeline | largely done — gate it | B-16 remainder, B-30 |
| 14 | Automatic recalculation | done — extend the triggers | — |
| 15 | Snapshots + rule-release versioning | partial | B-43, B-45 |
| 16 | Tax reserve persistence | **DONE** (TASK 3) | — |
| 17 | Threshold semantics | **DONE** (TASK 4) | B-45 |
| **18A** | **Annual declaration model** | not started | B-34 |
| **18B** | **VAT periodicity facts** | not started | B-35 |
| 18 | Deadline semantics | **DONE** (Phase 9b) — re-check after 18A/18B | — |
| 19 | Unified issue/severity/action | **DONE** (TASK 8) — vocabulary decision | — |
| 20 | Calculation detail + disclosure policy | partial | B-43 |
| 21 | Tax estimate hero | mostly done | B-27, B-28 |
| 22 | Financial graph | partial (no non-colour actual/projected cue) | — |
| 23 | Summary + reserve + threshold UI | partial | — |
| 24 | Deadline + completeness + action UI | largely unsatisfied | depends on 18A |
| 25 | Legislation slot | **DONE** (TASK 8) | — |
| 26 | 2026 first-run experience | not started | D1 verified end to end |
| 27 | Responsive dashboard | partial (TASK 9 fixed 390 px chart) | — |
| 28 | Accessibility + remaining Romanian polish | partial | the nine parked wording calls |
| 29 | Persistence / export / import / document blobs | not started — **release gate** | — |
| 30 | Real production walkthrough + demonstrated fixes | not started | — |
| 31 | Golden fiscal fixtures | not started | — |
| 32 | Full automated suite | not started | B-46 |
| 33 | Real-browser E2E + responsive QA | not started | — |
| 34 | Final dry run + release audit | not started | — |

**10c runs before 11.** It is the unfinished half of the currency work, and Phases 11, 12, 13, 22, 23 and 26 all touch money that 10c makes consistent.

---

## 6. Phase detail

### 10c — FX end to end *(new)*
- **Rate ingress through the UI.** A manual rate-entry workflow using the existing validated `recordFxRate` upsert keyed by `rateKey`: currency, rate, `rateKind`, date or year, source URL, provisional/final. Settings' FX block stops being read-only.
- **One normalised-ledger boundary.** Summary, graph and estimate consume the same converted records, or the UI states precisely why they differ. A record must not vanish from the financial picture because its currency is foreign (B-37).
- Prove: an EUR record with a rate reconciles across summary, graph and estimate; the same record without a rate cannot make the result look complete.
- Do not add a network path; manual/store ingress only, as 10b left it.

### 11 — Coherent 2026 seed + first-run separation
- Resolve **B-47**: the seed is a 2020 PFA with a 2025 D212; the product is specified as a 2026-start PFA with no prior-year history. **Blocked on §9 decision 5.** TASK 9's removal of the false quarterly filings was correct and stays.
- **D1**: `store.tsx:166-167` hands a first-run user `seedData` with `dataOrigin: 'seed'`, and only `'quarantined'` renders a banner. Either start empty or label the demo — **blocked on §9 decision 4**.
- Keep demo data separate from a clean workspace; expected totals in fixtures are labelled as expected results, not mutable UI state.

### 12 — Projection over the active period
- Replace the fiscal-year denominator with the **PFA's actual active period**: start date, elapsed active time, remaining period. A PFA starting in October must not be divided by nine calendar months (B-44).
- Handle: newly started PFA, zero elapsed active time, future start date, no transactions, losses, partial-year activity, leap years — no division by zero, no false precision.
- Fixtures for a 2026 start with a partial first month; the first partial month is not a full month unless a documented rule says so.
- Keep `method` and assumptions in the domain result; YTD actuals stay distinct from projected values.

### 12C — Payment / collection dates *(new)*
- Expose an explicit payment date on the expense form persisting to `paid`, and a collection date on the revenue form persisting to `collected`, each keeping the document date separately.
- Fix the UTC-based page date defaults using the shared local-date utilities (B-46).
- Browser tests: expense documented December paid January; revenue invoiced December collected January — each lands in the intended fiscal year, after reload.

### 12D — Per-expense facts *(new)*
- Add the smallest set of facts the classifier already asks for — vehicle use exclusive / partly / not at all, which statutory vehicle exception applies, whether supporting documentation is present — through form, schema and migration.
- **Unknown must return a review state, not a default.** Today unknown vehicle use is treated as non-exclusive and applies 50 % with no recorded fact; that is manufacturing a fact (B-39).
- Apply vehicle rules to the individual expense, never a profile-wide assumption.

### 12E — Activity family *(new)*
- This is **B-29**, open since research 21. The channel already exists: `activityFamily: 'cazare'` ⇒ `no_expense_engine` ⇒ the estimate returns `review_required` naming `EXPENSE_ENGINE_CAZARE_2026` / art. 68^3 instead of computing. **No caller supplies the fact** — `ActivityFamily` appears nowhere in `estimateBasis.ts`, `data/derived.ts` or `data/dashboard.ts` (verified 2026-10-10).
- Closing it needs a **CAEN → activity-family decision**, which research 21 §7(c) leaves undecided, not more plumbing. Either establish the family from a verified mapping before calculating, or **explicitly decline** when the profile's activity could require a different statutory method.
- Never apply the ordinary actual-expense method to an activity with another statutory calculation.

### 12F — Other income *(new)*
- Model the amounts the affected calculations depend on, or refuse the affected calculation when the profile makes them material (B-41). A flag that another income source exists does not supply the ratios.
- The app must not accept a profile implying a more complex situation, ignore the missing quantities, and return a confident estimate.

### 12G — Fixed assets and depreciation *(new)*
- This is **B-31**, open since research 21: CF art. 68 alin. (7) lit. h) makes the purchase or manufacture of depreciable goods **never** a direct expense — only depreciation under art. 28 is. TASK 2a classifies the category as capital; the depreciation model itself was never built.
- Encode the verified 2026 asset threshold (OUG 8/2026) and the asset facts, or make the expense **visibly unresolved**. Refusing the whole purchase price is not the same as modelling depreciation (B-31).

### 13 — Annual pipeline
- Largely satisfied. **Gate:** do not declare it complete while required profile facts, FX rates or material expense classifications can be omitted without an incomplete/review state. Depends on 10c, 12C–12G.
- **B-30:** `tax.ts:144` selects `expensesNet` whenever the profile is not `vatExempt`, which assumes every leu of input VAT is recoverable. For a VAT-registered PFA it is not. The deductible expense must be net of *actually deductible* VAT, or the difference stays visibly unresolved.
- **B-16 remainder:** persist the fiscal-loss record and read prior-year losses back into CF art. 118 alin. (2) lit. a). The rule and surfacing closed in Phase 5; the persistence never happened.

### 14 — Automatic recalculation
- Extend the invalidation triggers to payment/collection dates, expense classifications, vehicle facts, profile facts and **FX rate changes**. No manual recalculate button, no second engine; historical snapshots never mutate.

### 15 — Snapshots and release versioning
- Persist the **evidence**, not just the aggregates and the digest: amounts passed to the engine, actual-vs-projected basis and method, deductible total with category-level components, exclusions and unresolved facts, cap calculations with the chosen interpretation and the alternative, FX rates with provenance, and the rule release + digest (B-43).
- A stored estimate must be interpretable without re-running the current projection or consulting the current FX store.
- Record the SM-vintage assumption in the calculation record (B-45).
- **§9 decision 2** governs whether rule `version` numbers move off 1.

### 17 — Thresholds
- Semantics are done and must be preserved. Confirm the wage-vintage assumption is surfaced wherever it affects a **calculated** result, not only on a displayed threshold (B-45).

### 18A — Annual declaration model *(new)*
- Replace the monthly `{an, luna}` shape with an annual record carrying `taxYear` and a filing date; rethink the `length > 0` completeness predicate with it (B-34). Needs a persistence bump and migration.

### 18B — VAT periodicity *(new)*
- Collect the facts that select the branch — VAT registration date, prior-year taxable supplies — or decline to assert a period. `vatExempt: boolean` is not enough (B-35). Do not assume monthly.

### 20 — Calculation detail
- The breakdown must show or link everything §15 persists. Today the hero disclosure renders the engine's lines, and `copy.disclosure.sources` is wired on Settings, Expenses and thresholds but **not on the estimate**.

### 21 — Hero
- Mostly satisfied: `estimate-state` badge, `—` rather than `0` when `taxTotal === null`, a different hint per state.
- **B-27 and B-28 together:** compute the estimate synchronously in the hook so the pending state stops existing, and make `—` mean one thing. Today the same dash renders for "no value" and for "refused".
- Gaps from the mapping: the hero does not separate estimated annual tax from actual YTD and projected full-year in the hierarchy, and the run-rate assumption lives only inside the disclosure.

### 22 — Graph
- Add a non-colour actual/projected cue (dashed or equivalent). Today the distinction is in data and label text only.

### 24 — Dashboard actions
- None of the roadmap's section names exist yet (`Date pentru estimare`, `Ești la zi`, `Vezi toate`, `Ce merită să rezolvi acum`) and there is no top-three cap. Depends on 18A so declaration completeness stops reading as a monthly checklist.

### 26 — First-run
- Verify the real form-to-calculation path, including distinct payment/collection dates and unsupported scenarios. This is where **D1** is proven closed, not assumed.

### 29 — Persistence / export / import / blobs — **release gate**
- No export or import exists at all. Document blobs are base64 inside records travelling through `localStorage` (`seed.ts:86-96`, 39–51 kB each). Corrupt data must not become zeros or fake demo data; import must validate before replacing and be non-destructive on failure.

### 30–34 — Walkthrough, fixtures, suite, browser QA, final audit
- 32 must inject a controlled date so the suite stops depending on the calendar (B-46).
- 34 refuses a production-ready label while any CRITICAL or HIGH remains.

---

## 7. Standing requirements — every phase

1. One Worker at a time; **Scouts sequential** (standing user decision).
2. Classify each acceptance criterion as already satisfied / partial / unsatisfied **before** implementing. A type, component or comment is not proof of end-to-end behaviour.
3. Never weaken an assertion, delete a meaningful test, or widen a timeout.
4. No money figure moves without a hand derivation recorded old → new.
5. `unknown` / `REVIEW_REQUIRED` / unavailable stay withheld; nothing resolves them to make a warning disappear.
6. No backfilled digests, rule versions, rates or seed facts.
7. FY2026 only; no 2025 user-facing history, no implied future-year support.
8. Copy goes in `src/ui/copy/`; `src/domain` never imports from it.
9. Phase docs in `docs/ai/phases/NN_*.md`; **never** write to `docs/ai/steps/` (frozen archive — §9 decision 3).
10. Report only validations actually run.
11. Transcribe every Researcher report to `docs/ai/research/NN_*.md` immediately — the agent cannot write files and its output dies with compaction.
12. Before briefing a gap into a Worker, check the `STATE.md` open-questions register: it may already be closed.

---

## 8. Regression scenarios to prove before the first release

1. **Payment/collection dates** across fiscal years, verified after reload.
2. **New PFA projection** starting in 2026, partial first month, active-period run rate.
3. **Foreign currency**: EUR record, rate entered **through the UI**, summary + graph + estimate reconcile; repeat without a rate and prove the result cannot look complete.
4. **Activity-specific rules**: a profile needing another method selects it or is explicitly refused.
5. **Expense-dependent facts**: vehicle exclusive / non-exclusive / unknown, including missing-fact behaviour.
6. **Additional income**: quantitative inputs present, or no falsely complete estimate.
7. **Annual declaration**: an annual D212 resolves the right completeness/action state, not a monthly checklist.
8. **VAT periodicity**: the app obtains the facts before asserting a D300 period.
9. **Reproducibility**: save an estimate, change a release or a rate, the old record stays interpretable.
10. **Tax detail**: the breakdown reconciles to the deductible subset, exclusions, cap adjustments and FX conversions.

---

## 9. Open decisions — **resolved 2026-10-10**, except the wording calls

Recorded in full in `USER_DECISIONS.md` as D-SEED-2, D-RUN-1, D-SCOPE-2, D-SEV-1, D-VER-1, D-DOCS-1.

| # | Decision | Answer | What it obliges |
|---|---|---|---|
| 1 | Severity vocabulary | **`info \| warning \| danger`** at the display boundary | The domain keeps legal status and urgency **separate**; the three words are applied at render. TASK 8's distinction must not be re-fused inside the engine |
| 2 | Rule edition numbers | **Bump going forward, never back-fill** | All 48 stay at `version: 1`; the next content change issues a superseded release. The digest remains the identity |
| 3 | Phase docs location | **`docs/ai/phases/`** | The roadmap's `steps/NN_*.md` names are labels, not paths. The frozen archive is never written to |
| 4 | First run | **Start empty** | `store.tsx:166-167` stops handing out `seedData`. Closes D1 at the root. The “Get started” persona demo is a **Phase 26** feature, user-entered, not preloaded |
| 5 | Seed scenario | **Both** — 2026 starter as the product scenario, 2020 PFA as a test fixture | Seed data becomes **test-only**. The pinned money figures survive because they are pinned through the test path; what goes away is the shipped demo bundle. Phase 11 must prove that, not assume it |
| 6 | Supported scope | **Broad — attempt every profile, refuse where a fact is missing**, “with rigorous planning and execution” | Refusals must be **built and tested**. Regression scenarios 4, 6 and 8 in §8 become acceptance criteria, not nice-to-haves. 12E, 12F and 13's gate cannot slip |
| 7 | Nine Romanian wording calls | **Resolved 2026-10-10 — all eight remaining approved**, with the user's variants chosen | `USER_DECISIONS.md` D-LANG-2; Phase 28 / PG-12 |

**Phase 11 is unblocked.** Its shape is now defined: a first run returns an empty dataset, `data/seed.ts` becomes test fixtures, the 2026-start scenario is the product story, and the 2020 PFA survives as a fixture for Phases 31–32.

---

## 10. Release gates

Not release-ready until: **10c** (one money path), **12C** (fiscally correct dates enterable), **12E/12F** (unsupported cases refused, not mis-calculated), **18A** (declaration model honest), **29** (export/import and blob storage), **26 + 30 + 33** (the flow proven in a real browser), and **34** with no CRITICAL/HIGH open.

**The target is production, not a friends pilot** — confirmed 2026-10-10. That retires the narrow-scope mitigation the first audit offered: every unsupported case needs real support or an explicit refusal.

---

## 11. PG to Phase mapping — one plan, two vocabularies

The second audit produced a production-gate brief, saved at `docs/ai/briefs/28_pg_production_gate.md`. **PG is the execution order; the phase numbers stay the record of what already landed.** Where they disagree, PG wins on sequence and the phase plan wins on what is already done and what must be preserved.

| PG | Phase(s) | Defects |
|---|---|---|
| PG-0 groundwork | 32 (date-independent suite) + STATE hygiene | B-46 |
| **PG-1 estimate coverage** | the gate on 13 — **no phase owned this before** | B-28 adjacent; the silent-exclusion finding |
| PG-2 dates | **12C** | B-38, B-46 |
| PG-3 first run, onboarding, seed | **11** + **26** | B-47, D1 |
| PG-4 projection + year lifecycle | **12** | B-44, **B-48** |
| PG-5 annual filing | **18A**, **18B** | B-34, B-35 |
| PG-6 unsupported scenarios | **12D, 12E, 12F, 12G**, 13 | B-39, B-29, B-41, B-31, B-30 |
| PG-7 FX end to end | **10c** | B-36, B-37 |
| PG-8 evidence + snapshots | **15** + **20** | B-43, **B-49** |
| PG-9 rule governance | 25 + new | **B-50**, C2 resolved by D-VER-1 |
| PG-10 trust copy | new | **B-51** |
| PG-11 data safety | **29** | — |
| PG-12 UX, a11y, performance | **27, 28, 33** | **B-52**, **B-53**, the nine wording calls |
| PG-13 release audit | **30–34** | all open |

**PG-1 goes first after PG-0.** It is the channel every later refusal reuses, and it is the finding that undermines every number on the screen: the hero says Calculat while records are quietly dropped, in both directions — an unconverted euro expense *raises* the tax and an unconverted euro revenue *lowers* it.
