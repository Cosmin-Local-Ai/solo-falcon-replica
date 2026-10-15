import { expect, test } from '@playwright/test';
import { estimateBadge, estimateLine, loadPersona, taxHero } from './persona-harness';

/**
 * Persona 9 — **small producer on normă de venit with a market stall**: the ladder's central mechanic,
 * shown once.
 *
 * ## Why this persona exists at all
 *
 * Brief 64 fixes eight, and the eight are the first eight. This one was added because the eight left the
 * art. 170 alin. (4) lit. f) choice between „venitul net **sau** norma de venit, după caz" unexercised — a
 * field no demo ever sets is a field that ships unread. It cannot be folded into persona 7: that persona's
 * farming *is* its PFA activity in sistem real, so its CASS limb is art. 155 alin. (1) **lit. b)**, and
 * running the same money through lit. f) as well would be a double representation.
 *
 * ## What the spec pins
 *
 * The declared normă is **102.000 lei**. The base the app charges is **97.200 lei** — the 24-smn rung. That
 * substitution is the single most consequential thing the ladder does, and it is the thing no other persona
 * in the set shows. The spec asserts the rung is what appears, and that the declared figure is not silently
 * used as the base instead.
 *
 * ## What it does not claim
 *
 * The normă is a figure the taxpayer **states**, from the act the SPV issues. The app does not derive it,
 * does not look it up, and ships no norm table — none has been verified in this project, so D-NORMA-2 stays
 * open as a data question while the *choice* between the two measurements is exercised.
 */
test.describe('persona 9 — normă de venit, and the rung that replaces it', () => {
  test('the stall runs sistem real and the plot runs the ladder — two CASS limbs, never one', async ({ page }) => {
    await loadPersona(page, 'agricultural-norma');
    await expect(estimateBadge(page, 'complete')).toHaveCount(1);
    // ANAF states it in terms: veniturile din activități independente nu se cumulează cu alte venituri
    // pentru determinarea CASS. Both limbs are on the screen, with their own amounts.
    await expect(await estimateLine(page, 'CASS (10%)')).toBeVisible();
    await expect(await estimateLine(page, 'CASS pe veniturile din art. 155 alin. (1) lit. c)-h)')).toBeVisible();
    // 138.200,00 gross − 44.000,00 = 94.200,00 net; CAS 12.150 + CASS 9.420 + CASS pe scară 9.720 +
    // impozit 7.263 = 38.553,00 lei.
    await expect(taxHero(page)).toHaveText('38.553,00 RON');
  });

  test('the ladder base is the rung, not the declared normă', async ({ page }) => {
    await loadPersona(page, 'agricultural-norma');
    await expect(await estimateLine(page, 'Baza de calcul CASS art. 155 alin. (1) lit. c)-h)')).toContainText('97.200,00');
    // 102.000 lei was declared; 97.200 lei is what the law charges. If the declared figure ever became the
    // base, this assertion is what notices.
    await expect(page.locator('details.estimate-breakdown tr').filter({ hasText: '102.000,00' })).toHaveCount(0);
  });

  test('the registered object is the stall, not the household plot', async ({ page }) => {
    // No 0113 / 0125 in the CAEN list: the plot is not a registered activity class, and that is the fact
    // that puts its income on art. 71 and the ladder instead of on art. 67 and the register.
    await loadPersona(page, 'agricultural-norma');
    await page.goto('/settings#!/fiscal');
    await expect(page.locator('input[data-caen-input="0"]')).toHaveValue(/4721/);
  });

  test('the stall sells to named market counterparties, twelve months of them', async ({ page }) => {
    await loadPersona(page, 'agricultural-norma');
    await page.goto('/revenues');
    await expect(page.getByText('Clienți la tarabă').first()).toBeVisible();
  });
});
