# 20 — CF art. 66: the rounding rule · CF art. 154: who is actually exempt from CASS

**Researcher session:** `rounding-cass-exempt-researcher` (20m 15s), 2026-10-08.
**Scope given:** two questions only — (1) the legal rounding tie-break for Declarația Unică amounts, which is
Phase 10's entry criterion and which we **refused to invent**; (2) **CF art. 154 alin. (1)**, the CASS exemption
article that has **never been retrieved in any source of record in this project** and which sits behind the app's
`socialInsuranceStatus: 'exempt' | 'neplata'` flag (**B-19**, the highest-priority open fiscal defect).

**Status of this file:** the session's output was **truncated mid-quote at art. 174 alin. (8)**. The session has been
resumed with only that cut point and an explicit instruction to run **no new searches**. The remainder is appended
below when it lands. **Everything here is what the researcher actually returned — nothing is reconstructed.**

---

## HEADLINE — Q1: the rounding rule exists, and it is not the one anyone would have guessed

> **Codul fiscal art. 66 „Stabilirea sumelor fixe":**
> **„Sumele sunt calculate prin rotunjire la un leu, prin neglijarea fracțiunilor de până la 50 de bani inclusiv și
> majorarea la leu a fracțiunilor ce depășesc 50 de bani."**
> — Codul fiscal (Legea nr. 227/2015), **Titlul IV, Capitolul I (dispoziții generale)**, consolidated text, Portal
> Legislativ **doc 312601**. **CONFIRMED** — verbatim from primary consolidated text.

**Three things about this matter more than the sentence itself.**

**1. It rounds to a LEU, not to a ban.** The whole project has been reasoning in two decimals. For the income tax
under Titlul IV the legal unit is **the whole leu**. That is a bigger change to the money model than B-17 assumed.

**2. The tie-break is half-DOWN at exactly 50 bani** — „până la 50 de bani **inclusiv**". Neither half-up nor
half-even. A tie at exactly `.50` goes **down**.

**3. The seeded case is not a tie.** `674.505` lei → fracțiune **50,5 bani**, which *exceeds* 50 → **675 lei**.
So B-17's famous half-cent resolves to **675**, and it resolves *because of the arithmetic*, not because of a
convention we chose. A true tie at `674.50` would give **674**.

**Applied to the two formatters that currently disagree:** `Intl.NumberFormat('ro-RO')` → `674,51` and `toFixed(2)`
→ `674,50` are **both wrong**, because both are rounding to bani. The legal answer is neither.

**Amendment note printed under art. 66** (quoted as printed, no count reported):
> „(la 24-12-2020, Articolul 66 din Capitolul I , Titlul IV a fost modificat de Punctul 29, Articolul I din LEGEA nr.
> 296 din 18 decembrie 2020, publicată în MONITORUL OFICIAL nr. 1269 din 21 decembrie 2020 )"

Art. 66 is the **last article of Capitolul I al Titlului IV**, immediately followed by „Capitolul II Venituri din
activități independente", and is **not marked Abrogat** in the 08.08.2026 consolidation.

---

## Q1 — the exhaustive negative search that makes art. 66 the only candidate

**CF doc 312601**, consolidation with amendment notes through **08-08-2026**, body rendered, **2,535,020 chars** of
`innerText`. Case-insensitive search of the whole body with article attribution:

| exact string | hits | article(s) |
|---|---|---|
| `rotunj` | **5** | 66, 77, 300, 315⁴, 342 |
| `rotunje` | 3 | 77, 300, 342 (subset) |
| `zecimale` | **1** | 342 |
| `sute de bani` | **0** | — |
| `prin lipsire` | **0** | — |
| `0,01` | **1** | 474 (urbanism tax table, `14 + 0,01 lei/mp`) |
| `neglij` | 2 | 66 (×2, same sentence) |

**All five `rotunj` hits, verbatim** — note that each is domain-specific, and only art. 66 is general:

1. **Art. 66** — the operative rule, quoted above.
2. **Art. 77 alin. (8)** (personal deduction, not money): „Perioada se rotunjește la luni întregi în favoarea
   contribuabilului."
3. **Art. 300 alin. (8)** (TVA pro rata): „Pro rata definitivă se determină procentual și se rotunjește până la cifra
   unităților imediat următoare."
4. **Art. 315⁴ alin. (2)** (TVA reverse-charge thresholds): „Rotunjirea se face la leu, prin majorare, când fracțiunea
   este egală sau mai mare de 50 de bani, și prin reducere, când fracțiunea este mai mică decât 50 de bani."
   → **Note the contrast: art. 315⁴ rounds `.50` UP; art. 66 rounds `.50` DOWN.** Same country, same currency,
   opposite tie-break, different domain. This is why a convention could not be guessed.
5. **Art. 342 alin. (4)** (accise): „Nivelul în lei al accizelor … se rotunjește la nivel de două zecimale, prin
   reducere, atunci când a treia zecimală este mai mică decât 5, și prin majorare atunci când a treia zecimală este
   mai mare sau egală cu 5."

**Negative result, stated precisely:** `rotunj` → **0 hits in Titlul I** and **0 hits in Titlul V (CASS)**.
**There is no rounding provision for CAS or CASS anywhere in Codul fiscal.**

### (b) CPF — and a correction to my own brief

**The brief was wrong about the doc id.** I gave the researcher **265498** as the Codul de procedură fiscală. It is
not: it renders as `LEGE 52 03/03/2023`, an empty 1,739-char shell, empty even with `?isFormaDeBaza=True`.
**The CPF is Legea nr. 207/2015; current consolidation = doc id 305984** (body rendered, 1,595,105 chars).

| exact string | hits |
|---|---|
| `rotunj` | **0** |
| `zecimale` | **0** |
| `sute de bani` | **0** |
| `prin lipsire` | **0** |
| `neglij` | 1 (art. 286 „neglijențe" — a data-security definition, irrelevant) |

→ **CONFIRMED: the CPF contains no rounding rule for tax liabilities / creanțe fiscale.**

### (c) Ordinul ANAF approving the DU 212 model in force for 2026 — CONFIRMED

**Ordinul președintelui A.N.A.F. nr. 2.736 din 23 decembrie 2025**, publicat în **MO nr. 1207 din 29 decembrie 2025**
(anexele în **MO nr. 1207 bis**). Portal Legislativ **doc id 305848**.
Art. 3: „Formularul prevăzut la art. 1 se utilizează de persoanele fizice pentru declararea impozitului pe veniturile
realizate și a contribuțiilor sociale datorate începând cu anul 2025, precum și pentru declararea contribuției de
asigurări sociale de sănătate datorate de către persoanele fizice care optează pentru plata contribuției, începând cu
anul 2026."

- Instrucțiuni de completare: `static.anaf.ro/static/10/Anaf/formulare/Instructiuni_D212_2736_2025.pdf` (46 pp,
  197,097 chars extracted)
- Model formular: `static.anaf.ro/static/10/Anaf/formulare/D_212_2736_2025.pdf`

**Negative results, two independent passes over the extracted text:**
`zecimale` → **0**; `rotunj` → **0**; `sute de bani` → **0**; `circa` → **0**; `format` → 2 (both „format letric" /
„format hârtie", i.e. filing method, not number format). In the form PDF: `zecimale` → **0**, `rotunj` → **0**.
Footnote text for the superscripts `1)` `2)` `3)` on the „Impozit anual datorat" and CASS rows → **NOT FOUND**
(extraction limitation, **not** proof of absence).

**There is no rounding sentence in the instructions.** The only format language is „se înscrie suma (**în lei**) …",
e.g. instrucțiuni §39.6.8: „Rd.8 „Impozit pe venit datorat în România" – se înscrie suma (în lei) rezultată prin
aplicarea cotei de impozitare prevăzute de lege asupra sumei înscrise la rd. 7."

### (d) ANAF broșură DU 212

`static.anaf.ro/static/10/Anaf/AsistentaContribuabili_r/Brosura_Declaratia_Unica_212_2025.pdf` — `rotunj` → **0**,
`zecimale` → **0**, `sute de bani` → **0**, `lei` → 3 (currency-conversion only). **No rounding statement.**

### (e) Per-amount vs total; declarare vs stabilire vs plată

- **Art. 66 is per-sum** („Sumele sunt calculate prin rotunjire la un leu") and sits in **Titlul IV Capitolul I**, so
  it governs the ***stabilirea*** of the sums under Titlul IV — **CONFIRMED as text**. Its extension to the *value
  entered in the form* is an **inference → PARTLY CONFIRMED**: no primary text says the amount entered on the DU is
  the rounded amount.
- **No separate rule found for CAS/CASS** (0 hits in Titlul V) → **NOT FOUND**.
- **Plată** (ordin de plată / decizie de impunere): no rounding provision in the CPF (0 hits) → **NOT FOUND**.

### (f) The form field format — a hard constraint independent of the rounding rule

**CONFIRMED from the approved model:** every monetary field is labelled **`(lei)`** — „9. Impozit anual
datorat/Impozit pe venit datorat (rd.7 x 10% sau rd.8 x 10%) 3)" `(lei)`; „3. CASS anuală (rd.2 x 10%)"; „5. CASS
datorată (rd.3 – rd.4 sau cifra „0", după caz) 2)"; „Baza lunară de calcul al CASS 2) `(lei)`"; „CASS datorată
`(lei)`". **No „cu 2 zecimale" anywhere.** Combined with art. 66, the model constraint is **integer lei for the
income tax**. Whether the ANAF web form (`anaf.ro/declaratii/duf`) validates integers or accepts 2 decimals →
**NOT CHECKED**.

### (g) Pending changes

**No pending change found** to the DU 212 model or to CF rounding. The researcher did **not** query the
Camera/Senat registries, so this is *unsearched*, not *absent*.

One **in-force** (not pending) change that alters the payable amount on the 2026 DU — **OUG nr. 8 din 24 februarie
2026, MO nr. 147 din 25 februarie 2026, Articolul 8**: „Prin derogare de la dispozițiile art. 121 din Legea nr.
227/2015, contribuabilii persoane fizice beneficiază de o bonificație de 3% din impozitul pe venit datorat pentru
veniturile realizate în anul 2025…" and „(3) Bonificația se determină de contribuabil și se evidențiază în mod
distinct în declarația unică… Impozitul pe venit de plată se determină prin diminuarea acestuia cu valoarea
bonificației." **No rounding rule is stated for the bonificație** (`rotunj` → 0 hits in the whole OUG).

---

## Q2 — CF art. 154, retrieved at last

Printed title: **„Articolul 154 — Categorii de persoane fizice exceptate de la plata contribuției de asigurări
sociale de sănătate"** (Titlul V, Capitolul III, Secțiunea 1). Article span **11,755 chars** in the consolidated body
of doc 312601. **Art. 154 has only alin. (1), (2) and (3)** — no alin. (4)+.

### (a) Verbatim, all alineate

> **(1) Următoarele categorii de persoane fizice sunt exceptate de la plata contribuției de asigurări sociale de
> sănătate:**
> **a)** copiii până la vârsta de 18 ani, tinerii de la 18 ani până la vârsta de 26 de ani, dacă sunt elevi, …
> studenții-doctoranzi, precum și persoanele care urmează modulul instruirii individuale … **„Dacă realizează venituri
> din cele prevăzute la art. 155 alin. (1) lit. a), b) și f), pentru aceste venituri datorează contribuție, conform
> regulilor specifice prezentului titlu;"**
> **b)** tinerii cu vârsta de până la 26 de ani care provin din sistemul de protecție a copilului. *[same carve-out
> sentence verbatim]*
> **c)** abrogată; **d)** abrogată;
> **e)** persoanele cu handicap, pentru veniturile obținute în baza Legii nr. 448/2006, republicată, cu modificările
> și completările ulterioare;
> **f)** bolnavii cu afecțiuni oncologice beneficiari de programe naționale de sănătate, până la vindecarea respectivei
> afecțiuni, în condițiile prevăzute de Legea nr. 293/2022 pentru prevenirea și combaterea cancerului, cu
> modificările și completările ulterioare;
> **g)** femeile însărcinate și lăuzele;
> **h)** abrogată;
> **h¹)** persoanele fizice care realizează venituri din salarii și asimilate salariilor și/sau venituri din pensii,
> pentru veniturile din drepturi de proprietate intelectuală;
> **h²)** persoanele fizice care au calitatea de pensionari, pentru veniturile din pensii de până la suma de **3.000 lei
> lunar inclusiv**, pentru care nu se datorează contribuția de asigurări sociale de sănătate;
> **i)** persoanele fizice care se află în concedii medicale pentru incapacitate temporară de muncă, acordate în urma
> unor accidente de muncă sau unor boli profesionale, în baza Legii nr. 346/2002 …, pentru care indemnizațiile nu sunt
> cuprinse în categoriile de venituri supuse contribuției de asigurări sociale de sănătate potrivit art. 155 alin. (1)
> lit. i), pentru indemnizațiile aferente certificatelor medicale;
> **j)** abrogată; **k)** abrogată; **l)** abrogată;
> **m)** persoanele care execută o pedeapsă privativă de libertate sau se află în arest preventiv …;
> **n)** străinii aflați în centrele de cazare în vederea returnării ori expulzării, precum și pentru cei care sunt
> victime ale traficului de persoane …;
> **o)** abrogată;
> **p)** persoanele cetățeni români, care sunt victime ale traficului de persoane, pentru o perioadă de cel mult 12 luni.
> **q)** voluntarii care își desfășoară activitatea în cadrul serviciilor de urgență voluntare, în baza contractului de
> voluntariat …
> **r)** abrogată; **s)** abrogată;
> **ș)** donatorii de celule stem hematopoietice care au donat pentru un pacient neînrudit sau înrudit, pentru o
> perioadă de 10 ani de la donare.
>
> **(2) Persoanele fizice aflate în situațiile prevăzute la alin. (1) lit. d)-ș), dacă realizează venituri dintre cele
> prevăzute la art. 155 alin. (1), altele decât cele pentru care sunt exceptate, datorează contribuția de asigurări
> sociale de sănătate, conform regulilor specifice prezentului titlu.**
>
> **(3) În vederea încadrării în condițiile privind realizarea de venituri prevăzute la alin. (1), Casa Națională de
> Asigurări de Sănătate transmite A.N.A.F. lista persoanelor fizice înregistrate în Registrul unic de evidență al
> asiguraților din Platforma informatică din asigurările de sănătate, potrivit prevederilor art. 224 alin. (1) din
> Legea nr. 95/2006 privind reforma în domeniul sănătății, republicată. …**

### (b) Automatic vs conditional

- **Automatic on status alone:** lit. a) (with the express carve-out), b), g), m), n), p), q), ș).
- **Conditional on the *type of income*:** lit. e) (only Legea 448/2006 income), f) (only the oncology-program
  context), h¹) (only drepturi de proprietate intelectuală, and only if the person also has salary and/or pension
  income), i) (only the specified medical-leave indemnities).
- **Conditional on a *threshold*:** **lit. h²)** — pensioners, pension income „de până la suma de **3.000 lei lunar
  inclusiv**".
- **Anti-double-exemption — alin. (2):** a person in lit. d)-ș) who realises *other* art. 155 alin. (1) income **still
  owes CASS on it**.

### (c) Thresholds and their legal units

- **Art. 154 alin. (1) lit. h²)** — **3.000 lei lunar inclusiv**; unit = **lei**; set in lit. h²) itself, added by
  **LEGEA nr. 141 din 25 iulie 2025, Punctul 18., Articolul II, MO nr. 699 din 25 iulie 2025**.
- **Art. 174 alin. (7)** — **6 salarii minime brute pe țară** (SMGW).
- **Art. 170 alin. (1)** — cap **„72 de salarii minime brute pe țară"** (SMGW), as amended from 01-01-2026.

### (d) Can a PFA în sistem real be exempt from CASS? **No — not by virtue of being a PFA.**

CONFIRMED by reading the whole of alin. (1): **no letter covers a natural person exercising o activitate
independentă.** The two provisions that could appear to touch a PFA are **self-defeating**:

- lit. a) and b) each say, verbatim: „Dacă realizează venituri din cele prevăzute la art. 155 alin. (1) lit. a), b)
  **și f)**, pentru aceste venituri datorează contribuție, conform regulilor specifice prezentului titlu;"
- alin. (2): „Persoanele fizice aflate în situațiile prevăzute la alin. (1) lit. d)-ș), dacă realizează venituri
  dintre cele prevăzute la art. 155 alin. (1), altele decât cele pentru care sunt exceptate, **datorează contribuția
  de asigurări sociale de sănătate**…"

PFA în sistem real income is art. 155 alin. (1) **lit. b)** (art. 155 alin. (1) itself **NOT CHECKED** verbatim in
this pass). **The only CASS relief available to such a person is art. 174 alin. (7)** — and that is **not** an
exemption from CASS, it is a non-dueing of the **difference** established under alin. (6).

### (e) Connecting language — verbatim

- **Art. 153 alin. (1)**, title „Contribuabilii/Plătitorii de venit la sistemul de asigurări sociale de sănătate":
  „(1) Următoarele persoane au calitatea de contribuabili/plătitori de venit la sistemul de asigurări sociale de
  sănătate, cu respectarea prevederilor legislației europene aplicabile în domeniul securității sociale, precum și
  ale acordurilor privind sistemele de securitate socială la care România este parte, după caz: a) cetățenii români cu
  domiciliul sau reședința în România; …"
- **Art. 170 alin. (1)**, title „Baza de calcul al contribuției de asigurări sociale de sănătate datorate de
  persoanele fizice care realizează veniturile prevăzute la art. 155 alin. (1) lit. b)-h)": „(1) Persoanele fizice care
  în anul fiscal pentru care se depune declarația prevăzută la art. 122 au realizat venituri din cele prevăzute la
  art. 155 alin. (1) lit. b), din una sau mai multe surse, datorează contribuția de asigurări sociale de sănătate la o
  bază anuală de calcul egală cu suma rezultată prin cumularea venitului net anual realizat/brut sau normei anuale de
  venit, respectiv a normei anuale de venit ajustate, după caz, stabilite potrivit art. 68, 68¹, 68³ și 69, după caz,
  **care nu poate fi mai mare decât cea corespunzătoare unei baze anuale de calcul egale cu nivelul de 72 de salarii
  minime brute pe țară**. La determinarea bazei anuale de calcul al contribuției de asigurări sociale de sănătate nu
  se iau în considerare pierderile fiscale anuale prevăzute la art. 118."
- **Art. 174 alin. (7)**, art. 174 title „Stabilirea, declararea și plata contribuției de asigurări sociale de sănătate
  în cazul persoanelor care realizează venituri din cele prevăzute la art. 155 alin. (1) lit. b)": „(7) **Diferența de
  contribuție de asigurări sociale de sănătate prevăzută la alin. (6) nu se datorează** în cazul în care, în anul
  fiscal pentru care se depune declarația prevăzută la art. 122, persoana fizică a realizat venituri: a) din salarii
  și asimilate salariilor la un nivel cel puțin egal cu **6 salarii minime brute pe țară**; sau b) din cele prevăzute
  la art. 155 alin. (1) lit. c)-h), pentru care datorează contribuția de asigurări sociale de sănătate la un nivel cel
  puțin egal cu 6 salarii minime brute pe țară. c) venituri din pensii, definite conform art. 99."
- **Art. 174 alin. (8)** — *truncated here; continuation appended below.*

---

## Orchestrator notes on what landed

**1. This is the single most consequential research result of the sprint, and it changes Phase 10's shape.** The
project has reasoned in two decimals throughout. For the income tax under Titlul IV **the legal unit is the whole
leu**. `Q-MONEY-UNIT` was decided as *hybrid — integer bani stored, decimal for rate math*; that decision still
stands, but **the rounding function must round to a leu, not to a ban**, and it must be **half-down at exactly 50
bani**. A `roundMoney()` that rounds to two decimals would be wrong under art. 66 while looking perfectly
reasonable.

**2. B-17's answer is 675 lei, and it is arithmetic, not convention.** `674.505` → fracțiune 50,5 bani > 50 → **675**.
Both of the app's current formatters (`674,51` and `674,50`) are wrong, because both round to bani.

**3. The art. 66 vs art. 315⁴ contrast is the reason this could not be guessed.** art. 315⁴ alin. (2) rounds `.50`
**up**; art. 66 rounds `.50` **down**. Same currency, opposite tie-break, different title. Any attempt to infer a
general Romanian rounding convention from "what tax software does" would have produced the wrong answer.

**4. B-19 is now substantially answered, and the answer is bad news for the app.** `socialInsuranceStatus: 'exempt'`
has **no legal basis as a PFA state**: art. 154 alin. (1) is a **closed list of personal-status categories** and
**none of them is "person with an independent activity"** — and the two letters that come closest each carry an
express sentence re-imposing the contribution on exactly the income types a PFA earns. **The only relief available
is art. 174 alin. (7), which is not an exemption** — it is *diferența … nu se datorează*, conditional on other income
≥ 6 SMGW. The engine's flag switches CASS **entirely** off, which is a different thing from not owing the difference.

**5. My own brief contained a wrong doc id and the researcher caught it.** I passed **265498** as the CPF; it is an
empty shell for Legea 52/2023. The CPF is **Legea 207/2015, consolidation doc 305984**. Worth recording because the
same class of error — a plausible doc id handed down from an earlier pass — is how the fabricated deadlines entered
the code.

**6. Two gaps remain open and both are named in the continuation:** whether art. 154 was amended by OUG 89/2025 or
OUG 8/2026, and whether `'exempt'` and `'neplata'` map to different legal concepts at all.

---

# Continuation 1 — resumed from the cut point (5m 31s), no new searches

Resumed with only the quote `**Art. 174 alin. (8)**: „(8)` and an instruction to run **no new searches**. Output
below is what it returned from its own context. **It truncated again**, before Q2(h), sources and gaps.

## Q2 (e), completed — the rest of the connecting language

- **Art. 174 alin. (8):** „(8) Prevederile alin. (7) se aplică și persoanelor fizice care în anul precedent:
  a) s-au încadrat în categoriile de persoane exceptate de la plata contribuției de asigurări sociale de sănătate
  prevăzute la **art. 154 alin. (1) lit. a), b), e) și f)**;
  b) au optat pentru plata contribuției de asigurări sociale de sănătate potrivit **art. 180 alin. (1)**."
  Amendment note as printed: „(la 01-08-2025, Litera a) , Alineatul (8) , Articolul 174 , Sectiunea a 6-a , Capitolul
  III , Titlul V a fost modificată de Punctul 35. , Articolul II din LEGEA nr. 141 din 25 iulie 2025, publicată în
  MONITORUL OFICIAL nr. 699 din 25 iulie 2025 )"

  > **This is the only place in the retrieved text where art. 154 alin. (1) feeds the CASS calculation at all** — and
  > it extends only the **alin. (7) waiver** (non-dueing of the *difference*), never an exemption. It lists only
  > lit. a), b), e), f).

- **Art. 174 alin. (9)** — retrieval truncated at „(9) Persoanele fizice care au realizat venituri din cele prevăzute
  la art. 155 alin. (1) lit. b) și c…" → **NOT CHECKED** beyond that fragment. **Art. 174 alin. (1)-(6) → NOT
  CHECKED** (only alin. (7)-(9) were read; alin. (6) is the source of „Diferența de contribuție" referenced by
  alin. (7) but was not read). **This is a real gap: the app's CASS ladder depends on alin. (6).**

- **Art. 180 alin. (1) lit. c)** — CONFIRMED verbatim: „c) persoanele fizice care nu realizează venituri de natura
  celor prevăzute la art. 155 și nu se încadrează în categoriile de persoane exceptate de la plata contribuției de
  asigurări sociale de sănătate prevăzute la art. 154 alin. (1);"
- **Art. 180 alin. (2):** „Persoanele fizice prevăzute la alin. (1) datorează contribuția de asigurări sociale de
  sănătate pentru anul în care exercită opțiunea, prin aplicarea cotei prevăzute la art. 156 asupra bazei de calcul,
  reprezentând valoarea a **6 salarii de bază minime brute pe țară**, în vigoare la data de 1 ianuarie a anului pentru
  care se datorează contribuția."

## Q2 (f) — notes printed under art. 154, verbatim (no counts reported)

**The only `Notă` block printed inside art. 154 sits immediately after alin. (1) lit. i):**

> „Notă
> Decizie de respingere: **HP nr. 35/2022**, publicată în Monitorul Oficial nr. 779 din 4 august 2022.
> Decizie de respingere: **HP nr. 218/2025**, publicată în Monitorul Oficial nr. 683 din 22 iulie 2025."

No other `Notă` / RIL block rendered inside art. 154. The `(la …)` consolidation notes actually read, verbatim:

| provision | note as printed |
|---|---|
| alin. (1) intro | 23-03-2018 — OUG nr. 18 din 15 martie 2018, **MO 260/23.03.2018**, Pct. 53, Art. I |
| lit. a) | 12-12-2024 — LEGEA nr. 309 din 6 decembrie 2024, **MO 1236/09.12.2024**, Art. II |
| lit. b) | 18-07-2022 — ORDONANȚA nr. 16 din 15 iulie 2022, **MO 716/15.07.2022**, Pct. 76, Art. I |
| lit. c), d) (`abrogată`) | 01-08-2025 — LEGEA nr. 141/2025, **MO 699/25.07.2025**, Pct. 14, Art. II |
| lit. f) | 01-08-2025 — LEGEA 141/2025, **MO 699/25.07.2025**, Pct. 15, Art. II |
| lit. g) | 01-01-2018 — OUG nr. 79 din 8 noiembrie 2017, **MO 885/10.11.2017**, Pct. 64, Art. I |
| lit. h) (`abrogată`) | 01-08-2025 — LEGEA 141/2025, **MO 699/25.07.2025**, Pct. 16, Art. II |
| lit. h¹) | 01-08-2025 — LEGEA 141/2025, **MO 699/25.07.2025**, Pct. 17, Art. II |
| lit. h²) | 01-08-2025 — LEGEA 141/2025, **MO 699/25.07.2025**, Pct. 18, Art. II (*completat*) |
| lit. i) | 12-04-2024 — OUG nr. 34 din 11 aprilie 2024, **MO 347/12.04.2024**, Pct. 1, Art. 16 |
| lit. j), k), l), o) (`abrogată`) | 01-08-2025 — LEGEA 141/2025, **MO 699/25.07.2025**, Pct. 19, Art. II |
| lit. m) | 24-06-2022 — OUG nr. 87 din 23 iunie 2022, **MO 622/24.06.2022**, Art. IX |
| lit. n), p) | 01-01-2018 — OUG nr. 79/2017, **MO 885/10.11.2017**, Pct. 65, Art. I (*completat*) |
| lit. q) | 28-07-2018 — LEGEA nr. 198 din 20 iulie 2018, **MO 646/25.07.2018**, Art. V (*completat*) |
| lit. r), s) (`abrogată`) | 01-11-2023 — LEGEA nr. 296 din 26 octombrie 2023, **MO 977/27.10.2023**, Pct. 23, Art. III, Capitolul II |
| lit. ș) | 15-09-2022 — ORDONANȚA nr. 37 din 31 august 2022, **MO 857/31.08.2022**, Pct. 1, Art. II (*completat*) |
| alin. (2) | 15-09-2022 — OR 37/2022, **MO 857/31.08.2022**, Pct. 2, Art. II |
| alin. (3) | no `(la …)` note rendered |

> **No `(la …)` note under art. 154 references OUG 89/2025 or OUG 8/2026.** The most recent amendment touching
> art. 154 is the **01-08-2025 group (LEGEA 141/2025, MO 699/25.07.2025)**.

## Q2 (g) — OUG 89/2025 and OUG 8/2026 read directly, not via the consolidation

**OUG nr. 89 din 23 decembrie 2025** (MO nr. 1.203 din 24 decembrie 2025), Portal Legislativ **doc 305817**, body
rendered 155,431 chars, ends „București, 23 decembrie 2025. Nr. 89." → full text confirmed retrieved.

`articolul 154` → **0** · `articolul 170` → **0** · `articolul 174` → **0** · `articolul 180` → **0** ·
`articolul 153` → **0** · `art. 154` → **0** · `art. 170` → **0** · `art. 180` → **0** · `Titlul V` → **0** ·
`art. 155` → **0** · `contribuția de asigurări sociale` → **0** · `rotunj` → **0** · `zecimale` → **0**

- `art. 174` → **1 hit, and it is not Codul fiscal**: „…la nivelul dobânzii prevăzute la art. 174 alin. (5) din Legea
  nr. 207/2015 privind Codul de procedură fiscală…" (Trezoreria loan interest).
- `asigurări sociale de sănătate` → 4 hits, all in the recitals and in **Articolul VII**, which amends **art. 17 din
  OUG nr. 158/2005** (concedii și indemnizații), **not Codul fiscal**.

→ **CONFIRMED: OUG 89/2025 does not amend CF art. 154, 170, 174 or 180.** The prior pass's conclusion is **verified**
for this act.

**OUG nr. 8 din 24 februarie 2026** (MO nr. 147 din 25 februarie 2026), Portal Legislativ **doc 307580**, body
rendered 104,904 chars.

`articolul 154` → **0** · `articolul 170` → **0** · `articolul 174` → **0** · `articolul 180` → **0** ·
`articolul 121` → **0** · `articolul 122` → **0** · `rotunj` → **0** · `zecimale` → **0** · `sute de bani` → **0**

- **Self-correction by the researcher, recorded because it matters:** it ran only the spelled-out `articolul N` forms
  against doc 307580, **not** the abbreviated `art. N`. The retrieved text of **Articolul 8 alin. (2) lit. a)** does
  contain a *cross-reference* to CF art. 180 alin. (2): „…inclusiv contribuția de asigurări sociale de sănătate
  datorată potrivit art. 180 alin. (2) din Legea nr. 227/2015 pentru anul 2025, se sting prin plată și/sau compensare,
  integral până la data 15 aprilie 2026 inclusiv". That is a **condition of the bonificație, not an amendment** to
  art. 180. The abbreviated-form negative against doc 307580 → **NOT CHECKED**.
- → **PARTLY CONFIRMED: OUG 8/2026 does not amend CF art. 154 alin. (1).**

### Refutation of the broader prior claim — and this is the part that changes code

The two OUGs are clean, but **the surrounding articles were amended by other acts in force for 2026.** Any model
built on "nothing changed since U-8" is wrong:

- **Art. 170 alin. (1)** — „(la 01-01-2026, Alineatul (1) , Articolul 170 , Sectiunea a 5-a , Capitolul III , Titlul V
  a fost modificat de Punctul 19. , Articolul XII din **LEGEA nr. 239 din 15 decembrie 2025, MO nr. 1160 din 15
  decembrie 2025**)", with the printed Notă: „Conform literei b) a alineatului (2) al articolului XIII din LEGEA nr.
  239 … prevederile art. XII pct. 19 se aplică **începând cu veniturile aferente anului 2026**." → **the 72-SMGW
  annual CASS base cap applies to the seeded 2026 year.** CONFIRMED.
- **Art. 154 alin. (1)** — heavily amended by **LEGEA 141/2025, MO 699/25.07.2025** (lit. c), d), h), j), k), l), o)
  abrogated; h²) added), effective 01-08-2025. CONFIRMED.
- **Art. 174 alin. (7)** — completed by lit. c) „venituri din pensii, definite conform art. 99." by **Punctul 34.,
  Articolul II din LEGEA 141/2025, MO 699/25.07.2025**, with the printed Notă reproducing art. VII alin. (1) lit. f)
  as amended by **articolul VI din ORDONANȚA nr. 22 din 28 august 2025, MO nr. 806 din 29 august 2025**: „f)
  prevederile art. II pct. 34 și 35 se aplică **începând cu veniturile anului 2025 pentru care termenul de declarare
  este până la data de 25 mai 2026**." CONFIRMED.

*(continuation 1 truncated here — Q2(h), sources and gaps still outstanding)*
