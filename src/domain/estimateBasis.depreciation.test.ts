/**
 * B-93 — the computed depreciation schedule reaches the estimate, and the hand-recorded expense is never
 * added on top of it.
 *
 * Before this phase the app computed the right number, showed it on `pages/Assets.tsx` and printed it in
 * `data/fixedAssetDocuments.ts`, and then deducted a different number — the one the taxpayer had typed into
 * a `depreciation_business_asset` expense. Three routes reached the expense side of a capital asset and only
 * one of them was arithmetic:
 *
 * - `depreciation_business_asset` — art. 68 alin. (4), a typed amount;
 * - `depreciable_asset_purchase` — art. 68 alin. (7) lit. h), which keeps the purchase OUT;
 * - `depreciationSchedule` — the schedule, reaching nothing that filed.
 *
 * The hazard that decides the design is the double count. These tests are the proof that it cannot happen:
 * the schedule posts when it stands alone, and where a typed depreciation expense also stands, the schedule
 * is withheld, named, and **the estimate does not move**.
 *
 * Every figure below is asserted in exact bani, because "roughly the schedule" is the claim that was already
 * true of the screen and still wrong in the return.
 */
import { describe, expect, it } from 'vitest';
import { lei, ron, sumBani } from '../domain/money';
import { seedData } from '../data/seed';
import { getTaxEstimate } from '../data/dashboard';
import type { Expense, FixedAsset, Vehicle } from '../data/types';
import {
  depreciationForFiscalYear,
  FISCAL_DEPRECIATION_RULE_ID,
} from '../domain/fiscal/depreciation';
import {
  depreciationCoverageGaps,
  selectAssetDepreciation,
  selectEstimateOperands,
} from '../domain/estimateBasis';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../domain/fiscal/package2026';

const RULES = PFA_2026_SYSTEM_REAL_PACKAGE;
const AS_OF = '2026-12-31';
const depreciationRule = RULES.find((r) => r.ruleId === FISCAL_DEPRECIATION_RULE_ID)!;

/**
 * A degresiv asset put in function in February 2026: 120.000 lei, 60 months, coefficient 1,5 for a
 * 2–5-year duration (art. 28 alin. (7)).
 *
 * The arithmetic, so the expected figure below is not a magic number:
 * cota liniară 1/5 = 20 %; degresivă 20 % × 1,5 = 30 % anual = 3.600.000 bani; art. 28 alin. (12) lit. a)
 * starts with the month after *punerea în funcțiune*, so 2026 carries 10 months (March–December);
 * 3.600.000 × 10/12 = **3.000.000 bani = 30.000 lei**.
 */
const LAPTOP: FixedAsset = {
  id: 'asset-laptop',
  label: 'Laptop de lucru',
  entryDate: '2026-02-10',
  putInFunctionDate: '2026-02-15',
  fiscalValue: lei(120000),
  normalLifeMonths: 60,
  method: 'degresiv',
  acquisition: 'cumparare',
  paymentState: 'achitat',
  paidOn: '2026-02-11',
};

/**
 * An M1 passenger vehicle, liniară: 120.000 lei over 60 months is 24.000 lei/an = 2.000 lei/lună, which is
 * **over** the art. 28 alin. (14) ceiling of 1.500 lei/lună. Ten months in 2026 therefore post
 * 1.500 × 10 = 15.000 lei = 1.500.000 bani, not 20.000 lei = 2.000.000 bani, and the 5.000 lei difference is
 * lost definitively (`research/36` §12.13).
 */
const M1_CAR: FixedAsset = {
  id: 'asset-m1',
  label: 'Autoturism M1',
  entryDate: '2026-02-10',
  putInFunctionDate: '2026-02-15',
  fiscalValue: lei(120000),
  normalLifeMonths: 60,
  method: 'liniar',
  acquisition: 'cumparare',
  paymentState: 'achitat',
  paidOn: '2026-02-11',
  isM1Vehicle: true,
};

/** An asset with no declared duration and no declared method — the schedule must refuse, not assume. */
const INCOMPLETE_ASSET: FixedAsset = {
  id: 'asset-bare',
  label: 'Bun fără durată',
  entryDate: '2026-02-10',
  putInFunctionDate: '2026-02-15',
  fiscalValue: lei(120000),
  acquisition: 'cumparare',
  paymentState: 'achitat',
  paidOn: '2026-02-11',
};

/** The hand-recorded half: an amount the taxpayer typed, art. 68 alin. (4) lit. d). */
const TYPED_DEPRECIATION: Expense = {
  id: 'exp-amortizare-tipita',
  tip: 'factura',
  nr: 'Înreg-2026-0001',
  date: '2026-12-10',
  paid: '2026-12-10',
  furnizor: 'Registrul de amortizare',
  cui: 'RO00000000',
  valoareFaraTva: ron(70000),
  tva: ron(0),
  status: 'inregistrata',
  category: 'depreciation_business_asset',
};

/**
 * The seed's own expenses are KEPT. Replacing them would move the estimate for a reason unrelated to this
 * phase, and the first version of this file did exactly that — which is how a fixture bug came to look like
 * a defect.
 */
const withAssets = (assets: FixedAsset[], expenses: Expense[] = []) => ({
  ...seedData,
  fixedAssets: assets,
  expenses: [...seedData.expenses, ...expenses],
});

describe('acceptance 1 — a computed schedule reaches the estimate, in exact bani', () => {
  it('the register produces one line for the laptop, at 3.000.000 bani', () => {
    const leg = selectAssetDepreciation(withAssets([LAPTOP]), AS_OF, RULES);
    expect(leg.conflicts).toEqual([]);
    expect(leg.refused).toEqual([]);
    expect(leg.lines).toHaveLength(1);
    expect(leg.lines[0]!.assetId).toBe('asset-laptop');
    expect(leg.lines[0]!.months).toBe(10);
    expect(leg.lines[0]!.deductible).toBe(lei(30000));
    expect(leg.total).toBe(lei(30000));
  });

  it('the expense leg the engine is fed rises by exactly that figure, and nothing else moves', () => {
    const bare = selectEstimateOperands(seedData, AS_OF, RULES);
    const posted = selectEstimateOperands(withAssets([LAPTOP]), AS_OF, RULES);
    expect(bare.kind).toBe('run');
    expect(posted.kind).toBe('run');
    if (bare.kind !== 'run' || posted.kind !== 'run') throw new Error('both must run');

    expect(posted.amounts.expenses - bare.amounts.expenses).toBe(lei(30000));
    expect(posted.amounts.expensesNet - bare.amounts.expensesNet).toBe(lei(30000));
    // The gross is untouched: a schedule is a cost, not a receipt.
    expect(posted.amounts.revenues).toBe(bare.amounts.revenues);
    // A depreciation deduction carries no input VAT, so the two candidate bases rise by the same amount and
    // the D-VAT-2 divergence answer about the *vehicle* lines is unchanged by this leg.
    expect(posted.expenseBase.netFirst - bare.expenseBase.netFirst).toBe(lei(30000));
    expect(posted.expenseBase.divergent).toBe(bare.expenseBase.divergent);
  });

  it('the leg is produced once and travels on the estimate, so no surface re-walks the register', () => {
    const posted = selectEstimateOperands(withAssets([LAPTOP]), AS_OF, RULES);
    if (posted.kind !== 'run') throw new Error('expected a run');
    expect(posted.depreciation.total).toBe(lei(30000));
    expect(posted.depreciation.lines.map(l => l.assetId)).toEqual(['asset-laptop']);
  });

  it('the capital purchase itself is still not deducted — only its amortisation is', () => {
    const posted = selectEstimateOperands(withAssets([LAPTOP]), AS_OF, RULES);
    const bare = selectEstimateOperands(seedData, AS_OF, RULES);
    if (posted.kind !== 'run' || bare.kind !== 'run') throw new Error('both must run');
    // 120.000 lei of asset, 30.000 lei of deduction. If the purchase leaked in, the delta would be 150.000.
    expect(posted.amounts.expensesNet - bare.amounts.expensesNet).toBe(lei(30000));
  });
});

describe('acceptance 4 — the art. 28 alin. (14) ceiling travels with the schedule', () => {
  it('an M1 schedule posts the capped figure, not the computed one', () => {
    const leg = selectAssetDepreciation(withAssets([M1_CAR]), AS_OF, RULES);
    expect(leg.lines).toHaveLength(1);
    expect(leg.lines[0]!.uncapped).toBe(lei(20000));
    expect(leg.lines[0]!.deductible).toBe(lei(15000));
    expect(leg.lines[0]!.lost).toBe(lei(5000));
    expect(leg.total).toBe(lei(15000));
  });

  it('the estimate moves by the CAPPED amount, so a ceiling cannot be dropped on the way to the engine', () => {
    const bare = selectEstimateOperands(seedData, AS_OF, RULES);
    const posted = selectEstimateOperands(withAssets([M1_CAR]), AS_OF, RULES);
    if (bare.kind !== 'run' || posted.kind !== 'run') throw new Error('both must run');
    expect(posted.amounts.expensesNet - bare.amounts.expensesNet).toBe(lei(15000));
  });

  it('the ceiling is per vehicle („pentru fiecare"), so two M1 cars each get their own 1.500 lei/lună', () => {
    const second: FixedAsset = { ...M1_CAR, id: 'asset-m1-b', label: 'Al doilea autoturism M1' };
    const leg = selectAssetDepreciation(withAssets([M1_CAR, second]), AS_OF, RULES);
    expect(leg.lines).toHaveLength(2);
    expect(leg.total).toBe(lei(30000));
  });

  it('a claimed alin. (14) exception lifts the ceiling, and that is the taxpayer\'s claim, not an inference', () => {
    const exempt: FixedAsset = { ...M1_CAR, m1ExceptionCategory: 'transport_persoane_cu_plata_inclusiv_taxi' };
    const leg = selectAssetDepreciation(withAssets([exempt]), AS_OF, RULES);
    expect(leg.lines[0]!.deductible).toBe(lei(20000));
    expect(leg.lines[0]!.lost).toBe(lei(0));
  });
});

describe('acceptance 2 — the double-count refusal fires, and the estimate does not move when it does', () => {
  const both = withAssets([LAPTOP], [TYPED_DEPRECIATION]);

  it('a typed depreciation expense and a computed schedule for the same register cannot both post', () => {
    const leg = selectAssetDepreciation(both, AS_OF, RULES);
    expect(leg.lines).toEqual([]);
    expect(leg.total).toBe(lei(0));
    expect(leg.conflicts).toHaveLength(1);
    expect(leg.conflicts[0]!.assetId).toBe('asset-laptop');
    expect(leg.conflicts[0]!.label).toBe('Laptop de lucru');
    expect(leg.conflicts[0]!.expenseIds).toEqual(['exp-amortizare-tipita']);
    // What it WOULD have added, reported rather than added.
    expect(leg.conflicts[0]!.withheld).toBe(lei(30000));
  });

  it('the estimate is byte-for-byte the figure it was with the typed expense alone', async () => {
    // The comparison that answers acceptance 2: the asset is the only difference between these two payloads,
    // so anything that moves here moved because a schedule was posted — and none may be.
    const typedOnly = { ...seedData, expenses: [...seedData.expenses, TYPED_DEPRECIATION] };
    const withBoth = await getTaxEstimate(both, AS_OF);
    const withoutAsset = await getTaxEstimate(typedOnly, AS_OF);
    expect(withoutAsset.status).toBe('computed');
    expect(withBoth.status).toBe('computed');
    if (withoutAsset.status !== 'computed' || withBoth.status !== 'computed') {
      throw new Error('both must compute');
    }
    expect(withBoth.output.total).toBe(withoutAsset.output.total);
    expect(JSON.stringify(withBoth.lines)).toBe(JSON.stringify(withoutAsset.lines));
    expect(JSON.stringify(withBoth.bases)).toBe(JSON.stringify(withoutAsset.bases));
  });

  it('the typed expense alone still deducts exactly what was typed — the refusal does not delete it', () => {
    const typedOnly = selectEstimateOperands({ ...seedData, expenses: [...seedData.expenses, TYPED_DEPRECIATION] }, AS_OF, RULES);
    const bare = selectEstimateOperands(seedData, AS_OF, RULES);
    const withBoth = selectEstimateOperands(both, AS_OF, RULES);
    if (typedOnly.kind !== 'run' || bare.kind !== 'run' || withBoth.kind !== 'run') {
      throw new Error('all three must run');
    }
    expect(typedOnly.amounts.expensesNet - bare.amounts.expensesNet).toBe(lei(70000));
    expect(withBoth.amounts.expensesNet - bare.amounts.expensesNet).toBe(lei(70000));
  });

  it('the two are never summed and never resolved by picking the larger', () => {
    const leg = selectAssetDepreciation(both, AS_OF, RULES);
    // Summing would be 100.000; picking the larger (the typed 70.000) would be 70.000. Neither appears.
    expect(leg.total).toBe(lei(0));
    expect(leg.conflicts[0]!.withheld).toBe(lei(30000));
  });

  it('a refusal raised for one asset withholds every schedule, because no link names the asset', () => {
    const second: FixedAsset = { ...LAPTOP, id: 'asset-second', label: 'Al doilea laptop' };
    const leg = selectAssetDepreciation(withAssets([LAPTOP, second], [TYPED_DEPRECIATION]), AS_OF, RULES);
    expect(leg.lines).toEqual([]);
    expect(leg.conflicts.map(c => c.assetId).sort()).toEqual(['asset-laptop', 'asset-second']);
  });

  it('a typed depreciation expense outside the period does not collide with the schedule', () => {
    const outside = { ...TYPED_DEPRECIATION, date: '2025-12-10', paid: '2025-12-10' };
    const leg = selectAssetDepreciation(withAssets([LAPTOP], [outside]), AS_OF, RULES);
    expect(leg.conflicts).toEqual([]);
    expect(leg.total).toBe(lei(30000));
  });

  it('a rejected typed expense is not a deduction, so it cannot collide either', () => {
    const rejected = { ...TYPED_DEPRECIATION, status: 'respinsa' as const };
    const leg = selectAssetDepreciation(withAssets([LAPTOP], [rejected]), AS_OF, RULES);
    expect(leg.conflicts).toEqual([]);
    expect(leg.total).toBe(lei(30000));
  });
});

describe('acceptance 3 — the refusal is visible, and names the asset', () => {
  const both = withAssets([LAPTOP], [TYPED_DEPRECIATION]);

  it('the conflict reaches the one coverage channel, with its own reason', () => {
    const leg = selectAssetDepreciation(both, AS_OF, RULES);
    const gaps = depreciationCoverageGaps(leg);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.reason).toBe('depreciation_conflict');
    expect(gaps[0]!.recordId).toBe('asset:asset-laptop');
    expect(gaps[0]!.fixTarget).toBe('/assets');
  });

  it('the sentence names the asset and the colliding expense, in the user\'s language', () => {
    const [gap] = depreciationCoverageGaps(selectAssetDepreciation(both, AS_OF, RULES));
    expect(gap!.detail).toContain('Laptop de lucru');
    expect(gap!.detail).toContain('exp-amortizare-tipita');
    expect(gap!.detail).toContain('de două ori');
    // B-106 is the standing counter-example: a refusal with no reason attached.
    expect(gap!.detail.length).toBeGreaterThan(120);
  });

  it('the conflict carries no amount, so the weighted percentage does not move for a refusal that moves no figure', () => {
    const [gap] = depreciationCoverageGaps(selectAssetDepreciation(both, AS_OF, RULES));
    expect(gap!.amount).toBeNull();
    expect(gap!.kind).toBe('profile');
  });

  it('the leg travels on the estimate, so the dashboard reads it instead of re-walking the register', async () => {
    const estimate = await getTaxEstimate(both, AS_OF);
    expect(estimate.depreciation).toBeDefined();
    expect(estimate.depreciation!.conflicts).toHaveLength(1);
    expect(estimate.depreciation!.total).toBe(lei(0));
  });
});

describe('acceptance 5 — a missing-fact asset still refuses', () => {
  it('no default life and no default method: the schedule\'s own refusal is carried, not replaced', () => {
    const leg = selectAssetDepreciation(withAssets([INCOMPLETE_ASSET]), AS_OF, RULES);
    expect(leg.lines).toEqual([]);
    expect(leg.total).toBe(lei(0));
    expect(leg.refused).toHaveLength(1);
    expect(leg.refused[0]!.assetId).toBe('asset-bare');
    expect(leg.refused[0]!.gap).toBe('durata_lipsa');
    expect(leg.refused[0]!.reason).toContain('durata normală');
  });

  it('the estimate does not move for an asset that refused — a refusal is not a zero deduction', async () => {
    const bare = await getTaxEstimate(seedData, AS_OF);
    const refused = await getTaxEstimate(withAssets([INCOMPLETE_ASSET]), AS_OF);
    if (bare.status !== 'computed' || refused.status !== 'computed') throw new Error('both must compute');
    expect(refused.output.total).toBe(bare.output.total);
  });

  it('the missing fact is reported on the same channel as every other missing fact', () => {
    const gaps = depreciationCoverageGaps(selectAssetDepreciation(withAssets([INCOMPLETE_ASSET]), AS_OF, RULES));
    expect(gaps).toHaveLength(1);
    expect(gaps[0]!.reason).toBe('fact_missing');
    expect(gaps[0]!.detail).toContain('Bun fără durată');
  });

  it('an asset with no *punere în funcțiune* refuses rather than borrowing the entry date', () => {
    const noStart: FixedAsset = { ...LAPTOP, putInFunctionDate: undefined };
    const leg = selectAssetDepreciation(withAssets([noStart]), AS_OF, RULES);
    expect(leg.refused[0]!.gap).toBe('punere_in_functiune_absenta');
    expect(leg.total).toBe(lei(0));
  });

  it('an aport of a personally-owned asset refuses and names both texts, instead of choosing', () => {
    const aport: FixedAsset = { ...LAPTOP, acquisition: 'aport' };
    const leg = selectAssetDepreciation(withAssets([aport]), AS_OF, RULES);
    expect(leg.refused[0]!.gap).toBe('aport_contra_k1');
    expect(leg.refused[0]!.reason).toContain('k¹');
    expect(leg.refused[0]!.reason).toContain('art. 7 pct. 44 lit. c)');
  });
});

describe('the seam itself', () => {
  it('depreciationForFiscalYear hands out post-ceiling figures and nothing else', () => {
    const out = depreciationForFiscalYear(depreciationRule, [M1_CAR, LAPTOP], 2026);
    expect(out.posted.map(p => p.deductible)).toEqual([lei(15000), lei(30000)]);
    for (const p of out.posted) {
      expect(p.deductible).toBeLessThanOrEqual(p.uncapped);
      expect(p.uncapped - p.deductible).toBe(p.lost);
    }
  });

  it('a year the asset does not touch is neither a posting nor a gap', () => {
    const out = depreciationForFiscalYear(depreciationRule, [LAPTOP], 2032);
    expect(out.posted).toEqual([]);
    expect(out.refused).toEqual([]);
  });

  it('the whole schedule never exceeds the fiscal value, year by year or in total', () => {
    const out = depreciationForFiscalYear(depreciationRule, [LAPTOP], 2026);
    expect(out.posted).toHaveLength(1);
    const allYears = [2026, 2027, 2028, 2029, 2030, 2031].map(
      y => depreciationForFiscalYear(depreciationRule, [LAPTOP], y).posted[0]?.deductible ?? lei(0),
    );
    expect(sumBani(allYears)).toBe(lei(120000));
  });

  it('no rule package for the year yields no leg, and does not invent a second refusal per asset', () => {
    const leg = selectAssetDepreciation(withAssets([LAPTOP]), AS_OF, []);
    expect(leg.total).toBe(lei(0));
    expect(leg.refused).toEqual([]);
    expect(leg.conflicts).toEqual([]);
  });
});

describe('B-65 acceptance 3 (brief 74) — the 50 % mixed-use limit is NOT also applied to depreciation', () => {
  /**
   * Why this test exists at all. Normele Titlul IV pct. 7 alin. (7) says the 50 % vehicle half-count
   * applies to the running costs „cu excepția cheltuielilor privind amortizarea pentru care se aplică
   * regulile privind amortizarea prevăzute la art. 28 titlul II", and CF art. 68 alin. (7) lit. k) closes
   * with the same exclusion in its own words: „Cheltuielile care intră sub incidența acestor prevederi nu
   * includ cheltuielile privind amortizarea." So art. 28 alin. (14) is the **only** cap that reaches a
   * vehicle's amortisation. Applying both would be a second, uncited cap, and it would move money.
   *
   * The register below is deliberately built so the 50 % rule is **live** — a mixed-use car with an
   * attributed running cost — so the assertion cannot pass by accident. If the half-count ever reached
   * amortisation, the leg would read 7.500 lei instead of 15.000.
   */
  const MIXED_CAR: Vehicle = {
    id: 'veh-m1',
    label: 'Autoturism M1',
    years: [{ fiscalYear: 2026, use: 'mixed', usedByPerson: 'da' }],
  };

  const FUEL: Expense = {
    id: 'exp-carburant',
    tip: 'factura',
    nr: 'VEH-2026-0001',
    date: '2026-06-10',
    paid: '2026-06-10',
    furnizor: 'Real Motor',
    cui: 'RO90000001',
    valoareFaraTva: ron(10000),
    tva: ron(2100),
    status: 'inregistrata',
    category: 'vehicle_related',
    vehicleId: 'veh-m1',
  };

  const withCar = () => ({
    ...seedData,
    fixedAssets: [M1_CAR],
    vehicles: [...(seedData.vehicles ?? []), MIXED_CAR],
    expenses: [...seedData.expenses, FUEL],
  });

  it('the schedule posts the art. 28 alin. (14) figure, 1.500 lei × 10 months, and no half-count on top', () => {
    const leg = selectAssetDepreciation(withCar(), AS_OF, RULES);
    expect(leg.conflicts).toEqual([]);
    expect(leg.lines).toHaveLength(1);
    // 120.000 / 60 luni = 2.000 lei/lună, peste plafon → 1.500 lei/lună × 10 luni (martie–decembrie).
    expect(leg.lines[0]!.deductible).toBe(lei(15000));
    expect(leg.total).toBe(lei(15000));
    // The double cap would read half of this. Asserted as a negative so the failure names the mistake.
    expect(leg.total).not.toBe(lei(7500));
  });

  it('the same register halves the running cost, so the 50 % rule is provably live beside the asset', () => {
    // Without this, the test above could pass simply because no vehicle rule fired at all.
    const bare = selectEstimateOperands({ ...seedData, expenses: [...seedData.expenses, FUEL] }, AS_OF, RULES);
    expect(bare.kind).toBe('run');
    if (bare.kind !== 'run') throw new Error('the register must run');
    // `expenses` is the VAT-inclusive measure, so the half-count lands on 10.000 + 2.100 = 12.100 lei and
    // 6.050 lei enters the expense leg. The point is that a vehicle_related cost DOES move.
    const seedOnly = selectEstimateOperands(seedData, AS_OF, RULES);
    expect(seedOnly.kind).toBe('run');
    if (seedOnly.kind !== 'run') throw new Error('the seed register must run');
    expect(bare.amounts.expenses - seedOnly.amounts.expenses).toBe(lei(6050));
  });

  it('the estimate moves by exactly the capped amortisation on top of the halved running cost', () => {
    const withFuelOnly = selectEstimateOperands(
      { ...seedData, vehicles: [...(seedData.vehicles ?? []), MIXED_CAR], expenses: [...seedData.expenses, FUEL] },
      AS_OF,
      RULES,
    );
    const withBoth = selectEstimateOperands(withCar(), AS_OF, RULES);
    expect(withFuelOnly.kind).toBe('run');
    expect(withBoth.kind).toBe('run');
    if (withFuelOnly.kind !== 'run' || withBoth.kind !== 'run') throw new Error('both must run');
    // The difference between the two registers is the amortisation and nothing else: 15.000 lei, not 7.500.
    expect(withBoth.amounts.expenses - withFuelOnly.amounts.expenses).toBe(lei(15000));
  });

  it('the cap is per vehicle per month — „pentru fiecare" — so a second M1 gets its own ceiling', () => {
    // `research/40` §4 records the asymmetry: art. 28 alin. (14) is per vehicle with no one-car limit,
    // while art. 68 alin. (5) lit. j) limits running costs to a single car. A fleet is not a pool.
    const second: FixedAsset = { ...M1_CAR, id: 'asset-m1-b', label: 'Autoturism M1 doi' };
    const leg = selectAssetDepreciation(withAssets([M1_CAR, second]), AS_OF, RULES);
    expect(leg.lines).toHaveLength(2);
    for (const line of leg.lines) expect(line.deductible).toBe(lei(15000));
    expect(leg.total).toBe(lei(30000));
  });
});

describe('B-65 acceptance 4 (brief 74) — the pct. 27 disposal figure is reported, and is not posted', () => {
  /**
   * The pct. 27 ceiling is already computed by `depreciationSchedule` and already rendered on
   * `pages/Assets.tsx`. What it never did was reach the seam between the schedule and the estimate:
   * `depreciationForFiscalYear` read `outcome.years` and dropped `outcome.disposal`, so the estimate had
   * no idea an asset had left the register at all.
   *
   * The figure is now carried to the estimate as a **reported** amount and deliberately not added to
   * `total`. The reason is Titlul IV norm pct. 7 alin. (5) lit. o), which caps the same residual a second
   * time at „nivelul venitului realizat din înstrăinare" — the disposal proceeds. No `FixedAsset` field
   * holds those proceeds, so posting pct. 27's number would deduct more than the norm allows whenever the
   * asset sold below its unamortised value. Adding the field is a persisted-shape change, and this brief's
   * boundary keeps the chain head at v21.
   */
  const DISPOSED_M1: FixedAsset = {
    ...M1_CAR,
    id: 'asset-m1-disposed',
    label: 'Autoturism M1 vândut',
    disposedOn: '2026-10-15',
    disposalKind: 'vanzare',
  };

  it('the year read carries the disposal figure out of the schedule instead of dropping it', () => {
    const out = depreciationForFiscalYear(depreciationRule, [DISPOSED_M1], 2026);
    expect(out.disposals).toHaveLength(1);
    const d = out.disposals[0]!;
    expect(d.assetId).toBe('asset-m1-disposed');
    // 120.000 lei / 60 luni = 2.000 lei/lună. B-153 closed: the schedule itself stops at the disposal month,
    // so the 2026 row carries the eight months Martie–Octombrie (16.000 lei uncapped) and `disposalFigure`
    // counts those same eight — 16.000 lei amortised, 104.000 lei left, 60 − 8 = 52 months remaining.
    expect(d.unamortised).toBe(lei(104000));
    expect(d.remainingMonths).toBe(52);
    // pct. 27: 1.500 lei × lunile rămase.
    expect(d.cap).toBe(lei(78000));
    expect(d.deductible).toBe(lei(78000));
    expect(d.capped).toBe(true);
  });

  it('the disposal amount never enters the expense leg, so the estimate does not move by it', () => {
    const leg = selectAssetDepreciation(withAssets([DISPOSED_M1]), AS_OF, RULES);
    expect(leg.disposals).toHaveLength(1);
    // The amortisation rows for the year are posted; the disposal residual is not.
    // 1.500 lei/lună × the EIGHT months the schedule runs for 2026 — Ianuarie and Februarie were never
    // chargeable (punerea în funcțiune is 15 Februarie, so amortizarea starts in Martie), and Noiembrie and
    // Decembrie are not charged because the car left the register in Octombrie. Before B-153 this row posted
    // 15.000 lei for ten months while the disposal figure counted eight; there is one count now, and the
    // posted figure moved with it.
    expect(leg.total).toBe(lei(12000));
    expect(leg.total).not.toBe(lei(12000) + lei(78000));
  });

  it('the unposted figure is a coverage row the user can read, not a silent omission', () => {
    const gaps = depreciationCoverageGaps(selectAssetDepreciation(withAssets([DISPOSED_M1]), AS_OF, RULES));
    const row = gaps.find((g) => g.recordId === 'asset:asset-m1-disposed:disposal');
    expect(row, 'the disposal must be reported on the one coverage channel').toBeDefined();
    // `amount: null` is the pair the conflict rows use, and it is what keeps the weighted completeness
    // denominator unmoved: this is a sum that was never in the figure, not a sum that left it.
    expect(row!.amount).toBeNull();
    expect(row!.reason).toBe('fact_missing');
    expect(row!.fixTarget).toBe('/assets');
    expect(row!.detail).toContain('pct. 27');
    expect(row!.detail).toContain('78.000,00');
    // B-153: the row states the one month count, and states that stopping at the exit month is a reading.
    expect(row!.detail).toContain('numără aceleași luni');
    expect(row!.detail).toContain('Este o citire, nu un text');
    expect(row!.detail).toContain('înstrăinare');
    expect(row!.detail).toContain('NU este adăugată în estimare');
  });

  it('an asset still in the register produces no disposal row', () => {
    const gaps = depreciationCoverageGaps(selectAssetDepreciation(withAssets([M1_CAR]), AS_OF, RULES));
    expect(gaps.some((g) => g.recordId.endsWith(':disposal'))).toBe(false);
  });

  it('B-156 — a disposed NON-M1 asset gets no pct. 27 figure, and the row names the limit that does apply', () => {
    // The register's laptop: degresivă, 120.000 lei, 60 luni, pus în funcțiune pe 15 Februarie 2026, scos
    // din gestiune pe 15 Octombrie 2026 cu un preț de 90.000 lei. 8 luni amortizate (Martie–Octombrie),
    // 24.000 lei luați (36.000 cota degresivă × 8/12), 96.000 lei rămân neamortizați, 52 luni rămase.
    //
    // As an M1 the residual would have been cut to 1.500 × 52 = 78.000 lei. It is not an M1, so pct. 27
    // never speaks of it: the only limit is the 90.000 lei price, and the residual is under it.
    const DISPOSED_LAPTOP: FixedAsset = {
      ...LAPTOP,
      id: 'asset-laptop-disposed',
      label: 'Laptop scos din gestiune',
      disposedOn: '2026-10-15',
      disposalKind: 'vanzare',
      disposalProceeds: lei(90000),
    };
    const out = depreciationForFiscalYear(depreciationRule, [DISPOSED_LAPTOP], 2026);
    expect(out.disposals).toHaveLength(1);
    const d = out.disposals[0]!;
    expect(d.isM1).toBe(false);
    expect(d.cap).toBeNull();
    expect(d.unamortised).toBe(lei(96000));
    expect(d.remainingMonths).toBe(52);
    expect(d.proceedsCap).toBe(lei(90000));
    expect(d.deductible).toBe(lei(90000));
    expect(d.bound).toBe('proceeds');
    expect(d.complete).toBe(true);
    // The money the ungated rule used to cost: the same asset carried an M1 ceiling of 78.000 lei.
    expect(d.deductible).toBeGreaterThan(lei(78000));

    const gaps = depreciationCoverageGaps(
      selectAssetDepreciation(withAssets([DISPOSED_LAPTOP]), AS_OF, RULES),
    );
    const row = gaps.find((g) => g.recordId === 'asset:asset-laptop-disposed:disposal');
    expect(row, 'a non-M1 disposal must still be reported').toBeDefined();
    expect(row!.detail).toContain('nu este un autoturism M1 declarat');
    expect(row!.detail).not.toContain('plafon 1.500 lei × luni');
    expect(row!.detail).toContain('Limita care se aplică acestui bun este prețul înstrăinării:');
    expect(row!.detail).toContain('90.000,00');
  });

  it('B-156 — the M1 branch keeps its pct. 27 ceiling, so the gate narrows the rule and does not delete it', () => {
    const out = depreciationForFiscalYear(depreciationRule, [DISPOSED_M1], 2026);
    const d = out.disposals[0]!;
    expect(d.isM1).toBe(true);
    expect(d.cap).toBe(lei(78000)); // 1.500 lei × 52 luni rămase
  });
});
