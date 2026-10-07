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
import { addBani, divBani, maxBani, subBani, type Bani } from './money';

/**
 * Minimal deterministic cash-planning state for the tax reserve.
 *
 * `reservedAmount` is a bani amount managed by the user (cash already set
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
   * Reserved amount for taxes, in integer bani. Tri-state: `null` = no data recorded,
   * `0` = explicit zero, `> 0` = real amount (always >= 0 when a number).
   */
  reservedAmount: Bani | null;
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
 * - `estimatedTaxLiability` is the tax engine's full-year total (bani),
 *   verbatim, or null when no estimate is available.
 * - `reservedAmount` / `remainingTarget` / `recommendedMonthlyReserve` are
 *   cash-planning numbers, never tax liability.
 * - `reservedAmount` is the tri-state carried through verbatim from the
 *   state: `null` = no data recorded, `0` = explicit zero, `> 0` = real.
 */
export interface TaxReserveRecommendation {
  /** Estimated full-year tax liability (bani) from the tax engine. null when unavailable. */
  estimatedTaxLiability: Bani | null;
  /**
   * Already reserved (cash-planning input, bani), carried through verbatim.
   * Tri-state: `null` = no data recorded, `0` = explicit zero, `> 0` = real.
   */
  reservedAmount: Bani | null;
  /** max(0, estimatedTaxLiability − (reservedAmount ?? 0)), in bani. 0 when no estimate. */
  remainingTarget: Bani;
  /** Calendar months remaining from asOfDate through fiscalYear-12, inclusive (0–12). */
  monthsRemaining: number;
  /**
   * remainingTarget ÷ monthsRemaining, in bani. 0 when no estimate or no months remaining.
   *
   * A planning suggestion, not a sum due: this division is `divBani` (nearest ban), never `roundArt66`.
   * `recommendedMonthlyReserve × monthsRemaining` can therefore differ from `remainingTarget` by a few
   * bani — `remainingTarget` is the authoritative figure.
   */
  recommendedMonthlyReserve: Bani;
}

/**
 * Create a tax-reserve state. `null` passes through unchanged (no data
 * recorded); numbers are clamped to a non-negative lei amount.
 */
export function createTaxReserveState(reservedAmount: Bani | null): TaxReserveState {
  return { reservedAmount: reservedAmount === null ? null : maxBani(reservedAmount, 0 as Bani) };
}

/**
 * Return a NEW state with `amount` (bani) added to the reserve.
 * A negative `amount` is a withdrawal; the result is clamped at 0.
 * A `null` reserve (no data recorded) becomes the clamped `amount` —
 * adding to it records an explicit amount for the first time.
 * Pure — the input state is never mutated.
 */
export function addToTaxReserve(state: TaxReserveState, amount: Bani): TaxReserveState {
  return { reservedAmount: maxBani(addBani(state.reservedAmount ?? (0 as Bani), amount), 0 as Bani) };
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
 * - `state` supplies the already-reserved amount in bani (cash-planning input,
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
  const remainingTarget: Bani =
    estimatedTaxLiability === null
      ? (0 as Bani)
      : maxBani(subBani(estimatedTaxLiability, reservedAmount ?? (0 as Bani)), 0 as Bani);
  const recommendedMonthlyReserve: Bani =
    estimatedTaxLiability === null || monthsRemaining === 0
      ? (0 as Bani)
      : divBani(remainingTarget, monthsRemaining);

  return {
    estimatedTaxLiability,
    reservedAmount,
    remainingTarget,
    monthsRemaining,
    recommendedMonthlyReserve,
  };
}
