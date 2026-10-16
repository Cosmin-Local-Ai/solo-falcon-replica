# Brief 23 — TASK 7: the user-facing language layer

## GLOBAL CONTRACT — APPLY TO EVERY PROMPT

You are the LEAD ORCHESTRATOR for this step only.

The project AI ecosystem is:
- SCOUT = local repository inspection only; read-only; NEVER modifies files
- RESEARCHER = internet research only; primary/official sources only
- WORKER = implementation, focused testing, documentation, self-validation
- ORCHESTRATOR = coordination, sequencing, synthesis, handoff

Worker rules
1. Never run more than ONE Worker at a time. Workers are sequential.
2. The Orchestrator spawns the Worker and MUST give it the complete phase list, not a partial one.
3. The Worker MUST spawn the Scouts it needs before modifying anything, and MUST use their reports rather than broadly searching the repository itself.
4. **OVERRIDE — Scouts run SEQUENTIALLY.** One at a time, waiting for each report before spawning the next. Do not run a Researcher concurrently with a Worker.
5. Each Scout inspects the smallest relevant territory and returns a compact report: exact files, symbols, current behavior, constraints, handoff notes.
6. If the Worker finds missing local information, it spawns another narrow Scout — it does not search broadly.
7. One Worker = one coherent, tightly scoped job. It changes only what its job requires.
8. Do NOT spawn a post-Worker Scout verification pass. The Worker self-validates instead.
9. Self-validate with the narrowest useful checks: npx tsc --noEmit, npm run build, npm run test, npm run test:e2e, scoped to what it changed.
10. Do not start future phases. Stop when this phase's acceptance criteria are met.

**Scout infrastructure — known defect.** The scout profile's default model produces no output. **Use the explicit override `llama-cpp/qwen3.8-flash-next-iq3_s` from the start.** If it fails too, STOP and report a BLOCKER; never substitute broad self-directed searching.

**Engine instability — known.** The local model engine (`host.docker.internal:8080`) runs `n_ctx: 262144` with a ~47 GB arena and roughly **390 MiB of free headroom**, one slot, and gets SIGKILLed (`exit -9`) under a heavy context. If your process is killed, **your on-disk work survives** — resume and continue. Checkpoint early and often. Keep contexts lean: prefer `read_symbol` / narrow reads over re-reading whole large files.

Worker handoff format (mandatory)
```
COMPLETED:
FILES CHANGED:
TESTS:
VALIDATION:
DECISIONS:
BLOCKERS:
NEXT HANDOFF:
```

## HYGIENE
- Phase docs → `docs/ai/phases/NN_<name>.md`. Never touch `docs/ai/steps/` (frozen archive).
- `docs/ai/PLAN.md` / `docs/ai/STATE.md` are the live shared state.
- **Date stamps from the tool:** `date +%F` or `git log -1 --format=%cd --date=short`.
- **Validation uses the runner's own exit status** (`set -o pipefail`, never a piped `grep`).

## READ THESE HANDOFFS FIRST
- `docs/ai/phases/18_threshold_semantics.md` §13 — the `ThresholdKind` union, where severity is computed, and the note that **`snapshot.taxReserve.currentReserveBani` is still `Bani` with a `?? 0` coercion and must become `Bani | null` before any copy names a reserved amount.**
- `docs/ai/phases/19_pension_cass_input_model.md` — the eight sites where a legal conclusion is deliberately withheld, and what TASK 7 must say about the art. 174 alin. (2) / alin. (6) uncertainty.
- `docs/ai/phases/20_rule_release_immutability.md` — `snapshotRuleState` / `resolveSnapshotRules` and the four provenance states. **Wiring those is TASK 9, not you** — but you are building the copy keys it will use.

## WHAT EXISTS TODAY — verified by the Orchestrator at `6e86caa`
- **There is no copy layer at all.** Sentences live inline in components and pages.
- Enum tokens are mostly mapped to Romanian labels correctly (`ThresholdSection.tsx:32` maps `review_required` → „De verificat"), **but `src/pages/Settings.tsx:918` renders the literal token to the user**: `„review_required" pentru că nu a găsit nicio regulă aplicabilă; valoarea calculată…` — alongside statute paragraphs. This is the loudest instance of the defect.
- TASK 5 added six Settings dropdowns whose labels were `nu înregistrat` — ungrammatical. Already corrected to `nu este înregistrat` at `76f480b`; treat that as the model for the grammar pass, not as finished work.

## SCOPE
1. **One central copy layer.** Every user-visible sentence lives there, typed, with a key. No sentences inline in components. Choose the location and justify it; it must be a **UI-layer** home, not inside `src/domain`.
2. **A guard test that keeps it that way.** Follow the precedent of `thresholds.language.test.ts` and the `registry.test.ts` source-tree scan: walk the source tree and fail when a user-visible sentence literal appears in a component or page outside the copy layer. Use an **explicit allow-list that may only shrink**. Do not make the rule so blunt it bans every string — it must target sentence-shaped literals.
3. **Never render an enum.** `review_required`, `computed`, `breached`, `min-base`, `not_applicable`, `tier_transition`, `over_limit`, `pinned`, `drifted`, `unregistered`, `unpinned` are internal names. Every one that reaches the UI goes through the copy layer.
4. **The „Notă de interpretare" pattern — one component, one shape.** Where the law does not settle something, show the label plus **one plain sentence naming what the law does not state and what the app does about it.** This must be reusable, because there are already at least eight such sites (TASK 5) plus the art. 68 alin. (6) pre-cap/post-cap choice (TASK 2d) plus the 10 % warning band (TASK 4). Do not let each site improvise its own wording.
5. **Collapse the detail, but never hide it behind hover.** Breakdown behind **„Cum am ajuns la această sumă"**; sources and interpretation notes behind **„Surse și note de interpretare"**. Both must be real disclosure controls — keyboard-operable, state visible, content present in the DOM or reachable without a pointer. Hover-only is a failure.
6. **Grammar pass by a native speaker, not just terminology.** Sweep for: bare `nu` + past participle with no auxiliary; calques from English word order; agreement errors; and any internal token rendered as if it were Romanian. `nu este înregistrat` is the reference fix.
7. **Fix `Settings.tsx` properly.** It currently prints the literal `review_required` plus statute paragraphs at once. The user needs to know *what is uncertain and what to do*, not to read the Cod fiscal in a settings panel. Statute text belongs behind the sources disclosure, with the citation kept.

## BOUNDARIES — do not blur these
- **TASK 8** owns prioritisation and severity rendering: the shared attention model, real work surfacing from the seed, empty-section collapsing, no duplicate card + action. You build the **words and the disclosure structure**; you do not decide what ranks first.
- **TASK 9** owns provenance surfacing: wiring `snapshotRuleState` / `resolveSnapshotRules`, the four states, the seed and layout hygiene, and the Playwright reload test (which takes e2e 36 → 37). You define the copy keys it will need and say so in the handoff; you do **not** wire it.
- **TASK 10** owns currency and FX. Do not invent lei figures for euro parameters.

## LANDMINES
- **If any copy you write names the amount the user has reserved, change `DashboardSnapshot.taxReserve.currentReserveBani` to `Bani | null` first.** `0` would state a fact about a user who recorded nothing. TASK 3 made `null` and `0` genuinely different throughout the app; the snapshot aggregate is the last place still coercing.
- **Copy changes will re-pin e2e text assertions.** That is expected — but each re-pin must be **replaced, never deleted**, and recorded old → new. `e2e/dashboard.spec.ts` asserts specific Romanian strings (e.g. `Bază măsurată: cifra de afaceri înregistrată de la începutul anului`, `Venituri înregistrate`, `Cheltuieli înregistrate`).
- **Do not change semantics while rewording.** No calculation, no threshold applicability, no `unknown` handling may move. If a reword seems to require one, that is a finding to report, not a licence to do it.
- **Do not soften a withheld conclusion into a confident one.** Every `unknown` / `REVIEW_REQUIRED` / Notă de interpretare must stay withheld; the copy may explain it, never resolve it.
- **Citations stay.** `sourceUrl` must never point at `research/06_2026_fiscal_research.md` or `decisions/09_IMPLEMENTATION_ARCHITECTURE.md` — pinned by a test since TASK 6.
- **No floating-point money.** `Bani` + `decimal.js-light`.
- **Never** delete an assertion, loosen a matcher or widen a timeout. I diff the test files.
- **Figures should not move:** seed deductible 120,00 / 144,00 lei, VNA 9.096,00 · impozit 819,00 · total 3.249,00 · reserve 1.083,00 · hero 51.510 lei.

## BASELINE (measured by the Worker at `29f104e`, re-confirmed by the Orchestrator)
`tsc` 0 · **61 files / 1071 tests** · `build` 0 · `e2e` **36 passed** (26 `dashboard` + 10 `settings`).

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
1. Real baseline + documentation truth — DONE
2. Verified 2026 fiscal baseline + rule provenance — DONE
3. CAS correction — DONE
4. CASS correction — DONE
5. 2026 income tax correction — DONE
6. Fiscal regime + profile foundation — DONE
7. Identity source of truth + persistence versioning/migration — DONE
8. Financial amount semantics — DONE
9. Payment / collection dates — DONE
9b. Rule-driven deadlines + legal citations — DONE
10. Money precision (integer bani + decimal.js-light) — DONE

**Pre-Phase-11 corrections (this round):**
- TASK 1 — projection feeds the annual estimate — DONE (`c49d88f`)
- TASK 2a / 2b / 2c / 2d — expense deductibility, rules, caps, pre-cap base — DONE (`1583d9e`, `1490bdb`, `f1caa36`, `431afaf`)
- TASK 3 — persist the tax reserve — DONE (`698e180`)
- TASK 4 — threshold semantics and applicability — DONE (`8750402`)
- TASK 5 — pension / CASS input model — DONE (`649e0f1`, grammar fix `76f480b`)
- TASK 6 — rule-release immutability — DONE (`29f104e`, `f3eada7`, `6e86caa`)
- **TASK 7 — user-facing language layer ← THIS BRIEF**
- TASK 8 — prioritisation, severity, rendering
- TASK 9 — provenance + seed + layout hygiene (includes the browser reload test, e2e 36 → 37)
- TASK 10 — currency on the money record + FX rate store (defect B-32; research 23)

11. e-Factura reader (XML only) · 12. XML schema validation · 13. mapping to internal model · 14. import preview + duplicate detection · 15. import commit · 16. reconciliation · 17. D430 generation · 18. D430 validation · 19. D430 export · 20. e-Tachigraphe graph · 21. VIES + ANAF status · 22. Dashboard UX polish · 23. testing + hardening · 24. documentation + handoff

## ACCEPTANCE
- One copy layer holds every user-visible sentence; a source-tree guard test enforces it with an allow-list that did not grow.
- No enum token reaches the UI anywhere; `Settings.tsx:918` no longer shows `review_required`.
- One reusable „Notă de interpretare" component, used by every uncertainty site, each with one plain sentence on what the law does not state and what the app does.
- Breakdown and sources sit behind real disclosure controls, keyboard-operable, never hover-only.
- The grammar sweep is reported with the list of phrases changed and why.
- If any copy names a reserved amount, `currentReserveBani` is `Bani | null` and the `null` vs `0` distinction is asserted.
- `tsc` 0 · `npm run test` green with **new counts reported** · `build` 0 · `e2e` **36 passed**, every re-pinned string recorded old → new.
- `docs/ai/phases/21_language_layer.md` records the copy-layer design, the guard test and its allow-list, the Notă pattern, every re-pinned e2e string, and the copy keys TASK 8 and TASK 9 must use.

## HANDOFF
`NEXT HANDOFF:` must state the copy-layer module and its key naming, the guard test's allow-list contents, the Notă de interpretare component's props, which keys TASK 8 and TASK 9 should consume, and whether `currentReserveBani` was made nullable.
