# Step 01 — Real Baseline (Phase 1)

- **Date:** 2026-10-05
- **Branch:** `master`
- **HEAD:** `82073bff72934d1db7a854e5a693554174249785` ("Steps 27-34: Romanian date domain,
  recalculation & reserve, thresholds/deadlines, insights, dashboard sections, persistence
  resilience, e2e suite", 2026-10-04 07:13:22 +0300)
- **Phase scope:** Phase 1 — establish a truthful baseline before any correction work begins.
- **Changes in this step:** documentation only — **no source, test, or config file was modified.**
  Working tree at start was clean except untracked `test-results/`.
- **Supersedes:** `docs/ai/STATE.md` (2026-10-02 version), `docs/ai/PLAN.md` (2026-10-02 version),
  and the fiscal/stack claims of `docs/ai/steps/02_repo_scout.md`, `11_fiscal_rules.md`,
  `16_thresholds_deadlines.md`, `17_dashboard_intelligence.md`, `26_domain_tests.md`,
  `27_state_sync.md`. Those files remain as historical record; where they conflict with this file,
  **this file is authoritative.**

---

## 1. Branch decision

| Fact | Value |
|---|---|
| Authoritative baseline | `master` @ `82073bf` |
| `main` | `36c4e77` — a 23-file early snapshot and a **strict ancestor** of `master` |
| Commits total | 4 (`36c4e77` → `0919833` → `952ac07` → `82073bf`) |
| `master` delta over `main` | 3 commits ahead; 146 files; +20,433 / −665 |

Decision: **`master` is the baseline of record.** `main` is not merged, not rebased, not touched.
An earlier audit was produced against a `main` baseline; that audit is **superseded** by this
document and must not be used for planning.

---

## 2. Inventory of what actually exists

### 2.1 Verified tooling state (measured, all exit 0)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | "TypeScript: No errors found" (0 errors) |
| `npm run build` (`tsc && vite build`) | built in 1.93s |
| `npm run test` (vitest) | **36 test files, 450 tests, all passing** |
| `npm run test:e2e` (playwright) | **23 tests, all passing** |

Resolved versions: react 18.3.1, vite 5.4.21, typescript 5.9.3, vitest 3.2.7,
@playwright/test 1.63.0. `docs/ai/steps/02_repo_scout.md:24` claims "React 19.2.4 + TypeScript
5.9.3 + Vite 7.3.1" and `build` = `tsc -b && vite build` — **false**; `docs/ai/README.md:13` is
correct.

### 2.2 Source tree

- `src/domain/` — aggregation, completeness, deadlines, derived, insights, profile, projection,
  tax, taxReserve, thresholds, date, models, schema, repo.
- `src/domain/fiscal/` — `rules.ts`, `calculators.ts`, `package2026.ts`, `release2026.ts`,
  `select.ts`, `index.ts`.
- `src/domain/snapshots/` — snapshot builder, serialize, hash, types.
- `src/data/` — `store.tsx`, `schema.ts`, `seed.ts`, `types.ts`, `dashboard.ts`, `derived.ts`,
  `dashboardAdapter.ts`.
- `src/pages/` — Dashboard, Revenues, Expenses, EFactura, Declarations, Documents, Clients,
  Settings (8 pages).
- `src/components/` and `src/components/dashboard/` — FinancialChart, FinancialSummary, Insights,
  TaxReserve, and the Threshold / Deadline / Completeness / Action / Legislation sections.
- `e2e/dashboard.spec.ts` — 23 Playwright tests (Chromium only; `playwright.config.ts` declares no
  `projects`). `playwright.firefox.config.ts` is supplementary, run via `--config`.
- `docs/` — 44 `.md` + 7 PNG. `docs/ai/`: `PLAN.md`, `STATE.md`, `README.md`. `decisions/`: 07, 09.
  `research/`: 05, 06. `steps/`: 32 files (`_TEMPLATE.md` + 02→34; 01/05/06/09 had no step file
  until this one).

### 2.3 Test distribution (36 unit files)

1 `src/` · 9 `src/components/` · 8 `src/data/` · 13 `src/domain/` (incl. 2 `fiscal/`, 1
`snapshots/`) · 5 `src/pages/`. **Untested pages: `Documents.tsx`, `EFactura.tsx`, `Expenses.tsx`.**

---

## 3. Classification table

Every capability appears in exactly one bucket: **implemented** · **partially implemented** ·
**scaffolded** · **broken** · **documented but not implemented**.

| # | Capability | Bucket | Evidence | Note |
|---|---|---|---|---|
| 1 | Fiscal rule model + provenance fields (17 fields) | implemented | `src/domain/fiscal/rules.ts:19-37` | `ruleId, name, jurisdiction, entityType, taxRegime, taxYear, effectiveFrom, effectiveTo, parameters, calculatorId, sourceAct, sourceArticle, sourceUrl, verifiedAt, status, version, supersededBy` |
| 2 | 2026 rule package: 8 ACTIVE rules | implemented (structure only) | `src/domain/fiscal/package2026.ts:14-145` | values contested — see §6, §7 |
| 3 | Release object with `evidence[]` + status | implemented | `src/domain/fiscal/release2026.ts:3-27` | `status: 'SAFE_ACTIVATION'` (:18); `evidence` = 2 legalteka URLs only (:20-23); notes admit "no legislation ingestion applied" (:26) |
| 4 | Rule status lifecycle (PROPOSED→ACTIVE→SUPERSEDED) | scaffolded | `src/domain/fiscal/rules.ts:3-9` | type only; no lifecycle code enforces it |
| 5 | Rule selection by tax year / status | partially implemented | `src/domain/fiscal/select.ts:11` | filters ACTIVE only; no supersession resolution |
| 6 | Release / year resolution layer | broken | `src/data/dashboard.ts:85-93`, `src/data/derived.ts:66-74` | both reference `PFA_2026_SYSTEM_REAL_PACKAGE` / `PFA_2026_RELEASE` directly; package selection is hardcoded |
| 7 | CAS calculation | **broken** | `src/domain/fiscal/calculators.ts:39-58` | flat clamp `max(base,min_base)` then `min(...,max_base)`; no 12/24-SMBT tier branching; no salary/pension exemption branch; `max_cas` never applied; zero/loss income forces base 48,600 → CAS 12,150 |
| 8 | CASS calculation | **broken** | `src/domain/fiscal/calculators.ts:60-82` | rate and `max_annual_base` applied, but `base < min_base` returns `reviewRequired` (:67-69) instead of applying the minimum base; `max_cass` never read |
| 9 | Income tax, 10% base rate | partially implemented | `src/domain/fiscal/calculators.ts:84-99` | `base * baseRate` only (:90) |
| 10 | 16% progressive surcharge | **broken** | `calculators.ts:96` + `package2026.ts:109` | `progressive_rate: 16` is dead data; only a NOTE string exists while status stays `'computed'` → engine under-reports tax and claims success |
| 11 | 30% deductible-expense cap | **broken** | `src/domain/tax.ts:52-54` | absent from the rule stock, and its absence short-circuits the whole regime |
| 12 | Default regime reaches the engine | **broken** | `src/domain/tax.ts:52-54` + `src/domain/profile.ts:41` + `src/data/seed.ts:7` | default regime is `impozit_pe_venit`, exactly the regime line 52 rejects → the default user gets no tax estimate |
| 13 | Tax engine sequence (gross→deductible→CAS→CASS→taxable→tax) | implemented | `src/domain/tax.ts:57-95` | VAT excluded from the taxable base (:58-59) |
| 14 | `REVIEW_REQUIRED` sentinel | partially implemented | `calculators.ts:3` (emitted :32,68,88,110); `tax.ts:29,31-33`; `derived.ts:104,142`; `rules.ts:46`; `data/schema.ts:120` | three spellings (`ReviewRequired`, `review_required`, `REVIEW_REQUIRED`), no single contract |
| 15 | Calculation snapshots (serialize + hash) | implemented | `src/domain/snapshots/`; validated at `src/data/schema.ts:127-141` | |
| 16 | Financial aggregation | implemented | `src/domain/aggregation.ts:17-25,85-104` | float accumulation at :97,98,103,104 |
| 17 | Money representation | partially implemented | `rules.ts:14`, `calculators.ts:9`, `aggregation.ts:17-25`, `snapshots/types.ts:30`, `models.ts:84` | JS `number` floats in lei, never integer bani; cents exist only as display conversion (`aggregation.ts:60-65`, `data/dashboard.ts:230-235`, `insights.ts:36-37`) |
| 18 | `decimal.js-light` money arithmetic | documented but not implemented | declared at `package.json:16`; **zero imports in `src/`** | contradicted by `docs/ai/decisions/09_IMPLEMENTATION_ARCHITECTURE.md:43,202` |
| 19 | Derived state invalidation / recomputation | implemented | `src/domain/derived.ts:107,145` | `inputsKey` hashing includes profile fields the engine never reads |
| 20 | Threshold engine | implemented | `src/domain/thresholds.ts:116,144,159,251,263` | `statusFor`, `breachMeaningFor`, `computeThresholds`, ratio-rule helpers |
| 21 | Deadline engine | partially implemented | `src/domain/deadlines.ts:4-10,28` | `DeadlineQuery.eventDate` exists but is never fed from a profile — no profile field holds a start **date**, only `pfaStartYear: number` |
| 22 | Quarterly instalment / D112 rules | documented but not implemented | `src/domain/deadlines.ts:4-10` | `cas_quarterly`, `cass_quarterly`, `income_tax_advance` event types exist; no rule drives them |
| 23 | Fiscal loss carry-forward | documented but not implemented | `src/domain/tax.ts:82-88` | `taxable <= 0` zeroes tax; only a comment at `thresholds.ts:11` |
| 24 | Dashboard data layer | implemented | `src/data/dashboard.ts:57,61,65,69,73,82,97,108,120,132,146,180,241` | **13** public functions, not the 15 claimed at `STATE.md:26` |
| 25 | Dashboard shell, panels, Recharts graph | implemented | `src/pages/Dashboard.tsx`, `src/components/FinancialChart.tsx`, `FinancialSummary.tsx`, `Insights.tsx`, `TaxReserve.tsx`, `src/components/dashboard/` | |
| 26 | Store CRUD (revenues, expenses, clients, declarations, documents, statements, snapshots) | implemented | `src/data/store.tsx:180-215` | |
| 27 | Clients edit replaces by id | implemented | `src/data/store.tsx:185`; `src/pages/Clients.tsx:145` | `updateClient` maps by id; the page spreads `{...editing, ...c}` preserving the id → the `main`-branch "Clients edit duplicates the record" bug is **FIXED** on `master` |
| 28 | Clients edit regression coverage | implemented | `src/data/store.edit.test.tsx:39-95` (4 cases, incl. missing-id no-op at :91); `src/data/store.save.test.tsx:125` | no e2e coverage of Clients — e2e is dashboard-only |
| 29 | localStorage persistence | implemented | `src/data/store.tsx:14` (key `pfa-app-data-v2`), `:105` load, `:145` save | write-on-change effect; write failure logged and swallowed (`:150`) |
| 30 | Persisted-payload validation | implemented | `src/data/schema.ts:186-215` (`persistedAppDataSchema`), `:222-232` (`parseAppData`) | zod, with compile-time type-equality assertions at `:240-252` |
| 31 | Persisted schema **versioning** | scaffolded | `src/data/schema.ts:196-207` | **no `version` field in the persisted shape and no versioned migration chain anywhere in `src/data/`** |
| 32 | Legacy profile backfill | implemented | `src/data/store.tsx:68-101`, `:118` | `legacyProfileFromSettings` runs only when `profile` is absent; copies `settings.company` / `settings.personal` into `profile.identity` |
| 33 | Corrupt-payload recovery | partially implemented | `src/data/store.tsx:109-114,132` | all-or-nothing: any invalid field discards the whole dataset and loads seed data; no partial recovery, no user-visible warning |
| 34 | `dataOrigin` ('seed' \| 'persisted') flag | scaffolded | `src/data/store.tsx:26-27,139,172` | computed and unit-tested (`store.load.test.tsx:198-239`) but **never surfaced in any UI component** |
| 35 | `Repository<T>` persistence contract | scaffolded | `src/domain/repo.ts:8-15` | interface only; no implementer; the store satisfies it informally (doc comment `:5-6`) |
| 36 | Profile model + zod mirror | implemented | `src/domain/models.ts:66-89`; `src/domain/schema.ts:29-44` | 13 fields |
| 37 | Profile as fiscal input | partially implemented | read at `src/domain/tax.ts:41,43,44,48-50,52,58,59,71,77` | engine reads only `fiscalYear`, `regime`, `vatExempt`, `socialInsuranceStatus`, `id` (presence only). **Never read:** `caen`, `salaryStatus`, `pensionStatus`, `otherIncome`, `cashFloorLei`, `pfaStartYear`, `identity`, `updatedAt` |
| 38 | `createDefaultProfile` / `getActiveProfile` / `profileIdentity` | scaffolded | `src/domain/profile.ts:32,61,70` | exported and unit-tested, **never called by app code** (only `profile.test.ts`) |
| 39 | `updateProfile` store method | scaffolded | `src/data/store.tsx:52,213` | **no UI caller**; exercised only in `src/data/derived.test.tsx:61` → the profile, and with it every fiscal input, is not editable in the app |
| 40 | Displayed identity — topbar | partially implemented | `src/App.tsx:127,221,222` | name and avatar initials read `profile.identity.nume`; nothing else in the chrome reads identity |
| 41 | Displayed identity — sidebar | implemented (static brand) | `src/App.tsx:183-184` | hardcoded "SOLO"; not user identity |
| 42 | Dashboard greeting from identity | documented but not implemented | `src/pages/Dashboard.tsx` contains no identity reference | no greeting anywhere in `src/` reads identity |
| 43 | Settings → identity write path | **broken** | `src/pages/Settings.tsx:34-37,50-53,369,373,377` vs `src/App.tsx:221` | Settings writes `settings.company` / `settings.personal`; the topbar reads `profile.identity`; the two are reconciled only once, at first load with no profile (`store.tsx:118`). Personal Nume / Email / Telefon inputs are `disabled` |
| 44 | Settings writes consumed downstream | **broken** | grep over `src/`: no reference to `settings.company`, `settings.personal`, `settings.cotaTva`, `settings.eFactura` or `settings.bankAccounts` outside `src/pages/Settings.tsx` | every Settings edit persists to localStorage and is read by nothing else in the app |
| 45 | `settings.cotaTva` | scaffolded | `src/data/types.ts:110`, `src/data/schema.ts:188`, `src/data/seed.ts:83` (value 9) | seeded and validated, never read by any consumer |
| 46 | Provenance quality on ACTIVE rules | **broken** | `package2026.ts:77-79,96-98,112-114,127-129,142-144` | 5 of 8 ACTIVE rules carry `sourceAct: 'ANAF 2026'`, `sourceUrl: 'https://www.anaf.ro'` (homepage, not a document) and a self-referential `sourceArticle` (e.g. `'CAS 2026'`) |
| 47 | Wage rules with real citations | implemented | `package2026.ts:33-46` (HG 1506/2024), `:48-61` (HG 146/2026) | the only 3 rules naming an act and a document URL |
| 48 | Declared caps enforced | **broken** | `package2026.ts:22-25,74,93,109` | `multiple_6x/12x/24x/72x`, `max_cas`, `max_cass`, `progressive_rate` are declared and never read by any calculator → caps silently unenforced |
| 49 | e2e suite | partially implemented | `e2e/dashboard.spec.ts` (23 tests, all passing) | dashboard only; `Documents.tsx`, `EFactura.tsx`, `Expenses.tsx` untested; Chromium only |
| 50 | Firefox e2e config | scaffolded | `playwright.firefox.config.ts` | not referenced by `playwright.config.ts` (no `projects`); must be run with `--config` |
| 51 | NORMA_VENIT (normă de venit) regime | documented but not implemented | zero matches repo-wide | |
| 52 | CAEN as a fiscal driver | documented but not implemented | `models.ts:73` free-text; `Settings.tsx:200-202` display only | no rule keys on CAEN |
| 53 | Salary / pension CAS-CASS exemption logic | documented but not implemented | `models.ts:75,77` carried; no rule or calculator reads them | |
| 54 | VAT regime beyond boolean `vatExempt` | documented but not implemented | `models.ts:83` | no scutit/înregistrat type, no `cotaTva` in the fiscal layer, no VAT payable/deductible computation |
| 55 | Document date semantics (issued / received / paid) | documented but not implemented | `aggregation.ts:85-87,96,102`; `derived.ts:48` | a single `date` field for every event |
| 56 | SMBT 12 / 24 branch conditions | documented but not implemented | `package2026.ts:71-72,90-91` | the tiers exist only as `FiscalParameter.label` strings |
| 57 | Runtime supersession | documented but not implemented | `rules.ts:27,36`; `select.ts:11` | types exist; no 2025 package; selection filters ACTIVE only |
| 58 | Currency / FX | documented but not implemented | — | no FX handling anywhere |
| 59 | `generateInsights()` | documented but not implemented | claimed by `docs/ai/steps/17_dashboard_intelligence.md`; `src/domain/insights.ts:161` exports `getInsights`; no `generateInsights` in `src/` | |
| 60 | `CompletenessAssessment.score` | documented but not implemented | claimed by `steps/17`; `src/domain/completeness.ts:39` — "Deliberately NO percentage and NO score"; confirmed by `completeness.test.ts:319` | |
| 61 | CZK / €50,000 micro-enterprise framing | documented but not implemented | `steps/17`; no CZK/EUR regime in `src/domain/fiscal/` | |
| 62 | `daysUntilWarning` export | documented but not implemented | claimed by `steps/16`; `src/domain/thresholds.ts` exports `statusFor:116`, `breachMeaningFor:144`, `computeThresholds:159`, `RatioRuleStatus:213`, `RatioRule:226`, `statusForRatioRule:251`, `withRatioRuleStatus:263`; the name survives only as a test title at `thresholds.test.ts:115` | |
| 63 | `ScenarioDraft`, `src/domain/selectors`, `actIdentity{actNumber,actType,sourceUrl}` | documented but not implemented | `docs/ai/decisions/09_IMPLEMENTATION_ARCHITECTURE.md:60,118,145` | |
| 64 | `src/store.ts` with `markExpenseAsPaid` / `completeDeclaration` | documented but not implemented | claimed by `docs/ai/STATE.md:36`; no `src/store.ts` exists (store is `src/data/store.tsx`); neither symbol exists in `src/`; only `addDeclaration` at `store.tsx:43,187` | |
| 65 | The docs' "10-field provenance schema" | documented but not implemented | `research/06:226`; `decisions/09:60,71-73,168` | docs list 11 names **without** `verifiedAt` and call it a 10-field schema; code has 17 fields **including** `verifiedAt` (`package2026.ts:7`, asserted at `fiscal.test.ts:27`) and names the field `taxRegime`, not `regime` |
| 66 | `react-router-dom` routing | documented but not implemented | declared in `package.json`; never imported — `src/App.tsx:1` uses `useSyncExternalStore` with hand-rolled `parseRoute()` / `pushState` | |
| 67 | Ambient types (`src/vite-env.d.ts`) | scaffolded (hygiene, not a defect) | no `*.d.ts` anywhere; CSS side-effect imports at `src/main.tsx:4-5` | empirically tsc-clean because `tsconfig` `include: ["src"]` excludes root configs; latent robustness gap |
| 68 | `test-results/` / `playwright-report/` ignore rules | scaffolded (hygiene, not a defect) | both untracked and absent from `.gitignore` | |

---

## 4. Broken register

The seven defects that define this baseline:

| ID | Defect | Evidence | Effect |
|---|---|---|---|
| B-1 | Default profile regime short-circuits the tax engine to `review_required` | `src/domain/tax.ts:52-54`; default regime `src/domain/profile.ts:41`; seeded profile `src/data/seed.ts:7` | the default user gets **no tax estimate at all** |
| B-2 | CAS is a flat clamp that ignores the SMBT tier semantics its own parameter labels claim | `src/domain/fiscal/calculators.ts:39-58` vs labels at `package2026.ts:71-72` | CAS is wrong between the tiers; zero/loss income forces base 48,600 → CAS 12,150 |
| B-3 | CASS returns `reviewRequired` instead of applying its own `min_base` | `src/domain/fiscal/calculators.ts:67-69` | low-income profiles halt instead of paying the statutory minimum |
| B-4 | `progressive_rate: 16` is dead data while the result is still reported `status: 'computed'` | `calculators.ts:96` (NOTE only) + `package2026.ts:109` | the engine **under-reports tax and claims success** |
| B-5 | 5 of 8 ACTIVE rules carry non-resolvable provenance placeholders | `package2026.ts:77-79,96-98,112-114,127-129,142-144` | rule values cannot be traced to a legal act |
| B-6 | Declared caps never read | `package2026.ts:22-25,74,93,109` | `max_cas`, `max_cass`, `multiple_6x/12x/24x/72x` are silently unenforced |
| B-7 | `docs/ai/STATE.md` and `docs/ai/PLAN.md` contain materially false claims | §6 | the team planned against a fiction |

Additional defects found in Phase 1 while covering the identity / persistence territory:

| ID | Defect | Evidence | Effect |
|---|---|---|---|
| B-8 | Identity has two unreconciled stores: `profile.identity` (read by the topbar) and `settings.company` / `settings.personal` (written by Settings) | `src/App.tsx:221-222` vs `src/pages/Settings.tsx:34-37,50-53` | editing the company name in Settings never changes what the app displays; the two diverge indefinitely |
| B-9 | No UI path can write the profile | `src/data/store.tsx:52,213` — `updateProfile` is never called outside `src/data/derived.test.tsx:61` | every fiscal input (`regime`, `vatExempt`, `socialInsuranceStatus`, `cashFloorLei`, `fiscalYear`) is fixed at seed values |
| B-10 | Every Settings write is inert downstream | no reference to `settings.*` outside `src/pages/Settings.tsx` | the Settings page is a localStorage form, not a configuration surface |
| B-11 | Corrupt payload → silent full reset to seed data | `src/data/store.tsx:109-114,132` | one invalid field destroys all user data with no warning; `dataOrigin` is never surfaced |
| B-12 | No persisted-schema version, therefore no migration path | `src/data/schema.ts:196-207` | future shape changes cannot be migrated; only "optional collection tolerated as missing" exists today |

---

## 5. Identity and persistence (Phase 7 territory, measured in Phase 1)

Measured by direct read of `src/data/store.tsx`, `src/data/schema.ts`, `src/domain/profile.ts`,
`src/domain/repo.ts`, `src/pages/Settings.tsx`, `src/App.tsx`, `src/pages/Dashboard.tsx`,
`src/pages/Clients.tsx`, `src/data/seed.ts`.

**5.1 Clients edit — FIXED.** `updateClient` replaces by id (`src/data/store.tsx:185`:
`clients.map(x => x.id === c.id ? c : x)`), and the Clients page calls it as
`updateClient({ ...editing, ...c })` (`src/pages/Clients.tsx:145`), preserving the id of the record
being edited. `addClient` (`store.tsx:184`) is the only append path and is reached only when
`editing === 'new'` (`Clients.tsx:141`). Regression coverage exists at
`src/data/store.edit.test.tsx:39-95` (4 cases, including a missing-id no-op at `:91`) and
`src/data/store.save.test.tsx:125`. There is **no e2e coverage of Clients** — the e2e suite is
dashboard-only.

**5.2 Displayed identity — one read site, two stores.** The only place the app renders user
identity is the topbar: `src/App.tsx:221` (`{profile.identity.nume}`) and `:222` (avatar initials
from the same value). The sidebar renders a hardcoded brand (`App.tsx:183-184`) and page titles
come from a static map (`App.tsx:46-55`). No Dashboard greeting reads identity. The value is
**persisted** (it is part of `AppData.profile.identity`, serialized at `store.tsx:145`) and
originates from `seedData` (`src/data/seed.ts:16-31`, `nume: 'Popescu Andrei'`) or, for pre-profile
payloads, from `legacyProfileFromSettings` (`store.tsx:68-101`). The Settings page writes a
**different** store (`settings.company` / `settings.personal`) that the chrome never reads, and its
personal Nume / Email / Telefon inputs are `disabled` (`Settings.tsx:369,373,377`). Consequence:
identity is a single read site but not a single source of truth — see B-8, B-9.

**5.3 Persistence.** Key `pfa-app-data-v2` (`store.tsx:14`). Load: `loadInitial()` at
`store.tsx:103-133` → `localStorage.getItem` → `parseAppData` (`data/schema.ts:222-232`) → zod
`persistedAppDataSchema` (`:186-215`). Save: write-on-change effect at `store.tsx:143-151`,
`JSON.stringify(data)` of the whole `AppData`. Required collections: `revenues` + `settings`;
everything else is optional and backfilled (`:118-127`). Failure behaviour: bad JSON, non-object,
missing required collection, or any invalid field → `parseAppData` returns `null` → **whole dataset
replaced by seed data** (`:109-114`); the outer `catch` does the same (`:132`). Write failures are
logged and swallowed (`:150`). Nothing is persisted outside localStorage. **There is no `version`
field and no migration chain** — the only migration-like logic is the profile backfill at `:118`.

**5.4 Settings fields.** PFA tab: Denumire, CUI, Număr reg. com. (editable, saved by `saveCompany`,
`Settings.tsx:50-53`); Adresa (read-only + copy, `:179`); CAEN list (display only, `:200-202`);
Mențiuni pe factură (editable, `:55-61`); Cod TVA intracomunitar (editable via modal, `:87-93`).
e-Factura tab: `trimitere` and `dateContact` selects (`:269-270,284-285`, saved by `saveEf`
`:63-66`). Conturi bancare: add-only, no delete (`:100-110`). Personal: Nume / Email / Telefon all
`disabled` (`:369,373,377`); "Schimbă parola" and "Gestionează cookies" emit toasts only. **Every
one of these persists and none is read by any other module** (B-10). `settings.cotaTva` is seeded
as 9 (`seed.ts:83`) and read nowhere.

**5.5 PFA profile record.** Yes — `PfaProfile` (`src/domain/models.ts:66-89`), stored as
`AppData.profile`, seeded at `src/data/seed.ts:3-32`, defaulted by `createDefaultProfile`
(`src/domain/profile.ts:32`) — which **app code never calls** — or backfilled by
`legacyProfileFromSettings` (`store.tsx:68`). It carries `identity: PfaIdentity`
(`models.ts:87`, `profile.ts:9-24`) and the topbar reads it (`App.tsx:221`). The domain helper
`profileIdentity()` (`profile.ts:70`) is dead in app code. `updateProfile` (`store.tsx:213`) has no
UI caller, so the profile is effectively read-only at runtime.

---

## 6. Documentation vs reality

### 6.1 `docs/ai/STATE.md` (2026-10-02) claim → verdict

| STATE.md | Claim | Verdict | Evidence |
|---|---|---|---|
| `:3` | "Last sync: 2026-10-02 (step 27)" | STALE | HEAD is `82073bf`; steps run to 34 |
| `:8`, `:37` | "28 test files, 102 tests, all passing" | **FALSE** | 36 files / 450 tests, measured exit 0 |
| `:9` | Area split 1 app / 6 components / 4 data / 13 domain / 4 pages | **FALSE** | actual 1 / 9 / 8 / 13 / 5 = 36 |
| `:10` | Latest commit `952ac07` | STALE | HEAD is `82073bf` |
| `:16-19` | Domain foundation list | TRUE | all present |
| `:20` | `fiscal/` = rules, calculators, package2026 | TRUE but incomplete | also `release2026.ts`, `select.ts`, `index.ts` |
| `:26` | "15 public functions" in `data/dashboard.ts` | **FALSE** | 13 — `src/data/dashboard.ts:57,61,65,69,73,82,97,108,120,132,146,180,241` |
| `:36` | `markExpenseAsPaid`, `addDeclaration`, `completeDeclaration` in `src/store.ts` | **FALSE** | no `src/store.ts` exists; store is `src/data/store.tsx`; neither other symbol exists in `src/`; only `addDeclaration` at `store.tsx:43,187` |
| `:41-42`, `:48` | "no e2e/Playwright specs exist", "zero specs" | **FALSE** | `e2e/dashboard.spec.ts`, 23 tests passing |
| `:54` | 16% surcharge not implemented | TRUE | `calculators.ts:90` `base * baseRate`; `:96` NOTE only |
| `:54-55` | "impozit pe venit returns `review_required`" attributed to the 16% surcharge | TRUE but **MISATTRIBUTED** | the halt is the 30% deductible cap at `tax.ts:52-53` |
| `:56` | CASS minimum-base handling halts the engine | TRUE | `calculators.ts:67-69` |
| `:57`, `:66` | Fiscal loss carry-forward absent | TRUE | only a comment at `thresholds.ts:11` |
| `:58` | Stale refs in thresholds/deadlines doc | TRUE | `steps/16:84-86` |
| `:71` | "steps 02–27 present" | STALE | 32 step files through step 34 |
| `:76` | ADRs pending for fiscal corrections | TRUE | `decisions/` holds only 07 and 09 |

### 6.2 `docs/ai/PLAN.md` (2026-10-02) gaps

- `:1-3` sync line points at 2026-10-02 / step 27.
- `:5-33` completed-steps table has 27 rows (02–27) and **omits 8 step files that exist**:
  `27_date_projection`, `28_recalculation_and_reserve`, `29_thresholds_and_deadlines`,
  `30_insights_correction`, `31_dashboard_remaining_sections`, `32_dashboard_polish`,
  `33_persistence_resilience`, `34_final_automated_tests`.
- `:26` repeats the false "28 test files, 102 tests".
- `:50` repeats "No e2e/Playwright specs exist; `playwright.config.ts` is scaffolded only" — **FALSE**.
- `:36` "no step files exist for 01, 05, 06, 09" is true of `steps/`, but artifacts do exist at
  `research/06_2026_fiscal_research.md` and `decisions/09_IMPLEMENTATION_ARCHITECTURE.md`.
  (01 now exists: this file.)
- The false counts live **only** in STATE.md and PLAN.md: `steps/34_final_automated_tests.md:32,188,235-238`
  already records "**450 / 450 passed, 36 files**" and "23 e2e tests", matching the 2026-10-05
  measurement, and it explicitly supersedes its own earlier "35 files / 412 tests" snapshot (`:7`).
  `steps/26_domain_tests.md` contains no 28/102 claim.

### 6.3 The three fiscal contradictions

**Contradiction 1 — CAS minimum base: three mutually exclusive values.**
- `research/06:148` — "CAS minimum base = **6 SM = 24,300 lei** (2026) → min CAS 6,075/year |
  Codul fiscal + ANAF 2026 doc | art. 160 | High | None".
- `research/06:195` — "CAS minimum base conflict (rule 3): Batch 2 (ANAF 2026 official doc) states
  6 SM = 24,300; Batch 3's 2023-era secondary sources describe the **older 12-SM rule**. The ANAF
  2026 figure is treated as current."
- `research/06:220` (the section that declares itself superseding) — CAS at **12/24 SMBT**, "min CAS
  12,150 / 24,300", i.e. **12 SM = 48,600**.
- Code: `package2026.ts:71` `min_base` **48,600**, `min_cas` 12,150.
- Docs saying 12 SM: `steps/15:24,65`; `steps/16:50`; `steps/34:60,83-84`; `steps/26:35`.
  Docs saying 6 SM: `research/06:148,195`; `decisions/09:177` ("base range 6–24 SM = 24,300–97,200").
  Docs saying 1 SM (4,050): `steps/11:27` (uncited).
- So 4,050 / 24,300 / 48,600 all appear in the tree, and **the code follows the value the research
  doc itself labels the older rule.** This is the single most important unresolved item (Q-CAS-MINBASE).

**Contradiction 2 — VAT threshold: same file, 11 lines apart.**
- `research/06:187` — "VAT small-entrepreneur exemption: **300,000 lei** (including VAT) … art. 338".
- `research/06:190` — "OUG 22/2025 … **2025 ONLY** … **the 395,000 lei figure is NOT the 2026
  threshold** — for 2026 the standard 300,000 lei applies … **Dashboard warning:** do not use
  395,000 lei for 2026".
- `research/06:201` — "Superseding note (VAT threshold): the verified threshold is **395,000 lei**,
  applicable from 1 September 2025. This supersedes the 300,000 lei figure … where the two conflict,
  this section is the implementation authority."
- Code: `package2026.ts:124` threshold **395,000**, `effectiveFrom: '2025-09-01'`.
- `steps/11:30` still ships 300,000; `steps/16:54` and `steps/34:91` ship 395,000. (Q-VAT-THRESHOLD.)

**Contradiction 3 — CAS maximum base.** Consistent at 24 SM = 97,200 (`research/06:149`,
`decisions/09:177`, code `max_base` 97,200), but `research/06:149` rates its own confidence
**Medium** with "Full text of art. 160 not directly verified". No doc states a 12 SM maximum; 12 SM
appears only as a minimum. (Q-CAS-MAXBASE-CONFIDENCE.)

### 6.4 Miscited articles

- `docs/ai/steps/16_thresholds_deadlines.md:50-51` cites CAS bases to "Legea 227/2015 art. 149",
  but `research/06:148-149` attributes CAS bases to **art. 160**.
- `:52-53` cites CASS bases to "art. 160", but CASS is **art. 170** per `research/06:143-145`.
- `:54` cites VAT to "Cod Fiscal art. 338" (correct article) but omits the Legea 296/2023 amendment
  named at `research/06:201`.
- `:84` says "CAS: positive means the base has crossed the **395,000 CASS threshold**" — factually
  wrong (395,000 is the VAT figure; the CASS cap is 291,600) and self-contradicting against its own
  table at `:50-54`.

### 6.5 Uncited fiscal numbers in step files

`steps/11:27-30` (CAS min base 4050, min CAS 1012.5, CASS min base 4050, max annual 48600, min CASS
405, VAT 300000, income-tax `base_limit` 48600) — all sourced to "ANAF 2026" only, all superseded or
wrong. `steps/15:65-66,69` — CAS/CASS bases uncited. `steps/15:178-180` — 16% threshold "NOT a fixed
statutory number", no source. `steps/34:60,62,83-86,91` and `steps/26:35` — test-derived, uncited.

### 6.6 Step files describing work not in the code

`steps/17` claims `generateInsights()`, `CompletenessAssessment.score`, and a CZK / €50,000
micro-enterprise framing — none exist. `steps/16` claims a `daysUntilWarning` export — it does not
exist. `steps/11` ships package values that are not in the code. `decisions/09:60,118,145` describe
`ScenarioDraft`, `src/domain/selectors` and `actIdentity{}` — not implemented. See rows 59-63 of §3.

### 6.7 Policy that IS correctly documented

The `REVIEW_REQUIRED` policy is stated consistently and must be honoured by all later phases:
`decisions/09:14`, `research/06:242` ("Workers must not invent unsupported tax rules … no speculative
formulas, rates, thresholds, or deadlines"), `decisions/09:185`, `steps/16:145`, `steps/30:58`,
`steps/14:102`.

### 6.8 Supersession statement

The historical step documents (`docs/ai/steps/02`–`34`), `docs/ai/decisions/*`,
`docs/ai/research/*` and the top-level `docs/*.md` are **not edited** by this step. Where any of
them states a test count, a stack version, a fiscal value, an article citation, or a capability that
this file classifies differently, **this file, `docs/ai/PLAN.md` and `docs/ai/STATE.md` as updated
on 2026-10-05 supersede them.**

---

## 7. Open baseline questions (BLOCKING for Phase 2)

| ID | Question | Why it blocks | Evidence |
|---|---|---|---|
| Q-CAS-MINBASE | Is the 2026 CAS minimum base **6 SM (24,300)** or **12 SM (48,600)**? | CAS cannot be corrected (Phase 3) until the base is fixed; the code currently follows the value the research doc calls "older" | `research/06:148` vs `:195` vs `:220`; `package2026.ts:71` |
| Q-VAT-THRESHOLD | Is the 2026 VAT threshold **300,000** or **395,000**? | Threshold warnings and the dashboard badge are wrong for one of the two answers | `research/06:187` vs `:190` vs `:201`; `package2026.ts:124` |
| Q-CAS-MAXBASE-CONFIDENCE | Is 24 SM = **97,200** confirmed? | Consistent across docs but self-rated Medium confidence, "art. 160 not directly verified" | `research/06:149`; `package2026.ts:72` |
| Q-16PCT | What is the 2026 national average gross salary that the 6× surcharge threshold needs? | Without it the 16% surcharge cannot be computed or bounded; `multiple_6x` (24,300) is 6× **minimum** wage, not 6× average gross, and is never read | `calculators.ts:96`; `package2026.ts:22,109` |
| Q-30PCT-CAP | Is the 30% deductible-expense cap in scope for 2026 PFA? | It currently blocks the **default** regime entirely; either it is implemented or the short-circuit is re-scoped | `tax.ts:52-54`; `profile.ts:41` |
| Q-NETGROSS | Are `Declaration.venituri` / `cheltuieli` net or gross? | The engine branches on VAT-exempt status to pick gross vs net; the declaration fields carry no unit | `data/schema.ts:73-74`; `tax.ts:58-59` |
| Q-PROVENANCE-SCHEMA | Which schema is authoritative: the docs' 10/11-field set without `verifiedAt`, or the code's 17 fields including `verifiedAt` and `taxRegime`? | Phase 2 provenance work and any rule-validation test depend on one answer | `research/06:226`; `decisions/09:60,168`; `rules.ts:19-37`; `package2026.ts:7`; `fiscal.test.ts:27` |

Secondary questions (not blocking Phase 2, must be resolved before the phase that needs them):

- **Q-IDENTITY-SOURCE** — is `profile.identity` the canonical identity, with `settings.company` /
  `settings.personal` deprecated, or the reverse? Blocks Phase 7. Evidence: B-8, B-9, B-10.
- **Q-PERSISTENCE-VERSION** — does the persisted payload gain a `version` field with a migration
  chain, and should corrupt-payload recovery stay all-or-nothing? Blocks Phase 7 (persistence and
  migration). Evidence: `data/schema.ts:196-207`; `store.tsx:109-114`.
- **Q-MONEY-UNIT** — integer bani or `decimal.js-light`? The dependency is already declared and
  unused. Blocks Phase 10. Evidence: `package.json:16`; `aggregation.ts:97-104`.

---

## 8. What this step changes for planning

1. Phase 2 is **not** "add provenance fields" — the model already has 17 of them
   (`rules.ts:19-37`). It is "replace placeholder provenance on 5 rules and resolve the numeric
   contradictions".
2. The e2e suite exists and passes (23 tests); planning must stop treating Playwright as
   not-started.
3. Test counts are 36 files / 450 unit tests, not 28 / 102.
4. The Clients duplicate bug is already fixed on `master`.
5. Seven fiscal defects (B-1…B-7) and five identity/persistence defects (B-8…B-12) are the real
   backlog; none of them is mentioned in the previous STATE.md.
6. **Orchestrator handoff error, recorded for traceability.** The Phase-1 brief omitted Phase 8
   entirely, which caused the first draft of `PLAN.md` to label Phase 8 "undefined (UNVERIFIED)" and
   to park the persistence defects B-11/B-12 there. That label was wrong and has been corrected:
   **Phase 8 is Financial Amount Semantics** — separating transaction/cash amount, VAT amount, amount
   excluding VAT, gross amount, deductible expense and tax-relevant income; ensuring VAT does not
   silently become PFA taxable income; and using the correct turnover basis for the VAT threshold
   (`REVIEW_REQUIRED` where the treatment is unsafe; no full VAT accounting system). The mislabel was
   an orchestrator handoff error, **not** a gap in the plan. B-11 and B-12 are re-assigned to Phase 7,
   the only phase that changes persisted-state shape. No finding in this document changes.
