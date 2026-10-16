# 10 — Art. 80 negative finding + payment-timing basis (2026)

**Researcher pass: 2026-10-06, commissioned for Phase 9 (payment / collection dates).**
Method and citation standard per `docs/ai/phases/02_fiscal_baseline.md` §11.

> **Status of this document.** It is a *research* record, not a fiscal baseline. The baseline of record
> remains `phases/02_fiscal_baseline.md`. What this document adds is one **negative** finding and two
> **caveats**. Nothing here changes a rate, base or threshold.

---

## 1. The headline: the "15-day collection threshold" does not exist

The Phase 9 brief was drafted on a premise that the Researcher **falsified**: that CF art. 80 is a
"pragul de încasare a creanțelor" making an expense non-deductible if paid more than 15 days after its
due date.

**That rule is not in the Cod fiscal.**

- **Art. 80 CF is titled „Termenul de plată a impozitului"** and sits in **Titlul IV, Cap. III — venituri
  din salarii și asimilate salariilor**. It is a **payroll income-tax payment deadline** rule (25th of the
  following month; 25th of the month after the quarter for the categories in alin. (2)). It says nothing
  about the PFA's own expenses.
- **Full-text evidence** (consolidated CF, doc 312601, 2,535,020 chars):
  - `"15 zile calendaristice"` → **0 hits**
  - `"prag de încasare"` / `"încasare a creanț"` → **0 hits**
  - `"Reguli privind deducterea"` → **0 hits**
  - `"scadență"` co-occurring with `"deductib*"` → **2 hits**, both in **Titlul II art. 45 alin. (1)**, a
    transitional 2005 instalment-sale rule — not a payment threshold
  - `"nu sunt deductibile"` → **1 hit**, art. 25 (Titlul II non-deductible list)
  - `"anului în cursul căruia au fost plătite"` → **exactly 1 hit: art. 68**
- Cross-checked against **ANAF's consolidated CF including HG 1/2016 methodological norms**
  (3,683,337 chars): `"de la scadență"` → **0 matches**; `"nu sunt deductibile dacă"` → **0 matches**;
  `"15 zile"` → 42 matches, the only contextualised one being **art. 4 alin. (3)** of the norms (minimum
  15 days before an ordonanţă enters into force).

**Confidence: HIGH.**

### Why this matters to the codebase

`src/domain/tax.ts:112` deducts every recorded expense unconditionally
(`deductibleBase = inputs.vatExempt ? expenses : expensesNet`). **That is not a bug on the ground it was
suspected of.** There is no late-payment disallowance to implement. A future Worker must not manufacture
one. This is the same class of finding as Phase 3's removal of `CAS_MAX_BASE` — CF art. 148 alin. (2)
sets floors and **no** CAS ceiling (`thresholds.ts:79-87`). **Absence of a provision is a finding.**

---

## 2. What *does* make payment timing load-bearing: art. 68

Already recorded in the baseline (`phases/02_fiscal_baseline.md:189-194, 205`), restated here because it
is the actual legal basis for Phase 9's date fields.

- **Expenses — art. 68 alin. (4) lit. b)**, verbatim: *„să fie cuprinse în cheltuielile exercițiului
  financiar al anului în cursul căruia au fost plătite"*. The expense belongs to the financial year **in
  which it was paid**. No amendment note on this lit. → as originally enacted (MO 688/10.09.2015, in
  force 01.01.2016). **Confidence: HIGH.**
- **Revenue — art. 68 alin. (2) lit. a)**: venit brut is measured by **„sumele încasate"** — amounts
  **collected**. Phase 2 already flagged this as a forward dependency for Phase 9.
- **Consequence of lit. b) is attribution, not punishment.** A late-paid expense is not permanently
  non-deductible; it falls into the year of payment. **Timing consequence, not a fine.**
- **The invoice issue date is not a timing gate.** Art. 68 alin. (4) lit. a) requires expenses be
  *„justificate prin documente"* — the invoice is the justificativ, but its issue date does not determine
  the year. **So for sistem real under art. 68: `paid` / `collected` is fiscally load-bearing; `issued`
  is not.** That is the single most consequential sentence in this document for Phase 9's design.

---

## 3. Art. 80 does reach a PFA — but only as an *employer*

Art. 80 alin. (2) lit. d) expressly names *"persoanele fizice autorizate și întreprinderile individuale,
precum și persoanele fizice care exercită profesii liberale … care au, potrivit legii, personal angajat pe
bază de contract individual de muncă"* — such payers remit withheld payroll tax **quarterly** rather than
monthly.

**Boundary:** the app's `salaryStatus` / `salaryIncomeLei` describe the **owner's** salary, not employees.
The app models no payroll, so art. 80 alin. (2) lit. d) is currently out of scope. If payroll is ever
modelled, this is the provision that makes the PFA a quarterly remitter. **Confidence: HIGH.**

---

## 4. Art. 120 abrogation — confirmed, and the repo already knew

Art. 120 CF and art. 120¹ are `Abrogat` from **01.01.2025** (OUG 128/2024 pct. 11 Art. I, MO 1125/11.11.2024),
confirmed independently in Portal Legislativ doc 312601 and ANAF's consolidated CF. Sistem-real net income
is determined under **art. 68 alin. (1)**, itself amended for 2026 by **Punctul 4, Articolul XII din
Legea 239/2025, MO 1160/15.12.2025**.

**No correction needed:** `phases/05_income_tax.md:64,153,318` and `phases/06_fiscal_profile.md:40` already
record art. 120 as abrogated, and `phases/02_fiscal_baseline.md:187` already records Legea 239/2025's
amendment of art. 68 alin. (1). The false premise lived in the **commissioning prompt**, not in the
repository.

---

## 5. No 2026 act touched art. 80 — method stated, not assumed

Per the baseline's §8.1/§11 method: read the acts directly, because a consolidated text can lag the
amending act.

1. Doc 312601's art. 80 block carries **exactly one** amendment note, dated **03-01-2016** (Legea 358/2015,
   MO 988/31.12.2015, completing OUG 50/2015 with pct. 11^1). No note dated 2023-2026.
2. Portal Legislativ's "Forme act" list: newest historical consolidated form **01.07.2026 (doc 311622)**;
   doc 312601 is the later current form (baseline dates it 08.08.2026); **no CF consolidated form after
   01.07.2026 is listed**.
3. Every 2026 CF-amending act in the register was read directly and grepped for `art. 80` / `articolul 80`:

   | Act | MO | chars scanned | hits |
   |---|---|---|---|
   | ORDONANȚA nr. 6/2026 | MO 77/30.01.2026 | 11,924 | **0** |
   | OUG nr. 7/2026 | MO 146/25.02.2026 | 341,323 | **0** |
   | OUG nr. 8/2026 | MO 147/25.02.2026 | 104,114 | **0** |
   | OUG nr. 9/2026 | MO 157/27.02.2026 | 43,140 | **0** |
   | OUG nr. 13/2026 | MO 181/09.03.2026 | 19,599 | **0** |
   | OUG nr. 38/2026 | MO 393/08.05.2026 | 41,311 | **0** |
   | OUG nr. 89/2025 (pct. 9-51 in force 31.03.2026) | MO 1.203/24.12.2025 | 144,850 | **0** |

4. ANAF's consolidated CF states *"ultima actualizare: ORDONANȚĂ DE URGENȚĂ nr. 38/2026"*.

**Confidence: HIGH for the negative.**

### Explicitly unresolved

- **Legea 170/2026** (MO 648/05.08.2026, TollRo/STRR) — **not read**; the ANAF PDF 404'd.
- **HG 146/2026** (MO 196/13.03.2026) — not read. A hotărâre cannot amend the law; it sets the minimum wage.
- **Legea 239/2025** — not read directly, only via amendment notes.
- **Any CF amendment published after 08.08.2026** is not enumerated by any source reached. This is the
  standing consolidated-text-lag caveat from `phases/02` §11 and it still applies.

---

## 6. Two caveats to carry forward

**C-1 — Do NOT render CPF citations to end users yet.** The Codul de procedură fiscală (Legea 207/2015)
copy reached at Portal Legislativ doc 172697 is headed *"actualizat la data de 1 ianuarie 2016"* — a
**stale form**. Article numbers and titles are almost certainly current, but **CPF art. 173 alin. (1)**
(accesorii for late payment of fiscal obligations) and **CPF art. 336 alin. (1) lit. o)/p)** (retention
contraventions) **must be re-verified against the current CPF consolidation before appearing in the UI**.
The specific fine amounts for lit. o)/p) were **not** captured. This app renders citations to users;
a stale citation is worse than a missing one.

> **Superseded in part on 2026-10-07 by `research/11` §1.** A **current** CPF consolidation exists at Portal
> Legislativ doc **304520** (828 amendment notes, latest 18-12-2025), and `research/11` §5 reads CPF art. 82
> alin. (6) lit. c) from it. The blanket prohibition is therefore lifted **for provisions read from 304520**.
> Doc 172697 remains stale and unusable, and art. 173 alin. (1) / art. 336 alin. (1) lit. o)/p) are still
> unverified in their current form — the fine amounts were never captured.

**C-2 — CF art. 124 is not "accesorii".** It is *„Venituri din bunuri sau drepturi care sunt deținute în
comun"* (Titlul IV, Cap. V). Accesorii are governed by the CPF, not by CF art. 124. The Cod fiscal itself
contains **no** `"majorări de întârziere"` text. This corrects a claim made in the commissioning prompt;
the repository does not currently cite art. 124 anywhere.

---

## 7. Sources

**Kept (primary, citable):**
- Portal Legislativ — Cod fiscal (Legea 227/2015), consolidated **doc 312601**, current form —
  <https://legislatie.just.ro/Public/DetaliiDocument/312601> — art. 80 verbatim; art. 68 alin. (1), (2),
  (4); art. 120/120¹ abrogation; all amendment notes; consolidation-form list.
- ANAF — consolidated Cod fiscal + HG 1/2016 norms —
  <http://static.anaf.ro/static/10/Anaf/legislatie/Cod_fiscal_norme_2023.htm> — independent confirmation of
  art. 80's identity and text, art. 120 as `ABROGAT`, and "ultima actualizare: OUG 38/2026".
- ANAF PDFs of the 2026 amending acts listed in §5 — direct amendment-list reads.
- Portal Legislativ — Codul de procedură fiscală (Legea 207/2015), doc 172697 —
  <https://legislatie.just.ro/Public/DetaliiDocument/172697> — **stale form, flagged in C-1**.

**Dropped** (pointed toward primaries, never used as citations of record): noulcodfiscal.ro,
contabilul.manager.ro, ioisrl.ro, pfa.whd.ro, legislatie.info, cauta.ro, financiarul.ro, pandectele.ro,
fiscalitatea.ro, legislatie.legalapi.ro, cdep.ro (pre-2015 code).

**Not authoritative and not used:** `docs/ai/research/06_2026_fiscal_research.md`,
`docs/ai/decisions/09_IMPLEMENTATION_ARCHITECTURE.md`.
