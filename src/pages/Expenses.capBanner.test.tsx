/**
 * TASK 2c acceptance — a cap the app cannot measure must be named on screen, not silently dropped.
 *
 * The expense stays out of the deductible total (that is the domain behaviour, pinned in
 * `estimateBasis.deductibility.test.ts`); what THIS test pins is that the residue reaches the user,
 * with the rule's own words for the missing datum. Without it the exclusion would be invisible and the
 * deductible total would read as if the law simply did not allow the expense.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Expenses from './Expenses';
import { StoreProvider } from '../data/store';
import { CURRENT_DATA_VERSION } from '../data/migration';
import { seedData } from '../data/seed';
import type { Expense } from '../data/types';
import { lei, ron } from '../domain/money';

const STORAGE_KEY = 'pfa-app-data-v2';

function seedWith(expenses: Expense[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...seedData, expenses: [...seedData.expenses, ...expenses], version: CURRENT_DATA_VERSION }),
  );
}

function expense(over: Partial<Expense>): Expense {
  return {
    id: over.id ?? 'cap-exp',
    tip: 'factura',
    nr: 'FCT-CAP-1',
    date: '2026-05-10',
    furnizor: 'Furnizor Test',
    cui: 'RO99999999',
    valoareFaraTva: ron(2000),
    tva: ron(400),
    status: 'inregistrata',
    ...over,
  };
}

describe('Expenses — an unmeasurable statutory cap is named, not dropped', () => {
  beforeEach(() => localStorage.clear());

  it('a euro-capped expense is excluded and the banner names the missing datum and the rule', () => {
    seedWith([expense({ category: 'voluntary_health_insurance' })]);
    render(
      <StoreProvider>
        <Expenses />
      </StoreProvider>,
    );

    expect(
      screen.getByText(/un plafon legal care nu poate fi măsurat din datele înregistrate/),
    ).toBeInTheDocument();
    // The detail is the RULE's own sentence: the datum (no BNR rate stored) and the rule that would
    // supply it (Normele pct. 7 alin. (6)) plus the conflicting one (art. 9) — never a bare "not implemented".
    //
    // B-138 RE-PIN. This query used to locate the node with `/annual_eur_per_person/`, i.e. the test found
    // the sentence by finding the machine enum on screen — it pinned the leak as the way to reach the copy.
    // The node is now found by the Romanian wording a person actually reads, and the enum is asserted
    // ABSENT, which is the half the old test could not assert.
    const detail = screen.getByText(/plafon anual exprimat în euro pe persoană/).textContent ?? '';
    expect(detail).toContain('nu stochează niciun curs BNR');
    expect(detail).toContain('pct. 7 alin. (6)');
    expect(detail).toContain('art. 9 alin. (3) lit. b)');
    expect(detail).not.toContain('annual_eur_per_person');
  });

  it('cheltuieli sociale is named as an absent datum, never as a zero ceiling', () => {
    seedWith([expense({ id: 'cap-social', category: 'social_expenses', valoareFaraTva: ron(500), tva: ron(100) })]);
    render(
      <StoreProvider>
        <Expenses />
      </StoreProvider>,
    );
    // B-138 RE-PIN — see the test above: the node used to be found by its enum.
    const detail = screen.getByText(/valoarea anuală a cheltuielilor cu salariile personalului/).textContent ?? '';
    expect(detail).toContain('nu are niciun concept de pontaj');
    expect(detail).toContain('nu este declarat 0');
    expect(detail).not.toContain('annual_salary_expense');
  });

  it('a protocol expense is NOT reported as unmeasurable: its ceiling is computed, so no banner lies about it', () => {
    seedWith([expense({ id: 'cap-protocol', category: 'protocol', valoareFaraTva: ron(300), tva: ron(57) })]);
    render(
      <StoreProvider>
        <Expenses />
      </StoreProvider>,
    );
    expect(screen.queryByText(/un plafon legal care nu poate fi măsurat/)).not.toBeInTheDocument();
  });
});
