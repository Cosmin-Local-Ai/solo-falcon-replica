/**
 * B-112 STAGE 4 — withheld versus due: the payer-side state machines of CF art. 151 alin. (5)-(11) (CAS)
 * and art. 174¹ alin. (3)-(9) (CASS), driven end to end through `computeTaxEstimate`.
 *
 * **The defect this closes.** For DPI the payer withholds at source, so the contribution the law PRODUCES
 * and the contribution the taxpayer still has to hand over are different numbers, and the app conflated
 * them — it had no `reținută` and no `de plătit` at all, and `calcCassLadder` refused outright when a person
 * declared a withheld amount. That refusal is DELETED here, not left dormant: the same standard `exactBani`
 * and `leiFromDecimal` were held to when B-118 closed (a refusal whose reason has been fixed must not
 * survive as dead code for the next reader to re-open).
 *
 * **The alineate are the post-OUG 128/2024 ones.** `docs/ai/research/50_cass_cas_verbatim_fy2026.md` records
 * that OUG 128/2024 (MO 1125/11.11.2024) rewrote both articles — art. 174¹ went from alin. (1)-(21) to
 * alin. (1)-(12), and the CASS ladder moved from art. 170 alin. (5) to art. 170 alin. (3). `research/48` §4
 * still cites the pre-2025 numbering („art. 174¹ alin. (2), (6)-(10)”), and a right rule with a wrong
 * citation is how this phase kept producing wrong briefs. The numbering used throughout this file:
 *
 * | | CAS — art. 151 | CASS — art. 174¹ |
 * |---|---|---|
 * | single payer must withhold | alin. (6), trigger **12 SMN** | alin. (3), trigger **6 SMN** |
 * | several sources | alin. (7) — designated by contract | alin. (4) — designated by contract |
 * | that payer files D112 | alin. (8) (art. 147 alin. (1)), by the 25th | alin. (5), by the 25th |
 * | the top-up, „luată în calcul” | alin. (9) | alin. (6) |
 * | the payer’s *informare* | alin. (11) | alin. (7) |
 * | no withholding at all | alin. (10) | alin. (8) |
 * | other incomes → file the DU | — | alin. (9) |
 *
 * **Why the withheld amount is derived and not recorded.** The profile holds no payment register, and
 * minting one would be a chain step — the head stays v21 until the orchestrator approves one. What the
 * profile does hold is the DPI net, and both articles make the payer's duty a function of exactly that
 * amount, so the derivation is the rule rather than an invention. Every test below says which branch of the
 * machine produced its number, and the one state that must never be invented is the unknown: an unanswered
 * year prints NO withheld line, because "nobody withheld" and "the app cannot tell" are different claims.
 */
import { describe, expect, it } from 'vitest';
import { computeTaxEstimate } from './tax';
import type { TaxInputsReference } from './derived';
import type { CassLadderYear, PfaProfile } from './models';
import { selectRuleSet } from './fiscal';
import { calculatorRegistry } from './fiscal/calculators';
import { addBani, lei, type Bani } from './money';

const EXPENSES = lei(32_000);
const AI_NET = lei(30_000);

function ladder(dpi: Bani, over: Partial<CassLadderYear> = {}): CassLadderYear[] {
  return [
    {
      fiscalYear: 2026,
      proprietateIntelectuala: dpi,
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
    id: 'p-dpi-withholding',
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
    inputsKey: 'p-dpi-withholding:2026',
    ...over,
  };
}

/**
 * The rules come from the SELECTOR, not from a named release: a stage-4 test that imported
 * `PFA_2026_SYSTEM_REAL_PACKAGE` by name would keep passing after the selector stopped selecting it, which
 * is the defect `fiscal/registry.test.ts` polices.
 */
async function engine(
  over: { dpi?: Bani; aiNet?: Bani; ladderYears?: CassLadderYear[]; inputs?: Partial<TaxInputsReference> } = {},
) {
  const ladderYears = over.ladderYears ?? ladder(over.dpi ?? lei(0));
  const aiNet = over.aiNet ?? AI_NET;
  const entry = selectRuleSet(2026, '2026-01-01');
  if (!entry) throw new Error('no FY2026 rule set is registered');
  return computeTaxEstimate({
    inputs: inputs({ cassLadderYears: ladderYears, ...over.inputs }),
    profile: profile({ cassLadderYears: ladderYears }),
    revenues: addBani(aiNet, EXPENSES),
    expenses: EXPENSES,
    revenuesNet: addBani(aiNet, EXPENSES),
    expensesNet: EXPENSES,
    expenseBase: { netFirst: EXPENSES, grossFirst: EXPENSES, divergent: false },
    flatRatioGross: null,
    flatRatioMethod: null,
    ruleRelease: entry.release,
    rules: [...entry.rules],
  });
}

const line = (res: { lines: { label: string; value: Bani }[] }, prefix: string) =>
  res.lines.find((l) => l.label.startsWith(prefix))?.value;

const hasLine = (res: { lines: { label: string }[] }, prefix: string) =>
  res.lines.some((l) => l.label.startsWith(prefix));

function ok(res: Awaited<ReturnType<typeof engine>>) {
  if (res.status !== 'computed') throw new Error(`engine refused: ${res.reason}`);
  return res;
}

describe('CAS — art. 151 alin. (10): no source reaches 12 SMN, so nobody withholds and the whole CAS stays payable', () => {
  it('the cumulation still creates the contribution, but no payer has a duty to retain it', async () => {
    // 30.000 lei AI + 28.000 lei DPI = 58.000 lei cumulat, peste 12 SMN (48.600) → CAS 12.150 lei.
    // The DPI source ALONE is 28.000 lei, sub 12 SMN, so art. 151 alin. (6) never triggers and alin. (10)
    // says the taxpayer files the declaration: reținută 0, de plătit = datorată.
    const res = ok(await engine({ dpi: lei(28_000) }));
    expect(line(res, 'CAS (25%)')).toBe(lei(12_150));
    expect(line(res, 'CAS reținută la sursă')).toBe(lei(0));
    expect(line(res, 'CAS de plătit')).toBe(lei(12_150));
  });

  it('crossing 12 SMN with the single source is what creates the withholding — same year, one amount moved', async () => {
    // The counterfactual that makes the test above mean something: DPI 50.000 lei clears 12 SMN, so the
    // payer must withhold on the floor ITS OWN source selects (48.600 → 12.150 lei), and the cumulation
    // lifts the DUE base to 24 SMN (97.200 → 24.300 lei). alin. (9): „contribuția reținută … este luată în
    // calcul”, and the difference is what the DU establishes.
    const res = ok(await engine({ dpi: lei(50_000), aiNet: lei(68_000) }));
    expect(line(res, 'CAS (25%)')).toBe(lei(24_300));
    expect(line(res, 'CAS reținută la sursă')).toBe(lei(12_150));
    expect(line(res, 'CAS de plătit')).toBe(lei(12_150));
    // The conflation this stage prevents, asserted absent: due read as payable.
    expect(line(res, 'CAS de plătit')).not.toBe(lei(24_300));
  });
});

describe('the unknown state: an unanswered year prints no withheld line, and does not claim nobody withheld', () => {
  it('with no ladder year recorded, the CAS due figure stands alone', async () => {
    // `casWithholdingSourceNet` is undefined exactly when the year was never answered. Reporting 0 lei
    // reținut there would assert a fact the person never stated — the same absence discipline the ladder's
    // six categories are held to (defect B-41).
    const res = ok(await engine({ ladderYears: [], aiNet: lei(60_000) }));
    expect(line(res, 'CAS (25%)')).toBe(lei(12_150));
    expect(hasLine(res, 'CAS reținută la sursă')).toBe(false);
    expect(hasLine(res, 'CAS de plătit')).toBe(false);
  });

  it('a declared zero DPI is a different state, and it does print the triple', async () => {
    // The person was asked and answered: no DPI income, therefore no payer, therefore 0 lei reținut. That is
    // a fact about the machine, not a gap in it, and it is printed as one.
    const res = ok(await engine({ dpi: lei(0), aiNet: lei(60_000) }));
    expect(line(res, 'CAS (25%)')).toBe(lei(12_150));
    expect(line(res, 'CAS reținută la sursă')).toBe(lei(0));
    expect(line(res, 'CAS de plătit')).toBe(lei(12_150));
  });
});

describe('CASS — art. 174¹ alin. (3) and (6): the credit belongs to limb 2 and never touches limb 1', () => {
  it('the withheld CASS does not move the art. 170 alin. (1) contribution, and does not move the total', async () => {
    // The deleted refusal existed to stop the app charging the same contribution twice. With the credit
    // modelled, the guard has to be re-asserted as an amount: `Total taxe` is the DUE total, and a declared
    // *informare* must not change it.
    // Here the DPI source alone (50.000 lei) already selects the 12-SMN rung that the cumulation selects too,
    // so the retained amount equals the due one and the payable figure is 0 lei — art. 174¹ alin. (9).
    const without = ok(await engine({ dpi: lei(50_000) }));
    const withDeclared = ok(
      await engine({ ladderYears: ladder(lei(50_000), { cassRetinutLaSursa: lei(3_000) }) }),
    );
    expect(line(without, 'CASS (10%)')).toBe(line(withDeclared, 'CASS (10%)'));
    expect(line(without, 'Total taxe')).toBe(line(withDeclared, 'Total taxe'));
    expect(line(without, 'CASS pe veniturile')).toBe(lei(4_860));
    expect(line(without, 'CASS reținută la sursă')).toBe(lei(4_860));
    expect(line(without, 'CASS de plătit')).toBe(lei(0));
    // What the declared amount DOES change is the third number of the limb-2 triple — and only that one.
    expect(line(withDeclared, 'CASS pe veniturile')).toBe(lei(4_860));
    expect(line(withDeclared, 'CASS reținută la sursă')).toBe(lei(3_000));
    expect(line(withDeclared, 'CASS de plătit')).toBe(lei(1_860));
  });

  it('a declared informare that disagrees with the rule is used and the disagreement is stated, not repaired', async () => {
    // The declared amount is a fact about money a payer retained; the derived amount is only what the rule
    // would have required. The taxpayer's DUE contribution does not depend on which of the two is right, so
    // the app takes the recorded fact and says the two disagree — it does not silently prefer its own maths.
    const res = ok(await engine({ ladderYears: ladder(lei(50_000), { cassRetinutLaSursa: lei(3_000) }) }));
    expect(line(res, 'CASS pe veniturile')).toBe(lei(4_860));
    expect(line(res, 'CASS reținută la sursă')).toBe(lei(3_000));
    expect(line(res, 'CASS de plătit')).toBe(lei(1_860));
  });

  it('art. 174¹ alin. (9): where the retained amount already equals the due one, the payable figure is 0 lei', async () => {
    // DPI 28.000 lei alone selects the 6-SMN rung, and the cumulation of 58.000 lei selects the same rung, so
    // nothing is owed on top: the DU is not required for this limb, and the app says so with a 0 rather than
    // with a refusal.
    const res = ok(await engine({ dpi: lei(28_000) }));
    expect(line(res, 'CASS pe veniturile')).toBe(lei(2_430));
    expect(line(res, 'CASS reținută la sursă')).toBe(lei(2_430));
    expect(line(res, 'CASS de plătit')).toBe(lei(0));
  });
});

describe('the CAS exemption removes the withholding duty too, at the calculator that owns the triple', () => {
  it('art. 150 alin. (1): a pensioner leaves the payer nothing to retain, on both lit. b) and lit. b^1)', () => {
    const entry = selectRuleSet(2026, '2026-01-01');
    if (!entry) throw new Error('no FY2026 rule set is registered');
    const casRule = entry.rules.find((r) => r.ruleId === 'CAS_2026');
    if (!casRule) throw new Error('CAS_2026 is not in the selected rule set');
    const result = calculatorRegistry['calc-cas'](casRule, {
      base: lei(118_000),
      pensionerStatus: 'da',
      casWithholdingSourceNet: lei(50_000),
    });
    if ('reviewRequired' in result) throw new Error(`calc-cas refused: ${result.reason}`);
    expect(result.value).toBe(lei(0));
    expect(result.retinutLaSursa).toBe(lei(0));
    expect(result.dePlatit).toBe(lei(0));
    expect(result.breakdown.join('\n')).toMatch(/art\. 150 alin\. \(1\) atinge și veniturile din art\. 137 alin\. \(1\) lit\. b\^1\)/);
  });

  it('art. 151 alin. (9) is named when the payer withheld on a lower base than the annual one', () => {
    const entry = selectRuleSet(2026, '2026-01-01');
    if (!entry) throw new Error('no FY2026 rule set is registered');
    const casRule = entry.rules.find((r) => r.ruleId === 'CAS_2026');
    if (!casRule) throw new Error('CAS_2026 is not in the selected rule set');
    const result = calculatorRegistry['calc-cas'](casRule, {
      base: lei(118_000), // the art. 148 alin. (3) cumulation → the 24-SMN floor
      casWithholdingSourceNet: lei(50_000), // the source alone → the 12-SMN floor
    });
    if ('reviewRequired' in result) throw new Error(`calc-cas refused: ${result.reason}`);
    expect(result.value).toBe(lei(24_300));
    expect(result.retinutLaSursa).toBe(lei(12_150));
    expect(result.dePlatit).toBe(lei(12_150));
    const text = result.breakdown.join('\n');
    expect(text).toMatch(/art\. 151 alin\. \(9\)/);
    expect(text).toMatch(/art\. 151 alin\. \(6\)/);
    // The limitation is stated in the same breath as the number: this is a derived obligation, not a
    // recorded payment, because the app holds no payment register and no field for the alin. (11) informare.
    expect(text).toMatch(/NOTĂ \(LIMITARE, NU CONCLUZIE\)/);
  });
});
