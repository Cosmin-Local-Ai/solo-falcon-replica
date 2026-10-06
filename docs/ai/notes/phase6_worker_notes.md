# PHASE 6 WORKER — DURABLE WORKING NOTES (survives compaction)
Repo: /home/agent/workspace/solo-falcon-replica. Session start 2026-10-06.
**If context is compacted, re-read THIS FILE before doing anything else.**

---

## 0. THE TASK (from /tmp/p6-brief.md — read it again if unsure)
Phase 6 only: fiscal regime + profile foundation. Deliverable doc: `docs/ai/phases/06_fiscal_profile.md`.
Update `docs/ai/STATE.md` honestly incl. unfinished items. **Do NOT start Phase 7.**

Baseline after Phase 5: `tsc` 0 · build 0 · **489 unit tests / 36 files** · **24 e2e**. My changes must make these go UP.

### Acceptance criteria (verbatim intent)
1. tsc 0, build 0, unit > 489, e2e > 24.
2. User can edit+persist profile via a real UI path, proven by a test that round-trips a changed value through storage and back.
3. A payload written BEFORE my change still loads after it **with collections non-empty** (explicit test, not "app rendered").
4. Salaried PFA below 6 SM floor gets **computed** CASS in BOTH branches (salary ≥ 6 SM and < 6 SM), citing art. 174 alin. (6) + alin. (7) lit. a).
5. `impozit_pe_cit` not offered as a valid PFA regime; `NORMA_VENIT`/anything uncomputable → `REVIEW_REQUIRED` with reason. No invented norm values.
6. Every new rule/parameter carries real provenance; unverified marked unresolved in code AND doc.
7. `docs/ai/phases/06_fiscal_profile.md` records decisions, profile contract, what's open (incl. B-15 activity-source gap), one line on any archived step file it contradicts.
8. STATE.md defect + open-question registers updated honestly.

### Handoff format (MANDATORY final message)
```
COMPLETED:
FILES CHANGED:
TESTS:
VALIDATION:
DECISIONS:
BLOCKERS:
NEXT HANDOFF:
```

### Out of scope (do not touch)
Schema `version` field + migration chain (Phase 7, B-11/B-12). Identity unification (Phase 7, B-8).
Amount semantics/VAT threshold basis (Phase 8). Date semantics (Phase 9). Money/rounding policy (Phase 10, B-17).
CAS/CASS/income-tax **formulas** (Phases 3–5 closed) — I may change what the engine is *given*, not how it computes.
No multi-source activity model if it needs invented legal categories → record as open gap.

### Traps
- **DATA LOSS**: `pfaProfileSchema` fields were all required; `data/schema.ts:129` `z.custom` → `parsePfaProfile`; invalid payload ⇒ `store.tsx` returns `seedData` for the WHOLE dataset, silently. New fields MUST be `.optional()`. Test required.
- `pensionStatus` is NOT a CASS switch (art. 174 alin. (7) lit. c) removes only the alin. (6) top-up; 10% × net still owed when net > 0). Never pass it to `calcCas`… no: never pass `salaryStatus` to `calcCas` (art. 150 alin. (2) covers only lit. b¹)).
- CASS rate **10% (art. 156)**, never 16%.
- `playwright.config.ts:9` "No overload matches this call" = LSP-only, NOT a defect. Do not "fix".
- Never cite `docs/ai/research/06_2026_fiscal_research.md` or `docs/ai/steps/**` as evidence.
- Sources of record: `research/08_art118_income_tax_2026.md`, `research/09_u8_amendment_scan_and_optare.md`, `phases/02_fiscal_baseline.md` §4.

---

## 1. LEGAL FACTS I MAY CITE (verified, verbatim)
- **CF art. 174 alin. (6)** — 6-SM floor is a *top-up*: „o diferență de contribuție … până la nivelul celei corespunzătoare bazei de calcul egale cu 6 salarii minime brute pe țară". 6 SM 2026 = **24,300 lei**; 10% ⇒ 2,430 lei.
- **CF art. 174 alin. (7)** — „Diferența … prevăzută la alin. (6) **nu se datorează** în cazul în care, în anul fiscal …, persoana fizică a realizat venituri: **a)** din salarii și asimilate salariilor la un nivel cel puțin egal cu 6 salarii minime brute; b) din art. 155 alin. (1) lit. c)-h) pentru care datorează CASS la nivel ≥ 6 SM; **c) venituri din pensii, definite conform art. 99.**" (lit. c) = Legea 141/2025 Art. I pct. 34, MO 699/25.07.2025.)
- **CF art. 174 alin. (2)** — zero net / loss ⇒ no CASS at all.
- **CF art. 170 alin. (1)** — ceiling 72 SM = 291,600 lei.
- **CF art. 156** — CASS cota **10%** (OUG 79/2017 pct. 69 Art. I, eff. 01.01.2018).
- **CF art. 118 alin. (2) lit. b)** — CASS deductible „cu excepția diferenței de contribuție … prevăzută la art. 174 alin. (6)".
- **CF art. 118 alin. (3)** — „Veniturile din categoriile prevăzute la art. 61 lit. a), a^1), c) și f), ce se realizează într-o fracțiune de an sau în perioade diferite ce reprezintă fracțiuni ale aceluiași an, se consideră venit anual."
- **Regime (HIGH)** — a PFA cannot be a Titlul II taxpayer: art. 13 alin. (1), art. 14, art. 15 confine it to persoane juridice; art. 120 (the option) **Abrogat** (OUG 128/2024 pct. 11 Art. I, MO 1125/11.11.2024, eff. 01.01.2025). art. 68 alin. (1) exception list is closed: art. 68^1, 68^3, 69.
- **Normă de venit**: NO verified rule/values retrieved. Only verified mentions: art. 68 alin. (1) closed exceptions (68^1, 68^3, 69) and art. 118 alin. (6) („veniturile din activități agricole definite la art. 103 alin. (1), pentru care sunt stabilite norme de venit"). ⇒ boundary only, REVIEW_REQUIRED, **no invented values**.
- **CAS**: art. 148 alin. (1)/(2) ladder (below 12 SM=48,600 ⇒ 0; 12–24 SM ⇒ 12,150; ≥24 SM=97,200 ⇒ 24,300; no cap); art. 150 alin. (1) pension exemption; art. 150 alin. (2) only lit. b¹).
- SM 2026: 4,050 lei (HG 1.506/2024); 4,325 from 01.07.2026 (HG 146/2026) — does NOT re-anchor 2026 bases.

---

## 2. VERIFIED CODE MAP (from scouts; re-verify line numbers before citing)
- `src/domain/models.ts` — `PfaRegime` :32; `PfaProfile` :90-139; `PfaIdentity` :40-58.
- `src/domain/schema.ts` — `pfaProfileSchema` :30-53 (now has 2 `.optional()` fields), `parsePfaProfile` :~51.
- `src/domain/regimes.ts` — **NEW (mine)**: `PFA_REGIME_VALUES`, `PFA_REGIME_DESCRIPTORS`, `isComputableRegime`, `isSelectableRegime`, `selectableRegimes()`, `regimeRefusalReason()`.
- `src/domain/profile.ts:32-52` — `createDefaultProfile(overrides, instant)`; default `regime:'impozit_pe_venit'`, `socialInsuranceStatus:'neplata'`.
- `src/domain/tax.ts` — engine reads **`inputs: TaxInputsReference`**, NOT profile (except `profile.id` :57, `profile.pfaStartDate` :108, whole profile → snapshot). Regime gate :79-86. CAS call :121-124 (`base`,`pensionStatus` only). CASS call :143-152 (`base`,`pensionStatus`,`salaryStatus`,`salaryIncomeLei`). Proration/cap :168-203.
- `src/domain/derived.ts` — `TaxInputsReference` :89-105ish; `selectTaxDerived` builds it; `inputsKey: canonicalKey(inputs)` :~144. **This projection IS the profile→engine contract.**
- `src/domain/fiscal/calculators.ts` — `CalculatorInput` :23-75 (now incl. `salaryIncomeLei?`); `calcCas` :112-160; `calcCass` :187-300 (branch order: vna≤0 → vna<6SM{ pension → salary{amount undefined?halt : ≥floor relief : fallthrough} → top-up+nonDeductible } → else min(vna,72SM)).
- `src/domain/thresholds.ts` (NOT `fiscal/thresholds.ts`) — `ThresholdType = 'min-base'|'max-base'|'registration'|'income'`; specs `CAS_MIN_BASE`,`CASS_MIN_BASE`,`CASS_MAX_BASE`,`VAT_REGISTRATION`; reads NO profile fields; **24 SM CAS tier-floor surface deferred from Phase 3 to Phase 6** (needs new ThresholdType + UI label maps).
- `src/data/schema.ts:129` — `const profileSchema = z.custom<PfaProfile>((v) => parsePfaProfile(v) !== null)`.
  `persistedAppDataSchema` :217-235 — plain `z.object` (strips unknown keys), **no `version`**. Required top-level: `revenues` (array), `settings`. Everything else optional.
- `src/data/store.tsx` — `loadInitial()` :103-132; invalid ⇒ `{data: seedData, dataOrigin:'seed'}` :109-114; `legacyProfileFromSettings` :68-100 (runs at :118 when payload has no profile); `updateProfile` :213 (no UI caller).
- `src/data/seed.ts:4-35` — seed profile (`regime:'impozit_pe_venit'`, `caen:'6201'`, `socialInsuranceStatus:'obligatoriu'`, `salaryStatus:'nu'`, `pensionStatus:'nu'`, `vatExempt:false`, `cashFloorLei:0`).
- Persistence tests: `src/data/schema.test.ts`, `store.load.test.tsx` (helper `writePayload` :47-56, real jsdom localStorage), `store.migration.test.ts`, `store.save.test.tsx`.
- `src/pages/Dashboard.test.tsx:156-172` pins the cit refusal text (`/nu poate aparține unui PFA/`, `art. 13 alin. (1)`, contains `art. 120`).
- `e2e/dashboard.spec.ts:642-668` pins cit refusal (`.stat-card` value `—`, `.chart-tax-note` contains 'nu poate aparține unui PFA', 'art. 13 alin. (1)', 'art. 120', 'abrogată').
- `src/domain/completeness.ts:69` has `impozit_pe_cit: 'impozit pe CIT'` label map (may need `norma_venit`).
- `src/domain/tax.test.ts:14-19` `makeProfile` uses `as PfaProfile` cast (masks drift); `makeInputs` supplies the real inputs.
- `src/domain/fiscal/fiscal.test.ts:295-297` asserts `reviewRequired` for `salaryStatus:'da'` below 6 SM **without** an amount — still valid (amount absent ⇒ halt). Keep it.
- `src/domain/snapshots/hash.ts` — whole profile (incl. `updatedAt`) in SHA-256 snapshot input hash ⇒ any profile edit changes snapshot hash.

---

## 3. WHAT I HAVE ALREADY CHANGED (done, compiles clean)
1. **`src/domain/models.ts`**
   - `PfaRegime = 'impozit_pe_venit' | 'impozit_pe_cit' | 'norma_venit'` + doc block; added `COMPUTABLE_PFA_REGIMES`, `SELECTABLE_PFA_REGIMES`, `NON_COMPUTABLE_PFA_REGIMES` (note: these 3 consts live in models.ts AND regimes.ts has the descriptor table — consider consolidating to avoid a second source of truth; **TODO: check for duplication and possibly delete the models.ts consts**).
   - `PfaProfile.pfaStartDate?: string` (ISO YYYY-MM-DD) — read by engine only for art. 118 alin. (3).
   - `PfaProfile.salaryIncomeLei?: number` — the art. 174 alin. (7) lit. a) input. CASS-only, documented never-CAS.
2. **`src/domain/schema.ts`** — `pfaStartDate` `.optional()` regex ISO; `salaryIncomeLei: z.number().min(0).finite().optional()`; `regime: z.enum(PFA_REGIME_VALUES as [PfaRegime, ...PfaRegime[]])`; comment explaining the data-loss trap.
3. **`src/domain/regimes.ts`** (NEW) — single source of truth for regime model + refusal wording (keeps every substring the existing tests pin: 'impozit_pe_cit', 'art. 13 alin. (1)', 'art. 14', 'art. 15', 'art. 120', 'abrogată', 'nu poate aparține unui PFA').
4. **`src/domain/fiscal/calculators.ts`** — `CalculatorInput.salaryIncomeLei?`; `calcCass` salary branch now: amount undefined ⇒ REVIEW_REQUIRED (legacy payloads); `salary >= floorBase` ⇒ CASS = 10%×VNA, no top-up, fully deductible, breakdown cites art. 174 alin. (7) lit. a); `salary < floorBase` ⇒ falls through to the art. 174 alin. (6) top-up branch and adds a breakdown line naming the failed condition.
5. **`src/domain/tax.ts`** — regime gate now `regimeRefusalReason(inputs.regime)`; passes `salaryIncomeLei: inputs.salaryIncomeLei ?? undefined` to calcCass; adds line `Fracțiune de an (art. 118 alin. (3)): venit anual` when `profile.pfaStartDate` present and not `-01-01`.
6. **`src/domain/derived.ts`** — `TaxInputsReference` gains `salaryIncomeLei: number | null` and `pfaStartDate: string | null`; selector populates with `?? null` (stable canonical key).

## 4. REMAINING WORK (ordered)
1. **UI write path** (criterion 2) — waiting on `recon-profile-ui` scout report. Plan: a real profile editor (extend `src/pages/Settings.tsx` fiscal section or a new component) that calls `store.updateProfile`; fields: regime (only `selectableRegimes()`), CAEN, PFA start date, salary status + salary amount, pension status, other income, social insurance status, VAT status, cash floor. Must show the non-computable regime refusal text.
2. **Tests to add** (target: unit > 489, e2e > 24):
   - `src/data/store.profileBackfill.test.tsx` — **legacy payload without the new fields loads with revenues/expenses/clients/declarations NON-EMPTY** (criterion 3). Name referenced in my schema.ts comment — keep that filename.
   - store round-trip: `updateProfile` writes → localStorage → reload → value persists.
   - UI test: edit profile in Settings → persisted payload contains new values.
   - `tax.test.ts`: salaried PFA net 20,000 with `salaryIncomeLei: 30,000` ⇒ CASS 2,000 computed (no top-up), tax on 18,000; with `salaryIncomeLei: 20,000` ⇒ CASS 2,430, nonDeductible 430, tax on 18,000 (B-13 shape). Both cite art. 174 alin. (6)/(7) lit. a).
   - `fiscal.test.ts`: direct calcCass both branches + amount-absent still reviewRequired.
   - regime tests: `norma_venit` ⇒ review_required with reason naming art. 68 alin. (1)/no norm values; `impozit_pe_cit` ⇒ unchanged data-integrity text; `selectableRegimes()` contains ONLY `impozit_pe_venit`.
   - `derived.test.ts`: inputsKey changes when salaryIncomeLei changes.
   - e2e: profile edit round-trip through localStorage (new spec or extend `e2e/dashboard.spec.ts` — check for a Settings spec file first).
3. **Docs**: write `docs/ai/phases/06_fiscal_profile.md` (decisions, profile contract table, what's open: B-15 activity-source gap, chosenBase unwired, pensionStatus-as-flag, socialInsuranceStatus 'exempt'/'neplata' zeroes CASS with no verified art. 154 alin. (1) basis, 24 SM tier-floor threshold surface, pfaStartDate not fed to deadlines). Update `STATE.md` (B-9 partially closed — UI write path; new defects B-18+ as found; open questions).
4. **Decide/record**: 24 SM tier-floor threshold surface (Phase 3 deferred it to Phase 6). If I don't do it, record it as an explicit open item.
5. Run: `npx tsc --noEmit`, `npm run build`, `npm run test`, `npm run test:e2e`. Report counts.

## 5. KNOWN RISKS / GOTCHAS WHILE FINISHING
- Existing tests pin exact refusal substrings — do not reword `regimeRefusalReason('impozit_pe_cit')`.
- `createDefaultProfile` and `legacyProfileFromSettings` do NOT set the new optional fields — fine (optional), but if I add a required field anywhere it breaks persistence.
- Adding a calculation line changes snapshot lines — only fires when `pfaStartDate` set (never in existing fixtures).
- `zod` version: check `package.json` if `.finite()` misbehaves (it exists in zod 3; verified compile OK).
- Do not add `version`/migration (Phase 7).
- Scout infra: `recon-profile-ui` still pending; if it fails, retry once with model override, else BLOCKER (do not self-inspect as substitute — though I have already read most domain files directly).

## 8. UI SCOUT REPORT (recon-profile-ui, retry SUCCEEDED — no BLOCKER)
- `updateProfile(patch: Partial<PfaProfile>)` — declared `store.tsx:52`, body `store.tsx:213-216`:
  `patch => setData(d => ({ ...d, profile: { ...d.profile, ...patch, updatedAt: toInstantISO() } }))`.
  Shallow merge + stamps `updatedAt`. **Only reachable via `useStore()`** (`store.tsx:227-231`, throws outside
  `StoreProvider` at :136). Persistence is automatic: `useEffect` `store.tsx:143-152` writes
  `JSON.stringify(data)` to `localStorage['pfa-app-data-v2']` (`STORAGE_KEY` :14) on every data change.
  Zero UI callers today (only `src/data/derived.test.tsx:61`).
- `src/pages/Settings.tsx`: `TABS` :8-13 = company | einvoice | bankaccounts | account; tab state :23,
  **URL-synced** :27-30 (so `/?tab=` style navigation exists for e2e); company section :148-250,
  einvoice :252-297, bankaccounts :299-354, account :356-399. Writes ONLY `updateSettings` (:22).
  Disabled inputs :179, :369, :373, :377. Save buttons :120-129 (`saveCompany` :50, `saveEf` :63),
  inline mențiuni save :218. Field pattern to copy :151-159; select pattern :262-270; save+toast :50-53.
- `src/pages/Settings.test.tsx`: 3 tests; renders `<StoreProvider><Settings/></StoreProvider>` :47-51;
  `localStorage.clear()` in beforeEach/afterEach :37-45; uses `fireEvent` + `act` (NOT userEvent);
  `saveDenumire()` pattern :21-34; `readStoredDenumire()` reads `localStorage[STORAGE_KEY]`;
  **remount-restore test :60-80** is the round-trip template. No profile-edit test exists.
- `src/components/`: `ui.tsx` (Card/StatCard/Badge/Modal/Empty/Toasts/Pagination), `ui/card.tsx`,
  `FinancialSummary`, `FinancialChart`, `Insights`, `TaxReserve`, `dashboard/*Section.tsx`.
  **No form primitives exist** — pages hand-roll `<div className="field"><label>…<input className="input">`.
  CSS contract `src/styles/components.css:48-64`: `.form-grid`, `.field`, `.req`, `input.invalid`, `.error`,
  `.hint`, `input:disabled`. Validation pattern to copy: `pages/Revenues.tsx:36,40-56,78-79`
  (`errors: Record<string,string>`, `className={errors.x ? 'invalid' : ''}`, `<span className="error">`).
- `e2e/`: ONE spec `e2e/dashboard.spec.ts` (~650 lines). Config `playwright.config.ts` (testDir ./e2e,
  baseURL :5173, webServer npm run dev). localStorage seeding pattern :345-350 (`page.addInitScript`
  with `[STORAGE_KEY, dataset]`); seeded profile objects at :376-381 and :563-568; profile override :646.
  **No e2e fills an input or asserts after reload — I must create that pattern** (new `e2e/settings.spec.ts`).
- Only profile READ site in components: `App.tsx:127`, `:221-222` (identity.nume). `Settings.tsx:200-202`
  shows CAEN from `settings.company.caen`, NOT `profile.caen` (two disconnected sources — Phase 7 territory).

### UI plan (decided)
Add a **new Settings tab `fiscal` ("Regim fiscal")** rendering the profile contract, writing through
`const { profile, updateProfile } = useStore()` with a `Salvează` button. Fields: regime select built from
`selectableRegimes()` (so `impozit_pe_cit`/`norma_venit` are NOT offered, with the refusal note shown when
the stored regime is non-selectable), CAEN, PFA start date, `salaryStatus` + `salaryIncomeLei`,
`pensionStatus`, `socialInsuranceStatus`, `vatExempt`, `cashFloorLei`. Validation via the Revenues.tsx
pattern. Do NOT touch identity/personal fields (Phase 7) and do NOT unify with settings.company (Phase 7).

## 9. REMAINING TODO (exact, in order)
1. `src/domain/tax.test.ts:18` — add `salaryIncomeLei: null, pfaStartDate: null` to `makeInputs`.
2. Kill the regime-list duplication: delete `COMPUTABLE_PFA_REGIMES`/`SELECTABLE_PFA_REGIMES`/
   `NON_COMPUTABLE_PFA_REGIMES` from `models.ts` (grep first — nothing uses them yet); `regimes.ts` is the
   single source.
3. Settings.tsx `fiscal` tab (see UI plan).
4. Tests: `src/data/store.profileBackfill.test.tsx` (legacy payload → collections NON-EMPTY);
   store round-trip; `Settings.test.tsx` profile edit + remount restore; `tax.test.ts` both salary branches;
   `fiscal.test.ts` calcCass branches incl. amount-absent; regime tests (`norma_venit` refusal,
   `selectableRegimes()` length 1); `derived.test.ts` inputsKey sensitivity.
5. `e2e/settings.spec.ts` — fill fiscal fields → reload → assert persisted (criterion 2) + a legacy-payload
   case if cheap.
6. Docs: `docs/ai/phases/06_fiscal_profile.md`; `STATE.md` (B-9 closed for the write path, new defects:
   `socialInsuranceStatus` 'exempt'/'neplata' zeroes CASS with no verified art. 154 alin. (1) basis;
   B-15 activity-source gap still open; `chosenBase` unwired; pensionStatus-as-flag vs art. 174(7)(c)
   "venituri din pensii realizate"); `PLAN.md` Phase 6 status line.
7. Validate: `npx tsc --noEmit` · `npm run build` · `npm run test` · `npm run test:e2e`. Report counts
   (must beat 489 unit / 24 e2e).

## 6. STATE AT THIS MOMENT (updated after tsc pass)
- Ran `npx tsc --noEmit` after the domain edits: **2 errors**, one fixed, one still OPEN (see §7).
- Fixed: `src/domain/regimes.ts` — `PFA_REGIME_VALUES` retyped from `as const` readonly tuple to
  `[PfaRegime, ...PfaRegime[]]` (zod `z.enum` needs a mutable non-empty tuple); `src/domain/schema.ts`
  now calls `z.enum(PFA_REGIME_VALUES)` with no cast, and the now-unused `PfaRegime` type import was removed.
- **NOT YET FIXED (next action):** `src/domain/tax.test.ts:18` `makeInputs` must add
  `salaryIncomeLei: null, pfaStartDate: null` — the helper spreads `Partial<TaxInputsReference>` so the new
  required-nullable fields become `number | null | undefined` and fail to typecheck. Adding them keeps
  behaviour identical to pre-Phase-6 (null ⇒ `?? undefined` ⇒ calcCass still halts when `salaryStatus:'da'`
  and no amount). NOTE `makeInputs` defaults `salaryStatus: 'da'`, so any existing test with net < 24,300
  depends on this — check whether such tests override salaryStatus before assuming.
- No docs written yet. No new tests written yet. `npm run build` / `npm run test` / e2e NOT re-run yet.
- Scout status: `recon-persistence` ✅ delivered (map in §2). `recon-domain-profile` ✅ delivered (map in §2,
  incl. corrected line numbers). `recon-profile-ui` ❌ **ran 38 min then exited with NO output**. Retried ONCE
  by resuming the same session with a compact 6-item ask (awaiting result). If that retry also fails →
  report as **BLOCKER** per brief §0.9 (do not silently substitute self-inspection).

## 7. EXACT DIFF INVENTORY (what is on disk right now)
| File | Change | Status |
|---|---|---|
| `src/domain/models.ts` | `PfaRegime` widened to 3 values + doc block; `COMPUTABLE_PFA_REGIMES` / `SELECTABLE_PFA_REGIMES` / `NON_COMPUTABLE_PFA_REGIMES` consts; `PfaProfile.pfaStartDate?: string`; `PfaProfile.salaryIncomeLei?: number` (CASS-only doc) | on disk |
| `src/domain/regimes.ts` | **NEW FILE** — `PFA_REGIME_VALUES: [PfaRegime, ...PfaRegime[]]`, `PfaRegimeDescriptor`, `PFA_REGIME_DESCRIPTORS` (venit selectable+computable; cit + norma_venit neither), `isComputableRegime`, `isSelectableRegime`, `selectableRegimes()`, `regimeRefusalReason()` | on disk |
| `src/domain/schema.ts` | `pfaStartDate` optional ISO regex; `salaryIncomeLei` optional non-negative finite; `regime: z.enum(PFA_REGIME_VALUES)`; data-loss-trap comment | on disk |
| `src/domain/fiscal/calculators.ts` | `CalculatorInput.salaryIncomeLei?`; `calcCass` salary branch: absent ⇒ REVIEW_REQUIRED, `>= floorBase` ⇒ CASS = 10%×VNA (no top-up, fully deductible), `< floorBase` ⇒ falls through to top-up + extra breakdown line | on disk |
| `src/domain/tax.ts` | gate ⇒ `regimeRefusalReason(inputs.regime)`; CASS call passes `salaryIncomeLei: inputs.salaryIncomeLei ?? undefined`; new line `Fracțiune de an (art. 118 alin. (3)): venit anual` when `profile.pfaStartDate` set and not `-01-01` | on disk |
| `src/domain/derived.ts` | `TaxInputsReference` + `salaryIncomeLei: number \| null`, `pfaStartDate: string \| null`; selector fills `?? null` | on disk |
| `src/domain/tax.test.ts` | **PENDING** `makeInputs` fix (see §6) | not done |

**Open design smell to resolve before finishing:** the regime lists exist twice — three consts in
`models.ts` and the descriptor table in `regimes.ts`. That is the same second-source-of-truth problem
Phases 3–5 removed. Decide: delete the three consts from `models.ts` and keep `regimes.ts` as the single
source (preferred), then grep for any use of the deleted consts before removing.


## 10. PHASE 6 IS DONE — docs written, every claim re-checked (2026-10-06)

All §9 TODOs are complete. Docs written: `docs/ai/phases/06_fiscal_profile.md` (new, §1–§10),
`docs/ai/STATE.md` (sync line, verification table, phase table row 6, B-9 closed, B-18/B-19 added,
"also open" paragraph, Q-CASS-EXEMPT + Q-MULTI-SOURCE, documentation list), `docs/ai/PLAN.md`
(Phase 6 heading + outcome block).

MEASURED (re-run after the last code edit, so these numbers are current):
- `npx vitest run` → **38 files / 531 tests passed** (Phase 5 baseline 36/489 → +2 files, +42 tests)
- `npx playwright test` → **29 passed** (24 dashboard + 5 new `e2e/settings.spec.ts`)
- `npx tsc --noEmit` → 0 errors; `npm run build` → exit 0
- per-file added tests: store.profileBackfill 9 (new), regimes.test 10 (new), Settings.test +6,
  tax.test +7, fiscal.test +6, derived.test +4  (= 42 unit) + 5 e2e
- test-file areas: 1 src/, 9 components, 9 data, 14 domain (2 fiscal, 1 snapshots), 5 pages

WRONG CLAIMS I MADE IN THE DOCS AND THEN CORRECTED (do not reintroduce):
1. "Q-30PCT-CAP answered in Phase 4 (phases/04_dividenda.md §1)" — that file DOES NOT EXIST. The
   phases are 02_fiscal_baseline, 03_cas, 04_cass, 05_income_tax, 06_fiscal_profile. Q-30PCT-CAP was
   closed by the Phase 2 full Titlul IV scan as a PHANTOM (STATE.md open-question register).
2. "B-17's zero-in-both-branches defect closed" — B-17 is the ROUNDING-POLICY defect and is still OPEN.
   The salaried CASS work closes the Phase 4 open item "the salary amount behind lit. a)"
   (phases/04_cass.md §7), not a numbered defect.
3. `Settings.tsx:369,373,377` (disabled identity fields) shifted after the +265-line Phase 6 edit →
   now `:268` (company address), `:458`, `:462`, `:466` (personal name/email/phone).
4. Loss surfacing moved: `tax.ts:203-217` (was cited as 192-201); `pierderiReportate = 0` at `tax.ts:165`.
5. phases/06 §6 heading said "the B-13 remainder" → renamed "the input Phase 4 could not evaluate".
6. §1 said "formulas not changed" → corrected: arithmetic untouched, but `calcCass` DID gain the
   art. 174 alin. (7) lit. a) branch (decision table, not rates/bases).

VERIFIED-TRUE (spot-checked against code, safe to keep citing):
- `regimeRefusalReason` (`src/domain/regimes.ts`) refuses unknown regimes; test
  `regimes.test.ts:95` "an unknown regime string is refused rather than accepted" → B-18.
- `App.tsx:77` `VALID_TABS.settings = ['company','fiscal','einvoice','bankaccounts','account']`;
  route `/settings#!/fiscal` (used by e2e).
- `updateProfile` at `store.tsx:213` (interface line 52); persistence effect `store.tsx:143-152`;
  corrupt-payload whole-dataset reset `store.tsx:109-114`.
- New profile fields are ONLY `pfaStartDate` and `salaryIncomeLei`, both `.optional()` in
  `schema.ts`; `regime` enum widened to `PFA_REGIME_VALUES` (was already required).
- `norma_venit` exists in `models.ts:32` + `regimes.ts:54` only; NO norm percentage anywhere in
  `fiscal/package2026.ts` or `thresholds.ts` → "no invented values" is true.
- `thresholds.ts:4` still `ThresholdType = 'min-base' | 'max-base' | 'registration' | 'income'` →
  24 SM tier-floor surface genuinely not built.
- `caen` is written by the UI (`Settings.tsx:529`) but read by NOTHING in `tax.ts`/`derived.ts` →
  CAEN-keyed rules NOT delivered. `vatExempt` written at `Settings.tsx:640`, read at `tax.ts:87-88`
  → VAT regime still a boolean.
- `OPTIUNE NEMODELATA ... art. 180 alin. (1)` line really exists at `fiscal/calculators.ts:202`
  (only on the VNA <= 0 path).
- §6 table numbers match tests: salary 30,000 -> CASS 2,000 / total 3,800; salary 20,000 -> CASS 2,430,
  deductible 2,000, taxable 18,000, total 4,230; boundary 24,300 tested in `fiscal.test.ts:376-384`.
- `PfaSocialInsuranceStatus` at `models.ts:49` (B-19 anchor).

STATUS: nothing left to do for Phase 6. Do NOT start Phase 7 (identity/migration) — out of scope.
