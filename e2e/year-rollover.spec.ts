import { test, expect, type Page } from '@playwright/test';
import { seedBrowserOnce } from './fixtures';
import { dashboard as copy } from '../src/ui/copy';

/**
 * PG-4 (D-YEAR-1 / B-58) — the year boundary, end to end.
 *
 * This is the scenario the phase exists for. On 1 January 2027 the app moves to a fiscal year for which
 * this build registers no rule package. Everything a person could read off the screen in that moment
 * has to be true:
 *
 *  - the year moved, and the screen says it moved;
 *  - the missing rules are named, in words, for the year by its name;
 *  - no figure is offered for that year — not a zero, and not last year's number wearing this year's
 *    label. A silent zero on 1 January is the worst failure this app can have;
 *  - the way back to the closed year works, survives a reload, and lands on a figure that is labelled
 *    final rather than annualised.
 *
 * The clock is an explicit UTC instant — 2026-12-31T22:30:00Z is 00:30 on 1 January in Bucharest — so
 * the browser's own time zone cannot be what makes the test pass. Same reasoning as
 * `e2e/payment-dates.spec.ts` and `src/test/fixedInstant.ts`.
 */

const STORAGE_KEY = 'pfa-app-data-v2';

/** 00:30 on 1 Jan 2027, Europe/Bucharest — still 31 Dec 2026 in UTC. */
const BUCHAREST_0030_1_JAN_2027 = new Date('2026-12-31T22:30:00Z');

async function fixClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(BUCHAREST_0030_1_JAN_2027);
}

function storedFiscalYear(page: Page): Promise<number | undefined> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { profile?: { fiscalYear?: number } }).profile?.fiscalYear : undefined;
  }, STORAGE_KEY);
}

function statCard(page: Page, label: string) {
  return page.locator('.stat-card').filter({ has: page.getByText(label, { exact: true }) });
}

/**
 * The estimate hero, scoped to its own card. `.tax-hero-value` is also what `TaxReserve` prints its
 * monthly figure with, so an unscoped locator resolves to two elements and proves nothing.
 */
function estimateHero(page: Page) {
  return page
    .locator('section.card')
    .filter({ has: page.getByRole('heading', { name: copy.estimate.title, exact: true }) })
    .locator('.tax-hero-value');
}

test.describe('PG-4 — the fiscal year rolls over, and the app says what it does not know', () => {
  test('1 Jan 2027: the year advances, the missing rules are named, and no figure is invented', async ({ page }) => {
    await fixClock(page);
    await seedBrowserOnce(page);
    await page.goto('/dashboard');

    // 1. The advance happened, it is visible, and it is persisted — not component state that a reload
    //    would quietly undo.
    await expect(page.getByText(copy.year.advanced(2027))).toBeVisible();
    expect(await storedFiscalYear(page)).toBe(2027);

    // 2. The missing rule package is named for the year by name.
    await expect(page.getByText(copy.year.rulesMissing(2027))).toBeVisible();
    await expect(page.getByText(copy.year.rulesMissingBody)).toBeVisible();
    await expect(page.locator('[data-year-state="rules-missing"]')).toBeVisible();

    // 3. No figure for 2027. The badge is the refusal state and the figure slot says what it is.
    //
    // B-28 re-pin: the hero and the cockpit used to carry the em dash — the same glyph a still-computing
    // estimate carries. A year with no rule package is not an estimate still arriving: the engine ran and
    // refused, and the slot now says so. The refusal sentence is asserted too, because for this state the
    // sentence is the whole answer — it names the year whose rules are missing.
    await expect(estimateHero(page)).toHaveText('Calcul refuzat');
    await expect(statCard(page, 'Impozit estimat').locator('.value')).toHaveText('Calcul refuzat');
    await expect(page.locator('[data-estimate-reason]')).toContainText('Niciun set de reguli înregistrat pentru anul fiscal 2027');
    await expect(page.locator('[data-estimate-state="review_required"]').first()).toBeVisible();

    // 4. And nothing on the page presents the closed 2026 figure as the current one. 3.112,00 lei is
    //    exactly what the seed's FY2026 estimate is; it may not appear while the year reads 2027.
    await expect(page.getByText('3.112,00 RON')).toHaveCount(0);
  });

  test('the toggle back to the closed year works, is labelled final, and survives a reload', async ({ page }) => {
    await fixClock(page);
    await seedBrowserOnce(page);
    await page.goto('/dashboard');

    await expect(page.getByText(copy.year.rulesMissing(2027))).toBeVisible();
    await page.getByRole('button', { name: copy.year.switchTo(2026) }).click();

    // The closed year is a final calculation from actuals, not a run rate. The label appears twice on
    // purpose — once over the hero figure, once on the chart note — and nowhere does a run-rate label
    // stand in its place.
    await expect(page.getByText(copy.estimate.finalCalculation(2026)).first()).toBeVisible();
    await expect(estimateHero(page)).toHaveText('3.112,00 RON');
    await expect(page.locator('[data-year-state="closed"]')).toBeVisible();
    // No run-rate wording anywhere for a closed year.
    await expect(page.getByText(/din 12 luni scurse/)).toHaveCount(0);

    // A reload must not undo the deliberate choice: the automatic advance fires once, when the stored
    // profile was last maintained before the boundary.
    await page.reload();
    await expect(page.getByText(copy.estimate.finalCalculation(2026)).first()).toBeVisible();
    expect(await storedFiscalYear(page)).toBe(2026);
    await expect(estimateHero(page)).toHaveText('3.112,00 RON');
  });

  test('B-73: opening Revenues on 2 January advances the year too — the trigger is not mounted on the dashboard', async ({ page }) => {
    // PG-5 (B-73). PG-4 put the automatic advance inside the dashboard component, so the year moved on
    // the first DASHBOARD open of the new year. A person who opened Revenues on 2 January got last
    // year's register, and "last year" was no longer what the clock said. The writer now lives in the app
    // shell, where every route starts, and this test starts the app on a page that has no banner, no
    // hero and no dashboard at all.
    await page.clock.setFixedTime(new Date('2027-01-02T08:00:00Z'));
    await seedBrowserOnce(page);

    await page.goto('/revenues');
    await expect.poll(() => storedFiscalYear(page)).toBe(2027);

    // The dashboard, opened afterwards, is looking at the year the clock is in — and says what it does
    // not know about it, instead of quietly showing the 2026 register.
    await page.goto('/dashboard');
    await expect(page.getByText(copy.year.rulesMissing(2027))).toBeVisible();
    // B-28 re-pin — see the first test: a year with no rules is a refusal, not a pending figure, and the
    // hero no longer borrows the pending dash for it.
    await expect(estimateHero(page)).toHaveText('Calcul refuzat');

    // The toggle back still works, and the deliberate choice still survives a reload — the PG-4 guard,
    // re-proven from a shell-mounted writer.
    await page.getByRole('button', { name: copy.year.switchTo(2026) }).click();
    await expect(estimateHero(page)).toHaveText('3.112,00 RON');
    await page.reload();
    await expect(estimateHero(page)).toHaveText('3.112,00 RON');
    expect(await storedFiscalYear(page)).toBe(2026);
  });

  test('the closed-year figure does not drift with the calendar', async ({ page }) => {
    // The drift table in brief 34: 15 Jan and 26 May used to annualise a finished year over again and
    // move the number. The same data, the same fiscal year, three as-of dates — one figure.
    for (const instant of [
      new Date('2026-12-31T21:30:00Z'), // 23:30 Bucharest, 31 Dec 2026
      new Date('2027-01-15T10:00:00Z'),
      new Date('2027-05-26T10:00:00Z'),
    ]) {
      await page.clock.setFixedTime(instant);
      await seedBrowserOnce(page);
      await page.goto('/dashboard');
      // The seed profile is on fiscal year 2026 and was last maintained in 2026, so the clock advances
      // it for the 2027 instants; the toggle back is what reads the closed year.
      if (await page.getByRole('button', { name: copy.year.switchTo(2026) }).count()) {
        await page.getByRole('button', { name: copy.year.switchTo(2026) }).click();
      }
      await expect(estimateHero(page)).toHaveText('3.112,00 RON');
      // No „N din 12" with N over 12 anywhere on the page.
      await expect(page.getByText(/1[3-9](,\d+)? din 12/)).toHaveCount(0);
      await page.evaluate(() => localStorage.clear());
    }
  });
});
