import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StoreProvider, STORAGE_KEY } from '../data/store';
import { seedData } from '../data/seed';
import type { PfaProfile } from '../domain/models';
import Settings from './Settings';
import { lei } from '../domain/money';

// Must match seedData.settings.company.denumire in src/data/seed.ts.
// TASK 9 re-pin (replaced, not deleted): 'Popescu Consulting SRL' → 'Popescu Andrei PFA'. The seed
// taxpayer is a persoană fizică autorizată, which is what every rule, deadline and estimate in the app
// already resolves. The regression this test guards — a saved identity reaching localStorage instead of
// being dropped — is unchanged.
const SEED_DENUMIRE = 'Popescu Andrei PFA';
const NEW_DENUMIRE = 'Popescu Andrei PFA (regres)';

function readStoredDenumire(): string {
  const raw = localStorage.getItem(STORAGE_KEY);
  expect(raw, 'expected data to be persisted to localStorage').not.toBeNull();
  // Phase 7 (D-1): the PFA tab is an identity editor and writes the one canonical
  // identity store, `profile.identity` — not `settings.company`.
  const parsed = JSON.parse(raw as string) as {
    profile: { identity: { denumire: string } };
  };
  return parsed.profile.identity.denumire;
}

function saveDenumire(denumire: string) {
  // The <label>s have no htmlFor and do not wrap their inputs, and the Denumire
  // input has no placeholder — query by displayed value (seed value on first render).
  const denumireInput = screen.getByDisplayValue(denumire);
  act(() => {
    fireEvent.change(denumireInput, { target: { value: NEW_DENUMIRE } });
  });
  // Two "Salvează" buttons exist on the PFA tab (page header + mențiuni card);
  // the header one (first in DOM order) is the one that calls saveCompany().
  const saveButtons = screen.getAllByRole('button', { name: 'Salvează' });
  act(() => {
    saveButtons[0].click();
  });
}

describe('Settings persistence (Defect 3 regression)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    // Do not leak persisted state into other test files.
    localStorage.clear();
  });

  it('persists company identity to localStorage when "Salvează" is clicked', () => {
    render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );

    saveDenumire(SEED_DENUMIRE);

    expect(readStoredDenumire()).toBe(NEW_DENUMIRE);
  });

  it('restores saved company identity from localStorage on remount', () => {
    const first = render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );

    saveDenumire(SEED_DENUMIRE);

    // Unmount, then mount a fresh provider — loadInitial() must restore from localStorage.
    act(() => {
      first.unmount();
    });
    render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );

    expect(screen.getByDisplayValue(NEW_DENUMIRE)).toBeInTheDocument();
  });

  it('does not duplicate bank account rows when saving company data', () => {
    render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );

    // Save the company data on the PFA tab (header "Salvează" button).
    const saveButtons = screen.getAllByRole('button', { name: 'Salvează' });
    act(() => {
      saveButtons[0].click();
    });

    // Navigate to the bank accounts tab.
    act(() => {
      screen.getByRole('button', { name: 'Conturi bancare' }).click();
    });

    // Seed: exactly one bank account (BCR / RON) — saving must not duplicate it.
    expect(document.querySelectorAll('tbody tr').length).toBe(1);
    expect(screen.getByText('BCR')).toBeInTheDocument();
  });
});

/**
 * Phase 6: the PfaProfile write path. Before this phase `updateProfile` had no UI caller
 * at all, so every fiscal input was fixed at seed values (docs/ai/phases/06_fiscal_profile.md §5).
 */
function openFiscalTab(): void {
  act(() => {
    screen.getByRole('button', { name: 'Regim fiscal' }).click();
  });
}

// The <label>s in this app have no htmlFor and do not wrap their control, so label text
// is matched through the .field wrapper the pages all use (styles/components.css).
function fieldControl(label: string): HTMLInputElement | HTMLSelectElement {
  const fields = Array.from(document.querySelectorAll<HTMLElement>('.field'));
  const field = fields.find(f => {
    const l = f.querySelector('label');
    return (l?.textContent ?? '').trim().startsWith(label);
  });
  const control = field?.querySelector('input, select');
  if (!control) throw new Error(`no .field control found for label "${label}"`);
  return control as HTMLInputElement | HTMLSelectElement;
}

function selectField(label: string, value: string): void {
  act(() => {
    fireEvent.change(fieldControl(label), { target: { value } });
  });
}

function inputField(label: string, value: string): void {
  act(() => {
    fireEvent.change(fieldControl(label), { target: { value } });
  });
}

function clickSave(): void {
  const saveButtons = screen.getAllByRole('button', { name: 'Salvează' });
  act(() => {
    saveButtons[0].click();
  });
}

function readStoredProfile(): PfaProfile {
  const raw = localStorage.getItem(STORAGE_KEY);
  expect(raw, 'expected data to be persisted to localStorage').not.toBeNull();
  return (JSON.parse(raw as string) as { profile: PfaProfile }).profile;
}

/**
 * Phase 7, acceptance criterion 5 — identity round-trips through the one store.
 * The Personal tab's inputs used to be `disabled` because the data had no owner;
 * `profile.identity` is that owner, so an edit must survive a remount.
 */
describe('Settings — identity round-trip (Phase 7)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  function readStored(): {
    profile: PfaProfile;
    settings: { personal: { nume: string }; company: { mentiuniFactura?: string } };
  } {
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw, 'expected data to be persisted to localStorage').not.toBeNull();
    return JSON.parse(raw as string);
  }

  it('persists a personal name edit and restores it on remount', () => {
    const first = render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );
    act(() => {
      screen.getByRole('button', { name: 'Personal' }).click();
    });
    act(() => {
      fireEvent.change(screen.getByDisplayValue('Popescu Andrei'), {
        target: { value: 'Popescu Andrei Nou' },
      });
    });
    act(() => {
      screen.getByRole('button', { name: 'Salvează' }).click();
    });

    expect(readStored().profile.identity.nume).toBe('Popescu Andrei Nou');
    // The legacy block is FROZEN: still written by the seed and still parseable,
    // but no longer a write target (decision D-1, acceptance criterion 6).
    expect(readStored().settings.personal.nume).toBe('Popescu Andrei');

    act(() => {
      first.unmount();
    });
    render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );
    act(() => {
      screen.getByRole('button', { name: 'Personal' }).click();
    });
    expect(screen.getByDisplayValue('Popescu Andrei Nou')).toBeInTheDocument();
  });

  it('persists invoice notes into identity.mentiuniFactura', () => {
    render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );
    // The PFA tab is the default tab; its mențiuni card is the second "Salvează".
    act(() => {
      fireEvent.change(screen.getByPlaceholderText('Text afișat pe factura (opțional)'), {
        target: { value: 'De plată la 15 zile.' },
      });
    });
    const saveButtons = screen.getAllByRole('button', { name: 'Salvează' });
    act(() => {
      saveButtons[1].click();
    });

    expect(readStored().profile.identity.mentiuniFactura).toBe('De plată la 15 zile.');
    // Not written to the retired settings.company block.
    expect(readStored().settings.company.mentiuniFactura).toBeUndefined();
  });
});

describe('Settings — Regim fiscal tab (Phase 6 profile write path)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('offers only regimes a PFA can actually hold', () => {
    render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );
    openFiscalTab();

    const regime = fieldControl('Regim fiscal') as HTMLSelectElement;
    expect(Array.from(regime.options).map(o => o.value)).toEqual(['impozit_pe_venit']);
    const optionText = Array.from(regime.options).map(o => o.textContent ?? '').join(' | ');
    expect(optionText.toLowerCase()).not.toContain('impozit pe profit');
    expect(optionText.toLowerCase()).not.toContain('norm');
  });

  it('persists profile edits to localStorage when "Salvează" is clicked', () => {
    render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );
    openFiscalTab();

    inputField('Cod CAEN', '6202');
    inputField('Data înființării', '2026-04-01');
    selectField('Venit din salarii', 'da');
    inputField('Venit brut anual din salarii', '30000');
    clickSave();

    const profile = readStoredProfile();
    // Phase 7 (D-1b): CAEN is written to the one canonical model,
    // `identity.caen[]`. The deprecated `profile.caen` scalar is no longer written.
    expect(profile.identity.caen?.[0]?.cod).toBe('6202');
    expect(profile.caen).toBeUndefined();
    expect(profile.pfaStartDate).toBe('2026-04-01');
    expect(profile.salaryStatus).toBe('da');
    expect(profile.salaryIncomeLei).toBe(lei(30000));
    // Untouched fields keep their seed values (shallow merge must not blank them).
    expect(profile.regime).toBe('impozit_pe_venit');
    expect(profile.pfaStartYear).toBe(2020);
    expect(profile.identity.nume).toBe('Popescu Andrei');
  });

  it('restores saved profile values from localStorage on remount', () => {
    const first = render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );
    openFiscalTab();
    inputField('Cod CAEN', '6202');
    selectField('Venit din salarii', 'da');
    inputField('Venit brut anual din salarii', '30000');
    clickSave();

    act(() => {
      first.unmount();
    });
    render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );
    openFiscalTab();

    expect(screen.getByDisplayValue('6202')).toBeInTheDocument();
    expect((fieldControl('Venit din salarii') as HTMLSelectElement).value).toBe('da');
    expect(screen.getByDisplayValue('30000')).toBeInTheDocument();
  });

  it('refuses to save a salary without the annual amount the 6 SM test needs', () => {
    render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );
    openFiscalTab();

    selectField('Venit din salarii', 'da');
    clickSave();

    expect(
      screen.getByText(/Venitul brut anual din salarii este necesar/),
    ).toBeInTheDocument();
    // Nothing half-saved: the stored profile still says there is no salary.
    expect(readStoredProfile().salaryStatus).toBe('nu');
    expect(readStoredProfile().salaryIncomeLei).toBeUndefined();
  });

  it('drops the stale salary amount when the salary is removed', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...seedData,
        profile: {
          ...seedData.profile,
          salaryStatus: 'da',
          salaryIncomeLei: lei(30000),
        },
      }),
    );
    render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );
    openFiscalTab();

    selectField('Venit din salarii', 'nu');
    clickSave();

    const profile = readStoredProfile();
    expect(profile.salaryStatus).toBe('nu');
    expect(profile.salaryIncomeLei).toBeUndefined();
  });

  it('rejects a negative cash floor instead of persisting it', () => {
    render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );
    openFiscalTab();

    inputField('Prag plăți în numerar', '-5');
    clickSave();

    expect(screen.getByText('Valoare invalidă (lei, ≥ 0).')).toBeInTheDocument();
    expect(readStoredProfile().cashFloorLei).toBe(0);
  });

  // P-PROFILE-VAT-DATE: the profile is the only place the TVA exceedance date can enter the app,
  // so the write path has to exist and the value has to survive a reload.
  it('persists the VAT exceedance date and restores it on remount', () => {
    const first = render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );
    openFiscalTab();
    inputField('Data depășirii pragului de TVA', '2026-09-15');
    clickSave();
    expect(readStoredProfile().vatExceedanceDate).toBe('2026-09-15');

    act(() => {
      first.unmount();
    });
    render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );
    openFiscalTab();
    expect((fieldControl('Data depășirii pragului de TVA') as HTMLInputElement).value).toBe('2026-09-15');
  });

  it('an empty exceedance date is stored as absent, never as an empty string', () => {
    // '' would pass through the form but fail the schema's date rule, and a stored '' is exactly
    // the malformed value B-21 was about. Absent is the honest answer to "the user never said".
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...seedData,
        profile: { ...seedData.profile, vatExceedanceDate: '2026-09-15' },
      }),
    );
    render(
      <StoreProvider>
        <Settings />
      </StoreProvider>,
    );
    openFiscalTab();

    expect((fieldControl('Data depășirii pragului de TVA') as HTMLInputElement).value).toBe('2026-09-15');
    inputField('Data depășirii pragului de TVA', '');
    clickSave();

    const profile = readStoredProfile();
    expect(profile.vatExceedanceDate).toBeUndefined();
  });
});
