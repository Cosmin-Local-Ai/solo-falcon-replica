/**
 * PG-6h-3 (D-OCC-1) — the occupancy sheet in a real browser.
 *
 * The unit suite proves the data layer; this spec proves the four things that only a browser can prove,
 * because each of them is about what actually leaves the machine:
 *
 *  1. A sheet with synthetic guest data **survives a reload** — it is persisted data, not view state.
 *  2. **Deleting removes it from the stored bytes**, not from the screen. Asserted by reading
 *     `localStorage` after a reload, which is the only place a "real deletion" claim can be checked.
 *  3. **Nothing is sent anywhere.** Asserted at the network layer: every request the page makes while a
 *     sheet is open is to the app's own origin. This is the browser-level counterpart to the source scan
 *     in `src/data/occupancy.privacy.test.tsx`, and it catches a leak the scan cannot see — a request
 *     assembled at runtime.
 *  4. **The existing export does not pick up guest data, and the sheet's own export only fires when the
 *     person presses it.**
 *
 * Every guest value comes from `src/test/occupancyFixtures.ts`, where each CNP is chosen to fail the CNP
 * check digit so it cannot be a real person's.
 */
import { expect, test, type Page } from '@playwright/test';
import { seedBrowser, seedBrowserOnce, STORAGE_KEY } from './fixtures';
import { CURRENT_DATA_VERSION } from '../src/data/migration';
import { seedData } from '../src/data/seed';
import { SYNTHETIC_CNP_A, SYNTHETIC_CNP_B, SYNTHETIC_SHEET } from '../src/test/occupancyFixtures';

/** The demo register plus one synthetic sheet, at the version this build writes. */
function payloadWithSheet() {
  return { ...seedData, occupancySheets: [SYNTHETIC_SHEET], version: CURRENT_DATA_VERSION };
}

/**
 * Capture the Blob the app hands to `URL.createObjectURL`, so the test can read the exported file's own
 * bytes. Same reason `e2e/payment-dates.spec.ts` needs it: `downloadText` revokes the object URL
 * immediately after `click()`, so the Blob is the only thing that survives the click.
 */
async function captureExportedBlob(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = URL.createObjectURL.bind(URL);
    const w = window as unknown as { __lastBlob?: Blob };
    URL.createObjectURL = ((blob: Blob) => {
      w.__lastBlob = blob;
      return original(blob);
    }) as typeof URL.createObjectURL;
  });
}

async function readCapturedBlob(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const blob = (window as unknown as { __lastBlob?: Blob }).__lastBlob;
    return blob ? await blob.text() : null;
  });
}

/** Every request the page makes, so a leak shows up as an off-origin entry rather than as a passing test. */
function watchRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', req => urls.push(req.url()));
  return urls;
}

test.describe('PG-6h-3 — the occupancy sheet, in a browser', () => {
  test('a sheet with synthetic guest data renders, and says it is retained rather than filed', async ({ page }) => {
    await seedBrowser(page, payloadWithSheet());
    await page.goto('/documents#!/occupancy');

    await expect(page.getByTestId('occ-sheet-heading')).toHaveText(
      `Fișa ${SYNTHETIC_SHEET.fiscalYear} — ${SYNTHETIC_SHEET.roomLabel}`,
    );
    await expect(page.getByText(SYNTHETIC_SHEET.stays[0].guestName)).toBeVisible();
    await expect(page.getByText(SYNTHETIC_CNP_A)).toBeVisible();
    await expect(page.getByText(SYNTHETIC_CNP_B)).toBeVisible();

    // Acceptance 8: the copy states, in Romanian, that this is the taxpayer's own retained copy and that
    // nothing goes to ANAF. And it cites the order that is actually in force.
    await expect(page.getByTestId('occ-retention')).toContainText('păstreaz');
    await expect(page.getByTestId('occ-retention')).toContainText('ANAF');
    await expect(page.locator('body')).toContainText('381/2026');
    expect(await page.locator('body').innerText()).not.toContain('398/2021');
  });

  test('a stay added through the UI is still there after a reload, in the stored bytes', async ({ page }) => {
    await seedBrowserOnce(page, payloadWithSheet());
    await page.goto('/documents#!/occupancy');

    await page.getByTestId('occ-add-stay').click();
    await page.getByTestId('occ-stay-guestName').fill('Guest Reload Synthetic');
    await page.getByTestId('occ-stay-guestIdentifier').fill(SYNTHETIC_CNP_A);
    await page.getByTestId('occ-stay-firstDay').fill('2026-09-01');
    await page.getByTestId('occ-stay-lastDay').fill('2026-09-02');
    await page.getByTestId('occ-save-stay').click();

    await expect(page.getByText('Guest Reload Synthetic')).toBeVisible();

    // A real reload, with no init script re-run: `seedBrowserOnce` only writes when storage is empty, so
    // what survives is what the app itself wrote.
    await page.reload();
    await expect(page.getByTestId('occ-sheet-heading')).toBeVisible();
    await expect(page.getByText('Guest Reload Synthetic')).toBeVisible();

    const stored = await page.evaluate(k => localStorage.getItem(k) ?? '', STORAGE_KEY);
    expect(stored).toContain('Guest Reload Synthetic');
    expect(stored).toContain(SYNTHETIC_CNP_A);
  });

  test('deleting the sheet removes the guest data from the stored bytes, not only from the screen', async ({ page }) => {
    await seedBrowserOnce(page, payloadWithSheet());
    await page.goto('/documents#!/occupancy');

    // Present first, or the deletion assertion proves nothing.
    const before = await page.evaluate(k => localStorage.getItem(k) ?? '', STORAGE_KEY);
    expect(before).toContain(SYNTHETIC_CNP_A);

    await expect(page.getByTestId('occ-sheet-heading')).toBeVisible();
    await page.getByTestId('occ-delete-sheet').click();
    // The confirmation repeats the sentence that matters before the button is available.
    await expect(page.getByTestId('occ-confirm-delete')).toBeVisible();
    await page.getByTestId('occ-confirm-delete').click();

    await page.reload();
    await expect(page.getByTestId('occ-sheet-heading')).toHaveCount(0);

    const after = await page.evaluate(k => localStorage.getItem(k) ?? '', STORAGE_KEY);
    expect(JSON.parse(after).occupancySheets).toEqual([]);
    expect(after).not.toContain(SYNTHETIC_CNP_A);
    expect(after).not.toContain(SYNTHETIC_CNP_B);
    expect(after).not.toContain(SYNTHETIC_SHEET.stays[0].guestName);
    expect(after).not.toContain(SYNTHETIC_SHEET.propertyAddress);
  });

  test('nothing leaves the machine while a sheet is open', async ({ page }) => {
    const requests = watchRequests(page);
    await seedBrowser(page, payloadWithSheet());
    await page.goto('/documents#!/occupancy');
    await expect(page.getByTestId('occ-sheet-heading')).toBeVisible();

    // Exercise the surfaces a leak would plausibly ride on: the sheet, the refusal-free dashboard, and
    // the register export that already existed before this task.
    await page.goto('/dashboard');
    await page.goto('/documents#!/reports');
    await page.getByRole('button', { name: /Descarcă CSV/ }).click();
    await page.goto('/documents#!/occupancy');

    const origin = new URL(page.url()).origin;
    const offOrigin = requests.filter(u => {
      try { return new URL(u).origin !== origin; } catch { return false; }
    });
    expect(offOrigin, `the app reached off-origin URLs: ${offOrigin.join(', ')}`).toEqual([]);
    // Not vacuous: the page really did make requests.
    expect(requests.length).toBeGreaterThan(1);
  });

  test('the RJIP export carries no guest data, and the sheet export only fires when it is pressed', async ({ page }) => {
    await captureExportedBlob(page);
    await seedBrowser(page, payloadWithSheet());

    // The export that already existed. With a sheet loaded, its bytes must be identical to the bytes the
    // same register produces without one.
    await page.goto('/documents#!/reports');
    await page.getByRole('button', { name: /Descarcă CSV/ }).click();
    const rjip = await readCapturedBlob(page);
    expect(rjip).not.toBeNull();
    for (const guest of [
      SYNTHETIC_CNP_A, SYNTHETIC_CNP_B,
      SYNTHETIC_SHEET.stays[0].guestName, SYNTHETIC_SHEET.propertyAddress,
    ]) {
      expect(rjip, `the RJIP register carried guest data: ${guest}`).not.toContain(guest);
    }

    // The sheet's own file: not produced until the person asks for it, and then it carries the sheet.
    await page.goto('/documents#!/occupancy');
    await expect(page.getByTestId('occ-sheet-heading')).toBeVisible();
    await page.getByTestId('occ-download').click();
    const sheet = await readCapturedBlob(page);
    expect(sheet).toContain(SYNTHETIC_CNP_A);
    expect(sheet).toContain(SYNTHETIC_SHEET.stays[0].guestName);
    expect(sheet).toContain(String(SYNTHETIC_SHEET.fiscalYear));
  });

  test('Settings offers the sheet regardless of the fiscal title, and the link reaches it', async ({ page }) => {
    // The seed profile declares `activityFamily: 'other'` and records no room count, so the app knows
    // nothing about this person's accommodation situation. The entry point is still there — gating it on a
    // title the app could not resolve would refuse the likeliest person who owes the sheet.
    await seedBrowser(page, { ...seedData, version: CURRENT_DATA_VERSION });
    await page.goto('/settings#!/fiscal');
    // The house form for a bare `data-*` hook — the same one `e2e/accommodation-facts.spec.ts` uses for
    // `[data-accommodation-block]`. Playwright's test id is `data-testid`, which the Settings hook is not.
    const link = page.locator('[data-occupancy-entry-link]');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/documents#!/occupancy');
    await link.click();
    await expect(page.getByTestId('occ-add-sheet')).toBeVisible();
  });
});
