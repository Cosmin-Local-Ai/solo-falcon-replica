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
import { computeTaxEstimate, type TaxEstimateResult } from '../domain/tax';

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
 *  profile + YTD totals + active rule release → Step 15 engine.
 *  Recomputes automatically when the store or asOfDate changes. */
export function useLatestTaxEstimate(asOfDate: string = todayISO()): {
  estimate: TaxEstimateResult | null;
  loading: boolean;
} {
  const store = useStore();
  const [estimate, setEstimate] = useState<TaxEstimateResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const derived = selectFinancialDerived(store, asOfDate);
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
      revenues: derived.ytd.revenue,
      expenses: derived.ytd.expenses,
      revenuesNet: derived.ytd.revenueNet,
      expensesNet: derived.ytd.expenseNet,
      ruleRelease: PFA_2026_RELEASE,
      rules: PFA_2026_SYSTEM_REAL_PACKAGE,
    }).then((result) => {
      if (!cancelled) {
        setEstimate(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [store, asOfDate]);

  return { estimate, loading };
}
