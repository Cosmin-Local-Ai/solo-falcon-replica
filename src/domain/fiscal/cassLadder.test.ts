/**
 * PG-6d (D-OTH-1, D-OTH-2, B-41) — the CASS ladder for CF art. 155 alin. (1) lit. c)-h).
 *
 * Every expected figure below was derived BY HAND from the articles that govern this basin, against the
 * FY2026 minimum-wage anchor (SM = 4.050 lei on 1 ianuarie, CF art. 135¹ alin. (3) — NOT the 4.325 lei
 * introduced during the year by OUG 89/2025, because art. 135¹ alin. (3) fixes the anchor „indiferent dacă
 * în cursul aceluiași an se utilizează mai multe valori"):
 *
 *   6 SM  =  24.300 lei  → base  6 SM → CASS = 10 % ×  24.300 =  2.430 lei  — art. 170 alin. (2)-(3), 174¹ alin. (1)
 *   12 SM =  48.600 lei  → base 12 SM → CASS = 10 % ×  48.600 =  4.860 lei  — art. 170 alin. (4)
 *   24 SM =  97.200 lei  → base 24 SM → CASS = 10 % ×  97.200 =  9.720 lei  — art. 170 alin. (4)
 *
 * WHAT THIS FILE PINS, and why each is a real failure mode rather than a tautology:
 *
 * 1. **A condition precedent, not a rate.** Below 6 SM cumulated, art. 170 alin. (2) is not satisfied and
 *    there is no CASS at all for these categories. Importing the art. 174 alin. (6) "top up to 6 SM" rule
 *    from the lit. b) track would charge 2.430 lei to a person the same article exempts.
 * 2. **A cliff, inclusive at the lower bound.** 24.299 and 24.300 sit on different rungs; so do 48.599 and
 *    48.600. A marginal-rate implementation understates one leu below a rung and overstates one leu above
 *    it, and both errors are invisible in a single mid-range test.
 * 3. **One base per person.** Six categories feed one total feeding one base. Six per-category ladders
 *    would produce six contributions where art. 174¹ alin. (1) states one.
 * 4. **An unanswered category is not zero** — the defect B-41. Five answered and one blank must refuse;
 *    six answered with declared zeros must compute. Both directions are tested, because a build that
 *    refuses both is as wrong as one that defaults both.
 * 5. **The two letter-deciding facts (D-OTH-2)** can keep an amount out of the basin entirely: letting that
 *    is the PFA's own activity is lit. b), and an unqualified „alte surse" can be art. 61 lit. g)/h) income
 *    that never attracts CASS.
 *
 * What this file does NOT pin: the measurement of each category (net versus brut) is a declared fact with
 * its own selector in the Settings form; the engine never converts a gross into a net, and no test here
 * asks it to.
 */
import { describe, expect, it } from 'vitest';
import { calculatorRegistry, type CalculatorResult, type CassLadderInput } from './calculators';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';
import { CASS_LADDER_CATEGORIES, type CassLadderCategory } from '../models';
import { lei, type Bani } from '../money';

const cassRule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'CASS_2026')!;

const run = (input: CassLadderInput): CalculatorResult =>
  calculatorRegistry['calc-cass-ladder'](cassRule, { cassLadder: input });

/** The computed branch, or a failure that quotes the refusal rather than hiding it. */
function computed(result: CalculatorResult) {
  if ('reviewRequired' in result) throw new Error(`the ladder refused instead of computing: ${result.reason}`);
  return result;
}

/** The refusal branch, or a failure that quotes the number it produced. */
function refusal(result: CalculatorResult): string {
  if (!('reviewRequired' in result)) {
    throw new Error(`the ladder computed ${result.value} lei instead of refusing`);
  }
  return result.reason;
}

/** All six categories answered — with declared zeros unless overridden. */
function six(
  overrides: Partial<Record<CassLadderCategory, Bani>>,
): Partial<Record<CassLadderCategory, Bani>> {
  return {
    proprietate_intelectuala: lei(0),
    asociere_persoana_juridica: lei(0),
    cedarea_folosintei_bunurilor: lei(0),
    activitati_agricole: lei(0),
    investitii: lei(0),
    alte_surse: lei(0),
    ...overrides,
  };
}

/**
 * Six amounts whose sum is exactly `total`, spread over three categories that need no further fact to be
 * placed. `alte_surse` stays a declared zero here on purpose: a positive „alte surse” amount requires the
 * art. 114 answer (D-OTH-2) before it may be cumulated, and the boundary tests below are about the rung, not
 * about that gate — which has its own test.
 */
function spread(total: Bani): Partial<Record<CassLadderCategory, Bani>> {
  const third = Math.floor(total / 3) as Bani;
  return six({
    proprietate_intelectuala: third,
    asociere_persoana_juridica: third,
    investitii: (total - 2 * third) as Bani,
  });
}

describe('the art. 170 alin. (2)-(4) ladder is a cliff, not a rate', () => {
  it('below 6 SM cumulated there is no CASS at all — art. 170 alin. (2) is a condition precedent', () => {
    const result = computed(run({ amounts: six({ proprietate_intelectuala: lei(20_000) }) }));
    expect(result.value).toBe(lei(0));
    // The base is zero, not 6 SM: the art. 174 alin. (6) top-up belongs to art. 170 alin. (1) and this
    // provision does not contain it.
    expect(result.determinedNet).toBe(lei(0));
    expect(result.breakdown.join('\n')).toMatch(/condiție prealabilă, nu o cotă/);
  });

  it('24.299 lei cumulated is still below the first rung; 24.300 is on it', () => {
    const below = computed(run({ amounts: spread(lei(24_299)) }));
    expect(below.value).toBe(lei(0));
    expect(below.determinedNet).toBe(lei(0));

    const at = computed(run({ amounts: spread(lei(24_300)) }));
    expect(at.determinedNet).toBe(lei(24_300));
    expect(at.value).toBe(lei(2_430));
  });

  it('48.599 keeps the 6 SM base; 48.600 jumps the whole base to 12 SM', () => {
    const below = computed(run({ amounts: spread(lei(48_599)) }));
    expect(below.determinedNet).toBe(lei(24_300));
    expect(below.value).toBe(lei(2_430));

    const at = computed(run({ amounts: spread(lei(48_600)) }));
    expect(at.determinedNet).toBe(lei(48_600));
    expect(at.value).toBe(lei(4_860));
  });

  it('97.199 keeps the 12 SM base; 97.200 is the top rung, and there is no rung above it', () => {
    const below = computed(run({ amounts: spread(lei(97_199)) }));
    expect(below.determinedNet).toBe(lei(48_600));
    expect(below.value).toBe(lei(4_860));

    const at = computed(run({ amounts: spread(lei(97_200)) }));
    expect(at.determinedNet).toBe(lei(97_200));
    expect(at.value).toBe(lei(9_720));
  });

  it('the 72 SM cap of art. 170 alin. (1) does not reach this basin', () => {
    // 400.000 lei cumulated is above 72 SM (291.600). The ladder has no cap: its top rung is 24 SM, and the
    // cap belongs to the lit. b) track. A build that capped here would be mixing two provisions.
    const result = computed(run({ amounts: spread(lei(400_000)), alteSurseArt114: 'da' }));
    expect(result.determinedNet).toBe(lei(97_200));
    expect(result.value).toBe(lei(9_720));
    expect(result.breakdown.join('\n')).toMatch(/plafonul de 72 SM .* NU se aplică/);
  });
});

describe('one base per person, not one per category', () => {
  it('three categories produce ONE total, ONE base and ONE contribution', () => {
    const result = computed(
      run({
        amounts: six({
          proprietate_intelectuala: lei(18_000),
          cedarea_folosintei_bunurilor: lei(15_000),
          investitii: lei(20_000),
        }),
        cedareaSursa: 'patrimoniu_personal',
      }),
    );
    // 18.000 + 15.000 + 20.000 = 53.000 → at least 12 SM (48.600), below 24 SM (97.200) → base 12 SM.
    expect(result.determinedNet).toBe(lei(48_600));
    expect(result.value).toBe(lei(4_860));
    // Exactly one line states a base and one states the contribution; the six category lines state amounts.
    expect(result.breakdown.filter((l) => /baza anuală de calcul:/.test(l))).toHaveLength(1);
    expect(result.breakdown.filter((l) => /= \d+ lei — art\. 174¹ alin\. \(1\)/.test(l))).toHaveLength(1);
  });
});

describe('an unanswered category is not zero (B-41)', () => {
  it('five categories answered and one blank refuses, and names the missing one', () => {
    const reason = refusal(
      run({
        amounts: {
          proprietate_intelectuala: lei(30_000),
          asociere_persoana_juridica: lei(0),
          cedarea_folosintei_bunurilor: lei(0),
          activitati_agricole: lei(0),
          investitii: lei(0),
          // `alte_surse` deliberately absent: unanswered, not zero.
        },
      }),
    );
    expect(reason).toContain('alte surse (lit. h))');
    // The refusal names the gap in the language the person reads, never as the stored identifier.
    expect(reason).not.toContain('alte_surse');
    expect(reason).toMatch(/nu completează zero/);
  });

  it('the refusal is the same whether the gap is one category or five', () => {
    expect(refusal(run({ amounts: { investitii: lei(120_000) } }))).toMatch(/lipsesc 5/);
  });

  it('six categories answered with declared zeros computes, and computes to no CASS', () => {
    const result = computed(run({ amounts: six({}) }));
    expect(result.value).toBe(lei(0));
    expect(result.determinedNet).toBe(lei(0));
  });

  it('nothing declared at all refuses, and does not claim the person had no such income', () => {
    expect(refusal(run({}))).toMatch(/nu este o afirmație/);
  });
});

describe('the two facts that decide the letter (D-OTH-2)', () => {
  it('a letting amount declared as the PFA’s own activity is lit. b) and never joins the cumulation', () => {
    const reason = refusal(
      run({ amounts: six({ cedarea_folosintei_bunurilor: lei(60_000) }), cedareaSursa: 'activitate_proprie_a_pfa' }),
    );
    expect(reason).toMatch(/art\. 83 alin\. \(1\)/);
    expect(reason).toMatch(/lit\. b\)/);
  });

  it('the same amount from personal patrimony is lit. e) and does join it', () => {
    const result = computed(
      run({ amounts: six({ cedarea_folosintei_bunurilor: lei(60_000) }), cedareaSursa: 'patrimoniu_personal' }),
    );
    expect(result.determinedNet).toBe(lei(48_600));
  });

  it('an unqualified „alte surse” amount is not cumulated — art. 61 lit. g)/h) never attract CASS', () => {
    expect(refusal(run({ amounts: six({ alte_surse: lei(80_000) }) }))).toMatch(/art\. 114/);
    expect(refusal(run({ amounts: six({ alte_surse: lei(80_000) }), alteSurseArt114: 'nu' }))).toMatch(/art\. 114/);

    const qualified = computed(run({ amounts: six({ alte_surse: lei(80_000) }), alteSurseArt114: 'da' }));
    expect(qualified.determinedNet).toBe(lei(48_600));
  });
});

describe('art. 170 alin. (5) and the two readings of art. 174 alin. (7) lit. b)', () => {
  it('neimpozabile income is recorded, shown, and never added to the cumulation', () => {
    const result = computed(run({ amounts: spread(lei(20_000)), neimpozabil: lei(30_000) }));
    // 20.000 measured + 30.000 neimpozabile: the cumulation stays 20.000, so no rung and no CASS.
    expect(result.determinedNet).toBe(lei(0));
    expect(result.breakdown.join('\n')).toMatch(/neimpozabile.*Consemnate, nu adunate/);
  });

  it('where the two readings of alin. (7) lit. b) diverge, the calculation reports both instead of choosing', () => {
    // The measured cumulation is under 6 SM but the realised income, counting the neimpozabile amounts that
    // art. 170 alin. (5) excludes, reaches it. Reading A would grant the art. 174 alin. (6) relief; Reading
    // B would not. No primary source resolves this (research/41 §7.6).
    const result = computed(run({ amounts: spread(lei(20_000)), neimpozabil: lei(10_000) }));
    expect(result.readingDivergence).toBeDefined();
    expect(result.readingDivergence).toMatch(/Citește A/);
    expect(result.readingDivergence).toMatch(/Citește B/);
  });

  it('where the readings converge, no divergence is reported', () => {
    const result = computed(run({ amounts: spread(lei(30_000)) }));
    expect(result.determinedNet).toBe(lei(24_300));
    expect(result.readingDivergence).toBeUndefined();
  });

  it('a withheld amount is a credit against the due contribution, never a second charge — the refusal is deleted, not dormant', () => {
    // B-112 STAGE 4. This test used to assert the refusal: the credit was not modelled, so the only honest
    // answer was to stop. It is modelled now, and the refusal was DELETED rather than left unused — the same
    // standard `exactBani` and `leiFromDecimal` were held to when B-118 closed. A declared amount is the
    // *informare* the payer must issue (art. 174¹ alin. (7)) and it wins over the derived one, because it is
    // a fact about money a payer retained while the derivation is only what the rule would have required.
    const result = computed(run({ amounts: spread(lei(60_000)), cassRetinutLaSursa: lei(2_430) }));
    expect(result.value).toBe(lei(4_860)); // datorată — 60.000 lei cumulat alege treapta de 12 SM
    expect(result.retinutLaSursa).toBe(lei(2_430));
    expect(result.dePlatit).toBe(lei(2_430)); // 4.860 − 2.430, art. 174¹ alin. (6)
    expect(result.breakdown.join('\n')).toMatch(
      /datorată 4860 lei • reținută la sursă 2430 lei • de plătit 2430 lei/,
    );
  });

  it('with nothing declared, the withheld figure is the payer’s own obligation on its own source — art. 174¹ alin. (3)', () => {
    // ANAF DGRFP București, Exemplul 3, the CASS literal research/50 quotes: DPI net 50.000 lei beside
    // dividende de 48.000 lei. Cumulate 98.000 lei ≥ 24 SMN → baza 97.200 → CASS 9.720 lei. The DPI source
    // ALONE reaches only the 12-SMN rung, so the payer withholds 10 % × 48.600 = 4.860 lei, and ANAF's
    // „Rezultă o diferență de plată = 9.720 – 4.860 = 4.860 lei” is the third number of this triple.
    const result = computed(
      run({ amounts: six({ proprietate_intelectuala: lei(50_000), investitii: lei(48_000) }) }),
    );
    expect(result.value).toBe(lei(9_720));
    expect(result.retinutLaSursa).toBe(lei(4_860));
    expect(result.dePlatit).toBe(lei(4_860));
    expect(result.breakdown.join('\n')).toMatch(/art\. 174¹ alin\. \(3\)/);
    // The top-up is the reason the two bases differ, and it is named: alin. (6) „contribuția reținută …
    // este luată în calcul”.
    expect(result.breakdown.join('\n')).toMatch(/art\. 174¹ alin\. \(6\)/);
  });

  it('art. 174¹ alin. (8): a source under 6 SMN withholds nothing, even when the cumulation crosses 6 SMN', () => {
    // The no-withholding branch is a fact about the machine, not a gap in it: the taxpayer files the DU and
    // the whole contribution stays `de plătit`. Asserting 0 here is what keeps the derived figure from being
    // a guess that happens to look like a payment.
    const result = computed(run({ amounts: spread(lei(30_000)) }));
    expect(result.value).toBe(lei(2_430));
    expect(result.retinutLaSursa).toBe(lei(0));
    expect(result.dePlatit).toBe(lei(2_430));
    expect(result.breakdown.join('\n')).toMatch(/art\. 174¹ alin\. \(8\)/);
  });

  it('a declared withholding larger than the due contribution is reported, not refunded and not quietly clamped', () => {
    const result = computed(
      run({ amounts: six({ proprietate_intelectuala: lei(30_000) }), cassRetinutLaSursa: lei(4_860) }),
    );
    expect(result.value).toBe(lei(2_430));
    expect(result.retinutLaSursa).toBe(lei(4_860));
    expect(result.dePlatit).toBe(lei(0));
    expect(result.breakdown.join('\n')).toMatch(/NU este tratat ca rambursare/);
  });

  it('where the DPI income is exempt under art. 154 alin. (1) lit. h¹), the payer has nothing to withhold', () => {
    // Stage 3 already keeps the exempt amount out of the cumulation; stage 4 keeps it out of the withholding
    // too, for the same reason — income that owes no CASS cannot be the base of a CASS somebody retained.
    const result = computed(
      run({
        amounts: six({ proprietate_intelectuala: lei(50_000), investitii: lei(48_000) }),
        dpiExemptArt154: 'da',
      }),
    );
    expect(result.value).toBe(lei(2_430)); // only the 48.000 lei of dividends still cumulate — 6 SMN rung
    expect(result.retinutLaSursa).toBe(lei(0));
    expect(result.dePlatit).toBe(lei(2_430));
  });

  it('a withheld amount beside no contribution of its own is not a refusal', () => {
    const result = computed(run({ amounts: spread(lei(10_000)), cassRetinutLaSursa: lei(2_430) }));
    expect(result.value).toBe(lei(0));
    // B-112 stage 4: it is not a refusal now, and it is not a charge either — the credit is stated and the
    // amount still payable is 0 lei.
    expect(result.retinutLaSursa).toBe(lei(2_430));
    expect(result.dePlatit).toBe(lei(0));
  });
});

describe('the six categories are the six the law lists', () => {
  it('the ladder sums exactly the art. 155 alin. (1) lit. c)-h) categories, in order', () => {
    expect(CASS_LADDER_CATEGORIES).toEqual([
      'proprietate_intelectuala',
      'asociere_persoana_juridica',
      'cedarea_folosintei_bunurilor',
      'activitati_agricole',
      'investitii',
      'alte_surse',
    ]);
  });

  it('a negative declared amount refuses: art. 170 alin. (4) cumulates incomes, not losses', () => {
    expect(
      refusal(run({ amounts: six({ investitii: lei(-1_000), alte_surse: lei(60_000) }), alteSurseArt114: 'da' })),
    ).toMatch(/negativ/);
  });
});
