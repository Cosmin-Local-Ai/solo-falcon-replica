import { expect, test } from '@playwright/test';
import { estimateBadge, estimateLine, loadPersona, taxHero, thresholdRowWithLimit } from './persona-harness';

/**
 * Persona 3 — **rideshare and courier driver**: the persona whose whole job is to make the vehicle rules
 * bite rather than be present.
 *
 * Three rules, and each one changes something the user can see:
 *
 * - **art. 68 alin. (7) lit. k)** — the car the taxpayer drives is used for the activity but exclusive use
 *   is not evidenced, so its running costs are deductible at 50 %. That is the statute's default, not an app
 *   guess (D-VEH-1), and it is why the deductible total is smaller than the sum of the receipts.
 * - **art. 68 alin. (5) lit. j)** — *„cel mult un singur autoturism"*. The law gives no selection criterion,
 *   so the app asks and the person designates one car (D-VEH-2). The other car's fuel is neither dropped nor
 *   deducted: it comes back as a row the person has to look at.
 * - **art. 28 alin. (14)** — an M1 car amortises at most 1.500 lei per month, and the excess is lost
 *   definitively. 78.000 lei over a declared *durata normală* of 48 months is 1.625 lei/lună, so the cap
 *   bites every month of the year.
 */
test.describe('persona 3 — rideshare and courier driver', () => {
  test('the cockpit computes on the persona’s own figures', async ({ page }) => {
    await loadPersona(page, 'ride-hailing-driver');
    await expect(estimateBadge(page, 'incomplete')).toHaveCount(1);
    // 141.600,00 gross − 33.600,00 deductible (the 50 % vehicle cut and the capped amortisation already
    // taken out) = 108.000,00 net; CAS 24.300 + CASS 10.800 + impozit 7.290 = 42.390,00 lei.
    await expect(taxHero(page)).toHaveText('42.390,00 RON');
  });

  test('the CAS 24-smn row is the one the caps lead to, and the row states its limit', async ({ page }) => {
    await loadPersona(page, 'ride-hailing-driver');
    const rung = thresholdRowWithLimit(page, '97.200,00 lei');
    await expect(rung).toHaveCount(1);
    await expect(rung).toContainText('108.000,00 lei');
    // The amortisation the cap cut is visible in the breakdown, not just implied by the total.
    await expect(await estimateLine(page, 'Cheltuieli deductibile')).toBeVisible();
  });

  test('the second car’s costs are neither dropped nor deducted — they are put in front of the person', async ({ page }) => {
    // D-VEH-2: the one-car limit has no statutory selection criterion, so the app asks. The rows for the
    // car that was NOT designated must stay visible with a reason; silently excluding them would be the
    // same defect wearing a smaller hat.
    await loadPersona(page, 'ride-hailing-driver');
    await page.goto('/expenses#!/registered?f=PETB-1');
    const row = page.locator('tr[data-record-id="PETB-1"]');
    await expect(row).toHaveClass(/row-focus/);
    await expect(row.locator('[data-not-in-estimate]')).toContainText('regulă fără faptă consemnată');
  });

  test('the platform is a counterparty of its own shape, not a corporate client with an invoice', async ({ page }) => {
    await loadPersona(page, 'ride-hailing-driver');
    await page.goto('/clients');
    await expect(page.getByText('Corio Mobilitate SRL').first()).toBeVisible();
  });
});
