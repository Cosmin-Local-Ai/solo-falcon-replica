# PG-5 — the annual filing model, the deadline done-state, B-35, B-72, B-73 (brief 35)

Scope as briefed: **18A** (the annual D212 record and the deadline done-rule), **18B** (B-35, the VAT
filing period), **B-72** (the basis wording PG-4 left) and **B-73** (the year-advance trigger). The
migration head was confirmed in the tree before choosing the new version: `CURRENT_DATA_VERSION` was
`DATA_VERSION_RECORD_CURRENCY = 10`, so the new step is **v11**, named `annual-filing`.

## What was already true, and was not rebuilt

- `src/domain/deadlines.ts` already had the right event vocabulary — `DeadlineEventType = 'd212_filing' |
  'vat_registration'` — and its header already recorded that `pfa_estimated_declaration` was removed
  because art. 120 was abrogated on 01-01-2025. **It was not resurrected.** No rule value, threshold,
  citation or registry entry was touched anywhere in this phase; the calendar rules are the ones PG-4
  left.
- The rule engine already emitted `PFA_DEADLINE_2026` at 2027-05-25 for the seed profile. The gap was
  never the date — it was that **nothing anywhere resolved a deadline from a filing.**
- `domain/attention.ts` already owned the one attention pipeline (PG-1/PG-2), and `domain/date.ts`
  already owned the clock seam. Neither was re-plumbed.
- `data/types.ts` already separated `Bani` (integer bani) from `Money` (`{amount, currency}`), and
  `record-currency` had already wrapped only revenues and expenses. That is why the monthly rows' money
  fields are still bare integers in the stored shape — see the migration note.

## 1. The record: `AnnualFiling` (B-34)

`declarationSchema` was `{id, an, luna, venituri, cheltuieli, status, dataInregistrare, dataTrimitere?}`
with `luna` constrained 1–12. It could not hold a single annual filing, and it let a monthly row stand in
for one. Added in `src/data/types.ts`:

- `AnnualFiling` — `{id, taxYear, form, status, filedOn?, reference?}`. `taxYear` is the year the return
  **declares**, not the year it was filed: the FY2026 return carries `taxYear: 2026` and a `filedOn` in
  2027. That is the whole of B-34 in one field.
- `FilingStatus = 'in_pregatire' | 'depusa' | 'respinsa'` and `FilingForm = 'D212'`.
- `isFiledFiling` — the single predicate that says a filing happened.

`status` is deliberately **not** the monthly `DeclStatus`. Keeping the two vocabularies apart is what
stops `status: 'inregistrata'` on a monthly row from being read as proof of a submission. `Declaration`
stays in the types as the legacy shape; it is not deleted, because the rows exist in users' storage.

`src/data/schema.ts` declares `declarations`, `filings` **and** `legacyDeclarations` on
`persistedAppDataSchema`. All three stay declared because **zod strips undeclared keys**: dropping
`declarations` from the gate would erase a user's monthly records on load, before any migration code ever
saw them. That was the single largest data-loss hazard in this task and it is called out in the schema
comment.

`RecordKind` gained `'filing'` and `RECORD_DATE_FIELDS` gained the filing's `filedOn`, so the write-path
date validator (B-21) covers the new record: a malformed `filedOn` is refused, an **absent** one is
accepted, because a return being prepared genuinely has no filing date.

## 2. The store: annual writes only, monthly rows read-only

`src/data/store.tsx` removed `addDeclaration`, `updateDeclaration` and `sendDeclaration` and added
`addFiling` / `updateFiling`. The load path maps an absent `filings` key to `[]` and the same for
`legacyDeclarations` — absence in storage is "nobody recorded it", never "it was empty and derived".

The app does not offer to create a monthly declaration any more, because it has no evidence of a monthly
obligation for this profile and no business minting records it cannot stand behind. The monthly rows that
already exist are reachable and readable, and nothing writes them.

## 3. The migration: v10 → v11, `annual-filing`

`src/data/migration.ts`, `migrateAnnualFilingV11`. The mapping, stated exactly:

| Stored at v10 | Stored at v11 |
|---|---|
| `declarations: Declaration[]` | `legacyDeclarations: Declaration[]` — the same array, byte for byte, order preserved, no field added, renamed or retyped |
| `filings` absent | `filings: []` |
| `filings` present | untouched, never replaced |
| `declarations` absent | **no `legacyDeclarations` key at all** — an empty one would claim a monthly history the install does not have |
| `declarations` alongside `legacyDeclarations` | the renamed key wins, the stray `declarations` key is dropped (keeping both lets them disagree, which is how a row disappears from every surface) |
| every other key, every money field | untouched |

**Nothing is derived.** No annual row is created from a monthly one; no monthly row is summarised,
merged or converted. A monthly row with `status: 'inregistrata'` records that a row was registered in
this app — it is not evidence that anyone filed an annual return, and an annual row minted from it would
be a fact the user never established.

**Losses: none.** What changes is not the bytes but what the app is willing to *infer* from them, and
that change is visible rather than silent: the legacy rows no longer generate attention items, no longer
satisfy a completeness check, and no longer count in the pending badge. They are shown on the Declarations
page under their own heading, read-only, with a sentence saying what they are and are not.

The step is idempotent and stamps the version even when there is nothing to move — the chain throws on a
step that fails to bump the version, and it should.

**A defect found and fixed while writing this:** an earlier revision of the step spread
`{...stamped, ...rest}` where `rest` still carried the payload's old `version`, so the result came back at
v10 and the chain aborted with `migration step 'annual-filing' did not set version 11 (got 10)`. It
failed loudly, which is the only reason it was caught; the chain's version guard is what turned a
would-be silent data-shape bug into a test failure. The step now destructures `version` and
`declarations` out of the payload copy so the stamp is the last word.

## 4. The deadline done-state

`src/domain/deadlines.ts` gained:

- `DeadlineOutcome = 'done' | 'overdue' | 'due_today' | 'upcoming' | 'undated'`;
- `DeadlineView extends Deadline` with `done`, `filedOn` and `outcome`;
- `filingForDeadline` / `isDeadlineDone` — a term is discharged by a **filed `AnnualFiling` for that tax
  year and form**, and by nothing else. A monthly `Declaration` cannot reach this function; that is
  deliberate, not an accident of typing;
- `resolveDeadlineOutcome` — done beats every temporal phase, and a term with no resolved date is
  `undated`, never `overdue`.

`src/data/dashboard.ts` now produces the annotated rows once (`getDeadlineRows`) and every surface reads
them: `getUpcomingDeadlines` for the card, `getUndatedDeadlines` for the B-35 evidence, and the attention
pipeline receives only the terms that are **not** done. `buildDashboardData` also passes the D212 term's
date into `assessCompleteness` as `filingTerm`, so the completeness layer never computes a statutory date
of its own — the rule package stays the only source of the law.

`PendingCounts.declarationsInAsteptare` became `filingsInAsteptare`, counting annual returns recorded but
not yet filed. The old count was a tally of monthly rows whose own status said „în așteptare".

`src/components/dashboard/DeadlineSection.tsx` renders `DeadlineView`: a discharged term carries a
„Depusă" badge and `Depusă pe <date>` instead of rendering identically to an unfiled one. Before this,
the row came from the rule engine, which has never seen a filing, so a filed return and an unfiled one
were the same pixels.

## 5. The completeness check, and B-35

`src/domain/completeness.ts` replaced `declarationCheck` (predicate: `list.length > 0`, literally "any
declaration exists") with two checks:

- **`annualFiling`** — the return for the year this view is about. A filed return → satisfied, with the
  filing date. A recorded-but-unfiled return → not satisfied, and the detail says which half is missing.
  No return and the term has not arrived → **satisfied**: nothing is missing from the data, the obligation
  is simply not owed yet. No return and the term has passed → not satisfied, naming the term. No rule
  package for the year → not satisfied, and the detail says the term cannot be established rather than
  inventing one.
- **`vatFilingPeriod`** (B-35) — for a non-exempt profile with no VAT registration fact, the detail is
  the admission: the period cannot be established, and the app asks for the registration date and the
  prior-year taxable supplies (CF art. 322 alin. (1)-(4)). **No cadence is asserted in either direction.**
  A profile that *is* exempt is a genuine satisfied state — scutirea de TVA removes the periodic return,
  so there is no period to fix. A recorded `vatExceedanceDate` does not let the app name a period it was
  never told: that field is the date the ceiling was crossed, and a taxpayer registered from the start
  never had that event.

The check count moved **8 → 9**. `term` is passed in, never derived in the completeness layer.

`src/domain/attention.ts` no longer treats the monthly family as a source of items at all. An item for
one of them read „Declarație fără depunere înregistrată: 2026-06", which asserts a submission this
profile does not owe. `RecordSource` keeps `legacyDeclarations` as an **optional, unread** field so the
inertness is stated where the rows arrive rather than being an absence a later edit can fill in by
accident. The now-unused `periodLabel` helper was removed.

## 6. One producer for the deadline and completeness wording

`src/domain/insights.ts` had its own `DEADLINE_LABELS` (a third spelling of the same keys) and its
D212 row read "PFA". Both label families now come from `src/ui/copy/dashboard.ts`:

- `deadlineLabels` / `deadlineLabelFor(appliesTo, taxYear)` — the D212 family renders the return, the
  form and the year it declares: `Declarația unică (D212) pentru <year>`. `applies_to: 'pfa'` in the rule
  registry was **not** touched: it is a rule value, not a label.
- `CHECK_LABELS` is the only completeness label map. `insights.ts`'s `COMPLETENESS_LABELS` was **deleted**
  — it had already drifted: it still carried `declarations` and `taxEstimate`, two keys
  `completeness.ts` no longer emits, and it had no entry for the two it does emit now, which would have
  rendered them as the fallback word „date". That is the B-70 class, one idea spelled twice.
- **Both fallbacks now return the raw key.** They used to return 'Termen fiscal' and 'date' — plausible
  generics that made a brand-new obligation look handled and kept the suite green. `src/ui/copy/labels.test.ts`
  pins the contract: every key the producer emits has a Romanian label, and an unknown key renders
  itself. The next key added without a label fails a test instead of shipping a sentence nobody wrote.
- `vatFilingPeriodUnknown` is one sentence with one home, used by the completeness check and the term
  card alike.
- `src/ui/copy/records.ts` carries the register's Romanian and `recordStatus.filingLabels`.

Rejected alternative, recorded because it was the tempting one: having `data/dashboard.ts` drop the
`d212_filing` rows and emit its own item. That would have left two producers for one deadline family —
the exact defect PG-2 closed as B-70.

## 7. B-72 — the basis wording

`src/domain/estimateBasis.ts` renders the run-rate note from the projection's own window:
`„(N din M luni de activitate)"`, where M is `activeMonths`. It used to say „N din 12 luni scurse", which
described the calendar year while the figure beside it was multiplied by the active period. **No
arithmetic changed** — `activeMonths` was already on `ProjectionV1` from PG-4; the wording layer was
allowed to read it. Where a profile records no start date the active period *is* the calendar year, and
the sentence says 12; for a 1 July start at 15 September it says „2,5 din 6 luni de activitate". The
degenerate case still says there is no run rate for that date.

## 8. B-73 — the advance does not depend on which page opens first

`src/components/dashboard/YearLifecycleBanner.tsx` exports `FiscalYearAdvance`, mounted in `src/App.tsx`
next to the router. It renders nothing and is the **only** writer of the automatic advance. The banner
now only *reports* an advance — it notices that the year it was mounted on moved to the year the clock is
in, and says so on the same render.

PG-4's guarantees are kept and re-pinned at the new call site: `yearAdvanceTarget` decides, it compares
`profile.updatedAt` in the **local** year (a UTC prefix comparison re-advanced over the toggle back and
Playwright caught it), the write re-stamps `updatedAt`, and a deliberate year choice made after the
boundary survives a reload.

`src/App.tsx` also dropped the declarations tab family from `VALID_TABS` and the route plumbing: the
monthly status tabs (`inregistrata` / `in-asteptare` / `transmisa` / `respinsa`) were tabs over a monthly
register. An attention row for a filing points at the page.

## 9. The Declarations page

`src/pages/Declarations.tsx` is the annual register: the year declared, the form (D212, not a free
field — a select with one option would be a control that can only be answered one way), the status, the
filing date and the ANAF reference. „Marchează ca depusă" stamps `localDateISO()` at the moment the app is
told the return was filed; it is not backdated and it is not written for a status that does not claim a
filing. A return marked „Depusă" without a date is refused, not stored dateless.

Below it, `LegacyMonthly` lists the preserved monthly rows: read-only by construction — the component has
no write path and the store no longer offers one — with a heading and a note that says the rows were kept
so the information is not lost, that they are not filings, and that they do not prove anything was
transmitted.

## The seed: what was removed, what was kept, what stops being represented

The monthly **declaration rows** were already gone from `src/data/seed.ts` — TASK 9 removed the three
(2026-03 `transmisa`, 2026-06 `in-asteptare`, 2026-09 `inregistrata`) because they recorded monthly
filings this profile does not owe. **No annual filing was seeded in their place.** This profile's first
Declarația Unică is the FY2026 return, due 2027-05-25; at the demo's own date it has not been filed, so
`filings` is empty and the deadline says so. Seeding one would be inventing the same fact in a tidier
shape.

What PG-5 removed is the **D300 cadence**, which lived in two fixtures:

- **Removed** — `companyDocs.tva`: the document row „Declarația 300 – August 2026", depusă 2026-09-15,
  perioada „August 2026".
- **Removed** — `statements`: the row `{tip: '300', perioada: '2026-08', depunere: 'personală',
  dataDepunere: '2026-09-15'}`.
- **Kept** — everything else in the seed: revenues, expenses, clients, documents, the three `facturi`
  company documents, settings, profile. No money record, no date and no identity field moved.

These were not filings the demo could evidence; they were **the cadence assertion wearing a document's
clothes**. CF art. 322 alin. (1)-(4) makes the VAT fiscal period the quarter when the previous year's
taxable supplies stayed under the 100.000 € equivalent and the month otherwise, and which of those this
profile is turns on its VAT registration date and prior-year taxable supplies — facts no field anywhere
in this dataset records. Keeping the rows and editing only the period would have picked a quarter nobody
recorded, which is the same invention in the other direction.

**What stops being represented, stated plainly:** the demo no longer shows **any** filed VAT return. The
`tva` section of the company documents is empty and the tax-statement register is empty. Those two
absences are now visible as two unsatisfied completeness rows instead of being papered over by a fixture
that implied an answer to a question the app was never given the facts to ask.

The three TASK 9 monthly rows were re-used as **test fixtures** (`src/data/store.edit.test.tsx`,
`src/domain/attention.test.ts`, `src/data/migration.annual.test.ts`) so the preservation is tested against
real-shaped data rather than an empty list.

## Tests that moved, and why

Every one of these is a re-pin of an assertion that named the old shape, not a deletion.

**Migration and load**

- `src/data/store.migration.chain.test.tsx` — the chain edge list gained `[DATA_VERSION_RECORD_CURRENCY,
  DATA_VERSION_ANNUAL_FILING]`; `CURRENT_DATA_VERSION` is now asserted against
  `DATA_VERSION_ANNUAL_FILING`, not `DATA_VERSION_RECORD_CURRENCY`; every `stepsApplied` list gained
  `'annual-filing'` (ten lists); the legacy-payload test moved from
  `storeRef.declarations.map(d => d.id)` to `storeRef.legacyDeclarations.map(d => d.id)` **plus** a new
  assertion that `filings` is empty — the row survives, nothing is minted.
- `src/data/migration.currency.test.ts` — "runs record-currency as its own **final** step" → "as its own
  step, from 9 to 10", asserted by finding the step rather than by index, since it is now step 10 of 11;
  "a v9 payload needs exactly one step" → one step per version above it, `['record-currency',
  'annual-filing']`; "a payload already at v10 runs no step at all" → "a v10 payload runs exactly the
  annual-filing step, and no amount moves", plus a new "already at the current version runs no step".
- `src/data/store.taxReserve.test.tsx` — one `stepsApplied` list, +1 entry.
- `src/data/store.profileBackfill.test.tsx` — the byte-identical legacy assertion moved to
  `legacyDeclarations`, and gained `expect(filings).toEqual([])`.
- `src/data/store.load.test.tsx` — the backfill-to-empty assertion split into `filings` and
  `legacyDeclarations`.
- `src/data/schema.test.ts` — the minimal-payload fixture key.

**Store write paths**

- `src/data/store.edit.test.tsx` — `describe('updateDeclaration')` → `describe('updateFiling')`, with the
  same four cases (in-place update, siblings untouched, persisted to storage, unknown id is a no-op) plus
  a new one: writing an annual filing leaves the legacy monthly rows byte-for-byte where they were.
- `src/data/store.save.test.tsx` — save cycle 5 moved from add-then-update a declaration to
  add-then-update a filing; the serialized-key assertion gained `filings` and `legacyDeclarations` and
  lost `declarations` — that key list is the migration's evidence, written as a test.
- `src/data/store.dateValidation.test.tsx` — "refuses a declaration with no registration date" →
  "refuses an annual filing with a malformed filing date", plus a new case that a filing with **no** date
  is accepted and stays dateless.
- `src/data/store.fxRates.test.tsx`, `src/domain/aggregation.test.ts`, `src/domain/derived.test.ts`,
  `src/domain/projection.test.ts`, `src/pages/Dashboard.empty.test.tsx`, `src/pages/Dashboard.test.tsx`,
  `src/data/seed.test.ts` — `AppData` fixture key rename; `seed.test.ts` now asserts both `filings` and
  `legacyDeclarations` are empty in the seed and in `emptyData()`.

**Attention, completeness, dashboard**

- `src/domain/attention.test.ts` — the three cases that followed a monthly row (`d2` as `not_submitted`,
  the settled list including `d1`/`d3`, and the submission-date case) became one case: a legacy monthly
  row produces **no** item whatever its status, and adding legacy rows does not change the action list at
  all. The `kind` whitelist dropped `'declaration'`.
- `src/data/dashboard.test.ts` — `declarationsInAsteptare` → `filingsInAsteptare`, with new cases that a
  filed return is not pending and that legacy rows are never counted; the `record-declaration-d2` action
  case became "a legacy row produces no action item, and the list is unchanged"; the reconciliation test
  moved from `toContain('completeness-declarations')` to `not.toContain('completeness-declarations')`,
  `not.toContain('completeness-annualFiling')` (not yet due is not missing data) and `toContain` for
  `completeness-statements` and `completeness-vatFilingPeriod`.
- `src/domain/completeness.test.ts` — `totalCount` 8 → 9; fully-populated 8 → 9; mixed 6 → 7; the
  statements detail moved from index 7 to index 8; the fully-populated profile fixture is now
  `vatExempt: true`, because that is the one VAT state the app can call complete. Two new groups:
  `annualFiling` (filed / wrong year / legacy rows only / recorded-but-unfiled / not-yet-due / no rule
  package) and `vatFilingPeriod` (non-exempt gets the admission and no cadence word, exempt is
  satisfied, an exceedance date does not name a period).
- `src/domain/insights.test.ts` — the completeness label map dropped `declarations` and the dead
  `taxEstimate` and gained the two new keys; the real-`assessCompleteness` integration test moved 8 → 9;
  "falls back to 'date' for unknown keys" → "renders an unknown completeness key RAW"; the raw-key
  invariant was restated for the families that have labels, and a new test pins that an unknown deadline
  key surfaces raw and never 'Termen fiscal'.
- `src/domain/estimateBasis.test.ts` — the basis label moved from „(8,5 din 12 luni scurse)" to
  „(8,5 din 12 luni de activitate)", and a new case pins the mid-year starter: a 1 July start at 15
  September renders „(2,5 din 6 luni de activitate)" and never says 12.

**Components**

- `src/components/dashboard/DeadlineSection.test.tsx` — fixtures moved from `Deadline` to `DeadlineView`
  (`done`, `filedOn`, `outcome`), and two new cases: a discharged term renders „Depusă" with the filing
  date and no „Activ", and an unfilled term keeps its rule status.
- `src/components/dashboard/YearLifecycleBanner.test.tsx` — "writes the year forward when the view says
  the clock has moved past it" was the banner's job and is now the shell's. It became three cases: the
  banner **reports** an advance performed by `FiscalYearAdvance` in the same render; a deliberate toggle
  back is never called an advance; and a new `FiscalYearAdvance` group that advances the year on 2 January
  with **no dashboard mounted**, yields to a choice made just after the boundary, and leaves a current
  year alone.

**Pages**

- `src/pages/Declarations.test.tsx` — the edit-in-place and status-preservation regressions moved from a
  monthly row to an annual filing (reference edited, status select untouched), and gained two cases:
  marking filed writes a date, and the legacy section renders with **no** button and no clickable row.
- `src/pages/Declarations.dates.test.tsx` (B-46) — "a new declaration defaults to 1 Jan 2027" split into
  two truths: the annual form starts with **no** date at all (absence is a real state, and pre-filling
  one would mint a submission nobody recorded), and the clock-sensitive write is now „Marchează ca
  depusă", which at 00:30 local on 1 Jan 2027 records `2027-01-01`, not the UTC day. A third case pins
  that „Depusă" without a date is refused.

**E2E**

- `e2e/dashboard.spec.ts` — the completeness card: `7/8` → `7/9`, `7 din 8` → `7 din 9`, 8 check rows →
  9, the label list lost `Declarații` and gained `Declarația unică (D212)` and `Perioada de depunere TVA`,
  the single gap `nu există declarații` became two (`nu există situații de taxe` and the B-35 sentence),
  `Lipsă` 1 → 2, and the company-documents detail lost `tva: 1` with the seed row. The action list:
  5 → 6 items, `Completitudine` badge 1 → 2, `prioritate medie` 3 → 4, and the two declaration rows
  replaced by the two honest ones.
- `e2e/payment-dates.spec.ts` — the declarations leg of the B-46 test, as above.
- `e2e/settings.spec.ts` — the B-26 round-trip: `saved.version` 10 → 11, plus assertions that the written
  bytes carry `filings: []` and `legacyDeclarations: []` for a payload that never had monthly rows.
- `e2e/year-rollover.spec.ts` — unchanged assertions, one new test (B-73).
- `e2e/a11y.spec.ts` — unchanged gate, one new scan (below).

## Tests added

- **`e2e/annual-filing.spec.ts`** (5) — acceptance 1 and 2, in a browser, at a clock one week past the
  term: no filing → exactly one overdue row, labelled „Termen depășit: Declarația unică (D212) pentru
  2026", with the expiry date in the sentence, `href="/declarations"`, `data-severity="high"`, and
  `Termen depășit: PFA` gone; a recorded filing → **no** overdue row and no open-term row either, and the
  completeness card states the same fact from the same predicate; a monthly `inregistrata` row → still
  exactly one overdue row, and the monthly rows are still readable on the Declarations page; a return
  filed before its term → the card shows „Depusă" with the date and no „Activ"; and the round trip —
  recording the filing from the register clears the alert.
- **`src/data/migration.annual.test.ts`** (11) — the v11 step on its own: rows move byte for byte in
  order; no filing is minted; a registered monthly row does not become a filed annual return; the old key
  is dropped; nothing else in the payload changes; no amount or currency stamp is touched; a payload with
  no monthly rows gains no `legacyDeclarations` key; an existing `filings` array is never replaced; the
  step is idempotent; a stray `declarations` beside `legacyDeclarations` loses; the version is stamped
  even with nothing to move.
- **`src/ui/copy/labels.test.ts`** (7) — the two fallback contracts, and the completeness key list
  restated so a new check without a label fails here.
- `e2e/year-rollover.spec.ts` (1) — B-73: the app is started on `/revenues` on 2 January 2027, the stored
  fiscal year becomes 2027 with no dashboard ever opened, the dashboard then names the missing 2027 rule
  package instead of showing last year's register, and the toggle back to 2026 still works and still
  survives a reload.
- `e2e/a11y.spec.ts` (1) — the axe gate widened to `/declarations`, the route this phase rebuilt (a
  register table, a second read-only table, and a modal form). The route was recorded as a follow-up in
  `docs/ai/phases/27_pg0_groundwork.md`; it is covered here because a new surface should not enter the
  tree unscanned.
- New cases inside existing files are listed above, not counted twice.

## Decisions

- **One predicate for "filed".** `isFiledFiling` is used by the deadline done-rule and the completeness
  check. Two surfaces, one fact — the B-70 rule applied to a predicate rather than to a label.
- **"Not owed yet" is not missing data.** The annual filing check is satisfied before the term. This is
  the half that made „Date lipsă: Declarații" a permanent action on a profile whose only return was due in
  May of the following year.
- **Absence stays absent.** No `filings` key in storage means nobody recorded a filing; the load path
  turns it into `[]` for the session, and the migration does not write an empty `legacyDeclarations` for
  an install that never had monthly rows.
- **The B-35 sentence goes through the completeness channel**, not a second warning surface, so it reaches
  the card and the action list from one producer and cannot appear twice in two vocabularies.
- **Raw keys beat plausible generics** in both label fallbacks. A raw key is ugly in a way a reader
  notices, and the guard test makes it impossible to ship one.
- **No monthly write path anywhere.** Not "hidden in the UI" — removed from the store's API.
- **The year advance has exactly one writer**, in the shell. Two components writing the same year is how a
  toggle back gets overwritten.

## Findings handed forward

- **`thresholdLabel` in `src/domain/insights.ts` still falls back to 'Prag fiscal'.** Same
  silent-generic class as the two fallbacks closed here, in the threshold family, which PG-5 does not
  own. Worth folding the next time the threshold wording is touched.
- **The legacy monthly rows' money fields are still bare integer bani in storage.** `record-currency`
  wrapped revenues and expenses only, and PG-5 deliberately did not extend a closed migration step. If a
  later phase wants currency on the legacy rows, it needs its own named step, not a side effect.
- **The term card's row title is the event label** („Depunere D212") with the audience chip beside it; the
  year-specific sentence lives on the attention row. If the card should also name the year, that is a copy
  decision for whoever next touches `DeadlineSection`.
- **The D300 periodic obligation has no rule and no date**, and `vat_registration` still needs
  `vatExceedanceDate` to resolve at all. Both belong with PG-6, which owns `refused` and `closed_final`.
- **The seed now has two completeness gaps** (statement register, VAT period). A later phase that seeds a
  D212 document or a VAT artefact must not reintroduce a cadence the fixture cannot evidence.
- **axe on `/declarations` reports non-blocking findings** (content outside a landmark), the same
  `landmark-one-main` class already recorded for `/dashboard` in `docs/ai/phases/27_pg0_groundwork.md`.

## Scout process — recorded, not glossed

Two scouts, sequential, as briefed; neither scouted a file that was edited afterwards.

- **Scout A — the blast radius of `declarationSchema` / `Declaration` / `data.declarations`.** Reported
  and used. Two findings changed the plan. First: **`src/data/seed.ts` carries zero declaration rows** —
  TASK 9 removed them — so the migration's risk is not the seed, it is a real user's persisted
  localStorage payload, which no test in the repository exercises end to end. That is why
  `src/data/migration.annual.test.ts` exists and why the store tests carry their own monthly fixtures.
  Second: **`schema.ts` has no `.strict()`**, so zod *strips* undeclared keys — a careless rename that
  dropped `declarations` from the gate would have destroyed the monthly rows on load, before any
  migration code ran. All three keys are declared, with the reason in the comment.
- **Scout B — how `deadlines.ts` derives each deadline's state, with the call path from
  `data/dashboard.ts`.** Reported and used. It confirmed the calendar rules were correct and that the gap
  was purely the missing join to the filings, which is why no rule value, threshold, citation or registry
  entry was touched.
- **Both reports were verified against the tree before use** (§12.12): every path and identifier each
  report named was grepped, and the one identifier that did not exist (`quarantine.ts` as a module name)
  was checked and found genuinely absent, so nothing from either report reached the code unverified.

## Verification

- `npx tsc --noEmit` — **0 errors**.
- `npm run build` — succeeds (the pre-existing recharts chunk-size warning only).
- `npx vitest run` — **99 files / 1549 tests, all passing** (PG-4 handoff baseline 97 / 1507: +2 files,
  +42 tests).
- `npx playwright test` — **68 tests, all passing** (baseline 61: +7; 64 functional + 4 axe).
- `src/ui/copy/copy.guard.test.ts` passes with the **allow-list still empty**.
- Acceptance, where each is proven: **1** `e2e/annual-filing.spec.ts` (both halves, Playwright);
  **2** same file, plus `src/data/migration.annual.test.ts` and `src/domain/deadlines.ts`'s
  `filingForDeadline`; **3** `src/domain/completeness.test.ts` and `e2e/dashboard.spec.ts`;
  **4** `src/domain/completeness.test.ts` (no cadence word in either direction) and `e2e/dashboard.spec.ts`
  (no `trimestrial` / `D300` on the card); **5** `src/domain/estimateBasis.test.ts`;
  **6** `e2e/year-rollover.spec.ts` and `src/components/dashboard/YearLifecycleBanner.test.tsx`;
  **7** `src/data/migration.annual.test.ts`, `src/data/store.save.test.tsx`,
  `src/data/store.migration.chain.test.tsx` and the version assertions in `e2e/settings.spec.ts`.
