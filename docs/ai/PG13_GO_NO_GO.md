# PG-13 — release go / no-go (living document)

**Started 2026-10-10, at PG-0's planning stage — not at the end.** This file accumulates. Every PG task updates it as it closes; PG-13 reads it rather than re-deriving it. A release gate written in the final week finds nothing.

**Rule for anyone briefing a PG task:** if your task changes a row here, it has not finished until the row is updated.

---

## 1. Verdict

**NOT READY.** Recorded here so the answer does not have to be rediscovered. The blocking set is §3 and §4.

---

## 2. Baseline — must hold at every checkpoint

| | Value | Last confirmed |
|---|---|---|
| Commit | `772279a` (docs only) | 2026-10-10 |
| `tsc` | 0 errors | TASK 10b |
| Unit | 77 files / 1332 tests | TASK 10b |
| `build` | 0 errors | TASK 10b |
| e2e | 37 passed | TASK 10b |
| Copy-guard allow-list | empty, may only shrink | TASK 10b |
| Data version | 10 (`record-currency`) | TASK 10a |
| Money figures pinned green | deductible 120,00 / 144,00 lei · VNA 9.096,00 · impozit 819,00 · clock 3.249,00 · reserve 1.083,00 · year-end 3.112,00 · hero 51.510 lei | TASK 10b |
| Euro cap ceiling | 531,00 lei provisional → 540,00 lei final | TASK 10b |

No row may move without a hand derivation recorded old → new in the task's `docs/ai/phases/NN_*.md`.

---

## 3. Must be true before any real user touches a number

Ordered by how badly the app misleads if the row is false. These are not feature requests; they are the difference between a wrong answer and a wrong answer that looks authoritative.

| # | Condition | Defect | Status |
|---|---|---|---|
| 1 | No success message claims an operation that did not happen. `Declarația … a fost transmisă` sits on a `setData` call; `Contul este conectat la platforma e-Factura` sits on no integration. A user who believes a declaration was filed may not file it | **B-56** | open |
| 2 | No record is silently excluded from the estimate. The hero says *Calculat* while an unconverted euro expense **raises** the tax and an unconverted euro revenue **lowers** it | **B-28**, PG-1 | open |
| 3 | The estimate is computed on actual realised income, not on a ×12 projection. Art. 118 alin. (3) deems partial-year income to *be* the annual income | **B-54**, D-PROJ-1 | open |
| 4 | `addSnapshot` has a production caller, or the completeness check that requires a computed snapshot can never clear by construction | **B-49** | open |
| 5 | No internal identifier reaches a Romanian sentence — `Baza „net-income” nu a fost furnizată`, and the `affectedDomain` fallback that can print `pfa-revenue` | **B-55** | open |
| 6 | The ACTIVE 2026 rule package has no open legal conflict, or the conflict is surfaced rather than resolved silently | **B-50**, Q-NORME-PRORAT | open |
| 7 | A clean first run does not hand the user the fictional workspace as their own records | **D1** | open |
| 8 | A disclaimer exists and states what the app is not | **B-51** | open |
| 9 | A foreign-currency record's exclusion is described accurately: absent from the lei totals, not merely unclassified | **B-37** | open |
| 10 | Every threshold row says which basis it was tested on, mid-year | PG-1, PG-4 | open |

---

## 4. Decisions PG-13 still needs from the owner

| Decision | Blocks | State |
|---|---|---|
| **D-6** — who writes the disclaimer and terms | PG-10, B-51 | open |
| **D-7** — calculation-sheet export format: print stylesheet, PDF, or JSON | PG-8 | open |
| **D-NORMA-1** schedule — normă de venit: build it or refuse it explicitly | 12H | decided in principle, schedule open |
| Whether the code-versus-norm proration disclosure ships as worded in `research/27` §10 | PG-4 | candidate wording, not accepted |
| Whether the documents section teaches current filings only, or is labelled a general archive | B-55-adjacent, proof-check §5 | open |

---

## 5. REVIEW_REQUIRED surfaces a real user could trip today

Each of these is a place where the app knows it is unsure. None may be presented as a settled figure. This list is the honest inventory of the app's uncertainty, and PG-13's job is to confirm each one is *visible* rather than hidden.

- FY2027 selected — no verified 2027 package; 2027 minimum wage unpublished (**D-YEAR-2**: carried forward, stamped as not yet updated).
- Any euro figure for FY2026 — BNR publishes no FY2026 annual average yet, so every ceiling is **provisional** (B-33 closed by surfacing this, not by resolving it).
- Mid-year starter near the 12-SM CAS plafon — the only band where the code/norm conflict changes the answer (`research/27` §10).
- Expense categories whose art. 68 cap cannot be struck — `cheltuieli sociale` has no euro equivalent and no rate fixes it.
- VAT periodicity — depends on prior-year taxable supplies and the registration date, facts the app does not hold (**D-VAT-1**, Q-VAT-PERIOD).
- Depreciation — a capital purchase is not a direct expense under art. 68 alin. (7) lit. h); the model does not exist (**B-31**).
- The 25.000-euro sistem-real threshold — anchored to the year of income realisation, a different conversion basis, not implemented.

---

## 6. Date-boundary readiness

- **Trigger, not a phase** (§12.4 of the plan): stage the 2027 rule package when the 2027 wage and budget acts publish. First hard boundary ≈ twelve weeks out.
- Fixed clock must exist before any date-dependent acceptance is asserted (**PG-0**, §12.2). Until then, every "identical estimate at three dates" criterion in `briefs/28` is untestable.
- UTC date defaults (**B-46**) must be fixed before date tests are trusted — they currently pass for the wrong reason.

---

## 7. Log

| Date | Entry |
|---|---|
| 2026-10-10 | File opened at planning stage. Baseline pinned at TASK 10b. Ten blocking conditions listed from the two audits, the PG brief and the L-1/L-1b research. Verdict: **not ready**, blocked by §3 and §4. |
