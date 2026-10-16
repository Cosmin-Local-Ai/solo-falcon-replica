import { test, expect } from '@playwright/test';
import { onboarding, settings as settingsCopy, shell } from '../src/ui/copy';
import { STORAGE_KEY } from './fixtures';

/**
 * Phase 11 / PG-3 — the first run, proven in a browser.
 *
 * Acceptance criterion 1 says this has to be proven in Playwright, not in a unit test, and the reason is
 * structural: every unit test of the store asserts on a value (`dataOrigin`), while the defect was a
 * *screen*. A fresh browser profile used to open on "Bună, Andrei" with four demo invoices and
 * "Dobre Radu" in the topbar, because `store.tsx` handed a first run the demo fixture and production
 * code only ever branched on `'quarantined'` — never on `'seed'`. No assertion on a store field could
 * have caught that. These tests assert on what is on screen.
 *
 * The fixture is imported from `src/ui/copy` rather than retyped here: a spec that hardcodes the sentence
 * it is looking for passes when the sentence changes and the screen breaks.
 */

/** A brand-new browser context: no localStorage, no session storage, nothing stored. */
test.describe('First run — a fresh profile with zero stored entries', () => {
  test('opens on onboarding, with no demo records and no pre-filled name', async ({ page }) => {
    await page.goto('/');

    // The precondition, asserted rather than assumed: this profile really does hold nothing.
    expect(await page.evaluate(() => localStorage.length)).toBe(0);

    await expect(page.getByRole('heading', { name: onboarding.title })).toBeVisible();

    // No demo invoice, no demo client, no demo taxpayer — anywhere on the page.
    await expect(page.getByText('FCT-2026-001')).toHaveCount(0);
    await expect(page.getByText('Codexa SRL')).toHaveCount(0);
    await expect(page.getByText('Dobre Radu')).toHaveCount(0);

    // The topbar carries no identity: no name, no avatar initials.
    await expect(page.locator('.topbar-user')).toHaveCount(0);
    // And the app did not quietly persist an empty shell to make the next load look "persisted".
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
  });

  test('states its scope before the person has trusted any figure (B-51)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: onboarding.title })).toBeVisible();

    // One shared copy key (`src/ui/copy/common.ts` → `scope`), on the surface where it is read before any
    // figure exists on screen. Asserted as fragments, not as the whole sentence: the content pins live in
    // `src/pages/scope.statement.test.tsx`, and a spec that retypes a paragraph breaks on every comma.
    await expect(page.locator('[data-scope-statement]')).toBeVisible();
    await expect(page.locator('[data-scope-statement]')).toContainText('sunt estimări');
    await expect(page.locator('[data-scope-statement]')).toContainText('Nimic nu se depune');
  });
});

test.describe('First run — validation and refusal', () => {
  test('refuses to proceed without a PFA start date', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: onboarding.title })).toBeVisible();

    await page.getByLabel(onboarding.fields.nume).fill('Dobre Radu');
    await page.getByRole('button', { name: onboarding.actions.finish }).click();

    await expect(page.getByText(onboarding.errors.startDateRequired)).toBeVisible();
    // Still on onboarding, and still nothing stored.
    await expect(page.getByRole('heading', { name: onboarding.title })).toBeVisible();
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
  });

  test('norma de venit reaches an explicit refusal screen that shows no estimate', async ({ page }) => {
    await page.goto('/');

    // `click()`, not `check()`: choosing the regime replaces the form with the refusal screen, so the
    // radio the click started on is gone before Playwright can re-read its checked state.
    await page.locator('[data-regime="norma_venit"] input').click();

    await expect(page.getByText(onboarding.refusal.title)).toBeVisible();
    // The screen states that it shows no figure — and it shows none.
    await expect(page.locator('[data-onboarding="no-estimate"]')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('RON');
    await expect(page.locator('.tax-hero-value')).toHaveCount(0);
    await expect(page.locator('.stat-card')).toHaveCount(0);
  });
});

test.describe('First run — completing onboarding', () => {
  test('writes the collected facts and opens the dashboard with the name that was typed', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel(onboarding.fields.nume).fill('Ionescu Maria');
    await page.getByLabel(onboarding.fields.startDate).fill('2026-03-01');
    await page.getByRole('button', { name: onboarding.actions.finish }).click();

    await expect(page.getByRole('heading', { name: 'Tablou de bord' })).toBeVisible();
    // The name in the chrome is the one the person typed, not a fixture's.
    await expect(page.locator('.topbar-user')).toContainText('Ionescu Maria');
    // And it is stored, so the next load is a real one rather than a first run again.
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).not.toBeNull();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Tablou de bord' })).toBeVisible();
  });

  test('with zero records the dashboard still shows the next deadline, completeness and next steps', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(onboarding.fields.nume).fill('Ionescu Maria');
    await page.getByLabel(onboarding.fields.startDate).fill('2026-03-01');
    await page.getByRole('button', { name: onboarding.actions.finish }).click();

    await expect(page.getByRole('heading', { name: 'Nicio înregistrare de venit sau cheltuială' })).toBeVisible();
    await expect(page.getByText('Depunere D212')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Completitudine date' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ce trebuie să faci' })).toBeVisible();
  });
});

test.describe('First run — the demo sandbox is opt-in', () => {
  test('loads marked demo data, and a reload does not make it the initial state', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: onboarding.demo.action }).click();

    // Marked where it is seen, not only where it was switched on.
    await expect(page.getByText(shell.sandboxTitle)).toBeVisible();
    // The fixture is on screen: the sidebar names the demo taxpayer and the cockpit carries the
    // fixture's own annual revenue figure.
    await expect(page.locator('.sidebar-identity')).toContainText('Dobre Radu PFA');
    await expect(page.getByRole('heading', { name: 'Tablou de bord' })).toBeVisible();

    await page.reload();

    // Never the initial state: the sandbox was in memory and was never written.
    await expect(page.getByRole('heading', { name: onboarding.title })).toBeVisible();
    await expect(page.locator('.sidebar-identity')).toHaveCount(0);
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
  });
});

test.describe('First run — „Șterge toate datele și începe de la zero”', () => {
  test('confirms, then lands back on onboarding rather than on the demo', async ({ page }) => {
    // Get to a state with real stored data first.
    await page.goto('/');
    await page.getByLabel(onboarding.fields.nume).fill('Ionescu Maria');
    await page.getByLabel(onboarding.fields.startDate).fill('2026-03-01');
    await page.getByRole('button', { name: onboarding.actions.finish }).click();
    await expect(page.getByRole('heading', { name: 'Tablou de bord' })).toBeVisible();

    await page.getByRole('link', { name: /Setări/ }).click();
    await page.getByRole('button', { name: settingsCopy.tabs.data }).click();
    await page.getByRole('button', { name: settingsCopy.data.dangerAction }).click();

    // The confirmation is a real gate: cancelling leaves the data alone.
    await expect(page.getByText(settingsCopy.data.confirmTitle)).toBeVisible();
    await page.getByRole('button', { name: settingsCopy.data.confirmCancel }).click();
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).not.toBeNull();

    await page.getByRole('button', { name: settingsCopy.data.dangerAction }).click();
    await page.getByRole('button', { name: settingsCopy.data.confirmGo }).click();

    await expect(page.getByRole('heading', { name: onboarding.title })).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
    // Not the demo, either.
    await expect(page.getByText('Dobre Radu')).toHaveCount(0);
    await expect(page.getByText('FCT-2026-001')).toHaveCount(0);
  });
});
