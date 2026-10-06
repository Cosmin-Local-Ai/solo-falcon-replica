import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StoreProvider, STORAGE_KEY } from './data/store';
import App from './App';

describe('App topbar identity (Step 25 — Defect 5)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    // Do not leak persisted state into other test files.
    localStorage.clear();
  });

  it('shows the seeded identity from the store, not the old hardcoded name', () => {
    render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    );

    // Seeded identity is displayed.
    expect(screen.getByText('Popescu Andrei')).toBeTruthy();
    // Avatar shows the computed initials.
    expect(screen.getByText('PA')).toBeTruthy();

    // Old hardcoded values are gone.
    expect(screen.queryByText('Popescu Ion')).toBeNull();
    expect(screen.queryByText('PI')).toBeNull();
  });
});

/**
 * Phase 7 — the shell renders identity from ONE store (D-1) and a rejected
 * payload is visible instead of silent (D-3, B-11).
 */
describe('App shell identity and recovery (Phase 7)', () => {
  it('renders the company identity in the sidebar from the same store as the topbar', () => {
    render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    );
    expect(document.querySelector('.sidebar-identity')?.textContent).toBe('Popescu Consulting SRL');
    // The person's full name stays unique to the topbar: no duplicate identity
    // state, and no ambiguous text query for the tests below or for e2e.
    expect(screen.getAllByText('Popescu Andrei')).toHaveLength(1);
  });

  it('greets with the given name, not the full name', () => {
    render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    );
    expect(screen.getByText('Bună, Andrei')).toBeTruthy();
  });

  it('shows a recovery banner when the stored payload was rejected (D-3)', () => {
    localStorage.setItem(STORAGE_KEY, '{corrupt');
    render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    );
    const banner = screen.getByRole('alert');
    expect(banner.textContent).toContain('Datele salvate nu au putut fi citite.');
    // The reason and the preserved copy are reachable, not hidden behind a toast.
    expect(banner.textContent).toContain('unparseable-json');
  });

  it('shows no recovery banner for healthy data', () => {
    render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
