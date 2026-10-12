import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StoreProvider, STORAGE_KEY } from '../data/store';
import { CURRENT_DATA_VERSION, DATA_VERSION_RECORD_CURRENCY } from '../data/migration';
import { seedData } from '../data/seed';
import type { AnnualFiling } from '../data/types';
import type { LegacyMonthlyDeclaration } from '../data/schema';
import { lei } from '../domain/money';
import Declarations from './Declarations';

/**
 * PG-5 re-pin (replaced, not deleted): this regression used to edit a monthly declaration row. The
 * record is annual now — `AnnualFiling` — and the edit flow it guards runs through the annual register.
 * What the test protects has not changed: editing a record updates it in place and does not quietly
 * reset a field the user did not touch.
 *
 * PG-5b: the monthly row below is no longer a record the page can show. It is loaded as legacy input —
 * a pre-v11 payload's `declarations` key — so the page is exercised against the bytes an old install
 * really holds, and the assertion is that nothing from that key reaches the screen.
 */
const FILING: AnnualFiling = {
  id: 'f26',
  taxYear: 2026,
  form: 'D212',
  status: 'in_pregatire',
  reference: 'REF-2026-001',
};

const LEGACY_ROW: LegacyMonthlyDeclaration = {
  id: 'd3',
  an: 2026,
  luna: 9,
  venituri: lei(9680),
  cheltuieli: lei(546),
  status: 'inregistrata',
  dataInregistrare: '2026-09-28',
};

function renderWithFiling() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...seedData,
      version: CURRENT_DATA_VERSION,
      filings: [FILING],
    }),
  );
  return render(
    <StoreProvider>
      <Declarations />
    </StoreProvider>,
  );
}

/** The same register, loaded from bytes one version behind the chain's head and still carrying a row. */
function renderFromPreV11Payload() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...seedData,
      version: DATA_VERSION_RECORD_CURRENCY,
      filings: [FILING],
      declarations: [LEGACY_ROW],
    }),
  );
  return render(
    <StoreProvider>
      <Declarations />
    </StoreProvider>,
  );
}

/** Rows of the annual register. */
function filingRows() {
  // PG-6g: the page now also carries the VAT calendar, the D300 rubric layout and the parked-list tables,
  // so „the first table on the page" is no longer the annual register. The selector names the register
  // rather than its position — which is what this helper was always for.
  return document.querySelectorAll('table[data-register="d212"] tbody tr');
}

describe('Declarations edit flow (regression)', () => {
  it('updates an existing annual filing in place instead of duplicating it', () => {
    renderWithFiling();

    expect(filingRows()).toHaveLength(1);
    expect(screen.getByText('REF-2026-001')).toBeInTheDocument();

    // Open the edit form by clicking the row.
    act(() => {
      screen.getByText('2026').click();
    });

    // Change only the reference; leave the status select untouched.
    const reference = screen.getByDisplayValue('REF-2026-001');
    act(() => {
      fireEvent.change(reference, { target: { value: 'REF-2026-002' } });
    });
    act(() => {
      screen.getByText('Salvează').click();
    });

    // No duplicate row was created and the edited value is displayed.
    expect(filingRows()).toHaveLength(1);
    expect(screen.getByText('REF-2026-002')).toBeInTheDocument();
    // The year the return declares survived the round trip.
    expect(screen.getByText('2026')).toBeInTheDocument();
  });

  it('preserves the existing status when editing only the reference (no status regression)', () => {
    renderWithFiling();

    act(() => {
      screen.getByText('2026').click();
    });

    // The form initializes its status field from the existing filing.
    const selects = screen.getAllByRole('combobox');
    expect(selects[1]).toHaveValue('in_pregatire');

    act(() => {
      fireEvent.change(screen.getByDisplayValue('REF-2026-001'), { target: { value: 'REF-2026-002' } });
    });
    act(() => {
      screen.getByText('Salvează').click();
    });

    expect(filingRows()).toHaveLength(1);
    expect(screen.getByText('În pregătire')).toBeInTheDocument();
    expect(screen.getByText('REF-2026-002')).toBeInTheDocument();
  });

  it('marks a return filed from the row, and the filed date appears', () => {
    renderWithFiling();

    act(() => {
      screen.getByRole('button', { name: 'Marchează ca depusă' }).click();
    });

    expect(filingRows()).toHaveLength(1);
    expect(screen.getByText('Depusă')).toBeInTheDocument();
    // A date exists because the app was just told the return was filed — it is not backdated.
    const filedCell = filingRows()[0]!.querySelectorAll('td')[3]!.textContent;
    expect(filedCell).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  });

  it('shows no monthly register at all, even when the stored payload carries one', () => {
    // PG-5b re-premise of "shows the legacy monthly rows read-only, with no write control". What the test
    // has always guarded is that the monthly family gets no affordance and no standing as a filing. The
    // answer is now stronger: there is no second table, no monthly row and no monthly heading, because the
    // `annual-filing` step drops those rows before the page can read them.
    renderFromPreV11Payload();

    // One annual register — and the annual row is in it. PG-6g added other tables to this page (the VAT
    // calendar, the D300 rubric layout, the parked lists), so the pin is on the D212 register being single,
    // not on the page holding exactly one table. What has not changed is that no monthly register is among
    // them: the `annual-filing` step drops those rows before the page can read them.
    expect(document.querySelectorAll('table[data-register="d212"]')).toHaveLength(1);
    expect(filingRows()).toHaveLength(1);

    // Nothing from the legacy key reached the screen: not the period, not the amounts, not the row id.
    expect(screen.queryByText('2026-09')).toBeNull();
    expect(screen.queryByText('9.680,00 RON')).toBeNull();
    expect(document.querySelector('[data-record-id="d3"]')).toBeNull();
  });
});

/**
 * PG-6g, acceptance 7 — the new-PFA path on screen.
 *
 * The property the brief names is a negative one and an affirmative one at once: the app must never state
 * a cadence it has not established, and every branch it cannot close must leave the person somewhere to
 * go. So these tests drive the likeliest shape of this product's user — a PFA that registered for VAT in
 * the middle of the year, from under the art. 310 ceiling — and assert the whole loop: the rule is stated,
 * the question is asked, the answer is recorded as the person's, and only then does a calendar appear.
 */
const BNR_31_12_2025 = {
  currency: 'EUR' as const,
  rate: '5.0963',
  rateKind: 'daily_reference' as const,
  rateDate: '2025-12-31',
  seriesCode: 'CURSZ_EUR',
  sourceUrl: 'https://www.bnr.ro/Cursul-de-schimb--7333.html',
  fetchedAt: '2026-01-02T08:00:00Z',
  provisional: false,
  entryMode: 'fetched' as const,
};

/** A PFA registered on 1 Oct 2026, with nothing declared about how it got there. */
function renderNewPfa(overrides: Record<string, unknown> = {}) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...seedData,
      version: CURRENT_DATA_VERSION,
      fxRates: [BNR_31_12_2025],
      profile: {
        ...seedData.profile,
        fiscalYear: 2026,
        vatRegistration: { status: 'inregistrat_art316', effectiveFrom: '2026-10-01' },
        vatPeriodicityYears: [{
          year: 2026,
          registrationEffectiveFrom: '2026-10-01',
          registrationRoute: 'b',
          ...overrides,
        }],
      },
    }),
  );
  return render(
    <StoreProvider>
      <Declarations />
    </StoreProvider>,
  );
}

describe('PG-6g — the periodicity is asked, never guessed (acceptance 7)', () => {
  it('states the rule and asks which alineat applies, without naming a cadence', () => {
    renderNewPfa();
    const panel = document.querySelector('[data-testid="vat-periodicity"]')!;

    // The rule is on screen in Romanian, with the article that states it.
    expect(panel.textContent).toContain('art. 322 alin. (3)');
    expect(panel.textContent).toContain('art. 322 alin. (4)');
    // The question, phrased so a person can answer it.
    expect(panel.textContent).toContain('scutirea de TVA de la art. 310');
    // And the statutory default, attributed to art. 322 alin. (1) rather than presented as a conclusion.
    expect(panel.textContent).toContain('art. 322 alin. (1)');
    expect(panel.textContent).toContain('perioada fiscală este luna calendaristică');

    // No cadence asserted as an answer, and no calendar built from a guessed one.
    expect(panel.querySelector('[data-obligation-id]')).toBeNull();
    expect(document.body.textContent).toContain(
      'Nicio obligație de depus care să poată fi datată',
    );
  });

  it('records the person\'s confirmation as THEIRS, and only then shows the calendar', () => {
    renderNewPfa();
    fireEvent.click(screen.getByText('Depun trimestrial'));

    const panel = document.querySelector('[data-testid="vat-periodicity"]')!;
    expect(panel.textContent).toContain('alegerea dumneavoastră');
    expect(panel.textContent).not.toContain('derivat din lege');

    // The answer is stored on the profile with the literal that says who gave it.
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
      profile: { vatPeriodicityYears: { year: number; userChoice?: { periodicity: string; confirmedBy: string } }[] };
    };
    const choice = stored.profile.vatPeriodicityYears.find((y) => y.year === 2026)!.userChoice!;
    expect(choice.periodicity).toBe('quarter');
    expect(choice.confirmedBy).toBe('user');

    // A quarterly answer produces quarterly deconturi. The fourth one is deliberately NOT listed yet:
    // `closedThrough` drops a period that is still running, and the app does not date a decont for a
    // quarter it has not finished. The Q4 -> 25 ianuarie a anului următor rollover itself is pinned in
    // `src/domain/fiscal/vatReturn.test.ts`, where the term is asserted without a clock in the way.
    const rows = document.querySelectorAll('[data-obligation-id]');
    expect(rows.length).toBeGreaterThan(0);
    const dueCells = [...rows].map((r) => r.querySelectorAll('td')[1]!.textContent ?? '');
    expect(dueCells).toEqual(['25.04.2026', '25.07.2026', '25.10.2026']);
  });

  it('shows the rate the lei cap was struck at, and never a bare lei threshold', () => {
    renderNewPfa();
    const cap = document.querySelector('[data-testid="vat-cap"]')!;
    expect(cap.textContent).toContain('5.0963');
    expect(cap.textContent).toContain('31.12.2025');
    // 509.630 is the number research/33 records as CORROBORATED / secondary. It is derived here, so it is
    // not written into this surface, and this assertion is what keeps it out.
    expect(cap.textContent).not.toContain('509.630');
  });

  it('keeps the obligation kinds apart, and honours who the alin. (6) mențiuni duty does NOT bind', () => {
    // alin. (6) names those quarterly „potrivit alin. (2) și (5)". A person whose quarter came from the
    // registration-year estimate (alin. (3)) is not named by it, so no mențiuni row is invented for them —
    // which is the same discipline as not inventing the cadence.
    renderNewPfa({ inArt310BeforeRegistration: 'nu', forecastStubTurnover: 1_000_000 });
    const kinds = new Set(
      [...document.querySelectorAll('[data-obligation-id]')].map(
        (r) => r.querySelector('div')?.textContent ?? '',
      ),
    );
    expect(kinds).toContain('Decont de taxă');
    expect(kinds.has('Declarație de mențiuni (25 ianuarie)')).toBe(false);
  });

  it('shows the 25-ianuarie mențiuni row for a quarter established under alin. (2)', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...seedData,
        version: CURRENT_DATA_VERSION,
        fxRates: [BNR_31_12_2025],
        profile: {
          ...seedData.profile,
          fiscalYear: 2026,
          vatRegistration: { status: 'inregistrat_art316', effectiveFrom: '2025-01-01' },
          vatPeriodicityYears: [{
            year: 2026,
            registrationEffectiveFrom: '2025-01-01',
            registrationRoute: 'b',
            precedingYearTurnover: 1_000_000,
            precedingYearAicGoods: 'nu',
          }],
        },
      }),
    );
    render(<StoreProvider><Declarations /></StoreProvider>);
    const rows = [...document.querySelectorAll('[data-obligation-id]')];
    const kinds = new Set(rows.map((r) => r.querySelector('div')?.textContent ?? ''));
    expect(kinds).toContain('Declarație de mențiuni (25 ianuarie)');
    // It is its own row with its own citation, never a second label on a decont.
    const mentiuni = rows.find((r) => r.querySelector('div')?.textContent === 'Declarație de mențiuni (25 ianuarie)')!;
    expect(mentiuni.textContent).toContain('art. 322 alin. (6)');
    expect(mentiuni.querySelector('button')).toBeNull();
  });

  it('records a filing against the calendar row, and says the app recorded it rather than that it filed it', () => {
    renderNewPfa({ inArt310BeforeRegistration: 'nu', forecastStubTurnover: 1_000_000 });
    const row = document.querySelector('[data-obligation-id^="decont-"]')!;
    const obligationId = row.getAttribute('data-obligation-id')!;
    fireEvent.click(row.querySelector('button')!);
    expect(row.textContent).toContain('Depusă');

    // The record names the calendar row it discharges and the period it covers — not the year of the term.
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
      vatReturns: { obligationId: string; year: number; form: string; periodKind: string; status: string; filedOn?: string }[];
    };
    const rec = stored.vatReturns.find((r) => r.obligationId === obligationId)!;
    expect(rec.form).toBe('300');
    expect(rec.periodKind).toBe('quarter');
    expect(rec.status).toBe('depusa');
    expect(rec.filedOn).toBeTruthy();

    // B-56 discipline: nothing on screen claims a submission happened. The app recorded one.
    expect(document.body.textContent).not.toMatch(/am depus decontul|decontul a fost depus la ANAF|am trimis decontul/);
  });
});
