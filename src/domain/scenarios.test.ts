/**
 * PG-6a — the contract of the scenario-support registry.
 *
 * These tests do not exercise a scenario's fiscal content; the registry has none. They hold the four
 * properties that decide whether the framework is worth routing anything through:
 *
 * 1. **`detect` is total.** A profile with no records, no start date or an empty register is a normal
 *    input. A detector that throws turns a refusal into a crash, and a crash renders nothing.
 * 2. **Nothing is invented.** A scenario fires only on a fact already in `facts`. In particular no
 *    detector guesses an activity family from a CAEN code — that is B-29's real gap, and PG-6b supplies
 *    the fact, not a guess.
 * 3. **`incomplete` and `refuse` stay distinct**, in the outcome and in what it becomes downstream.
 * 4. **One registry, one evaluation point.** A later part adds an entry to `SCENARIO_SUPPORT`; it does
 *    not add a mechanism. The last test in this file is a guard on that, not a description of it.
 */
import { describe, expect, it } from 'vitest';
import { seedData } from '../data/seed';
import type { AppData } from '../data/types';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal';
import { expenseEngineRefusal } from './fiscal/deductibility';
import { scenarioCoverageGaps, selectEstimateOperands } from './estimateBasis';
import {
  SCENARIO_SUPPORT,
  evaluateScenarios,
  scenarioFixHref,
  scenarioGaps,
  scenarioRefusal,
  type ScenarioFacts,
  type ScenarioOutcome,
} from './scenarios';

const AS_OF = '2026-10-31';

function facts(over: Partial<AppData> = {}, classifierRefusal: ScenarioFacts['classifierRefusal'] = null): ScenarioFacts {
  return { data: { ...seedData, ...over } as AppData, classifierRefusal };
}

describe('the registry is total — landmine 5', () => {
  it('runs every registered detector against a register with nothing in it', () => {
    const empty = facts({ revenues: [], expenses: [], filings: [], documents: [], clients: [], statements: [], snapshots: [] });
    expect(() => evaluateScenarios(empty)).not.toThrow();
    expect(evaluateScenarios(empty)).toEqual([]);
  });

  it('runs every registered detector against a profile with no start date and no regime', () => {
    // Cast, not a lie: this is the shape a payload read off disk can actually have, and the point of the
    // test is that a detector survives it.
    const bare = facts({
      profile: { ...seedData.profile, pfaStartYear: undefined, regime: undefined } as unknown as AppData['profile'],
      revenues: [],
      expenses: [],
    });
    expect(() => evaluateScenarios(bare)).not.toThrow();
    // A missing regime is not a regime the app can refuse: the engine's own input gate answers that,
    // and a scenario that claimed it would be guessing at what the profile means.
    expect(evaluateScenarios(bare)).toEqual([]);
  });

  it('runs every registered detector against a payload whose profile object is absent', () => {
    const broken = { data: { revenues: [], expenses: [] } as unknown as AppData, classifierRefusal: null };
    expect(() => evaluateScenarios(broken)).not.toThrow();
    expect(evaluateScenarios(broken)).toEqual([]);
  });
});

describe('the registered scenarios fire on recorded facts only', () => {
  it('the lawful regime fires nothing', () => {
    const outcomes = evaluateScenarios(facts({ profile: { ...seedData.profile, regime: 'impozit_pe_venit' } }));
    expect(outcomes).toEqual([]);
  });

  it('a regime this package cannot compute is a refusal, with the rule layer\'s own sentence', () => {
    const outcomes = evaluateScenarios(facts({ profile: { ...seedData.profile, regime: 'impozit_pe_cit' } }));
    const refusal = scenarioRefusal(outcomes);
    expect(refusal?.id).toBe('regime-not-computable');
    expect(refusal?.effect).toBe('refuse');
    // Verbatim from `regimes.ts` — the same sentence the profile editor and the engine use. The registry
    // frames a refusal; it does not rewrite the rule.
    expect(refusal?.detail).toContain('nu poate aparține unui PFA');
    expect(refusal?.detail).toContain('art. 13 alin. (1)');
  });

  it('a regime the app can record but not compute is refused on the same channel', () => {
    const outcomes = evaluateScenarios(facts({ profile: { ...seedData.profile, regime: 'norma_venit' } }));
    expect(scenarioRefusal(outcomes)?.id).toBe('regime-not-computable');
  });

  it('the classifier refusal becomes a scenario outcome, and only when the classifier refused', () => {
    const refusal = expenseEngineRefusal(
      { activityFamily: 'cazare' },
      PFA_2026_SYSTEM_REAL_PACKAGE,
      { taxYear: 2026, asOfDate: AS_OF },
    );
    expect(refusal).not.toBeNull();
    const outcomes = evaluateScenarios(facts({}, refusal));
    const fired = scenarioRefusal(outcomes);
    expect(fired?.id).toBe('no-expense-engine');
    expect(fired?.detail).toContain('nu lasă niciun motor de cheltuieli');
  });

  it('no activity-family fact means no scenario — the app holds the gap and invents no answer', () => {
    // The register is full, the profile is a normal one, and nothing fires. That is the honest state:
    // B-29 is that no caller supplies the fact, and a detector that inferred cazare from a CAEN code
    // would manufacture the very fact whose absence it is supposed to report.
    expect(evaluateScenarios(facts())).toEqual([]);
  });
});

describe('one evaluation point, one precedence rule', () => {
  it('the first registered refusal is the one that stops the estimate', () => {
    const refusal = expenseEngineRefusal(
      { activityFamily: 'cazare' },
      PFA_2026_SYSTEM_REAL_PACKAGE,
      { taxYear: 2026, asOfDate: AS_OF },
    );
    const outcomes = evaluateScenarios(facts({ profile: { ...seedData.profile, regime: 'impozit_pe_cit' } }, refusal));
    expect(outcomes.length).toBe(2);
    // Registry order, deterministically — not whichever detector happened to be cheapest.
    expect(scenarioRefusal(outcomes)?.id).toBe(SCENARIO_SUPPORT[0].id);
  });

  it('selectEstimateOperands is the only production call site of the evaluation', () => {
    // The guard on the acceptance criterion. A second call site would be a second mechanism wearing the
    // registry's name, and PG-6b…6g would inherit the duplication rather than a contract.
    // `scenarioCoverageGaps` is the projection of an outcome onto PG-1's channel, not an evaluation.
    const operands = selectEstimateOperands(seedData, AS_OF, PFA_2026_SYSTEM_REAL_PACKAGE);
    expect(operands.scenarios).toEqual([]);
  });
});

describe('`incomplete` is projected onto PG-1\'s channel, not put beside it', () => {
  // A detector built inside the test, deliberately NOT registered in the app: PG-6a ships no
  // `incomplete` scenario of its own (those are 6b…6g), and a demo scenario in the registry would be
  // exactly the "framework with only demo scenarios in it" the brief rules out. What is under test is
  // the seam a later part plugs into.
  const outcome: ScenarioOutcome = {
    id: 'test-missing-fact',
    effect: 'incomplete',
    message: 'noExpenseEngine',
    fixTarget: { page: 'settings', tab: 'fiscal' },
    detail: 'Lipsește o faptă de profil.',
  };

  it('an incomplete outcome becomes a `fact_missing` coverage gap', () => {
    const gaps = scenarioCoverageGaps([outcome]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].reason).toBe('fact_missing');
    expect(gaps[0].kind).toBe('profile');
    // A fact the app never held took no sum out of the figure. `0` would print a lei amount for a
    // number nobody recorded, and would move a weighted percentage that has no record to divide.
    expect(gaps[0].amount).toBeNull();
    expect(gaps[0].recordId).toBe('scenario:test-missing-fact');
    expect(gaps[0].fixTarget).toBe('/settings#!/fiscal');
  });

  it('a refusal never becomes a coverage gap', () => {
    expect(scenarioGaps([{ ...outcome, effect: 'refuse' }])).toEqual([]);
    expect(scenarioCoverageGaps([{ ...outcome, effect: 'refuse' }])).toEqual([]);
  });
});

describe('a fix target resolves to a route', () => {
  it('every registered target builds a URL the app\'s own router parses', () => {
    for (const scenario of SCENARIO_SUPPORT) {
      const href = scenarioFixHref(scenario.fixTarget);
      expect(href.startsWith('/')).toBe(true);
      expect(scenario.fixTarget.page).not.toBe('dashboard');
    }
  });
});
