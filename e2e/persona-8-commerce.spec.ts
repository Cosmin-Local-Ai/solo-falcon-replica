import { expect, test } from '@playwright/test';
import {
  estimateBadge,
  estimateLine,
  loadPersona,
  loadPersonaWithProfile,
  taxHero,
  thresholdRowWithLimit,
} from './persona-harness';

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
 *
 * ## Brief 77 — the carried-in loss from 2022, and the one figure it moves
 *
 * Chain step v25 persisted `profile.priorYearFiscalLosses`; no persona carried one, so art. 118 alin. (4)-(5)
 * had no browser proof. This register is cash basis, which is exactly how a commerce year closes on a fiscal
 * loss: goods paid for in 2022 against collections that did not arrive. The declared fact is 30.000 lei from
 * 2022, same source, inside the 5-year window.
 *
 * **The hero moves: 44.537,00 RON → 41.537,00 RON.** The arithmetic, all of it on screen:
 *
 * ```
 * rd.3 venit net anual                        119.300,00 lei
 * plafon 70 % × rd.3 (alin. (5) lit. b))       83.510,00 lei  — computed, does not cut
 * rd.5 pierderi reportate (2022, 4 ani)        30.000,00 lei
 * rd.6 compensată = min(rd.5, plafon)          30.000,00 lei
 * rd.7 venit net anual recalculat              89.300,00 lei
 * CAS 24.300,00 + CASS 11.930,00 unchanged
 * impozit 10 % × (89.300 − 24.300 − 11.930)     5.307,00 lei  (was 8.307,00)
 * total                                        41.537,00 lei  (was 44.537,00)
 * ```
 *
 * The movement is exactly 10 % of the loss, and the contributions not moving is the other half of the proof:
 * art. 170 alin. (1) final sentence excludes art. 118 losses from the CASS base, and art. 148 alin. (3)
 * measures the CAS rung on the pre-offset net.
 */
test.describe('persona 8 — online commerce', () => {
  test('the register is a real commerce year, and the total is the persona’s own figure', async ({ page }) => {
    await loadPersona(page, 'online-commerce');
    await expect(estimateBadge(page, 'complete')).toHaveCount(1);
    // 555.000,00 gross − 435.700,00 cash-basis goods and running costs = 119.300,00 net; the 2022 loss
    // offsets 30.000,00 of it (rd.7 = 89.300,00); CAS 24.300 + CASS 11.930 + impozit 5.307 = 41.537,00 lei.
    // Moved from 44.537,00 by brief 77: the persona gained a carried-in loss, not a rule that started
    // firing differently. The delta is exactly 10 % of the loss.
    await expect(taxHero(page)).toHaveText('41.537,00 RON');
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

  // ── Brief 77: chain step v25 (`profile.priorYearFiscalLosses`) reaches the cockpit and Settings ───

  test('the carried-in loss is a declared entry on the Settings screen, not a derived figure', async ({ page }) => {
    await loadPersonaWithProfile(page, 'online-commerce', {});
    const block = page.locator('[data-prior-losses]');
    await expect(block).toBeVisible();
    // The empty-state sentence — "the app was not told about any loss" — must NOT be standing there.
    await expect(page.locator('[data-prior-losses-empty]')).toHaveCount(0);
    await expect(page.locator('[data-prior-loss-row]')).toHaveCount(1);
    await expect(page.locator('#set-prior-loss-source-0')).toHaveValue('activitate_independenta');
    await expect(page.locator('#set-prior-loss-year-0')).toHaveValue('2022');
    await expect(page.locator('#set-prior-loss-amount-0')).toHaveValue('30000');
  });

  test('the estimate shows rd.5, rd.6 and rd.7, and the loss moves the tax and nothing else', async ({ page }) => {
    await loadPersona(page, 'online-commerce');
    await expect(await estimateLine(page, 'Pierderi fiscale reportate din anii precedenți')).toContainText('30.000,00');
    // The 70 % ceiling is stated in the row's own label, and the row carries the figure the ceiling allowed.
    await expect(await estimateLine(page, 'Pierdere fiscală compensată în anul de raportare'))
      .toContainText('cel mult 70 % din venitul net anual');
    await expect(await estimateLine(page, 'Pierdere fiscală compensată în anul de raportare')).toContainText('30.000,00');
    await expect(await estimateLine(page, 'Venit net anual recalculat')).toContainText('89.300,00');
    await expect(await estimateLine(page, 'Impozit pe venit')).toContainText('5.307,00');
    // The contributions did not move: art. 170 alin. (1) keeps art. 118 losses out of the CASS base, and
    // art. 148 alin. (3) picks the CAS rung from the net before the offset.
    await expect(await estimateLine(page, 'CAS (25%)')).toContainText('24.300,00');
    await expect(await estimateLine(page, 'CASS (10%)')).toContainText('11.930,00');
    await expect(taxHero(page)).toHaveText('41.537,00 RON');
  });

  test('without the declared loss the same register costs 3.000 lei more, and says nothing about art. 118', async ({ page }) => {
    // The negative branch for the loss, same discipline as the expense link: the rows must appear only
    // because a fact was declared, and disappear when it is not.
    await loadPersonaWithProfile(page, 'online-commerce', { priorYearFiscalLosses: undefined }, '/dashboard');
    await expect(page.locator('details.estimate-breakdown tr').filter({ hasText: 'Pierderi fiscale reportate' })).toHaveCount(0);
    await expect(page.locator('details.estimate-breakdown tr').filter({ hasText: 'Venit net anual recalculat' })).toHaveCount(0);
    await expect(taxHero(page)).toHaveText('44.537,00 RON');
  });
});
