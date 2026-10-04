import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { StoreProvider, useStore } from './store';
import { seedData } from './seed';
import type { Client, Declaration } from './types';

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
    renderStore();
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
    expect(storeRef!.declarations).toHaveLength(seedData.declarations.length);
  });

  it('leaves other declarations untouched', () => {
    renderStore();
    const d1 = storeRef!.declarations.find(d => d.id === 'd1')!;
    const d3 = storeRef!.declarations.find(d => d.id === 'd3')!;

    act(() => {
      storeRef!.updateDeclaration({ ...d1, venituri: 99999 });
    });

    const d3After = storeRef!.declarations.find(d => d.id === 'd3')!;
    expect(d3After).toEqual(d3);
  });

  it('persists the updated declaration to localStorage', () => {
    renderStore();
    const d2 = storeRef!.declarations.find(d => d.id === 'd2')!;

    act(() => {
      storeRef!.updateDeclaration({ ...d2, status: 'transmisa' });
    });

    const persisted = persistedData();
    expect(persisted.declarations.find(d => d.id === 'd2')!.status).toBe('transmisa');
    expect(persisted.declarations).toHaveLength(seedData.declarations.length);
  });

  it('is a safe no-op for an unknown id (no crash, no new entry)', () => {
    renderStore();
    const before = storeRef!.declarations;

    act(() => {
      storeRef!.updateDeclaration({
        id: 'does-not-exist',
        an: 2026,
        luna: 1,
        venituri: 0,
        cheltuieli: 0,
        status: 'inregistrata',
        dataInregistrare: '2026-01-01',
      });
    });

    expect(storeRef!.declarations).toEqual(before);
    expect(storeRef!.declarations).toHaveLength(seedData.declarations.length);
  });
});
