# Brief 12 — PHASE 10: money representation and rounding policy

**Orchestrator brief, 2026-10-08. Worker scope. One Worker, sequential.**
**This file is the authoritative scope. If your context is compacted, re-read this file before continuing.**

---

## The two decisions are already made. Do not re-litigate them.

1. **Representation — HYBRID** (user, 2026-10-08): **integer cents (bani) for persisted money**, and
   **`decimal.js-light` for intermediate calculations**. Not a decimal-everywhere rewrite, not float-with-rounding.
2. **Rounding policy — art. 66 alin. (1) applied to all three lines, explicitly marked as an extension** (user,
   2026-10-08, after verification). See §Rounding below. This is a deliberate legal inference and it must be labelled
   as one in code and in the phase doc.

## Why now

The pre-Phase-10 leftovers closed first (user's ordering decision), at `565d763`/`d1d2e9b`: B-23, B-21,
P-PROFILE-VAT-DATE, B-19, Phase 6 §7.5, and §7.8/§7.9 recorded as blocked. **Baseline you must reproduce before and
after:** `npx tsc --noEmit` **0** · `npm run test` **44 files / 685 tests** · `npm run build` **0** ·
`npm run test:e2e` **34 passed**. If any is red when you start, **stop and report it** — never fix a red baseline by
deleting or weakening assertions.

---

## The defect this phase exists to fix

Money is **float lei end to end**, and two display paths therefore disagree.

- Float everywhere: `FiscalParameter.value` (`domain/fiscal/rules.ts:14`), `CalculatorInput.base`
  (`domain/fiscal/calculators.ts:9`), `YtdTotals` (`domain/aggregation.ts:17-25`), `CalculationLine.value`
  (`domain/snapshots/types.ts:30`), `PfaProfile.cashFloorLei` (`domain/models.ts:84`).
- **Float `+=` accumulation** at `domain/aggregation.ts:97, 98, 103, 104`.
- Cents appear **only as display conversion** (`aggregation.ts:60-65`, produced at `data/dashboard.ts:230-235`, divided
  back at `domain/insights.ts:36-37`) — i.e. the app converts to cents and back, which is how drift gets introduced.
- **`decimal.js-light` is a declared dependency (`package.json:16`) that is imported nowhere in `src/`.** The archived
  `decisions/09_IMPLEMENTATION_ARCHITECTURE.md:43,202` claims it is used. **That claim is false.**

### The four register rows this phase owns

| ID | Defect |
|---|---|
| **B-17** | **Two display paths disagree by a half-cent: 674,51 lei vs 674,50 lei for the same money.** The one defect here a user can actually notice. |
| **B-18** | Float accumulation plus `Math.round` in the chart layer. |
| **B-20** | The `totalDue` type is a lie. |
| **B-16** | A rounding rule asserted with no legal basis. |

---

## Rounding — the legal position, verified against primary text

This was researched and then **independently re-verified by a fresh session with no shared history**. Full detail:
`docs/ai/research/20_cf_art66_rounding_and_art154_cass_exemption_2026.md`.

**CF art. 66 alin. (1), verbatim and confirmed:**
> *„Sumele sunt calculate prin rotunjire la un leu, prin neglijarea fracțiunilor de până la 50 de bani inclusiv și
> majorarea la leu a fracțiunilor ce depășesc 50 de bani."*

Note the tie-break: **exactly 50 bani rounds DOWN** („până la 50 de bani **inclusiv**"). This is not banker's rounding
and it is not half-up. **Do not implement `Math.round` semantics** — `Math.round(0.5)` rounds up, which is the opposite
of the law at the boundary.

**The gap, and it is real:** `rotunj*` returns **exactly 5 hits in the entire fiscal code** — art. 66, 77, 300, 315⁴,
342 — and **ZERO hits in Titlul V „Contribuții sociale obligatorii"**, which is where CAS and CASS live. The official
D212 completion instructions (Portal Legislativ doc **306268**, anexa nr. 2, 196,033 chars) return **0** for `rotunj`,
`zecimale`, `rotunjire`, `rotunjit` and `\bleu\b`. **Art. 66 sits in Titlul IV, Impozitul pe venit.**

**User's decision: apply art. 66 to income tax, CAS and CASS alike, but mark it as an extension.** Therefore:

- **One named function** is the only place rounding happens. Nothing else may round money. Not the formatters, not the
  chart layer, not the pages.
- Its provenance must state plainly that **art. 66 alin. (1) is a Titlul IV rule applied by analogy to the Titlul V
  contribution lines, because Titlul V contains no rounding rule.** It must **not** present the extension as a Titlul V
  requirement.
- **Never report a note count or amendment count** for any legal act.

---

## Tasks

### T1 — One money representation

Introduce **integer bani** as the persisted and domain currency for money, with `decimal.js-light` for intermediate
arithmetic. Convert the float sites listed above. **A raw `67450` must never reach a screen** — the boundary that
renders lei is a single, named conversion.

**Migration is the risky part and rule 5 applies absolutely:** existing persisted float-lei values must convert to
integer bani **without silently changing any user's money**. Decide and state how a value like `674.504` converts, and
prove no record's amount changes by an unintended amount. **Do not drop or zero anything.** A persisted value that
cannot be converted must surface, not vanish.

### T2 — One rounding function, with the policy isolated and named

Implement the art. 66 rule **exactly**: fraction **≤ 50 bani → down**, **> 50 bani → up**. Isolate it so the policy can
be changed centrally, as the original phase objective requires. Delete the scattered `Math.round` / `toFixed` on money
(`toFixed` on money appears at `pages/Documents.tsx:417`; B-18's `Math.round` is in the chart layer).

Then **fix B-17**: after T1+T2 there must be exactly one path from stored money to displayed lei, so the two formatters
cannot disagree. **Add a test that pins the two previously-disagreeing cases to one value.**

### T3 — B-20: make `totalDue` tell the truth

The type currently asserts something the data does not support. Either compute it or change the type — **do not paper
over it with a cast.**

### T4 — No money arithmetic in JSX

Any money calculation performed inside a component moves to the domain/data layer. The chart layer's float accumulation
(B-18) is included.

### T5 — Write `docs/ai/phases/10_money_precision.md`

State the representation, the migration rule, the rounding policy **with its extension label**, the four register rows
and what closed them, and **what you deliberately did not touch**. Say in one line that this document supersedes the
frozen `docs/ai/steps/*` archive where they disagree — including the false `decimal.js-light` claim.

---

## Invariants the previous pass added. Do not break them.

From `docs/ai/phases/11_pre_phase10_leftovers.md` §8 — read it:

- **Strict date parsing at the write boundary**; `inPeriod` **never defaults to "in period"**.
- **A stored CASS exemption flag never renders as a computed zero** — it renders `Necunoscut` with a `de verificat`
  chip and carries `review_required`.
- **A `tier-floor` threshold is never labelled a ceiling.**
- **`vatExceedanceDate` is write-only**; absence is correct silence.
- **No test may read the wall clock.** `src/test/wallClockGuard.test.ts` now **enforces** this mechanically. If your
  changes need a clock read in a test, use the documented `PIN` exemption — do not weaken the guard.
- **Any new fiscal input is write-only with an explicit `null` / `undefined` distinction**, so "not provided" stays
  distinguishable from "zero". **Phase 10 depends on this** — it is the same distinction that keeps `0 lei` from being
  mistaken for "no value".

## Explicitly OUT of scope

- **§7.8 CAEN-keyed rules and §7.9 a richer VAT regime — blocked on source.** No norm-of-income values exist in the
  2026 sources of record. Writing a CAEN→threshold table from memory would be a fabricated fiscal rule.
- **The remaining production wall-clock reads** (`domain/date.ts:21`, `data/dashboard.ts`, `domain/fiscal/deadlines.ts`,
  `components/dashboard/DeadlineSection.tsx`, `pages/Documents.tsx:426`, `Revenues.tsx:28`, `Expenses.tsx:26`,
  `Declarations.tsx:28`, `Settings.tsx:226`) and the 4 wall-clock-dependent e2e assertions
  (`e2e/dashboard.spec.ts:216,219,223,289`). **Record them; do not fix them here.** They are a separate pass.
- **B-24 is closed.** Do not resurrect the quarterly deadline rules.
- **No new legal research.** If you need it, stop and report.

## Deliverable

1. The code changes, with tests. **One commit per task.**
2. `docs/ai/phases/10_money_precision.md`.
3. `STATE.md`: close B-17, B-18, B-20, B-16 — **only if actually closed.** Annotate anything left.
4. The four verification numbers, **actually measured**.
5. The mandatory handoff format.

**Report honestly.** A partially-completed phase honestly reported is worth more than a completed one that quietly
invented something. **Every phase so far has caught the previous one overclaiming — including this orchestrator's own
briefs. That is the behaviour I want, not full marks.**

---

# CONTRACT AND PHASE LIST — copied verbatim from brief 11 so this brief is self-contained

# GLOBAL EXECUTION CONTRACT — applies to this brief in full

You are the **WORKER** for this step only. The project AI ecosystem:

- **SCOUT** = local repository inspection only; read-only; **NEVER modifies files**
- **RESEARCHER** = internet research only; primary/official sources only
- **WORKER** = implementation, focused testing, documentation, self-validation
- **ORCHESTRATOR** = coordination, sequencing, synthesis, handoff

## Worker rules (mandatory)

1. **You are the only Worker. Never spawn another Worker. Workers are sequential.**
2. **The complete phase list is below — it is complete, not partial.** Do not invent a phase boundary. A partial list
   in an earlier phase caused a Worker to invent one; do not repeat that.
3. **You MUST spawn the Scouts you need BEFORE modifying anything, and you MUST use their reports rather than broadly
   searching the repository yourself.**
4. **Scouts may run in parallel** when their questions are independent. They are the only thing allowed to run
   concurrently — never a second Worker.
5. Each Scout inspects the **smallest relevant territory** and returns a compact report: exact files, symbols, current
   behaviour, constraints, handoff notes.
6. If you find missing local information, **spawn another narrow Scout — do not search broadly.**
7. **One Worker = one coherent, tightly scoped job.** Change only what this brief's tasks require.
8. **Do NOT spawn a post-Worker Scout verification pass.** Self-validate instead.
9. **Self-validate with the narrowest useful checks:** `npx tsc --noEmit`, `npm run test`, `npm run build`,
   `npm run test:e2e`, scoped to what you changed. Report the real numbers.
10. **Do not start Phase 10 or any future phase. Stop when this brief's acceptance criteria are met.**

## MANDATORY START-OF-JOB PROTOCOL — read this before you touch a file

**Do not modify a single file until every Scout report has come back.** The order is fixed:

1. **Spawn the Scouts first.** Minimum set, one question each, all independent, all in parallel:
   - **Scout A — date handling.** `src/domain/date.ts`, `src/domain/aggregation.ts` (`inPeriod`), `src/data/schema.ts`,
     `src/data/seed.ts`. What validates a date today, where do date strings enter, what would rejecting at the schema
     boundary break? Exact files, symbols, current behaviour, constraints.
   - **Scout B — deadline plumbing.** `src/domain/deadlines.ts` (`DeadlineQuery`, `pfaStartDate` /
     `vatExceedanceMonth`), `src/domain/models.ts` (`PfaProfile`), `src/data/store.tsx` migration chain. How does a
     profile value reach `computeDeadlines` today, and what is the minimal path for a VAT exceedance date?
   - **Scout C — CASS exemption surface.** Every read of `socialInsuranceStatus` and `exempt` / `neplata` across
     `src/domain`, `src/data`, `src/components`, `src/pages`. Which code paths can output CASS = 0, and which already
     carry `review_required` or provenance?
   - **Scout D — threshold surface.** `src/domain/thresholds.ts` and the CAS tier ladder from Phase 3
     (`calcCas`, `src/domain/fiscal/calculators.ts`, `package2026.ts`). Where are thresholds surfaced in the UI today,
     and what threshold types already exist?
   - **Scout E — test-clock audit.** Every `new Date()` / `Date.now()` in `src/**` and `e2e/**`, split into
     assertions vs. setup vs. comments.
2. **Wait for all of them.** Read their reports. **Do not begin editing while any Scout is still running.**
3. **Then edit.** Use their reports; do not re-derive the repository by broad search.
4. If a Scout fails with a connection error: **retry once with an explicit working-model override. If that also fails,
   STOP and report it to me as a BLOCKER. Do NOT silently substitute your own broad self-inspection for the Scout** —
   that is a known infrastructure defect, not something to work around quietly.

## Worker handoff format (mandatory — use these exact headings)

```
COMPLETED:
FILES CHANGED:
TESTS:
VALIDATION:
DECISIONS:
BLOCKERS:
NEXT HANDOFF:
```

`VALIDATION:` must carry the four measured numbers. `BLOCKERS:` must be honest — a blocked task reported as blocked is
correct, not a failure.

## Documentation namespace

- **Never rename, delete, renumber or overwrite anything under `docs/ai/steps/`.** It is a frozen archive (steps 02–34
  predate this sprint). **Never cite a `docs/ai/steps/*` file as evidence of current behaviour.**
- New deliverables go to `docs/ai/phases/NN_<name>.md`. This brief's deliverable is
  **`docs/ai/phases/11_pre_phase10_leftovers.md`**.
- When a new phase document contradicts an archived step file, **the new document wins — say so in one line.**
- `docs/ai/PLAN.md` and `docs/ai/STATE.md` are the live shared state documents.

## Source authority

- **`docs/ai/research/06_2026_fiscal_research.md` is NOT authoritative.** It contradicts itself on the CAS minimum base
  and on the VAT threshold, and it self-rates a key claim Medium. A contradiction inside it is evidence the document is
  unreliable, not evidence of a genuine legal ambiguity. **Never cite it, or `docs/ai/decisions/09_IMPLEMENTATION_
  ARCHITECTURE.md`, as the source of a rule.**
- Authoritative research for this brief: **`research/10` (CAS), `research/11` + `research/13` (VAT/deadlines),
  `research/14` (registration), `research/15` (thresholds), `research/17` (D120), `research/18` (holiday set),
  `research/20` (art. 66 rounding, art. 154 CASS exemption — but see the verification caveat in Task 4).**
- **Never invent a citation, article, threshold, rate or date.** Mark unresolved instead.

---

# THE COMPLETE PHASE LIST — Phases 1–10. This is the whole plan; nothing is omitted.

| # | Phase | Objective | Status |
|---|---|---|---|
| 1 | **Real baseline + documentation truth** | Measure the repo honestly; defect register B-1…B-12; open questions | **COMPLETE** — `phases/01_real_baseline.md` |
| 2 | **Verified 2026 fiscal baseline + rule provenance** | Re-establish every fiscal value from primary sources; repair provenance on the 5 rules carrying `'ANAF 2026'` / homepage placeholders; resolve Q-CAS-MINBASE, Q-VAT-THRESHOLD, Q-VAT-BASIS, Q-CAS-MAXBASE, Q-16PCT, Q-30PCT-CAP, Q-NETGROSS, Q-CASS-MINBASE, Q-PROVENANCE-SCHEMA. No formula changes. | **COMPLETE** — `phases/02_fiscal_baseline.md` |
| 3 | **CAS correction** | Correct only the 2026 PFA CAS calculation: zero/loss, below 12 SMBT, exactly 12, 12–24, exactly 24, above 24. Drive from the rule store. | **COMPLETE** — `phases/03_cas.md` |
| 4 | **CASS correction** | Correct only the 2026 PFA CASS calculation: 10% rate, independent-activity maximum base, minimum-base/exception behaviour, salary/pension/other-income dependencies. Unsupported cases → `REVIEW_REQUIRED`. | **COMPLETE** — `phases/04_cass.md` |
| 5 | **2026 income tax correction** | Correct only PFA sistem-real income tax. The 30% deductible-expense cap; the taxable-income sequence; stop returning `computed` while under-reporting. | **COMPLETE** — `phases/05_income_tax.md` |
| 6 | **Fiscal regime + profile foundation** | Make the profile able to supply the engine with real user context: start date, regime, CAEN, salary/pension/other income, CASS status, VAT status; real write path; persistence. **§7 items 5, 8, 9 not delivered — items 8 and 9 are Task 6 of this brief.** | **COMPLETE** — `phases/06_fiscal_profile.md` |
| 7 | **Identity source of truth** | One coherent profile as identity for sidebar/topbar/Settings/greeting; remove duplicate identity state; persisted-schema versioning + migration chain (B-11, B-12); non-destructive corrupt-payload recovery. | **COMPLETE** — `phases/07_identity.md` |
| 8 | **Financial amount semantics** | Separate transaction/cash amount, VAT amount, amount excluding VAT, gross, deductible expense, tax-relevant income. VAT threshold bases use the correct turnover basis. | **COMPLETE** — `phases/08_amount_semantics.md` |
| 9 | **Payment / collection dates** | Minimum date semantics to distinguish issued · received · paid; make the correct date available to tax calculations. **9b = rule-driven deadlines, no date literals in `computeDeadlines`.** | **COMPLETE** — `phases/09_payment_dates.md`, `phases/09b_rule_driven_deadlines.md` |
| — | **THIS BRIEF** | The phase-less leftovers: B-23, B-21, P-PROFILE-VAT-DATE, B-19, Phase 6 §7.5, §7.8/§7.9 blocked. | **YOU ARE HERE** |
| 10 | **Money precision** | Eliminate unsafe floating-point money/tax arithmetic. One coherent money representation; **integer bani for persisted money**; `decimal.js-light` (declared, never imported) for intermediate calculations; **isolate rounding policy so it can be changed centrally**; do not invent a legal rounding policy. | **NEXT — DO NOT START. Blocked on `Q-MONEY-UNIT` (user chose **hybrid**: integer cents persisted + decimal library for intermediates) and on the rounding tie-break from `research/20` §Q1.** |

**Known non-phase defects** (fixed opportunistically, never scheduled as a phase): `.gitignore` gaps — **fixed, `334`**;
no `*.d.ts` / `src/vite-env.d.ts` despite CSS side-effect imports at `src/main.tsx:4-5`; `playwright.config.ts:9`
LSP-only diagnostic — **do not "fix" it as if it were a build error**; `react-router-dom` declared but never imported;
`playwright.config.ts` has no `projects` block (Chromium only, `playwright.firefox.config.ts` is supplementary and needs
`--config`); seed data encodes a **22% VAT ratio** matching no statutory rate (19%/21%); seed declarations contradict
seed transactions; the own-company CUI collides with a customer CUI; `Documents.tsx`, `EFactura.tsx`, `Expenses.tsx`
have no tests.

**Phase 10's open defects, for your awareness only — do not touch them:** **B-17** (two display paths disagree by a
half-cent: 674,51 vs 674,50 lei), **B-18** (float accumulation + `Math.round` in the chart layer), **B-20** (the
`totalDue` type is a lie), **B-16** (a rounding rule asserted with no legal basis).

---

# AMENDMENT 1 — TASK 4 IS NOW FULLY VERIFIED. Read this; it supersedes the caveat in Task 4.

The independent verifier (`verify-art66-art154`, fresh session, no shared history) re-checked every load-bearing claim
against primary text on legislatie.just.ro. **7 of 8 MATCH, 1 PARTLY. The "do not build on research/20 yet" caveat in
Task 4 is LIFTED. The citations below are safe to encode.** Full detail in `research/20` §VERIFICATION RESULT.

**Art. 154 alin. (1)** — heading verbatim: *„Categorii de persoane fizice exceptate de la plata contribuției de asigurări
sociale de sănătate"*. **Live letters: a), b), e), f), g), h¹), h²), i), m), n), p), q), ș).** Abrogated: c), d), h),
j), k), l), o), r), s) (Legea 141/2025, MO 699/25.07.2025). **No letter covers a person exercising o activitate
independentă.** Nearest is h¹) — salaries/pensions earners *for drepturi de proprietate intelectuală* income.
Lit. a) and b) both end verbatim: *„Dacă realizează venituri din cele prevăzute la art. 155 alin. (1) lit. a), b) și f),
pentru aceste venituri datorează contribuție, conform regulilor specifice prezentului titlu;"* — they **re-impose** CASS
on exactly what a PFA earns.

**Art. 174 alin. (7)** — verbatim: *„Diferența de contribuție de asigurări sociale de sănătate prevăzută la alin. (6) nu
se datorează în cazul în care, în anul fiscal pentru care se depune declarația prevăzută la art. 122, persoana fizică a
realizat venituri: a) din salarii și asimilate salariilor la un nivel cel puțin egal cu 6 salarii minime brute pe țară;
sau b) din cele prevăzute la art. 155 alin. (1) lit. c)-h), pentru care datorează contribuția … cel puțin egal cu 6
salarii minime brute pe țară. c) venituri din pensii, definite conform art. 99."* **Scoped to the DIFFERENCE from alin.
(6). Not an exemption from CASS.**

## 4A. NEW, and it is the part that actually changes code — the naming rule

**`scutit` → 132 hits and `scutire` → 209 hits across the fiscal code, and ZERO of either anywhere in Titlul V
„Contribuții sociale obligatorii", including the entire CASS range art. 150–181.** They belong to profit tax, income
tax, TVA, accize, local taxes and the non-resident tax. **A CASS result must never be labelled `scutire`.**

The fiscal code keeps **two distinct CASS concepts**. Do not merge them:

| Concept | Where it appears | Mechanism |
|---|---|---|
| **„exceptat"** | art. 154 alin. (1) heading | **status-based exemption** — closed list of personal categories |
| **„nu se datorează"** | art. 146, 154, 168, **174**, 180, 220⁵ | **conditional non-due** — art. 174 alin. (7) reaches only the *difference* from alin. (6) |

**Do:** where the flag, a UI label, a comment or a provenance string says or implies *scutire* / *exempt* for CASS,
re-word it to the code's own terms — **exceptat** for a status exemption, **nu se datorează** for a conditional
non-due. **This is labelling only. It must not change a single computed amount.**

## 4B. Do NOT touch the 72-SMGW CASS cap — it is already correct, and now confirmed

72 SMGW × 4,050 lei = **291,600 lei**, which is already `max_annual_base` at `package2026.ts:125`, labelled
*„Max annual base (72 SM)"*. `phases/04_cass.md` §2 already cites art. 170 alin. (1) — *„nu poate fi mai mare decât …
72 de salarii minime brute"* — with **Legea 239/2025, Art. XII pct. 19, MO 1160/15.12.2025** and the „începând cu
veniturile aferente anului 2026" applicability note. **The verifier checked this hardest and it MATCHES. Phase 4 was
right. Leave it alone.**

**U-8 is unchanged and still open.** It concerns **OUG 89/2025** and **OUG 8/2026** specifically; `phases/04_cass.md` §9
already records that the consolidated text absorbs Legea 239/2025 and Legea 141/2025. There is no contradiction to fix.

**One caveat to respect if you touch CASS at all:** the 72-SMGW cap lives in **art. 170 alin. (1)**, which governs
**art. 155 alin. (1) lit. b) only**. alin. (2)–(4) (lit. c)–h)) use the 6/12/24-SMGW stepped base and are **not** capped
by 72. Do not spread the cap across all CASS income types.
