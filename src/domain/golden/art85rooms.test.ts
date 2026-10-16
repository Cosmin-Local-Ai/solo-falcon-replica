/**
 * PHASE 31 FIXTURE 5 — art. 85: 1–7 rooms let pe termen scurt, the 30 % flat ratio and the CASS ladder.
 *
 * **SOURCE** — capital.ro's FY2026 worked table, independently reproduced for the 60.000 lei case at
 * declararatie-unica.ro (updated 11 aprie 2026). **FISCAL YEAR OF THE SOURCE — 2026. SMN THE SOURCE USED —
 * 4.050 lei (1 ianuarie 2026). GRADE — CORROBORATED** (three independent 2026-dated sources agree on the
 * rules; two of them compute this case).
 *
 * Recorded in `docs/ai/research/47_published_worked_examples_fy2026.md` §5B.
 *
 * **There is no official worked example for this article.** ANAF DGRFP Ploiești's 03.03.2026 leaflet gives
 * the formulas and the ladder table — 6 × 4.050 = 24.300 → CASS 2.430 · 12 × 4.050 = 48.600 → 4.860 ·
 * 24 × 4.050 = 97.200 → 9.720 — and computes no scenario (`research/47` §5A, §10.3). So the *thresholds*
 * below are FACT from ANAF and the *scenarios* are CORROBORATED from practitioners. That distinction is
 * stated per assertion, because a corroborated figure is not an official one.
 *
 * ── The hazard the source itself carries ──────────────────────────────────────────────────────────────
 *
 * capital.ro's 50.000 lei figure is **after removing the commission reținut de platformă**, and art. 85
 * alin. (3) excludes that commission from the gross — it is a reduction of the BRUT, not an expense deducted
 * after the flat ratio. Had the commission been taken off after the 30 %, every figure in the 50.000 case
 * would be different. The fixture feeds the post-commission gross and says so.
 *
 * `research/47` §5B also records that declararatie-unica.ro's FAQ still says „maxim 5 camere" — the pre-2026
 * rule — on a 2026-dated page that elsewhere uses the seven-room rule. A hazard, noted, not used.
 */
import { describe, expect, it } from 'vitest';
import { computed, driveFlatRatio, lineValue } from './harness';
import { lei } from '../money';

/**
 * One row of capital.ro's table, asserted in full: gross → 30 % forfetar → net → 10 % tax → CASS → total.
 * Every number in the tuple is copied from the published table, not computed here.
 */
async function publishedRow(gross: number, forfetar: number, net: number, tax: number, cass: number, total: number) {
  const res = computed(await driveFlatRatio({ gross: lei(gross), method: 'short-term-rooms-art85' }));
  expect(lineValue(res, 'Venit brut art. 85')).toBe(lei(gross));
  expect(lineValue(res, 'Cheltuieli forfetare 30 %')).toBe(lei(forfetar));
  expect(lineValue(res, 'Venit net art. 85')).toBe(lei(net));
  expect(lineValue(res, 'Impozit art. 85')).toBe(lei(tax));
  expect(lineValue(res, 'CASS pe veniturile')).toBe(lei(cass));
  expect(res.output.total).toBe(lei(total));
  return res;
}

describe('FIXTURE 5 (CORROBORATED — capital.ro + declararatie-unica.ro, income year 2026, SMN 4.050 lei) — the three-case ladder table, reproduced', () => {
  it('30.000 → forfetar 9.000 → net 21.000 → impozit 2.100 → CASS 0 → total 2.100', async () => {
    const res = await publishedRow(30_000, 9_000, 21_000, 2_100, 0, 2_100);
    // Below the art. 170 alin. (2) condition of 6 SMN = 24.300 lei, nothing is owed at all for this basin.
    // The ladder ran and answered zero; it did not refuse and it did not round the amount up to a rung.
    expect(res.bases.bazaDeCalculCassArt155LitCH).toBe(lei(0));
  });

  it('60.000 → forfetar 18.000 → net 42.000 → impozit 4.200 → CASS 2.430 → total 6.630', async () => {
    const res = await publishedRow(60_000, 18_000, 42_000, 4_200, 2_430, 6_630);
    // 42.000 lei cumulated is at or above 6 SMN (24.300) and below 12 SMN (48.600): the base is the RUNG,
    // not the net. 10 % of 42.000 would have been 4.200 lei — the same figure as the income tax, which is
    // how a marginal-rate implementation could hide. The published CASS is 2.430 lei.
    expect(res.bases.bazaDeCalculCassArt155LitCH).toBe(lei(24_300));
  });

  it('150.000 → forfetar 45.000 → net 105.000 → impozit 10.500 → CASS 9.720 → total 20.220', async () => {
    const res = await publishedRow(150_000, 45_000, 105_000, 10_500, 9_720, 20_220);
    // 105.000 lei clears 24 SMN (97.200), the top rung. art. 170 alin. (3) states no rung above it, and the
    // 72-SMN ceiling of art. 170 alin. (1) does not reach this basin at all.
    expect(res.bases.bazaDeCalculCassArt155LitCH).toBe(lei(97_200));
  });

  it('the 30.000 case sits below the 6-SMN step and the 150.000 case crosses the 24-SMN step — that is the point of the table', async () => {
    await publishedRow(30_000, 9_000, 21_000, 2_100, 0, 2_100);
    await publishedRow(150_000, 45_000, 105_000, 10_500, 9_720, 20_220);
  });

  it('50.000 lei AFTER the platform commission is removed → 15.000 → 35.000 → impozit 3.500', async () => {
    // capital.ro: „Un proprietar obține în 2026 încasări de 50.000 de lei, după eliminarea comisionului
    // reținut de platformă". The commission never entered the gross (art. 85 alin. (3)), so the 30 % runs
    // over the 50.000 and not over a smaller figure reached by subtracting the commission afterwards.
    await publishedRow(50_000, 15_000, 35_000, 3_500, 2_430, 5_930);
  });

  it('CAS is never owed on art. 85 income, and the art. 85 net never enters the lit. b) base', async () => {
    const res = await publishedRow(150_000, 45_000, 105_000, 10_500, 9_720, 20_220);
    expect(lineValue(res, 'CAS (25%)')).toBe(lei(0));
    // art. 155 alin. (1) lit. e), not lit. b). The amount the contributions are measured on through the
    // art. 170 alin. (1) route is zero, and the engine reports that zero rather than the letting net.
    expect(res.bases.venitulNetDinActivitate).toBe(lei(0));
    expect(res.bases.venitulNetCumulatPentruContributii).toBe(lei(0));
  });

  it('the art. 85 tax is final: 10 % of the net, and no contribution is deducted from its base', async () => {
    // art. 85 alin. (6): „impozitul fiind final". The effective burden is 7 % of the gross, and the 9.720 lei
    // of CASS does not reduce the income-tax base the way art. 123 alin. (1) + art. 118 alin. (2) would.
    const res = await publishedRow(150_000, 45_000, 105_000, 10_500, 9_720, 20_220);
    expect(lineValue(res, 'Impozit art. 85')).toBe(lei(10_500));
    expect(res.lines.filter((l) => l.label.startsWith('Impozit'))).toHaveLength(1);
    expect(res.lines.some((l) => l.label.startsWith('Venit net anual impozabil'))).toBe(false);
  });
});
