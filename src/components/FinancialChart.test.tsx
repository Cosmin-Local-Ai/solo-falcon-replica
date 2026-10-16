import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FinancialChart, { FinancialChartTooltip } from './FinancialChart';
import { lei, money } from '../domain/money';
import { chart as chartCopy, dashboard as dashboardCopy, fx } from '../ui/copy';

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
      revenue: lei(10000) + i * 500,
      expenses: lei(4000) + i * 100,
      net: lei(6000) + i * 400,
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
    runRate: { revenuePerMonth: lei(13000), expensesPerMonth: 4500, netPerMonth: 8500 },
    annualProjected: { revenue: lei(156000), expenses: lei(54000), net: lei(102000) },
    series: buildSeries(),
    method: 'run-rate-v1',
  });
  mockUseStore.mockReturnValue({} as never);
  mockUseDashboardData.mockReturnValue({
    snapshot: { asOf: AS_OF },
    tax: {
      status: 'computed',
      output: { total: lei(1234.56) },
      // Task 1: the note's wording is driven by the RECORDED BASIS, not by a literal in the component.
      // PG-5C: this is the only computed shape the note can receive — the engine runs on recorded
      // actuals, and the wording below is the honest wording for it.
      basis: {
        kind: 'recorded-actuals',
        asOfDate: AS_OF,
        closed: false,
        actual: {
          revenues: lei(20000),
          expenses: lei(8000),
          revenuesNet: lei(18000),
          expensesNet: lei(7000),
        },
      },
    },
    // Phase 10c: the chart reads the ledger disclosure the dashboard computed, because a foreign record left
    // out of the series must be named under the graph rather than vanish from it. This fixture has no
    // foreign records, so both lists are empty — the assertion that nothing is reported is made with real
    // data in src/components/dashboard/CurrencySection.test.tsx and src/data/dashboard.fx.test.ts.
    ledger: { conversions: [], unconverted: [] },
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
    // PG-5C: the note names the quantity rather than the period. "YTD" was accurate only against a
    // projected alternative; the figure beside it is now money that was received and paid.
    expect(screen.getByText(/Impozit calculat din încasări și plăți înregistrate/)).toBeInTheDocument();
    expect(screen.getByText(/1.234,56 RON/)).toBeInTheDocument();
  });

  it('the tax note never claims a run-rate figure, even when a forecast travels with the estimate', () => {
    // PG-5C re-premise of "names the run-rate basis on the tax note when the estimate was projected".
    // That test asserted the opposite of this one: it required the note to read
    // "Estimare impozit anuală (rată de desfășurare)". The wording rule it defended — an annual run-rate
    // figure must not be labelled YTD — was correct; the figure it was labelling should never have been
    // a run rate in the first place. The note now carries the recorded basis whatever the forecast says.
    mockUseDashboardData.mockReturnValue({
      snapshot: { asOf: AS_OF },
      tax: {
        status: 'computed',
        output: { total: lei(1234.56) },
        basis: {
          kind: 'recorded-actuals',
          asOfDate: AS_OF,
          closed: false,
          actual: {
            revenues: lei(20000),
            expenses: lei(8000),
            revenuesNet: lei(18000),
            expensesNet: lei(7000),
          },
          forecast: {
            method: 'run-rate-v1',
            elapsedMonths: 5.5,
            activeMonths: 12,
            runRate: { revenuePerMonth: lei(3272), expensesPerMonth: lei(1272), netPerMonth: lei(2000) },
            amounts: {
              revenues: lei(43636),
              expenses: lei(17454),
              revenuesNet: lei(39272),
              expensesNet: lei(15272),
            },
          },
        },
      },
      ledger: { conversions: [], unconverted: [] },
    });
    renderChart();
    expect(screen.getByText(/Impozit calculat din încasări și plăți înregistrate/)).toBeInTheDocument();
    // The wording rule survives, generalised: no run-rate label on a tax figure, and no YTD label either.
    expect(screen.queryByText(/rată de desfășurare/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Estimare impozit YTD/)).not.toBeInTheDocument();
  });

  it('labels a basis-less estimate neutrally instead of claiming YTD', () => {
    mockUseDashboardData.mockReturnValue({
      snapshot: { asOf: AS_OF },
      tax: { status: 'computed', output: { total: lei(1234.56) } },
      ledger: { conversions: [], unconverted: [] },
    });
    renderChart();
    expect(screen.getByText(/Estimare impozit:/)).toBeInTheDocument();
    expect(screen.queryByText(/Estimare impozit YTD/)).not.toBeInTheDocument();
  });

  it('shows the review-required tax note when the tax estimate is not computed', () => {
    mockUseDashboardData.mockReturnValue({
      snapshot: { asOf: AS_OF },
      tax: { status: 'review_required', reason: 'date lipsă' },
      estimateState: 'review_required',
      ledger: { conversions: [], unconverted: [] },
    });
    renderChart();
    /**
     * RE-PIN (B-106). This used to assert `revizuire necesară — date lipsă`, i.e. that the chart is where
     * the engine's refusal sentence reaches the screen. It no longer is: the sentence is rendered once, in
     * the estimate section beside the figure the refusal took away (`src/pages/Dashboard.tsx`,
     * `[data-estimate-reason]`, pinned by `Dashboard.ladderRefusal.test.tsx`). What the chart owes is a
     * note that names the state and points there — and it still must not print the paragraph a second
     * time, which is the last assertion here.
     */
    const note = screen.getByText(/motorul a refuzat estimarea/);
    expect(note).toBeInTheDocument();
    expect(note.getAttribute('data-estimate-state')).toBe('review_required');
    expect(screen.queryByText(/date lipsă/)).not.toBeInTheDocument();
  });

  /**
   * Phase 10c (B-37). The series is drawn from the same normalised ledger the summary and the estimate
   * read, so a foreign record with no rate is absent from the line — and the chart has to say so, because
   * a line that quietly omits a real invoice reads as a complete year.
   */
  it('names the foreign records left out of the series', () => {
    mockUseDashboardData.mockReturnValue({
      snapshot: { asOf: AS_OF },
      tax: { status: 'computed', output: { total: lei(1234.56) } },
      ledger: {
        conversions: [],
        unconverted: [
          {
            id: 'rev-eur-1', kind: 'revenue', currency: 'EUR',
            amount: money(lei(1000), 'EUR'),
            detail: 'niciun curs BNR înregistrat pentru EUR la data 2026-10-08',
          },
        ],
      },
    });
    renderChart();
    const note = document.querySelector('[data-unconverted-count]');
    expect(note?.getAttribute('data-unconverted-count')).toBe('1');
    expect(note?.textContent).toContain(fx.ledger.unconvertedLead(1));
    expect(note?.textContent).toContain(fx.ledger.unconvertedTail);
  });
});

describe('FinancialChartTooltip', () => {
  it('shows metric, period, value and actual/projected state', () => {
    const { container } = render(
      <FinancialChartTooltip
        active
        label="Iul 2026"
        payload={[
          { dataKey: 'revenue_projected', value: lei(13000) },
          { dataKey: 'expenses_projected', value: lei(4600) },
          { dataKey: 'net_projected', value: lei(8400) },
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

/**
 * PG-4 — a closed fiscal year has no forecast left in it.
 *
 * The chart is the one surface that draws a projected series, so it is where "the forecast is visually
 * distinct and never feeds the figure" is checkable: once the year is closed the projected series and
 * its legend disappear, and the note under the graph names the figure as a final calculation instead of
 * a run rate.
 */
describe('FinancialChart — a closed fiscal year (PG-4)', () => {
  const CLOSED_AS_OF = '2027-05-26';

  beforeEach(() => {
    vi.clearAllMocks();
    fakeResizeObserver();
    mockGetProjectedFinancialSeries.mockReturnValue({
      periodActual: { from: '2026-01-01', to: CLOSED_AS_OF },
      activePeriod: { from: '2026-01-19', to: '2026-12-31' },
      activeMonths: 354 / 31,
      closed: true,
      elapsedMonths: 354 / 31,
      runRate: { revenuePerMonth: lei(13000), expensesPerMonth: 4500, netPerMonth: 8500 },
      annualProjected: { revenue: lei(156000), expenses: lei(54000), net: lei(102000) },
      annualProjectedExclVat: { revenueNet: lei(150000), expenseNet: lei(50000) },
      series: Array.from({ length: 12 }, (_, i) => ({
        month: `2026-${String(i + 1).padStart(2, '0')}`,
        revenue: lei(10000) + i * 500,
        expenses: lei(4000) + i * 100,
        net: lei(6000) + i * 400,
        kind: 'actual' as const,
      })),
      method: 'run-rate-v1',
    });
    mockUseStore.mockReturnValue({} as never);
    mockUseDashboardData.mockReturnValue({
      snapshot: { asOf: CLOSED_AS_OF },
      year: { year: 2026, closed: true, rulesAvailable: true, currentYear: 2027, advanceTo: null },
      tax: {
        status: 'computed',
        output: { total: lei(3112) },
        basis: {
          kind: 'recorded-actuals',
          asOfDate: CLOSED_AS_OF,
          closed: true,
          actual: { revenues: lei(9317), expenses: lei(205.5), revenuesNet: lei(7700), expensesNet: lei(120) },
        },
      },
      ledger: { conversions: [], unconverted: [] },
    });
  });

  it('draws no projected series and names the figure as a final calculation', () => {
    renderChart();

    // The forecast is gone: no legend entry, no "Proiecție" state anywhere in the chart's own text.
    expect(screen.queryByText(chartCopy.projectedLegend)).toBeNull();
    expect(screen.queryByText('Proiecție')).toBeNull();
    // The note under the graph is the final-calculation label, not a run-rate label. The figure sits in
    // its own `<strong>`, so the assertion reads the note's textContent rather than one text node.
    const note = document.querySelector('p.chart-tax-note[data-estimate-state="computed"]');
    expect(note?.textContent).toBe(`${dashboardCopy.estimate.finalCalculation(2026)}: 3.112,00 RON`);
  });
});
