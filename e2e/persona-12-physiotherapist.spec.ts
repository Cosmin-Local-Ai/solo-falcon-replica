import { expect, test } from '@playwright/test';
import {
  coverageRow,
  estimateBadge,
  estimateLine,
  loadPersona,
  loadPersonaWithExpensePatch,
  taxHero,
} from './persona-harness';
import { assets as assetsCopy } from '../src/ui/copy/assets';

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
 *
 * ## Brief 77 — the 5.200 lei of amortisation is now the typed row, not the computed plan
 *
 * The total is the same as it always was, and that is the point: this cabinet records the apparatus's
 * amortisation by hand (`AMORT-1`, 5.200 lei) and links it to the asset, so the register's own computed plan
 * of 5.200 lei is withheld. One leg in, the other out — the double deduction art. 68 alin. (4) lit. d) would
 * otherwise allow is refused, and the figure does not move. The composition of the 50.400,00 changed; the
 * figure did not.
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
    // 35.000 chirie + 9.000 consumabile + 5.200 amortizare tastată manual (planul calculat este reținut,
    // B-108) + 1.200 contribuție profesională admisă integral.
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

  // ── Brief 77: chain step v23 (`Expense.assetId`) finally has a persona that states the link ──────
  //
  // Both branches are asserted, because one branch alone proves nothing: the narrowed wording is only
  // evidence if the same register says something different when the link is absent.

  test('the typed amortisation row states which asset it belongs to, on the expenses screen', async ({ page }) => {
    await loadPersona(page, 'physiotherapist');
    await page.goto('/expenses#!/registered?f=AMORT-1');
    const row = page.locator('tr[data-record-id="AMORT-1"]');
    await expect(row).toHaveClass(/row-focus/);
    await expect(row.locator('[data-expense-asset]')).toContainText(
      'Bun legat: Aparat de electroterapie și ultrasonoterapie',
    );
  });

  test('with the link declared, the refusal narrows to the one asset the person named', async ({ page }) => {
    await loadPersona(page, 'physiotherapist');
    await expect(coverageRow(page, 'depreciation_conflict')).toBeVisible();
    const detail = page.locator('[data-coverage-detail="depreciation_conflict"]');
    await expect(detail).toHaveCount(1);
    await expect(detail).toContainText('Aparat de electroterapie și ultrasonoterapie');
    await expect(detail).toContainText('AMORT-1');
    await expect(detail).toContainText('de două ori');
    // The narrowed sentence — only reachable when every typed depreciation row names its asset.
    await expect(detail).toContainText('Planurile celorlalte bunuri din registru nu sunt atinse');
    // And the register-wide sentence is NOT printed over a collision this narrow.
    await expect(detail).not.toContainText('Inregistrarea nu face legătura dintre o cheltuială și un mijloc fix');
    // The plan really is withheld: nothing is presented as posted for this asset.
    await page.goto('/assets');
    await expect(page.getByTestId('asset-conflict-p12-asset-aparat')).toBeVisible();
    await expect(page.getByTestId('asset-conflict-expenses-p12-asset-aparat')).toContainText('AMORT-1');
    await expect(page.getByTestId('asset-posted-p12-asset-aparat')).toHaveCount(0);
    // B-155 — the card now reads the scope too, so it states the refusal at the same width as the cockpit.
    // Before brief 81 this asserted `conflictWhyAll` and carried a FINDING saying the card ignored `scope`;
    // that is fixed, and the two sentences are asserted against each other rather than one being absent by
    // luck. The two-asset case — where the register-wide sentence is actually false — is proven in
    // `src/pages/Assets.posting.test.tsx` and in `e2e/depreciation-posting.spec.ts`.
    await expect(page.getByTestId('asset-conflict-scope-p12-asset-aparat')).toContainText(
      'Planurile celorlalte bunuri din registru nu sunt atinse',
    );
    await expect(page.getByText(assetsCopy.posting.conflictWhyAll)).toHaveCount(0);
  });

  test('take the link away and the same refusal says it covers the whole register', async ({ page }) => {
    // The negative branch. Same person, same 5.200 lei, one declared fact removed — and the app must now
    // admit it cannot say which asset the typed sum covers, so no schedule in the register is posted.
    await loadPersonaWithExpensePatch(page, 'physiotherapist', 'AMORT-1', { assetId: null });
    await expect(coverageRow(page, 'depreciation_conflict')).toBeVisible();
    const detail = page.locator('[data-coverage-detail="depreciation_conflict"]');
    await expect(detail).toHaveCount(1);
    await expect(detail).toContainText('Inregistrarea nu face legătura dintre o cheltuială și un mijloc fix');
    await expect(detail).not.toContainText('Planurile celorlalte bunuri din registru nu sunt atinse');
    // The row marker that names the link is gone from the register too.
    await page.goto('/expenses');
    await expect(page.locator('tr[data-record-id="AMORT-1"] [data-expense-asset]')).toHaveCount(0);
  });

  test('the link moves no figure: the withheld plan and the typed row are the same 5.200 lei', async ({ page }) => {
    // B-108's refusal is safe to raise precisely because it can only explain a number, never change one.
    // Linked and unlinked, the cockpit total is identical — the difference is in the wording, not the lei.
    await loadPersona(page, 'physiotherapist');
    await expect(taxHero(page)).toHaveText('55.519,00 RON');
    await loadPersonaWithExpensePatch(page, 'physiotherapist', 'AMORT-1', { assetId: null });
    await expect(taxHero(page)).toHaveText('55.519,00 RON');
  });
});
