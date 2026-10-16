/**
 * PG-2 — the collection date on the revenue side.
 *
 * Three things are pinned here, each resisting a specific regression:
 *
 *  1. **B-46.** The document-date default used to be `new Date().toISOString().slice(0, 10)` — the UTC
 *     calendar day. At 00:30 in Bucharest on 1 Jan 2027 that seeded **31 Dec 2026**, so a record was born
 *     in the previous fiscal year. The instant below is chosen so the two calendar days differ: it is
 *     00:30 on 1 Jan 2027 in Europe/Bucharest, which is still 31 Dec 2026 in UTC. `pinClock` takes that
 *     instant rather than `fixedInstant()`, because the shared constant is 2026-10-31 and this case needs
 *     a year boundary — the shared constant is not edited for one test.
 *  2. **The money date is writable and persists**, and an empty field stays absent: never `''`, never
 *     backfilled from the document date.
 *  3. **The row names the date its fiscal year came from**, in the domain's own
 *     `'collected' | 'paid' | 'date'` vocabulary, so a record sitting in a year the document does not
 *     explain is explainable on the row that shows it.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import Revenues from './Revenues';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import { moneyDate } from '../ui/copy';
import type { Revenue } from '../data/types';
import { ron } from '../domain/money';
import { pinClock, unpinClock } from '../test/clock';
import { fixedInstant } from '../test/fixedInstant';

const STORAGE_KEY = 'pfa-app-data-v2';

/**
 * 00:30 on 1 January 2027, Europe/Bucharest — 2026-12-31T22:30:00Z. The UTC day and the Romanian day are
 * different here, which is exactly the case B-46 got wrong. Written as an explicit `Z` instant so the
 * assertion does not depend on the runner's own time zone.
 */
const BUCHAREST_0030_1_JAN_2027 = new Date('2026-12-31T22:30:00Z');

function revenue(over: Partial<Revenue> = {}): Revenue {
  return {
    id: over.id ?? 'pg2-rev',
    tip: 'factura',
    nr: 'FCT-2026-901',
    date: '2026-12-20',
    client: 'Codexa SRL',
    cui: 'RO12345678',
    valoareFaraTva: ron(1000),
    tva: ron(200),
    status: 'inregistrata',
    ...over,
  };
}

function seedWith(extraRevenues: Revenue[]): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...seedData,
      revenues: [...seedData.revenues, ...extraRevenues],
      version: CURRENT_DATA_VERSION,
    }),
  );
}

/** The form's date inputs in DOM order: the document date, then the collection date. */
function dateInputs(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'));
}

function selectCarrying(value: string): HTMLSelectElement {
  const found = Array.from(document.querySelectorAll<HTMLSelectElement>('select')).find(s =>
    Array.from(s.options).some(o => o.value === value),
  );
  if (!found) throw new Error(`no <select> offers the option ${value}`);
  return found;
}

function noteFor(recordId: string): { text: string; source: string } | null {
  const row = document.querySelector(`tr[data-record-id="${recordId}"]`);
  const note = row?.querySelector('[data-fiscal-date-source]');
  if (!note) return null;
  return { text: note.textContent ?? '', source: note.getAttribute('data-fiscal-date-source') ?? '' };
}

function savedRevenue(nr: string): Revenue | undefined {
  const payload = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  return (payload.revenues as Revenue[] | undefined)?.find(r => r.nr === nr);
}

/** Fill the fields the form requires and submit it. */
function fillAndSubmit(nr: string, { documentDate, collected }: { documentDate?: string; collected?: string } = {}): void {
  const dates = dateInputs();
  if (documentDate !== undefined) fireEvent.change(dates[0], { target: { value: documentDate } });
  if (collected !== undefined) fireEvent.change(dates[1], { target: { value: collected } });
  fireEvent.change(screen.getByPlaceholderText('FCT-2025-0045'), { target: { value: nr } });
  fireEvent.change(selectCarrying('Codexa SRL'), { target: { value: 'Codexa SRL' } });
  const amounts = screen.getAllByPlaceholderText('0,00');
  fireEvent.change(amounts[0], { target: { value: '1000' } });
  fireEvent.change(amounts[1], { target: { value: '200' } });
  fireEvent.click(screen.getByRole('button', { name: 'Adaugă' }));
}

describe('Revenues — the collection date (PG-2)', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    unpinClock();
    localStorage.clear();
  });

  it('at 00:30 local on 1 Jan 2027 a new revenue defaults to 1 Jan 2027, not 31 Dec 2026 (B-46)', () => {
    pinClock(BUCHAREST_0030_1_JAN_2027);
    seedWith([]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adaugă venit/ }));
    expect(dateInputs()[0].value).toBe('2027-01-01');
  });

  it('a revenue created with a collection date stores `collected` and keeps the document date separately', async () => {
    pinClock(fixedInstant());
    seedWith([]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adaugă venit/ }));
    fillAndSubmit('FCT-PG2-901', { documentDate: '2026-12-20', collected: '2027-01-10' });

    await waitFor(() => expect(savedRevenue('FCT-PG2-901')).toBeDefined());
    const created = savedRevenue('FCT-PG2-901')!;
    expect(created.collected).toBe('2027-01-10');
    // The register keeps both dates: writing the money date does not overwrite the document date.
    expect(created.date).toBe('2026-12-20');
  });

  it('leaving the collection date empty stores no `collected` at all — absence stays representable', async () => {
    pinClock(fixedInstant());
    seedWith([]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adaugă venit/ }));
    fillAndSubmit('FCT-PG2-902', { documentDate: '2026-12-20' });

    await waitFor(() => expect(savedRevenue('FCT-PG2-902')).toBeDefined());
    expect('collected' in savedRevenue('FCT-PG2-902')!).toBe(false);
  });

  it('a stored collection date is shown on the row, with the year it moved the record into', () => {
    pinClock(fixedInstant());
    seedWith([revenue({ id: 'pg2-rev-collected', nr: 'FCT-PG2-903', collected: '2027-01-10' })]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    const note = noteFor('pg2-rev-collected');
    expect(note?.source).toBe('collected');
    expect(note?.text).toBe('data încasării: 10.01.2027 · încasat în 2027');
  });

  it('a revenue with no collection date says its fiscal date is the document date', () => {
    pinClock(fixedInstant());
    seedWith([revenue({ id: 'pg2-rev-plain', nr: 'FCT-PG2-904' })]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    const note = noteFor('pg2-rev-plain');
    expect(note?.source).toBe('date');
    expect(note?.text).toBe('data documentului');
  });

  it('a collection date inside the document year is named without a year note', () => {
    pinClock(fixedInstant());
    seedWith([revenue({ id: 'pg2-rev-same', nr: 'FCT-PG2-905', collected: '2026-12-28' })]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    const note = noteFor('pg2-rev-same');
    expect(note?.source).toBe('collected');
    expect(note?.text).toBe('data încasării: 28.12.2026');
  });

  // ── 12C (B-38) — the default named on the field that decides it ──────────────────────────────
  //
  // PG-2 made `collected` writable and B-67 disclosed the fallback on the estimate, but the form itself
  // never said what an empty field does. It said the OPPOSITE: `revenueEmpty` promises that without a
  // collection the sum is not venit brut, while `revenueFiscalDate` resolves the empty field to the
  // document date and counts the receipt in the document's year. A default that is only visible where its
  // result is read is still invisible where it is chosen — which is how B-38 would have survived its own
  // fix. These two tests pin the sentence and, more importantly, pin that it sits beside the input it
  // describes and that the input can overrule it.

  it('the add form states, beside the collection field, which year the app picks when it is left empty (B-38)', () => {
    pinClock(fixedInstant());
    seedWith([]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adaugă venit/ }));
    const note = document.querySelector('[data-money-date-default="revenue"]');
    expect(note?.textContent).toBe(moneyDate.fallbackDefault);
    // Not merely present somewhere on the page: it has to be in the same field as the collection input.
    const field = note?.closest('.field');
    expect(field).not.toBeNull();
    expect(field!.contains(dateInputs()[1])).toBe(true);
  });

  it('the default is labelled as the app\u2019s assumption, never as a rule from the Cod fiscal (B-38)', () => {
    // research/37 §5 forbids one specific claim on this surface: that the document date sets the fiscal
    // year, or that any provision presumes document date = money date. The sentence is allowed to state the
    // fallback only while it names the fallback as the app's own.
    expect(moneyDate.fallbackDefault).toContain('presupunerea aplicației');
    expect(moneyDate.fallbackDefault).toContain('nu o regulă din Codul fiscal');
    expect(moneyDate.fallbackDefault).toContain('art. 68 alin. (2) lit. a)');
    expect(moneyDate.fallbackDefault).not.toMatch(/conform Codului fiscal|prezumă că data documentului/);
  });

  it('the edit form states the same default and the field overrules it (B-38)', async () => {
    pinClock(fixedInstant());
    seedWith([revenue({ id: 'pg2-rev-default', nr: 'FCT-PG2-906', date: '2026-12-20' })]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    fireEvent.click(document.querySelector('tr[data-record-id="pg2-rev-default"]')!);

    expect(document.querySelector('[data-money-date-default="revenue"]')?.textContent).toBe(
      moneyDate.fallbackDefault,
    );
    const collected = dateInputs()[1];
    expect(collected.value).toBe('');

    // Correctable, in the same modal that admitted the assumption.
    fireEvent.change(collected, { target: { value: '2027-01-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvează' }));
    await waitFor(() => expect(savedRevenue('FCT-PG2-906')?.collected).toBe('2027-01-10'));
    expect(savedRevenue('FCT-PG2-906')!.date).toBe('2026-12-20');
  });

  // ── B-159 — the field stopped being the switch, and a switch was built ─────────────────────────
  //
  // `moneyDate.revenueEmpty` has promised since PG-2 that without a collection the sum is not venit brut.
  // Nothing in the app could produce that result: leaving the date empty is the legacy single-date case,
  // and the engine read the document date as the money date. Brief 82 answered by SAYING the fallback;
  // this is the half that makes the promise actionable — a declared non-collection, and the sentence that
  // points at it instead of at the empty input.

  it('the form offers the declaration the sentence describes, and saving it writes null (B-159)', async () => {
    pinClock(fixedInstant());
    seedWith([]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adaugă venit/ }));
    const box = document.querySelector<HTMLInputElement>('input[name="revenue-not-collected"]')!;
    expect(box.checked).toBe(false);
    fireEvent.click(box);

    // Declaring the money has not come in and typing the day it came in cannot both be true.
    const collected = dateInputs()[1];
    expect(collected.disabled).toBe(true);

    fillAndSubmit('FCT-B159-001', { documentDate: '2026-12-20' });
    await waitFor(() => expect(savedRevenue('FCT-B159-001')).toBeDefined());
    expect(savedRevenue('FCT-B159-001')!.collected).toBeNull();
  });

  it('leaving the date empty without the declaration stays the legacy reading, not a non-collection (B-159)', async () => {
    // The tripwire, on the form. If an empty input wrote null, every legacy record the person opened and
    // saved would drop out of venit brut — money moving on a record whose money date was never in question.
    pinClock(fixedInstant());
    seedWith([revenue({ id: 'pg2-rev-untouched', nr: 'FCT-PG2-907', date: '2026-12-20' })]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    fireEvent.click(document.querySelector('tr[data-record-id="pg2-rev-untouched"]')!);
    fireEvent.click(screen.getByRole('button', { name: 'Salvează' }));
    await waitFor(() => expect(savedRevenue('FCT-PG2-907')).toBeDefined());
    expect('collected' in (savedRevenue('FCT-PG2-907') as object)).toBe(false);
  });

  it('the field names what actually excludes the sum, so the legal sentence is not read as a promise about the input (B-159)', () => {
    pinClock(fixedInstant());
    seedWith([]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adaugă venit/ }));
    const effect = document.querySelector('[data-money-date-effect="revenue"]')?.textContent;
    expect(effect).toBe(moneyDate.revenueEmptyEffect);
    expect(effect).toContain('Banii nu au intrat înc\u0103');
    // research/37 §5 sentence 3 stays on the surface — the fix removed the implication, not the law.
    expect(moneyDate.revenueEmpty).toContain('fără încasare suma nu este venit brut');
  });

  it('a declared non-collection is said on the row, in the article\u2019s own words (B-159)', () => {
    pinClock(fixedInstant());
    seedWith([revenue({ id: 'pg2-rev-null', nr: 'FCT-B159-002', date: '2026-12-20', collected: null })]);
    render(
      <StoreProvider>
        <Revenues />
      </StoreProvider>,
    );
    const row = document.querySelector('tr[data-record-id="pg2-rev-null"]')!;
    expect(row.querySelector('[data-money-date="absent"]')?.textContent).toBe(moneyDate.noCollection);
    // And not the fiscal-date note: there is no fiscal date to name.
    expect(row.querySelector('[data-fiscal-date-source]')).toBeNull();
  });
});
