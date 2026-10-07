import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { StoreProvider, useStore } from './store';
import { useFinancialDerived, useTaxDerived } from './derived';
import { lei } from '../domain/money';

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
            valoareFaraTva: lei(1000),
            tva: lei(190),
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
            valoareFaraTva: lei(200),
            tva: lei(38),
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
      <span data-testid="identity-nume">{store.profile.identity.nume}</span>
      <button onClick={() => store.updateProfile({ vatExempt: true, cashFloorLei: lei(7500) })}>change-tax-inputs</button>
      {/* Phase 7 (F-2): every identity field, including the three absorbed in D-1. */}
      <button
        onClick={() =>
          store.updateProfile({
            identity: {
              ...store.profile.identity,
              nume: 'Popescu Andrei Schimbat',
              email: 'nou@example.test',
              codTvaIntra: 'RO9999999999999',
              caen: [{ cod: '6202', descriere: 'Alta activitate' }],
              mentiuniFactura: 'De plata la 30 de zile.',
            },
          })
        }
      >
        change-identity
      </button>
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
    // This test-local harness prints the stored amount verbatim, so the numbers read here are BANI
    // (a numeric probe, not app UI — no screen ever shows this). Deltas must therefore be in bani.
    expect(Number(screen.getByTestId('ytd-revenue').textContent)).toBe(beforeRevenue + 119_000);
    expect(Number(screen.getByTestId('ytd-net').textContent)).toBe(beforeNet + 119_000);
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
    expect(Number(screen.getByTestId('ytd-expenses').textContent)).toBe(beforeExpenses + 23_800);
    expect(Number(screen.getByTestId('ytd-net').textContent)).toBe(beforeNet - 23_800);
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

  it('leaves inputsKey untouched when identity changes (F-2)', () => {
    // Identity is deliberately NOT part of the tax inputs key. If it were, every
    // name / email / CAEN edit would invalidate the fiscal cache and — once
    // snapshots are persisted — look like a change in the fiscal inputs themselves.
    render(
      <StoreProvider>
        <TaxProbe />
      </StoreProvider>,
    );
    const beforeKey = screen.getByTestId('tax-inputs-key').textContent;
    const beforeStatus = screen.getByTestId('tax-status').textContent;
    expect(screen.getByTestId('identity-nume').textContent).toBe('Popescu Andrei');

    act(() => {
      screen.getByText('change-identity').click();
    });

    // The identity really did change…
    expect(screen.getByTestId('identity-nume').textContent).toBe('Popescu Andrei Schimbat');
    // …and the fiscal inputs key and status did not.
    expect(screen.getByTestId('tax-inputs-key').textContent).toBe(beforeKey);
    expect(screen.getByTestId('tax-status').textContent).toBe(beforeStatus);
  });
});
