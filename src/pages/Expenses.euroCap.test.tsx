/**
 * TASK 10b — a ceiling the law states in euro has to be legible on the screen that shows the expenses:
 * the lei figure, the rate that produced it, the year it is anchored to, whether that rate is provisional,
 * and the reading that was NOT applied. A converted ceiling that cannot name its rate is the same defect
 * B-32 was, and a provisional ceiling presented as final is B-33.
 *
 * The exact arithmetic is pinned at the domain layer (`estimateBasis.euroCaps.test.ts`, hand-derived).
 * This page runs on `localDateISO(now())`, so what is pinned here is what the screen must always show:
 * both figures, the rate, the provisional/final badge, and the rule's own conflict sentence.
 *
 * The FY2026 annual averages below are TEST SCAFFOLDING with a non-BNR source URL — BNR publishes no
 * FY2026 average until the year closes (research 23 item 4). The USD daily row exercises a real path
 * (BNR's XML carries USD) with a number that is not attributed to BNR.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Expenses from './Expenses';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import type { Expense } from '../data/types';
import type { FxRateRecord } from '../domain/fx/rates';
import { majorToMinor, money, ron } from '../domain/money';

const STORAGE_KEY = 'pfa-app-data-v2';
const PAYMENT_DATE = '2026-03-15';

const usd = (major: number) => money(majorToMinor(major, 'USD'), 'USD');

/** TEST SCAFFOLDING — no FY2026 average is published. The provisional half of the lifecycle. */
const EUR_ANNUAL_2026_PROVISIONAL: FxRateRecord = {
  currency: 'EUR', rate: '5.3100', rateKind: 'annual_average', rateYear: 2026,
  seriesCode: 'CURSA_EURM-TEST', sourceUrl: 'https://example.invalid/hand-entered-test-average',
  fetchedAt: '2026-10-09T09:00:00Z', provisional: true, entryMode: 'manual',
};

/** TEST SCAFFOLDING — the same anchor after „BNR published it". */
const EUR_ANNUAL_2026_FINAL: FxRateRecord = {
  ...EUR_ANNUAL_2026_PROVISIONAL, rate: '5.4000', provisional: false, fetchedAt: '2027-01-15T09:00:00Z',
};

/** TEST SCAFFOLDING — the daily rate the competing art. 9 reading would use for this payment date. */
const EUR_DAILY: FxRateRecord = {
  currency: 'EUR', rate: '5.3000', rateKind: 'daily_reference', rateDate: PAYMENT_DATE,
  seriesCode: 'CURSZ_EUR', sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
  fetchedAt: '2026-03-15T13:05:00Z', provisional: false, entryMode: 'fetched',
};

/** TEST SCAFFOLDING for the number; the USD daily path itself is real. */
const USD_DAILY: FxRateRecord = {
  currency: 'USD', rate: '4.5000', rateKind: 'daily_reference', rateDate: PAYMENT_DATE,
  seriesCode: 'CURSZ_USD-PATTERN', sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
  fetchedAt: '2026-03-15T13:05:00Z', provisional: false, entryMode: 'fetched',
};

function seedWith(expenses: Expense[], fxRates?: FxRateRecord[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...seedData,
      expenses: [...seedData.expenses, ...expenses],
      ...(fxRates ? { fxRates } : {}),
      version: CURRENT_DATA_VERSION,
    }),
  );
}

function expense(over: Partial<Expense>): Expense {
  return {
    id: over.id ?? 'euro-cap-exp',
    tip: 'factura',
    nr: 'FCT-EC-1',
    date: PAYMENT_DATE,
    furnizor: 'Furnizor Test',
    cui: 'RO99999999',
    valoareFaraTva: ron(800),
    tva: ron(152),
    status: 'inregistrata',
    ...over,
  };
}

function renderPage() {
  render(
    <StoreProvider>
      <Expenses />
    </StoreProvider>,
  );
}

describe('Expenses — a euro ceiling is shown as a lei ceiling, with the rate that made it one', () => {
  beforeEach(() => localStorage.clear());

  it('names the applied ceiling, the annual average, the payment year and the provisional state', () => {
    // 100 EUR (lit. r)) × 5,3100 = 531,00 lei; the claim of 800,00 lei is above it.
    seedWith([expense({ category: 'sports_subscription' })], [EUR_ANNUAL_2026_PROVISIONAL, EUR_DAILY]);
    renderPage();

    expect(screen.getByText(/Plafonul în euro, convertit/)).toBeInTheDocument();
    expect(screen.getByText(/531,00 RON/)).toBeInTheDocument();
    expect(screen.getByText(/^5\.3100$/)).toBeInTheDocument();
    expect(screen.getByText(/pentru anul 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Provizoriu/)).toBeInTheDocument();
    expect(screen.getByText(/plafonul este provizoriu/)).toBeInTheDocument();
  });

  it('shows the competing art. 9 ceiling beside the applied one, and says the law does not settle it', () => {
    // 100 EUR × 5,3000 = 530,00 lei under the payment-date reading, against the 531,00 lei applied.
    seedWith([expense({ category: 'sports_subscription' })], [EUR_ANNUAL_2026_PROVISIONAL, EUR_DAILY]);
    renderPage();

    expect(screen.getByText(/cealaltă citire, cursul BNR de la data plății:/)).toBeInTheDocument();
    expect(screen.getByText(/530,00 RON/)).toBeInTheDocument();
    // The statement that neither reading is settled is the RULE's own parameter, rendered verbatim —
    // not a sentence written in the component.
    expect(screen.getByText(/CONFLICT NEREZOLVAT/)).toBeInTheDocument();
    expect(screen.getByText(/normele nu sunt „prezentul cod/)).toBeInTheDocument();
  });

  it('after a final rate replaces the provisional one, the same ceiling reads as final', () => {
    // The screen half of B-33: 100 EUR × 5,4000 = 540,00 lei, and no provisional label anywhere.
    seedWith([expense({ category: 'sports_subscription' })], [EUR_ANNUAL_2026_FINAL, EUR_DAILY]);
    renderPage();

    expect(screen.getByText(/540,00 RON/)).toBeInTheDocument();
    expect(screen.getByText(/Definitiv/)).toBeInTheDocument();
    expect(screen.queryByText(/Provizoriu/)).not.toBeInTheDocument();
    expect(screen.queryByText(/plafonul este provizoriu/)).not.toBeInTheDocument();
  });

  it('with no rate recorded the ceiling is still reported as unmeasurable, not as zero', () => {
    seedWith([expense({ category: 'sports_subscription' })]);
    renderPage();

    expect(screen.queryByText(/Plafonul în euro, convertit/)).not.toBeInTheDocument();
    expect(screen.getByText(/un plafon legal care nu poate fi măsurat/)).toBeInTheDocument();
    expect(screen.getByText(/anul plății 2026/)).toBeInTheDocument();
  });
});

describe('Expenses — a foreign-currency record that was converted says which rate converted it', () => {
  beforeEach(() => localStorage.clear());

  it('reports the currency, the payment date, the rate and the lei amount', () => {
    // 100,00 USD × 4,5000 = 450,00 lei at the payment-date daily rate (art. 9 alin. (3) lit. b) + alin. (4)).
    seedWith(
      [expense({ id: 'usd-exp', category: 'postal_and_telecom', valoareFaraTva: usd(100), tva: usd(19) })],
      [USD_DAILY],
    );
    renderPage();

    expect(screen.getByText(/USD · 2026-03-15 · curs 4\.5000/)).toBeInTheDocument();
    expect(screen.getByText(/450,00 RON/)).toBeInTheDocument();
  });

  it('a record with no rate is still reported as kept out, not silently omitted', () => {
    seedWith([expense({ id: 'usd-exp', category: 'postal_and_telecom', valoareFaraTva: usd(100), tva: usd(19) })]);
    renderPage();

    expect(screen.getByText(/într-o monedă pe care aplicația nu o poate aduce încă în lei/)).toBeInTheDocument();
    expect(screen.queryByText(/USD · 2026-03-15/)).not.toBeInTheDocument();
  });
});
