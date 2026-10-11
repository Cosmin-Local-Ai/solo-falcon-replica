/**
 * PG-1 — the coverage rows under the hero figure.
 *
 * The badge says the estimate is incomplete. These rows are what makes that actionable: one row per
 * reason group, with the count, the amount that left the figure, and a link onto the record. This file
 * pins that a group is a REASON and not a record, that a mixed-unit group refuses to show a sum, and
 * that a legally non-deductible record never produces a row at all.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import EstimateCoverageRows from './EstimateCoverage';
import type { EstimateCoverageGap } from '../../domain/estimateBasis';
import { type Bani } from '../../domain/money';

function gap(over: Partial<EstimateCoverageGap> & { recordId: string }): EstimateCoverageGap {
  return {
    kind: 'expense',
    reason: 'unclassified',
    amount: 200000 as Bani,
    currency: 'RON',
    fixTarget: `/expenses#!/registered?f=${over.recordId}`,
    detail: 'detaliu test',
    ...over,
  };
}

describe('EstimateCoverageRows', () => {
  it('renders nothing when there is no gap to report', () => {
    const { container } = render(<EstimateCoverageRows coverage={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('does not turn a legal non-deductibility into a coverage row', () => {
    const { container } = render(
      <EstimateCoverageRows coverage={[gap({ recordId: 'e2', reason: 'non_deductible' })]} />,
    );
    expect(container.querySelector('[data-estimate-coverage]')).toBeNull();
  });

  it('groups by reason: nine uncategorised records are one row, not nine', () => {
    render(
      <EstimateCoverageRows
        coverage={Array.from({ length: 9 }, (_, i) => gap({ recordId: `e${i}` }))}
      />,
    );
    const rows = document.querySelectorAll('[data-coverage-reason]');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('fără categorie');
    expect(rows[0].textContent).toContain('9 înregistrări');
  });

  it('one row per reason group, each with its own link to the first record of that group', () => {
    render(
      <EstimateCoverageRows
        coverage={[
          gap({ recordId: 'e1', reason: 'unclassified' }),
          gap({
            recordId: 'e2',
            reason: 'missing_fx_rate',
            kind: 'revenue',
            currency: 'EUR',
            amount: 500000 as Bani,
            fixTarget: '/revenues#!/registered?f=e2',
          }),
          gap({ recordId: 'e3', reason: 'asset_not_modelled' }),
        ]}
      />,
    );
    expect(document.querySelectorAll('[data-coverage-reason]')).toHaveLength(3);
    // The first group's link is the one that must point at the first record of THAT group.
    const links = screen.getAllByRole('link', { name: 'Deschide înregistrarea' });
    expect(links.map(l => l.getAttribute('href'))).toEqual([
      '/expenses#!/registered?f=e1',
      '/revenues#!/registered?f=e2',
      '/expenses#!/registered?f=e3',
    ]);
    expect(screen.getByText('fără curs BNR înregistrat')).toBeInTheDocument();
    expect(screen.getByText('mijloc fix fără registru de amortizare')).toBeInTheDocument();
  });

  it('shows the amount with the unit it is written in', () => {
    render(
      <EstimateCoverageRows coverage={[gap({ recordId: 'e1', amount: 200000 as Bani, currency: 'RON' })]} />,
    );
    expect(screen.getByText('2.000,00 RON')).toBeInTheDocument();
  });

  it('shows a foreign amount as that currency, never as lei', () => {
    render(
      <EstimateCoverageRows
        coverage={[gap({ recordId: 'e1', reason: 'missing_fx_rate', currency: 'EUR', amount: 500000 as Bani })]}
      />,
    );
    expect(screen.getByText('5.000,00 EUR')).toBeInTheDocument();
    expect(screen.queryByText('5.000,00 RON')).not.toBeInTheDocument();
  });

  it('refuses to sum a group whose records are written in different units', () => {
    render(
      <EstimateCoverageRows
        coverage={[
          gap({ recordId: 'e1', reason: 'missing_fx_rate', currency: 'EUR', amount: 500000 as Bani }),
          gap({ recordId: 'e2', reason: 'missing_fx_rate', currency: 'USD', amount: 450000 as Bani }),
        ]}
      />,
    );
    const row = document.querySelector('[data-coverage-reason="missing_fx_rate"]');
    expect(row?.textContent).toContain('2 înregistrări');
    expect(row?.textContent).not.toContain('lei');
    expect(row?.textContent).not.toContain('EUR');
  });

  it('counts the records, not the groups, in the heading', () => {
    render(
      <EstimateCoverageRows
        coverage={[
          gap({ recordId: 'e1', reason: 'unclassified' }),
          gap({ recordId: 'e2', reason: 'unclassified' }),
          gap({ recordId: 'e3', reason: 'cap_unresolved' }),
        ]}
      />,
    );
    expect(document.querySelector('[data-coverage-count]')).toHaveAttribute('data-coverage-count', '3');
  });

  it('a scenario gap shows its reason and its link, and shows no amount for it (PG-6a)', () => {
    // A missing profile fact did not take a sum out of the figure. Rendering `0,00 lei` beside it would
    // put a number on screen for an amount nobody ever recorded — the same mistake the mixed-unit group
    // above refuses to make, in the opposite direction.
    render(
      <EstimateCoverageRows
        coverage={[
          gap({
            recordId: 'scenario:test-vehicle-fact',
            kind: 'profile',
            reason: 'fact_missing',
            amount: null,
            fixTarget: '/settings#!/fiscal',
          }),
        ]}
      />,
    );
    const row = document.querySelector('[data-coverage-reason="fact_missing"]');
    expect(row?.textContent).toContain('faptă de profil care lipsește');
    expect(row?.querySelector('a')?.getAttribute('href')).toBe('/settings#!/fiscal');
    expect(row?.textContent).not.toMatch(/0,00/);
  });

  it('a group holding a scenario gap shows no total rather than a total that counts it as zero', () => {
    render(
      <EstimateCoverageRows
        coverage={[
          gap({ recordId: 'e1', reason: 'fact_missing' }),
          gap({
            recordId: 'scenario:test-vehicle-fact',
            kind: 'profile',
            reason: 'fact_missing',
            amount: null,
            fixTarget: '/settings#!/fiscal',
          }),
        ]}
      />,
    );
    const row = document.querySelector('[data-coverage-reason="fact_missing"]');
    expect(row?.textContent).toContain('2 înregistrări');
    expect(row?.textContent).not.toMatch(/\d[.,]\d{2}\s*(RON|lei)/);
  });
});
