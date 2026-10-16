/**
 * B-122 and B-125 — the two CASS withholding sources that were never wired, and the CAS refund that does
 * not exist. Both driven through the calculators, because both defects live in the calculators and neither
 * depends on the engine's composition.
 *
 * ## B-122 — art. 174¹ alin. (3) names THREE sources whose plătitor must withhold CASS
 *
 * `drepturi de proprietate intelectuală`, *arendă* (cedarea folosinței bunurilor, art. 83) and *asocieri cu
 * persoane juridice*. This file's predecessor derived the retained amount from the DPI leg alone, so a
 * taxpayer whose CASS was withheld by an arendaș or by the asociere got `reținută = 0` and `de plătit` equal
 * to the whole contribution.
 *
 * **The harm is not a smaller number, and the copy says so.** It is that the app tells a person they owe the
 * entire contribution when somebody has already paid part of it to the state on their behalf. A rate error
 * moves a figure; this one invents a debt.
 *
 * ## B-125 — over-withheld CAS is not returnable, and the old wording implied it might be
 *
 * The note written before `docs/ai/research/52_dividends_losses_withholding_fy2026.md` said recovery was
 * „nu este modelată de aplicație”. That is a sentence about the app. research/52 §Q4 scanned all of Titlul V
 * (art. 135 → 220⁸, 320.745 characters) and found the only CAS restitution text is a **denial** — art. 151
 * alin. (4): „contribuția plătită **nu se restituie**, aceasta fiind valorificată la stabilirea elementelor
 * necesare determinării dreptului de pensie”. The form agrees: D212 Subsecțiunea 1 stops at rd.5 „Diferența
 * stabilită în plus”, there is no CAS minus row, and in the Sumar no CAS amount can reach „Diferență de
 * restituit”. For CASS, art. 174 alin. (12) is the only compensate/restitute route and art. 174¹ alin. (12)
 * reaches only art. 174 alin. **(14)-(18)**, deliberately excluding alin. (12).
 *
 * **No refund path is built here, because there is none to build.** What is pinned is the state the app
 * reports — the money is kept and credited to pension service — and that no CAS figure can arrive at a
 * restitution row.
 */
import { describe, expect, it } from 'vitest';
import { calculatorRegistry, type CalculatorResult, type CassLadderInput } from './calculators';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';
import { CASS_LADDER_CATEGORIES, type CassLadderCategory } from '../models';
import { lei, type Bani } from '../money';

const cassRule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'CASS_2026')!;
const casRule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'CAS_2026')!;

const runLadder = (input: CassLadderInput): CalculatorResult =>
  calculatorRegistry['calc-cass-ladder'](cassRule, { cassLadder: input });

function computed(result: CalculatorResult) {
  if ('reviewRequired' in result) throw new Error(`the calculator refused instead of computing: ${result.reason}`);
  return result;
}

/** All six categories answered — declared zeros unless overridden. */
function six(over: Partial<Record<CassLadderCategory, Bani>> = {}): Record<CassLadderCategory, Bani> {
  const zero = Object.fromEntries(CASS_LADDER_CATEGORIES.map((c) => [c, lei(0)])) as Record<
    CassLadderCategory,
    Bani
  >;
  return { ...zero, ...over };
}

const text = (r: { breakdown?: string[] }) => (r.breakdown ?? []).join('\n');

describe('B-122 — the arendă and asociere payers withhold too, and the credit reaches the taxpayer', () => {
  it('CASS withheld on arendă alone produces a non-zero reținută, where the DPI-only derivation produced none', () => {
    // 30.000 lei of cedarea folosinței bunurilor crosses the 6-SMN condition precedent on its own, so the
    // arendaș has a withholding duty: base 6 SM = 24.300 lei, CASS = 10 % × 24.300 = 2.430 lei.
    // Before B-122 this result carried NO `retinutLaSursa` at all — the app could not say what had been
    // retained, and `de plătit` was the whole contribution.
    const result = computed(
      runLadder({ amounts: six({ cedarea_folosintei_bunurilor: lei(30_000) }), cedareaSursa: 'patrimoniu_personal' }),
    );
    expect(result.value).toBe(lei(2_430));
    expect(result.retinutLaSursa).toBe(lei(2_430));
    expect(result.dePlatit).toBe(lei(0));
    expect(text(result)).toContain('cedarea folosinței bunurilor');
  });

  it('CASS withheld on an asociere cu persoană juridică alone produces a non-zero reținută', () => {
    const result = computed(runLadder({ amounts: six({ asociere_persoana_juridica: lei(30_000) }) }));
    expect(result.value).toBe(lei(2_430));
    expect(result.retinutLaSursa).toBe(lei(2_430));
    expect(result.dePlatit).toBe(lei(0));
    expect(text(result)).toContain('asocierea cu o persoană juridică');
  });

  it('the person is never charged twice: reținută + de plătit equals the due contribution, exactly', () => {
    // This is the acceptance criterion in one line. The defect was not that the credit was mis-stated but
    // that it was absent, which made `de plătit` the whole amount.
    for (const category of ['proprietate_intelectuala', 'asociere_persoana_juridica', 'cedarea_folosintei_bunurilor'] as const) {
      for (const net of [lei(24_300), lei(48_600), lei(100_000)]) {
        const result = computed(
          runLadder({
            amounts: six({ [category]: net }),
            ...(category === 'cedarea_folosintei_bunurilor' ? { cedareaSursa: 'patrimoniu_personal' as const } : {}),
          }),
        );
        expect(result.retinutLaSursa, `${category} @ ${net}`).toBeTypeOf('number');
        expect(result.dePlatit, `${category} @ ${net}`).toBeTypeOf('number');
        expect(
          (result.retinutLaSursa as Bani) + (result.dePlatit as Bani),
          `${category} @ ${net} lei`,
        ).toBe(result.value);
        expect(result.dePlatit).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('the withheld figure is never larger than the due one in a way that turns into a negative payment', () => {
    // A 12-SMN source inside a 6-SMN cumulation cannot happen (the source alone would lift the cumulation),
    // but a declared *informare* can exceed the due amount. The payable stays at 0 and the excess is
    // reported — see the B-125 block below for what happens to it.
    const result = computed(
      runLadder({ amounts: six({ asociere_persoana_juridica: lei(30_000) }), cassRetinutLaSursa: lei(9_720) }),
    );
    expect(result.value).toBe(lei(2_430));
    expect(result.retinutLaSursa).toBe(lei(9_720));
    expect(result.dePlatit).toBe(lei(0));
  });

  it('two qualifying sources: the app names both and refuses to choose the designated payer', () => {
    // art. 174¹ alin. (4): with several sources the taxpayer designates by contract the one plătitor whose
    // source alone exceeds 6 SMN. The app does not hold that designation. Summing the two retineri would
    // credit money nobody paid; picking one silently would move `de plătit` on a guess. So the withheld
    // figure goes unreported and the DUE contribution is unaffected.
    const result = computed(
      runLadder({
        amounts: six({ proprietate_intelectuala: lei(50_000), cedarea_folosintei_bunurilor: lei(30_000) }),
        cedareaSursa: 'patrimoniu_personal',
      }),
    );
    expect(result.value).toBe(lei(4_860)); // 12 SMN — the cumulation of 80.000 lei selects it
    expect(result.retinutLaSursa).toBeUndefined();
    expect(result.dePlatit).toBeUndefined();
    expect(text(result)).toContain('PLĂTITOR NEDESEMNAT');
    expect(text(result)).toContain('proprietate intelectuală');
    expect(text(result)).toContain('cedarea folosinței bunurilor');
  });

  it('several qualifying payers that would retain the SAME amount: the credit is still reported', () => {
    // The designation under art. 174¹ alin. (4) only bites when the candidates disagree. DPI 30.000 lei and an
    // asociere of 40.000 lei each select the 6-SMN rung, so either designated payer retains 2.430 lei and the
    // taxpayer's `de plătit` is the same either way. Suppressing the credit here would re-commit the B-122
    // harm behind a show of caution — and it did, on the first version of this fix: persona 6 lost its
    // `reținută la sursă` row until the branch was narrowed to genuine disagreement.
    const result = computed(
      runLadder({ amounts: six({ proprietate_intelectuala: lei(30_000), asociere_persoana_juridica: lei(40_000) }) }),
    );
    expect(result.value).toBe(lei(4_860)); // the cumulation of 70.000 lei selects 12 SMN
    expect(result.retinutLaSursa).toBe(lei(2_430));
    expect(result.dePlatit).toBe(lei(2_430));
    expect(text(result)).toContain('aceeași treaptă');
  });

  it('a declared informare still wins over every derivation, whichever source produced it', () => {
    // art. 174¹ alin. (7): the informare is a fact about money a payer retained. It is not attributable to a
    // source on the form, so it is taken as given and the disagreement with the derivation is stated.
    const result = computed(
      runLadder({
        amounts: six({ asociere_persoana_juridica: lei(50_000) }),
        cassRetinutLaSursa: lei(3_000),
      }),
    );
    expect(result.value).toBe(lei(4_860));
    expect(result.retinutLaSursa).toBe(lei(3_000));
    expect(result.dePlatit).toBe(lei(1_860));
    expect(text(result)).toContain('art. 174¹ alin. (7)');
  });

  it('the art. 154 alin. (1) lit. h¹) exemption exempts DPI only, and does not silence the other two payers', () => {
    // The exemption is one category wide. A salariat or pensioner with DPI plus an arendă still has an
    // arendaș with a withholding duty on the arendă, and a derivation that treated the exemption as
    // covering the whole basin would report no credit again — the B-122 defect wearing a different hat.
    const result = computed(
      runLadder({
        amounts: six({ proprietate_intelectuala: lei(50_000), cedarea_folosintei_bunurilor: lei(30_000) }),
        cedareaSursa: 'patrimoniu_personal',
        dpiExemptArt154: 'da',
      }),
    );
    // Only the 30.000 lei of arendă still cumulates → 6 SMN rung.
    expect(result.value).toBe(lei(2_430));
    expect(result.retinutLaSursa).toBe(lei(2_430));
    expect(result.dePlatit).toBe(lei(0));
  });
});

describe('B-125 — over-withheld CAS is kept and credited to pension service, never returned', () => {
  /** CAS due 0 (below 12 SMN) with a payer that withheld at the 12-SMN rung: the over-withholding case. */
  function overWithheldCas() {
    const result = calculatorRegistry['calc-cas'](casRule, {
      base: lei(24_000), // below the 12-SMN entry condition → CAS datorată 0
      casWithholdingSourceNet: lei(50_000), // the payer's source alone → 12 SMN → 12.150 lei retained
    });
    if ('reviewRequired' in result) throw new Error(`calcCas refused: ${result.reason}`);
    return result;
  }

  it('the payable figure is 0 lei and never a negative payment', () => {
    const result = overWithheldCas();
    expect(result.value).toBe(lei(0));
    expect(result.retinutLaSursa).toBe(lei(12_150));
    expect(result.dePlatit).toBe(lei(0));
    expect(result.dePlatit as number).toBeGreaterThanOrEqual(0);
  });

  it('the wording states the denial and the pension credit, not a modelling gap', () => {
    const t = text(overWithheldCas());
    // The sentence that used to stand here — „recuperarea … nu este modelată de aplicație” — implied a route
    // the app had simply not implemented. It must not come back.
    expect(t).not.toContain('nu este modelată de aplicație');
    expect(t).toContain('contribuția plătită nu se restituie');
    expect(t).toContain('dreptului de pensie');
    expect(t).toContain('art. 151 alin. (4)');
    expect(t).toContain('Diferență de restituit');
  });

  it('no CAS amount can reach a restitution row: no line is negative and no line speaks of restitution', () => {
    // D212 Subsecțiunea 1 has rows rd.1–rd.5 and ends at „Diferența stabilită în plus (rd.3 − rd.4)”. There
    // is no CAS minus row, and every minus row on the form validates „Doar valori pozitive”. The engine's
    // CAS triple is pinned to the same shape: three non-negative magnitudes, and the words „restituit” /
    // „restituire” appear only inside the sentence that says it does not happen.
    const result = overWithheldCas();
    const values = [result.value, result.retinutLaSursa, result.dePlatit].filter(
      (v): v is Bani => typeof v === 'number',
    );
    expect(values).toHaveLength(3);
    for (const v of values) expect(v).toBeGreaterThanOrEqual(0);
    const t = text(result);
    expect(t).toMatch(/nu se restituie/);
    expect(t).not.toMatch(/sumă de restituit|restituire aprobată|rambursare de CAS/);
  });

  it('the CASS over-retention says the same thing for the three art. 174¹ sources, and names the one route that is not theirs', () => {
    const result = computed(
      runLadder({ amounts: six({ proprietate_intelectuala: lei(30_000) }), cassRetinutLaSursa: lei(4_860) }),
    );
    const t = text(result);
    expect(t).toContain('Excesul NU se restituie');
    expect(t).toContain('art. 174 alin. (12)');
    expect(t).toContain('(14)-(18)');
    expect(t).toContain('art. 68¹');
  });
});
