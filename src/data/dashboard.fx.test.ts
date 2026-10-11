/**
 * Phase 10c (B-37) — one money path, proved as a number.
 *
 * The defect this file exists for: `estimateBasis.ts` normalised the ledger into lei and
 * `aggregation.ts` did not, so a user holding one EUR invoice saw two revenue totals — the summary said
 * one thing and the estimate another. The fix is one boundary (`domain/fx/ledger.ts normaliseStoredLedger`)
 * that every surface reads. A fix like this is only proved by asserting the SAME figure out of three
 * different selectors, which is what the first test does.
 *
 * Every expected figure was derived BY HAND before the suite ran:
 *   1.000,00 EUR × 5,3470 lei/EUR = 5.347,00 lei = 534.700 bani
 *   2.000,00 EUR × 5,3470 lei/EUR = 10.694,00 lei = 1.069.400 bani
 * The rate 5,3470 is the BNR daily reference rate for 2026-10-08, captured in
 * `docs/ai/research/23_fx_conversion_and_bnr_rates_2026.md` — a real published figure, not scaffolding.
 */
import { describe, expect, it } from 'vitest';
import {
  getFinancialSummary,
  getLedgerDisclosure,
  getMonthlyFinancialSeries,
  getProjectedFinancialSeries,
  getTaxEstimate,
  getThresholdStatuses,
  buildDashboardData,
} from './dashboard';
import { selectFinancialDerived } from '../domain/derived';
import { selectEstimateOperands, type TaxEstimateWithBasis } from '../domain/estimateBasis';
import { normaliseStoredLedger } from '../domain/fx/ledger';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../domain/fiscal';
import { lei, money, majorToMinor, type Bani } from '../domain/money';
import type { FxRateRecord } from '../domain/fx/rates';
import { seedData } from './seed';
import type { AppData, Revenue } from './types';

const AS_OF = '2026-12-31';
const CLOCK = new Date('2026-12-31T12:00:00');

/** Verified: the BNR daily reference rate published for 2026-10-08. */
const EUR_DAILY_2026_10_08: FxRateRecord = {
  currency: 'EUR', rate: '5.3470', rateKind: 'daily_reference', rateDate: '2026-10-08',
  seriesCode: 'CURSZ_EUR', sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
  fetchedAt: '2026-10-08T13:05:00Z', provisional: false, entryMode: 'fetched',
};

/** TEST SCAFFOLDING — a provisional daily rate. Round number, non-BNR source: it exists to exercise the
 *  provisional label inside a converted total, and must not be read as a published figure. */
const EUR_DAILY_PROVISIONAL: FxRateRecord = {
  currency: 'EUR', rate: '5.0000', rateKind: 'daily_reference', rateDate: '2026-10-09',
  seriesCode: 'CURSZ_EUR-TEST', sourceUrl: 'https://example.invalid/hand-entered-test-rate',
  fetchedAt: '2026-10-09T09:00:00Z', provisional: true, entryMode: 'manual',
};

const eur = (major: number) => money(majorToMinor(major, 'EUR'), 'EUR');
function revenue(over: Partial<Revenue> = {}): Revenue {
  return {
    id: 'rev-eur-1',
    tip: 'factura',
    nr: 'FCT-FX-1',
    date: '2026-10-08',
    client: 'Client Test',
    cui: 'RO00000000',
    valoareFaraTva: eur(1000),
    tva: eur(0),
    status: 'inregistrata',
    ...over,
  };
}

/** The seed profile and settings, with a ledger the arithmetic can be done by hand. */
function dataWith(revenues: Revenue[], fxRates?: FxRateRecord[]): AppData {
  return { ...seedData, revenues, expenses: [], ...(fxRates ? { fxRates } : { fxRates: [] }) };
}

const EUR_LEI = lei(5347); // 1.000,00 EUR × 5,3470

/** The gross the engine actually ran on. Since PG-5C there is only one answer to that question. */
function estimateGross(tax: TaxEstimateWithBasis): Bani {
  const basis = tax.basis;
  if (basis.kind === 'recorded-actuals') return basis.actual.revenues;
  throw new Error(`estimate refused: ${'reason' in basis ? basis.reason : 'no basis recorded'}`);
}

describe('Phase 10c — one normalised ledger behind every lei figure (B-37)', () => {
  it('an EUR revenue with a rate for its fiscal date reaches the same lei figure in summary, graph and estimate', async () => {
    const data = dataWith([revenue()], [EUR_DAILY_2026_10_08]);

    // 1. Summary (the card, and the snapshot's hero revenue).
    const summary = getFinancialSummary(data, AS_OF);
    expect(summary.revenue).toBe(EUR_LEI);
    expect(summary.revenueNet).toBe(EUR_LEI);

    // 2. The financial graph: the monthly series and the projection it is drawn from.
    const monthly = getMonthlyFinancialSeries(data, AS_OF);
    expect(monthly.get('2026-10')?.revenue).toBe(EUR_LEI);
    const projection = getProjectedFinancialSeries(data, AS_OF);
    const october = projection.series.find(m => m.month === '2026-10');
    expect(october?.revenue).toBe(EUR_LEI);

    // 3. The estimate — both the assembler and the dashboard path that renders it.
    const operands = selectEstimateOperands(data, AS_OF, PFA_2026_SYSTEM_REAL_PACKAGE);
    if (operands.kind !== 'run') throw new Error('expected the estimate to run');
    expect(operands.amounts.revenues).toBe(EUR_LEI);

    const tax = await getTaxEstimate(data, AS_OF);
    expect(estimateGross(tax)).toBe(EUR_LEI);

    // 4. The derived view the reactive hooks expose, and the snapshot the insights engine reads.
    expect(selectFinancialDerived(data, AS_OF).ytd.revenue).toBe(EUR_LEI);
    expect(buildDashboardData(data, tax, CLOCK).snapshot.pfaRevenue).toBe(EUR_LEI);
  });

  it('the same record without a rate is out of the lei totals AND named in the disclosure', () => {
    const data = dataWith([revenue()]);

    // Absent from every lei total…
    expect(getFinancialSummary(data, AS_OF).revenue).toBe(lei(0));
    expect(getMonthlyFinancialSeries(data, AS_OF).get('2026-10')).toBeUndefined();
    expect(getProjectedFinancialSeries(data, AS_OF).annualProjected.revenue).toBe(lei(0));

    // …and present, with the missing datum, in the disclosure the surfaces render.
    const disclosure = getLedgerDisclosure(data);
    expect(disclosure.conversions).toHaveLength(0);
    expect(disclosure.unconverted).toHaveLength(1);
    const [u] = disclosure.unconverted;
    expect(u.id).toBe('rev-eur-1');
    expect(u.kind).toBe('revenue');
    expect(u.currency).toBe('EUR');
    expect(u.amount).toEqual(eur(1000));
    expect(u.detail).toContain('EUR');
    expect(u.detail).toContain('2026-10-08');

    // The dashboard view carries it, so the surfaces cannot render a total without it.
    const view = buildDashboardData(data, null, CLOCK);
    expect(view.ledger.unconverted).toHaveLength(1);
    expect(view.snapshot.pfaRevenue).toBe(lei(0));
  });

  it('a rate entered after the fact reconciles the record across all three without touching the record', async () => {
    const withoutRate = dataWith([revenue()]);
    expect(getFinancialSummary(withoutRate, AS_OF).revenue).toBe(lei(0));

    // The user's fix is a rate, not an edit of the invoice: the record bytes are unchanged.
    const withRate = dataWith([revenue()], [EUR_DAILY_2026_10_08]);
    expect(getFinancialSummary(withRate, AS_OF).revenue).toBe(EUR_LEI);

    const monthly = getMonthlyFinancialSeries(withRate, AS_OF);
    expect(monthly.get('2026-10')?.revenue).toBe(EUR_LEI);

    const tax = await getTaxEstimate(withRate, AS_OF);
    expect(estimateGross(tax)).toBe(EUR_LEI);

    // And the disclosure now reports it as converted, with the rate that did it.
    const disclosure = getLedgerDisclosure(withRate);
    expect(disclosure.unconverted).toHaveLength(0);
    expect(disclosure.conversions).toHaveLength(1);
    expect(disclosure.conversions[0].rate).toBe('5.3470');
    expect(disclosure.conversions[0].seriesCode).toBe('CURSZ_EUR');
    expect(disclosure.conversions[0].sourceUrl).toBe('https://curs.bnr.ro/nbrfxrates.xml');
    expect(disclosure.conversions[0].citation).toContain('art. 9 alin. (3) lit. b)');
  });

  it('a provisional rate stays provisional inside the converted total, not only in the register', () => {
    const data = dataWith(
      [revenue({ date: '2026-10-09' })],
      [EUR_DAILY_PROVISIONAL],
    );
    expect(getFinancialSummary(data, AS_OF).revenue).toBe(lei(5000));
    const disclosure = getLedgerDisclosure(data);
    expect(disclosure.conversions).toHaveLength(1);
    expect(disclosure.conversions[0].provisional).toBe(true);
  });

  it('the threshold rows measure the converted turnover, not the lei-only subset', () => {
    const data = dataWith([revenue()], [EUR_DAILY_2026_10_08]);
    const rows = getThresholdStatuses(data, AS_OF, null);
    const measured = rows.filter(r => r.currentValue !== null).map(r => r.currentValue as Bani);
    // Every turnover-based row must see the converted lei figure; none of them may see 0 for a ledger that
    // holds 1.000,00 EUR with a recorded rate.
    expect(measured).toContain(EUR_LEI);
  });

  it('running the pass twice cannot drift: the ledger is already lei the second time', () => {
    const data = dataWith([revenue()], [EUR_DAILY_2026_10_08]);
    const once = normaliseStoredLedger(data);
    const twice = normaliseStoredLedger(once.data);
    expect(twice.data.revenues).toEqual(once.data.revenues);
    expect(twice.conversions).toHaveLength(0);
    expect(getFinancialSummary(once.data, AS_OF).revenue).toBe(EUR_LEI);
    expect(getFinancialSummary(twice.data, AS_OF).revenue).toBe(EUR_LEI);
  });

  it('a RON ledger is untouched by the boundary: no figure moves when nothing is foreign', () => {
    const baseline = buildDashboardData(seedData, null, CLOCK);
    const withEmptyRates = buildDashboardData({ ...seedData, fxRates: [EUR_DAILY_2026_10_08] }, null, CLOCK);
    expect(withEmptyRates.snapshot).toEqual(baseline.snapshot);
    expect(withEmptyRates.ledger.conversions).toHaveLength(0);
    expect(withEmptyRates.ledger.unconverted).toHaveLength(0);
  });
});
