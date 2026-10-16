# Step 23 — Dashboard Legislation Awareness Surface

## Objective
Add the Dashboard's legislation-awareness surface. The UI displays exactly one appropriate state:
- NO VERIFIED UPCOMING CHANGES
- UPCOMING CHANGE
- LEGISLATION CHANGE AFFECTING YOU

## What was built
- `LegislationItem` interface in `src/data/dashboard.ts` (source, publishedDate, effectiveDate, status, affectedArea, summary)
- `LegislationState.items` changed from `never[]` to `LegislationItem[]`
- `legislation` wired into `DashboardData` and `buildDashboardData`
- `LegislationSection.tsx` component with three-state rendering
- `LegislationSection.test.tsx` with 4 test cases
- `LegislationSection` wired into `src/pages/Dashboard.tsx`

## Three states
| State | Condition | Header | Badge |
|-------|-----------|--------|-------|
| NO VERIFIED UPCOMING CHANGES | `items` is empty | "Legislation" | — |
| UPCOMING CHANGE | items with `status === 'UPCOMING'`, no CURRENT | "Upcoming Change" | `badge-warning` "UPCOMING" |
| LEGISLATION CHANGE AFFECTING YOU | items with `status === 'CURRENT'` | "Legislation Change Affecting You" | `badge-danger` "CURRENT" |

## Required metadata per change
Every displayed change shows: source, published date, effective date, status, affected area.

## CURRENT vs UPCOMING
- CURRENT = already-active rule (`status: 'CURRENT'`, badge-danger)
- UPCOMING = verified change with future effective date (`status: 'UPCOMING'`, badge-warning)
- The UI NEVER labels an UPCOMING change as "Current" or "Active"
- The UI NEVER labels a CURRENT change as "Upcoming"

## Data boundary
- Consumes `getLegislationState()` from `src/data/dashboard.ts` (Step 18 boundary)
- No new data source, no external fetches, no ingestion
- Current state: honest empty (`items: []`) → renders "No verified upcoming changes"

## Tests
- `npx tsc --noEmit` — passes
- `npx vitest run` — 231 tests pass (including 4 new LegislationSection tests)

## Files changed
- `src/data/dashboard.ts` — `LegislationItem` interface, `LegislationState.items` type, `DashboardData.legislation`, `buildDashboardData` wiring
- `src/components/dashboard/LegislationSection.tsx` — new component
- `src/components/dashboard/LegislationSection.test.tsx` — new tests
- `src/pages/Dashboard.tsx` — import + render `LegislationSection`
- `docs/ai/steps/23_dashboard_legislation.md` — this document
