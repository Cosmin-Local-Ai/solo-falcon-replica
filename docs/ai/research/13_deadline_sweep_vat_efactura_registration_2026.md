# Deadline sweep — VAT filings, e-Factura, fiscal registration (2026)

Researcher pass on the four deadline claims raised by the operator plus the gaps the repo had
already flagged. Complements `research/11` (first-year PFA, VAT registration) and `research/12`
(quarterly payment dates). Read those first; this file does not repeat them.

## Sources — consolidations actually read

| Act | Doc id | Notes | Latest note | Used for |
|---|---|---|---|---|
| Cod fiscal, Legea 227/2015 | **312601** | 1,008 | 29-12-2025 | CF art. 122, 316, 319, 322, 323, 326, 120/120¹ status |
| Cod de procedură fiscală, OG 2/2024 | **304520** | 825 by this pass's regex (repo records 828 — format variance, not a contradiction) | 18-12-2025 | CPF art. 81, 82, 83 |
| OUG 120/2021 (RO e-Factura) | **310662** | 47 | 24-12-2025 | art. 10, 10^1, 10^8, 10^10 |

**Not reached:** **OUG 44/2008** — no consolidation, no doc id, no note count. This is a gap, not a
finding, and it is what leaves Q-ONRC-CARVEOUT unresolved (§7).

Confidence is graded per claim. Where this pass contradicts an earlier one, the contradiction is
stated rather than smoothed over.

---

## 1. The 30-day Declarația Unică at PFA setup — **REFUTED** (high)

The operator's claim: „În 30 de zile: Depunerea Declarației Unice pentru estimarea veniturilor la
înființarea PFA-ului". Gemini independently asserted the same and cited **CF art. 120 alin. (2)**.

**There is no 30-day DU obligation for a PFA opening in 2026.**

- **CF art. 120 and art. 120¹ are `Abrogat.`** in doc 312601, by **OUG 128/2024 pct. 11 Art. I,
  MO 1125/11.11.2024, eff. 01-01-2025**. So the article Gemini cited is dead. This repo already
  recorded the same abrogation independently at `phases/06:40` and `phases/05:64` — same article,
  same punct, same act, same MO, same date.
- **CF art. 122 alin. (2)** is the DU obligation when an activity *begins* during the year.
- **CF art. 122 alin. (3)** then extends the 25 May term to exactly that case, verbatim:
  *„Prevederea se aplică și în situațiile prevăzute la alin. (2)."*

So a PFA opened at any point in 2026 files its first DU by **25 May 2027**. The app already emits
that correctly as `d212_filing` from rule `PFA_DEADLINE_2026`.

Negative findings (doc 312601): `declarație estimativ*` = **0 hits**, `Declarația 100` = **0**,
`Formular 100` = **0**.

**Not established:** the pre-abrogation *title* of art. 120/120¹ — doc 312601 renders them only as
`Abrogat.`, so this pass does **not** name "Declarația 100" as the dead form's title. That would
need the MO 688/2015 base text. Do not assert it.

**Consequence for the app:** `pfa_estimated_declaration` is a phantom of an obligation abrogated
15 months before the planning year, duplicating a correct rule that already ships. Delete it.
Do not reinstate it under another name. See `research/11` §4 for the full derivation.

## 2. VAT return (decont de taxă) — **PARTLY CONFIRMED** (high)

Operator's claim: „Lunar (până pe 25): Depunerea decontului de TVA (Formular 300)".

**Article — and this corrects the brief that commissioned the pass.** The obligation is
**CF art. 323 alin. (1)**, in **Titlul VII**, not Titlul VI as the brief said. The brief's
article was right; its title was wrong.

- **art. 323 alin. (1)** — *„…persoana impozabilă care înregistrează operațiuni taxabile în
  condițiile art. 316 alin. (1) și/sau care efectuează achiziții intracomunitare taxabile este
  obligată să depună un decont de taxă pentru fiecare perioadă fiscală… până la data de 25 a lunii
  următoare perioadei fiscale încheiate."*
- **art. 323 alin. (2)** — the model is „stabilit de Ministerul Finanțelor Publice". **"Formular
  300" is not named in the law.** It is an ANAF-order artefact → secondary level, do not cite it
  as law.

**The period is not unconditionally monthly.** This is where the operator's claim is only partly
right, and it matters: an unconditional monthly deadline would be wrong in exactly the way the
quarterly instalment deadlines were wrong.

- **art. 322 alin. (1)** — the fiscal period is the **calendar quarter** for the persons in alin.
  (2) and (3); **the month** for everyone else. Monthly is the residual default, not the rule.
- **art. 322 alin. (2)** — **quarterly** if the value of the taxable supplies in the previous year
  did not exceed the **100.000 €** equivalent.
- **art. 322 alin. (3)-(4)** — a person becoming registered **during** the year uses a **pro-rated
  estimated** turnover; if that estimate ≤ 100.000 € they are **quarterly in the registration
  year**. This is the case that applies to a PFA that registers mid-2026.
- **art. 322 alin. (7)** — a quarterly taxpayer who performs a taxable **intracomunitary
  acquisition** becomes monthly.

**Payment is a separate rule, not the same sentence.** **art. 326 alin. (1)** pegs payment of the
VAT due to the filing date **by cross-reference** — it does not state an independent date.

**Independent corroboration:** the operator's Gemini pass reached art. 323 alin. (1), the
"lună sau trimestru, după caz" conditionality, and art. 326 alin. (1) payment-by-cross-reference
on its own, and a 2026-dated third-party source (JURIDICE.ro, 23 ian. 2026) quotes art. 323
alin. (1) with the art. 316 registration hook. Two independent paths to the same alineat.

## 3. Declarația de mențiuni — **NEW, not previously modelled** (high)

Not asked about; found while reading art. 322. Two distinct obligations:

| Obligation | Term | Citation |
|---|---|---|
| Quarterly-period taxpayers | **25 January**, fixed | art. 322 alin. (6); exception for those requesting deregistration under art. 310 |
| Quarterly taxpayer switching to monthly on an intracomunitary acquisition | **≤ 5 working days** from the end of the month in which exigibilitatea of the acquisition-VA occurred | art. 322 alin. (7)-(8) |

The second is **event-relative and in working days** — the two features that have caused the most
errors in this repo.

## 4. e-Factura transmission — **PARTLY CONFIRMED** (medium-high)

Operator's claim: „5 zile lucrătoare: Încărcarea facturilor în e-Factura (B2C/B2B)".
Gemini's version: „**5 zile calendaristice**", amended by Legea 296/2023.

**The operator's day-type is right for 2026; Gemini's is wrong and materially so.**

- **art. 10 alin. (7)** OUG 120/2021 — the term is **5 working days** („zile lucrătoare, nu mai
  târziu de această dată"), introduced **effective 01-01-2026** by **OUG 89/2025 pct. 2 Art. X,
  MO 1203/24.12.2025**. Before that amendment the text read **5 calendar days**. Gemini's
  „calendaristice" is the **pre-2026** text, and it attributes the change to the wrong act
  (Legea 296/2023). Encoding calendar days would show the deadline up to two days early, every
  week of the year.
- The term runs **from `data emiterii facturii`**, and is additionally capped at 5 working days
  from the CF art. 319 alin. (16) issue deadline. It is therefore **event-relative to an invoice**,
  not a fixed calendar date.

**Gates — neither is VAT registration:**
- **B2B: art. 10 alin. (1)** (as amended by OUG 138/2024 pct. 2 Art. I, MO 1222/05.12.2024) —
  applies between **persoane impozabile stabilite în România** (CF art. 266 alin. (2)) for supplies
  with place of supply in RO.
- **B2C: art. 10^1 alin. (2)** (OUG 138/2024 pct. 3 Art. I), from **01-01-2025**, for all such
  operators **whether or not VAT-registered**. Negative finding: **no turnover threshold** —
  `100.000 lei` and `395.000` = **0 hits**.
- **Bonuri fiscale** are excepted.

**The exemption that decides whether this applies to a PFA at all:**
- **art. 10^10 alin. (1)** — suppliers care **„se identifică fiscal prin CNP"** are exempt from
  art. 10 alin. (1) and art. 10^1 alin. (2). Note: **Legea 88/2026 pct. 8 Art. III, MO 459/
  29.05.2026, eff. 01-06-2026**, with a derogation in **OG 6/2026 art. IX** until the same date.
- Whether a PFA identifies fiscally **by CNP** is **unresolved** — see §6.

**Do not encode e-Factura yet.** `research/11` §9.3 already said so; this pass confirms why.

## 5. What the app should model

| Obligation | Event type | Offset | Fixed vs event-relative | Gate | Conf. |
|---|---|---|---|---|---|
| DU (income tax + CAS + CASS), **including start of activity** | filing **and** payment — one DU is one titlu de creanță, art. 122 alin. (9) | **25 May, Y+1** | fixed | art. 122 alin. (1) lit. a) + alin. (2) + alin. (3) | high |
| ~~30-day DU / declarație estimativă~~ | **do not model** | — | — | art. 120/120¹ Abrogat from 01-01-2025 | high |
| Declarație de înregistrare fiscală (CPF) | filing | 30 days from *începerea activității* | event-relative | **UNRESOLVED for PFA** — §7. Do not encode | low |
| Decont de taxă — monthly | filing | 25th of month after the period | fixed within a monthly cycle | VAT-registered (art. 316) **and** period = month (art. 322 alin. (1); forced by art. 322 alin. (7)) | high |
| Decont de taxă — quarterly | filing | 25th of month after the quarter | fixed within a quarterly cycle | prior-year CA ≤ 100.000 € (art. 322 alin. (2)); **mid-year registrant: pro-rated estimate ≤ 100.000 € → quarterly in the registration year** (art. 322 alin. (3)-(4)) | high |
| TVA payment | payment | same date as the decont | derived by cross-reference, not independent | VAT due for the period (art. 326 alin. (1)) | high |
| Declarație de mențiuni (quarterly) | filing | **25 January** | fixed | quarterly-period taxpayer (art. 322 alin. (6)) | high |
| Declarație de mențiuni (period switch) | filing | ≤ **5 working days** from month end of exigibilitate | event-relative, working days | quarterly taxpayer + intracomunitary acquisition (art. 322 alin. (7)-(8)) | high |
| e-Factura B2B / B2C | transmission | **5 working days** from invoice issue | event-relative, working days | see §4 gates; **CNP-identified suppliers exempt** | medium-high |
| e-Factura onboarding | registration request | **no statutory term tied to VAT registration** | — | procedure by ANAF order (art. 10^8 alin. (1)) — secondary | medium |

## 6. Modelling constraint the research exposed

`computeDeadlines(rules, query)` takes `DeadlineQuery { taxYear, asOfDate, pfaStartDate,
vatExceedanceMonth }` (`src/domain/deadlines.ts:87-91`). The VAT input is a **month**, not a date.

That is the actual origin of `month_end(exceedance_month) + 30 days`: the code needed *a day* and
the input only had *a month*, so it invented one. The law since **01-09-2025** says the request is
due **„cel târziu la data depășirii plafonului"** — the day of exceedance itself (CF art. 316 alin.
(1) lit. b) + alin. (1¹) lit. b), OG 22/2025 pct. 18-19, MO 851/22.08.2025; `research/11` §5).
`month_end + 30` **never existed** — `30 de zile de la sfârșitul lunii` = 0 hits.

So fixing the citation without fixing the input granularity would just move the invention. Any
correct implementation needs either an exact exceedance date, or an explicitly conservative bound
that says so.

## 7. Q-ONRC-CARVEOUT — **NOT ESTABLISHED.** Encode neither term.

The 30-day fiscal-registration duty is **not safe to encode for a PFA.**

Established from CPF doc 304520, all verbatim:

- **art. 81 alin. (1)-(2)** — CIF attribution is done exclusively by the central fiscal organ
  „cu excepția cazului în care prin lege se prevede altfel".
- **art. 82 alin. (1)** — the CIF is:
  - **lit. b)** „pentru persoanele fizice și juridice … care se înregistrează potrivit legii speciale
    la registrul comerțului, **codul unic de înregistrare** atribuit potrivit legii speciale";
  - **lit. c)** „pentru persoanele fizice care desfășoară activități economice în mod independent
    sau exercită profesii libere, **cu excepția celor prevăzute la lit. b)**, codul de înregistrare
    fiscală atribuit de organul fiscal".
  (sole note on alin. (1): L 295/2020 pct. 17 Art. I, MO 1266/21.12.2020, eff. 24-12-2020)
- **art. 82 alin. (2)** — „În scopul administrării impozitului pe venit și contribuțiilor sociale,
  în cazul persoanelor fizice care sunt contribuabili potrivit Codului fiscal, codul de
  identificare fiscală este **codul numeric personal**." (OG 30/2017 pct. 13 Art. I, MO 708/
  31.08.2017, eff. 03-09-2017)
  → **This does NOT create a din oficiu / ex-officio registration from the trade register.** The
  orchestrator's hypothesis that alin. (2) supplies one is **refuted**. It only fixes CIF = CNP for
  income-tax purposes.
- **art. 82 alin. (6)** — the declarație de înregistrare fiscală is due within 30 days of:
  **a)** data înființării potrivit legii (persoane juridice, asocieri, entități fără personalitate
  juridică); **b)** data stabilirii în România (foreign companies with effective management in RO);
  **c)** „data începerii activității pentru persoanele fizice care desfășoară activități economice
  în mod independent sau exercită profesii libere, **cu excepția celor care se înregistrează,
  potrivit legii speciale, la registrul comerțului**"; **d)** primul venit / calitatea de angajator;
  **e)** primul venit (nerezidente). Sole note: OG 30/2017 pct. 13 Art. I, MO 708/31.08.2017.
- **art. 82 alin. (7)** — the central fiscal organ **may** register din oficiu a subject who failed
  to register. **A fallback power, not a deadline; it imposes nothing on the taxpayer or on ONRC.**
- **art. 83** is titled „Prevederi speciale privind înregistrarea fiscală a persoanelor
  nerezidente" → **not** a trade-register rule.

**Textual reading (high confidence on the words):** lit. c) is the only alineat of art. 82 alin. (6)
that could reach a natural person starting an activity, and it **expressly excludes** those who
register at registrul comerțului under a special law. **No other alineat covers a trade-register
registrant.** So *if* a PFA is such a registrant, **no alineat of art. 82 alin. (6) imposes a
30-day declarație de înregistrare fiscală on it.**

**Not established:** that a PFA *is* a registrul-comerțului registrant. **OUG 44/2008 was not
reached.** No CPF provision was found imposing a term on ONRC to transmit, and no term running
from ONRC registration or reception of the file.

Negative findings (doc 304520, 1,601,243 chars): `declarație estimativ*` = **0**; `Declarația 100`
/ `Formular 100` = **0**; `30 de zile` = **87**; `în termen de 30` = **44**; `registrul comerțului`
= **39** document-wide — **per-article attribution of those 39 is not established** (regex escaping
error before context ran out).

**Next step for whoever has context:** read **OUG 44/2008** (art. 5 / art. 4¹) in its current
consolidation and confirm (i) that PFA registration at registrul comerțului is mandatory, and
(ii) whether ONRC transmission triggers din oficiu fiscal registration with its own term. Until
then this is **Q-ONRC-CARVEOUT: open**.

## 8. Open questions created by this pass

| ID | Question | Why it matters | Status |
|---|---|---|---|
| **Q-ONRC-CARVEOUT** | Does a PFA owe a declarație de înregistrare fiscală within 30 days, and under which alineat? | Decides whether `fiscal_registration` exists at all | **open** — needs OUG 44/2008 |
| **Q-CNP-IDENTITY** | Does a PFA „se identifică fiscal prin CNP" for OUG 120/2021 art. 10^10 alin. (1)? | If yes, e-Factura B2B **and** B2C duties are switched off for it. The term is undefined in OUG 120/2021, and CPF art. 82 alin. (1) lit. b)/lit. c) vs alin. (2) point in different directions | **open** |
| **Q-VAT-PERIOD** | Which fiscal period applies to a PFA registering mid-2026 — monthly or quarterly? | Decides whether the decont is due 12 or 4 times a year. art. 322 alin. (3)-(4) turns on a **pro-rated estimate the taxpayer makes**, which the app cannot derive | **open** — needs a user input, not research |
| **Q-10^10-DIFF** | Exact pre- vs post-01-06-2026 content of art. 10^10 | The displayed text carries the 01-06-2026 note; not diffed against the earlier consolidation | **open** |
| **U-3** | Which act last amended CF art. 122 alin. (3)'s 25 May term? | — | **CLOSED — CONFIRMED, raise attribution to HIGH** |

## 9. Pending is not law — do not encode

- **PL 204/2026** (VAT registration, 3 working days) — repo-recorded; **not independently verified
  by this pass**. Bill status unchanged by anything read here.
- **15 April 2026 / 3% bonificație** — repo-recorded as a **2025-only** incentive (OUG 8/2026
  art. 8, `research/09`); not verified by this pass. It looks exactly like a quarterly deadline and
  is not one.
- Nothing in doc 312601 / 304520 / 310662 supports encoding any draft obligation.

## 10. Cross-check against the operator's Gemini pass

Included because the operator supplied it and because it is a good illustration of why this repo
re-derives everything. It corroborates the **shape** and gets the **fine print** wrong.

Corroborates: one 25 May date for DU + income tax + CAS + CASS; the 30-day estimation DU is gone
for sistem real and the first DU is 25 May the following year; decont de taxă = art. 323 alin. (1)
by the 25th, month or quarter "după caz"; payment via art. 326 alin. (1); e-Factura term at art. 10
alin. (7) OUG 120/2021.

Wrong or unverified:

| Gemini claim | Verified | |
|---|---|---|
| 25 May term = art. 122 **alin. (1)** | **alin. (3)** — alin. (1) only enumerates who files; `package2026.ts` already says „NOT alin. (1)" | ❌ |
| CAS payment art. 151 **alin. (22)**; CASS payment art. 174 **alin. (20)**; income tax payment art. **121 alin. (1)** | **art. 151 alin. (1)**, **art. 174 alin. (15)**, **art. 68 alin. (10)** | ❌ |
| e-Factura = **5 zile calendaristice**, amended by Legea 296/2023 | **5 zile lucrătoare from 01-01-2026**, OUG 89/2025 pct. 2 Art. X | ❌ materially wrong for 2026 |
| 30-day DU = **art. 120 alin. (2)** | art. 120 is **Abrogat** from 01-01-2025 — right number, dead article | ❌ |
| 30 days still relevant for **normă de venit** / opting into CAS-CASS | not established; this repo keeps `NORMA_VENIT` parseable-but-refused because the 2026 package has no norm-of-income rule | ❓ |
| art. 13 OUG 120/2021 fines 1.000–2.500 lei | not retrieved from a primary source | ❓ |
