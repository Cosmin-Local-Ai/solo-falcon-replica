import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StoreProvider } from '../data/store';
import Settings from './Settings';

// Must match STORAGE_KEY in src/data/store.tsx (module-private, not exported).
const STORAGE_KEY = 'pfa-app-data-v2';
// Must match seedData.settings.company.denumire in src/data/seed.ts.
const SEED_DENUMIRE = 'Popescu Consulting SRL';
const NEW_DENUMIRE = 'Popescu Consulting SRL (regres)';

function readStoredDenumire(): string {
  const raw = localStorage.getItem(STORAGE_KEY);
  expect(raw, 'expected data to be persisted to localStorage').not.toBeNull();
  const parsed = JSON.parse(raw as string) as {
    settings: { company: { denumire: string } };
  };
  return parsed.settings.company.denumire;
}

function saveDenumire(denumire: string) {
  // The <label>s have no htmlFor and do not wrap their inputs, and the Denumire
  // input has no placeholder — query by displayed value (seed value on first render).
  const denumireInput = screen.getByDisplayValue(denumire);
  act(() => {
    fireEvent.change(denumireInput, { target: { value: NEW_DENUMIRE } });
  });
  // Two "Salvează" buttons exist on the PFA tab (page header + mențiuni card);
  // the header one (first in DOM order) is the one that calls saveCompany().
  const saveButtons = screen.getAllByRole('button', { name: 'Salvează' });
  act(() => {
    saveButtons[0].click();
  });
}

describe('Settings persistence (Defect 3 regression)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    // Do not leak persisted state into other test files.
    localStorage.clear();
  });

  it('persists company data to localStorage when "Salvează" is clicked', () => {
    render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );

    saveDenumire(SEED_DENUMIRE);

    expect(readStoredDenumire()).toBe(NEW_DENUMIRE);
  });

  it('restores saved company data from localStorage on remount', () => {
    const first = render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );

    saveDenumire(SEED_DENUMIRE);

    // Unmount, then mount a fresh provider — loadInitial() must restore from localStorage.
    act(() => {
      first.unmount();
    });
    render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );

    expect(screen.getByDisplayValue(NEW_DENUMIRE)).toBeInTheDocument();
  });

  it('does not duplicate bank account rows when saving company data', () => {
    render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );

    // Save the company data on the PFA tab (header "Salvează" button).
    const saveButtons = screen.getAllByRole('button', { name: 'Salvează' });
    act(() => {
      saveButtons[0].click();
    });

    // Navigate to the bank accounts tab.
    act(() => {
      screen.getByRole('button', { name: 'Conturi bancare' }).click();
    });

    // Seed: exactly one bank account (BCR / RON) — saving must not duplicate it.
    expect(document.querySelectorAll('tbody tr').length).toBe(1);
    expect(screen.getByText('BCR')).toBeInTheDocument();
  });
});
