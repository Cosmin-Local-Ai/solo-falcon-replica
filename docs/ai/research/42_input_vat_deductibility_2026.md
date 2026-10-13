# Research 42 — input VAT: the deduction right, and the four switches the app does not model

**Research pass for PG-6f (B-30, B-87).** Researcher pass returned 12 Oct 2026. Consolidation used: the GhidFiscal „Codul Fiscal 2026" article pages, each headed *Sursa: ANAF — `Cod_fiscal_norme_2023.htm`*, cross-checked against ANAF PDFs, Portal Legislativ for OUG 120/2021 and Legea 239/2025, and lege5.ro for the Norme text. **Verification date for every quotation: 12 October 2026.**

**Two citations in my own brief were wrong, and the Researcher corrected them.** „Art. 29–30 CF" are **Titlul II** articles (art. 30 is *Pierdere fiscală*), not the deduction right. And the 50 % vehicle restriction is **art. 298 alin. (1)**, not alin. (2). The correct Titlul VII, Cap. X anchors are: **296** structuri · **297** dreptul de deducere · **298** limitări speciale · **299** condiții de exercitare · **300** regim mixt / pro rata · **301** exercitarea prin decont · **302–303** rambursări · **304** ajustări (alte bunuri) · **305** ajustări (bunuri de capital) · **306** tranzitorii.

---

## 1. Headline

**The app cannot decide per-expense VAT deductibility from a single `vatExempt` boolean, and `vatExempt ? expenses : expensesNet` is wrong in both directions.** The right belongs to a taxable person **registered under art. 316**, is expressly denied to a person in the art. 310 small-business exemption, and is then cut back by **four independent switches** the app does not model: the **50 % vehicle restriction**, the **pro rata for mixed use**, the **document condition (invoice + e-Factura)**, and **later clawback**.

**And the VAT 50 % vehicle rule and the Titlul IV 50 % expense rule are separate regimes with different category lists — six vs five.** A vehicle can be 100 % deductible for VAT and 50 % for income tax, or the reverse.

---

## 2. The right, and what a non-registered PFA gets

**FACT — substantive right, registration-gated mechanism.** Art. 297 alin. (4): „Orice persoană impozabilă are dreptul să deducă taxa aferentă achizițiilor, dacă acestea sunt destinate utilizării în folosul următoarelor operațiuni: a) operațiuni taxabile; … c) operațiuni scutite de taxă, conform art. 292¹, 294, 295 și 296". Art. 301 alin. (1): „Orice persoană impozabilă **înregistrată în scopuri de TVA, conform art. 316**, are dreptul să scadă din valoarea totală a taxei colectate …".

**FACT — express denial for the small-business regime.** Art. 310 alin. (10): „Persoana impozabilă care aplică regimul special de scutire: **a) nu are dreptul la deducerea taxei** aferente achizițiilor, în condițiile prevăzute la art. 297 și 299; b) nu are voie să menționeze taxa pe factură". **Plafon: 395.000 lei** (raised from 300.000 by OG 22/2025, transposing Directive (EU) 2020/285; ANAF Iași, 27.01.2026, still states 395.000).

**DOCUMENTED NEGATIVE — „non-deductible VAT becomes a cost" is a silence, not a rule.** Titlul VII contains only **negations** (art. 310 alin. (10) lit. a); art. 11 alin. (8) where registration was annulled) and **never** says the tax becomes a deductible expense. **So: Titlul VII does not make it a cost, and Titlul IV does not say so either (`research/35` §1.5). Whether non-deductible VAT enters a PFA's expense base is an unanswered question in both titles.** That is B-87, restated where it actually lives.

**FACT — two carve-outs from „no registration = no recovery":** art. 303 alin. (12) allows unregistered persons to be **refunded** VAT on exempt-with-deduction operations under art. 294 alin. (1) lit. b), j), l), m), p); and art. 297 alin. (6) + Norme pct. 66 alin. (16) allow deduction of purchases made **before** registration.

---

## 3. The two 50 % vehicle rules are different regimes

**FACT — VAT side, art. 298 alin. (1):** „Prin excepție de la prevederile art. 297 se limitează la **50 %** dreptul de deducere a taxei aferente cumpărării, achiziției intracomunitare, importului, închirierii sau leasingului de vehicule rutiere motorizate și a taxei aferente cheltuielilor legate de vehiculele aflate în proprietatea sau în folosința persoanei impozabile, **în cazul în care vehiculele nu sunt utilizate exclusiv în scopul activității economice**."

**FACT — a second, separate 100 % route at alin. (2):** the restriction „nu se aplică vehiculelor … având o masă totală maximă autorizată care depășește 3.500 kg sau mai mult de 9 scaune, inclusiv scaunul șoferului".

**FACT — alin. (3) has SIX categories, a)–f).** a) urgență / pază și protecție / curierat · b) agenți de vânzări și de achiziții · c) transport de persoane cu plată, incl. taximetrie · d) prestări de servicii cu plată, incl. școli de șoferi · **e) „vehiculele utilizate pentru închiriere sau a căror folosință este transmisă în cadrul unui contract de leasing financiar ori operațional"** · f) vehicule utilizate ca mărfuri în scop comercial.

**FACT — the income-tax list has FIVE, and the extra VAT category is the leasing one.** Art. 68 alin. (7) lit. k) merges rental into its category 4 („inclusiv pentru închirierea către alte persoane sau pentru instruire de către școlile de șoferi") and has **no** „leasing financiar ori operațional" wording. Same article: „Cheltuielile care intră sub incidența acestor prevederi **nu includ cheltuielile privind amortizarea**."

**FACT — the Titlul IV norm borrows only definitions, not the list:** „În sensul prevederilor art. 68 alin. (7) lit. k) … regulile de deducere, termenii și expresiile … au semnificațiile prevăzute la **pct. 68 din normele metodologice date în aplicarea art. 298 alin. (6)** din Codul fiscal din titlul VII". **So the regimes are independent.** Worked consequences:
- A **financial/operating-lease car**: VAT **100 %** (art. 298 alin. (3) lit. e)), income tax **50 %** (not in the five).
- A **car let out to third parties**: income tax **100 %** (cat. 4); for VAT it must be placed under lit. d)/e) and Norme pct. 68 alin. (5).
- **Asymmetric on the asset itself:** VAT on the purchase is capped at 50 %, while amortisation is expressly **outside** the income-tax cap (and capped per vehicle elsewhere — art. 28 alin. (14), `research/36` §12).

**FACT — evidence differs between the two 50 % routes.** Norme pct. 68 alin. (4): „Persoana impozabilă care aplică deducerea limitată de 50 % **nu trebuie** să facă dovada utilizării vehiculului … cu ajutorul foii de parcurs". Full VAT deduction needs a *foaie de parcurs* with four minimum fields. And pct. 68 alin. (5): for categories b)–f) personal use is „considerată **neglijabilă**" absent abusive practice, while for lit. a) exclusive use is mandatory.

**⚠️ CORRECTED 2026-10-13 — this rule is NOT derogation-dependent, and an earlier version of this file said it was.** The sentence removed read „The rule the app encodes is derogation-dependent." **It is wrong.** Art. 298 alin. (1) is a **free-standing domestic rule: no date, no sunset, no reference to Directive 2006/112/EC or to any Council implementing decision.** Its only condition is factual — whether the vehicle is used exclusively for the economic activity. **The derogation is what makes the rule *compatible* with art. 168 VATD, not what makes it *exist*.** The proof is two alineate away: **art. 298 alin. (4^1)** (buildings) *is* expressly conditional on Romania being „autorizată să aplice o măsură specială de derogare" — **conditional for buildings, unconditional for cars.** Full findings, the 31 December 2026 status and the FY2027 verdict: **`research/45_cid_2024_1641_vehicle_vat_2027.md`**.

**FACT — art. 298 alin. (4^1) (50 % VAT on residential buildings) is still NOT in force.** Inserted by OUG 115/2023 but conditional on Romania obtaining the derogation; in the 2026 consolidation it is still a future-dated *Notă*. Relevant if the PFA rents or owns a home office.

---

## 4. Pro rata — and the de-minimis I expected does not exist

Art. 300, „Deducerea taxei pentru persoana impozabilă cu **regim mixt** și persoana **parțial impozabilă**": alin. (3) exclusive deductible use → full; alin. (4) exclusive non-deductible use → „nu se deduce"; alin. (5) destination unknown → pro rata; **alin. (6) is the formula** (numărător = operațiuni cu drept de deducere fără taxă, plus subvenții legate direct de preț; numitor = total fără taxă); alin. (7) excludes capital-goods deliveries, self-supplies and incidental real-estate operations „în măsura în care acestea sunt accesorii activității principale"; **alin. (8) „Pro rata definitivă … se rotunjește până la cifra unităților imediat următoare"** — rounding **up**, with a method document annexed; alin. (9) provisional pro rata communicated by **25 January**; alin. (14) year-end adjustment in the last period's return; alin. (15) second-level adjustment for capital goods at 1/5 (movables) or 1/20 (immovables).

**alin. (20) is an opt-out that is adverse:** „Persoanele impozabile cu regim mixt pot opta să nu aplice prevederile prezentului articol … situație în care taxa aferentă achizițiilor de bunuri destinate operațiunilor cu sau fără drept de deducere **nu va fi dedusă**."

**DOCUMENTED NEGATIVE — there is no de-minimis percentage in Romanian art. 300.** No 98 %/2 % style threshold exists. The only reliefs are the alin. (7) exclusions and the alin. (8) round-up. **A VAT-registered PFA doing only taxable operations never uses art. 300 at all.**

**FACT — clawback.** Art. 304 alin. (1) adjusts non-capital goods and services when the deduction was wrong, the elements change, or the right is lost or gained. Art. 305 (capital goods, 5 y / 20 y) alin. (4) lit. a) pct. 1 adjusts on use for other purposes **„cu excepția bunurilor a căror achiziție face obiectul limitării la 50 % … potrivit prevederilor art. 298"** — **a vehicle already under the 50 % VAT limit is not clawed back when it moves to personal use.** Art. 301 alin. (2) allows late exercise in a later return within prescription; alin. (3) requires registered-letter notification beyond three years.

---

## 5. The document condition — e-Factura can be the whole answer

**FACT — the chain.** Art. 299 alin. (1) lit. a): the taxpayer must „să dețină o factură emisă în conformitate cu prevederile art. 319". Norme pct. 69 alin. (2): „Justificarea deducerii taxei se face **numai pe baza exemplarului original**". **Art. 319 alin. (1^1)** (Legea 296/2023, operative 1 July 2024): „pentru operațiunile realizate între persoane impozabile stabilite în România conform art. 266 alin. (2), sunt considerate facturi **numai** facturile care îndeplinesc condițiile prevăzute de Ordonanța de urgența a Guvernului nr. 120/2021". OUG 120/2021 art. 10 alin. (1): B2B transmission through RO e-Factura is **obligatory**, with exceptions for bonuri fiscale meeting simplified-invoice conditions (art. 319 alin. (12), (13), (21)) and for intra-community supply invoices where the Romanian beneficiary gives another Member State's code; alin. (7): 5 calendar days. OUG 120/2021 art. 4 alin. (6): the original is „fișierul de tip XML însoțit de semnătura electronică a Ministerului Finanțelor".

**FACT — the sanction runs to the buyer too.** OUG 120/2021 art. 13² alin. (1) lit. b) + alin. (2): „primirea și înregistrarea de către destinatarul … a unei facturi emise de operatori economici stabiliți în România, în relația B2B, fără respectarea prevederilor art. 10 alin. (1)" — fined **„o amendă egală cu 15 % din valoarea totală a facturii"**. The duty runs to *persoane impozabile stabilite în România* **regardless of VAT registration**, so even a non-registered PFA is exposed.

**INTERPRETATION (strongly supported, not an express rule):** for domestic B2B, a document that never entered RO e-Factura is not a „factură" under art. 319, so the art. 299 alin. (1) lit. a) condition is unmet and **the deduction cannot be exercised on that line**. Not permanent extinction — art. 301 alin. (2) revives it once a compliant e-Factura exists, within prescription. **No ANAF act stating this expressly was found.**

**FACT — where a non-e-Factura document still supports deduction:** Norme pct. 69 alin. (3) and (6) — simplified invoices and fiscal receipts qualify **only if the buyer's VAT code is on them**; art. 319 alin. (12) lit. a) simplified invoice up to **100 euro** incl. VAT, alin. (13) lit. a) **100–400 euro** by MF order; art. 319 alin. (21) lit. f) (OUG 138/2024) requires the code on simplified invoices. Imports / AIC / reverse charge are justified by the customs declaration or self-invoice (art. 299 alin. (1) lit. c)–f)), not by e-Factura.

**FACT — other absolute bars:** art. 297 alin. (7) lit. b) — VAT on alcohol and tobacco not for resale is **never** deductible. Art. 11 alin. (7)–(9) — no deduction where the supplier's VAT code was annulled/inactive at the date, with exceptions.

---

## 6. The table the brief is built from

| # | Situation | Input VAT deductible? | Deciding fact | Citation |
|---|---|---|---|---|
| 1 | PFA **not registered** (art. 310 regime, CA ≤ 395.000 lei) | **Never** | Registration status, not an „exempt" flag | art. 310 alin. (10) lit. a); art. 301 alin. (1) |
| 2 | Registered, purchase for taxable operations | **100 %** | Destination | art. 297 alin. (4) lit. a); art. 300 alin. (3) |
| 3 | Registered, purchase for exempt operations **without** right | **No** | Output operation | art. 300 alin. (4) |
| 4 | Registered, purchase for exempt **with** right (294/295/296/292¹) | **Yes** | Same | art. 297 alin. (4) lit. c) |
| 5 | Registered, mixed / destination unknown | **Pro rata**, provisional by 25 Jan, rounded **up** | Turnover ratio, with alin. (7) exclusions | art. 300 alin. (5)–(14) |
| 6 | Registered, mixed, **opted out** | **No deduction at all** on mixed-destination goods | Existence of the option | art. 300 alin. (20) |
| 7 | Vehicle ≤ 3.500 kg / ≤ 9 seats, mixed use | **50 %** — and **no** *foaie de parcurs* needed | Use not exclusively business | art. 298 alin. (1); Norme pct. 68 alin. (4) |
| 8 | Same vehicle, exclusively business | **100 %** | *Foaie de parcurs*, four fields | art. 298 alin. (4); Norme pct. 68 alin. (2) |
| 9 | Vehicle > 3.500 kg or > 9 seats | **100 %**, restriction does not apply | MTMA / seats | art. 298 alin. (2) |
| 10 | Vehicle in VAT categories a)–f) | **100 %** | Category + evidence; personal use „neglijabilă" for b)–f) | art. 298 alin. (3); Norme pct. 68 alin. (5) |
| 11 | Same vehicle, **income-tax** side | **50 %** unless in the **five** categories; amortisation excluded | The income-tax list ≠ the VAT list | art. 68 alin. (7) lit. k) |
| 12 | Ordering of the two caps — **Titlul II** | Cap applies **after** VAT, on gross incl. non-deductible VAT | Express norm | Norm pct. 16 alin. (3) |
| 13 | Ordering — **Titlul IV** | **No express rule** (documented negative) | — | Norm for art. 68 alin. (7) lit. k) — silent |
| 14 | Domestic B2B invoice never through RO e-Factura | **Not deductible in practice**; revives if a compliant e-Factura appears within prescription | e-Factura status of the line | art. 319 alin. (1^1); art. 299 alin. (1) lit. a); Norme pct. 69 alin. (2); OUG 120/2021 art. 10 alin. (1), art. 4 alin. (6); art. 301 alin. (2) |
| 15 | Fiscal receipt / simplified invoice ≤ 100 euro **with buyer's VAT code** | **Yes** | Document type + code on it | art. 319 alin. (12) lit. a), (21); Norme pct. 69 alin. (3), (6) |
| 16 | Simplified invoice 100–400 euro | **Contested** — safest: require e-Factura | Scope of the art. 10 alin. (1) exception | art. 319 alin. (13) lit. a); OUG 120/2021 art. 10 alin. (1) |
| 17 | Import / AIC / reverse charge | **Yes**, via customs doc or self-invoice | Supplier establishment | art. 299 alin. (1) lit. c)–f); art. 307/308/326 |
| 18 | Alcohol and tobacco (not for resale) | **Never** | Nature of goods | art. 297 alin. (7) lit. b) |
| 19 | Purchase before VAT registration | **Yes, conditionally** | Date vs registration date | art. 297 alin. (6); Norme pct. 66 alin. (16) |
| 20 | Capital good moves business → personal | **Clawback 1/5 or 1/20**, **except** vehicles already under the 50 % limit | Capital-good status + art. 298 status | art. 305 alin. (2), (4) lit. a) pct. 1, (5) |
| 21 | Non-capital good/service moves to non-deductible use | **Adjustment in that period** | Change of destination | art. 304 alin. (1) |
| 22 | Supplier inactive / VAT code annulled at purchase | **No deduction**, with exceptions | Supplier status at the date | art. 11 alin. (7)–(9) |
| 23 | Residential building partly personal | **Not yet restricted** — alin. (4^1) awaits the derogation | Whether the derogation was granted | art. 298 note after OUG 115/2023 |

---

## 7. D300, and the figure the app would compute

**FACT — a registered PFA files D300; a non-registered one never does.** OPANAF nr. 174/2026 (MO Partea I nr. 105/09.02.2026) approves formular **300**, „se completează de persoanele impozabile înregistrate în scopuri de TVA conform art. 316", periodicity per art. 322, new model from the first fiscal period of 2026. Anchor: art. 323 alin. (2) — the return „va cuprinde suma taxei deductibile pentru care ia naștere dreptul de deducere în perioada fiscală … și, după caz, suma taxei pentru care se exercită dreptul de deducere, în condițiile … art. 301 alin. (2)".

**FACT — the computed figure is the D300 deductible-VAT total:** **rd. 30 „TOTAL TAXĂ DEDUCTIBILĂ (sumă de la rd. 20 până la rd. 28, cu excepția rd. 20.1, 22.1, 26.1, 26.2)"**; **rd. 33 „Regularizări taxă dedusă"** (corrections „conform art. 297 și 298 … sau art. 298 și 300 … în cazul persoanelor impozabile cu regim mixt"); **rd. 34 „Ajustări conform pro-rata / ajustări de taxă"**. **The 50 % vehicle cut and the pro rata land partly inside rd. 20–28 and partly on rd. 33/34** — so a single computed number is not a single form line.

**FACT — D301, not D300, is for the unregistered:** „Decontul special D301 nu se depune de persoanele înregistrate normal în scopuri de TVA conform articolului 316, acestea declarând TOATE operațiunile efectuate în decontul de TVA D300!"

**UNKNOWN — D394** was not verified in this pass. It is an invoice-level recap, not a place where a deductible-VAT amount is declared — **but that needs a primary check before any brief asserts it.**

---

## 8. 2026 amendments

**FACT — Legea 239/2025 did not change art. 298 alin. (1)–(3).** The 2026 consolidation shows the identical 50 % text and the same six categories. Legea 239/2025 (MO 1160/15.12.2025) and OUG 78/2025 / OUG 89/2025 (MO 1203/24.12.2025) act elsewhere — special tax on high-value assets, procedural/CPF articles, and **RO e-Factura being obligatory from 15 January 2026**.

**Not verified:** whether those acts touched art. 300, 301, 304, 305 or 316. **Only art. 298 was checked.**

---

## 9. What this settles, and what it does not

**Settles for 6f:** the deduction right is registration-gated, not „exempt"-gated; the vehicle 50 % VAT rule is **art. 298 alin. (1)** with **six** exception categories and **no** *foaie de parcurs* requirement for the 50 % branch; the income-tax list has **five**; the two regimes are independent; there is **no de-minimis** in art. 300; e-Factura can be the condition that decides a line; and the computed deductible VAT is **D300 rd. 30 plus adjustments on rd. 33/34**, not one number.

**Does not settle:** the Titlul IV ordering of VAT vs the 50 % cap (documented negative in both titles — **B-87 stays open, and it is a decision, not a search**); whether the EU derogation survives 2026; whether art. 298 alin. (4^1) ever switches on; the 100–400 euro simplified-invoice exception; and D394.

---

## 10. Gap-fill pass — three closed, one opened (12 Oct 2026)

**Gap 1 — the 2026 amending acts did not touch the deduction machinery. Clean negative, per article.** **art. 300, 301, 304, 305, 307, 316, 322: not amended** by Legea 239/2025, OUG 78/2025 or OUG 89/2025. Legea 239/2025 amends Cod fiscal only through art. XII and contains **zero** hits for any article in 265–332, for „Titlul VII", and for „taxei pe valoarea adăugată". **OUG 78/2025 does not amend Cod fiscal at all** — its seven points amend Legea 239/2025 itself, all Titlul IX local taxes. OUG 89/2025 touches art. 18¹, 45, 46², 51, 52, 54, 115, then accize and local taxes, and abrogates Titlul X from 2027 — **nothing in 265–332**.

**⚠️ But a fourth act did, and it was outside that scope: OG 22/2025.** It introduced **art. 316 alin. (1¹)** — fixing **in law**, not in the normele, the date from which registration is valid: data depășirii plafonului (lit. b)), data solicitării (lit. c)), „a 5-a zi următoare celei în care persoana solicită înregistrarea" (lit. d)), data încetării regimului 310² (lit. e)), data comunicării deciziei din oficiu (lit. f)). It also changed **art. 310 alin. (6)** (înregistrare „cel târziu la data depășirii plafonului"), introduced **art. 310¹** and **art. 310²** — **both cross-border**, for persons established in other Member States, **not** a domestic micro-enterprise regime (see §11.1, which corrects this paragraph) — and **art. 319 alin. (12) lit. c)**. **Note: `research/11` §6 had already established the plafon, art. 316 alin. (1) lit. b) and alin. (1¹) lit. b) on 2026-10-09.** **Since the deduction right is registration-gated, the registration-date rule is not a side detail — it is the switch.**

**Gap 2 — documented negative, and it is now airtight.** Searched the ANAF consolidated text in a browser over delimited ranges: **Titlul VII law, art. 265–334 = 463.145 chars**; **Titlul VII Norme = 610.764 chars**. In the law: `nedeductibil` **0**, `cheltuial` **0**. Every operative phrase probed returned **0**: „constituie cheltuială", „reprezintă cheltuială", „devine cheltuială", „se include în cost", „cheltuială deductibilă", „deductibilă la impozit". The 6 `nedeductibil` hits in the Norme are **D300 mechanics and worked examples** („diferența de 4.000 lei se înscrie … ca taxă nedeductibilă"), not a cost rule. **There is no primary Titlul VII hook.** The „non-deductible VAT is a cost" idea comes from accounting law (OMFP 1.802/2014, *cost de achiziție*) plus Titlul IV — **not from Titlul VII**, and the accounting order was **not** verified in this pass.

**Gap 3 — split, and my own citation was wrong again.** (i) The e-Factura exception at OUG 120/2021 art. 10 alin. (1) is **bon-fiscal-only**: „Fac excepție **bonurile fiscale** … care îndeplinesc condițiile unei facturi simplificate". A *factură simplificată* that is an invoice, in domestic B2B, is **inside** the obligation. (ii) The 100–400 euro band is **not self-executing**: art. 319 alin. (13) requires **an individual MF order**, per the procedure in Norme pct. 94 alin. (2) — consultation of the VAT Committee at the request of the interested person, then a ministerial order „fie emiterea de facturi conform art. 319 alin. (13) lit. a) …, fie … lit. b)". **No such general order was found in force.** (iii) **Ordinul 410/2021 is the wrong order** — it is OMF 410/2021 *pentru reglementarea unor aspecte contabile*, amending OMFP 1.802/2014. The e-Factura instruments are **Ordinul 1.365/2021** (procedura RO e-Factura, MO 1065/08.11.2021) and **1.366/2021** (RO_CIUS). (iv) **Whether deduction survives a domestic B2B invoice never transmitted through e-Factura is genuinely unsettled** — no ANAF interpretative note, no settled case law found. **Do not let the app assert an answer.** Also live: art. 319 alin. (21) lit. f) makes the beneficiary's VAT code a statutory minimum on simplified invoices (from 1.1.2025); **art. 10 alin. (7) is now 5 *working* days** (OUG 89/2025, from 1.1.2026); and **OUG 6/2026 art. IX** exempts CNP-identified suppliers from e-Factura **until 1 June 2026**.

**Gap 4 — both derogations, checked 12 Oct 2026, both can change.**
- **Vehicles: extension proposed, NOT adopted.** Chain: 2012/232 → 2015/156 → 2017/2012 → 2020/1262 → **(EU) 2024/1641, applying 1.1.2024–31.12.2026**. Romania's request registered **19 May 2026**; Commission proposal **10 Sept 2026**, **COM(2026) 457 final**, file **2026/0253 (NLE)**, **ST 13267/26**, replacing art. 5 paras 2–3 with „applies from **1 January 2027 to 31 December 2029**". EUR-Lex procedure state: **„Ongoing"**, two steps only (PROPOSAL, NEGOTIATION). **Historically these take months** (2024/1641: request 14.9.2023 → adoption 24.5.2024), so a 1 Jan 2027 gap is a real risk.
- **Residential buildings: not granted, not operative.** art. 298 alin. (4¹) (OUG 115/2023 art. LIII pct. 116) enters force only „începând cu data de 1 a lunii următoare datei de la care România este autorizată să aplice o măsură specială de derogare". In the 2026 consolidation it is still a **future-effect note**. The art. 395 chain for Romania contains **only** the vehicles measures; COM(2026) 457 covers motorised road vehicles only. **Keep it switched off.**

**Caveat on the derogation check:** the Council's public register is a JS app and EUR-Lex's search endpoint blocked non-browser fetches, so „not adopted" and „not granted" rest on the EUR-Lex procedure state plus absence from the Official Journal — strong, but not a positive register read. **Re-check in November–December 2026.**

---

## 11. Registration-regime pass — what is actually new (12 Oct 2026)

**Stated plainly first: part of this pass was redundant.** `research/11` §6 already established, on 2026-10-09, the **395.000-lei plafon**, art. 316 alin. (1) lit. b) „cel târziu la data depășirii plafonului", the effective-date rule at **art. 316 alin. (1¹) lit. b)**, and the existence of **PL 204/2026**. That material is not repeated here. What follows is only what the pass added.

### 11.1 ⚠️ Correction — art. 310² is not a domestic micro-enterprise regime
OG 22/2025 pct. 15 inserted **two** articles, **neither** domestic: **art. 310¹** — rules for Romanian-established persons applying the SME exemption **in other Member States**; **art. 310²** — the SME exemption applied **in Romania** by persons established **in other Member States**, keyed on the individual identification code = VAT code/CIF + suffix **„EX"** (procedure: OPANAF 2.509/2025, MO 1067/20.11.2025). **A Romanian PFA is always under art. 310, never art. 310².** The two are mutually exclusive by establishment: art. 310² alin. (7) has ANAF **annul** the art. 316 registration when an EX code becomes valid in Romania. The denial wording is identical — alin. (6) lit. a)–b) mirrors art. 310 alin. (10) lit. a)–b) — so one rule can serve both, **keyed on art. 310 for a PFA and on art. 310² only for foreign „EX" counterparties.**

### 11.2 The registration states the app must model — `vatExempt` expresses none of them
- **Voluntary registration below the plafon** — art. 316 alin. (1) lit. a) pct. 2 / lit. c), effective **data solicitării** (alin. (1¹) lit. c)). Deduction **yes**.
- **Exceeded the plafon, code not yet issued** — deduction **yes, retroactive to the day of exceedance**, and **art. 310 alin. (6²)** makes the taxpayer **self-assess the gap period**: output VAT owed, minus the input deduction it *would* have had. **A late registration does not create a VAT-free gap; it creates a retroactive normal-regime period.** alin. (6¹) is the same mechanic when ANAF acts; alin. (6³) says the amounts go in the first D300 after registration.
- **Registration annulled** — art. 316 alin. (11) lit. a), c), d), e), f), g). Norme pct. 11 alin. (6): such a person „**nu beneficiază, în perioada respectivă, de dreptul de deducere** a taxei … aferente achizițiilor efectuate, **dar sunt supuse obligației de plată a TVA colectate**". **Two different dates per event** (art. 316 alin. (15)): the alin. (11) date in the person's own hands, and **the day after the register entry** for the buyer side. **Ground lit. h) (high fiscal risk) does not reach a PFA** — it is written for „societate … înființată în baza Legii nr. 31/1990"; a PFA is authorised under OUG 44/2008.
- **Re-registered after annulment** — art. 316 alin. (12), (14): deduction from the re-registration decision, and **no fallback to art. 310 before that date**.
- **Errors do not destroy the buyer** — art. 316 alin. (16) lit. b), (17): where registration or its annulment was an error, beneficiaries deduct „considerându-se că achizițiile au fost efectuate de la o persoană … înregistrată".
- **Orthogonal flag, not a status: TVA la încasare** — 11.3.

**The other letters of art. 316 alin. (1¹)**, which `research/11` did not cover: **lit. a)** the fiscal-registration date, or **the Registrul Comerțului date** where VAT was requested at incorporation; **lit. c)** data solicitării; **lit. d)** the 5th day after the request (non-established cases); **lit. e)** the date the 310² exemption ceases; **lit. f)** the date of exceedance where ANAF registers **ex officio**; **lit. g)** the date the ex-officio decision is communicated.

**⚠️ The Norme were never updated and now contradict the law.** Norme Titlul VII pct. 90 alin. (1) still says registration is valid from „prima zi a lunii următoare celei în care persoana … solicită înregistrarea" and from „data comunicării certificatului". **Implement art. 316 alin. (1¹), not pct. 90.**

### 11.3 TVA la încasare — a second deferral, running in both directions
**My article numbers were wrong again: there is no art. 133¹–133⁵.** The scheme is **art. 282 alin. (3)–(8)** CF, notified under **art. 324 alin. (12), (14)**. **Plafon, as amended by OUG 8/2026 (MO 147/25.02.2026) art. 6 pct. 38: „a) 5.000.000 lei, în perioada 1 martie–31 decembrie 2026; b) 5.500.000 lei, începând cu data de 1 ianuarie 2027"** — 4.500.000 before 1 March 2026. **The ghidfiscal consolidation still shows 4.500.000 and the Norme still reference 2.250.000: both stale.**

**Two independent triggers, both payment-conditioned, not invoice-conditioned:**
- **art. 297 alin. (3)** — the buyer's own scheme: „Dreptul de deducere … **este amânat până în momentul în care taxa … a fost plătită furnizorului/prestatorului său**", with carve-outs for AIC, import and reverse charge.
- **art. 297 alin. (2)** — the supplier's scheme: VAT bought **from** a cash-accounting person is deferred until that supplier is paid.
- **art. 319 alin. (20) lit. p)** requires the mention „TVA la încasare" on the invoice — the machine-readable signal on the incoming document. **A PFA can use the scheme, including from the moment it registers** (art. 282 alin. (4)).

### 11.4 A PFA crossing the plafon recovers pre-registration VAT by adjustment, not by the general rule
The Norme for art. 297 alin. (14) **expressly exclude** the art. 310 case from the general pre-registration deduction and route it elsewhere: „În cazul micilor întreprinderi care au aplicat regimul special de scutire … taxa pentru achiziții efectuate înainte de înregistrare se deduce **potrivit prevederilor pct. 83 și 84**." **Norme pct. 83 alin. (11)** gives the positive adjustment — stock, unused services, capital goods still inside the adjustment period, fixed assets not fully depreciated, and acquisitions yet to be obtained — recorded in the first D300 after registration (alin. (12)). **And alin. (13): a pre-registration invoice „nu trebuie să conțină mențiunea referitoare la codul de înregistrare în scopuri de TVA"** — the app must **not** reject those invoices for a missing buyer code. **Caution: the paragraph number differs between consolidations (pct. 66 vs pct. 67; alin. (14) vs (16)). Do not hard-code it.**

### 11.5 An invoice from an art. 310 supplier can never support deduction
Art. 310 alin. (10) lit. b) — „nu are voie să menționeze taxa pe factură". **Norme pct. 83 alin. (15)** closes it: a person who wrongly invoiced with VAT „**este obligată să storneze facturile emise**", and „**Beneficiarii unor astfel de operațiuni nu au dreptul de deducere sau de rambursare a taxei aplicate în mod eronat**". **Hard rule: VAT on an invoice from an art. 310 supplier is non-deductible at any rate; the remedy is stornare.** There is **no statutory „TVA neaplicabilă" formula** — that wording is practice only; the hooks are art. 310 alin. (10) lit. b) and art. 319 alin. (20) lit. l).

**Also new:** **art. 319 alin. (12) lit. c)** lets a person in the art. 310 / 310² exemption issue **simplified invoices at any value** — a permission, not an obligation. And **art. 310 alin. (2)** now restricts the reference turnover to operations **with the place in Romania** (plus Norme: advance invoices count, paid or unpaid).

### 11.6 The forms — and a PFA does not use 010
The 700 instructions are explicit: **070** for „persoanele fizice autorizate potrivit OUG 44/2008", **010** for others. A PFA exceeding the plafon files **070** (or **700** electronically), **Subsecțiunea I**, **rând 1.5 + rând 1.6 = the date the plafon was exceeded**, and the instructions already cite art. 316 alin. (1¹) lit. b). **OPANAF 15/2026** (MO 17/14.01.2026) replaced 010/070/700 but only for the logistic-fee and accise lines. **OPANAF 58/277/C/2026** (MO 132/18.02.2026) amended the **ONRC „Cerere de înregistrare fiscală"**, not 010/070/700, adding **rând 4.5** for opting into TVA la încasare at registration. **OPANAF 2633/2025** aligned the ex-officio procedure (OPANAF 2012/2016) to alin. (1¹).

### 11.7 Pending, not law
**L204/2026** would replace the same-day rule with **3 working days** and move the normal regime to **the day after the VAT code is communicated**, plus a new art. 330 alin. (3¹) allowing correction invoices for the gap period **with deduction for the beneficiaries**. Adopted by the Senate 26.05.2026; „Trimis la Cameră pentru dezbatere"; no Camera registration number found. **If enacted the effective-date rule flips — model it as a date-versioned policy, not a constant.**
