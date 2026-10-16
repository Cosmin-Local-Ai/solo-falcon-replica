# R-DPI — Drepturi de proprietate intelectuală: the FY2026 rule surface a DPI income path needs

**Researched by** `researcher-dpi-rules` on 2026-10-13, web only. **Written to file by the orchestrator** — the Researcher has no filesystem access (§12.16, §12.14). **Feeds B-112.**

**Why this pass existed.** Golden fixture 1 pinned ANAF's own arithmetic and the engine disagreed: for **activități independente net 68.000 lei** *plus* **DPI net 50.000 lei**, ANAF computes **bază CAS 97.200 → CAS 24.300 lei**; the engine computes **12.150 lei**. A 12.150-lei understatement for a real taxpayer.

**Diagnosis, confirmed against the tree at `tax.ts:644`:** `cumulateContributionBase` sums only art. 155 alin. (1) **lit. b)** sources. **The tier function is correct** — 12.150 = 25 % × 48.600, the right answer for 68.000 alone. **The gap is a missing income category, not a broken ladder.**

---

## Two corrections to the orchestrator's premises — both wrong, both would have been built into rules

1. **⚠️ The DPI flat expense quota is 40 %, NOT 20 %.** Art. 72 alin. (2) and art. 72¹ alin. (1): *„prin deducerea din venitul brut a cheltuielilor determinate prin aplicarea cotei forfetare de **40 %** asupra venitului brut"*. **The 20 % quota belongs to *cedarea folosinței bunurilor* — art. 84 alin. (2) and art. 84¹ alin. (3), introduced by OUG 115/2023.** Net = **0,6 × gross**. **GRADE: FACT.**
2. **⚠️ The SMN reference date is codified, not ANAF practice.** **Art. 135¹ alin. (3) Cod fiscal**, inserted by OUG 128/2024 pct. 19, applicable from 2025 incomes, verbatim: *„În aplicarea prevederilor **art. 148, 151, 170, 174 și 174¹**, la verificarea încadrării venitului în plafoanele anuale, precum și la stabilirea bazei anuale … se ia în calcul valoarea salariului minim brut pe țară … **în vigoare la data de 1 ianuarie a anului de realizare a venitului** … **indiferent dacă în cursul aceluiași an se utilizează mai multe valori**."* **This closes the open question in `research/47` §11.1: the 4.050 lei reading is statutory, and fiscalitatelazi.ro's 4.325 reading is simply wrong. GRADE: FACT (primary text).**

## 1. DPI is its own CAS-bearing category — FACT
Art. 137 alin. (1) Cod fiscal: *„… datorează, după caz, contribuția de asigurări sociale pentru următoarele categorii de venituri …: **b) venituri din activități independente, definite conform art. 67** … ; **b1) venituri din drepturi de proprietate intelectuală, definite la art. 70, cu excepția veniturilor prevăzute la art. 72 alin. (3)**; c) indemnizații de șomaj; d) indemnizații de asigurări sociale de sănătate."*

Art. 70 defines DPI (drepturi de autor și conexe, brevete, desene și modele, mărci, indicații geografice, topografii pentru semiconductoare …). **Rates: CAS 25 % (art. 138 lit. a)), CASS 10 % (art. 156).**

**The art. 72 alin. (3) / art. 72¹ alin. (2) exclusion set is load-bearing and appears twice:** *moștenitori*, *drept de suită*, *remunerație compensatorie pentru copia privată* get **no flat quota** *and* are **excluded from CAS** by art. 137 alin. (1) lit. b¹). **One flag, two consequences.**

## 2. The cumulation — art. 148 alin. (3): lit. b) **and** lit. b¹) into one ceiling test — FACT
> **(1)** *„…au realizat venituri din activitățile prevăzute la art. 137 alin. (1) lit. b) și b¹), din una sau mai multe surse și/sau categorii de venituri, **a căror valoare anuală cumulată este cel puțin egală cu 12 salarii minime brute** pe țară, datorează contribuția de asigurări sociale la o bază de calcul stabilită potrivit alin. (2)."*
> **(2)** *„…venitul ales de contribuabil, care nu poate fi mai mic decât: **a) nivelul de 12 salarii minime brute**, în cazul veniturilor realizate cuprinse între 12 salarii minime brute inclusiv și 24 …; **b) nivelul de 24 de salarii minime brute**, în cazul veniturilor realizate **cel puțin egale cu 24** …"*
> **(3)** *„Încadrarea în plafonul anual … se efectuează **prin cumularea** veniturilor nete și/sau a normelor anuale de venit din activități independente determinate potrivit **art. 68, 68³ și 69**, a venitului brut realizat în baza contractelor de activitate sportivă potrivit **art. 68¹**, precum și a **veniturilor nete din drepturi de proprietate intelectuală determinate potrivit art. 72, art. 72¹ și art. 73**, realizate în anul pentru care se datorează contribuția."*

**So the cumulated set is: net AI (art. 68, 68³, 69) + gross sports-contract income (art. 68¹) + net DPI (art. 72, 72¹, 73) → one ceiling test → the ladder applies to the CUMULATED amount.**

### ANAF Exemplul 3, line by line — the fixture. *ANAF DGRFP București, „Noutăți privind DU 2026 – exemple", **FY2025, SMN 4.050 lei*** — FACT
```
AI în sistem real: venit brut 100.000 − cheltuieli deductibile 32.000 = net 68.000
Pierdere fiscală reportată = 20.000
DPI net 50.000 → reținut la sursă: CASS 4.860, CAS 12.150
Dividende 48.000 → nu se reține CASS; CAS nu se datorează pentru această categorie

CAS:
1. Total venituri AI + DPI (art. 148 alin. (2)) ......... = 118.000 lei
2. Bază CAS (venit ales) — nu mai puțin de 97.200 lei, „întrucât venitul cumulat
   din cele două surse pentru care se datorează CAS depășește 24 de salarii
   minime pe economie (24 × 4050 = 97.200 lei)"
3. CAS datorată = 97.200 × 25% .......................... = 24.300 lei
4. CAS reținută de plătitorul de venit din DPI .......... = 12.150 lei
5. Diferență de plată CAS = 24.300 − 12.150 ............. = 12.150 lei
```
**Tier and why:** 118.000 ≥ 24 × 4.050 = 97.200 → art. 148 alin. (2) **lit. b)** → floor 97.200. **FY2026 thresholds are identical**, because the 1 Jan 2026 SMN is still 4.050.

## 3. The 40 % quota, and what is inside it — FACT
- **Automatic, not elective.** Applied by the payer. ANAF Cluj (12 Feb 2026): *„În cheltuielile forfetare se includ, printre altele: **contribuțiile sociale datorate**, comisioanele, sume care revin organismelor de gestiune colectivă…"* → **CAS/CASS paid by the author are inside the 40 % and are NOT an extra deduction from the DPI income-tax base.**
- **Actual-expense election — art. 73 alin. (1)–(4):** *„Contribuabilii … au dreptul să opteze pentru determinarea venitului net în sistem real, potrivit art. 68."* **Binding for 2 consecutive fiscal years**, auto-renews, exercised by filing D212. Art. 73 alin. (4): *„Obligațiile declarative și regulile de impunere sunt cele stabilite pentru veniturile nete anuale din activități independente determinate în sistem real."*
- **Art. 72 alin. (7):** DPI earners have **no** REF and no accounting duty.

## 4. Withholding — three separate hooks, and my brief cited the wrong one
- **Income tax — art. 72 alin. (1), (4), (5):** *„impozitul fiind final"*; *„cota de **10 %** asupra venitului net … reține la sursă … la momentul plății"*; *„impozit final … până la data de 25 inclusiv a lunii următoare"*. **Effective 6 % of gross.** Art. 72 alin. (6): no withholding duty when paying asocieri fără personalitate juridică or entities keeping their own accounting. **Where the payer is not an accounting entity there is no withholding and the taxpayer self-assesses 10 % on net — art. 123 alin. (2).**
- **⚠️ Art. 124 alin. (1) as the DPI withholding hook could NOT be established — most likely a wrong citation in my brief.** The hooks are art. 72 alin. (4)–(5) (tax), art. 151 alin. (5)–(9) (CAS), art. 174¹ alin. (2), (6)–(8) (CASS); the payer's D112 duty is art. 147 alin. (1), cited by ANAF Cluj as **art. 132**.
- **CAS withheld — art. 151 alin. (5)–(11).** alin. (6): single payer, estimated net ≥ 12 SMN → payer must calculate, withhold, pay; the contract states *„venitul ales"*. alin. (7): multiple sources → the taxpayer **designates by contract** the payer whose income alone is ≥ 12 SMN. alin. (8): that payer files **D112** by the 25th of the following month. **alin. (9) is the top-up rule:** withheld on a base below 24 SMN but cumulated ≥ 24 SMN → file D212 to establish CAS at 24 SMN, and *„contribuția reținută … **este luată în calcul**"*. alin. (10): each source below 12 SMN but cumulated ≥ 12 SMN → **no withholding**, taxpayer files D212. alin. (11): the payer must issue *„o informare cu privire la nivelul contribuției … reținute"* on request.
- **CASS withheld — art. 174¹ alin. (2), (6)–(10).** alin. (2): payers of DPI, arendă, or asocieri cu persoane juridice set CASS using the art. 170 alin. (5) base. alin. (6): single payer, estimated net ≥ **6** SMN → withhold and file D112. alin. (8): top-up to the 12/24-SMN base, withheld *„este luată în calcul"*. alin. (10): each source below 6 SMN but cumulated ≥ 6 SMN → no withholding.

**Withheld vs due, from Exemplul 3.** DPI net 50.000 alone sits in the 12–24 SMN band for CAS (base 48.600 → withheld **12.150**) and the 12–24 band for CASS (base 48.600 → withheld **4.860**). The cumulated position pushes **both** to 24 SMN: CAS due 24.300 (difference **12.150**), CASS due 9.720 (difference **4.860**). **A fixture must model `withheld` and `due` as separate quantities with `diferență = due − withheld`, on both contributions independently.**

## 5. CASS — the asymmetry, stated by ANAF in terms — FACT
Art. 155 alin. (1) **lit. c)** = *„venituri din drepturi de proprietate intelectuale, definite conform art. 70"*. **DPI is lit. c) for CASS but lit. b¹) for CAS.**

- **Art. 170 alin. (1)** — lit. b) income: base = cumulated **actual net** (art. 68, 68¹, 68³, 69), *„care nu poate fi mai mare decât … 72 de salarii minime brute"*; **losses under art. 118 are excluded from the base**.
- **Art. 170 alin. (2)–(3)** — lit. c)–h) income: due if cumulated ≥ **6 SMN**; base = **6 SMN** (6–12), **12 SMN** (12–24), **24 SMN** (≥24).
- **Art. 170 alin. (4) lit. a)** — *„venitul net din drepturi de proprietate intelectuală, stabilit după acordarea cotei de cheltuieli forfetare prevăzute la art. 72 și 72¹, precum și venitul net din DPI determinat potrivit prevederilor art. 73"*; **lit. d)** — dividends count as *„dividendele plătite, diminuate cu impozitul reținut"*.
- **ANAF DGRFP Cluj, 22 Apr 2026, verbatim: „!!! Veniturile din activități independente nu se cumulează cu alte venituri pentru determinarea obligației de plată a CASS."**

**Exemplul 3 part A vs part B — the same taxpayer pays TWO separate CASS:**
```
A. art. 155 lit. b): 68.000 → bază = venitul net 68.000 → CASS 6.800 lei
B. art. 155 lit. c)-h): DPI 50.000 + dividende 48.000 = 98.000 (peste 97.200)
   → bază 97.200 (24 SMN) → CASS 9.720 lei; reținut 4.860 → diferență 4.860 lei
```
**DPI goes only into the tiered limb; AI goes only into the actual-net limb. They never mix.**

**Exemptions differ between the two contributions — FACT:**
- **CAS, art. 150 alin. (1):** own social systems and **pensionari** are exempt for **both** lit. b) and b¹). **alin. (2):** salaried persons are exempt **only for lit. b¹)** — not for lit. b). *Our code already reasons about this correctly.*
- **CASS, art. 154 alin. (1) lit. h¹):** *„persoanele fizice care realizează venituri din salarii și asimilate salariilor **și/sau venituri din pensii**, pentru veniturile din drepturi de proprietate intelectuală"* — extended to pensioners by Legea 141/2025 art. II pct. 17, **effective 1 Aug 2025**.

## 6. FY2026 thresholds — SMN 4.050 lei, by statute — FACT
SMN 2026: **4.050 lei** to 30 Jun (HG 1.506/2024); **4.325 lei from 1 Jul 2026** (HG 146/2026, MO 196/13.03.2026). **By art. 135¹ alin. (3) only the 1 January value matters for these thresholds.**

| Contribution | Tier | FY2026 base | Contribution |
|---|---|---|---|
| CAS art. 148 alin. (2) lit. a) | 12 SMN | 48.600 | 12.150 |
| CAS art. 148 alin. (2) lit. b) | 24 SMN | 97.200 | 24.300 |
| CASS art. 170 alin. (3) lit. a) | 6 SMN | 24.300 | 2.430 |
| CASS art. 170 alin. (3) lit. b) | 12 SMN | 48.600 | 4.860 |
| CASS art. 170 alin. (3) lit. c) | 24 SMN | 97.200 | 9.720 |
| CASS cap, art. 170 alin. (1) | 72 SMN | 291.600 | 29.160 |

**ANAF Brașov, ian. 2026: „În anul 2026 baza maximă de calcul pentru CASS la veniturile realizate din activități independente nu poate fi mai mare de 291.600 lei (72 × 4.050 lei)!"** — the 60→72 SMN cap applies to **FY2026 incomes**. **Our `max_annual_base = lei(291600)` is already right.**

## 7. Is DPI separate from a PFA's activity? — Separate, and the boundary is the contract's object
- **Structural:** art. 67 and art. 70 are two distinct definitions, mirrored in art. 137 lit. b)/b¹) and art. 155 lit. b)/c). **Neither art. 70 nor art. 72 contains any exclusion for PFA holders.** **FACT (text) → INFERENCE (no PFA carve-out exists).**
- **ANAF's own Exemplul 3 is a single taxpayer with both**, kept in different D212 subsecțiuni, cumulated **only for CAS**, never merged. **FACT.**
- **The dividing line is the contract's object** under Legea 8/1996: a *cesiune/licență* of patrimonial copyright (art. 40) → **DPI**; a *contract de comandă/antrepriză* (art. 47 L. 8/1996; art. 1851 C. civ.) where the author is paid to **produce and deliver** without transferring rights → **activități independente**. **ÎCCJ, secția de contencios administrativ și fiscal, decizia nr. 1793 din 23 martie 2021** refused DPI characterisation for „cesiune de drepturi de autor" contracts covering cold-calling work. **CORROBORATED.**
- **Verdict: a new income category, not a misclassification — but the rule set needs an explicit classification input (cesiune/licență vs prestări), not an inference from PFA status.**

## 8. Declared where — D212 and D112 — FACT (OPANAF 2736/2025 instrucțiuni)
- **DPI not withheld at source** → Cap. I, Secțiunea 1, Subsecțiunea 1 (pct. 4.1). Rd.1 venit brut, Rd.3 venit net anual, Rd.9 impozit anual datorat.
- **DPI with tax withheld and final** → no duty to file for the *tax* (pct. 4.2), **but the DPI net is still entered** for CAS/CASS: ANAF București — *„La rubrica **Venituri cu reținere la sursă a impozitului pentru care se datorează CAS/CASS**, contribuabilul va înscrie venitul net din drepturi de proprietate intelectuală și venitul încasat din dividende, precum și contribuțiile reținute la sursă, conform informațiilor transmise de plătitorii de venit."*
- **CAS** → Secțiunea a 3-a, Subsecțiunea 1: Rd.2 bază (venit ales), Rd.3 CAS stabilită, **Rd.4 „CAS reținută de plătitorul de venit conform art. 151 alin. (9)"**, **Rd.5 „Diferența stabilită în plus" (rd.3 − rd.4)**.
- **CASS** → Subsecțiunea a 2-a, **two rubrics: 2.1** for art. 155 lit. b) and **2.2** for lit. c)–h), with **Rd. 6 „CASS reținută … conform art. 174¹ alin. (6)"**.
- **⚠️ Row numbers are release-scoped** — ANAF's 2024 material used „Subsecțiunea 4.1" for DPI. **Do not hard-code them as stable identifiers.** The FY2026 D212 does not exist yet.

## 9. The interaction that will bite next — CAS/CASS apportionment, art. 118 — FACT
> **(2²)** CAS deductibilă *„se stabilește **proporțional cu ponderea venitului net anual determinat în sistem real în total venituri cumulate potrivit prevederilor art. 148 alin. (3)**, aplicată asupra contribuției … calculate potrivit art. 151 alin. (1)."*
> **(2³)** CASS deductibilă — same shape, denominator = the **art. 170 alin. (1)** cumulated total.
> **(2⁴)** *„Nivelul contribuției … deductibile … **nu poate depăși nivelul venitului net anual recalculat**."*

**ANAF Exemplul 3:** venit net recalculat 68.000 − 20.000 = **48.000**; ponderea 68.000 / 118.000 = **57,6 %**; **CAS deductibil 24.300 × 57,6 % = 13.997**; **CASS deductibil 6.800** — *only the art. 170 alin. (1) CASS; the 9.720 tiered CASS is not deductible here*; venit impozabil 48.000 − 13.997 − 6.800 = **27.203**; impozit **2.720**; with the 3 % bonificație **2.638**.

**The denominator is the art. 148 alin. (3) cumulated total, so adding a DPI path changes the income-tax result too, not just CAS.**

## 10. Rule parameters a DPI path needs that a PFA-only engine does not have
1. Income category `dpi` → CAS art. 137 lit. b¹), CASS art. 155 lit. c), **with the art. 72 alin. (3) exclusion set** (no quota *and* no CAS).
2. **Flat quota 40 %** (art. 72 alin. (2), 72¹ alin. (1)) — a category-level constant, distinct from the 20 % of art. 84/84¹.
3. Expense-regime election flag (art. 73, binding 2 years, auto-renewing) + the fact that **CAS/CASS sit inside the 40 %**.
4. Payer-class flag: accounting-keeping payer (art. 72) vs other (art. 72¹, self-assessed under art. 123 alin. (2)).
5. **CAS cumulation set** (art. 148 alin. (3)) → one ceiling test → ladder on the cumulated amount.
6. CAS withholding state machine (art. 151 alin. (5)–(11)), incl. the alin. (9) top-up and the alin. (10) fallback.
7. **CASS split into two independent limbs** — art. 170 alin. (1) actual net capped at 72 SMN, and art. 170 alin. (2)–(5) tiered. **Never cumulated with each other.**
8. CASS cumulation set (art. 170 alin. (4)), incl. **dividends net of withheld tax**.
9. CASS withholding state machine (art. 174¹ alin. (2), (6)–(10)).
10. **Separate `withheld` / `due` accumulators for CAS and CASS**, with `diferență`.
11. **SMN reference-date rule as a first-class parameter** (art. 135¹ alin. (3)).
12. **Two different exemption tables** (art. 150 for CAS, art. 154 alin. (1) lit. h¹) for CASS).
13. **CAS/CASS apportionment** (art. 118 alin. (2²)/(2³)/(2⁴)).
14. **Classification input, not inference** — contract type.
15. Declaration routing (D212 subsecțiuni, D112), **row numbers release-scoped**.

**Because releases are immutable (`registry.ts`: „a release cannot be edited in place … a revision gets a new releaseId and the old one is superseded"), items 1–4 and 7–9 introduce new categories and state machines, not new constants → this is a NEW releaseId, not an in-place edit.**

## 11. Gaps and what to distrust
1. **No official rule addresses a PFA author's copyright income directly.** Strongest evidence is structural + ANAF's mixed-category Exemplul 3 + ÎCCJ 1793/2021 commentary. **Next: `chat.anaf.ro` Q&A archive (index returned 404), or a written ANAF petiție if a fixture must rest on primary authority.**
2. **The FY2026 D212 does not exist yet** (OPANAF order expected early 2027) — FY2026 subsecțiune/rând numbering is not verifiable.
3. **Art. 154 alin. (1) lit. h) vs h¹)** — consolidations disagree on the letter; operative content is the same. **Verify against Monitorul Oficial before hard-coding the letter.**
4. **Dividend leg of the CASS tier for FY2026** — the 10 % → 16 % rate change from 1 Jan 2026 (Legea 141/2025) was confirmed only through secondary sources. **Verify before using a FY2026 dividend + DPI fixture.**
5. **Art. 124 alin. (1) as a DPI withholding hook could not be established** — likely a wrong citation in my brief.

**Sources to distrust:** **ANAF's national `Ghid_proprietate_inteleceala`/`Ghid_proprietate_intelectuala.pdf` is stale** — SMN 2.300 (2021), a single 12-SMN CASS threshold (pre-2024), and the superseded SMN reference date. **Do not use it for FY2026.** Also: thedaily.ro calls DPI „parte din categoria veniturilor din activități independente", which the Code does not say.

## Sources
**Kept:** art. 148, 150, 151, 155, 170, 174¹, 70, 72, 72¹, 73, 118, 123, 67, 154, 135¹ — noulcodfiscal.ro (consolidated, current to Legea 141/2025) cross-checked against Lexistoria; **ANAF DGRFP București „Noutăți privind DU 2026 – exemple"** (Exemplul 3); **ANAF DGRFP Cluj 12 Feb 2026** (DPI) and **22 Apr 2026** (AI, the non-cumulation sentence); **ANAF DGRFP Brașov ian. 2026** (FY2026 thresholds); **OPANAF 2736/2025 instrucțiuni D212**; **OUG 128/2024** (art. 135¹ alin. (3)); **HG 146/2026** (legislatie.just.ro, mmuncii.gov.ro); **mfinante.gov.ro** consolidated Titlul V (art. 174¹); GhidFiscal.ro art. 137; portalcodulfiscal.ro and contabilul.manager.ro (the 20 % belongs to art. 84/84¹); fiscalitatea.ro (art. 154 h¹), Juridice/Lege5 — A.-L. Mihai (DPI vs AI boundary, ÎCCJ 1793/2021).
**Dropped:** ANAF national DPI ghid (stale); fiscalx.ro (TVA 19 % after 1 Aug 2025); ANAF Exemplul 4 PJ limb (states 30.000, computes 32.000); SEO/practitioner guides used only as corroboration.
