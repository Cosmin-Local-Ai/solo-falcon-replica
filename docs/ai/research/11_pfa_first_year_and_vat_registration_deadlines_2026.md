# 11 — PFA first-year declaration & VAT registration deadlines (verified 2026-10-07)

Researcher pass commissioned to settle **B-22**: the legal basis of the two event-relative deadlines in
`src/domain/deadlines.ts`. It ran 2026-10-07, 27 min. This file is the record of what it established.

**Provenance note, stated up front.** The Researcher's *first* draft contained fabrications, which it then
re-checked and retracted itself (art. 81 mis-titled, art. 120's abrogation act mis-stated, art. 174 and
art. 119 mis-described, a 300.000/240.000 pair that does not exist, and several ANAF quotes that could not be
reproduced). Everything below is from the **corrected** pass. Confidence is graded per claim, and the two
claims that the repository independently corroborates are marked as such — those are the load-bearing ones.

**I could not re-verify the primary text myself:** `curl` of Portal Legislativ returns **HTTP 403** from this
environment, and per instruction no further searching was done from the orchestrator side. So the legal
claims rest on the Researcher's reading of the cited consolidations, cross-checked against the repo's own
verified baseline wherever the two overlap.

---

## 1. Consolidations used, with currency (this is the part that matters most)

| Document | ID | Currency evidence |
|---|---|---|
| Codul fiscal (Legea 227/2015), MO 688/10.09.2015 | **doc 312601** | 2,021 amendment notes, latest note dated **08-08-2026** |
| Cod de procedură fiscală (Legea 207/2015) | **doc 304520** | 828 notes, latest **18-12-2025** |

Dropped: **doc 172697** — headed *"actualizat la data de 1 ianuarie 2016"*, the stale form that produced the
earlier citation errors. Also dropped: `FormeDocument/312601` (`ERR_TOO_MANY_REDIRECTS`),
`platiteonline.anaf.ro` (`ERR_TUNNEL_CONNECTION_FAILED`), and every advisory/commercial site (used only to
locate provisions, never as source of record).

> **This supersedes caveat C-1 in `research/10`.** That caveat said the CPF copy reached was a stale 2016
> form and that CPF citations must not be rendered. A **current** CPF consolidation exists at
> **doc 304520** (828 notes to 18-12-2025). The blanket "no CPF citations" instruction is therefore lifted —
> but only for provisions read from 304520, and the caveat stays in force for 172697.

---

## 2. Art. 81 CF is payroll. The `start_date + 15 days` rule has no basis.

Verbatim, doc 312601:

> *„Articolul 81 — **Obligații declarative ale plătitorilor de venituri din salarii** | (1) Plătitorii de
> salarii și de venituri asimilate salariilor au obligația să completeze și să depună Declarația privind
> obligațiile de plată a contribuțiilor sociale, impozitului pe venit și evidența nominală a persoanelor
> asigurate … până la termenul de plată a impozitului, inclusiv."*

This **confirms the `research/10` §1 finding by adjacency**: art. 80 is „Termenul de plată a impozitului" and
art. 81 is the declarative obligation of the *same* payroll chapter (Titlul IV, Cap. III). Neither has
anything to do with a PFA's own first declaration.

**Negative finding.** Every `15 zile` occurrence in the 1.6 M-char consolidation is elsewhere: art. 4 alin. (3)
(minimum *vacatio* for ordonanțe), art. 16 (an fiscal modificat), grup fiscal, art. 147 alin. (18)/(19)
(garanție). **`start_date + 15 days` has no primary basis for a PFA.**

## 3. The estimated declaration is dead — art. 120 CF is „Abrogat"

Verbatim, doc 312601:

> *„Articolul 120 | **Abrogat.** | (la 01-01-2025, Articolul 120, Capitolul XI, Titlul IV a fost abrogat de
> Punctul 11., Articolul I din ORDONANȚA DE URGENȚĂ nr. 128 din 7 noiembrie 2024, publicată în MONITORUL
> OFICIAL nr. 1125 din 11 noiembrie 2024)"*

**Corroborated by this repository, independently.** `phases/06_fiscal_profile.md:40` already records:
*„CF art. 120 — **Abrogat** (OUG 128/2024 pct. 11 Art. I, MO 1125/11.11.2024, eff. 01.01.2025)"*, and
`phases/05_income_tax.md:64` says the same. Same article, same punct, same act, same MO, same effective date.
**Confidence: high.** (The Researcher's earlier draft claimed 01.01.2026 / OUG 151/2025 — that was false and
is retracted; the repo's version was right all along.)

## 4. What a new PFA actually files — and the repo already implements it correctly

> *„Articolul 122 — Declarația unică … (2) Declarația unică … se depune **și în cazul în care în cursul
> anului fiscal contribuabilii prevăzuți la alin. (1) încep sau încetează o activitate**, potrivit legii …
> (3) Declarația unică … se completează și se depune … pentru fiecare an fiscal, **până la data de 25 mai
> inclusiv a anului următor** celui de realizare a veniturilor. **Prevederea se aplică și în situațiile
> prevăzute la alin. (2).**"*

So a PFA opened during 2026 owes its income-tax return by **25.05.2027**, and there is **no start-of-year
filing term**.

**The repository already has this rule, correctly.** `PFA_DEADLINE_2026` (`package2026.ts`) carries
`deadline = '2027-05-25'` with `sourceArticle: 'art. 122 alin. (3); payment art. 123 alin. (1)'`, and
`computeDeadlines` emits it as `d212_filing` (`deadlines.ts:95-113`). **Confidence: high** — the Researcher's
answer and the shipped rule agree.

**Consequence: `pfa_estimated_declaration` is not a miscitation to repair, it is a phantom.** It implements an
obligation whose legal basis was abrogated on 01.01.2025, and it **duplicates** a correct rule that already
exists. It is labelled in the UI as *„Declarație estimativă PFA"* (`ActionSection.tsx:36`, `insights.ts:56`,
`DeadlineSection.tsx:47`), so the app offers the user a deadline for a declaration that no longer exists.

## 5. The one genuine "new PFA" onboarding deadline is in the CPF, and it is 30 days

> *„Articolul 82 — Obligația de înregistrare fiscală … (6) Declarația de înregistrare fiscală se depune în
> termen de **30 de zile** de la: … c) **data începerii activității** pentru persoanele fizice care
> desfășoară activități economice în mod independent sau exercită profesii libere, cu excepția celor care se
> înregistrează, potrivit legii speciale, la registrul comerțului"* — doc 304520, alin. (6) last amended by
> OUG 30/2017, MO 708/31.08.2017.

This is the only verified deadline that actually *runs from a PFA start date*. If the app wants a
start-date-driven deadline, **this** is the one, and it is a CPF fiscal-registration obligation, not a tax
filing. **Confidence: medium-high** — read from a current consolidation, but not corroborated by the repo,
which has no CPF rule at all.

## 6. VAT registration: the deadline is the day of exceedance. It was never 30 days.

Current text, art. 316 alin. (1) lit. b), doc 312601:

> *„… trebuie să solicite înregistrarea în scopuri de TVA la organul fiscal competent … b) dacă în cursul
> unui an calendaristic depășește plafonul de scutire prevăzut la art. 310 alin. (1), **cel târziu la data
> depășirii plafonului**"*
> — with the note: *„(la 01-09-2025, Alineatul (1), Articolul 316 … a fost modificat de Punctul 18., Articolul
> I din ORDONANȚA nr. 22 din 28 august 2025, MO nr. 806 din 29 august 2025)"*

Registration then **takes effect from that same day** — art. 316 alin. (1^1) lit. b), inserted by Pct. 19 of
the same OG 22/2025: *„data depășirii plafonului de scutire prevăzut la art. 310 alin. (1) …"*.

The ceiling is unchanged from Phase 2's finding: art. 310 alin. (1) *„…cifră de afaceri anuală, declarată sau
realizată, **nu depășește plafonul de 395.000 lei**…"*.

**The `month_end + 30 days` formula never existed.** String counts in the current consolidation:
`30 de zile de la sfârșitul lunii` → **0**; `sfârșitul lunii calendaristice în care` → **0**;
`plafonul de bază de înregistrare` → **0** (the term was replaced by „plafonul de scutire prevăzut la art. 310
alin. (1)"); `cel târziu la data depășirii plafonului` → **2**.

The **historical** rule was **10 days from month end**, not 30: ANAF (București)
<https://static.anaf.ro/static/10/Bucuresti/Inreg_TVA_PJ.pdf> — *„Termen pentru solicitare – 10 zile de la
sfârșitul lunii în care a atins sau a depășit acest plafon"* (300.000 lei), and the Senate's official
*expunere de motive* for **PL 204/2026** <https://www.senat.ro/legis/PDF/2026/26L204EM.PDF> quotes the old and
new wording side by side. The consolidation's own transitional notes confirm an August-2025 exceedance had to
be registered *„cel târziu în data de 10 septembrie 2025"* — the old 10-day mechanic.

**Confidence: high for the current rule** (primary text + the amendment note + the repo's own art. 310
finding). **Medium for the pre-01.09.2025 text** — see Gap 1.

## 7. Pending, not law — do not encode

**PL 204/2026** (senat.ro) proposes a *„termen de cel mult 3 zile lucrătoare de la data depășirii plafonului"*.
A bill. Re-check before the 2027 ruleset.

---

## 8. What this does to the code

| Rule today | Verdict | Basis |
|---|---|---|
| `pfa_estimated_declaration` — `start_date + 15 days`, art. 81 | **Remove.** Wrong article, wrong period, and the obligation itself is abrogated. The correct obligation is already shipped as `d212_filing`. | art. 81 = payroll declarants; art. 120 Abrogat 01.01.2025 (OUG 128/2024 pct. 11, MO 1125/11.11.2024); art. 122 alin. (2)-(3) |
| `vat_registration` — `month_end + 30 days`, art. 338 | **Wrong for every period.** Current: deadline **is** the exceedance date. Historical (≤ 31.08.2025): `month_end + 10 days`, ceiling 300.000. Never 30. | art. 316 alin. (1) lit. b) + alin. (1^1) lit. b), as amended by OG 22/2025 pct. 18–19, MO 806/29.08.2025; art. 310 alin. (1) |
| `d212_filing` — fixed `2027-05-25`, art. 122(3) | **Correct as implemented.** No change. | art. 122 alin. (3) |
| `income_tax_advance` — `25th of March/June/Sept/Dec`, **art. 81** | **Not covered by this pass — and suspect.** It cites the *same* payroll article. The repo already flags these quarterly instalment dates as **U-4 UNVERIFIED** in `PFA_DEADLINE_2026`'s own comment. | open — see §9 |
| `cas_quarterly` (art. 160) / `cass_quarterly` (art. 170) | **Not covered.** CAS/CASS *amount* citations were corrected in Phases 3–4 (art. 148/150, art. 170/174); the *payment-deadline* articles here were never re-verified, and sit in the same U-4 gap. | open — see §9 |

Note the shape of the failure: **Phase 9's `pfaStartDate` wiring feeds a rule that should not exist.** The
wiring and the `pfaStartDate` / `vatExceedanceMonth` split were right — they prevented a fabricated VAT
deadline — but the rule at the end of the wire is a phantom. That is not the Worker's error; the brief pointed
it at a rule nobody had re-verified.

## 9. Gaps and the next research question

1. **Pre-01.09.2025 text of art. 316 alin. (1) lit. b)** was not readable from a primary consolidation
   (Portal Legislativ exposes only the current form; `FormeDocument` redirect-loops). Corroborated by two
   official documents (ANAF page + Senate *expunere de motive*). Acceptable, but flag it as secondary if the
   historical rule is ever encoded.
2. **ANAF operational deadlines** (DU / e-Factura onboarding, calendar fiscal 2026) unverifiable from this
   network.
3. **RO e-Factura obligation for a newly opened PFA** (art. 319¹ CF / OUG 120/2021 as amended) not read from a
   current consolidation — do not encode.
4. **NEW, raised by the orchestrator, not by the Researcher:** `income_tax_advance`, `cas_quarterly` and
   `cass_quarterly` all carry payment-deadline articles that this project has never verified, and
   `income_tax_advance` shares the now-discredited **art. 81**. This is the same failure mode that produced
   B-22, in three more rules. **Q-DEADLINE-QUARTERLY** should be opened before any of those three dates is
   presented as authoritative — and note that `PFA_DEADLINE_2026`'s own source comment already carries this as
   **GAP U-4 (UNVERIFIED)**, so the repo knew.
