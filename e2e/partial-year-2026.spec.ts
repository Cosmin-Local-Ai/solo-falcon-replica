/**
 * PG-5C — the acceptance fixture, proven in the browser.
 *
 * A PFA authorised for October 2026 records 10.000,00 lei of net income. The brief's acceptance case
 * is that the app calls that 10.000,00 lei its annual net income — not 30.000, not 120.000 — and that
 * on 10.000,00 lei no CAS is due, because the 12-SM test in CF art. 148 alin. (1) is not cut to three
 * months. `research/26` §9 is the prescription; CF art. 118 alin. (3) is the provision.
 *
 * The clock is pinned inside the active period, not after it. That is deliberate: after the year
 * closed, the old code already produced 10.000,00 lei (PG-4's closed-year path fell back to the
 * actuals), so a 2027 clock would pass against the defect. At 31.10.2026 the old code showed 30.000,00
 * lei and 3.330,00 lei became 8.580,00 lei — this is the date where the assertion can fail.
 *
 * The unit-level version of this fixture, with the arithmetic written out, is
 * `src/data/partialYear2026.test.ts`.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { seedBrowser, seedPayload } from './fixtures';
import { seedData } from '../src/data/seed';
import { ron } from '../src/domain/money';
import type { AppData } from '../src/data/types';

/** 12:00 Europe/Bucharest on 31 October 2026 — one month into a three-month active period. */
const MID_YEAR = new Date('2026-10-31T12:00:00+03:00');

/** The fixture: an October-2026 starter, one revenue of 10.000,00 lei net, no expenses. */
function octoberRegister(): AppData {
  return {
    ...seedData,
    profile: {
      ...seedData.profile,
      pfaStartDate: '2026-10-01',
      pfaStartYear: 2026,
      fiscalYear: 2026,
    },
    revenues: [
      {
        id: 'rev-oct-1',
        tip: 'factura',
        nr: 'FCT-OCT-1',
        date: '2026-10-03',
        client: 'Client Oct SRL',
        cui: 'RO00000000',
        valoareFaraTva: ron(10_000),
        tva: ron(0),
        status: 'inregistrata',
      },
    ],
    expenses: [],
  };
}

const statCard = (page: Page, label: string) =>
  page.locator('.stat-card').filter({ has: page.getByText(label, { exact: true }) }).first();

const sectionWith = (page: Page, title: string) =>
  page.locator('section.card').filter({ has: page.locator('h2', { hasText: title }) }).first();

test.describe('PG-5C — an October-2026 PFA is assessed on three months, not on a run rate', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(MID_YEAR);
    await seedBrowser(page, { ...seedPayload(), ...octoberRegister() });
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Tablou de bord' })).toBeVisible();
  });

  test('the annual net income is 10.000,00 lei and the total is 3.330,00 lei', async ({ page }) => {
    // 10.000,00 lei net, no deductible expense → venitul net din activitate = 10.000,00 lei.
    //   CAS    art. 148 alin. (1): 10.000,00 < 12 SM (48.600,00 lei) → 0,00 lei. The 12-SM test is not
    //          prorated to three months (art. 151 alin. (2)), and the taxpayer may opt in.
    //   CASS   art. 174 alin. (6): base below 6 SM (24.300,00 lei) → 2.430,00 lei owed, of which
    //          1.000,00 lei (10% × VNA) is deductible and the 1.430,00 lei difference is not
    //          (art. 118 alin. (2) lit. b)). Also not prorated.
    //   impozit 10% × (10.000,00 − 1.000,00) = 900,00 lei.
    //   total  0,00 + 2.430,00 + 900,00 = 3.330,00 lei.
    // Before PG-5C this card read 8.580,00 lei: the same law over a VNA of 30.000,00 lei, which is the
    // October figure multiplied by the three-month run rate.
    const impozit = statCard(page, 'Impozit estimat');
    await expect(impozit.locator('.value')).toHaveText('3.330,00 RON');

    const hero = sectionWith(page, 'Estimare impozit');
    await expect(hero.locator('.tax-hero-value')).toHaveText('3.330,00 RON');
  });

  test('the CAS line is present and empty — the 12 SM floor is not prorated', async ({ page }) => {
    // Open the breakdown so the engine's own lines are visible, and read them rather than inferring
    // them from the total. A CAS line that vanished would be a different bug from a CAS line that
    // correctly reads zero.
    await page.getByText('Cum am ajuns la această sumă').click();
    await expect(page.getByRole('row').filter({ hasText: 'CAS (25%)' })).toContainText('0,00 RON');
    await expect(page.getByRole('row').filter({ hasText: 'CASS (10%)' })).toContainText('2.430,00 RON');
    await expect(
      page.getByRole('row').filter({ hasText: 'Impozit pe venit (rată de bază 10%)' }),
    ).toContainText('900,00 RON');
    await expect(page.getByRole('row').filter({ hasText: 'Total taxe' })).toContainText('3.330,00 RON');
  });

  test('every contribution threshold is measured against 10.000,00 lei, and none is crossed', async ({ page }) => {
    const thresholds = sectionWith(page, 'Praguri');
    await expect(thresholds.getByText('Prag minim CAS', { exact: true })).toBeVisible();
    // The floor itself is the whole-year figure: 12 × 4.050,00 lei = 48.600,00 lei, not a third of it.
    await expect(thresholds.getByText('Prag: 48.600,00 lei')).toBeVisible();
    await expect(thresholds.getByText('Prag: 24.300,00 lei')).toBeVisible();
    // Four contribution rows, all measured on the realised 10.000,00 lei — not on the 30.000,00 lei the
    // run rate predicts.
    // Five rows read 10.000,00 lei: the four contribution rows (venitul net din activitate) and the VAT
    // plafon row (cifra de afaceri fără TVA). They coincide here only because the fixture is a single
    // invoice with no VAT on it — they are different quantities, and the rows say which is which below.
    // What must be absent is the run-rate figure the app used to measure against.
    await expect(thresholds.getByText(/Curent: 10\.000,00 lei/)).toHaveCount(5);
    await expect(thresholds.getByText(/Curent: 30\.000,00 lei/)).toHaveCount(0);
    // Each row names the basis it was tested on, and the section names the date it was measured at.
    await expect(
      thresholds.getByText(/Bază măsurată: venit net anual realizat — încasări încasate și plăți plătite, fără annualizare/),
    ).toHaveCount(4);
    await expect(thresholds.getByText('Valoare măsurată la data de 31.10.2026.')).toBeVisible();
    // No contribution row reads as a breach: below 12 SM the consequence is that no CAS is owed, not
    // that something was violated.
    await expect(thresholds.getByText('Depășit', { exact: true })).toHaveCount(0);
  });

  test('the run rate survives as a labelled forecast, beside the figure and not inside it', async ({ page }) => {
    // D-PROJ-1 protects the projection; PG-5C demotes it. At 31.10.2026 the active period is
    // 01.10.2026 .. 31.12.2026 = 3 months with exactly 1 elapsed, so the forecast is 30.000,00 lei —
    // the number the app used to tax. It is still a legitimate forecast, and it is now labelled one.
    const forecast = page.locator('.forecast-aside');
    await expect(forecast).toBeVisible();
    await expect(forecast.getByText('Previziune — nu este o cifră fiscală')).toBeVisible();
    await expect(forecast.getByText('30.000,00 RON')).toBeVisible();
    // The fiscal figure and the forecast are different numbers on the same screen, and the app says
    // which one it calculated under a rule.
    await expect(sectionWith(page, 'Estimare impozit').locator('.tax-hero-value')).toHaveText('3.330,00 RON');
  });
});
