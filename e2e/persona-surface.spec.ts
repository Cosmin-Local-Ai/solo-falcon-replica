import { expect, test } from '@playwright/test';
import { seedBrowserOnce, STORAGE_KEY } from './fixtures';

/**
 * Step 11 / Part D — B-132 and B-134 in a browser, walked the way a person would walk them.
 *
 * Acceptance 2 asks for a spec a real user could follow: open the app, reach the persona surface, see which
 * level matched, switch to the demo, see the demo badge, switch back, see their own numbers. Everything the
 * unit tests prove about the routing and the store is already proven there; what only a browser can prove is
 * that the surface is REACHABLE from the sidebar, that the badge survives a real reload in a real document,
 * and that the person's own register is the one they left.
 *
 * The seed taxpayer declares CAEN `6210` (B-124 fixed that fixture), and the `it-freelance` persona declares
 * `6210` as its principal class — so the honest verdict for this person is a clasă-level match, and the
 * honest wording is the recommendation wording. The secțiune case is reached in the second test through the
 * single-code check, without touching anyone's declared activity.
 */

/** An invoice only the person's own register has; no persona carries it. */
const OWN_INVOICE = 'FCT-2026-001';
const PERSONA_LABEL = 'Freelancer IT — contractări în euro';

async function ownRevenueIds(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(
    key => (JSON.parse(localStorage.getItem(key) ?? '{}').revenues ?? []).map((r: { id: string }) => r.id),
    STORAGE_KEY,
  ) as Promise<string[]>;
}

test.describe('the persona surface and the demo ↔ real toggle (B-132, B-134)', () => {
  test('a person reaches the surface, sees the level that matched, switches to the demo, and gets their own numbers back', async ({ page }) => {
    await seedBrowserOnce(page);

    // 1. Open the app on their own data.
    await page.goto('/revenues');
    await expect(page.getByText(OWN_INVOICE)).toBeVisible();
    const idsBefore = await ownRevenueIds(page);
    expect(idsBefore).toContain('r1');

    // 2. Reach the persona surface from the sidebar — not by typing a URL.
    await page.getByRole('link', { name: 'Persona demonstrativ' }).click();
    await expect(page.locator('[data-route-for="6210"]')).toBeVisible();

    // 3. See which level matched, in words. `6210` is declared by the it-freelance persona, so this is the
    //    recommendation wording — and the level chip names the key that matched.
    await expect(page.locator('[data-route-for="6210"]')).toHaveAttribute('data-match-level', 'clasa');
    await expect(page.locator('[data-route-for="6210"] [data-match-level-label]')).toHaveText('clasă');
    await expect(page.locator('[data-route-for="6210"] [data-match-strength]')).toContainText('recomandată');
    await expect(page.locator('[data-route-for="6210"] [data-matched-on]')).toContainText('6210');
    await expect(page.locator('[data-candidate="it-freelance"]')).toBeVisible();

    // 4. Switch to the demo.
    await page.locator('[data-candidate="it-freelance"] [data-demo-load]').click();

    // 5. The badge is in the topbar, and it names whose data the screen is showing.
    const badge = page.locator('[data-demo-badge]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(PERSONA_LABEL);

    // 6. It survives a real reload, and is visible immediately after it — the point of persisting the
    //    toggle at all. A demo restored silently would be worse than one not restored.
    await page.reload();
    await expect(page.locator('[data-demo-badge]')).toBeVisible();
    await expect(page.locator('[data-demo-badge]')).toContainText(PERSONA_LABEL);

    // 7. The registers really are the persona's: the person's own invoice is not on screen.
    await page.goto('/revenues');
    await expect(page.getByText(OWN_INVOICE)).toHaveCount(0);

    // 8. Switch back from the badge, and the person's own numbers are where they left them.
    await page.locator('[data-demo-badge-exit]').click();
    await expect(page.locator('[data-demo-badge]')).toHaveCount(0);
    await page.goto('/revenues');
    await expect(page.getByText(OWN_INVOICE)).toBeVisible();
    expect(await ownRevenueIds(page)).toEqual(idsBefore);
  });

  test('a secțiune-level match says so in words, and the demo marker never sits on the person\'s own CAEN field', async ({ page }) => {
    await seedBrowserOnce(page);
    await page.goto('/personas');

    // The weakest rung the nomenclator can support, reached without editing anyone's declared activity.
    await page.locator('[data-persona-cod-input]').fill('0210');
    await page.locator('[data-persona-check]').click();

    const route = page.locator('[data-route-for="0210"]');
    await expect(route).toBeVisible();
    await expect(route).toHaveAttribute('data-match-level', 'sectiune');
    await expect(route.locator('[data-match-level-label]')).toHaveText('secțiune');
    // Different WORDS from the clasă case above, not a different colour.
    await expect(route.locator('[data-match-strength]')).toContainText('doar la nivel de secțiune');
    await expect(route.locator('[data-match-strength]')).toContainText('cel mai slab nivel');

    // And the person's own CAEN field, in Settings, carries no demo marker: a badge there would read as a
    // recommendation about their real activity.
    await page.goto('/settings#!/fiscal');
    await expect(page.locator('input[data-caen-input="0"]')).toBeVisible();
    await expect(page.locator('[data-demo-badge]')).toHaveCount(0);
  });
});
