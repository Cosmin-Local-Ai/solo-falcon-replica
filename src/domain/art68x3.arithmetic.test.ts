/**
 * PG-6h-1 — the art. 68^3 arithmetic, and the four ways it is easy to get wrong.
 *
 * The regime (D-CAZ-1, `docs/ai/USER_DECISIONS.md`) is the flat 30 % expense ratio for `prestarea de
 * servicii de cazare`, introduced by Legea nr. 239/2025 art. XII pct. 5 and applicable from the FY2026
 * income year. The whole of it, read in full against the 08.08.2026 consolidation in
 * `docs/ai/research/38_art68x3_cass_and_occupancy_order.md` §3, is:
 *
 *   venitul net = venitul brut − 30 % × venitul brut = 70 % × venitul brut      — alin. (2)
 *   impozitul   = 10 % × venitul net, „impozitul fiind final"                   — alin. (6)
 *
 * Every expected figure below was derived BY HAND from those two lines and from the FY2026 SM anchor
 * (4.050 lei on 1 ianuarie, CF art. 135^1 alin. (3) — NOT the 4.325 lei of HG 146/2026, which does not
 * re-anchor the annual bases). The arithmetic is written above each assertion.
 *
 * WHAT THIS FILE PINS, and why each one is a real failure mode rather than a tautology:
 *
 * 1. **The 30 % is an expense ratio, not a tax rate.** Net = 70 % of gross. Reading it as a rate on
 *    gross is a 10× error in the wrong direction, and it is the single most likely mistake in this rule.
 * 2. **The same net does two different jobs.** It feeds the CAS 12/24-SM *threshold test* (art. 148 alin.
 *    (3)) while the CAS *base* stays the chosen 12 or 24 SM (art. 148 alin. (2)); and it IS the CASS base
 *    (art. 170 alin. (1), amended by Legea 239/2025 pct. 19), floored at 6 SM by art. 174 alin. (6) and
 *    capped at 72 SM. One shared "68^3 base" variable handed to both calculators is the defect, so the
 *    two are asserted apart, not merely asserted present.
 * 3. **Contributions cumulate across SOURCES; the income tax is ring-fenced.** alin. (11) ring-fences the
 *    tax; art. 170 alin. (1) and art. 148 alin. (3) cumulate across art. 155 alin. (1) lit. b) sources.
 *    B-85 narrowed that sentence: a register is ONE source determined by ONE method, so the flat ratio
 *    beside a sistem-real difference over the same receipts is two methods over one source and does not
 *    cumulate. One test per direction, because getting either half wrong is silent.
 * 4. **The 6/12/24-SM ladder of art. 170 alin. (2)-(4) does not reach this income** — it is expressly
 *    limited to lit. c)-h), and 68^3 income is lit. b) via art. 67 alin. (1^1). So the floor is 6 SM.
 *
 * What this file deliberately does NOT pin: the gross itself. art. 68^3 alin. (3) leaves the platform-
 * commission scope open (B-80) and alin. (1) puts the eligibility gate in tourism law. Both stay
 * `review_required` and both are 6h-2's questions, so the gross is an INPUT here — never something this
 * build derives and never something it defaults.
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
import { eur, lei, money, type Bani } from './money';
import { selectAccommodationGross, selectIncomeDeterminationMethod } from './estimateBasis';
import { seedData } from '../data/seed';
import type { AppData, Revenue } from '../data/types';
import type { FxRateRecord } from './fx/rates';

// ── The FY2026 anchors, restated so every expectation below is checkable by hand ──────────────
// SM on 1 ianuarie 2026 = 4.050 lei (HG 1.506/2024), fixed for art. 148/151/170/174 by CF
// art. 135^1 alin. (3). 6 SM = 24.300 · 12 SM = 48.600 · 24 SM = 97.200 · 72 SM = 291.600.
const SM6 = lei(24_300);
const CAS_AT_12SM = lei(12_150);
const CAS_AT_24SM = lei(24_300);

function profile(over: Partial<PfaProfile> = {}): PfaProfile {
  return {
    id: 'p-68x3',
    regime: 'impozit_pe_venit',
    fiscalYear: 2026,
    socialInsuranceStatus: 'obligatoriu',
    ...over,
  } as PfaProfile;
}

/**
 * `salaryStatus: 'nu'` and no pension facts are not decoration. They are the state of a taxpayer whose
 * ONLY income is art. 68^3 — the case `research/38` §1 works through: none of the three art. 174 alin. (7)
 * exemptions can fire, because there is no salary at or above 6 SM, no art. 155 alin. (1) lit. c)-h)
 * income bearing CASS, and no pension sums received in the year.
 */
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
    otherIncome: [],
    socialInsuranceStatus: 'obligatoriu',
    vatExempt: false,
    cashFloorLei: lei(0),
    fiscalYear: 2026,
    pfaStartDate: null,
    inputsKey: 'p-68x3:2026',
    ...over,
  };
}

function line(res: { lines: { label: string; value: Bani }[] }, prefix: string) {
  return res.lines.find((l) => l.label.startsWith(prefix));
}

function run(over: {
  revenues?: Bani;
  expenses?: Bani;
  revenuesNet?: Bani;
  expensesNet?: Bani;
  flatRatioGross?: Bani | null;
  rules?: typeof PFA_2026_SYSTEM_REAL_PACKAGE;
}) {
  return computeTaxEstimate({
    inputs: inputs(),
    profile: profile(),
    revenues: over.revenues ?? lei(0),
    expenses: over.expenses ?? lei(0),
    revenuesNet: over.revenuesNet ?? lei(0),
    expensesNet: over.expensesNet ?? lei(0),
    flatRatioGross: over.flatRatioGross ?? null,
    ruleRelease: PFA_2026_RELEASE,
    rules: over.rules ?? PFA_2026_SYSTEM_REAL_PACKAGE,
  });
}

describe('art. 68^3 alin. (2) and (6) — the worked example', () => {
  /**
   * The example the phase doc states. A 68^3 taxpayer with 100.000 lei of receipts and nothing else:
   *   net   = 70 % × 100.000 = 70.000 lei
   *   tax   = 10 % × 70.000  =  7.000 lei            (effective 7 % of gross — alin. (6))
   *   CASS  = 10 % × 70.000  =  7.000 lei            (base = net, art. 170 alin. (1))
   *   CAS   = 25 % × 48.600  = 12.150 lei            (12 SM floor, art. 148 alin. (2) lit. a))
   *   total = 26.150 lei
   */
  it('net is 70 % of gross, tax is 10 % of that net, and the effective burden is 7 % of gross', async () => {
    const res = await run({ flatRatioGross: lei(100_000) });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;

    expect(line(res, 'Venit brut art. 68^3')!.value).toBe(lei(100_000));
    // The deemed expense, not a tax: 30 % of gross.
    expect(line(res, 'Cheltuieli forfetare 30 %')!.value).toBe(lei(30_000));
    expect(line(res, 'Venit net art. 68^3')!.value).toBe(lei(70_000));
    expect(line(res, 'Impozit art. 68^3')!.value).toBe(lei(7_000));

    // The 10× guard, stated as a negative: if the 30 % had been read as a rate on gross the tax would be
    // 30.000 lei, and if the 10 % had been read on gross it would be 10.000. Neither is 7.000.
    expect(line(res, 'Impozit art. 68^3')!.value).not.toBe(lei(30_000));
    expect(line(res, 'Impozit art. 68^3')!.value).not.toBe(lei(10_000));

    expect(res.output.total).toBe(lei(26_150));
  });

  it('the 68^3 tax is NOT reduced by CAS and CASS — „impozitul fiind final" (alin. (6))', async () => {
    const res = await run({ flatRatioGross: lei(100_000) });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // 10 % of the net, full stop. The art. 118 alin. (2) deductions run on the sistem-real source only.
    expect(line(res, 'Impozit art. 68^3')!.value).toBe(lei(7_000));
    // B-85 re-premised the second half of this test. It used to assert that the art. 123 line existed and
    // was zero. Under one method per profile-year the sistem-real leg is never constructed, so the line is
    // ABSENT — and absent matters, because a zero art. 123 line would still present this taxpayer as having
    // been measured under a determination method that is not theirs.
    expect(line(res, 'Impozit pe venit')).toBeUndefined();
    expect(line(res, 'Venit net anual impozabil')).toBeUndefined();
    expect(line(res, 'CAS deductibilă')).toBeUndefined();
    expect(line(res, 'CASS deductibilă')).toBeUndefined();
  });

  it('every figure is parameter-driven — no fiscal value is hard-coded in the calculator', async () => {
    // The house rule: a new number is a rule entry, not a literal. Mutating the two percentages moves both
    // figures, which is the only proof that the calculator reads them rather than containing them.
    const patched = PFA_2026_SYSTEM_REAL_PACKAGE.map((r) => {
      if (r.ruleId !== 'ACCOMMODATION_68X3_2026') return r;
      return {
        ...r,
        parameters: r.parameters.map((p) => {
          if (p.id === 'expense_ratio') return { ...p, value: 20 };
          if (p.id === 'tax_rate') return { ...p, value: 11 };
          return p;
        }),
      };
    });
    const res = await run({ flatRatioGross: lei(100_000), rules: patched });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net = 80 % × 100.000 = 80.000 · tax = 11 % × 80.000 = 8.800
    expect(line(res, 'Venit net art. 68^3')!.value).toBe(lei(80_000));
    expect(line(res, 'Impozit art. 68^3')!.value).toBe(lei(8_800));
  });

  it('the rule carries a citation for every value it supplies, and names the two it refuses to supply', () => {
    const rule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'ACCOMMODATION_68X3_2026');
    expect(rule).toBeDefined();
    expect(rule!.sourceAct).toContain('Legea nr. 239/2025');
    expect(rule!.sourceArticle).toContain('art. 68^3 alin. (2)');
    expect(rule!.sourceArticle).toContain('art. 68^3 alin. (6)');
    // Deadlines: alin. (9)-(10) with art. 122 alin. (3), and explicitly NOT art. 121.
    expect(rule!.sourceArticle).toContain('art. 122 alin. (3)');
    expect(rule!.sourceArticle).not.toContain('art. 121 ');
    const deadline = rule!.parameters.find((p) => p.id === 'filing_deadline');
    expect(deadline?.value).toBe('2027-05-25');
    expect(deadline?.unit).toBe('date');
    expect(rule!.parameters.find((p) => p.id === 'payment_deadline')?.value).toBe('2027-05-25');
    // The two open questions travel as data, so the refusal can quote them instead of paraphrasing them.
    expect(rule!.parameters.some((p) => p.id === 'gross_scope_open_question')).toBe(true);
    expect(rule!.parameters.some((p) => p.id === 'eligibility_open_question')).toBe(true);
    // …and no SM multiple lives here: the 6/12/24/72-SM figures are year-scoped on CAS_2026 / CASS_2026.
    expect(rule!.parameters.some((p) => p.unit === 'lei')).toBe(false);
  });
});

describe('CAS — the 68^3 net raises the threshold test without becoming the base', () => {
  it('in the 12/24-SM band the CAS base stays the 12 SM floor, not the 68^3 net', async () => {
    // net = 70.000 lei: above 12 SM (48.600), below 24 SM (97.200).
    // base = 48.600 (venitul ales, art. 148 alin. (2) lit. a)) → CAS = 12.150.
    // If the net had been used as the base: 25 % × 70.000 = 17.500 — the wrong number this test exists to
    // catch.
    const res = await run({ flatRatioGross: lei(100_000) });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(line(res, 'CAS (25%)')!.value).toBe(CAS_AT_12SM);
    expect(line(res, 'CAS (25%)')!.value).not.toBe(lei(17_500));
  });

  it('the net can lift the taxpayer into the 24 SM tier, and the base is still the tier floor', async () => {
    // gross 140.000 → net 98.000 ≥ 24 SM (97.200) → tier b) → base 97.200 → CAS = 24.300.
    // Net-as-base would give 25 % × 98.000 = 24.500 lei, two hundred lei too much.
    const res = await run({ flatRatioGross: lei(140_000) });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(line(res, 'CAS (25%)')!.value).toBe(CAS_AT_24SM);
    expect(line(res, 'CAS (25%)')!.value).not.toBe(lei(24_500));
  });

  it('below 12 SM the obligation never arises — the net is tested, not charged (art. 148 alin. (1))', async () => {
    // gross 20.000 → net 14.000 < 48.600 → CAS = 0, not 12.150 and not 25 % × 14.000.
    const res = await run({ flatRatioGross: lei(20_000) });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(line(res, 'CAS (25%)')!.value).toBe(lei(0));
  });

  it('the same amount is what the CAS row is measured on, so the threshold cannot disagree with the engine', async () => {
    const res = await run({ flatRatioGross: lei(100_000) });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // B-85 moved this pair. It used to read `venitulNetDinActivitate = 0` (a sistem-real net computed from
    // nothing) beside `venitulNetCumulatPentruContributii = 70.000`. The first of those was the defect
    // wearing a zero: the register has one source, and the amount the contribution was tested on is the
    // 68^3 net. `data/dashboard.ts buildThresholdBases` reads `cumulat ?? net`, so the row now lands on the
    // same 70.000 the engine used — with one source there is no second number to disagree with it.
    expect(res.bases.venitulNetDinActivitate).toBe(lei(70_000));
    expect(res.bases.venitulNetCumulatPentruContributii).toBeUndefined();
  });
});

describe('CASS — the 68^3 net IS the base, floored at 6 SM', () => {
  it('a sole art. 68^3 taxpayer below 6 SM owes the 6 SM figure (art. 174 alin. (6))', async () => {
    // gross 20.000 → net 14.000 < 6 SM (24.300).
    // research/38 §1: none of the three art. 174 alin. (7) exemptions can fire for a taxpayer whose only
    // income is 68^3 — no salary ≥ 6 SM, no lit. c)-h) income, no pension sums — so the top-up IS owed.
    // CASS = 10 % × 24.300 = 2.430 lei, of which 10 % × 14.000 = 1.400 is the art. 174 alin. (1)
    // contribution and 1.030 is the alin. (6) difference (owed, never deductible — art. 118 alin. (2) lit. b)).
    const res = await run({ flatRatioGross: lei(20_000) });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(line(res, 'CASS (10%)')!.value).toBe(lei(2_430));
    // Not 10 % of the net: the floor is measured on the base, and the base includes this income.
    expect(line(res, 'CASS (10%)')!.value).not.toBe(lei(1_400));
    expect(res.bases.venitulNetDinActivitate).toBe(lei(14_000));
    expect(res.bases.venitulNetCumulatPentruContributii).toBeUndefined();
    expect(res.output.total).toBe(lei(3_830)); // CAS 0 + CASS 2.430 + 68^3 tax 1.400
  });

  it('the floor is the 6 SM of art. 174 alin. (6), not the 6/12/24 ladder of art. 170 alin. (2)-(4)', async () => {
    // The ladder reaches only art. 155 alin. (1) lit. c)-h); 68^3 income is lit. b) via art. 67 alin. (1^1).
    // So a net just under 6 SM tops up to 6 SM — it does not jump to 12 SM.
    const res = await run({ flatRatioGross: lei(34_000) }); // net 23.800 < 24.300
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(line(res, 'CASS (10%)')!.value).toBe(lei(2_430)); // 10 % × 6 SM, not 10 % × 12 SM
  });

  it('above 6 SM the base is the net itself, and the 72 SM cap still applies (art. 170 alin. (1))', async () => {
    const mid = await run({ flatRatioGross: lei(100_000) }); // net 70.000
    if (mid.status === 'computed') expect(line(mid, 'CASS (10%)')!.value).toBe(lei(7_000));
    // gross 500.000 → net 350.000 > 72 SM (291.600) → base capped → CASS = 29.160.
    const capped = await run({ flatRatioGross: lei(500_000) });
    expect(capped.status).toBe('computed');
    if (capped.status !== 'computed') return;
    expect(line(capped, 'CASS (10%)')!.value).toBe(lei(29_160));
    expect(line(capped, 'CASS (10%)')!.value).not.toBe(lei(35_000));
  });
});

describe('alin. (11) — contributions cumulate across sources, the income tax is ring-fenced', () => {
  /**
   * B-85 RE-PREMISES this whole block, and the old premise was the defect.
   *
   * These three tests used to feed the engine `revenues 130.000 / expenses 100.000` AND `flatRatioGross
   * 100.000` and read the result as two lit. b) sources cumulating to 100.000 lei. They are not two
   * sources. The assembler measures the flat gross on the SAME register it takes the sistem-real operands
   * from, so that fixture was one register seen twice: a sistem-real leg of 130.000 − 100.000, and a flat
   * leg of 70 % of the same receipts. The cumulated figure the tests praised was 1,7 × the register's
   * money, and the total charged an art. 123 tax and an art. 68^3 alin. (6) tax on top of each other.
   *
   * What stays true is the rule those tests were reaching for: art. 148 alin. (3) and art. 170 alin. (1)
   * cumulate across art. 155 alin. (1) lit. b) SOURCES, and Legea 239/2025 art. XII pct. 19 names art. 68^3
   * in art. 170 alin. (1) expressly. That rule is asserted below on two genuine sources, and the engine's
   * own composition is asserted not to build a second source out of one register.
   */
  it('one register is one source: the flat ratio beside a sistem-real difference does not cumulate', async () => {
    const res = await run({
      revenuesNet: lei(130_000),
      expensesNet: lei(100_000),
      revenues: lei(130_000),
      expenses: lei(100_000),
      flatRatioGross: lei(100_000),
    });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // The CASS base is the 68^3 net alone: 10 % × 70.000 = 7.000.
    expect(line(res, 'CASS (10%)')!.value).toBe(lei(7_000));
    // The figure the old version of this test asserted, and the figure it asserted was the mistake for
    // omitting. 10.000 is the 1,7 × cumulation; 3.000 is the sistem-real net alone.
    expect(line(res, 'CASS (10%)')!.value).not.toBe(lei(10_000));
    expect(line(res, 'CASS (10%)')!.value).not.toBe(lei(3_000));
    expect(res.bases.venitulNetDinActivitate).toBe(lei(70_000));
    expect(res.bases.venitulNetCumulatPentruContributii).toBeUndefined();
  });

  it('the income tax is ring-fenced, and there is no second income tax beside it', async () => {
    const res = await run({
      revenuesNet: lei(130_000),
      expensesNet: lei(100_000),
      revenues: lei(130_000),
      expenses: lei(100_000),
      flatRatioGross: lei(100_000),
    });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(line(res, 'Impozit art. 68^3')!.value).toBe(lei(7_000));
    // The art. 123 sum this test used to pin at 1.971 lei no longer exists for this register: the sistem-
    // real leg is not run, so the 68^3 tax is the only income tax in the result.
    expect(line(res, 'Impozit pe venit (rată de bază 10%)')).toBeUndefined();
    // CAS 12.150 (91.000-band tier: 70.000 ≥ 12 SM, < 24 SM) + CASS 7.000 + 68^3 tax 7.000.
    expect(res.output.total).toBe(lei(26_150));
    expect(res.lines.filter((l) => l.label.startsWith('Impozit'))).toHaveLength(1);
  });

  /**
   * The cumulation and the proration, asserted on two GENUINE sources rather than on one register twice.
   *
   * The engine builds one leg per source and the method gate keeps a single register at one leg, so the
   * multi-source path is exercised on the composition helpers the engine itself calls. The arithmetic below
   * is the arithmetic the old fixture claimed: sistem real 30.000 + 68^3 70.000 = 100.000 cumulated, and
   * 30.000 ÷ 100.000 = 0,3 of each contribution deductible against the sistem-real base.
   */
  it('two genuine lit. b) sources still cumulate, and the sistem-real deduction is prorated (art. 118 alin. (2^2)-(2^3))', () => {
    const legs: ContributionLeg[] = [
      { method: 'sistem-real', net: lei(30_000) },
      { method: 'accommodation-flat-ratio', net: lei(70_000) },
    ];
    expect(cumulateContributionBase(legs)).toBe(lei(100_000));
    expect(sistemRealContributionRatio(legs).toString()).toBe('0.3');
    // 0,3 × 24.300 CAS = 7.290 and 0,3 × 10.000 CASS = 3.000 — the two figures the pre-B-85 engine printed
    // for a two-source year, now reachable only from two actual sources.
    expect(sistemRealContributionRatio(legs).times(24_300).toString()).toBe('7290');
    expect(sistemRealContributionRatio(legs).times(10_000).toString()).toBe('3000');
  });

  it('with no 68^3 source the sistem-real figures do not move by a single ban', async () => {
    // The regression guard for the whole composition change: `cumulatedNet` must equal `net` when there
    // is one source, so every pre-PG-6h payload computes exactly as before.
    const solo = await run({ revenuesNet: lei(130_000), expensesNet: lei(100_000), revenues: lei(130_000), expenses: lei(100_000) });
    expect(solo.status).toBe('computed');
    if (solo.status !== 'computed') return;
    expect(solo.bases.venitulNetCumulatPentruContributii).toBeUndefined();
    expect(line(solo, 'Impozit art. 68^3')).toBeUndefined();
    // net 30.000 < 12 SM → CAS 0; CASS 3.000; taxable 27.000 → tax 2.700; total 5.700.
    expect(solo.output.total).toBe(lei(5_700));
  });
});

describe('alin. (4) — foreign receipts convert at the BNR rate of the day of each collection', () => {
  const EUR_2026_03_02: FxRateRecord = {
    currency: 'EUR', rate: '4.9000', rateKind: 'daily_reference', rateDate: '2026-03-02',
    seriesCode: 'CURSZ_EUR', sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
    fetchedAt: '2026-03-02T13:05:00Z', provisional: false, entryMode: 'fetched',
  };
  const EUR_2026_03_10: FxRateRecord = {
    currency: 'EUR', rate: '5.0000', rateKind: 'daily_reference', rateDate: '2026-03-10',
    seriesCode: 'CURSZ_EUR', sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
    fetchedAt: '2026-03-10T13:05:00Z', provisional: false, entryMode: 'fetched',
  };

  function receipt(over: Partial<Revenue>): Revenue {
    return {
      id: 'rev-x', tip: 'factura', nr: 'FCT-68X3-1', date: '2026-03-02', client: 'Oaspete', cui: 'RO0',
      valoareFaraTva: eur(1000), tva: eur(0), status: 'inregistrata', ...over,
    } as Revenue;
  }

  it('two receipts on two different days convert at two different rates, and the gross is their sum', () => {
    // 1.000,00 EUR on 2026-03-02 × 4,9000 =  4.900,00 lei
    // 2.000,00 EUR on 2026-03-10 × 5,0000 = 10.000,00 lei
    // gross = 14.900,00 lei — NOT 3.000 EUR at any single rate, and not at an annual average.
    const data: AppData = {
      ...seedData,
      profile: { ...seedData.profile, activityFamily: 'cazare' },
      revenues: [
        receipt({ id: 'rev-1', date: '2026-03-02', collected: '2026-03-02', valoareFaraTva: eur(1000) }),
        receipt({ id: 'rev-2', date: '2026-03-10', collected: '2026-03-10', valoareFaraTva: eur(2000) }),
      ],
      expenses: [],
      fxRates: [EUR_2026_03_02, EUR_2026_03_10],
    };
    const outcome = selectAccommodationGross(data, '2026-12-31');
    expect(outcome.gross).toBe(lei(14_900));
    expect(outcome.unconverted).toHaveLength(0);
    expect(outcome.conversions).toHaveLength(2);
    const byDate = new Map(outcome.conversions.map((c) => [c.onDate, c.rate]));
    expect(byDate.get('2026-03-02')).toBe('4.9000');
    expect(byDate.get('2026-03-10')).toBe('5.0000');
    // The basis is the per-collection daily rate, which is what alin. (4) asks for and what the Phase 10c
    // ledger pass already implements — reused, not reimplemented.
    for (const c of outcome.conversions) expect(c.basis).toBe('payment_date_daily');
  });

  it('a collection on a non-banking day uses the last published rate before it, and says so', () => {
    // alin. (4) is „cursul de schimb publicat de Banca Naţională a României în ultima zi bancară
    // anterioară datei încasării”. 2026-03-07 is a Saturday; the last published BNR row before it is
    // Friday 2026-03-06. The substitution is visible on the conversion as `carriedFrom` — the app does not
    // quietly pretend a Saturday had a rate.
    const EUR_2026_03_06: FxRateRecord = {
      currency: 'EUR', rate: '4.9500', rateKind: 'daily_reference', rateDate: '2026-03-06',
      seriesCode: 'CURSZ_EUR', sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
      fetchedAt: '2026-03-06T13:05:00Z', provisional: false, entryMode: 'fetched',
    };
    const data: AppData = {
      ...seedData,
      profile: { ...seedData.profile, activityFamily: 'cazare' },
      revenues: [
        receipt({ id: 'rev-1', date: '2026-03-07', collected: '2026-03-07', valoareFaraTva: eur(1000) }),
      ],
      expenses: [],
      fxRates: [EUR_2026_03_06],
    };
    const outcome = selectAccommodationGross(data, '2026-12-31');
    // 1.000,00 EUR × 4,9500 = 4.950,00 lei, taken from the Friday row.
    expect(outcome.gross).toBe(lei(4_950));
    expect(outcome.conversions[0]?.carriedFrom).toBe('2026-03-06');
  });

  it('the gross selector converts before it totals, so a foreign receipt never reaches a lei sum raw', () => {
    const data: AppData = {
      ...seedData,
      profile: { ...seedData.profile, activityFamily: 'cazare' },
      revenues: [receipt({ id: 'rev-1', date: '2026-03-02', collected: '2026-03-02', valoareFaraTva: eur(1000) })],
      expenses: [],
      fxRates: [EUR_2026_03_02],
    };
    const standalone = selectAccommodationGross(data, '2026-12-31');
    // 1.000,00 EUR × 4,9000 = 4.900,00 lei. The VAT rule is the sistem-real one, for the same reason:
    // OMFP 3254/2017 art. 4 alin. (3) — TVA colectată nu reprezintă venit.
    expect(standalone.gross).toBe(lei(4_900));
    expect(standalone.conversions).toHaveLength(1);
    expect(standalone.conversions[0]?.recordKind).toBe('revenue');
  });
});

describe('the gross is an input, never a default (B-80)', () => {
  it('no commission reading is applied to the receipts the gross is built from', () => {
    // A platform-style register: the gross selector returns the receipts as recorded. Whether alin. (3)
    // excludes a retained commission is the open question, so the selector neither excludes it nor keeps
    // it — it reports the receipts and the caller refuses.
    const data: AppData = {
      ...seedData,
      profile: { ...seedData.profile, activityFamily: 'cazare' },
      revenues: [
        { id: 'rev-1', tip: 'factura', nr: 'F1', date: '2026-06-10', client: 'Oaspete', cui: 'RO0',
          valoareFaraTva: money(lei(10_000), 'RON'), tva: money(lei(0), 'RON'), status: 'inregistrata' } as Revenue,
      ],
      expenses: [],
    };
    expect(selectAccommodationGross(data, '2026-12-31').gross).toBe(lei(10_000));
  });

  it('the rule set carries the commission question as an open question, not as a value', () => {
    const rule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'ACCOMMODATION_68X3_2026')!;
    const open = rule.parameters.find((p) => p.id === 'gross_scope_open_question');
    expect(typeof open?.value).toBe('string');
    // Both readings are named in the rule's own words, and neither is chosen.
    const text = String(open!.value);
    expect(text).toContain('Citește A');
    expect(text).toContain('Citește B');
    // And there is no parameter that could act as a silent commission switch.
    expect(rule.parameters.some((p) => p.id.startsWith('commission_'))).toBe(false);
    expect(rule.parameters.some((p) => typeof p.value === 'boolean')).toBe(false);
  });

  it('a fiscal year with no art. 68^3 rule refuses a 68^3 gross instead of computing it under another year', async () => {
    const withoutFlatRatio = PFA_2026_SYSTEM_REAL_PACKAGE.filter(
      (r) => r.taxRegime !== 'accommodation-flat-ratio',
    );
    const res = await run({ flatRatioGross: lei(100_000), rules: withoutFlatRatio });
    expect(res.status).toBe('review_required');
    if (res.status !== 'review_required') return;
    expect(res.reason).toContain('art. 68^3');
    // No figure at all — not a zero, and not a 2026 number presented as this year's.
    expect(res.lines.find((l) => l.label.startsWith('Impozit art. 68^3'))).toBeUndefined();
  });

  it('the determination method is selected from a declared family plus the rule set, and from nothing else', () => {
    const cazare: AppData = { ...seedData, profile: { ...seedData.profile, activityFamily: 'cazare' } };
    expect(selectIncomeDeterminationMethod(cazare, PFA_2026_SYSTEM_REAL_PACKAGE, '2026-12-31')).toBe(
      'accommodation-flat-ratio',
    );
    // No rule set for the year ⇒ no method manufactured.
    expect(selectIncomeDeterminationMethod(cazare, [], '2027-12-31')).toBe('sistem-real');
    // A declared `other` is not an accommodation register, whatever its CAEN list says.
    const other: AppData = {
      ...seedData,
      profile: {
        ...seedData.profile,
        activityFamily: 'other',
        identity: { ...seedData.profile.identity, caen: [{ cod: '5510', descriere: 'Hoteluri' }] },
      },
    };
    expect(selectIncomeDeterminationMethod(other, PFA_2026_SYSTEM_REAL_PACKAGE, '2026-12-31')).toBe('sistem-real');
    // Unanswered is not `other` and is not `cazare`: no method is selected, and nothing is inferred.
    const unanswered = { ...seedData, profile: { ...seedData.profile } } as AppData;
    delete (unanswered.profile as { activityFamily?: string }).activityFamily;
    expect(selectIncomeDeterminationMethod(unanswered, PFA_2026_SYSTEM_REAL_PACKAGE, '2026-12-31')).toBe(
      'sistem-real',
    );
  });
});

describe('the rounding boundary', () => {
  it('an inexact net base is reported, never repaired (art. 66 alin. (1) rounds sums due, not bases)', async () => {
    // 1 ban of gross: 70 % × 1 ban = 0,7 bani, which is not a whole number of bani. The calculator
    // refuses rather than inventing a rounding rule for a base — the same discipline `exactBani` applies
    // to a prorated deduction in tax.ts.
    const res = await run({ flatRatioGross: 1 as Bani });
    expect(res.status).toBe('review_required');
    if (res.status !== 'review_required') return;
    expect(res.reason).toContain('art. 66 alin. (1)');
  });

  it('a gross with no receipts is a zero, not a refusal', async () => {
    const res = await run({ flatRatioGross: lei(0) });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(line(res, 'Venit net art. 68^3')!.value).toBe(lei(0));
    expect(line(res, 'Impozit art. 68^3')!.value).toBe(lei(0));
    // And a zero net is the art. 174 alin. (2) case: no CASS at all, floor not self-executing.
    expect(line(res, 'CASS (10%)')!.value).toBe(lei(0));
    expect(res.output.total).toBe(lei(0));
  });

  it('the 6 SM floor figure the engine used is the one the rule store carries', async () => {
    const res = await run({ flatRatioGross: lei(20_000) });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(line(res, 'CASS (10%)')!.value).toBe(lei(2_430)); // 10 % × SM6, derived, never declared
    expect(SM6).toBe(lei(24_300));
  });
});
