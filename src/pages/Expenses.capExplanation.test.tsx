/**
 * TASK 2d acceptance — the pre-cap flip must never be silent.
 *
 * TASK 2c computed the post-cap reading and kept it as internal bookkeeping. TASK 2d makes the pre-cap
 * reading operative, so the number the user sees is SMALLER than the one they saw before, and the only
 * thing standing between that change and a silent one is this screen: it has to name the ceiling it
 * applied, the ceiling the other reading would have given, the article, and the fact that the law does
 * not settle which reading applies (research 22 §6 — zero occurrences of „protocol", „ordinea" or
 * „în ordine" in the norms chapter for Titlul IV Cap. II).
 *
 * The exact amounts are pinned at a FIXED date in `estimateBasis.annualCaps.test.ts` (54,00 lei applied
 * vs 146,30 lei alternative). This page runs on `localDateISO(now())`, so what is pinned HERE is the
 * relation the flip creates — both figures present, and the applied one strictly the smaller — not a
 * pair of wall-clock-dependent numbers.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import Expenses from './Expenses';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import type { Expense } from '../data/types';
import { lei } from '../domain/money';

const STORAGE_KEY = 'pfa-app-data-v2';

function seedWith(expenses: Expense[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...seedData, expenses: [...seedData.expenses, ...expenses], version: CURRENT_DATA_VERSION }),
  );
}

function expense(over: Partial<Expense>): Expense {
  return {
    id: over.id ?? 'ceil-exp',
    tip: 'factura',
    nr: 'FCT-CEIL-1',
    date: '2026-05-10',
    furnizor: 'Furnizor Test',
    cui: 'RO99999999',
    valoareFaraTva: lei(2000),
    tva: lei(400),
    status: 'inregistrata',
    ...over,
  };
}

/** `1.234,56` -> bani. */
function toBani(s: string): number {
  return Number(s.replace(/\./g, '').replace(',', '.'));
}

const APPLIED = /Plafon aplicat \(([^)]*)\): ([\d.]+,\d{2}) RON/;
// TASK 7 grammar pass: „lectură" is a book-reading word; the law is read as an „interpretare".
// Re-pinned from /cealaltă lectură, post-plafon: …/.
const ALTERNATIVE = /cealaltă interpretare, post-plafon: ([\d.]+,\d{2}) RON/;

describe('Expenses — the struck alin. (6) ceiling discloses BOTH readings', () => {
  beforeEach(() => localStorage.clear());

  it('names the ceiling applied, the alternative ceiling, the article and the unresolved reading', () => {
    // protocol + contribuții profesionale: the two categories whose readings of the alin. (6) base
    // disagree, so the two figures on screen must differ.
    seedWith([
      expense({ id: 'ceil-p', category: 'protocol', valoareFaraTva: lei(1000), tva: lei(190) }),
      expense({
        id: 'ceil-q',
        category: 'mandatory_professional_contribution',
        valoareFaraTva: lei(5000),
        tva: lei(950),
      }),
    ]);
    const { container } = render(
      <StoreProvider>
        <Expenses />
      </StoreProvider>,
    );
    const text = container.textContent ?? '';

    // The article, and the explicit statement that the law does not settle the reading.
    expect(text).toContain('art. 68 alin. (6)');
    // Re-pinned from 'Legea nu stabilește care lectură se aplică' (TASK 7 grammar pass).
    expect(text).toContain('Legea nu stabilește care interpretare se aplică');
    expect(text).toContain('nicio normă nu prescrie o ordine');
    // The uncertainty is carried by the one reusable „Notă de interpretare", not by an improvised line.
    expect(text).toContain('Notă de interpretare');
    // Which reading is operative, in words, not only in the arithmetic.
    expect(text).toContain('pre-plafon');
    expect(text).toContain('post-plafon');

    const applied = APPLIED.exec(text);
    const alternative = ALTERNATIVE.exec(text);
    expect(applied, 'the applied ceiling must be rendered').not.toBeNull();
    expect(alternative, 'the alternative ceiling must be rendered, not merely computed').not.toBeNull();

    const appliedBani = toBani(applied![2]);
    const alternativeBani = toBani(alternative![1]);
    expect(appliedBani).toBeGreaterThan(0);
    expect(alternativeBani).toBeGreaterThan(0);
    // The direction the flip creates: the operative pre-cap ceiling is the SMALLER one, and the larger
    // post-cap one is still on the screen. Had the flip been silent, only one figure would render.
    expect(appliedBani).toBeLessThan(alternativeBani);
  });

  it('the alternative is still shown when the two readings coincide', () => {
    // No other alin. (5) cap is present, so recorded == allowed and both readings give the same
    // ceiling. The alternative must still appear: an absent figure would read as "there is no other
    // reading", which is the claim the sources do not support.
    seedWith([expense({ id: 'ceil-solo', category: 'protocol', valoareFaraTva: lei(1000), tva: lei(190) })]);
    const { container } = render(
      <StoreProvider>
        <Expenses />
      </StoreProvider>,
    );
    const text = container.textContent ?? '';
    const applied = APPLIED.exec(text);
    const alternative = ALTERNATIVE.exec(text);
    expect(applied, 'the applied ceiling must be rendered').not.toBeNull();
    expect(alternative, 'the alternative ceiling must be rendered even when it equals the applied one').not.toBeNull();
    expect(toBani(applied![2])).toBe(toBani(alternative![1]));
  });

  it('an expense with no annual ceiling struck produces no cap explanation, so the banner cannot lie', () => {
    // The seed's own expenses carry no annual ceiling. Rendering an explanation with no ceiling behind
    // it would be a fabricated disclosure.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...seedData, version: CURRENT_DATA_VERSION }),
    );
    const { container } = render(
      <StoreProvider>
        <Expenses />
      </StoreProvider>,
    );
    expect(container.textContent ?? '').not.toContain('Plafon aplicat');
  });
});
