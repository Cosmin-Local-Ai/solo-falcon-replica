# Brief 25 — TASK 9: provenance, seed and hygiene

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
- `docs/ai/phases/22_prioritisation_severity.md` — the `AttentionItem` type, `getAttentionItems` as the **single** producer, and the surfaces TASK 8 explicitly left you: **`Insights` rows, `ActionSection` rows, the legislation cards, and the estimate hero.**
- `docs/ai/phases/21_language_layer.md` §10 — `copy.provenance` already exists and is **not wired**: `pinned(releaseId)`, `drifted`, `unregistered(releaseId)`, `unpinned`, `noRelease`, `label`, `digestIsNotACitation`.
- `docs/ai/phases/20_rule_release_immutability.md` — `snapshotRuleState` / `resolveSnapshotRules` in `src/domain/snapshots/ruleProvenance.ts`, and the four states.

## WHAT THIS TASK IS
Small, mechanical, and deliberately kept separate from the eight substantive tasks so it cannot contaminate them. Two halves: **provenance surfacing**, and **hygiene**. Do not redesign anything while you are in there.

## PART A — provenance
1. **Wire `snapshotRuleState` / `resolveSnapshotRules` into the surfaces TASK 8 named**, using `copy.provenance`. **All four states must be renderable**, and a test must show each one, not just `pinned`.
2. **`unpinned` is the state most of this app's history is in** — every snapshot created before TASK 6 has `ruleSetHash: null`. The copy already says the rules behind that number cannot be reconstructed. **Render that honestly; do not backfill a digest.**
3. **`drifted` must be surfaced, never repaired.** If a registered rule set no longer matches a recorded digest, that is an in-place edit of a published release. Show the mismatch. Re-hashing to make the warning go away destroys the only evidence.
4. **A digest is never a legal citation.** The article stays on screen *beside* it. `copy.provenance.digestIsNotACitation` states this; keep it visible wherever a digest appears.

## PART B — hygiene, item by item (each verified by the Orchestrator at `bab4a46`)
1. **Secondary citations in production.** `grep legalteka` returns **9 occurrences in 5 files**, and two of them are **production rule metadata**: `src/domain/fiscal/release2026.ts:108-109` cite `legalteka.ro` as the source for **HG 1.506/2024** and **HG 146/2026**. Replace with the primary text, or downgrade the citation honestly. The official references are already known from research 25: **HG 1.506/2024, MO nr. 1185 din 28.11.2024** and **HG 146/2026, MO nr. 196 din 13.03.2026**. Note that research 25's own sources for the *values* (mmuncii.gov.ro, infodosar.ro) are **also secondary** — prefer legislatie.just.ro / the Monitorul Oficial entry, and if you cannot reach a primary URL, say so in the record rather than swapping one secondary for another.
2. **The seed is incoherent, and one of the plan's claims about it is wrong.** Verified: `seed.ts:28-31` gives a **PFA** file the identity `denumire: 'Popescu Consulting SRL'`, `formaJuridica: 'SRL'`, `numarRegComert: 'J40/1234/2020'`; `pfaStartYear: 2020`; and declarations `d1` (March) and `d2` (June) carry `venituri` / `cheltuieli` that **no seed transaction supports** — every seed revenue is dated September 2026. **The plan also claims the user's own CUI collides with a customer CUI. The Orchestrator could not reproduce that** (`seed.ts:29` is `RO4455667788990`; the customer CUIs are `RO12345678`, `1234567890123`, `9876545678`-style values). **Verify it before "fixing" it** — if it does not reproduce, record that the claim is stale rather than inventing a collision.
   Fixing the seed changes what the dashboard shows, so **re-derive every affected figure by hand first** and record old → new. If the SRL identity is what makes some test pass, that is a finding about the test.
3. **Layout.** The mobile chart overflows at 390 px (renders ~657 px, clipped), and there are **two card systems** with mixed h2/h3 and inconsistent padding. Make headings and padding consistent. Verify at 390 px in a real browser, not by reading CSS.
4. **The Playwright reserve-reload test** (user decision, 2026-10-09). TASK 3 proved the round trip in jsdom against real `localStorage`; this one must exercise a **real browser's storage lifecycle**: record a reserve, reload, assert the same value. **This takes e2e from 36 to 37.** Update every place that pins "36 passed" — `STATE.md`, the plan, and any brief note — so the next task's baseline is not a lie.
5. **Docs hygiene.** `docs/ai/briefs/` holds **two briefs numbered 14** (`14_projection_tax_estimate.md`, `14_task1_projection_estimate.md`), and `docs/ai/phases/` holds **`_WORKING_NOTES_phase10.md`** and **`_WORKING_NOTES_task1.md`**. Renumber or retire them so the sequence is unambiguous. Never touch `docs/ai/steps/`.
6. **Date stamps from git**, not from the model's guess.

## LANDMINES
- **`currentReserveBani` is still `Bani` with a `?? 0`** — TASK 8 confirmed no card reads the snapshot aggregate. **If any provenance surface you add reads it, widen it to `Bani | null` first** and assert the `null` vs `0` difference.
- **Do not backfill digests, rule versions, or seed facts to make a warning disappear.** TASK 6 refused to fabricate history; that stance is inherited by this task.
- **Do not change the calculation.** Seed fixes may change what is *displayed*; they must not change the tax engine's rules. If a seed fix moves a figure, re-derive it by hand and record old → new.
- **Copy goes in `src/ui/copy/`.** The guard test has an **empty allow-list** and will reject an inline sentence.
- **Never** delete an assertion, loosen a matcher or widen a timeout. I diff the test files.
- **Figures at baseline:** seed deductible 120,00 / 144,00 lei, VNA 9.096,00 · impozit 819,00 · total 3.249,00 · reserve 1.083,00 · hero 51.510 lei.

## BASELINE (measured by the Worker at `c6a2d5d`/`bab4a46`)
`tsc` 0 · **63 files / 1121 tests** · guard allow-list empty · `build` 0 · `e2e` **36 passed** (26 `dashboard` + 10 `settings`).

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
- TASK 8 — prioritisation, severity, rendering — DONE (`c6a2d5d`, `bab4a46`)
- **TASK 9 — provenance + seed + layout hygiene ← THIS BRIEF**
- TASK 10 — currency on the money record + FX rate store (defect B-32; research 23)

11. e-Factura reader (XML only) · 12. XML schema validation · 13. mapping to internal model · 14. import preview + duplicate detection · 15. import commit · 16. reconciliation · 17. D430 generation · 18. D430 validation · 19. D430 export · 20. e-Tachigraphe graph · 21. VIES + ANAF status · 22. Dashboard UX polish · 23. testing + hardening · 24. documentation + handoff

## ACCEPTANCE
- All four provenance states render, each with a test; `drifted` is surfaced and never repaired; the article is always visible beside a digest.
- No `legalteka.ro` URL remains in production code; every remaining secondary citation is either replaced with a primary one or explicitly downgraded in the record.
- The seed is internally coherent (PFA identity, start year, declarations supported by transactions), with every affected figure re-derived by hand and recorded old → new; the unreproducible CUI-collision claim is recorded as verified-or-stale, not "fixed".
- The chart fits 390 px in a real browser; one card system, consistent headings and padding.
- The Playwright reserve-reload test exists and passes; **e2e is 37**, and every document pinning 36 is updated.
- Brief numbering is unambiguous and the `_WORKING_NOTES_*` files are out of `docs/ai/phases/`.
- `tsc` 0 · `npm run test` green with **new counts reported** · `build` 0 · `e2e` **37 passed**.
- `docs/ai/phases/23_provenance_hygiene.md` records the provenance wiring, every seed change with its re-derivation, the citation replacements, and the new e2e baseline for TASK 10.

## HANDOFF
`NEXT HANDOFF:` must state the new e2e baseline, the seed's new figures with their derivations, which surfaces carry provenance, and what TASK 10 must not re-derive.
