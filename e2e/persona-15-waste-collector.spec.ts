import { expect, test } from '@playwright/test';
import { estimateBadge, estimateLine, loadPersona, taxHero } from './persona-harness';

/**
 * Persona 15 — **colectare deșeuri și recuperare materiale** (CAEN 3811): the service half of secțiunea E.
 * The water and sewerage clase, hazardous waste, incineration, landfill and decontamination stay out by
 * verdict; a one-truck salubrizare operation does not need an environmental authorisation regime to exist.
 *
 * ## What this spec pins
 *
 * - **the statutory exception category** of art. 68 alin. (7) lit. k): the truck carries `marfuri_in_scop_-
 *   comercial`, so its running costs are not halved. 26.500 lei of fuel and service enter whole, where the
 *   mixed-use default would have admitted 13.250.
 * - **the depreciation ceiling of art. 28 alin. (14) at its scope limit**: the truck is charged at 2.000 lei
 *   a month — above the 1.500-lei/lună figure — and nothing is lost, because that ceiling is stated for M1
 *   passenger cars. Persona 3's M1 car is the pair that shows it cutting.
 * - **a public authority as a client**, which is how secțiunea P stays uncovered while still appearing on
 *   screen: the town hall is a counterparty, not a profile.
 *
 * ## The figures, at the pinned instant
 *
 * 253.000,00 lei gross − 95.500,00 deductible = 157.500,00 net. CAS 24.300 + CASS 15.750 + impozit
 * 11.745 = **51.795,00 lei**.
 */
test.describe('persona 15 — colectare deșeuri: excepția de la 50 % și amortizarea fără plafon M1', () => {
  test('the cockpit computes, and the total is this persona’s own figure', async ({ page }) => {
    await loadPersona(page, 'waste-collector');
    await expect(estimateBadge(page, 'complete')).toHaveCount(1);
    await expect(taxHero(page)).toHaveText('51.795,00 RON');
  });

  test('the truck’s costs enter whole, and the depreciation is not capped', async ({ page }) => {
    await loadPersona(page, 'waste-collector');
    // 30.000 taxare la punctul de lucru + 15.000 chirie șantier + 26.500 auto (întregi) + 24.000 amortizare
    // (2.000/lună, peste plafonul de 1.500 care se aplică doar la M1) = 95.500,00.
    await expect(await estimateLine(page, 'Cheltuieli deductibile')).toContainText('95.500,00');
  });

  test('the town hall is a client, with its own cadence', async ({ page }) => {
    await loadPersona(page, 'waste-collector');
    await page.goto('/revenues');
    await expect(page.locator('tbody tr').filter({ hasText: 'Primăria Orașului Valea Carpaților' }).first()).toBeVisible();
  });
});
