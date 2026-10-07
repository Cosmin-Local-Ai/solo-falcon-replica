# Independent verification of the `research/14` claims

Adversarial re-derivation of everything in `research/14`, which had been flagged as **untrusted**
because it came from already-compacted sessions. The verifier was given each doc id, quote and hit
count as a *claim under test* and asked for CONFIRMED / REFUTED / NOT CHECKED.

**Headline: the substance held. The metadata is where it wobbled.** The P1 chain — the one that
decides whether a `fiscal_registration` deadline gets built — was confirmed verbatim against primary
text. One citation conflict is still open and is being resolved (`F1`, §5).

---

## 1. P1 VERDICT — **CONFIRMED: NO.** A PFA opened in 2026 owes no 30-day fiscal-registration declaration.

The chain, now verified at primary level:

1. **OUG 44/2008 art. 7 alin. (1)** makes registrul-comerțului registration mandatory for a PFA
   **before** economic activity begins.
2. **CPF art. 82 alin. (6) lit. c)** attaches the 30-day `declarație de înregistrare fiscală` to
   „persoanele fizice care desfășoară activități economice în mod independent sau exercită profesii
   libere, **cu excepția celor care se înregistrează, potrivit legii speciale, la registrul
   comerțului**".
3. A PFA is inside that carve-out. Its CIF is the **CUI** assigned under the special law
   (CPF art. 82 alin. (1) lit. b)).
4. Fiscal taking-into-evidence happens **by operation of law through ONRC** — OUG 44/2008
   art. 13 alin. (3). **No taxpayer filing, no day-count.**

**`fiscal_registration` stays unbuilt.** This was previously a hunch backed by a suspect source; it is
now a hunch backed by primary text.

## 2. Per-claim results

| # | Claim under test | Result |
|---|---|---|
| 1 | OUG 44/2008 base form **91808**, current consolidation **261165**, consolidation date **26.11.2022**, latest note **26-11-2022** | **CONFIRMED (partially).** 91808 resolves to the OUG base form (no `(A)` actualizat marker). 261165 is the consolidated form; `istoric consolidări` shows 26.11.2022 as current, superseded at 09.05.2022 (254138) and 17.01.2017 (182763). Latest note = Legea 265/2022, MO 750/26.07.2022. **The „46 amendment notes" figure is NOT CHECKED — see §3.** |
| 2 | art. 7 alin. (1) is the registration obligation | **CONFIRMED verbatim**, including the amendment note (Legea 182/2016 pct. 6 Art. I, MO 828/19.10.2016) |
| 3 | No art. 4¹; art. 5 is not the obligation | **art. 5 CONFIRMED** — it is *sediul profesional* („PFA, întreprinderile individuale și întreprinderile familiale trebuie să aibă un sediu profesional pe teritoriul României…"). Art. 4 lit. a) is the PFA form. `Art. 4<sup` in doc 261165 → **0 hits**, but the full *Cuprinsul Actului* was not read, so **not upgraded to CONFIRMED** |
| 4 | art. 13 alin. (3) — certificat attests fiscal taking-into-evidence | **CONFIRMED verbatim**, no amendment note on that alineat |
| 5 | art. 13 alin. (2) — 3-day ONRC term | **CONFIRMED, and it is *zile lucrătoare***, not calendaristice |
| 6 | The 20-day term in art. 7 alin. (3) belongs to the IF case, not the PFA | **CONFIRMED.** Trigger is the *acord de constituire* (art. 29 alin. (1)), which exists only for the întreprinderea familială. Related: art. 7 alin. (2) sets **15 zile** for the IF representative |
| 7 | Legea 359/2004 repealed by Legea 265/2022 | **CONFIRMED.** CDEP lists it under *Abrogă* for Legea 265/2022 (MO 750/26.07.2022). Current consolidation of 265/2022 at doc **257835**, superseded **288036** (12.09.2024) and **268266** (23.07.2023). **Missing: 257835's own consolidation date** |

### Verified text worth keeping verbatim

**OUG 44/2008 art. 7 alin. (1)** — doc 261165:

> „Persoanele fizice prevăzute la art. 3 alin. (1) au obligația să solicite oficiului registrului
> comerțului de pe lângă tribunal înregistrarea și autorizarea funcționării, cu respectarea
> prevederilor prezentei ordonanțe de urgență, **înainte de începerea activității economice** în
> formele prevăzute la art. 4 lit. a) sau b), ca persoană fizică autorizată, denumită în continuare
> PFA, respectiv ca întreprinzător titular al unei întreprinderii individuale."

**CPF art. 82 alin. (6) chapeau + lit. c)** — doc 309359:

> „(6) Declarația de înregistrare fiscală se depune în termen de 30 de zile de la: … c) data începerii
> activității pentru persoanele fizice care desfășoară activități economice în mod independent sau
> exercită profesii libere, **cu excepția celor care se înregistrează, potrivit legii speciale, la
> registrul comerțului**;"

**OUG 44/2008 art. 13 alin. (2)-(3)** — doc 261165:

> „(2) Termenul de eliberare a certificatului de înregistrare și, după caz, a certificatului de înscriere
> de mențiuni este de **3 zile lucrătoare**, calculat de la data înregistrării cererii sau, după caz, de
> la data completării cererii cu documentele solicitate."
> „(3) Certificatul de înregistrare, conținând codul unic de înregistrare, este documentul care atestă
> înregistrarea în registrul comerțului, autorizarea funcționării, precum și **luarea în evidență de
> către autoritatea fiscală competentă**."

### Trap the verifier found and the earlier pass missed

The 26.11.2022 consolidation of OUG 44/2008 **still contains live cross-references to the repealed
Legea 359/2004** — art. 8 alin. (2), art. 11 alin. (2), art. 13 alin. (4). **These are stale pointers,
not evidence that 359/2004 is in force.** Anyone re-deriving the ONRC→ANAF mechanism from OUG 44/2008
alone will be misled by them.

## 3. Methodological correction — the „note count" convention is not reproducible

`research/13` asserted: *„Every consolidation cited: doc id + note count + latest note date."*

The verifier reports **Portal Legislativ does not publish a note count**, and it could not derive one
for doc 261165. So the note counts in `research/13` and `research/14` were presumably obtained by
*enumerating amendment notes on the page*, not by reading a published figure — a count that depends on
how notes are delimited in the DOM, and which the verifier declined to reproduce rather than guess.

**Consequence:** treat note counts across this project as **approximate derived values**, not
authoritative metadata. Doc ids and consolidation dates are the reliable pair. Do not present a note
count as a verification anchor in UI or briefs.

## 4. P2 — the four gaps

### Q-EFACT-SCOPE — **ANSWERED: YES.** A sistem-real PFA with no VAT registration **is** a RO e-Factura emitter in 2026.

This is the pass's most consequential answer, and it **reverses the working assumption** in
`research/11` §9.3 and `research/14` §3, which held e-Factura out of scope pending the identity
question.

**art. 10^1 alin. (2)** — CONFIRMED verbatim by direct string search (`Începând cu data de 1 ianuarie
2025` × 1), doc 310662:

> „**Începând cu data de 1 ianuarie 2025**, operatorii economici – persoane impozabile stabilite în
> România conform art. 266 alin. (2) din Legea nr. 227/2015, … **indiferent dacă sunt sau nu înregistrați
> în scopuri de TVA** conform art. 316 … efectuate în relația B2C, astfel cum este definită la art. 2
> alin. (1) lit. n^1), au obligația să transmită facturile emise în sistemul național privind factura
> electronică RO e-Factura."

Amendment note: `(la 05-12-2024, Alineatul (2), Articolul 10^1 … Punctul 3., Articolul I din ORDONANȚA
DE URGENȚĂ nr. 138 din 4 decembrie 2024, MO nr. 1222 din 5 decembrie 2024)`.

- **VAT gate: none.** The text says *indiferent dacă sunt sau nu înregistrați în scopuri de TVA*.
- **Turnover gate: none.** `100.000 lei` → **0 hits**; `395.000` → **0 hits** in doc 310662.
- **art. 10^9 is not an exemption** — it is the beneficiary-notification provision („beneficiarii care
  nu primesc facturile prin sistem în termenul prevăzut la art. 10 alin. (7) … pot notifica organele
  fiscale competente"), introdus by OUG 69/2024, MO 582/21.06.2024. The earlier framing of it as
  possibly exemption-shaped was wrong.
- **art. 10^10 is the only off-ramp**, and it keys on CNP identification, which a PFA does not have.

**Caveat the verifier stated honestly:** the CIF-vs-CNP step is its **reading of the primary text**;
it found **no ANAF interpretative document** stating it in terms. Confidence on scope is high (the
statute is explicit); confidence on *why a PFA is not CNP-identified* is inference + the secondary
OPANAF category list.

**App consequence — and a scope decision, not a deadline.** e-Factura B2C is a **standing obligation**,
not a dated one. It does not belong in the calendar-deadline table. It belongs in a compliance-obligation
surface. Nothing in the current deadline model should change; the app's *obligation* model should
acknowledge it.

### Q-1010-A1 — **CONFIRMED, with a wording correction**

> „Furnizorii/Prestatorii care **se identifică fiscal prin codul numeric personal** nu au obligația să
> respecte prevederile art. 5, 9^1, art. 10 alin. (1) și art. 10^1 alin. (2)."

**Correction:** the act spells out „codul numeric personal" in full — **the abbreviation `CNP` is never
used.** Amendment note: `(la 01-06-2026, Articolul 10^10, Sectiunea a 4-a, Capitolul I a fost modificat
de Punctul 8., Articolul III din LEGEA nr. 88 din 29 mai 2026, MO nr. 459 din 29 mai 2026)`.

That note also **confirms the metadata correction** `research/14` §0 claimed: doc 310662 does carry the
Legea 88/2026 amendment at 01-06-2026. So `research/13`'s „47 notes / latest 24-12-2025" is stale.

### Q-CNP-0 — **CONFIRMED. Independent count: 0.**

`CNP` (case-insensitive) in doc 310662 → **0 hits.** The concept is present, the token is not. The
earlier pass's most suspicious-looking number reproduced exactly.

### Q-OG6-ARTIX — **FOUND. The act and article exist.**

Portal Legislativ note anchored at `DetaliiDocumentAfis/306803#A285`, attached at **four** places in
doc 310662 (art. 5, art. 9^1, art. 10 alin. (1), art. 10^1 alin. (2), art. 10^10):

> „(1) Prin derogare de la prevederile art. 5, art. 9^1, art. 10 alin. (1), art. 10^1 alin. (2) și
> art. 10^10 din Ordonanța de urgență a Guvernului nr. 120/2021 … **furnizorii/prestatorii care se
> identifică fiscal prin codul numeric personal nu au obligația utilizării sistemului național privind
> factura electronică RO eFactura până la data de 1 iunie 2026.**"

**It is an `ORDONANȚA nr. 6 din 30 ianuarie 2026`, MO 77/30.01.2026 — an *Ordonanța*, not an *OUG*.**
The earlier brief called it OUG 6/2026; that is wrong.

**⚠️ Direction is UNRESOLVED and I am not recording a reading.** The verifier concluded the derogation
*suspends the art. 10^10 exemption* and pulls CNP-identified suppliers **into** e-Factura until
01-06-2026. That **contradicts the text it quoted**, which says such suppliers **have no obligation**
until 1 June 2026 — a relief running *to* that date. I have asked it to re-read and state which is
right (§5, F2). **No interpretation is recorded here until it does.**

**Practical impact on this app: none either way.** A PFA registered at registrul comerțului is
CUI-identified, so both art. 10^10 and art. IX miss it. This is a correctness-of-record item, not a
rule.

### Q-EFACT-ANAF-ORDER — **NOT ESTABLISHED.**

No doc id retrieved for an order implementing **art. 10^8 alin. (1)**. What was found:
- **OPANAF 1713/2021** (27.10.2021) implements **art. 10 alin. (5)** — the original Registrul RO
  e-Factura procedure plus formular 084.
- **OPANAF 3.788/2024 as modified by OPANAF 1021/2026** lists „furnizorii/prestatorii care se
  identifică fiscal prin cod numeric personal" as an **optional**-register category. Whether 1021/2026
  is the art. 10^8 alin. (1) instrument is **being checked** (§5, F3).

## 5. Still open after this pass

| ID | Status |
|---|---|
| ~~F1 — which CPF governs 2026~~ | **RESOLVED — see §7.** The verifier cites **Legea 207/2015**, doc **309359**, consolidation 08.05.2026, base form 170007, newer consolidation **312603** at 08.08.2026. `research/13` cites **OG 2/2024**, doc **304520**, consolidation 20-03-2026. Both quote the same art. 82 alin. (6) carve-out. **One of these citations is wrong, and I already propagated `OG 2/2024` into brief 10 and STATE.md.** Being resolved now. |
| ~~F2 — OG 6/2026 art. IX direction~~ | **RESOLVED — see §8.** It is a relief; my reading was wrong. |
| ~~F3 — OPANAF 1021/2026 as the art. 10^8 alin. (1) order~~ | **RESOLVED — see §9.** It is the instrument. |
| **Q-120-NOTES** | Effectively **moot** — note counts are not reproducible (§3). Stop chasing it. |
| **Q-CUI-CIF-PRIMARY** | Still open. The CIF-vs-CNP step remains **inference + secondary OPANAF**, with no interpretative instrument found. |
| **art. 10 alin. (1) B2B text** | Retrieved by content extraction, **not** string-verified. Label single-source. |
| **Legea 265/2022 doc 257835** | Consolidation date of that doc itself not read. |

## 6. Net effect on the app

| Rule | Before | After |
|---|---|---|
| `fiscal_registration` | do not build (hunch + suspect source) | **do not build — confirmed at primary level.** PFA start date resolves **no** deadline |
| e-Factura | out of scope pending identity question | **in scope**: B2C e-Factura applies to a non-VAT-registered sistem-real PFA from 01-01-2025, no VAT or turnover gate. But it is a **standing obligation, not a dated deadline** — it does not enter the deadline table |
| `d212_filing` 25 May Y+1 | correct | correct, and still the **only** dated obligation a newly opened PFA has |
| CPF citation | `OG 2/2024` in brief 10 + STATE | **contested — see F1.** Do not cite either in code or UI until resolved |

---

## Addendum — F1, F2, F3 all RESOLVED (second verifier pass)

## 7. F1 — Which CPF governs 2026: **Legea 207/2015. There is no "OG 2/2024".**

**Cite:** Legea nr. 207/2015 privind Codul de procedură fiscală (MO 547/23.07.2015), art. 82 alin. (6) lit. c), forma consolidată din 08.08.2026, Portal Legislativ doc **312603** (base form **170007**)

| Claim | Result |
|---|---|
| An act "OG 2/2024" that is a Cod de procedură fiscală exists | **REFUTED.** Nothing resembling it. The only live “OG 2” in Romanian law is **OG 2/2001** (contraventions regime, approved by Legea 180/2002) — cited constantly in 2024–2026 acts, unrelated to fiscal procedure. That is the likely source of the confusion. |
| Doc **304520** is a CPF | **CONFIRMED.** Resolves to “COD PR FISCALA (A) 20/07/2015”, `id_act = 304520` — a consolidated form of Legea 207/2015, not a separate act. |
| …consolidation date **20-03-2026** | **REFUTED. It is 18.12.2025.** There is **no 20.03.2026 CPF consolidation anywhere in its history.** Superseded by 10.12.2025 → 24.12.2025 → 01.01.2026 → 09.01.2026 → 14.01.2026 → 02.02.2026 → 25.02.2026 → 08.05.2026 → **08.08.2026**. |
| …11 notes, latest 20-03-2026 | **REFUTED as to date** — an 18.12.2025 consolidation cannot carry a 2026 note. Count not checkable (§3). |
| Doc **312603** is the live CPF form | **CONFIRMED.** `id_act = 312603`, `fa_selectata` = **08.08.2026**, base form via `incarcaFormaDeBaza(170007)`. Latest note **08-08-2026** from **Legea 170/2026, MO 648/05.08.2026** (pct. 1.–14. Art. IV, touching art. 157 alin. (2), 165, 166, 167, 186 alin. (1), 194, 209¹⁸, 209¹⁴, 266). |
| art. 82 alin. (6) lit. c) identical in both | **YES — verbatim identical, same numbering, and no amendment note on lit. c)**: unamended original text. Element ids `id_litA35692810_bdy` (lit. c)), `id_litA70019171_bdy` (chapeau). |

**No new CPF is enacted and none is pending with a future effective date.** In 2026 Legea 207/2015 was amended
by **OG 1/2026** (MO 75/30.01.2026 — art. 286 lit. i), 291, new art. 291¹⁷–291¹⁹, 303, 305¹, 336, transposing
Directive (EU) 2025/872), **OG 6/2026** (MO 77/30.01.2026, doc **306803** — introduced art. 85¹, secondary-place
fiscal registration), **OUG 13/2026** (suspending art. 7 alin. (10) until 31.12.2026) and **Legea 170/2026**
(MO 648/05.08.2026, the 08.08.2026 consolidation trigger).

**The lesson, recorded because it is the third time in this project:** a *label* was invented by a compacted
pass while its *doc id* was correct, and the correct answer was **already sitting in `research/11`**. Cross-check
a new citation against what the repo already holds before propagating it. I did not, and it went into brief 10
and STATE.md.

## 8. F2 — OG 6/2026 art. IX: **the verifier conceded; it is a relief, and it expires**

My earlier “it pulls CNP-identified suppliers into e-Factura” reading is **indefensible** against the text.
**alin. (2) settles it beyond argument:**

> „(2) Furnizorii/Prestatorii prevăzuți la alin. (1) care au fost înregistrați în Registrul RO e-Factura obligatoriu
> **pot solicita scoaterea din acesta**, potrivit…"

A provision allowing removal from the mandatory register is a relief. **It is a suspension of the duty running
until 01.06.2026.** It is rendered as a *Notă* pinned to art. 5, 9¹, 10 alin. (1), 10¹ alin. (2), 10¹⁰ — **it does not
amend their text**, so it expires on its own terms.

**Why it existed:** art. 10¹⁰ in its current form only took effect **01-06-2026** (Legea 88/2026 pct. 8 Art. III).
The derogation covered the gap *before* that date. Net position for a CNP-identified supplier: **not obliged
either way** — relieved by art. IX to 01.06.2026, by art. 10¹⁰ from 01.06.2026.

**Impact on this app: zero, confirmed.** A registrul-comerțului PFA is CUI-identified; neither provision touches it.

## 9. F3 — `Q-EFACT-ANAF-ORDER` **CLOSED.** The art. 10¸ alin. (1) instrument is **OPANAF 1.021/2026**

| Instrument | Detail |
|---|---|
| **OPANAF 3.788/2024** (23.07.2024) | Procedura privind organizarea și înscrierea în **Registrul RO e-Factura opțional** + formular **081**. MO 736/29.07.2024. **Portal Legislativ doc 286255.** Temei: art. 10¸ OUG 120/2021 (paragraph unspecified) + art. 10 alin. (2)–(3), 10⁵ alin. (3)–(4), 10⁶ alin. (2)–(3), 10⁷ alin. (2)–(3), art. 13, HG 520/2013 art. 11 alin. (3) |
| **OPANAF 1.021/2026** (20.08.2026) | Modifies and completes 3.788/2024. **MO 743/03.09.2026, in force 03.09.2026.** Temei is explicit: HG 520/2013 art. 11 alin. (3), **art. 10¸ alin. (1) din OUG 120/2021**, and **art. IV alin. (2) din Legea 88/2026**. **No Portal Legislativ doc id retrieved** — MO 743/03.09.2026 is the reliable pointer |

**Cite both**: 1.021/2026 is an *amending* order; the operative procedure is 3.788/2024 as amended.

**Two corrections the verifier made against itself:**
- The wording „furnizorii/prestatorii care se identifică fiscal prin cod numeric personal” is **not in the order**.
  What 1.021/2026 actually says is that Secțiunea III of formular 081 is completed by “entitățile prevăzute la
  **art. 10⁵ alin. (1) și (2), art. 10⁷ alin. (1) și art. 10¹⁰ alin. (2)** din OUG 120/2021” — the CNP category enters by
  **cross-reference**, not by quoted wording. Substance holds; the quotation did not.
- **Better primary support for the CIF-vs-CNP distinction**, from the 081 instructions themselves: „Caseta „Cod de
  identificare fiscală” se completează cu codul de identificare fiscală atribuit entității, conform legii, **sau cu
  codul numeric personal, după caz**". The form itself distinguishes the two — this is the closest thing to an
  official statement of the distinction, and it partially closes **Q-CUI-CIF-PRIMARY**.
- Also: OPANAF 1021/2026 art. II **radiates asociațiile/fundațiile/partidele/cultele** not in TVA from the
  *opțional* register into the *obligatoriu* register (OPANAF 3.789/2024, formular 082). Not our case, but it is
  the kind of scope change that would matter if the app ever served a nonprofit.

## 10. What is genuinely still unverified

- **Note counts** — permanently unverifiable from Portal Legislativ; would require parsing `S_PAR`/`S_NTA` spans. Not worth doing.
- **Portal Legislativ doc id for OPANAF 1.021/2026** — likely not yet consolidated.
- **Whether a new CPF draft exists in the parliamentary pipeline** — no evidence found, but camera.deputat.ro was not queried directly. **Treat “not enacted” as *no evidence found*, not proven absence.**
- **art. 10 alin. (1) B2B text** — still extraction-only, single-source, not string-verified.
- **The 5-calendar-day transmission term** (art. 10 alin. (7)) — **never verified in this project**, and it is now a product requirement. See §11.

## 11. New product surface this creates — and the one deadline it implies

The operator has stated the intended behaviour: e-Factura should **not** be a permanent presence in the UI (it is
noise), invoices must be loaded into e-Factura **within 5 days of emission**, and the platform should
**transmit to ANAF automatically**.

That last point changes what the app is: automatic transmission is an **integration**, not a display of a rule.
It also implies the **only** e-Factura date worth modelling is the **emission + 5 days** term — which is a
*rolling* per-invoice deadline, not a calendar one, so it does not fit the current `due_date` + lead-window model.

**The 5-day term is asserted by the operator, not verified by this project.** It is presumably OUG 120/2021
art. 10 alin. (7). **Do not encode it until it is read from primary text**, including whether it is *zile
calendaristice* or *zile lucrătoare* — this project has already been burned twice on exactly that distinction.
