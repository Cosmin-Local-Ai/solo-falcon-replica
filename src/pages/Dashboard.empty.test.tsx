/**
 * Phase 11 / PG-3 — the dashboard with nothing in it, and the B-68 gate.
 *
 * B-68 is the standing name for the class of bug this file exists to keep dead: `Dashboard.tsx` once gated
 * the whole page on `pfaRevenue > 0`, so a ledger that EXISTS but is EXCLUDED rendered the
 * "go and record something" card and took the deadlines, thresholds and completeness card down with it.
 * The lesson is not "add another term to the condition" — it is "stop inferring existence from an
 * aggregate". Every case below is a different way for a record to be present and still absent from the
 * totals.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import { pinClock, unpinClock } from '../test/clock';
import type { AppData } from '../data/types';
import type { Bani } from '../domain/money';
import Dashboard from './Dashboard';

const STORAGE_KEY = 'pfa-app-data-v2';

function writePayload(overrides: Record<string, unknown> = {}) {
  const base: AppData = {
    reservedAmount: null,
    profile: seedData.profile,
    revenues: [],
    expenses: [],
    clients: [],
    filings: [],
    occupancySheets: [],
    documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] },
    statements: [],
    snapshots: [],
    settings: seedData.settings,
  };
  // The version is stamped on the PAYLOAD, not carried on `AppData` — that is how the load path tells a
  // current write from a legacy one, and it is why these fixtures run no migration step.
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...base, version: CURRENT_DATA_VERSION, ...overrides }));
}

function renderDashboard() {
  return render(
    <StoreProvider>
      <Dashboard />
    </StoreProvider>,
  );
}

/** A registered RON revenue dated OUTSIDE the profile's fiscal year: real, and excluded from every total. */
function outOfPeriodRevenue() {
  return {
    id: 'r-old',
    tip: 'factura',
    nr: 'FCT-OLD-1',
    date: '2025-05-01',
    client: 'Client Vechi SRL',
    cui: 'RO12345678',
    valoareFaraTva: { amount: 50_000 as Bani, currency: 'RON' },
    tva: { amount: 0 as Bani, currency: 'RON' },
    status: 'inregistrata',
  };
}

/** A registered EUR revenue with no recorded rate: real, and converts to nothing. */
function unconvertedEurRevenue() {
  return {
    id: 'r-eur',
    tip: 'factura',
    nr: 'FCT-FX-1',
    date: '2026-10-08',
    client: 'Client EUR SRL',
    cui: 'RO12345678',
    valoareFaraTva: { amount: 100_000 as Bani, currency: 'EUR' },
    tva: { amount: 0 as Bani, currency: 'EUR' },
    status: 'inregistrata',
  };
}

/** A rejected document: real, and never reaches an aggregate at all. */
function rejectedRevenue() {
  return {
    id: 'r-rej',
    tip: 'factura',
    nr: 'FCT-REJ-1',
    date: '2026-04-01',
    client: 'Client Respins SRL',
    cui: 'RO12345678',
    valoareFaraTva: { amount: 40_000 as Bani, currency: 'RON' },
    tva: { amount: 0 as Bani, currency: 'RON' },
    status: 'respinsa',
    statusDetail: 'CUI nevalid',
  };
}

beforeEach(() => {
  pinClock();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  unpinClock();
});

describe('Dashboard with zero records (acceptance 6)', () => {
  it('still shows the next deadline, the profile completeness and the next steps', () => {
    writePayload();
    renderDashboard();

    // The card reports the absence honestly...
    expect(screen.getByRole('heading', { name: 'Nicio înregistrare de venit sau cheltuială' })).toBeInTheDocument();
    // ...and the three things acceptance 6 names are all still on the page.
    expect(screen.getByRole('heading', { name: 'Termene limită' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Completitudine date' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ce trebuie să faci' })).toBeInTheDocument();
    // The D212 deadline is rule-driven, so it exists with an empty ledger.
    expect(screen.getByText('Depunere D212')).toBeInTheDocument();
  });
});

describe('B-68 — a ledger that is present but excluded never triggers the empty state', () => {
  it('a record dated outside the fiscal year is present but excluded from every total', () => {
    writePayload({ revenues: [outOfPeriodRevenue()] });
    renderDashboard();

    expect(document.querySelector('[data-empty-state]')).toBeNull();
  });

  it('a foreign record with no recorded rate is present but converts to nothing (B-37)', () => {
    writePayload({ revenues: [unconvertedEurRevenue()] });
    renderDashboard();

    expect(document.querySelector('[data-empty-state]')).toBeNull();
  });

  it('a rejected document is present but never reaches an aggregate', () => {
    writePayload({ revenues: [rejectedRevenue()] });
    renderDashboard();

    expect(document.querySelector('[data-empty-state]')).toBeNull();
  });

  it('an expense excluded by category is present and keeps the card away', () => {
    writePayload({
      expenses: [
        {
          id: 'e-personal',
          tip: 'bon-fiscal',
          nr: 'BF-1',
          date: '2026-05-12',
          furnizor: 'Carrefour',
          cui: 'RO11223344',
          valoareFaraTva: { amount: 8_550 as Bani, currency: 'RON' },
          tva: { amount: 1_796 as Bani, currency: 'RON' },
          status: 'inregistrata',
          category: 'personal_or_family_use',
        },
      ],
    });
    renderDashboard();

    expect(document.querySelector('[data-empty-state]')).toBeNull();
  });
});

describe('Hero — „Completează profilul” (acceptance 3)', () => {
  it('shows the CTA while the required profile facts are missing', () => {
    // The profile is stripped of the two facts the completeness model now requires.
    const { pfaStartDate, ...profileWithoutStart } = seedData.profile;
    void pfaStartDate;
    writePayload({
      profile: { ...profileWithoutStart, identity: { ...seedData.profile.identity, nume: '' } },
      revenues: [outOfPeriodRevenue()],
    });
    renderDashboard();

    const cta = screen.getByRole('link', { name: 'Completează profilul' });
    expect(cta).toBeInTheDocument();
    expect(cta.getAttribute('href')).toBe('/settings#!/fiscal');
  });

  it('does not show the CTA once the required facts are present', () => {
    writePayload({ revenues: [rejectedRevenue()] });
    renderDashboard();

    expect(screen.queryByRole('link', { name: 'Completează profilul' })).toBeNull();
  });
});
