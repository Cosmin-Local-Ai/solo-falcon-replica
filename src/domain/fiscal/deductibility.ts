import type { FiscalRule } from './rules';
import { selectApplicableRules, type RuleQuery } from './select';

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
  // Deductible ordinary business expenses — Normele HG 1/2016 pct. 7 alin. (5).
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
 *  art. 68^3 — a flat 30 % of gross with NO expense engine at all (defect B-29). */
export type ActivityFamily = 'other' | 'cazare';

/** CF art. 68 alin. (4) lit. a): a deductible expense must be „justificate prin documente". */
export type DocumentEvidence = 'present' | 'absent' | 'unknown';

/**
 * How a motor vehicle (MTMA <= 3.500 kg, <= 9 seats) is actually used. This is a FACT, not a legal
 * conclusion: the law decides the consequence but not the fact. `exclusive` means exclusive use for
 * the activity **evidenced by a foaie de parcurs** (category, purpose, place, km, own fuel norm);
 * absent that record the law defaults to 50 %, so `unknown` deliberately behaves like `mixed`.
 */
export type VehicleUseFact = 'exclusive' | 'mixed' | 'not_used' | 'unknown';

/** The five categories at art. 68 alin. (7) lit. k) points 1-5 where deduction is 100 %.
 *  The burden of proof is on the taxpayer (Normele pct. 68 alin. (2)). */
export type VehicleExceptionCategory =
  | 'urgenta_paza_curierat'
  | 'agent_vanzari_achizitii'
  | 'transport_persoane_cu_plata'
  | 'servicii_plata_inchiriere_instruire'
  | 'marfuri_in_scop_comercial';

export type ExpenseClassificationContext = {
  activityFamily?: ActivityFamily;
  documentEvidence?: DocumentEvidence;
  vehicleUse?: VehicleUseFact;
  vehicleExceptionCategory?: VehicleExceptionCategory;
};

export type ExpenseClassificationInput = {
  /** `null`/`undefined` is the legacy state: an expense that carries no category yet. */
  category: ExpenseCategory | null | undefined;
  context?: ExpenseClassificationContext;
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
  base: CapBase;
  /** The article that states the cap base, for the explanation layer. */
  baseArticle: string;
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
  /** Art. 68^3 leaves no expense engine to classify into. The app must decline, not compute. */
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

function conditionMatches(condition: string | undefined, ctx: ExpenseClassificationContext): boolean {
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
      return ctx.vehicleUse === 'exclusive' || ctx.vehicleExceptionCategory !== undefined;
    case 'vehicle_use_not_exclusive':
      // The statutory default: no logbook, no exception category => 50 %.
      return ctx.vehicleUse === 'mixed' || ctx.vehicleUse === 'unknown' || ctx.vehicleUse === undefined;
    case 'vehicle_use_none':
      return ctx.vehicleUse === 'not_used';
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

function capFor(rule: FiscalRule): DeductibilityCap | undefined {
  const percent = numberParam(rule, 'cap_percent');
  const eur = numberParam(rule, 'cap_eur');
  if (percent === undefined && eur === undefined) return undefined;
  const base = textParam(rule, 'cap_base') ?? 'expense_itself';
  return {
    ...(percent !== undefined ? { percent } : {}),
    ...(eur !== undefined ? { eur } : {}),
    base: base as CapBase,
    baseArticle: textParam(rule, 'cap_base_article') ?? rule.sourceArticle,
  };
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

  // 3. Category match. Prefer a rule that states a specific condition over an unconditional one.
  const candidates = applicable.filter((r) => {
    if (textParam(r, 'category') !== category) return false;
    return conditionMatches(textParam(r, 'condition'), ctx);
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
