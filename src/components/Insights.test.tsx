import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Insights from './Insights';
import type { Insight } from '../domain/insights';

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: 'insight-1',
    eventType: 'DEADLINE_APPROACHING',
    severity: 'warning',
    priority: 'medium',
    title: 'Tax deadline approaching: CASS',
    description: 'The "CASS" deadline is in 12 days (2026-07-15).',
    action: 'Plan to complete this filing within the next 30 days.',
    conditions: { daysUntil: 12, date: '2026-07-15' },
    ...overrides,
  };
}

describe('Insights', () => {
  it('renders the honest "Ești la zi" state for an empty array (no fabricated warnings)', () => {
    render(<Insights insights={[]} />);
    expect(
      screen.getByText('Ești la zi. Nu există probleme de rezolvat în momentul de față.'),
    ).toBeInTheDocument();
  });

  it('renders severity badge, title, description and action for each insight', () => {
    render(<Insights insights={[makeInsight()]} />);
    expect(screen.getByText('Tax deadline approaching: CASS')).toBeInTheDocument();
    expect(screen.getByText('Atenție')).toBeInTheDocument();
    expect(screen.getByText('The "CASS" deadline is in 12 days (2026-07-15).')).toBeInTheDocument();
    expect(screen.getByText('Plan to complete this filing within the next 30 days.')).toBeInTheDocument();
  });

  it('maps severity to the right badge label', () => {
    render(
      <Insights
        insights={[makeInsight({ id: 'a', severity: 'info' }), makeInsight({ id: 'b', severity: 'danger' })]}
      />,
    );
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('renders all insights when multiple are present', () => {
    render(
      <Insights
        insights={[
          makeInsight({ id: 'a', title: 'First insight' }),
          makeInsight({ id: 'b', title: 'Second insight' }),
          makeInsight({ id: 'c', title: 'Third insight' }),
        ]}
      />,
    );
    expect(screen.getByText('First insight')).toBeInTheDocument();
    expect(screen.getByText('Second insight')).toBeInTheDocument();
    expect(screen.getByText('Third insight')).toBeInTheDocument();
  });
});
