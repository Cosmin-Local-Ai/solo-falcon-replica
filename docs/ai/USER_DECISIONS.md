# User decisions — record

Running log of decisions the **user** made, what was asked, what they chose, and how it was implemented. Distinct from `docs/ai/decisions/07_*` and `09_*`, which are step-era spec documents. Where a decision is not yet implemented, that is stated rather than implied.

Evidence is a commit or a file path. `—` means not yet built.

---

## 2026-10-10 — FX and currency (TASK 10), four questions asked by the Orchestrator

### D-FX-1 — Where do FX rates come from?
**Asked:** local-first app with no network layer; the art. 68 caps need the BNR annual average (`CURSA_EURM`), which is **obtainable, not computable**; daily rates moved to `curs.bnr.ro` on 6 Aug 2026; no FY2026 annual average exists yet.
**Options offered:** verified seed + manual entry / manual entry only / **fetcher behind a boundary**.
**User chose: fetcher behind a boundary.**

**Implemented** (`8732e3f`): `src/domain/fx/provider.ts` — `FxRateProvider` with `dailyRate` and `annualAverage`, both synchronous. Loading is `loadDailyRates`; manual entry is `manualAnnualAverage` and remains the fallback. BNR XML client in `src/domain/fx/bnrXml.ts`. **No test performs a network call** — tests use `fixtureRateProvider`.
**Honest limitation, recorded not hidden:** „XSD-validated" is a **structural validator**, not XSD conformance — there is no XSD processor in the dependency set. Stated in code and in `phases/24_currency_fx_store.md`, **not claimed on screen**.

### D-FX-2 — How is a foreign-currency amount stored?
**Asked:** defect B-32 — `Revenue`/`Expense` carry no currency field and money is integer RON `Bani` end to end. Options: bolt a currency field onto the RON number, or a **multi-currency money type**.
**User chose: multi-currency money type.**

**Implemented** (`84dda5b`): `src/domain/money.ts` — `interface Money<C extends CurrencyCode = CurrencyCode> { amount: Bani; currency: C }`, `CURRENCY_CODES = ['RON','EUR','USD','GBP','HUF']`, integer minor units, `RonMoney = Money<'RON'>`. Arithmetic is per currency (`addMoney` / `subMoney` / `sumMoney` / `maxMoney`) and **mixing currencies is a `tsc` error** through `addMoney<A, B extends A>`; `requireRon` is the explicit boundary. Persistence: data version **10**, chain step **`record-currency`**, which stamps `RON` on existing records — a **value-preserving no-op**, because those records were always treated as RON.
**The digest question, answered with evidence rather than assumption:** `canonicalize` emits every own key, but it is handed `inputSnapshot`, and `CalculationInput` is `{ profile, revenues: Bani, expenses: Bani }` — **aggregate lei totals, not record arrays**. A currency on a record is unreachable from the digest bytes, so **no stored `inputsHash` moved and no `preMigrationInputsHash` was written**. The two ways it *could* have moved (a `PfaProfile` field, an `inputSnapshot` key) were deliberately not done.

### D-FX-3 — A payment or collection falls on a day BNR publishes no rate
**Asked:** research 23 Q3 is UNVERIFIED as a general rule — BNR publishes only on banking days, CF art. 9 alin. (4) requires a rate „valabil pentru datele respective" but never defines *valabil*, and „ultima zi bancară anterioară încasării" occurs **exactly twice in the whole Codul fiscal** (art. 68^3 alin. (4), art. 85 alin. (4)). Options: refuse / carry forward labelled as policy / ask the user for the rate.
**User chose: carry forward, labelled as app policy.**

**Implemented** (`8732e3f`, `b54d756`): `src/domain/fx/carryForward.ts`; the rate record carries `carriedFrom?`, and `convertToRon(...)` returns `carriedForward`. Surfaced through the existing `InterpretationNote` component as **application policy by analogy from art. 68^3 alin. (4) / art. 85 alin. (4)** — never as a statute sentence.

### D-FX-4 — Do the euro caps compute, or only become representable?
**Asked:** the seven art. 68 alin. (5) euro caps are excluded as unmeasurable; for FY2026 the required annual average does not exist, so any 2026 cap is provisional (B-33). Options: compute only when a rate exists / **also compute provisional 2026 caps**.
**User chose: also compute provisional 2026 caps.**

**Partly implemented.** 10a built the representation: `provisional` on the rate record, and `RateStore.replace` keyed by `rateKey` as the provisional → final mechanism. **The caps themselves are TASK 10b** — `docs/ai/briefs/27_task10b_euro_caps_provisional_rates.md`.

### D-FX-5 — USD must work end to end, not merely parse
**Raised by TASK 10b**, which asked what 'USD to be available' meant, because CF art. 68 alin. (5) states its caps **only in euro** (the package holds exactly seven `capEur` rules) and no rule carries a USD cap.
**User decision, 2026-10-10:** the multi-currency money type chosen in D-FX-2 was meant to make USD **usable**, not just representable. **Brief 27 under-specified this; the gap was the Orchestrator's, not the Worker's.**
**Chosen: (b)** — a currency-generic cap converter, **plus** USD rates recordable end to end through a store writer upserting on `rateKey`.

**Constraints placed on it:**
- **No USD cap may be invented.** The statute states the caps in euro; the generic path exists for a future *verified* non-euro ceiling, not as a licence to manufacture one.
- **Verified versus pattern-derived stays visible.** BNR's XML carries USD **daily** reference rates, so that path is real. The USD **annual-average** series code is pattern-derived and keeps the `-PATTERN` suffix and unverified label — a code that looks official will be trusted.
- **Where USD bites is the record, not the cap:** a USD expense or receipt converts at the BNR daily reference rate on the payment / collection date under CF art. 9 alin. (3) lit. b) + alin. (4), which is not EUR-specific.
- A store writer is **not** a new network path; the deliberate widening is to be stated in the phase doc rather than left to look like creep.

---

## Decisions from the same round that are not FX

### D-SEED-1 — How far does TASK 9 go on declaration-shaped seed facts?
**Asked by the Worker.** The seed asserted quarterly D100/D220 filings that are not obligations for this profile (research 06: D212 replaced 232 and 220; research 12: art. 120/120¹ abrogated from 01-01-2025, one operative 25 May annual deadline). Options: minimal / **seed-only, quarterly removed** / model change.
**Orchestrator chose B**, with three conditions the user's brief did not contain: **no invented nil returns** (there is no monthly obligation either, so a nil return would replace one fictional obligation with another); the annual D212 must not manufacture a second deadline; gross 205,50 lei and deductible 120,00 lei stay visibly distinct.
**Implemented** (`76b50ca`): `declarations: []`; the quarterly artefacts became the one return this profile files, **D212 for 2025, filed 20.05.2026**; no nil return minted. Two model defects **recorded, not fixed** — **B-34** (`Declaration` is monthly `{an, luna}` and cannot hold an annual filing) and **B-35** (D300 periodicity is undetermined by the seed's own facts). The plan's CUI-collision claim **does not reproduce** and is recorded as stale.

### D-TEST-1 — Browser-level reserve reload test
**User decision, 2026-10-09.** TASK 3 proved the round trip in jsdom against real `localStorage`; a Playwright test exercises a real browser's storage lifecycle.
**Implemented** (`dd7f812`): new spec, deliberately **no `addInitScript`** — it re-runs on reload and would make the round trip vacuous. **e2e 36 → 37**, and every document pinning 36 was updated.

### D-SCOUT-1 — Scout concurrency
**Asked:** the updated roadmap permits parallel Scouts. **User chose: keep sequential** — „scout concurrency remains the same as we are doing right now. its better."
**Implemented:** every brief since carries rule 4 as an explicit override with the reason (one engine slot, ~390 MiB headroom, two Workers SIGKILLed mid-run), so no future Worker re-litigates it.

### D-LANG-1 — Three Romanian rulings against the Orchestrator's audit
The Orchestrator's language audit was **wrong three times**; the user corrected it. Recorded because the wording was deliberately left alone:
- **„fapta"** is attested Romanian, the legal/judicial register (*fapta prevăzută de legea penală*) — finding withdrawn.
- **„Codul CAEN"** is the articulated form of *cod CAEN*, standard business usage — finding withdrawn.
- **„nici o parte"** with *nici* as intensifier plus the article *o* means „not even one part" — finding withdrawn.
**Implemented:** the Worker left all three unchanged and parked **nine wording calls** for the user's native judgement in `phases/21_language_layer.md` §13, rather than changing them on the Orchestrator's authority.

### D-SCOPE-1 — Where this round stops
**User:** „We stop after task 10." Updated **Phases 11–34** were supplied and mapped in `docs/ai/roadmap_11_34_mapping.md`, but are **not started**.

---

## 2026-10-10 — the seven decisions from `PHASE_PLAN_11_34.md` §9

Asked after the independent audit. Six settled here; the seventh (wording) is pending the user's numbers.

### D-SEED-2 — Seed scenario: both, and seed data is **test-only**
**Chosen:** option 3 — a 2026-start PFA as the product scenario, the 2020 PFA surviving as a test fixture. The user's framing: *“the way I understand it is that Seed data is only for tests.”*
**Consequence, recorded before implementation:** combined with D-RUN-1 below, `seedData` should not be what a production install receives at all. `store.tsx:166-167` returns `seedData` for a first run; that changes to an empty dataset, and `data/seed.ts` becomes fixtures for tests and for the persona demo. **This is a bigger change than a seed edit** — anything that reads seed figures as live app state (the pinned deductible 120,00 / 144,00 lei, VNA 9.096,00, hero 51.510 lei, e2e clock 3.249,00) is pinned through the **test** path, so the figures survive; what dies is the shipped demo bundle. Phase 11 must prove that, not assume it.

### D-RUN-1 — First run: **start empty**
**Chosen:** option 1. No preloaded data, no banner-on-demo compromise. Closes **D1** at its root rather than papering over it.
**Deferred by the user, to be specced separately:** a **“Get started” flow or demo showing how the app looks for different kinds of personas**. That is a deliberate, user-entered experience — not silently preloaded records — and belongs to Phase 26, not Phase 11. It is the reason the 2026-start scenario and the 2020 PFA both stay useful.

### D-SCOPE-2 — Supported scope: **broad, with rigour**
**Chosen:** option 3 — attempt every profile, refuse only where a fact is missing, *“with rigorous planning and execution to remove the risks.”*
**What that obliges, and it is not optional:** every unsupported case needs an explicit refusal state that is **built and tested**, not assumed. That makes regression scenarios 4 (activity-specific rules), 6 (additional income) and 8 (VAT periodicity) in `PHASE_PLAN_11_34.md` §8 **acceptance criteria**, and it is why 12E, 12F and 13's completion gate cannot be deferred. A broad scope with untested refusals is exactly the confident-wrong-number failure this project has spent the round eliminating.
**Still true:** Q-VAT-PERIOD is a missing *input*, not a missing source, so 18B is closed by collecting the facts or refusing — not by more research.

### D-SEV-1 — Severity vocabulary: **map back onto `info | warning | danger`**
**Chosen:** option 2, reversing the roadmap conflict C1 in the roadmap's favour.
**Implementation constraint the Worker must honour:** TASK 8 deleted the `high→danger / medium→warning / low→info` translation because a single three-value field fused **legal status** with **urgency** and could not express “legally load-bearing, not urgent”. That distinction is a correctness property, not a style choice. So: the **domain keeps its dimensions**, and the three-word vocabulary is applied at the **display boundary**. Mapping at the boundary satisfies the roadmap text without re-fusing the two ideas inside the engine. If a case cannot be expressed in three words, the row shows the word **and** the reason — the word never carries the legal meaning alone.

### D-VER-1 — Rule edition numbers: **bump going forward, never back-fill**
Asked a second time in non-technical terms (fingerprint vs a typed edition number) at the user's request; they chose **“start edition numbers from now on.”**
**Meaning:** all 48 rules stay at `version: 1` — the Phase 3/4/5 corrections happened before content addressing existed and minting superseded editions for them would fabricate history. **From the next content change onward**, a rule change issues a superseded release and bumps `version`. The content digest remains the identity that makes an old snapshot replayable; the edition number is a human-readable trail that is only ever written truthfully and only at the moment of change. Closes roadmap conflict C2 without the back-fill the roadmap's wording invited.

### D-DOCS-1 — Phase documents stay in `docs/ai/phases/`
**Chosen:** option 1. `docs/ai/steps/` is a 33-file frozen archive whose numbering already means something else (`steps/15_tax_engine.md`); writing `steps/15_calculation_snapshots.md` there would overwrite an unrelated frozen record. The roadmap's `steps/NN_<name>.md` filenames are treated as **labels**, not paths. Closes C3.

---

### D-LANG-2 — The nine parked wording calls: **all eight remaining approved**, with the user's variants

The user reviewed each sentence in full (not the abbreviated table — that was my first mistake) and ruled. Recorded here as the authority for Phase 28 / PG-12.

| # | Ruling | Final wording |
|---|---|---|
| 1 | Change | `nedeasă` → **`nedecisă`** |
| 2 | Change | `… art. 123 alin. (1). **I**mpozitul pe profit nu este oferit: …` |
| 3 | Change | `Art. 174 alin. (8) **se întemeiază pe** o faptă din anul precedent, …` |
| 4 | Change — **variant B** | `… banda de 10 % este o politică de afișare a aplicației și **nu este o regulă legală**.` The user took my counter-recommendation over my own first proposal: `nu are nicio bază legală` can read as “unlawful” |
| 5 | Change | `cassFlagUnverified`: `lasă linia de verificat` → **`marchează linia ca fiind de verificat`**, matching the three notes already using it |
| 6 | Change, **with a qualification** | **`amprentă de conținut`** in user-facing labels and explanations; `digest` / `contentHash` stay in code identifiers; **the term is explained once in plain Romanian** where it first appears. This settles the objection TASK 9 recorded (half-renaming the family) — it does not, because the whole user-facing family moves together |
| 7 | Change — **variant B** | `Praguri fiscale **comparate cu valorile înregistrate**` |
| 8 | Change — both, plus the optional improvement | `Dacă nu se completează, profilul rămâne fără dată de înființare.` / `Dacă nu se completează, aplicația nu cunoaște data și nu afișează niciun termen de înregistrare — nu inventează unul.` And `baza nu se proratează` → **`baza nu se ajustează proporțional cu perioada de activitate`**. **The nuance the user attached:** the shorter wording replaces the *missing-value* explanation only — the substantive legal explanation and why the date matters stay |
| 9 | Change | `«înregistrată»` → **`„înregistrată”`** in both `sources.capReadingChoice` and `records.capAppliedReading` |

**The principle the user stated, which governs the rest of the language work:** consistency is not correctness. A wording change must not alter fiscal meaning. Their example is the right one — moving a CASS sentence from `calitatea de pensionar` to `sume primite ca pensii` changes **which fact is being evaluated**, and the code deliberately separates pensioner status from pension income received in the fiscal year. That distinction survives in both the calculation and the explanation.

**One reviewer claim that does not reproduce.** The report says the fallback for an unrecognised completeness key is “the English word *date*”. There is no such fallback in `domain/completeness.ts` (grep for a `'date'` literal or a label fallback returns nothing), and the string the report is almost certainly reading is `copy.dashboard.completenessTitle` = **`Completitudine date`** — where **`date` is Romanian for “data”**. Same class of false positive as the CUI collision and the three withdrawn language findings, and recorded for the same reason: a plausible finding still has to be checked.

**The broader language findings from the same review** — `Estimare impozit` naming a figure that includes CAS and CASS, the generic `Venit PFA` threshold label where CAS/CASS and VAT measure different bases, `Prag de înregistrare depășit` stating an arithmetic comparison instead of the obligation, `Nivel de calcul modificat` stating an abstraction instead of the consequence, `Aproape de prag` firing when the user is already above a floor, the completeness messages reading as internal software terminology, and the Settings explanations being one dense legal paragraph — are **Phase 28 / PG-12 work**, listed in `briefs/28_pg_production_gate.md` §2 PG-12 and in the reviewer's own §2 A–E. They are terminology and information-architecture changes, and each must be checked against the rule it describes before it moves.

---

## Still open — to be put to the user

The seven §9 decisions are closed (D-SEED-2, D-RUN-1, D-SCOPE-2, D-SEV-1, D-VER-1, D-DOCS-1, D-LANG-2). The owner decisions in `briefs/28_pg_production_gate.md` §4 — **D-1** an invoice with no collection date, **D-2** the reserve horizon, **D-3** normă de venit at launch, **D-5** how the fiscal year advances, **D-6** who owns the disclaimer wording, **D-7** the calculation-sheet export format — are being put to the user now. **D-4** (mid-year projection) waits on scout **L-1**, which is running.
