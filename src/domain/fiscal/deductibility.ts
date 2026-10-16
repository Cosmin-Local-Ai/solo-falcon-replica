import type { FiscalRule } from './rules';
import { selectApplicableRules, type RuleQuery } from './select';
import { majorToMinor, money, type CurrencyCode, type Money } from '../money';

/**
 * TASK 2a — the expense-deductibility classifier.
 *
 * The governing article for a PFA on sistem real is **CF art. 68** (Titlul IV, cap. II), not art. 123
 * and not art. 21. Art. 68 is self-contained: its own conditions (alin. (4)), its own capped items
 * (alin. (5)), its own cap base (alin. (6)) and its own express non-deductible list (alin. (7)).
 * Titlul IV contains ZERO references to art. 21, and the corporate general rule is art. 25 alin. (1);
 * art. 68 borrows only four *named* Titlul II concepts (art. 28 depreciation, art. 28 alin. (20),
 * art. 28 alin. (4), the destination list at art. 25 alin. (3) lit. b), and the reference rate at
 * art. 27 alin. (7) lit. b)). Encoding any other corporate limit for a PFA would be a fabrication.
 *
 * Source of record: docs/ai/research/21_expense_deductibility_framework_2026.md. Every rule in
 * `deductibility2026.ts` traces to a citation in that document. A category the document does not
 * settle is `undetermined` — never silently deductible.
 */

/** The regime tag that carries deductibility rules. Deliberately NOT 'cas'/'cass'/'income-tax':
 *  `tax.ts` resolves those three by `taxRegime` equality, so a new regime cannot shadow them. */
export const DEDUCTIBILITY_REGIME = 'expense-deductibility' as const;

// ── The controlled category vocabulary ───────────────────────────────────────
// This is the token space the classifier understands. It is NOT yet a field on `Expense` — that is
// TASK 2b. Tokens are machine-readable identifiers; the Romanian user-facing labels are TASK 7's copy
// layer, not domain data.

export type ExpenseCategory =
  // Expressly non-deductible — CF art. 68 alin. (7).
  | 'personal_or_family_use'
  | 'non_taxable_income_expense'
  | 'own_income_tax'
  | 'personal_insurance_premium'
  | 'donation'
  | 'fine_or_penalty'
  | 'loan_principal_repayment'
  | 'depreciable_asset_purchase'
  | 'inventory_shortage_uncovered'
  | 'tax_borne_for_beneficiary'
  | 'depreciation_personal_patrimony'
  | 'sponsorship_or_mecenat'
  | 'corruption_related'
  // Not an art. 68 expense at all: the owner's CAS/CASS is deducted later, at the
  // venitul net anual impozabil stage (art. 118 alin. (2) lit. b)). Deducting it here would
  // double-count it.
  | 'owner_social_contributions'
  // Deductible ordinary business expenses — Normele HG 1/2016 pct. 7.
  | 'employer_social_contributions'
  | 'rent_business_space'
  | 'bank_interest'
  | 'postal_and_telecom'
  | 'energy_and_water'
  | 'business_space_upkeep'
  | 'depreciation_business_asset'
  // Context-dependent.
  | 'vehicle_related'
  // Capped by a statutory percentage or euro amount — CF art. 68 alin. (5).
  | 'protocol'
  | 'social_expenses'
  | 'private_scholarship'
  | 'private_pension_contribution'
  | 'occupational_pension_contribution'
  | 'pepp_contribution'
  | 'voluntary_health_insurance'
  | 'sports_subscription'
  | 'professional_body_dues'
  | 'mandatory_professional_contribution'
  | 'etf_purchase'
  // The law fixes the treatment but supplies no method — the residue is a fact about the expense.
  | 'home_office_shared_cost'
  | 'comodat_immovable_share';

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  'personal_or_family_use',
  'non_taxable_income_expense',
  'own_income_tax',
  'personal_insurance_premium',
  'donation',
  'fine_or_penalty',
  'loan_principal_repayment',
  'depreciable_asset_purchase',
  'inventory_shortage_uncovered',
  'tax_borne_for_beneficiary',
  'depreciation_personal_patrimony',
  'sponsorship_or_mecenat',
  'corruption_related',
  'owner_social_contributions',
  'employer_social_contributions',
  'rent_business_space',
  'bank_interest',
  'postal_and_telecom',
  'energy_and_water',
  'business_space_upkeep',
  'depreciation_business_asset',
  'vehicle_related',
  'protocol',
  'social_expenses',
  'private_scholarship',
  'private_pension_contribution',
  'occupational_pension_contribution',
  'pepp_contribution',
  'voluntary_health_insurance',
  'sports_subscription',
  'professional_body_dues',
  'mandatory_professional_contribution',
  'etf_purchase',
  'home_office_shared_cost',
  'comodat_immovable_share',
];

// ── The facts about an expense that the law keys on ─────────────────────────

/** Whether the activity is `prestarea de servicii de cazare`, which from FY2026 falls under
 *  art. 68^3 — a flat 30 % of gross with NO expense engine at all (defect B-29).
 *
 *  PG-6b: this is now also a PROFILE fact (`PfaProfile.activityFamily`), declared by the person and not
 *  inferred. The values are spelled once, here, and the persisted schema reads `ACTIVITY_FAMILY_VALUES`
 *  rather than restating the pair — a second spelling of one vocabulary is the B-70 defect class.
 *  Absence is deliberately NOT a member of this union: "the person has not answered" is a different
 *  state from "the person answered: other", and collapsing them would assert that the ordinary rules
 *  apply to somebody who was never asked. */
export type ActivityFamily = 'other' | 'cazare';

/** The same two families, as a value, so the persisted schema and any option list read one source. */
export const ACTIVITY_FAMILY_VALUES: [ActivityFamily, ...ActivityFamily[]] = ['other', 'cazare'];

/** CF art. 68 alin. (4) lit. a): a deductible expense must be „justificate prin documente". */
export type DocumentEvidence = 'present' | 'absent' | 'unknown';

/**
 * How a motor vehicle (MTMA <= 3.500 kg, <= 9 seats) is actually used. This is a FACT, not a legal
 * conclusion: the law decides the consequence but not the fact. `exclusive` means exclusive use for
 * the activity **evidenced by a foaie de parcurs** (category, purpose, place, km, own fuel norm);
 * absent that record the law defaults to 50 %, so `unknown` deliberately behaves like `mixed`.
 *
 * D-VEH-1 settles the direction of that default, and it is worth keeping the reasoning beside the
 * type because the opposite reading was once a written instruction. Normele HG 1/2016 pct. 7 alin. (7)
 * puts the burden in ONE direction — „**În vederea acordării deductibilității integrale** … justificarea
 * utilizării vehiculelor se efectuează pe baza documentelor justificative **și prin întocmirea foii de
 * parcurs**” (docs/ai/research/21_expense_deductibility_framework_2026.md §4.1, marked Verified). Full
 * deductibility is the thing that must be evidenced; the 50 % cut is what applies when it is not. So
 * `unknown` **computes at 50 %** — it is never `incomplete` and never a refusal, because refusing would
 * treat the app's own missing record as if the law were unresolved, and it would understate a liability.
 *
 * `unknown` and `mixed` stay **distinct stored facts** even though both compute at 50 %: a foaie de
 * parcurs changes the answer for one of them and not for the other.
 */
export type VehicleUseFact = 'exclusive' | 'mixed' | 'not_used' | 'unknown';

/** The same four, as a value, so the form's option list and this union are one spelling. */
export const VEHICLE_USE_VALUES: readonly VehicleUseFact[] = ['exclusive', 'mixed', 'not_used', 'unknown'];

/** The five categories at art. 68 alin. (7) lit. k) points 1-5 where deduction is 100 %.
 *  The burden of proof is on the taxpayer (Normele pct. 68 alin. (2)). */
export type VehicleExceptionCategory =
  | 'urgenta_paza_curierat'
  | 'agent_vanzari_achizitii'
  | 'transport_persoane_cu_plata'
  | 'servicii_plata_inchiriere_instruire'
  | 'marfuri_in_scop_comercial';

/** The same five, as a value, so the form's option list and this union are one spelling. */
export const VEHICLE_EXCEPTION_CATEGORIES: readonly VehicleExceptionCategory[] = [
  'urgenta_paza_curierat',
  'agent_vanzari_achizitii',
  'transport_persoane_cu_plata',
  'servicii_plata_inchiriere_instruire',
  'marfuri_in_scop_comercial',
];

/**
 * The two declared answers used by the vehicle facts. Absence is NOT a member: "the person was never
 * asked" is a different state from "the person answered: nu", and the cap resolution reads that
 * difference — an unanswered car is treated as a candidate for the one-car cap, an answered `nu` is not.
 */
export type VehicleYesNo = 'da' | 'nu';

/**
 * The per-car, per-fiscal-year facts (D-VEH-3).
 *
 * They live here, in the layer that reads them, for the standing reason in this repository: a vocabulary
 * spelled twice drifts (B-70). `data/types.ts` builds the stored `Vehicle` record on top of this shape
 * rather than restating it.
 *
 * Every field is optional and nothing anywhere defaults it. In particular:
 *
 * - `usedByPerson` is the fact art. 68 alin. (5) lit. j) turns on — the litera bites only on „autoturismele
 *   **folosite de contribuabil** sau membru asociat”. A car the taxpayer does not personally use is
 *   **outside** the one-car cap and keeps the general rule of alin. (4) + alin. (7) lit. k): 100 % if used
 *   exclusively with documents and a foaie de parcurs, 50 % otherwise. That distinction is the whole
 *   reason D-VEH-3 chose an entity instead of a per-year count, and it is `docs/ai/research/40_vehicle_one_car_limit.md` §4's
 *   „the distinction the texts *do* support”.
 * - `designatedForRunningCosts` is **the person's own choice** (D-VEH-2), not a finding. The law supplies
 *   no selection criterion at all, so the app asks; it never picks a car itself.
 */
export interface VehicleYearFacts {
  /** The fiscal year these facts are declared for — the cap and the use fact are both annual. */
  fiscalYear: number;
  use?: VehicleUseFact;
  exceptionCategory?: VehicleExceptionCategory;
  usedByPerson?: VehicleYesNo;
  designatedForRunningCosts?: VehicleYesNo;
}

/** The minimum the cap resolver needs from a stored vehicle record. */
export interface VehicleFacts {
  id: string;
  label: string;
  years?: readonly VehicleYearFacts[];
}

/**
 * Where a car stands with respect to art. 68 alin. (5) lit. j) for one fiscal year.
 *
 * The cap is a **selection over cars, not a rate**: lit. j) says the costs are „deductibile limitat
 * **potrivit alin. (7) lit. k)** la cel mult un singur autoturism”, so the two rules are cumulative and
 * the allowance is expressed *through* the 50 % rule (`docs/ai/research/40_vehicle_one_car_limit.md` §6).
 * That is why this is a status and not a fourth percentage.
 *
 * - `outside_cap` — `usedByPerson` is `nu`: lit. j) does not reach this car at all.
 * - `sole_candidate` — inside lit. j), and the only car that could be. „Cel mult un singur autoturism”
 *   excludes nothing when there is only one, so the allowance applies without any choice being made.
 * - `designated` — the person designated this car (D-VEH-2).
 * - `not_designated` — inside lit. j), and the person designated a different one.
 * - `designation_missing` — two or more candidates and no designation. The app cannot know which car
 *   carries the costs, and it is forbidden to guess.
 * - `designation_conflict` — two or more cars the person marked as designated. lit. j) allows one; the
 *   app does not arbitrate between them.
 *
 * **There is no tie-breaker in this union.** No most-expensive, no first-registered, no highest-mileage,
 * no CAEN, no category token — `research/40` §1 records that the texts do not answer, and encoding any
 * reading as a rule would be inventing law.
 */
export type VehicleCapStatus =
  | 'outside_cap'
  | 'sole_candidate'
  | 'designated'
  | 'not_designated'
  | 'designation_missing'
  | 'designation_conflict';

/** The statuses that leave a car's running costs unsettled. */
const CAP_UNRESOLVED: readonly VehicleCapStatus[] = [
  'not_designated',
  'designation_missing',
  'designation_conflict',
];

export function isVehicleCapUnresolved(status: VehicleCapStatus): boolean {
  return CAP_UNRESOLVED.includes(status);
}

/**
 * How the vehicle facts reached the classifier **before PG-6c**, and what replaced them.
 *
 * `vehicleUse` and `vehicleExceptionCategory` used to be fields on `ExpenseClassificationContext` — one
 * value for the whole classification run. That shape cannot express the one distinction the texts do
 * support (two identical cars can sit on opposite sides of lit. j)), and it silently applied one car's
 * answer to every expense. They are now resolved **per expense, from the car that expense is attributed
 * to**, and the context carries no vehicle fact at all.
 */
export type ExpenseClassificationContext = {
  activityFamily?: ActivityFamily;
  documentEvidence?: DocumentEvidence;
};

/**
 * The vehicle answer for ONE expense, resolved by the assembler before the classifier runs.
 *
 * - `no_vehicles` — the register records no vehicle at all. There is no per-car fact to bypass and no
 *   cap to enforce, so the statutory default applies exactly as before PG-6c: an unevidenced vehicle
 *   expense is capped at 50 % by alin. (7) lit. k). This is what keeps an existing profile with no
 *   vehicle data behaving as it did.
 * - `unattributed` — the register DOES record vehicles, but this expense names none (or names one that no
 *   longer exists). The app must not fall back to a global value here: it says so, and the expense's
 *   vehicle treatment is refused until it is attributed.
 * - `attributed` — the car's own facts decide.
 */
export type VehicleExpenseResolution =
  | { kind: 'no_vehicles' }
  | { kind: 'unattributed'; vehicleId?: string }
  | {
      kind: 'attributed';
      vehicleId: string;
      label: string;
      use?: VehicleUseFact;
      exceptionCategory?: VehicleExceptionCategory;
      usedByPerson?: VehicleYesNo;
      capStatus: VehicleCapStatus;
    };

export type ExpenseClassificationInput = {
  /** `null`/`undefined` is the legacy state: an expense that carries no category yet. */
  category: ExpenseCategory | null | undefined;
  context?: ExpenseClassificationContext;
  /** Resolved per expense, never inherited from a run-wide value. */
  vehicle?: VehicleExpenseResolution;
};

// ── Results ─────────────────────────────────────────────────────────────────

export type DeductibilityTreatment = 'deductible' | 'non_deductible' | 'capped' | 'undetermined';

/** Which base a percentage cap is measured against. Machine-readable; the wording is TASK 7's. */
export type CapBase =
  | 'expense_itself'
  | 'art68_alin6_base'
  | 'gross_income'
  | 'annual_salary_expense'
  | 'annual_eur_per_person';

export type DeductibilityCap = {
  /** Percentage cap, unscaled (2 means 2 %). Absent for a euro-denominated cap. */
  percent?: number;
  /** Annual euro cap. Never converted to lei here — the law states it in EUR. */
  eur?: number;
  /**
   * TASK 10b — the currency the ceiling is stated in, and the amount in that currency, read from the
   * parameter's own `unit`/`value` pair instead of hardcoded in the calculator. CF art. 68 alin. (5)
   * states its ceilings in euro and ONLY in euro, so every rule in this package resolves to `EUR` here.
   * The pair exists so a future *verified* non-euro ceiling would travel through the same conversion
   * rather than a new one — it is not a licence to invent a ceiling the law does not state.
   *
   * `eur` is kept beside it because TASK 2c pinned it and because the euro letters are the whole set.
   */
  currency?: Exclude<CurrencyCode, 'RON'>;
  amount?: number;
  base: CapBase;
  /** The article that states the cap base, for the explanation layer. */
  baseArticle: string;
  /**
   * TASK 10b — the earliest payment the CEILING counts. OUG 8/2026 art. 10 alin. (9) makes the FY2026
   * 400 EUR test for pensii facultative count payments from 1 ianuarie 2026, while the neighbouring
   * letters bite from 1 martie. That is a cap-aggregation window, not a rule-availability date, so it is
   * NOT `effectiveFrom` and must not be read as one. Written by TASK 2c, load-bearing from TASK 10b.
   */
  countsPaymentsFrom?: string;
};

export type ClassifiedExpense = {
  status: 'classified';
  treatment: Exclude<DeductibilityTreatment, 'undetermined'>;
  /**
   * Nullable on purpose: the documentation condition at art. 68 alin. (4) lit. a) disqualifies an
   * expense whatever its category, so a legitimately classified expense can still carry none.
   */
  category: ExpenseCategory | null;
  /** The rule that produced this treatment — this is what lets the estimate explain its own total. */
  rule: FiscalRule;
  cap?: DeductibilityCap;
  /** A legal condition the treatment depends on, when the rule states one. */
  condition?: string;
  /**
   * TASK 2c — an unresolved conflict the rule itself carries, verbatim from the rule parameter. It is
   * separate from `condition` because it is not a fact the treatment depends on: it is two operative
   * rules that give different answers, and the app has chosen the smaller one. Surfaced so no consumer
   * can present the resulting number as settled law.
   */
  conflict?: string;
};

export type UndeterminedExpense = {
  status: 'undetermined';
  category: ExpenseCategory | null;
  /** The rule that settles the treatment only partially, or `null` when no rule covers the category. */
  rule: FiscalRule | null;
  /** The fact the law does not supply. Surfaced to the user; never turned into a data-entry chore. */
  missingFact: string;
};

export type RefusedExpense = {
  status: 'refused';
  /**
   * Art. 68^3 routes expenses through a flat 30 % ratio instead of into the categories this classifier
   * holds, so there is nothing here to classify into. This build has no flat-ratio engine and declines;
   * D-CAZ-1 assigns that engine to PG-6h, which will read the same `activityFamily` fact to pick a method.
   */
  rule: FiscalRule;
  reason: string;
};

export type ExpenseClassification = ClassifiedExpense | UndeterminedExpense | RefusedExpense;

// ── Parameter readers ───────────────────────────────────────────────────────

function textParam(rule: FiscalRule, id: string): string | undefined {
  const v = rule.parameters.find((p) => p.id === id)?.value;
  return typeof v === 'string' ? v : undefined;
}

function numberParam(rule: FiscalRule, id: string): number | undefined {
  const v = rule.parameters.find((p) => p.id === id)?.value;
  return typeof v === 'number' ? v : undefined;
}

function deductibilityRules(rules: FiscalRule[], query: RuleQuery): FiscalRule[] {
  return selectApplicableRules(rules, query).filter((r) => r.taxRegime === DEDUCTIBILITY_REGIME);
}

// ── Condition matching ──────────────────────────────────────────────────────

/**
 * The vehicle facts condition matching is allowed to read: the ones resolved for THIS expense.
 *
 * It is a separate parameter rather than a field on `ExpenseClassificationContext` on purpose — the
 * context is one value per classification run, and a vehicle fact that lives there is a fact about no
 * particular car (acceptance 7).
 */
export type VehicleConditionFacts = {
  use?: VehicleUseFact;
  exceptionCategory?: VehicleExceptionCategory;
};

function conditionMatches(
  condition: string | undefined,
  ctx: ExpenseClassificationContext,
  vehicle: VehicleConditionFacts = {},
): boolean {
  switch (condition) {
    case undefined:
    case 'always':
      return true;
    case 'document_absent':
      return ctx.documentEvidence === 'absent';
    case 'activity_cazare':
      return ctx.activityFamily === 'cazare';
    case 'vehicle_use_exclusive':
      // Either genuinely exclusive use (evidenced), or one of the five art. 68 alin. (7) lit. k)
      // exception categories, which are integral deductibile regardless.
      return vehicle.use === 'exclusive' || vehicle.exceptionCategory !== undefined;
    case 'vehicle_use_not_exclusive':
      // The statutory default: no logbook, no exception category => 50 %. `undefined` here means "no
      // vehicle fact was supplied for this expense", which is the same unevidenced case, NOT a
      // licence to apply another car's answer.
      return vehicle.use === 'mixed' || vehicle.use === 'unknown' || vehicle.use === undefined;
    case 'vehicle_use_none':
      return vehicle.use === 'not_used';
    default:
      // An unknown condition token must never silently match.
      return false;
  }
}

/** True when a rule states a specific condition rather than applying unconditionally. */
function isSpecific(rule: FiscalRule): boolean {
  const c = textParam(rule, 'condition');
  return c !== undefined && c !== 'always';
}

/**
 * The currency-bearing ceiling parameter, if the rule states one. The currency comes from the
 * parameter's `unit`, which is the same fact `paramBani` refuses on: a parameter whose unit is not
 * 'lei' can never be read as money, so a ceiling in a foreign currency stays a ceiling until an
 * explicit conversion turns it into a lei one.
 */
const CAP_CURRENCY_UNITS: Record<string, Exclude<CurrencyCode, 'RON'>> = {
  eur: 'EUR',
  usd: 'USD',
  gbp: 'GBP',
  huf: 'HUF',
};

function capCurrencyParam(rule: FiscalRule): { currency: Exclude<CurrencyCode, 'RON'>; major: number } | undefined {
  for (const p of rule.parameters) {
    const currency = CAP_CURRENCY_UNITS[p.unit];
    if (currency === undefined) continue;
    if (typeof p.value !== 'number') continue;
    return { currency, major: p.value };
  }
  return undefined;
}

function capFor(rule: FiscalRule): DeductibilityCap | undefined {
  const percent = numberParam(rule, 'cap_percent');
  const eur = numberParam(rule, 'cap_eur');
  const currencyParam = capCurrencyParam(rule);
  if (percent === undefined && eur === undefined && currencyParam === undefined) return undefined;
  const base = textParam(rule, 'cap_base') ?? 'expense_itself';
  const countsPaymentsFrom = textParam(rule, 'cap_counts_payments_from');
  return {
    ...(percent !== undefined ? { percent } : {}),
    ...(eur !== undefined ? { eur } : {}),
    ...(currencyParam !== undefined ? { currency: currencyParam.currency, amount: currencyParam.major } : {}),
    base: base as CapBase,
    baseArticle: textParam(rule, 'cap_base_article') ?? rule.sourceArticle,
    ...(countsPaymentsFrom !== undefined ? { countsPaymentsFrom } : {}),
  };
}

/**
 * The ceiling as a money amount in the currency the law states it in — the ONLY place a rule's foreign
 * ceiling becomes a `Money`, and it is never a lei one. `paramBani` still refuses any parameter whose
 * unit is not 'lei', and the lei ceiling exists only after `strikeCapCeiling` converts this.
 *
 * Returns `null` for a cap with no currency parameter, which is every percentage cap: a percentage is
 * not an amount and must never be dressed as one.
 */
export function capAmount(cap: DeductibilityCap): Money<Exclude<CurrencyCode, 'RON'>> | null {
  const currency = cap.currency;
  const major = cap.amount;
  if (currency === undefined || major === undefined) return null;
  return money(majorToMinor(major, currency), currency);
}

// ── PG-6c: the one-car limit, resolved per car and per year ─────────────────

/**
 * art. 68 alin. (5) lit. j), quoted. It is quoted rather than paraphrased because two of its words do
 * the work: „folosite de contribuabil sau membru asociat” decides *which cars the litera reaches at all*,
 * and „aferent **fiecărei persoane**” is what makes the cap a per-person limit rather than a per-register
 * one. Nothing in this file keys it to a CUI.
 */
export const ONE_CAR_LIMIT_QUOTE =
  'art. 68 alin. (5) lit. j): „cheltuielile de funcționare, întreținere și reparații, aferente '
  + 'autoturismelor folosite de contribuabil sau membru asociat sunt deductibile limitat potrivit '
  + 'alin. (7) lit. k) la cel mult un singur autoturism aferent fiecărei persoane”.';

/**
 * Reading A on the second taxpayer-used car: fully non-deductible as *uz personal*.
 * Quoted from art. 68 alin. (7) lit. a) — `docs/ai/research/40_vehicle_one_car_limit.md` §2.
 */
export const ONE_CAR_READING_PERSONAL_USE =
  'CITEȘTE A — cheltuielile celuilalt autoturism sunt integral nedeductibile: odată epuizat dreptul '
  + 'la „un singur autoturism”, ele nu mai sunt cheltuieli „deductibile limitat” la alin. (5), iar '
  + 'alin. (7) lit. a) merge în aceeași direcție: „sumele sau bunurile utilizate de contribuabil '
  + 'pentru uzul personal sau al familiei sale”.';

/**
 * Reading B on the second taxpayer-used car: still deductible with the 50 % haircut.
 * Quoted from Normele HG 1/2016 pct. 7 alin. (7) — `docs/ai/research/21_expense_deductibility_framework_2026.md` §4.1.
 */
export const ONE_CAR_READING_HALF_DEDUCTIBLE =
  'CITEȘTE B — rămân deductibile cu limitarea de 50 %: Normele pct. 7 alin. (7) limitează la 50 % '
  + '„dreptul de deducere a cheltuielilor efectuate conform art. 68 alin. (4) și (5) din Codul fiscal '
  + 'legate de aceste vehicule”, fără nicio regulă de selecție a autoturismului.';

/**
 * The sentence for a vehicle expense the app cannot attribute to a car.
 *
 * It has to say two things and must not blur them. (1) This is the **app's** limit, not a legal answer:
 * the 50 % default of alin. (7) lit. k) still stands for a vehicle whose exclusive use simply is not
 * evidenced, and D-VEH-1 forbids turning a missing record into a refusal of the deduction. (2) The app
 * will not answer with another car's facts, because once cars differ — one inside lit. j), one outside;
 * one designated, one not — a single global value silently applies the wrong car's answer to the record.
 */
export const VEHICLE_ATTRIBUTION_MISSING_FACT =
  'Înregistrarea este o cheltuială legată de vehicul, dar nu este atribuită niciunui vehicul din '
  + 'registru (sau vehiculul atribuit nu mai există). Aplicația nu alege ea un vehicul și nu aplică '
  + 'faptele altui vehicul: fără atribuire nu poate citi utilizarea acestui vehicul, încadrarea în '
  + 'cele cinci categorii de la art. 68 alin. (7) lit. k) și poziția față de limita de „cel mult un '
  + 'singur autoturism aferent fiecărei persoane” (art. 68 alin. (5) lit. j)). Aceasta este o limită '
  + 'a aplicației, nu un răspuns al legii — pentru un vehicul a cărui utilizare exclusivă nu este '
  + 'justificată legea rămâne la 50 %. Atribuie cheltuiala unui vehicul ca să revină în calcul.';

/** The facts declared for one car in one fiscal year, or `undefined` when that year was never answered. */export function vehicleYearFacts(
  vehicle: VehicleFacts,
  fiscalYear: number,
): VehicleYearFacts | undefined {
  return vehicle.years?.find((y) => y.fiscalYear === fiscalYear);
}

/**
 * Where each car stands against art. 68 alin. (5) lit. j) for one fiscal year.
 *
 * The whole function is arithmetic over facts the person declared, plus the litera's own words. It
 * never picks a car:
 *
 * 1. A car answered `nu` to „folosit de contribuabil sau membru asociat” is **outside** lit. j) — the
 *    litera is limited by its own text to „autoturismele folosite de contribuabil sau membru asociat”
 *    (`research/40` §4). It keeps the general rule: 100 % on exclusive use with documents and a foaie
 *    de parcurs, 50 % otherwise.
 * 2. A car answered `da`, **and a car nobody has answered for**, is a candidate. Answered-`nu` is the only
 *    way out of the cap, because absence is not an answer and the fail-closed reading of an unanswered
 *    car is "it might be inside".
 * 3. With **one** candidate the cap excludes nothing — „cel mult un singur autoturism” is satisfied by
 *    arithmetic, so no choice is needed and none is invented.
 * 4. With **two or more**, the only thing that can settle it is the person's own designation (D-VEH-2).
 *    No designation, or more than one, leaves it unsettled — and it is reported as unsettled rather than
 *    resolved by a heuristic.
 *
 * **Per person, not per register.** The cap is „aferent fiecărei persoane”, so it is not keyed to the
 * PFA's CUI and nothing here reads one. The app models one natural person's register; `research/40` §5
 * leaves a person who holds a PFA and an II/IF at the same time unresolved, and this function does not
 * pretend otherwise — it has no second register to compare against.
 */
export function vehicleCapStatuses(
  vehicles: readonly VehicleFacts[],
  fiscalYear: number,
): Map<string, VehicleCapStatus> {
  const facts = new Map<string, VehicleYearFacts | undefined>();
  for (const v of vehicles) facts.set(v.id, vehicleYearFacts(v, fiscalYear));

  const candidates = vehicles.filter(v => facts.get(v.id)?.usedByPerson !== 'nu');
  const designated = candidates.filter(v => facts.get(v.id)?.designatedForRunningCosts === 'da');

  const statuses = new Map<string, VehicleCapStatus>();
  for (const v of vehicles) {
    const f = facts.get(v.id);
    if (f?.usedByPerson === 'nu') {
      statuses.set(v.id, 'outside_cap');
    } else if (candidates.length <= 1) {
      statuses.set(v.id, 'sole_candidate');
    } else if (designated.length === 1) {
      statuses.set(v.id, designated[0].id === v.id ? 'designated' : 'not_designated');
    } else if (designated.length === 0) {
      statuses.set(v.id, 'designation_missing');
    } else {
      statuses.set(v.id, designated.some(d => d.id === v.id) ? 'designation_conflict' : 'not_designated');
    }
  }
  return statuses;
}

/**
 * A resolver bound to one register and one fiscal year, so a whole expense run does not re-walk the
 * car list per record. `resolveVehicleExpense` is the single-call form.
 */
export function vehicleExpenseResolver(
  vehicles: readonly VehicleFacts[],
  fiscalYear: number,
): (vehicleId?: string) => VehicleExpenseResolution {
  const statuses = vehicleCapStatuses(vehicles, fiscalYear);
  return vehicleId => {
    if (vehicles.length === 0) return { kind: 'no_vehicles' };
    if (vehicleId === undefined || vehicleId === '') return { kind: 'unattributed' };
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle === undefined) return { kind: 'unattributed', vehicleId };
    const f = vehicleYearFacts(vehicle, fiscalYear);
    return {
      kind: 'attributed',
      vehicleId: vehicle.id,
      label: vehicle.label,
      ...(f?.use !== undefined ? { use: f.use } : {}),
      ...(f?.exceptionCategory !== undefined ? { exceptionCategory: f.exceptionCategory } : {}),
      ...(f?.usedByPerson !== undefined ? { usedByPerson: f.usedByPerson } : {}),
      capStatus: statuses.get(vehicle.id) ?? 'sole_candidate',
    };
  };
}

export function resolveVehicleExpense(
  vehicles: readonly VehicleFacts[],
  fiscalYear: number,
  vehicleId?: string,
): VehicleExpenseResolution {
  return vehicleExpenseResolver(vehicles, fiscalYear)(vehicleId);
}

function vehicleRuleForCondition(
  applicable: FiscalRule[],
  condition: string,
): FiscalRule | undefined {
  return applicable.find(
    r => textParam(r, 'category') === 'vehicle_related' && textParam(r, 'condition') === condition,
  );
}

/** The sentence naming why the designation did not settle this car. Built per status, never shared. */
function designationSentence(status: VehicleCapStatus): string {
  switch (status) {
    case 'designation_missing':
      return 'Pentru acest an fiscal există două sau mai multe autoturisme care pot intra sub literă, iar '
        + 'niciunul nu este desemnat. Aplicația nu alege niciunul: nu există „cel mai scump”, „primul '
        + 'înmatriculat” sau „cel mai mult folosit” în niciun text.';
    case 'not_designated':
      return 'Pentru acest an fiscal ai desemnat un alt autoturism, iar litera permite unul singur.';
    case 'designation_conflict':
      return 'Pentru acest an fiscal ai desemnat mai mult de un autoturism, iar litera permite unul '
        + 'singur; aplicația nu arbitrează între ele.';
    default:
      return '';
  }
}

/**
 * The detail for a car whose running costs the app will not settle: **both readings, verbatim**.
 *
 * D-VEH-2 requires it — a designated car must never make the other car's costs look settled — and
 * `research/40` §4 forbids picking one. Showing only the reading the app finds likelier would present
 * an unresolved question as a finding, which is the defect class this whole series exists to remove.
 */
export function oneCarUnresolvedFact(resolution: Extract<VehicleExpenseResolution, { kind: 'attributed' }>): string {
  return (
    `Autoturismul „${resolution.label}” este declarat ca fiind folosit de contribuabil sau de membru `+
    `asociat, deci intră sub ${ONE_CAR_LIMIT_QUOTE} ${designationSentence(resolution.capStatus)} ` +
    'Niciun text primar nu spune ce se întâmplă cu al doilea autoturism folosit de contribuabil, iar ' +
    'aplicația nu alege o lectură în locul tău. Două lecturi rămân deschise. '
    + ONE_CAR_READING_PERSONAL_USE + ' ' + ONE_CAR_READING_HALF_DEDUCTIBLE + ' '
    + 'Cât timp întrebarea nu este răspunsă, cheltuiala rămâne în afara calcului și este raportată, '
    + 'nu dedusă după una dintre lecturi.'
  );
}

// ── The public entry points ─────────────────────────────────────────────────

/**
 * Does the expense engine apply at all? Art. 68 alin. (1) excepts art. 68^1, 68^3 and 69; art. 68^3
 * (introduced by Legea 239/2025, from FY2026 incomes) replaces actual-expense deduction with a flat
 * 30 % of gross for `prestarea de servicii de cazare` and removes the accounting obligation entirely.
 * For that activity family there is nothing to classify, so the app must refuse rather than produce a
 * confident wrong number (defect B-29).
 */
export function expenseEngineRefusal(
  context: ExpenseClassificationContext,
  rules: FiscalRule[],
  query: RuleQuery,
): RefusedExpense | null {
  for (const rule of deductibilityRules(rules, query)) {
    if (textParam(rule, 'treatment') !== 'no_expense_engine') continue;
    if (!conditionMatches(textParam(rule, 'condition'), context)) continue;
    return {
      status: 'refused',
      rule,
      reason: textParam(rule, 'missing_fact') ?? `${rule.ruleId}: no expense engine applies`,
    };
  }
  return null;
}

/**
 * Classify one expense's deductibility and return the rule that justifies it.
 *
 * Pure: no clock, no store, no money arithmetic. `query` is the expense's own fiscal year and the
 * date that attributes it to that year (art. 68 alin. (4) lit. b) — the year of PAYMENT), so
 * `asOfDate` should be `expense.paid ?? expense.date`.
 *
 * Order is deliberate: the regime-level refusal is checked before any category, because where the law
 * supplies no expense engine there is no category to resolve.
 */
export function classifyExpenseDeductibility(
  expense: ExpenseClassificationInput,
  rules: FiscalRule[],
  query: RuleQuery,
): ExpenseClassification {
  const ctx = expense.context ?? {};
  const applicable = deductibilityRules(rules, query);
  // PG-6c — the vehicle facts the conditions may read come from THIS expense's car, never from a
  // run-wide context. `no_vehicles` and an absent resolution both leave them empty, which routes the
  // category to alin. (7) lit. k)'s statutory 50 % default.
  const vehicleFacts: VehicleConditionFacts =
    expense.vehicle?.kind === 'attributed'
      ? {
          ...(expense.vehicle.use !== undefined ? { use: expense.vehicle.use } : {}),
          ...(expense.vehicle.exceptionCategory !== undefined
            ? { exceptionCategory: expense.vehicle.exceptionCategory }
            : {}),
        }
      : {};

  // 1. No expense engine at all for this activity family.
  const refusal = expenseEngineRefusal(ctx, rules, query);
  if (refusal) return refusal;

  // 2. Art. 68 alin. (4) lit. a): an expense that is not justified by documents fails the condition
  //    and is simply not a deductible expense. This is a condition, not a litera of alin. (7).
  const category = expense.category ?? null;
  const docRule = applicable.find(
    (r) =>
      textParam(r, 'category') === '*' &&
      textParam(r, 'condition') === 'document_absent' &&
      ctx.documentEvidence === 'absent',
  );
  if (docRule) {
    return {
      status: 'classified',
      treatment: 'non_deductible',
      category,
      rule: docRule,
      condition: textParam(docRule, 'note'),
    };
  }

  if (category === null) {
    return {
      status: 'undetermined',
      category: null,
      rule: null,
      missingFact: 'Expense has no category; no rule can be applied to it.',
    };
  }

  // PG-6c — the vehicle facts are per car, so the two ways they can fail to arrive are settled here,
  // before any category rule is consulted. Both are reported, neither is answered with a global value.
  //
  // 1. The register records cars and this expense names none. Applying the 50 % default here would be
  //    the old global-context mechanism in a new costume: it would silently decide which car's facts
  //    apply, and it would let a second car's running costs through a cap that allows one.
  // 2. The car is inside lit. j) and the one-car allowance is not settled for it. The law does not say
  //    what happens to a second taxpayer-used car, so the record leaves the base with both readings on it.
  //
  // `no_vehicles` deliberately falls through to the ordinary rules: with no car recorded there is no
  // per-car fact to bypass, and alin. (7) lit. k)'s 50 % default is the law's answer, not a gap.
  const vehicle = expense.vehicle;
  if (category === 'vehicle_related' && vehicle !== undefined) {
    if (vehicle.kind === 'unattributed') {
      return {
        status: 'undetermined',
        category,
        rule: null,
        missingFact: VEHICLE_ATTRIBUTION_MISSING_FACT,
      };
    }
    if (vehicle.kind === 'attributed' && isVehicleCapUnresolved(vehicle.capStatus)) {
      return {
        status: 'undetermined',
        category,
        rule: vehicleRuleForCondition(applicable, 'vehicle_use_not_exclusive') ?? null,
        missingFact: oneCarUnresolvedFact(vehicle),
      };
    }
  }

  // 3. Category match. Prefer a rule that states a specific condition over an unconditional one.
  const candidates = applicable.filter((r) => {
    if (textParam(r, 'category') !== category) return false;
    return conditionMatches(textParam(r, 'condition'), ctx, vehicleFacts);
  });
  if (candidates.length === 0) {
    return {
      status: 'undetermined',
      category,
      rule: null,
      missingFact: `No verified 2026 rule covers category '${category}'. Art. 68 alin. (7) lit. l) is an open clause, so an uncited category is never treated as deductible.`,
    };
  }
  const rule = candidates.find(isSpecific) ?? candidates[0];

  const treatment = textParam(rule, 'treatment');

  // 4. The law settles the direction but supplies no method — the residue is a fact.
  if (treatment === 'undetermined') {
    return {
      status: 'undetermined',
      category,
      rule,
      missingFact:
        textParam(rule, 'missing_fact') ??
        'The law fixes the treatment but not the amount; the missing fact is not named by the rule.',
    };
  }

  if (treatment === 'deductible' || treatment === 'non_deductible' || treatment === 'capped') {
    const cap = capFor(rule);
    const conflict = textParam(rule, 'conflict');
    return {
      status: 'classified',
      treatment,
      category,
      rule,
      ...(cap ? { cap } : {}),
      ...(textParam(rule, 'note') ? { condition: textParam(rule, 'note') } : {}),
      ...(conflict ? { conflict } : {}),
    };
  }

  // A deductibility rule whose treatment token is not one of the four known treatments is a data
  // error, not a legal outcome. Refuse to guess.
  return {
    status: 'undetermined',
    category,
    rule,
    missingFact: `Rule ${rule.ruleId} carries an unrecognised treatment '${treatment ?? 'missing'}'; no deduction may be inferred from it.`,
  };
}
