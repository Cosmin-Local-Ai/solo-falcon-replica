import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { StoreProvider, useStore, STORAGE_KEY, QUARANTINE_STORAGE_KEY } from './store';
import { CURRENT_DATA_VERSION } from './migration';
import { seedData } from './seed';
import { seedStorage } from '../test/storage';
import type { Revenue } from './types';
import { lei, ron } from '../domain/money';

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
  valoareFaraTva: ron(500),
  tva: ron(95),
  status: 'inregistrata',
};

/**
 * Minimal localStorage stand-in. jsdom's Storage is a Proxy whose methods
 * cannot be shadowed via own properties, so the write-failure test swaps
 * `window.localStorage` (a configurable accessor) for this plain object.
 */
function mockStorage(fail: boolean, seed: Record<string, string> = {}) {
  // `seed` pre-populates the backing map WITHOUT recording a call: since Phase 11 the store does not
  // write at all while it is in the first-run state, so a write-failure test has to start from a payload
  // for a write to be attempted in the first place.
  const store = new Map<string, string>(Object.entries(seed));
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
    // Phase 11: the save effect deliberately does NOT write while the store is in the first-run state —
    // an empty dataset is not a fact, and writing it would turn the next load into a 'persisted' one and
    // drop the user out of onboarding. So this test starts from a payload, which is the state that does
    // get serialized.
    seedStorage();
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
      'documents',
      'expenses',
      // PG-5: the annual returns. PG-5b: no monthly key at all — `declarations` is dropped by the
      // `annual-filing` step and `legacyDeclarations` is gone with the record type. The key list is the
      // migration's evidence, written as a test.
      'filings',
      'profile',
      // TASK 3: the recorded tax reserve is part of AppData, so it is serialized like the rest of the
      // dataset. It is written as `null` when nothing was recorded — the key is present and its value
      // says so, which is the honest state, and it is NOT written as 0.
      'reservedAmount',
      'revenues',
      'settings',
      'snapshots',
      'statements',
      // Phase 7 (D-2): the payload declares its schema version so the migration
      // chain can tell a pre-Phase-7 write from a current one.
      'version',
    ]);
    expect(persisted.version).toBe(CURRENT_DATA_VERSION);
  });

  it('never writes the quarantine key (D-3: the rejected copy survives a save)', () => {
    localStorage.setItem(STORAGE_KEY, '{corrupt');
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    // The save effect fires on first mount, so seed data is re-persisted to the
    // MAIN key immediately after a quarantine. That must not touch the quarantine.
    expect(storeRef!.dataOrigin).toBe('quarantined');
    expect(localStorage.getItem(QUARANTINE_STORAGE_KEY)).toContain('{corrupt');
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('{corrupt');
  });
});

describe('save effect — multiple save cycles', () => {
  it('keeps localStorage in sync across a sequence of mutations', () => {
    seedStorage();
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );

    const read = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
      revenues: Revenue[];
      clients: { id: string; denumire: string }[];
      filings: { id: string; status: string }[];
    };

    // Cycle 1 — add a revenue.
    act(() => storeRef!.addRevenue(newRevenue));
    let persisted = read();
    expect(persisted.revenues).toHaveLength(seedData.revenues.length + 1);
    expect(persisted.revenues[0].nr).toBe(newRevenue.nr);

    // Cycle 2 — update that revenue.
    const addedId = storeRef!.revenues[0].id;
    act(() => storeRef!.updateRevenue({ ...storeRef!.revenues[0], valoareFaraTva: ron(750), tva: ron(142.5) }));
    persisted = read();
    expect(persisted.revenues.find(r => r.id === addedId)!.valoareFaraTva).toEqual(ron(750));
    expect(persisted.revenues.find(r => r.id === addedId)!.tva).toEqual(ron(142.5));
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

    // Cycle 5 — add an annual filing, then update it.
    // TASK 9 re-pin (replaced, not deleted): this cycle used to update the seed's `d2`. The seed holds no
    // monthly rows now (see the note in `data/seed.ts`).
    // PG-5 re-pin (replaced, not deleted): the record is the annual return. The save-cycle coverage is
    // unchanged in kind — a record is written, then updated, then read back from storage — only the
    // record type moved with the model.
    act(() =>
      storeRef!.addFiling({
        taxYear: 2026,
        form: 'D212',
        status: 'in_pregatire',
      }),
    );
    const addedFilingId = storeRef!.filings[storeRef!.filings.length - 1]!.id;
    act(() => storeRef!.updateFiling({ ...storeRef!.filings.find(f => f.id === addedFilingId)!, status: 'depusa', filedOn: '2027-05-12' }));
    persisted = read();
    expect(persisted.filings.find(f => f.id === addedFilingId)!.status).toBe('depusa');

    // After every cycle the persisted blob matches the live in-memory state
    // exactly — no stale or corrupted intermediate writes.
    expect(persisted.revenues).toEqual(storeRef!.revenues);
    expect(persisted.clients).toEqual(storeRef!.clients);
    expect(persisted.filings).toEqual(storeRef!.filings);
    // PG-5b: the monthly family is absent from the bytes, not merely empty in them — no write in the
    // cycle above could have put it back.
    expect('legacyDeclarations' in persisted).toBe(false);
    expect('declarations' in persisted).toBe(false);
  });
});

describe('save effect — write failure (storage quota)', () => {
  it('does not throw when setItem throws and state remains usable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const originalDesc = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
    const mock = mockStorage(true, {
      [STORAGE_KEY]: JSON.stringify({ ...seedData, version: CURRENT_DATA_VERSION }),
    });
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
      expect(storeRef!.dataOrigin).toBe('persisted');

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

      // localStorage was never partially/corruptly written: the payload that was there on load is still
      // byte-identical after two failed writes.
      expect(mock.getItem(STORAGE_KEY)).toBe(JSON.stringify({ ...seedData, version: CURRENT_DATA_VERSION }));
    } finally {
      Object.defineProperty(window, 'localStorage', originalDesc);
    }
  });
});
