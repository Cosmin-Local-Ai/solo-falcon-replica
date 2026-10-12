/**
 * PG-6e (B-31, D-FA-1) — the fiscal depreciation arithmetic.
 *
 * The first test is the acceptance test for **our reading**, not for the law. `research/36` §12.1 quotes
 * the only worked example in the 624-page Partea I — Titlul II norm pct. 25: intrare 350.000 lei, durata
 * 10 ani, cota anuală 10 %, cota degresivă 10 % × 2,0 = 20 %, years 1–5 at 20 % of the remaining value,
 * and from year 6 „114.688/5 ani" = 22.937,6. If this test fails, the reading of the degresive switch is
 * wrong; the example is not.
 *
 * The second construction is the first-year 1/12 pro-rating (§12.2: no daily formula, no monthly table, no
 * first-year fraction anywhere). §3.7's worked example — put in function March 2026, 48-month life — gives
 * 9 months in 2026, then 12/12/12, then 3 months, and that shape is pinned here too.
 */
import { describe, expect, it } from 'vitest';
import { lei, type Bani } from '../money';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';
import {
  depreciationSchedule,
  classifyAgainstThreshold,
  FISCAL_DEPRECIATION_RULE_ID,
  M1_EXCEPTION_CATEGORIES,
  type FixedAssetFacts,
} from './depreciation';
import { VEHICLE_EXCEPTION_CATEGORIES } from './deductibility';

const rule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === FISCAL_DEPRECIATION_RULE_ID)!;

/** A fully-declared asset, so each test changes exactly one fact. */
const asset = (over: Partial<FixedAssetFacts> = {}): FixedAssetFacts => ({
  label: 'Test',
  entryDate: '2025-12-10',
  putInFunctionDate: '2025-12-31', // → depreciation starts January 2026: whole calendar years
  fiscalValue: lei(350000),
  normalLifeMonths: 120,
  method: 'degresiv',
  acquisition: 'cumparare',
  paymentState: 'achitat',
  paidOn: '2025-12-20',
  ...over,
});

/** Compare in lei for readability; `lei()` is the same integer-bani conversion the code uses. */
const L = (amountInLei: number): Bani => lei(amountInLei);

describe('the degresive schedule against norm pct. 25 — the acceptance test for our reading', () => {
  it('reproduces pct. 25: 70.000 / 56.000 / 44.800 / 35.840 / 28.672, then 22.937,6 for years 6-10', () => {
    const out = depreciationSchedule(rule, asset());
    if (out.status !== 'computed') throw new Error(`expected computed, got ${out.status}: ${out.reason}`);
    expect(out.years.map((y) => y.fiscalYear)).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]);
    expect(out.years.map((y) => y.deductible)).toEqual([
      L(70000),
      L(56000),
      L(44800),
      L(35840),
      L(28672),
      L(22937.6),
      L(22937.6),
      L(22937.6),
      L(22937.6),
      L(22937.6),
    ]);
  });

  it('switches to straight-line on the remainder from year 6, and labels that branch', () => {
    const out = depreciationSchedule(rule, asset());
    if (out.status !== 'computed') throw new Error('expected computed');
    expect(out.years.slice(0, 5).every((y) => y.branch === 'degresiv_anuali')).toBe(true);
    expect(out.years.slice(5).every((y) => y.branch === 'degresiv_linie_dreapta')).toBe(true);
    // pct. 25 states the switch as „114.688/5 ani" — the remainder over the five years still left.
    const remainderAfterFive = lei(350000) - out.years.slice(0, 5).reduce((a, y) => a + y.uncapped, 0);
    expect(remainderAfterFive).toBe(L(114688));
    expect(out.years[5]!.uncapped).toBe(L(22937.6));
  });

  it('sums exactly to the fiscal value, with no rounding drift', () => {
    const out = depreciationSchedule(rule, asset());
    if (out.status !== 'computed') throw new Error('expected computed');
    const total = out.years.reduce((a, y) => a + y.uncapped, 0);
    expect(total).toBe(lei(350000));
  });

  it('picks 1,5 for a 2-5 ani duration and 2,5 for over 10 ani, from the rule parameters', () => {
    const short = depreciationSchedule(rule, asset({ normalLifeMonths: 36, fiscalValue: lei(36000) }));
    if (short.status !== 'computed') throw new Error('expected computed');
    // 3 ani, coeficient 1,5 → cota anuală 1/3 × 1,5 = 50 % din valoarea rămasă.
    expect(short.years.map((y) => y.uncapped)).toEqual([L(18000), L(9000), L(9000)]);

    const long = depreciationSchedule(rule, asset({ normalLifeMonths: 144, fiscalValue: lei(14400) }));
    if (long.status !== 'computed') throw new Error('expected computed');
    // 12 ani, coeficient 2,5 → 2,5/12 = 20,8333… % din valoarea rămasă în anii 1-5.
    expect(long.years[0]!.uncapped).toBe(L(3000));
  });

  it('refuses a degresive duration under 2 ani instead of inventing a coefficient', () => {
    const out = depreciationSchedule(rule, asset({ normalLifeMonths: 12 }));
    expect(out.status).toBe('review_required');
    if (out.status === 'review_required') {
      expect(out.gap).toBe('coeficient_degresiv_indefinit');
      expect(out.reason).toContain('1,5');
    }
  });
});

describe('the linear schedule and the first-year pro-rating (our construction, labelled)', () => {
  it('gives 9 months in the first year, then 12/12/12, then 3 months — research/36 §3.7', () => {
    const out = depreciationSchedule(
      rule,
      asset({
        entryDate: '2026-01-10',
        putInFunctionDate: '2026-03-15',
        fiscalValue: lei(12000),
        normalLifeMonths: 48,
        method: 'liniar',
      }),
    );
    if (out.status !== 'computed') throw new Error(`expected computed, got ${out.status}`);
    expect(out.years.map((y) => [y.fiscalYear, y.months])).toEqual([
      [2026, 9],
      [2027, 12],
      [2028, 12],
      [2029, 12],
      [2030, 3],
    ]);
    expect(out.years.map((y) => y.uncapped)).toEqual([
      L(2250),
      L(3000),
      L(3000),
      L(3000),
      L(750),
    ]);
    expect(out.years[0]!.proRated).toBe(true);
    expect(out.years[1]!.proRated).toBe(false);
    expect(out.years.reduce((a, y) => a + y.uncapped, 0)).toBe(lei(12000));
  });

  it('starts in January of the following year when punerea în funcțiune falls in Decembrie', () => {
    const out = depreciationSchedule(
      rule,
      asset({ putInFunctionDate: '2026-12-20', fiscalValue: lei(12000), normalLifeMonths: 48, method: 'liniar' }),
    );
    if (out.status !== 'computed') throw new Error('expected computed');
    // art. 28 alin. (12) lit. a) — the month AFTER. No amount is squeezed into 2026 and no date is shifted.
    expect(out.years.map((y) => [y.fiscalYear, y.months])).toEqual([
      [2027, 12],
      [2028, 12],
      [2029, 12],
      [2030, 12],
    ]);
  });
});

describe('the art. 28 alin. (14) M1 ceiling — per vehicle, 1.500 lei/lună, excess lost', () => {
  it('caps a month above 1.500 lei and reports the excess as definitively lost', () => {
    // 120.000 lei / 4 ani = 30.000 lei/an = 2.500 lei/lună → deductibil 18.000, pierdut 12.000.
    const out = depreciationSchedule(
      rule,
      asset({ fiscalValue: lei(120000), normalLifeMonths: 48, method: 'liniar', isM1Vehicle: true }),
    );
    if (out.status !== 'computed') throw new Error('expected computed');
    expect(out.years[0]!.uncapped).toBe(L(30000));
    expect(out.years[0]!.deductible).toBe(L(18000));
    expect(out.years[0]!.lost).toBe(L(12000));
  });

  it('leaves a month at or under 1.500 lei untouched', () => {
    // 60.000 lei / 4 ani = 1.250 lei/lună — sub plafon.
    const out = depreciationSchedule(
      rule,
      asset({ fiscalValue: lei(60000), normalLifeMonths: 48, method: 'liniar', isM1Vehicle: true }),
    );
    if (out.status !== 'computed') throw new Error('expected computed');
    expect(out.years.every((y) => y.lost === 0)).toBe(true);
    expect(out.years[0]!.deductible).toBe(L(15000));
  });

  it('applies the ceiling to EACH M1 — several cars depreciate while only one carries running costs', () => {
    // research/40 §4: „pentru fiecare", fără limită de un singur autoturism. This is the direction
    // `VehicleCapStatus` from PG-6c would have got wrong.
    const a = depreciationSchedule(rule, asset({ label: 'A', fiscalValue: lei(120000), normalLifeMonths: 48, method: 'liniar', isM1Vehicle: true }));
    const b = depreciationSchedule(rule, asset({ label: 'B', fiscalValue: lei(120000), normalLifeMonths: 48, method: 'liniar', isM1Vehicle: true }));
    if (a.status !== 'computed' || b.status !== 'computed') throw new Error('expected computed');
    expect(a.years[0]!.deductible).toBe(L(18000));
    expect(b.years[0]!.deductible).toBe(L(18000));
  });

  it('lifts the ceiling for a claimed alin. (14) exception category', () => {
    const out = depreciationSchedule(
      rule,
      asset({
        fiscalValue: lei(120000),
        normalLifeMonths: 48,
        method: 'liniar',
        isM1Vehicle: true,
        m1ExceptionCategory: 'vanzari_achizitii_test_drive_demonstratii',
      }),
    );
    if (out.status !== 'computed') throw new Error('expected computed');
    expect(out.years[0]!.deductible).toBe(L(30000));
    expect(out.years.every((y) => y.lost === 0)).toBe(true);
  });
});

describe('the pct. 27 disposal ceiling — 1.500 lei × the months left in the DECLARED duration', () => {
  it('caps the unamortised value at 1.500 lei per remaining month', () => {
    // 120.000 lei / 48 luni = 2.500 lei/lună. After 24 months, 60.000 lei remain unamortised and
    // 24 months are left → cap 1.500 × 24 = 36.000 lei.
    const out = depreciationSchedule(
      rule,
      asset({
        fiscalValue: lei(120000),
        normalLifeMonths: 48,
        method: 'liniar',
        isM1Vehicle: true,
        disposedOn: '2027-12-31',
        disposalKind: 'scoatere_din_gestiune',
      }),
    );
    if (out.status !== 'computed' || !out.disposal) throw new Error('expected computed with disposal');
    expect(out.disposal.unamortised).toBe(L(60000));
    expect(out.disposal.remainingMonths).toBe(24);
    expect(out.disposal.cap).toBe(L(36000));
    expect(out.disposal.deductible).toBe(L(36000));
    expect(out.disposal.capped).toBe(true);
  });

  it('uses the duration the taxpayer declared, not a Catalog default', () => {
    const shortLife = depreciationSchedule(
      rule,
      asset({
        fiscalValue: lei(120000),
        normalLifeMonths: 24,
        method: 'liniar',
        isM1Vehicle: true,
        disposedOn: '2026-12-31',
        disposalKind: 'vanzare',
      }),
    );
    if (shortLife.status !== 'computed' || !shortLife.disposal) throw new Error('expected computed with disposal');
    // 12 months used, 12 left → cap 18.000 lei, against 36.000 for the same asset on a 48-month duration.
    expect(shortLife.disposal.remainingMonths).toBe(12);
    expect(shortLife.disposal.cap).toBe(L(18000));
  });
});

describe('the three silences refuse and name the gap (D-FA-1)', () => {
  it('punerea în funcțiune missing — the term is undefined in fiscal law', () => {
    const out = depreciationSchedule(rule, asset({ putInFunctionDate: undefined }));
    expect(out.status).toBe('review_required');
    if (out.status === 'review_required') {
      expect(out.gap).toBe('punere_in_functiune_absenta');
      expect(out.reason).toContain('art. 28 alin. (12) lit. a)');
      expect(out.reason).toContain('doctrină de practician');
    }
  });

  it('aport of a personally-owned depreciable asset — names k^1) AND art. 7 pct. 44 lit. c)', () => {
    const out = depreciationSchedule(rule, asset({ acquisition: 'aport' }));
    expect(out.status).toBe('review_required');
    if (out.status === 'review_required') {
      expect(out.gap).toBe('aport_contra_k1');
      expect(out.reason).toContain('lit. k¹)');
      expect(out.reason).toContain('art. 7 pct. 44 lit. c)');
      expect(out.reason).toContain('altei afaceri');
    }
  });

  it('payment in a later year than punerea în funcțiune — names both readings', () => {
    const out = depreciationSchedule(rule, asset({ paidOn: '2027-06-01' }));
    expect(out.status).toBe('review_required');
    if (out.status === 'review_required') {
      expect(out.gap).toBe('plata_vs_punere_in_functiune');
      expect(out.reason).toContain('art. 28 alin. (12) lit. a)');
      expect(out.reason).toContain('art. 68 alin. (4) lit. b)');
    }
  });

  it('an unpaid or instalment asset refuses rather than picking the 2026-start reading', () => {
    for (const paymentState of ['neachitat', 'in_rate'] as const) {
      const out = depreciationSchedule(rule, asset({ paymentState }));
      expect(out.status).toBe('review_required');
      if (out.status === 'review_required') expect(out.gap).toBe('plata_vs_punere_in_functiune');
    }
  });

  it('a sub-threshold asset with no alin. (21) election refuses; absence is not a branch', () => {
    const out = depreciationSchedule(rule, asset({ fiscalValue: lei(3000) }));
    expect(out.status).toBe('review_required');
    if (out.status === 'review_required') {
      expect(out.gap).toBe('optiune_alin_21_lipsa');
      expect(out.reason).toContain('art. 28 alin. (21)');
      expect(out.reason).toContain('pct. 31');
    }
  });

  it('the elected full-expensing branch deducts the whole value at punerea în funcțiune', () => {
    const out = depreciationSchedule(
      rule,
      asset({
        fiscalValue: lei(3000),
        putInFunctionDate: '2026-03-15',
        paidOn: '2026-03-20',
        subThresholdElection: 'intreg_la_punere_in_functiune',
      }),
    );
    if (out.status !== 'computed') throw new Error('expected computed');
    expect(out.years).toHaveLength(1);
    expect(out.years[0]!.fiscalYear).toBe(2026);
    expect(out.years[0]!.deductible).toBe(L(3000));
    expect(out.years[0]!.branch).toBe('valoare_intreaga');  });

  it('a missing declared duration refuses — pct. 27 puts the choice with the taxpayer', () => {
    const out = depreciationSchedule(rule, asset({ normalLifeMonths: undefined }));
    expect(out.status).toBe('review_required');
    if (out.status === 'review_required') {
      expect(out.gap).toBe('durata_lipsa');
      expect(out.reason).toContain('stabilită de contribuabil');
    }
  });
});

describe('the art. 28 alin. (2) lit. b) threshold classification', () => {
  it('measures at entry into the patrimony and treats 5.000 lei as inclusive', () => {
    expect(classifyAgainstThreshold(rule, asset({ fiscalValue: lei(5000) }))).toBe('depreciable');
    expect(classifyAgainstThreshold(rule, asset({ fiscalValue: lei(4999.99) }))).toBe('below_threshold_not_elected');
    expect(
      classifyAgainstThreshold(rule, asset({ fiscalValue: lei(4999.99), subThresholdElection: 'amortizare' })),
    ).toBe('below_threshold_elected');
  });
});

describe('the two vehicle exception lists stay separate (research/36 §12.7)', () => {
  it('alin. (14) has four categories and includes test drive / demonstrații', () => {
    expect(M1_EXCEPTION_CATEGORIES).toHaveLength(4);
    expect(M1_EXCEPTION_CATEGORIES).toContain('vanzari_achizitii_test_drive_demonstratii');
  });

  it('lit. k) has five, has no test-drive wording, and adds vehicule utilizate ca mărfuri', () => {
    expect(VEHICLE_EXCEPTION_CATEGORIES).toHaveLength(5);
    expect(VEHICLE_EXCEPTION_CATEGORIES).toContain('marfuri_in_scop_comercial');
    expect(VEHICLE_EXCEPTION_CATEGORIES.some((c) => c.includes('test_drive'))).toBe(false);
  });

  it('the alin. (14) list has no marfuri-in-scop-comercial member, and the lit. k) list has no test-drive member', () => {
    // Three of the four alin. (14) categories genuinely overlap the lit. k) list in substance; what must
    // not happen is the two being collapsed into one vocabulary. The two members that exist on only one
    // side are the proof they are separate provisions.
    expect(M1_EXCEPTION_CATEGORIES).not.toContain('marfuri_in_scop_comercial');
    expect(VEHICLE_EXCEPTION_CATEGORIES.some((c) => c.includes('test_drive'))).toBe(false);
    expect(M1_EXCEPTION_CATEGORIES.some((c) => c.includes('test_drive'))).toBe(true);
  });

  it('the depreciation layer never imports the vehicle cap vocabulary — the one-car ceiling is not this ceiling', () => {
    // Acceptance 5, asserted at the source: reusing PG-6c's cap status would merge art. 28 alin. (14)
    // (per vehicle, „pentru fiecare”) with art. 68 alin. (5) lit. j) (one car per person).
    const sources = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const file = Object.entries(sources).find(([path]) => path.endsWith('./depreciation.ts'));
    expect(file, 'depreciation.ts must be scannable').toBeTruthy();
    expect(file![1]).not.toContain("from './deductibility'");
  });
});
