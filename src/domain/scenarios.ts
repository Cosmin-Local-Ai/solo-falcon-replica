/**
 * PG-6a — the scenario-support registry: the one channel for „this profile is outside what the app
 * is allowed to compute".
 *
 * Before this module the app had exactly one refusal, written inline in
 * `estimateBasis.ts selectEstimateOperands`: the expense classifier had no engine for the activity
 * (CF art. 68^3), so the assembler returned a `review_required` result and the engine was skipped.
 * That was correct, and it was also the only case that could ever be refused — every other
 * unsupported profile situation fell through and produced a confident number instead. PG-6 has six
 * such situations (activity family, vehicle facts, other income, fixed assets, deductible VAT, the
 * Form 300 setup path). If each one grew its own `if`, the app would have six mechanisms for one
 * question, which is what brief 28 §0 rule 6 forbids.
 *
 * So this module owns the mechanism and nothing else:
 *
 * - **A registry** of `ScenarioSupport` entries — `{ id, detect, effect, message, fixTarget }`.
 *   Adding a scenario in PG-6b…6g means adding an entry here, not a new code path anywhere.
 * - **One evaluation point** — `evaluateScenarios`. It is called once, from
 *   `estimateBasis.ts selectEstimateOperands`, and its outcome travels with the estimate.
 * - **Two effects that stay distinct.** `refuse` is the law not letting the app compute a number at
 *   all; `incomplete` is a fact the user can still supply, where a number exists but does not cover
 *   everything. `refuse` replaces the figure; `incomplete` is projected onto PG-1's existing coverage
 *   channel (`CoverageReason.fact_missing`, reserved for exactly this in PG-1) rather than becoming a
 *   second warning surface beside it.
 *
 * What this module deliberately is not:
 *
 * - **Not a fact factory.** `detect` is a total predicate over data the app already holds. It never
 *   infers an activity family from a CAEN code, never guesses a vehicle's use, never assumes an asset
 *   register. A scenario with no recorded fact to key off simply does not fire — that is B-29's real
 *   complaint (the channel exists, the fact does not), and inventing the fact would be worse.
 * - **Not a wording layer.** `message` is a key into `ui/copy/scenarios.ts`. The only text a detector
 *   produces is a rule's own sentence, lifted verbatim from the rule layer that already wrote it.
 * - **Not a place where any fiscal value lives.**
 */
import type { AppData } from '../data/types';
import type { RefusedExpense } from './fiscal/deductibility';
import { regimeRefusalReason } from './regimes';

/**
 * What a scenario does to the estimate.
 *
 * `refuse` — no number is produced, because the law supplies no rule to compute under.
 * `incomplete` — a number is produced, but it does not cover the register, and the missing fact is
 * one the user can supply. Collapsing these two is the failure this enum exists to prevent: a case
 * the app cannot compute is not the same claim as a case the app has not finished computing.
 */
export type ScenarioEffect = 'incomplete' | 'refuse';

/**
 * The routes this app's own router parses (`src/App.tsx PAGES`).
 *
 * Spelled here rather than imported from `App.tsx` so the domain does not depend on the shell.
 * `scenarios.routes.test.ts` asserts this list against `parseRoute`, so the two cannot drift: a
 * `fixTarget` that goes nowhere is worse to a user than no link at all.
 */
export type ScenarioPage =
  | 'dashboard'
  | 'revenues'
  | 'expenses'
  | 'e-factura'
  | 'declarations'
  | 'documents'
  | 'clients'
  | 'settings';

/**
 * Where the person goes to fix the scenario.
 *
 * A typed route, not a free string: `page` is checked against `ScenarioPage` by the compiler and
 * against the live router by a test, and `tab` is only meaningful as a tab that page actually
 * renders. Record-level fixes are NOT targeted here — those already have PG-1's coverage rows, which
 * carry the record id and land the table on the row. A scenario is a profile- or activity-level fact,
 * so it points at a control, not at a row.
 */
export interface ScenarioFixTarget {
  page: ScenarioPage;
  tab?: string;
}

/** The URL a fix target resolves to, in the form `parseRoute` reads. */
export function scenarioFixHref(target: ScenarioFixTarget): string {
  return `/${target.page}${target.tab ? `#!/${target.tab}` : ''}`;
}

/** A key into `ui/copy/scenarios.ts`. The registry never carries a sentence of its own. */
export type ScenarioMessageKey =
  | 'noExpenseEngine'
  | 'regimeNotComputable'
  | 'activityFamilyUndeclared';

/**
 * Everything a detector is allowed to look at.
 *
 * `data` is the stored register — profile and records together. `classifierRefusal` is the refusal the
 * expense classifier already produced for this register, read rather than re-derived: the rule layer
 * decides whether an activity has an expense engine, and a scenario must not run a second
 * classification to reach the same answer.
 */
export interface ScenarioFacts {
  data: AppData;
  classifierRefusal: RefusedExpense | null;
}

/** What a detector hands back when the scenario applies. `null` means it does not. */
export interface ScenarioSignal {
  /**
   * The rule's own sentence, verbatim. Present when the scenario's reason comes from a rule the app
   * already holds; the copy key then frames it, it does not replace it.
   */
  detail?: string;
}

export interface ScenarioSupport {
  /** Stable identifier — it is what a test, a log line and the phase doc name. */
  id: string;
  effect: ScenarioEffect;
  message: ScenarioMessageKey;
  fixTarget: ScenarioFixTarget;
  /**
   * Total, and it must stay that way: a profile with no records, no start date or an empty register
   * is a normal input, and a detector that throws would turn a refusal into a crash.
   * `scenarios.test.ts` runs the whole registry against degenerate payloads to hold that line.
   */
  detect(facts: ScenarioFacts): ScenarioSignal | null;
}

/** A scenario that fired. */
export interface ScenarioOutcome {
  id: string;
  effect: ScenarioEffect;
  message: ScenarioMessageKey;
  fixTarget: ScenarioFixTarget;
  detail: string | null;
}

/**
 * The sentence a refused expense engine says out loud, naming the rule and the article behind it.
 *
 * It lives here rather than in `estimateBasis.ts` because the scenario channel is what renders it:
 * the assembler no longer composes a refusal sentence of its own, it hands the classifier's refusal
 * to the registry and the registry says it once.
 */
export function estimateRefusalReason(refusal: RefusedExpense): string {
  return (
    `Calculul anual s-a oprit: regula ${refusal.rule.ruleId} (${refusal.rule.sourceArticle}) nu lasă niciun motor de cheltuieli pentru această activitate. ` +
    refusal.reason
  );
}

/**
 * The activity has no expense engine at all (CF art. 68^3, defect B-29).
 *
 * This is the one scenario that already refused before this module existed — it is here so the
 * framework demonstrably carries a live case rather than only demo ones. It does not detect the
 * activity family: the classifier does, from the rule's own condition, and this entry only carries
 * the answer to the surface. Supplying the fact that would make it fire in real data is PG-6b.
 */
const noExpenseEngineScenario: ScenarioSupport = {
  id: 'no-expense-engine',
  effect: 'refuse',
  message: 'noExpenseEngine',
  fixTarget: { page: 'settings', tab: 'fiscal' },
  detect(facts) {
    const refusal = facts.classifierRefusal;
    if (refusal === null) return null;
    return { detail: estimateRefusalReason(refusal) };
  },
};

/**
 * The recorded regime is one this rule package cannot compute (defect B-14).
 *
 * Already live today: `tax.ts` refuses it and the B-14 e2e pins the reason. It is registered here so
 * the answer arrives as a refusal with a route to the control that fixes it, instead of as a bare
 * withheld conclusion. The predicate is `regimes.ts regimeRefusalReason` — the same single source the
 * profile editor and the engine already use, so this adds no second opinion about which regimes exist.
 * `tax.ts` keeps its own gate as the backstop for a caller that reaches the engine without the
 * assembler; it is not a second surface, because on this path the engine is never reached.
 */
const regimeScenario: ScenarioSupport = {
  id: 'regime-not-computable',
  effect: 'refuse',
  message: 'regimeNotComputable',
  fixTarget: { page: 'settings', tab: 'fiscal' },
  detect(facts) {
    const regime = facts.data?.profile?.regime;
    if (typeof regime !== 'string') return null;
    const reason = regimeRefusalReason(regime);
    if (reason === null) return null;
    return { detail: reason };
  },
};

/**
 * The profile has never been asked which activity family applies (PG-6b, B-29).
 *
 * This is the `incomplete` half of B-29, and the half that decides what the other half means. Before 6b
 * the profile could not record the fact at all, so the app computed every register under the sistem real
 * rules and said nothing — a cazare taxpayer and a software consultant got the same confident figure.
 * 6b asks the question; this entry reports the person who has not answered it.
 *
 * It is `incomplete`, not `refuse`, and the distinction is the point: an unanswered question is a fact the
 * user can still supply, and the figure beside it is still the figure the app can produce from the records
 * it holds. A case the law does not let this build compute is the entry above it. Collapsing the two would
 * have made "I never asked you" and "the law gives me nothing to compute with" the same claim.
 *
 * The detector reads one field and infers nothing. It does not look at `identity.caen`, at the expense
 * categories, or at the regime to guess what the person does — `research/30` §3 records that OMFP
 * 925/2017 art. 2 alin. (4) keys the determination method to the activity description „independent de
 * codurile CAEN menționate cu titlu exemplificativ”, so inferring the family from a code would manufacture
 * the very fact this entry reports is missing. Absence of the field is the whole trigger, and a profile
 * that declares either family clears it.
 */
const activityFamilyScenario: ScenarioSupport = {
  id: 'activity-family-undeclared',
  effect: 'incomplete',
  message: 'activityFamilyUndeclared',
  fixTarget: { page: 'settings', tab: 'fiscal' },
  detect(facts) {
    // Optional chaining, not a guard clause: `detect` is total, and a payload whose profile object is
    // absent is a shape the registry is tested against. Such a payload has no profile to have failed to
    // answer, and reporting a missing profile fact about it would be a claim about a person the payload
    // does not describe. No profile is therefore no outcome — the same answer `regimeScenario` gives for
    // a missing regime.
    const profile = facts.data?.profile;
    if (!profile) return null;
    const declared = profile.activityFamily;
    if (declared === 'cazare' || declared === 'other') return null;
    return {};
  },
};

/**
 * The registry. Order is precedence: the first `refuse` outcome is the one that stops the estimate,
 * and an entry added by PG-6b…6g is inserted here and nowhere else.
 */
export const SCENARIO_SUPPORT: readonly ScenarioSupport[] = [
  noExpenseEngineScenario,
  regimeScenario,
  activityFamilyScenario,
];

/**
 * Run the registry. The one evaluation point.
 *
 * Deterministic (registry order), total (a detector returning `null` is the normal case), and it
 * invents nothing: an outcome only exists because a detector read something already in `facts`.
 */
export function evaluateScenarios(facts: ScenarioFacts): ScenarioOutcome[] {
  const outcomes: ScenarioOutcome[] = [];
  for (const scenario of SCENARIO_SUPPORT) {
    const signal = scenario.detect(facts);
    if (signal === null) continue;
    outcomes.push({
      id: scenario.id,
      effect: scenario.effect,
      message: scenario.message,
      fixTarget: scenario.fixTarget,
      detail: signal.detail ?? null,
    });
  }
  return outcomes;
}

/** The scenario that stops the calculation, or `null` when the estimate may run. */
export function scenarioRefusal(outcomes: readonly ScenarioOutcome[]): ScenarioOutcome | null {
  return outcomes.find(o => o.effect === 'refuse') ?? null;
}

/** The scenarios that leave a figure standing but uncovered. */
export function scenarioGaps(outcomes: readonly ScenarioOutcome[]): ScenarioOutcome[] {
  return outcomes.filter(o => o.effect === 'incomplete');
}
