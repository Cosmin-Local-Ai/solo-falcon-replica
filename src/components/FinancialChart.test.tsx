import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FinancialChart, { FinancialChartTooltip } from './FinancialChart';

const { mockUseStore, mockUseDashboardData, mockGetProjectedFinancialSeries } = vi.hoisted(() => ({
  mockUseStore: vi.fn(),
  mockUseDashboardData: vi.fn(),
  mockGetProjectedFinancialSeries: vi.fn(),
}));

vi.mock('../data/store', () => ({ useStore: mockUseStore }));
vi.mock('../data/dashboardAdapter', () => ({ useDashboardData: mockUseDashboardData }));
vi.mock('../data/dashboard', () => ({ getProjectedFinancialSeries: mockGetProjectedFinancialSeries }));

const AS_OF = '2026-06-15';

function buildSeries() {
  return Array.from({ length: 12 }, (_, i) => {
    const month = `2026-${String(i + 1).padStart(2, '0')}`;
    return {
      month,
      revenue: 10000 + i * 500,
      expenses: 4000 + i * 100,
      net: 6000 + i * 400,
      kind: i < 6 ? ('actual' as const) : ('projected' as const),
    };
  });
}

function fakeResizeObserver() {
  class FakeResizeObserver {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(el: Element) {
      this.cb(
        [
          {
            target: el,
            contentRect: {
              width: 800,
              height: 320,
              x: 0,
              y: 0,
              left: 0,
              top: 0,
              right: 800,
              bottom: 320,
              toJSON: () => ({}),
            },
          } as unknown as ResizeObserverEntry,
        ],
        this,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeResizeObserver;
}

beforeEach(() => {
  vi.clearAllMocks();
  fakeResizeObserver();
  mockGetProjectedFinancialSeries.mockReturnValue({
    periodActual: { from: '2026-01-01', to: AS_OF },
    runRate: { revenuePerMonth: 13000, expensesPerMonth: 4500, netPerMonth: 8500 },
    annualProjected: { revenue: 156000, expenses: 54000, net: 102000 },
    series: buildSeries(),
    method: 'run-rate-v1',
  });
  mockUseStore.mockReturnValue({} as never);
  mockUseDashboardData.mockReturnValue({
    snapshot: { asOf: AS_OF },
    tax: { status: 'computed', output: { total: 1234.56 } },
  });
});

function renderChart() {
  return render(<FinancialChart />);
}

describe('FinancialChart', () => {
  it('consumes the Step 18 data layer (getProjectedFinancialSeries with asOf)', () => {
    renderChart();
    expect(mockGetProjectedFinancialSeries).toHaveBeenCalledTimes(1);
    expect(mockGetProjectedFinancialSeries).toHaveBeenCalledWith(expect.anything(), AS_OF);
  });

  it('renders the three metrics as lines', () => {
    renderChart();
    // Each metric label appears in both the legend and the data-table header.
    expect(screen.getAllByText('Venituri').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cheltuieli').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Profit net').length).toBeGreaterThan(0);
  });

  it('shows a meaningful accessible representation (data table)', () => {
    renderChart();
    const table = screen.getByRole('table');
    expect(table).toHaveAccessibleName(
      expect.stringContaining('Grafic financiar'),
    );
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual([
      'Perioadă',
      'Venituri',
      'Cheltuieli',
      'Profit net',
    ]);
    // Default range is monthly (June 2026 = actual).
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Iun 2026');
    expect(rows[0].textContent).toContain('Realizat');
  });

  it('switches to YTD: 6 actual months, no projected rows', async () => {
    const user = userEvent.setup();
    renderChart();
    await user.click(screen.getByRole('button', { name: 'YTD' }));
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(6);
    rows.forEach((r) => expect(r.textContent).toContain('Realizat'));
    expect(rows.some((r) => r.textContent?.includes('Proiecție'))).toBe(false);
  });

  it('switches to full-year projection: 12 months, 6 actual + 6 projected', async () => {
    const user = userEvent.setup();
    renderChart();
    await user.click(screen.getByRole('button', { name: 'An' }));
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(12);
    const actualRows = rows.filter((r) => r.textContent?.includes('Realizat'));
    const projectedRows = rows.filter((r) => r.textContent?.includes('Proiecție'));
    expect(actualRows).toHaveLength(6);
    expect(projectedRows).toHaveLength(6);
  });

  it('monthly range: month selector changes the visible month', async () => {
    const user = userEvent.setup();
    renderChart();
    const select = screen.getByRole('combobox', { name: 'Lună selectată' });
    await user.selectOptions(select, '2026-01');
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Ian 2026');
  });

  it('distinguishes projected lines with a dashed stroke', async () => {
    const user = userEvent.setup();
    const { container } = renderChart();
    await user.click(screen.getByRole('button', { name: 'An' }));
    const paths = container.querySelectorAll('path.recharts-curve');
    const solid = [...paths].filter((p) => !p.getAttribute('stroke-dasharray'));
    const dashed = [...paths].filter((p) => p.getAttribute('stroke-dasharray') === '6 4');
    // One contiguous segment per metric per state: 3 solid (actual) + 3 dashed (projected).
    expect(solid.length).toBe(3);
    expect(dashed.length).toBe(3);
  });

  it('shows the tax estimate when computed', () => {
    renderChart();
    expect(screen.getByText(/Estimare impozit YTD/)).toBeInTheDocument();
    expect(screen.getByText(/1.234,56 RON/)).toBeInTheDocument();
  });

  it('shows the review-required tax note when the tax estimate is not computed', () => {
    mockUseDashboardData.mockReturnValue({
      snapshot: { asOf: AS_OF },
      tax: { status: 'review_required', reason: 'date lipsă' },
    });
    renderChart();
    expect(screen.getByText(/revizuire necesară — date lipsă/)).toBeInTheDocument();
  });
});

describe('FinancialChartTooltip', () => {
  it('shows metric, period, value and actual/projected state', () => {
    const { container } = render(
      <FinancialChartTooltip
        active
        label="Iul 2026"
        payload={[
          { dataKey: 'revenue_projected', value: 13000 },
          { dataKey: 'expenses_projected', value: 4600 },
          { dataKey: 'net_projected', value: 8400 },
        ]}
      />,
    );
    expect(container.textContent).toContain('Iul 2026');
    expect(container.textContent).toContain('Venituri · Proiecție: 13.000,00 RON');
    expect(container.textContent).toContain('Cheltuieli · Proiecție: 4.600,00 RON');
    expect(container.textContent).toContain('Profit net · Proiecție: 8.400,00 RON');
  });

  it('renders nothing when inactive or empty', () => {
    const { container } = render(
      <FinancialChartTooltip active={false} payload={[]} label="Iul 2026" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
