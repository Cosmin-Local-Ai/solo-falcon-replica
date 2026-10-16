/**
 * B-65 / brief 76 — the two ceilings on the unamortised residual of a disposed asset.
 *
 * Titlul II norm pct. 27: „la momentul scăderii din gestiune a mijloacelor de transport din categoria M1,
 * valoarea rămasă neamortizată este deductibilă în limita a 1.500 lei înmulţită cu numărul de luni rămase de
 * amortizat din durata normală de funcţionare stabilită de contribuabil".
 *
 * Titlul IV norm pct. 7 alin. (5) lit. o) caps **the same residual a second time**, „la nivelul venitului
 * realizat din înstrăinare" — the proceeds of the disposal.
 *
 * Brief 74 implemented the first and deliberately did not post the figure, because nothing in the app held
 * the second: posting pct. 27's number would over-deduct every time the asset sold for less than it was still
 * worth, which is the ordinary case. `FixedAsset.disposalProceeds` (chain step v23→v24) is the fact that
 * makes the second limit measurable. These tests pin the four states that follow.
 *
 * **B-153 is closed (brief 80, D-DEPR-1).** The schedule now stops in the month the asset leaves the
 * register, so the schedule and the residual use one month count. The pre-fix state — a 2026 row of twelve
 * months against a residual counted on ten — is asserted below as the disagreement, not left as a comment.
 *
 * The fixture is the one `depreciation.test.ts` uses: *punerea în funcțiune* on 31 Decembrie 2025, so
 * amortisation starts in Ianuarie 2026 and whole calendar years are easy to read. 120.000 lei over 48 months
 * liniară is 2.500 lei/lună.
 */
import { describe, expect, it } from 'vitest';
import { lei, type Bani } from '../money';
import { depreciationSchedule, FISCAL_DEPRECIATION_RULE_ID } from './depreciation';
import type { FixedAssetFacts } from './depreciation';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';

const rule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === FISCAL_DEPRECIATION_RULE_ID)!;
const L = (amountInLei: number): Bani => lei(amountInLei);

const disposed = (over: Partial<FixedAssetFacts> = {}): FixedAssetFacts => ({
  label: 'Autoturism vândut',
  entryDate: '2025-12-10',
  putInFunctionDate: '2025-12-31',
  fiscalValue: L(120000),
  normalLifeMonths: 48,
  method: 'liniar',
  acquisition: 'cumparare',
  paymentState: 'achitat',
  isM1Vehicle: true,
  disposedOn: '2027-12-31',
  disposalKind: 'vanzare',
  ...over,
});

/**
 * The shared arithmetic, so no expected figure below is a magic number.
 * Ianuarie 2026 through Decembrie 2027 is 24 months at 2.500 lei → 60.000 lei amortised, 60.000 lei
 * unamortised; 48 − 24 = 24 months left → the pct. 27 ceiling is 1.500 × 24 = 36.000 lei.
 */
function computed(over: Partial<FixedAssetFacts> = {}) {
  const out = depreciationSchedule(rule, disposed(over));
  if (out.status !== 'computed' || out.disposal === undefined) throw new Error('expected a computed disposal');
  return out.disposal;
}

describe('the two ceilings on the unamortised residual — pct. 27 and pct. 7 alin. (5) lit. o)', () => {
  it('with no proceeds recorded, only the pct. 27 ceiling is measurable, and the figure says so', () => {
    const d = computed();
    expect(d.unamortised).toBe(L(60000));
    expect(d.remainingMonths).toBe(24);
    expect(d.cap).toBe(L(36000));
    // The second limit exists in the norm and cannot be measured. `null`, not zero: a zero proceeds figure
    // would be a sale for nothing, which is a different fact and a much lower ceiling.
    expect(d.proceeds).toBeNull();
    expect(d.proceedsCap).toBeNull();
    expect(d.complete).toBe(false);
    expect(d.deductible).toBe(L(36000));
    expect(d.bound).toBe('pct-27');
  });

  it('proceeds BELOW the pct. 27 ceiling bind, and that is the case the old figure over-deducted', () => {
    // Sold for 20.000 lei. pct. 27 alone would have allowed 36.000 lei of deduction against an asset that
    // brought in 20.000 — 16.000 lei more than Titlul IV permits.
    const d = computed({ disposalProceeds: L(20000) });
    expect(d.proceedsCap).toBe(L(20000));
    expect(d.complete).toBe(true);
    expect(d.deductible).toBe(L(20000));
    expect(d.bound).toBe('proceeds');
    expect(d.capped).toBe(true);
    expect(d.lost).toBe(L(40000));
  });

  it('proceeds ABOVE the pct. 27 ceiling leave pct. 27 as the binding one', () => {
    const d = computed({ disposalProceeds: L(100000) });
    expect(d.proceedsCap).toBe(L(100000));
    expect(d.complete).toBe(true);
    expect(d.deductible).toBe(L(36000));
    expect(d.bound).toBe('pct-27');
  });

  it('a residual under BOTH ceilings is not capped at all', () => {
    // 12.000 lei over 24 months = 500 lei/lună; 24 months used amortises it fully, so dispose it after 12
    // months and 6.000 lei remain — under 1.500 × 12 = 18.000 and under any plausible sale price.
    const d = computed({
      fiscalValue: L(12000),
      normalLifeMonths: 24,
      disposedOn: '2026-12-31',
      disposalProceeds: L(9000),
    });
    expect(d.unamortised).toBe(L(6000));
    expect(d.cap).toBe(L(18000));
    expect(d.proceedsCap).toBe(L(9000));
    expect(d.deductible).toBe(L(6000));
    expect(d.bound).toBe('none');
    expect(d.capped).toBe(false);
    expect(d.lost).toBe(0);
  });

  it('zero proceeds is a recorded fact, not an absence', () => {
    // A gratuitous transfer or a write-off at nil. `complete` must be true and the ceiling nil, because
    // treating 0 as "not recorded" would let the pct. 27 figure through on an asset that brought in nothing.
    const d = computed({ disposalProceeds: L(0) });
    expect(d.proceedsCap).toBe(L(0));
    expect(d.complete).toBe(true);
    expect(d.deductible).toBe(L(0));
    expect(d.bound).toBe('proceeds');
    expect(d.lost).toBe(L(60000));
  });
});

describe('B-153 — closed: the schedule and the residual use ONE month count', () => {
  /**
   * *punerea în funcțiune* 31.12.2025 → amortisation starts Ianuarie 2026. The car leaves the register on
   * 15 Octombrie 2026, so the 2026 row carries TEN months (Ianuarie–Octombrie) and the schedule stops there:
   * 10 × 2.500 = 25.000 lei amortised, 95.000 lei unamortised, 48 − 10 = 38 months left.
   *
   * The disposal figures are the same as before brief 80 — `disposalFigure` already clamped to the exit
   * month. What moved is the schedule: it used to charge twelve months and 30.000 lei for 2026, and the
   * next test pins that as the disagreement this fix removes.
   */
  it('the schedule stops in the exit month, and the residual counts exactly those months', () => {
    const out = depreciationSchedule(rule, disposed({ disposedOn: '2026-10-15' }));
    if (out.status !== 'computed' || out.disposal === undefined) throw new Error('expected a computed disposal');

    expect(out.truncatedByDisposal).toBe(true);
    expect(out.years.map((y) => y.fiscalYear)).toEqual([2026]);
    const y2026 = out.years[0]!;
    expect(y2026.months).toBe(10);
    expect(y2026.uncapped).toBe(L(25000)); // 10 × 2.500 — was 12 × 2.500 = 30.000
    expect(y2026.deductible).toBe(L(15000)); // art. 28 alin. (14): 1.500 × 10, was 1.500 × 12 = 18.000

    // THE ONE-COUNT ASSERTION. Everything the schedule charges, and nothing else, is what the residual is
    // measured against — the month count and the money, both.
    const chargedMonths = out.years.reduce((n, y) => n + y.months, 0);
    const chargedUncapped = out.years.reduce((n, y) => n + y.uncapped, 0);
    expect(out.disposal.remainingMonths).toBe(48 - chargedMonths);
    expect(out.disposal.unamortised).toBe(L(120000) - chargedUncapped);
    expect(out.disposal.remainingMonths).toBe(38);
    expect(out.disposal.unamortised).toBe(L(95000));
    expect(out.disposal.cap).toBe(L(57000)); // 1.500 × 38 — now the same 38 the schedule implies

    // The truncation is a reading, and the outcome says so on the record rather than presenting it as a rule.
    expect(out.notes.some((n) => n.includes('D-DEPR-1') && n.includes('luna următoare'))).toBe(true);
  });

  it('the same asset with no disposal charges twelve months in 2026 — that is the count that disagreed', () => {
    // This is the pre-fix behaviour, kept as an assertion: before brief 80 `depreciationSchedule` never
    // consulted `disposedOn`, so the disposed asset produced exactly this row (12 months, 30.000 lei) while
    // `disposalFigure` counted 10 months and 38 remaining. 48 − 12 = 36 ≠ 38: two counts, one asset.
    const open = depreciationSchedule(rule, disposed({ disposedOn: undefined }));
    if (open.status !== 'computed') throw new Error('expected a computed schedule');
    expect(open.truncatedByDisposal).toBe(false);
    const y2026 = open.years.find((y) => y.fiscalYear === 2026)!;
    expect(y2026.months).toBe(12);
    expect(y2026.uncapped).toBe(L(30000));
    expect(y2026.deductible).toBe(L(18000));
    expect(48 - y2026.months).not.toBe(38);
  });

  it('truncation reaches an asset only through `disposedOn`: an undisposed schedule is untouched', () => {
    // Brief 80 §4 — a figure moving on a non-disposed asset would be a regression, so the reach of the
    // change is pinned: the full 48-month schedule still runs to 2029 and still sums to the fiscal value.
    const open = depreciationSchedule(rule, disposed({ disposedOn: undefined }));
    if (open.status !== 'computed') throw new Error('expected a computed schedule');
    expect(open.years.reduce((n, y) => n + y.months, 0)).toBe(48);
    expect(open.years.reduce((n, y) => n + y.uncapped, 0)).toBe(L(120000));
    expect(open.disposal).toBeUndefined();
  });

  it('proceeds above the ceiling leave pct. 27 binding, on the one month count', () => {
    // `complete` means "both ceilings were measured", not "safe to post": the figure is still reported and
    // not posted, which is B-65's standing decision and no longer a month-count problem.
    const d = computed({ disposedOn: '2026-10-15', disposalProceeds: L(150000) });
    expect(d.complete).toBe(true);
    expect(d.deductible).toBe(d.cap);
    expect(d.cap).toBe(L(57000)); // 1.500 × 38 — the same 38 the truncated schedule implies
    expect(d.bound).toBe('pct-27');
  });

  it('an asset disposed before its first amortisation month charges nothing and leaves the full residual', () => {
    // *punerea în funcțiune* is 31 Decembrie 2025, so the first chargeable month is Ianuarie 2026. Sold on
    // 31 Decembrie 2025 — the month of punerea în funcțiune itself — the asset never had a chargeable month:
    // the honest schedule is an empty one, nothing was amortised, and the whole 120.000 lei is residual.
    const out = depreciationSchedule(rule, disposed({ disposedOn: '2025-12-31' }));
    if (out.status !== 'computed' || out.disposal === undefined) throw new Error('expected a computed disposal');
    expect(out.years).toEqual([]);
    expect(out.truncatedByDisposal).toBe(true);
    expect(out.disposal.unamortised).toBe(L(120000));
    expect(out.disposal.remainingMonths).toBe(48);
  });

  it('a disposal in the FIRST chargeable month charges exactly that month', () => {
    // The boundary on the other side: Ianuarie 2026 is the first month art. 28 alin. (12) lit. a) allows,
    // and the asset leaves the register inside it. One month is charged — 2.500 lei uncapped, 1.500 lei
    // after the alin. (14) ceiling — and the residual counts 47 months left, the same single month.
    const out = depreciationSchedule(rule, disposed({ disposedOn: '2026-01-05' }));
    if (out.status !== 'computed' || out.disposal === undefined) throw new Error('expected a computed disposal');
    expect(out.years.map((y) => [y.fiscalYear, y.months])).toEqual([[2026, 1]]);
    expect(out.years[0]!.uncapped).toBe(L(2500));
    expect(out.years[0]!.deductible).toBe(L(1500));
    expect(out.disposal.remainingMonths).toBe(47);
    expect(out.disposal.unamortised).toBe(L(117500));
  });
});
