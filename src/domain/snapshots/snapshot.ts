import type { PfaProfile } from '../models';
import type { FiscalRule, RuleRelease } from '../fiscal/rules';
import type { Bani } from '../money';
import type { CalculationInput, CalculationLine, CalculationOutput, SnapshotStatus, TaxCalculationSnapshot } from './types';
import { computeInputsHash } from './hash';
import { ruleSetDigest } from '../fiscal/ruleSetDigest';
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
  /**
   * TASK 6: the rules the calculation actually applied — the effective set, after the year and the
   * effective-date window have filtered it, not the whole package. Required, because a snapshot that does
   * not record its arithmetic is the defect this phase closes: `releaseId` alone could not tell two rule
   * sets apart, and it did not even change when the arithmetic did.
   */
  rules: readonly FiscalRule[];
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
 *
 * TASK 6 adds the second digest. `inputsHash` covers `inputSnapshot`, which is the enumerated subset
 * `{ profile, revenues, expenses }` and stays exactly that (TASK 3 pinned it, and moving it would
 * invalidate every stored digest). The rule set is therefore addressed on the CALCULATION RECORD, as
 * `ruleSetHash`, beside `inputsHash` — because the rules are the engine that produced the number, not an
 * input the user gave. See `docs/ai/phases/20_rule_release_immutability.md` §3 for the decision and its
 * reasoning.
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
    ruleSetHash: ruleSetDigest(p.rules),
    inputSnapshot,
    inputsHash: await computeInputsHash(inputSnapshot),
    calculationLines: p.calculationLines,
    output: p.output,
    status: p.status ?? 'computed',
  };
}
