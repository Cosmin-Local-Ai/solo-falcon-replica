import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { StoreProvider, useStore } from './store';
import { seedData } from './seed';
import type { Client, Declaration, LegacyAppData, LegacyExpense, LegacyRevenue } from './types';
import { lei } from '../domain/money';

/**
 * Phase 6 data-loss regression (docs/ai/phases/06_fiscal_profile.md §4).
 *
 * `pfaProfileSchema` used to declare every profile field as required. Because
 * `src/data/schema.ts` validates the whole persisted payload and `store.tsx` answers ANY
 * invalid payload by replacing the entire dataset with `seedData` — silently — adding a
 * *required* profile field would have destroyed every user's revenues, expenses, clients
 * and declarations with no message. Phase 6 adds `pfaStartDate` and `salaryIncomeLei`, so
 * this file pins the opposite behaviour: a payload written BEFORE Phase 6 must still load,
 * with the collections non-empty. "The app rendered" is not enough — the collections are
 * what is lost.
 */

// Must match STORAGE_KEY in src/data/store.tsx (module-private, not exported).
const STORAGE_KEY = 'pfa-app-data-v2';

let storeRef: ReturnType<typeof useStore> | null = null;
function Probe() {
  storeRef = useStore();
  return null;
}

const revenues: LegacyRevenue[] = [
  {
    id: 'r-legacy-1',
    tip: 'factura',
    nr: 'FCT-2026-001',
    date: '2026-02-10',
    client: 'Presta Consulting SRL',
    cui: 'RO12345678',
    valoareFaraTva: lei(18000),
    tva: lei(3420),
    status: 'inregistrata',
  },
  {
    id: 'r-legacy-2',
    tip: 'notafactura',
    nr: 'INC-2026-002',
    date: '2026-05-04',
    client: 'Nord Digital SRL',
    cui: 'RO87654321',
    valoareFaraTva: lei(6000),
    tva: lei(1140),
    status: 'inregistrata',
  },
];

const expenses: LegacyExpense[] = [
  {
    id: 'e-legacy-1',
    tip: 'factura',
    nr: 'CH-2026-001',
    date: '2026-03-01',
    furnizor: 'Biroux SRL',
    cui: 'RO11111111',
    valoareFaraTva: lei(2500),
    tva: lei(475),
    status: 'inregistrata',
  },
];

const clients: Client[] = [{ id: 'c-legacy-1', denumire: 'Presta Consulting SRL', cui: 'RO12345678' }];

const declarations: Declaration[] = [
  {
    id: 'd-legacy-1',
    an: 2026,
    luna: 3,
    venituri: lei(18000),
    cheltuieli: lei(2500),
    status: 'inregistrata',
    dataInregistrare: '2026-04-10T10:00:00.000Z',
  },
];

/**
 * The payload exactly as the app wrote it BEFORE Phase 6: the profile has no
 * `pfaStartDate` and no `salaryIncomeLei` key at all (JSON.stringify drops undefined,
 * so an absent key is what a real pre-Phase-6 payload looks like on disk).
 */
function legacyPayload(): Record<string, unknown> {
  const { pfaStartDate, salaryIncomeLei, ...prePhase6Profile } = seedData.profile;
  void pfaStartDate;
  void salaryIncomeLei;
  const base: LegacyAppData = {
    reservedAmount: null,
    profile: prePhase6Profile,
    revenues,
    expenses,
    clients,
    declarations,
    documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] },
    statements: [],
    snapshots: [],
    settings: seedData.settings,
  };
  return JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
}

function load(): void {
  render(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  storeRef = null;
});

afterEach(() => {
  localStorage.clear();
});

describe('pre-Phase-6 profile payload still loads (data-loss trap)', () => {
  it('has no pfaStartDate / salaryIncomeLei keys, so it really is the old shape', () => {
    const payload = legacyPayload() as { profile: Record<string, unknown> };
    expect('pfaStartDate' in payload.profile).toBe(false);
    expect('salaryIncomeLei' in payload.profile).toBe(false);
  });

  it('loads as persisted, not as seed', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyPayload()));
    load();
    expect(storeRef!.dataOrigin).toBe('persisted');
  });

  it('keeps every collection non-empty and byte-identical to what was stored', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyPayload()));
    load();
    expect(storeRef!.revenues).toHaveLength(2);
    expect(storeRef!.expenses).toHaveLength(1);
    expect(storeRef!.clients).toHaveLength(1);
    expect(storeRef!.declarations).toHaveLength(1);
    expect(storeRef!.revenues.map(r => r.id)).toEqual(['r-legacy-1', 'r-legacy-2']);
    expect(storeRef!.expenses[0].id).toBe('e-legacy-1');
    expect(storeRef!.clients[0].id).toBe('c-legacy-1');
    expect(storeRef!.declarations[0].id).toBe('d-legacy-1');
    // The seed fallback would have replaced all of the above — prove it did not.
    expect(storeRef!.revenues).not.toEqual(seedData.revenues);
    expect(storeRef!.expenses).not.toEqual(seedData.expenses);
  });

  it('leaves the new optional profile fields absent rather than inventing values', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyPayload()));
    load();
    expect(storeRef!.profile.pfaStartDate).toBeUndefined();
    expect(storeRef!.profile.salaryIncomeLei).toBeUndefined();
    // TASK 5: none of the pension facts is invented on the way in either.
    expect(storeRef!.profile.pensionReceiptYears).toBeUndefined();
    expect(storeRef!.profile.pensionSuspensionYears).toBeUndefined();
    expect(storeRef!.profile.cassPreviousYearContext).toBeUndefined();
    expect(storeRef!.profile.foreignSicknessInsurance).toBeUndefined();
    // Everything the old payload carried is untouched.
    expect(storeRef!.profile.regime).toBe(seedData.profile.regime);
    expect(storeRef!.profile.caen).toBe(seedData.profile.caen);
  });

  // TASK 5 acceptance: an old record still renders, and its pension status survives the rename without
  // acquiring a legal conclusion it never recorded.
  it('loads an old record that carries the pre-v8 `pensionStatus` key, renames it and invents no receipt fact', () => {
    const payload = legacyPayload();
    const profile = payload.profile as Record<string, unknown>;
    delete profile.pensionerStatus;
    profile.pensionStatus = 'da';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    load();
    // Not quarantined, not reset to seed: the old record still loads and still renders.
    expect(storeRef!.profile.id).toBe(seedData.profile.id);
    expect(storeRef!.profile.pensionerStatus).toBe('da');
    expect(storeRef!.profile.pensionStatus).toBeUndefined();
    expect(storeRef!.profile.pensionReceiptYears).toBeUndefined();
    expect(storeRef!.revenues.map((r) => r.id)).toEqual(['r-legacy-1', 'r-legacy-2']);
  });

  it('survives a reload after the store has re-persisted the loaded payload', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyPayload()));
    load();
    const repersisted = localStorage.getItem(STORAGE_KEY)!;
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, repersisted);
    storeRef = null;
    load();
    expect(storeRef!.dataOrigin).toBe('persisted');
    expect(storeRef!.revenues).toHaveLength(2);
  });
});

describe('Phase 6 profile fields are accepted when present', () => {
  it('loads pfaStartDate and salaryIncomeLei from storage', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...legacyPayload(),
        profile: {
          ...(legacyPayload() as { profile: Record<string, unknown> }).profile,
          pfaStartDate: '2026-04-01',
          // This is a RAW persisted payload written straight to localStorage, so it is deliberately
          // still in the OLD lei scale — the v4->v5 money step is what scales it. Wrapping it in lei()
          // here would be a double conversion (30000 -> 3 000 000 -> 300 000 000).
          salaryIncomeLei: 30000,
        },
      }),
    );
    load();
    expect(storeRef!.dataOrigin).toBe('persisted');
    expect(storeRef!.profile.pfaStartDate).toBe('2026-04-01');
    // migrated: 30 000 lei -> 3 000 000 bani
  expect(storeRef!.profile.salaryIncomeLei).toBe(lei(30000));
    expect(storeRef!.revenues).toHaveLength(2);
  });

  it('rejects a malformed pfaStartDate instead of accepting it silently', () => {
    // Proves the profile really is validated: this is the mechanism that made the
    // required-field change catastrophic, so optional-ness must be deliberate.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...legacyPayload(),
        profile: {
          ...(legacyPayload() as { profile: Record<string, unknown> }).profile,
          pfaStartDate: '01.04.2026',
        },
      }),
    );
    load();
    // D-3: an invalid payload is preserved under the quarantine key instead of
    // being dropped on the floor, and the store says which recovery happened.
    expect(storeRef!.dataOrigin).toBe('quarantined');
    // Phase 11: the recovery target is an EMPTY dataset, not the demo fixture.
    expect(storeRef!.revenues).toEqual([]);
  });

  it('rejects a negative salaryIncomeLei', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...legacyPayload(),
        profile: {
          ...(legacyPayload() as { profile: Record<string, unknown> }).profile,
          salaryIncomeLei: lei(-1),
        },
      }),
    );
    load();
    expect(storeRef!.dataOrigin).toBe('quarantined');
  });

  it('accepts the regimes the union allows, so an old payload is never discarded', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...legacyPayload(),
        profile: {
          ...(legacyPayload() as { profile: Record<string, unknown> }).profile,
          regime: 'norma_venit',
        },
      }),
    );
    load();
    expect(storeRef!.dataOrigin).toBe('persisted');
    expect(storeRef!.profile.regime).toBe('norma_venit');
    // Data preserved even though the regime cannot be computed — refusal happens in the
    // engine (REVIEW_REQUIRED), never by deleting the user's data.
    expect(storeRef!.revenues).toHaveLength(2);
  });
});
