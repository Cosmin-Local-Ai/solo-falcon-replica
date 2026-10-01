# Step 04 — Defect Verification (Local Repository Scout)

> **PATCH NOTE (2026-09-30):** Line numbers and code paths below were updated against the current `src/data/store.tsx`, `src/pages/Dashboard.tsx`, `src/App.tsx`, and `src/data/types.ts`. The store has since gained `updateRevenue`/`updateExpense` plus delete primitives and a shared `uid()` counter, and the Dashboard now filters totals by `inregistrata` and computes `sold` as a monetary difference. Issues 1 and 2 remain **CONFIRMED** (the store still has no `updateClient`/`updateDeclaration`).

Date: 2026-09-30
Scope: local files only, no code changes. Each previously reported issue was re-verified against the current source.

## Summary

| # | Issue | Verdict | In Dashboard work? |
|---|-------|---------|--------------------|
| 1 | Client edit creates duplicate | **CONFIRMED** | No |
| 2 | Declaration edit creates duplicate | **CONFIRMED** | No |
| 3 | Settings Save not persisting | **NOT CONFIRMED** (persists fine) | No |
| 4 | Revenues Back/Forward leaves wrong tab | **CONFIRMED (edge case)** | No |
| 5 | User identity duplicated/hardcoded | **CONFIRMED (2 places, divergent)** | No |
| 6 | Dashboard business calculations in UI code | **PARTIALLY CONFIRMED** (no YTD/monthly/projection anymore; totals/counts still inline) | Yes (the remaining part) |

Note: the previous context note "store uses useState only — NO persistence" is **outdated/incorrect**. `src/data/store.tsx` persists to `localStorage` (`pfa-app-data-v2`) on every data change (lines 55–57).

---

## Issue 1 — Client editing creates a duplicate instead of updating

- **File:** `src/pages/Clients.tsx` (also `src/data/store.tsx`)
- **Component/function:** `ClientForm` (its `onSave`), plus `Clients` list `onEdit`.
- **Code path:**
  - `onEdit`: `setEditing(client); setFormOpen(true)` — opens the form in edit mode.
  - `ClientForm` `onSave`: `addClient(data)` — **unconditionally**, whether or not the form was opened with `initial` set.
  - `store.tsx` `addClient` (line 88): always appends with a new id from the shared `uid()` counter (line 35). There is **no `updateClient`** action in the store.
- **Current behavior:** clicking "Edit" on a client, changing fields, and saving adds a *second* client row; the original row remains unchanged.
- **Likely cause:** the form has edit state (`initial`) but its save handler was never wired to an update action; the store lacks an update primitive for clients.
- **Definitely confirmed:** YES — deterministic from code reading; no conditional path exists that would update in place.
- **Part of Dashboard work:** NO. Belongs to a Clients/store step.

## Issue 2 — Declaration editing creates a duplicate instead of updating

- **File:** `src/pages/Declarations.tsx` (also `src/data/store.tsx`)
- **Component/function:** `DeclForm` (its `onSave`), plus `Declarations` `onEdit`.
- **Code path:**
  - `onEdit`: `setEditing(decl); setFormOpen(true)`.
  - `DeclForm` `onSave`: `addDeclaration(data)` — **unconditionally**.
  - `store.tsx` `addDeclaration` (line 90): always prepends a new declaration with an id from the shared `uid()` counter (line 35). There is **no `updateDeclaration`** action.
- **Current behavior:** editing a declaration (e.g. changing month, amounts, status) and saving appends a new declaration row; the original stays as-is.
- **Likely cause:** same pattern as Issue 1 — form supports prefill but save always calls the add action; no update primitive in the store.
- **Definitely confirmed:** YES — deterministic.
- **Part of Dashboard work:** NO. Belongs to a Declarations/store step.

## Issue 3 — Settings "Save" may not persist settings

- **File:** `src/pages/Settings.tsx` (also `src/data/store.tsx`)
- **Component/function:** `Settings` (form fields + "Salvează" button), `store.tsx` `updateSettings`.
- **Code path:**
  - Save button: `updateSettings(settings)` where `settings` is the full local copy of `store.settings`.
  - `store.tsx` `updateSettings` (lines 113–116): `setData(d => ({ ...d, settings: next }))` — shallow merge at top level; the page passes the whole `settings` object, so the merge is complete.
  - `store.tsx` persistence effect (lines 55–57): every `setData` writes `localStorage.setItem('pfa-app-data-v2', JSON.stringify(data))`.
- **Current behavior:** saving settings **does** persist — both to React state and to localStorage; the values survive a page reload.
- **Likely cause of the original report:** the earlier scout assumed the store had no persistence. That premise was wrong; the store does persist.
- **Definitely confirmed:** NOT a defect — **disproven** by current code.
- **Part of Dashboard work:** N/A — no fix needed.

## Issue 4 — Revenues browser Back/Forward may leave the wrong tab selected

- **Files:** `src/pages/Revenues.tsx`, `src/App.tsx`
- **Component/function:** `Revenues` (`tab` state + sync `useEffect`), `App` `Shell` (`navigate`, `parseRoute`, popstate/hashchange handlers).
- **Code path:**
  - Tab button click: `setTab(key)` **and** `onTabChange(key)` → `navigate('revenues', key)` → `pushState` + `setRoute` → new `initialTab` prop → sync effect sees matching tab → no-op. OK.
  - Browser Back/Forward: `popstate`/`hashchange` → `setRoute(parseRoute())` → `initialTab` prop changes → sync effect runs `setTab(initialTab); setPage(1)`. Works **when the URL contains a valid tab key** (`#/registered`, `#/pending`, `#/rejected`).
  - **Edge case:** going back to the bare `/revenues` URL (no hash) — e.g. via the sidebar "Venituri" link, which calls `navigate('revenues')` with `tab = null` — makes `initialTab` **undefined**. The sync effect's guard `if (initialTab && ...)` then does nothing, so `tab` stays at whatever it was (e.g. `pending`). The URL shows no tab (canonical default is `registered`) while the UI keeps the previous tab highlighted.
- **Current behavior:** after leaving a non-default tab and returning to `/revenues` without a tab hash, the previously selected tab stays selected instead of resetting to the default `registered`.
- **Likely cause:** the sync effect only reacts to *valid* `initialTab` values and has no branch for `initialTab == null` (i.e. "reset to default").
- **Definitely confirmed:** YES for this edge case (deterministic from code). The common Back/Forward-between-tab-URLs path works correctly.
- **Part of Dashboard work:** NO. Belongs to a Revenues/routing step.

## Issue 5 — User identity duplicated/hardcoded in several places

- **Files:** `src/App.tsx`, `src/data/seed.ts`
- **Component/function:** `Shell` topbar (App.tsx); `seedData.settings.personal` (seed.ts).
- **Code path / current state:**
  - `App.tsx` topbar hardcodes `<span>Popescu Ion</span>` and avatar `PI`. It does **not** read `settings.personal` from the store.
  - `seed.ts` seeds `settings.personal.nume = 'Popescu Andrei'` (with CNP, address, phone, email).
  - No other file hardcodes a user name (grep for name literals across `src/` finds only these two places).
- **Current behavior:** the displayed identity ("Popescu Ion") is hardcoded and **diverges** from the seeded personal identity ("Popescu Andrei"). Editing the personal name in Settings has no effect on the topbar.
- **Likely cause:** the topbar was written with a literal placeholder name instead of reading `settings.personal` from the store.
- **Definitely confirmed:** YES — two places, hardcoded, and mutually inconsistent. ("Several places" from earlier reports is an overcount; it is exactly two.)
- **Part of Dashboard work:** NO. Belongs to an App-shell/Settings step (topbar should render `settings.personal.nume`).

## Issue 6 — Dashboard business calculations exist directly in UI code

- **Files:** `src/pages/Dashboard.tsx`, `src/data/types.ts`
- **Component/function:** `Dashboard` (derived values computed in the component body, lines 10–17).
- **Code path:**
  - `revTotal = revenues.filter(r => r.status === 'inregistrata').reduce((s, r) => s + total(r), 0)`
  - `expTotal = expenses.filter(e => e.status === 'inregistrata').reduce((s, e) => s + total(e), 0)`
  - `sold = revTotal - expTotal` (a monetary difference, not a count)
  - `pendingRev = revenues.filter(r => r.status === 'in-asteptare').length`
  - `respins = revenues.filter(r => r.status === 'respinsa').length + expenses.filter(e => e.status === 'respinsa').length`
  - `declPENDING = declarations.filter(d => d.status === 'in-asteptare').length`
  - `recent = [...revenues].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)`
- **Current behavior:** all business metrics are computed inline in the UI component. Formatting helpers (`fmtRON`, `fmtDate`, `total`) are centralized in `types.ts` and imported — good. But the metric derivations (totals, status counts, recent-docs ordering) have no shared helpers and would have to be duplicated by any other page that needs them (e.g. a future reports view).
- **Likely cause:** Dashboard was built as a self-contained page; no `src/data/metrics.ts`-style module was extracted.
- **Definitely confirmed:** PARTIALLY.
  - The earlier claim of "inline YTD/monthly/projection calculations" is **no longer true** — the current Dashboard has no YTD, monthly, or projection math at all.
  - The general claim (business calculations living in UI code without shared helpers) **remains true** for totals/counts/recent-docs.
- **Part of Dashboard work:** YES for the remaining part — extracting these metrics into a shared helper module is natural Dashboard work. (Issues 1, 2, 4, 5 are out of scope for Dashboard.)

---

## Additional observations (not in the original list)

- **Store has partial update coverage** (`src/data/store.tsx`): `updateRevenue` (line 81) and `updateExpense` (line 85) exist, along with `deleteRevenue`/`deleteExpense`/`deleteDocument`/`deleteStatement` — but there is **no `updateClient`** and **no `updateDeclaration`**. That gap is the root cause shared by Issues 1 and 2; fixing both requires adding `updateClient`/`updateDeclaration` (or a generic `updateItem`).
- **Helper duplication is minimal now:** `fmtDate`/`fmtRON`/`total` are defined once in `types.ts` and imported by pages (`parseRO`/`fmtRO`/`LUNILE`/`monthKey` do **not** exist in `types.ts`). `LUNILE` is defined locally in `Declarations.tsx`. The earlier note about 6-file/4-file/3-file duplication referred to usage, not definitions — no action needed.
- **`App.tsx` `VALID_TABS.documents`** lists `['company', 'statements', 'reports']` while `Documents.tsx` defines tabs `company`, `statements`, `toate` — the `reports` key is dead and `toate` is not in the whitelist, so `/documents#!/toate` in the URL silently falls back to `company`. Minor routing inconsistency, related in spirit to Issue 4.
