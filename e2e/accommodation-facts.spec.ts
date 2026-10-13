import { test, expect, type Page } from '@playwright/test';
import { fixedInstant } from '../src/test/fixedInstant';
import { seedPayload, seedBrowserOnce, type SeedPayload } from './fixtures';
import type { AppData } from '../src/data/types';

/**
 * PG-6h-2 (B-82, B-83, B-84) — the accommodation facts, in a browser, from stored data.
 *
 * Every case starts from a persisted profile, never from a hand-built classification context. That is the
 * standard PG-6b set, and it is the whole point of a fact-supplying task: a fact that only exists in a unit
 * fixture has not reached the user.
 *
 * What is proven here, in order:
 *
 *   1. **the unknown state** — a cazare profile with no room count is refused, both rule questions are
 *      still open, and no income title is asserted (acceptance 1);
 *   2. **the category switch** — 3 rooms and 9 rooms produce two *different* refusals, and the 1–7 case
 *      says out loud that the income is *cedarea folosinței bunurilor*, citing art. 83 alin. (2) and
 *      art. 85 (acceptance 2);
 *   3. **per year** — the same profile shape with a count recorded for the declared year gives the other
 *      title, so the count is not one scalar across the profile's life (acceptance 3);
 *   4. **the commission choice survives a reload** and is shown as the person's choice with the
 *      alternative named beside it (acceptance 4);
 *   5. **a CAEN code prompts and never answers** — a Division 55 code opens the questions with every one
 *      of them blank, and does not refuse a register on the strength of the code (acceptance 5).
 *
 * The clock is pinned to the shared instant as in every other spec: the coverage denominator and the
 * fiscal-year view are period-scoped, and an unpinned date moves what these assertions read.
 */

async function fixClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(fixedInstant());
}

function profileWith(over: Partial<AppData['profile']>): SeedPayload {
  const payload = seedPayload();
  return { ...payload, profile: { ...payload.profile, ...over } } as SeedPayload;
}

/** A cazare profile with a room count recorded for the year the profile declares (2026 in the fixture). */
function cazareWithRooms(rooms: number): SeedPayload {
  return profileWith({
    activityFamily: 'cazare',
    accommodationRoomCounts: [{ fiscalYear: 2026, rooms }],
  });
}

/**
 * B-88 — the five ladder categories the app cannot compute, declared as zeros.
 *
 * An art. 85 register supplies the sixth (cedarea folosinței) itself, from its own receipts, so without these
 * five the art. 170 alin. (4) sum is unknown and the engine stops there. A declared zero is a fact; an empty
 * box is not — that is the B-41 rule, and the second test below is the same profile without these answers.
 */
function ladderZeros(): SeedPayload {
  return profileWith({
    activityFamily: 'cazare',
    accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 3 }],
    cassLadderYears: [
      {
        fiscalYear: 2026,
        proprietateIntelectuala: 0,
        asocierePersoanaJuridica: 0,
        activitatiAgricole: 0,
        investitii: 0,
        alteSurse: 0,
        cedareaSursa: 'patrimoniu_personal',
      },
    ],
  });
}

test.describe('PG-6h-2 — an unrecorded room count stays unknown (acceptance 1)', () => {
  test('a cazare profile with no room count is refused, with both rule questions open and no figure', async ({
    page,
  }) => {
    await seedBrowserOnce(page, profileWith({ activityFamily: 'cazare' }));
    await fixClock(page);
    await page.goto('/dashboard');

    const badge = page.locator('.badge[data-estimate-state="refused"]');
    await expect(badge).toHaveCount(1);
    await expect(badge).toHaveText('Nu putem calcula');

    const block = page.locator('[data-scenario-refusal="accommodation-gross-undetermined"]');
    await expect(block).toBeVisible();
    // Both readings of alin. (3) and the alin. (1) gate stay open while the title is undecided.
    const detail = block.locator('[data-scenario-detail="accommodation-gross-undetermined"]');
    await expect(detail).toContainText('Citește A');
    await expect(detail).toContainText('Citește B');
    await expect(detail).toContainText('autorizația ONRC');

    // No title is asserted anywhere on the refusal: silence about the count is not cedarea, and it is not
    // art. 68^3 either.
    await expect(page.locator('[data-scenario-refusal="accommodation-title-cedarea-folosintei"]')).toHaveCount(0);

    const hero = page.locator('section.card').filter({ has: page.locator('.tax-hero-value') });
    await expect(hero.locator('.tax-hero-value')).toHaveText('—');
  });

  test('Settings says the count is not recorded, and names neither title', async ({ page }) => {
    await seedBrowserOnce(page, profileWith({ activityFamily: 'cazare' }));
    await fixClock(page);
    await page.goto('/settings#!/fiscal');

    await expect(page.locator('[data-accommodation-block]')).toBeVisible();
    await expect(page.locator('[data-accommodation-rooms]')).toHaveValue('');
    await expect(page.locator('[data-accommodation-title]')).toContainText('nu este înregistrat');
  });
});

test.describe('B-88 — 1–7 camere is measured under art. 85, not refused for want of a rule', () => {
  test('3 rooms with the other five ladder categories declared produces a figure, on art. 85 lines', async ({
    page,
  }) => {
    await seedBrowserOnce(page, ladderZeros());
    await fixClock(page);
    await page.goto('/dashboard');

    // The title refusal used to be this register's answer because the package had no art. 85 rule. The rule
    // exists for FY2026, so nothing refuses at the scenario layer.
    await expect(page.locator('[data-scenario-refusal]')).toHaveCount(0);

    const hero = page.locator('.tax-hero-value').first();
    await expect(hero).not.toHaveText('—');

    // The engine's own lines name the article, so the screen cannot present a 68^3 calculation for a
    // cedarea folosinței income. The rows are the engine's, opened through the existing disclosure.
    await page.getByText('Cum am ajuns la această sumă').click();
    const rows = page.locator('.estimate-breakdown .breakdown-table th');
    await expect(rows.filter({ hasText: 'Venit net art. 85' })).toHaveCount(1);
    await expect(rows.filter({ hasText: 'Cheltuieli forfetare 30 % (art. 85 alin. (2))' })).toHaveCount(1);
    await expect(rows.filter({ hasText: 'Impozit art. 85 (10 %, impozitul fiind final)' })).toHaveCount(1);
    // And the line that must NOT be there: the sistem-real expense line, which this taxpayer never kept.
    await expect(rows.filter({ hasText: 'Cheltuieli deductibile' })).toHaveCount(0);
  });

  test('3 rooms with the ladder left unanswered stops on the ladder, not on a scenario refusal', async ({
    page,
  }) => {
    await seedBrowserOnce(page, cazareWithRooms(3));
    await fixClock(page);
    await page.goto('/dashboard');

    await expect(page.locator('[data-scenario-refusal]')).toHaveCount(0);
    const note = page.locator('.estimate-state-note');
    await expect(note).toHaveAttribute('data-estimate-state', 'review_required');
    // `review_required` and `refused` are different states and the badge says so: an engine ran and
    // withheld a conclusion, which is not the same sentence as a register the app would not compute at all.
    await expect(page.locator('.badge[data-estimate-state]')).toHaveAttribute('data-estimate-state', 'review_required');
    // No figure is offered while the art. 170 alin. (4) sum is unknown.
    const hero = page.locator('section.card').filter({ has: page.locator('.tax-hero-value') });
    await expect(hero.locator('.tax-hero-value')).toHaveText('—');
  });
});

test.describe('PG-6h-2 — the room count switches the income title (acceptance 2)', () => {
  test('9 rooms is the other title, and the refusal is the unsettled gross', async ({ page }) => {
    await seedBrowserOnce(page, cazareWithRooms(9));
    await fixClock(page);
    await page.goto('/dashboard');

    await expect(page.locator('[data-scenario-refusal="accommodation-gross-undetermined"]')).toHaveCount(1);
    await expect(page.locator('[data-scenario-refusal="accommodation-title-cedarea-folosintei"]')).toHaveCount(0);
  });

  test('Settings states which title the recorded count puts the income under', async ({ page }) => {
    await seedBrowserOnce(page, cazareWithRooms(3));
    await fixClock(page);
    await page.goto('/settings#!/fiscal');

    await expect(page.locator('[data-accommodation-rooms]')).toHaveValue('3');
    const title = page.locator('[data-accommodation-title]');
    await expect(title).toContainText('cedarea folosinței bunurilor');
    await expect(title).toContainText('art. 83 alin. (2)');
    await expect(title).toContainText('art. 85');
  });
});

test.describe('PG-6h-2 — the count is per fiscal year (acceptance 3)', () => {
  test('a count recorded for 2026 does not decide anything while the profile declares 2026 with no count', async ({
    page,
  }) => {
    // The count belongs to 2027; the profile declares 2026. Reading it anyway would be the single-scalar
    // mistake — art. 83 alin. (4) speaks „începând cu anul fiscal în care”.
    await seedBrowserOnce(
      page,
      profileWith({ activityFamily: 'cazare', accommodationRoomCounts: [{ fiscalYear: 2027, rooms: 9 }] }),
    );
    await fixClock(page);
    await page.goto('/dashboard');

    await expect(page.locator('[data-scenario-refusal="accommodation-gross-undetermined"]')).toHaveCount(1);
  });

  test('recording the count for the declared year changes the title after a reload', async ({ page }) => {
    await seedBrowserOnce(page, profileWith({ activityFamily: 'cazare' }));
    await fixClock(page);
    await page.goto('/settings#!/fiscal');

    await page.locator('[data-accommodation-rooms]').fill('3');
    await page.getByRole('button', { name: 'Salvează' }).click();

    await page.reload();
    await page.goto('/dashboard');

    // The answer survived the reload — it is a stored per-year fact, not form state. B-88 changed what it
    // moves: a 1–7 count used to switch this register from the unsettled-gross refusal to the title refusal,
    // and now it selects the art. 85 rule instead, so no scenario refuses it. What still stops the figure is
    // the art. 170 alin. (4) sum, which the app cannot complete from the register alone.
    await expect(page.locator('[data-scenario-refusal]')).toHaveCount(0);
    await expect(page.locator('.badge[data-estimate-state]')).toHaveAttribute('data-estimate-state', 'review_required');
    await page.goto('/settings#!/fiscal');
    await expect(page.locator('[data-accommodation-rooms]')).toHaveValue('3');
  });
});

test.describe('PG-6h-2 — the commission reading is the user’s choice, with the alternative visible (acceptance 4)', () => {
  test('choosing a reading persists it, and Settings shows which one was applied beside the other', async ({
    page,
  }) => {
    await seedBrowserOnce(page, cazareWithRooms(9));
    await fixClock(page);
    await page.goto('/settings#!/fiscal');

    await expect(page.locator('[data-accommodation-commission]')).toHaveValue('');
    await page.locator('[data-accommodation-commission]').selectOption('reading_a');
    await page.getByRole('button', { name: 'Salvează' }).click();

    await page.reload();
    await page.goto('/settings#!/fiscal');

    await expect(page.locator('[data-accommodation-commission]')).toHaveValue('reading_a');
    const applied = page.locator('[data-accommodation-commission-applied]');
    await expect(applied).toContainText('citirea A');
    // The alternative stays visible: a choice shown without its alternative reads like a finding the app
    // reached on its own, which is exactly what D-COM-1 forbids.
    await expect(applied).toContainText('Cealaltă citire posibilă, B');
  });

  test('answering the commission question retires its question from the refusal, and still produces no figure', async ({
    page,
  }) => {
    await seedBrowserOnce(
      page,
      profileWith({
        activityFamily: 'cazare',
        accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 9 }],
        accommodationCommissionReading: 'reading_a',
      }),
    );
    await fixClock(page);
    await page.goto('/dashboard');

    const block = page.locator('[data-scenario-refusal="accommodation-gross-undetermined"]');
    await expect(block).toBeVisible();
    const detail = block.locator('[data-scenario-detail="accommodation-gross-undetermined"]');
    // The gross-scope question is answered, so it is no longer put to the person; the alin. (1) gate is not.
    await expect(detail).not.toContainText('Citește A');
    await expect(detail).toContainText('autorizația ONRC');

    const hero = page.locator('section.card').filter({ has: page.locator('.tax-hero-value') });
    await expect(hero.locator('.tax-hero-value')).toHaveText('—');
  });
});

test.describe('PG-6h-2 — a CAEN code prompts, and answers nothing (acceptance 5)', () => {
  test('a Division 55 code opens the questions with every one of them blank', async ({ page }) => {
    await seedBrowserOnce(
      page,
      profileWith({
        activityFamily: 'other',
        identity: { ...seedPayload().profile.identity, caen: [{ cod: '5520', descriere: 'Pensiune' }] },
      }),
    );
    await fixClock(page);
    await page.goto('/settings#!/fiscal');

    await expect(page.locator('[data-accommodation-block]')).toBeVisible();
    await expect(page.locator('[data-accommodation-rooms]')).toHaveValue('');
    await expect(page.locator('[data-accommodation-commission]')).toHaveValue('');
    await expect(page.locator('[data-accommodation-eligibility]')).toHaveValue('');
    // The note says out loud that the list is this app's own choice, not a mapping in law.
    await expect(page.locator('[data-accommodation-caen-prompt]')).toContainText('HG 656/1997');
  });

  test('a tourism CAEN code does not refuse a register on the strength of the code', async ({ page }) => {
    await seedBrowserOnce(
      page,
      profileWith({
        activityFamily: 'other',
        identity: { ...seedPayload().profile.identity, caen: [{ cod: '5510', descriere: 'Hoteluri' }] },
      }),
    );
    await fixClock(page);
    await page.goto('/dashboard');

    await expect(page.locator('[data-scenario-refusal]')).toHaveCount(0);
    await expect(page.locator('.badge[data-estimate-state="complete"]')).toHaveCount(1);
  });

  test('a profile with no family answer and a Division 55 code is incomplete, not refused', async ({ page }) => {
    const payload = seedPayload();
    const profile = { ...payload.profile } as AppData['profile'] & { activityFamily?: string };
    delete profile.activityFamily;
    profile.identity = { ...profile.identity, caen: [{ cod: '5590', descriere: 'Alte cazare' }] };

    await seedBrowserOnce(page, { ...payload, profile } as SeedPayload);
    await fixClock(page);
    await page.goto('/dashboard');

    // The code is the app's own prompt, never an answer: the family stays undeclared, so the register is
    // `incomplete` — a fact the person can still supply — and not refused for what a code appears to say.
    await expect(page.locator('[data-scenario-refusal]')).toHaveCount(0);
    await expect(page.locator('.badge[data-estimate-state="incomplete"]')).toHaveCount(1);
  });
});
