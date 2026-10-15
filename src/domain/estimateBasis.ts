/**
 * Which quantity enters the tax engine, and what a consumer can tell about it.
 *
 * PG-5C (B-76) is the reason this module now says what it says. Task 1 had it feed the engine the
 * run-rate annualisation from `src/domain/projection.ts` whenever a run rate existed, and record
 * that choice on the result. That was a decision about labelling, and the label was honest — but the
 * number behind the label was one the law does not produce. CF art. 68 alin. (2) lit. a) measures
 * „sumele încasate”, alin. (4) lit. b) measures what was paid in the year, and art. 118 alin. (3)
 * deems income realised in a fraction of a year to **be** the annual income. Nothing grosses up.
 * So an October-2026 PFA with 25.000 lei of realised net income had an engine input of 50.000 lei at
 * mid-November, crossed the 12-SM floor that 50.000 lei had manufactured, and was shown a CAS of
 * 12.150 lei that art. 148 alin. (1) does not produce. D-PROJ-1 forbids that, and `research/26` §9
 * is the authority for forbidding it.
 *
 * The rule this module exists to enforce now:
 *
 * 1. **The engine is fed recorded actuals, always.** Receipts actually collected, expenses actually
 *    paid, measured as of a stated date. No multiplying, no dividing by months elapsed — not for a
 *    mid-year starter, not for a closed year, not at any point in an open one. A closed year is the
 *    same rule, not a special case: its actuals happen to be the whole year's.
 * 2. **A run-rate forecast may exist beside the estimate, and cannot reach it.** `selectProjectionV1`
 *    is still called, and its output still rides on the basis as `forecast`, because the chart and a
 *    labelled forecast are legitimate (D-PROJ-1 protects both). What is gone is the path from it to
 *    an operand. That is enforced by types, not by care: `EstimateAmounts` carries the date it was
 *    measured as of, and a forecast has no such date because it is not a measurement — so a forecast
 *    is not assignable to an operand and `amountsForEstimate` cannot return one.
 * 3. **The basis travels with the result.** `attachEstimateBasis` puts the basis on the engine’s
 *    `TaxEstimateResult` without the engine knowing this module exists, so every existing consumer
 *    keeps reading the same fields while a new one can ask what the numbers were measured on.
 *
 * No fiscal value, rate, parameter or rule lives here.
 */
// B-138 — the one cap sentence that was language rather than a legal conclusion. It interpolated
// `cap.base`, a machine enum, into a Romanian sentence, so the person read
// `Plafonul se calculează pe baza „annual_eur_per_person”`. The wording is keyed by the same code in the
// copy layer — the same shape B-55 used for `FiscalBase` in `domain/thresholds.ts`.
import { capBaseSentence } from '../ui/copy/thresholds';
import type { UnconvertedRecord, YtdTotals } from './aggregation';
import { expenseFiscalDate, inPeriod, revenueFiscalDate, selectYtd } from './aggregation';
import type { AppData, Expense } from '../data/types';
import {
  classifyExpenseDeductibility,
  expenseEngineRefusal,
  capAmount,
  vehicleExpenseResolver,
  type DeductibilityCap,
  type ActivityFamily,
  type ExpenseCategory,
  type ExpenseClassificationContext,
  type RefusedExpense,
  type DeductibilityTreatment,
} from './fiscal/deductibility';
import type { FiscalRule } from './fiscal/rules';
import { selectApplicableRules } from './fiscal/select';
// B-93 — the depreciation schedule reaches the estimate through the one seam the engine already uses.
// This module does not compute any amortisation: it asks `depreciation.ts` for the year's figure per asset
// and decides, here, whether that figure may join the expense leg at all. The reconciliation lives on this
// side because it is a question about `Expense` rows, and `depreciation.ts` has never read one.
import {
  depreciationForFiscalYear,
  FISCAL_DEPRECIATION_RULE_ID,
  type AssetDepreciationDisposal,
  type AssetDepreciationRefusal,
  type AssetDepreciationYear,
} from './fiscal/depreciation';
import { strikeCapCeiling, type CapCeilingStrike } from './fx/capCeiling';
// PG-6f (B-30) — the per-line input-VAT decision, and the two candidate expense bases D-VAT-2 keeps
// apart. The assembler does not decide anything about VAT here: it runs the one decision function over
// the SAME normalised ledger pass every other operand comes from, and hands the result to the engine.
// A second traversal, or a second place deciding deductibility, would be the B-70 defect class.
import {
  applyVatToExpenseBase,
  decideInputVat,
  registrationChargesVat,
  type ExpenseBaseWithVat,
  type InputVatDecision,
} from './fiscal/vat';
import {
  normaliseLedgerToRon,
  normaliseStoredLedger,
  recordedRateProvider,
  type LedgerConversion,
  type UnconvertedLedgerRecord,
} from './fx/ledger';
import { addBani, applyRateDecimal, formatBani, isRon, lei, leiText, money, requireRon, subBani, sumBani, type Bani, type CurrencyCode, type Money } from './money';
// PG-6h-2 — the accommodation title is resolved in `domain/models.ts`, the one place the art. 83 alin. (4)
// boundary is read. This module threads the answer; it does not compare the count.
// B-105 adds the lease-facts reader from the same module, for the same reason: the regime split is decided
// once, in one place, and this module threads it.
import {
  accommodationIncomeTitleForYear,
  art84x1WithholdingBlocked,
  cassLadderForYear,
  leaseFactsForYear,
} from './models';
// B-112 stage 1 — the DPI category vocabulary, imported from the one layer that owns it (B-70: a vocabulary
// spelled twice drifts). `dpiQuotaPercentOf` reads the 40 % out of the rule rather than restating it here.
import { dpiRecordConflict, isDpiIncome } from './dpi';
import { dpiQuotaPercentOf } from './fiscal/dpi2026';
// B-105 — the two ordinary-rent regimes convert at two different anchors, so the gross they measure has to
// be struck through the FX boundary that already exists: `convertToRon` over `recordedRateProvider(data)`.
// This module does not touch `domain/fx/` internals and does not write a second rate lookup — it names the
// anchor the article asks for and lets the existing converter answer it.
import { convertToRon, type ConversionAnchor, type ProvisionalRateEvidence } from './fx/convert';
import type { FxRateProvider } from './fx/provider';
import { selectProjectionV1, type ProjectionV1 } from './projection';
import {
  evaluateScenarios,
  scenarioFixHref,
  scenarioGaps,
  scenarioRefusal,
  type AccommodationOpenQuestions,
  type ScenarioOutcome,
} from './scenarios';
import type { TaxEstimateResult } from './tax';
import Decimal from 'decimal.js-light';

/**
 * The four money operands `computeTaxEstimate` takes (`tax.ts` `TaxCalculationInput`), plus the date
 * they were measured as of.
 *
 * `asOfDate` is not decoration and it is not a display field bolted on afterwards. It is what makes
 * the type refuse a forecast. A measured quantity has a measurement date; a run-rate projection has
 * none, because nothing was measured — the rest of the year was assumed. So `ForecastAmounts` below
 * deliberately lacks this property, and TypeScript then makes "feed the engine a projected operand"
 * a compile error rather than a code-review finding. `amountsForEstimate` is the only exported path
 * from a basis to an operand, and the only thing it can return is `basis.actual`.
 *
 * D-PROJ-1 asks for the hero to be "labelled with the date it is measured as of". Carrying the date
 * in the operand is what stops that promise from being a caption that can drift away from the figure.
 */
export interface EstimateAmounts {
  revenues: Bani;
  expenses: Bani;
  revenuesNet: Bani;
  expensesNet: Bani;
  readonly asOfDate: string;
  /**
   * PG-6h-1 — CF art. 68^3 alin. (2): the gross of an accommodation register, cash basis, already
   * converted to lei at the per-collection BNR rate (alin. (4)). Present only when the profile declares
   * the accommodation activity family AND the selected rule set carries the art. 68^3 method rule for
   * this fiscal year — the two conditions `selectIncomeDeterminationMethod` checks together.
   *
   * It is a GROSS and it sits beside, not inside, `revenues`: art. 68^3 alin. (2) replaces the
   * register's expenses with a flat ratio, so these receipts must not travel through the art. 68 alin.
   * (4) deductible subset that art. 68 alin. (1) expressly excepts for this activity. Optional, and
   * `ForecastAmounts` has no such field — the same `asOfDate` gap that keeps a projection out of the
   * engine keeps a projected gross out of it too.
   */
  flatRatioGross?: Bani;
  /**
   * B-88 — WHICH flat-ratio method this gross is the gross of, and therefore which rule the engine must
   * apply to it.
   *
   * It travels with `flatRatioGross` because the number alone cannot say it. art. 68^3 alin. (2) and
   * art. 85 alin. (2) both take 30 % of a gross, so a bare gross handed to the engine is ambiguous, and
   * the two articles send the resulting net to different places: art. 68^3 is art. 155 alin. (1) lit. b)
   * and is measured under art. 170 alin. (1) (capped at 72 SM), while art. 85 is lit. e) and feeds the
   * cumul at art. 170 alin. (4) lit. c), where the base is the rung. The engine is not entitled to decide
   * which article applies — `selectIncomeDeterminationMethod` decided it once, from facts the person
   * declared — so the decision is attached here rather than re-derived downstream.
   */
  flatRatioMethod?: IncomeDeterminationMethod;
  /**
   * B-105 — whether art. 84^1 alin. (8) switches the withholding off for this register.
   *
   * alin. (8) is an exception to alin. (3)-(6): where the gross is paid **exclusively in kind**, or a
   * **contractual guarantee is applied to the rent**, the payer does not withhold, and the owner determines
   * the net, computes the tax and files the Declarația Unică up to the art. 122 alin. (3) term. The
   * arithmetic is the same 20 % and the same 10 %; what changes is whose obligation the tax is, and whether
   * a return is owed for it. It travels beside `flatRatioMethod` for the same reason that field does: the
   * assembler read the declared facts once, and the engine is not entitled to read them again.
   */
  flatRatioWithholdingBlocked?: boolean;
  /**
   * B-147 / B-150 — the gross of the RECORDED art. 70 receipts, already cut by the art. 72 alin. (3) flag.
   *
   * They sit beside `revenues`, never inside them, for the reason B-112 stage 1 gave: an art. 70 receipt is
   * not art. 67 income and must not run through the art. 68 sistem-real engine. What was missing was not the
   * exclusion but the quantity that survives it — the statute measures DPI on a gross and fixes the net by a
   * quota, so a gross has to reach the rule that states the quota. `selectYtd` struck the cut; these two
   * fields carry it here so the engine never re-reads a record.
   *
   * `dpiQuotaGross` takes the 40 % quota of art. 72 alin. (2) / art. 72¹ alin. (1). `dpiExcludedGross` is the
   * art. 72 alin. (3) / art. 72¹ alin. (2) set — moștenitori, drept de suită, copia privată — which gets no
   * quota at all and is outside CAS. Absent when the register holds no DPI receipt, which is every payload
   * written before B-112.
   */
  dpiQuotaGross?: Bani;
  dpiExcludedGross?: Bani;
}

/**
 * The same four quantities produced by a run rate instead of by a register.
 *
 * Structurally identical to `EstimateAmounts` except for the missing `asOfDate`, and that single
 * omission is the whole enforcement: this type is not assignable to an engine operand, so no call
 * site can hand a projection to `computeTaxEstimate` or to a threshold base without a cast.
 */
export interface ForecastAmounts {
  revenues: Bani;
  expenses: Bani;
  revenuesNet: Bani;
  expensesNet: Bani;
  /**
   * The model's own net (`annualProjected.net`), carried rather than re-subtracted at the surface: a
   * page doing `Bani` arithmetic is how a second, slightly different net reaches the screen.
   */
  net: Bani;
}

/**
 * The run-rate forecast that may sit beside an estimate.
 *
 * It is a real output of a real model and nothing here hides it: the chart draws its monthly series
 * and the dashboard may show it, labelled as a forecast. What it is not allowed to be is a fiscal
 * figure. `method` is carried so a surface can never present a forecast without naming how it was
 * made, and `elapsedMonths` / `activeMonths` are carried so the sentence beside it names the same
 * window the arithmetic used (the B-72 lesson).
 */
export interface RunRateForecast {
  method: 'run-rate-v1';
  elapsedMonths: number;
  activeMonths: number;
  amounts: ForecastAmounts;
}

/**
 * What fed the engine, in the data rather than in the wording.
 *
 * - `recorded-actuals` — the engine ran on what was actually collected and actually paid, as of
 *   `asOfDate`. This is the only kind a computed estimate can have. It replaced the two kinds PG-5C
 *   removed (`annual-projected` and `actuals-only`): once the engine is fed actuals in both cases,
 *   the distinction between them was a distinction about a forecast, not about the figure.
 * - `refused` — the engine was never reached: the law supplies no expense engine for this activity
 *   (art. 68^3). No amounts are recorded because none were computed.
 * - `unknown` - an estimate that arrived without a recorded basis (a hand-built result, the
 *   loading sentinel). Nothing may be claimed about actual vs projected.
 */
export type TaxEstimateBasis =
  | {
      kind: 'recorded-actuals';
      method: null;
      /** The date the amounts were measured as of — the same date the hero names. */
      asOfDate: string;
      /**
       * True when `asOfDate` is past 31 Dec of the fiscal year, so these actuals are the whole
       * year's and the figure is final. Read off the projection model, not re-derived here.
       */
      closed: boolean;
      /**
       * The length of the period the PFA was actually open for inside this fiscal year, read straight
       * off the model (`projection.activeMonths`). It changes no arithmetic — the figure is the same
       * with or without it. It exists so a surface can say over what window the register runs, and so
       * the forecast beside the figure can name the window that forecast assumed (the B-72 lesson:
       * a sentence describing the calendar year next to a number computed over three months).
       *
       * Optional because a basis can arrive from elsewhere (a hand-built fixture, an older result)
       * and a wording layer may not invent an active period it was never given.
       */
      activeMonths?: number;
      actual: EstimateAmounts;
      /**
       * The run-rate forecast, present only when the model has months left to project into. It is
       * output for display, never an input: `ForecastAmounts` is not assignable to `EstimateAmounts`,
       * so nothing downstream of this field can reach the engine or a threshold base.
       */
      forecast?: RunRateForecast;
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
      /**
       * PG-6a — which scenario stopped the calculation, with the copy key that frames it and the route
       * that fixes it. The reason alone used to be all a refusal could offer, which left the user with
       * a sentence and nowhere to act on it.
       */
      scenario: ScenarioOutcome;
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

/**
 * The operands, read off `YtdTotals` in one place and stamped with the date they were read at.
 *
 * This is the only way an `EstimateAmounts` gets made. That is deliberate: the `asOfDate` requirement
 * is what makes "a projection, used as if it were a measurement" unrepresentable, and a constructor
 * that cannot be called without a measurement date is what enforces it.
 */
export function actualEstimateAmounts(ytd: YtdTotals, asOfDate: string): EstimateAmounts {
  return {
    revenues: ytd.revenue,
    expenses: ytd.expenses,
    revenuesNet: ytd.revenueNet,
    expensesNet: ytd.expenseNet,
    asOfDate,
  };
}

/**
 * Build the basis the engine will run on.
 *
 * There is no decision left to make here about *which* quantity enters the engine — that is the
 * PG-5C finding, and it is why this function no longer branches. The engine is fed `actual`. The
 * projection is still read, for two things it is genuinely good at: telling us whether the fiscal
 * year is closed, and producing the forecast that may sit beside the figure.
 *
 * The forecast is attached only when it would actually be a forecast. Once the as-of date reaches the
 * end of the active period the model's own elapsed measure equals its horizon, the "projection" is
 * arithmetically the actuals again, and presenting it as a forecast would be presenting the same
 * number twice under two labels.
 */
export function selectTaxEstimateBasis(
  projection: ProjectionV1,
  ytd: YtdTotals,
  asOfDate: string,
): AttributedEstimateBasis {
  const actual = actualEstimateAmounts(ytd, asOfDate);
  const elapsedMonths = projection.elapsedMonths;
  // B-72: read, never recomputed. The wording layer is allowed to say how long the active period was
  // because the model already measured it; duplicating that measure here is how a label and a figure
  // start disagreeing.
  const activeMonths = projection.activeMonths;

  const canForecast =
    !projection.closed &&
    Number.isFinite(elapsedMonths) &&
    elapsedMonths > 0 &&
    Number.isFinite(activeMonths) &&
    activeMonths > elapsedMonths;

  const basis: AttributedEstimateBasis = {
    kind: 'recorded-actuals',
    method: null,
    asOfDate,
    closed: projection.closed,
    activeMonths,
    actual,
  };
  if (!canForecast) return basis;
  return {
    ...basis,
    forecast: {
      method: projection.method,
      elapsedMonths,
      activeMonths,
      amounts: {
        revenues: projection.annualProjected.revenue,
        expenses: projection.annualProjected.expenses,
        revenuesNet: projection.annualProjectedExclVat.revenueNet,
        expensesNet: projection.annualProjectedExclVat.expenseNet,
        net: projection.annualProjected.net,
      },
    },
  };
}

/**
 * The operands to hand to `computeTaxEstimate` for this basis.
 *
 * One branch, and it is not a choice: `basis.actual`. The return type is what carries the guarantee —
 * a basis's `forecast.amounts` is a `ForecastAmounts`, which has no `asOfDate` and therefore is not
 * an `EstimateAmounts`, so the expression that used to live here
 * (`basis.kind === 'annual-projected' ? basis.projected : basis.actual`) no longer type-checks.
 */
export function amountsForEstimate(basis: AttributedEstimateBasis): EstimateAmounts {
  return basis.actual;
}

/**
 * PG-6h-1 — which determination method the law applies to this register's income.
 *
 * This is a SELECTION, not a classification the app performs. The two inputs are (a) a fact the person
 * declared — `profile.activityFamily`, asked and stored by PG-6b and never inferred from a CAEN code —
 * and (b) whether the rule set selected for this fiscal year actually carries the art. 68^3 method rule.
 * Both are read; neither is decided here.
 *
 * The second condition is the year-scoping guard. The FY2027 minimum wage is not published and no 2027
 * release exists, so a 2027 profile has no art. 68^3 rule to run and must not be measured with 2026
 * percentages. `sistem-real` in that case does not mean "the 2026 rules apply instead" — the engine
 * refuses for the year as a whole; it means this module does not manufacture a method the rule set does
 * not contain.
 */
export type IncomeDeterminationMethod =
  | 'sistem-real'
  | 'accommodation-flat-ratio'
  | 'short-term-rooms-art85'
  // B-105 — the two ordinary *cedarea folosinței bunurilor* regimes. They join this union rather than
  // borrowing one of the three above because the whole point of the union is that it names WHICH article
  // measures this register, and these two articles differ from each other and from art. 85 in the gross
  // rule, the FX rule, who computes the tax and whether a Declarația Unică is owed for it.
  | 'cedare-art84'
  | 'cedare-art84x1';

/**
 * B-85 — the method is singular, and that is the contract, not an implementation detail.
 *
 * One profile-year gets exactly one of these two answers, and the engine runs one leg accordingly
 * (`tax.ts` builds its leg list from the operand this selection attaches). The app cannot widen that to
 * "part of this register is determined one way and part another way", because a `Revenue` record carries
 * no category, no activity marker and no source — `tip` is 'factura' | 'notafactura', a document type — so
 * there is nothing to partition on. A year that genuinely mixes accommodation income under art. 68^3 with
 * art. 68 sistem-real income is therefore not a year this build can determine: it is refused by
 * `scenarios.ts accommodation-method-attribution-missing`, which names the missing attribution. Splitting
 * by percentage, tagging records the person never tagged, or assuming a `cazare` register is wholly
 * accommodation are all rejected — the last one silently reclassifies a mixed year between fiscal titles.
 */

export function selectIncomeDeterminationMethod(
  data: AppData,
  rules: readonly FiscalRule[],
  asOfDate: string,
  declaredFamily?: ActivityFamily,
): IncomeDeterminationMethod {
  const profile = data.profile;
  // The SAME precedence `selectDeductibleExpenses` uses for the classification context: an explicitly
  // supplied family wins over the stored one, and absence stays absence. One precedence rule stated once —
  // two different rules would let the determination method and the classifier be about two different
  // activities from the same call.
  const family = declaredFamily ?? profile?.activityFamily;
  if (!profile) return 'sistem-real';
  const applicable = selectApplicableRules([...rules], {
    taxYear: profile.fiscalYear,
    asOfDate,
  });
  // ── B-105 — the two ordinary *cedarea folosinței bunurilor* regimes ─────────────────────
  //
  // This branch had to move, and the move is the interesting part of the task. Until now the whole function
  // sat behind `family !== 'cazare' → sistem-real`, which was right when the only non-sistem-real method in
  // the app was an accommodation one. The ordinary rent regimes are the first methods this app has that
  // belong to a NON-cazare register — a long-term landlord is not a cazare operator — so a guard that sends
  // every non-cazare register straight to sistem-real makes them unreachable. The guard now selects the path
  // instead of ending the question, and what it does NOT change is the invariant it used to enforce by
  // accident: a register whose family is not cazare still cannot select an accommodation method.
  //
  // **The fact that splits the two regimes is the tenant, not the landlord.** art. 84 alin. (1) opens „altele
  // decât veniturile plătite de persoane juridice sau alte entități care au obligația de a conduce evidență
  // contabilă”, and art. 84^1 takes that same population and gives it a withholding regime. So a natural-
  // person tenant leaves the income under art. 84 and a corporate tenant moves it to art. 84^1 — where the
  // net is fixed „la fiecare plată” (alin. (3)) instead of once for the fiscal year, the tax is withheld and
  // FINAL (alin. (5)-(6)), the FX anchor is the day before the payment (alin. (2)), and the landlord owes no
  // Declarația Unică for the income tax (art. 122 alin. (6) lit. a)) while still owing one for the
  // contributions (art. 122 alin. (7), because art. 174^1 alin. (3) withholds CASS only on DPI, arendă and
  // asocieri).
  //
  // Nothing here infers the tenant's legal nature from a CUI on a receipt, from the tenant's name, or from
  // anything else in the register: `leaseFactsForYear` returns what the person declared, and an undeclared
  // tenant fact leaves the register on the sistem-real path with the missing fact reported.
  if (family !== 'cazare') {
    const leaseYear = leaseFactsForYear(profile.leaseFactsYears, profile.fiscalYear);
    if (leaseYear?.tenantNature === 'entitate_cu_evidenta_contabila') {
      // The year-scoping guard: a fiscal year whose rule set does not carry the art. 84^1 rule has nothing to
      // be measured under, and this module does not manufacture a method the rule set lacks.
      if (applicable.some((r) => r.taxRegime === 'cedare-art84x1-withheld')) return 'cedare-art84x1';
    }
    if (leaseYear?.tenantNature === 'persoana_fizica') {
      if (applicable.some((r) => r.taxRegime === 'cedare-art84-flat-ratio')) return 'cedare-art84';
    }
    return 'sistem-real';
  }
  // ── A cazare register: the room count decides which flat article, if any, measures it ───────
  //
  // B-88 — the room count decides the TITLE, and the title decides which flat rule, if any, measures this
  // register. The comparison is not written here: `domain/models.ts accommodationIncomeTitleForYear` is the
  // single place the art. 83 alin. (4) boundary is read, and it is the same resolver `scenarios.ts` and the
  // Settings form read, so the method, the refusal and the screen cannot state three different titles for
  // one payload. `null` — no count recorded for this year — asserts nothing and falls through to the
  // art. 68^3 question exactly as it did before any art. 85 rule existed.
  const title = accommodationIncomeTitleForYear(profile.accommodationRoomCounts, profile.fiscalYear);
  if (title === 'cedarea_folosintei') {
    // art. 85 alin. (1) excludes „cei care realizează venituri din activități independente pentru care sunt
    // aplicabile prevederile art. 68^3”, so a person who has ANSWERED that they are a tourism-sector
    // operator is under art. 68^3 even with 3 rooms — the room count does not save them. The answer is the
    // person's own statement (`accommodationTourismEligibility`), never something read off a CAEN code, and
    // absence of an answer does not establish the exclusion: what stands then is the title the count gives.
    //
    // Whether a PFA may hold this income at all is INFERENCE, not statute — research/44 §5 and Gaps-3
    // record that no statutory sentence says so; the answer is textual inference (art. 83 alin. (1^1),
    // art. 83 alin. (4), art. 85 alin. (1)) plus ANAF practice. A PFA whose declared family is NOT cazare
    // never reaches this branch, because the app holds one register and one declared family and cannot
    // attribute part of a register to a second income category (B-89).
    if (
      profile.accommodationTourismEligibility !== 'da' &&
      applicable.some((r) => r.taxRegime === 'short-term-rooms-flat-ratio')
    ) {
      return 'short-term-rooms-art85';
    }
  }
  // The two ordinary *cedarea folosinței bunurilor* regimes are selected ABOVE, before this branch: they
  // belong to a NON-cazare register, so a guard that sent every non-cazare register straight to sistem-real
  // would have made them unreachable. A cazare register that is not the 1–7 room case is the art. 68^3
  // question, exactly as it was before B-105.
  return applicable.some((r) => r.taxRegime === 'accommodation-flat-ratio')
    ? 'accommodation-flat-ratio'
    : 'sistem-real';
}

/**
 * The gross the flat ratio runs on: the register's receipts, cash basis, in lei.
 *
 * art. 68^3 alin. (2) measures „încasate în cursul anului fiscal”, and alin. (4) converts each foreign
 * receipt at the BNR rate of the last banking day before that collection. Both are already the rule the
 * Phase 10c ledger pass implements (`fx/ledger.ts`, basis `payment_date_daily` with the labelled
 * carry-forward from the last published banking day), so this reuses that pass rather than writing a
 * second FX walk — a second walk is the B-70 defect class and would drift from the first the moment
 * either changes.
 *
 * The VAT rule is the sistem-real one, for the same reason: OMFP 3254/2017 art. 4 alin. (3) says TVA
 * colectată nu reprezintă venit, so a VAT payer's gross is the VAT-exclusive amount and a
 * VAT-exempt profile's is the amount actually received.
 *
 * What this does NOT decide is what the gross CONTAINS. art. 68^3 alin. (3) may or may not exclude a
 * platform commission from it (B-80), and no primary source settles that. This function reports the
 * receipts; the caller that cannot settle alin. (3) must refuse rather than pick.
 */
export function selectAccommodationGross(
  data: AppData,
  asOfDate: string,
): { gross: Bani | null; conversions: LedgerConversion[]; unconverted: UnconvertedLedgerRecord[] } {
  const ledger = normaliseStoredLedger(data);
  const ytd = selectYtd(ledger.data, asOfDate);
  return {
    gross: flatRatioGrossFromYtd(ytd, data),
    conversions: ledger.conversions,
    unconverted: ledger.unconverted,
  };
}

/**
 * The one VAT rule, shared by the standalone selector above and by the assembler below.
 *
 * PG-6f (B-30): it used to read `profile.vatExempt`. It now reads the declared registration state, and
 * returns **null** when none is declared — the measure of an art. 68^3 gross is the same open question as
 * the measure of the sistem-real gross, and picking one silently would mint a gross the person may never
 * have collected in that measure.
 */
function flatRatioGrossFromYtd(ytd: YtdTotals, data: AppData): Bani | null {
  const registration = data.profile.vatRegistration;
  if (!registration) return null;
  // A person who charges TVA has that TVA excluded from the income measure (art. 286/292 with art. 310
  // alin. (10) lit. b) for the other side), so the gross the art. 68^3 rule measures is the VAT-
  // EXCLUSIVE one. A person in the scutire keeps the VAT in, because they may not show it and may not
  // claim it back.
  return registrationChargesVat(registration.status) ? ytd.revenueNet : ytd.revenue;
}

/**
 * B-105 — the gross the two ordinary *cedarea folosinței bunurilor* regimes run on.
 *
 * **This function exists because one gross path would make two of the three rent regimes wrong.** art. 84,
 * art. 84^1 and art. 85 each answer „when is income income” differently, and each converts at a different
 * date. The three totals agree at 31 December and differ on every other day of the year, which is why a
 * shared path would survive a casual review and be wrong in production:
 *
 * | regime | which records count | FX anchor |
 * |---|---|---|
 * | art. 84   | the rent for the fiscal year, „indiferent de momentul încasării” (alin. (1)-(2)) | **curs mediu anual** din anul realizării (alin. (3^1)) |
 * | art. 84^1 | per payment, net fixed „la fiecare plată” (alin. (3)) | **cursul din ziua precedentă plății** (alin. (2)) |
 * | art. 85   | „încasate în cursul anului fiscal” (alin. (2)) — the ledger pass, not this function | ultima zi bancară anterioară încasării (alin. (4)) |
 *
 * The FX is done through the boundary that already exists — `convertToRon` over `recordedRateProvider(data)`.
 * This module names the ANCHOR each article asks for and lets the existing converter resolve the rate; it
 * does not touch `domain/fx/` internals, does not write a second rate lookup, and never averages or
 * interpolates (the converter refuses when it has no rate, and that refusal is reported here rather than
 * papered over).
 *
 * What the app cannot do is measure art. 84's accrual gross from nothing: it has no contract-period field,
 * so the accrual measure it can build is the rent DOCUMENTED for the year (document date, not collection
 * date) — unless the person declared the contract rent themselves, which is the legal measure and wins.
 * Where a declared contract rent and the register's documents disagree, this refuses rather than picking a
 * winner: two producers for one figure is the defect class this project keeps paying for.
 */
export interface CedareGross {
  gross: Bani | null;
  /** Why no gross could be struck. Reported, never guessed, and never replaced by a default. */
  detail?: string;
  /**
   * B-144 — every provisional rate this gross was measured with, one entry per distinct rate.
   *
   * art. 84 measures the rent at the BNR average of the year the income is realised, and for a year that
   * has not closed that average is a stand-in the user recorded. The lei gross that comes out of it is what
   * the threshold rows on the Dashboard are measured against — `data/dashboard.ts` passes this same estimate
   * into `getThresholdStatuses` — so a provisional rate here does not merely move a deduction, it can move
   * which tier a person lands in. That is the case the five-point note has to reach, and it has to reach it
   * with the rate that was actually used rather than one a surface re-read from the store.
   */
  provisionalAnnualAverage?: ProvisionalRateEvidence[];
}

/**
 * The calendar day before an ISO date, in the same fixed-width form.
 *
 * art. 84^1 alin. (2) asks for „cursul de schimb comunicat de Banca Națională a României din ziua
 * precedentă celei în care se efectuează plata”, so the anchor is a day, not the payment itself. The
 * arithmetic is done on UTC instants at midnight and re-read as a UTC calendar date, which is what makes
 * the subtraction safe across a DST boundary — a local-time subtraction would land on the wrong day twice a
 * year in Bucharest.
 */
function isoDayBefore(iso: string): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/** Convert one money field under one anchor, or say why it could not be converted. */
function convertUnderAnchor(
  amount: Money,
  anchor: ConversionAnchor,
  provider: FxRateProvider,
  context: string,
): { bani: Bani; provisional?: ProvisionalRateEvidence } | { detail: string } {
  if (isRon(amount)) return { bani: amount.amount };
  const outcome = convertToRon(amount, anchor, provider);
  if (outcome.ok) return { bani: outcome.ron.amount, provisional: outcome.provisionalEvidence };
  if (outcome.reason === 'unsupported_currency') {
    return {
      detail:
        `${context}: aplicația nu are o serie BNR pentru ${outcome.currency}, deci chiria nu poate fi ` +
        'exprimată în lei fără să ghicească un curs.',
    };
  }
  const anchorLabel =
    anchor.basis === 'payment_date_daily'
      ? `la data ${anchor.onDate}`
      : anchor.basis === 'payment_year_annual_average'
        ? `pentru anul ${anchor.paymentYear}`
        : `pentru anul ${anchor.incomeRealisationYear}`;
  return {
    detail:
      `${context}: conversia a eșuat (${anchorLabel}) — ${'detail' in outcome ? outcome.detail : 'fără detaliu'}. ` +
      'Regulile de conversie din Titlul IV cer un curs anume; aplicația nu calculează media din cursurile ' +
      'zilnice și nu ia un curs dintr-o altă zi ca să obțină un număr.',
  };
}

export function selectCedareGross(
  data: AppData,
  asOfDate: string,
  method: IncomeDeterminationMethod,
): CedareGross {
  const profile = data.profile;
  const fiscalYear = profile.fiscalYear;
  const leaseYear = leaseFactsForYear(profile.leaseFactsYears, fiscalYear);

  // The money measure is a registration fact, not a guess — the same rule `flatRatioGrossFromYtd` applies,
  // for the same reason (OMFP 3254/2017 art. 4 alin. (3): TVA colectată nu reprezintă venit).
  const registration = profile.vatRegistration;
  if (!registration) {
    return {
      gross: null,
      detail:
        'Starea de înregistrare în scopuri de TVA nu este declarată, deci aplicația nu știe ce măsură a ' +
        'chiriei să adune: una cu TVA-ul în venit pentru cel scutit potrivit art. 310, alta fără TVA colectată ' +
        'pentru cel înregistrat potrivit art. 316. Aplicația nu alege între ele.',
    };
  }
  const chargesVat = registrationChargesVat(registration.status);
  const provider = recordedRateProvider(data);

  // ── art. 84: the accrual measure ────────────────────────────────────────────────────────────
  if (method === 'cedare-art84') {
    const anchor: ConversionAnchor = {
      basis: 'income_realisation_year_annual_average',
      incomeRealisationYear: fiscalYear,
    };
    // The documents FOR the year, not the money received in it. `r.date` rather than `revenueFiscalDate(r)`
    // is the whole difference from art. 84^1 and art. 85, and it is deliberate: art. 84 alin. (2) measures
    // „pe baza chiriei prevăzute în contract … indiferent de momentul încasării chiriei”.
    const documents = data.revenues.filter(
      (r) => r.status === 'inregistrata' && inPeriod(r.date, asOfDate, fiscalYear),
    );
    let derived = lei(0);
    // B-144 — the provisional rates this pass actually used, keyed so one rate behind twelve documents is
    // named once. Read off the conversion outcome, never re-looked-up: a note that re-reads the store can
    // name a rate that is not the one behind the figure.
    const provisionalRates = new Map<string, ProvisionalRateEvidence>();
    const noteProvisional = (net: { bani: Bani; provisional?: ProvisionalRateEvidence }): void => {
      const evidence = net.provisional;
      if (evidence) provisionalRates.set(`${evidence.currency}|${evidence.rate}|${evidence.anchor}`, evidence);
    };
    for (const r of documents) {
      const net = convertUnderAnchor(r.valoareFaraTva, anchor, provider, `documentul ${r.nr} (${r.date})`);
      if ('detail' in net) return { gross: null, detail: net.detail };
      noteProvisional(net);
      let line = net.bani;
      if (!chargesVat) {
        const vat = convertUnderAnchor(r.tva, anchor, provider, `TVA-ul documentului ${r.nr} (${r.date})`);
        if ('detail' in vat) return { gross: null, detail: vat.detail };
        noteProvisional(vat);
        line = sumBani([line, vat.bani]);
      }
      derived = sumBani([derived, line]);
    }

    const declared = leaseYear?.contractRentAnnual;
    let rent: Bani;
    if (declared !== undefined) {
      if (documents.length > 0 && declared !== derived) {
        return {
          gross: null,
          detail:
            `Chiria pentru anul fiscal ${fiscalYear} are doi producători care nu cad de acord: persoana a ` +
            `declarat ${leiText(declared)} lei chirie prevăzută în contract, iar documentele înregistrate ` +
            `pentru acest an însumează ${leiText(derived)} lei. art. 84 alin. (2) măsoară chiria „prevăzută ` +
            'în contract”, deci aplicația nu alege între ele și nu completează diferența.',
        };
      }
      rent = declared;
    } else {
      rent = derived;
    }
    const uplift = leaseYear?.ownerCostsPaidByTenant ?? lei(0);
    // The uplift joins the GROSS, before the ratio — art. 84 alin. (1) last sentence „Venitul brut se
    // majorează cu…”. Deducting it after the 20 % would produce a different net, which is why it is added
    // here rather than passed to the calculator.
    //
    // B-144 — the provisional rates are reported only where the gross is the one the documents produced.
    // When the person declared the annual rent in lei, that declared figure IS the gross and no conversion
    // decided it; the documents were converted only to test whether the two producers agree. Naming their
    // rate as though it had measured the income would claim more than happened, which is the opposite error
    // from the silent one.
    const gross = sumBani([rent, uplift]);
    if (declared === undefined && provisionalRates.size > 0) {
      return { gross, provisionalAnnualAverage: [...provisionalRates.values()] };
    }
    return { gross };
  }

  // ── art. 84^1: the per-payment measure ───────────────────────────────────────────────────
  //
  // Note what changed from the branch above: the records are selected by the MONEY date, and the rate is
  // asked for the day BEFORE each payment. Both come from the article, and neither is interchangeable with
  // the art. 84 branch — reusing the accrual selection here is the trap research/46 §2 calls out, because
  // alin. (1) of art. 84^1 deliberately omits the annual clause art. 84 alin. (1) carries.
  const payments = data.revenues.filter(
    (r) => r.status === 'inregistrata' && inPeriod(revenueFiscalDate(r), asOfDate, fiscalYear),
  );
  let total = lei(0);
  for (const r of payments) {
    const paidOn = revenueFiscalDate(r);
    const anchor: ConversionAnchor = { basis: 'payment_date_daily', onDate: isoDayBefore(paidOn) };
    const net = convertUnderAnchor(
      r.valoareFaraTva,
      anchor,
      provider,
      `plata din ${paidOn} (cursul din ${isoDayBefore(paidOn)}, art. 84^1 alin. (2))`,
    );
    if ('detail' in net) return { gross: null, detail: net.detail };
    let line = net.bani;
    if (!chargesVat) {
      const vat = convertUnderAnchor(r.tva, anchor, provider, `TVA-ul plății din ${paidOn}`);
      if ('detail' in vat) return { gross: null, detail: vat.detail };
      line = sumBani([line, vat.bani]);
    }
    total = sumBani([total, line]);
  }
  const uplift = leaseYear?.ownerCostsPaidByTenant ?? lei(0);
  return { gross: sumBani([total, uplift]) };
}

/**
 * The open questions the art. 68^3 rule carries in its own parameters.
 *
 * Lifted, not written. The registry is not a wording layer and neither is this module: the two readings of
 * alin. (3) and the alin. (1) eligibility gate exist in exactly one place — `ACCOMMODATION_68X3_2026` —
 * and a refusal that paraphrases them creates a second text that can drift from the rule while still
 * quoting the same article.
 *
 * PG-6h-2 keyed the result by the rule's own parameter ids rather than returning them in positional order.
 * The registry now shows only the questions the person has not answered, and "drop the second element of
 * the array" is not the same instruction as "drop the gross-scope question" — the rule's parameter order
 * is not a contract anyone declared, and a silent swap would retire the wrong question.
 */
export function accommodationOpenQuestions(
  rules: readonly FiscalRule[],
  taxYear: number,
  asOfDate: string,
): AccommodationOpenQuestions {
  const empty: AccommodationOpenQuestions = { grossScope: null, eligibility: null };
  const rule = selectApplicableRules([...rules], { taxYear, asOfDate }).find(
    (r) => r.taxRegime === 'accommodation-flat-ratio',
  );
  if (!rule) return empty;
  const readParam = (id: string): string | null => {
    const value = rule.parameters.find((p) => p.id === id)?.value;
    return typeof value === 'string' && value.length > 0 ? value : null;
  };
  return {
    grossScope: readParam('gross_scope_open_question'),
    eligibility: readParam('eligibility_open_question'),
  };
}

/**
 * Attach the flat-ratio gross, and the method it is a gross for, to an operand set — or leave the set
 * exactly as it was.
 *
 * A separate function rather than an inline spread at each of the two `kind: 'run'` returns, because the
 * whole point of this module is that the operands are decided once. Two call sites attaching the field
 * independently is how one of them forgets. B-88 added the second field for the same reason: the gross and
 * the method must arrive together or the engine has a 30 % ratio and no way to know which article gave it.
 */
function withFlatRatioGross(
  amounts: EstimateAmounts,
  gross: Bani | undefined,
  method: IncomeDeterminationMethod,
  withholdingBlocked: boolean,
): EstimateAmounts {
  if (gross === undefined) return amounts;
  return {
    ...amounts,
    flatRatioGross: gross,
    flatRatioMethod: method,
    flatRatioWithholdingBlocked: withholdingBlocked,
  };
}

/**
 * B-147 — attach the recorded DPI gross, already cut by the art. 72 alin. (3) flag.
 *
 * Attached rather than defaulted, in the same shape as `withFlatRatioGross`: absent means the register holds
 * no DPI receipt, and the engine reads that as "no DPI source this year" rather than as a zero it invented.
 * A declared zero and an absent fact are different claims, and this app has been correcting that difference
 * all the way through.
 */
function withDpiGrosses(
  amounts: EstimateAmounts,
  quotaGross: Bani,
  excludedGross: Bani,
): EstimateAmounts {
  if (quotaGross === 0 && excludedGross === 0) return amounts;
  return { ...amounts, dpiQuotaGross: quotaGross, dpiExcludedGross: excludedGross };
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

/**
 * Why an expense did not reach the deductible total.
 *
 * `foreign_currency` is TASK 10a (B-32): the record is written in a currency the app can store but cannot
 * yet bring into a lei base, because doing so needs a BNR rate and a legal basis, and the assembler has
 * neither wired in yet (TASK 10b). It is NOT `cap_unresolved` — the deductibility of the expense is not
 * what is unresolved, the *unit* is — and it is not silently summed.
 */
export type ExcludedReason = 'undetermined' | 'non_deductible' | 'cap_unresolved' | 'foreign_currency';

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

// ── PG-1: one vocabulary for "this record did not reach the estimate" ─────────
//
// `ExcludedReason` already says why an EXPENSE left the deductible base, and the ledger disclosure
// (Phase 10c) already says why a FOREIGN record left the lei totals. PG-1 does not add a third
// account of the same records. It projects the two existing ones onto one surface, because the hero
// has to answer a question neither one answers alone: is every recorded record either included in the
// estimate or visibly, deliberately kept out of it?
//
// Two rules keep this from becoming a fork:
//
// 1. **One record, one reason.** A foreign-currency expense appears in BOTH `excluded` (as
//    `foreign_currency`) and the ledger disclosure. The ledger disclosure owns it here, and the
//    exclusion entry is skipped — so `missing_fx_rate` is produced by exactly one path, the one
//    Phase 10c's handoff asked for. No record can be counted twice under two names.
// 2. **Nothing is re-derived.** Every reason below is a projection of a decision the assembler or the
//    conversion pass already made. No classification, no rate lookup and no cap arithmetic happens
//    here.

/**
 * Why a recorded record is not in the estimate figure.
 *
 * `unclassified`, `undetermined`, `asset_not_modelled`, `cap_unresolved` and `missing_fx_rate` are
 * produced today. `rejected` and `pending` are declared but NOT produced: a record whose own status
 * says it is unsettled is already surfaced by the attention model (`data/attention.ts
 * recordAttentionItems`), with its own row badge and its own deep link — re-listing it here would put
 * one record on two surfaces in two vocabularies, which is the defect this section exists to avoid.
 * `fact_missing` is reserved for PG-6 (profile facts, not record facts).
 */
export type CoverageReason =
  | 'unclassified'
  | 'undetermined'
  | 'asset_not_modelled'
  | 'missing_fx_rate'
  | 'cap_unresolved'
  | 'non_deductible'
  | 'rejected'
  | 'pending'
  | 'fact_missing'
  /**
   * B-93 — the register computes a depreciation schedule for an asset **and** the taxpayer has recorded a
   * `depreciation_business_asset` expense by hand. Both routes reach the expense side of art. 68 alin. (4)
   * lit. d) for the same asset, and adding them would deduct the same depreciation twice.
   *
   * It is a gap and not an exclusion: nothing was settled here, a contradiction was left standing. It is
   * also not `asset_not_modelled` — that reason says the register is missing, and here the register is
   * present and a second, unverified figure is in the way.
   */
  | 'depreciation_conflict'
  /**
   * B-112 — the register holds art. 70 *drepturi de proprietate intelectuală* receipts, and the estimate does
   * not yet compute their contributions or their final tax, so they are outside the figure.
   *
   * This is the honest half of fixing B-112. The defect was never that the number was small; it was that the
   * number was small **and said nothing**. A DPI receipt that reaches the register and not the estimate must
   * make the estimate incomplete, not merely cheaper — otherwise the app has traded a silent omission for a
   * silent omission with a new field on it.
   *
   * It is not `asset_not_modelled` (that says the register is missing) and not `fact_missing` (the facts are
   * recorded; what is missing is the rule path that consumes them).
   */
  | 'dpi_income_not_modelled'
  /**
   * B-112 — the same DPI income reaches the app by two routes at once: DPI receipts in the register, and a
   * hand-declared `proprietateIntelectuala` net on the art. 170 alin. (4) ladder in Settings.
   *
   * `calcCassLadder` cumulates the category **once**, so counting both would select a higher rung of the
   * art. 170 alin. (3) ladder and bill CASS on money received once. This is B-93's `depreciation_conflict`
   * in a different coat: two producers of one fiscal quantity, where the app posts neither and names the two
   * inputs that disagree. It does not sum them, does not take the larger, and does not prefer one quietly.
   */
  | 'dpi_income_double_represented';

/**
 * The reasons that make an estimate INCOMPLETE, as opposed to merely exclusive.
 *
 * `non_deductible` is deliberately absent. A fine, a donation or a loan principal is out of the
 * deductible base because art. 68 alin. (7) says so — the app settled that record, it did not fail to
 * settle it. Counting a legal answer as a missing fact would hold the hero at „Estimare incompletă”
 * forever for a profile that has nothing left to fix.
 */
const GAP_REASONS: readonly CoverageReason[] = [
  'unclassified',
  'undetermined',
  'asset_not_modelled',
  'missing_fx_rate',
  'cap_unresolved',
  'fact_missing',
  'depreciation_conflict',
  // B-112 — both DPI reasons are gaps, not settled exclusions. The law has not answered anything about this
  // income; the app has not finished representing it. Counting either as `non_deductible`-like (a legal
  // answer) would let the hero read „Calculat” over a register with a whole income category missing from it.
  'dpi_income_not_modelled',
  'dpi_income_double_represented',
];

export function isGapReason(reason: CoverageReason): boolean {
  return GAP_REASONS.includes(reason);
}

/** One record kept out of the estimate, with the reason, the amount at stake and where to fix it. */
export interface EstimateCoverageGap {
  recordId: string;
  /**
   * `profile` is PG-6a: a scenario gap is a missing profile- or activity-level fact, not a record the
   * register holds. It is a third value rather than a record kind stretched to cover it, because
   * `recordId` on such a row is the scenario's own id and no register row answers to it.
   */
  kind: 'revenue' | 'expense' | 'profile';
  reason: CoverageReason;
  /**
   * The amount that left the estimate, in the minor units the record is written in (`Bani`, like every
   * stored amount). For a record with no recorded rate this is NOT a lei quantity — the app cannot
   * express it in lei, and that is the finding, not a rounding detail. `currency` travels with it for
   * that reason: an amount rendered without its unit is a number invented twice over.
   *
   * `null` for a `profile` gap: a fact the app does not hold has no amount at stake, and writing `0`
   * beside it would put a lei figure on the screen for a number that was never recorded.
   */
  amount: Bani | null;
  /** The unit `amount` is written in. `RON` for every exclusion the classifier produced. */
  currency: CurrencyCode;
  /** The route that lands on this record (`src/App.tsx parseRoute`: `/<page>#!/<tab>?f=<id>`). */
  fixTarget: string;
  /** The assembler's or the conversion pass's own sentence — never a paraphrase written here. */
  detail: string;
}

/**
 * Categories whose deductibility the law routes through depreciation, which this app cannot compute
 * because it holds no asset register (defect B-31). The rule is right that the purchase is not a
 * direct expense; what is missing is the amortisation side, and that is a different sentence.
 */
const ASSET_NOT_MODELLED: readonly ExpenseCategory[] = ['depreciable_asset_purchase'];

/**
 * Project an `ExcludedReason` onto the coverage vocabulary. Total, and it does not invent a reason: a
 * `non_deductible` record with no category is reported as `non_deductible`, an uncategorised record is
 * `unclassified` because no rule could be applied to it at all.
 */
export function coverageReasonForExclusion(x: ExcludedExpenseRecord): CoverageReason {
  switch (x.reason) {
    case 'foreign_currency':
      return 'missing_fx_rate';
    case 'cap_unresolved':
      return 'cap_unresolved';
    case 'non_deductible':
      return x.category !== null && ASSET_NOT_MODELLED.includes(x.category)
        ? 'asset_not_modelled'
        : 'non_deductible';
    case 'undetermined':
      return x.category === null ? 'unclassified' : 'undetermined';
  }
}

/**
 * The register route that holds the record, on the tab its own status selects, with the focus token
 * the page consumes to page to it. Same shape as `data/attention.ts recordTarget` — the tab is not
 * guessed, it is the status a record with a coverage gap necessarily carries (`inregistrata`).
 */export function estimateFixTarget(kind: 'revenue' | 'expense', recordId: string): string {
  const page = kind === 'revenue' ? 'revenues' : 'expenses';
  return `/${page}#!/registered?f=${encodeURIComponent(recordId)}`;
}

/**
 * The coverage gaps the assembler itself produced: every expense it classified and kept out, with the
 * amount that left the base and the rule's own reason.
 *
 * Foreign-currency exclusions are skipped on purpose — the ledger disclosure reports them, and it is
 * the wider list (revenues included) and the one the money surfaces already read. Reporting the same
 * record from both would double-count it in the hero's count and in the weighted percentage.
 *
 * This calls the SAME selector the estimate runs, on the SAME normalised ledger, so the reasons here
 * cannot disagree with the total the engine used. It is a repeat of one pass, not a second
 * implementation of one.
 */
export function selectEstimateCoverage(
  data: AppData,
  asOfDate: string,
  rules: FiscalRule[],
  context: ExpenseClassificationContext = {},
): EstimateCoverageGap[] {
  const ledger = normaliseStoredLedger(data);
  const set = selectDeductibleExpenses(ledger.data, asOfDate, rules, context);
  const amounts = new Map<string, Bani>(
    ledger.data.expenses.map(e => [e.id, e.valoareFaraTva.amount]),
  );
  const out: EstimateCoverageGap[] = [];
  for (const x of set.excluded) {
    const reason = coverageReasonForExclusion(x);
    if (reason === 'missing_fx_rate') continue;
    const amount = amounts.get(x.id);
    if (amount === undefined) continue;
    out.push({
      recordId: x.id,
      kind: 'expense',
      reason,
      amount,
      currency: 'RON',
      fixTarget: estimateFixTarget('expense', x.id),
      detail: x.detail,
    });
  }
  return out;
}

/**
 * B-93 — one asset's depreciation for the fiscal year, as the estimate sees it.
 *
 * `deductible` is already the figure that survived the art. 28 alin. (14) 1.500 lei/lună ceiling — it is
 * `DepreciationYear.deductible`, handed over by `depreciation.ts` and never recomputed here. `uncapped` and
 * `lost` travel beside it so the ceiling is visible on the same row that posts the deduction: a leg shown
 * without the part the law refuses reads as a schedule that ignored alin. (14).
 */
export interface DepreciationLegLine {
  assetId: string;
  label: string;
  months: number;
  uncapped: Bani;
  deductible: Bani;
  lost: Bani;
  branch: AssetDepreciationYear['branch'];
}

/**
 * B-93 — an asset whose computed schedule was **withheld** because a hand-recorded depreciation expense is
 * already in the period.
 *
 * `expenseIds` names the expenses that collide, `label` names the asset. Both are required by the same rule
 * that closed B-106: a refusal the user cannot read is not a refusal, it is a dead end.
 */
export interface DepreciationConflict {
  assetId: string;
  label: string;
  /** The hand-recorded `depreciation_business_asset` expenses that make the schedule unsafe to post. */
  expenseIds: string[];
  /** What posting this asset's schedule would have added. Reported, never added. */
  withheld: Bani;
}

export interface DepreciationLeg {
  fiscalYear: number;
  /** The schedules the estimate posts. Empty whenever `conflicts` is non-empty. */
  lines: DepreciationLegLine[];
  conflicts: DepreciationConflict[];
  /** Assets whose schedule refused for want of a declared fact. The reason is the schedule's own. */
  refused: AssetDepreciationRefusal[];
  /**
   * B-65 (brief 74) — assets that have left the register, with the Titlul II norm pct. 27 figure the
   * schedule computed for them. **Reported, never added to `total`.**
   *
   * pct. 27 is real and already computed: „la momentul scăderii din gestiune a mijloacelor de transport
   * din categoria M1, valoarea rămasă neamortizată este deductibilă în limita a 1.500 lei înmulţită cu
   * numărul de luni rămase de amortizat”. What the app cannot do is **post** it, because Titlul IV caps
   * the same residual a second time and by a fact the register does not hold. Normele pct. 7 alin. (5)
   * lit. o) makes the deductible residual „valoarea rămasă neamortizată … **limitată la nivelul venitului
   * realizat din înstrăinare**” — the proceeds of the disposal. Posting pct. 27's figure without that
   * second cap would deduct more than the norm allows whenever the car sold for less than it was worth,
   * which is the usual case. The proceeds are not a field on `FixedAsset`, and adding one is a persisted
   * shape change this brief's boundary forbids (chain head stays v21).
   *
   * So the figure is surfaced as a coverage row rather than silently dropped. That is the same rule that
   * closed B-106 and B-112: a computed amount that reaches no surface is a silent omission, and a half-
   * applied rule at disposal is exactly the inconsistency this acceptance criterion exists to prevent.
   */
  disposals: AssetDepreciationDisposal[];
  /** What the estimate adds to the expense leg. `0` while a conflict stands. */
  total: Bani;
}

/**
 * B-93 — the reconciliation between the computed schedule and the hand-recorded expense.
 *
 * There are two routes to the expense side of a capital asset and this is the only place they meet:
 *
 * - `depreciation_business_asset` — art. 68 alin. (4) lit. d), an amount the taxpayer typed;
 * - `depreciationSchedule` — the figure derived from the asset's declared facts and art. 28.
 *
 * **The rule: never let both reach the estimate for the same asset.** Not summed, not resolved by picking
 * the larger, not silently preferred. Where both exist the app refuses, names the asset and names the
 * expenses, and posts nothing from the register — so the estimate stays exactly where it was and the user
 * is told what to fix rather than being quietly moved.
 *
 * **Why the conflict is register-wide rather than per asset.** `Expense` carries a `vehicleId` and no
 * `assetId`: the app holds no link between a typed expense and an asset, and inventing one by matching
 * amounts or dates would be an inference from the register to the expense side that art. 68 alin. (4)
 * lit. d) does not license. Without attribution the app cannot say *which* asset a typed depreciation
 * expense covers, so it cannot say that any one schedule is safe to post on top of it. It therefore
 * withholds every schedule while any typed depreciation expense stands in the period, and says so.
 *
 * **Why the hand-recorded expense is not deleted here.** It is an ordinary register row and the classifier
 * decides its treatment; `EXPENSE_DEPRECIATION_BUSINESS_ASSET_2026` is correct and untouched. Withholding
 * the *computed* leg is the only reconciliation that leaves the figure unmoved — which is what makes the
 * refusal safe to raise: it can never change a number, only explain one.
 */
export function selectAssetDepreciation(
  data: AppData,
  asOfDate: string,
  rules: readonly FiscalRule[],
): DepreciationLeg {
  const fiscalYear = data.profile?.fiscalYear ?? 0;
  const empty: DepreciationLeg = {
    fiscalYear, lines: [], conflicts: [], refused: [], disposals: [], total: lei(0),
  };
  // No rule package selected for this year means no expensing threshold, no ceiling and no coefficients.
  // The year's own missing-release refusal already says that; this adds a second `durata_lipsa`-shaped
  // message about every asset, which would be a second producer for one finding.
  const rule = rules.find((r) => r.ruleId === FISCAL_DEPRECIATION_RULE_ID);
  if (rule === undefined) return empty;

  const schedule = depreciationForFiscalYear(rule, data.fixedAssets ?? [], fiscalYear);
  if (schedule.posted.length === 0) {
    return { ...empty, refused: schedule.refused };
  }

  // The hand-recorded half, counted over the SAME period filter the deductible set uses, so the two paths
  // cannot disagree about which records are in the year. Counted, not summed: the collision is a fact about
  // existence, and the amounts are not compared — comparing them would be picking the larger by another name.
  const handIds = (data.expenses ?? [])
    .filter(
      (e) =>
        e.status === 'inregistrata' &&
        e.category === 'depreciation_business_asset' &&
        inPeriod(expenseFiscalDate(e), asOfDate, fiscalYear),
    )
    .map((e) => e.id);

  if (handIds.length > 0) {
    return {
      fiscalYear,
      lines: [],
      conflicts: schedule.posted.map((p) => ({
        assetId: p.assetId,
        label: p.label,
        expenseIds: handIds,
        withheld: p.deductible,
      })),
      refused: schedule.refused,
      disposals: schedule.disposals,
      total: lei(0),
    };
  }

  const lines = schedule.posted.map((p) => ({
    assetId: p.assetId,
    label: p.label,
    months: p.months,
    uncapped: p.uncapped,
    deductible: p.deductible,
    lost: p.lost,
    branch: p.branch,
  }));
  return {
    fiscalYear,
    lines,
    conflicts: [],
    refused: schedule.refused,
    disposals: schedule.disposals,
    total: sumBani(lines.map((l) => l.deductible)),
  };
}

/**
 * B-93 — the depreciation half of the coverage, projected onto PG-1's one channel.
 *
 * `kind: 'profile'` and `amount: null` are the same pair PG-6a chose for a scenario gap, and for the same
 * reason: no register row answers to `recordId`, and the withheld schedule is not a sum that left the
 * figure — it is a sum that was never in it. `completeness.ts amountCoverage` therefore leaves these rows
 * out of the weighted denominator by the existing `eligible.has(recordId)` test rather than by a new one,
 * which is what keeps the percentage from moving when a refusal that changes no figure is raised.
 *
 * A refused asset is reported too. Before B-93 a missing *punere în funcțiune* date was visible only on the
 * Assets page; once the register feeds the estimate, the same missing fact is a reason the estimate is not
 * complete, and it belongs on the same surface as every other such reason.
 */
export function depreciationCoverageGaps(leg: DepreciationLeg | null | undefined): EstimateCoverageGap[] {
  if (leg === null || leg === undefined) return [];
  const out: EstimateCoverageGap[] = [];
  for (const c of leg.conflicts) {
    out.push({
      recordId: `asset:${c.assetId}`,
      kind: 'profile',
      reason: 'depreciation_conflict',
      amount: null,
      currency: 'RON',
      fixTarget: '/assets',
      detail:
        `Mijlocul fix „${c.label}” are un plan de amortizare calculat din faptele declarate, iar ` +
        `registrul conține deja cheltuieli cu amortizarea înregistrate manual (${c.expenseIds.join(', ')}). ` +
        'Ambele căi ajung la partea de cheltuieli a aceluiași bun prin art. 68 alin. (4) lit. d); adunate, ' +
        'aceeași amortizare s-ar deduce de două ori. Aplicația nu adună cele două, nu alege valoarea mai ' +
        'mare și nu preferă în tăcere niciuna: planul calculat nu este postat, iar cifra estimării nu se ' +
        'mișcă. Inregistrarea nu face legătura dintre o cheltuială și un mijloc fix, deci aplicația nu poate ' +
        'să spună ce bun acoperă cheltuiala tastată; până când această legătură există, niciun plan din ' +
        'registru nu este postat. Ce poți face: șterge cheltuiala cu amortizarea înregistrată manual și ' +
        'lasă registrul să calculeze, sau păstrează cheltuiala și nu mai aștepta nimic din registru.',
    });
  }
  for (const r of leg.refused) {
    out.push({
      recordId: `asset:${r.assetId}`,
      kind: 'profile',
      reason: 'fact_missing',
      amount: null,
      currency: 'RON',
      fixTarget: '/assets',
      detail: `Mijlocul fix „${r.label}”: ${r.reason}`,
    });
  }
  // B-65 — the pct. 27 disposal figure, reported rather than posted. `amount: null` is the same pair the
  // conflict rows above use, and for the same reason: this is not a sum that left the estimate, it is a
  // sum that was never in it, so the weighted completeness denominator does not move.
  for (const d of leg.disposals) {
    out.push({
      recordId: `asset:${d.assetId}:disposal`,
      kind: 'profile',
      reason: 'fact_missing',
      amount: null,
      currency: 'RON',
      fixTarget: '/assets',
      detail:
        `Mijlocul fix „${d.label}” a fost scos din gestiune. Plafonul pct. 27 din Normele Titlului II a ` +
        `fost calculat: valoare neamortizată ${formatBani(d.unamortised)}, ${d.remainingMonths} luni rămase ` +
        `din durata declarată, plafon 1.500 lei × luni = ${formatBani(d.cap)}, deductibil sub pct. 27 = ` +
        `${formatBani(d.deductible)}. Suma NU este adăugată în estimare. Normele Titlului IV pct. 7 alin. (5) ` +
        'lit. o) limitează aceeași valoare rămasă neamortizată „la nivelul venitului realizat din ' +
        'înstrăinare” — adică la prețul cu care bunul a fost vândut. Aplicația nu înregistrează prețul ' +
        'înstrăinării, deci nu poate măsura a doua limită; ar deduce mai mult decât permite norma ori de ' +
        'câte ori vehiculul s-a vândut sub valoarea neamortizată. Cifra de mai sus este plafonul de la ' +
        'pct. 27, nu deductibilul final.',
    });
  }
  return out;
}

/**
 * B-112 STAGE 1 — the DPI half of the coverage, projected onto PG-1's one channel.
 *
 * **Why a gap row and not a silent zero.** B-112 survived 2,332 green tests because the estimate omitted an
 * entire income category and said nothing: ANAF's Exemplul 3 pays CAS of 24.300 lei on AI net 68.000 plus
 * DPI net 50.000, and the engine produced 12.150. Making DPI *recordable* without making it *visible in the
 * estimate* would reproduce that failure with a nicer form field. So while the CAS cumulation of
 * art. 148 alin. (3) and the two CASS limbs of art. 170 land in stages 2-4, a DPI receipt that reaches the
 * register and not the figure makes the estimate **incomplete**, and the row says which receipt and why.
 *
 * **Why the record ids come from `selectYtd`.** The period, status and currency tests run in exactly one
 * place — `aggregation.ts selectYtd` — and it hands back the ids it summed. Re-walking the register here and
 * applying `inPeriod` again would be a second producer of "which receipts fall in this year", which is the
 * B-70 defect class this repository has been correcting all the way through.
 *
 * **The double-representation row is checked first and short-circuits.** Where the person has *also* typed a
 * DPI net onto the art. 170 alin. (4) ladder in Settings, the same income has two producers. Per-record rows
 * would understate that: the hazard is not that one receipt is missed, it is that the ladder cumulates the
 * category twice and selects a higher rung of art. 170 alin. (3). One row naming both inputs is the honest
 * shape, and it is the same shape B-93 chose for `depreciation_conflict`.
 *
 * **B-117 — the second walk, and why it is a walk and not a widened filter.** `dpiRecordIds` only ever holds
 * receipts the declared category puts *inside* art. 70, so a receipt declared art. 67 that nevertheless carries
 * a DPI contract fact is invisible here: `dpiRecordConflict` names that pair, the form refuses to store it, and
 * until now the coverage surface said nothing about it. Catching it needs the *other* register subset — the
 * records that carry a DPI fact without being DPI — which is `selectYtd`'s `dpiDeclaredRecordIds`. It is read
 * from the same pass rather than re-derived here for the standing B-70 reason: a second walk applying
 * period, status and convertibility again is a second producer of "which receipts fall in this year".
 *
 * **The two halves do not suppress each other.** The double-representation short-circuit suppresses the
 * per-receipt DPI rows, because those are the same fiscal quantity restated. An art. 67 contradiction is not a
 * second producer of the DPI figure — it is a different record, and it is inside the estimate — so it is not
 * swallowed by that refusal. B-106 is the standing warning about a refusal that hides the only finding a
 * surface had to report.
 */
export function dpiCoverageGaps(
  data: AppData,
  asOfDate: string,
  rules: FiscalRule[],
): EstimateCoverageGap[] {
  const ledger = normaliseStoredLedger(data);
  const ytd = selectYtd(ledger.data, asOfDate);
  const byId = new Map(ledger.data.revenues.map((r) => [r.id, r]));

  /**
   * B-117 — a receipt the declared category puts at art. 67 while the record still carries a DPI contract
   * fact. The pair is a contradiction the person answered twice in two vocabularies, and the app does not
   * break the tie (`dpiRecordConflict` says so, and ÎCCJ dec. 1793/2021 is why it may not).
   *
   * The row carries `amount: null`, and that is the difference from the art. 70 contradiction below. A DPI
   * receipt is out of the figure, so its amount really did leave it. An art. 67 receipt is IN the figure —
   * the engine ran on it at full value — so writing its amount here would subtract from the weighted
   * percentage a sum the estimate already computed on, and the percentage and the figure would disagree about
   * one record. That is the B-71 defect, not a disclosure. What is missing is not coverage of a sum; it is a
   * coherent declaration, and `amount: null` is how every contradiction row in this channel says that
   * (`depreciation_conflict` carries `null` for the same reason).
   *
   * `fact_missing` is the reason the sibling case below already uses for the same contradiction seen from the
   * other side. One contradiction must not carry two names depending on which half of it is wrong.
   */
  const art67Conflicts: EstimateCoverageGap[] = [];
  const dpiIds = new Set(ytd.dpiRecordIds);
  for (const id of ytd.dpiDeclaredRecordIds) {
    if (dpiIds.has(id)) continue;
    const record = byId.get(id);
    if (record === undefined || !isRon(record.valoareFaraTva)) continue;
    const conflict = dpiRecordConflict(record);
    if (conflict === null) continue;
    art67Conflicts.push({
      recordId: id,
      kind: 'revenue',
      reason: 'fact_missing',
      amount: null,
      currency: record.valoareFaraTva.currency,
      fixTarget: estimateFixTarget('revenue', id),
      detail: conflict,
    });
  }

  if (ytd.dpiRecordIds.length === 0) return art67Conflicts;

  const fiscalYear = ledger.data.profile.fiscalYear;
  const declaredNet = cassLadderForYear(ledger.data.profile.cassLadderYears, fiscalYear)?.proprietateIntelectuala;
  const quotaPercent = dpiQuotaPercentOf(rules, fiscalYear);
  const quotaWords =
    quotaPercent === null
      ? `Setul de reguli selectat pentru ${fiscalYear} nu conține regula de stabilire a venitului din drepturi `
        + 'de proprietate intelectuală, deci aplicația nu are o cotă forfetară de aplicat și nu inventează una.'
      : `Cota forfetară pe care regula o declară este ${quotaPercent}% din venitul brut (art. 72 alin. (2) / `
        + 'art. 72^1 alin. (1)), deci venitul net este 0,6 din brut — nu 20 %, care aparține cedării folosinței ';

  if (declaredNet !== undefined) {
    return [
      {
        recordId: `dpi:${fiscalYear}`,
        kind: 'profile',
        reason: 'dpi_income_double_represented',
        amount: null,
        currency: 'RON',
        fixTarget: '/settings',
        detail:
          `Venitul din drepturi de proprietate intelectuală pentru ${fiscalYear} are doi producători. ` +
          `Registrul conține ${ytd.dpiRecordIds.length} document(e) de venit marcate ca art. 70, însumând ` +
          `${leiText(ytd.dpiGross)} lei brut, din care ${quotaWords}` +
          `încă o dată. Settings conține în plus un venit net tastat manual pentru aceeași categorie — ` +
          `${leiText(declaredNet)} lei — la „Drepturi de proprietate intelectuală” din scara de la art. 170 ` +
          'alin. (4). Scara cumulează o singură sumă per categorie: adunate, aceleași bani ar urca o treaptă ' +
          'mai sus în plafonele de la art. 170 alin. (3) și ar produce CASS pe o sumă încasată o singură ' +
          'dată. Aplicația nu adună cele două, nu alege valoarea mai mare și nu preferă în tăcere niciuna: ' +
          'niciun venit din DPI nu este postat cât timp ambele există. Ce poți face: șterge suma tastată ' +
          'manual în Settings și lasă registrul să determine venitul net, sau nu marca documentele ca art. 70 ' +
          'și păstrează suma declarată.',
      },
      // B-117 — the refusal decides nothing about a different record, so it cannot be allowed to mute a
      // finding about one. The refusal row itself is unchanged: same reason, same sentence, same target.
      ...art67Conflicts,
    ];
  }

  const out: EstimateCoverageGap[] = [];
  for (const id of ytd.dpiRecordIds) {
    const record = byId.get(id);
    if (record === undefined || !isRon(record.valoareFaraTva)) continue;
    const conflict = dpiRecordConflict(record);
    if (conflict !== null) {
      out.push({
        recordId: id,
        kind: 'revenue',
        reason: 'fact_missing',
        amount: record.valoareFaraTva.amount,
        currency: record.valoareFaraTva.currency,
        fixTarget: estimateFixTarget('revenue', id),
        detail: conflict,
      });
      continue;
    }
    out.push({
      recordId: id,
      kind: 'revenue',
      reason: 'dpi_income_not_modelled',
      amount: record.valoareFaraTva.amount,
      currency: record.valoareFaraTva.currency,
      fixTarget: estimateFixTarget('revenue', id),
      detail:
        `Documentul „${record.nr}” este înregistrat ca venit din drepturi de proprietate intelectuală ` +
        `(art. 70 din Codul fiscal) și nu trece prin motorul art. 68 — nu este venit din activitate ` +
        `independentă, iar acela ar fi motorul greșit pentru el. ${quotaWords}` +
        'bunurilor (art. 84 alin. (2) / art. 84^1 alin. (3)). Venitul net calculat de aici alimentează ' +
        'ACUM testul de plafon de la art. 148 alin. (3) (CAS, art. 137 alin. (1) lit. b^1)) și reținerea la ' +
        'sursă de la art. 151 alin. (6). CE NU ALIMENTEAZĂ ÎNCĂ: cumularea de la art. 170 alin. (4) lit. c) ' +
        '(CASS, art. 155 alin. (1) lit. c)) — scara de la art. 170 alin. (4) cumulează șase categorii și ' +
        'refuză un set parțial de răspunsuri, iar o singură sumă calculată nu poate răspunde pentru celelalte ' +
        'cinci; aplicația nu completează zero. Impozitul de 10 % este reținut de plătitor și este final ' +
        '(art. 72 alin. (4)-(5)), deci nu intră în baza de impozitare a acestui an. Aplicația nu prezintă ' +
        'acest venit ca venit din activitate independentă (art. 67), care ar merge pe altă cale și cu altă ' +
        'bază.',
    });
  }
  return [...out, ...art67Conflicts];
}

/**
 * The FX half of the coverage, read off the ledger disclosure — not off a fresh currency walk.
 *
 * `getLedgerDisclosure` is the pass the money surfaces already read; this only re-types its
 * `unconverted` list into the coverage shape, carrying its `detail` verbatim. That is why the €5.000
 * revenue with no rate reaches the hero at all: the assembler never sees a revenue it cannot convert,
 * and nothing here goes looking for one.
 */
export function coverageFromUnconverted(
  unconverted: readonly UnconvertedRecord[],
): EstimateCoverageGap[] {
  return unconverted.map(u => ({
    recordId: u.id,
    kind: u.kind,
    reason: 'missing_fx_rate' as const,
    amount: u.amount.amount,
    currency: u.currency,
    fixTarget: estimateFixTarget(u.kind, u.id),
    detail: u.detail,
  }));
}

/**
 * PG-6a — the scenario half of the coverage, projected onto PG-1's channel rather than put beside it.
 *
 * A scenario whose effect is `incomplete` is a fact the user can still supply, which is precisely what
 * `CoverageReason.fact_missing` was reserved for when PG-1 declared it and produced nothing. Routing it
 * through the same list is what keeps brief 28 §0 rule 6 true: the hero badge, the coverage rows, the
 * attention rows and the weighted percentage all read one channel, so a later part that registers a
 * detector gets all four for free and cannot create a second place that says „the estimate is not
 * complete”.
 *
 * Two fields carry the difference between a missing record and a missing fact, and both of them are the
 * reason the field exists: `kind: 'profile'` says no register row is being described, and `amount: null`
 * says nothing was taken out of the figure. A profile fact has no amount at stake, and writing `0` would
 * put a lei figure on screen for a number nobody ever recorded. Because `recordId` is the scenario's own
 * id, `completeness.ts amountCoverage` leaves these rows out of the weighted denominator — a population
 * that never contained the row cannot be discounted by it.
 */
export function scenarioCoverageGaps(
  scenarios: readonly ScenarioOutcome[],
): EstimateCoverageGap[] {
  return scenarioGaps(scenarios).map(o => ({
    recordId: `scenario:${o.id}`,
    kind: 'profile' as const,
    reason: 'fact_missing' as const,
    amount: null,
    currency: 'RON' as CurrencyCode,
    fixTarget: scenarioFixHref(o.fixTarget),
    detail: o.detail ?? '',
  }));
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
  /**
   * TASK 10b — for a ceiling stated in a foreign currency: the lei ceiling, the rate that produced it,
   * and the competing reading. Absent while no rate is recorded, in which case the records behind the
   * line are excluded as `cap_unresolved` rather than held.
   */
  euro?: CapCeilingStrike;
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
  /**
   * TASK 10b — a ceiling stated in a foreign currency exists as a lei number only through a conversion,
   * so the number has to say which rate produced it, at which basis, for which payment year, and whether
   * that rate is provisional. `ceilingAlt` carries the competing reading's ceiling (CF art. 9 alin. (3)
   * lit. b) + alin. (4), the daily rate on the payment date) when it can be struck at all; when it
   * cannot, `euro.alternative` says why.
   */
  euro?: CapCeilingStrike & { countsPaymentsFrom?: string };
}

export interface DeductibleExpenseCounts {
  entered: number;
  undetermined: number;
  nonDeductible: number;
  capUnresolved: number;
  /** TASK 2c: records held for an annual ceiling the assembler CAN strike. Not an exclusion. */
  annualCapped: number;
  /** TASK 10a (B-32): records written in a currency the lei base cannot yet absorb. */
  foreignCurrency: number;
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
  /**
   * TASK 10b — the ledger records that entered the lei base only because a recorded BNR rate converted
   * them, each with the rate, the date it was keyed to and its provenance. A converted figure that cannot
   * name its rate is the same defect B-32 was.
   */
  conversions: LedgerConversion[];
  /** TASK 10b — foreign-currency records with no rate to convert them at, revenues included. */
  unconverted: UnconvertedLedgerRecord[];
  /** Art. 68^3: the activity has no expense engine at all, so nothing was classified (defect B-29). */
  refusal: RefusedExpense | null;
}

/**
 * A statutory cap is a CEILING, so the deductible part is the largest whole-ban amount that does not
 * exceed it: the fraction is floored, never rounded up. `roundArt66` is deliberately not used — CF
 * art. 66 rounds the sums that are DUE, and a cap is neither a sum due nor a base.
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
 * TASK 10b — the rates this assembler may use are exactly the rates the app stores.
 *
 * Phase 10c (B-37) moved that rule into one call: `normaliseStoredLedger` (`domain/fx/ledger.ts`) builds the
 * provider from `AppData.fxRates` and runs the one conversion pass, and it is the same call the summary, the
 * graph and the threshold rows make. Before 10c this file had its own copy of the provider builder, which is
 * exactly how the estimate and the summary came to disagree about one EUR invoice. Nothing here fetches: a
 * rate is a stored fact, never something a render re-derives.
 */

/** The year a payment falls in — art. 68 alin. (4) lit. b) attributes by payment, not by invoice. */
function paymentYearOf(fiscalDate: string): number | undefined {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(fiscalDate);
  return match ? Number(match[1]) : undefined;
}

/**
 * The sentence naming why a cap base cannot be measured here. It must name the DATUM and the RULE,
 * and must not convert "the app holds no such datum" into "the base is zero" — for cheltuieli sociale
 * that difference is the whole answer (research 22 §4: the zero ceiling is an arithmetic consequence of
 * having no personnel, which is a fact the app does not hold, not a fact it can assert).
 *
 * B-138: the base used to be interpolated here as its machine code, so the person read
 * `pe baza „annual_eur_per_person”`. The naming of the base is `ui/copy/thresholds.ts capBaseSentence`,
 * keyed by the same `CapBase` code and exhaustive over it. What stays here is what only the domain may
 * decide: which rule is cited, and what the app is therefore forbidden to invent.
 */
function unresolvedCapDetail(
  cap: DeductibilityCap | undefined,
  sourceArticle: string,
  paymentYear?: number,
  dailyRatesHeld?: number,
): string {
  const base = cap ? cap.base : undefined;
  const article = cap ? cap.baseArticle : sourceArticle;
  const opening = cap
    ? capBaseSentence(cap.base, article)
    : `Plafonul are baza nesetată în regula ${article}`;
  let missing: string;
  if (base === 'annual_eur_per_person') {
    missing =
      'lipsă datele: plafonul este exprimat în euro, iar aplicația nu stochează niciun curs BNR'
      + (paymentYear !== undefined ? ` pentru anul plății ${paymentYear}` : '')
      + '. '
      + 'Regula de conversie este HG 1/2016, Norme, Titlul IV, Cap. II, Secțiunea a 2-a, pct. 7 alin. (6) '
      + '— „cursul mediu comunicat de Banca Națională a României pentru anul în care s-a efectuat plata"; '
      + 'art. 9 alin. (3) lit. b) și alin. (4) CF indică însă cursul BNR de la data plății, cu excepția '
      + 'doar a cazurilor „prevăzute expres în prezentul cod", iar normele nu sunt „prezentul cod". '
      + 'Niciun text primar nu împacă cele două reguli, deci aplicația nu alege niciuna și nu fixează '
      + 'niciun curs: un curs scris în cod ar fi o regulă inventată, iar media anuală nu se calculează '
      + 'din cursurile zilnice.'
      // B-137 (§4) — the refusal named as evidence rather than as a gap. A register that holds the daily
      // rates and still declines to average them is making a decision, and the person reading the banner
      // has to be able to tell that apart from a missing datum.
      + (dailyRatesHeld !== undefined && dailyRatesHeld > 0
        ? ` Aplicația deține ${dailyRatesHeld} cursuri zilnice pentru acest an și tot nu face o medie anuală `
          + 'din ele: media publicată de BNR se obține din mediile lunare, deci o medie a cursurilor zilnice ar '
          + 'fi un alt număr decât cel publicat. Media se înregistrează așa cum a fost publicată.'
        : '');
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
  return `${opening} — ${missing}`;
}

/**
 * A payment outside the window the CEILING counts. OUG 8/2026 art. 10 alin. (9) fixes that window for the
 * FY2026 400 EUR test (from 1 ianuarie 2026 for pensii facultative); a payment before it belongs to a
 * ceiling this app does not model, so the honest answer is to keep the record out and say which window
 * excluded it — never to fold it into a ceiling that does not cover it.
 */
function capWindowDetail(cap: DeductibilityCap, window: string, fiscalDate: string): string {
  return (
    `Plafonul categoriei numără plățile de la ${window} încolo (${cap.baseArticle}), iar plata din ${fiscalDate} ` +
    'este în afara acestei ferestre. Plafonul anului anterior nu este modelat în aplicație, deci a include ' +
    'plata aici ar însemna a ghici la ce plafon aparține; înregistrarea iese din total și este raportată.'
  );
}

/** The record as it may enter the engine, with a per-expense cap applied to both money fields. */
function applyExpenseCap(e: Expense, percent: number): Expense {
  return {
    ...e,
    valoareFaraTva: money(capBaniCeiling(e.valoareFaraTva.amount, percent), e.valoareFaraTva.currency),
    tva: money(capBaniCeiling(e.tva.amount, percent), e.tva.currency),
  };
}

/**
 * The two lei measures of an expense the caller has already established is written in lei.
 *
 * `requireRon` throws rather than read a foreign amount as lei. Reaching the throw is a defect in this
 * loop — the loop excludes a non-RON record before it gets here — not a data condition, and that is the
 * point: the only way a foreign amount enters a lei total is if this guard is removed.
 */
function leiMeasures(e: Expense): { net: Bani; inclVat: Bani } {
  const net = requireRon(e.valoareFaraTva, `expense ${e.id}.valoareFaraTva`);
  return { net, inclVat: addBani(net, requireRon(e.tva, `expense ${e.id}.tva`)) };
}

/**
 * B-142 — the rule package's treatment codes in the words a person reads.
 *
 * `selectDeductibleExpenses` reports a rule-data error when a rule classifies an expense but gives it
 * no category to total it under, and that sentence used to quote the treatment code (`„capped”`) at
 * the reader. The code is what the engine branches on; the words below are what the sentence needs.
 * They live here, next to the sentence that uses them, for the reason `models.ts` records for
 * `CASS_LADDER_CATEGORY_NAMES`: the refusing string is itself domain output, and a second vocabulary
 * in the copy layer is how the two drift apart.
 */
const treatmentLabels: Record<DeductibilityTreatment, string> = {
  deductible: 'deductibil',
  non_deductible: 'nu este deductibil',
  capped: 'deductibil numai până la un plafon',
  undetermined: 'nedeterminat, pentru că lipsește o faptă',
};

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
  // PG-6b (B-29) — THREADING, NOT MECHANISM. The classifier has accepted an `activityFamily` since the
  // rule was written, and nothing ever supplied one, which is why the art. 68^3 refusal was dead code
  // (PG-6a's handoff names this as the one thing 6b had to fix). The fact lives on the profile, and this
  // is the single place it is read into the classification context: every live path — the estimate, the
  // coverage rows and the expense register — funnels through this function, so threading here is what
  // keeps those three from disagreeing about which activity they classified. Threading it at the five
  // call sites instead would have put the same fact in five places, where the sixth would forget it.
  //
  // The caller's own context still wins: a test or a later phase that hands in a per-record or
  // per-call fact is not overwritten by the profile. And absence stays absence — `undefined` is not
  // coerced to `'other'`, because "not asked" and "answered: other" are different claims.
  const ctx: ExpenseClassificationContext = {
    activityFamily: data.profile.activityFamily,
    ...context,
  };
  // PG-6c (D-VEH-3) — THREADING, NOT MECHANISM, and this time per record rather than per run. The
  // vehicle facts used to sit on the context: one value for a whole classification run, which cannot say
  // "this car is used by the taxpayer, that one is not" — the only distinction art. 68 alin. (5) lit. j)
  // itself draws. They are now resolved from the vehicle the expense names, through the resolver in the
  // layer that owns the cap arithmetic. Nothing here reads a car list, compares a fact or picks a car:
  // the resolver is bound once to this register and this fiscal year so a run does not re-walk the cars
  // per record, and an expense that names no car arrives as `unattributed` rather than inheriting an
  // answer. `data.vehicles` is empty for every profile that has never declared a car, which is what keeps
  // those profiles on alin. (7) lit. k)'s statutory 50 % default instead of making their costs unattributable.
  const resolveVehicle = vehicleExpenseResolver(data.vehicles ?? [], fiscalYear);
  const empty: DeductibleExpenseSet = {
    records: [],
    lines: [],
    annualCapped: [],
    excluded: [],
    counts: { entered: 0, undetermined: 0, nonDeductible: 0, capUnresolved: 0, annualCapped: 0, foreignCurrency: 0 },
    conversions: [],
    unconverted: [],
    refusal: null,
  };

  // Checked ONCE for the whole set: where the law supplies no expense engine there is no category to
  // resolve, and classifying into nothing would produce a confident wrong number (defect B-29).
  const refusal = expenseEngineRefusal(ctx, rules, { taxYear: fiscalYear, asOfDate });
  if (refusal) return { ...empty, refusal };

  // TASK 10b — the ledger is read in lei. A record written in a foreign currency is converted at the BNR
  // daily reference rate on the date it was paid or received (CF art. 9 alin. (3) lit. b) + alin. (4)),
  // which is the rule the research verified for both directions and which is not EUR-specific, so USD
  // travels it with the same authority as EUR. A record with no rate for that date stays out and is
  // reported below — TASK 10a's exclusion is not deleted, it is now reached by a lookup.
  const provider = recordedRateProvider(data);
  const ledger = normaliseLedgerToRon(data, provider);

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
    foreignCurrency: 0,
  };

  for (const e of ledger.data.expenses) {
    const fiscalDate = expenseFiscalDate(e);
    if (e.status !== 'inregistrata' || !inPeriod(fiscalDate, asOfDate, fiscalYear)) continue;

    // TASK 10a (B-32), still standing. The deductible base is a lei quantity — every ceiling struck here
    // is a lei ceiling and every figure the engine consumes is lei. A record that survived the conversion
    // pass above is still foreign only because the store holds no rate for its currency on its payment
    // date, so it is excluded and counted with the missing datum named — never added to a lei total as
    // though its cents were bani, which is precisely the defect this step removes.
    if (!isRon(e.valoareFaraTva) || !isRon(e.tva)) {
      counts.foreignCurrency += 1;
      excluded.push({
        id: e.id,
        category: e.category ?? null,
        reason: 'foreign_currency',
        ruleId: null,
        sourceArticle: 'CF art. 9 alin. (3) lit. b) și alin. (4)',
        detail:
          `inregistrarea este în ${e.valoareFaraTva.currency}, iar baza deductibilă este în lei. ` +
          'Lipsește cursul BNR de aplicat: art. 9 alin. (3) lit. b) și alin. (4) indică cursul comunicat de BNR '
          + `valabil la data la care s-a plătit suma (${fiscalDate}), iar registrul de cursuri nu conține niciun curs `
          + `${e.valoareFaraTva.currency} pentru această dată. Un curs scris de la sine ar fi o cifră inventată, ` 
          + 'așa că înregistrarea iese din total și este raportată.',
      });
      continue;
    }

    const c = classifyExpenseDeductibility(
      { category: e.category, context: ctx, vehicle: resolveVehicle(e.vehicleId) },
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
          `Regula ${c.rule.ruleId} a returnat un tratament de deductibilitate „${treatmentLabels[c.treatment]}” ` +
          'fără nicio categorie asociată; nu poate fi inclusă în niciun total pe categorie.',
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
      // TASK 10b — a ceiling stated in a foreign currency is measurable once the store holds the rate
      // pct. 7 alin. (6) asks for. The currency comes from the rule's own parameter unit, so nothing here
      // is EUR-specific; the package states euro only because CF art. 68 alin. (5) states euro only, and
      // no USD ceiling may be invented to exercise the generic path.
      const capMoney = cap !== undefined ? capAmount(cap) : null;
      const computableByConversion =
        cap !== undefined && cap.base === 'annual_eur_per_person' && capMoney !== null;
      if (!cap || (!computableHere && !computableByAssembler && !computableByConversion)) {
        counts.capUnresolved += 1;
        excluded.push({
          id: e.id,
          category: c.category,
          reason: 'cap_unresolved',
          ruleId: c.rule.ruleId,
          sourceArticle: c.rule.sourceArticle,
          detail: unresolvedCapDetail(cap, c.rule.sourceArticle, paymentYearOf(fiscalDate)),
        });
        continue;
      }
      // TASK 10b — the window the CEILING counts, read from the rule (`cap_counts_payments_from`), not
      // from a date in code. A payment outside it belongs to a ceiling this build does not model.
      const window = cap.countsPaymentsFrom;
      if (computableByConversion && window !== undefined && fiscalDate < window) {
        counts.capUnresolved += 1;
        excluded.push({
          id: e.id,
          category: c.category,
          reason: 'cap_unresolved',
          ruleId: c.rule.ruleId,
          sourceArticle: c.rule.sourceArticle,
          detail: capWindowDetail(cap, window, fiscalDate),
        });
        continue;
      }
      if (computableByAssembler || computableByConversion) {
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
        const measures = leiMeasures(e);
        line.inclVat = addBani(line.inclVat, measures.inclVat);
        line.exclVat = addBani(line.exclVat, measures.net);
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
      const cappedMeasures = leiMeasures(capped);
      line.inclVat = addBani(line.inclVat, cappedMeasures.inclVat);
      line.exclVat = addBani(line.exclVat, cappedMeasures.net);
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
    const plainMeasures = leiMeasures(e);
    line.inclVat = addBani(line.inclVat, plainMeasures.inclVat);
    line.exclVat = addBani(line.exclVat, plainMeasures.net);
    byCategory.set(category, line);
  }

  // TASK 10b — a ceiling stated in a foreign currency is a lei number only through a rate the app may not
  // invent. The category was held on the assumption that the store supplies the annual average pct. 7
  // alin. (6) names; if it does not, every record behind it goes back to `excluded` with the datum, the
  // payment year and the rule named — TASK 2c's treatment, reached now by a lookup instead of by a
  // rule-shape test. Nothing is converted at a guessed rate, and no average is ever computed here.
  const unresolvedEuro: { line: AnnualCapLine; detail: string }[] = [];
  for (const line of cappedByCategory.values()) {
    if (line.cap.base !== 'annual_eur_per_person') continue;
    const amount = capAmount(line.cap);
    if (amount === null) {
      unresolvedEuro.push({ line, detail: unresolvedCapDetail(line.cap, line.sourceArticle) });
      continue;
    }
    const attempt = strikeCapCeiling({
      cap: amount,
      paymentDates: line.records.map(expenseFiscalDate),
      provider,
    });
    if (attempt.ok) {
      line.euro = attempt.strike;
      continue;
    }
    unresolvedEuro.push({
      line,
      // B-137 (§4): the refusal has to stay legible as a refusal. `dailyRatesHeld` is what makes persona 11's
      // register readable — it holds twelve EUR daily rates for 2026 and the ceiling still will not strike,
      // so the sentence says how much the app is declining to use rather than leaving it looking like a gap.
      detail: unresolvedCapDetail(line.cap, line.sourceArticle, attempt.paymentYear, attempt.dailyRatesHeld),
    });
  }
  for (const { line, detail } of unresolvedEuro) {
    cappedByCategory.delete(line.category);
    counts.annualCapped -= line.count;
    counts.capUnresolved += line.count;
    for (const e of line.records) {
      excluded.push({
        id: e.id,
        category: line.category,
        reason: 'cap_unresolved',
        ruleId: line.ruleId,
        sourceArticle: line.sourceArticle,
        detail,
      });
    }
  }

  return {
    records,
    // Deterministic order, so the explanation of a total is the same text on every run.
    lines: [...byCategory.values()].sort((a, b) => a.category.localeCompare(b.category)),
    annualCapped: [...cappedByCategory.values()].sort((a, b) => a.category.localeCompare(b.category)),
    excluded,
    counts,
    conversions: ledger.conversions,
    unconverted: ledger.unconverted,
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
 * gross, so it needs nothing; the ceilings stated in a foreign currency (Pass A2, TASK 10b) are measured
 * on a converted statutory amount, so they need only a rate; and the alin. (6) base is measured after the
 * other alin. (5) caps, so it needs both of their answers first.
 *
 * WHICH BASIS THE CEILING IS STRUCK ON — the decision, and it is load-bearing. The ceiling is an
 * ANNUAL one: art. 65 alin. (1) makes the fiscal year the calendar year, and art. 68 alin. (4) lit. b)
 * attributes an expense to the year it was paid. Since PG-5C the annual quantity IS the realised one —
 * art. 118 alin. (3) deems what was realised in a fraction of the year to be the annual income — so the
 * ceiling is struck on the recorded amounts, which is also exactly the quantity the engine runs on.
 * Before PG-5C this struck the ceiling on the run-rate projection, which made a statutory annual limit
 * move with the calendar: the same October payment was capped against a different ceiling on 15 November
 * than on 31 December, and no provision says it should.
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

  // One operand set. Before PG-5C this function carried two — a projected `annual` the engine ran on
  // and a recorded `actual` it merely reported — and the two could sit at different points of the same
  // ceiling. There is now one quantity, it is the recorded one, and the ceiling bounds it once.
  let operands: EstimateAmounts = { ...basis.actual };

  const adjustments: AnnualCapAdjustment[] = [];
  // The alin. (5) categories that are HELD OUT of the record set but still belong to the alin. (6) base —
  // lit. q) and, from TASK 10b, the ceilings stated in a foreign currency. As RECORDED and as ALLOWED:
  // TASK 2d makes the operative alin. (6) base subtract the RECORDED amount, so the claimed figure is
  // load-bearing arithmetic, not bookkeeping; the allowed figure survives so the post-cap reading can still
  // be computed and shown as the alternative.
  const cappedAllowed = zeroPair();
  const cappedClaimed = zeroPair();

  // ── Pass A — the caps measured on the gross (art. 68 alin. (5) lit. q)).
  for (const { line, claimed } of claims) {
    if (line.cap.base !== 'gross_income') continue;
    const percent = line.cap.percent;
    if (percent === undefined) continue; // a euro amount on a lei base is rule-data error, never a guess
    const ceiling = zeroPair();
    const allowed = zeroPair();
    for (const m of MEASURES) {
      ceiling[m] = capBaniCeiling(nonNegativeBani(grossOf(operands, m)), percent);
      allowed[m] = minBani(claimed[m], ceiling[m]);
      operands = withDeductible(operands, m, addBani(deductibleOf(operands, m), allowed[m]));
      cappedAllowed[m] = addBani(cappedAllowed[m], allowed[m]);
      cappedClaimed[m] = addBani(cappedClaimed[m], line[m]);
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

  // ── Pass A2 — the ceilings stated in a foreign currency, converted (TASK 10b).
  // HG 1/2016 Titlul IV Cap. II pct. 7 alin. (6) converts the LIMIT, not the payment: the lei ceiling is
  // one number for the whole year, struck once at the BNR annual average of the year of payment, and the
  // same ceiling bounds both money measures because a statutory ceiling is not a VAT-sensitive quantity.
  // The competing reading — CF art. 9 alin. (3) lit. b) + alin. (4), the daily rate on the payment date —
  // is struck alongside it and travels as `ceilingAlt`, the same "show the reading that was not applied"
  // discipline TASK 2d established for the alin. (6) base. Applying one is not a finding that the other
  // is wrong: the conflict itself travels on the rule as `conflict`, and on the adjustment.
  for (const { line, claimed } of claims) {
    if (line.cap.base !== 'annual_eur_per_person') continue;
    const strike = line.euro;
    // No rate in the store: pass 1 already excluded these records as `cap_unresolved`, so there is no
    // ceiling to strike and nothing to add back. This is not a silent zero — the exclusion says so.
    if (strike === undefined) continue;
    const ceiling = zeroPair();
    const allowed = zeroPair();
    const ceilingAlt = zeroPair();
    const alternative = strike.alternative;
    for (const m of MEASURES) {
      ceiling[m] = strike.ceiling;
      if (alternative.ok) ceilingAlt[m] = alternative.ceiling;
      allowed[m] = minBani(claimed[m], ceiling[m]);
      operands = withDeductible(operands, m, addBani(deductibleOf(operands, m), allowed[m]));
      cappedAllowed[m] = addBani(cappedAllowed[m], allowed[m]);
      cappedClaimed[m] = addBani(cappedClaimed[m], line[m]);
    }
    adjustments.push({
      category: line.category,
      ruleId: line.ruleId,
      sourceArticle: line.sourceArticle,
      cap: line.cap,
      claimed,
      ceiling,
      allowed,
      ...(alternative.ok ? { ceilingAlt } : {}),
      euro: {
        ...strike,
        ...(line.cap.countsPaymentsFrom !== undefined
          ? { countsPaymentsFrom: line.cap.countsPaymentsFrom }
          : {}),
      },
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
  const base = zeroPair(); // operative — PRE-cap: the held-out alin. (5) categories subtracted as RECORDED
  const baseAlt = zeroPair(); // alternative — POST-cap: the same categories subtracted as ALLOWED
  const ceilingAlt = zeroPair();
  for (const m of MEASURES) {
    const postCap = nonNegativeBani(subBani(grossOf(operands, m), deductibleOf(operands, m)));
    baseAlt[m] = postCap;
    // Subtract the excess Pass A / Pass A2 disallowed, i.e. subtract those categories as RECORDED. Burse
    // private and protocol are absent from the base entirely — alin. (6) removes them by name — so they
    // need no correction; lit. q) and the converted euro ceilings do, because alin. (6) keeps them.
    base[m] = nonNegativeBani(subBani(postCap, subBani(cappedClaimed[m], cappedAllowed[m])));
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
      operands = withDeductible(operands, m, addBani(deductibleOf(operands, m), allowed[m]));
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

  // The forecast is carried through untouched. Striking a statutory ceiling changes the legal figure;
  // it does not change what a run rate would have said, and rewriting the forecast to match the capped
  // operands would quietly turn a forecast into a calculation it never performed.
  const rebuilt: AttributedEstimateBasis = { ...basis, actual: operands };
  return { basis: rebuilt, adjustments };
}

/**
 * The annual quantity a capped category claims.
 *
 * It is the recorded amount, and PG-5C is why. This function used to re-enter `selectProjectionV1` on
 * the category's own records so the ceiling would be struck against the category's *projected* annual
 * figure. That made a statutory annual limit a function of the date the app happened to be read on:
 * protocol paid in October was measured against one ceiling on 15 November and another on 31 December,
 * and art. 68 alin. (5) states no such moving limit. Art. 68 alin. (4) lit. b) attributes an expense to
 * the year it was PAID, and art. 118 alin. (3) makes the fraction-of-year amount the annual amount, so
 * the annual claim is simply what was paid in the year.
 *
 * `line` is the only input it needs: the records behind the line are already period-scoped by the
 * caller that built them, and nothing here re-filters them by date.
 */
function claimAnnualMeasure(line: AnnualCapLine): MeasurePair {
  return { inclVat: line.inclVat, exclVat: line.exclVat };
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
      /**
       * PG-6f (B-30, D-VAT-2) — the expense base the per-line VAT decision produced, in its two candidate
       * forms. Required on the `run` branch so no call site can reach `computeTaxEstimate` without having
       * run the decision; the retired `vatExempt` fallback is not available at any level.
       */
      expenseBase: ExpenseBaseWithVat;
      /** PG-6f — the claimable-VAT decision for this period, produced once and carried, not re-derived. */
      inputVat: InputVatDecision;
      deductible: DeductibleExpenseSet;
      /** TASK 2c — the annual ceilings that were struck, each with the base it was struck on. */
      capAdjustments: AnnualCapAdjustment[];
      /** TASK 10b — ledger records that entered the operands only because a recorded rate converted them. */
      conversions: LedgerConversion[];
      /**
       * B-144 — the provisional annual averages the income measure was converted with, empty when every
       * conversion used a final rate. This is the ledger disclosure's blind spot: `conversions` records the
       * daily-anchored pass, and the art. 84 gross is struck through a second, annual-average pass that the
       * ledger never sees. A lei income figure built that way is what the threshold rows are measured on, so
       * the provisional-ness has to travel with the estimate or no surface can say it.
       */
      provisionalIncomeRates: ProvisionalRateEvidence[];
      /**
       * PG-6a — the scenario registry's answer for this register. It is produced here, at the one
       * evaluation point, and travels with the estimate so no surface runs the registry again.
       */
      scenarios: ScenarioOutcome[];
      /**
       * B-93 — the depreciation leg, produced once here for the same reason `scenarios` is: the register
       * must not be walked twice, or the figure and the coverage rows disagree about the same asset.
       */
      depreciation: DepreciationLeg;
    }
  | {
      kind: 'refused';
      basis: RefusedEstimateBasis;
      /** Already a `review_required` result: a refused engine must not be handed to `computeTaxEstimate`. */
      result: TaxEstimateResult;
      deductible: DeductibleExpenseSet;
      capAdjustments: AnnualCapAdjustment[];
      conversions: LedgerConversion[];
      /** B-144 — see the `run` branch. A refusal carries them too: the pass that refused did use them. */
      provisionalIncomeRates: ProvisionalRateEvidence[];
      scenarios: ScenarioOutcome[];
      depreciation: DepreciationLeg;
    };

export function selectEstimateOperands(
  data: AppData,
  asOfDate: string,
  rules: FiscalRule[],
  context: ExpenseClassificationContext = {},
): EstimateOperands {
  // TASK 10b — the ledger is read in lei BEFORE anything is aggregated, so the gross, the deductible set,
  // the projection and the ceilings are all struck on the SAME record set. Converting after aggregation
  // would be the Phase 10 drift class in a new costume.
  const ledger = normaliseStoredLedger(data);
  // PG-6h-1 — which determination method the law applies to this register. Read, not decided: a declared
  // profile fact plus the presence of a flat-ratio rule in the rule set selected for this year. It is
  // computed here, before the registry runs, because the registry needs it as a fact: whether the art. 68
  // expense engine's absence is fatal depends on whether the law supplied a different method for this
  // income, and that is a question about the rule set, not about the classifier.
  const method = selectIncomeDeterminationMethod(ledger.data, rules, asOfDate, context.activityFamily);
  // B-105 — the gross the two ordinary-rent regimes run on, and whether art. 84^1 alin. (8) has switched
  // their withholding off. Both are computed here, before the registry runs, because the registry needs the
  // first as a fact (a cedare register whose gross cannot be struck is a refusal, not a zero) and the engine
  // needs the second as an operand (it decides whether the tax is the payer's to withhold or the owner's to
  // self-assess and file). Neither is re-derived downstream.
  const cedareGross =
    method === 'cedare-art84' || method === 'cedare-art84x1'
      ? selectCedareGross(ledger.data, asOfDate, method)
      : { gross: null as Bani | null, detail: undefined };
  const cedareWithholdingBlocked =
    method === 'cedare-art84x1'      ? art84x1WithholdingBlocked(
          leaseFactsForYear(ledger.data.profile.leaseFactsYears, ledger.data.profile.fiscalYear),
        )
      : false;
  // B-144 — read off the pass that struck the gross, not re-derived. A second FX walk over the same register
  // is the B-70 defect class, and here it would also be able to name a rate the figure never used.
  const provisionalIncomeRates = cedareGross.provisionalAnnualAverage ?? [];
  const deductible = {
    ...selectDeductibleExpenses(ledger.data, asOfDate, rules, context),
    // The assembler's own pass covers revenues as well as expenses, so the audit trail it reports is the
    // wider one; the inner pass would report only the expenses it could still see.
    conversions: ledger.conversions,
    unconverted: ledger.unconverted,
  };
  // B-93 — the depreciation leg, struck once here and BEFORE the scenario registry, so a refused estimate
  // still carries it: the collision between a computed schedule and a hand-recorded depreciation expense is
  // a finding the user has to see whether or not the engine ran. It changes no arithmetic — it reads the
  // register through `depreciation.ts` and decides only whether the figure may join the expense leg.
  const depreciation = selectAssetDepreciation(ledger.data, asOfDate, rules);

  // PG-6a — the scenario registry, run once, here.
  //
  // This block replaces the inline `if (deductible.refusal)` special case that used to sit where this
  // line is. The decision it made is unchanged — a classifier with no expense engine must not reach the
  // engine — but the mechanism is now the registry's, so PG-6b…6g add a detector to
  // `scenarios.ts SCENARIO_SUPPORT` instead of adding a branch to this function.
  //
  // The classifier's refusal is handed to the registry as a fact the app already holds rather than
  // re-detected here: the rule layer decides whether an activity has an expense engine, and a second
  // place deciding that is how two answers to one question start.
  const scenarios = evaluateScenarios({
    data: ledger.data,
    classifierRefusal: deductible.refusal ?? null,
    // PG-6h-1 — a fact, not a verdict: the rule set does or does not carry a flat-ratio method for this
    // register. The registry reads it to decide whether "there is no expense engine" is a stop or simply the
    // shape of a different method. It does not get to decide that itself, and neither does this function.
    //
    // B-88 widened what the name already says. It is not "the art. 68^3 rule exists" — it is "a flat-ratio
    // method was selected for this register", because art. 85 alin. (2) replaces the art. 68 expense engine
    // just as completely as art. 68^3 alin. (2) does, and a register measured under either of them must not
    // be stopped for want of an engine the law withdrew. Which of the two it is, the registry reads from
    // `incomeDeterminationMethod` below.
    flatRatioMethodAvailable: method !== 'sistem-real',
    // And the questions the rule itself records as open, lifted verbatim so the refusal names them in the
    // rule's words rather than in a paraphrase written here.
    flatRatioOpenQuestions: accommodationOpenQuestions(rules, ledger.data.profile.fiscalYear, asOfDate),
    // The resolved family, so the registry and the classifier answer about the same activity even when a
    // caller supplied the fact per-call instead of storing it.
    activityFamily: context.activityFamily ?? ledger.data.profile?.activityFamily,
    // PG-6h-2 (B-82, B-84) — the three accommodation facts, read from the profile and resolved once here.
    // Threading only: no comparison, no default and no inference anywhere in this block. The title is
    // resolved by `domain/models.ts accommodationIncomeTitleForYear`, the single place the art. 83 alin.
    // (4) boundary is read, so the refusal and the Settings screen cannot disagree about which title a
    // payload is in. `null` is an answer — "the count is not recorded for this year" — not a gap in the
    // threading, and the registry treats it as the reason no title may be asserted.
    accommodationIncomeTitle: accommodationIncomeTitleForYear(
      ledger.data.profile.accommodationRoomCounts,
      ledger.data.profile.fiscalYear,
    ),
    accommodationCommissionReading: ledger.data.profile.accommodationCommissionReading,
    accommodationTourismEligibility: ledger.data.profile.accommodationTourismEligibility,
    // PG-6h-2b (B-85) — ONE scenario fact, and it is the method itself. The assembler has already decided
    // which determination method this profile-year runs under; the registry is not entitled to decide it
    // again from `activityFamily` plus `flatRatioMethodAvailable`, because those two answer a narrower
    // question (does the rule set carry the art. 68^3 method) than the one the engine acts on (is this
    // register determined by it). Handing over the resolved answer is what lets the registry refuse a
    // mixed-method year about the SAME register the engine is about to run — and it is the reason the
    // refusal and the composition cannot ever disagree about which method was in play.
    incomeDeterminationMethod: method,
    // B-105 — why a cedare register has no gross, when that is the case. Handed over as the assembler's own
    // finding rather than re-detected by the registry: the gross is struck here, and a second place deciding
    // whether it exists is how one register gets two answers about the same money.
    cedareGrossDetail: cedareGross.gross === null ? (cedareGross.detail ?? null) : null,
  });
  const refusal = scenarioRefusal(scenarios);
  if (refusal !== null) {
    const reason = refusal.detail ?? '';
    return {
      kind: 'refused',
      basis: { kind: 'refused', method: null, elapsedMonths: null, reason, scenario: refusal },
      result: { status: 'review_required', reason, lines: [] },
      deductible,
      capAdjustments: [],
      conversions: ledger.conversions,
      provisionalIncomeRates,
      scenarios,
      depreciation,
    };
  }

  // Pass 1. The record set fed to both selectors deliberately EXCLUDES the categories held for an
  // annual ceiling: art. 68 alin. (6) removes burse private and protocol from its own base, so the base
  // must be struck on exactly this set. `selectProjectionV1` re-runs `selectYtd` internally, so both
  // selectors get the SAME object — a subset applied to only one of them is the Phase 10 drift class.
  //
  // B-112 adds a second exclusion to the same line, for the same reason. art. 70 DPI receipts are a
  // different income category with a different quota (40 %, art. 72 alin. (2)), a different contribution
  // limb for each contribution (CAS art. 137 alin. (1) lit. b^1), CASS art. 155 alin. (1) lit. c)) and a
  // tax the PAYER withholds and that is final (art. 72 alin. (4)-(5)). None of those paths exists in this
  // build yet, so leaving the receipts in this set would run them through the art. 68 sistem-real engine
  // as if they were art. 67 income — which is a second, quieter form of the B-112 defect rather than a fix
  // for it. Scoping the set is also why no subtraction appears anywhere downstream: the category question
  // is answered once, here, by `isDpiIncome`, and `selectYtd` never sees a DPI receipt at all.
  //
  // What is NOT removed is the register itself: `dpiCoverageGaps` reports these same receipts as a coverage
  // gap, so the estimate gets smaller AND says why. A DPI receipt that reaches neither the figure nor the
  // gap list is the failure mode this stage exists to prevent.
  const systemRealRevenues = ledger.data.revenues.filter((r) => !isDpiIncome(r));
  const scoped: AppData = { ...ledger.data, revenues: systemRealRevenues, expenses: deductible.records };
  const ytd = selectYtd(scoped, asOfDate);
  // B-147 — the DPI subset, read off the UNSCOPED record set because the scoping above is what keeps these
  // receipts out of the art. 68 engine, and they are still a source the contribution arithmetic has to see.
  //
  // This is a second call to `selectYtd`, not a second producer of "which receipts fall in this year": it is
  // the same function, the same `asOfDate`, the same fiscal year, the same status and convertibility test,
  // applied to the complement of a set this function already split. It is also the exact call
  // `dpiCoverageGaps` makes, so the coverage row and the operand cannot disagree about the DPI subset — which
  // is the B-71 agreement this pairing exists to keep. What would be the B-70 defect is a hand-written
  // `inPeriod` filter over `ledger.data.revenues`, and there is none here.
  const dpiYtd = selectYtd(ledger.data, asOfDate);
  // PG-6h-1 — the flat-ratio gross, struck on the SAME ledger pass and the SAME record set as every other
  // operand here. A second FX walk would be the B-70 defect class and would drift from the first. B-88
  // widened which methods read it: art. 85 alin. (2) measures the gross the same way art. 68^3 alin. (2)
  // does — cash basis, converted per collection at the last banking day's BNR rate — so the same pass
  // serves both, and the method attached beside it is what keeps the two articles apart downstream.
  const flatRatioGross =
    method === 'sistem-real'
      ? undefined
      : method === 'cedare-art84' || method === 'cedare-art84x1'
        ? cedareGross.gross ?? undefined
        : flatRatioGrossFromYtd(ytd, ledger.data) ?? undefined;
  const projection = selectProjectionV1(scoped, asOfDate);
  const basisBeforeCaps = selectTaxEstimateBasis(projection, ytd, asOfDate);
  // B-93 — folding the leg in, and folding it in AFTER the ceiling pass on purpose: art. 68 alin. (6)
  // strikes the protocol and private-school ceilings on a base built from the register's own expenses, and
  // moving an amortisation figure into that base would change cap arithmetic this phase may not change.
  // `expenses` is the VAT-inclusive measure and `expensesNet` the VAT-exclusive one; a depreciation
  // deduction carries no input VAT of its own, so both rise by the same amount and `applyVatToExpenseBase`
  // keeps the `divergent` answer it reached about the *vehicle* lines it was reading.
  const withDepreciation = (a: EstimateAmounts): EstimateAmounts =>
    depreciation.total === 0
      ? a
      : { ...a, expenses: addBani(a.expenses, depreciation.total), expensesNet: addBani(a.expensesNet, depreciation.total) };

  // PG-6f (B-30) — the input-VAT decision, run ONCE here over the same normalised ledger the totals come
  // from. Two things about the population it runs on, both deliberate:
  //
  // - It is every registered expense line in the period, NOT only the deductible subset. Whether the VAT
  //   on a purchase may be claimed is a Titlul VII question (art. 297-300) and is independent of whether
  //   the cost is deductible for income tax under art. 68; a non-deductible cost can still carry fully
  //   claimable VAT, and restricting the pass to the deductible subset would silently drop those lines
  //   from the taxpayer's claim.
  // - The period and status filter is the SAME one `selectYtd` and `selectDeductibleExpenses` apply, so
  //   the claim, the totals and the coverage rows are counts of one record set and not of three.
  //
  // B-114 — the population is `ledger.data.expenses`, **not** `scoped.expenses`. `scoped.expenses` is
  // `deductible.records`, and those records have been through `applyExpenseCap`, which scales **both**
  // `valoareFaraTva` and `tva` (it must, for the expense-base purpose `applyVatToExpenseBase` describes).
  // Feeding them to `decideInputVat` applied the art. 68 alin. (7) lit. k) income-tax half-count to the VAT
  // before art. 298 alin. (1) halved it again: a 21.000-lei VAT on a mixed-use car reached the VAT decision
  // as 10.500 lei and reported 5.250 lei non-recoverable where the published source prints 10.500
  // (`research/47` §101-103). `research/42` §1 is explicit that these are **two separate regimes** — six
  // VAT categories against five income-tax ones — and §6 rows 12-13 record that no ordering rule exists to
  // license chaining them. The VAT decision is a Titlul VII question about the document, so it reads the
  // document's own amounts. This also finally matches the population to the comment above it, which already
  // said „every registered expense line in the period, NOT only the deductible subset”.
  const periodExpenses = (ledger.data.expenses ?? []).filter(
    (e) => e.status === 'inregistrata' && inPeriod(expenseFiscalDate(e), asOfDate, scoped.profile.fiscalYear),
  );
  const inputVat: InputVatDecision = decideInputVat({
    expenses: periodExpenses.map((e) => ({
      id: e.id,
      date: e.date,
      paid: e.paid,
      supplierCui: e.cui,
      tip: e.tip,
      tva: e.tva,
      vatFacts: e.vatFacts,
      vehicleId: e.vehicleId,
    })),
    vehicles: (scoped.vehicles ?? []).map((v) => ({ id: v.id, years: v.vatYears })),
    registration: scoped.profile.vatRegistration,
    vatExceedanceDate: scoped.profile.vatExceedanceDate,
    proRataYears: scoped.profile.vatProRataYears,
    fiscalYear: scoped.profile.fiscalYear,
    asOfDate,
  });
  // Which deductible records entered the engine through a half-count rule. Read off the record the
  // classifier scaled, not re-derived: `selectDeductibleExpenses` returns a capped record as a scaled
  // copy of the stored one, so a net that differs from the stored net is the cap having bitten. Comparing
  // the two is arithmetic on facts already in hand; re-running the classifier to answer it would be a
  // second producer of one figure.
  const storedNetById = new Map<string, Bani>(
    ledger.data.expenses.map((e) => [e.id, isRon(e.valoareFaraTva) ? e.valoareFaraTva.amount : lei(0)]),
  );
  const deductibleForVat = deductible.records.map((r) => ({
    id: r.id,
    tva: requireRon(r.tva, `expense ${r.id}.tva`),
    capped: (storedNetById.get(r.id) ?? r.valoareFaraTva.amount) !== r.valoareFaraTva.amount,
  }));
  const vatExpenseBase = (amounts: EstimateAmounts): ExpenseBaseWithVat =>
    applyVatToExpenseBase(inputVat, amounts.expensesNet, deductibleForVat);

  if (deductible.annualCapped.length === 0) {
    const amounts = withDpiGrosses(
      withDepreciation(
        withFlatRatioGross(
          amountsForEstimate(basisBeforeCaps),
          flatRatioGross,
          method,
          cedareWithholdingBlocked,
        ),
      ),
      dpiYtd.dpiQuotaGross,
      dpiYtd.dpiExcludedGross,
    );
    return {
      kind: 'run',
      basis: basisBeforeCaps,
      amounts,
      expenseBase: vatExpenseBase(amounts),
      inputVat,
      deductible,
      capAdjustments: [],
      conversions: ledger.conversions,
      provisionalIncomeRates,
      scenarios,
      depreciation,
    };
  }

  // Pass 2. The ceiling is struck on the annual quantity, and since PG-5C the annual quantity is the
  // recorded one — see `applyAnnualDeductibilityCaps` and `claimAnnualMeasure` for why, and for what
  // those two decisions pin.
  const claims: CapClaim[] = deductible.annualCapped.map((line) => ({
    line,
    claimed: claimAnnualMeasure(line),
  }));
  const { basis, adjustments } = applyAnnualDeductibilityCaps(basisBeforeCaps, claims);
  const amounts = withDpiGrosses(
    withDepreciation(
      withFlatRatioGross(amountsForEstimate(basis), flatRatioGross, method, cedareWithholdingBlocked),
    ),
    dpiYtd.dpiQuotaGross,
    dpiYtd.dpiExcludedGross,
  );
  return {
    kind: 'run',
    basis,
    amounts,
    expenseBase: vatExpenseBase(amounts),
    inputVat,
    deductible,
    capAdjustments: adjustments,
    conversions: ledger.conversions,
    provisionalIncomeRates,
    scenarios,
    depreciation,
  };
}

/**
 * The engine’s result plus the basis that produced it. This is an intersection, not a new shape:
 * it stays assignable to `TaxEstimateResult`, so every consumer that does not care about the basis
 * keeps compiling and keeps reading exactly the fields it read before.
 *
 * PG-6a adds `scenarios`, and adds it as optional on purpose. It is produced by exactly one place —
 * `selectEstimateOperands`, the one evaluation point — and a result that never went through the
 * assembler (a hand-built fixture, a stored snapshot) genuinely has no scenario answer rather than an
 * empty one. Reading `?? []` at the surface keeps that distinction visible instead of pretending every
 * result was screened.
 */
export type TaxEstimateWithBasis = TaxEstimateResult & {
  basis: TaxEstimateBasis;
  scenarios?: ScenarioOutcome[];
  /**
   * PG-6f (D-VAT-3) — the per-line input-VAT decision that produced the expense base, carried rather than
   * re-derived so a surface can show the claimable total without running a second pass over the ledger.
   *
   * Optional for the same reason `scenarios` is: a result that never went through `selectEstimateOperands`
   * (a hand-built fixture, a stored snapshot) genuinely has no VAT answer rather than an empty one. A
   * refused estimate has none either — the refusal happened before the decision ran.
   */
  inputVat?: InputVatDecision;
  /**
   * B-144 — the provisional annual averages the income measure was converted with, carried rather than
   * re-derived for the same reason `inputVat` is.
   *
   * Optional because a result that never went through `selectEstimateOperands` — a hand-built fixture, a
   * stored snapshot taken before this field existed — genuinely has no answer here rather than an empty
   * list. A surface must read `undefined` as "this estimate never said", not as "nothing was provisional".
   */
  provisionalIncomeRates?: ProvisionalRateEvidence[];
  /**
   * B-93 — the depreciation leg the estimate was built with, including the schedules it **withheld**.
   *
   * Optional for the same reason `scenarios` and `inputVat` are: a result that never went through
   * `selectEstimateOperands` has no depreciation answer rather than an empty one. It travels rather than
   * being re-derived at the surface because a second walk of the register is how the figure and the
   * coverage rows come to disagree about the same asset — the B-70 defect class in a new costume.
   */
  depreciation?: DepreciationLeg;
};

export function attachEstimateBasis(
  result: TaxEstimateResult,
  basis: TaxEstimateBasis,
  scenarios?: readonly ScenarioOutcome[],
  inputVat?: InputVatDecision,
  depreciation?: DepreciationLeg,
  provisionalIncomeRates?: ProvisionalRateEvidence[],
): TaxEstimateWithBasis {
  const attached: TaxEstimateWithBasis = scenarios === undefined
    ? { ...result, basis }
    : { ...result, basis, scenarios: [...scenarios] };
  const withVat = inputVat === undefined ? attached : { ...attached, inputVat };
  const withDep = depreciation === undefined ? withVat : { ...withVat, depreciation };
  return provisionalIncomeRates === undefined
    ? withDep
    : { ...withDep, provisionalIncomeRates };
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
 * The months phrase, now attached only to a forecast.
 *
 * It used to sit beside the fiscal figure, which is how B-72 arose: a sentence about months next to a
 * number that was not computed over months. Since PG-5C the fiscal figure is a register read at a date
 * and says nothing about months, so this phrase belongs to the run-rate forecast alone — where the
 * months ARE the arithmetic.
 *
 * With an active period known, the sentence names it. With none known, it states the elapsed measure
 * and stops: a wording layer that has not been given the active period must not borrow 12 from the
 * calendar to fill the gap.
 */
function monthsPhrase(forecast: { elapsedMonths: number | null; activeMonths?: number }): string {
  const elapsed = formatElapsedMonths(forecast.elapsedMonths ?? 0);
  const active = forecast.activeMonths;
  if (typeof active === 'number' && Number.isFinite(active) && active > 0) {
    return `${elapsed} din ${formatElapsedMonths(active)} luni de activitate`;
  }
  return `${elapsed} luni scurse`;
}

/**
 * The label over the fiscal figure.
 *
 * It names the quantity the number actually is: money that was collected and paid, read out of the
 * register at a date. It must not say „anuală pe rată de desfășurare”, because that described a
 * grossing-up the law does not perform and the app no longer does either. A closed year gets its own
 * words because its register happens to cover the whole year — the figure is final, not merely current.
 */
export function estimateBasisLabel(basis: TaxEstimateBasis | null | undefined): string {
  if (!basis || basis.kind === 'unknown') return 'Estimare impozit';
  if (basis.kind === 'refused') return 'Nu putem calcula';
  if (basis.closed) return 'Calcul final pe înregistrările anului';
  return 'Calculat din încasări și plăți înregistrate';
}

/**
 * The short label for one figure.
 *
 * These wording functions accept `undefined` as well as `null`: a result that never had a basis
 * attached (a hand-built fixture, the loading sentinel) is a real case, and the honest answer for it
 * is the neutral label — never a crash, and never a guess about what was measured.
 */
export function estimateFigureLabel(basis: TaxEstimateBasis | null | undefined): string {
  if (!basis || basis.kind === 'unknown') return 'Estimare impozit';
  if (basis.kind === 'refused') return 'Nu putem calcula';
  if (basis.closed) return 'Impozit final pe înregistrările anului';
  return 'Impozit calculat din încasări și plăți înregistrate';
}

/**
 * One sentence that states what the displayed amounts are, and — just as important after PG-5C — what
 * they are not. The citation is art. 118 alin. (3), the deeming rule that makes a fraction-of-year
 * amount the annual amount; alin. (2) is the pre-2024 numbering of the same sentence and must not be
 * cited here.
 *
 * The claim is scoped to the code and to the calculation: it says what this app measured. It does not
 * assert that proration no longer appears in the Norme metodologice — `research/26` §5 records that the
 * norms reproduced in ANAF's current edition still contain prorating language, and their status after
 * HG 602/2025 is unverified.
 */
export function estimateBasisExplanation(basis: TaxEstimateBasis | null | undefined): string {
  if (!basis || basis.kind === 'unknown') {
    return 'Baza acestei estimări nu este înregistrată, deci valorile nu pot fi prezentate nici ca realizate, nici ca proiectate.';
  }
  if (basis.kind === 'refused') {
    // PG-6a — the rule's own sentence is rendered once, in the refusal block beside the control that
    // fixes it. Quoting it again here is how one legal paragraph ends up printed three times on one
    // screen, which is what the B-14 tests caught the first time this changed.
    return 'Calculul nu s-a făcut, deci nu există valori de afișat. Motivul este redat integral mai sus, în aceeași secțiune.';
  }
  if (basis.closed) {
    return (
      `Anul fiscal ${basis.asOfDate.slice(0, 4)} s-a încheiat. Valorile de mai jos sunt încasările încasate și `
      + 'plățile plătite în acel an, fără nicio annualizare.'
    );
  }
  return (
    `Valorile de mai jos sunt calculate din încasările efectiv încasate și cheltuielile efectiv plătite până la `
    + `data de ${basis.asOfDate}. Nu sunt o rată de desfășurare dusă la an: art. 118 alin. (3) din Codul fiscal `
    + 'consideră venit anual și venitul realizat într-o fracțiune de an.'
  );
}

/**
 * The label over a run-rate forecast shown beside the fiscal figure.
 *
 * It has to read as a forecast in its own words, not as a second estimate, because the two numbers
 * differ and only one of them is a legal quantity. `null` renders as an empty string rather than a
 * hedge: a surface that has no forecast has nothing to label, and inventing a label for nothing is how
 * a caption starts describing a figure that is not there.
 */
export function estimateForecastLabel(forecast: RunRateForecast | null | undefined): string {
  if (!forecast) return '';
  return `Previziune pe rată de desfășurare (${monthsPhrase(forecast)})`;
}

/**
 * What a forecast is, in one sentence, next to the forecast.
 *
 * The sentence has to carry the denial itself — that this number feeds neither the tax, nor the
 * contributions, nor the thresholds — because a number in a box looks like a figure the app believes,
 * and D-PROJ-1's unresolved half is precisely that a mid-year reader could otherwise take a threshold
 * result as settled for the whole year.
 */
export function estimateForecastExplanation(forecast: RunRateForecast | null | undefined): string {
  if (!forecast) return '';
  return (
    'Aceasta este o previziune, nu o cifră fiscală. Ea presupune că lunile rămase din perioada de activitate '
    + `vor repeta rata lunilor înregistrate până acum (${monthsPhrase(forecast)}). Nu alimentează calculul `
    + 'impozitului, al contribuțiilor sau a pragurilor — acestea sunt măsurate doar pe înregistrările reale.'
  );
}
