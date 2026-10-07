# Phase 9 WORKER working notes — payment / collection dates (+ B-20)

**Purpose of this file:** crash/compaction recovery. It is a *working artifact*, not a source of record
(`docs/ai/notes/**` is explicitly non-authoritative). The deliverable is `docs/ai/phases/09_payment_dates.md`.

**Author:** Phase 9 Worker. Repo `/home/agent/workspace/solo-falcon-replica`, baseline HEAD `cd25e3c`.

---

## 0. THE TASK (verbatim intent of the orchestrator prompt)

I am the **WORKER for Phase 9 only**. Three items, all mine (brief §4):

1. **Date semantics.** Add the *minimum* required by art. 68 CF: a **collected** date on `Revenue`, a
   **paid** date on `Expense`, and make aggregation/engine select on the **fiscal date**. Do **not** build
   a receivables ledger or invoice workflow.
2. **B-20** (folded in by orchestrator decision 2026-10-06): `buildSnapshot`'s `breached: distance > 0`
   (`data/dashboard.ts:254`) is **inverted for `min-base` rows**, contradicting the domain `statusFor`
   which already handles floors correctly. **Fix by driving the flag off the domain status.**
3. **Feed `pfaStartDate` to `DeadlineQuery.eventDate`** — `computeDeadlines` is still called with only
   `{ taxYear, asOfDate }` (`data/dashboard.ts:193`), so event-relative deadlines resolve to `null`.

Handoff format (mandatory, final message):
`COMPLETED / FILES CHANGED / TESTS / VALIDATION / DECISIONS / BLOCKERS / NEXT HANDOFF`

Stop when brief §7 acceptance criteria are met. **Do not start Phase 10.**

---

## 1. BASELINE (measured at HEAD `cd25e3c`) — my change must make these go UP, not down

| Command | Baseline |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run build` (`tsc && vite build`) | exit 0 |
| `npm run test` (vitest) | **41 test files, 587 unit tests**, all passing |
| `npm run test:e2e` (playwright, Chromium only) | **33 e2e** (`e2e/dashboard.spec.ts` 25 + `e2e/settings.spec.ts` 8) |

Acceptance floor: **> 587 unit tests** and **> 33 e2e tests**.

---

## 2. THE LEGAL BASIS (settled — do not re-open, do not re-research)

### 2.1 The falsified premise — DO NOT IMPLEMENT
There is **no 15-day collection threshold** in the Cod fiscal. CF **art. 80** is *„Termenul de plată a
impozitului"* — a **payroll** income-tax payment deadline (Titlul IV, Cap. III). Full-text scan of the
consolidated CF (2,535,020 chars): `"15 zile calendaristice"` → 0, `"prag de încasare"` → 0,
`"nu sunt deductibile dacă"` → 0; ANAF consolidated CF incl. HG 1/2016 norms (3,683,337 chars):
`"de la scadență"` → 0. Seven 2026 amending acts read directly: **0** touch art. 80.
→ **`src/domain/tax.ts:112` deducting every expense unconditionally is NOT a bug on that ground.**
Same class as Phase 3 deleting `CAS_MAX_BASE` (art. 148 alin. (2) has no CAS ceiling): **absence of a
provision is a finding; inventing one is the failure mode.**

### 2.2 What IS load-bearing — cite these where the fiscal date is chosen
- **Revenue — CF art. 68 alin. (2) lit. a)**: venit brut is measured by **„sumele încasate"** — amounts
  **COLLECTED**. (Amended by Punctul 30, Art. I din Legea 296/2020, MO 1269/21.12.2020; no 2025/2026 note.)
- **Expense — CF art. 68 alin. (4) lit. b)**, verbatim: *„să fie cuprinse în cheltuielile exercițiului
  financiar al anului în cursul căruia au fost plătite"* — the expense belongs to the year **in which it
  was PAID**. As originally enacted (MO 688/10.09.2015, in force 01.01.2016). No 2025/2026 amendment.
- **Consequence is ATTRIBUTION, not punishment.** A late-paid expense falls into the payment year; it is
  not permanently non-deductible.
- **The invoice ISSUE date is not a timing gate.** Art. 68 alin. (4) lit. a) requires expenses be
  *„justificate prin documente"* — the invoice is the justificativ, but its issue date does not determine
  the year. **So `collected`/`paid` is fiscally load-bearing; `issued` is not.** Do not build a
  three-date model assuming all three are legally equivalent.
- Source of record: `docs/ai/research/10_art80_negative_and_payment_timing_2026.md` (read in full) and
  `docs/ai/phases/02_fiscal_baseline.md:187-215`.

### 2.3 Citation caveats
- **C-1: NO CPF citations in the UI.** The CPF (Legea 207/2015) copy reached at Portal Legislativ doc
  172697 is headed *"actualizat la data de 1 ianuarie 2016"* — stale. Art. 173 alin. (1) and art. 336 alin.
  (1) lit. o)/p) must not be rendered.
- **C-2: CF art. 124 is NOT "accesorii"** — it is *„Venituri din bunuri sau drepturi care sunt deținute în
  comun"*. Repo cites art. 124 nowhere; keep it that way.
- Never cite `docs/ai/research/06_2026_fiscal_research.md` or `docs/ai/decisions/09_IMPLEMENTATION_ARCHITECTURE.md`
  as `sourceUrl` on a production rule.
- Open (attribution only, not blocking): Q-122-ATTRIBUTION (U-3), Q-QUARTERLY-DATES (U-4).

---

## 3. INVARIANTS THAT MUST NOT MOVE (proof I did not change the tax base)

On the seed, after my change:
- Engine **VNA (venitul net anual) = 7,494.50 lei** — unchanged.
- Seeded **total due = 3,104.505 lei** (renders `3.104,51`; `1.034,84`/month) — unchanged.
- Phase 8 threshold figures intact: **`VAT_REGISTRATION` measured on `revenue-excl-vat` = 7,700**
  (NOT the VAT-inclusive 9,317); the three contribution rows measured on **`net-income` = 7,494.50**.
  `YtdTotals.net` = 9,068.34 is **not** a fiscal base — never use it.
- Collections survive **by id** across migration.
- If any of these move, that is a signal I changed attribution → must be stated explicitly and proven intended.

---

## 4. TRAPS (brief §6) — re-read before editing

1. **Migration chain**: `CURRENT_DATA_VERSION = 2` at `src/data/migration.ts:39`. **APPEND** a v2→v3 step.
   Never renumber; never rewrite v0→v1 (`profile-materialization`) or v1→v2 (`identity-absorption`).
   New fields **optional**; a step must **never invent a value**; a step that doesn't bump the version
   throws loudly (chain enforces it).
2. **Phase 7's F-1 lesson**: `canonicalize` serializes every key, so if `Revenue`/`Expense` records are
   embedded in a stored snapshot's `inputSnapshot`, adding a field changes that digest. **Verify** whether
   they are (search `inputSnapshot`, `canonicalize`, `addSnapshot`) before claiming unaffected.
   `addSnapshot` still has **no production caller** → practical exposure may be nil, but verify.
3. **Do not silently change the tax base** (see §3).
4. **Do not implement the non-existent 15-day rule.**
5. **No CPF citations in the UI.**
6. No 16% CASS rate; no invented norm values; **do not "fix" the seed's 21% VAT ratio** (it is statutory —
   the 0.01 drift is `85.5 × 21%` rounded to `17.96`); `settings.cotaTva` is read nowhere — leave it.
7. **Money representation + rounding policy are Phase 10's** (owns B-17). Do not centralise rounding, do
   not invent a legal rounding rule. `decimal.js-light` is declared at `package.json:16` and never imported — leave it.
8. `docs/ai/steps/**` (02–34) is a **frozen archive**: never rename/delete/renumber/overwrite, never cite
   as evidence of current behaviour.
9. Out of scope: receivables/payables ledger, invoice workflows, banking, e-Factura plumbing, payroll
   modelling (`salaryStatus`/`salaryIncomeLei` describe the **owner**, not employees), B-19, the 24 SM
   tier-floor surface, `playwright.config.ts:9` (LSP-only diagnostic, not a defect), undoing Phase 8.

---

## 5. EXPECTED TEST CHURN (update to match reality — never delete coverage to go green)

- `e2e/dashboard.spec.ts:197` — "renders the 6 upcoming filing deadlines" → will change (item 3 wires eventDate).
- `e2e/dashboard.spec.ts:272` — "renders all 12 insights" → will change (B-20 fix surfaces 2 more threshold insights).
- `e2e/dashboard.spec.ts:278` — seven "Termen depășit: PFA" → will move.
- `insights.ts:115,168` filter on `t.breached === true` — that is why the two contribution obligations
  (`CAS_MIN_BASE`, `CASS_MIN_BASE`) are currently suppressed from *Observații* while rendering `Depășit` in *Praguri*.

---

## 6. DECISIONS I HAVE MADE (locked; recorded here so a post-compaction me does not re-litigate)

- **D-P9-1 — Legacy `date` IS the fiscal date.** A legacy payload's single ambiguous `date` migrates to
  `collected` (Revenue) / `paid` (Expense). Any separate **issue date is left ABSENT, never invented**.
  Rationale: preserves every existing figure; honest about what was never recorded; **never fabricate
  per-record payment dates**. This assumption must be **pinned with a test** and stated in the phase doc.
- **D-P9-2 — Fiscal-date selection is a single named accessor**, not scattered `??` chains: aggregation and
  the engine select on one function that resolves the fiscal date (collected/paid, falling back to the
  legacy `date`), with the art. 68 citations at that point.
- **D-P9-3 — B-20 fixed by driving `snapshot.thresholds[].breached` off the domain `FiscalThreshold.status`**,
  not by re-deriving from `distance`. Test must fail under `distance > 0`.
- **D-P9-4 — `pfaStartDate` → `DeadlineQuery.eventDate`** in production (`data/dashboard.ts`), with a test
  that an event-relative deadline resolves to a real date, and a test that a profile **without**
  `pfaStartDate` still degrades safely (`date: null`).
- **D-P9-5 — Migration: append v2→v3 only.** New persisted fields optional; step invents nothing.
- **D-P9-6 — No late-payment disallowance.** One line in the phase doc + pointer to `research/10`.

---

## 7. PLAN (execution order)

1. Wait for `recon-data` + `recon-tests` scout reports → paste into §8 below.
2. Read the exact files I will edit (never edit blind): `src/data/types.ts`, `src/data/migration.ts`,
   `src/data/schema.ts` (+ `src/domain/schema.ts`), `src/domain/aggregation.ts`, `src/data/derived.ts`,
   `src/data/dashboard.ts`, `src/domain/deadlines.ts`, `src/domain/thresholds.ts`, `src/data/seed.ts`.
3. Implement item 1 (date semantics) → item 3 (eventDate wiring) → item 2 (B-20).
4. Add tests: migration v2→v3 (invents nothing; chain refuses newer version), legacy-`date` assumption,
   fiscal-date selection, B-20 min-base breached, eventDate resolves / degrades, seeded-figure invariants.
5. Update `e2e/dashboard.spec.ts` counts to reality.
6. Validate: `npx tsc --noEmit` · `npm run build` · `npm run test` · `npm run test:e2e`.
7. Write `docs/ai/phases/09_payment_dates.md`; update `STATE.md` (close B-20 only if truly closed; record
   anything unfinished) and `PLAN.md`.
8. Emit handoff in the §0 format.

---

## 8. SCOUT REPORTS (paste verbatim when they arrive)

### 8.1 `recon-data` — data/domain layer map
*(pending — dispatched 2026-10-07, asked for: `data/types.ts` Revenue/Expense + payload root; `data/migration.ts`
chain shape + CURRENT_DATA_VERSION + verbatim v0→v1 and v1→v2 bodies + how collections are keyed;
date-selection sites in `aggregation.ts`/`derived.ts` (`inPeriod`); `data/dashboard.ts` `buildSnapshot`
threshold `distance`/`breached` + `computeDeadlines` call + whether `pfaStartDate` is in scope;
whether Revenue/Expense are embedded in persisted `inputSnapshot` (`canonicalize`/`addSnapshot`);
`domain/deadlines.ts` `DeadlineQuery.eventDate` + which rules are event-relative.)*

### 8.2 `recon-tests` — test/seed/e2e surface map
*(pending — dispatched 2026-10-07, asked for: which tests construct Revenue/Expense + the seed file verbatim;
migration tests; `thresholds.test.ts` `statusFor`/min-base tests verbatim; `deadlines.test.ts` eventDate tests
verbatim; `e2e/dashboard.spec.ts:190-290` assertions verbatim; tests asserting 7,494.50 / 3,104.505 / 7,700 / 9,317;
runner config + test-file count.)*

**Scout infra note:** the scout profile's configured model is a known defect (Phase 1: every attempt failed
with a Connection error in ~2 s). Rule: retry **once** with an explicit working-model override; if that also
fails → **STOP and report a BLOCKER**, do not substitute self-inspection. Status: both scouts launched OK
(2026-10-07); awaiting results.

---

## 9. REPO MAP (measured, so a post-compaction me can re-orient fast)

`src/` layout (files that matter to Phase 9 in **bold**):
- `src/data/`: **`types.ts`**, **`migration.ts`**, `schema.ts`, `seed.ts`, **`dashboard.ts`**,
  `dashboardAdapter.tsx`, `derived.ts`, `identity.source.test.ts`, `quarantine.ts`, `store.tsx`,
  + tests `dashboard.test.ts`, `schema.test.ts`, `store.migration.test.ts`, `store.migration.chain.test.tsx`,
  `store.edit.test.tsx`, `store.load.test.tsx`, `store.profileBackfill.test.tsx`, `store.save.test.tsx`,
  `store.snapshots.test.tsx`, `identity.source.test.ts`
- `src/domain/`: `aggregation.ts`, `derived.ts`, `deadlines.ts`, `thresholds.ts`, `tax.ts`, `insights.ts`,
  `completeness.ts`, `date.ts`, `models.ts`, `profile.ts`, `projection.ts`, `regimes.ts`, `repo.ts`,
  `schema.ts`, `taxReserve.ts`, `fiscal/{calculators,index,package2026,release2026,rules,select}.ts`,
  `snapshots/{hash,hashSync,serialize,snapshot,types}.ts`
- `src/components/dashboard/`: `ThresholdSection.tsx`, `DeadlineSection.tsx`, `ActionSection.tsx`,
  `CompletenessSection.tsx`, `LegislationSection.tsx`, `checkLabels.ts`
- `src/pages/`: `Dashboard.tsx`, `Revenues.tsx`, `Expenses.tsx`, `Settings.tsx`, `Clients.tsx`,
  `Declarations.tsx`, `Documents.tsx`, `EFactura.tsx`
- `e2e/`: `dashboard.spec.ts` (25 tests), `settings.spec.ts` (8 tests)
- Configs: `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts` (Chromium only, no `projects`),
  `playwright.firefox.config.ts` (supplementary, needs `--config`), `tsconfig.json` (`include: ["src"]`
  → root configs are not type-checked; the `playwright.config.ts:9` diagnostic is LSP-only, not a defect)

Known facts from STATE.md worth keeping: untested pages are `Documents.tsx`, `EFactura.tsx`, `Expenses.tsx`;
resolved versions react 18.3.1 / vite 5.4.21 / typescript 5.9.3 / vitest 3.2.7 / @playwright/test 1.63.0;
`ThresholdType = 'min-base' | 'max-base' | 'registration' | 'income'`; `addSnapshot` has no production caller;
fiscal loss persistence still open (B-16 remainder); `chosenBase` unwired; VAT regime is a boolean only.

---

## 10. ARCHIVE CONTRADICTIONS TO RECORD IN THE PHASE DOC

Brief §7 item 8: the phase doc must contain one line on any archived `steps/` file I contradict.
Candidates to check before writing: any archived claim of a single `date` per document
(`steps/01_real_baseline.md` §… records "single `date` field per document (`aggregation.ts:85-87,96,102`)"),
and the standing-prompt "15-day collection threshold" claim (false — see `STATE.md` "Archive corrections").

---

## 11. OPEN / NOT-FINISHED LEDGER (keep live; do not quietly drop)

*(empty so far — fill in as things get deferred)*

---

## 8.1 recon-data REPORT (received 2026-10-07, condensed but complete)

**Correction to the brief's paths:** there is **no `src/data/aggregation.ts`** — the real file is
**`src/domain/aggregation.ts`**. `src/data/derived.ts` is React hooks only (no date logic); the real date
selection is **`src/domain/derived.ts`**.

### Records
- `Revenue` = `src/data/types.ts:9-21`, `date: string` at **:13**. `Expense` = **:26-36**, `date: string` at **:30**.
  Root runtime type `AppData` = **:153-164** (all collections are arrays). Helper `total(r)` = `valoareFaraTva + tva` (~:165) — no stored total field.
- Zod mirror: `revenueSchema`/`expenseSchema` at `src/data/schema.ts:37-63`. **Compile-time guard at
  `schema.ts:284-297`** asserts `Equal<z.output<…>, Revenue>` — a new optional field MUST be added to BOTH
  the interface and the zod schema or the build fails.
- Persisted root `PersistedAppData` = `schema.ts:203-215`: collections are **arrays**, `revenues` + `settings`
  required, `expenses`/`snapshots`/etc. **optional**. Migration steps must use `.map`, not id lookup
  (id lookup only happens in `store.tsx:228/232/236/239`).

### The single date choke point
`src/domain/aggregation.ts`:
- `inFiscalYear` **:88** = `Number(date.slice(0,4)) === fiscalYear`
- **`inPeriod(date, asOfDate, fiscalYear)` :95** = `inFiscalYear(...) && date <= asOfDate` (lexicographic ISO compare; no lower bound, no format validation)
- `monthKey` **:100-102** = `date.slice(0,7)`
- `selectYtd` **:108-131** → `inPeriod(r.date,…)` at **:116** (status `inregistrata`), `inPeriod(e.date,…)` at **:122**
- `selectMonthly` **:135-158** → `monthKey(r.date)` **:147**, `monthKey(e.date)` **:152**
- `src/domain/derived.ts:64` `counted: r.status === 'inregistrata' && inPeriod(r.date, asOfDate, fiscalYear)`;
  `toLines` **:58-66** also emits `date: r.date` at **:61** (per-record provenance line).
- **These 5 sites are the ONLY record-date filters in the codebase.**
- Downstream of selectYtd/selectMonthly: `domain/projection.ts:64,77`; `data/dashboard.ts:61,65,69,87,115,130,196`; `data/derived.ts:27,38-41,60-66`.

### Migration (`src/data/migration.ts`, 311 lines)
- `DATA_VERSION_BASE=0` :33, `DATA_VERSION_PROFILE=1` :35, `DATA_VERSION_IDENTITY=2` :37,
  **`CURRENT_DATA_VERSION = DATA_VERSION_IDENTITY` :39**.
- `MigrationStep` :41-49 = `{ from, to, name (stable, never reused), summary, apply(data) }`;
  `MigrationOutcome` :51-59 = `{ data, fromVersion, toVersion, migrated, stepsApplied }`.
- `UnsupportedDataVersionError` :66-76 (fields `found`/`current`), thrown at **:281** in
  `migratePersistedData` **:279-307**. Chain loop throws at **:291-296** if a step did not set `version === step.to`.
- Chain = plain ordered array `MIGRATION_CHAIN` **:252-269** — **append at the end**.
- v0→v1 `materializeProfileV1` :178-181; v1→v2 `migrateIdentityV2` :208-227;
  `backfillSnapshotIdentity` :229-250 returns the snapshot **untouched** when identity is unchanged
  ("nothing added ⇒ digest stays"), else re-hashes and keeps `preMigrationInputsHash`.
- Step contract (idempotent-safe) :20-22; "must not invent values" :126-133.

### Digest exposure — **RECORDS ARE SAFE**
`CalculationInput` (`domain/snapshots/types.ts:21-27`) = `{ profile, revenues: number, expenses: number }` —
**only aggregate numbers + the embedded profile are hashed.** Confirmed by `createCalculationSnapshot`
(`snapshot.ts:29-33`), `schema.ts:130-135` (`inputSnapshot: z.object({profile, revenues: number, expenses: number})`),
`tax.test.ts:100-101`. → **Adding an optional field to `Revenue`/`Expense` does NOT change any stored digest.**
`canonicalize` (`snapshots/serialize.ts:9-27`) sorts keys and emits every own key, so adding a key to
**`PfaProfile`/`PfaIdentity`** DOES change the digest (`hashSync.test.ts:116`). Caveat: an explicitly present
key with value `undefined` renders `"key":null` and changes the digest, while `JSON.stringify` at
`store.tsx:190` drops it → persisted bytes and hashed bytes can differ. **Do not set new profile keys to `undefined`.**
`addSnapshot` (`store.tsx:261`) is append-only and still has no production caller.

### B-20 site (`src/data/dashboard.ts`)
`buildSnapshot` **:216-268** (signature `(data: AppData, asOfDate: string, tax: TaxEstimateResult)` —
**`data.profile` IS in scope**, `pfaStartDate` reachable but never read here). Threshold map **:246-256**:
`breached: t.currentValue !== null && t.distance > 0` at **:254**.
Domain truth: `src/domain/thresholds.ts:199` `const breached = type === 'min-base' ? distance < 0 : distance > 0;`
with `statusFor` **:187-201** and a ±10% warning band at **:247**; `distance` documented at **:57**
(`currentValue - thresholdValue`, negative = below, 0 when unmeasured).
Thresholds flow: `buildThresholdBases` (`dashboard.ts:111-122`) → `getThresholdStatuses` (:124-136) → `computeThresholds`.

### Deadlines (`src/domain/deadlines.ts`)
`DeadlineQuery` **:25-29** = `{ taxYear, asOfDate, eventDate? }`; `Deadline.date: string | null` :16.
**Only two rules are event-relative:**
- `pfa_estimated_declaration` **:164-177** — `date: eventDate ? isoDaysAfter(eventDate, 15) : null`,
  `appliesTo: 'new_pfa'`, `status: (eventDate !== undefined) ? 'active' : 'not_applicable'`,
  formula `'start_date + 15 days (art. 81)'`.
- `vat_registration` **:181-194** — `date: eventDate ? isoDaysAfter(monthEnd(eventDate), 30) : null`,
  `appliesTo: 'vat-registered-pfa'`, formula `'month_end(exceedance_month) + 30 days (art. 338)'`.
Always-dated: `d212_filing` :83-100 (omitted entirely if the package has no `deadline` param),
`cas_quarterly` :104-121 and `cass_quarterly` :125-142 (share `['-04-15','-07-15','-10-15', (taxYear+1)+'-01-15']`),
`income_tax_advance` :146-165 (25th of Mar/Jun/Sep/Dec).
Helpers: `isoDaysAfter` :35-39 (UTC-anchored), `monthEnd` :41-44, `daysRemaining` :46-50 (`+'T00:00:00Z'`),
`classifyDeadline` :64-73 (null for `date === null`), `isApplicable` :202-211, `getApplicableDeadlines` :216-220
(filters `date !== null`), `filterUpcoming` :227-232.
`computeDeadlines` is called at **exactly two places**, both without `eventDate`: `dashboard.ts:223`
(in `buildSnapshot`) and `dashboard.ts:142` (in `getUpcomingDeadlines` :138-148).
Snapshot deadline mapping **:240-244** emits `daysUntil: d.date ? daysBetween(asOfDate, d.date) : 0` and
`date: d.date ?? ''` → null-dated deadlines are emitted, not filtered, so the two deadline paths disagree by construction.

### Fragile spots / handoff notes
1. `inPeriod` is the only predicate — 5 sites total.
2. `inPeriod` has no lower bound and no format validation; `''`/`'2026-6-1'` silently drop or mis-sort.
3. **`eventDate` is ONE field serving TWO different events** (PFA start vs VAT exceedance month).
   Feeding `pfaStartDate` into it as the brief literally says would **fabricate a VAT-registration deadline
   from the PFA start date**. Safe shape = split the query.
4. Two day-diff implementations: `daysBetween` (`dashboard.ts:57`, `Date.parse` no `Z`) vs
   `daysRemaining` (`deadlines.ts:46`, `+'T00:00:00Z'`).
5. `profile.pfaStartDate`: type `domain/models.ts:133`, ISO-validated `domain/schema.ts:60`, editable
   `pages/Settings.tsx:622`, read by the engine only at `domain/tax.ts:130` (art. 118 alin. (3)).

### DECISION D-P9-7 (deviation from the brief's literal wording — MUST be recorded in the phase doc + handoff)
Brief §4.3 says "feed `pfaStartDate` to `DeadlineQuery.eventDate`". Taken literally that makes
`vat_registration` compute a deadline from the PFA start date — an invented fact. I will instead give
`DeadlineQuery` an explicit **`pfaStartDate`** used only by `pfa_estimated_declaration`, and keep the
VAT rule fed only by a genuinely VAT-exceedance value (never `pfaStartDate`). Acceptance criterion 6
("an event-relative deadline resolves to a real date instead of `null`") is still met.

### FLAGGED, NOT TOUCHED (no Researcher available; do not invent)
- `pfa_estimated_declaration` formula cites **art. 81 + 15 days**; `research/10` covers art. 80 only, so this
  repo's baseline does not verify art. 81. Wiring the date does not re-endorse the citation.
- `vat_registration` formula cites **art. 338**, while `VAT_THRESHOLD_2026` was corrected in Phase 2 to
  **art. 310 alin. (1)**. Unverified inconsistency, left untouched, recorded as an open observation.
- Q-122-ATTRIBUTION (U-3) and Q-QUARTERLY-DATES (U-4) remain open (attribution only).

---

## 8.2 recon-tests REPORT (received 2026-10-07, condensed but complete)

**Seed** = `src/data/seed.ts:40-51`, `profile.fiscalYear: 2026` (`seed.ts:7`). All 7 rows dated Sept 2026.
Only `status:'inregistrata'` counts → revenue excl-VAT **7700** (4500+3200), incl-VAT **9317**;
expenses excl-VAT **205.5** (120+85.5), incl-VAT **248.66**. Rows: r1 2026-09-02 inregistrata,
r2 2026-09-10 in-asteptare, r3 2026-09-18 respinsa, r4 2026-09-25 inregistrata;
e1 2026-09-05 inregistrata, e2 2026-09-12 inregistrata, e3 2026-09-20 respinsa.

**The seed-figure pin** = `src/data/dashboard.test.ts:230-325`, `AS_OF_SEED = '2026-12-31'` (:232):
`:240` vat.currentValue 7700 · `:243` ytd.revenue 9317 · `:261` contribution rows 7494.5 · `:306` 7700 ·
`:311-325` `tax.bases` = {7700, 205.5, 7494.5}, lines 'Venit brut' 7700 / 'Cheltuieli deductibile' 205.5 /
'Venit net din activitate' 7494.5 / 'Venit net anual impozabil (art. 118 alin. (2) lit. b))' 6745.05,
`tax.output.total` **3104.505**. **This is the file that fails first if I move attribution.**
Rendered strings re-asserted in `e2e/dashboard.spec.ts:66` (9.317,00), `:78/:86` (3.104,51), `:83` (1.034,84),
`:193` (7.494,50 ×3), `:194` (7.700,00 ×1), `:197` (9.317,00 ×0), `:200` 'Depășit' ×2, `:201` 'În limite' ×2.

**Migration tests** `src/data/store.migration.chain.test.tsx` — chain length hard-coded to **2**:
`:172-178` `expect(MIGRATION_CHAIN.map(s=>[s.from,s.to])).toEqual([[BASE,PROFILE],[PROFILE,IDENTITY]])` +
`expect(CURRENT_DATA_VERSION).toBe(DATA_VERSION_IDENTITY)`; `:186` and `:346` `stepsApplied` = the two names;
`:246` `stepsApplied` = `[]`. Newer-version refusal only via the load path at `:377-392`, which **hard-codes
the literal `'"version":3'`** → bumping CURRENT_DATA_VERSION to 3 breaks it (must become `'"version":4'`).
**There is NO `toThrow(UnsupportedDataVersionError)` test anywhere** — acceptance criterion 4 requires one.
`store.migration.test.ts` covers only `legacyProfileFromSettings` (6 tests).

**Thresholds** `src/domain/thresholds.test.ts`: `allBases(v)` + `QUERY = {taxYear:2026, asOfDate:'2026-03-15',
bases: allBases(100000), ruleRelease:'PFA_2026_RELEASE'}` (:19-36). `statusFor` tests :346-375 verbatim,
incl. `statusFor('min-base', -100, 50) === 'breached'` and `('min-base', 100, 50) === 'ok'`; warning-band
boundaries :377-396. Min-base specs :40-64 (`toHaveLength(4)`, CAS_MIN_BASE 48600, `distance === 100000-48600`),
`:57-67` asserts **no CAS_MAX_BASE row**, `:69-83` CASS 24300/291600, `:85-92` VAT 395000 + effectiveDate 2025-09-01.
Ratio-rule `breached` flag tests :430-447. `ThresholdSection.test.tsx:52-70` renders Romanian labels.

**Deadlines** `src/domain/deadlines.test.ts`: `baseQuery = {taxYear:2026, asOfDate:'2026-06-01'}` (:16).
`:106-124` the two `eventDate` tests verbatim — with `eventDate:'2026-03-01'` it expects **pfa 2026-03-16
AND vat 2026-04-30** (i.e. today one field resolves BOTH events). `:236-242` `getApplicableDeadlines` with
eventDate → `toHaveLength(15)`. Hard-coded counts: `:39` 15 total, `:126` 14, `:230` 13 ("15 minus 2 event-relative nulls"),
`:244-255` `filterUpcoming` 10 with explicit dates, `:196-205` taxYear 2025 → 14/12 dated, `:207-217` taxYear 1999.

**e2e counts that will move** (`e2e/dashboard.spec.ts`): `:169` thresholds `.item-row` 4 · `:208` deadlines
`.item-row` **6** · `:212-215` CAS/CASS ×2 each · `:220` 'Activ' 6 · `:257` `.action-label` 8 ·
`:260` 'Termen limită' **6** · `:272` test title "all 12 insights" · `:278` 'Termen depășit: PFA' **7** ·
`:279` 'Termen apropiat: PFA' 2 · `:293-295` 'Urgent' 7 / 'Atenție' 4 / 'Info' 1 · `:229` `.check-row` 9 ·
`:247` Complet 8 / `:248` Lipsă 1. Other datasets: `:371-435` FY2025 (12 × 202 000), `:602-606` CIT
(50 000 @2026-02-10 + 80 000 @2026-03-15 → `/46\.570/`), `:689-697` review_required group.
`e2e/settings.spec.ts:88-93` REVENUES/EXPENSES (30 000 @2026-02-10, 10 000 @2026-02-20), `:180` 12 000 @2026-03-11.

**Other fixtures that construct records** (all pass only `date`): `dashboard.test.ts:83-109` (2026-03-15 / 2026-04-10),
`domain/derived.test.ts:72-98` + boundary tests `:185-212`, `domain/projection.test.ts:67-95` (date-first helpers),
`domain/completeness.test.ts:51-80`, `store.migration.chain.test.tsx:50-95` (2025 dates),
`components/dashboard/DeadlineSection.test.tsx:6-21`, `data/derived.test.tsx`, `store.load/save/profileBackfill`,
`schema.test.ts:16`, `pages/Dashboard.test.tsx:15,125,136`, `domain/insights.test.ts:51,239,254,310,499,531`.

**Runners**: Vitest 3.2.7 (`include: ['src/**/*.test.{ts,tsx}']`, jsdom, globals) → `npm run test`;
Playwright (`testDir './e2e'`, baseURL :5173, webServer `npm run dev`) → `npm run test:e2e`.

---

## 12. IMPLEMENTATION PLAN — EXACT EDITS (written pre-compaction; execute this)

**Confirmed facts:** `aggregation.ts` imports `{ AppData, Expense, Revenue }` from `../data/types` (line 1).
`PfaProfile.pfaStartDate?: string` at `domain/models.ts:133`; **the SEED PROFILE HAS NO `pfaStartDate`**
(it has `pfaStartYear: 2020` only, `seed.ts:6`) → wiring it changes NOTHING on the seed.
Only 6 record-date sites exist: `aggregation.ts:116,122,147,148,152,153` + `derived.ts:61,64`. Nothing else.
`tsconfig`: strict, no `exactOptionalPropertyTypes` → `z.string().optional()` matches `field?: string`
(precedent: `statusDetail?: string`).

### E1 `src/data/types.ts`
Revenue: after `date: string;` (before `client: string;`) add
`/** CF art. 68 alin. (2) lit. a) „sumele încasate" — the date the amount was actually collected. Optional: a legacy payload recorded only one date, and that date is read as the fiscal date (see domain/aggregation.ts). Never invented by a migration. */ collected?: string;`
Expense: after `date: string;` (before `furnizor: string;`) add
`/** CF art. 68 alin. (4) lit. b) „anului în cursul căruia au fost plătite" — the date the expense was actually paid. Optional; never invented. */ paid?: string;`

### E2 `src/data/schema.ts`
`revenueSchema`: after `date: z.string(),` add `collected: z.string().optional(),`
`expenseSchema`: after `date: z.string(),` add `paid: z.string().optional(),`
(compile-time `Equal<>` guard at schema.ts:284-297 forces E1+E2 together.)

### E3 `src/domain/aggregation.ts` — the fiscal-date accessor (CITE ART. 68 HERE)
Insert after the `inPeriod` function:
```ts
/**
 * The date a revenue is attributed to a fiscal year.
 * CF art. 68 alin. (2) lit. a): venit brut is measured by „sumele încasate" — amounts COLLECTED.
 * A record with no recorded collection date falls back to its single legacy `date`: the legacy
 * `date` IS treated as the fiscal date (Phase 9 decision, pinned by test), because the v2→v3
 * migration deliberately refuses to invent a collection event.
 * The invoice ISSUE date is NOT a timing gate — art. 68 alin. (4) lit. a) only requires expenses be
 * „justificate prin documente". See docs/ai/research/10 §2.
 */
export function revenueFiscalDate(r: Pick<Revenue, 'date' | 'collected'>): string {
  return r.collected ?? r.date;
}
/** CF art. 68 alin. (4) lit. b): the expense belongs to the year in which it was PAID. */
export function expenseFiscalDate(e: Pick<Expense, 'date' | 'paid'>): string {
  return e.paid ?? e.date;
}
```
Then replace the two `selectYtd` loops to use `inPeriod(revenueFiscalDate(r), …)` / `inPeriod(expenseFiscalDate(e), …)`,
and the two `selectMonthly` loops to `inPeriod(revenueFiscalDate(r), …)` + `add(monthKey(revenueFiscalDate(r)), …)`
(and the expense pair likewise).

### E4 `src/domain/derived.ts`
Import `revenueFiscalDate, expenseFiscalDate` from `./aggregation` (line 10 already imports from there).
`toLines` gains a 4th param `fiscalDate: (r: T) => string`; body emits `date: fiscalDate(r)` and
`counted: r.status === 'inregistrata' && inPeriod(fiscalDate(r), asOfDate, fiscalYear)`.
Call sites: `toLines(data.revenues, asOfDate, fiscalYear, revenueFiscalDate)` / `…expenses…, expenseFiscalDate)`.
(The provenance line now shows the date that drove attribution — record this in the phase doc.)

### E5 `src/data/migration.ts` — APPEND v2→v3, invent nothing
After `DATA_VERSION_IDENTITY = 2` add:
`/** Phase 9 step 3: records may carry a collected/paid date (CF art. 68 alin. (2) lit. a) / alin. (4) lit. b)). */ export const DATA_VERSION_DATES = 3;`
and change `CURRENT_DATA_VERSION = DATA_VERSION_IDENTITY;` → `= DATA_VERSION_DATES;`
Add the step function just before `MIGRATION_CHAIN`:
```ts
/**
 * Phase 9 step 3 (`2 → 3`): the record schema now permits an optional **collected** date on
 * `Revenue` and an optional **paid** date on `Expense`.
 *
 * **It backfills nothing, on purpose.** A legacy payload's single `date` is *interpreted* as the
 * fiscal date by the read-side resolver (`domain/aggregation.ts`), so copying `date` into
 * `collected`/`paid` would manufacture a collection/payment event that was never recorded and would
 * make an unrecorded fact indistinguishable from a recorded one. Absence is the honest state, so
 * absence survives. The step stamps the version and is the single place a future *evidenced*
 * backfill would live. Idempotent-safe; touches no bytes; no digest changes (records are not inside
 * `inputSnapshot` — only `profile` + two aggregate numbers are hashed).
 */
export function migratePaymentDatesV3(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_DATES };
}
```
Append to `MIGRATION_CHAIN` (last entry): `{ from: DATA_VERSION_IDENTITY, to: DATA_VERSION_DATES, name: 'payment-dates', summary: 'Records may now carry a collected (revenue) / paid (expense) date; nothing was backfilled.', apply: migratePaymentDatesV3 }`

### E6 `src/domain/deadlines.ts` — SPLIT the query (D-P9-7, deviation from brief's literal wording)
Replace `DeadlineQuery` with `{ taxYear; asOfDate; pfaStartDate?: string; vatExceedanceMonth?: string }`
— `pfaStartDate` resolves `pfa_estimated_declaration` ONLY; `vatExceedanceMonth` resolves `vat_registration`
ONLY. Comment why: one shared `eventDate` would let a PFA start date fabricate a VAT registration deadline.
In `computeDeadlines` destructure the two new names; pfa rule uses `pfaStartDate` (`isoDaysAfter(pfaStartDate, 15)`,
`pfaApplies = pfaStartDate !== undefined`), vat rule uses `vatExceedanceMonth` (`isoDaysAfter(monthEnd(vatExceedanceMonth), 30)`).
Do NOT touch the `art. 81` / `art. 338` citations (no Researcher; flagged as unverified observations instead).

### E7 `src/data/dashboard.ts`
- `getUpcomingDeadlines` (:142) and `buildSnapshot` (:223): add `pfaStartDate: data.profile.pfaStartDate` to the query.
- B-20: `breached: t.currentValue !== null && t.distance > 0` → **`breached: t.status === 'breached',`**
  with a comment: driven off the domain status (`thresholds.ts:199` `min-base` → `distance < 0`), because
  re-deriving from `distance` here inverted the floor rows (B-20).

### E8 TESTS (target: unit > 587, e2e > 33)
Update (reality changed, do not delete): `store.migration.chain.test.tsx:172-178` (3 pairs + `DATA_VERSION_DATES`),
`:186` and `:346` (`stepsApplied` 3 names incl. `'payment-dates'`), `:377-392` literal `'"version":3'` → `'"version":4'`;
`deadlines.test.ts:112-124` (pass `pfaStartDate` + `vatExceedanceMonth` separately), `:248-255` (both fields → 15).
Add new: (a) `UnsupportedDataVersionError` thrown by `migratePersistedData` for version 4 — **none exists today**;
(b) v2→v3 keeps `collected`/`paid` ABSENT (`'collected' in r === false`) and stamps version 3;
(c) legacy single `date` == fiscal date: a record with no `collected` counts in the year of `date`;
(d) `collected`/`paid` OVERRIDE `date` — a revenue dated Dec 2026 but collected Jan 2027 lands in FY2027
(attribution, not punishment); (e) B-20: `snapshot.thresholds` min-base row with negative distance is
`breached: true` (fails under `distance > 0`) and `insights` now contains `Prag depășit:` for CAS/CASS;
(f) `pfaStartDate` in a profile resolves `pfa_estimated_declaration` to a real date; profile without it → `null`;
(g) `pfaStartDate` does NOT resolve `vat_registration`.
e2e `e2e/dashboard.spec.ts`: insights 12 → **13**, 'Urgent' 7 → **8** (CAS+CASS collapse to ONE canonical alert
via `canonicalCassCas`), title "all 12 insights" → 13. Deadline counts stay **6** (seed has no `pfaStartDate`).
Add ONE new e2e test: a profile with `pfaStartDate` renders the estimated-declaration deadline (proves item 3 in the UI).

### E9 DOCS
Write `docs/ai/phases/09_payment_dates.md`: date model + why `issued` is not load-bearing; the legacy-`date`
assumption; the v2→v3 step and why it backfills nothing; the B-20 fix; the D-P9-7 deviation (brief §4.3 literal
wording would fabricate a VAT deadline); **one line: no late-payment disallowance was added, because the
15-day rule does not exist → `research/10` §1**; left for Phase 10 (B-17 rounding, 3.104,505 lei);
flagged-not-touched (art. 81 15-day formula unverified here; `vat_registration` cites art. 338 while
`VAT_THRESHOLD_2026` cites art. 310 alin. (1); two day-diff implementations `daysBetween` vs `daysRemaining`;
`inPeriod` has no format validation). Update `STATE.md` (close B-20; Phase 9 row; re-measured counts; new
defect if any) and `PLAN.md`.

### E10 VALIDATE
`npx tsc --noEmit` · `npm run test` · `npm run test:e2e` · `npm run build`. Then handoff in the §0 format.
