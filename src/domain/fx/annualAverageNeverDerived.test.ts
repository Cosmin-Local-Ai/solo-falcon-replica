/**
 * B-137 / D-FX-6 — the one thing this codebase must never do, pinned as its own file.
 *
 * D-FX-6 decided that an open year stops refusing its euro ceilings. It did **not** decide that the app may
 * compute an annual average. The decision's own constraint, repeated in `docs/ai/USER_DECISIONS.md`:
 *
 * > The app must never compute the annual average from daily rates. BNR's stated method is the arithmetic
 * > mean of the twelve **monthly** averages; a mean of dailies yields a different number.
 *
 * So this file exists for one reason: if a later change ever makes an annual average derivable, it has to
 * delete a test that says out loud why it must not be. Every test here is written so that the *derived*
 * number and the *recorded* number are different numbers — a change that quietly started averaging dailies
 * would not merely pass a weaker test, it would produce a different ceiling and fail this one.
 *
 * The fixture is built so the arithmetic is checkable by hand:
 *
 *   - twelve daily rates, one per month: 5,0000 for ianuarie-iulie (7 rows) and 6,0000 for august-decembrie
 *     (5 rows). Mean of the dailies = (7 x 5,0000 + 5 x 6,0000) / 12 = 65 / 12 = 5,4166666...
 *   - the annual average a person records instead: 5,3100 — BNR's own figure, whatever it happens to be.
 *
 * A 400-euro ceiling is 40 000 euro cents, so:
 *   - struck at the recorded average:  40 000 x 5,3100 = 212 400 bani  (2 124,00 lei)
 *   - struck at a mean of the dailies: 40 000 x 5,4166666... = 216 666,66... -> 216 667 bani (2 166,67 lei)
 *
 * Those are 42,67 lei apart. That gap is the whole point of the file.
 */
import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js-light';
import { RateStore, fixtureRateProvider, manualAnnualAverage, type RateCurrency } from './provider';
import { capMoney, strikeCapCeiling } from './capCeiling';
import { convertToRon } from './convert';
import { majorToMinor, money } from '../money';
import type { FxRateRecord } from './rates';

const YEAR = 2026;
const CURRENCY: RateCurrency = 'EUR';

/** A daily reference rate for `month` of 2026, at `rate`. Validation-clean. */
function daily(rate: string, month: number): FxRateRecord {
  const mm = String(month).padStart(2, '0');
  return {
    currency: CURRENCY,
    rate,
    rateKind: 'daily_reference',
    rateDate: `${YEAR}-${mm}-05`,
    seriesCode: 'CURSZ_EUR',
    sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
    fetchedAt: `${YEAR}-${mm}-05T14:00:00Z`,
    provisional: false,
    entryMode: 'fetched',
  };
}

/**
 * The twelve dailies. Seven at 5,0000 and five at 6,0000 — deliberately not all equal, because a set of
 * identical dailies would let a mean coincide with a plausible published average and hide the defect.
 */
const DAILIES: FxRateRecord[] = [
  daily('5.0000', 1), daily('5.0000', 2), daily('5.0000', 3), daily('5.0000', 4),
  daily('5.0000', 5), daily('5.0000', 6), daily('5.0000', 7),
  daily('6.0000', 8), daily('6.0000', 9), daily('6.0000', 10),
  daily('6.0000', 11), daily('6.0000', 12),
];

/** The figure a person reads off BNR's own annual table and types in. Not the mean of the dailies. */
const RECORDED_AVERAGE = '5.3100';

/** The mean of the dailies, computed HERE in the test — never by the app — to name the wrong answer. */
const MEAN_OF_DAILIES = DAILIES
  .reduce((sum, r) => sum.plus(new Decimal(r.rate)), new Decimal(0))
  .div(DAILIES.length);

const CAP_400_EUR = capMoney(CURRENCY, 400);
const ONE_PAYMENT = ['2026-06-05'];

function storeWithDailies(): RateStore {
  const store = new RateStore();
  for (const r of DAILIES) {
    const added = store.add(r);
    if (!added.ok) throw new Error(`fixture daily rejected: ${JSON.stringify(added.problems)}`);
  }
  return store;
}

describe('the app never derives an annual average from daily rates (B-137, D-FX-6)', () => {
  it('a store holding every monthly rate of the year still has no annual average for it', () => {
    const store = storeWithDailies();
    expect(store.size).toBe(12);
    // The lookup is a lookup. Twelve daily rows for 2026 answer nothing about the 2026 average.
    expect(store.annualAverage(CURRENCY, YEAR)).toBeNull();
    // And loading them did not quietly mint an `annual_average` record on the way in.
    expect(store.all().filter(r => r.rateKind === 'annual_average')).toHaveLength(0);
  });

  it('the ceiling refuses, and the refusal says it will not average the dailies it is holding', () => {
    const attempt = strikeCapCeiling({ cap: CAP_400_EUR, paymentDates: ONE_PAYMENT, provider: storeWithDailies() });
    expect(attempt.ok).toBe(false);
    if (attempt.ok) return;
    expect(attempt.reason).toBe('no_rate');
    expect(attempt.paymentYear).toBe(YEAR);
    expect(attempt.detail).toContain('nu se calculează din cursurile zilnice');
    // Strengthened for B-137: the refusal names how much it is refusing to use, so it reads as a decision
    // and not as a gap in coverage. This is persona 11's situation exactly.
    expect(attempt.dailyRatesHeld).toBe(12);
  });

  it('a provider that cannot enumerate its daily rates still refuses, and simply reports no count', () => {
    // `dailyRates` is not part of the minimal `FxRateProvider` contract. The count must not become a
    // reason to widen the contract, and a bare provider must still be refused.
    const bare = fixtureRateProvider(DAILIES);
    const minimal = {
      dailyRate: (c: RateCurrency, d: string) => bare.dailyRate(c, d),
      annualAverage: (c: RateCurrency, y: number) => bare.annualAverage(c, y),
    };
    const attempt = strikeCapCeiling({ cap: CAP_400_EUR, paymentDates: ONE_PAYMENT, provider: minimal });
    expect(attempt.ok).toBe(false);
    if (attempt.ok) return;
    expect(attempt.reason).toBe('no_rate');
    expect(attempt.dailyRatesHeld).toBeUndefined();
  });

  it('the ceiling struck from a recorded average is NOT the number a mean of the dailies would give', () => {
    // The load-bearing test. If anything ever starts deriving the average, this ceiling moves.
    const store = storeWithDailies();
    const entered = manualAnnualAverage({
      currency: CURRENCY,
      rate: RECORDED_AVERAGE,
      year: YEAR,
      seriesCode: 'CURSA_EURM',
      sourceUrl: 'https://www.bnr.ro/1975-cursul-de-schimb-serii-statistice',
      enteredAt: '2026-10-15T09:00:00Z',
    });
    if (!entered.ok) throw new Error(`manual average refused: ${JSON.stringify(entered.problems)}`);
    store.replace(entered.record);

    const attempt = strikeCapCeiling({ cap: CAP_400_EUR, paymentDates: ONE_PAYMENT, provider: store });
    if (!attempt.ok) throw new Error('expected the recorded average to strike the ceiling');

    const derivedCeiling = new Decimal(CAP_400_EUR.amount).times(MEAN_OF_DAILIES).toNumber();
    expect(attempt.strike.ceiling).toBe(212_400);
    expect(attempt.strike.applied.rate).toBe(RECORDED_AVERAGE);
    // The wrong answer, named so it cannot be mistaken for the right one later.
    expect(attempt.strike.ceiling).not.toBe(Math.round(derivedCeiling));
    expect(derivedCeiling).toBeCloseTo(216_666.67, 1);
  });

  it('the conversion layer refuses the same way, whatever the register holds', () => {
    const result = convertToRon(
      money(majorToMinor(400, CURRENCY), CURRENCY),
      { basis: 'payment_year_annual_average', paymentYear: YEAR },
      storeWithDailies(),
    );
    if (result.ok || result.reason !== 'no_rate') throw new Error('expected a no_rate refusal');
    expect(result.detail).toContain('oricâte cursuri zilnice ar exista în registru');
  });

  it('only one place in the fx layer can create an annual-average record, and it is a human typing one', () => {
    // The structural half of the pin, in the same idiom `ui/copy/copy.guard.test.ts` uses (Vite raw glob,
    // not `node:fs`). `rateKind: 'annual_average'` as a *constructed* record appears exactly once in the
    // whole layer — inside `manualAnnualAverage`, which takes the figure as an argument. A second
    // occurrence means somebody added a second way for an annual average to come into existence, and the
    // only ways that is legitimate are "BNR published it" and "a person typed it".
    const sources = Object.entries(
      import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
    ).filter(([path]) => !/\.test\.ts$/.test(path));
    expect(sources.length).toBeGreaterThan(5);

    const constructed = sources.flatMap(([path, src]) =>
      src
        .split('\n')
        .map((line, i) => ({ where: `${path}:${i + 1}`, line }))
        .filter(({ line }) => /rateKind:\s*'annual_average'/.test(line)),
    );
    const files = [...new Set(constructed.map(c => c.where.split(':')[0]))];
    expect(files).toEqual(['./provider.ts']);
    expect(constructed).toHaveLength(1);
  });
});

describe('the provisional -> final lifecycle is a replacement, not a computation', () => {
  it('recording the published figure replaces the provisional one under the same key and changes the number', () => {
    const store = storeWithDailies();
    const provisional = manualAnnualAverage({
      currency: CURRENCY, rate: RECORDED_AVERAGE, year: YEAR,
      seriesCode: 'CURSA_EURM',
      sourceUrl: 'https://www.bnr.ro/1975-cursul-de-schimb-serii-statistice',
      enteredAt: '2026-10-15T09:00:00Z',
    });
    if (!provisional.ok) throw new Error('provisional entry refused');
    store.replace(provisional.record);

    const before = strikeCapCeiling({ cap: CAP_400_EUR, paymentDates: ONE_PAYMENT, provider: store });
    if (!before.ok) throw new Error('provisional ceiling should strike');
    expect(before.strike.provisional).toBe(true);

    // BNR publishes the year's average after the year closes. The same anchor, now final.
    store.replace({ ...provisional.record, rate: '5.4000', provisional: false, fetchedAt: '2027-01-15T09:00:00Z' });

    const after = strikeCapCeiling({ cap: CAP_400_EUR, paymentDates: ONE_PAYMENT, provider: store });
    if (!after.ok) throw new Error('final ceiling should strike');
    expect(after.strike.provisional).toBe(false);
    expect(after.strike.ceiling).toBe(216_000);
    // Replaced, not appended: one annual average per (currency, year), or the lookup would have to choose.
    expect(store.all().filter(r => r.rateKind === 'annual_average' && r.rateYear === YEAR)).toHaveLength(1);
    // The dailies are still there, untouched, and still answer nothing about the average.
    expect(store.dailyRates(CURRENCY)).toHaveLength(12);
  });
});
