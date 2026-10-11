/**
 * PG-2 (B-46) — the third UTC-seeded default, re-pinned by PG-5.
 *
 * `Declarations.tsx` used to seed `dataInregistrare` with `new Date().toISOString().slice(0, 10)`, the
 * UTC calendar day. The other two forms are pinned in `Revenues.dates.test.tsx` and
 * `Expenses.dates.test.tsx`; this file exists because the defect was three call sites, not one, and a
 * fix applied to two of them would have left a form that still registers a filing in the year before
 * the one the person was standing in.
 *
 * PG-5 changed the record (monthly row → annual return) but not the hazard. The clock-sensitive write is
 * now the date the app is told the return was FILED: `markFiled` stamps `localDateISO()`. At 00:30 in
 * Bucharest on 1 Jan 2027 the UTC day is still 31 Dec 2026, so a UTC-seeded default would file the
 * 2026 return on the last day of 2026 — a date that is wrong by a year boundary, in the field that
 * decides whether a deadline is met.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import Declarations from './Declarations';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import { pinClock, unpinClock } from '../test/clock';
import type { AnnualFiling } from '../data/types';

const STORAGE_KEY = 'pfa-app-data-v2';

/** 00:30 on 1 Jan 2027 in Europe/Bucharest — still 31 Dec 2026 in UTC. See `Revenues.dates.test.tsx`. */
const BUCHAREST_0030_1_JAN_2027 = new Date('2026-12-31T22:30:00Z');

const UNFILED: AnnualFiling = { id: 'f26', taxYear: 2026, form: 'D212', status: 'in_pregatire' };

function persistedFilings(): AnnualFiling[] {
  return (JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { filings: AnnualFiling[] }).filings;
}

describe('Declarations — the filing date default (B-46)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...seedData, version: CURRENT_DATA_VERSION, filings: [UNFILED] }),
    );
  });
  afterEach(() => {
    cleanup();
    unpinClock();
    localStorage.clear();
  });

  it('at 00:30 local on 1 Jan 2027, marking a return filed records 1 Jan 2027, not 31 Dec 2026', () => {
    pinClock(BUCHAREST_0030_1_JAN_2027);
    render(
      <StoreProvider>
        <Declarations />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Marchează ca depusă' }));

    expect(persistedFilings()[0]!.filedOn).toBe('2027-01-01');
    // The year the return DECLARES is untouched by the clock: 2026 is what it declares, whatever
    // today's date says.
    expect(persistedFilings()[0]!.taxYear).toBe(2026);
  });

  it('a new annual filing starts with NO date, rather than a default one', () => {
    // Re-pin of the old "the date input defaults to today" assertion. The monthly form needed a
    // registration date on every row, so it pre-filled one and the bug was which clock it read. The
    // annual form treats absence as a real state — a return being prepared has no filing date — so
    // there is no default to get wrong, and pre-filling one would mint a submission nobody recorded.
    render(
      <StoreProvider>
        <Declarations />
      </StoreProvider>,
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Adaugă declarație anuală/ })[0]);
    const date = document.querySelector<HTMLInputElement>('input[type="date"]');
    expect(date?.value).toBe('');
  });

  it('a return marked „Depusă” without a date is refused, not stored dateless', () => {
    render(
      <StoreProvider>
        <Declarations />
      </StoreProvider>,
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Adaugă declarație anuală/ })[0]);
    const selects = Array.from(document.querySelectorAll<HTMLSelectElement>('select'));
    fireEvent.change(selects[1]!, { target: { value: 'depusa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adaugă' }));

    expect(screen.getByText('O declarație marcată „Depusă” are nevoie de data depunerii.')).toBeInTheDocument();
    expect(persistedFilings()).toHaveLength(1);
  });
});
