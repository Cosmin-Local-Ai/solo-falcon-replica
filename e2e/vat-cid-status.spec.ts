import { test, expect } from '@playwright/test';
import { seedBrowser } from './fixtures';
import { seedData } from '../src/data/seed';
import { CURRENT_DATA_VERSION } from '../src/data/migration';

/**
 * B-94 — the dated status flag on the 50 % vehicle VAT cut, on the two surfaces that already explain
 * the 50 %, in a browser.
 *
 * The premise this spec guards against is the tempting wrong fix: giving the rule an end date because
 * CID (EU) 2024/1641 ends 31 December 2026. The research reversed that premise — the 50 % is art. 298
 * alin. (1) Cod fiscal, a free-standing domestic rule with no date and no reference to the derogation
 * (`docs/ai/research/45_cid_2024_1641_vehicle_vat_2027.md` §4) — so what the user is shown is a **status
 * flag with its own as-of date**, not an expiry.
 *
 * Three things are proven here and nowhere else in the suite:
 *
 *  1. the flag is on screen where the 50 % is already explained — the Form 300 rubric panel and the
 *     dashboard's input-VAT disclosure;
 *  2. it names the CID, its 31.12.2026 end, the proposed extension to 31.12.2029, and **the date the
 *     absence was checked** — an undated absence finding is a guess;
 *  3. the domestic rule is described as having no term, and the extension is described as not adopted,
 *     never as rejected.
 */

const payload = { ...seedData, version: CURRENT_DATA_VERSION };

test.describe('B-94 — the CID status flag where the 50 % is explained', () => {
  test('the Form 300 panel carries the flag, dated, and gives the domestic rule no end date', async ({
    page,
  }) => {
    await seedBrowser(page, payload);
    await page.clock.setFixedTime(new Date('2026-10-31T12:00:00Z'));
    await page.goto('/declarations');

    const flag = page.locator('[data-testid="vat-cid-status"]');
    await expect(flag).toBeVisible();
    await expect(flag).toContainText('art. 298 alin. (1) Cod fiscal');
    await expect(flag).toContainText('CID (EU) 2024/1641');
    await expect(flag).toContainText('32024D1641');
    await expect(flag).toContainText('31.12.2026');
    await expect(flag).toContainText('31.12.2029');
    await expect(flag).toContainText('COM(2026) 457 final');
    // The flag's own as-of date — the absence finding is dated, not asserted in the present tense.
    await expect(flag).toContainText('13.10.2026');
    // The rule itself is described as having no term, and the extension is never called rejected.
    await expect(flag).toContainText('fără termen de valabilitate');
    await expect(flag).not.toContainText(/respins/i);
    await expect(flag).not.toContainText('32024R1641');
  });

  test('the dashboard input-VAT disclosure carries the same flag, in the same words', async ({
    page,
  }) => {
    await seedBrowser(page, payload);
    await page.clock.setFixedTime(new Date('2026-10-31T12:00:00Z'));
    await page.goto('/dashboard');

    const disclosure = page.locator('.estimate-input-vat');
    await expect(disclosure).toBeVisible();
    // The disclosure is collapsed by default — the detail is collapsed, not hidden — so the flag is
    // reached the way a person reaches it: by opening the control.
    await disclosure.locator('summary').click();
    const flag = disclosure.locator('[data-testid="vat-cid-status"]');
    // Visible, not merely present: inside a closed `<details>` Playwright treats the body as hidden, so
    // this passes only because the control above actually opened.
    await flag.scrollIntoViewIfNeeded();
    await expect(flag).toBeVisible();
    await expect(flag).toContainText('art. 298 alin. (1) Cod fiscal');
    await expect(flag).toContainText('CID (EU) 2024/1641');
    await expect(flag).toContainText('13.10.2026');
  });
});
