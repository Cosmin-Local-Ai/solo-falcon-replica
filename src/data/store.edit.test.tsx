import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { StoreProvider, useStore } from './store';
import { CURRENT_DATA_VERSION } from './migration';
import { seedData } from './seed';
import type { Client, Declaration } from './types';
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

function renderStore() {
  render(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  );
}

function persistedData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  expect(raw).not.toBeNull();
  return JSON.parse(raw!) as { clients: Client[]; declarations: Declaration[] };
}

/**
 * TASK 9: the seed no longer carries declaration records — the three it used to carry (2026-03
 * „transmisa”, 2026-06 „in-asteptare”, 2026-09 „inregistrata”) recorded monthly filings that do not
 * exist for this profile; see the note in `data/seed.ts`. `updateDeclaration` is store behaviour, not a
 * seed fact, so these tests now bring their own records. Written at the current data version so the load
 * path runs no migration and the money fields stay in bani.
 */
const DECLARATION_FIXTURES: Declaration[] = [
  { id: 'd1', an: 2026, luna: 3, venituri: lei(12500), cheltuieli: lei(1800), status: 'transmisa', dataInregistrare: '2026-04-10', dataTrimitere: '2026-04-15' },
  { id: 'd2', an: 2026, luna: 6, venituri: lei(14200), cheltuieli: lei(2100), status: 'in-asteptare', dataInregistrare: '2026-07-08' },
  { id: 'd3', an: 2026, luna: 9, venituri: lei(9680), cheltuieli: lei(546), status: 'inregistrata', dataInregistrare: '2026-09-28' },
];

function renderStoreWithDeclarations() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...seedData, version: CURRENT_DATA_VERSION, declarations: DECLARATION_FIXTURES }),
  );
  renderStore();
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

describe('updateDeclaration', () => {
  it('updates the matching declaration in place, preserving its id', () => {
    renderStoreWithDeclarations();
    const original = storeRef!.declarations.find(d => d.id === 'd2')!;

    act(() => {
      storeRef!.updateDeclaration({ ...original, status: 'transmisa', dataTrimitere: '2026-07-15' });
    });

    const updated = storeRef!.declarations.find(d => d.id === 'd2')!;
    expect(updated.status).toBe('transmisa');
    expect(updated.dataTrimitere).toBe('2026-07-15');
    // Untouched fields survive the update.
    expect(updated.venituri).toBe(original.venituri);
    expect(updated.cheltuieli).toBe(original.cheltuieli);
    expect(updated.dataInregistrare).toBe(original.dataInregistrare);
    expect(storeRef!.declarations).toHaveLength(DECLARATION_FIXTURES.length);
  });

  it('leaves other declarations untouched', () => {
    renderStoreWithDeclarations();
    const d1 = storeRef!.declarations.find(d => d.id === 'd1')!;
    const d3 = storeRef!.declarations.find(d => d.id === 'd3')!;

    act(() => {
      storeRef!.updateDeclaration({ ...d1, venituri: lei(99999) });
    });

    const d3After = storeRef!.declarations.find(d => d.id === 'd3')!;
    expect(d3After).toEqual(d3);
  });

  it('persists the updated declaration to localStorage', () => {
    renderStoreWithDeclarations();
    const d2 = storeRef!.declarations.find(d => d.id === 'd2')!;

    act(() => {
      storeRef!.updateDeclaration({ ...d2, status: 'transmisa' });
    });

    const persisted = persistedData();
    expect(persisted.declarations.find(d => d.id === 'd2')!.status).toBe('transmisa');
    expect(persisted.declarations).toHaveLength(DECLARATION_FIXTURES.length);
  });

  it('is a safe no-op for an unknown id (no crash, no new entry)', () => {
    renderStoreWithDeclarations();
    const before = storeRef!.declarations;

    act(() => {
      storeRef!.updateDeclaration({
        id: 'does-not-exist',
        an: 2026,
        luna: 1,
        venituri: lei(0),
        cheltuieli: lei(0),
        status: 'inregistrata',
        dataInregistrare: '2026-01-01',
      });
    });

    expect(storeRef!.declarations).toEqual(before);
    expect(storeRef!.declarations).toHaveLength(DECLARATION_FIXTURES.length);
  });
});
