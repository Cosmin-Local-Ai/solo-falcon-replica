# SOLO Replica AI — Project Documentation

Documentation for the solo-falcon-replica project, maintained per task.

## Layout
- `PLAN.md` — overall project plan.
- `STATE.md` — current project state.
- `steps/` — one document per task step (see `_TEMPLATE.md` for the format).
- `decisions/` — decision records.
- `research/` — research notes.

## Current stack
React 18.3.1, Vite 5.4.21, TypeScript 5.9.3, Node v24.21.0. Test tooling:
Vitest 3.2.7 (+ jsdom, Testing Library) for unit/integration tests and
Playwright for E2E (reuses the existing Chromium). See
`steps/08_stack_setup.md` for details.
