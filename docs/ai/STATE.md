# STATE

Last sync: **2026-10-06 (phase 5 — income tax: CF art. 118 sistem real corrected; B-1/B-13/B-14/B-15/B-16 closed, see `docs/ai/phases/05_income_tax.md`)**. Previous sync: **2026-10-06 (phase 3 — CAS corrected: CF art. 148 alin. (2) floor ladder + CF art. 150
alin. (1) exemption; see `docs/ai/phases/03_cas.md`)**. Previous sync: **2026-10-05 (phase 2 — verified
2026 fiscal baseline)**, HEAD `82073bff72934d1db7a854e5a693554174249785` on `master` (2026-10-04 07:13:22
+0300, "Steps 27-34: …").

**The fiscal source of truth is now `docs/ai/phases/02_fiscal_baseline.md`.** It supersedes
`docs/ai/research/06_2026_fiscal_research.md`, which was wrong on four points (CAS minimum base, VAT
threshold, the phantom 30% expense cap, the 16% component) and misattributed the VAT act. Phase 2
changed **provenance metadata only** — no formula, calculator, rule-engine, parameter-value or
rule-count change.

**Phase 3 (2026-10-06) changed fiscal behaviour on purpose.** `calcCas` is now the CF art. 148 alin. (2)
ladder of floors — below 12 SM (48,600 lei) CAS is **0**, 12–24 SM is 12,150, at or above 24 SM (97,200 lei)
it is 24,300, and there is **no upper cap** — plus the CF art. 150 alin. (1) pension exemption, driven by
`pensionStatus` (`salaryStatus` does not exempt: art. 150 alin. (2) covers only art. 137 alin. (1)
lit. b^1)). CAS parameters were renamed to floor language (`tier2_base`, `tier1_cas`, `tier2_cas`) and
`max_cas` was deleted. The `CAS_MAX_BASE` threshold row was removed because it asserted a statutory cap
that art. 148 does not contain. The package is still **8 rules at `version: 1`**; CASS, income tax and UI
are untouched, and 48,600 / 97,200 / 291,600 are unchanged.

**This STATE.md supersedes the 2026-10-02 STATE.md.** The previous version's claims
"**28 test files, 102 tests**" (`:8`, `:37`), "1 app / 6 components / 4 data / 13 domain / 4 pages"
(`:9`), "15 public functions" in `data/dashboard.ts` (`:26`), "`markExpenseAsPaid` …
`completeDeclaration` in `src/store.ts`" (`:36`) and "**no e2e/Playwright specs exist**" (`:41-42`,
`:48`) were **false**. The measured figures are below. The full claim→verdict table is in
`docs/ai/steps/01_real_baseline.md` §6.1. No application code was modified during this sync.

## Verification summary (counts re-measured 2026-10-06 after Phase 5; environment figures from 2026-10-05, all exit 0)

Re-measured after the Phase 5 income-tax correction (`tax.ts`, `calculators.ts`, `package2026.ts` and
their tests + `e2e/dashboard.spec.ts`; `thresholds.ts` untouched); environment rows unchanged from the
Phase 2 measurement:

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm run build` (`tsc && vite build`) | **exit 0** |
| `npm run test` (vitest) | **36 test files, 489 unit tests, all passing** (450 at Phase 2, 463 after Phase 3, 482 after Phase 4; Phase 5 added 7 income-tax tests) |
| `npm run test:e2e` (playwright) | **24 e2e tests, all passing** (`e2e/dashboard.spec.ts`; Phase 5 added the `impozit_pe_cit` data-integrity case) |

- Unit test files by area: 1 `src/`, 9 `src/components/`, 8 `src/data/`, 13 `src/domain/`
  (incl. 2 `fiscal/`, 1 `snapshots/`), 5 `src/pages/`.
- **Untested pages: `Documents.tsx`, `EFactura.tsx`, `Expenses.tsx`.**
- e2e runs Chromium only — `playwright.config.ts` declares no `projects`;
  `playwright.firefox.config.ts` is supplementary and must be run with `--config`.
- Resolved versions: react 18.3.1, vite 5.4.21, typescript 5.9.3, vitest 3.2.7,
  @playwright/test 1.63.0. `docs/ai/steps/02_repo_scout.md:24` ("React 19.2.4 … Vite 7.3.1",
  `build` = `tsc -b && vite build`) is false; `docs/ai/README.md:13` is correct.
- Hygiene, not defects: `test-results/` and `playwright-report/` untracked and not in `.gitignore`;
  no `*.d.ts` / `src/vite-env.d.ts` despite CSS side-effect imports at `src/main.tsx:4-5`; the
  `playwright.config.ts:9` "No overload matches this call" diagnostic is LSP-only
  (`tsconfig` `include: ["src"]` excludes root configs) and all 23 specs pass; `react-router-dom` is
  declared but never imported (`src/App.tsx:1` uses `useSyncExternalStore`).

## Phase status

| Phase | Scope | Status | Blocking prerequisites |
|---|---|---|---|
| 1 | Real baseline | **complete** (2026-10-05, docs only) | — |
| 2 | Verified 2026 fiscal baseline + rule provenance (17-field `FiscalRule`, `rules.ts:19-37`) | **complete** (2026-10-05, `docs/ai/phases/02_fiscal_baseline.md`) | — |
| 3 | CAS: flat clamp → SMBT **tier ladder** (not a clamp — `max_cas` is not a statutory cap) | **done 2026-10-06** (`phases/03_cas.md`) | U-5 closed; B-2 fixed; 24 SM threshold surface deferred to Phase 6 |
| 4 | CASS: the 6-SM floor is an art. 174 alin. (6) **top-up**, not a substitution or a review gate; `min_cass`/`max_cass` **derived**, not enforced as independent figures | **done 2026-10-06** (`phases/04_cass.md`) | ~~Q-CASS-MINBASE (U-2)~~ closed — floor is art. 174 alin. (6), conditional; B-3 fixed; B-6 CASS half fixed; **U-8 CLOSED 2026-10-06** (`research/09` §1) |
| 5 | Income tax: the regime gate was inverted (`impozit_pe_venit` refused, `impozit_pe_cit` computed); the art. 118 alin. (2) base deducted the whole CASS, was neither prorated (alin. (2^2)/(2^3)) nor capped (alin. (2^4)), and discarded fiscal losses | **done 2026-10-06** (`phases/05_income_tax.md`) | B-1/B-13/B-14/B-15/B-16 closed; Q-30PCT-CAP confirmed phantom; loss **persistence** deferred to Phase 7; Q-NONDEDUCT-VAT (U-1) still unverified |
| 6 | Profile-driven fiscal inputs; NORMA_VENIT | not started | Phase 3/4; Q-30PCT-CAP, Q-NETGROSS |
| 7 | Identity source of truth + persisted-state migration (version field, migration chain, non-destructive corrupt recovery) | not started | Q-IDENTITY-SOURCE, Q-PERSISTENCE-VERSION |
| 8 | Financial amount semantics: cash vs VAT vs tax-relevant income; VAT turnover basis | not started | Phase 5; Q-NETGROSS **resolved** — the base is net of VAT, so only the turnover basis is open; **B-17** (which amount is rounded, and where) |
| 9 | Date semantics (issued / received / paid) | not started | Q-NETGROSS; Phase 6 |
| 10 | Money representation (float lei → bani or decimal) | not started | Q-MONEY-UNIT; **B-17 — the seed tax is an exact half-cent (674,505 lei) and no rounding policy exists**; after Phases 3–5 |

Phase scope, entry criteria and per-phase evidence: `docs/ai/PLAN.md` "Forward roadmap".

## Defect register

| ID | Defect | Evidence | Fixed in |
|---|---|---|---|
| B-1 | **FIXED (Phase 5, 2026-10-06)** — the default regime `impozit_pe_venit` short-circuited the tax engine to `review_required`, so the default user got no tax estimate. Same defect as B-14 | `src/domain/tax.ts:78-80` (gate inverted, computes for `impozit_pe_venit`); `src/domain/tax.test.ts:14,18`; `phases/05_income_tax.md` §3 | closed |
| B-2 | **FIXED (Phase 3, 2026-10-06)** — CAS was a flat clamp; `calcCas` is now a parameter-driven floor ladder (below 12 SM → 0; 12–24 SM → 12,150; ≥ 24 SM → 24,300; no cap) with the CF art. 150 alin. (1) pension exemption wired through `CalculatorInput.pensionStatus` | `src/domain/fiscal/calculators.ts` `calcCas`; `phases/03_cas.md` | closed |
| B-3 | **FIXED (Phase 4, 2026-10-06)** — CASS returned `reviewRequired` below `min_base`. The law owes a **contribution top-up** to the 6-SM figure (art. 174 alin. (6)), not a review halt and not a substituted base; a zero/loss year owes **no CASS at all** (art. 174 alin. (2)); art. 174 alin. (7) lit. a)/c) waive only the top-up. The `min_base` **value** (24,300) was always right — its **citation** (art. 170 alin. (2)-(3)) was wrong | `src/domain/fiscal/calculators.ts` `calcCass`; `phases/04_cass.md` | closed |
| B-4 | `progressive_rate: 16` is dead data while the result is still reported `status: 'computed'` — the engine under-reports tax and claims success | `src/domain/fiscal/calculators.ts:90,96`; `package2026.ts:109` | **Phase 2 — parameter removed** (16% is legally inapplicable to PFA sistem real, not merely unread). The stale "16% progressive surcharge" NOTE string in `calcIncomeTax` was removed in Phase 5 — nothing to review, no second rate exists. |
| B-5 | 5 of 8 ACTIVE rules carry non-resolvable provenance placeholders (`'ANAF 2026'`, anaf.ro homepage, self-referential article) | `package2026.ts:77-79,96-98,112-114,127-129,142-144` | **Phase 2 — fixed** (verified citations; `VAT_THRESHOLD_2026` also corrected from art. 338 → art. 310 alin. (1)) |
| B-6 | **CAS part FIXED (Phase 3)**: `max_cas` (the phantom cap) removed; `tier1_cas`/`tier2_cas` are now read by `calcCas`. **CASS part FIXED (Phase 4)**: `min_cass`/`max_cass` removed — both are derived as `rate × min_base` / `rate × max_annual_base`; `max_cass` had no reader at all and `min_cass` was applied as an unconditional floor on the CASS value, which art. 174 alin. (6)-(7) do not support. **Multiples FIXED (Phase 5, 2026-10-06)**: `multiple_6x/12x/24x/72x` deleted from the `wage-reference` rule — no reader anywhere in `src/` or `e2e/`, and each equals `reference` × n | `package2026.ts:32-41`; `phases/03_cas.md` §2–3; `phases/04_cass.md` §3, §5; `phases/05_income_tax.md` §3 | closed |
| B-7 | `docs/ai/STATE.md` and `docs/ai/PLAN.md` contained materially false claims | `01_real_baseline.md` §6.1, §6.2 | Phase 1 (this sync) |
| B-8 | Two unreconciled identity stores: topbar reads `profile.identity`, Settings writes `settings.company` / `settings.personal` | `src/App.tsx:221-222` vs `src/pages/Settings.tsx:34-37,50-53`; reconciled only at `src/data/store.tsx:118` | Phase 7 |
| B-9 | No UI path writes the profile — every fiscal input is fixed at seed values | `src/data/store.tsx:52,213` (`updateProfile` uncalled outside `derived.test.tsx:61`); `src/pages/Settings.tsx:369,373,377` (`disabled`) | Phases 6, 7 |
| B-10 | Every Settings write is inert downstream — no module outside `Settings.tsx` reads `settings.*` | grep over `src/`; `settings.cotaTva` seeded at `src/data/seed.ts:83`, read nowhere | Phase 7 |
| B-11 | Corrupt payload silently resets the whole dataset to seed data; `dataOrigin` never surfaced | `src/data/store.tsx:109-114,132`; `:26-27,139,172` | Phase 7 |
| B-12 | No persisted-schema `version`, therefore no migration path | `src/data/schema.ts:196-207`; only backfill is `store.tsx:118` | Phase 7 |
| B-13 | **FIXED (Phase 5, 2026-10-06)** — the taxable base deducted the whole CASS, including the art. 174 alin. (6) top-up, which the law expressly excludes. `tax.ts` subtracted `cassValue` in full, but CF art. 118 alin. (2) lit. b) makes CASS deductible "**cu excepția diferenței de contribuție de asigurări sociale de sănătate prevăzută la art. 174 alin. (6)**". Anyone in the `0 < VNA < 6 SM` band therefore got an **over-deducted base and an understated income tax**. Found while proving the top-up is a top-up (Phase 4); the CASS *headline* number was correct, only the taxable-base treatment was wrong | `src/domain/tax.ts` (`cassDeductibila = ratioCass × (cassValue − cassRes.nonDeductible)`); `phases/05_income_tax.md` §3, §4 | **closed (Phase 5, 2026-10-06)** |
| B-14 | **FIXED (Phase 5, 2026-10-06)** — the regime gate was inverted, and the whole numeric income-tax suite ran on the wrong regime. `tax.ts:52-54` returned `review_required` for `impozit_pe_venit` — which is the **default** regime (`profile.ts:41`) and the only regime this package is for (`PFA_2026_SYSTEM_REAL_PACKAGE`, CF Titlul IV sistem real). Every numeric income-tax expectation in `tax.test.ts` therefore ran under `impozit_pe_cit` instead (12 occurrences vs 2, and those 2 were the short-circuit assertion itself). But `INCOME_TAX_2026` is a **Titlul IV** rule — its `sourceArticle` was "art. 123 alin. (1) + art. 118" — so the engine applied the 10% *impozit pe venit* rate under a CIT regime, and **no CIT rule exists in the store at all**. The suite was green because it never exercised the path a real user lands on | `src/domain/tax.ts:78-80`; `src/domain/tax.test.ts:14,18,52,57`; `e2e/dashboard.spec.ts:68-76` + the new `impozit_pe_cit` case; `phases/05_income_tax.md` §3 | **closed (Phase 5, 2026-10-06)** |
| B-15 | **FIXED (Phase 5, 2026-10-06)** — the CAS/CASS deduction was neither prorated nor capped. CF art. 118 alin. (2) lit. b) deducts CAS and CASS **prorated** — alin. (2^2) by the art. 148 alin. (3) ratio, alin. (2^3) by the art. 170 alin. (1) ratio — and alin. (2^4) caps the combined deduction at „**nu poate depăși nivelul venitului net anual recalculat**". `tax.ts` subtracted both in full with no cap. **No numeric error resulted** — a single-source PFA has ratio = 1, and when `cas + cass > net` the old `taxable <= 0 → tax 0` branch happened to give the right tax — but the **lines over-reported the deduction**, and the moment a second income source exists (Phase 6) the proration would stop being a no-op and the numbers would go wrong silently | `src/domain/tax.ts:153-184`; `research/08` Q118-B; `phases/05_income_tax.md` §2, §4 | **closed (Phase 5, 2026-10-06)** — ratios and the alin. (2^4) cap are explicit and tested; single-source numbers unchanged by design |
| B-16 | **PART FIXED (Phase 5, 2026-10-06)** — fiscal losses were silently discarded. CF art. 118 alin. (2) lit. a) takes reported losses off **before** sources are summed, and alin. (4)-(5) require report and compensation „**în limita a 70% din veniturile nete anuale, obținute din aceeași sursă de venit în următorii 5 ani fiscali consecutivi**", chronologically, personal and non-transferable, unabsorbed loss becoming definitive. `tax.ts:112-118` zeroed the tax and stored nothing. Current-year tax was right; **the loss itself was lost**, so the following year was over-taxed | `src/domain/tax.ts:87-96,189-209` (`lossCarryForward`); `src/domain/tax.test.ts:492,513`; `phases/05_income_tax.md` §3, §5 | **rule + surfacing closed (Phase 5)**; **still open:** persisting the record and reading prior-year losses back into alin. (2) lit. a) — needs Phase 7 schema work |
| B-17 | **There is no rounding policy anywhere in the fiscal domain — the cent a user sees is decided by IEEE-754.** The seed-year income tax is exactly **674,505 lei: a half-cent** (`10% × 6.745,05`, from VNA 7.494,50). `computeTaxEstimate` stores raw float lei in every calculation line and in `totalDue`; the only rounding in the app is presentation. Measured in node: two algebraically identical arrangements of the same computation land on **different doubles** — `0.10 × 6745.05` → `674.5050000000001`, while `0.09 × 7494.5` and `6745.05 / 10` → the double whose shortest form is `674.505` (true value `674.504999999999995…`). `Intl.NumberFormat` renders **both** as `674,51`, but `toFixed(2)` renders the second group as **`674.50`**. So the shipped cent depends on the order of operations and on which formatter is used, not on any rule — and even a correct decimal policy must still choose a tie-break for a half-cent (half-up → `674,51`; half-even → `674,50`), which is a **legal** question (how the Declarația 120 is rounded) that has **not** been researched. Deliberately **not** fixed in Phase 5: inventing a rounding policy here would be inventing law | `src/domain/tax.ts:212-216` (float lei in lines + `totalDue`); `src/lib/format.ts:6-9` (`Intl.NumberFormat('ro-RO', {2,2})`, the only rounding); `src/pages/Dashboard.tsx` renders those formatted values; measured: `0.10*6745.05 = 674.5050000000001` vs `0.09*7494.5 = 674.505` → `toFixed(2)` `674.50` / `Intl` `674,51`; `phases/05_income_tax.md` §4 | **Phase 10** (`10_money_precision`: integer bani / `decimal.js-light` — declared at `package.json:16`, never imported — plus an explicit rounding policy **with its legal basis**); **Phase 8** owns making the amount semantics explicit (which figure is tax-relevant and where it is rounded) |

B-11 and B-12 are assigned to **Phase 7** rather than Phase 8: they are persistence/migration defects,
and Phase 7 (identity unification) is the only phase in the plan that changes persisted-state shape —
so the `version` field and migration chain belong there, not in amount semantics (Phase 8).

Also open, not defects: fiscal loss **persistence** absent — the rule and the amount are surfaced
(`tax.ts:192-201`), but `pierderiReportate` is still a named 0 term and no prior-year read exists
(Phase 7); NORMA_VENIT absent
(zero matches repo-wide); VAT regime is a boolean only (`models.ts:83`); single `date` field per
document (`aggregation.ts:85-87,96,102`); no release/year-resolution layer
(`data/dashboard.ts:85-93`, `data/derived.ts:66-74`); `decimal.js-light` declared
(`package.json:16`) and never imported.

## Open questions register

### Resolved by Phase 2 (2026-10-05) — no longer blocking

| ID | Answer | Source |
|---|---|---|
| Q-CAS-MINBASE | **12 SM = 48,600 lei.** The 6-SM tier does not exist for art. 68 income; it survives only in art. 170 alin. (2)-(3) (CASS). | CF art. 148 alin. (2) lit. a); OUG 128/2024 Art. I pct. 20, MO 1125/11.11.2024 |
| Q-CAS-MAXBASE-CONFIDENCE | **24 SM = 97,200 lei is the tier boundary, not a cap** — above it the base is the actual venitul ales, so `max_cas` must not be enforced as a statutory cap. | CF art. 148 alin. (2) |
| Q-VAT-THRESHOLD | **395,000 lei for 2026.** The research doc's "2025 ONLY / use 300,000" was wrong. | CF art. 310 alin. (1); **Ordonanța** nr. 22/2025 (an OG), MO 806/29.08.2025 |
| Q-VAT-BASIS | The 395,000-lei plafon is VAT-exclusive — no provision measures it TVA-inclusiv (with the alin. (2) caveat recorded). | CF art. 310 alin. (1)-(2) |
| Q-16PCT | **No 16% component for PFA sistem real.** 16% covers only art. 114 alin. (2) lit. h)/i); art. 114 alin. (1) excludes art. 61 lit. a)-h) income. Rate is 10% flat. | CF art. 115 alin. (1) lit. b); art. 123 alin. (1) + art. 118 |
| Q-30PCT-CAP | **Phantom — no such provision exists.** The only 30% hits in Titlul IV are art. 68^3 alin. (2) (cazare forfetar), art. 85 alin. (2) (închiriere) and art. 106 (calamity). `tax.ts:52-54` is a **deletion**, not an implementation. | Full Titlul IV scan, consolidated CF doc 312601 |
| Q-NETGROSS | **NET of VAT, both venituri and cheltuieli.** | OMFP 3254/2017 art. 4 alin. (3) + art. 5 alin. (6); CF art. 68 alin. (2)-(3) |
| Q-PROVENANCE-SCHEMA | **The code's 17-field `FiscalRule` is authoritative.** The archived "10-field" schema (`decisions/09:60,168`, `research/06:226`) is superseded — do not align the code to it. | `src/domain/fiscal/rules.ts:19-37` |
| Q-SM-VALUES (U-6) | **The code's wage values are correct.** SM on 1 ianuarie 2026 = **4,050 lei**; from **1 iulie 2026** = **4,325 lei**. 2026 bases: 6 SM 24,300 · 12 SM 48,600 · 24 SM 97,200 · 72 SM 291,600. The "8,100 / 8,600 lei, 1 August 2026" figures were a **hallucination and are void**. Mid-year rise does not re-anchor 2026 — ANAF states "291.600 lei (72 x 4.050 lei)" for 2026. | HG 1.506/2024, MO I 1185/28.11.2024; HG 146/2026, MO 196/13.03.2026; CF art. 135^1 alin. (3); ANAF Brașov `web_ian_2026.pdf` |

### Still blocking — UNVERIFIED, do not guess

| ID | Question | Blocks |
|---|---|---|
| Q-NONDEDUCT-VAT (U-1) | Does non-deductible TVA enter the deductible expense for a neplătitor de TVA? No affirmative operative rule found; inference only, Medium. **Must stay `REVIEW_REQUIRED`, never a computed rule.** | Phases 5, 8 |
| ~~Q-CASS-MINBASE (U-2)~~ | **CLOSED (Phase 4 research).** A 6-SM floor **does** exist for art. 68 sistem-real income, but it is imposed by **CF art. 174 alin. (6)**, not art. 170 alin. (2)-(3) — those reach only art. 155 alin. (1) lit. c)-h), and art. 68 is lit. b). The code's `min_base = 24,300` was **numerically right, mis-sourced**. It is a **top-up** ("o diferență de contribuție … până la nivelul … 6 salarii"), proven genuine by art. 118 alin. (2) lit. b)'s carve-out. Gated by **alin. (2)** (pierdere fiscală / VNA = 0 → **no CASS at all**, optare apart) and **alin. (7)-(8)**. Full text in `phases/02` §4. | closed — `phases/02` §4 |
| Q-CASS-NEGATIVE (U-8) | **CLOSED (Phase 5 research, 2026-10-06).** Neither **OUG 89/2025** (MO 1203/24.12.2025) nor **OUG 8/2026** (MO 147/25.02.2026) touches CF art. **154 / 170 / 174 / 180** — established by scanning **the acts themselves** (printable forms, full text, phrasing-agnostic `(La articolul\|articolul\|art\.)\s*<NN>` scan), not the consolidation notes. **Nothing shipped in Phases 3–4 is invalidated.** Two false positives to never re-misread: OUG 89/2025's single "art. 174" hit is **art. 174 alin. (5) din Legea 207/2015 Codul de procedură fiscală**, not the CF; OUG 8/2026's "art. 180" hit is a **reference inside OUG 8/2026's own art. 8** (2025-only 3% bonificație), not an amendment. The method also **vindicated the original suspicion**: OUG 8/2026 clauses 26-28 amend art. 68 alin. (5) and a note-based scan had missed them. Bonus: art. 118/123 score **0 hits in both acts**, so no 2025-2026 act touches art. 118 and only Legea 239/2025 touches art. 123 | `docs/ai/research/09_u8_amendment_scan_and_optare.md` §1 | closed | That OUG 89/2025 (MO 1203/24.12.2025) and OUG 8/2026 (MO 147/25.02.2026) leave CF art. 170 / 174 / 154 / 180 untouched. Only evidence is that the 2026 consolidated text already absorbs Legea 239/2025 and Legea 141/2025 and shows no further note — and this same evidence class silently omitted an art. 68 amendment once. **Absence of a note is not proof.** Closing it needs both OUGs' Art. I clause lists read directly. | Phase 4 recorded it as an open risk in `phases/04_cass.md` §9 — **still open**, not a blocker for the 2026 consolidated text as retrieved |
| Q-122-ATTRIBUTION (U-3) | Which act last amended CF art. 122 alin. (3)'s 25 May term? Text is HIGH, attribution MEDIUM. | Phase 9 (attribution only) |
| Q-QUARTERLY-DATES (U-4) | 2026 quarterly instalment **payment** due dates — need CF art. 123 alin. (2)-(4), 147/151 (CAS), 174 alin. (1)-(3) (CASS). | Phase 9 |
| Q-CAS-EXEMPTION (U-5) | **CLOSED (Phase 3)** — the exemption is CF **art. 150 alin. (1)** (pensionari / asigurați în propriul sistem de asigurări sociale), **not art. 147** (the monthly D112 declarative duty). Implemented via `CalculatorInput.pensionStatus`; art. 150 alin. (2) covers only art. 137 alin. (1) lit. b^1), so `salaryStatus` deliberately does NOT exempt. | closed — `phases/03_cas.md` §1–2 |
| Q-OMFP3254-HISTORY (U-7) | OMFP 3254/2017 amendment history — portal "Acțiuni suferite" returned 0 refs. In force is established via OMF 808/2026 art. 8's express scope (abrogates OMFP 870/2005 only). The net-of-VAT base rests on this act. | Phases 5, 8 |
| Q-IDENTITY-SOURCE | Is `profile.identity` canonical, or `settings.company` / `settings.personal`? | Phase 7 |
| Q-PERSISTENCE-VERSION | Add a `version` field + migration chain? Keep all-or-nothing corrupt recovery? | Phase 7 |
| Q-MONEY-UNIT | Integer bani or `decimal.js-light`? | Phase 10 |

Evidence for each resolved answer and each U-item: `docs/ai/phases/02_fiscal_baseline.md`.
Evidence for the original question framing: `docs/ai/steps/01_real_baseline.md` §7 (frozen archive).

## Documentation status

- `docs/ai/steps/01_real_baseline.md` — **new**; the authoritative baseline: inventory, five-bucket
  classification of 68 capabilities with `file:line` evidence, defect register B-1…B-12, identity and
  persistence findings, documentation-vs-reality tables, open questions.
- `docs/ai/PLAN.md` — resynced to this baseline; 8 previously unlisted step files (27_date_projection
  … 34) added; the "no e2e specs" claim removed; a "Forward roadmap (Phases 1–10)" section added.
- `docs/ai/steps/` — 32 step files now (01, 02–34; no 05, 06, 09) plus `_TEMPLATE.md`. Historical
  step files were **not** edited; where they conflict with step 01, step 01 supersedes them.
- `docs/ai/phases/02_fiscal_baseline.md` — **new (Phase 2)**; the authoritative 2026 fiscal baseline:
  verified values with act + article + MO/OPANAF reference + URL + confidence, the supersession of
  `research/06`, the citation corrections, the Q-PROVENANCE-SCHEMA ruling, the UNVERIFIED register
  (U-1…U-7) and the consolidated-text-lag caveat. `docs/ai/phases/` is a separate namespace from the
  frozen `docs/ai/steps/` archive.
- `docs/ai/research/06_2026_fiscal_research.md` — **SUPERSEDED** by `phases/02_fiscal_baseline.md`.
  A banner was added at the top; the body is left intact as a research record. It was wrong on the CAS
  minimum base, the VAT threshold, the phantom 30% expense cap and the 16% component, and it
  misattributed the VAT act to "OUG 22/2025" (correct: **Ordonanța** nr. 22/2025, an OG).
- `docs/ai/decisions/09_IMPLEMENTATION_ARCHITECTURE.md` — `:179` carries an inline correction of the
  "OUG 22/2025" attribution. Its "10-field provenance schema" (`:60`, `:168`) is **superseded** by the
  code's 17-field `FiscalRule`; the ADR body was not rewritten.
- `docs/ai/decisions/` — only 07 and 09 exist; ADRs for the fiscal corrections are still pending.
- `docs/audit-expenses.md:4` records a stale sandbox project root (`/c/AI/projects/pi-test`).
