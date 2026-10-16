# Step 25 — Regression Fixes

## Status
complete

## Objective
Fix ONLY the five confirmed cross-page defects from the Task 4 defect report (`docs/ai/steps/04_defect_scout.md`), add one focused regression test for each, and preserve all existing behavior outside those defects. No unrelated refactoring, no page/store redesign, no new features.

## Defects fixed

| # | Defect | Verdict | Fix | Files changed |
|---|--------|---------|-----|---------------|
| 1 | Client edit creates a duplicate | Confirmed | Added `updateClient` to the store; `ClientForm.onSave` branches on edit vs new | `src/data/store.tsx`, `src/pages/Clients.tsx`, `src/pages/Clients.test.tsx` |
| 2 | Declaration edit creates a duplicate | Confirmed | Added `updateDeclaration` to the store; `DeclForm.onSave` branches on edit vs new | `src/data/store.tsx`, `src/pages/Declarations.tsx`, `src/pages/Declarations.test.tsx` |
| 3 | Settings "Salvează" not persisting | **Not a defect** (already persists) | Test-only — locked in the existing persistence behavior | `src/pages/Settings.test.tsx` |
| 4 | Revenue Back/Forward tab desync | Confirmed (edge case) | Sync effect now resolves to the canonical default `registered` when `initialTab` is null/invalid | `src/pages/Revenues.tsx`, `src/pages/Revenues.test.tsx` |
| 5 | Identity/topbar hardcoded | Confirmed | Topbar reads `profile.identity.nume` + computed initials from the store | `src/App.tsx`, `src/App.test.tsx` |

## What changed

### Defect 1 — Client edit updates in place
- `src/data/store.tsx`: added `updateClient: (c: Client) => void` to `StoreValue`; implementation maps over `clients` and replaces the entry with matching `id`.
- `src/pages/Clients.tsx`: `ClientForm.onSave` now branches — when `editing` is set it calls `updateClient({ ...editing, ...c })`, otherwise `addClient`. Create path unchanged.

### Defect 2 — Declaration edit updates in place
- `src/data/store.tsx`: added `updateDeclaration: (d: Declaration) => void` to `StoreValue`; implementation maps over `declarations` and replaces the entry with matching `id`.
- `src/pages/Declarations.tsx`: `DeclForm.onSave` now branches — when `editing` is set it calls `updateDeclaration({ ...editing, ...d })`, otherwise `addDeclaration`. Create path unchanged.

### Defect 3 — Settings persistence (test-only)
- No source change. The existing `Settings` save path already writes company data to `localStorage` through the store's persistence layer; the Task 4 report marked the "not persisting" claim disproven.
- Added a focused regression test that locks in the behavior so it cannot regress.

### Defect 4 — Revenue Back/Forward tab sync
- `src/pages/Revenues.tsx`: the tab-sync effect previously guarded with `if (initialTab && ...)`, so a bare `/revenues` URL (`initialTab === undefined`, e.g. via the sidebar "Venituri" link / browser Back) left the previously-selected tab highlighted. The effect now computes `next = initialTab && TABS.some(t => t.key === initialTab) ? initialTab : 'registered'` and syncs (tab + page reset) whenever `next` differs from the current tab. Initial state uses the same resolution.

### Defect 5 — Identity from one coherent profile source
- `src/App.tsx`: added `useStore` to the existing `./data/store` import; destructured `profile` in the app-shell component; added an `initials(name)` helper. The topbar now renders `profile.identity.nume` and `initials(profile.identity.nume)` (the "PI" avatar) from the seeded store profile, replacing the hardcoded "Popescu Ion" / "PI" literals.

## Regression tests added

| Test file | Test(s) |
|-----------|---------|
| `src/pages/Clients.test.tsx` | "editing a client updates it in place instead of duplicating it" |
| `src/pages/Declarations.test.tsx` | "updates an existing declaration in place instead of duplicating it" |
| `src/pages/Settings.test.tsx` | "persists company settings to localStorage on 'Salvează'"; "restores saved company settings on remount" |
| `src/pages/Revenues.test.tsx` | "resets to the default 'Înregistrate' tab on bare /revenues (Back)"; "syncs the active tab to a valid URL tab (Forward)"; "defaults to 'Înregistrate' on mount at /revenues" |
| `src/App.test.tsx` | "shows the seeded identity from the store, not the old hardcoded name" |

## Verification

- `npx tsc --noEmit` — pass (exit 0)
- `npm run build` (vite) — pass (1.49s); only the pre-existing chunk-size >500 kB warning (cosmetic, present before this step)
- `npx vitest run` — 239 tests passed (26 files), 0 failures

## Constraints honored
- Only the five confirmed defects touched; no unrelated refactoring, no page/store redesign, no new features.
- Defect 3 required no code change (behavior already correct); a test locks it in.
- `updateClient` / `updateDeclaration` added additively to the existing store; no existing method signatures changed.

## Limitations
- One benign React `act()` warning in `src/App.test.tsx` (the Shell mount-time URL-normalization effect runs outside `act`); cosmetic, consistent with the existing page-test style, no result impact.
- The `Dashboard.tsx` modification visible in `git status` is pre-existing Steps 17–24 dashboard work, not a Step 25 change.

## Files changed
- `src/data/store.tsx` — added `updateClient` + `updateDeclaration` (interface + implementation)
- `src/pages/Clients.tsx` — `ClientForm.onSave` edit-vs-new branch
- `src/pages/Declarations.tsx` — `DeclForm.onSave` edit-vs-new branch
- `src/pages/Revenues.tsx` — tab-sync effect resolves to default `registered` on bare/invalid URL
- `src/App.tsx` — topbar identity from store profile + `initials()` helper
- `src/pages/Clients.test.tsx` — edit regression test
- `src/pages/Declarations.test.tsx` — edit regression test
- `src/pages/Settings.test.tsx` — persistence regression tests
- `src/pages/Revenues.test.tsx` — tab-sync regression tests
- `src/App.test.tsx` — identity regression test
- `docs/ai/steps/25_regression_fixes.md` — this document
