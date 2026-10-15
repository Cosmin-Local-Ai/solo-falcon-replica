import { test, expect, type Page } from '@playwright/test';
import { fixedInstant } from '../src/test/fixedInstant';
import { seedPayload, seedBrowser, type SeedPayload } from './fixtures';
import type { AppData, Expense } from '../src/data/types';
import { ron } from '../src/domain/money';

/**
 * PG-6a — the scenario-support framework, in a browser.
 *
 * Acceptance criterion 2: a refusal renders as „Nu putem calcula” plus the reason plus a **working**
 * fix link, and no number appears beside it. Criterion 3: `incomplete` and `refuse` are distinguishable
 * in the UI and neither is a proxy for the other.
 *
 * The case is the regime refusal, and it is chosen deliberately rather than conveniently. It is the
 * scenario the app can already reach from stored data — the classifier's art. 68^3 cazare refusal cannot
 * be reached from a payload at all, because no caller supplies the activity-family fact, and that is
 * PG-6b's job. A framework proven only against a stub would be exactly the "framework with only demo
 * scenarios in it" the brief rules out, so the Playwright proof runs the case that is genuinely live.
 *
 * The clock is pinned to the shared instant, as in every other spec here: the coverage denominator and
 * the fiscal-year view are period-scoped, and an unpinned date moves the figures this spec asserts on.
 */

async function fixClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(fixedInstant());
}

function refusedProfile(payload: SeedPayload): SeedPayload {
  return { ...payload, profile: { ...payload.profile, regime: 'impozit_pe_cit' } } as SeedPayload;
}

function uncategorisedExpense(): Expense {
  return {
    id: 'pg6a-uncat',
    tip: 'factura',
    nr: 'CH-PG6A-001',
    date: '2026-05-10',
    furnizor: 'Furnizor Test SRL',
    cui: 'RO99999999',
    valoareFaraTva: ron(2000),
    tva: ron(400),
    status: 'inregistrata',
  };
}

function payloadWith(over: Partial<AppData>): SeedPayload {
  return { ...seedPayload(), ...over } as SeedPayload;
}

test.describe('PG-6a — a refusal replaces the number and says how to fix it', () => {
  test('the hero says „Nu putem calcula”, names the rule, and shows no figure', async ({ page }) => {
    await seedBrowser(page, refusedProfile(seedPayload()));
    await fixClock(page);
    await page.goto('/dashboard');

    const badge = page.locator('.badge[data-estimate-state="refused"]');
    await expect(badge).toHaveCount(1);
    await expect(badge).toHaveText('Nu putem calcula');

    // The reason is the rule's own sentence, with its citations — not a paraphrase written by the UI.
    const block = page.locator('[data-scenario-refusal="regime-not-computable"]');
    await expect(block).toBeVisible();
    await expect(block.locator('[data-scenario-detail="regime-not-computable"]')).toContainText(
      'nu poate aparține unui PFA',
    );
    await expect(block.locator('[data-scenario-detail="regime-not-computable"]')).toContainText(
      'art. 13 alin. (1)',
    );

    // No number beside the refusal, in the hero or in the cockpit strip. A `0` here would be a fiscal
    // claim about a calculation that never ran.
    //
    // B-28 re-pin: this used to assert `—`, and the comment recorded that the ambiguity with the loading
    // state "stays unresolved". It is resolved — `—` is the pending token, and a refusal prints its own
    // word in both surfaces.
    const hero = page.locator('section.card').filter({ has: page.locator('.tax-hero-value') });
    await expect(hero.locator('.tax-hero-value')).toHaveText('Calcul refuzat');
    const cockpit = page.locator('.stat-card').filter({ hasText: 'Impozit estimat' });
    await expect(cockpit.locator('.value')).toHaveText('Calcul refuzat');
  });

  test('the fix link is a real route and lands on the control that settles the scenario', async ({ page }) => {
    await seedBrowser(page, refusedProfile(seedPayload()));
    await fixClock(page);
    await page.goto('/dashboard');

    const link = page.locator('[data-scenario-refusal]').getByRole('link', { name: 'Deschide' });
    await expect(link).toHaveAttribute('href', '/settings#!/fiscal');
    await link.click();

    await expect(page).toHaveURL(/\/settings#!\/fiscal/);
    // Not merely the right page: the field the scenario points at, still carrying the bad value.
    await expect(
      page.locator('section.card').filter({ hasText: 'Regim fiscal nesusținut' }),
    ).toContainText('nu poate aparține unui PFA');
    await expect(page.locator('select.input').first()).toHaveValue('impozit_pe_cit');
  });

  test('the cited paragraph is rendered once, and the chart points at it instead of repeating it', async ({ page }) => {
    await seedBrowser(page, refusedProfile(seedPayload()));
    await fixClock(page);
    await page.goto('/dashboard');

    await expect(page.locator('[data-scenario-detail="regime-not-computable"]')).toHaveCount(1);
    const note = page.locator('.chart-tax-note[data-estimate-state="refused"]');
    await expect(note).toBeVisible();
    await expect(note).toContainText('motivul este redat integral în secțiunea Estimare impozit');
    await expect(note).not.toContainText('nu poate aparține unui PFA');
  });

  test('`refused` and `incomplete` stay distinct, and a refusal does not hide the coverage rows', async ({ page }) => {
    // A register with a record the estimate would drop, under a profile the app refuses to compute.
    // The hero must say the one true thing (no figure exists) without deleting the other true thing
    // (this record is outside the figure) — and the two states must not collapse into one badge.
    await seedBrowser(page, {
      ...payloadWith({ expenses: [...seedPayload().expenses, uncategorisedExpense()] }),
      profile: { ...seedPayload().profile, regime: 'impozit_pe_cit' },
    } as SeedPayload);
    await fixClock(page);
    await page.goto('/dashboard');

    await expect(page.locator('.badge[data-estimate-state="refused"]')).toHaveCount(1);
    await expect(page.locator('.badge[data-estimate-state="incomplete"]')).toHaveCount(0);
    await expect(page.locator('[data-coverage-reason="unclassified"]')).toBeVisible();
    await expect(page.locator('[data-coverage-count]')).toHaveAttribute('data-coverage-count', '1');
  });

  test('an engine refusal is still `review_required`, not a refusal', async ({ page }) => {
    // A year this build has no rules for: the assembler runs and the engine declines. That is a
    // conclusion withheld by a calculation, and it must not borrow the refusal's word — the two states
    // are the distinction the whole framework exists to keep.
    await seedBrowser(page, {
      ...seedPayload(),
      profile: { ...seedPayload().profile, fiscalYear: 2027 },
    } as SeedPayload);
    await page.clock.setFixedTime(new Date('2027-01-15T10:00:00+02:00'));
    await page.goto('/dashboard');

    await expect(page.locator('.badge[data-estimate-state="review_required"]').first()).toBeVisible();
    await expect(page.locator('.badge[data-estimate-state="refused"]')).toHaveCount(0);
    await expect(page.locator('[data-scenario-refusal]')).toHaveCount(0);
  });
});
