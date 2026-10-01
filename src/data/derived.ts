// Step 14 — thin reactive hooks. The flat store (store.tsx) is the reactivity
// mechanism: these hooks read AppData via useStore() and re-run the pure
// selectors on every state change (new AppData reference). No new reactive
// infrastructure — no event bus, no middleware, no subscription framework.

import { useMemo } from 'react';
import { useStore } from './store';
import {
  selectFinancialDerived,
  selectTaxDerived,
  type FinancialDerivedView,
  type TaxDerivedView,
} from '../domain/derived';
import { selectApplicableRules } from '../domain/fiscal/select';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../domain/fiscal';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
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
