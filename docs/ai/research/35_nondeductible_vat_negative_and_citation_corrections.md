# R-D (second pass) — the affirmative-rule hunt closed as a documented negative, and one of R-D's own findings retracted

**Researcher:** `scout-R-d-copy-claims-and-nondeductible-vat`, resumed session, 2026-10-10. Transcribed by the Orchestrator (**Q-RESEARCHER-WRITE**).

**Scope:** R-D's own gaps — HG 1/2016 Titlul IV norms, „pct. 13 lit. h)", the accounting analogue, D392, D394, the 10.000-euro equivalent, and MO re-citation.

**Two headlines, and the second one is about us.**
1. **Item (d) is now closed as a documented negative**, not an unsearched gap — and **two citations in our own records are wrong**: the REF VAT sentences are **not** HG 1/2016 norms, and **CF art. 324 alin. (6) is not the suspension text**.
2. **R-D retracted its own largest finding from the first pass** — the OUG 120/2021 **art. 10¹⁰** exemption for CNP-identified suppliers from 1 iunie 2026, which I had already turned into **B-63**. It states: *„I explicitly retract the earlier unverified rumour of an OUG 120/2021 „art. 10¹⁰" exempting CNP-identified suppliers from 1 iunie 2026: no source for it was found in this session and it must not be used."* **B-63 is suspended pending a decisive check** (§10 below).

---

## 1. Task 1 — the affirmative rule is not there, and the sweep is now on the record

**Swept:** the ANAF consolidated *„Legea nr. 227/2015 – Ediție adnotată cu Normele metodologice aprobate prin H.G. 1/2016"* — CF „ultima actualizare: LEGEA nr. 170/2026", Norme „ultima actualizare: Hotărârea Guvernului nr. 602/2025"; **4.511.584 characters / 22.330 lines**, exact-string case-insensitive greps over the whole document.

### 1.1 ⚠️ My brief's paragraph range was wrong again — the Titlul IV norms for art. 68 are **pct. 6–7**, not 66–77

Proved three ways inside the same file:
- the anchor `<a name="N_T4_7_1"></a>` opens **pct. 7¹** (norms for art. 68¹);
- the text „**(1¹) Aportul în numerar** … **nu reprezintă venit brut potrivit art. 68 alin. (3) lit. a) din Codul fiscal**" sits in that block;
- **HG 354/2018** amends „punctul 7 alineatul (5)" (inserting „v¹) plăți efectuate în avans care se referă la perioade fiscale următoare") and inserts the „Aportul în numerar" rule at „punctul 7, după alineatul (1)".

**This is the fourth premise of mine a researcher has had to correct** (art. 61's letter count, art. 155 being the CASS list, protocol 2 % not 50 %, now this paragraph range). §12.8 is doing its job in the wrong direction: the corrections keep landing on my briefs, not on the code.

### 1.2 DOCUMENTED NEGATIVE — hit counts across the whole document

| Pattern | Hits | Where |
|---|---|---|
| `TVA colectată` | 8 | Titlul II examples + Titlul VII |
| `TVA deductibilă` | 3 | Titlul VII, cereri de rambursare |
| `TVA dedusă` | 6 | Titlul VII, ajustări art. 305 |
| `TVA nedeductibilă` | 2 | **both inside Titlul II pct. 16 examples** |
| `nu reprezintă cheltuială` | **0** | — |
| `art. 68 alin. (8)` | **0** | — |
| `cheltuieli cu taxa pe valoarea adăugată` | **0** | — |
| `reprezintă taxa pe valoarea adăugată` | **0** | — |

**Not one hit falls inside the Titlul IV norms for art. 68.** Titlul IV pct. 7 alin. (5) is the cheltuieli list mirroring art. 68 alin. (7) (… v), v¹), w) „alte cheltuieli efectuate în scopul realizării veniturilor") and **contains no TVA text**.

### 1.3 The REF obligation itself, CF art. 68 alin. (8)–(9), verbatim

„(8) Contribuabilii pentru care determinarea venitului anual se efectuează în sistem real au obligația să completeze Registrul de evidență fiscală, în vederea stabilirii venitului net anual. (9) Modelul și conținutul Registrului de evidență fiscală se aprobă prin ordin al ministrului finanțelor publice."

The ANAF page's ACTE NORMATIVE entry under that article is **OMFP 3254/2017** — the REF is alive in 2026 and its model comes from an **OMFP**, not from HG 1/2016.

### 1.4 ⚠️ CORRECTION (loud) — the two REF sentences we have been citing are OMFP, not HG 1/2016

**ORDIN nr. 3254/2017 din 19 decembrie 2017 privind Registrul de evidență fiscală pentru persoanele fizice, contribuabili potrivit titlului IV din Legea nr. 227/2015 privind Codul fiscal, publicat în MONITORUL OFICIAL nr. 10 din 5 ianuarie 2018**:

- **art. 4 alin. (3)**: „TVA colectată potrivit regulilor prevăzute în titlul VII „Taxa pe valoarea adăugată" din Codul fiscal nu reprezintă venit și nu se înregistrează în Registrul de evidență fiscală."
- **art. 5 alin. (6)**: „TVA **dedusă** potrivit regulilor prevăzute în titlul VII „Taxa pe valoarea adăugată" din Codul fiscal, nu reprezintă cheltuială și nu se înregistrează în Registrul de evidență fiscală."

Art. 5 alin. (1)–(6) governs the cheltuieli side; anexa nr. 1 = modelul, anexa nr. 2 = caracteristicile.

**Our records — including `research/34` §22 — attribute these to „HG 1/2016, normele for art. 68 alin. (8)". That is wrong.** Correct citation: **OMFP 3254/2017 art. 4 alin. (3) și art. 5 alin. (6), MO 10/05.01.2018.**

**And note what the order still does not say:** it never uses „TVA nedeductibilă" and never says non-deductible VAT *is* a cheltuială. **It excludes only *deduced* VAT.**

### 1.5 The only affirmative VAT-in-expense-base text in the entire Norme is Titlul II

Norms for **CF art. 25 alin. (3) lit. l)**, anchor `<a name="B25_3_l"></a>`: „Aplicarea limitei de 50% pentru stabilirea valorii nedeductibile la determinarea rezultatului fiscal se efectuează **după aplicarea limitării aferente taxei pe valoarea adăugată**, respectiv aceasta se aplică și asupra taxei pe valoarea adăugată pentru care nu s-a acordat drept de deducere din punctul de vedere al taxei pe valoarea adăugată." Followed by „Exemplul 1 … 2.000 lei + partea de TVA nedeductibilă 200 lei = baza de calcul 2.200 lei → 2.200 × 50 % = 1.100 lei".

**Strictly impozit pe profit (Titlul II). Not portable to Titlul IV by citation.**

### 1.6 ⚠️ A fourth FX basis, and it belongs with B-60

Titlul IV norms for the art. 68 alin. (7) caps, verbatim: „(6) Limita echivalentului în euro a cheltuielilor deductibil limitat, prevăzută la art. 68 din Codul fiscal, se transformă în lei la **cursul mediu comunicat de Banca Națională a României pentru anul în care s-a efectuat plata**."

**That is a fourth distinct conversion basis** — BNR *average for the year of payment* — alongside the three our `ConversionBasis` union already offers and the art. 322 basis B-60 recorded. Titlul IV pct. 7 alin. (7) also imports the „utilizat exclusiv" conditions from **pct. 68 of the Titlul VII norms for art. 298 alin. (6)** — **definitions only**, not the pct. 16 base-computation rule.

---

## 2. Task 2 — „pct. 13 lit. h)" exists, and it is about interest, not VAT

Titlul II **pct. 13 alin. (1)** exists (anchor `<a name="B25_1"></a>`, SECȚIUNEA a 5-a – Cheltuieli): „În aplicarea prevederilor **art. 25 alin. (1)** … sunt cheltuieli efectuate în scopul desfășurării activității economice, fără a se limita la acestea, următoarele: a) cheltuielile de reclamă și publicitate …". Its **lit. h)** reads: „**h) cheltuielile cu dobânzile și alte costuri echivalente dobânzii din punct de vedere economic, potrivit art. 40²**;"

**The SEO article's claim that pct. 13 lit. h) supports VAT-in-expense is false.** There is therefore **no Titlul II counterpart to a missing Titlul IV rule** — the Titlul IV silence is neither "deliberate" nor "accidental" in any citable sense. The only Titlul II VAT text is pct. 16 (§1.5).

---

## 3. Task 3 — the accounting analogue, by exclusion, and the citation to put on screen

**OMFP 1802/2014, pct. 8 pct. 6 (definiții)**, verbatim: „cost de achiziție înseamnă prețul datorat și eventualele cheltuieli conexe minus eventualele reduceri ale costului de achiziție. În acest sens, costul de achiziție al bunurilor cuprinde prețul de cumpărare, taxele de import și alte taxe (**cu excepția acelora pe care persoana juridică le poate recupera de la autoritățile fiscale**), cheltuielile de transport, manipulare și alte cheltuieli care pot fi atribuibile direct achiziției bunurilor respective. În costul de achiziție se includ, de asemenea, comisioanele, taxele notariale, cheltuielile cu obținerea de autorizații și **alte cheltuieli nerecuperabile**, atribuibile direct bunurilor respective." Supported by pct. 58 alin. (1) and pct. 75 alin. (1).

**This is the accounting regime saying it in words — by exclusion:** taxes the entity *cannot* recover from the tax authorities (for a neplătitoare de TVA, all input VAT) fall into cost de achiziție. **It never uses the phrase „TVA nedeductibilă", and it is a regime for persoane juridice.**

**NOT FOUND:** no OMFP 1802/2014 „pct. 69" VAT rule and **no account-618 rule** surfaced. **Do not cite either.**

**The rule that actually governs this profile's books — and the strongest on-screen citation available:** **OMFP 170/2015 (MO 139/24.02.2015), cap. III pct. 16**: „Elementele patrimoniale se evidențiază în contabilitate la valoarea de intrare, respectiv la **cost de achiziție**, de producție sau la prețul pieței, în baza documentelor justificative care atestă dobândirea acestora" — read with the already-held normele for **14-1-1/b** („inclusiv taxa pe valoarea adăugată").

**Retention correction:** **OMF 1.447/2023 art. II** amended OMFP 170/2015 cap. IV — new pct. 1¹ (păstrare **5 ani** calculați de la 1 iulie a anului următor) and **abrogated cap. IV pct. 2–4**. **Any copy in the app still saying „10 ani" is stale.**

---

## 4. Task 4 — D392 fully pinned, and our register's citation was wrong

### 4.1 CF art. 324 is titled „Decontul special de taxă și alte declarații"; alin. (1)–(3) = D301, alin. (4)–(6) = the „alte declarații". Current text, verbatim

- **(4)** „Persoanele impozabile **înregistrate** în scopuri de TVA, conform art. 316, a căror cifră de afaceri, astfel cum este prevăzută la art. 310 alin. (2), realizată la finele unui an calendaristic este inferioară sumei de **300.000 lei**, trebuie să comunice printr-o **notificare scrisă** organelor fiscale de care aparțin, **până la data de 25 februarie inclusiv a anului următor**…"
- **(5)** „Persoanele impozabile **neînregistrate** în scopuri de TVA, conform art. 316, a căror cifră de afaceri … **dar excluzând veniturile obținute din vânzarea de bilete de transport internațional rutier de persoane**, realizată la finele unui an calendaristic este inferioară sumei de **300.000 lei**, trebuie să comunice printr-o notificare scrisă … până la data de 25 februarie inclusiv a anului următor…" — **this is our profile's variant.**
- **(6)** „Persoanele impozabile înregistrate în scopuri de TVA conform art. 316, care prestează servicii de transport internațional, trebuie să comunice printr-o notificare scrisă … suma totală a veniturilor obținute din vânzarea de bilete pentru transportul rutier internațional de persoane cu locul de plecare din România."

### 4.2 ⚠️ CORRECTION (loud) — art. 324 alin. (6) is about international bus tickets, not the suspension

**Our register (`research/32` P3 A #17 and the `Q-D392-2027` row I wrote today) records CF art. 324 alin. (6) as carrying „se suspendă … 31 decembrie 2026 inclusiv". It does not.** The suspension is **OUG 115/2023 art. LXII**, which the ANAF consolidation reproduces as a *modification note* under art. 324: „Conform prevederilor art. LXII din Ordonanța de urgență a Guvernului nr. 115/2023: „Aplicarea prevederilor art. 324 alin. (4)-(6) din Legea nr. 227/2015, cu modificările și completările ulterioare, se suspendă începând cu data de 1 ianuarie 2024 și până la data de 31 decembrie 2026 inclusiv.""

**The lesson is a citation-hygiene one: the consolidation's modification notes are not the article text.** Reading the annotated article body gave a different alineate than reading the note attached to it.

### 4.3 The threshold is **300.000 lei**, not 220.000

The 220.000-lei figure on the secondary page is stale. The threshold is tied to „cifră de afaceri, astfel cum este prevăzută la art. 310 alin. (2)" and is **independent of the art. 310 alin. (1) 395.000-lei plafon** introduced by OG 22/2025 — the consolidation, current through Legea 170/2026, still reads **300.000 lei**.

### 4.4 The Norme for these notifications — Titlul VII pct. 104, verbatim

- „(3) Notificările prevăzute la art. 324 alin. (4) și (5) … se depun **numai pentru anii în care persoanele impozabile desfășoară operațiuni de natura celor pentru care există obligația notificării**. Nu se depun notificări în situația în care persoanele impozabile nu au desfășurat astfel de operațiuni în anul de referință…"
- „(4) …în situația în care statutul persoanei impozabile din punct de vedere al înregistrării în scopuri de TVA s-a modificat în anul de referință … **este relevant statutul persoanei impozabile la data de 31 decembrie a anului de referință**."
- „(5) …operațiunile care fac obiectul notificărilor sunt **livrările de bunuri/prestările de servicii în interiorul țării și, după caz, achizițiile efectuate din țară**."

Implementing order: **OPANAF 522/2016 din 26 ianuarie 2016**.

### 4.5 CORROBORATED — nothing re-suspends it for 2027

The ANAF consolidation still carries the suspension note with its 31.12.2026 end date and no later instrument; secondary press confirms resumption. **Consequence: for FY2027 a neînregistrată-in-TVA PFA with CA < 300.000 lei owes the art. 324 alin. (5) notification (form 392B) by 25.02.2028** — a return the app does not model. **This is an absence-of-evidence result from a consolidation plus press; re-check in ianuarie 2027.**

---

## 5. Task 5 — D394 current model and term

**OPANAF nr. 2.194 din 11 septembrie 2025** for modificarea OPANAF nr. 3.769/2015 (D394), **MO nr. 852 din 17 septembrie 2025**; Art. I replaces anexa nr. 1 și anexa nr. 2; **Art. III: „Prevederile prezentului ordin se aplică începând cu operațiunile derulate de la data de 1.08.2025."** Base order OPANAF 3769/2015, MO nr. 11 din 7 ianuarie 2016. Purpose: the new cote (21 % / 11 %) from 1.08.2025.

**Who owes it (Instrucțiuni, current model, pct. 1 lit. a) și b))**: only „**persoanele impozabile înregistrate în scopuri de TVA în România conform art. 316**". A neplătitoare de TVA owes nothing; **an art. 317 registrant is not listed.**

**Term (Instrucțiuni pct. 2), verbatim**: „Declarația se depune la organul fiscal competent **până în data de 30 inclusiv a lunii următoare încheierii perioadei de raportare, declarate pentru depunerea decontului** (luna, trimestrul etc.), **inclusiv dacă în această perioadă nu au fost realizate operațiuni** de natura celor care fac obiectul declarației. În cazul în care perioada de raportare este luna calendaristică, termenul de depunere a declarației pentru luna ianuarie este până la data de 28, respectiv 29 februarie."

**INFERRED — mid-year registration:** the instructions tie the reporting period to the fiscal period declared for the art. 322 decont; there is no half-year pro-rating rule, so a PFA becoming plătitoare de TVA mid-2027 files D394 for each reporting period from registration onward, on the periodicity it declares — **not** a single "half-year" return. No provision states this expressly.

---

## 6. Task 6 — the 10.000-euro equivalent: still 34.000 lei, and the rule is now cited

Normele metodologice **Titlul VII pct. 3 alin. (5)**, verbatim: „Echivalentul în lei al plafonului pentru achiziții intracomunitare de bunuri de **10.000 euro**, prevăzut la **art. 268 alin. (4) lit. b)** din Codul fiscal, aplicabil în cursul unui an calendaristic, se determină pe baza **cursului valutar de schimb comunicat de Banca Națională a României la data aderării** și se rotunjește la cifra miilor. Rotunjirea se face prin majorare când cifra sutelor este egală sau mai mare decât 5 și prin reducere când cifra sutelor este mai mică de 5, **prin urmare plafonul este de 34.000 lei**." Cross-referenced by Titlul VII pct. 90 alin. (2).

**SCOPE WARNING:** art. 268 alin. (4) is the *achiziții intracomunitare* plafon, **not** a general activity threshold. It bites this profile only for intra-EU **goods** purchases, and exceeding it triggers art. 317 alin. (1) lit. a) registration (Titlul VII pct. 3 alin. (8)). **The euro caps inside art. 68 convert on a completely different rule** (§1.6).

---

## 7. Task 7 — all four of our MO numbers are correct

| Act | Our record | Verdict |
|---|---|---|
| **OUG 128/2024** | MO 1125/11.11.2024 | ✅ „ORDONANȚĂ DE URGENȚĂ nr. 128 din 7 noiembrie 2024 … nr. 1125 din 11 noiembrie 2024" |
| **OMFP 170/2015** | MO 139/24.02.2015 | ✅ „ORDIN nr. 170 din 17 februarie 2015 … nr. 139 din 24 februarie 2015"; în vigoare 1 martie 2015 |
| **OMF 1.447/2023** | MO 453/24.05.2023 | ✅ MO correct — **the order's own date is 2 mai 2023**, not 24.05 |
| **Legea 88/2026** | MO 459/29.05.2026 | ✅ |
| **OUG 115/2023** | MO 1139/15.12.2023 | ✅ Anul 191 (XXXV), Nr. 1139, 15 decembrie 2023 |

---

## 8. ⚠️ THE RETRACTION — art. 10¹⁰, and therefore B-63

What the first pass reported (and what I turned into **B-63** and used to scope **Q-EFACT-SCOPE** and close **Q-10^10-DIFF**): *Legea 88/2026 inserted OUG 120/2021 art. 10¹⁰, and from 1 iunie 2026 CNP-identified suppliers „nu mai au obligația" to transmit in RO e-Factura.*

What this pass says: **„I explicitly retract the earlier unverified rumour of an OUG 120/2021 „art. 10¹⁰" exempting CNP-identified suppliers from 1 iunie 2026: no source for it was found in this session and it must not be used."** What it *did* verify from Legea 88/2026 art. III is a different change — **art. 10¹ alin. (3) și (4)**: „Livrările de bunuri/Prestările de servicii efectuate către o persoană fizică care nu se identifică în relația cu furnizorul/prestatorul prin niciun cod de identificare fiscală sau optează să se identifice prin codul numeric personal se consideră efectuate în relația B2C, cu excepția situației în care beneficiarii sunt înscriși în **Registrul RO e-Factura opțional**…" — i.e. it refines the **B2C beneficiary** definition, **not** an exemption for CNP-identified *suppliers*.

**Orchestrator note — why I did not simply delete B-63.** The first pass was not baseless. It named three specific instruments: **OPANAF 378/2026 pct. 19** (CNP suppliers active before 1 iunie 2026 to request înscriere **până cel târziu la 26 mai 2026**), **OPANAF 1020/2026, MO 706/25.08.2026** (formular 082 rewritten to add *scoaterea din registru*, effect 1 a lunii următoare), and a DCBusiness article on who escapes the registration duty. **A removal procedure from the RO e-Factura register, with a 26 mai 2026 deadline, does not fit a world in which the duty simply continued.** Two sessions of the same researcher now disagree with each other, and one of them compacted in between.

**Action taken:** the session was resumed with the three named sources and asked to read the instruments and answer exactly one of (A) relieved / (B) not relieved / (C) cannot determine. **B-63 is suspended, Q-10^10-DIFF is re-opened, and the Q-EFACT-SCOPE scoping is marked contested** until that answer arrives. **No e-Factura date-split is to be built or dismissed on the current evidence.**

---

## 9. Verdict on Q-NONDEDUCT-VAT

**Closed as a documented negative.** No provision of Titlul IV, of the HG 1/2016 norms, or of OMFP 3254/2017 says non-deductible VAT becomes a deductible expense for a neplătitoare de TVA. The sweep is on the record with hit counts (§1.2), the correct instrument is identified (§1.4), and the only affirmative text anywhere is Titlul II and not portable (§1.5).

**`REVIEW_REQUIRED` is now permanent by evidence, and the on-screen citation should be:** **OMFP 170/2015 cap. III pct. 16** + the normele for **14-1-1/b** („inclusiv taxa pe valoarea adăugată"), labelled as the **accounting** treatment. **Never** as a Titlul IV rule. **Stop spending scouts on this question.**

---

## 10. Gaps

1. **The art. 10¹⁰ contradiction is open and must be settled** — resumed session, three named instruments, answer (A)/(B)/(C).
2. **OMFP 3254/2017's two alineate were read from a content-extraction pass over the ANAF PDF, not the MO text.** If that citation goes on screen, confirm art. 4 alin. (3) and art. 5 alin. (6) against **MO nr. 10 din 05.01.2018**, and check whether a later order replaced 3254/2017 for FY2026 (the consolidation still lists it — good evidence, not proof).
3. **No 2026 instrument re-suspending art. 324 alin. (4)-(6) was found** — absence of evidence. **Re-check in ianuarie 2027** before shipping any D392B flow.
4. **OMFP 1802/2014 „pct. 69" and account 618 not found** — if a double-entry-specific citation is ever needed, that needs a targeted read of the OMFP 1802/2014 plan de conturi (cap. 14, pct. 593-594) and the 4426/4427 sections.
5. **Mid-year D394 periodicity is an inference**, not a quoted rule.
6. **Titlul IV pct. 6** (norms for art. 67) was not swept line-by-line; the TVA-string greps cover it, but a full read was not affordable.

---

## 11. ⚠️ RESOLVED — the art. 10¹⁰ contradiction, answered (A), and the mechanism we had was wrong

The resumed session was given the three named instruments and asked for exactly (A) relieved / (B) not relieved / (C) cannot determine. **Answer: (A).** **B-63 is sound; the citation attached to it was not.**

### 11.1 art. 10¹⁰ exists — and it was born as an *obligation*, not a relief

Created by **OUG 89/2025 din 23 decembrie 2025, MO nr. 1203 din 24.12.2025, art. X pct. 5**:

> „**Articolul 10¹⁰** Furnizorii/Prestatorii care au obligația să respecte prevederile art. 5, art. 9¹, art. 10 alin. (1) și art. 10¹ alin. (2) și care se identifică fiscal prin codul numeric personal **au obligația de a solicita înscrierea în Registrul RO e-Factura obligatoriu** înainte de a începe desfășurarea activităților economice și sunt înscriși în registru în termen de 3 zile lucrătoare de la data solicitării."

With **OUG 89/2025 art. XI**: CNP suppliers who started activity before **15 ianuarie 2026** had to request înscriere before that date and „sunt înscriși în Registrul RO e-Factura obligatoriu **cu data de 15 ianuarie 2026**". *(OUG 89/2025 MO 1203/24.12.2025 is already in our register from `Q-CASS-NEGATIVE` — same instrument, different title.)*

### 11.2 OG 6/2026 suspended the duty only *until* 1 iunie 2026 — and ordered enrolment for that date

**Ordonanța nr. 6 din 30 ianuarie 2026, MO nr. 77 din 30.01.2026, art. IX**:
> „(1) Prin derogare de la prevederile art. 5, art. 9¹, art. 10 alin. (1), art. 10¹ alin. (2) și art. 10¹⁰ … **furnizorii/prestatorii care se identifică fiscal prin codul numeric personal nu au obligația utilizării** sistemului național privind factura electronică RO e-Factura **până la data de 1 iunie 2026**.
> (2) … care au fost înregistrați în Registrul RO e-Factura obligatoriu **pot solicita scoaterea** din acesta…
> (3) … care au început să desfășoare activități economice **anterior datei de 1 iunie 2026** și nu sunt înscriși în Registrul RO e-Factura obligatoriu, **au obligația de a solicita înscrierea în registru cu cel puțin 3 zile lucrătoare înainte de această dată și sunt înscriși cu data de 1 iunie 2026**."

### 11.3 The 26 mai 2026 deadline is an *enrolment* leg, not a relief leg

**OPANAF nr. 378 din 22 martie 2026, MO nr. 250 din 31 martie 2026** — **not** the MO my brief implied. It renames formular **(082)** to „Cerere privind înregistrarea **în/scoaterea din** Registrul RO e-Factura obligatoriu" and inserts „**Capitolul V – Dispoziții speciale aplicabile până la data de 1 iunie 2026**", pct. 17–19. Pct. 19: CNP suppliers active before 1 iunie 2026 „**sunt obligați să solicite înscrierea** în Registrul RO e-Factura obligatoriu, **până cel târziu la data de 26 mai 2026**… **Persoanele sunt înscrise în registru cu data de 1 iunie 2026**." Pct. 18(2): those who request scoaterea are removed „**cu data depunerii solicitării**".

**My inference was right that relief exists, and wrong about what the deadline meant** — it enrols them, effective the very date the relief begins. Legea 88/2026 overtook it three days later, which is precisely why a removal route had to be built.

### 11.4 The relieving act

**LEGEA nr. 88 din 29 mai 2026, MO nr. 459 din 29.05.2026, art. III pct. 8** — „Articolul 10¹⁰ se modifică și va avea următorul cuprins":
> „**(1) Furnizorii/Prestatorii care se identifică fiscal prin codul numeric personal nu au obligația să respecte prevederile art. 5, 9¹, art. 10 alin. (1) și art. 10¹ alin. (2).**
> (2) Persoanele prevăzute la alin. (1) pot opta pentru utilizarea sistemului național RO e-Factura. În situația în care optează … aceste persoane sunt obligate să fie înregistrate în **Registrul RO e-Factura opțional**.
> (3) … sunt înscrise în Registrul RO e-Factura opțional **începând cu data de 1 a lunii următoare exercitării opțiunii**."

**Art. IV alin. (1)**: „Prevederile art. III intră în vigoare începând cu **data de 1 a lunii următoare publicării**" → published 29.05.2026 → **in force 01.06.2026**. Confirmed by ANAF DGRFP Brașov („**În vigoare începând cu 01.06.2026** (cf. art. IV din Legea 88/2026)") and ANAF DGRFP Timiș.

### 11.5 The removal procedure now has a legal basis, and two different effect dates

**Legea 88/2026 art. III pct. 7** rewrote **art. 10⁸**: „(2) Furnizorii/Prestatorii **care nu au obligația utilizării sistemului** și care au fost înregistrați în Registrul RO e-Factura obligatoriu și cei înregistrați în Registrul RO e-Factura opțional **pot solicita scoaterea** din aceste registre … și **sunt scoși … începând cu data de 1 a lunii următoare celei în care au solicitat scoaterea**." Art. IV alin. (2) required ANAF to amend the procedure within 30 days — that is **OPANAF 1020/2026**.

**If removal is ever modelled, the two routes differ:** the OG 6/2026 route (OPANAF 378/2026 pct. 18) removed **cu data depunerii**; the art. 10⁸ alin. (2) route removes **cu data de 1 a lunii următoare**.

### 11.6 FY2026 timeline — three sub-periods, not two

| Period | Status | Basis |
|---|---|---|
| **01.01.2026 – 29.01.2026** | **Obliged** — B2C transmission; enrolment duty; those active before 15.01.2026 enrolled with effect 15.01.2026 | OUG 120/2021 art. 10¹ alin. (2); OUG 89/2025 art. X pct. 5 și art. XI, MO 1203/24.12.2025 |
| **30.01.2026 – 31.05.2026** | **Not obliged** — derogare „până la data de 1 iunie 2026" | OG 6/2026 art. IX alin. (1), MO 77/30.01.2026 |
| **from 01.06.2026** | **Not obliged, permanently**; optants go to **Registrul RO e-Factura opțional**, effective 1 a lunii următoare opțiunii | OUG 120/2021 **art. 10¹⁰ alin. (1)-(3)** as rewritten by Legea 88/2026 art. III pct. 8, MO 459/29.05.2026, in force 01.06.2026 per art. IV alin. (1) |

**Practical consequence for the product: for FY2026 a CNP-identified PFA is essentially never obliged to transmit in RO e-Factura — the duty exists for 29 days of a 365-day year.** Any UI line saying it is obligatory is wrong for 336 days.

### 11.7 Two citation traps, both of which bit us

1. **The Portal Legislativ consolidated OUG 120/2021 page still shows art. 10¹⁰ in its pre-Legea 88/2026 (enrolment-obligation) form.** Reading that page alone yields the **exact opposite answer**. Cite **Legea 88/2026 art. III pct. 8 + art. IV alin. (1)** directly. *This is very likely why the two sessions of the same researcher disagreed: the first read the amending law, the second re-read the consolidation and found the obligation.*
2. **OPANAF 378/2026 is dated 22 martie 2026, MO nr. 250 din 31.03.2026.**

### 11.8 Still unverified

**OPANAF 1020/2026's own header and MO number (706/25.08.2026)** — the amended formular 082 text and its instrucțiuni were read, not the order. And whether any ANAF technical note changes the removal effect date in practice.
