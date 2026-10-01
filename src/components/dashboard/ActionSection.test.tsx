import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActionSection from './ActionSection';
import type { PendingCounts } from '../../data/dashboard';

function makeCounts(overrides: Partial<PendingCounts> = {}): PendingCounts {
  return {
    revenuesInAsteptare: 2,
    revenuesRespinsa: 1,
    expensesRespinsa: 0,
    declarationsInAsteptare: 3,
    ...overrides,
  };
}

describe('ActionSection', () => {
  it('renders the four real pending counts as a checklist', () => {
    render(<ActionSection pendingCounts={makeCounts()} />);
    expect(screen.getByText('Revenues awaiting declaration')).toBeInTheDocument();
    expect(screen.getByText('Rejected revenues to review')).toBeInTheDocument();
    expect(screen.getByText('Rejected expenses to review')).toBeInTheDocument();
    expect(screen.getByText('Declarations awaiting filing')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('marks zero-count items as clear (✓) instead of hiding them', () => {
    render(<ActionSection pendingCounts={makeCounts()} />);
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('shows the honest all-clear state when all four counts are 0', () => {
    render(
      <ActionSection
        pendingCounts={makeCounts({
          revenuesInAsteptare: 0,
          revenuesRespinsa: 0,
          expensesRespinsa: 0,
          declarationsInAsteptare: 0,
        })}
      />,
    );
    expect(screen.getByText("You're all caught up — no pending items.")).toBeInTheDocument();
    expect(screen.queryByText('Revenues awaiting declaration')).not.toBeInTheDocument();
    expect(screen.queryByText('Declarations awaiting filing')).not.toBeInTheDocument();
  });
});
