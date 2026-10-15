# 53 — ANAF's Sector 4 worked example is internally inconsistent on rounding

**Requested by:** B-113 (D-ROUND-1). **Date:** 2026-10-15.
**Source:** ANAF DGFP București / Admin. Sector 4, *„Declarația unică — cedarea folosinței bunurilor"*, item 18, income year 2024, SMN 3.300 lei — `https://static.anaf.ro/static/10/Bucuresti/Dec_Unica_PF_Cedare_Fol.pdf`, retrieved 2026-10-15.
**Already stored at:** `research/47_published_worked_examples_fy2026.md` §3B. **This file corrects how that entry is read, not what it records.**

---

## 1. Why the earlier reading was wrong

Two agents read this document and disagreed on its figures. Neither was simply right:

- **Brief 68's Worker** reported the chain as `2.488 → 14.928 → 2.986 → 11.942 → 1.194` and concluded *„the engine's rounding mode already matches ANAF's"*. That chain is real — it is the **payment-date** chain.
- **The Researcher** reported *„14.928 × 20% = 2.986"* alongside *„11.938 lei × 10% = 1.193 lei"* and concluded the document was internally inconsistent. **Its arithmetic was wrong: it took the forfetar from one chain and the net and tax from the other.** `14.928 − 2.986 = 11.942`, not `11.938`.

**The document contains two complete chains for the same example**, because it prices the rent at two different rates — the daily rate on the payment date, and the BNR annual average. Both agents read across the boundary between them.

---

## 2. The two chains, as published

**Chain 1 — daily rate on the payment date, 1 July 2024 = 4,977**

| Step | Exact | ANAF prints |
|---|---|---|
| 500 EUR × 4,977 | 2.488,50 | **2.488** |
| × 6 months | 14.928 | **14.928** |
| forfetar 20 % | 2.985,60 | **2.986** |
| net | 11.942 | **11.942** |
| impozit 10 % | 1.194,20 | **1.194** |

**Chain 2 — definitive at BNR annual average 4,974**

| Step | Exact | ANAF prints |
|---|---|---|
| 500 EUR × 4,974 | 2.487,00 | **2.487** |
| × 6 months | 14.922 | **14.922** |
| forfetar 20 % | 2.984,40 | **2.984** |
| net | 11.937,60 (as 80 % of gross) | **11.938** |
| impozit 10 % | 1.193,80 | **1.193** |

---

## 3. The finding: three separating cases, pointing opposite ways

A case **separates** art. 66 from a plain floor only when the fraction **exceeds 50 bani** — art. 66 raises it, a floor drops it. Every other fraction gives the same answer under both rules.

| # | Step | Exact | ANAF | art. 66 | floor | Verdict |
|---|---|---|---|---|---|---|
| 1 | Chain 1 forfetar | 2.985,**60** | 2.986 | **2.986** | 2.985 | **art. 66** |
| 2 | Chain 2 net | 11.937,**60** | 11.938 | **11.938** | 11.937 | **art. 66** |
| 3 | Chain 2 tax | 1.193,**80** | 1.193 | 1.194 | **1.193** | **floor** |

**The conversion line itself separates in neither chain** — `2.488,50` sits exactly on art. 66's inclusive-50 boundary, and `2.487,00` has no fraction at all. **B-113's actual question is still unanswered by example.**

**What is now established, and is stronger than what we had: this document cannot be used as an oracle for a rounding convention.** It applies art. 66 at two intermediate steps and a floor at the final one. That is not a reading problem on our side; the published arithmetic is inconsistent on its face.

**Consequence for the register:** `research/47` §3B's closing note — *„a rounding convention our engine must match"* — is **not supported by this document.** The engine can match ANAF's conversion line, or its forfetar line, or its tax line, but not all three with one rule.

---

## 4. What the document does establish

- **ANAF converts, then presents a whole-leu figure.** `500 × 4,977 = 2.488,50` is published as **2.488 lei lunar**, and that whole-leu figure — not the half-leu product — is what is multiplied by 6 to give the gross. **The conversion product is rounded before it is used.** Which rule produced it is undetermined; that it is rounded is not.
- **ANAF publishes both a provisional and a definitive chain for the same rent**, at the payment-date rate and at the BNR annual average. This is the clearest official confirmation we hold that the two conversion bases coexist in practice, and it corroborates D-FX-6's choice to keep both visible rather than pick one.
- **The SMN for the FY2024 fixture is 3.300 lei**, confirming the CASS-threshold caveat already recorded.

---

## 5. Corroborating and contrary material from the research pass

**Supporting broad application of the art. 66 rule to intermediate amounts** — HG nr. 1/2016, Norme metodologice, Titlul IV, Cap. I, Secț. 1, **pct. 4** (form introduced by HG nr. 354/2018): *„…la determinarea impozitului anual/lunar, **bazele de calcul al impozitului** vor fi stabilite prin rotunjire la un leu, prin neglijarea fracțiunilor de până la 50 de bani inclusiv sau prin majorarea la leu a fracțiunilor ce depășesc 50 de bani."* — [legislatie.just.ro/Public/DetaliiDocument/201007](https://legislatie.just.ro/Public/DetaliiDocument/201007), retrieved 2026-10-15; cross-checked against ANAF Galați's comparative table, [static.anaf.ro/static/10/Galati/IV-PF_normecomparativ.pdf](https://static.anaf.ro/static/10/Galati/IV-PF_normecomparativ.pdf). **Anchored to art. 64; it says nothing about currency conversion.** *Grade: normă metodologice for the text; extending it to conversions generally would be inference.*

**Contrary, by a contrario argument** — where the legislator *does* round a conversion product, it writes the rule into the converting provision and prescribes a **different** rule: HG 1/2016 Titlul VII rounds the 10.000-euro intra-community ceiling to thousands (34.000 lei); CF art. 310 alin. (1) rounds the 88.500-euro ceiling to the next thousand (300.000 lei); HG 1/2016 Titlul II prescribes **no rounding at all** on the 15.000-euro nonprofit conversion. *Grade: primary text for the rules; "therefore Title IV conversions fall outside art. 66" is inference.*

**Closest structural analogue, and it points the other way** — OUG nr. 59/2005 art. 7: *„În cazul impozitelor și taxelor locale, **elementele de calcul intermediare utilizate la stabilirea acestora se convertesc fără rotunjirea zecimalelor la ordinul sutelor**."* For **local taxes**, intermediate conversion elements are expressly **not** rounded. **There is no equivalent express rule for Title IV.** — [legislatie.just.ro/Public/DetaliiDocument/69521](https://legislatie.just.ro/Public/DetaliiDocument/69521). *Grade: primary text; "Title IV is therefore unregulated on this point" is inference.*

**Art. 66's own words are broader than its title** — the operative text reads *„**Sumele** sunt calculate prin rotunjire la un leu…"*; the qualifier „fixe" appears only in the heading. *Grade: inference — no official source was found reading art. 66 as general to Titlul IV, and none reading it as limited to sums due.*

**Unverified lead, worth a primary check** — art. 6 alin. (2) Cod de procedură fiscală (Legea 207/2015), quoted in secondary material as: *„Obligațiile fiscale stabilite în lei se plătesc prin rotunjire la leu, în favoarea contribuabilului, dacă suma fracționară este mai mică de 50 de bani, și în favoarea bugetului, dacă suma fracționară este de 50 de bani sau mai mare."* **Not verified against a primary source.** If accurate, the rule governing *payment* has the **opposite** 50-bani boundary from art. 66, which would be an independent reason not to treat art. 66 as the operative rule for a sum actually owed.

---

## 6. Gaps left open

1. **No separating conversion example exists** in ANAF broșuri, ghiduri, county pages, the HG 1/2016 norms reachable, `chat.anaf.ro` contestation decisions, or indexed court decisions. **Bounded negative.**
2. **`cdep.anaf.ro` was not queried through its own interface** — searches returned `chat.anaf.ro/ContestatiiSite.nsf` documents instead. A full-text search of that database for `rotunjire`, `art. 66`, `50 de bani` is the highest-value remaining step.
3. **Art. 6 alin. (2) CPPF unverified** — see above.
4. **No court decision** applying or declining art. 66 to a converted amount was found. CA Alba Iulia Decizia 1141/2009 concerns which BNR date applies, not rounding.

---

## 7. What this changes in the register

- **B-113 cannot be closed by evidence.** The decisive artefact does not exist in reachable official material, and the best candidate document contradicts itself.
- **The premise that ANAF's published example establishes a convention is refuted.** Any test that treats `2.488 / 2.986 / 11.942 / 1.194` as a chain the engine must reproduce is treating an inconsistent document as an authority.
- **What the app can defensibly do** is convert and then round to whole lei — which is what ANAF's presentation does — while recording that the *rule* for that rounding is a reasoned choice, not a settled one.
