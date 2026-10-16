import { test, expect, type Page } from '@playwright/test';
import { fixedInstant } from '../src/test/fixedInstant';
import { seedBrowser, seedPayload, type SeedPayload } from './fixtures';
import type { AppData, Expense, Revenue } from '../src/data/types';
import { eur, ron, type Bani } from '../src/domain/money';

/**
 * PG-1 — the estimate says what it does not cover, in the browser.
 *
 * The gate: **the hero may say „Calculat” only when every recorded record is either in the figure or
 * visibly, deliberately kept out of it.** Before PG-1 the badge stayed green while records were dropped,
 * and the completeness card counted the fact that a calculation had run rather than what it covered.
 *
 * Each case is run to the end of its own chain — badge → reason row → deep link → the register row the
 * link lands on — because the defect was never the badge alone. A warning nobody can act on is the same
 * defect wearing a different colour.
 *
 * The clock is pinned to the shared instant (`src/test/fixedInstant.ts`), the same one the unit suite and
 * the other specs use: the coverage denominator is period-scoped, so an unpinned date moves the figure.
 */

async function fixClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(fixedInstant());
}

function uncategorisedExpense(): Expense {
  return {
    id: 'pg1-uncat',
    tip: 'factura',
    nr: 'CH-PG1-001',
    date: '2026-05-10',
    furnizor: 'Furnizor Test SRL',
    cui: 'RO99999999',
    valoareFaraTva: ron(2000),
    tva: ron(400),
    status: 'inregistrata',
  };
}

function euroExpense(): Expense {
  return {
    id: 'pg1-eur-exp',
    tip: 'factura',
    nr: 'CH-PG1-002',
    date: '2026-04-15',
    furnizor: 'Furnizor EUR SRL',
    cui: 'RO99999998',
    category: 'rent_business_space',
    valoareFaraTva: eur(5000),
    tva: eur(0),
    status: 'inregistrata',
  };
}

function euroRevenue(): Revenue {
  return {
    id: 'pg1-eur-rev',
    tip: 'factura',
    nr: 'FCT-PG1-001',
    date: '2026-04-20',
    client: 'Client EUR SRL',
    cui: 'RO99999997',
    valoareFaraTva: { amount: 500000 as Bani, currency: 'EUR' },
    tva: { amount: 0 as Bani, currency: 'EUR' },
    status: 'inregistrata',
  };
}

function payloadWith(over: Partial<AppData>): SeedPayload {
  return { ...seedPayload(), ...over } as SeedPayload;
}

test.describe('PG-1 — estimate coverage on the hero and the registers', () => {
  test('a record the estimate drops turns the hero to „Estimare incompletă” with one reason row', async ({ page }) => {
    await seedBrowser(page, payloadWith({ expenses: [...seedPayload().expenses, uncategorisedExpense()] }));
    await fixClock(page);
    await page.goto('/dashboard');

    const badge = page.locator('.badge[data-estimate-state="incomplete"]');
    await expect(badge).toHaveCount(1);
    await expect(badge).toHaveText('Estimare incompletă');

    await expect(page.locator('[data-estimate-coverage]')).toBeVisible();
    await expect(page.locator('[data-coverage-reason="unclassified"]')).toContainText('fără categorie');
    await expect(page.locator('[data-coverage-count]')).toHaveAttribute('data-coverage-count', '1');

    // The completeness card is weighted now: the same profile without the record reads 100.
    await expect(page.locator('[data-amount-coverage] [data-amount-percent]')).not.toHaveAttribute(
      'data-amount-percent',
      '100',
    );
  });

  test('the reason row links onto the record, and the register lands on it with the reason on the row', async ({ page }) => {
    await seedBrowser(page, payloadWith({ expenses: [...seedPayload().expenses, uncategorisedExpense()] }));
    await fixClock(page);
    await page.goto('/dashboard');

    // Scoped to the coverage row: the attention surface already carries links with the same label, and
    // a strict-mode violation here would be the test failing for the wrong reason.
    const link = page
      .locator('[data-estimate-coverage]')
      .getByRole('link', { name: 'Deschide înregistrarea' });
    await expect(link).toHaveAttribute('href', '/expenses#!/registered?f=pg1-uncat');
    await link.click();

    await expect(page).toHaveURL(/\/expenses#!\/registered\?f=pg1-uncat/);
    const row = page.locator('tr[data-record-id="pg1-uncat"]');
    await expect(row).toBeVisible();
    // The link did not merely navigate — it landed on the row and marked it.
    await expect(row).toHaveClass(/row-focus/);
    await expect(row.locator('[data-not-in-estimate]')).toHaveText(
      'nu intră în estimare: fără categorie',
    );
  });

  test('a EUR expense and a EUR revenue with no rate are both reported, and both registers say so', async ({ page }) => {
    await seedBrowser(page, payloadWith({
      expenses: [...seedPayload().expenses, euroExpense()],
      revenues: [...seedPayload().revenues, euroRevenue()],
    }));
    await fixClock(page);
    await page.goto('/dashboard');

    await expect(page.locator('.badge[data-estimate-state="incomplete"]')).toHaveCount(1);
    const fxRow = page.locator('[data-coverage-reason="missing_fx_rate"]');
    await expect(fxRow).toContainText('fără curs BNR înregistrat');
    await expect(fxRow).toContainText('2 înregistrări');
    // The amounts are not lei figures and are not shown as if they were. Both records are EUR, so the
    // group sums — in EUR, which is the only unit the two records share.
    await expect(fxRow).toContainText('10.000,00 EUR');
    await expect(fxRow).not.toContainText('lei');

    await page.goto('/revenues');
    await expect(
      page.locator('tr[data-record-id="pg1-eur-rev"] [data-not-in-estimate]'),
    ).toHaveText('nu intră în estimare: fără curs BNR înregistrat');

    await page.goto('/expenses');
    await expect(
      page.locator('tr[data-record-id="pg1-eur-exp"] [data-not-in-estimate]'),
    ).toHaveText('nu intră în estimare: fără curs BNR înregistrat');
  });

  test('fixing the cause returns the hero to „Calculat” and clears the reason rows', async ({ page }) => {
    const fixed = { ...uncategorisedExpense(), category: 'rent_business_space' } as Expense;
    await seedBrowser(page, payloadWith({ expenses: [...seedPayload().expenses, fixed] }));
    await fixClock(page);
    await page.goto('/dashboard');

    await expect(page.locator('.badge[data-estimate-state="complete"]')).toHaveCount(1);
    await expect(page.getByText('Estimare incompletă')).toHaveCount(0);
    await expect(page.locator('[data-estimate-coverage]')).toHaveCount(0);
    await expect(page.locator('[data-amount-coverage] [data-amount-percent]')).toHaveAttribute(
      'data-amount-percent',
      '100',
    );

    await page.goto('/expenses');
    await expect(page.locator('tr[data-record-id="pg1-uncat"] [data-not-in-estimate]')).toHaveCount(0);
  });

  test('a legally non-deductible record does not make the estimate incomplete, but the row still says it is out', async ({ page }) => {
    const fine: Expense = { ...uncategorisedExpense(), id: 'pg1-fine', category: 'fine_or_penalty' };
    await seedBrowser(page, payloadWith({ expenses: [...seedPayload().expenses, fine] }));
    await fixClock(page);
    await page.goto('/dashboard');

    // The law settled this record; the hero must not claim the profile has something left to fix.
    await expect(page.locator('.badge[data-estimate-state="complete"]')).toHaveCount(1);
    await expect(page.locator('[data-estimate-coverage]')).toHaveCount(0);

    await page.goto('/expenses');
    await expect(page.locator('tr[data-record-id="pg1-fine"] [data-not-in-estimate]')).toHaveText(
      'nu intră în estimare: nu este deductibilă prin lege',
    );
  });
});
