# Roadmap mapping — Phases 11–34 against landed work

**Purpose.** The Orchestrator Prompt Set "Updated Phases 11–34" supersedes the old 11–24 backlog. Most of its Phases 11–25 describe work that **already landed** as pre-Phase-11 TASKS 1–9. This file records, per phase, whether each acceptance criterion is `satisfied`, `partial` or `unsatisfied`, **with the evidence that decided it**, so a future Worker classifies before implementing instead of rebuilding.

Method note: a type, a component, a copy key or a doc statement is **not** proof of end-to-end behaviour. Where the evidence below is a grep or a doc statement rather than a run behaviour, it says so.

Evidence baseline: `bab4a46` (TASK 8), **63 files / 1121 tests**, `tsc` 0, `build` 0, `e2e` 36. TASK 9 (`task9-provenance-hygiene`) in flight at time of writing.

---

## 1. Already landed — these become audit-and-gap phases, not build phases

| Phase | Landed as | Evidence | Status |
|---|---|---|---|
| **12** run-rate projection | TASK 1 (`c49d88f`) | `src/domain/projection.ts:87,188` `method: 'run-rate-v1'`; partial-month rule stated at `:15` (`full months elapsed + day/daysInMonth`); no seasonality/ML (`:68`); YTD kept separate via `basis: 'annual-projected' \| 'actuals-only' \| 'unknown'` | **satisfied**, gap-check only |
| **12A** expense deductibility | TASK 2a/2b/2c/2d | 39 rules on CF art. 68 (9 → 48), pure classifier returning treatment **and the rule that produced it**; `Expense.category` + v6 migration backfilling nothing; `selectEstimateOperands` the single assembler; per-record 50 % vehicle cap applied; annual caps two-pass; seed deductible 205,50 → **120,00** | **satisfied** |
| **12B** pension fact for CASS | TASK 5 (`649e0f1`) | `pensionStatus` deprecated, **no reader at all** (source-tree scan); four year-attributed records; `FactState = 'da' \| 'nu' \| 'unknown'` where `unknown` comes from absence; v7→8 `pension-facts` renames one key, backfills nothing | **satisfied** |
| **13** annual estimate pipeline | TASK 1 + 2d | estimate fed projected annual figures, not raw YTD; `basis` recorded in the data | **satisfied**, gap-check |
| **14** automatic recalculation | Phase 10 derived state | `grep -rni 'recalc'` over `src/pages` + `src/components` → **no hits**: there is no manual recalculate action to remove | **satisfied** |
| **16** tax reserve persistence | TASK 3 (`698e180`) | `AppData.reservedAmount: Bani \| null`; `null` ≠ `0` asserted in `TaxReserve.test.tsx`; both read sites fixed; reserve consumes the estimate, never re-derives it | **satisfied** |
| **17** threshold semantics | TASK 4 (`8750402`) | `breachMeaningFor` **deleted**, not reworded; `kind` gates `breached`; `severityFor` has no kind in its parameter list (pinned structurally); per-row `applicability` with `unknown` as a real third state; e2e `Depășit` 2 → 0, `Urgent` 1 → 0 | **satisfied** |
| **18** deadline semantics | Phase 9b | `src/domain/deadlines.ts` is rule-driven with `effectiveFrom` and event-type registry; injectable `asOfDate` | **satisfied**, gap-check |
| **19** unified issue/severity/action | TASK 8 (`c6a2d5d`, `bab4a46`) | one producer `getAttentionItems`, `partitionAttention` routes each item to exactly one surface, dedupe by id; `getActionItems` computes nothing of its own; resolved items leave; empty `Insights` collapses | **satisfied in substance — but see conflict C1** |
| **25** legislation slot | TASK 8 | `getLegislationState(data, asOfDate)` returns `{updatedAt, items, monitor}`; the empty sentence was replaced by a monitor-unavailable statement; HG 146/2026 surfaces with `Nu te afectează în acest an fiscal` citing art. 135¹ alin. (3) | **satisfied** |

**Consequence:** for these, the Worker's job is to *prove* the criterion end to end and fill gaps, not to implement. Re-implementing risks regressing a pinned figure.

---

## 2. Partially landed — real gaps, with the evidence

### Phase 15 — snapshots + rule-release versioning: **partial, and one criterion contradicts a deliberate decision**
Satisfied: snapshot identity is content-addressed (`ruleSetDigest.ts`, canonical key-order-stable, `localeCompare` never used); `ruleSetHash` sits **beside** `inputsHash`, TASK 3's `inputSnapshot` subset untouched; the registry enforces `PROPOSED → … → SUPERSEDED`, one ACTIVE per tax year, refuses a reused `releaseId` with different content, deep-freezes ACTIVE sets; data version 9 with the `rule-set-digest` chain step stamping `ruleSetHash: null` and **fabricating no digest**. The R1/R2 fixture is not vacuous: R1 reproduces **7.600,00 lei** line for line after R2 changes `base_rate` 10 → 11, and a new calculation gives **7.960,00 lei**.

Gap: the roadmap says *"do not leave all revisions at version 1 merely because the package was originally created as version 1"*. **All 48 rules are at `version: 1` on purpose.** TASK 6's reasoning: the Phase 3/4/5 corrections were real content changes, but minting superseded digests after the fact to justify a version bump would fabricate history that cannot be reconstructed. The ladder starts where content addressing starts. **See conflict C2 — this needs an explicit ruling before Phase 15 runs.**

### Phase 20 — calculation detail + disclosure policy: **partial**
Satisfied: `Disclosure.tsx` is native `<details>/<summary>`, keyboard-operable, content in the DOM when closed, no hover reveal; the hero breakdown (`Dashboard.tsx:153`) renders **the engine's own lines** in a table with their citations — nothing re-derives them; `InterpretationNote.tsx` is one component used at 22 sites; no raw enum reaches the UI (guard test, empty allow-list).

Gaps, verified:
- `copy.disclosure.sources` („Surse și note de interpretare") is wired in `Settings.tsx:50`, `Expenses.tsx:297`, `ThresholdSection.tsx:147` — **but not on the estimate**. The roadmap's nested disclosure for the *calculation* (rule release/version, tax year, calculation date, source URLs, disclaimer) does not exist on the hero.
- The breakdown table renders **only when `status === 'computed'`**. Review-required and unavailable states get the badge and a hint, not an explanation of *which* fact is missing. TASK 9's provenance wiring is adjacent but is not this.

### Phase 22 — financial graph: **partial**
`FinancialChart.tsx` carries `kind: 'actual' | 'projected'` and a `stateLabel` for each, so the distinction exists in data and in text. **No `strokeDasharray` or dash pattern found** — the roadmap requires a non-colour-only treatment (solid vs dashed or equivalent). Colour-only would fail its own acceptance. Verify visually before deciding.

### Phase 11 — coherent 2026 seed: **in flight**
TASK 9 is doing exactly this now: PFA file carrying `denumire: 'Popescu Consulting SRL'` / `formaJuridica: 'SRL'` / `J40/1234/2020`, `pfaStartYear: 2020`, and declarations `d1` (March) / `d2` (June) unsupported by any seed transaction (every seed revenue is September 2026). **Do not re-open this in Phase 11 without reading `phases/23_provenance_hygiene.md` first.** One plan claim did **not** reproduce and must not be "fixed": the alleged own-CUI collision with a customer CUI.

### Phase 21 / 23 / 24 / 26 / 27 / 28 — UI phases: **not audited here**
TASK 7 and TASK 8 changed pieces of these surfaces (hero state naming, severity styling, collapsing sections, focus tokens `#!/<tab>?f=<id>`), but none of these phases was run as a phase. Treat as **unsatisfied until inspected**; do not assume the domain fix already delivered the presentation.

### Phase 29 — persistence / export / import / document blobs: **unsatisfied**
`grep -rn "Exportă|exportData|importData" src/` → **no hits**. There is no export or import at all. Migrations and Zod validation do exist and are good (v9 chain, `persistedAppDataSchema` strips undeclared keys). Document blobs: not yet inspected.

### Phase 30–34 — walkthrough, golden fixtures, full suite, browser QA, final audit: **unsatisfied by definition.**

---

## 3. Conflicts between the new roadmap and decisions already made

**C1 — severity vocabulary.** Phase 19 says standardise on `info | warning | danger` and *"do not also introduce `critical` as a competing severity vocabulary"*. The repo now ships `AttentionSeverity = ThresholdSeverity` = **`none | low | medium | high`**, and TASK 8 **deleted** the `high→danger / medium→warning / low→info` translation, on the reasoning that a single three-value field fused legal status with urgency and could not express "legally load-bearing, not urgent". The roadmap's escape clause (*"unless the code audit reveals a concrete reason not to"*) arguably covers this — but the two vocabularies must not be re-introduced side by side. **Needs a ruling: keep `none|low|medium|high`, or map back onto `info|warning|danger` and keep the four dimensions.**

**C2 — rule `version` numbers.** See Phase 15 above. The roadmap's criterion reads as a defect; TASK 6 treated the alternative as fabrication. **Needs a ruling.**

**C3 — where phase documentation goes.** The roadmap tells every phase to create `docs/ai/steps/NN_<name>.md`. `docs/ai/steps/` is a **33-file frozen archive** whose numbering already means something else — `steps/15_tax_engine.md`, `steps/19_dashboard_shell.md`, `steps/14_derived_state.md`. Writing `steps/15_calculation_snapshots.md` would collide with and overwrite an unrelated frozen record. The repo's live convention is `docs/ai/phases/NN_<name>.md` (22 files, unbroken), plus `STATE.md` / `PLAN.md`. **Recommend: keep `phases/`, and treat the roadmap's `steps/` filenames as labels.**

**C4 — TASK 10 (currency + FX store) is missing from the new roadmap.** Defects **B-32** (`Revenue`/`Expense` carry no currency field; the only `moneda` is unread free-text on `BankAccount`; no FX layer in `src/`) and **B-33** (no FY2026 BNR annual average exists yet, so any 2026 euro figure is provisional). It is a **prerequisite** for the seven art. 68 euro caps that Phase 12A's acceptance depends on, and for representing a EUR-collected invoice at all. It is queued next, before Phases 11–34.

**C5 — Scout concurrency.** The new contract permits parallel Scouts; this environment has one engine slot, a 262k context with roughly 390 MiB of headroom, and gets SIGKILLed under load. Scouts have been run **sequentially** for that reason, and two Workers have been SIGKILLed mid-run. Parallel Scouts should stay off unless the engine headroom changes.

---

## 4. Standing invariants that survive every phase
- Never weaken an assertion, delete a meaningful test, or widen a timeout to get a green.
- No money figure moves without a hand derivation recorded old → new. Current: deductible 120,00 / 144,00 lei, VNA 9.096,00, impozit 819,00, total 3.249,00, reserve 1.083,00, hero 51.510 lei.
- `unknown` / `REVIEW_REQUIRED` / unavailable stay withheld; an attention item may say something needs attention, never resolve it.
- Do not backfill digests, rule versions or seed facts to silence a warning.
- FY2026 only; no 2025 history, no implied future-year support.
- One Worker at a time.
