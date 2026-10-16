# 54 — No successor to the D212 order; the fișă has one, and it has no income field

**Requested for:** B-81 (the D212 art. 68³ refusal) and B-80 (the platform-commission open question).
**Date:** 2026-10-16. **Researcher pass:** 11m 36s, web-only, primary sources.

---

## 1. The headline

**No OPANAF order published between 29.12.2025 and 16.10.2026 approves, amends or replaces the formular 212 / Declarația Unică model.** **OPANAF nr. 2.736/2025 (MO I nr. 1.207 din 29.12.2025) is still the operative instrument.** *Bounded negative, corroborated four ways.*

**But the fișă the 212 instructions point at does have a successor — and the successor cannot satisfy the cross-reference.** That is the finding that changes B-81.

---

## 2. The four corroborations of the negative

| Check | Result |
|---|---|
| Portal Legislativ, record for OPANAF 2.736/2025 (doc 305848) | **No „documente modificatoare", „abrogatoare", „ulterioare" or „corelative".** No republicated form. |
| ANAF form registry | Newest 212 version listed is still *„conform OpANAF nr. 2736/2025"*, then 1929/2025, 6/2024, 2541/2022. **No 2026-numbered 212 order.** |
| Live ANAF web form `anaf.ro/declaratii/duf` | Versioned **V-1.8.10 / 15.05.2026**; offers only *Declarație inițială / Rectificare venituri 2025 / Rectificare opțiuni 2026*. **No 2026-income (68³) variant.** |
| Index of ANAF orders in MO I, Jan–Oct 2026 | 212-related entries in the window are **only** OPANAF 2.719/2025 and OPANAF 2.735/2025 (din oficiu CAS/CASS). Every other form order concerns 112, 204, 205, 181, 300, 216, the 587/2016 nomenclator, e-TVA/e-Factura. **None touches 212.** |

**OPANAF nr. 2.719/2025** (MO I nr. 1 din 05.01.2026) is the only 212 act in the window: it approves the **precompletare, verificare și transmitere** procedure. Its temei lists art. 122, 151, 174, 174¹ — **no art. 68³** — and it alters neither anexa nr. 1 (model) nor anexa nr. 2 (instrucțiuni) of 2736/2025.

---

## 3. The dangling citation, verbatim

OPANAF 2.736/2025, **anexa nr. 2 (Instrucțiuni), pct. 22.2** — the tourist-rental line under the *norme de venit* subsection:

> *„22.2. Rd.1 «Venit anual» – se înscrie venitul anual determinat potrivit legii, corespunzător perioadei de închiriere în scop turistic, din anul fiscal de raportare. La stabilirea venitului anual se are în vedere suma înscrisă la rd. «Venitul anual» de la secțiunea C «Date privind venitul anual» din formularul «Fișa capacității de cazare», aprobat prin Ordinul președintelui Agenției Naționale de Administrare Fiscală nr. 398/2021 …"*

The instructions contain **no occurrence of „68³"** and no mention of *comision reținut de platformă*.

---

## 4. The successor fișă — and why the cross-reference is unsatisfiable

**OPANAF nr. 381 din 24 martie 2026**, *„pentru aprobarea modelului, conținutului și modalității de gestionare a formularului «Fișa de ocupare a capacității de cazare»"*, **MO I nr. 250 din 31 martie 2026**.

Temeiul legal, verbatim: *„Având în vedere dispozițiile **art. 68^3 alin. (8)** și ale art. 85 alin. (8) din Legea nr. 227/2015 …"*

Art. 3: *„Formularul prevăzut la art. 1 se utilizează de contribuabilii care realizează venituri din prestarea de servicii de cazare sau venituri din închirierea pe termen scurt a camerelor situate în locuințe proprietate personală, **începând cu anul 2026**."*

Art. 6: *„…Ordinul … nr. 398/2021 … **se abrogă**."*

**The nuance that matters:** 381/2026 is **not a fișă de calcul**. Its model has only **Secțiunea I „Datele privind imobilul"** and **Secțiunea II** with cols. 1–5 (nume, CNP, serie și număr act de identitate, prima zi, ultima zi). **There is no „secțiunea C «Date privind venitul anual»" and no income line at all.** The successor form records **occupancy, not revenue.**

**So pct. 22.2 cannot be repaired by substituting the new order number.** The field it points to no longer exists. **The 212 instructions are not merely stale — they reference a data element that the current instrument does not produce.**

**Consequence for B-81:** the on-screen refusal remains correct, and should now **name the successor** — OPANAF 381/2026, MO 250/31.03.2026 — and say that the successor carries **no income field**, rather than implying the fișă itself vanished. Nothing found licenses deriving a 68³ cell map from the 212 instructions: **no 212 act in the window mentions 68³ at all.**

---

## 5. B-80 — the commission question, and what the research actually settles

Art. 68³ C.fisc. alin. (2)–(3), verbatim:

> *"(2) Venitul net anual din prestarea de servicii de cazare se determină prin deducerea din venitul brut a cheltuielilor determinate prin aplicarea cotei forfetare de **30 %** asupra venitului brut. Venitul brut reprezintă totalitatea sumelor în bani … încasate în cursul anului fiscal …"*
>
> *"(3) **Nu se cuprinde în venitul brut comisionul reținut** de către entitățile care facilitează închirierea pe termen scurt a camerelor situate în locuințe proprietate personală, inclusiv interfețele electronice, cum ar fi o piață online, o platformă, un portal sau alte mijloace similare."*

**Art. 85 alin. (2)–(3) is verbatim identical** for the 1–7 camere (cedarea folosinței) regime.

**The commission is therefore excluded from *venitul brut itself* — it is not a deduction from an expense base.** VNA = 70 % × (gross net of the platform commission).

**The app already models this correctly.** `src/domain/fiscal/calculators.ts:1462`: *„comisionul reținut de platformă nu intră în venitul brut deloc (art. 85 alin. (3))"*.

**What this does NOT settle, and B-80 must stay open for:** the *rule* is no longer uncertain — it is statutory, mirrored word-for-word across two articles, and restated identically by **DGRFP Cluj-Napoca (18.05.2026 and 30.06.2026)**, **DGRFP Ploiești / AJFP Argeș (22.01.2026)** and **DGRFP Brașov (ianuarie 2026)**. **What is missing is the fact: which line-items a platform actually books as „comision reținut"** — cleaning fees, service fees, host-paid marketing and similar are not named anywhere in the primary material.

**B-80's framing should therefore change from „the scope of the rule is unclear" to „the rule is settled; the taxpayer's facts are not".** That is a different question to ask the user, and asking the wrong one wastes the interaction. **No central ANAF or Ministerul Finanțelor binding *clarificare* on 68³ commissions was found** — only territorial restatements.

---

## 6. Legal parent of art. 68³

**Legea nr. 239/2025** (MO I nr. 1160 din 15.12.2025, în vigoare 18.12.2025), with **OUG nr. 89/2025** also amending Titlul IV. ANAF's own comparative table marks art. 67 alin. (1¹), art. 68³ and art. 85 as *„se aplică începând cu veniturile aferente anului 2026 (art. XIII alin. (1) lit. b) / alin. (2) lit. b)"*.

---

## 7. Gaps and re-check dates

1. **The official MO Partea I index was not directly retrievable.** Coverage was reconstructed from legislatie.just.ro, static.anaf.ro and an aggregator MO index used only as a pointer, with every act it surfaced then checked against a primary source. **Residual risk: an order published in the last days before 16.10.2026 may not yet be indexed anywhere.**
2. **A 68³-aware D212 model most likely appears late Dec 2026 / Jan 2027.** Art. 68³ applies from 2026 income, declared by **25 mai 2027**; the historical pattern is 7015/2024 → 29.12.2024 and 2736/2025 → 29.12.2025. **Re-check the ANAF D212 page and legislatie.just.ro in that window.** This is the same self-expiring-recheck discipline B-64 already carries (`asOf` / `recheckBy`).
3. **No binding central clarificare on 68³ commissions** under the phrasings tried.

---

## 8. What changes in the register

- **B-81** — the refusal stays, but its wording should name **OPANAF 381/2026** and state that the successor fișă **has no income field**, rather than implying the instrument disappeared. **A grounded 68³ subsection is still not derivable**, and now we know why with certainty: the referenced data element does not exist in the current form.
- **B-80** — reframe from rule-uncertainty to fact-uncertainty (§5 above).
- **New re-check obligation** — the D212 model for 2026 income, re-check **decembrie 2026 / ianuarie 2027**.
