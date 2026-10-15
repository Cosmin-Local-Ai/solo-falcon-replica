import { expect, test } from '@playwright/test';
import { estimateBadge, estimateLine, loadPersona, taxHero } from './persona-harness';

/**
 * Persona 5 — **long-term landlord**: the art. 84 half of the rent pair.
 *
 * The fact that splits art. 84 from art. 84¹ is **the tenant's legal nature**, declared by the person — not
 * a CUI on a receipt and not a supplier name. art. 84 alin. (1) opens *„altele decât veniturile plătite de
 * persoane juridice sau alte entități care au obligația de a conduce evidență contabilă"*, and art. 84¹ takes
 * exactly that excluded population and gives it a withholding regime. Persona 5's tenants are individuals;
 * persona 6's tenant is a company. Same 20 % ratio, different gross measure, different FX anchor, different
 * declaration duty — and the pair is what makes the difference legible.
 *
 * ## B-122 stays visible
 *
 * Brief 64 Part D item 1: arendă and asocieri are withholding sources under art. 174¹ alin. (3) and the
 * engine does not model them. This is the persona that lands on that gap, and the spec asserts what the app
 * **does** say rather than letting the absence read as completeness: the art. 84 tax is this taxpayer's own,
 * established on the Declarația Unică — there is no „reținut de plătitor" line for this register, and that
 * is the missing half.
 */
test.describe('persona 5 — long-term landlord (art. 84)', () => {
  test('the gross is the rent for the fiscal year, whatever the moment of collection', async ({ page }) => {
    await loadPersona(page, 'long-term-landlord');
    await expect(estimateBadge(page, 'complete')).toHaveCount(1);
    await expect(
      await estimateLine(page, 'Venit brut art. 84 (chiria prevăzută în contract pentru anul fiscal, indiferent de încasare)'),
    ).toBeVisible();
  });

  test('the 20 % ratio and the taxpayer-established 10 % are the art. 84 pair', async ({ page }) => {
    await loadPersona(page, 'long-term-landlord');
    await expect(await estimateLine(page, 'Cheltuieli forfetare 20 % (art. 84 alin. (3) / art. 84^1 alin. (3))')).toBeVisible();
    // 270.000,00 gross − 54.000,00 forfetar = 216.000,00 net; impozit 21.600 + CASS pe scară 9.720.
    await expect(taxHero(page)).toHaveText('31.320,00 RON');
  });

  test('the rent is lit. e), not a CAS leg — and the app says so by showing CAS at zero', async ({ page }) => {
    await loadPersona(page, 'long-term-landlord');
    await expect(await estimateLine(page, 'CAS (25%)')).toContainText('0,00');
    await expect(await estimateLine(page, 'CASS pe veniturile din art. 155 alin. (1) lit. c)-h)')).toBeVisible();
  });

  test('B-122: no withholding is claimed for this register, because the engine does not model arendă', async ({ page }) => {
    // The honest assertion is about what is NOT on the screen. art. 174^1 alin. (3) makes arendă a
    // withholding source; this build has no such line, and a persona that quietly looked complete would
    // turn a known defect into an invisible one.
    await loadPersona(page, 'long-term-landlord');
    await expect(await estimateLine(page, 'Impozit reținut la sursă de plătitor')).toHaveCount(0);
  });

  test('the tenants are named individuals, in lei', async ({ page }) => {
    await loadPersona(page, 'long-term-landlord');
    await page.goto('/revenues');
    await expect(page.getByText('Enache Sorin').first()).toBeVisible();
    await expect(page.getByText('Barbu Cristina').first()).toBeVisible();
  });
});
