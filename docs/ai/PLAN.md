# SOLO Replica AI Plan

Last synced: 2026-10-05 (**step 01 — real baseline**). HEAD `82073bff72934d1db7a854e5a693554174249785`
on `master`. The step files in `docs/ai/steps/` are the source of truth for history; the
classification of what actually exists is in `docs/ai/steps/01_real_baseline.md`, which supersedes
the 2026-10-02 sync for any claim that conflicts with it. Statuses below were verified against the
repository on the sync date, not taken from the step documents.

## Completed steps (verified)

| Step | Title | File | Status |
|---|---|---|---|
| 01 | Real Baseline (Phase 1) | `01_real_baseline.md` | complete — documentation only |
| 02 | Repository Scout Report | `02_repo_scout.md` | complete — stack claims at `:24` are false (see 01 §2.1) |
| 03 | Dashboard Data Scout | `03_dashboard_data_scout.md` | complete |
| 04 | Defect Verification | `04_defect_scout.md` | complete |
| 07 | Legislation System Specification | `07_legislation_spec.md` | complete |
| 08 | Development Dependencies (Test & Tooling Stack) | `08_stack_setup.md` | complete |
| 10 | PFA/Profile Domain Foundation | `10_profile_domain.md` | complete |
| 11 | Fiscal Rules | `11_fiscal_rules.md` | complete — values superseded (see 01 §6.5) |
| 12 | Calculation Snapshots | `12_calculation_snapshots.md` | complete |
| 13 | Financial Aggregation | `13_financial_aggregation.md` | complete |
| 14 | Derived State (Invalidation/Recomputation) | `14_derived_state.md` | complete |
| 15 | Deterministic Tax Calculation Engine | `15_tax_engine.md` | complete — engine has known gaps (see Known issues) |
| 16 | Threshold & Deadline Engines | `16_thresholds_deadlines.md` | complete — article citations at `:50-54,84` are wrong (see 01 §6.4) |
| 17 | Dashboard Intelligence (non-UI) | `17_dashboard_intelligence.md` | complete — claims `generateInsights`, `CompletenessAssessment.score`, CZK framing, none of which exist |
| 18 | Dashboard Data Layer | `18_dashboard_data_layer.md` | complete |
| 19 | Dashboard Shell | `19_dashboard_shell.md` | complete |
| 20 | Financial Graph | `20_financial_graph.md` | complete (Recharts) |
| 21 | Dashboard Financial Panels | `21_dashboard_financial_panels.md` | complete |
| 22 | Dashboard Action & Intelligence Panels | `22_dashboard_actions.md` | complete (store methods present) |
| 23 | Dashboard Legislation Awareness Surface | `23_dashboard_legislation.md` | complete |
| 24 | Dashboard Polish | `24_dashboard_polish.md` | complete |
| 25 | Regression Fixes | `25_regression_fixes.md` | complete — `updateClient` replaces by id (`store.tsx:185`), unit-tested at `store.edit.test.tsx:39-95`; still no e2e coverage of Clients |
| 26 | Domain Tests (QA) | `26_domain_tests.md` | complete — measured total is **36 test files, 450 unit tests**; the "28 test files, 102 tests" figure appears only in the 2026-10-02 `STATE.md`/`PLAN.md`, not in this step file |
| 27 | State Sync (documentation) | `27_state_sync.md` | complete — superseded by step 01 |
| 27 | Date & Projection Correctness | `27_date_projection.md` | complete |
| 28 | Recalculation & Reserve Honesty | `28_recalculation_and_reserve.md` | complete |
| 29 | Thresholds and Deadlines Domain | `29_thresholds_and_deadlines.md` | complete |
| 30 | Dashboard Insights Correction | `30_insights_correction.md` | complete |
| 31 | Dashboard: Remaining Sections | `31_dashboard_remaining_sections.md` | complete |
| 32 | Dashboard: Final UX Polish | `32_dashboard_polish.md` | complete |
| 33 | Persistence Resilience: Schema Validation, Load Recovery, Write Safety | `33_persistence_resilience.md` | complete — validation and recovery exist; there is still no schema `version` or migration chain |
| 34 | Final Automated Validation & Documentation | `34_final_automated_tests.md` | complete — 23 e2e tests in `e2e/dashboard.spec.ts`; its own counts (36 files / 450 vitest / 23 e2e at `:32,188,235-238`) **match** the 2026-10-05 measurement |

Notes:

- No step files exist for numbers 05, 06, 09; artifacts for those numbers live at
  `docs/ai/research/06_2026_fiscal_research.md` and
  `docs/ai/decisions/09_IMPLEMENTATION_ARCHITECTURE.md`. Step 01 now has a step file
  (`01_real_baseline.md`).
- Steps 12–26 were shipped in a single commit (`952ac07`, 109 files).
- Two step files carry the number 27 (`27_state_sync.md`, `27_date_projection.md`); this is a
  numbering collision in the historical record, left as-is.

## Known issues (verified 2026-10-05)

The full defect register with `file:line` evidence is `docs/ai/steps/01_real_baseline.md` §4
(B-1 … B-12). Summary:

- **The fiscal implementation requires correction before being treated as trustworthy.**
  - The **default** profile regime `impozit_pe_venit` short-circuits the engine to
    `review_required` (`tax.ts:52-54` + `profile.ts:41`) — the default user gets no tax estimate.
    The stated reason, a **30% deductible-expense cap, is a phantom**: no such provision exists in
    Titlul IV (phases/02 §0, §5). Phase 5 is a **deletion**, not an implementation.
  - CAS is a flat clamp, not the SMBT tier rule its parameter labels claim (`calculators.ts:39-58`).
  - CASS returns `reviewRequired` below `min_base` instead of applying the minimum
    (`calculators.ts:67-69`).
  - ~~`progressive_rate: 16` is dead data~~ — **removed in Phase 2**: 16% is legally inapplicable to PFA
    sistem real (CF art. 114 alin. (1), art. 115 alin. (1) lit. b)), not merely unread. The stale
    "16% progressive surcharge" NOTE string in `calcIncomeTax` is still a Phase 5 cleanup.
  - ~~5 of 8 ACTIVE rules carry placeholder provenance~~ — **fixed in Phase 2** (`package2026.ts` now
    carries verified citations; `VAT_THRESHOLD_2026` corrected from art. 338 → art. 310 alin. (1)).
  - `max_cas`, `max_cass`, `multiple_6x/12x/24x/72x` are declared and never read. **Correction from
    Phase 2:** `max_cas` is *not* a statutory cap — CF art. 148 alin. (2) is a tier ladder, so enforcing
    it would under-state CAS above 24 SM (phases/02 §2.1).
  - Fiscal package values are now verified against **`docs/ai/phases/02_fiscal_baseline.md`**,
    which **supersedes** `docs/ai/research/06_2026_fiscal_research.md` (wrong on four points).
- **Identity and persistence defects** (new in step 01): two unreconciled identity stores
  (`App.tsx:221` reads `profile.identity`, `Settings.tsx:50-53` writes `settings.*`); no UI path
  writes the profile (`updateProfile` has no caller); every Settings write is inert downstream;
  corrupt payloads silently reset to seed data; no persisted-schema version.
- Fiscal-loss (prior-year loss deduction) handling absent (`tax.ts:82-88`).
- Stale doc references in the thresholds/deadlines documentation (`steps/16:84-86`).
- Untested pages: `Documents.tsx`, `EFactura.tsx`, `Expenses.tsx`. e2e is Chromium-only
  (`playwright.config.ts` declares no `projects`); `playwright.firefox.config.ts` must be run with
  `--config`.
- Hygiene, not defects: `test-results/` and `playwright-report/` are untracked and absent from
  `.gitignore`; no `*.d.ts` / `src/vite-env.d.ts` despite CSS side-effect imports at `main.tsx:4-5`;
  the `playwright.config.ts:9` "No overload matches this call" diagnostic is LSP-only
  (`tsconfig` `include: ["src"]` excludes root configs) and all 23 specs pass; `react-router-dom`
  is declared but never imported.

## Forward roadmap (Phases 1–10)

Re-scoping of the 10-phase plan against the measured baseline. **No phase is started by step 01;**
this is planning text only. Every phase inherits the policy at `decisions/09:14` and
`research/06:242`: an unverified case returns `REVIEW_REQUIRED`; workers must not invent rules.

**Deliverable filename note (numbering clarity, not a blocker):** 6 of the 9 planned step
deliverables reuse a step number that already exists as a historical file — `02_fiscal_baseline` vs
`02_repo_scout`, `03_cas` vs `03_dashboard_data_scout`, `04_cass` vs `04_defect_scout`,
`07_identity` vs `07_legislation_spec`, `08_amount_semantics` vs `08_stack_setup`, and
`10_money_precision` vs `10_profile_domain`. No file will be overwritten (the suffixes differ), and
there is already precedent for two files sharing a number (`27_state_sync.md` /
`27_date_projection.md`). No historical file is renamed or deleted; the collision is recorded so the
numbering stays readable.

| Phase | Scope after re-scope | Blocked by | Defects addressed |
|---|---|---|---|
| 1 | Real baseline (done) | — | B-7 |
| 2 | Verified 2026 fiscal baseline + replace placeholder provenance on 5 rules (**done** — `docs/ai/phases/02_fiscal_baseline.md`) | — | B-4, B-5 |
| 3 | CAS: flat clamp → SMBT **tier ladder** (`max_cas` is not a statutory cap) | Q-CAS-EXEMPTION (U-5) | B-2, B-6 (CAS half) |
| 4 | CASS: the 6-SM floor is an art. 174 alin. (6) **top-up** (not a review gate, not a substituted base); `min_cass`/`max_cass` **derived** from `rate × base`, not enforced as independent figures | ~~Q-CASS-MINBASE (U-2)~~ closed | B-3, B-6 (CASS half) |
| 5 | Income tax: **delete** the phantom 30% cap; 16% surcharge is not applicable | Q-NONDEDUCT-VAT (U-1) | B-1, B-4 (partly fixed in Phase 2) |
| 6 | Profile-driven fiscal inputs (incl. NORMA_VENIT) | Q-NONDEDUCT-VAT (U-1) | B-9 (partly) |
| 7 | Identity source of truth + persisted-state migration | Q-IDENTITY-SOURCE, Q-PERSISTENCE-VERSION | B-8, B-9, B-10, B-11, B-12 |
| 8 | Financial amount semantics: cash vs VAT vs tax-relevant income; VAT turnover basis | Q-OMFP3254-HISTORY (U-7) — Q-VAT-THRESHOLD and Q-NETGROSS now resolved | — |
| 9 | Date semantics (issued / received / paid) | Q-QUARTERLY-DATES (U-4), Q-122-ATTRIBUTION (U-3) | — |
| 10 | Money representation (integer bani or decimal) | Q-MONEY-UNIT | — |

### Phase 1 — Real baseline

- **Exists today:** this step.
- **Must be created:** nothing.
- **Entry criteria:** none. **Status: complete.**

### Phase 2 — Rule provenance and verification (NOT "add provenance fields") — **COMPLETE 2026-10-05**

- **Deliverable:** `docs/ai/phases/02_fiscal_baseline.md` — the authoritative 2026 fiscal baseline.
  It **supersedes** `docs/ai/research/06_2026_fiscal_research.md`, which was wrong on four points: the
  CAS minimum base (12 SM, not 6), the VAT threshold (395,000 lei for 2026, not 300,000), the phantom
  30% expense cap (does not exist) and the 16% component (inapplicable to PFA sistem real).
- **Q-PROVENANCE-SCHEMA settled:** the code's 17-field `FiscalRule` (`src/domain/fiscal/rules.ts:19-37`,
  including `verifiedAt` and `taxRegime`) is **authoritative**; the archived "10-field" schema at
  `decisions/09:60,168` and `research/06:226` is **superseded**. Do not align the code to it.
- **Done:** verified citations on `CAS_2026`, `CASS_2026`, `INCOME_TAX_2026`, `VAT_THRESHOLD_2026`,
  `PFA_DEADLINE_2026`; `VAT_THRESHOLD_2026` re-cited from art. 338 → **art. 310 alin. (1)**;
  `PROVENANCE_2026.verifiedAt` → `2026-10-05`; `release2026.evidence` expanded to the primary sources
  and `notes` corrected; `progressive_rate: 16` removed; UNVERIFIED gaps left as code comments naming
  the exact gap (U-1…U-7). **No formula, calculator, rule-engine, parameter-value or rule-count change:
  still 8 rules, `version: 1`** (`fiscal.test.ts:9,39`).
- **Invariant to preserve:** `tax.ts:45-47` resolves rules by `taxRegime` with `find()` over the
  `ruleId`-sorted list, so a second ACTIVE `cas`/`cass`/`income-tax` rule silently changes tax results
  without failing any test. **Do not add ACTIVE rules.**
- **Unblocks:** Phases 3 and 4.

### Phase 3 — CAS — **COMPLETE 2026-10-06** (`docs/ai/phases/03_cas.md`)

- **Correction:** this is a real correction, not a verification pass. `calcCas`
  (`calculators.ts:39-58`) is a flat clamp with no tier branching and no exemption branch.
- **Exists today:** `rate`, `min_base`, `max_base`, `min_cas` parameters
  (`package2026.ts:70-74`); tier semantics exist only as label strings (`:71-72`).
- **Must be created:** explicit 12-SM / 24-SMBT branch conditions; the salary/pension exemption
  branch (currently no rule reads `salaryStatus` / `pensionStatus`); correct treatment of the 24-SM rung.
- **Correction from Phase 2 (corrected again in Phase 3):** CF art. 148 alin. (2) is a **ladder of
  alternative bases, not a clamp**. Between 12 and 24 SM the base is 12 SM; **at or above 24 SM the base is
  24 SM** — the taxpayer may elect a higher `venit ales`, but realized income is not automatically the base.
  The old `Math.min(effectiveBase, max_base)` clamp therefore **over-stated** CAS: it charged 12,150 below
  12 SM (where art. 148 alin. (1) means 0) and 25% of realized income in the 12–24 SM band (60,000 → 15,000
  instead of 12,150). Above 24 SM it reached 24,300 only by coincidence. Do **not** "enforce `max_cas`" as
  if it were statutory — `max_base`/`max_cas` encoded a cap the article does not state (phases/02 §2.1,
  phases/03_cas.md §2).
- **Entry criteria:** **met** — Phase 2 resolved the minimum base (12 SM, CF art. 148 alin. (2) lit. a),
  OUG 128/2024 Art. I pct. 20) and the 24-SM tier boundary with citations.
- **Blocked by:** ~~Q-CAS-EXEMPTION (U-5)~~ — **closed in Phase 3**: the exemption is **CF art. 150 alin. (1)**
  (pensioners and persons insured in their own social insurance system), **not art. 147**, which is the
  monthly declarative duty (Declarația 112). Art. 150 alin. (2) exempts salary earners only for art. 137
  alin. (1) lit. b^1), so `salaryStatus` deliberately does not exempt. The SM anchor is now fully
  settled — **rule** CF art. 135^1 alin. (3) (the SM in force on 1 January of the income year governs
  annual bases) and **numbers** 4,050 lei on 1 ianuarie 2026 / 4,325 lei from 1 iulie 2026
  (HG 1.506/2024, MO I 1185/28.11.2024; HG 146/2026, MO 196/13.03.2026). U-6 is closed; the code's
  existing 48,600 / 97,200 / 291,600 values are correct and must not be "fixed".

### Phase 4 — CASS — **COMPLETE 2026-10-06** (`docs/ai/phases/04_cass.md`)

- **Scope corrected against the research.** The original scope line — "decide min-base behaviour;
  enforce `max_cass`" — was wrong on both halves and is replaced:
  - **Not "apply the minimum".** Below 6 SM the law owes "o diferență de contribuție … până la nivelul
    celei corespunzătoare bazei de calcul egale cu 6 salarii minime brute" (CF art. 174 alin. (6)) — a
    **contribution top-up**, not a substituted base and not a `REVIEW_REQUIRED` halt. It is provably a
    top-up because CF art. 118 alin. (2) lit. b) makes CASS deductible from the income-tax base "cu
    excepția diferenței de contribuție … prevăzută la art. 174 alin. (6)". It is also **conditional**:
    waived by art. 174 alin. (7) lit. a)/b)/c), and absent altogether when VNA ≤ 0 (art. 174 alin. (2)).
  - **`max_cass` must be DERIVED, not enforced.** 29,160 is `10% × 291,600`; keeping it as a parameter
    creates a second source of truth for one legal figure. `max_cass` was in fact read by nothing, and
    `min_cass` was applied as an unconditional floor on the CASS *value* — a shape the articles do not
    support. Both parameters are removed; `calcCass` derives both amounts from `min_base` /
    `max_annual_base`, which keep their ids because `thresholds.ts` reads them by string.
- **Citation fixed, value untouched:** `min_base = 24,300` was **numerically correct for 2026 and
  mis-sourced**. Art. 170 alin. (2)-(3) reach only art. 155 alin. (1) lit. **c)-h)**; art. 68 sistem-real
  income is lit. **b)**. The floor is **art. 174 alin. (6)** (OUG 128/2024 pct. 23). 24,300 / 291,600 /
  4,050 were not changed.
- **The asymmetry that had to be avoided:** CF art. 174 alin. (7) lit. c) (Legea 141/2025 Art. I pct. 34,
  MO 699/25.07.2025) removes **only the top-up** — a pensioner with art. 68 net income is **not**
  CASS-free, unlike CAS where art. 150 alin. (1) exempts entirely. CAS and CASS treat pensioners
  differently; Phase 3's shape must not be mirrored here.
- **Not modelled, deliberately:** the art. 180 alin. (1) optare (elective, deadline-bound, and its
  alin. (2) base was never retrieved verbatim — inventing it would be inventing a citation); art. 174
  alin. (8) prior-year relief (no prior-year data, and Legea 141/2025 pct. 35 narrowed it to art. 154
  alin. (1) lit. a), b), e) și f), which excludes pensioners at lit. h)/h²)); art. 174 alin. (7) lit. b)
  (the profile has `otherIncome` but not the CASS paid on it).
- **Blocked by:** ~~Q-CASS-MINBASE (U-2)~~ — **closed**: the floor exists and is sourced at art. 174
  alin. (6). **U-8 remains open as a risk, not a blocker**: it is not established that OUG 89/2025 and
  OUG 8/2026 leave art. 170 / 174 / 154 / 180 untouched (`phases/04_cass.md` §9).
- **Follow-up for Phase 6:** the `salaryStatus === 'da'` + `VNA < 6 SM` case returns `review_required`
  because art. 174 alin. (7) lit. a) depends on a **salary amount** the profile does not carry. Wiring
  that amount is a profile change, not a CASS change.

### Phase 5 — Income tax — **COMPLETE 2026-10-06** (`docs/ai/phases/05_income_tax.md`)

- **Premise changed by Phase 2 — this is now a deletion, not an implementation.** The 30%
  deductible-expense cap the short-circuit at `tax.ts:52-54` waits on **does not exist in law**. A full
  Titlul IV "30%" scan returns only art. 68^3 alin. (2) (cazare forfetar, new from 01.01.2026),
  art. 85 alin. (2) (închiriere 1–7 camere) and art. 106 (calamity) — none conditions sistem-real
  deductibility. **There is no rule to author; delete the short-circuit.**
- **The 16% surcharge is not applicable to this entity type** (CF art. 114 alin. (1), art. 115 alin. (1)
  lit. b)). `progressive_rate: 16` was already removed in Phase 2 — the prompt's claim that it still sits
  at `package2026.ts:109` is **stale**; the only remaining traces of "16" in `src/` are CSS `gap` and
  `fontSize`. What is left to do here is delete the stale NOTE string in `calcIncomeTax`'s breakdown
  (`calculators.ts:96`), which still tells the reader a 16% surcharge portion exists.
- **The real gate is CF art. 68 alin. (4)** — the general deductibility test imported by OMFP 3254/2017
  art. 5 alin. (2). Its verbatim text is now captured in phases/02 §6, **closing the Phase 5 blocker**.
  Note also the four new alin. (5) capped items from OUG 8/2026 Art. 6 pct. 26-28 — **now positively
  confirmed against the act itself** (`research/09` §1).
- **Do not re-import the phantom cap via a CAEN-aware rule:** art. 68 alin. (1) excludes art. 68^1 /
  **68^3** / 69, and art. 68^3 alin. (2) is a real 30% forfetar **regime switch** for cazare
  (>7 camere, art. 67 alin. (1^1)) — a PFA doing that activity is outside sistem real entirely.
- **New from Phase 4 — B-13, the taxable base over-deducts CASS.** `tax.ts` subtracts the whole
  `cassValue`, but CF art. 118 alin. (2) lit. b) makes CASS deductible from the income-tax base
  "**cu excepția diferenței de contribuție** de asigurări sociale de sănătate **prevăzută la art. 174
  alin. (6)**". The top-up is therefore **not** deductible, so anyone in the `0 < VNA < 6 SM` band
  currently gets an over-deducted base and an **understated tax**. Phase 4 fixed the CASS *amount*;
  splitting the non-deductible difference out of the taxable base is Phase 5's job. It is named in the
  `calcCass` breakdown so it cannot be missed.
- **B-14, the regime gate is inverted — and `impozit_pe_cit` cannot legally exist for a PFA.**
  `tax.ts:52-54` blocks `impozit_pe_venit`, which is the **default** regime (`profile.ts:41`) and the only
  regime this package exists for, so the entire numeric income-tax suite runs under `impozit_pe_cit`
  (12 occurrences vs 2, and those 2 are the short-circuit assertion). Research settled the direction:
  **a PFA cannot be a CIT taxpayer at all in 2026** — CF art. 14 lit. a) confines profit tax to
  **persoane juridice**, art. 68 alin. (1)'s exception list is closed (art. 68^1, 68^3, 69 — not Titlul II),
  and the old option vehicle **art. 120 CF is Abrogat** (OUG 128/2024 pct. 11 Art. I, MO 1125/11.11.2024,
  eff. 01.01.2025). So the gate must be **inverted**: `impozit_pe_venit` computes; `impozit_pe_cit` returns
  `REVIEW_REQUIRED` framed as a **data-integrity failure** (wrong regime recorded / entity is actually a
  persoană juridică) — **not** as "a different base applies". The numeric tests must be re-pointed to the
  default regime. `research/08` Q-REGIME, confidence MEDIUM-HIGH.
- **B-15, the CAS/CASS deduction is neither prorated nor capped.** Art. 118 alin. (2) lit. b) deducts CAS
  and CASS **prorated** — alin. (2^2) by the art. 148 alin. (3) ratio, alin. (2^3) by the art. 170 alin. (1)
  ratio — and alin. (2^4) caps the combined deduction at „**nu poate depăși nivelul venitului net anual
  recalculat**". Today's single-source PFA makes the proration a **no-op** (ratio = 1) and the
  `taxable <= 0 → tax 0` branch happens to give the right tax, so there is **no numeric error yet** — but
  the calculation **lines over-report the deduction**, and the proration stops being a no-op the moment a
  second income source exists (Phase 6). Model the mechanism now; do not leave a latent trap.
- **B-16, fiscal losses are silently discarded.** Art. 118 alin. (2) lit. a) takes reported losses off
  **before** sources are summed; alin. (4)-(5) require report and compensation „**în limita a 70% din
  veniturile nete anuale, obținute din aceeași sursă de venit în următorii 5 ani fiscali consecutivi**",
  chronologically by age of loss, personal and non-transferable, unabsorbed loss becoming a definitive
  loss. `tax.ts:112-118` zeroes the tax and stores nothing — current-year tax is right, **the loss is lost**,
  so the following year is over-taxed. Phase 5 owns the **rule and its surfacing**; persisting prior-year
  loss balances needs the Phase 7 schema/version work. Do not invent a persistence layer here, and do not
  pretend the rule is implemented — state precisely which half is done.
- **B-6 remainder — `multiple_6x/12x/24x/72x` are declared and read by nothing.** They sit on the
  `wage-reference` rule (`package2026.ts:33-36`) and duplicate `reference × 6/12/24/72`, the same
  second-source-of-truth problem Phase 4 removed for `min_cass`/`max_cass`. Verified unreferenced: the only
  parameter of that rule any code reads is `reference` (`calculators.ts:69`). **Resolve it — remove them or
  derive them — do not leave the item open.**
- **Not optional.** Every item above is a Phase 5 acceptance criterion. Items previously parked as
  low priority (the NOTE string, the `multiple_*` parameters) are in scope, not best-effort.
- **Blocked by:** Q-NONDEDUCT-VAT (U-1) — must stay `REVIEW_REQUIRED`, never a computed rule.
- **U-8 is CLOSED** (`research/09` §1) — neither OUG 89/2025 nor OUG 8/2026 touches CF art. 154/170/174/180,
  proven against the acts themselves. CAS/CASS from Phases 3-4 stands.

### Phase 6 — Profile-driven fiscal inputs — **done 2026-10-06, with 3 recorded scope items not delivered** (`docs/ai/phases/06_fiscal_profile.md`)

- **Follow-up from Phase 3:** surface the 24 SM CAS boundary as a proper `tier-floor` threshold type —
  crossing 24 SM doubles the CAS floor from 12,150 to 24,300, which is real and useful, but it is not a
  "schimbare de regim" cap. `CAS_MAX_BASE` was removed in Phase 3 for asserting a cap art. 148 does not
  contain (phases/03_cas.md §4).

- **Correction:** the profile fields **already exist** but are unread. `models.ts:66-89` carries 13
  fields; the engine reads 5 (`tax.ts:41,43,44,48-50,52,58,59,71,77`).
- **Exists today:** `caen`, `salaryStatus`, `pensionStatus`, `otherIncome`, `cashFloorLei`,
  `pfaStartYear` carried and hashed (`derived.ts:107,145`) but never read.
- **Must be created:** `NORMA_VENIT` — absent repo-wide, zero matches; rules that key on CAEN;
  exemption rules that read salary/pension status; a VAT regime richer than the boolean `vatExempt`.
- **Entry criteria:** Phase 3/4 exemption branches defined; Q-30PCT-CAP answered.
- **Blocked by:** Q-30PCT-CAP, Q-NETGROSS.

- **Phase 6 outcome (2026-10-06).** Entry criteria were met — Q-30PCT-CAP was closed by the Phase 2
  full Titlul IV scan as a **phantom** (STATE.md open-question register: no such provision exists), and
  Q-NETGROSS only gates the *net-of-CASS* convenience figures, not the profile contract. Delivered: one
  regime source (`src/domain/regimes.ts`) for the select, the refusal gate and the refusal copy
  (**B-18** found and fixed there: an unrecognised regime used to fall through as "no refusal");
  `norma_venit` added as a **parseable but refused** value with **no norm values invented** (the 2026
  package contains no norm-of-income rule — the "absent repo-wide" note above is superseded); the
  profile write path (B-9 closed for the fiscal profile, `e2e/settings.spec.ts` proves persistence);
  both art. 174 alin. (7) lit. a) branches now compute, closing the Phase 4 open item "the salary amount
  behind lit. a)" (phases/04_cass.md §7) — `calcCass` no longer returns `reviewRequired` for a salaried
  PFA once `salaryIncomeLei` is supplied. **B-17 (no rounding policy) is untouched and still open.**
- **Phase 6 did NOT deliver these, and they are recorded rather than silently dropped:**
  1. the 24 SM `tier-floor` threshold surface above (Phase 3 follow-up) — `thresholds.ts` is unchanged
     (`ThresholdType = 'min-base' | 'max-base' | 'registration' | 'income'`), so the art. 148 alin. (2)
     ladder floors still have no threshold surface → **Phase 7/9**;
  2. **rules that key on CAEN** — CAEN is now user-writable (`Settings.tsx:529`) but the engine reads no
     CAEN-keyed rule, because the 2026 package names no CAEN→rule mapping to cite; inventing one is out
     of scope;
  3. **a VAT regime richer than the boolean `vatExempt`** — the boolean is now user-writable
     (`Settings.tsx:640`) and still drives `tax.ts:87-88`; no richer regime was invented;
  4. `chosenBase` wiring — the art. 180 alin. (1) CASS option stays unmodelled and is surfaced only as an
     `OPTIUNE NEMODELATA` breakdown line (`fiscal/calculators.ts:202`, the VNA ≤ 0 path);
  5. `pensionStatus` is still a stored flag while art. 174 alin. (7) lit. c) requires pension income
     *realised* in the fiscal year, and **B-19** (`socialInsuranceStatus` zeroes CASS on the
     never-retrieved CF art. 154 alin. (1)) — research, not code.
  Evidence: `docs/ai/phases/06_fiscal_profile.md` §6–§7.

### Phase 7 — Identity source of truth

- **Exists today (measured in step 01):** one identity **read** site — the topbar
  (`App.tsx:221-222`, `profile.identity.nume`); the sidebar is a hardcoded brand (`App.tsx:183-184`);
  no Dashboard greeting reads identity. Two identity **stores**: `profile.identity`
  (`models.ts:87`) and `settings.company` / `settings.personal` (`Settings.tsx:34-37,50-53`). They
  are reconciled once, only when a stored payload has no profile (`store.tsx:118`,
  `legacyProfileFromSettings`). `updateProfile` (`store.tsx:213`) has **no UI caller**, and the
  Settings personal fields are `disabled` (`Settings.tsx:369,373,377`). No module outside
  `Settings.tsx` reads `settings.*`.
- **Must be created:** a single canonical identity store; a UI write path for the profile (regime,
  VAT status, social-insurance status, cash floor, identity fields); either removal of the
  `settings.company` / `settings.personal` duplication or an explicit reconciliation rule; surfacing
  `dataOrigin` (`store.tsx:26-27`) when the app recovered from a corrupt payload. **Persistence
  versioning and migration are assigned here (B-11, B-12)** — Phase 7 is the only phase in the plan
  that changes persisted-state shape (`persistedAppDataSchema` has no `version` field,
  `data/schema.ts:196-207`; the only migration logic is the profile backfill at `store.tsx:118`; a
  corrupt payload resets everything to seed at `store.tsx:109-114`), so the `version` field and
  migration chain must land with it rather than in Phase 8.
- **Entry criteria:** Q-IDENTITY-SOURCE and Q-PERSISTENCE-VERSION answered.
- **Blocked by:** Q-IDENTITY-SOURCE, Q-PERSISTENCE-VERSION.

### Phase 8 — Financial amount semantics

- **Follow-up from Phase 3:** the CAS floor figures and the "no upper cap" statement live in the calculator
  `breakdown` as text; if they become rendered amounts they need this phase's semantics pass, and
  `CAS_MIN_BASE`'s shared "dezcalificare din regim" wording needs a tax-specific map (for CAS, being under
  12 SM means no CAS is owed, not disqualification).
- **Follow-up from Phase 5 (B-17):** this phase owns **which amount is rounded where**. The seed's
  `Rezervă lunară` is a second live half-cent (`3.104,505 / 3 = 1.034,835` → rendered `1.034,84`),
  produced at presentation level rather than in the fiscal domain. Same root cause as B-17.

- **Objective:** prevent financial/tax calculations from confusing cash amounts, VAT and
  tax-relevant income. Separate the six concepts — transaction/cash amount, VAT amount, amount
  excluding VAT, gross amount, deductible expense, tax-relevant income. Ensure VAT does not silently
  become PFA taxable income, and that VAT threshold bases use the appropriate turnover basis. Where
  the treatment cannot be determined safely: `REVIEW_REQUIRED`. **Do not build a full VAT accounting
  system.** Deliverable: `docs/ai/steps/08_amount_semantics.md`.
- **Exists today (measured in step 01):** `Revenue` (`src/data/types.ts:9-21`) and `Expense`
  (`:26-37`) carry `valoareFaraTva` + `tva` and one ambiguous `date` (`:13`, `:30`). There is **no
  stored total field** — `total()` is a helper (`src/data/types.ts:176`) and `aggregation.ts:11`
  states "Record total = `valoareFaraTva + tva` (there is no stored total field)". Two bases already
  exist side by side in aggregation: `YtdTotals.revenue` (VAT-inclusive) and `YtdTotals.revenueNet`
  (VAT-exclusive), plus `expenses` / `expenseNet` (`aggregation.ts:17-25,95-111`). The engine picks
  between them at `tax.ts:58-59` (`gross = inputs.vatExempt ? revenues : revenuesNet`), where
  `vatExempt` comes from the profile (`derived.ts:137`) and is false at every seed and default
  (`seed.ts:14`, `store.tsx:81`, `profile.ts:46`) — so VAT does **not** today leak into PFA taxable
  income, but only because of that flag. Money is float lei throughout (`rules.ts:14`,
  `calculators.ts:9`, `aggregation.ts:17-25`, `snapshots/types.ts:30`, `models.ts:84`); cents exist
  only as a ×100 display conversion (`aggregation.ts:60-65`, `data/dashboard.ts:230-235`,
  `insights.ts:36-37`).
- **Must be created:** named amount concepts on the records and at the engine boundary, replacing the
  three unrelated bases now in play. (a) The VAT registration threshold is measured against
  **VAT-inclusive** revenue: `data/dashboard.ts:99-105` passes `currentValue: ytd.revenue` under
  `fiscalBase: 'gross-revenue'` to a spec whose `requiredFiscalBase` is also `'gross-revenue'`
  (`thresholds.ts:106-113`), and `FiscalBase` offers only `'gross-revenue' | 'gross-expenses' |
  'net-income'` (`thresholds.ts:17`) — so the 395,000 lei test (`package2026.ts:112-118`) is taken
  against collected VAT, and nothing computes the turnover basis it is meant to apply to.
  (b) `Declaration.venituri` / `cheltuieli` (`src/data/types.ts:52-61`) carry no VAT split at all and
  are rendered as a taxable base inline at `Declarations.tsx:172` (`Math.max(0, d.venituri -
  d.cheltuieli)`), on a path independent of aggregation. (c) Deductible expense is nowhere
  distinguished from cash expense. `settings.cotaTva` is seeded as 9 (`src/data/types.ts:110`,
  `seed.ts:83`) and read by no consumer, so no amount derives a VAT rate from settings today.
  Anything the phase cannot pin to a primary source returns `REVIEW_REQUIRED`.
- **Entry criteria:** Phase 5 has settled what tax-relevant income is, and Phase 2 has resolved
  Q-VAT-THRESHOLD (300,000 vs 395,000) — a turnover basis is meaningless until the threshold value is
  settled.
- **Blocked by:** Q-VAT-THRESHOLD (which value), Q-NETGROSS (are `Declaration.venituri` /
  `cheltuieli` net or gross?), and Q-MONEY-UNIT if the amount types are re-cut in Phase 10.

### Phase 9 — Date semantics

- **Correction:** date semantics are **absent**, not partial. There is a single `date` field per
  document (`aggregation.ts:85-87,96,102`; `derived.ts:48`); no issued / received / paid distinction.
- **Exists today:** a `date` domain module and Romanian date handling (steps 27), deadline event types
  (`deadlines.ts:4-10`), and `DeadlineQuery.eventDate` (`deadlines.ts:28`) that is never fed from a
  profile because no profile field holds a start date — only `pfaStartYear: number`.
- **Must be created:** per-event date fields, and rule parameters that drive `cas_quarterly`,
  `cass_quarterly`, `income_tax_advance` (no rule drives them today).
- **Entry criteria:** Q-NETGROSS answered; Phase 6 profile fields wired.
- **Blocked by:** Q-NETGROSS.

### Phase 10 — Money representation

- **Correction:** `decimal.js-light` is declared (`package.json:16`) and **never imported anywhere
  in `src/`** — contradicting `decisions/09:43,202`. Money is float lei throughout
  (`rules.ts:14`, `calculators.ts:9`, `aggregation.ts:17-25,97-104`, `snapshots/types.ts:30`,
  `models.ts:84`); cents exist only as display conversion.
- **Must be created:** either integer-bani storage or a decimal type at the domain boundary, plus a
  decision on rounding and on the snapshot hash stability (changing money representation changes
  `inputsHash`, `derived.ts:107,145`).
- **Entry criteria:** Q-MONEY-UNIT answered. Must come **after** the fiscal corrections, or every
  corrected test will be rewritten twice.
- **B-17 (found in Phase 5) is the strongest evidence for this phase, and it is not cosmetic.** Exact
  decimal arithmetic on the seed gives an income tax of **674.505 — a half-cent** — and the fiscal
  domain has **no rounding policy at all**. The cent that ships comes from IEEE-754, not a rule:
  `0.10 × 6745.05` lands on `674.5050000000001`, while two algebraically identical arrangements
  (`0.09 × 7494.5`, `6745.05 / 10`) land on `674.505`. On that same double the codebase's two rounding
  paths **disagree**: `Intl.NumberFormat` (`src/lib/format.ts:6-9`) renders `674,51`, `toFixed(2)`
  gives `674.50`. So the fix is not just "use decimals" — a **tie-break must be chosen**, and that
  tie-break is a **legal** question (how Declarația 120 rounds) which is **unresearched**. Open it as a
  research question before Phase 10 starts, not during it.

## Next

1. **Phase 4 (CASS) is DONE** (2026-10-06, `phases/04_cass.md`) — the 6-SM floor is now applied as the
   art. 174 alin. (6) contribution top-up it actually is (2,430 lei, conditional), a zero/loss year owes
   no CASS at all (art. 174 alin. (2)), art. 174 alin. (7) lit. c) waives only the top-up, and
   `min_cass`/`max_cass` are gone in favour of `rate × base`. The `min_base` value 24,300 was already
   right; only its citation was wrong. **Phase 5 (income tax) is now done** — see item 3 and
   `phases/05_income_tax.md`.
2. **U-8 is CLOSED** (2026-10-06, `research/09_u8_amendment_scan_and_optare.md` §1) — OUG 89/2025 and
   OUG 8/2026 were read clause by clause and touch none of CF art. 154 / 170 / 174 / 180. The CAS/CASS
   results from Phases 3–4 stand; do not re-open.
3. **Phase 5's scope changed, and it was NOT only a deletion** — the `tax.ts:52-54` short-circuit rested
   on a 30% cap that does not exist, so that part was a deletion; but inverting the regime gate (B-1/B-14)
   exposed three real arithmetic defects in the art. 118 alin. (2) base (B-13 whole-CASS deduction, B-15
   missing proration + alin. (2^4) cap, B-16 discarded fiscal losses), all now fixed and tested.
   The art. 68 alin. (4) gate is captured as an input gap, not faked into a rule.
4. Open ADRs in `docs/ai/decisions/` for the fiscal corrections (only 07 and 09 exist today).
5. Add e2e coverage for `Documents.tsx`, `EFactura.tsx`, `Expenses.tsx` and the Clients edit path
   when the pages they exercise are next touched — the existing 24 e2e tests are dashboard-only.
6. Fix the miscited articles in `steps/16:50-54,84` **only** in new documents; the step file itself
   stays as historical record (01 §6.4).
7. **Verification method for any future fiscal re-check: read amending acts directly.** The Portal
   Legislativ consolidated rendering of CF doc 312601 did not surface the OUG 8/2026 note on art. 68
   alin. (5), so a consolidated text can lag the act (phases/02 §11).
