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
import { selectRuleSet } from '../domain/fiscal';
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
    // TASK 6: the rule set is selected from the profile's fiscal year and the as-of date. Nothing in this
    // file names a year any more, so a profile that says another year gets no rules instead of getting
    // 2026's.
    const selection = selectRuleSet(store.profile.fiscalYear, asOfDate);
    const activeRules = selectApplicableRules(selection ? [...selection.rules] : [], {
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
    // TASK 6: one selection per run, shared by the operand assembler, the input selector and the engine —
    // the three cannot now disagree about which rules they were given, and none of them can name a year.
    const selection = selectRuleSet(store.profile.fiscalYear, asOfDate);
    const rules = selection ? [...selection.rules] : [];
    const operands = selectEstimateOperands(store, asOfDate, rules);
    if (operands.kind === 'refused') {
      // Art. 68^3 (defect B-29): there is no expense engine for this activity, so the engine is never
      // called and no number is rendered. The refusal arrives as `review_required` naming the rule.
      // PG-6a: the refusal is no longer composed here or in the assembler as a special case — the
      // scenario registry decided it, and the scenario travels on the estimate so the hero can name it
      // and link to the control that fixes it.
      setEstimate(
        attachEstimateBasis(
          operands.result,
          operands.basis,
          operands.scenarios,
          undefined,
          operands.depreciation,
          // B-144 — threaded, not re-read, and identical to `data/dashboard.ts getTaxEstimate` by
          // construction: the live path and the tested path must agree about which rate measured the income.
          operands.provisionalIncomeRates,
        ),
      );
      setLoading(false);
      return;
    }
    const { basis, amounts } = operands;
    const taxInputs = selectTaxDerived(
      store,
      selectApplicableRules(rules, {
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
      // PG-6f (B-30) — threading only, identical to `data/dashboard.ts getTaxEstimate` by construction.
      // The assembler ran the per-line input-VAT decision once, over the same ledger pass, and this is the
      // base it produced; the engine no longer chooses a measure from a profile boolean.
      expenseBase: operands.expenseBase,
      // PG-6h-1 — threading only, identical to `data/dashboard.ts getTaxEstimate` by construction: both
      // read the field the assembler decided, so the rendered figure and the tested figure cannot disagree
      // about whether an art. 68^3 source exists.
      flatRatioGross: amounts.flatRatioGross ?? null,
      // B-88 — threading only, and identical to `data/dashboard.ts getTaxEstimate` by construction: which
      // flat article a gross belongs to is decided once by the assembler, never at a call site.
      flatRatioMethod: amounts.flatRatioMethod ?? null,
      // B-105 — threaded, not re-read. The assembler resolved whether art. 84^1 alin. (8) switched the
      // withholding off; the engine decides from that answer whether the 10 % is the payer's to withhold or
      // this taxpayer's to pay, and a second reading of the lease facts at a call site is how one register
      // ends up with two answers about the same tax.
      flatRatioWithholdingBlocked: amounts.flatRatioWithholdingBlocked ?? false,
      // B-147 / B-150 — threading only, identical to `data/dashboard.ts getTaxEstimate` by construction:
      // `selectYtd` cut the recorded DPI gross by the art. 72 alin. (3) flag, and this hands both halves to
      // the engine so it can put the quota-bearing one through the rule that states the quota. Neither is
      // re-read here — a call site that walked the register would be a second producer of the DPI subset.
      dpiQuotaGross: amounts.dpiQuotaGross ?? null,
      dpiExcludedGross: amounts.dpiExcludedGross ?? null,
      ruleRelease: selection ? selection.release : null,
      rules,
      // B-109 — threading only, and identical to `data/dashboard.ts getTaxEstimate` by construction: the
      // assembler struck the asset leg once, over the same ledger pass, and this hands that same leg to the
      // engine so the snapshot can content-address it as `assetRegisterHash`. Nothing is re-derived here.
      depreciation: operands.depreciation,
    }).then((result) => {
      if (!cancelled) {
        setEstimate(
          attachEstimateBasis(
            result,
            basis,
            operands.scenarios,
            operands.inputVat,
            operands.depreciation,
            // B-144 — see the refused branch above: the same field, the same single producer.
            operands.provisionalIncomeRates,
          ),
        );
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [store, asOfDate]);

  return { estimate, loading };
}
