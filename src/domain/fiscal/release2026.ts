import type { RuleRelease } from './rules';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';
import { ruleSetDigest } from './ruleSetDigest';

/**
 * TASK 6 — this release is now content-addressed.
 *
 * `releaseId` and `createdAt` used to be the whole identity, and neither moved across the Phase 3 (CAS),
 * Phase 4 (CASS) and Phase 5 (income tax) corrections: the arithmetic changed, the identity did not. Two
 * snapshots carrying `PFA_2026_SYSTEM_REAL` could therefore encode different law. `contentHash` is what
 * closes that — it is the SHA-256 of the canonical serialisation of the 48 rules this release names
 * (`./ruleSetDigest`), so any change to a formula-bearing parameter produces a different release.
 *
 * `createdAt` is now a real instant, not the effective date repeated. It is the commit instant of the
 * last change to this rule set's content — the PG-6h-1 addition of `ACCOMMODATION_68X3_2026` (art. 68^3,
 * 2026-10-11), which added a rule and therefore moved the content hash; before that it was `431afaf`
 * (TASK 2d, 2026-10-09T09:05:44+03:00), and the last change to an arithmetic parameter before that was
 * `1583d9e` (TASK 2a, which added the 39 art. 68 rules). Derivation and the full history are recorded in
 * `docs/ai/phases/20_rule_release_immutability.md` §4. `effectiveFrom: '2026-01-01'` is when the law
 * bites; `createdAt` is when this record was made. A test now pins that they differ.
 *
 * PG-6h-1 moved `version` from 1 to 2 for one reason: the rule set grew, so `contentHash` moved, and the
 * governance in `docs/ai/phases/20_rule_release_immutability.md` §6 makes the version a *consequence* of
 * a content change rather than a display number. No existing rule was edited — `CAS_2026`, `CASS_2026`,
 * `INCOME_TAX_2026` and the 39 deductibility rules keep their parameters, citations and `version: 1`
 * byte-for-byte; the registry's per-rule digest check would have thrown otherwise.
 */
export const PFA_2026_RELEASE: RuleRelease = {
  releaseId: 'PFA_2026_SYSTEM_REAL',
  name: 'PFA 2026 system-real package',
  jurisdiction: 'RO',
  entityType: 'PFA',
  taxYear: 2026,
  lifecycle: 'ACTIVE',
  version: 3,
  contentHash: ruleSetDigest(PFA_2026_SYSTEM_REAL_PACKAGE),
  ruleIds: [
    'PFA_2026_TAX_REFERENCE',
    'GENERAL_MINIMUM_WAGE_2026_H1',
    'GENERAL_MINIMUM_WAGE_2026_H2',
    'CAS_2026',
    'CASS_2026',
    'INCOME_TAX_2026',
    // PG-6h-1 — the art. 68^3 flat-ratio determination method (Legea 239/2025 art. XII pct. 5, from
    // FY2026 incomes). Its own regime, so none of the three `taxRegime` lookups in tax.ts can see or be
    // shadowed by it. See docs/ai/phases/37_pg6h1_art68x3_arithmetic.md.
    'ACCOMMODATION_68X3_2026',
    // PG-6e — the Titlul II amortisation figures a Titlul IV PFA inherits through art. 68 alin. (4) lit. d).
    // Its own regime, so it is read only by `domain/fiscal/depreciation.ts` and cannot be mistaken for an
    // art. 68 treatment or for a contribution rule. See docs/ai/phases/43_pg6e_fixed_assets.md.
    'FISCAL_DEPRECIATION_2026',
    'VAT_THRESHOLD_2026',
    'PFA_DEADLINE_2026',
    'VAT_REGISTRATION_DEADLINE_2026',
    // TASK 2a - the expense-deductibility rule set, CF art. 68. Each id is one litera of art. 68
    // (or of the Normele HG 1/2016 that supplies it), so a corrected per-category treatment lands as
    // a new rule release rather than a code change. See
    // docs/ai/phases/13_expense_deductibility_ruleset.md.
    'EXPENSE_PERSONAL_USE_2026',
    'EXPENSE_NON_TAXABLE_INCOME_2026',
    'EXPENSE_OWN_INCOME_TAX_2026',
    'EXPENSE_PERSONAL_INSURANCE_2026',
    'EXPENSE_DONATION_2026',
    'EXPENSE_FINE_OR_PENALTY_2026',
    'EXPENSE_LOAN_PRINCIPAL_2026',
    'EXPENSE_DEPRECIABLE_ASSET_PURCHASE_2026',
    'EXPENSE_INVENTORY_SHORTAGE_2026',
    'EXPENSE_TAX_FOR_BENEFICIARY_2026',
    'EXPENSE_DEPRECIATION_PERSONAL_PATRIMONY_2026',
    'EXPENSE_SPONSORSHIP_2026',
    'EXPENSE_CORRUPTION_2026',
    'EXPENSE_OWNER_SOCIAL_CONTRIBUTIONS_2026',
    'EXPENSE_DOCUMENTATION_ABSENT_2026',
    'EXPENSE_EMPLOYER_CONTRIBUTIONS_2026',
    'EXPENSE_RENT_BUSINESS_SPACE_2026',
    'EXPENSE_BANK_INTEREST_2026',
    'EXPENSE_POSTAL_TELECOM_2026',
    'EXPENSE_ENERGY_WATER_2026',
    'EXPENSE_BUSINESS_SPACE_UPKEEP_2026',
    'EXPENSE_DEPRECIATION_BUSINESS_ASSET_2026',
    'EXPENSE_VEHICLE_EXCLUSIVE_USE_2026',
    'EXPENSE_VEHICLE_MIXED_USE_2026',
    'EXPENSE_VEHICLE_NOT_USED_2026',
    'EXPENSE_PROTOCOL_2026',
    'EXPENSE_SOCIAL_EXPENSES_2026',
    'EXPENSE_PRIVATE_SCHOLARSHIP_2026',
    'EXPENSE_PRIVATE_PENSION_2026',
    'EXPENSE_OCCUPATIONAL_PENSION_2026',
    'EXPENSE_PEPP_2026',
    'EXPENSE_VOLUNTARY_HEALTH_INSURANCE_2026',
    'EXPENSE_SPORTS_SUBSCRIPTION_2026',
    'EXPENSE_PROFESSIONAL_BODY_DUES_2026',
    'EXPENSE_PROFESSIONAL_CONTRIBUTION_2026',
    'EXPENSE_ETF_PURCHASE_2026',
    'EXPENSE_HOME_OFFICE_SHARED_2026',
    'EXPENSE_COMODAT_SHARE_2026',
    'EXPENSE_ENGINE_CAZARE_2026',
  ],
  status: 'SAFE_ACTIVATION',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  createdAt: '2026-10-12T12:56:28+03:00',
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
    // PG-6h-1: the Codul fiscal consolidation the art. 68^3 text was read out of in full — Portal
    // Legislativ, consolidation at 08.08.2026 (`docs/ai/research/38_art68x3_cass_and_occupancy_order.md`
    // §3). The 30 % ratio, the 10 % rate with „impozitul fiind final", the alin. (4) conversion basis and
    // the alin. (9)-(10) deadlines all come from this text, not from a secondary summary.
    'https://legislatie.just.ro/Public/DetaliiDocument/171282',
    // Minimum-wage reference acts (unchanged from the original package; TASK 9 re-pointed them from the
    // legalteka.ro mirror to Portal Legislativ — HG 1.506/2024 is doc 291450, HG 146/2026 is doc 308231).
    'https://legislatie.just.ro/Public/DetaliiDocument/291450',
    'https://legislatie.just.ro/Public/DetaliiDocument/308231',
    // Added with the TASK 2a deductibility rules: the consolidated Normele metodologice HG 1/2016
    // (pct. 7 alin. (4)-(8), pct. 68) and the consolidated OUG nr. 8/2026 that added art. 68
    // alin. (5) lit. g^1), g^2) and s).
    'https://legislatie.just.ro/Public/DetaliiDocument/307847',
    'https://legislatie.just.ro/Public/DetaliiDocumentAfis/307580',
  ],
  notes:
    'Provenance verified 2026-10-05 against primary sources; see docs/ai/phases/02_fiscal_baseline.md, ' +
    'which supersedes docs/ai/research/06_2026_fiscal_research.md. Legislation ingestion WAS applied to ' +
    'provenance metadata only — no formula, calculator or parameter-value change. Residual UNVERIFIED ' +
    'items U-1..U-7 are recorded there and in code comments; U-1 (non-deductible TVA for a neplătitor de ' +
    'TVA) must remain REVIEW_REQUIRED, never a computed rule. ' +
    'TASK 2a adds the 39 expense-deductibility rules under taxRegime "expense-deductibility". They ' +
    'are read only by classifyExpenseDeductibility, never by tax.ts, so no computed figure in this ' +
    'release moves. Their legal basis is CF art. 68 - NOT art. 21 and not art. 123: Titlul IV ' +
    'contains zero references to art. 21 and the corporate general rule is art. 25 alin. (1). No ' +
    'corporate-only Titlul II limit is encoded for a PFA beyond the named borrowings art. 68 makes. ' +
    'PG-6h-1 adds ACCOMMODATION_68X3_2026 under the new taxRegime "accommodation-flat-ratio": the art. ' +
    '68^3 flat 30 % expense ratio and the 10 % rate with „impozitul fiind final" (Legea 239/2025 art. XII ' +
    'pct. 5, from FY2026 incomes). It is a METHOD rule, not a second CAS / CASS / income-tax rule: the ' +
    'contribution figures stay owned by CAS_2026 and CASS_2026. Two of its alineate are carried as open ' +
    'questions and are NOT encoded — alin. (3) (platform-commission scope, B-80) and alin. (1) (the ' +
    'tourism-law eligibility gate) — because both move the gross and no primary source resolves them. ' +
    'No existing rule value, threshold or citation moved, so the release version moved from 1 to 2 only ' +
    'because the rule set did.',
};
