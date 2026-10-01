import type { PendingCounts } from '../../data/dashboard';
import { Card } from '../ui/card';

interface ActionSectionProps {
  pendingCounts: PendingCounts;
}

interface PendingItem {
  label: string;
  count: number;
}

export default function ActionSection({ pendingCounts }: ActionSectionProps) {
  const items: PendingItem[] = [
    { label: 'Revenues awaiting declaration', count: pendingCounts.revenuesInAsteptare },
    { label: 'Rejected revenues to review', count: pendingCounts.revenuesRespinsa },
    { label: 'Rejected expenses to review', count: pendingCounts.expensesRespinsa },
    { label: 'Declarations awaiting filing', count: pendingCounts.declarationsInAsteptare },
  ];

  const allClear = items.every((item) => item.count === 0);

  return (
    <Card>
      <h2>What you need to do</h2>
      {allClear ? (
        <p className="muted">You're all caught up — no pending items.</p>
      ) : (
        <ul className="list">
          {items.map((item) => (
            <li key={item.label}>
              <span className="label">{item.label}</span>
              <span className={item.count > 0 ? 'value' : 'value muted'}>
                {item.count > 0 ? item.count : '✓'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
