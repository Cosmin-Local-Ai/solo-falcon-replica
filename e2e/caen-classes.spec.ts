import { test, expect, type Page } from '@playwright/test';
import { seedBrowserOnce } from './fixtures';

/**
 * Step 11 / Part A2 — B-124 in a browser.
 *
 * The defect: `identity.caen` is `CaenCode[]`, and `Settings.tsx` read `caen?.[0]?.cod` into one
 * text input and wrote `[typed, ...caen.slice(1)]` back. The model held a list; the UI showed and
 * edited one entry. A person with a principal class and secondary classes could not enter the
 * secondary ones at all.
 *
 * So this spec does the three things the unit tests cannot: it drives the type-ahead in a real
 * document, it reads all five classes back out of `localStorage`, and it shows the statutory
 * sentence that makes the fifth class the fifth.
 *
 * Every code here is a CAEN **Rev.3** class resolved against `docs/ai/data/caen_rev3.csv` — none
 * of it is typed from memory.
 */

function caenInput(page: Page, index: number) {
  return page.locator(`input[data-caen-input="${index}"]`);
}

async function openFiscalTab(page: Page): Promise<void> {
  await page.goto('/settings#!/fiscal');
  await expect(caenInput(page, 0)).toBeVisible();
}

/** Type into row `index` and pick the class `cod` from the drawdown. */
async function pickClass(page: Page, index: number, cod: string): Promise<void> {
  await caenInput(page, index).click();
  await caenInput(page, index).fill(cod);
  const option = page.locator(`[data-caen-options] [data-caen-code="${cod}"][data-caen-selectable="true"]`);
  await expect(option).toBeVisible();
  await option.dispatchEvent('mousedown');
  await expect(caenInput(page, index)).toHaveValue(new RegExp(`^${cod} — `));
}

async function storedCaen(page: Page): Promise<{ cod: string; descriere: string }[]> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '{}').profile?.identity?.caen ?? [],
    'pfa-app-data-v2',
  ) as Promise<{ cod: string; descriere: string }[]>;
}

test.describe('B-124 — the CAEN control edits the whole list', () => {
  test('one principal and four secondary classes are entered and all five are stored', async ({ page }) => {
    await seedBrowserOnce(page);
    await openFiscalTab(page);

    // The seed's own class comes back resolved, code and official Rev.3 denomination.
    await expect(caenInput(page, 0)).toHaveValue(
      '6210 — Activități de realizare a soft-ului la comandă (software orientat client)',
    );

    for (const [index, cod] of [[0, '6210'], [1, '6220'], [2, '6290'], [3, '6310'], [4, '5829']] as const) {
      if (index > 0) {
        await page.locator('button[data-caen-add]').click();
        await expect(caenInput(page, index)).toBeVisible();
      }
      await pickClass(page, index, cod);
    }

    await expect(page.locator('[data-caen-counter]')).toContainText('5 din 5 clase folosite');

    await page.getByRole('button', { name: 'Salvează' }).first().click();
    await expect(page.getByText('Profilul fiscal a fost salvat')).toBeVisible();

    const caen = await storedCaen(page);
    expect(caen.map((c) => c.cod)).toEqual(['6210', '6220', '6290', '6310', '5829']);
    // The denomination is the nomenclator's, not something the person typed.
    expect(caen[4].descriere).toBe('Activități de editare a altor produse software');

    // And the reload proves it is storage, not component state.
    await page.reload();
    await openFiscalTab(page);
    await expect(caenInput(page, 4)).toHaveValue('5829 — Activități de editare a altor produse software');
  });

  test('a 6th class is refused at the input, and the refusal carries OUG 44/2008 art. 16 alin. (1)', async ({
    page,
  }) => {
    await seedBrowserOnce(page);
    await openFiscalTab(page);

    for (let i = 0; i < 4; i++) await page.locator('button[data-caen-add]').click();
    await expect(caenInput(page, 4)).toBeVisible();

    const add = page.locator('button[data-caen-add]');
    await expect(add).toBeDisabled();
    await expect(page.locator('[data-caen-cap-citation]')).toContainText(
      'OUG 44/2008 art. 16 alin. (1)',
    );
    await expect(page.locator('[data-caen-cap-citation]')).toContainText(
      'cel mult 5 clase de activități prevăzute de codul CAEN',
    );
    // The cap is on the total, and the control says so — otherwise „4 secundare" reads as a quota.
    await expect(page.locator('[data-caen-cap]')).toContainText('totalului');
  });
});

test.describe('the type-ahead resolves a code and a phrase', () => {
  test('a partial code and an exact code both resolve, formatted `cod — denumire`', async ({ page }) => {
    await seedBrowserOnce(page);
    await openFiscalTab(page);

    await caenInput(page, 0).click();
    await caenInput(page, 0).fill('47');
    // `47` is a diviziune with more classes than one screen, so the drawdown offers the nearest
    // ones and each row says what it sits under — that lineage line is what turns a number into
    // an activity for a person who typed two digits.
    const partial = page.locator('[data-caen-options] [data-caen-code="4711"]');
    await expect(partial).toContainText('4711 —');
    await expect(partial.locator('.caen-option-lineage')).toContainText('Secțiunea G');
    await expect(partial.locator('.caen-option-lineage')).toContainText('471');

    await caenInput(page, 0).fill('4791');
    await expect(
      page.locator('[data-caen-options] [data-caen-code="4791"]'),
    ).toContainText('4791 — Intermedieri în comerțul cu amănuntul nespecializat');
  });

  test('a phrase with no matching class expands the grupa that contains it', async ({ page }) => {
    await seedBrowserOnce(page);
    await openFiscalTab(page);

    await caenInput(page, 0).click();
    await caenInput(page, 0).fill('programare');
    // No CAEN Rev.3 *clasă* contains „programare" — diviziunea 62 and grupa 621 do. A class-only
    // search would answer this ordinary question with an empty list.
    await expect(
      page.locator('[data-caen-options] [data-caen-code="621"][data-caen-selectable="false"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-caen-options] [data-caen-code="6210"][data-caen-selectable="true"]'),
    ).toBeVisible();
  });

  test('free text is not a CAEN: an unresolvable box blocks the save and says why', async ({ page }) => {
    await seedBrowserOnce(page);
    await openFiscalTab(page);

    await caenInput(page, 0).click();
    await caenInput(page, 0).fill('ce vreau eu');
    await expect(page.locator('[data-caen-error="0"]')).toContainText('4 cifre');

    await page.getByRole('button', { name: 'Salvează' }).first().click();
    await expect(page.getByText('Profilul fiscal a fost salvat')).toHaveCount(0);
    // Nothing was written, and nothing was silently dropped.
    const caen = await storedCaen(page);
    expect(caen.map((c) => c.cod)).toEqual(['6210']);
  });
});

test.describe('the nomenclator identifies itself', () => {
  test('CAEN Rev.3, the INS act and the monitor are shown where the codes are picked', async ({
    page,
  }) => {
    await seedBrowserOnce(page);
    await openFiscalTab(page);

    await expect(page.locator('[data-caen-provenance]')).toContainText('CAEN Rev.3');
    await expect(page.locator('[data-caen-provenance]')).toContainText('377/2024');
    await expect(page.locator('[data-caen-provenance]')).toContainText('385');
    // HG 656/1997 art. 4 alin. (1) — the sentence that keeps CAEN out of a calculator.
    await expect(page.locator('[data-caen-provenance]')).toContainText(
      'nu presupune crearea de drepturi sau obligații',
    );
  });
});
