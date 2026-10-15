import { describe, expect, it, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { StoreProvider, useStore } from './store';
import type { TaxCalculationSnapshot } from '../domain/snapshots/types';
import { createCalculationSnapshot } from '../domain/snapshots/snapshot';
import { ruleSetDigest } from '../domain/fiscal/ruleSetDigest';
import type { DepreciationLeg } from '../domain/estimateBasis';
import { parseAppData } from './schema';
import { seedStorage } from '../test/storage';
import type { PfaProfile } from '../domain/models';
import type { FiscalRule, RuleRelease } from '../domain/fiscal/rules';
import { lei, type Bani } from '../domain/money';

const STORAGE_KEY = 'pfa-app-data-v2';

// B-109 — the asset leg the fixture calculation consumed, in the shape `estimateBasis.ts`
// `selectAssetDepreciation` hands to the engine. A leg rather than a `FixedAsset` list, because that is what
// `assetRegisterHash` addresses: the register as the year's arithmetic consumed it.
const legFixture: DepreciationLeg = {
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

// --- Fixtures ---------------------------------------------------------------

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

// TASK 6: a snapshot records the digest of the rules it applied, so the fixture carries real rules.
const rules2025: FiscalRule[] = [
  {
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
  },
];

// Captures the live store value so tests can drive it.
let storeRef: ReturnType<typeof useStore> | null = null;
function Probe() {
  storeRef = useStore();
  return null;
}

/** The seeded dataset as storage holds it, so a test can re-write it with one field overridden. */
function seededPayload(): Record<string, unknown> {
  seedStorage();
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<string, unknown>;
}

async function makeSnapshot(over: Partial<{ revenues: Bani; expenses: Bani }>): Promise<TaxCalculationSnapshot> {
  return createCalculationSnapshot({
    profile,
    revenues: over.revenues ?? lei(1000),
    expenses: over.expenses ?? lei(400),
    ruleRelease: release2025,
    rules: rules2025,
    // B-109: a real leg, so the digest this snapshot carries is a real digest — the save-path tests below
    // are precisely about a digest surviving the zod gate, and `null` would pass them vacuously.
    depreciation: legFixture,
    calculationLines: [],
    output: { total: lei(0) },
  });
}

// --- Tests -------------------------------------------------------------------

describe('snapshot persistence (Step 12)', () => {
  beforeEach(() => {
    localStorage.clear();
    storeRef = null;
  });

  it('addSnapshot appends without mutating prior snapshots', async () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    const store = storeRef!;

    const snapA = await makeSnapshot({ revenues: lei(1000), expenses: lei(400) });
    const snapB = await makeSnapshot({ revenues: lei(2000), expenses: lei(800) });
    const frozenA = structuredClone(snapA);

    act(() => {
      store.addSnapshot(snapA);
    });
    act(() => {
      store.addSnapshot(snapB);
    });

    // Re-read the live value: the Provider re-renders on each append, so the
    // captured `store` closure is stale. `storeRef` tracks the latest render.
    const live = storeRef!;

    // The first snapshot is returned byte-for-byte unchanged after the second append.
    expect(live.getSnapshot(snapA.calculationId)).toEqual(frozenA);
    expect(live.getSnapshot(snapA.calculationId)).toEqual(snapA);
    // The second snapshot is present and distinct.
    expect(live.getSnapshot(snapB.calculationId)).toEqual(snapB);
    expect(snapA.calculationId).not.toBe(snapB.calculationId);
  });

  it('exposes no update/delete path for snapshots (append-only by design)', () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    const store = storeRef!;

    // add/get exist; no mutation or removal surface for snapshots.
    expect(typeof store.addSnapshot).toBe('function');
    expect(typeof store.getSnapshot).toBe('function');
    expect('updateSnapshot' in store).toBe(false);
    expect('deleteSnapshot' in store).toBe(false);
    expect('removeSnapshot' in store).toBe(false);
  });

  it('loadInitial backfills a missing snapshots array to []', () => {
    // Legacy payload: has revenues + settings but no snapshots field.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        profile,
        revenues: [],
        settings: {},
      }),
    );

    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    const store = storeRef!;

    // No snapshots were stored, and lookups return undefined (array is [] not undefined).
    expect(store.getSnapshot('calc-2025-does-not-exist')).toBeUndefined();
    // The backfilled array is persisted back to storage as an array, not dropped.
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { snapshots: unknown };
    expect(Array.isArray(persisted.snapshots)).toBe(true);
    expect(persisted.snapshots).toEqual([]);
  });

  /*
   * TASK 6 — the digest has to survive the two places it can silently disappear: the write, and the zod
   * gate on read. zod strips undeclared keys, so a `ruleSetHash` that is not declared in
   * `taxCalculationSnapshotSchema` would come back as absent and the record would quietly stop claiming
   * which rules produced it.
   */
  it('the ruleSetHash survives the save path and the zod gate', async () => {
    // Phase 11: the save effect does not write while the store is in the first-run state, so this test
    // needs a persisted payload to exercise the save path at all. The snapshot itself is built from this
    // file's own profile fixture, not from the payload below.
    seedStorage();
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    const store = storeRef!;
    const snap = await makeSnapshot({});
    expect(snap.ruleSetHash).toBe(ruleSetDigest(rules2025));

    act(() => {
      store.addSnapshot(snap);
    });

    const raw = localStorage.getItem(STORAGE_KEY)!;
    const persisted = JSON.parse(raw) as { snapshots: { ruleSetHash?: string | null }[] };
    expect(persisted.snapshots[0].ruleSetHash).toBe(ruleSetDigest(rules2025));

    const reparsed = parseAppData(raw);
    expect(reparsed).not.toBeNull();
    expect(reparsed!.snapshots?.[0].ruleSetHash).toBe(snap.ruleSetHash);
    expect(reparsed!.snapshots?.[0].inputsHash).toBe(snap.inputsHash);
  });

  /*
   * B-109 — the same failure mode, one field over. `assetRegisterHash` is declared in
   * `taxCalculationSnapshotSchema` precisely because zod strips undeclared keys: a digest that exists in
   * memory and vanishes on load cannot explain a stored number, which is the entire point of adding it.
   * This test is what fails if the declaration is ever removed.
   */
  it('the assetRegisterHash survives the save path and the zod gate', async () => {
    seedStorage();
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    const store = storeRef!;
    const snap = await makeSnapshot({});
    expect(snap.assetRegisterHash).toMatch(/^[0-9a-f]{64}$/);

    act(() => {
      store.addSnapshot(snap);
    });

    // Written to storage…
    const raw = localStorage.getItem(STORAGE_KEY)!;
    const persisted = JSON.parse(raw) as { snapshots: { assetRegisterHash?: string | null }[] };
    expect(persisted.snapshots[0].assetRegisterHash).toBe(snap.assetRegisterHash);
    // …and still there after the zod gate on read.
    const reparsed = parseAppData(raw);
    expect(reparsed).not.toBeNull();
    expect(reparsed!.snapshots?.[0].assetRegisterHash).toBe(snap.assetRegisterHash);
    // The digest that was already there did not move on the way through.
    expect(reparsed!.snapshots?.[0].inputsHash).toBe(snap.inputsHash);
  });

  it('a stored snapshot written before B-109 loads with no asset digest, and its inputsHash intact', () => {
    // Absence must stay representable: the load path must not default the new key to `null` or to a digest
    // minted from whatever register the app holds today.
    const preChange = {
      calculationId: 'calc-2025-pre-b109',
      taxYear: 2025,
      calculatedAt: '2026-10-14T15:56:00.672Z',
      ruleRelease: release2025,
      ruleSetHash: ruleSetDigest(rules2025),
      inputSnapshot: { profile, revenues: lei(1000), expenses: lei(400) },
      inputsHash: '88215ab2b0aa3b03fd87f17225234f24458a494768da0b66ecb4f433a27b7b0a',
      calculationLines: [],
      output: { total: lei(0) },
      status: 'computed',
    };
    const reparsed = parseAppData(JSON.stringify({ ...seededPayload(), snapshots: [preChange] }));
    expect(reparsed).not.toBeNull();
    const snap = reparsed!.snapshots?.[0];
    expect(snap?.assetRegisterHash).toBeUndefined();
    expect(snap?.inputsHash).toBe('88215ab2b0aa3b03fd87f17225234f24458a494768da0b66ecb4f433a27b7b0a');
  });
});
