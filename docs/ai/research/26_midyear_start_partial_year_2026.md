# L-1 — A PFA that starts partway through the fiscal year (FY2026)

**Researcher:** `scout-L1-midyear-start`, 2026-10-10. Transcribed by the Orchestrator — the `researcher` profile has no write tool (Q-RESEARCHER-WRITE), so this file is the record of record.
**Question:** what does "annual income" mean for a PFA that began operating in, say, October 2026, and are the CAS/CASS thresholds prorated to the active period?
**Why it mattered:** the app divides year-to-date totals by months elapsed since 1 January and multiplies by 12, then feeds that figure to the tax engine and to the contribution thresholds. PG-4 was waiting on this answer.

**Headline: the ×12 annualisation has no basis in any provision found, and the thresholds are not prorated either.** Partial-year income *is* the annual income. Both halves of the answer point the same way, and they invalidate the assumption behind the projection model, not just the mid-year case.

---

## 1. Which text governs FY2026 — FACT

The Cod fiscal is **Legea nr. 227/2015**, MO 688/10.09.2015, in force 01.01.2016, continuously amended. There is no new code. **Legea nr. 239/2025** (MO 1160/15.12.2025, Portal Legislativ id **305208**) is an amendment act; its art. XII amends Legea 227/2015, **art. XIII alin. (1) lit. a)** brings the relevant points into force **1 ianuarie 2026**, and **art. XIII alin. (2) lit. b)** applies them „începând cu veniturile aferente anului 2026".

Consolidation ids for the code: **305350** (01.01.2026), **306993** (25.02.2026), **312600** (08.08.2026), **269534** (15.12.2023).
Verbatim quotes below were read from **ANAF's official consolidated edition**, `Codul fiscal cu Normele de aplicare`, ultima actualizare **LEGEA nr. 170/2026**, norms HG 602/2025 — `static.anaf.ro/static/10/Anaf/legislatie/Cod_fiscal_norme_2023.htm`. ANAF itself states the text is updated by computer and is not a republicare.

---

## 2. Art. 118 alin. (3) — partial-year income IS the annual income — FACT

> **"(3) Veniturile din categoriile prevăzute la art. 61 lit. a), a1), c) și f), ce se realizează într-o fracțiune de an sau în perioade diferite ce reprezintă fracțiuni ale aceluiași an, se consideră venit anual."**

**What it does not say:** it does not prorate, gross up, annualise, multiply by 12, or divide by months elapsed. It does the opposite — it *deems* the fraction-of-year receipts to **be** the annual figure. It is a deeming rule about the quantum, not a relief and not a threshold rule.

**Numbering trap, confirmed:** this was **alin. (2)** before 2024 and omitted *a1)*. Citing alin. (2) today is wrong; **alin. (3)** is correct for FY2026. (Old numbering visible in Portal Legislativ printable snapshot `00000G258HTTJCJCEIC0AJA5W8IY5HYH`.)

**Scope (INTERPRETATION):** art. 118 sits in Titlul IV, but it fixes the quantity Titlul V then uses — art. 148 alin. (3) and art. 170 alin. (1) both speak of net income *realised in the year*.

---

## 3. CAS — the thresholds are full-year, not prorated — FACT

**Art. 148 alin. (1)** — CAS is owed where the cumulative annual value of the income is „cel puțin egală cu 12 salarii minime brute pe țară".
**Art. 148 alin. (2)** — base is the income chosen by the taxpayer, not lower than **a)** 12 SM where income falls between 12 and 24 SM, **b)** 24 SM where income is at least 24 SM.
**Art. 148 alin. (3)** — the classification is done by cumulating net income and annual norms „**realizate în anul pentru care se datorează contribuția**".

**Art. 151 alin. (2)** is the provision that settles the mid-year question:

> "**Prevederile alin. (1), precum și cele ale art. 148 sunt aplicabile și în cazul contribuabililor care în cursul anului fiscal încep o activitate independentă** … și/sau încep să realizeze venituri din drepturi de proprietate intelectuală, precum și în cazul celor care intră în suspendare temporară a activității … ori își încetează activitatea."

**Art. 151 alin. (3)** is the one surviving proration, and it applies **only** to people who *become exempt* during the year (art. 150) — not to starters. Keeping these two apart matters: they are different rules with different triggers.

---

## 4. CASS — no ladder for PFA income; 72-SM ceiling; 6-SM floor is art. 174 alin. (6) — FACT

**Art. 170 alin. (1)** — for art. 155 alin. (1) **lit. b)** income (a PFA), the base is the cumulative **actual** net annual income, „care nu poate fi mai mare decât cea corespunzătoare … **72 de salarii minime brute pe țară**". Fiscal losses are not deducted from this base.
**Art. 170 alin. (2)-(3)** — the 6/12/24-SM tiers apply to **lit. c)–h)**, **not** to PFA income.
**Art. 174 alin. (2)** — a loss year or net income of zero means **no CASS at all**; optional cover under art. 180 alin. (1).
**Art. 174 alin. (6)** — where the base is below 6 SM, the person owes „o diferență de contribuție … până la nivelul celei corespunzătoare bazei de calcul egale cu 6 salarii minime brute pe țară".
**Art. 174 alin. (7)** lit. a)/b)/c) — the exceptions to that difference.

The 60 → 72 SM change for 2026 is confirmed by ANAF's own before/after table (ANAF Brașov, *Modificări aduse Legii 227/2015 de Legea 239/2025*, Titlul V pct. 18–20), and corroborated by ANAF Ploiești: „valoarea maximă a bazei anuale de calcul pentru CASS începând cu 01.01.2026 este de 72 de salarii minime brute pe țară". **The repo already models 72 SM and already sources the 6-SM floor to art. 174 alin. (6) — both correct.**

---

## 5. The load-bearing claim: proration was removed from 1 January 2024 — FACT, primary

**The text that prorated** (art. 151 alin. (10) as in force 2018–2023, quoted by ANAF's own official taxpayer material, ANAF Iași 2021 and 2022): the 12-SM threshold „**recalculat corespunzător numărul de luni rămase până la sfârșitul anului fiscal**", with a 30-day filing duty from the event.

**The clause that deleted it** — **OUG nr. 115/2023, art. I pct. 101** (MO 1139/15.12.2023, Portal Legislativ id **277404**), in force 1 January 2024, verbatim: the new alin. (10) keeps the 12-SM test and the 30-day filing duty but **the words „recalculat corespunzător numărul de luni rămase până la sfârșitul anului fiscal" are gone**.

So the secondary-source claim is **substantively right**: from 2024 the 12-SM threshold is not prorated for a starter. **Nuance:** it was a *modification* of alin. (10), not a formal abrogare of an alineat.

**⚠ The reason the belief survives — and the limit on what we may assert.** ANAF's *current* annotated edition still reproduces the **Norme metodologice** with prorating language and worked examples:

> „(4) Persoanele fizice care încep să desfășoare o activitate independentă … verifică încadrarea în plafonul anual prevăzut la art. 148 alin. (2), corespunzător numărului de luni de activitate. **Plafonul luat în calcul se stabilește proporțional cu numărul lunilor de activitate rămase până la sfârșitul anului.**"

and the parallel CASS norm, with examples such as „22.800 lei : 12 luni × 5 luni de activitate = 9.500 lei". These norms cite alineate that no longer exist in that form and still use 2018 deadlines, so they are **stale, pre-2024 norms not conformed to the code** (INTERPRETATION; the code prevails over the norms). **UNKNOWN:** whether HG 602/2025 formally repealed them. **Until that is checked, the app may say the *code* contains no proration for starters; it may not say "prorating was abolished" full stop.**

---

## 6. The base is cash, with no annualisation — FACT

**Art. 68 alin. (2) lit. a)** — brut income is „**sumele încasate**" plus the lei value of income in kind.
**Art. 68 alin. (4) lit. b)** — an expense is deductible where it is „cuprins în cheltuielile exercițiului financiar **al anului în cursul căruia au fost plătite**".

No provision annualises either side. The only proportionality rules found: art. 122 alin. (2) last sentence prorates the **normă de venit** only („ajustează norma anuală de venit prin reducerea acesteia proporțional cu perioada în care nu au desfășurat activitate") — irrelevant to sistem real; art. 151 alin. (3) for newly exempt persons; and art. 118 alin. (3), which works *against* annualisation.

---

## 7. What is filed and paid for an October-2026 start — FACT, one UNKNOWN

**Art. 122 alin. (1)** — a D212 for each fiscal year where independent-activity income is realised.
**Art. 122 alin. (2)** — a D212 is also filed where the taxpayer „**încep sau încetează o activitate**" during the fiscal year.
**Art. 122 alin. (3)** — due „până la data de **25 mai** inclusiv a anului următor celui de realizare a veniturilor. **Prevederea se aplică și în situațiile prevăzute la alin. (2)**."
**Art. 151 alin. (1)** — CAS declared and **paid in the same term**; alin. (13) allows voluntary payments any time before it. **Art. 174 alin. (3)** and **alin. (6)** route CASS and the 6-SM difference to the same art. 122 alin. (3) term.

**FACT:** the start-of-activity event triggers a D212, but on the current text the deadline is the same **25 May 2027**. The old 30-day rule is not in the current code, and art. 120 (the old venit-estimatum declaration) is marked **ABROGAT**.
**UNKNOWN:** whether the current ANAF D212 form instructions still tell starters to file within 30 days — the 2026 form PDFs were not read. So a "start of activity triggers a filing within N days" screen stays **REVIEW_REQUIRED**, with 25 May 2027 shown as the established statutory date and the 30-day question flagged open.

---

## 8. Worked consequence — the app's own example

PFA authorised October 2026, net income (încasări − cheltuieli plătite) Oct–Dec 2026 = **10.000 lei**:

| Line | Correct treatment | Basis |
|---|---|---|
| Venit net anual FY2026 | **10.000 lei** — not 40.000 | art. 68 alin. (1),(2)(a),(4)(b) + art. 118 alin. (3) |
| CAS | **None due** — 10.000 < 12 SM; the 12-SM test is **not** cut to 3 months. The taxpayer may opt in | art. 148 alin. (1), alin. (4); art. 151 alin. (2) |
| CASS | Base 10.000 lei, but below 6 SM → **art. 174 alin. (6) imposes the 6-SM base** unless alin. (7) exempts. Not prorated to 3 months | art. 170 alin. (1); art. 174 alin. (6),(7) |
| Impozit | 10 % × venitul net anual impozabil, CAS/CASS deductible per art. 118 alin. (2) | art. 118 |
| Filing | One D212 for FY2026, due **25 May 2027**, covering income tax, CAS and CASS | art. 122 alin. (2)-(3) |

---

## 9. What this changes for the app

> **Status 2026-10-11 (PG-5C, `docs/ai/phases/34_pg5c_actuals_basis.md`):** items 1–4 are implemented.
> The annualisation is out of every fiscal figure — the engine's operand type carries the date it was
> measured as of and the forecast's deliberately does not, so a projection cannot be assigned to an
> engine operand or a threshold base at all. The SM multiples are not prorated and a test pins all four
> against a three-month taxpayer. The wording cites art. 118 alin. (3) and is scoped to what this app
> measured; nothing in the UI claims the Norme metodologice no longer contain proration. Item 5 is
> untouched — it belongs to the start-of-activity screen, not to this phase. The measured October
> before/after: VNA 30.000,00 → 10.000,00 lei and total 5.700,00 → 3.330,00 lei at 31.10.2026; and in
> the case §9 warned about, CAS went from **12.150,00 lei owed to 0,00 lei not owed**.

1. **The ×12 annualisation must go from anything presented as a fiscal figure.** No provision supports grossing up, and art. 118 alin. (3) deems partial-year income to *be* the annual income. A run-rate may exist as a **forecast for planning**, clearly labelled, but it is not the legal base and must not be what the engine and the thresholds are measured on.
2. **Do not prorate the 12-SM, 24-SM, 6-SM or 72-SM figures** for a mid-year starter. Cite art. 151 alin. (2) for the starter case and keep art. 151 alin. (3) — the newly-exempt case — visibly separate.
3. **Cite art. 118 alin. (3), not alin. (2).** The pre-2024 numbering is a live trap.
4. **Scope the "proration was removed" claim to the code.** The Norme metodologice still contain it; their status after HG 602/2025 is unverified.
5. **Do not present a 30-day filing deadline as current law**, and keep the start-of-activity screen REVIEW_REQUIRED until the D212 instructions and the non-CF registration duties are checked.

---

## 10. Gaps handed to the next pass

1. **Legea 170/2026** — ANAF's edition is updated through it; what it changed in Titlul IV/V is unidentified. Diff art. 148/151/170/174 between consolidations 305350 (01.01.2026) and 312600 (08.08.2026).
2. **Who deleted the 30-day filing rule** from art. 151 alin. (10) — candidates OUG 156/2024, OUG 128/2024, Legea 141/2025, Legea 239/2025 art. XII.
3. **Highest priority: the status of the prorating Norme metodologice after HG 602/2025.** This is the live source of the prorating practice in the field.
4. Pre-2024 verbatim art. 151 alin. (10) from a primary source — Portal Legislativ printable forms return an empty shell; the working route is ANAF's archived edition `Cod_fiscal_norme_12062019.htm` (already fetched, ~4.6 MB), search `numărului de luni rămase`.
5. ~~Salariul minim brut 2026~~ — **already closed by our own register**, see below.
6. Dating of art. 174 alin. (6) — which act introduced the 6-SM CASS floor for a PFA.
7. Current D212 form instructions (2026/2027) on the 30-day question.
8. Non-CF start-up duties (ONRC, fiscal registration, evidență contabilă, e-Factura) — partly covered elsewhere in the register; Q-ONRC-CARVEOUT is closed and says **do not build a `fiscal_registration` deadline**.

---

## 11. Orchestrator notes on the researcher's own gaps

**Gap 5 is not open.** The researcher flagged SM 2026 as unverified. Our register closed it twice: **Q-SM-VALUES (U-6)** and the CORECTIE entry under it — SM on 1 January 2026 = **4.050 lei** (HG 1.506/2024), from **1 iulie 2026** = **4.325 lei** (HG 146/2026), and **CF art. 135¹ alin. (3)** fixes the governing value as the one in force on **1 January of the year the income is realised**, „indiferent dacă în cursul aceluiași an se utilizează mai multe valori". So 6 SM = 24.300, 12 SM = 48.600, 24 SM = 97.200, 72 SM = 291.600 lei are all derivable for FY2026. This is the recorded lesson: **check the register before a Researcher's UNVERIFIED label becomes a new open question.**

**The researcher corrected my framing in one place and it is right:** I asked about "the 6-SM CASS floor" as if it sat in art. 170. It is **art. 174 alin. (6)** — which the repo already has right since Phase 4.

**The finding that outruns the question:** L-1 was asked about mid-year starters and answered something that applies to every profile — the annual figure the engine is fed is a projection, and the law measures what was actually realised. That is recorded as **B-54** in `PHASE_PLAN_11_34.md`, and it puts TASK 1's decision (feed the engine the projected annual figures) back on the table as a question of labelling and of what the hero is allowed to claim, not of whether the arithmetic was careful.
