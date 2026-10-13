/**
 * B-93 acceptance 3 — the double-count refusal reaches the dashboard, on the one coverage channel.
 *
 * PG-1 built the channel: one list of `EstimateCoverageGap`, one badge, one set of rows, one weighted
 * percentage. B-93 does not add a second warning surface beside it — it adds one reason to the existing
 * list, because a second producer of "the estimate is not complete" is the defect that channel exists to
 * prevent (brief 28 §0 rule 6).
 *
 * B-106 is the failure being avoided: a refusal state with no reason attached. The row here carries the
 * assembler's own sentence, which names the asset.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Dashboard from './Dashboard';
import { parseRoute } from '../App';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import type { AppData, Expense, FixedAsset } from '../data/types';
import { lei, ron } from '../domain/money';
import { pinClock, unpinClock } from '../test/clock';
import { fixedInstant } from '../test/fixedInstant';
import { buildDashboardData, getTaxEstimate } from '../data/dashboard';
import { dashboard as dashboardCopy } from '../ui/copy';

const asset: FixedAsset = {
  id: 'asset-laptop',
  label: 'Laptop de lucru',
  entryDate: '2026-02-10',
  putInFunctionDate: '2026-02-15',
  fiscalValue: lei(120000),
  normalLifeMonths: 60,
  method: 'degresiv',
  acquisition: 'cumparare',
  paymentState: 'achitat',
  paidOn: '2026-02-11',
};

const typedDepreciation: Expense = {
  id: 'exp-amortizare-tipita',
  tip: 'factura',
  nr: 'Înreg-2026-0001',
  date: '2026-09-10',
  paid: '2026-09-10',
  furnizor: 'Registrul de amortizare',
  cui: 'RO00000000',
  valoareFaraTva: ron(70000),
  tva: ron(0),
  status: 'inregistrata',
  category: 'depreciation_business_asset',
};

function payload(overrides: Partial<AppData> = {}): AppData {
  return { ...seedData, ...overrides, version: CURRENT_DATA_VERSION } as AppData;
}

describe('the depreciation conflict is a coverage row, not a silent withholding', () => {
  beforeEach(() => {
    localStorage.clear();
    pinClock(fixedInstant());
  });
  afterEach(() => {
    cleanup();
    unpinClock();
    localStorage.clear();
  });

  it('the row appears with its own reason label and a count', async () => {
    localStorage.setItem('pfa-app-data-v2', JSON.stringify(payload({
      fixedAssets: [asset],
      expenses: [...seedData.expenses, typedDepreciation],
    })));
    render(
      <StoreProvider>
        <Dashboard />
      </StoreProvider>,
    );
    const row = await screen.findByText(
      dashboardCopy.estimate.coverage.reasonLabels.depreciation_conflict,
    );
    expect(row.closest('[data-coverage-reason="depreciation_conflict"]')).toBeTruthy();
    expect(row.textContent).toContain(dashboardCopy.estimate.coverage.reasonLabels.depreciation_conflict);
  });

  it('the row carries the sentence that names the asset', async () => {
    localStorage.setItem('pfa-app-data-v2', JSON.stringify(payload({
      fixedAssets: [asset],
      expenses: [...seedData.expenses, typedDepreciation],
    })));
    render(
      <StoreProvider>
        <Dashboard />
      </StoreProvider>,
    );
    await screen.findByText(dashboardCopy.estimate.coverage.reasonLabels.depreciation_conflict);
    const detail = document.querySelector('[data-coverage-detail="depreciation_conflict"]');
    expect(detail).toBeTruthy();
    expect(detail?.textContent).toContain('Laptop de lucru');
    expect(detail?.textContent).toContain('exp-amortizare-tipita');
  });

  it('the link resolves to the asset register through the app\'s own router', async () => {
    localStorage.setItem('pfa-app-data-v2', JSON.stringify(payload({
      fixedAssets: [asset],
      expenses: [...seedData.expenses, typedDepreciation],
    })));
    render(
      <StoreProvider>
        <Dashboard />
      </StoreProvider>,
    );
    const link = await screen.findByRole('link', { name: dashboardCopy.estimate.coverage.open });
    const href = link.getAttribute('href') ?? '';
    expect(href).toBe('/assets');
    // Not a string match — the route the app would actually mount for that href.
    window.history.pushState('', '', href);
    expect(parseRoute()).toMatchObject({ page: 'assets' });
  });

  it('the estimate figure does not move, and the completeness percentage does not move either', async () => {
    const asOf = fixedInstant().toISOString().slice(0, 10);
    const bare = await getTaxEstimate(payload(), asOf);
    const conflicted = await getTaxEstimate(payload({
      fixedAssets: [asset],
      expenses: [...seedData.expenses, typedDepreciation],
    }), asOf);
    if (bare.status !== 'computed' || conflicted.status !== 'computed') {
      throw new Error('both must compute');
    }
    // The typed expense moves the figure; the ASSET does not, and that is the assertion.
    const typedOnly = await getTaxEstimate(payload({
      expenses: [...seedData.expenses, typedDepreciation],
    }), asOf);
    if (typedOnly.status !== 'computed') throw new Error('must compute');
    expect(conflicted.output.total).toBe(typedOnly.output.total);

    const bareView = buildDashboardData(payload(), bare, fixedInstant());
    const conflictedView = buildDashboardData(payload({
      fixedAssets: [asset],
      expenses: [...seedData.expenses, typedDepreciation],
    }), conflicted, fixedInstant());
    expect(conflictedView.completeness.coverage.percent).toBe(bareView.completeness.coverage.percent);
    expect(
      conflictedView.coverage.some(g => g.reason === 'depreciation_conflict'),
    ).toBe(true);
  });

  it('an asset with no competing expense posts its schedule and raises no conflict row', async () => {
    const asOf = fixedInstant().toISOString().slice(0, 10);
    const posted = await getTaxEstimate(payload({ fixedAssets: [asset] }), asOf);
    if (posted.status !== 'computed') throw new Error('must compute');
    expect(posted.depreciation?.total).toBe(lei(30000));
    expect(posted.depreciation?.conflicts).toEqual([]);
    const view = buildDashboardData(payload({ fixedAssets: [asset] }), posted, fixedInstant());
    expect(view.coverage.some(g => g.reason === 'depreciation_conflict')).toBe(false);
  });
});
