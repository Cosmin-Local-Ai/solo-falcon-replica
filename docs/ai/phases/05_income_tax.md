# Phase 5 — Income tax: CF art. 118 sistem real, 2026

**Scope:** the Titlul IV sistem-real income-tax path — the regime gate, the composition of
*venitul net anual impozabil*, the fiscal-loss treatment, and the dead data hanging off the
income-tax rule. **Defects closed: B-1, B-13, B-14, B-15, B-16**, plus the leftovers named in
**B-4** (the stale 16% NOTE string) and **B-6** (`multiple_6x/12x/24x/72x`). Date: **2026-10-06**.

> **Supersession line.** For income-tax behaviour this file supersedes every statement about
> `tax.ts` in the frozen `docs/ai/steps/` archive — including the "30% deductible-expense cap"
> framing that Phase 2 already proved phantom. The fiscal baseline stays
> `phases/02_fiscal_baseline.md`; CAS stays `phases/03_cas.md`; CASS stays `phases/04_cass.md`.

---

## 1. Legal basis (verbatim, 2026 income year)

Source of record: **Cod fiscal, consolidated 08.08.2026, doc 312601**
(<https://legislatie.just.ro/Public/DetaliiDocument/312601>). Verbatim text with amendment notes:
`docs/ai/research/08_art118_income_tax_2026.md` (Q118-A/B/C/D).

> **TRAP — the stale consolidation.** Portal Legislativ doc **200491** carries a pre-2024 art. 118:
> it says **„7 ani"**, deducts **CAS only**, and has **no alin. (2^1)–(2^4)**. Any quote with those
> marks came from 200491 and is wrong for 2026. (Detection rule, `research/08` line 22.)

- **art. 123 alin. (1)** — „…prin aplicarea cotei de **10%** asupra venitului net anual impozabil
  determinat potrivit art. 118." Legea 239/2025 amends art. 123 only at alin. (1^2) and alin. (2),
  neither of which reaches a PFA in sistem real (`research/09` §5).
- **art. 118 alin. (2)** — „Pentru veniturile prevăzute la art. 61 lit. a), pentru care venitul net
  anual se determină în sistem real … contribuabilul stabilește:"
  - **lit. a)** „venitul net anual recalculat/pierderea netă recalculată pe fiecare sursă … prin
    deducerea din venitul net anual, determinat în sistem real, a pierderilor fiscale reportate;"
  - **lit. b)** „venitul net anual impozabil care se determină prin însumarea tuturor veniturilor
    nete anuale, recalculate, prevăzute la lit. a), din care se deduc contribuția de asigurări
    sociale și contribuția de asigurări sociale de sănătate datorate potrivit prevederilor titlului
    V, **cu excepția diferenței de contribuție de asigurări sociale de sănătate prevăzută la art.
    174 alin. (6)**." *(lit. b) modified by OUG 128/2024 pct. 10 Art. I, MO 1125/11.11.2024, eff.
    01-01-2025 — this carve-out is what makes B-13 a defect rather than a design choice.)*
- **art. 118 alin. (2^1)** — the parallel rule for art. 61 lit. **a^1)**, which deducts **CAS only,
  no CASS**. Not the app's case (a PFA with activități independente is art. 61 lit. a)); recorded so
  nobody "harmonises" the two branches.
- **art. 118 alin. (2^2)** — „Contribuția de asigurări sociale deductibilă … se stabilește
  proporțional cu ponderea venitului net anual determinat în sistem real în total venituri cumulate
  potrivit prevederilor art. 148 alin. (3), aplicată asupra contribuției de asigurări sociale
  calculate potrivit art. 151 alin. (1)."
- **art. 118 alin. (2^3)** — same construction for CASS, over „total venituri cumulate potrivit
  prevederilor art. 170 alin. (1)", applied to „contribuția … calculată potrivit art. 174 alin. (1)".
- **art. 118 alin. (2^4)** — „Nivelul contribuției de asigurări sociale și al contribuției de
  asigurări sociale de sănătate deductibile … **nu poate depăși nivelul venitului net anual
  recalculat**." *(introdus de Legea 296/2023 pct. 15 Art. III, eff. 01-01-2024.)*
- **art. 118 alin. (3)** — „Veniturile din categoriile prevăzute la art. 61 lit. a), a^1), c) și f),
  ce se realizează într-o fracțiune de an … se consideră venit anual." — **this is NOT a
  „not-less-than-zero" rule**; the zero floor people look for here is alin. (2^4).
- **art. 118 alin. (4)** — „Pierderea fiscală anuală înregistrată pe fiecare sursă din activități
  independente … determinată în sistem real, se reportează și se compensează de către contribuabil
  **în limita a 70% din veniturile nete anuale, obținute din aceeași sursă de venit în următorii 5
  ani fiscali consecutivi**." *(modificat de OUG 115/2023 pct. 70 Art. LIII, MO 1139/15.12.2023 —
  the period was shortened from 7 to 5 years.)*
- **art. 118 alin. (5)** — reportul se face **cronologic**, pe **5 ani** consecutivi; dreptul la
  report este **personal și netransmisibil**; pierderea necompensată la expirarea perioadei este
  **pierdere definitivă**.
- **art. 118 alin. (7)** — the same 70% / 5-year / same-source limit for losses from străinătate.
- **A PFA cannot be a Titlul II (impozit pe profit) taxpayer.** art. 13 alin. (1), art. 14 and
  art. 15 each confine impozitul pe profit to **persoane juridice**, and the vehicle that once let
  an individual opt in — **art. 120 CF — is „Abrogat"** (OUG 128/2024 pct. 11 Art. I, MO
  1125/11.11.2024, eff. 01-01-2025). Settled; do not re-litigate.
- **No 16% component here.** art. 115 alin. (1) lit. b) applies 16% only to art. 114 alin. (2) lit.
  h)/i) „alte venituri", and art. 114 alin. (1) confines that category to incomes *not* under art.
  61 lit. a)–h). PFA sistem real income is art. 61 lit. a) / art. 68 → flat 10%.
- **No 30% deductible-expense cap exists inside sistem real** (Q-30PCT-CAP: the only 30% in Titlul
  IV is art. 68^3 alin. (2), the forfetar switch — outside sistem real).
- **CASS rate 10%** — art. 156 (OUG 79/2017 pct. 69 Art. I, eff. 01-01-2018). **16% CASS is the
  pre-2018 rate and must never reappear.** CASS ceiling: art. 170 alin. (1) „…nu poate fi mai mare
  decât cea corespunzătoare unei baze anuale de calcul egale cu nivelul de **72 de salarii minime
  brute pe țară**" (291,600 lei for 2026).
- **art. 174 alin. (6)** — the difference up to the 6-SM floor „se calculează și se datorează până la
  data de 25 mai inclusiv al anului următor". **art. 174 alin. (2)** — a zero/loss net year owes no
  CASS at all.
- **art. 174 alin. (8)** — „…persoana fizică poate opta pentru ca cheltuiala deductibilă pentru
  calculul impozului … să fie egală cu contribuția de asigurări sociale de sănătate datorată pentru
  anul de impozitare. Opțiunea produce efecte pentru tot anul de impozitare."; **art. 180 alin.
  (1)/(2)** — the election is exercised „până la data de 25 mai inclusiv a anului următor celui de
  realizare a venitului". Verbatim in `research/09` §2–3. **Not implemented — see §5.**
- **Amendment screen:** no 2025–2026 act touches art. 118; only Legea 239/2025 touches art. 123
  (alin. (1^2), (2)). U-8 is CLOSED: OUG 89/2025 and OUG 8/2026 touch none of art. 154/170/174/180
  (`research/09` §1).

---

## 2. The computation as implemented

`src/domain/tax.ts::computeTaxEstimate` now runs the statute's own order, with each step a named
intermediate and each step emitted as a calculation line:

```
regime gate          inputs.regime must be 'impozit_pe_venit', else REVIEW_REQUIRED (data integrity)
venit brut           = vatExempt ? revenues : revenuesNet
cheltuieli           = vatExempt ? expenses : expensesNet
venit net            = venit brut − cheltuieli                 [art. 68 / art. 118 alin. (2)]
venit net recalculat = venit net − pierderi fiscale reportate   [art. 118 alin. (2) lit. a)]
CAS deductibilă      = ratioCas × CAS datorată                  [art. 118 alin. (2^2)]
CASS deductibilă     = ratioCass × (CASS datorată − diferența art. 174 alin. (6))
                                                              [art. 118 alin. (2) lit. b) + (2^3)]
plafon (2^4)         deduceri reținute = min(deduceri calculate, max(0, venit net recalculat))
venit net impozabil  = venit net recalculat − deduceri reținute [art. 118 alin. (2) lit. b)]
impozit              = 10% × venit net impozabil                [art. 123 alin. (1)]
totalDue             = CAS + CASS + impozit                     (unchanged)
```

with `ratioCas = VNA_sistem_real ÷ total_venituri_cumulate_art148_alin3` and
`ratioCass = VNA_sistem_real ÷ total_venituri_cumulate_art170_alin1` — both exactly **1** while the
app models a single income source, so **the proration is a no-op today and the numbers do not
move**; it is written out so a second source (Phase 6) cannot silently inherit a full deduction.

The lines the engine emits, in order (these are the strings the tests pin):

| line label | article |
| --- | --- |
| `Venit brut` | art. 68 |
| `Cheltuieli deductibile` | art. 68 alin. (1) |
| `Venit net din activitate` | art. 118 alin. (2) |
| `CAS (25%)` / `CASS (10%)` | Titlul V amounts owed |
| `CAS deductibilă (art. 118 alin. (2^2))` | alin. (2^2) |
| `CASS deductibilă (art. 118 alin. (2^3), fără diferența art. 174 alin. (6))` | alin. (2) lit. b) + (2^3) |
| `Deduceri blocate de plafonul art. 118 alin. (2^4)` | alin. (2^4) — only when the cap bites |
| `Venit net anual impozabil (art. 118 alin. (2) lit. b))` | alin. (2) lit. b) |
| `Pierdere fiscală pe sursă (art. 118 alin. (2) lit. a))` | alin. (2) lit. a) — only in a loss year |
| `Impozit pe venit (rată de bază 10%)` / `Impozit pe venit (fără bază impozabilă)` | art. 123 alin. (1) |
| `Total taxe` | — |

Two points of law that are easy to get wrong and are now pinned by tests:

- **alin. (2^4) caps the *deduction*, never the liability.** When it bites, the contributions are
  still owed in full and only the deduction is blocked — the test asserts both the blocked amount
  and that `totalDue` is unchanged.
- **alin. (3) is not a zero floor.** The floor that exists is alin. (2^4); a negative *venit net*
  is a legal figure („pierderea netă recalculată") and must stay visible.

---

## 3. What changed, defect by defect

### B-1 / B-14 — the regime gate was inverted (CRITICAL)
`tax.ts:52-54` returned `review_required` for **`impozit_pe_venit`** — the *default* regime of every
profile (`profile.ts:41`, seed `impozit_pe_venit`) and the only regime this package exists for —
while computing happily under **`impozit_pe_cit`**, a regime for which **no rule exists in the
package at all**. The whole numeric income-tax suite was green because it exercised the unreachable
path. Concretely:

- the phantom-cap short-circuit is **deleted**;
- the engine computes for `impozit_pe_venit` (`tax.ts:78-80` is now the gate);
- `impozit_pe_cit` returns `REVIEW_REQUIRED` framed as a **data-integrity failure**, not „a
  different base applies": the message names art. 13 alin. (1), art. 14, art. 15 and the abrogation
  of art. 120 by OUG 128/2024 pct. 11 Art. I, and tells the user to check the recorded regime or the
  nature of the entity;
- the `tax.test.ts` fixtures (`makeProfile`, `makeInputs`) default to `impozit_pe_venit`, so **every
  numeric assertion now runs on the regime a real user lands on**;
- the Dashboard e2e switched from the em-dash/review state to the **computed** state, and a new e2e
  case pins the `impozit_pe_cit` refusal text in the UI.

### B-13 — CASS was deducted in full (HIGH)
`taxable = net − cas − cass` deducted the **whole** CASS, including the art. 174 alin. (6) top-up
that lit. b) expressly carves out. `calcCass` already reports that difference as
`nonDeductible` (Phase 4), so the fix consumes it:

```ts
cassNonDeductibila = cassRes.nonDeductible ?? 0
const cassDeductibila = Math.max(0, ratioCass * (cassValue - cassNonDeductibila))
```

The CASS **amount owed** is unchanged — only the base shrinks less, so tax goes **up** in the
`0 < VNA < 6 SM` band (it was understated). Pinned by the net-20,000 test in §4.

### B-15 — the deduction was neither prorated nor capped (HIGH, latent)
`tax.ts` subtracted both contributions in full. Now alin. (2^2) and alin. (2^3) are written as
explicit ratios over the art. 148 alin. (3) / art. 170 alin. (1) cumulative bases, and alin. (2^4)
caps the combined deduction at the recalculated net, with the blocked excess emitted as its own
line. **No number moves today** — that is the test (§4): a single-source PFA has ratio = 1, and the
cap is only reachable by patching a rate, which is how the test proves the mechanism exists.

### B-16 — fiscal losses were silently discarded (HIGH)
The old `Math.min(deductibleBase, gross)` clamp forced the net to stay ≥ 0, which made a fiscal loss
**unrepresentable**: an expense-heavy year came out as „no tax, no loss" and the loss was thrown
away. The clamp is gone, because art. 118 alin. (2) lit. a) names „pierderea netă recalculată pe
fiecare sursă" as a figure the taxpayer must determine. Now:

- a negative net produces a **negative `venit net recalculat`**, not a silent zero;
- the year stays `status: 'computed'` — a loss is a fact, not a review item — and `totalDue` stays
  the contributions actually owed;
- the loss is surfaced as the line `Pierdere fiscală pe sursă (art. 118 alin. (2) lit. a))` **and**
  as a structured `lossCarryForward` on the result: `{ amount, years: 5, capPercent: 70,
  sameSourceOnly: true, rule: <verbatim art. 118 alin. (4) + alin. (5)> }`;
- **a zero net is not a loss** — no carry-forward is reported (separate test).

### B-4 leftover — the stale 16% NOTE string
`calcIncomeTax`'s breakdown carried a note asserting a „16% progressive surcharge … REVIEW_REQUIRED
for the surcharge portion". There is no second rate for art. 61 lit. a) / art. 68 income (art. 114
alin. (1), art. 115 alin. (1) lit. b)), so the note promised a review that no rule or parameter
supports. Removed; the breakdown now cites art. 123 alin. (1). The `progressive_rate: 16`
**parameter** itself was already deleted in Phase 2 — verified, not "re-fixed".

### B-6 leftover — `multiple_6x/12x/24x/72x`
Deleted from the `wage-reference` rule (`package2026.ts:32-41`). Verified by grep: **no reader
anywhere in `src/` or `e2e/`** — the only parameter of that rule any code reads is `reference`.
Each multiple equals `reference × n`, and every consumer that needs a multiple derives it at the
point of use (`calcCas`/`calcCass` compute their floors/ceilings as `base × rate` from their own
`min_base` / `tier2_base` / `max_annual_base`). Keeping five copies of one legal figure (HG
1506/2024: 4.050 lei) is the same second-source-of-truth drift Phase 3/4 removed for
`max_cas`/`min_cass`/`max_cass`. The multiples that **are** law (6/12/24/72 SM) stay as the named
parameters that carry them.

---

## 4. Numeric proof

**Behaviour-preserving (B-15 must not move single-source numbers).** Every pre-existing numeric
expectation in `tax.test.ts` still holds after re-pointing to `impozit_pe_venit`: 7,600 · 4,000 ·
20,435 · 69,370 · 78,114 · 24,478.20 (net 71,280) · 24,615 · 1,900 · 38,000 · 12,150 · 24,300 ·
29,160 · 24,478.39 (net 71,281).

**B-13, the `0 < VNA < 6 SM` band** (net 20,000; CAS 0 — below the 12 SM condition, art. 148 alin.
(1); CASS owed 2,430 = 10% × 6 SM, art. 174 alin. (6)):

| | CASS deductible | taxable | tax | total |
| --- | --- | --- | --- | --- |
| before (whole CASS deducted) | 2,430 | 17,570 | 1,757.00 | 4,187.00 |
| after (alin. (6) difference excluded) | 2,000 | 18,000 | 1,800.00 | **4,230.00** |

**alin. (2^4) cap** (synthetic: CAS `rate` patched to 100, net 50,000 → CAS 48,600 + CASS 5,000 =
53,600 deductions): capped at 50,000, `Deduceri blocate…` = 3,600, taxable 0, tax 0, and
**`totalDue` stays 53,600** — the cap limits the deduction, not the liability.

**Seed dashboard (the number a user sees).** Seed net = **7.494,50** lei (revenues 4.500 + 3.200 −
expenses 120 + 85,50, all `inregistrata`), inside the same band: CASS owed 2.430, deductible
**749,45**, taxable **6.745,05**, tax **674,505 lei exactly — a half-cent**, **total 3.104,505 lei**,
displayed as **3.104,51** (was 2.936,45 before B-13 — the tax was understated by 168,06 lei). Pinned
by `e2e/dashboard.spec.ts:68-75,132` and the `Rezervă lunară` / `Rămâne de pus deoparte` derivations
at `:154-157`.

> **That displayed cent is not a rule — see defect B-17.** The exact decimal answer is a half-cent
> (674,505). `0.10 × 6745.05` lands on the double `674.5050000000001`, while the algebraically
> identical `0.09 × 7494.5` and `6745.05 / 10` land on the double whose shortest form is `674.505`
> (true value 674.504999999999995…). `Intl.NumberFormat` in `src/lib/format.ts:6-9` renders both as
> `674,51`, but `toFixed(2)` renders the second group as `674.50`. Nothing in the fiscal domain
> decides this; the cent is a side-effect of binary representation plus whichever formatter is used.
> Phase 10 owns the representation and the rounding policy; Phase 8 owns making the amount semantics
> explicit. **No policy was invented here.**

---

## 5. Deliberately NOT implemented, and why

| Not implemented | Why | Where it goes |
| --- | --- | --- |
| **Persisting a prior-year loss / reading reported losses back in.** `pierderiReportate` is a named 0 term. | The store is `getFiscalState(year)` for the current year only; there is no prior-year read path and no persisted-schema `version`. Writing a store side-effect from a pure domain function would have invented a persistence layer — explicitly out of scope. The **rule** (5 ani / 70% / aceeași sursă / pierdere definitivă) and the **amount** are surfaced; only the storage is missing. | **Phase 7** (identity source of truth + persisted-schema versioning/migration — it owns B-10/B-11/B-12) |
| **The 70% / same-source compensation limit applied to a *reported* loss.** | It is meaningless without a reported loss: the limit applies when compensating a loss carried *into* a later year. Implemented as data (`capPercent: 70`, `sameSourceOnly: true`) so Phase 7 can apply it without re-deriving the law. | Phase 7 |
| **art. 174 alin. (8) prior-year CASS as the deductible expense + the art. 180 election.** | alin. (8) triggers on „în anul precedent" and the election is exercised by 25 mai of the following year — the app holds **no prior-year input and no election field**. Both are verbatim in `research/09` §2–3, and both evaluate to the same 2.430 lei at the same rate, so leaving them out is an **input gap**, not a modelling gap. | Phase 6 (profile fields) / Phase 9 (dates) |
| **Per-expense deductibility under art. 68 alin. (4).** | The app stores no per-expense nature data; faking „all expenses are deductibilă" as a rule would be inventing a legal conclusion. Recorded as an input gap; the line is labelled `Cheltuieli deductibile` and the assumption is commented at `tax.ts:92-93`. | Phase 6 / Phase 9 |
| **Q-NONDEDUCT-VAT (U-1): non-deductible VAT for a neplătitor.** | UNVERIFIED. Must stay `REVIEW_REQUIRED` if it surfaces at all; never a computed rule. | unresolved research |
| **The `PfaRegime` union / profile model.** | Phase 6 owns the regime-and-profile foundation; `salaryStatus`/`pensionStatus`/`otherIncome`/`caen` are still read by nothing. | Phase 6 |
| **Money precision (float lei).** | Phase 10 owns integer-bani arithmetic and the rounding policy. No conversion here, and **no rounding policy invented**. Defect **B-17** records the concrete consequence: this seed-year tax is an exact half-cent (674,505 lei) and the cent that ships is chosen by IEEE-754 plus whichever formatter is used (§4). | Phase 10 (policy + representation), Phase 8 (which amount is rounded) |
| **CAS/CASS amounts.** | Closed in Phases 3–4. Phase 5 touches only their **deduction** treatment. | — |

---

## 6. What Phase 6 and Phase 7 inherit

- **Phase 6** must populate the two denominators (`total venituri cumulate`, art. 148 alin. (3) and
  art. 170 alin. (1)) when a second income source appears. Until then both ratios are 1 and the
  proration is a no-op; the moment `otherIncome` becomes real, the ratios are the only thing
  standing between a correct return and an over-deducted one. The same phase owns the art. 174 alin.
  (8) / art. 180 election field and the per-expense nature data.
- **Phase 7** owns the persisted shape: a `FiscalLossRecord`-style record with `year`, `amount`,
  `remainingYears` and the 70%/same-source rule attached, read back into `pierderiReportate` at
  alin. (2) lit. a). The `lossCarryForward` object this phase emits is the payload it should store.
- **Phase 9** owns the 25-mai deadlines that decide whether the alin. (6) difference and the art.
  180 election are even in play for a given year.

---

## 7. Tests and validation

Measured on this tree, 2026-10-06:

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | exit **0**, no errors |
| `npm run build` | exit **0** |
| `npm run test` (vitest) | **36 files, 489 tests, all passing** (baseline before Phase 5: 482) |
| `npx playwright test` | **24 e2e, all passing** (baseline: 23) |

The seven new unit tests in `src/domain/tax.test.ts`:

1. `computes the default PFA regime impozit_pe_venit — the gate must never reject the default path (B-14)`
2. `impozit_pe_cit on a PFA is a DATA-INTEGRITY failure, not "a different base applies" (B-14)`
3. `net 20,000 (0 < VNA < 6 SM): CASS 2,430 owed, only 2,000 deductible, tax on 18,000 (B-13)`
4. `single source: both art. 118 alin. (2^2)/(2^3) ratios are exactly 1, so the deduction lines equal the contributions`
5. `art. 118 alin. (2^4): the deductions are capped at the recalculated net income of the same source`
6. `loss year: status stays computed, total = the contributions owed, and the art. 118 alin. (4)-(5) carry-forward is surfaced`
7. `a zero net income is NOT a loss: no carry-forward is reported (art. 118 alin. (2) lit. a))`

The new e2e case: `Dashboard — impozit_pe_cit on a PFA is a data-integrity failure (B-14) › refuses
to compute and names the provisions that make the regime impossible`. The existing computed-state
e2e block was re-pointed from the em-dash/review rendering to the computed numbers (§4).

No probe or scratch files were left behind (`e2e/__probe.spec.ts`, `src/domain/__probe.test.ts` and
`test-results/` were removed before the final runs).

---

## 8. Provenance

`INCOME_TAX_2026` in `src/domain/fiscal/package2026.ts`:

- `sourceUrl`: `https://legislatie.just.ro/Public/DetaliiDocument/312601` — the consolidation
  actually read (08.08.2026), not the stale 200491.
- `sourceArticle`: `art. 123 alin. (1) + art. 118 alin. (2) lit. b), alin. (2^2)-(2^4), alin. (2)
  lit. a) si alin. (4)-(5); 16% inaplicabil per art. 114 alin. (1), art. 115 alin. (1) lit. b);
  regim PFA per art. 13 alin. (1), art. 14, art. 15 si art. 120 Abrogat` — i.e. the chain the code
  now implements, including the regime gate's basis.
- `verifiedAt`: **`2026-10-06`** — the date this rule was re-verified against doc 312601.
- `fiscalPackageVersion` **stays `'2026'`**. It is a package *identity*, not a revision counter: the
  obligation set did not change, only the correctness of one rule's arithmetic. Bumping it would
  invalidate stored snapshots for no legal reason.

---

## 9. Traps for the next reader

- **A quote of art. 118 that says „7 ani", deducts CAS only, or has no alin. (2^1)–(2^4) came from
  doc 200491 and is wrong.** The period is **5 ani** (OUG 115/2023) and the compensation limit is
  **70% din veniturile nete anuale, din aceeași sursă**.
- **alin. (3) is not a zero floor.** It is the fracțiune-de-an rule. The floor is **alin. (2^4)**,
  and it caps the *deduction*, never the liability.
- **Do not re-add a `Math.min(cheltuieli, venit)` clamp.** It is what made losses invisible (B-16).
  A negative net is a legal figure.
- **Do not deduct the whole CASS.** The art. 174 alin. (6) difference is owed and never deductible.
- **No 30% deductible-expense cap exists in sistem real**, and **16% is not a rate here** (income
  tax: art. 114 „alte venituri" only; CASS: the pre-2018 rate). Never reintroduce either.
- **Do not mirror CAS pension relief into CASS** (art. 150 alin. (1) exempts entirely; art. 174 alin.
  (7) lit. c) removes only the top-up).
- **Do not re-point the numeric fixtures back to `impozit_pe_cit`.** No CIT rule exists in the
  package and a PFA cannot legally hold that regime.
- **Parameter ids are read by string** (`thresholds.ts`), so renaming or deleting one can break a
  threshold with no type error.
- **Do not invent a rounding policy.** The seed-year tax is exactly 674,505 lei — a half-cent — and
  the app currently ships `674,51` because of how the double happens to land (defect B-17). The
  tie-break is a legal question (how the Declarația 120 rounds), not a formatting choice. Phase 10
  owns it.
- **`docs/ai/steps/` is a frozen archive.** Where it contradicts this file about income tax, this
  file wins.
