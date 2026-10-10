/**
 * Phase 10c (B-36) — a rate enters the product through Settings, and the user fixes their own ledger.
 *
 * The defect: `recordFxRate` was a correct validated upsert with **zero callers**. The FX card showed
 * rates; nothing could produce one. A user holding a EUR invoice therefore met the missing-rate refusal
 * with no route out except a developer writing to localStorage — which is what "the app cannot resolve its
 * own missing datum" means in practice.
 *
 * These tests drive the form the way a person does: type a rate, press the button, look at the totals.
 * The reload test is the one that matters most: the rate the user typed is still there after a reload, and
 * the record reconciles without anyone touching the invoice.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { STORAGE_KEY, StoreProvider, useStore } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import Settings from './Settings';
import { getFinancialSummary, getLedgerDisclosure } from '../data/dashboard';
import { copy } from '../ui/copy';
import { lei, majorToMinor, money } from '../domain/money';
import type { AppData, Revenue } from '../data/types';

const AS_OF = '2026-12-31';

const eur = (major: number) => money(majorToMinor(major, 'EUR'), 'EUR');

const EUR_REVENUE: Revenue = {
  id: 'rev-eur-1',
  tip: 'factura',
  nr: 'FCT-FX-1',
  date: '2026-10-08',
  client: 'Client Test',
  cui: 'RO00000000',
  valoareFaraTva: eur(1000),
  tva: eur(0),
  status: 'inregistrata',
};

/** The payload a user would already have: a EUR invoice and no rate anywhere. */
function payload(): AppData & { version: number } {
  return {
    ...seedData,
    revenues: [EUR_REVENUE],
    expenses: [],
    version: CURRENT_DATA_VERSION,
  };
}

let storeRef: ReturnType<typeof useStore> | null = null;
function Probe() {
  storeRef = useStore();
  return null;
}

function renderSettings() {
  return render(
    <StoreProvider>
      <Probe />
      <Settings initialTab="fiscal" />
    </StoreProvider>,
  );
}

function field(name: string): HTMLInputElement | HTMLSelectElement {
  const el = document.querySelector(`[name="${name}"]`);
  if (!el) throw new Error(`no form field named ${name}`);
  return el as HTMLInputElement;
}

function setField(name: string, value: string): void {
  act(() => {
    fireEvent.change(field(name), { target: { value } });
  });
}

function submit(): void {
  const button = screen.getByRole('button', { name: copy.fx.entry.save });
  act(() => {
    button.click();
  });
}

function stored(): AppData {
  if (storeRef === null) throw new Error('store probe not mounted');
  return storeRef;
}

beforeEach(() => {
  localStorage.clear();
  storeRef = null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload()));
});

afterEach(() => {
  localStorage.clear();
  storeRef = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Phase 10c — rate ingress through Settings (B-36)', () => {
  it('starts with the EUR record out of the lei totals and named as unconverted', () => {
    renderSettings();
    expect(getFinancialSummary(stored(), AS_OF).revenue).toBe(lei(0));
    const disclosure = getLedgerDisclosure(stored());
    expect(disclosure.conversions).toHaveLength(0);
    expect(disclosure.unconverted).toHaveLength(1);
    expect(disclosure.unconverted[0].id).toBe('rev-eur-1');
  });

  it('a rate typed into the form brings the record into the lei totals, without touching the record', () => {
    renderSettings();

    setField('fx-rate', '5.3470');
    setField('fx-date', '2026-10-08');
    submit();

    expect(document.querySelector('[data-fx-entry-saved]')).not.toBeNull();

    const rates = stored().fxRates ?? [];
    expect(rates).toHaveLength(1);
    // The record the store accepted is the one the schema describes: manual, sourced, keyed to a day.
    expect(rates[0]).toMatchObject({
      currency: 'EUR',
      rate: '5.3470',
      rateKind: 'daily_reference',
      rateDate: '2026-10-08',
      seriesCode: 'CURSZ_EUR',
      entryMode: 'manual',
      provisional: true,
    });
    expect(rates[0].sourceUrl).toContain('curs.bnr.ro');
    expect(rates[0].fetchedAt).not.toBe('');

    // The ledger reconciles on the spot: same record, same date, now a lei figure.
    expect(getFinancialSummary(stored(), AS_OF).revenue).toBe(lei(5347));
    expect(getLedgerDisclosure(stored()).unconverted).toHaveLength(0);
    expect(getLedgerDisclosure(stored()).conversions[0].rate).toBe('5.3470');
  });

  it('the rate the user entered survives a reload and the record still reconciles', () => {
    const first = renderSettings();
    setField('fx-rate', '5.3470');
    setField('fx-date', '2026-10-08');
    submit();
    act(() => {
      first.unmount();
    });

    // A fresh provider re-reads localStorage: this is the reload, not a re-render.
    renderSettings();

    expect((stored().fxRates ?? []).map(r => r.rate)).toEqual(['5.3470']);
    expect(getFinancialSummary(stored(), AS_OF).revenue).toBe(lei(5347));
    expect(getLedgerDisclosure(stored()).unconverted).toHaveLength(0);
  });

  it('refuses an incomplete rate and shows the validator’s own reasons, unedited', () => {
    renderSettings();

    submit(); // nothing typed

    const refusal = document.querySelector('[data-fx-entry-refused]');
    expect(refusal).not.toBeNull();
    const shown = refusal?.textContent ?? '';
    // Verbatim from `validateRateRecord` — the app does not rewrite a refusal into friendlier words.
    expect(shown).toContain('rate:');
    expect(shown).toContain('rate must be a decimal string');

    // And nothing was recorded: a refused rate must not half-enter.
    expect(stored().fxRates ?? []).toHaveLength(0);
    expect(getFinancialSummary(stored(), AS_OF).revenue).toBe(lei(0));
  });

  it('a rate with no date is refused by the rule that a daily rate must name its day', () => {
    renderSettings();

    setField('fx-rate', '5.3470'); // a well-formed number, anchored to nothing
    submit();

    const shown = document.querySelector('[data-fx-entry-refused]')?.textContent ?? '';
    expect(shown).toContain('rateDate: a daily reference rate needs the date it was published for');
    expect(stored().fxRates ?? []).toHaveLength(0);
    expect(getFinancialSummary(stored(), AS_OF).revenue).toBe(lei(0));
  });

  it('the same currency, kind and date replaces the stored rate — the upsert is the correction route', () => {
    renderSettings();

    setField('fx-rate', '5.3470');
    setField('fx-date', '2026-10-08');
    submit();
    expect(getFinancialSummary(stored(), AS_OF).revenue).toBe(lei(5347));

    setField('fx-rate', '5.0000');
    submit();

    const rates = stored().fxRates ?? [];
    expect(rates).toHaveLength(1);
    expect(rates[0].rate).toBe('5.0000');
    expect(getFinancialSummary(stored(), AS_OF).revenue).toBe(lei(5000));
    // The message says a replacement happened; it does not pretend a second rate was recorded.
    expect(document.querySelector('[data-fx-entry-saved]')?.textContent).toContain('înlocuită');
  });

  it('an annual average for a year that has not closed is recorded provisional, not left to the entrant', () => {
    vi.useFakeTimers({ now: new Date('2026-10-31T12:00:00').getTime() });
    renderSettings();

    setField('fx-kind', 'annual_average');
    setField('fx-year', '2026');
    setField('fx-rate', '5.0000');
    expect((field('fx-provisional') as HTMLSelectElement).value).toBe('da');
    submit();

    const rates = stored().fxRates ?? [];
    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({ rateKind: 'annual_average', rateYear: 2026, provisional: true });
    expect(rates[0].seriesCode).toBe('CURSA_EURM');
  });

  it('entering a rate performs no network call — ingress is manual, as 10a and 10b left it', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderSettings();

    setField('fx-rate', '5.3470');
    setField('fx-date', '2026-10-08');
    submit();

    expect((stored().fxRates ?? []).length).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
