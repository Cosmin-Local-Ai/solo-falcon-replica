# 2026 CAS Research — art. 147 / 148 / 150 / 151 Cod fiscal

Research record for **Phase 3 (CAS correction)**. Produced by the Phase 3 Researcher on 2026-10-05.
Scope was deliberately narrow: four questions, primary sources only, no open-ended fiscal research.

**This record supersedes the CAS content of `docs/ai/research/06_2026_fiscal_research.md`** and
**corrects three statements in `docs/ai/phases/02_fiscal_baseline.md` §2** — see §0 below.

It is a research record, not the phase deliverable. The Phase 3 deliverable is
`docs/ai/phases/03_cas.md`.

---

## 0. What this record changes

| # | Previously recorded | Now established | Where it was wrong |
|---|---|---|---|
| 1 | 24 SM is the CAS **maximum base**; `max_cas` 24,300 lei is a ceiling to be enforced | 24 SM is a **minimum floor** for the chosen base. **There is no CAS cap.** | `research/06:164`, `:178`; the original Phase 3 brief told the Worker to "drive it from the rule store — including `max_cas`" |
| 2 | CF **art. 147 alin. (1)** is the CAS salary/pension exemption hook (U-5) | **Art. 147 is not an exemption at all** — it is the monthly **Declarația 112** filing obligation for employers/payers. The exemption is **art. 150** | `phases/02:55`, `phases/02:399` (U-5), `PLAN.md:163`, `STATE.md:112`, code comment `package2026.ts:21` |
| 3 | OUG 128/2024 **removed** a 6-SM rung from the CAS ladder | **There was never a 6-SM rung in CAS.** The 6/12/24 ladder is CASS, art. 170 alin. (4) | `phases/02:54` |
| 4 | CAS is owed on any base, floored at 12 SM (code forces 48,600 even on a zero/loss base) | **Below 12 SM no CAS is owed.** Optional only under art. 148 alin. (4) | `calculators.ts:44-45`, `fiscal.test.ts:94-96` |

---

## 1. Art. 148 alin. (2) — complete text in force for 2026

**VERBATIM** (Portal Legislativ consolidated, Legea nr. 227/2015, Titlul V, Cap. II, Secțiunea a 5-a):

> **Articolul 148**
> Baza de calcul al contribuției de asigurări sociale datorate de persoanele fizice care realizează veniturile prevăzute la art. 137 alin. (1) lit. b) și b^1)
>
> (1) Persoanele fizice care în anul fiscal pentru care se depune Declarația unică privind impozitul pe venit și contribuțiile sociale datorate de personale fizice prevăzută la art. 122 au realizat venituri din activitățile prevăzute la art. 137 alin. (1) lit. b) și b^1), din una sau mai multe surse și/sau categorii de venituri, a căror valoare anuală cumulată este cel puțin egală cu 12 salarii minime brute pe țară, datorează contribuția de asigurări sociale la o bază de calcul stabilită potrivit alin. (2).
>
> (2) Baza anuală de calcul al contribuției de asigurări sociale, în cazul persoanelor care realizează veniturile prevăzute la art. 137 alin. (1) lit. b) și b^1), o reprezintă **venitul ales de contribuabil, care nu poate fi mai mic decât:**
> **a) nivelul de 12 salarii minime brute pe țară, în cazul veniturilor realizate cuprinse între 12 salarii minime brute pe țară inclusiv și 24 de salarii minime brute pe țară;**
> **b) nivelul de 24 de salarii minime brute pe țară, în cazul veniturilor realizate cel puțin egale cu 24 de salarii minime brute pe țară.**

**SOURCE:** Portal Legislativ, COD FISCAL (Legea nr. 227/2015), forma consolidată, document id 312601 —
art. 148 alin. (1)-(2). The consolidation carries amendment notes up to 25-02-2026; alin. (2) carries
only one note (OUG 128/2024 pct. 20, effective 01-01-2025), i.e. **alin. (2) is unchanged for 2026**.
**URL:** https://legislatie.just.ro/Public/DetaliiDocument/312601

**CORROBORATION (official ANAF, before/after table for OUG 128/2024 pct. 20, "DUPĂ" column)** — quotes
alin. (2) chapeau plus lit. a) and lit. b) identically.
**SOURCE:** ANAF – DGRFP Brașov, Serviciul Îndrumare, Asistență și Servicii Contribuabili, "MODIFICĂRI
ADUSE Legii nr. 227/2015 privind Codul fiscal de OUG nr. 128/2024 — TITLUL V Contribuții sociale
obligatorii", pct. 20.
**URL:** https://static.anaf.ro/static/10/Brasov/Brasov/oug_128_v.pdf

**CORROBORATION (official ANAF guidance, 2026):**
> "Baza anuală de calcul al CAS – venitul ales de contribuabil, care nu poate fi mai mic decât:
> a) 12 salarii minime brute pe țară (An 2025 = 48.600), dacă realizează venituri între 12 salarii minime
> brute pe țară inclusiv și 24 de salarii minime brute pe țară; b) 24 salarii minime brute pe țară
> (An 2025 = 97.200), dacă realizează venituri cel puțin egale cu 24 de salarii minime brute pe țară.
> art. 148 Cod fiscal"

**SOURCE:** ANAF, "Brosura privind DU 2026" (Declarația Unică 212).
**URL:** https://static.anaf.ro/static/10/Anaf/AsistentaContribuabili_r/Brosura_Declaratia_Unica_212_2025.pdf

### VERDICT — 24 SM is a MINIMUM FLOOR, not a cap

Income ≥ 24 SM → the base is **at least** 24 SM; the taxpayer may choose higher; **no upper cap exists in
art. 148**.

Proving words:
- the chapeau **"care nu poate fi mai mic decât"** — a floor construction;
- lit. b)'s condition **"în cazul veniturilor realizate cel puțin egale cu 24 de salarii minime brute pe
  țară"** — 24 SM is the *minimum permitted chosen base* once realized income reaches 24 SM;
- the word **"plafon"** in alin. (3) ("Încadrarea în plafonul anual de cel puțin 12 … sau de cel puțin
  24 …") denotes the **income threshold band**, not a cap on the base;
- **textual contrast:** CASS art. 170 alin. (1) uses the opposite formula — "care nu poate fi mai mare
  decât cea corespunzătoare unei baze anuale de calcul egale cu nivelul de … salarii minime brute" —
  and that one is a genuine cap. Art. 148 contains no such wording.

---

## 2. Art. 148 alin. (3) — the 01.01.2026 change

**VERBATIM (in force for 2026):**
> (3) Încadrarea în plafonul anual de cel puțin 12 salarii minime brute pe țară sau de cel puțin 24 de salarii minime brute pe țară, după caz, se efectuează prin cumularea veniturilor nete și/sau a normelor anuale de venit din activități independente determinate potrivit **art. 68, 68^3 și 69**, a venitului brut realizat în baza contractelor de activitate sportivă potrivit art. 68^1, precum și a veniturilor nete din drepturi de proprietate intelectuală determinate potrivit **art. 72, 72^1 și 73**, realizate în anul pentru care se datorează contribuția.
> (la 01-01-2026, Alineatul (3), Articolul 148, Sectiunea a 5-a, Capitolul II, Titlul V a fost modificat de Punctul 18., Articolul XII din LEGEA nr. 239 din 15 decembrie 2025, publicată în MONITORUL OFICIAL nr. 1160 din 15 decembrie 2025)
> Notă: Conform literei b) a alineatului (2) al articolului XIII din LEGEA nr. 239 din 15 decembrie 2025, publicată în MONITORUL OFICIAL nr. 1160 din 15 decembrie 2025, prevederile art. XII pct. 18 se aplică începând cu veniturile aferente anului 2026.

**VERBATIM (the 2025 version it replaced):**
> (3) Încadrarea în plafonul anual de cel puţin 12 salarii minime brute pe ţară sau de cel puţin 24 de salarii minime brute pe ţară, după caz, se efectuează prin cumularea veniturilor nete şi/sau a normelor anuale de venit din activităţi independente determinate potrivit **art. 68 şi 69**, a venitului brut realizat în baza contractului de activitate sportivă potrivit art. 68^1, precum şi a veniturilor nete din drepturi de proprietate intelectuală determinate potrivit **art. 72, art. 72^1 şi 73**, realizate în anul pentru care se datorează contribuţia.

**SOURCE (the act behind the previously unnamed 01.01.2026 flag):** **Legea nr. 239 din 15 decembrie
2025** privind stabilirea unor măsuri de redresare și eficientizare a resurselor publice și pentru
modificarea și completarea unor acte normative, **MO nr. 1160 din 15.12.2025**, **Art. XII pct. 18**;
applicable to incomes of year **2026** (art. XIII alin. (1) lit. a) și alin. (2) lit. b)).
**URLs:** https://legislatie.just.ro/Public/DetaliiDocument/312601 ·
https://static.anaf.ro/static/10/Brasov/Brasov/titl_V_cf.pdf ·
https://static.anaf.ro/static/10/Anaf/legislatie/L_239_2025.pdf

### VERDICT — something changed, but not the base shape

The 01.01.2026 amendment to alin. (3) is a **cross-reference update only**: it inserts **art. 68^3**
(net income from short-term accommodation services, flat 30% expense ratio) into the list of items
cumulated to test the 12/24-SM band, and tidies "art. 72, art. 72^1 şi 73" → "art. 72, 72^1 şi 73".
**Alin. (1), (2) and (4) are unchanged for 2026.**

Practical consequence: for 2026 the cumulation set for the threshold test is
`venit net sistem real (art. 68) + venit net prestări servicii cazare (art. 68^3) + normă anuală de venit
(art. 69) + venit brut contract activitate sportivă (art. 68^1) + venit net DPI (art. 72, 72^1, 73)`.

---

## 3. Art. 147 alin. (1) — the premise was wrong

**VERBATIM:**
> **Articolul 147**
> Depunerea Declarației privind obligațiile de plată a contribuțiilor sociale, impozitului pe venit și evidența nominală a persoanelor asigurate
>
> (1) Persoanele fizice și juridice care au calitatea de angajatori sau sunt asimilate acestora, instituțiile prevăzute la art. 136 lit. d)-f), precum și persoanele fizice care realizează în România venituri din salarii sau asimilate salariilor de la angajatori din state care nu intră sub incidența legislației europene aplicabile în domeniul securității sociale, precum și a acordurilor privind sistemele de securitate socială la care România este parte sunt obligate să depună lunar, până la data de 25 inclusiv a lunii următoare celei pentru care se plătesc veniturile, Declarația privind obligațiile de plată a contribuțiilor sociale, impozitului pe venit și evidența nominală a persoanelor asigurate.

**SOURCE:** Portal Legislativ, doc 312601 — Titlul V, Cap. II, Secțiunea a 4-a, art. 147 alin. (1).
**URL:** https://legislatie.just.ro/Public/DetaliiDocument/312601

### VERDICT — art. 147 is NOT a CAS exemption

It is the **monthly Declarația 112 filing obligation** for employers/payers (also referenced by art. 151
alin. (6)/(7) for payers of DPI / sports-contract income who withhold CAS). It contains **no exemption**
for persons insured under another title, and no minimum salary or pension condition.

### The actual exemption is ART. 150

"Excepții specifice privind veniturile prevăzute la art. 137 alin. (1) lit. b) și b^1)" — **VERBATIM:**
> (1) Persoanele fizice asigurate în sisteme proprii de asigurări sociale, care nu au obligația asigurării în sistemul public de pensii potrivit legii, precum și persoanele care au calitatea de pensionari nu datorează contribuția de asigurări sociale pentru veniturile prevăzute la art. 137 alin. (1) lit. b) și b^1).
>
> (2) Persoanele fizice care realizează venituri din salarii și asimilate salariilor nu datorează contribuția de asigurări sociale pentru veniturile prevăzute la art. 137 alin. (1) **lit. b^1)**.

**SOURCE:** Portal Legislativ, doc 312601 — art. 150 alin. (1)-(2). Alin. (2) last amended by OUG 18/2018,
MO 260/23.03.2018; **unchanged for 2026**.
**URL:** https://legislatie.just.ro/Public/DetaliiDocument/312601

**Mechanics:**
- **Automatic, not optional.** "nu datorează contribuția de asigurări sociale" — it operates by law; there
  is no option to exercise and no application.
- **No minimum salary or pension amount** conditions either paragraph.
- **Scope asymmetry — critical for this app:** alin. (1) (pensioners / persons in own social insurance
  systems) exempts **both** lit. b) *and* lit. b^1). Alin. (2) (persons with salary income) exempts **only
  lit. b^1)** — venituri din drepturi de proprietate intelectuală. **A PFA owner who is also a salaried
  employee is therefore NOT exempt from CAS on his independent-activity income (lit. b)).**
- **Mid-year entry into the exempt category — art. 151 alin. (3), VERBATIM:**
  > Prin excepție de la prevederile art. 148 alin. (1) și (2), pentru contribuabilii care datorează contribuția de asigurări sociale și care în cursul anului de realizare a venitului se încadrează în categoria persoanelor exceptate de la plata contribuției potrivit dispozițiilor art. 150, baza anuală de calcul al contribuției de asigurări sociale o reprezintă venitul ales de contribuabil, care nu poate fi mai mic decât echivalentul salariului minim brut pe țară înmulțit cu numărul de luni calculat de la începutul anului în care se produce evenimentul până la luna în care contribuabilul se încadrează în categoria persoanelor exceptate de la plata contribuției. Dacă venitul anual realizat corespunzător lunilor de activitate luate în calcul, cumulat conform dispozițiilor art. 148 alin. (3), este sub nivelul plafonului minim astfel recalculat, contribuabilul nu datorează contribuția de asigurări sociale pentru anul respectiv.
- **ANAF 2026 restatement:** "Excepții CAS pentru veniturile din activități independente, dacă: persoanele
  fizice sunt asigurate în sisteme proprii de asigurări sociale și nu au obligația asigurării în sistemul
  public de pensii potrivit legii; persoanele fizice au calitatea de pensionari. (art. 150 …)"
  **SOURCE:** ANAF Cluj, 22.04.2026 — https://static.anaf.ro/static/10/Cluj/cj_DU_activ_indep_22apr2026.pdf

---

## 4. Is CAS owed below 12 salarii minime brute?

### VERDICT — NO. Below 12 SM no CAS is owed; it is optional.

- **The obligation itself is conditional — art. 148 alin. (1)** (quoted in §1): it arises only where the
  cumulated annual value is "cel puțin egală cu 12 salarii minime brute pe țară". If the condition is not
  met the taxable event never arises.
- **The option — art. 148 alin. (4), VERBATIM:**
  > (4) Persoanele fizice prevăzute la alin. (1) care nu se încadrează în plafonul de cel puțin 12 salarii prevăzut la alin. (3) pot opta pentru plata contribuției de asigurări sociale pentru anul de realizare a venitului la un venit ales, care nu poate fi mai mic decât nivelul prevăzut la alin. (2) lit. a). Exercitarea opțiunii se efectuează anual prin depunerea Declarației unice … prevăzute la art. 122, până la termenul prevăzut la art. 122 alin. (3).
- **Base if the option is exercised:** the chosen income, **not lower than art. 148 alin. (2) lit. a) =
  12 SM** (2026: 4,050 × 12 = **48,600 lei**; CAS = 25% = **12,150 lei**). There is no lower optional base.
- **Reinforcing — art. 151 alin. (4), VERBATIM:**
  > (4) În situația în care persoanele fizice care realizează veniturile prevăzute la art. 137 lit. b) și b^1) au efectuat plăți înainte de termenul legal prevăzut de lege în contul contribuției de asigurări sociale datorate pentru anul în care sunt realizate veniturile, iar venitul realizat cumulat din una sau mai multe surse de venituri este sub nivelul a 12 salarii minime brute pe țară, precum și în cazul persoanelor care au optat pentru plata contribuției sau al celor care se încadrează în categoria persoanelor exceptate de la plata contribuției potrivit art. 150, contribuția plătită nu se restituie, aceasta fiind valorificată la stabilirea elementelor necesare determinării dreptului de pensie, potrivit legii.
  **SOURCE:** Portal Legislativ doc 312601, art. 148 alin. (4), art. 151 alin. (4).
- **ANAF 2026 guidance, VERBATIM:** "Se datorează CAS: Obligatoriu: dacă valoarea cumulată a veniturilor
  nete/brute este cel puțin egală cu plafonul de 12 salarii minime brute pe țară. … Opțional: dacă
  veniturile nete/brute realizate sunt mai mici decât cel puțin 12 salarii. Baza de calcul este venitul
  ales care nu poate fi mai mic de 12 salarii minime brute pe țară."
  **SOURCE:** ANAF, Brosura privind DU 2026 — https://static.anaf.ro/static/10/Anaf/AsistentaContribuabili_r/Brosura_Declaratia_Unica_212_2025.pdf
  Also ANAF Ploiești ("Persoanele fizice care realizează mai puțin de 12 salarii pot opta pentru plata
  CAS") — https://static.anaf.ro/static/10/Ploiesti/decl_activ_independente.pdf ; ANAF Iași, material
  informativ 27.01.2026 — https://static.anaf.ro/static/10/Iasi/material_informativ_27-01-2026.pdf

### CORRECTION — there was never a 6-SM rung in CAS

The ANAF Brașov before/after table for OUG 128/2024 pct. 20 shows the **pre-2025** art. 148 already used
only the 12-SM and 24-SM bands. OUG 128/2024 did not remove a 6-SM CAS tranche. The 6-SM tranche belongs
to **CASS** — art. 170 alin. (4): "Încadrarea în plafonul anual de cel puțin 6, 12 sau 24 de salarii
minime brute pe țară, după caz, se efectuează prin cumularea veniturilor prevăzute la art. 155 alin. (1)
lit. c) - h)".

What OUG 128/2024 actually changed for persoane fizice was the **structure of art. 148** (renumbering:
old alin. (4) → new alin. (2); old alin. (2) → new alin. (3); old alin. (3) → new alin. (4)) and the shift
from an **estimated-income** test ("dacă estimează pentru anul curent", filed 15 March / 25 May of the
current year) to a **realized-income** test on the previous year (filed by 25 May of the following year).
**SOURCE:** ANAF Brașov, OUG 128/2024 Titlul V before/after table, pct. 20 —
https://static.anaf.ro/static/10/Brasov/Brasov/oug_128_v.pdf ; ANAF Brașov, Legea 239/2025 Titlul V table
— https://static.anaf.ro/static/10/Brasov/Brasov/titl_V_cf.pdf

---

## 5. The resulting 2026 CAS model

Derived from §1-§4. For a PFA în sistem real, income year 2026, SM = 4,050 lei (art. 135^1 alin. (3):
the SM in force on 1 January of the income year governs annual bases):

| Condition | Base | CAS @ 25% |
|---|---|---|
| Pensioner, or insured in an own social insurance system (art. 150 alin. (1)) | — | **0** |
| Cumulated income < 12 SM (48,600 lei) — no option exercised (art. 148 alin. (1)) | — | **0** |
| 12 SM ≤ income < 24 SM | floor **12 SM = 48,600 lei** | **12,150 lei** |
| Income ≥ 24 SM | floor **24 SM = 97,200 lei** | **24,300 lei** |
| Any of the above, with a voluntarily chosen higher base | chosen base ≥ floor | 25% × chosen base |

- **Salaried employment does NOT exempt** CAS on independent-activity income (art. 150 alin. (2) covers
  only lit. b^1)). `salaryStatus` must not suppress CAS.
- **There is no upper cap.** `max_base` / `max_cas` in `package2026.ts` encode a limit the article does
  not state.
- The base is **`venitul ales`**, not realized net income. Realized income only selects which floor
  applies.

---

## 6. UNRESOLVED

1. **Priority-1 source unavailable.** `https://static.anaf.ro/static/10/Anaf/legislatie/COD_FISCAL.pdf`
   returns **HTTP 404**. Not retried beyond 2 attempts. Other ANAF consolidated pages found
   (`Cod_fiscal_norme.htm`, `L_227_2015.htm`) are base/older forms, not a 2026 consolidation, so they were
   not used for verbatim quotes. All verbatim quotes come from Portal Legislativ doc 312601 (priority 2)
   plus official ANAF amendment tables and 2026 ANAF guidance (priorities 3-4), which agree verbatim.
2. **Exact "actualizată la" header date of consolidation 312601** was not captured. Evidence from within
   the text: amendment notes dated up to **25-02-2026** are present, so the consolidation post-dates that.
3. **Whether OUG nr. 8/2026 touches art. 148** — no amendment note on art. 148 from OUG 8/2026 appears in
   the consolidation (only three "Articolul 148" hits: the article itself plus the two notes). Treated as
   "no change", but **the OUG 8/2026 text itself was not read for art. 148.** Given that the same note set
   was proven incomplete for art. 68 (`phases/02` §8.2), this remains an open risk, not a closed negative.
4. **art. 68^3 not read in full.** If the app must handle 2026 accommodation-services income, art. 68^3 — **CLOSED 2026-10-11: alin. (1)–(12) read verbatim against the 08.08.2026 consolidation, see `research/38` §3. The CASS question is closed there too: art. 170 alin. (1) names 68^3 expressly (L239/2025 art. XII pct. 19), so the net is the CASS base, floored at 6 SM and capped at 72 SM.**
   (net = brut − 30% forfetar; platform commissions excluded from brut) now feeds the art. 148 alin. (3)
   cumulation and must be read before it is modelled.
5. **SM assumption for the 2026 annual bases.** Art. 148 uses the SM "în vigoare la termenul de depunere a
   declarației" under the pre-2025 wording; `phases/02` §3 settles the point for 2026 on CF art. 135^1
   alin. (3) (SM in force on 1 January of the income year) and on ANAF's own published 2026 figures
   (48,600 / 97,200 / 291,600). The researcher's note that a July 2026 increase to 4,325 lei does **not**
   move the 2026 annual bases is consistent with that.

---

## 7. Sources

**Kept**
- Portal Legislativ — COD FISCAL, Legea nr. 227/2015, forma consolidată, doc 312601
  (https://legislatie.just.ro/Public/DetaliiDocument/312601) — authoritative consolidated text with dated
  amendment notes; source of all verbatim quotes for art. 147, 148, 150, 151.
- ANAF DGRFP Brașov — "MODIFICĂRI ADUSE … de OUG nr. 128/2024, TITLUL V"
  (https://static.anaf.ro/static/10/Brasov/Brasov/oug_128_v.pdf) — official before/after of art. 148
  pct. 20; proves pre-2025 had no 6-SM CAS rung.
- ANAF DGRFP Brașov — "MODIFICĂRI ADUSE … DE LEGEA NR. 239/2025"
  (https://static.anaf.ro/static/10/Brasov/Brasov/titl_V_cf.pdf) — names the 01.01.2026 act for art. 148
  alin. (3) and its effective date.
- Legea nr. 239 din 15 decembrie 2025 (https://static.anaf.ro/static/10/Anaf/legislatie/L_239_2025.pdf) —
  the amending act itself.
- ANAF — Brosura privind DU 2026
  (https://static.anaf.ro/static/10/Anaf/AsistentaContribuabili_r/Brosura_Declaratia_Unica_212_2025.pdf) —
  official 2026 guidance: obligatoriu / opțional CAS.
- ANAF Cluj, 22.04.2026 (https://static.anaf.ro/static/10/Cluj/cj_DU_activ_indep_22apr2026.pdf) and
  ANAF Iași, 27.01.2026 (https://static.anaf.ro/static/10/Iasi/material_informativ_27-01-2026.pdf) —
  2026 plafoane (4,050 lei; 48,600 / 97,200 lei), art. 150 excepții, 2026 alin. (3) with art. 68^3.
- ANAF Ploiești (https://static.anaf.ro/static/10/Ploiesti/decl_activ_independente.pdf) — "mai puțin de
  12 salarii pot opta".

**Dropped**
- `static.anaf.ro/static/10/Anaf/legislatie/COD_FISCAL.pdf` — 404, dead.
- noulcodfiscal.ro art. 148 page — commercial mirror, excluded by source policy (used only to locate the
  provision, not cited).
- portalpfa.ro, infocontact.ro — commercial PFA guides, excluded by source policy.
- ANAF Galați `activ-indep.pdf` — official but pre-2025 wording (references the old art. 148 alin. (2)/(4)
  numbering); superseded.
- ANAF Brașov `sanatate_2025.pdf`, `Titl_V_CONTRIBUTII.pdf` — CASS / salary contributions, out of scope.
