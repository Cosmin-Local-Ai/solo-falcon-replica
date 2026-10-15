# R-GOLDEN — Published worked examples for FY2026 Romanian personal taxation, and what they pin

**Researched by** `researcher-golden-examples` on 2026-10-13, web only. **Written to file by the orchestrator** — the Researcher has no filesystem access (§12.16, §12.14). **Feeds phase 31, golden fiscal fixtures — queue step 10.**

**Why this pass existed.** Not to restate the law — we have 54 verified, cited rules. The problem is:

> **2,274 tests pass, and not one is pinned against an expected result derived from outside this codebase.** The only externally-stated number in the whole suite is the seed estimate, and **the codebase produced that number itself.** A suite that asserts the code agrees with the code cannot catch a rule that is wrong.

**Headline.** Published worked examples exist for **five of seven regimes**, two of them from ANAF itself. **But no official ANAF or Ministerul Finanțelor worked example for income year 2026 exists anywhere** — every official worked example is FY2024 or FY2025. **FY2026 official material gives formulas and threshold tables and computes nothing.**

---

## 1. The finding that matters most — and our engine already gets it right

**⚠️ The 6 / 12 / 24 minimum-wage ladder is NOT the PFA rule.** Art. 170 Cod fiscal FY2026:

- **alin. (1)** — venituri from art. 155 alin. (1) **lit. b)** = **activități independente**: base = the actual net income, capped at **72 SMN**. A 6-SMN floor applies via art. 174, with exceptions.
- **alin. (2)–(3)** — venituri from **lit. c)–h)** (DPI, asocieri, **cedarea folosinței bunurilor**, agricultură, investiții, alte surse): due if cumulated ≥ 6 SMN; base = **6 SMN** (6–12), **12 SMN** (12–24), **24 SMN** (≥24).

**ANAF's own worked examples confirm the split** — Exemplul 1 (net 26.640 → CASS **2.664** = 10 % of net, *not* 2.430); Exemplul 2 (net 22.000 → CASS **2.200**); Exemplul 3 (AI net 68.000 → CASS **6.800**, *while separately* DPI + dividende 98.000 → base 97.200 → CASS **9.720** on the ladder). **GRADE: FACT (statute) + FACT (official examples).**

**Verified against our tree before treating this as a defect: we already get it right, and did before this was raised.** `estimateBasis.ts` records that art. 68^3 is lit. b) and is measured under art. 170 alin. (1) capped at 72 SM, while art. 85 is lit. e) and feeds the cumul at art. 170 alin. (4) lit. c) where the base is the rung — and that **the engine is not entitled to decide which article applies**, because `selectIncomeDeterminationMethod` decided it once from declared facts.

**This is the single highest-value fixture available, and none of the 2,274 tests pins it.**

## 2. PFA în sistem real — art. 123 alin. (1)

**2A. ANAF DGFP București — „Noutăți privind DU 2026 – exemple", Exemplul 2** — *official, income year 2025, SMN 4.050 lei* — **FACT**
[static.anaf.ro/static/10/Bucuresti/Noutati_privind_DU_2026_exemple.pdf](https://static.anaf.ro/static/10/Bucuresti/Noutati_privind_DU_2026_exemple.pdf)

PFA în sistem real, **also a salariat**. Verbatim: „Venitul brut = 30.000 lei / Cheltuieli deductibile = 8.000 lei / Venitul net = 22.000 lei"; CAS not due (net below 12 SMN = 48.600); „**CASS datorată = 22.000 X 10% = 2.200 lei**"; venit impozabil 22.000 − 2.200 = **19.800**; „**Impozitul = 19.800 x 10% = 1.980 lei**"; with the 3 % bonificație, **1.921 lei**.

**Critical for a fixture:** net 22.000 is *below* the 6-SMN floor of 24.300, yet CASS is **2.200, not 2.430** — the floor is disapplied by the salariat exception. **A fixture pinning 2.430 fails against ANAF's own arithmetic.** *Missing inputs:* whether the salary reached 6 SMN (the statutory trigger), and pension status.

**2B. ANAF — same deck, Exemplul 3** (loss carryforward + apportioned CAS deductibil) — *official, FY2025* — **FACT**
AI net 68.000 (brut 100.000, cheltuieli 32.000); DPI net 50.000; dividende 48.000; pierdere fiscală 20.000; CASS reținut DPI 4.860; CAS reținut 12.150.
AI+DPI 118.000 → bază CAS 97.200 (24 SMN) → CAS 24.300 → diferență **12.150**. CASS categoria A (AI) 68.000 × 10 % = **6.800**. Categoria B (98.000) → bază 97.200 → **9.720**; diferență **4.860**. Venit net recalculat 48.000; pondere 57,6 %; CAS deductibil **13.997**; venit impozabil **27.203**; impozit **2.720**; with bonificație **2.638**. **The best official fixture for the loss-carryforward + apportioned-CAS path.**

**2C. ContApp — FY2026 PFA sistem real, full year** — *practitioner, FY2026, SMN 4.050* — **FACT (single source)**
[contapp.ro/blog/studiu-de-caz-sistem-real/](https://contapp.ro/blog/studiu-de-caz-sistem-real/) — the only complete FY2026 worked year found anywhere. PFA „Popescu V. Ioan", CAEN 6210, neplătitor TVA, no employees, HQ in the holder's flat, car held personally under **contract de comodat**.
facturat 133.200 − 16.800 (invoiced 2026, collected Jan 2027) + 6.000 (invoiced 2025, collected 2026) = **venit brut 122.400**; fully deductible **23.881,50**; comodat car 13.180 → **5.850** (RCA **0**; **no depreciation** — the car never entered the activity's patrimony); euro-capped 7.200 → **5.035** (sală de sport 1.740 → **515**, the 100 € cap); fixed-asset threshold **5.000 lei** (raised from 2.500 by OUG 8/2026), laptop 9.600 → 9.600 ÷ 36 × 9 = **2.400**; protocol baza 85.233,50, 2 % = **1.704,67**; **total cheltuieli 38.871,17 → net 83.528,83**; CAS 48.600 × 25 % = **12.150**; CASS **8.353**; net impozabil **63.026**; impozit **6.303**; total **26.806**.

**⚠️ The source declares these figures provisional** — euro caps converted at an *estimated* 5,15 lei/EUR, and the BNR 2026 average is only published in January 2027. **Do not pin them without that note.**

## 3. Cedarea folosinței, art. 84 — 20 % flat expense, 10 % of net

**3A. ANAF — same deck, Exemplul 4** — *official, FY2025* — **FACT.** „Venitul brut = 24.000 lei / Cheltuieli deductibile = 24.000 x 20% = 4.800 lei / Venit net anual = 19.200 lei / **Impozit anual datorat = 19.200 x 10% = 1.920 lei**" → with bonificație **1.862 lei**.

**3B. ANAF DGFP București / Admin. Sector 4 — „Declarația unică … cedarea folosinței bunurilor", item 18** — *official, income year **2024**, SMN 3.300* — **FACT**
[static.anaf.ro/static/10/Bucuresti/Dec_Unica_PF_Cedare_Fol.pdf](https://static.anaf.ro/static/10/Bucuresti/Dec_Unica_PF_Cedare_Fol.pdf)
Rent 500 EUR/month; contract 01.07.2024–30.06.2025; EUR rate 1 July 2024 = 4,977. „500 euro x 4977 lei = **2488 lei lunar**"; brut 2.488 × 6 = **14.928**; forfetar **2.986**; net **11.942**; **impozit 1.194 lei**; „nu datorează CASS, întrucât venitul net anual este sub plafonul minim de 6 salarii minime … **Salariul minim brut pe țară pentru anul 2024 a fost în sumă de 3300 lei/lună**." Definitive at BNR annual average 4,974: 2.487 × 6 = **14.922**; forfetar **2.984**; net **11.938**; impozit **1.193 lei**.
**⚠️ FY2024 — thresholds predate 2026.** Usable only as a FY2024 fixture. **⚠️ CORRECTED 2026-10-15 — see `research/53_anaf_sector4_rounding_inconsistency.md`. This document contains TWO chains (payment-date 4,977 and BNR annual average 4,974) and across them it applies art. 66 at two steps and a floor at a third. It is NOT a rounding convention the engine can match with one rule. What it does establish: ANAF publishes a whole-leu conversion product (2.488, not 2.488,50) and multiplies THAT by 6.**

**3C. FY2026 practitioner, corroborated across ≥3 independent 2026-dated sources** — **CORROBORATED.** 2.500 lei/lună × 12 = 30.000 brut → forfetar **6.000** → net **24.000** → impozit **2.400 lei**; CASS **0** because net 24.000 < 24.300. [renzi.ro](https://renzi.ro/blog/cheltuieli-forfetare-chirii-deducere-exemplu-2026/), [completam.ro](https://completam.ro/ghiduri/rental-income), [declaratie-unica.ro](https://declaratie-unica.ro/ghiduri/chirii).

## 4. Cedarea folosinței, art. 84¹ — rent paid by a persoană juridică

**4A. ANAF — same deck, Exemplul 4 (PJ limb)** — *official, FY2025* — **FACT, but INTERNALLY INCONSISTENT.** The input is stated as „30.000 lei venit aferent unui contract de închiriere în care chiriașul este o persoană juridică … impozitul fiind reținut la sursă … Art. 84^1", then the arithmetic uses **32.000**: „determinat ca diferență între Venitul brut și cheltuielile deductibile = **32.000 – 32.000 x 20% = 25.600 lei**." **Report the inconsistency: stated 30.000, computed 32.000 — an error inside an official ANAF document.** **The withheld tax itself is never computed**, so this example cannot pin the art. 84¹ withholding amount. It *is* usable for the CASS cumulation: „Venit din cedarea folosinței bunurilor = **44.800 lei**" (= 19.200 + 25.600) → between 6 and 12 SMN → bază **24.300** → **CASS 2.430 lei**.

**4B. firmaromania.com — „Chirie de la persoană fizică la firmă: impozit 2026"** — *practitioner, FY2026* — **FACT.** The best FY2026 art. 84¹ fixture found: Andrei, asociat unic SRL; SRL rents his flat; 3.000 lei/lună. Monthly brut 3.000 → forfetar **600** → net **2.400** → **impozit 240 reținut de SRL** → suma virată 2.760. Annual 36.000 → **2.880 lei**. CASS by the owner: net 12 × 2.400 = **28.800**; „salariul minim luat în calcul este cel de la 1 ianuarie 2026, adică 4.050 lei, deci pragul este 24.300 lei, **chiar dacă salariul minim a crescut la 4.325 lei din iulie**" → **CASS 2.430 lei**, DU până la 25 mai 2027. [firmaromania.com](https://firmaromania.com/ro/blog/chirie-persoana-fizica-catre-firma/)

**4C. renzi.ro (2026)** — 2.000 → 400 → 1.600 → **160** → 1.840 net to owner. **FACT** (corroborates 4B's method).

**4D. contabilul.manager.ro — pre-2026** — **FACT (stale).** The utilities boundary case: BNR rate day before payment 4,9686. (a) rent 750 EUR **+ 950 lei utilities paid to owner**: brut **4.676** → forfetar **935** → net **3.741** → impozit **374 lei**. (b) utilities paid by tenant to suppliers: brut **3.726** → forfetar **745** → net **2.981** → impozit **298 lei**. **Matches our art. 84 alin. (1) gross-up rule.**

## 5. Închiriere pe termen scurt, art. 85 (1–7 camere)

**Statute verified FY2026** (Legea 239/2025, MO 1160/15.12.2025): art. 83 alin. (2) 1–7 rooms = cedarea folosinței; alin. (4) **>7 rooms → art. 68³**; art. 85 alin. (2) net = brut − **30 %**, brut = sums **actually collected**; alin. (3) **platform commission excluded from brut**; alin. (4) FX = BNR rate on the last banking day before collection; alin. (6) tax = 10 % of net, **final**.

**5A. ANAF DGRFP Ploiești, 03.03.2026** — *official, FY2026* — **FACT (rules only, NO worked example)**
[static.anaf.ro/static/10/Ploiesti/inchiriere_7_camere.pdf](https://static.anaf.ro/static/10/Ploiesti/inchiriere_7_camere.pdf) — „VNA = VB − 30% × VB"; „Impozit anual = 10% × VNA"; „Nu se datorează CAS"; ladder table **6 × 4.050 = 24.300 → CASS 2.430 · 12 × 4.050 = 48.600 → 4.860 · 24 × 4.050 = 97.200 → 9.720**. And the decisive SMN sentence, verbatim: **„Salariul minim brut este stabilit prin hotărâre a Guvernului, în vigoare la data de 1 ianuarie a anului de realizare a venitului pentru care se stabilesc contribuțiile sociale, indiferent dacă în cursul aceluiași an se utilizează mai multe valori ale salariului minim brut pe țară."** **Verified by direct extraction: no worked numeric example.**

**5B. FY2026 practitioner, three independent 2026-dated sources agree** — **CORROBORATED.** capital.ro: „Un proprietar obține în 2026 încasări de 50.000 de lei, **după eliminarea comisionului reținut de platformă**": forfetar 15.000 → net 35.000 → impozit **3.500**. Plus three ladder cases:

| Încasări 2026 | Forfetar 30 % | Venit net | Impozit 10 % | CASS | Total |
|---|---|---|---|---|---|
| 30.000 | 9.000 | 21.000 | 2.100 | **0** | 2.100 |
| 60.000 | 18.000 | 42.000 | 4.200 | **2.430** | 6.630 |
| 150.000 | 45.000 | 105.000 | 10.500 | **9.720** | 20.220 |

**The 150.000 case crosses the 24-SMN step; the 30.000 case sits below the 6-SMN step** — exactly the „concrete income on each side of a threshold" required. The 60.000 case is independently reproduced at declararatie-unica.ro (updated 11 Apr 2026).

**⚠️ Hazard found:** declararatie-unica.ro's FAQ still says „maxim **5** camere" — the **pre-2026** rule — while the same page elsewhere uses the FY2026 seven-room rule. **Internally inconsistent, 2026-dated.**

## 6. CASS thresholds and which SMN applies

**6A. ANAF DGRFP Brașov, Jan 2026** — *official, FY2026* — **FACT.** „…în vigoare la data de 1 ianuarie a anului 2026 (**4.050 lei**), pentru veniturile prevăzute la art. 155 alin. (1) lit. c) – h) … baza anuală de calcul a CASS în anul 2026 este: a) **24.300 lei** b) **48.600 lei** c) **97.200 lei**" — cited by ANAF as **art. 170 alin. (2)-(4)**, matching our held citation. Same document: CAS base FY2026 **48.600** (12 SMN) and **97.200** (24 SMN); „baza maximă … **291.600 lei (72 x 4.050 lei)**", art. 170 alin. (1). [static.anaf.ro/static/10/Brasov/Brasov/web_ian_2026.pdf](https://static.anaf.ro/static/10/Brasov/Brasov/web_ian_2026.pdf)

**6B. SMN 2026 has two values — primary source** — **FACT.** **HG nr. 146/2026, MO nr. 196 din 13 martie 2026: „Începând cu data de 1 iulie 2026 … 4.325 lei lunar"**; HG 1.506/2024 (4.050 lei) abrogated at that date. **FY2026 = 4.050 (1 Jan–30 Jun) and 4.325 (1 Jul–31 Dec).** [mmuncii.gov.ro](https://mmuncii.gov.ro/wp-content/uploads/2025/12/HG_Salariul_minim_2026.pdf)

**6C. ⚠️ Direct conflict on which SMN drives FY2026 thresholds — UNRESOLVED in primary law.**
- **ANAF (Ploiești, verbatim in 5A; corroborated by Brașov): 1 January of the income year → 4.050 lei.** Also completam.ro („majorarea din iulie 2026 nu le mișcă"), firmaromania.com, capital.ro.
- **Contradicted by** fiscalitatelazi.ro: „Salariul minim folosit: **4.325 lei** (din 1 iulie 2026)" → thresholds 25.950 / 51.900 / 103.800.
- estimez.ro is **internally inconsistent** — states 4.325 for „semestrul I" (wrong, H1 is 4.050) and mixes 51.900/25.950 with 48.600/24.300.
**Recommendation: pin 4.050 lei for FY2026 (ANAF-stated) and record the 4.325 reading as a documented dissent, not a rule.**

## 7. VAT — the 50 % vehicle limit, art. 298 alin. (1)

**Statute verified verbatim; our citation art. 298 alin. (1) is correct.**

**7A. contabilitatedigitala.ro — monografie, 2026, TVA 21 %** — **FACT.** LEUL FORTE SRL, VAT payer, mixed use, 5 years / 60 months. Preț 100.000,00; TVA 21.000,00; total 121.000,00. „TVA facturată **21.000** / TVA deductibilă **10.500** / TVA nedeductibilă **10.500**"; valoare de intrare 100.000 + 10.500 = **110.500**; **110.500 / 60 = 1.841,67 lei/lună**. Neplătitor de TVA: intrare **121.000** → **2.016,67/lună**.

**7B. firmaromania.com (2026)** — **CORROBORATED**, identical arithmetic: 21.000 → 10.500/10.500 → 110.500 → 1.841,67 → **341,67/lună nedeductibil, „circa 4.100 lei pe an"**.

**7C. expertcontabiltim.ro (2026)** — running costs: fuel bon 605 lei (500 net + **105 TVA**) → „la regim mixt recuperezi **52,50 lei**. Restul de 52,50 lei de TVA nedeductibil se adaugă la cheltuială." **FACT.**

**7D. ⚠️ Stale-threshold false friend — fiscalx.ro.** Headed „2026" and its example is labelled „**Exemplul 1: Achiziția unui vehicul în regim mixt (2026)**", but computes with **TVA 19 %**: „factură de 119.000 lei (100.000 + 19.000 TVA) → 19.000 × 50 % = 9.500 deductibil / 9.500 nedeductibil". **The standard rate has been 21 % since 1 August 2025 (Legea 141/2025).** **A 2026-labelled example with pre-August-2025 thresholds.**

**7E. Official VAT-return worked example with the 50 % vehicle line: NOT FOUND.** OPANAF nr. 174/2026 (MO 105/09.02.2026) for formular 300 says only, for rd. 31, „Nu se preia în acest rând taxa pentru care nu se permite exercitarea dreptului de deducere conform art. 298". **No figures.**

## 8. Depreciere — art. 28 alin. (14), the 1.500 lei/lună ceiling

**Statute verified verbatim; our citation is correct.** Flow-through to PFA: **art. 68 alin. (4) lit. d)** requires PFA expenses „să respecte regulile privind amortizarea, prevăzute în **titlul II**".

**8A. Ceiling BINDS — all SRL, none PFA** — **CORROBORATED.** contabilitatedigitala.ro: „amortizare contabilă **1.841,67 lei/lună** / amortizare deductibilă fiscal **1.500 lei/lună** / diferență nedeductibilă fiscal **341,67 lei/lună**". firmaromania.com identical.

**8B. PFA depreciation example — ceiling NOT engaged** — **FACT.** contapp.ro, 24 Feb 2026, updated 28 Sep 2026: PFA neplătitoare TVA buys a utilaj for 24.000 lei, in use 10 March 2026, 4 ani / 48 luni linear: „24.000 / 48 = **500 lei pe lună**"; deductible 2026 (apr–dec, 9 luni) = **4.500**; 2027–2029 = 6.000 each; 2030 (ian–mar) = 1.500. Also degressive (coef. 1,5 → 37,5 %; yr1 9.000, yr2 5.625, switch to linear 4.687,50) and accelerated (yr1 12.000, then 4.000 × 3). **A car-free example — the 1.500 ceiling is never exercised.** [contapp.ro/blog/amortizare-mijloace-fixe-pfa/](https://contapp.ro/blog/amortizare-mijloace-fixe-pfa/)

**8C. ⚠️ Direct conflict on whether the ceiling applies to a PFA at all.**
- **contapp.ro** (PFA specialist, updated Aug 2026): the ceiling „se aplică tuturor autoturismelor din categoria M1, indiferent cât de mult le folosești în activitate. De el scapă doar vehiculele din cele patru categorii de excepție prevăzute la art. 28 alin. (14)". It also warns that exclusive business use lifts the **50 % expense** limit but **not** the 1.500 ceiling, and that a car held personally and used via comodat is **never** depreciated.
- **contabilitatedigitala.ro**: „Această limitare se aplică **doar societăților plătitoare de impozit pe profit**."
**These cannot both be right, and no published worked example exists of the ceiling binding on a PFA în sistem real.** **Our engine applies it — the contapp.ro reading supports us; flag the dissent.**

**8D.** At disposal of an M1 vehicle, the unamortised value is deductible within 1.500 lei × remaining months, per **pct. 27** of the norms for art. 28 alin. (14) (HG 1/2016), per PortalCodulFiscal.ro (June 2025) and fiscalitatea.ro. **FACT (practitioner reporting the norms).**

## 9. The form-label hazard, confirmed from the primary source
The OPANAF 2736/2025 **Instrucțiuni de completare a formularului 212** contain **no worked numerical example anywhere** — only line-by-line rules, including „Rd.2 … se înscrie suma determinată prin aplicarea cotei de **20 %** asupra venitului brut (rd.1)" and „Rd.9 … prin aplicarea cotei de impozitare de **10 %** asupra valorii înscrise la rd. 7". **And pct. 5.3 still prints the pre-2026 wording:** „În categoria venituri din **închirierea în scop turistic** a camerelor situate în locuințe proprietate personală…". **A form label is not a statement of FY2026 law.** [static.anaf.ro/static/10/Anaf/formulare/Instructiuni_D212_2736_2025.pdf](https://static.anaf.ro/static/10/Anaf/formulare/Instructiuni_D212_2736_2025.pdf)

## 10. Regimes with no published example at all
1. **Depreciere under the 1.500 lei/lună ceiling for a PFA.** Every example where the ceiling binds is an SRL plătitoare de impozit pe profit, and the two best practitioner sources disagree on whether it reaches a PFA.
2. **An official ANAF/MF worked example for income year 2026, in any regime.** All official worked examples are FY2024 or FY2025.
3. **An official worked example for art. 85 (1–7 camere).** Ploiești and Cluj FY2026 leaflets give formulas and the ladder table, no scenario.
4. **An official VAT worked example** — return or purchase — with the 50 % vehicle line.
5. **The art. 84¹ withheld tax amount** in the only official example covering art. 84¹: ANAF states the net (25.600) but never multiplies by 10 %.
6. **A published example combining art. 84 income with the art. 85 CASS rule, or applying the 50 % income-tax vehicle cap to amortisation.** **No source commits either error** — contapp.ro explicitly warns against the second. **So no negative fixture with an externally-stated expected value is possible for those; only the statutory carve-out can be asserted, which is INFERENCE-grade.**

## 11. Unresolved
1. **Which SMN drives FY2026 CASS/CAS thresholds — CLOSED 2026-10-13 by `research/48`.** It is **codified**, not ANAF practice: **art. 135¹ alin. (3) Cod fiscal** (OUG 128/2024 pct. 19, from 2025 incomes) — *„în vigoare la data de 1 ianuarie a anului de realizare a venitului … indiferent dacă în cursul aceluiași an se utilizează mai multe valori"*. **4.050 lei is statutory; fiscalitatelazi.ro's 4.325 reading is simply wrong.**
2. **Whether art. 28 alin. (14) binds a PFA.** Statute flow-through via art. 68 alin. (4) lit. d) points to yes; one practitioner says no; no official statement.
3. **The exact FY2026 paragraph numbering of the ladder.** ANAF Brașov cites „art. 170 alin. (2)-(4)" while the consolidated text puts the ladder at alin. (2)–(3) with the 72-SMN ceiling at alin. (1). **Our citation matches ANAF's; re-check against Monitorul Oficial rather than an aggregator.**
4. **The 30.000-vs-32.000 discrepancy in ANAF's own Exemplul 4** — typo, or a gross-up under art. 84¹ alin. (1) second sentence? **Next: the underlying DU 212 screenshots, pages 49–53 of the deck.**
5. **A „40 % flat expense ratio" claimed by declaratie-unica.ro** for „anumite categorii speciale" could not be verified. **Checked against our tree: we hold no 40 % ratio anywhere in the domain layer.**
6. **Whether the ContApp FY2026 figures survive the BNR annual-average publication** due January 2027 — the source itself flags them as provisional.

## 12. What this means for phase 31
- **Pin the regime split first** (§1). It is the highest-value fixture available and it is unpinned.
- **Pin 4.050 lei for FY2026 thresholds** and record the 4.325 dissent as a documented alternative, not a rule.
- **Match ANAF's truncation convention** (§3B: 2.488,5 → 2.488). A rounding mismatch will look like a rule error.
- **Label every fixture with the source's fiscal year and SMN.** A FY2025 example pinned as FY2026 is a fixture that teaches the wrong thresholds.
- **Expect to write some fixtures at INFERENCE grade** and say so in the test name. **An inference-grade fixture is a regression guard, not an authority.**
- **Re-run this search in Q1 2027** against `static.anaf.ro/static/10/{Bucuresti,Brasov,Iasi,Cluj,Ploiesti,Craiova,Constanta}/` for DU-2027 example decks — that is when the first official FY2026 worked examples will appear.

## Sources
**Kept (official):** ANAF DGFP București *Noutăți privind DU 2026 – exemple*; ANAF București Sector 4 *Dec_Unica_PF_Cedare_Fol*; ANAF DGRFP Ploiești *inchiriere_7_camere* (03.03.2026); ANAF DGRFP Brașov *web_ian_2026*; ANAF DGRFP Iași *material_informativ_27-01-2026*; OPANAF 2736/2025 *Instrucțiuni D212*; OPANAF 174/2026 *formular 300*; **HG 146/2026** (mmuncii.gov.ro); consolidated Cod fiscal art. 83, 84, 84¹, 85, 170, 298, 28 alin. (14), 68 alin. (4); Legea 239/2025.
**Kept (practitioner, with explicit arithmetic):** ContApp (FY2026 PFA full-year case; amortizare; autoturism la PFA); contabilitatedigitala.ro; firmaromania.com; capital.ro; declararatie-unica.ro; renzi.ro; completam.ro; contabilul.manager.ro; expertcontabiltim.ro.
**Dropped:** fiscalx.ro (2026 label, 19 % TVA — stale thresholds); estimez.ro (internally inconsistent SMN figures); fiscalitatelazi.ro (asserts 4.325 against ANAF — kept only as evidence of the conflict); declaratie-unica.ro's „maxim 5 camere" FAQ (pre-2026 rule in a 2026 page — hazard only); noulcodfiscal.ro *Amortizare fiscala 2025* and contabilul.manager.ro 2024 art. 84¹ pieces (pre-2026 framing); blogs that restate rules without computing (storno.ro, calculix.ro, calculvenituri.ro, dosarel.ro, rentio.ro, juridice.ro, startupcafe.ro, financiarul.ro) — excluded per instruction, except where they independently reproduce computed figures.
