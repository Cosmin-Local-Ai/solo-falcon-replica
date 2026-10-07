# Phase 9b — orchestrator verification and record

Written 2026-10-08 by the orchestrator, independently of the Worker's own report
(`docs/ai/notes/phase9b_worker_notes.md`). Both files stay; this one is the verification half.

---

## 1. Phase numbering — resolve this before it confuses anyone again

**Brief numbers and phase numbers have drifted apart in this repo.** `docs/ai/briefs/10_deadline_corrections.md`
implements **Phase 9b**, not Phase 10. The brief file is numbered by brief sequence.

| | What it is |
|---|---|
| **Phase 9** | Date semantics — **DONE 2026-10-07**, `phases/09_payment_dates.md` |
| **Phase 9b** | Deadline corrections — brief 10 — **DONE 2026-10-08**, this note |
| **Phase 10** | **Money representation** — integer bani + central rounding policy, owns **B-17**. Not started. Brief 10 §3.5 walls Phase 9b off from `src/domain/tax.ts`, the calculators and any rounding code precisely so Phase 10 owns them uncontested. |

There is no `phases/09b_*.md`. Phase 9b's phase record is this note plus the Worker notes.

## 2. Independent verification — what I ran myself, not what the Worker reported

Commits on `master`: `f8239df` (deadlines), `edae614` (B-23), `1edb925` (Worker notes). Baseline before the
run was `30d2698`; `529ca48` landed mid-run and the Worker correctly left it alone.

Run by the orchestrator, output redirected to files, `$?` printed on its own line, logs filtered separately:

| Command | Exit | Result |
|---|---|---|
| `npx tsc --noEmit` | **0** | clean |
| `npx vitest run` | **0** | **41 files, 614 tests passed** |
| `npm run build` | **0** | built |
| `npm run test:e2e` | **0** | **34 passed** |

`git status --porcelain` empty.

### Structural claims checked by grep, not by trust

| Claim | Verified |
|---|---|
| `DeadlineEventType` is exactly `'d212_filing' \| 'vat_registration'` | **Yes** — `deadlines.ts:36` |
| No `fiscal_registration` type | **Yes.** Only 2 hits in `src/`, both comments/tests asserting its **absence** |
| `pfa_start` has no binding key | **Yes** — `EVENT_DATE` deliberately omits it (`deadlines.ts:86-92`), so a rule declaring `event: 'pfa_start'` cannot resolve. **The silence is structural, not a missing branch** — this is the right design and better than what the brief asked for |
| `monthEnd`, `isApplicable`, `vatExceedanceMonth` removed | **Yes** — all remaining hits are comments |
| Four deleted event types gone from live code | **Yes** — every remaining hit in `DeadlineSection.tsx`, `ActionSection.tsx`, `insights.ts`, `deadlines.ts` is a comment recording *why* it was deleted. Those comments are an asset: they are the reason the phantom does not come back |
| No date or article literal in `computeDeadlines` | **Yes** — the only `art.` matches are doc comments |
| No note count in code or UI | **Yes** |
| CPF cited as Legea 207/2015, not "OG 2/2024" | **Yes** — zero `OG 2/2024` in `src/` |
| No test reads the wall clock | **Yes** — the single `new Date()` hit is a comment in `store.migration.test.ts:79` explaining what B-23 removed |

**Verdict: the Worker's report is accurate in every particular I could check.** No overclaiming found.

## 3. The near-miss worth remembering: my own brief contradicted itself

Brief 10 §2c forbade a `fiscal_registration` event type. **§4 of the same brief ordered a test asserting
`fiscal registration equals pfaStartDate + 30 days`, and told the Worker to re-point `e2e:458` at
`fiscal_registration`.**

Had it shipped as written, the Worker would have **built the third phantom deadline this project exists to
delete, while being explicitly told not to.** Caught before spawn and fixed in `30d2698`; §4 now asserts the
inverse — a PFA start date must resolve **zero** deadlines.

**The lesson is not "read your brief".** It is that a brief edited incrementally accumulates sections that
were written against different findings, and the contradiction lives *between* them. When a finding closes a
question, grep the whole document for every downstream instruction that assumed the question was open. That
is the same failure class as the phantom deadlines themselves: a stale assertion kept because nothing
re-examined it.

## 4. The date check that saved Phase 9b from an open question

`Q-TERM-COMPUTATION` — whether a statutory term expiring on a non-working day extends — is open and has the
largest blast radius in the project (if it is CPF general term computation, it applies to **every** deadline
we model). Checked whether it could destabilise what was about to ship:

| Date | Value | Day |
|---|---|---|
| `d212_filing` | 2027-05-25 | **Tuesday** |
| VAT registration ceiling date (research/13 §6) | 2026-12-31 | **Thursday** |
| reference | 2026-09-30 | Wednesday |
| reference | 2026-12-25 | Friday (a holiday — would be the interesting case) |

**Neither live value falls on a non-working day, so the open question changes nothing that shipped.** That is
luck, not design — and it is why the question is still worth answering before any *future* event-relative
rule is added.

## 5. The real gap Phase 9b exposed — needs a product decision, not a code fix

The Worker flagged it honestly and **did not invent a field to paper over it**:

> **Brief §2b is only half observable.** No profile field records a TVA exceedance date, so the VAT rule
> always resolves `date: null, not_applicable` in the app.

So the rule is now correct, cited, and rule-driven — **and still never fires**, because the app never asks the
user when they crossed the plafon. `vatExceedanceDate` exists on the query type and nothing populates it.

This is a **Phase 6 (profile-driven fiscal inputs) scope item**, not a Phase 9b defect. It should be tracked
as such. Until it is built, the app's only *live* deadline is `d212_filing`.

The Worker also correctly noted that "never upcoming" is precise only when the exceedance date is not in the
future — its tests assert `due_today`/`past` rather than a blanket impossibility. That is a more careful
statement than my brief made.

## 6. Judgement calls the Worker made beyond the brief

- **`new_pfa` was labelled „Declarație estimativă PFA"** — an obligation abrogated 01-01-2025 — while no rule
  emits it. Relabelled to `PFA nou` rather than deleting the key. Defensible: the key is a profile concept, not
  a deadline, and deleting it would have destroyed a UI affordance for a non-existent *obligation*.
- **`calcDeadline` cannot express an event-relative rule.** Left untouched per §3.5, but **pinned by a named
  test** so the limitation is visible rather than latent. Flagged as Phase 10 follow-up.
- **e2e counts remain clock-dependent** (pre-existing). Noted, not fixed — correctly out of scope.
- **Historical VAT rule deliberately not encoded** (month_end + 10 days, 300.000 lei, pre-01-09-2025), per §3.1.

## 7. Open items after Phase 9b

| ID | Status |
|---|---|
| **Q-U3** | Which act last amended CF art. 122 alin. (3) — provenance gap on the only live deadline. **Researcher running** (`cf-loose-ends-researcher` Q1) |
| **Q-D212-GATE** | Does a PFA with zero income still file the DU? App deliberately does not gate it. **Researcher running** (Q2) |
| **Q-VAT-HISTORIC** | Pre-01-09-2025 VAT rule at primary level — secondary-only so far. **Researcher running** (Q3) |
| **Q-CUI-CIF-PRIMARY** | Primary instrument for CUI = CIF for PFAs. **Researcher running** (Q4) |
| **Q-TERM-COMPUTATION** | Working-day extension: CPF general or e-Factura-specific? **Researcher running** (`efactura-term-researcher` Q1) — largest blast radius |
| **Q-EFACT-TERM / Q-EFACT-DOUBLE-BOUND / Q-CF-319-16 / Q-HOLIDAY-SET** | e-Factura term cluster. **Researcher running** |
| **P-PROFILE-VAT-DATE** | **New, from this phase.** No profile field carries the TVA exceedance date, so `vat_registration` never fires. Phase 6 scope item |
| **P-10-MONEY** | Phase 10: integer bani, central rounding policy, B-17. Next phase |
| **P-EFACT-BUILD** | e-Factura model B — see `notes/efactura_integration_decision.md`. Needs the holiday calendar and the ANAF integration research before it is scoping-able |
