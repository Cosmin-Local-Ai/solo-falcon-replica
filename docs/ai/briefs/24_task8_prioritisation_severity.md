# Brief 24 — TASK 8: prioritisation, severity and rendering

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
5. Each Scout inspects the smallest relevant territory and returns a compact report.
6. If the Worker finds missing local information, it spawns another narrow Scout — it does not search broadly.
7. One Worker = one coherent, tightly scoped job.
8. Do NOT spawn a post-Worker Scout verification pass. The Worker self-validates instead.
9. Self-validate with the narrowest useful checks: npx tsc --noEmit, npm run build, npm run test, npm run test:e2e.
10. Do not start future phases. Stop when this phase's acceptance criteria are met.

**Scout infrastructure — known defect.** The scout profile's default model produces no output. **Use the explicit override `llama-cpp/qwen3.8-flash-next-iq3_s` from the start.** If it fails too, STOP and report a BLOCKER.

**Engine instability — known.** The local engine (`host.docker.internal:8080`) runs `n_ctx: 262144` with a ~47 GB arena and roughly **390 MiB of free headroom**, one slot, and gets SIGKILLed (`exit -9`) under load. If your process is killed, **your on-disk work survives** — resume and continue. Checkpoint early and often.

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
- `docs/ai/phases/18_threshold_semantics.md` §13 — the exact `kind` union, and that **`severityFor` reads `{ applicability, status, distance, warningDistance }` and cannot read the kind.** Keep that structural independence; do not reintroduce it at the render layer.
- `docs/ai/phases/21_language_layer.md` §10 — the copy keys you **must** use: `copy.severity` (`none` / `low` / `medium` / `high`), `copy.actions.count(n)`, `copy.actions.emptyDescription` / `emptyBody`, `copy.deadlines` / `copy.completeness` / `copy.legislation`. **The guard test will reject a new inline sentence** — that is by design.
- `docs/ai/phases/19_pension_cass_input_model.md` — the withheld-conclusion sites; attention items must not resolve them.

## WHAT EXISTS TODAY — verified by the Orchestrator at `884d0e4`
- **`Insight` collapses everything into one field:** `severity: 'info' | 'warning' | 'danger'` (`src/domain/insights.ts:14-20`), alongside `title` / `description` / `action`. Legal status, urgency and the kind of thing are fused into one word.
- **`insights.ts` emits exactly four ids:** `reserve`, `completeness`, `tax`, `fiscal-dates`.
- **The seed holds four genuinely unresolved items and none of them surface:**
  - `seed.ts:46` revenue `r2` — `status: 'in-asteptare'`, eFactura `În așteptare`
  - `seed.ts:47` revenue `r3` — `status: 'respinsa'`, `statusDetail: 'CUI nevalid'`, eFactura `Respinsă`
  - `seed.ts:67` expense `e3` — `status: 'respinsa'`, `statusDetail: 'Document neconform'`
  - `seed.ts:76` declaration `d2` — `status: 'in-asteptare'` (June 2026, registered but not filed)
  A user looking at the dashboard sees **nothing actionable** about any of these.
- **`data.actions` is a separate pipeline:** `getActionItems(data, instant)` (`dashboard.ts:461`) feeding `ActionSection`, distinct from `Insights`. That is where the duplicate card + action risk lives.
- **`copy.legislation.empty` reads `'Nicio modificare viitoare verificată.'`** — with `getLegislationState` sitting on a placeholder boundary (`dashboard.ts:342`: *"AppData has no legislation data — placeholder boundary only, no ingestion"*). Saying „no verified change" to a user who has no monitor is not the same statement, and reads as reassurance.

## SCOPE
1. **Build the shared attention model with four dimensions that are never collapsed into one field:** `severity` · `state` · `source` · `title` / `description` / `target`. A row must be able to say *what it is*, *where it came from*, *how urgent it is for this user*, and *where to act*, independently. `Insight.severity` as it stands cannot express "legally load-bearing, not urgent" or "urgent, purely administrative".
2. **Make the real work appear.** The four seed items above must surface as attention items, each with a **target** that goes to the actual record, and each carrying its real reason (`CUI nevalid`, `Document neconform`, awaiting e-Factura acceptance, declaration registered but not filed). Do not invent a reason the data does not hold.
3. **Completed items leave the attention surfaces.** An item that has been resolved must not linger. **Empty sections collapse** rather than rendering a large empty card.
4. **No duplicate card + action for the same issue.** Reconcile `Insights` and `getActionItems` so one problem produces one thing to act on. If they must stay separate pipelines, the deduplication has to be explicit and tested, not incidental.
5. **Legislation honesty.** When the monitor holds no verified data, say **monitoring is unavailable / inactive** — never that there is nothing to know. And the published-vs-effective minimum-wage case already in the rule store (**HG 146/2026**, 4.325 lei from 1 iulie 2026, which does **not** re-anchor FY2026 because of art. 135¹ alin. (3)) should surface **with whether it affects this user** — that last part is the whole point.
6. **The tax estimate must visually distinguish `computed` / `review-required` / `unavailable`.** Three different epistemic states, not one number with a footnote.
7. **Severity rendering.** The *Praguri* badge still shows `status`; rows expose `data-severity`. Style from `severity`, never re-derive it from `kind`, `status` or distance at the render layer.

## BOUNDARIES — do not blur these
- **TASK 9** wires provenance (`snapshotRuleState` / `resolveSnapshotRules`, the four states, `copy.provenance`) and does the seed/layout/docs hygiene, including the Playwright reserve-reload test that takes **e2e 36 → 37**. You define nothing there; you may leave the surfaces it needs in place.
- **TASK 10** owns currency and FX. Do not convert euro parameters, do not invent lei figures.
- **TASK 7 is done.** The copy layer exists and the guard test has an **empty allow-list**. Every new sentence goes in `src/ui/copy/`.

## LANDMINES
- **Surfacing rejected/pending records is presentation, not recalculation.** `r3` and `e3` are `respinsa` and must stay **out** of the aggregate and out of the deductible subset; `d2` must not change any filing figure. If surfacing an item moves a money figure, you have changed the calculation — stop and report it.
- **Adding attention items will change counts** the e2e pins (e.g. `getByText('3 elemente de rezolvat')`). Re-pin them, **replace rather than delete**, and record old → new.
- **`currentReserveBani` trap:** the card renders `TaxReserveRecommendation.reservedAmount`, already `Bani | null` since TASK 3. `DashboardSnapshot.taxReserve.currentReserveBani` is still `Bani` with a `?? 0`. **If any card you build reads the snapshot aggregate instead, widen it to `Bani | null` first** and assert the `null` vs `0` difference.
- **Do not soften a withheld conclusion.** Every `unknown` / `REVIEW_REQUIRED` / Notă de interpretare stays withheld; an attention item may say it needs attention, never resolve it.
- **Never present the 10 % band as statutory; never present a lei amount as statutory text; never re-introduce *dezcalificare* / *schimbare de regim*.** The language test and e2e absence assertions will fail.
- **No floating-point money.** `Bani` + `decimal.js-light`.
- **Never** delete an assertion, loosen a matcher or widen a timeout. I diff the test files.
- **Figures must not move:** seed deductible 120,00 / 144,00 lei, VNA 9.096,00 · impozit 819,00 · total 3.249,00 · reserve 1.083,00 · hero 51.510 lei.

## BASELINE (measured by the Worker at `e4e6820`, re-confirmed by the Orchestrator)
`tsc` 0 · **62 files / 1076 tests** · guard test 5 passed, allow-list empty · `build` 0 · `e2e` **36 passed** (26 `dashboard` + 10 `settings`).

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
- TASK 5 — pension / CASS input model — DONE (`649e0f1`, grammar `76f480b`)
- TASK 6 — rule-release immutability — DONE (`29f104e`, `f3eada7`, `6e86caa`)
- TASK 7 — user-facing language layer — DONE (`0d73308`, `c64299e`, `4304c39`, `e4e6820`, `884d0e4`)
- **TASK 8 — prioritisation, severity, rendering ← THIS BRIEF**
- TASK 9 — provenance + seed + layout hygiene (includes the browser reload test, e2e 36 → 37)
- TASK 10 — currency on the money record + FX rate store (defect B-32; research 23)

11. e-Factura reader (XML only) · 12. XML schema validation · 13. mapping to internal model · 14. import preview + duplicate detection · 15. import commit · 16. reconciliation · 17. D430 generation · 18. D430 validation · 19. D430 export · 20. e-Tachigraphe graph · 21. VIES + ANAF status · 22. Dashboard UX polish · 23. testing + hardening · 24. documentation + handoff

## ACCEPTANCE
- The attention model carries `severity`, `state`, `source`, and `title`/`description`/`target` as **independent** dimensions; a test shows two items differing on one dimension while agreeing on the others.
- All four seed items (`r2`, `r3`, `e3`, `d2`) surface, each with its real reason and a working target to the record.
- Resolved items leave the surfaces; empty sections collapse; no issue appears twice with both a card and an action.
- The legislation section states that monitoring is unavailable rather than that nothing exists, and the HG 146/2026 case surfaces with its effect on this user (none, per art. 135¹ alin. (3)).
- The tax estimate renders `computed`, `review-required` and `unavailable` as visually distinct states.
- Severity is styled from `severity`; nothing re-derives it from `kind` or distance.
- Every new sentence is in `src/ui/copy/`; the guard allow-list is still empty.
- `tsc` 0 · `npm run test` green with **new counts reported** · `build` 0 · `e2e` **36 passed**, every re-pinned count/string recorded old → new.
- `docs/ai/phases/22_prioritisation_severity.md` records the attention model, the deduplication rule, what surfaced and why, the re-pins, and what TASK 9 inherits.

## HANDOFF
`NEXT HANDOFF:` must state the attention-item type and its dimensions, where severity is read from, how `Insights` and `getActionItems` were reconciled, which surfaces TASK 9 may add provenance to, and whether `currentReserveBani` was widened.
