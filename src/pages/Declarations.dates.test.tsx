/**
 * PG-2 (B-46) — the third UTC-seeded default.
 *
 * `Declarations.tsx` seeded `dataInregistrare` with `new Date().toISOString().slice(0, 10)`, the UTC
 * calendar day. The other two forms are pinned in `Revenues.dates.test.tsx` and
 * `Expenses.dates.test.tsx`; this file exists because the defect was three call sites, not one, and a fix
 * applied to two of them would have left a form that still registers a declaration in the year before the
 * one the person was standing in.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import Declarations from './Declarations';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import { pinClock, unpinClock } from '../test/clock';

const STORAGE_KEY = 'pfa-app-data-v2';

/** 00:30 on 1 Jan 2027 in Europe/Bucharest — still 31 Dec 2026 in UTC. See `Revenues.dates.test.tsx`. */
const BUCHAREST_0030_1_JAN_2027 = new Date('2026-12-31T22:30:00Z');

describe('Declarations — the registration date default (B-46)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...seedData, version: CURRENT_DATA_VERSION }),
    );
  });
  afterEach(() => {
    cleanup();
    unpinClock();
    localStorage.clear();
  });

  it('at 00:30 local on 1 Jan 2027 a new declaration defaults to 1 Jan 2027, not 31 Dec 2026', () => {
    pinClock(BUCHAREST_0030_1_JAN_2027);
    render(
      <StoreProvider>
        <Declarations />
      </StoreProvider>,
    );
    // The empty register offers the same action twice (header and empty state); either opens the form.
    fireEvent.click(screen.getAllByRole('button', { name: /Adaugă declarație/ })[0]);
    const date = document.querySelector<HTMLInputElement>('input[type="date"]');
    expect(date?.value).toBe('2027-01-01');
  });
});
