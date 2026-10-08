/**
 * Task 1 (pre-Phase-11) — which quantity enters the tax engine, and what a consumer can tell
 * about it.
 *
 * Before this module the annual tax estimate was fed raw `selectYtd` totals, so a current-year
 * dashboard put an actuals-to-date number behind a label that reads as a year. The annualisation
 * rule already exists in `src/domain/projection.ts` (run rate = YTD / elapsed months, annual =
 * run rate × 12). This module does NOT re-derive that rule — it decides which of the model’s
 * outputs may enter the engine, and records that decision in the data so `actual` and `projected`
 * are distinguishable without parsing a label.
 *
 * Two rules this module exists to enforce:
 *
 * 1. Never annualise what cannot be annualised. `selectProjectionV1` has no refusal channel: for
 *    an `asOfDate` before the fiscal year start it returns a zero denominator and all-zero
 *    totals. That is not a projection, it is the absence of one, and feeding those zeros to the
 *    engine would print a plausible `0,00 RON` annual estimate. Here that case becomes an explicit
 *    `actuals-only` basis instead - the honest output the brief requires, not a number.
 * 2. The basis travels with the result. `attachEstimateBasis` puts the basis on the engine’s
 *    `TaxEstimateResult` without the engine knowing this module exists, so every existing consumer
 *    keeps reading the same fields while a new one can ask what the numbers mean.
 *
 * No fiscal value, rate, parameter or rule lives here.
 */
import type { YtdTotals } from './aggregation';
import type { Bani } from './money';
import type { ProjectionV1 } from './projection';
import type { TaxEstimateResult } from './tax';

/** The four money operands `computeTaxEstimate` takes (`tax.ts` `TaxCalculationInput`). */
export interface EstimateAmounts {
  revenues: Bani;
  expenses: Bani;
  revenuesNet: Bani;
  expensesNet: Bani;
}

/**
 * What fed the engine, in the data rather than in the wording.
 *
 * - `annual-projected` — the engine ran on the projection model’s annual figures. `actual` keeps
 *   the actuals-to-date they were derived from, so a consumer can show or audit both.
 * - `actuals-only` — the model could not project, so the engine ran on actuals-to-date. This is
 *   not a weaker annual estimate; it is a different, honestly-labelled quantity.
 * - `unknown` - an estimate that arrived without a recorded basis (a hand-built result, the
 *   loading sentinel). Nothing may be claimed about actual vs projected.
 */
export type TaxEstimateBasis =
  | {
      kind: 'annual-projected';
      method: 'run-rate-v1';
      /** The denominator the projection model actually used, after its own lower bound. */
      elapsedMonths: number;
      actual: EstimateAmounts;
      projected: EstimateAmounts;
    }
  | {
      kind: 'actuals-only';
      method: null;
      elapsedMonths: number;
      actual: EstimateAmounts;
      reason: string;
    }
  | {
      kind: 'unknown';
      method: null;
      elapsedMonths: null;
      reason: string;
    };

/**
 * A basis that carries amounts. `selectTaxEstimateBasis` can only ever produce one of the two
 * recorded kinds; `unknown` exists solely for results that arrived from elsewhere.
 */
export type AttributedEstimateBasis = Exclude<TaxEstimateBasis, { kind: 'unknown' }>;

/** The actuals-to-date operands, read off `YtdTotals` in one place. */
export function actualEstimateAmounts(ytd: YtdTotals): EstimateAmounts {
  return {
    revenues: ytd.revenue,
    expenses: ytd.expenses,
    revenuesNet: ytd.revenueNet,
    expensesNet: ytd.expenseNet,
  };
}

/**
 * Decide the basis from the projection model’s own output.
 *
 * The only condition tested is the model’s own degenerate signal: `elapsedMonths` is its
 * denominator after its own lower bound, and `0` means "no run rate exists". Nothing is invented
 * here — in particular a partial year is NOT a refusal, because the model does not treat it as
 * one: it normalises by the fractional denominator and multiplies by 12.
 */
export function selectTaxEstimateBasis(
  projection: ProjectionV1,
  ytd: YtdTotals,
): AttributedEstimateBasis {
  const actual = actualEstimateAmounts(ytd);
  const elapsedMonths = projection.elapsedMonths;

  if (!(elapsedMonths > 0) || !Number.isFinite(elapsedMonths)) {
    return {
      kind: 'actuals-only',
      method: null,
      elapsedMonths: Number.isFinite(elapsedMonths) ? elapsedMonths : 0,
      actual,
      reason:
        'Nu există o rată de desfășurare pentru această dată (0 luni scurse din anul fiscal); ' +
        'valorile sunt cele înregistrate până acum, neannualizate.',
    };
  }

  return {
    kind: 'annual-projected',
    method: projection.method,
    elapsedMonths,
    actual,
    projected: {
      revenues: projection.annualProjected.revenue,
      expenses: projection.annualProjected.expenses,
      revenuesNet: projection.annualProjectedExclVat.revenueNet,
      expensesNet: projection.annualProjectedExclVat.expenseNet,
    },
  };
}

/** The four operands that must be handed to `computeTaxEstimate` for this basis. */
export function amountsForEstimate(basis: AttributedEstimateBasis): EstimateAmounts {
  return basis.kind === 'annual-projected' ? basis.projected : basis.actual;
}

/**
 * The engine’s result plus the basis that produced it. This is an intersection, not a new shape:
 * it stays assignable to `TaxEstimateResult`, so every consumer that does not care about the basis
 * keeps compiling and keeps reading exactly the fields it read before.
 */
export type TaxEstimateWithBasis = TaxEstimateResult & { basis: TaxEstimateBasis };

export function attachEstimateBasis(
  result: TaxEstimateResult,
  basis: TaxEstimateBasis,
): TaxEstimateWithBasis {
  return { ...result, basis };
}

/** The recorded basis, or `null` when this result never had one. */
export function estimateBasisOf(result: TaxEstimateResult): TaxEstimateBasis | null {
  const basis = (result as { basis?: TaxEstimateBasis }).basis;
  return basis ?? null;
}

/**
 * Normalise an estimate so a consumer can always read a basis. An unattributed result is labelled
 * `unknown` rather than being assumed projected or assumed actual — guessing here is how a label
 * ends up claiming more than the data supports.
 */
export function withEstimateBasis(result: TaxEstimateResult): TaxEstimateWithBasis {
  const basis = estimateBasisOf(result);
  if (basis !== null) return result as TaxEstimateWithBasis;
  return attachEstimateBasis(result, {
    kind: 'unknown',
    method: null,
    elapsedMonths: null,
    reason:
      'Baza acestei estimări nu a fost înregistrată; nu se poate afirma dacă valorile sunt reale sau proiectate.',
  });
}

/** A fractional month count in Romanian typography, without a spurious `.0`. */
export function formatElapsedMonths(months: number): string {
  const rounded = Math.round(months * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
}

/**
 * The wording rule. A run-rate projection is an assumption about the rest of the year, not a
 * forecast of fact, so the label names the assumption and states how many months it rests on.
 * `YTD` is only ever said when the numbers really are actuals-to-date.
 */
export function estimateBasisLabel(basis: TaxEstimateBasis | null): string {
  if (basis === null || basis.kind === 'unknown') return 'Estimare impozit';
  if (basis.kind === 'actuals-only') return 'Înregistrat până acum (neannualizat)';
  return (
    'Estimare anuală pe rată de desfășurare (' +
    formatElapsedMonths(basis.elapsedMonths) +
    ' din 12 luni scurse)'
  );
}

/**
 * The short label for one figure. `YTD` is said only when the figure really is actuals-to-date, so
 * an annual run-rate figure can never be read as money already collected or paid.
 */
export function estimateFigureLabel(basis: TaxEstimateBasis | null): string {
  if (basis === null || basis.kind === 'unknown') return 'Estimare impozit';
  if (basis.kind === 'actuals-only') return 'Estimare impozit YTD';
  return 'Estimare impozit anuală (rată de desfășurare)';
}

/**
 * One sentence that states what the displayed amounts are. It must not imply more certainty than a
 * run-rate assumption carries: the projection is the rest of the year assumed to repeat the months
 * already recorded, and it moves as the year advances.
 */
export function estimateBasisExplanation(basis: TaxEstimateBasis | null): string {
  if (basis === null || basis.kind === 'unknown') {
    return 'Baza acestei estimări nu este înregistrată, deci valorile nu pot fi prezentate nici ca realizate, nici ca proiectate.';
  }
  if (basis.kind === 'actuals-only') {
    return 'Valorile de mai jos sunt cele înregistrate până acum, neannualizate. ' + basis.reason;
  }
  return (
    'Valorile anuale sunt extrapolate din rata de desfășurare a lunilor înregistrate până acum ' +
    '(' + formatElapsedMonths(basis.elapsedMonths) + ' din 12). Nu sunt o previziune a cifrelor reale: ' +
    'se ajustează pe măsură ce anul fiscal avansează.'
  );
}
