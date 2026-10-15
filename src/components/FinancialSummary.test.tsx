import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import FinancialSummary from './FinancialSummary';
import { lei, money } from '../domain/money';
import { fx } from '../ui/copy';

describe('FinancialSummary', () => {
  it('renders Venituri / Cheltuieli / Profit net with formatted values', () => {
    render(<FinancialSummary summary={{ revenue: lei(156000), expenses: lei(54000), net: lei(102000), revenueNet: lei(156000), expenseNet: lei(54000), dpiGross: lei(0), dpiGrossNet: lei(0), dpiRecordIds: [], dpiDeclaredRecordIds: [], dpiQuotaGross: lei(0), dpiExcludedGross: lei(0) }} />);
    expect(screen.getByText('Venituri')).toBeInTheDocument();
    expect(screen.getByText('Cheltuieli')).toBeInTheDocument();
    expect(screen.getByText('Profit net')).toBeInTheDocument();
    expect(screen.getByText('156.000,00 RON')).toBeInTheDocument();
    expect(screen.getByText('54.000,00 RON')).toBeInTheDocument();
    expect(screen.getByText('102.000,00 RON')).toBeInTheDocument();
  });

  it('renders plain zero when values are 0 (no invented empty state)', () => {
    render(<FinancialSummary summary={{ revenue: lei(0), expenses: lei(0), net: lei(0), revenueNet: lei(0), expenseNet: lei(0), dpiGross: lei(0), dpiGrossNet: lei(0), dpiRecordIds: [], dpiDeclaredRecordIds: [], dpiQuotaGross: lei(0), dpiExcludedGross: lei(0) }} />);
    expect(screen.getByText('Venituri')).toBeInTheDocument();
    expect(screen.getByText('Cheltuieli')).toBeInTheDocument();
    expect(screen.getByText('Profit net')).toBeInTheDocument();
    expect(screen.getAllByText('0,00 RON')).toHaveLength(3);
  });

  it('renders negative net honestly (not hidden)', () => {
    render(<FinancialSummary summary={{ revenue: lei(40000), expenses: lei(60000), net: lei(-20000), revenueNet: lei(40000), expenseNet: lei(60000), dpiGross: lei(0), dpiGrossNet: lei(0), dpiRecordIds: [], dpiDeclaredRecordIds: [], dpiQuotaGross: lei(0), dpiExcludedGross: lei(0) }} />);
    const value = screen.getByText('-20.000,00 RON');
    expect(value).toBeInTheDocument();
    // Negative net keeps the `neg` tone — it is displayed, not suppressed.
    expect(value.className).toContain('neg');
  });

  /**
   * Phase 10c (B-37). The card is where a user reads "revenue", so it is where an incomplete total has to
   * be labelled incomplete. A foreign record left out of the lei totals must show up here, not only in a
   * separate section further down the page.
   */
  it('says the totals are not complete when a foreign record is left out', () => {
    render(
      <FinancialSummary
        summary={{ revenue: lei(0), expenses: lei(0), net: lei(0), revenueNet: lei(0), expenseNet: lei(0), dpiGross: lei(0), dpiGrossNet: lei(0), dpiRecordIds: [], dpiDeclaredRecordIds: [], dpiQuotaGross: lei(0), dpiExcludedGross: lei(0) }}
        ledger={{
          conversions: [],
          unconverted: [
            {
              id: 'rev-eur-1', kind: 'revenue', currency: 'EUR',
              amount: money(lei(1000), 'EUR'),
              detail: 'niciun curs BNR înregistrat pentru EUR la data 2026-10-08',
            },
          ],
        }}
      />,
    );
    const notice = document.querySelector('[data-unconverted-count]');
    expect(notice?.getAttribute('data-unconverted-count')).toBe('1');
    expect(notice?.textContent).toContain(fx.ledger.unconvertedLead(1));
    expect(notice?.textContent).toContain(fx.ledger.unconvertedTail);
  });

  it('labels a converted total provisional when the rate behind it is provisional', () => {
    render(
      <FinancialSummary
        summary={{ revenue: lei(5000), expenses: lei(0), net: lei(5000), revenueNet: lei(5000), expenseNet: lei(0), dpiGross: lei(0), dpiGrossNet: lei(0), dpiRecordIds: [], dpiDeclaredRecordIds: [], dpiQuotaGross: lei(0), dpiExcludedGross: lei(0) }}
        ledger={{
          conversions: [{
            recordKind: 'revenue', recordId: 'rev-eur-1', currency: 'EUR',
            onDate: '2026-10-09', onDateSource: 'date', basis: 'payment_date_daily',
            citation: 'art. 9 alin. (3) lit. b) + alin. (4) Codul fiscal; art. 68 alin. (2) lit. a)',
            rate: '5.0000', netRecorded: money(lei(1000), 'EUR'), vatRecorded: money(lei(0), 'EUR'),
            netLei: lei(5000), vatLei: lei(0), provisional: true,
            seriesCode: 'CURSZ_EUR-TEST', sourceUrl: 'https://example.invalid/x', fetchedAt: '2026-10-09T09:00:00Z',
          }],
          unconverted: [],
        }}
      />,
    );
    expect(document.querySelector('[data-provisional-in-total]')?.textContent).toBe(fx.ledger.provisionalInTotal);
  });

  it('stays quiet when nothing foreign was left out', () => {
    render(
      <FinancialSummary
        summary={{ revenue: lei(100), expenses: lei(0), net: lei(100), revenueNet: lei(100), expenseNet: lei(0), dpiGross: lei(0), dpiGrossNet: lei(0), dpiRecordIds: [], dpiDeclaredRecordIds: [], dpiQuotaGross: lei(0), dpiExcludedGross: lei(0) }}
        ledger={{ conversions: [], unconverted: [] }}
      />,
    );
    expect(document.querySelector('[data-unconverted-count]')).toBeNull();
    expect(document.querySelector('[data-provisional-in-total]')).toBeNull();
  });
});
