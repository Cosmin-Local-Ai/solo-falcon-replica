# Research 24 — CAS thresholds and the consequence of income below 12 SM (FY2026, PFA sistem real)

Captured 2026-10-09 by the Researcher (`research-threshold-4`). Primary/official sources only.

**Orchestrator note on scope.** The Researcher was handed *my description* of the app's CAS model ("floor 6 × SM / ceiling 12 × SM, CF art. 150") and correctly reported that no primary text supports it. **That description was mine, not the code's.** `src/domain/thresholds.ts:149-150` already states: *"CAS_MAX_BASE was removed in Phase 3 and is NOT restored. CF art. 148 alin. (2) sets FLOORS — 'venitul ales de contribuabil, care nu poate fi mai mic decât' 12 SM / 24 SM — and contains no [ceiling]"*. So §2.2 / item 5 of "What the app must not state" describe a model the app does **not** have. What this research actually settles is the **warning layer** — TASK 4.

## Summary

For a Romanian PFA on **sistem real, FY2026**, the Codul fiscal attaches **no adverse legal consequence whatsoever** to net income from independent activities being below 12 × salariul minim: the 12-SM figure is not a "ceiling" at all — it is the **entry threshold** for the CAS obligation (art. 148 alin. (1)) and the **minimum** level of the chosen base (art. 148 alin. (2) lit. a)). Falling below it simply means **CAS is not owed**, with an optional election to pay it (art. 148 alin. (4)). No provision creates a breach, a *decălificare*, a regime change, a mandatory rectification, a penalty, or a reportable event; the word „decălificare" does not appear anywhere in the Cod fiscal.

---

## 1. Answer to the one question

**None.** For FY2026, a PFA în sistem real whose *venit net anual din activități independente* is below 12 salarii minime brute:

- **does not owe CAS** for that year (the obligation in art. 148 alin. (1) arises only if the cumulated annual value is *cel puțin egală cu 12 salarii minime brute*);
- **may opt** to pay CAS at a chosen base not lower than 12 SM (art. 148 alin. (4));
- **is not in breach**, is not required to rectify, is not "removed from any regime", and incurs no penalty under Titlul V CF;
- any CAS already paid in advance is **not refunded** and is credited toward the pension stage (art. 151 alin. (4)).

**Confidence: Verified** (primary consolidated text of art. 148, 150, 151 CF; negative search across the whole consolidated Cod fiscal, OUG 8/2026 and Legea 239/2025).

---

## 2. Verbatim Romanian + citations

### 2.1 The CAS base for independent activities — art. 148 CF

> **ART. 148 – Baza de calcul al contribuției de asigurări sociale datorate de persoanele fizice care realizează veniturile prevăzute la art. 137 alin. (1) lit. b) și b¹)**
>
> „(1) Persoanele fizice care în anul fiscal pentru care se depune Declarația unică privind impozitul pe venit și contribuțiile sociale datorate de persoanele fizice prevăzută la art. 122 au realizat venituri din activitățile prevăzute la art. 137 alin. (1) lit. b) și b¹), din una sau mai multe surse și/sau categorii de venituri, **a căror valoare anuală cumulată este cel puțin egală cu 12 salarii minime brute pe țară, datorează contribuția de asigurări sociale** la o bază de calcul stabilită potrivit alin. (2).
>
> (2) Baza anuală de calcul al contribuției de asigurări sociale, în cazul persoanelor care realizează veniturile prevăzute la art. 137 alin. (1) lit. b) și b¹), o reprezintă **venitul ales de contribuabil, care nu poate fi mai mic decât**:
> a) nivelul de 12 salarii minime brute pe țară, în cazul veniturilor realizate cuprinse între 12 salarii minime brute pe țară inclusiv și 24 de salarii minime brute pe țară;
> b) nivelul de 24 de salarii minime brute pe țară, în cazul veniturilor realizate cel puțin egale cu 24 de salarii minime brute pe țară.
>
> (3) Încadrarea în plafonul anual de cel puțin 12 salarii minime brute pe țară sau de cel puțin 24 de salarii minime brute pe țară, după caz, se efectuează prin cumularea veniturilor nete și/sau a normelor anuale de venit din activități independente determinate potrivit art. 68, 68³ și 69, a venitului brut realizat în baza contractelor de activitate sportivă potrivit art. 68¹, precum și a veniturilor nete din drepturi de proprietate intelectuală determinate potrivit art. 72, 72¹ și 73, realizate în anul pentru care se datorează contribuția.
>
> (4) Persoanele fizice prevăzute la alin. (1) **care nu se încadrează în plafonul de cel puțin 12 salarii prevăzut la alin. (3) pot opta pentru plata contribuției de asigurări sociale** pentru anul de realizare a venitului la un venit ales, care nu poate fi mai mic decât nivelul prevăzut la alin. (2) lit. a). Exercitarea opțiunii se efectuează anual prin depunerea Declarației unice [...], până la termenul prevăzut la art. 122 alin. (3)."

**Citation:** Legea nr. 227/2015 privind Codul fiscal, Titlul V, Cap. II, Secțiunea a 5-a, art. 148. CF published in **MO nr. 688 din 10.09.2015**. Text as in force for FY2026 taken from the ANAF consolidated edition `Cod_fiscal_norme_2023.htm` — „ultima actualizare: LEGEA nr. 170/2026". Art. 148 alin. (3) was reworded by **Legea 239/2025, art. XII pct. 18**: **MO nr. 1160 din 15.12.2025**, general entry into force **18.12.2025**; for pct. 18–20, **în vigoare 1 ianuarie 2026** and **aplicabile veniturilor aferente anului 2026** (Legea 239/2025, art. XIII alin. (1) lit. a) și alin. (2) lit. b)).

**Confidence: Verified.**

#### Two structural points that follow directly from this text
1. **There is no 12-SM ceiling for CAS.** Art. 148 alin. (2) sets only *minime* („nu poate fi mai mic decât"). The highest figure in the CAS base rules is **24 SM**, and even that is a *minimum* base, not a cap.
2. **There is no 6-SM floor for CAS.** The number 6 does not appear in art. 148, 150 or 151 in connection with the CAS base. (The only "per-month" figure is art. 151 alin. (3): „echivalentul salariului minim brut pe țară înmulțit cu numărul de luni", i.e. 1 SM × months, for taxpayers who become exempt mid-year.)

### 2.2 Art. 150 CF — what it actually is

> **ART. 150 – Excepții specifice privind veniturile prevăzute la art. 137 alin. (1) lit. b) și b¹)**
>
> „(1) Persoanele fizice asigurate în sisteme proprii de asigurări sociale, care nu au obligația asigurării în sistemul public de pensii potrivit legii, precum și persoanele care au calitatea de pensionari nu datorează contribuția de asigurări sociale pentru veniturile prevăzute la art. 137 alin. (1) lit. b) și b¹).
>
> (2) Persoanele fizice care realizează venituri din salarii și asimilate salariilor nu datorează contribuția de asigurări sociale pentru veniturile prevăzute la art. 137 alin. (1) lit. b¹)."

**Citation:** Cod fiscal, art. 150; MO nr. 688/10.09.2015 (as amended); ANAF consolidated edition, updated through Legea 170/2026. **Not amended by Legea 239/2025 nor by OUG 8/2026** (§2.7).

**Confidence: Verified.** Art. 150 contains **no base, no floor, no ceiling, no threshold in salarii minime**. Citing art. 150 for a CAS floor/ceiling is unsupported.

### 2.3 The actual consequence of being below 12 SM — art. 151 CF

> „(4) În situația în care persoanele fizice care realizează veniturile prevăzute la art. 137 lit. b) și b¹) au efectuat plăți înainte de termenul legal prevăzut de lege în contul contribuției de asigurări sociale datorate pentru anul în care sunt realizate veniturile, **iar venitul realizat cumulat din una sau mai multe surse de venituri este sub nivelul a 12 salarii minime brute pe țară**, precum și în cazul persoanelor care au optat pentru plata contribuției sau al celor care se încadrează în categoria persoanelor exceptate de la plata contribuției potrivit art. 150, **contribuția plătită nu se restituie**, aceasta fiind valorificată la stabilirea elementelor necesare determinării dreptului de pensie, potrivit legii."

> „(3) Prin excepție de la prevederile art. 148 alin. (1) și (2), pentru contribuabilii care datorează contribuția de asigurări sociale și care în cursul anului de realizare a venitului se încadrează în categoria persoanelor exceptate de la plata contribuției potrivit dispozițiilor art. 150, baza anuală de calcul [...] nu poate fi mai mică decât echivalentul salariului minim brut pe țară înmulțit cu numărul de luni [...]. **Dacă venitul anual realizat corespunzător lunilor de activitate luate în calcul, cumulat conform dispozițiilor art. 148 alin. (3), din una sau mai multe surse de venituri, este sub nivelul plafonului minim astfel recalculat, contribuabilul nu datorează contribuția de asigurări sociale pentru anul respectiv.**"

> „(13) Persoanele fizice prevăzute la art. 148 alin. (1) și (4) pot efectua plăți reprezentând contribuția de asigurări sociale datorată, oricând până la împlinirea termenului de plată."

**Citation:** Cod fiscal, art. 151 alin. (3), (4), (13); MO nr. 688/10.09.2015 as amended; ANAF consolidated edition (through Legea 170/2026). Art. 151 **not amended** by Legea 239/2025 or OUG 8/2026.

**Confidence: Verified.** Art. 151 alin. (3) is the **only** place in Titlul V where a below-threshold outcome is expressly legislated, and its stated consequence is *nu datorează contribuția* — not a breach, not a rectification, not a penalty.

### 2.4 The norms (HG 1/2016) and the official D212 form confirm the reading

Normele metodologice approved by **HG nr. 1/2016**, **MO nr. 22 din 13.01.2016** (ANAF consolidated edition: „ultima actualizare: Hotărârea Guvernului nr. 602/2025"), as reproduced in ANAF's official informative material:

> „În situația în care persoanele fizice au estimat pentru anul curent un venit net anual cumulat din venituri din activități independente, cel puțin egal cu nivelul a 12 salarii minime brute pe țară, **iar venitul net anual cumulat realizat este sub nivelul a 12 salarii minime brute pe țară, nu datorează contribuția de asigurări sociale**, cu excepția celor care au optat pentru plata contribuției. În acest caz contribuția plătită nu se restituie, aceasta fiind valorificată la stabilirea elementelor necesare determinării pensiei, potrivit legii."

> „Persoanele fizice al căror venit estimat se modifică în cursul anului în care se realizează veniturile și nu se mai încadrează în plafonul de 12 salarii minime brute pe țară **își pot modifica** contribuția datorată prin rectificarea venitului estimat, prin depunerea declarației unice, oricând până la împlinirea termenului legal de depunere a acesteia."

> „În situația în care venitul net realizat corespunzător lunilor de activitate este mai mic decât plafonul anual corespunzător numărul de luni de activitate, nu se datorează contribuția de asigurări sociale."

The official D212 model (Ordin ANAF nr. 2.736/2025, **MO nr. 1.207 din 29.12.2025**; Anexa – **MO nr. 1.207 bis din 29.12.2025**) offers, in Secțiunea 3 / Subsecțiunea 1, only two mutually exclusive boxes:

> „A. Am realizat venituri peste plafonul minim" … „**B. Am realizat venituri sub plafonul minim și optez pentru plata CAS**"

**Citation:** HG 1/2016 norms as reproduced in ANAF Iași, *Material informativ – Contribuția de asigurări sociale datorată de persoanele fizice care realizează venituri din activități independente*, `static.anaf.ro/static/10/Iasi/material_informativ_2_15-06-2021.pdf`; OPANAF 2.736/2025 annexes on legislatie.just.ro (doc 306268).

**Confidence: Partially verified** — the wording is ANAF-official and consistent with the statute, but the exact *punctum* number of HG 1/2016 for these paragraphs could not be pinned (the ANAF annotated Cod fiscal edition carries no inline norms block under art. 148–151). **Exact pct. number: UNVERIFIED.**

### 2.5 Where 6 × SM and 12 × SM *do* appear — CASS, not CAS

> **ART. 170 alin. (1) CF:** „Persoanele fizice care [...] au realizat venituri din cele prevăzute la art. 155 alin. (1) lit. b), din una sau mai multe surse, datorează contribuția de asigurări sociale de sănătate la o bază anuală de calcul egală cu suma rezultată prin cumularea venitului net anual realizat/brut sau normei anuale de venit [...] **care nu poate fi mai mare decât cea corespunzătoare unei baze anuale de calcul egale cu nivelul de 72 de salarii minime brute pe țară.**"

> **ART. 174 alin. (6) CF:** „În situația în care baza de calcul prevăzută la art. 170 alin. (1) [...] **este mai mică decât cea corespunzătoare unei baze de calcul egale cu nivelul de 6 salarii minime brute pe țară, persoanele fizice datorează contribuția de asigurări sociale de sănătate, respectiv o diferență de contribuție** [...] până la nivelul celei corespunzătoare bazei de calcul egale cu 6 salarii minime brute pe țară și depun Declarația unică [...] în termenul prevăzut la art. 122 alin. (3)."

> **ART. 174 alin. (2) CF:** „Persoanele fizice care [...] au înregistrat pierdere fiscală sau un venit net anual egal cu zero **nu datorează contribuția de asigurări sociale de sănătate** potrivit art. 170 alin. (1). Acestea pot opta pentru plata contribuției [...] potrivit art. 180 alin. (1)."

**Citation:** Cod fiscal art. 170 alin. (1), art. 174 alin. (2) și (6); ANAF consolidated edition (through Legea 170/2026). Art. 170 alin. (1) (60 → 72 SM) and art. 174 alin. (4), (5), (11) amended by **Legea 239/2025, art. XII pct. 19 și 20** — MO nr. 1160/15.12.2025, în vigoare **1 ianuarie 2026**, aplicabile **veniturilor aferente anului 2026**.

**Confidence: Verified.** The 6-SM floor is a **CASS** rule (art. 174 alin. (6)); the only *ceiling* for independent activities is the **72-SM CASS cap** (art. 170 alin. (1)). Neither is a CAS rule.

### 2.6 Regime change: the only income-level trigger, and it is unrelated to CAS

> **ART. 69 alin. (9) CF:** „Contribuabilii, pentru care venitul net se determină pe bază de norme de venit și care **în anul fiscal anterior au înregistrat un venit brut anual mai mare decât echivalentul în lei al sumei de 25.000 euro**, începând cu anul fiscal următor **au obligația determinării venitului net anual în sistem real**. Cursul de schimb valutar utilizat [...] este cursul de schimb mediu anual comunicat de Banca Națională a României, pentru anul de realizare a venitului."

> **ART. 69¹ alin. (1)–(2) CF:** „Contribuabilii care obțin venituri din activități independente, impuși pe bază de norme de venit, au dreptul să opteze pentru determinarea venitului net în sistem real, potrivit art. 68. [...] Opțiunea [...] **este obligatorie pentru contribuabil pe o perioadă de 2 ani fiscali consecutivi** și se consideră reînnoită pentru o nouă perioadă dacă contribuabilul nu solicită revenirea la sistemul anterior. Pentru a reveni la sistemul anterior, contribuabilul completează corespunzător Declarația unică [...], aferentă veniturilor realizate în anul următor expirării perioadei de 2 ani, și depune formularul la organul fiscal competent, până la termenul legal de depunere prevăzut la art. 122 alin. (3)."

> **ART. 69 alin. (3) CF (forma în vigoare pentru 2026):** „Norma de venit pentru fiecare activitate desfășurată de contribuabil nu poate fi mai mică decât nivelul a 12 salarii de bază minime brute pe țară garantate în plată, în vigoare la data de 1 ianuarie a anului de realizare a venitului."

**Citation:** Cod fiscal art. 69 alin. (9), art. 69¹; ANAF consolidated edition (through Legea 170/2026). Art. 69 alin. (9) is not a 2026 novelty. The reworded art. 69 alin. (3) is applied by ANAF „începând cu veniturile aferente anului 2026" (ANAF Brașov, `static.anaf.ro/static/10/Brasov/Brasov/web_ian_2026.pdf`); Legea 239/2025 does amend art. 69, but the exact punctum was not isolated.

**Confidence: Verified** for art. 69 alin. (9) and art. 69¹ text; **Partially verified** for which punct of Legea 239/2025 produced the current art. 69 alin. (3).

**Finding:** the only mandatory regime switch driven by an income level runs **norma de venit → sistem real**, is triggered by **venit brut** (not net) of the **previous** year exceeding **25.000 euro**, and is a *Titlul IV* (income tax) rule. **No Cod fiscal provision forces a PFA out of sistem real, or into norma de venit, because of an income level, and nothing links any regime switch to the CAS 12-SM figure.**

### 2.7 Did OUG 8/2026 or Legea 239/2025 change art. 150 or the CAS floor/ceiling for FY2026?

**OUG nr. 8 din 24 februarie 2026**, **MO nr. 147 din 25.02.2026**, **în vigoare 25.02.2026** (derogation from art. 4 CF: „prevederile art. 6 intră în vigoare la data publicării […] cu excepția prevederilor punctelor 25-44 care intră în vigoare la data de 1 martie 2026"). A full-text scan of the published act (legislatie.just.ro doc 307580, complete text, 104.904 chars):

- `art. 148` / `articolul 148` → **0 occurrences**
- `art. 150` / `articolul 150` → **0 occurrences**
- `art. 151` / `articolul 151` → **0 occurrences**
- `art. 137` → 0; `art. 69` → 0; `Titlul V` → 0; `salarii minime` → 0
- `asigurări sociale` → 4 (pension-legislation recitals; and the 3% bonificație conditions: „impozitul pe venit, contribuția de asigurări sociale și contribuția de asigurări sociale de sănătate datorate pentru veniturile realizate în anul 2025 […] se sting prin plată și/sau compensare, integral până la data 15 aprilie 2026 inclusiv")

→ **OUG 8/2026 did not modify art. 148, 150 or 151 and did not change any CAS floor or ceiling for FY2026.** Confidence: **Verified.**

**Legea nr. 239 din 15 decembrie 2025**, **MO nr. 1160 din 15.12.2025**, **în vigoare 18.12.2025**. Art. XII amends the Cod fiscal. For **Titlul V**, the ANAF comparison table lists exactly three rows:

- **pct. 18** – „La articolul 148, alineatul (3) se modifică" — wording only (adds references to art. 68³ and 68¹); **the 12-SM and 24-SM figures are unchanged**;
- **pct. 19** – „La articolul 170, alineatul (1) și litera c) a alineatului (4) se modifică" — CASS cap **60 → 72 salarii minime brute**;
- **pct. 20** – „La articolul 174, alin. (4), (5) și (11) se modifică" — 60 → 72 salarii minime brute.

**Art. 150 and art. 151 are not listed as modified.** Effective dates, verbatim:

> „Articolul XIII (1) Prin derogare de la prevederile Legii nr. 227/2015 […] prevederile art. XII intră în vigoare după cum urmează: a) prevederile pct. 1, 2, 12-15, 16 referitoare la dispozițiile art. 123 alin. (1²), **18-20**, 22-43 […] intră în vigoare la data de **1 ianuarie 2026**; […] (2) Prevederile art. XII se aplică după cum urmează: […] b) prevederile art. XII pct. 3-11, 16 și **18-20 se aplică începând cu veniturile aferente anului 2026**."

**Citation:** legislatie.just.ro doc 305208 (Legea 239/2025, full text); ANAF Brașov tables `static.anaf.ro/static/10/Brasov/Brasov/titl_V_cf.pdf` and `titl_IV_cf.pdf`. **Confidence: Verified.**

### 2.8 The 2026 reference values (salariul minim)

> **HG nr. 146 din 12 martie 2026:** „Începând cu data de 1 iulie 2026, salariul de bază minim brut pe țară garantat în plată […] se stabilește în bani […] la suma de **4.325 lei lunar** […] **Art. 2** – La data prevăzută la art. 1, Hotărârea Guvernului nr. 1.506/2024 […] se abrogă."

HG 146/2026: **MO nr. 196 din 13.03.2026**, în vigoare **13.03.2026**, SM new level effective **1 iulie 2026**. HG nr. 1.506/2024 (**MO nr. 1185 din 28.11.2024**) set **4.050 lei** from 1 ianuarie 2025 and remained applicable **1 ianuarie – 30 iunie 2026**.

ANAF's own FY2026 computation (ANAF Brașov, *Modificări aduse Codului fiscal prin Legea nr. 239/2025…*, ianuarie 2026):

> „Având în vedere nivelul salariului de bază minim brut pe țară garantat în plată, **în vigoare la data de 1 ianuarie a anului 2026 (4.050 lei)**, pentru veniturile prevăzute la art. 137 alin. (1) lit. b) și b¹) […] baza anuală de calcul a CAS în anul 2026 este: a) **48.600 lei** – nivelul de 12 salarii minime brute pe țară […] b) **97.200 lei** – nivelul de 24 de salarii minime brute pe țară […]"

**Confidence: Verified** for the HG texts and the ANAF figures. **UNVERIFIED:** whether the 1 iulie 2026 increase to 4.325 lei alters the FY2026 CAS thresholds — art. 148 CF contains **no date-of-reference clause** for the SM, and no primary provision resolves this for CAS. Do not render a single lei amount as "the law" without flagging this.

---

## 3. Negative finding — what was searched and not found

| Source searched | Search performed | Result |
|---|---|---|
| Cod fiscal consolidated (ANAF, through Legea 170/2026) | full text of art. 148, 150, 151, 170, 174, 69, 69¹; string `decălific` / `decific` / `decertific` | **0 occurrences** of any "decălificare"-type term anywhere in the Cod fiscal |
| OUG 8/2026 (MO 147/25.02.2026), full published text | `art. 148/150/151`, `articolul 148/150/151`, `Titlul V`, `salarii minime`, `art. 137`, `art. 69` | **0 occurrences** |
| Legea 239/2025 (MO 1160/15.12.2025), full text + ANAF Titlul V comparison table | `articolul 148`, `articolul 150`, `articolul 151`, `articolul 170`, `articolul 174` | art. 148 alin. (3) only (wording); art. 170 and 174 (CASS 60→72). **art. 150 and art. 151: 0 occurrences** |
| HG 1/2016 norms (as annotated/reproduced by ANAF) | CAS section for independent activities | No provision creating a breach, penalty, rectification duty or regime change for income below 12 SM; norms say „nu datorează contribuția de asigurări sociale" and „își **pot** modifica" |
| OPANAF 2.736/2025 D212 annexes (MO 1.207 bis/29.12.2025) | CAS section | Only „A. venituri peste plafonul minim" / „B. venituri sub plafonul minim **și optez** pentru plata CAS" |

**Not found anywhere:** any provision making income below 12 × SM (a) a contravention or penalty; (b) a *decălificare* or „schimbare de regim"; (c) a mandatory rectification obligation; (d) a reportable/notifiable event; (e) a ground for removal from sistem real.

**Caveat (not threshold-related):** penalties in this area arise only from failure to file / failure to pay under the Cod de procedură fiscală, and the HG 1/2016 norms provide that where a taxpayer who **is** obliged does not file D212, the tax authority may set the CAS base din oficiu at 12 SM. That is a consequence of **non-filing**, not of being below the threshold. **Confidence: Partially verified** (norms wording via ANAF informative material; CTPF sanction articles not individually verified here).

---

## What the app may state as law
1. **„CAS pentru activități independente se datorează numai dacă valoarea anuală cumulată a veniturilor din art. 137 alin. (1) lit. b) și b¹) este cel puțin egală cu 12 salarii minime brute pe țară."** — CF art. 148 alin. (1) și (3).
2. **„Baza anuală de calcul al CAS este venitul ales de contribuabil, care nu poate fi mai mic decât 12 salarii minime brute (pentru venituri între 12 și 24 SM inclusiv) sau 24 salarii minime brute (pentru venituri cel puțin egale cu 24 SM)."** — CF art. 148 alin. (2) lit. a) și b).
3. **„Dacă venitul net anual din activități independente este sub 12 salarii minime brute, nu datorezi CAS pentru anul respectiv."** — CF art. 148 alin. (1) coroborat cu alin. (4); art. 151 alin. (3) teza finală; normele HG 1/2016.
4. **„Poți opta pentru plata CAS, la un venit ales nu mai mic decât 12 salarii minime brute, prin depunerea Declarației unice până la termenul din art. 122 alin. (3)."** — CF art. 148 alin. (4).
5. **„Dacă ai plătit CAS în avans și venitul realizat cumulat este sub 12 salarii minime, contribuția plătită nu se restituie; ea este valorificată la pensie."** — CF art. 151 alin. (4).
6. **„Pensionarii și persoanele asigurate în sisteme proprii de asigurări sociale fără obligația asigurării în sistemul public nu datorează CAS pe aceste venituri; dacă această situație intervine în cursul anului, baza se recalculează la 1 SM × numărul de luni, iar dacă venitul realizat pe lunile respective este sub plafonul recalculat, contribuția nu se datorează."** — CF art. 150 alin. (1) și art. 151 alin. (3).
7. **„Pentru CASS pe venituri din activități independente, baza este venitul net anual (sau norma ajustată), încadrat între un minim de 6 salarii minime (diferență de CASS dacă e mai mic) și un maxim de 72 salarii minime brute pe țară."** — CF art. 170 alin. (1), art. 174 alin. (2), (6), (7); plafon 72 SM introdus prin Legea 239/2025 art. XII pct. 19, MO 1160/15.12.2025, în vigoare 01.01.2026, aplicabil veniturilor 2026.
8. **„Trecerea obligatorie de la norma de venit la sistem real intervine dacă în anul fiscal anterior venit brut anual a fost mai mare decât echivalentul a 25.000 euro (curs mediu anual BNR); opțiunea pentru sistem real este obligatorie 2 ani fiscali consecutivi."** — CF art. 69 alin. (9), art. 69¹ alin. (1)-(2).
9. **„Valorile de referință pentru 2026: SM 4.050 lei (1 ianuarie–30 iunie 2026, HG 1.506/2024) și 4.325 lei de la 1 iulie 2026 (HG 146/2026, MO 196/13.03.2026); ANAF folosește pentru 2026 baza CAS de 48.600 lei / 97.200 lei, calculată cu SM în vigoare la 1 ianuarie 2026."** — HG 1.506/2024; HG 146/2026; ANAF Brașov, ianuarie 2026.
10. **„OUG 8/2026 nu a modificat art. 148, 150 sau 151 și nu a schimbat plafoanele CAS pentru 2026; Legea 239/2025 a modificat doar art. 148 alin. (3) (redactare) și plafoanele CASS (60→72 SM), aplicabile veniturilor 2026."** — verified full-text scans above.

## What the app must not state
1. **Not supported: „venitul net sub 12 salarii minime = decălificare din regim" / „schimbare de regim" / „ieșire din sistemul real".** The Cod fiscal contains no „decălificare" concept for PFA (0 occurrences), and no provision links the CAS 12-SM figure to any change of fiscal regime. **Remove this wording entirely.**
2. **Not supported: that falling below 12 SM is a breach, an irregularity, a risk, an anomaly, or a reportable event.** The threshold is a condition for the *existence* of the obligation (art. 148 alin. (1)); below it, the legal consequence is that **no CAS is due**.
3. **Not supported: any rectification obligation triggered by income falling below 12 SM.** The norms say the taxpayer „își **pot** modifica" the declared estimate; art. 151 alin. (9) and (10) impose filing duties only in the opposite direction.
4. **Not supported: any penalty, sanction or accessory obligation attached to being below the threshold.** No such rule exists in Titlul V CF. Sanctions arise only from non-filing / non-payment under the Cod de procedură fiscală.
5. **Not supported: „CAS base bounded by a floor of 6 × SM and a ceiling of 12 × SM (CF art. 150)".** *(Orchestrator note: this was my description of the app, not the app's model — `thresholds.ts` already implements 12 SM / 24 SM minima per art. 148 alin. (2) and records that CAS_MAX_BASE was removed in Phase 3.)* Art. 150 CF is *Excepții specifice* and sets no base, floor or ceiling; the CAS base levels are **12 SM and 24 SM, both minima**; the 6-SM floor is a **CASS** rule (art. 174 alin. (6)) and the only ceiling for independent activities is the **72-SM CASS cap** (art. 170 alin. (1)).
6. **Not supported: presenting a single lei amount as the statutory FY2026 threshold.** Art. 148 CF states only multipliers of „salariul minim"; the lei figures (48.600 / 97.200 lei) come from ANAF guidance using the 1 ianuarie 2026 SM, and the SM changed to 4.325 lei on 1 iulie 2026. Any lei figure must be labelled as computed, not as the text of the law.
7. **Not supported: implying that „a atins plafonul" (reaching 12 SM) is a limit beyond which something stops.** For CAS, 12 SM is a *minimum* base and 24 SM is a higher *minimum* base; nothing is capped at 12 SM.
8. **If the sources support nothing more than a factual observation, say only that:** „Venitul net anual din activități independente este sub pragul de 12 salarii minime brute pe țară; în consecință, nu se datorează contribuția de asigurări sociale pentru acest an (art. 148 alin. (1) și (4) din Codul fiscal). Opțiunea pentru plata CAS este disponibilă, la un venit ales de cel puțin 12 salarii minime brute." — and nothing beyond that.

## Gaps
- **Which SM vintage applies to the FY2026 CAS thresholds** (4.050 lei at 1 ianuarie vs 4.325 lei from 1 iulie): art. 148 CF has no reference-date clause; ANAF's published 2026 figures use the 1 January value. **UNVERIFIED** — needs the FY2026 D212 order/instructions (expected late 2026) or an ANAF îndrumar.
- **Exact punctum numbers in HG 1/2016** for the CAS-on-independent-activities norms: the ANAF annotated edition carries no inline norms block under art. 148–151, and the legislatie.just.ro consolidated HG 1/2016 page did not render its annex text in this session. **UNVERIFIED as to numbering.**
- **Which punct of Legea 239/2025 produced the current art. 69 alin. (3)**: **Partially verified.**
- **CTPF sanction articles** for non-filing/non-payment of D212 (and the „notificare de conformare" mechanism visible in the 2026 D212 model) were not individually verified; relevant only if the app mentions consequences of *not filing*.
- **Legea nr. 170/2026** is the last act reflected in the ANAF consolidated edition used; it was not audited for other Titlul V changes.
