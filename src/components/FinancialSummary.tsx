import type { YtdTotals } from '../domain/aggregation';
import { formatBaniRON } from '../domain/money';

interface FinancialSummaryProps {
  summary: YtdTotals;
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className={tone ? `value mono ${tone}` : 'value mono'}>{value}</div>
    </div>
  );
}

export default function FinancialSummary({ summary }: FinancialSummaryProps) {
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Rezumat</h2>
      </div>
      <div className="card-body">
        <div className="grid grid-2">
          <StatCard label="Venituri" value={formatBaniRON(summary.revenue)} />
          <StatCard label="Cheltuieli" value={formatBaniRON(summary.expenses)} />
          <StatCard
            label="Profit net"
            value={formatBaniRON(summary.net)}
            tone={summary.net < 0 ? 'neg' : undefined}
          />
        </div>
      </div>
    </section>
  );
}
