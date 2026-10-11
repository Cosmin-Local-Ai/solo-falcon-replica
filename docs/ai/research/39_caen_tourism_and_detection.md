# CAEN, tourism registration, and whether the app can *detect* an accommodation user

**Verified 2026-10-11.** Research performed by the Researcher agent (web-only, no repository access); this note is written by the orchestrator from its report.

**Why this was asked:** D-COM-1 said a **tourism CAEN code** in Settings should prompt the art. 68^3 platform-commission question. This pass tested whether that trigger can work.

---

## 1. Headline — a CAEN trigger cannot reach the likeliest affected user

**FACT.** A natural person letting **1–7 rooms** short-term is taxed under a **different income category**: art. 83 alin. (2) — „proprietar, uzufructuar sau alt deținător legal din închirierea pe termen scurt a unui număr cuprins între **1 și 7 camere inclusiv**, situate în locuințe proprietate personală, indiferent de numărul de locuințe". That is *cedarea folosinței bunurilor*, not business income. **art. 83 alin. (4)** flips it into independent activity under art. 68^3 only **„începând cu anul fiscal în care numărul camerelor … este de peste 7"**, and **art. 85 alin. (1)** confirms the 1–7-room taxpayer is a distinct category.

A CAEN code is a **business-activity attribute recorded at the trade registry** (Legea 265/2022 art. 2 lit. b) pct. 2 — PFA/II/IF). The 1–7-room private landlord sits outside that chain: **no registered business activity → no CAEN code → the trigger never fires.**

**FACT — CAEN is not a licence.** HG 656/1997 art. 4 alin. (1): classification into a CAEN entity „nu presupune crearea de drepturi sau obligații"; alin. (2): using CAEN for public-administration purposes „revine în întregime în responsabilitatea organelor sau instituțiilor respective, care emit norme specifice de încadrare." **So any CAEN-based trigger is the app's own policy choice, not a transposition of Romanian law.**

---

## 2. Division 55 in CAEN Rev. 3 — five classes, not four

**FACT — the approving act is not a HG.** CAEN Rev. 3 was approved by **Ordinul președintelui INS nr. 377/2024** din 17.04.2024, **MO I nr. 385 din 25.04.2024**, in force **1 January 2025** (Portal Legislativ id 282063). **HG 656/1997** is the framework act, delegating updates to INS orders (art. 5 alin. (2)); **HG 284/2025** (MO 257/2025) inserted **art. 5^1**, an **18-month** window during which codes are valid in both the updated and previous version.

| Code | Official title (Rev. 3) | Note |
|---|---|---|
| 5510 | Hoteluri și alte facilități de cazare similare | daily/weekly, **with** daily cleaning, bed-making, on-the-spot service |
| **5520** | Facilități de cazare pentru vacanțe și perioade de scurtă durată | **self-contained; typically *no* on-the-spot service.** Includes holiday homes and apartments, hostels, B&B, **„guest rooms provided by private households"**, mountain huts |
| 5530 | Parcuri pentru rulote, campinguri și tabere | includes glamping |
| **5540** | **Intermedieri pentru servicii de cazare** | **NEW in Rev. 3.** Booking/Airbnb-type intermediaries — **a Division 55 code with no bed** |
| 5590 | Alte servicii de cazare | flats/apartments **shorter than a year**, student and worker accommodation — **not necessarily tourism** |

**The Rev. 2 trap.** Rev. 2 Division 55 had **four** classes (5510, 5520, 5530, 5590). **Rev. 3 adds 5540.** Any list copied from a Rev. 2-era source is silently wrong. **INTERPRETATION:** the 18-month window from 25.03.2025 expired around **25 September 2026**, so legacy Rev. 2 codes in registry records should now be treated as expired — but the app must still handle them.

**Where a naive list goes wrong:**
1. **5540 is not accommodation** — it is intermediation. Treating „Division 55" as „operates accommodation" is a false positive.
2. **5590 is not tourism** — a sub-year residential let.
3. **5520 is the class that actually describes a guesthouse / pension / B&B / private guest room**, and it is defined by the **absence** of hotel services, not by holding a tourism licence.
4. **The 55 ↔ 68 boundary is duration, not tourism**: Division 55 excludes annual lets (→ 68); 5590 excludes ≥ 1 year (→ 6820).

**Evidence caveat, stated by the Researcher.** The MO annex of Ordin 377/2024 contains **codes and titles only — no explanatory notes**. The Rev. 3 notes exist on insse.ro only as a **DRAFT .xlsx** that blocks automated fetch. The inclusion/exclusion wording above is therefore **NACE Rev. 2.1**, which INS states is **1:1 with CAEN Rev. 3** — **not an INS Romanian quotation.**

**Classes outside Division 55 that matter:** 6820 (long-term rental of own property — the class a short-term host with no CAEN is more likely adjacent to), 6811/6812 (Rev. 3 split of former 6810), 6831/6832, and **7911 / 7912 / 7990** (the destination for intermediation combined with advice, and for packages — the boundary 5540 draws). **FACT (Eurostat correspondence):** NACE Rev. 2 **68.20 maps to Rev. 2.1 55.90 *and* 68.20**, so a Rev. 3 record can look like accommodation for what is in substance a long-term residential let.

---

## 3. CAEN ↔ tourism registration: linked by a verification duty, not by a mapping

**Two corrections to the premises this pass was asked with.**
- **ONRC is not a tourism body.** ONRC = **Oficiul Național al Registrul Comerțului** — the trade registry, i.e. where CAEN codes live. The tourism authority is **MEDAT** (Ministerul Economiei, Digitalizării, Antreprenoriatului și Turismului), organised by **HG 189/2025**; historically ANT.
- **Legea 97/2020 is not tourism law** (it amends Legea 421/2002 on abandoned vehicles). The tourism framework is **OG 58/1998** *privind organizarea și desfășurarea activității de turism*, approved with modifications by **Legea 755/2001**, amended through **Legea 35/2026** and **Legea 41/2026**. **No „OG 21/2015" amending the tourism law was found.**

**FACT — the crux.** Ordin ANT 65/2013, as amended by **Ordin MEDAT 948/2026** (MO 559 bis/2026) and **Ordin MEDAT 1.198/2026** (MO 679/2026), creates **two different dossiers**:
- **Economic operators / administrators:** includes a **certificat constatator de la registrul comerțului** with activities and CAEN.
- **Natural persons owning „apartamente și/sau camere de închiriat în locuințe familiale":** application, standardised room sheet, **copy of the person's ID**, title document, co-owners' consent to „închiriere în regim hotelier", neighbours'/association consent, proof of legality of construction. **No trade-registry document — therefore no CAEN in the file at all.**
- **alin. (12):** natural persons „pot solicita clasificarea doar pentru un număr maxim de **7 camere/14 locuri** … indiferent de numărul de locuințe".

Ordin 948/2026 also states expressly that classification does not exempt anyone from Legea 265/2022, and that operators must declare the activities and **inscrie codul sau codurile CAEN** per art. 121. MEDAT's own release confirms it **verifies CAEN directly through the ONRC platform** rather than collecting the certificate.

**Answer, stated plainly.** The systems are **linked by a verification duty, not by a mapping.** Nothing makes a Division 55 CAEN a precondition for tourism registration, and nothing makes a tourism registration produce one. A unit can be lawfully classified with no Division 55 CAEN — most obviously the natural-person track, where there is **no CAEN at all**. A unit can carry a Division 55 CAEN with no tourism registration (5540, 5590).

**FACT — and this is a finding, not a gap.** **No official mapping from „tip de structură de primire turistică" to CAEN codes exists in any source retrieved.** If one is later „found" on a consultancy site, it is not law: HG 656/1997 art. 4 alin. (2) makes any such mapping **the app's own normative choice**, and it must be documented as such.

---

## 4. Non-CAEN markers an app could detect instead

| Marker | Basis | Held by | Detectable? |
|---|---|---|---|
| **DU (formular 212)** with income under art. 83/85 (1–7 rooms) or 68^3 (>7) | L239/2025; model OPANAF 2736/2025; pre-fill OPANAF 2719/2025 | ANAF | Only via the taxpayer's own SPV login. ANAF pre-fills 212 from its own databases by 31 March — **evidence ANAF holds the signal** |
| **Registrul RO e-Factura obligatoriu**, CNP-identified persons carrying out economic activities, formular 082 | **OG 6/2026 art. IX**; **OPANAF 378/2026**; **OPANAF 1.020/2026**; deadline 26.05.2026, inscribed 01.06.2026 | ANAF | **Strongest candidate.** OPANAF 3.789/2024 as amended provides the register **prin servicii web**, returning „figurează / nu figurează" keyed on CIF/CNP |
| **DAC7 platform reports** (F7000, by 31 January) | **OG 16/2023**, art. 291^5 Cod procedură fiscală | ANAF | Not third-party accessible, but it is the state's own cross-check dataset for exactly this population |
| **Certificat de clasificare / autorizație provizorie** + public registers of classified structures | HG 1.267/2010; Ordin 65/2013 as amended | MEDAT — „Registrele publice … pot fi consultate" | **Yes, and it exists for natural persons** |
| **Registration number under Reg. (EU) 2024/1028**, via **SITUR** | Regulation (EU) 2024/1028 art. 4–6 | MEDAT | **Yes by design** — a public, easily accessible register, free of personal data, displayed in every listing, verifiable by platforms |
| **Fișa de ocupare** | art. 85 alin. (8)–(9); OPANAF 381/2026 | **Nobody — the taxpayer keeps it** | **No. Do not build on it** |

**FACT — correcting another premise.** **Legea 239/2025 creates no platform-registration or reporting duty for short-term hosts.** Its short-term content is purely fiscal: it inserts art. 68^3 and rewrites art. 83 and art. 85, and its only platform reference is **art. 85 alin. (3)** — the commission retained by platforms is **excluded from gross income**. Platform reporting is **DAC7 (OG 16/2023)**, in force since 31 January 2024.

---

## 5. Not established

1. **The official Romanian wording of the Rev. 3 notes** — DRAFT .xlsx on insse.ro blocks automated fetch. **Until retrieved, the include/exclude text in §2 is NACE Rev. 2.1, not an INS quotation.**
2. **Whether classification is mandatory for an unregistered natural person.** Ordin 65/2013 says natural persons „**pot** solicita clasificarea" (permissive) while OG 58/1998 art. 30 lit. c) requires functioning „numai cu structuri de primire turistice clasificate" (mandatory), and **OG 58/1998 art. 2 contains no definition of „operator economic"**. **Genuinely unresolved on the face of the texts.** This decides whether the tourism register is a usable fallback signal at all. Next: **HG 1.267/2010 consolidated**, then enforcement records.
3. **Whether the CNP-based e-Factura obligation covers short-term letting of one's own dwelling** — the 082 instructions cross-refer OUG 120/2021 art. 5, 9^1, 10 alin. (1), 10^1 alin. (2), 10^10, which were not retrieved. Press asserts it does; **not verified**.
4. **Whether SITUR issuance is actually operational** — secondary sources conflict; no dated official MEDAT/ANAF statement found.
5. **Any local-tax marker** (formular 100, a short-term-letting surcharge) — not tested.
6. **An ONRC-published authorised-activity/CAEN list for tourism** — a file circulates on mirrors; not retrievable from onrc.ro itself.
