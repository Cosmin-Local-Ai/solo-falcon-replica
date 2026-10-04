import { test, expect, describe, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StoreProvider } from '../data/store';
import { seedData } from '../data/seed';
import type { AppData, Revenue } from '../data/types';
import Dashboard from './Dashboard';

const STORAGE_KEY = 'pfa-app-data-v2';

/** A valid registered revenue (Feb 2026). */
const validRevenue: Revenue = {
  id: 'r1',
  tip: 'factura',
  nr: 'FCT-2026-001',
  date: '2026-02-10',
  client: 'Client A SRL',
  cui: 'RO12345678',
  valoareFaraTva: 50_000,
  tva: 9_500,
  status: 'inregistrata',
};

function writePayload(overrides: Record<string, unknown> = {}) {
  const base: AppData = {
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...base, ...overrides }));
}

function renderDashboard() {
  return render(
    <StoreProvider>
      <Dashboard />
    </StoreProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Dashboard page', () => {
  test('shows the onboarding CTA when no data is recorded', async () => {
    // Seed a valid-but-empty dataset so the store loads it directly and the
    // hasData gate switches to the onboarding CTA (an empty localStorage would
    // fall back to the non-empty seedData instead).
    writePayload();
    renderDashboard();

    // The store loads from localStorage asynchronously — wait for the CTA.
    expect(await screen.findByRole('heading', { name: 'Începe înregistrarea activității' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Adaugă un venit' })).toHaveAttribute('href', '/revenues');
    expect(screen.getByRole('link', { name: 'Adaugă o cheltuială' })).toHaveAttribute('href', '/expenses');

    // No cockpit cards or dashboard sections in the empty state.
    expect(document.querySelectorAll('.stat-card')).toHaveLength(0);
    expect(document.querySelectorAll('h2.card-title')).toHaveLength(0);
  });

  test('renders the cockpit cards and all sections when data is recorded', async () => {
    writePayload({ revenues: [validRevenue] });
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Tablou de bord' })).toBeVisible();

    // The 5 cockpit StatCard labels.
    for (const label of [
      'Venituri PFA (an)',
      'Impozit estimat',
      'Rezervă lunară',
      'Rămâne de pus deoparte',
      'Date complete',
    ]) {
      expect(screen.getAllByText(label, { exact: true }).length).toBeGreaterThan(0);
    }

    // The page-level sections.
    for (const title of ['Estimare impozit', 'Grafic financiar', 'Rezervă fiscală']) {
      expect(screen.getByRole('heading', { name: title })).toBeVisible();
    }
  });

  test('shows em dash for the tax estimate when the PFA income regime requires review', async () => {
    writePayload({ revenues: [validRevenue] });
    renderDashboard();

    const card = (await screen.findByText('Impozit estimat', { exact: true })).closest('.stat-card');
    expect(card).not.toBeNull();
    await expect(card).toHaveTextContent(/—/);
  });

  test('shows the computed CIT estimate in the cockpit for a CIT profile', async () => {
    writePayload({
      profile: {
        ...seedData.profile,
        pfaStartYear: 2026,
        fiscalYear: 2026,
        regime: 'impozit_pe_cit',
        pensionStatus: 'nu',
        otherIncome: [],
        socialInsuranceStatus: 'obligatoriu',
      },
      revenues: [
        {
          id: 'r1',
          tip: 'factura',
          nr: 'FCT-2026-001',
          date: '2026-01-15',
          client: 'Client X SRL',
          cui: 'RO12345678',
          valoareFaraTva: 78_000,
          tva: 16_380,
          status: 'inregistrata',
        },
        {
          id: 'r2',
          tip: 'factura',
          nr: 'FCT-2026-002',
          date: '2026-02-20',
          client: 'Client Y SRL',
          cui: 'RO12345678',
          valoareFaraTva: 52_000,
          tva: 10_920,
          status: 'inregistrata',
        },
      ],
    });
    renderDashboard();

    const card = (await screen.findByText('Impozit estimat', { exact: true })).closest('.stat-card');
    expect(card).not.toBeNull();
    // Verified against the tax engine for this dataset: computed 46.570 lei.
    await expect(card).toHaveTextContent(/46\.570/);
  });
});
