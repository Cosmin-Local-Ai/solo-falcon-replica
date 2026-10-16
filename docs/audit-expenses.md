# Code Audit — Expenses (Priority 6, Phase 1)

Read-only audit of the current local Expenses implementation.
Date: 2026-09-29. Project root: `/c/AI/projects/pi-test`.

---

## 1. Expense model

`src/data/types.ts:2` — `ExpenseStatus`:

```ts
export type ExpenseStatus = 'inregistrata' | 'respinsa';
```

Only **two** status values: `inregistrata`, `respinsa`. (No `in-asteptare` — unlike `RevenueStatus` at `types.ts:1`, which has three.)

`src/data/types.ts:23-33` — `Expense` interface, every field:

| Field | Type | Default (in `ExpenseForm`, `Expenses.tsx:29-35`) |
|---|---|---|
| `id` | `string` | `crypto.randomUUID()` (only on create) |
| `tip` | `'factura' \| 'bon-fiscal'` | `'factura'` |
| `nr` | `string` | `''` |
| `date` | `string` (ISO date) | today (`new Date().toISOString().slice(0,10)`) |
| `furnizor` | `string` | `''` |
| `cui` | `string` | `''` |
| `valoareFaraTva` | `number` | `0` |
| `tva` | `number` | `0` |
| `status` | `ExpenseStatus` | `'inregistrata'` |
| `statusDetail` | `string?` | `''` |

Supporting maps: `STATUS_LABEL.expense` (`types.ts:181-184`): `inregistrata → 'Înregistrată'`, `respinsa → 'Respinsă'`. `statusBadge()` (`types.ts:191-195`): `inregistrata → badge-success`, `respinsa → badge-danger`.

**No attachment/file fields** (no document name, file, or content field).

## 2. What the page renders

`src/pages/Expenses.tsx`:

- **Title** (line 170): `Cheltuieli`, subtitle (line 171): `Facturi și bonuri fiscale primite de la furnizori.`
- **Tabs** (lines 8-11) — exactly 2, with **English hash keys**:

  | Tab key (hash value) | Label | Status filter |
  |---|---|---|
  | `registered` | Înregistrate | `inregistrata` |
  | `rejected` | Respinse | `respinsa` |

  Tab change writes `history.replaceState` with `#!/<key>` (lines 39-43).
- **Table columns** (lines 195-203): `Document`, `Tip`, `Furnizor`, `CUI`, `Data`, `Fără TVA`, `TVA`, `Total`, `Status`, (empty actions column).
- **Buttons**: search input `Caută după număr sau furnizor…` (line 177); `+ Adaugă cheltuiala` (line 179); per-row `Șterge` (line 233). Rows are clickable to edit (line 210).
- **tfoot** (lines 236-241): total count + total `Total lei` across the filtered set.
- Status cell (lines 225-229): `<Badge>` with `STATUS_LABEL.expense[status]`, plus a muted sub-line with `statusDetail` when present.
- **Pagination** (line 250): `PAGE_SIZE = 8` (line 13).
- Empty state: `Empty` with `+ Adaugă cheltuiala` action (lines 205-209).

## 3. Add / edit / delete

All three exist:

- **Add**: `+ Adaugă cheltuiala` → `ExpenseForm` modal (lines 253-256).
- **Edit**: click a table row → same modal prefilled (lines 210, 257-260). No dedicated per-row "Edit" button — row click only.
- **Delete**: per-row `Șterge` button, `deleteExpense` + toast (lines 233-235, 262-265).

`ExpenseForm` fields (lines 49-116): `nr`, `date`, `furnizor`, `cui`, `valoareFaraTva`, `tva`, `status` (select: `inregistrata` / `respinsa`), and `statusDetail` (textarea, shown only when status ≠ `inregistrata`, placeholder `motivul respingerii…`, lines 109-114).
Validation (lines 39-44): `nr`, `date`, `furnizor` required; `valoareFaraTva ≥ 0`; `tva ≥ 0`.

## 4. Upload / attachment

**Nothing exists.** No file input, no attachment fields, no upload button anywhere in `Expenses.tsx` or the model.

Reference expectations that are missing:

- `docs/reference/extracted/demo-expenses.txt` shows the real page with:
  - `Cum deduc cheltuieli` (help link) — **missing**
  - `Încarcă cheltuieli` (upload button) — **missing**
- `docs/reference/product-research.md:13` describes the real product as "expense tracking with photo upload".

## 5. Rejection handling

- **Rejection reason field: yes** — `statusDetail?: string` (`types.ts:32`).
- Displayed as a muted sub-line under the status badge (`Expenses.tsx:226-229`).
- Editable in the form when status is not `inregistrata` (`Expenses.tsx:109-114`).
- Seed example: `e4` — `statusDetail: 'Bon fiscal fără mențiunea CUI'` (`seed.ts:25`).
- **Correction/retry: no.** There is no "re-încarcă" / re-upload / retry action. The only way to change a rejected expense's status is opening the edit form and flipping the status select. (Same limitation as `Revenues.tsx`.)

## 6. Persistence

`src/data/store.tsx`:

- **Key**: `solo-replica-data-v2` (line 42). Note: `docs/FINAL-AUDIT.md:11` says `solo-replica-data-v1` — the doc is stale; the code uses `v2`.
- **What is persisted** (lines 109-117): `revenues`, `expenses`, `clients`, `declarations`, `companyDocs`, `statements`, `settings` — written to localStorage on every change.
- **Seed vs user data**: seed (`seed.ts:21-28`, `seedExpenses` = 6 entries `e1`–`e6`) is used only as initial state when no persisted data exists (`store.tsx:69-78`). Once the user saves, their data fully replaces the seed.

## 7. Hash routing

`src/App.tsx`:

- `PAGES` includes `expenses` (line 35).
- `VALID_TABS.expenses = ['registered', 'rejected']` (line 40).
- `parseRoute` (lines 69-77) drops any hash not in `VALID_TABS[page]`.
- URL-normalization effect (lines 167-175) rewrites the URL to drop invalid hashes.

**Currently supported for `/expenses`:**

| URL | Result |
|---|---|
| `/expenses` | default tab `registered` (`Expenses.tsx:102`) |
| `/expenses#!/registered` | `registered` tab ✅ |
| `/expenses#!/rejected` | `rejected` tab ✅ — **the required deep link works** |
| `/expenses#!/inregistrata` | ❌ dropped → falls back to `registered` tab |
| `/expenses#!/respinsa` | ❌ dropped → falls back to `registered` tab |

**Mismatch with the reference route map**: `docs/FINAL-AUDIT.md` (route map table) says `/expenses` has canonical hash tabs `inregistrata`, `respinsa`, with English aliases `registered`→`inregistrata`, `rejected`→`respinsa`. The current implementation has it **backwards**: English keys are canonical, Romanian values are not accepted at all. So `/expenses#!/inregistrata` and `/expenses#!/respinsa` resolve to nothing (silent fallback to the registered tab).

**Comparison with other pages**:

- `Revenues.tsx:9-12` + `App.tsx:39` use the same English-key convention (`registered`/`pending`/`rejected`).
- `Declarations.tsx:8-12` uses **Romanian** keys directly (`inregistrata`, `in-asteptare`, `transmisa`, `respinsa`) with `App.tsx:41` matching — a third, inconsistent convention.

## 8. Search / filter / sort / pagination

`src/pages/Expenses.tsx`:

- **Search**: case-insensitive substring on `nr` + `furnizor` (lines 78-81).
- **Filter**: by status tab (lines 82-84).
- **Sort**: fixed date-descending (line 87). No column-sort controls.
- **Pagination**: `PAGE_SIZE = 8`, `Pagination` component (lines 13, 85-86, 250).
- No period/year filter (the real SOLO dashboard has an `Afișează 2025` period selector per `product-research.md`).

## 9. Gap list (vs. reference expectations)

1. **Hash tab values** — canonical keys are `registered`/`rejected` (`App.tsx:40`, `Expenses.tsx:8-11`), but `docs/FINAL-AUDIT.md` specifies canonical `inregistrata`/`respinsa` with English aliases. Deep links `/expenses#!/inregistrata` and `/expenses#!/respinsa` do **not** resolve (silent fallback to `registered`). The required deep link `/expenses#!/rejected` **does** resolve.
2. **Missing `Încarcă cheltuieli` button** — no upload/attachment feature at all (`demo-expenses.txt`; `product-research.md:13` "expense tracking with photo upload").
3. **Missing `Cum deduc cheltuieli` help link** (`demo-expenses.txt`).
4. **No rejection correction/retry workflow** — no re-upload/retry action; status change only via the edit form (`Expenses.tsx:105-114`).
5. **No attachment fields on the `Expense` model** (`types.ts:23-33`).
6. **No `in-asteptare` status for expenses** — only 2 statuses (`types.ts:2`). Consistent with the 2-tab audit, but asymmetric with Revenues (3 statuses).
7. **No sort controls** — fixed date-descending (`Expenses.tsx:87`).
8. **No explicit per-row edit button** — edit is row-click only (`Expenses.tsx:210`).
9. **Stale doc**: `docs/FINAL-AUDIT.md:11` says storage key `solo-replica-data-v1`; code uses `solo-replica-data-v2` (`store.tsx:42`).
10. **Inconsistent tab-key conventions across pages** — Expenses/Revenues use English keys, Declarations uses Romanian keys (`App.tsx:39-42`).

## Files inspected

- `src/pages/Expenses.tsx` (full, 268 lines)
- `src/data/types.ts` (full, 196 lines)
- `src/data/store.tsx` (full, 159 lines)
- `src/data/seed.ts` (full, 57 lines)
- `src/App.tsx` (full, 269 lines)
- `src/main.tsx` (full, 11 lines)
- `src/components/ui.tsx` (component inventory: `Card`, `StatCard`, `Badge`, `Modal`, `Empty`, `Toasts`, `Pagination`)
- `src/pages/Revenues.tsx` (full, 309 lines — comparison)
- `src/pages/Declarations.tsx` (partial — tab keys)
- `docs/reference/extracted/demo-expenses.txt` (full)
- `docs/reference/extracted/demo-expenses_home.txt` (redirect stub, no content)
- `docs/reference/extracted/demo-revenues.txt` (full — comparison)
- `docs/reference/product-research.md` (expenses-relevant sections)
- `docs/FINAL-AUDIT.md` (full)
