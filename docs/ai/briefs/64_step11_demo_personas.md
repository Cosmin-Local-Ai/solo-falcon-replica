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
6a. **UNDER NO CIRCUMSTANCES does the Worker do any work while a Scout is running.** After dispatching a Scout, **stop and end the turn.** No side-quests, no "meanwhile I'll read this", no drafting, no edits, no repository searching while waiting. Strict sequence: **dispatch one Scout → stop → receive report → read only the files you will actually edit → edit → dispatch the next Scout if needed → stop → …** If work was already started in parallel with a Scout, stop, discard that parallel searching, and wait. The failure mode this prevents: the Scout's report arrives after the Worker has already searched the repository itself, which wastes the Scout, burns the Worker's context, and defeats §12.9 entirely.
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

# Brief 64 — Step 11 / 15: demo personas, the CAEN nomenclator, and persona selection by CAEN

**D-DEMO-1**, and with it **B-96**, **B-100**, **B-123**, **B-124**. **Product scope, not a release gate** — but it is the step that makes everything from steps 1–10 *visible*, and B-123 is the proof: **B-112 shipped four stages and 2,526 unit tests with zero demo data and zero e2e coverage.**

**Read before briefing anyone:** `research/51_caen_rev3_and_cash_basis_fy2026.md` (CAEN as data, the 5-class cap, cash basis) and `research/52_dividends_losses_withholding_fy2026.md` (dividends 16 %, the loss operand, over-withholding).

## ⛔ Two hard rules on CAEN, first, because everything else depends on them
1. **The complete CAEN Rev.3 nomenclator ships in the repo. All levels, all classes, official denominations. No hand-picked subset, no hand-typed codes.** Standing user instruction, 2026-10-14: *„we need a complete CAEN Rev. 3 list … dont guess CAEN's."*
2. **⚠️ Every CAEN code anywhere in this brief is UNVERIFIED and must be replaced by a lookup against the shipped nomenclator before a line of persona code is written.** The codes in Part C were written from memory. **They are placeholders that look like facts, which is the most dangerous form a guess takes.**

---

## The governing rule for this step
**The persona set must cover every fiscal thing the platform actually computes — and no persona may be a grab-bag.** Standing user decision, 2026-10-14: *„dont overload the personas, but make sure demo data showcases everything our platform does for specific kind of users"* and *„the personas are supposed to cover everything our platform could possibly do, every type of tax thing our platform does."*

**So the unit of design is the user type, not the rule.** A persona is allowed to carry several regimes **only where a real person would plausibly have them together.**

## The inventory this step must cover — 13 regimes, not six
From `FiscalRegime` in `src/domain/fiscal/rules.ts`:

| # | Regime | Article | Currently reachable in demo data? |
|---|---|---|---|
| 1 | `income-tax` | Titlul IV passim | ✅ profile-1 |
| 2 | `cas` | art. 148 / 151 | ✅ profile-1 |
| 3 | `cass` | art. 170 alin. (1) / 174 | ✅ profile-1 |
| 4 | `vat` | Titlul II | ✅ B-96 |
| 5 | `deadlines` | art. 122 etc. | ✅ |
| 6 | `wage-reference` | SMN figures | ⚠️ implicit only |
| 7 | `expense-deductibility` | art. 68 alin. (4)–(7) | ✅ |
| 8 | `accommodation-flat-ratio` | **art. 68³** | ❌ |
| 9 | `short-term-rooms-flat-ratio` | **art. 85** (1–7 rooms) | ❌ in demo, ✅ in e2e |
| 10 | `cedare-art84-flat-ratio` | art. 84 alin. (3) | ❌ |
| 11 | `cedare-art84x1-withheld` | art. 84¹ | ❌ |
| 12 | `dpi-flat-quota` | art. 72 alin. (2) / 72¹ | ❌ **B-123** |
| 13 | `contribution-withholding` | art. 151 alin. (5)–(11), art. 174¹ alin. (3)–(9) | ❌ **B-123** |

**Plus, outside the regime union and equally in scope:** the **six CASS ladder categories** (`CASS_LADDER_CATEGORIES` — lit. c) DPI, d) asociere, e) cedare, f) agricole, g) investiții, h) alte surse), **depreciation** (B-31, B-93), **VAT periodicity** (B-101, B-102, B-103), **VAT registration route** (B-96), **the art. 298 vehicle status** (B-94), **FX conversion with three different rate dates** (B-105), **salary/pension status** (art. 150, art. 154 alin. (1) lit. h¹)), and **dividends at 16 %**.

**Against the six ladder categories, four are unexercised today: lit. d), f), g), h). The sharpest is lit. g) — our own golden fixture, Exemplul 3, depends on dividends, and no persona can reach them through the UI.**

---

## Part A — CAEN: the nomenclator, and the input
**Facts, all from `research/51`. Do not re-derive them.**

- **Legal basis:** Ordinul președintelui INS nr. 377/2024, MO I 385/25.04.2024, in force 1 January 2025. **CAEN Rev.3 has exactly four levels — secțiuni (letter), diviziuni (2), grupe (3), clase (4). There is no 5–6 digit sub-class. Registration is always at the 4-digit class.**
- **The cap is on the TOTAL, not on a "secondary" category:** **OUG 44/2008 art. 16 alin. (1)** — *„PFA poate avea în obiectul de activitate **cel mult 5 clase** de activități prevăzute de codul CAEN"* (ÎI: 10; **SRL: secondary objects unlimited**). **So 1 principal + 4 secundare is the arithmetic of a 5-class total.** Model it as the user described — **one principal, up to four secondary** — and put the citation on the control, because the number looks arbitrary otherwise.
- **Principal vs secondary is an ONRC form concept, not a fiscal one.** The cerere has one „Activitatea principală: Clasa CAEN" field plus an annex for the rest.
- **CAEN creates no fiscal consequence** — **HG 656/1997 art. 4 alin. (1)**: *„încadrarea … **nu presupune crearea de drepturi sau obligații**"*. **It is operative only where a text names it:** art. 68 alin. (5) lit. r) CF (CAEN 9311/9312/9313), Normele metodologice pct. 3 (the art. 60 pct. 4 scutire list), and ONRC's authorisation/aviz regime.
- **A shippable source exists:** **ONRC `N_CAEN.CSV` on data.gov.ro under CC BY 4.0** (dataset `e1de86b4-e2d3-4d9e-ad12-1632e030624c`, and `7fe937a5-…` 03.09.2026). **INS itself publishes only PDF/XLSX — no CSV, no API.** **Attribute to INS + Ordin 377/2024 + MO 385/2024.**
- **⚠️ Count the classes before shipping.** The working numbers are **22 secțiuni / 87 diviziuni / 287 grupe / 651 clase**, CORROBORATED from the 1:1 NACE Rev.2.1 equivalence — **not counted from the INS file.** Count them, and assert the count in a test.
- **⚠️ Rev.2 → Rev.3 is a trap we already documented:** Rev.3 **adds 5540 „Intermedieri pentru servicii de cazare"**. Any list copied from a Rev.2 source is wrong. **Ship the version marker** — ONRC's `n_versiune_caen.csv` gives `3^Versiunea 2025`.

### Part A1 — the nomenclator as data. Build this first.
**Deliverable: the complete CAEN Rev.3 classification in the repo.**
- **Every level — secțiuni, diviziuni, grupe, clase.** Not only the classes: a user typing `47` should see the diviziune and understand what a class sits under.
- **The official Romanian denumire for every entry, with diacritics. The ONRC CSV carries them — do not retype them.**
- **A version marker on the dataset and in the UI.** `n_versiune_caen.csv` gives `3^Versiunea 2025`. **Rev.2 → Rev.3 is a live trap: Rev.3 adds 5540 „Intermedieri pentru servicii de cazare".** A list copied from a Rev.2 source is silently wrong.
- **Source of truth: ONRC `N_CAEN.CSV` on data.gov.ro, CC BY 4.0.** Cross-check the row count against the INS MO 385 annex (`onrc.ro/documente/caen/Monitorul_Oficial_385_CAEN_Rev.3.pdf`) and **assert the count in a test**. The working numbers — **22 secțiuni / 87 diviziuni / 287 grupe / 651 clase** — are CORROBORATED from the 1:1 NACE Rev.2.1 equivalence and **have never been counted from the primary file. Count them.**
- **Attribution shipped with the data:** INS + Ordinul 377/2024 + MO I 385/2024, plus the CC BY 4.0 mark for the ONRC dataset.
- **A provenance note in the corpus** — dataset id, retrieval date, row counts. Otherwise the next person re-guesses it.

### Part A2 — Settings: the CAEN control. **This is B-124; do not lose it.**
**Today `identity.caen` is `{cod, …}[]` and `Settings.tsx:619` reads `identity.caen?.[0]?.cod`. The model holds a list; the UI shows and edits one entry. A user with a principal and secondary codes cannot enter them.**
1. **One principal + up to four secondary**, each resolved against the nomenclator. **The 5-class total is the law — OUG 44/2008 art. 16 alin. (1) — and the citation goes on the control**, because otherwise "4" reads as an arbitrary product decision.
2. **A type-ahead drawdown as the user types**, rows like **`4791 — Comerț cu amănuntul …`**. **Search on code AND description**; it must work for a partial code (`47`) and for a phrase (`programare`).
3. **A 6th class is refused at the input**, with the OUG 44/2008 reason shown — **not a bare validation error.**
4. **Only a code present in the nomenclator is accepted. Free text is not a CAEN.** This is the mechanical enforcement of rule 2 above.
5. **Do not infer fiscal regime from CAEN.** The control may *suggest* a persona; it must not *set* a tax fact. **HG 656/1997 art. 4 alin. (1)**: *„încadrarea … **nu presupune crearea de drepturi sau obligații**"*. Put that sentence in a comment where someone will find it before they wire CAEN into a calculator.

---

## Part B — Persona selection by detected CAEN
**The user's model:** *„we assign the demo persona based on CAEN's detected, and which fits best."*

**Design:**
- A **CAEN → persona affinity table**, one row per persona, listing the classes that identify that user type. **The table is ours and must say so** — there is no official CAEN→taxpayer-type mapping (`research/51` re-tested the claim and it holds in the narrow form).
- **Best fit = the persona with the most matching classes, principal weighted above secondary.**
- **⚠️ No match must be an honest outcome, not a guess.** If nothing fits, the app offers the plain small PFA and **says it is a default, not a diagnosis.** A wrong persona is worse than no persona: it seeds numbers that look authoritative.
- **A tie is a real state.** A person with both 5520 and 6820 is genuinely an accommodation host *and* a landlord. **Surface the choice; do not resolve it silently.**

---

## Part C — The persona set
**Eight, not five.** Five cannot cover 13 regimes plus four unexercised ladder categories without turning each persona into a grab-bag. **Each is a real person you could meet, and each carries only regimes that person would plausibly have.**

**The CAEN codes below are now VERIFIED against `docs/ai/data/caen_rev3.csv` (651 clase, parsed from the MO 385 text).** Five of my original guesses were wrong, which is exactly what the warning below was for:

| I wrote | Reality in CAEN Rev.3 |
|---|---|
| `6201` | **does not exist.** Rev.3 has `621` → **`6210` Activități de realizare a soft-ului la comandă** |
| `6311` / `6312` | **do not exist.** Rev.3 collapses them to **`6310` Prelucrarea datelor, administrarea paginilor web și activități conexe** |
| `9003` | **does not exist.** The creator class is **`9011` Activități de creație literară și compoziție muzicală** |
| `4110` | **does not exist.** Rev.3 has only **`4100`** |
| `4791` = „Comerț cu amănuntul” | wrong meaning. **`4791` = Intermedieri în comerțul cu amănuntul nespecializat** — the intermediation class, which is also the one ONRC uses for online commerce |

| # | Persona | Principal CAEN | Secondary CAEN ≤4 | What it teaches |
|---|---|---|---|---|
| 1 | **IT freelance** | **6210** Activități de realizare a soft-ului la comandă | 6220, 6290, 6310, 5829 | `income-tax`, `cas`, `cass` lit. b), `expense-deductibility`, **FX with EUR clients**, `vat` registration route + cadence (B-96/B-100), `deadlines` |
| 2 | **Content creator / author** | **9011** Activități de creație literară și compoziție muzicală | 5811, 5920, 6391, 7420 | **`dpi-flat-quota`**, **`contribution-withholding`**, CAS lit. b¹) + CASS lit. c), and **the pension case: art. 154 alin. (1) lit. h¹) → CASS 0 on DPI** |
| 3 | **Rideshare / courier driver** | **4933** Transporturi terestre de pasageri cu vehicule cu șofer, pe bază de comandă | 4932, 5320, 4941, 7711 | **depreciation + the one car**, **art. 298 vehicle VAT status (B-94)**, art. 68 alin. (5) capped expenses, B-93's schedule-vs-hand-recorded reconciliation |
| 4 | **Airbnb host** | **5520** Facilități de cazare pentru vacanțe și perioade de scurtă durată | 5540, 5590, 5510, 6820 | **`short-term-rooms-flat-ratio` (art. 85, 1–7 rooms)**, the occupancy sheet, the tourism-CAEN prompt, and **the art. 67 alin. (1¹) boundary at >7 rooms → art. 68³** |
| 5 | **Long-term landlord** | **6820** Închirierea și subînchirierea bunurilor imobiliare proprii sau închiriate | 6811, 6812, 6831, 5520 | **`cedare-art84-flat-ratio` vs `cedare-art84x1-withheld`** — same 20 %, different gross measure, different FX date, different declaration duty; CASS **lit. e)**; **surfaces B-122** (arendă withholding not modelled) |
| 6 | **Passive investor** | *no PFA — CAEN not applicable* | — | **`investitii` lit. g) — dividends at 16 %**, **dobânzi at 10 %**, **art. 97¹ self-assessed bonds**, **`asociere_persoana_juridica` lit. d)**, `alte_surse` lit. h), **and the salariat case: art. 150 alin. (2)** |
| 7 | **Agricultural producer** | **0125** Cultivarea altor pomi fructiferi, arbuștilor fructiferi, căpșunilor și nuciferelor | 0113, 0161, 1039, 4721 | **`activitati_agricole` lit. f)**, art. 103–106, **normă de venit vs sistem real** (D-NORMA-2 still awaits a user decision — **do not resolve it here**), **art. 118 alin. (6): losses not reportable for normă de venit agricultural income** |
| 8 | **Online commerce** | **4791** Intermedieri în comerțul cu amănuntul nespecializat | 4792, 5210, 5320, 6310 | **cash-basis goods costs** (art. 68 alin. (2) lit. a) / alin. (4) lit. b) — **no stock model, and none is needed**), art. 68 alin. (5) lit. d) perisabilități, **and the real trap: TVA art. 310 alin. (2) measures *livrări efectuate*, so income and VAT diverge by exactly the stock movement** |

**Two things the verified codes give us for free:**
- **Personas 4 and 5 genuinely overlap** — `5520` and `6820` appear in each other's secondary lists. **That is the tie case from Part B, and it is real, not a contrived test.**
- **`4933` („cu vehicule cu șofer, pe bază de comandă") is the ride-hailing class**, not `4932` („ocazionale") as I first wrote. Getting that wrong would have put the demo driver in the wrong activity.
## ⛔ Data density — the personas must run the engine at full power
**Standing user instruction, 2026-10-14: *„make sure the personas have proper data loaded so charts, thresholds, everything is showcased at full power. not a one month 9000 lei income type shit."***

**The anti-pattern is named, so it cannot be mistaken for a demo.** A persona with one month of 9.000 lei exercises nothing: it sits under every threshold, draws a one-point chart, and makes the app look like a calculator for a hobbyist. **A persona is a demonstration that the engine can hold a real business.**

**Hard rules:**
1. **Twelve months minimum per persona**, with real seasonality where the activity has it. **Every chart gets ≥ 12 data points.** A chart with one bar is a bug, not a demo.
2. **Each persona deliberately crosses at least two thresholds.** Not brushes against — crosses, so the ladder rung changes and the UI has to show which one and why.
3. **Realistic annual scale for the activity**, not a rounding of a hobby. Figures below are targets, not ceilings.
4. **Multi-year where the feature is multi-year**: depreciation schedules run across years, VAT periods accumulate, prior-year figures exist for comparison. **But do not seed a prior-year *loss* — B-121's operand is not implemented.**
5. **Money stays integer bani** throughout, per the standing rule.

**Thresholds to actually cross — SMN 2026 = 4.050 lei, so: 6 SMN = 24.300 · 12 SMN = 48.600 · 24 SMN = 97.200 · 72 SMN = 291.600 lei (CASS max 29.160 lei).**

| # | Persona | Annual scale | Thresholds it must **cross**, not approach |
|---|---|---|---|
| 1 | IT freelance | **~340.000 lei** (EUR invoicing, 12 invoices) | **TVA 395.000 lei registration crossed mid-year** — the moment and the cadence change are the point; CAS **12 → 24 SMN** rung; one car at ~60.000 lei with a multi-year depreciation schedule |
| 2 | Content creator | **~150.000 lei** DPI | DPI 40 % quota at real scale; CAS/CASS rungs on the *proration denominator*, which is the whole lesson of art. 118 alin. (2²)/(2³) |
| 3 | Rideshare / courier | **~180.000 lei** | art. 68 alin. (5) **capped** expenses — the cap must actually bite; the **one-car limit**; art. 298 vehicle VAT status; car ~78.000 lei depreciating |
| 4 | Airbnb host | **~260.000 lei**, 7 rooms | **art. 85 at the top of the 1–7 room band**, and the occupancy sheet full; **seasonality across the year**; the >7-room boundary shown as a boundary, not as data |
| 5 | Long-term landlord | **~320.000 lei**, several properties | CASS **lit. e)** well past 6 SMN; **art. 84 and art. 84¹ side by side** so the different gross measure and FX date are visible |
| 6 | Passive investor | **~300.000 lei** dividends + interest | **dividends at 16 %** (B-126), the **CASS ladder rung driven by dividends net of withheld tax**, asociere p.j. lit. d) |
| 7 | Agricultural | **~200.000 lei** | normă de venit vs sistem real at a scale where the two genuinely differ; CASS **lit. f)** |
| 8 | Online commerce | **~650.000 lei** | **TVA 395.000 crossed**, perisabilități under art. 68 alin. (5) lit. d), and **the income-cash vs VAT-delivery divergence shown as a visible gap between two series** |

**Acceptance, added:** for each persona, a test or e2e assertion that **the expected threshold was crossed and the expected rung/period changed**. A persona that loads without changing a rung is not finished.

## Counterparties — a business with no counterparties is not a business
**Standing user instruction, 2026-10-14: *„make sure they have clients that make sense and whanot, clients from abroad where it makes sense, you know, a proper showing, quality demo."***

**Every persona needs named counterparties, not anonymous totals.** A ledger that says "income 340.000 lei" proves the arithmetic; a ledger that says four named clients on monthly invoices proves the *product*.
- **Named clients and suppliers**, invented (B-110 hygiene: no real CNP, no real CUI, no name that resolves), each with a plausible trade name and, where the activity has them, a payment cadence.
- **Foreign counterparties only where the activity genuinely has them.** IT freelance: EU/UK clients, EUR invoicing, BNR rate dates. Online commerce: non-EU suppliers, and the import/VAT consequences that follow. Rideshare: a **platform** as counterparty, which is its own fiscal shape (reţinere, informare). Airbnb: booking platforms as intermediaries. Landlord: mostly individuals, in lei. Investor: the distributing company, the bank, the fund administrator. **Agricultural and the driver should not be padded with foreign clients they would not have.**
- **Counterparty type has to be visible**, because it changes what the engine does: a payroll employer, a Romanian corporate client, a non-EU client, a platform that withholds, a natural-person tenant.

## Who the demo identities are
**Open — user deciding.** Two coherent options, and they are not interchangeable:
- **Named invented people** (e.g. an IT freelance, a driver, an Airbnb host). Warmer, more legible in screenshots, and it forces B-110 hygiene because a name invites a real one.
- **The persona *is* the user.** The demo profile carries the person's own name and the persona only supplies the activity data. Cleaner for a real account, blander for a showcase.
**Whatever is chosen, the CNP/CUI/reg-com values must be invented and visibly fake**, and the demo data must be labelled as demo — B-110 exists because demo data was previously borrowing real identities.

## Lifecycle stage — new PFA vs an existing PFA that just found us
**The distinction you are asking about is real, and the app already holds the field that answers it.**
- **Onboarding already requires „Data începerii activității"** (`Onboarding.tsx`, `pfaStartDate`). **That is the ONRC start date, not the account signup date** — which is exactly why it separates the two cases without asking a second question: someone who registered at ONRC in 2019 and installed the app this week has `pfaStartDate` 2019 and is an **existing** PFA; someone who registered last month is a **new** one.
- **The first-year law is already researched and already partly implemented.** `src/domain/deadlines.ts` states it: *„A PFA opened at any point in 2026 files its first Declarația Unică by 25 May 2027: art. 122 alin. (3) extends the term to the alin. (2) start-of-activity case verbatim"*, and `research/11_pfa_first_year_and_vat_registration_deadlines_2026.md` covers the 30-day declarație de înregistrare fiscală and the art. 82 alin. (6) lit. c) exclusions.
- **What is missing is the derivation and the surface.** `pfaStartDate` is read in exactly one place — `completeness.ts:136`, which only asks whether it is *filled in*. **Nothing computes how long the PFA has been active, and nothing branches the UI on it.** So a person in month two and a person in year seven see the same screen. **Minted as B-127.**

**Deliberate choices, and why:**
- **The pension/salary statuses ride on personas 2 and 6** rather than getting their own persona, because a pensionari *is* a content creator or an investor — inventing a "pensioner persona" would be a status, not a user type.
- **Persona 6 has no CAEN.** That is correct and must stay visible: **a dividend recipient is not a PFA and has no obiect de activitate.** It also proves the CAEN→persona mapping must tolerate "no CAEN".
- **A prior-year reported loss (B-121) is a *variant* of persona 1, not a persona.** The operand is not implemented; **do not seed a loss the engine cannot consume.**
- **Persona 8 exists because the cash-basis finding makes commerce safe.** Before `research/51` I believed it needed a stock model. **It does not.** What it does expose is the **income-cash / VAT-delivery divergence**, which no persona currently shows.

---

## Part D — What the personas must NOT paper over
**These are open defects. A persona that hides one of them turns a known defect into an invisible one.**

1. **B-122 — arendă and asocieri are withholding sources under art. 174¹ alin. (3) and are not modelled.** Persona 5 and persona 6 will land on this. **The demo must show the gap, not route around it.**
2. **B-121 — the engine cannot consume a prior-year reported loss.** `research/52` now specifies the operand exactly: **art. 118 alin. (4), 5 ani fiscali, 70 % cap, chronological, no election, D212 rd.5/rd.6/rd.7, and *„venit net anual recalculat"* is the post-loss figure, so the art. 118 alin. (2⁴) cap moves.** **Do not seed losses until the operand exists.**
3. **Over-withholding is not recoverable for CAS.** `research/52` §Q4: **art. 151 alin. (4) says the paid contribution *„nu se restituie"*, it is credited to pension service instead; art. 174 alin. (12)'s refund route covers only art. 68¹ sports income and art. 174¹ alin. (12) points to art. 174 alin. (14)–(18), deliberately excluding it; and D212 has no CAS minus row at all.** **Our engine currently prints "0 lei payable + a note that recovery is not modelled". That is now known to be too soft — the honest statement is that the money is not returnable.**
4. **Dividends at 16 % have a distribution-date carve-out** — distributions made on **2025 interim statements stay at 10 %** (Legea 141/2025 art. VII alin. (2)). **A persona that just uses 16 % will be wrong for a real FY2026 case.**
5. **Art. 150 alin. (2) at the ceiling test is genuinely unresolved** (`research/52` §Q2). **Persona 6 must show CAS = 0 for a salariat with DPI, and must not assert whether a rung was named.**

---

## Acceptance criteria
1. **Every one of the 13 regimes is reachable through at least one persona**, and **every one of the six `CASS_LADDER_CATEGORIES` is entered by at least one persona.** **State the mapping in the test file, not in prose.**
2. **One e2e spec per persona** walking its own numbers in a browser. **B-123 is only closed when persona 2's DPI path runs end to end.**
3. **The CAEN control edits all five classes** and the type-ahead resolves both `4791` and a text search. **A test asserts the nomenclator's class count.**
4. **Persona selection by CAEN has a tested no-match path and a tested tie path.**
5. **`tsc` 0 · unit tests · `build` 0 · e2e green.**

## Guardrails
- **⚠️ The pinned seed estimate breaks by design.** `PHASE_PLAN` sequencing trap 1: *„personas **move the pinned seed estimate** — 311.200 bani has been held unmoved through PG-6b … 6g, and the persona set will break that pin by design."* **Re-pin it deliberately, in the same commit, and say so.** Do not re-pin it quietly.
- **Chain steps: STOP and ask.** Personas may need persisted fields (persona id, CAEN list, salary/pension facts). **The head stays v21 until approved.**
- **Demo identities must be invented.** **B-110 exists precisely because demo data was borrowing real people's identities.** No real CNP, no real company CUI, no real name that resolves.
- **Do not seed `vatReturns`** — 6g left that instruction explicitly. Each persona needs `registrationEffectiveFrom`, `registrationRoute` and the figure for its branch; **a declared VAT *status* does not establish a *cadence*** (B-96).
- **Do not resolve D-NORMA-2.** Persona 7 may *show* the normă de venit question; it must not answer it.

## Sequencing
**Do Part A (the nomenclator + control) before Part C (the personas).** Personas are defined by CAEN, and persona selection is by CAEN — **building personas against a single-field CAEN control means building them twice.**
