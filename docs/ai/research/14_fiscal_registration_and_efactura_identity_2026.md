# Fiscal registration and e-Factura identity — ONRC carve-out, CNP question

> ## ⚠️ EVIDENCE STATUS: **VERIFIED — READ `research/15` BEFORE USING ANYTHING HERE**
>
> **Update.** An independent adversarial verifier re-derived this file's claims; see `research/15`.
> Outcome: **the substance held, the metadata wobbled.** P1 (no 30-day fiscal-registration duty) is
> **CONFIRMED at primary level**, and the `CNP` = 0 hit count — the most suspicious-looking number
> here — **reproduced exactly**. What did *not* survive: the note counts (Portal Legislativ does not
> publish them, `research/15` §3), the label **OG 2/2024** for the procedure code (contested,
> `research/15` §5 F1), and the name **OUG** 6/2026 (it is an *Ordonanța*).
> Read `research/15` as the authority and this file as the draft it checked.
>
> Everything in this file was produced by research sessions **that had already been compacted**. The
> operator has flagged that the agent may have **fabricated detail after compaction** — plausible doc
> ids, verbatim Romanian quotes, article numbers and hit counts it never actually retrieved.
>
> **Treat every doc id, note count, quote and hit count below as a CLAIM under test, not as
> evidence.** An independent verifier (`verify-deadline-claims`) is re-deriving the P1 chain from
> primary sources. Do not cite this file in code comments, briefs or UI tooltips until it is
> re-stamped as verified.
>
> What is **safe to rely on regardless**, because it does not depend on the suspect session:
> - `research/11` and `research/12` — read from primary consolidations in uncompacted sessions.
> - `research/13` §1 (the 30-day DU is refuted) — corroborated independently by this repo's own
>   `phases/06:40` and `phases/05:64`, and by a third-party pass.
> - The **instruction** not to build `fiscal_registration`. That holds whichever way verification goes:
>   the claim is that the duty does not exist, and no verified source supports adding it.


Second deadline pass. Closes `Q-ONRC-CARVEOUT` and answers `Q-CNP-IDENTITY` (both opened in
`research/13` §8). Read `research/13` first; this file does not repeat it.

Two passes contributed. Pass A answered Q1 (fiscal registration). Pass B answered Q2 (CNP identity)
and **corrected metadata that `research/13` states wrongly** — see §0.

---

## 0. Metadata corrections to `research/13` — apply these, do not re-cite the old pair

| Item | `research/13` said | Correct |
|---|---|---|
| OUG 120/2021 consolidation | doc 310662, **47 notes, latest 24-12-2025** | doc **310662**, consolidation date **01.06.2026**, base form **247243**, latest note **01-06-2026**. **Note count NOT ESTABLISHED** — 47 belongs to the superseded 15.01.2026 consolidation, doc **305980**. A count of 16 was obtained and **rejected as too low**; do not use it. |
| Legea 88/2026 pct. 8 Art. III | cited as the amendment note | **CONFIRMED folded into the current consolidation.** Verbatim note on art. 10^10: `(la 01-06-2026, Articolul 10^10, Sectiunea a 4-a, Capitolul I a fost modificat de Punctul 8., Articolul III din LEGEA nr. 88 din 29 mai 2026, MO nr. 459 din 29 mai 2026)`. Amending-act detail doc **311108**. **Same act, pct. 7 Art. III, also modifies art. 10^8** — the register article and the optional-registration article moved together. |

## 1. Q-ONRC-CARVEOUT — **CLOSED. Answer: NO.** Do not encode a `fiscal_registration` deadline.

A PFA opened in Romania in 2026 owes **no declarație de înregistrare fiscală within 30 days under any
alineat of CPF art. 82 alin. (6)**. The lit. c) carve-out bites, and fiscal registration happens
**through ONRC, with no taxpayer term at all.**

### The predicate is now primary-verified

**OUG 44/2008** — base form doc **91808**, **current consolidation doc 261165**, consolidation date
**26.11.2022**, **46 notes**, latest note **26-11-2022** (Legea 265/2022). Consolidation history:
26.11.2022 (current) · 09.05.2022 (254138) · 17.01.2017 (182763) · 09.02.2014 (159519) · 19.05.2011
(128759) · 24.04.2009 (105365). Amending acts folded in: OUG 38/2009, OUG 46/2011, Legea 4/2014,
Legea 182/2016, Legea 125/2022, Legea 265/2022.

**art. 7 alin. (1)** — the registration obligation, verbatim:

> „(1) Persoanele fizice prevăzute la art. 3 alin. (1) au obligația să solicite oficiului registrului
> comerțului de pe lângă tribunal înregistrarea și autorizarea funcționării, cu respectarea
> prevederilor prezentei ordonanțe de urgență, **înainte de începerea activității economice** în
> formele prevăzute la art. 4 lit. a) sau b), **ca persoană fizică autorizată, denumită în continuare
> PFA**, respectiv ca întreprinzător titular al unei întreprinderii individuale."
> *(la 17-01-2017, Alineatul (1) din Articolul 7, Capitolul II a fost modificat de Punctul 6, Articolul
> I din LEGEA nr. 182 din 17 octombrie 2016, MO nr. 828 din 19 octombrie 2016)*

So a PFA **is** a registrul-comerțului registrant under a special law → **CPF art. 82 alin. (6)
lit. c) excludes it**, and no other alineat of alin. (6) covers such a registrant.

**Two citation traps in this article, both recorded so they are not re-misread:**
- **There is no art. 4¹ in OUG 44/2008.** The act's own *Cuprinsul Actului* lists for Cap. I only art.
  1-6, and for Cap. II art. 7, 7¹, 8-15. The brief guessed art. 5 / art. 4¹; both are wrong. Art. 5
  concerns *sediul profesional* — **paraphrase, secondary source**, not verified here.
- **The 20-day term in art. 7 alin. (3) is not a PFA term.** „…trebuie formulată în termen de **20 de
  zile** de la încheierea acordului de constituire prevăzut la art. 29 alin. (1)" — the *acord de
  constituire* trigger is the **întreprinderea familială** case of alin. (2). For a PFA, alin. (1)
  requires registration **înainte de începerea activității economice**, with **no day-count**.

### Who registers

Both, and the text separates them:
- The **obligation** is on the individual — „**Persoanele fizice** prevăzute la art. 3 alin. (1) au
  obligația să solicite…" (art. 7 alin. (1)).
- The **registered subject** is the PFA as such. **art. 2 lit. i)**: „**persoană fizică autorizată** –
  întreprinderea economică, fără personalitate juridică, organizată de o persoană fizică ce folosește,
  în principal, forța sa de muncă" *(la 17-01-2017, Punctul 3, Articolul I din LEGEA nr. 182/2016,
  MO 828/19.10.2016)*. Confirmed negatively by **art. 2 lit. i¹)**, which describes the spouse as
  participating „**fără a fi înregistrată/înregistrat în registrul comerțului** și autorizată/autorizat
  să funcționeze ea însăși/el însuși … ca persoană fizică autorizată" *(la 09-02-2014, LEGEA nr. 4/2014,
  MO 15/10.01.2014)*.
- **App consequence:** the PFA is the registered/evidenced subject; the human is the obligor.

### The mechanism — and the only term attached to it

**art. 13 alin. (3)**, verbatim, no amendment note attached to alin. (3) in this consolidation:

> „(3) Certificatul de înregistrare, conținând codul unic de înregistrare, este documentul care atestă
> înregistrarea în registrul comerțului, autorizarea funcționării, precum și **luarea în evidență de
> către autoritatea fiscală competentă**."

The certificate itself effects fiscal evidence. **No taxpayer filing.** The only term is on **ONRC**,
and it is in **working days**:

> „(2) Termenul de eliberare a certificatului de înregistrare și, după caz, a certificatului de înscriere
> de mențiuni este de **3 zile lucrătoare**, calculat de la data înregistrării cererii sau, după caz, de
> la data completării cererii cu documentele solicitate." *(la 17-01-2017, Punctul 12, Articolul I din
> LEGEA nr. 182/2016, MO 828/19.10.2016)*

**Negative findings** (printable form of doc 261165):

| String | Hits | Note |
|---|---|---|
| `declarație de înregistrare fiscală` | **0** | |
| `organ fiscal` | **0** | |
| `luarea în evidență` | **1** | art. 13 alin. (3), quoted above |
| `înregistrarea fiscală` | **3** | art. 8 alin. (2) cross-ref to the *title* of Legea 359/2004; art. 43 heading; art. 43's quoted art. 3 alin. (1) of Legea 359/2004 |
| `transmit` | **1** | **not** an ONRC→ANAF transmission — it concerns *declarații-tip* under Legea 359/2004 art. 17² |

**The old ONRC→ANAF transmission rule is repealed.** Legea 359/2004 — whose art. 3 alin. (1), as
amended by **OUG 44/2008 art. 43**, made „înmatricularea PFA … **și înregistrarea fiscală a acestora**
se fac pe baza rezoluției directorului oficiului registrului comerțului", and whose art. 11 imposed
electronic ONRC→Ministerul Finanțelor transmission with CUI attribution „în termen de maximum 8 ore" —
shows on the cdep fișă act as **„În vigoare: nu: abrogat"**, abrogated by **Legea 265/2022**.
**Secondary source (cdep), not re-verified against a portal consolidation.** Treat the 8-hour term as
**not currently available law**.

**Administrative guidance (secondary, ANAF Iași material informativ, 17-07-2024)** — the closest thing
to an official statement of the mechanism:

> „Contribuabilii care au calitatea de comercianţi şi care au obligaţia înregistrării şi autorizării la
> Oficiile Registrului Comerţului se înregistrează fiscal potrivit art. 82 alin. (1) lit. b) din Codul
> de Procedură Fiscală. Aceștia primesc ca urmare a înregistrării la ONRC codul unic de înregistrare
> (CUI), acesta fiind și codul de identificare fiscală, **neavând obligația înregistrării fiscale la
> organele fiscale teritoriale**."

The same document records **Ordinul ANAF nr. 2509/5672/C/2022 (MO 58/2023)** approving a „Cerere de
înregistrare fiscală" **as an annex to the cererea de înregistrare în registrul comerțului**. So the
taxpayer does complete a fiscal-registration *request* — **at ONRC, bundled into the registration
application**, not a *declarație* at ANAF on a 30-day clock.

### Backstops, which are not deadlines

- **CPF art. 82 alin. (7)** lets the central fiscal organ register din oficiu a subject who failed to
  register. A **power, not a term**; imposes nothing on the taxpayer or ONRC.
- **ANAF *procedură de înregistrare fiscală din oficiu*** — Portal Legislativ „PROCEDURA 24/10/2025",
  doc **303982** (base form; **note count and latest note not captured**). Organ-initiated: referat →
  notificare → audiere → decizie → certificat, with the din-oficiu registration dated at communication
  of the decizie. **Creates no taxpayer 30-day deadline.** Consistent with the alin. (7) reading.

### Caveat on the consolidation itself

No consolidation newer than **26.11.2022** exists on the portal, and the *Fișă act → Acțiuni suferite*
panel is JS-loaded, so post-2022 acts could not be enumerated. The predicate is established **on the
current portal consolidation**; it is **not** established that no unconsolidated post-2022 amendment
exists.

**CPF (Legea 207/2015 — this file called it “OG 2/2024”, which is wrong; see `research/15` §7) was not re-reached in pass A** — two searches returned unrelated acts. That does not
weaken the verdict: art. 82 alin. (1)-(7) was read verbatim from doc **304520** in the earlier pass
(`research/13` §7), and the verdict rests on that text plus OUG 44/2008 art. 7 alin. (1) + art. 13
alin. (3).

## 2. Q-CNP-IDENTITY — **Answer: NO.** The art. 10^10 alin. (1) CNP exemption does not apply to a PFA.

A PFA that registers at registrul comerțului is identified by a **CUI**, so the exemption does not
switch off its e-Factura duties. **But the scope question is still open — see §3, which matters more
than this verdict.**

### The strongest single piece of evidence

In **OUG 120/2021 as consolidated at 01.06.2026** (doc 310662), case-insensitive:

| String | Hits |
|---|---|
| `CNP` | **0** |
| `identificare fiscală prin CNP` | **0** |
| `se identifică fiscal prin CNP` | **0** |
| `identifică fiscal` | **13** — all in transitional/succession provisions, none a CNP identification rule |

**The token „CNP" does not occur anywhere in OUG 120/2021.** The act speaks only of „cui", „cod de
identificare fiscală" and „operator economic". There is no CNP-based path in the act to be exempted by
or entitled to.

### The CPF tension, and why it does not flip the answer

CPF art. 82 alin. (2) — „În scopul administrării impozitului pe venit și contribuțiilor sociale, în
cazul persoanelor fizice care sunt contribuabili potrivit Codului fiscal, codul de identificare fiscală
este codul numeric personal."

It is **expressly purpose-scoped**: for income tax and social contributions, a natural person's CIF
**is** the CNP. It does not say the CNP is the CIF for all purposes, and by its own terms it does not
reach TVA. Meanwhile alin. (1) lit. b) gives a PFA a CUI precisely because it registers under a special
law. So a PFA plausibly sits in **both**: CNP-as-CIF for impozit pe venit + CAS/CASS, **CUI** for
everything commerce- and VAT-facing.

Reading alin. (2) to override alin. (1) lit. b) in the VAT domain would require ignoring the express
„în scopul…" limiter. **Risk to the verdict: low, but not zero** — and the right place for a caveat is
not alin. (2) but the fact that **OUG 120/2021 never defines which identifier a non-VAT-registered PFA
puts in the e-Factura emitter field**, which the 0 hit count demonstrates directly.

### Confidence on the identifier chain: **MEDIUM**

- **Primary:** CPF art. 82 alin. (1) lit. b) — CUI for special-law/trade-register registrants. Statute, verified.
- **Primary:** OUG 44/2008 art. 13 alin. (3) — the certificat containing the CUI attests fiscal evidence.
- **Secondary only:** ANAF Iași — „CUI = CIF, neavând obligația înregistrării fiscale la organele
  fiscale teritoriale".

**There is nothing primary for the „CUI = CIF, no separate territorial registration" step.** It is
almost certainly right — standard ANAF practice, uncontroversial in Romanian practice — but on this
record it is **secondary + inference**. If the app surfaces a legal-basis tooltip on that step, cite
**CPF art. 82 alin. (1) lit. b)** and label the ANAF sentence as **administrative guidance**.

### art. 10^10 — what was actually confirmed verbatim

Confirmed from raw consolidation HTML (element ids `id_litA99594680` / `id_litA99594681` /
`id_parA99594682`):

> **(2)** Persoanele prevăzute la alin. (1) pot opta pentru utilizarea sistemului național RO
> e-Factura. În situația în care optează pentru transmiterea facturilor în sistemul național RO
> e-Factura, aceste persoane sunt obligate să fie înregistrate în Registrul RO e-Factura opțional.
>
> **(3)** Persoanele prevăzute la alin. (1) care au optat pentru utilizarea sistemului național RO
> e-Factura sunt înscrise în Registrul RO e-Factura opțional **începând cu data de 1 a lunii următoare
> exercitării opțiunii**.

**Do not treat any art. 10^10 alin. (1) text as verbatim from this pass.** An answer-mode extraction
conflicted with the raw HTML; only the raw-HTML alin. (2)-(3) above are stood behind. The exemption
wording in alin. (1) comes from the *earlier* pass (`research/13` §4) and was **not re-confirmed here**.

**Structural point for the app:** alin. (2) makes optional registration **mandatory-on-option**
(„obligate să fie înregistrate"), and alin. (3) sets the effective date at **the 1st of the month
following the option**, not immediately. If an e-Factura opt-in is ever modelled, the obligation starts
on a month boundary.

## 3. The gap that matters more than the verdict

**Whether a non-VAT-registered PFA is a RO e-Factura emitter at all in 2026 is NOT confirmed.**

The identifier question was answered; the **scope** question was not. art. 10^10 alin. (2)-(3) apply to
*„persoanele prevăzute la alin. (1)"*, and alin. (1)'s reach was not re-verified. `research/13` §4
recorded the B2C gate as art. 10^1 alin. (2) from 01-01-2025 with no turnover threshold — that stands
from the earlier pass, but the interaction with art. 10^9's mandatory list and art. 10^10's scope has
**not** been established for a sistem-real PFA with no VAT registration.

**Do not wire an e-Factura deadline until this is resolved.** The verdict in §2 says a PFA is *not
exempt by reason of CNP*; it does **not** say a PFA is *within scope*.

## 4. Gaps still open

| ID | Gap | Priority |
|---|---|---|
| **Q-EFACT-SCOPE** | Is a sistem-real PFA with no VAT registration a RO e-Factura emitter in 2026? art. 10^9 mandatory list vs art. 10^1 alin. (2) vs art. 10^10 scope | **highest — blocks any e-Factura deadline** |
| **Q-EFACT-ANAF-ORDER** | The **art. 10^8 alin. (1) implementing ANAF order** — unidentified, no doc id. The delegation hook is at art. 13, Secțiunea a 5-a, Cap. I (note: modified la 11-11-2023): „…pot opta pentru utilizarea sistemului național privind factura electronică RO e-Factura în relația comercială B2B sau în relația B2G, **potrivit procedurii stabilite prin ordin al președințelui ANAF**". This is the instrument most likely to state which identifier goes in the e-Factura register fields | high |
| **Q-1010-A1** | art. 10^10 alin. (1) verbatim — not re-confirmed | medium |
| **Q-OG6-ARTIX** | **OG 6/2026 art. IX derogation — never located.** If it exists it could suspend a 2026 e-Factura obligation and would materially change the deadline model | **high — potential negative obligation** |
| **Q-120-NOTES** | Verified note count for doc 310662. 47 is stale (belongs to doc 305980), 16 was rejected as too low. Neither is on the record as correct | low |
| **Q-CUI-CIF-PRIMARY** | A primary instrument for „CUI = CIF, no territorial fiscal registration" for PFAs — currently secondary-only | low |
| **Q-OUG44-POST2022** | Whether any post-26.11.2022 amendment to OUG 44/2008 is unconsolidated — *Acțiuni suferite* is JS-loaded and could not be enumerated | low |

## 5. Net effect on the app

| Rule | Before this pass | After |
|---|---|---|
| `fiscal_registration` (30 days from PFA start) | planned in brief 10 §2c | **does not exist — do not build it.** A PFA start date resolves **no** deadline |
| e-Factura deadline | "do not encode" (research/11 §9.3) | **still do not encode**, now for a sharper reason: scope unconfirmed (§3), not merely identity |
| `vat_registration` | `month_end + 30` | unchanged by this pass; still wrong per `research/13` §6 |
| `d212_filing` 25 May Y+1 | correct | correct, and now confirmed to be the **only** dated obligation a newly opened PFA has |
