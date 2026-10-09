/**
 * TASK 3 — the tax reserve is persisted, and persistence is the whole point of the task.
 *
 * The acceptance criteria pinned here:
 *  1. enter a reserve → reload → the same value (the round trip the user actually cares about);
 *  2. a payload with NO reserve field loads as `null`, not `0`;
 *  3. `null` („no reserve recorded”) and `0` („recorded nothing”) survive a save and a load as
 *     different facts — nothing on either path is allowed to collapse them;
 *  4. clearing is explicit and writes `null`, never `0`.
 *
 * No figure here is read off a diff: 1.050,00 lei = 105.000 bani, 25.000 bani = 250,00 lei.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { StoreProvider, useStore, STORAGE_KEY } from './store';
import { CURRENT_DATA_VERSION, DATA_VERSION_EXPENSE_CATEGORY } from './migration';
import { seedData } from './seed';
import type { AppData, Revenue } from './types';
import { lei, type Bani } from '../domain/money';

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

function basePayload(): AppData {
  return {
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
}

function writePayload(overrides: Record<string, unknown> = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...basePayload(), ...overrides }));
}

/** Write the same payload with the `reservedAmount` key genuinely absent — the pre-v7 shape. */
function writePayloadWithoutReserve(version: number) {
  const { reservedAmount: _reservedAmount, ...without } = basePayload();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...without, version }));
}

function load() {
  render(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  );
}

/** The bytes the save effect actually put back into localStorage. */
function persisted(): Record<string, unknown> {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Record<string, unknown>;
}

beforeEach(() => {
  localStorage.clear();
  storeRef = null;
});

afterEach(() => {
  localStorage.clear();
});

describe('the recorded reserve survives a reload (acceptance: enter → reload → same value)', () => {
  it('records a reserve, writes it to storage, and reloads the identical amount', () => {
    writePayload();
    load();
    expect(storeRef!.dataOrigin).toBe('persisted');
    expect(storeRef!.reservedAmount).toBeNull();

    // Enter a reserve: 1.050,00 lei = 105.000 bani.
    act(() => storeRef!.setReservedAmount(lei(1050)));
    expect(storeRef!.reservedAmount).toBe(lei(1050));
    // It is on the bytes, not only in memory — and it is stored as bani, never as lei.
    expect(persisted().reservedAmount).toBe(105000);
    expect(persisted().version).toBe(CURRENT_DATA_VERSION);

    // Reload: a fresh provider reads the same localStorage. The value must come back unchanged.
    storeRef = null;
    load();
    expect(storeRef!.dataOrigin).toBe('persisted');
    expect(storeRef!.reservedAmount).toBe(lei(1050));
  });

  it('keeps an explicit 0 lei reserve across a reload, as 0 and not as null', () => {
    writePayload();
    load();
    act(() => storeRef!.setReservedAmount(lei(0)));
    expect(persisted().reservedAmount).toBe(0);

    storeRef = null;
    load();
    expect(storeRef!.reservedAmount).toBe(lei(0));
    expect(storeRef!.reservedAmount).not.toBeNull();
  });

  it('clearing the reserve records null again — it never falls back to 0', () => {
    writePayload({ reservedAmount: lei(1050) });
    load();
    expect(storeRef!.reservedAmount).toBe(lei(1050));

    act(() => storeRef!.setReservedAmount(null));
    expect(persisted().reservedAmount).toBeNull();

    storeRef = null;
    load();
    expect(storeRef!.reservedAmount).toBeNull();
  });
});

describe('a payload with no reserve field loads as null, not 0', () => {
  it('loads a current-version payload that simply omits the field', () => {
    writePayloadWithoutReserve(CURRENT_DATA_VERSION);

    load();
    expect(storeRef!.dataOrigin).toBe('persisted');
    expect(storeRef!.reservedAmount).toBeNull();
    expect(storeRef!.reservedAmount).not.toBe(0);
  });

  // The migration half of the same promise: a v6 payload goes through the `tax-reserve` step, which
  // backfills nothing, and the load path still resolves the absence to `null`.
  it('loads a pre-v7 payload through the chain and still reports null', () => {
    writePayloadWithoutReserve(DATA_VERSION_EXPENSE_CATEGORY);

    load();
    expect(storeRef!.dataOrigin).toBe('persisted');
    expect(storeRef!.migration!.stepsApplied).toEqual(['tax-reserve', 'pension-facts']);
    expect(storeRef!.reservedAmount).toBeNull();
    // And the next write stamps the current version — the upgrade is one-way and additive.
    expect(persisted().version).toBe(CURRENT_DATA_VERSION);
  });

  it('starts from the seed with no reserve recorded when there is no stored payload at all', () => {
    load();
    expect(storeRef!.dataOrigin).toBe('seed');
    expect(storeRef!.reservedAmount).toBeNull();
  });
});

describe('the store never invents a reserve', () => {
  it('clamps a negative amount at 0 instead of storing a negative reserve', () => {
    writePayload();
    load();
    act(() => storeRef!.setReservedAmount(-1 as Bani));
    expect(storeRef!.reservedAmount).toBe(lei(0));
    expect(persisted().reservedAmount).toBe(0);
  });

  it('leaves an unrecorded reserve untouched until the user records one', () => {
    writePayload();
    load();
    expect(storeRef!.reservedAmount).toBeNull();
    // No mutation, only a save cycle: the state must still be „no reserve recorded”.
    act(() => storeRef!.updateProfile({ salaryStatus: 'da' }));
    expect(storeRef!.reservedAmount).toBeNull();
    expect(persisted().reservedAmount).toBeNull();
  });
});
