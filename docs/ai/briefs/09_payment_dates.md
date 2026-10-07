# PHASE 9 BRIEF — PAYMENT / COLLECTION DATES (+ B-20 folded in)

Repo: `/home/agent/workspace/solo-falcon-replica`. You are the WORKER for **Phase 9 only**.

**FIRST ACTION: read this file in full.** Then read `docs/ai/PLAN.md` (Phase 9 section),
`docs/ai/STATE.md` (defect register B-1…B-20, open questions, **"Archive corrections"**),
**`docs/ai/research/10_art80_negative_and_payment_timing_2026.md` in full** (it falsifies a premise you
may otherwise inherit), and `docs/ai/phases/02_fiscal_baseline.md:187-215` (art. 68 alin. (1), (2), (4)).

---

## 0. Working rules (non-negotiable)

1. **One Worker at a time.** You are the only Worker. Do not spawn another.
2. **Spawn the Scouts you need BEFORE modifying anything**, and use their reports instead of searching
   the repository broadly yourself. Scouts are read-only and never modify files.
3. Scouts may run in parallel when their questions are independent. Each inspects the **smallest
   relevant territory** and returns: exact files, symbols, current behaviour, constraints, handoff notes.
4. If you find missing local information, spawn **another narrow Scout** — do not search broadly.
5. **One coherent, tightly scoped job.** Change only what this job requires.
6. Do **not** spawn a post-Worker Scout verification pass. Self-validate instead.
7. Self-validate with the narrowest useful checks: `npx tsc --noEmit`, `npm run build`,
   `npm run test`, `npm run test:e2e` — scoped to what you changed.
8. **Do not start Phase 10 or any later phase.** Stop when this phase's acceptance criteria are met.
9. **Scout infrastructure is a known defect.** The scout profile's configured model is unreachable
   (Phase 1: every attempt failed with a Connection error in ~2 s). If a Scout fails: retry **once**
   with an explicit working-model override; if that also fails, **STOP and report it as a BLOCKER**.
   Do **not** silently substitute your own self-inspection for the Scout.
10. **No Researcher is available to you and none is needed.** The legal question Phase 9 turned on was
    answered on 2026-10-06 and is recorded in `research/10`. If you believe a further legal fact is
    missing, **report a BLOCKER** — do not guess and do not research it yourself.

### Handoff format (mandatory)

```
COMPLETED:
FILES CHANGED:
TESTS:
VALIDATION:
DECISIONS:
BLOCKERS:
NEXT HANDOFF:
```

---

## 1. Documentation namespace

- `docs/ai/steps/**` (02–34) is a **frozen archive**. Never rename, delete, renumber or overwrite it,
  and **never cite it as evidence of current behaviour**.
- Your deliverable is **`docs/ai/phases/09_payment_dates.md`**.
- `docs/ai/PLAN.md` and `docs/ai/STATE.md` are the live shared state documents — update them.
- `docs/ai/notes/` and `docs/ai/briefs/` are working artifacts — **not sources of record**.
- **`docs/ai/research/06_2026_fiscal_research.md` is NOT authoritative.** Never cite it, nor
  `decisions/09_IMPLEMENTATION_ARCHITECTURE.md`, as `sourceUrl` on a production rule.
- Check `STATE.md`'s **"Archive corrections"** table. Claims that get re-sent and are **false**: the
  seed's "22% VAT ratio" (it is **21%**, statutory — do not "fix" it); `settings.cotaTva` being live
  (read nowhere); "CF art. 124 = accesorii" (it is *Venituri din bunuri sau drepturi deținute în comun*);
  and the "15-day collection threshold" (see §3 below — **it does not exist**).

---

## 2. Complete phase list (do not invent a boundary)

| # | Phase | Status |
|---|---|---|
| 1 | Real baseline (`steps/01_real_baseline.md`) | **COMPLETE** |
| 2 | Verified 2026 fiscal baseline + provenance | **COMPLETE** |
| 3 | CAS correction | **COMPLETE** |
| 4 | CASS correction | **COMPLETE** |
| 5 | Income tax correction | **COMPLETE** |
| 6 | Fiscal regime + profile foundation | **COMPLETE** |
| 7 | Identity source of truth + persisted-state migration | **COMPLETE** |
| 8 | Financial amount semantics | **COMPLETE** |
| 9 | **Payment / collection dates (+ B-20) — YOU ARE HERE** | in progress |
| 10 | Money precision (owns B-17 rounding) | not started |

Baseline as measured at HEAD `6d2dc44`: `tsc` 0 · build 0 · **587 unit tests / 41 files** · **33 e2e**.
If your change is correct those numbers go **up**, not down.

---

## 3. THE LEGAL BASIS — and the premise you must NOT inherit

**There is no "15-day collection threshold" in the Cod fiscal.** An earlier draft of this phase assumed
CF art. 80 was a *pragul de încasare a creanțelor* making an expense non-deductible if paid late relative
to its due date. A Researcher pass falsified that (`research/10` §1):

- **Art. 80 CF is „Termenul de plată a impozitului"** — a **payroll** income-tax payment deadline in
  Titlul IV, Cap. III. It says nothing about a PFA's own expenses.
- Full-text scan of the consolidated CF (2,535,020 chars): `"15 zile calendaristice"` → **0 hits**;
  `"prag de încasare"` → **0**; `"nu sunt deductibile dacă"` → **0**. Cross-checked against ANAF's
  consolidated CF **including HG 1/2016 norms** (3,683,337 chars): `"de la scadență"` → **0**.
- **No 2026 act touched art. 80** — seven amending acts read directly, 0 hits each (`research/10` §5).

**So `src/domain/tax.ts:112` deducting every expense unconditionally is NOT a bug on that ground.** Do
not implement a late-payment disallowance. This is the same class of finding as Phase 3 deleting
`CAS_MAX_BASE` because art. 148 alin. (2) has no CAS ceiling: **absence of a provision is a finding, and
inventing one is the failure mode.**

**What *does* make payment timing load-bearing** — art. 68, already in the baseline at
`phases/02:189-194, 205`:

- **Expenses — art. 68 alin. (4) lit. b)**: *„să fie cuprinse în cheltuielile exercițiului financiar al
  anului în cursul căruia au fost plătite"*. The expense belongs to the year **in which it was paid**.
  Consequence is **attribution, not punishment** — a late-paid expense is not permanently non-deductible,
  it falls into the payment year.
- **Revenue — art. 68 alin. (2) lit. a)**: venit brut is measured by **„sumele încasate"** — amounts
  **collected**.
- **The invoice issue date is not a timing gate.** Art. 68 alin. (4) lit. a) requires expenses be
  *„justificate prin documente"* — the invoice is the justificativ, but its issue date does not determine
  the year.

**Design consequence, stated plainly: for sistem real under art. 68, `collected` / `paid` is fiscally
load-bearing; `issued` is not.** Do not build a three-date model on the assumption that all three are
legally equivalent. If you keep an issue date, it is for display and reconciliation, not attribution.

**Citation caveat (C-1 in `research/10`):** CPF art. 173 alin. (1) and art. 336 alin. (1) lit. o)/p) were
read from a **stale 2016-dated consolidation**. **Do not render CPF citations in the UI.** If your change
would surface one, stop and record it as open.

---

## 4. Scope — three items, all yours

### 4.1 Date semantics (the phase proper)

Today each `Revenue` (`data/types.ts:13`) and `Expense` (`:30`) carries **one** ambiguous `date`, and
fiscal-year membership is driven by it via `inPeriod(r.date, asOfDate, fiscalYear)` at
`aggregation.ts:116, 122, 147, 152` and `derived.ts:64`.

Add the **minimum** date semantics required by art. 68: a **collected** date for Revenue and a **paid**
date for Expense. Make the fiscal date the one aggregation and the tax engine select on. Do **not**
redesign invoice workflows, do not build banking integrations, do not add a receivables/payables ledger.

**The migration question you must decide explicitly, not fudge:** what does a legacy payload's single
`date` mean? The safe answer is that it **is** the fiscal date — i.e. map legacy `date` to
collected/paid, and leave any separate issue date **absent** rather than invented. That preserves every
existing figure and is honest about what was never recorded. State the assumption in the phase document
and pin it with a test. **Do not fabricate per-record payment dates.**

### 4.2 B-20 — folded into this phase by orchestrator decision (2026-10-06)

`buildSnapshot` (`data/dashboard.ts:254`) flags a threshold `breached` only when `distance > 0`, which is
**inverted for `min-base` rows** — a floor is breached when `distance < 0`. The domain layer already gets
this right (`statusFor`, pinned by `thresholds.test.ts` "min-base breached when below minimum"), so the
two layers contradict each other. Consequence: on the seed, `CAS_MIN_BASE` and `CASS_MIN_BASE` render as
"Depășit" in *Praguri* but are `breached: false` in `snapshot.thresholds`, and `insights.ts:115, 168`
filter on `t.breached === true` — **so the insights engine never explains the two contribution
obligations the user is actually under.**

Fix it by **driving the snapshot flag off the domain status** instead of re-deriving it from `distance`.
Expect `e2e/dashboard.spec.ts:272` ("renders all 12 insights") and `:278` (seven "Termen depășit: PFA")
to move — update them to match reality, do not delete coverage to go green. This is pre-existing, so
close B-20 in `STATE.md` only if genuinely closed.

### 4.3 Feed `pfaStartDate` to deadlines (Phase 6's handoff)

`DeadlineQuery.eventDate?: string` (`domain/deadlines.ts:28`) exists and is exercised in tests
(`deadlines.test.ts:112, 124, 248`), but **no production code passes it** — `computeDeadlines` is called
with only `{ taxYear, asOfDate }` (`data/dashboard.ts:193`). So event-relative deadlines resolve to
`date: null` and Phase 6's `pfaStartDate` still reaches no deadline
(`phases/06_fiscal_profile.md` §7 item 6). Wire it, and expect
`e2e/dashboard.spec.ts:197` ("renders the 6 upcoming filing deadlines") to change.

---

## 5. Explicitly OUT of scope

- **Money representation and rounding policy — Phase 10, which owns B-17.** Phase 8 already handed you
  one artefact: the seeded total **3,104.505 lei** renders `3.104,51` and `1.034,84`/month. Do not
  centralise rounding and do not invent a legal rounding rule.
- **A receivables/payables ledger, invoice workflows, banking integrations, e-Factura plumbing.**
- **Undoing Phase 8's amount semantics.** Its invariants must survive: `VAT_REGISTRATION` measured on
  `revenue-excl-vat` (7,700 on the seed, not 9,317), and the three contribution rows on `net-income`
  (7,494.50, equal to the engine's VNA). If your date change moves those numbers, that is a **signal you
  changed attribution** — say so explicitly and prove it is intended.
- **Identity, quarantine, the existing migration steps.** Phase 7 owns `data/migration.ts` semantics;
  you **append** a step, you do not rewrite v0→v1 or v1→v2.
- **Payroll modelling.** Art. 80 alin. (2) lit. d) makes a PFA with employees a quarterly payroll
  remitter, but the app models no payroll (`salaryStatus`/`salaryIncomeLei` describe the **owner**).
  Out of scope; noted in `research/10` §3 for whoever builds payroll later.
- **B-19** (parked research item), **`settings.cotaTva`** (still read nowhere), the **24 SM tier-floor
  surface** (needs a citation this repo does not have), and `playwright.config.ts:9` (LSP-only).

---

## 6. Traps

1. **Appending to the migration chain.** Phase 7 built a real chain: `CURRENT_DATA_VERSION = 2`
   (`data/migration.ts:39`). New persisted fields require a **v2→v3** step, appended — never renumbered.
   New fields must be **optional**; a step must **never invent a value**; and a step that does not bump
   the version throws loudly (the chain enforces this).
2. **Phase 7's F-1 lesson still applies.** `canonicalize` serializes every key, so if `Revenue`/`Expense`
   records are embedded in any stored snapshot's `inputSnapshot`, adding a field changes that snapshot's
   digest. Check whether they are before you decide you are unaffected. Note `addSnapshot` still has **no
   production caller** — the app does not persist snapshots at runtime — so the practical exposure may be
   nil, but verify rather than assume.
3. **Do not silently change the tax base.** If aggregation starts selecting on a different date field,
   every YTD figure, threshold value and deadline count can move. On the seed they must **not** move (see
   §4.1's migration answer). Prove it: assert the seeded VNA stays **7,494.50**, the total
   **3,104.505**, and the Phase 8 threshold figures unchanged.
4. **Do not implement the non-existent 15-day rule.** See §3.
5. **No CPF citations in the UI** (stale consolidation, `research/10` C-1).
6. **No 16% CASS rate, no `research/06` citations, no invented norm values, no "fixing" the seed's 21%
   VAT ratio.**

---

## 7. Acceptance criteria

1. `npx tsc --noEmit` 0 · `npm run build` 0 · `npm run test` green with **more** than 587 tests ·
   `npm run test:e2e` green with **more** than 33.
2. **Revenue carries a collected date and Expense a paid date**, both optional in the schema, and
   aggregation/engine select on the fiscal date. Cite art. 68 alin. (2) lit. a) and alin. (4) lit. b) at
   the point where the fiscal date is chosen.
3. **A legacy payload's single `date` migrates to the fiscal date, and every seeded figure is
   unchanged** — assert VNA 7,494.50, total 3,104.505, and Phase 8's threshold values (7,700 / 9,317
   distinction intact). Collections survive **by id**.
4. **A v2→v3 chain step exists, is appended not inserted, and invents nothing** — a payload with no
   payment data keeps those fields absent, and a test shows the chain refuses a newer version.
5. **B-20 closed**: `snapshot.thresholds[].breached` agrees with the domain status for `min-base` rows,
   with a test that would fail under `distance > 0`; and the insights engine now surfaces the two
   contribution obligations it previously suppressed.
6. **`pfaStartDate` reaches `DeadlineQuery.eventDate`** in production, with a test that an
   event-relative deadline resolves to a real date instead of `null`, and that a profile without
   `pfaStartDate` still degrades safely.
7. **No late-payment disallowance was added**, and `docs/ai/phases/09_payment_dates.md` says so in one
   line with a pointer to `research/10` — so the next reader does not re-invent it.
8. `docs/ai/phases/09_payment_dates.md` records: the date model and why `issued` is not load-bearing, the
   legacy-`date` assumption, the migration step, the B-20 fix, what is left for Phase 10, and one line on
   any archived step file you contradict.
9. Update `STATE.md` honestly — close B-20 only if truly closed, and **record anything you could not
   finish**. Do not quietly drop it.

If a legal fact you need is missing, **report a BLOCKER rather than guessing** — this app renders
citations to users, and a wrong citation is worse than a missing one.
