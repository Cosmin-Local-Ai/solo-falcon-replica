import { test, expect, type Page } from '@playwright/test';
import { fixedInstant } from '../src/test/fixedInstant';
import { seedBrowser, seedPayload, type SeedPayload } from './fixtures';
import { SYNTHETIC_ASSET_M1, SYNTHETIC_ASSET_M1_SECOND } from '../src/test/fixedAssetFixtures';
import { assets as assetsCopy } from '../src/ui/copy/assets';
import { dashboard as dashboardCopy } from '../src/ui/copy/dashboard';
import { ron } from '../src/domain/money';
import type { Expense } from '../src/data/types';

/**
 * B-93 — the depreciation schedule reaches the estimate, and the hand-recorded expense is never added on
 * top of it.
 *
 * The hazard this spec exists to prove cannot happen is the double count. There are two routes to the
 * expense side of a capital asset — the typed `depreciation_business_asset` expense (art. 68 alin. (4)) and
 * the schedule derived from the asset's declared facts and art. 28 — and a naive fix adds the second while
 * leaving the first in place. That is not a display bug; it is a wrong figure on a return.
 *
 * What is proven, in a browser, from stored data:
 *
 *   1. the schedule posts, and the hero moves by the tax on it (acceptance 1);
 *   2. where a typed depreciation expense also stands, **the hero does not move at all** — the schedule is
 *      withheld rather than summed, and no larger figure is picked (acceptance 2);
 *   3. the refusal is readable: a coverage row on the dashboard whose sentence names the asset, and a block
 *      on the asset's own card that names the colliding expense (acceptance 3 — B-106 is the standing
 *      example of a refusal the user cannot read).
 */

const typedDepreciation: Expense = {
  id: 'exp-amortizare-tipita',
  tip: 'factura',
  nr: 'Înreg-2026-0001',
  date: '2026-09-10',
  paid: '2026-09-10',
  furnizor: 'Registrul de amortizare',
  cui: 'RO00000000',
  valoareFaraTva: ron(70000),
  tva: ron(0),
  status: 'inregistrata',
  category: 'depreciation_business_asset',
};

async function fixClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(fixedInstant());
}

/**
 * The demo taxpayer recorded 7.700 lei of receipts; the two synthetic cars depreciate 31.500 lei across
 * 2026, which would drive net income negative and floor the estimate at zero — a true result, but one that
 * cannot show a delta. The added receipt is labelled synthetic in its own id.
 */
function payloadWith(over: Partial<SeedPayload> = {}): SeedPayload {
  const base: SeedPayload = { ...seedPayload(), ...over };
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

const TWO_CARS = [SYNTHETIC_ASSET_M1, SYNTHETIC_ASSET_M1_SECOND];

test.describe('B-93 acceptance 2 — the double count is refused, and the figure does not move', () => {
  test('a typed depreciation expense and a computed schedule leave the hero exactly where the expense alone put it', async ({
    browser,
  }) => {
    const typedOnly = await heroOf(browser, payloadWith({
      expenses: [...seedPayload().expenses, typedDepreciation],
    }));
    const both = await heroOf(browser, payloadWith({
      expenses: [...seedPayload().expenses, typedDepreciation],
      fixedAssets: TWO_CARS,
    }));

    // Not vacuous: the typed expense moved the figure on its own, and the assets did not move it again.
    expect(typedOnly).toBe('21.875,00 RON');
    expect(both).toBe(typedOnly);
  });

  test('without the typed expense the same two schedules do post, and the hero moves', async ({
    browser,
  }) => {
    const bare = await heroOf(browser, payloadWith());
    const posted = await heroOf(browser, payloadWith({ fixedAssets: TWO_CARS }));
    expect(bare).toBe('46.110,00 RON');
    expect(posted).toBe('29.190,00 RON');
    expect(posted).not.toBe(bare);
  });

  test('the refusal is a coverage row on the dashboard, and its sentence names the asset', async ({
    page,
  }) => {
    await seedBrowser(page, payloadWith({
      expenses: [...seedPayload().expenses, typedDepreciation],
      fixedAssets: TWO_CARS,
    }));
    await fixClock(page);
    await page.goto('/dashboard');

    // One row per REASON, not one per record — the grouping PG-1 chose, so a profile with nine things to
    // fix shows one row. The count inside the row is what says two.
    const row = page.locator('[data-coverage-reason="depreciation_conflict"]');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(
      dashboardCopy.estimate.coverage.reasonLabels.depreciation_conflict,
    );
    await expect(row).toContainText('2 înregistrări');

    // The sentences are per record, and each one names its own asset.
    const detail = page.locator('[data-coverage-detail="depreciation_conflict"]');
    await expect(detail).toHaveCount(2);
    await expect(detail.first()).toContainText('Mașina de test unu');
    await expect(detail.first()).toContainText('exp-amortizare-tipita');
    await expect(detail.first()).toContainText('de două ori');
    await expect(detail.nth(1)).toContainText('Mașina de test doi');
  });

  test('the asset card itself says the schedule was withheld, and names the expense', async ({
    page,
  }) => {
    await seedBrowser(page, payloadWith({
      expenses: [...seedPayload().expenses, typedDepreciation],
      fixedAssets: TWO_CARS,
    }));
    await fixClock(page);
    await page.goto('/assets');

    await expect(page.getByTestId('asset-conflict-a1')).toBeVisible();
    await expect(page.getByTestId('asset-conflict-a2')).toBeVisible();
    await expect(page.getByTestId('asset-conflict-expenses-a1')).toContainText('exp-amortizare-tipita');
    // Nothing is presented as posted.
    await expect(page.getByTestId('asset-posted-a1')).toHaveCount(0);
    await expect(page.getByTestId('asset-posted-a2')).toHaveCount(0);
    // And the card says why every schedule is withheld, not only this one — the register holds no link
    // between an expense and an asset, so the app cannot say which asset the typed sum covers.
    await expect(page.getByText(assetsCopy.posting.conflictWhyAll).first()).toBeVisible();
    expect(await page.getByText(assetsCopy.posting.conflictWhyAll).all()).toHaveLength(2);
  });

  test('B-155 — declare the link and the same two-asset register narrows: one card withheld, one posted', async ({
    page,
  }) => {
    // The counterpart of the test above, on the SAME two-asset register, differing in one declared fact:
    // the typed depreciation row now names `a1`. That flips `DepreciationConflict.scope` from
    // 'register-wide' to 'asset', and the card has to change its sentence with it — the register-wide
    // wording is not merely less precise here, it is false, because `a2`'s schedule does post.
    await seedBrowser(page, payloadWith({
      expenses: [...seedPayload().expenses, { ...typedDepreciation, assetId: 'a1' }],
      fixedAssets: TWO_CARS,
    }));
    await fixClock(page);
    await page.goto('/assets');

    await expect(page.getByTestId('asset-conflict-a1')).toBeVisible();
    await expect(page.getByTestId('asset-conflict-scope-a1')).toContainText(
      'Planurile celorlalte bunuri din registru nu sunt atinse',
    );
    // The false sentence is gone from the whole page, not just from this card.
    await expect(page.getByText(assetsCopy.posting.conflictWhyAll)).toHaveCount(0);
    // And the narrowed sentence's own claim is checked against the other card.
    await expect(page.getByTestId('asset-conflict-a2')).toHaveCount(0);
    await expect(page.getByTestId('asset-posted-a2')).toBeVisible();
  });

  test('the ceiling travels with the posted figure: the card shows the capped amount, never the gross', async ({
    page,
  }) => {
    await seedBrowser(page, payloadWith({ fixedAssets: [SYNTHETIC_ASSET_M1] }));
    await fixClock(page);
    await page.goto('/assets');
    // 55.000 lei computed, 16.500 lei after the 1.500 lei/lună ceiling of art. 28 alin. (14).
    await expect(page.getByTestId('asset-posted-a1')).toContainText('16.500');
    await expect(page.getByTestId('asset-posted-a1')).not.toContainText('55.000');
    await expect(page.getByText(assetsCopy.posting.ceilingTravels)).toBeVisible();
  });
});
