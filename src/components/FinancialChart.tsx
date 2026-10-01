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
import { fmtRON } from '../data/types';

type Range = 'monthly' | 'ytd' | 'year';

type MetricKey = 'revenue' | 'expenses' | 'net';

const METRICS: ReadonlyArray<{ key: MetricKey; label: string; color: string }> = [
  { key: 'revenue', label: 'Venituri', color: '#1d4ed8' },
  { key: 'expenses', label: 'Cheltuieli', color: '#f04438' },
  { key: 'net', label: 'Profit net', color: '#12b76a' },
];

const RANGES: ReadonlyArray<{ value: Range; label: string }> = [
  { value: 'monthly', label: 'Lunar' },
  { value: 'ytd', label: 'YTD' },
  { value: 'year', label: 'An' },
];

const MONTH_LABELS = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noe', 'Dec'];

const plain = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 });

function monthLabel(month: string, withYear: boolean): string {
  const [year, m] = month.split('-');
  const label = MONTH_LABELS[Number(m) - 1] ?? month;
  return withYear ? `${label} ${year}` : label;
}

function stateLabel(kind: 'actual' | 'projected'): string {
  return kind === 'actual' ? 'Realizat' : 'Proiecție';
}

interface ChartRow {
  month: string;
  label: string;
  kind: 'actual' | 'projected';
  revenue: number;
  expenses: number;
  net: number;
  revenue_actual: number | null;
  revenue_projected: number | null;
  expenses_actual: number | null;
  expenses_projected: number | null;
  net_actual: number | null;
  net_projected: number | null;
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
        value: p.value as number,
        state: stateLabel(kind),
      };
    });
  if (items.length === 0) return null;
  return (
    <div className="chart-tooltip" role="status">
      <div className="chart-tooltip-period">{label}</div>
      {items.map((item) => (
        <div key={item.metric}>
          {item.metric} · {item.state}: {fmtRON(item.value)}
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
    <section className="card" aria-label="Grafic financiar">
      <div className="card-head">
        <h2 className="card-title">Grafic financiar</h2>
      </div>

      <div className="card-body">
        <div className="row between">
          <div className="chart-range-group" aria-label="Interval afișat">
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
              aria-label="Lună selectată"
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
            aria-label={`Grafic ${rangeLabel} — venituri, cheltuieli și profit net în lei; segmente solide = realizat, segmente punctate = proiecție.`}
          >
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e7ec" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#667085' }} />
                <YAxis tickFormatter={(v: number) => plain.format(v)} tick={{ fontSize: 12, fill: '#667085' }} />
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
            <span className="chart-legend-swatch dashed" style={{ borderTopColor: '#667085' }} />
            Proiecție (linia punctată)
          </span>
        </div>

        {tax.status === 'computed' ? (
          <p className="chart-tax-note">
            Estimare impozit YTD: <strong className="mono">{fmtRON(tax.output.total)}</strong>
          </p>
        ) : (
          <p className="chart-tax-note">Estimare impozit: revizuire necesară — {tax.reason}</p>
        )}

        <div className="visually-hidden">
          {/* Clipping wrapper: the wide SR table must not widen the document. */}
          <div style={{ width: 1, height: 1, overflow: 'hidden' }}>
            <table>
            <caption>
            Grafic financiar — interval {rangeLabel}. Perioadă, venituri, cheltuieli, profit net (lei) și
            stare (realizat/proiecție).
          </caption>
          <thead>
            <tr>
              <th scope="col">Perioadă</th>
              <th scope="col">Venituri</th>
              <th scope="col">Cheltuieli</th>
              <th scope="col">Profit net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month}>
                <th scope="row">{r.label}</th>
                <td>
                  {fmtRON(r.revenue)} — {stateLabel(r.kind)}
                </td>
                <td>
                  {fmtRON(r.expenses)} — {stateLabel(r.kind)}
                </td>
                <td>
                  {fmtRON(r.net)} — {stateLabel(r.kind)}
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
