/**
 * PG-6h-2b — defect B-85: one determination method per profile-year.
 *
 * THE POINT OF THIS FILE. Every other 68^3 test in this repository reaches the engine through a path that
 * a scenario refusal can stop. That is not a guard: `tax.ts` used to compute `vnaSistemReal` and `flatNet`
 * from one record set and add them, so for a `cazare` register — where the expense engine returns an empty
 * deductible set — the sistem-real leg was the register's receipts with no deductions and the flat leg was
 * 70 % of those same receipts. `cumulatedNet` came out at 1,7 × revenue with an art. 123 tax and an
 * art. 68^3 alin. (6) tax stacked on it. Nothing structural prevented it; only the upstream refusal did.
 *
 * So every test here calls `computeTaxEstimate` DIRECTLY. No `selectEstimateOperands`, no
 * `evaluateScenarios`, no `selectDeductibleExpenses` — the scenario registry is not merely disabled, it is
 * not on this code path at all. If a later task retires `accommodation-gross-undetermined` (by resolving
 * B-80, building 6h-3, or adding the art. 85 rule), these tests still fail the moment the composition
 * starts adding two methods over one source again.
 *
 * The fixture is the register the defect needs: receipts AND recorded expenses AND a flat-ratio gross
 * measured on those same receipts. That is exactly what the assembler hands the engine for a `cazare`
 * profile, because `estimateBasis.ts selectEstimateOperands` takes the flat gross from the same
 * `selectYtd` pass it takes the sistem-real operands from.
 *
 * Every expected figure below is derived by hand from the FY2026 anchors: SM on 1 ianuarie 2026 = 4.050 lei
 * (HG 1.506/2024, fixed for art. 148/151/170/174 by CF art. 135^1 alin. (3)), so 6 SM = 24.300 ·
 * 12 SM = 48.600 · 24 SM = 97.200 · 72 SM = 291.600.
 */
import { describe, expect, it } from 'vitest';
import {
  computeTaxEstimate,
  cumulateContributionBase,
  sistemRealContributionRatio,
  type ContributionLeg,
} from './tax';
import type { TaxInputsReference } from './derived';
import type { PfaProfile } from './models';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import { PFA_2026_RELEASE } from './fiscal/release2026';
import { lei, type Bani } from './money';
import { buildThresholdBases } from '../data/dashboard';
import type { YtdTotals } from './aggregation';

// A cazare register: 130.000 lei of receipts, 100.000 lei of recorded expenses (which the art. 68 expense
// engine refuses for this activity, so they reach the engine as a zero deductible set), and the flat-ratio
// gross measured on the SAME 130.000 lei.
const RECEIPTS = lei(130_000);
const RECORDED_EXPENSES = lei(100_000);

// What the flat method determines from those receipts, by hand:
//   net = 70 % × 130.000 = 91.000 lei                       — art. 68^3 alin. (2)
//   tax = 10 % ×  91.000 =  9.100 lei, „impozitul fiind final" — alin. (6)
//   CAS : 91.000 ≥ 12 SM (48.600) and < 24 SM (97.200) → base 48.600 → 25 % = 12.150 — art. 148 alin. (2)
//   CASS: base IS the net, 91.000, above 6 SM and below 72 SM → 10 % = 9.100 — art. 170 alin. (1)
//   total = 12.150 + 9.100 + 9.100 = 30.350 lei
const FLAT_NET = lei(91_000);
const FLAT_TAX = lei(9_100);
const CAS_ON_FLAT = lei(12_150);
const CASS_ON_FLAT = lei(9_100);
const TOTAL_SINGLE_LEG = lei(30_350);

// What the defect produced on this same fixture. The sistem-real leg kept the receipts and lost the
// expenses, so it was worth the full 130.000; the flat leg added 91.000 on top of the same money; and the
// two income taxes were charged one after the other.
const DEFECT_CUMULATED = lei(221_000); // 130.000 + 91.000 = 1,7 × 130.000

function profile(over: Partial<PfaProfile> = {}): PfaProfile {
  return {
    id: 'p-b85',
    regime: 'impozit_pe_venit',
    fiscalYear: 2026,
    socialInsuranceStatus: 'obligatoriu',
    activityFamily: 'cazare',
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
    vatExempt: false,
    cashFloorLei: lei(0),
    fiscalYear: 2026,
    pfaStartDate: null,
    inputsKey: 'p-b85:2026',
    ...over,
  };
}

function line(res: { lines: { label: string; value: Bani }[] }, prefix: string) {
  return res.lines.find((l) => l.label.startsWith(prefix));
}

/**
 * The engine, called directly. This is the "refusal bypassed" condition the brief asks for: the scenario
 * registry never runs on this path, so nothing here can pass because a refusal fired.
 */
function engine(over: {
  revenues?: Bani;
  expenses?: Bani;
  revenuesNet?: Bani;
  expensesNet?: Bani;
  flatRatioGross?: Bani | null;
}) {
  return computeTaxEstimate({
    inputs: inputs(),
    profile: profile(),
    revenues: over.revenues ?? RECEIPTS,
    expenses: over.expenses ?? RECORDED_EXPENSES,
    revenuesNet: over.revenuesNet ?? RECEIPTS,
    expensesNet: over.expensesNet ?? RECORDED_EXPENSES,
    flatRatioGross: over.flatRatioGross ?? null,
    ruleRelease: PFA_2026_RELEASE,
    rules: PFA_2026_SYSTEM_REAL_PACKAGE,
  });
}

describe('B-85 — the composition is single-legged with the scenario refusal out of the picture', () => {
  it('cumulatedNet is one method\'s net, never 1,7 × the register\'s receipts', async () => {
    const res = await engine({ flatRatioGross: RECEIPTS });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;

    // The amount the contributions are measured on is the flat net, and nothing else.
    expect(res.bases.venitulNetDinActivitate).toBe(FLAT_NET);
    // The three quantities stay coherent under the method that ran: gross − deemed expense = net.
    expect(res.bases.venitulBrut).toBe(RECEIPTS);
    expect(res.bases.cheltuieliDeductibile).toBe(lei(39_000)); // 30 % × 130.000, art. 68^3 alin. (2)

    // The defect, stated as a negative on the two quantities it moved. 221.000 is sistem-real receipts plus
    // the flat net of the same receipts; 130.000 is the register's receipts taken as a sistem-real net with
    // the expenses dropped. Neither may appear as a contribution base.
    expect(res.bases.venitulNetDinActivitate).not.toBe(DEFECT_CUMULATED);
    expect(res.bases.venitulNetDinActivitate).not.toBe(RECEIPTS);
    // One source, so there is no second number for the same quantity to disagree with it.
    expect(res.bases.venitulNetCumulatPentruContributii).toBeUndefined();
  });

  it('the sistem-real leg is not run: no sistem-real income-tax line, no sistem-real VNA line', async () => {
    const res = await engine({ flatRatioGross: RECEIPTS });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;

    // The art. 123 line is absent, not zero. A zero would still be a sistem-real determination the
    // taxpayer is not under, and a reader would have to know the law to notice it was not theirs.
    expect(line(res, 'Impozit pe venit')).toBeUndefined();
    expect(line(res, 'Venit net anual impozabil')).toBeUndefined();
    // The art. 118 alin. (2) deduction composition apportioned a contribution onto a sistem-real base that
    // does not exist here, so it does not run either.
    expect(line(res, 'CAS deductibilă')).toBeUndefined();
    expect(line(res, 'CASS deductibilă')).toBeUndefined();
    // And the sistem-real gross/expense/net lines are absent: the flat method's own three lines replace
    // them, and pushing both sets would report the same receipts twice on screen.
    expect(line(res, 'Venit brut (')).toBeUndefined();
    expect(line(res, 'Cheltuieli deductibile')).toBeUndefined();
    expect(line(res, 'Venit net din activitate')).toBeUndefined();
    expect(line(res, 'Venit brut art. 68^3')!.value).toBe(RECEIPTS);
    expect(line(res, 'Venit net art. 68^3')!.value).toBe(FLAT_NET);
  });

  it('the contributions are measured on the flat net alone, and the total is not double-taxed', async () => {
    const res = await engine({ flatRatioGross: RECEIPTS });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(line(res, 'CAS (25%)')!.value).toBe(CAS_ON_FLAT);
    expect(line(res, 'CASS (10%)')!.value).toBe(CASS_ON_FLAT);
    expect(line(res, 'Impozit art. 68^3')!.value).toBe(FLAT_TAX);
    expect(res.output.total).toBe(TOTAL_SINGLE_LEG);
    // The counterfactual: with the sistem-real leg running beside the flat one, the same register produced
    // an art. 123 tax as well. The total above has exactly one income tax in it.
    expect(res.lines.filter((l) => l.label.startsWith('Impozit'))).toHaveLength(1);
  });

  it('the threshold base is the flat net, so the percentage and the figure agree about the same record', async () => {
    const res = await engine({ flatRatioGross: RECEIPTS });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // `data/dashboard.ts buildThresholdBases` is the only reader of the engine's bases in production. It
    // must land on the flat net, not on the register's receipts and not on the 1,7 × sum.
    const ytd: YtdTotals = {
      revenue: RECEIPTS,
      expenses: RECORDED_EXPENSES,
      net: sub(RECEIPTS, RECORDED_EXPENSES),
      revenueNet: RECEIPTS,
      expenseNet: RECORDED_EXPENSES,
    };
    expect(buildThresholdBases(ytd, res)['net-income']).toBe(FLAT_NET);
  });

  it('the same register without the flat gross is still an ordinary sistem-real year, to the ban', async () => {
    // The other half of the guard: the gate must not disturb a profile that was computing before. net =
    // 130.000 − 100.000 = 30.000 < 12 SM → CAS 0; CASS 10 % × 30.000 = 3.000; taxable 27.000 → tax 2.700.
    const res = await engine({});
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.bases.venitulNetDinActivitate).toBe(lei(30_000));
    expect(res.bases.venitulNetCumulatPentruContributii).toBeUndefined();
    expect(line(res, 'Impozit pe venit (rată de bază 10%)')!.value).toBe(lei(2_700));
    expect(line(res, 'Impozit art. 68^3')).toBeUndefined();
    expect(res.output.total).toBe(lei(5_700));
  });
});

describe('B-85 keeps the contributions cumulation, because two SOURCES still cumulate', () => {
  /**
   * art. 148 alin. (3) and art. 170 alin. (1) cumulate across art. 155 alin. (1) lit. b) sources, and
   * Legea 239/2025 art. XII pct. 19 names art. 68^3 expressly in art. 170 alin. (1). That rule is not what
   * B-85 broke, and the fix must not quietly delete it: what was wrong was feeding the cumulation two legs
   * for one source. So the helper is asserted directly, on two genuine sources, in both directions.
   */
  const sistemReal: ContributionLeg = { method: 'sistem-real', net: lei(30_000) };
  const flatRatio: ContributionLeg = { method: 'accommodation-flat-ratio', net: lei(70_000) };

  it('two lit. b) sources cumulate into one contribution base', () => {
    expect(cumulateContributionBase([sistemReal, flatRatio])).toBe(lei(100_000));
  });

  it('the sistem-real deduction is prorated over the cumulated base, not inherited whole', () => {
    // art. 118 alin. (2^2) and (2^3): 30.000 ÷ 100.000 = 0,3 of each contribution.
    const ratio = sistemRealContributionRatio([sistemReal, flatRatio]);
    expect(ratio.toString()).toBe('0.3');
  });

  it('one source leaves both ratios at exactly 1, so no profile that computed before moves', () => {
    expect(cumulateContributionBase([sistemReal])).toBe(lei(30_000));
    expect(sistemRealContributionRatio([sistemReal]).toString()).toBe('1');
  });

  it('a single sistem-real source keeps its sign, because art. 174 alin. (2) reads a loss, not a base', () => {
    // The floor at zero only applies from the second leg onward; with one leg the negative IS the art. 174
    // alin. (2) zero/loss case and must reach `calcCass` as one.
    const loss: ContributionLeg = { method: 'sistem-real', net: lei(-20_000) as Bani };
    expect(cumulateContributionBase([loss])).toBe(lei(-20_000));
    expect(sistemRealContributionRatio([loss]).toString()).toBe('1');
  });

  it('a flat-ratio register supplies one leg, not two', () => {
    // The sentence the whole task turns on. Two methods over one source are not two sources, so the leg
    // list the engine builds for a cazare register has exactly one entry and the cumulation is a no-op.
    const oneRegister: readonly ContributionLeg[] = [{ method: 'accommodation-flat-ratio', net: FLAT_NET }];
    expect(cumulateContributionBase(oneRegister)).toBe(FLAT_NET);
    expect(cumulateContributionBase(oneRegister)).not.toBe(DEFECT_CUMULATED);
  });
});

function sub(a: Bani, b: Bani): Bani {
  return (a - b) as Bani;
}
