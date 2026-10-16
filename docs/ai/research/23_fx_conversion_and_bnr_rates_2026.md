# Research 23 — FX conversion & BNR rates, FY2026 (PFA, sistem real)

Captured 2026-10-09 by the Researcher (`research-fx-b32`). Primary/official sources only — legislatie.just.ro, bnr.ro / curs.bnr.ro, static.anaf.ro.

**Defect:** B-32 — no currency field on income/expense records, no FX layer, integer RON `Bani`.
**Depends on:** `docs/ai/research/22_deductibility_caps_and_conversion_2026.md` §1 (the art. 9 vs. HG 1/2016 pct. 7 alin. (6) conflict).
**Research date:** 2026-10-08.

## Summary

The conversion conflict is **not closed by any primary text**, but it **is settled in practice**: HG 1/2016 Titlul IV, Cap. II, **pct. 7 alin. (6)** — BNR **average rate for the year of payment** — is still in force in the official text and ANAF itself quotes it, with that exact citation, in its PFA brochures. The DU 2026 instructions (**OPANAF 2.736/2025**, not an OMF) contain **no rule at all** for the art. 68 caps. Critically, **BNR publishes an official annual average EUR/RON** (series `CURSA_EURM`, table „Serii anuale – valori medii –"), so the pct. 7 alin. (6) figure is **obtainable, not computable** — and its published methodology is *average-of-monthly-averages*, not average-of-daily-rates.

---

## Q1 — Resolve the conversion conflict for the art. 68 euro caps

**Answer: Partially verified.** A primary norm exists, is in force, and ANAF applies it. **No primary source reconciles it with CF art. 9 alin. (3) lit. b) + alin. (4)** — the hierarchy conflict from Research 22 stands.

### The norm that governs the caps

HG 1/2016, Normele metodologice, **Titlul IV „Impozitul pe venit", Capitolul II „Venituri din activități independente", Secțiunea a 2-a, pct. 7 alin. (6)**:

> „(6) Limita echivalentului în euro a cheltuielilor deductibile limitat, prevăzută la art. 68 din Codul fiscal, se transformă în lei la **cursul mediu comunicat de Banca Națională a României pentru anul în care s-a efectuat plata**."

Wording is **„cursul mediu"**, *not* „cursul de schimb mediu anual". Verified in ANAF's own copy of the 2016 norms (https://static.anaf.ro/static/10/Anaf/legislatie/HG_1_2016.pdf), so it is **original to HG 1/2016**, not a later insertion. HG 1/2016 was published in **MO nr. 22 din 13 ianuarie 2016** (https://legislatie.just.ro/Public/DetaliiDocument/174822).

### The competing code text

CF art. 9 alin. (3) lit. b) and alin. (4) (Legea nr. 227/2015, MO nr. 688 din 10 septembrie 2015, consolidated):

> „b) în oricare alt caz, sumele se convertesc în moneda națională a României prin utilizarea cursului de schimb valutar **la data la care se primesc sau se plătesc sumele respective** ori la altă dată **prevăzută expres în prezentul cod**."
>
> „(4) În înțelesul prevederilor alin. (3), cursul de schimb valutar, folosit pentru a converti în moneda națională a României sumele exprimate în moneda străină, este **cursul de schimb comunicat de Banca Națională a României valabil pentru datele respective**, exceptând cazurile **prevăzute expres în prezentul cod**."

(https://legislatie.just.ro/Public/DetaliiDocument/171282)

The exception is reserved to **„prezentul cod"** — the code, not the Government's methodological norms. So pct. 7 alin. (6) is, on its face, an exception created *below* the code. **No primary text closes this gap.**

### Administrative sources — clean negative findings

| Instrument | Finding |
|---|---|
| **OPANAF nr. 2.736 din 23 decembrie 2025**, MO nr. 1207 din **29 decembrie 2025** — approves formularul 212 (DU) for FY2025 income / FY2026 option. It is an order of the **președintele ANAF** (with *aviz conform* al Ministerului Finanțelor), **not an OMF** — there is **no OMF approving DU 2026**. | Anexa nr. 2 (instrucțiuni) gives conversion rules **only** for: venitul brut (sums *încasate* in the reporting year), rent in foreign currency (BNR annual average), and income from non-quoted currencies (BNR annual average). **No rule found** for the art. 68 caps. https://static.anaf.ro/static/10/Anaf/formulare/Instructiuni_D212_2736_2025.pdf |
| **ANAF Broșură Declarația Unică 2026** | **No rule found** for the caps. Only the non-quoted-currency rule („…folosindu-se cursul de schimb mediu anual al acesteia, comunicat de Banca Națională a României, din anul de realizare a venitului respectiv"). https://static.anaf.ro/static/10/Anaf/AsistentaContribuabili_r/Brosura_Declaratia_Unica_212_2025.pdf |
| **ANAF Cluj / DGAFP Cluj–AJFP Bistrița-Năsăud, „Completarea și depunerea Declarației Unice… venituri din activități independente", 22 aprilie 2026** | **No rule found** for the caps. It *does* state the 25.000 euro threshold uses „cursul de schimb mediu anual comunicat de Banca Națională a României, pentru anul de realizare a venitului", and for art. 68^3 / art. 85 „cursul de schimb valutar comunicat de BNR **în ultima zi bancară anterioară încasării**". https://static.anaf.ro/static/10/Cluj/cj_DU_activ_indep_22apr2026.pdf |
| **ANAF decizie de soluționare a cererii (binding decision)** on the caps conversion | **None found.** Clean negative. |

### The positive administrative finding

**ANAF Brașov, Serviciul Asistență pentru Contribuabili, „Tratamentul fiscal aplicabil veniturilor realizate de persoanele fizice din activități independente"** — immediately after listing the 400 euro and 4.000 euro caps under „art. 68 alin. (5) Cod fiscal":

> „Limita echivalentului în euro a cheltuielilor deductibile limitat, se transformă în lei la cursul mediu comunicat de Banca Națională a României pentru anul în care s-a efectuat plata.
> **pct. 7 alin. (6) NM Titlul IV Cod fiscal**"

https://static.anaf.ro/static/10/Brasov/Brasov/activ_independente.pdf

The identical sentence + citation appears in **ANAF București** (https://static.anaf.ro/static/10/Bucuresti/Seminar_web_tfai.pdf). This is ANAF telling taxpayers, in its own words, which rate it applies. It is **guidance, not law** — but it is the closest thing to an answer that exists.

### The caps themselves (CF art. 68 alin. (5), consolidated — verified this pass)

- **lit. g)** pensii facultative — „…plătite în scopul personal al contribuabilului… **în limita echivalentului în lei a 400 euro anual pentru fiecare persoană**"
- **lit. g²)** PEPP (Reg. (UE) 2019/1.238) — „**în limita echivalentului în lei a 400 euro anual**"
- **lit. h)** „primele de asigurare voluntară de sănătate, precum și serviciile medicale furnizate sub formă de abonament… **în limita echivalentului în lei a 400 euro anual**"
- **lit. p)** „cotizații plătite la asociațiile profesionale **în limita a 4.000 euro anual**"
- **lit. r)** abonamente facilități sportive — „**în limita echivalentului în lei a 100 euro anual pentru fiecare persoană**"
- **lit. s)** ETF/acțiuni/obligațiuni „prin intermediul entităților prevăzute la art. 96^1 alin. (1)… **în limita echivalentului în lei a 400 euro anual**"

Amending act visible in the consolidation: **Ordonanța de urgență nr. 8 din 24 februarie 2026, MO nr. 147 din 25 februarie 2026**. https://legislatie.just.ro/Public/DetaliiDocument/171282

**Confidence: Partially verified.** Norm text = **Verified**. ANAF's applied rule = **Verified** (two ANAF brochures, verbatim, with citation). Reconciliation with art. 9 = **UNVERIFIED** (no primary source). Currency of pct. 7 alin. (6) after the last amendment marker visible on legislatie.just.ro = **not confirmable** from the portal; no repealing/amending act found for Titlul IV pct. 7 alin. (6) in 2025–2026.

---

## Q2 — Does BNR publish an official annual average EUR/RON? Which identifier?

**Answer: Verified.** It exists. **The app must not compute it.**

### Where

**https://www.bnr.ro/1975-cursul-de-schimb-serii-statistice** — „Cursul de schimb — serii lunare, trimestriale și anuale". Table headed:

> „**Serii anuale**
> **- valori medii -**"

Observed EUR column (lei): **2025 = 5,0415 · 2024 = 4,9746 · 2023 = 4,9465 · 2022 = 4,9315 · 2021 = 4,9204 · 2020 = 4,8371 · 2019 = 4,7452 · 2018 = 4,6535 · 2016 = 4,4908**.

### Methodology — verbatim, and it is *not* a mean of daily rates

> „Cursul de schimb mediu lunar se calculează ca medie aritmetică simplă a cursurilor valutare zilnice ale pieţei valutare"
>
> „Notă: Cursul de schimb mediu trimestrial se calculează ca medie aritmetică simplă a cursurilor valutare medii lunare"
>
> „**Notă: Cursul de schimb mediu anual se calculează ca medie aritmetică simplă a cursurilor valutare medii lunare**"

So: **annual = simple average of the 12 monthly averages**, each monthly average being a simple average of that month's daily rates. **Averaging the daily rates directly gives a different number.** Do not implement the average yourself.

### Exact identifiers

Series codes present on that same BNR page (280 codes enumerated; EUR set):

| Code | Meaning |
|---|---|
| `CURSZ_EUR` | daily reference rate |
| `CURSL_EURM` / `CURSL_EURF` | monthly **average** / monthly end-of-period |
| `CURST_EURM` / `CURST_EURF` | quarterly average / end-of-period |
| **`CURSA_EURM`** | **annual average — this is the pct. 7 alin. (6) figure** |
| `CURSA_EURF` | annual end-of-period |

Interactive query/export UI: **https://www.bnr.ro/1074-baza-de-date-interactiva** („Această pagină permite selecția și exportul seriilor statistice").

### Daily-rate machine endpoints (for the *payment-date* rules, not the caps)

BNR „Cursurile pieței valutare în format XML" — **https://www.bnr.ro/23988-cursurile-pietei-valutare-in-format-xml**, verbatim:

> „**NOU: Server dedicat fișierelor XML — curs.bnr.ro**"
> „ultima cotație înregistrată: **https://curs.bnr.ro/nbrfxrates.xml**"
> „ultimele 10 înregistrări: **https://curs.bnr.ro/nbrfxrates10days.xml**"
> „înregistrările anului 2026: **https://curs.bnr.ro/files/xml/years/nbrfxrates2026.xml** — Analog: 2025, 2024, … 2005"
> „**Actualizarea datelor se face în timp real, imediat după ora 13:00, în fiecare zi bancară.**"
> „Se recomandă evitarea utilizării paginilor site-ului pentru preluarea automată a datelor, deoarece conținutul sau structura acestora se poate modifica fără preaviz. Recomandăm de asemenea **stocarea locală** a informațiilor preluate, la nivelul aplicației…"
> „Fişierele de curs în format XML sunt generate conform schemei **https://curs.bnr.ro/xsd/nbrfxrates.xsd**"

**Migration notice (BNR, 04.08.2026):** „Începând cu data de **6 august 2026**, fișierele XML … nu vor mai fi disponibile direct prin intermediul adreselor de pe domeniul www.bnr.ro, ci vor putea fi accesate **exclusiv prin subdomeniul curs.bnr.ro** … **Denumirile fișierelor XML rămân neschimbate**, fiind modificat doar domeniul de acces." https://www.bnr.ro/25710-2026-08-04-informare-privind-accesarea-cursurilor-de-schimb-ale-pietei-valutare-in-format-xml

Live payload fetched 2026-10-08: `<PublishingDate>2026-10-08</PublishingDate> … <Subject>Reference rates</Subject> <OrigCurrency>RON</OrigCurrency> <Cube date="2026-10-08"><Rate currency="EUR">5.3470</Rate> …`

**Methodological caveat printed by BNR itself:** „Lista publicată de BNR **nu implică obligativitatea utilizării** cursurilor … în tranzacţii efective de schimb valutar **sau în înregistrări contabile**."

**Statutory basis for BNR publishing averages:** Legea nr. 312/2004 (Statutul BNR), **art. 9 alin. (2) lit. b)** — BNR este abilitată „să stabilească cursurile de schimb pentru operațiunile proprii pe piața valutară, **să calculeze și să publice cursurile medii pentru evidența statistică**". Note: *pentru evidența statistică*.

**Licence** — https://www.bnr.ro/2281-termeni-si-conditii: „BNR permite accesul liber la informaţiile publicate și utilizarea acestora în scop personal." / „**Redistribuirea** … este permisă **numai cu indicarea sursei**. În cazul alterării informației preluate … acest lucru trebuie menţionat explicit." / „În cazul **preluării automate, dinamice**, de informații din site-ul BNR, se vor respecta … recomandările specificate în pagina dedicată dezvoltatorilor de software." / „BNR nu îşi asumă răspunderea pentru eventualele prejudicii suferite de o persoană ca urmare a unor decizii bazate pe informaţii publicate sau vehiculate prin internet."

**Confidence: Verified** (page, table, values, methodology notes, series codes, endpoints, licence — all read from bnr.ro / curs.bnr.ro directly).

---

## Q3 — Which rate is „valabil" on a date BNR does not publish (weekend / holiday)?

**Answer: UNVERIFIED as a general rule.**

What the primary texts *do* establish:

1. CF art. 9 alin. (4) presupposes a rate „**valabil pentru datele respective**" but **never defines „valabil"**.
2. **BNR publishes only on banking days.** „Actualizarea datelor se face în timp real, imediat după ora 13:00, **în fiecare zi bancară**." The daily series page (https://www.bnr.ro/9100-cursul-de-schimb-serii-zilnice) shows rows `08.10.2026, 07.10.2026, 06.10.2026, 05.10.2026, 02.10.2026` — **no rows for 03–04 Oct 2026 (Sat/Sun)**. There is literally no BNR datum keyed to a weekend/holiday calendar date.
3. **The only express fiscal treatment of non-publication days in the entire Codul fiscal** is the phrase „**ultima zi bancară anterioară încasării**", which occurs exactly **twice** in the whole code (verified count = 2 in the consolidated text):
   - **art. 68^3 alin. (4)** (venituri din prestarea de servicii de cazare): „În situația în care sumele sunt încasate în valută, echivalentul în lei al acestora se determină prin utilizarea cursului de schimb valutar comunicat de Banca Națională a României **în ultima zi bancară anterioară încasării**."
   - **art. 85 alin. (4)** (închiriere pe termen scurt): identical wording.

   These are **category-specific**, not general. They *are* „prevăzute expres în prezentul cod", but only for those two articles.
4. Historical BNR text: Normele privind funcționarea pieței valutare interbancare, anexe la **Regulamentul BNR nr. V/10.813 din 18 august 1994** privind efectuarea operațiunilor valutare, MO nr. 263 din 19 septembrie 1994, Secțiunea I pct. 2 lit. d): BNR „**publică zilnic un curs de schimb de referinţă al leului**". The same document speaks of „lista cursurilor de referinţă ale Băncii Naţionale a României, **valabile pentru data efectuării schimbului valutar**". **Current force UNVERIFIED** — the act cites Legea nr. 34/1991, which was repealed. https://legislatie.just.ro/Public/DetaliiDocument/5580
5. Legea 312/2004 and Regulamentul BNR nr. 4/2005 (regimul valutar): nothing on validity for non-publication dates.

**Conclusion:** where BNR publishes no rate keyed to the calendar date, the code identifies none, and **no BNR or ANAF source supplies a carry-forward rule**. „Use the last banking day" is an *inference by analogy from art. 68^3 alin. (4) / art. 85 alin. (4)*, not an authority.

**Confidence: UNVERIFIED.**

---

## Q4 — The income side for a PFA paid in EUR

**Answer: Partially verified.** The *collection* basis is verified; the *rate and date* for EUR income under art. 68 are **not expressly stated anywhere**.

**Verified — income is recognised on collection, not invoicing.** CF art. 68 alin. (2) lit. a):

> „(2) Venitul brut cuprinde: a) **sumele încasate** și echivalentul în lei al veniturilor în natură din desfășurarea activității;"

Corroborated by the DU 2026 instructions (OPANAF 2.736/2025, Anexa nr. 2), which define venitul brut by reference to sums **încasate în anul de raportare**.

**Verified — the residual conversion rule is art. 9 alin. (3) lit. b):** for a PFA on sistem real there is no *expres* code exception for EUR service income, so art. 9 alin. (3) lit. b) + alin. (4) apply: the BNR rate **on the date the sum is received**, „valabil pentru datele respective".

**UNVERIFIED:**
- No primary source states a rate/date for **EUR income** under art. 68 specifically. The DU instructions give annual-average rules only for **rent in foreign currency** and **income from non-quoted currencies** — not for quoted-currency (EUR/USD) business income.
- Whether the „ultima zi bancară" rule of art. 68^3 / art. 85 could be argued by analogy to art. 68 income: **UNVERIFIED** — the code does not extend it.
- Which rate applies to a **partial collection** or a **refund/credit note** in EUR: **UNVERIFIED**.

**Confidence: Partially verified** (collection basis = Verified; rate/date for EUR income = Partially verified via art. 9 residual rule; everything else UNVERIFIED).

---

## Q5 — Rounding of a converted amount

**Answer: Verified as to the text; its application to FX conversion is Partially verified.**

**Correction to the question's premise:** CF art. 66 has **no alineate**. It is a single unnumbered paragraph, in **Titlul IV, Capitolul I**, titled „Stabilirea sumelor fixe":

> „**Articolul 66 — Stabilirea sumelor fixe**
> Sumele sunt calculate prin rotunjire la un leu, prin neglijarea fracțiunilor de până la 50 de bani inclusiv și majorarea la leu a fracțiunilor ce depășesc 50 de bani."

**Citation:** Legea nr. 227/2015, Titlul IV, Cap. I, art. 66; as modified by **Pct. 29, Art. I din Legea nr. 296 din 18 decembrie 2020, MO nr. 1269 din 21 decembrie 2020**, applicable **de la 24-12-2020**. https://legislatie.just.ro/Public/DetaliiDocument/171282

Reading: **round-half-up to whole lei** — fractions ≤ 50 bani dropped, fractions > 50 bani rounded up to the leu. This is an **asymmetric half-up** rule and it is the only rounding provision in Titlul IV (5 occurrences of the root *rotunj-* in the whole code, none in art. 9).

**Partially verified:** art. 66 sits in Cap. I („Dispoziții generale" of Titlul IV) and speaks of „**sumele fixe**". Whether it governs the *intermediate* product of a currency conversion, or only the fixed statutory sums, is **not settled by any primary text**. **UNVERIFIED**: the rounding of the *cap* vs. the rounding of the *converted expense* vs. whether rounding happens once at the end or per-record.

**Confidence: Partially verified** (rule text Verified; scope of application UNVERIFIED).

---

## What the app can implement with authority
1. **Store the rate with provenance, always.** Every FX conversion record needs: `rate` (decimal), `currency`, `rate_kind` (`daily_reference` | `annual_average`), `rate_date` / `rate_year`, `source_url`, `fetched_at`, `source_series_code`. BNR's own terms require **indicarea sursei** on redistribution and warn that its list is not mandatory for accounting entries — provenance is the defensible posture.
2. **Caps (art. 68 alin. (5) lit. g, g², h, p, r, s) → BNR annual average of the payment year.** Rule: HG 1/2016 Titlul IV Cap. II pct. 7 alin. (6). **Fetch `CURSA_EURM` / „Serii anuale – valori medii –"; do not compute.** https://www.bnr.ro/1975-cursul-de-schimb-serii-statistice
3. **EUR income → BNR daily reference rate on the collection date.** Rule: CF art. 68 alin. (2) lit. a) (sumele încasate) + art. 9 alin. (3) lit. b) + alin. (4). Endpoint: `https://curs.bnr.ro/files/xml/years/nbrfxrates2026.xml` (year archive) or `nbrfxrates10days.xml` / `nbrfxrates.xml`. Note the **6 Aug 2026 domain migration** — `www.bnr.ro/nbrfxrates.xml` is dead; `curs.bnr.ro` is authoritative.
4. **EUR expense *amounts* (not the caps) → BNR daily reference rate on the payment date.** Rule: art. 9 alin. (3) lit. b) „la data la care se … plătesc sumele respective".
5. **Rounding: half-up to whole lei** (≤ 50 bani dropped, > 50 bani up). Rule: CF art. 66. This maps cleanly onto integer `Bani`.
6. **Cache locally and never re-fetch on read.** BNR explicitly recommends „stocarea locală a informațiilor preluate, la nivelul aplicației" and warns page structure may change without notice. A rate is a **fact about the past**; re-deriving it on each render is both wasteful and unsafe.
7. **Two different rates can legitimately coexist on one expense.** The *expense amount* converts at the payment-date daily rate; the *cap* converts at the payment-year annual average. That is not a bug — it is what the two rules say. The schema must allow both on the same record.

## What must stay unresolved
1. **The hierarchy conflict itself.** HG 1/2016 pct. 7 alin. (6) vs. CF art. 9 alin. (3) lit. b) + alin. (4) („prevăzute expres în **prezentul cod**"). No primary source reconciles them. ANAF applies the norms' rule; the code text does not authorise it. **UNVERIFIED — do not silently pick one and pretend it is settled.** Surface both in the UI and record which was used.
2. **Weekend / holiday payment dates.** No BNR datum exists for those dates; no general carry-forward rule exists in law. The „ultima zi bancară" formula appears exactly twice in the whole Codul fiscal (art. 68^3 alin. (4), art. 85 alin. (4)) and nowhere else. Any implementation is an **analogy**, and must be labelled as such in code and in the audit trail. **UNVERIFIED.**
3. **Currency of pct. 7 alin. (6) after mid-2024.** legislatie.just.ro's consolidation of HG 1/2016 carries amendment markers only up to `30-05-2024`; no repealing or amending act for Titlul IV pct. 7 alin. (6) was found in 2025–2026, but its survival into FY2026 could not be positively confirmed from the portal. **Re-check before shipping.**
4. **The FY2026 annual average does not exist yet.** `CURSA_EURM` for 2026 is published only after the year closes. Any FY2026 cap computed today is a **provisional estimate**, not a legal figure. The app must model `provisional → final` and recompute when BNR publishes 2026.
5. **Rounding scope.** Whether art. 66 applies to intermediate conversion products, and whether rounding is per-record or once at the aggregate. **UNVERIFIED.**
6. **No ANAF binding decision** on the caps conversion was found. If a definitive answer is needed, the only route is a **cerere de soluționare** to ANAF (art. 33 CF / CPVF) — out of scope for research.
7. **The 25.000 euro threshold** (art. 68 alin. (1) / sistem real option) uses „cursul de schimb mediu anual … pentru anul de realizare a venitului" — note: **year of income realisation**, not year of payment. Different anchor from pct. 7 alin. (6). Do not share one conversion function across both without a `basis` parameter.

## Sources
**Kept (all cited above):**
- Codul fiscal consolidated, legislatie.just.ro/Public/DetaliiDocument/171282 — art. 9 alin. (3)–(4), art. 66, art. 68 alin. (2)/(5), art. 68^3 alin. (4), art. 85 alin. (4)
- HG 1/2016 via ANAF, static.anaf.ro/static/10/Anaf/legislatie/HG_1_2016.pdf — pct. 7 alin. (6) verbatim; proves the norm is original to 2016
- HG 1/2016 portal record, legislatie.just.ro/Public/DetaliiDocument/174822 — MO nr. 22 din 13.01.2016
- BNR serii statistice, bnr.ro/1975-… — annual average table, methodology notes, series codes
- BNR XML instructions, bnr.ro/23988-… + migration notice bnr.ro/25710-… — `curs.bnr.ro` endpoints, „în fiecare zi bancară"
- BNR daily series, bnr.ro/9100-… — absence of weekend rows
- BNR termeni și condiții, bnr.ro/2281-… — attribution/licence
- OPANAF 2.736/2025 instructions, static.anaf.ro/static/10/Anaf/formulare/Instructiuni_D212_2736_2025.pdf — clean negative
- ANAF Broșură DU 2026 — clean negative
- ANAF Brașov `activ_independente.pdf` + ANAF București `Seminar_web_tfai.pdf` — the applied rule, verbatim, with citation
- ANAF Cluj `cj_DU_activ_indep_22apr2026.pdf` — 25.000 EUR anchor + „ultima zi bancară"
- Regulamentul BNR V/10.813/1994, legislatie.just.ro/Public/DetaliiDocument/5580 — „publică zilnic un curs de schimb de referinţă" (currency UNVERIFIED)

**Dropped:** secondary tax blogs and commercial DU-filling sites (no primary value); ANAF Brașov `deductibilitate.pdf` and Ploiești deck (art. 25 / profit-tax caps, wrong title); secondary write-ups of OUG 8/2026 fixed-asset thresholds (out of scope); ANAF non-quoted-currency passages already covered by the brochure quote.

## Gaps
1. **Currency of HG 1/2016 Titlul IV pct. 7 alin. (6) in FY2026** — legislatie.just.ro's consolidation lags. Next step: fetch the *latest* consolidated HG 1/2016 annex and diff pct. 7 alin. (6) against the 2016 text; also check MO for 2025–2026 HGs amending Normele Titlul IV.
2. **A general rule for non-publication dates** — likely genuinely absent. Next step: search CPVF and CF for any „zi bancară" definition (the code uses the term without defining it), and check whether ANAF's art. 68^3 commentary defines it.
3. **Whether ANAF has ever ruled on this** — the decizii de soluționare corpus is not full-text searchable on anaf.ro. Next step: a targeted SPV/ANAF request, or a search of the `anaf.ro/legislatie/decizii` index by art. 68.
4. **`CURSA_EURM` machine-readable export** — the code exists on the BNR page but no working BNRStat query/export URL was extracted. Next step: capture the BNRStat Dynacw export endpoint (or fall back to the 1975 page's annual table, which is JS-rendered and needs a browser, not a plain fetch).
5. **BNR reference-rate legal basis, current instrument** — the 1994 regulation is likely stale; Legea 312/2004 art. 9 alin. (2) lit. b) covers averages „pentru evidența statistică" only. No current BNR regulation defining the daily reference rate was located. **UNVERIFIED.**
