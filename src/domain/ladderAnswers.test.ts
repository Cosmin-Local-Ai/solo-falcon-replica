/**
 * D-DPI-2 (B-152, unblocking B-116) — the three states of one art. 170 alin. (4) ladder category, and the
 * proof that two of them cannot collapse into each other.
 *
 * **What this file is for.** The ladder used to refuse unless all six categories held a number. D-DPI-2
 * narrowed that to „not all six are answered", which is only safe while `declared none` and `not asked yet`
 * stay different stored facts. If they ever merge — through a default, an optional field, a `?? 0`, a zod
 * `.default(`, or a form that submits an untouched control as „nu am avut” — the app reads silence as „no
 * other income” and **undercharges health contribution**. That is the exact failure `calcCassLadder`'s
 * refusal was built to prevent, so the acceptance criterion here is not „the feature works” but „the
 * collapse is impossible”.
 *
 * Every expected figure was derived by hand against the FY2026 anchor SM = 4.050 lei (CF art. 135¹ alin. (3);
 * research/48 §6), so 6 SM = 24.300 lei, 12 SM = 48.600 lei, 24 SM = 97.200 lei, and CASS = 10 % of the rung
 * (art. 174¹ alin. (1)).
 */
import { describe, expect, it } from 'vitest';
import {
  CASS_LADDER_ANSWER_VALUES,
  CASS_LADDER_CATEGORIES,
  CASS_LADDER_CATEGORY_NAMES,
  cassLadderCategoryFacts,
  cassLadderFactsForYear,
  cassLadderMissingCategories,
  type CassLadderAnswer,
  type CassLadderCategory,
  type CassLadderYear,
} from './models';
import { pfaProfileSchema } from './schema';
import { createDefaultProfile } from './profile';
import { dpiRecordConflict } from './dpi';
import { calculatorRegistry, type CalculatorResult, type CassLadderInput } from './fiscal/calculators';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import { lei, type Bani } from './money';

const cassRule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'CASS_2026')!;
const run = (input: CassLadderInput): CalculatorResult =>
  calculatorRegistry['calc-cass-ladder'](cassRule, { cassLadder: input });

function computed(result: CalculatorResult) {
  if ('reviewRequired' in result) throw new Error(`the ladder refused instead of computing: ${result.reason}`);
  return result;
}
function refusal(result: CalculatorResult): string {
  if (!('reviewRequired' in result)) {
    throw new Error(`the ladder computed ${result.value} lei instead of refusing`);
  }
  return result.reason;
}

/** Declare every category `none` except the overrides, which carry a figure. */
function allNoneExcept(
  figures: Partial<Record<CassLadderCategory, Bani>>,
): { amounts: Partial<Record<CassLadderCategory, Bani>>; answers: Partial<Record<CassLadderCategory, CassLadderAnswer>> } {
  const answers: Partial<Record<CassLadderCategory, CassLadderAnswer>> = {};
  const amounts: Partial<Record<CassLadderCategory, Bani>> = {};
  for (const c of CASS_LADDER_CATEGORIES) {
    if (c in figures) {
      answers[c] = 'amount';
      amounts[c] = figures[c];
    } else {
      answers[c] = 'none';
    }
  }
  return { amounts, answers };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// §6.4 of brief 78 — the resolver is the only place the two halves are read, and it has no path
// from an absent fact to `none`. This block is exhaustive over the input shapes on purpose.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('the tri-state resolver never turns silence into a declared absence', () => {
  it('the vocabulary is exactly amount / none / unknown, in that order', () => {
    expect(CASS_LADDER_ANSWER_VALUES).toEqual(['amount', 'none', 'unknown']);
  });

  it('a year that does not exist answers nothing: six unknowns, zero declared absences', () => {
    const facts = cassLadderFactsForYear(undefined);
    expect(facts).toHaveLength(6);
    expect(facts.every((f) => f.state === 'unknown')).toBe(true);
    expect(facts.some((f) => f.state === 'none')).toBe(false);
  });

  it('a year with no amounts and no answers is six unknowns, not six „nu am avut”', () => {
    const facts = cassLadderFactsForYear({ fiscalYear: 2026 });
    expect(facts.map((f) => f.state)).toEqual([
      'unknown', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown',
    ]);
  });

  it('an amount alone answers the category — the shape every payload since v16 is stored in', () => {
    const facts = cassLadderFactsForYear({ fiscalYear: 2026, investitii: lei(0) });
    const investitii = facts.find((f) => f.category === 'investitii')!;
    expect(investitii.state).toBe('amount');
    expect(investitii.amount).toBe(lei(0));
    // A declared zero is an answer. The other five stay unanswered.
    expect(cassLadderMissingCategories({ fiscalYear: 2026, investitii: lei(0) })).toHaveLength(5);
  });

  it('an explicit „nu am avut” is its own state, with no figure attached', () => {
    const facts = cassLadderFactsForYear({
      fiscalYear: 2026,
      ladderAnswers: { investitii: 'none' },
    });
    const investitii = facts.find((f) => f.category === 'investitii')!;
    expect(investitii.state).toBe('none');
    expect(investitii.amount).toBeUndefined();
  });

  it('an explicit „nu se știe” is `unknown`, and is NOT the same record as `none`', () => {
    const said = cassLadderFactsForYear({ fiscalYear: 2026, ladderAnswers: { investitii: 'unknown' } });
    const silent = cassLadderFactsForYear({ fiscalYear: 2026 });
    expect(said.find((f) => f.category === 'investitii')!.state).toBe('unknown');
    expect(silent.find((f) => f.category === 'investitii')!.state).toBe('unknown');
    // They agree on the state — both block the ladder — but the record keeps the answer that was given.
    expect(said.find((f) => f.category === 'investitii')!.answer).toBe('unknown');
    expect(silent.find((f) => f.category === 'investitii')!.answer).toBeUndefined();
  });

  it('„nu am avut” beside a figure is a contradiction, not a silent winner', () => {
    const facts = cassLadderFactsForYear({
      fiscalYear: 2026,
      investitii: lei(50_000),
      ladderAnswers: { investitii: 'none' },
    });
    const investitii = facts.find((f) => f.category === 'investitii')!;
    expect(investitii.state).toBe('conflict');
  });

  it('„am sumă” with no sum beside it is the same contradiction, mirrored', () => {
    const facts = cassLadderFactsForYear({
      fiscalYear: 2026,
      ladderAnswers: { investitii: 'amount' },
    });
    expect(facts.find((f) => f.category === 'investitii')!.state).toBe('conflict');
  });

  it('exhaustively: no combination of amounts without an explicit `none` ever yields `none`', () => {
    // Every subset of the six categories holding an amount, crossed with every answer token, and with
    // "no answer at all". `none` appears in the output exactly when `none` appeared in the input.
    const answerChoices: (CassLadderAnswer | undefined)[] = [undefined, 'amount', 'none', 'unknown'];
    for (let mask = 0; mask < 1 << CASS_LADDER_CATEGORIES.length; mask += 1) {
      const amounts: Partial<Record<CassLadderCategory, Bani>> = {};
      CASS_LADDER_CATEGORIES.forEach((c, i) => {
        if (mask & (1 << i)) amounts[c] = lei(1000);
      });
      for (const a of answerChoices) {
        for (const c of CASS_LADDER_CATEGORIES) {
          const answers: Partial<Record<CassLadderCategory, CassLadderAnswer>> = {};
          if (a !== undefined) answers[c] = a;
          const fact = cassLadderCategoryFacts(amounts, answers).find((f) => f.category === c)!;
          if (a !== 'none') {
            expect(fact.state, `category ${c}, amount present=${(mask >> CASS_LADDER_CATEGORIES.indexOf(c)) & 1}, answer=${a}`).not.toBe('none');
          } else if (amounts[c] === undefined) {
            expect(fact.state).toBe('none');
          }
        }
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// §6.2 — a payload with an explicitly `none` category lets the ladder proceed, and the resulting
// CASS figure is asserted. This is the whole point of D-DPI-2, so it is pinned with a number.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('a declared „nu am avut” unblocks the ladder, and the figure is the figure', () => {
  it('five declared absences and one 30.000-lei figure compute: 6 SM base, 2.430 lei CASS', () => {
    const result = computed(run(allNoneExcept({ proprietate_intelectuala: lei(30_000) })));
    // 30.000 ≥ 24.300 and < 48.600 → the 6-SM rung (art. 170 alin. (2)-(4)), 10 % of it (art. 174¹ alin. (1)).
    expect(result.determinedNet).toBe(lei(24_300));
    expect(result.value).toBe(lei(2_430));
  });

  it('the breakdown says which categories were declared absent, in words, not as a bare 0', () => {
    const result = computed(run(allNoneExcept({ investitii: lei(50_000) })));
    const text = result.breakdown.join('\n');
    expect(text).toContain('„nu am avut” — categorie declarată fără venit');
    // The line that makes the difference readable: the ladder ran because all six were ANSWERED.
    expect(text).toMatch('toate cele șase categorii au un RĂSPUNS');
    // A declared absence must not be printed as though the person had typed a zero.
    const noneLine = result.breakdown.find((l) => l.includes('activități agricole') && l.includes('nu am avut'))!;
    expect(noneLine).not.toMatch(/: 0 lei/);
  });

  it('six declared absences compute to no CASS — and say so as six answers, not as a gap', () => {
    const result = computed(run(allNoneExcept({})));
    expect(result.value).toBe(lei(0));
    expect(result.determinedNet).toBe(lei(0));
    expect(result.breakdown.join('\n')).toContain('„nu am avut”');
  });

  it('a declared absence still cannot smuggle an unqualified „alte surse” past the art. 114 gate', () => {
    // The D-OTH-2 gate is about an amount; a declared absence is a zero and passes. A POSITIVE amount
    // without the art. 114 answer must still refuse, tri-state or not.
    const answers: Partial<Record<CassLadderCategory, CassLadderAnswer>> = {};
    const amounts: Partial<Record<CassLadderCategory, Bani>> = {};
    for (const c of CASS_LADDER_CATEGORIES) {
      answers[c] = c === 'alte_surse' ? 'amount' : 'none';
      if (c === 'alte_surse') amounts[c] = lei(10_000);
    }
    expect(refusal(run({ amounts, answers }))).toMatch(/art. 114/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// §6.3 — one `unknown` among five answered still refuses, and says WHICH category.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('one unanswered category among five answered still refuses', () => {
  it('names the category that is missing, in the words the person reads', () => {
    const { amounts, answers } = allNoneExcept({ proprietate_intelectuala: lei(30_000) });
    delete answers.investitii; // answered five, left one unasked
    const reason = refusal(run({ amounts, answers }));
    expect(reason).toContain(
      CASS_LADDER_CATEGORY_NAMES.investitii,
    );
    expect(reason).toMatch(/1 nu au niciun răspuns/);
    // Never the stored identifier on screen.
    expect(reason).not.toContain('investitii:');
  });

  it('a category explicitly answered „nu se știe” blocks the ladder exactly like silence', () => {
    const { amounts, answers } = allNoneExcept({ investitii: lei(50_000) });
    answers.alte_surse = 'unknown';
    expect(refusal(run({ amounts, answers }))).toContain(CASS_LADDER_CATEGORY_NAMES.alte_surse);
  });

  it('a contradiction between the two stored halves refuses, and names the category', () => {
    const { amounts, answers } = allNoneExcept({ proprietate_intelectuala: lei(30_000) });
    answers.investitii = 'none';
    amounts.investitii = lei(7_000); // „nu am avut” beside a figure
    const reason = refusal(run({ amounts, answers }));
    expect(reason).toMatch(/se contrazic/);
    expect(reason).toContain(CASS_LADDER_CATEGORY_NAMES.investitii);
  });

  it('all six unanswered still refuses with the "nothing was declared" sentence, not a computed zero', () => {
    expect(refusal(run({}))).toMatch('Aceasta nu este o afirmație că persoana nu a avut astfel de venituri.');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// §4 of the brief — the load gate declares the field BEFORE the step that reads it, and declares it
// without a default. zod strips undeclared keys, so an undeclared field would vanish on the next
// save-and-load and the collapse would arrive as a passing test.
// ─────────────────────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────────────────────
// §6.6 of brief 78 — the guard that makes the typed net safe to keep. Brief 78 did NOT retire
// `CassLadderYear.proprietateIntelectuala`, so the double representation is still live, and the guard that
// made it survivable must still be up. Removing it early is what would turn "two producers" into "whichever
// one the code happens to read first".
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('the DPI guards that make the typed net survivable are still up', () => {
  it('a record whose declared kind contradicts its declared DPI contract still conflicts', () => {
    // `dpiRecordConflict` is the record-level half: it does not compare amounts, it notices that one receipt
    // claims two incompatible things. It gates the register tag AND the coverage row, and it is unchanged by
    // the tri-state work.
    const conflict = dpiRecordConflict({
      id: 'r-1',
      incomeCategory: 'activitate_independenta',
      dpiContractType: 'cesiune_licenta',
    } as unknown as Parameters<typeof dpiRecordConflict>[0]);
    expect(conflict).not.toBeNull();
    // A coherent record carries no conflict — the guard is a contradiction test, not a DPI test.
    expect(
      dpiRecordConflict({
        id: 'r-2',
        incomeCategory: 'drepturi_de_proprietate_intelectuala',
        dpiContractType: 'cesiune_licenta',
      } as unknown as Parameters<typeof dpiRecordConflict>[0]),
    ).toBeNull();
  });

  it('the typed ladder net and a recorded DPI gross are two producers, and the resolver does not merge them', () => {
    // The category-level half of the same fact. `cassLadderCategoryFacts` reads what the record says; it
    // never folds a computed amount into a declared one, and `tax.ts` posts NEITHER when both producers
    // exist for the year (pinned end-to-end in `dpi.path.test.ts`, `dpi_income_double_represented`).
    const facts = cassLadderFactsForYear({
      fiscalYear: 2026,
      proprietateIntelectuala: lei(48_000),
      ladderAnswers: { proprietate_intelectuala: 'amount' },
    });
    const dpi = facts.find((f) => f.category === 'proprietate_intelectuala')!;
    expect(dpi.state).toBe('amount');
    expect(dpi.amount).toBe(lei(48_000));
    // Nothing here has consulted the recorded gross, and nothing here has averaged the two.
  });
});

describe('the persisted gate declares ladderAnswers, and defaults nothing', () => {
  // Built from the app's own default profile rather than a hand-written literal: the gate is the thing
  // under test, and a hand-built profile that happens to satisfy half of it tests a shape nobody stores.
  const baseProfile = createDefaultProfile();

  it('the gate accepts a declared „nu am avut” and it survives the parse', () => {
    const parsed = pfaProfileSchema.parse(
      createDefaultProfile({
        ...baseProfile,
        cassLadderYears: [{ fiscalYear: 2026, ladderAnswers: { investitii: 'none' } }],
      }),
    );
    expect(parsed.cassLadderYears?.[0].ladderAnswers).toEqual({ investitii: 'none' });
  });

  it('a payload with the field absent parses, and the field stays absent — it is not defaulted to none', () => {
    const parsed = pfaProfileSchema.parse(
      createDefaultProfile({
        ...baseProfile,
        cassLadderYears: [{ fiscalYear: 2026, investitii: lei(1000) }],
      }),
    );
    expect('ladderAnswers' in (parsed.cassLadderYears?.[0] ?? {})).toBe(false);
    expect(cassLadderMissingCategories(parsed.cassLadderYears?.[0])).toHaveLength(5);
  });

  it('an unknown token is rejected rather than coerced, so no fifth state can reach storage', () => {
    const result = pfaProfileSchema.safeParse(
      createDefaultProfile({
        ...baseProfile,
        cassLadderYears: [
          {
            fiscalYear: 2026,
            // Deliberately not a token the vocabulary holds — the type rejects it, which is half of what
            // this test is about; the cast only exists to ask the RUNTIME gate the same question.
            ladderAnswers: { investitii: 'nu am avut' } as unknown as CassLadderYear['ladderAnswers'],
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('the gate names exactly the six categories the engine sums — one vocabulary, not two (B-122)', () => {
    // Behavioural, not introspective: every category the engine sums must be accepted by the gate, and a
    // seventh key must be stripped. If the two lists ever drift, one of these two halves fails.
    const answers = Object.fromEntries(CASS_LADDER_CATEGORIES.map((c) => [c, 'none' as const]));
    const parsed = pfaProfileSchema.parse(
      createDefaultProfile({
        ...baseProfile,
        cassLadderYears: [
          {
            fiscalYear: 2026,
            ladderAnswers: {
              ...answers,
              activitati_neexistente: 'none',
            } as unknown as CassLadderYear['ladderAnswers'],
          },
        ],
      }),
    );
    const stored = parsed.cassLadderYears?.[0].ladderAnswers ?? {};
    for (const c of CASS_LADDER_CATEGORIES) expect(stored[c]).toBe('none');
    expect('activitati_neexistente' in stored).toBe(false);
    expect(Object.keys(stored)).toHaveLength(CASS_LADDER_CATEGORIES.length);
  });
});
