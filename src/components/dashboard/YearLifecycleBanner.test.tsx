/**
 * PG-4 (D-YEAR-1) — the year lifecycle: the automatic advance, the missing rule package, and the
 * toggle back to a previous year.
 *
 * PG-5 (B-73) moved the automatic advance out of this component and into the app shell
 * (`FiscalYearAdvance`), because a trigger mounted on the dashboard only fires on the first dashboard
 * open of a new year — a person who landed on Revenues on 2 January kept last year's register. The
 * banner still REPORTS an advance; it no longer performs one. Both halves are pinned here, and the
 * tests read the write back out of the store rather than trusting the rendered sentence: a banner that
 * announces a year the estimate never adopts would be the same defect in a nicer typeface.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FiscalYearAdvance, YearLifecycleBanner } from './YearLifecycleBanner';
import { StoreProvider, useStore } from '../../data/store';
import { CURRENT_DATA_VERSION } from '../../data/migration';
import { seedData } from '../../data/seed';
import { yearAdvanceTarget } from '../../data/dashboard';
import type { AppData } from '../../data/types';
import type { FiscalYearView } from '../../data/dashboard';
import { dashboard as copy } from '../../ui/copy';
import { pinClock, unpinClock } from '../../test/clock';

const STORAGE_KEY = 'pfa-app-data-v2';

function payload(over: Partial<AppData> = {}): AppData {
  return { ...seedData, ...over, version: CURRENT_DATA_VERSION } as AppData;
}

function Probe() {
  const store = useStore();
  return <span data-testid="stored-year">{store.profile.fiscalYear}</span>;
}

/**
 * The year view, minus the year itself: the harness reads the year back out of the store, so a write
 * is visible on the next render. A fixed `year` prop would let the banner announce a year the store
 * never adopted and the test would still pass.
 *
 * `withAdvance` mounts the shell's writer alongside the banner, which is how the two are wired in the
 * app: the writer moves the year, the banner reports it.
 */
type YearViewWithoutYear = Omit<FiscalYearView, 'year'>;

function Harness({ view, withAdvance = false }: { view: YearViewWithoutYear; withAdvance?: boolean }) {
  const store = useStore();
  return (
    <>
      {withAdvance ? <FiscalYearAdvance /> : null}
      <YearLifecycleBanner year={{ ...view, year: store.profile.fiscalYear }} />
      <span data-testid="stored-year">{store.profile.fiscalYear}</span>
    </>
  );
}

function renderHarness(view: YearViewWithoutYear, withAdvance = false) {
  return render(
    <StoreProvider>
      <Harness view={view} withAdvance={withAdvance} />
    </StoreProvider>,
  );
}

const NO_RULES: YearViewWithoutYear = {
  closed: false,
  rulesAvailable: false,
  currentYear: 2027,
  advanceTo: null,
};

/** 2 January 2027, 10:00 in Bucharest — the B-73 scenario, two days into the new year. */
const JAN_2_2027 = new Date('2027-01-02T08:00:00Z');

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

  it('reports an advance that happened while it was open, in the same render', async () => {
    // PG-5 re-pin (replaced, not deleted): the banner used to WRITE the year forward. It now only says
    // it happened — the write belongs to the shell, so the year moves whatever page opens first. This
    // render proves the two halves still meet: the writer moves the store's year, and the banner that
    // mounted on the old one notices and says so, on the render that shows the new year.
    // `unpinClock` first: the group's `beforeEach` already installed fake timers at the fixed instant,
    // and re-installing them does not move the clock.
    unpinClock();
    pinClock(JAN_2_2027);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload()));
    renderHarness({ closed: false, rulesAvailable: true, currentYear: 2027, advanceTo: null }, true);

    await waitFor(() => expect(screen.getByTestId('stored-year').textContent).toBe('2027'));
    expect(document.querySelector('[data-year-state="advanced"]')).not.toBeNull();
    expect(screen.getByText(copy.year.advanced(2027))).toBeInTheDocument();
  });

  it('does not call a deliberate toggle back an automatic advance', () => {
    // A toggle back moves to a year the clock is NOT in. Reading that as an advance would tell the
    // person the app moved their year when they did.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload({ profile: { ...seedData.profile, fiscalYear: 2027 } })));
    renderHarness({ closed: false, rulesAvailable: true, currentYear: 2027, advanceTo: null });
    expect(document.querySelector('[data-year-state="advanced"]')).toBeNull();
  });
});

describe('FiscalYearAdvance (B-73: the advance does not depend on which page opens)', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    unpinClock();
    localStorage.clear();
  });

  it('writes the year forward on 2 January with no dashboard mounted', async () => {
    // The B-73 defect in one line: the writer used to live inside the dashboard component, so this
    // render — a store and the writer, no dashboard, no banner — left the year at 2026.
    pinClock(JAN_2_2027);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload()));

    render(
      <StoreProvider>
        <FiscalYearAdvance />
        <Probe />
      </StoreProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('stored-year').textContent).toBe('2027'));
  });

  it('yields to a deliberate year choice made after the boundary', async () => {
    // PG-4's guard, re-pinned at the new call site. The toggle back re-stamps `updatedAt`; the advance
    // compares that stamp in the LOCAL year, so a choice made at 00:30 on 1 Jan 2027 in Bucharest —
    // still 2026 in UTC — is respected. A UTC prefix comparison re-advanced over the toggle back and
    // Playwright caught it.
    const touchedJustAfterBoundary = '2026-12-31T22:31:00.000Z'; // 00:31 local, 1 Jan 2027
    pinClock(JAN_2_2027);
    const profile = { ...seedData.profile, fiscalYear: 2026, updatedAt: touchedJustAfterBoundary };
    expect(yearAdvanceTarget(profile, JAN_2_2027)).toBeNull();

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload({ profile })));
    render(
      <StoreProvider>
        <FiscalYearAdvance />
        <Probe />
      </StoreProvider>,
    );

    // Give the effect a chance to run, then prove it did not write.
    await waitFor(() => expect(screen.getByTestId('stored-year').textContent).toBe('2026'));
    expect(screen.getByTestId('stored-year').textContent).toBe('2026');
  });

  it('leaves the year alone when the stored year is already the current one', async () => {
    pinClock(JAN_2_2027);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(payload({ profile: { ...seedData.profile, fiscalYear: 2027, updatedAt: '2027-01-01T10:00:00.000Z' } })),
    );

    render(
      <StoreProvider>
        <FiscalYearAdvance />
        <Probe />
      </StoreProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('stored-year').textContent).toBe('2027'));
  });
});
