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
    'VAT_REGISTRATION_DEADLINE_2026',
  ],
  status: 'SAFE_ACTIVATION',
  effectiveFrom: '2026-01-01',
  createdAt: '2026-01-01',
  evidence: [
    // Cod fiscal, consolidated (Portal Legislativ doc 312601, consolidation history newest 08.08.2026)
    // — art. 68, 118, 122 alin. (3), 123 alin. (1), 135^1 alin. (3), 148 alin. (2), 170 alin. (1),
    // 174 alin. (7), 310 alin. (1).
    'https://legislatie.just.ro/Public/DetaliiDocument/312601',
    // Legea 239/2025 (MO 1160/15.12.2025) — Art. XII pct. 19 (CASS 72 SM), pct. 4 (art. 68 alin. (1)),
    // pct. 16 (art. 123), pct. 33 (art. 68^3).
    'https://legislatie.just.ro/Public/DetaliiDocument/305208',
    // OMFP 3254/2017, Registrul de evidență fiscală (MO 10/05.01.2018) — art. 4 alin. (3) TVA colectată
    // nu reprezintă venit; art. 5 alin. (6) TVA dedusă nu reprezintă cheltuială; art. 5 alin. (2) imports
    // CF art. 68 alin. (4); art. 5 alin. (5) CAS/CASS deducted at recalculare under CF art. 75.
    'https://static.anaf.ro/static/10/Anaf/legislatie/OMFP_3254_2017.pdf',
    // OUG nr. 8 din 24.02.2026 (MO 147/25.02.2026) — Art. 6 pct. 26-28 amend CF art. 68 alin. (5);
    // pct. 38 amends CF art. 282 alin. (3) (TVA la încasare). Does NOT touch art. 310.
    'https://static.anaf.ro/static/10/Anaf/legislatie/OUG_8_2026.pdf',
    // D212 instructions, OPANAF 2736/2025 (MO 1207/29.12.2025) — anexa 2 pct. 3.5.11; no TVA gross-up.
    'https://static.anaf.ro/static/10/Anaf/formulare/Instructiuni_D212_2736_2025.pdf',
    // Titlul V comparative amendment table (Legea 239/2025) — corroborates the art. 170 alin. (1) change.
    'https://static.anaf.ro/static/10/Brasov/Brasov/titl_V_cf.pdf',
    // Minimum-wage reference acts (unchanged from the original package).
    'https://www.legalteka.ro/act/1506/2024',
    'https://www.legalteka.ro/act/146/2026',
  ],
  notes:
    'Provenance verified 2026-10-05 against primary sources; see docs/ai/phases/02_fiscal_baseline.md, ' +
    'which supersedes docs/ai/research/06_2026_fiscal_research.md. Legislation ingestion WAS applied to ' +
    'provenance metadata only — no formula, calculator or parameter-value change. Residual UNVERIFIED ' +
    'items U-1..U-7 are recorded there and in code comments; U-1 (non-deductible TVA for a neplătitor de ' +
    'TVA) must remain REVIEW_REQUIRED, never a computed rule.',
};
