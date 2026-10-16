/**
 * Phase 11 / PG-3 — the sandbox and the reset, in Settings.
 *
 * Before this phase there was no "start from scratch" path anywhere in the UI: the demo dataset WAS the
 * initial state, and the only way out was to delete each record by hand. Two controls close that, and both
 * have a failure mode worth pinning:
 *  - loading the sandbox must be **lossless for real data** (PG-3's acceptance), so the sandbox lives in
 *    memory and the save effect refuses to write while it is active;
 *  - the reset must land the user back on **onboarding**, not on the fixture — a reset that hands out demo
 *    records is the D1 defect wearing a confirmation dialog.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StoreProvider, STORAGE_KEY, useStore } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import { seedStorage } from '../test/storage';
import { settings as t } from '../ui/copy';
import Settings from './Settings';
import App from '../App';

let store: ReturnType<typeof useStore> | null = null;
function Probe() {
  store = useStore();
  return null;
}

/** A payload that is NOT the fixture, so "the sandbox did not touch my data" is a real assertion. */
function writeUserData() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      reservedAmount: null,
      profile: { ...seedData.profile, identity: { ...seedData.profile.identity, nume: 'Mine Real' } },
      revenues: [
        {
          id: 'mine-1',
          tip: 'factura',
          nr: 'FCT-MINE-1',
          date: '2026-06-01',
          client: 'Client al meu',
          // B110: was `RO00000001`, whose control digit is valid under both published CUI key
          // variants. `RO00000002` fails the check digit, so this stored payload cannot carry a real
          // registered number. The value is not asserted; only the record's presence is.
          cui: 'RO00000002',
          valoareFaraTva: { amount: 100_000, currency: 'RON' },
          tva: { amount: 19_000, currency: 'RON' },
          status: 'inregistrata',
        },
      ],
      expenses: [],
      clients: [],
      declarations: [],
      documents: [],
      companyDocs: { im: [], cs: [], tva: [], facturi: [] },
      statements: [],
      snapshots: [],
      settings: seedData.settings,
      version: CURRENT_DATA_VERSION,
    }),
  );
}

function openDataTab() {
  fireEvent.click(screen.getByRole('button', { name: t.tabs.data }));
}

beforeEach(() => {
  localStorage.clear();
  store = null;
});

afterEach(() => {
  localStorage.clear();
});

describe('Settings — the demo sandbox', () => {
  it('loads the fixture without touching the stored payload, and restores it on unload', () => {
    writeUserData();
    render(
      <StoreProvider>
        <Settings />
        <Probe />
      </StoreProvider>,
    );
    openDataTab();
    // Snapshot the payload AFTER mount: the save effect re-serialises what it loaded, so the bytes on disk
    // are the store's own output from here on. Comparing against the pre-mount string would measure the
    // serialiser, not the sandbox.
    const before = localStorage.getItem(STORAGE_KEY);

    fireEvent.click(screen.getByRole('button', { name: t.data.sandboxLoad }));

    expect(store!.dataOrigin).toBe('sandbox');
    expect(store!.revenues).toHaveLength(seedData.revenues.length);
    // Lossless: nothing was written while the sandbox was on screen.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);

    fireEvent.click(screen.getByRole('button', { name: t.data.sandboxUnload }));

    expect(store!.dataOrigin).toBe('persisted');
    expect(store!.revenues).toHaveLength(1);
    expect(store!.revenues[0].nr).toBe('FCT-MINE-1');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  });

  it('states where the data on screen came from', () => {
    writeUserData();
    render(
      <StoreProvider>
        <Settings />
        <Probe />
      </StoreProvider>,
    );
    openDataTab();
    expect(screen.getByText(t.data.originPersisted)).toBeInTheDocument();
  });
});

describe('Settings — „Șterge toate datele și începe de la zero”', () => {
  it('asks for confirmation before it destroys anything', () => {
    writeUserData();
    render(
      <StoreProvider>
        <Settings />
        <Probe />
      </StoreProvider>,
    );
    openDataTab();

    fireEvent.click(screen.getByRole('button', { name: t.data.dangerAction }));
    // The dialog is up; the data is still there.
    expect(screen.getByText(t.data.confirmTitle)).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: t.data.confirmCancel }));
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(store!.dataOrigin).toBe('persisted');
  });

  it('clears storage and returns the store to the first-run state, not to the fixture', () => {
    writeUserData();
    render(
      <StoreProvider>
        <Settings />
        <Probe />
      </StoreProvider>,
    );
    openDataTab();

    fireEvent.click(screen.getByRole('button', { name: t.data.dangerAction }));
    fireEvent.click(screen.getByRole('button', { name: t.data.confirmGo }));

    expect(store!.dataOrigin).toBe('empty');
    expect(store!.revenues).toEqual([]);
    expect(store!.profile.identity.nume).toBe('');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('lands on onboarding, not on a dashboard full of demo records', () => {
    writeUserData();
    render(<App />);

    // Reach Settings through the sidebar, the way a person would. The accessible name carries the nav
    // icon glyph, so the match is a substring rather than an anchored one.
    fireEvent.click(screen.getByRole('link', { name: /Setări/ }));
    openDataTab();
    fireEvent.click(screen.getByRole('button', { name: t.data.dangerAction }));
    fireEvent.click(screen.getByRole('button', { name: t.data.confirmGo }));

    // The first-run screen is what is on screen now.
    expect(screen.getByRole('heading', { name: 'Bine ai venit' })).toBeInTheDocument();
    // And the demo strings are gone from the chrome — no fixture name in the topbar.
    expect(screen.queryByText('Dobre Radu')).toBeNull();
    expect(screen.queryByText('FCT-2026-001')).toBeNull();
  });
});
