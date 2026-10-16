# Research 41 — the other-income flags are not the legal categories

**Research pass for PG-6d / 12F (B-41).** Researcher pass returned 12 Oct 2026; consolidation used is the Ministry of Justice / Portal Legislativ text (doc id 171282) with per-article views at „versiune 8 august 2026". **Verification date for every quotation: 12 October 2026.**

**Source deviation, stated rather than papered over:** Portal Legislativ (`legislativ.ro`) was **unreachable from the research environment (DNS failure)**. The consolidation actually used is `legislatie.just.ro` plus the `legislatie.info` per-article views of the same document. ANAF PDFs carry the amendment history.

---

## 1. Headline

**Four of the five flags can be anchored to a letter of art. 155 alin. (1) — but only two of them unambiguously, and one has no referent at all.**

The CASS income list is **closed**. Art. 155 alin. (1) (verbatim, current consolidation):

> „Contribuabilii la sistemul de asigurări sociale de sănătate, prevăzuți la art. 153 alin. (1) lit. a)-d), datorează, după caz, contribuția de asigurări sociale de sănătate pentru veniturile din România și din afara României … realizate din următoarele categorii de venituri: **a)** venituri din salarii și asimilate salariilor, definite conform art. 76; **a¹)** abrogată; **a²)** venituri din pensii, definite conform art. 99; **b)** venituri din activități independente, definite conform art. 67; **c)** venituri din drepturi de proprietate intelectuale, definite conform art. 70; **d)** venituri din asocierea cu o persoană juridică, contribuabil potrivit titlului II sau titlului III, pentru care sunt aplicabile prevederile art. 125; **e)** venituri din cedarea folosinței bunurilor, definite conform art. 83; **f)** venituri din activități agricole, silvicultură și piscicultură, definite conform art. 103; **g)** venituri din investiții, definite conform art. 91; **h)** venituri din alte surse, definite conform art. 114; **i)** indemnizațiile de asigurări sociale de sănătate … codurile de indemnizație 01, 07 și 10 …; **j)** indemnizații de șomaj …; **k)** indemnizații lunare …; **l)** ajutorul de incluziune …; **m)** drepturi bănești acordate potrivit actelor normative prevăzute la art. 153 alin. (1) lit. f⁹)."

**There is no dividend letter.** Lit. **i)** is *medical-leave indemnities*. Dividends reach CASS only through **lit. g)**.

### The mapping

| Flag | Verdict |
|---|---|
| `imobiliare` | **Two-way.** Lit. **e)** if passive letting from personal patrimony; lit. **b)** if the letting *is* the PFA's activity — art. 83 alin. (1) expressly excludes independent-activity income. |
| `autovehicule` | **Two-way**, same fork. Art. 83 alin. (1) covers „cedarea folosinței bunurilor **mobile** și imobile", so a car let passively is lit. e); a rent-a-car business is lit. b). |
| `dividende` | **Unambiguously lit. g)** — art. 91: „Veniturile din investiții cuprind: a) venituri din dividende". |
| `concesiune` | **No referent.** A whole-code search of the consolidated Cod fiscal returns **zero** matches for „venituri din concesiune". Every hit for „concesiune" is Title II deductibility/depreciation language or Title VI local-tax language. **Any mapping would be the app's choice.** |
| `alte` | **Lit. h) only if it means art. 114.** As a free-form catch-all it has no referent and **must be refused** — see §5, it can sweep in income that must never cumulate. |

---

## 2. What the law measures, per category — it is not gross receipts

Art. 170 alin. (4) (verbatim, the measurement list):

> „**Încadrarea în plafonul anual** de cel puțin 6, 12 sau 24 de salarii minime brute pe țară, după caz, **se efectuează prin cumularea veniturilor prevăzute la art. 155 alin. (1) lit. c)-h)**, după cum urmează: **a)** venitul net din drepturi de proprietate intelectuală …; **b)** venitul net distribuit din asocieri cu persoane juridice …; **c)** venitul net pentru veniturile din cedarea folosinței bunurilor, stabilite potrivit art. 84-85; **d)** venitul și/sau câștigul/câștigul net din investiții, stabilit conform dispozițiilor art. 94-97. … iar în cazul veniturilor din dividende se iau în calcul **dividendele plătite, diminuate cu impozitul reținut**, distribuite începând cu anul 2018; **e)** venitul net sau norma de venit, după caz, pentru veniturile din activități agricole, silvicultură și piscicultură …; **f)** **venitul brut**, câștigul și/sau venitul impozabil din alte surse, stabilit potrivit art. 114-116."

**FACT:** the figure is measured **per category, by that category's own rule** — net for lit. c), d), e), g); **gross only for lit. h)**. Dividends are **cash paid minus withheld income tax**, not gross.

**FACT — the normă de venit is gone for rentals from 2026.** The words „sau norma de venit, după caz" were **deleted** from the rentals limb by Legea 239/2025 art. XII pct. 19, applicable from 2026 incomes. It **survives** for lit. f) agricultural income. This matches `research/30` and `research/38`; recorded here only for its consequence on the ladder.

**FACT — exclusions.** Art. 170 alin. (5): „La încadrarea în plafonul prevăzut la alin. (4) nu se iau în calcul veniturile neimpozabile, prevăzute la art. 93 și 105."

---

## 3. The ladder is one cliff per person, not a per-category ladder

Art. 170 alin. (2) (verbatim):

> „Persoanele fizice care în anul fiscal pentru care se depune declarația prevăzută la art. 122 au realizat venituri din cele prevăzute la art. 155 alin. (1) lit. c)-h), **din una sau mai multe surse și/sau categorii de venituri**, datorează contribuția de asigurări sociale de sănătate la o bază de calcul stabilită potrivit alin. (3), **dacă în anul de realizare a veniturilor valoarea cumulată a acestora este cel puțin egală cu 6 salarii minime brute pe țară**."

Art. 170 alin. (3) speaks of „**Baza anuală de calcul** … în cazul **persoanelor** care realizează venituri din cele prevăzute la art. 155 alin. (1) lit. c)-h)", and art. 174¹ alin. (1) applies the rate to „**bazei anuale de calcul menționate la art. 170 alin. (3)**" — singular.

**FACT, four consequences:**
1. **One threshold, one base, one CASS** for the whole lit. c)–h) block. There is no per-category ladder.
2. **Below 6 SM cumulated there is no CASS at all** for lit. c)–h) — alin. (2) is a condition precedent, not a rate.
3. **It is a cliff, not a marginal rate.** At 24.300 lei cumulated the base is 6 SM (CASS 2.430 lei); at 48.600 it jumps to 12 SM (4.860); at 97.200 to 24 SM (9.720). Ranges are inclusive at the lower bound.
4. **lit. b) never joins the ladder.** The PFA's own net runs on art. 170 alin. (1) — cumulated net, **capped at 72 SM from 2026 incomes** (Legea 239/2025 art. XII pct. 19, applicable „începând cu veniturile aferente anului 2026"), with the 6-SM floor of art. 174 alin. (6). **Dividends never enter the 72-SM cap; PFA net never enters the 6/12/24 test.**

**Corroborated by the DU 212 form itself** (instructions published in Monitorul Oficial nr. 1207 bis, 29 Dec 2025 — read from a mirror copy, see §7): subsecțiunea **2.2** is titled for art. 155 alin. (1) lit. c)-h), carries **one** set of three tick-boxes for the three rungs, and **per-category lines** — 1.1 IP rights, 1.2 venit distribuit din asocieri, 1.3 cedarea folosinței bunurilor, 1.4 venit și/sau câștig din investiții, 1.5 agricole/silvicultură/piscicultură, 1.6 alte surse — feeding **one** total („Venituri realizate pentru încadrarea ca plătitor de CASS") and then rd. 2 „Bază anuală de calcul al CASS". **Separate lines per category, one cumulated total, one ladder selection per person.**

---

## 4. Art. 174 alin. (7) lit. b) — two readings, and whether the app can evaluate it

Art. 174 alin. (6) and (7) verbatim:

> **(6)** „În situația în care baza de calcul prevăzută la art. 170 alin. (1), cumulată din una sau mai multe surse de venit din cele prevăzute la art. 155 alin. (1) lit. b) … **este mai mică decât cea corespunzătoare unei baze de calcul egale cu nivelul de 6 salarii minime brute pe țară**, persoanele fizice datorează contribuția … respectiv o diferență de contribuție … **până la nivelul celei corespunzătoare bazei de calcul egale cu 6 salarii minime brute pe țară** …"
> **(7)** „Diferența de contribuție … prevăzută la alin. (6) **nu se datorează** în cazul în care, în anul fiscal pentru care se depune declarația …, persoana fizică a realizat venituri: **a)** din salarii și asimilate salariilor la un nivel cel puțin egal cu 6 salarii minime brute pe țară; sau **b)** din cele prevăzute la art. 155 alin. (1) lit. c)-h), **pentru care datorează contribuția de asigurări sociale de sănătate la un nivel cel puțin egal cu 6 salarii minime brute pe țară**; **c)** venituri din pensii, definite conform art. 99." (lit. c) added by Legea 141/2025 art. II pct. 34, from 2025 incomes whose term runs to 25 May 2026.)

- **Reading A — income level:** the lit. c)–h) *income* reaches 6 SM (24.300 lei).
- **Reading B — base level:** the person owes CASS **on a base** of at least 6 SM. A 10 % contribution can never itself equal 6 SM, so „nivel" must denote the **calculation base**.

**INTERPRETATION (the Researcher's, and mine):** the relative clause „**pentru care datorează contribuția** … la un nivel" qualifies the *contribution*, so **Reading B fits the text better**; ANAF's own summary phrases it the same way. **No official interpretation resolving A vs B was found** — only ANAF paraphrase.

**The readings converge in the ordinary case**, because the ladder's first rung triggers exactly at cumulated income ≥ 6 SM. **They diverge in three cases the engine must handle:**
1. **Neimpozabile income** (art. 170 alin. (5)) — gross receipts can exceed 24.300 while the *measured cumulated* amount does not. Reading A would wrongly grant the exception.
2. **Persons exempt under art. 154 alin. (1)** — they do not „datora" CASS on that income, so Reading B fails while Reading A would exempt them.
3. **CASS withheld at source** under art. 174¹ alin. (3)–(4) — both readings are satisfied; the withheld amount is credited (art. 174¹ alin. (6), DU rd. 6).

**Can the app evaluate the exception? Only with amounts.** It is defined by reference to a **computed** quantity. With boolean flags the app cannot evaluate alin. (7) lit. b) at all — and cannot evaluate alin. (6) either, which compares the actual lit. b) base against 6 SM. **This is exactly what `calcCass` already reports**: *„alin. (7) lit. b) … nu a putut fi evaluat — nu a fost nici predat"*.

---

## 5. The finding that changes the scope: the flag set is not the legal category set

**The five flags omit three ladder categories: lit. c) (drepturi de proprietate intelectuale), lit. d) (asocierea cu o persoană juridică / venit distribuit) and lit. f) (activități agricole, silvicultură și piscicultură).**

Because the ladder cumulates across **all** of lit. c)–h), **an engine that knows only these five flags cannot compute the ladder honestly even after amounts are added** — it would be missing three of the six inputs to a sum. That is not a rounding gap; a missing lit. d) distribution can move a person from no CASS to a 12-SM base.

**And `alte` is wider than lit. h).** Art. 114 alin. (1) defines „alte surse" as taxable income **not** falling under art. 61 lit. a)-h) — and art. 61 lit. g) **premii și jocuri de noroc** and lit. h) **transferul proprietăților imobiliare** are income-tax categories that **do not appear in art. 155 alin. (1) at all and never attract CASS**. A free-form "other" flag therefore **can manufacture a liability**. If `alte` is not constrained to art. 114, refuse it.

**And `concesiune` must not be encoded as a category.** If the PFA *exploits* a concession, the receipts are its own activity income → lit. b) (art. 67 alin. (1)). If the person merely grants use of their own good under a concession-type contract from personal patrimony, it falls under art. 83 alin. (1), which is contract-type-neutral → lit. e). **Both are INTERPRETATION; the app must ask what the contract is, not store a label.** For comparison, ANAF classifies *arendă* as „cedarea folosinței bunurilor" → lit. e), and art. 174¹ alin. (3) treats arendă inside the lit. c)–h) block.

---

## 6. What the engine would need, per tax year, per person

- **Year constants:** the **1 January SM** governs (art. 135¹ alin. (3)) — 4.050 lei for 2026, so 6 SM = 24.300, 12 = 48.600, 24 = 97.200, 72 = 291.600. ANAF restates it: „Salariului minim brut … în vigoare la data de 1 ianuarie a anului de realizare a venitului … indiferent dacă în cursul aceluiași an se utilizează mai multe valori". **And which cap applies to lit. b): 60 SM for incomes ≤ 2025, 72 SM from 2026.**
- **Per-category measured amounts, not flags** — one figure per ladder category, each measured by art. 170 alin. (4)'s own rule (IP net; asocieri net distribuit; rentals net after 20 %/30 % forfetar; agricultural net **or** normă; investments net, dividends = plătite minus impozit reținut; alte surse **brut**).
- **Neimpozabile amounts stored but flagged as non-cumulating** (art. 93, art. 105).
- **The lit. b) side** — cumulated net, pierdere fiscală / net = 0 (art. 174 alin. (2)), CASS reținut la sursă (art. 68¹, art. 174 alin. (10)–(11)), CASS opțional (art. 180).
- **Exception inputs** — annual gross salary, pension status (art. 99), art. 154 alin. (1) exemption status, and the computed ladder base.
- **Facts that decide the letter, not the amount** — whether the letting is an independent activity (art. 67 alin. (1), (1¹); art. 83 alin. (1) and (4)); room count (≤ 7 → lit. e), > 7 → lit. b)); whether the payer is a legal entity keeping accounting records (art. 84¹ — withholding, still cumulated for CASS).
- **CASS already withheld** under art. 174¹ alin. (3)–(6), to avoid double counting (DU subsecțiunea 2.2 rd. 6).

---

## 7. Unknown — do not encode

1. **Does the art. 174 alin. (6) floor bite when the PFA has a pierdere fiscală or net = 0?** Art. 174 alin. (2) says such persons „nu datorează contribuția … potrivit art. 170 alin. (1)", yet alin. (6) speaks of a base „mai mică decât … 6 salarii". ANAF's summary of the exceptions does not mention the carve-out. **Unresolved.**
2. **The FY2026 DU form** (2026 incomes, filed 2027) — whether subsecțiunile 2.1/2.2 keep this shape and whether the footnote moves from „60 salarii minime … 243.000 lei" to „72 … 291.600 lei".
3. **Art. 154 alin. (1)'s current letter list and thresholds** — the pensioner threshold was seen only quoted second-hand („până la suma de 4.000 lei lunar"). **Not relied on.**
4. **Whether any of the five flags can carry neimpozabile amounts** excluded by art. 170 alin. (5) (art. 93 investments, art. 105 agricultural).
5. **Whether a non-agricultural „concesiune" could be treated as arendă** (art. 80). ANAF treats *agricultural* arendă as cedarea folosinței; non-agricultural concession grants are not addressed.
6. **No official interpretation of art. 174 alin. (7) lit. b)** exists — only ANAF paraphrase. Reading A vs B is open.

**Sources kept (primary/official):** `legislatie.just.ro` Public/DetaliiDocumentAfis/171282 (whole-code search for „concesiune"); `legislatie.info` per-article consolidated views of art. 155, 170, 174, 174¹, 91, 67 (versiune 8 august 2026); ANAF DGRFP Brașov amendment tables `titl_V_cf.pdf`, `titl_IV_cf.pdf`; Legea 141/2025 full text; ANAF ghid Legea 141/2025; ANAF arendă guide; ANAF Cluj „cedarea folosinței bunurilor 2025. Noutăți 2026" (19 Mar 2026); ANAF DU 212 brochure; **Instrucțiuni de completare formular 212, Monitorul Oficial nr. 1207 bis, 29 Dec 2025** (mirror copy — the form structure in §3 rests on this and should be re-read against the official copy when reachable); ANAF București „Noutăți privind DU 2026 – exemple".

**Dropped:** legislativ.ro (**unreachable, DNS**); bzi.ro (popular restatement); noulcodfiscal.ro (pre-2026 numbering, superseded); OUG 128/2024 PDF (2025 renumbering only); civil-code/CCR material from the „concesiune" searches (irrelevant); ANAF Brașov 2018/2019 arendă guides (stale 12-SM era, used only to confirm arendă has always sat inside cedarea folosinței).
