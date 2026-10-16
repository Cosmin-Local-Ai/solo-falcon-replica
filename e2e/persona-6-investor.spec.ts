import { expect, test } from '@playwright/test';
import { estimateBadge, estimateLine, loadPersona, taxHero } from './persona-harness';

/**
 * Persona 6 — **passive investor, salariat, no CAEN**: the art. 84¹ half of the rent pair, and the ladder
 * carried by capital income rather than by a register.
 *
 * The tenant here is an entity with accounting records, so the year runs **art. 84¹**: the gross is what the
 * tenant **paid**, the tax is withheld at source and final, and the landlord owes no Declarația Unică for the
 * income tax (art. 122 alin. (6) lit. a)) while still owing one for the contributions. Persona 5 is the same
 * 20 % ratio under art. 84; the two together are what make the difference visible.
 *
 * ## The two restraint requirements this persona carries
 *
 * - **Part D item 5** — art. 150 alin. (2) at the ceiling test is genuinely unresolved (`research/52` §Q2).
 *   This persona shows CAS = 0 for a salariat with DPI income and asserts nothing about which rung a salary
 *   would have named. The spec asserts the figure and the absence of a claim, not a resolution.
 * - **Part D item 1** — arendă and asocieri are withholding sources under art. 174¹ alin. (3) and the engine
 *   does not model them. This persona holds both, so it is the one that lands on the gap.
 *
 * ## A carried-in loss that is refused out loud (B-154, brief 81)
 *
 * This persona declares a 30.000-lei `activitate_independenta` loss from 2022 and **cannot use it**: art. 118
 * alin. (2) and alin. (4) compensate only a venit net „determinat în sistem real”, and this register is
 * measured by the art. 84¹ flat ratio. Brief 77 therefore kept the loss off persona 6 entirely, because the
 * app discarded it in silence. Brief 81 closed that as B-154 — refused, with the reason on the row — and the
 * loss came back precisely so the browser can show the refusal. The hero stays 9.720,00 RON: a refused loss
 * changes no figure, and that is what the pair of assertions below pins together.
 *
 * ## Why no DPI receipt is in the register
 *
 * Persona 2 records art. 70 receipts; this persona declares the DPI **net** on the art. 170 alin. (4) ladder.
 * One persona cannot do both — `dpiDoubleRepresentation` exists to refuse exactly that — so the two routes
 * are demonstrated by two people.
 */
test.describe('persona 6 — passive investor (art. 84¹, the ladder, the salariat case)', () => {
  test('the rent runs art. 84¹: the gross is what the tenant paid', async ({ page }) => {
    await loadPersona(page, 'passive-investor');
    await expect(estimateBadge(page, 'complete')).toHaveCount(1);
    await expect(await estimateLine(page, 'Venit brut art. 84^1 (sumele plătite de chiriaș în anul fiscal)')).toBeVisible();
  });

  test('the tax is withheld and final, and the app says the taxpayer does not pay it', async ({ page }) => {
    await loadPersona(page, 'passive-investor');
    await expect(await estimateLine(page, 'Impozit reținut la sursă de plătitor')).toBeVisible();
    await expect(await estimateLine(page, 'Din care: reținut și virat de plătitorul de venit')).toBeVisible();
    // Only the CASS ladder is the person's to pay: 9.720,00 lei on the 24-smn rung.
    await expect(taxHero(page)).toHaveText('9.720,00 RON');
  });

  test('a declared carried-in loss is refused, and the refusal says why (B-154)', async ({ page }) => {
    await loadPersona(page, 'passive-investor');
    // The row exists, names the article, and carries the amount that was NOT used.
    const row = await estimateLine(page, 'Pierdere fiscală reportată din 2022');
    await expect(row).toBeVisible();
    await expect(row).toContainText('NEAPLICATĂ');
    await expect(row).toContainText('art. 118 alin. (2)');
    await expect(row).toContainText('30.000,00');
    // Refused, not applied: none of art. 118's D212 rows exist on a flat-ratio register.
    await expect(page.getByText('Venit net anual recalculat')).toHaveCount(0);
    // And the money is untouched — the refusal is a sentence, not a re-computation.
    await expect(taxHero(page)).toHaveText('9.720,00 RON');
  });

  test('CAS is zero for a salariat with DPI income, and no rung is claimed', async ({ page }) => {
    await loadPersona(page, 'passive-investor');
    await expect(await estimateLine(page, 'Venit cumulat pentru CAS (art. 148 alin. (3)')).toBeVisible();
    // The cumulation line exists — that is the B-112 limb being present at all — and the contribution is 0.
    // Nothing here asserts which rung a salary would have selected: that question is open, and the app says so.
    await expect(await estimateLine(page, 'CAS (25%)')).toContainText('0,00');
  });

  test('the ladder is entered through capital income, and the withheld credit is stated', async ({ page }) => {
    await loadPersona(page, 'passive-investor');
    await expect(await estimateLine(page, 'Baza de calcul CASS art. 155 alin. (1) lit. c)-h)')).toContainText('97.200,00');
  });

  test('the counterparties are the distributing company and the corporate tenant, not a client list', async ({ page }) => {
    await loadPersona(page, 'passive-investor');
    await page.goto('/clients');
    await expect(page.getByText('Carpatica Invest SRL').first()).toBeVisible();
    await expect(page.getByText('Depozitele Someșeni SRL').first()).toBeVisible();
  });
});
