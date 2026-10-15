/**
 * B-28 and B-106 — the ladder refusal, on the hero, in one page and two moments.
 *
 * The CASS ladder refuses when the art. 170 alin. (4) sum cannot be built: an art. 85 register supplies
 * the *cedarea folosinței* category from its own receipts, so a cazare profile with a room count and no
 * answers for the other five leaves the cumulative base unknown. B-88 made that reachable; B-106 is what
 * the user was shown when it happened — a `review_required` badge, an em dash, and a sentence telling them
 * the cause was somewhere else on the page.
 *
 * Two defects, one page, and the test is deliberately about the *order*:
 *
 *   1. **B-28** — the same `—` stood for „the engine has not answered yet” and for „the engine refused”.
 *      Both states are real here: the estimate resolves through `computeTaxEstimate(...).then(setEstimate)`,
 *      so the first paint genuinely is a pending state and the settled one genuinely is a refusal. They now
 *      render as different words, and this file reads both from the same render.
 *   2. **B-106** — the engine's refusal sentence is rendered beside the figure it refuses, in the engine's
 *      own words, exactly once. The chart points here instead of quoting the same paragraph a second time.
 *
 * The payload is stored data, not a hand-built estimate: a refusal that only exists in a fixture has not
 * reached the user.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import type { AppData } from '../data/types';
import Dashboard from './Dashboard';
import { copy } from '../ui/copy';
import { pinClock, unpinClock } from '../test/clock';
import { fixedInstant } from '../test/fixedInstant';

const STORAGE_KEY = 'pfa-app-data-v2';

/** A cazare profile with a room count for the declared year and no answers for the other five categories. */
function writeLadderPayload(): void {
  const base: AppData & { version: number } = {
    reservedAmount: null,
    profile: {
      ...seedData.profile,
      activityFamily: 'cazare',
      accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 3 }],
    },
    revenues: [],
    expenses: [],
    clients: [],
    filings: [],
    vatReturns: [],
    occupancySheets: [],
    vehicles: [],
    fixedAssets: [],
    documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] },
    statements: [],
    snapshots: [],
    settings: seedData.settings,
    version: CURRENT_DATA_VERSION,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
}

function heroFigure(): Element | null {
  return document.querySelector('.tax-hero-value');
}

function cockpitCard(): Element | undefined {
  return [...document.querySelectorAll('.stat-card')].find((c) =>
    c.textContent?.includes(copy.dashboard.cards.taxEstimate),
  );
}

beforeEach(() => pinClock(fixedInstant()));
afterEach(() => {
  unpinClock();
  localStorage.clear();
});

describe('a CASS ladder refusal on the hero', () => {
  it('the pending state and the refusal are different words in the same slot', async () => {
    writeLadderPayload();
    render(<StoreProvider><Dashboard /></StoreProvider>);

    // Moment one — the estimate has not resolved. `useLatestTaxEstimate` answers through a `.then`, so the
    // first paint really is a pending state, and `—` is the honest token for it.
    expect(heroFigure()?.textContent).toBe(copy.ui.noValue);
    expect(heroFigure()?.getAttribute('data-hero-figure')).toBe('unavailable');
    expect(document.querySelector('.badge.estimate-state')?.textContent).toBe(
      copy.estimateState.badges.unavailable,
    );

    // Moment two — the engine ran and refused. The slot stops borrowing the pending glyph.
    await waitFor(() =>
      expect(document.querySelector('.badge.estimate-state')?.getAttribute('data-estimate-state')).toBe(
        'review_required',
      ),
    );
    expect(heroFigure()?.textContent).toBe(copy.estimateState.noFigure.review_required);
    expect(heroFigure()?.textContent).not.toBe(copy.ui.noValue);
    expect(heroFigure()?.getAttribute('data-hero-figure')).toBe('review_required');
    expect(heroFigure()?.className).toContain('tax-hero-refused');
    expect(cockpitCard()?.textContent).toContain(copy.estimateState.noFigure.review_required);
    expect(cockpitCard()?.textContent).not.toContain(copy.ui.noValue);
  });

  it('renders the engine\'s own ladder-refusal sentence beside the missing figure', async () => {
    writeLadderPayload();
    render(<StoreProvider><Dashboard /></StoreProvider>);

    await waitFor(() =>
      expect(document.querySelector('[data-estimate-reason]')).not.toBeNull(),
    );
    const reason = document.querySelector('[data-estimate-reason]')?.textContent ?? '';
    // Verbatim from `calcCassLadder` — the app did not paraphrase the law, and it did not invent a reason.
    expect(reason).toContain('Baza de calcul CASS pentru veniturile din art. 155 alin. (1) lit. c)-h)');
    expect(reason).toContain('art. 170 alin. (4)');
    expect(reason).toContain('lipsesc 5');
    // The hero no longer sends the reader somewhere else for the cause.
    expect(document.querySelector('p.estimate-state-note')?.textContent).not.toContain('graficul financiar');

    // One cited paragraph, one rendering: the chart points here instead of quoting it again.
    const quoted = [...document.querySelectorAll('p')].filter((p) =>
      (p.textContent ?? '').includes('Baza de calcul CASS pentru veniturile din art. 155'),
    );
    expect(quoted).toHaveLength(1);
    const chartNote = document.querySelector('.chart-tax-note[data-estimate-state="review_required"]');
    expect(chartNote?.textContent).toContain('secțiunea Estimare impozit');
    expect(chartNote?.textContent).not.toContain('Baza de calcul CASS');
  });

  it('a refusal is never rendered as a scenario refusal, and never as a number', async () => {
    writeLadderPayload();
    render(<StoreProvider><Dashboard /></StoreProvider>);

    await waitFor(() =>
      expect(document.querySelector('.badge.estimate-state')?.getAttribute('data-estimate-state')).toBe(
        'review_required',
      ),
    );
    // The ladder is the engine declining, not a register the app would not compute at all.
    expect(document.querySelector('[data-scenario-refusal]')).toBeNull();
    expect(heroFigure()?.textContent).not.toMatch(/[0-9]/);
  });
});
