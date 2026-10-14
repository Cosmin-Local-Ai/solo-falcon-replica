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
    expect(res.bases.bazaDeCalculCassArt155LitCH).toBe(lei(97_200));
    // And the PFA's own net is a separate quantity, not swept into that base.
    expect(res.bases.venitulNetDinActivitate).toBe(lei(68_000));
    // One income tax, on the sistem-real composition — the ladder contribution is not deducted from it
    // (art. 118 alin. (2^3) prorates the art. 174 alin. (1) contribution, not the art. 174¹ one).
    expect(lineOf(res, 'Impozit art.')).toBeUndefined();
  });
});

describe('FIXTURE 1 — FINDING: the same ANAF example pins a CAS figure the engine does not produce', () => {
  /**
   * **This fixture fails against the published value, and it is left failing on purpose.**
   *
   * SOURCE — the same ANAF deck, Exemplul 3, income year 2025, SMN 4.050 lei.
   * PUBLISHED — „AI+DPI 118.000 → bază CAS 97.200 (24 SMN) → CAS 24.300 → diferență 12.150".
   * ENGINE — CAS 12.150 lei, i.e. the 12-SMN base of 48.600 lei.
   *
   * The cause is a rule gap, not an arithmetic slip: CF art. 148 alin. (3) cumulates the base across art.
   * 137 alin. (1) **lit. b) și b^1)**, and *drepturi de proprietate intelectuală* is lit. b^1). The engine's
   * `cumulateContributionBase` in `domain/tax.ts` sums only the art. 155 alin. (1) lit. b) legs it holds —
   * sistem-real and art. 68^3 — and the app has no DPI income path at all. So the DPI 50.000 lei reaches the
   * CASS ladder (where it belongs, art. 170 alin. (4) lit. c)) and never reaches the CAS cumulation (where
   * it also belongs). 68.000 lei selects the 12-SMN tier; 118.000 lei selects the 24-SMN tier.
   *
   * Per the phase rule, the expected value stays ANAF's. `it.fails` keeps the published literal as the
   * assertion — if the CAS cumulation is ever widened to lit. b^1), this test starts failing for the
   * opposite reason and whoever fixes it has to come and read this comment.
   */
  it.fails('FINDING — ANAF Exemplul 3 CAS: published 24.300 lei, engine 12.150 lei (art. 148 alin. (3) cumulates lit. b^1); the engine does not)', async () => {
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
    expect(lineValue(res, 'CAS (25%)')).toBe(lei(24_300)); // ANAF's figure, verbatim. The engine says 12.150.
  });

  it('the engine value the failing fixture above disagrees with, pinned so the divergence cannot drift silently', async () => {
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
    // This is the ENGINE's number, not a published one, and it is asserted only to make the gap visible:
    // 12.150 lei is 25 % of 48.600 lei (12 SMN), where ANAF measures 25 % of 97.200 lei (24 SMN).
    expect(lineValue(res, 'CAS (25%)')).toBe(lei(12_150));
    expect(lineValue(res, 'CAS (25%)')).not.toBe(lei(24_300));
  });
});
