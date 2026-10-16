# 55 — art. 28 alin. (12) lit. i^1) is a residential head-office rule; the disposal stop rule does not exist

**Requested for:** the B-65 residue (head-office depreciation cap) and B-153 (the two month counts).
**Date:** 2026-10-16. **Researcher pass:** 11m 3s, web-only, primary sources.

**Both questions came back with the answer on a different axis than we framed them.** One provision we were about to encode is real but is not the rule our notes describe. One rule we have been looking for **is not in the law at all** — and the research found the provision that makes our current answer indefensible regardless of which reading we pick.

---

## 1. art. 28 alin. (12) lit. i^1) — exists, in force FY2026, and is not about vehicles

Rendered in the official consolidation as **`i^1)`**, not `i1)`. Introduced by **OUG nr. 115/2023 (MO 1139/15.12.2023), punctul 14**, applicable from **01.01.2024**. The letter has not moved; the FY2026 text (read 2026-08-08, carrying the OUG 8/2026 amendments to art. 28) still has it.

> *„**i^1)** pentru un sediu social care nu este utilizat exclusiv în scopul activității economice, situat în clădiri de locuințe sau în clădiri individuale de locuit, din ansambluri rezidențiale definite potrivit prevederilor legale, înregistrate în patrimoniul contribuabilului, amortizarea este deductibilă la nivelul de 50 %. În cazul utilizării sediilor sociale, aflate în patrimoniul contribuabilului, în scop personal de către acționari sau asociați, amortizarea fiscală aferentă sediului social nu se deduce la calculul rezultatului fiscal;"*

**Scope, precisely:**

| Element | What it actually is |
|---|---|
| Asset | an **immovable** *sediu social*, **inregistrat în patrimoniul contribuabilului**, in *clădiri de locuințe* or *clădiri individuale de locuit din ansambluri rezidențiale* |
| Trigger | *nu este utilizat exclusiv în scopul activității economice* |
| Consequence | **50 % of the fiscal depreciation charge** is non-deductible — not 50 % of an expense, not of a deductible portion of something else |
| Second limb | *în scop personal de către acționari sau asociați* → depreciation **„nu se deduce"** at all, 100 % disallowed |

**It has nothing to do with vehicles.** The vehicle half of our note is wrong, and the Code says so expressly: **art. 68 alin. (7) lit. k)** caps vehicle expenses at 50 % but then states *„Cheltuielile care intră sub incidența acestor prevederi **nu includ cheltuielile privind amortizarea**"*, and the Titlul IV norms repeat it with *„cu excepția cheltuielilor privind amortizarea pentru care se aplică regulile privind amortizarea prevăzute la art. 28 titlul II"*. **For a PFA's M1 car the depreciation constraint is art. 28 alin. (14)'s 1.500 lei/lună, which we already model.** **Do not encode a 50 % depreciation haircut for vehicles.**

### Why our 624-page Titlul IV corpus scored 0 hits

**art. 28 is a Titlul II article. The Titlul IV norms never restate it.** The bridge to a PFA is in the Code:

- **art. 68 alin. (4) lit. d)** — deductible expenses must *„să respecte regulile privind amortizarea, **prevăzute în titlul II**, după caz"*
- **Titlul IV norms pct. 7 lit. n)** — *„cheltuielile cu amortizarea, în conformitate cu prevederile art. 28 din Codul fiscal, după caz"*

**So lit. i^1) does reach a PFA — through art. 68 alin. (4) lit. d), not through a Titlul IV norm.** A Titlul IV-only search cannot find it, and our 0-hit result was an artefact of where we looked, not evidence the provision is missing.

### Two cautions before encoding it

1. **No norm prescribes how the trigger is established.** No declared „folosit exclusiv" fact, no prescribed evidence, no designated decision-maker. The trigger is a factual condition tested by the authority. The only documentary anchor is Registrul-inventar (Titlul IV norms pct. 7 alin. (8): *„toate bunurile … se înscriu în Registrul-inventar și constituie patrimoniul afacerii"*) plus actual use. **Grade: inference from absence.** Contrast vehicles, where the norms *do* prescribe evidence — the **foaie de parcurs** with category, scop, loc, kilometri and consum norm.
2. **The second limb is written for a company.** *„acționari sau asociați"* does not map onto a PFA. **No ANAF indrumar, brochure or county note applying lit. i^1) to a PFA was found** — bounded negative. ANAF material on the *sibling* rule (DGRFP Galați/AJFP Vrancea „Modif.leg.OUG 115-23"; DGRFP Brașov „Limite deductibilitate") frames the 2024 sediu-social changes as **art. 25 alin. (3) lit. k)/k^1)** — function/maintenance/repair *expenses* — not depreciation. **Any PFA application of lit. i^1) is our own construction from art. 68 alin. (4) lit. d) and must be labelled as one.**

---

## 2. Our pct. 27 / pct. 29 citations are in the wrong title — and pct. 27 is M1-only

**The FY2026 Titlul IV norms were not reissued.** They are still **HG nr. 1/2016 (MO 22/13.01.2016)**, consolidated as of **31.03.2026**. Amending HGs include 354/2018, 1336/2023 (MO 1196/29.12.2023), 1393/2024, 451/2024, 602/2025 (**Titlul VII only**) and HG 39/2026 (**Titlul VIII only**). **There is no 2026 HG issuing new Titlul IV norms**, so our numbering is not from a superseded edition.

**But pct. 27 and pct. 29 are Titlul II norm numbers**, in HG 1/2016, Normele metodologice **Titlul II**, Cap. II, **Secțiunea a 8-a „Amortizarea fiscală", pct. 25–31** (pct. 24 abrogated by HG 354/2018):

> *„**27.** În aplicarea prevederilor art. 28 alin. (14) din Codul fiscal, **la momentul scăderii din gestiune a mijloacelor de transport din categoria M1**, valoarea rămasă neamortizată este deductibilă în limita a **1.500 lei înmulțită cu numărul de luni rămase de amortizat din durata normală de funcționare** stabilită de contribuabil potrivit Catalogului …"*

> *„**29.** (1) În aplicarea prevederilor art. 28 alin. (17) … cheltuielile înregistrate ca urmare a **casării** unui mijloc fix cu valoarea fiscală incomplet amortizată sunt cheltuieli efectuate în scopul desfășurării activității economice. (2) Prin casare … operația de scoatere din funcțiune a activului respectiv, urmată de dezmembrarea acestuia și valorificarea părților componente …"*

**Two corrections follow.** (a) **pct. 27 is not a general disposal cap** — it is expressly tied to art. 28 alin. (14) and applies **only to M1 passenger vehicles**, *la momentul scăderii din gestiune*. (b) It is a **Titlul II** norm reaching a PFA via art. 68 alin. (4) lit. d).

**Our code already cites it correctly as „Titlul II norm pct. 27" at `depreciation.ts:215`** — the corpus note was sloppier than the code. **But see §4: the code does not gate the figure on M1.**

---

## 3. pct. 7 lit. o) — confirmed verbatim, and it is the rule that actually governs a PFA sale

Titlul IV norms, pct. 7:

> *„**o)** valoarea rămasă neamortizată a bunurilor și drepturilor amortizabile **înstrăinate**, determinată prin deducerea din prețul de cumpărare a **amortizării incluse pe costuri în cursul exploatării** și **limitată la nivelul venitului realizat din înstrăinare**;"*

**The letter (o) and the text are confirmed in the 2026-updated norms. The alineat number is not.** We cite **pct. 7 alin. (5) lit. o)**; the free extract does not render the alineat marker and the Portal Legislativ consolidated norms (~5 MB) could not be fetched whole. **Re-check the alineat against the consolidated text before hard-coding it.**

**Do the two caps stack? No — and this matters.** pct. 7 lit. o) is a **two-step single formula**: residual = purchase price − depreciation actually charged to cost; then that residual is capped at the disposal proceeds. **The cap is inside the same provision.** Titlul II pct. 27 is a *different* cap, keyed to art. 28 alin. (14) and M1 only. **Grade: which one governs is an inference from the text — no norm states a stacking rule.**

---

## 4. The stop rule does not exist. This is a gap in the law, not in our search.

- **Start rule, explicit — art. 28 alin. (12) lit. a):** *„începând cu luna următoare celei în care mijlocul fix amortizabil se pune în funcțiune …"*
- **Stop rule: none.** art. 28 alin. (12) runs lit. a) through n) and covers special cases; **none addresses vânzare or scoatere din evidență.**
- **Titlul II norms Secțiunea a 8-a (pct. 25–31)** — the whole amortizare section — contains **no stop rule.**
- **Titlul IV norms** contain no *scoatere din evidență* / *luna în care* / *ultimul an* depreciation rule at all.
- **OMFP nr. 170/2015** (contabilitate în partidă simplă, MO 139/24.02.2015) prescribes Registrul-inventar and Fișa mijlocului fix but states **no depreciation month convention and no stop rule.**

### What the texts imply — and it points against charging Noiembrie–Decembrie

- **art. 28 alin. (17):** *„Câștigurile sau pierderile rezultate din vânzarea ori din scoaterea din funcțiune a acestor mijloace fixe se calculează pe baza valorii fiscale a acestora, **diminuată cu amortizarea fiscală** …"* — the depreciation subtracted is the depreciation actually taken. If the schedule keeps charging Nov–Dec on an asset sold 20 Oct, the disposal result is computed off a figure that includes months when the PFA no longer owned the asset.
- **pct. 7 lit. o)** defines the residual by *„amortizării **incluse pe costuri în cursul exploatării**"* — the residual is **derived from** the depreciation actually charged.
- **Titlul II pct. 27** is the only month-counting rule in the norms, and it counts *„numărul de luni rămase de amortizat"* **at the moment of scădere din gestiune** — remaining months measured **from the exit date**, not to 31 Decembrie.
- **art. 28 alin. (26)** (IFRS-only, not applicable to a PFA in partidă simplă) shows the legislator's technique when it *does* want a suspension: *„…durata normală de utilizare rămasă … **din care se scade durata în care a fost clasificat** …"*. **That it wrote this expressly for IFRS filers and nowhere else is evidence the ordinary case was left unregulated.**

### The constraint that survives any reading

**Whichever truncation point is chosen, the schedule and the disposal calculation must use the same month count.** pct. 7 lit. o) makes the residual a function of the depreciation actually charged. **Two different counts on the same asset is not a defensible position under any reading.** That is the finding that settles B-153's *requirement* while leaving its *choice* open.

### No "last year takes the remainder" rule for linear

The remainder mechanics in art. 28 are **method-specific**, not year-end: **alin. (8) lit. b)** (accelerată) and the new **alin. (8^1)–(8^3)** (super-accelerată, below). **alin. (6)** (liniară) says only *„amortizarea se stabilește prin aplicarea cotei de amortizare liniară la valoarea fiscală de la data intrării în patrimoniul contribuabilului"* — **no remainder clause.** Our code's last-year-takes-the-remainder convention at `depreciation.ts:595` is already labelled as unstated at `:607`, which is correct — it is an arithmetic absorption of rounding, not a claimed rule.

### New for FY2026, and we do not model it

**alin. (8^1)–(8^3), added by OUG 8/2026 (MO 147/25.02.2026):** super-accelerated depreciation, **max 65 % in year 1**, then *„valoarea rămasă de amortizare a activului la durata normală de utilizare rămasă"*, for **new assets in subgrupa 2.1 and/or 2.4 put in funcțiune between 1 ianuarie and 31 decembrie 2026.** **`depreciation.ts:71` already records this as not modelled, with the reason** — it is gated on Catalog subgrupa, and no Catalog is encoded. That decision stands; it is now also dated to a specific 2026 act.

### Worked example with a mid-year disposal: bounded negative

**No ANAF, Ministerul Finanțelor or norms worked example shows a fixed asset disposed of part-way through a year with a visible month count.** The only example in the amortizare section is **Titlul II pct. 25**, a 10-year **degresivă** case (350.000 lei, cota 20 %, switching to linear in year 6 at 114.688/5 = 22.937,6, closing at 0 in year 10) — **annual, no disposal, no month count.** Commercial PFA tools show month counts for the *start* rule („2026 (aprilie–decembrie) | 9 luni") but never for a disposal, and are not authoritative.

**Tooling limit, not necessarily absence:** ANAF PDFs could not be fetched (raw mode rejected `application/pdf`). **Next step if pursued:** retry through a PDF-capable route and search ANAF's *Întrebări și răspunsuri* specifically for *„mijloc fix" + „vânzare"*.

---

## 5. What changes

1. **B-65's residue is redefined.** The head-office cap is real, is **residential-immovable-only**, and reaches a PFA via art. 68 alin. (4) lit. d). **The vehicle branch is dropped — it is expressly excluded.** Encoding it needs a declared „sediu social în clădire de locuință, folosit exclusiv?" fact, and **no norm prescribes the evidence**, so the app would be asking a question the law leaves to the authority.
2. **New defect: pct. 27's figure is computed for every disposed asset, not only M1.** `disposalFigure` is called whenever `disposedOn` is set (`depreciation.ts:662-664`) and is **not gated on `isM1Vehicle`**, while pct. 27 is expressly *mijloacelor de transport din categoria M1*.
3. **New defect: the pct. 7 alin. (5) citation is unverified.** Letter and text confirmed; alineat not.
4. **B-153 now has a firm constraint and an open choice.** Constraint: one month count, everywhere. Choice: exit month, month after, or year end — **a reading, and it must be labelled as one.** The strongest anchors for cutting at the exit are art. 28 alin. (17) and pct. 7 lit. o); the strongest anchor for a month-following convention is symmetry with art. 28 alin. (12) lit. a).
