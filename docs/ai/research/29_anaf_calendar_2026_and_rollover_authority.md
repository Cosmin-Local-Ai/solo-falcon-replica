# R-A2 — ANAF's own 2026 calendar, and the last look for authority on fixed-date rollover (2026-10-10)

**Researcher:** `scout-R-a2-iccj`, follow-up to `research/28`. Transcribed by the Orchestrator (**Q-RESEARCHER-WRITE**). Report arrived complete.
**Question:** (P1) is there any court or authority decision on whether CPC art. 181 alin. (2) reaches a **fixed statutory calendar date** in fiscal law; (P2) has ANAF said anything about the live 2026 cases; (P3) which act amended CF art. 174 alin. (7)–(8); (P4) OUG 89/2025's MO and any 2026 e-Factura OPANAF on working-day counting; (P5) the 404 Brașov Titlul V table.

**Headline, and it is the most useful single fact in this whole line:** **ANAF's own *Calendarul Obligațiilor Fiscale pentru anul 2026* publishes the entire 25-Octombrie block as „luni 26 octombrie" — there is no „25 octombrie" entry anywhere on the page — while for D398 and D396 it publishes „sâmbătă 31 octombrie" with the express note that the last calendar day applies „chiar dacă aceasta este o zi nelucrătoare".** ANAF itself therefore **rolls some fixed dates and expressly refuses to roll others**, and justifies the non-roll by pointing to wording in the fiscal law. That is the CPF art. 75 carve-out („dacă legislația fiscală nu dispune altfel") operating in the open.

**P1 remains unresolved. P3 is resolved in favour of `research/27`.**

---

## 1. ANAF's 2026 calendar publishes 26 octombrie, not 25 — FACT, read directly

Source: `https://static.anaf.ro/static/10/Anaf/AsistentaContribuabili_r/Calendar/Calendar_obligatii_fiscale_2025.htm` — page `<h1>`: **„Calendarul Obligațiilor Fiscale pentru anul 2026"** (the URL slug still says 2025; the content is 2026). Read by direct DOM extraction of every `.card .date-value` in the OCTOMBRIE accordion.

October 2026 date-values, verbatim: `miercuri 7 octombrie` · `luni 12 octombrie` · `joi 15 octombrie` · `marți 20 octombrie` · **`luni 26 octombrie`** (×12 cards) · `vineri 30 octombrie` · `sâmbătă 31 octombrie` (×2).

The twelve **„luni 26 octombrie"** cards: **Formularele 100, 112, 208, 224, 300, 301, 307, 311, 390, 395, 217**, plus *Cererea de restituire a accizelor în cazul vânzărilor la distanță*. A full-page text search returns **zero occurrences of „25 octombrie"** and zero of „2 noiembrie".

This is not a press report or a county reminder. It is **ANAF's central taxpayer-assistance calendar product** — the strongest administrative-position evidence available short of a normative act.

---

## 2. For the same month ANAF expressly refuses the roll where the law says otherwise — FACT

The two **„sâmbătă 31 octombrie"** cards:

- **Formularul 398** (Declarație specială de TVA, OSS), baza legală „Legea 227/2015 art. 314 alin. (7), art. 315 alin. (6), art. 315² alin. (18). OPANAF 1387/2021", with ANAF's own gloss: „În toate cele trei cazuri, sfârșitul următoarei luni după încheierea perioadei fiscale se consideră a fi ultima zi calendaristică a respectivei luni **chiar dacă aceasta este o zi nelucrătoare**."
- **Formularul 396** (plăți transfrontaliere, art. 321² alin. (7) CF, OPANAF 825/2024): „…care se consideră a fi ultima zi calendaristică a respectivei luni, chiar dacă aceasta este o zi nelucrătoare."

**INTERPRETATION — this is the structural finding.** ANAF distinguishes obligations it rolls (the „25" block → 26 octombrie) from obligations it does not (31 octombrie stays 31 octombrie), and grounds the non-roll in express fiscal-law wording. That is exactly the CPF art. 75 gate operating. **Consequence for the design: rollover cannot be a global rule in the app. It is a per-obligation property, and for at least two obligations we have ANAF's own answer both ways in the same month.**

---

## 3. What the calendar does *not* cover — FACT

- **D406 (SAF-T) is absent.** A full-page scan for `406` and `SAF-T` returned **0 hits**. Secondary sources (firmaromania, goldring, financiarul) assert a roll to 2 noiembrie 2026; **no ANAF source supports it**. D406 / 31 octombrie 2026 = **UNKNOWN**.
- **The calendar runs only to October 2026** — exactly ten accordions, IANUARIE → OCTOMBRIE. Nothing published for **25 noiembrie 2026** (a Wednesday, no roll needed), **30 noiembrie / 1 decembrie 2026**, or **25 decembrie 2026**. Searches of ANAF comunicate and DGRFP/AJFP pages found nothing for those dates.

Corroboration for the monthly „25" roll: **AJFP Ialomița** — „luni 27 ianuarie 2025 este termenul de depunere a următoarelor declarații…" (25 ianuarie 2025 was a Saturday) — reached only via fiscalitatea.ro reprinting the communiqué, so **secondary for this point**. And **DGRFP Cluj-Napoca CJR_DEC-10308/21.05.2025** restates DU 2026 as 25 mai 2026 (a Monday, no roll).

---

## 4. P1 — no authority found. What was searched, and what came back empty

- **ÎCCJ RIL / hotărâre prealabilă** registers and decision lists (rril.iccj.ro, legalia.ro, Portal Legislativ annotations, lege5.ro's annotation set for CPC art. 181), 2015–2026, combining „art. 181 alin. (2)" / „art. 181 Cod procedură civilă" with „Codul fiscal" / „Codul de procedură fiscală" / „declarația unică" / „zi nelucrătoare". **The only ÎCCJ decision annotated against CPC art. 181 is Decizia nr. 8/2024** (RIL, MO 573/19.06.2024), on Codul muncii preaviz. Nothing on fiscal filing dates.
- **CCR:** only tangential material (Decizia 843/2020 on art. 83 alin. (4) OG 92/2003, stabilire din oficiu — not on point).
- **Curtea de Apel / Tribunal** decisions applying or refusing art. 181 alin. (2) to a fiscal filing deadline: **none found**. The only art. 181 alin. (2) case law surfaced is civil-procedural (tardivitatea apelului — a 30-day *period*, not a fixed date).
- **Doctrine on *termen legal fix vs. termen legal variabil*** (Bordeianu; Leș, *Noul Cod de procedură civilă comentat*): **no passage located.** Not quoted for or against. Absence of a hit is not proof of absence.

**A legislative precedent that cuts against a mechanical roll — FACT.** **OUG nr. 7 din 25.01.2017** „privind prorogarea termenului de depunere a declarațiilor fiscale și de plată a creanțelor fiscale scadente la data de 25 ianuarie 2017" (MO 63/25.01.2017), approved by **Legea nr. 76/2017** (MO 297/26.04.2017, PL **188591**). When the state needed to move a fixed statutory „25 ianuarie" date, **it legislated** — no OMF under CPF art. 76 alin. (2), no invocation of CPC art. 181 alin. (2). This cuts against claiming art. 181 alin. (2) mechanically rolls fixed dates, and cuts *for* reading ANAF's calendar roll as an administrative accommodation rather than a statutory extension. Both readings coexist with the observed practice; nothing in the record reconciles them authoritatively.

---

## 5. The CPF gate provisions, re-verified verbatim — and broader than previously recorded

Legea nr. 207/2015, Titlul III, Cap. VI „Termene":

- **Art. 75 Calcularea termenelor:** „Termenele **de orice fel** privind exercitarea drepturilor și îndeplinirea obligațiilor prevăzute de Codul fiscal, de prezentul cod, precum și de alte dispoziții legale aplicabile în materie, **dacă legislația fiscală nu dispune altfel**, se calculează potrivit dispozițiilor Codului de procedură civilă, republicat." — **broader** than the formulation recorded in `research/28`.
- **Art. 76 alin. (1):** terms set by law by a fiscal organ may be extended by that organ „în situații temeinic justificate, la cerere sau din oficiu".
- **Art. 76 alin. (2):** „Ori de câte ori legislația fiscală prevede un termen … acesta poate fi prelungit/modificat, pentru motive justificate ce țin de activitatea de administrare a creanțelor fiscale, **prin ordin al ministrului finanțelor publice**."

Source: consolidated CPF, PL doc ids **172697 / 194294**; text as reproduced at cauta.ro's Cap. VI page. CPC art. 181 alin. (2) and art. 180 alin. (2) re-quoted verbatim, unchanged from `research/28`.

---

## 6. P3 — RESOLVED: **Legea 141/2025, art. II pct. 34**. `research/27` was right; `research/28`'s inference was wrong

Primary text, PL doc **300022** — *LEGE nr. 141 din 25 iulie 2025*, **MO 699 din 25.07.2025**:
- **art. II pct. 34:** „La articolul 174 alineatul (7), după litera b) se introduce o nouă literă, lit. c), cu următorul cuprins: *c) venituri din pensii, definite conform art. 99.*"
- **art. II pct. 35:** amends **alin. (8) lit. a)**.
- **art. VII alin. (1) lit. f)** as printed in the base form: „prevederile art. II pct. 34 și 35 se aplică veniturilor anului 2025 pentru care termenul de declarare este până la data de 25 mai 2026;" — **as amended** by art. VI of **OUG nr. 22/2025** (MO 806/29.08.2025, effective 01.09.2025) the consolidated text reads „…se aplică **începând cu** veniturile anului 2025…".

Independent ANAF confirmation: **DGRFP Brașov**, *Modificări aduse Legii 227/2015 prin Legea 141/2025 — TITLUL V, Capitolul III* (`sanatate_2025.pdf`) numbers the same change **pct. 34**, quotes the lit. c) text, and gives the same applicability column. Its footnote adds **art. VII alin. (3)**: „Prevederile art. II referitoare la obligațiile fiscale privind CASS datorată pentru veniturile din pensii se aplică veniturilor aferente perioadei cuprinse între 1 august 2025 și 31 decembrie 2027."

**Why the other pass was wrong:** **Legea 239/2025** (MO 1160/15.12.2025, in force 18.12.2025) amends the CF through **art. XII, not art. II**, and its Titlul V/IV comparators cover different articles. The Brașov table that mentions art. 174 in a Legea 141/2025 context is `sanatate_2025.pdf`, not the 239/2025 table. **Cite Legea 141/2025 art. II pct. 34.** `Q-ART174-ALIN7-ATTRIBUTION` is closed.

---

## 7. P4 — OUG 89/2025 confirmed; three 2026 OPANAFs, none on working-day counting

**FACT.** **OUG nr. 89 din 23 decembrie 2025**, PL **307057**, **MO 1203 din 24.12.2025**, in force 24.12.2025 — confirmed by PL and independently by CDEP. The earlier „MO 23.12.2025, unverified" flag is cleared (the MO date is **24** December; the OUG is dated 23 December). Its **art. X pct. 2** amends OUG 120/2021 art. 10 alin. (7) to the 5-working-day text with the express renvoi to **Reg. (CEE, Euratom) 1182/71**, applying from 01.01.2026 (art. XIV); the same rule is inserted for B2C at art. 10¹ alin. (2¹).

**FACT — three 2026 OPANAFs amended the Registrul RO e-Factura procedure, and none defines the count:**
- **OPANAF 59/2026** (19.01.2026, MO 42/20.01.2026) — first amendment after OUG 89/2025, adds pct. 1¹ for CNP-identified suppliers.
- **OPANAF 378/2026** (22.03.2026, **MO 250/31.03.2026**, PL **308907**) — renames the order, adds pct. 7 lit. g) and a new **Capitolul V „Dispoziții speciale aplicabile până la 1 iunie 2026"**, whose **pct. 19** requires CNP-identified suppliers active before 01.06.2026 to apply for registration „**până cel târziu la data de 26 mai 2026**".
- **OPANAF 1020/2026** (20.08.2026, **MO 706/25.08.2026**, PL **313646**).

**None addresses how „5 zile lucrătoare" is counted or whether Saturday counts.** No refreshed ANAF FAQ or ghid does either. The only hook remains the statutory renvoi to Reg. 1182/71 — which, read against the Regulation, excludes Saturdays from a period expressed in working days. **INTERPRETATION, not an authority application: no Romanian fiscal authority has applied Reg. 1182/71 art. 2 alin. (2) / art. 3 alin. (3) in print.**

**Trap worth recording:** the „26 mai 2026" in OPANAF 378/2026 pct. 19 is **not** a weekend roll — 25 mai 2026 was a Monday. It derives from OG 6/2026 art. IX alin. (3), which requires registration „cu cel puțin 3 zile lucrătoare înainte" of 1 iunie 2026. Do not cite it as rollover evidence.

---

## 8. New 2026 instruments touching the CPF — recorded for the "did the rules change?" check

- **OG nr. 6 din 30.01.2026**, MO 77/30.01.2026, in force 02.02.2026, PL **306803** — adds **art. 85¹** to the CPF (sediile secundare plătitoare de salarii) and amends the CF; **does not touch CPF art. 75, art. 76 or any filing-deadline rule**. Its art. IX is the RO e-Factura CNP deferral to 01.06.2026.
- **Legea 52/2026** approving OG 11/2025 (MO 695/24.07.2025) — CPF transfer-pricing / convenții amendments; not on terms.
- **OUG 13/2026** (MO 181/09.03.2026) art. V — suspends application of CPF art. 7 alin. (10) until 31.12.2026 (risk-class communication). Unrelated to deadlines, recorded as a 2026 CPF intervention.

---

## 9. P5 — the Brașov Titlul V / OUG 156/2024 comparator, found

**`https://static.anaf.ro/static/10/Brasov/Brasov/Titl_V_CONTRIBUTII.pdf`** — „Modificări aduse Legii nr. 227/2015 … de OUG NR. 156/2024\* TITLUL V contribuții sociale obligatorii", footnoted „publicată în Monitorul Oficial nr. 1334 din 31.12.2024". A table keyed to **art. LXIV pct.** (Titlul V, art. 136–183) plus a reproduction of **art. LXVI** (the 300 lei/lună facility). The sibling `TITL_II_PROFIT.pdf` is **mis-named** — it actually covers Titlul IV (art. 224, 8%→10% dividende).

**Caveat, kept honest:** PDF text extraction is unavailable in this environment, so the file's existence, title and scope are confirmed and the extracted portion shows **no art. 174 row**, but the absence across the whole document is **probable, not certified**. `research/28` §6 already closed the substantive point from the MO text of art. LXIV itself, which is the stronger evidence.

---

## 10. What this changes for the app

**25 octombrie 2026.** The app may now state, with a primary citation, that **ANAF's own Calendarul obligațiilor fiscale 2026 lists the deadline as „luni 26 octombrie"** for F100, F112, F208, F224, F300, F301, F307, F311, F390, F395, F217. That is an **administrative position**, not community practice. The *legal basis* still stays labelled unresolved: no OMF under CPF art. 76 alin. (2) exists and no court has held art. 181 alin. (2) reaches a fixed date. Suggested rule-record shape: `statutory_date = 2026-10-25`, `display_date = 2026-10-26`, `basis = "ANAF Calendarul obligațiilor fiscale 2026; CPF art. 75 + CPC art. 181 alin. (2) — neconfirmat jurisprudențial"`, with `REVIEW_REQUIRED` on the legal-basis field only.

**31 octombrie 2026 (D398, D396).** The app **must not roll these.** ANAF publishes „sâmbătă 31 octombrie" and the CF says the last calendar day applies „chiar dacă aceasta este o zi nelucrătoare". The one place a non-roll is affirmatively documented.

**D406 / 31 octombrie 2026.** **UNKNOWN.** Absent from ANAF's calendar; do not assert 2 noiembrie.

**25 decembrie 2026, 30 noiembrie / 1 decembrie 2026.** Nothing published — the calendar stops at October. Computed-only, flagged.

**P1.** The app must not state as law that CPC art. 181 alin. (2) extends a fixed statutory fiscal date; it may state that ANAF operates as if it does, and should carry OUG 7/2017 → Legea 76/2017 as the counter-evidence.

**P3.** Cite **Legea 141/2025 art. II pct. 34** (MO 699/25.07.2025, PL 300022), applicability via art. VII alin. (1) lit. f) as amended by OUG 22/2025 art. VI (MO 806/29.08.2025). **Do not cite Legea 239/2025 for this.**

**P4.** OUG 89/2025 = MO 1203/24.12.2025, PL 307057 — flag cleared. Any Saturday-exclusion shown for e-Factura must be labelled as derived from Reg. 1182/71, never as ANAF guidance.

---

## 11. Design consequence the Orchestrator draws

Rollover is **not a global rule**. It is a **per-obligation property with three possible values** — rolls, does not roll, unknown — and we now have ANAF's own answer both ways inside one month. That changes what the deadline model needs: a `rollPolicy` on each deadline rule, sourced per obligation, rather than a working-day primitive applied uniformly. This is the thing that was blocked on `Q-ROLLOVER-FIXED-DATE`, and it is now specified enough to build — with `REVIEW_REQUIRED` where the policy is unknown.

## 12. Gaps handed on

1. **P1 stays open.** Next routes: query `rril.iccj.ro` and legalia.ro directly rather than through the web index; pull the printed Leș / Bordeianu art. 181 commentary from a library (not freely indexed); search `chat.anaf.ro/ContestatiiSite` for decisions where the contested act is a **penalitate de nedeclarare** computed from a „25" deadline that fell on a weekend — that is where a court would have to confront the question.
2. **D406 / 31 octombrie 2026** — watch for an AJFP communiqué in late October 2026.
3. **November–December 2026** — re-check the same calendar URL for the NOIEMBRIE / DECEMBRIE accordions.
4. **Saturday in „5 zile lucrătoare"** — still no Romanian authority statement.
5. **Full-text certification** that `Titl_V_CONTRIBUTII.pdf` contains no art. 174 row — needs a PDF-capable reader.
