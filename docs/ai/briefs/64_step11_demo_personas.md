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

**⚠️ The CAEN columns below are UNVERIFIED placeholders from my memory — the questions this step must answer against the shipped nomenclator, not its inputs. The user types are the design. The codes are to be looked up.**

| # | Persona | Principal CAEN *(unverified)* | Secondary CAEN ≤4 *(unverified)* | What it teaches |
|---|---|---|---|---|
| 1 | **IT freelance** | **6201** | 6202, 6311, 7311, 8559 | `income-tax`, `cas`, `cass` lit. b), `expense-deductibility`, **FX with EUR clients**, `vat` registration route + cadence (B-96/B-100), `deadlines` |
| 2 | **Content creator / author** | **9003** | 5811, 5911, 6312, 7420 | **`dpi-flat-quota`**, **`contribution-withholding`**, CAS lit. b¹) + CASS lit. c), and **the pension case: art. 154 alin. (1) lit. h¹) → CASS 0 on DPI** |
| 3 | **Rideshare / courier driver** | **4932** | 5320, 4939, 7711 | **depreciation + the one car**, **art. 298 vehicle VAT status (B-94)**, art. 68 alin. (5) capped expenses, B-93's schedule-vs-hand-recorded reconciliation |
| 4 | **Airbnb host** | **5520** | 5590, 5621, 6820 | **`short-term-rooms-flat-ratio` (art. 85, 1–7 rooms)**, the occupancy sheet, the tourism-CAEN prompt, and **the art. 67 alin. (1¹) boundary at >7 rooms → art. 68³** |
| 5 | **Long-term landlord** | **6820** | 4110, 6831, 5520 | **`cedare-art84-flat-ratio` vs `cedare-art84x1-withheld`** — same 20 %, different gross measure, different FX date, different declaration duty; CASS **lit. e)**; **surfaces B-122** (arendă withholding not modelled) |
| 6 | **Passive investor** | *no PFA — CAEN not applicable* | — | **`investitii` lit. g) — dividends at 16 %**, **dobânzi at 10 %**, **art. 97¹ self-assessed bonds**, **`asociere_persoana_juridica` lit. d)**, `alte_surse` lit. h), **and the salariat case: art. 150 alin. (2)** |
| 7 | **Agricultural producer** | **0125** | 0130, 0322, 1039, 4721 | **`activitati_agricole` lit. f)**, art. 103–106, **normă de venit vs sistem real** (D-NORMA-2 still awaits a user decision — **do not resolve it here**), **art. 118 alin. (6): losses not reportable for normă de venit agricultural income** |
| 8 | **Online commerce / dropshipper** | **4791** | 4799, 5210, 6311, 8299 | **cash-basis goods costs** (art. 68 alin. (2) lit. a) / alin. (4) lit. b) — **no stock model, and none is needed**), art. 68 alin. (5) lit. d) perisabilități, **and the real trap: TVA art. 310 alin. (2) measures *livrări efectuate*, so income and VAT diverge by exactly the stock movement** |

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
