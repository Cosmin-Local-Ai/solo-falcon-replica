import { test, expect, type Page } from '@playwright/test';
import { seedBrowser, type SeedPayload } from './fixtures';
import { seedData } from '../src/data/seed';
import { CURRENT_DATA_VERSION, DATA_VERSION_RECORD_CURRENCY } from '../src/data/migration';
import type { AnnualFiling } from '../src/data/types';
import { lei } from '../src/domain/money';

/**
 * PG-5 — the annual return, end to end (acceptance criteria 1 and 2).
 *
 * The failure this phase exists for, in the brief's own words: "after 25 May 2027 the Dashboard raises
 * an overdue item at high priority even if you filed on time, and calls it 'PFA'." Two halves, both
 * proven here in a browser:
 *
 *  1. past the term with a recorded filing → NO overdue item;
 *  2. past the term without one → exactly one, labelled „Declarația unică (D212) pentru 2026", linking
 *     to the filing form.
 *
 * and the negative that makes both of them mean something:
 *
 *  3. a monthly record with `status: 'inregistrata'` does NOT discharge the term. A monthly row records
 *     that a row was registered in this app; it is not evidence that anyone filed an annual return.
 *     PG-5b re-premises that case rather than dropping it: the monthly rows now arrive as a **pre-v11
 *     payload**, the only shape that still holds them, and the chain drops them on the way in. The term
 *     is still overdue, and the register shows nothing that could be mistaken for a filing.
 *
 * The clock is an explicit UTC instant and the profile carries a deliberate 2027 `updatedAt`, so the
 * year is pinned by a user choice rather than by the automatic advance (PG-4's rule: a choice made after
 * the boundary wins). Without that, the shell would advance the view to FY2027 and the FY2026 term would
 * not be the one on screen.
 */

/** 1 June 2027 — one week past the 25 May term for fiscal year 2026 (CF art. 122 alin. (3)). */
const ONE_WEEK_PAST_THE_TERM = new Date('2027-06-01T09:00:00Z');
/** 1 April 2027 — before the term, so a filed return is still ahead of its date. */
const BEFORE_THE_TERM = new Date('2027-04-01T09:00:00Z');

function payload(over: { filings?: AnnualFiling[] } = {}): SeedPayload {
  return {
    ...seedData,
    version: CURRENT_DATA_VERSION,
    // A deliberate choice of FY2026, made in 2027: the automatic advance yields to it, so the screen is
    // looking at the year whose term is under test.
    profile: { ...seedData.profile, fiscalYear: 2026, updatedAt: '2027-01-05T10:00:00.000Z' },
    filings: over.filings ?? [],
  };
}

/**
 * The same profile one version behind the chain's head, still carrying monthly rows under the key a
 * pre-v11 build wrote them to. That is the only way these rows can reach the app now: the `annual-filing`
 * step drops them, and nothing downstream of it can hold one.
 */
function preV11Payload(): SeedPayload {
  return {
    ...payload(),
    version: DATA_VERSION_RECORD_CURRENCY,
    declarations: [
      { id: 'd-1', an: 2026, luna: 3, venituri: lei(12500), cheltuieli: lei(1800), status: 'inregistrata', dataInregistrare: '2026-04-10' },
      { id: 'd-2', an: 2026, luna: 6, venituri: lei(14200), cheltuieli: lei(2100), status: 'transmisa', dataInregistrare: '2026-07-08', dataTrimitere: '2026-07-15' },
      { id: 'd-3', an: 2026, luna: 12, venituri: lei(9680), cheltuieli: lei(546), status: 'inregistrata', dataInregistrare: '2027-01-05' },
    ],
  } as unknown as SeedPayload;
}

function actionsSection(page: Page) {
  return page
    .locator('section.card')
    .filter({ has: page.getByRole('heading', { name: 'Ce trebuie să faci', exact: true }) });
}

function deadlinesSection(page: Page) {
  return page
    .locator('section.card')
    .filter({ has: page.getByRole('heading', { name: 'Termene limită', exact: true }) });
}

const OVERDUE_LABEL = 'Termen depășit: Declarația unică (D212) pentru 2026';

test.describe('PG-5 — the D212 term, resolved from the filing rather than the calendar', () => {
  test('past the term with no recorded filing: exactly one overdue item, named and linked', async ({ page }) => {
    await page.clock.setFixedTime(ONE_WEEK_PAST_THE_TERM);
    await seedBrowser(page, payload());
    await page.goto('/dashboard');

    const actions = actionsSection(page);
    const overdue = actions.locator('[data-state="deadline_overdue"]');
    await expect(overdue).toHaveCount(1);
    await expect(overdue.locator('.action-label')).toHaveText(OVERDUE_LABEL);

    // The row says which term expired and when, in the same sentence the label uses.
    await expect(overdue.locator('.hint')).toHaveText('Termenul Declarația unică (D212) pentru 2026 a expirat pe 25.05.2027.');

    // It links to the filing form, not to a generic page.
    await expect(overdue.locator('a.attention-target')).toHaveAttribute('href', '/declarations');

    // And it is the high-priority row the phase complains about — the severity is the domain's call, and
    // an overdue legal term is the case that earns it.
    await expect(overdue).toHaveAttribute('data-severity', 'high');

    // The label names the return and the year, never the bare audience. „Termen depășit: PFA” told a
    // taxpayer something was late without saying what.
    await expect(actions.getByText('Termen depășit: PFA')).toHaveCount(0);
  });

  test('past the term WITH a recorded filing: no overdue item at all', async ({ page }) => {
    await page.clock.setFixedTime(ONE_WEEK_PAST_THE_TERM);
    await seedBrowser(
      page,
      payload({
        filings: [
          { id: 'f-2026', taxYear: 2026, form: 'D212', status: 'depusa', filedOn: '2027-05-12', reference: 'D212.2026.000042' },
        ],
      }),
    );
    await page.goto('/dashboard');

    const actions = actionsSection(page);
    await expect(actions.locator('[data-state="deadline_overdue"]')).toHaveCount(0);
    await expect(actions.getByText(OVERDUE_LABEL)).toHaveCount(0);
    // And it does not come back as an open term either: a filed return is discharged, not pending.
    await expect(actions.locator('[data-state="deadline_open"]')).toHaveCount(0);

    // The completeness card states the same fact from the same predicate — one source, two surfaces.
    const completeness = page
      .locator('section.card')
      .filter({ has: page.getByRole('heading', { name: 'Completitudine date', exact: true }) });
    await expect(completeness.getByText('Declarația unică (D212) pentru 2026 depusă pe 12.05.2027')).toBeVisible();
  });

  test('a monthly record with status „inregistrata” does not mark the term done', async ({ page }) => {
    // Acceptance 2, re-premised by PG-5b and not deleted. This is the inference the old model invited: a
    // monthly row marked registered, in the right year, reading like proof of a filing. It is not, and the
    // app must not treat it as one. The rows now arrive in a pre-v11 payload and the chain drops them, so
    // the case is stronger than it was: they discharge nothing, and there is no longer a register that
    // could be read as if they did.
    await page.clock.setFixedTime(ONE_WEEK_PAST_THE_TERM);
    await seedBrowser(page, preV11Payload());
    await page.goto('/dashboard');

    const actions = actionsSection(page);
    const overdue = actions.locator('[data-state="deadline_overdue"]');
    await expect(overdue).toHaveCount(1);
    await expect(overdue.locator('.action-label')).toHaveText(OVERDUE_LABEL);

    // The register is empty — the step minted nothing from the rows it dropped — and there is no second
    // table where they used to be listed.
    await page.goto('/declarations');
    await expect(page.getByRole('heading', { name: 'Declarația unică (D212)' })).toBeVisible();
    await expect(page.getByText('Nicio declarație anuală înregistrată')).toBeVisible();
    // PG-6g re-pin (replaced, not deleted): the page now also carries the VAT calendar, the D300 rubric
    // layout and the parked-list tables, so "no table on the page" is no longer the assertion. What it has
    // always guarded is that no second REGISTER exists — the monthly one — and that is now pinned on the
    // D212 register itself, which the chain left empty.
    await expect(page.locator('table[data-register="d212"]')).toHaveCount(0);
    await expect(page.getByText('2026-03')).toHaveCount(0);
    await expect(page.getByText('2026-06')).toHaveCount(0);
    await expect(page.getByText('2026-12')).toHaveCount(0);
  });

  test('a return filed before its term shows as depusă on the term card, not as an open item', async ({ page }) => {
    await page.clock.setFixedTime(BEFORE_THE_TERM);
    await seedBrowser(
      page,
      payload({
        filings: [{ id: 'f-2026', taxYear: 2026, form: 'D212', status: 'depusa', filedOn: '2027-03-20' }],
      }),
    );
    await page.goto('/dashboard');

    const deadlines = deadlinesSection(page);
    await expect(deadlines.locator('[data-deadline-done="true"]')).toHaveCount(1);
    await expect(deadlines.getByText('Depusă', { exact: true })).toBeVisible();
    await expect(deadlines.getByText('Depusă pe 20.03.2027')).toBeVisible();
    // The card does not also call it an open term.
    await expect(deadlines.getByText('Activ', { exact: true })).toHaveCount(0);

    await expect(actionsSection(page).locator('[data-state="deadline_open"]')).toHaveCount(0);
  });

  test('marking the return filed from the register clears the overdue item on the next view', async ({ page }) => {
    // The round trip the phase is for: the user files, records it once, and the alert stops. Seeded with
    // `seedBrowserOnce` because the write has to be the app's own, and a re-run of `addInitScript` on
    // reload would put the unfiled payload back and prove nothing.
    await page.clock.setFixedTime(ONE_WEEK_PAST_THE_TERM);
    await seedBrowserOncePage(page, payload());
    await page.goto('/declarations');

    await page.getByRole('button', { name: /Adaugă declarație anuală/ }).first().click();
    const selects = page.locator('.modal select');
    await selects.nth(1).selectOption('depusa');
    await page.locator('.modal input[type="date"]').fill('2027-05-24');
    await page.getByRole('button', { name: 'Adaugă', exact: true }).click();

    await page.goto('/dashboard');
    await expect(actionsSection(page).locator('[data-state="deadline_overdue"]')).toHaveCount(0);
    await expect(actionsSection(page).getByText(OVERDUE_LABEL)).toHaveCount(0);
  });
});

/**
 * `seedBrowserOnce` from `fixtures.ts` is the same helper; it is inlined here only because this file's
 * payload is built locally. Keeping one definition of "seed unless already seeded" is the point — see the
 * note in `fixtures.ts` about why a plain `addInitScript` would break a write-then-reload assertion.
 */
async function seedBrowserOncePage(page: Page, dataset: SeedPayload): Promise<void> {
  await page.addInitScript(
    (data: { key: string; dataset: SeedPayload }) => {
      if (!localStorage.getItem(data.key)) localStorage.setItem(data.key, JSON.stringify(data.dataset));
    },
    { key: 'pfa-app-data-v2', dataset },
  );
}
