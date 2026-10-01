# Step 22 — Dashboard Action & Intelligence Panels

## What was built

The four remaining structural placeholders from Steps 19/21 that belong to the
intelligence/action panels are now real components, wired into
`src/pages/Dashboard.tsx` in place (no reordering, no redesign of the shell):

1. **"Praguri fiscale"** placeholder → `<ThresholdSection thresholds={data.thresholds} />`
2. **"Termene limită"** placeholder → `<DeadlineSection deadlines={data.deadlines} asOfDate={data.snapshot.asOf} />`
3. **"Date necesare"** placeholder → `<CompletenessSection completeness={data.completeness} />`
4. **"În așteptare"** placeholder → `<ActionSection pendingCounts={data.pendingCounts} />`

All four are in `src/components/dashboard/`. The page is the only place that
touches data; components present only.

## The four components and their prop interfaces

All four are presentational: no hooks, no store access, no business logic, no
persistence.

### 1. `ThresholdSection` — `src/components/dashboard/ThresholdSection.tsx`

- **Prop:** `thresholds: FiscalThreshold[]`
- **Type:** `FiscalThreshold` from `src/domain/thresholds.ts`:
  `{ thresholdId, type: ThresholdType, currentValue, thresholdValue, distance,
  affectedDomain, affectedTax, effectiveDate, warningDistance, ruleRelease,
  source, status: 'ok' | 'warning' | 'breached' }`
- **Renders:** One block per threshold with a human-readable label (derived from
  `type` + `affectedTax`), a status badge (green/amber/red), current value vs.
  threshold value, distance, a progress bar (width = `currentValue /
  thresholdValue`, capped 0–100%), and the source citation.
- **Empty state:** `thresholds.length === 0` → "No thresholds".
- **Presentation math only:** `progressPercent(currentValue, thresholdValue)`
  is the sole derived value (a display width, not a business calculation).

### 2. `DeadlineSection` — `src/components/dashboard/DeadlineSection.tsx`

- **Props:** `deadlines: Deadline[]`, `asOfDate: string`
- **Type:** `Deadline` from `src/domain/deadlines.ts`:
  `{ deadlineId, taxYear, eventType: DeadlineEventType, date: string | null,
  dateFormula, appliesTo, legalSource: { act, article }, effectiveFrom,
  effectiveTo, status: 'active' | 'not_applicable' }`
- **Renders:** One row per deadline with a human-readable label (derived from
  `eventType`), the `appliesTo` text, the resolved date (ISO → DD.MM.YYYY)
  with days remaining (via the pure `daysRemaining(date, asOfDate)` helper),
  and a status badge (info/neutral). When `date === null`, shows "Not
  applicable".
- **Empty state:** `deadlines.length === 0` → "No deadlines".

### 3. `CompletenessSection` — `src/components/dashboard/CompletenessSection.tsx`

- **Prop:** `completeness: CompletenessReport`
- **Type:** `CompletenessReport` from `src/domain/completeness.ts`:
  `{ checks: CompletenessCheck[], satisfiedCount: number, totalCount: number }`
  where `CompletenessCheck = { key, satisfied: boolean, detail: string }`.
- **Renders:** A header with "N of M checks satisfied", then one row per check
  with a ✓/✗ indicator, the check key, and the detail text. Unsatisfied checks
  are highlighted with a danger-soft background.
- **Empty state:** `checks.length === 0` → "No completeness checks".

### 4. `ActionSection` — `src/components/dashboard/ActionSection.tsx`

- **Prop:** `pendingCounts: PendingCounts`
- **Type:** `PendingCounts` from `src/data/dashboard.ts`:
  `{ revenuesInAsteptare: number; revenuesRespinsa: number;
  expensesRespinsa: number; declarationsInAsteptare: number }`
- **Renders:** A checklist of four pending-item categories:
  - "Revenues awaiting declaration" → `revenuesInAsteptare`
  - "Rejected revenues to review" → `revenuesRespinsa`
  - "Rejected expenses to review" → `expensesRespinsa`
  - "Declarations awaiting filing" → `declarationsInAsteptare`
  Each row shows the label and the count (or a ✓ when zero).
- **Empty state:** all four counts are 0 → "You're all caught up — no pending
  items." (honest up-to-date state, not a fabricated warning).

## Where each value comes from (Step 18 data layer)

The page is the only place that touches data; components present only:

- **Thresholds** — `data.thresholds` from `useDashboardData()`
  (`DashboardData.thresholds`, built by Step 18's `buildDashboardData` via
  `getThresholdStatuses(data, asOfDate)`).
- **Deadlines** — `data.deadlines` from `useDashboardData()`
  (`DashboardData.deadlines`, built by Step 18's `buildDashboardData` via
  `getUpcomingDeadlines(data, asOfDate)`).
- **Completeness** — `data.completeness` from `useDashboardData()`
  (`DashboardData.completeness`, built by Step 18's `buildDashboardData` via
  `getDataCompleteness(data)`).
- **Pending counts** — `data.pendingCounts` from `useDashboardData()`
  (`DashboardData.pendingCounts`, built by Step 18's `buildDashboardData` via
  `getPendingCounts(data)`).

No component imports a data-layer function, the store, or localStorage.

## Architectural rule

No business calculations in components, no direct persistence access.
Unavailable, incomplete, and review-required states are **preserved, not
invented and not zeroed**:

- `ThresholdSection` renders the status badge and distance exactly as the
  domain produces them; it does not recompute threshold status.
- `DeadlineSection` renders `date === null` as "Not applicable" (the domain's
  honest state for event-relative deadlines with no event date) — it does not
  fabricate a date.
- `CompletenessSection` renders unsatisfied checks with a ✗ and detail text —
  it does not hide or zero them.
- `ActionSection` renders zero counts as ✓ (done) and shows the honest
  "all caught up" message when all four are zero — it does not invent pending
  items.

## Data-layer dependencies

| Component | Data field | Source function | Domain module |
|---|---|---|---|
| `ThresholdSection` | `DashboardData.thresholds` | `getThresholdStatuses(data, asOfDate)` | `src/domain/thresholds.ts` |
| `DeadlineSection` | `DashboardData.deadlines` | `getUpcomingDeadlines(data, asOfDate)` | `src/domain/deadlines.ts` |
| `CompletenessSection` | `DashboardData.completeness` | `getDataCompleteness(data)` | `src/domain/completeness.ts` |
| `ActionSection` | `DashboardData.pendingCounts` | `getPendingCounts(data)` | `src/data/dashboard.ts` |

All four are pure selectors in the Step 18 data layer
(`src/data/dashboard.ts`). `PendingCounts` is defined in the data layer (not
the domain) because it is a dashboard-specific aggregate of pending/review
counts, not a domain concept.

## Empty-state behavior

| Component | Condition | Rendered state |
|---|---|---|
| `ThresholdSection` | `thresholds.length === 0` | "No thresholds" |
| `DeadlineSection` | `deadlines.length === 0` | "No deadlines" |
| `CompletenessSection` | `checks.length === 0` | "No completeness checks" |
| `ActionSection` | all four counts === 0 | "You're all caught up — no pending items." |

None of these states are invented by the component; each reflects a legitimate
empty condition from the data layer.

## Tests

New component test (vitest + `@testing-library/react`, same pattern as the
Step 21 component tests — props passed directly, no mocks, since the component
is presentational):

- `src/components/dashboard/ActionSection.test.tsx` — 3 tests:
  - `renders the four real pending counts as a checklist` — mixed counts
    (`revenuesInAsteptare: 2, revenuesRespinsa: 1, expensesRespinsa: 0,
    declarationsInAsteptare: 3`) → all four labels rendered with their
    counts (2, 1, 3).
  - `marks zero-count items as clear (✓) instead of hiding them` — same
    mixed counts → the zero-count row shows ✓ instead of being hidden.
  - `shows the honest all-clear state when all four counts are 0` — all four
    counts 0 → "You're all caught up — no pending items.", and the checklist
    labels are not rendered.

Existing domain tests cover the intelligence layer the panels present:
`src/domain/thresholds.test.ts`, `src/domain/deadlines.test.ts`,
`src/domain/completeness.test.ts`, `src/data/dashboard.test.ts`.

## Commands / results

- `npx tsc --noEmit` — passed, no errors (exit 0).
- `npm run build` — passed (vite build, no errors; pre-existing chunk-size
  warning only).
- `npx vitest run` — all pass: 20 test files, 227 tests (including the 3 new
  ActionSection component tests).

## Files changed

- `src/components/dashboard/ActionSection.tsx` — **rewritten**: replaced the
  invented `Record<Priority, number>` prop with the real `PendingCounts` type
  from `src/data/dashboard.ts`. Renders the four real pending-item categories
  as a checklist with an honest empty state.
- `src/components/dashboard/ActionSection.test.tsx` — **new**: 3 tests covering
  the empty state, mixed counts, and all-non-zero counts.
- `src/pages/Dashboard.tsx` — **edited**: replaced the four `PlaceholderCard`s
  (Tax Thresholds, Next Deadline, Data Completeness, What You Need To Do) with
  the four real components, passing the real `DashboardData` slices
  (`data.thresholds`, `data.deadlines`, `data.completeness`,
  `data.pendingCounts`).

## Limitations

- `ThresholdSection` progress bar width is the only derived value
  (`currentValue / thresholdValue`); it is a presentation aid, not a business
  calculation. Capped at 0–100% and guarded for `thresholdValue === 0`.
- `DeadlineSection` uses the pure `daysRemaining(date, asOfDate)` helper from
  the domain for the "N days remaining" text — this is a display helper, not a
  deadline calculation.
- `CompletenessReport` deliberately has no percentage or score (by Step 18
  design); the component shows only the satisfied/total counts.
- `ActionSection` is purely presentational — it does not calculate, filter, or
  prioritize. It renders the four counts exactly as the data layer produces
  them.
- No `Priority` type exists in the domain; the original broken
  `Record<Priority, number>` prop was an invention that has been removed.
