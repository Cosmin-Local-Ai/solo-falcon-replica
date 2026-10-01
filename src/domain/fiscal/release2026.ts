import type { RuleRelease } from './rules';

export const PFA_2026_RELEASE: RuleRelease = {
  releaseId: 'PFA_2026_SYSTEM_REAL',
  name: 'PFA 2026 system-real package',
  jurisdiction: 'RO',
  entityType: 'PFA',
  taxYear: 2026,
  ruleIds: [
    'PFA_2026_TAX_REFERENCE',
    'GENERAL_MINIMUM_WAGE_2026_H1',
    'GENERAL_MINIMUM_WAGE_2026_H2',
    'CAS_2026',
    'CASS_2026',
    'INCOME_TAX_2026',
    'VAT_THRESHOLD_2026',
    'PFA_DEADLINE_2026',
  ],
  status: 'SAFE_ACTIVATION',
  effectiveFrom: '2026-01-01',
  createdAt: '2026-01-01',
  evidence: [
    'https://www.legalteka.ro/act/1506/2024',
    'https://www.legalteka.ro/act/146/2026',
  ],
  notes: 'Initial package from verified Task 6 baseline; no legislation ingestion applied.',
};
