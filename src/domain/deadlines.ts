import type { FiscalRule } from './fiscal/rules';
import { selectApplicableRules } from './fiscal/select';
import type { AnnualFiling } from '../data/types';
import { isFiledFiling } from '../data/types';

/**
 * The ONLY deadline event types this application models.
 *
 * Phase 9b deleted four of the six that used to live here, because the obligations they
 * implement do not exist in fiscal year 2026 — they were not miscitations to repair:
 *
 * - `income_tax_advance` — no instalment obligation for CF art. 68 income. Art. 120 / 120^1 are
 *   `Abrogat.` from 01-01-2025 (OUG 128/2024 pct. 11 Art. I, MO 1125/11.11.2024); art. 81, which the
 *   rule cited, is the payroll declarative article and is cross-referenced 0 times in the CF.
 *   Payment of art. 68 income is art. 68 alin. (10) → art. 122 alin. (3): 25 May, annual.
 * - `cas_quarterly` — cited art. 160, which has been `Abrogat.` since 01-01-2018 (OUG 79/2017 pct. 71,
 *   MO 885/10.11.2017). CAS declarare AND plată are the same single date: art. 151 alin. (1).
 * - `cass_quarterly` — art. 170 is *Baza de calcul* and contains no dates. CASS payment is
 *   art. 174 alin. (15) → 25 May.
 * - `pfa_estimated_declaration` — its basis (art. 120) was abrogated on 01-01-2025 and it duplicated
 *   the correct `d212_filing`. A PFA opened at any point in 2026 files its first Declarația Unică by
 *   25 May 2027: art. 122 alin. (3) extends the term to the alin. (2) start-of-activity case verbatim
 *   („Prevederea se aplică și în situațiile prevăzute la alin. (2).").
 *
 * Evidence: docs/ai/research/12_quarterly_payment_deadlines_2026.md and
 * docs/ai/research/11_pfa_first_year_and_vat_registration_deadlines_2026.md, both read from the
 * consolidated Cod fiscal (Legea 227/2015), Portal Legislativ doc 312601.
 *
 * There is deliberately no `fiscal_registration` type. CPF (Legea nr. 207/2015) art. 82 alin. (6)
 * lit. c) attaches the 30-day `declarație de înregistrare fiscală` to natural persons working
 * independently „cu excepția celor care se înregistrează, potrivit legii speciale, la registrul
 * comerțului", and a PFA is inside that carve-out: OUG 44/2008 art. 7 alin. (1) makes
 * registrul-comerțului registration mandatory before economic activity begins, and art. 13 alin. (3)
 * of the same act makes the ONRC certificate itself the act of fiscal taking-into-evidence. Verified
 * in docs/ai/research/15_verification_of_deadline_claims_2026.md §1. A PFA start date therefore
 * resolves NO deadline at all — silence is the correct behaviour, not a gap to fill.
 */
export type DeadlineEventType = 'd212_filing' | 'vat_registration';

/**
 * Runtime registry of the event types above. A deadline rule whose `event_type` parameter is not
 * one of these emits NOTHING — the engine never coerces an unknown value into a `Deadline`.
 */
export const DEADLINE_EVENT_TYPES: readonly DeadlineEventType[] = ['d212_filing', 'vat_registration'];

export interface Deadline {
  deadlineId: string;
  taxYear: number;
  eventType: DeadlineEventType;
  date: string | null; // resolved ISO date 'YYYY-MM-DD'; null when event-relative and the event is not known
  dateFormula: string;
  appliesTo: string;
  legalSource: { act: string; article: string };
  effectiveFrom: string | null;
  effectiveTo: string | null;
  status: 'active' | 'not_applicable';
}

export interface DeadlineQuery {
  taxYear: number;
  asOfDate: string;
  /**
   * The date the PFA began independent activity.
   *
   * **Phase 9b: no deadline rule reads this any more, and none may.** The only rule that ever did
   * (`pfa_estimated_declaration`) implemented an obligation abrogated on 01-01-2025, and the CPF
   * 30-day fiscal-registration term that could otherwise have lived here does not reach a PFA
   * (see the `DeadlineEventType` doc comment). The field stays on the query so the boundary is
   * exercised by tests: a query carrying a PFA start date must resolve ZERO deadlines attributable
   * to it. `src/domain/deadlines.test.ts` fails if any rule ever starts consuming it again.
   */
  pfaStartDate?: string;
  /**
   * The exact date (ISO `YYYY-MM-DD`) on which the VAT turnover ceiling of CF art. 310 alin. (1) was
   * exceeded. Resolves `vat_registration` ONLY.
   *
   * Renamed from `vatExceedanceMonth` in Phase 9b. A month was only ever enough because the formula
   * was `month_end + 30 days`, a formula that has never existed in any period. The real term is
   * art. 316 alin. (1) lit. b) „cel târziu la data depășirii plafonului" — a specific day — so the
   * input has to be a day too.
   */
  vatExceedanceDate?: string;
}

/**
 * Event keys a deadline rule may bind through its `event` parameter.
 *
 * `pfa_start` is deliberately ABSENT. There is no key to bind it to, so a rule that declares
 * `event: 'pfa_start'` cannot resolve and emits a `not_applicable`, dateless deadline — the
 * start-date silence is structural, not a convention a future edit can quietly forget.
 */
export type DeadlineEventKey = 'vat_exceedance';

const EVENT_DATE: Record<DeadlineEventKey, (query: DeadlineQuery) => string | undefined> = {
  vat_exceedance: (query) => query.vatExceedanceDate,
};

export type DeadlinePhase = 'past' | 'due_today' | 'upcoming';

/**
 * PG-5 — what the app KNOWS about a term, temporal phase plus the filing that discharges it.
 *
 * `classifyDeadline` answers only "when is it?". That was never the whole question, and after the
 * term passes it becomes the wrong one: a return filed on time and a return never filed both
 * classify as `past`, which is how the dashboard raised an overdue item at high priority on a
 * taxpayer who had filed. `done` is a different fact and it comes from a different place — an
 * `AnnualFiling` for that tax year with a filed status, nothing else.
 *
 * `undated` is the state CF art. 322 leaves the app in for a VAT return: the obligation exists, the
 * facts that would fix its period (the registration date and the prior-year taxable supplies) are not
 * recorded, so there is no date to classify. It is reported as an unknown, never as a guessed term.
 */
export type DeadlineOutcome = 'done' | 'overdue' | 'due_today' | 'upcoming' | 'undated';

/**
 * A `Deadline` plus what this dataset knows about it.
 *
 * The rule engine's answer cannot carry the filing half — it never sees the filings — and every surface
 * that wanted to say „Depusă” would otherwise re-derive it. One annotated row, produced once in
 * `data/dashboard.ts`, is what keeps the card, the attention pipeline and the completeness check from
 * disagreeing about whether a term is still open.
 */
export interface DeadlineView extends Deadline {
  done: boolean;
  /** The date recorded on the filing that discharged this term, when there is one. */
  filedOn: string | null;
  outcome: DeadlineOutcome;
}

const DAY_MS = 86400000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDaysAfter(date: string, days: number): string {
  return new Date(Date.parse(date + 'T00:00:00Z') + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function daysRemaining(deadlineDate: string, asOfDate: string): number {
  const dl = Date.parse(deadlineDate + 'T00:00:00Z');
  const as = Date.parse(asOfDate + 'T00:00:00Z');
  return Math.round((dl - as) / DAY_MS);
}

/**
 * Classify a deadline's temporal phase relative to `asOfDate`.
 *
 * - `'past'`     — the deadline date is before `asOfDate` (daysRemaining < 0)
 * - `'due_today'`— the deadline date equals `asOfDate` (daysRemaining === 0)
 * - `'upcoming'` — the deadline date is after `asOfDate` (daysRemaining > 0)
 *
 * Returns `null` when the deadline has no resolved date (`date === null`),
 * since a dateless deadline cannot be temporally classified.
 *
 * Negative days are classified as `'past'`, never as "approaching".
 */
export function classifyDeadline(
  deadline: Deadline,
  asOfDate: string,
): DeadlinePhase | null {
  if (deadline.date === null) return null;
  const days = daysRemaining(deadline.date, asOfDate);
  if (days < 0) return 'past';
  if (days === 0) return 'due_today';
  return 'upcoming';
}

function paramValue(rule: FiscalRule, id: string): number | string | undefined {
  return rule.parameters.find((p) => p.id === id)?.value;
}

function isEventType(value: unknown): value is DeadlineEventType {
  return (
    typeof value === 'string' &&
    (DEADLINE_EVENT_TYPES as readonly string[]).includes(value)
  );
}

/** What one deadline rule resolves to, before it is wrapped in a `Deadline`. */
interface ResolvedDeadline {
  eventType: DeadlineEventType;
  appliesTo: string;
  date: string | null;
  dateFormula: string;
  status: 'active' | 'not_applicable';
}

/**
 * Resolve one `taxRegime: 'deadlines'` rule into a deadline, purely from its parameters.
 *
 * Returns `null` — emit NOTHING — when the rule is malformed: an unknown or missing `event_type`,
 * a missing `applies_to`, a fixed-date rule with no parsable `deadline`, or an event-relative rule
 * with no numeric `offset_days`. A malformed rule must never fabricate a date, and it must never
 * fall back to a literal.
 *
 * Parameters (all rule data, none hardcoded here):
 * - `event_type`  which `DeadlineEventType` this rule produces
 * - `applies_to`  the audience key the UI labels (presentation maps live in the components)
 * - `event`       present ⇒ event-relative; the key must exist in `EVENT_DATE`
 * - `offset_days` days from the event (or from the fixed date) to the deadline
 * - `deadline`    present (and no `event`) ⇒ fixed calendar date
 */
function resolveDeadlineRule(rule: FiscalRule, query: DeadlineQuery): ResolvedDeadline | null {
  const eventType = paramValue(rule, 'event_type');
  if (!isEventType(eventType)) return null;

  const appliesTo = paramValue(rule, 'applies_to');
  if (typeof appliesTo !== 'string' || appliesTo.length === 0) return null;

  const event = paramValue(rule, 'event');
  if (typeof event === 'string' && event.length > 0) {
    const offset = paramValue(rule, 'offset_days');
    if (typeof offset !== 'number' || !Number.isFinite(offset)) return null;
    const formula = `rule ${rule.ruleId}: ${event} + ${offset} days`;
    const read = (EVENT_DATE as Partial<Record<string, (q: DeadlineQuery) => string | undefined>>)[event];
    const eventDate = read ? read(query) : undefined;
    if (eventDate === undefined || !ISO_DATE.test(eventDate)) {
      // The obligation exists; the event date is unknown (or the event is one this engine refuses
      // to bind, e.g. a PFA start date). Dateless + not_applicable, never a guessed date.
      return { eventType, appliesTo, date: null, dateFormula: formula, status: 'not_applicable' };
    }
    return { eventType, appliesTo, date: isoDaysAfter(eventDate, offset), dateFormula: formula, status: 'active' };
  }

  const fixed = paramValue(rule, 'deadline');
  if (typeof fixed !== 'string' || !ISO_DATE.test(fixed)) return null;
  // A fixed-date rule may carry an offset; absent means "no shift". 0 is a formula parameter, not a
  // date, so this default does not reintroduce a hardcoded deadline.
  const offset = paramValue(rule, 'offset_days');
  const days = typeof offset === 'number' && Number.isFinite(offset) ? offset : 0;
  return {
    eventType,
    appliesTo,
    date: isoDaysAfter(fixed, days),
    dateFormula: `rule ${rule.ruleId}: fixed ${fixed} + ${days} days`,
    status: 'active',
  };
}

/**
 * Compute the deadlines for a fiscal context, entirely from the applicable rule set.
 *
 * Phase 9b made this function literal-free: it contains no date and no article string. Every date,
 * every offset and every citation comes from a `FiscalRule` in the package, so a deadline that is
 * not backed by a rule simply is not emitted. That is the structural fix for the twelve fabricated
 * deadlines this phase removed — previously four of the six event types were hardcoded arrays here,
 * and there was no field in which a citation could live, which is exactly why confident-looking
 * article strings could be attached to obligations that do not exist.
 *
 * `deadlineId` is the ruleId, so a rendered deadline always names the rule that produced it.
 */
export function computeDeadlines(
  rules: FiscalRule[],
  query: DeadlineQuery,
): Deadline[] {
  const applicable = selectApplicableRules(rules, {
    taxYear: query.taxYear,
    asOfDate: query.asOfDate,
  });

  const results: Deadline[] = [];
  for (const rule of applicable) {
    if (rule.taxRegime !== 'deadlines') continue;
    const resolved = resolveDeadlineRule(rule, query);
    if (resolved === null) continue;
    results.push({
      deadlineId: rule.ruleId,
      taxYear: query.taxYear,
      eventType: resolved.eventType,
      date: resolved.date,
      dateFormula: resolved.dateFormula,
      appliesTo: resolved.appliesTo,
      legalSource: { act: rule.sourceAct, article: rule.sourceArticle },
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      status: resolved.status,
    });
  }
  return results;
}

/**
 * The filing that discharges a term, or `null` when the dataset holds none.
 *
 * Only `d212_filing` has a record that can discharge it: the annual return is the one obligation this
 * app models as a filing, and `taxYear` on both sides is the year the return DECLARES, so the FY2026
 * return matches the FY2026 term even though it is filed in 2027.
 *
 * `isFiledFiling` is the whole test, and it is the only one the app can pass or fail on this question.
 * The monthly record type that used to be worth warning about no longer exists — PG-5b deleted it and the
 * v10→v11 step drops the rows it left behind — so `status: 'inregistrata'` is not a value any filing
 * lookup can be handed. What PG-5 established survives unchanged: only an `AnnualFiling` whose own status
 * says `depusa` discharges a term.
 */
export function filingForDeadline(
  filings: readonly AnnualFiling[],
  deadline: Deadline,
): AnnualFiling | null {
  if (deadline.eventType !== 'd212_filing') return null;
  return (
    filings.find(
      (f) => f.form === 'D212' && f.taxYear === deadline.taxYear && isFiledFiling(f),
    ) ?? null
  );
}

/** True when a filed annual return for that tax year exists in the dataset. */
export function isDeadlineDone(
  filings: readonly AnnualFiling[],
  deadline: Deadline,
): boolean {
  return filingForDeadline(filings, deadline) !== null;
}

/**
 * Resolve a term to what the app may say about it. Done beats every temporal phase — a filed return is
 * not overdue no matter what the calendar says — and a term with no resolved date is `undated`, never
 * `overdue`.
 */
export function resolveDeadlineOutcome(
  deadline: Deadline,
  filings: readonly AnnualFiling[],
  asOfDate: string,
): DeadlineOutcome {
  if (isDeadlineDone(filings, deadline)) return 'done';
  const phase = classifyDeadline(deadline, asOfDate);
  if (phase === null) return 'undated';
  return phase === 'past' ? 'overdue' : phase;
}

/**
 * Get all applicable deadlines (those with non-null dates) for the given context.
 * This is a convenience wrapper over computeDeadlines that filters out
 * not-applicable rules.
 */
export function getApplicableDeadlines(
  rules: FiscalRule[],
  query: DeadlineQuery,
): Deadline[] {
  return computeDeadlines(rules, query).filter((d) => d.date !== null);
}

/**
 * Filter a list of deadlines to only those that are upcoming (future-dated).
 * Past, due-today, and null-dated deadlines are excluded.
 *
 * Note what this means for `vat_registration`: its rule's `offset_days` is 0, so the deadline IS the
 * exceedance date and a resolved VAT deadline can only ever classify as `past` or `due_today`. It is
 * therefore never shown by this filter. That is correct — past that date the registration obligation
 * is overdue, and "N zile rămase" would misstate it. Do not bend this filter to surface it.
 */
export function filterUpcoming(
  deadlines: Deadline[],
  asOfDate: string,
): Deadline[] {
  return deadlines.filter((d) => classifyDeadline(d, asOfDate) === 'upcoming');
}
