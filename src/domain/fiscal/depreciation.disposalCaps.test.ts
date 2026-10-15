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
 * makes the second limit measurable. These tests pin the four states that follow, and pin B-153 as still
 * open — the schedule and the residual count different months, and adding the proceeds field does not fix
 * that.
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

describe('B-153 — still open: the schedule and the residual count different months', () => {
  it('the schedule still amortises past the disposal month while the residual counts only months used', () => {
    // *punerea în funcțiune* 31.12.2025 → amortisation starts Ianuarie 2026. The car leaves the register on
    // 15 Octombrie 2026. The 2026 schedule row still carries TWELVE months — Noiembrie and Decembrie are
    // amortised on an asset that was gone. The residual is computed from TEN months used.
    const out = depreciationSchedule(rule, disposed({ disposedOn: '2026-10-15' }));
    if (out.status !== 'computed' || out.disposal === undefined) throw new Error('expected a computed disposal');

    const y2026 = out.years.find((y) => y.fiscalYear === 2026)!;
    expect(y2026.months).toBe(12);
    // 48 declared − 10 used = 38 left. If the schedule had stopped at Octombrie the figure would be 36.
    expect(out.disposal.remainingMonths).toBe(38);
    // The two counts are pinned apart on purpose: this is the disagreement, not an accident of the fixture.
    expect(out.disposal.remainingMonths).not.toBe(48 - y2026.months);

    // And the money moves in both directions at once, which is why this is not a reporting nicety: the year
    // posts twelve months of amortisation while the residual is measured as if only ten had been taken.
    expect(y2026.uncapped).toBe(L(30000)); // 12 × 2.500
    expect(out.disposal.unamortised).toBe(L(95000)); // 120.000 − 10 × 2.500
  });

  it('adding the proceeds does NOT make the figure postable while B-153 stands', () => {
    // `complete` means "both ceilings were measured". It does not mean "safe to post", and the coverage row
    // says the month-count disagreement out loud rather than letting the new field imply the schedule is right.
    const d = computed({ disposedOn: '2026-10-15', disposalProceeds: L(150000) });
    expect(d.complete).toBe(true);
    expect(d.deductible).toBe(d.cap);
    expect(d.cap).toBe(L(57000)); // 1.500 × 38 — the count the schedule does not match
  });
});
