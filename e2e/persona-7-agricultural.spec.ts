import { expect, test } from '@playwright/test';
import { estimateBadge, estimateLine, loadPersona, taxHero } from './persona-harness';

/**
 * Persona 7 — **agricultural producer, pensioner**: the calendar, and the exemption that removes a question.
 *
 * ## The seasonality is the point
 *
 * A January of 4.000 lei and an August of 32.000 lei. Twelve identical months would make the chart a
 * decoration, and the CASS ladder is an **annual** test, so the shape of the year is what makes the rung
 * mean anything.
 *
 * ## art. 150 alin. (1) is a status, not an arithmetic
 *
 * A pensioner owes no CAS at all. The two CAS rows therefore come back **not applicable**, with the
 * provision named — not as a zero that looks like a computation. That distinction is the whole difference
 * between an app that calculated and an app that knows the question does not arise, and it is what the
 * `data-applicability` attribute on the row exists for.
 *
 * ## The normă question this persona does not answer
 *
 * Its farming is the PFA's own independent activity, determined in sistem real, so its CASS limb is
 * art. 155 alin. (1) **lit. b)** and art. 83 alin. (1) keeps the same money out of the ladder. The normă
 * measurement belongs to persona 9; running it here too would represent one income twice.
 */
test.describe('persona 7 — agricultural producer, pensioner', () => {
  test('the year computes on a real calendar', async ({ page }) => {
    await loadPersona(page, 'agricultural-producer');
    await expect(estimateBadge(page, 'complete')).toHaveCount(1);
    // 176.000,00 gross − 29.600,00 deductible = 146.400,00 net; CAS 0 (art. 150 alin. (1)) + CASS 14.640
    // + impozit 13.176 = 27.816,00 lei.
    await expect(taxHero(page)).toHaveText('27.816,00 RON');
  });

  test('the CAS rows are not applicable, and the row names the provision rather than showing a computed zero', async ({ page }) => {
    await loadPersona(page, 'agricultural-producer');
    const rows = page.locator('.threshold-row[data-applicability="not_applicable"]');
    await expect(rows.first()).toBeVisible();
    // The inapplicable row states why it does not apply and stops there: no consequence, no breach. The
    // exception in the law removed the question.
    await expect(rows.first()).toContainText('art. 150');
  });

  test('CASS on the sistem-real net is still owed — the exemption reaches CAS, not everything', async ({ page }) => {
    await loadPersona(page, 'agricultural-producer');
    await expect(await estimateLine(page, 'CASS (10%)')).toBeVisible();
  });

  test('the buyers are the local market, and there is no foreign counterparty padding the activity', async ({ page }) => {
    await loadPersona(page, 'agricultural-producer');
    await page.goto('/clients');
    await expect(page.getByText('Depozitul Fructus SRL').first()).toBeVisible();
    await expect(page.getByText('Cooperativa Ardeal Verde').first()).toBeVisible();
  });
});
