/**
 * PG-6h-2b — the scenario entry that refuses a mixed-method year (defect B-85).
 *
 * `domain/tax.ts` now builds one income leg per SOURCE, so the 1,7 × base is no longer constructible in the
 * composition. This file pins the other half: the registry says out loud WHY the app may not mix the two
 * methods over one register, and it does so as a `SCENARIO_SUPPORT` entry rather than as a branch in
 * `selectEstimateOperands` — which is the contract PG-6a set and the reason 6b…6g only ever add a detector.
 *
 * The premise the entry rests on is the one the brief verified in the tree: a `Revenue` record carries no
 * category, no activity marker and no source. Its `tip` is 'factura' | 'notafactura', a document type. So
 * there is nothing to partition the register on, and the app must not invent a partition.
 *
 * The entry is deliberately the SECOND accommodation refusal in registry order. Today
 * `accommodation-gross-undetermined` already stops every accommodation register, and its sentence — with the
 * rule's own open questions rendered beneath it — is the reason a person sees. This one is the backstop for
 * the day that question is retired: resolving B-80, building 6h-3 or adding the art. 85 rule must not be the
 * thing that lets two methods meet over one register and produce a bigger number.
 */
import { describe, expect, it } from 'vitest';
import { seedData } from '../data/seed';
import type { AppData, Revenue } from '../data/types';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal';
import { accommodationOpenQuestions, selectEstimateOperands } from './estimateBasis';
import {
  SCENARIO_SUPPORT,
  evaluateScenarios,
  scenarioRefusal,
  type ScenarioFacts,
} from './scenarios';
import { scenarios as scenarioCopy } from '../ui/copy/scenarios';

const AS_OF = '2026-10-31';
const RULE_QUESTIONS = accommodationOpenQuestions(PFA_2026_SYSTEM_REAL_PACKAGE, 2026, AS_OF);

const ENTRY = SCENARIO_SUPPORT.find(s => s.id === 'accommodation-method-attribution-missing')!;

function receipt(over: Partial<Revenue> = {}): Revenue {
  return {
    id: 'rev-b85',
    tip: 'factura',
    nr: 'FCT-B85-1',
    date: '2026-06-10',
    collected: '2026-06-10',
    client: 'Oaspete',
    cui: 'RO0',
    valoareFaraTva: { amount: 10_000, currency: 'RON' } as never,
    tva: { amount: 0, currency: 'RON' } as never,
    status: 'inregistrata',
    ...over,
  } as Revenue;
}

function dataWith(over: Partial<AppData['profile']> = {}, revenues: Revenue[] = [receipt()]): AppData {
  return {
    ...seedData,
    profile: { ...seedData.profile, activityFamily: 'cazare', ...over },
    revenues,
  };
}

/**
 * The facts the assembler hands the registry, with the method stated rather than re-derived.
 *
 * `incomeDeterminationMethod` is the one fact PG-6h-2b adds, and it is the whole point of the entry: the
 * registry refuses the SAME register the engine is about to run, so it has to be told which method the
 * assembler selected instead of working out its own answer from `activityFamily`.
 */
function factsFor(
  profileOver: Partial<AppData['profile']> = {},
  factOver: Partial<ScenarioFacts> = {},
  revenues: Revenue[] = [receipt()],
): ScenarioFacts {
  const data = dataWith(profileOver, revenues);
  return {
    data,
    classifierRefusal: null,
    flatRatioMethodAvailable: true,
    flatRatioOpenQuestions: RULE_QUESTIONS,
    accommodationIncomeTitle: null,
    incomeDeterminationMethod: 'accommodation-flat-ratio',
    // Resolved the way the assembler resolves them — read off the profile, never defaulted here. Without
    // these two the "settled" fixture below would not be settled, and the test would prove nothing.
    accommodationCommissionReading: data.profile.accommodationCommissionReading,
    accommodationTourismEligibility: data.profile.accommodationTourismEligibility,
    ...factOver,
  };
}

describe('the attribution refusal fires for the register the engine would otherwise double-count', () => {
  it('a flat-ratio method over a register with receipts is refused, once', () => {
    const outcomes = evaluateScenarios(factsFor());
    const fired = outcomes.filter(o => o.id === 'accommodation-method-attribution-missing');
    expect(fired).toHaveLength(1);
    expect(fired[0].effect).toBe('refuse');
    expect(fired[0].message).toBe('accommodationAttributionMissing');
  });

  it('the refusal is the registry\'s, and it carries a fix target that is a real control', () => {
    expect(ENTRY.effect).toBe('refuse');
    expect(ENTRY.fixTarget).toEqual({ page: 'settings', tab: 'fiscal' });
    // `scenarios.routes.test.ts` walks SCENARIO_SUPPORT through `parseRoute`, so this entry's route is
    // checked there the moment it joined the registry. Asserted here too because a refusal whose link goes
    // nowhere is the failure this series treats as worse than no link.
    expect(SCENARIO_SUPPORT.map(s => s.id)).toContain('accommodation-method-attribution-missing');
  });

  it('the sentence names the missing attribution and claims nothing the research has not settled', () => {
    const sentence = scenarioCopy.messages.accommodationAttributionMissing;
    // It says what is missing: which receipts the method applies to.
    expect(sentence).toContain('încas');
    expect(sentence).toContain('registru');
    // It does not say the law forbids mixing the two methods — art. 68^3 alin. (11) contemplates a
    // taxpayer who has both — and it does not say the activity can never be computed, which D-CAZ-1
    // decided against.
    expect(sentence).not.toContain('nu este permisă');
    expect(sentence).not.toContain('nu se poate calcula niciodată');
    // It does not offer a split, a percentage or an assumption as the way out.
    expect(sentence).not.toMatch(/[0-9]+ ?%/);
  });
});

describe('the entry stays narrow, total, and free of inference', () => {
  it('a sistem-real register fires nothing about attribution', () => {
    const outcomes = evaluateScenarios(factsFor({}, { incomeDeterminationMethod: 'sistem-real' }));
    expect(outcomes.map(o => o.id)).not.toContain('accommodation-method-attribution-missing');
  });

  it('an absent method answer is not treated as sistem-real, and fires nothing', () => {
    const facts = factsFor();
    delete (facts as { incomeDeterminationMethod?: string }).incomeDeterminationMethod;
    expect(ENTRY.detect(facts)).toBeNull();
  });

  it('an empty register has no receipts to misattribute', () => {
    expect(ENTRY.detect(factsFor({}, {}, []))).toBeNull();
  });

  it('a receipt that is not inregistrata is not a receipt the engine would total', () => {
    expect(ENTRY.detect(factsFor({}, {}, [receipt({ status: 'annulata' as never })]))).toBeNull();
  });

  it('the art. 85 method is not this entry\'s register — a different title, a different basin', () => {
    // B-88. An art. 85 register is *cedarea folosinței bunurilor* (art. 155 alin. (1) lit. e)), and
    // `domain/tax.ts` gives it no lit. b) leg at all, so there is no pair of legs over one revenue for this
    // entry to refuse. The entries above own that register.
    const facts = factsFor(
      { accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 3 }] },
      { accommodationIncomeTitle: 'cedarea_folosintei', incomeDeterminationMethod: 'short-term-rooms-art85' },
    );
    expect(ENTRY.detect(facts)).toBeNull();
  });

  it('a cedarea title measured under art. 68^3 is still this entry\'s register (B-88, alin. (1) carve-out)', () => {
    // The title used to be the suppression, and B-88 removed it. art. 85 alin. (1) excludes „cei care
    // realizează venituri din activități independente pentru care sunt aplicabile prevederile art. 68^3”, so
    // a person in the 1–7 room range who has declared they are a tourism operator is measured under
    // art. 68^3 — and a 68^3 register over receipts is exactly the one whose receipts cannot be split.
    const facts = factsFor(
      { accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 3 }], accommodationTourismEligibility: 'da' },
      { accommodationIncomeTitle: 'cedarea_folosintei' },
    );
    expect(ENTRY.detect(facts)).not.toBeNull();
  });

  it('detect is total: no profile, no revenues array, no crash', () => {
    const broken = {
      data: { expenses: [] } as unknown as AppData,
      incomeDeterminationMethod: 'accommodation-flat-ratio',
    } satisfies Partial<ScenarioFacts> as ScenarioFacts;
    expect(() => ENTRY.detect(broken)).not.toThrow();
    expect(ENTRY.detect(broken)).toBeNull();
  });

  it('a tourism CAEN code answers nothing (no inference from a code)', () => {
    // A profile that never declared its family carries a Division 55 code and still gets no attribution
    // refusal: the method was never selected for it, and a code cannot select one.
    const facts = factsFor({
      identity: { ...seedData.profile.identity, caen: [{ cod: '5510', descriere: 'Hoteluri' }] },
    });
    delete (facts.data.profile as { activityFamily?: string }).activityFamily;
    delete (facts as { incomeDeterminationMethod?: string }).incomeDeterminationMethod;
    expect(ENTRY.detect(facts)).toBeNull();
  });
});

describe('the backstop holds when the gross question is retired', () => {
  /**
   * The case the brief is about. A person who has answered all three accommodation facts — room count above
   * 7 for the year, the alin. (1) eligibility answer, and a reading of alin. (3) — has no open rule question
   * left. That is the state a later task reaches when it resolves B-80, and it must not be the state in
   * which two methods first meet over one register.
   */
  const settled = () =>
    factsFor(
      {
        accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 9 }],
        accommodationCommissionReading: 'reading_a',
        accommodationTourismEligibility: 'da',
      },
      { accommodationIncomeTitle: 'activitate_independenta_68x3' },
    );

  it('every rule question is retired, and the attribution refusal still fires', () => {
    const facts = settled();
    const outcomes = evaluateScenarios(facts);
    // The gross entry has nothing left to ask, and the title entry does not apply to 9 camere.
    const gross = outcomes.find(o => o.id === 'accommodation-gross-undetermined');
    expect(gross?.detail ?? '').not.toContain('Citește A');
    expect(gross?.detail ?? '').not.toContain('operator economic');
    // The attribution entry fires on its own, with no detail to lean on — it is a fact the app never
    // recorded, not a question the person can answer.
    expect(ENTRY.detect(facts)).not.toBeNull();
    expect(outcomes.map(o => o.id)).toContain('accommodation-method-attribution-missing');
  });

  it('remove the gross entry and the register is still refused', () => {
    // The proof that the guard does not depend on the refusal the brief warns will one day go away: with
    // only this entry in play, the estimate still stops, so no later task can retire one refusal and
    // accidentally let the 1,7 × through.
    const facts = settled();
    const refusal = ENTRY.detect(facts);
    expect(refusal).not.toBeNull();
    expect(scenarioRefusal(evaluateScenarios(facts))).not.toBeNull();
  });

  it('the live assembler reports both refusals, and surfaces the gross one first', () => {
    // Registry order is precedence. The reason a person sees today stays the one with the rule's own open
    // questions rendered under it; the attribution refusal travels beside it rather than replacing it.
    const data = dataWith({
      accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 9 }],
      accommodationCommissionReading: 'reading_a',
      accommodationTourismEligibility: 'da',
    });
    const operands = selectEstimateOperands(data, AS_OF, [...PFA_2026_SYSTEM_REAL_PACKAGE]);
    expect(operands.kind).toBe('refused');
    if (operands.kind !== 'refused') return;
    expect(operands.basis.kind).toBe('refused');
    expect(operands.basis.scenario.id).toBe('accommodation-gross-undetermined');
    expect(operands.scenarios.map(s => s.id)).toContain('accommodation-method-attribution-missing');
    expect(operands.result.lines).toEqual([]);
  });
});
