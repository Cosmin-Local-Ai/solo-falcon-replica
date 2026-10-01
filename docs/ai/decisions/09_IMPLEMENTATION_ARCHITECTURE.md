# 09 — Implementation Architecture

**Status:** Decision document (Step 9). **Scope:** concrete implementation architecture map for future Workers.
**Inputs:** checkpoints 01–08 (state, repo, dashboard, defects, UX, fiscal, legislation, stack).
**Not covered:** Dashboard UI design, tax rules beyond the verified 2026 set, backend implementation.

## 0. Ground rules (binding on all stages)

- `BACKEND IS FUTURE.` No backend is built now; only the API boundary is defined (Section 11).
- `LOCAL STORE REMAINS CURRENT.` Persistence stays on localStorage key `pfa-app-data-v2` behind a repository interface.
- Dashboard components must depend on domain services, selectors, or repositories rather than direct localStorage access.
- The product must not require a local AI model.
- Tax logic is a deterministic domain layer. UI never computes taxes and never contains rates/thresholds/dates as literals.
- Any case lacking a verified rule returns the `REVIEW_REQUIRED` sentinel. Workers must not invent unsupported rules.
- Stack is fixed: React 18 + Vite 5 + TS; vitest 3.2.7 + @testing-library (unit); Playwright 1.63.0 / chromium-1243 (E2E); recharts, zod, decimal.js-light available. No state-management library, no backend framework.

## 1. Domain boundaries

Layering, strict dependency direction (arrows point only downward):

```
UI pages (src/pages/*)            — render only; no computation
  ↓
Selectors (src/domain/selectors)  — pure fns: (state, profile, rules) → view models
  ↓
Domain services (src/domain/)     — calculators, aggregation, deadlines, insights, scenarios
  ↓
Repositories (src/domain/repo)    — load/save/subscribe contracts
  ↓
Store (src/data/store.tsx)        — thin: persistence + CRUD over AppData
  ↓
localStorage (pfa-app-data-v2)
```

- `src/domain/` is a new module: pure TypeScript, no React, no DOM, no localStorage, no imports from `src/data/store.tsx`.
- The store stays thin (persistence + CRUD) and does not import domain logic.
- Romanian formatting helpers (`fmtRON`, `fmtDate`) stay in the UI/data layer; the domain returns plain numbers (leis, via decimal.js-light in services), never pre-formatted strings.
- Forbidden: tax constants in UI files (no `395000` in `Dashboard.tsx`); derived values persisted as independent collections; domain code reaching for `localStorage`.
- Defect fixes owned here: store gains `updateClient`/`updateDeclaration` as a generic `updateItem` (Stage 15); Dashboard inline metrics extracted to selectors (Stage 15); shared month utilities live in the domain (Stage 13); `Revenue.client` stays free text — treated as a label by aggregation, relational linking out of scope.

## 2. Exact new domain models

All models live in `src/domain/models.ts`. Money is `number` (leis; 2-decimal semantics via decimal.js-light in services).

```ts
// Stage 10 — taxpayer regime inputs
interface PfaProfile {
  id: string;
  fiscalYear: number;                        // 2026
  regime: 'impozit_pe_cit' | 'impozit_pe_venit';
  salaryStatus: 'none' | 'active';
  pensionStatus: 'none' | 'active';
  otherIncome: boolean;
  socialInsuranceStatus: 'pfa-only' | 'pfa-plus-salary' | 'pfa-plus-pension' | 'unknown';
  vatExempt: boolean;                         // under 395,000 lei
  cashFloorLei: number;                       // threshold, default 0
  updatedAt: string;                          // ISO
}

// Stage 11 — 10-field provenance schema, MANDATORY
type FiscalRuleStatus = 'PROPOSED' | 'VALIDATED' | 'STAGED' | 'SCHEDULED' | 'ACTIVE' | 'SUPERSEDED';
type FiscalDomain = 'cass' | 'cas' | 'income-tax' | 'vat' | 'deadlines' | 'wage-reference';

interface FiscalRule {
  ruleId: string;
  taxYear: number;
  regime: string;
  effectiveFrom: string;                      // ISO date
  effectiveTo: string | null;                 // null = open
  parameters: Record<string, number | string | boolean>;
  sourceAct: string;
  sourceArticle: string;
  sourceUrl: string;
  version: number;
  status: FiscalRuleStatus;
  domain: FiscalDomain;
  supersededBy?: string;                      // ruleId; set only when SUPERSEDED
}

// Stage 12 — provenance for every computed number
interface CalculationSnapshot {
  id: string;
  computedAt: string;                          // ISO
  kind: 'cass' | 'cas' | 'incomeTax' | 'vat' | 'netIncome' | 'cashProjection';
  inputs: {
    profileId: string;
    transactionIds: string[];                  // revenues + expenses used
    ruleVersions: Record<string, number>;      // ruleId -> version
    referenceWageLei: number;                  // 4,050 for FY2026
  };
  result: {
    valueLei: number;
    breakdown: Array<{ label: string; valueLei: number }>;
    status: 'OK' | 'REVIEW_REQUIRED';
    reviewReason?: string;
  };
}

// Stage 13
interface AggregationResult {
  period: { from: string; to: string; granularity: 'month' | 'quarter' | 'year' };
  revenueLei: number;
  expenseLei: number;
  netLei: number;
  byMonth: Array<{ monthKey: string; revenueLei: number; expenseLei: number; netLei: number }>;
  byCategory: Array<{ category: string; valueLei: number }>;
  byClient: Array<{ client: string; valueLei: number }>;  // label-based (Revenue.client is free text)
}

// Stage 14
interface DeadlineEvent {
  id: string;
  obligation: 'CASS' | 'CAS' | 'INCOME-TAX-ADVANCE' | 'D212' | 'VAT';
  period: string;                              // e.g. '2026-03'
  dueDate: string;                             // ISO
  amountLei: number | null;                    // null = not yet determinable
  status: 'pending' | 'paid' | 'overdue';
  ruleId: string;                              // provenance to FiscalRule
}

interface Insight {
  id: string;
  kind: 'threshold-warning' | 'deadline-approaching' | 'variance' | 'empty-state';
  severity: 'info' | 'warning' | 'critical';
  message: string;                             // short natural-language recap
  sourceSnapshotId?: string;
  sourceTransactionIds: string[];              // every claim drills down to sources
  thresholdLe?: number;
}

// Stage 17
interface ScenarioDraft {
  id: string;
  name: string;
  createdAt: string;
  status: 'draft' | 'merged';
  baseDataHash: string;                        // hash of base AppData at draft time
  overrides: { revenues: Partial<Revenue>[]; expenses: Partial<Expense>[] };
  mergedAt?: string;
}

// Legislation — see Section 10
interface LegalChange {
  id: string;
  actIdentity: { actNumber: string; actType: string; sourceUrl: string };
  publishedDate: string;                       // 4 distinct dates — never collapsed
  effectiveFrom: string;
  taxYear: number;
  status: 'in-force' | 'amended' | 'repealed';
  changeNature: 'new' | 'amendment' | 'repeal' | 'clarification';
  pipelineStage: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  sourcePriority: 1 | 2 | 3 | 4;               // 1=Portal Legislativ … 4=Ministry/Govt
}

interface RuleRelease {
  id: string;
  changeId: string;                            // LegalChange.id
  affectedRuleIds: string[];
  outcome: 'activated' | 'review-required' | 'rejected';
  scheduledFor?: string;
  evidence: { testIds: string[]; validatedAt: string };
  audit: { createdAt: string; supersedes?: string };
}
```

## 3. Fiscal-rule boundary

- Every production `FiscalRule` carries the 10-field provenance schema: `ruleId, taxYear, regime, effectiveFrom, effectiveTo, parameters, sourceAct, sourceArticle, sourceUrl, version, status`. No rule object may omit a field.
- Calculators are rule-driven: they read parameters from ACTIVE rules for the tax year. A flat formula with embedded constants is a defect.
- `GENERAL_MINIMUM_WAGE` (4,325 lei from July 2026) and `PFA_2026_TAX_REFERENCE` (4,050 lei) are separate rules. Never derive all thresholds from the current minimum wage.
- CAS must be rule-driven over the 12/24-SM tier structure, not a flat formula. CASS must distinguish: actual income base, minimum-base top-up, statutory exceptions, 72-SM cap.
- Verified 2026 rule set (the only values Workers may implement now):

| Rule | Value | Source anchor |
|---|---|---|
| CASS | 10%, base 6–72 SM = 24,300–291,600 lei | Legea 239/2025 |
| CAS | 25%, base 6–24 SM = 24,300–97,200 lei | ANAF 2026 doc |
| Income tax | 10% base; 16% on portion above 6× avg gross salary | Art. 64, Law 227/2015; Law 296/2023 |
| VAT exemption | 395,000 lei | OUG 22/2025 (2026 value) |
| D212 | annual filing + payment by 25 May 2027 for 2026 income | Art. 122(3) |
| Tax-reference wage | 4,050 lei (1 Jan 2026) | 2026 reference |
| Advances | 4 equal installments by 25th of last month of each quarter | Art. 81 |
| Loss carry-forward | up to 5 years, capped 50% of net income per year | Art. 118(4)–(5) |

- Unverified cases (CASS top-up mechanics, full exception list, exact 16% threshold amount pending the 2026 average gross salary, PFA+salary/pension combos) → `REVIEW_REQUIRED`. No invented rules.
- Rules follow the lifecycle in Section 10; supersession is the only terminal state; rules are never deleted.

## 4. Calculation-snapshot boundary

- Every calculator call produces a `CalculationSnapshot`: inputs (profile id, transaction ids, rule versions, reference wage), result (`valueLei`, breakdown, `OK` | `REVIEW_REQUIRED`), timestamp.
- Snapshots are append-only. Nothing mutates a snapshot; a new computation writes a new snapshot.
- Determinism: same inputs + same rule versions → identical result. This is what makes provenance and drill-down honest.
- Every headline number on the dashboard traces to exactly one snapshot; every snapshot traces to source transactions (trust requirement: every claim drills down).
- `REVIEW_REQUIRED` snapshots render as explicit "needs review" states in UI — never silently zero.
- Snapshots are stored via the repository (local store), not recomputed-and-forgotten, so history is auditable.

## 5. Financial aggregation boundary

- `AggregationService` is the only place revenue/expense totals are computed: month / quarter / YTD / full-year, by category, by client.
- Shared month utilities (`monthKey`, month names, YTD filtering) live in the domain — they replace the page-local `LUNILE` in `Declarations.tsx` and the currently absent shared helpers.
- `total(r) = valoareFaraTva + tva` semantics are preserved exactly; no stored total field is introduced.
- Money arithmetic uses decimal.js-light.
- `Revenue.client` is free text: `byClient` groups by label. Relational client linking is out of scope.
- Aggregation is pure: it reads `AppData` + profile, writes nothing.

## 6. Automatic recalculation / derived-state boundary

- Derived state = pure function of `(AppData, PfaProfile, ACTIVE FiscalRules)`. It is computed on demand by selectors; it is never persisted as an independent source of truth (snapshots are the provenance record, not the live state).
- Recalculation triggers: transaction data change, profile change, rule activation/supersession. No manual "recalculate" button in scope.
- Tax is derived from the same income/expense data as cash — one computation path, so cash and tax can never disagree (single shared data model).
- Selectors may memoize in-memory only (keyed by input identity). No derived values in localStorage.
- The store keeps its write-on-change behavior for raw data only; derived collections are not part of `AppData`.

## 7. Threshold / deadline / insight boundary

- **Thresholds:** user-adjustable cash floor in `PfaProfile.cashFloorLei`, default 0. Warnings fire BEFORE the projected balance crosses the floor (advance warning, not after). The same threshold logic applies to cost categories (budget variance).
- **Deadlines:** `DeadlineEvent`s are date-anchored, time-stamped, time-ordered calendar events with due date, days-remaining (derived at read time by selectors, not stored), and `pending`/`paid`/`overdue` status. Generated from ACTIVE deadline rules: CASS monthly, income-tax advance installments (25th of last month of each quarter), D212 on 25 May 2027. Amounts come from Stage 13 aggregation; when undeterminable, `amountLei: null`.
- **Insights:** `Insight` objects are derived, rule-driven, and always carry `sourceTransactionIds` (and optionally `sourceSnapshotId`) so every claim drills down to sources. Kinds: `threshold-warning`, `deadline-approaching`, `variance`, `empty-state`. No free-text alerts without provenance.
- Threshold/deadline/insight computation lives in domain services; the UI renders results only.

## 8. Repository / store boundary

- The store (`src/data/store.tsx`) stays thin: load-once from `pfa-app-data-v2` (seed fallback), write-on-change, CRUD. It is the current persistence adapter, not a domain layer.
- The store must gain the missing primitives: `updateClient`, `updateDeclaration` — implemented as one generic `updateItem(collection, id, patch)` — before any edit UI relies on updates (defect 1+2).
- A repository interface in `src/domain/repo` defines `load()`, `save()`, `subscribe()`. The localStorage adapter implements it today; a future backend adapter implements the same interface (Section 11). Domain and UI depend on the interface, never on localStorage.
- New persisted collections (profile, rules, snapshots, deadlines, scenarios) are added to `AppData` behind the same load/save cycle; seed data must cover FY2026 defaults.

## 9. Dashboard data-selector boundary

- Selectors are pure functions `(AppData, PfaProfile, FiscalRule[]) → view model`. They sit in `src/domain/selectors` and are the only bridge between data and pages.
- The Dashboard's inline metric derivations (totals, status counts, recent-docs sort — defect 6) are extracted into selectors; `Dashboard.tsx` renders view models only.
- The cockpit strip's 5 headline numbers are defined as selector outputs: (1) cash on hand, (2) revenue this month, (3) net profit this month, (4) estimated tax to set aside (CASS + income tax + VAT broken out), (5) cash-threshold status (safe/warning).
- Panels Overview / Cash / Tax / Deadlines / Transactions all consume the same selector surface, so numbers can never disagree across panels or zoom levels (weekly/monthly/yearly).
- Empty states are selector-produced: distinct "no data yet" (initial) vs "zero results" (filtered) view models, present from day one.

## 10. Legislation-model boundary

- The 10-stage pipeline is fixed in exact order, none skippable or reorderable: OFFICIAL SOURCE → SOURCE ADAPTER → NORMALIZED LEGAL DOCUMENT → RELEVANCE FILTER → CHANGE DETECTOR → RULE MAPPING → VALIDATION → RULE RELEASE → TAX ENGINE IMPACT → USER NOTIFICATION. Nothing past CHANGE DETECTOR reaches the engine without VALIDATION + RULE RELEASE.
- Source priority is mandatory: 1) Portal Legislativ, 2) ANAF archive, 3) Official published acts, 4) Ministry/Govt. Unofficial sources are never primary authority.
- Rule lifecycle: `PROPOSED → VALIDATED → STAGED → SCHEDULED → ACTIVE → SUPERSEDED`. A rule may not jump `PROPOSED → ACTIVE`. Supersession is the only terminal state; superseded rules are retained for audit, never deleted.
- Hard safety rule: a new legal document NEVER directly overwrites active tax rules. Flow: document → candidate change → affected rules → automated tests → safe activation OR review required.
- `LegalChange` keeps four distinct date/status fields (`publishedDate`, `effectiveFrom`, `taxYear`, `status`) — never collapsed into one date/state.
- `RuleRelease` is the audited change set: affected rules, outcome, scheduling, validating evidence, audit identity.
- Concrete storage/schemas for legislation are owned by the Stage 11 worker within the `FiscalRule`/`LegalChange`/`RuleRelease` models above; pipeline execution is a future subsystem, not built in Stages 10–17.

## 11. Future API boundary

- `BACKEND IS FUTURE.` This section defines the contract only; no backend is implemented.
- The repository interface (Section 8) is the seam: a future backend adapter satisfies the same `load`/`save`/`subscribe` surface, so swapping persistence requires zero domain/UI changes.
- The future API surface mirrors the selector surface, grouped by resource: profile, fiscal rules, calculation snapshots, aggregation, deadlines, insights, scenarios, and the raw data collections (revenues, expenses, clients, declarations, documents, statements, settings).
- The API is read-heavy and one-way in trust posture: the app reads bank/accounting data, never edits it.
- No REST framework, no server code, no database design in this project phase. Any backend decision requires a new decision document.

## 12. Future scenario boundary

- `ScenarioDraft` is a non-destructive overlay on base `AppData`: overrides are stored separately and never written into base collections.
- The base line is never mutated until a scenario is explicitly merged (one-click merge). Until then, base snapshots remain valid.
- Scenario evaluation reuses the same domain services (aggregation, calculators) against `base + overrides`, producing scenario-scoped snapshots that are clearly labeled as scenario outputs — they never overwrite base snapshots.
- Side-by-side compare is a selector concern: `(baseResult, scenarioResult) → variance view model`.
- `baseDataHash` records the base state at draft time; a stale scenario (base changed since) must be flagged, not silently re-evaluated as if current.
- Forecast reliability degrades gracefully with thin data: show a plan, not false precision (UX requirement).

## Stage 10: PFA profile

- **Scope:** `PfaProfile` model + zod schema; profile stored in the local store (new `AppData` collection `profile`); profile editing surface in Settings (regime, salary/pension/other-income status, social-insurance status, VAT exemption, cash floor default 0). No tax calculation in this stage.
- **Inputs:** existing `AppData`/`SettingsState` (Steps 03/04); fiscal profile inputs from checkpoint 06.
- **Outputs:** persisted `PfaProfile` for FY2026; a profile service that returns the active profile by fiscal year.
- **Acceptance criteria:** profile round-trips through the store; FY2026 defaults seed correctly; zod validation rejects malformed profiles; unit tests pass; no tax logic introduced.
- **Worker handoff:** Stage 11 receives `PfaProfile` as the engine's profile input; profile fields must not be renamed without a decision doc.

## Stage 11: Fiscal rule model

- **Scope:** `FiscalRule` with the mandatory 10-field provenance schema; seed the verified 2026 rule set (table in Section 3); deterministic calculators for CASS, CAS, income tax, VAT; `REVIEW_REQUIRED` paths for all unverified cases; rule lifecycle helpers (activate, supersede — never delete).
- **Inputs:** Stage 10 `PfaProfile`; checkpoint 06 provenance schema and verified values.
- **Outputs:** rule-driven calculators `(profile, transactions, activeRules) → { valueLei, breakdown } | REVIEW_REQUIRED`; versioned rule store in the local store.
- **Acceptance criteria:** every 2026 value in the Section 3 table is computed from rule parameters, with zero tax literals in UI; CAS is tier-driven (12/24 SM); CASS distinguishes base/top-up/exceptions/cap; unverified cases return `REVIEW_REQUIRED`; unit tests per calculator, including boundary bases (24,300 / 97,200 / 291,600 lei).
- **Worker handoff:** Stage 12 receives calculators plus rule versions for snapshot provenance; the exact 16% threshold amount stays `REVIEW_REQUIRED` until the 2026 average gross salary is sourced.

## Stage 12: Calculation snapshots / provenance

- **Scope:** `CalculationSnapshot` model; snapshot service wrapping the calculators; append-only snapshot storage in the local store; provenance wiring (transaction ids, rule versions, reference wage 4,050 lei).
- **Inputs:** Stage 11 calculators and rule versions; Stage 10 profile; `AppData` transactions.
- **Outputs:** snapshots with `OK`/`REVIEW_REQUIRED` status; drill-down data linking every number to source transactions.
- **Acceptance criteria:** determinism test (same inputs + rule versions → identical result); every headline number traceable to one snapshot; `REVIEW_REQUIRED` snapshots carry a `reviewReason`; no snapshot mutation anywhere.
- **Worker handoff:** Stage 13 aggregation consumes snapshots for tax figures; snapshot `kind` values are the stable contract.

## Stage 13: Financial aggregation

- **Scope:** `AggregationResult`; `AggregationService`; shared month utilities (`monthKey`, month names, YTD) in the domain; month/quarter/YTD/full-year, by-category, by-client aggregation; decimal.js-light arithmetic.
- **Inputs:** `AppData` (revenues, expenses); Stage 12 snapshots for tax figures.
- **Outputs:** aggregation service + results for all granularities.
- **Acceptance criteria:** `total(r) = valoareFaraTva + tva` semantics preserved; aggregation matches manual totals over the seed data; the page-local `LUNILE` in `Declarations.tsx` is replaced by the shared domain utility; unit tests for boundary months (year start, year end, leap-free 2026).
- **Worker handoff:** Stage 14 uses aggregation for deadline amounts and threshold projections.

## Stage 14: Deadlines and insights

- **Scope:** `DeadlineEvent` model; deadline generation from ACTIVE deadline rules (CASS monthly, advance installments by the 25th of the last month of each quarter, D212 due 2027-05-25); threshold engine (cash floor from profile, default 0, advance warnings); `Insight` model with mandatory provenance.
- **Inputs:** Stage 13 aggregation (amounts, projections); Stage 11 rules (dates); Stage 10 profile (cash floor).
- **Outputs:** deadline calendar; threshold status (safe/warning); insight list.
- **Acceptance criteria:** D212 appears with due date 2027-05-25 and period 2026; advance warning fires BEFORE the projected balance crosses the floor; every insight carries `sourceTransactionIds`; `amountLei: null` is handled in UI as "not yet determinable", not zero; unit tests for each obligation type.
- **Worker handoff:** Stage 15 selectors expose deadlines, thresholds, and insights to the Dashboard panels.

## Stage 15: Dashboard data selectors

- **Scope:** selector module in `src/domain/selectors`; extraction of Dashboard inline metrics (defect 6) into selectors; cockpit strip's 5 numbers as selector outputs; panel view models for Overview / Cash / Tax / Deadlines / Transactions; store gains generic `updateItem` (covers `updateClient`/`updateDeclaration`, defects 1+2).
- **Inputs:** Stages 12–14 outputs; current `Dashboard.tsx` inline derivations.
- **Outputs:** pure selector functions; `Dashboard.tsx` consuming selectors only.
- **Acceptance criteria:** no localStorage access and no tax computation anywhere in `src/pages/`; numbers identical across all panels at every zoom level; empty states ("no data yet" vs "zero results") rendered from selector view models; unit tests for each selector; Dashboard renders the same numbers as the underlying snapshots.
- **Worker handoff:** Stage 16 mirrors the selector surface in the API contract.

## Stage 16: API boundary

- **Scope:** define (do NOT implement) the repository interface in `src/domain/repo` and the future API contract document; the localStorage adapter as the current implementation of that interface. `BACKEND IS FUTURE.`
- **Inputs:** Stage 15 selector surface; checkpoint 08 repository boundary.
- **Outputs:** `src/domain/repo` interface + a contract doc listing resources (profile, rules, snapshots, aggregation, deadlines, insights, scenarios, raw collections); no backend code.
- **Acceptance criteria:** swapping the adapter requires zero domain/UI changes; the contract covers every selector output; no server code, framework, or database design is introduced; the contract is explicit that the app reads bank/accounting data and never edits it.
- **Worker handoff:** Stage 17 scenarios plug into the same repository contract.

## Stage 17: Scenario boundary

- **Scope:** `ScenarioDraft` model; non-destructive overlay service (draft, evaluate, compare, one-click merge); scenario-scoped snapshots; stale-scenario detection via `baseDataHash`.
- **Inputs:** Stage 13 aggregation, Stage 12 snapshot service, Stage 16 repository contract.
- **Outputs:** scenario service producing `ScenarioDraft` records and variance view models.
- **Acceptance criteria:** base `AppData` is never mutated by a draft scenario; merge is explicit and single-click; side-by-side compare renders base vs scenario from the same selector surface; scenario snapshots are labeled as scenario outputs and never overwrite base snapshots; a stale scenario (base changed since draft) is flagged; unit tests for draft/compare/merge.
- **Worker handoff:** end of the mapped sequence — the architecture is complete; any further stage requires a new decision document.

## Worker handoff summary

| Stage | Delivers to next stage |
|---|---|
| 10 PFA profile | `PfaProfile` as engine input |
| 11 Fiscal rule model | Rule-driven calculators + rule versions |
| 12 Calculation snapshots | Provenance contract (`kind`, `ruleVersions`, transaction ids) |
| 13 Financial aggregation | Amounts + projections for deadlines/thresholds |
| 14 Deadlines and insights | Calendar, threshold status, insight list |
| 15 Dashboard selectors | Single selector surface for all panels |
| 16 API boundary | Repository contract mirroring the selector surface |
| 17 Scenario boundary | Non-destructive overlay on the same contract |

**Sequence is mandatory: 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17.** Each stage's acceptance criteria must pass before the next stage starts. Any deviation from this document requires a new decision doc in `docs/ai/decisions/`.

