/**
 * Calculation snapshot / provenance model (Step 12).
 *
 * A TaxCalculationSnapshot is an immutable audit record of one calculation:
 * the inputs, the exact rule release used, the deterministic execution
 * result, and provenance metadata. Snapshots are append-only: old snapshots
 * are never rewritten when a new RuleRelease becomes active.
 *
 * The snapshot embeds (not references) the rule release and the input data,
 * so changing the current profile, data, or rules can never retroactively
 * change what a stored snapshot means.
 */
import type { PfaProfile } from '../models';
import type { RuleRelease } from '../fiscal/rules';

/** Lifecycle status of a snapshot. */
export type SnapshotStatus = 'computed' | 'superseded' | 'void';

/** The frozen inputs a calculation ran on. */
export interface CalculationInput {
  profile: PfaProfile;
  /** Total revenues (valoareFaraTva), lei. */
  revenues: number;
  /** Total expenses (valoareFaraTva), lei. */
  expenses: number;
}

/** One labeled line of the calculation breakdown. */
export interface CalculationLine {
  label: string;
  value: number;
}

/** Final result of the calculation. */
export interface CalculationOutput {
  total: number;
}

/** Immutable audit record of a single calculation. */
export interface TaxCalculationSnapshot {
  /** Unique, stable ID (e.g. `calc-<taxYear>-<uuid>`). */
  calculationId: string;
  /** Tax year the calculation applies to (from the rule release). */
  taxYear: number;
  /** When the calculation was executed (ISO 8601). */
  calculatedAt: string;
  /** The exact rule release used — embedded, not referenced. */
  ruleRelease: RuleRelease;
  /** Frozen input data — embedded, not referenced. */
  inputSnapshot: CalculationInput;
  /** SHA-256 hex digest of the canonical serialization of inputSnapshot. */
  inputsHash: string;
  /** Per-line breakdown of the calculation. */
  calculationLines: CalculationLine[];
  /** Final result. */
  output: CalculationOutput;
  /** Explicit lifecycle status. */
  status: SnapshotStatus;
}
