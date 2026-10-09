# Brief 20 — TASK 4: threshold semantics and applicability

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
4. **OVERRIDE — Scouts run SEQUENTIALLY.** Spawn Scouts **one at a time, waiting for each report before spawning the next.** Parallel scouting is suspended for this round (the user is timing sequential vs parallel on their own machine). Do not run a Researcher concurrently with a Worker.
5. Each Scout inspects the smallest relevant territory and returns a compact report: exact files, symbols, current behavior, constraints, handoff notes.
6. If the Worker finds missing local information, it spawns another narrow Scout — it does not search broadly.
7. One Worker = one coherent, tightly scoped job. It changes only what its job requires.
8. Do NOT spawn a post-Worker Scout verification pass. The Worker self-validates instead.
9. The Worker MUST self-validate with the narrowest useful checks: npx tsc --noEmit, npm run build, npm run test, npm run test:e2e, scoped to what it changed.
10. Do not start future phases. Stop when this phase's acceptance criteria are met.

**Scout infrastructure — known defect.** The scout profile's default model produces no output. **Use the explicit override `llama-cpp/qwen3.8-flash-next-iq3_s` from the start.** If it fails too, STOP and report a BLOCKER; never substitute broad self-directed searching.

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

## SOURCE AUTHORITY
**`docs/ai/research/24_cas_floor_consequence_2026.md`** is the legal basis for this task. Its two closing sections — **`## What the app may state as law`** and **`## What the app must not state`** — are the acceptance boundary for every string you write. `research/06_2026_fiscal_research.md` and `decisions/09_IMPLEMENTATION_ARCHITECTURE.md` are **not** authoritative and must never be cited as `sourceUrl`.

## THE CORE FINDING — verified, and it condemns existing code
**Nothing in the Codul fiscal attaches any adverse consequence to net income from independent activities being below 12 × salariul minim.** The 12-SM figure is the **entry threshold** for the CAS obligation (art. 148 alin. (1)) and the **minimum** chosen base (art. 148 alin. (2) lit. a)). Below it, the legal consequence is simply **nu datorează contribuția de asigurări sociale**, with an optional election to pay (art. 148 alin. (4)).

Research 24 searched and found **zero** occurrences of „decălificare" anywhere in the Codul fiscal, and **no** provision making income below 12 SM a breach, a regime change, a mandatory rectification, a penalty, or a reportable event.

**The app currently says the opposite.** `src/domain/thresholds.ts:247` `breachMeaningFor` returns:
- `'Sub baza minimă — dezcalificare din regim'`
- `'Peste plafonul maxim al bazei — schimbare de regim'`

**Both strings are unsupported by any primary source. Delete them — do not reword them.** A reworded version keeps asserting a legal consequence the law does not create.

## SCOPE
1. **Replace the single `breached` flag with a typed `kind` plus a separate user severity.** Kinds: `registration` · `tier_transition` · `over_limit` · `informational`. **Below a contribution floor is `tier_transition` or `informational`, never a breach.**
2. **Delete `breachMeaningFor` and the two strings above.** Where a row needs an explanation, it states the factual consequence research 24 supports, with its citation — e.g. *„Venitul net anual din activități independente este sub pragul de 12 salarii minime brute pe țară; în consecință, nu se datorează contribuția de asigurări sociale pentru acest an (art. 148 alin. (1) și (4) din Codul fiscal). Opțiunea pentru plata CAS este disponibilă, la un venit ales de cel puțin 12 salarii minime brute."*
3. **Applicability is computed from the profile / fiscal context**, not assumed:
   - CASS rows respect the salary / pension / top-up exceptions (art. 174 alin. (2), (6), (7)).
   - `VAT_REGISTRATION` is applicable only when the user's VAT state makes it matter.
   - A row that is not applicable renders as not applicable — it does not show a breach at all.
4. **The 10 % warning distance stays an application policy, labelled as such.** It is not a statutory fact and must never be presented as one.
5. **User severity is a separate dimension** from legal/calculation status. A row can be legally `informational` and still be worth showing the user; a row can be legally load-bearing and not urgent.
6. **Label the asymmetry TASK 1 left behind — do not unify it.** The four contribution rows measure **annual projected** VNA while `VAT_REGISTRATION` measures **YTD** turnover. That is intentional. Each row must state which basis it measured.
7. **Lei figures must be labelled as computed, never as the text of the law.** Art. 148 states only multipliers of „salariul minim". The lei amounts (48.600 / 97.200 lei) come from ANAF guidance using the SM in force at **1 ianuarie 2026 (4.050 lei, HG 1.506/2024)**, while **HG 146/2026 raised SM to 4.325 lei from 1 iulie 2026**. Research 24 records as **UNVERIFIED** which vintage governs the FY2026 CAS thresholds — art. 148 has no reference-date clause. So: cite the SM value and its HG, and do not present a lei amount as statutory.
8. **Tests:** a below-floor row is not a breach; an inapplicable row does not render as a breach; severity and legal kind are independent; the deleted strings appear nowhere (assert their absence, not just the new copy).

## BOUNDARY WITH TASK 7 (do not blur it)
This task **removes false legal claims and adds the kind/applicability/severity model**. The **user-facing language layer** — tone, terminology, the full copy rewrite across the app — is **TASK 7**. Write only the copy you must, to replace what you delete, and keep it factual and cited.

## LANDMINES
- **If any warning copy names the amount the user has reserved**, then `DashboardSnapshot.taxReserve.currentReserveBani` must become `Bani | null` — it currently coerces `?? 0`, and `0` would state a fact about a user who recorded nothing (TASK 3's handoff flags this explicitly).
- **Keep consuming `snapshot.taxReserve` / `DashboardData.reserve`.** Re-deriving the reserve gap would reintroduce the TASK 2d ceiling disagreement.
- **Do not invent a lei figure for the 25.000 euro regime trigger** (art. 69 alin. (9)). It converts at the BNR **annual average for the year of income realisation** — a *different anchor* from the art. 68 caps' year of payment. The FX store is **TASK 10**; until it exists, that threshold stays unconverted and says so.
- **Do not touch** the CAS ladder itself (`thresholds.ts` 12 SM / 24 SM minima and the 72 SM CASS cap are correct and verified — `thresholds.ts:149-150,155,189-191`). You are changing what a crossing *means*, not the numbers.
- **No floating-point money.** `Bani` + `decimal.js-light`.
- **Never** delete an assertion, loosen a matcher or widen a timeout. Assertions pinning the deleted strings must be **replaced** with assertions pinning the correct behaviour. I diff the test files.
- **Figures should not move:** seed deductible 120,00 / 144,00 lei, VNA 9.096,00 · impozit 819,00 · total 3.249,00 · reserve 1.083,00. If one moves, re-derive by hand first and record old → new.

## BASELINE (measured by the Orchestrator at `698e180`)
`tsc` 0 · **55 files / 889 tests** · `build` 0 · `e2e` **36 passed**.

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
- TASK 2a — the deductibility rule set (39 rules on CF art. 68) — DONE (`1583d9e`)
- TASK 2b — record, migration, wiring, minimal UI — DONE (`1490bdb`)
- TASK 2c — annual caps, single two-pass — DONE (`f1caa36`)
- TASK 2d — pre-cap operative, post-cap surfaced — DONE (`431afaf`)
- TASK 3 — persist the tax reserve — DONE (`698e180`)
- **TASK 4 — threshold semantics and applicability ← THIS BRIEF**
- TASK 5 — pension / CASS input model
- TASK 6 — rule-release immutability
- TASK 7 — user-facing language layer
- TASK 8 — prioritisation, severity, rendering
- TASK 9 — provenance + seed + layout hygiene (now includes the browser reload test, which takes e2e 36 → 37)
- TASK 10 — currency on the money record + FX rate store (defect B-32; research 23)

11. e-Factura reader (XML only) · 12. XML schema validation · 13. mapping to internal model · 14. import preview + duplicate detection · 15. import commit · 16. reconciliation · 17. D430 generation · 18. D430 validation · 19. D430 export · 20. e-Tachigraphe graph · 21. VIES + ANAF status · 22. Dashboard UX polish · 23. testing + hardening · 24. documentation + handoff

## ACCEPTANCE
- No row can render a breach for income below a contribution floor.
- `breachMeaningFor` and both false strings are gone; their absence is asserted by a test.
- Every threshold row carries a typed `kind`, an applicability decision derived from the profile, and a severity independent of its legal kind.
- Every row states which basis it measured (annual projected vs YTD).
- Any lei amount derived from SM is labelled as computed, with the SM value and its HG cited.
- `tsc` 0 · `npm run test` green with **new counts reported** · `build` 0 · `e2e` **36 passed**, every re-pinned figure recorded old → new.
- `docs/ai/phases/18_threshold_semantics.md` records the kind model, what was deleted and why (citing research 24), the applicability rules, files changed, and the implication for TASK 7 and TASK 8.

## HANDOFF
`NEXT HANDOFF:` must state the exact `kind` union, where severity is computed, which rows are now conditionally applicable, and what TASK 7 may and may not reword.
