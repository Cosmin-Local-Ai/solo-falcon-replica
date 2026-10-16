/**
 * PG-6c (D-VEH-3) — the vehicle facts in Settings: declared, never filled in, and reviewable per year.
 *
 * The properties asserted here are the ones a form can silently break:
 *
 * - **nothing is pre-filled.** Every select starts empty, and an empty select writes nothing back — a
 *   default here would be a legal assertion (`usedByPerson` moves a car inside or outside art. 68 alin. (5)
 *   lit. j); `designatedForRunningCosts` picks the car the allowance follows, which no primary source does).
 * - **clearing an answer restores absence**, not a stand-in value.
 * - **the facts are per fiscal year**, and the section shows the year the profile is on.
 * - **the status line is read from the same resolver the classifier runs**, so the screen cannot describe a
 *   different car-situation than the one the calculation acted on.
 * - **deletion is real** — the car leaves the persisted bytes.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { STORAGE_KEY, StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import { seedStorage } from '../test/storage';
import { vehicles as vehiclesCopy, copy } from '../ui/copy';
import type { AppData, Vehicle } from '../data/types';
import Settings from './Settings';

function payload(over: Partial<AppData> = {}): AppData & { version: number } {
  return { ...seedData, ...over, version: CURRENT_DATA_VERSION };
}

function storedVehicles(): Vehicle[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  expect(raw, 'expected the store to have persisted').not.toBeNull();
  return (JSON.parse(raw as string) as AppData).vehicles ?? [];
}

function control(attr: string): HTMLSelectElement | HTMLInputElement {
  const el = document.querySelector(`[data-${attr}]`);
  if (!el) throw new Error(`no [data-${attr}] control rendered`);
  return el as HTMLSelectElement | HTMLInputElement;
}

function select(attr: string, value: string): void {
  act(() => {
    fireEvent.change(control(attr), { target: { value } });
  });
}

function statusText(): string | undefined {
  return document.querySelector('[data-vehicle-status]')?.textContent;
}

function renderFiscalTab(over: Partial<AppData> = {}) {
  seedStorage(payload(over));
  return render(
    <StoreProvider>
      <Settings initialTab="fiscal" />
    </StoreProvider>,
  );
}

const TWO_CARS: Vehicle[] = [
  { id: 'v1', label: 'Logan albastru', years: [{ fiscalYear: 2026, usedByPerson: 'da', use: 'mixed' }] },
  { id: 'v2', label: 'Dubla albă', years: [{ fiscalYear: 2026, usedByPerson: 'da', use: 'mixed' }] },
];

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('the section exists for every profile, and answers nothing on its own', () => {
  it('renders with no vehicles and says the list is empty rather than showing a default car', () => {
    renderFiscalTab();
    expect(document.querySelector('[data-vehicle-block]')).not.toBeNull();
    expect(document.querySelector('[data-vehicle-row]')).toBeNull();
    expect(document.querySelector('[data-vehicle-empty]')?.textContent).toContain(
      'Nu ai înregistrat niciun vehicul',
    );
  });

  it('every control for a freshly added car starts empty, and adding a car writes no fact', () => {
    renderFiscalTab();
    act(() => {
      fireEvent.change(control('vehicle-label'), { target: { value: 'Logan albastru' } });
      fireEvent.click(screen.getByRole('button', { name: vehiclesCopy.block.add }));
    });
    expect(document.querySelectorAll('[data-vehicle-row]')).toHaveLength(1);
    for (const attr of ['vehicle-used-by-person', 'vehicle-use', 'vehicle-exception', 'vehicle-designation']) {
      expect((control(attr) as HTMLSelectElement).value).toBe('');
    }
    expect(storedVehicles()[0].years).toEqual([]);
  });

  it('an empty label adds nothing — an unlabelled car cannot be designated or named in a refusal', () => {
    renderFiscalTab();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: vehiclesCopy.block.add }));
    });
    expect(document.querySelectorAll('[data-vehicle-row]')).toHaveLength(0);
    expect(storedVehicles()).toEqual([]);
  });
});

describe('the declared facts persist, and clearing one restores absence', () => {
  it('who uses the car is stored and survives a reload', () => {
    renderFiscalTab();
    act(() => {
      fireEvent.change(control('vehicle-label'), { target: { value: 'Logan albastru' } });
      fireEvent.click(screen.getByRole('button', { name: vehiclesCopy.block.add }));
    });
    select('vehicle-used-by-person', 'nu');
    expect(storedVehicles()[0].years).toEqual([{ fiscalYear: 2026, usedByPerson: 'nu' }]);
  });

  it('the use fact is stored as the four-value vocabulary, `unknown` included', () => {
    renderFiscalTab();
    act(() => {
      fireEvent.change(control('vehicle-label'), { target: { value: 'Logan albastru' } });
      fireEvent.click(screen.getByRole('button', { name: vehiclesCopy.block.add }));
    });
    select('vehicle-use', 'unknown');
    expect(storedVehicles()[0].years).toEqual([{ fiscalYear: 2026, use: 'unknown' }]);
  });

  it('an exception category is claimed, and choosing „Niciuna” clears it', () => {
    renderFiscalTab();
    act(() => {
      fireEvent.change(control('vehicle-label'), { target: { value: 'Logan albastru' } });
      fireEvent.click(screen.getByRole('button', { name: vehiclesCopy.block.add }));
    });
    select('vehicle-exception', 'transport_persoane_cu_plata');
    expect(storedVehicles()[0].years[0].exceptionCategory).toBe('transport_persoane_cu_plata');
    select('vehicle-exception', '');
    // Clearing the last fact removes the year entry rather than leaving a row of blanks: „answered with
    // nothing” and „never answered” must not become two shapes of one claim.
    expect(storedVehicles()[0].years).toEqual([]);
  });

  it('the designation is the person’s own recorded choice', () => {
    renderFiscalTab({ vehicles: TWO_CARS });
    select('vehicle-designation', 'da');
    const stored = storedVehicles();
    expect(stored.find(v => v.id === 'v1')!.years[0].designatedForRunningCosts).toBe('da');
    // The other car was never touched — the app does not spread a designation across cars.
    expect(stored.find(v => v.id === 'v2')!.years[0].designatedForRunningCosts).toBeUndefined();
  });
});

describe('the status line is the classifier’s own answer, not a paraphrase', () => {
  it('a car answered „nu” is shown as outside the one-car limit', () => {
    renderFiscalTab({
      vehicles: [{ id: 'v1', label: 'Dubla albă', years: [{ fiscalYear: 2026, usedByPerson: 'nu' }] }],
    });
    expect(statusText()).toContain(vehiclesCopy.status.outside_cap.slice(0, 40));
  });

  it('two taxpayer-used cars with no designation are shown as unresolved, and neither is picked', () => {
    renderFiscalTab({ vehicles: TWO_CARS });
    const rows = document.querySelectorAll('[data-vehicle-row]');
    expect(rows).toHaveLength(2);
    const texts = [...rows].map(r => r.querySelector('[data-vehicle-status]')?.textContent ?? '');
    for (const t of texts) expect(t).toContain(vehiclesCopy.status.designation_missing.slice(0, 40));
    // No row is presented as the settled one.
    for (const t of texts) expect(t).not.toContain(vehiclesCopy.status.designated.slice(0, 40));
  });

  it('once one car is designated, the other is shown as unsettled with both readings, not as settled', () => {
    renderFiscalTab({
      vehicles: [
        { id: 'v1', label: 'Logan albastru', years: [{ fiscalYear: 2026, usedByPerson: 'da', designatedForRunningCosts: 'da' }] },
        { id: 'v2', label: 'Dubla albă', years: [{ fiscalYear: 2026, usedByPerson: 'da' }] },
      ],
    });
    const rows = document.querySelectorAll('[data-vehicle-row]');
    const texts = [...rows].map(r => r.querySelector('[data-vehicle-status]')?.textContent ?? '');
    expect(texts[0]).toContain(vehiclesCopy.status.designated.slice(0, 40));
    expect(texts[1]).toContain(vehiclesCopy.status.not_designated.slice(0, 40));
  });
});

describe('D-VEH-1 — the 50 % default is said out loud where the fact is entered', () => {
  it('an unanswered use fact shows the note that the law defaults to 50 %', () => {
    renderFiscalTab({ vehicles: [{ id: 'v1', label: 'Logan albastru', years: [] }] });
    const note = document.querySelector('[data-vehicle-use-default]')?.textContent ?? '';
    expect(note).toContain('50 %');
    expect(note).toContain('fără dovada utilizării exclusive');
  });

  it('the foaie de parcurs requirement is stated with its contents', () => {
    renderFiscalTab({ vehicles: [{ id: 'v1', label: 'Logan albastru', years: [] }] });
    const hints = [...document.querySelectorAll('[data-vehicle-row] .hint')].map(h => h.textContent ?? '');
    const joined = hints.join(' ');
    expect(joined).toContain('foaie de parcurs');
    expect(joined).toContain('norma proprie de consum');
    // Leased and rented-in cars are inside the rules — „proprietate sau în folosință”.
    expect(document.querySelector('[data-vehicle-block]')?.textContent).toContain('proprietate sau în folosință');
  });
});

describe('deletion is real', () => {
  it('removing a car takes it out of the persisted bytes', () => {
    renderFiscalTab({ vehicles: TWO_CARS });
    act(() => {
      fireEvent.click(screen.getAllByRole('button', { name: vehiclesCopy.block.remove })[0]);
    });
    const stored = storedVehicles();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('v2');
  });
});

describe('the facts belong to a fiscal year', () => {
  it('a car whose facts belong to another year is shown as unanswered for this one', () => {
    renderFiscalTab({
      vehicles: [{ id: 'v1', label: 'Logan albastru', years: [{ fiscalYear: 2027, usedByPerson: 'da', use: 'exclusive' }] }],
    });
    expect((control('vehicle-used-by-person') as HTMLSelectElement).value).toBe('');
    expect((control('vehicle-use') as HTMLSelectElement).value).toBe('');
    // And writing this year adds an entry without erasing 2027.
    select('vehicle-used-by-person', 'nu');
    const years = storedVehicles()[0].years;
    expect(years.map(y => y.fiscalYear).sort()).toEqual([2026, 2027]);
  });
});

describe('the wording never claims what the sources do not', () => {
  it('the section says the app does not choose the car, and quotes the litera', () => {
    renderFiscalTab({ vehicles: TWO_CARS });
    const text = document.querySelector('[data-vehicle-block]')?.textContent ?? '';
    expect(text).toContain('cel mult un singur autoturism aferent fiecărei persoane');
    expect(text).toContain('Alegea este a ta, nu a aplicației');
    expect(text).toContain('Nici Codul fiscal, nici Normele nu spun care autoturism');
  });

  it('no sentence in the section mentions depreciation, which belongs to the fixed-asset phase', () => {
    renderFiscalTab({ vehicles: TWO_CARS });
    const text = (document.querySelector('[data-vehicle-block]')?.textContent ?? '').toLowerCase();
    for (const word of ['amortiza', 'depreciere', '1.500 lei']) expect(text).not.toContain(word);
  });

  it('the save button still saves the profile, untouched by the vehicle writes', () => {
    renderFiscalTab({ vehicles: TWO_CARS });
    act(() => {
      screen.getByRole('button', { name: copy.ui.save }).click();
    });
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string) as AppData;
    expect(persisted.vehicles).toHaveLength(2);
    expect(persisted.profile.fiscalYear).toBe(seedData.profile.fiscalYear);
  });
});
