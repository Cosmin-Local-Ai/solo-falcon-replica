/**
 * PG-6h-2 (B-82, B-83, B-84) — the accommodation facts are reviewable and editable in Settings, and none of
 * them is filled in by a CAEN code.
 *
 * The scenario's `fixTarget` points at this tab, so the controls have to exist, show what the profile
 * actually holds, and write the new answer through the profile's own write path. Three properties are
 * asserted for each of the three facts, because they are the three the migration could have broken:
 *
 * - an unanswered profile renders empty and **stays** empty after a save — no default reaches the payload;
 * - clearing an answer writes absence, not a stand-in value;
 * - the count is stored **per year**, and editing one year leaves the others alone.
 *
 * Plus the two that make this a fact-supplying task rather than a form: the title line states which title
 * the recorded count puts the income under, with the articles cited, and it has a third branch for the
 * unknown state; and a tourism CAEN code opens the block without answering a single question in it.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { STORAGE_KEY, StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import { seedStorage } from '../test/storage';
import { settings as settingsCopy, copy } from '../ui/copy';
import type { AppData } from '../data/types';
import Settings from './Settings';

type ProfileWithFacts = AppData['profile'] & {
  accommodationRoomCounts?: Array<{ fiscalYear: number; rooms: number }>;
  accommodationCommissionReading?: string;
  accommodationTourismEligibility?: string;
};

function payload(over: Partial<AppData> = {}): AppData & { version: number } {
  return { ...seedData, ...over, version: CURRENT_DATA_VERSION };
}

function cazareProfile(over: Partial<ProfileWithFacts> = {}): ProfileWithFacts {
  return { ...seedData.profile, activityFamily: 'cazare', ...over } as ProfileWithFacts;
}

function storedProfile(): ProfileWithFacts {
  const raw = localStorage.getItem(STORAGE_KEY);
  expect(raw, 'expected the store to have persisted').not.toBeNull();
  return (JSON.parse(raw as string) as AppData).profile as ProfileWithFacts;
}

function control(attr: string): HTMLInputElement | HTMLSelectElement {
  const el = document.querySelector(`[data-${attr}]`);
  if (!el) throw new Error(`no [data-${attr}] control rendered`);
  return el as HTMLInputElement | HTMLSelectElement;
}

function titleText(): string | undefined {
  return document.querySelector('[data-accommodation-title]')?.textContent;
}

function renderFiscalTab() {
  return render(
    <StoreProvider>
      <Settings initialTab="fiscal" />
    </StoreProvider>,
  );
}

function saveFiscal(): void {
  act(() => {
    screen.getByRole('button', { name: copy.ui.save }).click();
  });
}

function typeRooms(value: string): void {
  act(() => {
    fireEvent.change(control('accommodation-rooms'), { target: { value } });
  });
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('the block appears on the declared family, and a CAEN code only ever adds to it', () => {
  it('a cazare profile sees the three questions', () => {
    seedStorage(payload({ profile: cazareProfile() }));
    renderFiscalTab();
    expect(document.querySelector('[data-accommodation-block]')).not.toBeNull();
    expect(control('accommodation-rooms').value).toBe('');
    expect((control('accommodation-commission') as HTMLSelectElement).value).toBe('');
    expect((control('accommodation-eligibility') as HTMLSelectElement).value).toBe('');
  });

  it('a `other` profile with a tourism CAEN code sees the questions, and every one is still empty', () => {
    // D-COM-2 / B-83: the code is an ADDITIONAL trigger. It may open a question; it may never answer one —
    // so the block opens with all three controls blank, and the note says the list is the app's own choice.
    seedStorage(
      payload({
        profile: {
          ...seedData.profile,
          activityFamily: 'other',
          identity: { ...seedData.profile.identity, caen: [{ cod: '5520', descriere: 'Pensiune' }] },
        },
      }),
    );
    renderFiscalTab();

    expect(document.querySelector('[data-accommodation-block]')).not.toBeNull();
    expect(control('accommodation-rooms').value).toBe('');
    expect((control('accommodation-commission') as HTMLSelectElement).value).toBe('');
    expect((control('accommodation-eligibility') as HTMLSelectElement).value).toBe('');
    expect(document.querySelector('[data-accommodation-caen-prompt]')?.textContent).toContain('HG 656/1997');
  });

  it('a profile with neither the family nor a Division 55 code is not shown the block at all', () => {
    seedStorage(payload({ profile: { ...seedData.profile, activityFamily: 'other' } }));
    renderFiscalTab();
    expect(document.querySelector('[data-accommodation-block]')).toBeNull();
  });
});

describe('the room count is stored per year, with no default (acceptance 3, 7)', () => {
  it('typing a count writes it under the fiscal year the profile declares', () => {
    seedStorage(payload({ profile: cazareProfile() }));
    renderFiscalTab();
    typeRooms('9');
    saveFiscal();

    expect(storedProfile().accommodationRoomCounts).toEqual([{ fiscalYear: seedData.profile.fiscalYear, rooms: 9 }]);
  });

  it('an unanswered profile stays unanswered through an unrelated save', () => {
    seedStorage(payload({ profile: cazareProfile() }));
    renderFiscalTab();
    saveFiscal();

    // Not `[{ rooms: 0 }]`, not `[{ rooms: 1 }]` — absent. A count minted here would mint a tax title.
    expect(storedProfile().accommodationRoomCounts).toBeUndefined();
  });

  it('editing one year leaves the counts recorded for other years untouched', () => {
    const year = seedData.profile.fiscalYear;
    seedStorage(
      payload({
        profile: cazareProfile({ accommodationRoomCounts: [{ fiscalYear: year + 1, rooms: 3 }] }),
      }),
    );
    renderFiscalTab();
    typeRooms('9');
    saveFiscal();

    const stored = storedProfile().accommodationRoomCounts ?? [];
    expect(stored).toHaveLength(2);
    expect(stored.find(r => r.fiscalYear === year + 1)?.rooms).toBe(3);
    expect(stored.find(r => r.fiscalYear === year)?.rooms).toBe(9);
  });

  it('clearing the field makes that year unanswered again and keeps the other years', () => {
    const year = seedData.profile.fiscalYear;
    seedStorage(
      payload({
        profile: cazareProfile({
          accommodationRoomCounts: [
            { fiscalYear: year, rooms: 9 },
            { fiscalYear: year + 1, rooms: 3 },
          ],
        }),
      }),
    );
    renderFiscalTab();
    expect(control('accommodation-rooms').value).toBe('9');
    typeRooms('');
    saveFiscal();

    const stored = storedProfile().accommodationRoomCounts ?? [];
    expect(stored).toEqual([{ fiscalYear: year + 1, rooms: 3 }]);
  });

  it('a non-integer count is an error on screen, not a silently dropped answer', () => {
    seedStorage(payload({ profile: cazareProfile() }));
    renderFiscalTab();
    typeRooms('2.5');
    saveFiscal();
    expect(storedProfile().accommodationRoomCounts).toBeUndefined();
    expect(document.querySelector('.error')?.textContent).toContain('camere');
  });
});

describe('the title line names the title, with the articles (acceptance 2)', () => {
  it('3 rooms reads as cedarea folosinței, citing art. 83 alin. (2) and art. 85', () => {
    seedStorage(payload({ profile: cazareProfile({ accommodationRoomCounts: [{ fiscalYear: seedData.profile.fiscalYear, rooms: 3 }] }) }));
    renderFiscalTab();
    expect(titleText()).toBe(settingsCopy.fiscal.accommodationTitleCedarea(seedData.profile.fiscalYear));
    expect(titleText()).toContain('cedarea folosinței bunurilor');
    expect(titleText()).toContain('art. 83 alin. (2)');
    expect(titleText()).toContain('art. 85');
  });

  it('9 rooms reads as activitate independentă, citing art. 83 alin. (4) and art. 68^3', () => {
    seedStorage(payload({ profile: cazareProfile({ accommodationRoomCounts: [{ fiscalYear: seedData.profile.fiscalYear, rooms: 9 }] }) }));
    renderFiscalTab();
    expect(titleText()).toContain('art. 83 alin. (4)');
    expect(titleText()).toContain('art. 68^3');
  });

  it('no count reads as “the app does not know the title”, and picks neither one', () => {
    seedStorage(payload({ profile: cazareProfile() }));
    renderFiscalTab();
    expect(titleText()).toContain('nu este înregistrat');
    expect(titleText()).not.toContain('cedarea folosinței bunurilor:');
  });
});

/*
 * B-81 (brief 73) — the D212 subsection for an art. 68^3 income is refused on screen.
 *
 * The trap this block guards is the one the brief names: OPANAF 2736/2025 — the D212 model and its
 * instructions — contains no reference to art. 68^3 and still sends the tourist-rental line to the fișă
 * approved by OPANAF 398/2021, which OPANAF 381/2026 abrogated. A cell map derived from those instructions
 * would print a form reference that no longer exists. The deliverable is the refusal, and it has to name
 * the abrogated citation while keeping the certain thing (the 25 mai term) intact.
 */
describe('B-81 — the 68^3 D212 section is refused, not invented', () => {
  function refusalText(): string | undefined {
    return document.querySelector('[data-accommodation-d212-refusal]')?.textContent;
  }

  it('names the abrogated order it refuses to derive a cell map from', () => {
    seedStorage(payload({ profile: cazareProfile({ accommodationRoomCounts: [{ fiscalYear: seedData.profile.fiscalYear, rooms: 9 }] }) }));
    renderFiscalTab();
    expect(refusalText()).toBeDefined();
    expect(refusalText()).toContain('OPANAF nr. 2.736');
    expect(refusalText()).toContain('nu conține nicio referire la art. 68^3');
    expect(refusalText()).toContain('OPANAF nr. 398/2021');
    expect(refusalText()).toContain('abrogat');
    expect(refusalText()).toContain('OPANAF nr. 381');
  });

  it('does not withdraw the term the law does give, and says what is actually missing', () => {
    seedStorage(payload({ profile: cazareProfile({ accommodationRoomCounts: [{ fiscalYear: seedData.profile.fiscalYear, rooms: 9 }] }) }));
    renderFiscalTab();
    expect(refusalText()).toContain('25 mai');
    expect(refusalText()).toContain('art. 122 alin. (3)');
    // The successor order is reported as not found, with the sweep that would settle it still open.
    expect(refusalText()).toContain('Monitorul Oficial Partea I');
  });

  it('is not shown under cedarea folosinței, where the form section is known', () => {
    // The art. 85 regime has its own open question in rule data and its own D212 citation for the ordinary
    // cedarea folosinței lines; the 68^3 refusal belongs to the 68^3 title and nowhere else.
    seedStorage(payload({ profile: cazareProfile({ accommodationRoomCounts: [{ fiscalYear: seedData.profile.fiscalYear, rooms: 3 }] }) }));
    renderFiscalTab();
    expect(refusalText()).toBeUndefined();
  });

  it('is not shown when the count is unanswered — no title, no form question', () => {
    seedStorage(payload({ profile: cazareProfile() }));
    renderFiscalTab();
    expect(refusalText()).toBeUndefined();
  });
});

describe('the commission answer is recorded as the user’s choice, with the alternative visible (acceptance 4)', () => {
  it('choosing a reading persists it and shows which one the app applied, beside the other', () => {
    seedStorage(payload({ profile: cazareProfile() }));
    renderFiscalTab();
    act(() => {
      fireEvent.change(control('accommodation-commission'), { target: { value: 'reading_a' } });
    });
    saveFiscal();

    expect(storedProfile().accommodationCommissionReading).toBe('reading_a');

    renderFiscalTab();
    const applied = document.querySelector('[data-accommodation-commission-applied]')?.textContent;
    expect(applied).toBe(settingsCopy.fiscal.accommodationCommissionApplied.reading_a);
    // The alternative is named in the same sentence — a choice shown without its alternative reads like a
    // finding the app reached, which is the thing D-COM-1 forbids.
    expect(applied).toContain('Cealaltă citire posibilă, B');
  });

  it('an unanswered commission question writes nothing and says the app chooses neither', () => {
    seedStorage(payload({ profile: cazareProfile() }));
    renderFiscalTab();
    saveFiscal();

    expect(storedProfile().accommodationCommissionReading).toBeUndefined();
    expect(document.querySelector('[data-accommodation-commission-applied]')?.textContent).toBe(
      settingsCopy.fiscal.accommodationCommissionUnanswered,
    );
  });

  it('the eligibility answer is stored as a fact, and clearing it writes absence', () => {
    seedStorage(payload({ profile: cazareProfile({ accommodationTourismEligibility: 'da' }) }));
    renderFiscalTab();
    expect((control('accommodation-eligibility') as HTMLSelectElement).value).toBe('da');

    act(() => {
      fireEvent.change(control('accommodation-eligibility'), { target: { value: '' } });
    });
    saveFiscal();
    expect(storedProfile().accommodationTourismEligibility).toBeUndefined();
  });
});

describe('no CAEN code answers any of the three questions', () => {
  it('typing a Division 55 code into the CAEN field persists the code and leaves all three facts absent', () => {
    seedStorage(payload({ profile: cazareProfile() }));
    renderFiscalTab();

    // B-124 — the CAEN control is a list of comboboxes now, so the principal row is addressed
    // by its own hook rather than by whatever value the seed happens to hold.
    const caen = document.querySelector('input[data-caen-input="0"]') as HTMLInputElement | null;
    expect(caen, 'the fiscal tab carries the CAEN control next to this block').not.toBeNull();
    act(() => {
      fireEvent.change(caen!, { target: { value: '5510' } });
    });
    saveFiscal();

    const stored = storedProfile();
    expect(stored.identity.caen?.[0]?.cod).toBe('5510');
    expect(stored.accommodationRoomCounts).toBeUndefined();
    expect(stored.accommodationCommissionReading).toBeUndefined();
    expect(stored.accommodationTourismEligibility).toBeUndefined();
  });
});
