# Brief 22 — TASK 6: rule-release immutability (the one not to let slip)

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

**Engine instability — known, and not your fault.** The local model engine (`host.docker.internal:8080`) runs `n_ctx: 262144` with a ~47 GB arena and roughly **390 MiB of free headroom**, one slot. It gets SIGKILLed (`exit -9`) under a heavy context. If your process is killed, **your on-disk work survives** — resume and continue rather than restarting from scratch. Keep contexts lean: prefer `read_symbol` / narrow reads over re-reading whole large files.

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

## THE DECISION IS ALREADY MADE — do not reopen it
**Content-address the rule set; do not redesign the release model.** This is a recorded decision, not a proposal. You are adding a content hash and a real lifecycle to what exists, not inventing a new release architecture.

## THE DEFECT — verified by the Orchestrator at `76f480b`
A stored snapshot freezes release **metadata**, not the rules that produced it:
- `src/domain/snapshots/snapshot.ts:44` stores `ruleRelease: RuleRelease` — the release **object**.
- `src/domain/fiscal/release2026.ts:4` `releaseId: 'PFA_2026_SYSTEM_REAL'` and `:65` **`createdAt: '2026-01-01'`** — and **neither value changed across the Phase 3, 4 and 5 formula corrections** (CAS, CASS, income tax). The law the app computes changed; the identity that is supposed to pin it did not.

Consequence: a stored snapshot cannot be reproduced or audited. Two snapshots with the same `releaseId` can encode different arithmetic, and nothing in the record says which. That is the whole task.

## SCOPE
1. **A content hash over the effective rule set, embedded in the snapshot.** The hash must cover the **parameter values and formula-bearing content**, not the release's name or date.
2. **Canonical serialisation is mandatory.** A hash over `JSON.stringify` of an object graph is only stable if key order is stable. Pin it with a test that re-serialises the same rule set built through a different path and asserts the same digest.
3. **Real `createdAt`**, and a per-rule `version` that bumps when the **legal or formula content** materially changes — not a display number.
4. **Lifecycle, documented and enforced:** `PROPOSED → VALIDATED → STAGED → SCHEDULED → ACTIVE → SUPERSEDED`. A revision gets a **new identity**; never an in-place edit of an ACTIVE rule.
5. **Superseded releases stay readable**, so an old snapshot can still be interpreted.
6. **Find and name every place permanently hard-wired to the 2026 constants instead of selecting by `taxYear` / effective date / state.** The Orchestrator already located these — expect them and check for more:
   - `src/pages/Expenses.tsx:8, 186, 204`
   - `src/data/derived.ts:15, 41, 75, 86, 98, 99`
   - `src/data/dashboard.ts:34, 122, 127`
   **Do NOT build future-year automation.** The goal is a correct boundary, not a calendar feature. A single active release selected by date is enough; what must be impossible is a call site that hard-codes the release and thereby silently re-binds old calculations to new law.
7. **Fixtures, in this exact order:** R1 ACTIVE → R2 becomes ACTIVE later → **an R1 snapshot still reproduces R1's numbers** → a new calculation uses R2. The third step is the one that matters; if it passes only because nothing changed, the fixture is worthless.

## LANDMINES
- **Do not silently re-hash existing snapshots.** TASK 3 established that `inputSnapshot` is the enumerated subset `{profile, revenues, expenses}` and that a stored digest moving requires a migration chain step. Decide explicitly, and record, whether the rule-set hash belongs to the **calculation record** or to the **input snapshot** — they are different things, and putting it in the wrong one either invalidates stored history or fails to pin the law. If existing stored snapshots must change shape, that is a **data version bump (currently 8)** with a named chain step, and it must not fabricate a hash for a snapshot whose rules can no longer be reconstructed — say so in the record instead of guessing one.
- **A hash is not a legal citation.** The hash pins *which parameters were used*; the article citations stay where they are. Do not let `sourceUrl` regress to `research/06_2026_fiscal_research.md` or `decisions/09_IMPLEMENTATION_ARCHITECTURE.md`, which are **not** authoritative.
- **No floating-point money.** `Bani` + `decimal.js-light`.
- **Keep consuming `snapshot.taxReserve` / `DashboardData.reserve`** — never re-derive the reserve gap.
- **TASK 5 just landed** (`649e0f1`): the pension fact model, `pensionFacts.ts`, migration v8, and eight sites where a legal conclusion is deliberately withheld. Do not disturb those; read `docs/ai/phases/19_pension_cass_input_model.md` first.
- **Never** delete an assertion, loosen a matcher or widen a timeout. I diff the test files.
- **Figures should not move:** seed deductible 120,00 / 144,00 lei, VNA 9.096,00 · impozit 819,00 · total 3.249,00 · reserve 1.083,00. If one moves, re-derive by hand first and record old → new.

## BASELINE (measured by the Worker at `649e0f1`, re-confirmed by the Orchestrator)
`tsc` 0 · **57 files / 984 tests** · `build` 0 · `e2e` **36 passed** (26 `dashboard` + 10 `settings`).

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
- TASK 5 — pension / CASS input model — DONE (`649e0f1`, plus `76f480b` fixing the „nu înregistrat" grammar)
- **TASK 6 — rule-release immutability ← THIS BRIEF**
- TASK 7 — user-facing language layer (now also carries a native-speaker **grammar** sweep)
- TASK 8 — prioritisation, severity, rendering
- TASK 9 — provenance + seed + layout hygiene (includes the browser reload test, which takes e2e 36 → 37)
- TASK 10 — currency on the money record + FX rate store (defect B-32; research 23)

11. e-Factura reader (XML only) · 12. XML schema validation · 13. mapping to internal model · 14. import preview + duplicate detection · 15. import commit · 16. reconciliation · 17. D430 generation · 18. D430 validation · 19. D430 export · 20. e-Tachigraphe graph · 21. VIES + ANAF status · 22. Dashboard UX polish · 23. testing + hardening · 24. documentation + handoff

## ACCEPTANCE
- Two rule sets that differ in any formula-bearing parameter produce **different** digests; the same rule set always produces the **same** digest regardless of construction path.
- A snapshot records the digest of the rules that produced it, and an R1 snapshot still reproduces R1's numbers after R2 becomes active.
- `createdAt` is real; per-rule `version` moves only with material legal/formula change.
- The lifecycle is enforced in code, not documented only; an ACTIVE rule cannot be edited in place.
- Every hard-wired `PFA_2026_*` call site is either selected by date/year/state or explicitly justified as a fixed boundary, and the list is named in the phase doc.
- Whether stored snapshots migrate is decided **explicitly**, with the reasoning recorded; no snapshot is re-hashed by guesswork.
- `tsc` 0 · `npm run test` green with **new counts reported** · `build` 0 · `e2e` **36 passed**, every re-pinned figure recorded old → new.
- `docs/ai/phases/20_rule_release_immutability.md` records the hash scheme and its canonical serialisation, the lifecycle, the migration decision, every call site, and the implication for TASK 9 (provenance) and TASK 10 (a rate store needs the same immutability discipline).

## HANDOFF
`NEXT HANDOFF:` must state the exact hash input and canonicalisation, where the digest is stored, the migration decision and version number, the list of de-hard-wired call sites, and what TASK 9 must surface to the user about which rules produced a number.
