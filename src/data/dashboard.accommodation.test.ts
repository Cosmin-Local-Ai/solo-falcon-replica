/**
 * PG-6h-2 — the accommodation facts, from stored data through the view model.
 *
 * Two things have to be true at once here, and they pull in opposite directions:
 *
 * 1. **The new facts must actually reach the estimate.** They are read from a persisted profile, not from a
 *    hand-built classification context — the same standard PG-6b set, because the defect was never that the
 *    app could not refuse; it was that no path led to the refusal.
 * 2. **Nothing that already produced a figure may move.** The demo profile declares `other`, so no
 *    accommodation scenario fires for it, and the three new profile fields must be inert for every register
 *    that is not a cazare register. If the seed estimate moved, the new facts would be operands rather than
 *    declarations — the exact inversion this series keeps failing.
 *
 * The seed figure is therefore asserted in both directions: with the fields absent, and with them present
 * and filled in on a profile that does not use them.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { fixedInstant } from '../test/fixedInstant';
import { pinClock, unpinClock } from '../test/clock';
import { buildDashboardData, getTaxEstimate } from './dashboard';
import { seedData } from './seed';
import type { AppData } from './types';

afterEach(() => unpinClock());

function profileData(over: Partial<AppData['profile']> = {}): AppData {
  return { ...seedData, profile: { ...seedData.profile, ...over } };
}

async function viewFor(data: AppData) {
  const estimate = await getTaxEstimate(data, '2026-10-31');
  return buildDashboardData(data, estimate, fixedInstant());
}

describe('the seed register is untouched by the new facts (acceptance 9)', () => {
  it('the demo profile still estimates 3.112 lei — 311.200 bani, integer lei, unmoved', async () => {
    pinClock(fixedInstant());
    const estimate = await getTaxEstimate(seedData, '2026-10-31');
    if (estimate.status !== 'computed') throw new Error('the seed register must still compute');
    expect(estimate.output.total).toBe(311200);
  });

  it('the same fields, filled in on a profile that declares a different family, change nothing', async () => {
    // A room count on a profile that says its activity is not accommodation is a fact about an activity the
    // person has disclaimed. It must be inert: no scenario, no figure, no coverage row.
    pinClock(fixedInstant());
    const bare = await getTaxEstimate(seedData, '2026-10-31');
    const loaded = await getTaxEstimate(
      profileData({
        accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 9 }],
        accommodationCommissionReading: 'reading_b',
        accommodationTourismEligibility: 'da',
      }),
      '2026-10-31',
    );
    if (bare.status !== 'computed' || loaded.status !== 'computed') {
      throw new Error('both registers must still compute');
    }
    expect(loaded.output).toEqual(bare.output);
    expect(loaded.output.total).toBe(311200);
  });

  it('the completeness view does not gain a row for a profile that has answered nothing about cazare', async () => {
    pinClock(fixedInstant());
    const view = await viewFor(seedData);
    expect(view.coverage.filter(g => g.recordId.startsWith('scenario:accommodation'))).toHaveLength(0);
  });
});

describe('a cazare profile with no room count stays unknown, and no title is asserted (acceptance 1)', () => {
  it('the estimate is refused, and the refusal is the unsettled-gross one, not a guessed title', async () => {
    pinClock(fixedInstant());
    const data = profileData({ activityFamily: 'cazare' });
    const estimate = await getTaxEstimate(data, '2026-10-31');
    const view = buildDashboardData(data, estimate, fixedInstant());

    expect(estimate.status).toBe('review_required');
    if (estimate.basis.kind !== 'refused') throw new Error('expected a refused basis');
    expect(estimate.basis.scenario.id).toBe('accommodation-gross-undetermined');
    expect(view.estimateState).toBe('refused');
  });

  it('no figure is presented beside it, in the hero or in the cockpit strip', async () => {
    pinClock(fixedInstant());
    const view = await viewFor(profileData({ activityFamily: 'cazare' }));
    expect(view.estimateState).toBe('refused');
    // The view model carries the refused result, not a computed one: there is no `output.total` for this
    // estimate to render, which is what makes the `—` in the hero and the cockpit strip a consequence of
    // the data rather than a formatting choice. The e2e spec is what proves the dash on screen.
    if (view.tax?.status !== 'review_required') throw new Error('expected a refused result, not a figure');
    expect('output' in view.tax).toBe(false);
  });

  it('the refusal links to the control that records the room count', async () => {
    pinClock(fixedInstant());
    const data = profileData({ activityFamily: 'cazare' });
    const estimate = await getTaxEstimate(data, '2026-10-31');
    if (estimate.basis.kind !== 'refused') throw new Error('expected a refused basis');
    expect(estimate.basis.scenario.fixTarget).toEqual({ page: 'settings', tab: 'fiscal' });
  });
});

describe('the room count decides which refusal a cazare register gets, from stored data (acceptance 2)', () => {
  it('3 rooms for the declared year refuses on the title', async () => {
    pinClock(fixedInstant());
    const data = profileData({
      activityFamily: 'cazare',
      accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 3 }],
    });
    const estimate = await getTaxEstimate(data, '2026-10-31');
    if (estimate.basis.kind !== 'refused') throw new Error('expected a refused basis');
    expect(estimate.basis.scenario.id).toBe('accommodation-title-cedarea-folosintei');
  });

  it('9 rooms for the declared year refuses on the gross instead', async () => {
    pinClock(fixedInstant());
    const data = profileData({
      activityFamily: 'cazare',
      accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 9 }],
    });
    const estimate = await getTaxEstimate(data, '2026-10-31');
    if (estimate.basis.kind !== 'refused') throw new Error('expected a refused basis');
    expect(estimate.basis.scenario.id).toBe('accommodation-gross-undetermined');
  });

  it('a count recorded for a different fiscal year does not decide this year\'s title', async () => {
    // The profile declares 2026; the count belongs to 2027. Reading it anyway would be the single-scalar
    // mistake in a new costume — art. 83 alin. (4) speaks per fiscal year.
    pinClock(fixedInstant());
    const data = profileData({
      activityFamily: 'cazare',
      accommodationRoomCounts: [{ fiscalYear: 2027, rooms: 9 }],
    });
    const estimate = await getTaxEstimate(data, '2026-10-31');
    if (estimate.basis.kind !== 'refused') throw new Error('expected a refused basis');
    expect(estimate.basis.scenario.id).toBe('accommodation-gross-undetermined');
  });
});

describe('a refusal outranks a gap, and the two stay different claims', () => {
  it('a cazare profile that has answered the family produces no fact_missing row', async () => {
    pinClock(fixedInstant());
    const view = await viewFor(profileData({ activityFamily: 'cazare' }));
    expect(view.coverage.filter(g => g.reason === 'fact_missing')).toHaveLength(0);
    expect(view.estimateState).toBe('refused');
  });

  it('a profile that never answered the family is still `incomplete`, whatever the room count says', async () => {
    // The room count is not the family. A profile with a count but no declared family must not be read as
    // `cazare` — that would be an inference, and the count came from somewhere the app cannot see.
    pinClock(fixedInstant());
    const profile = { ...seedData.profile } as AppData['profile'] & { activityFamily?: string };
    delete profile.activityFamily;
    profile.accommodationRoomCounts = [{ fiscalYear: 2026, rooms: 9 }];
    const view = await viewFor({ ...seedData, profile });

    expect(view.estimateState).toBe('incomplete');
    const rows = view.coverage.filter(g => g.reason === 'fact_missing');
    expect(rows.map(r => r.recordId)).toEqual(['scenario:activity-family-undeclared']);
  });
});
