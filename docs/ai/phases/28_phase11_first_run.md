# Phase 11 / PG-3 — first run: a fresh profile opens on onboarding, and the demo is an opt-in sandbox

**Date:** 2026-10-10 (`date +%F`). **Brief:** `docs/ai/briefs/31_phase11_first_run.md`.
**Decision this implements:** `USER_DECISIONS.md` **D-SEED-2** — decided, not reopened here.
**Read first, and not re-derived here:** `briefs/28_pg_production_gate.md` §PG-3 (defects D1–D6),
`phases/27_pg0_groundwork.md` (the PG-0 baseline and the clock helpers), `phases/23_provenance_hygiene.md` §5
(the seed identity, and why `declarations` was emptied in TASK 9).

**Baseline before any change, measured at `124e2c6`:** `tsc` 0 · **81 files / 1375 tests** · `build` 0 ·
**e2e 42** (39 functional + 3 axe). The brief's own §BASELINE quotes 80 / 1368 / 39; PG-0 landed between that
line and this brief, and `phases/27_pg0_groundwork.md` records the corrected figures. The corrected figures
are the ones used here.

**After this change:** `tsc` 0 · **85 files / 1409 tests** · `build` 0 · **e2e 49** (46 functional + 3 axe) ·
copy-guard allow-list **still empty** · **data version unchanged at 10** (see §4 — deliberately).

---

## 1. The defect was a screen, not a value

`data/seed.ts` was the initial state of every install. `store.tsx` answered empty storage with
`{ data: seedData, dataOrigin: 'seed' }`, and **production code never branched on `'seed'`** — the only
branch on `dataOrigin` in the whole app was `=== 'quarantined'`, which renders the recovery banner. The label
existed and did nothing.

That is why acceptance 1 had to be proven in Playwright. A unit assertion on `store.dataOrigin` keeps passing
while the user still opens on „Bună, Andrei" with four demo invoices, „Popescu Andrei" in the topbar and a
CNP in the sidebar. The fix is not a new field; it is that a person with no data sees a screen that asks
them for data.

**D1–D6, and where each went:**

| | Defect | Where it went |
|---|---|---|
| D1 | empty storage hands out the fixture | `loadInitialData()` returns `{ data: emptyData(), dataOrigin: 'empty' }`. `seedData` is reachable only through `loadSandbox()` |
| D2 | `'seed'` was never branched on | `'seed'` is **deleted from the `DataOrigin` union**. The demo is now a distinct origin, `'sandbox'`, and it *is* branched on — the save effect, the banner, and the unload control |
| D3 | `App.tsx` rendered the greeting and the topbar identity unconditionally | both are gated on `!firstRun`; `.topbar-user` and `.greeting` do not exist on a first run |
| D4 | the Settings danger action reset straight back to the fixture | `resetAllData()` clears storage and returns to onboarding, behind a two-step confirmation |
| D5 | there was no onboarding path at all | `src/pages/Onboarding.tsx` |
| D6 | `pfaStartDate` null on a fresh profile → no deadlines, no completeness, no estimate | onboarding **requires** the start date, and `profileCheck` in `domain/completeness.ts` now reports it as missing (§4) |

---

## 2. What a first run is, in the type

```ts
// before
export type DataOrigin = 'seed' | 'persisted' | 'quarantined';
// after
export type DataOrigin = 'empty' | 'persisted' | 'quarantined' | 'sandbox';
```

`'seed'` is gone, not re-purposed. `'empty'` means *storage held nothing*; `'sandbox'` means *the user put
example data on screen during this session*. Those were previously the same value, which is the whole bug.

The gate is one line in `App.tsx`:

```ts
const firstRun = dataOrigin === 'empty';
```

and it decides four things in one place: the sidebar identity block and the topbar user chip are not
rendered, the page title is `onboarding.title` rather than the route title, `<OnboardingPage />` replaces the
route content, and the sandbox banner is available.

**Why the gate is the origin and not a predicate over the records.** A profile with a name and a start date
but no records is **not** a first run — it is a real user who has recorded nothing, and they must land on the
dashboard (that is B-68, §6). A predicate like `records.length === 0` would put them back on the form. The
two states are different facts and they are carried by different values: `dataOrigin` says what storage
holds, `hasRecords` in `pages/Dashboard.tsx` says what the registers hold.

---

## 3. The sandbox: opt-in, in memory, marked where it is seen

`StoreProvider` gained three members and one ref:

- **`loadSandbox()`** — stashes the current `{ data, origin }` in a `useRef` and puts a **deep copy** of
  `seedData` on screen with `dataOrigin: 'sandbox'`. The copy matters: `seedData` is a module constant, and
  handing it out by reference would let one screen mutate the fixture for every later screen.
- **`unloadSandbox()`** — puts the stashed `{ data, origin }` back. The user's own data is exactly what it
  was, because it was never written, only hidden.
- **`sandboxActive`** — `dataOrigin === 'sandbox'`, what the UI reads.

**It cannot reach disk.** The save effect returns early when `dataOrigin === 'sandbox' || dataOrigin ===
'empty'`. That single guard is what makes the sandbox a view rather than a state: it does not survive a
reload, it does not overwrite a real payload, and an empty first run does not get persisted as an empty
shell just to make the next load look `persisted`.

**Marked where it is seen, not only where it was switched on.** `App.tsx` renders, above the main content:

```
div.banner.banner-warn[role="status"][data-sandbox-banner]
  shell.sandboxTitle · shell.sandboxBody · button shell.sandboxRemove
```

The words say what it is (example data), what it is not (your data) and how it leaves (reload, or the
control in Setări). The same control pair also sits in Settings → Date (`settings.data.sandboxLoad` /
`sandboxUnload`), so the state is visible where the data is managed. Onboarding offers it as a labelled
secondary action with the whole `onboarding.demo` block beside it.

---

## 4. D6 — no migration step, and that is the point

**`CURRENT_DATA_VERSION` stays at 10. No chain step was added.**

The obvious move was a `profile-start-date` step that backfilled `pfaStartDate` from the legacy
`pfaStartYear`. It was rejected, and the reason is the rule every step in that chain already follows: **a
migration may re-express a stored fact, it may not mint one.** `pfaStartYear` is a year. Turning 2020 into
`2020-01-19` would invent a registration date the user never recorded, and that date then drives the fiscal
year, the deadline ladder and the projection denominator. The chain's own comments say this in three places
(`profile-1` deliberately leaves `pfaStartDate` absent; the Phase 6 note is quoted at `migration.ts:256`).

What closes D6 instead:

1. **Onboarding requires the date.** A first run cannot proceed without it, and the value is validated by
   `isoCalendarDateProblem`, so a nonexistent calendar day is refused with the validator's own sentence
   rather than a paraphrase.
2. **`profileCheck` in `domain/completeness.ts` was widened**, from „exists, fiscalYear set, regime set" to
   also require `identity.nume` and a usable `pfaStartDate`. An existing install that has no start date now
   sees the fact reported as missing — in the completeness card and in the hero — instead of silently
   rendering an empty page.
3. **The schema stays permissive.** `pfaStartDate` remains optional on the persisted schema, so no existing
   payload is rejected and quarantined for a key it has never heard of (brief landmine 3). Permissive at the
   gate, strict at the report.

**The widened check lives in `completeness.ts`, not in a new predicate, on purpose.** The hero's
„Completează profilul" is driven by `completeness.checks.find(c => c.key === 'profile')` — the *same* report
the completeness card renders. A second completeness model is what this file's header has warned against
since Step 17, and two models drift the first time one of them is fixed.

---

## 5. Onboarding — what it collects, what it defers, what it refuses

`src/pages/Onboarding.tsx` is a form, not a splash.

**Collected** (each written through `updateProfile`, so the next load is a real one):

| Field | Profile path | Note |
|---|---|---|
| Nume | `identity.nume` | required. `identity.denumire` **mirrors it** — a PFA has no legal personality separate from the person, so the trading name is the person's name, not an invented brand |
| CUI · CNP · număr Reg. Com. | `identity.cui` / `.cnp` / `.numarRegComert` | optional; the rest of `identity` is spread through untouched, so a partial patch cannot erase address, bank details or the CAEN list |
| Regim fiscal | `regime` | a radio over all four `PfaRegime` values; three of them route to the refusal screen (§ below). The default is **derived** — `PFA_REGIME_VALUES.find(isComputableRegime)` — not a literal in a page |
| **Data începerii activității** | `pfaStartDate`, and `pfaStartYear` derived from it | **required** |
| TVA înregistrată | `vatExempt` | tri-state `da / nu / not recorded`. `vatExempt` is a required boolean in the model, so an unanswered question keeps the default rather than asserting a third state the type cannot hold |
| Data depășirii plafonului TVA | `vatExceedanceDate` | optional |
| Venit din salarii + sumă | `salaryStatus`, `salaryIncomeLei` | the amount is required when the answer is `da`, and is parsed by `parseLeiInput` |
| Calitate de pensionar + factul de pensie | `pensionerStatus`, `pensionReceiptYears[{fiscalYear, received}]` | the receipt record is attributed to the **current** fiscal year — art. 174 alin. (7) is a per-year fact |
| Venituri din alte surse | `otherIncome: PfaOtherIncomeFlag[]` | flags only |

Every yes/no question offers **„nu înregistrat" first** and writes `undefined` for it, never `nu`. `nu`
asserts the fact was checked and found not to hold; that is a different answer, and it is the same shape
`Settings.tsx` uses.

**Deferred, and said on screen** (`onboarding.deferred`, rendered as its own card so the omission is visible
rather than inferred):

- **The activity declaration — CAEN → activity family.** 12E is blocked on a mapping decision that
  `research/21` §7(c) left undecided. Asking here would manufacture a fact the app cannot yet classify.
- **Other-income *amounts*.** 12F owns them; `PfaOtherIncomeFlag` models the flag only, and there is no
  amount field to write into.

**Refused.** Choosing `norma_venit`, `impozit_pe_cit` or `micro_vat` routes to a screen immediately — a
person never fills the rest of the form to discover the app cannot compute their case. It renders
`div[data-onboarding="refusal"]` with `onboarding.refusal.title` / `body(label)` / `noEstimate` / `back`, and
the *reason* comes from `PFA_REGIME_DESCRIPTORS[regime].note` — the same sentence the engine's own refusal
uses, so the screen cannot state something the engine does not already hold. **No figure is rendered at
all**: no `.stat-card`, no `.tax-hero-value`, no `RON` anywhere in the body. That is pinned in
`e2e/first-run.spec.ts` and in `src/pages/Onboarding.test.tsx`.

**A future start date is accepted, not rejected.** Phase 12 owns the active-period arithmetic and lists
"future start date" as one of its cases. Refusing the date here would decide that phase's question from the
wrong end. **Handed to PG-2 / Phase 12 rather than fixed here:** anything date-shaped beyond
`pfaStartDate` and `vatExceedanceDate` — the `collected` / `paid` money dates (PG-2, see
`phases/26_fx_end_to_end.md` §11) and the active-period rules.

---

## 6. B-68 — the zero-record dashboard, and the hero

`pages/Dashboard.tsx` gated the whole page on `hasData`, which read „zero lei" as „nothing recorded". Now:

- `hasRecords = appData.revenues.length > 0 || appData.expenses.length > 0` — a record that the totals leave
  out is still a record, so a EUR ledger with no rate on record does **not** trigger the card (acceptance 7);
- the zero-record case renders `div.empty-state[data-empty-state]` with `dashboard.noRecords.*` **and the
  rest of the page still mounts**: cockpit, deadlines, thresholds, completeness, actions;
- the block `dashboard.onboarding` — title „Începe înregistrarea activității" — is **deleted, not reworded**.
  It had no production reader left; leaving it in the copy layer is what would let the old page come back.

Acceptance 3: the hero's incomplete-profile state is
`completeness.checks.find(c => c.key === 'profile')?.satisfied === false`, rendering
`dashboard.estimate.completeProfile` („Completează profilul") and `completeProfileBody`. Same report, same
check, no second model.

`src/pages/Dashboard.empty.test.tsx` (6 tests) pins the three things acceptance 6 names — the next deadline,
the profile completeness, the next steps — plus the hero CTA and its absence once the profile is complete.

---

## 7. Settings → Date: the danger action, and the sandbox switch

`settings.data` gained the origin disclosure (`originEmpty` / `originPersisted` / `originQuarantined` /
`originSandbox`, rendered by `from(origin)`), the sandbox card, and the danger card:

- **`dangerAction`** — „Șterge toate datele și începe de la zero". Now a **two-step confirmation**:
  `confirmTitle` / `confirmBody` / `confirmGo` / `confirmCancel`. `confirmBody` names what goes, including
  the quarantined copy, because `resetAllData()` removes `QUARANTINE_STORAGE_KEY` as well as `STORAGE_KEY` —
  „start from zero" says zero.
- Confirming sets `data: emptyData()` and `dataOrigin: 'empty'`, which *is* the first run: the next render is
  `<OnboardingPage />`, not the fixture. Cancelling leaves the payload byte-identical.

`src/pages/Settings.data.test.tsx` (5 tests) pins the gate, the cancel path, the sandbox round trip and that
confirming produces `dataOrigin: 'empty'` with nothing stored.

---

## 8. The fixture is test-only, and the tests say so

Two helpers, one per environment, and both go through the **load path** rather than a module constant:

- **`src/test/storage.ts` → `seedStorage(payload?)`** writes a payload under `STORAGE_KEY`, defaulting to
  `{ ...seedData, version: CURRENT_DATA_VERSION }`. Before Phase 11 a test that wanted data simply rendered
  `<StoreProvider>` over empty localStorage and received the fixture for free. That freebie *was* D1. The
  version stamp is not decoration: `persistedAppDataSchema` refuses a payload with no `version`, and a stale
  one would silently take a migration path the test never intended. The file imports no vitest and no
  `src/test/clock.ts`, so it is safe from a unit test and from an e2e spec alike.
- **`e2e/fixtures.ts` → `seedPayload()`, `seedBrowser(page, payload?)`, `seedBrowserOnce(page, payload?)`.**
  `seedBrowser` uses `addInitScript`, which re-runs on **every** document; `seedBrowserOnce` skips the write
  if the key is already set. **A spec that edits through the UI and then reloads must use
  `seedBrowserOnce`** — otherwise the script re-applies the fixture over what the UI just saved and the round
  trip proves nothing. That trap is now written down in three places because it has bitten this suite twice.

`src/data/seed.test.ts` (10 tests) is the guard that keeps the fixture out of production: `emptyData()` holds
no records anywhere and every identity field is present-and-empty (absence, not a value); `seedData()` is a
function, not a module constant, because `createDefaultProfile` derives `pfaStartYear` / `fiscalYear` /
`updatedAt` from the clock and a constant would freeze them at import; and the fixture's own claims stay
coherent (§10).

---

## 9. Validation

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm run test` | **85 files, 1409 tests, all passing** (exit 0) |
| `npm run build` | **exit 0** |
| `npm run test:e2e` | **49 passed** — 46 functional + 3 axe |

**Mutation checks — the new tests were made to fail, on purpose:**

1. `store.tsx` `loadInitialData()` reverted to `return { data: seedData, dataOrigin: 'seed', … }` →
   **all 7 `e2e/first-run.spec.ts` tests fail**; restored → all 7 pass. The Playwright proof of acceptance 1
   bites; it is not a test that passes because nothing can make it fail.
2. `seed.ts` given one `declarations` record back → `seed.test.ts › emptyData — what a first run actually
   holds › holds no records anywhere` **fails**, and passes again on restore.

**Re-pins, every one replaced rather than deleted, old → new:**

| Where | Old | New | Why |
|---|---|---|---|
| `e2e/dashboard.spec.ts` completeness section | `/im: 1, tva: 1, facturi: 3/` | `/tva: 1, facturi: 3/` | the fixture's 2025 D212 is impossible for a PFA that started in 2026 (§10) |
| `e2e/dashboard.spec.ts` „empty state" spec | heading „Începe înregistrarea activității"; `.stat-card` **count 0**; `h2.card-title` **count 0** | heading „Nicio înregistrare de venit sau cheltuială"; `.stat-card` **not 0**; `h2.card-title` **not 0**; D212 + „Completitudine date" + „Ce trebuie să faci" visible | the old spec asserted the B-68 shape — that nothing renders. Acceptance 6 requires the opposite |
| `e2e/settings.spec.ts` quarantine recovery | `saved.revenues.length` **> 0** | `saved.revenues` **toEqual `[]`** | a user who just lost their data gets an empty dataset, not someone else's invoices |
| `e2e/settings.spec.ts` B-36/B-37 | heading „Începe înregistrarea activității" **count 0** | `[data-empty-state]` **count 0** | the heading is gone; the property — a present-but-excluded record must not trigger the zero-record card — is the same |
| `src/pages/Dashboard.test.tsx` B-36/B-37 | `queryByRole('heading', { name: 'Începe înregistrarea activității' })` null | `document.querySelector('[data-empty-state]')` null | same reason, asserted directly |
| 12 store / page test files | `dataOrigin` **`'seed'`** | **`'empty'`** | a first run is no longer the fixture |
| `e2e/dashboard.spec.ts`, `e2e/settings.spec.ts`, `e2e/a11y.spec.ts` | relied on the app loading its own fixture | load it explicitly through `e2e/fixtures.ts` | there is no built-in dataset to rely on. The axe gate now seeds, or it would scan the first-run screen while claiming to scan `/dashboard` |

**No matcher was loosened, no assertion deleted without the replacement above it, no timeout widened.**

---

## 10. The fixture's own coherence (acceptance 4)

`data/seed.ts` was rewritten, not trimmed:

- **A 2026 PFA.** `pfaStartYear: 2020 → 2026`, and `pfaStartDate: '2026-01-19'` added. Every recorded
  document is dated **after** that start: revenues moved from Sept to **02.02 / 10.04 / 18.06**, expenses
  from Sept to **05.03 / 12.05 / 20.07**, `doc1` to 02.02, `doc3` (the contract) to 26.01.
- **No prior-year filing.** `doc2` — „Declarația 212 – venitul anului 2025", filed 20.05.2026 — is removed,
  and with it the `statements` row `s1` and the `companyDocs.im` entry. TASK 9 emptied `declarations` but
  left this document behind, and it is worse than fictional: it is **impossible**. A PFA registered on
  19.01.2026 has no 2025 income year to declare, and CF art. 122 alin. (3) asks for the return of the year
  that produced the income. `companyDocs` is now `{ im: [], cs: [], tva: [], facturi: [] }` and the
  completeness section says so — `tva: 1, facturi: 3`, `cs` absent because it is empty.
- **No SRL remnants.** `formaJuridica` and the trading name are a persoană fizică autorizată; `numarRegComert`
  stays because a PFA *is* ONRC-registered.
- **No seeded FX rate.** `fxRates` is **absent rather than `[]`**: „no rate has been recorded" and „rates were
  fetched and none existed" are different facts, and a seeded rate would be a fabricated legal datum with a
  source nobody cited.
- **`emptyData()` is exported and is what a first run holds**: no records anywhere, and an identity block
  where every field is present and empty — absence, not a missing key.

**No money figure in the fixture moved.** Deductible 120,00 / 144,00 lei, VNA 9.096,00, impozit 819,00,
total 3.249,00 at the pinned clock, reserve 1.083,00, year-end 3.112,00, hero 51.510 lei are all still
green. The fixture lost documents and a filing, not amounts.

**One claim in the brief that does not reproduce, recorded rather than patched.** The brief lists `caen` and
`pensionStatus` among the profile fields the engine reads. `pensionStatus` — that spelling — has **no reader
anywhere**: it was deprecated and renamed to `pensionerStatus` in pre-Phase-11 TASK 5, and the source-tree
scan in `src/domain/pensionFacts.test.ts` allows the identifier only in `models.ts`, `schema.ts` and
`data/migration.ts`. That scan passes unchanged, and the current name `pensionerStatus` *is* collected by
onboarding. `caen` reaches no calculator directly. Nothing was changed on the strength of the brief's wording.

---

## 11. Refused, and out of scope

- **No preloaded data, no banner-on-demo compromise.** D-SEED-2 is decided; this phase implements it.
- **No migration step, no data-version bump** (§4). No calculator, rule value, registry, digest or FX-layer
  change.
- **`src/domain/date.ts`, `src/test/clock.ts` and `src/test/fixedInstant.ts` were not touched.** Every new
  test uses `pinClock()` / `fixedInstant()`; no date constant was invented.
- **No e2e spec was deleted.** `dashboard.spec.ts` and `settings.spec.ts` were adapted to seed explicitly;
  the specs that assert the fixture still assert the fixture.
- **`demoMode` is deliberately not persisted.** A sandbox that survives a reload is a lie about what the
  user's data is.

---

## 12. NEXT HANDOFF

**For PG-1 (production build), PG-2 (CRUD) and PG-6 / 12E / 12F:**

1. `dataOrigin === 'empty'` is the single first-run gate, and it lives in `App.tsx`. Any new page renders
   inside it or is unreachable; there is no third state to fall into.
2. `e2e/fixtures.ts` is now the only place an e2e spec builds a payload, and `src/test/storage.ts` is the
   unit equivalent. **`seedBrowserOnce` for any spec that writes through the UI and reloads.**
3. Onboarding collects the facts the engine reads and **defers the activity declaration to 12E** (blocked on
   the CAEN → activity-family mapping that `research/21` §7(c) left undecided) and **other-income amounts to
   12F**. Both deferrals are stated on screen, in `onboarding.deferred`, so a user is not left to discover
   them.
4. `pfaStartYear` is still parsed and still derived by `createDefaultProfile`, but **nothing writes it from a
   user answer any more** — onboarding derives it from `pfaStartDate`. Once PG-2's screens are in, it can be
   retired through a chain step; that step belongs to PG-2, not here.
5. **Anything date-shaped goes to PG-2**, not to a quick fix: the `collected` / `paid` money dates
   (`phases/26_fx_end_to_end.md` §11), the future-start-date and active-period arithmetic (Phase 12), and the
   VAT periodicity datum behind the D300 row (**D-VAT-1**, `phases/23` §5). None of them was touched here.
6. The zero-record dashboard is the shape every screen must now follow: report the absence, keep the
   deadlines, the completeness and the next steps on screen. **B-68 is closed for the dashboard only** — the
   other pages have not been checked against it.
