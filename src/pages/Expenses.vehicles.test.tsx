/**
 * PG-6c (D-VEH-3) — the expense register is the only place a running cost can be attached to a car, and
 * the row is where the consequence of not attaching it becomes visible.
 *
 * Four properties, one per failure this surface could hide:
 *
 * - **the control exists only once a car is declared.** With no vehicles there is nothing to attribute the
 *   cost to, and the expense keeps art. 68 alin. (7) lit. k)'s statutory 50 % default — the form must not
 *   change for a register that has never declared a car.
 * - **the link is written only by the person.** The hint says the app does not guess the vehicle from the
 *   supplier, the category token or a CAEN code.
 * - **an unattributed vehicle cost while cars are declared is visible on its own row**, in the same
 *   per-record vocabulary the hero uses — not silently classified by another car's facts.
 * - **a designated car does not make the other car look settled**: one row carries no note, the other does.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import Expenses from './Expenses';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import type { Expense, Vehicle } from '../data/types';
import { ron } from '../domain/money';
import { unpinClock, pinClock } from '../test/clock';
import { fixedInstant } from '../test/fixedInstant';
import { vehicles as vehiclesCopy, expenses as expensesCopy } from '../ui/copy';

const STORAGE_KEY = 'pfa-app-data-v2';

function expense(over: Partial<Expense>): Expense {
  return {
    id: over.id ?? 'veh-exp',
    tip: 'factura',
    nr: 'CH-2026-700',
    date: '2026-05-10',
    furnizor: 'Furnizor Test',
    cui: 'RO99999999',
    valoareFaraTva: ron(2000),
    tva: ron(400),
    status: 'inregistrata',
    category: 'vehicle_related',
    ...over,
  };
}

type CarFacts = Omit<Vehicle['years'][number], 'fiscalYear'>;

function car(id: string, facts: CarFacts = {}): Vehicle {
  return { id, label: `Mașina ${id}`, years: [{ ...facts, fiscalYear: 2026 }] };
}

function seedWith(expenses: Expense[], vehicles: Vehicle[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...seedData,
      expenses: [...seedData.expenses, ...expenses],
      vehicles,
      version: CURRENT_DATA_VERSION,
    }),
  );
}

function renderPage() {
  return render(
    <StoreProvider>
      <Expenses />
    </StoreProvider>,
  );
}

function noteFor(recordId: string): string | null {
  const row = document.querySelector(`tr[data-record-id="${recordId}"]`);
  return row?.querySelector('[data-not-in-estimate]')?.textContent ?? null;
}

function vehicleFor(recordId: string): string | null {
  const row = document.querySelector(`tr[data-record-id="${recordId}"]`);
  return row?.querySelector('[data-expense-vehicle]')?.textContent ?? null;
}

function openNewForm(): void {
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: /Adaugă cheltuială/ }));
  });
}

function stored(): { expenses: Expense[] } {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) as string) as { expenses: Expense[] };
}

beforeEach(() => {
  localStorage.clear();
  pinClock(fixedInstant());
});
afterEach(() => {
  cleanup();
  unpinClock();
  localStorage.clear();
});

describe('the attribution control', () => {
  it('is absent while the register declares no vehicle, so the form is unchanged for those profiles', () => {
    seedWith([expense({ id: 'v-none' })], []);
    renderPage();
    openNewForm();
    expect(screen.queryByText(vehiclesCopy.expense.field)).toBeNull();
  });

  it('appears once a vehicle is declared, and lists the cars by the person’s own name', () => {
    seedWith([expense({ id: 'v-one' })], [car('v1', { usedByPerson: 'da' })]);
    renderPage();
    openNewForm();
    expect(screen.getByText(vehiclesCopy.expense.field)).toBeInTheDocument();
    expect(screen.getByText('Mașina v1')).toBeInTheDocument();
  });

  it('writes the link only when the person picks a car, and writes absence for „niciun vehicul”', () => {
    seedWith([], [car('v1', { usedByPerson: 'da' })]);
    renderPage();
    openNewForm();
    act(() => {
      const vehicleSelect = document.querySelector('[data-vehicle-select]') as HTMLSelectElement;
      fireEvent.change(vehicleSelect, { target: { value: 'v1' } });
      fireEvent.change(screen.getByPlaceholderText(expensesCopy.documentNumberPlaceholder), { target: { value: 'CH-2026-777' } });
      fireEvent.change(screen.getByPlaceholderText('SC … SA'), { target: { value: 'Furnizor Test' } });
      const amounts = screen.getAllByPlaceholderText('0,00');
      fireEvent.change(amounts[0], { target: { value: '500' } });
      fireEvent.change(amounts[1], { target: { value: '100' } });
      fireEvent.click(screen.getByRole('button', { name: 'Adaugă' }));
    });
    expect(stored().expenses.some(e => e.nr === 'CH-2026-777' && e.vehicleId === 'v1')).toBe(true);

    // And the same form with the control left on „niciun vehicul” stores no link at all — not an empty
    // string, which would fail the load gate on the next read.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Adaugă cheltuială/ }));
    });
    act(() => {
      fireEvent.change(screen.getByPlaceholderText(expensesCopy.documentNumberPlaceholder), { target: { value: 'CH-2026-778' } });
      fireEvent.change(screen.getByPlaceholderText('SC … SA'), { target: { value: 'Furnizor Test' } });
      const amounts = screen.getAllByPlaceholderText('0,00');
      fireEvent.change(amounts[0], { target: { value: '500' } });
      fireEvent.change(amounts[1], { target: { value: '100' } });
      fireEvent.click(screen.getByRole('button', { name: 'Adaugă' }));
    });
    const unattributed = stored().expenses.find(e => e.nr === 'CH-2026-778');
    expect('vehicleId' in (unattributed ?? {})).toBe(false);
  });

  it('says out loud that the app does not guess the vehicle', () => {
    seedWith([], [car('v1', { usedByPerson: 'da' })]);
    renderPage();
    openNewForm();
    expect(document.body.textContent).toContain('Aplicația nu ghicește vehiculul după furnizor');
  });
});

describe('the row shows the car, and shows what an unattributed cost did not enter', () => {
  it('an attributed cost names its car on the row', () => {
    seedWith(
      [expense({ id: 'v-att', vehicleId: 'v1' })],
      [car('v1', { usedByPerson: 'da', use: 'mixed' })],
    );
    renderPage();
    expect(vehicleFor('v-att')).toBe('Vehicul: Mașina v1');
    // 50 % by the statutory default — it is IN the estimate, so no out-of-estimate note.
    expect(noteFor('v-att')).toBeNull();
  });

  it('an unattributed vehicle cost, with cars declared, is out of the estimate and says so on its row', () => {
    seedWith([expense({ id: 'v-orfan' })], [car('v1', { usedByPerson: 'da', use: 'mixed' })]);
    renderPage();
    expect(noteFor('v-orfan')).toBe('nu intră în estimare: regulă fără faptă consemnată');
    expect(vehicleFor('v-orfan')).toBeNull();
  });

  it('a link to a deleted car is shown as unattributed, not repaired onto another car', () => {
    seedWith([expense({ id: 'v-stale', vehicleId: 'gone' })], [car('v1', { usedByPerson: 'da' })]);
    renderPage();
    expect(noteFor('v-stale')).toBe('nu intră în estimare: regulă fără faptă consemnată');
    expect(vehicleFor('v-stale')).toBeNull();
  });

  it('with no cars declared the same expense is NOT flagged — the statutory default still applies', () => {
    seedWith([expense({ id: 'v-default' })], []);
    renderPage();
    expect(noteFor('v-default')).toBeNull();
  });
});

describe('acceptance 4 and 5 in the register', () => {
  it('a car the taxpayer does not use keeps its costs, beside a designated taxpayer-used car', () => {
    seedWith(
      [
        expense({ id: 'r-personal', vehicleId: 'v1' }),
        expense({ id: 'r-employee', vehicleId: 'v2' }),
      ],
      [
        car('v1', { usedByPerson: 'da', use: 'mixed', designatedForRunningCosts: 'da' }),
        car('v2', { usedByPerson: 'nu', use: 'mixed' }),
      ],
    );
    renderPage();
    expect(noteFor('r-personal')).toBeNull();
    expect(noteFor('r-employee')).toBeNull();
  });

  it('the designated car computes and the other one is visibly unsettled', () => {
    seedWith(
      [
        expense({ id: 'd-aleasa', vehicleId: 'v1' }),
        expense({ id: 'd-cealalta', vehicleId: 'v2' }),
      ],
      [
        car('v1', { usedByPerson: 'da', use: 'mixed', designatedForRunningCosts: 'da' }),
        car('v2', { usedByPerson: 'da', use: 'mixed' }),
      ],
    );
    renderPage();
    expect(noteFor('d-aleasa')).toBeNull();
    expect(noteFor('d-cealalta')).toBe('nu intră în estimare: regulă fără faptă consemnată');
  });

  it('with two candidates and no designation, neither row is presented as settled', () => {
    seedWith(
      [expense({ id: 'n-x', vehicleId: 'v1' }), expense({ id: 'n-y', vehicleId: 'v2' })],
      [car('v1', { usedByPerson: 'da', use: 'mixed' }), car('v2', { usedByPerson: 'da', use: 'mixed' })],
    );
    renderPage();
    expect(noteFor('n-x')).toBe('nu intră în estimare: regulă fără faptă consemnată');
    expect(noteFor('n-y')).toBe('nu intră în estimare: regulă fără faptă consemnată');
  });
});

describe('acceptance 5 — the register carries BOTH readings where the law leaves two', () => {
  it('the banner quotes reading A and reading B verbatim, not the one the app finds likelier', () => {
    seedWith(
      [expense({ id: 'b-aleasa', vehicleId: 'v1' }), expense({ id: 'b-cealalta', vehicleId: 'v2' })],
      [
        car('v1', { usedByPerson: 'da', use: 'mixed', designatedForRunningCosts: 'da' }),
        car('v2', { usedByPerson: 'da', use: 'mixed' }),
      ],
    );
    renderPage();
    const banner = document.querySelector('[data-vehicle-unresolved-detail]');
    expect(banner).not.toBeNull();
    const text = banner?.textContent ?? '';
    expect(text).toContain('CITEȘTE A');
    expect(text).toContain('sumele sau bunurile utilizate de contribuabil pentru uzul personal');
    expect(text).toContain('CITEȘTE B');
    expect(text).toContain('conform art. 68 alin. (4) și (5)');
    expect(text).toContain('cel mult un singur autoturism aferent fiecărei persoane');
  });

  it('the banner says these costs are not settled, and the designated car is not among them', () => {
    seedWith(
      [expense({ id: 'c-aleasa', vehicleId: 'v1' })],
      [car('v1', { usedByPerson: 'da', use: 'mixed', designatedForRunningCosts: 'da' })],
    );
    renderPage();
    expect(document.querySelector('[data-vehicle-unresolved]')).toBeNull();
    expect(noteFor('c-aleasa')).toBeNull();
  });

  it('an unattributed vehicle cost explains that this is the app’s limit, not the law’s answer', () => {
    seedWith([expense({ id: 'u-orfan' })], [car('v1', { usedByPerson: 'da' })]);
    renderPage();
    const text = document.querySelector('[data-vehicle-unresolved-detail]')?.textContent ?? '';
    expect(text).toContain('Aceasta este o limită a aplicației, nu un răspuns al legii');
    expect(text).toContain('legea rămâne la 50 %');
  });
});
