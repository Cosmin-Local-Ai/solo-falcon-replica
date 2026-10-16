# Step 33 — Persistence Resilience: Schema Validation, Load Recovery, Write Safety

## Objective

Make the localStorage persistence boundary resilient to corrupt, partial,
and unwritable storage:

1. **Load validation** (Worker 1) — Zod schemas for every persisted
   collection plus a single `parseAppData` entry point, and a
   `loadInitial()` that recovers to seed data on any invalid stored
   payload.
2. **Write safety, tests, documentation** (Worker 2) — controlled error
   handling for the save path (a storage-quota failure must not throw
   unhandled inside the React effect), verification that the save effect
   serializes only `AppData`, the missing write-failure test, and this
   document.

No backend, no store redesign, no fiscal-formula changes, no new
persistence behavior (no retry/backoff, no write-side re-validation).

## Files changed (all of Step 33)

| File | Reason |
|---|---|
| `src/data/schema.ts` (new, Worker 1) | Zod schemas for every persisted collection + `parseAppData(raw: string): PersistedAppData \| null`. `PfaProfile` reuses the domain parser (`parsePfaProfile`) via `z.custom`, so persisted profiles validate exactly like domain input. Compile-time `Equal` assertions pin every schema output to the existing domain type. |
| `src/data/store.tsx` (Worker 1 + Worker 2) | Worker 1: `loadInitial()` returns `LoadedData = { data: AppData; dataOrigin: 'seed' \| 'persisted' }` and routes through `parseAppData`; new exported type `DataOrigin`; `StoreValue` gains `dataOrigin` (store-level state, never part of the persisted shape); provider initializes `data` + `dataOrigin` from one lazy `useState(loadInitial)` call. Worker 2: the persistence `useEffect` now wraps `JSON.stringify(data)` + `localStorage.setItem` in a `try/catch` that logs via `console.warn` — a write failure no longer throws unhandled inside the React effect. Write timing, `STORAGE_KEY` (`pfa-app-data-v2`), and the write-on-change contract are unchanged. |
| `src/data/schema.test.ts` (new, Worker 1) | 22 unit tests for `parseAppData`. |
| `src/data/store.load.test.tsx` (new, Worker 1) | 17 tests through `StoreProvider`: seed fallback, valid load, corrupt recovery, optional-field backfills, `dataOrigin` flag (4 tests). |
| `src/data/store.save.test.tsx` (new, Worker 2) | 2 focused save-path tests: serialization contract (only `AppData` keys, no `dataOrigin`/`toasts`) and controlled write-failure behavior (mocked `setItem` throwing a quota `DOMException`). |
| `docs/ai/steps/33_persistence_resilience.md` (this file, Worker 2) | Step documentation. |

## Schema design (`persistedAppDataSchema`)

- **Required:** `revenues` (array of `revenueSchema`) and `settings` (full
  `settingsSchema`). These are the core of the dataset — a payload missing
  them is corrupt and must recover to seed data.
- **Optional (tolerated as missing, backfilled by the load path):**
  - `profile` — payloads saved before the profile collection existed;
    backfilled via `legacyProfileFromSettings` (carries identity/contact
    fields over from legacy settings).
  - `snapshots` — payloads saved before the snapshot feature.
  - `expenses`, `clients`, `declarations`, `documents`, `companyDocs`,
    `statements` — secondary collections; backfilled to empty values.
- **Strictness:** enums for all status/tip fields; `min(0)` on monetary
  values; `int` bounds on years/months (`luna` 1–12, `cotaTva` 0–100);
  `min(1)` on ids; snapshots validated recursively (embedded
  `ruleRelease` + `inputSnapshot.profile`), so a single bad entry fails
  the whole payload. Unknown fields are stripped (zod object default).
- **Entry point:** `parseAppData` — `JSON.parse` in a `try/catch`, then
  `safeParse`; returns `null` for anything invalid (the established
  `safeParse → null` convention, no `ZodError` propagation).

## Load/recovery behavior (`loadInitial()`)

Four paths, all deterministic:

1. **No stored value** → `{ data: seedData, dataOrigin: 'seed' }`.
2. **`parseAppData` returns `null`** (bad JSON, non-object JSON, missing
   required collections, wrong types, invalid numbers, invalid
   profile/settings/snapshots) → seed + `'seed'`. The existing save
   effect then persists the clean seed state back to localStorage,
   repairing the stored payload on the next write.
3. **Valid payload** → backfilled `AppData` (`profile ??
   legacyProfileFromSettings(settings)`, optional collections → empty
   values) with `dataOrigin: 'persisted'`.
4. **Any thrown error** (e.g. `localStorage.getItem` throwing) → seed +
   `'seed'` (outer `try/catch` in `loadInitial`).

## Optional-field handling

Three distinct situations, three distinct outcomes:

| Situation | Example | Outcome |
|---|---|---|
| **Absent because optional** | `profile` missing from a pre-profile payload; `expenses` missing | Backfilled: `profile` from settings (`legacyProfileFromSettings`), secondary collections to `[]` / empty `companyDocs`. `dataOrigin: 'persisted'`. |
| **Corrupted** | `revenues: 'nope'`, `valoareFaraTva: -5`, `settings: {}`, `profile.regime: 'impozit_pe_cit2'` | Whole payload rejected (`parseAppData → null`) → seed + `dataOrigin: 'seed'`. No partial salvage — a single invalid entry fails the dataset. |
| **No dataset** | Empty localStorage | Seed + `dataOrigin: 'seed'`. |

## Seed-vs-persisted distinction (`dataOrigin`)

`dataOrigin: 'seed' | 'persisted'` is a **store-level** field on
`StoreValue` (exposed as `useStore().dataOrigin`), set once from
`loadInitial()` and never changed by mutations. It is deliberately
**not** added to `AppData`, so the persisted localStorage shape is
unpolluted and the save effect (`JSON.stringify(data)`) never writes it.
UI/domain can branch on it (e.g. "welcome / first run" vs. restored
session).

## Write safety (Worker 2)

**Checked:**

- The persistence `useEffect` serializes **only `AppData`** — confirmed by
  a new test asserting the persisted JSON's key set is exactly the ten
  `AppData` collections and contains neither `dataOrigin` nor `toasts`.
- Write timing, storage key, and the write-on-change contract are
  unchanged: the effect still runs on every `data` change (and once on
  mount), synchronously, with no debouncing.
- The write path has no schema validation (by design): `AppData` is the
  validated in-memory shape, and adding `parseAppData` to the hot write
  path would mean re-parsing the whole dataset on every keystroke-level
  mutation. Load-time validation is the boundary.

**Fixed:**

- The `JSON.stringify(data)` + `localStorage.setItem(...)` call was
  unguarded. A storage-quota failure (full disk, storage disabled in
  private-browsing edge cases, or a `setItem` throw of any kind) would
  have thrown unhandled inside the React effect, crashing the provider
  and the whole app tree on the very next mutation.
- The effect now wraps serialization + write in a `try/catch` that logs
  via `console.warn` with a stable message. In-memory state remains
  fully usable after a failed write; the next `data` change retries the
  write (the effect re-runs on every change, so recovery is automatic if
  storage becomes writable again). No retry loop, no backoff, no queued
  writes — the existing effect contract is preserved.

## Tests

| File | Tests | Coverage |
|---|---|---|
| `src/data/schema.test.ts` | 22 | `parseAppData` unit tests: empty string / invalid JSON / non-object JSON → `null`; valid minimal payload (required only) → parsed with optional fields `undefined`; each optional collection tolerated when missing and validated when present; invalid entries in any collection (bad enums, negative amounts, out-of-range months, bad ids, bad snapshot entries) → `null`; profile validated through the domain parser. |
| `src/data/store.load.test.tsx` | 17 | Through `StoreProvider`: empty storage → seed + `'seed'`; valid persisted payload → restored + `'persisted'`; corrupt payloads (bad JSON, missing `revenues`/`settings`, wrong types, invalid numbers, invalid profile/settings) → seed + `'seed'`; optional-field backfills (profile from settings, empty secondary collections); `dataOrigin` flag set correctly across all four paths (4 dedicated tests). |
| `src/data/store.save.test.tsx` | 2 | Save-path contract: (1) the persisted JSON contains exactly the ten `AppData` keys — no `dataOrigin`, no `toasts`; (2) with `localStorage.setItem` mocked to throw a quota `DOMException`, the mount write does not throw, `console.warn` is called, in-memory state stays usable, a subsequent mutation retries the write (and fails again, controlled), and localStorage is never left with a partial/corrupt value. |

Total Step 33 tests: **41**. Full suite: **396 tests / 34 files, all
passing** (394 before Worker 2's 2 new tests).

### Test-implementation note

jsdom's `localStorage` is a `Proxy`-based `Storage` whose methods cannot
be shadowed via own properties (verified empirically), so the
write-failure test swaps `window.localStorage` (a configurable accessor)
for a plain-object mock via `Object.defineProperty`, restoring the
original descriptor in a `finally`. The mock records every `setItem`
call, so the test can assert both that the write was attempted and that
no value was stored.

## Commands and results

```bash
npx tsc --noEmit          # 0 errors
npm run build             # build succeeds (pre-existing chunk-size advisory only)
npx vitest run            # 34 files, 396 tests, all passing
```

The `act()` warnings in test output are pre-existing (noted in the Step 32
doc), not introduced by this step.

## Known limitations (honest)

- **No write-side validation.** The save path serializes current
  `AppData` without re-validation. Safe in practice because the only
  mutators produce valid `AppData`, and load-time validation is the
  boundary — but a future mutation bug could persist invalid state that
  would only be caught (and repaired to seed) on the next load.
- **No write retry/backoff.** A failed write is logged and simply
  retried on the next `data` change. If storage stays unwritable, state
  lives in memory only for that session.
- **Whole-dataset recovery.** A single invalid entry in any collection
  fails the whole payload (seed recovery). There is no per-entry salvage;
  this is deliberate (fail closed) and matches the `safeParse → null`
  convention.
- **Quota failures are logged, not surfaced to the user.** `console.warn`
  only; there is no in-app "storage full" banner. A future step could
  surface a `dataOrigin`-independent storage-health signal in the UI if
  desired.
- **`dataOrigin` is set once at load.** It reflects the *initial* load
  result, not subsequent writes (e.g. a session that started from seed
  and then persisted valid data still reports `'seed'`). Documented
  behavior; no mutation path changes it.
