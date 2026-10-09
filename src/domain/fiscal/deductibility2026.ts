import type { FiscalParameter, FiscalRule } from './rules';
import { DEDUCTIBILITY_REGIME } from './deductibility';

/**
 * TASK 2a — the 2026 expense-deductibility rule set.
 *
 * Legal basis: **CF art. 68** (Titlul IV, cap. II), as consolidated for 2026. Art. 68 is self-contained
 * — its own conditions (alin. (4)), its own capped items (alin. (5)), its own cap base (alin. (6)) and
 * its own express non-deductible list (alin. (7)). Source of record:
 * docs/ai/research/21_expense_deductibility_framework_2026.md.
 *
 * FABRICATION GUARD — read before adding a rule. Titlul IV (art. 61-133) contains **zero** references
 * to art. 21, and the corporate general deductibility rule is art. 25 alin. (1). Art. 68 borrows only
 * four *named* Titlul II concepts: the depreciation rules (alin. (4) lit. d) → art. 28), art. 28 alin.
 * (20) (alin. (4) lit. e)), art. 28 alin. (4) (alin. (4) lit. k)), the destination list at art. 25 alin.
 * (3) lit. b) (alin. (5) lit. c) — the list only, NOT the corporate cap), and the reference rate at
 * art. 27 alin. (7) lit. b) (alin. (5) lit. n)). Any other Titlul II limit applied to a PFA is invented.
 * In particular the corporate protocol cap (art. 25 alin. (3) lit. a), 2 % of *accounting profit*) and
 * the corporate vehicle cap (art. 25 alin. (3) lit. l)) are NOT this regime's rules: the PFA's protocol
 * cap is 2 % of the art. 68 alin. (6) base, and the PFA's vehicle cap is art. 68 alin. (7) lit. k).
 *
 * NO CITATION → NO RULE. A category the research document does not settle is left out of this set and
 * therefore classifies as `undetermined`. Art. 68 alin. (7) lit. l) („alte sume prevăzute prin
 * legislația în vigoare") is an open clause and is deliberately NOT encoded — it proves nothing about
 * any particular category.
 *
 * `calculatorId` is a label only: no calculator is registered for this regime, because these rules are
 * read by `classifyExpenseDeductibility` (which is pure and per-expense), not by `calculatorRegistry`.
 * Registering a calculator would require a `tax.ts` dispatch site, and `tax.ts` is TASK 2b's boundary.
 */

const CF_CONSOLIDATED_2026 = 'https://legislatie.just.ro/Public/DetaliiDocument/312601';
const NORME_HG_1_2016 = 'https://legislatie.just.ro/Public/DetaliiDocument/307847';

const CF_ACT = 'Cod fiscal — Legea nr. 227/2015 (MO 688/10.09.2015)';
const NORME_ACT = 'Normele metodologice HG nr. 1/2016 (MO 22/13.01.2016)';

const PROVENANCE_DEDUCTIBILITY_2026 = {
  jurisdiction: 'RO',
  entityType: 'PFA',
  taxYear: 2026,
  // Every rule below was verified against the consolidated forms on the date research 21 was produced;
  // see docs/ai/research/21_expense_deductibility_framework_2026.md ("Versions used").
  verifiedAt: '2026-10-09',
  status: 'ACTIVE' as const,
  version: 1,
  taxRegime: DEDUCTIBILITY_REGIME,
  effectiveTo: null,
  calculatorId: 'calc-expense-deductibility',
};

type DeductibilityRuleSpec = {
  ruleId: string;
  name: string;
  /** The category token, or '*' for a rule that gates every category. */
  category: string;
  treatment: 'deductible' | 'non_deductible' | 'capped' | 'undetermined' | 'no_expense_engine';
  condition?: string;
  capPercent?: number;
  capEur?: number;
  capBase?: string;
  capBaseArticle?: string;
  missingFact?: string;
  /**
   * TASK 2c — a conflict the primary sources do NOT resolve, carried on the rule so the app can state
   * it instead of silently picking a side. research 22, „What must stay unresolved". Distinct from
   * `missingFact`: a missing fact is a datum the app does not hold; a conflict is two operative rules
   * that point to different answers.
   */
  conflict?: string;
  /**
   * TASK 2c — for an annual cap, the earliest PAYMENT date whose amounts count against the cap in this
   * tax year, when that is NOT the same question as `effectiveFrom`. An art. 68 alin. (5) cap is
   * measured per year of payment (art. 68 alin. (4) lit. b) + art. 65 alin. (1)), so a rule can be in
   * force for the year while the cap still counts payments made earlier in that year — OUG 8/2026
   * art. 10 alin. (9) does exactly that for pensii facultative. `effectiveFrom` cannot express it:
   * setting it earlier would make the letter selectable before it exists, setting it later would drop
   * payments the cap is obliged to count.
   */
  capCountsPaymentsFrom?: string;
  note?: string;
  effectiveFrom?: string;
  sourceAct: string;
  sourceArticle: string;
  sourceUrl: string;
};

function rule(spec: DeductibilityRuleSpec): FiscalRule {
  const parameters: FiscalParameter[] = [
    { id: 'category', label: 'Expense category token', value: spec.category, unit: 'text' },
    { id: 'treatment', label: 'Deductibility treatment', value: spec.treatment, unit: 'text' },
  ];
  if (spec.condition !== undefined) {
    parameters.push({ id: 'condition', label: 'Context condition', value: spec.condition, unit: 'text' });
  }
  // A percentage cap is unscaled (2 === 2 %) and is NEVER money; a euro cap stays in EUR and is never
  // converted here — the law states it in euro, and `paramBani` refuses any unit but 'lei' by design.
  if (spec.capPercent !== undefined) {
    parameters.push({ id: 'cap_percent', label: 'Cap as a percentage of the cap base', value: spec.capPercent, unit: 'percent' });
  }
  if (spec.capEur !== undefined) {
    parameters.push({ id: 'cap_eur', label: 'Annual cap in euro per person', value: spec.capEur, unit: 'eur' });
  }
  if (spec.capBase !== undefined) {
    parameters.push({ id: 'cap_base', label: 'Which base the cap is measured against', value: spec.capBase, unit: 'text' });
  }
  if (spec.capBaseArticle !== undefined) {
    parameters.push({ id: 'cap_base_article', label: 'Article stating the cap base', value: spec.capBaseArticle, unit: 'text' });
  }
  if (spec.missingFact !== undefined) {
    parameters.push({ id: 'missing_fact', label: 'The fact the law does not supply', value: spec.missingFact, unit: 'text' });
  }
  if (spec.conflict !== undefined) {
    parameters.push({ id: 'conflict', label: 'Conflict the primary sources do not resolve', value: spec.conflict, unit: 'text' });
  }
  if (spec.capCountsPaymentsFrom !== undefined) {
    parameters.push({ id: 'cap_counts_payments_from', label: 'Earliest payment counted against the annual cap', value: spec.capCountsPaymentsFrom, unit: 'text' });
  }
  if (spec.note !== undefined) {
    parameters.push({ id: 'note', label: 'Legal condition or caveat', value: spec.note, unit: 'text' });
  }

  return {
    ...PROVENANCE_DEDUCTIBILITY_2026,
    ruleId: spec.ruleId,
    name: spec.name,
    effectiveFrom: spec.effectiveFrom ?? '2026-01-01',
    parameters,
    sourceAct: spec.sourceAct,
    sourceArticle: spec.sourceArticle,
    sourceUrl: spec.sourceUrl,
  };
}

const CF = (article: string): Pick<DeductibilityRuleSpec, 'sourceAct' | 'sourceArticle' | 'sourceUrl'> => ({
  sourceAct: CF_ACT,
  sourceArticle: article,
  sourceUrl: CF_CONSOLIDATED_2026,
});

const NORME = (article: string): Pick<DeductibilityRuleSpec, 'sourceAct' | 'sourceArticle' | 'sourceUrl'> => ({
  sourceAct: NORME_ACT,
  sourceArticle: article,
  sourceUrl: NORME_HG_1_2016,
});

// ── TASK 2c: the conflicts research 22 could not close, carried on the rules that hit them ──────
//
// These strings are not commentary bolted onto a call site. Every one of them is a rule PARAMETER, so
// the estimate that uses the rule can say which of its own numbers rests on an unresolved reading.
// The rule for each is settled; what is missing is either a datum the app does not hold, or a primary
// text that reconciles two operative rules. research 22 §1, §2, §3, §5, §6.

/**
 * research 22 §1. Art. 68 fixes NO rate and NO date for its euro caps — none of lit. g), g^1), g^2),
 * h), p), r), s) contains a conversion clause. HG 1/2016 Norme, Titlul IV, Cap. II, Secțiunea a 2-a,
 * pct. 7 alin. (6) does convert them, at the BNR annual average for the payment year. CF art. 9 alin.
 * (3) lit. b) + alin. (4) convert at the BNR rate on the payment date, excepting only „cazurile
 * prevăzute expres în prezentul cod" — and the norms are not „prezentul cod".
 *
 * TASK 10b changed what the app DOES with that conflict, not the conflict itself. It now applies pct. 7
 * alin. (6) — the basis ANAF itself cites when it tells taxpayers which rate it uses — and shows the
 * art. 9 ceiling beside it. What has not changed is that no rate is fixed in code and no average is ever
 * computed: the rate comes from the store, and with no rate in the store the ceiling stays unresolved.
 * Applying one reading is not a finding that the other is wrong, and this sentence is what stops the
 * applied figure from being read as settled law.
 */
const EUR_CONVERSION_CONFLICT =
  'CONFLICT NEREZOLVAT (research 22 §1): HG 1/2016, Norme, Titlul IV, Cap. II, Secțiunea a 2-a, pct. 7 '
  + 'alin. (6) convertește plafonul în lei „la cursul mediu comunicat de Banca Națională a României '
  + 'pentru anul în care s-a efectuat plata", iar art. 9 alin. (3) lit. b) și alin. (4) CF folosesc '
  + 'cursul BNR „valabil pentru datele respective" al plății, cu excepția doar a cazurilor „prevăzute '
  + 'expres în prezentul cod" — normele nu sunt „prezentul cod". Niciun text primar citit nu împacă cele '
  + 'două reguli. Aplicația aplică pct. 7 alin. (6) și afișează alături plafonul celeilalte citiri, '
  + 'pentru că legea nu stabilește care dintre ele se aplică; cursul vine din registrul de cursuri, '
  + 'niciodată calculat de aplicație, iar fără curs înregistrat plafonul rămâne nemăsurat — un curs '
  + 'fixat în cod ar fi o regulă inventată.';

/**
 * research 22 §2. „pentru fiecare persoană" is not settled to mean per taxpayer or per insured/covered
 * person, and art. 68 alin. (7) lit. a) pulls the other way for family use. The app applies ONE cap per
 * taxpayer — the smaller allowance — and records that as an interpretation, not as a rule.
 */
const PER_PERSON_MULTIPLIER_CONFLICT =
  'INTERPRETARE (research 22 §2): „pentru fiecare persoană" nu este lămurit dacă înseamnă un plafon '
  + 'pentru contribuabil sau câte unul pentru fiecare persoană asigurată/acoperită; art. 68 alin. (7) '
  + 'lit. a) trage în sens contrar pentru uzul familial. Aplicația aplică UN SINGUR plafon pe '
  + 'contribuabil — interpretarea care dă deducerea cea mai mică — și o declară interpretare, nu regulă.';

/**
 * research 22 §6. alin. (6) says „cheltuielile deductibile" and never says whether that is the amount
 * as recorded or the amount after the other alin. (5) ceilings. Negative finding: zero occurrences of
 * „protocol", „ordinea" or „în ordine" in the whole norms chapter for Titlul IV Cap. II, so no order of
 * application is prescribed. TASK 2d: the user's decision of 2026-10-09 makes the PRE-cap reading the
 * operative one (it subtracts more, so the allowance is smaller, so it can never understate the tax due),
 * and the post-cap ceiling is surfaced to the user as the alternative — the flip must never be silent.
 */
const ALIN6_BASE_ORDER_CONFLICT =
  'CONFLICT NEREZOLVAT (research 22 §6): art. 68 alin. (6) spune „venitul brut și cheltuielile '
  + 'deductibile" fără să precizeze dacă scăderea se face cu cheltuielile înregistrate sau cu cele '
  + 'rămase după plafoanele alin. (5). Negative finding: zero occurențe ale „protocol", „ordinea" și '
  + '„în ordine" în tot capitolul normelor pentru Titlul IV Cap. II — nicio normă nu prescrie o ordine. '
  + 'Aplicația citește pre-plafon (deduce cheltuielile înregistrate, nu sumele rămase după plafon) — ' 
  + 'interpretarea cea mai puțin generoasă, care nu poate produce subimpozitare — și afișează și plafonul '
  + 'celeilalte interpretări, post-plafon, pentru că legea nu stabilește care dintre ele se aplică.';

/**
 * research 22 §3. alin. (4) lit. i) lists contribuții profesionale obligatorii among the generally
 * deductible (no ceiling); alin. (5) lit. q) caps the same category at 5 % of the gross. No norm in
 * HG 1/2016 resolves the overlap — the norms' illustrative deductible list does not mention the
 * category at all. The app applies the cap: the reading that deducts less.
 */
const PROFESSIONAL_CONTRIBUTION_CONFLICT =
  'CONFLICT NEREZOLVAT (research 22 §3): art. 68 alin. (4) lit. i) enumeră „contribuții profesionale '
  + 'obligatorii plătite" printre condițiile de deductibilitate generală, fără plafon, iar alin. (5) '
  + 'lit. q) plafonează exact aceeași categorie la 5 % din venitul brut. Nicio normă HG 1/2016 nu '
  + 'rezolvă suprapunerea — lista ilustrativă a normelor (pct. 7 alin. (5)) nu menționează deloc '
  + 'categoria. Aplicația aplică plafonul, adică interpretarea care deduce mai puțin.';

/**
 * research 22 §5. alin. (5) lit. j) limits running/maintenance/repair costs to „cel mult un singur
 * autoturism aferent fiecărei persoane", but the norms for Titlul IV Cap. II never use the word
 * „autoturism" at all (zero occurrences in the 42.814-character chapter). Registrul-inventar
 * (pct. 7 alin. (8)) identifies vehicles generally and does not select one. Nothing says whether the
 * cap attaches to a designated car, the first, the most expensive, or a free election — so the app
 * must not pick one.
 */
const ONE_CAR_SELECTION_CONFLICT =
  'NESTABILIT (research 22 §5): art. 68 alin. (5) lit. j) limitează cheltuielile de funcționare, '
  + 'întreținere și reparații la „cel mult un singur autoturism aferent fiecărei persoane", dar normele '
  + 'pentru Titlul IV Cap. II nu folosesc deloc cuvântul „autoturism" (zero occurențe) și nu spun nici '
  + 'unui autoturism i se aplică plafonul când contribuabilul are două sau mai multe. Registrul-inventar '
  + '(pct. 7 alin. (8)) identifică bunurile, dar nu alege unul. Aplicația nu alege niciun autoturism: '
  + 'limitează doar 50 % pe înregistrare (alin. (7) lit. k)), care nu cere nicio selecție.';

export const DEDUCTIBILITY_RULES_2026: FiscalRule[] = [
  // ── Expressly non-deductible — CF art. 68 alin. (7) „Nu sunt cheltuieli deductibile:" ──────────
  rule({
    ruleId: 'EXPENSE_PERSONAL_USE_2026',
    name: 'Sume sau bunuri utilizate pentru uz personal sau al familiei',
    category: 'personal_or_family_use',
    treatment: 'non_deductible',
    note: 'art. 68 alin. (7) lit. a): „sumele sau bunurile utilizate de contribuabil pentru uzul personal sau al familiei sale".',
    ...CF('art. 68 alin. (7) lit. a)'),
  }),
  rule({
    ruleId: 'EXPENSE_NON_TAXABLE_INCOME_2026',
    name: 'Cheltuieli corespunzătoare veniturilor neimpozabile',
    category: 'non_taxable_income_expense',
    treatment: 'non_deductible',
    note: 'art. 68 alin. (7) lit. b) — the expenses matching non-taxable income, wherever the source lies.',
    ...CF('art. 68 alin. (7) lit. b)'),
  }),
  rule({
    ruleId: 'EXPENSE_OWN_INCOME_TAX_2026',
    name: 'Impozitul pe venit datorat de contribuabil',
    category: 'own_income_tax',
    treatment: 'non_deductible',
    note: 'art. 68 alin. (7) lit. c): „impozitul pe venit datorat potrivit prezentului titlu, inclusiv impozitul pe venitul realizat în străinătate".',
    ...CF('art. 68 alin. (7) lit. c)'),
  }),
  rule({
    ruleId: 'EXPENSE_PERSONAL_INSURANCE_2026',
    name: 'Prime de asigurare și servicii medicale sub formă de abonament (relația personală)',
    category: 'personal_insurance_premium',
    treatment: 'non_deductible',
    note: 'art. 68 alin. (7) lit. d) excludes insurance premiums and medical services supplied as a subscription, EXCEPT those at alin. (4) lit. f) and alin. (5) lit. h) (voluntary health insurance, capped at 400 EUR — see EXPENSE_VOLUNTARY_HEALTH_INSURANCE_2026) and those for persons earning salary income.',
    ...CF('art. 68 alin. (7) lit. d)'),
  }),
  rule({
    ruleId: 'EXPENSE_DONATION_2026',
    name: 'Donații de orice fel',
    category: 'donation',
    treatment: 'non_deductible',
    note: 'art. 68 alin. (7) lit. e): „donații de orice fel". The PFA list is STRICTER than the corporate one — no corporate-style donation deduction exists for this regime.',
    ...CF('art. 68 alin. (7) lit. e)'),
  }),
  rule({
    ruleId: 'EXPENSE_FINE_OR_PENALTY_2026',
    name: 'Amenzi, penalități, dobânzi și majorări de întârziere, bunuri confiscate',
    category: 'fine_or_penalty',
    treatment: 'non_deductible',
    note: 'art. 68 alin. (7) lit. f). CARVE-OUT that must not be auto-flagged: amounts paid „conform clauzelor din contractele comerciale încheiate cu aceste autorități" remain deductible — a contractual penalty under a commercial contract is a different fact.',
    ...CF('art. 68 alin. (7) lit. f)'),
  }),
  rule({
    ruleId: 'EXPENSE_LOAN_PRINCIPAL_2026',
    name: 'Ratele aferente creditelor angajate',
    category: 'loan_principal_repayment',
    treatment: 'non_deductible',
    note: 'art. 68 alin. (7) lit. g). Bank INTEREST is a different matter — see EXPENSE_BANK_INTEREST_2026.',
    ...CF('art. 68 alin. (7) lit. g)'),
  }),
  rule({
    ruleId: 'EXPENSE_DEPRECIABLE_ASSET_PURCHASE_2026',
    name: 'Achiziția sau fabricarea bunurilor și drepturilor amortizabile din Registrul-inventar',
    category: 'depreciable_asset_purchase',
    treatment: 'non_deductible',
    note: 'art. 68 alin. (7) lit. h): a capital purchase is NEVER a direct expense; it enters only through depreciation (EXPENSE_DEPRECIATION_BUSINESS_ASSET_2026). Defect B-31: the app holds no asset register, so it cannot yet compute the depreciation side.',
    ...CF('art. 68 alin. (7) lit. h); amortizare art. 28 titlul II, împrumutată de art. 68 alin. (4) lit. d)'),
  }),
  rule({
    ruleId: 'EXPENSE_INVENTORY_SHORTAGE_2026',
    name: 'Bunuri constatate lipsă din gestiune sau degradate și neimputabile',
    category: 'inventory_shortage_uncovered',
    treatment: 'non_deductible',
    note: 'art. 68 alin. (7) lit. i) — only where the inventory is NOT covered by an insurance policy.',
    ...CF('art. 68 alin. (7) lit. i)'),
  }),
  rule({
    ruleId: 'EXPENSE_TAX_FOR_BENEFICIARY_2026',
    name: 'Impozitul pe venit suportat de plătitor în contul beneficiarilor',
    category: 'tax_borne_for_beneficiary',
    treatment: 'non_deductible',
    ...CF('art. 68 alin. (7) lit. j)'),
  }),
  rule({
    ruleId: 'EXPENSE_DEPRECIATION_PERSONAL_PATRIMONY_2026',
    name: 'Amortizarea bunurilor din patrimoniul personal afectate activității',
    category: 'depreciation_personal_patrimony',
    treatment: 'non_deductible',
    note: 'art. 68 alin. (7) lit. k^1), added by Legea nr. 296/2020 (MO 1269/21.12.2020), effective 01.01.2021.',
    ...CF('art. 68 alin. (7) lit. k^1)'),
  }),
  rule({
    ruleId: 'EXPENSE_SPONSORSHIP_2026',
    name: 'Cheltuieli de sponsorizare și/sau mecenat',
    category: 'sponsorship_or_mecenat',
    treatment: 'non_deductible',
    note: 'art. 68 alin. (7) lit. k^3), added by OUG nr. 115/2023 (MO 1139/15.12.2023), applicable „începând cu cheltuielile aferente anului 2024" (art. LVII alin. (4)).',
    ...CF('art. 68 alin. (7) lit. k^3)'),
  }),
  rule({
    ruleId: 'EXPENSE_CORRUPTION_2026',
    name: 'Cheltuieli dovedite a fi legate de fapte de corupție',
    category: 'corruption_related',
    treatment: 'non_deductible',
    note: 'art. 68 alin. (7) lit. k^4) — expenses recorded in the accounting evidence, of whatever nature, later proven corruption-related.',
    ...CF('art. 68 alin. (7) lit. k^4)'),
  }),

  // ── Not an art. 68 expense at all ──────────────────────────────────────────────────────────────
  rule({
    ruleId: 'EXPENSE_OWNER_SOCIAL_CONTRIBUTIONS_2026',
    name: 'CAS și CASS datorate de contribuabil în calitate de persoană fizică',
    category: 'owner_social_contributions',
    treatment: 'non_deductible',
    note: 'No litera of art. 68 alin. (7) lists them, and alin. (5) lit. k) admits only contributions owed „în calitate de angajatori". They are deducted later, at the venitul net anual impozabil stage — art. 118 alin. (2) lit. b), capped by alin. (2^4), with the art. 174 alin. (6) CASS difference expressly excluded. Deducting them again as an art. 68 expense would double-count them; tax.ts already handles the art. 118 stage.',
    ...CF('art. 68 alin. (5) lit. k) (numai contribuții datorate în calitate de angajator); deducere ulterioară art. 118 alin. (2) lit. b) și alin. (2^4)'),
  }),

  // ── The documentation condition — CF art. 68 alin. (4) lit. a) ─────────────────────────────────
  rule({
    ruleId: 'EXPENSE_DOCUMENTATION_ABSENT_2026',
    name: 'Cheltuială nejustificată prin documente',
    category: '*',
    treatment: 'non_deductible',
    condition: 'document_absent',
    note: 'art. 68 alin. (4) lit. a): „să fie efectuate în cadrul activităților independente, justificate prin documente". This is a cumulative CONDITION, not a litera of alin. (7); Normele pct. 7 alin. (4) admit to deduction only expenses „astfel cum rezultă din evidențele contabile conduse de contribuabili".',
    ...CF('art. 68 alin. (4) lit. a); Normele HG 1/2016 pct. 7 alin. (4)'),
  }),

  // ── Deductible ordinary business expenses ──────────────────────────────────────────────────────
  rule({
    ruleId: 'EXPENSE_EMPLOYER_CONTRIBUTIONS_2026',
    name: 'Contribuții sociale obligatorii datorate în calitate de angajator',
    category: 'employer_social_contributions',
    treatment: 'deductible',
    note: 'art. 68 alin. (5) lit. k) — employer-side contributions under Titlul V are deductible; this is the counterpart to EXPENSE_OWNER_SOCIAL_CONTRIBUTIONS_2026.',
    ...CF('art. 68 alin. (5) lit. k)'),
  }),
  rule({
    ruleId: 'EXPENSE_RENT_BUSINESS_SPACE_2026',
    name: 'Chiria spațiului și a utilajelor utilizate în activitate',
    category: 'rent_business_space',
    treatment: 'deductible',
    note: 'Normele pct. 7 alin. (5) lit. d) — „în baza unui contract de închiriere". UNVERIFIED and deliberately not decided: rent paid by the PFA to the same individual\'s own patrimony has no express rule in the sources read.',
    ...NORME('Normele HG 1/2016 pct. 7 alin. (5) lit. d)'),
  }),
  rule({
    ruleId: 'EXPENSE_BANK_INTEREST_2026',
    name: 'Dobânzi bancare',
    category: 'bank_interest',
    treatment: 'deductible',
    note: 'Normele pct. 7 alin. (5) lit. e). Interest on loans from NON-BANK persons is separately capped at the BNR reference rate by art. 68 alin. (5) lit. n), which borrows art. 27 alin. (7) lit. b) — one of the four named Titlul II borrowings.',
    ...NORME('Normele HG 1/2016 pct. 7 alin. (5) lit. e); dobânzi persoane non-bancare art. 68 alin. (5) lit. n) coroborat cu art. 27 alin. (7) lit. b) titlul II'),
  }),
  rule({
    ruleId: 'EXPENSE_POSTAL_TELECOM_2026',
    name: 'Cheltuieli poștale și taxe de telecomunicații',
    category: 'postal_and_telecom',
    treatment: 'deductible',
    note: 'Normele pct. 7 alin. (5) lit. i). NO percentage cap exists for a PFA pe sistem real — the only limits are the purpose test (art. 68 alin. (1), alin. (4) lit. j)), the documentation condition (alin. (4) lit. a)) and, where the line also serves the person privately, the apportionment rule at alin. (5) lit. i).',
    ...NORME('Normele HG 1/2016 pct. 7 alin. (5) lit. i); art. 68 alin. (4) lit. a) și j)'),
  }),
  rule({
    ruleId: 'EXPENSE_ENERGY_WATER_2026',
    name: 'Cheltuieli cu energia și apa',
    category: 'energy_and_water',
    treatment: 'deductible',
    note: 'Normele pct. 7 alin. (5) lit. j). Same absence of cap as postal/telecom; a line that also serves the household falls to the apportionment residue (EXPENSE_HOME_OFFICE_SHARED_2026).',
    ...NORME('Normele HG 1/2016 pct. 7 alin. (5) lit. j)'),
  }),
  rule({
    ruleId: 'EXPENSE_BUSINESS_SPACE_UPKEEP_2026',
    name: 'Întreținerea și funcționarea spațiilor folosite pentru afaceri',
    category: 'business_space_upkeep',
    treatment: 'deductible',
    note: 'Normele pct. 7 alin. (5), closing sentence: deductible „chiar dacă documentele sunt emise pe numele proprietarului, și nu pe numele contribuabilului".',
    ...NORME('Normele HG 1/2016 pct. 7 alin. (5), closing sentence'),
  }),
  rule({
    ruleId: 'EXPENSE_DEPRECIATION_BUSINESS_ASSET_2026',
    name: 'Amortizarea bunurilor și drepturilor amortizabile din patrimoniul afacerii',
    category: 'depreciation_business_asset',
    treatment: 'deductible',
    note: 'The only route by which a capital asset reaches the expense side: art. 68 alin. (4) lit. d) requires „regulile privind amortizarea, prevăzute în titlul II" (art. 28). OUG 8/2026 (MO 147/25.02.2026), art. 6 pct. 7 raised the art. 28 alin. (2) lit. b) fiscal threshold from 2.500 to 5.000 lei and added the art. 28 alin. (8^1) super-accelerated option for assets put in function in 2026; because alin. (4) lit. d) borrows those rules, the change reaches a PFA. The threshold VALUE is not encoded here — no rule in this set reads it, and an unread money parameter would create a second source of truth for the asset model that B-31 still needs.',
    ...CF('art. 68 alin. (4) lit. d) coroborat cu art. 28 titlul II; art. 28 alin. (2) lit. b) și alin. (8^1) modificate prin OUG nr. 8/2026 (MO 147/25.02.2026), art. 6 pct. 7'),
  }),

  // ── Vehicles: the law decides the consequence, the user holds the fact ─────────────────────────
  rule({
    ruleId: 'EXPENSE_VEHICLE_EXCLUSIVE_USE_2026',
    name: 'Vehicul utilizat exclusiv în activitate (sau încadrat în cele cinci excepții)',
    category: 'vehicle_related',
    treatment: 'deductible',
    condition: 'vehicle_use_exclusive',
    note: 'art. 68 alin. (7) lit. k) makes vehicle expenses integral deductibile when the vehicle is used exclusively for the activity, or falls in one of the five listed categories (urgență/pază/curierat; agenți de vânzări și achiziții; transport de persoane cu plată inclusiv taximetrie; servicii cu plată inclusiv închiriere sau instruire în școlile de șoferi; mărfuri în scop comercial). Justification requires supporting documents PLUS a foaie de parcurs holding at least vehicle category, purpose and place of the trip, kilometres driven and the operator\'s own fuel norm per km (Normele pct. 7 alin. (7)). The burden of proof is on the taxpayer (Normele pct. 68 alin. (2)).',
    ...CF('art. 68 alin. (7) lit. k) pct. 1-5; Normele HG 1/2016 pct. 7 alin. (7) și pct. 68 alin. (2)'),
  }),
  rule({
    ruleId: 'EXPENSE_VEHICLE_MIXED_USE_2026',
    name: 'Vehicul neutilizat exclusiv în activitate — deducere 50%',
    category: 'vehicle_related',
    treatment: 'capped',
    condition: 'vehicle_use_not_exclusive',
    capPercent: 50,
    capBase: 'expense_itself',
    capBaseArticle: 'art. 68 alin. (7) lit. k)',
    note: 'art. 68 alin. (7) lit. k): 50 % of the expenses relating to a motorised road vehicle (MTMA <= 3.500 kg, <= 9 seats incl. driver) held in property or use is NOT deductible when the vehicle is not used exclusively for the activity. The capped set includes the directly attributable costs named by Normele pct. 7 alin. (7): local taxes, mandatory RCA, periodic technical inspections, rovinieta — and fuel, parts, lubricants and repairs via the Titlul VII definition imported at Normele pct. 68 alin. (1). DEPRECIATION IS OUTSIDE the cap. One car per person: art. 68 alin. (5) lit. j) limits deductible running/maintenance/repair costs to „cel mult un singur autoturism aferent fiecărei persoane" — a cross-record limit this per-expense classifier cannot enforce.',
    conflict: ONE_CAR_SELECTION_CONFLICT,
    ...CF('art. 68 alin. (7) lit. k); art. 68 alin. (5) lit. j); Normele HG 1/2016 pct. 7 alin. (7), pct. 68 alin. (1)'),
  }),
  rule({
    ruleId: 'EXPENSE_VEHICLE_NOT_USED_2026',
    name: 'Vehicul care nu este folosit în activitate deloc',
    category: 'vehicle_related',
    treatment: 'non_deductible',
    condition: 'vehicle_use_none',
    note: 'A vehicle not used in the activity at all is personal use under art. 68 alin. (7) lit. a) — FULLY non-deductible. The 50 % rule of lit. k) applies only to MIXED-use vehicles; it must not be reached for this fact.',
    ...CF('art. 68 alin. (7) lit. a); art. 68 alin. (7) lit. k) (aplicabil numai vehiculelor cu utilizare mixtă)'),
  }),

  // ── Statutory caps stated by art. 68 alin. (5) itself ──────────────────────────────────────────
  rule({
    ruleId: 'EXPENSE_PROTOCOL_2026',
    name: 'Cheltuieli de protocol — plafon 2% din baza art. 68 alin. (6)',
    category: 'protocol',
    treatment: 'capped',
    capPercent: 2,
    capBase: 'art68_alin6_base',
    capBaseArticle: 'art. 68 alin. (6): „Baza de calcul se determină ca diferență între venitul brut și cheltuielile deductibile, altele decât cheltuielile pentru acordarea de burse private și cheltuielile de protocol."',
    note: 'THIS IS NOT THE CORPORATE CAP. art. 25 alin. (3) lit. a) caps protocol at 2 % of ACCOUNTING PROFIT plus corporate tax and protocol — a different base, and art. 68 does not incorporate it. INTERPRETATION NOTE: neither art. 68 nor the norms define „cheltuieli de protocol" for alin. (5) lit. b); what counts as protocol rather than reclamă/publicitate or facilități pentru clienți is a genuine legal ambiguity, so the category assignment itself is a judgement call, not a settled classification.',
    conflict: ALIN6_BASE_ORDER_CONFLICT,
    ...CF('art. 68 alin. (5) lit. b) și alin. (6)'),
  }),
  rule({
    ruleId: 'EXPENSE_SOCIAL_EXPENSES_2026',
    name: 'Cheltuieli sociale — plafon 5% din cheltuielile anuale cu salariile',
    category: 'social_expenses',
    treatment: 'capped',
    capPercent: 5,
    capBase: 'annual_salary_expense',
    capBaseArticle: 'art. 68 alin. (5) lit. c): „în limita sumei obținute prin aplicarea unei cote de până la 5% asupra valorii anuale a cheltuielilor efectuate cu salariile personalului"',
    note: 'The 5 % cap is stated by art. 68 ITSELF. Art. 68 borrows from Titlul II only the LIST OF DESTINATIONS at art. 25 alin. (3) lit. b) — not the corporate cap. Requires payroll, which the app does not model; the cap is therefore recorded but not measurable today.',
    ...CF('art. 68 alin. (5) lit. c) (destinațiile: art. 25 alin. (3) lit. b) titlul II, listă împrumutată, nu plafonul)'),
  }),
  rule({
    ruleId: 'EXPENSE_PRIVATE_SCHOLARSHIP_2026',
    name: 'Burse private — plafon 5%',
    category: 'private_scholarship',
    treatment: 'capped',
    capPercent: 5,
    capBase: 'art68_alin6_base',
    capBaseArticle: 'art. 68 alin. (6)',
    note: 'art. 68 alin. (5) lit. a). alin. (6) excludes burse private and protocol from the cap base itself.',
    conflict: ALIN6_BASE_ORDER_CONFLICT,
    ...CF('art. 68 alin. (5) lit. a) și alin. (6)'),
  }),
  rule({
    ruleId: 'EXPENSE_PRIVATE_PENSION_2026',
    name: 'Contribuții la pensii facultative — plafon 400 EUR anual per persoană',
    category: 'private_pension_contribution',
    treatment: 'capped',
    capEur: 400,
    capBase: 'annual_eur_per_person',
    capBaseArticle: 'art. 68 alin. (5): „în limita echivalentului în lei a 400 euro anual pentru fiecare persoană"',
    note: 'art. 68 alin. (5) lit. g). The cap is stated in EUR and converted to lei at the law\'s own equivalent; this rule deliberately does NOT convert it, and `paramBani` refuses any unit but \'lei\' so a euro figure can never be read as money. OUG 8/2026 art. 10 alin. (9): „În anul 2026, la verificarea încadrării în limita echivalentului în lei a 400 euro anual … se iau în calcul și sumele plătite în perioada 1 ianuarie-28 februarie 2026 în cazul pensiilor facultative" — the 2026 ceiling therefore counts payments from 1 ianuarie 2026 even though the neighbouring letters bite from 1 martie 2026. That is a cap-aggregation window, not a rule-availability date, so it travels as `cap_counts_payments_from` and NOT as `effectiveFrom`.',
    conflict: EUR_CONVERSION_CONFLICT + ' ' + PER_PERSON_MULTIPLIER_CONFLICT,
    capCountsPaymentsFrom: '2026-01-01',
    ...CF('art. 68 alin. (5) lit. g)'),
  }),
  rule({
    ruleId: 'EXPENSE_OCCUPATIONAL_PENSION_2026',
    name: 'Contribuții la pensii ocupaționale — plafon 400 EUR anual per persoană',
    category: 'occupational_pension_contribution',
    treatment: 'capped',
    capEur: 400,
    capBase: 'annual_eur_per_person',
    capBaseArticle: 'art. 68 alin. (5): „în limita echivalentului în lei a 400 euro anual pentru fiecare persoană"',
    note: 'art. 68 alin. (5) lit. g^1), ADDED by OUG nr. 8/2026 (MO 147/25.02.2026), art. 6 pct. 27. Per art. 10 alin. (6) it applies începând cu veniturile aferente anului 2026, and per art. 10 alin. (10) to contributions PLĂTITE începând cu 1 martie 2026 — hence the 1 March effectiveFrom, which makes a January 2026 contribution correctly unclassifiable rather than wrongly deductible.',
    conflict: EUR_CONVERSION_CONFLICT + ' ' + PER_PERSON_MULTIPLIER_CONFLICT,
    effectiveFrom: '2026-03-01',
    sourceAct: 'Cod fiscal, art. 68 alin. (5) lit. g^1) — OUG nr. 8 din 24.02.2026 (MO 147/25.02.2026), art. 6 pct. 27, aplicabilă art. 10 alin. (6) și (10)',
    sourceArticle: 'art. 68 alin. (5) lit. g^1)',
    sourceUrl: CF_CONSOLIDATED_2026,
  }),
  rule({
    ruleId: 'EXPENSE_PEPP_2026',
    name: 'Contribuții la PEPP — plafon 400 EUR anual per persoană',
    category: 'pepp_contribution',
    treatment: 'capped',
    capEur: 400,
    capBase: 'annual_eur_per_person',
    capBaseArticle: 'art. 68 alin. (5): „în limita echivalentului în lei a 400 euro anual pentru fiecare persoană"',
    note: 'art. 68 alin. (5) lit. g^2), ADDED by OUG nr. 8/2026, art. 6 pct. 28; contributions plătite începând cu 1 martie 2026 (art. 10 alin. (10)).',
    conflict: EUR_CONVERSION_CONFLICT + ' ' + PER_PERSON_MULTIPLIER_CONFLICT,
    effectiveFrom: '2026-03-01',
    sourceAct: 'Cod fiscal, art. 68 alin. (5) lit. g^2) — OUG nr. 8 din 24.02.2026 (MO 147/25.02.2026), art. 6 pct. 28, aplicabilă art. 10 alin. (6) și (10)',
    sourceArticle: 'art. 68 alin. (5) lit. g^2)',
    sourceUrl: CF_CONSOLIDATED_2026,
  }),
  rule({
    ruleId: 'EXPENSE_VOLUNTARY_HEALTH_INSURANCE_2026',
    name: 'Prime de asigurare voluntară de sănătate — plafon 400 EUR anual per persoană',
    category: 'voluntary_health_insurance',
    treatment: 'capped',
    capEur: 400,
    capBase: 'annual_eur_per_person',
    capBaseArticle: 'art. 68 alin. (5): „în limita echivalentului în lei a 400 euro anual pentru fiecare persoană"',
    note: 'art. 68 alin. (5) lit. h). This is the express exception to the art. 68 alin. (7) lit. d) exclusion of insurance premiums — the two rules must be read together.',
    conflict: EUR_CONVERSION_CONFLICT + ' ' + PER_PERSON_MULTIPLIER_CONFLICT,
    ...CF('art. 68 alin. (5) lit. h); excepție expresă la art. 68 alin. (7) lit. d)'),
  }),
  rule({
    ruleId: 'EXPENSE_SPORTS_SUBSCRIPTION_2026',
    name: 'Abonamente sportive — plafon 100 EUR anual per persoană',
    category: 'sports_subscription',
    treatment: 'capped',
    capEur: 100,
    capBase: 'annual_eur_per_person',
    capBaseArticle: 'art. 68 alin. (5): „în limita echivalentului în lei a 100 euro anual pentru fiecare persoană"',
    conflict: EUR_CONVERSION_CONFLICT + ' ' + PER_PERSON_MULTIPLIER_CONFLICT,
    ...CF('art. 68 alin. (5) lit. r)'),
  }),
  rule({
    ruleId: 'EXPENSE_PROFESSIONAL_BODY_DUES_2026',
    name: 'Cotizații la asociațiile profesionale — plafon 4.000 EUR anual',
    category: 'professional_body_dues',
    treatment: 'capped',
    capEur: 4000,
    capBase: 'annual_eur_per_person',
    capBaseArticle: 'art. 68 alin. (5): „în limita echivalentului în lei a 4.000 euro anual"',
    // lit. p) is the one euro letter WITHOUT „pentru fiecare persoană" — research 22 §2 verified that it
    // states a single annual amount, so only the conversion conflict applies to it.
    conflict: EUR_CONVERSION_CONFLICT,
    ...CF('art. 68 alin. (5) lit. p)'),
  }),
  rule({
    ruleId: 'EXPENSE_PROFESSIONAL_CONTRIBUTION_2026',
    name: 'Contribuții profesionale obligatorii — plafon 5% din venitul brut',
    category: 'mandatory_professional_contribution',
    treatment: 'capped',
    capPercent: 5,
    capBase: 'gross_income',
    capBaseArticle: 'art. 68 alin. (5) lit. q): plafonul se calculează asupra venitului brut, nu asupra bazei de la alin. (6)',
    note: 'art. 68 alin. (4) lit. i) separately requires such amounts to be „contribuții de asigurări sociale plătite la sistemele proprii de asigurări sociale și/sau contribuții profesionale obligatorii plătite … organizațiilor profesionale din care fac parte contribuabilii".',
    conflict: PROFESSIONAL_CONTRIBUTION_CONFLICT,
    ...CF('art. 68 alin. (5) lit. q); art. 68 alin. (4) lit. i)'),
  }),
  rule({
    ruleId: 'EXPENSE_ETF_PURCHASE_2026',
    name: 'Sume plătite pentru achiziții de ETF — plafon 400 EUR anual per persoană',
    category: 'etf_purchase',
    treatment: 'capped',
    capEur: 400,
    capBase: 'annual_eur_per_person',
    capBaseArticle: 'art. 68 alin. (5) lit. s): „în limita echivalentului în lei a 400 euro anual pentru fiecare persoană, fără a include costurile aferente tranzacției"',
    note: 'art. 68 alin. (5) lit. s), ADDED by OUG nr. 8/2026, art. 6 pct. 28. Deduction requires justificative documents issued by the art. 96^1 alin. (1) entities, and transaction costs are expressly outside the deductible amount. DATE GATE: art. 10 alin. (7) applies lit. s) „începând cu veniturile aferente anului 2026 pentru sumele plătite ȘI DECONTATE începând cu data de 1 martie 2026", so the 1 March effectiveFrom encodes the payment half of that test. The „decontate" (settled/reimbursed) half is NOT representable in this app: `Expense` carries `date` and `paid` only, and no settlement concept exists anywhere in `src/`, so an ETF bought 2026-03-10 and settled 2026-02-20 would still be treated as in force. That is recorded as a missing datum, not silently ignored.',
    conflict: EUR_CONVERSION_CONFLICT + ' ' + PER_PERSON_MULTIPLIER_CONFLICT,
    effectiveFrom: '2026-03-01',
    sourceAct: 'Cod fiscal, art. 68 alin. (5) lit. s) — OUG nr. 8 din 24.02.2026 (MO 147/25.02.2026), art. 6 pct. 28, aplicabilă art. 10 alin. (6) și (7)',
    sourceArticle: 'art. 68 alin. (5) lit. s)',
    sourceUrl: CF_CONSOLIDATED_2026,
  }),

  // ── The law fixes the direction but supplies no method: the residue is a fact ──────────────────
  rule({
    ruleId: 'EXPENSE_HOME_OFFICE_SHARED_2026',
    name: 'Cheltuială comună activității și vieții personale — parte deductibilă nedeterminată',
    category: 'home_office_shared_cost',
    treatment: 'undetermined',
    missingFact: 'art. 68 alin. (5) lit. i) allows only „partea de cheltuială care este aferentă activității independente", but the law supplies NO method — no m² rule, no time-share, no default percentage — for a home office, a phone line or utilities. Any split the app computed would be a user-supplied fact, not a legal rule.',
    note: 'There is no statutory percentage cap and no statutory apportionment formula for a home used partly for the activity. On the VAT side art. 298 alin. (4^1) (50 % cap for buildings/residential spaces) is NOT yet in force — it is conditional on an EU derogation and still pending in the consolidated form valabilă la 08.08.2026 — so it must not be applied in 2026.',
    ...CF('art. 68 alin. (5) lit. i); art. 298 alin. (4^1) (neîn vigoare, condiționată de o derogare UE)'),
  }),
  rule({
    ruleId: 'EXPENSE_COMODAT_SHARE_2026',
    name: 'Cheltuieli cu imobile date în comodat — partea aferentă afacerii',
    category: 'comodat_immovable_share',
    treatment: 'undetermined',
    missingFact: 'Normele pct. 7 alin. (5) lit. r) admit the running and maintenance costs of immovable goods subject to a comodat contract „pentru partea aferentă utilizării în scopul afacerii, potrivit înțelegerii din contract". The deductible share is a term of the contract, which the app does not hold.',
    ...NORME('Normele HG 1/2016 pct. 7 alin. (5) lit. r); art. 68 alin. (5) lit. i)'),
  }),

  // ── Where the law says there is no expense engine at all (defect B-29) ─────────────────────────
  rule({
    ruleId: 'EXPENSE_ENGINE_CAZARE_2026',
    name: 'Prestarea de servicii de cazare — regim forfetar 30%, fără cheltuieli deductibile',
    category: '*',
    treatment: 'no_expense_engine',
    condition: 'activity_cazare',
    missingFact: 'art. 68 alin. (1) excepts art. 68^1, 68^3 și 69. Art. 68^3 alin. (2): „Venitul net anual din prestarea de servicii de cazare se determină prin deducerea din venitul brut a cheltuielilor determinate prin aplicarea cotei forfetare de 30% asupra venitului brut." alin. (7) removes the accounting obligation entirely: „contribuabilii completează numai partea referitoare la venituri din Registrul de evidență fiscală și nu au obligații privind evidența contabilă." There is therefore NO expense classification for this activity from FY2026 — the app must decline, not compute.',
    note: 'Introduced by Legea nr. 239 din 15.12.2025 (MO 1160/15.12.2025), art. XII, applicable începând cu veniturile aferente anului 2026 (art. XIII alin. (2) lit. b)). Which CAEN falls under „prestarea de servicii de cazare" is itself a classification fact with a hard legal consequence, and the boundary is defined only by reference to the tourism-sector definitions — not analysed in research 21.',
    ...CF('art. 68 alin. (1) (excepția art. 68^1, 68^3 și 69); art. 68^3 alin. (2) și (7); introdus prin Legea nr. 239/2025 (MO 1160/15.12.2025), art. XII, aplicabil art. XIII alin. (2) lit. b)'),
  }),
];
