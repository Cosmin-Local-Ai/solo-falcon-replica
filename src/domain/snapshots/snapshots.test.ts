import { describe, it, expect } from 'vitest';
import type { PfaProfile } from '../models';
import type { FiscalRule, RuleRelease } from '../fiscal/rules';
import { ruleSetDigest } from '../fiscal/ruleSetDigest';
import { canonicalize } from './serialize';
import { computeInputsHash } from './hash';
import { createCalculationSnapshot } from './snapshot';
import { lei } from '../money';

// --- Fixtures -------------------------------------------------------------

const identity = {
  nume: 'Ion Popescu',
  cnp: '0123456789012',
  adresa: 'Str. Test 1, Bucuresti',
  telefon: '0700000000',
  email: 'ion@example.com',
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
  vatExempt: true,
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
  it('builds a snapshot with all 10 fields, default status, and a tax-year-prefixed id', async () => {
    const snap = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
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
      calculationLines: [],
      output: { total: lei(0) },
    });
    const b = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: rules2025,
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
      vatExempt: profile.vatExempt,
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
      calculationLines: [],
      output: { total: lei(0) },
    });
    const b = await createCalculationSnapshot({
      profile,
      revenues: lei(1000),
      expenses: lei(400),
      ruleRelease: release2025,
      rules: revisedRules,
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
      calculationLines: [],
      output: { total: lei(0) },
    });
    expect(Object.keys(snap.inputSnapshot).sort()).toEqual(['expenses', 'profile', 'revenues']);
    expect(snap.inputsHash).toBe(before);
  });
});
