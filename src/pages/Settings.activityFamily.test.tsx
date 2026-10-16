/**
 * PG-6b (B-29) — the answer is visible and editable in Settings, and it persists.
 *
 * Acceptance criterion 4. A refusal the user cannot undo is a dead end, and a fact the app believes about
 * them but never shows is a worse one: the scenario's `fixTarget` points at this control, so the control
 * has to exist, show the stored value, and write the new one through the profile's own write path.
 *
 * The three states are asserted separately, because the defect this field removes is exactly the collapse
 * of two of them: a stored profile that never answered must render an empty select and must still be empty
 * after a save, while `other` is an answer somebody gave and stays an answer.
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

function payload(over: Partial<AppData> = {}): AppData & { version: number } {
  return { ...seedData, ...over, version: CURRENT_DATA_VERSION };
}

function unansweredProfile(): AppData['profile'] {
  const profile = { ...seedData.profile } as AppData['profile'] & { activityFamily?: string };
  delete profile.activityFamily;
  return profile;
}

function readStoredActivityFamily(): string | undefined {
  const raw = localStorage.getItem(STORAGE_KEY);
  expect(raw, 'expected the store to have persisted').not.toBeNull();
  return ((JSON.parse(raw as string) as AppData).profile as { activityFamily?: string }).activityFamily;
}

function select(): HTMLSelectElement {
  const el = document.querySelector('[data-activity-family]');
  if (!el) throw new Error('no activity-family control rendered');
  return el as HTMLSelectElement;
}

function renderFiscalTab() {
  return render(
    <StoreProvider>
      <Settings initialTab="fiscal" />
    </StoreProvider>,
  );
}

function saveFiscal(): void {
  const button = screen.getByRole('button', { name: copy.ui.save });
  act(() => {
    button.click();
  });
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('the activity family is reviewable in Settings', () => {
  it('shows the family the profile declares, with Romanian captions rather than the stored tokens', () => {
    seedStorage(payload({ profile: { ...seedData.profile, activityFamily: 'cazare' } }));
    renderFiscalTab();

    expect(select().value).toBe('cazare');
    expect(screen.getByText(settingsCopy.fiscal.activityFamilyOptions.cazare)).toBeTruthy();
    // The internal token never reaches the screen as a caption of its own.
    const captions = [...document.querySelectorAll('option')].map(o => o.textContent);
    expect(captions).not.toContain('cazare');
  });

  it('writes the new answer through the profile write path, so the scenario can be fixed from the link', () => {
    seedStorage(payload({ profile: { ...seedData.profile, activityFamily: 'cazare' } }));
    renderFiscalTab();

    act(() => {
      fireEvent.change(select(), { target: { value: 'other' } });
    });
    saveFiscal();

    expect(readStoredActivityFamily()).toBe('other');
  });

  it('an unanswered profile renders empty and stays unanswered after an unrelated save', () => {
    seedStorage(payload({ profile: unansweredProfile() }));
    renderFiscalTab();

    expect(select().value).toBe('');
    // The hint that appears in this state says what the app is doing with the gap, instead of leaving the
    // person to discover it from a badge on another page.
    const hint = document.querySelector('[data-activity-family-hint]');
    expect(hint?.textContent).toBe(settingsCopy.fiscal.activityFamilyUnanswered);

    saveFiscal();
    expect(readStoredActivityFamily()).toBeUndefined();
  });

  it('clearing the answer writes absence, not `other`', () => {
    seedStorage(payload({ profile: { ...seedData.profile, activityFamily: 'other' } }));
    renderFiscalTab();

    act(() => {
      fireEvent.change(select(), { target: { value: '' } });
    });
    saveFiscal();

    expect(readStoredActivityFamily()).toBeUndefined();
  });

  it('the CAEN field does not set it: typing a cazare code leaves the family exactly as it was', () => {
    seedStorage(payload({ profile: unansweredProfile() }));
    renderFiscalTab();

    // B-124 — the CAEN control is a list of comboboxes now, so the principal row is addressed
    // by its own hook rather than by whatever value the seed happens to hold.
    const caen = document.querySelector('input[data-caen-input="0"]') as HTMLInputElement | null;
    expect(caen, 'the fiscal tab carries the CAEN control next to this one').not.toBeNull();
    act(() => {
      fireEvent.change(caen!, { target: { value: '5510' } });
    });
    saveFiscal();

    const raw = localStorage.getItem(STORAGE_KEY) as string;
    const stored = JSON.parse(raw) as AppData;
    expect(stored.profile.identity.caen?.[0]?.cod).toBe('5510');
    expect((stored.profile as { activityFamily?: string }).activityFamily).toBeUndefined();
  });
});

/**
 * B-107 — arendă agricolă resolves to sistem real, and the app now says so.
 *
 * The resolution is unchanged and correct: the data layer carries no arendă identifier, so a non-cazare
 * register with no lease fact falls through to sistem real. What was missing is the sentence. A person
 * with an arendă agricolă reads a sistem-real figure and has no way to know the law runs that income
 * differently — cash-basis gross, 20 % at each payment, 10 % withheld at source and final, no contract
 * registration, CASS that CAN be withheld — or that this app deliberately does not compute it.
 *
 * The test asserts the sentence is present for the answer that produces the resolution and absent for the
 * one that does not, so it cannot pass by printing the caveat everywhere.
 */
describe('B-107 — the sistem real resolution says which regime it applied', () => {
  it('naming the regime beside the `other` answer, and naming arendă agricolă as the one it is not', () => {
    seedStorage(payload({ profile: { ...seedData.profile, activityFamily: 'other' } }));
    renderFiscalTab();

    const method = document.querySelector('[data-activity-family-method]');
    expect(method?.textContent).toContain('sistem real');
    expect(method?.textContent).toContain('art. 118');

    const arenda = document.querySelector('[data-arenda-note]');
    expect(arenda?.textContent).toContain('arendă agricolă');
    // The four things that make arendă a different mechanism, each cited.
    expect(arenda?.textContent).toContain('art. 84 alin. (4)');
    expect(arenda?.textContent).toContain('20 %');
    expect(arenda?.textContent).toContain('art. 83 alin. (5)');
    expect(arenda?.textContent).toContain('art. 174¹ alin. (3)');
    // The claim that matters: the figure on the dashboard is not the arendă figure.
    expect(arenda?.textContent).toContain('nu este cifra arendei');
  });

  it('a cazare register is not told about arendă: the sentence belongs to the answer that resolves to sistem real', () => {
    seedStorage(payload({ profile: { ...seedData.profile, activityFamily: 'cazare' } }));
    renderFiscalTab();

    expect(document.querySelector('[data-arenda-note]')).toBeNull();
    expect(document.querySelector('[data-activity-family-method]')).toBeNull();
  });

  it('an unanswered profile is not told which regime it is under — the app has not chosen one yet', () => {
    seedStorage(payload({ profile: unansweredProfile() }));
    renderFiscalTab();

    expect(document.querySelector('[data-arenda-note]')).toBeNull();
  });
});
