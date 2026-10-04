/**
 * Tax reserve layer (Step 17).
 *
 * Pure, deterministic cash-planning model that turns an ALREADY-COMPUTED
 * tax estimate (TaxEstimateResult from ./tax) into a reserve recommendation.
 *
 * Invariant: ESTIMATED TAX LIABILITY and RECOMMENDED CASH RESERVE are kept
 * strictly separate in the output shape. The reserve recommendation is a
 * cash-planning number and must never be presented as a tax liability.
 *
 * No tax calculation is re-derived here: the full-year liability is consumed
 * verbatim from the tax engine output (output.total when status === 'computed').
 */
import type { TaxEstimateResult } from './tax';

/**
 * Minimal deterministic cash-planning state for the tax reserve.
 *
 * `reservedAmount` is a lei amount managed by the user (cash already set
 * aside for taxes). Tri-state semantics:
 * - `null` — no data recorded (no amount has ever been entered);
 * - `0` — an explicit zero;
 * - `> 0` — a real reserved amount.
 *
 * This is NOT persisted by this module — the UI step wires
 * state/persistence later. No AppData/store changes.
 */
export interface TaxReserveState {
  /**
   * Lei already reserved for taxes. Tri-state: `null` = no data recorded,
   * `0` = explicit zero, `> 0` = real amount (always >= 0 when a number).
   */
  reservedAmount: number | null;
}

/** Calendar query parameters for the reserve recommendation. */
export interface TaxReserveQuery {
  /** ISO 'YYYY-MM-DD' — inclusive start of the remaining period. */
  asOfDate: string;
  /** Fiscal year the estimate applies to (e.g. 2026). */
  fiscalYear: number;
}

/**
 * Reserve recommendation — liability and reserve are separate fields.
 *
 * - `estimatedTaxLiability` is the tax engine's full-year total (lei),
 *   verbatim, or null when no estimate is available.
 * - `reservedAmount` / `remainingTarget` / `recommendedMonthlyReserve` are
 *   cash-planning numbers, never tax liability.
 * - `reservedAmount` is the tri-state carried through verbatim from the
 *   state: `null` = no data recorded, `0` = explicit zero, `> 0` = real.
 */
export interface TaxReserveRecommendation {
  /** Estimated full-year tax liability (lei) from the tax engine. null when unavailable. */
  estimatedTaxLiability: number | null;
  /**
   * Lei already reserved (cash-planning input), carried through verbatim.
   * Tri-state: `null` = no data recorded, `0` = explicit zero, `> 0` = real.
   */
  reservedAmount: number | null;
  /** max(0, estimatedTaxLiability − (reservedAmount ?? 0)). 0 when no estimate. */
  remainingTarget: number;
  /** Calendar months remaining from asOfDate through fiscalYear-12, inclusive (0–12). */
  monthsRemaining: number;
  /** remainingTarget ÷ monthsRemaining. 0 when no estimate or no months remaining. */
  recommendedMonthlyReserve: number;
}

/**
 * Create a tax-reserve state. `null` passes through unchanged (no data
 * recorded); numbers are clamped to a non-negative lei amount.
 */
export function createTaxReserveState(reservedAmount: number | null): TaxReserveState {
  return { reservedAmount: reservedAmount === null ? null : Math.max(0, reservedAmount) };
}

/**
 * Return a NEW state with `amount` lei added to the reserve.
 * A negative `amount` is a withdrawal; the result is clamped at 0.
 * A `null` reserve (no data recorded) becomes the clamped `amount` —
 * adding to it records an explicit amount for the first time.
 * Pure — the input state is never mutated.
 */
export function addToTaxReserve(state: TaxReserveState, amount: number): TaxReserveState {
  return { reservedAmount: Math.max(0, (state.reservedAmount ?? 0) + amount) };
}

/**
 * Calendar months remaining in the fiscal year, from the month of `asOfDate`
 * through fiscalYear-12, inclusive. Deterministic calendar arithmetic:
 * - before the fiscal year  → 12
 * - after the fiscal year   → 0
 * - inside the fiscal year  → 13 − month(asOfDate)
 */
export function monthsRemainingInFiscalYear(asOfDate: string, fiscalYear: number): number {
  const yearPrefix = String(fiscalYear);
  if (asOfDate < `${yearPrefix}-01-01`) return 12;
  if (asOfDate > `${yearPrefix}-12-31`) return 0;
  const month = Number(asOfDate.slice(5, 7));
  return 13 - month;
}

/**
 * Compute the tax-reserve recommendation from an already-computed estimate.
 *
 * - `estimate` is the tax engine's TaxEstimateResult, or null when no
 *   estimate is available. Only `status === 'computed'` carries a liability
 *   (`output.total`); anything else (null / review_required) → liability null,
 *   remaining target 0, monthly reserve 0.
 * - `state` supplies the already-reserved lei (cash-planning input,
 *   tri-state: null = no data recorded, 0 = explicit zero, > 0 = real).
 *   The tri-state is carried through verbatim in the recommendation;
 *   `null` is treated as 0 only for the remaining-target math.
 * - `query` supplies asOfDate + fiscalYear for the calendar month math.
 *
 * Synchronous and pure: same (estimate, state, query) ⇒ same output.
 * No tax formula, parameter, or rule logic lives here.
 */
export function computeTaxReserve(
  estimate: TaxEstimateResult | null,
  state: TaxReserveState,
  query: TaxReserveQuery,
): TaxReserveRecommendation {
  const monthsRemaining = monthsRemainingInFiscalYear(query.asOfDate, query.fiscalYear);
  const estimatedTaxLiability =
    estimate !== null && estimate.status === 'computed' ? estimate.output.total : null;

  const reservedAmount = state.reservedAmount;
  const remainingTarget =
    estimatedTaxLiability === null
      ? 0
      : Math.max(0, estimatedTaxLiability - (reservedAmount ?? 0));
  const recommendedMonthlyReserve =
    estimatedTaxLiability === null || monthsRemaining === 0
      ? 0
      : remainingTarget / monthsRemaining;

  return {
    estimatedTaxLiability,
    reservedAmount,
    remainingTarget,
    monthsRemaining,
    recommendedMonthlyReserve,
  };
}
