# Phase 7 — Identity source of truth + persisted-state migration

Worker: Phase 7 only. Date: 2026-10-06. HEAD at start: `d786834`.
Scope authority: `docs/ai/PLAN.md` (Phase 7 section, incl. the "Re-measured 2026-10-06, after Phase 6" block).
Defect context: `docs/ai/STATE.md` B-8, B-9 (identity half), B-10, B-11, B-12.
Decisions implemented as given: **D-1** (one identity store), **D-2** (`version` + migration chain under the
same key), **D-3** (quarantine instead of silent reset). No fiscal formula, rate, base or threshold was
changed — this phase changes what the engine is *given*, never how it computes.

---

## 1. What this phase was for

Four things, and nothing else:

1. **One identity store (B-8).** `profile.identity` is canonical. Before this phase the topbar read
   `profile.identity` while Settings wrote `settings.company` / `settings.personal`, and the two were
   reconciled exactly once, at first load, only when `profile` was absent. Editing the company name in
   Settings therefore never changed what the app displayed.
2. **A real write path for identity (B-9's remaining half, B-10).** The personal name/email/phone inputs
   were `disabled`; the company address was `disabled`. All of them now write through `updateProfile`.
3. **Persisted-state versioning + a migration chain (B-12).** There was no `version` field and no chain;
   the only migration-like logic was the profile backfill inside `loadInitial`.
4. **Non-destructive corrupt-payload recovery (B-11).** A payload that failed to parse was silently
   replaced by seed data and re-persisted over the user's copy. Now it is quarantined first and the user
   is told.

Out of scope and untouched: amount semantics / VAT turnover basis (Phase 8), date semantics (Phase 9),
money representation and rounding policy (B-17, Phase 10), B-19 (parked research item), and the CAS/CASS/
income-tax arithmetic from Phases 3–5.

---

## 2. D-1 — one canonical identity store

### 2.1 What `PfaIdentity` gained

`domain/models.ts` `PfaIdentity` gains exactly three fields, all **optional**:

| Field | Type | Absorbed from |
|---|---|---|
| `codTvaIntra?` | `string` | `settings.company.codTvaIntra` |
| `caen?` | `CaenCode[]` (`{cod, descriere}`) | `settings.company.caen[]`, else the deprecated `profile.caen` string |
| `mentiuniFactura?` | `string` | `settings.company.mentiuniFactura` |

`numarRegComert` was already present in `PfaIdentity`, so D-1's fourth field needed no model change.
`CaenCode` now lives in `domain/models.ts` — the domain owns the CAEN model, not the settings type.

**Every new field is `.optional()`, and nothing existing was made optional.** This is the Phase 6 §4/§10
trap carried forward: `pfaIdentitySchema` (`domain/schema.ts:13`) declares the 14 pre-existing identity
fields as plain required `z.string()`, and that one schema gates **both** the live profile
(`data/schema.ts:129`) **and** every stored calculation snapshot's embedded profile
(`taxCalculationSnapshotSchema.inputSnapshot.profile`, `data/schema.ts:131-145`). A *required* new
identity field would have invalidated every pre-Phase-7 payload and every stored snapshot, and the store
answered that with a whole-dataset reset to seed. A required new identity field in this repo is a
data-loss event, not a type error.

No format validation was added to any identity field (no CUI/CNP/IBAN/CAEN shape check). Rejecting a
legacy value that a real user typed years ago is data loss; the only validation is non-empty where the UI
needs it. This is deliberate and recorded here rather than in code comments alone.

### 2.2 The `caen` duplication — resolved, with the reason (AC7)

Two representations existed: `profile.caen: string` (`models.ts`) and `settings.company.caen: CompanyCaen[]`
(`{cod, descriere}`). **The structured entry wins: the single model is `identity.caen: CaenCode[]`.**

1. It is a strict superset — the scalar loses `descriere`, which is the only thing the Settings PFA tab
   displayed from that field.
2. CAEN is genuinely multi-valued; the legacy store was already an array.
3. **No engine rule keys on CAEN.** CAEN-keyed rules were declined as uncitable in `phases/06_fiscal_profile.md`
   §7 item 8, so nothing depended on the scalar shape and keeping it would have bought nothing.
4. It makes D-1's "identity absorbs `caen[]`" literally true.

`PfaProfile.caen` survives as **`caen?: string` marked `@deprecated`** for parse-compatibility only
(`models.ts:146`, `domain/schema.ts` `.optional()`). After this phase **no application code reads or
writes it**: the fiscal tab's CAEN input reads and writes `identity.caen[0].cod`, keeping the existing
`descriere`. The migration folds the scalar and then `delete`s it, so a migrated payload carries exactly
one CAEN representation. Proof is enforced by a test, not by review — see §7.

### 2.3 What `settings.company` / `settings.personal` became

They are **frozen legacy data, still parseable, never written again.** They stay *required* in
`settingsSchema` — `settings` itself is a required collection of `persistedAppDataSchema`, and
`schema.test.ts` treats "missing settings", "empty settings" and "missing company block" as corrupt cases.
Making those blocks optional would have silently accepted payloads the previous build rejected. Instead
the store simply stops writing them: the loaded/seeded values round-trip untouched, so nothing fails to
parse and the archived behaviour "a payload written by build N still parses in build N+1" is preserved.

They are read by **one** place: the migration. `src/data/identity.source.test.ts` (3 tests, AC6 + AC7)
reads the app's own source through `import.meta.glob('../**/*.{ts,tsx}', { query: '?raw' })`, strips
comments, and fails the suite if any file outside the allowlist touches `settings.company`,
`settings.personal` or the deprecated `profile.caen`. Allowlisted: `data/migration.ts` (the migration),
`data/schema.ts` / `data/types.ts` (the legacy types), `data/seed.ts` (the seed still seeds the legacy
block so old installs keep a valid `settings`), and `domain/models.ts` / `domain/schema.ts` for the
deprecated scalar. `Settings.tsx`'s local form state is named `fiscal.caen`; that is a form field name,
not a read of the deprecated model, and is deliberately not policed.

Note: `settings` is **not** retired wholesale — `eFactura`, `bankAccounts` and the unread `cotaTva` are
not identity and still live there (`Settings.tsx` keeps `updateSettings` for e-Factura and bank accounts).

---

## 3. D-2 — `version` + the migration chain (same storage key)

The key stays **`pfa-app-data-v2`** (`data/store.tsx:14`, now exported, plus
`QUARANTINE_STORAGE_KEY`). D-2 versions the payload *inside* the key rather than moving to a new key, so
an existing install is upgraded in place instead of orphaned.

`version: z.number().int().min(0).optional()` (`data/schema.ts:231`) — optional so a versionless payload
still parses — plus `version?: number` on the hand-written `PersistedAppData` interface, which the
compile-time `Expect<Equal<z.output<typeof persistedAppDataSchema>, PersistedAppData>>` assertion forces.
Zod strips unknown keys, so a `version` declared only in the payload would have been silently discarded.

### 3.1 The chain (`src/data/migration.ts`, new, pure, no DOM)

| Version | Step name | What it backfills | Source of the value |
|---|---|---|---|
| **0** `DATA_VERSION_BASE` | *(absent `version` key — today's payloads)* | — | — |
| 0 → **1** `DATA_VERSION_PROFILE` | **`profile-materialization`** (`materializeProfileV1`) | `profile` when it is absent | `legacyProfileFromSettings(settings)` — moved verbatim out of `store.tsx:68-101/:118`, so B-12's "the only migration logic is the profile backfill" is literally replaced by a named step |
| 1 → **2** `DATA_VERSION_IDENTITY` = `CURRENT_DATA_VERSION` | **`identity-absorption`** (`migrateIdentityV2`) | `identity.codTvaIntra`, `identity.mentiuniFactura`, `identity.caen[]`; folds and deletes the deprecated `profile.caen`; then `backfillSnapshotIdentity` per stored snapshot | `settings.company.codTvaIntra` / `.mentiuniFactura` / `.caen[]`, else the `settings.company.codCAEN` alias, else that record's own `profile.caen` string |
| > current | — | — | `migratePersistedData` throws `UnsupportedDataVersionError`; the store quarantines with reason `unsupported-version` instead of guessing |

`readStoredVersion` treats a payload with no `version` key as **0**, exactly as D-2 specifies. Step names
are stable — they are never renumbered, because they are what a future reader matches a payload against.

**Chain principle: backfill only from a real source; never invent a value.** Consequences that are
covered by tests: `identity.caen` is left **absent** when neither `settings.company.caen[]` nor the
`codCAEN` alias nor the deprecated scalar carries anything (it is not defaulted to `[]`);
`absorbCompanyIdentity` never overwrites a value the profile already carries; Phase 6's
`pfaStartDate` / `salaryIncomeLei` are left absent rather than fabricated.

**Snapshots are migrated from their own history, not from today's settings.** A stored snapshot is an
audit record: `backfillSnapshotIdentity` folds only *that snapshot's* embedded `profile.caen` string, and
`codTvaIntra` / `mentiuniFactura` are left absent for snapshots because no per-snapshot source exists.
Today's `settings.company` is never written into a historical record.

### 3.2 Where the version is written

The save effect stamps `version: CURRENT_DATA_VERSION` **at write time** (`store.tsx:192`) rather than
carrying it inside `AppData`. That is what guarantees a payload always declares the version this build
understands, even after a mutation, so the chain never has to guess — and it keeps `AppData` (the runtime
shape) free of a persistence-only field. `store.save.test.tsx`'s exact-key-set assertion went 10 → 11 keys
and now also pins `version === CURRENT_DATA_VERSION`; the coverage was updated to match reality, not
deleted.

`parseAppData` keeps its old contract (`payload | null`) so the ~26 `schema.test.ts` tests keep their
meaning; the store uses the new `parseAppDataResult()`, which returns
`{ok: false, reason, detail}` with the first 12 zod issues rendered as `path: message`.

---

## 4. D-3 — the quarantine contract

New module `src/data/quarantine.ts`.

| Element | Contract |
|---|---|
| Key | `pfa-app-data-v2:quarantine` (`QUARANTINE_KEY_SUFFIX = ':quarantine'`, derived by `quarantineKey(dataKey)`) |
| Record | `{envelopeVersion: 1, quarantinedAt, reason, detail, raw, laterAttempts[]}` — `raw` is the **verbatim string** that failed, so the user's bytes are recoverable |
| Reasons | `unparseable-json` \| `schema-invalid` \| `unsupported-version` \| `storage-read-error` — the three previously indistinguishable failure modes (bad JSON / schema fail / throw) are now named |
| Append-only | **The first rejected copy is never overwritten.** A later rejection prepends to `laterAttempts` (newest first, capped at `QUARANTINE_HISTORY_LIMIT = 10`). No slot-cycling, so a second corrupt save cannot destroy the only good copy |
| Write isolation | The save path writes **only** the main key. The store re-persists the recovered seed to the main key on first mount, and a test asserts the quarantine key is untouched by that save — this is what makes "quarantine is not overwritten by the next save" a fact rather than a hope |
| Best effort | `quarantinePayload` never throws: if preservation fails, the store reports `'persisted'`-style recovery without claiming a copy exists. `dataOrigin === 'quarantined'` is reported **only when a copy was actually preserved** |
| User-visible | `App.tsx` renders `.banner.banner-warn` with `role="alert"` when `dataOrigin === 'quarantined'`: „**Datele salvate nu au putut fi citite.**" + `quarantineSummary()` (Romanian, from a reason lookup map) + a `<details>` with `reason`, `detail` and `quarantinedAt`. The raw payload is never put in the DOM |
| Recovery | `getQuarantinedPayload()` exposes the preserved string for a future restore flow; there is **no automatic restore** in this phase (§7) |

`DataOrigin` is `'seed' | 'persisted' | 'quarantined'` — **exactly one new value.** A versionless payload
that migrates successfully is still `'persisted'`: it *is* the user's own data, and the Phase 6 safety net
(`store.profileBackfill.test.tsx`) asserts that a legacy payload yields `'persisted'`. Adding a
`'migrated'` origin would have split that single check into two weaker ones. Whether a migration ran is
reported separately on `StoreValue.migration = {fromVersion, toVersion, stepsApplied}` and
`StoreValue.dataVersion`; `App.tsx` toasts once, keyed on `migration`, not on `dataOrigin`.

---

## 5. The write path and the render sites

**Writes** (`src/pages/Settings.tsx`, all through the Phase 6 `updateProfile` path via one
`updateIdentity(patch)` helper at `:103`):

- PFA tab (`saveCompany`, `:107`) — `denumire`, `cui`, `numarRegComert`, and **`adresaSocietate`, which is
  no longer `disabled`**. This tab was already an identity editor pointed at the wrong store.
- Personal tab (`savePersonal`, `:112`) — the three previously `disabled` inputs (`Nume`, `Email`,
  `Telefon`) are editable and write `identity.nume/email/telefon`; an empty name is refused. A header
  „Salvează" appears for this tab.
- Mențiuni card (`saveMentiuni`, `:122`) → `identity.mentiuniFactura`.
- Cod TVA intracomunitar card (`addTva`, `:211`) → `identity.codTvaIntra`.
- Regim fiscal tab (`saveFiscal`, `:132`) — no longer writes `profile.caen`; it writes `identity.caen[0]`
  and keeps the existing `descriere`.

**Reads** — three sites, one store:

| Site | Renders | Note |
|---|---|---|
| `App.tsx:212-213` `.sidebar-identity` | `identity.denumire \|\| identity.nume` | replaces the hardcoded brand block; the `S`/`SOLO` product mark stays |
| `App.tsx:262-263` `.topbar-user` | `identity.nume` + `initials(identity.nume)` | unchanged source, now actually writable |
| `Dashboard.tsx:62` `.greeting` | `Bună, {identityGreeting(identity)}` | `identityGreeting` (`domain/profile.ts`) = **last** token, because the dataset stores surname-first: `'Popescu Andrei'` → `'Bună, Andrei'`; renders nothing when the name is empty |

The greeting deliberately does **not** repeat the full name, and the sidebar deliberately renders the
**company** name: `App.test.tsx` renders the whole shell and asserts `getByText('Popescu Andrei')`, so a
greeting or sidebar that duplicated the person's full name would make that query ambiguous and throw.
New coverage asserts the sidebar and the greeting with their own scoped locators instead of loosening the
existing ones.

`seed.ts` now carries `identity.codTvaIntra`, `identity.caen: [{cod: '6201', descriere: …}]` and
`identity.mentiuniFactura`, and no longer seeds the deprecated `profile.caen`.

---

## 6. F-1 vs F-2 — the one real conflict in the brief, and how it was resolved

The brief said both:

- **F-1:** the migration must backfill the new fields into the live profile **and** into the embedded
  profiles of stored snapshots.
- **F-2:** stored `inputsHash` values are never recomputed on load, so widening `identity` does not
  invalidate existing snapshots' hashes.

F-2's conclusion holds only while the stored **bytes** are unchanged; `canonicalize`
(`domain/snapshots/serialize.ts`) serialises every key and `snapshots.test.ts:96-99` pins that adding a
key changes the digest. F-1 mandates changing those bytes. So the two collide unless the migration itself
re-derives the digest.

**Decision D-1g — backfill the embedded profiles (F-1 is explicit; AC3 says "handled, not avoided"),
re-derive `inputsHash` inside the migration step, and preserve the pre-migration digest.**

1. The repo's own provenance invariant is `inputsHash === computeInputsHash(inputSnapshot)`
   (`snapshots.test.ts:152-161`, `:328`). Backfilling without re-deriving would leave **every migrated
   snapshot failing its own invariant** — worse than a re-derived digest, because any future integrity
   check (Phase 9/10 audit work) would flag all historical data as corrupt.
2. F-2's actual prohibitions survive intact: the **load path** still never re-hashes (a payload already
   at the current version loads with `inputsHash` byte-identical — tested), and identity stays out of
   `inputsKey`.
3. Re-derivation happens **once, in a versioned migration step**, not on every load.
4. Nothing is lost: the snapshot gains an optional `preMigrationInputsHash` (`snapshots/types.ts:64`,
   `data/schema.ts:144`) holding the original digest, and the tests assert the **fiscal** inputs inside the
   snapshot (`revenues`, `expenses`, and the 10 `inputsKey` fields of the embedded profile) are
   byte-identical before and after migration — so the recorded `output` still corresponds to the same
   fiscal inputs.
5. No functional side effect today: `addSnapshot` has no dedupe, `getSnapshot` does no hash lookup, and
   nothing re-executes the engine from `inputSnapshot.profile` (the dashboard always recomputes from the
   live profile).

Because the load path is synchronous (`useState(loadInitial)`) and `crypto.subtle` is async-only, the
migration uses a new synchronous SHA-256: `domain/snapshots/hashSync.ts` (`sha256Hex`,
`computeInputsHashSync`). `hashSync.test.ts` proves equivalence with the async `computeInputsHash` over
empty/`abc`/55/56/64/1000-char/UTF-8/JSON inputs — a word-loader bug (`bytes[off+i]` vs `bytes[off+i*4]`)
was caught that way before shipping.

**F-2a is proven, not assumed:** `derived.test.tsx` asserts that editing identity fields leaves `inputsKey`
byte-identical. `inputsKey` (`domain/derived.ts:137-152`) still contains exactly its 10 fiscal fields —
no identity field, no `caen`, no `id`, no `updatedAt`.

---

## 7. Deliberately NOT implemented (recorded, not hidden)

1. **Snapshots are still not persisted by the app.** `addSnapshot` has **no production caller**
   (`store.tsx` exposes it; only tests call it) — the Phase 5 note in `e2e/dashboard.spec.ts:90-91`
   ("persisting it is Phase 7, not Phase 5") is **still true and was not taken up**. The migration and the
   snapshot backfill are built and tested against payloads that *do* contain snapshots, so the moment
   someone wires `addSnapshot` the history is already safe — but wiring it is a product decision about
   when a calculation becomes an audit record, and it is not in the Phase 7 scope list.
2. **No restore flow for quarantined data.** D-3 promised quarantine + telling the user, not a one-click
   rollback. `getQuarantinedPayload()` exists so a restore UI has something to read; choosing what a
   restore means (merge? replace? diff?) is a decision this phase must not invent.
3. **Fiscal-loss persistence (B-16's tail) is still open.** Phase 5 surfaced the rule and the amount;
   `pierderiReportate` is still a named 0 term and no prior-year read exists. This phase built the
   versioning that makes such a change possible, but did not add the field.
4. **The 24 SM CAS tier-floor threshold surface was NOT taken.** It was reassigned to "Phase 7/9" in
   `phases/06_fiscal_profile.md` §7 item 5; it did not fall out of the identity work, so it stays open.
   `thresholds.ts` still has `ThresholdType = 'min-base' | 'max-base' | 'registration' | 'income'`.
5. **CAEN-keyed rules and a richer VAT regime** remain declined as uncitable (Phase 6 §7 items 8-9) — not
   built, and this phase only made CAEN single-sourced.
6. **`settings.company` / `settings.personal` were not deleted** from the schema or the seed. Deleting
   them would change what the schema accepts (see §2.3) and would rewrite history for existing installs.
   They are inert legacy, enforced by test rather than by comment.
7. **`settings.cotaTva` is still seeded and still read by nothing** — not identity, so not mine.
8. **B-19 untouched** (parked research item, per the brief).

---

## 8. Tests and validation

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm run build` | **exit 0** (pre-existing >500 kB chunk warning only) |
| `npm run test` | **41 test files, 578 unit tests, all passing** (baseline at `d786834`: 38 files / 531 tests; +47) |
| `npm run test:e2e` | **32 e2e tests, all passing** (baseline 29: `dashboard.spec.ts` 24 + `settings.spec.ts` 5; +3) |

New test files: `data/store.migration.chain.test.tsx` (18), `data/identity.source.test.ts` (3),
`domain/snapshots/hashSync.test.ts` (15). Also new, not a test: `src/vite-env.d.ts`
(`/// <reference types="vite/client" />`) — this browser-only app has no `@types/node`, so the AC6 source
check uses `import.meta.glob(..., {query: '?raw'})` rather than `fs`.

What the new coverage pins, per acceptance criterion:

- **AC2** — a versionless payload loads with every collection surviving **by id** (revenues, expenses,
  clients, declarations), `dataOrigin === 'persisted'`, `migration.stepsApplied` names both steps,
  `dataVersion === CURRENT_DATA_VERSION`.
- **AC3** — a pre-Phase-7 payload **including its stored snapshots** loads: snapshots survive by
  `calculationId`, `getSnapshot` resolves them, embedded profiles are backfilled from their own history,
  the digest is re-derived and the old one kept, fiscal inputs byte-identical, and a snapshot with nothing
  to add is returned untouched (same digest).
- **AC4** — invalid JSON and a schema-invalid payload are each quarantined with the right `reason`; the
  rejected copy is retrievable under the quarantine key; a **second** corrupt load does not clobber the
  first copy; a subsequent save does not touch the quarantine key; `App.test.tsx` asserts the banner
  (`getByRole('alert')`, contains `unparseable-json`) and that healthy data shows no banner.
- **AC5** — `Settings.test.tsx` round-trips a personal name and mențiuni through `profile.identity` and a
  remount, asserting the frozen legacy block did **not** receive the write; `e2e/settings.spec.ts` does the
  same through a real reload for the topbar, the greeting and the sidebar. The e2e round-trip tests are
  deliberately **unseeded** — `addInitScript` re-runs on reload and would re-apply the seed over what the
  UI just saved (Phase 6 §10 trap 2), which would make the assertion prove nothing.
- **AC6/AC7** — the source-scanning test above.
- **F-2a/F-2b** — `inputsKey` unchanged by an identity edit; a current-version payload loads with
  `inputsHash` byte-identical.

Existing tests updated because reality moved (assertion follows reality, coverage kept or raised):
`store.save.test.tsx` (10 → 11 keys + `version` value + a new "never writes the quarantine key" test),
`store.load.test.tsx` (two corrupt cases now `'quarantined'` **and** assert the preserved copy; imports
`STORAGE_KEY`/`QUARANTINE_STORAGE_KEY` instead of re-declaring them), `store.profileBackfill.test.tsx`
(two invalid-payload cases now `'quarantined'`; the "leaves optional fields absent" case now asserts
`profile.caen === undefined` and `identity.caen` equals the settings entries), `store.migration.test.ts`
(now imports from `./migration`; CAEN asserted on `identity.caen`; `codCAEN` fallback; minimal payload ⇒
`identity.caen` **absent**), `Settings.test.tsx` (company-tab persistence now reads
`profile.identity.denumire`; fiscal CAEN now `profile.identity.caen[0].cod` with `profile.caen ===
undefined`), `e2e/settings.spec.ts` (the Phase 6 CAEN assertion moved to `identity.caen[0].cod`, and
`saved.caen` is now asserted `undefined`).

---

## 9. Provenance, and what this phase contradicts in the frozen archive

No fiscal rule, rate, base, threshold or parameter was touched, so no `sourceUrl` was needed and
`research/06_2026_fiscal_research.md` was never consulted.

`docs/ai/steps/**` is a frozen archive and was not edited. Where it conflicts with this file, this file
supersedes it. The claims Phase 7 makes false:

- `steps/01_real_baseline.md:113` — "**no `version` field in the persisted shape and no versioned
  migration chain anywhere in `src/data/`**", and B-12 (`:176`). Now false: `version` exists and
  `data/migration.ts` holds a two-step chain.
- `steps/01_real_baseline.md:125`, `:172` (B-8) and §5.2 (`:195-199`) — two unreconciled identity stores,
  personal inputs `disabled` at `Settings.tsx:369,373,377`. Now false; the line numbers were already stale
  (`:458,462,466` after Phase 6) and the inputs are writable.
- `steps/01_real_baseline.md:114` — capability 32 "Legacy profile backfill … `store.tsx:68-101`, `:118`".
  `legacyProfileFromSettings` now lives in `data/migration.ts` and runs as the `profile-materialization`
  step, not as an inline `??` in `loadInitial`.
- `steps/12_calculation_snapshots.md:79-82` — "Backfill migration in `loadInitial()` … loads without
  migration code elsewhere". There is now migration code elsewhere, and it also re-derives snapshot digests.
- `steps/01_real_baseline.md:364-368` — Q-IDENTITY-SOURCE and Q-PERSISTENCE-VERSION were open questions;
  they are closed as D-1/D-2/D-3 in `STATE.md`.

---

## 10. Traps for the next reader (Phase 8+)

1. **A required new identity field is a data-loss event.** `pfaIdentitySchema` gates the live profile and
   every stored snapshot's embedded profile. New identity fields must be `.optional()` and the migration
   must backfill both places — see §6.
2. **`inputsKey` ≠ `inputsHash`.** The first is a runtime cache/provenance key over 10 fiscal fields
   (identity must stay out of it); the second is a persisted SHA-256 over the whole `inputSnapshot`, which
   *does* embed identity. Do not "unify" them.
3. **The load path must never re-hash.** Re-derivation belongs to a versioned migration step only. If you
   add a second digest computation, `preMigrationInputsHash` stops meaning anything.
4. **`settings.company` / `settings.personal` are required in the schema and inert in the app.** Do not
   "clean them up" by making them optional — that changes which payloads the schema accepts, and
   `schema.test.ts` encodes the current contract.
5. **`profile.caen` is deprecated but still parseable.** If you add a CAEN-keyed rule, read
   `identity.caen[]`; the scalar exists only so old payloads parse.
6. **The save effect fires on first mount**, so seed/recovered data is persisted immediately. That is why
   the quarantine key must be write-isolated from it.
7. **`dataOrigin` has three values and must not gain a fourth for migration.** Use `migration` /
   `dataVersion`.
8. **e2e round-trip tests must not seed localStorage** if they then reload — `addInitScript` re-runs per
   document and silently defeats the assertion.
9. `playwright.config.ts:9` "No overload matches this call" remains LSP-only (`tsconfig.json`
   `include: ["src"]`); it is not a defect and was not "fixed".
