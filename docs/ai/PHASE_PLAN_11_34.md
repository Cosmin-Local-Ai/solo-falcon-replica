# Phase plan — Phases 11–34, restructured after the independent audit

**This file is the authoritative forward plan.** It supersedes the phase list in `docs/ai/pre_phase11_execution_plan.md` (that round is finished) and merges the user's *SOLO Orchestrator Prompt Set — Updated Phases 11–34* with the findings of the independent audit of 2026-10-10.

## 0. Compaction recovery ritual — do this before briefing anything

**Confirm, do not re-run.** The counts below are recorded facts; re-running the suite costs minutes and proves nothing new unless a Worker has just changed code. Confirm `git log --oneline -1` matches the baseline commit and that the counts in §1 match `docs/ai/STATE.md`. If a Worker has landed something since, read its `docs/ai/phases/NN_*.md` first — that file, not this one, holds the new counts.

**Read in this order:**

1. **This file** — §1 baseline, §2 what must not be rewritten, §3 audit claims already verified, §4 defects **B-36 … B-73**, §4b the open-questions register, §5 order, §6 phase detail, §9 what is blocked on a user decision, §11 PG mapping, **§12 standing operating rules**.
2. **`docs/ai/briefs/28_pg_production_gate.md`** — the execution order PG-0 … PG-13, each with mission, evidence, files it may touch, acceptance. Plus the scout list and the owner decisions.
3. **`docs/ai/USER_DECISIONS.md`** — every decision with its reasoning. This is the file that stops the Orchestrator re-asking the user for things already settled.
4. **`docs/ai/STATE.md`** — baseline, phase status, defects **B-1 … B-35**, and the open-questions register. **Check the register before briefing any research gap**: a Researcher's UNVERIFIED label is not a new open question if the register already closed it. That lesson has cost time twice.
5. **`docs/ai/research/26_midyear_start_partial_year_2026.md`** and **`27_norme_metodologice_prorating_2026.md`** — the projection question and the code-versus-norm conflict. Both change what PG-4 may claim. Then the four later passes, each of which superseded something in the first two: **`28_fixed_date_rollover_2026.md`** and **`29_anaf_calendar_2026_and_rollover_authority.md`** (fixed-date rollover; ANAF rolls some obligations and expressly not others; **B-57**), **`30_norma_venit_2026.md`** (the 12H gate, and the negative that closes **L-2**), **`31_norma_feasibility_42_counties.md`** (the cost of 12H, and why the dataset must key on activity description and never on position number), **`32_fy2027_sunsets_carry_forward.md`** (what actually changes at the 31 Decembrie 2026 boundary, why the FY2027 wage anchor is **4.325 lei and not 4.050**, and **B-58** / **B-59**), **`33_income_categories_and_vat_periodicity.md`** (the closed income-category allow-list that unblocks 12F, and why the VAT periodicity is a declared figure the app must ask for rather than derive — **B-60**), **`34_declarations_efactura_rjip_and_nondeductible_vat.md`** (the profile owes exactly **one** return; RJIP misnamed — **B-61**; the declarations copy misidentifies D100 and D220 — **B-62**) and **`35_nondeductible_vat_negative_and_citation_corrections.md`** (**Q-NONDEDUCT-VAT closed as a documented negative with hit counts**, two of our own citations corrected, **B-64** for the FY2027 392B notification — and **B-63** resolved on the e-Factura relief) and **`36_fixed_assets_and_depreciation_2026.md`** (the shape of **B-31** at last, and **B-65** — the 1.500-lei/lună vehicle depreciation cap we never had).
6. **`docs/ai/notes/romanian_proofcheck_2026-10-10.md`** — the language audit, with the Orchestrator's in-tree verification inline.
7. **`docs/ai/roadmap_11_34_mapping.md`** — what already landed, so a Worker proves it instead of rebuilding it. Its evidence baseline is **TASK 9 (64 files / 1149 tests)**; §1 below is the current one.

Then, and only then, brief anything.

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
| ~~B-36~~ | **CLOSED by Phase 10c (2026-10-10).** FX rate records could not enter the app through any interface — `recordFxRate` had no caller, Settings was read-only, so a user with an EUR/USD record could not resolve the missing-rate exclusion. `components/ui/FxRateEntryForm.tsx` is now mounted in Settings' fiscal tab and calls the **existing** validated upsert: currency, printed decimal, `rateKind`, date-or-year per kind, series, source URL, provisional/final; `problems[]` renders verbatim; the same `rateKey` replaces rather than adding; an annual average of an open year is forced provisional. **No fetch added** — the entry test stubs `globalThis.fetch` and asserts it is never called. Proven in a browser: `e2e/settings.spec.ts` types a rate, reloads, and finds `5.347,00 RON` in the summary. Original wording, for the record: ~~FX rate records cannot enter the app through any interface — `recordFxRate` has no caller, Settings is read-only~~ | **10c** |
| ~~B-37~~ | **CLOSED by Phase 10c (2026-10-10).** The summary/graph and the estimate no longer use different currency handling. `domain/fx/ledger.ts normaliseStoredLedger` is now the **one** ledger boundary: summary, monthly series, projection, threshold rows, the snapshot, `selectFinancialDerived` and the estimate all read it, and `estimateBasis.ts`'s private duplicate provider builder is deleted. `DashboardData.ledger` carries `{conversions, unconverted}` and the disclosure is rendered on the summary card, under the graph and in `components/dashboard/CurrencySection.tsx` — the same record is now **5.347,00 lei in all three**, pinned by `data/dashboard.fx.test.ts`. Also closed the acute form the audit did not name: a ledger whose only record is foreign used to render the **onboarding empty state** (`hasData` read zero lei as “nothing recorded”). Original wording: ~~aggregation skips non-lei records, the estimate normalises them. One user, two revenue totals~~ | **10c** |
| **B-38** | Payment and collection dates are modelled (`paid?`, `collected?`) but not enterable; a document in December paid in January can be attributed to the wrong fiscal year | **12C** |
| **B-39** | Per-expense facts the classifier needs (vehicle exclusive/partly/not for the activity, supporting documentation present) are not persisted; unknown vehicle use defaults to non-exclusive, applying 50 % without a recorded fact | **12D** |
| ~~B-40~~ | **WITHDRAWN — this is B-29, already open since research 21.** The audit's Finding 3 is the hospitality / activity-family defect: TASK 2b built the channel (`activityFamily: 'cazare'` ⇒ `no_expense_engine` ⇒ `review_required` naming `EXPENSE_ENGINE_CAZARE_2026`), and **no caller supplies the fact**. Needs a CAEN→activity-family decision, not more plumbing | **12E** |
| **B-41** | Other-income flags are collected but the amounts those calculations depend on are not modelled; the estimate can look complete while a material input is absent | **12F** |
| ~~B-42~~ | **WITHDRAWN — this is B-31, already open since research 21.** No asset or depreciation model, so a capital purchase is deducted as if it were an ordinary expense; CF art. 68 alin. (7) lit. h) makes the purchase of depreciable goods **never** a direct expense, only depreciation under art. 28 is | **12G** |
| **B-43** | The estimate result loses the evidence that produced it — classifications, exclusion reasons, cap adjustments, FX conversions — so the calculation-detail view and the persisted snapshot cannot explain the expense total | **15**, **20** |
| ~~B-44~~ | **CLOSED 2026-10-10 (PG-4, `c44efb0`).** `elapsedMonths(fiscalYear, asOf)` became `elapsedMonthsFrom(start, asOf)`; the window is `[max(Jan 1, pfaStartDate), Dec 31]` and the annual multiplier is `activeMonths`, not 12. With no recorded start date the expression is algebraically the old one, so profiles that never set one do not drift. An Oct-2026 start with 10.000 lei projects to **30.000, not 120.000**. Projection divides by fiscal-year elapsed months and multiplies by 12, ignoring the PFA's actual active period; a PFA starting in October is projected as if it had been trading since 1 January | **12** |
| **B-45** | The FY2026 minimum-wage vintage is recorded UNVERIFIED and is labelled on thresholds, but the same uncertainty applies wherever SM-derived values feed the **calculation**; the assumption is not identifiable later from the calculation record | **17**, **15** |
| ~~B-46~~ | **CLOSED 2026-10-10 (PG-2, `700bd2a`).** All three UTC defaults now use `localDateISO()`, plus `Documents.tsx`'s `new Date().getFullYear()` → `localYear()`. A new production-surface rule in `wallClockGuard.test.ts` now forbids no-arg `Date` construction in `src/pages/` and `src/components/`, so this cannot silently return. **Note: the three sites had zero test coverage — no assertion anywhere pinned a date input's initial value.** UTC-based date defaults in page forms, and e2e assertions that only pass while today is before 25 May 2027 | **12C** (defaults), **32** (inject a controlled date) |
| ~~B-47~~ | **CLOSED by Phase 11 / PG-3 (2026-10-10).** The seed is now a **2026-start** PFA: `pfaStartYear: 2026`, `pfaStartDate: '2026-01-19'`, every recorded document dated after it, and the 2025 D212 removed from `documents`, `statements` and `companyDocs.im` — TASK 9 emptied `declarations` but left that document behind, and it is not merely false, it is **impossible** for a PFA registered in 2026. `fxRates` stays absent rather than `[]`. The fixture lost documents and a filing, not amounts: deductible 120,00 / 144,00 lei, VNA 9.096,00, impozit 819,00, clock 3.249,00, reserve 1.083,00, year-end 3.112,00 all still green. Original wording: ~~The seed tells two product stories: a 2020-start PFA with a 2025 filing history, against a product specified as starting in 2026 with no prior-year history~~ | **11** / **PG-3** |
| **B-48** | **No fiscal-year lifecycle.** Past 31 December the Dashboard still runs a run-rate: at 15 Jan 2027 it reads 12,5 din 12 luni and 3.086 lei; at 26 May 2027, 16,8 din 12 and 2.916 lei — same data, a different answer every day. There is no 2027 rule package and the fiscal year is only a manual Settings field. The first real boundary is about 12 weeks away | **PG-4** |
| **B-49** | **`addSnapshot` has no production caller** (`store.tsx:98`, `:349`; the only other mention is a comment). The app never persists a calculation record, so the rule-immutability and R1/R2 replay machinery has no live write path — and `completeness.ts:180` asks for at least one snapshot with status `computed`, which is why Date lipsă: Estimare impozit can never clear. One defect, two symptoms | **PG-8** |
| **B-50** | All 39 expense rules are ACTIVE with the same `verifiedAt` while most caps carry CONFLICT NEREZOLVAT — contradicting the repo's own rule that ambiguous law is staged for review | **PG-9** |
| **B-51** | **No disclaimer anywhere in user-facing copy** — consultanță, nu constituie and informativ all return zero hits. For production this is not polish | **PG-10** |
| **B-52** | Accessibility: `.muted` `#667085` is 4.43:1 against a 4.5 requirement in 6 places; no `<main>` landmark (54 elements outside landmarks); no skip link; 4-5 links read only Deschide | **PG-12** |
| **B-53** | Performance and coupling: `useDashboardData()` runs three times per view (shell, Dashboard, `FinancialChart`) with three separate async estimates; one 902 kB chunk; the headline Venituri is VAT-inclusive (9.317) while the estimate uses net (7.700) | **PG-12** |
| **B-54** | **The ×12 annualisation has no legal basis, and it is not only the mid-year case.** L-1 established that CF art. 118 alin. (3) deems income realised in a fraction of a year to **be** the annual income, that art. 68 alin. (2) lit. a) / alin. (4) lit. b) measure actual receipts and payments with no annualisation, and that the statutory proration for starters was deleted by OUG 115/2023 art. I pct. 101 from 1 Jan 2024. TASK 1 feeds the engine **projected** annual figures; a projection is a forecast, not the legal base, and the thresholds are measured on it. **Resolved by D-PROJ-1: the hero computes on actuals; a forecast may be shown but never feeds the engine or the thresholds** | **PG-4** / **12** |
| **B-55** | **An internal identifier reaches a Romanian sentence.** `thresholds.ts:834` builds `Baza „${spec.requiredFiscalBase}” nu a fost furnizată`, printing `net-income` / `revenue-excl-vat` to a user. The copy guard cannot catch it — it scans `components/**` and `pages/**`, and domain sentences live where they are produced. `ThresholdSection.tsx:92` keeps the same leak path for `affectedDomain` | **PG-12** / 28 |
| **B-56** | **Success messages claim operations that do not happen.** `records.ts:248` says `Declarația … a fost transmisă` over `sendDeclaration`, which is a `setData` call (`store.tsx:93`, `:320`); `settings.ts:61-62` says `Contul este conectat la platforma e-Factura` with no integration anywhere (Q-EFACT-API not started). A user who believes a declaration was filed may not file it | **PG-10** / 28 |
| **B-60** | **The FX layer has no conversion basis for the art. 322 periodicity cap, and its design invites reusing the wrong one.** `ConversionBasis` (`src/domain/fx/convert.ts:71-74`) offers exactly three — `payment_date_daily`, `payment_year_annual_average`, `income_realisation_year_annual_average` — each with a citation in `BASIS_CITATIONS`. **None is „cursul de schimb valabil pentru data de 31 decembrie a anului precedent“** (Normele metodologice HG 1/2016 pct. 103 alin. (2)), which is the basis the law fixes for the 100.000-euro periodicity cap. The union is discriminated so the basis cannot be omitted or mis-anchored — **which is exactly the danger**: a Worker building 18B would reach for `payment_year_annual_average` and get **the wrong rate** (annual average vs **5,0963** valabil pentru 31.12.2025 ⇒ **509.630 lei**, not 509.850) **with a legal citation attached to it**. A fourth basis must exist before any periodicity cap is rendered | **18B**, B-35 |
| **B-61** | **The RJIP label misnames an accounting register as a filed return — wrong on four counts.** `src/ui/copy/records.ts:391`: „Rapoarte de mișcări de trezorerie (RJIP) — generat din datele din Venituri și Cheltuieli.” The official name is **Registrul-jurnal de încasări și plăți**, cod **14-1-1/b**, **OMFP 170/2015, MO 139/24.02.2015** (amended by OMF 1.447/2023, MO 453/24.05.2023). Wrong noun (*raport* vs **registru**), wrong number (plural vs **singular**), wrong object (*mișcări de trezorerie* vs **încasări și plăți**), and it presents a record kept „anual sau la cererea organului de control” as a generated report/return. **RJIP is a practitioner abbreviation, not an official denumire.** Also `reports: 'Rapoarte'` (`:306`) and the export filename `RJIP_${year}.csv` (`Documents.tsx:505`). **The feature is right** — this profile does owe the register, and generating it from its own records is correct — **only the words and the filename are wrong** | **PG-12** / 28 |
| **B-62** | **The declarations copy misidentifies the forms, not just their relevance.** `records.ts:316` `Declarația 100 / impozit pe venit` — D100 is actually „**Declarație privind obligațiile de plată la bugetul de stat**” (cod 14.13.01.99/bs), the **quarterly Titlul III return for impozit pe veniturile microîntreprinderilor**; a Titlul IV taxpayer never owes it. `:321` `Declarația 220 / contribuții sociale` — D220 is actually „**Declarație privind venitul estimat/norma de venit**”. A user who picks “D220 / contribuții sociale” for a real contribution document has filed the wrong thing. The placeholder `ex. D101, D112, D200, 220, 221…` (`:360`) and the help line (`:372`) teach the same wrong set. **For FY2026 this profile owes exactly one return: D212, due 25 mai 2027** (art. 122 alin. (1) lit. a) + alin. (3)); D112 is conditional on being an angajator (art. 147 alin. (1)), D300/D394 on art. 316 registration, D301/D390 on art. 317, and **D406 SAF-T expressly excepts PFA/II/IF** | **PG-12** / 28, 26 |
| **B-63 — CONFIRMED, but the citation attached to it was wrong and the split is THREE periods, not two (2026-10-10, `research/35` §8, §11)** | **Any e-Factura statement true for the year is false for 336 days of it.** Our register closed **Q-EFACT-SCOPE** as YES — „a sistem-real PFA with no VAT registration IS a RO e-Factura emitter in 2026”. **True for 1 ianuarie – 29 ianuarie 2026 only.** FY2026 for a CNP-identified PFA: **01.01–29.01 obliged** (OUG 120/2021 art. 10^1 alin. (2); OUG 89/2025 art. X pct. 5 și art. XI, MO 1203/24.12.2025 — those active before 15.01.2026 enrolled with effect 15.01.2026); **30.01–31.05 not obliged** (OG 6/2026 art. IX alin. (1), MO 77/30.01.2026, derogare „până la data de 1 iunie 2026”); **from 01.06 not obliged, permanently** — OUG 120/2021 **art. 10^10 alin. (1)** as rewritten by **Legea 88/2026 art. III pct. 8**: „Furnizorii/Prestatorii care se identifică fiscal prin codul numeric personal **nu au obligația** să respecte prevederile art. 5, 9¹, art. 10 alin. (1) și art. 10¹ alin. (2)”, optants going to **Registrul RO e-Factura opțional** effective **1 a lunii următoare opțiunii**; **in force 01.06.2026** per art. IV alin. (1). **The mechanism matters: art. 10^10 was born as an ENROLMENT OBLIGATION and was rewritten into the relief.** The **26 mai 2026** deadline (OG 6/2026 art. IX alin. (3), OPANAF 378/2026 pct. 19) **enrolled** CNP suppliers into the obligatoriu register effective 01.06.2026 — the opposite of relief — and was overtaken three days later by Legea 88/2026, which is exactly why a removal route had to exist. **Two removal routes with different effect dates:** OPANAF 378/2026 pct. 18 (OG 6 route) removes „**cu data depunerii solicitării**”; **art. 10^8 alin. (2)** as rewritten by Legea 88/2026 art. III pct. 7, implemented by OPANAF 1020/2026, removes „**începând cu data de 1 a lunii următoare**”. **Citation traps:** the Portal Legislativ consolidated OUG 120/2021 page still shows art. 10^10 in its pre-Legea 88/2026 obligation form — reading it alone gives the opposite answer; and **OPANAF 378/2026 is dated 22 martie 2026, MO nr. 250 din 31.03.2026**. **OPANAF 1020/2026 MO 706/25.08.2026 remains unverified** — the amended formular 082 was read, not the order header. Adjacent to **B-56**, which covers the false “Conectare e-Factura” claim and stands on its own | **PG-10**, 26 |
| **B-64** | **A FY2027 obligation this profile will owe and the app does not model — and our citation for it was wrong.** For FY2027, a PFA **neînregistrată în scopuri de TVA** with cifră de afaceri (art. 310 alin. (2)) **sub 300.000 lei** owes the **CF art. 324 alin. (5) notificare scrisă — form 392B — by 25 februarie 2028**. The suspension is **OUG 115/2023 art. LXII**: „Aplicarea prevederilor art. 324 alin. (4)-(6) … se suspendă începând cu data de 1 ianuarie 2024 și până la data de 31 decembrie 2026 inclusiv”, and **no 2026 instrument re-suspending it was found** (absence of evidence — re-check ianuarie 2027). **Three corrections to what we recorded:** (i) **art. 324 alin. (6) is the international bus-ticket notification, not the suspension text** — the suspension is a *modification note* in the ANAF consolidation, and reading the article body gave a different alineate than reading the note; (ii) the threshold is **300.000 lei, not 220.000**, and it is **independent of the 395.000-lei art. 310 alin. (1) plafon**; (iii) Titlul VII pct. 104 alin. (3)-(5): notifications are owed **only for years with qualifying operations**, and where VAT status changed mid-year **the status on 31 decembrie is what counts**. Model as a conditional, not a calendar row | **12G**, B-58 |
| ~~B-58~~ | **CLOSED for the failure mode 2026-10-10 (PG-4, `c44efb0`).** A year with no rule package now yields `review_required` plus the Romanian message that the 2027 rules are not loaded, with a visible banner and a working toggle back to 2026 — **never a zero, never a stale 2026 figure presented as current.** **Residual, and it is not a code defect:** the 2027 package itself is still absent because no verified 2027 figures exist and the 2027 minimum wage is unpublished. Per **D-YEAR-2** it is carried forward and updated when the datum arrives. Re-open when the data lands. **On 1 ianuarie 2027 the app switches year and then computes nothing.** Verified in-tree: `selectRuleSet(taxYear, asOfDate)` (`src/domain/fiscal/registry.ts:378`) returns `undefined` for any year with no registered release, and **only 2026 is registered** (`release2026.ts`, `package2026.ts`). All three call sites map that to an empty rule set (`derived.ts:44`, `dashboard.ts:62`, `Expenses.tsx:24`) — deliberately, per the comment at `derived.ts:42-43`: „a profile that says another year gets no rules instead of getting 2026's”. The engine then refuses honestly: `tax.ts:138-140` returns `review_required` with „Regula CAS nu a fost găsită pentru anul fiscal 2027”. Thresholds `continue` past any spec whose rule is absent (`thresholds.ts:783-785`), so the rows **disappear**. **D-YEAR-1 auto-switches the fiscal year on 1 January, so the app goes dark on its own trigger, and D-YEAR-2's „carry the last known values forward” has no mechanism to carry into.** No wrong number is produced — that part of the design holds | **12G**, **PG-2** |
| **B-59** | **The SM multiples are stored as lei literals; the multiplier is only a label cross-check.** `THRESHOLD_SPECS` carry `statutorySmMultiplier` and `computedLeiFor` (`thresholds.ts:747-748`) verifies `smRef.valueBani × multiplier === thresholdValue` — but on mismatch it **drops a presentation label**, it does not stop the computation. The operative figure is the lei parameter read from the year's package (`thresholds.ts:786-789`), while the law expresses these thresholds as multiples of SM (art. 148 alin. (2), art. 170 alin. (1),(3), art. 174 alin. (6)). Building a 2027 package therefore means hand-writing six new lei literals that must agree with a new SM rule, and **the only thing enforcing that agreement is a test**. Aggravating factor: `package2026.ts` already holds **both** wages — `lei(4050)` as `GENERAL_MINIMUM_WAGE_2026_H1` and `lei(4325)` as `…_H2` — so anyone copying the package for 2027 meets **4.050 first**, with the correct FY2027 anchor sitting below it under a year-specific name | **12G**, **PG-2**, 30 | **The deadline engine has no rollover policy, and ANAF itself gives two different answers for the same month.** A grep over `src/domain/` and `src/data/` finds **no** working-day or rollover handling anywhere; the only weekend logic in the codebase is BNR rate carry-forward in `src/domain/fx/`. The app shows the raw statutory date with no roll and no warning. `research/29` §1-2: ANAF's own Calendarul obligatiilor fiscale 2026 publishes the whole 25-octombrie block as **„luni 26 octombrie"** (F100, 112, 208, 224, 300, 301, 307, 311, 390, 395, 217) while publishing **„sambata 31 octombrie"** for D398 and D396 with the express note that the last calendar day applies **„chiar daca aceasta este o zi nelucratoare"**. **Rollover is a per-obligation property - rolls / does not roll / unknown - not a global primitive** | **18A**, 18B, 24, 32 |

### Already open in `STATE.md` — carried forward, not re-minted

The audit did not mention four of these. They are live defects and each now has an owner phase.

| Id | Defect | Closed by |
|---|---|---|
| **B-16** (remainder) | Fiscal losses: the rule and surfacing are closed, but the **record is not persisted and prior-year losses are not read back** into CF art. 118 alin. (2) lit. a) | **13** |
| **B-27** | `computeTaxEstimate` is declared `async` with no I/O behind it, so a pending state exists that can never resolve meaningfully | **21** (compute synchronously in the hook, together with B-28) |
| **B-28** | The em dash carries two opposite meanings on one screen — `—` for "no value" and `—` for "refused" | **21** |
| **B-29** | Art. 68^3 forfetar cazare is not modelled; the refusal channel exists but **no caller supplies the activity-family fact**. Scope is wider than first recorded — `research/30` §5: art. 68^3 is **new from 01-01-2026** (Legea 239/2025 art. XII pct. 5), it is a **30 % flat-expense ratio with 10 % tax (effective 7 % of gross)**, it reaches private landlords **above 7 rented rooms** via art. 83 alin. (4), and art. 85 moved 1-7 rooms onto the same 30 % ratio. It is neither sistem real nor norma de venit | **12E** |
| **B-30** | The deductible expense is net of *actually deductible* VAT, not of all VAT on the invoice — `tax.ts:144` picks `expensesNet` whenever the profile is not `vatExempt`, which assumes every leu of input VAT is recoverable | **13** |
| ~~B-66~~ | **CLOSED 2026-10-10 (PG-2, `700bd2a`).** `buildRjipRegister` now posts and filters the year on the money date via `revenueFiscalDate`/`expenseFiscalDate`, sorts by it, keeps the document as the `Descriere` cross-reference OMFP 170/2015 cap. V asks for, and states how many rows rest on the document-date fallback. The 4-column BOM/semicolon shape is unchanged, so the byte-level export test passes unmodified. **The RJIP export posts on the document date and ignores `collected`/`paid` entirely — so the register the tax office reads is wrong whenever money moved in a different month or year.** `src/pages/Documents.tsx`: `ReportsTab` filters with `r.date.slice(0,4) === String(year)` and sets `data: r.date` for revenues (`:456-466`) and `e.date` for expenses (`:470-478`); the year list is built from `Number(r.date.slice(0,4))` / `Number(e.date.slice(0,4))` (`:448-449`); `rjipCsv` writes `r.data` into the register (`:436`). **`collected` and `paid` are never read anywhere in this path.** But **OMFP 170/2015 cap. V, Secțiunea a 2-a** makes the money date the register's **mandatory** date column — „fiecare operațiune economico-financiară se va înregistra în ordine cronologică, **în funcție de data efectuării operațiunii de încasare/plată**”, and the „**Conținutul minimal obligatoriu**” is „**data efectuării operațiunii de încasare/plată**” followed by „denumirea și numărul documentului justificativ” as a **separate** column. **The app already stores the right field and the engine already uses it — only the export and the year filter do not.** Adjacent to **B-61**, which misnames the same artefact | **PG-12** / 26, 27 |
| **B-68** | **A ledger whose only records are foreign-currency rendered the onboarding empty state — the record vanished from the financial picture entirely, disclosure included.** Found and fixed during Phase 10c: `src/pages/Dashboard.tsx` gated the whole dashboard on `pfaRevenue > 0`, and `pfaRevenue` is a **lei** total, so a foreign-only ledger scored 0 and the user was shown „start from scratch" while holding real data. This is B-37's skip reaching the page shell rather than the numbers — **a disclosed skip is only honest if the surface still renders.** Fixed by widening the gate to `hasData` (a record the totals leave out is still data), with two tests in `pages/Dashboard.test.tsx`. **The general lesson for PG-1 and PG-3: every empty-state gate must be tested against a ledger that is present but excluded, not only against a ledger that is absent** | **closed in 10c** |
| **B-67** | **D-DATE-1's document-date stand-in has no legal footing, and nothing in the app says so.** For Titlul IV the document date is a **validity condition** (art. 68 alin. (4) lit. a) „justificate prin documente”), **never the year-determining fact** — the year comes from art. 68 alin. (2) lit. a) „sumele încasate” and alin. (4) lit. b) „al anului în cursul căruia au fost plătite”. **No provision presumes document date = money date, and none fills in a blank money date.** The stand-in is safe only because a record with no money movement is fiscally inert. **The existing note („completează acest câmp dacă ai încasat plata într-un an fiscal diferit de cel al facturii”) is safe as written and needs no change** — what must not happen is any UI text presenting the default as „conform Codului fiscal”. **Strongest provision on our side: CPF art. 109 alin. (7) „Organul fiscal poate lua în considerare orice evidențe relevante pentru impozitare ținute de contribuabil/plătitor”** — that is what makes an app-recorded payment date usable evidence | **PG-2**, 26 |
| **B-72** | **`estimateBasis.ts` still renders the „N din 12 luni scurse” note while the projection now runs over the PFA's active period.** N is clamped at 12, so it can no longer overstate the count, but for a mid-year starter the „din 12” half describes the **calendar** year while the figure beside it is computed over `activeMonths`. The sentence and the arithmetic disagree. Fixing it needs `estimateBasis.ts`, which was outside PG-4's boundary | **PG-5** |
| **B-73** | **The year-advance banner is mounted on the dashboard only, so the automatic advance fires only on the first dashboard open of the new year.** A user who lands on Revenues or Expenses on 2 January sees the previous year's register until they open the dashboard. The advance itself is correct and persisted; only its trigger is narrow | **PG-5** |
| **B-71** | **The weighted-coverage denominator keys revenue on the DOCUMENT date but expenses on the MONEY date — so the percentage and the estimate disagree about the same record.** `src/domain/completeness.ts:247` filters revenues with `inPeriod(r.date, asOf, fiscalYear)` while `:252` filters expenses with `inPeriod(expenseFiscalDate(e), …)`. PG-1's handoff claimed the denominator "follows automatically" — **true for expenses only.** Before PG-2 this was latent, because nothing could write `collected`; **now that `collected` is writable it is live**: a revenue documented 20 Dec 2026 and collected 10 Jan 2027 stays in the **2026** weighted-coverage denominator while the estimate correctly excludes it from 2026. **Fix is one call — use `revenueFiscalDate(r)` — but it moves PG-1's published completeness figures, so the before/after must be restated, not silently re-baselined.** Also folded here: `Settings.tsx:372` builds a bank-account id with `Date.now()` when `epochMs()` exists, and two label maps spell the same three words (`insights.ts` `FISCAL_DATE_FIELD_LABEL` vs `copy/records.ts` `fiscalDateSource`) — same vocabulary, foldable | **PG-4** |
| ~~B-70~~ | **CLOSED 2026-10-10 (PG-2, `700bd2a`).** `Documents.tsx` no longer carries an `isRon` filter or a `foreignCount` memo — it reads `getLedgerDisclosure`. **Behaviour change accepted:** a foreign record with a recorded BNR rate now enters the leu register at its converted lei amount; the old code filtered on both amounts but counted only `valoareFaraTva`, so a lei-net/foreign-VAT record was dropped *and uncounted*. **Two surfaces answer "what is foreign and unconvertible?" or "what is deductible?" by re-deriving it themselves instead of reading the shared pass — so they will drift the moment either side changes.** Found by PG-1, correctly left outside its boundary. (a) `src/pages/Documents.tsx` runs its own `isRon` filter plus a separate `foreignCount` memo instead of reading `getLedgerDisclosure` — **the one place in the app that answers the FX question without the disclosure Phase 10c built**, and it sits in the same file as **B-66** (the RJIP export posting on the document date), so the two should be fixed together. (b) `src/pages/Expenses.tsx` recomputes `selectDeductibleExpenses` / `selectEstimateOperands` separately from the dashboard. **PG-1 Decision 2 is the pattern to follow: assemble once in `buildDashboardData` and let surfaces read it.** Also recorded here: **B-68's residual is closed** — PG-1 checked every other page and **no page other than the dashboard carries the B-68 shape** (Expenses/Revenues gate on status-tab-filtered arrays; Documents has no RJIP empty-state gate) | **PG-2** / 26, 27 |
| **B-69** | **The dashboard's secondary text failed axe `color-contrast` (serious) on 6 nodes, and the app renders no `<main>` landmark anywhere in `src/`.** Found by the PG-0 axe gate on 2026-10-10, not by anyone noticing. Two design tokens at `styles.css:9-10`: `--text-4: #98a2b3` measured **2.57:1** on `#ffffff` and `--text-3: #667085` measured **4.43:1** on `--bg #f0f2f5`, against a 4.5:1 floor — `.stat-card .hint`, `.hint`, `.muted` and a `<strong>` inside a hint. **PG-0 raised them to `--text-3: #5b6472` / `--text-4: #646d7a`, and that is a contrast FLOOR, not a palette decision**: it compresses the four-step text ladder (`--text #1d2939` → `--text-2 #475467` → `--text-3` → `--text-4`), the tokens are shared **app-wide** (31 use sites across `styles.css`, `components.css`, `pages/Documents.tsx`, `pages/Settings.tsx`), and `--text-3` doubles as a **border** colour (`.btn-outline:hover`, `.chart-legend-swatch.projection`), so darkening it moves a rule line too. **Separately and deliberately NOT fixed: there is no `<main>` landmark anywhere in `src/`** — grep finds no `<main>`; axe reports `landmark-one-main` and `region`, both **moderate**, and PG-0 gates only `serious`/`critical`. A missing landmark is a structural finding someone should fix on purpose, not discover by accident | **PG-12** / **28** — the proper contrast and colour-coding pass, including the **non-colour** actual-vs-projected cue the graph still lacks |
| **B-31** | No asset or depreciation model, so a capital purchase is deducted as an ordinary expense. **`research/36` §1-4 now gives the shape, so this is a build gap, not a knowledge gap:** the purchase is excluded by art. 68 alin. (7) lit. h) **scoped to „din Registrul-inventar”**; depreciation is deductible via norm **pct. 7 alin. (5) lit. n)** „în conformitate cu prevederile art. 28 … după caz”; the **5.000-lei** test (OUG 8/2026 art. 6 pct. 7, MO 147/25.02.2026) is a **classification** test at „data intrării în patrimoniul contribuabilului”, **not at payment**, and per **art. 10 alin. (2)** it governs **all of FY2026 including ianuarie-februarie purchases**; sub-threshold is an **option** to depreciate (art. 28 alin. (21)), not an automatic direct expense; depreciation **starts the month after punerea în funcțiune** (art. 28 alin. (12) lit. a) with **no pro-rating formula**); and **depreciation is exempt from the 50 % vehicle limit** — norm pct. 7 alin. (7) says so expressly, art. 28's own caps apply instead. **`research/36` §8-15 closes the rest: office IT is Catalog subgrupa 2.2, clasa 2.2.9, 2-4 ani, so a 2026 laptop is NOT eligible for the 65 % super-accelerated method (gated on subgrupa 2.1/2.4) but IS eligible for the 50 % accelerated method — art. 28 alin. (5) lit. b) is scoped by asset type while alin. (8^1) is scoped by Catalog subgrupa, and one rule must not feed the other; norm pct. 31 makes the sub-threshold election under alin. (21) at data intrării în patrimoniu and times even the full-expensing branch at punerea în funcțiune, so the engine needs a per-asset election flag; there is no pro-rating formula anywhere and „punerea în funcțiune” is undefined in fiscal law (the proces-verbal de dare în folosință is practitioner doctrine only); and Titlul II norm pct. 28 lit. b) is the first affirmative VAT-in-expense rule ever found here — „în valoarea fiscală a mijloacelor fixe, la data intrării în patrimoniu, se include și taxa pe valoarea adăugată devenită nedeductibilă” — scoped to the depreciable base, which does not reopen Q-NONDEDUCT-VAT for ordinary expenses** | **12G** |
| **B-65** | **The 1.500-lei/lună depreciation cap for M1 passenger vehicles is absent from the codebase entirely — no rule, no constant, no test.** **CF art. 28 alin. (14)**: for M1 vehicles (≤ 9 seats incl. driver, RNTR 2 / OMMLTL 211/2003) „cheltuielile cu amortizarea sunt deductibile, pentru fiecare, **în limita a 1.500 lei/lună**”, with four exception categories (urgency/guarding/courier; sales & purchasing agents incl. test-drive; paid passenger transport incl. taxi; paid services incl. rental and driving schools). It reaches a PFA because art. 68 alin. (4) lit. d) borrows art. 28, and **norm pct. 7 alin. (7) makes it the *only* cap on vehicle depreciation** — the 50 % mixed-use limit expressly does not apply to amortizare. Titlul II norm pct. 27 extends it at disposal: „valoarea rămasă neamortizată este deductibilă în limita a 1.500 lei înmulțită cu numărul de luni rămase de amortizat” — and **the remaining-months count uses the duration the taxpayer chose** from the Catalog range. **Mechanics now known (`research/36` §12): the Titlul II norms for art. 28 are pct. 25-31, not 26-33; `M1` occurs exactly once in the whole 624-page Partea I (pct. 27), and the norms say nothing about how the four exception categories are evidenced** — the only evidencing requirement in the Titlul IV norms is the **foaie de parcurs** for the 50 % rule. **The two vehicle lists differ and must not be blurred: art. 28 alin. (14) has FOUR exceptions (incl. „test drive și pentru demonstrații”), while art. 68 alin. (7) lit. k) has FIVE (incl. „vehiculele utilizate ca mărfuri în scop comercial”, no test-drive wording) and closes „Cheltuielile care intră sub incidența acestor prevederi nu includ cheltuielile privind amortizarea”.** The excess over 1.500 lei/lună is definitively lost — **no statutory text says so**; it follows from the cap being a deduction limit, not a timing rule. **A second cap is also missing: art. 28 alin. (12) lit. i1) — a head office not used exclusively for the activity, in a residential building and registered in the taxpayer's patrimony, depreciates at 50 %; the norms are silent on it (`lit. i1)` and `sediu social` both score 0 hits in 624 pages)** | **12G** |
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
| **Q-ROLLOVER-FIXED-DATE** | **Open as authority, settled as practice, and now settled per-obligation by ANAF's own product** — `research/28`, `research/29`. ANAF's Calendarul obligatiilor fiscale 2026 publishes the 25-octombrie block as **26 octombrie** and the D398/D396 dates as **31 octombrie, expressly not rolled**. No instrument, MF order or ICCJ decision states the authority; no RIL exists; OUG 7/2017 → Legea 76/2017 shows the state legislating when it needed to move a fixed „25" date. Adopted position: the statutory date stays operative, the rolled date is surfaced as labelled information. ANAF rolls fixed dates (DU 2024, DU 2025 centrally, F205 2026) and once stated the rule generically, but **no instrument, MF order or ÎCCJ decision states the authority** and no RIL exists on the point. Adopted position: the statutory date stays operative; the rolled date is surfaced as labelled information with the earlier safe action named | **Blocks any working-day primitive** in 18B, 24, 32. **First live case: 25 octombrie 2026 is a Sunday and ANAF has said nothing about it** |
| **Q-ART174-ALIN7-ATTRIBUTION** | **CLOSED — `research/29` §6. It is Legea 141/2025, art. II pct. 34 si 35** (MO 699/25.07.2025, PL 300022), applicability via art. VII alin. (1) lit. f) as amended by OUG 22/2025 art. VI (MO 806/29.08.2025). `research/27` was right; the Legea 239/2025 inference in `research/28` was wrong — that act amends the CF through **art. XII**, not art. II, and covers different alineate. Corroborated by ANAF Brasov's comparator `sanatate_2025.pdf`, which numbers the same change pct. 34. **Do not cite Legea 239/2025 for art. 174 alin. (7)-(8).** Original framing:  `research/27` §8 attributes the art. 174 alin. (7) lit. c) and alin. (8) lit. a) changes to **Legea 141/2025 art. II pct. 34–35**, quoting the amending clauses and the applicability line verbatim from PL 300022. `research/28` §6 infers **Legea 239/2025** from a county comparator table. **`research/27` is the better-evidenced of the two.** Recorded rather than silently reconciled | PG-9 rule provenance: the citation on the rule record must be the one with the quoted clause |
| **Q-WORKING-DAY-DEF** | Closed — Reg. 1182/71 art. 2 alin. (2): Saturday is **not** a working day | Only where a term is expressed în zile lucrătoare |
| **Q-ANAF-SAMBITA** | Authority gap, not knowledge gap — no ANAF instrument states how the current 5-working-day term is counted | Do not present a counting method as settled |
| **Q-PENDING-B4-2026**, **Q-PENDING-10MAI** | Pending bills, **not law**. **Both rows corrected 2026-10-10 by `research/32` P6** — our register had cited aviz **26L141LG** against the PFA bill when that aviz belongs to **L141/2026**, an unrelated local-tax bill. The PFA bill is **Bp. 332/2026 → L439/2026**, CL aviz **598/19.06.2026**, **RESPINS la Senat 23.09.2026**, now at the decizional Cameră with a Guvern punct de vedere (1 octombrie 2026). **L334/2026** (10 mai) is confirmed **RESPINS la Senat**, CL **favorabil**, CES **nefavorabil**, pending at Camera; would take the holiday set **17 → 18** | Never encode; recorded so "no pending change" is never claimed |
| **Q-RESEARCHER-WRITE** | The `researcher` agent has **no file-write tool** | **Every Researcher report must be transcribed to `docs/ai/research/NN_*.md` by the Orchestrator before anything else is done**, or it is lost on compaction |
| **Q-METHOD-NOTECOUNTS** | Portal Legislativ publishes no note count | Doc id + consolidation date are the anchor; never a count |
| **Q-ACTIVITY-MAPPING** | **CLOSED as a negative — `research/30` §3.** There is **no CAEN-to-method mapping in law to build.** OMFP 925/2017 art. 2 alin. (4), as rewritten by OMFP 1.960/2025: the DGRFP set norms for each position „astfel cum sunt prevăzute în **coloana 2** din anexă, **independent de codurile CAEN menționate cu titlu exemplificativ**". Inferring the determination method from a CAEN code would invent a rule the order itself disclaims | **12E cannot be closed by a mapping table.** The determination method must be a **user-declared fact**, or the app refuses. Closes **L-2** |
| **Q-NORMA-GATE** | **ANSWERED, and feasibility audited — `research/30`, `research/31`.** The 2026 amounts exist and are official, but not where the plan assumed: the MF order (OMFP 925/2017 + 5.308/2023 + **1.960/2025**, MO 1215/30.12.2025, annex **128 positions**) approves **only the nomenclator, with no amounts**. The levels are set by **42 county DGRFP/AJFP decisions** indexed by ANAF, **not MO-published**, at județ x poziție x categorie de localitate with **1 to 18 value columns**. Floor 12 x SM = **48.600 lei**. **34/42 readable, 7 scans, 1 corrupt; coefficients deficient in 12; position numbering diverges in the 7 Ploiești counties (legacy OMFP 2.875/2011, 129 rows).** Pinned: **OG 16/2022 = MO 716/15.07.2022, PL 257589**; **OMADR 386/2025 = MO 1072/21.11.2025** | **12H**. Cost is now known — **D-NORMA-2** is the open decision, not research |
| **Q-NORME-PRORAT** | **Resolved on the published evidence, not formally closed.** The Titlul V norms (HG 1/2016) still contain the prorating paragraphs at pct. 8 alin. (4) and pct. 16 alin. (4); **no act has repealed them** — HG 602/2025, HG 39/2026 and HG 184/2026 are TVA/accize only. But ANAF's current D212 instructions (OpANAF 2736/2025, MO 1207 bis/29.12.2025, pct. 42.1–42.4) and the 2026 DU brochure apply the **unprorated** code rule. See `research/27` §7–§10 | **PG-4 computes on the code and must not claim proration was abolished.** REVIEW_REQUIRED only where prorated and unprorated results differ: mid-year starter whose cumulative income falls between the two thresholds. The CASS norm prorates art. 170 alin. (2) (lit. c)–h)), **not** the PFA base — for a PFA it is not even on point |
| **Q-OUG156-ART174** | **CLOSED — `research/28` §6.** OUG 156/2024 (MO 1334/31.12.2024, PL 293109; Rectificare MO 12/10.01.2025, PL 293232) does **not** amend CF art. 174: art. LXIV's 19 puncte contain **no occurrence of „174" at all** in the published MO text | Remove any logic keyed to „art. 174 + OUG 156/2024". The alin. (7)–(8) changes come from a later act — see **Q-ART174-ALIN7-ATTRIBUTION** |
| **Q-NORMS-DATE** | Which HG last rewrote the Titlul V norms is not pinned (candidates HG 354/2018, HG 435/2018, HG 874/2018); the norm text is 2018-vintage | Only needed if PG-9 wants a "norms date" field on the rule record |

---

## 5. Order

Phases in **bold** are new, inserted by the audit. The rest keep the user's numbering.

| # | Phase | Status | Closes |
|---|---|---|---|
| **10c** | **FX end to end: rate ingress and one normalised-ledger boundary** | **DONE** (2026-10-10, `phases/26_fx_end_to_end.md`) | B-36, B-37 |
| 11 | Coherent 2026 seed state + first-run separation | **DONE** (2026-10-10, `phases/28_phase11_first_run.md`) | B-47, D1 |
| 12 | Run-rate projection over the **active period** | partial | B-44 |
| 12A | Expense deductibility model | **DONE** (TASK 2a–2d) — gap-check only | — |
| 12B | Pension fact for CASS | **DONE** (TASK 5) — gap-check only | — |
| **12C** | **Payment / collection dates enterable, and date defaults** | not started | B-38, B-46 |
| **12D** | **Per-expense facts the classifier needs** | not started | B-39 |
| **12E** | **Activity family wired to the estimate, or explicit refusal** | not started | B-29 |
| **12F** | **Other income: model the amounts or refuse** | not started | B-41 |
| **12G** | **Fixed assets and depreciation boundary** | not started | B-31 |
| **12H** | **Normă de venit — gate and feasibility both answered** | audited 2026-10-10 (`research/30`, `research/31`); **awaits D-NORMA-2**, not research | D-NORMA-1, D-NORMA-2 |
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

### 10c — FX end to end *(new)* — **DONE 2026-10-10**, see `phases/26_fx_end_to_end.md`
- **Rate ingress through the UI.** A manual rate-entry workflow using the existing validated `recordFxRate` upsert keyed by `rateKey`: currency, rate, `rateKind`, date or year, source URL, provisional/final. Settings' FX block stops being read-only.
- **One normalised-ledger boundary.** Summary, graph and estimate consume the same converted records, or the UI states precisely why they differ. A record must not vanish from the financial picture because its currency is foreign (B-37).
- Prove: an EUR record with a rate reconciles across summary, graph and estimate; the same record without a rate cannot make the result look complete.
- Do not add a network path; manual/store ingress only, as 10b left it.

### 11 — Coherent 2026 seed + first-run separation *(**DONE 2026-10-10**, see `phases/28_phase11_first_run.md`)*

**Closed as written, with the two §9 blockers resolved by the user (decisions 4 and 5).** Empty storage now
yields `emptyData()` with `dataOrigin: 'empty'`; `'seed'` is deleted from the union and the demo is a distinct
`'sandbox'` origin that the save effect refuses to write. `pages/Onboarding.tsx` collects the facts the engine
reads and refuses the regimes the engine cannot compute, with **no figure on the refusal screen**. **No
migration step and no data-version bump** — backfilling `pfaStartDate` from `pfaStartYear` would mint a
registration date nobody recorded. Proven in **Playwright**, per acceptance 1: `e2e/first-run.spec.ts`, and
proven to bite by reverting the one-line loader change.

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

### 12H — Normă de venit *(gate and feasibility both answered — `research/30`, `research/31`)*
**Feasibility is answered: buildable semi-automatically, with a manual tail.** `research/31` audited all 42 county PDFs: **34 have a clean text layer, 7 are image-only scans** (Botoșani, Caraș-Severin, Hunedoara, Neamț, Suceava, Timiș, Vaslui) **and 1 has a corrupt one** (Bacău — 53k chars of OCR noise, zero amounts recoverable). Cost: ~1,000-1,300 lei figures to OCR or transcribe for the 8, plus ~300 coefficient rules for the 12 counties with deficient coefficients, plus a hand-built locality taxonomy (34 header sets, 1-18 columns each).
- **The binding constraint is the coefficients, not the amounts.** The 10 % tax is levied on the **adjusted** norm (art. 69^2 alin. (1)), and **12 of 42 counties** cannot derive it automatically: 1 publishes them under another name (Iași, „Corectivele de reducere”), 3 use bare percentages without the statutory label (Arad, București, Ilfov), 1 has none in the text layer at all (Brăila), and 8 are unreadable. Criteria vocabulary and the **stacking rule** vary by county — most take the largest coefficient; Dâmbovița applies majorare first, then reducere.
- **Position numbering is NOT nationally stable, and the cause is identified.** 35 counties match OMFP 1.960/2025 exactly (1-128). The **7 DGRFP Ploiești counties run a 129-row legacy numbering** keyed to **OMFP 2.875/2011**, with `Închiriere de camere în scop turistic` inserted at 51, shifting everything from 51 by +1. **Key the dataset on (județ, coloana-2 activity description), never on `Nr. crt.`** — a position-keyed load would have silently mis-paired amounts against activity names in seven counties.
- **Provenance limit:** a numbered decision with a date is machine-extractable for only **13 of 42 counties**; for 21 there is no act number or date anywhere in the text layer. **A citation-per-row model cannot cite what cannot be read** — so the rule record needs an explicit `actIdentifier: unavailable` state rather than a fabricated reference.
- **The official ANAF index is broken (FACT):** all 7 Ploiești links 404; the acts are live under `static.anaf.ro/static/10/Ploiesti/`. An automated harvest of the index alone would silently lose seven counties.
- **What is already verified and must not be re-researched:** CF art. 122 alin. (2) last sentence prorates the *normă* only — „ajustează norma anuală de venit prin reducerea acesteia proporțional cu perioada în care nu au desfășurat activitate" — and **that adjustment must never be generalised to system-real income**. Art. 68 / 68¹ / 68³ / 69 are the alternative determination systems; art. 148 alin. (3) and art. 170 alin. (1) cumulate „normele anuale de venit" alongside net income.
- **This is now a data-engineering phase with a manual tail, not a legal phase.** Acceptance criteria stay unwritten until **D-NORMA-2** is answered, because the cost is now known and the owner has not yet seen it.
- **What the gate answer already fixes:** the citation model is **per county decision** (e.g. Constanța Decizia 1197/31.12.2025, Cluj Decizia 1992/31.12.2025), with the ANAF index URL as source of record — never a Monitorul Oficial reference that does not exist.
- **The regime is mandatory, not elected.** It applies automatically when the activity matches a **coloana 2** position and is not a profesie liberală; exit is forced by prior-year gross over 25.000 euro (alin. (9)) or any second non-nomenclator activity (alin. (7)). There is **no optare form** — the DU is the vehicle, and the art. 69^1 sistem-real option is binding for **2 consecutive years**.
- **The calculation is a different shape, not a variant:** tax = **10 % x norma ajustată, impozitul fiind final**; **no expense is deductible at all**; CAS uses the norm only as a **threshold proxy** (art. 148 alin. (3)) while CASS uses it as the **base**, capped at 72 SM (art. 170 alin. (1)). The app's whole expense model is inapplicable on this path.
- **Deliberately still has no acceptance criteria.** Writing them before the feasibility audit is how a phase gets built on numbers nobody can cite.
- **D-NORMA-1** decided the *what*: support normă de venit before launch rather than refuse it silently. The *when* waits on the norm-table research.
- **The gate question:** can the 2026 normă de venit amounts be obtained from a primary source — an approved HG or an ANAF order published in Monitorul Oficial — at a per-activity-code level the app can actually store? If yes, 12H becomes a normal phase with a citation per code. If no, **the phase collapses**: the app refuses the regime explicitly, and that refusal is the deliverable.
- **What is already verified and must not be re-researched:** CF art. 122 alin. (2) last sentence prorates the *normă* only — „ajustează norma anuală de venit prin reducerea acesteia proporțional cu perioada în care nu au desfășurat activitate" — and **that adjustment must never be generalised to system-real income**. Art. 68 / 68¹ / 68³ / 69 are the alternative determination systems; art. 148 alin. (3) and art. 170 alin. (1) cumulate „normele anuale de venit" alongside net income.
- **Why it cannot be deferred indefinitely:** a normă-de-venit PFA is a profile the app currently accepts and then computes wrongly, because sistem real is the only path implemented. That is a silent wrong, not a refusal.

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

---

## 12. Standing operating rules — these are what make the sequence hold

Adopted 2026-10-10 at the user's request, after the audit round produced rework in exactly the places these rules would have prevented.

### 12.1 Research gate — no PG task starts with an open scout on its own subject
A task whose legal basis is unresolved will be written twice. **PG-4** (projection, mid-year start, year lifecycle) and **PG-6** (unsupported scenarios, L-2…L-7) are the two exposed to this, and PG-4 is the one with a real date attached. Concretely: a PG task may not be briefed while a scout is open on a question its acceptance criteria depend on. If the scout is open, brief the scout.

### 12.2 PG-0 is a hard prerequisite for any date-dependent acceptance criterion
Several acceptance tests in `briefs/28` are meaningless without the fixed clock — "2026-12-31, 2027-01-15 and 2027-05-26 give an identical estimate" cannot be asserted while the suite reads the wall clock. **No task with a date in its acceptance may be briefed before PG-0 lands.** Same for the UTC-default fix (B-46): a date test written before that passes for the wrong reason.

### 12.3 A finding gets a defect id before it gets a task
Every new claim about the code becomes a row in §4 (or is marked as a duplicate of an existing id) **before** anyone is briefed on it. This is not bureaucracy: **B-40 and B-42 were minted as new defects and turned out to be B-29 and B-31, already open since research 21.** Minting first and checking later produces two briefs for one bug. Reviewer reports get the same treatment — verify in-tree, then mint, and record a claim that does not reproduce as *not a defect* so it is never re-raised.

### 12.4 The year boundary is a standing task, not a phase
Phases model sequence; the 2027 rule package has a **trigger**, not a position. **Standing task:** the moment the 2027 minimum-wage act and the 2027 budget/finance act are published, stage the 2027 rule package — rates carried forward with a last-verified stamp, wage-dependent thresholds recomputed, BNR averages left provisional. Per **D-YEAR-2** the app carries forward and updates when the datum arrives; per **D-YEAR-1** the year toggle and the banner handle what the app cannot yet compute. Whoever is briefing anything checks this task first: the first hard date boundary is roughly twelve weeks out.

### 12.5 Researcher reports: transcribe first, then act — and a truncated report is resumed, not guessed at
- The `researcher` profile has **no write tool** (**Q-RESEARCHER-WRITE**). A report exists only once the Orchestrator has written it to `docs/ai/research/NN_*.md`. **Transcribe before anything else**, including before acting on the report.
- If a report arrives **truncated**, that means the researcher compacted. Resume the same session and ask it to **re-verify the missing part from sources, not from memory**, then produce the report. Never fill the gap from what the Orchestrator assumes.
- If a report leaves work unfinished, **spawn a different researcher** for the remainder rather than extending one session past its usefulness.
- A researcher's UNVERIFIED label is checked against the `STATE.md` register before it becomes a new open question.

### 12.6 One Worker at a time; scouts sequential
Unchanged and not negotiable: implementation Workers run sequentially, one engine slot, and scouts stay sequential (**C5**, resolved by the user). Two Workers have already been SIGKILLed mid-run; the headroom is roughly 390 MiB.

### 12.7 The release gate is a living document
**`docs/ai/PG13_GO_NO_GO.md`** accumulates from PG-0 onward rather than being re-derived at the end: every acceptance criterion that passed, every defect still open, every REVIEW_REQUIRED that a user could trip, every decision PG-13 needs. A gate written in the last week of a project is a gate that finds nothing.

### 12.8 Verify every premise against the register before a brief goes out — **user decision, 2026-10-10**
**Three researchers in a row corrected a premise written into their own brief:** R-E (art. 61 has **ten** letters, not eight; art. 155 alin. (1) runs a)-m) and is the **CASS** list — CAS is art. 137 alin. (1)); R-D (protocol is **2 %** under art. 68 alin. (5) lit. b), not 50 %; **art. 297 alin. (1)** is „Dreptul de deducere ia naștere la momentul exigibilității taxei”, not a registration gate; **art. 311** is the travel-agent regime, not regularizare); and R-C corrected six items in its own lost draft. In two of those cases **the code was already right and only the brief was wrong** — `EXPENSE_PROTOCOL_2026` states the 2 % cap and expressly says the corporate art. 25 caps are not this regime, and `VAT_REGISTRATION_DEADLINE_2026` already encodes „cel târziu la data depășirii plafonului” with `offset_days: 0`.

**The rule:** before a brief is sent, every stated fact in it is checked against `STATE.md` and `PHASE_PLAN_11_34.md`, and each one carries its source. A premise handed to a researcher that is stale does more damage than no premise, because the researcher builds on it and the error leaves the building wearing a citation.

**A fourth premise of mine that did not reproduce (2026-10-10, brief 31).** I wrote that `caen` and `pensionStatus` are fields the engine reads. **Neither reaches any calculator** — `pensionStatus` has no reader anywhere (renamed in TASK 5 and policed by the `pensionFacts.test.ts` source scan), and `caen` was deprecated into `identity.caen` in Phase 7. The Worker recorded the discrepancy and **changed nothing on the strength of my wording**, which is the correct response. **The register's own deprecation notes were right; my summary of them was not.**

**What this does not mean:** briefs are **not** split into one question each — the user kept bundled briefs deliberately. Bundling is fine; unverified premises are not. The overlap that bundling creates is acceptable **when the shared ground is stated in the brief** so the researcher knows what has already been answered and does not re-derive it.

**Two consolidation traps, both of which cost real time on 2026-10-10.** A consolidated source is not a witness to the amendment history:
1. **A modification note beneath an article is not the article text.** We recorded the D392 suspension as sitting in **CF art. 324 alin. (6)**; it does not — alin. (6) is the international bus-ticket notification, and the suspension is a note from **OUG 115/2023 art. LXII** attached under the article.
2. **A consolidated page can lag the amending law and state the opposite of current law.** The Portal Legislativ consolidated **OUG 120/2021** page still shows **art. 10¹⁰** in its pre-**Legea 88/2026** form — an *enrolment obligation* — when current law makes the same article a *relief*. **This is almost certainly why two sessions of the same researcher contradicted each other and one retracted its own finding**: the first read the amending law, the second re-read the consolidation. **When a finding turns on a recent amendment, cite the amending act and its in-force provision, never the consolidation.**

### 12.9 Every Worker brief must tell the Worker to dispatch its own scouts — **user decision, 2026-10-10**
**The capability was already there and I never used it.** `~/.pi/agent/agents/worker.md` declares `subagent_agents: scout, researcher` and carries a whole section on it — *"Your context is finite. Reading large or unfamiliar codebases directly will burn it before you can edit anything"*, *"A good rhythm: **scout to find, read to edit**"*, and *"If you need two independent investigations … emit multiple `subagent` tool calls in the same turn — they run in parallel automatically."* **Brief 29 (Phase 10c) said nothing about it**, so that Worker grepped and read the FX layer itself and spent its own context on territory it only needed a map of.

**The rule:** every Worker brief carries a **SCOUT DISPATCH** section stating, explicitly:
1. **Dispatch scouts up front**, before reading, for the territory the Worker will **not** edit — callers and dependents of the symbols it is about to change, the blast radius, the files it is **forbidden** to touch (so it learns the boundary without reading the file), and any unfamiliar subsystem.
2. **Dispatch again mid-task** when it reaches a subsystem the brief could not predict.
3. **Never scout a file it is going to edit.** A scout returns a summary, not verbatim source, and the Worker must re-read the 1–3 files it actually edits regardless — so scouting those is pure waste. This is the failure mode the user named: *"Not scout files they are going to edit regardless."*
4. **Scouts run SEQUENTIALLY — one at a time, waiting for each report.** This **overrides** the upstream guidance in `worker.md`, which says independent investigations should be emitted as multiple `subagent` calls in one turn so they run in parallel. **That permission is not adopted in this project** — see §12.6, which the user resolved as **C5**: one engine slot, roughly 390 MiB of headroom, and two Workers already SIGKILLed mid-run. **I violated this on 2026-10-10 by writing item 4 as "in the same turn, in parallel" while §12.6 sat eleven lines above it.**

5. **The Worker does NO work while a Scout is running — no side-quests, no parallel reading, no searching, no drafting.** After dispatching, it **stops and ends the turn**, then acts on the report. **Added as a user decision on 2026-10-10 because Workers do not appear to grasp this part.** The failure mode: the Worker dispatches a Scout and keeps working anyway, so the report lands after it has already searched the repository itself — the Scout is wasted, the Worker's context is burned, and §12.9's whole purpose is defeated. **This is the same rule the user enforces on the Orchestrator for Workers (§12.6), applied one level down.**

**How this rule actually failed, recorded honestly:** the contract block above — *"The Worker MUST spawn the Scouts it needs before modifying anything, and MUST use their reports rather than broadly searching the repository itself"* and *"OVERRIDE — Scouts run SEQUENTIALLY"* — is **boilerplate I copy verbatim from brief to brief**. I pasted it into brief 30 without reading it, then wrote a SCOUT DISPATCH section further down the same file that contradicted it. **Read the block you paste.**

**Why it is a standing rule and not a nicety:** the Worker's context is the scarce resource in this project. A scout costs a haiku run; an unscoped read of `domain/fx/` or `pages/Declarations.tsx` costs the Worker the ability to finish.

### 12.10 The Orchestrator never runs the test suite — **user decision, 2026-10-10**
**The Worker runs the tests and reports the counts.** Re-measuring them from the orchestrator is wasted time and context, and it duplicates work already done. Take the counts from the handoff. If independent confirmation is genuinely needed, use a cheap non-test check — `tsc`, `git status`, a targeted `grep` — **not** `npm run test`.

### 12.11 Write a phase doc from the task's own diff, never from memory — **user decision, 2026-10-10**
**Two wordings of this rule were tried and both were rejected, and both rejections are worth keeping.**

1. ~~*"After a compaction, re-read the source."*~~ — **an agent does not know when it compacted.** There is no reliable signal, only a summary block and a hint to use `recall`, and `recall` is itself a source of summaries rather than ground truth. **A rule conditioned on an undetectable event never fires.**
2. ~~*"Before naming a file, identifier, version or line number, open the source and confirm it in the same task."*~~ — technically enforceable but **it manufactures useless work**: the Worker re-opens files it edited minutes ago to "verify" them. **You edited the file; you know it; re-reading it is waste.**

**The rule that actually works — it costs one command you already ran:**
> **Write the phase doc from your own diff, not from memory.** `git diff --stat` and the diff of the task are ground truth and are already in context. **Every file path and identifier named in the doc must appear in that diff**, or in a file actually opened during the task. **If it appears in neither, do not write it.**

**And: do not cite line numbers in phase docs at all.** They rot within a single commit, which is how a document starts lying about code it was written next to. **Cite file + symbol name.** This deletes the class of error instead of checking for it.

**Why the rule exists at all.** A Worker wrote a phase doc from memory and it was fiction: identifiers that do not exist in the tree — `requiresOnboarding`, `demoMode`, `hasAnyRecord`, `enterDemoMode` — and **a migration step that was never added** (`profile-start-date`, data version 10→11), when `CURRENT_DATA_VERSION` never moved. The Worker caught it and rewrote the doc; §4 of `phases/28_phase11_first_run.md` now states plainly that no chain step was added and why.

**Why that is the most dangerous failure mode in this project.** This repository's authority lives in documents — `STATE.md`, `PHASE_PLAN_11_34.md`, `phases/NN_*.md`, `research/NN_*.md` — and later agents are instructed to trust them instead of re-deriving. A doc that reads authoritative while describing code that does not exist does not just mislead the next reader; **it becomes a premise**, and §12.8 will check the next brief against it. A hallucinated migration step is worse than no migration step, because it tells a future Worker that a data-version bump already happened and its payloads are already readable.

### 12.12 A Scout report is unverified input — check it against the tree before it shapes an edit — **2026-10-10, PG-4**

PG-4 surfaced a failure mode none of the earlier rules cover. **Two payloads arrived in the Worker's context before the real Scout reports, and they were not about this repository.** They named `src/components/Breakdown.tsx`, `src/pages/Inspect.tsx` and rule releases `2026-baseline-v1` / `2024-legacy-v1`. **None of those exists in the tree — but all five strings appear in a session log from 2026-10-05.** That is cross-session contamination arriving in the shape of a Scout result, not a model error.

The Worker caught it by doing the thing §12.8 already requires of *briefs*: check the identifiers against the tree. **Nothing from the contaminated payloads reached the code** — verified independently: the PG-4 commit's diff has **zero** hits for those names under `src/`, and the only occurrences are in the phase doc's own incident note.

**The rule:** before a Scout report shapes an edit, **grep every file and identifier it names against the tree.** One command. If it names something absent, the report is not partially wrong — it is **untrusted in full**, and that territory must be re-scouted or covered directly. Do not salvage the plausible half.

**One correction to an existing rationale.** **§12.9's sequential-scout rule no longer rests on the §12.6 memory ceiling.** Scout C exited silently after ~8 s with **no OOM evidence** (~27,6 GiB free of ~30 GiB), while Scout A landed after ~12 minutes. The operative reason for sequential scouts is now **flakiness and silent exit**, not RAM — which matters, because it means "we have more memory now" is not a reason to relax the rule.
