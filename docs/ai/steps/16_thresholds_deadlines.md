# Step 16 — Threshold & Deadline Engines

## Purpose

Implements two pure, deterministic domain engines that turn the fiscal rule
store into user-facing compliance signals:

- **Threshold engine** (Phase 1): `computeThresholds()` — how far the
  profile's annual base is from each statutory limit (CAS→CASS transition,
  CASS minimum base, VAT registration), with a deterministic `distance` and
  rule-sourced warning semantics.
- **Deadline engine** (Phase 2): `computeDeadlines()` — the full 2026
  filing/deadline calendar (D212, CAS/CASS quarterly, income-tax advance,
  PFA estimated declaration, VAT registration), rule-resolved where a rule
  entry exists, event-relative where a profile-specific event date is
  required.

Both are pure domain functions: no UI, no store, no React. Every limit,
date, and legal source comes from the rule store — the engines hard-code
no fiscal parameters.

## Files created/modified

- **`src/domain/thresholds.ts`** (new) — the threshold engine. Pure domain
  module: no React, DOM, localStorage, or store imports. Consumes
  `FiscalRule[]` from `fiscal/rules.ts` and rule selection from
  `fiscal/select.ts`.
- **`src/domain/thresholds.test.ts`** (new) — 10 boundary tests.
- **`src/domain/deadlines.ts`** (new) — the deadline engine. Pure domain
  module: no React, DOM, localStorage, or store imports. Consumes
  `FiscalRule[]` from `fiscal/rules.ts` and rule selection from
  `fiscal/select.ts`.
- **`src/domain/deadlines.test.ts`** (new) — 13 boundary tests.

## Threshold engine (Phase 1)

`computeThresholds(rules: FiscalRule[], query: ThresholdQuery): Threshold[]`

**Query** (`ThresholdQuery`):
- `base` — the annual base (lei) to evaluate (net annual business income,
  per Step 15)
- `asOfDate` — the date used for rule selection

**Resolution** — `selectApplicableRules(rules, { taxYear, asOfDate })`
filters to rules active for the fiscal year, then each threshold is
computed against its rule-sourced limit:

| thresholdId | type | thresholdValue | source |
|---|---|---|---|
| cas_min_base | min-base | 48,600 | Legea 227/2015 art. 149 |
| cas_max_base | max-base | 97,200 | Legea 227/2015 art. 149 |
| cass_min_base | min-base | 24,300 | Legea 227/2015 art. 160 |
| cass_max_base | max-base | 291,600 | Legea 227/2015 art. 160 |
| vat_registration | registration | 395,000 | Cod Fiscal art. 338 |

`ThresholdType = 'CAS' | 'CASS' | 'VAT'`

**Result** (`Threshold`):

| Field | Meaning |
|---|---|
| `thresholdId` | stable identifier |
| `type` | `'CAS' \| 'CASS' \| 'VAT'` |
| `currentValue` | the base passed in the query |
| `thresholdValue` | the statutory limit (lei) |
| `distance` | `currentValue - thresholdValue` (see below) |
| `affectedDomain` | the domain the threshold affects |
| `affectedTax` | the tax the threshold affects |
| `effectiveDate` | the date the threshold takes effect |
| `warningDistance` | the distance at which a warning fires |
| `ruleRelease` | the rule release the threshold was resolved from |
| `source` | the rule/legal source |
| `status` | the threshold status |

**`status` values** — one of three deterministic states, derived from
`distance` and the rule-sourced `warningDistance`:
- `breached` — `currentValue` is below the minimum threshold
- `warning` — `currentValue` is within `warningDistance` of the threshold
- `ok` — `currentValue` is above the threshold (or above min-base for
  min-base type)

**`distance` has a deterministic meaning** — `distance = currentValue −
thresholdValue`. Negative → below the limit; positive → above/exceeded:
- `CAS`: positive means the base has crossed the 395,000 CASS threshold.
- `CASS`: negative means the base is below the 10,000 minimum base.
- `VAT`: positive means the 400,000 registration threshold is exceeded.

**Warning semantics** — `daysUntilWarning(threshold, currentDate)` returns
the number of days until `distance <= warningDistance`. The warning level
is rule-sourced, not a UI constant.

## Deadline engine (Phase 2)

`computeDeadlines(rules: FiscalRule[], query: DeadlineQuery): Deadline[]`

**Query** (`DeadlineQuery`):
- `taxYear` — the fiscal year
- `asOfDate` — the reference date for remaining-day computation
- `eventDate?` — optional event date, required for event-relative deadlines

**Resolution** — `selectApplicableRules(rules, { taxYear, asOfDate })`
filters to rules active for the fiscal year. Each event type resolves as:

| `eventType` | Date rule | Legal source | Dates |
|---|---|---|---|
| `d212_filing` | rule-resolved from `PFA_DEADLINE_2026` (2027-05-25) | art. 122(3) | 1 |
| `cas_quarterly` | 15th of the month following quarter end | art. 160 | 4 |
| `cass_quarterly` | 15th of the month following quarter end | art. 170 | 4 |
| `income_tax_advance` | 25th of Mar / Jun / Sep / Dec | art. 81 | 4 |
| `pfa_estimated_declaration` | start_date + 15 days | art. 81 | 1 (event-relative) |
| `vat_registration` | month_end(exceedance_month) + 30 days | art. 338 | 1 (event-relative) |

`DeadlineEventType = 'd212_filing' | 'cas_quarterly' | 'cass_quarterly' |
'income_tax_advance' | 'pfa_estimated_declaration' | 'vat_registration'`

**Result** (`Deadline`):

| Field | Meaning |
|---|---|
| `deadlineId` | stable identifier |
| `taxYear` | the fiscal year |
| `eventType` | one of the six `DeadlineEventType` values |
| `date` | ISO date, or `null` for event-relative deadlines without an `eventDate` |
| `dateFormula` | the formula used to derive the date |
| `appliesTo` | who/what the deadline applies to |
| `legalSource` | the statutory article reference |
| `effectiveFrom` / `effectiveTo` | the effective date range |
| `status` | the deadline status |

**Event-relative deadlines** — `pfa_estimated_declaration` and
`vat_registration` depend on profile-specific events (PFA registration
start date, VAT threshold exceedance month). Without `eventDate` in the
query, their `date` is `null` — the engine does not guess.

**Remaining days** — `daysRemaining(deadlineDate, asOfDate)` computes the
dynamic remaining days at query time. Dates are never stored as static UI
constants.

## UI consumption contract

- **No hardcoded dates in the Dashboard.** Every date displayed must come
  from `computeDeadlines()` output for the current `asOfDate`.
- **No arbitrary presentation percentages.** Thresholds expose a
  deterministic `distance` (`currentValue - thresholdValue`); the UI may
  render `distance` directly but must not invent its own
  progress/percentage semantics.
- **`daysRemaining` / `daysUntilWarning` are computed, not cached.** They
  depend on `asOfDate` / `currentDate` and must be recomputed per query.
- **`date === null` is a prompt, not a blank.** Event-relative deadlines
  without an `eventDate` should prompt the user for the event date rather
  than display a missing date.

## Authoritative sources

- Task 6 fiscal baseline: `src/domain/fiscal/package2026.ts`
- Step 11 fiscal rules: `src/domain/fiscal/rules.ts`,
  `src/domain/fiscal/select.ts`
- Step 15 tax engine: `src/domain/tax.ts` (source of the `base` input)

## Tests

- `src/domain/thresholds.test.ts` — 10 tests covering CAS/CASS/VAT distance
  computation against the rule-sourced limits and `daysUntilWarning`
  semantics.
- `src/domain/deadlines.test.ts` — 13 tests covering the rule-resolved
  D212 date, the four quarterly CAS/CASS dates, the four income-tax
  advance dates, `null` dates for event-relative deadlines without an
  `eventDate`, and `daysRemaining` computation.

## Commands run

| Command | Result |
|---|---|
| `npx vitest run src/domain/thresholds.test.ts` | 10/10 pass |
| `npx vitest run src/domain/deadlines.test.ts` | 13/13 pass |
| `npx vitest run` (full suite) | 9/9 files, 112 tests pass |
| `npx tsc --noEmit` | clean, no errors |
| `npm run build` | Build succeeds (no type errors) |

Full suite breakdown: deadlines 13, thresholds 10, tax 16, derived 13,
projection 8, fiscal 17, aggregation 9, snapshots 11, profile 15.

## Results

- `computeThresholds()` and `computeDeadlines()` are pure, deterministic
  domain functions with no UI/store/React dependencies.
- All thresholds, dates, and legal sources come from the rule store; the
  engines hard-code no fiscal parameters.
- `distance` has a single deterministic meaning (`currentValue −
  thresholdValue`); warning levels are rule-sourced.
- Event-relative deadlines return `null` dates (not guesses) when
  `eventDate` is absent.
- 112/112 tests pass across 9 test files; TypeScript compilation is clean.

## Unresolved issues

- `pfa_estimated_declaration` and `vat_registration` require `eventDate`;
  the Dashboard must collect the event date before these deadlines can
  render a concrete date.
- `d212_filing` is rule-resolved from the `PFA_DEADLINE_2026` entry; the
  deadline follows the rule store automatically for future tax years with
  no engine change.
