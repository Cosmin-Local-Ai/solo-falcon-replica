import { describe, it, expect } from 'vitest';
import {
  addMoney,
  eur,
  formatMoney,
  isRon,
  majorToMinor,
  maxMoney,
  money,
  moneyInputValue,
  MixedCurrencyError,
  parseMoneyInput,
  ron,
  subMoney,
  sumMoney,
  requireRon,
  type Money,
} from './money';

/**
 * TASK 10a — the money value carries its currency, and mixing currencies is a **compile** error.
 *
 * The point of these tests is not the arithmetic; it is that the arithmetic is unavailable. A runtime
 * guard would let `eur(100) + ron(490)` reach a user's screen as `590`. The type makes the expression
 * itself illegal, which is what the brief asks for: „Design it so cross-currency arithmetic is a type
 * error unless a conversion is explicit."
 *
 * Each illegal expression is pinned with `@ts-expect-error`. That is the only honest way to test a
 * compile error in a file that compiles: if the expression ever stops being an error, `tsc` fails on the
 * unused directive rather than the suite quietly keeping a green light for a guarantee that has gone.
 */

describe('Money — the value carries its currency', () => {
  it('a Money is an integer minor-unit amount plus the currency it is an amount OF', () => {
    expect(ron(1234.56)).toEqual({ amount: 123456, currency: 'RON' });
    expect(eur(1234.56)).toEqual({ amount: 123456, currency: 'EUR' });
    // Same minor-unit count, different facts. `123456` alone cannot tell them apart, which is exactly
    // the defect B-32 recorded.
    expect(ron(1234.56).amount).toBe(eur(1234.56).amount);
    expect(ron(1234.56)).not.toEqual(eur(1234.56));
  });

  it('refuses a non-integer minor-unit amount instead of rounding on the way in', () => {
    expect(() => money(1000.5 as never, 'RON')).toThrow();
    expect(() => ron(10.005)).toThrow();
  });

  it('isRon narrows only a RON amount', () => {
    expect(isRon(ron(5))).toBe(true);
    expect(isRon(eur(5))).toBe(false);
  });
});

describe('Money — cross-currency arithmetic does not compile', () => {
  it('refuses to add EUR to RON at the type level', () => {
    // @ts-expect-error — adding a RON amount to a EUR amount is not a legal expression.
    expect(() => addMoney(ron(100), eur(100))).toThrow(MixedCurrencyError);
  });

  it('refuses to subtract across currencies at the type level', () => {
    // @ts-expect-error — same rule on the other operator.
    expect(() => subMoney(ron(100), eur(40))).toThrow(MixedCurrencyError);
  });

  it('refuses to take a max across currencies at the type level', () => {
    // @ts-expect-error — "which is bigger" across currencies is not a question with an answer.
    expect(() => maxMoney(ron(100), eur(100))).toThrow(MixedCurrencyError);
  });

  it('adds same-currency amounts and keeps the currency on the result', () => {
    expect(addMoney(ron(10), ron(20))).toEqual(ron(30));
    expect(addMoney(eur(10), eur(20.5))).toEqual(eur(30.5));
    expect(subMoney(eur(30.5), eur(0.5))).toEqual(eur(30));
    expect(maxMoney(eur(3), eur(7))).toEqual(eur(7));
  });

  it('sums a list only when the currency is stated, and says so when it is not', () => {
    expect(sumMoney([eur(1), eur(2), eur(3)], 'EUR')).toEqual(eur(6));
    // An empty list has no currency to infer, so the caller must name one. This is not ceremony: an
    // inferred currency on an empty total is how a RON label ends up on a EUR column.
    expect(sumMoney([], 'EUR')).toEqual(eur(0));
    expect(() => sumMoney([eur(1)] as Money[], 'RON')).toThrow(MixedCurrencyError);
  });

  it('requireRon hands the engine a Bani only for a RON amount, and throws naming the currency otherwise', () => {
    expect(requireRon(ron(85.5))).toBe(8550);
    expect(() => requireRon(eur(85.5), 'expense e-3')).toThrow(/EUR/);
    // The throw is the boundary. It does NOT convert — converting here would pick a rate, and picking a
    // rate is a legal decision this layer is not allowed to make.
    expect(() => requireRon(eur(85.5))).toThrow(/cannot be read as lei/);
  });
});

describe('Money — formatting and entry are currency-aware', () => {
  it('formats with the currency it holds, never a hardcoded RON', () => {
    expect(formatMoney(ron(1234.56))).toBe('1.234,56 RON');
    expect(formatMoney(eur(1234.56))).toBe('1.234,56 EUR');
    expect(formatMoney(money(majorToMinor(5, 'USD'), 'USD'))).toBe('5,00 USD');
  });

  it('round-trips an input value through parseMoneyInput in the chosen currency', () => {
    expect(moneyInputValue(eur(1234.56))).toBe('1234.56');
    expect(moneyInputValue(eur(1000))).toBe('1000');
    expect(parseMoneyInput('1234.56', 'EUR')).toEqual(eur(1234.56));
    expect(parseMoneyInput('1234,56', 'EUR')).toEqual(eur(1234.56));
    expect(parseMoneyInput('0', 'USD')).toEqual(money(majorToMinor(0, 'USD'), 'USD'));
  });

  it('refuses sub-minor-unit input rather than rounding into the ledger', () => {
    expect(parseMoneyInput('85.555', 'EUR')).toBeNull();
    expect(parseMoneyInput('', 'EUR')).toBeNull();
    expect(parseMoneyInput('abc', 'EUR')).toBeNull();
  });
});
