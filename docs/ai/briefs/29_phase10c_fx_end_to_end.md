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
4. **OVERRIDE — Scouts run SEQUENTIALLY.** One at a time, waiting for each report. Standing user decision (2026-10-10); the roadmap's parallel-Scout permission is not adopted.
5. Each Scout inspects the smallest relevant territory and returns a compact report.
6. If the Worker finds missing local information, it spawns another narrow Scout — it does not search broadly.
7. One Worker = one coherent, tightly scoped job.
8. Do NOT spawn a post-Worker Scout verification pass. The Worker self-validates instead.
9. Self-validate: npx tsc --noEmit, npm run build, npm run test, npm run test:e2e.
10. Do not start future phases. Stop when this phase's acceptance criteria are met.

**Scout infrastructure — known defect.** The scout profile's default model produces no output. **Use the explicit override `llama-cpp/qwen3.8-flash-next-iq3_s` from the start.** If it fails too, STOP and report a BLOCKER.

**Engine instability — known.** 262k context, ~390 MiB free, one slot, SIGKILLed under load. If killed, **on-disk work survives** — resume and continue. Checkpoint early and often.

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
- Phase docs → `docs/ai/phases/NN_<name>.md`. **Never touch `docs/ai/steps/`** (33-file frozen archive; `steps/15_tax_engine.md` is not this task's file).
- `docs/ai/PLAN.md` / `docs/ai/STATE.md` are the live shared state.
- **Date stamps from the tool.** Validation via the runner's own exit status (`set -o pipefail`, never a piped `grep`).


## READ FIRST
- **`docs/ai/phases/24_currency_fx_store.md`** — TASK 10a's handoff. Authoritative for the FX store.
- `docs/ai/phases/` — TASK 10b's handoff (euro caps, provisional → final lifecycle).
- `docs/ai/research/23_fx_conversion_and_bnr_rates_2026.md` — the law, the series codes, the endpoints, and **the list of what must stay unresolved**.
- `docs/ai/PHASE_PLAN_11_34.md` §6 **"10c — FX end to end"** and §4 defects **B-36**, **B-37**.
- `docs/ai/STATE.md` — defect **B-66** (the RJIP export posts on the document date). Related, **out of scope here**.

## WHAT ALREADY EXISTS — do not re-derive any of it

The FX **machinery is built and tested**. This task is **wiring**, not modelling.

`src/domain/fx/` — `rates.ts`, `provider.ts`, `convert.ts`, `ledger.ts`, `carryForward.ts`, `capCeiling.ts`, `bnrXml.ts`, each with its test file.

- **`FxRateProvider`** (`provider.ts:47`) — two reads only: `dailyRate(currency, date)` and `annualAverage(currency, year)`. Both return `FxRateRecord | null`. **`RateStore` never fetches and never computes: a record is either in the store or the answer is `null`.** Keep that property.
- **`normaliseLedgerToRon(data, provider): LedgerNormalisation`** (`ledger.ts:167`) — returns `{ data, conversions, unconverted }`. `data` is the ledger with every convertible record replaced by a lei copy; **RON records pass through untouched and the pass is idempotent, so running it twice cannot drift.** `LedgerConversion` carries `onDate`, `basis`, `citation`, the printed decimal `rate`, `netLei`, `vatLei`, `provisional`, optional `carriedFrom`, `seriesCode`, `sourceUrl`, `fetchedAt`. `UnconvertedLedgerRecord` carries `detail` — the datum that is missing.
- **`LEDGER_CONVERSION_BASIS = 'payment_date_daily'`**, and `onDate` is **collection for income, payment for an expense**.
- **`recordFxRate(candidate: unknown)`** (`store.tsx:118`, impl `:374`) — a **validated upsert keyed by `rateKey`**, returning `{ ok: true; record } | { ok: false; problems: string[] }`. It is correct and it is **never called from anywhere**.
- **`aggregation.ts`** already discloses its own skips: `:140` returns `null` for a non-lei record, and `:150` exposes *"the records the lei totals above deliberately left out, with the currency they are written in."* **Do not build a second disclosure mechanism — extend the one that exists.**

### Refusals that are decisions, not gaps — leave them alone
- **No network path.** Manual / store ingress only, exactly as 10a and 10b left it. `bnrXml.ts` parses; nothing calls it over the wire. **Do not add `fetch`.**
- A provisional rate stays **visibly provisional** wherever it surfaces. Do not launder it into a final figure.
- `paramBani` refuses any unit but `lei`. Do not widen it.

## SCOPE — PHASE 10c

Two halves. **Both are required.**

### A — Rate ingress through the UI (closes **B-36**)
Settings' FX block stops being read-only. A manual rate-entry workflow that calls the **existing** `recordFxRate` and surfaces its `problems[]` verbatim:
- currency, rate (printed decimal exactly as stored), `rateKind`, date **or** year (per `rateKind`), source URL, provisional / final.
- Show the recorded rates with their provisional/final state and source. An upsert keyed by `rateKey` is the correction route; **do not invent a silent in-place edit of a rate that has already been cited.**
- A user holding an EUR record must be able to resolve the missing-rate condition **from the product**, without a developer.

### B — One normalised ledger boundary (closes **B-37**)
Summary, the financial graph and the estimate must consume **the same converted records**, or the UI must state precisely why they differ. **Prefer consuming the same normalised ledger.**
- Today `estimateBasis.ts` is the **only** importer of `normaliseLedgerToRon`; `aggregation.ts:140` still drops non-lei records, so **one user sees two different revenue totals**.
- A record must not vanish from the financial picture merely because its currency is foreign.
- The `unconverted` list must be **visible**, not swallowed: a foreign record with no rate may not let the result look complete.

## BOUNDARIES
- **May touch:** `pages/Settings.tsx`, `data/dashboard.ts`, `data/derived.ts`, `components/dashboard/*`, `components/FinancialChart.tsx`, `domain/aggregation.ts`, `domain/fx/ledger.ts` (only if the boundary genuinely needs it), `data/store.tsx` (ingress wiring only), `ui/copy/*`, new tests.
- **Must not touch:** the calculators, rule values, the rule registry, `estimateBasis.ts`'s conversion policy, snapshots, or the migration chain.
- **Do not** implement PG-2 (payment/collection dates in the UI). It is a separate phase. Where 10c's `onDate` depends on a money date that no UI can yet write, **say so in the handoff** rather than quietly inventing a default.
- **Do not** touch the VAT periodicity cap or add a conversion basis for it — that is **18B**, and it is blocked on defect **B-60**.

## LANDMINES
1. **`Bani` is integer lei.** Never `toFixed(2)` on a `Bani`. The RJIP export once printed `14250` for 142,50 lei — a **100× error in a file the tax office reads**. Use `formatBani`.
2. **Idempotence.** `normaliseLedgerToRon` is safe to run twice; a hand-rolled second conversion pass is not. **Never convert an already-converted record.**
3. **`onDate` is a fiscal date, not the document date.** For income it is collection, for an expense it is payment. If those are absent, the honest outcome is `unconverted` with a `detail` — **not** a silent fallback to the invoice date. (See **B-66** for the same confusion in the export.)
4. **The skip is currently deliberate and disclosed** (`aggregation.ts:135` explains *why* skipping is acceptable: "summing it would lie"). Do not undo the reasoning — replace the skip with a conversion, and keep the disclosure for what still cannot be converted.
5. **Provenance travels.** A converted lei figure must keep its citation, rate, series code, source URL and provisional state reachable from the UI. A number without its rate is a regression of TASK 10a.
6. **Guard allow-list stays empty.**
7. **Do not add a `ConversionBasis` variant, and do not attach a citation to a basis that does not carry it (defect B-60).** `ConversionBasis` (`convert.ts:71-74`) offers exactly three — `payment_date_daily`, `payment_year_annual_average`, `income_realisation_year_annual_average` — each with a citation in `BASIS_CITATIONS`. **None of them is „cursul de schimb valabil pentru data de 31 decembrie a anului precedent“** (Normele metodologice HG 1/2016 pct. 103 alin. (2)), which is the basis the law fixes for the 100.000-euro VAT periodicity cap. The union is deliberately discriminated so a basis cannot be omitted or mis-anchored. **A fourth basis is 18B's job, not yours.** If 10c needs a basis it does not have, **stop and report it** — the danger B-60 names is a wrong number shipped **with a legal citation attached to it**, which is worse than no number.

## BASELINE (measured by the Orchestrator at HEAD, 2026-10-10)
`tsc` 0 · **77 test files / 1332 unit tests, all passing** · `build` 0 · **measure `e2e` yourself and report it** (last recorded figure: 37 passed, stale).

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
Roadmap Phases 1–10 — DONE. Pre-Phase-11 TASKS 1–9, 10a, 10b — DONE. **The research phase closed 2026-10-10** (`research/28` … `research/37`); 11 researchers, queue exhausted.
- **Phase 10c — FX end to end ← THIS BRIEF.** `PHASE_PLAN_11_34.md` §5: *"10c runs before 11."*
- Then **Phase 11** (coherent 2026 seed + first-run separation), **PG-0** (fixed clock, `scripts/today`, CI), **PG-1** (estimate coverage — no silent exclusions), **PG-2 / 12C**, and the rest in §5's order.

## ACCEPTANCE
1. Enter an EUR revenue with a rate recorded for its fiscal date → **the same lei figure** appears in Summary, the financial graph and the estimate. Prove it with a test, not by eye.
2. The same record **without** a rate → it does not silently disappear: it is absent from the lei totals **and present** in the visible unconverted/left-out disclosure, and the result does not read as complete.
3. Enter the missing rate through Settings → after a reload the record reconciles across all three. **This is the B-36 proof: the user fixed it without a developer.**
4. A provisional rate is labelled provisional everywhere it surfaces, including inside a converted total.
5. No `fetch` added anywhere; `bnrXml.ts` still has no network caller.
6. `tsc` 0 · all unit tests pass · `build` 0 · `e2e` green · guard allow-list empty.

## HANDOFF
Write `docs/ai/phases/25_fx_end_to_end.md` in the house format. State plainly **what still cannot be converted and why**, and name anything 10c exposed for PG-2 rather than fixing it silently.
