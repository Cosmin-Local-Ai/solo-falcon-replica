import { expect, test } from '@playwright/test';
import { estimateBadge, loadPersona, taxHero, thresholdRowWithLimit } from './persona-harness';

/**
 * Persona 1 — **IT freelance**, walked through its own numbers in a browser.
 *
 * What this spec is for: brief 64's added acceptance — *„for each persona, a test or e2e assertion that the
 * expected threshold was crossed and the expected rung/period changed. A persona that loads without changing
 * a rung is not finished."* The unit coverage file proves the same thing against the engine; this one proves
 * it against the **screen**, because a rung the engine knows and the UI never shows is still a rung the user
 * does not have.
 *
 * Every figure below is the estimate at the pinned instant, 2026-10-31 — ten months of a twelve-month
 * register, on recorded actuals. The register carries twelve months; the estimate speaks about the ten that
 * happened, which is the D-PROJ-1 decision and not a shortfall in the data.
 *
 * The three things this persona must change, and each is asserted where the user meets it:
 * - **TVA 395.000 lei crossed** — the profile is registered, so the period is *derived* from the
 *   registration facts rather than asked for (B-96, B-100);
 * - **CAS on the 24-smn rung** — 24.300 lei, not 12.150, because the projected net clears 97.200 lei;
 * - **the CASS 72-smn ceiling** — 29.160 lei, the cap biting rather than 10 % of a 380.450-lei net.
 */
test.describe('persona 1 — IT freelance', () => {
  test('the cockpit computes, and the total is the persona’s own figure', async ({ page }) => {
    await loadPersona(page, 'it-freelance');
    await expect(estimateBadge(page, 'complete')).toHaveCount(1);
    // 410.000,00 lei gross − 29.550,00 deductible = 380.450,00 net; CAS 24.300 + CASS 29.160 + impozit
    // 32.699 = 86.159,00 lei of tax.
    await expect(taxHero(page)).toHaveText('86.159,00 RON');
  });

  test('the CASS ceiling row is the crossed one, and the row says which quantity it measured', async ({ page }) => {
    await loadPersona(page, 'it-freelance');
    const capped = thresholdRowWithLimit(page, '291.600,00 lei');
    await expect(capped).toHaveCount(1);
    await expect(capped).toContainText('380.450,00 lei');
    await expect(capped.locator('.badge')).toHaveText(/depășit|încărcat|breach/i);
  });

  test('a registered profile gets a derived fiscal period, not a question', async ({ page }) => {
    // B-96: a declared VAT *status* does not establish a *cadence*. This persona declares the exceedance
    // date, the effective date and the registration route, so art. 322 alin. (4) answers with a period and
    // the Declarații page says it was derived rather than offering a dropdown.
    await loadPersona(page, 'it-freelance');
    await page.goto('/declarations');
    await expect(page.locator('[data-testid="vat-periodicity"]')).toContainText('derivat din lege');
  });

  test('the revenue register shows the foreign clients the activity actually has', async ({ page }) => {
    await loadPersona(page, 'it-freelance');
    await page.goto('/revenues');
    await expect(page.getByText('Northwind Digital BV').first()).toBeVisible();
    await expect(page.getByText('EUR').first()).toBeVisible();
  });
});
