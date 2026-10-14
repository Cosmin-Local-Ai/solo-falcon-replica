/**
 * PG-2 — the payment date on the expense side.
 *
 * The mirror of `Revenues.dates.test.tsx`, and the same three regressions: the UTC-seeded default (B-46),
 * the money date being writable without inventing one when it is absent, and the row naming the field its
 * fiscal year came from. The expense side is the one CF art. 68 alin. (4) lit. b) is explicit about —
 * „cuprinse în cheltuielile exercițiului financiar al anului în cursul căruia au fost plătite” — so the
 * payment date, not the invoice date, decides the year a deduction lands in.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import Expenses from './Expenses';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import type { Expense } from '../data/types';
import { ron } from '../domain/money';
import { pinClock, unpinClock } from '../test/clock';
import { fixedInstant } from '../test/fixedInstant';

const STORAGE_KEY = 'pfa-app-data-v2';

/** 00:30 on 1 Jan 2027 in Europe/Bucharest — still 31 Dec 2026 in UTC. See `Revenues.dates.test.tsx`. */
const BUCHAREST_0030_1_JAN_2027 = new Date('2026-12-31T22:30:00Z');

function expense(over: Partial<Expense> = {}): Expense {
  return {
    id: over.id ?? 'pg2-exp',
    tip: 'factura',
    nr: 'FCT-2026-911',
    date: '2026-12-30',
    furnizor: 'Conectica SRL',
    cui: 'RO87654321',
    valoareFaraTva: ron(500),
    tva: ron(100),
    status: 'inregistrata',
    category: 'postal_and_telecom',
    ...over,
  };
}

function seedWith(extraExpenses: Expense[]): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...seedData,
      expenses: [...seedData.expenses, ...extraExpenses],
      version: CURRENT_DATA_VERSION,
    }),
  );
}

function dateInputs(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'));
}

function noteFor(recordId: string): { text: string; source: string } | null {
  const row = document.querySelector(`tr[data-record-id="${recordId}"]`);
  const note = row?.querySelector('[data-fiscal-date-source]');
  if (!note) return null;
  return { text: note.textContent ?? '', source: note.getAttribute('data-fiscal-date-source') ?? '' };
}

function savedExpense(nr: string): Expense | undefined {
  const payload = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  return (payload.expenses as Expense[] | undefined)?.find(e => e.nr === nr);
}

function fillAndSubmit(nr: string, { documentDate, paid }: { documentDate?: string; paid?: string } = {}): void {
  const dates = dateInputs();
  if (documentDate !== undefined) fireEvent.change(dates[0], { target: { value: documentDate } });
  if (paid !== undefined) fireEvent.change(dates[1], { target: { value: paid } });
  fireEvent.change(screen.getByPlaceholderText('FCT-09-112043'), { target: { value: nr } });
  fireEvent.change(screen.getByPlaceholderText('SC … SA'), { target: { value: 'Conectica SRL' } });
  const amounts = screen.getAllByPlaceholderText('0,00');
  fireEvent.change(amounts[0], { target: { value: '500' } });
  fireEvent.change(amounts[1], { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adaugă' }));
}

describe('Expenses — the payment date (PG-2)', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    unpinClock();
    localStorage.clear();
  });

  it('at 00:30 local on 1 Jan 2027 a new expense defaults to 1 Jan 2027, not 31 Dec 2026 (B-46)', () => {
    pinClock(BUCHAREST_0030_1_JAN_2027);
    seedWith([]);
    render(
      <StoreProvider>
        <Expenses />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adaugă cheltuială/ }));
    expect(dateInputs()[0].value).toBe('2027-01-01');
  });

  it('an expense created with a payment date stores `paid` and keeps the document date separately', async () => {
    pinClock(fixedInstant());
    seedWith([]);
    render(
      <StoreProvider>
        <Expenses />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adaugă cheltuială/ }));
    fillAndSubmit('FCT-PG2-911', { documentDate: '2026-12-30', paid: '2027-01-12' });

    await waitFor(() => expect(savedExpense('FCT-PG2-911')).toBeDefined());
    const created = savedExpense('FCT-PG2-911')!;
    expect(created.paid).toBe('2027-01-12');
    expect(created.date).toBe('2026-12-30');
  });

  it('leaving the payment date empty stores no `paid` — an unpaid expense is not given a payment', async () => {
    pinClock(fixedInstant());
    seedWith([]);
    render(
      <StoreProvider>
        <Expenses />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adaugă cheltuială/ }));
    fillAndSubmit('FCT-PG2-912', { documentDate: '2026-12-30' });

    await waitFor(() => expect(savedExpense('FCT-PG2-912')).toBeDefined());
    expect('paid' in savedExpense('FCT-PG2-912')!).toBe(false);
  });

  it('a stored payment date is shown on the row, with the year it moved the deduction into', () => {
    pinClock(fixedInstant());
    seedWith([expense({ id: 'pg2-exp-paid', nr: 'FCT-PG2-913', paid: '2027-01-12' })]);
    render(
      <StoreProvider>
        <Expenses />
      </StoreProvider>,
    );
    const note = noteFor('pg2-exp-paid');
    expect(note?.source).toBe('paid');
    expect(note?.text).toBe('data plății: 12.01.2027 · plătit în 2027');
  });

  it('an expense with no payment date says its fiscal date is the document date', () => {
    pinClock(fixedInstant());
    seedWith([expense({ id: 'pg2-exp-plain', nr: 'FCT-PG2-914' })]);
    render(
      <StoreProvider>
        <Expenses />
      </StoreProvider>,
    );
    const note = noteFor('pg2-exp-plain');
    expect(note?.source).toBe('date');
    expect(note?.text).toBe('data documentului');
  });
});
