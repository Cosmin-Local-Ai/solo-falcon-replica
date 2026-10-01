import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StoreProvider } from './data/store';
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
