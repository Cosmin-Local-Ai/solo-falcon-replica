# PG brief — production gate for the SOLO Dashboard (PG-0 … PG-13)

**Source:** the second independent audit, run against `02c6ecf` with the app actually executed (typecheck 0, build 0, 1,332 unit tests, 37 E2E). Its findings were cross-checked against the first audit and against the repo register. Two of its claims were re-verified in-tree on 2026-10-10 and are recorded in §7.

**Target is production, not a friends pilot.** That single fact changes the shape of everything below: *"restrict the supported scope" is not a mitigation.* Every unsupported case must be **really supported** or **explicitly refused**. The app must never show a confident number it cannot stand behind.

**Relationship to `docs/ai/PHASE_PLAN_11_34.md`:** PG is the **execution order**; the phase numbers stay the vocabulary. The mapping is in `PHASE_PLAN_11_34.md` §11. Where the two disagree, PG wins on order and the phase plan wins on what is already landed and what must be preserved.

---

## 0. Operating rules — non-negotiable, every task

1. **No AI computes tax.** All fiscal values come from the rule store; every new value needs a ledger entry citing an official source (Portal Legislativ, Monitorul Oficial, ANAF). Secondary sites guide discovery only.
2. Unverified or ambiguous → `REVIEW_REQUIRED` / incomplete. Never a guessed number.
3. **Scouts are read-only and sequential.** Each returns QUESTION / FINDINGS / EVIDENCE / SOURCE URLS / DATE VERIFIED / CONFIDENCE / FACT vs INTERPRETATION vs UNKNOWN / WHAT NOT TO ASSUME. Output goes to `docs/ai/research/NN_*.md`, never into code. **The Orchestrator transcribes it** — a Researcher has no write tool and its report dies on compaction.
4. **Dates are stamped by tooling, never typed.** `STATE.md` currently carries `2026-10-08` on a commit made 2026-10-07 19:04 +03:00. A `scripts/today` prints the local date; the ledger's `verifiedAt` uses the same script.
5. **Every date-sensitive test uses a fixed clock.** No test may depend on wall-clock time.
6. **One channel for "the estimate is not complete."** PG-1 builds it; PG-4…PG-8 route their refusals through it. No parallel warning mechanisms.
7. All user-facing sentences live in `src/ui/copy/`; the guard's allow-list stays empty.
8. **Do not rewrite what works.** Preserve: integer-`Bani` money with decimal intermediates; the CAS floor ladder; the CASS top-up model; the 72-SM ceiling; 10 % income tax; the rule-registry content digest and the R1/R2 fixture; the shared attention model; the copy layer; `RuleProvenance`; the FX interpretation record with both readings kept.
9. Each task ends with typecheck 0, build 0, unit + E2E green, `STATE.md` re-measured (not copied), and a phase note in `docs/ai/phases/`.
10. Data version bumps need a tested migration (current version **10**). Never discard user data; corrupt payloads stay quarantined.
11. One Worker at a time.

---

## 1. Sequence

```
PG-0  groundwork (clock, date stamping, CI)
 └─ PG-1  estimate coverage: no silent exclusions        ← unblocks every refusal below
     ├─ PG-2  payment/collection dates + local-date defaults
     ├─ PG-3  first run, onboarding, seed (no demo data by default)
     │    └─ PG-4  projection by active period + fiscal-year lifecycle   (needs L-1)
     ├─ PG-5  annual declaration model + deadline "done" state
     ├─ PG-6  unsupported-scenario framework 6a–6f                       (needs L-2…L-7)
     ├─ PG-7  FX end to end
     └─ PG-8  evidence + snapshots + breakdown
PG-9  rule governance + sign-off record        (may start after PG-1)
PG-10 trust copy: disclaimer, rule version, last-verified
PG-11 data safety: backup / export / import / quota / multi-tab
PG-12 Dashboard UX, accessibility, performance
PG-13 release audit and go/no-go
```

PG-0 → PG-1 strictly in order. After PG-1, PG-2 / 3 / 5 / 7 are independent (no overlapping files). PG-4 needs PG-3's `pfaStartDate` and scout L-1. PG-6 needs its scouts.

---

## 2. Tasks

### PG-0 — Groundwork (½–1 day)
Make later tasks testable and their claims honest.
- Fixed-clock helper for vitest and Playwright (`page.clock.install`); re-pin every date-dependent E2E assertion to a fixed date.
- `scripts/today` for doc and ledger stamps.
- CI: typecheck, vitest, build, Playwright (browsers installed), axe-core on `/dashboard` failing on serious/critical.
- Fix `STATE.md`'s internal contradiction — line 50 still says **64 files / 1149 tests** while the header says **77 / 1332**.
- **Acceptance:** CI green on a clean clone; no test reads the wall clock; `STATE.md` numbers match a fresh run.

### PG-1 — Estimate coverage: no silent exclusions (2–3 days)
**The hero may say "Calculat" only when every recorded record is either included or deliberately, visibly excluded.** This is the biggest trust defect found: the badge stays green while records are dropped.

Evidence on `02c6ecf` (revenue 30.000 lei net, annualised estimate 7.362 lei):

| Record entered | Deductible | Tax | Notice |
|---|---|---|---|
| 10.000 lei expense, no category | 0 | 7.362 | none |
| 10.000 lei `depreciable_asset_purchase` | 0 | 7.362 | none |
| 3.000 lei `home_office_shared_cost` (undetermined) | 0 | 7.362 | none |
| €5.000 expense, no FX rate | 0 | 7.362 (tax **rises**) | none |
| €5.000 revenue, no FX rate | revenue vanishes from estimate **and** Summary (tax **falls**) | — | none |

A €5.000 revenue with no rate disappears the same way, so the error goes in **either direction**. Completeness does not drop.

- Add `EstimateCoverage` to the result: `{recordId, kind, reason, amount, fixTarget}`, reasons at least `unclassified`, `undetermined`, `asset_not_modelled`, `missing_fx_rate`, `rejected`, `pending`, `fact_missing` (reserved for PG-6).
- Estimate status becomes an explicit union: `complete | incomplete | review_required | refused | closed_final` (the last two used by PG-4 / PG-6).
- Hero badge + count + deep link; one attention row per reason group, reusing the existing `…#!/rejected?f=<id>` link pattern.
- Completeness becomes a **weighted percentage** (share of recorded amount included) plus profile-fact completeness. Remove the circular "Estimare impozit" check — see §7.
- Expense/Revenue rows show `nu intră în estimare: <motiv>`.
- **May touch:** `domain/estimateBasis.ts`, `domain/completeness.ts`, `domain/tax.ts` (result shape only), `data/dashboard.ts`, `components/dashboard/*`, `pages/Expenses.tsx`, `pages/Revenues.tsx`, `ui/copy/*`. **Must not touch** the calculators, rule values or the registry.
- **Acceptance:** each row above → status `incomplete`, hero "Estimare incompletă", an action row with a working link, a row badge, a lower completeness percentage. Fixing the cause returns it to `complete`.

### PG-2 — Payment / collection dates and local-date defaults (1–2 days)
`Revenue.collected` and `Expense.paid` exist and are read by `aggregation.ts`, but **no UI writes them**. `new Date().toISOString().slice(0,10)` seeds the date default in `Declarations.tsx`, `Expenses.tsx`, `Revenues.tsx` — at 00:30 local on 1 Jan 2027 a new record defaults to **31 Dec 2026**, the wrong fiscal year.
- Add "Data încasării" and "Data plății"; helper text states what happens when empty (today the document date is used — see **D-1**).
- Replace the three UTC defaults with the shared local-date utility.
- Show the fiscal date actually used in the record list and the breakdown.
- **Acceptance:** an invoice dated 20 Dec 2026 collected 10 Jan 2027 is excluded from the FY2026 estimate and shown as "încasat în 2027"; defaults correct at 00:30 local on 1 Jan 2027 under a fixed clock.

### PG-3 — First run, onboarding, seed (2–3 days)
A fresh browser profile (0 stored entries) opens on "Bună, Andrei" with demo invoices and "Popescu Andrei" in the topbar. There is **no "start from scratch" path anywhere in the UI**.
- Empty storage → onboarding, not seed data. Collect with validation: name/CUI as applicable; regime (sistem real; `norma_venit` → an explicit "nu este suportat" screen with **no estimate**); PFA start date (required); VAT status plus registration date; salary and pension facts; other income yes/no (amounts via PG-6d); activity declaration (via PG-6b).
- Hero shows "Completează profilul" until the required facts exist.
- Demo data becomes an **opt-in sandbox**, visibly marked and removable; add "Șterge toate datele și începe de la zero" in Settings with confirmation and an automatic export prompt once PG-11 lands.
- Rewrite the seed: a 2026 PFA, start date in 2026, transactions Jan–Oct coherent with it, no 2025 filings, no SRL remnants in `companyDocs`.
- With zero records the Dashboard still shows the next deadline, profile completeness and next steps — today the sections hide behind the empty state.
- **May touch:** `data/seed.ts`, `data/store.tsx` (initial state only), new `pages/Onboarding.tsx`, `pages/Dashboard.tsx`, `data/migration.ts`, copy.
- **Acceptance:** fresh profile → onboarding; no demo strings anywhere; after onboarding with no records the Dashboard shows an empty state with the D212 date; loading and unloading the sandbox is lossless for real data. Existing payloads must **not** be treated as first run.

### PG-4 — Projection by active period + fiscal-year lifecycle (3–4 days; needs L-1)
A PFA started 1 Oct 2026 with 10.000 lei on 3 Oct still shows "9,3 din 12 luni scurse" → 3.592 lei. `pfaStartDate` exists but only prints a note. Clock drift, same data:

| Date | Dashboard |
|---|---|
| 31 Dec 2026 23:30 | "12 din 12 luni", estimate 3.112 — correct |
| 15 Jan 2027 | still "An fiscal 2026", "12,5 din 12 luni", estimate **3.086** |
| 26 May 2027 | "16,8 din 12 luni", estimate **2.916** |

**A closed year drifts every day because it is still a run-rate.** There is no 2027 rule package; the fiscal year is only a manual Settings field. The first real date boundary is ~12 weeks away.
- ~~Scout L-1 first. Then projection runs over `[max(Jan 1, pfaStartDate), Dec 31]`; for a mid-year start project **to year end, not ×12**, unless L-1 says otherwise.~~ **Superseded by L-1** (`research/26_midyear_start_partial_year_2026.md`) and by **D-PROJ-1**: there is no projection basis to fix, because the engine must not be fed a projection at all. CF art. 118 alin. (3) deems fraction-of-year income to **be** the annual income; art. 68 alin. (2) lit. a) / alin. (4) lit. b) measure actual receipts and payments; the statutory proration for starters was deleted by OUG 115/2023 art. I pct. 101 from 1 Jan 2024, and art. 151 alin. (2) applies art. 148 unprorated to starters.
- **The hero figure is computed from actuals only**, labelled with the as-of date. A forecast may be shown beside it, visually distinct, and never feeds the engine or the thresholds. The chart's projected series stays as a visual aid (Phase 22 still owes it a non-colour cue).
- **Do not prorate** the 12-SM, 24-SM, 6-SM or 72-SM figures for a mid-year starter (art. 151 alin. (2)); keep art. 151 alin. (3) — the newly-exempt case — visibly separate, because it is a different rule with a different trigger.
- **Cite art. 118 alin. (3), not alin. (2)** — the pre-2024 numbering is a live trap.
- **Scope the "proration was removed" claim to the code.** The Norme metodologice reproduced in ANAF's current edition still contain prorating language and worked examples; their status after HG 602/2025 is under research (`scout-L1b-normes`). Until that closes, the app may say the *code* contains no proration for starters and must not say prorating was abolished full stop.
- `elapsedMonths ≤ activeMonths`, never > 12.
- Closed-year state (asOf after 31 Dec): estimate = **final calculation from actuals**, labelled "Calcul final pentru 2026", no run-rate wording, no daily drift; thresholds use actual figures.
- Year lifecycle: an explicit user-confirmed advance (or an auto-prompt on 1 Jan — see **D-5**); a year with no rule package yields `review_required` + "Regulile pentru 2027 nu sunt încărcate", never a silent reuse of 2026 rules. Create the 2027 package container as **STAGED with no invented values**.
- **Acceptance (fixed clock):** 2026-12-31, 2027-01-15 and 2027-05-26 give an **identical** estimate for identical data; no "N din 12" with N > 12; **a fixture for an October-2026 start with 10.000 lei Oct–Dec yields venit net anual 10.000 lei, no CAS (art. 148 alin. (1)), and the art. 174 alin. (6) CASS top-up to 6 SM unprorated**; FY2027 selected → carried-forward rules labelled as such, wage-dependent lines marked not yet updated, never a silently reused 2026 wage.

### PG-5 — Annual declaration model + deadline "done" state (2–3 days)
`Declaration` is `{an, luna, …}`; "Date lipsă: Declarații" is a permanent action. After 25 May 2027 the Dashboard raises "Termen depășit: PFA" at high priority **even if you filed**, and the item is labelled "PFA". (Repo **B-34**, related **B-35**.)
- New `AnnualFiling { taxYear, form: 'D212', status, filedOn?, reference? }`; migration **v11** from monthly records; the Declarations page becomes annual.
- Deadline resolver: a deadline is **done** when a filing for that tax year exists with a filed status; overdue only if not done. Label "Declarația unică (D212) pentru <an>".
- Replace the "any declaration exists" completeness predicate with "the annual filing for the relevant year exists / is due".
- D300 (**B-35**): do not assert a period. Require the VAT registration date and prior-year taxable-supplies facts (scout **L-6**), or show "Perioada de depunere nu poate fi stabilită — completează…". Remove the monthly D300 from the seed.
- **Acceptance (fixed clock):** after 25 May 2027 with a recorded filing → no overdue item; without → exactly one, correctly labelled, linking to the filing form.

### PG-6 — Unsupported-scenario framework (5–8 days; needs L-2…L-7)
**6a Framework.** A `ScenarioSupport` registry: `{id, detect(profile, records), effect: 'incomplete' | 'refuse', message (copy key), fixTarget}`. A refusal replaces the number with "Nu putem calcula" + reason + link. Wire the existing expense-engine refusal through it. Everything routes through PG-1's channel.
- **6b Activity.** `ActivityFamily` is never supplied by the live pipeline — a CAEN 5510 profile gets the same 7.362 lei estimate as any other, so the accommodation refusal is dead code. **Do not guess from CAEN.** Ask an explicit onboarding/Settings question for activities with a different statutory method (per L-2); yes → refuse. Show the answer in Settings for review.
- **6c Vehicle facts per expense.** Add to `Expense`: `usage` (exclusive | mixed | none | unknown), supporting documentation present, exception category. Form + schema + migration. `unknown` → **incomplete**, not a silent 50 % — today a 10.000 lei vehicle expense with no usage fact is silently deducted at 50 %.
- **6d Other income.** The flags (imobiliare, autovehicule, dividende, concesiune, alte) carry no amounts; only salary does. Per L-5: model the amounts the engine needs, or refuse when a flag is set without them.
- **6e Fixed assets (B-31).** Minimal asset record (acquisition date, value, class/useful life per L-4) and depreciation into the deductible set; verify the 2026 asset-value threshold — the code notes OUG 8/2026 touches it but holds no value. Until then `depreciable_asset_purchase` is **incomplete**, not silently 0. A 10.000 lei laptop currently gives 0 deductible and no depreciation.
- **6f VAT-registered deductible VAT (B-30).** `tax.ts` assumes all input VAT is recoverable for a non-exempt profile. Implement per L-3 or refuse.
- **Must not touch** the CAS / CASS / income-tax calculators.
- **Acceptance:** for each of 6b–6f, a fixture that previously produced a confident wrong number now produces `refused` or `incomplete` with a working fix link; once the facts are supplied the supported path computes.

### PG-7 — FX end to end (3–4 days)
With a €5.000 revenue and a rate entered, the estimate used **57.924 lei gross (tax 21.940)** while the Summary card still read "Venituri 20.000". Adding that invoice raised the estimate from 4.891 to 21.940 because CAS then applies. `recordFxRate` exists in the store; Settings renders only a read-only provenance view; `loadDailyRates` and the BNR fetcher are unused. The alternative cap reading is never shown to the user.
- Manual rate-entry UI on `recordFxRate`: currency, kind (daily / annual average), date or year, value, source, provisional/final, entry mode. Invalid input rejected through the existing schema.
- **One normalised-ledger boundary** used by `aggregation.ts`, the chart series and `estimateBasis.ts`. Missing-rate records go through PG-1.
- Show **both** interpretations of the euro-cap ceiling where the repo records a conflict, with the provisional/final state of the rate.
- If a fetcher is ever wired: one boundary, an explicit user action, error states, and a CORS check from a browser before it is relied on.
- **Acceptance:** Summary, chart and estimate reconcile for the same records; a missing rate is visible and makes the estimate incomplete; entering it flips the status and updates all three.

### PG-8 — Evidence, snapshots, calculation breakdown (3 days)
The breakdown ("Cum am ajuns la această sumă") shows aggregates only — "Cheltuieli deductibile 155,00 RON" — and `addSnapshot` has **no caller**, so nothing is ever saved.
- Persist a calculation record when inputs materially change: debounced, de-duplicated by inputs hash, capped history. **No PII in snapshots** — fiscal inputs only.
- Record: basis (actual/projected + method + active period), the per-expense decision (category, treatment, included amount, reason), exclusions from PG-1, cap adjustments with the chosen reading **and** the alternative, FX conversions with provenance, rule release id + content digest, and the wage-vintage assumption.
- The breakdown shows a per-expense table and the exclusions; older records stay interpretable after rule or FX changes (extend the R1/R2 fixture).
- Optional: a printable/exportable "fișă de calcul" for the accountant — see **D-7**.
- **Acceptance:** save an estimate, change a rule release and an FX rate, reload — the old record still renders its original numbers and evidence; a new calculation uses the new inputs.

### PG-9 — Rule governance and sign-off (1–2 days + review time)
All 39 expense-deductibility rules are ACTIVE with `verifiedAt` all dated the same day, and most caps carry "CONFLICT NEREZOLVAT" notes — while the repo's own rule is that ambiguous law is staged for review. The euro cap **values** were independently cross-checked and match a 2026 guide (400 euro pension / medical / PEPP / ETF, 100 euro sports, up to 4.000 euro professional dues, 2 % protocol, 5 % scholarships); the open conflicts concern the **base** and the **conversion rate**.
- A rule with an unresolved conflict may be ACTIVE only if the result carries both readings and the UI shows them (PG-7 / PG-8); otherwise STAGED / `REVIEW_REQUIRED`.
- `docs/fiscal-ledger.md`: per rule — value, official URL, article, tool-stamped date, verifier, status, open conflicts. Add a **sign-off block**: name, date, scope of review, exclusions.
- Replace any remaining secondary-source URLs; keep the wage-vintage risk visible (it is on screen today — keep it).
- **Acceptance:** no ACTIVE rule with an open conflict lacks dual-reading output; the ledger is complete; sign-off is recorded, or the release is marked "not signed off" in the UI footer (PG-10).

### PG-10 — Trust copy (1 day; wording owned by **D-6**)
No disclaimer text exists anywhere in user-facing copy — a search for „consultanță", „nu constituie", „informativ" returns nothing.
- A persistent short notice on the Dashboard and the calculation view: the figure is indicative and does not replace the filing or professional advice.
- A footer with app version, rule release, short rule digest, last-verified date, sign-off status.
- Terms/privacy placeholder reviewed by the wording owner; every hero state gets its own approved sentence saying what the number is and is not.

### PG-11 — Data safety (3–4 days; roadmap Phase 29)
Export/import with schema validation and a lossless round trip including snapshots, reserve, FX rates and filings; an automatic last-known-good copy before any overwrite; a visible message on a failed save (today a quota failure is only logged); `storage`-event handling for two tabs; document files out of `localStorage` into IndexedDB or a clear capped limit; an `ErrorBoundary` with an "export data" escape hatch; guard `crypto.subtle` / `randomUUID` for non-secure contexts.
- **Acceptance:** export → wipe → import equals the original; quota-exceeded and corrupt-payload tests pass; two-tab editing does not silently lose data.

### PG-12 — Dashboard UX, accessibility, performance (2–3 days)
Accessibility (axe-core on `/dashboard`: 3 issue types; keyboard walk: 44 stops, all with a focus ring):
- `.muted` text `#667085` is **4.43:1**, under the 4.5 requirement, in 6 places → darken the token.
- No `<main>` landmark — 54 elements sit outside landmarks — and no skip link (the first tab stop is the sidebar).
- 4–5 links read only "Deschide"; five identical "Surse și note de interpretare" disclosures repeat. Give them descriptive names.

Performance and coupling:
- `useDashboardData()` runs in the app shell on every page, in Dashboard, and again in `FinancialChart` — three computations and three async estimates per Dashboard view. Compute once in a provider; the shell takes a cheap selector for badge counts.
- Lazy-load the chart; the bundle is **one 902 kB chunk** (up from 757 kB).
- The chart defaults to the current month, which is empty at the start of every month (y-axis 0–0.04) → default to YTD/An with the projection line.

Consistency: the headline "Venituri / Cheltuieli" include VAT for a non-exempt profile (9.317 / 248,66) while the estimate uses net (7.700) — show the fiscal basis or make the headline match it.

Sections: Observații titles must name the threshold (CAS / CASS / cap), not "Venit PFA"; "Aproape de prag" must not fire when the user is already above a floor (it fires at 20k net today); exceeding the CASS cap is informational, not "prioritate ridicată"; the rule-digest and citation block renders collapsed and only where relevant (today it is always visible, even under the reserve warning); the "Deschide" deep link must land with the target in view (≈77 px below the fold at 1440×900). Ce trebuie să faci: no unresolvable items after PG-1/PG-5; no nag for a PFA with zero expenses; the D212 item labelled "Declarația unică (D212)". Completitudine: percentage and weighted checks; drop "instantanee de taxe"; merge "Declarații" / "Declarații fiscale". Legislație: keep the honest "monitor inactive" text; fix the first item (header says "Modificare viitoare / Te afectează" while its status is "A fost în vigoare"); Romanian date format inside sentences; fix the typo **recalcalează**.
- **Acceptance:** axe 0 serious/critical; keyboard path unchanged or better; one computation per page; no chunk > 500 kB; screenshots at 1440 / 1024 / 768 / 390 reviewed.

### PG-13 — Release audit and go/no-go (3–4 days)
- Rewrite E2E assertions to assert **correct** numbers and messages under a fixed clock with 2026 fixtures, rather than pinning current behaviour.
- Cross-application regression through the real UI: dates across the year boundary; a mid-year-start PFA; foreign currency with and without a rate; activity declaration → refusal; vehicle facts (exclusive / mixed / unknown); other income without amounts; annual D212 done and overdue; D300 facts missing; save → change rule release and FX → the old estimate stays interpretable; the breakdown reconciles to the estimate; first run; year rollover.
- Not yet tested and must be: large datasets (thousands of records), Firefox and WebKit/mobile Safari, a real screen-reader pass, two tabs open, export/import, BNR fetching if wired.
- An independent QA pass by someone who did not write the code.
- **GO only if:** no silent-exclusion path remains; every unsupported scenario refuses or flags incompleteness; no ACTIVE rule hides an unresolved conflict; sign-off is recorded or the footer says it is missing and the release is gated; year rollover and the D212 done-state are verified; backup/restore proven; axe clean; CI green three runs in a row.

---

## 3. Scouts — read-only, sequential, official sources only

| ID | Question | Feeds |
|---|---|---|
| **L-1** | ~~Income realised in part of a year~~ **DONE** — `research/26` (partial-year income *is* the annual income; thresholds not prorated; ×12 has no legal basis) and `research/27` (the unrepealed prorating norm vs the code; ANAF's current D212 instructions apply the code rule). **B-54 raised, D-PROJ-1 decided** | PG-4 |
| **L-2** | Which PFA activities are taxed by a method other than actual expenses (art. 68^1, 68^3, 69)? Is there a verified activity→method mapping, or must the user declare it? | PG-6b |
| **L-3** | VAT-registered PFA: which input VAT is deductible and which is part of the expense (the 50 % cases, non-recoverable VAT)? | PG-6f / B-30 |
| **L-4** | Fixed assets for a PFA: the 2026 asset-value threshold (OUG 8/2026?), depreciation methods and useful lives, purchase vs depreciation treatment, cash-basis interaction. | PG-6e / B-31 |
| **L-5** | Other income (rent, vehicle rental, dividends, concession, other) and its interaction with the CASS base and top-up and with CAS — which amounts does the calculation need? | PG-6d |
| **L-6** | D300 periodicity: the facts needed (registration date, prior-year taxable supplies) and the first-year rules. | PG-5 / B-35 |
| **L-7** | Cash-basis treatment of an invoice with **no payment date** — income when issued or when collected in sistem real? — and of expenses paid in a different year. | PG-2 / D-1 |
| **L-8** | After year end: what is filed and paid, when, for FY2026 (D212, CAS/CASS settlement), and the effect of the early-filing bonus — the repo notes OUG 8/2026 art. 8 applies to filing by 15 April 2026; confirm it does not reach FY2026. | PG-4 / PG-5 |

### Open legal questions found after the audit — queued, sequential

These came from the `STATE.md` register, the two Romanian audits and the L-1/L-1b passes. **One scout at a time (C5).**

**Done as of 2026-10-10:** **R-A** and **R-A2** (`research/28`, `research/29`) — fixed-date rollover, closed Q-OUG156-ART174 and Q-ART174-ALIN7-ATTRIBUTION, minted **B-57**. **R-B** (`research/30`) — the 12H gate, closed **L-2** as a negative, corrected six beliefs this project held.

**Queue rewritten 2026-10-10 after reading the register in full.** Four of the original L-items **overlap each other**, so they are merged rather than briefed separately — briefing L-3, L-5, L-6 and L-8 as four scouts would pay four times for three questions.

| ID | Question | Why it is needed, and what breaks without it | Feeds |
|---|---|---|---|
| **R-B2** | **Feasibility of the normă dataset.** For each of the 42 ANAF county PDFs: is the text machine-readable or an image scan, and how many value columns does the table have? Do all 42 publish **coeficienți de corecție** for 2026 (art. 69 alin. (2) lit. b) requires them)? Plus two cheap pins: the row count of the OMFP 1.960/2025 annex (PL 306193), and the MO number of **OG 16/2022** art. I pct. 30. | **This is the last thing standing between 12H and a plan.** `research/30` answered *can the amounts be cited* (yes, per county) but not *can they be obtained at scale*. A secondary source claims 9 of 42 are scans — unverified. If that is true, 12H is manual transcription of up to 42 tables, which changes its cost and may reverse **D-NORMA-1**. Without the coefficients there is no defensible *norma ajustată*, and the 10 % tax base is wrong | **12H**, D-NORMA-1 |
| **R-C** | **FY2027: what is known now, and what expires on 31 December 2026?** The minimum-wage act for 1 ianuarie 2027 (the governing value under CF art. 135^1 alin. (3)); the 2027 budget/finance law; **any CF relief with a sunset date** — we already caught one 2025-only measure (OUG 8/2026 art. 8), so "carry forward" is not automatically safe in that direction. Status of **Q-PENDING-B4-2026** and **Q-PENDING-10MAI**. **Absorbs L-8:** what is filed and paid after 31 December 2026 for FY2026, and whether the OUG 8/2026 art. 8 early-filing bonus reaches FY2026. | **D-YEAR-2 says carry forward; this decides whether carrying forward is safe.** PG-4's year lifecycle is built on the answer, and §12.4 makes the 2027 package a standing task with a trigger roughly twelve weeks out. A carried-forward relief that expired on 31 December is a wrong number with a confident label | **D-YEAR-2**, PG-4, B-48 |
| **R-E** | **The closed lists the app is allowed to model.** Art. 155 alin. (1) lit. a)-h) and art. 61 categories verbatim; and art. 322 alin. (3)-(4) VAT periodicity mechanics — what the pro-rated estimate actually requires of the taxpayer. **Absorbs L-5** (which amounts other income contributes to the CASS base and top-up and to CAS) and **L-6** (D300 periodicity facts). | **Q-MULTI-SOURCE bounds 12F:** the app may model only income categories the sources of record name, and must refuse the rest. Without the verbatim list, 12F invents categories — the exact failure **D-SCOPE-2** obliges us to refuse instead. **Q-VAT-PERIOD** is a missing *input*, not a missing source, but 18B cannot ask for the right input until someone states what art. 322 alin. (3)-(4) actually asks of the taxpayer | **12F**, **18B**, B-41, B-35 |
| **R-D** | **Three legal claims sitting in user-facing copy, plus one open U-item.** (a) Which declarations does a 2026 sistem-real PFA actually file — the documents copy still teaches **D100 / D220** and lists D101, D112, D200, 220, 221; (b) when is a **cod de TVA intracomunitar** genuinely required; (c) the official Romanian name of the RJIP register; (d) **Q-NONDEDUCT-VAT (U-1)** — does non-deductible TVA enter the deductible expense for a neplătitor de TVA. **Absorbs L-3** (input VAT deductibility, the 50 % cases, non-recoverable VAT) — same question as (d), briefed twice before | (a)-(c) are **PG-12** items that carry legal content and cannot be fixed as copy; (d) is **B-30**, which gates declaring Phase 13 complete, and today rests on inference only | PG-12, **13**, B-30, B-55 |
| **R-F** | **Fixed assets for a PFA in 2026:** the asset-value threshold (OUG 8/2026?), depreciation methods and useful lives, purchase-vs-depreciation treatment, and how depreciation interacts with a cash-basis regime. | **B-31 has been open since research 21** and CF art. 68 alin. (7) lit. h) makes the purchase of depreciable goods **never** a direct expense. Today a capital purchase is deducted in full. 12G cannot be written without the threshold and the method | **12G**, PG-6e |
| **R-G** | **An invoice with no payment or collection date** in sistem real: is income realised when issued or when collected, and what happens to an expense paid in a different year? | **D-DATE-1 is already decided as product behaviour** — the document date stands in, and the user is told — but **the legal basis has never been cited**. A product decision shipped without its rule | **12C**, PG-2, D-DATE-1 |

**Not queued, with reasons.** L-1 and L-1b are done (`research/26`, `research/27`). L-2 is **closed as a negative** by `research/30` §3 — no CAEN-to-method mapping exists in law, so there is nothing to research and a mapping table must not be built. Q-VAT-PERIOD, Q-ROLLOVER-FIXED-DATE and Q-ANAF-SAMBITA are **not research gaps** — they are missing inputs or authority gaps, and re-briefing them has already cost this project time twice.

| ID | Question | Feeds | State |
|---|---|---|---|
| ~~**R-A**~~ | ~~Fixed statutory date rollover~~ **DONE** — `research/28`, `research/29`. ANAF's own 2026 calendar publishes the 25-octombrie block as **26 octombrie** and D398/D396 as **31 octombrie, expressly not rolled**. Closed Q-OUG156-ART174 and Q-ART174-ALIN7-ATTRIBUTION. Minted **B-57** | Q-ROLLOVER-FIXED-DATE, Q-ANAF-SAMBITA | **done** |
| ~~**R-B**~~ | ~~Normă de venit 2026, primary-source gate~~ **DONE** — `research/30`. Buildable as a **per-județ** dataset of 42 county decisions, not a national table. Closed **L-2** as a negative. Corrected six beliefs this project held | **12H**, D-NORMA-1 | **done** |
| **R-C** | **FY2027: what is known now, and what expires on 31 December 2026?** The minimum-wage act for 1 ianuarie 2027 (the governing value under CF art. 135^1 alin. (3)); the 2027 budget/finance law; any CF relief with a sunset date — we already caught one 2025-only measure (OUG 8/2026 art. 8), so "carry forward" is not automatically safe in that direction. Also the pending bills' status (**Q-PENDING-B4-2026**, **Q-PENDING-10MAI**). | **D-YEAR-2** standing task, PG-4 lifecycle | queued |
| **R-D** | **Three legal claims sitting in user-facing copy, plus one open U-item.** (a) Which declarations does a 2026 sistem-real PFA actually file — the documents copy still teaches **D100 / D220** and lists D101, D112, D200, 220, 221; (b) when is a **cod de TVA intracomunitar** genuinely required — the hint claims any EU collaboration needs it; (c) the **official Romanian name** of the RJIP register/declaration and correct agreement; (d) **Q-NONDEDUCT-VAT (U-1)** — does non-deductible TVA enter the deductible expense for a neplătitor de TVA? Only inference exists today. | PG-12 / proof-check §5, §7; **Q-NONDEDUCT-VAT** | queued |
| **R-E** | **The closed lists the app is allowed to model.** Art. 155 alin. (1) lit. a)-h) and art. 61 categories verbatim, so **12F** models only what the sources name and refuses the rest (**Q-MULTI-SOURCE**); and art. 322 alin. (3)-(4) VAT periodicity mechanics — what the pro-rated estimate actually requires of the taxpayer, so **18B** knows which input to ask for (**Q-VAT-PERIOD**, **L-6**). | **12F**, **18B**, B-41, B-35 | queued |
| ~~**L-3 … L-7**~~ | Merged into the queue above: **L-3 → R-D(d)**, **L-5 and L-6 → R-E**, **L-4 → R-F**, **L-7 → R-G**. Briefing them as five separate scouts would have asked the same question twice (L-3 and Q-NONDEDUCT-VAT) and split one question across three | PG-6, PG-5, PG-2 | merged |

Every scout note separates **FACT / INTERPRETATION / UNKNOWN**. Unknowns become `REVIEW_REQUIRED` behaviour, never defaults.

---

## 4. Decisions only the owner can make

| ID | Decision |
|---|---|
| **D-1** | An invoice with no collection date: keep "use the document date" (today's behaviour), require a date, or treat it as not yet collected? |
| **D-2** | Reserve horizon: spread to year end (today) or to 25 May of the following year? |
| **D-3** | `normă de venit` at launch: confirm "not supported, explicit screen". |
| **D-4** | Mid-year start: the projection method, **after L-1 answers**. |
| **D-5** | Year change: auto-prompt on 1 January, or manual only. |
| **D-6** | Who owns the disclaimer and terms wording. |
| **D-7** | Calculation sheet export: print stylesheet, PDF, or JSON. |

---

## 5. Reporting format, per task

IMPLEMENTED (files) · TESTS (counts, re-measured) · SCOUT NOTES (paths) · OPEN RISKS (with defect ids) · WHAT WAS NOT DONE. Nothing may be claimed as implemented that was only scaffolded.

---

## 6. What the second reviewer added beyond the first audit

Silent exclusions under "Calculat" (§PG-1). Summary versus estimate disagreeing on currency (PG-7). Year-rollover drift and no closed-year state (PG-4). No onboarding and no start-from-scratch path (PG-3). No disclaimer anywhere (PG-10). Accessibility: contrast 4.43:1, no `<main>`, no skip link (PG-12). Triple computation and a 902 kB single chunk (PG-12). Rule statuses that say ACTIVE while the rule carries an unresolved conflict (PG-9). B-30 and the STATE.md test-count contradiction, both of which the first audit missed.

---

## 7. Claims re-verified in-tree by the Orchestrator, 2026-10-10

| Claim | Result |
|---|---|
| `addSnapshot` has no caller | **Confirmed.** `data/store.tsx:98` declares it and `:349` implements it; the only other mention is a comment in `domain/snapshots/hashSync.ts:13`. The app never persists a calculation record, so the entire rule-immutability and R1/R2 replay machinery has no live write path |
| "Date lipsă: Estimare impozit" can never clear | **Confirmed, and it is the same defect.** `domain/completeness.ts:180` defines the check as "at least one snapshot with status `computed`", and no snapshot is ever created. PG-1's removal of the circular check and PG-8's snapshot persistence are one fix seen from two ends |
| `STATE.md` contradicts itself on test counts | **Confirmed.** Line 50 still reads "64 test files, 1149 unit tests" while the header and the TASK 10b entry read 77 / 1332 |
