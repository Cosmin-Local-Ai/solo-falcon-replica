/**
 * PG-6a — the estimate's states stay distinct all the way through the view model.
 *
 * The acceptance criterion this file holds is the third one: `incomplete` and `refuse` must be
 * distinguishable in the data, and neither may be a proxy for the other. Four states can all arrive at
 * the hero carrying the same engine status, so the distinction has to survive into `estimateState` —
 * and it has to survive without the app growing a second "the estimate is not complete" channel.
 *
 *   | situation                                   | `tax.status`     | `estimateState`     |
 *   |---------------------------------------------|------------------|---------------------|
 *   | nothing computed yet                        | `null`           | `unavailable`       |
 *   | the engine ran and withheld a conclusion    | `review_required`| `review_required`   |
 *   | a scenario stopped the calculation          | `review_required`| `refused`           |
 *   | a figure exists, a record is outside it     | `computed`       | `incomplete`        |
 *
 * The clock is pinned because `buildDashboardData` derives its as-of date from it, and the coverage
 * denominator is period-scoped.
 */
import { describe, expect, it, afterEach } from 'vitest';
import type { AppData, Expense } from './types';
import { buildDashboardData, getTaxEstimate } from './dashboard';
import { seedData } from './seed';
import { isGapReason, type EstimateCoverageGap, type TaxEstimateWithBasis } from '../domain/estimateBasis';
import { ron } from '../domain/money';
import type { ScenarioOutcome } from '../domain/scenarios';
import { pinClock, unpinClock } from '../test/clock';
import { fixedInstant } from '../test/fixedInstant';

afterEach(() => unpinClock());

function base(over: Partial<AppData> = {}): AppData {
  return { ...seedData, ...over };
}

function uncategorised(over: Partial<Expense> = {}): Expense {
  return {
    id: 'pg6a-uncat',
    tip: 'factura',
    nr: 'CH-PG6A-001',
    date: '2026-05-10',
    furnizor: 'Furnizor Test SRL',
    cui: 'RO99999999',
    valoareFaraTva: ron(2000),
    tva: ron(400),
    status: 'inregistrata',
    ...over,
  };
}

/** An `incomplete` scenario outcome of the kind PG-6b…6g will register. */
const missingFact: ScenarioOutcome = {
  id: 'test-vehicle-fact',
  effect: 'incomplete',
  message: 'noExpenseEngine',
  fixTarget: { page: 'settings', tab: 'fiscal' },
  detail: 'Lipsește faptul de profil.',
};

describe('`refused` is reachable, and it is not `review_required`', () => {
  it('a profile whose regime cannot be computed arrives as a refusal, not as a withheld conclusion', async () => {
    pinClock(fixedInstant());
    const data = base({ profile: { ...seedData.profile, regime: 'impozit_pe_cit' } });
    const estimate = await getTaxEstimate(data, '2026-10-31');
    const view = buildDashboardData(data, estimate, fixedInstant());

    // Both arrive at the engine status `review_required`; only the basis says which kind it is.
    expect(estimate.status).toBe('review_required');
    expect(view.estimateState).toBe('refused');
    if (estimate.basis.kind !== 'refused') throw new Error('expected a refused basis');
    expect(estimate.basis.scenario.id).toBe('regime-not-computable');
    expect(estimate.basis.scenario.effect).toBe('refuse');
    // The route the hero links to travels with the outcome, so the surface cannot invent one.
    expect(estimate.basis.scenario.fixTarget).toEqual({ page: 'settings', tab: 'fiscal' });
  });

  it('the engine refusing on its own facts stays `review_required`', async () => {
    // A year this build has no rules for: the assembler runs, the engine declines. That is a conclusion
    // withheld by a calculation that did happen to run — a different claim from a refusal, and PG-4's
    // year-lifecycle test depends on the two not merging.
    pinClock(fixedInstant());
    const data = base({ profile: { ...seedData.profile, fiscalYear: 2027 } });
    const estimate = await getTaxEstimate(data, '2027-01-15');
    const view = buildDashboardData(data, estimate, fixedInstant());
    expect(estimate.status).toBe('review_required');
    expect(estimate.basis.kind).toBe('recorded-actuals');
    expect(view.estimateState).toBe('review_required');
  });

  it('a hand-built result with no basis is not guessed into a refusal', () => {
    pinClock(fixedInstant());
    const view = buildDashboardData(
      base(),
      { status: 'review_required', reason: 'Nicio regulă înregistrată pentru acest an fiscal.', lines: [] },
      fixedInstant(),
    );
    expect(view.estimateState).toBe('review_required');
  });

  it('a refusal outranks an incomplete register, and still leaves the coverage rows standing', () => {
    // The refusal is the sentence to show, but the records that sit outside the figure are a separate
    // fact and the rows do not disappear with the number.
    pinClock(fixedInstant());
    const view = buildDashboardData(
      base({ expenses: [uncategorised()] }),
      {
        status: 'review_required',
        reason: 'refused',
        lines: [],
        basis: { kind: 'refused', method: null, elapsedMonths: null, reason: 'refused', scenario: missingFact },
      } as TaxEstimateWithBasis,
      fixedInstant(),
    );
    expect(view.estimateState).toBe('refused');
    expect(view.coverage.some(g => isGapReason(g.reason))).toBe(true);
  });
});

describe('`incomplete` stays reachable and is not a proxy for a refusal', () => {
  it('a record outside the figure is `incomplete`, with a figure still standing', async () => {
    pinClock(fixedInstant());
    const data = base({ expenses: [uncategorised()] });
    const estimate = await getTaxEstimate(data, '2026-10-31');
    const view = buildDashboardData(data, estimate, fixedInstant());
    expect(estimate.status).toBe('computed');
    expect(view.estimateState).toBe('incomplete');
    expect(view.coverage.some(g => g.recordId === 'pg6a-uncat')).toBe(true);
  });
});

describe('an `incomplete` scenario joins PG-1\'s coverage channel and moves no figure', () => {
  it('the scenario gap is a `fact_missing` row with no amount and no effect on the percentage', async () => {
    pinClock(fixedInstant());
    const data = base();
    const clean = await getTaxEstimate(data, '2026-10-31');
    const without = buildDashboardData(data, clean, fixedInstant());

    const withScenario: TaxEstimateWithBasis = { ...clean, scenarios: [missingFact] };
    const after = buildDashboardData(data, withScenario, fixedInstant());

    const added: EstimateCoverageGap[] = after.coverage.filter(g => g.reason === 'fact_missing');
    expect(added).toHaveLength(1);
    expect(added[0].kind).toBe('profile');
    expect(added[0].amount).toBeNull();
    expect(added[0].fixTarget).toBe('/settings#!/fiscal');

    // The weighted percentage is a share of recorded amount. A fact the register never held has no
    // amount, so it cannot move the share — and it must not, or clearing an unrelated record would
    // appear to fix a profile gap.
    expect(after.completeness.coverage.percent).toBe(without.completeness.coverage.percent);
    expect(after.completeness.coverage.recordedBani).toBe(without.completeness.coverage.recordedBani);

    // What it does change is the state: the hero stops claiming the estimate covers everything.
    expect(without.estimateState).toBe('complete');
    expect(after.estimateState).toBe('incomplete');
  });

  it('a ledger that is present but excluded still reaches the rows beside a scenario gap (B-68)', () => {
    pinClock(fixedInstant());
    const euro = {
      ...uncategorised(),
      id: 'pg6a-eur',
      valoareFaraTva: { amount: 500000 as never, currency: 'EUR' as never },
    };
    const view = buildDashboardData(
      base({ expenses: [euro] }),
      {
        status: 'review_required',
        reason: 'refused',
        lines: [],
        basis: { kind: 'refused', method: null, elapsedMonths: null, reason: 'refused', scenario: missingFact },
        scenarios: [missingFact],
      } as TaxEstimateWithBasis,
      fixedInstant(),
    );
    // The register is not empty and the record is not absent — it is present and excluded. Both the FX
    // row and the scenario row are on the surface, and neither is inferred from a zero total.
    expect(view.ledger.unconverted.length).toBeGreaterThan(0);
    expect(view.coverage.some(g => g.reason === 'missing_fx_rate')).toBe(true);
    expect(view.coverage.some(g => g.reason === 'fact_missing')).toBe(true);
    expect(view.estimateState).toBe('refused');
  });
});
