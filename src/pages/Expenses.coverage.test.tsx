/**
 * PG-1 acceptance 2 — the register row says, on the record itself, that it is not in the estimate, and
 * why.
 *
 * The banner above the table counts the exclusions; the row is where the person can act. Without the
 * row note a table of thirty expenses reads uniformly, and the one that is missing from the tax figure
 * looks like the other twenty-nine.
 *
 * The reason shown here is the SAME projection the hero row uses (`coverageReasonForExclusion` → the
 * shared label map), so a record cannot be called one thing on the dashboard and another on its own
 * row.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Expenses from './Expenses';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import type { Expense } from '../data/types';
import { eur, ron } from '../domain/money';
import { pinClock, unpinClock } from '../test/clock';
import { fixedInstant } from '../test/fixedInstant';

const STORAGE_KEY = 'pfa-app-data-v2';

function expense(over: Partial<Expense>): Expense {
  return {
    id: over.id ?? 'cov-exp',
    tip: 'factura',
    nr: 'CH-2026-900',
    date: '2026-05-10',
    furnizor: 'Furnizor Test',
    cui: 'RO99999999',
    valoareFaraTva: ron(2000),
    tva: ron(400),
    status: 'inregistrata',
    ...over,
  };
}

function seedWith(expenses: Expense[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...seedData,
      expenses: [...seedData.expenses, ...expenses],
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

/** The note carried by one row of the register. */
function noteFor(recordId: string): string | null {
  const row = document.querySelector(`tr[data-record-id="${recordId}"]`);
  return row?.querySelector('[data-not-in-estimate]')?.textContent ?? null;
}

describe('Expenses register — the per-record coverage note', () => {
  beforeEach(() => {
    localStorage.clear();
    pinClock(fixedInstant());
  });
  afterEach(() => {
    cleanup();
    unpinClock();
    localStorage.clear();
  });

  it('an uncategorised expense says so on its own row', () => {
    seedWith([expense({ id: 'cov-uncat' })]);
    renderPage();
    expect(noteFor('cov-uncat')).toBe('nu intră în estimare: fără categorie');
  });

  it('a capital purchase is named as an asset the app cannot model, not as an ordinary exclusion', () => {
    seedWith([expense({ id: 'cov-asset', category: 'depreciable_asset_purchase' })]);
    renderPage();
    expect(noteFor('cov-asset')).toBe('nu intră în estimare: mijloc fix fără registru de amortizare');
  });

  it('an expense whose rule needs a fact the app does not hold is named as such', () => {
    seedWith([expense({ id: 'cov-home', category: 'home_office_shared_cost' })]);
    renderPage();
    expect(noteFor('cov-home')).toBe('nu intră în estimare: regulă fără faptă consemnată');
  });

  it('a EUR expense with no rate is named as a missing rate, on the row', () => {
    seedWith([
      expense({
        id: 'cov-eur',
        category: 'rent_business_space',
        valoareFaraTva: eur(5000),
        tva: eur(0),
      }),
    ]);
    renderPage();
    expect(noteFor('cov-eur')).toBe('nu intră în estimare: fără curs BNR înregistrat');
  });

  it('an expense that IS in the estimate carries no note', () => {
    seedWith([expense({ id: 'cov-ok', category: 'rent_business_space' })]);
    renderPage();
    expect(noteFor('cov-ok')).toBeNull();
    expect(screen.getByText('CH-2026-900')).toBeInTheDocument();
  });

  it('a legally non-deductible expense is still marked as out of the estimate', () => {
    // The estimate is not "incomplete" because of it — but the row must not imply it entered the figure.
    seedWith([expense({ id: 'cov-fine', category: 'fine_or_penalty' })]);
    renderPage();
    expect(noteFor('cov-fine')).toBe('nu intră în estimare: nu este deductibilă prin lege');
  });
});
