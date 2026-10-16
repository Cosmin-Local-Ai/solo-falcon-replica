# Step 24 — Dashboard Polish

## Status
complete

## Objective
Polish the Dashboard's six sections with the missing utility classes so status chips, muted text, section labels, and financial values render consistently — without touching design tokens, `:root`, or any component.

## What changed
One block appended at the end of `src/styles.css` (14 rules, all existing `:root` tokens):

| Selector | Role |
|---|---|
| `.badge` | base chip: inline-flex pill, 12px/600, transparent border |
| `.badge-success` / `.badge-warning` / `.badge-danger` / `.badge-info` | status chips on the soft token backgrounds (with matching border tints) |
| `.badge-neutral` | neutral chip (`--bg` + `--border`) |
| `.muted` | secondary text (`--text-3`) |
| `.stack` | vertical flex stack, 14px gap |
| `.kv` / `.kv dt` / `.kv dd` | label/value grid rows (13px label, 13.5px/600 right-aligned value) |
| `.label` | 11px uppercase section label (`--text-3`) |
| `.value` | 24px/700 tabular-nums financial value |
| `:focus-visible` | visible keyboard focus ring: 2px solid `--primary`, 2px offset (was missing entirely) |

## Mobile (≤640px) fix
One `@media (max-width: 640px)` block added after the existing 1024px/900px media queries in `src/styles.css` (4 rules):

| Selector | Role |
|---|---|
| `.sidebar` | hidden on mobile (`display: none`) — no longer eats 56% of the 390px viewport |
| `.main-content` | padding reduced from `24px 28px 48px` to `16px` |
| `.grid-5` | collapses to a single column |
| `.stat-grid` | wraps tightly with `minmax(140px, 1fr)` |

- 390px verified fixed: cards fit within the viewport, no horizontal overflow
- 768px layout unaffected (breakpoint sits below it)

## Why
- Consistent status chips, muted text, section labels, and financial values across the 6 dashboard sections
- Focus ring and chart a11y polish
- Reused existing design tokens only — no new tokens, no `:root` changes, no component changes

## Verification
- `npx tsc --noEmit` — pass
- `npm run build` (vite) — pass
- `npx vitest run` — 231 tests passed (21 files), 0 failures
- 4-viewport check (1440/1024/768/390): no horizontal overflow, all 6 dashboard sections render, badge colors verified
- a11y spot-checks: badge text, focus ring, chart a11y, heading hierarchy — pass
- Screenshots: `/tmp/solo-task-24/shot-{1440,1024,768,390}.png`

## Constraints honored
- `:root` untouched (no new tokens)
- No component changes
- No new files in `src/`

## Files changed
- `src/styles.css` — appended "Step 24 — Dashboard polish" block (14 rules) + 640px mobile media query (4 rules)
- `docs/ai/steps/24_dashboard_polish.md` — this document
