import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StoreProvider } from '../data/store';
import Clients from './Clients';

describe('Clients (Step 25 — Defect 1)', () => {
  // Do not leak persisted state (e.g. renamed clients) between tests.
  beforeEach(() => {
    localStorage.clear();
  });
  it('editing a client updates it in place instead of duplicating it', () => {
    render(
      <StoreProvider>
        <Clients />
      </StoreProvider>,
    );

    // 3 seeded clients: header count plus 3 body rows (plus 1 header row).
    expect(screen.getByText('3 clienți înregistrați în evidența dvs.')).toBeTruthy();
    const rowsBefore = screen.getAllByRole('row').length;

    // Open the edit form for an existing client.
    act(() => {
      screen.getByText('Presta Consulting SRL').click();
    });
    expect(screen.getByText('Editează Presta Consulting SRL')).toBeTruthy();

    // Change the denumire field.
    act(() => {
      fireEvent.change(screen.getByPlaceholderText('SC EXEMPLU SRL / Nume (PFA)'), {
        target: { value: 'Presta Consulting SA' },
      });
    });

    // Save.
    act(() => {
      screen.getByText('Salvează').click();
    });

    // No duplicate: client count unchanged, and the edited value is displayed.
    expect(screen.getByText('3 clienți înregistrați în evidența dvs.')).toBeTruthy();
    expect(screen.getAllByRole('row').length).toBe(rowsBefore);
    expect(screen.getByText('Presta Consulting SA')).toBeTruthy();
  });

  it('preserves the existing email when editing only denumire (no email regression)', () => {
    render(
      <StoreProvider>
        <Clients />
      </StoreProvider>,
    );

    // Open the edit form for the seeded client that has an email.
    act(() => {
      screen.getByText('Presta Consulting SRL').click();
    });

    // The form initializes the email field from the existing client.
    expect(screen.getByPlaceholderText('email@exemplu.ro')).toHaveValue('contact@presta.ro');

    // Change only the denumire field; leave the email untouched.
    act(() => {
      fireEvent.change(screen.getByPlaceholderText('SC EXEMPLU SRL / Nume (PFA)'), {
        target: { value: 'Presta Consulting SA' },
      });
    });

    act(() => {
      screen.getByText('Salvează').click();
    });

    // The client is updated in place and the original email is preserved.
    expect(screen.getByText('Presta Consulting SA')).toBeTruthy();
    expect(screen.getByText('contact@presta.ro')).toBeTruthy();
  });
});
