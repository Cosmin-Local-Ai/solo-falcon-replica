import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StoreProvider } from '../data/store';
import Declarations from './Declarations';

describe('Declarations edit flow (regression)', () => {
  it('updates an existing declaration in place instead of duplicating it', () => {
    render(
      <StoreProvider>
        <Declarations />
      </StoreProvider>,
    );

    // Seed: exactly one declaration on the default "inregistrata" tab — 2026-09 with venituri 9.680,00 RON.
    const countRows = () => document.querySelectorAll('tbody tr').length;
    expect(countRows()).toBe(1);
    expect(screen.getByText('9.680,00 RON')).toBeInTheDocument();

    // Open the edit form by clicking the row.
    act(() => {
      screen.getByText('2026-09').click();
    });

    // Change only the venituri amount (first '0,00' input in the form); leave the status field untouched.
    const venituri = screen.getAllByPlaceholderText('0,00')[0];
    act(() => {
      fireEvent.change(venituri, { target: { value: '10000' } });
    });

    act(() => {
      screen.getByText('Salvează').click();
    });

    // No duplicate row was created and the edited value is displayed.
    expect(countRows()).toBe(1);
    expect(screen.getByText('10.000,00 RON')).toBeInTheDocument();
  });

  it('preserves the existing status when editing only amounts (no status regression)', () => {
    render(
      <StoreProvider>
        <Declarations />
      </StoreProvider>,
    );

    act(() => {
      screen.getByText('2026-09').click();
    });

    // The form initializes its status field from the existing declaration.
    const selects = screen.getAllByRole('combobox');
    expect(selects[selects.length - 1]).toHaveValue('inregistrata');

    // Change only the venituri amount; leave the status field untouched.
    const venituri = screen.getAllByPlaceholderText('0,00')[0];
    act(() => {
      fireEvent.change(venituri, { target: { value: '10000' } });
    });

    act(() => {
      screen.getByText('Salvează').click();
    });

    // The row is updated in place and the original status label is preserved.
    expect(document.querySelectorAll('tbody tr').length).toBe(1);
    expect(screen.getByText('10.000,00 RON')).toBeInTheDocument();
    expect(screen.getByText('Înregistrată')).toBeInTheDocument();
  });
});
