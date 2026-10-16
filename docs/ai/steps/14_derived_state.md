# Step 14 — Derived State (Automatic Invalidation/Recomputation)

## Purpose

Derived financial (and future tax) state updates **automatically** when source
data changes — no manual "Recalculate" button anywhere. The mechanism is the
existing reactive store: a flat React Context + `useState<AppData>`. React
re-render on state change **is** the reactivity mechanism. The solution is
pure functions + selectors + thin hooks; no new reactive infrastructure.

## Derived-state boundary — `src/domain/derived.ts`

Pure domain module: no React, no DOM, no localStorage, no store imports.
Two selectors:

- **`selectFinancialDerived(data, asOfDate): FinancialDerivedView`** —
  composes the existing Step 13 selectors (`selectYtd`, `selectMonthly`,
  `selectProjectionV1`) into one derived view, plus per-record provenance
  lines (`RecordLine`: id, date, total, status, `counted`, and the
  document link `{ tip, nr }` — expenses/revenues are documents). The
  `counted` flag mirrors the aggregation counting rule
  (`status === 'inregistrata'` and date within the fiscal period up to
  `asOfDate`), using the additive `inPeriod` export from
  `src/domain/aggregation.ts`.

- **`selectTaxDerived(data, activeRules): TaxDerivedView`** — structural
  tax-input selector. Consumes profile tax inputs (regime, salaryStatus,
  pensionStatus, otherIncome, socialInsuranceStatus, vatExempt, cashFloorLei,
  fiscalYear) plus the **ACTIVE** fiscal rule release (passed explicitly),
  and returns a `REVIEW_REQUIRED` sentinel with a deterministic canonical
  `inputsKey` and release provenance (`ruleIds`, `ruleCount`).
  **No tax formula is implemented** — this is the dependency path future
  tax calculations will use.

## Store integration — `src/data/derived.ts` + `src/data/store.tsx`

- **Thin hooks** (`src/data/derived.ts`): `useFinancialDerived(asOfDate)` and
  `useTaxDerived(asOfDate)` read `AppData` via `useStore()` and re-run the
  pure selectors on every state change (new `AppData` reference), memoized
  with `useMemo`. `useTaxDerived` resolves the active release via
  `selectApplicableRules(PFA_2026_SYSTEM_REAL_PACKAGE, …)`, so a release
  change flows through the same path.
- **Additive store change** (`src/data/store.tsx`): added
  `updateProfile: (patch: Partial<PfaProfile>) => void` (same `setData`
  pattern as `updateSettings`). The store previously had no way to update
  the profile, which blocked the "profile tax input changed" case. The store
  was **not** replaced or restructured.

## Recomputation behavior per source change

All seven required source changes naturally invalidate/recompute the
relevant derived results, because every derived value is a pure function of
`AppData` (and the active rule release):

1. **Income added** → YTD revenue/net, monthly, projection, and revenue
   lines all change.
2. **Expense added** → YTD expenses/net, monthly, projection, and expense
   lines all change.
3. **Expense deleted** → YTD expenses/net, monthly, projection, and expense
   lines all change.
4. **Expense reclassified** → counting rule changes (`counted` flag); totals
   and net change accordingly; line provenance updates.
5. **Document-linked expense changed** → line provenance (`tip`/`nr`)
   changes; totals unchanged if amounts are unchanged.
6. **Profile tax input changed** → `inputsKey` and the tax-input reference
   change (via `updateProfile`); financial derived view unaffected.
7. **Fiscal rule release changed** → `activeRelease` provenance
   (`ruleIds`, `ruleCount`) changes (via `selectApplicableRules`).

Unrelated changes (e.g. a client added) leave both derived views unchanged,
and both selectors are deterministic for identical inputs.

## Snapshot relationship

Current derived state and historical calculation snapshots
(`src/domain/snapshots/`) are **separate**. Snapshots are immutable
point-in-time records; derived state is live. Snapshots are **never
rewritten** by this step — no snapshot file was modified.

## Why no event bus

The store is already reactive: every mutation produces a new `AppData`
reference, React re-renders consumers, and the hooks re-run the pure
selectors. An event bus, middleware, or subscription framework would be
redundant infrastructure duplicating what React's re-render already does,
and would violate the purity boundary (domain modules must not import the
store).

## Tests added

`src/domain/derived.test.ts` (13 tests):
- `selectFinancialDerived (Step 14)`:
  - composes ytd, monthly, and projection from existing selectors
  - case 1: income added → derived revenue/net change
  - case 2: expense added → derived expenses/net change
  - case 3: expense deleted → derived expenses/net change
  - case 4: expense reclassified → counting rule changes, line provenance updates
  - case 5: document-linked expense changed → provenance changes, totals unchanged
  - unrelated change (client added) → derived financial view unchanged
  - is deterministic for identical inputs
- `selectTaxDerived (Step 14, structural — no formula)`:
  - returns the REVIEW_REQUIRED sentinel with profile tax inputs and active release provenance
  - case 6: profile tax input changed → inputs reference changes
  - case 7: fiscal rule release changed → active release provenance changes
  - unrelated change (client added) → tax derived view unchanged
  - is deterministic for identical inputs

`src/data/derived.test.tsx` (3 tests, React hooks):
- `useFinancialDerived (Step 14)`:
  - recomputes automatically when income is added
  - recomputes automatically when an expense is added
- `useTaxDerived (Step 14)`:
  - recomputes automatically when profile tax inputs change

## Commands run

- `npx vitest run src/domain/derived.test.ts src/data/derived.test.tsx` →
  2 files, 16 tests, all passing.
- `npx vitest run` (full suite) → 8 files, 77 tests, all passing.
- `npx tsc --noEmit` → clean.
- `npm run build` → **succeeds**:
  ```
  > solo-falcon-replica@0.1.0 build
  > tsc && vite build

  vite v5.4.21 building for production...
  ✓ 46 modules transformed.
  dist/index.html                   0.42 kB │ gzip:  0.30 kB
  dist/assets/index-EHjOQuDc.css   11.46 kB │ gzip:  2.98 kB
  dist/assets/index-DH74ObJG.js   215.41 kB │ gzip: 62.74 kB
  ✓ built in 590ms
  ```

## Results

- Derived-state boundary created: `src/domain/derived.ts` (pure).
- Store integration: `src/data/derived.ts` hooks + additive
  `updateProfile` in `src/data/store.tsx`.
- All 7 required source-change paths verified by tests; automatic
  recomputation verified end-to-end through the reactive store.
- No "Recalculate taxes" button; no tax formula; no snapshots modified.

## Unresolved issues

- None. (Future step: implement the actual tax formula on top of
  `selectTaxDerived`'s input reference; the sentinel and dependency path are
  in place.)
