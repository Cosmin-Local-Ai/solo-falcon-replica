/**
 * PG-6b (B-29) — the view model, from stored data.
 *
 * The three states a profile can now be in, all reached through `buildDashboardData` with a payload rather
 * than a hand-built estimate:
 *
 *   | profile                        | `estimateState` | figure on screen |
 *   |--------------------------------|-----------------|------------------|
 *   | declares `other`               | `complete`      | the computed one |
 *   | never asked                    | `incomplete`    | the computed one, with a row naming the gap |
 *   | declares `cazare`              | `refused`       | none |
 *
 * The middle row is the one that did not exist before 6b: an unanswered question used to be
 * indistinguishable from an answered one, which is how a cazare register ended up with a confident figure.
 *
 * The weighted percentage deliberately does **not** move. It is a share of recorded amount, and a fact the
 * register never held took no sum out of the figure — the same reasoning PG-6a established for scenario
 * gaps, and the reason a `profile` coverage row carries `amount: null` rather than `0`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { buildDashboardData, getTaxEstimate } from './dashboard';
import { seedData } from './seed';
import type { AppData } from './types';
import { fixedInstant } from '../test/fixedInstant';
import { pinClock, unpinClock } from '../test/clock';

afterEach(() => unpinClock());

function profileData(over: Partial<AppData['profile']> = {}): AppData {
  return { ...seedData, profile: { ...seedData.profile, ...over } };
}

/** The demo profile declares a family, so "never asked" has to be built by removing it. */
function unansweredData(): AppData {
  const profile = { ...seedData.profile } as AppData['profile'] & { activityFamily?: string };
  delete profile.activityFamily;
  return { ...seedData, profile };
}

async function viewFor(data: AppData) {
  const estimate = await getTaxEstimate(data, '2026-10-31');
  return buildDashboardData(data, estimate, fixedInstant());
}

describe('the activity family reaches the hero state', () => {
  it('a profile that never answered is `incomplete`, with the gap named and linked', async () => {
    pinClock(fixedInstant());
    const view = await viewFor(unansweredData());

    expect(view.estimateState).toBe('incomplete');
    const rows = view.coverage.filter(g => g.reason === 'fact_missing');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe('profile');
    expect(rows[0]!.recordId).toBe('scenario:activity-family-undeclared');
    expect(rows[0]!.amount).toBeNull();
    expect(rows[0]!.fixTarget).toBe('/settings#!/fiscal');
  });

  it('answering the question returns the same profile to `complete` — the round trip, not just the failure', async () => {
    pinClock(fixedInstant());
    const before = await viewFor(unansweredData());
    const after = await viewFor(profileData({ activityFamily: 'other' }));

    expect(before.estimateState).toBe('incomplete');
    expect(after.estimateState).toBe('complete');
    expect(after.coverage.filter(g => g.reason === 'fact_missing')).toHaveLength(0);
  });

  it('the gap changes no amount: the weighted share and the recorded denominator are untouched', async () => {
    pinClock(fixedInstant());
    const unanswered = await viewFor(unansweredData());
    const declared = await viewFor(profileData({ activityFamily: 'other' }));

    expect(unanswered.completeness.coverage.percent).toBe(declared.completeness.coverage.percent);
    expect(unanswered.completeness.coverage.recordedBani).toBe(declared.completeness.coverage.recordedBani);
    expect(unanswered.completeness.coverage.includedBani).toBe(declared.completeness.coverage.includedBani);
    // `Bani` throughout — the share is bani over bani, never a formatted number.
    expect(Number.isInteger(unanswered.completeness.coverage.recordedBani)).toBe(true);
  });

  it('answering no moves no figure at all — the same register, the same lines, the same total', async () => {
    // Acceptance 2. The pre-6b state is a profile with no activity-family fact anywhere; the post-6b state
    // is the same profile declaring 'other'. Both must produce identical output, because 'other' is the
    // family the classifier already used by default. If this test moved a number, the new field would be
    // changing the arithmetic rather than declaring which arithmetic applies — the same defect this phase
    // exists to remove, reintroduced from the other side.
    pinClock(fixedInstant());
    const before = await getTaxEstimate(unansweredData(), '2026-10-31');
    const after = await getTaxEstimate(profileData({ activityFamily: 'other' }), '2026-10-31');
    if (before.status !== 'computed' || after.status !== 'computed') {
      throw new Error('expected both estimates to compute');
    }
    expect(after.output).toEqual(before.output);
    expect(after.output.total).toBe(before.output.total);
  });

  it('a profile that declares cazare is `refused`: no figure, and the refusal carries the fix route', async () => {
    pinClock(fixedInstant());
    const data = profileData({ activityFamily: 'cazare' });
    const estimate = await getTaxEstimate(data, '2026-10-31');
    const view = buildDashboardData(data, estimate, fixedInstant());

    expect(estimate.status).toBe('review_required');
    if (estimate.basis.kind !== 'refused') throw new Error('expected a refused basis');
    // PG-6h-1: the FY2026 refusal is no longer "there is no method" — the method is implemented. It is
    // "the gross the method would run on is not settled", which is the honest reason while B-80 and the
    // alin. (1) gate stay unanswered.
    expect(estimate.basis.scenario.id).toBe('accommodation-gross-undetermined');
    expect(view.estimateState).toBe('refused');
    // A refusal outranks the gap, and the two are not the same claim: the cazare profile HAS answered, so
    // it produces no `fact_missing` row at all.
    expect(view.coverage.filter(g => g.reason === 'fact_missing')).toHaveLength(0);
  });

  it('a cazare profile that also has a record outside the figure still shows the row beside the refusal (B-68)', async () => {
    pinClock(fixedInstant());
    const euro = {
      ...seedData.expenses[0]!,
      id: 'pg6b-eur',
      valoareFaraTva: { amount: 500000 as never, currency: 'EUR' as never },
    };
    const data = { ...profileData({ activityFamily: 'cazare' }), expenses: [euro] };
    const view = await viewFor(data);

    expect(view.estimateState).toBe('refused');
    expect(view.ledger.unconverted.length).toBeGreaterThan(0);
    expect(view.coverage.some(g => g.reason === 'missing_fx_rate')).toBe(true);
  });
});
