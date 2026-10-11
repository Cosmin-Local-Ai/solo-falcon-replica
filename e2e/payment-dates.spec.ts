import { test, expect, type Page } from '@playwright/test';
import { fixedInstant } from '../src/test/fixedInstant';
import { seedBrowser, seedBrowserOnce, seedPayload, type SeedPayload } from './fixtures';
import { seedData } from '../src/data/seed';
import type { Bani } from '../src/domain/money';

/**
 * PG-2 — the money date, end to end.
 *
 * Four things are proven in a browser, because each one is a claim a person (or the tax office) reads
 * off a screen rather than a value a selector returns:
 *
 *  1. **A collection that lands in another fiscal year leaves the estimate of the year the invoice was
 *     dated in** — and the row says so after a reload, i.e. out of storage, not out of component state.
 *     The clock is pinned mid-2027 while the profile stays on fiscal year 2026 on purpose: the document
 *     date (20 Dec 2026) is then *inside* FY2026 and *before* the as-of date, so the only thing keeping
 *     the record out of the figure is the collection date. Pinned at 2026-10-31 the record would have
 *     been excluded by the as-of cut-off alone and the test would have proved nothing.
 *  2. **The same on the expense side** — CF art. 68 alin. (4) lit. b) admits a cheltuială „al anului în
 *     cursul căruia au fost plătite", so a January 2027 payment cannot reduce the FY2026 base.
 *  3. **B-46**: at 00:30 local on 1 Jan 2027 all three forms default to 1 Jan 2027. The instant is an
 *     explicit UTC one (2026-12-31T22:30:00Z) so the browser's own time zone cannot make the test pass.
 *  4. **B-66**: the exported RJIP posts the 10 Jan 2027 collection in the **2027** register, under
 *     10 Jan 2027, and the exported bytes are read back to prove it.
 */

const STORAGE_KEY = 'pfa-app-data-v2';

/** 00:30 on 1 Jan 2027, Europe/Bucharest — still 31 Dec 2026 in UTC. */
const BUCHAREST_0030_1_JAN_2027 = new Date('2026-12-31T22:30:00Z');

/** Mid-2027: FY2026 is closed, so a FY2026 reading is a full-year reading. */
const MID_2027 = new Date('2027-06-30T12:00:00');

async function fixClock(page: Page, at: Date): Promise<void> {
  await page.clock.setFixedTime(at);
}

/**
 * PG-4 (D-YEAR-1). These tests read a CLOSED FY2026 while the clock sits in mid-2027. The app advances a
 * profile that was last maintained before the year boundary — that is precisely what a stale year looks
 * like — so an intentional reading of a closed year has to be stamped after the boundary. Without this
 * the dashboard would show the (empty) FY2027 register and every "before" figure below would be a zero.
 */
function closedFY2026Payload(): SeedPayload {
  const p = seedPayload();
  return { ...p, profile: { ...p.profile, updatedAt: '2027-01-05T10:00:00.000Z' } };
}

/** The modal's date inputs in DOM order: the document date, then the money date. */
function modalDateInputs(page: Page) {
  return page.locator('.form-grid input[type="date"]');
}

/**
 * Capture the Blob the app hands to `URL.createObjectURL` before the anchor click revokes its URL, so a
 * test can read the exported file's own bytes. `downloadText` revokes immediately after `click()`, which
 * is why the Blob — not the object URL — is what has to be kept.
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

function statCard(page: Page, label: string) {
  return page.locator('.stat-card').filter({ has: page.getByText(label, { exact: true }) });
}

test.describe('PG-2 — the money date end to end', () => {
  test('an invoice dated 20 Dec 2026 and collected 10 Jan 2027 is not in the FY2026 figure, and says so after a reload', async ({ page }) => {
    await fixClock(page, MID_2027);
    await seedBrowserOnce(page, closedFY2026Payload());
    await page.goto('/dashboard');

    const revenueCard = statCard(page, 'Venituri PFA (an)');
    const before = (await revenueCard.locator('.value').textContent())?.trim();
    expect(before).toBe('9.317,00 RON');

    await page.goto('/revenues#!/registered');
    await page.getByRole('button', { name: /Adaugă venit/ }).click();
    await modalDateInputs(page).nth(0).fill('2026-12-20');
    await modalDateInputs(page).nth(1).fill('2027-01-10');
    await page.getByPlaceholder('FCT-2025-0045').fill('FCT-PG2-E2E-001');
    await page
      .locator('select')
      .filter({ has: page.locator('option[value="Presta Consulting SRL"]') })
      .selectOption('Presta Consulting SRL');
    await page.getByPlaceholder('0,00').first().fill('1000');
    await page.getByPlaceholder('0,00').nth(1).fill('200');
    await page.getByRole('button', { name: 'Adaugă', exact: true }).click();
    await expect(page.getByText('Venitul FCT-PG2-E2E-001 a fost adăugat')).toBeVisible();

    // The reload is the point: the collection date has to come back out of storage, not out of state.
    await page.reload();
    await page.goto('/revenues#!/registered');
    const row = page.locator('tr[data-record-id]').filter({ hasText: 'FCT-PG2-E2E-001' });
    await expect(row).toHaveCount(1);
    await expect(row.locator('[data-fiscal-date-source="collected"]')).toHaveText(
      'data încasării: 10.01.2027 · încasat în 2027',
    );

    await page.goto('/dashboard');
    await expect(statCard(page, 'Venituri PFA (an)').locator('.value')).toHaveText('9.317,00 RON');
  });

  test('an expense documented in Dec 2026 and paid 12 Jan 2027 does not reduce the FY2026 estimate', async ({ page }) => {
    await fixClock(page, MID_2027);
    await seedBrowserOnce(page, closedFY2026Payload());
    await page.goto('/dashboard');
    const taxCard = statCard(page, 'Impozit estimat');
    const beforeTax = (await taxCard.locator('.value').textContent())?.trim();
    // PG-4 re-pin: this read used to be 2.885,00 lei — the closed FY2026 annualised again over 17,5 of
    // 12 months, which is the drift the brief's table names. A closed year is now computed from actuals,
    // so mid-2027 gives the same 3.112,00 lei that 31 Dec 2026 gave.
    expect(beforeTax).toBe('3.112,00 RON');
    // Read, do not hard-code: the claim under test is that a payment made in 2027 does not move the
    // FY2026 figure, and that is the same claim whatever the FY2026 figure happens to be.

    await page.goto('/expenses#!/registered');
    await page.getByRole('button', { name: /Adaugă cheltuială/ }).click();
    await modalDateInputs(page).nth(0).fill('2026-12-30');
    await modalDateInputs(page).nth(1).fill('2027-01-12');
    await page.getByPlaceholder('FCT-09-112043').fill('FCT-PG2-E2E-002');
    await page.getByPlaceholder('SC … SA').fill('CloudHost SRL');
    await page.getByPlaceholder('0,00').first().fill('500');
    await page.getByPlaceholder('0,00').nth(1).fill('100');
    await page
      .locator('select')
      .filter({ has: page.locator('option[value="postal_and_telecom"]') })
      .selectOption('postal_and_telecom');
    await page.getByRole('button', { name: 'Adaugă', exact: true }).click();
    await expect(page.getByText('Cheltuiala FCT-PG2-E2E-002 a fost adăugată')).toBeVisible();

    await page.reload();
    await page.goto('/expenses#!/registered');
    const row = page.locator('tr[data-record-id]').filter({ hasText: 'FCT-PG2-E2E-002' });
    await expect(row.locator('[data-fiscal-date-source="paid"]')).toHaveText(
      'data plății: 12.01.2027 · plătit în 2027',
    );

    await page.goto('/dashboard');
    await expect(statCard(page, 'Impozit estimat').locator('.value')).toHaveText(beforeTax!);
  });

  test('at 00:30 local on 1 Jan 2027 every form defaults to 1 Jan 2027, not 31 Dec 2026 (B-46)', async ({ page }) => {
    await fixClock(page, BUCHAREST_0030_1_JAN_2027);
    await seedBrowser(page);

    await page.goto('/revenues');
    await page.getByRole('button', { name: /Adaugă venit/ }).click();
    await expect(modalDateInputs(page).first()).toHaveValue('2027-01-01');
    await page.getByRole('button', { name: 'Anulează' }).click();

    await page.goto('/expenses');
    await page.getByRole('button', { name: /Adaugă cheltuială/ }).click();
    await expect(modalDateInputs(page).first()).toHaveValue('2027-01-01');
    await page.getByRole('button', { name: 'Anulează' }).click();

    // PG-5 re-pin (replaced, not deleted): the declarations form no longer defaults a date at all. The
    // monthly row always had a registration date, so the form pre-filled one and B-46 was about WHICH
    // clock it read. The annual return treats an absent filing date as a real state — a return being
    // prepared has none — so pre-filling would mint a submission nobody recorded. The clock-sensitive
    // write is now the one that stamps the day the app is told the return was filed, and that is what is
    // asserted below: at 00:30 local on 1 Jan 2027 it must read 2027-01-01, not the UTC day.
    await page.goto('/declarations');
    await page.getByRole('button', { name: /Adaugă declarație anuală/ }).first().click();
    await expect(modalDateInputs(page).first()).toHaveValue('');
    await page.getByRole('button', { name: 'Adaugă', exact: true }).click();

    await page.getByRole('button', { name: 'Marchează ca depusă' }).click();
    await expect(page.locator('tr[data-record-id]').first()).toContainText('01.01.2027');
  });

  test('the RJIP register posts a 10 Jan 2027 collection in the 2027 register, under that date (B-66)', async ({ page }) => {
    await fixClock(page, MID_2027);
    await captureExportedBlob(page);
    await seedBrowser(page, {
      ...seedPayload(),
      revenues: [
        ...seedData.revenues,
        {
          id: 'pg2-e2e-collected',
          tip: 'factura',
          nr: 'FCT-PG2-E2E-003',
          date: '2026-12-20',
          client: 'Presta Consulting SRL',
          cui: 'RO12345678',
          valoareFaraTva: { amount: 100000 as Bani, currency: 'RON' },
          tva: { amount: 20000 as Bani, currency: 'RON' },
          status: 'inregistrata',
          collected: '2027-01-10',
        },
      ],
      expenses: [],
    });

    await page.goto('/documents#!/reports');
    const yearSelect = page.locator('select');
    await expect(yearSelect.locator('option[value="2027"]')).toHaveCount(1);

    await yearSelect.selectOption('2026');
    await expect(page.getByText(/nu au dată de încasare sau de plată înregistrată/)).toBeVisible();
    await page.getByRole('button', { name: /Descarcă CSV/ }).click();
    const csv2026 = await readCapturedBlob(page);
    expect(csv2026).not.toContain('FCT-PG2-E2E-003');
    expect(csv2026).not.toContain('2026-12-20');

    await yearSelect.selectOption('2027');
    await page.getByRole('button', { name: /Descarcă CSV/ }).click();
    await expect(page.getByText('RJIP 2027 a fost generat')).toBeVisible();
    const csv2027 = await readCapturedBlob(page);
    expect(csv2027).toContain('2027-01-10;"Factură FCT-PG2-E2E-003 – Presta Consulting SRL";1.200,00;0,00');
    expect(csv2027).not.toContain('2026-12-20');
  });
});
