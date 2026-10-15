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
import { addBani, lei } from '../money';

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
    // **B-112 stage 5 — the year computes.** It used to stop before the income tax on the art. 118
    // alin. (2²) proration (B-118), and the CASS figures below had to be read off the refusal's partial
    // lines. B-118 is closed, so they are read from the result again. What changed is where they are read
    // from, not what they are.
    const res = computed(
      await driveSistemReal({
        gross: lei(100_000),
        expenses: lei(32_000),
        ladderYears: answeredLadder({
          proprietateIntelectuala: lei(50_000), // DPI net, art. 155 alin. (1) lit. c)
          investitii: lei(48_000), // dividende, art. 155 alin. (1) lit. g)
          cedareaFolosinteiBunurilor: lei(0), // this taxpayer has none; declared, not defaulted
        }),
      }),
    );

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

  it('B-112 stage 4 — the same example prints DUE / WITHHELD / PAYABLE, with ANAF literals as the assertions', async () => {
    /**
     * **SOURCE** — the same ANAF deck, Exemplul 3, recorded in `research/47` §2 with the two withheld
     * figures named as inputs („CASS reținut DPI 4.860; CAS reținut 12.150”) and the two differences as
     * outputs („diferență 12.150”, „diferență 4.860”). `research/50` quotes the CASS sentence verbatim:
     * „Avem CASS reținută de plătitorul de venit din drepturi de proprietate intelectuală = 4.860 lei •
     * Rezultă o diferență de plată = 9.720 – 4.860 = 4.860 lei.”
     *
     * **Why the engine can produce them without being told them.** The profile holds no payment register —
     * minting one would be a chain step, and the head stays v21. What it holds is the DPI net, and the two
     * withholding articles make the payer's duty a function of exactly that amount: art. 174¹ alin. (3) has
     * the single payer apply the art. 156 rate to the art. 170 alin. (3) base its own source selects
     * (50.000 lei → the 12-SMN rung → 48.600 → 4.860 lei), and art. 151 alin. (6) has it apply the art. 138
     * lit. a) rate to the art. 148 alin. (2) floor that same source selects (50.000 lei → 48.600 → 12.150
     * lei). The cumulation then lifts the DUE base to 24 SMN, and alin. (9) / alin. (6) say the retained
     * contribution „este luată în calcul”. That is the whole arithmetic of ANAF's example, and it is the
     * reading `research/48` §4 states: „DPI net 50.000 alone sits in the 12–24 SMN band for CAS (base
     * 48.600 → withheld 12.150) and the 12–24 band for CASS (base 48.600 → withheld 4.860).”
     */
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

    // CAS: „CAS datorată = 97.200 × 25% = 24.300 lei • CAS reținută de plătitorul de venit din DPI = 12.150
    // lei • Diferență de plată CAS = 24.300 − 12.150 = 12.150 lei”.
    expect(lineValue(res, 'CAS (25%)')).toBe(lei(24_300));
    expect(lineValue(res, 'CAS reținută la sursă')).toBe(lei(12_150));
    expect(lineValue(res, 'CAS de plătit')).toBe(lei(12_150));

    // CASS, limb 2: datorată 9.720 • reținută 4.860 • de plătit 4.860.
    expect(lineValue(res, 'CASS pe veniturile')).toBe(lei(9_720));
    expect(lineValue(res, 'CASS reținută la sursă')).toBe(lei(4_860));
    expect(lineValue(res, 'CASS de plătit')).toBe(lei(4_860));

    // **Limb 1 stays 6.800 lei and is not merged with limb 2**, and it has no withholding line at all:
    // art. 174¹ reaches the art. 155 alin. (1) lit. c)-h) basin, and no payer withholds CASS on the PFA's
    // own art. 68 net. A single combined CASS figure is the defect stage 3 refused and stage 4 keeps closed.
    expect(lineValue(res, 'CASS (10%)')).toBe(lei(6_800));
    expect(res.lines.some((l) => l.label.startsWith('CASS (10%) reținută'))).toBe(false);
    expect(res.lines.some((l) => l.label.startsWith('CASS de plătit pentru veniturile art. 67'))).toBe(false);

    // The two conflations this stage exists to prevent, asserted ABSENT: the due figure read as the payable
    // one, and the withheld figure read as a second charge.
    expect(lineValue(res, 'CASS de plătit')).not.toBe(lei(9_720));
    expect(lineValue(res, 'CAS de plătit')).not.toBe(lei(24_300));
    // And the withheld contributions are not added to the burden: `Total taxe` is the DUE total, so a year
    // that also prints reținută/de plătit lines must not move it.
    expect(lineValue(res, 'Total taxe')).toBe(
      addBani(addBani(lei(24_300), lei(6_800)), addBani(lei(9_720), lineValue(res, 'Impozit pe venit'))),
    );
  });
});

describe('FIXTURE 1 — FINDING: the same ANAF example pins a CAS figure the engine does not produce', () => {
  /**
   * **This fixture passes, and how it came to pass is the discipline point.**
   *
   * SOURCE — the same ANAF deck, Exemplul 3, income year 2025, SMN 4.050 lei.
   * PUBLISHED — „AI+DPI 118.000 → bază CAS 97.200 (24 SMN) → CAS 24.300 → pondere 57,6 % → CAS deductibil
   * 13.997 → venit impozabil 27.203 → impozit 2.720".
   *
   * **B-112 stage 2** moved this file from disagreeing about CAS to disagreeing about the proration: the DPI
   * amount entered the art. 148 alin. (3) cumulation, the 24-SMN tier and the 24.300 lei CAS became
   * correct, and the year then refused on the art. 118 alin. (2²) proration (B-118).
   *
   * **B-118 is closed, and closing it disproved this source.**
   * `docs/ai/research/49_proration_precision_fy2026.md` establishes that the precision of the *ponderea* is
   * regulated nowhere — the words „rotunjire", „zecimale" and „procente" do not occur anywhere in the 78-page
   * OPANAF 2736/2025 order, and the ratio row is defined only mechanically as „(rd. 1 / rd. 2)" — and that
   * **ANAF's own D212 web application returns 14.004 lei on these very numbers**, while **Subsecțiunea 5.1,
   * the DPI CAS deductibilă path this repository builds, uses the exact ratio.** ANAF Galați and Cluj carry
   * the ratio at 2 decimals of a percent; București alone uses one. **The București 13.997 is sloppiness, not
   * a rule.**
   *
   * **So the expected value moves from 13.997 to 14.003, and that is not the forbidden move.** The forbidden
   * move is adjusting an expected value to match the engine. Here the source was disproven by better
   * evidence — ANAF's own software plus two other ANAF leaflets — and the adopted rule (exact ratio, rounded
   * once at the product by CF art. 66) was chosen on its own merits and then applied, not reverse-engineered
   * to hit a number. **13.997 is kept below as a named negative**, so the error in an official leaflet stays
   * visible instead of being quietly overwritten.
   *
   * **What still does not match, and it is not the proration: the income tax.** ANAF reaches 27.203 lei of
   * taxable income and 2.720 lei of tax from „48.000 – 13.997 – 6.800", and that 48.000 is the example's
   * *„Pierdere fiscală reportată = 20.000"*. `computeTaxEstimate` has **no input for a prior-year reported
   * loss**: it produces a `lossCarryForward` for the year being computed (art. 118 alin. (4)) but cannot
   * consume one from an earlier year. On the facts this app can hold, the base is
   * 68.000 – 14.003 – 6.800 = **47.197 lei** and the tax **4.720 lei**. The 6-lei proration decision is
   * therefore not what separates the two income figures — the missing loss operand is, and it is recorded
   * here rather than papered over.
   */
  it('FINDING CLOSED — ANAF Exemplul 3 reaches the success path: CAS 24.300, CAS deductibilă 14.003, CASS deductibilă 6.800', async () => {
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
    // The cumulation ANAF prints, and the tier it selects — 118.000 lei over 24 SMN (97.200 lei).
    expect(lineValue(res, 'Venit cumulat pentru CAS')).toBe(lei(118_000));
    expect(lineValue(res, 'CAS (25%)')).toBe(lei(24_300)); // ANAF's figure, verbatim.
    // The proration, as B-118 settled it: exact ratio 68.000 ÷ 118.000 = 0,576271186…, product
    // 14.003,3898 lei, rounded once at the product by art. 66 → 14.003 lei.
    expect(lineValue(res, 'CAS deductibilă')).toBe(lei(14_003));
    // art. 118 alin. (2³) divides by the art. 170 alin. (1) cumulation, which does NOT contain DPI, so that
    // ratio is 1 and the whole 6.800 lei of limb-1 CASS is deductible. The 9.720 lei tiered CASS of limb 2
    // is not deductible at all — art. 118 alin. (2³) prorates the contribution „calculată potrivit art. 174
    // alin. (1)", and the ladder contribution is calculated under art. 174¹ alin. (1).
    expect(lineValue(res, 'CASS deductibilă')).toBe(lei(6_800));
    // The old wrong CAS, asserted absent so it cannot return quietly: 25 % of the 12-SMN floor.
    expect(lineValue(res, 'CAS (25%)')).not.toBe(lei(12_150));
  });

  it('NAMED NEGATIVE — the engine does NOT produce ANAF București\'s 13.997 lei, and the reason stays on the record', async () => {
    // SOURCE OF THE ERROR — ANAF DGRFP București, „Noutăți privind DU 2026 – exemple", Exemplul 3:
    // „…= 68.000 / 118.000 x 100 = 57,6 % — CAS deductibil = 24.300 x 57,6% = 13.997 lei". The leaflet
    // rounded the ratio to ONE decimal of a percent before multiplying. That is neither a statutory rule nor
    // a display convention: ANAF's own application returns 14.004 lei on the same numbers, and its own
    // Subsecțiunea 5.1 — the DPI path — uses the exact ratio.
    //
    // The figure is asserted here as ABSENT on purpose. A future change that coarsens the ratio again would
    // otherwise be able to re-adopt the brochure's arithmetic without anyone having to argue for it.
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
    expect(lineValue(res, 'CAS deductibilă')).not.toBe(lei(13_997)); // București leaflet: 1 decimal of a percent.
    // The other candidates research/49 enumerates on these same numbers, also asserted absent:
    expect(lineValue(res, 'CAS deductibilă')).not.toBe(lei(14_004)); // ANAF's app: 4-decimal coefficient.
    expect(lineValue(res, 'CAS deductibilă')).not.toBe(lei(14_094)); // 2-decimal coefficient.
    // And the refusal that used to stand here is gone, not dormant.
    expect(res.status).toBe('computed');
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
