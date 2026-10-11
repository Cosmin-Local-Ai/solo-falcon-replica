import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StoreProvider, STORAGE_KEY } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import type { AnnualFiling, Declaration } from '../data/types';
import { lei } from '../domain/money';
import Declarations from './Declarations';

/**
 * PG-5 re-pin (replaced, not deleted): this regression used to edit a monthly declaration row. The
 * record is annual now — `AnnualFiling` — and the monthly family is read-only, so the edit flow it
 * guards runs through the annual register. What the test protects has not changed: editing a record
 * updates it in place and does not quietly reset a field the user did not touch.
 *
 * The legacy row below is here because the page shows both families at once, and the row-count
 * assertions are only meaningful if the second table is present while they run.
 */
const FILING: AnnualFiling = {
  id: 'f26',
  taxYear: 2026,
  form: 'D212',
  status: 'in_pregatire',
  reference: 'REF-2026-001',
};

const LEGACY: Declaration = {
  id: 'd3',
  an: 2026,
  luna: 9,
  venituri: lei(9680),
  cheltuieli: lei(546),
  status: 'inregistrata',
  dataInregistrare: '2026-09-28',
};

function renderWithFiling() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...seedData,
      version: CURRENT_DATA_VERSION,
      filings: [FILING],
      legacyDeclarations: [LEGACY],
    }),
  );
  return render(
    <StoreProvider>
      <Declarations />
    </StoreProvider>,
  );
}

/** Rows of the annual register — the legacy table is a separate `<table>`. */
function filingRows() {
  return document.querySelectorAll('table')[0]!.querySelectorAll('tbody tr');
}

describe('Declarations edit flow (regression)', () => {
  it('updates an existing annual filing in place instead of duplicating it', () => {
    renderWithFiling();

    expect(filingRows()).toHaveLength(1);
    expect(screen.getByText('REF-2026-001')).toBeInTheDocument();

    // Open the edit form by clicking the row.
    act(() => {
      screen.getByText('2026').click();
    });

    // Change only the reference; leave the status select untouched.
    const reference = screen.getByDisplayValue('REF-2026-001');
    act(() => {
      fireEvent.change(reference, { target: { value: 'REF-2026-002' } });
    });
    act(() => {
      screen.getByText('Salvează').click();
    });

    // No duplicate row was created and the edited value is displayed.
    expect(filingRows()).toHaveLength(1);
    expect(screen.getByText('REF-2026-002')).toBeInTheDocument();
    // The year the return declares survived the round trip.
    expect(screen.getByText('2026')).toBeInTheDocument();
  });

  it('preserves the existing status when editing only the reference (no status regression)', () => {
    renderWithFiling();

    act(() => {
      screen.getByText('2026').click();
    });

    // The form initializes its status field from the existing filing.
    const selects = screen.getAllByRole('combobox');
    expect(selects[1]).toHaveValue('in_pregatire');

    act(() => {
      fireEvent.change(screen.getByDisplayValue('REF-2026-001'), { target: { value: 'REF-2026-002' } });
    });
    act(() => {
      screen.getByText('Salvează').click();
    });

    expect(filingRows()).toHaveLength(1);
    expect(screen.getByText('În pregătire')).toBeInTheDocument();
    expect(screen.getByText('REF-2026-002')).toBeInTheDocument();
  });

  it('marks a return filed from the row, and the filed date appears', () => {
    renderWithFiling();

    act(() => {
      screen.getByRole('button', { name: 'Marchează ca depusă' }).click();
    });

    expect(filingRows()).toHaveLength(1);
    expect(screen.getByText('Depusă')).toBeInTheDocument();
    // A date exists because the app was just told the return was filed — it is not backdated.
    const filedCell = filingRows()[0]!.querySelectorAll('td')[3]!.textContent;
    expect(filedCell).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  });

  it('shows the legacy monthly rows read-only, with no write control', () => {
    renderWithFiling();

    // The monthly row is still readable — it is the only place those figures exist.
    expect(screen.getByText('2026-09')).toBeInTheDocument();
    expect(screen.getByText('9.680,00 RON')).toBeInTheDocument();
    // And it carries no affordance: the store has no monthly write path any more.
    expect(document.querySelectorAll('table')[1]!.querySelectorAll('button')).toHaveLength(0);
    expect(document.querySelectorAll('table')[1]!.querySelectorAll('tr.clickable')).toHaveLength(0);
  });
});
