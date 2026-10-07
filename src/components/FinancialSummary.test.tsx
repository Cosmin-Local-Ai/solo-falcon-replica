import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import FinancialSummary from './FinancialSummary';
import { lei } from '../domain/money';

describe('FinancialSummary', () => {
  it('renders Venituri / Cheltuieli / Profit net with formatted values', () => {
    render(<FinancialSummary summary={{ revenue: lei(156000), expenses: lei(54000), net: lei(102000), revenueNet: lei(156000), expenseNet: lei(54000) }} />);
    expect(screen.getByText('Venituri')).toBeInTheDocument();
    expect(screen.getByText('Cheltuieli')).toBeInTheDocument();
    expect(screen.getByText('Profit net')).toBeInTheDocument();
    expect(screen.getByText('156.000,00 RON')).toBeInTheDocument();
    expect(screen.getByText('54.000,00 RON')).toBeInTheDocument();
    expect(screen.getByText('102.000,00 RON')).toBeInTheDocument();
  });

  it('renders plain zero when values are 0 (no invented empty state)', () => {
    render(<FinancialSummary summary={{ revenue: lei(0), expenses: lei(0), net: lei(0), revenueNet: lei(0), expenseNet: lei(0) }} />);
    expect(screen.getByText('Venituri')).toBeInTheDocument();
    expect(screen.getByText('Cheltuieli')).toBeInTheDocument();
    expect(screen.getByText('Profit net')).toBeInTheDocument();
    expect(screen.getAllByText('0,00 RON')).toHaveLength(3);
  });

  it('renders negative net honestly (not hidden)', () => {
    render(<FinancialSummary summary={{ revenue: lei(40000), expenses: lei(60000), net: lei(-20000), revenueNet: lei(40000), expenseNet: lei(60000) }} />);
    const value = screen.getByText('-20.000,00 RON');
    expect(value).toBeInTheDocument();
    // Negative net keeps the `neg` tone — it is displayed, not suppressed.
    expect(value.className).toContain('neg');
  });
});
