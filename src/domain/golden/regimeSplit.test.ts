/**
 * PHASE 31 FIXTURE 1 — the regime split. The highest-value assertion in this repository.
 *
 * **SOURCE** — ANAF DGFP București, „Noutăți privind Declarația Unică 2026 – exemple",
 * `static.anaf.ro/static/10/Bucuresti/Noutati_privind_DU_2026_exemple.pdf`, Examples 1, 2 and 3.
 * **FISCAL YEAR OF THE SOURCE — 2025.** **SMN THE SOURCE USED — 4.050 lei** (HG 1.506/2024, still the
 * wage in force on 1 ianuarie 2026 and until 30 iunie 2026, so the FY2025 and FY2026 anchors coincide).
 * **GRADE — FACT** (official ANAF worked examples, corroborated by the statute at art. 170 alin. (1)
 * versus alin. (2)-(4)).
 *
 * Recorded in `docs/ai/research/47_published_worked_examples_fy2026.md` §1 and §2.
 *
 * ── What is being pinned, and why nothing else in the suite does ──────────────────────────────────────
 *
 * The 6 / 12 / 24 SMN ladder is **not** the PFA rule.
 *
 *   art. 170 alin. (1)  — art. 155 alin. (1) **lit. b)** (activități independente): the base IS the actual
 *                         net income, capped at 72 SMN. A 6-SMN floor exists, but as the art. 174 alin. (6)
 *                         *difference*, disapplied by art. 174 alin. (7).
 *   art. 170 alin. (2)-(4) — art. 155 alin. (1) **lit. c)-h)** (DPI, asocieri, cedarea folosinței,
 *                         agricultură, investiții, alte surse): due only at or above 6 SMN cumulated, and
 *                         the base is the RUNG — 6 SM, 12 SM or 24 SM — never the income itself.
 *
 * ANAF's own arithmetic shows the split: a PFA with net 22.000 lei owes CASS **2.200 lei**, which is 10 % of
 * the net. It is **not** 2.430 lei, which is 10 % of the 6-SMN rung. And 22.000 lei sits *below* the 6-SMN
 * floor of 24.300 lei, so the only reason the floor does not bite is the salariat exception at art. 174
 * alin. (7) lit. a). A fixture that pinned 2.430 here would teach the wrong rule, and before this file no
 * test in the suite pinned either answer.
 *
 * ── Inputs the source does not state, declared here rather than smuggled in ───────────────────────────
 *
 * - **The salary amount.** ANAF says the taxpayer „is also a salariat" and computes 2.200 lei, which is only
 *   possible if realised salary income reached 6 SMN (24.300 lei). The deck never prints that amount
 *   (`research/47` §2A records the omission). This fixture declares 30.000 lei and says so; the published
 *   figure cannot be reproduced without some such figure, and inventing one silently is worse than
 *   inventing one loudly.
 * - **The VAT registration.** The deck is silent. The fixture assumes a neplătitor de TVA
 *   (art. 310), which is the state in which the contract amount and the income measure coincide, and which
 *   is what ANAF's „venit brut = 30.000 lei" reads as.
 * - **The 3 % bonificație** of art. 124, which ANAF applies at the end of Exemplul 2 (1.980 → 1.921 lei) and
 *   Exemplul 4 (1.920 → 1.862 lei). **The engine does not model it**, so the figures asserted here are the
 *   pre-bonificație ones ANAF prints before applying it. That is a stated gap, not an adjustment.
 */
import { describe, expect, it } from 'vitest';
import { answeredLadder, computed, driveSistemReal, lineOf, lineValue } from './harness';
import { lei } from '../money';

describe('FIXTURE 1 (FACT — ANAF DGFP București DU-2026 deck, income year 2025, SMN 4.050 lei) — PFA CASS is 10 % of the actual net, never the 6-SMN rung', () => {
  it('Exemplul 2: net 22.000 lei, salariat — CASS 2.200 lei, not 2.430 lei', async () => {
    const res = computed(
      await driveSistemReal({
        gross: lei(30_000), // „Venitul brut = 30.000 lei"
        expenses: lei(8_000), // „Cheltuieli deductibile = 8.000 lei"
        profile: { salaryStatus: 'da', salaryIncomeLei: lei(30_000) }, // declared by the fixture; see header
      }),
    );

    // „Venitul net = 22.000 lei" — and 22.000 < 24.300, the 6-SMN floor.
    expect(res.bases.venitulNetDinActivitate).toBe(lei(22_000));

    // „CASS datorată = 22.000 X 10% = 2.200 lei". THE point of this file.
    expect(lineValue(res, 'CASS (10%)')).toBe(lei(2_200));
    // The wrong answer, named so it cannot come back: 10 % of the 6-SMN rung.
    expect(lineValue(res, 'CASS (10%)')).not.toBe(lei(2_430));

    // „CAS not due (net below 12 SMN = 48.600)".
    expect(lineValue(res, 'CAS (25%)')).toBe(lei(0));

    // „venit impozabil 22.000 − 2.200 = 19.800" and „Impozitul = 19.800 x 10% = 1.980 lei".
    expect(lineValue(res, 'Venit net anual impozabil')).toBe(lei(19_800));
    expect(lineValue(res, 'Impozit pe venit')).toBe(lei(1_980));
  });

  it('the same net WITHOUT the salary fact is 2.430 lei — so the 2.200 above is the exception working, not an accident', async () => {
    // The counterfactual. art. 174 alin. (6) asks for a *difference* up to a 6-SMN base when the net is
    // positive but below 6 SMN, and nothing disapplies it here. Same money, one fact missing, different
    // contribution. Without this second test the first one cannot tell "the floor is disapplied for a
    // salariat" apart from "this engine has no floor at all".
    const res = computed(await driveSistemReal({ gross: lei(30_000), expenses: lei(8_000) }));
    expect(lineValue(res, 'CASS (10%)')).toBe(lei(2_430));
    // And the art. 174 alin. (6) difference is owed but never deductible, so the taxable base is unchanged.
    expect(lineValue(res, 'Venit net anual impozabil')).toBe(lei(19_800));
    expect(lineValue(res, 'CASS deductibilă')).toBe(lei(2_200));
  });

  it('Exemplul 1: net 26.640 lei — CASS 2.664 lei, not 2.430 lei', async () => {
    // 26.640 lei is ABOVE the 6-SMN floor, so no exception is needed and no top-up applies: the base is the
    // net itself. The published figure is the CASS; the deck's gross/expense split for this example is not
    // reproduced in research/47, so the fixture supplies a net of exactly 26.640 lei and asserts only the
    // figures the source states.
    const res = computed(await driveSistemReal({ gross: lei(26_640), expenses: lei(0) }));
    expect(res.bases.venitulNetDinActivitate).toBe(lei(26_640));
    expect(lineValue(res, 'CASS (10%)')).toBe(lei(2_664));
    expect(lineValue(res, 'CASS (10%)')).not.toBe(lei(2_430));
  });

  it('Exemplul 3: the two CASS tracks run in PARALLEL on the same person — 6.800 lei on the PFA net, 9.720 lei on the ladder', async () => {
    // „AI net 68.000 (brut 100.000, cheltuieli 32.000); DPI net 50.000; dividende 48.000".
    // Categoria A (art. 170 alin. (1), lit. b)): base IS the net → 68.000 × 10 % = 6.800 lei.
    // Categoria B (art. 170 alin. (2)-(4), lit. c)-h)): 50.000 + 48.000 = 98.000 cumulated → at or above
    // 24 SMN (97.200) → base 97.200 → 9.720 lei.
    // The two never merge: the PFA net never enters the 6/12/24 test, and the ladder never enters the 72-SM
    // cap. This is the regime split in a single official example.
    //
    // **B-112 stage 2 — why this reads a refusal and still asserts the CASS figures.** The year now stops
    // before the income tax, because the art. 118 alin. (2²) proration has no settled rounding policy
    // (B-118). That refusal sits **downstream** of both CASS limbs, and `rr` carries the lines computed so
    // far, so the two tracks are still observable and are asserted here unchanged. What is asserted
    // differently is *where* they are read from, not *what* they are. The one figure that used to come from
    // `bases` — the rung the ladder chose — is now a printed line, precisely so a refusal cannot hide it.
    const res = await driveSistemReal({
      gross: lei(100_000),
      expenses: lei(32_000),
      ladderYears: answeredLadder({
        proprietateIntelectuala: lei(50_000), // DPI net, art. 155 alin. (1) lit. c)
        investitii: lei(48_000), // dividende, art. 155 alin. (1) lit. g)
        cedareaFolosinteiBunurilor: lei(0), // this taxpayer has none; declared, not defaulted
      }),
    });
    // The refusal is the B-118 proration, not a CASS failure — asserted first so a reader cannot mistake
    // the shape of the result for the subject of the test.
    expect(res.status).toBe('review_required');
    if (res.status !== 'review_required') throw new Error('unreachable: status was just asserted');
    expect(res.reason).toContain('art. 118 alin. (2²)');

    expect(lineValue(res, 'CASS (10%)')).toBe(lei(6_800));
    expect(lineValue(res, 'CASS pe veniturile')).toBe(lei(9_720));
    // The rung the ladder chose is 24 SMN, and it is a base, not the 98.000 lei cumulated.
    expect(lineValue(res, 'Baza de calcul CASS art. 155 alin. (1) lit. c)-h)')).toBe(lei(97_200));
    // And the PFA's own net is a separate quantity, not swept into that base. This is the CASS cumulation
    // line of art. 170 alin. (1) — printed because B-112 stage 2 made it differ from the CAS one.
    expect(lineValue(res, 'Venit cumulat pentru CASS')).toBe(lei(68_000));
    // One income tax, on the sistem-real composition — the ladder contribution is not deducted from it
    // (art. 118 alin. (2^3) prorates the art. 174 alin. (1) contribution, not the art. 174¹ one).
    expect(lineOf(res, 'Impozit art.')).toBeUndefined();
  });
});

describe('FIXTURE 1 — FINDING: the same ANAF example pins a CAS figure the engine does not produce', () => {
  /**
   * **This fixture still fails against the published value, and it is left failing on purpose. The cause
   * has changed, and the change is the progress.**
   *
   * SOURCE — the same ANAF deck, Exemplul 3, income year 2025, SMN 4.050 lei.
   * PUBLISHED — „AI+DPI 118.000 → bază CAS 97.200 (24 SMN) → CAS 24.300 → diferență 12.150".
   *
   * **Before B-112 stage 2** the engine computed a CAS of 12.150 lei: `cumulateContributionBase` summed
   * only the art. 155 alin. (1) lit. b) legs, so the DPI 50.000 lei reached the CASS ladder (where it
   * belongs, art. 170 alin. (4) lit. c)) and never the CAS ceiling test (where it also belongs, art. 148
   * alin. (3) cumulating art. 137 alin. (1) **lit. b) și b^1)**). 68.000 lei selected the 12-SMN tier.
   *
   * **Now** the DPI amount enters the CAS cumulation — `casCumulationBase` in `domain/tax.ts` — the
   * cumulation is 118.000 lei, the 24-SMN tier is selected, and the CAS line the engine builds is
   * **24.300 lei, ANAF's figure**. The test below asserts exactly that, on the partial lines the engine
   * returns alongside its refusal.
   *
   * **Why the fixture still cannot flip, and what is actually blocking it.** The engine refuses before it
   * returns a result, one step later: CF art. 118 alin. (2²) prorates the deductible CAS by „ponderea
   * venitului net anual determinat în sistem real în total venituri cumulate potrivit art. 148 alin. (3)”.
   * With DPI in that denominator the ratio is 68.000 ÷ 118.000, and 24.300 lei × 68/118 is not a whole
   * number of bani. A deduction is not one of the three sums art. 66 alin. (1) rounds — rounding it would
   * change the taxable base, which is a base — so `exactBani` reports rather than repairs, and
   * `computeTaxEstimate` returns `review_required`. That refusal was unreachable before B-112 stage 2,
   * because a sistem-real register with one leg always had ratio exactly 1.
   *
   * **B-118 — the blocker is a precision question, and it is sharper than "round or refuse".** The exact
   * proration is 24.300 × 68.000 ÷ 118.000 = **14.003,389830… lei**, nearest ban **14.003 lei**. ANAF's own
   * deck prints **13.997 lei**. The two differ by **6 lei**, and the reason is that ANAF rounds the
   * *ratio* first: 68.000 ÷ 118.000 = 57,627… %, shown as **57,6 %**, and 24.300 × 57,6 % = 13.996,80 →
   * **13.997 lei**. So the open question is not whether to round but **at what precision the ponderea is
   * carried**, and that is a two-step inference from a single worked example. Adopting it silently would
   * bake one example into a rule — the exact thing `exactBani` was written to stop — so the engine now
   * computes both candidates, names them in the refusal, and uses neither.
   *
   * So the remaining gap is **not** a missing income category any more. It is a rounding decision the Cod
   * fiscal does not state and this repository has deliberately refused to infer from one example. Closing
   * it is tracked as **B-118**, and the authority (D212 instructions, a Norme metodologică, or ANAF
   * filling-in guidance on how *ponderea* is rounded) is being sought before any code picks a side.
   *
   * **B-112 stage 3 — what this does NOT implicate: the two CASS limbs.** Exemplul 3's two CASS amounts
   * (6.800 lei on the PFA net, 9.720 lei on the ladder at the 24-SMN rung) are produced by the engine on
   * the success path in `cass.twoLimbs.test.ts`, by a route that fills the second basin with dividends
   * instead of DPI. Dividends do not enter the CAS ceiling test, so the proration stays exact and the year
   * computes. That isolates the blocker: it is the CAS proration of a DPI-bearing year, and nothing about
   * the CASS separation. **This fixture is not that test and is not to be read as Exemplul 3 passing** —
   * the literals here are ANAF's, and ANAF's example puts DPI in both basins at once.
   */
  it.fails('FINDING — ANAF Exemplul 3 CAS: published 24.300 lei; the engine now builds that figure but refuses the result (art. 118 alin. (2^2) proration is fractional)', async () => {
    const res = computed(
      await driveSistemReal({
        gross: lei(100_000),
        expenses: lei(32_000),
        ladderYears: answeredLadder({
          proprietateIntelectuala: lei(50_000),
          investitii: lei(48_000),
          cedareaFolosinteiBunurilor: lei(0),
        }),
      }),
    );
    expect(lineValue(res, 'CAS (25%)')).toBe(lei(24_300)); // ANAF's figure, verbatim.
  });

  it('the CAS cumulation now selects ANAF\'s tier — the refusal carries the 24.300 lei line it built before refusing', async () => {
    // The companion to the fixture above, and the reason the finding is narrower than it was. The engine
    // refuses, so `computed()` cannot be used; the partial lines it hands back are read directly, because
    // a refusal that names no figure is a dead end and a refusal that carries the figure says exactly how
    // far the arithmetic got.
    const res = await driveSistemReal({
      gross: lei(100_000),
      expenses: lei(32_000),
      ladderYears: answeredLadder({
        proprietateIntelectuala: lei(50_000),
        investitii: lei(48_000),
        cedareaFolosinteiBunurilor: lei(0),
      }),
    });
    expect(res.status).toBe('review_required');
    if (res.status !== 'review_required') throw new Error('unreachable: the status was just asserted');
    // The cumulation ANAF prints, and the tier it selects — 118.000 lei over 24 SMN (97.200 lei).
    const casLine = res.lines.find((l) => l.label.startsWith('CAS (25%)'));
    expect(casLine?.value).toBe(lei(24_300));
    expect(res.lines.find((l) => l.label.startsWith('Venit cumulat pentru CAS'))?.value).toBe(lei(118_000));
    // The old wrong answer, asserted absent so it cannot return quietly: 25 % of the 12-SMN floor.
    expect(casLine?.value).not.toBe(lei(12_150));
    // And the refusal itself, quoted so the blocker is on the record rather than inferred from a diff.
    expect(res.reason).toContain('art. 118 alin. (2²)');
    // The refusal names both candidate readings, because a person facing it should learn the app will not
    // guess, not that the app is broken. These are the two numbers B-118 turns on: 14.003,39 lei is the
    // exact proration rounded at the ban, and 13.996,80 lei is what ANAF's own deck produces by rounding the
    // ponderea to 57,6 % first — 13.996,80 lei is the deck's 13.997 lei at the nearest leu.
    expect(res.reason).toContain('14003.39');
    expect(res.reason).toContain('13996.8');
  });

  it('without the DPI amount the year still computes, so the refusal is the DPI path and not the register', async () => {
    // The counterfactual that makes the test above mean something. Same register, same expenses, the DPI
    // amount removed: the cumulation is 68.000 lei, the ratio is 68.000 ÷ 68.000 = 1, the proration is
    // whole, and the engine computes — at the 12-SMN tier, which is the correct CAS for 68.000 lei alone.
    const res = computed(
      await driveSistemReal({
        gross: lei(100_000),
        expenses: lei(32_000),
        ladderYears: answeredLadder({
          proprietateIntelectuala: lei(0),
          investitii: lei(48_000),
          cedareaFolosinteiBunurilor: lei(0),
        }),
      }),
    );
    expect(lineValue(res, 'CAS (25%)')).toBe(lei(12_150));
  });
});
