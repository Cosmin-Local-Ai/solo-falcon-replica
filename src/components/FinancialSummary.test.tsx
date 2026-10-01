import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import FinancialSummary from './FinancialSummary';

describe('FinancialSummary', () => {
  it('renders Venituri / Cheltuieli / Profit net with formatted values', () => {
    render(<FinancialSummary summary={{ revenue: 156000, expenses: 54000, net: 102000 }} />);
    expect(screen.getByText('Venituri')).toBeInTheDocument();
    expect(screen.getByText('Cheltuieli')).toBeInTheDocument();
    expect(screen.getByText('Profit net')).toBeInTheDocument();
    expect(screen.getByText('156.000,00 RON')).toBeInTheDocument();
    expect(screen.getByText('54.000,00 RON')).toBeInTheDocument();
    expect(screen.getByText('102.000,00 RON')).toBeInTheDocument();
  });

  it('renders plain zero when values are 0 (no invented empty state)', () => {
    render(<FinancialSummary summary={{ revenue: 0, expenses: 0, net: 0 }} />);
    expect(screen.getByText('Venituri')).toBeInTheDocument();
    expect(screen.getByText('Cheltuieli')).toBeInTheDocument();
    expect(screen.getByText('Profit net')).toBeInTheDocument();
    expect(screen.getAllByText('0,00 RON')).toHaveLength(3);
  });

  it('renders negative net honestly (not hidden)', () => {
    render(<FinancialSummary summary={{ revenue: 40000, expenses: 60000, net: -20000 }} />);
    const value = screen.getByText('-20.000,00 RON');
    expect(value).toBeInTheDocument();
    // Negative net keeps the `neg` tone — it is displayed, not suppressed.
    expect(value.className).toContain('neg');
  });
});
