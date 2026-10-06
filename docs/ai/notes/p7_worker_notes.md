# Phase 7 Worker working notes (NOT a source of record)

Worker: Phase 7 only (identity source of truth + persisted-state migration). Date: 2026-10-06.
Repo: `/home/agent/workspace/solo-falcon-replica`. HEAD at start: `d786834`.
Purpose of this file: survive context compaction. It restates the orchestrator brief, the Scout
reports as they arrive, and the decisions derived from them. `docs/ai/notes/` is explicitly **not**
a source of record; the deliverable is `docs/ai/phases/07_identity.md`.

---

## A. Orchestrator brief (verbatim restatement of `/tmp/p7-brief.md`)

### Working rules
1. One Worker at a time; do not spawn another.
2. Spawn the Scouts needed BEFORE modifying anything; use their reports instead of broad searching.
3. Scouts run in parallel when independent; each inspects the smallest relevant territory.
4. Missing local info → spawn another narrow Scout, do not search broadly.
5. One coherent, tightly scoped job.
6. Do NOT spawn a post-Worker Scout verification pass; self-validate.
7. Self-validate with `npx tsc --noEmit`, `npm run build`, `npm run test`, `npm run test:e2e`.
8. Do NOT start Phase 8 or later.
9. Scout infra is a known defect (scout profile model unreachable). On failure: retry ONCE with an
   explicit working-model override; if that fails too, STOP and report a BLOCKER. Do not substitute
   self-inspection for a Scout.

Handoff format (mandatory): `COMPLETED: / FILES CHANGED: / TESTS: / VALIDATION: / DECISIONS: /
BLOCKERS: / NEXT HANDOFF:`

### Documentation namespace
- `docs/ai/steps/**` (02–34) = frozen archive; never rename/delete/overwrite; never cite as current
  behaviour. `steps/01_real_baseline.md`'s Phase 7 citations are known-stale; PLAN.md's re-measured
  block supersedes them.
- Deliverable: `docs/ai/phases/07_identity.md`. Live docs: `docs/ai/PLAN.md`, `docs/ai/STATE.md`.
- `docs/ai/research/06_2026_fiscal_research.md` and `decisions/09_IMPLEMENTATION_ARCHITECTURE.md`
  are NOT authoritative; never use as `sourceUrl` for a production rule.
- Check STATE.md "Archive corrections": the seed's "22% VAT ratio" claim is FALSE (seed encodes 21%,
  statutory). Do not "fix" it.

### Complete phase list (do not invent a boundary)
1 real baseline · 2 fiscal baseline · 3 CAS · 4 CASS · 5 income tax · 6 fiscal regime+profile
(all COMPLETE) · **7 identity + persisted-state migration = HERE** · 8 financial amount semantics ·
9 payment/collection dates · 10 money precision.

### Decisions already made (implement, do not re-open)
- **D-1** `profile.identity` is canonical and absorbs the four fields only `settings.company` carries
  today: `numarRegComert`, `codTvaIntra`, `caen[]`, `mentiuniFactura`. `settings.company` /
  `settings.personal` retire from the UI and from writes but stay **parseable** (optional).
- **D-2** Add a `version` field + explicit migration chain under the **same** key `pfa-app-data-v2`.
  A payload with **no** `version` is the chain's base. Chain must already cover Phase 6's
  `pfaStartDate` and `salaryIncomeLei` plus whatever D-1 adds.
- **D-3** A payload that fails validation is **quarantined** under a separate key, seed data loads,
  and the user is told via `dataOrigin` (`store.tsx:26-27`, exists today, never rendered). Never
  silently overwrite the quarantined copy.

### Facts that decide the implementation
- **F-1 THE DOUBLE RESET TRAP.** `pfaProfileSchema` (`domain/schema.ts:29`) declares every field
  required, and that one schema gates BOTH the live profile (`data/schema.ts:129`) AND every stored
  calculation snapshot's embedded profile (`taxCalculationSnapshotSchema.inputSnapshot.profile`,
  `data/schema.ts:131-145`). A required new identity field invalidates both, and `store.tsx:109-114`
  answers either failure by resetting the ENTIRE dataset to seed. New absorbed fields must be
  `.optional()`, and the migration must backfill them into the live profile **and** into stored
  snapshots' embedded profiles.
- **F-2 Identity is hash-safe — keep it that way.** `derived.ts:137-148` builds `inputsKey` from
  regime, salaryStatus, salaryIncomeLei, pensionStatus, otherIncome, vatExempt, cashFloorLei,
  fiscalYear, pfaStartDate — no identity field. Stored `inputsHash` is never recomputed on load.
  Prove with a test; **do not add identity to `inputsKey`**.

### Scope
1. One canonical identity store per D-1; retire `settings.company`/`settings.personal` from UI+writes,
   keep parseable.
2. A real write path for identity (personal name/email/phone inputs are `disabled` today at
   `Settings.tsx:458,462,466`; company address at `:268`) persisting through `updateProfile`.
3. Render identity from the one store in the sidebar (hardcoded brand `App.tsx:187`), the topbar
   (`App.tsx:237-238`) and a Dashboard greeting. Remove duplicate identity state.
4. `version` + migration chain per D-2, same key, versionless payload = base.
5. Quarantine + visible recovery per D-3.
6. Resolve the `caen` duplication — `profile.caen: string` (`models.ts:99`) vs
   `settings.company.caen: CompanyCaen[]` (`types.ts:117`, `{cod, descriere}`). Pick one model,
   write down why, migrate the other into it, do not leave both readable.
7. B-11 and B-12 are mine.

### Explicitly OUT of scope
- Fiscal formulas (Phases 3–5 closed): change what the engine is *given*, never how it computes.
- Amount semantics/VAT threshold basis = Phase 8. Date semantics = Phase 9. Money representation and
  rounding policy = Phase 10 (B-17 registered there; do not invent a rounding policy).
- The three Phase 6 handed-forward items: the 24 SM `tier-floor` threshold surface was reassigned to
  Phase 7/9 — may take it only if it falls out of the identity work naturally, and must say so if not.
  **CAEN-keyed rules and a richer VAT regime were DECLINED AS UNCITABLE, not deferred** — not mine.
- **B-19** is a parked research item: do not code around it, do not research it.

### Traps
1. F-1 (highest risk in the phase).
2. Do not add identity to `inputsKey`.
3. `settings` is a **required** collection in `persistedAppDataSchema`; retiring UI fields must not
   make `settings` fail to parse.
4. e2e will move: `e2e/settings.spec.ts` (5) and `e2e/dashboard.spec.ts` (24) assert rendered text.
   Update assertions to match reality — do not delete coverage to go green.
5. `playwright.config.ts:9` "No overload matches this call" is LSP-only (`tsconfig.json`
   `include: ["src"]`), not a defect. Do not "fix" it.
6. No 16% CASS rate, no `research/06` citations, no invented norm values.

### Acceptance criteria
1. `npx tsc --noEmit` 0 · `npm run build` 0 · `npm run test` green with **> 531** tests ·
   `npm run test:e2e` green with **> 29**.
2. A legacy payload with no `version` loads, migrates, keeps its data — assert collections survive
   **by id**, not merely that the app rendered.
3. A payload written before Phase 7 still loads after it, **including its stored snapshots** — prove
   F-1 was handled, not avoided.
4. A corrupt payload is quarantined and the user is told: rejected copy retrievable under the
   quarantine key, visible banner/`dataOrigin` state, quarantine not overwritten by the next save.
5. Identity round-trips: edit name (+ absorbed company fields) in Settings, reload, see it in sidebar,
   topbar and Dashboard greeting — all three reading the **same** store.
6. No duplicate identity state remains readable: nothing outside the migration path reads
   `settings.company`/`settings.personal` for identity. Prove with a grep-based test or a documented
   check in the phase doc.
7. The `caen` duplication resolved with choice + rationale written down.
8. `docs/ai/phases/07_identity.md` records D-1/D-2/D-3 with rationale, the migration chain (every step
   and every field it backfills), the quarantine contract, what is still open, and one line on any
   archived step file it contradicts.
9. Update `STATE.md` honestly — close B-11/B-12 only if truly closed; record anything unfinished.

Baseline at HEAD `d786834` (also quoted at `9ecb061`): tsc 0 · build 0 · **531 unit tests / 38 files**
· **29 e2e** (`e2e/dashboard.spec.ts` 24 + `e2e/settings.spec.ts` 5). Correct work → numbers go UP.

---

## B. Docs read before any code (done)

- `docs/ai/PLAN.md` Phase 7 section incl. "Re-measured 2026-10-06, after Phase 6": stale citations
  corrected — `updateProfile` now HAS a UI caller (`Settings.tsx:36` destructure, `:135` write);
  personal disabled inputs at `Settings.tsx:458,462,466` (not `:369,373,377`); company address
  disabled at `:268`; identity renders at `App.tsx:237-238` (not `:221-222`); hardcoded sidebar brand
  is the `sidebar-logo` block at `App.tsx:187` (not `:183-184`); persistence load `store.tsx:105-133`,
  save effect `store.tsx:143-152`, corrupt reset `store.tsx:109-114`, profile backfill `store.tsx:118`;
  key still `pfa-app-data-v2` (`store.tsx:14`); `settings.cotaTva` seeded `9` (`seed.ts:83`) read by
  nothing (only type `types.ts:110` + schema `schema.ts:188`).
- `docs/ai/STATE.md`: B-8 (two identity stores), B-10 (every Settings write inert downstream),
  B-11 (corrupt payload silently resets; `dataOrigin` never surfaced), B-12 (no `version`, no
  migration) → all Phase 7. Q-IDENTITY-SOURCE and Q-PERSISTENCE-VERSION CLOSED as D-1/D-2/D-3.
  Archive-corrections table: 22% VAT claim is FALSE; `updateProfile` no longer caller-less;
  playwright.config diagnostic is LSP-only.
- `docs/ai/phases/06_fiscal_profile.md`: §4 the profile contract + data-loss trap (every new profile
  field `.optional()`, no default invented); §10 trap 1 "any new required profile field is a
  data-loss event"; §10 trap 2 "`addInitScript` re-runs on reload" — an e2e that seeds localStorage
  and then reloads re-applies the seed over anything the UI just saved, so the round-trip assertion
  proves nothing (Phase 6 round-trip test deliberately does not seed); §10 trap 7 `profile.caen` vs
  `settings.company.caen` are two disconnected sources; §7 items 5/8/9 = the three not-delivered items.

---

## C. Scout reports (appended as they arrive)

### C.1 Scout `persistence` — store/schema/seed (COMPLETE)

Files: `data/store.tsx` (263 ln), `data/schema.ts` (267), `data/types.ts` (265), `data/seed.ts` (114).
Tests: `store.load.test.tsx` (291), `store.save.test.tsx` (187), `store.edit.test.tsx`,
`store.snapshots.test.tsx`, `store.profileBackfill.test.tsx` (245), `store.migration.test.ts` (84),
`schema.test.ts` (~270).

Key: `store.tsx:14 const STORAGE_KEY = 'pfa-app-data-v2';` — module-private, **not exported**; every
test re-declares it with a "Must match" comment. Only two accesses in src/data: read `store.tsx:105`,
write `store.tsx:145`. **No `removeItem`/`clear` anywhere in src/data**, no second key.

`persistedAppDataSchema` (`schema.ts:217-230`): required = **`revenues` and `settings` only**;
`profile`, `expenses`, `clients`, `declarations`, `documents`, `companyDocs`, `statements`, `snapshots`
all `.optional()`. There is **no `z.infer` alias** — a hand-written `export interface PersistedAppData`
(`schema.ts:204-215`) is pinned to the schema by the compile-time assertion at `schema.ts:266`:
`Expect<Equal<z.output<typeof persistedAppDataSchema>, PersistedAppData>>`. ⇒ **adding `version` to the
schema requires adding it to `PersistedAppData` too, or the build breaks.**

`loadInitial` (`store.tsx:103-134`): `getItem` → `parseAppData(raw)` → on `null` return
`{data: seedData, dataOrigin: 'seed'}` (comment says "recover to seed data and let the save effect
persist the clean state") → else build the 10-key object with `profile: parsed.profile ??
legacyProfileFromSettings(parsed.settings)` (`:118`) and `?? []` for 7 collections, `dataOrigin:
'persisted'`; outer `catch` → seed + `'seed'`. `parseAppData` (`schema.ts:238-247`) = JSON.parse in
try/catch → `persistedAppDataSchema.safeParse` → `result.success ? result.data : null`. **All three
failure modes (bad JSON / schema fail / throw) are indistinguishable, unlogged, unnotified.**

`DataOrigin` = `store.tsx:23 export type DataOrigin = 'seed' | 'persisted';` set only in `loadInitial`
(:107,:114,:129,:132), captured once at `store.tsx:139 const [dataOrigin] =
useState<DataOrigin>(initial.dataOrigin);` — **never updated**, exposed on `StoreValue` (:34, spread
:172), never persisted.

Save effect (`store.tsx:143-152`): `setItem(STORAGE_KEY, JSON.stringify(data))` on **every `data`
change including first mount** (so seed/corrupt recovery is immediately re-persisted), `console.warn`
on throw. Writes the whole 10-key `AppData`; `toasts`/`dataOrigin` never serialized.

`taxCalculationSnapshotSchema` (`schema.ts:131-145`): `calculationId: nonEmptyString`, `taxYear: int`,
`calculatedAt: string`, `ruleRelease: ruleReleaseSchema`, `inputSnapshot: { profile: profileSchema,
revenues: number, expenses: number }`, `inputsHash: z.string()`, `calculationLines: {label,value}[]`,
`output: {total}`, `status: 'computed'|'superseded'|'void'`. `profileSchema` is
`schema.ts:129 const profileSchema = z.custom<PfaProfile>((v) => parsePfaProfile(v) !== null);`
(imported from `../domain/schema` at `schema.ts:3`). ⇒ **`inputSnapshot.profile` is REQUIRED inside a
snapshot** while top-level `profile` is optional — this is F-1 exactly.

Types: there is **no `AppSettings`** — the type is `SettingsState` (`types.ts:109-142`).
`settings.company` = `{denumire, cui, numarRegComert, adresa, codTvaIntra?, caen: CompanyCaen[],
mentiuniFactura?, cnp?, formaJuridica?, codFiscal?, codCAEN?, regComerț?, telefon?, email?, contBancar?,
banca?}`; `settings.personal` = `{nume, cnp, adresa, telefon, email}` (all required); plus
`bankAccounts: BankAccount[]` and `eFactura: {trimitere:'manual'|'automat', dateContact: string}` and
`cotaTva: number` (int 0..100). `AppData` (`types.ts:153-166`) has **`profile` required** while
`PersistedAppData.profile` is optional — the gap is the `??` backfill. Zod mirrors: `settingsSchema`
`schema.ts:187-193`, `settingsCompanySchema` `149-166`, `settingsPersonalSchema` `168-174`,
`companyCaenSchema` `147`, `bankAccountSchema` `176-180`, `eFacturaSchema` `182-185`.
Seed: `profile` at `seed.ts:4-32` (`id:'profile-1'`, `pfaStartYear:2020`, `fiscalYear:2026`,
`caen:'6201'`, identity `Popescu Andrei` / `Popescu Consulting SRL`, CUI `RO4455667788990`);
`settings` at `seed.ts:82-113` (`cotaTva:9`, `caen:[{cod:'6201',descriere:'Activități de programare
computerizate'}]` at :98, legacy aliases `cnp`/`codFiscal`/`codCAEN`/`regComerț`, `personal` 100-106,
`bankAccounts:[{id:'ba-1',banca:'BCR',moneda:'RON'}]`, `eFactura`); `snapshots: []`.
**Zod strips unknown keys by default**, so extra fields are dropped on load — a `version` key not
declared in the schema would be silently discarded.

Existing test names that constrain me:
- `store.load.test.tsx`: 7 "falls back to seed on …" corrupt tests + 4 `dataOrigin` tests + 3 backfill
  tests + "persists the recovered seed state back to localStorage" + "preserves valid snapshots so
  getSnapshot resolves".
- `store.save.test.tsx`: **"serializes only AppData — no store-level fields (dataOrigin, toasts)"
  asserts an EXACT 10-key set** → adding `version` to the saved payload makes this fail; it must be
  updated to 11 keys (assertion updated to match reality, coverage kept).
- `store.profileBackfill.test.tsx` (9) — the Phase 6 safety net; "loads as persisted, not as seed"
  asserts `dataOrigin === 'persisted'` for a legacy payload.
- `store.migration.test.ts` (5) — tests `legacyProfileFromSettings` (personal/company carry-over,
  first CAEN entry, `codCAEN` fallback, safe defaults).
- `schema.test.ts` — 6 valid + ~20 corrupt→null, incl. "strips unknown extra fields", "missing settings",
  "empty settings", "missing company block", "returns null for a null profile", "snapshot missing
  output", "snapshot invalid embedded release".
- `store.snapshots.test.tsx` — "addSnapshot appends without mutating prior snapshots", "exposes no
  update/delete path for snapshots (append-only by design)".

### C.2 Scout `identity-domain` — models/schema/profile/derived/caen (COMPLETE)

Files: `domain/models.ts` (58-79 `PfaIdentity`, 81-129 `PfaProfile`), `domain/schema.ts`
(13-28 `pfaIdentitySchema`, 30-56 `pfaProfileSchema`, 59-62 `parsePfaProfile`), `domain/profile.ts`
(13-27 `EMPTY_IDENTITY`, 32-52 `createDefaultProfile`, 70-72 `profileIdentity`), `domain/derived.ts`
(90-106 `TaxInputsReference`, 135-156 `selectTaxDerived`), `data/types.ts` (98-101 `CompanyCaen`,
108-135 `SettingsState`), `data/store.tsx` (70-99 `legacyProfileFromSettings`, 101-133 `loadInitial`),
`domain/snapshots/{types.ts,snapshot.ts,hash.ts}`.

```ts
// models.ts:58 — PfaIdentity, 14 fields
nume, cnp, adresa, telefon, email,                       // personal
denumire, cui, formaJuridica, numarRegComert,             // company
adresaSocietate, telefonSocietate, emailSocietate, contBancar, banca
// models.ts:81 PfaProfile: id, pfaStartYear, pfaStartDate?, fiscalYear, regime,
// caen: string (:99), salaryStatus, salaryIncomeLei?, pensionStatus, otherIncome,
// socialInsuranceStatus, vatExempt, cashFloorLei, identity: PfaIdentity (:127), updatedAt
```

**CORRECTION to the brief's F-1 wording:** `pfaProfileSchema` is **not** "every field required" any
more — Phase 6 already made `pfaStartDate` and `salaryIncomeLei` `.optional()` (schema.ts:33-38
comment says deliberate, to avoid wiping legacy payloads). The live hazard is narrower and still real:
**`pfaIdentitySchema` (schema.ts:13) declares all 14 identity fields as plain required `z.string()`
with no `.optional()`/`.default()`** — so a *required* new identity field still breaks both the live
profile and every stored snapshot's embedded profile. No `.default()` anywhere in the profile schema.

`parsePfaProfile` lives in **`domain/schema.ts:59`** (not `profile.ts`): `safeParse` → data or `null`.
`domain/profile.ts:70` `profileIdentity(profile) => profile.identity` — exported but **no app caller**
(tests only).

`caen` duplication:
- `profile.caen: string` (models.ts:99). Write: `Settings.tsx:137` (`caen: fiscal.caen.trim()` via
  `updateProfile`), input at `Settings.tsx:526-530`. Read: `Settings.tsx:62` (seed the fiscal form).
  **The engine reads CAEN nowhere** (`tax.ts`/`derived.ts` have no `caen`).
- `settings.company.caen: CompanyCaen[]` where `CompanyCaen = {cod, descriere}` (types.ts:98, :117).
  Read: `Settings.tsx:289,291` (displays first entry). Write: **none in the app** (only `seed.ts:98`).
  Migration reads it: `store.tsx:76` `caen: c.caen?.[0]?.cod ?? c.codCAEN ?? ''`.
- e2e touches both: `settings.spec.ts:37,76,133,141,148,191`, `dashboard.spec.ts:39`.

`inputsKey` (derived.ts:137-152) fields = regime, salaryStatus, salaryIncomeLei(`?? null`),
pensionStatus, otherIncome(sorted), socialInsuranceStatus, vatExempt, cashFloorLei, fiscalYear,
pfaStartDate(`?? null`). **No identity field, no `caen`, no `id`.** Confirmed.

**IMPORTANT NUANCE the brief does not state:** `inputsHash` is a *different* thing from `inputsKey`.
`snapshots/types.ts:52` `inputsHash: string` = SHA-256 of the whole `inputSnapshot`, and
`inputSnapshot.profile` embeds the **full `PfaProfile` including `identity`** — so the snapshot hash
*does* cover identity, unlike `inputsKey`. It is computed only at creation
(`snapshot.ts:40 inputsHash: await computeInputsHash(inputSnapshot)`) and **nothing recomputes it on
load**: `loadInitial` just does `snapshots: parsed.snapshots ?? []` (store.tsx:126) and
`data/schema.ts:141` validates it as bare `z.string()`. So widening identity is hash-safe for stored
snapshots, but a *new* snapshot taken after an identity edit will hash differently. Must check whether
snapshot creation dedupes on `inputsHash` (→ would create a second snapshot after an identity edit).

Who reads identity where (src/, non-test):
- `App.tsx:237` `profile.identity.nume`, `:238` `initials(profile.identity.nume)` — the only app reader.
- `domain/profile.ts:70-71` `profileIdentity` (dead in app).
- `domain/models.ts:127` decl · `domain/schema.ts:51` schema · `data/seed.ts:16` seed ·
  `data/store.tsx:83` backfill.
- `pages/Settings.tsx` reads `settings.*` at: 48-50 `company.{denumire,cui,numarRegComert}`, 52
  `mentiuniFactura`, 55 `eFactura`, 154 `adresa`, 160/318/330 `codTvaIntra`, 268 `adresa`, 289/291
  `caen[0]`, 413/419 `bankAccounts`, 458/462/466 `personal.{nume,email,telefon}`; destructured at :36.
- `data/store.tsx`: 118 `parsed.settings`, 127 `settings: parsed.settings`, 220 `updateSettings`.

**CORRECTION to D-1's wording:** of the four fields the brief says only `settings.company` carries,
`numarRegComert` is **already** in `PfaIdentity` (models.ts:58 block). Genuinely missing from identity:
`codTvaIntra`, `caen[]`, `mentiuniFactura`.

### C.3 Scout `identity-ui` — App/Settings/Dashboard + tests + e2e (COMPLETE)

`App.tsx:187-189` sidebar brand is hardcoded:
```tsx
<div className="sidebar-logo"><span className="mark">S</span> SOLO</div>
```
`App.tsx:236-238` topbar: `<span>{profile.identity.nume}</span>` +
`<span className="avatar">{initials(profile.identity.nume)}</span>`; `App.tsx:120`
`const { profile } = useStore();`.
`App.tsx:70-77 VALID_TABS.settings = ['company','fiscal','einvoice','bankaccounts','account']`.

`Settings.tsx:21-27 TABS` = company **PFA** · fiscal **Regim fiscal** · einvoice **e-Factura** ·
bankaccounts **Conturi bancare** · account **Personal**.
`Settings.tsx:47-52` company form state = `{denumire, cui, numarRegComert}` from `settings.company` —
**all three are also `PfaIdentity` fields**, so the PFA tab is already an identity editor pointed at the
wrong store. `Settings.tsx:83-85 saveCompany()` → `updateSettings(s => ({...s, company:{...s.company,
...company}}))`. `Settings.tsx:135-149 saveFiscal()` → `updateProfile({regime, caen: fiscal.caen.trim(),
pfaStartYear, fiscalYear, pfaStartDate||undefined, salaryStatus, salaryIncomeLei, pensionStatus,
socialInsuranceStatus, vatExempt, cashFloorLei})` — **never writes `identity`**.
Disabled inputs: `:458 :462 :466` = `settings.personal.{nume,email,telefon}`; `:268` =
`settings.company.adresa`.

`Dashboard.tsx:49-55` header = `<h1>Tablou de bord</h1>` + `<span className="muted">An fiscal
{snapshot.taxYear} · actualizat la {fmtDate(snapshot.asOf)}</span>`. **No greeting, no identity.**
Reads `useDashboardData()` + `useStore()`.

Tests that constrain the UI change:
- `src/App.test.tsx` (1 test) — "shows the seeded identity from the store, not the old hardcoded name",
  asserts `getByText('Popescu Andrei')` **and** `getByText('PA')`.
- `src/pages/Settings.test.tsx` (8) — incl. "persists company data to localStorage…",
  "restores saved company data from localStorage on remount", "does not duplicate bank account rows…",
  "offers only regimes a PFA can actually hold", "persists profile edits…" (asserts stored
  `profile.identity.nume === 'Popescu Andrei'`), "restores saved profile values…", salary-without-amount,
  stale-salary-cleared, negative-cash-floor.
- `src/pages/Dashboard.test.tsx` (5) — onboarding CTA, cockpit+sections, B-14 ×3.
- **No e2e test asserts identity text in the DOM today** (`settings.spec.ts` only asserts
  `saved.caen === '6202'` from localStorage; `dashboard.spec.ts` asserts headings/`.page-title`).

**Risk this surfaces:** once identity renders in more than one place, `getByText('Popescu Andrei')` /
`getByText('PA')` become **ambiguous** (testing-library and Playwright strict mode both fail on 2
matches). `App.test.tsx` already asserts both strings. So the sidebar must render a *different* identity
field than the topbar (company name, not the person's initials), and any Dashboard greeting must be
asserted with a scoped locator. Must read `App.test.tsx` before choosing.

### C.4 Scout `snapshots` — snapshot create/read/embedded profile/inputsHash
PENDING (spawned after orchestrator note: snapshot path is its own territory, needed for F-1)

---

## D. Decisions derived from Scout reports (appended as they arrive)

### From C.2 (identity-domain)

**D-1a — what to add to `PfaIdentity`.** Add exactly three fields, all `.optional()`:
`codTvaIntra?: string`, `mentiuniFactura?: string`, `caen?: PfaCaenEntry[]`. `numarRegComert` needs no
change (already present). Do **not** make any existing identity field optional or add `.default()` —
that would change validation semantics for the 14 fields that already gate both paths.

**D-1b — the `caen` model choice: structured entry wins.** Single model =
`PfaCaenEntry { cod: string; descriere: string }` stored at `identity.caen` (array).
Rationale: (1) it is a strict superset of `profile.caen: string` — the scalar loses `descriere`, which
is the only thing the Settings PFA tab displays today (`Settings.tsx:289,291`); (2) CAEN is genuinely
multi-valued (the legacy store is already an array); (3) **no engine rule keys on CAEN** — CAEN-keyed
rules were declined as uncitable in Phase 6 §7 item 8 — so nothing depends on the scalar shape and
choosing it would buy nothing; (4) it lets D-1's "identity absorbs `caen[]`" be literally true.
`profile.caen: string` stays in the schema as **`.optional()` + deprecated** for parse-compat only, and
**no app code reads it** after the change (the fiscal tab's CAEN input will read/write
`identity.caen[0].cod`). Migration 1→2 backfills `identity.caen = [{cod: profile.caen, descriere: ''}]`
when `identity.caen` is absent and `profile.caen` is non-empty, else from
`settings.company.caen[0]`.

**D-1c — write path.** The fiscal tab keeps its CAEN input but writes `identity.caen`; the personal +
company identity inputs move to the identity/company form and write through `updateProfile` (the Phase 6
path, `Settings.tsx:36` destructure / `:135` write). `updateSettings` stays for the non-identity
settings that are not retired (`eFactura`, `bankAccounts`, `cotaTva`, …) — must confirm from Scout 1
which `SettingsState` fields are identity vs non-identity before deciding what stays writable.

**D-2a — chain shape.** `version` is `.optional()` in `persistedAppDataSchema` so versionless payloads
still parse; a payload with no `version` is treated as **v0**. Steps are pure
`(payload: unknown) => unknown` functions applied in order until `CURRENT_DATA_VERSION`, each defensive
(optional chaining, no invented defaults), then the migrated payload is validated with the strict
current schema. Planned steps: **0→1** = today's implicit profile backfill becomes explicit
(`legacyProfileFromSettings` when `profile` is absent; leave `pfaStartDate`/`salaryIncomeLei` absent
rather than inventing values); **1→2** = absorb `codTvaIntra`/`mentiuniFactura`/`caen` from
`settings.company` into `profile.identity`, migrate `profile.caen` string → `identity.caen[]`, and
**backfill the same fields into every stored snapshot's embedded profile**. Quarantine only fires if the
*migrated* payload still fails validation, so a merely-legacy payload is never quarantined.

**D-2b — snapshot hash nuance to verify, not assume.** Because `inputSnapshot.profile` embeds
`identity`, the snapshot `inputsHash` covers identity. Stored hashes are never recomputed (confirmed),
so widening identity cannot invalidate them — but I must read `snapshots/snapshot.ts` to check whether
creation dedupes on `inputsHash` before claiming an identity edit cannot duplicate a snapshot.

**D-3a — quarantine must be append-only.** Save effect writes only the main key. A second corrupt load
must not clobber the first quarantined copy → slot the key (`:quarantine`, `:quarantine.2`, …, capped)
and record `reason` (`invalid-json` | `schema-invalid` | `migration-failed`) + `quarantinedAt`.

**F-2 test plan (two tests, not one):** (a) editing identity leaves `inputsKey` byte-identical; (b) a
stored snapshot's `inputsHash` survives a load unchanged (no recompute).

### From C.1 (persistence)

**D-2c — `version` must be added in three places at once:** `persistedAppDataSchema` as
`version: z.number().int().min(0).optional()` (optional so versionless payloads still parse), the
hand-written `PersistedAppData` interface (`schema.ts:204-215`) — otherwise the `Expect<Equal<…>>`
at `:266` fails the build — and the save path, which must write it. `store.save.test.tsx`'s exact-key-set
test goes 10 → 11 keys and must be updated, not deleted.

**D-2d — new module `src/data/migration.ts`** (pure, no DOM): `CURRENT_DATA_VERSION`,
`detectDataVersion(payload)` (no `version` key ⇒ **0**), an ordered `MIGRATION_STEPS` array of
`{from, to, run(payload: unknown): unknown}`, and `migratePersistedPayload(payload)`. Each step is
defensive (optional chaining, no invented defaults). `parseAppData(raw)` stays **unchanged** so the ~26
`schema.test.ts` tests keep their meaning; the store gets a new entry point that does
JSON.parse → migrate → strict validate, so a merely-legacy payload is never quarantined.

**D-2e — the 0→1 step absorbs today's implicit backfill.** `profile: parsed.profile ??
legacyProfileFromSettings(parsed.settings)` (`store.tsx:118`) becomes an explicit migration step, so
"the only migration logic is the profile backfill" (B-12's evidence) is literally replaced. The existing
`store.migration.test.ts` (5 tests) and `store.load.test.tsx`'s 3 backfill tests must stay green.

**D-3b — `dataOrigin` gets exactly one new value: `'quarantined'`.** Do NOT add a `'migrated'` origin:
`store.profileBackfill.test.tsx` asserts a legacy payload yields `'persisted'`, and weakening that would
damage the Phase 6 safety net. Migration is reported through a **separate** store field
(e.g. `migratedFrom: number | null`) so the banner can say "date migrate dintr-o versiune veche" without
changing `dataOrigin` semantics.

**D-3c — quarantine key + append-only slots.** `pfa-app-data-v2:quarantine` (and `.2`, `.3`, … capped)
so a second corrupt load never clobbers the first copy. Store `{quarantinedAt, reason,
storageKey, raw}`. The save effect keeps writing only the main key, which is what makes
"quarantine is not overwritten by the next save" true — and note the save effect fires on first mount,
so seed data is re-persisted to the main key immediately after a quarantine (that is D-3's "load seed
data", and it must not touch the quarantine key).

**D-3d — `settings.company`/`settings.personal` stay exactly as they are in the schema.** They are
**required** (`settings` required; "missing company block" and "empty settings" are corrupt cases), and
`settings.personal`'s five fields are required strings. Retiring them from the UI means the store simply
stops writing them — the loaded/seeded values persist untouched, so nothing fails to parse. They become
frozen legacy data read only by the migration. Trap 3 satisfied without touching `settingsSchema`.

### From C.3 (identity-ui)

**D-1d — the PFA tab is already an identity editor pointed at the wrong store.** `Settings.tsx:47-52`
edits `denumire`, `cui`, `numarRegComert` — all three already exist in `PfaIdentity`. So the company tab
moves from `updateSettings` to `updateProfile({identity: {...}})` with the same field labels; the
`Personal` tab's three disabled inputs become editable and write `identity.nume/email/telefon`; the
disabled company address at `:268` becomes editable and writes `identity.adresaSocietate`.

**D-1e — sidebar renders the COMPANY name, topbar keeps the person name.** Deliberate, to avoid
strict-mode ambiguity: `App.test.tsx` asserts `getByText('Popescu Andrei')` and `getByText('PA')`, so the
sidebar must not duplicate the person's initials. Sidebar keeps the `S` mark + `SOLO` product word and
gains `profile.identity.denumire` (fallback `nume`). Verified against `App.test.tsx` (read in full): it
renders `<StoreProvider><App/></StoreProvider>` with `localStorage.clear()`, i.e. seed data and the whole
shell including the default page, and asserts exactly those two strings plus the absence of the old
hardcoded `Popescu Ion` / `PI`.

**D-1f — the Dashboard greeting must not repeat the full name.** Because `App.test.tsx` renders the whole
shell, a greeting containing `Popescu Andrei` would make `getByText('Popescu Andrei')` match twice and
throw. Resolution: greeting renders `Bună, {firstName}` (first token of `identity.nume` → "Bună, Andrei")
— still read from the same store, but a distinct string. Likewise the sidebar's `denumire`
('Popescu Consulting SRL') must NOT also be rendered inside the Dashboard, or it would collide with the
sidebar in the same DOM. New coverage added instead of loosened: assert the sidebar company name and the
greeting with their own scoped locators.

## E. Test plan mapped to acceptance criteria (planned before coding)

| AC | Test to add | Where |
|---|---|---|
| AC2 legacy payload migrates, collections survive **by id** | v0 payload (no `version`) with non-empty revenues/expenses/clients/declarations + ids asserted after load; `dataOrigin === 'persisted'`; `migratedFrom === 0` | new `src/data/store.migration.chain.test.tsx` |
| AC3 pre-Phase-7 payload loads **including stored snapshots** | payload with 2 snapshots whose embedded profile lacks `codTvaIntra`/`mentiuniFactura`/`caen[]` → loads as persisted, snapshots survive by `calculationId`, embedded profiles backfilled, `inputsHash` byte-identical after load (F-1 + F-2b) | same file |
| AC4 corrupt → quarantine + told | invalid JSON and schema-invalid payload each quarantined under `pfa-app-data-v2:quarantine` with `reason`; seed loads; `dataOrigin === 'quarantined'`; a **second** corrupt load does not clobber slot 1; a subsequent save does not touch the quarantine key | same file + `App.test.tsx` banner test |
| AC5 identity round-trip | edit name + `codTvaIntra` + `mentiuniFactura` + CAEN in Settings → reload → sidebar, topbar, greeting all show it | `src/pages/Settings.test.tsx` + `e2e/settings.spec.ts` (new tests, not edits of existing) |
| AC6 no duplicate identity state readable | grep-style source test: no file outside `data/migration*`/`store.tsx` reads `settings.company`/`settings.personal` | new `src/data/identity.source.test.ts` (reads source files via `fs`) or documented check in phase doc |
| AC7 caen duplication resolved | `identity.caen[0].cod` round-trips; `profile.caen` no longer read by app code | `Settings.test.tsx` + migration test |
| F-2a identity not in `inputsKey` | edit identity → `inputsKey` unchanged | `src/domain/derived.test.tsx` |
| AC1 numbers | tsc 0, build 0, unit > 531, e2e > 29 | commands |

Existing tests that MUST be updated (assertion follows reality, coverage kept):
`store.save.test.tsx` exact-key-set 10 → 11 (`version`); `Settings.test.tsx` company-tab persistence
tests (they assert `settings.company` in localStorage — the write target moves to `profile.identity`);
`store.migration.test.ts` (5 tests on `legacyProfileFromSettings`) if that function moves into the chain.

### C.4 Scout `snapshots` — snapshot create/read path, inputsHash, backfill test (COMPLETE)

Choke point: `data/schema.ts:126-146`.
```ts
const profileSchema = z.custom<PfaProfile>((value) => parsePfaProfile(value) !== null);
export const taxCalculationSnapshotSchema = z.object({
  calculationId: nonEmptyString, taxYear: z.number().int(), calculatedAt: z.string(),
  ruleRelease: ruleReleaseSchema,
  inputSnapshot: z.object({ profile: profileSchema, revenues: z.number(), expenses: z.number() }),
  inputsHash: z.string(),
  calculationLines: z.array(z.object({ label: z.string(), value: z.number() })),
  output: z.object({ total: z.number() }),
  status: z.enum(['computed', 'superseded', 'void']),
});
```
Embedded profile is validated **indirectly**: `z.custom` → `parsePfaProfile` → `pfaProfileSchema.safeParse`.
`z.custom` performs **no transform**, so the embedded profile passes through **unstripped** — extra keys
survive in memory; the outer `z.object` strips only `inputSnapshot`'s own unknown keys. Zod is `^4.6.5`.

- TS type `TaxCalculationSnapshot` = `domain/snapshots/types.ts:43-63`; `CalculationInput` = `:20-26`
  `{profile, revenues, expenses}`. Persisted field name is **`snapshots`** (`schema.ts:228` optional;
  `AppData.snapshots` required, `types.ts:162`).
- Only factory: `domain/snapshots/snapshot.ts:26-45` `createCalculationSnapshot` — embeds the live
  `PfaProfile` **by reference** (`profile: p.profile`, so full identity + `updatedAt`) and computes
  `inputsHash: await computeInputsHash(inputSnapshot)` **once, at creation** (`:40`).
  Callers: `domain/tax.ts:221` and `:232`. Result returned in memory as `TaxEstimateResult.snapshot`.
- **`addSnapshot` has NO production caller** (`store.tsx:50`, `:210`, tests only) ⇒ the app never
  persists a snapshot today. `e2e/dashboard.spec.ts:90-91` says so in a comment: "persisting it is
  Phase 7, not Phase 5". **Not in my scope list** → record as still-open in the phase doc.
- `addSnapshot` (`store.tsx:210`) is append-only; `store.snapshots.test.tsx:116-129` asserts no
  update/delete path exists. **No dedupe on `inputsHash` anywhere.**
- Reads: `getSnapshot` (`store.tsx:211`) returns the stored object as-is;
  `completeness.ts:183-195` reads only `status` + count. **Nothing re-executes the engine from
  `inputSnapshot.profile`** — the dashboard always recomputes from the live profile
  (`dashboard.ts:241`). Stored results are read only as `status` / `output.total` / `calculationLines`.
- `inputsHash` repo-wide hits: type decl, factory (`snapshot.ts:24,40`), `data/schema.ts:141`
  (`z.string()`, presence/type only, **never verified**), and tests. Only `snapshots.test.ts:161,:328`
  recompute — in memory, on freshly created snapshots. **Zero hits in `e2e/`. No load/store/migration
  path re-hashes.**
- `inputsKey` (`derived.ts:137-152`) = exactly 10 fields (regime, salaryStatus, salaryIncomeLei,
  pensionStatus, otherIncome, socialInsuranceStatus, vatExempt, cashFloorLei, fiscalYear, pfaStartDate).
  Excludes all 14 identity fields **and** `id`, `caen`, `pfaStartYear`, `updatedAt`. `canonicalKey` at
  `derived.ts:121-130`. `inputsKey` (runtime cache/provenance key) is unrelated to `inputsHash`
  (persisted SHA-256 over the whole `inputSnapshot`).
- `store.profileBackfill.test.tsx` (9 tests) **never loads a payload with snapshots** —
  `legacyPayload()` hard-codes `snapshots: []` at `:100`. So the snapshot leg of F-1 is untested today.
  Payloads that DO contain snapshots: `store.load.test.tsx:94-113` (valid snapshot preserved,
  `inputsHash: 'abc123'`), `:257-266` (missing array → `[]`), `schema.test.ts:88-105`, `:243-257`
  (missing `output` → null), `:259-274` (invalid embedded release → null).
- `seed.ts:81 snapshots: []` — no seeded snapshot, so no verbatim embedded profile to copy.

**What the scout says breaks if I rewrite an embedded profile:**
`serialize.ts:10-27 canonicalize` serializes **every key**, and `snapshots.test.ts:96-99` pins that
adding a key changes the digest (`canonicalize({a:1})` vs `canonicalize({a:1,b:0})`). So a migration
that adds fields to a stored snapshot's embedded profile makes the stored `inputsHash` no longer equal
`computeInputsHash(snap.inputSnapshot)` — breaking the provenance invariant at
`snapshots.test.ts:152-161` and `:328`. Optional fields alone are safe (validation passes, bytes
unchanged, hash stays valid).

### D-final. The one real conflict in the brief, and how I resolve it

- **F-1 (brief, verbatim):** "make the migration backfill them into the live profile **and** into the
  embedded profiles of stored snapshots."
- **F-2 (brief, verbatim):** "Stored `inputsHash` values are never recomputed **on load** (snapshots are
  validated structurally by zod, not re-hashed). So widening `identity` does not invalidate existing
  snapshots' hashes."
- F-2's conclusion holds only while the stored **bytes** are unchanged. F-1 mandates changing those
  bytes. So the two statements collide unless the migration itself re-derives the digest.

**DECISION D-1g — backfill the embedded profiles (F-1 is explicit and AC3 says "handled, not avoided"),
and re-derive `inputsHash` inside the migration step, preserving the pre-migration digest.**
Reasoning:
1. The repo's own provenance contract is `inputsHash === computeInputsHash(inputSnapshot)`
   (`snapshots.test.ts:152-161,:328`). Backfilling without re-deriving would leave **every migrated
   snapshot failing its own invariant**, which is worse than a re-derived digest: any future integrity
   check (Phases 9/10 audit work) would flag all historical data as corrupt.
2. F-2's actual prohibition is about the **load path** re-hashing, and about **`inputsKey`**. Both stay
   intact: a payload already at the current version loads with `inputsHash` byte-identical (I will test
   exactly this), and identity stays out of `inputsKey`.
3. Re-derivation happens **once, in a versioned migration step**, not on every load.
4. Nothing is lost: the snapshot gains an **optional** `preMigrationInputsHash` (optional ⇒ no F-1
   hazard) holding the original digest, and I test that the *fiscal* inputs inside the snapshot
   (`revenues`, `expenses`, and the 10 `inputsKey` fields of the embedded profile) are byte-identical
   before and after migration — so the recorded `output` still corresponds to the same fiscal inputs.
5. No functional side effect today: no dedupe, no lookup, no engine re-run uses `inputsHash`.

Tests this decision requires: (a) migrated snapshot's digest equals `computeInputsHash` of its migrated
input; (b) `preMigrationInputsHash` keeps the old digest; (c) fiscal inputs unchanged by migration;
(d) current-version payload loads with `inputsHash` untouched (F-2 load-path proof);
(e) `inputsKey` unchanged after an identity edit (F-2).

## F. Implementation status (as of this edit — source of truth for me if compacted)

### DONE (code written)
1. **`domain/models.ts`** — added `CaenCode {cod, descriere}` (domain owns the CAEN model).
   `PfaIdentity` gains OPTIONAL `codTvaIntra?`, `caen?: CaenCode[]`, `mentiuniFactura?`.
   `PfaProfile.caen` is now `caen?: string` + `@deprecated` doc.
2. **`domain/schema.ts`** — `caenCodeSchema` (`cod` min(1), `descriere` plain string);
   `pfaIdentitySchema` gains the 3 optional fields; `pfaProfileSchema.caen` → `.optional()`.
   Deliberately NO format validation (CUI/CNP/IBAN/CAEN shape) — it would reject legacy
   values = data loss. Documented inline.
3. **`domain/profile.ts`** — `EMPTY_IDENTITY` gains `codTvaIntra:''`, `caen:[]`, `mentiuniFactura:''`;
   `createDefaultProfile` no longer writes the deprecated `caen`.
4. **`domain/snapshots/types.ts`** — `TaxCalculationSnapshot.preMigrationInputsHash?: string`.
5. **`domain/snapshots/hashSync.ts`** (NEW) — synchronous SHA-256 (`sha256Hex`,
   `computeInputsHashSync`). WHY: migration must re-derive digests, load path is sync
   (`useState(loadInitial)`), snapshots are append-only so a digest can only be corrected
   at migration time; `crypto.subtle` is async-only. Tables generated from the spec, and a
   word-loader bug (`bytes[off+i]` vs `bytes[off+i*4]`) was caught by testing against
   Node's SHA-256 BEFORE shipping.
6. **`domain/snapshots/hashSync.test.ts`** (NEW) — equivalence vs `computeInputsHash` over
   empty/abc/55/56/64/1000 chars/UTF-8/JSON, the known `abc` vector, order-independence, and
   "adding a key changes the digest" (the reason re-derivation is mandatory).
7. **`data/migration.ts`** (NEW) — `DATA_VERSION_BASE=0`, `DATA_VERSION_IDENTITY=1`,
   `CURRENT_DATA_VERSION=1`, `MigrationStep`, `MIGRATION_CHAIN`, `readStoredVersion`,
   `migratePersistedData` (throws `UnsupportedDataVersionError` when stored > current;
   throws if a step fails to bump the version), `legacyProfileFromSettings` (MOVED here from
   store.tsx), `absorbCompanyIdentity`, `foldLegacyCaen`, `migrateIdentityV1`,
   `backfillSnapshotIdentity`.
   Chain principle: **backfill only from a real source, never invent a value.**
   v0→v1 live profile: identity.codTvaIntra/mentiuniFactura ← settings.company;
   identity.caen ← settings.company.caen[] else deprecated profile.caen string; profile built
   from settings when absent; `delete nextProfile.caen` after folding (live profile normalized).
   v0→v1 snapshots: identity.caen ← that snapshot's OWN embedded `profile.caen` string only
   (never today's settings — audit record); codTvaIntra/mentiuniFactura left ABSENT (no source).
   Re-derives `inputsHash` via `computeInputsHashSync` and preserves the old one in
   `preMigrationInputsHash`; returns the snapshot untouched when nothing was added.
8. **`data/quarantine.ts`** (NEW) — `QUARANTINE_KEY_SUFFIX=':quarantine'`, `quarantineKey()`,
   `QUARANTINE_HISTORY_LIMIT=10`, `QuarantineReason` = unparseable-json | schema-invalid |
   unsupported-version | storage-read-error, `QuarantineRecord{envelopeVersion:1, quarantinedAt,
   reason, detail, raw, laterAttempts[]}`. **First copy is never overwritten**; later rejections
   prepend to `laterAttempts` (newest first, capped). `quarantinePayload` is best-effort
   (never throws). `readQuarantine`, `quarantineSummary` (Romanian, uses a lookup map).
9. **`data/schema.ts`** — `version: z.number().int().min(0).optional()` on
   `persistedAppDataSchema` + `version?: number` on `PersistedAppData` (required by the
   `Expect<Equal<...>>` assertion); `preMigrationInputsHash: z.string().optional()` on the
   snapshot schema; `parseAppDataResult()` returns `{ok:false,reason,detail}` (zod issues,
   first 12, `path: message`) and `parseAppData` is now a thin wrapper (existing tests intact);
   `_checks` is now `export type` (was flagged unused; assertion still fails the build on drift).
10. **`data/store.tsx`** — `STORAGE_KEY` now EXPORTED + `QUARANTINE_STORAGE_KEY`;
    `DataOrigin = 'seed'|'persisted'|'migrated'|'quarantined'`; `LoadedData` gains
    `migration`/`quarantine`; `StoreValue` gains `dataVersion`, `migration`, `quarantine`,
    `getQuarantinedPayload()`; `toAppData()` extracted; `rejected()` helper quarantines BEFORE
    falling back to seed and reports `'quarantined'` only when a copy was actually preserved;
    `loadInitial` handles read-throw / bad-JSON / schema-invalid / unsupported-version /
    migration-threw. Save effect writes `{...data, version: CURRENT_DATA_VERSION}` — version
    stamped at WRITE time (not carried in AppData) so a payload always declares this build's
    version. `legacyProfileFromSettings` removed from store.tsx (moved to migration.ts).
11. **`pages/Settings.tsx`** — all identity reads/writes moved to `profile.identity` via
    `updateIdentity(patch)`. PFA tab edits denumire/cui/numarRegComert/**adresaSocietate (now
    editable)**; CAEN card + codTvaIntra card read identity; `saveMentiuni`/`addTva` write
    identity; Personal tab's 3 inputs are now editable with `savePersonal()` (rejects empty
    name) + a header Salvează button for `tab==='account'`; `saveFiscal` no longer writes
    `profile.caen` — it writes `identity.caen[0]` keeping the existing descriere. `settings`
    is still used for eFactura + bankAccounts (not identity).

### NOT DONE YET
- `App.tsx` sidebar identity + quarantine banner; `Dashboard.tsx` greeting (see D-1e/D-1f).
- `seed.ts`: add identity.caen/codTvaIntra/mentiuniFactura, drop deprecated `profile.caen`.
- Test updates: `store.migration.test.ts` (import from `./migration`, assert identity.caen not
  profile.caen), `store.save.test.tsx` (11 keys + version value), `Settings.test.tsx`
  (company persistence now identity), `store.profileBackfill.test.tsx:159` (profile.caen).
- NEW tests: `data/store.migration.chain.test.tsx` (AC2/AC3/F-1/F-2b), quarantine tests (AC4),
  identity round-trip (AC5), `data/identity.source.test.ts` (AC6 grep-style), `derived.test.ts`
  identity-not-in-inputsKey (F-2a).
- e2e: `settings.spec.ts` CAEN assertions move to `identity.caen[0].cod`; add identity round-trip.
- Docs: `docs/ai/phases/07_identity.md`, `STATE.md`, `PLAN.md`.
- Run: tsc / build / test / test:e2e.

### tsc state at last run: 2 errors (store.migration.test import, Settings fiscal.caen possibly
undefined) — both addressed by the Settings rewrite + pending test import fix.

### F-2 CORRECTION (after re-reading my own notes — I had drifted from D-3b)
Implemented `DataOrigin = 'seed'|'persisted'|'migrated'|'quarantined'` and that broke 5 existing tests
(store.load 'persisted', profileBackfill ×3). **D-3b was right and I had abandoned it silently.**
Reverting to D-3b: `dataOrigin` gains ONLY `'quarantined'`; a versionless payload that migrates
successfully is still `'persisted'` (it IS the user's persisted data), and the migration is reported by
the separate `migration: {from,to}` store field. This keeps the Phase 6 safety net's meaning intact.
Also splitting the chain per D-2a: **v0→v1 = profile materialization (Phase 6 backfill)**,
**v1→v2 = identity absorption + snapshot backfill (Phase 7)**, `CURRENT_DATA_VERSION = 2`.

### F-3 DONE since the last status write (verified by tsc 0 + vitest run)
- `App.tsx` — sidebar identity line (`denumire` fallback `nume`, never the person's initials), D-3
  recovery banner (`role="status"`, `data-testid="data-recovery-banner"`, `<details>` per-reason lines,
  no raw payload in the DOM), `inert` spread cast fixed + SAFETY comment.
- `domain/profile.ts` — `identityGreeting(identity)` = LAST token of `identity.nume` (dataset stores
  surname-first, 'Popescu Andrei' → 'Andrei'); '' when empty. `Dashboard.tsx` renders
  `Bună, {greeting}` only when non-empty (D-1f: never the full name — App.test strict-mode ambiguity).
- `seed.ts` — dropped deprecated `profile.caen`; identity gains `codTvaIntra`, `caen:[{6201,…}]`,
  `mentiuniFactura`.
- `styles.css` — `.sidebar-identity`, `.banner`, `.banner-warn`, `.banner-details`, `.greeting`.
- `store.migration.test.ts` — imports from `./migration`; CAEN assertions now on `identity.caen`.
- tsc: 0 errors. vitest: 534 passed / 13 failed (all 13 are assertion-follows-reality updates + the
  D-3b revert above).

### F-4 Remaining failure triage (13)
1. store.load ×3 → 1 fixed by D-3b revert; 2 corrupt cases now `'quarantined'` (correct, D-3) — update
   assertion AND assert the quarantined copy exists (coverage up, not down).
2. store.profileBackfill ×4 → 3 fixed by D-3b revert; 2 invalid-payload cases → `'quarantined'`.
3. store.save ×1 → 11 keys + assert `version === CURRENT_DATA_VERSION`.
4. Settings.test ×2 → company tab now persists `profile.identity.denumire`; fiscal tab CAEN now
   `profile.identity.caen[0].cod === '6202'`.
5. store.migration ×2 → `absorbCompanyIdentity` must fall back to `settings.company.codCAEN` when
   `company.caen[]` is empty (real legacy source, matches the pre-Phase-7 rule); minimal-settings case
   expects `identity.caen` **absent** (never invent a value), not `[]`.

## G. Implementation status #3 (post-D-3b-revert; verified tsc 0 + vitest green)

### Chain as built (`src/data/migration.ts`)
`DATA_VERSION_BASE=0 → DATA_VERSION_PROFILE=1 → DATA_VERSION_IDENTITY=2 = CURRENT_DATA_VERSION`.
Steps (names are stable, never renumber): **`profile-materialization`** (`materializeProfileV1`:
`profile ?? legacyProfileFromSettings(settings)`, invents nothing new) then **`identity-absorption`**
(`migrateIdentityV2`: absorb `codTvaIntra`/`mentiuniFactura`/`caen[]` from `settings.company` —
`caen[]` else `settings.company.codCAEN` alias — then `foldLegacyCaen(profile.caen)`,
`delete nextProfile.caen`, then `backfillSnapshotIdentity` per snapshot).
`absorbCompanyIdentity` never overwrites a value the profile already carries.
`backfillSnapshotIdentity`: folds ONLY that snapshot's own deprecated `caen` string; also
`delete`s the embedded deprecated `caen` (exactly one CAEN representation after the fold);
returns the snapshot **untouched** (same digest) when there was nothing to add; when it does
change, re-derives `inputsHash` with `computeInputsHashSync` and keeps the old one in
`preMigrationInputsHash`.
`migratePersistedData` throws `UnsupportedDataVersionError` when stored > current; the store
quarantines with reason `unsupported-version`.

### `dataOrigin` (D-3b, restored)
`DataOrigin = 'seed' | 'persisted' | 'quarantined'`. A migrated payload is still `'persisted'`;
migration is reported by `StoreValue.migration = {fromVersion,toVersion,stepsApplied}` and
`dataVersion`. `App.tsx` toasts once, keyed on `migration` (not `dataOrigin`).
Quarantine reasons: `unparseable-json | schema-invalid | unsupported-version | storage-read-error`.

### Existing tests updated (assertion follows reality, coverage kept)
- `store.load.test.tsx`: imports `STORAGE_KEY`/`QUARANTINE_STORAGE_KEY` from `./store` (no more
  copy-paste key); 2 corrupt cases → `'quarantined'` + assert reason + preserved copy; NEW:
  versionless payload → `'persisted'` + `migration` object + `dataVersion`; current-version payload
  → `'persisted'`, `migration === null`.
- `store.profileBackfill.test.tsx`: 2 invalid-payload cases → `'quarantined'`; the "leaves optional
  fields absent" test now asserts `profile.caen === undefined` AND
  `profile.identity.caen === seedData.settings.company.caen`.
- `store.save.test.tsx`: key set 10 → 11 (`version`) + `persisted.version === CURRENT_DATA_VERSION`;
  NEW test "never writes the quarantine key (D-3: the rejected copy survives a save)".
- `store.migration.test.ts`: imports from `./migration`; CAEN on `identity.caen`; `codCAEN` fallback
  case; minimal payload ⇒ `identity.caen` **absent** (never invented); `'caen' in p === false`.
- `Settings.test.tsx`: imports `STORAGE_KEY`; `readStoredDenumire()` reads
  `profile.identity.denumire`; tests renamed "…company identity…"; fiscal CAEN ⇒
  `profile.identity.caen[0].cod === '6202'` + `profile.caen === undefined`.

### New test files
- `src/data/store.migration.chain.test.tsx` — 18 tests: chain shape; versionless = base; profile
  materialization; absorption (needs a settings fixture that CARRIES `codTvaIntra`/`mentiuniFactura`
  — the seed does not, it only has `codCAEN`); no-clobber; absent-when-no-source; deprecated scalar
  dropped; no-op at current version; snapshots by `calculationId`; embedded CAEN from the snapshot's
  OWN string; today never written into history; digest re-derived + `preMigrationInputsHash`;
  fiscal inputs byte-identical (`canonicalize` of the 10 `inputsKey` fields); untouched snapshot keeps
  its digest; load path AC2 (ids survive) / AC3 (snapshots survive + `getSnapshot` resolves) /
  F-2b (current-version `inputsHash` unchanged) / newer-build quarantine.
- `src/data/identity.source.test.ts` — 3 tests, AC6 + AC7. Uses `import.meta.glob('../**/*.{ts,tsx}',
  {query:'?raw'})` (NO `@types/node` in this browser app — do not add it), strips comments before
  matching, allowlists `migration.ts/schema.ts/types.ts/seed.ts` for legacy identity and
  `migration.ts/models.ts/schema.ts` for `profile.caen`. `fiscal.caen` is the Settings FORM field
  name, deliberately not policed.
- `src/vite-env.d.ts` — NEW: `/// <reference types="vite/client" />` (needed for `import.meta.glob`).

### Gotchas hit (do not re-learn the hard way)
1. `edit` with an overlapping pair in the same call ⇒ **whole call aborted**; re-check after
   multi-edits (`grep` the file) instead of trusting the "clean" LSP line.
2. Harness `edit` requires a prior `read` of that file — `bash sed` does not count.
3. Fixture shapes come from `data/types.ts`: `Expense{tip,nr,date,furnizor,cui,valoareFaraTva,tva,status}`,
   `Client{denumire,cui,email?,telefon?,oras?}`, `Declaration{an,luna,venituri,cheltuieli,status,dataInregistrare}`.
4. Quarantine record stores `raw` as a STRING, so asserting on the payload's contents means
   `JSON.parse(localStorage.getItem(QUARANTINE_KEY)!).raw`.
5. JSX: inside an element's attribute list a comment must be `/* … */`, not `{/* … */}`.

### STILL TO DO (exact list)
1. F-2a test: identity edit leaves `inputsKey` byte-identical → add to `src/data/derived.test.tsx`.
2. AC5 unit: `Settings.test.tsx` identity round-trip (name + `codTvaIntra` + `mentiuniFactura` +
   CAEN → remount → persisted identity); `App.test.tsx` sidebar `denumire` + greeting +
   `data-recovery-banner` visible on a corrupt payload.
3. e2e: `e2e/settings.spec.ts` CAEN assertion (`saved.caen === '6202'` →
   `saved.profile.identity.caen[0].cod`); NEW identity round-trip e2e — remember Phase 6 §10 trap 2:
   `addInitScript` re-runs on reload, so do NOT seed localStorage in that test.
4. Docs: `docs/ai/phases/07_identity.md` (deliverable: D-1/D-2/D-3 + chain table + quarantine contract
   + still-open + one line on the archived step files it contradicts), `STATE.md` (close B-8/B-11/B-12,
   update B-10 if true), `PLAN.md` Phase 7.
5. Also record in the phase doc: `addSnapshot` still has NO production caller (snapshots are not
   persisted by the app yet — Phase 5 comment in `e2e/dashboard.spec.ts:90`), and the 24-SM tier-floor
   threshold surface was NOT taken (it did not fall out of the identity work).
6. Final validation: `npx tsc --noEmit`, `npm run build`, `npm run test`, `npm run test:e2e`.

## H. Implementation status #4 — ALL TESTS DONE, docs remain (verified numbers)

Verified at this edit: `npx tsc --noEmit` = 0 · `npx vitest run` = **578 passed / 41 files**
(baseline 531/38) · `npx playwright test` = **32 passed** (baseline 29).

Corrections to my own earlier notes:
- The recovery banner is `role="alert"` + `.banner.banner-warn` (NOT `role="status"`, and there is
  NO `data-testid`). `App.test.tsx` asserts `getByRole('alert')` and that its text contains
  `unparseable-json`.
- `identityGreeting` = LAST token (`domain/profile.ts`), so 'Georgescu Maria' → 'Bună, Maria'.
- The app's OWN seed has `settings.company.denumire === 'Popescu Consulting SRL'` (the Phase 6 e2e
  `SEED_SETTINGS` fixture says 'Popescu Andrei PFA' — that fixture is not the app seed).

Done since status #3:
- `src/data/derived.test.tsx` — F-2a: identity edit leaves `inputsKey` byte-identical.
- `src/App.test.tsx` — new describe "App shell identity and recovery (Phase 7)": sidebar
  `.sidebar-identity` = denumire, topbar = nume, no recovery banner on healthy data, banner on a
  rejected payload (5 tests total in the file).
- `src/pages/Settings.test.tsx` — AC5 round-trip describe (11 tests total): personal name edit →
  `profile.identity.nume` persisted + `settings.personal.nume` frozen + restored on remount;
  mențiuni → `identity.mentiuniFactura`, NOT `settings.company.mentiuniFactura`.
- `e2e/settings.spec.ts` — CAEN assertion now `identity.caen[0].cod` + `saved.caen === undefined`;
  NEW describe "Phase 7 — identity round-trips through the one store" (2 tests, deliberately
  UNSEEDED per Phase 6 §10 trap 2) and "Phase 7 — a corrupt payload is quarantined" (1 test:
  `role=alert` banner, quarantine key holds `raw` + `reason`, main key re-persisted with
  `version > 0`, quarantine copy survives the save).

REMAINING (only docs): `docs/ai/phases/07_identity.md` (deliverable), `STATE.md`, `PLAN.md`.
Then final: tsc / build / test / test:e2e + handoff block.

## I. PHASE 7 COMPLETE — final state (all four gates green, docs written)

Final measured gates (re-run with the npm scripts, not just npx):
`npx tsc --noEmit` 0 · `npm run build` exit 0 · `npm run test` **41 files / 578 tests** ·
`npm run test:e2e` **32 passed**. Baseline was 38/531 + 29.

Docs written:
- `docs/ai/phases/07_identity.md` (THE deliverable, 10 sections): §1 purpose · §2 D-1 (fields, the
  `caen` model decision + 4 reasons, frozen legacy blocks) · §3 D-2 chain table (0→1
  `profile-materialization`, 1→2 `identity-absorption`) + write-time version stamping · §4 D-3
  quarantine contract table · §5 write path + 3 render sites with file:line · §6 the F-1/F-2 collision
  and decision **D-1g** (re-derive `inputsHash` in the migration, keep `preMigrationInputsHash`) ·
  §7 eight NOT-done items · §8 tests/validation + which test pins which AC · §9 archive contradictions
  (`steps/01:113,114,125,172,195-199,364-368`, `steps/12:79-82`) · §10 nine traps for Phase 8+.
- `docs/ai/STATE.md` — new Last-sync line; counts 41/578 + 32; phase table row 7 **done**; B-8, B-10,
  B-11, B-12 marked **FIXED (Phase 7)** with evidence; B-9's identity tail closed; "Also open" gained
  the `addSnapshot`-has-no-production-caller item; archive-corrections row for `updateProfile` updated;
  Documentation status gained the phases/07 entry.
- `docs/ai/PLAN.md` — Phase 7 section gained a "Delivered 2026-10-06" block (all of D-1/D-2/D-3 + the
  F-1/F-2 resolution + numbers + the not-taken list) and "Blocked by: nothing — **complete**"; the
  Phase 5 B-16 bullet now notes the schema/version work is available (v3 `.optional()` step).

Working tree is NOT committed (orchestrator owns commits). 21 modified + 9 new files, listed in the
handoff.

Nothing in this phase touched a fiscal formula, rate, base, threshold or parameter value.
