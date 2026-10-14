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
// 'short-term-rooms-flat-ratio' (B-88) is a fresh string for the same reason, and it carries the SAME
// hazard as 'accommodation-flat-ratio' in a sharper form: CF art. 85 alin. (2) and art. 68^3 alin. (2) both
// say 30 %, and both are taxed at 10 % under alin. (6) of their own article. Reusing the regime string would
// have made `applicable.find(r => r.taxRegime === 'accommodation-flat-ratio')` in tax.ts resolve whichever
// of the two ruleIds sorts first, and the two articles are not interchangeable: art. 85 measures a cash-basis
// gross from a personal dwelling and puts its net in the art. 170 alin. (4) cumul (art. 155 alin. (1) lit. e)),
// while art. 68^3 measures a tourism operator's register and puts its net in the art. 170 alin. (1) basin
// (lit. b)). Same percentage, different income category, different contribution route, different citation.
// 'fiscal-depreciation' (PG-6e) is a fresh string for the same reason and with the same hazard: the
// figures it carries — the 5.000-lei threshold of art. 28 alin. (2) lit. b), the 1.500 lei/lună M1 ceiling
// of alin. (14) and the three degresivity coefficients of alin. (7) — are Titlul II *method* figures, not
// a fourth contribution or rate. Putting them under 'expense-deductibility' would have hidden them from
// the depreciation module and put them where `classifyExpenseDeductibility` reads, which is exactly where
// a per-vehicle ceiling could be mistaken for a per-expense rate. It is read by `domain/fiscal/
// depreciation.ts`, never by `tax.ts`.
export type FiscalRegime =
  | 'cass'
  | 'cas'
  | 'income-tax'
  | 'vat'
  | 'deadlines'
  | 'wage-reference'
  | 'expense-deductibility'
  | 'accommodation-flat-ratio'
  | 'short-term-rooms-flat-ratio'
  // B-105 adds the two ordinary-*cedarea folosinței* regimes, and they are fresh strings for the same
  // reason every other one above is: `tax.ts` resolves a regime with `applicable.find(r => r.taxRegime ===
  // ...)`, so a fourth rule sharing 'accommodation-flat-ratio' or 'short-term-rooms-flat-ratio' would be
  // silently shadowed by whichever ruleId sorts first — and these three articles share a percentage and
  // share nothing else. art. 84 alin. (3) and art. 84^1 alin. (3) both say 20 %, art. 85 alin. (2) says
  // 30 %, and all three are taxed at 10 %. What differs is the whole of the rest: art. 84 measures the
  // contract rent for the fiscal year „indiferent de momentul încasării” and converts it at the *curs mediu
  // anual* of the realisation year (alin. (3^1)); art. 84^1 fixes the net „la fiecare plată”, withholds 10 %
  // at the moment of payment as a FINAL tax, and converts at the rate of the day before the payment
  // (alin. (2)); art. 85 measures „încasate în cursul anului fiscal” at the last banking day before each
  // collection. One regime string for any two of them would make one gross rule, one FX rule and one
  // declaration duty answer for all three, and the three totals agree only at 31 December.
  | 'cedare-art84-flat-ratio'
  | 'cedare-art84x1-withheld'
  // B-112 (DPI) adds the *drepturi de proprietate intelectuală* quota regime, and it is a fresh string for
  // the same reason every other one above is: `tax.ts` resolves a regime with `applicable.find(r =>
  // r.taxRegime === ...)`, so a rule sharing one of the existing strings would be silently shadowed by
  // whichever ruleId sorts first. DPI's rate is 10 % — the same number art. 68^3 alin. (6), art. 85 alin. (6)
  // and art. 84^1 alin. (5) all carry — and the regimes share nothing else. The quota is 40 % (art. 72 alin.
  // (2) / art. 72^1 alin. (1)), not the 20 % of art. 84/84^1 and not the 30 % of art. 68^3/art. 85; the gross
  // is the sum the payer owes the author; the tax is computed and withheld BY THE PAYER at payment and is
  // final (art. 72 alin. (4)-(6)); and the net goes to a different contribution basin from every one of them
  // — CAS art. 137 alin. (1) lit. b^1) and CASS art. 155 alin. (1) lit. c), not lit. b) and not lit. e).
  | 'dpi-flat-quota'
  | 'fiscal-depreciation';

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
