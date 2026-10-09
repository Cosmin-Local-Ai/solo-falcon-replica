import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { StoreProvider } from '../data/store';
import { seedData } from '../data/seed';
import type { AppData, Revenue } from '../data/types';
import Dashboard from './Dashboard';
import { lei, type Bani } from '../domain/money';

const STORAGE_KEY = 'pfa-app-data-v2';

/** A valid registered revenue (Feb 2026). */
const validRevenue: Revenue = {
  id: 'r1',
  tip: 'factura',
  nr: 'FCT-2026-001',
  date: '2026-02-10',
  client: 'Client A SRL',
  cui: 'RO12345678',
  // Deliberately NOT wrapped in lei(): writePayload() writes a versionless payload straight to
  // localStorage, so the v4->v5 money step scales it. Wrapping here would double the conversion.
  valoareFaraTva: 50_000 as Bani,
  tva: 9_500 as Bani,
  status: 'inregistrata',
};

function writePayload(overrides: Record<string, unknown> = {}) {
  const base: AppData = {
    reservedAmount: null,
    profile: seedData.profile,
    revenues: [],
    expenses: [],
    clients: [],
    declarations: [],
    documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] },
    statements: [],
    snapshots: [],
    settings: seedData.settings,
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

/**
 * Assert the figure the cockpit shows, waiting for the estimate to land first.
 *
 * The figure is NOT on the first paint. `useLatestTaxEstimate` (`src/data/derived.ts`) resolves the
 * engine through `computeTaxEstimate(...).then(setEstimate)`, so the card paints the loading
 * sentinel `—` on mount and the computed number one React-scheduler macrotask later. Measured on
 * this suite: the card reads `—` synchronously after `render()` and still `—` after a microtask;
 * the computed figure appears only after the next macrotask.
 *
 * This file used to wait for the LABEL (`findByText('Impozit estimat')`) and then assert the value
 * once. The label is present on the first paint, so that was never a wait for the value — the
 * assertion raced the macrotask and lost it whenever the machine was busy. Measured before this
 * helper: `taskset -c 0,1 npx vitest run src/pages/Dashboard.test.tsx` failed 3 of 8 runs, with the
 * received text `Impozit estimat—de pus deoparte`.
 *
 * What is asserted is unchanged: the same matcher, the same element, the same exact figure. Only the
 * missing wait is added. A wrong figure, or one that never arrives, still fails — after the default
 * 1000 ms `asyncUtilTimeout` instead of after 0 ms. Measured settle time: 2 ms, so no timeout here
 * is widened and none is load-bearing.
 */
async function expectTaxFigure(card: Element | null, figure: RegExp): Promise<void> {
  await waitFor(() => expect(card).toHaveTextContent(figure));
}

/**
 * Task 1 (pre-Phase-11): the cockpit figure is now an ANNUAL run-rate projection, so it depends on the
 * date the dashboard is read — the same reason `e2e/dashboard.spec.ts` pins the browser clock. Before
 * Task 1 these two figures were clock-invariant (a YTD total for Feb 2026 does not move as the year
 * advances); now they move every day, so pinning the instant is what keeps the assertion meaningful.
 *
 * `src/test/wallClockGuard.test.ts` sanctions exactly two ways to do this: inject an instant, or
 * install fake timers. The page reaches the clock through `now()` in `domain/date.ts` via the hook
 * default argument, which the page itself does not pass down, so the sanctioned mechanism here is fake
 * timers — with `toFake: ['Date']` ONLY, leaving setTimeout/Promise real so the macrotask wait
 * documented on `expectTaxFigure` still behaves exactly as documented.
 *
 * 2026-10-31T10:00:00Z is 13:00 Europe/Bucharest, so the Romanian calendar date cannot shift across a
 * midnight boundary, and it makes the projection denominator a whole 10 months: every operand below
 * is YTD × 12/10 = YTD × 1,2.
 */
const FIXED_INSTANT = new Date('2026-10-31T10:00:00Z');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXED_INSTANT);
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

describe('Dashboard page', () => {
  test('shows the onboarding CTA when no data is recorded', async () => {
    // Seed a valid-but-empty dataset so the store loads it directly and the
    // hasData gate switches to the onboarding CTA (an empty localStorage would
    // fall back to the non-empty seedData instead).
    writePayload();
    renderDashboard();

    // The store loads from localStorage asynchronously — wait for the CTA.
    expect(await screen.findByRole('heading', { name: 'Începe înregistrarea activității' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Adaugă un venit' })).toHaveAttribute('href', '/revenues');
    expect(screen.getByRole('link', { name: 'Adaugă o cheltuială' })).toHaveAttribute('href', '/expenses');

    // No cockpit cards or dashboard sections in the empty state.
    expect(document.querySelectorAll('.stat-card')).toHaveLength(0);
    expect(document.querySelectorAll('h2.card-title')).toHaveLength(0);
  });

  test('renders the cockpit cards and all sections when data is recorded', async () => {
    writePayload({ revenues: [validRevenue] });
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Tablou de bord' })).toBeVisible();

    // The 5 cockpit StatCard labels.
    for (const label of [
      'Venituri PFA (an)',
      'Impozit estimat',
      'Rezervă lunară',
      'Rămâne de pus deoparte',
      'Date complete',
    ]) {
      expect(screen.getAllByText(label, { exact: true }).length).toBeGreaterThan(0);
    }

    // The page-level sections.
    for (const title of ['Estimare impozit', 'Grafic financiar', 'Rezervă fiscală']) {
      expect(screen.getByRole('heading', { name: title })).toBeVisible();
    }
  });

  test('computes the tax estimate for the default PFA regime impozit_pe_venit instead of refusing it (B-14)', async () => {
    writePayload({ revenues: [validRevenue] });
    renderDashboard();

    const card = (await screen.findByText('Impozit estimat', { exact: true })).closest('.stat-card');
    expect(card).not.toBeNull();
    // The seed profile is on the only regime a PFA can have in 2026, so the default user gets a number,
    // not an em dash. Task 1 feeds the engine the ANNUAL projection: at the pinned instant the model's
    // denominator is 10 elapsed months, so the single revenue (50.000 lei net YTD, no expenses) enters
    // as 60.000 lei. CAS 12.150 (25% × 12 SM — VNA is still inside [12 SM, 24 SM)) + CASS 6.000
    // (10% × 60.000) + 10% × (60.000 − 18.150) = 4.185 → 22.335 lei.
    // (On the raw YTD operand the same dataset gave 20.435 lei: 12.150 + 5.000 + 3.285.)
    await expectTaxFigure(card, /22\.335/);
  });

  test('shows the computed estimate in the cockpit for a PFA profile on the lawful regime', async () => {
    writePayload({
      profile: {
        ...seedData.profile,
        pfaStartYear: 2026,
        fiscalYear: 2026,
        regime: 'impozit_pe_venit',
        pensionerStatus: 'nu',
        otherIncome: [],
        socialInsuranceStatus: 'obligatoriu',
      },
      revenues: [
        {
          id: 'r1',
          tip: 'factura',
          nr: 'FCT-2026-001',
          date: '2026-01-15',
          client: 'Client X SRL',
          cui: 'RO12345678',
          valoareFaraTva: 78_000 as Bani,
          tva: 16_380 as Bani,
          status: 'inregistrata',
        },
        {
          id: 'r2',
          tip: 'factura',
          nr: 'FCT-2026-002',
          date: '2026-02-20',
          client: 'Client Y SRL',
          cui: 'RO12345678',
          // raw lei scale — see the note on validRevenue (this payload is migrated on load)
          valoareFaraTva: 52_000 as Bani,
          tva: 10_920 as Bani,
          status: 'inregistrata',
        },
      ],
    });
    renderDashboard();

    const card = (await screen.findByText('Impozit estimat', { exact: true })).closest('.stat-card');
    expect(card).not.toBeNull();
    // Verified against the tax engine for this dataset AT THE PINNED INSTANT: the two revenues are
    // 130.000 lei net YTD, which the run-rate model annualises to 156.000 lei (× 12/10), giving
    // CAS 24.300 (24 SM × 25%) + CASS 15.600 (10% × 156.000) + 10% × (156.000 − 39.900) = 11.610
    // → 51.510 lei. On the raw YTD operand this dataset gave 46.570 lei (24.300 + 13.000 + 9.270) —
    // the same figure it produced under the old impozit_pe_cit gate, because B-14 moved which regime
    // the engine accepts, not the Titlul IV arithmetic. Task 1 moved the OPERAND'S BASIS, not the law.
    await expectTaxFigure(card, /51\.510/);
  });

  test('a profile recorded as impozit_pe_cit is a data-integrity failure, not a different base (B-14)', async () => {
    writePayload({
      profile: { ...seedData.profile, pfaStartYear: 2026, fiscalYear: 2026, regime: 'impozit_pe_cit' },
      revenues: [validRevenue],
    });
    renderDashboard();

    const card = (await screen.findByText('Impozit estimat', { exact: true })).closest('.stat-card');
    expect(card).not.toBeNull();
    // The reason must name the provisions that make the regime impossible for a persoană fizică, so the
    // user can see which record is wrong (rendered verbatim by FinancialChart).
    expect(await screen.findByText(/nu poate aparține unui PFA/)).toBeTruthy();
    expect(screen.getByText(/art\. 13 alin\. \(1\)/).textContent).toContain('art. 120');
    // ORDER IS LOAD-BEARING. The em dash is asserted only after the refusal reason is on screen, so
    // what it proves is "the engine refused and the cockpit carries the refusal marker" — not "the
    // estimate happened to be mid-flight". Read in the old order this assertion passed against the
    // loading sentinel, i.e. it checked nothing and could not fail. It is still not fully provable from
    // the card alone, because the cockpit renders the SAME `—` for "still computing" and for "refused";
    // that ambiguity is a product defect, registered as B-28, not something a test may paper over.
    expect(card).toHaveTextContent(/—/);
  });

  test('TASK 9: the estimate hero attributes its figure to the rule package that produced it', async () => {
    // Empty localStorage → the store falls back to the app's own seed dataset, whose estimate computes.
    renderDashboard();
    const heroCard = await waitFor(() => {
      const card = [...document.querySelectorAll('section.card')].find(
        (s) => s.querySelector('h2.card-title')?.textContent === 'Estimare impozit',
      );
      expect(card).toBeDefined();
      return card!;
    });

    // The disclosure caption is the copy layer's; the state sentence names the release.
    await waitFor(() =>
      expect(heroCard.textContent).toContain(
        'Calculul folosește pachetul de reguli PFA_2026_SYSTEM_REAL, iar digestul înregistrat se potrivește cu cel al pachetului.',
      ),
    );
    expect(heroCard.textContent).toContain('Regulile din spatele acestei cifre');
    // A digest is shown, and the provisions are shown beside it — never replaced by it.
    expect(heroCard.querySelector('[data-digest-recorded]')).not.toBeNull();
    expect(heroCard.querySelector('.provenance-citations')).not.toBeNull();
    expect(heroCard.textContent).toContain(
      'Digestul este o adresă de conținut, nu o prevedere legală; articolul rămâne afișat alături de el.',
    );
  });

  test('TASK 9: a refused calculation gives the hero no provenance, and the rows the no_release answer', async () => {
    writePayload({
      profile: { ...seedData.profile, pfaStartYear: 2026, fiscalYear: 2026, regime: 'impozit_pe_cit' },
      revenues: [validRevenue],
    });
    renderDashboard();
    expect(await screen.findByText(/nu poate aparține unui PFA/)).toBeTruthy();

    const heroCard = [...document.querySelectorAll('section.card')].find(
      (s) => s.querySelector('h2.card-title')?.textContent === 'Estimare impozit',
    );
    expect(heroCard).toBeDefined();
    // No calculation record → nothing to attribute, and the hero does not pretend otherwise.
    expect(heroCard!.querySelector('[data-provenance-state]')).toBeNull();
    expect(heroCard!.textContent).not.toContain('Regulile din spatele acestei cifre');

    // The figure-bearing rows do carry an answer, and it is the honest one: no registered package, no
    // digest. This is `copy.provenance.noRelease` reaching a real surface.
    const noRelease = document.querySelector('[data-provenance-state="no_release"]');
    expect(noRelease).not.toBeNull();
    expect(noRelease!.textContent).toContain('Această cifră nu este legată de un pachet de reguli înregistrat.');
    expect(noRelease!.querySelector('[data-digest-recorded]')).toBeNull();
  });
});
