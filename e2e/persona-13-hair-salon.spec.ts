import { expect, test } from '@playwright/test';
import { estimateBadge, coverageRow, estimateLine, loadPersona, taxHero } from './persona-harness';

/**
 * Persona 13 — **salon de coafură și înfrumusețare** (CAEN 9621): secțiunea T (alte activități de servicii),
 * through the personal-service clase — the members' organisations in the same secțiune stay out by verdict.
 *
 * ## The date gate, shown as two different answers
 *
 * The register holds eleven identical 200-lei PEPP contributions. The January one and the ten from March
 * onwards do **not** come out the same way, and the screen shows the difference:
 *
 * - January: no rule in force covers the category (art. 68 alin. (5) lit. g^2) applies to contributions paid
 *   **from 1 martie 2026**), and art. 68 alin. (7) lit. l) is an open clause — `undetermined`;
 * - March onwards: classified under the PEPP rule, then held out because the 400-euro ceiling cannot be
 *   converted — `cap_unresolved`.
 *
 * The cap this profile *can* strike is protocol: a percentage of a lei base. 4.000 lei recorded by 31
 * October, 2.290 lei admitted (2 % of the art. 68 alin. (6) base), 1.710 lei lost.
 *
 * ## The figures, at the pinned instant
 *
 * 177.500,00 lei gross − 72.890,00 deductible = 104.610,00 net. CAS 24.300 + CASS 10.461 + impozit 6.985 =
 * **41.746,00 lei**.
 */
test.describe('persona 13 — salon: poarta de date de 1 martie și plafonul de protocol', () => {
  test('the cockpit computes, and the total is this persona’s own figure', async ({ page }) => {
    await loadPersona(page, 'hair-salon');
    // Incomplete by design: the January PEPP row has no rule in force and the March rows have an unstriking
    // euro ceiling. Both are on the coverage list, and the badge reflects that.
    await expect(estimateBadge(page, 'incomplete')).toHaveCount(1);
    await expect(taxHero(page)).toHaveText('41.746,00 RON');
  });

  test('the January contribution and the March ones are reported differently', async ({ page }) => {
    await loadPersona(page, 'hair-salon');
    await expect(coverageRow(page, 'undetermined')).toBeVisible();
    await expect(coverageRow(page, 'cap_unresolved')).toBeVisible();
  });

  test('the protocol ceiling cuts, and the deductible total carries the cut', async ({ page }) => {
    await loadPersona(page, 'hair-salon');
    // 40.000 chirie + 14.000 cosmetice + 9.000 energie + 7.600 amortizare + 2.290 protocol admis din 4.000.
    await expect(await estimateLine(page, 'Cheltuieli deductibile')).toContainText('72.890,00');
  });
});
