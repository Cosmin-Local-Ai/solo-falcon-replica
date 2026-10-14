/**
 * PG-1 — the estimate's coverage, end to end through `buildDashboardData`.
 *
 * The gate this file exists to hold: **the hero may say „Calculat” only when every recorded record is
 * either in the figure or visibly, deliberately kept out of it.** Before PG-1 the hero said „Calculat”
 * whenever the engine produced a number, and a number can be produced while a five-thousand-lei expense,
 * an uncategorised invoice or an unconvertible revenue sits outside it.
 *
 * Each of the gate's five evidence rows is run twice: once with the record present, once with the cause
 * fixed. The second half is the half that matters — a warning that cannot be cleared is noise, and a
 * warning that clears when the data is fixed is a statement about the data.
 *
 * The clock is pinned (`pinClock`, `fixedInstant`) because `buildDashboardData` derives its as-of date
 * from the clock, and every amount here depends on which records are inside the period.
 */
import { describe, expect, it, afterEach } from 'vitest';
import type { AppData, Expense, Revenue } from './types';
import type { FxRateRecord } from '../domain/fx/rates';
import { buildDashboardData, getTaxEstimate } from './dashboard';
import { seedData } from './seed';
import { isGapReason, type CoverageReason, type EstimateCoverageGap } from '../domain/estimateBasis';
import { eur, ron, type Bani } from '../domain/money';
import { copy } from '../ui/copy';
import { pinClock, unpinClock } from '../test/clock';
import { fixedInstant } from '../test/fixedInstant';

const AS_OF = '2026-10-31';

afterEach(() => unpinClock());

function expenseRecord(over: Partial<Expense> = {}): Expense {
  return {
    id: 'pg1-expense',
    tip: 'factura',
    nr: 'CH-2026-901',
    date: '2026-04-15',
    furnizor: 'Furnizor Test SRL',
    cui: 'RO90000001',
    valoareFaraTva: ron(2000),
    tva: ron(380),
    status: 'inregistrata',
    ...over,
  };
}

function revenueRecord(over: Partial<Revenue> = {}): Revenue {
  return {
    id: 'pg1-revenue',
    tip: 'factura',
    nr: 'FCT-2026-901',
    date: '2026-04-20',
    client: 'Client Test SRL',
    // B110: this read `RO90000002`, whose control digit is valid under both published CUI key
    // variants — a plausible registered number for a client that is not the point of this test.
    // `RO90000003` fails the check digit, so the fixture cannot be anyone's real CUI. The value is
    // not asserted anywhere; only its presence on the record is.
    cui: 'RO90000003',
    valoareFaraTva: ron(3000),
    tva: ron(570),
    status: 'inregistrata',
    ...over,
  };
}

/**
 * A verified daily reference rate for the payment date of the EUR records. Recorded so the round trip
 * fixes the cause the app can actually fix — the missing rate — rather than deleting the record.
 */
const EUR_DAILY_2026_04_15: FxRateRecord = {
  currency: 'EUR',
  rate: '4.9750',
  rateKind: 'daily_reference',
  rateDate: '2026-04-15',
  seriesCode: 'CURSZ_EUR',
  sourceUrl: 'https://curs.bnr.ro/nbrpxrates.xml',
  fetchedAt: '2026-04-15T13:05:00Z',
  provisional: false,
  entryMode: 'fetched',
};

/** The same for the revenue's money date — art. 9 alin. (3) lit. b) keys the rate to the date of each sum. */
const EUR_DAILY_2026_04_20: FxRateRecord = {
  ...EUR_DAILY_2026_04_15,
  rate: '4.9810',
  rateDate: '2026-04-20',
  fetchedAt: '2026-04-20T13:05:00Z',
};

async function view(data: AppData) {
  pinClock(fixedInstant());
  const tax = await getTaxEstimate(data, AS_OF);
  return buildDashboardData(data, tax, fixedInstant());
}

/** The gaps that make the estimate incomplete — the list the hero badge and the count are built from. */
function gaps(coverage: readonly EstimateCoverageGap[]) {
  return coverage.filter(g => isGapReason(g.reason));
}

function gapFor(coverage: readonly EstimateCoverageGap[], recordId: string) {
  return coverage.find(g => g.recordId === recordId);
}

const base = () => seedData;

describe('PG-1 evidence row 1 — an expense with no category', () => {
  const withGap = () => ({ ...base(), expenses: [...base().expenses, expenseRecord({ id: 'pg1-uncat' })] });

  it('makes the estimate incomplete, with a count and a route to the record', async () => {
    const clean = await view(base());
    const dirty = await view(withGap());

    expect(clean.estimateState).toBe('complete');
    expect(dirty.estimateState).toBe('incomplete');
    expect(gaps(dirty.coverage)).toHaveLength(1);
    const g = gapFor(dirty.coverage, 'pg1-uncat');
    expect(g?.reason).toBe('unclassified');
    expect(g?.kind).toBe('expense');
    expect(g?.amount).toBe(200000 as Bani);
    expect(g?.currency).toBe('RON');
    expect(g?.fixTarget).toBe('/expenses#!/registered?f=pg1-uncat');
    // The assembler's own sentence travels with the gap; the UI never paraphrases a legal reason.
    expect(g?.detail).toContain('no category');
  });

  it('lowers the weighted completeness and a category restores it', async () => {
    const clean = await view(base());
    const dirty = await view(withGap());
    const fixed = await view({
      ...base(),
      expenses: [
        ...base().expenses,
        expenseRecord({ id: 'pg1-uncat', category: 'rent_business_space' }),
      ],
    });

    expect(clean.completeness.coverage.percent).toBe(100);
    expect(dirty.completeness.coverage.percent!).toBeLessThan(clean.completeness.coverage.percent!);
    expect(fixed.estimateState).toBe('complete');
    expect(gaps(fixed.coverage)).toHaveLength(0);
    expect(fixed.completeness.coverage.percent).toBe(clean.completeness.coverage.percent);
  });
});

describe('PG-1 evidence row 2 — a depreciable asset purchase', () => {
  const withGap = () => ({
    ...base(),
    expenses: [...base().expenses, expenseRecord({ id: 'pg1-asset', category: 'depreciable_asset_purchase' })],
  });

  it('is reported as an asset the app cannot model, not as an ordinary non-deductible', async () => {
    const dirty = await view(withGap());
    expect(dirty.estimateState).toBe('incomplete');
    expect(gapFor(dirty.coverage, 'pg1-asset')?.reason).toBe('asset_not_modelled');
    // art. 68 alin. (7) lit. h) is the rule's own citation; the reason is the rule's, not the page's.
    expect(gapFor(dirty.coverage, 'pg1-asset')?.detail).toContain('art. 68 alin. (7) lit. h)');
  });

  it('lowers the weighted completeness, and the figure returns when the record leaves the register', async () => {
    const clean = await view(base());
    const dirty = await view(withGap());
    const fixed = await view(base());
    expect(dirty.completeness.coverage.percent!).toBeLessThan(clean.completeness.coverage.percent!);
    expect(fixed.estimateState).toBe('complete');
    expect(fixed.completeness.coverage.percent).toBe(100);
  });
});

describe('PG-1 evidence row 3 — an undetermined home_office_shared_cost', () => {
  const withGap = () => ({
    ...base(),
    expenses: [...base().expenses, expenseRecord({ id: 'pg1-home', category: 'home_office_shared_cost' })],
  });

  it('is reported as undetermined, naming the fact the app does not hold', async () => {
    const dirty = await view(withGap());
    expect(dirty.estimateState).toBe('incomplete');
    const g = gapFor(dirty.coverage, 'pg1-home');
    expect(g?.reason).toBe('undetermined');
    expect(g?.detail).toContain('art. 68');
  });

  it('lowers the weighted completeness and returns to complete when the record is gone', async () => {
    const clean = await view(base());
    const dirty = await view(withGap());
    expect(dirty.completeness.coverage.percent!).toBeLessThan(clean.completeness.coverage.percent!);
    const fixed = await view(base());
    expect(fixed.estimateState).toBe('complete');
    expect(fixed.completeness.coverage.percent).toBe(100);
  });
});

describe('PG-1 evidence rows 4 and 5 — a EUR expense and a EUR revenue with no rate', () => {
  const euroExpense = () =>
    expenseRecord({
      id: 'pg1-eur-exp',
      category: 'rent_business_space',
      valoareFaraTva: eur(5000),
      tva: eur(0),
    });
  const euroRevenue = () =>
    revenueRecord({ id: 'pg1-eur-rev', valoareFaraTva: eur(5000), tva: eur(0) });

  const withBoth = () => ({
    ...base(),
    expenses: [...base().expenses, euroExpense()],
    revenues: [...base().revenues, euroRevenue()],
  });

  it('both are reported, by the ledger disclosure path', async () => {
    const dirty = await view(withBoth());
    expect(dirty.estimateState).toBe('incomplete');

    const exp = gapFor(dirty.coverage, 'pg1-eur-exp');
    const rev = gapFor(dirty.coverage, 'pg1-eur-rev');
    expect(exp?.reason).toBe('missing_fx_rate');
    expect(rev?.reason).toBe('missing_fx_rate');
    expect(rev?.kind).toBe('revenue');
    expect(rev?.fixTarget).toBe('/revenues#!/registered?f=pg1-eur-rev');

    // Acceptance 5: these come from the ledger disclosure, not from a second FX walk. The disclosure's
    // own list is the source — same ids, same order, one entry each.
    const disclosed = dirty.ledger.unconverted.map(u => u.id);
    expect(disclosed).toEqual(expect.arrayContaining(['pg1-eur-exp', 'pg1-eur-rev']));
    const fxGaps = dirty.coverage.filter(g => g.reason === 'missing_fx_rate').map(g => g.recordId);
    expect(fxGaps).toEqual(disclosed);

    // Landmine 1: one record, one reason. No id appears twice in the coverage list.
    const ids = dirty.coverage.map(g => g.recordId);
    expect(new Set(ids).size).toBe(ids.length);

    // The amount is not a lei figure, and the gap says which unit it is in.
    expect(exp?.currency).toBe('EUR');
    expect(exp?.amount).toBe(500000 as Bani);
  });

  it('lowers the weighted completeness, and recording the rate returns the estimate to complete', async () => {
    const clean = await view(base());
    const dirty = await view(withBoth());
    expect(dirty.completeness.coverage.percent!).toBeLessThan(clean.completeness.coverage.percent!);

    const fixed = await view({ ...withBoth(), fxRates: [EUR_DAILY_2026_04_15, EUR_DAILY_2026_04_20] });
    expect(fixed.estimateState).toBe('complete');
    expect(gaps(fixed.coverage)).toHaveLength(0);
    expect(fixed.completeness.coverage.percent).toBe(100);
    // The records did not merely stop being gaps — they entered the lei totals, converted at the rate.
    expect(fixed.ledger.conversions.map(c => c.recordId).sort()).toEqual(['pg1-eur-exp', 'pg1-eur-rev']);
  });
});

describe('PG-1 — the status union and the shape of the coverage', () => {
  it('a legally non-deductible record is listed but does not make the estimate incomplete', async () => {
    const dirty = await view({
      ...base(),
      expenses: [...base().expenses, expenseRecord({ id: 'pg1-fine', category: 'fine_or_penalty' })],
    });
    // The law settled this record; the app has nothing left to fix, so the hero must not claim otherwise.
    expect(dirty.estimateState).toBe('complete');
    expect(gapFor(dirty.coverage, 'pg1-fine')?.reason).toBe('non_deductible');
    expect(gaps(dirty.coverage)).toHaveLength(0);
    expect(dirty.completeness.coverage.percent).toBe(100);
  });

  it('every reason the surfaces can be asked to render has a Romanian label', async () => {
    // A reason with no label would print its raw token on the screen. The copy map is declared
    // `satisfies Record<CoverageReason, string>`, so this is a compile-time guarantee restated as a
    // runtime one over the exact keys the union admits.
    const reasons: CoverageReason[] = [
      'unclassified', 'undetermined', 'asset_not_modelled', 'missing_fx_rate',
      'cap_unresolved', 'non_deductible', 'rejected', 'pending', 'fact_missing',
    ];
    for (const r of reasons) {
      expect(copy.dashboard.estimate.coverage.reasonLabels[r]).not.toBe(r);
      expect(copy.dashboard.estimate.coverage.reasonLabels[r].length).toBeGreaterThan(0);
    }
  });

  it('a refused estimate is `review_required`, never `incomplete` and never `unavailable`', async () => {
    // TASK 8 landmine 4: `null` and `review_required` are different values, and PG-1 must not blur them.
    // The refusal is handed in rather than provoked, because the refusal channel is the engine's and this
    // test is about the status the surfaces read.
    pinClock(fixedInstant());
    const refused = buildDashboardData(
      base(),
      { status: 'review_required', reason: 'Nicio regulă înregistrată pentru acest an fiscal.', lines: [] },
      fixedInstant(),
    );
    expect(refused.estimateState).toBe('review_required');
    expect(refused.tax?.status).toBe('review_required');

    // A refusal outranks a coverage gap: the figure was withheld, so "what is missing from the figure"
    // is not the sentence to show.
    const refusedAndGapped = buildDashboardData(
      withUncategorised(),
      { status: 'review_required', reason: 'Nicio regulă înregistrată pentru acest an fiscal.', lines: [] },
      fixedInstant(),
    );
    expect(refusedAndGapped.coverage.some(g => isGapReason(g.reason))).toBe(true);
    expect(refusedAndGapped.estimateState).toBe('review_required');
  });

  it('no estimate at all is `unavailable`, not `incomplete`', async () => {
    pinClock(fixedInstant());
    const d = buildDashboardData(base(), null, fixedInstant());
    expect(d.estimateState).toBe('unavailable');
  });
});

function withUncategorised(): AppData {
  return { ...seedData, expenses: [...seedData.expenses, expenseRecord({ id: 'pg1-uncat-2' })] };
}
