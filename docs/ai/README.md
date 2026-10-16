# SOLO Replica — project documentation

Documentation for the `solo-falcon-replica` project, maintained per task.

## Start here, in this order

| # | File | What it answers |
|---|---|---|
| 1 | **`notes/defects_in_plain_language_2026-10-16.md`** | Every open defect in plain language, with difficulty and whether it changes a taxpayer's money. **Written for a reader who is not a developer and not an accountant.** |
| 2 | **`PG13_GO_NO_GO.md`** | The release gate. Verdict, the measured baseline, and the specific conditions that block a release. |
| 3 | **`PHASE_PLAN_11_34.md`** | The authoritative defect register (136 rows) and the phase order with a verdict per phase. **§4a is generated, not typed** — see below. |
| 4 | `STATE.md` | Current project state and the measured test figures. |
| 5 | `USER_DECISIONS.md` | Decisions only the owner can make, with the reasoning and the date. |

## Layout

- `PLAN.md` — overall project plan.
- `PHASE_PLAN_11_34.md` — the defect register and phase order. **The single source of truth for defect status.**
- `PG13_GO_NO_GO.md` — release go / no-go, a living document. Its own rule: *if your task changes a row here, it has not finished until the row is updated.*
- `STATE.md` — current state, measured figures.
- `USER_DECISIONS.md` — decision records requiring the owner.
- `briefs/` — one file per dispatched work package, numbered. Each carries the working contract used for that pass.
- `phases/` — one file per completed phase, with the evidence that closed it.
- `research/` — research notes, numbered. **Check these before re-deriving any legal or technical fact** (standing rule §12.18).
- `steps/` — one document per task step; `_TEMPLATE.md` for the format.
- `decisions/`, `notes/`, `data/` — decision records, working notes, and data notes.
- `tools/register_rollup.py` — generates the register roll-up. **Standard library only.**

## Two things worth knowing before reading the register

**Defect status is structural, not prose.** Every row opens its `Defect` cell with a token — `[OPEN]`, `[CLOSED 2026-MM-DD]`, `[BLOCKED: research]`, `[BLOCKED: decision]`, `[BLOCKED: chain]`, `[PARKED]`, `[REFUTED]` — and any id that is not open is struck through. **A refuted row keeps its original claim, struck, as evidence.**

**The roll-up is generated.** Everything between the `ROLLUP:…:BEGIN` / `:END` markers in `PHASE_PLAN_11_34.md` is written by `tools/register_rollup.py`. Run it after editing any row; `--check` exits non-zero instead of writing, for use as a gate. **It fails loudly when the token counts disagree with the row count** — that disagreement is the reason the script exists. Two hand-counted tables in this file were stale within a day of being written.

## Current stack

React 18.3.1, Vite 5.4.8, TypeScript 5.6.2, Node v24.21.0. Test tooling: Vitest 3.2.7 (with jsdom and Testing Library) for unit and integration tests, Playwright 1.63 for end-to-end (reuses the existing Chromium). See `steps/08_stack_setup.md`.

**Running the gates:** `npm run test` (unit) and `npm run test:e2e` (end-to-end). **The e2e parallelism cap was removed on 2026-10-16** — its stated justification, that RAM was the scarce resource, was never measured and is false on the development machine. What remains is the discipline that actually mattered: **run each gate once, at the end, backgrounded to a log, and read the log once.** See §12.20 for the correction and why a guard with an unexamined premise is worse than no guard.
