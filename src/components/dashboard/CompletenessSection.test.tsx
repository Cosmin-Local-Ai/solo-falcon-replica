import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompletenessSection from './CompletenessSection';
import type { CompletenessReport } from '../../domain/completeness';
import { lei } from '../../domain/money';

function makeState(overrides: Partial<CompletenessReport> = {}): CompletenessReport {
  return {
    checks: [
      { key: 'profile', satisfied: true, detail: 'Profil complet.' },
      { key: 'income', satisfied: false, detail: 'Niciun venit înregistrat.' },
    ],
    satisfiedCount: 1,
    totalCount: 2,
    coverage: { recordedBani: lei(10000), includedBani: lei(9000), percent: 90 },
    ...overrides,
  };
}

describe('CompletenessSection (Step 32 — CompletenessReport-driven)', () => {
  it('shows the real satisfied/total counts, no invented score', () => {
    render(<CompletenessSection completeness={makeState()} />);
    expect(screen.getByText('1 din 2 verificări îndeplinite')).toBeInTheDocument();
  });

  // PG-1: the percentage is no longer "invented" — it is a division of two amounts the report carries.
  it('shows the amount-weighted coverage the report carries', () => {
    render(<CompletenessSection completeness={makeState()} />);
    expect(screen.getByText('Din sumele înregistrate, intră în estimare')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('se ponderază sumele așa cum sunt înregistrate; o sumă în valută fără curs nu are echivalent în lei de ponderat')).toBeInTheDocument();
  });

  it('states that nothing is recorded instead of claiming 0% of nothing', () => {
    render(
      <CompletenessSection
        completeness={makeState({
          coverage: { recordedBani: lei(0), includedBani: lei(0), percent: null },
        })}
      />,
    );
    expect(screen.getByText('Nicio sumă înregistrată de ponderat.')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
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
          checks: [{ key: 'statements', satisfied: false, detail: 'Fără situații de taxe.' }],
          satisfiedCount: 0,
          totalCount: 1,
        })}
      />,
    );
    expect(screen.getByText('Declarații fiscale')).toBeInTheDocument();
    expect(screen.getByText('Lipsă')).toBeInTheDocument();
    expect(screen.queryByText('Complet')).not.toBeInTheDocument();
  });

  // PG-1: the row that used to be labelled „Estimare impozit” reported whether a calculation had run.
  // It is gone, and its label is gone with it — a label with no check behind it is how a dead row
  // comes back.
  it('no longer renders an „Estimare impozit” row', () => {
    render(<CompletenessSection completeness={makeState()} />);
    expect(screen.queryByText('Estimare impozit')).not.toBeInTheDocument();
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
