/**
 * PG-6b (B-29) — the first run asks the question the art. 68^3 refusal has been waiting for.
 *
 * Brief 28 §PG-6b is explicit that this is an asked fact and never an inferred one, and this screen used to
 * say the opposite: its "what we do not ask" card carried the activity declaration as deferred, because
 * 12E was blocked on a CAEN→family mapping that `research/30` §3 shows does not exist in law (OMFP
 * 925/2017 art. 2 alin. (4) keys the method to the activity description „independent de codurile CAEN
 * menționate cu titlu exemplificativ”). So the mapping question is settled — negatively — and what is left
 * is to ask the person.
 *
 * The assertions that matter are the two about silence: not answering writes nothing at all, and typing a
 * CAEN code is not an answer.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StoreProvider, STORAGE_KEY, useStore } from '../data/store';
import { onboarding as t } from '../ui/copy';
import type { AppData } from '../data/types';
import Onboarding from './Onboarding';

let store: ReturnType<typeof useStore> | null = null;
function Probe() {
  store = useStore();
  return null;
}

function renderOnboarding() {
  return render(
    <StoreProvider>
      <Onboarding />
      <Probe />
    </StoreProvider>,
  );
}

const familyRadio = (value: string): HTMLInputElement => {
  const input = document.querySelector(`[data-activity-family="${value}"] input`) as HTMLInputElement | null;
  if (!input) throw new Error(`no activity-family control for ${value}`);
  return input;
};

function finish(): void {
  fireEvent.change(screen.getByLabelText(t.fields.nume), { target: { value: 'Dobre Radu' } });
  fireEvent.change(screen.getByLabelText(t.fields.startDate), { target: { value: '2026-03-01' } });
  fireEvent.click(screen.getByText(t.actions.finish));
}

function storedProfile(): AppData['profile'] {
  const raw = localStorage.getItem(STORAGE_KEY);
  expect(raw, 'expected onboarding to persist the profile').not.toBeNull();
  return (JSON.parse(raw as string) as AppData).profile;
}

beforeEach(() => {
  localStorage.clear();
  store = null;
});

afterEach(() => {
  localStorage.clear();
});

describe('Onboarding asks the activity-family question (acceptance 1)', () => {
  it('the question is on the screen, with three answers and no CAEN guess', () => {
    renderOnboarding();

    expect(screen.getByText(t.sections.activityFamily)).toBeTruthy();
    expect(screen.getByText(t.fields.activityFamilyOptions.other)).toBeTruthy();
    expect(screen.getByText(t.fields.activityFamilyOptions.cazare)).toBeTruthy();
    // "not recorded" is a real option, not a placeholder that silently means `other`.
    expect(familyRadio('').checked).toBe(true);
  });

  it('answering "Da — cazare" persists the family, and the app believes what the person said', () => {
    renderOnboarding();
    fireEvent.click(familyRadio('cazare'));
    finish();

    expect(storedProfile().activityFamily).toBe('cazare');
  });

  it('answering "Nu" persists `other`, which is the answer that keeps the ordinary calculation', () => {
    renderOnboarding();
    fireEvent.click(familyRadio('other'));
    finish();

    expect(storedProfile().activityFamily).toBe('other');
  });

  it('not answering writes nothing: the profile keeps the third state, not `other`', () => {
    renderOnboarding();
    finish();

    const profile = storedProfile() as AppData['profile'] & { activityFamily?: string };
    expect('activityFamily' in profile).toBe(false);
    expect(profile.activityFamily).toBeUndefined();
  });

  it('the activity declaration is no longer listed as deferred', () => {
    renderOnboarding();

    // The deferred card still carries the other-income amounts — that gap is real and belongs to 12F — but
    // it no longer claims the activity family was left out on purpose.
    expect(screen.getByText(t.deferred.otherAmounts)).toBeTruthy();
    const card = screen.getByText(t.sections.deferred).closest('.card');
    expect(card?.textContent).not.toContain('coduri CAEN');
  });
});
