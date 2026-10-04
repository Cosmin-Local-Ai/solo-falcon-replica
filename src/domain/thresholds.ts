import type { FiscalRule } from './fiscal/rules';
import { selectApplicableRules } from './fiscal/select';

export type ThresholdType = 'min-base' | 'max-base' | 'registration' | 'income';

/**
 * The fiscal base a threshold is evaluated against.
 *
 * - `gross-revenue`:  Gross (TVA-inclusive) YTD revenue (`YtdTotals.revenue`).
 * - `gross-expenses`: Gross (TVA-inclusive) YTD expenses (`YtdTotals.expenses`).
 * - `net-income`:     YTD profit/loss (`YtdTotals.net`).
 *
 * Each threshold spec declares which fiscal base it legally applies to via
 * `requiredFiscalBase`. The query must supply a matching base; mismatched
 * specs are skipped in `computeThresholds`.
 */
export type FiscalBase = 'gross-revenue' | 'gross-expenses' | 'net-income';

export interface FiscalThreshold {
  thresholdId: string;
  type: ThresholdType;
  currentValue: number;
  thresholdValue: number;
  distance: number; // currentValue - thresholdValue (negative = below threshold)
  affectedDomain: string; // e.g. 'pfa-revenue'
  affectedTax: string; // e.g. 'cas', 'cass', 'vat'
  effectiveDate: string;
  warningDistance: number; // distance at which warning triggers
  ruleRelease: string;
  source: string;
  status: 'ok' | 'warning' | 'breached';
  /** The fiscal base this threshold was evaluated against. */
  fiscalBase: FiscalBase;
  /**
   * Human-readable explanation of what a breach means for this threshold type.
   * - `min-base`: below the minimum base → disqualification from the regime.
   * - `max-base`: above the maximum base → regime change.
   * - `registration`: at/above the threshold → registration obligation triggered.
   * - `income`: above the income threshold → additional tax obligation triggered.
   */
  breachMeaning: string;
}

export interface ThresholdQuery {
  taxYear: number;
  asOfDate: string;
  currentValue: number;
  /** The fiscal base `currentValue` represents. Must match each spec's `requiredFiscalBase`. */
  fiscalBase: FiscalBase;
  ruleRelease: string; // releaseId
}

interface ThresholdSpec {
  thresholdId: string;
  type: ThresholdType;
  ruleId: string;
  paramId: string;
  affectedDomain: string;
  affectedTax: string;
  /**
   * The fiscal base this threshold legally applies to.
   * `computeThresholds` skips specs whose `requiredFiscalBase` does not
   * match the query's `fiscalBase`.
   */
  requiredFiscalBase: FiscalBase;
}

const THRESHOLD_SPECS: ThresholdSpec[] = [
  {
    thresholdId: 'CAS_MIN_BASE',
    type: 'min-base',
    ruleId: 'CAS_2026',
    paramId: 'min_base',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cas',
    requiredFiscalBase: 'gross-revenue',
  },
  {
    thresholdId: 'CAS_MAX_BASE',
    type: 'max-base',
    ruleId: 'CAS_2026',
    paramId: 'max_base',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cas',
    requiredFiscalBase: 'gross-revenue',
  },
  {
    thresholdId: 'CASS_MIN_BASE',
    type: 'min-base',
    ruleId: 'CASS_2026',
    paramId: 'min_base',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cass',
    requiredFiscalBase: 'gross-revenue',
  },
  {
    thresholdId: 'CASS_MAX_BASE',
    type: 'max-base',
    ruleId: 'CASS_2026',
    paramId: 'max_annual_base',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cass',
    requiredFiscalBase: 'gross-revenue',
  },
  {
    thresholdId: 'VAT_REGISTRATION',
    type: 'registration',
    ruleId: 'VAT_THRESHOLD_2026',
    paramId: 'threshold',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'vat',
    requiredFiscalBase: 'gross-revenue',
  },
];

export function statusFor(
  type: ThresholdType,
  distance: number,
  warningDistance: number,
): FiscalThreshold['status'] {
  if (type === 'registration') {
    // current >= threshold means VAT registration is required
    if (distance >= 0) return 'breached';
    if (distance >= -warningDistance) return 'warning';
    return 'ok';
  }
  // min-base: breached when current is below the minimum
  // max-base: breached when current is above the maximum
  // income: breached when current is above the income threshold
  const breached = type === 'min-base' ? distance < 0 : distance > 0;
  if (breached) return 'breached';
  if (Math.abs(distance) <= warningDistance) return 'warning';
  return 'ok';
}

/**
 * Human-readable explanation of what a breach means for a threshold type.
 *
 * - `min-base`: below the minimum base → disqualification from the regime.
 * - `max-base`: above the maximum base → regime change.
 * - `registration`: at/above the threshold → registration obligation triggered.
 * - `income`: above the income threshold → additional tax obligation triggered.
 */
export function breachMeaningFor(type: ThresholdType | 'ratio'): string {
  switch (type) {
    case 'min-base':
      return 'Sub baza minimă — dezcalificare din regim';
    case 'max-base':
      return 'Peste plafonul maxim al bazei — schimbare de regim';
    case 'registration':
      return 'La sau peste prag — se declanșează obligația de înregistrare';
    case 'income':
      return 'Peste pragul de venit — se declanșează obligația fiscală suplimentară';
    case 'ratio':
      return 'Raport sub minimumul cerut — risc de reclasificare';
  }
}

export function computeThresholds(
  rules: FiscalRule[],
  query: ThresholdQuery,
): FiscalThreshold[] {
  const applicable = selectApplicableRules(rules, {
    taxYear: query.taxYear,
    asOfDate: query.asOfDate,
  });

  const results: FiscalThreshold[] = [];
  for (const spec of THRESHOLD_SPECS) {
    // Skip specs whose required fiscal base does not match the query's base.
    if (spec.requiredFiscalBase !== query.fiscalBase) continue;
    const rule = applicable.find((r) => r.ruleId === spec.ruleId);
    if (!rule) continue;
    const param = rule.parameters.find((p) => p.id === spec.paramId);
    if (!param || typeof param.value !== 'number') continue;

    const thresholdValue = param.value;
    const distance = query.currentValue - thresholdValue;
    const warningDistance = thresholdValue * 0.1;

    results.push({
      thresholdId: spec.thresholdId,
      type: spec.type,
      currentValue: query.currentValue,
      thresholdValue,
      distance,
      affectedDomain: spec.affectedDomain,
      affectedTax: spec.affectedTax,
      effectiveDate: rule.effectiveFrom,
      warningDistance,
      ruleRelease: query.ruleRelease,
      source: `${rule.sourceAct} ${rule.sourceArticle}`,
      status: statusFor(spec.type, distance, warningDistance),
      fiscalBase: query.fiscalBase,
      breachMeaning: breachMeaningFor(spec.type),
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Ratio-based threshold rules (Step 29 — additive)
//
// The dashboard snapshot represents fiscal limits (CAS, CASS, VAT, income tax)
// as ratio-based rules of the shape produced by `src/data/dashboard.ts`:
// `{ id, label, current, limit, ratio, breached }`. This section names that
// shape (`RatioRule`) and adds explicit `status` semantics on top of the
// existing `breached` flag, which is kept exactly as-is for backward
// compatibility.
// ---------------------------------------------------------------------------

/** Explicit three-state status derived from a ratio rule. */
export type RatioRuleStatus = 'ok' | 'warning' | 'breached';

/**
 * A ratio-based fiscal threshold rule.
 *
 * - `limit === 0` means "no cap": the rule is breached only when
 *   `current > 0` (encoded by the caller in `breached`), and `ratio` stays
 *   `null` because a percentage of a zero limit is undefined.
 * - `limit > 0`: `ratio` is `current / limit`; `breached` is `current >= limit`.
 *
 * `status` is optional so existing rule values (which predate Step 29 and
 * carry no `status`) remain assignable; use `withRatioRuleStatus` to derive it.
 */
export interface RatioRule {
  id: string;
  label: string;
  current: number;
  limit: number;
  /** Backward-compatible flag — kept exactly as-is, never re-derived. */
  breached: boolean;
  /** `current / limit`, or `null` when `limit === 0` (no cap). */
  ratio: number | null;
  /** Derived status (Step 29); see `statusForRatioRule`. */
  status?: RatioRuleStatus;
}

/**
 * Derive the explicit status of a ratio rule:
 *
 * 1. `breached` → `'breached'` (the flag always wins, unchanged semantics).
 * 2. `ratio !== null && ratio >= 0.8` → `'warning'` (close to the limit).
 * 3. otherwise → `'ok'`.
 *
 * Zero-limit rule ("no cap"): `limit === 0` means `ratio` is `null`, so a
 * non-breached zero-limit rule is always `'ok'`; a zero-limit rule is
 * `'breached'` only when `current > 0` (which the caller encodes as
 * `breached: true`).
 */
export function statusForRatioRule(rule: RatioRule): RatioRuleStatus {
  if (rule.breached) return 'breached';
  // Zero-limit rule: no cap, ratio is null — never warns, only breaches.
  if (rule.limit === 0) return 'ok';
  if (rule.ratio !== null && rule.ratio >= 0.8) return 'warning';
  return 'ok';
}

/**
 * Return a copy of `rule` with the derived `status` attached. The input is
 * not mutated and the `breached` flag is preserved exactly as-is.
 */
export function withRatioRuleStatus<T extends RatioRule>(rule: T): T & { status: RatioRuleStatus } {
  return { ...rule, status: statusForRatioRule(rule) };
}
