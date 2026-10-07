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
