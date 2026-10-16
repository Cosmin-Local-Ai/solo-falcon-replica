# Phase 18 — TASK 4: threshold semantics and applicability

**Date:** 2026-10-09
**Brief:** `docs/ai/briefs/20_task4_threshold_semantics.md`
**Depends on:** TASK 3 (`698e180`, `docs/ai/phases/17_tax_reserve_persistence.md`) §13, and TASK 1
(`c49d88f`, `docs/ai/phases/12_projection_annual_estimate.md`) §6 — the annual-vs-YTD asymmetry.
**Legal input:** `docs/ai/research/24_cas_floor_consequence_2026.md`. Its two closing sections —
*What the app may state as law* / *What the app must not state* — are the acceptance boundary for
every string written here.

---

## 1. What changed, in one sentence

A threshold row now carries **what a crossing means in law** (`kind`), **whether it applies to this
taxpayer at all** (`applicability`), and **how much attention it deserves** (`severity`) — three
separate fields computed in three separate places — and the sentence that used to claim a below-floor
income causes a *dezcalificare din regim* is **deleted, not reworded**.

## 2. The finding that drove it

Research 24 read the consolidated Cod fiscal (through Legea 170/2026) and found:

- **zero** occurrences of „decălificare" anywhere in the Cod fiscal;
- **no** provision making a net income below 12 × salariul minim a breach, a regime change, a
  mandatory rectification, a penalty or a reportable event;
- the 12-SM figure is the **entry threshold** for the CAS obligation (art. 148 alin. (1)) and the
  **minimum** chosen base (art. 148 alin. (2) lit. a)); below it the consequence is
  *nu datorează contribuția de asigurări sociale*, with an optional election (art. 148 alin. (4));
- the only below-threshold outcome expressly legislated in Titlul V is art. 151 alin. (3), and its
  stated consequence is again *nu datorează contribuția*.

The app said the opposite. `thresholds.ts` `breachMeaningFor` returned, for every `min-base` row,
**`'Sub baza minimă — dezcalificare din regim'`**, and for `max-base`, **`'Peste plafonul maxim al
bazei — schimbare de regim'`**. Both were rendered on the seeded dashboard, on `CAS_MIN_BASE` and
`CASS_MIN_BASE`, under the prefix `La depășire:`.

## 3. What was deleted, and why it was not reworded

| Deleted | Where | Why deletion, not rewording |
|---|---|---|
| `breachMeaningFor()` (whole function, incl. the dead `'ratio'` and unreachable `'income'` branches) | `thresholds.ts:247-266` | Every branch asserted a consequence by *type*. The type is arithmetic; the consequence is law. |
| `'Sub baza minimă — dezcalificare din regim'` | same | A reworded sentence still asserts a consequence the law does not create. „decălificare" has 0 occurrences in the Cod fiscal. |
| `'Peste plafonul maxim al bazei — schimbare de regim'` | same | No provision links the 72-SM CASS cap to any regime change. |
| `FiscalThreshold.breachMeaning` (required field) | `thresholds.ts:92` | Renamed to `consequence`, so an un-migrated consumer is a **compile error**, not a stale string. |
| The `La depășire:` prefix | `ThresholdSection.tsx:108` | The prefix itself presumes a *depășire*. The consequence is now its own sentence. |
| `insights.ts`'s private `ratio >= 0.8` band and its hand-written CF citation | `insights.ts:144,154` + `133` | A second, uncited copy of the same application policy, and a second file restating art. 148. One home for each now. |

**Absence is asserted, not assumed.** New `src/domain/thresholds.language.test.ts` walks the real
source tree (Vite raw glob, the pattern `src/data/identity.source.test.ts` established) and fails if
either deleted sentence, any `decălificare`-family word, or the identifiers `breachMeaning` /
`breachMeaningFor` appear in app code again. `e2e/dashboard.spec.ts` additionally asserts
`La depășire:`, `dezcalificare` and `schimbare de regim` render **0** times.

## 4. The replacement: three independent fields

```text
FiscalThreshold {
  kind:           'registration' | 'tier_transition' | 'over_limit' | 'informational'
  engaged:        boolean            // which SIDE of the level the value is on (`engagedSide`)
  applicability:  'applicable' | 'not_applicable' | 'unknown'
  severity:       'none' | 'low' | 'medium' | 'high'
  measuredBasis:  'annual-projected' | 'annual-actual' | 'ytd-turnover' | 'unattributed' | 'unmeasured'
  consequence:    string             // factual + cited, chosen by the side the value is on
  computedFrom?:  { multiplier, smValueBani, smAct, note }   // SM-derived lei only
}
```

### 4.1 `kind` — declared per spec, never derived from `type`

| Row | `type` (arithmetic, kept for labels) | `kind` (law) | May it be `breached`? |
|---|---|---|---|
| `CAS_MIN_BASE` | `min-base` | `tier_transition` | **No** — art. 148 alin. (1)/(4) |
| `CAS_TIER2_FLOOR` | `tier-floor` | `tier_transition` | **No** — art. 148 alin. (2) lit. b) raises a *minimum* |
| `CASS_MIN_BASE` | `min-base` | `tier_transition` | **No** — art. 174 alin. (6) creates an amount owed, not a violation |
| `CASS_MAX_BASE` | `max-base` | `over_limit` | Yes — art. 170 alin. (1) really caps the base |
| `VAT_REGISTRATION` | `registration` | `registration` | Yes — art. 310 alin. (1) triggers a duty |

`statusFor` gained a fourth parameter, `kind`, and that addition **is** the change:

```ts
if (engagedSide(type, distance)) {
  if (kind === 'tier_transition' || kind === 'informational') return 'warning';
  return 'breached';
}
```

Pinned both ways in `thresholds.test.ts`: `statusFor('min-base', -100, 50, 'tier_transition')` →
`'warning'`, while `statusFor('min-base', -100, 50, 'over_limit')` → `'breached'`. The gate is the
kind, not the arithmetic.

### 4.2 `severity` — computed in one place, and it cannot see the kind

`severityFor` (`src/domain/thresholds.ts`) is the only severity decision for thresholds. Its parameter
is `{ applicability, status, distance, warningDistance }` — **there is no `kind` field to read**, so
the independence is structural rather than a convention. A test asserts exactly that
(`Object.keys(facts)` is those four names) and that the same facts give one severity while the same
kind at different distances gives different severities.

| Condition | Severity |
|---|---|
| `not_applicable` | `none` (whatever the status says) |
| `review_required` | `medium` |
| `breached` | `high`, or `medium` when applicability is `unknown` |
| `warning` | `medium` |
| `ok`, within 2 × the warning band | `low` |
| `ok`, far from the level | `none` |

`insights.ts` no longer decides severity; it maps `high→danger`, `medium→warning`, `low→info` and
filters out `none`. `Insights.tsx` and `severityRank` are untouched.

### 4.3 `applicability` — derived from the profile, never assumed

`applicabilityFor(spec, profile, measured, thresholdValue)`, one named test per spec:

| Spec | Test | Rule |
|---|---|---|
| `CAS_MIN_BASE`, `CAS_TIER2_FLOOR` | `cas-art-150-1` | pensioner / own social system → `not_applicable` (art. 150 alin. (1)). `salaryStatus` is **not** consulted: art. 150 alin. (2) covers only lit. b¹). |
| `CASS_MIN_BASE` | `cass-art-174-6` | CASS flag ≠ `obligatoriu` → `unknown` (B-19); base unmeasured → `unknown`; VNA ≤ 0 → `not_applicable` (art. 174 alin. (2)); pensioner → `not_applicable` (art. 174 alin. (7) lit. c)); salary declared but amount missing → `unknown`; salary ≥ 6 SM → `not_applicable` (art. 174 alin. (7) lit. a)). |
| `CASS_MAX_BASE` | `cass-art-170-1` | the flag / zero-year gates above, then **applicable** — a pensioner still owes 10 % × VNA, because lit. c) removes only the top-up. The CAS pensioner exemption is deliberately **not** mirrored. |
| `VAT_REGISTRATION` | `vat-art-310` | applicable only inside the TVA scutire. A profile that already applies VAT (`vatExempt: false`, the seed) has already passed the registration test → `not_applicable`. |

`unknown` is a real third state, not a synonym for `applicable`: the app refuses to decide an
exception it lacks the input for. `ThresholdQuery.profile` is optional so the domain can be called
with hand-built queries, and a **guard test** (`dashboard.test.ts`) asserts no production row comes
back `unknown`.

An inapplicable row is still measured and still rendered — with `Nu se aplică: <reason>` instead of a
consequence — and carries `severity: 'none'`, so it cannot reach *Observații* and cannot render as a
breach. Pinned at domain, component and e2e level.

## 5. The asymmetry TASK 1 left is now labelled, not unified

`buildThresholdBasisProvenance` (`data/dashboard.ts`) records how each supplied amount was produced,
and every row renders `Bază măsurată: …`:

- the four contribution rows → `venit net anual estimat pentru întreg anul` (or `…înregistrat până
  acum` when the projection model could not run) — CF art. 148 / 170 / 174 measure an **annual** value;
- `VAT_REGISTRATION` → `cifra de afaceri înregistrată de la începutul anului` — art. 310 alin. (1)
  measures turnover realised **so far**.

On the seed at 2026-10-31 those are different numbers — **9.096,00 lei** annual projected VNA against
**7.700,00 lei** YTD turnover — and the e2e asserts both the two counts and both labels.

## 6. Lei amounts derived from SM are labelled as computed

CF art. 148 / 170 / 174 state multipliers of „salariul minim", never a lei figure, and research 24
records the governing SM vintage for FY2026 as **UNVERIFIED** (art. 148 has no reference-date clause;
ANAF's 48.600 / 97.200 use the 1 ianuarie value, 4.050 lei, HG 1.506/2024, while HG 146/2026 set
4.325 lei from 1 iulie 2026). So each SM-multiple spec carries `statutorySmMultiplier` (12 / 24 / 6 /
72) and the row renders:

> `Sumă calculată de aplicație: 12 × salariul minim de 4.050,00 lei (HG 1506/2024). Codul fiscal
> exprimă acest prag în multipli de salariu minim brut pe țară, nu în lei; … salariul minim purtat de
> pachetul de reguli: 4.050,00 lei de la 2026-01-01 (HG 1506/2024); 4.325,00 lei de la 2026-07-01
> (HG 146/2026).`

The SM value and both vintages are **read from the rule package**, not hardcoded, and the label is
attached only when `multiplier × SM === thresholdValue` — a drift guard, pinned by test, so a
parameter that stops being a multiple fails the suite instead of silently losing its provenance.
`VAT_REGISTRATION` carries **no** `computedFrom`: 395.000 lei is art. 310 alin. (1)'s own number.

**No number moved.** The CAS ladder (12 SM / 24 SM) and the 72 SM CASS cap were not touched.

## 7. The 10 % warning distance stays application policy

`warningDistance = floor(thresholdValue / 10)` is unchanged, still uncited, and now says so on screen
when it is what made a row `warning`: *„Bandă de avertizare la 10 % din prag — politică de afișare a
aplicației, nu o prevedere legală."* The duplicate `ratio >= 0.8` band in `insights.ts` is gone, so the
policy exists once. A test asserts no user-facing sentence presents the band as legal and that the row
carries no citation attached to it.

## 8. The reserve landmine: condition not triggered, so nothing changed

`DashboardSnapshot.taxReserve.currentReserveBani` **stays `Bani` with its `?? 0`**. The condition
TASK 3's handoff set — *if warning copy names the amount the user has reserved* — was not met: no copy
written here names a reserved amount. The reserve insight still names only the **gap**
(`Diferența față de ținta de rezervă: …`), and the card still renders
`TaxReserveRecommendation.reservedAmount`, which stays `Bani | null`.

**For TASK 7 / TASK 8:** before any copy says „ai rezervat X din Y", that aggregate **must** become
`Bani | null` — `0` would state a fact about a user who recorded nothing. The ripple is
`aggregation.ts:96`, `data/dashboard.ts` (site #2), `insights.ts` reserve block, and the fixtures in
`insights.test.ts` / `dashboard.test.ts`. `snapshot.taxReserve` / `DashboardData.reserve` are still the
only consumption path — nothing here re-derives the gap, so the TASK 2d ceiling disagreement stays
closed.

## 9. Figures: none moved

| Figure | Value | Pinned at |
|---|---|---|
| seed deductible YTD / projected | **120,00 / 144,00 lei** | `dashboard.test.ts` — unchanged |
| VNA (annual projected, 2026-10-31) | **9.096,00 lei** | `e2e` ×4 — unchanged |
| impozit / total | **819,00 / 3.249,00 lei** | `dashboard.test.ts`, e2e clock — unchanged |
| rezervă lunară / rămas | **1.083,00 / 3.249,00 lei** | `e2e` — unchanged |
| CAS / CASS / VAT parameters | 48.600 / 97.200 / 24.300 / 291.600 / 395.000 lei | `fiscal.test.ts`, `tax.test.ts` — unchanged |

### e2e assertions re-pinned (each replaced, none deleted, no matcher loosened, no timeout widened)

| `e2e/dashboard.spec.ts` | before | after | why |
|---|---|---|---|
| `Depășit` badges in *Praguri* | **2** | **0** | the two contribution floors can no longer render a breach |
| `Atenție` badges in *Praguri* | 0 (not asserted) | **2** | the floors' level *is* in play — reported, not condemned |
| `În limite` badges in *Praguri* | 3 | 3 | unchanged |
| `Prag depășit:` in *Observații* | **1** | **0** | the wording claimed a fiscal limit had been exceeded |
| `Nivel de calcul modificat:` | — | **1** | the replacement alert (CASS/CAS still collapse to one) |
| `Urgent` | **1** | **0** | no threshold row is `danger` on the seed any more |
| `Atenție` | **2** | **3** | the collapsed level change joins completeness + reserve |
| `Info` | 1 | 1 | unchanged |
| new: consequence + `art. 148 alin. (1) și (4)` visible | — | asserted | the factual consequence replaced the deleted sentence |
| new: `La depășire:` / `dezcalificare` / `schimbare de regim` | — | **0** | absence of the deleted copy |
| new: `Sumă calculată de aplicație: 12 × salariul minim de`, `4.050,00 lei` ×4, `HG 1506/2024` ×4, `HG 146/2026` ×4 | — | asserted | the lei amounts are labelled as computed |
| new: `Bază măsurată: …` ×4 annual + ×1 YTD | — | asserted | each row states the basis it measured |
| new: `Nu se aplică:` ×1 | — | asserted | the seed profile already applies VAT, so the art. 310 row is inapplicable |

## 10. Tests

| file | before | after | new coverage |
|---|---|---|---|
| `src/domain/thresholds.test.ts` | 52 | **70** | kind mapping + union; the kind gate on `breached`; `engagedSide`; `severityFor` independence (no `kind` parameter at all); severity per status/applicability; CAS pensioner; CASS zero-year, pensioner-vs-cap asymmetry, salary relief in three states; B-19 flag → `unknown`; VAT scutire gating; no-profile → all `unknown`; measured-basis labelling; unmeasured rows; the SM computed-label + drift guard; the 10 % policy stays uncited; absence of the false claims in every direction |
| **new** `src/domain/thresholds.language.test.ts` | — | **5** | source-tree scan: the two deleted sentences, the `decălificare` family and the `breachMeaning` / `breachMeaningFor` identifiers appear nowhere in app code; the replacement vocabulary is present |
| `src/components/dashboard/ThresholdSection.test.tsx` | 6 | **13** | below-floor row renders no breach; inapplicable row renders reason and no consequence; `unknown` applicability; severity independent of kind (`data-severity` / `data-kind` / `data-applicability`); SM computed label; the 10 % policy line only when it fired; both measured-basis labels; absence of `La depășire:` |
| `src/domain/insights.test.ts` | 43 | **46** | severity comes from the row, not from `breached`/`ratio`; the ratio alone never creates an alert; inapplicable rows are silent; `low → info`; a below-floor CAS row is never worded as a breach |
| `src/data/dashboard.test.ts` | 43 | **47** | the flattening carries `kind`/`engaged`/`severity`/`consequence`; floor rows are never `breached`; the below-floor fact reaches *Observații* without the breach wording; the production caller supplies the profile and the provenance; the VAT row is inapplicable on the seed; annual-vs-YTD labels and values; the pensioner CAS/CASS asymmetry |
| `e2e/dashboard.spec.ts` | 36 tests | **36 tests** | re-pinned as in §9; no test added or removed |

**55 → 56 files, 889 → 926 tests** (+1 file, +37 tests).

## 11. Files changed

| File | Change |
|---|---|
| `src/domain/thresholds.ts` | `ThresholdKind` / `ThresholdSeverity` / `Applicability` / `MeasuredBasis` / `ComputedLeiAmount`; `engagedSide`; `statusFor(+kind)`; `severityFor`; `applicabilityFor`; SM reference + vintage readers; `breachMeaningFor` and both strings deleted; `breachMeaning` → `consequence`; every spec declares `kind`, `applicabilityTest`, `statutorySmMultiplier` and both consequence sentences |
| `src/domain/aggregation.ts` | snapshot `Threshold` carries `kind`, `engaged`, `severity`, `consequence`, `reviewReason` |
| `src/domain/insights.ts` | severity translated, not invented; filter on `severity !== 'none'`; title by kind; description = the row's cited consequence; the private `ratio >= 0.8` band and the duplicated art. 148 citation removed |
| `src/data/dashboard.ts` | `buildThresholdBasisProvenance`; `getThresholdStatuses` passes `profile` + provenance; the flattening carries the new fields |
| `src/components/dashboard/ThresholdSection.tsx` | `La depășire:` gone; consequence / `Nu se aplică:` / `Aplicabilitate nesigură:` / review reason branches; `Bază măsurată:`; `Sumă calculată de aplicație:` + the unverified-vintage note; the 10 % policy line; `data-kind` / `data-applicability` / `data-severity` on the row |
| tests | `thresholds.test.ts` +18, **new** `thresholds.language.test.ts` (5), `ThresholdSection.test.tsx` +7, `insights.test.ts` +3, `dashboard.test.ts` +4; e2e re-pins in §9 |

## 12. Validation (measured 2026-10-09, every command with `set -o pipefail` and the runner's own exit status)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit **0** |
| `npm run test` | **56 files / 926 tests passed** (baseline 55 / 889 → +1 file, +37 tests) |
| `npm run build` | exit **0** (chunk 813,60 kB — was 804,80 kB; the pre-existing >500 kB warning, unchanged in kind) |
| `npm run test:e2e` | **36 passed** (baseline 36; no e2e test added or removed) |

## 13. Implication for TASK 7 (language layer) and TASK 8 (prioritisation / severity rendering)

**The exact `kind` union:** `'registration' | 'tier_transition' | 'over_limit' | 'informational'`,
declared on each `ThresholdSpec` and carried on `FiscalThreshold.kind` and `aggregation.Threshold.kind`.
No shipped spec uses `informational`; it exists so a row that states a fact with no duty attached can
be typed without inventing a breach.

**Where severity is computed:** `severityFor` in `src/domain/thresholds.ts`, called from
`computeThresholds` for every row. It reads `{ applicability, status, distance, warningDistance }` and
**cannot** read the kind. `insights.ts` only maps `high/medium/low/none` onto
`danger/warning/info/—`. Rendering of severity itself is untouched: the *Praguri* badge still shows
`status`, and the row exposes `data-severity` for TASK 8 to style.

**Rows now conditionally applicable:** all five. `CAS_MIN_BASE` / `CAS_TIER2_FLOOR` (art. 150 alin. (1));
`CASS_MIN_BASE` (art. 174 alin. (2), (6), (7) lit. a)/c), plus B-19's unverified flag → `unknown`);
`CASS_MAX_BASE` (art. 174 alin. (2) and the B-19 flag only — never the pensioner exception);
`VAT_REGISTRATION` (only inside the TVA scutire, art. 310 alin. (1)).

**What TASK 7 may reword:** the *phrasing* of `consequenceWhenEngaged` / `consequenceWhenNotEngaged`,
`applicabilityReason`, the `Bază măsurată:` / `Sumă calculată de aplicație:` / `Nu se aplică:` /
`Aplicabilitate nesigură:` labels, the 10 % policy sentence, and the alert titles/actions in
`insights.ts`.

**What TASK 7 may not do:** re-introduce a legal consequence the row does not have — no
*dezcalificare*, *schimbare de regim*, *penalizare*, *rectificare obligatorie*, and no wording that
makes 12 SM read as a limit beyond which something stops (research 24, must-not-state 1-4 and 7); drop
the article citations; present a lei amount as statutory text; present the 10 % band as statutory;
name a reserved amount before `currentReserveBani` becomes `Bani | null`; or merge the annual and YTD
bases into one label. The language test and the e2e absence assertions will fail if it does.

**For TASK 8:** severity is already a separate dimension on every row and in the DOM
(`data-severity`); prioritisation should read it, not `status` and not `kind`.

## 14. Out of scope, and what was not done

- **No number changed.** The CAS ladder, the 6 SM CASS floor, the 72 SM cap and the 395.000-lei plafon
  are untouched; no rule parameter, formula or calculator was edited.
- **The 25.000-euro regime trigger** (art. 69 alin. (9)) is still not a threshold row, and no lei
  figure was invented for it: it converts at the BNR annual average **for the year of income
  realisation**, a different anchor from the art. 68 caps' year of payment. The FX store is **TASK 10**.
- **`currentReserveBani`** stays `Bani` with `?? 0` (§8).
- **TASK 7** — the full user-facing language layer, tone and terminology across the app.
- **TASK 8** — styling/prioritisation from severity. Only the data hooks were added.
- `ThresholdType` (`min-base` / `max-base` / `registration` / `income` / `tier-floor`) stays: it is the
  arithmetic shape and the source of the row labels the e2e pins. The legal meaning moved to `kind`.

---

## NEXT HANDOFF

- **The exact `kind` union:** `'registration' | 'tier_transition' | 'over_limit' | 'informational'`
  (`ThresholdKind` in `src/domain/thresholds.ts`), declared on every `ThresholdSpec` and carried on
  `FiscalThreshold.kind` and the snapshot's `Threshold.kind`. Shipped mapping: `CAS_MIN_BASE` /
  `CAS_TIER2_FLOOR` / `CASS_MIN_BASE` → `tier_transition`; `CASS_MAX_BASE` → `over_limit`;
  `VAT_REGISTRATION` → `registration`. `informational` is unused by any shipped spec.
- **Where severity is computed:** `severityFor` in `src/domain/thresholds.ts`, called for every row by
  `computeThresholds`. It reads `{ applicability, status, distance, warningDistance }` and has **no
  `kind` parameter to read**. `insights.ts` only translates `high → danger`, `medium → warning`,
  `low → info`, `none → no alert`. TASK 8 should prioritise and style from `severity` (exposed as
  `data-severity` on each *Praguri* row), not from `status` and not from `kind`.
- **Rows now conditionally applicable:** all five. `CAS_MIN_BASE` and `CAS_TIER2_FLOOR` (art. 150 alin.
  (1) — pensioner / own social system; `salaryStatus` does **not** exempt); `CASS_MIN_BASE` (art. 174
  alin. (2) zero-income year, alin. (7) lit. a) salary ≥ 6 SM, lit. c) pensioner, and `unknown` while
  the B-19 flag is unverified); `CASS_MAX_BASE` (art. 174 alin. (2) + the flag only — **never** the
  pensioner exception); `VAT_REGISTRATION` (only inside the TVA scutire, art. 310 alin. (1)).
  **Corrected by TASK 5 (`phases/19_pension_cass_input_model.md`), and this bullet was wrong as
  written:** art. 174 alin. (7) lit. c) does **not** key on „pensioner” — it keys on pension sums
  *received in the fiscal year* (art. 99 alin. (1)), with no amount threshold. A pensioner profile with
  no recorded receipt now returns **`unknown`** for `CASS_MIN_BASE`, not `not_applicable`, and the
  alin. (6) top-up stays payable; a recorded `da` returns `not_applicable` and a recorded `nu` returns
  `applicable`. The zero/loss-year branch also **splits the two rows** now — the cap row keeps the
  art. 174 alin. (2) `not_applicable`, the top-up row reports `unknown`, because whether the 6-SM
  difference survives a zero/loss year is research 25 gap 2 and is not settled by inference.
  `CASS_MAX_BASE` is unchanged: still never a pension exception.
- **What TASK 7 may reword:** the phrasing of `consequenceWhenEngaged` / `consequenceWhenNotEngaged`,
  `applicabilityReason`, the `Nu se aplică:` / `Aplicabilitate nesigură:` / `Bază măsurată:` /
  `Sumă calculată de aplicație:` labels, the 10 % policy sentence, and the alert titles and actions in
  `insights.ts`.
- **What TASK 7 may not do:** reintroduce a consequence the law does not attach (no *dezcalificare*,
  *schimbare de regim*, *penalizare*, *rectificare obligatorie*; nothing that makes 12 SM read as a
  limit beyond which something stops — research 24, must-not-state 1–4 and 7); drop a CF citation from
  a consequence; present a lei amount as statutory text; present the 10 % band as statutory; name a
  reserved amount before `snapshot.taxReserve.currentReserveBani` becomes `Bani \| null`; or merge the
  annual and YTD measured-basis labels. `thresholds.language.test.ts` and the e2e absence assertions
  fail if it does.
