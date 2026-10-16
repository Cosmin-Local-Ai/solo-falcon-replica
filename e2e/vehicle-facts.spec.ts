import { test, expect, type Page } from '@playwright/test';
import { fixedInstant } from '../src/test/fixedInstant';
import { seedPayload, seedBrowserOnce, type SeedPayload } from './fixtures';
import type { AppData, Expense, Vehicle } from '../src/data/types';

/**
 * PG-6c (D-VEH-1, D-VEH-2, D-VEH-3) — the vehicle facts, in a browser, from stored data.
 *
 * Every case starts from a persisted payload, never from a hand-built classification context: a fact that
 * only exists in a unit fixture has not reached the user. The clock is pinned to the shared instant as in
 * every other spec, because the coverage denominator and the period filter are date-scoped.
 *
 * What is proven here, in order:
 *
 *   1. **a profile that declares no vehicle behaves exactly as it did before PG-6c** — its vehicle cost is
 *      capped at 50 % by art. 68 alin. (7) lit. k) and the estimate stays `complete`. This is the D-VEH-1
 *      guarantee in a browser: the 50 % is the law's default, not a gap the app reports (acceptance 1, 2);
 *   2. **a car the taxpayer does not personally use is outside the one-car limit** and keeps its costs
 *      beside a designated taxpayer-used car (acceptance 4);
 *   3. **two taxpayer-used cars with one designated**: the designated one computes, the other leaves the
 *      figure, the hero says `incomplete`, and the register quotes **both** readings of what happens to the
 *      second car (acceptance 5);
 *   4. **a cost that names no declared car is refused rather than classified by another car's facts**, and
 *      the refusal says that is the app's limit, not the law's answer (acceptance 7);
 *   5. **the designation is the person's own recorded choice and survives a reload** — and nothing is
 *      pre-filled on the way there (acceptance 1).
 */

async function fixClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(fixedInstant());
}

function vehicleExpense(id: string, over: Partial<Expense> = {}): Expense {
  return {
    id,
    tip: 'factura',
    nr: `CH-VEH-${id}`,
    date: '2026-05-10',
    furnizor: 'Service Auto Test',
    cui: 'RO99999999',
    valoareFaraTva: { amount: 200000, currency: 'RON' },
    tva: { amount: 40000, currency: 'RON' },
    status: 'inregistrata',
    category: 'vehicle_related',
    ...over,
  };
}

function payloadWith(over: Partial<AppData>): SeedPayload {
  const payload = seedPayload();
  return { ...payload, ...over, expenses: [...payload.expenses, ...(over.expenses ?? [])] } as SeedPayload;
}

/** A car with the facts the person declared for 2026. Synthetic label; no real plate. */
function car(id: string, facts: Omit<Vehicle['years'][number], 'fiscalYear'>): Vehicle {
  return { id, label: `Mașina ${id}`, years: [{ ...facts, fiscalYear: 2026 }] };
}

test.describe('PG-6c — a register with no declared vehicle is untouched by the vehicle rules', () => {
  test('a vehicle cost with no car declared computes at 50 % and the estimate stays complete', async ({
    page,
  }) => {
    await seedBrowserOnce(page, payloadWith({ expenses: [vehicleExpense('veh-none')] }));
    await fixClock(page);
    await page.goto('/dashboard');

    await expect(page.locator('.badge[data-estimate-state="complete"]')).toHaveCount(1);
    await expect(page.locator('[data-estimate-coverage]')).toHaveCount(0);

    await page.goto('/expenses');
    const row = page.locator('tr[data-record-id="veh-none"]');
    await expect(row.locator('[data-not-in-estimate]')).toHaveCount(0);
    await expect(page.locator('[data-vehicle-unresolved]')).toHaveCount(0);
  });
});

test.describe('PG-6c acceptance 4 — the limit is about who uses the car, not about the car', () => {
  test('a car the taxpayer does not use keeps its costs beside a designated taxpayer-used car', async ({
    page,
  }) => {
    await seedBrowserOnce(
      page,
      payloadWith({
        vehicles: [
          car('personal', { usedByPerson: 'da', use: 'mixed', designatedForRunningCosts: 'da' }),
          car('angajat', { usedByPerson: 'nu', use: 'mixed' }),
        ],
        expenses: [
          vehicleExpense('veh-personal', { vehicleId: 'personal' }),
          vehicleExpense('veh-angajat', { vehicleId: 'angajat' }),
        ],
      }),
    );
    await fixClock(page);
    await page.goto('/dashboard');

    // Both cars carry costs: lit. j) reaches only „autoturismele folosite de contribuabil”, so the
    // employee's car is outside the cap and nothing displaces it.
    await expect(page.locator('.badge[data-estimate-state="complete"]')).toHaveCount(1);
    await expect(page.locator('[data-estimate-coverage]')).toHaveCount(0);

    await page.goto('/expenses');
    await expect(page.locator('tr[data-record-id="veh-personal"] [data-not-in-estimate]')).toHaveCount(0);
    await expect(page.locator('tr[data-record-id="veh-angajat"] [data-not-in-estimate]')).toHaveCount(0);
    await expect(page.locator('tr[data-record-id="veh-angajat"] [data-expense-vehicle]')).toHaveText(
      'Vehicul: Mașina angajat',
    );
  });
});

test.describe('PG-6c acceptance 5 — two taxpayer-used cars: one designated, the other unsettled', () => {
  test('the designated car computes, the other leaves the figure, and both readings are quoted', async ({
    page,
  }) => {
    await seedBrowserOnce(
      page,
      payloadWith({
        vehicles: [
          car('aleasa', { usedByPerson: 'da', use: 'mixed', designatedForRunningCosts: 'da' }),
          car('cealalta', { usedByPerson: 'da', use: 'mixed' }),
        ],
        expenses: [
          vehicleExpense('veh-aleasa', { vehicleId: 'aleasa' }),
          vehicleExpense('veh-cealalta', { vehicleId: 'cealalta' }),
        ],
      }),
    );
    await fixClock(page);
    await page.goto('/dashboard');

    // The second car's costs are not settled, so the hero may not say „Calculat”.
    await expect(page.locator('.badge[data-estimate-state="incomplete"]')).toHaveCount(1);
    await expect(page.locator('[data-coverage-reason="undetermined"]')).toHaveCount(1);

    await page.goto('/expenses');
    await expect(page.locator('tr[data-record-id="veh-aleasa"] [data-not-in-estimate]')).toHaveCount(0);
    await expect(page.locator('tr[data-record-id="veh-cealalta"] [data-not-in-estimate]')).toHaveCount(1);

    const detail = page.locator('[data-vehicle-unresolved-detail]');
    await expect(detail).toBeVisible();
    // Both readings, verbatim — the designated car must never make the other one look settled.
    await expect(detail).toContainText('CITEȘTE A');
    await expect(detail).toContainText('sumele sau bunurile utilizate de contribuabil pentru uzul personal');
    await expect(detail).toContainText('CITEȘTE B');
    await expect(detail).toContainText('conform art. 68 alin. (4) și (5)');
    await expect(detail).toContainText('cel mult un singur autoturism aferent fiecărei persoane');
  });

  test('with no designation neither car is picked, and both leave the figure', async ({ page }) => {
    await seedBrowserOnce(
      page,
      payloadWith({
        vehicles: [
          car('v1', { usedByPerson: 'da', use: 'mixed' }),
          car('v2', { usedByPerson: 'da', use: 'mixed' }),
        ],
        expenses: [vehicleExpense('veh-x', { vehicleId: 'v1' }), vehicleExpense('veh-y', { vehicleId: 'v2' })],
      }),
    );
    await fixClock(page);
    await page.goto('/expenses');
    await expect(page.locator('tr[data-record-id="veh-x"] [data-not-in-estimate]')).toHaveCount(1);
    await expect(page.locator('tr[data-record-id="veh-y"] [data-not-in-estimate]')).toHaveCount(1);
    await expect(page.locator('[data-vehicle-unresolved]')).toContainText('2');
  });
});

test.describe('PG-6c acceptance 7 — an unattributable vehicle cost is refused, not guessed', () => {
  test('a vehicle cost naming no declared car leaves the figure and says the app, not the law, is limited', async ({
    page,
  }) => {
    await seedBrowserOnce(
      page,
      payloadWith({
        vehicles: [car('v1', { usedByPerson: 'da', use: 'exclusive' })],
        expenses: [vehicleExpense('veh-orfan')],
      }),
    );
    await fixClock(page);
    await page.goto('/expenses');
    await expect(page.locator('tr[data-record-id="veh-orfan"] [data-not-in-estimate]')).toHaveCount(1);
    const detail = page.locator('[data-vehicle-unresolved-detail]');
    await expect(detail).toContainText('nu este atribuită niciunui vehicul');
    await expect(detail).toContainText('Aceasta este o limită a aplicației, nu un răspuns al legii');
    await expect(detail).toContainText('legea rămâne la 50 %');
  });
});

test.describe('PG-6c acceptance 1 — nothing is pre-filled, and the designation is the person’s', () => {
  test('declaring a car in Settings writes no fact, and a designation survives a reload', async ({ page }) => {
    await seedBrowserOnce(page, payloadWith({ expenses: [vehicleExpense('veh-form')] }));
    await fixClock(page);
    await page.goto('/settings#!/fiscal');

    await expect(page.locator('[data-vehicle-block]')).toBeVisible();
    await expect(page.locator('[data-vehicle-row]')).toHaveCount(0);

    await page.locator('[data-vehicle-label]').fill('Logan de test');
    await page.locator('[data-vehicle-add]').click();
    await expect(page.locator('[data-vehicle-row]')).toHaveCount(1);

    // Every control starts empty: a default here would be a legal assertion, not a convenience.
    await expect(page.locator('[data-vehicle-used-by-person]')).toHaveValue('');
    await expect(page.locator('[data-vehicle-use]')).toHaveValue('');
    await expect(page.locator('[data-vehicle-designation]')).toHaveValue('');

    // D-VEH-1's visible half, next to the fact it explains.
    await expect(page.locator('[data-vehicle-use-default]')).toContainText('50 %');

    await page.locator('[data-vehicle-used-by-person]').selectOption('da');
    await page.locator('[data-vehicle-use]').selectOption('unknown');
    await page.locator('[data-vehicle-designation]').selectOption('da');

    await page.reload();
    await page.goto('/settings#!/fiscal');
    await expect(page.locator('[data-vehicle-designation]')).toHaveValue('da');
    await expect(page.locator('[data-vehicle-use]')).toHaveValue('unknown');

    // The cost is now attributed through the register form, and it computes at the statutory 50 %.
    await page.goto('/expenses');
    await page.getByRole('button', { name: /Adaugă cheltuială/ }).click();
    await page.locator('[data-vehicle-select]').selectOption({ index: 1 });
    await page.getByPlaceholder('FCT-09-112043').fill('CH-VEH-FORM');
    await page.getByPlaceholder('SC … SA').fill('Service Auto Test');
    const amounts = page.locator('input[placeholder="0,00"]');
    await amounts.nth(0).fill('2000');
    await amounts.nth(1).fill('400');
    await page.getByRole('button', { name: 'Adaugă', exact: true }).click();

    const stored = await page.evaluate(
      key => JSON.parse(localStorage.getItem(key) ?? '{}') as { expenses: Expense[] },
      'pfa-app-data-v2',
    );
    const created = stored.expenses.find(e => e.nr === 'CH-VEH-FORM');
    expect(created?.vehicleId).toBeDefined();
    // The category select is not defaulted either — an attributed cost with no category is refused as
    // uncategorised, which is the honest state of a form nobody answered.
    expect('category' in (created ?? {})).toBe(false);
  });
});
