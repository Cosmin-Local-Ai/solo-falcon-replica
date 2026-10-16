/**
 * B-145 — the screen that collects a carried-in fiscal loss.
 *
 * Brief 70 built the engine and reported, rather than closed, the fact that no screen could supply it. This
 * file is the other half of that report being fixed: the control exists, shows what the profile actually
 * holds, writes through the profile's own write path, and refuses the three inputs the rule cannot work
 * without.
 *
 * The properties asserted are the ones a careless implementation would break:
 *
 * - an empty list renders the "nobody told the app" line and **stays** absent after a save — an empty array
 *   would read as „checked, there are none”, which is a different claim;
 * - a row missing its source is refused, not dropped: art. 118 alin. (4) offsets „la nivelul fiecărei surse”,
 *   so a loss with no source is not a loss;
 * - a loss year that is not earlier than the declared fiscal year is refused — that is not a carried-in loss,
 *   it is the current year's;
 * - the amounts are positive magnitudes, matching D212 rd.5's „Doar valori pozitive”.
 *
 * And the honesty property the brief asks for rather than a nicety: the card states, on screen, that the app
 * **can age a declared split but cannot verify one**, because formularul 212 rd.5 asks for a single total
 * with no per-year column. A control that collected per-year data and implied it had been checked against the
 * return would be worse than no control at all.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { STORAGE_KEY, StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import { seedStorage } from '../test/storage';
import { settings as settingsCopy, copy, validation } from '../ui/copy';
import type { AppData } from '../data/types';
import type { PriorYearFiscalLoss } from '../domain/models';
import { lei } from '../domain/money';
import Settings from './Settings';

type ProfileWithLosses = AppData['profile'] & { priorYearFiscalLosses?: PriorYearFiscalLoss[] };

function payload(over: Partial<AppData> = {}): AppData & { version: number } {
  return { ...seedData, ...over, version: CURRENT_DATA_VERSION };
}

function storedProfile(): ProfileWithLosses {
  const raw = localStorage.getItem(STORAGE_KEY);
  expect(raw, 'expected the store to have persisted').not.toBeNull();
  return (JSON.parse(raw as string) as AppData).profile as ProfileWithLosses;
}

function renderFiscalTab(over: Partial<AppData> = {}) {
  // The store is loaded the way the app loads it — a persisted payload under its own key — rather than by
  // reaching for the demo fixture as a module constant.
  seedStorage({ ...seedData, ...over, version: CURRENT_DATA_VERSION });
  return render(
    <StoreProvider>
      <Settings initialTab="fiscal" />
    </StoreProvider>,
  );
}

function saveButton(): void {
  act(() => {
    screen.getByRole('button', { name: copy.ui.save }).click();
  });
}

function addRow(): void {
  act(() => {
    screen.getByRole('button', { name: settingsCopy.fiscal.priorLossAdd }).click();
  });
}

function rows(): { source: HTMLSelectElement; year: HTMLInputElement; amount: HTMLInputElement }[] {
  const out: { source: HTMLSelectElement; year: HTMLInputElement; amount: HTMLInputElement }[] = [];
  for (let i = 0; ; i += 1) {
    const source = document.querySelector(`#set-prior-loss-source-${i}`) as HTMLSelectElement | null;
    if (!source) return out;
    out.push({
      source,
      year: document.querySelector(`#set-prior-loss-year-${i}`) as HTMLInputElement,
      amount: document.querySelector(`#set-prior-loss-amount-${i}`) as HTMLInputElement,
    });
  }
}

function fill(row: { source: HTMLSelectElement; year: HTMLInputElement; amount: HTMLInputElement }, source: string, year: string, amount: string) {
  act(() => {
    fireEvent.change(row.source, { target: { value: source } });
    fireEvent.change(row.year, { target: { value: year } });
    fireEvent.change(row.amount, { target: { value: amount } });
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe('B-145 — the carried-in loss control on the fiscal tab', () => {
  it('a profile with no losses says the app was not told, and a save keeps the field absent', () => {
    renderFiscalTab(payload({ profile: { ...seedData.profile } }));
    const empty = document.querySelector('[data-prior-losses-empty]');
    expect(empty?.textContent).toBe(settingsCopy.fiscal.priorLossEmpty);

    saveButton();
    // Absence, not an empty array. „Nobody told the app" and „checked, there are none" are different claims,
    // and the engine's own reporting reads the difference.
    expect('priorYearFiscalLosses' in storedProfile()).toBe(false);
  });

  it('the card states what the app cannot verify, in as many words', () => {
    renderFiscalTab(payload());
    const note = document.querySelector('[data-prior-losses-unverifiable]');
    expect(note?.textContent).toContain('rd.5');
    expect(note?.textContent).toContain('Total pierderi reportate');
    // It says the app can age a split but cannot check the taxpayer's — not that it verifies it.
    expect(note?.textContent).toContain('nu poate');
  });

  it('a declared loss is written through the profile write path, per source and per loss year', () => {
    renderFiscalTab(payload());
    addRow();
    fill(rows()[0]!, 'activitate_independenta', '2023', '40000');
    saveButton();

    expect(storedProfile().priorYearFiscalLosses).toEqual([
      { source: 'activitate_independenta', lossYear: 2023, amount: lei(40_000) },
    ]);
  });

  it('two losses from different sources and years are both kept, in the order entered', () => {
    renderFiscalTab(payload());
    addRow();
    fill(rows()[0]!, 'activitate_independenta', '2022', '40000');
    addRow();
    fill(rows()[1]!, 'drepturi_proprietate_intelectuala', '2024', '1500');
    saveButton();

    expect(storedProfile().priorYearFiscalLosses).toEqual([
      { source: 'activitate_independenta', lossYear: 2022, amount: lei(40_000) },
      { source: 'drepturi_proprietate_intelectuala', lossYear: 2024, amount: lei(1_500) },
    ]);
  });

  it('what the profile already holds is rendered back, not lost on the first save', () => {
    renderFiscalTab(
      payload({
        profile: {
          ...seedData.profile,
          priorYearFiscalLosses: [{ source: 'activitati_agricole', lossYear: 2023, amount: lei(9_000) }],
        },
      }),
    );
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.source.value).toBe('activitati_agricole');
    expect(rows()[0]!.year.value).toBe('2023');
    expect(rows()[0]!.amount.value).toBe('9000');

    // Saving without touching the card must not drop the entry.
    saveButton();
    expect(storedProfile().priorYearFiscalLosses).toEqual([
      { source: 'activitati_agricole', lossYear: 2023, amount: lei(9_000) },
    ]);
  });

  it('a row with no source named is refused, not silently dropped', () => {
    renderFiscalTab(payload());
    addRow();
    fill(rows()[0]!, '', '2023', '40000');
    saveButton();

    expect(document.body.textContent).toContain(validation.fiscalLossSourceRequired);
    expect('priorYearFiscalLosses' in storedProfile()).toBe(false);
  });

  it('a loss year that is not earlier than the declared fiscal year is refused', () => {
    renderFiscalTab(payload());
    addRow();
    fill(rows()[0]!, 'activitate_independenta', String(seedData.profile.fiscalYear), '40000');
    saveButton();

    expect(document.body.textContent).toContain(settingsCopy.fiscal.priorLossYearNotBeforeFiscalYear);
    expect('priorYearFiscalLosses' in storedProfile()).toBe(false);
  });

  it('an unparseable amount is an error on the row, never a dropped input and never a zero', () => {
    renderFiscalTab(payload());
    addRow();
    fill(rows()[0]!, 'activitate_independenta', '2023', 'nu-s-numar');
    saveButton();

    expect(document.body.textContent).toContain(validation.leiInvalid);
    expect('priorYearFiscalLosses' in storedProfile()).toBe(false);
  });

  it('a row with nothing in it is an abandoned row, not a declared zero loss', () => {
    renderFiscalTab(payload());
    addRow();
    saveButton();
    expect('priorYearFiscalLosses' in storedProfile()).toBe(false);
  });
});
