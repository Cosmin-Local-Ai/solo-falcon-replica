import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js-light';
import {
  Bani,
  BANIS_PER_LEI,
  lei,
  baniFromLei,
  roundArt66,
  sumBani,
  applyRateDecimal,
  formatBani,
  formatBaniRON,
  formatBaniLei,
  formatBaniOrDash,
  isBani,
} from './money';

/**
 * Phase 10 — the money representation and the art. 66 rounding policy.
 *
 * These are the assertions the whole phase exists to make. The boundary cases below are not arbitrary:
 * they are the exact cases on which the previous implementation disagreed with itself.
 */
describe('money — CF art. 66 alin. (1) rounding policy', () => {
  // „rotunjire la un leu, prin neglijarea fracțiunilor de până la 50 de bani inclusiv și majorarea la leu
  // a fracțiunilor ce depășesc 50 de bani."
  it('neglects a fraction of up to 50 bani INCLUSIVE, and majors anything above 50', () => {
    const cases: Array<[Decimal | number, number]> = [
      [0, 0],
      [lei(1) - 1, 100], // 99 bani → a whole leu
      [49, 0], // 0,49 lei → neglected
      [50, 0], // exactly 50 bani → „inclusiv" → neglected
      [51, 100], // 0,51 lei → majorated
      [lei(1), 100],
      [lei(1) + 49, 100], // 1,49 → 1
      [lei(1) + 50, 100], // 1,50 → 1 (tie goes down)
      [lei(1) + 51, 200], // 1,51 → 2
      [lei(2430), 243000], // an exact whole-lei sum is unchanged
      [lei(12150), 1215000],
    ];
    for (const [input, expected] of cases) {
      expect(roundArt66(input)).toBe(expected);
    }
  });

  it('rounds DOWN at exactly 50 bani, which is where Math.round is wrong', () => {
    // 674,50 lei is a true tie: the fraction is exactly 50 bani, so the law neglects it → 674 lei.
    expect(roundArt66(lei(674) + 50)).toBe(67400);
    // The obvious implementation gets the legal boundary backwards.
    expect(Math.round(674.5) * 100).toBe(67500);
    expect(roundArt66(lei(674) + 50)).not.toBe(Math.round(674.5) * 100);
  });

  it('rounds the UNROUNDED sum: the seeded 674,505 lei case becomes 675 lei, not 674', () => {
    // 10 % of the taxable base 6 745,05 lei. In bani: 674 505 × 10 / 100 = 67 450,5 bani.
    const incomeTaxBani = applyRateDecimal(lei(6745.05), 10);
    expect(incomeTaxBani.toString()).toBe('67450.5');
    // A fraction of 50,5 bani EXCEEDS 50 → majorated to the next leu.
    expect(roundArt66(incomeTaxBani)).toBe(67500);
    // Proving the order matters: truncating to integer bani first gives a different tax.
    expect(roundArt66(67450)).toBe(67400);
  });

  it('is idempotent on amounts that are already whole lei', () => {
    for (const amount of [lei(2430), lei(12150), lei(24300), lei(29160), lei(395000), 0]) {
      expect(roundArt66(amount)).toBe(amount);
    }
  });

  it('rejects a float instead of rounding it', () => {
    expect(() => roundArt66(674.505 as Bani)).toThrow(/integer number of bani/);
    expect(() => roundArt66(Number.NaN)).toThrow();
  });

  it('handles a negative sum on magnitude, restoring the sign', () => {
    // Convention, not law: art. 66 speaks of sums due. Pinned so the behaviour cannot drift silently.
    expect(roundArt66(-67450)).toBe(-67400);
    expect(roundArt66(-67451)).toBe(-67500);
  });
});

describe('money — the lei → bani unit conversion (migration path)', () => {
  it('converts every value with at most two decimals EXACTLY', () => {
    // These are the real stored values in seed data and tests. None of them may change value.
    const exact: Array<[number, number]> = [
      [750, 75000],
      [142.5, 14250], // the only fractional value round-tripped through save/load
      [85.5, 8550],
      [17.96, 1796],
      [25.2, 2520],
      [71.4, 7140],
      [523456.78, 52345678],
      [0, 0],
      [30000, 3000000],
    ];
    for (const [value, expected] of exact) {
      const result = baniFromLei(value);
      expect(result.bani).toBe(expected);
      expect(result.exact).toBe(true);
    }
  });

  it('does not inherit IEEE-754 noise: 71,4 × 100 is 7140, not 7140.000000000001', () => {
    // 71.4 is a real seed value (`expenses.e3.tva`). The float path lands off the integer:
    expect(71.4 * 100).toBe(7140.000000000001);
    // Decimal is built from the shortest decimal representation, so the conversion is exact.
    expect(baniFromLei(71.4).bani).toBe(7140);
    expect(baniFromLei(71.4).exact).toBe(true);
    // 1.005 is the sharper case: the float lands *below* the midpoint (100.49999999999999) while the true
    // decimal value is exactly 100.5. Decimal sees the real midpoint, so the answer comes from the stated
    // policy — half-DOWN — and not from which side of the midpoint the IEEE-754 error happened to fall on.
    expect(1.005 * 100).toBe(100.49999999999999);
    expect(baniFromLei(1.005).bani).toBe(100);
    expect(baniFromLei(1.005).exact).toBe(false);
  });

  it('flags a stored value with sub-ban precision instead of silently deciding', () => {
    const result = baniFromLei(674.505);
    expect(result.exact).toBe(false);
    // Half-DOWN, matching art. 66's „inclusiv" direction.
    expect(result.bani).toBe(67450);
    expect(baniFromLei(674.506).bani).toBe(67451);
    expect(baniFromLei(674.504).bani).toBe(67450);
  });

  it('never replaces an unconvertible value with 0', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, undefined as unknown as number]) {
      const result = baniFromLei(value);
      expect(result.bani).toBeNull();
      expect(result.exact).toBe(false);
    }
  });

  it('lei() accepts only literals that are a whole number of bani', () => {
    expect(lei(2430)).toBe(243000);
    expect(lei(85.5)).toBe(8550);
    expect(() => lei(85.555)).toThrow(/whole number of bani/);
  });
});

/** Test-local bani literal. The brand is deliberate: money must be named, not inferred. */
const b = (n: number): Bani => n as Bani;

describe('money — the single bani → display conversion performs NO rounding', () => {
  it('renders an integer number of bani exactly, with ro-RO grouping', () => {
    expect(formatBani(b(0))).toBe('0,00');
    expect(formatBani(b(1))).toBe('0,01');
    expect(formatBani(b(67450))).toBe('674,50');
    expect(formatBani(b(67451))).toBe('674,51');
    expect(formatBani(b(123456))).toBe('1.234,56');
    expect(formatBani(lei(291600))).toBe('291.600,00');
    expect(formatBani(lei(395000))).toBe('395.000,00');
    expect(formatBani(b(-2000000))).toBe('-20.000,00');
  });

  it('agrees with the ro-RO rendering the suite already expects, without using a rounding formatter', () => {
    for (const amount of [b(0), b(1), b(119000), b(123456), lei(9317), lei(7700), lei(156000), b(-2000000)]) {
      expect(formatBani(amount)).toBe(
        new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount / 100),
      );
    }
  });

  it('pins the B-17 disagreement to one value: the same stored money cannot render two ways', () => {
    // What the two old formatters did to the SAME double, 674.505 lei:
    const legacy = 674.505;
    const viaIntl = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(legacy);
    const viaToFixed = `${legacy.toFixed(2).replace('.', ',')}`;
    expect(viaIntl).toBe('674,51'); // round-half-even on the raw double → 674.50499999… → down
    expect(viaToFixed).toBe('674,50'); // round-half-up on the shortest repr → 674.505 → up
    expect(viaIntl).not.toBe(viaToFixed);

    // The legal answer is neither: art. 66 rounds to a whole leu.
    expect(formatBani(roundArt66(applyRateDecimal(lei(6745.05), 10)))).toBe('675,00');

    // And once money is an integer number of bani, the display path has no rounding policy left to disagree about.
    const stored = b(67450);
    const screen = formatBaniRON(stored);
    const csv = formatBani(stored);
    expect(screen).toBe('674,50 RON');
    expect(csv).toBe('674,50');
    expect(screen.replace(' RON', '')).toBe(csv);
  });

  it('refuses to display a float — a raw number cannot reach a screen', () => {
    expect(() => formatBani(674.505 as Bani)).toThrow(/integer number of bani/);
    expect(() => formatBaniRON(674.5 as Bani)).toThrow();
    expect(() => formatBaniLei(Number.NaN as Bani)).toThrow();
  });

  it('renders an unknown amount as an em dash, never as 0,00', () => {
    expect(formatBaniOrDash(null)).toBe('—');
    expect(formatBaniOrDash(undefined)).toBe('—');
    expect(formatBaniOrDash(b(0))).toBe('0,00');
  });
});

describe('money — representation invariants', () => {
  it('BANIS_PER_LEI is the only scale factor', () => {
    expect(BANIS_PER_LEI).toBe(100);
  });

  it('isBani accepts only safe integers', () => {
    expect(isBani(67450)).toBe(true);
    expect(isBani(67450.5)).toBe(false);
    expect(isBani(Number.NaN)).toBe(false);
    expect(isBani(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });

  it('sumBani refuses a float addend instead of accumulating noise', () => {
    expect(sumBani([lei(4500), lei(3200), b(0)])).toBe(lei(7700));
    expect(() => sumBani([674.505 as Bani])).toThrow(/integer number of bani/);
  });

  it('rate arithmetic stays exact in decimal and rounds only at the line boundary', () => {
    // 9 % VAT on 1 200 lei — the case that produced 107.99999… under float.
    expect(applyRateDecimal(lei(1200), 9).toString()).toBe('10800');
    // 10 % CASS on the VNA 7 494,50 lei → 749.45 lei, unrounded, exactly.
    expect(applyRateDecimal(lei(7494.5), 10).toString()).toBe('74945');
    expect(roundArt66(applyRateDecimal(lei(7494.5), 10))).toBe(74900);
  });
});

describe('money — `lei()` literals must not depend on IEEE-754 noise', () => {
  // 71.4 is a real seeded value (`expenses.e3.tva`). `71.4 * 100` is 7140.000000000001, so a float
  // multiply makes this literal throw while `lei(17.96)` passes. Whether a literal works must not
  // depend on which side the rounding noise falls, so scaling goes through Decimal.
  it('scales every two-decimal lei literal exactly', () => {
    for (const [amount, expected] of [
      [71.4, 7140],
      [17.96, 1796],
      [25.2, 2520],
      [85.5, 8550],
      [142.5, 14250],
      [7494.5, 749450],
      [6745.05, 674505],
      [523456.78, 52345678],
    ] as const) {
      expect(lei(amount)).toBe(expected);
    }
  });

  it('still refuses a literal with sub-ban precision', () => {
    expect(() => lei(0.005)).toThrow(/not a whole number of bani/);
    expect(() => lei(674.505)).toThrow(/not a whole number of bani/);
    expect(() => lei(Number.NaN)).toThrow(/finite/);
  });
});
