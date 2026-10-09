// Step 14 — thin reactive hooks. The flat store (store.tsx) is the reactivity
// mechanism: these hooks read AppData via useStore() and re-run the pure
// selectors on every state change (new AppData reference). No new reactive
// infrastructure — no event bus, no middleware, no subscription framework.

import { useEffect, useMemo, useState } from 'react';
import { useStore } from './store';
import {
  selectFinancialDerived,
  selectTaxDerived,
  type FinancialDerivedView,
  type TaxDerivedView,
} from '../domain/derived';
import { selectApplicableRules } from '../domain/fiscal/select';
import { PFA_2026_RELEASE, PFA_2026_SYSTEM_REAL_PACKAGE } from '../domain/fiscal';
import { localDateISO, now } from '../domain/date';
import {
  attachEstimateBasis,
  selectEstimateOperands,
  type TaxEstimateWithBasis,
} from '../domain/estimateBasis';
import { computeTaxEstimate } from '../domain/tax';

function todayISO(instant: Date = now()): string {
  return localDateISO(instant);
}

/** Derived financial view (YTD, monthly, projection, per-record provenance),
 *  recomputed automatically when source data changes. */
export function useFinancialDerived(asOfDate: string = todayISO()): FinancialDerivedView {
  const store = useStore();
  return useMemo(() => selectFinancialDerived(store, asOfDate), [store, asOfDate]);
}

/** Structural tax-derived view: profile tax inputs + ACTIVE rule release →
 *  REVIEW_REQUIRED sentinel. Recomputed automatically when the profile tax
 *  inputs or the active rule release change. */
export function useTaxDerived(asOfDate: string = todayISO()): TaxDerivedView {
  const store = useStore();
  return useMemo(() => {
    const activeRules = selectApplicableRules(PFA_2026_SYSTEM_REAL_PACKAGE, {
      taxYear: store.profile.fiscalYear,
      asOfDate,
    });
    return selectTaxDerived(store, activeRules);
  }, [store, asOfDate]);
}

/** Latest tax estimate derived from the current financial data:
 *  profile + the deductible expense subset (CF art. 68) + the annual projection of that subset
 *  (falling back to actuals-to-date when the projection model has no run rate) + active rule release
 *  → Step 15 engine.
 *  Recomputes automatically when the store or asOfDate changes.
 *
 *  This is the LIVE path the dashboard renders, and it must feed the engine the same quantity
 *  `data/dashboard.ts getTaxEstimate` does — both go through `estimateBasis.ts selectEstimateOperands`,
 *  so they cannot drift apart. TASK 2b moved the deductible-subset decision into that assembler for
 *  exactly this reason: applying it here instead would have made the rendered figure and the tested
 *  figure two different quantities (the Phase 10 flake class).
 *
 *  The financial view (`useFinancialDerived`) still reports every recorded expense: what the user paid
 *  and what the law lets them deduct are different questions, and only the second one is filtered.
 */
export function useLatestTaxEstimate(asOfDate: string = todayISO()): {
  estimate: TaxEstimateWithBasis | null;
  loading: boolean;
} {
  const store = useStore();
  const [estimate, setEstimate] = useState<TaxEstimateWithBasis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const operands = selectEstimateOperands(store, asOfDate, PFA_2026_SYSTEM_REAL_PACKAGE);
    if (operands.kind === 'refused') {
      // Art. 68^3 (defect B-29): there is no expense engine for this activity, so the engine is never
      // called and no number is rendered. The refusal arrives as `review_required` naming the rule.
      setEstimate(attachEstimateBasis(operands.result, operands.basis));
      setLoading(false);
      return;
    }
    const { basis, amounts } = operands;
    const taxInputs = selectTaxDerived(
      store,
      selectApplicableRules(PFA_2026_SYSTEM_REAL_PACKAGE, {
        taxYear: store.profile.fiscalYear,
        asOfDate,
      }),
    );
    computeTaxEstimate({
      inputs: taxInputs.inputs,
      profile: store.profile,
      revenues: amounts.revenues,
      expenses: amounts.expenses,
      revenuesNet: amounts.revenuesNet,
      expensesNet: amounts.expensesNet,
      ruleRelease: PFA_2026_RELEASE,
      rules: PFA_2026_SYSTEM_REAL_PACKAGE,
    }).then((result) => {
      if (!cancelled) {
        setEstimate(attachEstimateBasis(result, basis));
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [store, asOfDate]);

  return { estimate, loading };
}
