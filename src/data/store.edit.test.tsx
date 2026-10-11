import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { StoreProvider, useStore } from './store';
import { CURRENT_DATA_VERSION } from './migration';
import { seedData } from './seed';
import type { AnnualFiling, Client, Declaration } from './types';
import { lei } from '../domain/money';

// Must match STORAGE_KEY in src/data/store.tsx (module-private, not exported).
const STORAGE_KEY = 'pfa-app-data-v2';

let storeRef: ReturnType<typeof useStore> | null = null;
function Probe() {
  storeRef = useStore();
  return null;
}

beforeEach(() => {
  localStorage.clear();
  storeRef = null;
});

afterEach(() => {
  localStorage.clear();
});

/**
 * Phase 11: a fresh store is now EMPTY, not the demo fixture. These tests edit the fixture's records, so
 * they load it the way the app now loads data — through the persisted payload, at the current version so
 * the migration chain stays out of the picture.
 */
function renderStore(payload: unknown = { ...seedData, version: CURRENT_DATA_VERSION }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  render(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  );
}

function persistedData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  expect(raw).not.toBeNull();
  return JSON.parse(raw!) as {
    clients: Client[];
    filings: AnnualFiling[];
    legacyDeclarations: Declaration[];
  };
}

/**
 * PG-5: the store no longer writes monthly declaration rows — `addDeclaration`, `updateDeclaration` and
 * `sendDeclaration` are gone, because a monthly row asserts a return this profile does not owe. What is
 * tested here is the annual return (`AnnualFiling`) and the preservation half: the monthly rows a pre-v11
 * payload carried survive every write untouched.
 *
 * The monthly fixtures are the same three rows the seed used to carry (see the note in `data/seed.ts`),
 * kept here as legacy input so preservation is tested against real-shaped data rather than an empty list.
 */
const LEGACY_DECLARATION_FIXTURES: Declaration[] = [
  { id: 'd1', an: 2026, luna: 3, venituri: lei(12500), cheltuieli: lei(1800), status: 'transmisa', dataInregistrare: '2026-04-10', dataTrimitere: '2026-04-15' },
  { id: 'd2', an: 2026, luna: 6, venituri: lei(14200), cheltuieli: lei(2100), status: 'in-asteptare', dataInregistrare: '2026-07-08' },
  { id: 'd3', an: 2026, luna: 9, venituri: lei(9680), cheltuieli: lei(546), status: 'inregistrata', dataInregistrare: '2026-09-28' },
];

const FILING_FIXTURES: AnnualFiling[] = [
  { id: 'f25', taxYear: 2025, form: 'D212', status: 'depusa', filedOn: '2026-05-20', reference: 'D212.2025.000123' },
  { id: 'f26', taxYear: 2026, form: 'D212', status: 'in_pregatire' },
];

function renderStoreWithFilings() {
  renderStore({
    ...seedData,
    version: CURRENT_DATA_VERSION,
    filings: FILING_FIXTURES,
    legacyDeclarations: LEGACY_DECLARATION_FIXTURES,
  });
}

describe('updateClient', () => {
  it('updates the matching client in place, preserving its id', () => {
    renderStore();
    const original = storeRef!.clients.find(c => c.id === 'c1')!;

    act(() => {
      storeRef!.updateClient({ ...original, denumire: 'Presta Consulting S.R.L.', email: 'nou@presta.ro' });
    });

    const updated = storeRef!.clients.find(c => c.id === 'c1')!;
    expect(updated.denumire).toBe('Presta Consulting S.R.L.');
    expect(updated.email).toBe('nou@presta.ro');
    // Untouched fields survive the update.
    expect(updated.cui).toBe(original.cui);
    expect(updated.telefon).toBe(original.telefon);
    expect(updated.oras).toBe(original.oras);
    // The list size is unchanged — an update is not an add.
    expect(storeRef!.clients).toHaveLength(seedData.clients.length);
  });

  it('leaves other clients untouched', () => {
    renderStore();
    const c1 = storeRef!.clients.find(c => c.id === 'c1')!;
    const c2 = storeRef!.clients.find(c => c.id === 'c2')!;

    act(() => {
      storeRef!.updateClient({ ...c1, telefon: '0700 000 000' });
    });

    const c2After = storeRef!.clients.find(c => c.id === 'c2')!;
    expect(c2After).toEqual(c2);
    expect(storeRef!.clients.find(c => c.id === 'c3')).toEqual(seedData.clients[2]);
  });

  it('persists the updated client to localStorage', () => {
    renderStore();
    const c1 = storeRef!.clients.find(c => c.id === 'c1')!;

    act(() => {
      storeRef!.updateClient({ ...c1, denumire: 'Presta Consulting S.R.L.' });
    });

    const persisted = persistedData();
    expect(persisted.clients.find(c => c.id === 'c1')!.denumire).toBe('Presta Consulting S.R.L.');
    expect(persisted.clients).toHaveLength(seedData.clients.length);
  });

  it('is a safe no-op for an unknown id (no crash, no new entry)', () => {
    renderStore();
    const before = storeRef!.clients;

    act(() => {
      storeRef!.updateClient({ id: 'does-not-exist', denumire: 'Ghost SRL', cui: 'RO00000000' });
    });

    expect(storeRef!.clients).toEqual(before);
    expect(storeRef!.clients).toHaveLength(seedData.clients.length);
    expect(storeRef!.clients.find(c => c.id === 'does-not-exist')).toBeUndefined();
  });
});

describe('updateFiling', () => {
  it('updates the matching annual filing in place, preserving its id', () => {
    renderStoreWithFilings();
    const original = storeRef!.filings.find(f => f.id === 'f26')!;

    act(() => {
      storeRef!.updateFiling({ ...original, status: 'depusa', filedOn: '2027-05-12' });
    });

    const updated = storeRef!.filings.find(f => f.id === 'f26')!;
    expect(updated.status).toBe('depusa');
    expect(updated.filedOn).toBe('2027-05-12');
    // The year the return DECLARES is not the year it was filed; an edit must not blur them.
    expect(updated.taxYear).toBe(original.taxYear);
    expect(updated.form).toBe('D212');
    expect(storeRef!.filings).toHaveLength(FILING_FIXTURES.length);
  });

  it('leaves other filings untouched', () => {
    renderStoreWithFilings();
    const f25 = storeRef!.filings.find(f => f.id === 'f25')!;

    act(() => {
      storeRef!.updateFiling({ ...storeRef!.filings.find(f => f.id === 'f26')!, status: 'depusa', filedOn: '2027-05-12' });
    });

    expect(storeRef!.filings.find(f => f.id === 'f25')).toEqual(f25);
  });

  it('persists the updated filing to localStorage', () => {
    renderStoreWithFilings();
    act(() => {
      storeRef!.updateFiling({ ...storeRef!.filings.find(f => f.id === 'f26')!, status: 'depusa', filedOn: '2027-05-12' });
    });

    const persisted = persistedData();
    expect(persisted.filings.find(f => f.id === 'f26')!.status).toBe('depusa');
    expect(persisted.filings).toHaveLength(FILING_FIXTURES.length);
  });

  it('is a safe no-op for an unknown id (no crash, no new entry)', () => {
    renderStoreWithFilings();
    const before = storeRef!.filings;

    act(() => {
      storeRef!.updateFiling({ id: 'does-not-exist', taxYear: 2024, form: 'D212', status: 'in_pregatire' });
    });

    expect(storeRef!.filings).toEqual(before);
    expect(storeRef!.filings).toHaveLength(FILING_FIXTURES.length);
  });

  it('leaves the legacy monthly rows exactly where they were', () => {
    // The preservation half of the migration: writing an annual filing must not rewrite, reorder or
    // reinterpret the monthly rows a pre-v11 payload carried.
    renderStoreWithFilings();
    act(() => {
      storeRef!.updateFiling({ ...storeRef!.filings.find(f => f.id === 'f26')!, status: 'depusa', filedOn: '2027-05-12' });
    });

    expect(storeRef!.legacyDeclarations).toEqual(LEGACY_DECLARATION_FIXTURES);
    expect(persistedData().legacyDeclarations).toEqual(LEGACY_DECLARATION_FIXTURES);
  });
});
