/**
 * PG-6b (B-29) — the activity family arrives from stored data, and nothing infers it.
 *
 * PG-6a registered `no-expense-engine` and reported honestly that it could not fire: the classifier had
 * accepted an `activityFamily` since the art. 68^3 rule was written, and no caller ever supplied one, so
 * an accommodation taxpayer got the same confident figure as a software consultant. 6b is the fact, not a
 * mechanism — every assertion below goes through a stored `AppData` and the live assembler, and none of
 * them hand a context to the classifier by hand. That is the difference between proving a channel and
 * proving a channel that anybody can reach.
 *
 * The second half matters as much as the first: **no CAEN inference anywhere.** `research/30` §3 records
 * that OMFP 925/2017 art. 2 alin. (4) keys the determination method to the activity description
 * „independent de codurile CAEN menționate cu titlu exemplificativ”, so a code is not a statement about how
 * the law taxes this person. A profile carrying CAEN 5510 and no answer must not be refused for its code.
 *
 * The clock is pinned because the deductible set is period-scoped; the figures are not what this file
 * asserts, but the record set is.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { seedData } from '../data/seed';
import type { AppData } from '../data/types';
import { fixedInstant } from '../test/fixedInstant';
import { pinClock, unpinClock } from '../test/clock';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal';
import {
  scenarioCoverageGaps,
  selectEstimateOperands,
} from './estimateBasis';
import { evaluateScenarios, scenarioGaps, scenarioRefusal } from './scenarios';

const AS_OF = '2026-10-31';

afterEach(() => unpinClock());

function dataWith(over: Partial<AppData> = {}): AppData {
  return { ...seedData, ...over } as AppData;
}

function profileWith(over: Partial<AppData['profile']>): AppData {
  return dataWith({ profile: { ...seedData.profile, ...over } });
}

/**
 * The demo profile DECLARES a family (it is a fixture answering a question), so an unanswered profile has
 * to be built by removing it — copying the seed and passing nothing would leave the answer in place and
 * test the wrong payload.
 */
function profileWithoutAnswer(over: Partial<AppData['profile']> = {}): AppData {
  const profile = { ...seedData.profile, ...over } as AppData['profile'] & { activityFamily?: string };
  delete profile.activityFamily;
  return dataWith({ profile });
}

/** A profile whose register says, as clearly as a CAEN list can, "accommodation". */
function cazareCodeButNoAnswer(): AppData {
  return profileWithoutAnswer({
    identity: { ...seedData.profile.identity, caen: [{ cod: '5510', descriere: 'Hoteluri' }] },
  });
}

describe('the declared family reaches the classifier from stored data', () => {
  it('a profile that declares cazare is refused by the live assembler, with no hand-built context', () => {
    pinClock(fixedInstant());
    const operands = selectEstimateOperands(
      profileWith({ activityFamily: 'cazare' }),
      AS_OF,
      PFA_2026_SYSTEM_REAL_PACKAGE,
    );
    expect(operands.kind).toBe('refused');
    if (operands.kind !== 'run') {
      // The refusal is the registry's, and it travels with the outcome so the surface names the same id
      // the registry registered — not a sentence re-composed on the way out.
      //
      // PG-6h-1 moved which entry refuses an FY2026 cazare register. `no-expense-engine` said the app had
      // no method for this activity; it has one now, so that sentence would be false. What still stops the
      // figure is the gross: art. 68^3 alin. (3) leaves the platform-commission scope open and alin. (1)
      // puts the eligibility gate in tourism law, and neither may be defaulted.
      expect(operands.basis.kind).toBe('refused');
      expect(operands.basis.scenario.id).toBe('accommodation-gross-undetermined');
      expect(operands.basis.scenario.effect).toBe('refuse');
      expect(operands.basis.scenario.fixTarget).toEqual({ page: 'settings', tab: 'fiscal' });
      // The two open questions are the rule's own words, lifted from ACCOMMODATION_68X3_2026 — not a
      // paraphrase the app composed on the way out. The framing sentence that says the method IS
      // implemented is copy, rendered by `ScenarioRefusal` above this detail, and is not repeated here.
      expect(operands.basis.scenario.detail).toContain('comisionul reținut');
      expect(operands.basis.scenario.detail).toContain('operator economic');
      expect(operands.basis.scenario.detail).toContain('Citește A');
      expect(operands.basis.scenario.detail).toContain('Citește B');
      expect(operands.result.lines).toEqual([]);
    }
    // `no-expense-engine` is NOT the answer for FY2026 any more — the flat-ratio rule is selected, so the
    // absence of an art. 68 expense engine is what art. 68 alin. (1) prescribes rather than a gap.
    // PG-6h-2b (B-85) adds the attribution entry alongside it: the register's receipts cannot be split
    // between methods, so a second refusal is now true of the same payload. The surfaced one is still the
    // gross question, because registry order is precedence and that entry comes first.
    expect(operands.scenarios.map(s => s.id)).toEqual([
      'accommodation-gross-undetermined',
      'accommodation-method-attribution-missing',
    ]);
  });

  it('with no art. 68^3 rule in the selected set, the missing method is still the honest answer', () => {
    // PG-6h-1 kept `no-expense-engine` alive rather than deleting it, and this is the case that keeps it:
    // a rule set that carries no flat-ratio method. The app must not claim it can compute accommodation
    // income under a rule package that does not offer the method — the sentence stays true where it is true,
    // and stops being said where it is not.
    pinClock(fixedInstant());
    const withoutFlatRatio = PFA_2026_SYSTEM_REAL_PACKAGE.filter(
      (r) => r.taxRegime !== 'accommodation-flat-ratio',
    );
    const operands = selectEstimateOperands(
      profileWith({ activityFamily: 'cazare' }),
      AS_OF,
      withoutFlatRatio,
    );
    expect(operands.kind).toBe('refused');
    if (operands.kind !== 'run') {
      expect(operands.basis.scenario.id).toBe('no-expense-engine');
    }
  });

  it('the same register under a declared `other` computes, and no scenario fires at all', () => {
    pinClock(fixedInstant());
    const operands = selectEstimateOperands(
      profileWith({ activityFamily: 'other' }),
      AS_OF,
      PFA_2026_SYSTEM_REAL_PACKAGE,
    );
    expect(operands.kind).toBe('run');
    expect(operands.scenarios).toEqual([]);
  });

  it('an unanswered profile still computes — the gap is `incomplete`, never a refusal', () => {
    pinClock(fixedInstant());
    const unanswered = profileWithoutAnswer();
    const operands = selectEstimateOperands(unanswered, AS_OF, PFA_2026_SYSTEM_REAL_PACKAGE);
    expect(operands.kind).toBe('run');
    expect(scenarioRefusal(operands.scenarios)).toBeNull();
    expect(scenarioGaps(operands.scenarios).map(g => g.id)).toEqual(['activity-family-undeclared']);
  });

  it('the caller\'s own context still wins over the profile', () => {
    // Threading must not become an override: a test or a later phase that supplies a per-call fact is not
    // silently replaced by the stored profile. `other` on the profile, `cazare` in the call — the call wins.
    pinClock(fixedInstant());
    const operands = selectEstimateOperands(
      profileWith({ activityFamily: 'other' }),
      AS_OF,
      PFA_2026_SYSTEM_REAL_PACKAGE,
      { activityFamily: 'cazare' },
    );
    expect(operands.kind).toBe('refused');
  });
});

describe('no CAEN inference, anywhere (acceptance 5)', () => {
  it('a CAEN 5510 profile with no answer is not refused on the basis of its code', () => {
    pinClock(fixedInstant());
    const data = cazareCodeButNoAnswer();
    const operands = selectEstimateOperands(data, AS_OF, PFA_2026_SYSTEM_REAL_PACKAGE);
    expect(operands.kind).toBe('run');
    expect(scenarioRefusal(operands.scenarios)).toBeNull();
    // It is reported, but as a missing fact the person can supply — not as a legal conclusion drawn from
    // four digits in an identity field.
    expect(scenarioGaps(operands.scenarios).map(g => g.id)).toEqual(['activity-family-undeclared']);
  });

  it('a CAEN 5510 profile that answers `other` is not refused either', () => {
    pinClock(fixedInstant());
    const data = {
      ...cazareCodeButNoAnswer(),
      profile: { ...cazareCodeButNoAnswer().profile, activityFamily: 'other' as const },
    };
    const operands = selectEstimateOperands(data, AS_OF, PFA_2026_SYSTEM_REAL_PACKAGE);
    expect(operands.kind).toBe('run');
    expect(operands.scenarios).toEqual([]);
  });

  it('the detector never reads the CAEN list', () => {
    // Same register, two opposite CAEN lists, one answer: the detector's output cannot depend on the code,
    // because the only thing it reads is whether the profile declared a family.
    pinClock(fixedInstant());
    const withCode = cazareCodeButNoAnswer();
    const withoutCode = profileWithoutAnswer({ identity: { ...seedData.profile.identity, caen: [] } });
    const outcomes = [withCode, withoutCode].map(
      d => evaluateScenarios({ data: d, classifierRefusal: null }).map(o => o.id).join(','),
    );
    expect(outcomes[0]).toBe('activity-family-undeclared');
    expect(outcomes[1]).toBe('activity-family-undeclared');
  });
});

describe('the detector is total (landmine 3)', () => {
  it('survives an empty register, no start date, an empty CAEN array and no profile object', () => {
    const cases: AppData[] = [
      { ...profileWithoutAnswer(), revenues: [], expenses: [], filings: [], documents: [], clients: [], statements: [], snapshots: [] },
      profileWith({ pfaStartDate: undefined, pfaStartYear: 2026 }) as AppData,
      profileWithoutAnswer({ identity: { ...seedData.profile.identity, caen: [] } }),
      { revenues: [], expenses: [] } as unknown as AppData,
    ];
    for (const data of cases) {
      expect(() => evaluateScenarios({ data, classifierRefusal: null })).not.toThrow();
    }
    // A payload with no profile object has no profile to have failed to answer, so it produces no outcome
    // — the same answer `regimeScenario` gives for a missing regime.
    expect(evaluateScenarios({ data: cases[3]!, classifierRefusal: null })).toEqual([]);
    // Every other case is a profile that has not answered.
    expect(evaluateScenarios({ data: cases[0]!, classifierRefusal: null }).map(o => o.id)).toEqual([
      'activity-family-undeclared',
    ]);
  });
});

describe('the gap rides PG-1\'s channel, not a new one', () => {
  it('the undeclared family becomes a `fact_missing` coverage row pointing at the control', () => {
    pinClock(fixedInstant());
    const operands = selectEstimateOperands(profileWithoutAnswer(), AS_OF, PFA_2026_SYSTEM_REAL_PACKAGE);
    const rows = scenarioCoverageGaps(operands.scenarios);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.reason).toBe('fact_missing');
    expect(rows[0]!.kind).toBe('profile');
    expect(rows[0]!.amount).toBeNull();
    // A real route, in the form `parseRoute` reads — the same resolver `scenarios.routes.test.ts` follows.
    expect(rows[0]!.fixTarget).toBe('/settings#!/fiscal');
  });

  it('the scenarios reach the estimate the assembler produced, so no surface has to re-run the registry', () => {
    pinClock(fixedInstant());
    const operands = selectEstimateOperands(profileWithoutAnswer(), AS_OF, PFA_2026_SYSTEM_REAL_PACKAGE);
    if (operands.kind !== 'run') throw new Error('expected the estimate to run');
    // The outcome list is produced once, here, and travels on the operands; `attachEstimateBasis` puts it
    // on the estimate and `buildDashboardData` reads it from there. Nothing downstream re-runs a detector.
    expect(operands.scenarios.map(s => s.id)).toEqual(['activity-family-undeclared']);
    expect(operands.basis.kind).toBe('recorded-actuals');
  });
});
