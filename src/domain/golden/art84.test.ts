/**
 * PHASE 31 FIXTURE 2 — cedarea folosinței bunurilor, art. 84: the 20 % flat EXPENSE ratio.
 *
 * **SOURCE A** — ANAF DGFP București, „Noutăți privind Declarația Unică 2026 – exemple", Exemplul 4 (the
 * natural-person-tenant limb), `static.anaf.ro/static/10/Bucuresti/Noutati_privind_DU_2026_exemple.pdf`.
 * **FISCAL YEAR OF THE SOURCE — 2025. SMN THE SOURCE USED — 4.050 lei. GRADE — FACT** (official).
 *
 * **SOURCE B** — renzi.ro, completam.ro and declararatie-unica.ro, three independent 2026-dated
 * practitioner pieces that compute the same year. **FISCAL YEAR — 2026. SMN — 4.050 lei (1 ianuarie 2026).
 * GRADE — CORROBORATED.**
 *
 * Recorded in `docs/ai/research/47_published_worked_examples_fy2026.md` §3A and §3C.
 *
 * ── The number a reader is most likely to get wrong ───────────────────────────────────────────────────
 *
 * **20 % is the *cota forfetară de cheltuieli*, not a tax rate.** The net is 80 % of the gross. The tax is
 * **10 % of that net**, and the rate sits in a different article from the ratio — art. 84 alin. (3) fixes the
 * ratio, art. 123 alin. (2) fixes the rate. Reading 20 as a rate applied to gross would be wrong twice over,
 * and it would still produce a plausible-looking number.
 *
 * ── Why the FY2026 case is the one that tests the threshold ───────────────────────────────────────────
 *
 * The corroborated year nets exactly **24.000 lei**, which is 300 lei *below* the 6-SMN CASS condition of
 * 24.300 lei, so no CASS is due at all. One step over the line and the base is the whole 6-SMN rung. That is
 * the „concrete income on each side of a threshold" the research asks for, and it is why this case is pinned
 * rather than the ANAF one alone.
 *
 * ── Not used, deliberately ────────────────────────────────────────────────────────────────────────────
 *
 * ANAF's Exemplul 4 **PJ limb** is excluded from this whole phase: it states „30.000 lei" and then computes
 * with 32.000 lei. That is an error inside an official document (`research/47` §4A, §11.4) and pinning either
 * number would teach a figure no source actually stands behind. The art. 84¹ limb is pinned from a different
 * source in `golden.art84x1.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { computed, driveFlatRatio, lineOf, lineValue } from './harness';
import { calculatorRegistry } from '../fiscal/calculators';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../fiscal/package2026';
import { lei, type Bani } from '../money';

const art84Rule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'CEDARE_ART84_2026')!;

/** Run only the art. 84 determination rule, with no contribution leg beside it. */
function determine(gross: Bani) {
  const res = calculatorRegistry['calc-cedare-art84-flat-ratio'](art84Rule, { gross });
  if ('reviewRequired' in res) throw new Error(res.reason);
  if (typeof res.determinedNet !== 'number') throw new Error('the rule reported no determined net');
  return { net: res.determinedNet, tax: res.value };
}

describe('FIXTURE 2A (FACT — ANAF DGFP București DU-2026 deck, Exemplul 4, income year 2025, SMN 4.050 lei) — brut 24.000 → forfetar 4.800 → net 19.200 → impozit 1.920', () => {
  it('the whole chain, in lei, exactly as ANAF prints it', async () => {
    const res = computed(await driveFlatRatio({ gross: lei(24_000), method: 'cedare-art84' }));
    expect(lineValue(res, 'Venit brut art. 84')).toBe(lei(24_000)); // „Venitul brut = 24.000 lei"
    expect(lineValue(res, 'Cheltuieli forfetare 20 %')).toBe(lei(4_800)); // „24.000 x 20% = 4.800 lei"
    expect(lineValue(res, 'Venit net art. 84')).toBe(lei(19_200)); // „Venit net anual = 19.200 lei"
    expect(lineValue(res, 'Impozit art. 84')).toBe(lei(1_920)); // „19.200 x 10% = 1.920 lei"
  });

  it('the 20 % is an expense ratio and the 10 % is the rate, in two different articles', () => {
    const { net, tax } = determine(lei(24_000));
    expect(net).toBe(lei(19_200));
    expect(tax).toBe(lei(1_920));
    // A rate applied to the gross would have been 4.800 lei. It is not the answer, and the label says why.
    expect(tax).not.toBe(lei(4_800));
    const ratio = art84Rule.parameters.find((p) => p.id === 'expense_ratio')!;
    const rate = art84Rule.parameters.find((p) => p.id === 'tax_rate')!;
    expect(ratio.value).toBe(20);
    expect(rate.value).toBe(10);
    expect(String(rate.description)).toContain('art. 123 alin. (2)');
  });

  it('art. 84 income is not „impozit final" — the owner establishes it (art. 123 alin. (2))', async () => {
    const res = computed(await driveFlatRatio({ gross: lei(24_000), method: 'cedare-art84' }));
    const label = lineOf(res, 'Impozit art. 84')!.label;
    expect(label).not.toContain('final');
  });
});

describe('FIXTURE 2B (CORROBORATED — renzi.ro + completam.ro + declararatie-unica.ro, income year 2026, SMN 4.050 lei) — 30.000 → 6.000 → 24.000 → 2.400, CASS 0', () => {
  it('2.500 lei/lună × 12 = 30.000 brut → forfetar 6.000 → net 24.000 → impozit 2.400 lei', async () => {
    const res = computed(await driveFlatRatio({ gross: lei(30_000), method: 'cedare-art84' }));
    expect(lineValue(res, 'Venit brut art. 84')).toBe(lei(30_000));
    expect(lineValue(res, 'Cheltuieli forfetare 20 %')).toBe(lei(6_000));
    expect(lineValue(res, 'Venit net art. 84')).toBe(lei(24_000));
    expect(lineValue(res, 'Impozit art. 84')).toBe(lei(2_400));
  });

  it('CASS is 0 because the net 24.000 lei is below the 6-SMN condition of 24.300 lei', async () => {
    const res = computed(await driveFlatRatio({ gross: lei(30_000), method: 'cedare-art84' }));
    // art. 170 alin. (2) is a condition precedent, not a rate: below 6 SMN cumulated nothing is owed at all.
    expect(lineValue(res, 'CASS pe veniturile')).toBe(lei(0));
    // And the total is the income tax alone — no contribution hides inside it.
    expect(res.output.total).toBe(lei(2_400));
  });

  it('the 300 lei above that line is a whole rung, not a marginal step', async () => {
    // Not a published case — the step test the published case exists to make possible. 24.300 lei of net is
    // exactly 6 SMN, and the base then jumps to the rung: CASS 2.430 lei. Pinned as a CLIFF guard.
    const res = computed(await driveFlatRatio({ gross: lei(30_375), method: 'cedare-art84' }));
    expect(lineValue(res, 'Venit net art. 84')).toBe(lei(24_300));
    expect(res.bases.bazaDeCalculCassArt155LitCH).toBe(lei(24_300));
    expect(lineValue(res, 'CASS pe veniturile')).toBe(lei(2_430));
  });

  it('CAS is never owed on rent: art. 84 income is art. 155 alin. (1) lit. e), not lit. b)', async () => {
    const res = computed(await driveFlatRatio({ gross: lei(30_000), method: 'cedare-art84' }));
    expect(lineValue(res, 'CAS (25%)')).toBe(lei(0));
    // The lit. b) base the CAS and CASS threshold rows read is zero for a letting register, and the engine
    // says so rather than reporting the letting net beside it (the B-71 defect class).
    expect(res.bases.venitulNetDinActivitate).toBe(lei(0));
    expect(res.bases.venitulNetCumulatPentruContributii).toBe(lei(0));
  });
});
