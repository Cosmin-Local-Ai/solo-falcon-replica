# Step 29 — Thresholds and Deadlines Domain

## Context

This step establishes the **thresholds** and **deadlines** domain modules — the two domain pieces the dashboard reads from to surface fiscal limits and compliance dates.

Files in scope:

- `src/domain/thresholds.ts` — fiscal threshold evaluation
- `src/domain/deadlines.ts` — fiscal deadline evaluation
- `src/domain/thresholds.test.ts` — 38 tests
- `src/domain/deadlines.test.ts` — 25 tests

Both modules consume the shared fiscal rule model: each imports `FiscalRule` from `./fiscal/rules` and `selectApplicableRules` from `./fiscal/select` to gate which rules apply for a given `{ taxYear, asOfDate }`. The dashboard (`src/data/dashboard.ts`) is the primary consumer, calling `computeThresholds` and `computeDeadlines` to populate its threshold and deadline views.

## Thresholds (`src/domain/thresholds.ts`)

### Types

```ts
export type ThresholdType = 'min-base' | 'max-base' | 'registration' | 'income';

export type FiscalBase = 'gross-revenue' | 'gross-expenses' | 'net-income';

export interface ThresholdQuery {
  taxYear: number;
  asOfDate: string;
  currentValue: number;
  fiscalBase: FiscalBase; // the base `currentValue` represents
  ruleRelease: string;    // releaseId
}
```

**`ThresholdSpec` (internal, not exported)** — the declarative spec table that maps threshold IDs to fiscal rule parameters:

```ts
interface ThresholdSpec {
  thresholdId: string;
  type: ThresholdType;
  ruleId: string;
  paramId: string;
  affectedDomain: string;
  affectedTax: string;
  requiredFiscalBase: FiscalBase;
}
```

The 2026 baseline has **5 spec entries**, all with `requiredFiscalBase: 'gross-revenue'`:

| thresholdId | type | ruleId / paramId | affectedTax |
|---|---|---|---|
| `CAS_MIN_BASE` | `min-base` | `CAS_2026` / `min_base` | `cas` |
| `CAS_MAX_BASE` | `max-base` | `CAS_2026` / `max_base` | `cas` |
| `CASS_MIN_BASE` | `min-base` | `CASS_2026` / `min_base` | `cass` |
| `CASS_MAX_BASE` | `max-base` | `CASS_2026` / `max_annual_base` | `cass` |
| `VAT_REGISTRATION` | `registration` | `VAT_THRESHOLD_2026` / `threshold` | `vat` |

The `income` type has **no spec entry** in the 2026 baseline (no corresponding fiscal rule) — it exists for conceptual completeness only, so `computeThresholds` never emits an `income` threshold today.

**`FiscalThreshold` (public result type):**

```ts
export interface FiscalThreshold {
  thresholdId: string;
  type: ThresholdType;
  currentValue: number;
  thresholdValue: number;
  distance: number; // currentValue - thresholdValue (negative = below threshold)
  affectedDomain: string;
  affectedTax: string;
  effectiveDate: string;
  warningDistance: number; // distance at which warning triggers
  ruleRelease: string;
  source: string;          // `${rule.sourceAct} ${rule.sourceArticle}`
  status: 'ok' | 'warning' | 'breached';
  fiscalBase: FiscalBase;
  breachMeaning: string;
}
```

### Functions

```ts
export function computeThresholds(
  rules: FiscalRule[],
  query: ThresholdQuery,
): FiscalThreshold[];
```

- Gates rules with `selectApplicableRules(rules, { taxYear, asOfDate })`.
- For each spec: **skipped** when `spec.requiredFiscalBase !== query.fiscalBase` (so e.g. a `net-income` query returns `[]` against the 2026 baseline), skipped when the rule is not applicable, and skipped when the parameter is missing or not numeric.
- `distance = query.currentValue - thresholdValue`; `warningDistance = thresholdValue * 0.1`.

```ts
export function statusFor(
  type: ThresholdType,
  distance: number,
  warningDistance: number,
): FiscalThreshold['status'];
```

Breach semantics per type:

| type | breached when | warning when |
|---|---|---|
| `min-base` | `distance < 0` | `Math.abs(distance) <= warningDistance` |
| `max-base` | `distance > 0` | `Math.abs(distance) <= warningDistance` |
| `registration` | `distance >= 0` | `distance >= -warningDistance` |
| `income` | `distance > 0` | `Math.abs(distance) <= warningDistance` |

```ts
export function breachMeaningFor(type: ThresholdType): string;
```

Human-readable breach explanation per type:

- `min-base`: "Below the minimum base — disqualification from the regime"
- `max-base`: "Above the maximum base — regime change"
- `registration`: "At or above the threshold — registration obligation triggered"
- `income`: "Above the income threshold — additional tax obligation triggered"

### Ratio rules (additive)

Names the ratio-based rule shape produced by `src/data/dashboard.ts` and adds explicit status semantics on top of the existing `breached` flag (which is preserved exactly as-is for backward compatibility):

```ts
export type RatioRuleStatus = 'ok' | 'warning' | 'breached';

export interface RatioRule {
  id: string;
  label: string;
  current: number;
  limit: number;
  breached: boolean;      // backward-compatible flag — never re-derived
  ratio: number | null;   // current / limit; null when limit === 0 ("no cap")
  status?: RatioRuleStatus;
}

export function statusForRatioRule(rule: RatioRule): RatioRuleStatus;
export function withRatioRuleStatus<T extends RatioRule>(rule: T): T & { status: RatioRuleStatus };
```

`statusForRatioRule` precedence:

1. `rule.breached` → `'breached'` (the flag always wins).
2. `limit === 0` → `'ok'` (no cap; `ratio` is `null`, so it never warns — a zero-limit rule is breached only when the caller sets `breached: true`).
3. `ratio !== null && ratio >= 0.8` → `'warning'`.
4. otherwise → `'ok'`.

`withRatioRuleStatus` returns a copy with the derived `status` attached — the input is not mutated, and extra fields (e.g. the dashboard's `type` field) are preserved.

## Deadlines (`src/domain/deadlines.ts`)

### Types

```ts
export type DeadlineEventType =
  | 'd212_filing'
  | 'cas_quarterly'
  | 'cass_quarterly'
  | 'income_tax_advance'
  | 'pfa_estimated_declaration'
  | 'vat_registration';

export interface Deadline {
  deadlineId: string;
  taxYear: number;
  eventType: DeadlineEventType;
  date: string | null; // resolved ISO date 'YYYY-MM-DD'; null when event-relative and no eventDate given
  dateFormula: string;
  appliesTo: string;
  legalSource: { act: string; article: string };
  effectiveFrom: string | null;
  effectiveTo: string | null;
  status: 'active' | 'not_applicable';
}

export interface DeadlineQuery {
  taxYear: number;
  asOfDate: string;
  eventDate?: string; // for event-relative deadlines (PFA start, VAT exceedance month)
}

export type DeadlinePhase = 'past' | 'due_today' | 'upcoming';
```

### Functions

```ts
export function computeDeadlines(
  rules: FiscalRule[],
  query: DeadlineQuery,
): Deadline[];
```

Emits, for the given tax year:

| eventType | date formula | appliesTo | source |
|---|---|---|---|
| `d212_filing` | fixed date from rule `PFA_DEADLINE_2026` (`deadline` param; `2027-05-25` in the 2026 baseline) | `pfa` | Cod. fiscal art. 122(3) |
| `cas_quarterly` | 15th of the month following quarter end: `04-15`, `07-15`, `10-15`, `01-15` (+1y) | `pfa` | Cod. fiscal art. 160 |
| `cass_quarterly` | same dates as CAS quarterly | `pfa` | Cod. fiscal art. 170 |
| `income_tax_advance` | 25th of Mar/Jun/Sep/Dec | `pfa` | Cod. fiscal art. 81 |
| `pfa_estimated_declaration` | `eventDate + 15 days` (event-relative) | `new_pfa` | Cod. fiscal art. 81 |
| `vat_registration` | `monthEnd(eventDate) + 30 days` (event-relative) | `vat-registered-pfa` | Cod. fiscal art. 338 |

- **D212 gating:** the `d212_filing` deadline is emitted only when a `PFA_DEADLINE_2026` rule is applicable (via `selectApplicableRules`) and carries a string `deadline` parameter; otherwise it is omitted entirely.
- **Event-relative deadlines:** `pfa_estimated_declaration` and `vat_registration` have `date: null` and `status: 'not_applicable'` when no `eventDate` is given; with an `eventDate` they resolve to concrete dates and are `active`.
- **Count:** 15 deadlines without `eventDate` (13 with dates + 2 null-dated); 15 with `eventDate` (all resolvable).

```ts
export function daysRemaining(deadlineDate: string, asOfDate: string): number;
```

Whole-day difference `deadlineDate - asOfDate` (parsed as UTC midnight). Positive = days ahead, zero = due today, negative = past.

```ts
export function classifyDeadline(
  deadline: Deadline,
  asOfDate: string,
): DeadlinePhase | null;
```

- `daysRemaining < 0` → `'past'`
- `daysRemaining === 0` → `'due_today'`
- `daysRemaining > 0` → `'upcoming'`
- `deadline.date === null` → `null` (a dateless deadline cannot be temporally classified)

```ts
export function isApplicable(
  rule: FiscalRule,
  query: DeadlineQuery,
): boolean;
```

Returns `true` when the single rule would produce a `d212_filing` deadline with a non-null date (i.e. the rule is applicable and carries a date param).

```ts
export function getApplicableDeadlines(
  rules: FiscalRule[],
  query: DeadlineQuery,
): Deadline[];
```

Filters `computeDeadlines(rules, query)` to deadlines with a non-null date.

```ts
export function filterUpcoming(
  deadlines: Deadline[],
  asOfDate: string,
): Deadline[];
```

Returns deadlines whose `classifyDeadline(...)` is `'upcoming'` (dateless deadlines are excluded).

## Tests

- `src/domain/thresholds.test.ts` — 38 tests: spec coverage (5 thresholds for 2026, values, determinism, distance signs, 2025 baseline), per-type breach semantics via `statusFor`, `breachMeaningFor` strings, fiscal-base matching (mismatched base → all specs skipped), `income` type semantics (no spec entry in the baseline), and ratio rule status (`statusForRatioRule` precedence incl. zero-limit and `breached`-wins, `withRatioRuleStatus` immutability and field preservation, status union exhaustiveness).
- `src/domain/deadlines.test.ts` — 25 tests: 15-deadline count, D212 resolution and gating (omitted when no applicable rule), CAS/CASS quarterly dates, income tax advance dates, tax-year applicability, event-relative resolution with/without `eventDate`, effective-date applicability (`asOfDate` before `effectiveFrom` excludes D212), `daysRemaining` (including 2025 and 1999 tax years), `isApplicable`, `getApplicableDeadlines`, `filterUpcoming`, and `classifyDeadline` boundary behavior.

Total: 63 tests, all passing.
