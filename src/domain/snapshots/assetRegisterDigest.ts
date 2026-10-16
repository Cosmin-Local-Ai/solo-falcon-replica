/**
 * B-109 — content-addressing the asset register's contribution to a calculation.
 *
 * The defect this exists to close: B-93 gave the engine a depreciation leg derived from the **asset
 * register**, but `inputSnapshot` is the enumerated subset `{ profile, revenues, expenses }` and stays
 * exactly that (TASK 3 pinned it; moving it would invalidate every stored digest). So the record carried
 * a number that the register had moved, and carried nothing that named the register. Two snapshots could
 * carry the same `inputsHash` while the register behind them differed, and the digest that exists to make
 * a number explainable could not explain the difference.
 *
 * The fix follows the precedent the same file already set for the rule set: a **sibling digest on the
 * calculation record**, beside `inputsHash`, never inside it. See
 * `docs/ai/phases/20_rule_release_immutability.md` §3 and `snapshot.ts`.
 *
 * **What is digested: the leg, not the whole register.** `DepreciationLeg` is the register as the estimate
 * consumed it — the schedules that survived the fiscal-year window, the art. 28 alin. (14) ceiling and the
 * B-93 double-count refusal, plus the assets that refused for want of a declared fact. This is the same
 * judgement `CreateSnapshotParams.rules` records for the rules: the digest covers *the effective set, after
 * the year and the effective-date window have filtered it, not the whole package*. A digest over the raw
 * `FixedAsset` rows would move for an asset the year never read, and would then have to be explained by a
 * second projection that could disagree with the one that produced the figure.
 *
 * **Where the analogy with `ruleSetHash` breaks, and it does break.** The rule set is the engine that
 * consumed the inputs; the asset register is **user data the user gave**, which is why it arguably belongs
 * in `inputSnapshot` at all. It sits beside `inputsHash` for **stored-data compatibility, not conceptual
 * correctness**: putting it inside the subset would have moved every digest a real user has stored. That
 * distinction is recorded here rather than papered over.
 *
 * Included, and why:
 *   - `fiscalYear` and `total` — the year the leg belongs to, and the sum that was added to the expense leg.
 *     `total` is the quantity the number actually moved by.
 *   - per posted asset: `assetId`, `months`, `uncapped`, `deductible`, `lost`, `branch`. Those are the
 *     arithmetic the register contributed: the months decide the pro-rating, `uncapped` and `lost` show the
 *     art. 28 alin. (14) ceiling biting, `branch` says which of the four art. 28 routes produced the figure.
 *   - per conflicted asset: `assetId`, `expenseIds`, `withheld`. A withheld schedule is a figure that is
 *     **not** in the number, and the record has to be able to say why not. Without it, a snapshot taken
 *     before and after a double-count refusal would carry the same digest for two different states.
 *   - per refused asset: `assetId` and `gap`. The missing fact, by its code.
 *
 * Excluded, and why:
 *   - `label` — the person's own name for the asset. It is a label, and nothing branches on it; renaming an
 *     asset must not read as a change of arithmetic. Same reasoning that keeps `name` out of `ruleSetDigest`.
 *   - the refusal's `reason` prose — **a hash is not a sentence.** The `gap` code is what the app branches
 *     on; the wording may be corrected without turning a calculation into a different calculation.
 *
 * Canonicalisation is the whole point, and it is shared: the projection is ordered by `assetId` with plain
 * `<` on strings — NOT `localeCompare`, because locale comparison is environment-dependent and an
 * environment-dependent digest is not a content address — and the bytes are produced by the same
 * `canonicalize` that already pins `inputsHash` (`./serialize`), which sorts object keys lexicographically.
 */
import type { DepreciationLeg } from '../estimateBasis';
import type { Bani } from '../money';
import { canonicalize } from './serialize';
import { sha256Hex } from './hashSync';

/**
 * The digest scheme tag, mixed into the hashed bytes. If the projection ever changes — a field added to or
 * dropped from the subset above — the tag changes with it, so two digests can never be compared as if they
 * came from the same scheme.
 */
export const ASSET_REGISTER_SCHEME = 'pfa-asset-register-v1';

/** One posted schedule as the digest sees it: the asset, the arithmetic, and the ceiling's bite. */
export type DigestAssetLine = {
  assetId: string;
  months: number;
  uncapped: Bani;
  deductible: Bani;
  lost: Bani;
  branch: string;
};

/** One withheld schedule: what posting it would have added, and the expenses that make it unsafe. */
export type DigestAssetConflict = {
  assetId: string;
  expenseIds: string[];
  withheld: Bani;
};

/** One asset whose schedule refused: the asset, and which declared fact is missing. */
export type DigestAssetRefusal = {
  assetId: string;
  gap: string;
};

/** The whole leg as the digest sees it. */
export type DigestAssetLeg = {
  fiscalYear: number;
  total: Bani;
  lines: DigestAssetLine[];
  conflicts: DigestAssetConflict[];
  refused: DigestAssetRefusal[];
};

/** Project the leg onto the subset the digest covers. */
export function digestAssetLeg(leg: DepreciationLeg): DigestAssetLeg {
  // B-65 (brief 74) — `leg.disposals` is deliberately NOT part of the digest. The digest is a content
  // address over „the effective inputs the arithmetic consumed”, and the pct. 27 disposal figure is
  // reported but never posted, so it feeds no number here. Folding it in would let a purely
  // informational field move a pinned digest, and would read as though the estimate had deducted it.
  return {
    fiscalYear: leg.fiscalYear,
    total: leg.total,
    lines: leg.lines
      .map((l): DigestAssetLine => ({
        assetId: l.assetId,
        months: l.months,
        uncapped: l.uncapped,
        deductible: l.deductible,
        lost: l.lost,
        branch: l.branch,
      }))
      .sort((a, b) => (a.assetId < b.assetId ? -1 : a.assetId > b.assetId ? 1 : 0)),
    conflicts: leg.conflicts
      .map((c): DigestAssetConflict => ({
        assetId: c.assetId,
        expenseIds: [...c.expenseIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
        withheld: c.withheld,
      }))
      .sort((a, b) => (a.assetId < b.assetId ? -1 : a.assetId > b.assetId ? 1 : 0)),
    refused: leg.refused
      .map((r): DigestAssetRefusal => ({ assetId: r.assetId, gap: r.gap }))
      .sort((a, b) => (a.assetId < b.assetId ? -1 : a.assetId > b.assetId ? 1 : 0)),
  };
}

/**
 * A leg is a set over its own lists: the same `assetId` twice in one list makes the digest ambiguous,
 * because the order of the two would then decide the bytes. Refuse rather than hash something
 * order-dependent — the same guard `canonicalRuleSet` raises for a duplicated `ruleId`.
 */
export class DuplicateAssetIdError extends Error {
  constructor(readonly list: 'lines' | 'conflicts' | 'refused', readonly assetId: string) {
    super(`Asset register carries '${assetId}' more than once in ${list}; the register must be a set.`);
    this.name = 'DuplicateAssetIdError';
  }
}

/** The canonical string a digest is taken of. Exported so a test can assert the bytes, not just the hash. */
export function canonicalAssetLeg(leg: DepreciationLeg): string {
  const projected = digestAssetLeg(leg);
  for (const list of ['lines', 'conflicts', 'refused'] as const) {
    const seen = new Set<string>();
    for (const entry of projected[list]) {
      if (seen.has(entry.assetId)) throw new DuplicateAssetIdError(list, entry.assetId);
      seen.add(entry.assetId);
    }
  }
  return `${ASSET_REGISTER_SCHEME}|${canonicalize(projected)}`;
}

/**
 * SHA-256 hex of the canonical asset leg. Deterministic, and independent of construction path.
 *
 * An empty leg is a well-defined digest, not an absence: it says this number had no asset leg, which is a
 * named cause. Absence of the digest on a stored record means something else entirely — see
 * `TaxCalculationSnapshot.assetRegisterHash`.
 */
export function assetRegisterDigest(leg: DepreciationLeg): string {
  return sha256Hex(canonicalAssetLeg(leg));
}
