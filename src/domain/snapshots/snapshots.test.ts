import { describe, it, expect } from 'vitest';
import type { PfaProfile } from '../models';
import type { FiscalRule, RuleRelease } from '../fiscal/rules';
import { ruleSetDigest } from '../fiscal/ruleSetDigest';
import { canonicalize } from './serialize';
import { computeInputsHash } from './hash';
import { computeInputsHashSync } from './hashSync';
import { assetRegisterDigest } from './assetRegisterDigest';
import { createCalculationSnapshot } from './snapshot';
import type { DepreciationLeg } from '../estimateBasis';
import { lei } from '../money';

// --- Fixtures -------------------------------------------------------------

const identity = {
  nume: 'Enache Sorin',
  cnp: '0123456789012',
  adresa: 'Str. Test 1, Bucuresti',
  telefon: '0700000000',
  email: 'sorin@example.com',
  denumire: '',
  cui: '',
  formaJuridica: 'PFA',
  numarRegComert: '',
  adresaSocietate: '',
  telefonSocietate: '',
  emailSocietate: '',
  contBancar: '',
  banca: '',
};

const profile: PfaProfile = {
  id: 'pfa-test',
  pfaStartYear: 2020,
  fiscalYear: 2025,
  regime: 'impozit_pe_venit',
  caen: '6201',
  salaryStatus: 'nu',
  pensionerStatus: 'nu',
  socialInsuranceStatus: 'obligatoriu',
  vatRegistration: { status: 'scutit_art310' as const },
  cashFloorLei: lei(0),
  identity,
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const release2025: RuleRelease = {
  releaseId: 'rel-2025-001',
  name: 'PFA 2025 rules',
  jurisdiction: 'RO',
  entityType: 'PFA',
  taxYear: 2025,
  ruleIds: ['rule-2025-1'],
  status: 'SAFE_ACTIVATION',
  effectiveFrom: '2025-01-01',
  createdAt: '2025-01-01T00:00:00.000Z',
  evidence: ['https://example.com/legis-2025'],
};

const release2026: RuleRelease = {
  releaseId: 'rel-2026-001',
  name: 'PFA 2026 rules',
  jurisdiction: 'RO',
  entityType: 'PFA',
  taxYear: 2026,
  ruleIds: ['rule-2026-1'],
  status: 'SAFE_ACTIVATION',
  effectiveFrom: '2026-01-01',
  createdAt: '2026-01-01T00:00:00.000Z',
  evidence: ['https://example.com/legis-2026'],
};

// TASK 6: a snapshot now records the digest of the rules it applied, so the fixtures need real rules.
// These are the rule set `release2025` names — one CAS rule at 25 %.
const rule2025: FiscalRule = {
  ruleId: 'rule-2025-1',
  name: 'CAS 2025',
  jurisdiction: 'RO',
  entityType: 'PFA',
  taxRegime: 'cas',
  taxYear: 2025,
  effectiveFrom: '2025-01-01',
  effectiveTo: null,
  parameters: [{ id: 'rate', label: 'Rata', value: 25, unit: 'percent' }],
  calculatorId: 'calc-cas',
  sourceAct: 'Cod fiscal (fixture)',
  sourceArticle: 'art. 148 alin. (2) (fixture)',
  sourceUrl: 'https://example.com/legis-2025',
  verifiedAt: '2025-01-01',
  status: 'ACTIVE',
  version: 1,
};
const rules2025: FiscalRule[] = [rule2025];
const rules2026: FiscalRule[] = [{ ...rule2025, ruleId: 'rule-2026-1', taxYear: 2026 }];

/*
 * B-109 — the asset leg the calculation consumed.
 *
 * A leg, not a `FixedAsset` list: `assetRegisterHash` addresses the register as `estimateBasis.ts`
 * `selectAssetDepreciation` filtered it for the year — the same judgement that makes `rules` the EFFECTIVE
 * rule set rather than the whole package. Hand-building one here is what the assembler produces, field for
 * field; `depreciation.ts` is not re-run in these tests.
 */
const leg: DepreciationLeg = {
  fiscalYear: 2025,
  lines: [
    {
      assetId: 'asset-laptop',
      label: 'Laptop',
      months: 12,
      uncapped: lei(6000),
      deductible: lei(6000),
      lost: lei(0),
      branch: 'liniar',
    },
  ],
  conflicts: [],
  refused: [],
  disposals: [],
  danglingLinks: [],
  total: lei(6000),
};

const emptyLeg: DepreciationLeg = { fiscalYear: 2025, lines: [], conflicts: [], refused: [], disposals: [], danglingLinks: [], total: lei(0) };

// --- Tests ------------------------------------------------------------------

describe('canonicalize', () => {
  it('is independent of object key order', () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
  });

  it('is stable for nested objects containing arrays of objects with shuffled key order', () => {
    const original = {
      outer: 'x',
      list: [
        { id: 1, name: 'a', meta: { k: true, v: 3 } },
        { id: 2, name: 'b', meta: { k: false, v: 1 } },
      ],
      count: 2,
    };
    const shuffled = {
      count: 2,
      list: [
        { name: 'a', meta: { v: 3, k: true }, id: 1 },
        { meta: { k: false, v: 1 }, id: 2, name: 'b' },
      ],
      outer: 'x',
    };
    expect(canonicalize(original)).toBe(canonicalize(shuffled));
  });

  it('is sensitive to value changes', () => {
    expect(canonicalize({ a: 1 })).not.toBe(canonicalize({ a: 2 }));
    expect(canonicalize({ a: 1 })).not.toBe(canonicalize({ a: 1, b: 0 }));
  });
});

describe('computeInputsHash', () => {
  it('is deterministic and produces a 64-char lowercase hex string', async () => {
    const input = { profile, revenues: lei(1000), expenses: lei(400) };
    const h1 = await computeInputsHash(input);
    const h2 = await computeInputsHash(input);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is independent of key declaration order', async () => {
    const inputA = { profile, revenues: lei(1000), expenses: lei(400) };
    const inputB = { expenses: lei(400), profile, revenues: lei(1000) };
    expect(await computeInputsHash(inputA)).toBe(await computeInputsHash(inputB));
  });

  it('is sensitive to input changes', async () => {
    const h1 = await computeInputsHash({ profile, revenues: lei(1000), expenses: lei(400) });
    const h2 = await computeInputsHash({ profile, revenues: lei(1001), expenses: lei(400) });
    expect(h1).not.toBe(h2);
  });
});

describe('createCalculationSnapshot', () => {
  it('builds a snapshot with all 11 fields, default status, and a tax-year-prefixed id', async () => {
    const snap = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
      depreciation: leg,
      calculationLines: [{ label: 'Venit net imposable', value: lei(600) }],
      output: { total: lei(600) },
    });
    expect(Object.keys(snap).sort()).toEqual(
      [
        'calculationId',
        'calculatedAt',
        'calculationLines',
        'inputSnapshot',
        'inputsHash',
        'assetRegisterHash',
        'output',
        'ruleRelease',
        'ruleSetHash',
        'status',
        'taxYear',
      ].sort()
    );
    expect(snap.taxYear).toBe(release2025.taxYear);
    expect(snap.status).toBe('computed');
    expect(snap.calculationId).toMatch(/^calc-2025-/);
  });

  it('stores an inputsHash that is reproducible from the stored inputSnapshot', async () => {
    const snap = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
      depreciation: leg,
      calculationLines: [],
      output: { total: lei(0) },
    });
    expect(await computeInputsHash(snap.inputSnapshot)).toBe(snap.inputsHash);
  });

  it('produces equal inputsHash for identical inputs (calculationId may differ)', async () => {
    const a = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
      depreciation: leg,
      calculationLines: [],
      output: { total: lei(0) },
    });
    const b = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
      depreciation: leg,
      calculationLines: [],
      output: { total: lei(0) },
    });
    expect(a.inputsHash).toBe(b.inputsHash);
  });

  it('keeps old snapshots intact when a new release is created', async () => {
    const snapA = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
      depreciation: leg,
      calculationLines: [],
      output: { total: lei(0) },
    });
    const copyA = structuredClone(snapA);
    await createCalculationSnapshot({
      profile,
      revenues: lei(2000),
      expenses: lei(800),
      ruleRelease: release2026,
      rules: rules2026,
      depreciation: leg,
      calculationLines: [],
      output: { total: lei(0) },
    });
    expect(snapA).toEqual(copyA);
    expect(snapA.status).toBe('computed');
  });

  it('respects an explicit status', async () => {
    const snap = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
      depreciation: leg,
      calculationLines: [],
      output: { total: lei(0) },
      status: 'superseded',
    });
    expect(snap.status).toBe('superseded');
  });
});

// --- Step 12 gap coverage ---------------------------------------------------

describe('computeInputsHash — equivalent inputs → same hash', () => {
  it('same hash for structurally-equal inputs with reordered top-level keys', async () => {
    const a = { profile, revenues: lei(1000), expenses: lei(400) };
    const b = { expenses: lei(400), revenues: lei(1000), profile };
    expect(await computeInputsHash(a)).toBe(await computeInputsHash(b));
  });

  it('same hash for reordered nested profile/identity fields', async () => {
    const profileShuffled: PfaProfile = {
      identity: {
        email: identity.email,
        nume: identity.nume,
        cnp: identity.cnp,
        adresa: identity.adresa,
        telefon: identity.telefon,
        denumire: identity.denumire,
        cui: identity.cui,
        formaJuridica: identity.formaJuridica,
        numarRegComert: identity.numarRegComert,
        adresaSocietate: identity.adresaSocietate,
        telefonSocietate: identity.telefonSocietate,
        emailSocietate: identity.emailSocietate,
        contBancar: identity.contBancar,
        banca: identity.banca,
      },
      id: profile.id,
      pfaStartYear: profile.pfaStartYear,
      fiscalYear: profile.fiscalYear,
      regime: profile.regime,
      caen: profile.caen,
      salaryStatus: profile.salaryStatus,
      pensionerStatus: profile.pensionerStatus,
      socialInsuranceStatus: profile.socialInsuranceStatus,
      // PG-6f — the registration state is a rule-selecting input in place of the retired boolean, so a
      // reordering of the profile must not change the digest while a change of state must.
      vatRegistration: profile.vatRegistration ?? undefined,
      cashFloorLei: profile.cashFloorLei,
      updatedAt: profile.updatedAt,
    };
    const a = { profile, revenues: lei(1000), expenses: lei(400) };
    const b = { profile: profileShuffled, revenues: lei(1000), expenses: lei(400) };
    expect(await computeInputsHash(a)).toBe(await computeInputsHash(b));
  });

  it('same hash for equivalent numeric values', async () => {
    const a = { profile, revenues: lei(1000), expenses: lei(400) };
    const b = { profile, revenues: lei(1e3), expenses: lei(4e2) };
    expect(await computeInputsHash(a)).toBe(await computeInputsHash(b));
  });
});

describe('computeInputsHash — changed inputs → different hash (per dimension)', () => {
  it('different hash when expenses change', async () => {
    const a = { profile, revenues: lei(1000), expenses: lei(400) };
    const b = { profile, revenues: lei(1000), expenses: lei(401) };
    expect(await computeInputsHash(a)).not.toBe(await computeInputsHash(b));
  });

  it('different hash when a top-level profile field changes', async () => {
    const a = { profile, revenues: lei(1000), expenses: lei(400) };
    const b = { profile: { ...profile, caen: '6202' }, revenues: lei(1000), expenses: lei(400) };
    expect(await computeInputsHash(a)).not.toBe(await computeInputsHash(b));
  });

  it('different hash when a nested identity field changes', async () => {
    const a = { profile, revenues: lei(1000), expenses: lei(400) };
    const b = {
      profile: { ...profile, identity: { ...profile.identity, cnp: '9999999999999' } },
      revenues: lei(1000),
      expenses: lei(400),
    };
    expect(await computeInputsHash(a)).not.toBe(await computeInputsHash(b));
  });
});

describe('createCalculationSnapshot — rule-release identity preservation', () => {
  it('embeds the exact RuleRelease; a later release (same taxYear, different releaseId) does not alter the stored snapshot', async () => {
    const snap = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
      depreciation: leg,
      calculationLines: [{ label: 'Venit net imposable', value: lei(600) }],
      output: { total: lei(600) },
    });
    const frozen = structuredClone(snap);

    // A later release for the SAME tax year but a different releaseId/ruleIds.
    const laterRelease: RuleRelease = {
      ...release2025,
      releaseId: 'rel-2025-002',
      ruleIds: ['rule-2025-2'],
    };
    await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: laterRelease,
      rules: rules2025,
      depreciation: leg,
      calculationLines: [],
      output: { total: lei(0) },
    });

    // The stored snapshot is untouched and still carries the original release identity.
    expect(snap).toEqual(frozen);
    expect(snap.ruleRelease.releaseId).toBe('rel-2025-001');
    expect(snap.ruleRelease.ruleIds).toEqual(['rule-2025-1']);
    // The stored inputsHash is still reproducible from the embedded inputs.
    expect(await computeInputsHash(snap.inputSnapshot)).toBe(snap.inputsHash);
  });
});

/*
 * TASK 6 — the snapshot records the arithmetic, not only the inputs.
 *
 * The defect in one line: two snapshots could carry the same `releaseId` and the same `inputsHash` while
 * the rules behind them differed, because the CAS / CASS / income-tax corrections changed formula-bearing
 * parameters under an unchanged release identity. These tests pin the two halves of the fix and the
 * boundary between them.
 */
describe('createCalculationSnapshot — ruleSetHash', () => {
  it('records a 64-char hex digest of the rules that were applied', async () => {
    const snap = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
      depreciation: leg,
      calculationLines: [],
      output: { total: lei(0) },
    });
    expect(snap.ruleSetHash).toMatch(/^[0-9a-f]{64}$/);
    expect(snap.ruleSetHash).toBe(ruleSetDigest(rules2025));
  });

  it('same inputs through different arithmetic is now a visible difference', async () => {
    // The rule set R2: identical except one formula-bearing parameter, CAS rate 25 -> 26.
    const revisedRules: FiscalRule[] = [
      {
        ...rule2025,
        version: 2,
        parameters: [{ id: 'rate', label: 'Rata', value: 26, unit: 'percent' }],
      },
    ];
    const a = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
      depreciation: leg,
      calculationLines: [],
      output: { total: lei(0) },
    });
    const b = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: revisedRules,
      depreciation: leg,
      calculationLines: [],
      output: { total: lei(0) },
    });
    // Identical inputs — this is the half that used to be indistinguishable.
    expect(b.inputsHash).toBe(a.inputsHash);
    // Different rules — and now distinguishable.
    expect(b.ruleSetHash).not.toBe(a.ruleSetHash);
  });

  it('the rule digest lives BESIDE inputSnapshot, never inside it: changing a rule moves no inputsHash', async () => {
    // TASK 3 pinned `inputSnapshot` as the enumerated subset { profile, revenues, expenses }. Putting the
    // rule digest inside it would have moved every stored digest — which is why `ruleSetHash` is a
    // sibling field on the calculation record instead. This test is the guard against re-deciding that.
    const before = await computeInputsHash({ profile, revenues: lei(1000), expenses: lei(400) });
    const snap = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: [{ ...rule2025, parameters: [{ id: 'rate', label: 'Rata', value: 26, unit: 'percent' }] }],
      depreciation: leg,
      calculationLines: [],
      output: { total: lei(0) },
    });
    expect(Object.keys(snap.inputSnapshot).sort()).toEqual(['expenses', 'profile', 'revenues']);
    expect(snap.inputsHash).toBe(before);
  });
});

/*
 * B-109 — the digest that must NOT move, and the digest that had to be added.
 *
 * The values below are genuine pre-change values. They were captured from the tree at commit `72b50c5`,
 * before any B-109 edit existed, by a throwaway probe that called the PRE-CHANGE `createCalculationSnapshot`
 * with exactly this fixture and printed what came out; the probe is recorded in commit `4bb68d3` and was
 * deleted by this change. That provenance is the whole point: a digest assertion generated in the same
 * commit it validates proves nothing, and this step exists to remove exactly that circularity. If the
 * fixture below is edited, the pinned value will move and the edit has to say so — it is not a value to be
 * re-baselined.
 */
describe('inputsHash — pinned PRE-CHANGE digest (B-109)', () => {
  const PRE_CHANGE_INPUTS_HASH = '88215ab2b0aa3b03fd87f17225234f24458a494768da0b66ecb4f433a27b7b0a';
  const PRE_CHANGE_RULE_SET_HASH = 'df6ec4fcf54864070ff7e1f264f15e41046ffd68cd6742770e75d935a2892724';

  it('is byte-identical to what the pre-change code produced for the same { profile, revenues, expenses }', async () => {
    const snap = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
      depreciation: leg,
      calculationLines: [],
      output: { total: lei(0) },
    });
    expect(snap.inputsHash).toBe(PRE_CHANGE_INPUTS_HASH);
    // The digest is reproducible from the stored subset by both implementations, exactly as before.
    expect(await computeInputsHash(snap.inputSnapshot)).toBe(PRE_CHANGE_INPUTS_HASH);
    expect(computeInputsHashSync({ profile, revenues: lei(1000), expenses: lei(400) })).toBe(
      PRE_CHANGE_INPUTS_HASH,
    );
    // TASK 6's sibling digest did not move either: adding a third sibling changed no existing byte.
    expect(snap.ruleSetHash).toBe(PRE_CHANGE_RULE_SET_HASH);
  });

  it('inputSnapshot is still exactly the three pinned keys, and the new digest is not among them', async () => {
    const snap = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
      depreciation: leg,
      calculationLines: [],
      output: { total: lei(0) },
    });
    expect(Object.keys(snap.inputSnapshot).sort()).toEqual(['expenses', 'profile', 'revenues']);
    expect(JSON.stringify(snap.inputSnapshot)).not.toContain('assetRegisterHash');
    expect(snap.assetRegisterHash).toBeDefined();
  });
});

/*
 * B-109 — the register is now addressable.
 *
 * The defect in one line: since B-93 the engine consumes a depreciation leg derived from the asset register,
 * but `inputSnapshot` is still `{ profile, revenues, expenses }`, where the last two are aggregate bani
 * totals. Two registers that add up to the same total therefore produced records that were byte-identical
 * in every field that could explain them. These tests make that state unforgivable.
 */
describe('createCalculationSnapshot — assetRegisterHash', () => {
  it('records a 64-char hex digest of the asset leg the number was built from', async () => {
    const snap = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
      depreciation: leg,
      calculationLines: [],
      output: { total: lei(0) },
    });
    expect(snap.assetRegisterHash).toMatch(/^[0-9a-f]{64}$/);
    expect(snap.assetRegisterHash).toBe(assetRegisterDigest(leg));
  });

  it('two snapshots with identical inputsHash but different asset registers now differ in a named field', async () => {
    // Same year, same posted total (6.000 lei), different register: one asset, or two. Before B-109 these
    // two records were indistinguishable — the digest that exists to make a number explainable could not
    // name the difference, because the register was nowhere in it.
    const splitLeg: DepreciationLeg = {
      fiscalYear: 2025,
      lines: [
        { assetId: 'asset-laptop-a', label: 'Laptop A', months: 12, uncapped: lei(3000), deductible: lei(3000), lost: lei(0), branch: 'liniar' },
        { assetId: 'asset-laptop-b', label: 'Laptop B', months: 12, uncapped: lei(3000), deductible: lei(3000), lost: lei(0), branch: 'liniar' },
      ],
      conflicts: [],
      refused: [],
      disposals: [],
      danglingLinks: [],
      total: lei(6000),
    };
    const a = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
      depreciation: leg,
      calculationLines: [],
      output: { total: lei(0) },
    });
    const b = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
      depreciation: splitLeg,
      calculationLines: [],
      output: { total: lei(0) },
    });
    // Identical inputs — the half that used to be indistinguishable, and still is, correctly.
    expect(b.inputsHash).toBe(a.inputsHash);
    // Different register — and now distinguishable.
    expect(b.assetRegisterHash).not.toBe(a.assetRegisterHash);
  });

  it('the asset digest lives BESIDE inputSnapshot: moving the register moves no inputsHash', async () => {
    // The guard against "fixing" B-109 by widening the subset. Doing that would move every digest a real
    // user has stored, which is the landmine TASK 3 named and TASK 6 worked around the same way.
    const before = await computeInputsHash({ profile, revenues: lei(1000), expenses: lei(400) });
    const snap = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
      depreciation: { ...leg, total: lei(99999) },
      calculationLines: [],
      output: { total: lei(0) },
    });
    expect(snap.inputsHash).toBe(before);
    expect(snap.assetRegisterHash).not.toBe(assetRegisterDigest(leg));
  });

  it('an empty register is a digest, not a silence: the number can say it had no asset leg', async () => {
    const snap = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
      depreciation: emptyLeg,
      calculationLines: [],
      output: { total: lei(0) },
    });
    expect(snap.assetRegisterHash).toBe(assetRegisterDigest(emptyLeg));
    expect(snap.assetRegisterHash).not.toBeNull();
  });

  it('a call site with no leg in hand records null, never an empty-register digest', async () => {
    // `null` and the empty-leg digest are different claims, and conflating them would be the same mistake
    // in reverse: saying the register was consulted and found empty, when it was never consulted.
    const snap = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
      depreciation: null,
      calculationLines: [],
      output: { total: lei(0) },
    });
    expect(snap.assetRegisterHash).toBeNull();
    expect(snap.assetRegisterHash).not.toBe(assetRegisterDigest(emptyLeg));
    // And the pinned inputsHash is untouched by any of this.
    expect(snap.inputsHash).toBe('88215ab2b0aa3b03fd87f17225234f24458a494768da0b66ecb4f433a27b7b0a');
  });
});
