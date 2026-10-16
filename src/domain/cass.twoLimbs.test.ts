/**
 * B-112 STAGE 3 — the two CASS limbs, and the one exemption that reaches only one of them.
 *
 * **What this file is not.** Limb 1 (`calcCass`, art. 170 alin. (1)) and limb 2 (`calcCassLadder`, art. 170
 * alin. (2)-(4) — the base is alin. (3), the cumulation alin. (4); the pre-2025 text put the ladder at
 * alin. (5) and OUG 128/2024 moved it, per research/50) were already built, and built well: the 72-SM cap,
 * the art. 174 alin. (2) loss case, the
 * 6-SM top-up with its three relief branches, the six-category completeness refusal, the art. 114
 * qualification, the art. 83 alin. (1) cedarea gate. This file does not re-prove those. It pins the two
 * things stage 3 actually adds or exposes:
 *
 * 1. **The two limbs produce two figures and never one.** ANAF states it in terms — *„!!! Veniturile din
 *    activități independente nu se cumulează cu alte venituri pentru determinarea obligației de plată a
 *    CASS."* The same taxpayer pays 6.800 lei on the PFA net and 9.720 lei on the ladder.
 * 2. **CF art. 154 alin. (1) lit. h¹)** — a person who realises salary and/or pension income is exempt from
 *    CASS *for DPI income*. That exemption reaches one ladder category and nothing else: the other five
 *    still cumulate, limb 1 is untouched, and CAS is a different table again (art. 150, pinned in stage 2).
 *
 * **The letter is not asserted as settled.** Consolidations disagree on whether this exemption is art. 148
 * alin. (1) lit. h) or lit. h¹) — research/48 open question 3 says to verify against Monitorul Oficial
 * before hard-coding it. The code cites h¹) because that is the reading research/48 §11.3 records, and the
 * breakdown says the letter is unverified. The tests below assert the *operative content*, not the letter.
 */
import { describe, expect, it } from 'vitest';
import { computeTaxEstimate } from './tax';
import { calculatorRegistry } from './fiscal/calculators';
import type { TaxInputsReference } from './derived';
import type { CassLadderYear, PfaProfile } from './models';
import { PFA_2026_RELEASE } from './fiscal/release2026';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import { lei, type Bani } from './money';

// The CASS rule the engine itself selects, read the same way `computeTaxEstimate` reads it. Imported
// rather than hand-built so the calculator-level assertions below run on the rule the app actually uses.
const cassRule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.taxRegime === 'cass')!;

const LIMB1_LINE = 'CASS (10%)';
const LIMB2_LINE = 'CASS pe veniturile din art. 155 alin. (1) lit. c)-h)';

function ladder(over: Partial<CassLadderYear> = {}): CassLadderYear[] {
  return [
    {
      fiscalYear: 2026,
      proprietateIntelectuala: lei(0),
      asocierePersoanaJuridica: lei(0),
      cedareaFolosinteiBunurilor: lei(0),
      activitatiAgricole: lei(0),
      investitii: lei(0),
      alteSurse: lei(0),
      cedareaSursa: 'patrimoniu_personal',
      ...over,
    },
  ];
}

function profile(over: Partial<PfaProfile> = {}): PfaProfile {
  return {
    id: 'p-cass-limbs',
    regime: 'impozit_pe_venit',
    fiscalYear: 2026,
    socialInsuranceStatus: 'obligatoriu',
    ...over,
  } as PfaProfile;
}

function inputs(over: Partial<TaxInputsReference> = {}): TaxInputsReference {
  return {
    regime: 'impozit_pe_venit',
    salaryStatus: 'nu',
    salaryIncomeLei: null,
    pensionerStatus: 'nu',
    pensionReceiptYears: [],
    pensionSuspensionYears: [],
    cassPreviousYearContext: null,
    foreignSicknessInsurance: null,
    cassLadderYears: [],
    socialInsuranceStatus: 'obligatoriu',
    vatRegistration: { status: 'scutit_art310' as const },
    cashFloorLei: lei(0),
    fiscalYear: 2026,
    pfaStartDate: null,
    inputsKey: 'p-cass-limbs:2026',
    ...over,
  };
}

/**
 * A sistem-real register with no DPI in the CAS cumul, so the art. 118 alin. (2²) proration stays at ratio
 * 1 and the year reaches the success path. That is deliberate: B-118 blocks the success path for any year
 * that puts DPI into the CAS ceiling test, and the two CASS limbs have to be observable somewhere.
 */
function engine(over: {
  revenues?: Bani;
  expenses?: Bani;
  ladderYears?: CassLadderYear[];
  inputs?: Partial<TaxInputsReference>;
}) {
  const revenues = over.revenues ?? lei(100_000);
  const expenses = over.expenses ?? lei(32_000);
  const ladderYears = over.ladderYears ?? ladder();
  return computeTaxEstimate({
    inputs: inputs({ cassLadderYears: ladderYears, ...over.inputs }),
    profile: profile({ cassLadderYears: ladderYears }),
    revenues,
    expenses,
    revenuesNet: revenues,
    expensesNet: revenues,
    expenseBase: { netFirst: expenses, grossFirst: expenses, divergent: false },
    flatRatioGross: null,
    flatRatioMethod: null,
    ruleRelease: PFA_2026_RELEASE,
    rules: PFA_2026_SYSTEM_REAL_PACKAGE,
  });
}

const line = (res: { lines: { label: string; value: Bani }[] }, prefix: string) =>
  res.lines.find((l) => l.label.startsWith(prefix))?.value;

describe('B-112 stage 3 — the two CASS limbs produce two figures and never one', () => {
  it("ANAF Exemplul 3's two CASS amounts, reached on the success path by a route that does not trip B-118", async () => {
    // **Read the label before the numbers.** This is NOT Exemplul 3 passing: the golden fixture stays a
    // finding, because Exemplul 3's DPI 50.000 lei enters the CAS ceiling test and makes the art. 118
    // alin. (2²) proration fractional, which refuses the whole year (B-118). What this test isolates is
    // that the refusal is the CAS proration and nothing about the CASS limbs: the same two amounts ANAF
    // publishes — 6.800 lei on the PFA net, 9.720 lei on the ladder, rung 24 SMN — are produced by the
    // engine end to end when the second basin is filled with dividends instead of DPI. Dividends do not
    // enter the CAS cumul (art. 148 alin. (3) reaches lit. b) and lit. b¹) only), so the ratio stays 1.
    const res = await engine({
      ladderYears: ladder({ investitii: lei(98_000) }),
    });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.status} — ${res.reason}`);
    // Limb 1 — art. 170 alin. (1): the base IS the net. 68.000 × 10 % = 6.800 lei.
    expect(line(res, LIMB1_LINE)).toBe(lei(6_800));
    // Limb 2 — art. 170 alin. (2)-(4): 98.000 cumulated ≥ 24 SMN (97.200) → base 97.200 → 9.720 lei.
    expect(line(res, LIMB2_LINE)).toBe(lei(9_720));
    expect(line(res, 'Baza de calcul CASS art. 155 alin. (1) lit. c)-h)')).toBe(lei(97_200));
    // Two lines, and no third line that adds them. A combined CASS figure is the defect ANAF's „!!!"
    // sentence warns about, and it is asserted absent rather than merely untested. (`CASS deductibilă` is a
    // third line that starts with the same letters — it is a deduction against the income tax, not a
    // contribution, so it is excluded by name rather than by prefix.)
    const contributionLines = res.lines.filter(
      (l) => l.label.startsWith(LIMB1_LINE) || l.label.startsWith(LIMB2_LINE),
    );
    expect(contributionLines.map((l) => l.value).sort((a, b) => a - b)).toEqual([lei(6_800), lei(9_720)]);
    expect(res.lines.some((l) => l.value === lei(16_520))).toBe(false);
  });

  it('limb 1 is capped at 72 SMN = 291.600 lei, and the cap never reaches limb 2', async () => {
    // art. 170 alin. (1): baza = net, „nu poate fi mai mare decât 72 de salarii minime brute".
    // 300.000 lei of net → base 291.600 → 29.160 lei, not 30.000 lei.
    const res = await engine({ revenues: lei(300_000), expenses: lei(0), ladderYears: ladder({ investitii: lei(98_000) }) });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.status} — ${res.reason}`);
    expect(line(res, LIMB1_LINE)).toBe(lei(29_160));
    // The ladder keeps its own rung and its own base beside it. The 72-SM cap is a limb-1 rule; applying it
    // to the ladder basin would borrow a ceiling from a provision that does not grant it.
    expect(line(res, LIMB2_LINE)).toBe(lei(9_720));
    expect(line(res, 'Baza de calcul CASS art. 155 alin. (1) lit. c)-h)')).toBe(lei(97_200));
  });

  it('an art. 118 loss is excluded from the limb 1 base, while limb 2 still runs on its own facts', async () => {
    // art. 174 alin. (2): a zero or negative net owes no CASS, and art. 170 alin. (1) does not let a fiscal
    // loss into the base. The ladder is a different basin measured on different income, so a loss-making
    // PFA year does not switch it off — and its contribution does not switch the zero back on.
    const res = await engine({ revenues: lei(20_000), expenses: lei(60_000), ladderYears: ladder({ investitii: lei(98_000) }) });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.status} — ${res.reason}`);
    expect(line(res, LIMB1_LINE)).toBe(lei(0));
    expect(line(res, LIMB2_LINE)).toBe(lei(9_720));
  });
});

describe('B-112 stage 3 — art. 154 alin. (1) lit. h¹): the CASS exemption that reaches DPI income only', () => {
  /**
   * DPI 17.000 + dividends 48.000. The DPI amount is chosen so the CAS proration stays exact — 68.000 ÷
   * 85.000 = 0,8 — because the art. 154 alin. (1) lit. h¹) exemption is a **CASS** exemption and does not
   * remove DPI from the **CAS** ceiling test of art. 148 alin. (3). Any DPI amount with a non-terminating
   * ratio therefore still trips B-118 before the ladder result can be read, and that is correct: the two
   * contributions have separate exemption tables. 65.000 lei cumulated sits on the 12-SMN rung (4.860 lei);
   * with the DPI amount excluded the 48.000 lei of dividends drops to the 6-SMN rung (2.430 lei).
   */
  const dpiAndDividends = ladder({ proprietateIntelectuala: lei(17_000), investitii: lei(48_000) });

  it('a salariat does not pay CASS on the DPI amount, and the rung drops with it', async () => {
    // art. 154 alin. (1) lit. h¹) — „persoanele fizice care realizează venituri din salarii și asimilate
    // salariilor și/sau venituri din pensii, pentru veniturile din drepturi de proprietate intelectuală"
    // (research/48 §11.3). The amount is not zeroed and not hidden: it is seen and left out of the
    // cumulation, which also removes it from the rung test — income for which no CASS is owed cannot select
    // the base of a CASS. 48.000 lei of dividends alone sits on the 6-SMN rung, not the 24-SMN one.
    const res = await engine({
      ladderYears: dpiAndDividends,
      inputs: { salaryStatus: 'da', salaryIncomeLei: lei(60_000) },
    });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.status} — ${res.reason}`);
    expect(line(res, LIMB2_LINE)).toBe(lei(2_430));
    expect(line(res, 'Baza de calcul CASS art. 155 alin. (1) lit. c)-h)')).toBe(lei(24_300));
    // Limb 1 is untouched by an exemption that names DPI income and nothing else.
    expect(line(res, LIMB1_LINE)).toBe(lei(6_800));
  });

  it('the same person without the salary fact pays the full 9.720 lei, so the exemption is doing the work', async () => {
    // The counterfactual that makes the test above mean something. Same register, same ladder answers, one
    // declared fact removed: DPI enters the cumulation, the rung is 24 SMN, the contribution is 9.720 lei.
    const res = await engine({ ladderYears: dpiAndDividends });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.status} — ${res.reason}`);
    expect(line(res, LIMB2_LINE)).toBe(lei(4_860));
    expect(line(res, 'Baza de calcul CASS art. 155 alin. (1) lit. c)-h)')).toBe(lei(48_600));
  });

  it('pension sums received in the year grant the same exemption (Legea 141/2025 art. II pct. 17)', async () => {
    // The extension to pensioners, in force from 1 Aug 2025. Keyed on sums RECEIVED in the fiscal year, not
    // on the status flag — the same discipline art. 174 alin. (7) lit. c) is held to, and the reason
    // `pensionReceiptYears` exists as its own record rather than as a boolean on the profile.
    const res = await engine({
      ladderYears: dpiAndDividends,
      inputs: { pensionerStatus: 'da', pensionReceiptYears: [{ fiscalYear: 2026, received: 'da' }] },
    });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.status} — ${res.reason}`);
    expect(line(res, LIMB2_LINE)).toBe(lei(2_430));
  });

  it('a declared "no pension sums this year" does NOT grant it, even beside a pensioner status', async () => {
    // The fact is realised income, and a recorded `nu` is an answer, not an absence. This is the case where
    // a status flag would have granted an exemption the law does not give.
    const res = await engine({
      ladderYears: dpiAndDividends,
      inputs: { pensionerStatus: 'da', pensionReceiptYears: [{ fiscalYear: 2026, received: 'nu' }] },
    });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.status} — ${res.reason}`);
    expect(line(res, LIMB2_LINE)).toBe(lei(4_860));
  });

  it('an unestablished fact withholds the exemption and says so, instead of guessing either way', async () => {
    // `pensionerStatus = da` with no answer for this fiscal year is neither a grant nor a refusal. The
    // amount is cumulated — withholding an exemption the app cannot establish is the conservative direction
    // for a contribution — and the ladder records that the exception was not established rather than
    // pretending the fact was checked.
    const res = await engine({ ladderYears: dpiAndDividends, inputs: { pensionerStatus: 'da' } });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.status} — ${res.reason}`);
    expect(line(res, LIMB2_LINE)).toBe(lei(4_860));
    const ladderRes = calculatorRegistry['calc-cass-ladder'](cassRule, {
      cassLadder: {
        amounts: {
          proprietate_intelectuala: lei(50_000),
          asociere_persoana_juridica: lei(0),
          cedarea_folosintei_bunurilor: lei(0),
          activitati_agricole: lei(0),
          investitii: lei(48_000),
          alte_surse: lei(0),
        },
        cedareaSursa: 'patrimoniu_personal',
        dpiExemptArt154: 'unknown',
      },
    });
    if ('reviewRequired' in ladderRes) throw new Error('ladder refused');
    expect(ladderRes.breakdown.some((b) => b.includes('EXCEPȚIE NESTABILITĂ'))).toBe(true);
  });

  it('the exemption states the letter is unverified, because the consolidations disagree', async () => {
    // research/48 open question 3: „Art. 154 alin. (1) lit. h) vs h¹) — consolidations disagree on the
    // letter; operative content is the same. Verify against Monitorul Oficial before hard-coding the
    // letter." The operative content is asserted above; this asserts that the app does not present the
    // letter as settled fact.
    const ladderRes = calculatorRegistry['calc-cass-ladder'](cassRule, {
      cassLadder: {
        amounts: {
          proprietate_intelectuala: lei(50_000),
          asociere_persoana_juridica: lei(0),
          cedarea_folosintei_bunurilor: lei(0),
          activitati_agricole: lei(0),
          investitii: lei(48_000),
          alte_surse: lei(0),
        },
        cedareaSursa: 'patrimoniu_personal',
        dpiExemptArt154: 'da',
      },
    });
    if ('reviewRequired' in ladderRes) throw new Error('ladder refused');
    const note = ladderRes.breakdown.find((b) => b.includes('LITERA NEVERIFICATĂ'));
    expect(note).toBeDefined();
    expect(note).toContain('research/48');
    // And the DPI amount is named as seen, not silently dropped: a reader has to be able to find the money.
    expect(ladderRes.breakdown.some((b) => b.includes('CONSEMNET') && b.includes('50000'))).toBe(true);
    // The cumulation the ladder reports is the dividends alone.
    expect(ladderRes.breakdown[0]).toContain('48000');
  });

  it('the exemption never reaches limb 1, and never reaches CAS', async () => {
    // Three tables, three keys, asserted together so nobody merges them later:
    //   art. 154 alin. (1) lit. h¹) — CASS, DPI income only.
    //   art. 150 alin. (2)          — CAS, lit. b¹) income only.
    //   art. 155 alin. (1) lit. b)  — reached by neither.
    const res = await engine({
      ladderYears: dpiAndDividends,
      inputs: { salaryStatus: 'da', salaryIncomeLei: lei(60_000) },
    });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.status} — ${res.reason}`);
    expect(line(res, LIMB1_LINE)).toBe(lei(6_800)); // CASS on the PFA net: unchanged.
    expect(line(res, 'CAS (25%)')).toBe(lei(12_150)); // CAS: art. 150 alin. (2) is not applied to lit. b).
  });
});
