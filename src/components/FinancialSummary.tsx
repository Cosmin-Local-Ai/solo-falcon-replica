import type { YtdTotals } from '../domain/aggregation';
import { formatBaniRON } from '../domain/money';
import { summary as summaryCopy } from '../ui/copy';

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
      <div className="card-header">
        <h2 className="card-title">{summaryCopy.title}</h2>
      </div>
      <div className="card-body">
        <div className="grid grid-2">
          <StatCard label={summaryCopy.revenue} value={formatBaniRON(summary.revenue)} />
          <StatCard label={summaryCopy.expenses} value={formatBaniRON(summary.expenses)} />
          <StatCard
            label={summaryCopy.net}
            value={formatBaniRON(summary.net)}
            tone={summary.net < 0 ? 'neg' : undefined}
          />
        </div>
      </div>
    </section>
  );
}
