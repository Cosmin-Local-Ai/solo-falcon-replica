# 12 — Quarterly payment deadlines for a PFA (sistem real): they do not exist (verified 2026-10-07)

Closes **Q-QUARTERLY-DATES (U-4)**, the open question this repository registered in Phase 2 and carried ever
since. Researcher pass ran 2026-10-07, 15 min 24 s.

**The finding, stated plainly: there are no quarterly payment deadlines for a Romanian PFA în sistem real in
fiscal year 2026.** All three quarterly rules in `src/domain/deadlines.ts` are wrong on **both** date and
citation, and one of them cites an article that has been **abrogated since 2018**. The single operative
deadline for income tax, CAS and CASS alike is **25 May** of the following year, via the Declarația Unică.

**Provenance note.** The Researcher sub-agent had no filesystem-write tool, so this file was written by the
orchestrator from the report it delivered. Every quote below is its transcription from the consolidation; the
corroboration column is the orchestrator's own check against this repository. I could not re-derive the
primary text myself (Portal Legislativ returns **HTTP 403** to `curl` from this environment, and no
orchestrator-side searching was performed), so each claim is graded and the repo-corroboration status is
stated per claim rather than assumed.

---

## 1. Consolidation used

| Act | Doc id | Form | Notes | Latest note | Used for |
|---|---|---|---|---|---|
| Legea 227/2015 Cod fiscal | **312601** | Forma consolidată | **2,021** `„la DD-MM-YYYY …"` notes | **08-08-2026** | everything below |
| CPF (Legea 207/2015) | 304520 | — | not reached | — | **not relied on** — all three obligations sit in the CF |

Body text read live: 2,535,020 chars. **Doc 172697 was not used** — it is the stale 2016 form that caused
earlier citation errors in this project (see `research/10` C-1, `research/11` §1).

---

## 2. Income tax — no instalment obligation exists

**art. 123 heading:** *„Stabilirea și plata impozitul **anual** datorat"* (Titlul IV, cap. XI). It is the
**annual** article. alin. (1) verbatim:

> *„Impozitul anual datorat se stabilește de contribuabili în declarația unică privind impozitul pe venit și
> contribuțiile sociale datorate de persoanele fizice pentru veniturile realizate în anul fiscal anterior,
> prin aplicarea cotei de 10% asupra venitului net anual impozabil determinat potrivit art. 118."*

**This is corroborated by this repository verbatim.** `phases/02_fiscal_baseline.md:162` already quotes the
same sentence as the source of the 10% rate, and `phases/05_income_tax.md:25` quotes it again. The word is
**anual**. **Confidence: high.**

The operative rule for art. 68 income is **art. 68 alin. (9)-(10)**:

> **(9)** *„Impozitul anual datorat se stabilește de contribuabil prin depunerea Declarației unice … până la
> termenul legal de depunere prevăzut la art. 122 alin. (3)."*
> **(10)** *„Plata impozitului anual datorat pentru venitul net anual se efectuează la bugetul de stat, până
> la termenul legal de depunere a Declarației unice … prevăzut la art. 122 alin. (3)."*

**art. 122 alin. (3)** — *„…până la data de 25 mai inclusiv a anului următor celui de realizare a
veniturilor"*, with the note *„(la 01-01-2025, Articolul 122 … a fost modificat de Punctul 12., Articolul I
din ORDONANȚA DE URGENȚĂ nr. 128 din 7 noiembrie 2024, MO nr. 1125 din 11 noiembrie 2024)"* and no later
note on alin. (3). **The 25 May term is corroborated by this repository** — `phases/02:366` quotes the same
text, verified in Phase 2. **Confidence: high.**

**The advance-payment article is abrogated.** 312601 shows *„Articolul 120 / **Abrogat.**"* and *„Articolul
120^1 / **Abrogat.**"*, both by OUG 128/2024 pct. 11 Art. I, MO 1125/11.11.2024, from 01-01-2025. This
matches `phases/06:40` and `phases/05:64` exactly. **Confidence: high.**

**Negative findings — exact strings, hit counts in doc 312601:**

| String | Hits | Where |
|---|---|---|
| `plăți anticipate` | 18 | art. 17 (4), art. 41 (10), art. 42 (1), art. 45 (1) — all **Titlul II, impozit pe profit**; 1 sits inside **art. 68^2** („Plăți anticipate ale impozitului pentru unele venituri din activități independente" — ANRP restitution income, 10% stopaj withheld by CEC Bank, **not** a PFA quarterly date). **0 in Titlul IV cap. XI for art. 68 income.** |
| `plăți anticipate trimestriale` | **0** | whole CF |
| `25 iunie` | 3 | art. 42, art. 45 (Titlul II) |
| `25 septembrie` | 2 | art. 17, art. 45 (Titlul II) |
| `25 decembrie` | 1 | art. 41 (Titlul II) |
| `25 martie, 25 iunie` | **0** | whole CF |
| Titlul V span (art. 132→190, 281,957 chars): `plăți anticipate` | **0** | — |
| Titlul V span: `25 iunie` / `25 septembrie` / `25 decembrie` | **0** | — |
| `art. 81` (as a cross-reference) | **0** | no provision in the consolidated CF cross-refers to art. 81 |

The last row strengthens `research/11` §2: art. 81 exists as a heading (payroll declarants) but **nothing in
the code refers to it**. It cannot be the basis of a PFA's own income-tax deadline.

**Corroboration from this repository's own failure to find it.** U-4 has been open since Phase 2. In that
time the project scanned **all of Titlul IV** hunting a phantom 30% cap (`research/10`, Q-30PCT-CAP) and
scanned the 2025-2026 amendment acts article-by-article (`research/09`). Neither ever surfaced a quarterly
instalment provision. The repo's own exhaustive negative searches agree with this one.

---

## 3. CAS — art. 160 has been abrogated since 2018, and the 15th does not exist

**art. 160, verbatim and complete:**

> *„Articolul 160 / **Abrogat.**"*
> *„(la 01-01-2018, Articolul 160 din Sectiunea a 3-a, Capitolul III, Titlul V a fost abrogat de Punctul 71,
> Articolul I din ORDONANȚA DE URGENȚĂ nr. 79 din 8 noiembrie 2017, publicată în MONITORUL OFICIAL nr. 885
> din 10 noiembrie 2017)"*

**`cas_quarterly` cites an article that has been dead for eight years.** **Confidence: high** — and this
repository already said art. 160 was the wrong article for CAS: `research/06:23` records that the articles in
force are **art. 138** (rate) and **art. 148** (base), *not* art. 160, and `research/06:17` flags the earlier
hedge about „art. 160 not directly verified". The Researcher's finding is the reason, which the repo had not
yet established.

**art. 148** is *„Baza de calcul al contribuției de asigurări sociale datorate de persoanele fizice care
realizează veniturile prevăzute la art. 137 alin. (1) lit. b) și b^1)"* — a **base** article, alin. (1)-(4),
containing **0** occurrences of `achit` / `plătește` / `trimestr`.

**The operative CAS rule is art. 151 alin. (1)** (Secțiunea a 6-a, cap. II, Titlul V — *„Stabilirea și plata
contribuției de asigurări sociale în cazul persoanelor care realizează venituri din activități independente
și din drepturi de proprietate intelectuală"*):

> *„Contribuabilii prevăzuți la art. 148 alin. (1) și (4) calculează contribuția de asigurări sociale prin
> aplicarea cotei prevăzute la art. 138 lit. a) asupra bazei anuale de calcul menționate la art. 148 alin. (2),
> depun Declarația unică … până la termenul legal prevăzut la art. 122 alin. (3) **și au obligația de a
> efectua plata acesteia în cadrul aceluiași termen**."*

Note: *„(la 01-01-2025, Articolul 151 … a fost modificat de Punctul 21., Articolul I din ORDONANȚA DE URGENȚĂ
nr. 128 din 7 noiembrie 2024, MO nr. 1125 din 11 noiembrie 2024)"*, plus the transitional note *„pct. 19-24 se
aplică începând cu veniturile aferente anului 2025"* → **this is the 2026 text**.

**art. 151 is corroborated as the operative self-employed CAS article by this repository**: `phases/05:44`
quotes „…calculate potrivit art. 151 alin. (1)", and `research/07:144,164,166` read art. 151 alin. (3)-(4)
verbatim from doc 312601. **Confidence: high for the article and its role; medium-high for the exact
„aceluiași termen" clause**, which is new to this repo and single-source.

**Hypothesis test — the orchestrator's own hypothesis ("the 15th is wrong, the real date is the 25th") is
FALSE as stated.** Neither is right. Declarare **and** plată are the **same single date: 25 May**. There is
no 15th and no quarterly 25th for the CAS of a PFA.

**Negative findings (Titlul V span, art. 132→190):** `15 octombrie` → **0**; `15 ianuarie` → **0**;
`15 aprilie` → 5, all one-off transitional/prorogation dates („până la data de 15 aprilie 2021", „integral
până la data 15 aprilie 2026"); `15 iulie` → 43, overwhelmingly amendment-note **act dates**
(„ORDONANȚA nr. 16 din 15 iulie 2022 … MO nr. 716 din 15 iulie 2022") plus one-off 2018 prorogations;
`25 martie` → 6, **all** `MO nr. 254 din 25 martie 2024` note dates. **No recurring 15th-of-month CAS
deadline exists anywhere in Titlul V.**

**Declarare vs plată, stated separately:** declarare = Declarația Unică (Formularul 212, approved by ANAF
order under art. 122 alin. (8)) by **25 May** (art. 122 alin. (3)); plată = **25 May**, the same term
(art. 151 alin. (1)). **D112 (art. 147) is the payroll return and does not apply to a PFA's own CAS** —
consistent with Q-CAS-EXEMPTION (U-5) closed in Phase 3, which established the same distinction.

---

## 4. CASS — art. 170 is a base article; payment is 25 May

**art. 170 heading, verbatim:** *„Baza de calcul al contribuției de asigurări sociale de sănătate datorate de
persoanele fizice care realizează veniturile prevăzute la art. 155 alin. (1) lit. b)-h)"*. **This confirms the
repository's verified baseline**: art. 170 is a *base* article with no dates. alin. (1) covers art. 155 alin.
(1) **lit. b)** (venituri din activități independente, definite conform art. 67) with base = venit net anual
and a **72-SMMB ceiling**; the 6/12/24-SMMB ladder in alin. (2)-(3) reaches only **lit. c)-h)**.

The repo's U-2 conclusion — that the 6-SM floor for art. 68 income comes from **art. 174 alin. (6)**, not
art. 170 alin. (2)-(3) — is **confirmed verbatim**:

> **(6)** *„În situația în care baza de calcul prevăzută la art. 170 alin. (1) … este mai mică decât cea
> corespunzătoare unei baze de calcul egale cu nivelul de 6 salarii minime brute pe țară, persoanele fizice
> datorează contribuția … până la nivelul celei corespunzătoare bazei de calcul egale cu 6 salarii minime
> brute pe țară și depun Declarația unică … în termenul prevăzut la art. 122 alin. (3)."*

Note on art. 170 alin. (1): *„(la 01-01-2026, Alineatul (1), Articolul 170 … a fost modificat de Punctul 19.,
Articolul XII din LEGEA nr. 239 din 15 decembrie 2025, MO nr. 1160 din 15 decembrie 2025)"* + *„pct. 19 se
aplică începând cu veniturile aferente anului 2026"*. **Confidence: high.**

**art. 174 heading:** *„Stabilirea, declararea și plata contribuției de asigurări sociale de sănătate în
cazul persoanelor care realizează venituri din cele prevăzute la art. 155 alin. (1) lit. b)"* — alin. (1)-(18).

**Payment date — art. 174 alin. (15), verbatim:**

> *„Plata contribuției de asigurări sociale de sănătate datorate se efectuează până la termenul legal de
> depunere a declarației prevăzut la art. 122 alin. (3)."*

→ **25 May, annual.** Not the 25th of the month following each quarter. Supporting: alin. (16) allows
voluntary early payments *„oricând până la împlinirea termenului de plată"* — that is not an instalment
schedule; alin. (17) is a bonificație of up to 10% set by annual budget law. Note: *„(la 01-01-2025,
Articolul 174 … a fost modificat de Punctul 23., Articolul I din ORDONANȚA DE URGENȚĂ nr. 128/2024, MO 1125/11.11.2024)"*.
**Confidence: medium-high — new to this repository and single-source**, but consistent with the 25 May term
the repo already verified and with art. 174's verified role.

**The gate is confirmed — art. 174 alin. (2), verbatim:**

> *„Persoanele fizice care au realizat venituri din cele prevăzute la art. 155 alin. (1) lit. b), altele
> decât cele prevăzute la art. 68^1, și au înregistrat pierdere fiscală sau un venit net anual egal cu zero
> nu datorează contribuția de asigurări sociale de sănătate potrivit art. 170 alin. (1). Acestea pot opta
> pentru plata contribuției … potrivit art. 180 alin. (1)."*

**The payment deadline inherits the gate:** alin. (15) pays „contribuția … **datorate**" — if alin. (2) says
none is owed, there is nothing to pay. **Confidence: high**; the gate itself is already corroborated by
`phases/05:76` and closed U-2.

---

## 5. Applicability — the code's unconditional `status: 'active'` is wrong

| Obligation | Every PFA with art. 68 income? | Conditions, cited |
|---|---|---|
| Income tax | **No** — annual only, and only if tax is due | art. 68 alin. (9)-(10) → art. 122 alin. (3); no tax when venit net anual impozabil ≤ 0 (art. 118, pierdere fiscală) |
| CAS | **No** | art. 148 alin. (1): only if cumulative annual income ≥ **12 SMMB**; alin. (2) base 12 or 24 SMMB; alin. (4) voluntary option below threshold. **Exempt:** art. 150 alin. (1) pensionari / asigurați în sisteme proprii → no CAS at all; art. 150 alin. (2) salariați for lit. b^1) |
| CASS | **No** | art. 174 alin. (2) pierdere fiscală / VNA = 0 → no CASS; alin. (6) 6-SMMB floor; alin. (7)-(8) no difference owed if ≥ 6 SMMB came from salarii/pensii/lit. c)-h) or the person was excepted under art. 154 alin. (1) lit. a), b), e), f); alin. (11) recalculation above 72 SMMB |

The CAS and CASS gates are **already verified by this repository** (U-5 closed in Phase 3 → art. 150 alin. (1);
U-2 closed in Phase 2 → art. 174 alin. (2), (6), (7)-(8)). So the code emits twelve unconditional `active`
deadlines for obligations that this project has already established are conditional.

---

## 6. Verdict on the code

| Rule in `deadlines.ts` | Cites | Verdict |
|---|---|---|
| `income_tax_advance` — 25 Mar/Jun/Sep/Dec, **art. 81** | art. 81 | **Obligation does not exist.** Art. 81 is payroll (`research/11` §2) and is cross-referenced **0** times in the CF. Art. 120/120^1 abrogated 01-01-2025. Real deadline: **25 May**, art. 68 alin. (10) + art. 122 alin. (3). **Delete the rule.** |
| `cas_quarterly` — 15 Apr/Jul/Oct/Jan, **art. 160** | art. 160 | **Obligation does not exist, and the cited article is `Abrogat.` since 01-01-2018** (OUG 79/2017 pct. 71, MO 885/10.11.2017). Real date: **25 May**, declarare *and* plată, art. 151 alin. (1). **Delete the rule.** |
| `cass_quarterly` — 15 Apr/Jul/Oct/Jan, **art. 170** | art. 170 | **Obligation does not exist, and art. 170 is a *baza de calcul* article containing no dates.** Real date: **25 May**, art. 174 alin. (15); gated by art. 174 alin. (2). **Delete the rule.** |
| `pfa_estimated_declaration` — start + 15 days, **art. 81** | art. 81 | **Already ruled a phantom by `research/11` §4** — basis abrogated 01-01-2025, duplicates the correct `d212_filing`. **Delete the rule.** |
| `vat_registration` — `month_end + 30 days`, **art. 338** | art. 338 | **Wrong for every period** (`research/11` §6). Current: due **on the day the plafon is exceeded** (art. 316 alin. (1) lit. b), OG 22/2025). **Fix the formula.** |
| `d212_filing` — fixed `2027-05-25`, art. 122(3) | art. 122(3) | **Correct as implemented.** This is the *only* real deadline of the six. |

**Net effect: 4 of the 6 deadline event types must be deleted, 1 must be corrected, 1 is correct.** On the
seeded dashboard that is **13 visible deadlines → 1**.

---

## 7. Gaps

1. **Former title of CF art. 120 / 120^1** — 312601 shows only `Abrogat.`; the pre-2025 text was not read
   from a primary source and is **not guessed**. To close: OUG 128/2024 art. I pct. 11 (MO 1125/11.11.2024)
   or an older CF consolidation. Not needed for any verdict here.
2. **art. 123 alin. (2)-(7) verbatim** — only the heading and alin. (1) were extracted. Not needed for the
   verdict (art. 123 is the annual article), **but this repo should stop attributing the payment date to
   art. 123 alin. (1)**: `phases/02:374` says „Payment side: art. 123 alin. (1)" and
   `package2026.ts` `PFA_DEADLINE_2026` carries `payment art. 123 alin. (1)`. alin. (1) is the **rate**
   provision; the payment provision is **art. 68 alin. (10) → art. 122 alin. (3)**.
3. **CPF doc 304520 not reached in this pass** — not required for these three obligations. `research/11` §5
   already read CPF art. 82 alin. (6) lit. c) from it.
4. **„26 mai 2026"** appears in a secondary source (AGERPRES). **Unverified — no prorogation found in
   doc 312601. Do not encode 26 May.** CF art. 122 alin. (3) says 25 May.

## 8. Pending, not law — must not be encoded

- A **Ministerul Finanțelor draft** („privind instituirea unor măsuri de relansare economică…", published for
  debate ~Feb 2026, **no PL number captured**) proposes a **3% bonificație** if impozit + CAS + CASS on 2025
  income are paid and the DU filed **by 15 April 2026**. Secondary sources only (AGERPRES, Universul Juridic).
  **No draft reintroduces quarterly instalments.** The 15 April date must not be encoded — it is the single
  most likely source of a future recurrence of this exact error, because it *looks* like a quarterly deadline.
- PL 204/2026 (VAT registration, 3 working days) — see `research/11` §7.
