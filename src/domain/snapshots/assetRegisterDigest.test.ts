/**
 * B-109 — the asset-register digest.
 *
 * These tests are the digest's contract: it moves for every change that could move the number, it does not
 * move for a change that cannot, and it is independent of the order the leg happened to be built in. The
 * shape mirrors `../fiscal/ruleSetDigest.test.ts`, because it is the same kind of object: a content address
 * over the effective inputs the arithmetic consumed.
 */
import { describe, expect, it } from 'vitest';
import type { DepreciationLeg } from '../estimateBasis';
import {
  ASSET_REGISTER_SCHEME,
  DuplicateAssetIdError,
  assetRegisterDigest,
  canonicalAssetLeg,
  digestAssetLeg,
} from './assetRegisterDigest';
import { lei } from '../money';

const base: DepreciationLeg = {
  fiscalYear: 2026,
  lines: [
    { assetId: 'asset-b', label: 'Utilaj B', months: 10, uncapped: lei(30000), deductible: lei(30000), lost: lei(0), branch: 'degresiv_anuali' },
    { assetId: 'asset-a', label: 'Laptop A', months: 12, uncapped: lei(6000), deductible: lei(6000), lost: lei(0), branch: 'liniar' },
  ],
  conflicts: [],
  refused: [],
  total: lei(36000),
};

const empty: DepreciationLeg = { fiscalYear: 2026, lines: [], conflicts: [], refused: [], total: lei(0) };

describe('assetRegisterDigest — determinism', () => {
  it('is a 64-char lowercase hex digest', () => {
    expect(assetRegisterDigest(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable across repeated calls', () => {
    expect(assetRegisterDigest(base)).toBe(assetRegisterDigest(base));
  });

  it('does not depend on the order the lines were built in', () => {
    const reversed: DepreciationLeg = { ...base, lines: [...base.lines].reverse() };
    expect(assetRegisterDigest(reversed)).toBe(assetRegisterDigest(base));
  });

  it('does not depend on key declaration order', () => {
    const rebuilt: DepreciationLeg = {
      total: base.total,
      refused: base.refused,
      conflicts: base.conflicts,
      lines: base.lines.map((l) => ({
        branch: l.branch,
        lost: l.lost,
        deductible: l.deductible,
        uncapped: l.uncapped,
        months: l.months,
        label: l.label,
        assetId: l.assetId,
      })),
      fiscalYear: base.fiscalYear,
    };
    expect(assetRegisterDigest(rebuilt)).toBe(assetRegisterDigest(base));
  });

  it('mixes the scheme tag into the hashed bytes', () => {
    expect(canonicalAssetLeg(base).startsWith(`${ASSET_REGISTER_SCHEME}|`)).toBe(true);
  });

  it('an empty register is a digest, not an absence', () => {
    expect(assetRegisterDigest(empty)).toMatch(/^[0-9a-f]{64}$/);
    expect(assetRegisterDigest(empty)).not.toBe(assetRegisterDigest(base));
  });
});

describe('assetRegisterDigest — it moves when the register moves', () => {
  it('a posted deductible amount moves it', () => {
    const moved: DepreciationLeg = {
      ...base,
      lines: base.lines.map((l) => (l.assetId === 'asset-a' ? { ...l, deductible: lei(6001) } : l)),
    };
    expect(assetRegisterDigest(moved)).not.toBe(assetRegisterDigest(base));
  });

  it('the ceiling biting moves it, even when the posted figure does not change', () => {
    // Same `deductible`, different `uncapped` and `lost`: the record has to be able to tell a schedule that
    // never met art. 28 alin. (14) from one that met it and was cut.
    const capped: DepreciationLeg = {
      ...base,
      lines: base.lines.map((l) =>
        l.assetId === 'asset-a' ? { ...l, uncapped: lei(9000), lost: lei(3000) } : l,
      ),
    };
    expect(assetRegisterDigest(capped)).not.toBe(assetRegisterDigest(base));
  });

  it('the months the schedule ran for move it', () => {
    const moved: DepreciationLeg = {
      ...base,
      lines: base.lines.map((l) => (l.assetId === 'asset-a' ? { ...l, months: 11 } : l)),
    };
    expect(assetRegisterDigest(moved)).not.toBe(assetRegisterDigest(base));
  });

  it('which art. 28 branch produced the figure moves it', () => {
    const moved: DepreciationLeg = {
      ...base,
      lines: base.lines.map((l) => (l.assetId === 'asset-a' ? { ...l, branch: 'valoare_intreaga' } : l)),
    };
    expect(assetRegisterDigest(moved)).not.toBe(assetRegisterDigest(base));
  });

  it('a second asset with the same total moves it — the total is not the whole story', () => {
    const split: DepreciationLeg = {
      fiscalYear: 2026,
      lines: [
        { assetId: 'asset-a1', label: 'A1', months: 12, uncapped: lei(18000), deductible: lei(18000), lost: lei(0), branch: 'liniar' },
        { assetId: 'asset-a2', label: 'A2', months: 12, uncapped: lei(18000), deductible: lei(18000), lost: lei(0), branch: 'liniar' },
      ],
      conflicts: [],
      refused: [],
      total: lei(36000),
    };
    expect(assetRegisterDigest(split)).not.toBe(assetRegisterDigest(base));
  });

  it('the fiscal year moves it', () => {
    expect(assetRegisterDigest({ ...base, fiscalYear: 2027 })).not.toBe(assetRegisterDigest(base));
  });

  it('a withheld schedule moves it: a figure kept OUT of the number is still a fact about the number', () => {
    const conflicted: DepreciationLeg = {
      fiscalYear: base.fiscalYear,
      lines: [],
      conflicts: [{ assetId: 'asset-a', label: 'Laptop A', expenseIds: ['exp-2', 'exp-1'], withheld: lei(6000) }],
      refused: base.refused,
      total: lei(0),
    };
    expect(assetRegisterDigest(conflicted)).not.toBe(assetRegisterDigest(empty));
    // The expense ids are sorted, so the collision is addressed independently of the order they were found in.
    const reordered: DepreciationLeg = {
      ...conflicted,
      conflicts: [{ ...conflicted.conflicts[0], expenseIds: ['exp-1', 'exp-2'] }],
    };
    expect(assetRegisterDigest(reordered)).toBe(assetRegisterDigest(conflicted));
  });

  it('an asset that refused for a missing fact moves it', () => {
    const refused: DepreciationLeg = {
      ...empty,
      refused: [{ assetId: 'asset-x', label: 'Utilaj fără durată', gap: 'durata_lipsa', reason: '…' }],
    };
    expect(assetRegisterDigest(refused)).not.toBe(assetRegisterDigest(empty));
  });
});

describe('assetRegisterDigest — what it deliberately ignores', () => {
  it('renaming an asset does not move it: a label is not arithmetic', () => {
    const renamed: DepreciationLeg = {
      ...base,
      lines: base.lines.map((l) => ({ ...l, label: 'Nume nou, complet diferit' })),
    };
    expect(assetRegisterDigest(renamed)).toBe(assetRegisterDigest(base));
  });

  it('rewording a refusal does not move it: the `gap` code is what the app branches on', () => {
    const refused: DepreciationLeg = {
      ...empty,
      refused: [{ assetId: 'asset-x', label: 'X', gap: 'durata_lipsa', reason: 'altă propoziție, aceeași lipsă' }],
    };
    const same: DepreciationLeg = {
      ...empty,
      refused: [{ assetId: 'asset-x', label: 'X', gap: 'durata_lipsa', reason: 'propoziție corectată' }],
    };
    expect(assetRegisterDigest(same)).toBe(assetRegisterDigest(refused));
  });
});

describe('assetRegisterDigest — the projection, and the set guard', () => {
  it('projects the leg onto the documented subset, with no label and no refusal prose', () => {
    const projected = digestAssetLeg({
      ...empty,
      lines: [{ assetId: 'a', label: 'Nume', months: 1, uncapped: lei(1), deductible: lei(1), lost: lei(0), branch: 'liniar' }],
      refused: [{ assetId: 'b', label: 'Nume', gap: 'durata_lipsa', reason: 'o propoziție' }],
    });
    expect(projected.lines[0]).toEqual({ assetId: 'a', months: 1, uncapped: lei(1), deductible: lei(1), lost: lei(0), branch: 'liniar' });
    expect(projected.refused[0]).toEqual({ assetId: 'b', gap: 'durata_lipsa' });
    expect(JSON.stringify(projected)).not.toContain('Nume');
    expect(JSON.stringify(projected)).not.toContain('o propoziție');
  });

  it('refuses a leg that carries the same asset twice in one list', () => {
    const duplicated: DepreciationLeg = {
      ...empty,
      lines: [
        { assetId: 'a', label: 'A', months: 1, uncapped: lei(1), deductible: lei(1), lost: lei(0), branch: 'liniar' },
        { assetId: 'a', label: 'A again', months: 2, uncapped: lei(2), deductible: lei(2), lost: lei(0), branch: 'liniar' },
      ],
    };
    expect(() => assetRegisterDigest(duplicated)).toThrow(DuplicateAssetIdError);
  });

  it('pins the bytes, not just the hash, so a projection change cannot pass unnoticed', () => {
    expect(canonicalAssetLeg(empty)).toBe(
      `${ASSET_REGISTER_SCHEME}|{"conflicts":[],"fiscalYear":2026,"lines":[],"refused":[],"total":0}`,
    );
  });

  it('pins the digest of the empty leg as a scheme-drift guard', () => {
    // Not a regression guard — there is no pre-change value for a scheme introduced by this change, and a
    // literal generated in the same commit that validates it would prove nothing about `inputsHash`. What
    // this does catch is a later edit to the projection or the tag: if the bytes move, this moves, and the
    // author has to say so rather than re-pin silently.
    expect(assetRegisterDigest(empty)).toBe(
      '8f31fbe721e377fcce1fc4671f115f61d4646c6cb21d5e3b76ca825c1ede896c',
    );
  });
});
