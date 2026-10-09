import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StoreProvider, STORAGE_KEY } from './data/store';
import { seedData } from './data/seed';
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
    // TASK 9 re-pin (replaced, not deleted): the seed identity is a PFA, so the sidebar names the
    // person's trading name. Old value: 'Popescu Consulting SRL'. The exact-match query below still
    // matches only the topbar, because 'Popescu Andrei PFA' is not 'Popescu Andrei'.
    expect(document.querySelector('.sidebar-identity')?.textContent).toBe('Popescu Andrei PFA');
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

/**
 * Phase 10, B-26 — the money-conversion report has to reach a screen. The report was produced and
 * persisted but never rendered, so acceptance criterion 6 ("must surface, not vanish") was half-met.
 */
describe('App shell surfaces the money-precision report (Phase 10, B-26)', () => {
  // Scoped to this block on purpose. The file's other `beforeEach`/`afterEach` live inside the FIRST
  // describe, and vitest does not inherit those across siblings — without this, the payload written by
  // the test below is still in localStorage for the one after it, and the banner correctly keeps
  // showing a report that is still on the data. That is the behaviour under test, not a leak to ignore.
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('shows which sums were adjusted, in lei, after a payload is converted', () => {
    // A RAW v4 payload: money fields still hold lei, so 674.504 is below ban precision once converted.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        profile: seedData.profile,
        revenues: [{
          ...seedData.revenues[0],
          id: 'r-1',
          valoareFaraTva: 674.504,
          // TASK 10a: the seed now stores `{ amount, currency }`, but a raw v4 payload stores a bare
          // number. Unwrapping keeps the fixture's number exactly what it was; leaving the object in
          // place would make the money-bani step report `[object Object]` as an unconvertible value.
          tva: seedData.revenues[0].tva.amount,
        }],
        settings: seedData.settings,
      }),
    );
    const { container } = render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    );

    // Scoped to the banner class inside this render's container: `role="status"` is also used by the chart
    // tooltip on this page (FinancialChart.test.tsx owns that one), and a document-wide query would also
    // see a previous test's DOM if cleanup is not automatic in this environment.
    const banner = container.querySelector('.banner[role="status"]');
    // A real guard, not `expect(...).not.toBeNull()`: that does not narrow, and every later line would
    // need a `!` that hides the one thing worth knowing when it fails — that the banner never rendered.
    if (!banner) throw new Error('the money-precision banner did not render');
    expect(banner.textContent).toContain('nu a putut fi reprodusă exact');
    expect(banner.textContent).toContain('674.504'); // the stored value, verbatim
    expect(banner.textContent).toContain('674,50'); // what it became, in lei
    expect(banner.textContent).not.toContain('67450'); // never the raw ban count
  });

  it('shows nothing for data that needed no decision', () => {
    const { container } = render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    );
    expect(container.querySelector('.banner[role=\"status\"]')).toBeNull();
  });
});
