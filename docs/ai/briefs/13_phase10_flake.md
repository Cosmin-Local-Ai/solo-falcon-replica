# Brief 13 — the Phase 10 flake. One defect. Nothing else.

**Orchestrator brief, 2026-10-08. One Worker, sequential. Authoritative scope — re-read it if compacted.**

## The defect

`src/pages/Dashboard.test.tsx > Dashboard page > shows the computed estimate in the cockpit for a PFA profile on the
lawful regime` **fails intermittently in the full suite and passes in isolation.**

Measured by the Orchestrator at HEAD `d0b0ad7`:
- `npx vitest run src/pages/Dashboard.test.tsx` → **5 passed, 5 of 5 runs.**
- `npm run test` (full suite) → **1 failed / 759 passed in 1 of 4 runs**; 760 passed in the other 3.

So it is **not** a bad assertion. It is **shared mutable state leaking between test files or between tests under
scheduling pressure.** Phase 10 added `MoneyPrecisionNotice` and a `moneyNotices` payload field that rides through
save/load — the prime suspect is `localStorage` / the quarantine key / a seeded payload surviving from a sibling test
or sibling file, so the cockpit renders a notice or a stale figure depending on what ran first.

## Rules

1. **Never fix a flake by weakening, deleting, skipping, retrying or `.todo`-ing the assertion.** The fix is to remove
   the shared state, not to make the test forgiving. A `retry: 3` or a `waitFor` that swallows the difference is a
   failure, not a fix.
2. **Reproduce first.** Run the full suite enough times to see it fail. **A fix you could not reproduce is not a fix** —
   if you cannot make it fail, say so and stop rather than shipping a guess.
3. Then run the full suite **at least 10 consecutive times** and report the pass count of each run. Ten greens is the
   acceptance criterion. One green is not.
4. **Do not change any fiscal behaviour, any money value, any rounding, any legal citation.** This is a test-isolation
   fix. If the cause turns out to be a real product bug rather than test pollution, **STOP and report it** — do not fix
   product behaviour inside this brief.
5. **Never report a note count or amendment count** for any legal act.
6. Baseline at `d0b0ad7`: `npx tsc --noEmit` **0** · `npm run test` **48 files / 760 tests** · `npm run build` **0** ·
   `npm run test:e2e` **36 passed**. Keep all four green.

## Also fix — two documentation errors, docs only

- **`docs/ai/phases/10_money_precision.md` claims all four checks were green.** They were green on the runs the Worker
  measured, but the suite is intermittently red. Correct the claim to state what is actually reproducible, and record
  this flake.
- **`docs/ai/STATE.md` has no `B-17` row.** The register runs B-1…B-16, B-18…B-21, B-23, B-24, B-25, B-26 — **B-17 was
  never a row**, yet `STATE.md` line 3 and the phase doc both assert "B-17 is closed". Add the row and close it properly
  with the evidence, or correct the prose. A defect that exists only in prose is how this project loses items.

## Deliverable

1. The isolation fix, with the cause named in the commit message.
2. The two doc corrections.
3. **Ten consecutive full-suite runs, each with its number reported.**
4. Handoff format: `COMPLETED:` / `FILES CHANGED:` / `TESTS:` / `VALIDATION:` / `DECISIONS:` / `BLOCKERS:` / `NEXT HANDOFF:`
