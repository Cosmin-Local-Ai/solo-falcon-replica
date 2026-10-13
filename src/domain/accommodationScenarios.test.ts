/**
 * PG-6h-2 — the scenario registry, driven by the three accommodation facts.
 *
 * 6h-1 registered `accommodation-gross-undetermined` and said the gross was not settled. 6h-2 supplies the
 * facts that decide whether it can be, and this file is where the two halves meet:
 *
 *   | declared family | rooms for the year | answers          | outcome                                        |
 *   |-----------------|--------------------|------------------|------------------------------------------------|
 *   | `cazare`        | not recorded       | —                | `accommodation-gross-undetermined`, **both** questions open, no title asserted |
 *   | `cazare`        | 1–7                | any              | `accommodation-title-cedarea-folosintei` — a different TITLE, not an unsettled gross |
 *   | `cazare`        | > 7                | unanswered       | `accommodation-gross-undetermined`, both questions open |
 *   | `cazare`        | > 7                | partly answered  | the same refusal, with only the unanswered question still shown |
 *   | `other`         | any                | any              | nothing fires                                  |
 *
 * The middle row is the one the brief calls the category switch: 3 rooms and 9 rooms are not two
 * magnitudes of one calculation, so they must not produce the same refusal, and answering the commission
 * and eligibility questions must not move a 1–7 room register out of *cedarea folosinței bunurilor*.
 *
 * The last pair of rows holds the two refusals apart from the one thing that would make them a lie: no
 * combination of answers produces a figure in this build. The register-level calculation the app runs is
 * still the effective-expense one, and `estimateBasis.ts selectDeductibleExpenses` returns an empty expense
 * set plus a classifier refusal for a `cazare` register — so running the flat ratio beside it would
 * measure the same receipts twice. Separating the two legs belongs to a task that may touch `domain/tax.ts`.
 */
import { describe, expect, it } from 'vitest';
import { seedData } from '../data/seed';
import type { AppData } from '../data/types';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal';
import { accommodationOpenQuestions, selectEstimateOperands } from './estimateBasis';
import {
  SCENARIO_SUPPORT,
  evaluateScenarios,
  scenarioRefusal,
  type ScenarioFacts,
} from './scenarios';

const AS_OF = '2026-10-31';
const RULE_QUESTIONS = accommodationOpenQuestions(PFA_2026_SYSTEM_REAL_PACKAGE, 2026, AS_OF);

function profileWith(over: Partial<AppData['profile']> = {}): AppData {
  return { ...seedData, profile: { ...seedData.profile, ...over } };
}

/** The facts the assembler would hand the registry for a profile in this state. */
function factsFor(over: Partial<AppData['profile']> = {}): ScenarioFacts {
  const data = profileWith({ activityFamily: 'cazare', ...over });
  return {
    data,
    classifierRefusal: null,
    flatRatioMethodAvailable: true,
    flatRatioOpenQuestions: RULE_QUESTIONS,
    accommodationIncomeTitle: titleOf(data),
    accommodationCommissionReading: data.profile.accommodationCommissionReading,
    accommodationTourismEligibility: data.profile.accommodationTourismEligibility,
  };
}

/** Resolved the way the assembler resolves it — through the model, never re-derived here. */
function titleOf(data: AppData) {
  const rooms = data.profile.accommodationRoomCounts?.find(
    r => r.fiscalYear === data.profile.fiscalYear,
  )?.rooms;
  if (rooms === undefined) return null;
  return rooms > 7 ? 'activitate_independenta_68x3' : 'cedarea_folosintei';
}

describe('an unrecorded room count asserts no title (acceptance 1)', () => {
  it('a cazare profile with no room count is refused, and both rule questions stay open', () => {
    const outcomes = evaluateScenarios(factsFor());
    const refusal = scenarioRefusal(outcomes);
    expect(refusal?.id).toBe('accommodation-gross-undetermined');
    // Both readings of alin. (3) and the alin. (1) gate are still open, because while the title is
    // undecided neither can be retired: whether alin. (3) reaches this income at all is part of what the
    // room count decides.
    expect(refusal?.detail).toContain('Citește A');
    expect(refusal?.detail).toContain('Citește B');
    expect(refusal?.detail).toContain('autorizația ONRC');
  });

  it('the unknown state is not the cedarea state — no title is inferred from silence', () => {
    const outcomes = evaluateScenarios(factsFor());
    expect(outcomes.some(o => o.id === 'accommodation-title-cedarea-folosintei')).toBe(false);
  });
});

describe('1–7 rooms is a different title, not an unsettled gross (acceptance 2)', () => {
  it('3 rooms refuses on the title, and the gross scenario does not fire', () => {
    const outcomes = evaluateScenarios(factsFor({ accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 3 }] }));
    const refusal = scenarioRefusal(outcomes);
    expect(refusal?.id).toBe('accommodation-title-cedarea-folosintei');
    expect(outcomes.some(o => o.id === 'accommodation-gross-undetermined')).toBe(false);
    // One refusal per register: two firing at once would leave the reader guessing which one the app means.
    expect(outcomes.filter(o => o.effect === 'refuse')).toHaveLength(1);
  });

  it('7 rooms is still cedarea folosinței — the boundary is „peste 7”, not „7 sau mai mult”', () => {
    const outcomes = evaluateScenarios(factsFor({ accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 7 }] }));
    expect(scenarioRefusal(outcomes)?.id).toBe('accommodation-title-cedarea-folosintei');
  });

  it('answering the commission and eligibility questions does not move a 1–7 room register', () => {
    // The answers decide a gross. They do not decide a title, and a title is what this register turns on.
    const outcomes = evaluateScenarios(
      factsFor({
        accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 4 }],
        accommodationCommissionReading: 'reading_a',
        accommodationTourismEligibility: 'da',
      }),
    );
    expect(scenarioRefusal(outcomes)?.id).toBe('accommodation-title-cedarea-folosintei');
  });
});

describe('more than 7 rooms is the art. 68^3 title, and the answers retire their own question', () => {
  it('9 rooms is the gross scenario, with both questions still open', () => {
    const outcomes = evaluateScenarios(factsFor({ accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 9 }] }));
    expect(scenarioRefusal(outcomes)?.id).toBe('accommodation-gross-undetermined');
    expect(outcomes.some(o => o.id === 'accommodation-title-cedarea-folosintei')).toBe(false);
  });

  it('a recorded commission reading retires the gross-scope question and keeps the eligibility one', () => {
    const detail = scenarioRefusal(
      evaluateScenarios(
        factsFor({
          accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 9 }],
          accommodationCommissionReading: 'reading_a',
        }),
      ),
    )?.detail;
    expect(detail).not.toContain('Citește A');
    expect(detail).toContain('autorizația ONRC');
  });

  it('a recorded eligibility answer retires the alin. (1) question and keeps the gross-scope one', () => {
    const detail = scenarioRefusal(
      evaluateScenarios(
        factsFor({
          accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 9 }],
          accommodationTourismEligibility: 'da',
        }),
      ),
    )?.detail;
    expect(detail).toContain('Citește A');
    expect(detail).not.toContain('autorizația ONRC');
  });

  it('answering everything still refuses: the app cannot run this regime on a register yet', () => {
    // This is the honest half of the task. The arithmetic exists, the facts now exist, and the figure still
    // does not — because the register-level calculation is still the effective-expense one and the two legs
    // would double-count the same receipts. A refusal that lifted here would be a wrong number.
    const outcomes = evaluateScenarios(
      factsFor({
        accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 9 }],
        accommodationCommissionReading: 'reading_a',
        accommodationTourismEligibility: 'da',
      }),
    );
    const refusal = scenarioRefusal(outcomes);
    expect(refusal?.id).toBe('accommodation-gross-undetermined');
    // Nothing left to ask, so the block carries the framing sentence alone rather than a stale question.
    expect(refusal?.detail).toBeNull();
  });
});

describe('no CAEN code answers anything (acceptance 5)', () => {
  it('a tourism CAEN code changes no outcome, in either direction', () => {
    const withCode = factsFor({
      identity: { ...seedData.profile.identity, caen: [{ cod: '5510', descriere: 'Hoteluri' }] },
    });
    const withoutCode = factsFor();
    expect(evaluateScenarios(withCode)).toEqual(evaluateScenarios(withoutCode));
  });

  it('a profile that declares `other` fires no accommodation scenario, whatever the room count says', () => {
    const outcomes = evaluateScenarios(
      factsFor({
        activityFamily: 'other',
        accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 12 }],
      }),
    );
    expect(outcomes).toEqual([]);
  });
});

describe('the new entry obeys the framework contract', () => {
  it('the registry gains one entry per task, in precedence order, and nothing else changes', () => {
    // PG-6h-2 added the title entry; PG-6h-2b (B-85) added the attribution entry. Both arrived as
    // `SCENARIO_SUPPORT` entries rather than as branches in `selectEstimateOperands`, which is the
    // contract this list pins. The order is precedence, and the attribution entry sits after the gross
    // one so the reason a person sees today stays the one with the rule's own open questions under it.
    expect(SCENARIO_SUPPORT.map(s => s.id)).toEqual([
      'no-expense-engine',
      'accommodation-gross-undetermined',
      'accommodation-title-cedarea-folosintei',
      'accommodation-method-attribution-missing',
      'regime-not-computable',
      'activity-family-undeclared',
    ]);
  });

  it('every detector stays total against degenerate payloads carrying the new facts', () => {
    const broken = {
      data: { revenues: [], expenses: [] } as unknown as AppData,
      classifierRefusal: null,
      flatRatioMethodAvailable: true,
      flatRatioOpenQuestions: RULE_QUESTIONS,
      accommodationIncomeTitle: 'cedarea_folosintei',
      accommodationCommissionReading: 'reading_b',
      accommodationTourismEligibility: 'nu',
    } satisfies ScenarioFacts;
    expect(() => evaluateScenarios(broken)).not.toThrow();
    expect(evaluateScenarios(broken)).toEqual([]);
  });

  it('a year with no art. 68^3 rule still refuses at the engine level, not at the title level', () => {
    // FY2027 has no rule package. `flatRatioMethodAvailable` is false, so the classifier's refusal is the
    // truthful stop and the accommodation entries stay silent — the title facts do not manufacture a rule.
    const outcomes = evaluateScenarios({
      data: profileWith({
        activityFamily: 'cazare',
        accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 3 }],
      }),
      classifierRefusal: {
        rule: PFA_2026_SYSTEM_REAL_PACKAGE.find(r => r.ruleId === 'EXPENSE_ENGINE_CAZARE_2026')!,
        reason: 'fără motor de cheltuieli',
      } as never,
      flatRatioMethodAvailable: false,
      flatRatioOpenQuestions: null,
      accommodationIncomeTitle: 'cedarea_folosintei',
    });
    expect(scenarioRefusal(outcomes)?.id).toBe('no-expense-engine');
  });
});

describe('the assembler threads the facts from stored data, not from a hand-built context', () => {
  it('a stored cazare profile with 3 rooms is no longer refused — the art. 85 rule decides the method (B-88)', () => {
    // This is the move B-88 was for. Until `ACCOMMODATION_ART85_ROOMS_2026` existed, a 1–7 room register
    // had no rule to be measured under and the title entry refused it. The rule now exists for FY2026, so
    // the assembler selects the art. 85 method and hands the engine a gross with that method attached.
    const operands = selectEstimateOperands(
      profileWith({ activityFamily: 'cazare', accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 3 }] }),
      AS_OF,
      [...PFA_2026_SYSTEM_REAL_PACKAGE],
    );
    expect(operands.kind).toBe('run');
    if (operands.kind !== 'run') return;
    expect(operands.scenarios.filter(s => s.effect === 'refuse')).toEqual([]);
    expect(operands.amounts.flatRatioMethod).toBe('short-term-rooms-art85');
    expect(typeof operands.amounts.flatRatioGross).toBe('number');
  });

  it('a 1–7 room count in a year with no art. 85 rule still refuses on the title', () => {
    // The rule is year-scoped. A 2027 profile has no FY2027 package, so the sentence that says the package
    // carries no rule for art. 85 is still the true one there.
    const operands = selectEstimateOperands(
      profileWith({
        fiscalYear: 2027,
        activityFamily: 'cazare',
        accommodationRoomCounts: [{ fiscalYear: 2027, rooms: 3 }],
      }),
      '2027-10-31',
      [],
    );
    expect(operands.kind).toBe('refused');
    if (operands.kind !== 'refused') return;
    expect(operands.basis.scenario?.id).toBe('accommodation-title-cedarea-folosintei');
  });

  it('the same profile with 9 rooms reaches the gross refusal instead', () => {
    const operands = selectEstimateOperands(
      profileWith({ activityFamily: 'cazare', accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 9 }] }),
      AS_OF,
      [...PFA_2026_SYSTEM_REAL_PACKAGE],
    );
    expect(operands.kind).toBe('refused');
    if (operands.kind !== 'refused') return;
    expect(operands.basis.scenario?.id).toBe('accommodation-gross-undetermined');
  });
});
