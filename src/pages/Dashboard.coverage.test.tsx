/**
 * PG-1 acceptance 1 — the hero.
 *
 * The defect PG-1 exists to close: the hero badge stayed green while records were dropped. This file
 * pins the four things the gate demands of a profile with a dropped record — the status word, the count,
 * an action row, and a deep link that actually lands on the record — and the same profile without the
 * record, which must read `Calculat` again.
 *
 * The link is asserted through `parseRoute`, the router the app itself uses, rather than by matching the
 * href string: a link that looks right and resolves to the dashboard is exactly the failure a string
 * comparison misses.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Dashboard from './Dashboard';
import { parseRoute } from '../App';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import type { AppData, Expense } from '../data/types';
import { ron } from '../domain/money';
import { pinClock, unpinClock } from '../test/clock';
import { fixedInstant } from '../test/fixedInstant';

const STORAGE_KEY = 'pfa-app-data-v2';

function payload(overrides: Partial<AppData> = {}): AppData {
  return {
    ...seedData,
    ...overrides,
    version: CURRENT_DATA_VERSION,
  } as AppData;
}

function uncategorised(): Expense {
  return {
    id: 'cov-uncat',
    tip: 'factura',
    nr: 'CH-2026-900',
    date: '2026-05-10',
    furnizor: 'Furnizor Test SRL',
    cui: 'RO99999999',
    valoareFaraTva: ron(2000),
    tva: ron(400),
    status: 'inregistrata',
  };
}

function renderDashboard() {
  return render(
    <StoreProvider>
      <Dashboard />
    </StoreProvider>,
  );
}

describe('Dashboard hero — the estimate says what it does not cover', () => {
  beforeEach(() => {
    localStorage.clear();
    pinClock(fixedInstant());
  });
  afterEach(() => {
    cleanup();
    unpinClock();
    localStorage.clear();
  });

  it('the seed profile, which covers everything it recorded, still reads „Calculat”', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload()));
    renderDashboard();
    const badge = await screen.findByText('Calculat');
    expect(badge.getAttribute('data-estimate-state')).toBe('complete');
    expect(document.querySelector('[data-estimate-state="complete"]')).not.toBeNull();
    expect(document.querySelector('[data-estimate-coverage]')).toBeNull();
  });

  it('a dropped record turns the badge to „Estimare incompletă” and names the count', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(payload({ expenses: [...seedData.expenses, uncategorised()] })),
    );
    renderDashboard();

    const badge = await screen.findByText('Estimare incompletă');
    expect(badge.getAttribute('data-estimate-state')).toBe('incomplete');
    expect(document.querySelector('[data-estimate-state="incomplete"]')).not.toBeNull();

    // The count and the reason, in one action row.
    const rows = document.querySelectorAll('[data-coverage-reason]');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('fără categorie');
    expect(document.querySelector('[data-estimate-coverage] [data-coverage-count]'))
      .toHaveAttribute('data-coverage-count', '1');
  });

  it('the action row links to the record, and the app’s own router resolves that link', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(payload({ expenses: [...seedData.expenses, uncategorised()] })),
    );
    renderDashboard();

    const link = await screen.findByRole('link', { name: 'Deschide înregistrarea' });
    const href = link.getAttribute('href') ?? '';
    expect(href).toBe('/expenses#!/registered?f=cov-uncat');

    // Not a string match — the route the app would actually mount for that href.
    window.history.pushState('', '', href);
    const route = parseRoute();
    expect(route).toMatchObject({ page: 'expenses', tab: 'registered', focus: 'cov-uncat' });
  });

  it('the completeness card reports a weighted figure below 100 for the same profile', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(payload({ expenses: [...seedData.expenses, uncategorised()] })),
    );
    renderDashboard();
    await screen.findByText('Estimare incompletă');
    const cell = document.querySelector('[data-amount-coverage]');
    expect(cell).not.toBeNull();
    const percent = Number(cell?.querySelector('[data-amount-percent]')?.getAttribute('data-amount-percent'));
    expect(percent).toBeGreaterThan(0);
    expect(percent).toBeLessThan(100);
  });

  it('fixing the record returns the hero to „Calculat”', async () => {
    const fixed = { ...uncategorised(), category: 'rent_business_space' } as Expense;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(payload({ expenses: [...seedData.expenses, fixed] })),
    );
    renderDashboard();
    await screen.findByText('Calculat');
    expect(screen.queryByText('Estimare incompletă')).not.toBeInTheDocument();
    expect(document.querySelector('[data-estimate-coverage]')).toBeNull();
    expect(document.querySelector('[data-amount-percent]')).toHaveAttribute('data-amount-percent', '100');
  });
});
