# Step 03: Dashboard Data Scout

> **PATCH NOTE (2026-09-30):** This report was written against the original seed-only, in-memory prototype. The data model, store, and Dashboard have since been rewritten. Every factual claim below has been updated to match the current `src/data/types.ts`, `src/data/store.tsx`, `src/data/seed.ts`, and `src/pages/Dashboard.tsx`. The original "no persistence / no mutations / no chart / no `LUNILE`" findings are obsolete.

## Scope

Inspected the Dashboard page and every data/state dependency it relies on. All findings are from local files only.

---

## 1. Current Dashboard Implementation

**File:** `src/pages/Dashboard.tsx`

The Dashboard is a single component: a row of 4 KPI tiles plus three recent-activity tables. There is **no chart, no projection, no client list, no tax summary, no deadlines, no threshold indicators**.

### KPI Tiles (4 StatCards)
| Tile | Source | Calculation |
|---|---|---|
| Venituri înregistrate (green) | `revenues` | Sum of `total(r)` where `status === 'inregistrata'` |
| Cheltuieli înregistrate (red) | `expenses` | Sum of `total(e)` where `status === 'inregistrata'` |
| Sold curent (blue, pos/neg tone) | derived | `revTotal − expTotal` |
| De verificat (amber) | derived | `pendingRev + respins + declPENDING` |

- `total(r)` = `valoareFaraTva + tva` (net + VAT)
- `pendingRev` = count of `revenues` where `status === 'in-asteptare'`
- `respins` = count of `revenues` where `status === 'respinsa'` **plus** count of `expenses` where `status === 'respinsa'`
- `declPENDING` = count of `declarations` where `status === 'in-asteptare'`
- "De verificat" hint: `X venituri în așteptare · Y respinse · Z declarații`

### Table: Ultimii venituri (last 5)
- `revenues` sorted by date descending, `slice(0, 5)`
- Columns: Document (`r.nr`), Client, Data, Status, Total (`fmtRON(total(r))`)

### Table: Declarații (last 3)
- `declarations.slice(0, 3)`
- Columns: Perioada (`d.luna/d.an`), Venituri (`fmtRON(d.venituri)`), Status

### Table: Documente recente (last 3)
- `documents.slice(0, 3)`
- Columns: Nume (`d.nume`), Data, Categorie (`d.categoria`)

### Removed since the original report
- No 6-month CSS bar chart, no `LUNILE` array
- No revenue projection formula
- No `reports` / `CashFlowReport` collection

---

## 2. Store / State

**File:** `src/data/store.tsx`

- Single `AppProvider`; `loadInitial()` reads from `localStorage` (key `pfa-app-data-v2`) and falls back to `seedData`
- **Persistence IS present** — a `useEffect` writes the full `data` object to `localStorage` on every change
- Full mutation actions (new IDs via `uid()`):
  - `addRevenue`, `updateRevenue`, `deleteRevenue`
  - `addExpense`, `updateExpense`, `deleteExpense`
  - `addClient` (no `deleteClient`)
  - `addDeclaration`, `sendDeclaration` (sets `status = 'transmisa'`, `dataTrimitere = todayISO()`)
  - `uploadDocument`, `deleteDocument`
  - `addStatement`, `deleteStatement`
  - `updateSettings`
- Toast system: `toast`, `dismissToast` + a `ToastHost` component (transient, not persisted)

### Collections in `AppData`:
| Collection | Type |
|---|---|
| `revenues` | `Revenue[]` |
| `expenses` | `Expense[]` |
| `clients` | `Client[]` |
| `declarations` | `Declaration[]` |
| `documents` | `DocumentItem[]` |
| `companyDocs` | `Record<DocTypeCode, CompanyDocument[]>` |
| `statements` | `TaxStatement[]` |
| `settings` | `SettingsState` |

**Removed since the original report:** no `reports` (`CashFlowReport` gone), no top-level `company` / `account` (replaced by `settings.company` / `settings.personal`).

---

## 3. Data Structures

**File:** `src/data/types.ts`

### Revenue
```
id: string
tip: 'factura' | 'notafactura'
nr: string              // document number
date: string            // ISO date
client: string          // free text, not a Client.id reference
cui: string
valoareFaraTva: number
tva: number
status: RevenueStatus   // 'inregistrata' | 'in-asteptare' | 'respinsa'
statusDetail?: string
eFacturaStatus?: string
```
- No `total` field — computed via the `total()` helper
- Identity is `nr` + `tip` (no `document` field)

### Expense
```
id: string
tip: 'factura' | 'bon-fiscal'
nr: string
date: string
furnizor: string        // supplier (free text)
cui: string
valoareFaraTva: number
tva: number
status: ExpenseStatus   // 'inregistrata' | 'respinsa'  (no pending)
statusDetail?: string
```

### Client
```
id, denumire, cui, email?, telefon?, oras?
```
- Simple model. `Revenue.client` is free text, not a `Client.id` reference.

### Declaration
```
id, an, luna, venituri, cheltuieli,
status: DeclStatus,     // 'inregistrata' | 'in-asteptare' | 'transmisa' | 'respinsa'
dataInregistrare, dataTrimitere?
```
- `venituri` / `cheltuieli` are manually entered, **not derived** from `revenues`/`expenses`.

### DocumentItem
```
id, nume, data, categoria
```

### CompanyDocument
```
id, nume, tip, content, marime, data, dataDepunere?, depunere?, perioada?
```
- `companyDocs` is a `Record<DocTypeCode, CompanyDocument[]>` keyed by doc type (not a flat array).

### TaxStatement
```
id, tip, perioada, depunere: 'SOLO' | 'personală', dataDepunere?, nume?, content?
```

### Settings
```
cotaTva, company, personal, bankAccounts, eFactura
```
- No `fiscalYear`, no `minSalary`.

### Helpers in `types.ts`
- `total(item)` = `valoareFaraTva + tva`
- `fmtRON(n)`, `fmtDate(iso)`
- `REV_STATUS_LABEL`, `EXP_STATUS_LABEL`, `DECL_STATUS_LABEL`, `statusBadge`
- `DOC_SECTIONS`, `DOC_SECTION_MAP`
- `MAX_DOC_BYTES`, `docTipFromName`, `formatBytes`, `todayISO`, `downloadDataUrl`, `downloadText`
- **No `parseRO`, no `fmtRO`, no `LUNILE`, no `monthKey`** in this file.

---

## 4. Seed Data

**File:** `src/data/seed.ts`

| Collection | Count |
|---|---|
| `revenues` | 7 (r1–r7) |
| `expenses` | 7 (e1–e7) |
| `clients` | 4 (c1–c4) |
| `declarations` | 2 (d1–d2) |
| `documents` | 3 (doc1–doc3) |
| `companyDocs` | 3 (cd1–cd3) |
| `statements` | 1 (s1) |
| `settings` | company + personal |

No `reports` / cash-flow seed. All data is fake seed data.

---

## 5. Answers to the 10 Questions

### 1. Can we calculate YTD revenue?
**Yes, from the data that exists.** `revenues` has ISO dates and `valoareFaraTva`/`tva`. Filter by current-year prefix, sum `total()`. **Caveat:** the Dashboard currently sums only `status === 'inregistrata'` (registered, not YTD-by-year). No "issued" vs "settled" distinction beyond the status enum.

### 2. Can we calculate YTD expenses?
**Yes, same as revenue.** Same caveats.

### 3. Can we calculate net profit?
**Yes, as revenue − expenses.** The Dashboard computes `Sold curent = revTotal − expTotal` (registered only). **Caveat:** no tax deduction. `settings.cotaTva` exists but is **never used** in any calculation. No tax logic exists anywhere in the codebase.

### 4. Can we build a monthly revenue/expense series?
**Yes.** ISO dates allow grouping by year-month. **Caveat:** the Dashboard no longer renders a chart, and there is no shared helper — the logic would need to be built.

### 5. Can we build a projection?
**Yes, with the data that exists.** No projection is currently rendered. A formula (e.g. `YTD + avg last 3 months × remaining months`) would need to be built; no user-adjustable parameters exist.

### 6. What data exists for documents?
- **Dashboard documents** (`documents`): `DocumentItem[]` — name, date, category
- **Company documents** (`companyDocs`): `Record<DocTypeCode, CompanyDocument[]>` — content, size, submission metadata
- **Tax statements** (`statements`): type, period, submission method (SOLO/personal), optional attachment
- All persisted to `localStorage`.

### 7. What data exists for tax calculations?
**Almost nothing.**
- `settings.cotaTva` exists as a value but is **never read by any calculation**
- No tax type (impozit pe venit, CAS, CASS)
- No tax calculation logic anywhere
- Declarations have manually entered `venituri`/`cheltuieli` — not derived from transaction data
- No tax period logic (monthly, quarterly, annual)

### 8. What data exists for deadlines?
**Nothing.** No deadline data structure, no deadline logic, no reminder system.

### 9. What data exists for thresholds?
**Nothing.** No threshold data, no threshold logic, no alert system.

### 10. What information is entirely missing?
| Missing item | Impact |
|---|---|
| **Tax calculation logic** | Cannot compute the actual tax owed |
| **Deadline data/logic** | Cannot show upcoming obligations |
| **Threshold data** | Cannot show limit usage |
| **Real transaction data** | Only seed data exists |
| **Revenue status tracking beyond the enum** | No "issued" vs "settled" distinction |
| **Client–revenue linkage** | `Revenue.client` is free text, not a `Client.id` reference |
| **Declaration–transaction linkage** | Declaration amounts are manual, not derived |
| **Tests** | No test suite exists |
| **Router** | No URL-based navigation |

**Now present (since the original report):** `localStorage` persistence, full mutation actions, toast system, `documents` collection, `settings` collection.

---

## 6. Duplicated Business Logic

**Resolved.** The original report flagged copy-pasted `fmtDate`, `parseRO`, `fmtRO`, `LUNILE` across pages. Those helpers have been consolidated into `src/data/types.ts` (`fmtRON`, `fmtDate`, `total`, status labels, `statusBadge`). Pages now import shared helpers instead of redefining them. `parseRO` / `fmtRO` / `LUNILE` no longer exist.

---

## 7. What Can Already Be Reliably Computed

Given the current data (seed, `localStorage`-persisted):

| Calculation | Reliable? | Notes |
|---|---|---|
| Registered revenue (net + VAT) | ✅ Yes | Sum `total()` where `status === 'inregistrata'` |
| Registered expenses (net + VAT) | ✅ Yes | Sum `total()` where `status === 'inregistrata'` |
| Current balance | ✅ Yes | Revenue − Expenses (registered) |
| "De verificat" count | ✅ Yes | Pending revenues + rejected (rev+exp) + pending declarations |
| YTD revenue/expense (net) | ✅ Yes | Sum `valoareFaraTva` by year prefix |
| Total VAT collected | ✅ Yes | Sum `tva` from revenues |
| Total VAT paid (expenses) | ✅ Yes | Sum `tva` from expenses |
| Tax owed | ❌ No | No tax logic; `cotaTva` unused |
| Deadlines | ❌ No | No deadline data |
| Threshold usage | ❌ No | No threshold data |
