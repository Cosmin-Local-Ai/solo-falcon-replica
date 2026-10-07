# 18 — The Romanian holiday set at primary level, and whether a fixed statutory date rolls

**Researcher:** `holiday-rollover-researcher`, run 2026-10-08, 43m 30s.
**Transcribed by the orchestrator** — no file-write tool in the `researcher` profile (`Q-RESEARCHER-WRITE`).
The researcher itself flagged that it could not create the file. Report truncated mid-sentence in §Q2(b); the
cut is recorded below, not reconstructed.

**Closes Q-HOLIDAY-SET. Does NOT close Q-ROLLOVER-FIXED-DATE — it makes it sharper, and finds evidence on both sides.**

---

## ⚠ First: this researcher corrected an error in MY brief

I wrote in the task: „CF art. 122 alin. (3) — declarația unică due by the **15th of March** of the following
year". **That is wrong.** `research/17` §Q1 — run the same day — had already established alin. (3) fixes
**25 mai**, and that „15 martie" is the **pre-2020** sintagma, replaced by **Legea 296/2020 art. VI
(MO 1269/21.12.2020)**. I propagated a stale date into a fresh brief.

The researcher caught it from the sources rather than accepting the premise:

> ⚠ **Flag for the app:** the brief's premise that CF art. 122 alin. (3) fixes 15 March is **stale for 2026** —
> the live DU deadline is **25 mai**, and there is a separate **15 aprilie 2026** bonificație-3% deadline
> (depunere + plată).

**This is the same failure class as the phantom deadlines**: a stale assertion kept because nothing re-examined
it. It also shows why researcher briefs should state findings as *questions to check* where the finding is
recent, not as settled premises.

**New fact worth noting:** there is a **15 aprilie 2026** deadline tied to the **3% bonificație**
(depunere + plată) — consistent with CPF art. 8 alin. (1) lit. f) / CF art. 121 alin. (1) as recorded in
`notes/phase9b_orchestrator_verification.md` §2. It is **not currently modelled**.

---

## Q1(a) — Which route reached primary text

**Failed routes (exact string → hits → doc id):**

| Search | Hits | Docs | Note |
|---|---|---|---|
| `Sărbătorile legale` | **0** | **309239**, **304538**, **268296**, **290667** | tried both `/Public/DetaliiDocument/` and `/Public/DetaliiDocumentAfis/`; body = **828 chars** each, TOC shell only. Confirms the previous pass |
| `Art. 139` | **0** | `FormaPrintabila/00000G3U2WQB7RR5S7R0DQ48C51WA4UL`, `FormaPrintabila/00000G19585K0BFP9T21OKVKNWQMKU2L` | body = **153 chars** each — **the print form is empty for this act** |

**Route that worked — primary:** the **forma de bază / Republicarea 1** endpoint, which *does* render:
`https://legislatie.just.ro/Public/DetaliiDocument/128646?isFormaDeBaza=True` → **167,029 chars** of body.
`sărbătoare` → 1 hit at index 94,484.

**CONFIRMED (doc 128646, Legea 53/2003 republicată, MO 345/18.05.2011):** the article **is art. 139**, under
`Secțiunea a 3-a Sărbătorile legale`. Verbatim alin. (1) **as republished in 2011**:

> „Articolul 139 (1) Zilele de sărbătoare legală în care nu se lucrează sunt: – 1 şi 2 ianuarie; – prima şi a
> doua zi de Paşti; – 1 mai; – prima şi a doua zi de Rusalii; – Adormirea Maicii Domnului; – 1 decembrie; –
> prima şi a doua zi de Crăciun; – două zile pentru fiecare dintre cele 3 sărbători religioase anuale, declarate
> astfel de cultele religioase legale, altele decât cele creştine, pentru persoanele aparţinând acestora.
> (2) Acordarea zilelor libere se face de către angajator."

**No renumbering — CONFIRMED stable at 139.** Every amending act 2012→2023 cites „art. 139"; **HG 1307/2023**
and **HG 2/2025** cite „art. 139 alin. (4)".

**⚠ Correction to the previous pass (`research/16` §Q5):** art. **138** is *not* „ziua de repaus". Primary text
(doc 128646): **art. 137 = Repausul săptămânal**; **art. 138 = suspendarea repausului săptămânal pentru
„lucrări urgente"**. CONFIRMED.

---

## Q1(b) — Current alin. (1), reconstructed from the MO texts of the amending acts (all primary)

| Addition | Act | MO | In vigoare |
|---|---|---|---|
| 30 noiembrie – Sf. Apostol Andrei | **Legea 147/2012** | **509/24.07.2012** | 27.07.2012 |
| 24 ianuarie – Ziua Unirii (rewrote alin. (1)) | **Legea 176/2016** | **808/13.10.2016** | 16.10.2016 |
| 1 iunie | **Legea 220/2016** | **931/18.11.2016** | 21.11.2016 |
| Vinerea Mare, ultima zi de vineri înaintea Paștelui | **Legea 64/2018** | **226/13.03.2018** | 16.03.2018 |
| 6 ianuarie – Botezul Domnului – Boboteaza; 7 ianuarie – Soborul Sf. Proroc Ioan Botezătorul | **Legea 52/2023** | **186/06.03.2023** | 09.03.2023 |

All **CONFIRMED verbatim** from Portal Legislativ `DetaliiDocument` bodies (docs **265498, 183741, 198708, 182520**).

**⚠ Second correction to `research/16`:** the premise that **Legea 176/2016** added the 3 non-Christian religious
holidays is **wrong** — that clause is in the original 2003/2011 text verbatim (doc 128646). **176/2016 added
24 ianuarie.**

**NOT CHECKED:** **Legea 37/2020** was not retrieved. Also NOT CHECKED: who authored art. 139 **alin. (3)** (the
3-hour Friday reduction). Evidence it pre-existed 2019: **Legea 153/2019** inserts alin. (4) with the words
„**După alineatul (3)** al articolului 139 … se introduce un nou alineat, alineatul (4)" (MO 623/26.07.2019,
**CONFIRMED**, doc **216612**).

### Fixed vs movable vs not-stated

- **Fixed dates written in the act:** 1, 2 ian; 6 ian; 7 ian; 24 ian; 1 mai; 1 iunie; 30 noi; 1 dec.
  *Crăciun* appears as „prima şi a doua zi de Crăciun" — fixed by liturgical convention, **not numeric in the act**.
- **Movable (Orthodox computus):** „prima şi a doua zi de Paşti", „prima şi a doua zi de Rusalii" — **no date, no
  algorithm in the act**. „Vinerea Mare, ultima zi de vineri înaintea Paștelui" — defined *relationally* on Easter.
- **NOT STATED IN THE ACT:** **Adormirea Maicii Domnului — the act gives no date.** 15 August is customary/liturgical
  only. Likewise the 3 non-Christian cult holidays carry no dates (delegated to the cults).
  → **The app must treat 15 August as a convention, not as a statutory date.**

---

## Q1(c) — Movable dates 2026–2028 (cross-checked, PARTLY CONFIRMED)

No primary act states these; they are computus outputs. Sources: OrthodoxWiki church calendar, publicholidays.ro,
labs.llc Easter table, zilelibere.eu, athonapp — **all agree**.

| An | Vinerea Mare | Paști (Dum.) | Paști a 2-a | Duminica Rusaliilor | Rusalii (Luni) |
|---|---|---|---|---|---|
| **2026** | Vin **10 apr** | Dum **12 apr** | Lun **13 apr** | Dum **31 mai** | Lun **1 iunie** |
| **2027** | Vin **30 apr** | Dum **2 mai** | Lun **3 mai** | Dum **20 iunie** | Lun **21 iunie** |
| **2028** | Vin **14 apr** | Dum **16 apr** | Lun **17 apr** | Dum **4 iunie** | Lun **5 iunie** |

Computus rule used: Pentecost = Easter + 49 days; Rusalii days = Pentecost Sunday + following Monday.
Western and Orthodox Easter converge in **2028** (16 Apr).

**⚠ Trap for the app:** in **2026, 1 iunie = a doua zi de Rusalii** — two separate art. 139 alin. (1) items
collapse onto **one date**. The holiday set must **deduplicate**, or 2026 gets a phantom extra holiday.

---

## Q1(d) — The annual HG under art. 139 alin. (4): bridge days do NOT bind a PFA

Enabling text, **CONFIRMED** (Legea 153/2019, MO 623/26.07.2019, doc **216612**):

> „(4) Până la data de 15 ianuarie a fiecărui an, se stabilesc prin hotărâre a Guvernului, **pentru personalul din
> sistemul bugetar**, zilele lucrătoare pentru care se acordă zile libere, zile care precedă și/sau care succedă
> zilelor de sărbătoare legală în care nu se lucrează, prevăzute la alin. (1), precum și zilele în care se
> recuperează orele de muncă neefectuate."

| An | HG | MO | Zile | Status |
|---|---|---|---|---|
| 2024 | **HG 1.307/21.12.2023** | **1172/22.12.2023** | 2 mai, 16 august, 27 decembrie 2024 | **CONFIRMED** — read from `FormaPrintabila/00000G1NVJX3N457UL60YKIYMW3SQJ59` |
| 2025 | **HG 2/10.01.2025** | **19/13.01.2025** | 2 mai 2025 only | **CONFIRMED** — doc **293478** |
| **2026** | **none found** | — | — | Negative: `"pentru anul 2026" hotărâre zile libere sistemul bugetar` → 0 matching HG. Press (libertatea.ro) reports the Bolojan executive **dropped** the 5 ianuarie 2026 punte. **PARTLY CONFIRMED / NOT CHECKED at primary** — the HG register was not queried directly |
| 2027 | not published | — | — | **NOT CHECKED** |

**→ These bridge days do NOT bind a private PFA.** alin. (4) is expressly limited to „**personalul din sistemul
bugetar**", and the HGs themselves say „Pentru personalul din sistemul bugetar". For a private employer or PFA only
**alin. (1)** applies, and alin. (2) puts the grant with the employer. **The app must not apply HG bridge days to a
PFA.** This settles an open item from `research/16` §Q5.

---

## Q1(e) — „zi lucrătoare": undefined, and the app must say so

- **No definition** of „zi lucrătoare" in Codul muncii, CPF or CPC. **CONFIRMED absence** for Codul muncii (full
  2011 base text scanned).
- **Closest primary anchor, CONFIRMED** (doc 128646): „**Articolul 137** (1) Repausul săptămânal se acordă în două
  zile consecutive, **de regulă sâmbăta şi duminica**." → Saturday is the *default rest day*, not a working day.
  alin. (2) permits other rest days by CCM/regulament intern.
- **CONFIRMED** (doc 128646): „Articolul 145 (1) Durata minimă a concediului de odihnă anual este de 20 de zile
  **lucrătoare**." + alin. (3): „Sărbătorile legale în care nu se lucrează … nu sunt incluse în durata concediului
  de odihnă anual."
- **The law is ambiguous.** Structural/practitioner inference, **labelled as such and not law**: the art. 139 alin.
  (4) HGs have only ever selected **Mondays and Fridays** (23 ian, 2 iun, 14 aug, 2 mai, 16 aug, 27 dec, 3 ian) —
  **never a Saturday** — consistent with Saturday being „zi nelucrătoare" in the standard schedule.
- **ANAF's own counting rule for „5 zile lucrătoare" in OUG 120/2021 art. 10 alin. (7): NOT CHECKED.**
- **App default adopted:** working day = **Mon–Fri minus art. 139 alin. (1) holidays**, Saturdays skipped — and
  **exposed as a configurable assumption, not as a cited rule.**

---

## Q2 — Q-ROLLOVER-FIXED-DATE: no primary authority, and evidence on BOTH sides

### (a) Primary authority: none found

No provision squarely resolving „fixed statutory calendar date + zi nelucrătoare" in fiscal law. **No ÎCCJ / RICS
Decizie RIL located** — reported as *none found*, not as proven absence.

- **CPC art. 180 alin. (2)**: „În cazurile prevăzute de lege, termenul este reprezentat de data la care se
  îndeplinește un anumit act de procedură." — this is the textual hook that would let a *fixed date* count as a
  „termen" for art. 181 alin. (2). **PARTLY CONFIRMED — mirror sites only** (coduri.juridice.ro, legeaz.net).
  The researcher did **not** retrieve the CPC primary body this pass, even though `research/16` reached doc
  **304485** fine. Re-running.
- **Strongest primary signal pointing the OTHER way — CONFIRMED**, from ANAF's own hosted MO text
  (`static.anaf.ro/static/10/Anaf/legislatie/OUG_15_2019.pdf`), **OUG 15/2019, MO 204/14.03.2019**, art. unic
  alin. (1):
  > „În anul 2019, termenul de 15 martie inclusiv prevăzut pentru depunerea Declarației unice … **se prorogă**
  > până la data de 31 iulie 2019 inclusiv."

  Preamble: „…de faptul că **prorogarea acestui termen nu se poate realiza decât printr-un act normativ de același
  nivel**." → **the legislator's own premise is that a fixed statutory date moves only by an instrument of equal
  rank, not automatically.**
- **Lead to verify — NOT CHECKED:** **Reg. (CEE, Euratom) 1182/71 art. 3(5)** — „The fact that the last day of a
  period is a public holiday, weekend day … shall not have the effect of extending the period allowed." **If that
  is the text, it cuts against the art. 3(4) rollover `research/16` relied on for e-Factura** — and OUG 120/2021
  art. 10 alin. (7) routes expressly *to* 1182/71. This is the highest-value open item in the note.

### (b) What ANAF actually does — extensions have come **both ways**

1. **25 mai 2025 was a Sunday.** DGFP Brașov comunicat de presă (19.05.2025): „Declarația unică se depune până la
   data de **26 mai**, inclusiv — Termenul limită pentru depunerea Declarației unice (Formular 212) este
   **26 mai 2025** (inclusiv)." → **ANAF rolled the fixed date to the next working day by public notice, with no
   OUG or HG.** Notice existence **CONFIRMED**
   (`static.anaf.ro/static/3/Brasov/20250519135324_com_du2025.pdf`); its legal reasoning is unstated →
   **PARTLY CONFIRMED**.
2. **15 martie 2019 (Saturday)** → moved to 31 iulie 2019 by **OUG 15/2019, MO 204/14.03.2019**. Instrument: OUG.
   **CONFIRMED.**
3. **2026: no test case.** All ANAF 2026 communications state only „25 mai 2026 inclusiv" (DGRFP Cluj
   CJR_DEC-10308; DGFP Iași 27.03.2026; ANAF broșura DU 2026).
4. Bridge-day HGs do contain Trezoreria Statului payment-date mechanics („cu ziua lucrătoare următoare"), but only
   for the budgetary sector.

**Report truncated here** mid-sentence in §Q2(b): „→ Extensions have come both ways: automatically by ANAF notice
(26 mai 2025) *". The conclusion is not reconstructed. What is established is the two-instrument fact above.

### App consequence

**Do not silently roll a fixed statutory date, and do not silently refuse to roll it either.** The honest state of
the law is: no primary rule, one OUG preamble asserting equal-rank instruments are required, and one ANAF county
notice rolling the exact same deadline by press release. **The app should surface the statutory date and treat any
extension as an explicit, dated, sourced override** — the same discipline Phase 9b imposed on every other date.

---

## Still unverified after this pass

1. **Reg. 1182/71 art. 3(5)** — the anti-extension clause. Highest value: it may contradict the rollover
   `research/16` assumed for e-Factura.
2. **CPC art. 180 alin. (2)** at primary level (doc 304485 renders — `research/16` used it).
3. **Legea 37/2020** — not retrieved.
4. **Author of art. 139 alin. (3)** (3-hour Friday reduction).
5. **HG register queried directly** for a 2026 bridge-day HG; and 2027.
6. **ANAF's official counting rule for „5 zile lucrătoare"** — whether Saturday is skipped.

## Sources

**Kept (primary):** Codul muncii **forma de bază doc 128646** via `?isFormaDeBaza=True` — the route that worked.
Amending acts **265498, 183741, 198708, 182520** (Legea 147/2012, 176/2016, 220/2016, 64/2018). **Legea 153/2019
doc 216612**. **HG 1307/2023** print form; **HG 2/2025 doc 293478**. **OUG 15/2019** ANAF-hosted MO PDF.
**DGFP Brașov** 19.05.2025 comunicat.

**Dropped / negative:** docs **309239, 304538, 268296, 290667** (TOC shells, 828 chars) and both print forms of
Legea 53/2003 (153 chars, empty). **zilelibere.eu / publicholidays.ro / labs.llc / OrthodoxWiki / athonapp** kept
only as a *cross-checking set* for computus, labelled PARTLY CONFIRMED. **coduri.juridice.ro and legeaz.net** for
CPC art. 180 — mirrors, superseded by the portal doc 304485 which the next pass should use.

---

## Orchestrator note — three corrections to our own record from one pass

1. **`research/16` §Q5 got art. 138 wrong** (it is not „ziua de repaus" — art. 137 is Repausul săptămânal).
2. **`research/16` got Legea 176/2016 wrong** — it added **24 ianuarie**, not the non-Christian religious
   holidays, which are in the original text.
3. **My own brief carried a stale 15 March date** that `research/17` had already superseded.

All three were caught because the researcher was told a claim they could not check is `NOT CHECKED` and never
`CONFIRMED`. The `Q-HOLIDAY-SET` answer is now primary-verified, and the route that worked —
**`?isFormaDeBaza=True` on the forma de bază doc id** — is itself reusable for any act whose consolidated body
renders as a shell.

---

# Continuation — the truncated remainder (resumed session, 2m 28s)

The session was resumed with only the truncation point and told to add no new research. It recovered the rest
from its own context. **Nothing here is reconstructed.**

## §Q2(b) conclusion, completed

> → Extensions have come both ways: automatically by ANAF notice (26 mai 2025) **and** by explicit instrument of
> equal rank (OUG 15/2019, MO 204/14.03.2019). There is **no general automatic statutory rule found** covering
> fixed fiscal dates. The mechanism actually observed is **ad hoc and year-specific**, not a standing rule the app
> can derive.

That last clause is the real answer to `Q-ROLLOVER-FIXED-DATE`: **there is no rule to implement.** There is a
pattern of one-off interventions.

## §Q2(c) — App consequence, both branches

**Branch A — treat the fixed date as immovable** (conservative; matches OUG 15/2019's own premise):
- Always **display the statutory date as written in the act** (e.g. „25 mai 2026"), never overwrite it.
- If it falls on Sâmbătă / Duminică / an art. 139 alin. (1) holiday, render a **separate, clearly non-authoritative
  advisory row**: „prima zi lucrătoare următoare = <date> — prelungire practicată de ANAF (comunicat DGFP Brașov,
  26 mai 2025); **fără temei primar identificat**".
- **Penalties, dobânzi and decădere stay anchored to the statutory date** unless an override is loaded.

**Branch B — apply CPC art. 181 alin. (2) via CPF art. 75** (the assumption `research/16` leaned on):
- Only defensible for **computed periods** („în termen de 30 de zile", „5 zile lucrătoare"), where „ultima zi a
  unui termen" is literally true.
- For a **fixed calendar date** it is an **interpretive extension, not a reading of the text**. If the product
  ships it, it must be **labelled as an assumption in the UI, not presented as a citation**.

**What the engine must NOT do, in either branch:**

1. Do **not** silently roll a fixed statutory date and present the rolled date as the legal deadline.
2. Do **not** compute penalties or interest against a self-rolled date.
3. Do **not** apply art. 139 alin. (4) HG bridge days to a private PFA — budgetary sector only.
4. Do **not** apply CPC art. 181 alin. (2) to the e-Factura term (OUG 120/2021 art. 10 alin. (7)), which expressly
   routes to **Reg. 1182/71** — whose **art. 3(5) points the *opposite* way (NOT CHECKED)**.
5. Do **not** hardcode the rollover as universal; maintain an **override table** of explicit prorogări
   (OUG / HG / OG / ANAF ordin / comunicat), each with instrument + MO or doc number + date, applied **only to the
   year and obligation named**.
6. Do **not** deduplicate away a holiday that coincides with a fixed date (2026: 1 iunie = a doua zi de Rusalii)
   **without surfacing the collision**.

**Orchestrator note on rule 5:** an override table is the same shape as the `FiscalRule` package Phase 9b insisted
on — dated, sourced, per-obligation — and it is the *opposite* of the hardcoded date arrays that let twelve
fabricated deadlines ship. It is also, importantly, **empty right now**: 2026 has no prorogare, so nothing ships
today depends on it.

## Pending bills

- **PENDING — not law.** Propunere legislativă **b209/08.04.2026** (Senat; doc **26L334**, expunere de motive
  `senat.ro/legis/PDF/2026/26L334EM.PDF`) — amends **Legea 189/2021** and **art. 139 alin. (1) Codul muncii** to
  make **10 mai** a legal non-working holiday. **Senatul a respins** (profit.ro — PARTLY CONFIRMED, press).
  **CES aviz NEFAVORABIL, Nr. 3011/29.04.2026** (`ces.ro` — CONFIRMED that the aviz exists). Status at retrieval:
  **pending at Camera Deputaților**. If adopted it would add a **fixed** date to alin. (1).
- **Rollover rule / CPC art. 181 alin. (2): no pending change found** — explicitly flagged as *absence of a search
  hit, not proof of absence*.

## Sources — kept (primary)

Legea 53/2003 forma de bază — `DetaliiDocument/128646?isFormaDeBaza=True`, the only route that rendered the body
(167,029 chars); gave art. 137, 138, 139, 145 verbatim. `DetaliiDocument` docs **265498** (Legea 52/2023),
**183741** (220/2016), **198708** (64/2018), **182520** (176/2016), **216612** (153/2019), **293478** (HG 2/2025).
`FormaPrintabila/00000G1NVJX3N457UL60YKIYMW3SQJ59` (HG 1307/2023 full text).
`static.anaf.ro/static/10/Anaf/legislatie/OUG_15_2019.pdf`. `static.anaf.ro/static/3/Brasov/20250519135324_com_du2025.pdf`.
`static.anaf.ro/static/3/Cluj/…25_mai_2026.pdf` (CJR_DEC-10308), `static.anaf.ro/static/3/Iasi/…d212.pdf`,
`…/Brosura_Declaratia_Unica_212_2025.pdf`. `senat.ro/legis/PDF/2026/26L334EM.PDF`, CES aviz 3011/29.04.2026.
Easter cross-check set: `en.orthodoxwiki.org/Church_calendar`, `publicholidays.ro/ro/pentecost/`, `labs.llc/easter/`,
`zilelibere.eu`, `athonapp.com` — mutually consistent for 2026/2027/2028.

## Sources — dropped, with reasons

- Docs **309239 / 304538 / 268296 / 290667** and both `FormaPrintabila` ids — **828 / 153 char shells, no body**.
- `cauta.ro`, `legeaz.net`, `coduri.juridice.ro`, `rubinian.com`, `monitoruljuridic.ro`, `legislm.ro`,
  `infodosar.ro` — **mirrors, not primary**; kept only as leads, labelled PARTLY CONFIRMED. `infodosar.ro` returned
  DB-error pages; `monitoruljuridic.ro` is login-gated.
- **`moneyline.ro` — asserts the 25-mai rollover as a standing rule with no citation.** Dropped as authority,
  **kept only as evidence the belief is widespread.** This is the trap Branch A exists to avoid: a practitioner
  restating an assumption as a rule is exactly how `pfa_estimated_declaration` and the +15-day fabrication got in.
- `inteles.ro`, `smartemp.ro` — SEO holiday calendars, no legal value; used only to corroborate 2026 weekdays.
- `portalhr.ro`, `mediafax.ro`, `libertatea.ro`, `profit.ro`, `business24.ro`, `startupcafe.ro`,
  `infotva.manager.ro`, `rescontconsulting.ro` — press/consultancy restatements. `libertatea.ro` and `profit.ro`
  kept only as **PARTLY CONFIRMED single-source signals** (no punte 2026; Senat respins 10 mai).
- `cdep.ro/comisii/munca/pdf/2023/rp767_22.pdf` — committee report; shows only that a 2023 draft's wider holiday
  list was rejected. Not law.

## Gaps / next steps, as reported

1. **Current consolidated art. 139 alin. (1) and alin. (3) verbatim at the 2026 consolidation — NOT CHECKED.**
   No Portal Legislativ consolidation id for Codul muncii renders a body. Next: harvest the `FormaPrintabila` token
   from the `DetaliiDocumentAfis` DOM, or read the printed consolidated article out of the MO PDF of the *latest*
   amending act.
2. **Author of art. 139 alin. (3)** (3-hour reduction in Vinerea precedentă) — NOT CHECKED; only established that
   it pre-existed Legea 153/2019.
3. **Legea 37/2020** — NOT CHECKED.
4. **HG for 2026 and 2027** — NOT CHECKED at primary; the negative is search-level only. Next: query the Portal
   Legislativ HG register directly.
5. **Reg. 1182/71 art. 3(5)** — NOT CHECKED, EUR-Lex not fetched. **Highest-value open item: it governs the
   e-Factura term and may *forbid* rollover there.**
6. **CPC art. 180 alin. (2) / 181 alin. (2) primary body** — mirror-only this pass; NOT CHECKED against
   Legea 134/2010, even though `research/16` read doc **304485** without trouble.
7. **ANAF's counting rule for „5 zile lucrătoare"** — whether Saturday is skipped — NOT CHECKED.
8. **Historical fixed-date rollover instances** (15 martie 2015 = Duminică, 15 martie 2021 = Sâmbătă) — NOT CHECKED;
   would materially strengthen or refute Branch B.
9. **CF art. 122 alin. (3) current text** — NOT CHECKED *this pass*, and the researcher flagged its own „15 March"
   premise as stale. **Already closed elsewhere: `research/17` §Q1 read alin. (3) verbatim from doc 312601 — the
   date is 25 mai.** Cross-pass resolution, no further work needed.
10. **Non-Christian cult holiday dates** — NOT CHECKED; delegated by the act, no statutory dates exist.
11. **File not written** — no filesystem-write tool in the session. Confirms `Q-RESEARCHER-WRITE`.

---

## Final orchestrator note on this pass

**`Q-ROLLOVER-FIXED-DATE` is answered in the only honest form available: there is no rule.** The observed mechanism
is ad hoc and year-specific. That converts an implementation question into a **data question** — an override table
of dated, sourced prorogări — which is the same discipline Phase 9b imposed on every other date, and which is
currently **empty** because 2026 has no prorogare.

**One gap from this pass threatens a question already marked CLOSED.** `research/16` §Q3 encoded
`due = min(emission + 5 wd, cf_319_16 + 5 wd)` *with rollover per Reg. 1182/71 art. 3 alin. (4)*. This pass
surfaced **art. 3(5)**, which on its face says a period is **not** extended because its last day is a holiday.
Both alineate are in the same article, and the e-Factura term is expressed *în zile lucrătoare*, so art. 3 alin.
(3) already excludes weekends and holidays from the count — which may make alin. (4) redundant and alin. (5)
non-conflicting. **That reading is a hypothesis, not a finding.** It is the one thing that must be read from
primary text before the e-Factura SLA is scoped.
