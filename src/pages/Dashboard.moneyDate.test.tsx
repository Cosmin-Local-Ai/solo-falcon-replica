/**
 * B-67 — the money date the app assumed, disclosed where the estimate is computed.
 *
 * `revenueFiscalDate` / `expenseFiscalDate` fall back to the record's `date` when `collected` / `paid` is
 * absent. That fallback is the whole of D-DATE-1's stand-in, and it has no legal footing for Titlul IV:
 * the document date is a **validity condition** (art. 68 alin. (4) lit. a) — „justificate prin
 * documente”), never the fact that decides the year, which is „sumele încasate” (alin. (2) lit. a)) and
 * „al anului în cursul căruia au fost plătite” (alin. (4) lit. b)). No provision presumes document date =
 * money date, and none fills in a blank money date.
 *
 * The behaviour is deliberately unchanged — which date to record is the person's decision, not a defect to
 * fix. What is added is the disclosure, on the surface that computes a figure from the assumption. The two
 * forms and the RJIP export already said it; the estimate was the one surface that did not.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import type { Bani } from '../domain/money';
import Dashboard from './Dashboard';
import { pinClock, unpinClock } from '../test/clock';
import { fixedInstant } from '../test/fixedInstant';

const STORAGE_KEY = 'pfa-app-data-v2';

/** 1.000,00 lei, no VAT. `collected` is passed only when the money date really is recorded. */
function revenue(id: string, date: string, collected?: string) {
  return {
    id,
    tip: 'factura',
    nr: `FCT-${id}`,
    date,
    client: 'Client SRL',
    cui: 'RO12345678',
    valoareFaraTva: { amount: 100_000 as Bani, currency: 'RON' },
    tva: { amount: 0 as Bani, currency: 'RON' },
    status: 'inregistrata',
    ...(collected === undefined ? {} : { collected }),
  };
}

function writePayload(revenues: unknown[]): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      reservedAmount: null,
      profile: seedData.profile,
      revenues,
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
    }),
  );
}

beforeEach(() => pinClock(fixedInstant()));
afterEach(() => {
  unpinClock();
  localStorage.clear();
});

describe('the estimate discloses the money date it assumed', () => {
  it('a record with no money date is named, with the provision that decides the year', () => {
    writePayload([revenue('rev-assumed', '2026-05-04')]);
    render(<StoreProvider><Dashboard /></StoreProvider>);

    const note = document.querySelector('[data-money-date-assumption]');
    expect(note).not.toBeNull();
    expect(note?.getAttribute('data-money-date-assumption')).toBe('1');
    const text = note?.textContent ?? '';
    // What the app did, stated as what the app did.
    expect(text).toContain('data documentului');
    // What the law actually decides the year by — and the denial of the presumption the app did NOT make.
    expect(text).toContain('art. 68 alin. (2) lit. a)');
    expect(text).toContain('art. 68 alin. (4) lit. b)');
    expect(text).toContain('nu prezumă');
    // It must not be softened into a vague "date may differ".
    expect(text).toContain('nu are dată de');
  });

  it('a record that carries its collection date is not counted, and the sentence stays off the page', () => {
    writePayload([revenue('rev-collected', '2026-05-04', '2026-05-06')]);
    render(<StoreProvider><Dashboard /></StoreProvider>);

    expect(document.querySelector('[data-money-date-assumption]')).toBeNull();
  });

  it('a record outside the declared fiscal year is not counted against this year', () => {
    writePayload([revenue('rev-other-year', '2025-05-04')]);
    render(<StoreProvider><Dashboard /></StoreProvider>);

    expect(document.querySelector('[data-money-date-assumption]')).toBeNull();
  });

  it('the count is the register\'s, not a per-record paraphrase: two records, one sentence, the number stated', () => {
    writePayload([revenue('rev-a', '2026-03-01'), revenue('rev-b', '2026-04-01')]);
    render(<StoreProvider><Dashboard /></StoreProvider>);

    const notes = document.querySelectorAll('[data-money-date-assumption]');
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent).toContain('2 înregistrări');
  });
});
