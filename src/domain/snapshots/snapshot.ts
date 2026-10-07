import type { PfaProfile } from '../models';
import type { RuleRelease } from '../fiscal/rules';
import type { Bani } from '../money';
import type { CalculationInput, CalculationLine, CalculationOutput, SnapshotStatus, TaxCalculationSnapshot } from './types';
import { computeInputsHash } from './hash';
import { toInstantISO } from '../date';

export interface CreateSnapshotParams {
  profile: PfaProfile;
  /**
   * Integer **bani**. These two values are the money that feeds `inputsHash`: `canonicalize` writes a
   * number as `String(value)`, so the unit is part of the digest's bytes. Convert to whole bani BEFORE
   * calling this, or the digest carries float noise (`7128.100000000001`) and stops being reproducible.
   */
  revenues: Bani;
  expenses: Bani;
  ruleRelease: RuleRelease;
  calculationLines: CalculationLine[];
  output: CalculationOutput;
  /** Defaults to now (ISO 8601). */
  calculatedAt?: string;
  /** Defaults to 'computed'. */
  status?: SnapshotStatus;
}

/**
 * Build an immutable calculation snapshot.
 *
 * The snapshot embeds the rule release and the inputs, computes the
 * deterministic inputsHash, and is ready to be appended to storage.
 * It does NOT run any tax formula — the lines/output are provided by the
 * caller (the fiscal engine arrives in later stages).
 */
export async function createCalculationSnapshot(p: CreateSnapshotParams): Promise<TaxCalculationSnapshot> {
  const inputSnapshot: CalculationInput = {
    profile: p.profile,
    revenues: p.revenues,
    expenses: p.expenses,
  };
  return {
    calculationId: `calc-${p.ruleRelease.taxYear}-${crypto.randomUUID()}`,
    taxYear: p.ruleRelease.taxYear,
    calculatedAt: p.calculatedAt ?? toInstantISO(),
    ruleRelease: p.ruleRelease,
    inputSnapshot,
    inputsHash: await computeInputsHash(inputSnapshot),
    calculationLines: p.calculationLines,
    output: p.output,
    status: p.status ?? 'computed',
  };
}
