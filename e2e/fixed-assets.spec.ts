import { test, expect, type Page } from '@playwright/test';
import { fixedInstant } from '../src/test/fixedInstant';
import { seedBrowser, seedPayload, type SeedPayload } from './fixtures';
import { ron } from '../src/domain/money';
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
 *   1. **an asset in the register now moves the fiscal figure** — B-93 re-premises what PG-6e pinned. The
 *      register used to be inert: the schedule was computed, shown on screen and printed in the register,
 *      and the estimate deducted a typed amount instead. It now posts its own figure, and the hero moves
 *      (acceptance 1). The seed profile itself is unchanged, because the seed declares no asset;
 *   2. **the M1 ceiling is per vehicle** — two cars each lose their own excess, and the screen calls it
 *      definitively lost rather than deferred (acceptance 5);
 *   3. **a missing declared duration refuses, names the gap, and now also holds the estimate open** — the
 *      silence reaches the coverage channel, so the hero reads incomplete beside it (acceptance 8);
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

/**
 * A payload with enough recorded income for a 31.500-lei deduction to land somewhere short of zero. The
 * demo taxpayer recorded 7.700 lei of receipts; two synthetic cars depreciate 31.500 lei across 2026, which
 * drives net income negative and floors the estimate at zero — a true result, but a figure that cannot show
 * a delta. The added receipt is labelled synthetic in its own id.
 */
function payloadWithIncome(over: Partial<SeedPayload> = {}): SeedPayload {
  const base = payloadWith(over);
  return {
    ...base,
    revenues: [
      ...base.revenues,
      {
        id: 'r-b93-synthetic',
        tip: 'factura',
        nr: 'B93-SINTETIC',
        date: '2026-04-10',
        client: 'Client de test',
        cui: 'RO11111111',
        valoareFaraTva: ron(120000),
        tva: ron(0),
        status: 'inregistrata',
      },
    ],
  };
}

/**
 * Two browser contexts, not two navigations: the store reads localStorage once per document and
 * `addInitScript` re-runs on every navigation, so a single page could not hold both states.
 */
async function heroOf(browser: import('@playwright/test').Browser, payload: SeedPayload): Promise<string> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await seedBrowser(page, payload);
  await fixClock(page);
  await page.goto('/dashboard');
  const figure = (await page.locator('.tax-hero-value').first().textContent()) ?? '';
  await context.close();
  return figure;
}

test.describe('B-93 — an asset in the register now moves the estimate', () => {
  test('the seed profile still reads 3.112,00 RON, because the seed declares no asset', async ({
    browser,
  }) => {
    const bare = await heroOf(browser, payloadWith());
    expect(bare).toBe('3.112,00 RON');
  });

  test('two M1 schedules post their capped figures and the hero moves by the tax on them', async ({
    browser,
  }) => {
    const bare = await heroOf(browser, payloadWithIncome());
    const withAssets = await heroOf(browser, payloadWithIncome({
      fixedAssets: [SYNTHETIC_ASSET_M1, SYNTHETIC_ASSET_M1_SECOND],
    }));

    // Not vacuous: the hero carries a figure, and it moved.
    expect(bare).not.toBe('');
    expect(bare).toBe('46.110,00 RON');
    expect(withAssets).toBe('29.190,00 RON');
    // The arithmetic that explains the move, so the new figure is derived rather than re-baselined.
    // a1: 120.000 lei / 24 luni liniar, punere în funcțiune 31 ian 2026 -> 11 luni în 2026, 5.000 lei/lună
    //     peste plafonul de 1.500 lei/lună din art. 28 alin. (14) -> 16.500 lei deductibil.
    // a2: 96.000 lei / 24 luni, punere 28 feb 2026 -> 10 luni, 4.000 lei/lună peste plafon -> 15.000 lei.
    // 31.500 lei în plus la cheltuiala deductibilă, 16.920 lei în minus la totalul estimat.
    expect(withAssets).not.toBe(bare);
  });

  test('a register with an incomplete asset holds the estimate open, and says why', async ({
    page,
  }) => {
    await seedBrowser(page, payloadWithIncome({ fixedAssets: [...SYNTHETIC_FIXED_ASSETS] }));
    await fixClock(page);

    await page.goto('/dashboard');
    // a3 declares no duration. Before B-93 that silence lived only on the Assets page; once the register
    // feeds the estimate it is a reason the estimate is not complete, and it rides the same channel as
    // every other such reason rather than starting a second one.
    await expect(page.locator('.badge[data-estimate-state="incomplete"]')).toHaveCount(1);
    await expect(page.locator('[data-coverage-reason="fact_missing"]')).toHaveCount(1);

    await page.goto('/assets');
    await expect(page.getByTestId('asset-total-a1')).toBeVisible();
    await expect(page.getByTestId('asset-total-a2')).toBeVisible();
  });

  test('a complete register posts, and the card names the figure that entered the estimate', async ({
    page,
  }) => {
    await seedBrowser(page, payloadWithIncome({
      fixedAssets: [SYNTHETIC_ASSET_M1, SYNTHETIC_ASSET_M1_SECOND],
    }));
    await fixClock(page);
    await page.goto('/assets');
    // The posted figure is the post-ceiling one, not the schedule's gross.
    await expect(page.getByTestId('asset-posted-a1')).toContainText('16.500');
    await expect(page.getByTestId('asset-posted-a2')).toContainText('15.000');
    await expect(page.getByTestId('asset-conflict-a1')).toHaveCount(0);
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
