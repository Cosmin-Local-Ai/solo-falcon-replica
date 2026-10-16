# Phase 4 — CASS 2026: the 6-SM floor is a top-up, and pensioners are not exempt

Status: **done** (2026-10-06). Legal source of truth: `docs/ai/phases/02_fiscal_baseline.md` §3–§4
(verbatim CF text + sources). This file records what Phase 4 changed and why; it does not restate
the research. Scope was CASS only — CAS, income tax and UI were not touched.

## 1. The law as implemented

Rate **10%** — CF art. 170 alin. (1). Base = **venitul net anual (VNA)** = gross − deductible
expenses, i.e. the base **before** deducting CAS. That ordering in `tax.ts` was left alone.

SM anchor: CF art. 135^1 alin. (3) — the SM in force on **1 January** of the income year governs the
annual multiples. SM 2026 = 4,050 lei → **6 SM = 24,300 lei**, **72 SM = 291,600 lei**. HG 146/2026's
4,325 lei applies "începând cu data de 1 iulie 2026" and does **not** re-anchor 2026; for 2027 the
same anchor gives 6 × 4,325 = **25,950 lei**.

The floor and the ceiling come from **different articles**:

| Item | Article | Note |
| --- | --- | --- |
| Rate, and the ceiling | **art. 170 alin. (1)** | base "nu poate fi mai mare decât … 72 de salarii minime brute". The same alin. (1) keeps art. 118 fiscal losses out of the base. 72 SM applies "începând cu veniturile aferente anului **2026**" (Legea 239/2025, Art. XII pct. 19, MO 1160/15.12.2025). |
| The 6-SM floor | **art. 174 alin. (6)** | owed as "o diferență de contribuție … până la nivelul celei corespunzătoare bazei de calcul egale cu 6 salarii minime brute". Introduced by OUG 128/2024 pct. 23 (MO 1125/11.11.2024); untouched by Legea 239/2025 (whose pct. 20 moves alin. (4), (5), (11) only). |
| Zero net / fiscal loss | **art. 174 alin. (2)** | such persons "nu datorează contribuția" at all; they *may* opt in under art. 180 alin. (1). |
| Relief from the floor | **art. 174 alin. (7) lit. a) / lit. c)** | lit. c) ("venituri din pensii, definite conform art. 99") introduced by Legea 141/2025, Art. I pct. 34 (MO 699/25.07.2025), applicable from income year 2025 → in force for 2026. |

**The floor is a top-up, not a substitution.** Proof it is a genuine top-up: CF art. 118 alin. (2)
lit. b) makes CASS deductible from the income-tax base "cu excepția diferenței de contribuție …
prevăzută la art. 174 alin. (6)". The non-deductible part is exactly the difference.

## 2. Decision table (implemented literally)

| Condition | Base | CASS |
| --- | --- | --- |
| `VNA ≤ 0` | — | **0** (art. 174 alin. (2)); breakdown states the art. 180 alin. (1) optare exists and is not modelled |
| `0 < VNA < 6 SM` and `pensionStatus === 'da'` | `VNA` | `10% × VNA` — alin. (7) lit. c) removes the top-up only |
| `0 < VNA < 6 SM` and `pensionStatus !== 'da'` and `salaryStatus === 'da'` | — | **`reviewRequired`** — lit. a) relief needs salary ≥ 6 SM and the profile carries no salary amount |
| `0 < VNA < 6 SM`, neither relief | `6 SM` | `10% × 6 SM` = **2,430** (art. 174 alin. (6) top-up) |
| `6 SM ≤ VNA ≤ 72 SM` | `VNA` | `10% × VNA` |
| `VNA > 72 SM` | `72 SM` | `10% × 72 SM` = **29,160** (art. 170 alin. (1)) |

Pension relief is checked **before** the salary check: lit. c) carries no monetary threshold, so it
is certain in exactly the case where lit. a) cannot be evaluated.

## 3. Defects fixed

- **B-3** (`calcCass`): `base < min_base → reviewRequired`. Half right in the original premise. Below
  6 SM the law does **not** halt for review and does **not** substitute the base — it owes a
  *contribution difference* up to the 6-SM figure, i.e. a flat **2,430 lei**, unless a relief applies
  or the year is a zero/loss year. The old code produced `review_required` for every low-income year,
  including a plain zero-revenue year where the answer is unambiguously **0**.
- **Citation, not value**: `min_base = 24,300` was **numerically correct for 2026 and mis-sourced**.
  It was labelled "Minimum base (6 SM annual)" under a rule citing only art. 170 alin. (1). Art. 170
  alin. (2)-(3) reach only art. 155 alin. (1) lit. **c)-h)**; art. 68 sistem-real income is lit. **b)**.
  The floor is **art. 174 alin. (6)**. The value was not changed; the attribution was.
- **B-6 (CASS half)**: `min_cass` (2,430) and `max_cass` (29,160) were independent parameters encoding
  figures fully derivable as `rate × min_base` and `rate × max_annual_base`. `max_cass` was read by
  nothing at all (dead parameter); `min_cass` was applied as `Math.max(cappedBase × rate, minCass)` —
  an unconditional floor on the CASS *value*, which is legally wrong because the 6-SM amount is a
  conditional top-up (waived by art. 174 alin. (7) lit. a)/c), absent under art. 174 alin. (2)).
  **Both parameters are removed**; `calcCass` derives both amounts from the two bases. One legal
  figure, one source of truth.
- **U-2 closed**: the 6-SM floor for art. 68 income is sourced (art. 174 alin. (6)). The
  "GAP U-2 (UNVERIFIED) … UNSOURCED" comment block in `package2026.ts` is replaced with the settled
  attribution.

## 4. The pension asymmetry — CAS and CASS are not the same shape

This is the trap Phase 4 had to avoid. Phase 3 correctly made `pensionStatus` a **full CAS
exemption**; the same flag must **not** zero CASS.

| | CAS | CASS |
| --- | --- | --- |
| Provision | art. 150 alin. (1) | art. 174 alin. (7) lit. c) |
| Effect | owes **no CAS at all**, regardless of amount | removes **only the art. 174 alin. (6) top-up** |
| Pensioner with art. 68 net income | 0 | **`10% × VNA`** — not 0, and not 2,430 |

Three conditions enforced on the CASS side:

1. `10% × net` still stands whenever net > 0. `if (pensionStatus === 'da') return 0` would be a legal
   error here.
2. The trigger is pension income **realised in that fiscal year** ("a realizat venituri"), not a bare
   status flag. The profile only carries `pensionStatus: 'da' | 'nu'`, so the flag is used as a proxy
   for "realised" — recorded as an approximation, not as a verified mapping. There is **no minimum
   pension amount** in lit. c) — contrast art. 154 alin. (1) lit. h)/h²), which use 4,000 / 3,000 lei
   monthly.
3. Pension is **not** routed through art. 154 or art. 174 alin. (8). Legea 141/2025 pct. 35 narrowed
   alin. (8) to art. 154 alin. (1) lit. **a), b), e) și f)**; pensioners sit at lit. **h)/h²)**, not in
   that list. Art. 154 exemptions are income-specific — alin. (2): persons in those categories "dacă
   realizează venituri … altele decât cele pentru care sunt exceptate, datorează contribuția". So no
   art. 154 route zeroes CASS on art. 68 income. Art. 154 alin. (1) lit. c) and d) are **abrogated**
   and are not coded.

`tax.ts` now passes `pensionStatus` **and** `salaryStatus` to `calc-cass`, with a comment recording
the asymmetry. `salaryStatus` is still deliberately **not** passed to `calc-cas` (art. 150 alin. (2)
covers only art. 137 alin. (1) lit. b^1)).

## 5. Parameter changes (`package2026.ts`, rule `CASS_2026`)

| before | after | note |
| --- | --- | --- |
| `rate` 10 | `rate` 10 | unchanged |
| `min_base` 24,300 | `min_base` 24,300 | **id kept** — `thresholds.ts` `CASS_MIN_BASE` reads it by string; label now says "Top-up floor (6 SM annual) — CF art. 174 alin. (6); conditional, not an unconditional minimum" |
| `max_annual_base` 291,600 | `max_annual_base` 291,600 | **id kept** — `CASS_MAX_BASE` reads it |
| `min_cass` 2,430 | **removed** | derived as `rate × min_base` |
| `max_cass` 29,160 | **removed** | derived as `rate × max_annual_base`; it was never read by anything |

`sourceAct` / `sourceArticle` now cite: art. 170 alin. (1) (rate + ceiling), **art. 174 alin. (6)**
(floor), art. 174 alin. (2) (zero/loss), art. 174 alin. (7) lit. c) (relief), art. 135^1 alin. (3)
(SM anchor), across OUG 128/2024 pct. 22-23 (MO 1125/11.11.2024), Legea 239/2025 Art. XII pct. 19
(MO 1160/15.12.2025) and Legea 141/2025 Art. I pct. 34 (MO 699/25.07.2025).

Package invariant held: **8 rules, `version: 1`, `status: 'ACTIVE'`** — no new ACTIVE rule.
24,300 / 291,600 / 4,050 unchanged. `thresholds.ts` untouched: `CASS_MIN_BASE` (24,300) and
`CASS_MAX_BASE` (291,600) still resolve, and no threshold spec ever read `min_cass`/`max_cass`.

## 6. `tax.ts`

The `socialInsuranceStatus === 'obligatoriu'` gate is unchanged — Phase 6 owns the profile. What was
verified and commented:

- A CASS of **0** (zero/loss year, or a relief) flows through `taxable = net − CAS − CASS` and the
  lines unchanged, and produces a normal `computed` result.
- The `reviewRequired` case surfaces as `status: 'review_required'` with the legal reason and the
  partial lines — never as a wrong number.
- CASS base remains `net` (VNA) **before** CAS is deducted. Ordering unchanged.

## 7. Deliberately not modelled

- **art. 180 alin. (1) optare** — elective and deadline-bound, and its alin. (2) base was **not
  retrieved verbatim**. Inventing the elective base would be inventing a citation. The `VNA ≤ 0`
  breakdown states that the optare exists and is not modelled, so the 0 is visibly a default, not a
  claim that no CASS is ever owed in a loss year.
- **art. 174 alin. (8) prior-year relief** — needs prior-year data the profile does not carry. It is
  also narrower than previously assumed (lit. a) covers only art. 154 alin. (1) lit. a), b), e), f)).
- **art. 174 alin. (7) lit. b)** — relief for art. 155 alin. (1) lit. c)-h) income on which CASS is
  already paid at ≥ 6 SM. The profile has `otherIncome` as a flag but not the CASS paid on it, so the
  condition cannot be evaluated.
- **The salary amount behind lit. a)** — instead of guessing, `calcCass` returns `reviewRequired`.
  This is why `tax.test.ts` keeps net 24,299 with `salaryStatus: 'da'` as `review_required`: the
  default fixture is a salaried person, and the law's answer depends on a number we do not have.

## 8. Tests

`src/domain/fiscal/fiscal.test.ts` — 16 calculator-level CASS tests: `VNA = 0` → 0 · `VNA < 0` → 0 ·
`VNA = 1` → 2,430 · `VNA = 24,299` → 2,430 · `VNA = 24,300` → 2,430 · `VNA = 100,000` → 10,000 ·
`VNA = 291,600` → 29,160 · `VNA = 500,000` → 29,160 · ceiling is parameter-driven (mutating
`max_annual_base` to 100,000 moves it) · `min_cass`/`max_cass` are absent from the parameter list ·
pensioner below 6 SM → 1,000 (not 0, not 2,430) · pensioner above 6 SM → 10,000 · pensioner at VNA 0
→ 0 · `salaryStatus: 'da'` below 6 SM → `reviewRequired` naming lit. a) · pension checked before
salary · `salaryStatus: 'da'` above 6 SM → 10,000 · no base supplied → 0.

One breakdown assertion pins the attribution: it must contain `CF art. 174 alin. (6)`,
`NU art. 170 alin. (2)-(3)` and `art. 155 alin. (1) lit. c)-h)`. A future re-attribution to art. 170
fails that test.

`src/domain/tax.test.ts` — integration: net 0, zero revenues and expenses > revenues re-pointed from
`review_required` to `computed` with CASS 0 (they had encoded B-3); net 24,299 with `salaryStatus:
'da'` → `review_required` naming lit. a); net 24,299 with neither relief → 2,430; pensioner with net
below 6 SM → CASS 1,000 while CAS is 0 (the asymmetry, total 1,900); ceiling driven by
`max_annual_base`. The pre-existing pensioner test at net 200,000 (CASS 20,000, total 38,000) still
passes — it is the guard against ever mirroring CAS's exemption into CASS.

No existing assertion was deleted or weakened. Four assertions were **re-pointed** from
`review_required` to `computed` with an explicit CASS 0, because the behaviour they pinned was defect
B-3 itself.

## 9. Open risk — U-8 (recorded, not resolved)

It is **not established** that OUG 89/2025 (MO 1203/24.12.2025) and OUG 8/2026 (MO 147/25.02.2026)
leave CF art. 170 / 174 / 154 / 180 untouched. The only evidence is that the 2026 consolidated text
already absorbs Legea 239/2025 and Legea 141/2025 and carries no further note — and that same
evidence class silently omitted an art. 68 amendment once before (see `phases/02` §8.2, where OUG
8/2026 **does** amend art. 68 alin. (5)). Absence of a note is not proof. Closing U-8 needs both
OUGs' Art. I clause lists read directly. Everything in this phase is stated for the 2026 consolidated
text as retrieved; it is not a claim that no later ordinance touched these articles.

## 10. Verification

`npx tsc --noEmit` **0 errors** · `npm run build` **exit 0** · `npm run test` **36 files / 482 unit
tests passed** (baseline 463; +19 CASS tests) · `npm run test:e2e` **23 passed**.

Numbers that must not move, and did not: rate 10% · 6 SM = 24,300 · 72 SM = 291,600 · CASS at the
floor = 2,430 · CASS at the ceiling = 29,160 · SM anchor 4,050 lei on 1 ianuarie 2026.

Files changed: `src/domain/fiscal/calculators.ts` (`calcCass` rewritten, `salaryStatus` added to
`CalculatorInput`) · `src/domain/fiscal/package2026.ts` (`CASS_2026` parameters, provenance,
comments) · `src/domain/tax.ts` (CASS call passes `pensionStatus`/`salaryStatus`, asymmetry comment) ·
`src/domain/fiscal/fiscal.test.ts` · `src/domain/tax.test.ts`. CAS, income tax, `thresholds.ts` and
all UI untouched.
