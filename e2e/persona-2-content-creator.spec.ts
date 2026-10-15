import { expect, test } from '@playwright/test';
import { coverageRow, estimateBadge, estimateLine, loadPersona, taxHero } from './persona-harness';

/**
 * Persona 2 — **content creator / author**. This is the spec that closes **B-123**.
 *
 * B-123 was: *B-112 shipped four stages and 2,526 unit tests with zero demo data and zero e2e coverage.* The
 * DPI path had a rule, a calculator, a coverage reason, a register marker and a conflict detector — and no
 * test that drove any of them through a browser. A defect that survived 2,526 green tests is not fixed by
 * the 2,527th; it is fixed by the one that runs the path a user runs.
 *
 * So this spec walks the DPI path end to end: the receipts are in the register and say what article they
 * belong to; the estimate says out loud that it does not cover them and quotes the quota the rule declares;
 * and the art. 67 half of the same person's year is still computed, so the honest gap does not swallow the
 * figure that is real.
 */
test.describe('persona 2 — content creator (B-123: the DPI path in a browser)', () => {
  test('the register shows the art. 70 receipts as art. 70, not as ordinary activity income', async ({ page }) => {
    await loadPersona(page, 'content-creator');
    // Deep-linked onto one record rather than scraped off page one of a paginated register: the link is the
    // route the coverage row itself offers, so this also proves the deep link lands and marks the row.
    await page.goto('/revenues#!/registered?f=FON-1');
    const row = page.locator('tr[data-record-id="FON-1"]');
    await expect(row).toHaveClass(/row-focus/);
    await expect(row).toContainText('art. 70 · DPI');
    await expect(row).toContainText('Fonoteca Virtuală SRL');
  });

  test('the hero refuses to call itself complete while DPI sits outside the figure', async ({ page }) => {
    await loadPersona(page, 'content-creator');
    // PG-1's gate: the badge may say „Calculat” only when every recorded record is in the figure or
    // visibly, deliberately kept out of it. Persona 2's DPI receipts are the second thing.
    await expect(estimateBadge(page, 'incomplete')).toHaveCount(1);
    await expect(page.locator('[data-coverage-count]').first()).toBeVisible();
  });

  test('the coverage row names the DPI cause and counts the records it leaves out', async ({ page }) => {
    await loadPersona(page, 'content-creator');
    const row = coverageRow(page, 'dpi_income_not_modelled');
    await expect(row).toBeVisible();
    // Fifteen art. 70 receipts across the year, all of them outside the figure, all of them named as one
    // group rather than silently summed away.
    await expect(row).toContainText('15 înregistrări');
    await expect(row).toContainText('neincluși în estimare');
  });

  test('the art. 67 half is still computed, and the total is the persona’s own figure', async ({ page }) => {
    await loadPersona(page, 'content-creator');
    // 109.000,00 lei gross (art. 67 only) − 4.800,00 deductible = 104.200,00 net; CAS 24.300 on the 24-smn
    // rung + CASS 10.420 + impozit 6.948 = 41.668,00 lei.
    await expect(taxHero(page)).toHaveText('41.668,00 RON');
    await expect(await estimateLine(page, 'Venit brut')).toBeVisible();
  });
});
