/**
 * B-114 acceptance 2 (brief 74) — the published „TVA nedeductibilă 10.500" is on the screen a person reads.
 *
 * The domain suite proves the number. This proves the surface, because the defect was never only
 * arithmetic: `nonRecoverableTotal` existed, was read by nothing, and for a line under the art. 298
 * alin. (1) 50 % vehicle restriction reported 0 lei. A person shown a deductible half and no loss
 * concludes the restriction never applied to them. `docs/ai/research/47_published_worked_examples_fy2026.md`
 * §101-103 prints both halves of the same line — „TVA deductibilă 10.500" and „TVA nedeductibilă 10.500" —
 * and the app showed one of them.
 *
 * What is asserted:
 *  - the figure itself, formatted, beside the deductible figure, in the same disclosure;
 *  - that it is the **rule-derived** half and not `total − claimable`: the register below also holds a line
 *    whose VAT outcome is unresolved, and the subtraction would print a larger number;
 *  - that the figure is never added to the tax estimate and never described as a filed amount.
 *
 * What is deliberately NOT asserted: any movement in the tax figure. B-114 is a reporting surface. The
 * separate question — whether non-recoverable VAT enters the deductible expense — is B-87, still open,
 * and the copy on screen says so rather than settling it.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Dashboard from './Dashboard';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import type { AppData, Expense, Vehicle } from '../data/types';
import { ron } from '../domain/money';
import { pinClock, unpinClock } from '../test/clock';
import { fixedInstant } from '../test/fixedInstant';

/**
 * The published line: 100.000 lei net, 21.000 lei TVA, a mixed-use car. art. 298 alin. (1) gives 50 %,
 * so the deductible half is 10.500 lei and the non-recoverable half is 10.500 lei.
 */
const VEHICLE_LINE: Expense = {
  id: 'exp-b114-vehicle',
  tip: 'factura',
  nr: 'B114-0001',
  date: '2026-03-10',
  paid: '2026-03-10',
  furnizor: 'Service auto',
  cui: 'RO1234567',
  valoareFaraTva: ron(100_000),
  tva: ron(21_000),
  status: 'inregistrata',
  category: 'vehicle_related',
  vehicleId: 'veh-b114',
  vatFacts: {
    destination: 'taxabila',
    supplierRegime: 'inregistrat',
    documentKind: 'factura',
    eFactura: 'da',
  },
};

/**
 * A second line whose VAT outcome the app has **not** decided — the supplier standing was never declared.
 * It is here to prove the reported figure is derived per line from the rule, not recovered by subtracting
 * the claimable total from the VAT total: the subtraction would sweep this line's 8.000 lei in and print
 * 18.500 lei, which is not a figure the law supports either way.
 */
const UNDECIDED_LINE: Expense = {
  ...VEHICLE_LINE,
  id: 'exp-b114-undecided',
  nr: 'B114-0002',
  date: '2026-04-10',
  paid: '2026-04-10',
  valoareFaraTva: ron(38_095),
  tva: ron(8_000),
  vehicleId: undefined,
  vatFacts: { destination: 'nedeclarata' },
};

const VEHICLE: Vehicle = {
  id: 'veh-b114',
  label: 'Autoturism de lucru',
  years: [{ fiscalYear: 2026, use: 'mixed' }],
  vatYears: [{ fiscalYear: 2026, use: 'mixed' }],
};

function payload(): AppData {
  return {
    ...seedData,
    version: CURRENT_DATA_VERSION,
    profile: { ...seedData.profile, vatRegistration: { status: 'inregistrat_art316', effectiveFrom: '2026-01-01' } },
    vehicles: [VEHICLE],
    expenses: [...seedData.expenses, VEHICLE_LINE, UNDECIDED_LINE],
  } as AppData;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('pfa-app-data-v2', JSON.stringify(payload()));
  pinClock(fixedInstant());
});

afterEach(() => {
  cleanup();
  unpinClock();
  localStorage.clear();
});

describe('B-114 — the non-recoverable figure is on the surface that already shows the deductible one', () => {
  it('the disclosure prints 10.500,00 lei of TVA nedeductibilă', async () => {
    render(
      <StoreProvider>
        <Dashboard />
      </StoreProvider>,
    );
    const figure = await screen.findByTestId('input-vat-non-recoverable');
    expect(figure.textContent).toBe('10.500,00 RON');
  });

  it('the figure is rule-derived, not `total − claimable`: the undecided line is not counted as lost', async () => {
    // The subtraction this brief forbids would read 18.500,00 lei here, because it books the 8.000 lei of
    // an undecided line as non-recoverable. Asserting the smaller number is what pins the derivation.
    render(
      <StoreProvider>
        <Dashboard />
      </StoreProvider>,
    );
    const figure = await screen.findByTestId('input-vat-non-recoverable');
    expect(figure.textContent).not.toBe('18.500,00 RON');
    expect(figure.textContent).toBe('10.500,00 RON');
  });

  it('the two published halves sit in the same disclosure, and the note names what the figure is not', async () => {
    render(
      <StoreProvider>
        <Dashboard />
      </StoreProvider>,
    );
    const figure = await screen.findByTestId('input-vat-non-recoverable');
    // Both halves of the published pair are on screen, not one of them.
    expect(document.body.textContent).toContain('10.500,00');
    // B-87 is still open, and the screen says so instead of quietly adding the loss to the expense.
    expect(figure.closest('.estimate-input-vat')?.textContent).toContain('nu este adăugată la cheltuiala deductibilă');
  });
});
