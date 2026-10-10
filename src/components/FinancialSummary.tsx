import type { LedgerDisclosure } from '../data/dashboard';
import type { YtdTotals } from '../domain/aggregation';
import { formatBaniRON } from '../domain/money';
import { fx, summary as summaryCopy } from '../ui/copy';

interface FinancialSummaryProps {
  summary: YtdTotals;
  /**
   * Phase 10c (B-37) — what the ledger pass did to the records behind these three numbers. Optional so a
   * caller that has no ledger view can still render the totals, but every production call site passes it:
   * a lei total that quietly leaves a foreign record out is the defect this prop exists to prevent.
   */
  ledger?: LedgerDisclosure;
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className={tone ? `value mono ${tone}` : 'value mono'}>{value}</div>
    </div>
  );
}

export default function FinancialSummary({ summary, ledger }: FinancialSummaryProps) {
  const unconverted = ledger?.unconverted ?? [];
  const provisional = ledger?.conversions.some(c => c.provisional) ?? false;
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

        {/* The totals above are lei totals. A foreign record with no recorded rate is not in them, and the
            card says so on its face — the numbers must not be allowed to look complete. */}
        {unconverted.length > 0 ? (
          <p className="hint summary-unconverted" data-unconverted-count={unconverted.length}>
            <strong className="mono">{fx.ledger.unconvertedLead(unconverted.length)}</strong>{' '}
            {fx.ledger.unconvertedTail}
          </p>
        ) : null}

        {/* A provisional rate is provisional inside a total too, not only in the rate register. */}
        {provisional ? (
          <p className="hint summary-provisional" data-provisional-in-total="true">
            {fx.ledger.provisionalInTotal}
          </p>
        ) : null}
      </div>
    </section>
  );
}
