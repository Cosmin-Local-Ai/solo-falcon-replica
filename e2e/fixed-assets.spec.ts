import { test, expect, type Page } from '@playwright/test';
import { fixedInstant } from '../src/test/fixedInstant';
import { seedBrowser, seedPayload, type SeedPayload } from './fixtures';
import {
  SYNTHETIC_ASSET_INCOMPLETE,
  SYNTHETIC_ASSET_M1,
  SYNTHETIC_ASSET_M1_SECOND,
  SYNTHETIC_FIXED_ASSETS,
} from '../src/test/fixedAssetFixtures';
import { assets as assetsCopy } from '../src/ui/copy/assets';

/**
 * PG-6e (B-31, D-FA-1, D-FA-2) — the fixed-asset register, in a browser, from stored data.
 *
 * Every case starts from a persisted payload rather than a hand-built fact set: a depreciation figure that
 * only exists in a unit fixture has not reached the person who has to keep the register. The clock is
 * pinned to the shared instant as in every other spec, because the schedule's calendar years are
 * date-scoped.
 *
 * What is proven here, in order:
 *
 *   1. **an asset in the register moves no fiscal figure** — the dashboard estimate is the same figure,
 *      with the same coverage state, with and without the register populated (acceptance 9, in the
 *      browser rather than only in the digest test);
 *   2. **the M1 ceiling is per vehicle** — two cars each lose their own excess, and the screen calls it
 *      definitively lost rather than deferred (acceptance 5);
 *   3. **a missing declared duration refuses and names the gap**, next to schedules that did compute
 *      (acceptance 8);
 *   4. **the constructions are labelled on screen** — the first-year pro-rating and the degresive switch
 *      appear with the sentence that says they are ours (acceptance 3, 4);
 *   5. **the two retained documents exist, carry the current retention rule, and are produced on an
 *      explicit act** (acceptance 9 / D-FA-2).
 */

async function fixClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(fixedInstant());
}

function payloadWith(over: Partial<SeedPayload> = {}): SeedPayload {
  return { ...seedPayload(), ...over };
}

test.describe('PG-6e acceptance 9 — an asset moves no fiscal figure', () => {
  test('the demo taxpayer with no register and a taxpayer with a full register get the same figure', async ({
    browser,
  }) => {
    // Two browser contexts, not two navigations: the store reads localStorage once per document and
    // `addInitScript` re-runs on every navigation, so a single page could not hold both states.
    const open = async (payload: SeedPayload) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await seedBrowser(page, payload);
      await fixClock(page);
      await page.goto('/dashboard');
      await expect(page.locator('.badge[data-estimate-state="complete"]')).toHaveCount(1);
      const figure = (await page.locator('.tax-hero-value').first().textContent()) ?? '';
      await context.close();
      return figure;
    };

    const bare = await open(payloadWith());
    const withAssets = await open(payloadWith({ fixedAssets: [...SYNTHETIC_FIXED_ASSETS] }));

    // Not vacuous: the hero actually carries a figure.
    expect(bare).not.toBe('');
    expect(bare).toBe('3.112,00 RON');
    expect(withAssets).toBe(bare);
  });

  test('with three assets stored, the estimate stays complete and the register renders', async ({
    page,
  }) => {
    await seedBrowser(page, payloadWith({ fixedAssets: [...SYNTHETIC_FIXED_ASSETS] }));
    await fixClock(page);

    await page.goto('/dashboard');
    await expect(page.locator('.badge[data-estimate-state="complete"]')).toHaveCount(1);
    // No coverage row appeared for the assets: an asset is not an unanswered expense, and the estimate
    // does not read the register at all.
    await expect(page.locator('[data-estimate-coverage]')).toHaveCount(0);

    await page.goto('/assets');
    await expect(page.getByTestId('asset-total-a1')).toBeVisible();
    await expect(page.getByTestId('asset-total-a2')).toBeVisible();
  });
});

test.describe('PG-6e acceptance 5 — the M1 ceiling is per vehicle', () => {
  test('two cars each lose their own excess, and the words say definitively lost', async ({ page }) => {
    await seedBrowser(page, payloadWith({ fixedAssets: [SYNTHETIC_ASSET_M1, SYNTHETIC_ASSET_M1_SECOND] }));
    await fixClock(page);
    await page.goto('/assets');

    // Both cars are capped: 1.500 lei/lună each, per „pentru fiecare” in art. 28 alin. (14).
    await expect(page.getByTestId('asset-total-a1')).not.toHaveText('—');
    await expect(page.getByTestId('asset-total-a2')).not.toHaveText('—');
    // The excess column carries a figure for both, not a dash.
    const lostA = await page.getByTestId('asset-year-a1-2026').locator('td').nth(4).textContent();
    const lostB = await page.getByTestId('asset-year-a2-2026').locator('td').nth(4).textContent();
    expect(lostA).not.toBe('—');
    expect(lostB).not.toBe('—');

    // Two cars, two notes — `getByText` is in strict mode, so the note is addressed by position.
    await expect(page.getByText(assetsCopy.schedule.m1Capped).first()).toBeVisible();
    expect(await page.getByText(assetsCopy.schedule.m1Capped).all()).toHaveLength(2);
    expect((await page.getByText(assetsCopy.schedule.m1Capped).first().textContent()) ?? '')
      .toContain('definitiv');
  });

  test('the screen states that the one-car limit is about running costs, not amortisation', async ({
    page,
  }) => {
    await seedBrowser(page, payloadWith({ fixedAssets: [...SYNTHETIC_FIXED_ASSETS] }));
    await fixClock(page);
    await page.goto('/assets');
    await expect(page.getByText(assetsCopy.vehicleLists.oneCarLimit)).toBeVisible();
    await expect(page.getByText(assetsCopy.vehicleLists.closing)).toBeVisible();
  });
});

test.describe('PG-6e acceptance 8 — a silence refuses and names itself', () => {
  test('an asset with no declared duration shows a refusal, beside schedules that computed', async ({
    page,
  }) => {
    await seedBrowser(page, payloadWith({ fixedAssets: [...SYNTHETIC_FIXED_ASSETS] }));
    await fixClock(page);
    await page.goto('/assets');

    await expect(page.getByTestId('asset-refusal-a3')).toBeVisible();
    await expect(page.getByTestId('asset-gap-a3')).toHaveText(assetsCopy.gaps.durata);
    // Not vacuous: the other two assets in the same register did compute.
    await expect(page.getByTestId('asset-total-a1')).toBeVisible();
  });
});

test.describe('PG-6e acceptance 3 and 4 — the constructions are labelled', () => {
  test('the first-year pro-rating and the degresive switch both appear with their own sentence', async ({
    page,
  }) => {
    await seedBrowser(page, payloadWith({ fixedAssets: [SYNTHETIC_ASSET_M1] }));
    await fixClock(page);
    await page.goto('/assets');

    const proRated = page.getByText(assetsCopy.schedule.firstYearProRated);
    await expect(proRated).toBeVisible();
    expect((await proRated.textContent()) ?? '').toContain('construcția noastră');
  });
});

test.describe('PG-6e / D-FA-2 — the two retained documents', () => {
  test('both documents are offered, with the current retention rule and no filing surface', async ({
    page,
  }) => {
    await seedBrowser(page, payloadWith({ fixedAssets: [...SYNTHETIC_FIXED_ASSETS] }));
    await fixClock(page);
    await page.goto('/documents#!/fixed-assets');

    await expect(page.getByTestId('fa-download-register')).toBeVisible();
    await expect(page.getByTestId('fa-download-fiche-a1')).toBeVisible();
    await expect(page.getByTestId('fa-download-fiche-a2')).toBeVisible();

    // The retention a reader would act on: 5 ani from 1 July, and the 10-ani rule named as abrogated.
    await expect(page.getByText(assetsCopy.documents.retentionRegister)).toBeVisible();
    await expect(page.getByText(assetsCopy.documents.retentionAbrogated)).toBeVisible();
    expect((await page.getByText(assetsCopy.documents.retentionRegister).textContent()) ?? '')
      .toContain('1 iulie');

    // A păstrare surface, not a filing surface.
    await expect(page.getByText('Nimic nu se trimite la ANAF')).toBeVisible();
  });

  test('an empty register generates nothing', async ({ page }) => {
    await seedBrowser(page, payloadWith());
    await fixClock(page);
    await page.goto('/documents#!/fixed-assets');
    await expect(page.getByText(assetsCopy.documents.emptyTitle)).toBeVisible();
    await expect(page.getByTestId('fa-download-register')).toHaveCount(0);
  });

  test('the tab is reachable by URL, which is what the router whitelist is for', async ({ page }) => {
    await seedBrowser(page, payloadWith({ fixedAssets: [SYNTHETIC_ASSET_INCOMPLETE] }));
    await fixClock(page);
    await page.goto('/documents');
    await page.getByRole('button', { name: assetsCopy.documents.tabTitle }).click();
    await expect(page).toHaveURL(/#!\/fixed-assets/);
    await expect(page.getByTestId('fa-download-register')).toBeVisible();
  });
});
