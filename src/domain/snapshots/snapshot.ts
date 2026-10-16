import type { PfaProfile } from '../models';
import type { FiscalRule, RuleRelease } from '../fiscal/rules';
import type { DepreciationLeg } from '../estimateBasis';
import type { Bani } from '../money';
import type { CalculationInput, CalculationLine, CalculationOutput, SnapshotStatus, TaxCalculationSnapshot } from './types';
import { computeInputsHash } from './hash';
import { ruleSetDigest } from '../fiscal/ruleSetDigest';
import { assetRegisterDigest } from './assetRegisterDigest';
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
  /**
   * B-109: the asset leg the calculation actually consumed — the register as `estimateBasis.ts`
   * `selectAssetDepreciation` filtered it for the year, not the raw `FixedAsset` rows. Required, for the
   * same reason `rules` is: a snapshot that does not record the register its number came from is the
   * defect this closes. `null` is the honest answer for a call site that genuinely has no leg in hand (a
   * hand-built fixture, a caller that predates B-109); it is never filled in by guessing, and an empty leg
   * is NOT `null` — an empty leg digests, and says the number had no asset leg.
   */
  depreciation: DepreciationLeg | null;
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
 *
 * B-109 adds a third digest on the same shape, for the same reason and with one honest difference. Since
 * B-93 the engine also consumes a depreciation leg derived from the **asset register**, and the register is
 * not in `inputSnapshot` either — so a stored number could move for a cause the record could not name.
 * `assetRegisterHash` goes beside `inputsHash` exactly as `ruleSetHash` did. The difference: the rules are
 * the engine, while the register is **user data the user gave**, so it is a sibling for stored-data
 * compatibility, not because it is conceptually not an input. That is recorded here so nobody reads the
 * parallel as cleaner than it is.
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
    // B-109: beside `inputsHash`, never inside it. `inputSnapshot` keeps its three keys byte for byte.
    assetRegisterHash: p.depreciation === null ? null : assetRegisterDigest(p.depreciation),
    calculationLines: p.calculationLines,
    output: p.output,
    status: p.status ?? 'computed',
  };
}

/**
 * B-49 — when two snapshots ARE the same calculation.
 *
 * Wiring the write path means the app now records a calculation every time it computes one, and the live
 * estimate recomputes on every provider render (`data/derived.ts` depends on the whole store object, and
 * `data/store.tsx` builds that object fresh each render). Without an identity test the register would
 * mint a new record for every toast, and "append-only" would become an unbounded log of one number.
 *
 * The identity is the three digests plus the figure. `calculationId` cannot serve — it is a random UUID,
 * so the same facts computed twice produce two ids and the duplicate would be kept. The digests are
 * exactly the content-addressing Phase 20 built for replay, so this reuses the machinery rather than
 * inventing a fourth key: same inputs, same rule set, same asset register, same total ⇒ same calculation.
 * Anything that moves the number moves at least one of them.
 */
export function isSameCalculation(a: TaxCalculationSnapshot, b: TaxCalculationSnapshot): boolean {
  return (
    a.inputsHash === b.inputsHash &&
    a.ruleSetHash === b.ruleSetHash &&
    a.assetRegisterHash === b.assetRegisterHash &&
    a.output.total === b.output.total
  );
}
