/**
 * PG-5C — the acceptance fixture: a PFA authorised in October 2026.
 *
 * This file exists for one case, and it is the case the whole phase was broken out of the queue for.
 * A PFA authorised for October 2026 records 10.000,00 lei of net income for Oct–Dec 2026. The question
 * is what the app calls its „venit net anual" for FY2026, and what it bills on top of that answer.
 *
 *   before PG-5C, at 31.10.2026   30.000,00 lei — the October figure grossed up by the run rate
 *   before PG-5C, at 15.01.2027   10.000,00 lei — the closed year fell back to the actuals
 *   the law                                   10.000,00 lei — CF art. 118 alin. (3)
 *
 * The same register therefore produced two different annual incomes three months apart, and the higher
 * one was the one a taxpayer would have been asked to reserve against. `research/26` §9 is the
 * prescription this file implements; the fixture is quoted from the brief verbatim.
 *
 * Every figure below is derived by hand from the recorded amounts and the 2026 rule package. The
 * arithmetic lives in `domain/tax.ts` and `domain/fiscal/calculators.ts` and was not touched by this
 * phase — what changed is what gets fed to it.
 */
import { describe, expect, it } from 'vitest';
import { getTaxEstimate, getThresholdStatuses } from './dashboard';
import { selectEstimateOperands } from '../domain/estimateBasis';
import { seedData } from './seed';
import type { AppData, Revenue } from './types';
import { lei, ron, type Bani } from '../domain/money';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../domain/fiscal/package2026';

/** The fixture's start date: October 2026, not January. */
const OCTOBER_START = '2026-10-01';

/** Mid-year, inside the active period. This is where the old code diverged from the law. */
const MID_YEAR = '2026-10-31';
/** After the year closed, in the state PG-4 already handled correctly. */
const AFTER_YEAR = '2027-01-15';

function octoberRevenue(over: Partial<Revenue> = {}): Revenue {
  return {
    id: 'rev-oct-1',
    tip: 'factura',
    nr: 'FCT-OCT-1',
    date: '2026-10-03',
    client: 'Client Oct SRL',
    cui: 'RO00000000',
    // 10.000,00 lei net, no VAT collected — the fixture's single recorded amount.
    valoareFaraTva: ron(10_000),
    tva: ron(0),
    status: 'inregistrata',
    ...over,
  };
}

/**
 * The fixture: an October-2026 starter, one revenue of 10.000,00 lei net, no expenses. The profile is
 * the demo PFA's otherwise — `impozit_pe_venit`, not a pensioner, no salary, CASS obligatory — so no
 * art. 174 alin. (7) or art. 150 alin. (1) relief is in play and the plain rules are what get tested.
 */
function octoberRegister(): AppData {
  return {
    ...seedData,
    profile: { ...seedData.profile, pfaStartDate: OCTOBER_START, pfaStartYear: 2026, fiscalYear: 2026 },
    revenues: [octoberRevenue()],
    expenses: [],
  };
}

/** Read one calculation line by its label. The engine reports its own arithmetic; this reads it. */
function lineValue(est: { lines: { label: string; value: Bani }[] }, label: string): Bani {
  const line = est.lines.find((l) => l.label === label);
  if (!line) throw new Error(`no calculation line labelled ${label}`);
  return line.value;
}

describe('PG-5C acceptance fixture — an October-2026 PFA with 10.000,00 lei net', () => {
  it('the annual net income is 10.000,00 lei at a mid-year clock — not 30.000, not 120.000', async () => {
    const est = await getTaxEstimate(octoberRegister(), MID_YEAR);
    if (est.status !== 'computed') throw new Error('expected a computed estimate');

    expect(est.bases.venitulBrut).toBe(lei(10_000));
    expect(est.bases.cheltuieliDeductibile).toBe(lei(0));
    // CF art. 118 alin. (3): the sum realised in a fraction of the year IS the annual sum. Nothing in
    // Titlul IV or Titlul V cuts it, and nothing grosses it up.
    expect(est.bases.venitulNetDinActivitate).toBe(lei(10_000));
    expect(est.bases.venitulNetDinActivitate).not.toBe(lei(30_000));
    expect(est.bases.venitulNetDinActivitate).not.toBe(lei(120_000));

    // CAS — art. 148 alin. (1): due only when the annual net income reaches 12 SM (48.600,00 lei for
    // 2026). 10.000,00 is below it, and the 12-SM test is NOT cut to three months, so none is owed.
    // This is the line that disappears from the app's output, and it is the fix, not a regression.
    expect(lineValue(est, 'CAS (25%)')).toBe(lei(0));

    // CASS — art. 174 alin. (6): the base is below 6 SM (24.300,00 lei), so the difference up to that
    // base is owed. It is NOT prorated to three months either (art. 151 alin. (2)).
    //   CASS due = 10% × 24.300,00 = 2.430,00 lei
    //   deductible = 10% × 10.000,00 = 1.000,00 lei (art. 174 alin. (1)); the 1.430,00 lei difference
    //   is excluded from the base by art. 118 alin. (2) lit. b).
    expect(lineValue(est, 'CASS (10%)')).toBe(lei(2430));

    // Impozit — 10% × venitul net impozabil, with the deductible contribution removed per art. 118 alin. (2):
    //   bază = 10.000,00 − 1.000,00 = 9.000,00 lei → 10% = 900,00 lei (art. 66 leaves it whole)
    expect(lineValue(est, 'Impozit pe venit (rată de bază 10%)')).toBe(lei(900));

    //   total = 0 (CAS) + 2.430,00 (CASS) + 900,00 (impozit) = 3.330,00 lei
    expect(est.output.total).toBe(lei(3330));
  });

  it('the same register gives the same figures after the year closed', async () => {
    // PG-4 already got the closed year right; PG-5C makes mid-year agree with it instead of leaving a
    // cliff. One register, one answer, whatever the date.
    const mid = await getTaxEstimate(octoberRegister(), MID_YEAR);
    const after = await getTaxEstimate(octoberRegister(), AFTER_YEAR);
    if (mid.status !== 'computed' || after.status !== 'computed') throw new Error('expected both to compute');
    expect(after.output.total).toBe(mid.output.total);
    expect(after.bases.venitulNetDinActivitate).toBe(lei(10_000));
    // And the closed year says so, rather than presenting itself as a projection.
    if (after.basis.kind !== 'recorded-actuals') throw new Error('expected a recorded-actuals basis');
    expect(after.basis.closed).toBe(true);
    expect(after.basis.forecast).toBeUndefined();
  });

  it('the run rate still exists, is labelled a forecast, and is not what any figure was computed on', async () => {
    // The projection is demoted, not deleted (D-PROJ-1). At 31 Oct the active period is 2026-10-01 ..
    // 2026-12-31 = 3 months with exactly 1 elapsed, so the run rate is 10.000,00 lei/month and the
    // year-end forecast is 30.000,00 lei. That number is legitimate as a forecast — it is the exact
    // number PG-4 pinned in `projection.activePeriod.test.ts` — and illegitimate as a tax base.
    const est = await getTaxEstimate(octoberRegister(), MID_YEAR);
    if (est.status !== 'computed') throw new Error('expected a computed estimate');
    if (est.basis.kind !== 'recorded-actuals') throw new Error('expected a recorded-actuals basis');
    expect(est.basis.forecast?.method).toBe('run-rate-v1');
    expect(est.basis.forecast?.elapsedMonths).toBe(1);
    expect(est.basis.forecast?.activeMonths).toBe(3);
    expect(est.basis.forecast?.amounts.revenuesNet).toBe(lei(30_000));
    // …and the engine ran on 10.000,00, not on it.
    expect(est.bases.venitulNetDinActivitate).not.toBe(est.basis.forecast?.amounts.revenuesNet);

    // The assembler refuses to hand the projection to the engine at all: its operands carry the date
    // they were measured at, which a grossing-up does not have.
    const operands = selectEstimateOperands(octoberRegister(), MID_YEAR, PFA_2026_SYSTEM_REAL_PACKAGE);
    if (operands.kind !== 'run') throw new Error('expected the estimate to run');
    expect(operands.amounts.revenuesNet).toBe(lei(10_000));
    expect(operands.amounts.asOfDate).toBe(MID_YEAR);
  });

  it('the contribution thresholds are tested against 10.000,00 lei and none of them is crossed', async () => {
    const data = octoberRegister();
    const est = await getTaxEstimate(data, MID_YEAR);
    const rows = getThresholdStatuses(data, MID_YEAR, est);
    const contribution = rows.filter((t) => t.fiscalBase === 'net-income');
    expect(contribution.map((t) => t.thresholdId).sort()).toEqual([
      'CASS_MAX_BASE',
      'CASS_MIN_BASE',
      'CAS_MIN_BASE',
      'CAS_TIER2_FLOOR',
    ]);
    for (const row of contribution) {
      // Every row names the basis it was tested on, and the basis is realised money.
      expect(row.measuredBasis, row.thresholdId).toBe('annual-actual');
      expect(row.currentValue, row.thresholdId).toBe(lei(10_000));
    }
    // The 12 SM floor (48.600,00 lei) is not crossed, and it was not crossed on a three-month basis
    // either — the floor itself is not prorated.
    const casFloor = contribution.find((t) => t.thresholdId === 'CAS_MIN_BASE')!;
    expect(casFloor.thresholdValue).toBe(lei(48_600));
    expect(casFloor.currentValue! < casFloor.thresholdValue).toBe(true);
    expect(casFloor.status).not.toBe('breached');
    // Nothing in the section reads as a breach for this taxpayer.
    expect(contribution.filter((t) => t.status === 'breached')).toHaveLength(0);
  });

  it('the annualisation was manufacturing a CAS liability the law does not produce', async () => {
    // This is the finding to read loudly. The same October starter, one month further in, with a real
    // expense base: 40.000,00 lei of revenue and 15.000,00 lei of deductible rent.
    //
    //   recorded      venit brut 40.000,00 − deductibile 15.000,00 → VNA 25.000,00 lei
    //     CAS    25.000,00 < 12 SM (48.600,00 lei) → 0,00 lei. Art. 148 alin. (1) is not met.
    //     CASS   25.000,00 ≥ 6 SM (24.300,00 lei), so no art. 174 alin. (6) difference:
    //            10% × 25.000,00 = 2.500,00 lei, wholly deductible (art. 118 alin. (2) lit. b)).
    //     impozit 10% × (25.000,00 − 2.500,00) = 2.250,00 lei.
    //     total  4.750,00 lei.
    //
    //   before PG-5C, at 15.11.2026 the run rate doubled the three-month period: 80.000,00 / 30.000,00
    //     VNA 50.000,00 lei — now inside [12 SM, 24 SM), so CAS became 25% × 48.600,00 = 12.150,00 lei,
    //     CASS 5.000,00 lei, impozit 10% × (50.000,00 − 17.150,00) = 3.285,00 lei, total 20.435,00 lei.
    //
    // The 12.150,00 lei of CAS was not a rate the law applies to this taxpayer. It was the arithmetic
    // consequence of pretending three months of activity was six, and it crossed the 12 SM level that
    // decides whether CAS is owed at all. The line does not shrink here — it goes from owed to not owed.
    const data: AppData = {
      ...octoberRegister(),
      revenues: [octoberRevenue({ valoareFaraTva: ron(40_000) })],
      expenses: [
        {
          id: 'exp-oct-1',
          tip: 'factura',
          nr: 'CH-OCT-1',
          date: '2026-10-05',
          furnizor: 'Chirie Oct SRL',
          cui: 'RO00000000',
          valoareFaraTva: ron(15_000),
          tva: ron(0),
          status: 'inregistrata',
          category: 'rent_business_space',
        },
      ],
    };
    const est = await getTaxEstimate(data, '2026-11-15');
    if (est.status !== 'computed') throw new Error('expected a computed estimate');

    expect(est.bases.venitulNetDinActivitate).toBe(lei(25_000));
    expect(lineValue(est, 'CAS (25%)')).toBe(lei(0));
    expect(lineValue(est, 'CASS (10%)')).toBe(lei(2500));
    expect(lineValue(est, 'Impozit pe venit (rată de bază 10%)')).toBe(lei(2250));
    expect(est.output.total).toBe(lei(4750));
    // The figure the app used to show, and the CAS line that used to be in it.
    expect(est.output.total).not.toBe(lei(20_435));
    // The forecast still doubles the period — it is allowed to, and it is labelled — but nothing is
    // assessed on it.
    if (est.basis.kind !== 'recorded-actuals') throw new Error('expected a recorded-actuals basis');
    expect(est.basis.forecast?.amounts.revenuesNet).toBe(lei(80_000));

    // And the threshold row agrees: the 12 SM floor is not crossed, so no CAS is owed for the year.
    const rows = getThresholdStatuses(data, '2026-11-15', est);
    const casFloor = rows.find((t) => t.thresholdId === 'CAS_MIN_BASE')!;
    expect(casFloor.currentValue).toBe(lei(25_000));
    expect(casFloor.currentValue! < casFloor.thresholdValue).toBe(true);
  });

  it('the fixture is not secretly prorated anywhere: the SM multiples stay whole', async () => {
    // The refusals in the brief. art. 151 alin. (2) keeps the annual thresholds whole for a partial
    // year, so a three-month taxpayer is tested against the same 12 SM / 6 SM / 24 SM / 72 SM figures
    // as a twelve-month one. If any of these moved to a third, the proration came back.
    const data = octoberRegister();
    const est = await getTaxEstimate(data, MID_YEAR);
    const rows = getThresholdStatuses(data, MID_YEAR, est);
    const byId = new Map(rows.map((r) => [r.thresholdId, r]));
    const expected: Record<string, Bani> = {
      CAS_MIN_BASE: lei(48_600), // 12 SM
      CAS_TIER2_FLOOR: lei(97_200), // 24 SM
      CASS_MIN_BASE: lei(24_300), // 6 SM
      CASS_MAX_BASE: lei(291_600), // 72 SM
    };
    for (const [id, value] of Object.entries(expected)) {
      expect(byId.get(id)!.thresholdValue, id).toBe(value);
    }
  });
});
