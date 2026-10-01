import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { StoreProvider, useStore } from './store';
import { useFinancialDerived, useTaxDerived } from './derived';

const AS_OF = '2026-12-31';

function FinancialProbe() {
  const view = useFinancialDerived(AS_OF);
  const store = useStore();
  return (
    <div>
      <span data-testid="ytd-revenue">{view.ytd.revenue}</span>
      <span data-testid="ytd-expenses">{view.ytd.expenses}</span>
      <span data-testid="ytd-net">{view.ytd.net}</span>
      <span data-testid="expense-lines">{view.lines.expenses.length}</span>
      <button
        onClick={() =>
          store.addRevenue({
            tip: 'factura',
            nr: 'FCT-2026-010',
            date: '2026-10-15',
            client: 'Client Nou',
            cui: '12345678',
            valoareFaraTva: 1000,
            tva: 190,
            status: 'inregistrata',
          })
        }
      >
        add-revenue
      </button>
      <button
        onClick={() =>
          store.addExpense({
            tip: 'bon-fiscal',
            nr: 'BF-888',
            date: '2026-10-20',
            furnizor: 'Furnizor Nou',
            cui: 'RO12345678',
            valoareFaraTva: 200,
            tva: 38,
            status: 'inregistrata',
          })
        }
      >
        add-expense
      </button>
    </div>
  );
}

function TaxProbe() {
  const view = useTaxDerived(AS_OF);
  const store = useStore();
  return (
    <div>
      <span data-testid="tax-status">{view.status}</span>
      <span data-testid="tax-inputs-key">{view.inputs.inputsKey}</span>
      <span data-testid="tax-rule-count">{view.activeRelease.ruleCount}</span>
      <button onClick={() => store.updateProfile({ vatExempt: true, cashFloorLei: 7500 })}>change-tax-inputs</button>
    </div>
  );
}

describe('useFinancialDerived (Step 14)', () => {
  it('recomputes automatically when income is added', () => {
    render(
      <StoreProvider>
        <FinancialProbe />
      </StoreProvider>,
    );
    const beforeRevenue = Number(screen.getByTestId('ytd-revenue').textContent);
    const beforeNet = Number(screen.getByTestId('ytd-net').textContent);
    act(() => {
      screen.getByText('add-revenue').click();
    });
    expect(Number(screen.getByTestId('ytd-revenue').textContent)).toBe(beforeRevenue + 1190);
    expect(Number(screen.getByTestId('ytd-net').textContent)).toBe(beforeNet + 1190);
  });

  it('recomputes automatically when an expense is added', () => {
    render(
      <StoreProvider>
        <FinancialProbe />
      </StoreProvider>,
    );
    const beforeExpenses = Number(screen.getByTestId('ytd-expenses').textContent);
    const beforeNet = Number(screen.getByTestId('ytd-net').textContent);
    const beforeLines = Number(screen.getByTestId('expense-lines').textContent);
    act(() => {
      screen.getByText('add-expense').click();
    });
    expect(Number(screen.getByTestId('ytd-expenses').textContent)).toBe(beforeExpenses + 238);
    expect(Number(screen.getByTestId('ytd-net').textContent)).toBe(beforeNet - 238);
    expect(Number(screen.getByTestId('expense-lines').textContent)).toBe(beforeLines + 1);
  });
});

describe('useTaxDerived (Step 14)', () => {
  it('recomputes automatically when profile tax inputs change', () => {
    render(
      <StoreProvider>
        <TaxProbe />
      </StoreProvider>,
    );
    expect(screen.getByTestId('tax-status').textContent).toBe('REVIEW_REQUIRED');
    const beforeKey = screen.getByTestId('tax-inputs-key').textContent;
    const ruleCount = screen.getByTestId('tax-rule-count').textContent;
    act(() => {
      screen.getByText('change-tax-inputs').click();
    });
    expect(screen.getByTestId('tax-inputs-key').textContent).not.toBe(beforeKey);
    // Release provenance is unaffected by a profile change.
    expect(screen.getByTestId('tax-rule-count').textContent).toBe(ruleCount);
  });
});
