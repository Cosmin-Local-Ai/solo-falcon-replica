import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { StoreProvider, useStore } from './store';
import { seedData } from './seed';
import type { Revenue } from './types';

// Must match STORAGE_KEY in src/data/store.tsx (module-private, not exported).
const STORAGE_KEY = 'pfa-app-data-v2';

let storeRef: ReturnType<typeof useStore> | null = null;
function Probe() {
  storeRef = useStore();
  return null;
}

const newRevenue: Omit<Revenue, 'id'> = {
  tip: 'factura',
  nr: 'FCT-2026-002',
  date: '2026-03-20',
  client: 'Presta Consulting SRL',
  cui: 'RO12345678',
  valoareFaraTva: 500,
  tva: 95,
  status: 'inregistrata',
};

/**
 * Minimal localStorage stand-in. jsdom's Storage is a Proxy whose methods
 * cannot be shadowed via own properties, so the write-failure test swaps
 * `window.localStorage` (a configurable accessor) for this plain object.
 */
function mockStorage(fail: boolean) {
  const store = new Map<string, string>();
  const calls: { key: string; value: string }[] = [];
  return {
    calls,
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      calls.push({ key: k, value: v });
      if (fail) throw new DOMException('QuotaExceededError');
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  storeRef = null;
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('save effect — serialization contract', () => {
  it('serializes only AppData — no store-level fields (dataOrigin, toasts)', () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw!) as Record<string, unknown>;
    expect(persisted).not.toHaveProperty('dataOrigin');
    expect(persisted).not.toHaveProperty('toasts');
    expect(Object.keys(persisted).sort()).toEqual([
      'clients',
      'companyDocs',
      'declarations',
      'documents',
      'expenses',
      'profile',
      'revenues',
      'settings',
      'snapshots',
      'statements',
    ]);
  });
});

describe('save effect — multiple save cycles', () => {
  it('keeps localStorage in sync across a sequence of mutations', () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );

    const read = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
      revenues: Revenue[];
      clients: { id: string; denumire: string }[];
      declarations: { id: string; status: string }[];
    };

    // Cycle 1 — add a revenue.
    act(() => storeRef!.addRevenue(newRevenue));
    let persisted = read();
    expect(persisted.revenues).toHaveLength(seedData.revenues.length + 1);
    expect(persisted.revenues[0].nr).toBe(newRevenue.nr);

    // Cycle 2 — update that revenue.
    const addedId = storeRef!.revenues[0].id;
    act(() => storeRef!.updateRevenue({ ...storeRef!.revenues[0], valoareFaraTva: 750, tva: 142.5 }));
    persisted = read();
    expect(persisted.revenues.find(r => r.id === addedId)!.valoareFaraTva).toBe(750);
    expect(persisted.revenues.find(r => r.id === addedId)!.tva).toBe(142.5);
    expect(persisted.revenues).toHaveLength(seedData.revenues.length + 1);

    // Cycle 3 — delete the seed revenue r4.
    act(() => storeRef!.deleteRevenue('r4'));
    persisted = read();
    expect(persisted.revenues.find(r => r.id === 'r4')).toBeUndefined();
    expect(persisted.revenues).toHaveLength(seedData.revenues.length);

    // Cycle 4 — update a client.
    const c1 = storeRef!.clients.find(c => c.id === 'c1')!;
    act(() => storeRef!.updateClient({ ...c1, denumire: 'Presta Consulting S.R.L.' }));
    persisted = read();
    expect(persisted.clients.find(c => c.id === 'c1')!.denumire).toBe('Presta Consulting S.R.L.');

    // Cycle 5 — update a declaration.
    const d2 = storeRef!.declarations.find(d => d.id === 'd2')!;
    act(() => storeRef!.updateDeclaration({ ...d2, status: 'transmisa' }));
    persisted = read();
    expect(persisted.declarations.find(d => d.id === 'd2')!.status).toBe('transmisa');

    // After every cycle the persisted blob matches the live in-memory state
    // exactly — no stale or corrupted intermediate writes.
    expect(persisted.revenues).toEqual(storeRef!.revenues);
    expect(persisted.clients).toEqual(storeRef!.clients);
    expect(persisted.declarations).toEqual(storeRef!.declarations);
  });
});

describe('save effect — write failure (storage quota)', () => {
  it('does not throw when setItem throws and state remains usable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const originalDesc = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
    const mock = mockStorage(true);
    Object.defineProperty(window, 'localStorage', { value: mock, configurable: true, writable: true });

    try {
      // The mount write fails — the provider must not crash.
      expect(() =>
        render(
          <StoreProvider>
            <Probe />
          </StoreProvider>,
        ),
      ).not.toThrow();

      // In-memory state is intact and usable.
      expect(storeRef!.revenues).toEqual(seedData.revenues);
      expect(storeRef!.settings).toEqual(seedData.settings);
      expect(storeRef!.dataOrigin).toBe('seed');

      // The failure is controlled: a write was attempted and logged.
      expect(mock.calls).toHaveLength(1);
      expect(mock.calls[0].key).toBe(STORAGE_KEY);
      expect(warn).toHaveBeenCalledTimes(1);

      // A mutation still works; the follow-up write is attempted (and
      // fails) without crashing the app.
      act(() => {
        storeRef!.addRevenue(newRevenue);
      });
      expect(storeRef!.revenues).toHaveLength(seedData.revenues.length + 1);
      expect(storeRef!.revenues[0].nr).toBe(newRevenue.nr);
      expect(mock.calls).toHaveLength(2);
      expect(warn).toHaveBeenCalledTimes(2);

      // localStorage was never partially/corruptly written.
      expect(mock.getItem(STORAGE_KEY)).toBeNull();
    } finally {
      Object.defineProperty(window, 'localStorage', originalDesc);
    }
  });
});
