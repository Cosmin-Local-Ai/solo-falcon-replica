import { expect, test, type Page } from '@playwright/test';
import { estimateBadge, estimateLine, loadPersona, taxHero, thresholdRowWithLimit } from './persona-harness';
import { assets as assetsCopy } from '../src/ui/copy/assets';

/**
 * Persona 3 — **rideshare and courier driver**: the persona whose whole job is to make the vehicle rules
 * bite rather than be present.
 *
 * Three rules, and each one changes something the user can see:
 *
 * - **art. 68 alin. (7) lit. k)** — the car the taxpayer drives is used for the activity but exclusive use
 *   is not evidenced, so its running costs are deductible at 50 %. That is the statute's default, not an app
 *   guess (D-VEH-1), and it is why the deductible total is smaller than the sum of the receipts.
 * - **art. 68 alin. (5) lit. j)** — *„cel mult un singur autoturism"*. The law gives no selection criterion,
 *   so the app asks and the person designates one car (D-VEH-2). The other car's fuel is neither dropped nor
 *   deducted: it comes back as a row the person has to look at.
 * - **art. 28 alin. (14)** — an M1 car amortises at most 1.500 lei per month, and the excess is lost
 *   definitively. 78.000 lei over a declared *durata normală* of 48 months is 1.625 lei/lună, so the cap
 *   bites every month of the year.
 */
test.describe('persona 3 — rideshare and courier driver', () => {
  test('the cockpit computes on the persona’s own figures', async ({ page }) => {
    await loadPersona(page, 'ride-hailing-driver');
    await expect(estimateBadge(page, 'incomplete')).toHaveCount(1);
    // 141.600,00 gross − 33.600,00 deductible (the 50 % vehicle cut and the capped amortisation already
    // taken out) = 108.000,00 net; CAS 24.300 + CASS 10.800 + impozit 7.290 = 42.390,00 lei.
    await expect(taxHero(page)).toHaveText('42.390,00 RON');
  });

  test('the CAS 24-smn row is the one the caps lead to, and the row states its limit', async ({ page }) => {
    await loadPersona(page, 'ride-hailing-driver');
    const rung = thresholdRowWithLimit(page, '97.200,00 lei');
    await expect(rung).toHaveCount(1);
    await expect(rung).toContainText('108.000,00 lei');
    // The amortisation the cap cut is visible in the breakdown, not just implied by the total.
    await expect(await estimateLine(page, 'Cheltuieli deductibile')).toBeVisible();
  });

  test('the second car’s costs are neither dropped nor deducted — they are put in front of the person', async ({ page }) => {
    // D-VEH-2: the one-car limit has no statutory selection criterion, so the app asks. The rows for the
    // car that was NOT designated must stay visible with a reason; silently excluding them would be the
    // same defect wearing a smaller hat.
    await loadPersona(page, 'ride-hailing-driver');
    await page.goto('/expenses#!/registered?f=PETB-1');
    const row = page.locator('tr[data-record-id="PETB-1"]');
    await expect(row).toHaveClass(/row-focus/);
    await expect(row.locator('[data-not-in-estimate]')).toContainText('regulă fără faptă consemnată');
  });

  test('the platform is a counterparty of its own shape, not a corporate client with an invoice', async ({ page }) => {
    await loadPersona(page, 'ride-hailing-driver');
    await page.goto('/clients');
    await expect(page.getByText('Corio Mobilitate SRL').first()).toBeVisible();
  });

  // ── Brief 77: the car leaves the register, and the two disposal ceilings reach a browser ──────────
  //
  // Chain steps v23/v24 persisted `disposedOn` and `disposalProceeds`, and nothing in the seed or in any
  // persona carried either. These tests are the first browser proof that the two facts survive the load
  // gate and land on a screen.

  test('the disposed car is marked as out of the register, and the card states the pct. 27 figure', async ({ page }) => {
    await loadPersona(page, 'ride-hailing-driver');
    await page.goto('/assets');
    await expect(page.getByText(assetsCopy.form.disposedOn)).toHaveCount(1);
    // 78.000 lei over a declared 48 months, amortising from November 2023: 36 months taken by 20 Octombrie
    // 2026 leaves 12 luni of the declared duration, so pct. 27 caps the residual at 1.500 × 12 = 18.000 lei.
    await expect(page.getByTestId('asset-disposal-unamortised-p3-asset-car-a')).toHaveText('19.500,00');
    await expect(page.getByTestId('asset-disposal-months-p3-asset-car-a')).toHaveText('12');
    await expect(page.getByTestId('asset-disposal-cap-p3-asset-car-a')).toHaveText('18.000,00');
    await expect(page.getByTestId('asset-disposal-deductible-p3-asset-car-a')).toHaveText('18.000,00');
    await expect(page.getByText(assetsCopy.schedule.disposalRule)).toBeVisible();
  });

  test('the proceeds are recorded, so the second ceiling is measured and the app names which one cuts', async ({ page }) => {
    // Titlul IV pct. 7 alin. (5) lit. o) caps the same residual at the price realised. The price is 40.000
    // lei, above the pct. 27 ceiling of 18.000 lei, so the pct. 27 figure is the one that binds — and the
    // app can only say that because the price is a recorded fact. Without it the row would read that the
    // second limit cannot be measured at all.
    await loadPersona(page, 'ride-hailing-driver');
    const detail = page
      .locator('[data-coverage-detail="fact_missing"]')
      .filter({ hasText: 'Autoturism M1 achiziționat în 2023' });
    await expect(detail).toHaveCount(1);
    await expect(detail).toContainText('a fost scos din gestiune');
    await expect(detail).toContainText('valoare neamortizată 19.500,00');
    await expect(detail).toContainText('12 luni rămase');
    await expect(detail).toContainText('plafon 1.500 lei × luni = 18.000,00');
    await expect(detail).toContainText('Prețul înregistrat al înstrăinării este 40.000,00');
    await expect(detail).toContainText('Plafonul pct. 27 este cel care scade cifra, pentru că prețul este mai mare.');
    // Reported, never posted — the estimate figure does not move.
    await expect(detail).toContainText('Suma NU este adăugată în estimare.');
    await expect(taxHero(page)).toHaveText('42.390,00 RON');
  });

  test('B-153 is now visible on screen: the schedule amortises two months past the disposal', async ({ page }) => {
    // The car left the register on 20 Octombrie 2026, so only 10 of 2026's months belong to it. The schedule
    // still charges 12. A user can now see both month-counts on one card and disagree with one of them.
    // This is a finding, not something to smooth over: the row is asserted as it is, not as it should be.
    await loadPersona(page, 'ride-hailing-driver');
    await page.goto('/assets');
    const row2026 = page.getByTestId('asset-year-p3-asset-car-a-2026');
    await expect(row2026.locator('td').nth(1)).toHaveText('12');
    await expect(row2026.locator('td').nth(3)).toHaveText('18.000,00');
    // …while the disposal figure counts only the months the car was actually held.
    await expect(page.getByTestId('asset-disposal-months-p3-asset-car-a')).toHaveText('12');
    // The cockpit names the disagreement in words, on the same asset — the only place the app admits the
    // two month-counts are counting different things.
    await page.goto('/dashboard');
    await expect(detailNamesDisposal(page)).toBeVisible();
  });
});

/** The cockpit's own sentence about the same disagreement, on the same asset. */
function detailNamesDisposal(page: Page) {
  return page
    .locator('[data-coverage-detail="fact_missing"]')
    .filter({ hasText: 'aceeași regulă, două numărători de luni' })
    .filter({ hasText: 'Autoturism M1 achiziționat în 2023' });
}
