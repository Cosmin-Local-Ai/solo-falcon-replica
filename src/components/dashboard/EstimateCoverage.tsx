import { useMemo } from 'react';
import { isGapReason, type CoverageReason, type EstimateCoverageGap } from '../../domain/estimateBasis';
import { formatMoney, money, sumBani, type Bani } from '../../domain/money';
import { dashboard as dashboardCopy } from '../../ui/copy';

/**
 * PG-1 — the coverage rows under the hero figure.
 *
 * The hero used to be able to say „Calculat” while records sat outside the figure it described. These
 * rows are the half that made the claim false, listed by REASON rather than by record: a profile with
 * nine uncategorised invoices has one thing to fix, and nine rows would bury the two that matter.
 *
 * Presentational only. The grouping is the only thing computed here; the reason, the amount, the unit
 * and the route each arrive on the gap the assembler or the ledger disclosure produced. Nothing here
 * re-classifies a record, re-looks-up a rate, or re-walks a register — and the deep link is the same
 * `/<page>#!/<tab>?f=<id>` form `data/attention.ts` already uses, so the link and the register page's
 * own focus handling cannot drift apart.
 */

const coverageCopy = dashboardCopy.estimate.coverage;

interface ReasonGroup {
  reason: CoverageReason;
  count: number;
  /**
   * The group's amount, formatted WITH its unit, or `null` when the group mixes units. A group holding
   * a lei record and a EUR record with no rate has no sum — adding those two numbers would produce a
   * figure in a unit neither record was written in, which is the same error the register footers refuse
   * to make.
   */
  amount: string | null;
  href: string;
  /**
   * The assembler's own sentences, shown when the group is small enough that they are also the whole
   * answer. B-106 is the reason this exists: a refusal the user cannot read is not a refusal, it is a dead
   * end, and the conflict sentence is the one that names the asset.
   *
   * The limit is not decoration. A group of nine uncategorised invoices is one thing to fix and nine
   * near-identical sentences, and nine rows would bury it — the same reason the rows group by REASON at
   * all. A group of two conflicting assets is two assets that each have to be named, so the sentences are
   * shown there. Three is where the first case starts and the second ends.
   */
  details: string[];
}

function groupByReason(coverage: readonly EstimateCoverageGap[]): ReasonGroup[] {
  const byReason = new Map<CoverageReason, EstimateCoverageGap[]>();
  for (const gap of coverage) {
    if (!isGapReason(gap.reason)) continue;
    const list = byReason.get(gap.reason);
    if (list) list.push(gap);
    else byReason.set(gap.reason, [gap]);
  }
  // Insertion order, which is the assembler's own record order: deterministic for identical input,
  // and it puts the reason the estimate hit first where a reader looks first.
  return [...byReason.entries()].map(([reason, items]) => {
    const units = new Set(items.map(i => i.currency));
    // A `profile` gap carries no amount at all (PG-6a): a missing profile fact did not take a sum out of
    // the figure. A group with such a row in it shows no total rather than a total that quietly counts
    // the missing row as zero.
    const amounts = items.map(i => i.amount).filter((a): a is Bani => a !== null);
    return {
      reason,
      count: items.length,
      amount: amounts.length === items.length && units.size === 1
        ? formatMoney(money(sumBani(amounts), items[0].currency))
        : null,
      href: items[0].fixTarget,
      details: items.length <= 3 ? items.map(i => i.detail).filter(d => d !== '') : [],
    };
  });
}

export interface EstimateCoverageRowsProps {
  coverage: readonly EstimateCoverageGap[];
}

export default function EstimateCoverageRows({ coverage }: EstimateCoverageRowsProps) {
  const groups = useMemo(() => groupByReason(coverage), [coverage]);
  if (groups.length === 0) return null;
  const records = groups.reduce((sum, g) => sum + g.count, 0);
  return (
    <div className="estimate-coverage" data-estimate-coverage>
      <div className="estimate-coverage-title" data-coverage-count={records}>
        {coverageCopy.title} ·{' '}
        {records === 1 ? coverageCopy.countOne : coverageCopy.countMany(records)}
      </div>
      {groups.map(g => (
        <div className="row between estimate-coverage-row" key={g.reason} data-coverage-reason={g.reason}>
          <span>
            <span className="muted">{coverageCopy.reasonLabels[g.reason]}</span>
            {' '}· {g.count === 1 ? coverageCopy.countOne : coverageCopy.countMany(g.count)}
            {g.amount !== null && (
              <> · <span className="mono">{g.amount}</span>
              </>
            )}
          </span>
          <a className="btn btn-sm" href={g.href}>{coverageCopy.open}</a>
        </div>
      ))}
      {groups.flatMap(g => g.details.map((d, i) => (
        <div className="hint" key={`detail-${g.reason}-${i}`} data-coverage-detail={g.reason}>{d}</div>
      )))}
      <div className="hint">{coverageCopy.amountUnitNote}</div>
    </div>
  );
}
