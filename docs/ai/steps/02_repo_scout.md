# Step 02 — Repository Scout Report

## Role
LOCAL REPOSITORY SCOUT — local files only, no internet, no code changes.

## Objective
Document the actual architecture, files, data structures, and current Dashboard of the SOLO Replica repository.

## Work performed
Full read of every source file (line counts below are from the original scan; files have since grown — see patch notes). Also grepped for tests, media queries, and CRUD handlers.

> **Patch note (post-scout):** the repository has evolved since this scan. The "Current architecture", "Important files", "Important data structures", "Current Dashboard structure" and "Current limitations" sections below have been corrected to match the current implementation. The original scan described a 6-page, no-routing, no-persistence skeleton.

## Files inspected
- Root: `package.json`, `vite.config.ts`, `index.html`, `index.css`, `README.md`, `.gitignore`, `.pi-lens.json` (LSP config, not app code)
- `src/main.tsx`, `src/App.tsx`
- `src/data/types.ts`, `src/data/store.tsx`, `src/data/seed.ts`
- `src/pages/Dashboard.tsx`, `Clients.tsx`, `Revenues.tsx`, `Expenses.tsx`, `Documents.tsx`, `Settings.tsx`
- `src/components/ui.tsx`
- `src/styles.css`, `src/components.css`
- `docs/` — only `docs/ai/` (this workspace); no prior project documentation.

## Current architecture
- **Framework/tooling**: React 19.2.4 + TypeScript 5.9.3 + Vite 7.3.1. No router, no UI library, no CSS framework, no test framework, no lint config. Dev-only scripts: `dev`, `build` (tsc -b && vite build), `preview`.
- **Entry points**: `index.html` → `src/main.tsx` → `App`.
- **Routing**: URL-based — `App.tsx` exposes `parseRoute()` / `routeToUrl(page, tab)` and syncs the route with the URL (deep links and bookmarks work; tabs are supported per page).
- **Pages**: `Dashboard`, `Revenues`, `Expenses`, `EFactura`, `Declarations`, `Documents`, `Clients`, `Settings` (8 pages, one file each in `src/pages/`).
- **Shared components**: `src/components/ui.tsx` — `Modal`, `Card`, `StatCard`, `Button`, `Input`, `Select`, `Label`, `Table`, `Badge`, `Toasts`.
- **Global state/store**: React Context in `src/data/store.tsx` (`StoreProvider`, `useStore`) over an `AppData` object. Full CRUD for revenues, expenses, clients, declarations, company documents, and statements.
- **Persistence**: `localStorage` under key `pfa-app-data-v2` — data survives reload.
- **Seed data**: `src/data/seed.ts` — 4 revenues, 3 expenses, 3 clients, 3 declarations, 3 dashboard documents, 4 `companyDocs` sections (im/cs/tva/facturi, 7 files total), 3 submitted `statements`, full `settings` (company, personal, bank accounts, eFactura).
- **Styling system**: 3 hand-written CSS files — `index.css` (Inter font + CSS variables), `styles.css` (layout: sidebar, topbar, cards, tables, forms, modals, toasts, stat cards, charts, responsive), `components.css` (shared `.btn`, `.input`, `.select`, `.badge`, `.table`, `.modal`, `.card`).
- **Existing tests**: none. No `*.test.*`/`*.spec.*` files, no test runner configured.
- **Build scripts**: `npm run dev`, `npm run build`, `npm run preview` only.

## Important files
| File | Role |
|---|---|
| `src/App.tsx` | Shell: sidebar nav, topbar, URL routing (`parseRoute`/`routeToUrl`), toasts |
| `src/data/types.ts` | All domain types (Revenue, Expense, Client, Declaration, DocumentItem, CompanyDocument, TaxStatement, SettingsState, AppData) + formatting/status helpers (`fmtRON`, `fmtDate`, `statusBadge`, `DOC_SECTIONS`) |
| `src/data/store.tsx` | Context store with `localStorage` persistence (`pfa-app-data-v2`); CRUD for all collections |
| `src/data/seed.ts` | Initial demo data (FY 2026, Romanian domain) |
| `src/pages/Dashboard.tsx` | StatCards (revenue, expenses, current balance), recent revenues, declarations, recent documents |
| `src/styles.css` + `src/components.css` | All visual styling |

## Important data structures (from `src/data/types.ts`)
- `Revenue`: id, tip (`factura`|`notafactura`), nr, date, client, cui, valoareFaraTva, tva, status (`inregistrata`|`in-asteptare`|`respinsa`), statusDetail?, eFacturaStatus?.
- `Expense`: id, tip (`factura`|`bon-fiscal`), nr, date, furnizor, cui, valoareFaraTva, tva, status (`inregistrata`|`respinsa`), statusDetail?.
- `Client`: id, denumire, cui, email?, telefon?, oras?.
- `Declaration`: id, an, luna, venituri, cheltuieli, status (`inregistrata`|`in-asteptare`|`transmisa`|`respinsa`), dataInregistrare, dataTrimitere?.
- `DocumentItem`: id, nume, data, categoria (dashboard recent-documents list).
- `CompanyDocument`: id, nume, tip, content (data URL), marime, data, dataDepunere?, depunere?, perioada? — stored per section in `AppData.companyDocs: Record<DocTypeCode, CompanyDocument[]>` where `DocTypeCode = 'im' | 'cs' | 'tva' | 'facturi'`.
- `TaxStatement`: id, tip, perioada, depunere (`SOLO`|`personală`), dataDepunere?, nume?, content?.
- `SettingsState`: cotaTva, company (denumire, cui, CAEN list, …), personal, bankAccounts, eFactura.
- `AppData`: revenues, expenses, clients, declarations, documents, companyDocs, statements, settings.
- Field naming is Romanian (`valoareFaraTva`, `cui`, `denumire`, `furnizor`, …); formatting helpers `fmtRON`/`fmtDate` are co-located in `types.ts`.

## Current Dashboard structure (`src/pages/Dashboard.tsx`)
- **StatCards (4)**: Venituri înregistrate, Cheltuieli înregistrate, Sold curent (revenue − expenses, pos/neg tone), plus a fourth stat card.
- **Ultimii venituri** card: recent revenues with status badges.
- **Declarații** card: recent declarations with status, links to the Declarations page.
- **Documente recente** card: recent documents, links to the Documents page.
- No tax-calculation logic (shows stored `tva` fields only), no thresholds/deadlines/insights.

## Current limitations
1. ~~**No persistence**~~ — **patched:** data now persists in `localStorage` (`pfa-app-data-v2`); no backend.
2. **No tests, no lint** — zero automated verification; `build` is the only gate.
3. **No real tax logic** — `taxAmount` values are stored manually; no CAEN/CF calculation, no CASS/CISS thresholds, no due-date logic.
4. **No fiscal-year scoping** — data is global; no per-year views (product principle: FY 2026).
5. ~~**No CRUD on invoices/expenses/statements**~~ — **patched:** store now exposes add/update/delete for revenues, expenses, clients, declarations, company documents, and statements.
6. **Documents are decorative** — `addDocument` auto-creates a `TaxStatement` for PDFs with `taxAmount: 0`; no real linkage.
7. **Statements have no edit/delete**; `Settings` writes `settings` only (currency, taxRate, company, fiscalYear).
8. **Single responsive breakpoint** (`@media (max-width: 768px)` in `styles.css`); no mobile nav.
9. ~~**No routing**~~ — **patched:** URL-based routing with per-page tabs now exists in `App.tsx`.
10. **Seed data is the only data** — no import/export (no CSV, no API).
11. **Settings model changed** — `SettingsState` now holds `cotaTva`, company details (CUI, CAEN, bank accounts), personal data, and eFactura config; `taxRate`/`fiscalYear` fields no longer exist.
12. **No error handling/empty-state UX** beyond inline "No clients" rows.

## Questions requiring later research
- **UX (Step 04)**: What should the Dashboard surface for a Romanian PFA operator (KPIs, deadlines, cash flow)?
- **Fiscal (Step 05)**: How should FY 2026 scoping work in data model and UI?
- **Legislation (Step 06)**: Current CASS/CISS thresholds, CAEN rates, and due dates for 2026 — what are the authoritative sources?
- **Stack/testing (Step 07)**: Which test runner (Vitest is the natural fit for Vite) and what coverage is required?
- **Architecture (Step 08)**: Should persistence be added (localStorage vs. backend), and how should tax calculation be isolated from UI?
- **Domain foundation (Step 09)**: Where should domain logic (tax, aggregation, thresholds) live — new `src/domain/` module?

## Decisions
- None made — scout role only.

## Tests
- None run (no test infrastructure exists in the repository).

## Problems
- None encountered during inspection. All files readable; repository is clean and consistent.

## Handoff
Repository fully mapped. Ready for Step 03 (Dashboard/data inspection) — the scout report above covers the structural baseline that step needs.
