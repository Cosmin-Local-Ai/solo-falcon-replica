import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompletenessSection from './CompletenessSection';
import type { CompletenessReport } from '../../domain/completeness';

function makeState(overrides: Partial<CompletenessReport> = {}): CompletenessReport {
  return {
    checks: [
      { key: 'profile', satisfied: true, detail: 'Profil complet.' },
      { key: 'income', satisfied: false, detail: 'Niciun venit înregistrat.' },
    ],
    satisfiedCount: 1,
    totalCount: 2,
    ...overrides,
  };
}

describe('CompletenessSection (Step 32 — CompletenessReport-driven)', () => {
  it('shows the real satisfied/total counts, no invented percentage or score', () => {
    render(<CompletenessSection completeness={makeState()} />);
    expect(screen.getByText('1 din 2 verificări îndeplinite')).toBeInTheDocument();
  });

  it('lists every check with its real satisfied state and detail', () => {
    render(<CompletenessSection completeness={makeState()} />);
    expect(screen.getByText('Profil')).toBeInTheDocument();
    expect(screen.getByText('Venituri înregistrate')).toBeInTheDocument();
    expect(screen.getByText('Profil complet.')).toBeInTheDocument();
    expect(screen.getByText('Niciun venit înregistrat.')).toBeInTheDocument();
  });

  it('marks satisfied checks Complet and unsatisfied checks Lipsă (Romanian badges)', () => {
    render(<CompletenessSection completeness={makeState()} />);
    expect(screen.getByText('Complet')).toBeInTheDocument();
    expect(screen.getByText('Lipsă')).toBeInTheDocument();
  });

  it('keeps unsatisfied checks visible (no state dropped)', () => {
    render(
      <CompletenessSection
        completeness={makeState({
          checks: [{ key: 'taxEstimate', satisfied: false, detail: 'Fără estimare.' }],
          satisfiedCount: 0,
          totalCount: 1,
        })}
      />,
    );
    expect(screen.getByText('Estimare impozit')).toBeInTheDocument();
    expect(screen.getByText('Lipsă')).toBeInTheDocument();
    expect(screen.queryByText('Complet')).not.toBeInTheDocument();
  });

  it('shows the honest empty state when there are no checks', () => {
    render(
      <CompletenessSection
        completeness={makeState({ checks: [], satisfiedCount: 0, totalCount: 0 })}
      />,
    );
    expect(screen.getByText('Nicio verificare de completitudine')).toBeInTheDocument();
  });
});
