# R-B2 — Can the normă de venit dataset actually be built? The 42-county feasibility audit (2026-10-10)

**Researcher:** `scout-R-b2-norma-feasibility`. Transcribed by the Orchestrator (**Q-RESEARCHER-WRITE**). Report arrived complete.
**Question:** `research/30` answered *can the 2026 normă amounts be cited* (yes, per county). This answers *can they be obtained at scale* — per county: machine-readable or scan, how many value columns, do the correction coefficients exist, and is the nomenclator position numbering stable enough to key a national table on.
**Why it mattered:** **D-NORMA-1** committed to supporting normă de venit before launch. That commitment had no cost attached to it. This is the audit that attaches one.

**Bottom line, in the researcher's words: build it semi-automatically.** Automate the 34 readable counties (≈4,370 of ~5,400 amount cells), hand-transcribe or OCR the 8 unreadable, hand-encode coefficients for the 12 deficient counties, and **key everything on the activity description rather than the position number.**

---

## 1. The corpus: 34 readable, 7 scans, 1 corrupt

**FACT.** Of the 42 entries on ANAF's index: **34 have a clean machine-readable text layer**, **7 are image-only scans with zero extractable text** — **Botoșani, Caraș-Severin, Hunedoara, Neamț, Suceava, Timiș, Vaslui** — and **1 (Bacău) has a corrupt text layer**: 53,109 characters of OCR noise („I o o c o J o o a o n o G…") with **zero lei amounts recoverable**.

**The discriminator is cheap and reliable (FACT):** `fetch_content` in readable mode on a static.anaf.ro PDF writes markdown to `/tmp/pi-web-pdf/<slug>.md`; readable PDFs yield **40k–90k characters**, image-only scans yield **131–146 characters** — just the header. No `pdftotext`, no local tooling. **This closes the host-tooling gap recorded in `research/29` §9 and `research/30` §9.**

**The official index is incomplete (FACT).** All 7 links for the DGRFP Ploiești counties (`Arges2026.pdf`, `Calarasi2026.pdf`, `Dambovita2026.pdf`, `Giurgiu2026.pdf`, `Ialomita2026.pdf`, `Prahova2026.pdf`, `Teleorman2026.pdf`) return **HTTP 404** on the ANAF index. The same acts are live at `static.anaf.ro/static/10/Ploiesti/{AG,DB,CL,GR,IL,PH,TR}_norme_venit2026.pdf`, linked from the DGRFP Ploiești page. **The index is broken, not the corpus** — but an automated harvest of the index alone would silently lose seven counties.

---

## 2. Position numbering is NOT nationally stable — and the cause is identified

**FACT.** 35 counties align exactly with the OMFP 1.960/2025 annex (1–128, anchors verified: Dogărie 39, Transporturi 126, Vulcanizare 127, Vopsire 128 hold everywhere). **The 7 DGRFP Ploiești counties run a 129-row legacy numbering** with an extra position 51, shifting everything from 51 onward by +1:

| Anchor | 35 counties | 7 Ploiești counties |
|---|---|---|
| 39 Dogărie | 39 | 39 |
| **51 „Închiriere de camere în scop turistic"** | **absent** | **51 — present** |
| 51 Întreţinere şi reparare autovehicule | 51 | **52** |
| 54 Legare de cărţi | 54 | **55** |
| 128 Vopsire, emailare și cositorie | 128 | **129** |

Verbatim, Dâmbovița: „…50. Închirieri de casete audio-video CD si DVD … **51. Închiriere de camere în scop turistic** - 5510: Hoteluri şi alte facilităţi de cazare similare … **52. Întreţinere şi reparare** … autovehicule…". Confirmed verbatim in Prahova, Ialomița and Teleorman.

**Diagnosis (INTERPRETATION, strongly evidenced): the Ploiești tables are keyed to OMFP 2.875/2011, not the current nomenclator.** „Închiriere de camere în scop turistic" **is in the 2011 annex** and **is absent from OMFP 1.960/2025**; and the 2011 annex's tail is exactly `128. Vulcanizare … 129. Vopsire, emailare și cositorie`, identical to the Ploiești tail.

**Repairable, but only if the key is chosen correctly.** Recommended key: **(județ, coloana-2 activity description)** — never the raw `Nr. crt.`. If position must be used: *for Argeș, Călărași, Dâmbovița, Giurgiu, Ialomița, Prahova, Teleorman — delete position 51 and subtract 1 from all positions ≥ 52.* No other drift, gap or county-added position was found.

**This is the finding that would have corrupted the dataset silently.** A table keyed on position number would have loaded 7 counties off by one from row 51 onward — wrong amounts against right activity names, with no error anywhere.

---

## 3. The binding constraint: correction coefficients

**FACT.** The 10 % tax is levied on the **adjusted** norm (art. 69^2 alin. (1)), so coefficients are not optional. Availability across the 42:

- **29** publish an explicit „coeficienţi de corecție" section.
- **1** publishes them under a different name — Iași: „**Corectivele de reducere a normelor de venit pentru anul 2026**" (0 hits for `coeficien`).
- **3** publish reduction/majoration percentages but never use the statutory term — **Arad, București, Ilfov** (e.g. Arad: „Nota: Normele de venit se reduc/majorează dupa cum urmeaza: Reducere: a) 30 %… Majorare: f) 25 % pentru cei care lucrează cu salariaţi").
- **1** has no coefficient content at all in the text layer — **Brăila** (0 hits for `coeficien-`/`corec-` in 51k characters). Either genuinely unpublished — an art. 69 alin. (2) lit. b) compliance problem — or an image inside an otherwise-textual PDF.
- **8** indeterminate (7 scans + Bacău).

**So 12 of 42 counties cannot derive *norma ajustată* automatically.**

**The harder part is not the numbers, it is the vocabulary and the stacking rule.** Criteria differ county by county (age bands, salariați, handicap/invaliditate, vad comercial, spațiu închiriat, forță motrică, sezonier, elevi/studenți), and each county has its own combination rule — most say „iau în calcul coeficientul cel mai mare", while Dâmbovița adds „**Se aplică mai întâi corecțiile de majorare a normei și apoi cele legate de reducerea normei**".

---

## 4. Table shapes and locality categories

**FACT.** Column counts across the 34 readable: **1 column ×6** (Brăila, Constanța, Galați, Ilfov, Tulcea, Vrancea), **3 ×17**, **4 ×6** (Alba, Bihor, Brașov, Cluj, Covasna, Olt), **5 ×1** (Bistrița-Năsăud), **6 ×2** (Iași, Mureș), **7 ×1** (Satu Mare), **18 ×1** (București = 6 sectoare × Centru A / Semicentru B / Periferie C+D, with a second header row Zona 0 / Zona I / Zona II+III).

**There is no national locality-category code to join on (FACT).** Only `Municipiu/Municipii`, `Oraș(e)` and `Comune` recur loosely. Most counties enumerate named localities inside the header (Bihor, Bistrița-Năsăud, Buzău, Gorj, Iași, Mureș, Olt, Prahova, Satu Mare, Sibiu), and four use zone schemes found nowhere else: Alba `zona/categoria I…IV`; Covasna `Comune Zona I / II`; Mureș `Zona rurală`; București as above. **A cross-county join on locality tier requires a hand-built mapping table with no official source to derive it from.**

**Act identifiers are frequently absent from the text layer (FACT) — a provenance problem for a citation-per-row model.** A numbered decision with a date is machine-extractable for only **13 counties** (Bihor 1990, Bistrița-Năsăud 1991, Cluj 1992, Maramureș 1993, Satu Mare 1994, Sălaj 1995, Brăila 1195, Buzău 1196, Constanța 1197, Galați 1198, Tulcea 1199, Vrancea 1200 — all `/31.12.2025`; plus Vâlcea `VLG_DEX_2917/16.02.2026`). Three give a bare date with no number (Gorj 09.03.2026, Mehedinți 10.03.2026, Olt 23.02.2026). For **Alba, Arad, Brașov, București, Covasna, Harghita, Iași, Ilfov, Mureș, Sibiu and all 7 Ploiești counties there is no act number or date anywhere in the extracted text.**

**Extraction hazards (FACT), all of which must be handled regardless of route:** (a) rows straddling a page break get their value cells **duplicated** — Giurgiu renders `49100 49100 49100 49100 49100 49100 48600 48600 48600` for a 3-column table, and `49100` occurs **769 times** in a 129-row table; (b) amount formatting is inconsistent, `48600` (Alba, Vâlcea, Galați) vs `48.600` (Arad, Dolj, Teleorman); (c) the table is flattened, so **column identity must come from the header, not from cell order**.

---

## 5. The national annex, and the trajectory of the list

**FACT.** **OMFP 1.960/2025** (PL **306193**, MO **1215/30.12.2025** — the MO citation corroborated verbatim inside the Mureș county PDF: „Ordinul nr. 1960/2025 publicat in Monitorul Oficial nr. 1215 din 30 decembrie 2025") has an annex numbered **1–128 contiguously, no gaps**, ending `127. Vulcanizare … 128. Vopsire, emailare și cositorie`.

**My "did 925/2017 shrink the list" question is answered, and the answer is no — it grew it.** **OMFP 2.875/2011** (MO 871/09.12.2011, PL **133557**) = **129 positions**. **OMFP 925/2017** (MO 519/04.07.2017) = **130 positions**, and its art. 3 expressly abrogates 2.875/2011. **OMFP 1.960/2025** = **128**. The trajectory is **129 → 130 → 128**; the net shrink happened at the 2025 order. Also confirmed: 925/2017 art. 2 alin. (3) already carried the „cu titlu exemplificativ" formula for the CAEN columns — so the CAEN disclaimer in `research/30` §3 is not new, and Bihor and Cluj reproduce it in their 2026 headers.

---

## 6. Two citations pinned

**OG nr. 16 din 15 iulie 2022** — **MO 716 din 15.07.2022**, PL **257589**. Art. I pct. 30 verbatim: „La articolul 69, alineatul (9) se modifică și va avea următorul cuprins: (9) Contribuabilii, pentru care venitul net se determină pe bază de norme de venit și care în anul fiscal anterior au înregistrat un venit brut anual mai mare decât echivalentul în lei al sumei de **25.000 euro**, începând cu anul fiscal următor au obligația determinării venitului net anual în sistem real…". Art. IX lit. e): „prevederile pct. 30, 43, 48, 49, 51-53, 71, 73-75, 81, 83-86 se aplică începând cu veniturile aferente anului 2023".

**OMADR nr. 386 din 18 noiembrie 2025** — **MO 1072 din 21.11.2025**, in force 21.11.2025; primary text at `static.anaf.ro/static/10/Anaf/legislatie/OMADR_386_2025.pdf`. Art. 2 verbatim: „Nivelul normei anuale de venit corespunzătoare pentru punctul gastronomic local, pentru anul 2026, se stabilește la suma de **48.600 lei**." Corroborated by a DGRFP Galați press note. Legea 412/2023 = MO 1147/19.12.2023, unchanged.

---

## 7. The cost, stated plainly

| Sub-question | Answer |
|---|---|
| **(i) Amounts machine-readable at scale?** | **Yes for 34 of 42; no for 8.** Manual cost for the 8: ~128 rows × 1–4 columns ≈ **1,000–1,300 individual lei figures** — a focused day by hand, but OCR is the better route (the scans are clean page images, and the ANAF index itself exposes a ReadSpeaker docreader link per PDF). Never substitute a secondary site's figures. |
| **(ii) Coefficients available for every county?** | **No — this is the binding constraint.** 12 of 42 deficient. Manual cost ≈ **20–30 coefficient rules per county, ~300 rules total**, an afternoon — but the real work is normalising the criteria vocabulary and encoding each county's stacking rule. |
| **(iii) Is position numbering stable enough to key on?** | **Not on the raw number; yes with one documented remap.** Key on (județ, coloana-2 description). Plus a hand-built locality taxonomy: **34 header sets, 1–18 columns each**, worst being București and Bistrița-Năsăud — roughly half a day. |

**Total: a semi-automatic build is plausible.** The dataset is not one national table; it is 42 county tables with three different failure modes, and the honest framing for the owner is that 12H is a **data-engineering phase with a manual tail**, not a legal phase.

---

## 8. Gaps handed on

1. **The 8 unreadable counties** — OCR rather than hand-typing (ReadSpeaker docreader URLs are on the index page itself).
2. **Act number/date for 21 counties** — likely in signature stamps or a covering *referat* outside the text layer. Either request from the DGRFP or accept "act identifier unavailable" as a column value. **This one has a design consequence: a citation-per-row model cannot cite what cannot be read.**
3. **Brăila's coefficients** — inspect pages 6–7 visually; if genuinely unpublished, that is an art. 69 alin. (2) lit. b) compliance gap worth naming.
4. **Călărași and Giurgiu** show the 129-row pattern but the inserted string was not matched verbatim (diacritic variants). Treat as the same insertion pending confirmation.
5. **Mureș's 6 columns is INTERPRETATION** from header labels; the flattened text made per-row value counts unreliable. Same caveat, weaker, for Sibiu and Alba.
6. **No national locality-category taxonomy exists** — nothing official to derive one from.
