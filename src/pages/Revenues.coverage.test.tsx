/**
 * PG-1 acceptance 2, revenue side — a revenue the estimate cannot describe says so on its own row.
 *
 * The revenue half of the coverage comes from the Phase 10c ledger disclosure, not from a second walk
 * of the register: the page reads `getLedgerDisclosure`, the same pass the dashboard's money surfaces
 * read. That is pinned here as well as in `dashboard.coverage.test.ts`, because the temptation this
 * file exists to resist is a local `revenues.filter(r => r.valoareFaraTva.currency !== 'RON')` — a
 * second answer to one question, and the first one to drift.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Revenues from './Revenues';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import type { Revenue } from '../data/types';
import { eur, ron, type Bani } from '../domain/money';
import { pinClock, unpinClock } from '../test/clock';
import { fixedInstant } from '../test/fixedInstant';

const STORAGE_KEY = 'pfa-app-data-v2';

function revenue(over: Partial<Revenue> = {}): Revenue {
  return {
    id: over.id ?? 'cov-rev',
    tip: 'factura',
    nr: 'FCT-2026-900',
    date: '2026-05-12',
    client: 'Client Test SRL',
    cui: 'RO99999998',
    valoareFaraTva: ron(1500),
    tva: ron(285),
    status: 'inregistrata',
    ...over,
  };
}

function seedWith(revenues: Revenue[], extra: Record<string, unknown> = {}) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...seedData,
      revenues: [...seedData.revenues, ...revenues],
      version: CURRENT_DATA_VERSION,
      ...extra,
    }),
  );
}

/** The EUR row research 23 captured from BNR for 2026-10-08 — a real published figure. */
const EUR_DAILY_2026_10_08 = {
  currency: 'EUR' as const,
  rate: '5.3470',
  rateKind: 'daily_reference' as const,
  rateDate: '2026-10-08',
  seriesCode: 'CURSZ_EUR',
  sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
  fetchedAt: '2026-10-08T13:05:00Z',
  provisional: false,
  entryMode: 'fetched' as const,
};

function noteFor(recordId: string): string | null {
  const row = document.querySelector(`tr[data-record-id="${recordId}"]`);
  return row?.querySelector('[data-not-in-estimate]')?.textContent ?? null;
}

describe('Revenues register — the per-record coverage note', () => {
  beforeEach(() => {
    localStorage.clear();
    pinClock(fixedInstant());
  });
  afterEach(() => {
    cleanup();
    unpinClock();
    localStorage.clear();
  });

  it('a EUR revenue with no recorded rate says the rate is missing, on its own row', () => {
    seedWith([
      revenue({
        id: 'cov-rev-eur',
        nr: 'FCT-FX-900',
        valoareFaraTva: { amount: 500000 as Bani, currency: 'EUR' },
        tva: { amount: 0 as Bani, currency: 'EUR' },
      }),
    ]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    expect(noteFor('cov-rev-eur')).toBe('nu intră în estimare: fără curs BNR înregistrat');
    expect(screen.getByText('FCT-FX-900')).toBeInTheDocument();
  });

  it('a lei revenue carries no note — it is in the figure', () => {
    seedWith([revenue({ id: 'cov-rev-ron', nr: 'FCT-RON-900' })]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    expect(noteFor('cov-rev-ron')).toBeNull();
    expect(screen.getByText('FCT-RON-900')).toBeInTheDocument();
  });

  it('a converted revenue carries no note: the rate was recorded, so it entered the lei totals', () => {
    seedWith(
      [
        revenue({
          id: 'cov-rev-conv',
          nr: 'FCT-FX-901',
          date: '2026-10-08',
          valoareFaraTva: { amount: 100000 as Bani, currency: 'EUR' },
          tva: { amount: 0 as Bani, currency: 'EUR' },
        }),
      ],
      { fxRates: [EUR_DAILY_2026_10_08] },
    );
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    expect(noteFor('cov-rev-conv')).toBeNull();
    expect(screen.getByText('FCT-FX-901')).toBeInTheDocument();
  });
});
