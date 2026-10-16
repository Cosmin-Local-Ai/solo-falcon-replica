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
      {
        id: 'min_base',
        label: 'Tier-1 floor (12 SM annual)',
        value: lei(48600),
        unit: 'lei',
        // B-45 — the SM vintage a derived base was built from, said where the engine reads the base.
        // `digestRule` projects a parameter onto {id, value, unit} (`ruleSetDigest.ts:99-102`), so a
        // description is provenance the hash does not cover: this is not a rule-package release, and
        // `fiscal/packageDigestStability.test.ts` pins the digest at the same bytes to prove it.
        description:
          '12 SM = 12 × 4.050 lei. SM-ul care guvernează FY2026 este cel în vigoare la 1 ianuarie a anului '
          + 'de realizare a venitului, „indiferent dacă în cursul aceluiași an se utilizează mai multe valori” '
          + '(art. 135¹ alin. (3) CF), deci 48.600 lei — nu 12 × 4.325. HG 1506/2024 art. 1.',
      },
      {
        id: 'tier2_base',
        label: 'Tier-2 floor (24 SM annual) — not a ceiling',
        value: lei(97200),
        unit: 'lei',
        description:
          '24 SM = 24 × 4.050 lei = 97.200 lei, aceeași ancoră de 1 ianuarie (art. 135¹ alin. (3) CF). '
          + 'Art. 148 alin. (2) este o scară de praguri, nu un plafon: articolul nu conține niciun '
          + '„nu poate fi mai mare decât”, spre deosebire de art. 170 alin. (1).',
      },
      {
        id: 'tier1_cas',
        label: 'CAS at the 12 SM floor',
        value: lei(12150),
        unit: 'lei',
        description:
          '25 % × 48.600 = 12.150 lei — derivat din rată și bază, nu o sumă scrisă în lege. Baza este '
          + '12 SM = 12 × 4.050 lei, SM-ul de la 1 ianuarie 2026 (art. 135¹ alin. (3) CF).',
      },
      {
        id: 'tier2_cas',
        label: 'CAS at the 24 SM floor — not a ceiling',
        value: lei(24300),
        unit: 'lei',
        description:
          '25 % × 97.200 = 24.300 lei, pe o bază de 24 SM = 24 × 4.050 lei (art. 135¹ alin. (3) CF). '
          + 'Nu este un maxim: art. 148 alin. (2) alege baza de calcul, nu o plafonează.',
      },
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
      {
        id: 'min_base',
        label: 'Top-up floor (6 SM annual) — CF art. 174 alin. (6); conditional, not an unconditional minimum',
        value: lei(24300),
        unit: 'lei',
        description:
          '6 SM = 6 × 4.050 lei = 24.300 lei, SM-ul de la 1 ianuarie 2026 (art. 135¹ alin. (3) CF). '
          + 'Art. 174 alin. (6) este o diferență de contribuție condiționată pentru veniturile din art. 155 '
          + 'alin. (1) lit. b), nu un minim necondiționat.',
      },
      {
        id: 'max_annual_base',
        label: 'Max annual base (72 SM)',
        value: lei(291600),
        unit: 'lei',
        description:
          '72 SM = 72 × 4.050 lei = 291.600 lei, aceeași ancoră de 1 ianuarie (art. 135¹ alin. (3) CF); '
          + 'ANAF publică explicit „291.600 lei (72 x 4.050 lei)” pentru 2026. Plafonul este art. 170 alin. (1).',
      },
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
  // ── B-88: art. 85 — the 1–7 room short-term regime. The same 30 % as art. 68^3, in a different title.
  //
  // This rule exists because the two 30 % rules are not one rule. CF art. 85 was WHOLLY REPLACED by
  // Legea 239/2025 art. XII pct. 10 (MO 1160/15.12.2025) — „Articolul 85 se modifică și va avea următorul
  // cuprins” — and applies from the FY2026 incomes. Its subject is a natural person who lets **1–7 camere
  // pe termen scurt situate în locuințe proprietate personală**, which art. 83 alin. (2) places under
  // *cedarea folosinței bunurilor*, not a tourism operator's register under art. 68^3. `docs/ai/research/
  // 44_art85_short_term_rooms_1_7.md` §1 is the source for the verbatim text; §3 is the source for the scope
  // correction below.
  //
  // **The scope correction, stated here because it is the thing a later reader will otherwise get wrong:**
  // the 30 % belongs to this sub-category and to art. 68^3 only. Every OTHER *cedarea folosinței* income —
  // long-term lease, sublease, movable goods — keeps **20 %** (art. 84 alin. (3), art. 84^1 alin. (3), both
  // amended by the same act to carve the short-term-rooms case out explicitly; ANAF Cluj CJR_DEC_10225/
  // 18.05.2026 says so in terms). This package deliberately carries **no rule for the 20 % case**, so the
  // 30 % below cannot be reached by ordinary rent income: there is no code path that applies a forfetar
  // ratio to it. Adding one means a new rule with art. 84 alin. (3) as its citation, not a second parameter
  // on this one.
  //
  // **What is NOT cited here, deliberately:** pre-2026 art. 85 (normă anuală de venit, 1–5 camere, with its
  // own „30 %” at old alin. (4^2) meaning a *reduction of the normă* — a false friend, not an expense ratio)
  // and art. 87 (Abrogat from 2026 incomes by L239/2025 art. XII pct. 11 — the former *cedarea folosinței*
  // tax-establishment article, so any rule anchored there is dead).
  {
    ...PROVENANCE_2026,
    ruleId: 'ACCOMMODATION_ART85_ROOMS_2026',
    name: 'Venit din închirierea pe termen scurt a 1–7 camere în locuință proprietate personală — cotă forfetară 30 %, cota 10 % (art. 85)',
    taxRegime: 'short-term-rooms-flat-ratio',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    parameters: [
      {
        id: 'expense_ratio',
        label: 'Cotă forfetară de cheltuieli (procente din venitul brut)',
        value: 30,
        unit: 'percent',
        // art. 85 alin. (2): „Venitul net anual … se determină prin deducerea din venitul brut a
        // cheltuielilor determinate prin aplicarea cotei forfetare de 30% asupra venitului brut.” Same
        // number as art. 68^3 alin. (2), different article, different title, different contribution route.
        // It is an EXPENSE ratio: the net is 70 % of gross, and 30 is not a rate applied to gross.
        description:
          'art. 85 alin. (2): cheltuieli forfetare = 30 % din venitul brut, deci venitul net = 70 % din venitul brut. Nu este o cotă de impozitare. Celelalte venituri din cedarea folosinței bunurilor rămân la 20 % — art. 84 alin. (3) și art. 84^1 alin. (3), modificate prin același act pentru a scoate explicit închirierea pe termen scurt.',
      },
      {
        id: 'tax_rate',
        label: 'Cota de impozitare aplicată venitului net (procente)',
        value: 10,
        unit: 'percent',
        // art. 85 alin. (6): „Impozitul anual datorat se calculează prin aplicarea cotei de 10% asupra
        // venitului net anual, determinat potrivit alin. (2), impozitul fiind final.” The same article is
        // anchored a second time at art. 123 alin. (2) as amended by L239/2025 art. XII pct. 16.
        // „impozitul fiind final” is what makes the effective burden 7 % of gross: CAS și CASS nu se scad
        // din această bază.
        description:
          'art. 85 alin. (6) (și art. 123 alin. (2)): 10 % asupra venitului net, „impozitul fiind final” — efectiv 7 % din venitul brut; CAS și CASS nu se scad din această bază.',
      },
      {
        id: 'gross_basis',
        label: 'Măsura venitului brut',
        value: 'cash_receipts_in_fiscal_year',
        unit: 'text',
        // The difference from ordinary rent, and the second-most-likely way to get this rule wrong.
        // art. 85 alin. (2): „Venitul brut reprezintă totalitatea sumelor în bani și/sau echivalentul în lei
        // al veniturilor în natură **încasate în cursul anului fiscal**.” Ordinary rent is the contract rent
        // „pentru fiecare an fiscal, indiferent de momentul încasării” (art. 84 alin. (1)-(2)). Using the
        // contract rule here overstates the gross; using this rule there understates it.
        description:
          'art. 85 alin. (2): venit brut = sumele **încasate în cursul anului fiscal**. Nu regula contractului de la art. 84 alin. (1)-(2) („indiferent de momentul încasării”), care guvernează închirierea obișnuită.',
      },
      {
        id: 'commission_excluded_from_gross',
        label: 'Comisionul reținut: exclus din venitul brut, nu dedus după forfetar',
        value:
          'art. 85 alin. (3): „Nu se cuprinde în venitul brut comisionul reținut de către entitățile care facilitează închirierea … inclusiv interfețele electronice, cum ar fi o piață online, o platformă, un portal sau alte mijloace similare.” Este o reducere a BRUTULUI, nu o cheltuială deductibilă după forfetar: dacă comisionul ar fi scăzut după cota de 30 %, cifra ar fi alta. Aici textul nu are tensiunea din art. 68^3 alin. (3), pentru că articolul întreg are ca subiect o locuință proprietate personală — spre deosebire de art. 68^3, unde alin. (3) stă într-un articol al cărui subiect la alin. (1) este un operator economic din turism (B-80, research/38 §3).',
        unit: 'text',
        description:
          'B-88. Spre deosebire de `gross_scope_open_question` de pe ACCOMMODATION_68X3_2026, aceasta nu este o întrebare deschisă: aceleași cuvinte, într-un articol al cărui subiect este chiar închirierea dintr-o locuință proprietate personală, nu mai au cele două lecturi. Aplicația nu adaugă și nu scade niciun comision din sume — înregistrările de venit păstrează sumele încasate (alin. (2)), iar un comision reținut de platformă nu a fost încasat, deci nu intră în brut.',
      },
      {
        id: 'fx_basis',
        label: 'Temeiul de conversie pentru veniturile în valută',
        value: 'last_banking_day_before_collection',
        unit: 'text',
        // art. 85 alin. (4): „cursul de schimb valutar comunicat de Banca Națională a României în ultima zi
        // bancară anterioară încasării”. Mechanically the same basis the Phase 10c ledger pass already
        // implements for art. 68^3 alin. (4) (`fx/ledger.ts`, `payment_date_daily`), so the pass is reused,
        // not reimplemented. Ordinary rent converts differently again — art. 84 alin. (3^1) curs mediu anual,
        // art. 84^1 alin. (2) cursul din ziua precedentă plății.
        description:
          'art. 85 alin. (4): cursul BNR din ultima zi bancară anterioară fiecărei încasări. Închirierea obișnuită are alte temeiuri — art. 84 alin. (3^1) (media anuală) și art. 84^1 alin. (2) (cursul din ziua precedentă plății).',
      },
      {
        id: 'no_proration',
        label: 'Fracțiune de an',
        value: 'fraction_of_year_is_annual_income',
        unit: 'text',
        // art. 85 alin. (5): „Veniturile … realizate într-o fracțiune de an sau în perioade diferite ce
        // reprezintă fracțiuni ale aceluiași an, se consideră venit anual.” Nothing is prorated — and the
        // CASS rungs are not cut either, which is a separate rule (art. 151 alin. (2) for CAS).
        description:
          'art. 85 alin. (5): o fracțiune de an este considerată venit anual; nimic nu este proratat.',
      },
      {
        id: 'room_count_min',
        label: 'Număr minim de camere pentru acest titlu',
        value: 1,
        unit: 'count',
        description:
          'art. 85 alin. (1): „între 1 și 7 camere inclusiv, indiferent de numărul de locuințe în care sunt situate acestea”. Numerele sunt un comutator de titlu, nu o mărime într-o formulă; comparația o face `domain/models.ts accommodationIncomeTitleForYear`, singurul loc în care se citește pragul din art. 83 alin. (4).',
      },
      {
        id: 'room_count_max',
        label: 'Număr maxim de camere pentru acest titlu',
        value: 7,
        unit: 'count',
        description:
          'art. 85 alin. (1) până la 7 camere inclusiv; art. 83 alin. (4): „Începând cu anul fiscal în care numărul camerelor … este de peste 7 camere, veniturile realizate reprezintă venituri din activități independente” — deci trecerea se face pe an fiscal, nu în luna în care apare a opta cameră.',
      },
      {
        id: 'eligibility_exclusion',
        label: 'Excluderea din alin. (1): cine NU este sub acest articol',
        value:
          'art. 85 alin. (1) exclude „pe cei care realizează venituri din activități independente pentru care sunt aplicabile prevederile art. 68^3”. Un PFA autorizat ca operator turistic (ONRC cazare, CAEN 5520) rămâne sub art. 68^3 și cu 3 camere — numărul de camere nu îl salvează. Răspunsul persoanei la `accommodationTourismEligibility` este fapta pe care o citește aplicația; aplicația nu o decide și nu o citește din codul CAEN.',
        unit: 'text',
        description:
          'B-88, boundary 2. Cercetarea (`docs/ai/research/44_art85_short_term_rooms_1_7.md` §5) nu a găsit nicio propoziție legală expresă despre un PFA care are și venituri din cedarea folosinței; răspunsul este INFERENȚĂ din text (art. 83 alin. (1^1), art. 83 alin. (4), art. 85 alin. (1)) plus practica ANAF, și așa este etichetat și în cod.',
      },
      {
        id: 'short_term_definition',
        label: 'Definiția „pe termen scurt”',
        value:
          'art. 83 alin. (3): „închirierea neîntreruptă a unei camere aceleiași persoane, pentru perioade de maximum 30 de zile, într-un an calendaristic. În situația în care închirierea se realizează pentru o fracție de zi, se consideră închiriere pentru o zi.” Nu este o noțiune vagă de „Airbnb”. Aplicația cunoaște aceeași limită de 30 de zile doar ca fanion definitoriu în fișa de ocupare, și nimic de aici nu o citește.',
        unit: 'text',
        description:
          'B-88, boundary 4. Definiția este un prag de calificare, nu o cifră care intră în calcul; aplicația nu o folosește ca să decidă dacă o încasare este sau nu pe termen scurt.',
      },
      {
        id: 'cass_route',
        label: 'Unde intră venitul net la contribuții',
        value:
          'Venitul net al art. 85 intră în cumularea de la art. 170 alin. (4) lit. c) — „venitul net pentru veniturile din cedarea folosinței bunurilor, stabilite potrivit art. 84-85” — iar baza pe care o alege acea cumulare este TREAPTA (6 / 12 / 24 SM, art. 170 alin. (3)), nu netul propriu-zis. Nu intră în scara de la art. 170 alin. (1), care mărginește venitul din art. 155 alin. (1) lit. b) la 72 SM: închirierea este lit. e), nu lit. b). CAS nu se datorează pe acest venit (art. 137 alin. (1); coroborat cu ANAF Ploiești 2026 — articolul nu a fost recuperat verbatim, deci this app îl tratează ca CORROBORATED, nu ca FACT).',
        unit: 'text',
        description:
          'B-88, consequence 3. O persoană care are și un PFA (lit. b) și are și 1–7 camere (lit. e)) are două calcule CASS PARALELE, nu o singură scară: alin. (1) cu plafon de 72 SM pe de o parte, alin. (2)-(4) cu treapta de 6 / 12 / 24 SM pe de altă parte. Că textele dau două căi este FACT; că în practică cele două se țin separate în acest motor este consecința acelei lecturi.',
      },
      {
        id: 'filing_deadline',
        label: 'Termen de depunere a declarației unice',
        value: '2027-05-25',
        unit: 'date',
        description:
          'art. 85 alin. (10) cu art. 122 alin. (3): „până la data de 25 mai inclusiv a anului următor celui de realizare a veniturilor”. Faptul că impozitul este „final” NU scutește de declarație: art. 122 alin. (6) lit. a) scutește numai venitul la care impozitul „se reține la sursă și reprezintă impozit final”, iar aici impozitul este stabilit de contribuabil (alin. (10)), nu reținut. NU art. 121.',
      },
      {
        id: 'payment_deadline',
        label: 'Termen de plată',
        value: '2027-05-25',
        unit: 'date',
        description:
          'art. 85 alin. (11) (integral la bugetul de stat) cu art. 123 alin. (7) și art. 122 alin. (3): același termen, 25 mai. NU art. 121.',
      },
      {
        id: 'form_section_open_question',
        label: 'Întrebare deschisă: secțiunea din declarația 212',
        value:
          'Modelul formularului 212 pentru veniturile anului 2026 (depus în 2027) nu este publicat încă. Termenul — 25 mai 2027, art. 85 alin. (10) cu art. 122 alin. (3) — este cert; în care secțiune a declarației se înscrie acest venit nu este. Aplicația raportează termenul și nu inventează secțiunea.',
        unit: 'text',
        description:
          'B-88, research/44 Gaps-2. Modelul în vigoare astăzi este OPANAF 2.736/23.12.2025, care nu acoperă încă venitul pe 2026. Că termenul există este FACT (alin. (10)); că secțiunea este cunoscută nu este.',
      },
    ],
    calculatorId: 'calc-short-term-rooms-flat-ratio',
    // Introduced by Legea nr. 239 din 15.12.2025 (MO 1160/15.12.2025), art. XII pct. 10, aplicabil
    // „începând cu veniturile aferente anului 2026”. The text was read from the amending act itself and
    // cross-checked against three consolidated mirrors in `docs/ai/research/44_art85_short_term_rooms_1_7.md`
    // §1 (Gaps-1 records that no single official consolidated page for art. 85 was retrievable).
    //
    // NOT ENCODED, deliberately:
    //  - alin. (7) — the Registrul de evidență fiscală obligation, income part only. The app has no REF
    //    model; ordinary *cedarea folosinței* has no REF obligation at all (art. 84 alin. (10)), so this
    //    is a real difference between the two titles and it is recorded here rather than silently dropped.
    //  - alin. (8)-(9) — fișa de ocupare a capacității de cazare (OPANAF 381/2026, MO I 250/31.03.2026,
    //    which abrogates OPANAF 398/2021). Already modelled for the >7 case as a retained form in
    //    `data/types.ts`; the same order covers this article. It is not an operand of anything here.
    //  - The 20 % forfetar of art. 84 alin. (3) / art. 84^1 alin. (3). No rule for it exists in this
    //    package, and none may be added as a parameter on this one.
    //  - Any SM multiple. The 6 / 12 / 24-SM rungs this net touches are year-scoped on CASS_2026.
    sourceAct: 'Cod fiscal — Legea nr. 239/2025, Art. XII pct. 10 (MO 1160/15.12.2025)',
    sourceArticle:
      'art. 85 alin. (1) (1–7 camere în locuințe proprietate personală, exclusiv cei aflați sub art. 68^3); art. 85 alin. (2) (cotă forfetară 30 % din venitul brut; venitul brut = sumele încasate în cursul anului fiscal); art. 85 alin. (3) (comisionul reținut nu se cuprinde în venitul brut); art. 85 alin. (4) (curs BNR din ultima zi bancară anterioară încasării); art. 85 alin. (5) (fracțiune de an considerată venit anual); art. 85 alin. (6) (cota 10 % asupra venitului net, „impozitul fiind final”); art. 85 alin. (10)-(11) cu art. 122 alin. (3) și art. 123 alin. (7) (declarație și plată până la 25 mai); art. 83 alin. (2)-(4) (titlul venitului și comutatorul pe anul fiscal); art. 83 alin. (3) (definiția închirierii pe termen scurt); art. 84 alin. (3) (20 % pentru celelalte venituri din cedarea folosinței bunurilor); art. 170 alin. (4) lit. c) și alin. (3) (venitul net alimentează cumularea, baza este treapta); art. 122 alin. (6) lit. a) (scutirea de declarație vizează doar impozitul reținut la sursă)',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/305208',
    // Verified 2026-10-12 against the amending act and three consolidated mirrors — research/44 §1.
    verifiedAt: '2026-10-12',
  },
  // ── B-105: art. 84 and art. 84^1 — ordinary *cedarea folosinței bunurilor*, the two regimes the
  // package did not carry at all.
  //
  // A long-term landlord is the most common landlord there is, and this package resolved the correct TITLE
  // for them (art. 155 alin. (1) lit. e), *cedarea folosinței bunurilor*) and then had nothing to compute
  // under. That is the same shape B-88 had one sub-category over, and the fix is the same: a rule of their
  // own, with their own citations, added BESIDE `ACCOMMODATION_ART85_ROOMS_2026` — which is untouched.
  //
  // **The first thing a reader must not get wrong is the number in the defect's own title.** The 20 % is
  // the *cota forfetară de cheltuieli* — an EXPENSE ratio. The tax is **10 % of the net**, and the rate
  // lives in a different article from the ratio: art. 84 alin. (3) sets the ratio, **art. 123 alin. (2)**
  // sets the rate. Reading 20 as a rate applied to gross would be wrong twice over.
  //
  // **The second thing, and the quieter one: these are three regimes with three different answers to „when
  // is income income”, and the totals agree only at 31 December.**
  //
  //   art. 84   — annual **accrual**: the rent stipulated by the contract „pentru fiecare an fiscal,
  //               indiferent de momentul încasării” (alin. (1)-(2)).
  //   art. 84^1 — **per payment**: net fixed „la fiecare plată, de către plătitorii de venit” (alin. (3)).
  //               alin. (1) deliberately OMITS the annual clause art. 84 alin. (1) carries — that omission
  //               is the regime, not a drafting accident, and reusing the accrual reading here is the trap.
  //   art. 85   — **cash in the year**: „încasate în cursul anului fiscal” (alin. (2)), shipped last pass.
  //
  // **And three FX rules, which must not meet:** art. 84 alin. (3^1) *curs de schimb mediu anual din anul
  // de realizare a venitului*; art. 84^1 alin. (2) *cursul comunicat de BNR din ziua precedentă plății*;
  // art. 85 alin. (4) *ultima zi bancară anterioară încasării*. One conversion path serving all three makes
  // two of them wrong. (ANAF Cluj's own 2026 material mislabels the *curs mediu anual* rule as „art. 83” —
  // the correct cite is art. 84 alin. (3^1), and operational guidance is not citation.)
  //
  // **NOT ENCODED, deliberately:** the *arendă* alineate of the same article (alin. (4)-(9)) — arenda
  // agricolă has a cash-basis gross, its own 20 % at alin. (7), its own withholding at alin. (8), and CASS
  // that CAN be withheld at source (art. 174^1 alin. (3)), which is the single biggest behavioural
  // difference from ordinary rent. It is recorded as a gap in `docs/ai/phases/52_b105_cedare_folosintei.md`,
  // not half-built from the ordinary-rent rule.
  {
    ...PROVENANCE_2026,
    ruleId: 'CEDARE_ART84_2026',
    name: 'Venit din cedarea folosinței bunurilor — cotă forfetară de cheltuieli 20 %, cota 10 % (art. 84)',
    taxRegime: 'cedare-art84-flat-ratio',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    parameters: [
      {
        id: 'expense_ratio',
        label: 'Cotă forfetară de cheltuieli (procente din venitul brut)',
        value: 20,
        unit: 'percent',
        // art. 84 alin. (3): „Venitul net anual … se stabilește prin deducerea din venitul brut a
        // cheltuielilor determinate prin aplicarea cotei de 20 % asupra venitului brut.” Modified by
        // Legea 239/2025 art. XII pct. 8 ONLY to replace the carve-out phrase, which is what carves the
        // 1–7 room short-term case out and leaves 20 % for everything else. It is an EXPENSE ratio: the
        // net is 80 % of gross. It is NOT a tax rate.
        description:
          'art. 84 alin. (3): cheltuieli forfetare = 20 % din venitul brut, deci venitul net = 80 % din venitul brut. Nu este o cotă de impozitare. Cota de impozitare este 10 % asupra VENITULUI NET și stă la art. 123 alin. (2), nu aici.',
      },
      {
        id: 'tax_rate',
        label: 'Cota de impozitare aplicată venitului net (procente)',
        value: 10,
        unit: 'percent',
        // art. 123 alin. (2) as amended by Legea 239/2025 art. XII pct. 16: 10 % over the net annual, for
        // *cedarea folosinței* income „altele decât cele pentru care este prevăzută reținerea la sursă
        // potrivit art. 84 și 84^1”. Here the taxpayer establishes the tax themselves — it is NOT final,
        // which is the difference from art. 84^1 alin. (6) and from art. 85 alin. (6).
        description:
          'art. 123 alin. (2): 10 % asupra venitului net anual. Impozitul este stabilit de contribuabil (art. 122 alin. (3)), nu reținut la sursă, și NU este „impozit final”.',
      },
      {
        id: 'gross_basis',
        label: 'Măsura venitului brut',
        value: 'contract_rent_per_fiscal_year_regardless_of_collection',
        unit: 'text',
        // The distinction most likely to be lost. art. 84 alin. (1): „…reprezintă totalitatea sumelor în
        // bani … stabilite potrivit contractului încheiat între părți, pentru fiecare an fiscal,
        // indiferent de momentul încasării acestora.” alin. (2) repeats it for rent: „pe baza chiriei
        // prevăzute în contract … indiferent de momentul încasării chiriei.” So the measure is the
        // contract rent FOR THE YEAR, not the collections in the year — which is what art. 85 alin. (2)
        // measures and what the app's ledger pass already does. Summing receipts here would apply art. 85's
        // rule to art. 84's taxpayer.
        description:
          'art. 84 alin. (1)-(2): venitul brut este chiria stabilită potrivit contractului pentru fiecare an fiscal, „indiferent de momentul încasării”. Nu este măsura de la art. 85 alin. (2) („încasate în cursul anului fiscal”) și nu este măsura per plată de la art. 84^1 alin. (3).',
      },
      {
        id: 'gross_uplift',
        label: 'Majorarea brutului: cheltuielile proprietarului plătite de cealaltă parte',
        value:
          'art. 84 alin. (1) ultima propoziție: „Venitul brut se majorează cu valoarea cheltuielilor ce cad, conform dispozițiilor legale, în sarcina proprietarului, uzufructuarului sau a altui deținător legal, dacă sunt efectuate de cealaltă parte contractantă.” Aceste sume nu sunt în registrul proprietarului — le-a plătit chiriașul — deci nicio înregistrare nu le poate furniza; sunt o faptă declarată. Se adaugă la BRUT înainte de cota forfetară, nu după: cota este procent din brut, deci ordinea schimbă netul.',
        unit: 'text',
        description:
          'B-105. Același uplift apare și la art. 84^1 alin. (1). Dacă ar fi scăzut după forfetar, cifra ar fi alta — de aceea regula îl ține pe brut.',
      },
      {
        id: 'fx_basis',
        label: 'Temeiul de conversie pentru veniturile în valută',
        value: 'annual_average_of_income_realisation_year',
        unit: 'text',
        // art. 84 alin. (3^1), introduced by Legea 296/2020 pct. 49 from 01-01-2021: „În situația în care
        // chiria reprezintă echivalentul în lei al unei valute, venitul brut anual se determină pe baza
        // chiriei lunare evaluate la cursul de schimb mediu anual al pieței valutare, comunicat de Banca
        // Națională a României, din anul de realizare a venitului.” NOT the last banking day (art. 85
        // alin. (4)) and NOT the day before payment (art. 84^1 alin. (2)).
        description:
          'art. 84 alin. (3^1): cursul de schimb MEDIU ANUAL comunicat de BNR din anul de realizare a venitului. Nu ultima zi bancară anterioară încasării (art. 85 alin. (4)) și nu cursul din ziua precedentă plății (art. 84^1 alin. (2)). BNR publică media anuală abia după închiderea anului — aplicația nu o calculează din cursurile zilnice.',
      },
      {
        id: 'no_proration',
        label: 'Fracțiune de an',
        value: 'fraction_of_year_is_annual_income',
        unit: 'text',
        description:
          'art. 118 alin. (3): veniturile din categoriile art. 61 lit. a), a^1), c) și f) realizate într-o fracțiune de an se consideră venit anual. Nimic nu este proratat — nici treptele de 6 / 12 / 24 SM de la art. 170 alin. (3).',
      },
      {
        id: 'cass_route',
        label: 'Unde intră venitul net la contribuții',
        value:
          'Venitul net al art. 84 intră în cumularea de la art. 170 alin. (4) lit. c), al cărui text FY2026 este „venitul net pentru veniturile din cedarea folosinței bunurilor, stabilite potrivit art. 84-85” — o plajă care acoperă art. 84, art. 84^1 și art. 85. Baza pe care o alege acea cumulare este TREAPTA (6 / 12 / 24 SM, art. 170 alin. (3)), nu netul. Nu intră în scara de la art. 170 alin. (1), care mărginește la 72 SM venitul din art. 155 alin. (1) lit. b): închirierea este lit. e).',
        unit: 'text',
        description:
          'B-105, consecința 4 a sarcinii. Cele două scări rămân paralele, așa cum le-a lăsat B-88: nu se combină nicăieri.',
      },
      {
        id: 'no_evidence_book',
        label: 'Nicio obligație de evidență',
        value:
          'art. 84 alin. (10): „Contribuabilii care obțin venituri din cedarea folosinței bunurilor nu au obligația completării Registrului de evidență fiscală și de conducere a evidenței contabile.” Aceasta este o diferență REALĂ față de regimul pe termen scurt de la art. 85 alin. (7), care păstrează partea de venit a Registrului de evidență fiscală. Aplicația nu generează nicio obligație de evidență pentru acest regim.',
        unit: 'text',
        description:
          'B-105, punctul 8 al acceptanței. Nu se inventează nicio obligație REF pentru că regimul pe termen scurt are una — cele două titluri au obligații diferite.',
      },
      {
        id: 'filing_deadline',
        label: 'Termen de depunere a declarației unice',
        value: '2027-05-25',
        unit: 'date',
        description:
          'art. 122 alin. (3): „…pentru fiecare an fiscal, până la data de 25 mai inclusiv a anului următor celui de realizare a veniturilor.” Aici impozitul este stabilit de contribuabil, deci declarația se datorează: art. 122 alin. (6) lit. a) scutește numai impozitul care „se reține la sursă și reprezintă impozit final”. NU art. 121.',
      },
      {
        id: 'payment_deadline',
        label: 'Termen de plată',
        value: '2027-05-25',
        unit: 'date',
        description:
          'art. 123 alin. (7): impozitul anual se achită tot până la termenul de depunere a declarației — 25 mai. NU art. 121.',
      },
      {
        id: 'form_section',
        label: 'Unde se înscrie în declarația 212',
        value:
          'OPANAF 2.736/2025 (MO 1.207 / anexa 1.207 bis, 29.12.2025), Cap. I, Secțiunea 1, Subsecțiunea 1, pct. 1.3 „cedarea folosinței bunurilor”: 1.3.1.1 chirie în valută · 1.3.1.2 în lei · 1.3.1.3 plătită exclusiv în natură · 1.3.1.4 garanție utilizată pentru plata chiriei. Se completează pe fiecare contract/sursă (art. 122 alin. (4)). Rândul 1.3 din Secțiunea a 2-a, Subsecțiunea 2.2 este unde intră în treaptă chiria reținută la sursă.',
        unit: 'text',
        description:
          'B-105. Etichetele formularului rămân în urmă față de textul FY2026 al legii; aplicația citează articolul așa cum îl numerotează FY2026, nu așa îl numerotează procedura. Modelul pentru veniturile anului 2026 (depus în 2027) nu este publicat încă — termenul este cert, secțiunea de pe noul model nu este.',
      },
    ],
    calculatorId: 'calc-cedare-art84-flat-ratio',
    // art. 84 alin. (1) and (3) were modified by Legea nr. 239 din 15.12.2025 (MO 1160/15.12.2025) art. XII
    // pct. 8, aplicabil „începând cu veniturile aferente anului 2026”. pct. 8 reads „La articolul 84,
    // alineatele (1) și (3) se modifică…” — ONLY those two, and the operative delta in both is the
    // carve-out phrase. Every other alineat is untouched by 239/2025. `docs/ai/research/
    // 46_art84_84_1_cedare_folosintei_2026.md` §1 is the source for the verbatim text and the per-alineat
    // amendment notes; §Gaps-3 records that the UNCHANGED alineate rest on unofficial mirrors that agree
    // with each other and with ANAF operational material, while the changed ones are backed by the primary
    // law. FY2026 and FY2027 are identical for these articles (research/46 §10).
    sourceAct: 'Cod fiscal — Legea nr. 239/2025, Art. XII pct. 8 (MO 1160/15.12.2025)',
    sourceArticle:
      'art. 84 alin. (1) (venitul brut pe an fiscal, „indiferent de momentul încasării”, plus majorarea cu cheltuielile proprietarului plătite de cealaltă parte); art. 84 alin. (2) (brutul chiriei pe baza contractului); art. 84 alin. (3) (cotă forfetară de cheltuieli 20 %); art. 84 alin. (3^1) (curs mediu anual din anul de realizare a venitului); art. 84 alin. (10) (fără Registrul de evidență fiscală, fără evidență contabilă); art. 123 alin. (2) (cota 10 % asupra venitului net); art. 122 alin. (3)-(4) (declarația până la 25 mai, pe fiecare contract); art. 123 alin. (7) (plata până la același termen); art. 170 alin. (4) lit. c) și alin. (3) (venitul net alimentează cumularea, baza este treapta); art. 118 alin. (3) (fracțiune de an = venit anual)',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/305208',
    // Verified 2026-10-13 against Legea 239/2025 art. XII pct. 8 (primary) and three agreeing consolidated
    // mirrors — research/46 §1.
    verifiedAt: '2026-10-13',
  },
  // ── B-105: art. 84^1 — the same 20 % and the same 10 %, in a regime whose tax never reaches the
  // landlord's hands.
  //
  // This is the regime a corporate tenant puts the landlord into, and it is the one most implementations
  // get wrong at the declaration step rather than the arithmetic step: „withheld and final” does NOT mean
  // „nothing to file”.
  {
    ...PROVENANCE_2026,
    ruleId: 'CEDARE_ART84X1_2026',
    name: 'Cedarea folosinței bunurilor plătite de persoane juridice — reținere la sursă 10 %, impozit final (art. 84^1)',
    taxRegime: 'cedare-art84x1-withheld',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    parameters: [
      {
        id: 'expense_ratio',
        label: 'Cotă forfetară de cheltuieli, stabilită la fiecare plată (procente)',
        value: 20,
        unit: 'percent',
        // art. 84^1 alin. (3): venitul net se stabilește „la fiecare plată, de către plătitorii de venit
        // … prin deducerea din venitul brut a cheltuielilor determinate prin aplicarea cotei de 20 % asupra
        // venitului brut.” Same number as art. 84 alin. (3), different unit of account: per PAYMENT, not
        // per fiscal year.
        description:
          'art. 84^1 alin. (3): 20 % din venitul brut, determinat LA FIECARE PLATĂ de plătitorul de venit. Nu este netul anual al art. 84 alin. (3), deși cota este aceeași.',
      },
      {
        id: 'tax_rate',
        label: 'Cota reținută la sursă (procente din venitul net)',
        value: 10,
        unit: 'percent',
        // art. 84^1 alin. (5)-(6): 10 % over the net, reținut la momentul plății, „reprezintă impozit
        // final”, virat de plătitor până la data de 25 inclusiv a lunii următoare celei în care a fost
        // reținut.
        description:
          'art. 84^1 alin. (5)-(6): 10 % asupra venitului net, reținut la momentul plății, impozit FINAL. Plătitorul îl virează până la 25 a lunii următoare — nu contribuabilul, și nu la 25 mai.',
      },
      {
        id: 'gross_basis',
        label: 'Măsura venitului brut',
        value: 'per_payment_established_by_payer',
        unit: 'text',
        // ⚠ art. 84^1 alin. (1) OMITS the „pentru fiecare an fiscal, indiferent de momentul încasării”
        // clause that art. 84 alin. (1) carries. That omission is deliberate — alin. (3) fixes the net
        // „la fiecare plată” — and it is the single most likely place for this build to go wrong, because
        // reusing the art. 84 accrual logic here produces the same total at 31 December and a different
        // one on every other date.
        description:
          'art. 84^1 alin. (1) și alin. (3): venitul brut se stabilește potrivit contractului, iar netul „la fiecare plată”. Alineatul (1) nu conține formula „pentru fiecare an fiscal, indiferent de momentul încasării” — aceea este doar la art. 84 alin. (1).',
      },
      {
        id: 'fx_basis',
        label: 'Temeiul de conversie pentru sumele în valută',
        value: 'daily_rate_of_day_before_payment',
        unit: 'text',
        // art. 84^1 alin. (2): „cursul de schimb comunicat de Banca Națională a României din ziua
        // precedentă celei în care se efectuează plata”. A THIRD rule, different from art. 84 alin. (3^1)
        // (annual average) and from art. 85 alin. (4) (last banking day before collection). Mechanically
        // the app asks the same daily-rate provider and names the day before the payment as the anchor —
        // it does not average, and it does not take the collection day.
        description:
          'art. 84^1 alin. (2): cursul BNR din ZIUA PRECEDENTĂ plății. Nu media anuală (art. 84 alin. (3^1)), nu ultima zi bancară anterioară încasării (art. 85 alin. (4)).',
      },
      {
        id: 'payer_duties',
        label: 'Obligațiile plătitorului de venit',
        value:
          'art. 84^1 alin. (4): plătitorii de venit (persoane juridice sau alte entități cu obligația de a conduce evidență contabilă) calculează, rețin, declară și virează impozitul, și au obligația ca, la cerere, să emită un document prin care se atestă impozitul reținut și virat. Dreptul la acest certificat este al proprietarului și merită afișat: este singura dovadă pe care o are pentru o sume reținută din venitul lui.',
        unit: 'text',
        description:
          'B-105. Aplicația înregistrează fapta (impozitul a fost reținut), nu o calculează ca datorie a proprietarului.',
      },
      {
        id: 'withholding_exception',
        label: 'Excepția de la alin. (3)-(6): art. 84^1 alin. (8)',
        value:
          'art. 84^1 alin. (8) (introdus de OUG 138/2024 art. VI pct. 5): când venitul brut se plătește EXCLUSIV ÎN NATURĂ, sau când o garanție stabilită prin contract este utilizată pentru plata chiriei, reținerea la sursă nu se aplică. În cazul acesta proprietarul determină singur venitul net (brut minus 20 %), calculează impozitul și îl achită prin depunerea Declarației Unice până la termenul din art. 122 alin. (3). Nu este un caz marginal: mută întreaga obligație înapoi la proprietar.',
        unit: 'text',
        description:
          'B-105, acceptanța 6. Ambele condiții sunt fapte declarate (`rentPaidExclusivelyInKind`, `guaranteeAppliedToRent`); absența răspunsului nu este „nu”.',
      },
      {
        id: 'declaration_duty',
        label: 'Ce datorează proprietarul ca declarație',
        value:
          'Două texte, amândouă necesare. art. 122 alin. (6) lit. a): nu se depune declarația pentru venitul la care impozitul „se reține la sursă și reprezintă impozit final” — deci NU se generează nicio obligație de Declarație Unică pentru impozitul pe venit. art. 122 alin. (7): cei care au impozitul reținut dar datorează CAS și/sau CASS depun tot declarația unică pentru a stabili, declara și achita contribuțiile. Pe chiria obișnuită CASS NU se reține la sursă — art. 174^1 alin. (3) acoperă numai drepturile de proprietate intelectuală, arenda și asocierile — deci un proprietar cu impozit reținut datorează în continuare o Declarație Unică pentru contribuții. „Reținut și final” nu înseamnă „nu ai nimic de depus”.',
        unit: 'text',
        description:
          'B-105, acceptanțele 2 și 3. Aplicația diferențiază cele două: pentru acest regim termenul de 25 mai rămâne, dar declarația este „numai contribuțiile”, nu impozitul pe venit.',
      },
      {
        id: 'payer_remittance_deadline',
        label: 'Termenul de virare de către plătitor',
        value: '2026-02-25',
        unit: 'date',
        // art. 84^1 alin. (6): „până la data de 25 inclusiv a lunii următoare celei în care a fost reținut”.
        // The value is an EXAMPLE of the monthly rule (a January 2026 payment), not a fixed annual date —
        // the rule is monthly and event-relative, and this app does not model a monthly obligation of a
        // third party. It is carried as text-plus-example so the distinction is on the record.
        description:
          'art. 84^1 alin. (6): până la 25 inclusiv a lunii următoare celei în care impozitul a fost reținut. Este o obligație a PLĂTITORULUI, nu al proprietarului, și este lunară — aplicația nu emite acest termen ca termen al utilizatorului.',
      },
      {
        id: 'no_evidence_book',
        label: 'Nicio obligație de evidență',
        value:
          'art. 84^1 alin. (7): contribuabilii nu au obligația completării Registrului de evidență fiscală și nici a conducerii evidenței contabile. Nicio obligație de evidență nu se generează pentru acest regim.',
        unit: 'text',
        description:
          'B-105, punctul 8 al acceptanței. art. 84 alin. (10) spune același lucru pentru varianta autodeterminată.',
      },
      {
        id: 'cass_route',
        label: 'Unde intră venitul net la contribuții',
        value:
          'Același drum ca la art. 84: art. 170 alin. (4) lit. c) cumulează „venitul net pentru veniturile din cedarea folosinței bunurilor, stabilite potrivit art. 84-85” — plaja acoperă și art. 84^1 — iar baza este treapta de 6 / 12 / 24 SM (art. 170 alin. (3)). CASS nu se reține aici (art. 174^1 alin. (3)), deci treapta se datorează și se declară de proprietar.',
        unit: 'text',
        description:
          'B-105, consecința 4. Netul reținut la sursă alimentează tot scara de la art. 170 alin. (2)-(4); faptul că impozitul pe venit a fost achitat de altcineva nu scoate venitul din cumul.',
      },
      {
        id: 'payer_declaration_open_question',
        label: 'Întrebare deschisă: declarația pe care o depune PLĂTITORUL',
        value:
          'art. 132 alin. (2) trimite la declarația 112 și scoate explicit arenda, dar NU numește veniturile de la art. 84^1; OPANAF 102/2025 le pune în declarația 205 (anuală, sfârșitul lui februarie), materialele ANAF pe 2026 spun 112 până la 25, iar materialele mai vechi spun 100 și 205. Niciun text primar nu hotărăște. Este obligația CHIRIAȘULUI, nu a proprietarului, și nu blochează nimic în acest regim — aplicația nu o ghicește.',
        unit: 'text',
        description:
          'B-105, `docs/ai/research/46_art84_84_1_cedare_folosintei_2026.md` §Gaps-1. Rămâne nehotărât în mod explicit; aplicația nu emite niciun termen pentru ea.',
      },
    ],
    calculatorId: 'calc-cedare-art84x1-withheld',
    // Introduced by OUG nr. 115/2023 art. LIII pct. 64, for 2024 incomes; its title and alin. (1) and (3)
    // were modified by Legea nr. 239/2025 art. XII pct. 9 (MO 1160/15.12.2025) from FY2026 incomes, and
    // alin. (4) and alin. (8)-(9) by OUG 138/2024 art. VI pct. 4-5. research/46 §2 is the source for the
    // verbatim text with the per-alineat notes; §4 is the source for what the landlord still owes.
    //
    // NOT ENCODED, deliberately: alin. (9) — the payer's art. 132 alin. (2) declaration. It is a third
    // party's obligation and its form is unsettled (see `payer_declaration_open_question`).
    sourceAct: 'Cod fiscal — OUG 115/2023 pct. 64; modificat prin Legea 239/2025 Art. XII pct. 9 și OUG 138/2024 art. VI pct. 4-5',
    sourceArticle:
      'art. 84^1 alin. (1) (venitul brut potrivit contractului, plus majorarea cu cheltuielile proprietarului plătite de cealaltă parte; fără formula „pentru fiecare an fiscal, indiferent de momentul încasării”); art. 84^1 alin. (2) (cursul BNR din ziua precedentă plății); art. 84^1 alin. (3) (netul la fiecare plată, 20 %); art. 84^1 alin. (4) (plătitorul calculează, reține, declară, virează și emite certificat la cerere); art. 84^1 alin. (5)-(6) (10 % reținut la momentul plății, impozit final, virat până la 25 a lunii următoare); art. 84^1 alin. (7) (fără Registrul de evidență fiscală, fără evidență contabilă); art. 84^1 alin. (8) (excepția: plată exclusiv în natură sau garanție utilizată pentru plata chiriei — contribuabilul se autodetermină și depune Declarația Unică până la termenul din art. 122 alin. (3)); art. 122 alin. (6) lit. a) (fără declarație pentru impozitul reținut și final); art. 122 alin. (7) (declarație pentru contribuții); art. 174^1 alin. (3) (CASS reținută la sursă numai la DPI, arendă și asocieri); art. 170 alin. (4) lit. c) (venitul net alimentează cumularea)',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/305208',
    // Verified 2026-10-13 — research/46 §2 and §4.
    verifiedAt: '2026-10-13',
  },
  // ── B-105: a duty the app did not surface at all — registering the lease contract.
  //
  // art. 83 alin. (5) FY2026 (renumbered from the old alin. (6) by Legea 239/2025 art. XII pct. 7) puts a
  // 30-day registration duty on *cedarea folosinței* income. The Cod fiscal names NO form for it; the form
  // is an ANAF order. So the article is cited to the code and the form is cited to the order — they are
  // different acts and collapsing them would be a false citation.
  //
  // ⚠ The duty is NOT waived because the tenant is a company. The only carve-outs the alineat states are
  // **arendare** and **închirierea pe termen scurt** a camerelor în locuințe proprietate personală — which
  // is precisely why it applies to the two regimes added here and not to the one shipped last pass.
  {
    ...PROVENANCE_2026,
    ruleId: 'CEDARE_CONTRACT_REGISTRATION_DEADLINE_2026',
    name: 'Înregistrarea contractului de locațiune — 30 de zile (art. 83 alin. (5))',
    taxRegime: 'deadlines',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    parameters: [
      { id: 'event_type', label: 'Deadline event type', value: 'lease_contract_registration', unit: 'text' },
      { id: 'event', label: 'Event that starts the clock', value: 'lease_contract', unit: 'text' },
      { id: 'offset_days', label: 'Days from the contract to the term (30 = „cel mult 30 de zile”)', value: 30, unit: 'days' },
      { id: 'applies_to', label: 'Applies to', value: 'lease_contract_registration', unit: 'text' },
      // The fact family that must answer affirmatively before this rule emits anything. Read from the
      // profile by `domain/models.ts leaseRegistrationDutyForYear`, never inferred here.
      { id: 'applies_when', label: 'Fact family that must be affirmatively in force', value: 'lease_registration', unit: 'text' },
      {
        id: 'carve_outs',
        label: 'Cine NU are obligația',
        value:
          'art. 83 alin. (5) vizează veniturile din cedarea folosinței bunurilor „altele decât veniturile din arendare și cele din închirierea pe termen scurt de către proprietari a camerelor situate în locuințe proprietate personală”. Doar acestea două sunt scoase. Faptul că chiriașul este persoană juridică NU scutește de înregistrare — aceasta este exact situația regimului de la art. 84^1.',
        unit: 'text',
        description:
          'B-105, acceptanța 5. Termenul apare pentru un registru art. 84 / art. 84^1 și NU apare pentru un registru de închiriere pe termen scurt (1–7 camere).',
      },
      {
        id: 'form',
        label: 'Undu se depune, și pe ce formular',
        value:
          'formular „Cerere de înregistrare a contractelor de locațiune”, cod C168 — instituit prin OPANAF 114/2019, modificat prin OPANAF 2031/2022 și OPANAF 161/2025 (MO 109/6.02.2025). Codul fiscal NU numește niciun formular: obligația este în lege, formularul este în ordinul ANAF, și cele două se citează separat. Se depune la registratură, prin postă recomandată sau electronic (SPV), cu copie a contractului „conform cu originalul”; organul fiscal o înregistrează în termen de 5 zile. Pentru un bun deținut în cote, contractul desemnează care proprietar înregistrează.',
        unit: 'text',
        description:
          'B-105. OPANAF 161/2025 încă trimite la numerotarea veche a art. 83 și la formularea de turism pe care Codul fiscal nu o mai întrebuințează de la veniturile anului 2026 — numerotarea procedurii nu schimbă numerotarea legii, deci aplicația citează articolul așa cum îl numerotează FY2026, nu așa îl numerotează ordinul.',
      },
    ],
    calculatorId: 'calc-deadline',
    // art. 83 was wholly replaced by Legea nr. 239/2025 art. XII pct. 7 from FY2026 incomes; the
    // registration duty sits at alin. (5) in that numbering. research/46 §5 is the source, including the
    // competent-body rules from the OPANAF 161/2025 instructions.
    sourceAct: 'Cod fiscal — Legea nr. 239/2025, Art. XII pct. 7 (MO 1160/15.12.2025); formularul: OPANAF 114/2019, modificat prin OPANAF 2031/2022 și OPANAF 161/2025',
    sourceArticle:
      'art. 83 alin. (5) (înregistrarea contractului de locațiune și a modificărilor ulterioare în termen de cel mult 30 de zile la organul fiscal competent; sunt excluse arendarea și închirierea pe termen scurt a camerelor în locuințe proprietate personală)',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/305208',
    // Verified 2026-10-13 — research/46 §5.
    verifiedAt: '2026-10-13',
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
