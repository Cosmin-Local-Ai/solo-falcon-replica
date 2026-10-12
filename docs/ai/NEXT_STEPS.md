# NEXT STEPS — the agreed order

**Written 2026-10-12 at `7b65824`.** This is the queue, with the reason each item sits where it does. It is deliberately a small file: the plan (`PHASE_PLAN_11_34.md`) is the record of what happened, `STATE.md` is the measurement, and **this file is the answer to "what next, and in what order."**

**If this file and the plan disagree, the plan wins on what is done and this file wins on what is next.** Re-derive status from the defect register before acting on any row here — the PG mapping table in the plan has no status column, which is why `PG status` was added to §11 on 2026-10-12.

---

## In flight right now
- **PG-10 / B-51 — the scope statement.** Brief `briefs/49_b51_scope_statement.md`, Worker `worker-b51-scope-statement`. Copy only; `git diff --stat -- src/domain/ src/data/` must come back empty. **Register pass owed when it lands:** close B-51, and state explicitly that **B-56 is not closed** by it.

---

## The order

| # | Step | Closes | Why here | Size |
|---|---|---|---|---|
| **1** | **Collect the art. 322 alin. (7)–(8) facts in Settings** | **B-97** | PG-6g opened this hours ago: `aicGoodsWhileQuarterly` and `aicGoodsExigibilityMonth` are modelled and unit-tested, and **no control sets either**. One intra-community goods acquisition dissolves the quarter into two distinct fiscal periods — computable, unreachable. **A rule nobody can trigger is, to the user, a rule that does not exist.** Cheapest item on the list, and it stops "modelled but unreachable" from becoming a habit. | small |
| **2** | **1–7 rooms: the art. 85 rule** | **B-88**, and with it **PG-6** | D-CAZ-1 ordered all three accommodation paths supported. Paths (a) and (b) exist; **path (c) — the most common real case — is uncomputed because the FY2026 package has no art. 85 rule with its own citation.** Starting PG-8 while PG-6 is unclosed is how a register rots. | medium |
| **3** | **The 31 December 2026 lapse** | **B-94** | **The only item on this list with a date.** The 50 % vehicle VAT restriction rests on **CID (EU) 2024/1641, which lapses 31 December 2026** — about eleven weeks away, inside the fiscal year the app is modelling. The 2027–2029 extension is **proposed, not adopted**. The app must not present the rule as permanent, and FY2027 needs a stated position for the case where the derogation simply ends. | small–medium |
| **4** | **Persistence, export, import, document blobs** | **PG-11**, phase **29** | **A release gate, unstarted, and the one item that gets more expensive with every migration step added after it.** The chain is already at **v19**. Data-shape work done late means re-migrating, and doing it after golden fixtures means re-pinning digests. Ranked by irreversibility, not by size. | large |
| **5** | **Post the depreciation** | **B-93** | PG-6e built a full depreciation engine and **nothing consumes it**. A rule that runs and goes nowhere is an arithmetic hole — and **a golden fixture would pin that wrong number**, which is why this comes before step 6. | medium |
| **6** | **Golden fiscal fixtures** | phase **31**, part of **PG-13** | **2,027 unit tests pass and not one is pinned against an expected return derived from outside this codebase.** Every number is currently verified against itself. This project has already caught several of the orchestrator's own citations being wrong — that is precisely the error class an externally derived fixture catches. | medium–large |
| **7** | **Demo personas** | **D-DEMO-1**, and with it **B-96** | Five profiles — IT, content creator, Uber driver, Airbnb host, plain small PFA — chosen by which fiscal switch each teaches. **Product scope, not a gate**, which is why it sits below the gates. 6g left specific instructions: a declared VAT *status* does not establish a *cadence*; each persona needs `registrationEffectiveFrom`, `registrationRoute` and the figure for its branch; **do not seed `vatReturns`**. | medium |
| **8** | **Evidence and snapshots** | **PG-8** — B-43, B-49 | Pair with step 6 rather than treating them as separate: **fixtures pin the number, evidence explains it.** B-43 is the estimate losing the evidence that produced it; B-49 is `addSnapshot` having no production caller. | medium |
| **9** | **Rule governance** | **PG-9** — B-50 | 39 expense rules ACTIVE with one `verifiedAt` while most caps carry CONFLICT NEREZOLVAT. Governance matters more once fixtures make rule correctness visible. | medium |
| **10** | **UX, a11y, performance** | **PG-12** — B-52, B-53, B-86, B-91, the nine wording calls | Real defects, none of them gates. **B-91 is the one to watch**: critical axe `label` violations on `/settings#!/fiscal` that the gate does not see because the scan is deliberately commented out — a blind spot in the gate itself, not just a UI bug. | medium |
| **11** | **The rest of the release audit** | **PG-13** — phases **30, 32, 33, 34** | Real production walkthrough, full automated suite, real-browser responsive QA, final dry run. All unstarted. | large |

---

## Two sequencing traps recorded so they aren't walked into

1. **Fixtures before personas (6 before 7).** Fixtures pin expected returns; personas **move the pinned seed estimate** — 311.200 bani has been held unmoved through PG-6b … 6g, and the persona set will break that pin by design. Do personas first and every fixture gets re-pinned twice.
2. **PG-11 (step 4) before fixtures (step 6).** Persistence and export change data shapes; fixtures pin digests. Fixtures first means re-pinning after the migration chain grows.

## Explicitly not in this queue
- **Normă de venit (12H)** — **not part of PG-6**, and it does not need more research. It awaits **D-NORMA-2**, a user decision. `research/30` and `research/31` answered feasibility on 2026-10-10.
- **B-56** (success messages claiming operations that don't happen) — adjacent to B-51 and deliberately excluded from brief 49 to keep it small. Still open.
- **B-60** — the missing `ConversionBasis` for the art. 322 periodicity cap. PG-6g worked around it with `capCeilingAtPaymentDate` at a constructed `year-1-12-31` and a visible note quoting Norme pct. 103 alin. (2). The workaround is honest; the basis still doesn't exist, and `domain/fx/*` was off-limits to 6g. **Needs a phase that is allowed to touch `domain/fx/`.**
- **B-16 remainder** — the fiscal-loss record is not persisted. Still open, still in PG-6's territory, not yet placed. **Decide where it goes when PG-6 is formally closed at step 2.**
- **B-98** — rd. 33/34 drawn without values; the art. 305 and art. 300 alin. (14) arithmetic is unencoded. Honest as drawn, but it means the D300 rubric is only partly derivable.

## Register hygiene owed
- **After PG-10 lands:** close B-51, record that B-56 is not closed.
- **After step 2:** formally close **PG-6** in the plan's §11 status block, and place B-16 remainder.
- **Never:** let a defect close while a decided scope item behind it is unimplemented. **B-29 closed while B-88 stayed open** is the near-miss this rule comes from.
