import { expect, test } from '@playwright/test';
import { estimateBadge, coverageRow, estimateLine, loadPersona, taxHero } from './persona-harness';

/**
 * Persona 11 — **profesoară de muzică** (CAEN 8552): the persona that puts secțiunea Q (învățământ) on
 * screen, through the non-formal clase a PFA can actually run.
 *
 * ## What this spec is for
 *
 * The showcase is not the total — it is the two rows the app **refuses** to deduct, and says why on screen:
 *
 * - the private-pension contributions, whose 400-euro ceiling cannot be converted while pct. 7 alin. (6)
 *   (BNR average for the year of payment) and CF art. 9 alin. (3) lit. b) (rate at the payment date) point
 *   different ways — `cap_unresolved`;
 * - the home-office utilities, where art. 68 alin. (5) lit. i) allows „partea aferentă activității" and
 *   supplies no method for the share — `undetermined`.
 *
 * A demo that quietly deducted either one would turn a known open question into an invisible one.
 *
 * ## The figures, at the pinned instant
 *
 * 153.750,00 lei gross (the EUR course sales included, converted through the rates the register holds) −
 * 25.000,00 deductible = 128.750,00 net. CAS 24.300 + CASS 12.875 + impozit 9.157 = **46.332,00 lei**.
 */
test.describe('persona 11 — profesoară de muzică: plafonul în euro care nu se poate lovi', () => {
  test('the cockpit computes, and the total is this persona’s own figure', async ({ page }) => {
    await loadPersona(page, 'music-teacher');
    // Honest state: the estimate is computed but marked incomplete, because the app refused to
    // convert the euro ceiling and refused to invent a home-office share. A 'complete' badge here would mean
    // it had guessed.
    await expect(estimateBadge(page, 'incomplete')).toHaveCount(1);
    await expect(taxHero(page)).toHaveText('46.332,00 RON');
  });

  test('the euro ceiling and the home-office split both surface as coverage rows, not as deductions', async ({ page }) => {
    await loadPersona(page, 'music-teacher');
    // The ten pension contributions: classified, then held out of the base with the conflict quoted.
    await expect(coverageRow(page, 'cap_unresolved')).toBeVisible();
    // The two shared-cost rows: the law allows a share and gives no way to compute one.
    await expect(coverageRow(page, 'undetermined')).toBeVisible();
    // Which is why the deductible total is only the rent, the tuning and the phone.
    await expect(await estimateLine(page, 'Cheltuieli deductibile')).toContainText('25.000,00');
  });

  test('the registered object is non-formal teaching, not a school', async ({ page }) => {
    await loadPersona(page, 'music-teacher');
    await page.goto('/settings#!/fiscal');
    await expect(page.locator('input[data-caen-input="0"]')).toHaveValue(/8552/);
    // 8510 / 8520 / 8531-8533 / 8540 are the school clase and stay out of this persona by verdict.
    await expect(page.locator('input[data-caen-input="1"]')).toHaveValue(/85(59|69)/);
  });
});
