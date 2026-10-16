import { test, expect, type Page } from '@playwright/test';
import { seedBrowser, type SeedPayload } from './fixtures';
import { seedData } from '../src/data/seed';
import { CURRENT_DATA_VERSION } from '../src/data/migration';
import type { VatReturnRecord } from '../src/data/types';

/**
 * B-102 / B-103 — art. 322 alin. (8)'s two-year tail, on the page a taxpayer reads.
 *
 * The unit tests prove the derivation. These prove the surface changed, and they span three years because
 * the rule does: an intra-community acquisition of goods in June 2026, 2027 as the second monthly year,
 * 2028 as the year the return question is about.
 *
 * The three findings these pin:
 *
 *  1. **B-103** — the Form 300 panel no longer calls an alin. (7) year „lună calendaristică”. Since B-101
 *     that year opens with a quarterly return, and a headline that says otherwise is a wrong description
 *     on the surface where a wrong description becomes a wrong filing.
 *  2. **The tail** — 2027 is monthly even though its own facts answer `quarter` under alin. (2). This is
 *     the contradiction B-102 is: a per-year derivation that only looks at 2027 contradicts alin. (8).
 *  3. **The return is conditional** — 2028 goes back to the quarter only with the alin. (6) declaration on
 *     record. Without it the year stays monthly, which is the side ANAF itself sits on.
 *
 * **The limitation, stated rather than hidden.** Test 4 loads the filed mențiuni declaration from stored
 * bytes, because the page offers no control to record one: `recordFiling` only acts on calendar rows that
 * carry a fiscal period, and a declarație de mențiuni has none. So the return to the quarter is correct in
 * the domain and currently unreachable from the UI. That gap is recorded as a defect in
 * `docs/ai/phases/50_b102_alin8_tail.md`; this test proves the domain behaves, not that a user can get there.
 */

const BNR = (rateDate: string) => ({
  currency: 'EUR' as const,
  rate: '5.0000',
  rateKind: 'daily_reference' as const,
  rateDate,
  seriesCode: 'CURSZ_EUR' as const,
  sourceUrl: 'https://www.bnr.ro/Cursul-de-schimb--7333.html',
  fetchedAt: '2026-01-02T08:00:00Z',
  provisional: false as const,
  entryMode: 'fetched' as const,
});

const YEARS = [
  {
    year: 2026,
    registrationEffectiveFrom: '2025-01-01',
    registrationRoute: 'b' as const,
    precedingYearTurnover: 1_000_000,
    precedingYearAicGoods: 'nu' as const,
    aicGoodsWhileQuarterly: 'da' as const,
    aicGoodsExigibilityMonth: 6,
  },
  {
    year: 2027,
    registrationEffectiveFrom: '2025-01-01',
    registrationRoute: 'b' as const,
    precedingYearTurnover: 1_000_000,
    precedingYearAicGoods: 'nu' as const,
  },
  {
    year: 2028,
    registrationEffectiveFrom: '2025-01-01',
    registrationRoute: 'b' as const,
    precedingYearTurnover: 1_000_000,
    precedingYearAicGoods: 'nu' as const,
  },
];

function payload(fiscalYear: number, vatReturns: VatReturnRecord[] = []): SeedPayload {
  return {
    ...seedData,
    version: CURRENT_DATA_VERSION,
    fxRates: [BNR('2025-12-31'), BNR('2026-12-31'), BNR('2027-12-31')],
    vatReturns,
    profile: {
      ...seedData.profile,
      fiscalYear,
      // A deliberate choice of the year under test, made inside it, so PG-4's automatic advance yields to
      // it and the screen is looking at the year this spec is about.
      updatedAt: `${fiscalYear}-12-30T10:00:00.000Z`,
      vatRegistration: { status: 'inregistrat_art316', effectiveFrom: '2025-01-01' },
      vatPeriodicityYears: YEARS,
    },
  };
}

async function open(page: Page, at: string): Promise<void> {
  await page.clock.setFixedTime(new Date(at));
  await page.goto('/declarations');
  await expect(page.locator('[data-testid="vat-periodicity"]')).toBeVisible();
}

const decontRows = (page: Page) => page.locator('[data-obligation-id^="decont-"]');
const mentiuniRow = (page: Page, year: number) =>
  page.locator(`[data-obligation-id="mentiuni-25-ianuarie-${year}"]`);

test.describe('B-103 — the Form 300 panel describes a year that opens with a quarterly return', () => {
  test('an alin. (7) year is named as quarters then months, and the calendar agrees', async ({ page }) => {
    await seedBrowser(page, payload(2026));
    await open(page, '2026-12-31T12:00:00Z');

    // The headline used to read „lună calendaristică” for a year whose first two returns are quarterly.
    await expect(page.locator('[data-testid="vat-periodicity"]'))
      .toContainText('trimestrul calendaristic până la 06.2026, apoi luna calendaristică de la 07.2026');
    // The promise and the calendar in one assertion: T1, T2, then 07…12 — eight returns, not twelve.
    await expect(decontRows(page)).toHaveCount(8);
    await expect(page.locator('[data-obligation-id="decont-T1-2026"]')).toBeVisible();
    await expect(page.locator('[data-obligation-id="decont-T2-2026"]')).toBeVisible();
    await expect(page.locator('[data-obligation-id="decont-01.2026"]')).toHaveCount(0);
  });
});

test.describe('B-102 — the month carries into the next year, and the way back needs a filing', () => {
  test('acceptance 1 — 2027 is monthly, though its own facts would answer quarter', async ({ page }) => {
    await seedBrowser(page, payload(2027));
    await open(page, '2027-12-31T12:00:00Z');

    // Alin. (8): „pentru anul curent și pentru anul următor”. Asked alone, 2027 is a quarter under
    // alin. (2); as the second year of a 2026 acquisition it is the month, and the calendar shows twelve.
    await expect(page.locator('[data-testid="vat-periodicity"]'))
      .toContainText('luna calendaristică');
    await expect(decontRows(page)).toHaveCount(12);
  });

  test('acceptance 4/5 — 2028 with no filing stays monthly, and the alin. (6) row appears exactly once', async ({ page }) => {
    await seedBrowser(page, payload(2028));
    await open(page, '2028-12-31T12:00:00Z');

    await expect(decontRows(page)).toHaveCount(12);
    // The mechanism of the return, visible — and once. Landmine 5: two gates must not hand the taxpayer
    // two of a form that is due once.
    await expect(mentiuniRow(page, 2028)).toHaveCount(1);
    await expect(mentiuniRow(page, 2028)).toContainText('art. 322 alin. (6)');
    // Landmine 4: the year the return takes effect is an inference, and the row says so.
    await expect(mentiuniRow(page, 2028)).toContainText('interpretare');
  });

  test('acceptance 3 — with the alin. (6) declaration on record, 2028 returns to the quarter', async ({ page }) => {
    const filed: VatReturnRecord = {
      id: 'vr-mentiuni-2028',
      obligationId: 'mentiuni-25-ianuarie-2028',
      year: 2028,
      form: '300',
      periodKind: 'quarter',
      periodIndex: 1,
      status: 'depusa',
      filedOn: '2028-01-10',
    };
    await seedBrowser(page, payload(2028, [filed]));
    await open(page, '2028-12-31T12:00:00Z');

    await expect(decontRows(page)).toHaveCount(4);
    await expect(mentiuniRow(page, 2028)).toHaveCount(1);
    await expect(mentiuniRow(page, 2028)).toContainText('Depusă');
  });

  test('acceptance 3 — an acquisition in 2027 keeps 2028 monthly and offers no declaration', async ({ page }) => {
    const p = payload(2028);
    p.profile.vatPeriodicityYears = YEARS.map((y) =>
      y.year === 2028 ? { ...y, precedingYearAicGoods: 'da' as const } : y,
    );
    await seedBrowser(page, p);
    await open(page, '2028-12-31T12:00:00Z');

    await expect(decontRows(page)).toHaveCount(12);
    await expect(mentiuniRow(page, 2028)).toHaveCount(0);
  });
});
