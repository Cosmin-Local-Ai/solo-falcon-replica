/**
 * Step 11 / Part A2 — the CAEN control. **This is B-124.**
 *
 * The defect in one line: `identity.caen` is `CaenCode[]` and `Settings.tsx` read
 * `identity.caen?.[0]?.cod` into a single text input, writing back
 * `[typed, ...identity.caen.slice(1)]`. The model held a list; the UI showed and edited one
 * entry. A person with a principal class and secondary classes could not enter the secondary
 * ones, and the ones already stored were invisible.
 *
 * What is asserted here, in the order the law and the defect demand:
 *
 * 1. all five classes are editable and all five reach storage — the defect itself;
 * 2. a 6th is refused **at the input**, with OUG 44/2008 art. 16 alin. (1) on the control, so
 *    the number does not read as a product decision;
 * 3. the type-ahead resolves a partial code and a phrase, and formats rows `cod — denumire`;
 * 4. free text is not a CAEN — an unresolvable box blocks the save rather than being dropped;
 * 5. a Rev.2 code the profile already inherited is kept and flagged, and does **not** hold the
 *    rest of the form hostage;
 * 6. the nomenclator's version and attribution are visible where the codes are picked.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { STORAGE_KEY, StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import { seedStorage } from '../test/storage';
import type { AppData } from '../data/types';
import type { CaenCode } from '../domain/models';
import Settings from './Settings';

function payload(over: Partial<AppData> = {}): AppData & { version: number } {
  return { ...seedData, ...over, version: CURRENT_DATA_VERSION };
}

function renderFiscalTab(): void {
  render(
    <StoreProvider>
      <Settings initialTab="fiscal" />
    </StoreProvider>,
  );
}

function storedProfile(): AppData['profile'] {
  const raw = localStorage.getItem(STORAGE_KEY);
  expect(raw, 'expected the store to have persisted').not.toBeNull();
  return (JSON.parse(raw as string) as AppData).profile;
}

function storedCaen(): CaenCode[] {
  return storedProfile().identity.caen ?? [];
}

function input(index: number): HTMLInputElement {
  const el = document.querySelector(`input[data-caen-input="${index}"]`);
  if (!el) throw new Error(`no CAEN input at row ${index}`);
  return el as HTMLInputElement;
}

function type(index: number, text: string): void {
  act(() => {
    fireEvent.change(input(index), { target: { value: text } });
  });
}

function optionRows(): Element[] {
  return Array.from(document.querySelectorAll('[data-caen-options] [data-caen-code]'));
}

function optionByCode(cod: string): HTMLElement {
  const el = document.querySelector(`[data-caen-options] [data-caen-code="${cod}"]`);
  if (!el) throw new Error(`no type-ahead row for ${cod}; rendered: ${optionRows().map(r => r.getAttribute('data-caen-code')).join(',')}`);
  return el as HTMLElement;
}

function pick(cod: string): void {
  act(() => {
    fireEvent.mouseDown(optionByCode(cod));
  });
}

function addRow(): void {
  const button = document.querySelector('button[data-caen-add]') as HTMLButtonElement;
  act(() => {
    button.click();
  });
}

function saveFiscal(): void {
  const buttons = screen.getAllByRole('button', { name: 'Salvează' });
  act(() => {
    buttons[0].click();
  });
}

/** The fiscal tab has many selects; address one by the label of the `.field` that holds it. */
function selectField(label: string, value: string): void {
  const control = fieldByLabel(label)?.querySelector('select');
  if (!control) throw new Error(`no select for label "${label}"`);
  act(() => {
    fireEvent.change(control, { target: { value } });
  });
}

function inputField(label: string, value: string): void {
  const control = fieldByLabel(label)?.querySelector('input');
  if (!control) throw new Error(`no input for label "${label}"`);
  act(() => {
    fireEvent.change(control, { target: { value } });
  });
}

function fieldByLabel(label: string): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>('.field')).find((f) => {
    const l = f.querySelector('label');
    return (l?.textContent ?? '').trim().startsWith(label);
  });
}

describe('B-124 — the control edits the whole list, not index 0', () => {
  beforeEach(() => {
    localStorage.clear();
    seedStorage();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('shows the seed principal class resolved against Rev.3, code and denomination', () => {
    renderFiscalTab();
    expect(input(0).value).toBe(
      '6210 — Activități de realizare a soft-ului la comandă (software orientat client)',
    );
  });

  it('edits one principal and four secondary classes and writes all five', () => {
    renderFiscalTab();

    type(0, '6210');
    pick('6210');
    for (let i = 0; i < 4; i++) {
      addRow();
    }
    // Rows 1..4 are the annex classes. Index 0 stays the principal one — the list is
    // positional, which is the shape the data already had.
    type(1, '6220');
    pick('6220');
    type(2, '6290');
    pick('6290');
    type(3, '6310');
    pick('6310');
    type(4, '5829');
    pick('5829');
    saveFiscal();

    const caen = storedCaen();
    expect(caen.map(c => c.cod)).toEqual(['6210', '6220', '6290', '6310', '5829']);
    // The denomination is the nomenclator's, not something the person typed.
    expect(caen[4].descriere).toBe('Activități de editare a altor produse software');
    expect(document.querySelectorAll('input[data-caen-input]')).toHaveLength(5);
  });

  it('a removed secondary row leaves the principal at index 0', () => {
    renderFiscalTab();
    addRow();
    type(1, '6220');
    pick('6220');
    const remove = document.querySelector('button[data-caen-remove="1"]') as HTMLButtonElement;
    act(() => {
      remove.click();
    });
    saveFiscal();
    expect(storedCaen().map(c => c.cod)).toEqual(['6210']);
  });
});

describe('the 5-class cap is refused at the input, with its article on the control', () => {
  beforeEach(() => {
    localStorage.clear();
    seedStorage();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('the add control stops at five rows and the citation is shown next to it', () => {
    renderFiscalTab();
    for (let i = 0; i < 4; i++) addRow();

    const add = document.querySelector('button[data-caen-add]') as HTMLButtonElement;
    expect(add.disabled, 'a 6th class must be refused before it is typed').toBe(true);
    expect(document.querySelectorAll('input[data-caen-input]')).toHaveLength(5);

    const cap = document.querySelector('[data-caen-cap]');
    expect(cap, 'the refusal states the reason').not.toBeNull();
    expect(cap?.textContent).toContain('5 clase');
    const citation = document.querySelector('[data-caen-cap-citation]');
    expect(citation?.textContent).toContain('OUG 44/2008 art. 16 alin. (1)');
    expect(citation?.textContent).toContain('cel mult 5 clase de activități prevăzute de codul CAEN');
  });

  it('the cap sentence says it is a cap on the total, not a quota on the secondary rows', () => {
    renderFiscalTab();
    for (let i = 0; i < 4; i++) addRow();
    const cap = document.querySelector('[data-caen-cap]')?.textContent ?? '';
    expect(cap).toContain('totalului');
  });
});

describe('the type-ahead resolves a code and a phrase', () => {
  beforeEach(() => {
    localStorage.clear();
    seedStorage();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('a partial code lists classes labelled `cod — denumire`, each with what it sits under', () => {
    renderFiscalTab();
    type(0, '4791');
    const row = optionByCode('4791');
    expect(row.textContent).toContain('4791 — Intermedieri în comerțul cu amănuntul nespecializat');
    expect(row.querySelector('.caen-option-lineage')?.textContent).toContain('Secțiunea G');
    expect(row.querySelector('.caen-option-lineage')?.textContent).toContain('479');
  });

  it('a phrase with no matching class expands the grupa that does contain it', () => {
    renderFiscalTab();
    type(0, 'programare');
    const rows = optionRows();
    expect(rows.length).toBeGreaterThan(0);
    const headers = rows
      .filter(r => r.getAttribute('data-caen-selectable') === 'false')
      .map(r => r.getAttribute('data-caen-code'));
    expect(headers).toEqual(expect.arrayContaining(['62', '621']));
    const selectable = rows
      .filter(r => r.getAttribute('data-caen-selectable') === 'true')
      .map(r => r.getAttribute('data-caen-code'));
    expect(selectable).toEqual(expect.arrayContaining(['6210', '6220', '6290']));
  });

  it('picking a class writes the code and the official denomination', () => {
    renderFiscalTab();
    type(0, 'cazare');
    pick('5520');
    saveFiscal();
    expect(storedCaen()).toEqual([
      { cod: '5520', descriere: 'Facilități de cazare pentru vacanțe și perioade de scurtă durată' },
    ]);
  });
});

describe('free text is not a CAEN', () => {
  beforeEach(() => {
    localStorage.clear();
    seedStorage();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('an unresolvable box blocks the save and says why, instead of being dropped', () => {
    renderFiscalTab();
    type(0, 'programare');
    saveFiscal();

    const error = document.querySelector('[data-caen-error="0"]');
    expect(error?.textContent).toContain('4 cifre');
    // Nothing was written: the seed class is still the stored one.
    expect(storedCaen().map(c => c.cod)).toEqual(['6210']);
  });

  it('a code that is a real grupa, not a class, is refused with the level named', () => {
    renderFiscalTab();
    type(0, '479');
    saveFiscal();
    const error = document.querySelector('[data-caen-error="0"]')?.textContent ?? '';
    expect(error).toContain('grupă');
    expect(storedCaen().map(c => c.cod)).toEqual(['6210']);
  });

  it('a Rev.2 code the profile already inherited is kept, flagged, and does not block the form', () => {
    // A real user's stored profile can hold a code Rev.3 no longer has. Deleting it on load is a
    // data-loss event, and refusing every save until the person resolves a classification
    // question they did not ask about would hold the rest of the tab hostage. So: keep, flag,
    // and let the rest of the profile save.
    localStorage.clear();
    seedStorage(
      payload({
        profile: {
          ...seedData.profile,
          identity: { ...seedData.profile.identity, caen: [{ cod: '6201', descriere: '' }] },
        },
      }),
    );
    renderFiscalTab();

    expect(document.querySelector('[data-caen-stale="0"]')).not.toBeNull();
    expect(input(0).value).toBe('6201');

    selectField('Venit din salarii', 'da');
    // The 6 SM test needs the amount, so the save is otherwise refused for a reason unrelated to
    // what this test is about.
    inputField('Venit brut anual din salarii', '30000');
    saveFiscal();

    expect(storedCaen().map(c => c.cod)).toEqual(['6201']);
    expect(storedProfile().salaryStatus).toBe('da');
  });
});

describe('the nomenclator identifies itself where the codes are picked', () => {
  beforeEach(() => {
    localStorage.clear();
    seedStorage();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('names CAEN Rev.3, the INS act and the monitor next to the control', () => {
    renderFiscalTab();
    const provenance = document.querySelector('[data-caen-provenance]');
    expect(provenance?.textContent).toContain('CAEN Rev.3');
    expect(provenance?.textContent).toContain('377/2024');
    expect(provenance?.textContent).toContain('385');
  });

  it('says out loud that the classification sets no tax fact', () => {
    renderFiscalTab();
    const provenance = document.querySelector('[data-caen-provenance]')?.textContent ?? '';
    expect(provenance).toContain('HG 656/1997 art. 4 alin. (1)');
    expect(provenance).toContain('nu presupune crearea de drepturi sau obligații');
  });
});
