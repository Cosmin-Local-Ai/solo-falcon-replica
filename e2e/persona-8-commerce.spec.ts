import { expect, test } from '@playwright/test';
import { estimateBadge, estimateLine, loadPersona, taxHero, thresholdRowWithLimit } from './persona-harness';

/**
 * Persona 8 — **online commerce**: the largest register in the set, and the trap the set was missing.
 *
 * ## The trap: cash income is not VAT deliveries
 *
 * Titlul IV is cash basis — art. 68 alin. (2) lit. a) measures *„sumele încasate"*, and alin. (4) lit. b)
 * assigns a cost to the year it was **paid** (`research/51`). Titlul II measures *livrări efectuate*. So an
 * invoice issued and delivered but not yet collected is a VAT event and not an income event, and the two
 * series diverge by exactly the stock movement.
 *
 * Before `research/51` this looked like a reason to build a stock model. **It is not.** The divergence is
 * already expressible with what the model has: three delivered, uncollected invoices, whose missing
 * `collected` date is the fact. The spec asserts the divergence is **visible**, which is the difference
 * between a documented claim and a demonstrated one.
 *
 * ## The threshold, and the cadence that follows it
 *
 * The 395.000-lei plafon is crossed on 26 August. A declared VAT *status* does not establish a *cadence*
 * (B-96), so the persona also declares the exceedance date, the effective date and the registration route —
 * and the period comes out **derived from art. 322 alin. (4)** rather than asked for.
 */
test.describe('persona 8 — online commerce', () => {
  test('the register is a real commerce year, and the total is the persona’s own figure', async ({ page }) => {
    await loadPersona(page, 'online-commerce');
    await expect(estimateBadge(page, 'complete')).toHaveCount(1);
    // 555.000,00 gross − 435.700,00 cash-basis goods and running costs = 119.300,00 net; CAS 24.300 +
    // CASS 11.930 + impozit 8.307 = 44.537,00 lei.
    await expect(taxHero(page)).toHaveText('44.537,00 RON');
  });

  test('the VAT plafon was crossed, and the fiscal period is derived rather than asked', async ({ page }) => {
    await loadPersona(page, 'online-commerce');
    const plafon = thresholdRowWithLimit(page, '395.000,00 lei');
    await expect(plafon).toHaveCount(1);
    await expect(plafon).toContainText('555.000,00 lei');
    await page.goto('/declarations');
    await expect(page.locator('[data-testid="vat-periodicity"]')).toContainText('derivat din lege');
  });

  test('delivered-but-uncollected invoices are in the register and out of the income figure', async ({ page }) => {
    // The three `in-asteptare` rows are the whole lesson: they are livrări efectuate for Titlul II and they
    // are not „sumele încasate" for Titlul IV. The divergence is shown as a gap between two series — 48.000
    // lei of delivered paper sitting in the pending tab and absent from the 555.000,00 gross — rather than
    // asserted in prose.
    await loadPersona(page, 'online-commerce');
    // Read the income figure on the cockpit first — the breakdown disclosure lives there, not in the
    // register — then walk to the tab that holds the paper the figure left out.
    await expect(await estimateLine(page, 'Venit brut')).toContainText('555.000,00');
    await page.goto('/revenues#!/pending');
    const rows = page.locator('tr[data-record-id^="TOL-NE-"]');
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText('18.000,00 RON');
  });

  test('goods costs are cash-basis purchases — no stock model, and none needed', async ({ page }) => {
    await loadPersona(page, 'online-commerce');
    await page.goto('/expenses');
    // The non-EU supplier is named, and its purchases are in euro at the persona's own fixture rate.
    await expect(page.getByText('Yuanhua Trading Co., Ltd').first()).toBeVisible();
    await expect(page.getByText('EUR').first()).toBeVisible();
  });
});
