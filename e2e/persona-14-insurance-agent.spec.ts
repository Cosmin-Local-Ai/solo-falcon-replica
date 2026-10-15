import { expect, test } from '@playwright/test';
import { estimateBadge, coverageRow, estimateLine, loadPersona, taxHero, thresholdRowWithLimit } from './persona-harness';

/**
 * Persona 14 — **agent de asigurări** (CAEN 6622): the one clasă in secțiunea L that a Romanian PFA really
 * runs. An insurance agent is an authorised *intermediary*; the underwriting, credit, leasing and fund-management
 * clase in the same secțiune are not PFA activities and stay out by verdict.
 *
 * ## What this spec pins
 *
 * - **the 50 % default of art. 68 alin. (7) lit. k)**: the car is `mixed` and there is no *foaie de parcurs*,
 *   so 6.200 lei of fuel and service enter as 3.100 lei.
 * - **a euro ceiling that cannot be struck**: the 900-lei union dues are capped at 4.000 euro, so they leave
 *   the base as `cap_unresolved` — the opposite of persona 12's lei-capped coleg contribution.
 * - **the CASS 72-smn ceiling approached and not reached**: 282.400 lei against 291.600 lei. The row is on
 *   screen and is *not* the engaged one, which is a different demo fact from persona 1 crossing it.
 *
 * ## The figures, at the pinned instant
 *
 * 305.500,00 lei gross − 23.100,00 deductible = 282.400,00 net. CAS 24.300 + CASS 28.240 + impozit
 * 22.986 = **75.526,00 lei**.
 */
test.describe('persona 14 — agent de asigurări: mașina la 50 % și plafonul CASS nesărind', () => {
  test('the cockpit computes, and the total is this persona’s own figure', async ({ page }) => {
    await loadPersona(page, 'insurance-agent');
    // Incomplete: the euro union-dues ceiling cannot be converted, so those 900 lei sit outside the base with
    // the reason named — and the badge carries that rather than hiding it.
    await expect(estimateBadge(page, 'incomplete')).toHaveCount(1);
    await expect(taxHero(page)).toHaveText('75.526,00 RON');
  });

  test('the car is halved and the euro dues are out; the deductible total says both', async ({ page }) => {
    await loadPersona(page, 'insurance-agent');
    await expect(coverageRow(page, 'cap_unresolved')).toBeVisible();
    // 15.000 chirie + 2.000 telefonie + 3.100 auto (jumătate din 6.200) + 3.000 amortizare = 23.100,00.
    await expect(await estimateLine(page, 'Cheltuieli deductibile')).toContainText('23.100,00');
  });

  test('the 72-smn CASS ceiling is on screen and is not the engaged row', async ({ page }) => {
    await loadPersona(page, 'insurance-agent');
    const ceiling = thresholdRowWithLimit(page, '291.600,00 lei');
    await expect(ceiling).toHaveCount(1);
    await expect(ceiling).toContainText('282.400,00 lei');
    // 9.200 lei short. The row is a level being watched, not a duty triggered.
    await expect(ceiling.locator('.badge')).not.toHaveText(/depășit|breach/i);
  });
});
