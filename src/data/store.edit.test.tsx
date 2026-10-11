import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { StoreProvider, useStore } from './store';
import { CURRENT_DATA_VERSION, DATA_VERSION_RECORD_CURRENCY } from './migration';
import { seedData } from './seed';
import type { LegacyMonthlyDeclaration } from './schema';
import type { AnnualFiling, Client } from './types';
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
  } & Record<string, unknown>;
}

/**
 * PG-5: the store no longer writes monthly declaration rows — `addDeclaration`, `updateDeclaration` and
 * `sendDeclaration` are gone, because a monthly row asserts a return this profile does not owe. What is
 * tested here is the annual return (`AnnualFiling`) and the boundary around it: writing one must not
 * rewrite, reorder or reinterpret anything else in the dataset.
 *
 * PG-5b: the three rows below are the same TASK 9 rows the seed used to carry, kept as **legacy input** —
 * the bytes a pre-v11 payload holds under `declarations`. They are typed with the storage shape from
 * `data/schema.ts`, not with a record type, because there is no longer such a thing. The step that reads
 * them drops them, and the store must never write them back.
 */
const LEGACY_MONTHLY_ROWS: LegacyMonthlyDeclaration[] = [
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
  });
}

/**
 * The same register, loaded from a payload one version behind the chain's head and still carrying its
 * monthly rows. This is the shape PG-5b is about: the load runs `annual-filing`, which drops those rows,
 * and every write after it must not put them back.
 */
function renderStoreFromPreV11Payload() {
  renderStore({
    ...seedData,
    version: DATA_VERSION_RECORD_CURRENCY,
    filings: FILING_FIXTURES,
    declarations: LEGACY_MONTHLY_ROWS,
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

  it('leaves every other collection exactly where it was, and writes no monthly rows back', () => {
    // PG-5b re-premises "leaves the legacy monthly rows exactly where they were". The assertion it carries
    // has not changed in substance — writing an annual filing must not rewrite, reorder or reinterpret
    // anything outside `filings` — only what "the monthly rows" are has changed: they arrive in a pre-v11
    // payload, the `annual-filing` step drops them on load, and no write may resurrect them. The fixture
    // is still the three TASK 9 rows, so the coverage is against real-shaped data, not an empty list.
    renderStoreFromPreV11Payload();

    // The step ran: the payload's monthly rows did not survive into the store, and nothing was minted.
    expect(storeRef!.filings).toHaveLength(FILING_FIXTURES.length);

    const revenues = storeRef!.revenues;
    const expenses = storeRef!.expenses;
    const clients = storeRef!.clients;

    act(() => {
      storeRef!.updateFiling({ ...storeRef!.filings.find(f => f.id === 'f26')!, status: 'depusa', filedOn: '2027-05-12' });
    });

    // Byte for byte, in state and in storage.
    expect(storeRef!.revenues).toEqual(revenues);
    expect(storeRef!.expenses).toEqual(expenses);
    expect(storeRef!.clients).toEqual(clients);
    const persisted = persistedData();
    expect(persisted.revenues).toEqual(revenues);
    expect(persisted.expenses).toEqual(expenses);
    expect(persisted.clients).toEqual(clients);

    // And the monthly family is gone from the written shape — under the key the payload carried it under,
    // and under the key PG-5 used to write it to.
    expect('declarations' in persisted).toBe(false);
    expect('legacyDeclarations' in persisted).toBe(false);
    const written = JSON.stringify(persisted);
    for (const row of LEGACY_MONTHLY_ROWS) expect(written).not.toContain(row.id);
  });
});
