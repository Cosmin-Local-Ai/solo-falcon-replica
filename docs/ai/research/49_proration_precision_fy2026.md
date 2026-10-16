# R-PRORATE — The art. 118 alin. (2²) proration has no regulated precision, and one ANAF example we pinned is wrong

**Researched by** `researcher-proration-rounding` on 2026-10-14, web only. **Written to file by the orchestrator** — the Researcher has no filesystem access (§12.16, §12.14). **Closes B-118.**

## The question
Art. 118 alin. (2²) prorates the deductible CAS *„proporțional cu ponderea venitului net anual determinat în sistem real în total venituri cumulate potrivit prevederilor art. 148 alin. (3), aplicată asupra contribuției … calculate potrivit art. 151 alin. (1)"*. **At what precision is that *ponderea* carried, and how is it rounded?**

## Headline — FACT
**It is regulated nowhere.** The researcher checked seven places and the words *„rotunjire"*, *„zecimale"*, *„procente"* **do not occur anywhere in the 78-page OPANAF 2736/2025 order.** The ratio row is defined only mechanically as *„(rd. 1/rd. 2)"*, in a table headed **“(lei)"** that gives the ratio no unit and no precision (one CECCAR facsimile prints a 100 % ratio as „1 leu").

**The only place a precision actually exists is ANAF's own web application — undocumented, and inconsistent with itself.**

## The four candidate answers, on ANAF's own București numbers
CAS datorată 24.300; sistem-real net 68.000; cumulat 118.000. Ratio exact = **0,576271186…**

| Reading | Ponderea used | Product | **CAS deductibilă** |
|---|---|---|---|
| No rounding (exact) | 0,576271186… | 14.003,3898 | **14.003** |
| Coefficient, 5 decimals (CECCAR FY2024 practice) | 0,57627 | 14.003,361 | **14.003** |
| Coefficient, 4 decimals = 2 decimals of a percent (**ANAF's app**) | 0,5763 | 14.004,09 | **14.004** |
| 1 decimal of a percent (**ANAF București leaflet**) | 0,576 | 13.996,80 | **13.997** |
| 2 decimals of coefficient | 0,58 | 14.094 | 14.094 |

## ★ The decisive evidence — ANAF's own D212 web application. FACT
Source: the live official form `anaf.ro/declaratii/duf` (footer **V-1.8.10 / 15.05.2026**), Next.js bundle `0f2u1exd93.lx.js`. Helpers verbatim:

```
ty = e => Number.isFinite(e) ? String(Math.round(e)) : ""   // lei → whole leu
tA = e => Math.round(1e4*e)/1e4                             // RATIO → 4 decimals
tC = e => Number.isFinite(e) ? e.toFixed(5) : ""            // display: 5 decimals
```
Subsecțiunea 4.1 (CAS deductibilă, art. 118): `s = tA(r/n)` then `o = s*d`, `rd5 = ty(o)`.

**Entered with ANAF's own București numbers, the application returned:**
```
s41_rd1 = 68000   s41_rd2 = 118000   s41_rd3 = 0.57630   s41_rd4 = 24300   s41_rd5 = 14004
s4_rd1  = 48000   s4_rd2  = 14004    s4_rd3  = 6800      s4_rd4  = 27196   s4_rd6  = 2720
```
**14.004 — not the brochure's 13.997.** A second controlled run (ratio exactly 0,57625, CAS 100.000) gave `pondere = 0.57630`, `CAS deductibilă = 57.630` where the exact product is 57.625 — **confirming the pre-rounding is real arithmetic, not a display artefact.**

**⚠️ And ANAF contradicts itself: Subsecțiunea 5.1 — CAS deductibilă pentru DPI, the very path B-112 builds — uses `l = r/n` with no `tA`, i.e. the exact ratio.** No source reconciles this.

## ⚠️ The București example we pinned as authority is wrong
**ANAF DGRFP București, „Noutăți privind DU 2026 – exemple", Exemplul 3** states: *„…= 68.000 / 118.000 x 100 = 57,6% — CAS deductibil = 24.300 x 57,6% = 13.997 lei — Venitul anual impozabil = 48.000 – 13.997 - 6.800 = 27.203 lei — Impozit = 2.720 lei."*

**It rounded the ratio to one decimal of a percent.** That is **(c) sloppiness**, not a rule and not a display convention. **`src/domain/golden/regimeSplit.test.ts` pinned 13.997 as an externally-derived expected value. It is now shown to be an error in an official ANAF leaflet.**

## Worked examples with a non-terminating ratio — five, and they disagree
| # | Source | FY / SMN | Ratio exact | As written | CAS due | **Published CAS deduct.** | Exact route | 4-decimal rule |
|---|---|---|---|---|---|---|---|---|
| 1 | ANAF București, Exemplul 3 | 2025 / 4.050 | 0,576271186 | **57,6 %** | 24.300 | **13.997** | 14.003 | 14.004 |
| 2 | **ANAF Galați** | 2025 / 4.050 | 0,538461538 | **53,85 %** | 12.150 | **6.543** | 6.542 | **6.543 ✔** |
| 3 | **ANAF Cluj** | 2025 / 4.050 | 0,482758621 | **48,28 %** | 12.150 | **5.866** | 5.866 | 5.866 ✔ |
| 4 | CECCAR Business Review 2/2026 (Cernușcă) | 2025 / 4.050 | 0,81480783 | **0,8148** | 24.300 | **19.800** | 19.800 | 19.800 ✔ |
| 5 | CECCAR (OPANAF 7.015/2024) | 2024 / 3.300 | 0,7961484 / 0,2038517 / 0,6756757 | **5 decimals** | 19.800 | **15.764 / 4.036 / 13.378** | **✔** | ✘ |

**Galați is the second discriminating case:** 53,85 % gives 6.543 where the exact route gives 6.542. **Two ANAF leaflets (Galați, Cluj) carry the ratio as 2 decimals of a percent = a 4-decimal coefficient, matching the application; București alone uses one decimal.** **CECCAR's FY2024 examples use 5 decimals and match the exact route, and would not match the 4-decimal rule.**

## Art. 66 — verbatim, and a stale citation in our own briefs
Current text (Titlul IV, Cap. I), **single paragraph, no alineate**:
> **„Sumele sunt calculate prin rotunjire la un leu, prin neglijarea fracțiunilor de până la 50 de bani inclusiv și majorarea la leu a fracțiunilor ce depășesc 50 de bani."**

Modified by Pct. 29, Art. I din Legea 296/2020. **⚠️ There is no „art. 66 alin. (1)" in the current text** — that reference is pre-2020, when art. 66 was about *deducerea personală* and rounded to 10 lei. **Our own `ROUNDING_CHOICE` cites „art. 66 alin. (1)"; the citation is stale even though the rule is right.**

**Scope — CORROBORATED:** ANAF (sept. 2025, via George Moț) on CASS rounding: *„…care nu este acoperit explicit în Codul Fiscal… modalitatea de rotunjire a sumelor rezultate din calculul CASS este aceeași cu cea aplicabilă impozitului pe venit (art.66). Respectiv, tot ce este sub 50 de bani (inclusiv) se rotunjește în jos, și ce depășește acest prag se rotunjește în sus."* **That is about sums due. Whether art. 66 reaches a *deduction* line is a textual question no source settles** — the current wording says simply *„Sumele"*, unqualified within Titlul IV.

**The Norme metodologice contain exactly one rounding provision** (pct. 4, for *bazele de calcul*), and **pct. 35 — the norm for art. 118 — never mentions CAS/CASS deductibilă, the *ponderea*, or rounding.** **No norm anywhere implements art. 118 alin. (2²)–(2⁴).**

**Titlul V has no rounding article at all.**

## The 50-bani edge — unresolved, and our app and ANAF's differ
Art. 66 neglects fracțiuni **până la 50 de bani inclusiv** (half-**down** at exactly 50 bani). ANAF's application uses `Math.round` (half-**up**). **They diverge at exactly 0,50 bani, and no source tests it.**

## DECISION — 2026-10-14, orchestrator, with the user
**Adopt the exact ratio; round only the final product, by art. 66 half-down at 50 bani. Exemplul 3's CAS deductibilă becomes 14.003 lei.**

**Why not ANAF's 4-decimal rule, in order of weight:**
1. **No citable authority exists for it.** It is minified code in a bundle. Our rules carry citations; this one could not be cited.
2. **ANAF contradicts itself exactly where we are building:** Subsecțiunea 5.1 — DPI CAS deductibilă — uses the exact ratio. "Match ANAF's app" has no single answer, and for our path the app is already exact.
3. **It promotes a display artefact into arithmetic.** A row displays a coefficient, so they round it and then compute with the rounded value — the same family as our B-70 "two producers disagree" defects.
4. **`money.ts` already declares itself "the only place money rounds."** The 4-decimal rule adds a second rounding point, against our own invariant.
5. **CECCAR's FY2024 examples use 5 decimals and match the exact route.** Practitioners are not uniformly on 4.

**The difference is 1 leu either way. Exact is defensible; 4-decimal is defensible only by appeal to undocumented code.**

**Fixture handling — this is the important discipline point.** `regimeSplit.test.ts` changes from `it.fails` at **13.997** to a passing assertion at **14.003**. **That is NOT the forbidden move.** The forbidden move is adjusting an expected value to match the engine. **Here the source was disproven by better evidence — ANAF's own software plus two other ANAF leaflets.** **13.997 must be kept as a named negative** — assert the engine does *not* produce it — so the București error stays visible rather than being quietly overwritten.

## Still open
1. **Whether art. 66 reaches a *deduction* line at all** — textual, unsettled, no source applies it to CAS deductibilă specifically.
2. **The 0,50-bani tie** — art. 66 half-down vs ANAF's half-up. Untested by any source.
3. **The offline `soft ANAF` DF212 program and the SPV precompletare backend were not verified.** The bundle maps prefill fields `rd3_pondere` / `rd5_cas_deductibila`, so ANAF's server emits a pondere — **whether the server uses the same 4-decimal rule is unconfirmed.** *Next: obtain a pre-filled D212 for a known case from SPV and read `rd3_pondere`.*
4. **Why Subsecțiunea 5.1 uses the exact ratio while 4.1/4.2 do not** — unexplained.

## Sources
**Kept:** Cod fiscal Titlul IV Cap. XI art. 118 alin. (2²)–(2⁴) (Lexistoria); **art. 66 current text** (legislatie.info, Lexistoria, noulcodfiscal.ro) and its pre-2020 form (Wolters Kluwer); Normele metodologice Titlul IV **pct. 4** and **pct. 35** (Lege5; HG 354/2018 via legislatie.just.ro); HG 451/2024 comparison table (ANAF Brașov); **OPANAF 2736/2025** full order and the D212 model (static.anaf.ro); OPANAF 2.719/2025 (precompletare); **ANAF DGRFP București** DU-2026 examples; **ANAF Galați** `activ-indep.pdf`; **ANAF Cluj** 22 apr 2026; **CECCAR Business Review 2/2026** (Cernușcă) and the OPANAF 7.015/2024 study; **ANAF web application** `anaf.ro/declaratii/duf` bundle V-1.8.10/15.05.2026; capital.ro / romaniatv.net for ANAF's sept. 2025 art. 66 statement.
**Dropped:** fiscalx.ro (TVA 19 %); ANAF national DPI guide (stale); ANAF Ploiești/Iași decks (no worked proration); third-party D212 XSD notes (prior form, not authoritative).
