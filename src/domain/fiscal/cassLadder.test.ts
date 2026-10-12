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

  it('CASS withheld at source is a credit this build does not model, so it refuses rather than double-charging', () => {
    const reason = refusal(run({ amounts: spread(lei(60_000)), cassRetinutLaSursa: lei(2_430) }));
    expect(reason).toMatch(/art\. 174¹ alin\. \(3\)-\(4\)/);
    expect(reason).toMatch(/deduce/);
  });

  it('a withheld amount beside no contribution of its own is not a refusal', () => {
    const result = computed(run({ amounts: spread(lei(10_000)), cassRetinutLaSursa: lei(2_430) }));
    expect(result.value).toBe(lei(0));
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
