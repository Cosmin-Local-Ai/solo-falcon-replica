# U-8 closed + the CASS optare leftovers — act-level amendment scan

Research pass for **Phase 5**, closing the items Phase 4 deliberately deferred. Conducted 2026-10-06.
Companion to `08_art118_income_tax_2026.md`.

---

## 1. U-8 — **CLOSED.** Neither OUG touches CF art. 154 / 170 / 174 / 180.

**Method (this is the part to reuse):** opened each act's own printable form on Portal Legislativ and
scanned the **full text** with a phrasing-agnostic regex `(La articolul|articolul|art\.)\s*<NN>\b` per
target article, plus enumerated the `N. La articolul X …` clause headers. A consolidation-note scan
**missed** these acts' Titlul IV clauses entirely, so the note-based method is not sufficient evidence.

### OUG nr. 89 din 23.12.2025, MO nr. 1203 din 24.12.2025
`https://legislatie.just.ro/Public/FormaPrintabila/00000G1OTHP9J516I4O3EJ9Y2FC50238` (144,409 chars)

| Target | Hits | Result |
|---|---|---|
| art. 154 | **0** | not touched |
| art. 170 | **0** | not touched |
| art. 174 | **1 — FALSE POSITIVE** | see below |
| art. 180 | **0** | not touched |
| art. 118 | **0** | not touched |
| art. 123 | **0** | not touched |

⚠️ **The single "art. 174" hit is NOT the Cod fiscal.** It cross-references a different law:
> „…la nivelul dobânzii prevăzute la **art. 174 alin. (5) din Legea nr. 207/2015 privind Codul de procedură fiscală**…"

**Do not read this as a CF Titlul V amendment.** It is the trap in this result.

What OUG 89/2025 Art. I actually amends: CF art. **18^1, 45, 46^2, 51, 52, 54, 115, 336, 348, 367, 369,
375, 377, 385, 386, 387, 390, 391, 393, 414^10, 414^18, 435, 449, 450** — Titlul II (CIT), Titlul III
(micro), Titlul VI (accize). Only one clause is in Titlul IV, and it is a **withholding-rate** clause,
not the sistem-real base:
> „8. La articolul 115, alineatul (1) se modifică și va avea următorul cuprins: (1) Impozitul pe venit se
> calculează prin reținere la sursă la momentul acordării veniturilor de către plătitorii de venituri,
> prin aplicarea asupra venitului brut a unei cote de: a) 10% pentru veniturile prevăzute la art. 114 alin.
> (2) lit. a)-g), j)-k^1) și m^2); b) 16% pentru veniturile prevăzute la art. 114 alin. (2) lit. h) și i)."

### OUG nr. 8 din 24.02.2026, MO nr. 147 din 25.02.2026
`https://legislatie.just.ro/Public/FormaPrintabila/00000G0I2GWWBVXERKS0U0O49NX9SQ8E` (103,518 chars)

| Target | Hits | Result |
|---|---|---|
| art. 154 | **0** | not touched |
| art. 170 | **0** | not touched |
| art. 174 | **0** | not touched |
| art. 180 | **1 — reference, not an amendment** | see below |
| art. 118 | **0** | not touched |
| art. 123 | **0** | not touched |

⚠️ **The "art. 180" hit sits inside OUG 8/2026's own art. 8** (the 3% bonificație), not an amendment of
CF art. 180:
> „…inclusiv contribuția de asigurări sociale de sănătate datorată potrivit **art. 180 alin. (2)** din Legea
> nr. 227/2015 pentru anul 2025, se sting prin plată și/sau compensare, integral până la data 15 aprilie
> 2026 inclusiv…"

It conditions a **2025-only** rebate; it does not change the elective-CASS base.

What OUG 8/2026 amends: CF art. **18^1, 22, 23, 25, 26, 28, 41, 42, 42^9, 45, 47, 48, 52, 53, 54, 62, 68,
76, 78, 125, 142, 282, 324**. It **confirms the U-8 failure mode was real** — the Titlul IV clauses the
consolidation-note scan missed are here explicitly:
> „26. La articolul 68 alineatul (5), litera g) se modifică…"
> „27. La articolul 68 alineatul (5), după litera g) se introduc două noi litere, lit. g^1) și g^2)…"
> „28. La articolul 68 alineatul (5), după litera r) se introduce o nouă literă, lit. s)…"

### Consequence
**Nothing shipped in Phases 3–4 on CAS/CASS is invalidated.** Bonus: **art. 118 and art. 123 score 0 hits
in both OUGs**, so combined with the Legea 239/2025 scan (1 hit for "art. 118", a cross-reference inside
the art. 170 alin. (1) amendment; art. 123 amended only at alin. (1^2) and (2) via Art. XII pct. 16),
**the only 2025–2026 act touching art. 123 is Legea 239/2025, and no 2025–2026 act touches art. 118.**

---

## 2. CF art. 180 — the CASS optare, now fully captured — HIGH

Source: consolidation of 08.08.2026, doc **312601**. „Contribuția de asigurări sociale de sănătate datorată
de către persoanele fizice care optează pentru plata contribuției" (Secțiunea a 10-a, Cap. III, Titlul V).

> **(1)** „Pot opta în anul curent pentru plata contribuției de asigurări sociale de sănătate:
> **a)** persoanele fizice care încep în cursul anului fiscal să desfășoare activități independente, altele
> decât cele din contracte sportive încheiate potrivit Legii nr. 69/2000, cu modificările și completările
> ulterioare, precum și **cele care au înregistrat pierdere fiscală în anul fiscal anterior sau un venit net
> anual egal cu zero**;
> **b)** persoanele fizice care realizează venituri de natura celor prevăzute la art. 155 alin. (1) lit. c)-h);
> **c)** persoanele fizice care nu realizează venituri de natura celor prevăzute la art. 155 și nu se
> încadrează în categoriile de persoane exceptate de la plata contribuției de asigurări sociale de sănătate
> prevăzute la art. 154 alin. (1);
> **d)** persoanele fizice care realizează venituri de natura celor prevăzute la art. 155 sau alte venituri,
> pentru care nu se datorează contribuția de asigurări sociale de sănătate."
> *(alin. (1) lit. d): la 01-08-2025, modificată de **Pct. 36., Articolul II din LEGEA nr. 141/2025, MO nr. 699 din 25.07.2025**)*

> **(2)** „Persoanele fizice prevăzute la alin. (1) datorează contribuția de asigurări sociale de sănătate
> pentru anul în care exercită opțiunea, prin aplicarea cotei prevăzute la art. 156 asupra bazei de calcul,
> **reprezentând valoarea a 6 salarii de bază minime brute pe țară, în vigoare la data de 1 ianuarie a anului
> pentru care se datorează contribuția**."
> *(**no amendment note attached to alin. (2)**. Article-level note: „la 01-01-2025, Articolul 180 … a fost
> modificat de **Punctul 26., Articolul I din OUG nr. 128/2024, MO nr. 1125 din 11.11.2024**".)*

> **(3)** „Contribuția de asigurări sociale de sănătate datorată se evidențiază în Declarația unică … prin
> care se exercită opțiunea prevăzută la alin. (1) și care se depune **oricând în cursul anului** în care se
> optează pentru plata contribuției."
> **(4)** „În cazul persoanelor fizice care optează în anul curent … și obțin venituri anuale din cele
> prevăzute la art. 155 alin. (1) lit. b)-h) … se aplică prevederile art. 174 și/sau 174^1, după caz."
> **(5)** „…iar în cursul aceluiași an, ulterior exprimării opțiunii, se încadrează în categoriile de persoane
> exceptate … potrivit art. 154 alin. (1), contribuția de asigurări sociale de sănătate datorată potrivit
> alin. (2) **nu se recalculează**."

⚠️ **Do not mistake an editorial note for statutory text.** Immediately after alin. (2) the Portal Legislativ
page inserts a „Notă" reproducing **art. 8 of OUG 8/2026** (the 3% bonificație for 2025). That is a note,
**not** part of art. 180 alin. (2).

**Modelling consequence.** The elective base is a flat **6 × SMG as of 1 January of the contribution year**,
at the **art. 156** rate. Art. 180 alin. (1) lit. a) is exactly the zero/loss-year case Phase 4 identified.

### ⚠️ CORRECTION — art. 156 is **10%**, not 16%. The "3,888" figure in the first draft of this file was WRONG.

An earlier pass carried an unquoted parenthetical claiming art. 156 = 16%. It is not. Verbatim:

> **Articolul 156 — Cota de contribuție de asigurări sociale de sănătate:**
> „Cota de contribuție de asigurări sociale de sănătate este de **10%** și se datorează de către persoanele
> fizice care au calitatea de angajați sau pentru care există obligația plății contribuției de asigurări
> sociale de sănătate, potrivit prezentei legi."
> *(la 01-01-2018, Articolul 156, Secțiunea a 2-a, Cap. III, Titlul V — modificat de **Punctul 69, Articolul I
> din OUG nr. 79/2017, MO nr. 885 din 10.11.2017**)*

A single unnumbered paragraph — no alineate. **16% is the pre-2018 CASS rate**; OUG 79/2017 cut it to 10%
eff. 01.01.2018. Do not confuse it with CF art. 224 alin. (4) lit. b) (Titlul VIII/IX, amended by Legea
141/2025 clause 41), which does carry a "16%" and is not a CASS rate.

**So the elective CASS and the art. 174 alin. (6) minimum are the same rate and the same base — both
10% × 6 SM = 2,430 at SM = 4,050.** The distinction is the **route**, not the amount:
- **art. 174 alin. (6)** — a *floor topped up to* 6 SM when the actual base is below 6 SM.
- **art. 180 alin. (2)** — a *flat elective* 6 SM regardless of the actual base.

They must not double-count, per **art. 174 alin. (9)**: „contribuția datorată potrivit art. 180 alin. (2) …
**este luată în calcul** la stabilirea contribuției anuale calculate potrivit art. 170 alin. (1)".

**Ceiling, from the same read** — art. 170 alin. (1): the base „…care nu poate fi mai mare decât cea
corespunzătoare unei baze anuale de calcul egale cu nivelul de **72 de salarii minime brute pe țară**."

---

## 3. CF art. 174 alin. (8) — captured, and it legitimately stays unimplemented — HIGH

> **(8)** „Prevederile alin. (7) se aplică și persoanelor fizice care **în anul precedent**:
> **a)** s-au încadrat în categoriile de persoane exceptate de la plata contribuției de asigurări sociale de
> sănătate prevăzute la art. 154 alin. (1) lit. a), b), e) și f);
> *(la 01-08-2025, Litera a), Alineatul (8), Articolul 174 … modificată de **Punctul 35., Articolul II din LEGEA nr. 141/2025, MO nr. 699 din 25.07.2025**)*
> **Notă:** Litera f) a alineatului (1), articolul VII din LEGEA nr. 141/2025 (MO 699/25.07.2025), astfel cum
> a fost modificată de articolul VI din **ORDONANȚA nr. 22 din 28 august 2025, MO nr. 806 din 29.08.2025**,
> prevede: „(1) Prevederile art. II-VI intră în vigoare la data de 1 august 2025 și se aplică după cum
> urmează: **f) prevederile art. II pct. 34 și 35 se aplică începând cu veniturile anului 2025 pentru care
> termenul de declarare este până la data de 25 mai 2026**;"
> **b)** au optat pentru plata contribuției de asigurări sociale de sănătate potrivit art. 180 alin. (1)."

**Does it depend on prior-year data the app does not hold? YES — explicitly and unavoidably.** The trigger
is a condition on „**în anul precedent**": either (a) the person was in the art. 154 alin. (1) lit. a), b),
e), f) exempt categories in the prior year, or (b) they had opted under art. 180 alin. (1). Neither is
derivable from a current-year PFA ledger. **So art. 174 alin. (8) stays unimplemented on purpose** — it is
a missing-input dependency, not a modelling gap. It becomes implementable only once the app stores a
prior-year `exempt_category` / `art180_optare` flag.

Effective-date nuance worth rendering: the lit. a) amendment is dated 01-08-2025 but, per the reproduced
note, **applies to 2025 incomes whose filing deadline is 25 May 2026** — i.e. it *is* live for the 2026
filing cycle.

Adjacent, directly relevant to the optare (verbatim, same article):
> **(9)** „Persoanele fizice care au realizat venituri din cele prevăzute la art. 155 alin. (1) lit. b) și care
> în cursul aceluiași an fiscal au optat pentru plata contribuției de asigurări sociale de sănătate potrivit
> art. 180 alin. (1) depun Declarația unică … în termenul prevăzut la art. 122 alin. (3). În acest caz,
> **contribuția datorată potrivit art. 180 alin. (2) pentru anul în care au fost realizate veniturile este
> luată în calcul la stabilirea contribuției anuale calculate potrivit art. 170 alin. (1)**…"

---

## 4. Could NOT verify

1. **Which act OUG 89/2025's clauses on „articolul 10", „10^1", „12", „13", „15", „15^1" amend.** They sit
   under Art. II and following, and are **not** CF Titlul IV. **Do not read OUG 89/2025's „articolul 10^1"
   as the Cod fiscal.**
2. **CF art. 174 alin. (7) verbatim** — not re-retrieved in this pass; alin. (8) extends it, and Phase 4
   already captured alin. (7) lit. a)/b)/c).
3. **Clause-header enumeration completeness** — the `N. La articolul X…` regex missed some clauses (gaps at
   18, 19, 25, 29, 30, 36 in OUG 89/2025) because they are phrased differently. The **load-bearing evidence
   is the phrasing-agnostic number scan**, which returned 0 for 154/170/180/118/123 in both acts.
4. **Legea 141/2025 itself** — still not positively scanned for art. 118/123 (attribution-only MEDIUM).
   It *was* positively confirmed to amend CF **art. 174 alin. (8) lit. a)** and **art. 180 alin. (1) lit. d)**
   (Titlul V, MO 699/25.07.2025, eff. 01-08-2025).
5. **Titlul II Cap. I art. 13–15 full read** for any „persoană fizică" hook — not done. This is the one
   upgrade that would move the regime finding in `research/08` from MEDIUM-HIGH to HIGH.
6. ~~**CF art. 156 — the CASS rate value**~~ — **RESOLVED: 10%**, quoted in §2 above. The 16% figure was an
   unverified parenthetical and was wrong.

---

## 5. Legea 141/2025 — positive scan. Attribution gap **CLOSED** — HIGH

`https://legislatie.just.ro/Public/FormaPrintabila/00000G2OBVHGBS2FEHE17GOK32TRSP3T` — 167,290 chars, full text.

| Test | Result |
|---|---|
| `articolul 118` (exact) | **0 hits** |
| `articolul 123` (exact) | **0 hits** |
| raw substring `123` anywhere in the act | **0 hits** — the string does not occur at all |
| raw substring `118` anywhere | 7 hits, **all false positives**: 3× „Decretul-lege nr. 118/1990" (an act this law separately amends), 3× „MONITORUL OFICIAL nr. **1182** din 19.12.2025" (substring), 1× „Legea nr. **118**/2002 pentru instituirea indemnizației de merit" |

⚠️ **The „Decretul-lege nr. 118/1990" hits are the trap** — Legea 141/2025's own Art. I and Art. XXV deal with
that decree, so a naive `118` grep on this act is guaranteed to mislead.

Sanity check: 89 occurrences of „La articolul"; the CF amendment list (Art. II) enumerated cleanly as
clauses 1–49 covering CF art. 43, 46^1, 62, 97, 97^1, 100, 110, 114, 130, 153, 154, 155, 157^4, 157^6–9, 168,
169, 169^2, 174, 180, 182, 182^1, 183, 220^8, 224, 291, 294, 297. **Art. 118 and art. 123 are absent.**

**Net attribution position** — across the four acts read inside (Legea 239/2025, OUG 89/2025, OUG 8/2026,
Legea 141/2025): **no 2025–2026 act amends CF art. 118**, and the **only** one amending art. 123 is
**Legea 239/2025** (Art. XII pct. 16, alin. (1^2) and (2)). The MEDIUM on attribution is retired.

---

## 6. Titlul II Cap. I art. 13–15 — no „persoană fizică" hook. Regime finding **HIGH**

**Articolul 13 — Contribuabili** (operative personal scope; art. 14 is the coverage mirror):
> „(1) Sunt obligate la plata impozitului pe profit, conform prezentului titlu, următoarele persoane,
> denumite în continuare contribuabili:
> a) **persoanele juridice române**, cu excepțiile prevăzute la alin. (2);
> b) persoanele juridice străine care desfășoară activitate prin intermediul unui sediu permanent/mai
> multor sedii permanente în România;
> c) persoanele juridice străine rezidente în România potrivit locului conducerii efective;
> d) persoanele juridice străine care realizează venituri astfel cum sunt prevăzute la art. 12 lit. h);
> e) persoanele juridice cu sediul social în România, înființate potrivit legislației europene;
> f) persoanele juridice străine rezidente într-un stat terț … elemente hibride … cap. III^1;
> g) entitatea transparentă fiscal … elementelor hibride inversate … art. 40^7."

Every litera is a **persoană juridică** or a fiscal-transparent entity. **alin. (2) is a list of exclusions
that only removes *persoane juridice române*** (Trezoreria Statului, BNR, micro-enterprises at lit. h)…) —
it never admits anyone. **Art. 14**: all three litera are persoane juridice. **Art. 15**: „persoane juridice
române", „organizațiilor nonprofit, organizațiilor sindicale, organizațiilor patronale", „Formele asociative …
**cu personalitate juridică**".

The only string „persoanele fizice" in art. 13–15 is **art. 15 alin. (2) lit. o)**:
> „o) sumele primite din impozitul pe venit datorat de persoanele fizice, potrivit prevederilor titlului IV;"

**Not a hook** — it is a *venit neimpozabil* line for nonprofits receiving the 2% redirection of personal
income tax. It runs the other way, treating Titlul IV tax owed by persoane fizice as external to the
entity's own profit base.

**Verdict: HIGH.** Titlul II's personal scope is closed to legal entities at three independent points
(art. 13 alin. (1), art. 14, art. 15). A PFA cannot be a CIT taxpayer in 2026 — compounded by art. 120 CF
(the option vehicle) being Abrogat eff. 01.01.2025.

---

## 7. Still unverified after this pass

1. **SMG at 1 January 2026** — not retrieved by the researcher. **Closed locally instead:** `PLAN.md` and
   `phases/02` §3 already establish SM = **4,050 lei from 01.01.2026** (HG 1.506/2024, MO I 1185/28.11.2024;
   HG 146/2026, MO 196/13.03.2026, which abrogă HG 1.506/2024 from 01.07.2026 when SM becomes 4,325). Both
   the art. 180 alin. (2) and art. 174 alin. (6) bases anchor to the **1 January** SM — art. 180 alin. (2)
   says so expressly („în vigoare la data de 1 ianuarie a anului pentru care se datorează contribuția") and
   ANAF's own ceiling statement confirms it („291.600 lei = 72 × 4.050 lei"). **So 2,430 / 291,600 are right
   for 2026 and the 1 iulie rise to 4,325 does not move them.**
2. **Whether any 2025–2026 act outside the four read touches art. 118/123.** Four acts were scanned inside,
   not every act in the period.
3. **Legea 141/2025 Art. II clauses 37–38** not captured by the header regex (list jumps 36 → 39); the index
   indicates CF art. 182 and the new art. 182^1. Irrelevant to 118/123 — the `123` substring test returned 0
   across the whole act.
