/**
 * D-DPI-2 (B-152) — the six ladder questions in the form, and the one property that decides whether this
 * feature is a fix or a new way to undercharge somebody.
 *
 * **§6.5 of brief 78, stated as a test:** *the UI cannot submit an untouched control as `none`.* The whole
 * narrowing of `calcCassLadder`'s refusal rests on `declared none` and `not asked yet` being different
 * stored facts. A select whose default were `none`, a save path that wrote `none` for an empty control, or a
 * form that treated a blank box as „nu am avut” would each collapse them — and the app would read a person's
 * silence as „no other income” and compute a smaller CASS base out of it. So the first test below renders
 * the questions, touches nothing, saves, and asserts what the payload says about a person who never chose.
 *
 * The rest pin the two directions that must both stay true: a chosen „nu am avut” really is stored as a fact
 * and really does unblock the ladder, and an amount typed under v16-v25 rules — where no answer token existed
 * — comes back as an answer rather than being rewritten into one the person never gave.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { STORAGE_KEY, StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import { seedStorage } from '../test/storage';
import { settings as settingsCopy, copy } from '../ui/copy';
import {
  CASS_LADDER_CATEGORIES,
  CASS_LADDER_CATEGORY_NAMES,
  cassLadderFactsForYear,
  cassLadderMissingCategories,
  type CassLadderCategory,
  type CassLadderYear,
} from '../domain/models';
import { lei } from '../domain/money';
import type { AppData } from '../data/types';
import Settings from './Settings';

/** The six form fields, in the order art. 155 alin. (1) lists the litera. */
const LADDER_FIELDS = [
  'proprietateIntelectuala',
  'asocierePersoanaJuridica',
  'cedareaFolosinteiBunurilor',
  'activitatiAgricole',
  'investitii',
  'alteSurse',
] as const;

/**
 * The form field ↔ legal category pairing, restated here on purpose. If `Settings.tsx` ever maps a question
 * onto a different category than the engine sums, the assertions below land on the wrong control and the
 * mismatch shows up as a failure rather than as a silently mislabelled answer.
 */
const FIELD_CATEGORY: Record<(typeof LADDER_FIELDS)[number], CassLadderCategory> = {
  proprietateIntelectuala: 'proprietate_intelectuala',
  asocierePersoanaJuridica: 'asociere_persoana_juridica',
  cedareaFolosinteiBunurilor: 'cedarea_folosintei_bunurilor',
  activitatiAgricole: 'activitati_agricole',
  investitii: 'investitii',
  alteSurse: 'alte_surse',
};

function payload(over: Partial<AppData> = {}): AppData & { version: number } {
  return { ...seedData, ...over, version: CURRENT_DATA_VERSION };
}

function storedProfile(): AppData['profile'] {
  const raw = localStorage.getItem(STORAGE_KEY);
  expect(raw, 'expected the store to have persisted').not.toBeNull();
  return (JSON.parse(raw as string) as AppData).profile;
}

function storedLadderYear(): CassLadderYear | undefined {
  return storedProfile().cassLadderYears?.[0];
}

function select(field: string): HTMLSelectElement {
  const el = document.querySelector(`[data-ladder-answer="${field}"]`);
  if (!el) throw new Error(`no [data-ladder-answer="${field}"] control rendered`);
  return el as HTMLSelectElement;
}

function amountInput(field: string): HTMLInputElement | null {
  return document.querySelector(`[data-ladder-amount="${field}"]`) as HTMLInputElement | null;
}

function choose(field: string, value: string): void {
  act(() => {
    fireEvent.change(select(field), { target: { value } });
  });
}

function typeAmount(field: string, value: string): void {
  const el = amountInput(field);
  if (!el) throw new Error(`no amount input rendered for ${field}`);
  act(() => {
    fireEvent.change(el, { target: { value } });
  });
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

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('§6.5 — an untouched question is never a declared absence', () => {
  it('renders six questions, every one of them untouched', () => {
    seedStorage(payload());
    renderFiscalTab();
    for (const field of LADDER_FIELDS) {
      expect(select(field).value, `${field} must start untouched`).toBe('');
    }
    // No amount box is offered until the person says they have such an income: the question comes first.
    for (const field of LADDER_FIELDS) expect(amountInput(field)).toBeNull();
    expect(document.querySelector('[data-ladder-answered]')?.textContent).toContain(
      'Niciuna dintre cele șase categorii',
    );
  });

  it('saving without touching anything stores NO answer at all — the state stays unknown', () => {
    seedStorage(payload());
    renderFiscalTab();
    saveFiscal();

    const year = storedLadderYear();
    // Either the year was never written, or it was written with no answers in it. What may NOT happen is a
    // `ladderAnswers` map full of `none` for a person who never opened a select.
    const answers = year?.ladderAnswers ?? {};
    expect(Object.keys(answers)).toHaveLength(0);
    const facts = cassLadderFactsForYear(year);
    expect(facts.filter((f) => f.state === 'none')).toHaveLength(0);
    expect(cassLadderMissingCategories(year)).toHaveLength(6);
  });

  it('a profile that already answered keeps its answers through a save nobody touched', () => {
    seedStorage(
      payload({
        profile: {
          ...seedData.profile,
          cassLadderYears: [
            { fiscalYear: seedData.profile.fiscalYear, ladderAnswers: { investitii: 'none' } },
          ],
        },
      }),
    );
    renderFiscalTab();
    expect(select('investitii').value).toBe('none');
    saveFiscal();
    expect(storedLadderYear()?.ladderAnswers).toEqual({ investitii: 'none' });
  });
});

describe('a chosen „nu am avut” is a fact, and it is the fact the ladder needs', () => {
  it('six declared absences store as six `none` and no amount, and leave nothing unanswered', () => {
    seedStorage(payload());
    renderFiscalTab();
    for (const field of LADDER_FIELDS) choose(field, 'none');
    saveFiscal();

    const year = storedLadderYear();
    expect(year?.ladderAnswers).toEqual({
      proprietate_intelectuala: 'none',
      asociere_persoana_juridica: 'none',
      cedarea_folosintei_bunurilor: 'none',
      activitati_agricole: 'none',
      investitii: 'none',
      alte_surse: 'none',
    });
    // No figure was minted beside any of them: `none` is not a zero the app wrote.
    for (const category of CASS_LADDER_CATEGORIES) {
      expect(cassLadderFactsForYear(year).find((f) => f.category === category)!.amount).toBeUndefined();
    }
    expect(cassLadderMissingCategories(year)).toEqual([]);
  });

  it('five „nu am avut” and one untouched question leaves exactly that one unanswered', () => {
    seedStorage(payload());
    renderFiscalTab();
    for (const field of LADDER_FIELDS) if (field !== 'alteSurse') choose(field, 'none');
    saveFiscal();

    const year = storedLadderYear();
    expect(cassLadderMissingCategories(year)).toEqual(['alte_surse']);
    // The untouched one is not `none` — it is the absence of an answer.
    expect(year?.ladderAnswers?.alte_surse).toBeUndefined();
  });

  it('„nu vreau să declar acum” stores `unknown`, which blocks the ladder like silence does', () => {
    seedStorage(payload());
    renderFiscalTab();
    for (const field of LADDER_FIELDS) choose(field, 'none');
    choose('investitii', 'unknown');
    saveFiscal();

    const year = storedLadderYear();
    expect(year?.ladderAnswers?.investitii).toBe('unknown');
    expect(cassLadderMissingCategories(year)).toEqual(['investitii']);
  });

  it('„am avut” with no figure refuses to save and writes nothing for that category', () => {
    seedStorage(payload());
    renderFiscalTab();
    choose('investitii', 'amount');
    expect(amountInput('investitii')).not.toBeNull();
    saveFiscal();
    // The save is blocked by the validation error, so no ladder year was written at all.
    expect(storedLadderYear()?.ladderAnswers?.investitii).toBeUndefined();
    expect(document.querySelector('.error')?.textContent).toContain(
      settingsCopy.fiscal.ladderAmountRequired,
    );
  });

  it('„am avut” with a figure stores the amount AND the answer, and the category counts as answered', () => {
    seedStorage(payload());
    renderFiscalTab();
    for (const field of LADDER_FIELDS) choose(field, 'none');
    choose('investitii', 'amount');
    typeAmount('investitii', '30000');
    saveFiscal();

    const year = storedLadderYear();
    expect(year?.investitii).toBe(lei(30000));
    expect(year?.ladderAnswers?.investitii).toBe('amount');
    expect(cassLadderMissingCategories(year)).toEqual([]);
  });

  it('switching away from „am avut” clears the box, so no answer/figure contradiction can be saved', () => {
    seedStorage(payload());
    renderFiscalTab();
    choose('investitii', 'amount');
    typeAmount('investitii', '30000');
    choose('investitii', 'none');
    expect(amountInput('investitii')).toBeNull();
    saveFiscal();
    const year = storedLadderYear();
    expect(year?.investitii).toBeUndefined();
    expect(year?.ladderAnswers?.investitii).toBe('none');
    const fact = cassLadderFactsForYear(year).find((f) => f.category === 'investitii')!;
    expect(fact.state).toBe('none');
  });
});

describe('a payload written before v26 keeps the answer it already gave', () => {
  it('a stored amount with no answer token reads back as „am avut”, not as untouched', () => {
    seedStorage(
      payload({
        profile: {
          ...seedData.profile,
          cassLadderYears: [
            { fiscalYear: seedData.profile.fiscalYear, investitii: lei(25_200) },
          ],
        },
      }),
    );
    renderFiscalTab();
    expect(select('investitii').value).toBe('amount');
    expect(amountInput('investitii')?.value).toBe('25200');
    // The other five stay untouched — the app does not answer them on the way past.
    for (const field of LADDER_FIELDS.filter((f) => f !== 'investitii')) {
      expect(select(field).value).toBe('');
    }
  });

  it('saving such a year again keeps the amount and mints no `none` for the categories nobody answered', () => {
    seedStorage(
      payload({
        profile: {
          ...seedData.profile,
          cassLadderYears: [
            { fiscalYear: seedData.profile.fiscalYear, investitii: lei(25_200) },
          ],
        },
      }),
    );
    renderFiscalTab();
    saveFiscal();
    const year = storedLadderYear();
    expect(year?.investitii).toBe(lei(25_200));
    const facts = cassLadderFactsForYear(year);
    expect(facts.filter((f) => f.state === 'none')).toHaveLength(0);
    expect(cassLadderMissingCategories(year)).toHaveLength(5);
  });
});

describe('the questions are asked in the person\'s words and cited with the law\'s', () => {
  it('every question renders its plain-Romanian label and its article-plus-quoted-text citation', () => {
    seedStorage(payload());
    renderFiscalTab();
    for (const field of LADDER_FIELDS) {
      const category = FIELD_CATEGORY[field];
      const label = document.querySelector(`label[for="set-ladder-answer-${field}"]`)?.textContent;
      expect(label, `${field} has no question label`).toBe(settingsCopy.fiscal.ladderQuestions[field]);
      // The citation is the domain's own list — the same string the engine's refusal prints — so the screen
      // and the refusal cannot grow two vocabularies for one legal list (B-122).
      const citation = document.querySelector(`[data-ladder-citation="${field}"]`)?.textContent;
      expect(citation).toContain(CASS_LADDER_CATEGORY_NAMES[category]);
      // Article plus quoted text, never a bare litera (D-CITE-1 / B-120).
      expect(citation).toMatch(/art\. 155 alin\. \(1\) lit\./);
      expect(citation).toMatch(/„.+”/);
    }
  });

  it('the six questions cover exactly the six categories the engine sums', () => {
    seedStorage(payload());
    renderFiscalTab();
    const rendered = [...document.querySelectorAll('[data-ladder-answer]')].map(
      (el) => (el as HTMLElement).getAttribute('data-ladder-answer'),
    );
    expect(rendered).toHaveLength(CASS_LADDER_CATEGORIES.length);
    for (const field of LADDER_FIELDS) expect(rendered).toContain(field);
  });
});
