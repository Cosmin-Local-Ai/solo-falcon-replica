import type { FiscalRule } from './rules';

const PROVENANCE_2026 = {
  jurisdiction: 'RO',
  entityType: 'PFA',
  taxYear: 2026,
  // Re-verified 2026-10-05 against primary sources; see docs/ai/phases/02_fiscal_baseline.md.
  verifiedAt: '2026-10-05',
  status: 'ACTIVE' as const,
  version: 1,
};

// Provenance for this package is authoritative in docs/ai/phases/02_fiscal_baseline.md, which
// supersedes docs/ai/research/06_2026_fiscal_research.md.
// Minimum-wage anchor for all annual SM multiples below: CF art. 135^1 alin. (3) — "se ia în calcul
// valoarea salariului minim brut pe țară … în vigoare la data de 1 ianuarie a anului de realizare a
// venitului". A mid-year SM increase must NOT re-anchor the 12/24/72-SM annual bases, so the H2 2026
// wage rule below is irrelevant to the annual fiscal bases.
// SM values VERIFIED (U-6 closed): 4,050 lei on 1 ianuarie 2026 (HG 1.506/2024, MO I 1185/28.11.2024)
// and 4,325 lei from 1 iulie 2026 (HG 146/2026, MO 196/13.03.2026, which abrogă HG 1.506/2024 at that
// date). ANAF states the 2026 CASS ceiling as "291.600 lei (72 x 4.050 lei)", confirming the 1 January
// anchor. Any "8,100 / 8,600 lei" figure seen in older notes is a hallucination — do not reintroduce it.
export const PFA_2026_SYSTEM_REAL_PACKAGE: FiscalRule[] = [
  {
    ...PROVENANCE_2026,
    ruleId: 'PFA_2026_TAX_REFERENCE',
    name: 'PFA 2026 tax reference (4050 lei)',
    taxRegime: 'wage-reference',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    parameters: [
      { id: 'reference', label: 'Reference value', value: 4050, unit: 'lei' },
      { id: 'multiple_6x', label: '6x reference', value: 24300, unit: 'lei' },
      { id: 'multiple_12x', label: '12x reference', value: 48600, unit: 'lei' },
      { id: 'multiple_24x', label: '24x reference', value: 97200, unit: 'lei' },
      { id: 'multiple_72x', label: '72x reference', value: 291600, unit: 'lei' },
    ],
    calculatorId: 'calc-wage-reference',
    sourceAct: 'HG 1506/2024',
    sourceArticle: 'art. 1',
    sourceUrl: 'https://www.legalteka.ro/act/1506/2024',
  },
  {
    ...PROVENANCE_2026,
    ruleId: 'GENERAL_MINIMUM_WAGE_2026_H1',
    name: 'Minimum wage H1 2026 (Jan–Jun)',
    taxRegime: 'wage-reference',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-06-30',
    parameters: [
      { id: 'monthly', label: 'Monthly minimum wage', value: 4050, unit: 'lei' },
    ],
    calculatorId: 'calc-wage-reference',
    sourceAct: 'HG 1506/2024',
    sourceArticle: 'art. 1',
    sourceUrl: 'https://www.legalteka.ro/act/1506/2024',
  },
  {
    ...PROVENANCE_2026,
    ruleId: 'GENERAL_MINIMUM_WAGE_2026_H2',
    name: 'Minimum wage H2 2026 (Jul–Dec)',
    taxRegime: 'wage-reference',
    effectiveFrom: '2026-07-01',
    effectiveTo: null,
    parameters: [
      { id: 'monthly', label: 'Monthly minimum wage', value: 4325, unit: 'lei' },
    ],
    calculatorId: 'calc-wage-reference',
    sourceAct: 'HG 146/2026',
    sourceArticle: 'art. 1',
    sourceUrl: 'https://www.legalteka.ro/act/146/2026',
  },
  {
    ...PROVENANCE_2026,
    ruleId: 'CAS_2026',
    name: 'CAS 2026 (25%)',
    taxRegime: 'cas',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    parameters: [
      { id: 'rate', label: 'CAS rate', value: 25, unit: 'percent' },
      { id: 'min_base', label: 'Minimum base (12 SM annual)', value: 48600, unit: 'lei' },
      { id: 'max_base', label: 'Maximum base (24 SM annual)', value: 97200, unit: 'lei' },
      { id: 'min_cas', label: 'Minimum CAS', value: 12150, unit: 'lei' },
      { id: 'max_cas', label: 'Maximum CAS', value: 24300, unit: 'lei' },
    ],
    calculatorId: 'calc-cas',
    // CF art. 148 alin. (2) lit. a) — 12 SM minimum base for art. 137 alin. (1) lit. b)/b^1) income.
    // Amended by OUG nr. 128 din 07.11.2024, Punctul 20, Art. I (MO 1125/11.11.2024), applying
    // "începând cu veniturile aferente anului 2025". No 6-SM tier survives for art. 68 income — it now
    // sits only in art. 170 alin. (2)-(3) (CASS, art. 155 alin. (1) lit. c)-h)).
    // NOTE: art. 148 alin. (2) is a TIER LADDER, not a clamp. Above 24 SM the base is the actual
    // venitul ales, so max_base/max_cas are NOT statutory caps (phases/02 §2.1) — Phase 3 must model
    // the tiers rather than enforce max_cas.
    // GAP U-5 (UNVERIFIED): the CAS salary/pension exemption branch (CF art. 147 alin. (1)) is not
    // modelled and no rule reads salaryStatus/pensionStatus.
    sourceAct: 'Cod fiscal — OUG nr. 128/2024, Art. I pct. 20 (MO 1125/11.11.2024)',
    sourceArticle: 'art. 148 alin. (2) lit. a); SM anchor art. 135^1 alin. (3)',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/312601',
  },
  {
    ...PROVENANCE_2026,
    ruleId: 'CASS_2026',
    name: 'CASS 2026 (10%)',
    taxRegime: 'cass',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    parameters: [
      { id: 'rate', label: 'CASS rate', value: 10, unit: 'percent' },
      { id: 'min_base', label: 'Minimum base (6 SM annual)', value: 24300, unit: 'lei' },
      { id: 'max_annual_base', label: 'Max annual base (72 SM)', value: 291600, unit: 'lei' },
      { id: 'min_cass', label: 'Minimum CASS', value: 2430, unit: 'lei' },
      { id: 'max_cass', label: 'Maximum CASS', value: 29160, unit: 'lei' },
    ],
    calculatorId: 'calc-cass',
    // CF art. 170 alin. (1) — 72 SM annual ceiling (raised 60→72 SM by Legea 239/2025, Art. XII pct. 19,
    // MO 1160/15.12.2025). Portal note: "prevederile art. XII pct. 19 se aplică începând cu veniturile
    // aferente anului 2026" — 72 SM governs the 2026 income year, not 2027.
    // Pensioner relief: CF art. 174 alin. (7) lit. c) (introduced by Legea 141/2025) disapplies the
    // art. 174 alin. (6) top-up to 6 SM.
    // GAP U-2 (UNVERIFIED): no statutory MINIMUM base is sourced for art. 68 sistem-real income. The
    // 6-SM rungs of art. 170 alin. (2)-(3) cover art. 155 alin. (1) lit. c)-h) income, not art. 68.
    // The min_base label "6 SM annual" below is therefore UNSOURCED — do not treat it as verified.
    sourceAct: 'Cod fiscal — Legea 239/2025, Art. XII pct. 19 (MO 1160/15.12.2025)',
    sourceArticle: 'art. 170 alin. (1); relief art. 174 alin. (7) lit. c)',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/305208',
  },
  {
    ...PROVENANCE_2026,
    ruleId: 'INCOME_TAX_2026',
    name: 'Income tax 2026 (10%)',
    taxRegime: 'income-tax',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    parameters: [
      { id: 'base_rate', label: 'Base rate', value: 10, unit: 'percent' },
      // REMOVED in Phase 2: `progressive_rate: 16` was legally unfounded for this entity type. CF
      // art. 115 alin. (1) lit. b) applies 16% only to art. 114 alin. (2) lit. h)/i) "alte venituri",
      // and art. 114 alin. (1) confines that category to incomes NOT under art. 61 lit. a)-h). PFA
      // sistem real income is art. 61 lit. a) / art. 68, so it is outside art. 114 entirely and takes
      // 10%. The parameter was dead data — calcIncomeTax reads `base_rate` only (calculators.ts).
      // The stale "16% progressive surcharge" NOTE string inside calcIncomeTax is a Phase 5 cleanup.
    ],
    calculatorId: 'calc-income-tax',
    // CF art. 123 alin. (1): "…prin aplicarea cotei de 10% asupra venitului net anual impozabil
    // determinat potrivit art. 118."
    // GAP U-1 (UNVERIFIED — must stay REVIEW_REQUIRED, never a computed rule): the treatment of
    // non-deductible TVA for a neplătitor de TVA is not established by any operative provision.
    // OMFP 3254/2017 art. 5 alin. (6) carves out only "TVA dedusă"; art. 5 alin. (4) does not list
    // non-deductible TVA among the exclusions; nothing affirmatively makes it deductibilă.
    sourceAct: 'Cod fiscal (consolidat)',
    sourceArticle: 'art. 123 alin. (1) + art. 118; 16% inapplicable per art. 114 alin. (1), art. 115 alin. (1) lit. b)',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/312601',
  },
  {
    ...PROVENANCE_2026,
    ruleId: 'VAT_THRESHOLD_2026',
    name: 'VAT registration threshold 2026',
    taxRegime: 'vat',
    effectiveFrom: '2025-09-01',
    effectiveTo: null,
    parameters: [
      { id: 'threshold', label: 'VAT threshold', value: 395000, unit: 'lei' },
    ],
    calculatorId: 'calc-vat-threshold',
    // CF art. 310 alin. (1) — "plafonul de 395.000 lei", unchanged for 2026. Amended by ORDONANȚA
    // nr. 22 din 28.08.2025 (an OG, NOT an OUG — the portal labels it ORDONANȚA), MO 806/29.08.2025,
    // in force 01.09.2025 (art. II; art. III grandfathers the 300.000-lei transition). This replaces
    // the previous mis-citation of art. 338, which is not the small-enterprise exemption plafon.
    // OUG 8/2026 raises only the TVA la încasare plafon (art. 282 alin. (3)) — not this threshold.
    // CAVEAT: art. 310 alin. (2) "exclusiv taxa" attaches to the scoatere-din-evidența case; the
    // VAT-exclusive reading holds because no provision measures the plafon TVA-inclusiv (phases/02 §7.1).
    // GAP (Phase 8): dashboard.ts feeds VAT-inclusive ytd.revenue to this test.
    sourceAct: 'Cod fiscal — Ordonanța nr. 22/2025 (MO 806/29.08.2025)',
    sourceArticle: 'art. 310 alin. (1)',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/312601',
  },
  {
    ...PROVENANCE_2026,
    ruleId: 'PFA_DEADLINE_2026',
    name: 'PFA single deadline 2026',
    taxRegime: 'deadlines',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    parameters: [
      { id: 'deadline', label: 'Single deadline', value: '2027-05-25', unit: 'date' },
    ],
    calculatorId: 'calc-deadline',
    // CF art. 122 alin. (3) — "…până la data de 25 mai inclusiv a anului următor celui de realizare a
    // veniturilor." NOT alin. (1), which only enumerates when the obligation arises. The 2027-05-25
    // value is correct. OUG 8/2026 art. 8 is a 3% bonificație for filing/paying by 15 April 2026 for
    // the 2025 year — an early-filing incentive, not a deadline change.
    // GAP U-3 (MEDIUM): which act last amended art. 122 alin. (3) is not pinned (ANAF consolidation is
    // annotative). GAP U-4 (UNVERIFIED): quarterly instalment payment dates (art. 123 alin. (2)-(4),
    // art. 147/151 CAS, art. 174 alin. (1)-(3) CASS) are not established — needed by Phase 9.
    sourceAct: 'Cod fiscal (consolidat)',
    sourceArticle: 'art. 122 alin. (3); payment art. 123 alin. (1)',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/312601',
  },
];
