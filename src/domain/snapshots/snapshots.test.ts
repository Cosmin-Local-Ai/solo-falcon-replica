import { describe, it, expect } from 'vitest';
import type { PfaProfile } from '../models';
import type { RuleRelease } from '../fiscal/rules';
import { canonicalize } from './serialize';
import { computeInputsHash } from './hash';
import { createCalculationSnapshot } from './snapshot';

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
  pensionStatus: 'nu',
  otherIncome: [],
  socialInsuranceStatus: 'obligatoriu',
  vatExempt: true,
  cashFloorLei: 0,
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
    const input = { profile, revenues: 1000, expenses: 400 };
    const h1 = await computeInputsHash(input);
    const h2 = await computeInputsHash(input);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is independent of key declaration order', async () => {
    const inputA = { profile, revenues: 1000, expenses: 400 };
    const inputB = { expenses: 400, profile, revenues: 1000 };
    expect(await computeInputsHash(inputA)).toBe(await computeInputsHash(inputB));
  });

  it('is sensitive to input changes', async () => {
    const h1 = await computeInputsHash({ profile, revenues: 1000, expenses: 400 });
    const h2 = await computeInputsHash({ profile, revenues: 1001, expenses: 400 });
    expect(h1).not.toBe(h2);
  });
});

describe('createCalculationSnapshot', () => {
  it('builds a snapshot with all 9 fields, default status, and a tax-year-prefixed id', async () => {
    const snap = await createCalculationSnapshot({
      profile,
      revenues: 1000,
      expenses: 400,
      ruleRelease: release2025,
      calculationLines: [{ label: 'Venit net imposable', value: 600 }],
      output: { total: 600 },
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
      revenues: 1000,
      expenses: 400,
      ruleRelease: release2025,
      calculationLines: [],
      output: { total: 0 },
    });
    expect(await computeInputsHash(snap.inputSnapshot)).toBe(snap.inputsHash);
  });

  it('produces equal inputsHash for identical inputs (calculationId may differ)', async () => {
    const a = await createCalculationSnapshot({
      profile,
      revenues: 1000,
      expenses: 400,
      ruleRelease: release2025,
      calculationLines: [],
      output: { total: 0 },
    });
    const b = await createCalculationSnapshot({
      profile,
      revenues: 1000,
      expenses: 400,
      ruleRelease: release2025,
      calculationLines: [],
      output: { total: 0 },
    });
    expect(a.inputsHash).toBe(b.inputsHash);
  });

  it('keeps old snapshots intact when a new release is created', async () => {
    const snapA = await createCalculationSnapshot({
      profile,
      revenues: 1000,
      expenses: 400,
      ruleRelease: release2025,
      calculationLines: [],
      output: { total: 0 },
    });
    const copyA = structuredClone(snapA);
    await createCalculationSnapshot({
      profile,
      revenues: 2000,
      expenses: 800,
      ruleRelease: release2026,
      calculationLines: [],
      output: { total: 0 },
    });
    expect(snapA).toEqual(copyA);
    expect(snapA.status).toBe('computed');
  });

  it('respects an explicit status', async () => {
    const snap = await createCalculationSnapshot({
      profile,
      revenues: 1000,
      expenses: 400,
      ruleRelease: release2025,
      calculationLines: [],
      output: { total: 0 },
      status: 'superseded',
    });
    expect(snap.status).toBe('superseded');
  });
});

// --- Step 12 gap coverage ---------------------------------------------------

describe('computeInputsHash — equivalent inputs → same hash', () => {
  it('same hash for structurally-equal inputs with reordered top-level keys', async () => {
    const a = { profile, revenues: 1000, expenses: 400 };
    const b = { expenses: 400, revenues: 1000, profile };
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
      pensionStatus: profile.pensionStatus,
      otherIncome: profile.otherIncome,
      socialInsuranceStatus: profile.socialInsuranceStatus,
      vatExempt: profile.vatExempt,
      cashFloorLei: profile.cashFloorLei,
      updatedAt: profile.updatedAt,
    };
    const a = { profile, revenues: 1000, expenses: 400 };
    const b = { profile: profileShuffled, revenues: 1000, expenses: 400 };
    expect(await computeInputsHash(a)).toBe(await computeInputsHash(b));
  });

  it('same hash for equivalent numeric values', async () => {
    const a = { profile, revenues: 1000, expenses: 400 };
    const b = { profile, revenues: 1e3, expenses: 4e2 };
    expect(await computeInputsHash(a)).toBe(await computeInputsHash(b));
  });
});

describe('computeInputsHash — changed inputs → different hash (per dimension)', () => {
  it('different hash when expenses change', async () => {
    const a = { profile, revenues: 1000, expenses: 400 };
    const b = { profile, revenues: 1000, expenses: 401 };
    expect(await computeInputsHash(a)).not.toBe(await computeInputsHash(b));
  });

  it('different hash when a top-level profile field changes', async () => {
    const a = { profile, revenues: 1000, expenses: 400 };
    const b = { profile: { ...profile, caen: '6202' }, revenues: 1000, expenses: 400 };
    expect(await computeInputsHash(a)).not.toBe(await computeInputsHash(b));
  });

  it('different hash when a nested identity field changes', async () => {
    const a = { profile, revenues: 1000, expenses: 400 };
    const b = {
      profile: { ...profile, identity: { ...profile.identity, cnp: '9999999999999' } },
      revenues: 1000,
      expenses: 400,
    };
    expect(await computeInputsHash(a)).not.toBe(await computeInputsHash(b));
  });
});

describe('createCalculationSnapshot — rule-release identity preservation', () => {
  it('embeds the exact RuleRelease; a later release (same taxYear, different releaseId) does not alter the stored snapshot', async () => {
    const snap = await createCalculationSnapshot({
      profile,
      revenues: 1000,
      expenses: 400,
      ruleRelease: release2025,
      calculationLines: [{ label: 'Venit net imposable', value: 600 }],
      output: { total: 600 },
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
      revenues: 1000,
      expenses: 400,
      ruleRelease: laterRelease,
      calculationLines: [],
      output: { total: 0 },
    });

    // The stored snapshot is untouched and still carries the original release identity.
    expect(snap).toEqual(frozen);
    expect(snap.ruleRelease.releaseId).toBe('rel-2025-001');
    expect(snap.ruleRelease.ruleIds).toEqual(['rule-2025-1']);
    // The stored inputsHash is still reproducible from the embedded inputs.
    expect(await computeInputsHash(snap.inputSnapshot)).toBe(snap.inputsHash);
  });
});
