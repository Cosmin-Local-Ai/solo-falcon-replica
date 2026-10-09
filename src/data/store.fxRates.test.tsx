/**
 * TASK 10b — the store is the door a rate comes through (defect B-33).
 *
 * The rate layer refuses to invent a rate, so a rate only exists because it was recorded, and the
 * provisional → final lifecycle needs a place to happen. That place is the store, keyed by `rateKey`
 * (currency, kind, date-or-year) — the same key `RateStore.replace` and `loadDailyRates` use, so the
 * store, the in-memory cache and the persisted payload cannot hold two records for one anchor.
 *
 * This is manual/store ingress, not a network path: the brief's „no new network path, no crawler, no
 * scheduler" ruled out fetching from the internet, and nothing here fetches.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { StoreProvider, useStore, STORAGE_KEY } from './store';
import { selectEstimateOperands } from '../domain/estimateBasis';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../domain/fiscal';
import { seedData } from './seed';
import type { AppData, Expense } from './types';
import { majorToMinor, money, type Bani } from '../domain/money';
import type { FxRateRecord } from '../domain/fx/rates';

let storeRef: ReturnType<typeof useStore> | null = null;
function Probe() {
  storeRef = useStore();
  return null;
}

const usd = (major: number) => money(majorToMinor(major, 'USD'), 'USD');

/** TEST SCAFFOLDING, not a BNR figure — see `fx/ledger.test.ts`. The USD daily path is real. */
const USD_DAILY: FxRateRecord = {
  currency: 'USD', rate: '4.5000', rateKind: 'daily_reference', rateDate: '2026-10-08',
  seriesCode: 'CURSZ_USD-PATTERN', sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
  fetchedAt: '2026-10-08T13:05:00Z', provisional: false, entryMode: 'fetched',
};

/** TEST SCAFFOLDING — no FY2026 average is published; this is the provisional half of the lifecycle. */
const EUR_ANNUAL_2026_PROVISIONAL: FxRateRecord = {
  currency: 'EUR', rate: '5.3100', rateKind: 'annual_average', rateYear: 2026,
  seriesCode: 'CURSA_EURM-TEST', sourceUrl: 'https://example.invalid/hand-entered-test-average',
  fetchedAt: '2026-10-09T09:00:00Z', provisional: true, entryMode: 'manual',
};

/** TEST SCAFFOLDING — the same anchor after „BNR published it". */
const EUR_ANNUAL_2026_FINAL: FxRateRecord = {
  ...EUR_ANNUAL_2026_PROVISIONAL, rate: '5.4000', provisional: false, fetchedAt: '2027-01-15T09:00:00Z',
};

function expense(over: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-usd',
    tip: 'factura',
    nr: 'FCT-USD-1',
    date: '2026-10-08',
    furnizor: 'Furnizor Test',
    cui: 'RO00000000',
    valoareFaraTva: usd(100),
    tva: usd(19),
    status: 'inregistrata',
    category: 'postal_and_telecom',
    ...over,
  };
}

function basePayload(): Omit<AppData, 'fxRates'> {
  return {
    reservedAmount: null,
    profile: seedData.profile,
    revenues: [],
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

function load() {
  render(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  );
}

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

describe('recordFxRate — the store is where a rate becomes a fact', () => {
  it('records a rate, writes it to the bytes, and reloads it unchanged', () => {
    writePayload();
    load();
    expect(storeRef!.fxRates).toBeUndefined();

    act(() => storeRef!.recordFxRate(USD_DAILY));
    expect(storeRef!.fxRates).toHaveLength(1);
    // On the bytes, not only in memory — a rate the user typed by hand must survive a reload.
    expect(persisted().fxRates).toEqual([USD_DAILY]);

    storeRef = null;
    load();
    expect(storeRef!.fxRates).toEqual([USD_DAILY]);
  });

  it('replaces by rateKey, so a provisional FY2026 average becomes final in place', () => {
    writePayload();
    load();
    act(() => storeRef!.recordFxRate(EUR_ANNUAL_2026_PROVISIONAL));
    expect(storeRef!.fxRates).toHaveLength(1);
    expect(storeRef!.fxRates![0].provisional).toBe(true);

    // Same currency, same kind, same year — so the final record overwrites the provisional one rather
    // than sitting beside it. Two records for one anchor would let a stale average keep being used.
    act(() => storeRef!.recordFxRate(EUR_ANNUAL_2026_FINAL));
    expect(storeRef!.fxRates).toHaveLength(1);
    expect(storeRef!.fxRates![0].provisional).toBe(false);
    expect(storeRef!.fxRates![0].rate).toBe('5.4000');
    expect(persisted().fxRates).toEqual([EUR_ANNUAL_2026_FINAL]);
  });

  it('keeps a daily rate and an annual average for one currency apart — they are different anchors', () => {
    writePayload();
    load();
    act(() => storeRef!.recordFxRate({ ...USD_DAILY, rateKind: 'annual_average', rateDate: undefined, rateYear: 2025 }));
    act(() => storeRef!.recordFxRate(USD_DAILY));
    expect(storeRef!.fxRates).toHaveLength(2);
  });

  it('refuses an unusable rate, says which field is wrong, and stores nothing', () => {
    writePayload();
    load();
    const noSource = { ...USD_DAILY, sourceUrl: '' };
    let result: { ok: boolean; problems?: string[] } | undefined;
    act(() => {
      result = storeRef!.recordFxRate(noSource);
    });
    expect(result!.ok).toBe(false);
    expect(result!.problems!.join(' ')).toContain('sourceUrl');
    expect(storeRef!.fxRates ?? []).toHaveLength(0);
    expect(persisted().fxRates).toBeUndefined();
    // The refusal is said out loud: a rate that vanishes is indistinguishable from one never entered.
    expect(storeRef!.toasts.some(t => t.text.includes('Cursul de schimb nu a fost salvat'))).toBe(true);
  });

  it('refuses a rate that is not a positive decimal, rather than coercing it', () => {
    writePayload();
    load();
    let result: { ok: boolean; problems?: string[] } | undefined;
    act(() => {
      result = storeRef!.recordFxRate({ ...USD_DAILY, rate: '4,5000' });
    });
    expect(result!.ok).toBe(false);
    expect(storeRef!.fxRates ?? []).toHaveLength(0);
  });

  it('a rate recorded here is the rate the estimate reads — the door and the consumer are the same store', () => {
    // 100,00 USD × 4,5000 = 450,00 lei. Nothing fetches; the store is the whole ingress.
    writePayload({ expenses: [expense()] });
    load();
    const before = selectEstimateOperands(
      { ...basePayload(), expenses: [expense()] } as AppData,
      '2026-12-31',
      PFA_2026_SYSTEM_REAL_PACKAGE,
    );
    expect(before.kind === 'run' && before.deductible.counts.foreignCurrency).toBe(1);

    act(() => storeRef!.recordFxRate(USD_DAILY));
    const after = selectEstimateOperands(
      { ...basePayload(), expenses: [expense()], fxRates: storeRef!.fxRates } as AppData,
      '2026-12-31',
      PFA_2026_SYSTEM_REAL_PACKAGE,
    );
    expect(after.kind).toBe('run');
    if (after.kind !== 'run') return;
    expect(after.deductible.counts.foreignCurrency).toBe(0);
    expect(after.amounts.expensesNet).toBe(45000 as Bani);
    expect(after.conversions[0].seriesCode).toBe('CURSZ_USD-PATTERN');
  });
});
