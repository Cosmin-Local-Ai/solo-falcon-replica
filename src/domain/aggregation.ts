import type { AppData, Expense, Revenue } from '../data/types';
// B-112 stage 1 — the income-category predicate is imported from the one layer that owns it, so the
// aggregation pass and the estimate assembler cannot answer "is this receipt DPI?" differently.
import { isDpiArt72Alin3Excluded, isDpiIncome } from './dpi';
import { isISOCalendarDate, isoCalendarDateProblem, isoCalendarDateProblemText } from './date';
// B-139: the field a fiscal date came from is named in Romanian, from the one map that owns those words.
// Raw property names are what the compiler reads; they are not what a person reads. Same pattern as
// `domain/insights.ts`, which already imports this map.
import { fiscalDateSource } from '../ui/copy/records';
import { addBani, isRon, lei, subBani, sumBani, type Bani, type CurrencyCode, type Money } from './money';
import type { ThresholdKind, ThresholdSeverity } from './thresholds';

/**
 * Deterministic financial aggregation selectors (Step 13, Part A).
 *
 * Pure domain module: no React, no DOM, no localStorage, no store imports.
 * Every function is deterministic for the same (data, asOfDate) inputs.
 *
 * Rules:
 * - Only records with `status === 'inregistrata'` are aggregated.
 * - Record total = `valoareFaraTva + tva` (there is no stored total field).
 * - Fiscal year boundary = `profile.fiscalYear` (calendar year): the
 *   fiscal period starts on `${fiscalYear}-01-01`.
 * - `asOfDate` (ISO 'YYYY-MM-DD') is the inclusive upper bound of the period.
 */

/**
 * Year-to-date amounts, in lei. Each field is ONE named amount concept; the VAT-inclusive
 * and VAT-exclusive families are distinct quantities and must never be substituted for
 * each other.
 *
 * `net` is `revenue - expenses` on VAT-INCLUSIVE operands — a cash profit figure. It is
 * NOT the fiscal `venitul net din activitate` that CAS/CASS are owed on; that quantity is
 * owned by the tax engine (`src/domain/tax.ts` → `TaxAmountBases.venitulNetDinActivitate`).
 */
export interface YtdTotals {
  // Phase 10: every amount here is an integer number of bani. Summing integers is exact, so the YTD figure
  // no longer depends on the order the records were added in — `revenue` for the same set of records is the
  // same number whether they arrived oldest-first or newest-first.
  /** Cash collected: `valoareFaraTva + tva`. */
  revenue: Bani;
  /** Cash paid: `valoareFaraTva + tva`. */
  expenses: Bani;
  /** `revenue - expenses`, both VAT-inclusive. Cash profit — not a fiscal contribution base. */
  net: Bani;
  /** **Cifră de afaceri**: `valoareFaraTva` only. The base CF art. 310 alin. (1) measures. */
  revenueNet: Bani;
  /** Deductible expense excluding VAT: `valoareFaraTva` only. */
  expenseNet: Bani;
  /**
   * B-112 — the part of `revenue` that is art. 70 *drepturi de proprietate intelectuală* income, and the
   * part of `revenueNet` that is the same receipts without VAT.
   *
   * A **subset marked on the same pass**, not a replacement, and that choice is deliberate. `revenue` is
   * cash collected and `revenueNet` is *cifră de afaceri* — the base the art. 310 alin. (1) VAT plafon row
   * measures — and authorship is a *prestare de servicii* for Titlul VII purposes, so moving DPI receipts
   * out of those two totals would understate the VAT registration duty in order to fix an income-tax one.
   * What the income side needs is not a smaller total but a named part of it, and that is what these two
   * fields are. `estimateBasis.ts` scopes the **engine's** sistem-real operands to the non-DPI record set;
   * the split is decided once, by `incomeCategoryOf`, and nowhere else.
   *
   * Zero when the register holds no DPI receipts, which is every payload written before B-112.
   */
  dpiGross: Bani;
  dpiGrossNet: Bani;
  /**
   * B-112 — the ids of the receipts that make up `dpiGross`, in register order.
   *
   * They travel with the totals so a coverage row can point at a DPI receipt **without re-deciding which
   * receipts fall in the year**. That is the whole reason this field exists rather than a separate selector:
   * `selectYtd` is the one place the period, status and currency tests run, and a second walk applying them
   * again is the B-70 defect class — two producers that drift the moment either changes.
   */
  dpiRecordIds: readonly string[];
  /**
   * B-117 — the ids of the in-period receipts that carry a DPI **contract fact** (`dpiContractType` or
   * `dpiExcludedKind`) on the record, whatever category the person declared beside it.
   *
   * This is not a second answer to "is this DPI income" — `dpiRecordIds` remains the only one of those, and
   * `incomeCategoryOf` remains the only place it is decided. The test here is field **presence**, which is
   * structural: a receipt declared art. 67 that still carries a cesiune / licență or an art. 72 alin. (3)
   * flag has answered the same question twice, and `dpiRecordIds` cannot see it because the category put the
   * record outside art. 70. Whether the pair actually contradicts is `domain/dpi.ts dpiRecordConflict`'s
   * question, asked in `estimateBasis.ts`; this list only says which records have a pair to ask about.
   *
   * Collected in the SAME pass and under the SAME period, status and convertibility filter as
   * `dpiRecordIds`, for the SAME reason: a second walk over the register would be a second producer of
   * "which receipts fall in this year" — the B-70 defect class.
   */
  dpiDeclaredRecordIds: readonly string[];
  /**
   * B-147 / B-150 — the DPI gross cut by the ONE fact that decides both of its consequences.
   *
   * `dpiGross` is the whole art. 70 subset. These two are that subset cut where the Cod fiscal cuts it:
   * art. 72 alin. (3) / art. 72¹ alin. (2) name three sums — moștenitori, drept de suită, remunerația
   * pentru copia privată — and take them out of the forfetară mechanism. So `dpiQuotaGross` carries no
   * art. 72 alin. (3) flag and gets the 40 % quota of art. 72 alin. (2) / art. 72¹ alin. (1) (net = 0,6 ×
   * gross), while `dpiExcludedGross` carries one, gets **no quota at all** (net = gross), and is outside
   * CAS because art. 137 alin. (1) lit. b¹) carves it out of the DPI CAS category at the definition.
   *
   * The cut is made here, not downstream, for two reasons: it is decided by the SAME predicate the rest of
   * the app reads — `dpi.ts isDpiArt72Alin3Excluded`, one flag with two consequences — and under the SAME
   * period, status and convertibility filter as `dpiGross`. A second cut elsewhere would be a second
   * producer of one legal fact, the B-70/B-85 class.
   *
   * `dpiGross === dpiQuotaGross + dpiExcludedGross`, asserted in `aggregation.test.ts`.
   */
  dpiQuotaGross: Bani;
  dpiExcludedGross: Bani;
}

export interface MonthlyTotals {
  revenue: Bani;
  expenses: Bani;
  net: Bani;
  /** B-112 — the art. 70 DPI part of `revenue` for this month. Same subset-marking rule as `YtdTotals`. */
  dpiGross: Bani;
}

/**
 * Dashboard-level snapshot consumed by the insights engine (Step 17).
 * Aggregated, presentation-ready view: completeness gaps, near deadlines,
 * threshold breaches, and the tax-reserve position as of `asOf`.
 */
/**
 * Threshold status as surfaced in the dashboard snapshot.
 * `current` is `null` when the threshold could not be measured (its required base was
 * unavailable) — see `FiscalThreshold.currentValue`.
 */
export interface Threshold {
  id: string;
  label: string;
  current: Bani | null;
  limit: Bani;
  /** `current / limit`, or 0 when unmeasured / uncapped. */
  ratio: number;
  breached: boolean;
  /**
   * Which threshold family this belongs to, when known. Kept for the existing snapshot readers;
   * the alert wording no longer depends on it — `kind` carries the legal meaning instead.
   */
  type?: 'income' | 'vat' | 'tier-floor';
  /** Tax this threshold affects (e.g. 'cass', 'vat'). */
  affectedTax?: string;
  /**
   * TASK 4 — the legal kind, passed through from `FiscalThreshold.kind`. This is what an alert is
   * worded from, so the CF citation lives in one place (`thresholds.ts`) instead of being
   * re-invented per file by `insights.ts`.
   */
  kind: ThresholdKind;
  /**
   * TASK 4 — is the measured value on the side of the level where the row's consequence applies?
   * Carried because `breached` no longer answers it: a `tier_transition` row can be engaged without
   * being a breach, and an alert must be able to tell "the level applies" from "a limit was exceeded".
   */
  engaged: boolean;
  /**
   * TASK 4 — the user-attention level decided in the domain (`severityFor`, which never reads the
   * legal kind). `insights.ts` filters and ranks on this instead of re-deriving its own `ratio >= 0.8`
   * band, which was a second, uncited copy of the same application policy.
   */
  severity: ThresholdSeverity;
  /** TASK 4 — the factual, cited consequence of where the measured value sits. */
  consequence: string;
  /** TASK 4 — why no verdict could be given, for an unmeasured row. */
  reviewReason?: string;
}

export interface DashboardSnapshot {
  asOf: string;
  taxYear: number;
  missing: string[];
  stale: string[];
  deadlines: Array<{ id: string; label: string; daysUntil: number; date: string }>;
  thresholds: Threshold[];
  /**
   * Cash-planning figures in integer **bani**.
   *
   * These were `*Cents` fields fed by a `* 100` lei→cents bridge in `data/dashboard.ts`. Once the domain
   * itself stores bani, a ban IS a cent, so that bridge became a double conversion (it multiplied money by
   * 100 a second time). The fields are renamed to `*Bani` so the name cannot outlive the unit, and the
   * bridge is gone: the value is passed straight through.
   */
  taxReserve: {
    projectedLiabilityBani: Bani;
    targetReserveBani: Bani;
    currentReserveBani: Bani;
    gapBani: Bani;
    coverageMonths: number;
    projectedQ4LiabilityBani: Bani;
    taxYear: number;
  };
}

/**
 * A record's total **in lei**, or `null` when the record is not written in lei.
 *
 * TASK 10a (B-32). Before this, `recordTotal` summed two numbers that were assumed to be lei. A EUR
 * invoice summed into that total is a lei figure that was never a lei figure — the exact defect. The
 * `null` is the honest answer: this record has no lei total, because converting it needs a rate, a date
 * or year to key it to, and a basis, and none of those exist on the record.
 *
 * The callers below **skip** a `null` rather than throw. Throwing would take the whole dashboard down over
 * one foreign-currency record; summing it would lie. Skipping is only acceptable because the skip is
 * visible — `selectUnconvertedRecords` names every record left out, and the registers render it. A silent
 * exclusion is what B-21 was about, and it is not what this is.
 */
function recordTotal(r: Pick<Revenue, 'valoareFaraTva' | 'tva'>): Bani | null {
  if (!isRon(r.valoareFaraTva) || !isRon(r.tva)) return null;
  return sumBani([r.valoareFaraTva.amount, r.tva.amount]);
}

/** A single amount in lei, or `null` when it is in another currency. */
function leiAmount(amount: Money): Bani | null {
  return isRon(amount) ? amount.amount : null;
}

/**
 * The records the lei totals above deliberately left out, with the currency they are written in and the
 * datum that kept them out.
 *
 * This is the visibility half of `recordTotal`'s `null`. Until Phase 10c the app could store a
 * foreign-currency amount and had no way to bring it into the lei operands at all. It can now —
 * `domain/fx/ledger.ts` converts at the BNR daily rate on the money date — so a record reaching this list
 * means something narrower than it used to: **the store holds no rate for that currency on that date, or
 * the record has no usable money date to anchor one.** That is why `detail` is part of the shape: "it is
 * in EUR" is not a reason, "there is no recorded EUR rate for 2026-04-15" is.
 *
 * The caller that ran the conversion pass supplies the `detail`s; a caller that did not gets the generic
 * sentence, which is still honest — the record is not in lei and the totals above do not contain it.
 */
export interface UnconvertedRecord {
  id: string;
  kind: 'revenue' | 'expense';
  currency: CurrencyCode;
  /** The amount that is out of the totals, in the currency it is written in. */
  amount: Money;
  /** The datum that is missing, in the words the register shows. */
  detail: string;
}

/** A `detail` supplied by the conversion pass, keyed by record id. */
export type UnconvertedDetail = { recordId: string; detail: string };

export function selectUnconvertedRecords(
  data: AppData,
  details: readonly UnconvertedDetail[] = [],
): UnconvertedRecord[] {
  const byId = new Map(details.map(d => [d.recordId, d.detail]));
  const out: UnconvertedRecord[] = [];
  const push = (record: Revenue | Expense, kind: 'revenue' | 'expense'): void => {
    const foreign = [record.valoareFaraTva, record.tva].find(a => !isRon(a));
    if (foreign === undefined) return;
    out.push({
      id: record.id,
      kind,
      currency: foreign.currency,
      amount: foreign,
      detail:
        byId.get(record.id) ??
        `înregistrarea este în ${foreign.currency}, iar totalurile de mai sus sunt în lei; nu există curs `
        + 'BNR înregistrat pentru această sumă, deci nu intră în niciun total în lei.',
    });
  };
  for (const r of data.revenues) push(r, 'revenue');
  for (const e of data.expenses) push(e, 'expense');
  return out;
}

function inFiscalYear(date: string, fiscalYear: number): boolean {
  return Number(date.slice(0, 4)) === fiscalYear;
}

export function inPeriod(date: string, asOfDate: string, fiscalYear: number): boolean {
  // B-21. This used to be a bare lexicographic comparison, which meant an unusable date
  // (`''`, `'2026-6-1'`, `'2026-13-01'`) failed the comparison by accident and the record
  // vanished from every total with no trace. The guard makes the rejection deliberate, and
  // `auditFiscalDates` below is what makes it VISIBLE — a record is excluded from the
  // aggregate and reported as `review_required`, never silently deleted.
  //
  // The comparison itself stays lexicographic, and that is now provable rather than
  // assumed: `isISOCalendarDate` fixes the width (4-2-2, zero-padded) and rejects days that
  // do not exist, so for any two accepted strings the character order and the chronological
  // order agree — which is the defining property of fixed-width ISO 8601 calendar dates.
  // Before the guard, `'2026-6-1' <= '2026-06-15'` was FALSE (`'6' > '0'`): a real June day
  // sorted after mid-June. That mis-sort is now unreachable, because such a value never
  // reaches the comparison at all.
  if (!isISOCalendarDate(date)) return false;
  return inFiscalYear(date, fiscalYear) && date <= asOfDate;
}

// ── B-21: the exclusion report ────────────────────────────────────────────────

/** The field a fiscal date actually came from. */
export type FiscalDateField = 'date' | 'collected' | 'paid';

/**
 * A record the aggregate cannot place in time. It is NOT dropped and NOT repaired: it is
 * reported, with the field and the offending value named, so the exclusion is visible.
 * `status` deliberately reuses the engine's existing `review_required` vocabulary — the
 * same one `computeThresholds` uses when a base was never supplied — because the honest
 * statement here is "the engine refuses to decide", not "there is nothing here".
 */
export interface ExcludedFiscalDate {
  id: string;
  kind: 'revenue' | 'expense';
  field: FiscalDateField;
  value: string;
  status: 'review_required';
  reason: string;
}

/**
 * Every revenue/expense whose FISCAL date — `collected ?? date`, `paid ?? date`, exactly as
 * `revenueFiscalDate`/`expenseFiscalDate` resolve it — is not a usable ISO calendar date.
 *
 * Audited for every record, not only `status === 'inregistrata'` ones: only the registered
 * ones move money today, but an unusable date on a pending record is the same defect and
 * will move money the moment its status changes. The report is ordered by input order, so
 * it is deterministic.
 *
 * This function deliberately repairs nothing. The Phase 9 `payment-dates` chain step set the
 * pattern — absence is the honest state when there is no real source — and a date invented
 * here would move money between fiscal years on a guess.
 */
export function auditFiscalDates(data: AppData): ExcludedFiscalDate[] {
  const excluded: ExcludedFiscalDate[] = [];
  const report = (id: string, kind: 'revenue' | 'expense', field: FiscalDateField, value: string): void => {
    const problem = isoCalendarDateProblem(value);
    if (problem === null) return;
    excluded.push({
      id,
      kind,
      field,
      value,
      status: 'review_required',
      reason:
        `„${value === '' ? '(necompletat)' : value}” pe câmpul „${fiscalDateSource[field]}” nu este o dată calendaristică reală ` +
        `(${isoCalendarDateProblemText(problem)}); înregistrarea este exclusă din agregat până la corectare.`,
    });
  };
  for (const r of data.revenues) {
    // B-159: a declared non-collection is not an unusable date, it is an answer. Reporting it as
    // `review_required` would ask the person to correct a fact they have already stated correctly.
    if (revenueDeclaredUncollected(r)) continue;
    report(r.id, 'revenue', r.collected !== undefined ? 'collected' : 'date', revenueFiscalDate(r));
  }
  for (const e of data.expenses) {
    if (expenseDeclaredUnpaid(e)) continue;
    report(e.id, 'expense', e.paid !== undefined ? 'paid' : 'date', expenseFiscalDate(e));
  }
  return excluded;
}

/**
 * The date a revenue is attributed to a fiscal year.
 *
 * **CF art. 68 alin. (2) lit. a)** measures venit brut by „**sumele încasate**" — amounts
 * **COLLECTED**. Collection is therefore the fiscally load-bearing date for a revenue.
 *
 * A record with no recorded collection date falls back to its single legacy `date`: **the legacy
 * `date` IS the fiscal date** (Phase 9 decision, pinned by `aggregation.test.ts`). The v2→v3
 * migration deliberately refuses to invent a collection event, so the fallback is where that
 * assumption lives — it is not a guess per record, it is the reading of a field that was always
 * ambiguous. The invoice **issue** date is not a timing gate (see `docs/ai/research/10` §2).
 *
 * **B-159 — a declared non-collection is not a legacy ambiguity.** `collected === null` is the person
 * saying the money has not come in. Art. 68 alin. (2) lit. a) counts venit brut by „sumele încasate”,
 * and `docs/ai/research/37` §2.1 and §5 sentence 3 say so in those words, so such a receipt has **no
 * fiscal date at all**: the resolver returns the empty date, every `inPeriod` test fails on it, and the
 * record stays out of the base. That is the half the copy has been asserting since PG-2 while the engine
 * did the opposite. Absence of the key is NOT that declaration — it is the legacy reading above, and
 * collapsing the two would have deleted the entire seed register from the base.
 */
export function revenueFiscalDate(r: Pick<Revenue, 'date' | 'collected'>): string {
  if (r.collected === null) return NO_MONEY_DATE;
  return r.collected ?? r.date;
}

/**
 * The resolved date of a record whose money has provably not moved. `inPeriod` rejects it because it is
 * not a calendar date, which is exactly the intended effect: no money date, no fiscal year, no base.
 * It is a sentinel, not a date, and nothing may format it as one.
 */
export const NO_MONEY_DATE = '';

/** The declared state behind `NO_MONEY_DATE` on each side — one predicate each, so no consumer re-spells it. */
export const revenueDeclaredUncollected = (r: Pick<Revenue, 'collected'>): boolean => r.collected === null;
export const expenseDeclaredUnpaid = (e: Pick<Expense, 'paid'>): boolean => e.paid === null;

/**
 * The date an expense is attributed to a fiscal year.
 *
 * **CF art. 68 alin. (4) lit. b)** requires expenses be „cuprinse în cheltuielile exercițiului
 * financiar **al anului în cursul căruia au fost plătite**" — the year in which they were **PAID**.
 * The consequence is attribution, not punishment: there is no late-payment disallowance in the
 * Cod fiscal (`docs/ai/research/10` §1 — the "15-day collection threshold" does not exist), so a
 * late-paid expense simply lands in the payment year.
 *
 * **B-159:** `paid === null` is the declared „not paid yet” state. Art. 68 alin. (4) lit. b) is a
 * condition, not a deadline (`docs/ai/research/37` §3.3), so a never-paid expense never enters the
 * deductible base at all — it resolves to no fiscal date rather than to the document's date.
 */
export function expenseFiscalDate(e: Pick<Expense, 'date' | 'paid'>): string {
  if (e.paid === null) return NO_MONEY_DATE;
  return e.paid ?? e.date;
}

/**
 * B-67 — how many records the app attributed to a fiscal year by their **document** date because no
 * money date is recorded.
 *
 * `revenueFiscalDate` / `expenseFiscalDate` fall back to `date` when `collected` / `paid` is absent. That
 * fallback is the whole of D-DATE-1's stand-in, and it has no legal footing: for Titlul IV the document
 * date is a validity condition (art. 68 alin. (4) lit. a) — „justificate prin documente”), never the
 * year-determining fact, which is art. 68 alin. (2) lit. a) „sumele încasate” and alin. (4) lit. b) „al
 * anului în cursul căruia au fost plătite”. No provision presumes document date = money date, and none
 * fills in a blank money date.
 *
 * The behaviour stays — choosing a different date is a user decision, not a defect fix. What was missing
 * is that the count is available to be said. It is one function so the RJIP export and the estimate
 * cannot grow two answers to one question.
 */
export function countPostedOnDocumentDate(
  revenues: readonly Pick<Revenue, 'date' | 'collected'>[],
  expenses: readonly Pick<Expense, 'date' | 'paid'>[],
  fiscalYear: string,
): number {
  let n = 0;
  for (const r of revenues) {
    if (revenueFiscalDate(r).slice(0, 4) !== fiscalYear) continue;
    if (r.collected === undefined) n += 1;
  }
  for (const e of expenses) {
    if (expenseFiscalDate(e).slice(0, 4) !== fiscalYear) continue;
    if (e.paid === undefined) n += 1;
  }
  return n;
}

function monthKey(date: string): string {
  return date.slice(0, 7); // 'YYYY-MM'
}

/**
 * Year-to-date totals for the fiscal year `data.profile.fiscalYear`,
 * from `${fiscalYear}-01-01` up to and including `asOfDate`.
 */
export function selectYtd(data: AppData, asOfDate: string): YtdTotals {
  const fiscalYear = data.profile.fiscalYear;
  // `addBani`, not `+=`: `Bani + Bani` widens to `number` and drops the brand.
  let revenue: Bani = lei(0);
  let expenses: Bani = lei(0);
  let revenueNet: Bani = lei(0);
  let expenseNet: Bani = lei(0);
  let dpiGross: Bani = lei(0);
  let dpiGrossNet: Bani = lei(0);
  const dpiRecordIds: string[] = [];
  const dpiDeclaredRecordIds: string[] = [];
  let dpiQuotaGross: Bani = lei(0);
  let dpiExcludedGross: Bani = lei(0);

  for (const r of data.revenues) {
    const fiscalDate = revenueFiscalDate(r);
    const net = leiAmount(r.valoareFaraTva);
    const total = recordTotal(r);
    if (r.status === 'inregistrata' && total !== null && net !== null && inPeriod(fiscalDate, asOfDate, fiscalYear)) {
      revenue = addBani(revenue, total);
      revenueNet = addBani(revenueNet, net);
      // B-112 — the DPI part is marked here, inside the same pass and under the same period and status
      // filter, because a second walk over the register would be a second producer of "which receipts fall
      // in this year" — the B-70 defect class. `incomeCategoryOf` is the one place that question is answered.
      if (isDpiIncome(r)) {
        dpiGross = addBani(dpiGross, total);
        dpiGrossNet = addBani(dpiGrossNet, net);
        dpiRecordIds.push(r.id);
        // B-150 — one flag, cut once. `isDpiArt72Alin3Excluded` is the single predicate the whole app reads
        // for both consequences (no flat quota, and outside CAS); splitting on anything else would let the
        // quota path and the CAS path disagree about which receipts are excluded.
        if (isDpiArt72Alin3Excluded(r.dpiExcludedKind)) {
          dpiExcludedGross = addBani(dpiExcludedGross, total);
        } else {
          dpiQuotaGross = addBani(dpiQuotaGross, total);
        }
      }
      // B-117 — field presence only, never a legal reading. A record the category puts outside art. 70 but
      // that still carries one of the two DPI contract facts is the pair `dpiRecordConflict` checks; it is
      // invisible to `dpiRecordIds`, and that is the whole of defect B-117.
      if (r.dpiContractType !== undefined || r.dpiExcludedKind !== undefined) {
        dpiDeclaredRecordIds.push(r.id);
      }
    }
  }
  for (const e of data.expenses) {
    const fiscalDate = expenseFiscalDate(e);
    const net = leiAmount(e.valoareFaraTva);
    const total = recordTotal(e);
    if (e.status === 'inregistrata' && total !== null && net !== null && inPeriod(fiscalDate, asOfDate, fiscalYear)) {
      expenses = addBani(expenses, total);
      expenseNet = addBani(expenseNet, net);
    }
  }

  return {
    revenue, expenses, net: subBani(revenue, expenses), revenueNet, expenseNet,
    dpiGross, dpiGrossNet, dpiRecordIds, dpiDeclaredRecordIds, dpiQuotaGross, dpiExcludedGross,
  };
}

/**
 * Monthly breakdown (keys 'YYYY-MM') of the same YTD period:
 * `${fiscalYear}-01-01` up to and including `asOfDate`.
 */
export function selectMonthly(data: AppData, asOfDate: string): Map<string, MonthlyTotals> {
  const fiscalYear = data.profile.fiscalYear;
  const monthly = new Map<string, MonthlyTotals>();

  const add = (key: string, field: 'revenue' | 'expenses' | 'dpiGross', amount: Bani): void => {
    const entry = monthly.get(key) ?? { revenue: lei(0), expenses: lei(0), net: lei(0), dpiGross: lei(0) };
    entry[field] = addBani(entry[field], amount);
    entry.net = subBani(entry.revenue, entry.expenses);
    monthly.set(key, entry);
  };

  for (const r of data.revenues) {
    const fiscalDate = revenueFiscalDate(r);
    const total = recordTotal(r);
    if (r.status === 'inregistrata' && total !== null && inPeriod(fiscalDate, asOfDate, fiscalYear)) {
      add(monthKey(fiscalDate), 'revenue', total);
      // B-112 — same single pass, same filter. `net` is not derived from the monthly figures, so marking a
      // subset of `revenue` here cannot move it.
      if (isDpiIncome(r)) add(monthKey(fiscalDate), 'dpiGross', total);
    }
  }
  for (const e of data.expenses) {
    const fiscalDate = expenseFiscalDate(e);
    const total = recordTotal(e);
    if (e.status === 'inregistrata' && total !== null && inPeriod(fiscalDate, asOfDate, fiscalYear)) {
      add(monthKey(fiscalDate), 'expenses', total);
    }
  }

  return monthly;
}
