import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStore } from '../data/store';
import { useDashboardData } from '../data/dashboardAdapter';
import { getProjectedFinancialSeries } from '../data/dashboard';
import { estimateFigureLabel } from '../domain/estimateBasis';
import { formatBaniAxis, formatBaniRON, formatBaniRONOrDash, isBani, type Bani } from '../domain/money';
import { chart as chartCopy, estimateState as estimateStateCopy } from '../ui/copy';


type Range = 'monthly' | 'ytd' | 'year';

type MetricKey = 'revenue' | 'expenses' | 'net';

const METRICS: ReadonlyArray<{ key: MetricKey; label: string; color: string }> = [
  { key: 'revenue', label: chartCopy.metrics.revenue, color: '#1d4ed8' },
  { key: 'expenses', label: chartCopy.metrics.expenses, color: '#f04438' },
  { key: 'net', label: chartCopy.metrics.net, color: '#12b76a' },
];

const RANGES: ReadonlyArray<{ value: Range; label: string }> = [
  { value: 'monthly', label: chartCopy.ranges.monthly },
  { value: 'ytd', label: chartCopy.ranges.ytd },
  { value: 'year', label: chartCopy.ranges.annual },
];

const MONTH_LABELS = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

function monthLabel(month: string, withYear: boolean): string {
  const [year, m] = month.split('-');
  const label = MONTH_LABELS[Number(m) - 1] ?? month;
  return withYear ? `${label} ${year}` : label;
}

function stateLabel(kind: 'actual' | 'projected'): string {
  return kind === 'actual' ? chartCopy.state.actual : chartCopy.state.projected;
}

interface ChartRow {
  month: string;
  label: string;
  kind: 'actual' | 'projected';
  revenue: Bani;
  expenses: Bani;
  net: Bani;
  revenue_actual: Bani | null;
  revenue_projected: Bani | null;
  expenses_actual: Bani | null;
  expenses_projected: Bani | null;
  net_actual: Bani | null;
  net_projected: Bani | null;
}

/**
 * Custom tooltip content: metric, period, value (lei), actual/projected state.
 * Exported for direct testing.
 */
export function FinancialChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: string | number; value?: number | string }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const items = payload
    .filter((p) => typeof p.value === 'number')
    .map((p) => {
      const [metricKey, kind] = String(p.dataKey).split('_') as [MetricKey, 'actual' | 'projected'];
      return {
        metric: METRICS.find((m) => m.key === metricKey)?.label ?? String(p.dataKey),
        // Recharts echoes the numbers we handed it, but the type system cannot see that. Re-checking that
        // the value is still a whole ban is what keeps a chart library from smuggling a fractional or
        // NaN amount into a money string; anything else renders as an em dash rather than a guess.
        value: typeof p.value === 'number' && isBani(p.value) ? p.value : null,
        state: stateLabel(kind),
      };
    });
  if (items.length === 0) return null;
  return (
    <div className="chart-tooltip" role="status">
      <div className="chart-tooltip-period">{label}</div>
      {items.map((item) => (
        <div key={item.metric}>
          {item.metric} · {item.state}: {formatBaniRONOrDash(item.value)}
        </div>
      ))}
    </div>
  );
}

export default function FinancialChart() {
  const data = useStore();
  const dashboard = useDashboardData();
  const asOf = dashboard.snapshot.asOf;
  const tax = dashboard.tax;

  const [range, setRange] = useState<Range>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => asOf.slice(0, 7));

  const projection = useMemo(() => getProjectedFinancialSeries(data, asOf), [data, asOf]);

  // Reshape the existing 12-month series for the selected range — no new financial values.
  const rows = useMemo<ChartRow[]>(() => {
    const asOfMonth = asOf.slice(0, 7);
    let months;
    if (range === 'year') {
      months = projection.series;
    } else if (range === 'ytd') {
      months = projection.series.filter((m) => m.month <= asOfMonth);
    } else {
      months = projection.series.filter((m) => m.month === selectedMonth);
    }
    return months.map((m) => ({
      month: m.month,
      label: monthLabel(m.month, range === 'monthly'),
      kind: m.kind,
      revenue: m.revenue,
      expenses: m.expenses,
      net: m.net,
      revenue_actual: m.kind === 'actual' ? m.revenue : null,
      revenue_projected: m.kind === 'projected' ? m.revenue : null,
      expenses_actual: m.kind === 'actual' ? m.expenses : null,
      expenses_projected: m.kind === 'projected' ? m.expenses : null,
      net_actual: m.kind === 'actual' ? m.net : null,
      net_projected: m.kind === 'projected' ? m.net : null,
    }));
  }, [projection, range, selectedMonth, asOf]);

  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? '';

  return (
    <section className="card" aria-label={chartCopy.title}>
      <div className="card-header">
        <h2 className="card-title">{chartCopy.title}</h2>
      </div>

      <div className="card-body">
        <div className="row between">
          <div className="chart-range-group" aria-label={chartCopy.rangeGroupAria}>
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                className="chart-range-btn"
                aria-pressed={range === r.value}
                onClick={() => setRange(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
          {range === 'monthly' ? (
            <select
              className="chart-month-select"
              aria-label={chartCopy.monthSelectAria}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {projection.series.map((m) => (
                <option key={m.month} value={m.month}>
                  {monthLabel(m.month, true)}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      <div className="card-body flush">
        <div className="chart-scroll">
          <div
            role="img"
            aria-label={chartCopy.imageAria(rangeLabel)}
          >
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e7ec" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#667085' }} />
                <YAxis tickFormatter={(v: number) => formatBaniAxis(v)} tick={{ fontSize: 12, fill: '#667085' }} />
                <Tooltip content={<FinancialChartTooltip />} />
                {METRICS.map((m) => (
                  <Line
                    key={`${m.key}_actual`}
                    dataKey={`${m.key}_actual`}
                    name={m.label}
                    type="monotone"
                    stroke={m.color}
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 0, fill: m.color }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
                {METRICS.map((m) => (
                  <Line
                    key={`${m.key}_projected`}
                    dataKey={`${m.key}_projected`}
                    name={m.label}
                    type="monotone"
                    stroke={m.color}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={{ r: 3, strokeWidth: 0, fill: m.color }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card-body">
        <div className="chart-legend" aria-hidden="true">
          {METRICS.map((m) => (
            <span key={m.key} className="chart-legend-item">
              <span className="chart-legend-swatch" style={{ borderTopColor: m.color }} />
              {m.label}
            </span>
          ))}
          <span className="chart-legend-item">
            <span className="chart-legend-swatch dashed projection" />
            {chartCopy.projectedLegend}
          </span>
        </div>

        {tax !== null && tax.status === 'computed' ? (
          <p className="chart-tax-note" data-estimate-state="computed">
            {/* Task 1: `YTD` is only said when the amount really is actuals-to-date. */}
            {estimateFigureLabel(tax.basis)}:{' '}
            <strong className="mono">{formatBaniRON(tax.output.total)}</strong>
          </p>
        ) : tax === null ? (
          /* TASK 8: there is no calculation to review. This branch used to print the adapter's
             `loading` sentinel reason — an internal token inside a sentence a person reads. */
          <p className="chart-tax-note" data-estimate-state="unavailable">
            {estimateStateCopy.unavailable}
          </p>
        ) : (
          <p className="chart-tax-note" data-estimate-state="review_required">
            {chartCopy.taxNoteReview} {tax.reason}
          </p>
        )}

        <div className="visually-hidden">
          {/* The .visually-hidden wrapper already clips the wide SR table. */}
          <div>
            <table>
            <caption>
              {chartCopy.tableCaption(rangeLabel)}
            </caption>
            <thead>
              <tr>
                <th scope="col">{chartCopy.columns.period}</th>
                <th scope="col">{chartCopy.columns.revenue}</th>
                <th scope="col">{chartCopy.columns.expenses}</th>
                <th scope="col">{chartCopy.columns.net}</th>
              </tr>
            </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month}>
                <th scope="row">{r.label}</th>
                <td>
                  {formatBaniRON(r.revenue)} — {stateLabel(r.kind)}
                </td>
                <td>
                  {formatBaniRON(r.expenses)} — {stateLabel(r.kind)}
                </td>
                <td>
                  {formatBaniRON(r.net)} — {stateLabel(r.kind)}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
          </div>
        </div>
      </div>
    </section>
  );
}
