/**
 * Phase 10c (B-37) — the disclosure that lets a user check a converted number.
 *
 * The card is rendered from `getLedgerDisclosure`, i.e. from the same ledger pass the totals were built
 * on, so these tests assert what a person can actually read: the printed rate, the date it is keyed to,
 * the provisional state inside a converted total, and — the half that matters most — the record that is
 * NOT in the totals, with the datum that is missing.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import CurrencySection from './CurrencySection';
import { getLedgerDisclosure } from '../../data/dashboard';
import { seedData } from '../../data/seed';
import type { AppData, Revenue } from '../../data/types';
import type { FxRateRecord } from '../../domain/fx/rates';
import { money, majorToMinor, ron } from '../../domain/money';
import { fx } from '../../ui/copy';

const eur = (major: number) => money(majorToMinor(major, 'EUR'), 'EUR');

/** The EUR row research 23 captured from BNR for 2026-10-08. */
const EUR_DAILY_2026_10_08: FxRateRecord = {
  currency: 'EUR', rate: '5.3470', rateKind: 'daily_reference', rateDate: '2026-10-08',
  seriesCode: 'CURSZ_EUR', sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
  fetchedAt: '2026-10-08T13:05:00Z', provisional: false, entryMode: 'fetched',
};

/** TEST SCAFFOLDING — a provisional rate: round number, non-BNR source, never to be read as published. */
const EUR_DAILY_PROVISIONAL: FxRateRecord = {
  ...EUR_DAILY_2026_10_08, rateDate: '2026-10-09', rate: '5.0000', provisional: true,
  seriesCode: 'CURSZ_EUR-TEST', sourceUrl: 'https://example.invalid/hand-entered-test-rate',
};

function revenue(over: Partial<Revenue> = {}): Revenue {
  return {
    id: 'rev-eur-1', tip: 'factura', nr: 'FCT-FX-1', date: '2026-10-08',
    client: 'Client Test', cui: 'RO00000000',
    valoareFaraTva: eur(1000), tva: eur(0), status: 'inregistrata',
    ...over,
  };
}

function dataWith(revenues: Revenue[], fxRates: FxRateRecord[]): AppData {
  return { ...seedData, revenues, expenses: [], fxRates };
}

describe('CurrencySection — the ledger disclosure (B-37)', () => {
  it('shows a converted record with the rate, the anchor date, the series and the source', () => {
    const disclosure = getLedgerDisclosure(dataWith([revenue()], [EUR_DAILY_2026_10_08]));
    render(<CurrencySection disclosure={disclosure} id="ledger-currency" />);

    expect(screen.getByText('5.3470')).toBeInTheDocument();
    // The amount as recorded, in its own currency — not the lei figure wearing the euro sign.
    expect(screen.getByText(/1\.000,00 EUR/)).toBeInTheDocument();
    expect(screen.getByText('CURSZ_EUR')).toBeInTheDocument();
    expect(screen.getByText('https://curs.bnr.ro/nbrfxrates.xml')).toBeInTheDocument();
    expect(screen.getByText(fx.finalBadge)).toBeInTheDocument();
    // The basis reaches the screen as a Romanian label, never as the internal code.
    expect(screen.queryByText('payment_date_daily')).toBeNull();
  });

  it('names the record left out of the totals, with the amount and the missing datum', () => {
    const disclosure = getLedgerDisclosure(dataWith([revenue()], []));
    render(<CurrencySection disclosure={disclosure} />);

    expect(screen.getByText(fx.ledger.unconvertedTitle)).toBeInTheDocument();
    const lead = document.querySelector('[data-unconverted-count]');
    expect(lead?.getAttribute('data-unconverted-count')).toBe('1');
    expect(lead?.textContent).toContain(fx.ledger.unconvertedLead(1));
    expect(screen.getByText('1.000,00 EUR')).toBeInTheDocument();
    // The detail names the currency and the date the rate would have been keyed to.
    expect(document.querySelector('[data-unconverted="rev-eur-1"]')?.textContent).toContain('2026-10-08');
    // Nothing was converted, so no converted row is claimed.
    expect(document.querySelector('[data-conversion]')).toBeNull();
  });

  it('a provisional rate is labelled provisional inside the converted total', () => {
    const disclosure = getLedgerDisclosure(
      dataWith([revenue({ date: '2026-10-09' })], [EUR_DAILY_PROVISIONAL]),
    );
    render(<CurrencySection disclosure={disclosure} />);

    expect(document.querySelector('[data-provisional="true"]')?.textContent).toBe(fx.provisionalBadge);
    expect(screen.getByText(fx.ledger.provisionalInTotal)).toBeInTheDocument();
  });

  it('says plainly when the anchor is the document date rather than a money date', () => {
    // The record has no `collected`, so the conversion is anchored on the invoice date — and the card says
    // so instead of letting it read as a payment date. (PG-2 is the phase that lets a user write one.)
    const disclosure = getLedgerDisclosure(dataWith([revenue()], [EUR_DAILY_2026_10_08]));
    render(<CurrencySection disclosure={disclosure} />);
    expect(screen.getByText(fx.ledger.anchoredOnDocumentDate)).toBeInTheDocument();
  });

  it('says so when there is nothing foreign in the ledger at all', () => {
    const disclosure = getLedgerDisclosure(dataWith(
      [{ ...revenue(), valoareFaraTva: ron(1000), tva: ron(0) }],
      [],
    ));
    render(<CurrencySection disclosure={disclosure} />);
    expect(screen.getByText(fx.empty)).toBeInTheDocument();
  });
});
