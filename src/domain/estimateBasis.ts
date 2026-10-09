/**
 * Task 1 (pre-Phase-11) — which quantity enters the tax engine, and what a consumer can tell
 * about it.
 *
 * Before this module the annual tax estimate was fed raw `selectYtd` totals, so a current-year
 * dashboard put an actuals-to-date number behind a label that reads as a year. The annualisation
 * rule already exists in `src/domain/projection.ts` (run rate = YTD / elapsed months, annual =
 * run rate × 12). This module does NOT re-derive that rule — it decides which of the model’s
 * outputs may enter the engine, and records that decision in the data so `actual` and `projected`
 * are distinguishable without parsing a label.
 *
 * Two rules this module exists to enforce:
 *
 * 1. Never annualise what cannot be annualised. `selectProjectionV1` has no refusal channel: for
 *    an `asOfDate` before the fiscal year start it returns a zero denominator and all-zero
 *    totals. That is not a projection, it is the absence of one, and feeding those zeros to the
 *    engine would print a plausible `0,00 RON` annual estimate. Here that case becomes an explicit
 *    `actuals-only` basis instead - the honest output the brief requires, not a number.
 * 2. The basis travels with the result. `attachEstimateBasis` puts the basis on the engine’s
 *    `TaxEstimateResult` without the engine knowing this module exists, so every existing consumer
 *    keeps reading the same fields while a new one can ask what the numbers mean.
 *
 * No fiscal value, rate, parameter or rule lives here.
 */
import type { YtdTotals } from './aggregation';
import { expenseFiscalDate, inPeriod, selectYtd } from './aggregation';
import type { AppData, Expense } from '../data/types';
import {
  classifyExpenseDeductibility,
  expenseEngineRefusal,
  type DeductibilityCap,
  type ExpenseCategory,
  type ExpenseClassificationContext,
  type RefusedExpense,
} from './fiscal/deductibility';
import type { FiscalRule } from './fiscal/rules';
import { addBani, applyRateDecimal, lei, subBani, type Bani } from './money';
import { selectProjectionV1, type ProjectionV1 } from './projection';
import type { TaxEstimateResult } from './tax';
import Decimal from 'decimal.js-light';

/** The four money operands `computeTaxEstimate` takes (`tax.ts` `TaxCalculationInput`). */
export interface EstimateAmounts {
  revenues: Bani;
  expenses: Bani;
  revenuesNet: Bani;
  expensesNet: Bani;
}

/**
 * What fed the engine, in the data rather than in the wording.
 *
 * - `annual-projected` — the engine ran on the projection model’s annual figures. `actual` keeps
 *   the actuals-to-date they were derived from, so a consumer can show or audit both.
 * - `actuals-only` — the model could not project, so the engine ran on actuals-to-date. This is
 *   not a weaker annual estimate; it is a different, honestly-labelled quantity.
 * - `refused` — the engine was never reached: the law supplies no expense engine for this activity
 *   (art. 68^3). No amounts are recorded because none were computed.
 * - `unknown` - an estimate that arrived without a recorded basis (a hand-built result, the
 *   loading sentinel). Nothing may be claimed about actual vs projected.
 */
export type TaxEstimateBasis =
  | {
      kind: 'annual-projected';
      method: 'run-rate-v1';
      /** The denominator the projection model actually used, after its own lower bound. */
      elapsedMonths: number;
      actual: EstimateAmounts;
      projected: EstimateAmounts;
    }
  | {
      kind: 'actuals-only';
      method: null;
      elapsedMonths: number;
      actual: EstimateAmounts;
      reason: string;
    }
  | {
      /**
       * TASK 2b (defect B-29) — the estimate never ran. CF art. 68 alin. (1) excepts art. 68^3, and for
       * `prestarea de servicii de cazare` art. 68^3 replaces actual expenses with a flat 30 % of gross:
       * there is no expense engine to classify into, so there are no operands to record. A refused basis
       * deliberately carries NO amounts — the honest statement is that nothing was computed, not that
       * something was computed on zero expenses.
       */
      kind: 'refused';
      method: null;
      elapsedMonths: null;
      reason: string;
    }
  | {
      kind: 'unknown';
      method: null;
      elapsedMonths: null;
      reason: string;
    };

/**
 * A basis that carries amounts. `selectTaxEstimateBasis` can only ever produce one of the two
 * recorded kinds; `unknown` exists solely for results that arrived from elsewhere, and `refused`
 * solely for results the assembler declined to compute — neither has amounts to hand over.
 */
export type AttributedEstimateBasis = Exclude<
  TaxEstimateBasis,
  { kind: 'unknown' } | { kind: 'refused' }
>;

/** The basis a refused estimate carries: a reason, and nothing else. */
export type RefusedEstimateBasis = Extract<TaxEstimateBasis, { kind: 'refused' }>;

/** The actuals-to-date operands, read off `YtdTotals` in one place. */
export function actualEstimateAmounts(ytd: YtdTotals): EstimateAmounts {
  return {
    revenues: ytd.revenue,
    expenses: ytd.expenses,
    revenuesNet: ytd.revenueNet,
    expensesNet: ytd.expenseNet,
  };
}

/**
 * Decide the basis from the projection model’s own output.
 *
 * The only condition tested is the model’s own degenerate signal: `elapsedMonths` is its
 * denominator after its own lower bound, and `0` means "no run rate exists". Nothing is invented
 * here — in particular a partial year is NOT a refusal, because the model does not treat it as
 * one: it normalises by the fractional denominator and multiplies by 12.
 */
export function selectTaxEstimateBasis(
  projection: ProjectionV1,
  ytd: YtdTotals,
): AttributedEstimateBasis {
  const actual = actualEstimateAmounts(ytd);
  const elapsedMonths = projection.elapsedMonths;

  if (!(elapsedMonths > 0) || !Number.isFinite(elapsedMonths)) {
    return {
      kind: 'actuals-only',
      method: null,
      elapsedMonths: Number.isFinite(elapsedMonths) ? elapsedMonths : 0,
      actual,
      reason:
        'Nu există o rată de desfășurare pentru această dată (0 luni scurse din anul fiscal); ' +
        'valorile sunt cele înregistrate până acum, neannualizate.',
    };
  }

  return {
    kind: 'annual-projected',
    method: projection.method,
    elapsedMonths,
    actual,
    projected: {
      revenues: projection.annualProjected.revenue,
      expenses: projection.annualProjected.expenses,
      revenuesNet: projection.annualProjectedExclVat.revenueNet,
      expensesNet: projection.annualProjectedExclVat.expenseNet,
    },
  };
}

/** The four operands that must be handed to `computeTaxEstimate` for this basis. */
export function amountsForEstimate(basis: AttributedEstimateBasis): EstimateAmounts {
  return basis.kind === 'annual-projected' ? basis.projected : basis.actual;
}

// ── TASK 2b: the deductible subset, assembled here and nowhere else ───────────
//
// Until now the engine was fed `Σ expenses` and labelled it `Cheltuieli deductibile` — the assumption
// `tax.ts` itself recorded at art. 68 alin. (4): „the app holds no per-expense nature data”. It holds
// some now (`Expense.category`), so the label has to become true. This section is the ONLY place that
// decides which expenses reach the engine, because the operands are consumed at two call sites
// (`data/dashboard.ts getTaxEstimate`, `data/derived.ts useLatestTaxEstimate`); a subset applied at
// either one of them is the Phase 10 drift class again.
//
// Two structural facts decide the shape:
//
// 1. **The subset is applied to the records, before aggregation — not to the totals.**
//    `selectProjectionV1` calls `selectYtd` itself (`projection.ts:100`), so filtering only the `ytd`
//    argument would annualise an unfiltered expense total while reporting a filtered actual. Both
//    selectors are therefore fed the same record set.
// 2. **A cap whose base is another record set is struck by the assembler, not by the classifier.**
//    `art68_alin6_base`, `gross_income`, `annual_salary_expense` and `annual_eur_per_person` are
//    cross-record annual aggregates, and art. 68 alin. (6) defines its base as gross minus deductible
//    expenses *other than the very categories being capped* — circular at the record level. TASK 2c
//    breaks the circle with a single two-pass in `selectEstimateOperands`: classify, aggregate the
//    records that carry no annual ceiling, strike the ceilings, add what they allow back. It is NOT an
//    iteration — alin. (6) removes burse private and protocol from the base entirely, so the base cannot
//    feed back into the ceilings computed on it. The bases the app still cannot measure
//    (`annual_eur_per_person`, `annual_salary_expense`) stay excluded and counted, with the missing
//    datum named on the record.

/** Why an expense did not reach the deductible total. */
export type ExcludedReason = 'undetermined' | 'non_deductible' | 'cap_unresolved';

/** One category's contribution to the deductible total, with the rule that justified it. */
export interface DeductibleExpenseLine {
  category: ExpenseCategory;
  /** The rule that produced the treatment — this is what makes the total explainable, not just totalled. */
  ruleId: string;
  sourceArticle: string;
  treatment: 'deductible' | 'capped';
  /** Present when the amount entered only after a per-expense cap was applied. */
  cap?: DeductibilityCap;
  count: number;
  /** VAT-inclusive amount that entered the engine, after any per-expense cap. */
  inclVat: Bani;
  /** VAT-exclusive amount (`valoareFaraTva`) — the operand a non-`vatExempt` profile is taxed on. */
  exclVat: Bani;
}

/** One expense that was kept out, with the reason and the rule behind it. */
export interface ExcludedExpenseRecord {
  id: string;
  category: ExpenseCategory | null;
  reason: ExcludedReason;
  ruleId: string | null;
  sourceArticle: string | null;
  /** The missing fact, the litera that disqualifies it, or the cap base this build cannot compute. */
  detail: string;
}

/**
 * TASK 2c — one category whose ceiling is an annual aggregate, held out of `records` until the
 * assembler has struck the ceiling. It is not an exclusion and not an entry: it is the second pass.
 */
export interface AnnualCapLine {
  category: ExpenseCategory;
  ruleId: string;
  sourceArticle: string;
  cap: DeductibilityCap;
  count: number;
  /**
   * The amounts claimed under this rule, before the ceiling, in BOTH money measures. The engine picks
   * one measure by `vatExempt` (`tax.ts:143-144`), and the assembler does not know which, so each
   * measure is capped against its own gross — the same gross the engine will use for it.
   */
  inclVat: Bani;
  exclVat: Bani;
  /** The records behind this line, in input order, exactly as classified (no per-record cap applied). */
  records: Expense[];
  /** The unresolved conflict the rule carries, when it carries one. */
  conflict?: string;
}

/**
 * TASK 2c — what an annual ceiling actually did, recorded so the estimate can explain its own total.
 * Every figure is in both money measures for the same reason `AnnualCapLine` carries both.
 */
export interface AnnualCapAdjustment {
  category: ExpenseCategory;
  ruleId: string;
  sourceArticle: string;
  cap: DeductibilityCap;
  /** The amount claimed under the rule, on the basis the estimate ran on. */
  claimed: MeasurePair;
  /** The statutory ceiling, struck on that basis. */
  ceiling: MeasurePair;
  /** `min(claimed, ceiling)` — the part that entered the deductible total. */
  allowed: MeasurePair;
  /** art. 68 alin. (6) only: the base the ceiling was actually struck on (TASK 2d: the pre-cap one). */
  base?: MeasurePair;
  /**
   * art. 68 alin. (6) only: the same base under the OTHER, equally unresolved reading, and the ceiling
   * it would have given. Since TASK 2d the operative reading is PRE-cap (the other alin. (5) caps
   * subtracted as RECORDED), so `baseAlt` / `ceilingAlt` carry the POST-cap reading — the base with those
   * caps subtracted as ALLOWED, and the larger ceiling it yields. research 22 §6 records no order
   * of application, so the delta is disclosed, not hidden, and it is rendered to the user.
   */
  baseAlt?: MeasurePair;
  ceilingAlt?: MeasurePair;
  conflict?: string;
}

export interface DeductibleExpenseCounts {
  entered: number;
  undetermined: number;
  nonDeductible: number;
  capUnresolved: number;
  /** TASK 2c: records held for an annual ceiling the assembler CAN strike. Not an exclusion. */
  annualCapped: number;
}

/** The expense subset that may enter the engine, plus the audit trail of everything kept out. */
export interface DeductibleExpenseSet {
  /** Input order preserved. A capped record is a scaled copy — the stored bytes are never rewritten. */
  records: Expense[];
  lines: DeductibleExpenseLine[];
  /** TASK 2c: the categories whose ceiling is annual, held back for the assembler's second pass. */
  annualCapped: AnnualCapLine[];
  excluded: ExcludedExpenseRecord[];
  counts: DeductibleExpenseCounts;
  /** Art. 68^3: the activity has no expense engine at all, so nothing was classified (defect B-29). */
  refusal: RefusedExpense | null;
}

/**
 * A statutory cap is a CEILING, so the deductible part is the largest whole-ban amount that does not
 * exceed it: the fraction is floored, never rounded up. `roundArt66` is deliberately not used — CF
 * art. 66 alin. (1) rounds the sums that are DUE, and a cap is neither a sum due nor a base.
 */
function capBaniCeiling(amount: Bani, percent: number): Bani {
  return applyRateDecimal(amount, percent).toDecimalPlaces(0, Decimal.ROUND_FLOOR).toNumber() as Bani;
}

/**
 * The two money measures the engine can consume. `tax.ts:143-144` picks one with `vatExempt`, which is
 * a profile fact the assembler does not hold, so an annual ceiling is struck in BOTH measures against
 * that measure's own gross. Each measure then stays internally consistent with whatever the engine
 * chooses, and no measure is ever mixed with the other's base.
 */
const MEASURES = ['inclVat', 'exclVat'] as const;
type Measure = (typeof MEASURES)[number];
export type MeasurePair = { [m in Measure]: Bani };

function grossOf(a: EstimateAmounts, m: Measure): Bani {
  return m === 'inclVat' ? a.revenues : a.revenuesNet;
}

function deductibleOf(a: EstimateAmounts, m: Measure): Bani {
  return m === 'inclVat' ? a.expenses : a.expensesNet;
}

function withDeductible(a: EstimateAmounts, m: Measure, value: Bani): EstimateAmounts {
  return m === 'inclVat' ? { ...a, expenses: value } : { ...a, expensesNet: value };
}

/** A ceiling is never negative: an expense-heavy period gives a zero base, not a negative allowance. */
function nonNegativeBani(v: Bani): Bani {
  return v > 0 ? v : lei(0);
}

function minBani(a: Bani, b: Bani): Bani {
  return a < b ? a : b;
}

function zeroPair(): MeasurePair {
  return { inclVat: lei(0), exclVat: lei(0) };
}

/**
 * The sentence naming why a cap base cannot be measured here. It must name the DATUM and the RULE,
 * and must not convert "the app holds no such datum" into "the base is zero" — for cheltuieli sociale
 * that difference is the whole answer (research 22 §4: the zero ceiling is an arithmetic consequence of
 * having no personnel, which is a fact the app does not hold, not a fact it can assert).
 */
function unresolvedCapDetail(cap: DeductibilityCap | undefined, rule: FiscalRule): string {
  const base = cap ? cap.base : 'nesetată';
  const article = cap ? cap.baseArticle : rule.sourceArticle;
  let missing: string;
  if (base === 'annual_eur_per_person') {
    missing =
      'lipsă datele: plafonul este exprimat în euro, iar aplicația nu stochează niciun curs BNR. '
      + 'Regula de conversie este HG 1/2016, Norme, Titlul IV, Cap. II, Secțiunea a 2-a, pct. 7 alin. (6) '
      + '— „cursul mediu comunicat de Banca Națională a României pentru anul în care s-a efectuat plata"; '
      + 'art. 9 alin. (3) lit. b) și alin. (4) CF indică însă cursul BNR de la data plății, cu excepția '
      + 'doar a cazurilor „prevăzute expres în prezentul cod", iar normele nu sunt „prezentul cod". '
      + 'Niciun text primar nu împacă cele două reguli, deci aplicația nu alege niciuna și nu fixează '
      + 'niciun curs: un curs scris în cod ar fi o regulă inventată.';
  } else if (base === 'annual_salary_expense') {
    missing =
      'lipsă datele: baza este „valoarea anuală a cheltuielilor efectuate cu salariile personalului", '
      + 'iar aplicația nu are niciun concept de pontaj sau de salarii. Lipsa datelor NU este dovada că '
      + 'contribuabilul nu are salariați, deci plafonul nu este declarat 0 — este nedeterminat.';
  } else {
    missing =
      'un agregat anual pe care această aplicație nu îl poate măsura; categoriile cu o astfel de bază '
      + 'sunt excluse din total, nu deduse cu o valoare ghicită.';
  }
  return `Plafonul se calculează pe baza „${base}” (${article}) — ${missing}`;
}

/** The record as it may enter the engine, with a per-expense cap applied to both money fields. */
function applyExpenseCap(e: Expense, percent: number): Expense {
  return {
    ...e,
    valoareFaraTva: capBaniCeiling(e.valoareFaraTva, percent),
    tva: capBaniCeiling(e.tva, percent),
  };
}

/**
 * Classify every expense that could reach the aggregate, and return the subset that may enter the
 * engine together with the reason every other one did not.
 *
 * The period and status filter here is deliberately the SAME one `selectYtd` applies
 * (`status === 'inregistrata'` and `inPeriod(expenseFiscalDate(e), …)`) — otherwise the count shown to
 * the user and the total the engine used would be counts of different record sets.
 *
 * `asOfDate` for the rule query is the expense's own fiscal date, `paid ?? date`: CF art. 68 alin. (4)
 * lit. b) attributes an expense to the year it was PAID, and the OUG 8/2026 letters bind only from
 * 2026-03-01, so the date decides which rule is in force for that expense. It is load-bearing, not
 * cosmetic — a PEPP contribution paid 2026-01-15 classifies differently from one paid 2026-03-15.
 */
export function selectDeductibleExpenses(
  data: AppData,
  asOfDate: string,
  rules: FiscalRule[],
  context: ExpenseClassificationContext = {},
): DeductibleExpenseSet {
  const fiscalYear = data.profile.fiscalYear;
  const empty: DeductibleExpenseSet = {
    records: [],
    lines: [],
    annualCapped: [],
    excluded: [],
    counts: { entered: 0, undetermined: 0, nonDeductible: 0, capUnresolved: 0, annualCapped: 0 },
    refusal: null,
  };

  // Checked ONCE for the whole set: where the law supplies no expense engine there is no category to
  // resolve, and classifying into nothing would produce a confident wrong number (defect B-29).
  const refusal = expenseEngineRefusal(context, rules, { taxYear: fiscalYear, asOfDate });
  if (refusal) return { ...empty, refusal };

  const records: Expense[] = [];
  const excluded: ExcludedExpenseRecord[] = [];
  const byCategory = new Map<ExpenseCategory, DeductibleExpenseLine>();
  const cappedByCategory = new Map<ExpenseCategory, AnnualCapLine>();
  const counts: DeductibleExpenseCounts = {
    entered: 0,
    undetermined: 0,
    nonDeductible: 0,
    capUnresolved: 0,
    annualCapped: 0,
  };

  for (const e of data.expenses) {
    const fiscalDate = expenseFiscalDate(e);
    if (e.status !== 'inregistrata' || !inPeriod(fiscalDate, asOfDate, fiscalYear)) continue;

    const c = classifyExpenseDeductibility(
      { category: e.category, context },
      rules,
      { taxYear: fiscalYear, asOfDate: fiscalDate },
    );

    if (c.status === 'refused') {
      // Defensive: the regime-level refusal was already checked above with the assembly's own
      // asOfDate, and a per-expense date could in principle fall outside the rule's window. Either
      // way the answer is the same — stop, do not compute.
      return { ...empty, refusal: c };
    }

    if (c.status === 'undetermined') {
      counts.undetermined += 1;
      excluded.push({
        id: e.id,
        category: c.category,
        reason: 'undetermined',
        ruleId: c.rule ? c.rule.ruleId : null,
        sourceArticle: c.rule ? c.rule.sourceArticle : null,
        detail: c.missingFact,
      });
      continue;
    }

    if (c.treatment === 'non_deductible') {
      counts.nonDeductible += 1;
      excluded.push({
        id: e.id,
        category: c.category,
        reason: 'non_deductible',
        ruleId: c.rule.ruleId,
        sourceArticle: c.rule.sourceArticle,
        detail: c.condition ?? `${c.rule.ruleId}: ${c.rule.sourceArticle}`,
      });
      continue;
    }

    // A `classified` result may legitimately carry no category: the art. 68 alin. (4) lit. a)
    // documentation condition disqualifies an expense whatever its category. But that rule is
    // `non_deductible` and is handled above, so a `deductible`/`capped` treatment with no category to
    // total it under is a rule-data error. It is reported, never summed into a synthetic bucket.
    const category = c.category;
    if (category === null) {
      counts.nonDeductible += 1;
      excluded.push({
        id: e.id,
        category: null,
        reason: 'non_deductible',
        ruleId: c.rule.ruleId,
        sourceArticle: c.rule.sourceArticle,
        detail:
          `Regula ${c.rule.ruleId} a returnat tratamentul „${c.treatment}” fără nicio categorie asociată; ` +
          'nu poate fi inclusă în niciun total pe categorie.',
      });
      continue;
    }

    if (c.treatment === 'capped') {
      const cap = c.cap;
      // A cap is applied to money only when its base is measurable. `expense_itself` is measurable on
      // the record; `art68_alin6_base` and `gross_income` are measurable by the ASSEMBLER, which has
      // the gross and the rest of the deductible set in hand (TASK 2c); anything else stays unresolved
      // and the expense is excluded with the missing datum named.
      const computableHere =
        cap !== undefined && cap.percent !== undefined && cap.base === 'expense_itself';
      const computableByAssembler =
        cap !== undefined &&
        cap.percent !== undefined &&
        (cap.base === 'art68_alin6_base' || cap.base === 'gross_income');
      if (!cap || (!computableHere && !computableByAssembler)) {
        counts.capUnresolved += 1;
        excluded.push({
          id: e.id,
          category: c.category,
          reason: 'cap_unresolved',
          ruleId: c.rule.ruleId,
          sourceArticle: c.rule.sourceArticle,
          detail: unresolvedCapDetail(cap, c.rule),
        });
        continue;
      }
      if (computableByAssembler) {
        // Held back, not dropped: the assembler strikes the ceiling in its second pass and adds back
        // what the ceiling allows. Counting it as `entered` here would claim a total the ceiling has not
        // yet bounded; counting it as `capUnresolved` would say the law is unmeasurable when it is not.
        counts.annualCapped += 1;
        const line = cappedByCategory.get(category) ?? {
          category,
          ruleId: c.rule.ruleId,
          sourceArticle: c.rule.sourceArticle,
          cap,
          count: 0,
          inclVat: lei(0),
          exclVat: lei(0),
          records: [] as Expense[],
          ...(c.conflict ? { conflict: c.conflict } : {}),
        };
        line.count += 1;
        line.inclVat = addBani(line.inclVat, addBani(e.valoareFaraTva, e.tva));
        line.exclVat = addBani(line.exclVat, e.valoareFaraTva);
        line.records.push(e);
        cappedByCategory.set(category, line);
        continue;
      }
      const capped = applyExpenseCap(e, cap.percent!);
      records.push(capped);
      counts.entered += 1;
      const line = byCategory.get(category) ?? {
        category,
        ruleId: c.rule.ruleId,
        sourceArticle: c.rule.sourceArticle,
        treatment: c.treatment,
        cap,
        count: 0,
        inclVat: lei(0),
        exclVat: lei(0),
      };
      line.count += 1;
      line.inclVat = addBani(line.inclVat, addBani(capped.valoareFaraTva, capped.tva));
      line.exclVat = addBani(line.exclVat, capped.valoareFaraTva);
      byCategory.set(category, line);
      continue;
    }

    records.push(e);
    counts.entered += 1;
    const line = byCategory.get(category) ?? {
      category,
      ruleId: c.rule.ruleId,
      sourceArticle: c.rule.sourceArticle,
      treatment: c.treatment,
      count: 0,
      inclVat: lei(0),
      exclVat: lei(0),
    };
    line.count += 1;
    line.inclVat = addBani(line.inclVat, addBani(e.valoareFaraTva, e.tva));
    line.exclVat = addBani(line.exclVat, e.valoareFaraTva);
    byCategory.set(category, line);
  }

  return {
    records,
    // Deterministic order, so the explanation of a total is the same text on every run.
    lines: [...byCategory.values()].sort((a, b) => a.category.localeCompare(b.category)),
    annualCapped: [...cappedByCategory.values()].sort((a, b) => a.category.localeCompare(b.category)),
    excluded,
    counts,
    refusal: null,
  };
}

/**
 * TASK 2c — the second pass: strike the annual ceilings and add back what they allow.
 *
 * This is a SINGLE two-pass, never an iteration. Art. 68 alin. (6) defines the protocol and burse
 * private base as „venitul brut și cheltuielile deductibile, altele decât cheltuielile pentru acordarea
 * de burse private și cheltuielile de protocol" — the two capped categories are removed from the base
 * ENTIRELY, so the base cannot move when their ceilings are struck. A fixed-point loop would be wrong:
 * it would search for a stability the statute already guarantees, and would let the two ceilings feed
 * back into each other, which is exactly what alin. (6) exists to prevent.
 *
 * The order inside the pass is forced, not chosen: the alin. (5) lit. q) ceiling is measured on the
 * gross, so it needs nothing; the alin. (6) base is measured after the other alin. (5) caps (the
 * post-cap reading, decision 4), so it needs lit. q)'s answer first.
 *
 * WHICH BASIS THE CEILING IS STRUCK ON — the decision, and it is load-bearing. The ceiling is an
 * ANNUAL one: art. 65 alin. (1) makes the fiscal year the calendar year, and art. 68 alin. (4) lit. b)
 * attributes an expense to the year it was paid. So the ceiling is struck on the annual quantity the
 * estimate runs on — the run-rate projection when one exists, the actuals when the model has none — and
 * that SAME annual ceiling also bounds the actuals-to-date figure, because a payment already made cannot
 * deduct more than the whole year is allowed to. Capping the YTD amount against a YTD base and letting
 * the projection scale the result would silently turn an annual statutory limit into a per-elapsed-months
 * limit; it happens to give the same projected number under a uniform run rate, but it reports a wrong
 * `basis.actual`, and it stops being the same as soon as the two measures stop scaling alike.
 */
/** One capped category together with the annual amount it claims — the two inputs of the second pass. */
interface CapClaim {
  line: AnnualCapLine;
  /** The category's own annual figure, produced by the projection model's rule, both measures. */
  claimed: MeasurePair;
}

function applyAnnualDeductibilityCaps(
  basis: AttributedEstimateBasis,
  claims: CapClaim[],
): { basis: AttributedEstimateBasis; adjustments: AnnualCapAdjustment[] } {
  if (claims.length === 0) return { basis, adjustments: [] };

  // Both operand sets are adjusted. `annual` is what the engine runs on; `actual` is what the basis
  // reports as the actuals it was derived from, and an annual ceiling bounds that too.
  let annual: EstimateAmounts =
    basis.kind === 'annual-projected' ? { ...basis.projected } : { ...basis.actual };
  let actual: EstimateAmounts = { ...basis.actual };

  const adjustments: AnnualCapAdjustment[] = [];
  // lit. q) as RECORDED and as ALLOWED. TASK 2d: the operative alin. (6) base subtracts the RECORDED
  // amount, so `profClaimed` is load-bearing arithmetic, not bookkeeping; `profAllowed` survives so the
  // post-cap reading can still be computed and shown as the alternative.
  const profAllowed = zeroPair();
  const profClaimed = zeroPair();

  // ── Pass A — the caps measured on the gross (art. 68 alin. (5) lit. q)).
  for (const { line, claimed } of claims) {
    if (line.cap.base !== 'gross_income') continue;
    const percent = line.cap.percent;
    if (percent === undefined) continue; // a euro amount on a lei base is rule-data error, never a guess
    const ceiling = zeroPair();
    const allowed = zeroPair();
    for (const m of MEASURES) {
      ceiling[m] = capBaniCeiling(nonNegativeBani(grossOf(annual, m)), percent);
      allowed[m] = minBani(claimed[m], ceiling[m]);
      annual = withDeductible(annual, m, addBani(deductibleOf(annual, m), allowed[m]));
      actual = withDeductible(actual, m, addBani(deductibleOf(actual, m), minBani(line[m], ceiling[m])));
      profAllowed[m] = addBani(profAllowed[m], allowed[m]);
      profClaimed[m] = addBani(profClaimed[m], line[m]);
    }
    adjustments.push({
      category: line.category,
      ruleId: line.ruleId,
      sourceArticle: line.sourceArticle,
      cap: line.cap,
      claimed,
      ceiling,
      allowed,
      ...(line.conflict ? { conflict: line.conflict } : {}),
    });
  }

  // ── Pass B — the art. 68 alin. (6) base, struck ONCE.
  // TASK 2d — the OPERATIVE reading is PRE-cap. alin. (6) says „venitul brut și cheltuielile deductibile,
  // altele decât…” and never says whether those cheltuieli deductibile are the amounts as RECORDED or as
  // left after the other alin. (5) ceilings have cut them: research 22 §6 found zero occurrences of
  // „protocol”, „ordinea” and „în ordine” in the whole norms chapter for Titlul IV Cap. II, so the order of
  // application is a genuine gap, not an oversight. The user's decision of 2026-10-09 chooses the
  // RECORDED reading: it subtracts more, so the base is smaller, so the allowance is smaller — it can
  // never understate the tax due. The post-cap reading is the more generous one; it is still computed,
  // travels on the adjustment as `baseAlt` / `ceilingAlt`, and is rendered to the user.
  //
  // The pass structure does not change. `annual`'s deductible total is, by construction, the records that
  // carry no annual ceiling plus what Pass A allowed in: burse private and protocol are absent from it,
  // which is precisely what alin. (6) asks for. The base is still struck ONCE, before Pass B, so neither
  // alin. (6) letter can move it and there is still no iteration.
  const base = zeroPair(); // operative — PRE-cap: lit. q) subtracted as RECORDED
  const baseAlt = zeroPair(); // alternative — POST-cap: lit. q) subtracted as ALLOWED
  const ceilingAlt = zeroPair();
  for (const m of MEASURES) {
    const postCap = nonNegativeBani(subBani(grossOf(annual, m), deductibleOf(annual, m)));
    baseAlt[m] = postCap;
    // Subtract the lit. q) excess Pass A disallowed, i.e. subtract the category as it was RECORDED.
    base[m] = nonNegativeBani(subBani(postCap, subBani(profClaimed[m], profAllowed[m])));
  }
  for (const { line, claimed } of claims) {
    if (line.cap.base !== 'art68_alin6_base') continue;
    const percent = line.cap.percent;
    if (percent === undefined) continue;
    const ceiling = zeroPair();
    const allowed = zeroPair();
    for (const m of MEASURES) {
      ceiling[m] = capBaniCeiling(base[m], percent);
      ceilingAlt[m] = capBaniCeiling(baseAlt[m], percent);
      allowed[m] = minBani(claimed[m], ceiling[m]);
      annual = withDeductible(annual, m, addBani(deductibleOf(annual, m), allowed[m]));
      actual = withDeductible(actual, m, addBani(deductibleOf(actual, m), minBani(line[m], ceiling[m])));
    }
    adjustments.push({
      category: line.category,
      ruleId: line.ruleId,
      sourceArticle: line.sourceArticle,
      cap: line.cap,
      claimed,
      ceiling,
      allowed,
      base,
      baseAlt,
      ceilingAlt,
      ...(line.conflict ? { conflict: line.conflict } : {}),
    });
  }

  const rebuilt: AttributedEstimateBasis =
    basis.kind === 'annual-projected'
      ? { ...basis, actual, projected: annual }
      : { ...basis, actual };
  return { basis: rebuilt, adjustments };
}

/**
 * The annual quantity a capped category claims, projected by the projection model's OWN rule rather
 * than re-derived here (the TASK 1 lesson: the run-rate rule lives in `projection.ts` and nowhere
 * else). Projecting the category's own records through `selectProjectionV1` gives exactly the model's
 * annual figure for that category, in both measures.
 */
function claimAnnualMeasure(
  data: AppData,
  asOfDate: string,
  line: AnnualCapLine,
  canProject: boolean,
): MeasurePair {
  if (!canProject) return { inclVat: line.inclVat, exclVat: line.exclVat };
  const p = selectProjectionV1({ ...data, expenses: line.records }, asOfDate);
  return { inclVat: p.annualProjected.expenses, exclVat: p.annualProjectedExclVat.expenseNet };
}

/** The sentence a refused estimate says out loud, naming the rule and the article behind it. */
export function estimateRefusalReason(refusal: RefusedExpense): string {
  return (
    `Calculul anual s-a oprit: regula ${refusal.rule.ruleId} (${refusal.rule.sourceArticle}) nu lasă niciun motor de cheltuieli pentru această activitate. ` +
    refusal.reason
  );
}

/**
 * What the estimate is built from: the deductible subset, the operands derived from it, and either the
 * basis the engine will run on or the refusal that stopped it.
 *
 * This is the assembler both consumers must call. It replaces the pair of raw `selectYtd` /
 * `selectProjectionV1` calls at each call site, because the subset has to be applied to the records
 * those selectors aggregate — and `selectProjectionV1` re-aggregates internally, so a subset applied to
 * one of the two would silently annualise a different record set than the one it reports as actual.
 */
export type EstimateOperands =
  | {
      kind: 'run';
      basis: AttributedEstimateBasis;
      amounts: EstimateAmounts;
      deductible: DeductibleExpenseSet;
      /** TASK 2c — the annual ceilings that were struck, each with the base it was struck on. */
      capAdjustments: AnnualCapAdjustment[];
    }
  | {
      kind: 'refused';
      basis: RefusedEstimateBasis;
      /** Already a `review_required` result: a refused engine must not be handed to `computeTaxEstimate`. */
      result: TaxEstimateResult;
      deductible: DeductibleExpenseSet;
      capAdjustments: AnnualCapAdjustment[];
    };

export function selectEstimateOperands(
  data: AppData,
  asOfDate: string,
  rules: FiscalRule[],
  context: ExpenseClassificationContext = {},
): EstimateOperands {
  const deductible = selectDeductibleExpenses(data, asOfDate, rules, context);

  if (deductible.refusal) {
    const reason = estimateRefusalReason(deductible.refusal);
    return {
      kind: 'refused',
      basis: { kind: 'refused', method: null, elapsedMonths: null, reason },
      result: { status: 'review_required', reason, lines: [] },
      deductible,
      capAdjustments: [],
    };
  }

  // Pass 1. The record set fed to both selectors deliberately EXCLUDES the categories held for an
  // annual ceiling: art. 68 alin. (6) removes burse private and protocol from its own base, so the base
  // must be struck on exactly this set. `selectProjectionV1` re-runs `selectYtd` internally, so both
  // selectors get the SAME object — a subset applied to only one of them is the Phase 10 drift class.
  const scoped: AppData = { ...data, expenses: deductible.records };
  const ytd = selectYtd(scoped, asOfDate);
  const projection = selectProjectionV1(scoped, asOfDate);
  const basisBeforeCaps = selectTaxEstimateBasis(projection, ytd);

  if (deductible.annualCapped.length === 0) {
    return {
      kind: 'run',
      basis: basisBeforeCaps,
      amounts: amountsForEstimate(basisBeforeCaps),
      deductible,
      capAdjustments: [],
    };
  }

  // Pass 2. The ceiling is struck on the annual quantity, and the annual quantity is the one the
  // estimate runs on — see `applyAnnualDeductibilityCaps` for why, and for what this decision pins.
  const canProject = basisBeforeCaps.kind === 'annual-projected';
  const claims: CapClaim[] = deductible.annualCapped.map((line) => ({
    line,
    claimed: claimAnnualMeasure(data, asOfDate, line, canProject),
  }));
  const { basis, adjustments } = applyAnnualDeductibilityCaps(basisBeforeCaps, claims);
  return { kind: 'run', basis, amounts: amountsForEstimate(basis), deductible, capAdjustments: adjustments };
}

/**
 * The engine’s result plus the basis that produced it. This is an intersection, not a new shape:
 * it stays assignable to `TaxEstimateResult`, so every consumer that does not care about the basis
 * keeps compiling and keeps reading exactly the fields it read before.
 */
export type TaxEstimateWithBasis = TaxEstimateResult & { basis: TaxEstimateBasis };

export function attachEstimateBasis(
  result: TaxEstimateResult,
  basis: TaxEstimateBasis,
): TaxEstimateWithBasis {
  return { ...result, basis };
}

/** The recorded basis, or `null` when this result never had one. */
export function estimateBasisOf(result: TaxEstimateResult): TaxEstimateBasis | null {
  const basis = (result as { basis?: TaxEstimateBasis }).basis;
  return basis ?? null;
}

/**
 * Normalise an estimate so a consumer can always read a basis. An unattributed result is labelled
 * `unknown` rather than being assumed projected or assumed actual — guessing here is how a label
 * ends up claiming more than the data supports.
 */
export function withEstimateBasis(result: TaxEstimateResult): TaxEstimateWithBasis {
  const basis = estimateBasisOf(result);
  if (basis !== null) return result as TaxEstimateWithBasis;
  return attachEstimateBasis(result, {
    kind: 'unknown',
    method: null,
    elapsedMonths: null,
    reason:
      'Baza acestei estimări nu a fost înregistrată; nu se poate afirma dacă valorile sunt reale sau proiectate.',
  });
}

/** A fractional month count in Romanian typography, without a spurious `.0`. */
export function formatElapsedMonths(months: number): string {
  const rounded = Math.round(months * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
}

/**
 * The wording rule. A run-rate projection is an assumption about the rest of the year, not a
 * forecast of fact, so the label names the assumption and states how many months it rests on.
 * `YTD` is only ever said when the numbers really are actuals-to-date.
 */
export function estimateBasisLabel(basis: TaxEstimateBasis | null | undefined): string {
  if (!basis || basis.kind === 'unknown') return 'Estimare impozit';
  if (basis.kind === 'refused') return 'Estimare blocată — revizuire necesară';
  if (basis.kind === 'actuals-only') return 'Înregistrat până acum (neannualizat)';
  return (
    'Estimare anuală pe rată de desfășurare (' +
    formatElapsedMonths(basis.elapsedMonths) +
    ' din 12 luni scurse)'
  );
}

/**
 * The short label for one figure. `YTD` is said only when the figure really is actuals-to-date, so
 * an annual run-rate figure can never be read as money already collected or paid.
 *
 * These three wording functions accept `undefined` as well as `null`: a result that never had a basis
 * attached (a hand-built fixture, the loading sentinel) is a real case, and the honest answer for it
 * is the neutral label — never a crash, and never a guess about actual vs projected.
 */
export function estimateFigureLabel(basis: TaxEstimateBasis | null | undefined): string {
  if (!basis || basis.kind === 'unknown') return 'Estimare impozit';
  if (basis.kind === 'refused') return 'Estimare impozit (calculată nu s-a făcut)';
  if (basis.kind === 'actuals-only') return 'Estimare impozit YTD';
  return 'Estimare impozit anuală (rată de desfășurare)';
}

/**
 * One sentence that states what the displayed amounts are. It must not imply more certainty than a
 * run-rate assumption carries: the projection is the rest of the year assumed to repeat the months
 * already recorded, and it moves as the year advances.
 */
export function estimateBasisExplanation(basis: TaxEstimateBasis | null | undefined): string {
  if (!basis || basis.kind === 'unknown') {
    return 'Baza acestei estimări nu este înregistrată, deci valorile nu pot fi prezentate nici ca realizate, nici ca proiectate.';
  }
  if (basis.kind === 'actuals-only') {
    return 'Valorile de mai jos sunt cele înregistrate până acum, neannualizate. ' + basis.reason;
  }
  if (basis.kind === 'refused') {
    return 'Calculul nu s-a făcut, deci nu există valori de afișat. ' + basis.reason;
  }
  return (
    'Valorile anuale sunt extrapolate din rata de desfășurare a lunilor înregistrate până acum ' +
    '(' + formatElapsedMonths(basis.elapsedMonths) + ' din 12). Nu sunt o previziune a cifrelor reale: ' +
    'se ajustează pe măsură ce anul fiscal avansează.'
  );
}
