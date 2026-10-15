import { expect, test } from '@playwright/test';
import { estimateBadge, estimateLine, loadPersona, taxHero, thresholdRowWithLimit } from './persona-harness';

/**
 * Persona 10 — **construction finishes** (CAEN 4334): the first persona in secțiunea F.
 *
 * ## Why this spec exists
 *
 * B-131 added six personas for the secțiuni that had none. A persona that only exists in a unit test is a
 * fixture, not a demo: the coverage gap was a *product* gap, so the closure has to be visible in the browser
 * too. This spec walks the two things the persona was built to show — the CAS 24-smn rung reached *after*
 * the protocol ceiling, and a van whose running costs are not halved.
 *
 * ## The figures, at the pinned instant (31 October 2026)
 *
 * 292.100,00 lei gross − 164.458,00 deductible = 127.642,00 net. CAS 24.300 + CASS 12.764 + impozit 9.058 =
 * **46.122,00 lei**. The deductible figure is the interesting one: it is 164.900 lei of recorded cost minus
 * the 442 lei of protocol the 2 % ceiling of art. 68 alin. (5) refuses.
 */
test.describe('persona 10 — meseriaș de finisaje: tavanul de protocol și duba la 100 %', () => {
  test('the cockpit computes, and the total is this persona’s own figure', async ({ page }) => {
    await loadPersona(page, 'construction-finisher');
    await expect(estimateBadge(page, 'complete')).toHaveCount(1);
    await expect(taxHero(page)).toHaveText('46.122,00 RON');
  });

  test('the CAS rung is engaged, and the deductible total already carries the protocol cut', async ({ page }) => {
    await loadPersona(page, 'construction-finisher');
    const rung = thresholdRowWithLimit(page, '97.200,00 lei');
    await expect(rung).toHaveCount(1);
    await expect(rung).toContainText('127.642,00 lei');
    // 119.000 de materiale și subcontract + 20.000 chirie + 10.200 dubă (întregi, nu la 50 %) + 12.400
    // amortizare + 2.858 protocol admis din 3.300 înregistrați = 164.458,00.
    await expect(await estimateLine(page, 'Cheltuieli deductibile')).toContainText('164.458,00');
  });

  test('the registered object is the finishes class, with the other finish classes beside it', async ({ page }) => {
    await loadPersona(page, 'construction-finisher');
    await page.goto('/settings#!/fiscal');
    await expect(page.locator('input[data-caen-input="0"]')).toHaveValue(/4334/);
    await expect(page.locator('input[data-caen-input="1"]')).toHaveValue(/433[1235]/);
  });
});
