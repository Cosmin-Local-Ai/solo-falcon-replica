import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StoreProvider, STORAGE_KEY } from '../data/store';
import { CURRENT_DATA_VERSION, DATA_VERSION_RECORD_CURRENCY } from '../data/migration';
import { seedData } from '../data/seed';
import type { AnnualFiling } from '../data/types';
import type { LegacyMonthlyDeclaration } from '../data/schema';
import { lei } from '../domain/money';
import Declarations from './Declarations';

/**
 * PG-5 re-pin (replaced, not deleted): this regression used to edit a monthly declaration row. The
 * record is annual now — `AnnualFiling` — and the edit flow it guards runs through the annual register.
 * What the test protects has not changed: editing a record updates it in place and does not quietly
 * reset a field the user did not touch.
 *
 * PG-5b: the monthly row below is no longer a record the page can show. It is loaded as legacy input —
 * a pre-v11 payload's `declarations` key — so the page is exercised against the bytes an old install
 * really holds, and the assertion is that nothing from that key reaches the screen.
 */
const FILING: AnnualFiling = {
  id: 'f26',
  taxYear: 2026,
  form: 'D212',
  status: 'in_pregatire',
  reference: 'REF-2026-001',
};

const LEGACY_ROW: LegacyMonthlyDeclaration = {
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
    }),
  );
  return render(
    <StoreProvider>
      <Declarations />
    </StoreProvider>,
  );
}

/** The same register, loaded from bytes one version behind the chain's head and still carrying a row. */
function renderFromPreV11Payload() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...seedData,
      version: DATA_VERSION_RECORD_CURRENCY,
      filings: [FILING],
      declarations: [LEGACY_ROW],
    }),
  );
  return render(
    <StoreProvider>
      <Declarations />
    </StoreProvider>,
  );
}

/** Rows of the annual register. */
function filingRows() {
  // PG-6g: the page now also carries the VAT calendar, the D300 rubric layout and the parked-list tables,
  // so „the first table on the page" is no longer the annual register. The selector names the register
  // rather than its position — which is what this helper was always for.
  return document.querySelectorAll('table[data-register="d212"] tbody tr');
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

  it('shows no monthly register at all, even when the stored payload carries one', () => {
    // PG-5b re-premise of "shows the legacy monthly rows read-only, with no write control". What the test
    // has always guarded is that the monthly family gets no affordance and no standing as a filing. The
    // answer is now stronger: there is no second table, no monthly row and no monthly heading, because the
    // `annual-filing` step drops those rows before the page can read them.
    renderFromPreV11Payload();

    // One annual register — and the annual row is in it. PG-6g added other tables to this page (the VAT
    // calendar, the D300 rubric layout, the parked lists), so the pin is on the D212 register being single,
    // not on the page holding exactly one table. What has not changed is that no monthly register is among
    // them: the `annual-filing` step drops those rows before the page can read them.
    expect(document.querySelectorAll('table[data-register="d212"]')).toHaveLength(1);
    expect(filingRows()).toHaveLength(1);

    // Nothing from the legacy key reached the screen: not the period, not the amounts, not the row id.
    expect(screen.queryByText('2026-09')).toBeNull();
    expect(screen.queryByText('9.680,00 RON')).toBeNull();
    expect(document.querySelector('[data-record-id="d3"]')).toBeNull();
  });
});
