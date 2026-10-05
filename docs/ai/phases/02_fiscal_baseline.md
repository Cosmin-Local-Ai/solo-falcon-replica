# Phase 2 — Verified 2026 fiscal baseline and rule provenance

**Status:** authoritative. **Date:** 2026-10-05. **Repo:** `/home/agent/workspace/solo-falcon-replica`,
`master` @ `82073bff72934d1db7a854e5a693554174249785`. Phase 2 worker deliverable.

## 0. Supersession

**This document supersedes `docs/ai/research/06_2026_fiscal_research.md` as the fiscal source of truth
for this repository.** That file stays on disk as a research record but is no longer citable: it is
internally contradictory and, on four points, wrong. Where any other live document (`STATE.md`,
`PLAN.md`, `decisions/*`, code comments) conflicts with this file, **this file wins.** The frozen
archive `docs/ai/steps/**` is not corrected and is never evidence of current behaviour.

### The four points on which `research/06` was wrong

| # | `research/06` claim | Verdict | Correct position |
|---|---|---|---|
| 1 | **CAS minimum base.** Contradicts itself: `:148` "12 minimum wages = 48,600 lei"; `:195` "6 minimum wages = 24,300 lei — **CORRECTED**"; `:220` "6 SM (24,300 lei) … 12 SM is the **older** figure". The code followed the "corrected" value. | **WRONG** — the "correction" inverted the answer. | **12 SM = 48,600 lei** is the 2026 minimum base for a PFA în sistem real: CF **art. 148 alin. (2) lit. a)**. The 6-SM tier survives only in **art. 170 alin. (2)-(3)** (CASS, art. 155 alin. (1) lit. c)-h) income), not for art. 68 income. |
| 2 | **VAT threshold.** `:190` "OUG 22/2025 … 2025 ONLY … **the 395,000 lei figure is NOT the 2026 threshold** — for 2026 the standard 300,000 lei applies", plus "Dashboard warning: do not use 395,000 lei for 2026". | **WRONG**, and the act is misnamed. | **395,000 lei is the 2026 threshold.** CF **art. 310 alin. (1)** as amended by **Ordonanța nr. 22 din 28.08.2025 (an OG, not an OUG), MO 806 din 29.08.2025**, in force 01.09.2025; art. III grandfathers the 300,000-lei transition. The code's 395,000 is right; the doc that called it wrong was wrong. |
| 3 | **A 30% deductible-expense cap** conditioning sistem-real deductibility. | **PHANTOM — no such provision exists.** | Full Titlul IV "30%" scan returns exactly three hits, none a sistem-real cap: **art. 68^3 alin. (2)** (30% forfetară expense rate for cazare, new via Legea 239/2025 art. XII pct. 33 from 01.01.2026), **art. 85 alin. (2)** (30% forfetar, închiriere 1–7 camere), **art. 106** (norma de venit reduction where calamity destroys >30% of agricultural surface). **Zero** hits conditioning sistem-real deductibility on a 30% floor. |
| 4 | **A 16% income-tax component** for PFA sistem real (`:150` "16% progressive rate … applies when … total incomes … exceed 6 × national average gross salary"; `:222` "Income tax 10% + 16% progressive"). | **WRONG for this entity type.** | 16% applies only to two "alte venituri" items: CF **art. 115 alin. (1) lit. b)** — "16% pentru veniturile prevăzute la art. 114 alin. (2) lit. h) și i)" (benefit-in-kind to a participant in a legal entity; above-market purchase from that entity). Art. 114 alin. (1) confines the category to incomes **not** falling under art. 61 lit. a)-h). PFA sistem real income is art. 61 lit. a) / art. 68 → **outside art. 114 entirely, taxed at 10%** (art. 123 alin. (1)). |

### 0.1 Citation corrections applied to live documents

| Wrong attribution | Correct attribution | Corrected in |
|---|---|---|
| "OUG 22/2025" for the 395,000-lei VAT threshold | **Ordonanța nr. 22 din 28.08.2025** — an **OG**, the Portal Legislativ labels it ORDONANȚA, not ORDONANȚA DE URGENȚĂ — MO 806 din 29.08.2025, in force 01.09.2025. A separately numbered OUG 22/2025 exists and is unrelated to tax; **its MO number and subject are UNVERIFIED and are not cited here** (never opened). | `research/06` supersession banner; `decisions/09_IMPLEMENTATION_ARCHITECTURE.md:179` inline. `steps/01_real_baseline.md:294` and `research/06:190` left as historical text under the banner. `STATE.md`/`PLAN.md` no longer carry the string. |
| CAS 12/24-SM tiers attributed to a "22/2025" act | **OUG nr. 128 din 7 noiembrie 2024, Punctul 20, Articolul I, MO 1125 din 11.11.2024**, portal note "se aplică începând cu veniturile aferente anului 2025". | §2; `package2026.ts` CAS provenance. |
| SM anchor justified by an inference about HG 146/2026's scope | **CF art. 135^1 alin. (3)** — "se ia în calcul valoarea salariului minim brut pe țară … în vigoare la data de 1 ianuarie a anului de realizare a venitului". | §3; `package2026.ts` comments. |
| "OUG 6/2026 (MO 30.01.2026)" | **Two distinct acts were conflated.** The CF-amending one is **ORDONANȚA nr. 6 din 30 ianuarie 2026, MO 77 din 30.01.2026** (an OG). The other is **OUG nr. 6 din 19 februarie 2026** (Fondul de garantare pentru plata creanțelor salariale), which amends **no** CF article and only references art. 147 alin. (1). | §8.1, §8.3. |
| "HG 146/2026 sets **8,600 lei** effective **1 August 2026**" | **Hallucination — void.** HG nr. 146 din 12 martie 2026, MO 196 din 13.03.2026 sets **4.325 lei** from **1 iulie 2026** and abrogă HG 1.506/2024. No 2026 act sets 8,600 lei. The 2026 SM is **4,050 lei** on 1 ianuarie (HG 1.506/2024, MO I 1185/28.11.2024). | §3. |

---

## 1. Confidence scale

**HIGH** = verbatim text read in a primary source (Portal Legislativ consolidated act, or the act's own
ANAF PDF) plus, where relevant, a per-article amendment note. **MEDIUM** = primary source read but
attribution or scope inferred. **LOW / UNVERIFIED** = not established; must ship as `REVIEW_REQUIRED`,
never as a computed rule.

Primary corpus: Portal Legislativ consolidated Cod fiscal **doc 312601** (consolidation history newest
entry **08.08.2026**, i.e. it post-dates every 2026 OUG screened) plus the amending acts' own ANAF PDFs.

---

## 2. CAS (CF Titlul V Cap. II)

| Item | Verified 2026 value | Act + article | Amendment / publication | Confidence |
|---|---|---|---|---|
| Rate | 25% | CF art. 138 alin. (1) | — | HIGH |
| **Minimum base** | **12 SM = 48,600 lei** (at 4,050 lei/month) | **CF art. 148 alin. (2) lit. a)**: "Baza anuală de calcul al contribuției de asigurări sociale, în cazul persoanelor care realizează veniturile prevăzute la art. 137 alin. (1) lit. b) și b^1), o reprezintă venitul ales de contribuabil, care nu poate fi mai mic decât: a) nivelul de 12 salarii minime brute pe țară, în cazul veniturilor realizate cuprinse între 12 salarii minime brute pe țară inclusiv și 24 de salarii minime brute pe țară." | **OUG nr. 128/2024, Punctul 20, Art. I, MO 1125 din 11.11.2024**; applies "începând cu veniturile aferente anului 2025" | HIGH |
| **Maximum base** | **24 SM = 97,200 lei** is the tier boundary, **not a cap** — above it the base is the actual venit ales | CF art. 148 alin. (2) | same | HIGH (text) / see §2.1 on the code's clamp |
| 6-SM tier | **Does not exist for persoane fizice with art. 68 income.** It now sits only in art. 170 alin. (2)-(3) (CASS, art. 155 alin. (1) lit. c)-h)) | CF art. 170 alin. (2)-(3) | OUG 128/2024 removed it from the PF CAS ladder | HIGH |
| Salary/pension exemption | Not verified — no rule reads `salaryStatus`/`pensionStatus`. CF art. 147 alin. (1) is the exemption hook (referenced, **not read**) | CF art. 147 alin. (1) | — | **UNVERIFIED — Phase 3 dependency** |

### 2.1 Gap Phase 3 must not paper over

Art. 148 alin. (2) is a **ladder of alternative bases**, not a clamp. Between 12 and 24 SM the base is
12 SM; **above 24 SM the base is the actual venit realizat** ("venitul ales de contribuabil"), so a hard
`Math.min(effectiveBase, max_base)` clamp at 24 SM **under-states** CAS for high earners. The code's
`max_base` / `max_cas` parameters encode a cap the article does not state. **This corrects the Phase 2
planning note that told Phase 3 to "enforce `max_cas`"** — Phase 3 must model the tiers instead.

Register mechanics (OMFP 3254/2017 art. 5 alin. (5), verbatim): CAS "nu se înregistrează în Registrul
de evidență fiscală … Deducerea acestor cheltuieli se efectuează la **recalcularea** venitului net
anual/pierderii nete anuale, potrivit prevederilor **art. 75** din Codul fiscal, de organul fiscal
competent." **Scope precisely:** CAS/CASS are not *register* entries and are deducted at recalculare
under art. 75. It does **not** say the D212 computation omits CAS/CASS, so `src/domain/tax.ts:57-95`
subtracting CAS and CASS from net income is **not contradicted**.

---

## 3. The minimum-wage anchor

**CF art. 135^1 alin. (3)** (verbatim): "se ia în calcul valoarea salariului minim brut pe țară … în
vigoare **la data de 1 ianuarie a anului de realizare a venitului**".

This — not an inference about any HG's scope — is the legal basis for anchoring the 2026 annual
CAS/CASS multiples to the minimum wage in force on **1 January 2026**. A mid-year minimum-wage increase
**must not re-anchor** the annual 12/24/72-SM bases. The code's annual multiples (48,600 / 97,200 /
291,600) derive from **4,050 lei/month** (HG 1506/2024), consistent with art. 135^1 alin. (3); the H2
rule (`GENERAL_MINIMUM_WAGE_2026_H2`, 4,325 lei from 2026-07-01, HG 146/2026) is therefore irrelevant
to the annual fiscal bases and must not be used to re-derive them.

**RESOLVED — the numeric wage values are verified, and the code is correct.**

- **SM in force 1 ianuarie 2026 = 4,050 lei lunar**, set by **HOTĂRÂREA Guvernului nr. 1.506/2024**,
  MO I nr. 1185 din 28 noiembrie 2024, unamended and in force until 30 iunie 2026. Corroborated by
  ANAF Brașov (https://static.anaf.ro/static/10/Brasov/Brasov/web_ian_2026.pdf) and Ministerul Muncii
  (https://mmuncii.gov.ro/wp-content/uploads/2026/07/salariul_minim_2026.pdf). **HIGH.**
- **HOTĂRÂREA nr. 146 din 12 martie 2026**, MO nr. 196 din 13 martie 2026, Art. 1 verbatim: "Începând cu
  data de 1 iulie 2026, salariul de bază minim brut pe țară garantat în plată … se stabilește în bani,
  fără a include sporuri și alte adaosuri, la suma de **4.325 lei lunar**, pentru un program normal de
  lucru în medie de 166,667 ore pe lună, reprezentând 25,949 lei/oră." Art. 2 abrogă HG 1.506/2024 "la
  data prevăzută la art. 1". https://legislatie.just.ro/Public/DetaliiDocument/308231 ·
  https://static.anaf.ro/static/10/Anaf/legislatie/HG_146_2026.pdf **HIGH** (portal + ANAF copy +
  Ministerul Muncii draft, identical text).
- **The earlier "8,600 lei effective 1 August 2026" figure is VOID — it is a hallucination.** No act
  setting 8,600 lei exists for 2026. The gov.ro Nota de Fundamentare for HG 146/12.03.2026 states the
  pre-existing level verbatim: "În prezent, salariul de bază minim brut pe țară garantat în plată este
  stabilit la **4.050 lei lunar** … în conformitate cu prevederile Hotărârii Guvernului nr.1.506/2024".
  The only 2026 step is 4,050 → 4,325, mid-year.
- **The mid-year increase does not move the 2026 bases, and ANAF says so directly:** "În anul 2026 baza
  maximă de calcul pentru CASS la veniturile realizate din activități independente nu poate fi mai mare
  de **291.600 lei (72 x 4.050 lei)**" (ANAF Brașov, link above). ANAF Ploiești's DU 212 guide gives the
  same figure for both years: "(anul 2025: 4050 x 12 = 48.600 lei, **anul 2026: 4050x12 = 48.600 lei**)"
  (https://static.anaf.ro/static/10/Ploiesti/decl_activ_independente.pdf). This settles the question an
  earlier pass left open — art. 135^1 alin. (3) plus ANAF's own published lei figures, not the HG text,
  are what resolve it.

**Therefore the 2026 SM-derived bases are: 6 SM = 24,300 lei · 12 SM = 48,600 lei · 24 SM = 97,200 lei ·
72 SM = 291,600 lei.** The values already in `package2026.ts` are correct and were not changed.

---

## 4. CASS (CF Titlul V Cap. III)

| Item | Verified 2026 value | Act + article | Amendment / publication | Confidence |
|---|---|---|---|---|
| Rate | 10% | CF art. 170 alin. (1) | — | HIGH |
| **Maximum annual base** | **72 SM = 291,600 lei** | CF art. 170 alin. (1): "…care nu poate fi mai mare decât cea corespunzătoare unei baze anuale de calcul egale cu nivelul de **72 de salarii minime brute pe țară**." The alin. (1) base now references "art. 68, 68^1, 68^3 și 69". | **Legea 239/2025, Art. XII pct. 19**, MO nr. 1160 din 15.12.2025 (consolidarea 09.03.2026) — https://legislatie.just.ro/Public/DetaliiDocument/305208 . Portal note: "prevederile art. XII pct. 19 se aplică începând cu veniturile aferente anului **2026**" → 72 SM governs the **2026** income year, not 2027. | HIGH |
| Minimum base for art. 68 income | **Not established for 2026.** The 6-SM rungs are art. 170 alin. (2)-(3) and apply to art. 155 alin. (1) lit. c)-h) income, **not** to sistem-real art. 68 income. | CF art. 170 alin. (2)-(3) | OUG 128/2024 pct. 22 | **UNVERIFIED — Phase 4 dependency.** The code's `min_base` label "6 SM annual" is therefore **not sourced** for a PFA. |
| Pensioner relief | The art. 174 alin. (6) top-up to 6 SM is disapplied by **art. 174 alin. (7)**: "Diferența … nu se datorează în cazul în care … persoana fizică a realizat venituri: a) din salarii…; b) din cele prevăzute la art. 155 alin. (1) lit. c)-h)…; **c) venituri din pensii, definite conform art. 99.**" | CF art. 174 alin. (7) lit. c) | **lit. c) introduced by Legea 141/2025**, effective from 2025 incomes | HIGH |

---

## 5. Income tax (CF Titlul IV Cap. VII)

| Item | Verified 2026 value | Act + article | Confidence |
|---|---|---|---|
| Rate | **10% flat** on venitul net anual impozabil | **CF art. 123 alin. (1)**: "Impozitul anual datorat se stabilește de contribuabili în declarația unică … prin aplicarea cotei de **10%** asupra venitului net anual impozabil determinat potrivit **art. 118**." | HIGH |
| **16% component** | **Does not apply to PFA sistem real** (§0 item 4). Art. 123 alin. (1²)/(2) were amended by Legea 239/2025 Art. XII pct. 16; the 16% wording there is **câștig net anual / Cap. V**, not PFA. | CF art. 114 alin. (2) lit. h)/i); art. 115 alin. (1) lit. b); art. 114 alin. (1) | HIGH |
| Taxable base | venitul net anual impozabil per **art. 118** (venit net − CAS − CASS, with art. 75 recalculare) | CF art. 118; art. 75 | HIGH that the article is the one; MEDIUM — full art. 118 text not read in Phase 2 |

**Phase 5 premise change.** The short-circuit at `src/domain/tax.ts:52-54`
(`regime === 'impozit_pe_venit'` → `review_required`, reason "Plafonul cheltuielilor deductibile …
(30% din brut) nu este în stocul de reguli") rests on a cap that **does not exist in law**. Phase 5 is
therefore a **deletion, not an implementation** — there is no rule to author for it.

**The phantom's real neighbour (record, do not fix now).** CF art. 68 alin. (1) now reads "…cu excepția
situațiilor în care sunt aplicabile prevederile art. 68^1, **68^3** și 69", and **art. 68^3 alin. (2)** —
"Venitul net anual din prestarea de servicii de cazare se determină prin deducerea din venitul brut a
cheltuielilor determinate prin aplicarea cotei forfetare de **30%** asupra venitului brut" (new via
Legea 239/2025 art. XII pct. 33, from 01.01.2026), with the >7-camera trigger at **art. 67 alin. (1^1)**.
A PFA doing that activity is **outside sistem real entirely**. This is precisely why the phantom 30%
cap must not be re-imported by a future CAEN-aware rule: a real 30% forfetar rate exists, but it is a
*regime switch*, not a deductibility floor inside sistem real.

---

## 6. General deductibility test — CF art. 68 (verbatim, now captured)

**alin. (1)** as in force 2026: "Venitul net anual din activități independente se determină în sistem
real, pe baza datelor din contabilitate, ca diferență între venitul brut și cheltuielile deductibile
efectuate în scopul realizării de venituri, cu excepția situațiilor în care sunt aplicabile prevederile
art. 68^1, 68^3 și 69." Amended by **Punctul 4, Articolul XII din Legea 239/2025**.

**alin. (2)** — what venit brut includes. **lit. a) "sumele încasate** și echivalentul în lei al
veniturilor în natură din desfășurarea activității"; b) dobânzi din creanțe comerciale; c) câștiguri din
transferul activelor din patrimoniul afacerii; d) angajamentul de a nu desfășura/concura; e) anularea sau
scutirea unor datorii de plată; f) veniturile înregistrate de casele de marcat … taxi. Amended by
**Punctul 30, Art. I din Legea 296/2020**, MO 1269/21.12.2020. No 2025/2026 note.
**Forward dependency for Phase 9: lit. a) is "sumele încasate" — amounts COLLECTED, a cash-receipt
basis for venit brut.** The current model carries one ambiguous `date` per transaction and cannot
represent collected-vs-invoiced; that is a Phase 9 gap, not something to fix here.

**alin. (3)** — **not** venit brut: a) aporturi în numerar/natură; b) credite bancare sau împrumuturi;
c) despăgubiri; d) sponsorizări, mecenat, donații. No amendment note.

**alin. (4)** — the general deductibility test that **OMFP 3254/2017 art. 5 alin. (2) imports**, and the
gate Phase 5 must satisfy. Verbatim opening: "Condițiile generale pe care trebuie să le îndeplinească
cheltuielile efectuate în scopul desfășurării activității independente, pentru a putea fi deduse, în
funcție de natura acestora, sunt: a) să fie efectuate în cadrul activităților independente, justificate
prin documente; b) să fie cuprinse în cheltuielile exercițiului financiar al anului în cursul căruia au
fost plătite; c) să reprezinte cheltuieli cu salariile și cele asimilate salariilor …; d) să respecte
regulile privind amortizarea … titlul II; e) … investiții în mijloace fixe pentru cabinetele medicale …
art. 28 alin. (20); f) … prime de asigurare pentru: 1. active corporale sau necorporale din patrimoniul
afacerii; 2. activele ce servesc ca garanție bancară …; 3. bunurile utilizate în contracte de închiriere
sau de leasing …; 4. asigurarea de risc profesional; g) … pentru salariați pe perioada delegării/
detașării …; h) … pe perioada deplasării contribuabilului care își desfășoară activitatea individual
și/sau într-o formă de asociere … altele decât cele prevăzute la alin. (7) lit. k); i) … contribuții de
asigurări sociale plătite la sistemele proprii de asigurări sociale și/sau contribuții profesionale
obligatorii …; j) să fie efectuate în scopul desfășurării activității și reglementate prin acte normative
în vigoare; k) în cazul activelor neamortizabile prevăzute la art. 28 alin. (4), cheltuielile sunt
deductibile la momentul înstrăinării …". Amended as a whole by **OUG 79/2017 pct. 16** (MO 885/10.11.2017);
lit. a) by **OUG 50/2015 pct. 8** (MO 817/03.11.2015). **No 2025/2026 amendment to alin. (4).**
Also present: alin. (4^1) (educație profesională/duală, Legea 239/2020) and alin. (4^2) (teste COVID-19) —
neither constrains 2026. **This closes the Phase 5 blocker.**

**alin. (5)** — cheltuieli deductibile limitat. Existing caps include private education 5%, protocol 2%
of the alin. (6) base (OUG 115/2023). **Four new capped items enter for 2026 via OUG 8/2026, Art. 6
pct. 26, 27, 28** (see §8.2): lit. g) rewritten — contribuții la fonduri de pensii facultative (Legea
204/2006), "în limita echivalentului în lei a 400 euro anual pentru fiecare persoană"; new **lit. g1)**
pensii ocupaționale (Legea 1/2020); new **lit. g2)** produse paneuropene de pensii personale
(Regulamentul (UE) 2019/1.238), same €400 cap; new **lit. s)** sume plătite în scopul personal pentru
acțiuni/obligațiuni/titluri de participare ETF prin entitățile de la art. 961 alin. (1), same €400 cap,
"fără a include costurile aferente tranzacției", with a prescribed justificativ. **The 2026
deductibile-limitat list is incomplete without them.**

**alin. (7)** — non-deductible list; tail: k^4) corruption-related expenses; l) alte sume prevăzute prin
legislația în vigoare.

---

## 7. VAT — threshold and the net-of-VAT base

### 7.1 Registration threshold: 395,000 lei, unchanged for 2026

CF **art. 310 alin. (1)** (heading now "Regimul special de scutire pentru întreprinderile mici aplicabil
în România…"): "…a cărei cifră de afaceri anuală, declarată sau realizată, **nu depășește plafonul de
395.000 lei**, poate aplica scutirea de taxă…". Verified in the ANAF annotated Cod fiscal updated
through **OUG 38/2026**, and in Portal Legislativ doc 312601 where art. 310 carries **11 amendment
notes, all from Ordonanța 22/2025** (pct. 10 title, pct. 12 alin. (1)(2)(6)(8)(11), pct. 15 Cap. XII),
all "(la 01-09-2025)". **Confidence HIGH.**

- Amending act: **Ordonanța nr. 22 din 28.08.2025 (an OG), MO 806 din 29.08.2025**, in force 01.09.2025
  (art. II); art. III grandfathers the 300,000-lei transition.
- **OUG 8/2026 does NOT touch art. 310.** It raises only the *TVA la încasare* plafon — Art. 6 pct. 38
  amending CF art. 282 alin. (3): "a) 5.000.000 lei, în perioada 1 martie – 31 decembrie 2026;
  b) 5.500.000 lei, începând cu data de 1 ianuarie 2027." **Do not confuse TVA la încasare with the
  small-enterprise exemption plafon.**
- **OUG 13/2026** (05.03.2026) amends only accise provisions (art. 336, 345, 359, 367, 369, 385^1, 386,
  393^1, 435) — no art. 310.
- **Art. 310 alin. (2) caveat, recorded honestly.** "exclusiv taxa" is grammatically attached to the
  *scoatere din evidența* case, and alin. (2) also excludes fixed-asset deliveries. The VAT-exclusive
  reading is right because **no provision anywhere measures the plafon TVA-inclusiv** — not because
  alin. (2) is an unqualified global definition.
- **Code defect (not fixed in Phase 2):** the rule cites **art. 338**, which is the wrong article —
  art. 338 is not the small-enterprise exemption plafon. Corrected to art. 310 alin. (1) in provenance.
  Separately, `src/data/dashboard.ts:99-105` feeds the VAT-inclusive `ytd.revenue` to the 395,000-lei
  test (`thresholds.ts:106-113`, `FiscalBase` offers only `'gross-revenue' | 'gross-expense' |
  'net-income'`, `thresholds.ts:17`). That is a **Phase 8** defect; the threshold *value* is correct.

### 7.2 Q-NETGROSS — CLOSED: the fiscal base is NET of VAT, both venituri and cheltuieli. HIGH.

- CF art. 68 alin. (2) lit. a) has **no TVA component**; alin. (3) lists only non-income items.
- **Operative netting rule = OMFP 3254/2017** (Registrul de evidență fiscală, MO nr. 10 din 05.01.2018),
  **art. 4 alin. (3)**: "TVA colectată potrivit regulilor prevăzute în titlul VII … **nu reprezintă venit
  și nu se înregistrează în Registrul de evidență fiscală**"; **art. 5 alin. (6)**: "TVA dedusă … **nu
  reprezintă cheltuială și nu se înregistrează**…".
  https://static.anaf.ro/static/10/Anaf/legislatie/OMFP_3254_2017.pdf
- **HG 1/2016 Titlul IV Cap. II contains NO TVA netting paragraph.** A full-text scan of the ANAF
  annotated Cod fiscal cu norme (norme actualizate prin HG 602/2025) found **zero** occurrences of
  "TVA colectată" / "nu se înregistrează" anywhere in Titlul IV. **Do not cite HG 1/2016 for this.**
- **OPANAF 2736/2025** (MO nr. 1207 din 29.12.2025), anexa 2 instrucțiuni pct. 3.5.11: Rd.1 "Venit brut –
  … veniturile totale și/sau echivalentul în lei al veniturilor în natură **încasate** în anul de
  raportare"; Rd.2 "Cheltuieli deductibile, potrivit legii". **No TVA reference anywhere** → no gross-up.
  https://static.anaf.ro/static/10/Anaf/formulare/Instructiuni_D212_2736_2025.pdf
- **OPANAF 2719/2025** (precompletare, MO nr. 1 din 05.01.2026) art. 10 pre-fills "totalul venitului
  brut/net/norma de venit"; contains no TVA netting rule.
- **Reconciliation:** OMFP 170/170-2015 RJIP's "inclusiv TVA" is the *accounting* record; the fiscal base
  is the net figure per OMFP 3254/2017 art. 4(3)/5(6).
- **OMFP 3254/2017 register mechanics, verbatim, HIGH:** art. 1 alin. (1) — the register applies to
  Titlul IV contributors whose net annual income is established în sistem real; art. 3 alin. (1) —
  completed annually with total veniturilor and total cheltuielilor "efectuate în scopul realizării
  acestora"; art. 5 alin. (2) — deductible = expenses in the purpose of the activity **and meeting the
  general conditions of CF art. 68 alin. (4)**; art. 5 alin. (3) — limited deductibility per art. 68
  alin. (5); art. 5 alin. (4) — not recorded and not deductible: (a) expenses over the art. 68 alin. (5)
  limits, (b) expenses under art. 68 alin. (7).

### 7.3 NON-DEDUCTIBLE VAT for a neplătitor de TVA — **UNVERIFIED, LOW. Not a rule.**

Art. 5 alin. (6) carves out only "TVA dedusă". Art. 5 alin. (2) makes deductible only cheltuieli meeting
CF art. 68 alin. (4). Art. 5 alin. (4) lists the exclusions (over-limit, art. 68 alin. (7)) and
**non-deductible VAT is not among them** — but **no operative sentence anywhere affirmatively makes it
deductibilă**. All "TVA nedeductibilă" hits in the consolidated code are Titlul VII mechanics
(art. 268(11), art. 297). The reading that non-deductible VAT sits inside the expense amount is an
**inference, Medium**. **Marked `REVIEW_REQUIRED` in code and in the UNVERIFIED register — it must not
be shipped as a sourced, computed rule.**

---

## 8. The 2026 emergency-ordinance screen

### 8.1 art. 135^1 / 148 / 170 / 310 — clean, now positively confirmed

**No 2026 act touches CF art. 135^1, 148, 170 or 310.** This was first derived from the absence of
inline amendment notes in consolidated doc 312601 and is now corroborated by direct read of the acts —
which is the method that must be used (see §11).

**Complete register of 2026 Cod fiscal amending acts**, enumerated from the note set of consolidated doc
312601 (2,021 notes read; consolidation of 08.08.2026):

| Act | MO | CF exposure |
|---|---|---|
| **ORDONANȚA nr. 6 din 30 ianuarie 2026** (an OG, not an OUG) | MO 77 din 30.01.2026 | 5 notes, e.g. Art. IV pct. 1 abrogates art. 25^1 (Titlul II). Not Titlul IV/VI/VII thresholds. |
| **OUG nr. 7 din 24 februarie 2026** | MO 146 din 25.02.2026 | 10 notes, Art. V (e.g. art. 460, Titlul IX). Not read in full. |
| **OUG nr. 8 din 24 februarie 2026** | MO 147 din 25.02.2026 | 14 notes, Art. 6 — see §8.2. **Amends art. 68 alin. (5)** despite no note appearing. |
| **OUG nr. 9 din 27 februarie 2026** | MO 157 din 27.02.2026 | 13 notes, Art. VII + Art. XI pct. 2. Not read in full — **highest-value unread act if Titlul IV exposure is ever suspected.** |
| **OUG nr. 13 din 5 martie 2026** | MO 181 din 09.03.2026 | 2 notes, Art. II (art. 369, Titlul VIII — accise). |
| **HOTĂRÂREA nr. 146 din 12 martie 2026** | MO 196 din 13.03.2026 | Minimum wage 4,325 lei from 1 iulie 2026 — see §3. |
| **OUG nr. 38 din 4 mai 2026** | MO 393 din 08.05.2026 | The act behind ANAF's "ultima actualizare". Notes only on art. 435 alin. (3^15) (Titlul VIII accise / produse energetice) and a reference to art. XII. **Never read in full; Titlul VIII only.** |
| **LEGEA nr. 170 din 5 august 2026** | MO 648 din 05.08.2026 | 1 note, Art. II → art. 294 (Titlul VII). |

Newest note per article: art. 135^1 → 24-12-2020 (Legea 296/2020 pct. 95); art. 148 → 01-01-2025
(OUG 128/2024 pct. 20); art. 170 → 01-01-2025 (OUG 128/2024 pct. 22); art. 310 → 01-09-2025
(OG 22/2025 pct. 12). **Confidence HIGH for 135^1 / 148 / 170 / 310 — double-confirmed. Confidence NOT
high for art. 68**, where the note set is demonstrably incomplete (§8.2, §11).

Per-article amendment notes in doc 312601: art. 135^1 → 3 notes (Legea 296/2020 pct. 95 + two date
flags); art. 148 → 2 notes (**OUG 128/2024 Punctul 20, Art. I** + a 01-01-2026 flag on **alin. (3) only**
— alin. (2), the CAS base, is untouched for 2026); art. 170 → 3 notes (OUG 128/2024 pct. 22 + two
01-01-2026 flags); art. 310 → 11 notes, all Ordonanța 22/2025.

### 8.2 OUG 8/2026 DOES amend art. 68 — at alin. (5)

**Ordonanța de urgență nr. 8 din 24 februarie 2026, MO 147 din 25.02.2026** —
https://static.anaf.ro/static/10/Anaf/legislatie/OUG_8_2026.pdf. Art. 6 punctele 1–44 amend: art. 181;
20 (+art. 20^1); 22; 23; 25; 26; 28 ×3; 41 ×2; 42; 42^9; 45; 47 ×2; 48 ×3; 52 ×2; 53 ×2; 54; 62;
**68 (pct. 26, 27, 28)**; 76 ×3; 78 ×3; 125; 142 ×2; 282 ×4; 324 ×3. The art. 68 changes are the four new
alin. (5) capped items recorded in §6. Entry into force: Art. 10 alin. (1) — Art. 6 at publication,
**except pct. 25–44 which enter 01.03.2026**; alin. (6) — pct. 26 și 27 "se aplică începând cu veniturile
aferente anului 2026"; alin. (7) — pct. 28 for sums "plătite și decontate începând cu data de
1 martie 2026". **Impact on Phase 2 provenance: none.**

### 8.3 OUG 6/2026 is not a fiscal act

**ORDONANŢĂ DE URGENŢĂ nr. 6 din 19 februarie 2026**, "pentru modificarea şi completarea Legii
nr. 200/2006 privind constituirea şi utilizarea Fondului de garantare pentru plata creanțelor
salariale" — https://static.anaf.ro/static/10/Anaf/legislatie/OUG_6_2026.pdf. It **amends no Cod fiscal
article at all**; it only *references* CF art. 147 alin. (1).

**Correction to an earlier correction:** there are **two distinct acts numbered 6/2026**, and an earlier
pass conflated them. The one that amends the Cod fiscal is **ORDONANȚA nr. 6 din 30 ianuarie 2026,
MO nr. 77 din 30 ianuarie 2026** — an **OG**, 5 notes, e.g. Art. IV pct. 1 abrogating art. 25^1.
The non-fiscal one is **OUG nr. 6 din 19 februarie 2026** (Fondul de garantare pentru plata creanțelor
salariale). Neither touches art. 135^1 / 148 / 170 / 310.

---

## 9. Deadline — D212

**The code's `2027-05-25` is CORRECT, but the article is art. 122 alin. (3), not alin. (1).**
CF art. 122 alin. (3): "Declarația unică … se completează și se depune la organul fiscal competent,
pentru fiecare an fiscal, **până la data de 25 mai inclusiv a anului următor celui de realizare a
veniturilor**." Art. 122 alin. (1) only enumerates when the obligation arises. No 2025/2026 act moves
the term. **Confidence HIGH on the text, MEDIUM on which act last amended it** (the ANAF consolidation is
annotative) — recorded as unresolved item U-3.

**OUG 8/2026 art. 8 is NOT a deadline change:** it is a 3% bonificație for filing/paying by 15 April
2026 — an early-filing incentive for the **2025** year.

Payment side: **art. 123 alin. (1)** (see §5). **Quarterly instalment payment due dates for 2026 remain
UNVERIFIED** — they need CF art. 123 alin. (2)-(4), art. 147/151 (CAS), art. 174 alin. (1)-(3) (CASS).
Not needed for Phase 2 provenance; **needed by Phase 9**, which drives `cas_quarterly`,
`cass_quarterly`, `income_tax_advance`.

---

## 10. Q-PROVENANCE-SCHEMA — RESOLVED

**Ruling: the code's 17-field `FiscalRule` is authoritative.** `src/domain/fiscal/rules.ts:19-37`
defines `ruleId`, `name`, `jurisdiction`, `entityType`, `taxRegime`, `taxYear`, `effectiveFrom`,
`effectiveTo`, `parameters`, `calculatorId`, `sourceAct`, `sourceArticle`, `sourceUrl`, `verifiedAt`,
`status`, `version`, `supersededBy?`. The `RuleRelease` type at `rules.ts:39-51` (with `evidence[]`) is
likewise authoritative.

**The archived "10-field" schema is SUPERSEDED and must not be used as a target.** It appears at
`docs/ai/decisions/09_IMPLEMENTATION_ARCHITECTURE.md:60` (`sourceAct`/`sourceArticle`/`sourceUrl`/
`effectiveFrom`/`effectiveTo`/`status`/`version`/`supersededBy` — no `verifiedAt`, no `taxRegime`) and
`:168` ("Each rule has 10 fields: id, name, taxYear, effectiveFrom, effectiveTo, parameters, sourceAct,
sourceArticle, sourceUrl, status"), and at `docs/ai/research/06_2026_fiscal_research.md:226` ("11 fields
… missing `supersededBy`"). Those documents describe a schema the code never shipped; the code's
`taxRegime` and `verifiedAt` are load-bearing — `taxRegime` is how `src/domain/tax.ts:45-47` resolves a
rule, and `verifiedAt` is the only provenance freshness signal in the system. **Do not "align the code
to the docs" in this direction.**

**Invariant recorded (why adding rules is dangerous):** `src/domain/tax.ts:45-47` resolves CAS, CASS and
income tax with `applicable.find((r) => r.taxRegime === …)` over the `ruleId`-sorted list from
`selectApplicableRules` (`fiscal/select.ts:9-14`). A second ACTIVE rule sharing a `taxRegime` therefore
**silently changes tax results without failing any test** — resolution order, not an error, decides.
The package must stay at **exactly 8 rules and `version: 1`**; `fiscal.test.ts:9` and `:39` assert both.

---

## 11. Methodological caveat — a finding in its own right

The Portal Legislativ consolidated rendering of Cod fiscal doc 312601 **did not surface an OUG 8/2026
amendment note on art. 68 alin. (5)**, although OUG 8/2026 Art. 6 pct. 26–28 demonstrably amends that
paragraph. The earlier "art. 68 not touched" conclusion was derived from the *absence of inline notes*
in the consolidated text, and **that method missed it.**

Consequence: **a consolidated text can lag the amending act.** Confidence is HIGH on the OUG 8/2026 act
text and **MEDIUM on whether doc 312601's alin. (5) already reflects it.** Anyone re-verifying this
baseline later must **read amending acts directly, not trust the absence of a note.** The §8.1 conclusion
for art. 135^1 / 148 / 170 / 310 was re-established by direct read and stands.

---

## 12. UNVERIFIED register — still blocking, do not guess

| ID | Item | Why it stays open | Blocks |
|---|---|---|---|
| **U-1** | **Non-deductible VAT treatment for a neplătitor de TVA** — does it enter the deductible expense? | No affirmative operative rule found in anything read; art. 5 alin. (6) carves out only "TVA dedusă", art. 5 alin. (4) does not list it, but nothing makes it deductibilă either. Inference only, Medium. | Phase 5, 8. **Marked `REVIEW_REQUIRED` in code — not a computed rule.** |
| **U-2** | **CASS minimum base for art. 68 sistem-real income in 2026** | The 6-SM rungs of art. 170 alin. (2)-(3) cover art. 155 alin. (1) lit. c)-h) income, not art. 68. No rung located for a PFA. The code's `min_base` "6 SM annual" label is unsourced. | Phase 4 |
| **U-3** | **Which act last amended art. 122 alin. (3)'s 25 May term** | Text is HIGH; attribution is MEDIUM (ANAF consolidation is annotative). | Phase 9 (attribution only; the date value is settled) |
| **U-4** | **Quarterly instalment payment due dates for 2026** | Need CF art. 123 alin. (2)-(4), art. 147/151 (CAS), art. 174 alin. (1)-(3) (CASS). Not read in Phase 2. | Phase 9 |
| **U-5** | **CAS salary/pension exemption branch** | CF art. 147 alin. (1) referenced but not read; no rule reads `salaryStatus`/`pensionStatus`. | Phase 3 |
| ~~U-6~~ | **CLOSED — numeric minimum-wage values.** | **4,050 lei** on 1 ianuarie 2026 (HG 1.506/2024, MO I 1185/28.11.2024) and **4,325 lei** from 1 iulie 2026 (HG 146/2026, MO 196/13.03.2026) are both verified HIGH. The "8,100 / 8,600 lei" figures were a **hallucination and are void**. The code's values are correct. See §3. | — |
| **U-7** | **OMFP 3254/2017 amendment history** | Portal "Acțiuni suferite" for doc 196396 returned 0 refs; no explicit "abrogări: niciuna" line. In force is established via OMF 808/2026 art. 8's express scope (abrogates **OMFP 870/2005** only — MO 556 din 07.07.2026, scope = plătitori de impozit pe profit) and the absence of any "(modificat de)" note on the MO 10/05.01.2018 text. | Phase 5, 8 (the net-of-VAT base rests on this act) |

**Closed by Phase 2** (moved out of the blocking register): Q-CAS-MINBASE, Q-CAS-MAXBASE-CONFIDENCE,
Q-CASS-MINBASE-analogue → **re-opened as U-2** (the research closed the *CAS* minimum base, not the
CASS one), Q-VAT-THRESHOLD, Q-VAT-BASIS, Q-16PCT, Q-30PCT-CAP, Q-NETGROSS, Q-PROVENANCE-SCHEMA,
**Q-SM-VALUES (U-6)**.

---

## 13. Forward dependencies recorded by Phase 2 (no code changed for these)

1. **Phase 3 (CAS):** model art. 148 alin. (2) as a **tier ladder**, not a clamp; `max_base`/`max_cas`
   are not statutory caps (§2.1). Needs U-5 (U-6 closed — the SM values are verified).
2. **Phase 4 (CASS):** the 72-SM ceiling is sourced (art. 170 alin. (1), Legea 239/2025 Art. XII pct. 19,
   applies to the **2026** year). The **minimum base is not** (U-2) — do not invent one. Art. 174 alin. (7)
   lit. c) gives the pensioner relief.
3. **Phase 5 (income tax):** the 30% cap is a **phantom** — `tax.ts:52-54` is a **deletion**, not an
   implementation. The 16% component does not apply to this entity type. The real gate is
   **art. 68 alin. (4)** (§6), imported by OMFP 3254/2017 art. 5 alin. (2).
4. **Phase 8 (amount semantics):** the fiscal base is **net of VAT** (§7.2); the 395,000-lei test must be
   taken against a turnover basis, not against VAT-inclusive `ytd.revenue`
   (`src/data/dashboard.ts:99-105`).
5. **Phase 9 (dates):** art. 68 alin. (2) lit. a) measures venit brut by **"sumele încasate"** —
   a cash-receipt basis one ambiguous `date` per record cannot represent. Plus U-3 and U-4.
6. **Any future CAEN-aware rule:** art. 68 alin. (1) excludes art. 68^1 / **68^3** / 69; art. 68^3 alin.
   (2) is a real 30% forfetar regime switch for cazare (>7 camere, art. 67 alin. (1^1)). Do not re-import
   the phantom cap as a deductibility floor.

---

## 14. What Phase 2 changed in code

Provenance metadata only — **no formula, calculator, rule-engine, parameter-value or rule-count change.**

- `src/domain/fiscal/package2026.ts` — replaced the `'ANAF 2026'` / `https://www.anaf.ro` /
  self-referential `sourceArticle` placeholders on `CAS_2026`, `CASS_2026`, `INCOME_TAX_2026`,
  `VAT_THRESHOLD_2026`, `PFA_DEADLINE_2026` with the verified act, article and URL above; corrected
  `VAT_THRESHOLD_2026` from **art. 338 → art. 310 alin. (1)**; set `PROVENANCE_2026.verifiedAt` to
  `2026-10-05`; added code comments naming each remaining gap (U-1, U-2, U-5) at the rule that
  carries it. Removed the legally unfounded `progressive_rate: 16` parameter (§0 item 4) and renamed
  `INCOME_TAX_2026` to "Income tax 2026 (10%)". Rule count stays 8, `version` stays 1.
- `src/domain/fiscal/release2026.ts` — `evidence[]` expanded from the two legalteka wage URLs to the
  primary sources verified here; `notes` no longer claims "no legislation ingestion applied".
- `docs/ai/research/06_2026_fiscal_research.md` — supersession banner added at the top; body left intact.
- `docs/ai/decisions/09_IMPLEMENTATION_ARCHITECTURE.md:179` — inline correction of the "OUG 22/2025"
  attribution, marked as a correction rather than a silent rewrite of the ADR.
