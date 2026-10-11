import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { StoreProvider, useStore, STORAGE_KEY, QUARANTINE_STORAGE_KEY } from './store';
import { CURRENT_DATA_VERSION } from './migration';
import { seedData } from './seed';
import type { AppData, LegacyAppData, LegacyRevenue } from './types';
import type { RuleRelease } from '../domain/fiscal/rules';
import type { TaxCalculationSnapshot } from '../domain/snapshots/types';
import { lei, ron, type Bani } from '../domain/money';
import { computeInputsHash } from '../domain/snapshots/hash';

let storeRef: ReturnType<typeof useStore> | null = null;
function Probe() {
  storeRef = useStore();
  return null;
}

// A pre-v10 payload record: money as a bare number, no currency. Typed `LegacyRevenue` because that is
// the shape under test — the chain is what turns it into a `Money`.
const validRevenue: LegacyRevenue = {
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
  const base: LegacyAppData = {
    reservedAmount: null,
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

/**
 * Phase 11 (D1, D-RUN-1) renamed this whole expectation. Empty storage used to mean "use `seedData`";
 * it now means "use nothing". The fixture is a test fixture and an opt-in sandbox, never a first run.
 */
describe('loadInitial — empty storage starts empty (no fixture)', () => {
  it('starts with no records when localStorage is empty', () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.revenues).toEqual([]);
    expect(storeRef!.expenses).toEqual([]);
    expect(storeRef!.clients).toEqual([]);
    // The identity is present as an object and empty as a fact — the app has a profile shape, not a person.
    expect(storeRef!.profile.identity.nume).toBe('');
    expect(storeRef!.profile.pfaStartDate).toBeUndefined();
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

  it('preserves valid snapshots so getSnapshot resolves', async () => {
    // A RAW persisted v4 payload: its money fields still hold lei, so they are deliberately NOT
    // wrapped in lei() — the v4->v5 money step is what scales them.
    const snapshot: TaxCalculationSnapshot = {
      calculationId: 'calc-2026',
      taxYear: 2026,
      calculatedAt: '2026-09-01T00:00:00.000Z',
      ruleRelease: validRelease,
      inputSnapshot: { profile: seedData.profile, revenues: 1000 as Bani, expenses: 0 as Bani },
      inputsHash: 'abc123',
      calculationLines: [{ label: 'Baza impozabilă', value: 1000 as Bani }],
      output: { total: 100 as Bani },
      status: 'computed',
    };
    writePayload({ snapshots: [snapshot] });
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    const loaded = storeRef!.getSnapshot('calc-2026');
    expect(loaded).not.toBeNull();
    // The snapshot survives the migration with its identity intact...
    expect(loaded!.calculationId).toBe('calc-2026');
    expect(loaded!.status).toBe('computed');
    // ...its money converted once...
    expect(loaded!.inputSnapshot.revenues).toBe(lei(1000));
    expect(loaded!.calculationLines[0].value).toBe(lei(1000));
    expect(loaded!.output.total).toBe(lei(100));
    // ...and its hash RE-DERIVED, because the inputs it hashes changed. The pre-migration hash is
    // kept alongside it so an audit can still reproduce the old digest.
    expect(loaded!.preMigrationInputsHash).toBe('abc123');
    expect(loaded!.inputsHash).not.toBe('abc123');
    // The invariant that matters: the stored digest describes the STORED inputs.
    expect(await computeInputsHash(loaded!.inputSnapshot)).toBe(loaded!.inputsHash);
  });
});

/**
 * Phase 11: a rejected payload falls back to an EMPTY dataset, not to the demo fixture. The quarantine
 * half of the contract is unchanged — the bytes are preserved first, and the state is visible.
 */
describe('loadInitial — corrupt data recovers to an empty dataset', () => {
  it('falls back to nothing on unparseable JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.revenues).toEqual([]);
  });

  it('falls back to nothing when a required collection is missing', () => {
    const { revenues, ...rest } = seedData;
    void revenues;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.revenues).toEqual([]);
  });

  it('falls back to nothing on a wrong type for a required collection', () => {
    writePayload({ revenues: 'nope' });
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.revenues).toEqual([]);
  });

  it('falls back to nothing on an invalid number', () => {
    writePayload({
      revenues: [{ ...validRevenue, valoareFaraTva: lei(-5) }],
    });
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.revenues).toEqual([]);
  });

  it('falls back to nothing on an empty settings object', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ profile: seedData.profile, revenues: [], settings: {} }),
    );
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.revenues).toEqual([]);
    expect(storeRef!.settings.company.denumire).toBe('');
  });

  it('falls back to nothing on an invalid profile', () => {
    writePayload({ profile: { ...seedData.profile, regime: 'impozit_pe_cit2' } });
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.revenues).toEqual([]);
  });

  it('persists the recovered empty state back to localStorage', () => {
    localStorage.setItem(STORAGE_KEY, '{corrupt');
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as AppData;
    // The quarantine banner is the only thing that may survive a rejected payload into the data key —
    // and it survives in the QUARANTINE key, never here.
    expect(persisted.revenues).toEqual([]);
    expect(persisted.expenses).toEqual([]);
    expect(persisted.settings.company.denumire).toBe('');
  });
});

describe('loadInitial — dataOrigin flag', () => {
  it("is 'empty' when storage is empty", () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.dataOrigin).toBe('empty');
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

  it("is 'empty' after recovery when there is nothing to recover", () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.dataOrigin).toBe('empty');
  });

  it("is 'quarantined' after recovery from corrupt data, on an empty dataset (D-3, B-11)", () => {
    localStorage.setItem(STORAGE_KEY, '{corrupt');
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    // D-3: the payload is not silently discarded — it is preserved and the state is visible. Phase 11
    // changed only WHAT the app recovers TO: an empty dataset, not the demo fixture.
    expect(storeRef!.dataOrigin).toBe('quarantined');
    expect(storeRef!.revenues).toEqual([]);
    expect(storeRef!.quarantine).not.toBeNull();
    expect(storeRef!.quarantine!.reason).toBe('unparseable-json');
    expect(storeRef!.quarantine!.raw).toBe('{corrupt');
    expect(localStorage.getItem(QUARANTINE_STORAGE_KEY)).toContain('{corrupt');
  });

  it("is 'quarantined' after recovery from a missing required collection", () => {
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
    expect(storeRef!.filings).toEqual([]);
    expect(storeRef!.legacyDeclarations).toEqual([]);
    expect(storeRef!.documents).toEqual([]);
    expect(storeRef!.companyDocs).toEqual({ im: [], cs: [], tva: [], facturi: [] });
    expect(storeRef!.statements).toEqual([]);
    expect(storeRef!.snapshots).toEqual([]);
  });
});

/**
 * Phase 10, B-26 — the report the `money-bani` step produces has to survive the load AND the write that
 * follows it. It used to be dropped by `toAppData`, so the save effect (which spreads `AppData` back into
 * localStorage) erased it on the first mutation after a load. Criterion 6 says a value that cannot be
 * converted must surface, not vanish; a report that lives for one render and then disappears does neither.
 */
describe('loadInitial — the money-precision report survives (B-26)', () => {
  /** A RAW v4 payload: its money fields still hold lei, so they are deliberately NOT wrapped in lei(). */
  function writeSubBanPayload() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        profile: seedData.profile,
        revenues: [{ ...validRevenue, valoareFaraTva: 674.504 }],
        settings: seedData.settings,
      }),
    );
  }

  it('carries the report out of the migration onto the loaded data', () => {
    writeSubBanPayload();
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );

    // The money converted once, to the nearest ban, half-down.
    expect(storeRef!.revenues[0]!.valoareFaraTva).toEqual(ron(674.5));
    // And the decision it had to make is on the data, not only on the migration result.
    expect(storeRef!.moneyNotices).toHaveLength(1);
    expect(storeRef!.moneyNotices![0]).toMatchObject({
      collection: 'revenues',
      id: 'r1',
      field: 'valoareFaraTva',
      original: '674.504',
      converted: lei(674.5),
      reason: 'sub-ban-precision',
    });
  });

  it('writes the report back to localStorage instead of letting the save erase it', () => {
    writeSubBanPayload();
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );

    // The save effect runs on mount, so by now the payload has been rewritten at the current version.
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved.version).toBe(CURRENT_DATA_VERSION);
    expect(saved.moneyNotices).toHaveLength(1);
    expect(saved.moneyNotices[0].original).toBe('674.504');
    expect(saved.moneyNotices[0].converted).toBe(67450);
  });

  it('is still on the data on a second load, when no migration runs at all', () => {
    writeSubBanPayload();
    const first = render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    first.unmount();

    // Second load: the payload is already current, so the money step never runs again and cannot
    // re-derive the report. Whatever survives here is what the user would actually see.
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.migration).toBeNull();
    expect(storeRef!.moneyNotices).toHaveLength(1);
    expect(storeRef!.moneyNotices![0]!.original).toBe('674.504');
  });

  it('leaves the report absent for data that needed no decision', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        profile: seedData.profile,
        revenues: [{ ...validRevenue, valoareFaraTva: 142.5 }],
        settings: seedData.settings,
      }),
    );
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    expect(storeRef!.revenues[0]!.valoareFaraTva).toEqual(ron(142.5));
    expect(storeRef!.moneyNotices).toBeUndefined();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect('moneyNotices' in saved).toBe(false);
  });
});
