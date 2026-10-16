# 16 — e-Factura transmission term, and how Romanian fiscal terms are computed

**Researcher:** `efactura-term-researcher`, run 2026-10-08, 30m 32s.
**Transcribed to this file by the orchestrator.** The `researcher` agent profile has **no file-write tool**
(tools: `web_enable`, `web_search`, `fetch_content`, `get_search_content`, `source_check`, `agent_browser*`,
`recall`), so researcher output exists only in orchestrator context unless transcribed. The researcher itself
reported that it could not read `research/15` or `notes/efactura_integration_decision.md` for the same reason.
Nothing from those files was relied on or duplicated by it — which turns out to be an **independent** pass,
not a restatement.

**Closes: Q-EFACT-TERM, Q-EFACT-DOUBLE-BOUND, Q-CF-319-16, Q-HOLIDAY-SET (partly), and Q-TERM-COMPUTATION —
the last one with the largest blast radius in the project.**

---

## Q1 — Q-TERM-COMPUTATION: **GENERAL RULE, not e-Factura-specific** ✅ CONFIRMED

This is the answer with the widest reach. It is a **two-layer** rule, and the layer that does the work is not
in fiscal law at all.

**Layer 1 — CPF-proced (Legea 207/2015), Titlul III, Cap. VI „Termene", art. 75 „Calcularea termenelor"**
— Portal Legislativ doc **312603**, consolidare **08.08.2026**. Verbatim, single alineat, no amendment note
displayed:

> „Termenele de orice fel privind exercitarea drepturilor și îndeplinirea obligațiilor prevăzute de Codul
> fiscal, de prezentul cod, precum și de alte dispoziții legale aplicabile în materie, **dacă legislația
> fiscală nu dispune altfel**, se calculează potrivit dispozițiilor Codului de procedură civilă, republicat."

**Layer 2 — CPC (Legea 134/2010, republicat), art. 181 alin. (2)** — doc **304485**, consolidare **14.12.2025**.
Verbatim:

> „Când ultima zi a unui termen cade într-o zi nelucrătoare, termenul se prelungește până în prima zi
> lucrătoare care urmează."

And CPC art. 181 alin. (1) pct. 2, same consolidation: „când termenul se socotește pe zile, nu intră în calcul
ziua de la care începe să curgă termenul, nici ziua când acesta se împlinește." — i.e. **the day-0 convention
the operator described is the general CPC rule**, not an e-Factura quirk.

**Answer: the extension is a general rule reaching every fiscal term the app models**, subject to the express
carve-out „**dacă legislația fiscală nu dispune altfel**".

### Two carve-outs found

1. **OUG 120/2021 art. 10 alin. (7)** displaces the CPF→CPC route for the e-Factura term by naming its own
   regime: **Regulamentul (CEE, Euratom) nr. 1182/71**. Its art. 3 alin. (3)–(4), verbatim (EUR-Lex RO):
   > „Termenele includ zilele de sărbători legale, duminicile și sâmbetele, cu excepția cazului în care
   > acestea sunt excluse în mod expres sau dacă termenele sunt exprimate în zile lucrătoare."
   > „Dacă ultima zi a unui termen exprimat altfel decât în ore este o zi de sărbătoare legală, o duminică
   > sau o sâmbătă, termenul se încheie la expirarea ultimei ore a următoarei zile lucrătoare."

   Note the interaction: because the e-Factura term is expressed **în zile lucrătoare**, art. 3 alin. (3)
   *excludes* weekends and holidays from the count in the first place.

2. **CPF-proced art. 205 alin. (2)** (executare silită) has its own extension rule — **paraphrase, secondary
   source only, NOT verified in the official consolidation.**

### The interpretive risk this does NOT resolve — `NOT CHECKED`

CPC art. 181 alin. (2) speaks of „ultima zi a unui **termen**". CF art. 319 alin. (16) and CF art. 122 alin. (3)
fix **calendar dates** („a 15-a zi a lunii următoare", „15 martie"), not computed periods. **Whether art. 181
alin. (2) extends a fixed statutory calendar date is an unresolved doctrinal question** — the researcher
declined to guess, and so do we. This is now the single most consequential open question for the deadline
engine, because `d212_filing` is a fixed calendar date. Tracked as **Q-ROLLOVER-FIXED-DATE**.

---

## Q2 — Q-EFACT-TERM: **5 zile lucrătoare** ✅ CONFIRMED — the operator was right

**OUG 120/2021 art. 10 alin. (7)** — Portal Legislativ doc **310662**, consolidare **01.06.2026**; the same
text verified identically in doc **305980**, consolidare **15.01.2026**. Verbatim, with the amendment note
exactly as printed:

> „(7) Termenul-limită pentru transmiterea facturilor în sistemul național privind factura electronică
> RO e-Factura este de **5 zile lucrătoare** de la data emiterii facturii, dar nu mai târziu de 5 zile
> lucrătoare de la data-limită pentru emiterea facturii prevăzută la art. 319 alin. (16) din Legea nr.
> 227/2015, cu modificările și completările ulterioare. Calculul termenului-limită se efectuează conform
> Regulamentului (CEE, Euratom) nr. 1182/71 al Consiliului din 3 iunie 1971 privind stabilirea regulilor
> care se aplică termenelor, datelor și expirării termenelor."

> *(la 01-01-2026, Alineatul (7), Articolul 10, Sectiunea a 4-a, Capitolul I a fost modificat de Punctul 2.,
> Articolul X din ORDONANȚA DE URGENȚĂ nr. 89 din 23 decembrie 2025, publicată în MONITORUL OFICIAL nr.
> 1203 din 24 decembrie 2025)*

- **Unit: `zile lucrătoare`, NOT `zile calendaristice`.** This is the distinction this project has been wrong
  about twice. It flipped back to working days on **01-01-2026**.
- **Runs from `data emiterii facturii`** — invoice emission, as the operator said.
- **Article number is art. 10 alin. (7)** — correct. Not art. 10¹, which is the B2C article.

### Amendment chain producing the 2026 value

| Step | Instrument | MO | Effect |
|---|---|---|---|
| Introduced | **OUG 115/2023**, art. LXVII, Cap. II | **1139/15.12.2023** | „5 zile **calendaristice** … dar nu mai târziu de 5 zile calendaristice de la data-limită prevăzută pentru emiterea facturii la art. 319 alin. (16)" |
| Modified | **OUG 69/2024** | **582/21.06.2024** | dropped „prevăzute la alin. (1)", reworded to „data-limită pentru emiterea facturii"; still **5 zile calendaristice** *(ANAF comparison table — secondary)* |
| Modified | **OUG 89/2025, art. X pct. 2** | **1203/24.12.2025**, effective **01.01.2026** | → **5 zile lucrătoare** + express reference to Reg. 1182/71 |

### Temporary / derogation provisions found — in force, not bills

- **Legea 296/2023 art. LIX alin. (6)**: until **30.06.2024** the transmission term was **5 zile lucrătoare**
  — which is why it switched to calendar days from 01.07.2024. *(secondary)*
- **OUG 30/2024** amended LIX alin. (7)–(8): no sanction for late transmission where the term intervened
  **until 31.05.2024 inclusive**. *(secondary)*
- **OUG 6/2026 art. IX alin. (1)** (MO **77/30.01.2026**), verbatim from the portal consolidation:
  > „Prin derogare de la prevederile art. 5, art. 9¹, art. 10 alin. (1), art. 10¹ alin. (2) și art. 10¹⁰ din
  > Ordonanța de urgență a Guvernului nr. 120/2021 … furnizorii/prestatorii care se identifică fiscal prin
  > codul numeric personal nu au obligația utilizării sistemului național privind factura electronică
  > RO e-Factura **până la data de 1 iunie 2026**."

  **This bears directly on `Q-CNP-IDENTITY`** (open since research/13 §225): it is a dated derogation for
  **CNP-identified** suppliers, expired **01.06.2026**. It does not settle whether a PFA „se identifică
  fiscal prin CNP", but it shows the legislator using that exact phrase, and it shows the exemption is
  time-limited rather than permanent.
- **art. 10¹ alin. (2¹)** (B2C), introduced by OUG 89/2025, effective 01.01.2026: **same double bound,
  5 zile lucrătoare.**

---

## Q3 — Q-EFACT-DOUBLE-BOUND: **statutory — model TWO bounds** ✅ CONFIRMED

The second bound is **in the e-Factura act itself**, in the same sentence of art. 10 alin. (7) quoted above.
It is not in the CF and it is **not a practitioner gloss**. The operator's claim is substantively correct.

**One wording correction that matters:** the statute anchors the second bound to „**data-limită pentru
emiterea facturii prevăzută la art. 319 alin. (16) din Legea nr. 227/2015**" — a specific, citable CF
deadline — not to a free-floating „data-limită prevăzută în Codul Fiscal". The model must name the anchor.

**Effective rule for 2026:**

```
due = min( emission_date + 5 working days,
           cf_319_16_deadline(15th of following month) + 5 working days )
```
with non-working-day rollover per **Reg. 1182/71 art. 3 alin. (4)**.

Historical: from **15.12.2023 to 31.12.2025** both bounds were **5 zile calendaristice**.

---

## Q4 — Q-CF-319-16: alineat number **(16)** ✅ CONFIRMED

**CF (Legea 227/2015), Titlul VII, Cap. XIII, art. 319 „Facturarea", alin. (16)** — doc **312601**,
consolidare **08.08.2026**. Verbatim:

> „(16) Pentru alte operațiuni decât cele prevăzute la alin. (15), persoana impozabilă are obligația de a
> emite o factură cel târziu până în cea de-a 15-a zi a lunii următoare celei în care ia naștere faptul
> generator al taxei, cu excepția cazului în care factura a fost deja emisă. De asemenea, persoana
> impozabilă trebuie să emită o factură pentru suma avansurilor încasate în legătură cu o livrare de
> bunuri/prestare de servicii cel târziu până în cea de-a 15-a zi a lunii următoare celei în care a
> încasat avansurile, cu excepția cazului în care factura a fost deja emisă."

**No amendment note at this alineat.** Search `\(la [^)]{10,400}\)` over the 2,600 characters following the
opening of alin. (16) in doc 312601 → **0 hits**. Corroboration: **OUG 89/2025** (Dec 2025) itself
cross-refers to „art. 319 alin. (16)", so the numbering is stable into 2026.

**The operator's paraphrase is imprecise and must not be quoted.** „până în a 15-a zi a lunii următoare
livrării/prestării" is wrong: the statutory anchor is „**cea în care ia naștere faptul generator al taxei**"
— the chargeable event, not delivery/performance. Also note **alin. (15)** (intracomunitary supplies) and
**alin. (3)** (self-invoices) carry their own separate 15th-day rules.

---

## Q5 — Q-HOLIDAY-SET: article number **139** ✅ CONFIRMED — but the text is **NOT primary**

**Codul muncii (Legea 53/2003, republicat), Titlul III, Cap. II, Secțiunea a 3-a „Sărbătorile legale",
art. 139.** Portal Legislativ consolidation history: latest doc **309239**, consolidare **27.04.2026**
(previous 304538, 18.12.2025; forma de bază doc **128646**).

⚠️ **Verification caveat — this is the weakest part of the report.** The Portal Legislativ body for docs
**309239** and **304538** rendered only a table-of-contents shell (page text length **828 chars**).
`Articolul 139` in doc 309239 → **0 hits**. The list below is therefore **mirror text (legislatie.info,
doc id 128647), not portal-verified**:

> „(1) Zilele de sărbătoare legală în care nu se lucrează sunt:
> – 1 și 2 ianuarie;
> – 6 ianuarie – Botezul Domnului – Boboteaza;
> – 7 ianuarie – Soborul Sfântului Proroc Ioan Botezătorul;
> – 24 ianuarie – Ziua Unirii Principatelor Române;
> – Vinerea Mare, ultima zi de vineri înaintea Paștelui;
> – prima și a doua zi de Paști;
> – 1 mai;
> – 1 iunie;
> – prima și a doua zi de Rusalii;
> – Adormirea Maicii Domnului;
> – 30 noiembrie – Sfântul Apostol Andrei, cel Întâi chemat, Ocrotitorul României;
> – 1 decembrie;
> – prima și a doua zi de Crăciun;
> – două zile pentru fiecare dintre cele 3 sărbători religioase anuale, declarate astfel de cultele
>   religioase legale, altele decât cele creștine, pentru persoanele aparținând acestora.
> (2) Acordarea zilelor libere se face de către angajator.
> (2¹) Pentru salariații care aparțin de un cult religios legal, creștin, zilele libere pentru Vinerea Mare
> … se acordă în funcție de data la care sunt celebrate de acel cult.
> (4) Până la data de 15 ianuarie a fiecărui an, se stabilesc prin hotărâre a Guvernului, pentru personalul
> din sistemul bugetar, zilele lucrătoare pentru care se acordă zile libere, zile care precedă și/sau care
> succedă zilelor de sărbătoare legală…"

**Why a holiday set cannot be a static array — four independent reasons, all confirmed:**

1. **Movable feasts** — Vinerea Mare, prima și a doua zi de Paști, prima și a doua zi de Rusalii are tied to
   the **Orthodox computus**.
2. **Denomination-dependent** — alin. (2¹) makes the movable Christian feasts vary by cult.
3. **Not stated in the act** — *Adormirea Maicii Domnului* is enumerated **without a date** (15 August in
   practice; the act does not say so).
4. **The final bullet is not a national calendar at all** — 2 days × 3 holidays per recognised non-Christian
   cult, per cult.

Plus **alin. (4) bridge days**: an **annual HG**, **budgetary sector only**, published by **15 January** each
year — not derivable from the Codul muncii and must be loaded per year.

Amendments shaping the list (from the mirror's notes, so **secondary**): Legea 176/2016 (3 religious
holidays), Legea 220/2016 (1 iunie), Legea 64/2018 (Vinerea Mare), Legea 88/2018 (alin. 3), Legea 37/2020
(alin. 2¹, 3¹), **Legea 52/2023** (6 și 7 ianuarie).

**`Q-HOLIDAY-SET` therefore stays OPEN.** Re-researched by `holiday-rollover-researcher` → `research/17`.

---

## Consolidation metadata — doc id + consolidare date only, **no note counts**

| Act | Doc id | Consolidare | Verified content |
|---|---|---|---|
| CF, Legea 227/2015 | **312601** | **08.08.2026** | art. 319 alin. (16) verbatim |
| CPF-proced, Legea 207/2015 | **312603** | **08.08.2026** | art. 75 verbatim |
| CPC, Legea 134/2010 (rep.) | **304485** | **14.12.2025** | art. 181 alin. (1)–(2) verbatim |
| OUG 120/2021 | **310662** | **01.06.2026** | art. 10 alin. (7) verbatim + OUG 6/2026 note |
| OUG 120/2021 (prior) | 305980 | 15.01.2026 | same text |
| Codul muncii, Legea 53/2003 (rep.) | **309239** | **27.04.2026** | ⚠️ body did not render — see Q5 |

## Negative findings — exact string → hits → doc

- `\(la [^)]{10,400}\)` within 2,600 chars after CF art. 319 alin. (16) opening → **0 hits** (doc 312601)
- `Articolul 139` → **0 hits** (doc 309239; body length 828 chars, TOC shell only)
- `Zilele de sărbătoare legală în care nu se lucrează` → **0 hits** (doc 309239)
- `Termenul-limită pentru transmiterea facturilor` → **0 hits** (doc **302101**) — **302101 is Ordin
  1322/2017, not OUG 120/2021. Wrong id; do not use it.**

## NOT CHECKED

- CPF-proced art. 205 alin. (2) — secondary source only.
- OUG 69/2024 and OUG 115/2023 exact wording of art. 10 alin. (7) — from ANAF comparison tables / portal
  notes, not read in the primary MO text.
- Legea 296/2023 art. LIX alin. (6)–(8) and OUG 30/2024 — secondary only.
- **Whether CPC art. 181 alin. (2) extends a fixed calendar date** → **Q-ROLLOVER-FIXED-DATE**.
- Codul muncii art. 139 at primary level → **Q-HOLIDAY-SET**.

## Sources

**Kept:** CF 312601; CPF-proced 312603; CPC 304485; OUG 120/2021 310662 and 305980 (legislatie.just.ro);
Regulamentul 1182/71 RO text (eur-lex.europa.eu); legislatie.info art. 139 mirror (labelled mirror);
ANAF comparison PDFs for OUG 89/2025 and OUG 69/2024.

**Dropped:** legeaz.net / codulmuncii.eu / avocat-dreptul-muncii.eu (stale or undated mirrors);
**zilelibere.net — actively misleading**, it invents `lit. a)–k)` lettering that art. 139 alin. (1) does not
contain; portalpfa.ro and e-guvernare (2024-era commentary, superseded by OUG 89/2025); legeaz's CPC art. 101
page (**wrong article** — the rule is art. 181 alin. (2)).

---

## Orchestrator note — this corroborates research/13 independently

The researcher could not read our files, so this is a **second independent pass**. It reaches the same
conclusion as **research/13 §4** — „5 zile lucrătoare from 01-01-2026, OUG 89/2025 pct. 2 Art. X,
MO 1203/24.12.2025; before that 5 calendar days" — and adds the verbatim text plus the amendment note.

**It also exposes a stale line in our own docs.** `research/15` §10 lists as unverified „**The 5-calendar-day
transmission term** (art. 10 alin. (7))". The label „5-calendar-day" is wrong for 2026 and contradicts
research/13 §4 in the same repo. research/15 inherited the framing from the operator/Gemini claim it was
auditing rather than correcting it. Corrected in STATE; the substance of research/15's flag — *never verified
at primary level* — was right, and this note closes it.
