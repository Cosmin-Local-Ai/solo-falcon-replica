# Brief 27 — TASK 10b: the euro caps compute, and the provisional → final rate lifecycle

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
- **`docs/ai/phases/24_currency_fx_store.md` — TASK 10a's handoff. This brief restates only the headline; the doc is authoritative.**
- `docs/ai/research/23_fx_conversion_and_bnr_rates_2026.md` — the law, the series codes, the endpoints, and the list of what must stay unresolved.
- `docs/ai/phases/15_deductibility_caps.md` — why the caps were excluded, and why `paramBani` refuses any unit but `lei`.
- `docs/ai/STATE.md` defect **B-33** (no provisional → final lifecycle for a rate).

## WHAT 10a GAVE YOU — do not re-derive any of it
- **Money:** `interface Money<C extends CurrencyCode = CurrencyCode> { amount: Bani; currency: C }`, `CURRENCY_CODES = ['RON','EUR','USD','GBP','HUF']`, integer minor units, `RonMoney = Money<'RON'>`. Mixing currencies is a `tsc` error through `addMoney<A, B extends A>`.
- **Rate record:** `currency, rate (decimal string), rateKind ('daily_reference' | 'annual_average'), rateDate? XOR rateYear?, seriesCode, sourceUrl, fetchedAt, provisional, carriedFrom?, entryMode ('fetched' | 'manual')`.
- **Conversion:** `convertToRon(...) → { ron, rate, basis, carriedForward, provisional }`.
- **Fetcher boundary:** `FxRateProvider` (`dailyRate`, `annualAverage`, both synchronous); loading via `loadDailyRates`; manual entry via `manualAnnualAverage`; tests use `fixtureRateProvider`. **No test performs a network call.**
- **Store:** `RateStore.replace` keyed by `rateKey` — this is the provisional → final mechanism.
- **`ExcludedReason: 'foreign_currency'`** already exists in `estimateBasis.ts:201`.
- **`inputsHash` was not touched and must not be touched now.** `CalculationInput` is `{ profile, revenues: Bani, expenses: Bani }` — aggregate lei totals, not record arrays — so a currency on a record is unreachable from the digest bytes. **No re-hash, no `preMigrationInputsHash`.**

### Refusals that are decisions, not gaps — leave them alone
1. **There is no default conversion basis, on purpose.** Choosing one *is* resolving the HG 1/2016 Titlul IV Cap. II pct. 7 alin. (6) vs CF art. 9 alin. (3) lit. b) + alin. (4) conflict. Both readings are recorded with `status: 'unresolved'`.
2. **The app never computes an annual average.** BNR publishes `CURSA_EURM` as an average of the 12 monthly averages; a mean of daily rates is a different number.
3. **Carry-forward from the last published banking day is app policy by analogy** (art. 68^3 alin. (4) / art. 85 alin. (4) — the phrase occurs exactly twice in the whole Codul fiscal), surfaced through `InterpretationNote`.
4. **Rounding: nearest ban.** CF art. 66 whole-leu rounding is **not** applied to the conversion product, labelled as an app decision because art. 66's scope for intermediate products is UNVERIFIED.
5. **`paramBani` refuses any unit but `lei`** so a euro figure can never be read as money. That guard is deliberate (TASK 2c). **Do not weaken it to let a cap through.**

## SCOPE — TASK 10b
1. **Make the euro-denominated caps measurable.** Enumerate them from the rule package — the rules carry `capEur` (400, 400, 400, 4.000, 100, 400 …) with `capBaseArticle` quoting the statute — rather than hardcoding a list. Each converts at the **BNR annual average for the year of payment** (pct. 7 alin. (6)).
2. **Express the EUR cap parameter without breaking the `lei`-only guard.** The cap arrives as `capEur` and becomes a lei ceiling only through an explicit conversion. A raw euro amount must still never be usable as `Bani`.
3. **Provisional → final is the point of the task.** There is **no FY2026 annual average yet** (B-33). A FY2026 cap computed today is provisional: it must say so, on screen, and recompute when a final rate enters the store. Use `RateStore.replace` keyed by `rateKey`.
4. **A missing rate keeps the cap unresolved** — with the missing datum and the rule named, exactly as `cap_unresolved` works today. Never substitute a guessed rate.
5. **Both readings stay visible.** The cap path explicitly applies pct. 7 alin. (6) and must record that CF art. 9 alin. (3) lit. b) + alin. (4) would give a different answer. That is a `conflict` parameter on the rule, not prose in a component.
6. **Show the applied ceiling and the alternative**, in the same style TASK 2d used for the pre-cap / post-cap flip: applied figures on `ceiling` / `base`, the alternative alongside, and the statement that the law does not settle which applies.

## BOUNDARIES
- **The 25.000 euro sistem-real threshold is NOT in this brief.** It anchors to the **year of income realisation**, not the year of payment, and regime selection is a boolean today (`profile.vatExempt`-adjacent), so wiring it here would be a model change wearing a cap's clothes. **Record it as a follow-up with its basis and citation** (research 23 „What must stay unresolved" item 7) and leave it.
- **`cheltuieli sociale` stays excluded.** Research 23 did not verify a euro equivalent for it.
- **No new network path, no crawler, no scheduler.** A final rate arrives through the existing store boundary, the same way a manual rate does.
- **Phases 11–34 are next**, mapped in `docs/ai/roadmap_11_34_mapping.md`. Do not start them.

## LANDMINES
- **No money figure may move.** Deductible 120,00 / 144,00 lei, VNA 9.096,00, impozit 819,00, total 3.249,00, reserve 1.083,00, year-end 3.112,00, hero 51.510 lei. TASK 2c recorded that **no seed or e2e fixture holds a capped expense**, so computing the caps should move nothing — **verify that by running, do not assume it.** If a figure moves, either a fixture now holds a capped expense or the conversion changed arithmetic: re-derive by hand, record old → new, and say which.
- **Do not re-hash any snapshot.**
- **Do not resolve the hierarchy conflict.** Applying a rule is not the same as declaring the other reading wrong.
- **Do not invent a FY2026 annual average.** If you need one to make a test pass, the test is asking for a fabricated legal figure — change the test's expectation to the provisional behaviour, never the rate.
- **Copy goes in `src/ui/copy/`**; the guard allow-list is empty. `src/domain` must not import from `src/ui/copy` — rule names stay in the domain.
- **Never** delete an assertion, loosen a matcher or widen a timeout. I diff the test files.

## BASELINE (measured by the Worker at `7798edf`)
`tsc` 0 · **72 files / 1271 tests** · guard allow-list empty · `build` 0 · **`e2e` 37 passed**.

## COMPLETE PROJECT PLAN — DO NOT INVENT PHASE BOUNDARIES
Original roadmap Phases 1–10 — DONE. Pre-Phase-11 corrections TASKS 1, 2a, 2b, 2c, 2d, 3, 4, 5, 6, 7, 8, 9 — DONE (`c49d88f` … `73b94d5`). TASK 10a — DONE (`84dda5b`, `8732e3f`, `b54d756`, `7798edf`).
- **TASK 10b — the euro caps compute, provisional → final rate lifecycle ← THIS BRIEF. Last task of the pre-Phase-11 round.**
Then updated roadmap **Phases 11–34** (status in `docs/ai/roadmap_11_34_mapping.md`), which we do **not** start here.

## ACCEPTANCE
- Every `capEur` rule in the package becomes measurable when a rate exists for the correct basis and year, and stays `cap_unresolved` with the datum named when it does not.
- A FY2026 cap computes as **provisional**, is labelled provisional on screen, and becomes final when a final rate enters the store — proven by a test that replaces the rate and re-reads the ceiling.
- The applied ceiling and the alternative reading are both shown, and the applied rule is named.
- No raw euro amount is usable as `Bani`; `paramBani` still refuses non-lei units.
- The 25.000 euro threshold and `cheltuieli sociale` are recorded as explicitly out of scope, with reasons.
- `tsc` 0 · `npm run test` green with **new counts reported** · `build` 0 · `e2e` **37 passed** · **no money figure moved** unless re-derived by hand and recorded old → new.
- `docs/ai/phases/25_euro_caps_provisional_rates.md` records the conversion path, the provisional → final lifecycle, the conflict disclosure, and what Phases 11–34 inherit.

## HANDOFF
`NEXT HANDOFF:` must state which caps are now measurable and at what rate basis, how provisional is represented, what remains `cap_unresolved` and why, and confirm no snapshot digest moved.
