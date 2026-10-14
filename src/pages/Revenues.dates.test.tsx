/**
 * PG-2 — the collection date on the revenue side.
 *
 * Three things are pinned here, each resisting a specific regression:
 *
 *  1. **B-46.** The document-date default used to be `new Date().toISOString().slice(0, 10)` — the UTC
 *     calendar day. At 00:30 in Bucharest on 1 Jan 2027 that seeded **31 Dec 2026**, so a record was born
 *     in the previous fiscal year. The instant below is chosen so the two calendar days differ: it is
 *     00:30 on 1 Jan 2027 in Europe/Bucharest, which is still 31 Dec 2026 in UTC. `pinClock` takes that
 *     instant rather than `fixedInstant()`, because the shared constant is 2026-10-31 and this case needs
 *     a year boundary — the shared constant is not edited for one test.
 *  2. **The money date is writable and persists**, and an empty field stays absent: never `''`, never
 *     backfilled from the document date.
 *  3. **The row names the date its fiscal year came from**, in the domain's own
 *     `'collected' | 'paid' | 'date'` vocabulary, so a record sitting in a year the document does not
 *     explain is explainable on the row that shows it.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import Revenues from './Revenues';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import type { Revenue } from '../data/types';
import { ron } from '../domain/money';
import { pinClock, unpinClock } from '../test/clock';
import { fixedInstant } from '../test/fixedInstant';

const STORAGE_KEY = 'pfa-app-data-v2';

/**
 * 00:30 on 1 January 2027, Europe/Bucharest — 2026-12-31T22:30:00Z. The UTC day and the Romanian day are
 * different here, which is exactly the case B-46 got wrong. Written as an explicit `Z` instant so the
 * assertion does not depend on the runner's own time zone.
 */
const BUCHAREST_0030_1_JAN_2027 = new Date('2026-12-31T22:30:00Z');

function revenue(over: Partial<Revenue> = {}): Revenue {
  return {
    id: over.id ?? 'pg2-rev',
    tip: 'factura',
    nr: 'FCT-2026-901',
    date: '2026-12-20',
    client: 'Codexa SRL',
    cui: 'RO12345678',
    valoareFaraTva: ron(1000),
    tva: ron(200),
    status: 'inregistrata',
    ...over,
  };
}

function seedWith(extraRevenues: Revenue[]): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...seedData,
      revenues: [...seedData.revenues, ...extraRevenues],
      version: CURRENT_DATA_VERSION,
    }),
  );
}

/** The form's date inputs in DOM order: the document date, then the collection date. */
function dateInputs(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'));
}

function selectCarrying(value: string): HTMLSelectElement {
  const found = Array.from(document.querySelectorAll<HTMLSelectElement>('select')).find(s =>
    Array.from(s.options).some(o => o.value === value),
  );
  if (!found) throw new Error(`no <select> offers the option ${value}`);
  return found;
}

function noteFor(recordId: string): { text: string; source: string } | null {
  const row = document.querySelector(`tr[data-record-id="${recordId}"]`);
  const note = row?.querySelector('[data-fiscal-date-source]');
  if (!note) return null;
  return { text: note.textContent ?? '', source: note.getAttribute('data-fiscal-date-source') ?? '' };
}

function savedRevenue(nr: string): Revenue | undefined {
  const payload = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  return (payload.revenues as Revenue[] | undefined)?.find(r => r.nr === nr);
}

/** Fill the fields the form requires and submit it. */
function fillAndSubmit(nr: string, { documentDate, collected }: { documentDate?: string; collected?: string } = {}): void {
  const dates = dateInputs();
  if (documentDate !== undefined) fireEvent.change(dates[0], { target: { value: documentDate } });
  if (collected !== undefined) fireEvent.change(dates[1], { target: { value: collected } });
  fireEvent.change(screen.getByPlaceholderText('FCT-2025-0045'), { target: { value: nr } });
  fireEvent.change(selectCarrying('Codexa SRL'), { target: { value: 'Codexa SRL' } });
  const amounts = screen.getAllByPlaceholderText('0,00');
  fireEvent.change(amounts[0], { target: { value: '1000' } });
  fireEvent.change(amounts[1], { target: { value: '200' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adaugă' }));
}

describe('Revenues — the collection date (PG-2)', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    unpinClock();
    localStorage.clear();
  });

  it('at 00:30 local on 1 Jan 2027 a new revenue defaults to 1 Jan 2027, not 31 Dec 2026 (B-46)', () => {
    pinClock(BUCHAREST_0030_1_JAN_2027);
    seedWith([]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adaugă venit/ }));
    expect(dateInputs()[0].value).toBe('2027-01-01');
  });

  it('a revenue created with a collection date stores `collected` and keeps the document date separately', async () => {
    pinClock(fixedInstant());
    seedWith([]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adaugă venit/ }));
    fillAndSubmit('FCT-PG2-901', { documentDate: '2026-12-20', collected: '2027-01-10' });

    await waitFor(() => expect(savedRevenue('FCT-PG2-901')).toBeDefined());
    const created = savedRevenue('FCT-PG2-901')!;
    expect(created.collected).toBe('2027-01-10');
    // The register keeps both dates: writing the money date does not overwrite the document date.
    expect(created.date).toBe('2026-12-20');
  });

  it('leaving the collection date empty stores no `collected` at all — absence stays representable', async () => {
    pinClock(fixedInstant());
    seedWith([]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adaugă venit/ }));
    fillAndSubmit('FCT-PG2-902', { documentDate: '2026-12-20' });

    await waitFor(() => expect(savedRevenue('FCT-PG2-902')).toBeDefined());
    expect('collected' in savedRevenue('FCT-PG2-902')!).toBe(false);
  });

  it('a stored collection date is shown on the row, with the year it moved the record into', () => {
    pinClock(fixedInstant());
    seedWith([revenue({ id: 'pg2-rev-collected', nr: 'FCT-PG2-903', collected: '2027-01-10' })]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    const note = noteFor('pg2-rev-collected');
    expect(note?.source).toBe('collected');
    expect(note?.text).toBe('data încasării: 10.01.2027 · încasat în 2027');
  });

  it('a revenue with no collection date says its fiscal date is the document date', () => {
    pinClock(fixedInstant());
    seedWith([revenue({ id: 'pg2-rev-plain', nr: 'FCT-PG2-904' })]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    const note = noteFor('pg2-rev-plain');
    expect(note?.source).toBe('date');
    expect(note?.text).toBe('data documentului');
  });

  it('a collection date inside the document year is named without a year note', () => {
    pinClock(fixedInstant());
    seedWith([revenue({ id: 'pg2-rev-same', nr: 'FCT-PG2-905', collected: '2026-12-28' })]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    const note = noteFor('pg2-rev-same');
    expect(note?.source).toBe('collected');
    expect(note?.text).toBe('data încasării: 28.12.2026');
  });
});
