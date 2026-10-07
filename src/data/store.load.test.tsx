import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { StoreProvider, useStore, STORAGE_KEY, QUARANTINE_STORAGE_KEY } from './store';
import { CURRENT_DATA_VERSION } from './migration';
import { seedData } from './seed';
import type { AppData, Revenue } from './types';
import type { RuleRelease } from '../domain/fiscal/rules';
import type { TaxCalculationSnapshot } from '../domain/snapshots/types';
import { lei } from '../domain/money';

let storeRef: ReturnType<typeof useStore> | null = null;
function Probe() {
  storeRef = useStore();
  return null;
}

const validRevenue: Revenue = {
  id: 'r1',
  tip: 'factura',
  nr: 'FCT-2026-001',
  date: '2026-03-15',
  client: 'Presta Consulting SRL',
  cui: 'RO12345678',
  valoareFaraTva: lei(1000),
  tva: lei(190),
  status: 'inregistrata',
};

const validRelease: RuleRelease = {
  releaseId: 'rel-1',
  name: '2026.1',
  jurisdiction: 'RO',
  entityType: 'pfa',
  taxYear: 2026,
  ruleIds: [],
  status: 'SAFE_ACTIVATION',
  effectiveFrom: '2026-01-01',
  createdAt: '2026-01-01T00:00:00.000Z',
  evidence: [],
};

function writePayload(overrides: Record<string, unknown> = {}) {
  const base: AppData = {
    profile: seedData.profile,
    revenues: [validRevenue],
    expenses: [],
    clients: [],
    declarations: [],
    documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] },
    statements: [],
    snapshots: [],
    settings: seedData.settings,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...base, ...overrides }));
}

beforeEach(() => {
  localStorage.clear();
  storeRef = null;
});

afterEach(() => {
  localStorage.clear();
});

describe('loadInitial — seed fallback (no stored data)', () => {
  it('uses seed data when localStorage is empty', () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.revenues).toEqual(seedData.revenues);
    expect(storeRef!.settings).toEqual(seedData.settings);
  });
});

describe('loadInitial — valid persisted data loads (not seed)', () => {
  it('loads a valid dataset and keeps the user data', () => {
    writePayload();
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.revenues).toHaveLength(1);
    expect(storeRef!.revenues[0].id).toBe('r1');
    expect(storeRef!.revenues).not.toEqual(seedData.revenues);
    expect(storeRef!.profile).toEqual(seedData.profile);
  });

  it('preserves valid snapshots so getSnapshot resolves', () => {
    const snapshot: TaxCalculationSnapshot = {
      calculationId: 'calc-2026',
      taxYear: 2026,
      calculatedAt: '2026-09-01T00:00:00.000Z',
      ruleRelease: validRelease,
      inputSnapshot: { profile: seedData.profile, revenues: lei(1000), expenses: lei(0) },
      inputsHash: 'abc123',
      calculationLines: [{ label: 'Baza impozabilă', value: lei(1000) }],
      output: { total: lei(100) },
      status: 'computed',
    };
    writePayload({ snapshots: [snapshot] });
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.getSnapshot('calc-2026')).toEqual(snapshot);
  });
});

describe('loadInitial — corrupt data recovers to seed', () => {
  it('falls back to seed on unparseable JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.revenues).toEqual(seedData.revenues);
  });

  it('falls back to seed when a required collection is missing', () => {
    const { revenues, ...rest } = seedData;
    void revenues;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.revenues).toEqual(seedData.revenues);
  });

  it('falls back to seed on a wrong type for a required collection', () => {
    writePayload({ revenues: 'nope' });
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.revenues).toEqual(seedData.revenues);
  });

  it('falls back to seed on an invalid number', () => {
    writePayload({
      revenues: [{ ...validRevenue, valoareFaraTva: lei(-5) }],
    });
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.revenues).toEqual(seedData.revenues);
  });

  it('falls back to seed on an empty settings object', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ profile: seedData.profile, revenues: [], settings: {} }),
    );
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.revenues).toEqual(seedData.revenues);
    expect(storeRef!.settings).toEqual(seedData.settings);
  });

  it('falls back to seed on an invalid profile', () => {
    writePayload({ profile: { ...seedData.profile, regime: 'impozit_pe_cit2' } });
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.revenues).toEqual(seedData.revenues);
  });

  it('persists the recovered seed state back to localStorage', () => {
    localStorage.setItem(STORAGE_KEY, '{corrupt');
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as AppData;
    expect(persisted.revenues).toEqual(seedData.revenues);
    expect(persisted.settings).toEqual(seedData.settings);
  });
});

describe('loadInitial — dataOrigin flag', () => {
  it("is 'seed' when storage is empty", () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.dataOrigin).toBe('seed');
  });

  it("is 'persisted' when a valid dataset loads", () => {
    writePayload();
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.dataOrigin).toBe('persisted');
    expect(storeRef!.revenues).not.toEqual(seedData.revenues);
  });

  it("is 'seed' after recovery from corrupt data", () => {
    localStorage.setItem(STORAGE_KEY, '{corrupt');
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    // D-3: the payload is no longer silently discarded. The app still recovers to
    // seed data, but it says so and keeps the rejected copy retrievable (B-11).
    expect(storeRef!.dataOrigin).toBe('quarantined');
    expect(storeRef!.revenues).toEqual(seedData.revenues);
    expect(storeRef!.quarantine).not.toBeNull();
    expect(storeRef!.quarantine!.reason).toBe('unparseable-json');
    expect(storeRef!.quarantine!.raw).toBe('{corrupt');
    expect(localStorage.getItem(QUARANTINE_STORAGE_KEY)).toContain('{corrupt');
  });

  it("is 'seed' after recovery from a missing required collection", () => {
    const { revenues, ...rest } = seedData;
    void revenues;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.dataOrigin).toBe('quarantined');
    expect(storeRef!.quarantine!.reason).toBe('schema-invalid');
  });

  it("keeps 'persisted' for a migrated payload and reports the migration separately (D-3b)", () => {
    // writePayload() writes no `version`, so this is a pre-Phase-7 payload: the
    // chain runs, but the origin stays 'persisted' — it is still the user's data.
    writePayload();
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.dataOrigin).toBe('persisted');
    expect(storeRef!.migration).not.toBeNull();
    expect(storeRef!.migration!.fromVersion).toBe(0);
    expect(storeRef!.migration!.toVersion).toBe(CURRENT_DATA_VERSION);
    expect(storeRef!.dataVersion).toBe(CURRENT_DATA_VERSION);
  });

  it("is 'persisted' with no migration when the payload is already current", () => {
    writePayload({ version: CURRENT_DATA_VERSION });
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.dataOrigin).toBe('persisted');
    expect(storeRef!.migration).toBeNull();
    expect(storeRef!.quarantine).toBeNull();
  });
});

describe('loadInitial — optional collections are backfilled', () => {
  it('backfills a missing profile from settings', () => {
    writePayload({ profile: undefined });
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    const profile = storeRef!.profile;
    expect(profile).toBeDefined();
    expect(profile!.identity.nume).toBe(seedData.settings.personal.nume);
    expect(profile!.identity.cui).toBe(seedData.settings.company.cui);
  });

  it('backfills a missing snapshots array to []', () => {
    writePayload({ snapshots: undefined });
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.snapshots).toEqual([]);
    expect(storeRef!.getSnapshot('calc-2025-does-not-exist')).toBeUndefined();
  });

  it('backfills missing secondary collections to empty values', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        profile: seedData.profile,
        revenues: [{ ...validRevenue, valoareFaraTva: lei(10) }],
        settings: seedData.settings,
      }),
    );
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.expenses).toEqual([]);
    expect(storeRef!.clients).toEqual([]);
    expect(storeRef!.declarations).toEqual([]);
    expect(storeRef!.documents).toEqual([]);
    expect(storeRef!.companyDocs).toEqual({ im: [], cs: [], tva: [], facturi: [] });
    expect(storeRef!.statements).toEqual([]);
    expect(storeRef!.snapshots).toEqual([]);
  });
});
