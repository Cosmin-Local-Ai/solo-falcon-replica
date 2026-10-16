# Brief 17 — TASK 2c: the annual / cross-record deductibility caps

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
4. Scouts may run in parallel when their questions are independent.
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
Legal basis: **`docs/ai/research/21_expense_deductibility_framework_2026.md`** and **`docs/ai/research/22_deductibility_caps_and_conversion_2026.md`** (the caps' base, rate and date mechanics). `research/06_2026_fiscal_research.md` and `decisions/09_IMPLEMENTATION_ARCHITECTURE.md` are not authoritative and must never be cited as `sourceUrl`.

**Read research 22 before writing any cap code.** Where it says UNVERIFIED, the cap stays unresolved and the expense stays excluded with the missing fact named. **Inventing an exchange rate, a conversion date, or a vehicle designation is the failure mode of this task.**

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
- **TASK 2c — the annual / cross-record caps ← THIS BRIEF**
- TASK 3 — persist tax-reserve state (two read sites: `dashboard.ts:169` **and** `:263`)
- TASK 4 — threshold semantics and applicability
- TASK 5 — pension / CASS input model
- TASK 6 — rule-release immutability
- TASK 7 — user-facing language layer
- TASK 8 — prioritisation, severity, rendering
- TASK 9 — provenance + seed + layout hygiene

11. e-Factura reader (XML only) · 12. XML schema validation · 13. mapping to internal model · 14. import preview + duplicate detection · 15. import commit · 16. reconciliation · 17. D430 generation · 18. D430 validation · 19. D430 export · 20. e-Tachigraphe graph · 21. VIES + ANAF status · 22. Dashboard UX polish · 23. testing + hardening · 24. documentation + handoff

## WHAT 2b LEFT FOR YOU (verified at `1490bdb`)
`src/domain/estimateBasis.ts` — `selectDeductibleExpenses` (line ~268) and `selectEstimateOperands` (line ~451). The deductible subset is applied to the **`AppData` fed to both selectors**, because `selectProjectionV1` (`projection.ts:100`) re-runs `selectYtd` internally. The per-record 50 % vehicle cap is applied and floored. Everything with a cross-record base is marked **`capUnresolved`** and excluded:

| `cap_base` | Rules affected |
|---|---|
| `art68_alin6_base` | `_PROTOCOL_` (2 %) |
| `annual_eur_per_person` | `_PRIVATE_SCHOLARSHIP_` (5 %), `_PRIVATE_PENSION_`, `_OCCUPATIONAL_PENSION_`, `_PEPP_`, `_VOLUNTARY_HEALTH_INSURANCE_`, `_ETF_PURCHASE_` (400 EUR), `_SPORTS_SUBSCRIPTION_` (100 EUR), `_PROFESSIONAL_BODY_DUES_` (4.000 EUR) |
| `annual_per_vehicle` | the one-car-per-person limit, art. 68 alin. (5) lit. j) |
| `annual_salary_expense` | `_SOCIAL_EXPENSES_` (5 % of annual payroll) |
| `gross_income` | `_PROFESSIONAL_CONTRIBUTION_` (5 % of gross) |

Baseline: `tsc` 0 · **51 files / 832 tests** · `build` 0 · `e2e` **36 passed**.

## SCOPE
Resolve the caps that the sources fully determine, and keep honest the ones they do not.

1. **The protocol base is a single two-pass, not an iteration.** Art. 68 alin. (6) defines the base as gross minus deductible expenses **other than protocol and private scholarships**. Because the excluded set is exactly those two capped categories, the base is stable: compute the deductible total excluding protocol and burse private, take 2 % of (gross − that), then let the allowed protocol amount into the final deductible total. **Do not iterate to a fixed point** — the statute excludes them precisely so the base does not depend on the capped items.
2. **Euro caps only if research 22 settles the rate AND the date.** If it does, convert with `decimal.js-light` and keep the result in `Bani`. If it does not, the cap stays `capUnresolved` and the expense stays excluded, with `missingFact` naming exactly what is missing (e.g. „cursul BNR de referință și data de conversie nu sunt stabilite de normă"). **Never pick a rate.**
3. **One car per person.** If the record cannot identify which vehicle an expense belongs to, do **not** guess and do not pick "the first one". Keep it `undetermined` with the missing fact named. Adding a vehicle identity to the record is only acceptable if research 22 shows the norms key the cap to something the app can hold.
4. **Social expenses (5 % of annual payroll).** If the app holds no payroll data, the honest outcome is decided by research 22: either the base is genuinely 0 (no employees ⇒ nothing deductible) or it is `undetermined`. Do not silently treat "no data" as "zero" unless the sources support that reading.
5. **Caps are annual; the estimate is a projection.** This is the trap. A per-record 50 % cap is scale-invariant, so 2b could apply it to YTD and let the projection scale it. **An annual cap is not scale-invariant:** capping the YTD actual and then multiplying by 12/10 is not the same as capping the projected annual figure. Decide explicitly which basis the statutory annual limit applies to, implement that one, and say so in `DECISIONS:` with the reasoning. Getting this wrong produces a plausible number that is wrong at year end — and it moves again every day.
6. **Tests:** the protocol two-pass with a worked example whose arithmetic is in the test comment; a euro cap resolved (or provably still unresolved, with the missing fact asserted); the one-vehicle limit enforced or refused; the annual-cap-vs-projection basis pinned by a test that would fail if the cap were applied to the wrong basis.

## LANDMINES
- **Do not change `tax.ts` formulas.** Caps belong in the assembler.
- **Figures will move again.** Re-pin protocol-affected figures by deriving them **by hand before running**, arithmetic in a comment, old → new recorded. Never delete an assertion, loosen a matcher or widen a timeout.
- **Snapshot digests.** `snapshot.ts` digests the aggregate, not record arrays. If your change alters a *stored* aggregate, existing digests move — report it; a blanket re-hash migration is forbidden, and only a targeted id-scoped tier in `src/data/migration.ts` is acceptable, and only if stored bytes genuinely change.
- **No floating-point money.** `Bani` + `decimal.js-light`. A currency conversion is the most likely place this slips in.
- **Do not touch** the tax reserve (TASK 3), thresholds (TASK 4), or any UI beyond what a cap explanation needs.

## ACCEPTANCE
- Every cap whose base, rate and date are settled by research 22 is computed, and the deductible total reflects it.
- Every cap that is not settled remains excluded, with the missing fact named on screen — not silently dropped.
- The annual-cap basis (actual vs projected) is stated and pinned by a test.
- `tsc` 0 · `npm run test` green with **new counts reported** · `build` 0 · `e2e` **36 passed**, every re-pinned figure recorded old → new.
- `docs/ai/phases/15_deductibility_caps.md` records: which caps are now enforced, which remain unresolved and why, the annual-basis decision, files changed, and the exact implication for TASK 3.

## HANDOFF
`NEXT HANDOFF:` must state the exact deductible quantity now entering the operands, which `cap_base` values are still unresolved, and what TASK 3 must not disturb (`getTaxReserve` at `dashboard.ts:199`/`:205` and `buildSnapshot` at `:298` consume `tax.output.total`; the reserve must consume the estimate, never recompute it).

---

## ORCHESTRATOR DECISIONS — taken from research 22, binding on this task

Research 22 settled the *rule* for every cap. For some caps the app still lacks the *datum*. That distinction decides the task.

| Cap | Rule settled? | App holds the datum? | Do this |
|---|---|---|---|
| Protocol 2 %, burse private 5 % (alin. (5) a–b + alin. (6)) | **Yes** | Yes (gross + expenses) | **Compute.** Single two-pass, no iteration. |
| Contribuții profesionale 5 % of gross (lit. q) | **Yes** | Yes | **Compute**, applying the cap (see conflict 3). |
| Cheltuieli sociale 5 % of payroll (lit. c) | Yes | **No** — the app has no payroll concept | **`undetermined`**, naming the missing fact. Do **not** assert the ceiling is 0: "no data" is not "no employees". |
| Euro caps 400 / 100 / 4.000 EUR (g, g¹, g², h, p, r, s) | Yes — BNR **annual average for the payment year**, HG 1/2016 pct. 7 alin. (6) | **No** — the app stores no FX rate | **Stay excluded**, with `missingFact` naming the exact datum *and* the rule. **Never hard-code a rate.** |
| One car per person (lit. j) | **No** — no primary source says which car | n/a | **Stay excluded**, `missingFact` = the law does not select the car. **Never pick one.** |
| 50 % vehicle haircut (alin. (7) k) | Yes | Yes | Already applied per record by 2b. Leave it. |

**Three unresolved conflicts, and how the app must behave in each.** In every case the conservative reading is the one that *understates* the deduction — the user is never led to underpay:

1. **Which conversion rule governs the euro caps.** HG 1/2016 pct. 7 alin. (6) says BNR **annual average for the payment year**; CF art. 9 alin. (3) lit. b) + alin. (4) say BNR **rate on the payment date**, excepted only by rules „prevăzute expres în prezentul cod" — and the norms are not „prezentul cod". No primary text reconciles them. **Surface the conflict; do not resolve it silently.**
2. **Does „pentru fiecare persoană" multiply by insured/covered persons?** Unresolved. Use **one cap per taxpayer** (the smaller allowance) and record it as an interpretation.
3. **alin. (4) lit. i) lists contribuții profesionale as generally deductible (uncapped) while alin. (5) lit. q) caps it at 5 %.** Unresolved. **Apply the cap** and record the conflict on the rule.
4. **Is „cheltuielile deductibile" in alin. (6) measured before or after the other alin. (5) caps?** Unresolved; no norm fixes an order (negative finding: zero occurrences of „protocol", „ordinea", „în ordine" in the chapter). Use the **post-cap** reading — the word „deductibile" plus the heading „deductibile limitat" support it, and it yields the smaller base and the smaller protocol allowance. Record both readings and the delta.

**FY2026 date gates the rules must already carry** (research 22 §7): lit. g¹)/g²) capture only contributions **paid from 2026-03-01**; lit. s) only amounts **paid and settled from 2026-03-01**; for pensii facultative in 2026 the 400 EUR test **also counts payments made 2026-01-01 – 2026-02-28**. If a rule in `deductibility2026.ts` does not already encode this, fix the rule, not the caller.

**Do not hard-code an entry-into-force date for Legea 227/2015 or for HG 1/2016** — research 22 verified publication dates (MO 688/10.09.2015; MO 22/13.01.2016) but explicitly could not establish entry into force from the texts read.

---

4. ~~alin. (6) base measured before or after the other alin. (5) caps: post-cap reading (smaller base, smaller allowance)~~ — **corrected by TASK 2c: my rationale was inverted.** Post-cap subtracts only the *allowed* lit. q) amount, so it leaves a **larger** base and a **larger** protocol allowance (pinned example: **146,30 lei used vs 54,00 lei** under the pre-cap reading). The post-cap reading is still the one implemented — „cheltuielile deductibile" plus the heading „deductibile limitat" support it — but it is the **less conservative** of the two, and the delta is reported on the result (`baseAlt` / `ceilingAlt`) rather than buried. Open question for the user, not for a Worker: whether to keep the textually-supported reading or switch to the pre-cap reading, which understates the deduction and so can never cause an underpayment.
