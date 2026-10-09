# Brief 26 — TASK 10a: currency on the money record, and the FX rate store

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
4. **OVERRIDE — Scouts run SEQUENTIALLY.** One at a time, waiting for each report before the next. This is a standing user decision (2026-10-10) and the roadmap's permission to parallelise Scouts is **not adopted**: one engine slot, ~390 MiB headroom, two Workers already SIGKILLed mid-run. Do not run a Researcher concurrently with a Worker.
5. Each Scout inspects the smallest relevant territory and returns a compact report.
6. If the Worker finds missing local information, it spawns another narrow Scout — it does not search broadly.
7. One Worker = one coherent, tightly scoped job.
8. Do NOT spawn a post-Worker Scout verification pass. The Worker self-validates instead.
9. Self-validate with the narrowest useful checks: npx tsc --noEmit, npm run build, npm run test, npm run test:e2e.
10. Do not start future phases. Stop when this phase's acceptance criteria are met.

**Scout infrastructure — known defect.** The scout profile's default model produces no output. **Use the explicit override `llama-cpp/qwen3.8-flash-next-iq3_s` from the start.** If it fails too, STOP and report a BLOCKER.

**Engine instability — known.** `n_ctx: 262144`, ~47 GB arena, roughly **390 MiB free**, one slot, SIGKILLed (`exit -9`) under load. If your process is killed, **your on-disk work survives** — resume and continue. Checkpoint early and often.

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
- Phase docs → `docs/ai/phases/NN_<name>.md`. **Never touch `docs/ai/steps/`** — a 33-file frozen archive whose numbering means something else (`steps/15_tax_engine.md`).
- `docs/ai/PLAN.md` / `docs/ai/STATE.md` are the live shared state.
- **Date stamps from the tool:** `date +%F` or `git log -1 --format=%cd --date=short`.
- **Validation uses the runner's own exit status** (`set -o pipefail`, never a piped `grep`).

## THE FOUR USER DECISIONS — 2026-10-10, binding

1. **Rates come from a fetcher behind a boundary**, with manual entry as the fallback. Implement the BNR XML client and local caching; do not scatter network calls.
2. **Money carries its own currency.** This is the multi-currency money type, not a currency field bolted onto a RON number. Conversion happens at an explicit boundary, not implicitly inside arithmetic.
3. **A non-publication date carries forward from the last published banking day**, and this is labelled as **application policy by analogy**, never as law.
4. **Provisional FY2026 caps are computed and shown as provisional**, with a `provisional → final` lifecycle. (That part is **TASK 10b**, not this brief — but the schema you build here must be able to express it.)

## READ FIRST
- **`docs/ai/research/23_fx_conversion_and_bnr_rates_2026.md` — the whole file.** It is the authority for this task. Everything below is a summary; the citations, verbatim texts and confidence labels are there.
- `docs/ai/STATE.md` defects **B-32** (no currency on the money record) and **B-33** (no provisional→final lifecycle for a rate).
- `docs/ai/phases/10_money_precision.md` — why money is integer `Bani` and what `decimal.js-light` is for.
- `docs/ai/phases/15_deductibility_caps.md` — the seven euro caps currently excluded as unmeasurable, and how the missing datum is named.

## WHAT THE LAW ACTUALLY SAYS (from research 23 — do not restate it differently)
- **Caps (CF art. 68 alin. (5) lit. g, g², h, p, r, s)** convert at the **BNR average rate for the year of payment** — HG 1/2016 Titlul IV, Cap. II, pct. 7 alin. (6), verbatim „cursul mediu comunicat de Banca Națională a României pentru anul în care s-a efectuat plata". ANAF Brașov and ANAF București both state this rule with that citation.
- **The hierarchy conflict is UNRESOLVED and must stay visible.** CF art. 9 alin. (3) lit. b) + alin. (4) reserve exceptions to „prevăzute expres în **prezentul cod**" — the code, not the Government's methodological norms. No primary source reconciles them. **Do not silently pick one.**
- **EUR income** is recognised on **collection** (art. 68 alin. (2) lit. a) „sumele încasate") and converts at the **BNR daily reference rate on the date the sum is received** (art. 9 alin. (3) lit. b) + alin. (4)).
- **EUR expense amounts** convert at the daily rate **on the payment date**.
- **The annual average is obtainable, not computable.** BNR publishes `CURSA_EURM` („Serii anuale – valori medii –") and its printed methodology is *average of the 12 monthly averages*, each monthly average being an average of daily rates. **A mean of daily rates gives a different number. Never compute it.**
- **There is no FY2026 annual average yet** — published after the year closes.
- **The 25.000 euro sistem-real threshold anchors to the year of income realisation**, not the year of payment. **One conversion function must not serve both without an explicit `basis` parameter.**
- **Rounding:** CF art. 66 (no alineate) — half-up to whole lei, fractions ≤ 50 bani dropped, > 50 bani rounded up. Its **scope for intermediate conversion products is UNVERIFIED**; if you apply it anywhere, label the choice.
- **Endpoints:** `curs.bnr.ro` is authoritative **from 6 August 2026**; `www.bnr.ro/nbrfxrates.xml` is dead. `nbrfxrates.xml`, `nbrfxrates10days.xml`, `/files/xml/years/nbrfxrates2026.xml`; XSD at `curs.bnr.ro/xsd/nbrfxrates.xsd`. Rates publish „imediat după ora 13:00, în fiecare zi bancară". BNR **recommends local caching** and warns page structure may change without notice.
- **Licence:** redistribution requires **indicarea sursei**; BNR states its list „nu implică obligativitatea utilizării … în înregistrări contabile". Provenance on every rate record is the defensible posture, not a nicety.

## SCOPE — TASK 10a only
1. **A money value that carries its currency.** Design it so cross-currency arithmetic is a **type error** unless a conversion is explicit. Keep integer minor units (bani for RON, cents for EUR) — do not reintroduce floats.
2. **`Revenue` and `Expense` carry currency** (`src/data/types.ts:12`, `:39`). Existing records are RON — that is honest, because they were always treated as RON. The migration must be a **no-op in value**: every existing figure stays bit-identical.
3. **An FX rate store.** Each record: `rate`, `currency`, `rate_kind` (`daily_reference` | `annual_average`), `rate_date` / `rate_year`, `source_url`, `series_code`, `fetched_at`, and a **provisional flag** (10b will use it). A rate is a fact about the past: **cache it, never re-derive on read.**
4. **The fetcher behind one boundary.** BNR XML client, XSD-validated, local caching, manual entry as fallback. **No test may touch the network** — the fetcher sits behind an interface with a fixture.
5. **Conversion with an explicit `basis`.** At minimum: `payment_date_daily`, `payment_year_annual_average`, `income_realisation_year_annual_average`. A call site that omits the basis must not compile.
6. **Non-publication dates:** carry forward from the last published banking day, recorded as **app policy by analogy from art. 68^3 alin. (4) / art. 85 alin. (4)**, and surfaced through the existing `InterpretationNote` component — not as a statute sentence.

## THE LANDMINE I MOST WANT YOU TO GET RIGHT
**`inputSnapshot` is the enumerated subset `{ profile, revenues, expenses }` and `inputsHash` is derived from it** (TASK 3 pinned that; TASK 6 put `ruleSetHash` **beside** `inputsHash`, never inside it). Adding a currency field to `Revenue`/`Expense` **changes what is normalised into a stored snapshot's input hash.**

Determine **exactly** what `inputsHash` normalises — read the canonicalisation, do not infer it from a comment — and then make an **explicit migration decision**, written down:
- either the new field is part of the normalised input and stored snapshots' hashes legitimately change (in which case say so, and how a historical snapshot stays interpretable), or
- the normalisation is pinned so existing hashes do **not** move.

**Do not silently re-hash stored snapshots, and do not fabricate a hash for a snapshot whose inputs can no longer be reconstructed.** TASK 6 refused exactly this and that stance is inherited. If you cannot decide safely, stop and report it as a BLOCKER — that is a correct outcome.

## OTHER LANDMINES
- **No money figure may move.** Seed deductible 120,00 / 144,00 lei, VNA 9.096,00, impozit 819,00, total 3.249,00, reserve 1.083,00, year-end 3.112,00, hero 51.510 lei. Every e2e money assertion must stay green with the **same numbers**. If one moves, the multi-currency refactor changed arithmetic — stop and report.
- **Do not compute an annual average.** Fetch `CURSA_EURM` or enter it. Averaging daily rates is a different number and would be a fabricated legal figure.
- **Do not invent a FY2026 annual average.** It does not exist. A rate record for 2026 is `provisional` or absent.
- **Do not resolve the hierarchy conflict.** Both readings stay on record; the applied one is named.
- **The seven euro caps stay unresolved in this brief.** 10b computes them. If you find yourself wiring a cap, stop.
- **Copy goes in `src/ui/copy/`** — the guard test's allow-list is empty and will reject an inline sentence. Currency names and rate labels are copy.
- **Never** delete an assertion, loosen a matcher or widen a timeout. I diff the test files.

## BASELINE (measured by the Worker at `73b94d5`)
`tsc` 0 · **64 files / 1149 tests** · guard allow-list empty · `build` 0 · **`e2e` 37 passed** — TASK 9 added the reserve reload test, so **37 is the baseline now, not 36**.

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
Phases 1–10 of the original roadmap — DONE. Pre-Phase-11 corrections: TASKS 1, 2a, 2b, 2c, 2d, 3, 4, 5, 6, 7, 8, 9 — **all DONE** (`c49d88f` … `73b94d5`).
- **TASK 10a — currency + FX rate store ← THIS BRIEF**
- **TASK 10b — the euro caps compute, provisional→final rate lifecycle** (next brief, after this one verifies)
Then the updated roadmap **Phases 11–34**, whose status against landed work is in `docs/ai/roadmap_11_34_mapping.md`. Read that file before saying anything about what is or is not implemented.

## ACCEPTANCE
- A money value carries its currency; cross-currency arithmetic without an explicit conversion does not compile.
- `Revenue` / `Expense` carry currency; the migration is a value-preserving no-op for every existing record; data version bumped with a named chain step.
- The FX store records rate, kind, date/year, source URL, series code, fetched-at and provisional flag.
- The fetcher is behind one interface, XSD-validated, cached, with manual entry as fallback; **no test performs a network call**.
- Conversion requires an explicit `basis`; the three bases are distinct and tested, including that the payment-year and income-realisation-year anchors can legitimately differ.
- A non-publication date carries forward and is labelled app policy through `InterpretationNote`, never as statute.
- The `inputsHash` question is answered with evidence and an explicit migration decision, not a guess.
- `tsc` 0 · `npm run test` green with **new counts reported** · `build` 0 · `e2e` **37 passed** · **no money figure moved**.
- `docs/ai/phases/24_currency_fx_store.md` records the money type, the store schema, the fetcher boundary, the basis rules with their citations, the unresolved hierarchy conflict, and precisely what TASK 10b may build on.

## HANDOFF
`NEXT HANDOFF:` must state the money type's exact shape, the rate record's fields, how `inputsHash` was handled, what the fetcher boundary is called, and what 10b must not re-derive.
