# Step 32 — Dashboard: Final UX Polish

## Objective

Final polish pass over the dashboard and app shell, covering three areas:

1. **Responsive layout & navigation** (Worker 1) — no horizontal overflow at any
   viewport, off-canvas mobile nav drawer with hamburger toggle, ~768px tablet
   breakpoint, spacing consolidation, and extraction of inline styles into CSS
   classes.
2. **Content, links, empty states, accessibility** (Worker 2) — Romanian
   localization of all five dashboard sections, removal of raw enum values from
   user-facing text, honest empty states, removal of a dead link, and new
   component tests.
3. **Final rendered sweep, documentation, validation** (Worker 3) — live
   browser verification of all viewports and interactions, one a11y fix
   (off-canvas sidebar focus leakage), test-file type fixes that unblock the
   production build, full validation, and this document.

## Files changed (all of Step 32)

| File | Reason |
|---|---|
| `src/styles.css` | Worker 1: overflow prevention (`.app { overflow: hidden }`, `min-width: 0` on grid children, `overflow-wrap` on stat values, `.chart-scroll { overflow-x: auto }` with 640px min-width child); `.nav-toggle` + `.nav-overlay`; ~768px off-canvas drawer (`.sidebar` fixed, `translateX(-100%)`, `.sidebar.open → translateX(0)`, z-50 over overlay z-40); padding/gap consolidation; new utility classes (`.item-row`, `.item-title`, `.item-meta`, `.kv-row`, `.bar-track`/`.bar-fill(.ok/.warning/.breached)`, `.check-row`, `.check-title`, `.action-label`, `.chart-legend-swatch.projection`). |
| `src/App.tsx` | Worker 1: mobile drawer wiring — `navOpen` state, Escape-to-close, overlay-click-to-close, nav-item-click-to-close, `aria-expanded` on the toggle, `.open` class on the sidebar. Worker 3: a11y fix — `aria-hidden={!navOpen}` plus `inert` on the sidebar when closed, so the 8 off-canvas links are excluded from the Tab order and from screen readers while hidden (verified: first Tab from the body lands on the hamburger, not a hidden link; links become tabbable when the drawer opens). |
| `src/components/dashboard/ThresholdSection.tsx` | Worker 1: inline styles → classes. Worker 2: Romanian rows (`Curent:`, `Prag:`, `Distanță:`, `La depășire:`) and status labels `În limite` / `Atenție` / `Depășit`. |
| `src/components/dashboard/DeadlineSection.tsx` | Worker 1: inline styles → classes. Worker 2: Romanian header/description/empty state, `1 zi rămasă` / `N zile rămase` grammar, Romanian status badges. |
| `src/components/dashboard/CompletenessSection.tsx` | Worker 1: inline styles → classes. Worker 2: Romanian (`Completitudine date`, "X din Y verificări îndeplinite", `Complet`/`Lipsă`, "Nicio verificare de completitudine"); unsatisfied checks stay visible (`.check-row.missing`). |
| `src/components/dashboard/ActionSection.tsx` | Worker 1: inline styles → classes. Worker 2: Romanian (`Ce trebuie să faci`, "N item de rezolvat"), `SOURCE_LABEL` map (`Termen limită` / `Completitudine` / `Impozit`), `DEADLINE_LABELS` map for raw `appliesTo` keys (`cas_quarterly` → `CAS trimestrial`, `pfa` → `PFA`, …) with `?? item.label` fallback. |
| `src/components/dashboard/LegislationSection.tsx` | Worker 2: `CURRENT`/`UPCOMING` → `În vigoare`/`Viitoare` (header + badge). |
| `src/components/dashboard/checkLabels.ts` | Worker 2: 9 completeness check keys → Romanian labels, `?? key` fallback so no check is dropped. |
| `src/components/FinancialChart.tsx` | Worker 1: inline styles → classes (only per-month `borderTopColor` remains inline as a legitimate dynamic value). |
| `src/data/dashboard.ts` | Worker 2: tax ActionItem label → `Revizuire estimări fiscale`. |
| `src/pages/Dashboard.tsx` | Worker 2: removed the dead `/calcul` link (no such route exists). |
| `src/components/dashboard/CompletenessSection.test.tsx` (new), `DeadlineSection.test.tsx` (new), `ThresholdSection.test.tsx` (new) | Worker 2: new component tests (5 + 5 + 4) verifying Romanian text, honest empty states, and absence of raw enum values. |
| `src/components/dashboard/LegislationSection.test.tsx`, `ActionSection.test.tsx` | Worker 2: updated for the Romanian contracts (4 + 5 tests). |
| `src/components/Insights.test.tsx` | Worker 3: removed `eventType`/`priority`/`conditions` from the `makeInsight` fixture — the `Insight` interface (simplified in Step 30) no longer has those fields; this was a pre-existing tsc error blocking `npm run build`. |
| `src/domain/completeness.test.ts` | Worker 3: `regime: ''` cast to `PfaRegime` (`'' as unknown as PfaRegime`) — the empty-regime case the test exercises is handled by the domain code (`regime.length > 0`), the cast just satisfies the type. Pre-existing tsc error. |
| `src/domain/deadlines.test.ts` | Worker 3: added the required `asOfDate` field to the two `computeDeadlines` queries. Pre-existing tsc error. |
| `src/domain/derived.test.ts` | Worker 3: `tip: 'nota-impozit'` → `'notafactura'` in both the fixture and its assertion — `'nota-impozit'` is not a valid `RevenueTip`. Pre-existing tsc error. |
| `src/domain/fiscal/rules.test.ts` | Worker 3: `status: 'DRAFT'` → `'PROPOSED'` — `'DRAFT'` is not a valid `FiscalRuleStatus`; `PROPOSED` is the non-ACTIVE status the test is checking. Pre-existing tsc error. |
| `docs/ai/steps/32_dashboard_polish.md` | Worker 3 (this file): step documentation. |

## Validation results

### Live browser sweep (Worker 3, dev server :5173)

- **Desktop 1280px**: sidebar in-flow (`position: static`), hamburger hidden,
  no horizontal overflow.
- **Tablet 768px** and **mobile 390px**: sidebar off-canvas
  (`translateX(-260px)`), hamburger visible, **no page-level horizontal
  overflow** (`scrollWidth === innerWidth` at 390px). The financial chart
  renders at 640px inside `.chart-scroll` (356px, `overflow-x: auto`) — a
  deliberate scrollable-chart pattern: the card scrolls internally, the page
  does not overflow.
- **Drawer interactions** (verified at both 768px and 390px):
  - hamburger opens the drawer (`translateX(0)`, overlay visible,
    `aria-expanded=true`);
  - **Escape closes** the drawer (sidebar off-canvas, `aria-expanded=false`,
    overlay removed);
  - **overlay click closes** the drawer;
  - **nav-item click navigates and closes** the drawer (tested
    Dashboard → Cheltuieli → Dashboard).
- **Keyboard accessibility**: with the drawer closed, the first native Tab from
  the body lands on the hamburger (the 8 off-canvas links are `inert` and
  excluded from the Tab order); tabbing continues hamburger → period toggle
  (Lunar/YTD/An) → year select → chart → body, and wraps cleanly. Enter on the
  focused YTD button toggles it (`aria-pressed` updates). With the drawer open,
  all 8 sidebar links are tabbable and `aria-hidden=false`.
- **Console**: no errors across Dashboard, Revenues, Expenses, e-Factura,
  Declarații, Documente, Clienți, Setări (only Vite HMR debug + React DevTools
  info messages).

### Static checks (Worker 3)

- **Typecheck** (`npx tsc --noEmit`): **0 errors** — the 6 pre-existing
  test-file errors listed in the Step 31 doc (Insights, completeness,
  deadlines ×2, derived, fiscal/rules) were fixed as part of this step.
- **Tests** (`npx vitest run`): **355/355 passed (31 test files)**, including
  all 23 dashboard section tests.
- **Production build** (`npm run build` = `tsc && vite build`): **succeeds**
  (JS 618 kB / gzip 181 kB; CSS 16.4 kB / gzip 4.0 kB). The chunk-size
  warning (>500 kB) is a pre-existing advisory, not an error.

## Known limitations

- **Inline styles in `pages/`** (Documents, Expenses, etc.) were out of
  Worker 1's scope — only dashboard components and `FinancialChart` were
  converted to classes.
- **Legislation data remains a stub** (Step 31): `getLegislationState` always
  returns `{ updatedAt: null, items: [] }`; the section renders the exact
  empty state "No verified upcoming changes." No fabrication, no fetches.
- **Chunk size**: the single 618 kB JS bundle triggers Vite's >500 kB
  advisory. Code-splitting (dynamic imports / `manualChunks`) is a
  follow-up optimization, not a correctness issue.
- **`act()` warnings** in test output are pre-existing (URL-normalization
  effect on mount), not introduced by this step.
