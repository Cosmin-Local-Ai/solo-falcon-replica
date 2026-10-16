import { test, expect, type Page } from '@playwright/test';
import { fixedInstant } from '../src/test/fixedInstant';
import { seedPayload, seedBrowserOnce, type SeedPayload } from './fixtures';
import type { AppData } from '../src/data/types';

/**
 * PG-6b (B-29) — the activity family, in a browser, from stored data.
 *
 * PG-6a proved the framework in a browser against the regime refusal, and reported honestly that the
 * art. 68^3 cazare refusal could not be reached from a payload because nobody supplied the fact. This spec
 * is the fact. Every case starts from a persisted profile — never a hand-built classification context —
 * because the defect was never that the app could not refuse; it was that no path led to the refusal.
 *
 * PG-6h-1 re-premised the first case rather than deleting it. The method is implemented now, so the refusal
 * an FY2026 cazare register gets is `accommodation-gross-undetermined` — the two open questions about the
 * gross — and not `no-expense-engine`. The browser still shows no figure either way; what changed is that
 * the sentence beside it is now true.
 *
 * Four things are proven here:
 *   1. a profile that declares cazare gets `Nu putem calcula`, the rule's own sentence once, no figure,
 *      and a link that lands on the control that changes the answer;
 *   2. changing that answer in Settings and reloading returns the profile to a computed estimate — the
 *      round trip, in the browser, not only in a unit test;
 *   3. a profile that was never answered is `incomplete`, not `refused` and not `complete`, and the row
 *      points at the same control;
 *   4. a CAEN 5510 profile with no answer is not refused for its code — the refusal follows the declared
 *      fact and nothing else.
 *
 * The clock is pinned to the shared instant as in every other spec here: the coverage denominator and the
 * fiscal-year view are period-scoped, and an unpinned date moves what these assertions read.
 */

async function fixClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(fixedInstant());
}

function profileWith(over: Partial<AppData['profile']>): SeedPayload {
  const payload = seedPayload();
  return { ...payload, profile: { ...payload.profile, ...over } } as SeedPayload;
}

/** The demo profile declares a family, so "never asked" has to be built by removing it. */
function profileWithoutAnswer(over: Partial<AppData['profile']> = {}): SeedPayload {
  const payload = seedPayload();
  const profile = { ...payload.profile, ...over } as AppData['profile'] & { activityFamily?: string };
  delete profile.activityFamily;
  return { ...payload, profile } as SeedPayload;
}

test.describe('PG-6b — a declared cazare activity is refused, from stored data', () => {
  test('the hero refuses, names the rule once, shows no figure, and links to the control', async ({ page }) => {
    await seedBrowserOnce(page, profileWith({ activityFamily: 'cazare' }));
    await fixClock(page);
    await page.goto('/dashboard');

    const badge = page.locator('.badge[data-estimate-state="refused"]');
    await expect(badge).toHaveCount(1);
    await expect(badge).toHaveText('Nu putem calcula');

    const block = page.locator('[data-scenario-refusal="accommodation-gross-undetermined"]');
    await expect(block).toBeVisible();
    // PG-6h-1 moved which entry refuses an FY2026 cazare register. `no-expense-engine` said this build had
    // no method for the activity; the flat-ratio method now exists, so that sentence would be false. What
    // still stops the figure is the gross, and the block quotes the two readings the rule records as open
    // — in the rule's words, not a paraphrase the UI wrote about accommodation income.
    await expect(block.locator('[data-scenario-detail="accommodation-gross-undetermined"]')).toContainText(
      'Citește A',
    );
    await expect(block.locator('[data-scenario-detail="accommodation-gross-undetermined"]')).toContainText(
      'Citește B',
    );
    await expect(block.locator('[data-scenario-detail="accommodation-gross-undetermined"]')).toContainText(
      'Citește A',
    );
    await expect(block.locator('[data-scenario-detail="accommodation-gross-undetermined"]')).toContainText(
      'Citește B',
    );
    // The framing sentence — that the method exists and the gross is what is missing — is copy, and it is
    // the only place the 30 % / 10 % arithmetic is stated in this block. The detail below it carries the
    // rule's two readings verbatim and does not repeat it.
    await expect(block.locator('.hint').first()).toContainText('cheltuieli forfetare de 30 %');
    // Re-pinned for PG-6h-2 (replaced, not deleted): the sentence now names the room count as one of the
    // three answers that decide the gross, and says the strongest version of the same guarantee — none of
    // them is filled in from a CAEN code, and none by default. The old phrase ('nu alege în locul tău')
    // asserted one refusal not to choose; this one names where a choice would otherwise have come from.
    await expect(block.locator('.hint').first()).toContainText('Niciunul nu se completează din codul CAEN');
    await expect(block.locator('.hint').first()).toContainText('câte camere închiriezi pe termen scurt');
    // Rendered once. The chart points at this block instead of quoting the paragraph a second time.
    await expect(page.locator('[data-scenario-detail="accommodation-gross-undetermined"]')).toHaveCount(1);

    // No figure beside a refusal, in the hero or in the cockpit strip.
    // B-28 re-pin: the slot used to print `—`, the glyph the pending state prints. A refusal now prints its
    // own word, which is what makes this assertion prove "refused" rather than "not yet".
    const hero = page.locator('section.card').filter({ has: page.locator('.tax-hero-value') });
    await expect(hero.locator('.tax-hero-value')).toHaveText('Calcul refuzat');
    const cockpit = page.locator('.stat-card').filter({ hasText: 'Impozit estimat' });
    await expect(cockpit.locator('.value')).toHaveText('Calcul refuzat');
  });

  test('the fix link lands on the control that changes the answer, and shows the stored value', async ({ page }) => {
    await seedBrowserOnce(page, profileWith({ activityFamily: 'cazare' }));
    await fixClock(page);
    await page.goto('/dashboard');

    const link = page.locator('[data-scenario-refusal]').getByRole('link', { name: 'Deschide' });
    await expect(link).toHaveAttribute('href', '/settings#!/fiscal');
    await link.click();

    await expect(page).toHaveURL(/\/settings#!\/fiscal/);
    await expect(page.locator('[data-activity-family]')).toHaveValue('cazare');
  });

  test('changing the answer in Settings and reloading returns the estimate — the round trip', async ({ page }) => {
    // `seedBrowserOnce`, not `seedBrowser`: `addInitScript` re-runs on every document, so a re-seeding spec
    // would overwrite the value the UI just saved and the reload would prove nothing.
    await seedBrowserOnce(page, profileWith({ activityFamily: 'cazare' }));
    await fixClock(page);
    await page.goto('/settings#!/fiscal');

    await expect(page.locator('[data-activity-family]')).toHaveValue('cazare');
    await page.selectOption('[data-activity-family]', 'other');
    await page.getByRole('button', { name: 'Salvează' }).click();

    await page.reload();
    await page.goto('/dashboard');

    await expect(page.locator('[data-scenario-refusal]')).toHaveCount(0);
    await expect(page.locator('.badge[data-estimate-state="refused"]')).toHaveCount(0);
    await expect(page.locator('.badge[data-estimate-state="complete"]')).toHaveCount(1);
    // The answer survived the reload — it is a stored profile fact, not form state.
    await page.goto('/settings#!/fiscal');
    await expect(page.locator('[data-activity-family]')).toHaveValue('other');
  });
});

test.describe('PG-6b — an unanswered profile is incomplete, and no CAEN code answers for it', () => {
  test('no answer is `incomplete`, with a row naming the gap and linking to the control', async ({ page }) => {
    await seedBrowserOnce(page, profileWithoutAnswer());
    await fixClock(page);
    await page.goto('/dashboard');

    const badge = page.locator('.badge[data-estimate-state="incomplete"]');
    await expect(badge).toHaveCount(1);
    await expect(badge).toHaveText('Estimare incompletă');
    // Not a refusal: a fact the person can still supply is a different claim from a case the law does not
    // let this build compute, and the two must never share a badge.
    await expect(page.locator('.badge[data-estimate-state="refused"]')).toHaveCount(0);
    await expect(page.locator('[data-scenario-refusal]')).toHaveCount(0);

    const row = page.locator('[data-coverage-reason="fact_missing"]');
    await expect(row).toBeVisible();
    await expect(row).toContainText('faptă de profil care lipsește');
    await row.getByRole('link', { name: 'Deschide înregistrarea' }).click();
    await expect(page).toHaveURL(/\/settings#!\/fiscal/);
    await expect(page.locator('[data-activity-family]')).toHaveValue('');
  });

  test('a CAEN 5510 register with no answer is not refused for its code (acceptance 5)', async ({ page }) => {
    await seedBrowserOnce(
      page,
      profileWithoutAnswer({
        identity: {
          ...seedPayload().profile.identity,
          caen: [{ cod: '5510', descriere: 'Hoteluri' }],
        },
      }),
    );
    await fixClock(page);
    await page.goto('/dashboard');

    // The code says "accommodation" to a reader and the app still does not treat it as an answer: the
    // profile is incomplete, not refused. `research/30` §3 is the authority — the nomenclator's CAEN
    // columns are „menționate cu titlu exemplificativ”, so a code is not a statement about the method.
    await expect(page.locator('.badge[data-estimate-state="refused"]')).toHaveCount(0);
    await expect(page.locator('[data-scenario-refusal]')).toHaveCount(0);
    await expect(page.locator('.badge[data-estimate-state="incomplete"]')).toHaveCount(1);
  });

  test('a declared `other` under the same CAEN 5510 register computes, and the gap is gone', async ({ page }) => {
    await seedBrowserOnce(
      page,
      profileWith({
        activityFamily: 'other',
        identity: {
          ...seedPayload().profile.identity,
          caen: [{ cod: '5510', descriere: 'Hoteluri' }],
        },
      }),
    );
    await fixClock(page);
    await page.goto('/dashboard');

    await expect(page.locator('.badge[data-estimate-state="complete"]')).toHaveCount(1);
    await expect(page.locator('[data-coverage-reason="fact_missing"]')).toHaveCount(0);
  });
});
