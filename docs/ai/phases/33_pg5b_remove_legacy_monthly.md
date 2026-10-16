# PG-5b — remove the legacy monthly declaration rows PG-5 preserved (brief 36)

A cleanup task, not a phase. It closes **B-77** and moots **B-75**. The authority for it is
**D-USER-1** in `docs/ai/USER_DECISIONS.md`: there are no active users, so the byte-for-byte preservation
of a shape the product no longer supports was protecting nothing, and it was still costing a second
vocabulary, a legacy bucket in the schema, the store and the types, and B-75.

## 0. What was deliberately not done

- **No chain step was renumbered, reordered or deleted.** The step PG-5 added keeps its number
  (`DATA_VERSION_ANNUAL_FILING = 11`), its name (`annual-filing`), its position as the last entry of
  `MIGRATION_CHAIN`, and its idempotency. Only its behaviour changed. `CURRENT_DATA_VERSION` is still
  `DATA_VERSION_ANNUAL_FILING`; the head did not move.
- **`isFiledFiling`, the filing vocabulary and the deadline done-state are untouched.** `AnnualFiling`,
  `FilingStatus`, `FilingForm`, `isFiledFiling` in `src/data/types.ts` and `filingForDeadline` in
  `src/domain/deadlines.ts` are byte-identical apart from one comment in `deadlines.ts` that named a type
  this task deleted. The principle that stopped a monthly `'inregistrata'` reading as a submission
  survives; what is gone is the monthly record type that made the warning necessary.
- No rule value, threshold, statutory citation, registry entry, calculator, FX module, `domain/date.ts`
  or clock helper was touched. `docs/ai/steps/` was not opened.

## 1. The vocabulary that went away

**`src/data/types.ts`** — `Declaration`, `DeclStatus` and `declarationNet` are deleted, and
`AppData.legacyDeclarations` is gone with them. `LegacyAppData` no longer omits that key. The only new
export is `StoredStatusCode` (see §4).

**`src/data/schema.ts`** — `PersistedAppData.legacyDeclarations` and the `legacyDeclarations` key on
`persistedAppDataSchema` are removed. **`declarationSchema` and the `declarations` key stay**, and the
reason is stated in the file: zod strips undeclared keys, so a payload whose `declarations` were stripped
at the load gate would lose its monthly rows *before the chain ran*, and then the gate — not the step
with the documented decision — would be what deleted them. The row type is now derived from the schema
(`LegacyMonthlyDeclaration`) instead of being a hand-written application interface, so there is exactly one
definition of a shape nothing in the app reads. The `_checks` tuple asserts the schema output equals that
derived type, as it does for every other collection.

**`src/data/schema.ts`, date gate** — `RecordKind` lost `'declaration'`, `RECORD_DATE_FIELDS` lost its
entry, and `DateBearingRecord` lost the `Declaration` and `Omit<Declaration, 'id'>` members. No store
write path ever passed `'declaration'` after PG-5 removed the monthly write methods, so nothing had to be
re-plumbed.

**`src/data/store.tsx`** — `toAppData` no longer normalises a monthly collection, and the note on
`addFiling` / `updateFiling` says the store has no monthly collection to read rather than that it keeps one
read-only.

**`src/data/seed.ts`** — `emptyData()` and `seedData` no longer carry the key. The TASK 9 note in the
fixture now ends at PG-5b rather than at PG-5's preservation.

**`src/domain/attention.ts`** — `RecordSource` lost its optional `legacyDeclarations` field. PG-5 had kept
it on the input type, optional and unread, so the inertness was stated where the rows arrived; with the
record type deleted there is nothing left to be inert about, and a field no producer can fill is the thing
a later edit fills in by accident.

**`src/pages/Declarations.tsx`** — the `LegacyMonthly` component, the `legacyRows` memo and the second
table are gone, and with them the `Declaration`, `statusBadge` and `formatBaniRON` imports. The page has
one register and one vocabulary.

**`src/ui/copy/records.ts`** — `legacyTitle`, `legacyNote`, `legacyEmpty` and `legacyColumns` are deleted
with the table they labelled, along with the `months` list that no component read any more.

## 2. The migration: same step, different behaviour

`migrateAnnualFilingV11` before: destructure `version` and `declarations` out, open `filings` as `[]`, and
if the payload had no `legacyDeclarations` yet, write the monthly rows there byte for byte.

After: destructure `version`, `declarations` **and `legacyDeclarations`** out, open `filings` as `[]`, and
write nothing back. The monthly rows are read and discarded.

Three things about that shape are load-bearing and are commented in the file:

- The destructuring is the same mechanism that PG-5's first attempt caught a bug with. Spreading the
  stamped payload after the old one put `version: 10` back on the result and the chain aborted with
  "did not set version 11" — **loudly, which is the mechanism working.** The step still stamps the version
  whether or not there was anything to drop.
- `filings` is still opened as `[]` and an existing array is still never replaced. Absence of a filing
  stays representable; nothing is derived on the way out. **Deleting a record is not a licence to invent
  one** — the step still may not turn a monthly row into an annual return, and the test that pins that
  survived the rewrite.
- `legacyDeclarations` is destructured out even though it is no longer declared on `PersistedAppData`.
  The load gate strips it as an undeclared key, so a PG-5-era install loses it there; the step also drops
  it so that a payload handed to the chain directly cannot carry it through, and the store's next write
  persists an `AppData` that has no such key. The bucket dies rather than lingers unread.

The chain entry's `summary` sentence was rewritten to say the rows were **eliminated**, with the art. 122
alin. (3) reason and the unchanged refusal to mint a filing. It is not rendered anywhere: the migration
toast in `src/App.tsx` joins `migration.stepsApplied`, which is the step *names*, so no test pinned the
sentence and none had to move.

## 3. The three fixtures PG-5 rewrote, before → after

PG-5's handoff records that the three TASK 9 monthly rows (2026-03 `transmisa`, 2026-06 `in-asteptare`,
2026-09 `inregistrata`) were re-used as test fixtures in `src/data/store.edit.test.tsx`,
`src/domain/attention.test.ts` and `src/data/migration.annual.test.ts`. Each is re-premised; none lost the
assertion it carried.

**1. `src/data/migration.annual.test.ts`** — the step's own file.

| before | after |
|---|---|
| "moves every monthly row byte for byte, in order, under the new key" — `after.legacyDeclarations` equals the three rows, ids in order, `dataTrimitere` intact, `d-3` still `inregistrata` | "drops every monthly row the payload carried, under either key" — neither `declarations` nor `legacyDeclarations` is in the result, and no id or date from any row appears anywhere in the written payload |
| "drops the old key from the written shape" and "stamps the version even when there is nothing to move" and "gives a payload that never carried monthly rows no `legacyDeclarations` key at all" | merged into "stamps the version whether or not the payload carried monthly rows" plus the drop test above — the assertions are all still made, in fewer cases (11 tests → 9) |
| "leaves an already-renamed collection alone when a stray `declarations` key sits beside it" | "drops a `legacyDeclarations` bucket a PG-5-era payload still carries" — same fixture, opposite expectation |
| "mints no annual filing from the rows it moved", "does not turn a registered monthly row into a filed annual return", "changes nothing else about the payload", "touches no amount and no currency stamp", "never replaces a `filings` array that is already there", "is idempotent: a second run changes nothing" | unchanged in name and in substance |

**2. `src/data/store.edit.test.tsx`**

| before | after |
|---|---|
| "leaves the legacy monthly rows exactly where they were": the store is loaded at the current version with `legacyDeclarations: LEGACY_DECLARATION_FIXTURES`; after `updateFiling`, both `storeRef.legacyDeclarations` and the persisted bytes still equal the three rows | "leaves every other collection exactly where it was, and writes no monthly rows back": the store is loaded from a **`DATA_VERSION_RECORD_CURRENCY` payload carrying the same three rows under `declarations`**; after `updateFiling`, revenues, expenses and clients are equal in state and in the persisted bytes, neither monthly key appears in those bytes, and no row id survives anywhere in them |

The fixture itself survives as `LEGACY_MONTHLY_ROWS`, typed with `LegacyMonthlyDeclaration` — storage, not
a record — and `renderStoreFromPreV11Payload()` is what feeds it to the chain.

**3. `src/domain/attention.test.ts`**

| before | after |
|---|---|
| "a legacy monthly row produces no action item, whatever its status": `unresolvedRecords({...seedData, legacyDeclarations: declarationFixture})` yields nothing for `d1`/`d2`/`d3`, and the unresolved set stays `['e3','r2','r3']` | "a monthly row produces no action item, whatever its status": the same three rows handed over as `{...seedData, declarations: declarationFixture}` cast through `unknown` — the way an un-migrated payload would arrive, since `RecordSource` no longer has a monthly field — with the same two assertions |

The cast is the point: the test is about what the pipeline **does** with monthly rows, not about what the
type happens to allow, so it still fails the moment a later edit re-connects the family and starts
producing items.

## 4. Every other test that moved

**Mechanical.** The `filings: [], legacyDeclarations: []` pair in an `AppData` fixture became `filings: []`
in `src/pages/Dashboard.test.tsx`, `src/pages/Dashboard.empty.test.tsx`, `src/data/schema.test.ts`,
`src/data/store.taxReserve.test.tsx`, `src/data/store.fxRates.test.tsx`, `src/data/dashboard.test.ts`,
`src/domain/aggregation.test.ts`, `src/domain/derived.test.ts`, `src/domain/estimateBasis.test.ts`,
`src/domain/insights.test.ts`, `src/domain/projection.test.ts` and `src/domain/completeness.test.ts`. No
assertion in any of those files changed.

**Presence-of-an-empty-array became absence.** `src/data/seed.test.ts`, `src/data/store.load.test.tsx` and
`src/data/store.migration.chain.test.tsx` asserted `legacyDeclarations` was `[]`; they now assert the key
is not in the object at all. `src/data/store.save.test.tsx` lost `legacyDeclarations` from the
serialised-key list — that list is the migration's evidence written as a test — and the save-cycle
equality on it became an absence assertion.

**Preservation → drop.** `src/data/store.profileBackfill.test.tsx` and `src/data/store.migration.chain.test.tsx`
carried the Phase 6 data-loss assertion "the monthly row survives the chain under its new key, id
`d-legacy-1`". Both now assert it does not survive, and both keep the half that was ever about
correctness: no annual filing is minted from it, and every collection the app *can* read is the one that
was stored, not the seed's. Their `declarations` fixtures are typed with `LegacyMonthlyDeclaration`.

**Re-premised with the same assertion.** `src/data/dashboard.test.ts` — "monthly rows are never counted as
pending filings" and the action-list case that adds monthly rows to the seed and expects the list to be
identical — both now pass the rows under `declarations` through a cast. `src/domain/completeness.test.ts`
— "is not satisfied by a full register of monthly rows" — same treatment. `src/pages/Declarations.test.tsx`
— "shows the legacy monthly rows read-only, with no write control" became "shows no monthly register at
all, even when the stored payload carries one": one table, the annual row present, and no `2026-09`, no
`9.680,00 RON`, no `data-record-id="d3"`.

**Copy typing.** `recordStatus.labels` and `recordStatus.tabs` in `src/ui/copy/records.ts` were
`satisfies Record<DeclStatus, string>`. They are now `satisfies Record<StoredStatusCode, string>`, where
`StoredStatusCode` is declared in `src/data/types.ts` as the union the two registers actually share. The
union is stated directly instead of borrowed from a record type that no longer exists; the words themselves
did not change.

**e2e.**

- `e2e/annual-filing.spec.ts` — acceptance 2's case ("a monthly record with status „inregistrata" does not
  mark the term done") now seeds `preV11Payload()`: the same three rows, at
  `DATA_VERSION_RECORD_CURRENCY`, under `declarations`. The overdue item is still exactly one and still
  labelled „Declarația unică (D212) pentru 2026"; `/declarations` then shows the empty register and no
  table at all, and none of `2026-03`, `2026-06`, `2026-12` appears. The case is stronger than it was —
  there is no longer a register that could be read as if the rows were filings.
- `e2e/a11y.spec.ts` — `loadDeclarations` keeps `/declarations` in the axe gate (the landmine is that a
  rebuilt route must not leave the tree unscanned) and now scans a register with a filed return in it
  instead of a second monthly table.
- `e2e/settings.spec.ts` — the v4→v11 byte assertion expected `saved.legacyDeclarations` to be `[]`; it
  now expects neither monthly key to be present, and `saved.filings` to still be `[]`.

## 5. Counts, before → after

| | before (PG-5, `ab7461d`) | after |
|---|---|---|
| `npx tsc --noEmit` | 0 | 0 |
| unit | 99 files / **1549** tests | 99 files / **1547** tests |
| `npm run build` | 0 errors | 0 errors |
| e2e | 68 (64 functional + 4 axe) | 68 (64 functional + 4 axe) |
| copy-guard `ALLOW_LIST` | empty | empty |
| wall-clock guard | passes | passes |

The two missing unit tests are both in `src/data/migration.annual.test.ts` (11 → 9): "drops the old key
from the written shape" folded into the drop test, and "stamps the version even when there is nothing to
move" folded into "stamps the version whether or not the payload carried monthly rows". No assertion was
deleted; two pairs of cases now share a body. No other file changed its test count.

## 6. B-75 and B-77

**B-77 is closed**: the bucket, the second vocabulary and the legacy page section are gone, and the v11
step is simpler than it was.

**B-75 is closed by removal, not by fixing it.** B-75 was "legacy monthly declaration money is still bare
integer `bani` with no currency record", and PG-5 had declined to widen `record-currency` to cover
`legacyDeclarations`. Nothing in this task gives those rows a currency: **the rows are gone**, so the
defect has no subject. Stating it the other way round — as if a currency had been recorded — would be the
same kind of dishonesty the phase exists to prevent.

One consequence of leaving the earlier steps alone, stated rather than buried: the `money-bani` step still
converts `declarations` money and can still emit a `MoneyPrecisionNotice` naming a `declarations` row, and
the notice's `collection` enum still lists `'declarations'`. Those converted rows are then dropped by v11
and are never read. Changing that would mean editing the v5 step's behaviour, which is a different step's
decision than the one this task was given — see §7.

## 7. Left deliberately, with the reason

- `src/data/attention.ts` — `recordTarget` still ends with a branch that maps an unresolved record of kind
  `'declaration'` to `/declarations#!/<status>`. It is unreachable: `unresolvedRecords` in
  `src/domain/attention.ts` only ever yields `'revenue'` or `'expense'`. It is not deleted here because
  deleting it means redrawing `AttentionSource`, `AttentionTarget.record.kind` and `RecordKind` in
  `src/domain/attention.ts`, and those unions are pinned by `src/data/dashboard.test.ts`. The attention
  vocabulary is a separate decision from the record type; the dead branch is named here so it is not
  mistaken for a live monthly path.
- `StoredStatusCode` still carries `'transmisa'`, and `statusBadge` in `src/data/types.ts` still colours
  it. After this task **no live record type can carry that status** — the revenue and expense schemas never
  accepted it, and the monthly row that did is dropped. It stays because redrawing the status vocabulary
  is not this task's boundary; it is recorded here so the next hygiene pass can find it.
- The `money-bani` step's `declarations` conversion and the `'declarations'` member of the notice's
  `collection` enum, as above.
- The register rows for **B-75** and **B-77** in `docs/ai/PHASE_PLAN_11_34.md` §4 still read as open. They
  need the register pass, which cites a commit hash this task does not have.

## 8. Verification

`npx tsc --noEmit` → no output. `npx vitest run` → **99 files, 1547 tests, all passing**.
`npm run build` → built, 0 errors. `npx playwright test` → **68 passed** (64 functional + 4 axe, the
`/declarations` axe route included). `src/ui/copy/copy.guard.test.ts` passes with `ALLOW_LIST` empty, and
`src/test/wallClockGuard.test.ts` passes.
