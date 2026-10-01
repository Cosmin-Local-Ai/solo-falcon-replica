import type { FiscalRule } from './rules';

export type RuleQuery = { taxYear: number; asOfDate: string };

export function selectApplicableRules(
  rules: FiscalRule[],
  query: RuleQuery,
): FiscalRule[] {
  return rules
    .filter((rule) => rule.taxYear === query.taxYear)
    .filter((rule) => rule.status === 'ACTIVE')
    .filter((rule) => rule.effectiveFrom <= query.asOfDate)
    .filter((rule) => rule.effectiveTo === null || rule.effectiveTo >= query.asOfDate)
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}
