// 'expense-deductibility' (TASK 2a) is deliberately a FRESH regime string rather than a reuse of
// 'cas' / 'cass' / 'income-tax': tax.ts resolves those three with applicable.find(r => r.taxRegime
// === ...), so a second rule sharing one of them would be silently shadowed by whichever ruleId
// sorts first. 'deadlines' and 'wage-reference' were added the same way.
//
// 'accommodation-flat-ratio' (PG-6h-1) is a fresh string for the same reason, and it carries a second
// hazard specific to it: art. 68^3 produces an INCOME TAX of its own (alin. (6), „impozitul fiind
// final") and a CASS/CAS consequence of its own. Reusing 'income-tax' would have shadowed art. 123
// alin. (1) — the sistem-real rate provision — and reusing 'cass' or 'cas' would have shadowed the
// Titlul V rules those contributions are actually computed under. The 68^3 rule supplies neither a
// contribution rule nor a rate for another regime; it supplies the flat-ratio METHOD, and tax.ts reads
// it as a fourth, separate lookup.
export type FiscalRegime =
  | 'cass'
  | 'cas'
  | 'income-tax'
  | 'vat'
  | 'deadlines'
  | 'wage-reference'
  | 'expense-deductibility'
  | 'accommodation-flat-ratio';

/**
 * TASK 6: the lifecycle ladder, stated once. Six states, one step forward at a time, and the ladder is
 * enforced in `./registry` (`assertLifecycleTransition`), not documented only.
 *
 * A RULE and a RELEASE walk the same ladder, but they are asked different questions. Which rule set is
 * operative is decided by the RELEASE's lifecycle and window; which rules apply inside a rule set is
 * decided by the RULE's own `status` and window. That separation is what lets a superseded release stay
 * readable: its rules keep `status: 'ACTIVE'` inside their own historical set, so an old snapshot can
 * still be re-run against them, while the release that names them is `SUPERSEDED` and no new calculation
 * selects it.
 */
export type RuleLifecycle =
  | 'PROPOSED'
  | 'VALIDATED'
  | 'STAGED'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'SUPERSEDED';

/** The rule-side name of the ladder. Kept as a name, not duplicated as a second union. */
export type FiscalRuleStatus = RuleLifecycle;

/** The release-side name of the same ladder. */
export type ReleaseLifecycle = RuleLifecycle;

export type FiscalParameter = {
  id: string;
  label: string;
  value: number | string;
  // Phase 9b: `days` and `text` exist so a rule can carry its FORMULA as data instead of having it
  // written in code. `days` is a day-count offset (the deadline rules' `offset_days`); `text` is a
  // short machine-readable token (a deadline rule's `event_type` / `event` / `applies_to`).
  // Nothing renders `unit`; it is metadata for humans and for validation.
  // 'eur' exists so a cap the LAW states in euro (CF art. 68 alin. (5), the 400 euro annual
  // equivalents) can be carried as data without being silently reinterpreted as lei. It is NOT a
  // money unit for the engine: paramBani in calculators.ts refuses any unit other than 'lei', which
  // is exactly the guard that keeps a euro figure out of a bani calculation.
  unit: 'lei' | 'percent' | 'date' | 'count' | 'days' | 'text' | 'eur';
  description?: string;
};

export type FiscalRule = {
  ruleId: string;
  name: string;
  jurisdiction: string;
  entityType: string;
  taxRegime: FiscalRegime;
  taxYear: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  parameters: FiscalParameter[];
  calculatorId: string;
  sourceAct: string;
  sourceArticle: string;
  sourceUrl: string;
  verifiedAt: string;
  status: FiscalRuleStatus;
  version: number;
  supersededBy?: string;
};

export type RuleRelease = {
  releaseId: string;
  name: string;
  jurisdiction: string;
  entityType: string;
  taxYear: number;
  ruleIds: string[];
  status: 'SAFE_ACTIVATION' | 'REVIEW_REQUIRED';
  effectiveFrom: string;
  /**
   * When this release stopped being operative. `null` means its window is still open-ended.
   * TASK 6: without this, "superseded" was a word — a release could not be bounded, so a date could
   * never say which release was in force. Read by `registry.activeEntry` as a gate.
   */
  effectiveTo?: string | null;
  /**
   * The instant the release's RULE CONTENT last materially changed — not the law's effective date, and
   * not a placeholder. `effectiveFrom: '2026-01-01'` is when the law bites; `createdAt` is when this
   * record was made. They were both `'2026-01-01'`, which is how a release survived three formula
   * corrections without ever moving. See `docs/ai/phases/20_rule_release_immutability.md` §4.
   */
  createdAt: string;
  evidence: string[];
  notes?: string;
  /**
   * TASK 6: SHA-256 hex over the canonical serialisation of the rule set this release names
   * (`./ruleSetDigest`). This is what makes the release a content address rather than a label: two rule
   * sets that differ in any formula-bearing parameter get different digests, and the same rule set gets
   * the same digest however it was built.
   *
   * Optional because a release embedded in a snapshot written before data version 9 carries no digest —
   * the rules that produced it were never content-addressed, and minting one from today's rule set would
   * be a guess about the past. Absent means "this release was never content-addressed", never "assume the
   * current one".
   */
  contentHash?: string;
  /** TASK 6: where this release sits on the lifecycle ladder. Absent on a pre-v9 embedded release. */
  lifecycle?: ReleaseLifecycle;
  /**
   * TASK 6: the release's revision number. It moves only when `contentHash` moves — `registry.register`
   * refuses both directions of that rule. Not a display number.
   */
  version?: number;
  /** TASK 6: the `releaseId` of the release that replaced this one. Set by `registry.supersede`. */
  supersededBy?: string;
};
