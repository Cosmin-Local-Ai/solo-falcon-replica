import { test, expect, type Page } from '@playwright/test';
import { fixedInstant } from '../src/test/fixedInstant';
import { seedBrowserOnce, seedPayload, STORAGE_KEY, type SeedPayload } from './fixtures';
import type { AppData } from '../src/data/types';

/**
 * PG-6d (D-OTH-1, D-OTH-2, B-41) and D-DPI-2 (B-152) — the six art. 155 alin. (1) lit. c)-h) categories,
 * asked as six questions in a browser, from a profile a person can actually answer.
 *
 * The arithmetic is pinned in `src/domain/fiscal/cassLadder.test.ts` and `src/domain/ladderAnswers.test.ts`,
 * the separation of the two CASS tracks in `src/domain/tax.cassLadder.test.ts`, and the form's write path in
 * `src/pages/Settings.ladderAnswers.test.tsx`. What only a browser can show is the part a unit fixture
 * cannot: that the facts reach the person as six separate QUESTIONS, that none of them arrives pre-answered,
 * that a half-answered set produces a refusal naming the gap rather than a smaller number, and — since
 * D-DPI-2 — that a question nobody touched is saved as nothing at all.
 *
 * What is proven here, in order:
 *
 *   1. **nothing is pre-answered** — six questions, every one untouched, and no amount box offered until the
 *      person says they have such an income (acceptance 1);
 *   2. **an untouched question writes nothing** — the payload after a save nobody made carries no `none`
 *      (§6.5 of brief 78, in the browser rather than in jsdom);
 *   3. **five answered, one untouched** — the estimate stops, and the refusal names the missing category in
 *      Romanian, not as a stored identifier (acceptance 2);
 *   4. **all six answered** — one base and one CASS line for the whole person, at the rung the sum selects;
 *   5. **six declared „nu am avut" are six answers** — they compute to no CASS rather than to a refusal,
 *      which is the whole of D-DPI-2, and the other half of B-41.
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

/** The six question controls, in the order art. 155 alin. (1) lists the categories. */
const LADDER_IDS = [
  'proprietateIntelectuala',
  'asocierePersoanaJuridica',
  'cedareaFolosinteiBunurilor',
  'activitatiAgricole',
  'investitii',
  'alteSurse',
] as const;

const LADDER_LINE = 'CASS pe veniturile din art. 155 alin. (1) lit. c)-h)';

/** Answer one category. Choosing anything but „am avut" leaves the amount box unrendered. */
async function answer(page: Page, id: string, choice: 'amount' | 'none' | 'unknown'): Promise<void> {
  await page.selectOption(`#set-ladder-answer-${id}`, choice);
}

/** Answer with a figure: choose „am avut", then type the sum the law measures for that category. */
async function answerWith(page: Page, id: string, lei: string): Promise<void> {
  await answer(page, id, 'amount');
  await expect(page.locator(`#set-ladder-${id}`)).toBeVisible();
  await page.locator(`#set-ladder-${id}`).fill(lei);
}

test.describe('PG-6d / D-DPI-2 — the ladder is asked, not assumed', () => {
  test('the section asks six questions and pre-answers none of them', async ({ page }) => {
    await seedBrowserOnce(page, profileWith({}));
    await fixClock(page);
    await page.goto('/settings#!/fiscal');

    await expect(page.locator('[data-cass-ladder]')).toBeVisible();
    for (const id of LADDER_IDS) {
      await expect(page.locator(`#set-ladder-answer-${id}`)).toHaveValue('');
    }
    // The amount box is not offered until the person says they have such an income. A box invites a blank,
    // and a blank category is the one state the ladder cannot compute over.
    await expect(page.locator('[data-ladder-amount]')).toHaveCount(0);
    // The state is reported as unanswered, which is not the same report as "all six are zero".
    await expect(page.locator('[data-ladder-answered]')).toContainText('Niciuna dintre cele șase categorii');
  });

  test('a question nobody touched is saved as nothing at all — never as „nu am avut”', async ({ page }) => {
    // §6.5 of brief 78, asserted on the BYTES rather than on component state. If the save path wrote `none`
    // for an untouched control, the app would be asserting in the taxpayer's name that they have no other
    // income — and the CASS base would then be computed out of that assertion.
    await seedBrowserOnce(page, profileWith({}));
    await fixClock(page);
    await page.goto('/settings#!/fiscal');
    await page.getByRole('button', { name: 'Salvează' }).click();

    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORAGE_KEY);
    const year = saved.profile?.cassLadderYears?.[0];
    const answers = year?.ladderAnswers ?? {};
    expect(Object.keys(answers)).toHaveLength(0);
    // And no amount was minted beside the silence either.
    expect(year?.investitii).toBeUndefined();
    expect(year?.alteSurse).toBeUndefined();
  });

  test('five answers and one untouched question stops the estimate and names the missing category', async ({
    page,
  }) => {
    await seedBrowserOnce(page, profileWith({}));
    await fixClock(page);
    await page.goto('/settings#!/fiscal');

    await answerWith(page, 'proprietateIntelectuala', '30000');
    await answer(page, 'asocierePersoanaJuridica', 'none');
    await answer(page, 'cedareaFolosinteiBunurilor', 'none');
    await answer(page, 'activitatiAgricole', 'none');
    await answer(page, 'investitii', 'none');
    // `alteSurse` stays untouched: nobody answered, which is not the same answer as „nu am avut”.
    await page.getByRole('button', { name: 'Salvează' }).click();

    await page.goto('/dashboard');
    const body = page.locator('body');
    // The composition stops rather than summing five of six. The refusal is rendered in full, not truncated.
    await expect(body).toContainText(
      'Baza de calcul CASS pentru veniturile din art. 155 alin. (1) lit. c)-h) nu poate fi stabilită',
    );
    await expect(body).toContainText('nu completează zero');
    // Named in the language the person reads, never as the stored identifier.
    // RE-PIN, named as such (brief 75 / B-120, D-CITE-1) — same change as the unit pin in
    // `src/domain/fiscal/cassLadder.test.ts`: the bare `(lit. h))` is replaced by the article plus the
    // verbatim definition from research/41 §1.
    await expect(body).toContainText(
      'alte surse — art. 155 alin. (1) lit. h): „venituri din alte surse, definite conform art. 114”',
    );
    await expect(body).not.toContainText('alte_surse');
  });

  test('all six answered: one base and one CASS line, at the rung the sum selects', async ({ page }) => {
    await seedBrowserOnce(page, profileWith({}));
    await fixClock(page);
    await page.goto('/settings#!/fiscal');

    // 30.000 + 30.000 = 60.000 lei cumulated → at least 12 SM (48.600), below 24 SM (97.200) → base 12 SM,
    // and 10 % × 48.600 = 4.860 lei — art. 170 alin. (2)-(4), art. 174¹ alin. (1). Four of the six carry a
    // declared „nu am avut”, and they contribute nothing: the rung is chosen by the two that have figures.
    await answerWith(page, 'proprietateIntelectuala', '30000');
    await answer(page, 'asocierePersoanaJuridica', 'none');
    await answer(page, 'cedareaFolosinteiBunurilor', 'none');
    await answer(page, 'activitatiAgricole', 'none');
    await answerWith(page, 'investitii', '30000');
    await answer(page, 'alteSurse', 'none');
    await page.getByRole('button', { name: 'Salvează' }).click();

    await page.goto('/dashboard');
    await expect(page.locator('.badge[data-estimate-state="refused"]')).toHaveCount(0);
    const rows = page.locator('li, tr, .breakdown-row').filter({ hasText: LADDER_LINE });
    await expect(rows.first()).toContainText('4.860');
    // One line for the whole basin, not one per category.
    await expect(page.getByText(LADDER_LINE)).toHaveCount(1);
  });

  test('six declared „nu am avut” are six answers, and they compute to no CASS rather than to a refusal', async ({
    page,
  }) => {
    // This test did not exist before D-DPI-2, and it is the decision in one screen: six categories with no
    // figure and an explicit absence each. Before, the ladder refused — it could not tell this person from
    // one who had never been asked. Now it computes, and computes to nothing, because the person said so.
    await seedBrowserOnce(page, profileWith({}));
    await fixClock(page);
    await page.goto('/settings#!/fiscal');

    for (const id of LADDER_IDS) await answer(page, id, 'none');
    await page.getByRole('button', { name: 'Salvează' }).click();

    await page.goto('/dashboard');
    await expect(page.locator('.badge[data-estimate-state="refused"]')).toHaveCount(0);
    // Below 6 SM cumulated art. 170 alin. (2) is not satisfied: the line exists and carries no contribution.
    const rows = page.locator('li, tr, .breakdown-row').filter({ hasText: LADDER_LINE });
    await expect(rows.first()).toContainText('0');
  });

  test('a declared zero is still a declared zero: „am avut” with 0 is an answer with a figure', async ({
    page,
  }) => {
    // The other half of B-41, kept on purpose. `0` and „nu am avut” are different records and both are
    // answers; neither is the blank the first test in this file refuses to write.
    await seedBrowserOnce(page, profileWith({}));
    await fixClock(page);
    await page.goto('/settings#!/fiscal');

    for (const id of LADDER_IDS) await answerWith(page, id, '0');
    await page.getByRole('button', { name: 'Salvează' }).click();

    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORAGE_KEY);
    const year = saved.profile?.cassLadderYears?.[0];
    expect(year?.investitii).toBe(0);
    expect(year?.ladderAnswers?.investitii).toBe('amount');

    await page.goto('/dashboard');
    await expect(page.locator('.badge[data-estimate-state="refused"]')).toHaveCount(0);
    const rows = page.locator('li, tr, .breakdown-row').filter({ hasText: LADDER_LINE });
    await expect(rows.first()).toContainText('0');
  });
});
