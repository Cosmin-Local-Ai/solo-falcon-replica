/**
 * Step 11 / Part D (B-134) — the demo ↔ real toggle must be lossless, and it must survive a reload.
 *
 * The requirement this file exists for is the one the brief calls an honesty requirement rather than a
 * convenience: a demo that renders identically to a real tax position is the same defect class as
 * `engaged: true` beside a measured 0. So the assertions are about the USER's records, not about the demo's:
 *
 *  - activating and deactivating a demo leaves the person's own data byte-identical (acceptance 6);
 *  - a record added WHILE a demo is on screen never reaches the person's data — nothing merges;
 *  - the bytes under `STORAGE_KEY` are not rewritten while a demo is on screen;
 *  - the demo choice survives a reload and is reported on the first render, so a leftover demo can never be
 *    mistaken for the person's own year (acceptance 5).
 *
 * "Reload" is simulated the only honest way available in jsdom: unmount the provider and mount a new one
 * over the same localStorage. That runs the real load path — `loadInitial()` and the demo restore — rather
 * than calling the restore helper directly.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { STORAGE_KEY, StoreProvider, useStore } from './store';
import { DEMO_MODE_STORAGE_KEY } from './demoMode';
import { CURRENT_DATA_VERSION } from './migration';
import { seedData } from './seed';
import { seedStorage } from '../test/storage';
import { personaById } from './personas';
import type { AppData } from './types';

let storeRef: ReturnType<typeof useStore> | null = null;
function Probe() {
  storeRef = useStore();
  return null;
}

async function mount() {
  const view = render(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  );
  // The store's mount work (blob connect + relocation) is asynchronous; let it settle before asserting.
  await act(async () => {});
  return view;
}

/** The person's own records, in the shape the store persists them. */
function ownRecords(): AppData {
  return JSON.parse(JSON.stringify(seedData)) as AppData;
}

function persistedBytes(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

beforeEach(() => {
  localStorage.clear();
  seedStorage();
});

afterEach(() => {
  localStorage.clear();
  storeRef = null;
});

describe('activating a demo does not touch the user\'s own data (B-134, acceptance 6)', () => {
  it('leaves the person\'s records identical across a demo on/off cycle', async () => {
    const before = JSON.stringify(ownRecords());
    const { unmount } = await mount();

    act(() => {
      expect(storeRef!.loadDemoPersona('short-term-host')).toBe(true);
    });
    expect(storeRef!.demoActive).toBe(true);
    expect(storeRef!.demoPersonaId).toBe('short-term-host');
    // The screen really did change — otherwise "unchanged" would be a vacuous pass.
    expect(JSON.stringify(storeRef!.revenues)).not.toBe(JSON.stringify(seedData.revenues));

    act(() => {
      storeRef!.unloadDemoPersona();
    });
    expect(storeRef!.demoActive).toBe(false);
    expect(storeRef!.demoPersonaId).toBeNull();
    expect(JSON.stringify(storeRef!.profile)).toBe(JSON.stringify(seedData.profile));
    expect(JSON.stringify(storeRef!.revenues)).toBe(JSON.stringify(seedData.revenues));
    expect(JSON.stringify(storeRef!.expenses)).toBe(JSON.stringify(seedData.expenses));
    expect(JSON.stringify(storeRef!.clients)).toBe(JSON.stringify(seedData.clients));
    expect(JSON.stringify(storeRef!.occupancySheets)).toBe(JSON.stringify(seedData.occupancySheets));

    unmount();
    expect(JSON.stringify(ownRecords())).toBe(before);
  });

  it('never lets a record created during a demo reach the person\'s data', async () => {
    const { unmount } = await mount();
    const idsBefore = seedData.revenues.map(r => r.id);

    act(() => {
      storeRef!.loadDemoPersona('long-term-landlord');
    });
    act(() => {
      storeRef!.addRevenue({
        tip: 'factura',
        nr: 'DEMO-ONLY-001',
        date: '2026-05-05',
        client: 'Nu e a mea',
        cui: '1234567890123',
        valoareFaraTva: 100000 as never,
        tva: 0 as never,
        status: 'inregistrata',
      });
    });
    const demoIds = storeRef!.revenues.map(r => r.id);
    expect(demoIds).not.toEqual(idsBefore);

    act(() => {
      storeRef!.unloadDemoPersona();
    });
    // The demo invoice is gone, and no demo record was merged into the person's register.
    expect(storeRef!.revenues.map(r => r.id)).toEqual(idsBefore);
    expect(storeRef!.revenues.some(r => r.nr === 'DEMO-ONLY-001')).toBe(false);

    unmount();
  });

  it('does not rewrite the stored bytes while a demo is on screen', async () => {
    const { unmount } = await mount();
    // Read the bytes AFTER mount: the store re-persists a 'persisted' payload on load, which normalises key
    // order. That write is the app's own and predates B-134; what must not happen is a SECOND write, of the
    // demo's records, into the person's key.
    const settled = persistedBytes();

    act(() => {
      storeRef!.loadDemoPersona('short-term-host');
    });
    act(() => {
      storeRef!.addRevenue({
        tip: 'factura',
        nr: 'DEMO-ONLY-002',
        date: '2026-06-06',
        client: 'Nici aceasta',
        cui: '1234567890123',
        valoareFaraTva: 100000 as never,
        tva: 0 as never,
        status: 'inregistrata',
      });
    });

    expect(persistedBytes()).toBe(settled);
    expect(persistedBytes()).not.toContain('DEMO-ONLY-002');

    act(() => {
      storeRef!.unloadDemoPersona();
    });
    expect(persistedBytes()).toBe(settled);
    unmount();
  });
});

describe('the demo state survives a reload (B-134, acceptance 5)', () => {
  it('restores the demo and reports it on the first render after a reload', async () => {
    const first = await mount();
    act(() => {
      storeRef!.loadDemoPersona('short-term-host');
    });
    expect(JSON.parse(localStorage.getItem(DEMO_MODE_STORAGE_KEY) ?? '{}')).toEqual({
      personaId: 'short-term-host',
    });
    first.unmount();

    // A reload: a new provider over the same storage. No helper is called by hand.
    const second = await mount();
    expect(second.container).toBeDefined();
    expect(storeRef!.demoActive).toBe(true);
    expect(storeRef!.demoPersonaId).toBe('short-term-host');
    expect(storeRef!.demoPersonaLabel).toBe(personaById('short-term-host')!.label);
    // What is on screen is the persona's data, and the person's own bytes are still theirs underneath.
    expect(JSON.stringify(storeRef!.revenues)).toBe(JSON.stringify(personaById('short-term-host')!.data.revenues));
    expect(JSON.parse(persistedBytes()!).revenues.map((r: { id: string }) => r.id))
      .toEqual(seedData.revenues.map(r => r.id));

    // Switching back from a restored demo returns the person's own records, not an empty store.
    act(() => {
      storeRef!.unloadDemoPersona();
    });
    expect(storeRef!.demoActive).toBe(false);
    expect(storeRef!.revenues.map(r => r.id)).toEqual(seedData.revenues.map(r => r.id));
    second.unmount();
  });

  it('opens on the person\'s own data when the remembered persona no longer exists', async () => {
    localStorage.setItem(DEMO_MODE_STORAGE_KEY, JSON.stringify({ personaId: 'persona-from-a-future-build' }));
    await mount();
    expect(storeRef!.demoActive).toBe(false);
    expect(storeRef!.demoPersonaId).toBeNull();
    expect(storeRef!.revenues.map(r => r.id)).toEqual(seedData.revenues.map(r => r.id));
    expect(localStorage.getItem(DEMO_MODE_STORAGE_KEY)).toBeNull();
  });

  it('does not restore a demo over a first run', async () => {
    localStorage.clear();
    localStorage.setItem(DEMO_MODE_STORAGE_KEY, JSON.stringify({ personaId: 'short-term-host' }));
    await mount();
    // Empty storage is a first run; a demo over it is the D1 defect this project already closed.
    expect(storeRef!.dataOrigin).toBe('empty');
    expect(storeRef!.demoActive).toBe(false);
  });

  it('forgets the demo when the person wipes their data', async () => {
    const first = await mount();
    act(() => {
      storeRef!.loadDemoPersona('short-term-host');
    });
    act(() => {
      storeRef!.resetAllData();
    });
    expect(localStorage.getItem(DEMO_MODE_STORAGE_KEY)).toBeNull();
    first.unmount();

    await mount();
    expect(storeRef!.demoActive).toBe(false);
    expect(storeRef!.dataOrigin).toBe('empty');
  });
});
