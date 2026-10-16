/**
 * PHASE 31 FIXTURE 4 — art. 84¹: rent paid by a persoană juridică, tax withheld at source.
 *
 * **SOURCE** — firmaromania.com, „Chirie de la persoană fizică la firmă: impozit 2026",
 * `firmaromania.com/ro/blog/chirie-persoana-fizica-catre-firma/`. Corroborated on method (not on figures) by
 * renzi.ro's 2026 piece, whose own case is pinned below.
 * **FISCAL YEAR OF THE SOURCE — 2026. SMN THE SOURCE USED — 4.050 lei, and the source says so in terms:
 * „salariul minim luat în calcul este cel de la 1 ianuarie 2026, adică 4.050 lei, deci pragul este 24.300
 * lei, chiar dacă salariul minim a crescut la 4.325 lei din iulie".**
 * **GRADE — FACT (single source for these figures).**
 *
 * Recorded in `docs/ai/research/47_published_worked_examples_fy2026.md` §4B and §4C.
 *
 * ── The SMN anchor, pinned because a practitioner dissents ────────────────────────────────────────────
 *
 * `research/47` §6C records a live, unresolved conflict: fiscalitatelazi.ro computes the FY2026 thresholds
 * off **4.325 lei** (the wage from 1 iulie 2026, HG 146/2026), giving 25.950 / 51.900 / 103.800. ANAF
 * DGRFP Ploiești and DGRFP Brașov both state the 1 January anchor verbatim — „în vigoare la data de 1
 * ianuarie a anului de realizare a venitului … indiferent dacă în cursul aceluiași an se utilizează mai
 * multe valori ale salariului minim brut pe țară" — and the rule package holds `min_base` = 24.300 lei and
 * `max_annual_base` = 291.600 lei = 72 × 4.050. **The 4.325 reading is a dissent, not a rule, and this file
 * pins the ANAF reading.** If someone later switches the anchor, the assertion below is the one that turns red.
 *
 * ── Not used, deliberately ────────────────────────────────────────────────────────────────────────────
 *
 * ANAF's own Exemplul 4 PJ limb — the only official example that reaches art. 84¹ — states the input as
 * „30.000 lei" and computes with **32.000 lei**, and never multiplies the resulting net by 10 %, so it cannot
 * pin the withheld amount at all (`research/47` §4A, §10.5). It is an error inside an official document and
 * it is not a fixture.
 */
import { describe, expect, it } from 'vitest';
import { computed, driveFlatRatio, lineOf, lineValue } from './harness';
import { calculatorRegistry } from '../fiscal/calculators';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../fiscal/package2026';
import { lei, type Bani } from '../money';

const art84x1Rule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'CEDARE_ART84X1_2026')!;

function determine(gross: Bani) {
  const res = calculatorRegistry['calc-cedare-art84x1-withheld'](art84x1Rule, { gross });
  if ('reviewRequired' in res) throw new Error(res.reason);
  if (typeof res.determinedNet !== 'number') throw new Error('the rule reported no determined net');
  return { net: res.determinedNet, tax: res.value };
}

describe('FIXTURE 4A (FACT — firmaromania.com, income year 2026, SMN 4.050 lei at 1 ianuarie) — 3.000 lei/lună → 600 → 2.400 → 240 reținut', () => {
  it('the monthly figures the source prints: brut 3.000, forfetar 600, net 2.400, impozit reținut 240', () => {
    const { net, tax } = determine(lei(3_000));
    expect(net).toBe(lei(2_400)); // 3.000 − 20 % × 3.000 = 3.000 − 600
    expect(tax).toBe(lei(240)); // „impozit 240 reținut de SRL"
    // The owner is paid the rent less the withheld tax: 3.000 − 240 = 2.760 lei („suma virată").
    expect(lei(3_000) - tax).toBe(lei(2_760));
  });

  it('the annual figures the source prints: 36.000 brut → 2.880 lei de impozit', async () => {
    const res = computed(await driveFlatRatio({ gross: lei(36_000), method: 'cedare-art84x1' }));
    expect(lineValue(res, 'Venit brut art. 84^1')).toBe(lei(36_000)); // 3.000 × 12
    expect(lineValue(res, 'Cheltuieli forfetare 20 %')).toBe(lei(7_200));
    expect(lineValue(res, 'Venit net art. 84^1')).toBe(lei(28_800)); // 2.400 × 12
    const withheld = lineOf(res, 'Impozit reținut la sursă')!;
    expect(withheld.value).toBe(lei(2_880)); // „Annual 36.000 → 2.880 lei"
    expect(withheld.label).toContain('final'); // art. 84^1 alin. (6): the withheld tax IS final
  });

  it('the withheld 2.880 lei is reported but is NOT what the owner owes — the owner owes only CASS 2.430 lei', async () => {
    const res = computed(await driveFlatRatio({ gross: lei(36_000), method: 'cedare-art84x1' }));
    // „CASS by the owner: net 12 × 2.400 = 28.800 … pragul este 24.300 lei … CASS 2.430 lei".
    expect(res.bases.bazaDeCalculCassArt155LitCH).toBe(lei(24_300)); // 6 × 4.050, the 1 January anchor
    expect(lineValue(res, 'CASS pe veniturile')).toBe(lei(2_430));
    // Adding the withheld tax to the total would tell a landlord to pay the same leu twice.
    expect(res.output.total).toBe(lei(2_430));
    expect(res.output.total).not.toBe(lei(5_310));
    // And the withheld sum is still shown, so the owner can see what left their rent.
    expect(lineOf(res, 'Din care: reținut și virat de plătitorul de venit')!.value).toBe(lei(2_880));
  });

  it('the 1 January SMN anchor, pinned against the 4.325 lei dissent', async () => {
    // 28.800 lei cumulated is at or above 6 × 4.050 = 24.300 lei, so the rung is reached and CASS is owed.
    // On fiscalitatelazi.ro's 4.325 lei reading, 6 × 4.325 = 25.950 lei — 28.800 clears that too, so the rung
    // test alone would not catch the dissent. The base is what differs: 24.300 lei, not 25.950 lei, and
    // therefore 2.430 lei of CASS, not 2.595 lei.
    const res = computed(await driveFlatRatio({ gross: lei(36_000), method: 'cedare-art84x1' }));
    expect(res.bases.bazaDeCalculCassArt155LitCH).not.toBe(lei(25_950));
    expect(lineValue(res, 'CASS pe veniturile')).not.toBe(lei(2_595));
  });

  it('art. 84^1 alin. (8): with the withholding switched off, the same 2.880 lei becomes the owner\'s', async () => {
    // Rent paid exclusively in kind, or a contractual guarantee applied to the rent. The arithmetic does not
    // move; whose sum it is does.
    const res = computed(
      await driveFlatRatio({ gross: lei(36_000), method: 'cedare-art84x1', withholdingBlocked: true }),
    );
    expect(lineValue(res, 'Impozit art. 84^1 alin. (8)')).toBe(lei(2_880));
    expect(res.output.total).toBe(lei(5_310)); // 2.430 CASS + 2.880 income tax, now the owner's
  });
});

describe('FIXTURE 4B (FACT — renzi.ro, income year 2026, SMN 4.050 lei) — 2.000 → 400 → 1.600 → 160 reținut, 1.840 to the owner', () => {
  it('a second independent 2026 case, same method, different numbers', () => {
    const { net, tax } = determine(lei(2_000));
    expect(net).toBe(lei(1_600));
    expect(tax).toBe(lei(160));
    expect(lei(2_000) - tax).toBe(lei(1_840)); // „1.840 net to owner"
  });
});
