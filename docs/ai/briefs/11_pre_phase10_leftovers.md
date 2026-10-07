# Brief 11 — the phase-less leftovers. Close these BEFORE Phase 10.

**Orchestrator brief, 2026-10-08. Worker scope. One Worker, sequential — never concurrent with another Worker.**

**This brief is the authoritative scope.** If your context is compacted, re-read this file before continuing. Do not
re-derive the scope from conversation.

---

## Why these items, and why now

The Phase 1–10 sprint is about to reach **Phase 10 (money representation + rounding)**. Before it starts, the user
decided (2026-10-08, `PLAN.md` item 11) that **the five items which no phase owns get closed first**. Rationale,
accepted explicitly: **B-21 and B-23 change inputs and tests, and Phase 10 rewrites the money tests anyway — so doing
them first means rewriting the test suite once instead of twice.** Cost accepted: the B-17 half-cent defect stays
unfixed one phase longer.

These items have been sitting in `STATE.md` with statuses like *"open — assign opportunistically"*. That has not
worked. This brief gives them an owner and an acceptance criterion.

## Baseline you must reproduce before and after (measured 2026-10-08, after Phase 9b)

| command | expected |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm run test` (vitest) | **41 files, 614 tests, all passing** |
| `npm run build` | **0 errors** |
| `npm run test:e2e` (playwright) | **34 passed** |

If any of these is red when you start, **stop and report it** — do not "fix" a red baseline by deleting assertions.

---

## HARD RULES (each of these has already been broken once in this project)

1. **Never invent a legal rule, threshold, rate, date or citation.** If a change needs a legal premise that is not in
   `docs/ai/research/`, **stop and report it as blocked.** Inventing law is the single failure mode that produced
   twelve fabricated deadlines in this codebase.
2. **Do not touch money representation or rounding.** No changes to rounding, to `src/lib/format.ts`, to float→bani,
   or to any `totalDue`/amount type. **Phase 10 owns all of that, uncontested.** If a task below appears to require it,
   report the conflict instead of resolving it.
3. **No test in this suite may read the wall clock.** The whole app is pinned to fiscal year 2026. This is B-23 and it
   is a standing rule, not just one fix.
4. **Every surviving date, article or threshold literal in fiscal logic must be citable** to a `docs/ai/research/`
   document. Phase 9b established the pattern: a rule that cannot carry a citation is where fabrications live.
5. **Do not silently drop data.** Any input you reject must be visible to the user. A record that quietly stops
   existing in an aggregate is the B-21 defect; do not replace it with a different quiet failure.
6. **Never report a note count or amendment count** for any legal act.
7. **Verify your own work.** Run all four commands above at the end and report the real numbers. If a number changed,
   explain why in the commit message.

---

## TASK 1 — B-23: the wall-clock test. Trivial, do it first.

`src/data/store.migration.test.ts:91` asserts `p.fiscalYear === new Date().getFullYear()`, while the seed profile's
`fiscalYear` is a fixed `2026` (`src/data/seed.ts:7`). It passes today **only because the sandbox clock reads 2026**.
On 2027-01-01 the suite goes red for no code reason.

**Do:** assert against the seed's own `fiscalYear` (or an explicit constant). Then **grep the whole suite for
`new Date()` and `Date.now()`** and remove every other wall-clock read in an assertion. A `new Date()` inside a
*comment* is fine — leave the comment.

**Acceptance:** no assertion in `src/**` depends on the system clock. Prove it with the grep output.

---

## TASK 2 — B-21: unvalidated date strings silently delete records

`inPeriod(date, asOfDate, fiscalYear)` in `src/domain/aggregation.ts:95` is
`Number(date.slice(0,4)) === fiscalYear && date <= asOfDate`: **no ISO shape check, no lower bound, and a
lexicographic comparison.** Measured behaviour today:

- `''` and `'2026-6-1'` are **dropped silently** — no error, no `review_required`, no completeness signal. The record
  simply stops existing in every aggregate.
- `'2026-6-1'` also **mis-sorts** against `'2026-06-15'`.

The zod schemas type these as `z.string()`, not as a date (`src/data/schema.ts`: `date`, `collected`, `paid`), so a
malformed value persists happily. **Phase 9 widened this**: `Revenue.collected` and `Expense.paid` are now *the fiscal
dates*, so an unvalidated collection date silently moves money between fiscal years.

**Do — the decision is already made, implement it, do not re-litigate it:**

1. **Validate at the schema boundary.** Add an ISO `YYYY-MM-DD` validator (there is already `src/domain/date.ts` —
   use it or extend it, do not create a third date module) on **every** record date field: `date`, `collected`, `paid`,
   and any other date the schema carries.
2. **Reject, loudly, on write.** A malformed date is a **validation error surfaced in the UI**, not a silent pass.
   The user must see which record and which field.
3. **For values already persisted** (a stored record that fails the new validator): **do not drop it and do not
   backfill it.** Surface it as `review_required` with a named reason, so the aggregate visibly excludes it rather than
   invisibly. **Backfilling nothing is the established pattern** — see the Phase 9 `payment-dates` chain step.
4. **Comparison must not be lexicographic** once shape is guaranteed — or prove that lexicographic is now safe because
   the format is fixed. If you argue (3), say so explicitly in the commit message.

**Acceptance:** a test for each of `''`, `'2026-6-1'`, `'2026-13-01'`, `'not-a-date'` and a valid date, showing the
outcome is **visible** in every case. And a test proving a malformed persisted record produces `review_required`
rather than vanishing.

---

## TASK 3 — P-PROFILE-VAT-DATE: make the VAT registration deadline actually able to fire

`VAT_REGISTRATION_DEADLINE_2026` is **correct, cited and rule-driven — and still never fires**, because **no profile
field carries the TVA exceedance date**. `vatExceedanceDate` exists on the query type and **nothing populates it**.
After Phase 9b deleted the phantom deadlines, **`d212_filing` is the app's only live deadline.** That is a real gap,
not a cosmetic one.

**Do:** carry the exceedance date from the profile through to `DeadlineQuery` so the rule can resolve. Phase 9b
deliberately **split** `DeadlineQuery` into `pfaStartDate` / `vatExceedanceMonth` precisely so a start date could not
be mistaken for a VAT registration date — **keep that split; do not merge the fields back together.**

**Constraints:**
- The **rule itself is already correct and cited** (`research/11` §6, `research/13`). **Do not re-cite or rewrite it.**
- The **date computation must stay rule-driven** — no date literal in `computeDeadlines`.
- If the profile has no natural place for this value and adding one requires a schema/migration decision you cannot
  make from this brief, **report it as blocked** rather than inventing a field.

**Acceptance:** a test where a profile with an exceedance date produces a `vat_registration` deadline, and one where it
is absent produces **no** deadline (silence is correct there — see `notes/phase9b_orchestrator_verification.md`).

---

## TASK 4 — B-19: the CASS exemption flag has no legal basis. Make it honest, do not invent one.

`socialInsuranceStatus: 'exempt' | 'neplata'` (`src/domain/models.ts:49`) **switches CASS entirely off**, and the
exemption article behind it had never been retrieved. It has now been retrieved — **`research/20` §Q2**:

- **CF art. 154 alin. (1)** is titled *„Categorii de persoane fizice exceptate de la plata contribuției de asigurări
  sociale de sănătate"* and is a **closed list of personal-status categories** (children/students, disabled, pregnant
  and postpartum women, prisoners, victims of trafficking, stem-cell donors, volunteers, etc.). **None of them is a
  person exercising o activitate independentă.**
- The two letters that come closest **re-impose the contribution** on exactly the income types a PFA earns: *„Dacă
  realizează venituri din cele prevăzute la art. 155 alin. (1) lit. a), b) și f), pentru aceste venituri datorează
  contribuție…"*, and alin. (2) is an anti-double-exemption rule.
- **The only CASS relief available to a PFA în sistem real is art. 174 alin. (7)** — and that is ***„Diferența de
  contribuție … nu se datorează"***, conditional on other income ≥ 6 SMGW. **It is not an exemption from CASS.** The
  app's flag zeroes **all** of CASS, which is a different thing.

**⚠️ A verification pass (`verify-art66-art154`) is re-checking these citations right now. Do not change fiscal
*behaviour* on the strength of `research/20` alone.**

**Do — the honest, behaviour-preserving part only:**

1. The engine must **never present this as a lawful *scutire***. Any CASS result that comes from the flag rather than
   from a cited rule must carry **`review_required`** and a provenance line stating that **no legal basis was found
   for a PFA exemption under art. 154 alin. (1)**.
2. The UI must label the values as **unverified** (it partly does already — check, don't assume).
3. **Do not delete the flag and do not change the computed CASS amount in this task.** Removing the exemption path is
   a fiscal-behaviour change that waits for the verification result and, likely, for a decision from the user.
4. **Do not implement art. 174 alin. (7) as a substitute** — Phase 4/6 already model its lit. a) branch. Do not
   duplicate it.

**Acceptance:** no code path can output a CASS figure of 0 attributed to a *scutire* without a `review_required`
marker and the provenance line. Show the test.

---

## TASK 5 — Phase 6 §7 item 5: the 24-SM CAS `tier-floor` surface

Recorded as **not delivered** in `phases/06_fiscal_profile.md`: *"surface the 24 SM CAS boundary as a proper
`tier-floor` threshold type — crossing 24 SM doubles the CAS floor from 12,150 to 24,300, which is real and useful,
but it is not a 'schimbare de regim' cap."* `CAS_MAX_BASE` was removed in Phase 3 for asserting a cap art. 148 does
not contain (`phases/03_cas.md` §4).

**Do:** model the 12 SM / 24 SM boundary as the **tier ladder it actually is**, using the Phase 3 `calcCas` work, and
surface it as a threshold event in the UI where thresholds are already surfaced.

**Constraint:** this is a **threshold-type** change, not a rate or base change. **Do not reintroduce any `max_cas`
concept.** The citation is the art. 148 ladder already used in Phase 3 — reuse it, do not find a new one.

**Acceptance:** crossing 24 SM produces the doubled floor **and** a visible threshold event; no `max_cas` symbol
returns anywhere.

---

## TASK 6 — Phase 6 §7 items 8 and 9: **do NOT implement these. Record them as blocked.**

- **§7 item 8 — rules that key on CAEN.** Declined in Phase 6 because **the 2026 sources of record contain no
  norm-of-income values**. `norma_venit` exists as a **parseable but refused** value, deliberately, with **no norm
  values invented**. Implementing CAEN-keyed rules now would require inventing those values. **That is forbidden by
  rule 1.**
- **§7 item 9 — a VAT regime richer than the boolean `vatExempt`.** Also declined for lack of a citable basis.

**Do:** write both into `STATE.md` as **explicitly blocked on source**, with the reason, so they stop being silently
"not delivered". **Do not write code for either.** If you believe you have found a citable source, **stop and report
it** — do not act on it inside this brief.

---

## Explicitly OUT of scope

- **Anything about money representation, rounding, `format.ts`, bani, or `totalDue` types.** Phase 10 owns it.
- **The e-Factura SLA / deadline term** (`research/16`, `research/19`) — not yet scoped.
- **Any change to `tax.ts` rounding behaviour** — B-17 stays open.
- **Re-citing rules that Phase 9b already made rule-driven.**
- **New legal research.** If you need it, stop and report.

## Deliverable

1. The code changes, with tests.
2. `docs/ai/phases/11_pre_phase10_leftovers.md` — what you did, what you blocked, and why, with the same
   CONFIRMED / NOT-CITED discipline the research docs use.
3. Update `STATE.md`: close B-23, B-21, P-PROFILE-VAT-DATE; annotate B-19 with exactly what was and was not changed;
   record §7.8 and §7.9 as blocked-on-source.
4. **The four verification numbers, actually measured.**
5. A commit per task, not one commit for everything.

## Report honestly

If you could not do something, **say so in the report and leave the STATE row open.** A partially-completed brief
honestly reported is worth more than a completed brief that quietly invented something. **The last three phases each
caught the previous one overclaiming — that is the behaviour I want, not full marks.**

---
---

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
