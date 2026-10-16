# PG-6h-3 — the occupancy sheet (OPANAF 381/2026), under D-OCC-1

The last task of PG-6h. It adds the first data this application holds about people who are **not the
user**, and it ends the accommodation arc without adding a single computation.

Legal object: *fișa de ocupare a capacității de cazare*, approved by **OPANAF nr. 381 din 24.03.2026,
MO I nr. 250 din 31.03.2026**, which abrogates OPANAF 398/2021. Legal basis art. 68^3 alin. (8) and
art. 85 alin. (8)–(9).

**It is a retention obligation, not a filing.** „Se întocmește un exemplar, de către contribuabil. Se
păstrează de către contribuabil." Nothing is submitted. Every design decision below follows from that
one sentence, and the copy says so in Romanian where the user will read it.

## Baseline and result

| | before | after |
|---|---|---|
| `tsc --noEmit` | 0 | 0 |
| unit tests | 116 files / 1729 | **118 files / 1762** |
| `npm run build` | 0 | 0 |
| e2e | 95 (91 functional + 4 axe) | **102 (97 functional + 5 axe)** |
| copy-guard `ALLOW_LIST` | empty | **empty** (unchanged) |
| seed estimate | 311.200 bani | **311.200 bani** (unchanged) |
| data version | 13 | **14** |

## What was built

### The record — `src/data/types.ts`

`OccupancySheet` is **one form per room, per year**, with `OccupancyStay` rows inside it — not per stay,
not per property. Fields are the order's own: `fiscalYear`, `propertyAddress` (Secțiunea I), `roomLabel`
(Secțiunea II), and per stay `guestName`, `guestIdentifier` with an `identifierKind`, `firstDay`,
`lastDay`.

`GuestIdentifierKind` is `'cnp' | 'act_de_identitate'`. It is the taxpayer's own statement about which
identifier they recorded; it is never derived from the value's shape. The order allows an ID series and
number where there is no CNP, and a shape heuristic that silently reclassified one as the other would
misstate a legal record.

`occupancySheets` lives on `AppData`, **not on the profile**. This is not stylistic. `inputSnapshot.profile
= p.profile` puts the whole `PfaProfile` into the canonicalised bytes behind `inputsHash`, and snapshots
are stored. Guest data on the profile would therefore enter calculation digests and **survive its own
deletion** — the record would be reconstructable from a snapshot the deletion path never touches. On
`AppData` it stays outside every digest, which is what the privacy tests assert.

`LegacyAppData` omits `occupancySheets` alongside `revenues` / `expenses` / `filings`, so the legacy
payload fixtures legitimately cannot carry a v14 key.

Two rules the order states are carried as named constants rather than as prose:

- `SHORT_TERM_LET_MAX_DAYS = 30` — „închirierea neîntreruptă a unei camere aceleiași persoane, pentru
  perioade de maximum 30 de zile, într-un an calendaristic".
- `occupancyStayExceedsShortTermCeiling` — inclusive day count against that ceiling. A fraction of a day
  counts as a day, per the order; the function is a **flag**, never a rejection.

`isCnpShaped` checks length and charset only. It is used to flag a suspect value on screen. **There is no
check-digit validation anywhere in the app**, and no path by which a CNP that looks wrong stops a stay
being recorded — the app records what the taxpayer records.

### The gate — `src/data/schema.ts`

`occupancyStaySchema` and `occupancySheetSchema`, with `occupancySheets` **optional** on the app shape so
a pre-v14 payload still validates. Permissive on the strings on purpose: a guest's mistyped CNP must not
be able to make a stored document unreadable. `fiscalYear` is the only bounded field. The type-level
`Expect<Equal<z.output<typeof occupancyStaySchema>, OccupancyStay>>` assertions keep zod and TypeScript
from drifting apart.

### The chain step — `src/data/migration.ts`

`DATA_VERSION_OCCUPANCY_SHEET = 14`, step id `occupancy-sheet`, `from: DATA_VERSION_ACCOMMODATION_FACTS`,
`to: DATA_VERSION_OCCUPANCY_SHEET`. `CURRENT_DATA_VERSION` now points at it. No shipped step was edited,
renumbered or reordered.

**It backfills nothing, and for this collection that is not a convention — it is the only safe
behaviour.** A sheet records other people's names and identity numbers. A step that opened the collection
with a placeholder, or derived one from the recorded room count, would mint identities that never
existed. `phases/38` already warns that the room count must not be used as an occupancy record; a
migration bridging the two would be exactly that bridge, and it would be invisible.

The key stays **absent**, not `[]`. „No sheet has been made" and „sheets were made and none exist" are
different claims, and the load path in `src/data/store.tsx` (`parsed.occupancySheets ?? []`) is the one
place that resolves absence to an empty collection.

### The store — `src/data/store.tsx`

`addOccupancySheet`, `deleteOccupancySheet`, `addOccupancyStay`, `deleteOccupancyStay`. `deleteOccupancySheet`
is the acceptance-5 path: it removes the record from the dataset the save effect serialises, not from a
view.

### The surface — `src/pages/Documents.tsx`

A fourth tab, `occupancy`, rendered beside the existing registers. `Documents` now takes `initialTab` and
`onTabChange` so the tab is addressable and testable.

`occupancyCsv(sheet)` produces the taxpayer's own copy as a file, reusing the file shape the existing RJIP
export already pins — BOM, `\r\n`, semicolon separator, every free-text field quoted. It has **no money
column at all**, and a test asserts that, because the sheet is not a revenue source.

The tab states, in Romanian and where the user reads it: that this is their own retained copy of a
document they are legally required to keep; that nothing is sent to ANAF; that **deleting it here does not
discharge the obligation**; who owes it (both beneficiary groups, 1–7 rooms „indiferent de numărul de
locuințe", and independent-activity accommodation above 7); and the 30-day / fraction-of-a-day definition
with its citation.

The sheet is offered **regardless of the fiscal title**. `accommodationIncomeTitleForYear` already
resolves 1–7 vs >7 into a title, and the sheet is owed under both. Gating it on a title the app could not
resolve would refuse the likeliest person who needs it.

### The route and the entry point

`src/App.tsx` adds `occupancy` to the router's `documents` hash whitelist. This is the whitelist, not a
navigation surface — `parseRoute` drops an unlisted hash, so without it a deep link to a document would
silently open a different tab. The sidebar still offers four pages.

`src/pages/Settings.tsx` gains `[data-occupancy-entry-link]`, deliberately **outside** the accommodation
block and deliberately not conditioned on `activityFamily`, on the room count, or on the resolved fiscal
title. It is a link, not a form.

### The copy — `src/ui/copy/occupancy.ts`

One module exporting `occupancy`, with sections `title`, `subtitle`, `retention`, `privacy`, `scope`,
`definition`, `form`, `identifier`, `export`, `entry`, `validation`. Wired through `src/ui/copy/index.ts`.
No sentence lives in a component — the copy guard enforces this and its `ALLOW_LIST` is still empty.

## Acceptance evidence

**1 — a sheet per room per year with the order's fields, rendered with synthetic guest data.**
`src/pages/Documents.occupancy.test.tsx` (19 tests) renders one and asserts each field, the per-stay
rows, the retention wording, the scope statement and the definition.

**2 — no real CNP anywhere in fixtures, seeds or tests. The grep, run and reported.**

Every 13-digit literal in `src/` and `e2e/`, each checked against the CNP check digit
(weights `2 7 9 1 4 6 3 5 8 2 7 9`, sum mod 11, with the 10 → 1 rule):

```
occurrences: 27   distinct values: 8
  0123456789012   1234567890123   1900101223344   2000000000002
  9000000000001   9876543210987   9999999999986   9999999999999

VALUES THAT VALIDATE AS A REAL CNP: 0
```

**The grep comes back empty.** Zero of the 8 distinct values satisfies the check digit, so none is a
plausible real CNP. The two guest values this task added — `SYNTHETIC_CNP_A = '9000000000001'` and
`SYNTHETIC_CNP_B = '2000000000002'` — live only in `src/test/occupancyFixtures.ts`, are labelled synthetic
in a comment, and additionally carry birth date `00-00-0000`, which is in no register. The most
plausible-looking value in the repo, `1900101223344`, is **pre-existing at HEAD** in
`src/domain/snapshots/hashSync.test.ts` as the *taxpayer's* CNP in a digest test — not a guest, and it
also fails the check digit.

This is not left to a one-off grep. `src/data/occupancy.privacy.test.tsx` re-runs it on every test run
over the occupancy fixture sources, asserts the scan is non-vacuous (it must find values), and fails if
any literal ever validates.

**3 — the no-network property still holds.** `src/data/occupancy.privacy.test.tsx` scans every non-test
file under `src/` via Vite's raw glob for a fetch call, an XHR, a beacon, a WebSocket and an EventSource,
with comment lines stripped. Zero hits. The forbidden tokens are built by string concatenation so the
guard does not report itself — the trick `src/test/wallClockGuard.test.ts` uses. A second test proves the
scan is not vacuous: the glob must cover `pages/Documents.tsx`, `data/store.tsx` and `pages/Settings.tsx`,
each pattern must fire on the token it names, and the near-miss that already exists in the tree —
`FetchText`, an injected function type in `domain/fx` — must not fire.

At the browser layer, `e2e/occupancy-sheet.spec.ts` watches `page.on('request')` while a sheet is open and
asserts every request is same-origin. That catches a leak assembled at runtime, which a source scan
cannot see.

Guest fields appear in no log, diagnostic or fiscal figure: the test asserts no guest string occurs in
`getLedgerDisclosure`, `getFinancialSummary`, `getMonthlyFinancialSeries` or `getTaxEstimate` for a
payload that carries both money and a sheet.

**4 — no existing export gains guest data by default.** Asserted against `rjipCsv` at both layers: the
bytes `buildRjipRegister` produces with a sheet loaded are **identical** to the bytes it produces without
one, and contain no guest name, CNP, ID or property address. The sheet's own file appears only when
`occ-download` is pressed.

**5 — deletion removes the record from persisted data.** Unit and browser both read the stored bytes, not
the view. After `deleteOccupancySheet`, `occupancySheets` is `[]` in `localStorage` and the guest names,
CNP values and property address are gone from the string. Deleting one stay leaves the form and the other
stays standing. A stay recorded with an identity document persists and deletes like any other.

**6 — the engine does not read this data.** `git diff --stat -- src/domain/fiscal/` is **empty**. Nothing
under `domain/fiscal/`, and no change to `domain/tax.ts`, `domain/scenarios.ts`, `domain/estimateBasis.ts`,
`data/dashboard.ts` or `data/derived.ts` — only their tests moved, and only because the record type grew.

The seed estimate is still **311.200 bani**, pinned independently in the pre-existing
`src/data/dashboard.accommodation.test.ts` and again in the privacy test.

The boundary is enforced rather than reviewed. A test scans every file on the calculation path —
`domain/tax.ts`, `estimateBasis.ts`, `aggregation.ts`, `scenarios.ts`, `projection.ts`,
`data/dashboard.ts`, `data/derived.ts` and everything under `domain/fiscal/` — for the **access surface**
(`occupancySheets`, `OccupancySheet`, `OccupancyStay`, `GuestIdentifierKind`, `occupancyCsv`,
`occupancyStayExceedsShortTermCeiling`, `isCnpShaped`, `SHORT_TERM_LET_MAX_DAYS`). Zero hits. It also
asserts the pattern fires on a real read and stays silent on the prose that already exists in those same
files.

Separately, adding a sheet leaves `lines`, `output`, `bases`, `basis`, `inputsHash` and `inputSnapshot`
**byte-identical**. The digest is the strongest form of the claim: the bytes the calculation ran on did
not change.

**7 — the migration appends v14 and backfills nothing.** A new contract test in
`src/data/store.migration.chain.test.tsx` asserts the step produces no key, no placeholder sheet and no
derived stay.

**8 — the copy states, in Romanian, that this is the taxpayer's own retained copy and that nothing is
filed.** Asserted in both layers, including that the order cited is **381/2026** and that the abrogated
**398/2021 appears nowhere**.

**9 — gates.** `tsc` 0 · 118 files / 1762 unit tests pass · `build` 0 · e2e 102 green including the new
axe route · copy-guard `ALLOW_LIST` empty · PG-5C enforcement green (the `measuredBasis` wiring
assertions in `src/data/dashboard.test.ts` and the type-level test in `src/domain/thresholds.test.ts`
still pass; `'annual-projected'` remains absent from `MeasuredBasis`).

## Tests that moved, old → new

Every move is the chain growing by one step. Nothing was re-baselined to make the suite green.

| file | assertion | old → new |
|---|---|---|
| `e2e/settings.spec.ts` | `saved.version` after a legacy payload round-trips | `13` → `14` |
| `src/data/store.migration.chain.test.tsx` | `CURRENT_DATA_VERSION` | `DATA_VERSION_ACCOMMODATION_FACTS` → `DATA_VERSION_OCCUPANCY_SHEET` |
| `src/data/store.migration.chain.test.tsx` | full `stepsApplied` list | appended `'occupancy-sheet'` |
| `src/data/store.migration.chain.test.tsx` | `stepsApplied` from three later entry points | each appended `'occupancy-sheet'` |
| `src/data/store.migration.chain.test.tsx` | step→version pair list | appended `[13, 14]` |
| `src/data/migration.currency.test.ts` | `CURRENT_DATA_VERSION` | `…ACCOMMODATION_FACTS` → `…OCCUPANCY_SHEET` |
| `src/data/migration.currency.test.ts` | `MIGRATION_CHAIN.indexOf(step)` | `length - 4` → `length - 5` |
| `src/data/migration.currency.test.ts` | `stepsApplied` | appended `'occupancy-sheet'` |
| `src/data/store.taxReserve.test.tsx` | chain step id list | appended `'occupancy-sheet'` |
| `src/data/store.save.test.tsx` | stored-key contract | appended `'occupancySheets'` |

The e2e re-pin carries the house's dated comment recording why it moved and what stayed untouched — the
sixth such re-pin for the same reason. It also gained the v14 step's own half: a pre-v11 payload comes
back with `occupancySheets: []` and **no invented guest**.

Sixteen fixture sites gained `occupancySheets: []` because the field is required on `AppData`. This is the
same cost `filings` paid when it became required, and the field stays required for the same reason: an
absent collection and an empty one are different claims at the type level.

## Findings

**The copy guard is right and its own comment is wrong.** `ROMANIAN_WORDS` in
`src/ui/copy/copy.guard.test.ts` contains `'date'`, while the note beneath the set states that `'date'` is
deliberately excluded because it collides with the English word. It is not excluded. My first test id for
the day-order warning, `occ-bad-date`, was correctly reported as a user-visible sentence — `date` is
Romanian for "data". I renamed the hook to `occ-stay-days-warning` rather than weaken the guard. The
comment should be corrected in a later hygiene pass; it is a trap for the next person who picks a
`date`-shaped test id.

**The occupancy route inherits an app-wide landmark gap.** The new axe route reports two **moderate,
non-blocking** findings — `landmark-one-main` and `region`. They are not introduced here: `src/App.tsx`
renders an `<aside>` and a `<nav>` but no `<main>`, and the identical pair already appears on `/dashboard`
and `/declarations`. Below the serious-and-critical gate, so the route was admitted rather than the shell
changed. Worth fixing once, app-wide.

**A stale LSP diagnostic, recorded so it is not mistaken for a defect.** An automated check repeatedly
reported `emptyTitle` missing from the `occupancy.form` copy object. It is present, and project-wide
`tsc --noEmit` exits 0. The reported type shape was the pre-edit one, and the configured LSP server is
push-only and cannot return a clean result, so the cached finding never cleared. Not a code problem; no
change was made in response to it.

## Boundary notes

Two things outside the brief's "may touch" list, recorded rather than slipped through.

**`src/App.tsx` — five lines, and the entry point does not work without them.** The brief lists
`pages/Settings.tsx` (entry point only) as in scope, but the router's hash whitelist lives in `App.tsx`,
and `parseRoute` drops an unlisted hash. Without adding `occupancy` to the `documents` list, the Settings
link the brief asks for would land on the default tab and a deep link to a sheet would silently open a
different one. The change is the whitelist entry alone; the sidebar still offers four pages, and no new
navigation surface was added.

**The zod shape went in `src/data/schema.ts`, which is the right file here.** The brief warns that a
recent brief named `data/schema.ts` when the zod **profile** shape lives in `domain/schema.ts`. That is
true and unchanged: `domain/schema.ts` holds `pfaProfileSchema`, `pfaIdentitySchema` and `caenCodeSchema`.
But this task deliberately keeps guest data **off the profile**, so the collection belongs on
`persistedAppDataSchema` in `data/schema.ts` — the schema `store.tsx` imports as `./schema` and parses
loaded data with. Naming the profile file here would have put a third party's identity into
`inputsHash`.

## What the app now knows about an accommodation user, end to end

PG-6h is complete. The chain of facts, each recorded rather than inferred:

- **Activity family** — `activityFamily` on the profile, with no default invented for a person who never
  answered.
- **Room count, per year** — `accommodationRoomCounts` as `{ fiscalYear, rooms }[]`, the per-year record
  pattern this house already used for pension receipts.
- **Fiscal title, per year** — `accommodationIncomeTitleForYear` in `src/domain/models.ts` resolves 1–7
  against >7 into a title.
- **Commission reading** — `accommodationCommissionReading`, the taxpayer's own statement about what the
  platform commission covers.
- **Tourism eligibility** — `accommodationTourismEligibility`, their answer about the tourism-law gate.
- **The occupancy record** — new here: `occupancySheets`, one form per room per year, with a row per stay.

**What the app still does not know, and what still blocks a computed figure for art. 68^3:**

1. **B-80 — the commission scope.** Whether the platform commission reduces the gross under alin. (3). It
   moves the gross, so it stays `review_required`; no default was ever chosen.
2. **The attribution gap.** A `Revenue` record carries no category, no activity marker and no source, so
   the app cannot say which receipts the flat-ratio method applies to. `phases/39` records this as the
   `accommodation-method-attribution-missing` refusal with `effect: 'refuse'` and a fix target of the
   Settings fiscal tab. Nothing was invented to close it, and the occupancy sheet does **not** close it —
   a stay is not a receipt.
3. **The missing art. 85 rule.** 1–7 rooms is still uncomputed. D-CAZ-1 path (c) needs an art. 85 rule with
   its own citation, and the FY2026 package does not contain one.
4. **Mixed-method years.** A year with both a flat-ratio leg and a sistem-real leg is not computable,
   because a `Revenue` record cannot say which method it belongs to. `phases/39` states the minimum fact
   required and what it would cost. Nothing structural prevents the engine from double-counting such a
   year — the expense engine returns an empty deductible set for a `cazare` register, so the cumulated base
   would be 1.7 × revenue with two income taxes on top. Today only the upstream scenario refusal keeps the
   legs apart.

The occupancy record answers none of these, and must not be used to. It is a document the taxpayer keeps.

## Handoff

- **6c** vehicle facts, **6d** other income, **6e** fixed assets, **6f** deductible input VAT, **6g** Form
  300 setup — none of them inherit anything from this task.
- **B-79** (`closed_final` declared, produced by nobody) remains open and unowned.
- The `date`-in-`ROMANIAN_WORDS` comment and the app-wide missing `<main>` are both small, both recorded
  above, and neither belongs to this phase.
