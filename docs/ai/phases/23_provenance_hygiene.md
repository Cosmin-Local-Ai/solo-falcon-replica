# Phase 23 — provenance, seed and layout hygiene (pre-Phase-11 TASK 9)

Date: 2026-10-09. Brief: `docs/ai/briefs/25_task9_provenance_hygiene.md`.
Commits: `a20fd81` (wiring + one card system + chart), `0716325` (provenance tests),
`b8b4660` (citations), `76b50ca` (seed), `dd7f812` (e2e re-pins + reserve reload test).
Baseline inherited: `tsc` 0 · 63 files / 1121 tests · `build` 0 · `e2e` 36.
Result: **`tsc` 0 · 64 files / 1149 tests · `build` 0 · `e2e` 37** (27 dashboard + 10 settings).

---

## 1. What this task was

Two halves that look unrelated and are not. **Part A** — `copy.provenance` existed and nothing rendered
it, so the app could name a rule package but never say which rules produced the number on screen.
**Part B** — the demo taught a Romanian PFA things the law does not ask of it (monthly and quarterly
social-contribution filings) and called it an SRL while every rule in the app resolved it as a PFA.
Both are the same failure: **a figure on screen whose origin the app could not state.**

Nothing was redesigned. This is hygiene.

---

## 2. Provenance: the domain view

`src/domain/snapshots/ruleProvenance.ts` (added by TASK 6 as `snapshotRuleState` /
`resolveSnapshotRules`) now carries a rendering-shaped view:

```
RuleProvenanceState = SnapshotRuleState | 'no_release'      // pinned | drifted | unregistered | unpinned | no_release
SnapshotRuleProvenance = { state, releaseId | null, recordedHash | null, registeredHash | null, citations }
describeSnapshotRuleProvenance(snapshot, registry?)   // the view, from a stored record
noRulePackageProvenance()                             // the `no_release` answer, for a row with no record at all
```

Three rules, each of which is a refusal to invent something:

- **`recordedHash` is `snapshot.ruleSetHash` verbatim.** It is never minted, never recomputed, never
  filled in from the current package. A snapshot predating TASK 6 has `ruleSetHash: null` and stays
  `null` on screen.
- **`registeredHash` is the digest of the *effective applied* rule set**, not `RuleRelease.contentHash`.
  Those are different granularities — `phases/20_rule_release_immutability.md` §3 — and comparing a
  snapshot's digest against the wrong one would manufacture a `drifted` warning that never happened.
- **Citations travel only with `pinned` and `drifted`.** For `unpinned` and `unregistered` the app does
  not know which rules produced the figure, so it cites nothing; a citation attached to an unknown rule
  set is a guess wearing a reference.

`drifted` is **surfaced, never repaired**. Re-hashing a snapshot to silence the warning would destroy
the only evidence that a published release was edited in place — the exact failure TASK 6's registry
made impossible going forward. The row shows the recorded digest and the digest that is current now,
side by side, and mutates nothing.

`no_release` is a fifth state this task added: an attention row about a figure the engine **refused**
to compute has no calculation record at all. It is not `unpinned` (which means "a record exists, from
before digests"), and it must not borrow one.

### Where it renders

| Surface | Component | When |
|---|---|---|
| The estimate hero | `pages/Dashboard.tsx`, `Disclosure` labelled `copy.provenance.label` („Regulile din spatele acestei cifre") | only when `DashboardData.provenance != null` — a refused calculation shows no block |
| `Observații` rows | `components/Insights.tsx` | figure-bearing rows only |
| `Ce trebuie să faci` rows | `components/dashboard/ActionSection.tsx` | figure-bearing rows only |
| `Legislație` card | `components/dashboard/LegislationSection.tsx`, `copy.provenance.labelRules` („Regulile din spatele acestor rânduri") | when the rows come from a rule package |

`src/domain/attention.ts` exports `FIGURE_SOURCES = ['tax', 'reserve', 'threshold']` and
`isFigureSource()`. **A row about a document, a date or a missing fact carries no provenance**, because
no calculation produced it; attaching a digest there would claim a computation that never ran.
`src/data/dashboard.ts:estimateProvenance(tax)` returns `null` unless `tax.status === 'computed'`, so
the wiring has exactly one decision point and no surface can invent its own answer.

The article stays on screen **beside** every digest, and `copy.provenance.digestIsNotACitation` says so
in words: a digest is a content address, not a legal provision.

### Tests (all five states, not just the happy one)

`src/domain/snapshots/ruleProvenance.test.ts` 7 → **14** · `src/components/ui/RuleProvenance.test.tsx`
**6** (new) · `Insights.test.tsx` +3 · `ActionSection.test.tsx` +2 · `LegislationSection.test.tsx` +2 ·
`Dashboard.test.tsx` +2 (5 → 7) · `dashboard.test.ts` +5 (52 → 57).

`unpinned` is the state most of this app's history actually lives in — every snapshot written before
TASK 6 — so it is tested for the absence of a digest as well as for the sentence:
`expect(container.textContent).not.toMatch(/[0-9a-f]{16,}/)`.

---

## 3. Citations: the two wage acts moved off a commercial mirror

`legalteka.ro` appeared five times in production code: `package2026.ts:50,65,80` (`sourceUrl`) and
`release2026.ts:108,109` (`evidence[]`). No test pinned those URLs, and the existing guard
(`fiscal.test.ts:617-623`) only refused *project* documents as citations — a mirror passed it.

| Act | Was | Now |
|---|---|---|
| HG nr. 1.506 **din 27 noiembrie 2024** (MO I nr. 1185 din 28.11.2024) | `https://www.legalteka.ro/act/1506/2024` | `https://legislatie.just.ro/Public/DetaliiDocument/291450` |
| HG nr. 146 din 12 martie 2026 (MO nr. 196 din 13.03.2026) | `https://www.legalteka.ro/act/146/2026` | `https://legislatie.just.ro/Public/DetaliiDocument/308231` |

Both were reached on Portal Legislativ (Ministerul Justiției) and read off the page, not inferred:
the page title and header for 1.506 are „HOTĂRÂRE nr. 1.506 din 27 noiembrie 2024…", its Art. 1 fixes
„…la suma de 4.050 lei lunar" „începând cu data de 1 ianuarie 2025", and **HG 146/2026's own Art. 2
hyperlinks `DetaliiDocumentAfis/291450`** when it abrogates that act — the register cross-references
itself, which is how the id was obtained rather than guessed. `308231` was already the id recorded in
`docs/ai/research/06_2026_fiscal_research.md:243`; it is confirmed correct.

**Correction recorded:** the act is *din 27 noiembrie 2024*. **28.11.2024 is the Monitorul Oficial
issue date**, which is what `package2026.ts:21` cites („MO I 1185/28.11.2024") — so no date in the code
was wrong, but the distinction is now written down where someone will reach for it.

**Bonus finding, and it closes a question the package leaves open:** HG 1.506/2024 never mentions
1 ianuarie 2026. It has two articles, and Art. 1 is an open-ended „începând cu" provision with no
second tranche and no end date, so 4.050 lei ran continuously from 01.01.2025 to 30.06.2026. HG
146/2026 Art. 2 abrogates it directly, with no intervening instrument, and the Portal's own
chronological listing for the title runs 146/2026 → 1506/2024 → 598/2024 → 900/2023. **There is no
2025 or H1-2026 minimum-wage act**, which is why the 1 January 2026 anchor in `package2026.ts` is
correct as written.

`sourceAct` strings are deliberately **unchanged** (`'HG 1506/2024'`, `'HG 146/2026'`):
`thresholds.ts` maps them to `computedFrom.smAct`, and `ThresholdSection` plus four tests cite them
verbatim. Changing the citation is not a reason to churn the identifier.

**No digest, snapshot or release version moved.** `ruleSetDigest.ts` excludes `sourceAct`,
`sourceArticle`, `sourceUrl` and `verifiedAt` by design — „**a hash is not a legal citation**"
(`ruleSetDigest.ts:30-31`). Re-pointing a citation therefore cannot invalidate a stored snapshot, and
no data version bump was needed.

New guard in `fiscal.test.ts`: every citation host must be on an **allow-list** of official publishers
(`legislatie.just.ro`, `static.anaf.ro`) — a block-list would be passed by any mirror that has not been
invented yet — and the wage rules must cite a `/Public/DetaliiDocument/<id>` record, not a search page.

Historical mentions of `legalteka.ro` remain in `phases/02_fiscal_baseline.md:480`,
`notes/phase5_worker_notes.md:205` and `steps/01…:85`. Those are records of what was done at the time,
not live citations; `docs/ai/steps/` is frozen and was not touched.

---

## 4. The seed: what it claimed, and what the law says

### 4.1 Identity — the app called the taxpayer an SRL

`profile.identity.denumire` was `'Popescu Consulting SRL'` and `formaJuridica` `'SRL'`, while
`regime: 'impozit_pe_venit'`, the CAS/CASS rules under CF art. 150 / 174, the D212 deadline and every
threshold resolved the profile as a **persoană fizică autorizată**. An SRL does not file a D212 at all.

| Field | Old | New |
|---|---|---|
| `profile.identity.denumire` | `Popescu Consulting SRL` | `Popescu Andrei PFA` |
| `profile.identity.formaJuridica` | `SRL` | `Persoană fizică autorizată` |
| `settings.company.denumire` / `.formaJuridica` | same SRL pair | same PFA pair |
| `settings.company.cnp` | `RO4455667788990` (a CUI in a CNP field) | `1234567890123` (the person's CNP) |
| `profile.numarRegComert` | `J40/1234/2020` | unchanged |
| `profile.pfaStartYear` | `2020` | unchanged |

`numarRegComert` stays because **a PFA is registered at ONRC** — a `J` number is not an SRL artefact —
and it is what makes `pfaStartYear: 2020` coherent instead of a stray year. The schema requires the key
(`pfaIdentitySchema.numarRegComert: z.string()`), so removing it was not available anyway.

`settings.company` is the retired legacy block that `legacyProfileFromSettings` absorbs from
(`migration.ts:168-204`), so it carries the same correction: `store.migration.chain.test.tsx:418`
asserts the migrated identity against `seedData.settings.company.denumire`, which means the two blocks
cannot be allowed to disagree. `settings.company.cnp` is read by nothing — `identity.cnp` is absorbed
from `settings.personal.cnp` — but a PFA has no legal personality separate from the person, so the only
CNP that block could honestly hold is the person's.

### 4.2 Declarations — records of filings that do not exist

Removed: `d1` (2026-03, `transmisa`, 12.500 / 1.800), `d2` (2026-06, `in-asteptare`, 14.200 / 2.100),
`d3` (2026-09, `inregistrata`, 9.680 / 546). `declarations: []`.

Two independent reasons, either sufficient:

1. **No such obligation.** For a PFA în sistem real the statutory return is the Declarația Unică 212,
   **once a year, by 25 May** of the following year — CF art. 122 alin. (3). Art. 120 / 120¹, the
   estimated-advance filings, were **abrogated by OUG 128/2024 from 01-01-2025**.
   `docs/ai/research/12_quarterly_payment_deadlines_2026.md` §6 rules on the six deadline event types
   the app once modelled: four „**Obligation does not exist**", one to correct, and `d212_filing` —
   „**the *only* real deadline of the six**". `docs/ai/research/06_2026_fiscal_research.md` §3 row 1
   records that D212 **replaced form 232 (income tax) and form 220 (social contributions)** with effect
   from 1 April 2018 (MO nr. 260, 23.03.2018).
2. **The figures contradicted the registers.** 2026-09 claimed venituri 9.680,00 lei and cheltuieli
   546,00 lei. September's recorded documents total **7.700,00 lei net revenue** (r1 4.500 + r4 3.200;
   r2 is `in-asteptare`, r3 `respinsa`) and **205,50 lei of recorded expenses** (e1 120,00 + e2 85,50;
   e3 is `respinsa`). A "summary" whose numbers do not summarise anything is a fabricated fact.

**Not replaced by anything.** The alternative considered — keeping the rows as the app's own internal
monthly summaries — was rejected: it would need their figures rewritten to the real monthly totals
(March 0, June 0, September 7.700 / 205,50), which leaves two empty rows and one row that duplicates
the registers, and it would redefine what a `Declaration` is. That is a model change, and the model
change was explicitly out of scope. **A nil return was rejected outright**: there is no monthly
declaration obligation for this profile, so a nil return is a filing that was never due — the same
mistake in a cleaner uniform.

**Condition 2 checked, not assumed.** The annual D212 must not manufacture a second deadline. The
rule-driven engine already emits it: `PFA_DEADLINE_2026` / `d212_filing` at **2027-05-25**, pinned in
`dashboard.test.ts:709-716` and rendered by `e2e/dashboard.spec.ts` as the single deadline row
(„Depunere D212 · PFA · 25.05.2027"). Against the app's as-of date it is **228 days away**, so it
surfaces as exactly one attention item at **`low` severity — „prioritate scăzută"** — and not as
urgent or overdue. No seed record is a source of a deadline anywhere.

### 4.3 Quarterly D100 / D220 artefacts

| Where | Old | New |
|---|---|---|
| `companyDocs.im` | `Declarația 100 – Q2 2026.pdf`, perioada `Q2 2026` | `Declarația 212 – venitul anului 2025.pdf`, perioada `2025`, depusă `2026-05-20` |
| `companyDocs.cs` | `Declarația 220 – Q2 2026.pdf` | `[]` — D212 is **one** form covering income and contributions; a second copy of the same document in a second section would be a duplicate, and the section has its own empty state |
| `documents` `doc2` | `Declarația 220 – Q2 2026.pdf` (2026-07-10) | `Declarația 212 – venitul anului 2025.pdf` (2026-05-20) |
| `statements` | `s1` tip `100` `2026-Q2` SOLO · `s2` tip `220` `2026-Q2` SOLO · `s3` tip `300` `2026-08` personală | `s1` tip `212` `2025` personală · `s3` unchanged |

`depunere: 'personală'` because a persoană fizică files the D212 in their own name; `'SOLO'` is the
employer/payroll transmission channel.

**D100** is the return for payroll obligations. This profile records no employees anywhere in `AppData`,
so it owes none; `research/12` §3 puts it beside D112 (CF art. 147): the payroll return „does not apply
to a PFA's own CAS". **D220** has not existed since April 2018.

**The D300 row is deliberately NOT touched, and that is a decision, not an oversight.** CF art. 322
alin. (1)-(4) makes the fiscal period the **quarter** for a taxpayer whose previous-year taxable
supplies stayed under the 100.000 € equivalent, and the **month** otherwise (`research/13` §2:
„Monthly is the residual default, not the rule"). Which of those this profile is depends on its VAT
registration date and its prior-year turnover — **facts the seed does not record anywhere**. Changing
`'August 2026'` to a quarter would invent one half of that choice. It is registered as a finding in §5.

### 4.4 Copy that claimed a monthly cadence

`copy.records.declarations.subtitle` was `'Declarații fiscale lunare — IM, CS, TVA'`. The page is a
register of the declaration records the app holds; it cannot promise a statutory cadence it does not
model, and after §4.2 it has no monthly rows to describe. Now:
`'Declarații fiscale — ce ai înregistrat în aplicație'`. Nothing pinned the old string.

### 4.5 Condition 3 — gross and deductible stay visibly distinct

September's gross recorded expenses are **205,50 lei**; the deductible subset is **120,00 lei**
(e1 `postal_and_telecom` only — e2 is `personal_or_family_use`, expres nedeductibilă prin CF art. 68
alin. (7) lit. a), and e3 never reaches the aggregate because it is `respinsa`). With the declaration
rows gone, **no surface in the demo displays 205,50 as a filing figure any more**. Where expenses do
appear, the labels are already distinct: the `Rezumat` card says „Cheltuieli" for the recorded total,
and the estimate breakdown says „Cheltuieli deductibile" for the 120,00 / 144,00 subset. No new label
was needed, and none was invented.

### 4.6 No money figure moved — measured, not assumed

Hand derivation at the e2e clock 2026-10-31 (10 elapsed months, factor 12/10 = 1,2):

```
registered revenue (status 'inregistrata')   r1 4.500 + r4 3.200  =  7.700,00 lei net   (9.317,00 cu TVA)
registered expenses (gross)                  e1 120,00 + e2 85,50 =    205,50 lei
deductible subset                            e1 only              =    120,00 lei
projected                                    7.700 × 1,2 / 120 × 1,2 = 9.240,00 / 144,00 lei
VNA                                                                   9.096,00 lei
CAS      VNA < 12 SM (48.600)                                          → 0
CASS     floor 6 SM = 24.300 → 10% = 2.430; owed 10% × 9.096 = 909,60 → art. 66 → 910  → 2.430
impozit  10% × (9.096 − 910) = 818,60 → art. 66 → 819                  →    819
total                                                                 3.249,00 lei
reserve  3.249 ÷ 3 months                                             1.083,00 lei/lună
```

At 2026-12-31 (elapsed 12): VNA 7.580 · CASS 2.430 · impozit 682 · **total 3.112,00 lei**.
The `51.510 lei` figure is **not** the seed — it is a fixture (130.000 lei net YTD → 156.000 projected
→ CAS 24.300 + CASS 15.600 + impozit 11.610).

Every one of those figures is pinned by the suite and **all of them still pass unchanged**. Removing
declarations, statements and documents moved no money, which is the stop-condition the brief set.

### 4.7 The CUI-collision claim: verified, and stale

The brief asked whether the seed's CUI collision was real. **It does not reproduce.** The taxpayer's
CUI `RO4455667788990` appears in `profile.identity.cui`, `settings.company.cui`,
`settings.company.codFiscal` and `identity.codTvaIntra` — four fields, **one entity**, and the last is
correct by construction (a Romanian VAT code is the CUI with the `RO` prefix). No customer shares it:
`RO12345678` (r1, r4, c1), `1234567890123` (r2, c2), `9876543210987` (r3, c3); suppliers
`RO87654321`, `RO11223344`, `RO55667788`.

What **is** odd, and is recorded rather than "fixed": `profile.identity.cnp` (`1234567890123`) is the
same string as client `c2`'s and revenue `r2`'s `cui` — **the taxpayer invoiced himself**. That is a
plausible demo situation (a PFA billing an individual who happens to share the CNP format) and not a
collision of the taxpayer's own identifiers. There is also **no CUI validation anywhere** in the app:
the „CUI nevalid" on `r3` is a static seed string, not the output of a check. Recorded, not fixed.

---

## 5. Model defects recorded, not fixed

Both belong to a later phase. Neither is patched here, because patching either would be a model change
inside a hygiene task.

**D-DECL-1 — `Declaration` is monthly `{an, luna}` while the only statutory filing for this profile is
annual.** `src/data/types.ts:91-101`. The shape cannot represent the D212 for FY2026 (due 25 May 2027)
honestly: `an`/`luna` would have to mean either the period covered or the month of filing, and either
choice is a lie about the other. Consequence measured today: the `declarations` completeness check
(`completeness.ts:158-166`) asserts that *presence* of declaration records is a fact the app should
hold, so with an honest empty seed it reports `Lipsă` and the dashboard raises
**„Date lipsă: Declarații"** — a nudge toward records the law does not ask for. That item is honest
about the data and misleading about the obligation, and it is the cost of leaving the model alone.
Citations: `research/12` §6 (art. 120/120¹ abrogated by OUG 128/2024 from 01-01-2025; art. 122 alin. (3)
= 25 May; `d212_filing` is the only real deadline) and `research/06` §3 row 1 (D212 replaced 232 and
220 from 01.04.2018).

**D-VAT-1 — the seed's D300 periodicity is undetermined by its own facts.** `seed.ts` `statements.s3`
(tip `300`, perioada `2026-08`) and `companyDocs.tva` say monthly. CF art. 322 alin. (2) makes the
period the **quarter** when previous-year taxable supplies stayed under the 100.000 € equivalent, and
alin. (3)-(4) pro-rates that test for a taxpayer registered mid-year; monthly is the residual default
(`research/13` §2). The seed records no VAT registration date and no prior-year turnover, so the input
fact is missing and the row is neither right nor wrong on the evidence available. Fixing it requires
recording the VAT registration date on the profile — a model change.

---

## 6. Layout: one card system, and a chart that fits

**Two card systems had become one job.** `components/ui.tsx` `Card` rendered a `<div class="card">`
with a bare `<h3>`; `components/ui/card.tsx` `Card` rendered `<section class="card">` with
`CardTitle` → `h3.card-title`; and four dashboard surfaces hand-rolled `<div class="card-head">`.
Now: `ui/card.tsx` is the system — `<section class="card">` + `CardHeader` + `div.card-body`, and
`CardTitle` defaults to **`h2.card-title`** (the `level="h3"` prop stays for a card nested inside a
card, which is what the `Legislație` item cards are). `ui.tsx` `Card` matches it. The five dashboard
sections (Praguri, Termene limită, Completitudine date, Ce trebuie să faci, Legislație) pass
`header={<CardHeader>…}`, and `.card-head` is gone from `Dashboard.tsx`, `FinancialChart.tsx`,
`FinancialSummary.tsx`, `TaxReserve.tsx` and `Insights.tsx`. CSS: the `.card-head` rule and the
`.card-header h3` rule are deleted; `.card-title` sits next to `.card-header`.

**The chart was wider than the box it was in.** `.chart-scroll > *` forced `min-width: 640px`
(480px under the 640px breakpoint). At a 390px viewport the card body is **~356px**, so the chart
rendered ~640px and was clipped by its own scroll container. The existing overflow tests passed the
whole time because **the page did not overflow — the chart was simply cut off.** Now `min-width: 0;
width: 100%`, so `ResponsiveContainer width="100%"` gets the real width.

Proven in a real browser, and the assertion is proven to bite: re-introducing `min-width: 640px` makes
the mobile test fail with **`chart child 640px in a 356px box`**; with the fix it passes. The assertion
measures the container and its child, and that the container has nothing left to scroll to.

---

## 7. Tests: every re-pin, old → new

No assertion was deleted, no matcher loosened and no timeout widened. Every change below is a
replacement, recorded here.

**Unit (63 → 64 files, 1121 → 1149 tests).**

| File | Change |
|---|---|
| `domain/snapshots/ruleProvenance.test.ts` | 7 → 14: `describeSnapshotRuleProvenance` for all five states |
| `components/ui/RuleProvenance.test.tsx` | **new**, 6 tests, one per rendering |
| `components/Insights.test.tsx` | +3: pinned row (sentence + digest + citation + the not-a-citation line); no provenance on a non-figure row; `unpinned` renders **no** digest |
| `components/dashboard/ActionSection.test.tsx` | +2: `drifted` shows both digests and repairs nothing; no provenance on record rows |
| `components/dashboard/LegislationSection.test.tsx` | +2: provenance beside the act the card already names; none when there is no calculation |
| `pages/Dashboard.test.tsx` | 5 → 7: the hero is `pinned` on the seed; a refused calculation gives the hero no block and the rows the `no_release` answer |
| `data/dashboard.test.ts` | 52 → 57: `estimateProvenance`, the legislation items, the figure-source rows, `no_release` on a withheld conclusion; the four-record action test becomes three seed records **plus** a declaration fixture |
| `domain/fiscal/fiscal.test.ts` | +1: official-host **allow-list** + wage rules must cite a `/Public/DetaliiDocument/<id>` record |
| `domain/attention.test.ts` | the record family: `['d2','e3','r2','r3']` → `['e3','r2','r3']`, with the declaration case now run against a fixture the test owns (every d2 assertion kept) |
| `App.test.tsx`, `pages/Settings.test.tsx` | sidebar / `SEED_DENUMIRE`: `Popescu Consulting SRL` → `Popescu Andrei PFA` |
| `data/store.edit.test.tsx`, `pages/Declarations.test.tsx` | own their declaration records (payload at `CURRENT_DATA_VERSION`, so no migration scales the money) |
| `data/store.save.test.tsx` | cycle 5 adds a declaration then updates it, instead of updating the seed's `d2` |
| `data/schema.test.ts` | the invalid-declaration test builds from a fixture and now **also** asserts the valid one parses — spreading `seedData.declarations[0]` (now `undefined`) would have made it pass for the wrong reason |

**e2e (36 → 37; 26 → 27 dashboard, 10 settings).**

| Test | Old → new |
|---|---|
| cockpit `Date complete` | `8/9` → **`7/9`** |
| `Completitudine date` | `8 din 9 verificări îndeplinite` → `7 din 9`; `Complet` 8 → **7**; `Lipsă` 1 → **2**; adds `nu există declarații` and the per-section document detail `im: 1, tva: 1, facturi: 3` |
| `Ce trebuie să faci` | still **6 elemente de rezolvat**, but one row changed identity: `Declarație fără depunere înregistrată: 2026-06` → **`Date lipsă: Declarații`** (with an explicit absence assertion for the old row). Badges: `Declarație` 1 → **0**, `Completitudine` 1 → **2**. Severities unchanged (1 / 4 / 1) — the row that left was `medium` and the one that arrived is `medium` |
| section headings | the five `h3` section titles are now `h2.card-title`; `sectionWith`'s default level `h3` → `h2`; two `filter({ has: h3 })` sites move |
| mobile FY2025 chart | new measurements inside the existing test: the chart child may not exceed the container, and the container may not have content it cannot show |
| `SEED_SETTINGS`, `settings.spec` sidebar pin | follow the PFA identity |
| **new test** | *a recorded reserve survives a reload*: no `addInitScript` (it re-runs on reload and would overwrite what the UI saved, making the assertion vacuous — the same reason `settings.spec.ts:125` avoids it); asserts `Nicio sumă înregistrată.` → save `1500` → `1.500,00 RON` → **reload** → still `1.500,00 RON`, `reservedAmount === 150000` **bani** in the payload, and that clearing returns `null`, not `0` |

The action count staying at 6 rather than dropping to 5 is a finding, not a missed re-pin: removing the
fictional `d2` row **adds** a completeness row, because the app genuinely holds no declaration record.
Net effect on the user: one row that asserted a filing that was never due is replaced by one that states
a fact.

---

## 8. Docs hygiene

- `docs/ai/phases/_WORKING_NOTES_phase10.md` → `docs/ai/notes/working_notes_phase10.md`
- `docs/ai/phases/_WORKING_NOTES_task1.md` → `docs/ai/notes/working_notes_task1.md`
- Two briefs numbered 14: `14_task1_projection_estimate.md` is the one the record cites
  (`phases/12_projection_annual_estimate.md:3`, `STATE.md`, the working notes) and keeps the number.
  `14_projection_tax_estimate.md` — the worker-facing variant nothing references — is retired to
  `docs/ai/notes/brief14_projection_tax_estimate_superseded.md` with a header naming the survivor.
- `docs/ai/steps/` was not touched.

---

## 9. NEXT HANDOFF (TASK 10 — currency on the money record + FX rate store, defect B-32)

- **e2e baseline is 37** (27 `dashboard.spec.ts` + 10 `settings.spec.ts`). `STATE.md` and `PLAN.md` are
  updated to it. Do not re-derive it.
- **Unit baseline: 64 files / 1149 tests.** `tsc` 0, `build` 0.
- **The seed's money figures and their derivations are in §4.6.** They are unchanged by TASK 9 and are
  pinned by the suite: deductible 120,00 / projected 144,00, VNA 9.096,00, clock total 3.249,00,
  reserve 1.083,00, year-end 3.112,00. TASK 10 adds a currency to the money record — it must not
  re-derive these, and if a currency change moves any of them that is a finding to report, not a pin to
  update.
- **Provenance now renders on four surfaces** (estimate hero, `Observații`, `Ce trebuie să faci`,
  `Legislație`) through `components/ui/RuleProvenance.tsx`. A new surface that shows a computed figure
  must go through it, and `FIGURE_SOURCES` is the one place that decides which rows carry it.
- **TASK 10 must not re-derive:** the citation ids in §3 (291450, 308231); the `no_release` vs
  `unpinned` distinction; the rule that `recordedHash` is never minted; the D300 periodicity finding
  (D-VAT-1) and the monthly-`Declaration` defect (D-DECL-1), both open.
- **FX rates:** `research/23_fx_conversion_and_bnr_rates_2026.md` is the source for B-32; the euro-cap
  amounts in `package2026.ts` are still carried as unresolved `capUnresolved` parameters from TASK 2c,
  and `research/22` §6's reading of art. 68 alin. (6) is the one the user chose — do not reopen it.
