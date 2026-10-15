/**
 * TASK 10b — the euro ceilings in the rule package are struck by the assembler, and the provisional →
 * final lifecycle of the rate they are struck at is visible in the estimate itself.
 *
 * Every expected figure was derived BY HAND before the suite ran, with the arithmetic written out above
 * it. Nothing here was read off a failing diff.
 *
 * The seed's revenue side is the one `estimateBasis.annualCaps.test.ts` documents:
 *   revenues (VAT-inclusive, `inregistrata` only) = 931.700 bani = 9.317,00 lei
 *   revenuesNet (VAT-exclusive)                   = 770.000 bani = 7.700,00 lei
 *
 * THE FY2026 AVERAGE IS TEST SCAFFOLDING, NOT A LEGAL FIGURE. BNR publishes a year's average only after
 * the year closes, so no FY2026 average exists (research 23 §"What must stay unresolved" item 4, defect
 * B-33). The two FY2026 records below use round numbers, a non-BNR source URL and a series code that is
 * deliberately not the official one, so they cannot be mistaken for a publication. They exist to exercise
 * the provisional → final mechanism. If a test here had needed a real FY2026 average, the expectation
 * would have changed — never the rate.
 *
 * The FY2025 average (5,0415 lei) and the 2026-10-08 daily rate (5,3470 lei) ARE real published figures,
 * captured from BNR in `docs/ai/research/23_fx_conversion_and_bnr_rates_2026.md`.
 */
import { describe, expect, it } from 'vitest';
import { selectEstimateOperands, type AnnualCapAdjustment, type EstimateOperands } from './estimateBasis';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal';
import type { ExpenseCategory } from './fiscal/deductibility';
import type { FiscalRule } from './fiscal/rules';
import { RateStore } from './fx/provider';
import type { FxRateRecord } from './fx/rates';
import { seedData } from '../data/seed';
import type { AppData, Expense } from '../data/types';
import { lei, majorToMinor, money, ron, type Bani } from './money';

const YEAR_END = '2026-12-31';  // elapsedMonths = 12 → the projection is the identity
const E2E_CLOCK = '2026-10-31'; // elapsedMonths = 10 → every annual figure is YTD × 1,2

const BNR_SERIES_PAGE = 'https://www.bnr.ro/1975-cursul-de-schimb-serii-statistice';

/** Verified: the FY2025 EUR annual average as BNR prints it. */
const EUR_ANNUAL_2025: FxRateRecord = {
  currency: 'EUR', rate: '5.0415', rateKind: 'annual_average', rateYear: 2025,
  seriesCode: 'CURSA_EURM', sourceUrl: BNR_SERIES_PAGE, fetchedAt: '2026-10-08T09:00:00Z',
  provisional: false, entryMode: 'manual',
};

/** Verified: the daily reference rate BNR published for 2026-10-08. */
const EUR_DAILY_2026_10_08: FxRateRecord = {
  currency: 'EUR', rate: '5.3470', rateKind: 'daily_reference', rateDate: '2026-10-08',
  seriesCode: 'CURSZ_EUR', sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
  fetchedAt: '2026-10-08T13:05:00Z', provisional: false, entryMode: 'fetched',
};

/** TEST SCAFFOLDING — a hand-typed FY2026 average. No FY2026 average is published; see the header. */
const EUR_ANNUAL_2026_PROVISIONAL: FxRateRecord = {
  currency: 'EUR', rate: '5.3100', rateKind: 'annual_average', rateYear: 2026,
  seriesCode: 'CURSA_EURM-TEST', sourceUrl: 'https://example.invalid/hand-entered-test-average',
  fetchedAt: '2026-10-09T09:00:00Z', provisional: true, entryMode: 'manual',
};

/** TEST SCAFFOLDING — the same year after „BNR published it", for the provisional → final test. */
const EUR_ANNUAL_2026_FINAL: FxRateRecord = {
  ...EUR_ANNUAL_2026_PROVISIONAL, rate: '5.4000', provisional: false, fetchedAt: '2027-01-15T09:00:00Z',
};

/** Test scaffolding: the USD daily path is real (BNR's XML carries USD); this number is not a BNR figure. */
const USD_DAILY_2026_10_08: FxRateRecord = {
  currency: 'USD', rate: '4.5000', rateKind: 'daily_reference', rateDate: '2026-10-08',
  seriesCode: 'CURSZ_USD-PATTERN', sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
  fetchedAt: '2026-10-08T13:05:00Z', provisional: false, entryMode: 'fetched',
};

const usd = (major: number) => money(majorToMinor(major, 'USD'), 'USD');

function expense(over: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    tip: 'factura',
    nr: 'FCT-TEST-1',
    date: '2026-06-10',
    furnizor: 'Furnizor Test',
    cui: 'RO00000000',
    valoareFaraTva: ron(1000),
    tva: ron(190),
    status: 'inregistrata',
    ...over,
  };
}

function dataWith(expenses: Expense[], fxRates?: FxRateRecord[]): AppData {
  return { ...seedData, expenses, ...(fxRates ? { fxRates } : {}) };
}

function run(expenses: Expense[], fxRates?: FxRateRecord[], asOfDate = YEAR_END, rules = PFA_2026_SYSTEM_REAL_PACKAGE): EstimateOperands {
  return selectEstimateOperands(dataWith(expenses, fxRates), asOfDate, rules);
}

function mustRun(o: EstimateOperands): Extract<EstimateOperands, { kind: 'run' }> {
  if (o.kind !== 'run') throw new Error('expected the estimate to run');
  return o;
}

function euroAdjustment(o: EstimateOperands, ruleId: string): AnnualCapAdjustment {
  const found = mustRun(o).capAdjustments.find(a => a.ruleId === ruleId);
  if (!found) throw new Error(`${ruleId} struck no ceiling`);
  return found;
}

describe('TASK 10b — a euro ceiling with no rate stays unresolved, and says what is missing', () => {
  it('keeps the cap unresolved and names the payment year, the datum and the rule', () => {
    const set = run([expense({ category: 'private_pension_contribution', date: '2026-06-10' })]).deductible;
    expect(set.counts.capUnresolved).toBe(1);
    expect(set.counts.annualCapped).toBe(0);
    expect(set.records).toHaveLength(0);
    const detail = set.excluded[0].detail;
    expect(set.excluded[0].reason).toBe('cap_unresolved');
    // B-138 RE-PIN. This asserted the `CapBase` code inside the sentence — the suite pinned the leak as
    // correct behaviour. The base is now named in Romanian, and the code is asserted ABSENT.
    expect(detail).toContain('un plafon anual exprimat în euro pe persoană');
    expect(detail).not.toContain('annual_eur_per_person');
    expect(detail).toContain('anul plății 2026');
    expect(detail).toContain('nu stochează niciun curs BNR');
    expect(detail).toContain('pct. 7 alin. (6)');
    expect(detail).toContain('art. 9 alin. (3) lit. b)');
    expect(detail).toContain('media anuală nu se calculează din cursurile zilnice');
  });

  it('a daily rate is not a substitute for the annual average the rule asks for', () => {
    // The store holds the 2026-10-08 daily row and no 2026 average. pct. 7 alin. (6) names the average,
    // and BNR's own methodology (an average of the 12 monthly averages) forbids deriving one from dailies.
    const set = run(
      [expense({ category: 'sports_subscription', date: '2026-10-08' })],
      [EUR_DAILY_2026_10_08],
    ).deductible;
    expect(set.counts.capUnresolved).toBe(1);
    expect(set.counts.annualCapped).toBe(0);
  });

  it('a rate for another year is not a rate for this one', () => {
    const set = run(
      [expense({ category: 'sports_subscription', date: '2026-10-08' })],
      [EUR_ANNUAL_2025],
    ).deductible;
    expect(set.counts.capUnresolved).toBe(1);
    expect(set.excluded[0].detail).toContain('anul plății 2026');
  });
});

describe('TASK 10b — with a recorded average the seven euro ceilings become measurable', () => {
  it('the record is held for the assembler instead of excluded', () => {
    const set = run(
      [expense({ category: 'sports_subscription', date: '2026-10-08' })],
      [EUR_ANNUAL_2026_PROVISIONAL, EUR_DAILY_2026_10_08],
    ).deductible;
    expect(set.counts.annualCapped).toBe(1);
    expect(set.counts.capUnresolved).toBe(0);
    expect(set.excluded).toHaveLength(0);
    expect(set.annualCapped[0].euro).toBeDefined();
  });

  it('the ceiling is the euro figure at the annual average of the payment year, the same in both measures', () => {
    // 100 EUR (lit. r)) × 5,3100 = 531,00 lei = 53.100 bani. A ceiling is a lei amount, not a
    // VAT-sensitive one, so both money measures carry the identical number.
    const a = euroAdjustment(
      run(
        [expense({ category: 'sports_subscription', date: '2026-10-08' })],
        [EUR_ANNUAL_2026_PROVISIONAL, EUR_DAILY_2026_10_08],
      ),
      'EXPENSE_SPORTS_SUBSCRIPTION_2026',
    );
    expect(a.ceiling).toEqual({ inclVat: lei(531), exclVat: lei(531) });
    expect(a.euro?.cap).toEqual({ amount: 10000, currency: 'EUR' });
    expect(a.euro?.paymentYear).toBe(2026);
  });

  it('each of the seven letters converts at its own euro figure — 400, 400, 400, 400, 100, 4.000, 400', () => {
    // At 5,3100 lei/EUR: 400 EUR = 2.124,00 lei; 100 EUR = 531,00 lei; 4.000 EUR = 21.240,00 lei.
    const cases: Array<[ExpenseCategory, string, Bani]> = [
      ['private_pension_contribution', 'EXPENSE_PRIVATE_PENSION_2026', lei(2124)],
      ['occupational_pension_contribution', 'EXPENSE_OCCUPATIONAL_PENSION_2026', lei(2124)],
      ['pepp_contribution', 'EXPENSE_PEPP_2026', lei(2124)],
      ['voluntary_health_insurance', 'EXPENSE_VOLUNTARY_HEALTH_INSURANCE_2026', lei(2124)],
      ['sports_subscription', 'EXPENSE_SPORTS_SUBSCRIPTION_2026', lei(531)],
      ['professional_body_dues', 'EXPENSE_PROFESSIONAL_BODY_DUES_2026', lei(21240)],
      ['etf_purchase', 'EXPENSE_ETF_PURCHASE_2026', lei(2124)],
    ];
    for (const [category, ruleId, ceiling] of cases) {
      const o = run(
        [expense({ id: `exp-${category}`, category, date: '2026-10-08', valoareFaraTva: ron(30000), tva: ron(5700) })],
        [EUR_ANNUAL_2026_PROVISIONAL, EUR_DAILY_2026_10_08],
      );
      const a = euroAdjustment(o, ruleId);
      expect(a.ceiling.exclVat, ruleId).toBe(ceiling);
    }
  });

  it('the ceiling is a ceiling: what is claimed above it does not enter the total', () => {
    // Claimed 800,00 lei net; ceiling 531,00 lei → allowed 531,00 lei.
    const o = mustRun(
      run(
        [expense({ category: 'sports_subscription', date: '2026-10-08', valoareFaraTva: ron(800), tva: ron(152) })],
        [EUR_ANNUAL_2026_PROVISIONAL, EUR_DAILY_2026_10_08],
      ),
    );
    const a = euroAdjustment(o, 'EXPENSE_SPORTS_SUBSCRIPTION_2026');
    expect(a.claimed.exclVat).toBe(lei(800));
    expect(a.allowed.exclVat).toBe(lei(531));
    expect(o.amounts.expensesNet).toBe(lei(531));
  });

  it('a claim inside the ceiling enters whole, uncut', () => {
    // Claimed 300,00 lei < 531,00 lei ceiling.
    const o = mustRun(
      run(
        [expense({ category: 'sports_subscription', date: '2026-10-08', valoareFaraTva: ron(300), tva: ron(57) })],
        [EUR_ANNUAL_2026_PROVISIONAL, EUR_DAILY_2026_10_08],
      ),
    );
    expect(euroAdjustment(o, 'EXPENSE_SPORTS_SUBSCRIPTION_2026').allowed.exclVat).toBe(lei(300));
    expect(o.amounts.expensesNet).toBe(lei(300));
  });
});

describe('TASK 10b — both readings stay on the record, and the conflict is the rule’s', () => {
  const struck = () => euroAdjustment(
    run(
      [expense({ category: 'sports_subscription', date: '2026-10-08', valoareFaraTva: ron(800), tva: ron(152) })],
      [EUR_ANNUAL_2026_PROVISIONAL, EUR_DAILY_2026_10_08],
    ),
    'EXPENSE_SPORTS_SUBSCRIPTION_2026',
  );

  it('the applied ceiling is pct. 7 alin. (6), named with its citation and its rate', () => {
    const a = struck();
    expect(a.euro?.applied.basis).toBe('payment_year_annual_average');
    expect(a.euro?.applied.citation).toContain('pct. 7 alin. (6)');
    expect(a.euro?.applied.rate).toBe('5.3100');
  });

  it('the alternative is the art. 9 payment-date reading, and it gives a different ceiling', () => {
    // 100 EUR × 5,3470 = 534,70 lei against the 531,00 lei applied. Neither is declared wrong.
    const a = struck();
    expect(a.euro?.alternative.ok).toBe(true);
    if (!a.euro?.alternative.ok) return;
    expect(a.euro.alternative.ceiling).toBe(lei(534.7));
    expect(a.ceilingAlt).toEqual({ inclVat: lei(534.7), exclVat: lei(534.7) });
  });

  it('the conflict travels as the rule’s own parameter, not as a sentence in a component', () => {
    const a = struck();
    expect(a.conflict).toBeDefined();
    expect(a.conflict).toContain('CONFLICT NEREZOLVAT');
    expect(a.conflict).toContain('pct. 7 alin. (6)');
    expect(a.conflict).toContain('art. 9 alin. (3) lit. b)');
    // lit. r) carries the per-person interpretation too; lit. p) does not.
    expect(a.conflict).toContain('UN SINGUR plafon pe contribuabil');
    const dues = euroAdjustment(
      run(
        [expense({ category: 'professional_body_dues', date: '2026-10-08' })],
        [EUR_ANNUAL_2026_PROVISIONAL, EUR_DAILY_2026_10_08],
      ),
      'EXPENSE_PROFESSIONAL_BODY_DUES_2026',
    );
    expect(dues.conflict).not.toContain('UN SINGUR plafon pe contribuabil');
  });

  it('the alternative says why it cannot be struck when the payments fall on different days', () => {
    const o = mustRun(
      run(
        [
          expense({ id: 'a', category: 'sports_subscription', date: '2026-10-08', valoareFaraTva: ron(100), tva: ron(19) }),
          expense({ id: 'b', category: 'sports_subscription', date: '2026-10-09', valoareFaraTva: ron(100), tva: ron(19) }),
        ],
        [EUR_ANNUAL_2026_PROVISIONAL, EUR_DAILY_2026_10_08],
      ),
    );
    const a = euroAdjustment(o, 'EXPENSE_SPORTS_SUBSCRIPTION_2026');
    // The applied ceiling is unaffected — pct. 7 alin. (6) anchors to the year.
    expect(a.ceiling.exclVat).toBe(lei(531));
    expect(a.ceilingAlt).toBeUndefined();
    const alternative = a.euro?.alternative;
    expect(alternative?.ok).toBe(false);
    if (!alternative || alternative.ok) return;
    expect(alternative.detail).toContain('2 date de plată diferite');
  });
});

describe('TASK 10b — the provisional → final lifecycle (defect B-33)', () => {
  it('a FY2026 ceiling computed today is provisional', () => {
    const a = euroAdjustment(
      run(
        [expense({ category: 'sports_subscription', date: '2026-10-08', valoareFaraTva: ron(800), tva: ron(152) })],
        [EUR_ANNUAL_2026_PROVISIONAL, EUR_DAILY_2026_10_08],
      ),
      'EXPENSE_SPORTS_SUBSCRIPTION_2026',
    );
    expect(a.euro?.provisional).toBe(true);
    expect(a.euro?.applied.provisional).toBe(true);
    expect(a.ceiling.exclVat).toBe(lei(531));
  });

  it('replacing the rate in the store turns the same ceiling final, and the deductible total moves with it', () => {
    // THE acceptance test for B-33: replace the rate by `rateKey`, re-read the ceiling. Nothing else about
    // the calculation changes — no re-entry, no migration, no new field on the input.
    const data = dataWith(
      [expense({ category: 'sports_subscription', date: '2026-10-08', valoareFaraTva: ron(800), tva: ron(152) })],
      [EUR_ANNUAL_2026_PROVISIONAL, EUR_DAILY_2026_10_08],
    );
    const before = mustRun(selectEstimateOperands(data, YEAR_END, PFA_2026_SYSTEM_REAL_PACKAGE));
    expect(euroAdjustment(before, 'EXPENSE_SPORTS_SUBSCRIPTION_2026').euro?.provisional).toBe(true);
    expect(before.amounts.expensesNet).toBe(lei(531));

    // The store boundary: same (currency, kind, year), so `replace` overwrites the provisional record.
    const store = new RateStore();
    for (const record of data.fxRates ?? []) store.replace(record);
    store.replace(EUR_ANNUAL_2026_FINAL);
    expect(store.size).toBe(2);

    const after = mustRun(selectEstimateOperands(
      { ...data, fxRates: [...store.all()] },
      YEAR_END,
      PFA_2026_SYSTEM_REAL_PACKAGE,
    ));
    const a = euroAdjustment(after, 'EXPENSE_SPORTS_SUBSCRIPTION_2026');
    expect(a.euro?.provisional).toBe(false);
    // 100 EUR × 5,4000 = 540,00 lei. The claim (800,00 lei) is still above it, so the total moves by 9,00.
    expect(a.ceiling.exclVat).toBe(lei(540));
    expect(after.amounts.expensesNet).toBe(lei(540));
  });

  it('a payment outside the profile’s fiscal year never reaches a ceiling at all', () => {
    // The period filter is art. 65 alin. (1) / art. 68 alin. (4) lit. b), not the rate: a FY2025 payment is
    // outside a FY2026 estimate whatever the store holds. The FY2025 average (5,0415 lei, a published
    // figure) is exercised at the rate layer in `fx/capCeiling.test.ts`, where the year is the caller's.
    const set = run(
      [expense({ category: 'sports_subscription', date: '2025-06-10' })],
      [EUR_ANNUAL_2025],
    ).deductible;
    expect(set.counts.annualCapped).toBe(0);
    expect(set.counts.capUnresolved).toBe(0);
    expect(set.records).toHaveLength(0);
    expect(set.excluded).toHaveLength(0);
  });
});

describe('TASK 10b — the converted ceiling participates in the art. 68 alin. (6) base', () => {
  it('the alin. (6) base subtracts the euro-capped category as RECORDED, and shows the post-cap alternative', () => {
    // alin. (6) removes burse private and protocol by NAME and keeps every other deductible expense, so a
    // pensii/abonamente category reduces the base — and TASK 2d's operative PRE-cap reading subtracts it
    // as recorded, not as allowed.
    //
    // sports: claimed 800,00 lei net (952,00 with VAT), ceiling 531,00 lei → allowed 531,00 lei.
    // exclVat: postCap = 770.000 − 53.100 = 716.900 bani (baseAlt)
    //          base    = 716.900 − (80.000 − 53.100) = 690.000 bani = 6.900,00 lei → 2 % = 138,00 lei
    //          baseAlt = 716.900 bani                                    → 2 % = 143,38 lei
    // inclVat: postCap = 931.700 − 53.100 = 878.600
    //          base    = 878.600 − (95.200 − 53.100) = 836.500 bani = 8.365,00 lei → 2 % = 167,30 lei
    const o = mustRun(
      run(
        [
          expense({ id: 'sport', category: 'sports_subscription', date: '2026-10-08', valoareFaraTva: ron(800), tva: ron(152) }),
          expense({ id: 'proto', category: 'protocol', date: '2026-10-08', valoareFaraTva: ron(300), tva: ron(57) }),
        ],
        [EUR_ANNUAL_2026_PROVISIONAL, EUR_DAILY_2026_10_08],
      ),
    );
    const proto = euroAdjustment(o, 'EXPENSE_PROTOCOL_2026');
    expect(proto.base).toEqual({ inclVat: lei(8365), exclVat: lei(6900) });
    expect(proto.baseAlt).toEqual({ inclVat: lei(8786), exclVat: lei(7169) });
    expect(proto.ceiling.exclVat).toBe(lei(138));
    expect(proto.ceiling.inclVat).toBe(lei(167.3));
    expect(proto.ceilingAlt!.exclVat).toBe(lei(143.38));
  });
});

describe('TASK 10b — cap_counts_payments_from becomes load-bearing', () => {
  it('the pensii facultative window is 1 ianuarie 2026, so a January payment counts', () => {
    // OUG 8/2026 art. 10 alin. (9): the FY2026 400 EUR test counts payments from 1 ianuarie, even though
    // the neighbouring letters bite from 1 martie. The window is read from the rule, not from a date here.
    const o = mustRun(
      run(
        [expense({ category: 'private_pension_contribution', date: '2026-01-15', valoareFaraTva: ron(300), tva: ron(57) })],
        [EUR_ANNUAL_2026_PROVISIONAL, EUR_DAILY_2026_10_08],
      ),
    );
    const a = euroAdjustment(o, 'EXPENSE_PRIVATE_PENSION_2026');
    expect(a.euro?.countsPaymentsFrom).toBe('2026-01-01');
    expect(a.allowed.exclVat).toBe(lei(300));
  });

  it('a payment outside the window the rule states is excluded, not folded into a ceiling that does not cover it', () => {
    // Same rule, window moved to 1 April: the February payment belongs to a ceiling this build does not
    // model, so it is kept out and the window is named. This proves the parameter is read from the rule.
    const rules: FiscalRule[] = PFA_2026_SYSTEM_REAL_PACKAGE.map(r =>
      r.ruleId === 'EXPENSE_PRIVATE_PENSION_2026'
        ? {
            ...r,
            parameters: r.parameters.map(p =>
              p.id === 'cap_counts_payments_from' ? { ...p, value: '2026-04-01' } : p,
            ),
          }
        : r,
    );
    const set = run(
      [expense({ category: 'private_pension_contribution', date: '2026-02-10' })],
      [EUR_ANNUAL_2026_PROVISIONAL],
      YEAR_END,
      rules,
    ).deductible;
    expect(set.counts.capUnresolved).toBe(1);
    expect(set.counts.annualCapped).toBe(0);
    expect(set.excluded[0].detail).toContain('2026-04-01');
    expect(set.excluded[0].detail).toContain('2026-02-10');
  });
});

describe('TASK 10b — the ledger is read in lei, and USD travels the same rule as EUR', () => {
  it('a USD expense enters the deductible base at the daily rate of its payment date', () => {
    // CF art. 9 alin. (3) lit. b) + alin. (4) is not EUR-specific. 100,00 USD × 4,5000 = 450,00 lei.
    const o = mustRun(
      run(
        [expense({ category: 'postal_and_telecom', date: '2026-10-08', valoareFaraTva: usd(100), tva: usd(19) })],
        [USD_DAILY_2026_10_08],
      ),
    );
    expect(o.deductible.counts.entered).toBe(1);
    expect(o.deductible.counts.foreignCurrency).toBe(0);
    expect(o.amounts.expensesNet).toBe(lei(450));
    expect(o.conversions).toHaveLength(1);
    expect(o.conversions[0]).toMatchObject({
      currency: 'USD', onDate: '2026-10-08', rate: '4.5000', seriesCode: 'CURSZ_USD-PATTERN',
    });
  });

  it('a foreign record with no rate stays foreign_currency and names the date it looked for', () => {
    const set = run(
      [expense({ category: 'postal_and_telecom', date: '2026-10-08', valoareFaraTva: usd(100), tva: usd(19) })],
    ).deductible;
    expect(set.counts.foreignCurrency).toBe(1);
    expect(set.counts.entered).toBe(0);
    expect(set.excluded[0].reason).toBe('foreign_currency');
    expect(set.excluded[0].detail).toContain('2026-10-08');
  });

  it('the conversion is reported on the operands, with the rate that produced it', () => {
    const o = mustRun(
      run(
        [expense({ category: 'postal_and_telecom', date: '2026-10-08', valoareFaraTva: usd(100), tva: usd(19) })],
        [USD_DAILY_2026_10_08],
      ),
    );
    expect(o.conversions[0].netLei).toBe(lei(450));
    expect(o.conversions[0].citation).toContain('art. 9 alin. (3) lit. b)');
  });
});

describe('TASK 10b — the landmine: no money figure moves', () => {
  it('the seed’s deductible total is the recorded one at the e2e clock, with no rate recorded', () => {
    // PG-5C re-premise: 145,48 lei -> 120,00 lei. The old figure was the seed's 120,00 lei of recorded
    // deductible expense grossed up by the run rate (x 354/292, the multiplier PG-4 had moved from
    // 12/10). Nothing about the caps or the FX layer changed here — the seed still puts no expense in a
    // capped category and records no FX rate, so computing the caps still moves nothing. What moved is
    // that the engine is now fed the 120,00 lei the taxpayer actually paid.
    const o = mustRun(run(seedData.expenses, undefined, E2E_CLOCK));
    expect(o.amounts.expensesNet).toBe(lei(120));
    expect(o.deductible.counts.capUnresolved).toBe(0);
    expect(o.deductible.counts.annualCapped).toBe(0);
    expect(o.deductible.counts.foreignCurrency).toBe(0);
    expect(o.capAdjustments).toHaveLength(0);
  });

  it('the seed with a FY2026 average recorded still deducts exactly the same, because no seed expense is capped', () => {
    const o = mustRun(run(seedData.expenses, [EUR_ANNUAL_2026_PROVISIONAL], E2E_CLOCK));
    expect(o.amounts.expensesNet).toBe(lei(120));
    expect(o.capAdjustments).toHaveLength(0);
  });
});
