import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import type { AppData, LegacyRevenue } from '../data/types';
import Dashboard from './Dashboard';
import { type Bani } from '../domain/money';

const STORAGE_KEY = 'pfa-app-data-v2';

/** A valid registered revenue (Feb 2026), in the shape the payload stores it. */
const validRevenue: LegacyRevenue = {
  id: 'r1',
  tip: 'factura',
  nr: 'FCT-2026-001',
  date: '2026-02-10',
  client: 'Client A SRL',
  cui: 'RO12345678',
  // Deliberately NOT wrapped in lei() or ron(): writePayload() writes a versionless payload straight to
  // localStorage, so the v4->v5 money step scales it. Wrapping here would double the conversion. It is
  // typed `LegacyRevenue`, not `Revenue`, because a pre-v10 payload has no currency on the money field —
  // that is the shape under test, not the current one.
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
    filings: [],
    // PG-6g: a fixture with no periodic VAT return recorded. Absent would be a different
    // claim, and `[]` here is what `emptyData()` and the v18→v19 step produce.
    vatReturns: [],
    occupancySheets: [],
    vehicles: [],
    // PG-6e (B-31, D-FA-1): an empty register — no asset has been declared. Required on the
    // loaded object, resolved from an absent key by the load path, never defaulted by a step.
    fixedAssets: [],
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
 * A payload at the CURRENT data version: the money fields already carry their currency, so the migration
 * chain runs no step and the records reach the app exactly as written. `writePayload` deliberately does not
 * do this — it writes a versionless legacy payload on purpose, to exercise the chain. Currency tests need
 * the opposite: a payload the chain leaves alone.
 */
function writeCurrentPayload(overrides: Record<string, unknown> = {}) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      reservedAmount: null,
      profile: seedData.profile,
      revenues: [],
      expenses: [],
      clients: [],
      filings: [],
      // PG-6g: a fixture with no periodic VAT return recorded. Absent would be a different
      // claim, and `[]` here is what `emptyData()` and the v18→v19 step produce.
      vatReturns: [],
      documents: [],
      companyDocs: { im: [], cs: [], tva: [], facturi: [] },
      statements: [],
      snapshots: [],
      settings: seedData.settings,
      version: CURRENT_DATA_VERSION,
      ...overrides,
    }),
  );
}

/** 1.000,00 EUR, no VAT, collected on the day the rate below was published. */
function eurRevenue() {
  return {
    id: 'rev-eur-1',
    tip: 'factura',
    nr: 'FCT-FX-1',
    date: '2026-10-08',
    client: 'Client EUR SRL',
    cui: 'RO12345678',
    valoareFaraTva: { amount: 100_000 as Bani, currency: 'EUR' },
    tva: { amount: 0 as Bani, currency: 'EUR' },
    status: 'inregistrata',
  };
}

/** The EUR row research 23 captured from BNR for 2026-10-08 — a real published figure. */
const EUR_DAILY_2026_10_08 = {
  currency: 'EUR', rate: '5.3470', rateKind: 'daily_reference', rateDate: '2026-10-08',
  seriesCode: 'CURSZ_EUR', sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
  fetchedAt: '2026-10-08T13:05:00Z', provisional: false, entryMode: 'fetched',
};

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
  test('shows the zero-record card AND still renders the sections when nothing is recorded', async () => {
    // Phase 11 rewrote this test rather than re-pinning it. The old version asserted that a dashboard with
    // no records renders NOTHING but a start-from-scratch card — no cockpit, no sections. That is B-68's
    // shape: the deadlines, the thresholds and the completeness card do not stop existing because the
    // ledger is empty, and acceptance 6 says the next deadline, the profile completeness and the next
    // steps have to be visible with zero records.
    writePayload();
    renderDashboard();

    // The store loads from localStorage asynchronously — wait for the card.
    expect(await screen.findByRole('heading', { name: 'Nicio înregistrare de venit sau cheltuială' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Adaugă un venit' })).toHaveAttribute('href', '/revenues');
    expect(screen.getByRole('link', { name: 'Adaugă o cheltuială' })).toHaveAttribute('href', '/expenses');

    // The card reports the absence; it no longer replaces the page.
    expect(document.querySelector('[data-empty-state]')).not.toBeNull();
    expect(document.querySelectorAll('.stat-card').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('h2.card-title').length).toBeGreaterThan(0);
    // Acceptance 6, one assertion per section the old gate used to hide.
    expect(screen.getByRole('heading', { name: 'Termene limită' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Completitudine date' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Ce trebuie să faci' })).toBeVisible();
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
    // PG-5C re-premise: 22.452 lei → 20.435 lei. The old comment derived 22.452 lei by annualising the
    // single revenue over the seed PFA's active period (50.000 × 354/292 = 60.616,44 lei) and running the
    // engine on that — CAS 12.150 + CASS 6.061,64 + impozit 4.240,48. The figure below is the same
    // arithmetic on the 50.000 lei actually recorded: CAS 12.150 (25% × 12 SM — VNA is inside
    // [12 SM, 24 SM)) + CASS 5.000 (10% × 50.000) + 10% × (50.000 − 17.150) = 3.285 → 20.435 lei.
    // The old comment already named this number, and called it "the raw YTD operand". After B-76 it is
    // not raw — art. 118 alin. (3) makes it the annual amount, and it is the only one the app shows.
    await expectTaxFigure(card, /20\.435/);
  });

  test('shows the computed estimate in the cockpit for a PFA profile on the lawful regime', async () => {
    writePayload({
      profile: {
        ...seedData.profile,
        pfaStartYear: 2026,
        fiscalYear: 2026,
        regime: 'impozit_pe_venit',
        pensionerStatus: 'nu',
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
    // PG-5C re-premise: 51.814 lei → 46.570 lei. The two revenues are 130.000 lei net recorded, and that
    // is the annual amount (art. 118 alin. (3)) — not 130.000 × 354/292 = 157.602,74 lei.
    //   CAS 24.300 (25% × 24 SM — 130.000 lei exceeds the 24 SM ceiling, so the CAS base is capped there)
    // + CASS 13.000 (10% × 130.000)
    // + impozit 10% × (130.000 − 13.000 − 24.300) = 10% × 92.700 = 9.270
    // = 46.570 lei. The old figure was the same law applied to a grossed-up base: the 5.244 lei
    // difference is what the run rate added to a tax assessment.
    await expectTaxFigure(card, /46\.570/);
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
    // PG-6f (B-30): this used to render on empty storage, where the retired `vatExempt: false` default
    // quietly settled the VAT measure and let a zero compute. There is no such default any more — a
    // profile that has never been asked whether it charges TVA is a profile the engine refuses to choose a
    // money measure for, and that refusal is the point of this phase, not an obstacle to this test. So the
    // payload declares the registration state the seed declares, and what stays under test is the
    // attribution: the hero naming the package that produced the figure.
    writeCurrentPayload();
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
        'Calculul folosește pachetul de reguli PFA_2026_DPI_INCOME_PATH, iar digestul înregistrat se potrivește cu cel al pachetului.',
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

  /**
   * Phase 10c (B-37) at page level. Two things are asserted here that no selector test can show:
   *
   *  - a ledger whose only record is foreign no longer collapses into the onboarding empty state. The
   *    `hasData` gate used to read "zero lei" as "nothing recorded", which told a user holding a real EUR
   *    invoice to go and add their first invoice;
   *  - the record that is out of the totals is visible on the page, beside the totals it is out of.
   */
  test('Phase 10c: a EUR record with no rate is out of the lei totals and named on the page', async () => {
    writeCurrentPayload({ revenues: [eurRevenue()] });
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Tablou de bord' })).toBeVisible();
    // Phase 11 re-pin (replaced, not deleted): the old assertion looked for the deleted
    // „Începe înregistrarea activității” heading. What is asserted is the same property, named directly — a
    // record that is present but excluded from every lei total must not put the zero-record card on screen.
    expect(document.querySelector('[data-empty-state]')).toBeNull();

    // The summary card says the totals are not complete…
    const notice = document.querySelector('[data-unconverted-count]');
    expect(notice).not.toBeNull();
    expect(notice!.getAttribute('data-unconverted-count')).toBe('1');

    // …and the disclosure names the record, in its own currency.
    const row = document.querySelector('[data-unconverted="rev-eur-1"]');
    expect(row).not.toBeNull();
    expect(row!.textContent).toContain('1.000,00 EUR');

    // The lei total is still zero: the record is absent from it, never added at an invented rate.
    const summaryCard = [...document.querySelectorAll('section.card')].find(
      (s) => s.querySelector('h2.card-title')?.textContent === 'Rezumat',
    );
    expect(summaryCard).toBeDefined();
    expect(summaryCard!.textContent).toContain('0,00 RON');
  });

  test('Phase 10c: with a rate recorded for its date, the same record reads as lei on the page', async () => {
    writeCurrentPayload({ revenues: [eurRevenue()], fxRates: [EUR_DAILY_2026_10_08] });
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Tablou de bord' })).toBeVisible();
    const summaryCard = [...document.querySelectorAll('section.card')].find(
      (s) => s.querySelector('h2.card-title')?.textContent === 'Rezumat',
    );
    expect(summaryCard).toBeDefined();
    // 1.000,00 EUR × 5,3470 = 5.347,00 lei — the same figure the graph and the estimate carry.
    expect(summaryCard!.textContent).toContain('5.347,00 RON');
    expect(document.querySelector('[data-unconverted-count]')).toBeNull();
    expect(document.querySelector('[data-conversion="rev-eur-1"]')).not.toBeNull();
  });
});
