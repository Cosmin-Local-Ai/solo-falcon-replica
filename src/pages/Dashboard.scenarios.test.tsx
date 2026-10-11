/**
 * PG-6a — the refusal in the hero.
 *
 * Acceptance criterion 2, at the component level: a refusal renders as „Nu putem calcula” plus the
 * reason plus a working link, and **no number appears beside it**. The e2e spec follows the same case
 * through a real browser and a real click; this file pins the part a browser cannot distinguish — that
 * the hero's value slot carries the no-value token rather than a `0` that would read as a settled
 * answer, and that the badge is styled from the state and from nothing else.
 *
 * The case is the regime refusal, because it is the scenario the app can already reach from stored
 * data. The classifier refusal (art. 68^3 cazare) is reached in the unit suite, not here: no caller
 * supplies the activity-family fact yet, and that is PG-6b's job, not a gap to paper over with a stub.
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

function writePayload(overrides: Record<string, unknown> = {}) {
  const base: AppData & { version: number } = {
    reservedAmount: null,
    profile: seedData.profile,
    revenues: [],
    expenses: [],
    clients: [],
    filings: [],
    documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] },
    statements: [],
    snapshots: [],
    settings: seedData.settings,
    version: CURRENT_DATA_VERSION,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...base, ...overrides }));
}

function renderDashboard() {
  return render(
    <StoreProvider>
      <Dashboard />
    </StoreProvider>,
  );
}

function estimateCard() {
  return [...document.querySelectorAll('section.card')].find(
    (s) => s.querySelector('h2.card-title')?.textContent === copy.dashboard.estimate.title,
  );
}

beforeEach(() => pinClock(fixedInstant()));
afterEach(() => {
  unpinClock();
  localStorage.clear();
});

describe('the hero renders a scenario refusal', () => {
  it('says „Nu putem calcula”, gives the reason and the fix link, and shows no figure', async () => {
    writePayload({ profile: { ...seedData.profile, regime: 'impozit_pe_cit' } });
    renderDashboard();

    // The rule's own sentence, verbatim — the assertion that the app did not paraphrase the law.
    await waitFor(() =>
      expect(document.querySelector('[data-scenario-refusal="regime-not-computable"]')).not.toBeNull(),
    );
    expect(
      document.querySelector('[data-scenario-detail="regime-not-computable"]')?.textContent,
    ).toContain('nu poate aparține unui PFA');

    const card = estimateCard();
    expect(card).toBeDefined();

    const badge = card!.querySelector('.badge.estimate-state');
    expect(badge?.getAttribute('data-estimate-state')).toBe('refused');
    expect(badge?.textContent).toBe(copy.estimateState.badges.refused);
    expect(badge?.className).toContain('badge-danger');

    // No number beside the refusal. `—` is the no-value token, not a zero: a zero would be a fiscal
    // claim, and it is the exact failure B-28 registered.
    expect(card!.querySelector('.tax-hero-value')?.textContent).toBe(copy.ui.noValue);
    const cockpit = [...document.querySelectorAll('.stat-card')].find((c) =>
      c.textContent?.includes(copy.dashboard.cards.taxEstimate),
    );
    expect(cockpit?.querySelector('.value')?.textContent).toBe(copy.ui.noValue);

    // The fix link is the registry's resolved route, not a string the page invented.
    const link = card!.querySelector('[data-scenario-refusal] a');
    expect(link?.getAttribute('href')).toBe('/settings#!/fiscal');
  });

  it('the refusal paragraph is not the review-required paragraph', async () => {
    writePayload({ profile: { ...seedData.profile, regime: 'impozit_pe_cit' } });
    renderDashboard();
    await waitFor(() =>
      expect(document.querySelector('[data-scenario-refusal]')).not.toBeNull(),
    );
    const note = document.querySelector('p.estimate-state-note');
    expect(note?.getAttribute('data-estimate-state')).toBe('refused');
    expect(note?.textContent).toBe(copy.estimateState.refused);
    // The two states do not share a sentence, and neither is a proxy for the other.
    expect(note?.textContent).not.toBe(copy.estimateState.reviewRequired);
    expect(note?.textContent).not.toBe(copy.estimateState.incompleteOne);
  });

  it('the rule sentence is rendered once on the page, not once per surface', async () => {
    // The B-14 tests already insist the cited paragraph reaches the screen. What PG-6a adds is that it
    // reaches it once: the arithmetic disclosure and the chart point at the estimate section instead of
    // quoting the same legal paragraph back.
    writePayload({ profile: { ...seedData.profile, regime: 'impozit_pe_cit' } });
    renderDashboard();
    await waitFor(() =>
      expect(document.querySelector('[data-scenario-detail="regime-not-computable"]')).not.toBeNull(),
    );
    const quoted = [...document.querySelectorAll('p')].filter((p) =>
      (p.textContent ?? '').includes('nu poate aparține unui PFA'),
    );
    expect(quoted).toHaveLength(1);
  });
});
