import { test, expect, type Page } from '@playwright/test';
import { fixedInstant } from '../src/test/fixedInstant';
import { seedBrowserOnce, seedPayload, type SeedPayload } from './fixtures';
import type { AppData } from '../src/data/types';

/**
 * PG-6d (D-OTH-1, D-OTH-2, B-41) — the six art. 155 alin. (1) lit. c)-h) amounts, in a browser, from a
 * profile a person can actually answer.
 *
 * The arithmetic is pinned in `src/domain/fiscal/cassLadder.test.ts` and the separation of the two CASS
 * tracks in `src/domain/tax.cassLadder.test.ts`. What only a browser can show is the part a unit fixture
 * cannot: that the facts reach the person as six separate questions, that none of them arrives pre-filled,
 * and that a half-answered set produces a refusal that names the gap rather than a smaller number.
 *
 * What is proven here, in order:
 *
 *   1. **nothing is pre-filled** — the section renders six empty amounts and says the whole set is
 *      unanswered; the app does not open a form by answering it (acceptance 1);
 *   2. **five answered, one blank** — the estimate stops, and the refusal names the missing category in
 *      Romanian, not as a stored identifier (acceptance 2);
 *   3. **all six answered** — one base and one CASS line for the whole person, at the rung the sum selects
 *      (acceptance 5);
 *   4. **a declared zero is a declared zero** — writing `0` in a category is an answer, and six zeros
 *      compute to no CASS rather than to a refusal (the other half of B-41).
 *
 * The clock is pinned as in every other spec: the fiscal-year view and the coverage denominator are
 * period-scoped, and an unpinned date moves what these assertions read.
 */

async function fixClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(fixedInstant());
}

function profileWith(over: Partial<AppData['profile']>): SeedPayload {
  const payload = seedPayload();
  return { ...payload, profile: { ...payload.profile, ...over } } as SeedPayload;
}

/** The six amount inputs, in the order art. 155 alin. (1) lists the categories. */
const LADDER_IDS = [
  'proprietateIntelectuala',
  'asocierePersoanaJuridica',
  'cedareaFolosinteiBunurilor',
  'activitatiAgricole',
  'investitii',
  'alteSurse',
] as const;

const LADDER_LINE = 'CASS pe veniturile din art. 155 alin. (1) lit. c)-h)';

test.describe('PG-6d — the ladder is asked, not assumed', () => {
  test('the section asks for six amounts and pre-fills none of them', async ({ page }) => {
    await seedBrowserOnce(page, profileWith({}));
    await fixClock(page);
    await page.goto('/settings#!/fiscal');

    await expect(page.locator('[data-cass-ladder]')).toBeVisible();
    for (const id of LADDER_IDS) {
      await expect(page.locator(`#set-ladder-${id}`)).toHaveValue('');
    }
    // The state is reported as unanswered, which is not the same report as "all six are zero".
    await expect(page.locator('[data-ladder-answered]')).toContainText('Niciuna dintre cele șase categorii');
  });

  test('five amounts answered and one blank stops the estimate and names the missing category', async ({
    page,
  }) => {
    await seedBrowserOnce(page, profileWith({}));
    await fixClock(page);
    await page.goto('/settings#!/fiscal');

    await page.locator('#set-ladder-proprietateIntelectuala').fill('30000');
    await page.locator('#set-ladder-asocierePersoanaJuridica').fill('0');
    await page.locator('#set-ladder-cedareaFolosinteiBunurilor').fill('0');
    await page.locator('#set-ladder-activitatiAgricole').fill('0');
    await page.locator('#set-ladder-investitii').fill('0');
    // `alteSurse` stays blank: unanswered, which is not the same answer as 0.
    await page.getByRole('button', { name: 'Salvează' }).click();

    await page.goto('/dashboard');
    const body = page.locator('body');
    // The composition stops rather than summing five of six. The refusal is rendered in full, not truncated.
    await expect(body).toContainText(
      'Baza de calcul CASS pentru veniturile din art. 155 alin. (1) lit. c)-h) nu poate fi stabilită',
    );
    await expect(body).toContainText('nu completează zero');
    // Named in the language the person reads, never as the stored identifier.
    await expect(body).toContainText('alte surse (lit. h))');
    await expect(body).not.toContainText('alte_surse');
  });

  test('all six answered: one base and one CASS line, at the rung the sum selects', async ({ page }) => {
    await seedBrowserOnce(page, profileWith({}));
    await fixClock(page);
    await page.goto('/settings#!/fiscal');

    // 30.000 + 30.000 = 60.000 lei cumulated → at least 12 SM (48.600), below 24 SM (97.200) → base 12 SM,
    // and 10 % × 48.600 = 4.860 lei — art. 170 alin. (2)-(4), art. 174¹ alin. (1).
    await page.locator('#set-ladder-proprietateIntelectuala').fill('30000');
    await page.locator('#set-ladder-asocierePersoanaJuridica').fill('0');
    await page.locator('#set-ladder-cedareaFolosinteiBunurilor').fill('0');
    await page.locator('#set-ladder-activitatiAgricole').fill('0');
    await page.locator('#set-ladder-investitii').fill('30000');
    await page.locator('#set-ladder-alteSurse').fill('0');
    await page.getByRole('button', { name: 'Salvează' }).click();

    await page.goto('/dashboard');
    await expect(page.locator('.badge[data-estimate-state="refused"]')).toHaveCount(0);
    const rows = page.locator('li, tr, .breakdown-row').filter({ hasText: LADDER_LINE });
    await expect(rows.first()).toContainText('4.860');
    // One line for the whole basin, not one per category.
    await expect(page.getByText(LADDER_LINE)).toHaveCount(1);
  });

  test('six declared zeros are six answers, and they compute to no CASS rather than to a refusal', async ({
    page,
  }) => {
    await seedBrowserOnce(page, profileWith({}));
    await fixClock(page);
    await page.goto('/settings#!/fiscal');

    for (const id of LADDER_IDS) {
      await page.locator(`#set-ladder-${id}`).fill('0');
    }
    await page.getByRole('button', { name: 'Salvează' }).click();

    await page.goto('/dashboard');
    await expect(page.locator('.badge[data-estimate-state="refused"]')).toHaveCount(0);
    // Below 6 SM cumulated art. 170 alin. (2) is not satisfied: the line exists and carries no contribution.
    const rows = page.locator('li, tr, .breakdown-row').filter({ hasText: LADDER_LINE });
    await expect(rows.first()).toContainText('0');
  });
});
