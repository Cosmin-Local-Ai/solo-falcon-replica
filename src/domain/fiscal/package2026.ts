import type { FiscalRule } from './rules';
import { lei } from '../money';
import { DEDUCTIBILITY_RULES_2026 } from './deductibility2026';

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
// TASK 9 (citation hygiene): the two wage rules below cited a commercial mirror (legalteka.ro). They now
// cite the same acts on Portal Legislativ, the Ministry of Justice's own register: HG 1.506 din 27
// noiembrie 2024 is document 291450 (the 28.11.2024 date is the MONITORUL OFICIAL issue, not the signing
// date — the act is "din 27 noiembrie 2024"), and HG 146 din 12 martie 2026 is document 308231. Both ids
// were read off the primary pages, and 291450 is corroborated by the hyperlink in HG 146/2026 art. 2.
// HG 1.506/2024 art. 1 fixes 4.050 lei "începând cu data de 1 ianuarie 2025" with no end date, which is
// why it is still the act behind the 1 ianuarie 2026 anchor: no 2025 or H1-2026 wage act exists between
// it and HG 146/2026 (Portal Legislativ title search, newest first: 146/2026 → 1506/2024 → 598/2024).
// `sourceAct` strings are deliberately UNCHANGED — thresholds.ts maps them to `computedFrom.smAct`, and
// the surfaces and tests cite them verbatim.
export const PFA_2026_SYSTEM_REAL_PACKAGE: FiscalRule[] = [
  {
    ...PROVENANCE_2026,
    ruleId: 'PFA_2026_TAX_REFERENCE',
    name: 'PFA 2026 tax reference (4050 lei)',
    taxRegime: 'wage-reference',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    parameters: [
      { id: 'reference', label: 'Reference value', value: lei(4050), unit: 'lei' },
      // DELETED in Phase 5 (defect B-6, the part left open by Phases 3-4): `multiple_6x` / `multiple_12x` /
      // `multiple_24x` / `multiple_72x` were duplicate data with no reader anywhere in src/ or e2e/ (verified
      // by grep). Each equals
      // `reference` x n, and every consumer that needs a multiple derives it at the point of use —
      // calcCas and calcCass both compute their floors/ceilings as base x rate from their own
      // `min_base` / `tier2_base` / `max_annual_base` parameters. Keeping five copies of one legal
      // figure (HG 1506/2024 art. 1: salariul de bază 4.050 lei) is exactly the drift risk the
      // one-figure-one-source rule exists to prevent. The SM multiples that ARE law (6/12/24/72 SM in
      // CF art. 151 alin. (1), art. 170 alin. (1), art. 174 alin. (6)) live as `min_base` / `tier2_base`
      // / `max_annual_base` on the CAS and CASS rules, where they are read. `verifiedAt` is unchanged:
      // the 4.050 lei figure was not re-verified here, only unreferenced duplicates were removed.
    ],
    calculatorId: 'calc-wage-reference',
    sourceAct: 'HG 1506/2024',
    sourceArticle: 'art. 1',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/291450',
  },
  {
    ...PROVENANCE_2026,
    ruleId: 'GENERAL_MINIMUM_WAGE_2026_H1',
    name: 'Minimum wage H1 2026 (Jan–Jun)',
    taxRegime: 'wage-reference',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-06-30',
    parameters: [
      { id: 'monthly', label: 'Monthly minimum wage', value: lei(4050), unit: 'lei' },
    ],
    calculatorId: 'calc-wage-reference',
    sourceAct: 'HG 1506/2024',
    sourceArticle: 'art. 1',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/291450',
  },
  {
    ...PROVENANCE_2026,
    ruleId: 'GENERAL_MINIMUM_WAGE_2026_H2',
    name: 'Minimum wage H2 2026 (Jul–Dec)',
    taxRegime: 'wage-reference',
    effectiveFrom: '2026-07-01',
    effectiveTo: null,
    parameters: [
      { id: 'monthly', label: 'Monthly minimum wage', value: lei(4325), unit: 'lei' },
    ],
    calculatorId: 'calc-wage-reference',
    sourceAct: 'HG 146/2026',
    sourceArticle: 'art. 1',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/308231',
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
      { id: 'min_base', label: 'Tier-1 floor (12 SM annual)', value: lei(48600), unit: 'lei' },
      { id: 'tier2_base', label: 'Tier-2 floor (24 SM annual) — not a ceiling', value: lei(97200), unit: 'lei' },
      { id: 'tier1_cas', label: 'CAS at the 12 SM floor', value: lei(12150), unit: 'lei' },
      { id: 'tier2_cas', label: 'CAS at the 24 SM floor — not a ceiling', value: lei(24300), unit: 'lei' },
    ],
    calculatorId: 'calc-cas',
    // CF art. 148 alin. (2) lit. a) — 12 SM minimum base for art. 137 alin. (1) lit. b)/b^1) income.
    // Amended by OUG nr. 128 din 07.11.2024, Punctul 20, Art. I (MO 1125/11.11.2024), applying
    // "începând cu veniturile aferente anului 2025". No 6-SM tier survives for art. 68 income — it now
    // sits only in art. 170 alin. (2)-(3) (CASS, art. 155 alin. (1) lit. c)-h)).
    // art. 148 alin. (2) is a TIER LADDER, not a clamp: the base is "venitul ales de contribuabil, care
    // nu poate fi mai mic decât" 12 SM (income between 12 and 24 SM) or 24 SM (income at or above 24 SM).
    // Realized income only selects which floor applies, and the article contains NO upper cap — unlike
    // CASS art. 170 alin. (1) ("nu poate fi mai mare decât"), which genuinely is one. Below 12 SM the
    // obligation never arises at all (art. 148 alin. (1)), so CAS is 0, not 12.150. `tier2_base` and
    // `tier2_cas` are that floor and the CAS at it — they are NOT maximums, and calcCas reads them from
    // these parameters instead of hardcoding them (phases/02 §2.1, phases/03_cas.md).
    // The CAS exemption is CF art. 150 alin. (1) — pensioners and persons insured in their own social
    // insurance system owe no CAS for art. 137 alin. (1) lit. b)/b^1) income. NOT art. 147, which is the
    // monthly declarative duty (D112). Art. 150 alin. (2) exempts salary earners only for lit. b^1)
    // (drepturi de proprietate intelectuală), so salaryStatus does NOT exempt. Modelled in calcCas via
    // CalculatorInput.pensionStatus; GAP U-5 closed in Phase 3.
    sourceAct: 'Cod fiscal — OUG nr. 128/2024, Art. I pct. 20 (MO 1125/11.11.2024)',
    sourceArticle: 'art. 148 alin. (1)-(2) lit. a); exceptie art. 150 alin. (1); SM anchor art. 135^1 alin. (3)',
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
      { id: 'min_base', label: 'Top-up floor (6 SM annual) — CF art. 174 alin. (6); conditional, not an unconditional minimum', value: lei(24300), unit: 'lei' },
      { id: 'max_annual_base', label: 'Max annual base (72 SM)', value: lei(291600), unit: 'lei' },
      // ── PG-6d (D-OTH-1, B-41): the CF art. 170 alin. (2)-(4) ladder for art. 155 alin. (1) lit. c)-h) ──
      // These are NEW parameters on the existing CASS rule; no existing value or citation moved. They live
      // here rather than on a rule of their own because the ladder is not a second contribution: art. 174¹
      // alin. (1) applies „cota de 10% … la baza anuală de calcul menționată la art. 170 alin. (3)”, i.e.
      // the same 10 % CASS rate on a different base, and `rate` and the 6-SM anchor are already on this
      // rule. Duplicating 24.300 as a second „6 SM” parameter would be the drift this file's own history
      // records (Phase 4 deleted `min_cass`/`max_cass`, Phase 5 deleted `multiple_6x`…`multiple_72x` for
      // exactly that reason), so rung 1 IS `min_base` and only rungs 2 and 3 are added.
      //
      // The rungs are a CLIFF, not a marginal rate: at 48.599 lei cumulated the base is 6 SM, at 48.600 it
      // is 12 SM. `calcCassLadder` reads them from here and never hard-codes a multiple.
      {
        id: 'ladder_tier2_base',
        label: 'Rung 2 of the art. 170 alin. (4) ladder (12 SM annual) — not a marginal rate',
        value: lei(48600),
        unit: 'lei',
        description:
          'art. 170 alin. (4) coroborat cu alin. (3): venit cumulatum din art. 155 alin. (1) lit. c)-h) de cel puțin 12 salarii minime brute alege baza de calcul de 12 SM. 12 × 4.050 = 48.600 lei, ancoră 1 ianuarie (art. 135¹ alin. (3)). Intervalurile sunt inclusive la limita de jos.',
      },
      {
        id: 'ladder_tier3_base',
        label: 'Rung 3 of the art. 170 alin. (4) ladder (24 SM annual) — the top rung',
        value: lei(97200),
        unit: 'lei',
        description:
          'art. 170 alin. (4) coroborat cu alin. (3): venit cumulatum de cel puțin 24 de salarii minime brute alege baza de calcul de 24 SM. 24 × 4.050 = 97.200 lei. Aceasta este ultima treaptă — art. 170 alin. (3) nu prevede o treaptă deasupra, spre deosebire de plafonul de 72 SM din art. 170 alin. (1), care privește venitul din art. 155 alin. (1) lit. b) și nu se aplică acestui bazin.',
      },
      {
        id: 'ladder_condition_precedent',
        label: 'Condiția de aplicabilitate a întregii trepte (art. 170 alin. (2))',
        value:
          'art. 170 alin. (2): „…datorează contribuția de asigurări sociale de sănătate la o bază de calcul stabilită potrivit alin. (3), dacă în anul de realizare a veniturilor valoarea cumulată a acestora este cel puțin egală cu 6 salarii minime brute pe țară.” Sub acest prag nu se datorează DELOC CASS pentru veniturile din art. 155 alin. (1) lit. c)-h): alin. (2) este o condiție prealabilă, nu o cotă. art. 170 alin. (5): „La încadrarea în plafonul prevăzut la alin. (4) nu se iau în calcul veniturile neimpozabile, prevăzute la art. 93 și 105.”',
        unit: 'text',
        description:
          'PG-6d. Cuantumul sub 6 SM nu se rotunjește la o bază de 6 SM — spre deosebire de art. 174 alin. (6), care este o diferență de contribuție pentru lit. b) și stă pe altă regulă.',
      },
      // REMOVED in Phase 4: `min_cass` (2,430) and `max_cass` (29,160) were independent parameters
      // encoding figures that are fully DERIVABLE as rate × min_base and rate × max_annual_base.
      // Two sources of truth for one legal number is the defect — `max_cass` was in fact read by
      // nothing at all (dead parameter), while `min_cass` was applied as an unconditional floor on
      // the CASS *value*, which is wrong: the 6-SM amount is a contribution TOP-UP under art. 174
      // alin. (6), disapplied by art. 174 alin. (7) lit. a)/c), and absent entirely under art. 174
      // alin. (2). calcCass now derives both amounts from the two bases. `min_base` and
      // `max_annual_base` keep their ids — thresholds.ts CASS_MIN_BASE / CASS_MAX_BASE read them
      // by string.
    ],
    calculatorId: 'calc-cass',
    // CF art. 170 alin. (1) — rate 10% and the 72 SM annual ceiling (raised 60→72 SM by Legea
    // 239/2025, Art. XII pct. 19, MO 1160/15.12.2025; portal note: "prevederile art. XII pct. 19 se
    // aplică începând cu veniturile aferente anului 2026" — 72 SM governs the 2026 income year, not
    // 2027). The same alin. (1) keeps art. 118 fiscal losses OUT of the base.
    // The 6-SM floor is CF art. 174 alin. (6), NOT art. 170 alin. (2)-(3): those rungs reach only
    // art. 155 alin. (1) lit. c)-h), while art. 68 sistem-real income is lit. b). Art. 174 alin. (6)
    // was introduced by OUG 128/2024 pct. 23 and is untouched by Legea 239/2025 (whose pct. 20 moves
    // alin. (4), (5), (11) only). It is a "diferență de contribuție" TOP-UP, not a substitution —
    // art. 118 alin. (2) lit. b) makes CASS deductible from the income-tax base "cu excepția
    // diferenței de contribuție … prevăzută la art. 174 alin. (6)".
    // Zero net income / fiscal loss: CF art. 174 alin. (2) — such persons "nu datorează contribuția"
    // at all; the 6-SM floor is not self-executing there (they may opt in under art. 180 alin. (1),
    // elective and not modelled).
    // Pension relief: CF art. 174 alin. (7) lit. c) (introduced by Legea 141/2025, Art. I pct. 34,
    // MO 699/25.07.2025; income year 2025 onward, so in force for 2026) disapplies ONLY the art. 174
    // alin. (6) top-up — 10% × net still stands. A pensioner with art. 68 net income is NOT CASS-free,
    // unlike CAS where art. 150 alin. (1) exempts entirely. Do not route pension through art. 154 or
    // art. 174 alin. (8): Legea 141/2025 pct. 35 narrowed alin. (8) to art. 154 alin. (1) lit. a), b),
    // e) și f), and pensioners sit at lit. h)/h²) — not in that list.
    // GAP U-2 IS CLOSED (2026-10-06): the 6-SM floor for art. 68 income IS sourced — at art. 174
    // alin. (6). The value 24,300 was always numerically correct for 2026 (6 × 4,050 lei, the SM in
    // force on 1 ianuarie 2026 per CF art. 135^1 alin. (3)); only its citation was wrong. For 2027 the
    // same anchor gives 6 × 4,325 = 25,950 lei; HG 146/2026's mid-year rise does not re-anchor 2026.
    // OPEN RISK U-8: it is NOT established that OUG 89/2025 (MO 1203/24.12.2025) and OUG 8/2026
    // (MO 147/25.02.2026) leave art. 170 / 174 / 154 / 180 untouched — see docs/ai/phases/04_cass.md.
    sourceAct: 'Cod fiscal — OUG nr. 128/2024, Art. I pct. 22-23 (MO 1125/11.11.2024); Legea 239/2025, Art. XII pct. 19 (MO 1160/15.12.2025); Legea 141/2025, Art. I pct. 34 (MO 699/25.07.2025)',
    sourceArticle: 'art. 170 alin. (1) (cotă 10%, plafon 72 SM); art. 170 alin. (2)-(4) (scara de 6 / 12 / 24 SM pentru art. 155 alin. (1) lit. c)-h), citită în research/41 §2-§3); art. 170 alin. (5) (veniturile neimpozabile de la art. 93 și 105 nu se cumulează); art. 174¹ alin. (1) (cota de 10% se aplică bazei anuale de la art. 170 alin. (3)); art. 174 alin. (6) (prag de 6 SM prin diferență de contribuție); art. 174 alin. (2) (VNA zero / pierdere fiscală); excepție art. 174 alin. (7) lit. c); ancoră SM art. 135^1 alin. (3)',
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
      // The stale "16% progressive surcharge" NOTE string inside calcIncomeTax was removed in Phase 5
      // (the cleanup named in defect B-4's "Fixed in" cell): there is no second rate for art. 61 lit. a) / art. 68 income, so there was
      // nothing to review and the note implied a REVIEW_REQUIRED that no rule or parameter supports.
    ],
    calculatorId: 'calc-income-tax',
    // CF art. 123 alin. (1): "…prin aplicarea cotei de 10% asupra venitului net anual impozabil
    // determinat potrivit art. 118."
    // Regime gate (defect B-14): a PFA cannot be a Titlul II (impozit pe profit) taxpayer — CF art. 13
    // alin. (1), art. 14 and art. 15 confine impozitul pe profit to persoane juridice, and the former
    // option vehicle CF art. 120 is Abrogat (OUG 128/2024 pct. 11 Art. I, MO 1125/11.11.2024, 01.01.2025).
    // Phase 5 (defects B-13/B-15) re-verified the BASE that the 10% applies to, i.e. art. 118 alin. (2):
    //   lit. b)        venit net anual impozabil = însumarea veniturilor nete anuale recalculate, din
    //                  care se deduc CAS și CASS „datorate potrivit prevederilor titlului V, cu excepția
    //                  diferenței de contribuție de asigurări sociale de sănătate prevăzută la art. 174
    //                  alin. (6)” (OUG 128/2024 pct. 10 Art. I), so the art. 174 alin. (6) difference is
    //                  owed but never deducted;
    //   alin. (2^2)    CAS deductibilă prorata: (venit net anual în sistem real ÷ total venituri cumulate
    //                  art. 148 alin. (3)) × contribuția calculată potrivit art. 151 alin. (1);
    //   alin. (2^3)    CASS deductibilă prorata: (venit net anual în sistem real ÷ total venituri cumulate
    //                  art. 170 alin. (1)) × contribuția calculată potrivit art. 174 alin. (1);
    //   alin. (2^4)    „nu poate depăși nivelul venitului net anual recalculat”;
    //   lit. a) + alin. (4)-(5)  pierderea netă recalculată pe fiecare sursă, reportată 5 ani fiscali în
    //                  limita a 70% din veniturile nete anuale din aceeași sursă.
    // GAP U-1 (UNVERIFIED — must stay REVIEW_REQUIRED, never a computed rule): the treatment of
    // non-deductible TVA for a neplătitor de TVA is not established by any operative provision.
    // OMFP 3254/2017 art. 5 alin. (6) carves out only "TVA dedusă"; art. 5 alin. (4) does not list
    // non-deductible TVA among the exclusions; nothing affirmatively makes it deductibilă.
    sourceAct: 'Cod fiscal (consolidat)',
    sourceArticle: 'art. 123 alin. (1) + art. 118 alin. (2) lit. b), alin. (2^2)-(2^4), alin. (2) lit. a) si alin. (4)-(5); 16% inaplicabil per art. 114 alin. (1), art. 115 alin. (1) lit. b); regim PFA per art. 13 alin. (1), art. 14, art. 15 si art. 120 Abrogat',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/312601',
    // Provenance override (Phase 5): the legal reading of the taxable base was re-verified against the
    // consolidated CF text on 2026-10-06 (docs/ai/research/08_art118_income_tax_2026.md). `version` stays
    // 1 — the numeric parameter (base_rate 10%) did not change; only the citation and the composition
    // order of the base moved.
    verifiedAt: '2026-10-06',
  },
  // ── PG-6h-1: art. 68^3 — the flat 30 % expense ratio, the only determination method the law
  // supplies for `prestarea de servicii de cazare` from FY2026 (D-CAZ-1).
  //
  // This rule carries the METHOD, not a contribution rule and not a second rate for another regime.
  // The CAS and CASS consequences of the 68^3 net are computed by CAS_2026 and CASS_2026 under their
  // own regimes — see `tax.ts` for where the net is cumulated and where it is ring-fenced.
  {
    ...PROVENANCE_2026,
    ruleId: 'ACCOMMODATION_68X3_2026',
    name: 'Venit din prestarea de servicii de cazare — cotă forfetară 30 %, cota 10 % (art. 68^3)',
    taxRegime: 'accommodation-flat-ratio',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    parameters: [
      {
        id: 'expense_ratio',
        label: 'Cotă forfetară de cheltuieli (procente din venitul brut)',
        value: 30,
        unit: 'percent',
        // art. 68^3 alin. (2): „Venitul net anual din prestarea de servicii de cazare se determină
        // prin deducerea din venitul brut a cheltuielilor determinate prin aplicarea cotei forfetare
        // de 30% asupra venitului brut." This is an EXPENSE ratio, not a tax rate: the net is 70 % of
        // gross. Reading 30 as the rate applied to gross would be a 10× error in the wrong direction.
        description:
          'art. 68^3 alin. (2): cheltuieli forfetare = 30 % din venitul brut, deci venitul net = 70 % din venitul brut. Nu este o cotă de impozitare.',
      },
      {
        id: 'tax_rate',
        label: 'Cota de impozitare aplicată venitului net (procente)',
        value: 10,
        unit: 'percent',
        // art. 68^3 alin. (6): „Impozitul anual datorat … se determină prin aplicarea cotei de 10%
        // asupra venitului net, impozitul fiind final." „impozitul fiind final" is what makes the
        // effective burden 7 % of gross: CAS and CASS are NOT deducted from this base. That is the
        // contrast with art. 123 alin. (1) + art. 118 alin. (2), where they are — see INCOME_TAX_2026.
        description:
          'art. 68^3 alin. (6): 10 % asupra venitului net, „impozitul fiind final" — effective 7 % din venitul brut; CAS și CASS nu se scad din această bază.',
      },
      {
        id: 'fx_basis',
        label: 'Temeiul de conversie pentru veniturile în valută',
        value: 'last_banking_day_before_collection',
        unit: 'text',
        // art. 68^3 alin. (4): the BNR rate „din ultima zi bancară anterioară" each collection. NOT an
        // annual average and NOT the year-end rate. The machinery that applies it is the Phase 10c
        // ledger pass (`fx/ledger.ts`, basis `payment_date_daily` with the labelled carry-forward from
        // the last published banking day) — reused, not reimplemented.
        description:
          'art. 68^3 alin. (4): cursul BNR din ultima zi bancară anterioară fiecărei încasări; nu media anuală, nu cursul de la sfârșitul anului.',
      },
      {
        id: 'filing_deadline',
        label: 'Termen de depunere a declarației unice',
        value: '2027-05-25',
        unit: 'date',
        description:
          'art. 68^3 alin. (9) cu art. 122 alin. (3): declarația unică se depune până la data de 25 mai inclusiv a anului următor. NU art. 121.',
      },
      {
        id: 'payment_deadline',
        label: 'Termen de plată',
        value: '2027-05-25',
        unit: 'date',
        description:
          'art. 68^3 alin. (10) cu art. 122 alin. (3): impozitul se achită tot până la 25 mai — același termen ca depunerea. NU art. 121.',
      },
      {
        id: 'gross_scope_open_question',
        label: 'Întrebare deschisă: comisionul reținut de platformă (alin. (3))',
        value:
          'art. 68^3 alin. (3) exclude din venitul brut „comisionul reținut de către entitățile care facilitează închirierea pe termen scurt a camerelor situate în locuințe proprietate personală", dar alineatul stă într-un articol al cărui subiect la alin. (1) este spațiul unui operator economic din turism. Citește A: excluderea operează doar prin alin. (12) / art. 83 alin. (4), deci brutul unui hotel e suma integrală încasată. Citește B: este o regulă generală de stabilire a brutului pentru tot venitul din art. 68^3. ANAF Brașov înclină spre B, textul legii spre A; nicio sursă primară nu le împacă. Alegearea uneia schimbă brutul, deci impozitul, baza de CASS și pragul de CAS — aplicația nu alege.',
        unit: 'text',
        description:
          'B-80 (`docs/ai/research/38_art68x3_cass_and_occupancy_order.md` §3 și §5). Rămâne review_required până la 6h-2, care pune întrebarea utilizatorului (D-COM-1). Fără nicio valoare implicită.',
      },
      {
        id: 'eligibility_open_question',
        label: 'Întrebare deschisă: cine intră sub alin. (1)',
        value:
          'art. 68^3 alin. (1) se adresează „operatorilor economici definiți potrivit legislației specifice domeniului turismului – contribuabili potrivit prezentului titlu". Dacă o persoană fizică care închiriază spațiu de cazare este sau nu „operator economic" se decide în Legea 97/2020 / OG 21/2015 și în autorizația ONRC, nu în Codul fiscal. Aplicația poate întreba; nu poate decide.',
        unit: 'text',
        description:
          'research/38 §3 alin. (1) și §5 pct. 6. Rămâne review_required; 6h-2 o pune ca întrebare (D-COM-1).',
      },
    ],
    calculatorId: 'calc-accommodation-flat-ratio',
    // Introduced by Legea nr. 239 din 15.12.2025 (MO 1160/15.12.2025), art. XII pct. 5, aplicabilă
    // „începând cu veniturile aferente anului 2026" (art. XIII alin. (2) lit. b)). Read in full against
    // the Codul fiscal consolidation at 08.08.2026 (Portal Legislativ 171282) in
    // `docs/ai/research/38_art68x3_cass_and_occupancy_order.md` §3 — no later amendment.
    //
    // NOT ENCODED, deliberately:
    //  - alin. (3) — the platform-commission scope (B-80). Two live readings, no primary resolution.
    //    It is carried above as an open question, never as a default.
    //  - alin. (1) — the tourism-law eligibility gate. Outside the fiscal code.
    //  - alin. (12) / art. 83 alin. (4) — the >7-rooms conversion, and art. 85 alin. (1)-(2) for the
    //    1-7 room case. Those decide WHO lands on this method, which is 6h-2's question, not arithmetic.
    //  - alin. (8) — the occupancy sheet (OPANAF 381/2026, MO I 250/31.03.2026). That is 6h-3, under
    //    D-OCC-1.
    //  - Any SM multiple. The 6/12/24/72-SM figures this method touches are already year-scoped on
    //    CAS_2026 and CASS_2026 (taxYear 2026). Nothing here may hard-code 24.300 or 291.600, because
    //    the FY2027 minimum wage is not published and a 2027 release does not exist yet.
    sourceAct: 'Cod fiscal — Legea nr. 239/2025, Art. XII pct. 5 (MO 1160/15.12.2025)',
    sourceArticle:
      'art. 68^3 alin. (2) (cotă forfetară 30 % din venitul brut); art. 68^3 alin. (6) (cota 10 % asupra venitului net, „impozitul fiind final"); art. 68^3 alin. (4) (curs BNR din ultima zi bancară anterioară încasării); art. 68^3 alin. (5) (fracțiune de an considerată venit anual, fără proration); art. 68^3 alin. (9)-(10) cu art. 122 alin. (3) (depunere și plată până la 25 mai); art. 68^3 alin. (11) (impozitul este delimitat, contribuțiile se cumulează)',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/305208',
    // Re-verified 2026-10-11 against the 08.08.2026 consolidation and Legea 239/2025 in research/38.
    verifiedAt: '2026-10-11',
  },
  // PG-6e (B-31, D-FA-1) — the Titlul II amortisation figures a Titlul IV PFA inherits through art. 68
  // alin. (4) lit. d) („să respecte regulile privind amortizarea, prevăzute în titlul II, după caz”).
  // Read only by `domain/fiscal/depreciation.ts`. It supplies no treatment and no rate: the treatments of a
  // capital purchase and of depreciation stay exactly where they were, on `EXPENSE_DEPRECIABLE_ASSET_PURCHASE_2026`
  // (art. 68 alin. (7) lit. h)) and `EXPENSE_DEPRECIATION_BUSINESS_ASSET_2026` (art. 68 alin. (4) lit. d)),
  // and `EXPENSE_DEPRECIATION_PERSONAL_PATRIMONY_2026` keeps `non_deductible` under art. 68 alin. (7)
  // lit. k^1) — the chapeau of alin. (7) is „Nu sunt cheltuieli deductibile:”, so k^1) is an exclusion and
  // the code already had it right. `docs/ai/research/36_fixed_assets_and_depreciation_2026.md` §5.1.
  {
    ...PROVENANCE_2026,
    ruleId: 'FISCAL_DEPRECIATION_2026',
    name: 'Amortizarea fiscală — prag 5.000 lei, plafon M1 1.500 lei/lună, coeficienți de degresivitate',
    taxRegime: 'fiscal-depreciation',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    parameters: [
      {
        id: 'expensing_threshold',
        label: 'Pragul de la care un bun este mijloc fix amortizabil',
        value: lei(5000),
        unit: 'lei',
        // OUG nr. 8 din 24.02.2026 (MO 147/25.02.2026) art. 6 pct. 7 rewrote art. 28 alin. (2) lit. b):
        // „la data intrării în patrimoniul contribuabilului, are o valoare fiscală egală sau mai mare
        // decât suma de 5.000 lei; această limită se actualizată anual, în funcție de indicele de
        // inflație, prin hotărâre a Guvernului” (the official text really does read „se actualizată”).
        // OUG 8/2026 art. 10 alin. (2) puts pct. 1-14 into force „începând cu anul fiscal 2026”, which
        // covers January–February 2026 purchases too. Measured at entry into the patrimony, NOT at payment.
        // `research/36` §15 is a documented negative: no indexation HG has been issued, so 5.000 lei is the
        // operative FY2026 figure and the parameter stays overridable rather than being inlined.
        description:
          'art. 28 alin. (2) lit. b) modificat prin OUG 8/2026 art. 6 pct. 7 (MO 147/25.02.2026). Măsurat la data intrării în patrimoniu, nu la plată. Nicio HG de indexare emisă (research/36 §15) — parametrul rămâne supraponibil.',
      },
      {
        id: 'm1_monthly_cap',
        label: 'Plafon lunar de amortizare pentru vehicule M1',
        value: lei(1500),
        unit: 'lei',
        // art. 28 alin. (14): pentru vehiculele din categoria M1 (maximum 9 scaune inclusiv conducătorul
        // auto, RNTR 2 / OMMLTL 211/2003), „cheltuielile cu amortizarea sunt deductibile, pentru fiecare,
        // în limita a 1.500 lei/lună”. **pentru fiecare** — the ceiling is per vehicle and carries no
        // one-car limit, which is the asymmetry `docs/ai/research/40_vehicle_one_car_limit.md` §4 records
        // against art. 68 alin. (5) lit. j), where running costs are limited to a single car. The two
        // ceilings are different provisions and `VehicleCapStatus` is deliberately not reused.
        description:
          'art. 28 alin. (14). Excesul peste plafon este pierdut definitiv, nu reportat (research/36 §12.13, coroborare secundară).',
      },
      {
        id: 'm1_disposal_monthly_cap',
        label: 'Plafon lunar la scăderea din gestiune a unui M1',
        value: lei(1500),
        unit: 'lei',
        // Normele HG 1/2016, Titlul II, Cap. II, Secțiunea a 8-a, pct. 27: „la momentul scăderii din
        // gestiune a mijloacelor de transport din categoria M1, valoarea rămasă neamortizată este
        // deductibilă în limita a 1.500 lei înmulțită cu numărul de luni rămase de amortizat din durata
        // normală de funcționare stabilită de contribuabil”. The duration used is the taxpayer's declared
        // one, not a Catalog default. Declared as its own parameter rather than reusing `m1_monthly_cap`,
        // because they are two provisions that happen to state the same number today — if one is amended
        // the other must not silently follow.
        description:
          'Normele Titlul II pct. 27. 1.500 lei × lunile rămase din durata stabilită de contribuabil.',
      },
      {
        id: 'degresive_coefficient_2_5',
        label: 'Coeficient de degresivitate pentru durata între 2 și 5 ani',
        value: 1.5,
        unit: 'count',
        description: 'art. 28 alin. (7): „1,5 dacă durata normală de utilizare … este între 2 și 5 ani”.',
      },
      {
        id: 'degresive_coefficient_6_10',
        label: 'Coeficient de degresivitate pentru durata între 6 și 10 ani',
        value: 2.0,
        unit: 'count',
        // The coefficient pct. 25's worked example uses: 350.000 lei, 10 ani, cota anuală 10 % × 2,0 = 20 %.
        description: 'art. 28 alin. (7): „2,0 … între 6 și 10 ani”.',
      },
      {
        id: 'degresive_coefficient_over_10',
        label: 'Coeficient de degresivitate pentru durata mai mare de 10 ani',
        value: 2.5,
        unit: 'count',
        description: 'art. 28 alin. (7): „2,5 … mai mare de 10 ani”.',
      },
      {
        id: 'first_year_basis',
        label: 'Temeiul de pornire a amortizării',
        value: 'month_after_put_in_function',
        unit: 'text',
        // art. 28 alin. (12) lit. a): „începând cu luna următoare celei în care mijlocul fix amortizabil se
        // pune în funcțiune”. There is no separate pro-rating formula in the law — §12.2 is a documented
        // negative: no daily formula, no monthly table, no first-year fraction anywhere in the 624-page
        // Partea I. The 1/12-per-month reading is this application's construction and is labelled as one.
        description:
          'art. 28 alin. (12) lit. a). Fracțiunea de 1/12 pe lună este construcția aplicației, nu o formulă citată (research/36 §12.2).',
      },
      {
        id: 'non_deductible_vat_in_base',
        label: 'TVA devenită nedeductibilă în valoarea fiscală',
        value: 'included_at_entry',
        unit: 'text',
        // Normele Titlul II pct. 28 lit. b), verbatim: „în valoarea fiscală a mijloacelor fixe, la data
        // intrării în patrimoniu, se include și taxa pe valoarea adăugată devenită nedeductibilă, potrivit
        // prevederilor titlului VII „Taxa pe valoarea adăugată” din Codul fiscal.” This is the first
        // affirmative non-recoverable-VAT rule in this repository, and it is scoped to the DEPRECIABLE
        // BASE. It does not reopen the question for ordinary expenses, so B-87 stays open after this phase.
        description:
          'Normele Titlul II pct. 28 lit. b). Scoped la baza de amortizare — nu rezolvă B-87 pentru cheltuielile curente.',
      },
      {
        id: 'sub_threshold_election_moment',
        label: 'Momentul opțiunii din art. 28 alin. (21)',
        value: 'entry_into_patrimony',
        unit: 'text',
        // Normele pct. 31: „opţiunea se efectuează la data intrării imobilizării corporale în patrimoniul
        // contribuabilului … fie la data punerii în funcţiune prin deducerea întregii valori fiscale … fie
        // începând cu luna următoare celei în care imobilizarea corporală este pusă în funcţiune, prin
        // efectuarea de deduceri de amortizare fiscală”. Two consequences the entity encodes: the election
        // is made at entry and cannot be flipped later, and even the full-expensing branch is timed at
        // punerea în funcțiune, not at payment.
        description:
          'Normele Titlul II pct. 31. Opțiune la intrarea în patrimoniu, alternativă pe bun, ambele ramuri timbrate la punerea în funcțiune.',
      },
      {
        id: 'payment_timing_open_question',
        label: 'Întrebare deschisă: plata versus punerea în funcțiune',
        value:
          'art. 68 alin. (4) lit. b) face deductibile cheltuielile „cuprinse în cheltuielile exercițiului financiar al anului în cursul căruia au fost plătite”, iar normele Titlul IV pct. 7 alin. (5) lit. n) fac amortizarea deductibilă fără nicio condiție de plată. research/36 §4.3 și §11.1 sunt un negativ documentat: nicio normă Titlul IV și nicio prevedere REF nu spun nici că amortizarea e deductibilă indiferent de plată, nici că e condiționată de plată. Citirea pe care o aplică aplicația — un bun pus în funcțiune în 2026 și plătit în 2027 începe să se amortizeze în 2026 — este o citire, nu o regulă citată, și este marcată ca atare. Când faptele o fac relevantă (neachitat, în rate, plată într-un an ulterior), modulul refuză și numește ambele laturi.',
        unit: 'text',
        description:
          'research/36 §4.3, §4.6, §11.1, §11.3. Fără nicio poziție ANAF primară; rămâne review_required când faptele fac coliziunea relevantă.',
      },
      {
        id: 'aport_vs_k1_open_question',
        label: 'Întrebare deschisă: aportul de bun amortizabil din patrimoniul personal',
        value:
          'art. 68 alin. (7) lit. k^1) — sub cuprinsul „Nu sunt cheltuieli deductibile:” — exclude „cheltuielile cu amortizarea bunurilor din patrimoniul personal afectate exercitării activității, potrivit legii”, fără excepție pentru aport. În sens contrar, art. 7 pct. 44 lit. c) definește valoarea fiscală a „mijloacelor fixe dobândite cu titlu gratuit ori constituite ca aport, la data intrării în patrimoniul contribuabilului, utilizată pentru calculul amortizării fiscale”. Normele pct. 7 dau o bază de amortizare pentru bunurile „care trec în patrimoniul altei afaceri” — doar afacerie→afacerie — și nu acoperă persoana fizică→PFA. research/36 §10.1: nicio răspuns ANAF, DGRFP sau Ministerul Finanțelor nu adresează bunurile amortizabile. Partea mai bine susținută este nedeductibilitatea (k^1) este absolută, deck-ul ANAF București o enunță pentru acest profil, consensul practicienilor este aici), dar textul de contrariu este viu. Modulul refuză și numește ambele texte.',
        unit: 'text',
        description:
          'research/36 §5.5, §10.2, §10.4, §10.5, §16.3. Nu se alege nicio latură; aportul rămâne review_required.',
      },
      {
        id: 'put_in_function_open_question',
        label: 'Întrebare deschisă: ce este „punerea în funcțiune”',
        value:
          'Expresia nu este definită nicăieri în legea fiscală. research/36 §12.3: căutată în toată Partea I de 624 de pagini, singura apropiere de definiție este la case de marcat, în normele art. 25 — „în luna punerii în funcţiune. Punerea în funcţiune se face potrivit prevederilor legale” — adică termenul este lăsat altor legi. Ancorarea în procesul-verbal de dare în folosință este doctrină de practician, nu text. Aplicația întreabă data și citează doctrina drept doctrină; fără dată refuză, pentru că fără ea nu există prima lună de amortizare.',
        unit: 'text',
        description:
          'research/36 §12.3, §16.4. Fără substituție de dată (factură, intrare în patrimoniu, plată).',
      },
      {
        id: 'm1_exception_evidence_open_question',
        label: 'Întrebare deschisă: cum se justifică excepțiile de la alin. (14)',
        value:
          'Normele nu spun nimic despre cum se justifică vreuna dintre cele patru categorii de excepție ale art. 28 alin. (14). research/36 §12.6: „M1” apare exact o dată în toată Partea I, la pct. 27. Singura cerință de justificare din normele Titlul IV este foaia de parcurs, și ea aparține regulii de 50 % a cheltuielilor de folosință — art. 68 alin. (7) lit. k) închide de altfel cu „Cheltuielile care intră sub incidența acestor prevederi nu includ cheltuielile privind amortizarea”. Aplicația nu inventează o cerință de justificare și nu tratează o foaie de parcurs ca probă a unei excepții M1.',
        unit: 'text',
        description:
          'research/36 §12.6, §12.7. Categoria este revendiată de contribuabil; nu este dedusă și nu este dovedită de foaia de parcurs.',
      },
    ],
    calculatorId: 'calc-fiscal-depreciation',
    // The borrowing chain, in the order the texts state it: CF art. 68 alin. (4) lit. d) („să respecte
    // regulile privind amortizarea, prevăzute în titlul II, după caz”), reinforced by alin. (4^1)
    // („cu excepția cheltuielilor cu amortizarea care sunt deductibile potrivit prevederilor alin. (4) lit.
    // d)”) and by Normele Titlul IV pct. 7 alin. (5) lit. n) („cheltuielile cu amortizarea, în conformitate
    // cu prevederile art. 28 din Codul fiscal, după caz”). The 5.000-lei figure is the OUG 8/2026 text, not
    // a consolidation — OUG 8/2026 art. 10 alin. (2) makes art. 6 pct. 1-14 applicable „începând cu anul
    // fiscal 2026”, so it governs the whole of FY2026 including January–February purchases.
    //
    // NOT ENCODED, deliberately:
    //  - The Catalog (HG 2.139/2004, MO 46/13.01.2005). Durations are „stabilită de contribuabil” per
    //    Normele pct. 27 and Catalog Cap. I pct. 4 gives a range to choose inside. A lookup would be a
    //    classification decision, and §16.1 records that even a mobile phone's class is a judgement.
    //  - art. 28 alin. (8) accelerată and alin. (8^1) superaccelerată. The 65 % method is gated on Catalog
    //    subgrupa 2.1 / 2.4, and §8.6 shows office IT sits in subgrupa 2.2 — encoding it would need the
    //    Catalog. The asymmetry is recorded in `data/types.ts`: alin. (5) lit. b) is scoped by asset type,
    //    alin. (8^1) by Catalog subgrupa, and one must not feed the other.
    //  - art. 28 alin. (12) lit. i1) — the 50 % head-office rule. §12.12: 0 hits for `lit. i1)` and for
    //    `sediu social` in the whole Partea I. Code-only, with no norm-level gloss; not modelled here.
    //  - Any carry-forward of the 1.500 lei/lună excess. §12.13: the excess is definitively lost.
    sourceAct: 'Cod fiscal — Legea nr. 227/2015 (MO 688/10.09.2015), art. 28 modificat prin OUG nr. 8/2026 (MO 147/25.02.2026), art. 6 pct. 7',
    sourceArticle:
      'art. 68 alin. (4) lit. d) și alin. (4^1) (trimitere la regulile amortizării din titlul II); art. 28 alin. (2) lit. b) (pragul de 5.000 lei la data intrării în patrimoniu, forma modificată prin OUG 8/2026 art. 6 pct. 7); art. 28 alin. (5) (metode); art. 28 alin. (6) (liniară); art. 28 alin. (7) (coeficienți 1,5 / 2,0 / 2,5); art. 28 alin. (12) lit. a) (amortizarea începe cu luna următoare punerii în funcțiune); art. 28 alin. (14) (M1, 1.500 lei/lună, „pentru fiecare”, patru categorii de excepție); art. 28 alin. (17) (fără amortizarea contabilă); art. 28 alin. (21) (opțiunea sub prag); Normele HG 1/2016 Titlul II Cap. II Secțiunea a 8-a pct. 25 (exemplul de calcul degresiv), pct. 27 (plafonul la scăderea din gestiune), pct. 28 lit. b) (TVA nedeductibilă în valoarea fiscală), pct. 29 (casarea), pct. 30 (investiții neterminate), pct. 31 (momentul opțiunii); Normele Titlul IV pct. 7 alin. (5) lit. n) și alin. (7)',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/312601',
    // Read against `docs/ai/research/36_fixed_assets_and_depreciation_2026.md`, both passes, 2026-10-12.
    verifiedAt: '2026-10-12',
  },
  {
    ...PROVENANCE_2026,
    ruleId: 'VAT_THRESHOLD_2026',
    name: 'VAT registration threshold 2026',
    taxRegime: 'vat',
    effectiveFrom: '2025-09-01',
    effectiveTo: null,
    parameters: [
      { id: 'threshold', label: 'VAT threshold', value: lei(395000), unit: 'lei' },
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
      // Phase 9b: what the deadline IS, and who it binds, is rule data — `computeDeadlines` no longer
      // hardcodes either. `event_type` must be a member of `DEADLINE_EVENT_TYPES`
      // (src/domain/deadlines.ts) or the rule emits nothing. No `event` parameter ⇒ fixed-date rule.
      { id: 'event_type', label: 'Deadline event type', value: 'd212_filing', unit: 'text' },
      { id: 'applies_to', label: 'Applies to', value: 'pfa', unit: 'text' },
    ],
    calculatorId: 'calc-deadline',
    // CF art. 122 alin. (3) — "…până la data de 25 mai inclusiv a anului următor celui de realizare a
    // veniturilor." NOT alin. (1), which only enumerates when the obligation arises. The 2027-05-25
    // value is correct. OUG 8/2026 art. 8 is a 3% bonificație for filing/paying by 15 April 2026 for
    // the 2025 year — an early-filing incentive, not a deadline change. Do NOT encode 15 April 2026 as
    // a deadline: it looks exactly like a quarterly instalment date and is the single most likely
    // source of a recurrence of that error (docs/ai/research/12_quarterly_payment_deadlines_2026.md §8).
    // GAP U-3 (MEDIUM): which act last amended art. 122 alin. (3) is not pinned (ANAF consolidation is
    // annotative).
    // GAP U-4 IS CLOSED (2026-10-07, docs/ai/research/12_quarterly_payment_deadlines_2026.md): there are
    // NO quarterly payment deadlines for a PFA în sistem real in 2026. Income tax, CAS and CASS are all
    // declared AND paid by 25 May of the following year — art. 68 alin. (9)-(10), art. 151 alin. (1) and
    // art. 174 alin. (15) each route to art. 122 alin. (3). The advance-payment article (art. 120/120^1)
    // is Abrogat from 01-01-2025 (OUG 128/2024 pct. 11 Art. I, MO 1125/11.11.2024) and CAS art. 160 has
    // been Abrogat since 01-01-2018. Phase 9b therefore DELETED the four quarterly event types rather
    // than re-citing them: the obligation does not exist, so no article could be found for it.
    // Payment citation corrected in Phase 9b: art. 123 alin. (1) is the RATE provision ("Impozitul
    // ANUAL datorat … prin aplicarea cotei de 10%…"), not the payment provision — payment is
    // art. 68 alin. (10) → art. 122 alin. (3).
    sourceAct: 'Cod fiscal (consolidat)',
    sourceArticle: 'art. 122 alin. (3); payment art. 68 alin. (10)',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/312601',
  },
  {
    ...PROVENANCE_2026,
    ruleId: 'VAT_REGISTRATION_DEADLINE_2026',
    name: 'VAT registration deadline 2026',
    taxRegime: 'deadlines',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    parameters: [
      // Event-relative rule: the deadline is RESOLVED FROM AN EVENT, not from a date on the calendar.
      // `offset_days` = 0 is the whole point — CF art. 316 alin. (1) lit. b) requires the request
      // "cel târziu la data depășirii plafonului", so the deadline IS the exceedance date. There is no
      // grace period to add, and `isoDaysAfter(date, 0)` is the identity: resolved date === event date.
      // Consequence for the UI, asserted in src/domain/deadlines.test.ts: a resolved VAT registration
      // deadline can only ever classify as `past` or `due_today`, never `upcoming`, so `filterUpcoming`
      // never shows it in the "Termene limită" card. That is correct — once the date has passed the
      // registration obligation is overdue, and "N zile rămase" would be a lie. Do not bend the filter.
      { id: 'event_type', label: 'Deadline event type', value: 'vat_registration', unit: 'text' },
      { id: 'event', label: 'Event that starts the clock', value: 'vat_exceedance', unit: 'text' },
      { id: 'offset_days', label: 'Days from event to deadline (0 = the deadline IS the event date)', value: 0, unit: 'days' },
      { id: 'applies_to', label: 'Applies to', value: 'vat-registered-pfa', unit: 'text' },
    ],
    calculatorId: 'calc-deadline',
    // CF art. 316 alin. (1) lit. b) — the plătibil must request TVA registration "cel târziu la data
    // depășirii plafonului"; alin. (1^1) lit. b) makes the registration effective FROM that same day.
    // Both by ORDONANȚA nr. 22 din 28.08.2025 (an OG, not an OUG), pct. 18-19 Art. I, MO 806/29.08.2025,
    // in force 01-09-2025. The ceiling is art. 310 alin. (1) — 395.000 lei — owned by VAT_THRESHOLD_2026
    // above; it is deliberately NOT duplicated here (one figure, one source).
    // The old code's `month_end(exceedance_month) + 30 days` at "art. 338" never existed in any period
    // (docs/ai/research/11_pfa_first_year_and_vat_registration_deadlines_2026.md §6).
    // NOT ENCODED, on purpose: (a) the historical rule for periods up to 31-08-2025 — `month_end + 10
    // days` at a 300.000-lei ceiling — is corroborated only by secondary sources (an ANAF page and the
    // Senate expunere de motive for PL 204/2026), and this app is pinned to fiscal year 2026; it is a
    // requirement for any future historical ruleset, not a 2026 rule. (b) PL 204/2026 (a BILL proposing
    // "cel mult 3 zile lucrătoare de la data depășirii plafonului") is not law. Re-check both before the
    // 2027 ruleset.
    // NOTE for Phase 10: `calcDeadline` reads only a fixed `deadline` parameter, so it answers
    // REVIEW_REQUIRED for this event-relative rule. Nothing in src/ calls it for deadline rules —
    // computeDeadlines reads `parameters` directly — so there is no production impact, but the
    // calculator cannot express an event-relative deadline until Phase 10 extends it.
    sourceAct: 'Cod fiscal — Ordonanța nr. 22/2025, Art. I pct. 18-19 (MO 806/29.08.2025)',
    sourceArticle: 'art. 316 alin. (1) lit. b) ("cel târziu la data depășirii plafonului"); efect înregistrare art. 316 alin. (1^1) lit. b); plafon art. 310 alin. (1)',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/312601',
  },
  // TASK 2a: the expense-deductibility rule set (CF art. 68). It lives in this package so that a
  // corrected or newly verified per-category treatment is a NEW RULE RELEASE, not a code change.
  // It carries a fresh taxRegime ('expense-deductibility'), so none of the three taxRegime lookups
  // in tax.ts, nor THRESHOLD_SPECS, nor the deadline rules, can see or be shadowed by it.
  ...DEDUCTIBILITY_RULES_2026,
];
