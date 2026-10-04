import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActionSection from './ActionSection';
import type { ActionItem } from '../../data/dashboard';

function makeActions(): ActionItem[] {
  return [
    { id: 'deadline-cas-q1', label: 'cas_quarterly', source: 'deadline' },
    { id: 'completeness-profile', label: 'profile', source: 'completeness' },
    { id: 'completeness-statements', label: 'statements', source: 'completeness' },
    { id: 'tax-review', label: 'Revizuire estimări fiscale', source: 'tax' },
  ];
}

describe('ActionSection (Step 31 — ActionItem-driven)', () => {
  it('renders every real action item, in the data layer order', () => {
    render(<ActionSection actions={makeActions()} />);
    expect(screen.getByText('CAS trimestrial')).toBeInTheDocument();
    expect(screen.getByText('Revizuire estimări fiscale')).toBeInTheDocument();
    expect(screen.getByText('4 item de rezolvat')).toBeInTheDocument();
  });

  it('shows the source badge for each item (deadline / completeness / tax)', () => {
    render(<ActionSection actions={makeActions()} />);
    expect(screen.getByText('Termen limită')).toBeInTheDocument();
    expect(screen.getAllByText('Completitudine').length).toBe(2);
    expect(screen.getByText('Impozit')).toBeInTheDocument();
  });

  it('maps completeness raw keys to plain-language Romanian display labels', () => {
    render(<ActionSection actions={makeActions()} />);
    expect(screen.getByText('Profil')).toBeInTheDocument();
    expect(screen.getByText('Declarații fiscale')).toBeInTheDocument();
    // The raw keys are not shown as labels.
    expect(screen.queryByText('profile')).not.toBeInTheDocument();
    expect(screen.queryByText('statements')).not.toBeInTheDocument();
  });

  it('falls back to the raw key for unknown completeness keys (no item dropped)', () => {
    render(
      <ActionSection
        actions={[{ id: 'completeness-future', label: 'futureKey', source: 'completeness' }]}
      />,
    );
    expect(screen.getByText('futureKey')).toBeInTheDocument();
    expect(screen.getByText('1 item de rezolvat')).toBeInTheDocument();
  });

  it('shows the honest up-to-date state when there are no action items', () => {
    render(<ActionSection actions={[]} />);
    expect(screen.getByText('Totul este la zi — nimic nu necesită atenție.')).toBeInTheDocument();
    expect(screen.getByText('Nimic nu necesită atenția ta în acest moment.')).toBeInTheDocument();
  });
});
