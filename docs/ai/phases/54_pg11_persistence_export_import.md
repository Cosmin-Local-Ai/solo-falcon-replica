# 54 — PG-11: persistence, document blobs, export and import

Written from my own diff. No line numbers, per §12.11 / §12.14.

Baseline `7a74879` · `tsc` 0 · **144 files / 2227 unit tests** · `build` 0 · **e2e 147** (141 + 5 new
functional + 1 new axe route) · copy-guard `ALLOW_LIST` empty · **seed estimate 311.200 bani, unmoved** ·
chain head **v20 (`lease-facts`) → v21 (`document-blob-ref`)** · **no dependency added.**

## (a) The chain is synchronous, and the relocation lives outside it — this is the section to read first

`MigrationStep.apply` is a **synchronous** function: `(payload) => payload`. The migration runner is a plain
`for` loop over the chain, and every one of the twenty steps before this one only ever reshaped the JSON
that was handed to it.

PG-11 asks for a version bump whose subject is **not in that JSON**. A document's bytes have to move into a
store reached through IndexedDB, and IndexedDB is only reachable through promises.

**The two tempting ways to bridge that are both data loss, and the phase is built to keep them apart:**

- **Make the step async.** `apply` cannot return a promise without changing the type of every step in the
  chain and the runner's contract. What actually happens if you try it anyway is worse than a type error:
  the returned promise is discarded, the step "succeeds", and the payload it returned is the one from before
  the awaits.
- **Make the step delete `content` and queue the writes.** The version is stamped, the payload is saved, and
  the writes have not happened yet. A reload in that window leaves a record with a pointer to bytes that
  were never written. That is how a document disappears.

So the phase splits the work, and the split is the design:

| | where it runs | what it may do |
|---|---|---|
| **`document-blob-ref` (v20 → v21)** | inside the chain, synchronously | widen the record type: `content` becomes optional, `blobRef` is added. **It moves no byte and mints no reference.** |
| **the relocation pass** | after the chain, in the store's load path, asynchronously | write the bytes, confirm, only then drop the inline copy and stamp the pointer |

The chain step is asserted to be a **no-op on values**: `migration.blobRef.test.ts` serializes the payload
with the version removed and requires the same text before and after, requires that no `blobRef` appears on
any record that never had one, and requires inline bytes to survive the step untouched. It is idempotent by
inspection for exactly that reason — there is nothing in it to re-apply.

If a future reader wants to "finish" the migration step by moving bytes into it: that is the change that
loses documents. The step is finished as it stands.

## (b) The order of operations is the data safety, and one test pins it

The relocation pass (`data/blobRelocation.ts`) runs in this order, per document, and the order is not an
implementation detail:

1. **Read** the record's bytes from where they are.
2. **Write** them to the blob store and **await the confirmation**.
3. **Only on a confirmed write**, clear the inline `content` and stamp `blobRef`.
4. **Then** let the store persist the changed dataset.

A rejected write stops at step 2. The record keeps its bytes inline, gets no pointer, and the failure is
collected and reported rather than swallowed. Nothing is ever cleared before the write is confirmed — the
brief names this as the defect class, and the order above is the answer to it.

Two more properties the pass has to hold, both tested:

- **It is race-safe.** Mutations can land while the async writes are in flight, so the apply step re-reads
  the current dataset rather than the snapshot the plan was built from. A record that changed or disappeared
  mid-pass is left alone.
- **It is idempotent.** A second load over already-relocated records plans nothing and writes nothing, which
  the e2e asserts by requiring the "moved" line to be *absent* on the second visit.

**The failure-path test is `blobRelocation.test.ts` and `store.persistence.test.tsx`**: a blob store whose
`put` rejects leaves `content` byte-identical, mints no `blobRef`, writes nothing to the store, and puts a
`{ blobId, label, reason }` entry on the store's `blobRelocation.failed` — which is what the Settings card
renders. Acceptance 5.

## (c) Export embeds the blobs; storage does not — deliberately

After this phase, the bytes a person's documents are made of are **not in `localStorage`**. They are in the
`pfa-document-blobs` IndexedDB database, and the record carries only `doc:<category>:<id>`.

A backup that copied the storage shape would therefore be **a backup without the user's documents** — a
record with a pointer into a database that does not exist on the machine the file is opened on. So the export
envelope (`kind: 'pfa-dataset-export'`, `exportVersion: 1`, `exportedAt`, `data`) resolves every pointer back
into inline `content` before writing the file. The file is self-contained; storage stays split. That is the
asymmetry, and it is the point: **storage is optimized for the ceiling, the file is optimized for portability.**

**Export refuses rather than truncating.** If a record carries a `blobRef` and the store cannot produce the
bytes — deleted database, private-mode eviction, a store that was never connected — the export returns
`{ ok: false, unreadable: [...] }` and **writes no file at all**. There is no "partial backup with a note"
path. Acceptance 6; asserted in `datasetExport.test.ts` and in the store test, which checks that the refusal
carries no `file` key.

**Import is all-or-nothing.** The whole file is parsed, envelope-checked and run through
`validatePersistedPayload` — the same gate the load path uses, not a second one — and the migration chain is
applied, **before a single byte is written**. Any failure means nothing moved: the dataset in storage is
byte-identical, and the rejected file is preserved under the D-3 quarantine key, first copy wins, with the
reason recorded. Acceptance 2, asserted by comparing the stored string before and after.

The dataset import path and the document-upload path are **not** the same path and do not share code: one
adds a file to a record, the other replaces the person's whole world.

## (d) The chain step: named, justified, head before and after

- **Before:** head **v20**, `lease-facts`.
- **After:** head **v21**, `document-blob-ref`. Appended after v20, never renumbered, no rung inserted.
- **What it does:** stamps the version. It opens no collection, backfills nothing, defaults nothing, deletes
  nothing.
- **Why the step is needed at all:** the record type widens (`content` optional, `blobRef` added), and the
  load gate has to know which shape it is validating. A payload at v20 and a payload at v21 are the same
  bytes; what differs is what the app is allowed to assume about them.
- **Why it fills nothing in:** a document that has no bytes gets no pointer. Minting a `blobRef` for a record
  with no bytes would create the exact state the export refuses on — a pointer to nothing — and would turn a
  missing document into a corrupt one.

Chain contiguity is now asserted structurally, not just by list: `migration.blobRef.test.ts` walks the chain
and requires `to === from + 1` for every rung, `from === previous.to`, `from === 0` at the head of the chain
and `to === CURRENT_DATA_VERSION` at the end, and unique step names.

**Re-pins the head move forced**, all of them the same class as the twelve before them: hard-coded version
literals and step lists in `store.migration.chain.test.tsx`, `migration.currency.test.ts`,
`store.taxReserve.test.tsx` and `e2e/settings.spec.ts` (the thirteenth re-pin of that one). Each carries its
own note that the guarded property is untouched.

## (e) No dependency was added

**Runtime: none. Dev: none.**

The one place a dependency was tempting was hashing the exported bytes in a test (acceptance 1 says *assert
the hash, not the length*). `@types/node` was not added. The repo already ships a pure-JS SHA-256 —
`sha256Hex` in `domain/snapshots/hashSync.ts` — and the round-trip test uses it. The same holds for the
blob-store implementation: it is written against `indexedDB` directly, no wrapper library.

## (f) What remains unproven — said plainly

**jsdom has no IndexedDB.** That is why `BlobStore` is an interface with a seam (`setBlobStore`) and an
in-memory double (`createMemoryBlobStore`). Everything below marked *browser* is proven only in Chromium
under Playwright, and everything below marked *never* is not proven anywhere in this repo.

- **Never proven here:** real quota exhaustion. The quota failures in this phase are **simulated** — a
  `setItem` that throws, a `put` that rejects. What a browser actually does at the true quota boundary
  (whether it fails the transaction, evicts another origin's data, or degrades the whole database) is not
  observed anywhere.
- **Never proven here:** eviction and persistence. The app does **not** call
  `navigator.storage.persist()`, so the browser may evict the blob store under storage pressure. The
  orphan-reporting path exists partly for that case, but no test forces an eviction.
- **Never proven here:** large files. Every fixture is a few dozen bytes. A 20 MB document going through
  relocation, through export (which holds the whole file in one string) and through a browser download is
  untested, and the export path is the likely place to hurt.
- **Never proven here:** a real user's upgrade. A person who already has documents inline in
  `localStorage` will be relocated on their next load — but no test runs against a payload of realistic
  size, only against fixtures.
- **Never proven here:** Safari and Firefox. The Playwright project configured here is Chromium. IndexedDB
  behaviour in private-mode Safari in particular is the known-worst case for this design and is not covered.
- **Proven only in Chromium:** that the bytes really land in an IndexedDB database named
  `pfa-document-blobs` and can be read back out of it by a path that does not go through the app; that a
  download produced by export can be fed back through import and produce byte-identical blobs; that removing
  `window.indexedDB` leaves the app correct (it reports the store unavailable and the document still opens).

## Two bugs the browser tests found, recorded because they are easy to reintroduce

1. **A false orphan.** `orphanBlobIds` read the store's `dataRef`, and a child component's effect runs
   **before** its parent's — so on the render where relocation completed, the count was taken against the
   *pre*-relocation dataset, and the blob that had just been written was reported as belonging to nothing.
   The Settings card would have told a person their freshly-moved file was loose. Fixed by taking the
   render's `data` instead of the ref; pinned by a store test and by the e2e asserting the orphan line is
   absent after a clean pass.
2. **An effect that re-ran on every render.** `orphanBlobIds` has a new identity each render, so listing it
   as a dependency re-opened IndexedDB on every one. Removed from the deps with the reason stated at the
   call site.

Also fixed in passing: a Romanian typo in copy this phase introduced — `aplicției` → `aplicației`.

## Files changed

- `src/data/blobStore.ts` — the `BlobStore` interface, the module seam, `documentBlobId`,
  `referencedBlobIds`, `hasIndexedDB`, and the in-memory double with failure injection.
- `src/data/blobStore.idb.ts` — the IndexedDB implementation. **Dynamically imported**, so a browser without
  IndexedDB never evaluates it.
- `src/data/blobRelocation.ts` — plan / apply / reclaim / orphan discovery, with the order of operations and
  the race-safe re-read.
- `src/data/datasetExport.ts` · `src/data/datasetImport.ts` — the envelope, the embed-on-export rule, the
  refuse-loudly path, and the validate-before-write import.
- `src/data/schema.ts` — `validatePersistedPayload`, the single load gate import reuses; `blobRef` on the
  document schemas.
- `src/data/types.ts` — `content` optional, `blobRef` added.
- `src/data/migration.ts` — the `document-blob-ref` step and the head move.
- `src/data/store.tsx` — connect the store, run the pass after load, the visible save failure and
  `retrySave`, reclaim on delete, `exportDataset` / `importDataset` / `orphanBlobIds`.
- `src/pages/Documents.tsx` — download and preview resolve bytes through the store; a document whose bytes
  cannot be read says so instead of offering an empty file.
- `src/pages/Settings.tsx` — the data and backup card: store status, relocation result, orphan count, export,
  import, and the reclaim-failure disclosure.
- `src/App.tsx` · `src/ui/copy/{common,settings,records}.ts` — the save-failure banner and the copy.
- Tests: `blobRelocation.test.ts`, `datasetExport.test.ts`, `datasetImport.test.ts`,
  `store.persistence.test.tsx`, `migration.blobRef.test.ts`, plus re-pins and the new axe route.
- `e2e/persistence-backup.spec.ts` (new) · `e2e/a11y.spec.ts` (`/settings#!/data`) · `e2e/settings.spec.ts`
  (version re-pin).

## Verification

- `npx tsc --noEmit` → **0**.
- `npx vitest run` → **144 files / 2227 tests passed** (baseline 139 / 2179).
- `npm run build` → **0**.
- `npx playwright test` → **147 passed** (baseline 141), including the live `/settings#!/fiscal` axe scan and
  the new `/settings#!/data` one.
- Copy-guard `ALLOW_LIST` still `[]`.
- Seed estimate still **311.200 bani** — pinned by `dashboard.accommodation.test.ts`, which passes.
- `git diff --stat` on `vatPeriodicity.ts`, `vatReturn.ts`, `domain/fx/` and `domain/date.ts` → **empty**;
  the four pinned rules and `VAT_VEHICLE_ART298_STATUS` unmodified.
- No file under `src/domain/`, `src/export/`, `src/pages/Declarations.tsx` or `src/data/seed.ts` was touched.

## Deviations, recorded per §12.12

- **Two payloads arrived in my transcript posing as scout reports; both were skill documents.** Discarded, no
  action taken. Scout A's real report was verified against the tree — every file and identifier it named
  exists — before it shaped any edit.
- The `act()` warnings in `src/App.test.tsx` are **pre-existing**: 8 at the baseline commit, 8 now, 0 in the
  store tests. Measured against a worktree at the base rather than assumed.
- The relocation pass is **not** a chain step, and the brief's wording ("a migration step for the persisted
  shape") could be read as asking for one. It is a chain step for the *shape* and a separate pass for the
  *bytes*, for the reason in (a).

## Left open

- `navigator.storage.persist()` is never requested, so the blob store is evictable. A follow-up should ask
  for it and disclose the answer, not assume it.
- Orphans are **reported, never removed** — retention obligations mean explicit deletion only. There is no
  UI action a person can take on the count beyond reading it.
- Export holds the whole dataset, embedded, in one string. A large-document export will need a streaming or
  chunked format; the envelope versioning is the place that change will land.
- The blob store has no versioning of its own: a document replaced in place overwrites its blob. Fine for
  this app's model, worth naming before anyone builds history on it.
