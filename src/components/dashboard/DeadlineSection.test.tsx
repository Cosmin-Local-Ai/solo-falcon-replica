import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DeadlineSection from './DeadlineSection';
import type { Deadline } from '../../domain/deadlines';

const AS_OF = '2026-03-01';

function makeDeadline(overrides: Partial<Deadline> = {}): Deadline {
  return {
    deadlineId: 'dl-1',
    taxYear: 2026,
    eventType: 'cas_quarterly',
    date: '2026-03-25',
    dateFormula: 'last day of the quarter',
    appliesTo: 'PFA — contribuție socială de asigurări sociale de sănătate',
    legalSource: { act: 'OUG 157/2017', article: 'art. 42' },
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    status: 'active',
    ...overrides,
  };
}

describe('DeadlineSection (Step 32 — Romanian, no raw enums)', () => {
  it('renders the Romanian title, description, item label, and days remaining', () => {
    render(<DeadlineSection deadlines={[makeDeadline()]} asOfDate={AS_OF} />);
    expect(screen.getByText('Termene limită')).toBeInTheDocument();
    expect(screen.getByText('Termene limită viitoare de depunere, la data de 01.03.2026')).toBeInTheDocument();
    expect(screen.getByText('CAS trimestrial')).toBeInTheDocument();
    expect(screen.getByText(/25\.03\.2026 \(24 zile rămase\)/)).toBeInTheDocument();
  });

  it('uses the singular Romanian form for exactly one day', () => {
    render(
      <DeadlineSection
        deadlines={[makeDeadline({ deadlineId: 'dl-2', date: '2026-03-02' })]}
        asOfDate={AS_OF}
      />,
    );
    expect(screen.getByText(/02\.03\.2026 \(1 zi rămasă\)/)).toBeInTheDocument();
  });

  it('shows the honest Romanian empty state when there are no upcoming deadlines', () => {
    render(<DeadlineSection deadlines={[]} asOfDate={AS_OF} />);
    expect(screen.getByText('Niciun termen limită viitor')).toBeInTheDocument();
  });

  it('does not render past deadlines as upcoming', () => {
    render(
      <DeadlineSection
        deadlines={[makeDeadline({ deadlineId: 'dl-3', date: '2026-02-15' })]}
        asOfDate={AS_OF}
      />,
    );
    expect(screen.getByText('Niciun termen limită viitor')).toBeInTheDocument();
  });

  it('renders the Romanian status badge, never the raw enum value', () => {
    render(<DeadlineSection deadlines={[makeDeadline()]} asOfDate={AS_OF} />);
    expect(screen.getByText('Activ', { selector: '.badge' })).toBeInTheDocument();
    expect(screen.queryByText('active')).not.toBeInTheDocument();
  });
});
