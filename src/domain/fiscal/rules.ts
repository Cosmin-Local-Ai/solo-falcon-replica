// 'expense-deductibility' (TASK 2a) is deliberately a FRESH regime string rather than a reuse of
// 'cas' / 'cass' / 'income-tax': tax.ts resolves those three with applicable.find(r => r.taxRegime
// === ...), so a second rule sharing one of them would be silently shadowed by whichever ruleId
// sorts first. 'deadlines' and 'wage-reference' were added the same way.
export type FiscalRegime =
  | 'cass'
  | 'cas'
  | 'income-tax'
  | 'vat'
  | 'deadlines'
  | 'wage-reference'
  | 'expense-deductibility';

export type FiscalRuleStatus =
  | 'PROPOSED'
  | 'VALIDATED'
  | 'STAGED'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'SUPERSEDED';

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
  createdAt: string;
  evidence: string[];
  notes?: string;
};
