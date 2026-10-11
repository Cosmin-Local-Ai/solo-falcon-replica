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

## 2026-10-10 — the PG owner decisions (brief 28 §4)

### D-DATE-1 — Missing payment / collection date: assume the document date, but say so
**Chosen:** option 1 — the document date stands in for the money date — **plus two things the user added**: the money date must be enterable, and the field carries an informational note explaining *when it matters*. Their suggested wording: something like „completează acest câmp dacă ai încasat plata într-un an fiscal diferit de cel al facturii”.
**Why this is the right shape:** it keeps entry cheap for the common case (paper and money move together) while making the one case that changes the tax year explicit to the user. It does **not** make the assumption invisible.
**Still owed:** scout **L-7** confirms the cash-basis rule itself (art. 68 alin. (2) lit. a) / alin. (4) lit. b)) and what the law says about an invoice with no payment date at all. The product decision is made; the legal basis still has to be cited.

### D-RES-1 — Reserve horizon: **spread to 25 May of the following year**
Because that is the single real deadline for income tax, CAS and CASS together (CF art. 122 alin. (3); art. 68 alin. (9)-(10), art. 151 alin. (1), art. 174 alin. (15)). The monthly figure becomes smaller and matches when cash is actually needed.
**Consequence, and it is a model change, not a copy change:** the reserve target now **crosses the fiscal-year boundary**. A 2026 obligation with a 2027 due date has to exist as an object — see D-YEAR-1 and the cross-year obligations timeline.

### D-NORMA-1 — Normă de venit: **support it before launch**
**Chosen:** option 2 — real support, not a refusal screen. This reverses the boundary Phase 6 recorded deliberately (`norma_venit` as a refused boundary with no invented values).
**Recorded honestly, before any code:** this is the largest scope addition of the round. It needs a second calculation method driven by published norm tables that vary by activity and by region and are reissued annually by ministerial order. **No 2026 norm table has ever been verified in this project** — that is precisely why the boundary was refused in the first place. If the tables cannot be verified from primary sources, the calculation cannot ship and the refusal returns, having cost the time regardless.
**Therefore:** scout **L-9** (new) answers the eligibility, the source of the tables, and whether a PFA may elect the method for FY2026 **before** any implementation is scheduled. The answer decides the schedule.

### D-YEAR-1 — Fiscal-year rollover: **automatic switch, with a toggle back and a banner**
**Chosen:** a variant of option 1. On 1 January the app **switches to the new fiscal year automatically**, a **toggle somewhere in the UI** lets the user return to a previous fiscal year to review it, and a **banner on New Year** states what the app did and how to review the closed year.
**The consequence the user must see, recorded here:** there is **no verified 2027 rule package**, and the 2027 minimum wage is not yet published. So the default screen on 1 January 2027 is a **refusal** — any 2027 figure would be an invented one. The toggle and the banner are what make that survivable. It also creates a **standing task, not a phase**: stage the 2027 package as soon as the 2027 acts are published, or the app is a refusal screen for weeks after New Year.

**Chart continuity — the design rule that came out of the user's own question.** The reviewer asked whether the chart needs changing across years. It does not, and the reason matters:
1. The **fiscal series belongs to one fiscal year**. No continuous 24-month line: 2026 is *final from actuals*, 2027 is *projected*, and drawing them as one line blends two different kinds of number — the same error the projection already makes. A cross-year view is a **year-over-year comparison**, not one long line.
2. **Tax paid in May 2027 is not a 2027 expense.** It settles a 2026 obligation. Putting it in the 2027 fiscal series double-counts the burden.
3. It **is** a real 2027 cash event, and D-RES-1 makes that explicit. So the model needs a **cross-year obligations timeline** — a 2026 obligation with a 2027 due date — in its own series, separate from the fiscal chart.
**Rule: the chart stays per-year; what crosses the boundary is the obligation, not the chart.**

---

### D-YEAR-2 — New fiscal year: **carry forward, update when the datum arrives**
**Chosen:** carry forward. The user supplied the minimum-wage history themselves (HG 1091/2014 through HG 146/2026) to make the point that the wage **always** changes, so the app cannot simply stop and wait: it carries the last known value forward and updates the moment the new one is published.
**What I recorded alongside it, because the direction of the error is not uniform:** carrying an older, lower wage into a new year moves the two contribution lines in **opposite** directions. A lower 12-SM floor makes CAS look **due** when it may not be — overstating, the safe direction. A lower 6-SM CASS floor makes the art. 174 alin. (6) top-up look **smaller** than it will be — understating, the unsafe direction. So "carry forward" is acceptable only with the value visibly stamped as not yet updated for the year, and it is not acceptable as an invisible default.
**Standing task, not a phase:** stage the 2027 rule package the moment the 2027 acts are published. Until then the app is honest that it is running 2026's rules.

**Addendum 2026-10-10, after `research/32` — the decision stands; two things about it changed.**

1. **The value being carried is not what I assumed.** The FY2027 anchor is **4.325 lei** (HG 146/2026, MO 196/13.03.2026), **not** 4.050. CF art. 135¹ alin. (3) takes the wage „în vigoare la data de 1 ianuarie a anului”, and on 1 ianuarie 2027 that is HG 146/2026's value, in force since 1 iulie 2026. **Carrying 4.050 would be two steps stale and wrong even if the wage is frozen.** FY2027 bases if nothing is published: 6 SM **25.950**, 12 SM **51.900**, 24 SM **103.800**, 72 SM **311.400** lei — and in that case they are not estimates, they are the law.
2. **My "opposite directions" note understated it.** R-C's worked example shows **four** directions from the same stale wage: CAS **overstated** for income between the carried and true 12 SM; CASS **overstated** through the 24 SM tier boundary at some incomes (at income 110.000 lei, carried base 103.800 against a true tier-1 base of 55.200) and **understated** at others; the art. 174 alin. (6) top-up **understated**; CASS **understated** at high incomes through the 72 SM cap. **There is no single conservative direction**, so a padded carry-forward is not a safe design — the provisional, visibly-flagged value with a recompute trigger is the only honest one. That was already the shape of this decision; it is now the reason for it.

**And the mechanism does not exist yet.** Carrying forward is not a labelling problem: `selectRuleSet` returns nothing for an unregistered year, so on 1 ianuarie 2027 the app would switch year and go to `review_required` everywhere. Recorded as **B-58**, with **B-59** for the fact that the thresholds are stored as lei literals whose SM agreement is enforced only by a test.

### D-LANG-3 — Second Romanian proof-check: accepted, with three items held for research
Full report and my in-tree verification of every claim: `docs/ai/notes/romanian_proofcheck_2026-10-10.md`. **All eight concrete claims reproduce.**
**Accepted now:** the six definite errors; the `Detaliu status` placeholder that asks for a rejection reason on a pending record; informal address throughout; the plain-language rewrites of the research-note phrasings; the terminology standardisation; the 2025 hard-coded default; the file-size message.
**Held for the researcher, because they carry legal content and are not copy:** the D100 / D220 form categories still taught in the documents copy (the same error TASK 9 removed from the seed); the intra-community VAT-code hint, which claims any EU collaboration needs the code; the official Romanian name of the RJIP register.
**Held until PG-7 makes it true:** the proposed foreign-currency wording. It says the record is absent from the lei totals — correct as a description of what *should* be visible, wrong as a description of today, where the sentence and the aggregation disagree (B-37).
**Two findings that are not language problems at all**, and outrank the grammar: **B-55** an internal English identifier printed inside a Romanian sentence, which the copy guard cannot see because it only scans components and pages; and **B-56** `Declarația … a fost transmisă` and `Contul este conectat la platforma e-Factura` sitting on actions that only mutate local state — `sendDeclaration` is a `setData` call and there is no e-Factura integration. In a financial app, a user who believes a declaration was filed may not file it.

---

### D-PROJ-1 — The tax estimate is calculated on **actuals**; a forecast may be shown but never feeds it
**Chosen:** option 1, and the user checked the scope first — they asked whether this was about the chart or the tax estimate box, and confirmed it is the **tax estimate box**. That distinction is now part of the rule:
- **The hero figure is computed only from records that actually exist** — receipts actually collected, expenses actually paid — and is labelled with the date it is measured as of. No multiplying by 12, no dividing by months elapsed.
- **A forecast may exist beside it**, visually distinct, and must never be what the engine or the contribution thresholds are measured on.
- **The chart's projected series is unaffected as a visual aid** — it stays, and Phase 22 still owes it a non-colour cue so actual and projected are distinguishable without colour. A picture of a forecast is fine; a tax number that is one is not.
**Why this is now a legal requirement and not a preference:** `research/26_midyear_start_partial_year_2026.md` established that CF art. 118 alin. (3) deems fraction-of-year income to *be* the annual income, that art. 68 alin. (2) lit. a) and alin. (4) lit. b) measure actual receipts and payments with no annualisation, and that the statutory proration for mid-year starters was deleted by OUG 115/2023 art. I pct. 101 from 1 January 2024. The October example: the app's ~40.000 lei annual figure makes CAS look due; on the law's 10.000 lei, none is due.
**What it does not resolve:** mid-year, whether a threshold will be crossed by December is still unknowable. The app must say **which basis each threshold was tested on** rather than imply the answer is settled. That stays part of PG-1 and PG-4.

**RESOLVED 2026-10-11 (PG-5C, `docs/ai/phases/34_pg5c_actuals_basis.md`).** Both halves now hold, and the second one is enforced by the type system rather than by wording:
- The hero is computed from recorded amounts only. `EstimateAmounts` — the engine's operand type — carries the `asOfDate` it was measured as of; `ForecastAmounts` deliberately does not, because a grossing-up was never measured as of anything. A forecast is therefore **not assignable** to an engine operand, and no call site can feed one to `computeTaxEstimate` or to a threshold base without a cast. Two tests hold the door with `@ts-expect-error`, so the guard failing is itself a test failure.
- Every threshold row names its basis, and the only annual basis the row type can carry is a realised one — the projected member was deleted from `MeasuredBasis`, and `measuredBasisLabels` is a `Record` over that union, so restoring it is a compile error until someone also writes the sentence that would put it on screen. The card additionally states the date the values were measured at.
The October case is pinned end to end in `src/data/partialYear2026.test.ts` and `e2e/partial-year-2026.spec.ts`. The unresolved question the decision recorded — whether a threshold will be crossed by December — is still unresolved, and is now answered honestly rather than implied: the app names the basis and the date instead of predicting the outcome.

---

## Still open — to be put to the user

**D-6** who owns the disclaimer and terms wording. **D-7** calculation-sheet export format: print stylesheet, PDF, or JSON.

### D-NORMA-2 — Normă de venit: the cost is now known, and it was not known when D-NORMA-1 was decided
**D-NORMA-1** chose "support it before launch, not a refusal screen" on 2026-10-10. At that moment nobody had verified that the numbers existed anywhere citable, and **D-NORMA-1's own text says the tables are "reissued annually by ministerial order" — which `research/30` proved false.** The research is now done and the cost is attached, so the decision should be re-taken with the number in front of it rather than inherited.

**What building it actually means** (`research/31`): a **42-table county dataset**, not one national table — 128 nomenclator positions × 42 județe × 1-18 locality columns, **not published in Monitorul Oficial**, cited per county decision, with **only 13 of 42 counties carrying a machine-readable act number**. Plus a manual tail: **8 counties unreadable** (7 scans + 1 corrupt text layer) ≈ **1,000-1,300 figures** to OCR or transcribe; **12 counties with deficient correction coefficients** ≈ **~300 coefficient rules** to hand-encode, each county with its own criteria vocabulary and stacking rule; and a **hand-built locality taxonomy** with no official source to derive it from. Re-annual maintenance: 42 county decisions reissued every Q4, and the ANAF index itself has **7 dead links** today.

**The three options, with the consequence of each stated:**
1. **Build it fully.** 12H becomes a data-engineering phase with a manual tail and a yearly maintenance obligation. It is the only option that is legally complete for a norm-payer.
2. **Build a partial, honest version:** the 34 readable counties, the statutory floor (12 × SM = 48.600 lei, which is the dominant 2026 value and is citable to art. 69 alin. (3)), and an explicit "this county's norm is not in the app — see the ANAF decision" state for the rest. Legally incomplete by county, but every figure it does show is cited.
3. **Reverse D-NORMA-1 and refuse the regime explicitly.** `research/30` §7 already drafts what the refusal must say, including everything the user still owes. This is the option the project originally chose deliberately in Phase 6.

**What is not in question:** whichever option is chosen, the app must not compute sistem real for a profile the law puts on normă de venit. That is a silent wrong number, not a refusal — and it is currently what the app does.

### D-USER-1 — There are **no active users**: migrations need not preserve data nobody has — **user decision, 2026-10-10**
Stated while reviewing PG-5's migration. PG-5 moved every monthly `declaration` row into a new `legacyDeclarations` bucket byte-for-byte purely to protect stored data. **There is no stored data to protect.** So the legacy bucket goes rather than becoming a permanent second vocabulary, and **B-75 exists only because it was kept**. This does not relax the migration chain itself — steps are still never renumbered and dev/test payloads still migrate — it removes the obligation to *preserve* shapes the product no longer supports.

### D-VAT-1 — Form 300 setup: **ask the facts, derive when possible, confirm when not** — **user decision, 2026-10-10**
Chosen for PG-6, after the user asked how someone who has just started a PFA would set this up. The answer drove the decision: **there is no field anywhere for a VAT registration date**, and a brand-new PFA has no previous year to measure, so nothing can be derived from history.
1. Ask the two things the user actually knows: **are you VAT-registered, and since when?**
2. Where the cadence follows from those facts plus recorded income, **derive it and show the reasoning.**
3. Where it does not — a new PFA — **state the rule in plain words and ask the user to confirm monthly or quarterly**, labelled as *their* answer, never as the app's conclusion.
**Never** a guessed cadence, and never the current dead end of "cannot be established" with no way forward.

### D-CAZ-1 — art. 68^3 accommodation income: **support it properly, do not refuse it** — **user decision, 2026-10-11**
Brief 28 §PG-6b told the app to **refuse** accommodation income. The user overruled that: *"If we can implement it PROPERLY now, we do it now."* Asked which taxpayers to cover, they declined the legal question and told me to decide from the law in front of me.
**Decision: implement all three paths**, because they are not three features — they are one arithmetic reaching three categories, and the most common real user is the one the narrowest option refuses:
- **(a)** tourism operators providing accommodation measured in days — art. 68^3 alin. (1).
- **(b)** a private person renting **more than 7** short-term rooms: from the fiscal year they cross 7, the income becomes an independent activity under art. 68^3 — **alin. (12)** with **art. 83 alin. (4)** (mod. Legea 239/2025 pct. 7).
- **(c)** a private person renting **1–7** rooms: stays in **cedarea folosinței**, a different income category, but from 2026 it is **also** on the 30 % flat-expense basis — **art. 85 alin. (1)–(2)** (mod. pct. 10). This replaces the old tourist normă for 2026.
**Refusing (c) would refuse the likeliest user of all** — someone with two or three apartments on a booking platform.
**What is already answered:** the 30 % is a flat **expense** ratio (alin. 2), tax is 10 % of that net and **„impozitul fiind final"** (alin. 6) → effective 7 % of gross; the net **is cumulated for the CAS 12/24-SM band** — `research/07` §2 records that the 01.01.2026 amendment to art. 148 alin. (3) inserts art. 68^3 into the cumulation list, a cross-reference change only.
**Now answered (`research/38`, 2026-10-11):** the 68^3 net **is** the CASS base — Legea 239/2025 art. XII pct. 19 amended art. 170 alin. (1) to name art. 68^3, two puncte after pct. 18 did the same for CAS — floored at 6 SM, capped at 72 SM, rate 10 %; and the occupancy-sheet order **was** published, as **OPANAF 381/2026, MO I 250/31.03.2026**, nine days late. „Impozitul fiind final" has **no** CASS effect.
**Genuinely undetermined, and it must stay `review_required`:** the **alin. (3) platform-commission scope** — the words limit the exclusion to rooms in personal dwellings while the article's subject is a tourism operator's let space, and the choice moves gross, therefore tax, the CASS base and the CAS threshold; and the **alin. (1) eligibility gate**, a tourism-law classification outside the fiscal code. **The app asks; it does not decide.**
