export type FiscalRegime = 'cass' | 'cas' | 'income-tax' | 'vat' | 'deadlines' | 'wage-reference';

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
  unit: 'lei' | 'percent' | 'date' | 'count';
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
