/**
 * TASK 2c — the annual / cross-record deductibility caps.
 *
 * Every expected figure below was derived BY HAND before the suite was run, and the arithmetic is
 * written out in the comment above it. Nothing here was read off a failing diff.
 *
 * The fixture is always `{ ...seedData, expenses }`, so the revenue side is the seed's and is fixed
 * (seed.ts:41-44, `lei(n)` = n x 100 bani; r2 is `in-asteptare` and r3 is `respinsa`, so neither is
 * aggregated):
 *   revenues (VAT-inclusive, `inregistrata` only)
 *     = r1 lei(4500) + lei(945) + r4 lei(3200) + lei(672)
 *     = 450.000 + 94.500 + 320.000 + 67.200 = 931.700 bani = 9.317,00 lei
 *   revenuesNet (VAT-exclusive)
 *     = 450.000 + 320.000                    = 770.000 bani = 7.700,00 lei
 *
 * Two measures, both capped. `tax.ts:143-144` picks one with `vatExempt` — `gross = vatExempt ?
 * revenues : revenuesNet`, `deductibleBase = vatExempt ? expenses : expensesNet` — and the assembler
 * does not hold that profile fact, so each ceiling is struck against ITS OWN measure's gross. That
 * keeps each measure internally consistent with whichever one the engine ends up using.
 */
import { describe, expect, it } from 'vitest';
import { selectEstimateOperands, type EstimateOperands } from './estimateBasis';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal';
import { seedData } from '../data/seed';
import type { AppData, Expense, Revenue } from '../data/types';
import { lei } from './money';

const YEAR_END = '2026-12-31'; // elapsedMonths = 11 + 31/31 = 12 -> the projection is the identity
const E2E_CLOCK = '2026-10-31'; // elapsedMonths = 9 + 31/31 = 10 -> every annual figure is YTD x 1,2

/**
 * The seed's own revenues are all dated September, so an `asOfDate` before 2026-09-02 legitimately has
 * NO gross in period and the alin. (6) base is genuinely zero. A mid-year test therefore has to run on
 * the same clock the e2e suite uses, or it measures an empty year rather than a projection.
 */
function revenue(over: Partial<Revenue> = {}): Revenue {
  return {
    id: 'rev-1',
    tip: 'factura',
    nr: 'FCT-TEST-R1',
    date: '2026-01-03',
    client: 'Presta Consulting SRL',
    cui: 'RO12345678',
    valoareFaraTva: lei(1000),
    tva: lei(190),
    status: 'inregistrata',
    ...over,
  };
}

function expense(over: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    tip: 'factura',
    nr: 'FCT-TEST-1',
    date: '2026-06-10',
    furnizor: 'Furnizor Test',
    cui: 'RO00000000',
    valoareFaraTva: lei(1000),
    tva: lei(190),
    status: 'inregistrata',
    ...over,
  };
}

function dataWith(expenses: Expense[], revenues?: Revenue[]): AppData {
  return { ...seedData, expenses, ...(revenues ? { revenues } : {}) };
}

function run(expenses: Expense[], asOfDate = YEAR_END, revenues?: Revenue[]): EstimateOperands {
  return selectEstimateOperands(dataWith(expenses, revenues), asOfDate, PFA_2026_SYSTEM_REAL_PACKAGE);
}

function amounts(o: EstimateOperands) {
  if (o.kind !== 'run') throw new Error('expected the estimate to run');
  return o;
}

describe('TASK 2c — the art. 68 alin. (6) two-pass: protocol 2 % and burse private 5 %', () => {
  it('protocol enters the deductible total up to 2 % of the alin. (6) base, floored to the ban', () => {
    // Claimed: 1.000,00 lei net + 190,00 lei VAT.
    // Pass 1 aggregate carries NO protocol (alin. (6) removes it from its own base), so:
    //   base (excl VAT) = revenuesNet - deductibleNet = 770.000 - 0        = 770.000 bani = 7.700,00 lei
    //   ceiling         = floor(770.000 x 2 / 100)    = floor(15.400)      =  15.400 bani =   154,00 lei
    //   allowed         = min(100.000 claimed, 15.400) = 15.400 bani
    //   base (incl VAT) = 931.700 - 0                 = 931.700 bani = 9.317,00 lei
    //   ceiling         = floor(931.700 x 2 / 100)    = floor(18.634)      =  18.634 bani =   186,34 lei
    //   allowed         = min(119.000, 18.634)        =  18.634 bani
    const o = amounts(run([expense({ category: 'protocol' })]));
    expect(o.deductible.records).toHaveLength(0); // not entered unbounded
    expect(o.deductible.annualCapped).toHaveLength(1);
    expect(o.amounts.expensesNet).toBe(lei(154));
    expect(o.amounts.expenses).toBe(lei(186.34));
    expect(o.capAdjustments).toHaveLength(1);
    const adj = o.capAdjustments[0];
    expect(adj.ruleId).toBe('EXPENSE_PROTOCOL_2026');
    expect(adj.base).toEqual({ inclVat: lei(9317), exclVat: lei(7700) });
    expect(adj.ceiling).toEqual({ inclVat: lei(186.34), exclVat: lei(154) });
    expect(adj.allowed).toEqual({ inclVat: lei(186.34), exclVat: lei(154) });
    // A claim inside the ceiling is allowed whole — the ceiling is a ceiling, not a haircut.
    const inside = amounts(run([expense({ category: 'protocol', valoareFaraTva: lei(100), tva: lei(19) })]));
    //   claimed 10.000 / 11.900 bani < ceiling 15.400 / 18.634 -> allowed = claimed.
    expect(inside.amounts.expensesNet).toBe(lei(100));
    expect(inside.amounts.expenses).toBe(lei(119));
  });

  it('burse private is capped at 5 % of the SAME base, and the two ceilings never feed each other', () => {
    // alin. (6) excludes burse private AND protocol from the base, so the base is struck ONCE and both
    // letters read the same number. This is the anti-iteration test: if the assembler iterated, the
    // protocol amount allowed in would shrink the base the burse ceiling is struck on.
    //   base (excl) = 770.000 bani for BOTH letters.
    //   protocol: floor(770.000 x 2 / 100) = 15.400 bani; claimed 100.000 -> allowed 15.400
    //   burse:    floor(770.000 x 5 / 100) = 38.500 bani; claimed 200.000 -> allowed 38.500
    //   expensesNet = 15.400 + 38.500 = 53.900 bani = 539,00 lei
    //   base (incl) = 931.700; protocol floor(18.634) = 18.634; burse floor(46.585) = 46.585
    //   claimed burse incl = 200.000 + 38.000 = 238.000 -> allowed 46.585
    //   expenses = 18.634 + 46.585 = 65.219 bani = 652,19 lei
    const o = amounts(
      run([
        expense({ id: 'p', category: 'protocol' }),
        expense({ id: 'b', category: 'private_scholarship', valoareFaraTva: lei(2000), tva: lei(380) }),
      ]),
    );
    expect(o.amounts.expensesNet).toBe(lei(539));
    expect(o.amounts.expenses).toBe(lei(652.19));
    // Both adjustments report the SAME base — one pass, not a fixed-point search.
    expect(o.capAdjustments).toHaveLength(2);
    const protocol = o.capAdjustments.find((a) => a.category === 'protocol')!;
    const burse = o.capAdjustments.find((a) => a.category === 'private_scholarship')!;
    expect(protocol.base).toEqual(burse.base);
    expect(protocol.base!.exclVat).toBe(lei(7700));
    expect(burse.base!.exclVat).toBe(lei(7700));
    expect(burse.cap).toMatchObject({ percent: 5, base: 'art68_alin6_base' });
  });

  it('an alin. (6) base that has been eaten by other deductible expenses gives a zero allowance, never a negative one', () => {
    // rent 20.000,00 lei deductible, gross 7.700,00 lei -> 770.000 - 2.000.000 = -1.230.000.
    // A negative base must not become a negative allowance (which would ADD to the deductible total).
    const o = amounts(
      run([
        expense({ id: 'rent', category: 'rent_business_space', valoareFaraTva: lei(20000), tva: lei(0) }),
        expense({ id: 'p', category: 'protocol', valoareFaraTva: lei(1000), tva: lei(0) }),
      ]),
    );
    expect(o.amounts.expensesNet).toBe(lei(20000)); // rent only; protocol contributed 0
    expect(o.capAdjustments[0].base).toEqual({ inclVat: lei(0), exclVat: lei(0) });
    expect(o.capAdjustments[0].allowed).toEqual({ inclVat: lei(0), exclVat: lei(0) });
  });
});

describe('TASK 2c — contribuții profesionale: 5 % of the gross (art. 68 alin. (5) lit. q))', () => {
  it('the cap is applied even though alin. (4) lit. i) lists the category uncapped', () => {
    //   ceiling (excl) = floor(770.000 x 5 / 100) = 38.500 bani = 385,00 lei; claimed 100.000 -> 38.500
    //   ceiling (incl) = floor(931.700 x 5 / 100) = 46.585 bani = 465,85 lei; claimed 119.000 -> 46.585
    const o = amounts(run([expense({ category: 'mandatory_professional_contribution' })]));
    expect(o.amounts.expensesNet).toBe(lei(385));
    expect(o.amounts.expenses).toBe(lei(465.85));
    const adj = o.capAdjustments[0];
    expect(adj.ruleId).toBe('EXPENSE_PROFESSIONAL_CONTRIBUTION_2026');
    expect(adj.cap).toMatchObject({ percent: 5, base: 'gross_income' });
    // Decision 3: the conflict is disclosed on the number, not resolved in silence.
    expect(adj.conflict).toContain('alin. (4) lit. i)');
  });
});

describe('TASK 2d — the alin. (6) base is struck PRE-cap, and the post-cap reading is surfaced', () => {
  it('the pre-cap base is the one used, and the post-cap reading is recorded as the alternative', () => {
    // protocol 1.000,00 / 190,00 lei + contribuții profesionale 5.000,00 / 950,00 lei, at year end.
    // Re-derived BY HAND before running (TASK 2d), all amounts in bani:
    //   seed gross: exclVat 770.000 (7.700,00 lei) · inclVat 931.700 (9.317,00 lei)
    //   Pass 1 holds BOTH capped categories out of the aggregate, so the uncapped deductible is 0.
    // Pass A — lit. q), 5 % of the gross:
    //   exclVat ceiling = floor(770.000 x 5 / 100) = 38.500; claimed 500.000 -> allowed 38.500
    //   inclVat ceiling = floor(931.700 x 5 / 100) = 46.585; claimed 595.000 -> allowed 46.585
    // The two readings of the alin. (6) base:
    //   POST-cap  exclVat = 770.000 - 38.500 = 731.500 (7.315,00 lei)  [lit. q) as ALLOWED]
    //             inclVat = 931.700 - 46.585 = 885.115 (8.851,15 lei)
    //   PRE-cap   exclVat = 731.500 - (500.000 - 38.500) = 270.000 (2.700,00 lei)  [as RECORDED]
    //             inclVat = 885.115 - (595.000 - 46.585) = 336.700 (3.367,00 lei)
    // Protocol at 2 %, struck on the PRE-cap base — OPERATIVE since TASK 2d:
    //   exclVat = floor(270.000 x 2 / 100) = floor(5.400)      =  5.400 bani = 54,00 lei
    //   inclVat = floor(336.700 x 2 / 100) = floor(6.734)      =  6.734 bani = 67,34 lei
    // The post-cap alternative — computed, surfaced, NOT applied:
    //   exclVat = floor(731.500 x 2 / 100) = floor(14.630)     = 14.630 bani = 146,30 lei
    //   inclVat = floor(885.115 x 2 / 100) = floor(17.702,30)  = 17.702 bani = 177,02 lei
    //   allowed = min(100.000, 5.400) = 5.400 · min(119.000, 6.734) = 6.734
    //   expensesNet = 38.500 + 5.400  = 43.900 bani = 439,00 lei   (was 531,30 lei post-cap)
    //   expenses    = 46.585 + 6.734 = 53.319 bani = 533,19 lei   (was 642,87 lei post-cap)
    // Cross-check: the drop equals the two ceilings apart —
    //   531,30 - 439,00 = 92,30 = 146,30 - 54,00 · 642,87 - 533,19 = 109,68 = 177,02 - 67,34.
    const o = amounts(
      run([
        expense({ id: 'p', category: 'protocol' }),
        expense({ id: 'q', category: 'mandatory_professional_contribution', valoareFaraTva: lei(5000), tva: lei(950) }),
      ]),
    );
    expect(o.amounts.expensesNet).toBe(lei(439));
    expect(o.amounts.expenses).toBe(lei(533.19));
    const adj = o.capAdjustments.find((a) => a.category === 'protocol')!;
    // `base` is the base the ceiling was ACTUALLY struck on; `baseAlt` is the reading not applied.
    expect(adj.base).toEqual({ inclVat: lei(3367), exclVat: lei(2700) });
    expect(adj.baseAlt).toEqual({ inclVat: lei(8851.15), exclVat: lei(7315) });
    expect(adj.ceiling).toEqual({ inclVat: lei(67.34), exclVat: lei(54) });
    const alt = adj.ceilingAlt ?? { inclVat: lei(0), exclVat: lei(0) };
    expect(adj.ceilingAlt).toEqual({ inclVat: lei(177.02), exclVat: lei(146.3) });
    expect(adj.allowed).toEqual({ inclVat: lei(67.34), exclVat: lei(54) });
    // The direction, pinned. The PRE-cap reading subtracts the RECORDED lit. q) amount, which is LARGER
    // than the allowed one, so it leaves a SMALLER base and a SMALLER allowance: 54,00 lei applied vs
    // 146,30 lei under the post-cap reading. Smaller allowance = less deduction = it can never produce
    // an underpayment. (Brief 17's decision table had this direction inverted; phase doc 15 §5.4
    // corrected it, and TASK 2d now chooses the smaller one deliberately.)
    expect(adj.ceiling.exclVat).toBeLessThan(alt.exclVat);
    expect(adj.ceiling.inclVat).toBeLessThan(alt.inclVat);
  });

  it('the alternative ceiling travels on the result object for BOTH alin. (6) letters', () => {
    // TASK 2d's condition is that the flip is never silent. `baseAlt` / `ceilingAlt` are not scratch
    // values: they ride on every art. 68 alin. (6) adjustment inside `EstimateOperands.capAdjustments`,
    // which is what `Expenses.tsx` renders. Pinned here as part of the RESULT, not as an internal
    // intermediate — and for both letters, because a partial surfacing would hide one ceiling's delta.
    // Derived by hand, bani. Adding burse private 2.000,00 / 380,00 lei to the fixture above:
    //   operative base (PRE-cap)  exclVat = 770.000 - 500.000 = 270.000 · inclVat = 931.700 - 595.000 = 336.700
    //   alternative base (POST)   exclVat = 731.500                       · inclVat = 885.115
    //   burse 5 % applied   exclVat = floor(270.000 x 5 / 100) = 13.500 = 135,00 lei
    //                     inclVat = floor(336.700 x 5 / 100) = 16.835 = 168,35 lei
    //   burse 5 % alternative exclVat = floor(731.500 x 5 / 100) = 36.575 = 365,75 lei
    //                           inclVat = floor(885.115 x 5 / 100) = floor(44.255,75) = 44.255 = 442,55 lei
    //   expensesNet = 38.500 + 5.400 + 13.500 = 57.400 bani = 574,00 lei
    //   expenses    = 46.585 + 6.734 + 16.835 = 70.154 bani = 701,54 lei
    const o = run([
      expense({ id: 'p', category: 'protocol' }),
      expense({ id: 'b', category: 'private_scholarship', valoareFaraTva: lei(2000), tva: lei(380) }),
      expense({ id: 'q', category: 'mandatory_professional_contribution', valoareFaraTva: lei(5000), tva: lei(950) }),
    ]);
    if (o.kind !== 'run') throw new Error('expected the estimate to run');
    expect(o.capAdjustments).toHaveLength(3);
    expect(o.amounts.expensesNet).toBe(lei(574));
    expect(o.amounts.expenses).toBe(lei(701.54));
    const struck = o.capAdjustments.filter(a => a.cap.base === 'art68_alin6_base');
    expect(struck).toHaveLength(2);
    for (const ruleId of ['EXPENSE_PROTOCOL_2026', 'EXPENSE_PRIVATE_SCHOLARSHIP_2026']) {
      const adj = struck.find(a => a.ruleId === ruleId)!;
      // Present, not merely computed: the alternative is a field of the result the UI reads.
      expect(adj.base, ruleId).toBeDefined();
      expect(adj.baseAlt, ruleId).toBeDefined();
      expect(adj.ceilingAlt, ruleId).toBeDefined();
      // The alternative base is the post-cap one, and it is never smaller than the operative one.
      expect(adj.baseAlt!.exclVat, ruleId).toBe(lei(7315));
      expect(adj.baseAlt!.inclVat, ruleId).toBe(lei(8851.15));
      expect(adj.base!.exclVat, ruleId).toBe(lei(2700));
      expect(adj.base!.inclVat, ruleId).toBe(lei(3367));
      expect(adj.ceilingAlt!.exclVat, ruleId).toBeGreaterThan(adj.ceiling.exclVat);
      expect(adj.ceilingAlt!.inclVat, ruleId).toBeGreaterThan(adj.ceiling.inclVat);
    }
    // The two letters still share ONE base object — the flip did not reintroduce an iteration.
    expect(struck[0].base).toEqual(struck[1].base);
    expect(struck[0].baseAlt).toEqual(struck[1].baseAlt);
  });

  it('with no other alin. (5) cap the two readings coincide, and the alternative is still surfaced', () => {
    // Protocol alone: nothing else carries an alin. (5) ceiling, so recorded == allowed and the two
    // readings give the same number. The alternative must still be PRESENT (not omitted) — the UI
    // renders whatever is on the record, and an absent field would read as "no alternative exists".
    //   base = 770.000 - 0 = 770.000 exclVat · 931.700 inclVat; 2 % -> 15.400 / 18.634 bani
    const o = amounts(run([expense({ id: 'p', category: 'protocol' })]));
    const adj = o.capAdjustments[0];
    expect(adj.base).toEqual(adj.baseAlt);
    expect(adj.ceiling).toEqual(adj.ceilingAlt);
    expect(adj.ceiling).toEqual({ inclVat: lei(186.34), exclVat: lei(154) });
  });
});

describe('TASK 2c — decision 5: the annual ceiling is struck on the ANNUAL figure, not the YTD one', () => {
  it('the YTD deductible is bounded by the ANNUAL ceiling, which a YTD-struck ceiling would fail', () => {
    // 2026-10-31 -> elapsedMonths = 9 + 31/31 = 10 -> every annual figure is YTD x 1,2. This is the same
    // clock the e2e dashboard spec pins, so the fixture's revenues are actually in period.
    // protocol 300,00 lei, no VAT.
    //   projected gross (excl) = 770.000 / 10 x 12 =   924.000 bani =  9.240,00 lei
    //   base                   = 924.000 - 0        =   924.000 bani
    //   ANNUAL ceiling         = floor(924.000 x 2 / 100) = 18.480 bani = 184,80 lei
    //   claimed annual         = 30.000 / 10 x 12   =    36.000 bani =   360,00 lei
    //   allowed annual         = min(36.000, 18.480) =  18.480 bani =   184,80 lei  -> amounts.expensesNet
    //   allowed actual (YTD)   = min(30.000, 18.480) =  18.480 bani =   184,80 lei  -> basis.actual
    // THE DISCRIMINATOR. If the ceiling were struck on the YTD base instead:
    //   YTD ceiling = floor(770.000 x 2 / 100) = 15.400 bani = 154,00 lei
    //   allowed actual = min(30.000, 15.400) = 15.400 bani = 154,00 lei  <- this test would fail.
    // Note the PROJECTED figure is 184,80 lei under BOTH implementations: min() and the x 1,2 scaling
    // commute, so a uniform run rate hides the wrong basis in the headline number. `basis.actual` is what
    // exposes it — which is exactly why the basis decision is written down and pinned here.
    const o = amounts(
      run([expense({ category: 'protocol', valoareFaraTva: lei(300), tva: lei(0) })], E2E_CLOCK),
    );
    expect(o.basis.kind).toBe('annual-projected');
    expect(o.basis.elapsedMonths).toBe(10);
    expect(o.amounts.expensesNet).toBe(lei(184.8));
    expect(o.basis.actual.expensesNet).toBe(lei(184.8)); // NOT lei(154)
    // incl measure: projected gross 931.700 / 10 x 12 = 1.118.040; base 1.118.040;
    //   ceiling = floor(1.118.040 x 2 / 100) = floor(22.360,8) = 22.360 bani = 223,60 lei
    //   claimed annual incl = 36.000 -> allowed 22.360; allowed actual incl = min(30.000, 22.360) = 22.360
    expect(o.amounts.expenses).toBe(lei(223.6));
    expect(o.basis.actual.expenses).toBe(lei(223.6));
    expect(o.capAdjustments[0].claimed).toEqual({ inclVat: lei(360), exclVat: lei(360) });
    expect(o.capAdjustments[0].ceiling).toEqual({ inclVat: lei(223.6), exclVat: lei(184.8) });
  });

  it('a YTD claim inside the ANNUAL ceiling is allowed whole — a YTD-struck ceiling would cut it', () => {
    // The same clock, protocol 170,00 lei. This is the case where the two bases disagree about whether
    // the cap bites at all, not merely about by how much.
    //   ANNUAL ceiling (excl) = 18.480 bani; claimed YTD = 17.000 bani -> allowed actual = 17.000 = 170,00 lei
    //   YTD ceiling           = 15.400 bani; claimed YTD = 17.000 bani -> allowed actual = 15.400 = 154,00 lei
    //   claimed annual = 17.000 x 1,2 = 20.400 -> allowed annual = min(20.400, 18.480) = 18.480 = 184,80 lei
    //   incl measure has its OWN, larger ceiling: base 1.118.040 -> floor(22.360,8) = 22.360 = 223,60 lei,
    //   and claimed annual incl = 20.400 < 22.360, so the incl measure is allowed whole: 204,00 lei.
    const o = amounts(
      run([expense({ category: 'protocol', valoareFaraTva: lei(170), tva: lei(0) })], E2E_CLOCK),
    );
    expect(o.amounts.expensesNet).toBe(lei(184.8));
    expect(o.basis.actual.expensesNet).toBe(lei(170)); // NOT lei(154)
    expect(o.amounts.expenses).toBe(lei(204));
    expect(o.basis.actual.expenses).toBe(lei(170));
  });

  it('in the first days of the year the projection floors its denominator at 1, and the ceiling follows the projection', () => {
    // 2026-01-05 -> elapsedMonths = 5/31 = 0,16, but `selectProjectionV1` uses
    // `denom = months > 0 ? Math.max(1, months) : 0`, so the annual figure is YTD x 12. The ceiling is
    // struck on THAT annual figure, and the YTD deductible is bounded by it — not by a 0,16-month ceiling.
    // One revenue of 1.000,00 / 190,00 lei dated 2026-01-03 and protocol of 1.000,00 lei, no VAT.
    //   projected gross (excl) = 100.000 x 12 = 1.200.000; base = 1.200.000
    //   ANNUAL ceiling = floor(1.200.000 x 2 / 100) = 24.000 bani = 240,00 lei
    //   claimed annual = 100.000 x 12 = 1.200.000 -> allowed annual = 24.000 bani
    //   allowed actual = min(100.000, 24.000) = 24.000 bani = 240,00 lei
    // A YTD-struck ceiling would give floor(100.000 x 2 / 100) = 2.000 bani and cap the actual at
    // 20,00 lei — this assertion fails under that implementation.
    //   incl measure: projected gross 119.000 x 12 = 1.428.000; ceiling floor(28.560) = 28.560 =
    //   285,60 lei; claimed annual incl 1.200.000 -> allowed 28.560; allowed actual incl = 28.560.
    const o = amounts(
      run(
        [expense({ category: 'protocol', date: '2026-01-04', valoareFaraTva: lei(1000), tva: lei(0) })],
        '2026-01-05',
        [revenue()],
      ),
    );
    expect(o.basis.kind).toBe('annual-projected');
    expect(o.amounts.expensesNet).toBe(lei(240));
    expect(o.basis.actual.expensesNet).toBe(lei(240)); // NOT lei(20)
    expect(o.amounts.expenses).toBe(lei(285.6));
    expect(o.basis.actual.expenses).toBe(lei(285.6));
  });
});

describe('TASK 2c — the caps the app must NOT compute', () => {
  it('a euro cap contributes nothing: no BNR rate is stored and no rate may be invented', () => {
    const o = run([expense({ category: 'private_pension_contribution', date: '2026-03-15' })]);
    if (o.kind !== 'run') throw new Error('expected the estimate to run');
    expect(o.capAdjustments).toHaveLength(0);
    expect(o.deductible.annualCapped).toHaveLength(0);
    expect(o.amounts.expensesNet).toBe(lei(0));
    expect(o.deductible.excluded[0].detail).toContain('nu stochează niciun curs BNR');
  });

  it('cheltuieli sociale contributes nothing, and the ceiling is not declared zero', () => {
    const o = run([expense({ category: 'social_expenses' })]);
    if (o.kind !== 'run') throw new Error('expected the estimate to run');
    expect(o.capAdjustments).toHaveLength(0);
    expect(o.amounts.expensesNet).toBe(lei(0));
    expect(o.deductible.excluded[0].detail).toContain('nu este declarat 0');
  });

  it('the one-car-per-person limit is not enforced: the 50 % haircut applies to every record, no car is picked', () => {
    // art. 68 alin. (5) lit. j) would restrict which car may carry costs at all, and no primary source
    // selects it (research 22 §5). The 50 % haircut of alin. (7) lit. k) needs no such selection, so it
    // is the only vehicle limit this build applies. Two cars therefore both get the haircut — that is
    // the honest behaviour, not an enforcement of a limit the law does not let the app apply.
    const o = amounts(
      run([
        expense({ id: 'masina-1', category: 'vehicle_related', valoareFaraTva: lei(1000), tva: lei(0) }),
        expense({ id: 'masina-2', category: 'vehicle_related', valoareFaraTva: lei(2000), tva: lei(0) }),
      ]),
    );
    //   50 % of 1.000,00 = 500,00 lei; 50 % of 2.000,00 = 1.000,00 lei; total 1.500,00 lei.
    expect(o.deductible.records).toHaveLength(2);
    expect(o.amounts.expensesNet).toBe(lei(1500));
    expect(o.capAdjustments).toHaveLength(0); // no annual ceiling was struck
  });
});
