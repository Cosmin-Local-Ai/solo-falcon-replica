import { test, expect, type Page } from '@playwright/test';
import { fixedInstant } from '../src/test/fixedInstant';
import { seedPayload, seedBrowserOnce, type SeedPayload } from './fixtures';
import type { AppData } from '../src/data/types';

/**
 * B-105 — the ordinary *cedarea folosinței bunurilor* facts, in a browser, from stored data.
 *
 * The regime this task adds is selected by a fact the app cannot see: whether the tenant keeps accounting
 * records. Nothing in the register says it — a CUI in the tenant column is a tax number, not a bookkeeping
 * obligation — so the whole feature rests on a declared answer, and a declared answer has to be enterable by
 * a person rather than only constructible in a unit fixture. That is what these cases prove.
 *
 * In order:
 *
 *   1. **nothing is pre-filled** — every lease control starts empty, and the empty state is described as
 *      unanswered rather than resolved. A default here would not be a convenience: the tenant's legal nature
 *      decides between art. 84 and art. 84^1, and with it who computes the tax, whether it is final, and
 *      whether a Declarația Unică is owed for the income at all;
 *   2. **the choice states its consequence** — picking a corporate tenant shows the art. 84^1 reading beside
 *      the field, including the part implementations miss: the income tax leaves the return while the
 *      contributions do not;
 *   3. **it survives a reload** — the fact is persisted per fiscal year, not re-derived on load;
 *   4. **the 30-day contract-registration term appears** for an ordinary rent register (art. 83 alin. (5)),
 *      **and does not appear** for a short-term-rooms register, which the same alineat carves out.
 *
 * The clock is pinned to the shared instant as in every other spec: the deadline card classifies against
 * today, and an unpinned date moves what the assertion reads.
 */

async function fixClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(fixedInstant());
}

function payloadWith(over: Partial<AppData>): SeedPayload {
  const payload = seedPayload();
  return { ...payload, ...over, profile: { ...payload.profile, ...(over.profile ?? {}) } } as SeedPayload;
}

/** A profile with an ordinary lease declared for the year the fixture declares (2026). */
function withLease(over: Partial<NonNullable<AppData['profile']['leaseFactsYears']>[number]> = {}): SeedPayload {
  return payloadWith({
    profile: {
      leaseFactsYears: [{ fiscalYear: 2026, tenantNature: 'entitate_cu_evidenta_contabila', ...over }],
    },
  });
}

test.describe('B-105 — the lease facts are declared, never inferred', () => {
  test('every lease control starts empty, and the empty state says so', async ({ page }) => {
    await seedBrowserOnce(page, payloadWith({}));
    await fixClock(page);
    await page.goto('/settings#!/fiscal');

    await expect(page.locator('[data-lease-block]')).toBeVisible();
    await expect(page.locator('[data-lease-tenant]')).toHaveValue('');
    await expect(page.locator('[data-lease-in-kind]')).toHaveValue('');
    await expect(page.locator('[data-lease-guarantee]')).toHaveValue('');
    await expect(page.locator('[data-lease-registered]')).toHaveValue('');
    await expect(page.locator('[data-lease-rent]')).toHaveValue('');
    await expect(page.locator('[data-lease-owner-costs]')).toHaveValue('');
    await expect(page.locator('[data-lease-concluded]')).toHaveValue('');

    // The unanswered state, in words — and the reason it stays unanswered.
    await expect(page.locator('[data-lease-tenant-hint]')).toContainText('Fără răspuns');
    await expect(page.locator('[data-lease-tenant-hint]')).toContainText('nu alege regimul');
    // No regime is asserted for a profile that never named a tenant.
    await expect(page.locator('[data-lease-regime-applied]')).toHaveCount(0);
  });

  test('a corporate tenant states the art. 84^1 consequence, including what stays on the return', async ({ page }) => {
    await seedBrowserOnce(page, payloadWith({}));
    await fixClock(page);
    await page.goto('/settings#!/fiscal');

    await page.locator('[data-lease-tenant]').selectOption('entitate_cu_evidenta_contabila');
    const applied = page.locator('[data-lease-regime-applied]');
    await expect(applied).toBeVisible();
    await expect(applied).toContainText('art. 84^1');
    await expect(applied).toContainText('impozit final');
    // The half most implementations lose: „withheld and final” removes the income tax from the Declarația
    // Unică, not the return itself.
    await expect(applied).toContainText('contribuțiile sociale');

    await page.locator('[data-lease-concluded]').fill('2026-10-20');
    // The fiscal form commits on save, like every other fact on this tab — the assertion below is about the
    // bytes that come back, not about the form state.
    await page.getByRole('button', { name: 'Salvează' }).click();
    await page.reload();
    await page.goto('/settings#!/fiscal');

    // Persisted per fiscal year, and read back rather than re-derived on load.
    await expect(page.locator('[data-lease-tenant]')).toHaveValue('entitate_cu_evidenta_contabila');
    await expect(page.locator('[data-lease-concluded]')).toHaveValue('2026-10-20');
  });

  test('the 30-day contract-registration term appears for an ordinary rent register', async ({ page }) => {
    await seedBrowserOnce(page, withLease({ contractDate: '2026-10-20' }));
    await fixClock(page);
    await page.goto('/dashboard');

    const row = page.locator('[data-deadline-done]').locator('..');
    await expect(row.filter({ hasText: 'Înregistrarea contractului de locațiune' }).first()).toBeVisible();
    // 20 days from the contract, not a date the app chose: art. 83 alin. (5) says „cel mult 30 de zile”.
    await expect(row.filter({ hasText: 'Înregistrarea contractului de locațiune' }).first()).toContainText('19.11.2026');
  });

  test('the term does NOT appear for a short-term-rooms register, which the alineat carves out', async ({ page }) => {
    await seedBrowserOnce(
      page,
      payloadWith({
        profile: {
          activityFamily: 'cazare',
          accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 3 }],
          leaseFactsYears: [{ fiscalYear: 2026, tenantNature: 'persoana_fizica', contractDate: '2026-10-20' }],
        },
      }),
    );
    await fixClock(page);
    await page.goto('/dashboard');

    await expect(page.locator('body')).not.toContainText('Înregistrarea contractului de locațiune');
  });
});
