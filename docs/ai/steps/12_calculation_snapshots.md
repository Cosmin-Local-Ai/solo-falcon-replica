# Step 12 — Calculation Snapshots

## Purpose

A calculation snapshot is an **immutable audit record** of one tax calculation:
the exact inputs, the exact rule release used, the deterministic execution
result, and provenance metadata. Snapshots make the app's outputs
reproducible and auditable: anyone can re-derive the hash of the stored
inputs and confirm the stored result was computed from exactly those
inputs under exactly that rule release.

Snapshots are **append-only**. When a new `RuleRelease` becomes active, old
snapshots are never rewritten — they keep pointing at the release they were
computed with.

The snapshot **embeds** (does not reference) both the rule release and the
input data, so later changes to the current profile, stored data, or rule
set can never retroactively change what a stored snapshot means.

## The 5-layer audit boundary

Each snapshot fixes five independent layers:

| Layer | What it fixes | Where in the snapshot |
|---|---|---|
| 1. Inputs | Profile + revenues + expenses, frozen at calculation time | `inputSnapshot` |
| 2. Rule release | The exact validated ruleset (parameters, sources, version) used | `ruleRelease` (embedded) |
| 3. Deterministic execution | The per-line breakdown produced by running the rules on the inputs | `calculationLines` |
| 4. Stored output | The final result | `output` |
| 5. Provenance | Who/when/what: id, timestamp, hash of inputs, lifecycle status | `calculationId`, `calculatedAt`, `inputsHash`, `status` |

A snapshot is only as trustworthy as its weakest layer; embedding layers 1
and 2 in the record itself is what makes the boundary airtight.

## Snapshot model

`TaxCalculationSnapshot` (`src/domain/snapshots/types.ts`):

| Field | Type | Meaning |
|---|---|---|
| `calculationId` | `string` | Unique, stable ID — `calc-<taxYear>-<uuid>` |
| `taxYear` | `number` | Tax year, taken from the rule release |
| `calculatedAt` | `string` | Execution time (ISO 8601) |
| `ruleRelease` | `RuleRelease` | The exact release used — embedded, not referenced |
| `inputSnapshot` | `CalculationInput` | Frozen `{ profile, revenues, expenses }` — embedded |
| `inputsHash` | `string` | SHA-256 hex digest of the canonical serialization of `inputSnapshot` |
| `calculationLines` | `CalculationLine[]` | Per-line breakdown (`{ label, value }`) |
| `output` | `CalculationOutput` | Final result (`{ total }`) |
| `status` | `SnapshotStatus` | Explicit lifecycle status |

Supporting types: `CalculationInput`, `CalculationLine`, `CalculationOutput`,
`SnapshotStatus` (same file).

## Canonical serialization + SHA-256 hashing

- `canonicalize(value)` (`src/domain/snapshots/serialize.ts`) — deterministic
  serialization: object keys are sorted lexicographically, arrays keep
  order, strings are JSON-quoted, non-finite numbers become `null`. Two
  structurally equal values always serialize to the same string,
  independent of object key order.
- `computeInputsHash(input)` (`src/domain/snapshots/hash.ts`) — browser-safe
  SHA-256 (Web Crypto `crypto.subtle.digest`) over the canonical
  serialization, returned as a 64-char lowercase hex string.

Properties (covered by tests):
- **Deterministic** — same input ⇒ same hash.
- **Key-order independent** — structurally equal inputs with different key
  declaration order ⇒ same hash.
- **Sensitive** — any change to the inputs (e.g. `revenues`) ⇒ different hash.

## Storage

- `AppData.snapshots: TaxCalculationSnapshot[]` (`src/data/types.ts`).
- Seed data initializes `snapshots: []` (`src/data/seed.ts`).
- Store API (`src/data/store.tsx`):
  - `addSnapshot(s)` — appends to the array.
  - `getSnapshot(id)` — lookup by `calculationId`.
  - **No update/delete API by design** — snapshots are append-only.
- **Backfill migration** in `loadInitial()`: persisted data predating this
  step lacks the `snapshots` field; `loadInitial` backfills
  `parsed.snapshots = []` when it is not an array, so old localStorage data
  loads without migration code elsewhere.

## Status values

`SnapshotStatus = 'computed' | 'superseded' | 'void'`

- `computed` — default; the calculation ran and the record is valid.
- `superseded` — a newer release/superseding calculation replaces it
  (set explicitly; the record itself is never rewritten).
- `void` — the record is invalidated (e.g. bad inputs).

## Reproducibility guarantee

For any stored snapshot:

```
await computeInputsHash(snap.inputSnapshot) === snap.inputsHash
```

Because the inputs and the rule release are embedded in the snapshot,
re-running the deterministic execution with the embedded release over the
embedded inputs must reproduce `calculationLines` and `output`. The hash
lets an auditor verify input integrity without trusting the rest of the
record.

## Out of scope (later stages)

- **Tax formulas** — `createCalculationSnapshot` does not compute any tax;
  `calculationLines`/`output` are supplied by the caller. The fiscal
  engine arrives in later stages.
- **Dashboard UI** — no snapshot browsing/audit UI in this step.
- **Backend** — storage stays client-side (`AppData`/localStorage).
- **Legislation ingestion** — rule releases are assumed to already exist
  (Steps 11 and earlier).

## Verification results

Run in `/c/AI/projects/pi-test`:

### `npx tsc --noEmit`

```
$ npx tsc --noEmit
(exit 0, no errors)
```

### `npm test`

```
$ npm test
 RUN  v3.2.7 /c/AI/projects/pi-test

 ✓ src/domain/snapshots/snapshots.test.ts (11 tests) 8ms
 ✓ src/domain/fiscal/fiscal.test.ts (13 tests) 10ms
 ✓ src/data/store.migration.test.ts (5 tests) 2ms
 ✓ src/domain/profile.test.ts (15 tests) 5ms

 Test Files  4 passed (4)
      Tests  44 passed (44)
```

### `npm run build`

```
$ npm run build
> solo-falcon-replica@0.1.0 build
> tsc && vite build

vite v5.4.21 building for production...
✓ 44 modules transformed.
dist/index.html                   0.42 kB │ gzip:  0.29 kB
dist/assets/index-EHjOQuDc.css   11.46 kB │ gzip:  2.98 kB
dist/assets/index-BHwvppbx.js   213.63 kB │ gzip: 62.10 kB
✓ built in 403ms
```
