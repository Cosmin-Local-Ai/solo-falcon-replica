import type { AppData, Expense, Revenue } from '../data/types';
import { isISOCalendarDate, isoCalendarDateProblem, isoCalendarDateProblemText } from './date';
import { addBani, lei, subBani, sumBani, type Bani } from './money';

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
}

export interface MonthlyTotals {
  revenue: Bani;
  expenses: Bani;
  net: Bani;
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
   * Which threshold family this belongs to, when known. `tier-floor` is carried through because
   * its alert wording differs from a limit breach: crossing it steps the minimum CAS base up a
   * tier (CF art. 148 alin. (2) lit. b)), it does not exceed a cap.
   */
  type?: 'income' | 'vat' | 'tier-floor';
  /** Tax this threshold affects (e.g. 'cass', 'vat'). */
  affectedTax?: string;
}

export interface DashboardSnapshot {
  asOf: string;
  taxYear: number;
  missing: string[];
  stale: string[];
  deadlines: Array<{ id: string; label: string; daysUntil: number; date: string }>;
  thresholds: Threshold[];
  taxReserve: {
    projectedLiabilityCents: number;
    targetReserveCents: number;
    currentReserveCents: number;
    gapCents: number;
    coverageMonths: number;
    projectedQ4LiabilityCents: number;
    taxYear: number;
  };
}

function recordTotal(r: Pick<Revenue, 'valoareFaraTva' | 'tva'>): Bani {
  return sumBani([r.valoareFaraTva, r.tva]);
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
        `„${value === '' ? '(necompletat)' : value}” pe câmpul „${field}” nu este o dată calendaristică reală ` +
        `(${isoCalendarDateProblemText(problem)}); înregistrarea este exclusă din agregat până la corectare.`,
    });
  };
  for (const r of data.revenues) {
    report(r.id, 'revenue', r.collected !== undefined ? 'collected' : 'date', revenueFiscalDate(r));
  }
  for (const e of data.expenses) {
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
 */
export function revenueFiscalDate(r: Pick<Revenue, 'date' | 'collected'>): string {
  return r.collected ?? r.date;
}

/**
 * The date an expense is attributed to a fiscal year.
 *
 * **CF art. 68 alin. (4) lit. b)** requires expenses be „cuprinse în cheltuielile exercițiului
 * financiar **al anului în cursul căruia au fost plătite**" — the year in which they were **PAID**.
 * The consequence is attribution, not punishment: there is no late-payment disallowance in the
 * Cod fiscal (`docs/ai/research/10` §1 — the "15-day collection threshold" does not exist), so a
 * late-paid expense simply lands in the payment year.
 */
export function expenseFiscalDate(e: Pick<Expense, 'date' | 'paid'>): string {
  return e.paid ?? e.date;
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

  for (const r of data.revenues) {
    const fiscalDate = revenueFiscalDate(r);
    if (r.status === 'inregistrata' && inPeriod(fiscalDate, asOfDate, fiscalYear)) {
      revenue = addBani(revenue, recordTotal(r));
      revenueNet = addBani(revenueNet, r.valoareFaraTva);
    }
  }
  for (const e of data.expenses) {
    const fiscalDate = expenseFiscalDate(e);
    if (e.status === 'inregistrata' && inPeriod(fiscalDate, asOfDate, fiscalYear)) {
      expenses = addBani(expenses, recordTotal(e));
      expenseNet = addBani(expenseNet, e.valoareFaraTva);
    }
  }

  return { revenue, expenses, net: subBani(revenue, expenses), revenueNet, expenseNet };
}

/**
 * Monthly breakdown (keys 'YYYY-MM') of the same YTD period:
 * `${fiscalYear}-01-01` up to and including `asOfDate`.
 */
export function selectMonthly(data: AppData, asOfDate: string): Map<string, MonthlyTotals> {
  const fiscalYear = data.profile.fiscalYear;
  const monthly = new Map<string, MonthlyTotals>();

  const add = (key: string, field: 'revenue' | 'expenses', amount: Bani): void => {
    const entry = monthly.get(key) ?? { revenue: lei(0), expenses: lei(0), net: lei(0) };
    entry[field] = addBani(entry[field], amount);
    entry.net = subBani(entry.revenue, entry.expenses);
    monthly.set(key, entry);
  };

  for (const r of data.revenues) {
    const fiscalDate = revenueFiscalDate(r);
    if (r.status === 'inregistrata' && inPeriod(fiscalDate, asOfDate, fiscalYear)) {
      add(monthKey(fiscalDate), 'revenue', recordTotal(r));
    }
  }
  for (const e of data.expenses) {
    const fiscalDate = expenseFiscalDate(e);
    if (e.status === 'inregistrata' && inPeriod(fiscalDate, asOfDate, fiscalYear)) {
      add(monthKey(fiscalDate), 'expenses', recordTotal(e));
    }
  }

  return monthly;
}
