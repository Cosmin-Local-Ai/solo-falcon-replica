import { expect, test } from '@playwright/test';
import { estimateBadge, estimateLine, loadPersona, loadPersonaWithProfile, taxHero } from './persona-harness';

/**
 * Persona 4 — **short-term accommodation host, 7 rooms**: the boundary shown as a boundary.
 *
 * art. 85 alin. (1)-(2) keeps a private person letting **1–7** rooms in *cedarea folosinței bunurilor* on a
 * 30 % flat expense basis; art. 83 alin. (4) moves **more than 7** rooms into an independent activity
 * measured under art. 68³. Seven is therefore the top of the band, and this persona sits there on purpose.
 *
 * The `>7` side is **not seeded as data**. One profile-year runs exactly one income determination method, so
 * seeding nine rooms would not show the boundary — it would silently reclassify the persona and the demo
 * would stop being an art. 85 case at all. What the spec does instead is what brief 64 asks for: it changes
 * **one declared fact** and shows the measuring article change with it.
 *
 * The other thing this persona proves is a negative. Its net is *cedarea folosinței* income — art. 155 alin.
 * (1) **lit. e)** — so it never joins the CAS cumulation, and CAS is 0. A demo where every profile pays CAS
 * would teach the ladder to nobody.
 */
test.describe('persona 4 — short-term host at the top of the art. 85 band', () => {
  test('the year runs art. 85: 30 % flat expenses, 10 % final tax, and no CAS leg', async ({ page }) => {
    await loadPersona(page, 'short-term-host');
    await expect(estimateBadge(page, 'complete')).toHaveCount(1);
    await expect(await estimateLine(page, 'Cheltuieli forfetare 30 % (art. 85 alin. (2))')).toBeVisible();
    // 263.000,00 gross − 78.900,00 forfetar = 184.100,00 net; impozit 18.410 final + CASS pe scară 9.720.
    await expect(taxHero(page)).toHaveText('28.130,00 RON');
    await expect(await estimateLine(page, 'CAS (25%)')).toContainText('0,00');
  });

  test('the CASS ladder is entered and its base is a rung, not the declared net', async ({ page }) => {
    await loadPersona(page, 'short-term-host');
    // The art. 85 net (184.100 lei) is replaced by the 24-smn rung, 97.200 lei — the substitution the ladder
    // exists to make, stated on the line rather than inferred from the total.
    await expect(await estimateLine(page, 'Baza de calcul CASS art. 155 alin. (1) lit. c)-h)')).toContainText('97.200,00');
  });

  test('one declared fact past the band, and the measuring article changes', async ({ page }) => {
    // The boundary, walked: 8 rooms plus the art. 68³ alin. (1) eligibility answer 'da' routes the same
    // person to art. 68³ — and this build refuses that register with the unsettled-gross scenario rather
    // than producing a number it cannot ground. The refusal IS the boundary being visible.
    await loadPersonaWithProfile(page, 'short-term-host', {
      accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 8 }],
      accommodationTourismEligibility: 'da',
    }, '/dashboard');
    await expect(estimateBadge(page, 'refused')).toHaveCount(1);
    await expect(page.locator('[data-scenario-refusal]').first()).toBeVisible();
  });

  test('the room count the control shows is the one the persona declared', async ({ page }) => {
    await loadPersona(page, 'short-term-host', {});
    await page.goto('/settings#!/fiscal');
    await expect(page.locator('[data-accommodation-rooms]')).toHaveValue('7');
  });
});
