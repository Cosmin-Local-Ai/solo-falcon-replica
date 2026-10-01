# QA Report — Cheltuieli (Expenses) Page (Priority 6)

**Date:** 2026-09-29
**Scope:** `src/pages/Expenses.tsx`, `src/data/store.tsx`, `src/data/types.ts`, `src/data/seed.ts`
**Method:** Live browser testing against `http://localhost:5173/expenses` (Vite dev server, session `qa-expenses` via agent_browser). Phase 1 baseline — no source modifications made.

## Page Under Test (replica)

- 6 seed expenses: 5 `înregistrată` + 1 `respinsă` (BF-08-3310, with rejection reason)
- Two status tabs with live counts: **Înregistrate** / **Respinse**
- Table columns: DOCUMENT / TIP / FURNIZOR / CUI / DATA / FĂRĂ TVA / TVA / TOTAL / STATUS / (Șterge)
- Create/edit modal: tip document, număr, dată, furnizor, CUI, valoare fără TVA, TVA, status (+ rejection reason when `Respinsă`)
- Search box: "Caută după nr. sau furnizor…"
- Persistence via localStorage key `solo-replica-data-v2` (expense number field: `nr`)
- `ExpenseStatus` type: `'inregistrata' | 'respinsa'` only — no pending status

## Test Results

| # | Test | Result |
|---|------|--------|
| T1 | Initial render — Înregistrate tab, 5 seed rows, all 9 columns + actions | ✅ PASS |
| T2 | Respinse tab — 1 rejected row (BF-08-3310) with reason, badge styling | ✅ PASS |
| T3 | Add expense (FCT-09-QA01 created; total auto-computed 100,00 + 21,00 = 121,00 RON; tab count 5→6; modal closes) | ✅ PASS |
| T4 | Form validation — empty submit blocked; negative amount & non-numeric TVA rejected with inline messages | ✅ PASS |
| T5 | Summary/totals display | ⚠️ NOTE — no summary statistics (see notes) |
| T6 | Persistence — created expense survives reload, stored in `solo-replica-data-v2` | ✅ PASS |
| T7 | Status change → Respinsă — rejection-reason field appears, value persists | ✅ PASS |
| T8 | Correction Respinsă → Înregistrată — status reverts | ⚠️ PASS w/ note — stale `statusDetail` (see notes) |
| T9 | Search/filter by number or supplier — filters rows, clears correctly | ✅ PASS |
| T10 | Responsive — 1280px clean; 390px layout overflow | ⚠️ ISSUE — mobile overflow (see notes) |
| T11 | Network — zero external calls; all traffic localhost:5173 only | ✅ PASS |
| T12 | Back/forward navigation with hash change (`#!/registered` ↔ `#!/rejected`) | ✅ PASS |

**Additional (unplanned):** Delete flow — row removed, count decrements, toast shown, **no confirmation dialog** (see notes). Delete persistence verified (survives reload).

## Failures & Notes

### 1. Mobile layout overflow at 390px (T10) ⚠️

At a 390×844 viewport the sidebar stays fixed at 220px (no collapse/breakpoint), leaving only ~170px for main content. The ~1008px-wide table overflows its card and produces horizontal scroll at the main-content level. At 1280px everything fits cleanly.

**Repro:** set viewport to 390×844 → open `/expenses` → observe sidebar width, main content width, and horizontal scrollbar under the table. Screenshots: `docs/screenshots/qa-expenses-t10-mobile-390.png`, `docs/screenshots/qa-expenses-t10-desktop-1280.png`.

### 2. Stale `statusDetail` after correction (T8) ⚠️

Reverting a `respinsă` expense back to `înregistrată` leaves the rejection reason (`statusDetail`) in the stored data — it is never cleared on status change.

**Repro:** edit a row → status `Respinsă` + reason → save; edit the same row → status `Înregistrată` → save; inspect `localStorage['solo-replica-data-v2']` — `statusDetail` is still present on the `inregistrata` record.

### 3. Delete has no confirmation (destructive action) ⚠️

The per-row Șterge button deletes immediately with only a toast — no confirm dialog. The Clients page (Priority 5) uses a `window.confirm()` guard, so this is an inconsistency within the replica.

**Repro:** any row → click Șterge → row is gone (no prompt).

### 4. No CUI format validation (T4) ⚠️ (minor)

CUI is an optional field and accepts any string — `ABC` was saved without warning. No format check (e.g. `RO` prefix / digit pattern) is applied.

**Repro:** open create modal → CUI = `ABC` → save → row created with `ABC` as CUI.

### 5. No summary statistics (T5) ℹ️

The page shows only tab counts — no total amounts, monthly aggregates, or per-supplier totals. Informational; consistent with a baseline replica, not a bug.

### 6. No "pending" status ℹ️

`ExpenseStatus` is only `'inregistrata' | 'respinsa'` (`src/data/types.ts:2`). There is no in-asteptare/pending state for expenses (unlike `RevenueStatus`, which has three states). Matches the current type definition — informational.

## Test-Harness Notes (not app bugs)

- **Date fill:** programmatic fill of the date input did not take effect on the React controlled input (T3/T6); the expense saved with the default date. Verified via localStorage, not the form.
- **Empty search fill:** filling the search box with an empty string via the tool did not clear the filter; real keystrokes (Backspace) clear it correctly. T9 re-verified with keystrokes.
- **Stale ref click:** one delete click landed on a stale ref and hit the Respinse tab button instead of the row's delete button; a follow-up delete then removed the seed row BF-08-3310. Restored from the canonical seed in `src/data/seed.ts`.

## Final State

App left in clean canonical state: 6 seed expenses in localStorage (5 `înregistrată` + 1 `respinsă`, BF-08-3310 with its original reason), matching `src/data/seed.ts`. No source files modified.
