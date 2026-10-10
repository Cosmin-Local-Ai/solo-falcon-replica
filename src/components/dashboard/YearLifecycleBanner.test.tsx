/**
 * PG-4 (D-YEAR-1) — the year banner: the automatic advance, the missing rule package, and the toggle
 * back to a previous year.
 *
 * The banner is the only place in the app that writes a fiscal year automatically, so these tests read
 * the write back out of the store rather than trusting the rendered sentence: a banner that announces a
 * year the estimate never adopts would be the same defect in a nicer typeface.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { YearLifecycleBanner } from './YearLifecycleBanner';
import { StoreProvider, useStore } from '../../data/store';
import { CURRENT_DATA_VERSION } from '../../data/migration';
import { seedData } from '../../data/seed';
import type { AppData } from '../../data/types';
import type { FiscalYearView } from '../../data/dashboard';
import { dashboard as copy } from '../../ui/copy';
import { pinClock, unpinClock } from '../../test/clock';

const STORAGE_KEY = 'pfa-app-data-v2';

function payload(over: Partial<AppData> = {}): AppData {
  return { ...seedData, ...over, version: CURRENT_DATA_VERSION } as AppData;
}

/**
 * The year view, minus the year itself: the harness reads the year back out of the store, so a write
 * by the banner is visible on the next render. A fixed `year` prop would let the banner announce a
 * year the store never adopted and the test would still pass.
 */
type YearViewWithoutYear = Omit<FiscalYearView, 'year'>;

function Harness({ view }: { view: YearViewWithoutYear }) {
  const store = useStore();
  return (
    <>
      <YearLifecycleBanner year={{ ...view, year: store.profile.fiscalYear }} />
      <span data-testid="stored-year">{store.profile.fiscalYear}</span>
    </>
  );
}

function renderHarness(view: YearViewWithoutYear) {
  return render(
    <StoreProvider>
      <Harness view={view} />
    </StoreProvider>,
  );
}

const NO_RULES: YearViewWithoutYear = {
  closed: false,
  rulesAvailable: false,
  currentYear: 2027,
  advanceTo: null,
};

describe('YearLifecycleBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    pinClock();
  });
  afterEach(() => {
    cleanup();
    unpinClock();
    localStorage.clear();
  });

  it('says which year has no rules, and offers the way back', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload({ profile: { ...seedData.profile, fiscalYear: 2027 } })));
    renderHarness(NO_RULES);

    expect(screen.getByText(copy.year.rulesMissing(2027))).toBeInTheDocument();
    expect(screen.getByText(copy.year.rulesMissingBody)).toBeInTheDocument();
    expect(document.querySelector('[data-year-state="rules-missing"]')).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: copy.year.switchTo(2026) }));
    await waitFor(() => expect(screen.getByTestId('stored-year').textContent).toBe('2026'));
  });

  it('writes the year forward when the view says the clock has moved past it', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload()));
    renderHarness({ closed: false, rulesAvailable: true, currentYear: 2027, advanceTo: 2027 });

    await waitFor(() => expect(screen.getByTestId('stored-year').textContent).toBe('2027'));
    // And it says so, in the same render, rather than moving the year silently.
    expect(await screen.findByText(copy.year.advanced(2027))).toBeInTheDocument();
  });

  it('a closed year with rules is labelled closed, and can be left', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload()));
    renderHarness({ closed: true, rulesAvailable: true, currentYear: 2027, advanceTo: null });

    expect(screen.getByText(copy.year.closedArchive(2026))).toBeInTheDocument();
    expect(document.querySelector('[data-year-state="closed"]')).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: copy.year.switchTo(2027) }));
    await waitFor(() => expect(screen.getByTestId('stored-year').textContent).toBe('2027'));
  });

  it('says nothing about a year that is open, current and covered by rules', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload()));
    renderHarness({ closed: false, rulesAvailable: true, currentYear: 2026, advanceTo: null });
    expect(document.querySelector('[data-year-state]')).toBeNull();
  });
});
