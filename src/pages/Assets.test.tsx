/**
 * PG-6e (B-31, D-FA-1) — the fixed-asset register on screen.
 *
 * The behaviours this file exists to pin are the ones a reader would otherwise get wrong:
 *
 *  - **The form asks and never fills.** An asset saved with three facts has three facts, and the schedule
 *    refuses by naming the gap. A default anywhere — a *punerea în funcțiune* of 1 January, a 60-month
 *    duration, a `liniar` method — would pick a legal outcome, and the screen would look like the taxpayer
 *    had chosen it.
 *  - **A refusal names the gap.** The three silences in the law are stated as silences, with both sides
 *    where there are two sides.
 *  - **The M1 ceiling is per vehicle and the excess is lost, not deferred.** Two cars each get their own
 *    1.500 lei/lună, and the words on screen say „pierdut definitiv".
 *  - **The constructions are labelled.** The degresive year-6 switch and the first-year 1/12 pro-rating
 *    appear with the sentence that says they are ours.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Assets from './Assets';
import { StoreProvider } from '../data/store';
import { seedStorage } from '../test/storage';
import { seedData } from '../data/seed';
import { assets as assetsCopy } from '../ui/copy';
import type { FixedAsset } from '../data/types';
import { lei } from '../domain/money';

const asset = (over: Partial<FixedAsset> = {}): FixedAsset => ({
  id: 'a1',
  label: 'Utilaj de birou',
  entryDate: '2026-02-10',
  putInFunctionDate: '2026-02-15',
  fiscalValue: lei(120000),
  normalLifeMonths: 60,
  method: 'liniar',
  acquisition: 'cumparare',
  paymentState: 'achitat',
  paidOn: '2026-02-11',
  ...over,
});

function renderPage(payload: unknown) {
  seedStorage(payload);
  return render(
    <StoreProvider>
      <Assets />
    </StoreProvider>,
  );
}

beforeEach(() => localStorage.clear());

describe('the empty register', () => {
  it('says there is nothing here, and does not compute anything', () => {
    renderPage(seedData);
    expect(screen.getByText(assetsCopy.form.emptyTitle)).toBeTruthy();
    expect(screen.queryAllByTestId(/^asset-year-/)).toHaveLength(0);
  });

  it('states that a capital purchase is not an expense, before any asset exists', () => {
    renderPage(seedData);
    expect(screen.getByText(assetsCopy.intro.purchaseIsNotAnExpense)).toBeTruthy();
  });
});

describe('a refusal names the gap instead of picking', () => {
  it('no punerea în funcțiune — the sentence says the term is undefined in fiscal law', () => {
    renderPage({ ...seedData, fixedAssets: [asset({ putInFunctionDate: undefined })] });
    const gap = screen.getByTestId('asset-gap-a1');
    expect(gap.textContent).toBe(assetsCopy.gaps.punereInFunctiune);
    expect(gap.textContent).toContain('nu este definită');
  });

  it('an aport names both k^1) and the art. 7 pct. 44 lit. c) counter-text', () => {
    renderPage({ ...seedData, fixedAssets: [asset({ acquisition: 'aport' })] });
    const gap = screen.getByTestId('asset-gap-a1');
    expect(gap.textContent).toBe(assetsCopy.gaps.aport);
    expect(gap.textContent).toContain('k^1)');
    expect(gap.textContent).toContain('pct. 44 lit. c)');
  });

  it('a missing declared duration refuses, and says the choice is the taxpayer', () => {
    renderPage({ ...seedData, fixedAssets: [asset({ normalLifeMonths: undefined })] });
    const gap = screen.getByTestId('asset-gap-a1');
    expect(gap.textContent).toBe(assetsCopy.gaps.durata);
    expect(gap.textContent).toContain('stabilită');
  });

  it('payment in a later year than punerea în funcțiune surfaces the reading rather than choosing', () => {
    renderPage({
      ...seedData,
      fixedAssets: [asset({ paymentState: 'achitat', paidOn: '2027-06-01' })],
    });
    const gap = screen.getByTestId('asset-gap-a1');
    expect(gap.textContent).toBe(assetsCopy.gaps.plata);
    expect(gap.textContent).toContain('lectură');
  });
});

describe('a computed schedule', () => {
  it('shows one row per amortisation year and a total', async () => {
    renderPage({ ...seedData, fixedAssets: [asset({ normalLifeMonths: 24 })] });
    await waitFor(() => expect(screen.getByTestId('asset-total-a1')).toBeTruthy());
    expect(screen.getAllByTestId(/^asset-year-a1-/).length).toBeGreaterThan(1);
  });

  it('labels the first-year pro-rating as a construction, not as quoted law', () => {
    renderPage({ ...seedData, fixedAssets: [asset()] });
    expect(screen.getByText(assetsCopy.schedule.firstYearProRated)).toBeTruthy();
    expect(screen.getByText(assetsCopy.schedule.firstYearProRated).textContent)
      .toContain('construcția noastră');
  });

  it('labels the degresive year-6 switch as a construction read from pct. 25', () => {
    renderPage({
      ...seedData,
      fixedAssets: [asset({ method: 'degresiv', normalLifeMonths: 120, fiscalValue: lei(350000) })],
    });
    const note = screen.getByText(assetsCopy.schedule.degresivSwitch);
    expect(note.textContent).toContain('pct. 25');
    expect(note.textContent).toContain('construcția noastră');
  });
});

describe('the M1 ceiling', () => {
  const m1 = (id: string, label: string): FixedAsset => ({
    ...asset({ id, label, fiscalValue: lei(120000), normalLifeMonths: 24, method: 'liniar' }),
    isM1Vehicle: true,
  });

  it('caps each of two cars separately, and calls the excess definitively lost', () => {
    renderPage({ ...seedData, fixedAssets: [m1('m1a', 'Mașina unu'), m1('m1b', 'Mașina doi')] });
    // 120.000 lei over 24 months is 5.000 lei/lună — over the 1.500 lei ceiling for both.
    const a = screen.getByTestId('asset-total-m1a');
    const b = screen.getByTestId('asset-total-m1b');
    expect(a.textContent).not.toBe('—');
    expect(b.textContent).not.toBe('—');
    expect(screen.getAllByText(assetsCopy.schedule.m1Capped).length).toBe(2);
    expect(screen.getAllByText(assetsCopy.schedule.m1Capped)[0]!.textContent)
      .toContain('definitiv');
  });

  it('states that the ceiling is per vehicle, next to the register', () => {
    renderPage(seedData);
    expect(screen.getByText(assetsCopy.schedule.m1CapPerVehicle)).toBeTruthy();
  });

  it('keeps the two vehicle exception lists apart, in words', () => {
    renderPage(seedData);
    expect(screen.getByText(assetsCopy.vehicleLists.closing)).toBeTruthy();
    expect(screen.getByText(assetsCopy.vehicleLists.oneCarLimit)).toBeTruthy();
  });
});

describe('the form asks and never fills', () => {
  it('an asset saved with three facts has three facts, and refuses on the rest', async () => {
    const user = userEvent.setup();
    renderPage(seedData);
    await user.click(screen.getByTestId('asset-add'));
    await user.type(screen.getByTestId('asset-label'), 'Scaun de birou');
    // jsdom's `type="date"` control does not accept typed digit-by-digit input reliably, so the two
    // machine-formatted fields are set the way a picker sets them: one change event with the ISO value.
    fireEvent.change(screen.getByTestId('asset-entryDate'), { target: { value: '2026-03-10' } });
    fireEvent.change(screen.getByTestId('asset-fiscalValue'), { target: { value: '12000' } });
    await user.click(screen.getByTestId('asset-save'));

    // The saved asset carries no punerea în funcțiune, no duration and no method — and the card says so.
    // The value is above the 5.000-lei threshold on purpose: below it, the first refusal would be the
    // missing alin. (21) election rather than the missing start date, which is a different gap.
    // The id is generated by the store, so the gap is found by prefix rather than by name.
    await waitFor(() => expect(screen.getByTestId(/^asset-gap-/)).toBeTruthy());
    expect(screen.getByTestId(/^asset-gap-/).textContent).toBe(assetsCopy.gaps.punereInFunctiune);
  });

  it('the unset option in every fact control is „nu este înregistrat”, never a value', async () => {
    const user = userEvent.setup();
    renderPage(seedData);
    await user.click(screen.getByTestId('asset-add'));
    const method = screen.getByTestId('asset-method') as HTMLSelectElement;
    expect(method.value).toBe('');
    expect(method.options[0].textContent).toBe('nu este înregistrat');
  });
});
