import { expect, test } from '@playwright/test';
import { estimateBadge, coverageRow, estimateLine, loadPersona, taxHero } from './persona-harness';

/**
 * Persona 12 — **cabinet de fizioterapie** (CAEN 8695): secțiunea R (sănătate), through the ambulatory clase
 * a PFA can hold.
 *
 * ## The pair this spec pins
 *
 * Two contribution-shaped expenses, two different outcomes, and the difference is in the rule rather than in
 * the data:
 *
 * - **voluntary health insurance** (art. 68 alin. (5) lit. h)) is capped at a **euro** amount, so the
 *   ceiling cannot be struck while the conversion rule is contested — the ten premium rows leave the base as
 *   `cap_unresolved`, even though the category is found and the express exception to art. 68 alin. (7)
 *   lit. d) is applied;
 * - the **coleg contribution** (lit. q)) is capped at **5 % of gross**, a lei base, so the assembler strikes
 *   it and — being inside it — admits the whole 1.200 lei.
 *
 * ## The figures, at the pinned instant
 *
 * 227.500,00 lei gross − 50.400,00 deductible = 177.100,00 net. CAS 24.300 + CASS 17.710 + impozit
 * 13.509 = **55.519,00 lei**.
 */
test.describe('persona 12 — cabinet de fizioterapie: două plafoane, două soarte', () => {
  test('the cockpit computes, and the total is this persona’s own figure', async ({ page }) => {
    await loadPersona(page, 'physiotherapist');
    // Incomplete, not complete: the euro premium ceiling could not be struck, and the app says so instead of
    // deducting the premiums at a rate it invented.
    await expect(estimateBadge(page, 'incomplete')).toHaveCount(1);
    await expect(taxHero(page)).toHaveText('55.519,00 RON');
  });

  test('the euro premium leaves the base; the lei-capped coleg contribution stays in it', async ({ page }) => {
    await loadPersona(page, 'physiotherapist');
    await expect(coverageRow(page, 'cap_unresolved')).toBeVisible();
    // 35.000 chirie + 9.000 consumabile + 5.200 amortizare + 1.200 contribuție profesională admisă integral.
    // If the euro premiums were ever deducted at a guessed rate, this figure moves and the spec notices.
    await expect(await estimateLine(page, 'Cheltuieli deductibile')).toContainText('50.400,00');
  });

  test('a cabinet with no car says so, instead of carrying a car for symmetry', async ({ page }) => {
    await loadPersona(page, 'physiotherapist');
    await page.goto('/settings#!/fiscal');
    // The vehicle block is there, and it is empty: `vehicles: []` is a real state of this register, not a
    // completion the demo forgot. The 50 % default of art. 68 alin. (7) lit. k) never fires, because there
    // is no cost to attribute.
    await expect(page.locator('[data-vehicle-block]')).toBeVisible();
    await expect(page.locator('[data-vehicle-row]')).toHaveCount(0);
  });
});
