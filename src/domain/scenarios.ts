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
import type { ActivityFamily, RefusedExpense } from './fiscal/deductibility';
import type {
  AccommodationCommissionReading,
  AccommodationIncomeTitle,
  AccommodationTourismEligibility,
} from './models';
import type { IncomeDeterminationMethod } from './estimateBasis';
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
  | 'activityFamilyUndeclared'
  | 'accommodationGrossUndetermined'
  | 'accommodationTitleCedareaFolosintei'
  | 'accommodationAttributionMissing';

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
  /**
   * PG-6h-1 — whether the rule set selected for this fiscal year actually carries the art. 68^3 flat-ratio
   * method. Read from the rule set by `estimateBasis.ts`, never inferred here.
   *
   * It decides what the classifier's refusal MEANS, and that is the whole reason it is a fact rather than
   * a branch. "This activity has no art. 68 expense engine" is fatal when the law offers no other method
   * and is simply the shape of a different regime when it does — art. 68 alin. (1) excepts art. 68^3 from
   * the expense engine precisely because alin. (2) replaces it with a flat ratio. Optional, and absence is
   * not `false`: a caller that never went through the assembler has no answer to give, and inventing one
   * would let a hand-built fixture decide a legal question the rule set is the only thing entitled to
   * decide.
   */
  flatRatioMethodAvailable?: boolean;
  /**
   * PG-6h-1 — the open questions the art. 68^3 rule carries in its own parameters, lifted verbatim by the
   * assembler. `null` means "not asked", `[]` means the rule carries none.
   *
   * The registry never composes a legal sentence of its own, so the two readings of art. 68^3 alin. (3) and
   * the alin. (1) eligibility gate reach the screen as the rule's words, not as a paraphrase written here.
   */
  flatRatioOpenQuestions?: AccommodationOpenQuestions | null;
  /**
   * PG-6h-1 — the activity family the estimate is actually being run under.
   *
   * The assembler resolves it as `context.activityFamily ?? profile.activityFamily`, and the registry reads
   * that resolved value rather than re-reading the profile. If it did not, a per-call family could select
   * the art. 68^3 method while the detectors still described the stored profile, and one register would be
   * two activities at once. Absent means the assembler supplied nothing, so the profile is the answer —
   * which is what every caller that has not gone through the assembler gets.
   */
  activityFamily?: ActivityFamily;
  /**
   * PG-6h-2 (B-82, B-84) — the income TITLE the recorded room count puts this year's accommodation
   * receipts in, resolved once by the assembler from `profile.accommodationRoomCounts` and the profile's
   * fiscal year.
   *
   * Three states, and the difference between the last two is the whole point:
   * - `undefined` — the assembler supplied no answer (a hand-built fixture that never went through it);
   * - `null` — the assembler answered, and the answer is **the room count is not recorded for this year**,
   *   so the app does not know which title applies and must not pick one;
   * - a title — the person declared a count, and the title follows from it.
   *
   * The registry never compares the count itself. `domain/models.ts accommodationIncomeTitleForYear` is
   * the only place the art. 83 alin. (4) boundary is read, so the refusal, the Settings screen and any
   * later calculation cannot disagree about which title a payload is in.
   */
  accommodationIncomeTitle?: AccommodationIncomeTitle | null;
  /**
   * PG-6h-2 (D-COM-1, B-80) — the reading of art. 68^3 alin. (3) the person chose, or `undefined` when the
   * question is unanswered. Absence is not `reading_a`: choosing either side is the person's act, and the
   * app picking one for them is the defect B-80 records.
   */
  accommodationCommissionReading?: AccommodationCommissionReading;
  /** PG-6h-2 — the person's own answer to the art. 68^3 alin. (1) gate, or `undefined` when unanswered. */
  accommodationTourismEligibility?: AccommodationTourismEligibility;
  /**
   * PG-6h-2b (B-85) — the ONE determination method the assembler selected for this profile-year, read from
   * `estimateBasis.ts selectIncomeDeterminationMethod`.
   *
   * It is a fact and not a verdict the registry reaches on its own. `flatRatioMethodAvailable` answers a
   * different question — whether the rule set carries the art. 68^3 method — and the two are not the same:
   * a rule set can carry a method the assembler did not select for this profile. If the registry re-derived
   * the method from `activityFamily` plus `flatRatioMethodAvailable`, one register would be about two
   * different activities at once, and the refusal would name a method the engine was never handed. Absent
   * means the caller never went through the assembler, and absence is not `sistem-real`.
   */
  incomeDeterminationMethod?: IncomeDeterminationMethod;
}

/** The family this register is being evaluated under — resolved once, read by every detector that needs it. */
function effectiveActivityFamily(facts: ScenarioFacts): ActivityFamily | undefined {
  return facts.activityFamily ?? facts.data?.profile?.activityFamily;
}

/**
 * The two questions the art. 68^3 rule records as open, keyed by the rule's own parameter ids.
 *
 * Keyed rather than a list, because PG-6h-2 makes the registry show only the questions the person has
 * *not* answered yet. A positional array would make "drop the second question" mean "drop whatever sits
 * at index 1", and the rule's parameter order is not a contract anyone declared.
 */
export interface AccommodationOpenQuestions {
  /** `gross_scope_open_question` — the two readings of alin. (3), verbatim from the rule. */
  grossScope: string | null;
  /** `eligibility_open_question` — the alin. (1) tourism gate, verbatim from the rule. */
  eligibility: string | null;
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
 *
 * The framing is about **this build's** capability, and the wording is deliberate. D-CAZ-1
 * (`docs/ai/USER_DECISIONS.md`) decided that art. 68^3 accommodation income will be supported, not
 * permanently refused: PG-6h implements it. So this sentence says the rule asks for a method this rule
 * package does not implement **yet** — it does not say the activity can never be calculated, because
 * that would be a verdict the product has already decided against, and a user reading it would stop
 * looking for the feature that is coming.
 */
export function estimateRefusalReason(refusal: RefusedExpense): string {
  return (
    `Calculul anual s-a oprit: regula ${refusal.rule.ruleId} (${refusal.rule.sourceArticle}) cere o metodă de calcul pe care acest pachet de reguli nu o implementă încă pentru această activitate. ` +
    refusal.reason
  );
}

/**
 * The detail a refused art. 68^3 gross carries: the rule's own open questions, verbatim, joined.
 *
 * No framing sentence is added here. The framing — that the method is implemented and that the gross is
 * what is missing — is copy, and it already exists once in `ui/copy/scenarios.ts
 * accommodationGrossUndetermined`, which `ScenarioRefusal` renders directly above this detail. Composing a
 * second framing sentence here put the same claim twice in one block, the duplication this codebase treats
 * as its own defect class (one producer per sentence). What does belong here is the text with exactly one
 * producer: the two readings lifted from `ACCOMMODATION_68X3_2026`, which must reach the screen in the
 * rule's words rather than in a paraphrase that can drift from them.
 */
export function accommodationOpenQuestionDetail(questions: readonly string[]): string | undefined {
  return questions.length > 0 ? questions.join(' ') : undefined;
}

/**
 * Which of the rule's two open questions are still open, given what the person has answered.
 *
 * This is what "apply the answer" means for a question the app is not entitled to settle. A recorded
 * commission reading retires the gross-scope question from the refusal; a recorded eligibility answer
 * retires the alin. (1) question. Neither makes a figure appear — see the entry below for why the
 * register still cannot be run — but a person who has answered must not be shown a question they have
 * already answered, and a person who has not must not be shown the other one.
 *
 * While the room count is unrecorded the title itself is undecided, and the title is what decides
 * whether alin. (3) reaches this income at all, so both questions stay open: retiring one on the strength
 * of a fact that has not been established would present a half-settled gross as a settled one.
 */
function openAccommodationQuestions(
  questions: AccommodationOpenQuestions,
  facts: ScenarioFacts,
): string[] {
  const titleResolved = facts.accommodationIncomeTitle !== null && facts.accommodationIncomeTitle !== undefined;
  const open: string[] = [];
  if (!titleResolved || facts.accommodationCommissionReading === undefined) {
    if (questions.grossScope !== null) open.push(questions.grossScope);
  }
  if (!titleResolved || facts.accommodationTourismEligibility === undefined) {
    if (questions.eligibility !== null) open.push(questions.eligibility);
  }
  return open;
}

/**
 * The activity has no expense engine **in this build** (CF art. 68^3, defect B-29).
 *
 * This is the one scenario that already refused before this module existed — it is here so the framework
 * demonstrably carries a live case rather than only demo ones. It does not detect the activity family:
 * the classifier does, from the rule's own condition, and this entry only carries the answer to the
 * surface. PG-6b supplied the fact that makes it fire in real data — `profile.activityFamily`, asked and
 * stored, never inferred from a CAEN code.
 *
 * **How PG-6h flips this, and why the fact stays put.** D-CAZ-1 decided accommodation income is supported,
 * not refused. The separation that makes that cheap is the one this entry keeps:
 *
 * - the **fact** lives on the profile (`activityFamily: 'cazare'`) and is a declared description, not a
 *   flag meaning "refuse me". PG-6h reads the same value to *choose a method*; nothing about it changes,
 *   so flipping the effect is not a data migration and no stored payload needs a new version;
 * - the **effect** lives here and in the rule's `treatment: 'no_expense_engine'`. PG-6h replaces that
 *   treatment with a computed path; this entry then stops firing because `facts.classifierRefusal` goes
 *   null, and the id, the message key and the `fixTarget` stay where they are for the next scenario that
 *   needs them.
 *
 * What 6b deliberately does **not** do is pre-build any part of that path — no 30 % ratio, no 10 % rate,
 * no room threshold. `research/30` §10 leaves two questions open (whether the 68^3 net enters the CASS
 * base and the 6-SM floor, and whether the ANAF order approving the new fișa de ocupare a fost published),
 * and a number built on those gaps would be the exact defect this series removes.
 */
const noExpenseEngineScenario: ScenarioSupport = {
  id: 'no-expense-engine',
  effect: 'refuse',
  message: 'noExpenseEngine',
  fixTarget: { page: 'settings', tab: 'fiscal' },
  detect(facts) {
    const refusal = facts.classifierRefusal;
    if (refusal === null) return null;
    // PG-6h-1 — the refusal says the art. 68 expense engine does not apply to this activity. That is still
    // true, and it is still a stop, but only while the rule set offers no other method. Once the art. 68^3
    // flat-ratio rule is selected for the year, the absence of an expense engine is what art. 68 alin. (1)
    // and alin. (2) prescribe, not a gap — and the scenario below is the one that decides whether a figure
    // can be produced. This entry stays live for a year with no such rule (FY2027 today), where "this rule
    // package does not implement the method" is the truthful answer rather than a stale one.
    if (facts.flatRatioMethodAvailable === true) return null;
    return { detail: estimateRefusalReason(refusal) };
  },
};

/**
 * The art. 68^3 method is available, and the gross it would run on is not determinable (PG-6h-1, B-80).
 *
 * This is the honest half of D-CAZ-1. The arithmetic is built — `ACCOMMODATION_68X3_2026` plus
 * `calc-accommodation-flat-ratio` compute net = 70 % × gross and tax = 10 % × net, and the CAS and CASS
 * consequences follow from that net. What is not built is the input, and it cannot be built from the
 * fiscal code alone:
 *
 * - **alin. (3)** excludes from gross „comisionul reținut de către entitățile care facilitează închirierea
 *   pe termen scurt a camerelor situate în locuințe proprietate personală”, but the words are limited to
 *   personal dwellings while alin. (1) puts the article's subject with a tourism-sector operator. ANAF
 *   Brașov leans broad, the statutory words lean narrow, and no primary source reconciles them
 *   (`docs/ai/research/38_art68x3_cass_and_occupancy_order.md` §3, §5 item 1). The choice moves gross,
 *   therefore the tax, the CASS base and the CAS threshold — so the app does not choose it.
 * - **alin. (1)** addresses „operatorii economici definiți potrivit legislației specifice domeniului
 *   turismului”. Whether a given person is one is decided in tourism law and the ONRC authorisation, not
 *   in the fiscal code. The app can ask; it cannot decide.
 *
 * Both are questions for the person, and 6h-2 asks them (D-COM-1, D-COM-2): the room count for the year,
 * the alin. (1) answer, and the reading of alin. (3). Answering them retires the corresponding question
 * from this refusal — that is what applying an answer means here — and it does not produce a figure, for
 * a reason this build should say out loud rather than hide: the only register-level calculation the app
 * runs today is the effective-expense one, and for a `cazare` register the classifier returns an empty
 * expense set plus a refusal (`estimateBasis.ts selectDeductibleExpenses`), so running the flat ratio
 * alongside it would measure the same receipts twice — once as sistem real net with no deductions, once
 * as 70 % of the same gross. Making the refusal stop firing would be a confident wrong number, which is
 * the defect class this whole series exists to remove. Wiring the two legs apart belongs to a task that
 * may touch `domain/tax.ts`; this one may not.
 *
 * Until then this stays a `refuse`, not an `incomplete`: unlike a missing profile fact, no number exists
 * beside the gap that would still be this taxpayer's number.
 */
const accommodationGrossScenario: ScenarioSupport = {
  id: 'accommodation-gross-undetermined',
  effect: 'refuse',
  message: 'accommodationGrossUndetermined',
  fixTarget: { page: 'settings', tab: 'fiscal' },
  detect(facts) {
    // Total: a payload with no profile object has no declared activity family, so there is no
    // accommodation register to have a question about. Same answer `regimeScenario` gives for a missing
    // regime.
    if (!facts.data?.profile) return null;
    if (effectiveActivityFamily(facts) !== 'cazare') return null;
    if (facts.flatRatioMethodAvailable !== true) return null;
    const questions = facts.flatRatioOpenQuestions ?? null;
    if (questions === null) return null;
    // B-88 — this suppression used to read the TITLE, because until the art. 85 rule existed a register in
    // the 1–7 room range could never be an art. 68^3 register. That stopped being true: art. 85 alin. (1)
    // excludes „cei care realizează venituri din activități independente pentru care sunt aplicabile
    // prevederile art. 68^3”, so a person who has declared they are a tourism-sector operator is measured
    // under art. 68^3 even with 3 rooms, and the rule's own open questions are the questions they have.
    // The entry is therefore keyed to the resolved METHOD, which is the thing it is actually about.
    //
    // What has not changed is the invariant the entry was written to protect: one refusal per register.
    // The assembler selects exactly one determination method, and each accommodation entry is keyed to a
    // different one. Where no method was supplied at all — a hand-built fixture that never went through
    // `selectEstimateOperands` — the title keeps doing the job it did before, so silence cannot produce two
    // refusals on one register.
    if (facts.incomeDeterminationMethod !== undefined) {
      if (facts.incomeDeterminationMethod !== 'accommodation-flat-ratio') return null;
    } else if (facts.accommodationIncomeTitle === 'cedarea_folosintei') {
      return null;
    }
    const open = openAccommodationQuestions(questions, facts);
    return { detail: accommodationOpenQuestionDetail(open) };
  },
};

/**
 * The room count says this income is *cedarea folosinței bunurilor*, not art. 68^3 (PG-6h-2, B-82).
 *
 * This is the category switch the room count exists to make, and it is the reason the count must never be
 * modelled as a number feeding a formula. CF art. 83 alin. (2) places a „proprietar, uzufructuar sau alt
 * deținător legal” who lets **1–7 camere** in a personal dwelling under Titlul *cedarea folosinței
 * bunurilor*, and art. 85 alin. (1) treats that taxpayer as a category of its own; art. 83 alin. (4)
 * moves the same person into a activitate independentă only **„începând cu anul fiscal în care numărul
 * camerelor … este de peste 7”**, and art. 68^3 alin. (12) is the route by which that activity is measured
 * on the flat ratio.
 *
 * The room count says this income is *cedarea folosinței bunurilor*, and this build has no rule that
 * measures it (PG-6h-2, B-82; narrowed by B-88).
 *
 * This is the category switch the room count exists to make, and it is the reason the count must never be
 * modelled as a number feeding a formula. CF art. 83 alin. (2) places a „proprietar, uzufructuar sau alt
 * deținător legal” who lets **1–7 camere** in a personal dwelling under Titlul *cedarea folosinței
 * bunurilor*, and art. 85 alin. (1) treats that taxpayer as a category of its own; art. 83 alin. (4)
 * moves the same person into a activitate independentă only **„începând cu anul fiscal în care numărul
 * camerelor … este de peste 7”**, and art. 68^3 alin. (12) is the route by which that activity is measured
 * on the flat ratio.
 *
 * So a 3-room register and a 9-room register are not two magnitudes of one calculation: they are two
 * titles, and the flat-ratio arithmetic PG-6h-1 built belongs to the second one only. Applying it to the
 * first would produce a figure under rules that are not this taxpayer's — the B-29 defect in a new
 * costume.
 *
 * **B-88 changed what this entry is for.** It used to be the permanent home of the 1–7 room case, refusing
 * because no art. 85 rule existed in the package. `ACCOMMODATION_ART85_ROOMS_2026` now exists, so the
 * entry fires only while the statement it makes is still true — for a fiscal year whose rule set does not
 * carry that rule (FY2027 today), where refusing and naming the title remains the honest answer. When the
 * assembler selected the art. 85 method, this sentence would be a lie about a rule that is sitting in the
 * package the estimate is running on.
 *
 * The detector reads the resolved title and the resolved method and compares nothing else. It does not read
 * the count, the CAEN list, the revenue amounts or the room boundary, and it is total: no profile, no
 * outcome.
 */
const accommodationTitleScenario: ScenarioSupport = {
  id: 'accommodation-title-cedarea-folosintei',
  effect: 'refuse',
  message: 'accommodationTitleCedareaFolosintei',
  fixTarget: { page: 'settings', tab: 'fiscal' },
  detect(facts) {
    if (!facts.data?.profile) return null;
    if (effectiveActivityFamily(facts) !== 'cazare') return null;
    if (facts.accommodationIncomeTitle !== 'cedarea_folosintei') return null;
    // B-88 — the rule exists for this year, so the title is no longer a reason to stop.
    if (facts.incomeDeterminationMethod === 'short-term-rooms-art85') return null;
    return {};
  },
};

/**
 * The register's receipts cannot be attributed to a determination method (PG-6h-2b, B-85).
 *
 * This is the entry that stands where the 1,7 × used to be.
 *
 * `domain/tax.ts` now refuses to run a sistem-real leg beside a flat-ratio leg, so the inflated base is no
 * longer constructible there. This entry is the other half: it says out loud WHY the app cannot mix the two.
 * A `Revenue` record carries no category, no activity marker and no source — its `tip` is
 * 'factura' | 'notafactura', a document type — so nothing in the stored data says which receipts are the
 * accommodation ones. art. 68^3 alin. (11) contemplates a taxpayer with accommodation income AND other
 * art. 155 alin. (1) lit. b) income determined in sistem real in the same year, and this app cannot tell
 * that register apart from a pure one.
 *
 * The two ways out were both rejected. Splitting the receipts by method needs an attribution the records do
 * not carry, and assuming the whole register is accommodation when the family is `cazare` silently
 * reclassifies a mixed year — it moves income between fiscal titles on an assumption, which is a worse
 * error than a bigger number. So the answer is a refusal that names the missing attribution, and the gap
 * is recorded in `docs/ai/phases/39_pg6h2b_single_leg.md` for the task that supplies the fact.
 *
 * It sits after `accommodation-gross-undetermined` on purpose. Today that entry already stops every
 * accommodation register, and its sentence — with the rule's own open questions rendered beneath it — is the
 * reason the person sees. This one is the backstop for the day the gross question is retired: resolving
 * B-80, building 6h-3 or adding the art. 85 rule must not be what lets two methods meet over one register.
 *
 * **What B-88 found when the art. 85 rule was added, recorded rather than papered over.** A third
 * accommodation path now exists, and it does NOT widen this entry. The reason is that the 1,7 × was never
 * an arithmetic accident waiting to be repeated — it is prevented structurally in `domain/tax.ts`, where
 * the flat leg is resolved before the leg list exists and the list is built to exactly one entry (zero
 * entries for art. 85, whose net is art. 155 alin. (1) lit. e), not lit. b)). Adding a method cannot add a
 * second leg, and `domain/tax.singleLeg.test.ts` now pins that for the art. 85 path too. So the thing this
 * entry guards — two legs computed from one revenue — is not reachable from the new path.
 *
 * What the new path does inherit is the OTHER half of the gap, and it is still open as B-89: a `Revenue`
 * record carries no attribution, so a `cazare` register that also holds receipts from a different activity
 * would be measured wholly under art. 85. That risk is not new — the classifier already applies the
 * declared family's rules to every expense in the register — but the art. 85 path makes it visible for the
 * first time, and it is stated here so the next task does not read a computed figure as proof the register
 * was attributable.
 */
const accommodationAttributionScenario: ScenarioSupport = {
  id: 'accommodation-method-attribution-missing',
  effect: 'refuse',
  message: 'accommodationAttributionMissing',
  fixTarget: { page: 'settings', tab: 'fiscal' },
  detect(facts) {
    if (!facts.data?.profile) return null;
    if (facts.incomeDeterminationMethod !== 'accommodation-flat-ratio') return null;
    // B-88: keyed to the art. 68^3 method, not to the presence of any flat gross. An art. 85 register is a
    // different title and a different basin, and the entries above own it — leaving this one firing there
    // too would put two refusals on one register and make the reader guess which one the app means.
    const receipts = facts.data.revenues.filter((r) => r.status === 'inregistrata');
    if (receipts.length === 0) return null;
    return {};
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
    const declared = effectiveActivityFamily(facts);
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
  accommodationGrossScenario,
  accommodationTitleScenario,
  accommodationAttributionScenario,
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
