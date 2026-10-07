import { test, expect, describe, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { StoreProvider } from '../data/store';
import { seedData } from '../data/seed';
import type { AppData, Revenue } from '../data/types';
import Dashboard from './Dashboard';
import { lei, type Bani } from '../domain/money';

const STORAGE_KEY = 'pfa-app-data-v2';

/** A valid registered revenue (Feb 2026). */
const validRevenue: Revenue = {
  id: 'r1',
  tip: 'factura',
  nr: 'FCT-2026-001',
  date: '2026-02-10',
  client: 'Client A SRL',
  cui: 'RO12345678',
  // Deliberately NOT wrapped in lei(): writePayload() writes a versionless payload straight to
  // localStorage, so the v4->v5 money step scales it. Wrapping here would double the conversion.
  valoareFaraTva: 50_000 as Bani,
  tva: 9_500 as Bani,
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

/**
 * Assert the figure the cockpit shows, waiting for the estimate to land first.
 *
 * The figure is NOT on the first paint. `useLatestTaxEstimate` (`src/data/derived.ts`) resolves the
 * engine through `computeTaxEstimate(...).then(setEstimate)`, so the card paints the loading
 * sentinel `—` on mount and the computed number one React-scheduler macrotask later. Measured on
 * this suite: the card reads `—` synchronously after `render()` and still `—` after a microtask;
 * `46.570,00 RON` appears only after the next macrotask.
 *
 * This file used to wait for the LABEL (`findByText('Impozit estimat')`) and then assert the value
 * once. The label is present on the first paint, so that was never a wait for the value — the
 * assertion raced the macrotask and lost it whenever the machine was busy. Measured before this
 * helper: `taskset -c 0,1 npx vitest run src/pages/Dashboard.test.tsx` failed 3 of 8 runs, with the
 * received text `Impozit estimat—de pus deoparte`.
 *
 * What is asserted is unchanged: the same matcher, the same element, the same exact figure. Only the
 * missing wait is added. A wrong figure, or one that never arrives, still fails — after the default
 * 1000 ms `asyncUtilTimeout` instead of after 0 ms. Measured settle time: 2 ms, so no timeout here
 * is widened and none is load-bearing.
 */
async function expectTaxFigure(card: Element | null, figure: RegExp): Promise<void> {
  await waitFor(() => expect(card).toHaveTextContent(figure));
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

  test('computes the tax estimate for the default PFA regime impozit_pe_venit instead of refusing it (B-14)', async () => {
    writePayload({ revenues: [validRevenue] });
    renderDashboard();

    const card = (await screen.findByText('Impozit estimat', { exact: true })).closest('.stat-card');
    expect(card).not.toBeNull();
    // The seed profile is on the only regime a PFA can have in 2026, so the default user gets a number,
    // not an em dash. Verified against the engine for this dataset (revenue 50,000 net, no expenses):
    // CAS 12,150 (12 SM x 25%) + CASS 5,000 (10% x 50,000) + 10% x (50,000 - 17,150) = 20,435 lei.
    await expectTaxFigure(card, /20\.435/);
  });

  test('shows the computed estimate in the cockpit for a PFA profile on the lawful regime', async () => {
    writePayload({
      profile: {
        ...seedData.profile,
        pfaStartYear: 2026,
        fiscalYear: 2026,
        regime: 'impozit_pe_venit',
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
          valoareFaraTva: 78_000 as Bani,
          tva: 16_380 as Bani,
          status: 'inregistrata',
        },
        {
          id: 'r2',
          tip: 'factura',
          nr: 'FCT-2026-002',
          date: '2026-02-20',
          client: 'Client Y SRL',
          cui: 'RO12345678',
          // raw lei scale — see the note on validRevenue (this payload is migrated on load)
          valoareFaraTva: 52_000 as Bani,
          tva: 10_920 as Bani,
          status: 'inregistrata',
        },
      ],
    });
    renderDashboard();

    const card = (await screen.findByText('Impozit estimat', { exact: true })).closest('.stat-card');
    expect(card).not.toBeNull();
    // Verified against the tax engine for this dataset: computed 46.570 lei (CAS 24,300 = 24 SM x 25%,
    // CASS 13,000 = 10% x 130,000, tax 9,270 = 10% x 92,700). The figure is IDENTICAL to the one this
    // dataset produced under the old impozit_pe_cit gate — B-14 moved which regime the engine accepts,
    // it did not move the Titlul IV arithmetic (art. 118 alin. (2^2)/(2^3) are a no-op for one source).
    await expectTaxFigure(card, /46\.570/);
  });

  test('a profile recorded as impozit_pe_cit is a data-integrity failure, not a different base (B-14)', async () => {
    writePayload({
      profile: { ...seedData.profile, pfaStartYear: 2026, fiscalYear: 2026, regime: 'impozit_pe_cit' },
      revenues: [validRevenue],
    });
    renderDashboard();

    const card = (await screen.findByText('Impozit estimat', { exact: true })).closest('.stat-card');
    expect(card).not.toBeNull();
    // The reason must name the provisions that make the regime impossible for a persoană fizică, so the
    // user can see which record is wrong (rendered verbatim by FinancialChart).
    expect(await screen.findByText(/nu poate aparține unui PFA/)).toBeTruthy();
    expect(screen.getByText(/art\. 13 alin\. \(1\)/).textContent).toContain('art. 120');
    // ORDER IS LOAD-BEARING. The em dash is asserted only after the refusal reason is on screen, so
    // what it proves is "the engine refused and the cockpit carries the refusal marker" — not "the
    // estimate happened to be mid-flight". Read in the old order this assertion passed against the
    // loading sentinel, i.e. it checked nothing and could not fail. It is still not fully provable from
    // the card alone, because the cockpit renders the SAME `—` for "still computing" and for "refused";
    // that ambiguity is a product defect, registered as B-28, not something a test may paper over.
    expect(card).toHaveTextContent(/—/);
  });
});
