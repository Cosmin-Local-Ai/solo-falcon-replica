import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import TaxReserve from './TaxReserve';
import type { TaxReserveRecommendation } from '../domain/taxReserve';

function makeReserve(overrides: Partial<TaxReserveRecommendation> = {}): TaxReserveRecommendation {
  return {
    estimatedTaxLiability: 120000,
    reservedAmount: 30000,
    remainingTarget: 90000,
    monthsRemaining: 6,
    recommendedMonthlyReserve: 15000,
    ...overrides,
  };
}

describe('TaxReserve', () => {
  it('renders the reserve hero value (recommended cash reserve)', () => {
    render(<TaxReserve reserve={makeReserve()} />);
    expect(screen.getByText('Recomandat de pus deoparte lunar')).toBeInTheDocument();
    expect(screen.getByText('15.000,00 RON')).toBeInTheDocument();
  });

  it('renders the estimated liability as a distinct stat when present', () => {
    render(<TaxReserve reserve={makeReserve()} />);
    expect(screen.getByText('Estimare obligație fiscală')).toBeInTheDocument();
    expect(screen.getByText('120.000,00 RON')).toBeInTheDocument();
  });

  it('renders the honest "no estimate" state when estimatedTaxLiability === null (never zero)', () => {
    render(<TaxReserve reserve={makeReserve({ estimatedTaxLiability: null })} />);
    expect(
      screen.getByText(
        'Nu există o estimare fiscală disponibilă — rezerva recomandată nu poate fi calculată.',
      ),
    ).toBeInTheDocument();
    // No hero figure, no liability stat, and no fabricated zero.
    expect(screen.queryByText('Recomandat de pus deoparte lunar')).not.toBeInTheDocument();
    expect(screen.queryByText('Estimare obligație fiscală')).not.toBeInTheDocument();
    expect(screen.queryByText(/0,00 RON/)).not.toBeInTheDocument();
  });

  it('shows the remaining target and months left as supporting text', () => {
    render(<TaxReserve reserve={makeReserve()} />);
    expect(screen.getByText('Rămâne de pus deoparte 90.000,00 RON în următoarele 6 luni.')).toBeInTheDocument();
  });

  it('shows "fully covered" when the remaining target is 0', () => {
    render(<TaxReserve reserve={makeReserve({ reservedAmount: 120000, remainingTarget: 0 })} />);
    expect(screen.getByText('Rezerva este complet acoperită.')).toBeInTheDocument();
  });
});
