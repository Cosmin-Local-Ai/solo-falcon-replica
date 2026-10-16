import { expect, test } from '@playwright/test';
import { coverageRow, estimateLine, loadPersona } from './persona-harness';

/**
 * B-137 (D-FX-6) — the euro ceiling in the year the user is actually standing in.
 *
 * Persona 11's forty-hundred-euro private-pension ceiling (art. 68 alin. (5) lit. g)) cannot be converted
 * in FY2026, because BNR publishes the year's average only after the year closes. D-FX-6 kept the annual
 * average as the single primary basis and sent the open year through the **existing** provisional → final
 * lifecycle: a person records the average, it is held as provisional, and it is replaced when BNR's figure
 * arrives. Nothing is derived — the app is forbidden from making an annual average out of the daily rates it
 * already holds, and persona 11 holds twelve of them.
 *
 * ## Why this spec exists next to the unit tests
 *
 * `Expenses.euroCap.test.tsx` proves the surface renders. This proves the **door** works in a browser: the
 * annual-average option in the rate form is reachable, an unclosed year is forced provisional by the form
 * rather than by the entrant remembering, and the figure that comes out the other side moves the estimate.
 * Before B-137 no e2e touched the annual-average path at all — only `daily_reference` — which is how a
 * lifecycle can be fully implemented and still unreachable.
 *
 * ## The arithmetic, at the pinned instant (2026-10-31T12:00 local)
 *
 * Ten of the twelve 300-lei contributions are inside the as-of window: 3.000,00 lei claimed. The ceiling is
 * 400 EUR × 5,3100 = **2.124,00 lei**, so 2.124,00 enters the deductible total and 876,00 does not. The
 * total moves from 25.000,00 to **27.124,00** — the first time this persona's pension rows contribute
 * anything, and they contribute only because a person supplied a rate.
 */
test.describe('B-137 — un plafon în euro într-un an încă deschis', () => {
  test('the refusal is on screen first, and it says what the app declines to do', async ({ page }) => {
    await loadPersona(page, 'music-teacher');

    await expect(coverageRow(page, 'cap_unresolved')).toBeVisible();
    await page.goto('/expenses');
    await expect(page.getByText(/un plafon legal care nu poate fi măsurat/)).toBeVisible();
    // The honest refusal, made legible: this register holds twelve EUR daily rates for 2026 and the ceiling
    // still will not strike. That has to read as a decision, not as a missing datum.
    await expect(page.getByText(/deține 12 cursuri zilnice pentru acest an și tot nu face o medie anuală/)).toBeVisible();
    // And the next step is named, which it was not before B-137.
    await expect(page.getByText(/Media anuală a anului plății se poate înregistra manual/)).toBeVisible();
  });

  test('recording a provisional annual average strikes the ceiling, and the five-point note is beside it', async ({ page }) => {
    await loadPersona(page, 'music-teacher');

    await page.goto('/settings#!/fiscal');
    await page.locator('[name="fx-kind"]').selectOption('annual_average');
    await page.locator('[name="fx-year"]').fill('2026');
    await page.locator('[name="fx-rate"]').fill('5.3100');
    // The form, not the entrant, decides this: an average for a year that has not closed cannot be final.
    await expect(page.locator('[name="fx-provisional"]')).toBeDisabled();
    await page.getByRole('button', { name: 'Înregistrează cursul' }).click();
    await expect(page.locator('[data-fx-entry-saved]')).toBeVisible();

    await page.goto('/expenses');
    await expect(page.getByText(/Plafonul în euro, convertit/)).toBeVisible();
    await expect(page.getByText('2.124,00 RON')).toBeVisible();
    await expect(page.getByText(/Provizoriu/)).toBeVisible();
    // The rival reading stays visible rather than being replaced by the one the app applied. Persona 11 pays
    // twelve monthly instalments, so that reading cannot be struck at all — and the banner says why.
    await expect(page.getByText(/cealaltă citire, cursul BNR de la data plății:/)).toBeVisible();

    // The five answers, asserted on the rendered Romanian, not on a class name.
    await expect(page.getByText(/Plafonul este scris în euro în textul legii/)).toBeVisible();
    await expect(page.getByText(/BNR publică acea medie abia după ce anul se încheie/)).toBeVisible();
    await expect(page.getByText(/cere un alt curs, cel de la data plății/)).toBeVisible();
    // Point 4 — the one that informs rather than alarms.
    await expect(page.getByText(/se depune abia în 2027, după publicare/)).toBeVisible();
    await expect(page.getByText(/nu ajunge niciodată la ANAF/)).toBeVisible();
    // Point 5 — where the number came from.
    await expect(page.getByText(/Aplicația nu și-a calculat singură această medie/)).toBeVisible();
    await expect(page.getByText(/introdus manual, înregistrată la 31\.10\.2026/)).toBeVisible();

    // The ceiling's own line names the record behind it, and the estimate moves with it.
    await expect(page.getByText(/serie BNR CURSA_EURM · introdus manual la 31\.10\.2026/)).toBeVisible();

    // The cockpit is where the estimate and the coverage rows live.
    await page.goto('/dashboard');
    await expect(await estimateLine(page, 'Cheltuieli deductibile')).toContainText('27.124,00');
    await expect(coverageRow(page, 'cap_unresolved')).toHaveCount(0);
  });

  test('the same anchor entered again replaces the rate instead of adding a second one', async ({ page }) => {
    await loadPersona(page, 'music-teacher');
    await page.goto('/settings#!/fiscal');

    const record = async (rate: string) => {
      await page.locator('[name="fx-kind"]').selectOption('annual_average');
      await page.locator('[name="fx-year"]').fill('2026');
      await page.locator('[name="fx-rate"]').fill(rate);
      await page.getByRole('button', { name: 'Înregistrează cursul' }).click();
      await expect(page.locator('[data-fx-entry-saved]')).toBeVisible();
    };

    await record('5.3100');
    await record('5.4000');

    // One record for one anchor — the upsert the provisional → final lifecycle depends on.
    const stored = await page.evaluate(() =>
      (JSON.parse(localStorage.getItem('pfa-app-data-v2') ?? '{}').fxRates ?? [])
        .filter((r: { rateKind: string; rateYear?: number }) => r.rateKind === 'annual_average' && r.rateYear === 2026),
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ rate: '5.4000', provisional: true });

    // 400 EUR × 5,4000 = 2.160,00 lei, and the ceiling on screen is the replaced one.
    await page.goto('/expenses');
    await expect(page.getByText('2.160,00 RON')).toBeVisible();
  });
});
