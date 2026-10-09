# Research 25 — the pension relief on CASS for independent activities (FY2026, PFA sistem real)

Captured 2026-10-09 by the Researcher (`research-pension-cass-5`). Primary/official sources only. Consolidated Cod fiscal: **legislatie.just.ro/Public/DetaliiDocument/171282**.

## Summary

For a Romanian PFA on sistem real in FY2026, the pension-related relief on CASS for independent-activity income is **not an exemption from CASS**. It is **art. 174 alin. (7) lit. c) CF**, which removes **only the *diferența de contribuție* up to the 6-salarii-minime floor under art. 174 alin. (6)**. The CASS due on the actual realised net income (art. 174 alin. (1) × art. 170 alin. (1) × art. 156) remains fully due. The exception keys on **the fact of having realised pension income in the fiscal year** („a realizat venituri … din pensii, definite conform art. 99"), **not** on *calitatea de pensionar* — and, unlike lit. a) and b), it carries **no minimum amount threshold**. A single `pensionStatus` boolean therefore switches off too much: pensioner *status* is the trigger for a different contribution (CAS, art. 150 alin. (1)) and a different income category (pension income, art. 154 alin. (1) lit. h²)), not for CASS on art. 155 alin. (1) lit. b) income.

**Bonus finding that closes a gap from research 24:** **art. 135¹ alin. (3) CF** settles which minimum-wage value governs the FY2026 social-contribution thresholds — see Q4. Research 24 recorded this as UNVERIFIED; it is now **Verified**.

---

## Q1 — Who is excepted from CASS on art. 155 alin. (1) lit. b) income, and on what ground?

**(a) art. 174 alin. (1) contains no exception at all.** It is a pure calculation rule; its cross-references are art. 155 alin. (1) lit. b), art. 68¹, art. 156, art. 170 alin. (1), art. 122. It does **not** cross-refer art. 153 alin. (2).

**(b) The pension relief is in art. 174 alin. (7), not alin. (1)**, and it keys on the **realisation of pension income in the fiscal year**, not on *calitatea de pensionar* and not on being insured in another system.

The four distinct "pension" levers in Titlul V that a single boolean conflates:

| Provision | Keys on | Switches off |
|---|---|---|
| **art. 174 alin. (7) lit. c)** | *fact*: pension income realised in the fiscal year (any amount) | only the *diferența de contribuție* under art. 174 alin. (6) |
| **art. 154 alin. (1) lit. h²)** | *calitatea de pensionari* | CASS **on pension income** up to 3.000 lei/month — not on independent-activity income |
| **art. 150 alin. (1)** | *calitatea de pensionari* | **CAS** on art. 137 alin. (1) lit. b) și b¹) income — a different contribution |
| **art. 153 alin. (2)** | insured for sickness/maternity in another EU/SEE/Elvețian or bilateral-agreement system, and proving it | CASS taxpayer quality altogether (a genuinely total exclusion, unrelated to pensions) |

Critically, **art. 154 alin. (2)** cuts the other way: a person inside the excepted categories of art. 154 alin. (1) lit. d)–ș) — which includes pensioners under lit. h²) — who realises *other* art. 155 alin. (1) incomes **owes CASS on them**.

### Verbatim

> **art. 174 alin. (1):** „Contribuția de asigurări sociale de sănătate se calculează de către contribuabilii care în anul fiscal pentru care se depune declarația prevăzută la art. 122 au realizat venituri din cele prevăzute la art. 155 alin. (1) lit. b), altele decât cele prevăzute la art. 68^1, prin aplicarea cotei de contribuție prevăzute la art. 156 asupra bazei anuale de calcul prevăzute la art. 170 alin. (1)."

> **art. 155 alin. (1) chapeau + lit. a²) și b):** „(1) Contribuabilii la sistemul de asigurări sociale de sănătate, prevăzuți la art. 153 alin. (1) lit. a)-d), datorează, după caz, contribuția de asigurări sociale de sănătate pentru veniturile din România și din afara României, cu respectarea legislației europene aplicabile în domeniul securității sociale, precum și a acordurilor privind sistemele de securitate socială la care România este parte, pentru care există obligația declarării în România, realizate din următoarele categorii de venituri: a) venituri din salarii și asimilate salariilor, definite conform art. 76; a^1) abrogată; a^2) venituri din pensii, definite conform art. 99; b) venituri din activități independente, definite conform art. 67; …"

> **art. 155 alin. (2):** „Pentru veniturile prevăzute la alin. (1) se datorează contribuția de asigurări sociale de sănătate și în cazul în care acestea sunt realizate de persoanele fizice aflate în situațiile prevăzute la art. 60, cu excepția pct. 6."

> **art. 156:** „Cota de contribuție de asigurări sociale de sănătate este de 10% și se datorează de către persoanele fizice care au calitatea de angajați sau pentru care există obligația plății contribuției de asigurări sociale de sănătate, potrivit prezentei legi."

> **art. 99 (cross-referenced by lit. c)):** „(1) Veniturile din pensii reprezintă sume primite ca pensii de la fondurile înființate din contribuțiile sociale obligatorii făcute către un sistem de asigurări sociale, inclusiv cele din fonduri de pensii facultative și cele finanțate de la bugetul de stat, diferențe de venituri din pensii, precum și sume reprezentând actualizarea acestora cu indicele de inflație. (2) Drepturile primite în conformitate cu prevederile Legii nr. 411/2004 privind fondurile de pensii administrate privat, … ale Legii nr. 204/2006 privind pensiile facultative, … și ale Legii nr. 1/2020 privind pensiile ocupaționale, … reprezintă venituri din pensii."

> **art. 154 alin. (1) lit. h¹), h²) și alin. (2):** „h^1) persoanele fizice care realizează venituri din salarii și asimilate salariilor și/sau venituri din pensii, pentru veniturile din drepturi de proprietate intelectuală; h^2) persoanele fizice care au calitatea de pensionari, pentru veniturile din pensii de până la suma de 3.000 lei lunar inclusiv, pentru care nu se datorează contribuția de asigurări sociale de sănătate; … (2) Persoanele fizice aflate în situațiile prevăzute la alin. (1) lit. d)-ș), dacă realizează venituri dintre cele prevăzute la art. 155 alin. (1), altele decât cele pentru care sunt exceptate, datorează contribuția de asigurări sociale de sănătate, conform regulilor specifice prezentului titlu."

> **art. 150 alin. (1) (CAS — the provision that *does* key on pensioner status):** „Persoanele fizice asigurate în sisteme proprii de asigurări sociale, care nu au obligația asigurării în sistemul public de pensii potrivit legii, precum și persoanele care au calitatea de pensionari nu datorează contribuția de asigurări sociale pentru veniturile prevăzute la art. 137 alin. (1) lit. b) și b^1)."

> **art. 153 alin. (2) (the "insured in another system" ground — separate from pensions):** „Persoanele prevăzute la alin. (1) lit. a)-d), care dețin o asigurare pentru boală și maternitate în sistemul de securitate socială din alt stat membru al Uniunii Europene, Spațiului Economic European și Confederația Elvețiană sau în statele cu care România are încheiate acorduri bilaterale de securitate socială cu prevederi pentru asigurarea de boală-maternitate, în temeiul legislației interne a statelor respective, care produce efecte pe teritoriul României, și fac dovada valabilității asigurării, în conformitate cu procedura stabilită prin ordin comun al președintelui A.N.A.F. și al Casei Naționale de Asigurări de Sănătate, nu au calitatea de contribuabil la sistemul de asigurări sociale de sănătate."

**Citation:** Legea 227/2015, **MO nr. 688 din 10.09.2015**, consolidat la legislatie.just.ro/Public/DetaliiDocument/171282 — art. 99; 150 alin. (1); 153 alin. (2); 154 alin. (1) lit. h¹)–h²) și alin. (2); 155 alin. (1)-(2); 156; 174 alin. (1). art. 155 alin. (1) lit. a²) and art. 154 alin. (1) lit. h²) introduced by **Legea 141/2025 art. II pct. 21 / pct. 18**, MO nr. 699 din 25.07.2025, în vigoare **01.08.2025**. **Confidence: Verified.**

---

## Q2 — What exactly does the exception remove?

**(b) — and only (b).** It removes **only the *diferență de contribuție* provided for in art. 174 alin. (6)**, i.e. the top-up bringing the base up to 6 salarii minime brute. The text settles it in its own opening words: *„Diferența de contribuție de asigurări sociale de sănătate **prevăzută la alin. (6)** nu se datorează…"*. It says nothing about alin. (1), nothing about art. 170 alin. (1), nothing about the declaration duty.

1. **The main CASS obligation survives.** art. 174 alin. (1) + art. 170 alin. (1) + art. 156 still produce CASS = 10 % × the cumulated net annual income (capped at 72 SM). A pensioner with a PFA net income of 60.000 lei in 2026 owes 6.000 lei CASS.
2. **What disappears is the floor.** Without alin. (7), a person whose cumulated art. 170 alin. (1) base is below 6 SM must pay up to the 6-SM level. With alin. (7) lit. c), that top-up is not owed and the base simply remains the actual realised net income / annual income norm.
3. **The filing duty is not removed.** art. 174 alin. (6) bundles the difference *and* the duty to file the Declarația unică „în termenul prevăzut la art. 122 alin. (3)"; art. 174 alin. (3) independently requires the declaration for all art. 155 alin. (1) lit. b) income. Only alin. (7)'s object — *diferența* — is disapplied.
4. **The threshold asymmetry is deliberate and material.** lit. a) and lit. b) each require the other income to be „la un nivel cel puțin egal cu 6 salarii minime brute pe țară". **lit. c) has no such qualifier** — any quantum of pension income realised in the year triggers it.

### Verbatim

> **(6)** „În situația în care baza de calcul prevăzută la art. 170 alin. (1), cumulată din una sau mai multe surse de venit din cele prevăzute la art. 155 alin. (1) lit. b), corespunzătoare veniturilor realizate sau pentru care s-a aplicat reținerea la sursă în cursul anului, după caz, este mai mică decât cea corespunzătoare unei baze de calcul egale cu nivelul de 6 salarii minime brute pe țară, persoanele fizice datorează contribuția de asigurări sociale de sănătate, respectiv o diferență de contribuție de asigurări sociale de sănătate, după caz, până la nivelul celei corespunzătoare bazei de calcul egale cu 6 salarii minime brute pe țară și depun Declarația unică privind impozitul pe venit și contribuțiile sociale datorate de persoanele fizice în termenul prevăzut la art. 122 alin. (3)."
>
> **(7)** „Diferența de contribuție de asigurări sociale de sănătate prevăzută la alin. (6) nu se datorează în cazul în care, în anul fiscal pentru care se depune declarația prevăzută la art. 122, persoana fizică a realizat venituri: a) din salarii și asimilate salariilor la un nivel cel puțin egal cu 6 salarii minime brute pe țară; sau b) din cele prevăzute la art. 155 alin. (1) lit. c)-h), pentru care datorează contribuția de asigurări sociale de sănătate la un nivel cel puțin egal cu 6 salarii minime brute pe țară. c) venituri din pensii, definite conform art. 99."
>
> **(8)** „Prevederile alin. (7) se aplică și persoanelor fizice care în anul precedent: a) s-au încadrat în categoriile de persoane exceptate de la plata contribuției de asigurări sociale de sănătate prevăzute la art. 154 alin. (1) lit. a), b), e) și f); b) au optat pentru plata contribuției de asigurări sociale de sănătate potrivit art. 180 alin. (1)."

Note the drafting artefact: the chapeau already says „a realizat venituri:", and lit. c) repeats the word „venituri". Note also that **alin. (8) lit. a) does not list pensioners** — only art. 154 alin. (1) lit. a), b), e) și f) (children/students, youth from the child-protection system, persons with disabilities for Law 448/2006 income, oncology patients).

**Citation:** art. 174 alin. (6)-(8), legislatie.just.ro/Public/DetaliiDocument/171282. alin. (7) completed with lit. c) by **Legea 141/2025 art. II pct. 34**, MO nr. 699/25.07.2025, în vigoare **01.08.2025**, application: „prevederile art. II pct. 34 și 35 se aplică începând cu veniturile anului 2025 pentru care termenul de declarare este până la data de 25 mai 2026" — Legea 141/2025 art. VII alin. (1) lit. f), as amended by **OUG 22/2025 art. VI**, MO nr. 806/29.08.2025. alin. (8) lit. a) amended by pct. 35, same dates. **The pension ground is already operative for FY2025 (declared by 25 May 2026) and for FY2026. Confidence: Verified.**

---

## Q3 — Does the exception depend on the pension being received in the fiscal year?

- **Must pension income be actually received? Yes — Verified.** The chapeau requires that „în anul fiscal pentru care se depune declarația … persoana fizică **a realizat venituri**: … c) venituri din pensii, definite conform art. 99". art. 99 alin. (1) defines pension income as „**sume primite ca pensii**". Realisation = receipt in that fiscal year.
- **Is being a pensioner at some point in the year enough? No — Verified.** Nothing in alin. (7) refers to status. The only status-based extension of alin. (7) is alin. (8), whose list **excludes pensioners**. Conversely art. 154 alin. (2) confirms a pensioner who realises other art. 155 incomes „datorează contribuția de asigurări sociale de sănătate, conform regulilor specifice prezentului titlu".
- **Pension suspended while active? UNVERIFIED as an express rule.** No Cod fiscal, HG 1/2016 or OPANAF 2.736/2025 provision addresses suspension in connection with art. 174 alin. (7). The textual logic points to the relief being lost for a year in which no pension sums were paid, but **no primary text states this**, and Legea 263/2010 / 267/2010 were not verified here. **Do not encode a suspension rule as settled law.**
- **Partial-year receipt:** the text is binary; it does not prorate. **Verified** as to the absence of proration language; **UNVERIFIED** as to administrative practice on one-month receipt.

**Citation:** art. 174 alin. (7)-(8), art. 99 alin. (1), art. 154 alin. (2). **Confidence: Verified** for the receipt requirement and "status alone is not enough"; **UNVERIFIED** for suspension.

---

## Q4 — Interaction with the 6-SM floor and the 72-SM ceiling — and the SM vintage

**Excepted person:** the 6-SM difference **does not arise**; the base remains the cumulated net annual income / norm as actually determined under art. 170 alin. (1); CASS = 10 % × that actual base. ANAF's 2026 material states the same mechanic: the base is 6 SM when realised net income is below 6 SM, *except* in the listed situations „în care baza de calcul rămâne venitul net anual realizat/norma anuală de venit, ajustată după caz".

**Non-excepted person:** the 6-SM floor bites as a *diferență de contribuție*, and the 72-SM ceiling applies **to the base, not to turnover**. Fiscal losses under art. 118 are not taken into account when determining the base.

**Which minimum-wage value applies for FY2026 — Verified, and this closes research 24's gap:**

> **art. 135¹ alin. (3):** „În aplicarea prevederilor art. 148, 151, 170, 174 și 174^1, la verificarea încadrării venitului în plafoanele anuale, precum și la stabilirea bazei anuale de calcul al contribuției de asigurări sociale, respectiv al contribuției de asigurări sociale de sănătate datorate se ia în calcul valoarea salariului minim brut pe țară stabilit prin hotărâre a Guvernului, **în vigoare la data de 1 ianuarie a anului de realizare a venitului** pentru care se stabilesc contribuțiile sociale, indiferent dacă în cursul aceluiași an se utilizează mai multe valori ale salariului minim brut pe țară."

For 2026 that is **4.050 lei** (HG 1.506/2024), notwithstanding HG 146/2026 raising SM to 4.325 lei from 1 iulie 2026. Hence FY2026: **6 SM = 24.300 lei**, **12 SM = 48.600 lei**, **24 SM = 97.200 lei**, **72 SM = 291.600 lei** (confirmed by ANAF: „nu poate fi mai mare de 291.600 lei (72 x 4.050 lei)").

> **art. 170 alin. (1):** „Persoanele fizice care în anul fiscal pentru care se depune declarația prevăzută la art. 122 au realizat venituri din cele prevăzute la art. 155 alin. (1) lit. b), din una sau mai multe surse, datorează contribuția de asigurări sociale de sănătate la o **bază anuală de calcul** egală cu suma rezultată prin cumularea venitului net anual realizat/brut sau normei anuale de venit, respectiv a normei anuale de venit ajustate, după caz, stabilite potrivit art. 68, 68^1, 68^3 și 69, după caz, **care nu poate fi mai mare decât cea corespunzătoare unei baze anuale de calcul egale cu nivelul de 72 de salarii minime brute pe țară**. La determinarea bazei anuale de calcul al contribuției de asigurări sociale de sănătate nu se iau în considerare pierderile fiscale anuale prevăzute la art. 118."

**Citation:** art. 170 alin. (1), art. 174 alin. (6), art. 135¹ alin. (3) — legislatie.just.ro/Public/DetaliiDocument/171282. art. 135¹ alin. (3) as amended by **OUG 128/2024 art. I pct. 19**, MO nr. 1125/11.11.2024, aplicabil veniturilor din **2025**. HG 1.506/2024 (MO 1185/28.11.2024, 4.050 lei de la 01.01.2025); HG 146/2026 (MO 196/13.03.2026, 4.325 lei de la 01.07.2026 — does **not** change FY2026 thresholds). ANAF DGRFP Brașov, ianuarie 2026: `static.anaf.ro/static/10/Brasov/Brasov/web_ian_2026.pdf`. **Confidence: Verified.**

---

## Q5 — What changed for FY2026

- **Legea 239/2025 art. XII pct. 19** amends **art. 170 alin. (1)** and **art. 170 alin. (4) lit. c)** — the ceiling goes **60 → 72 salarii minime brute**; the alin. (4) lit. c) change is a wording change.
- **pct. 20** amends **art. 174 alin. (4), (5) și (11)** only — 60 → 72 SM in the sports-contract rules and the recalculation rule.
- **Effective dates:** both carry the consolidated marker **01-01-2026**, and the operative rule is **art. XIII alin. (2) lit. b)**: „prevederile art. XII pct. 3 - 11, 16 și 18 - 20 se aplică **începând cu veniturile aferente anului 2026**". The 72-SM ceiling governs FY2026 income (declared in the D212 due 25 May 2027).
- **Did any 2026 change touch the pension exception? No — Verified.** The consolidated record for art. 174 shows exactly six amendment markers: alin. (4), (5), (11) at 01-01-2026 (Legea 239/2025 pct. 20); alin. (7) and alin. (8) lit. a) at 01-08-2025 (Legea 141/2025 pct. 34, 35); the whole article at 01-01-2025 (OUG 128/2024 pct. 23). **art. 174 alin. (7) lit. c) is unchanged for 2026.**
- **Did OUG 8/2026 touch art. 170 or art. 174? No — Verified.** OUG nr. 8/2026, MO nr. 147/25.02.2026, amends the Cod fiscal via its art. 6; the consolidated code contains **116** markers citing that act and **none falls inside the art. 170 or art. 174 blocks**. ANAF's before/after table for Titlul IV + V lists no change to either.
- **Related but not FY2026:** **art. 220⁸ alin. (4)** (Legea 141/2025 art. II pct. 40) — „Persoanele fizice care au calitatea de pensionari sunt exceptate de la plata contribuției sociale de sănătate pentru veniturile din pensii realizate începând cu data de 1 ianuarie 2028." Status-based, but concerns **pension income**, only from **2028**. Not FY2026, not independent-activity income.

**Citation:** Legea 239/2025 — legislatie.just.ro/Public/DetaliiDocument/305208; `static.anaf.ro/static/10/Anaf/legislatie/L_239_2025.pdf`; ANAF tables `titl_V_cf.pdf` and `legea_227_IV.pdf`. **Confidence: Verified.**

---

## Q6 — What evidence may the authority require, and does any text name the document?

**No primary text names a document proving the art. 174 alin. (7) lit. c) exception.** Full-text search of the consolidated Cod fiscal and of consolidated HG 1/2016 returns **zero occurrences of „certificat de pensionare"**. There is **no box, checkbox, annex or section in the D212 model (OPANAF 2.736/2025)** where a pensioner declares pension income to escape the 6-SM difference on independent-activity CASS. What the primary texts do provide:

1. **art. 154 alin. (3)** — CNAS transmits to ANAF the list of persons registered in the single register of insured persons (concerns art. 154 categories, not the alin. (7) pension ground).
2. **art. 153 alin. (2)** — the only place in Titlul V requiring the taxpayer to „facă dovada" of something, and that is proof of **foreign** sickness/maternity insurance, per a joint ANAF/CNAS order. Not pensions.
3. **art. 174 alin. (13)** — the only document-producing duty tied to the alin. (6) difference, and it concerns **CASS withheld by art. 68¹ alin. (2) payers** (sports contracts). Nothing about pensions.
4. **D212 (OPANAF 2.736/2025), Capitolul I, Secțiunea a 3-a, Subsecțiunea 2.1** — „CASS datorată pentru veniturile din activități independente prevăzute la art.155 alin.(1) lit.b) din Codul fiscal". Rows: rd. 1 Total venit anual cumulat … potrivit art.170 alin. (1); rd. 2 Bază anuală de calcul al CASS; rd. 3 CASS anuală (rd.2 x 10%); rd. 4 CASS datorată ca urmare a exercitării opțiunii potrivit art.180 alin.(2); rd. 5 CASS datorată (rd.3 - rd.4 sau cifra „0"); rd. 6 CASS reținută de plătitorul de venit conform art.174 alin.(10) și alin.(11); rd. 7 Diferența stabilită în plus (rd.5 - rd.6); rd. 8 Diferența stabilită în minus (rd.6 - rd.5). **No pension row, no pension checkbox.** The only pension-specific area is **Subsecțiunea 3**, „Date privind contribuția de asigurări sociale de sănătate datorată de persoanele fizice care obțin **din străinătate** venituri din pensii", with „Se înscrie baza lunară de calcul al CASS, respectiv partea care depășește suma lunară de 3000 lei."
5. **UNVERIFIED:** whether ANAF may demand a certificat de pensionare / adeverință in a control, and under which general power.

> **art. 154 alin. (3):** „În vederea încadrării în condițiile privind realizarea de venituri prevăzute la alin. (1), Casa Națională de Asigurări de Sănătate transmite A.N.A.F. lista persoanelor fizice înregistrate în Registrul unic de evidență al asiguraților din Platforma informatică din asigurările de sănătate, potrivit prevederilor art. 224 alin. (1) din Legea nr. 95/2006 privind reforma în domeniul sănătății, republicată. …"
>
> **art. 174 alin. (13):** „Plătitorii de venituri prevăzuți la art. 68^1 alin. (2) au obligația de a elibera persoanelor fizice beneficiare de astfel de venituri, până în ultima zi a lunii februarie inclusiv a anului curent, pentru anul precedent, un document cu privire la nivelul contribuției de asigurări sociale de sănătate reținute la sursă, în vederea stabilirii de către aceștia a diferenței de contribuție de asigurări sociale de sănătate, prevăzută la alin. (6) sau (11), după caz."
>
> **OPANAF 2.736/2025 art. 3:** „Formularul prevăzut la art. 1 se utilizează de persoanele fizice pentru declararea impozitului pe veniturile realizate și a contribuțiilor sociale datorate începând cu anul 2025, precum și pentru declararea contribuției de asigurări sociale de sănătate datorate de către persoanele fizice care optează pentru plata contribuției, începând cu anul 2026."

**Citation:** OPANAF nr. 2.736/2025, MO nr. 1207/29.12.2025 (anexele în MO 1207 **bis**) — `static.anaf.ro/static/10/Anaf/formulare/D_212_2736_2025.pdf`, `Anexa_D212_2736_2025.pdf`, legislatie.just.ro/Public/DetaliiDocument/305848. HG 1/2016 consolidat — legislatie.just.ro/Public/DetaliiDocument/300083. **Confidence: Verified** for the absence of a named document and of a D212 pension box; **UNVERIFIED** for audit practice.

---

## What the app may switch off, and for whom

- **Trigger fact:** during the fiscal year for which the Declarația unică is filed (FY2026: 1 ianuarie – 31 decembrie 2026), the taxpayer **received at least one sum as a pension** — i.e. realised *venituri din pensii* within art. 99 (public system, pillar II, facultative pillar III, occupational pensions, pension differences and their inflation indexation). **Amount is irrelevant**; there is no 6-SM qualifier on lit. c), unlike lit. a) and b).
- **Switched off:** **only** the *diferență de contribuție* that art. 174 alin. (6) would impose to bring the base up to **6 SM = 24.300 lei for FY2026**.
- **NOT switched off:** CASS = **10 %** (art. 156) on the **actual** cumulated base under art. 170 alin. (1), **capped at 72 SM = 291.600 lei for FY2026**; the duty to file the Declarația unică (art. 174 alin. (3), and alin. (6) for the difference mechanism); CAS; impozit pe venit; everything else.
- **Net effect for an excepted taxpayer:** base = actual net income even below 6 SM; CASS = 10 % × that base; no top-up.
- **The ceiling applies to the base, never to turnover/încasări.**
- **SM value:** the value in force on **1 January of the income year** (art. 135¹ alin. (3)) — **4.050 lei for FY2026**, notwithstanding 4.325 lei from 1 iulie 2026.
- **Separately modelled relief routes that may apply to the same person:**
  - **art. 174 alin. (2)** — fiscal loss or net income equal to zero ⇒ no CASS under art. 170 alin. (1); may opt under art. 180 alin. (1). (Unresolved tension with the alin. (6) floor — see Gaps.)
  - **art. 174 alin. (8)** — alin. (7) relief also extends to persons who **in the previous year** were in art. 154 alin. (1) lit. a), b), e) or f), or had opted under art. 180 alin. (1). **Pensioners are not in that list.**
  - **art. 150 alin. (1)** — pensioner status removes **CAS**. The only place in this area where a status boolean is the correct key.
  - **art. 154 alin. (1) lit. h²)** — pensioner status removes CASS **on pension income** up to 3.000 lei/month; from **1 ianuarie 2028** (art. 220⁸ alin. (4)) unconditional for pension income. Neither touches independent-activity CASS in FY2026.

## What the app must not do
1. **Do not switch CASS off entirely for a pensioner.** Only the art. 174 alin. (6) *diferența* is disapplied. Suppressing 10 % × art. 170 alin. (1) is unsupported and understates the liability.
2. **Do not key the relief on *calitatea de pensionar*.** Key on realised pension income in the fiscal year. A pensioner who received no pension sums that year does not qualify under lit. c); a person who was not a pensioner all year but received pension sums in it does.
3. **Do not treat a boolean as sufficient evidence.** No primary text names a proving document and the D212 has no box for it. The underlying fact (pension sums received, and in which year) must be recorded.
4. **Do not require the pension to reach 6 SM.** Only lit. a) and lit. b) carry that condition; applying it to lit. c) would be an invented rule.
5. **Do not import the art. 154 alin. (1) excepted categories into art. 174 alin. (7).** alin. (8) lit. a) references only art. 154 alin. (1) lit. a), b), e), f) — and only for the *previous year*.
6. **Do not let art. 154 status extinguish CASS on independent-activity income** — art. 154 alin. (2) expressly preserves it.
7. **Do not apply the 72-SM cap to revenue, and do not use the 1 iulie 2026 SM (4.325 lei) for FY2026 thresholds.**
8. **Do not apply the 1 ianuarie 2028 pensioner exception (art. 220⁸ alin. (4)) to FY2026**, nor to independent-activity income.
9. **Do not rely on the ANAF ianuarie 2026 slide's exception list** — it recites the superseded art. 174 alin. (8) lit. a) wording and omits pensions.

## What fact the input model must actually hold
- **Whether, and in which fiscal year, the person received sums as a pension** — the receipt event, year-attributable, not a permanent status flag. This is the fact art. 174 alin. (7) lit. c) tests.
- **Quantum is not needed for the trigger** — only the existence of at least one pension receipt in the year. Quantum is needed separately for the pension-income CASS line (3.000 lei/month, art. 157⁶), a different computation.
- **Pensioner status as a separate, independently recorded fact** — it drives CAS (art. 150 alin. (1)) and pension-income CASS (art. 154 alin. (1) lit. h²), and from 2028 art. 220⁸ alin. (4)), not independent-activity CASS.
- **Whether the person was, in the previous year, in art. 154 alin. (1) lit. a), b), e) or f), or had opted under art. 180 alin. (1)** — the separate alin. (8) route.
- **Whether the person holds valid sickness/maternity insurance in another EU/SEE/Elvețian or bilateral-agreement system and has proved it** — the art. 153 alin. (2) route, which *does* remove CASS taxpayer quality entirely.
- **Whether pension payments were suspended, and for which months** — record the fact, not a derived legal conclusion (UNVERIFIED above).
- **The fiscal year each fact belongs to** — alin. (7) is year-scoped, alin. (8) previous-year-scoped.

## Sources
**Kept:** legislatie.just.ro/Public/DetaliiDocument/171282 (Cod fiscal consolidat — art. 99, 135¹, 150, 153, 154, 155, 156, 170, 174, 220⁸ verbatim + amendment history); `/Public/DetaliiDocumentAfis/171282` (confirms the unconsolidated text must not be used — its art. 155 lettering is the 2015 numbering); Legea 239/2025 `/Public/DetaliiDocument/305208` + `static.anaf.ro/static/10/Anaf/legislatie/L_239_2025.pdf`; ANAF Brașov `titl_V_cf.pdf`, `legea_227_IV.pdf`, `web_ian_2026.pdf` (kept with the caveat in "must not do" #9); OPANAF 2.736/2025 `D_212_2736_2025.pdf`, `Anexa_D212_2736_2025.pdf`, `/Public/DetaliiDocument/305848`; HG 1/2016 consolidat `/Public/DetaliiDocument/300083`; OUG 128/2024 `static.anaf.ro/static/10/Anaf/legislatie/OUG_128_2024.pdf`; HG 146/2026 and HG 1.506/2024 (mmuncii.gov.ro / infodosar.ro); legislatie.info per-article pages as a convenience mirror, every quotation re-verified against legislatie.just.ro.
**Dropped:** GhidFiscal.ro, NoulCodFiscal.ro, PortalCodulFiscal.ro, Lege5.ro, Wolters Kluwer, Caută.ro, LegeAZ (secondary mirrors); PwC România, VTA/Topor & Baniș, CabinetExpert.ro, Universul Juridic/Universul Fiscal (professional syntheses); ANAF `VenPensiiChirii2025.pdf` (pension/rent CASS, tangential); ANAF `Brosura_Declaratia_Unica_212_2025.pdf` (general brochure); Ministerul Muncii *Nota de fundamentare* HG 146/2026 (policy memo, not operative law); SGG draft `NF-64.pdf` (2018, superseded).

## Gaps
1. **Pension suspension while active** — no Cod fiscal / HG 1/2016 / OPANAF provision addresses it for art. 174 alin. (7). Next: Legea 263/2010 / 267/2010 on *suspendarea pensiei la cerere*, and whether a suspended month produces any „sumă primită ca pensie".
2. **art. 174 alin. (2) vs alin. (6)** — a taxpayer with a fiscal loss or zero net income „nu datorează contribuția … potrivit art. 170 alin. (1)", yet alin. (6) speaks of a base „corespunzătoare veniturilor realizate" below 6 SM. The code does not say whether the 6-SM difference survives a zero/loss year. Next: ANAF îndrumări / NCN decisions; **do not resolve by inference**.
3. **Evidence ANAF may demand** — no primary text names a document. Next: the joint ANAF/CNAS order contemplated by art. 154 alin. (3) and art. 153 alin. (2), and ANAF control instructions.
4. **The D212 model for FY2026 income** — OPANAF 2.736/2025 covers incomes from 2025 (and the 2026 CASS option); its footnotes still recite 60 SM. A new OPANAF order will govern the D212 filed by 25 May 2027. Re-check before implementing the FY2026 return layout.
5. **HG 1/2016 alignment with the post-2025 CASS regime** — the consolidated norms still contain pre-2025 constructs (estimated declarations, „plafon recalculat pe luni", examples referencing 12 SM). Treat norm text in this area as **Partially verified / possibly stale**.
