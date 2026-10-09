import { describe, expect, it, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { StoreProvider, useStore } from './store';
import type { TaxCalculationSnapshot } from '../domain/snapshots/types';
import { createCalculationSnapshot } from '../domain/snapshots/snapshot';
import { ruleSetDigest } from '../domain/fiscal/ruleSetDigest';
import { parseAppData } from './schema';
import type { PfaProfile } from '../domain/models';
import type { FiscalRule, RuleRelease } from '../domain/fiscal/rules';
import { lei, type Bani } from '../domain/money';

const STORAGE_KEY = 'pfa-app-data-v2';

// --- Fixtures ---------------------------------------------------------------

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
  otherIncome: [],
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

async function makeSnapshot(over: Partial<{ revenues: Bani; expenses: Bani }>): Promise<TaxCalculationSnapshot> {
  return createCalculationSnapshot({
    profile,
    revenues: over.revenues ?? lei(1000),
    expenses: over.expenses ?? lei(400),
    ruleRelease: release2025,
    rules: rules2025,
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
});
