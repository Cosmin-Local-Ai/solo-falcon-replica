import type { FiscalRule } from './fiscal/rules';
import { selectApplicableRules } from './fiscal/select';

/**
 * `tier-floor` is not a ceiling and not a disqualification — it is a **step in a ladder**.
 * CF art. 148 alin. (2) makes the chosen base "nu poate fi mai mic decât" 12 SM, and
 * lit. b) raises that floor to 24 SM once realised income is "cel puțin egal cu 24 de salarii
 * minime brute pe țară". Crossing it therefore *doubles the floor* (CAS 12.150 → 24.300 lei);
 * nothing is disqualified and nothing is capped. It is modelled separately precisely because
 * the `max-base` meaning ("schimbare de regim") would have been false — see the CAS_MAX_BASE
 * note below `THRESHOLD_SPECS`.
 */
export type ThresholdType = 'min-base' | 'max-base' | 'registration' | 'income' | 'tier-floor';

/**
 * The amount a threshold is legally measured against. Each member names ONE
 * amount concept so a threshold can never silently borrow a neighbouring one.
 *
 * Revenue / expense bases (from `selectYtd`, `src/domain/aggregation.ts`):
 * - `revenue-incl-vat`: cash actually collected, `valoareFaraTva + tva` (`YtdTotals.revenue`).
 * - `revenue-excl-vat`: **cifră de afaceri** — `valoareFaraTva` only (`YtdTotals.revenueNet`).
 *   This is the base CF art. 310 alin. (1) measures the 395.000-lei plafon against.
 * - `expense-incl-vat`: `valoareFaraTva + tva` (`YtdTotals.expenses`).
 * - `expense-excl-vat`: `valoareFaraTva` only (`YtdTotals.expenseNet`).
 *
 * Contribution base:
 * - `net-income`: **venitul net din activitate** — the base CAS is chosen on
 *   (CF art. 148 alin. (1)-(2)) and the base CASS is owed on (CF art. 170 alin. (1),
 *   art. 174 alin. (2) and (6)). Supplied ONLY by the tax engine
 *   (`src/domain/tax.ts`, the `net` behind the `'Venit net din activitate'` line),
 *   never by `selectYtd`. `YtdTotals.net` is `revenue - expenses` on VAT-INCLUSIVE
 *   operands and is NOT this quantity — do not wire it here.
 *
 * A spec whose required base the caller cannot supply yields a
 * `review_required` row, never a silently dropped row. See `computeThresholds`.
 */
export type FiscalBase =
  | 'revenue-incl-vat'
  | 'revenue-excl-vat'
  | 'expense-incl-vat'
  | 'expense-excl-vat'
  | 'net-income';

/**
 * Threshold status. `review_required` means the threshold itself is citable but the
 * amount it must be measured against was not available, so no verdict can be given.
 * It is deliberately NOT collapsed into `ok` — an unmeasured threshold must not look safe.
 */
export type ThresholdStatus = 'ok' | 'warning' | 'breached' | 'review_required';

/** Every amount a caller can supply, keyed by the base it represents. Absent = unknown. */
export interface ThresholdBases {
  'revenue-incl-vat'?: number;
  'revenue-excl-vat'?: number;
  'expense-incl-vat'?: number;
  'expense-excl-vat'?: number;
  'net-income'?: number;
}

export interface FiscalThreshold {
  thresholdId: string;
  type: ThresholdType;
  /** The amount measured, or `null` when the required base was unavailable. */
  currentValue: number | null;
  thresholdValue: number;
  distance: number; // currentValue - thresholdValue (negative = below threshold); 0 when unmeasured
  affectedDomain: string; // e.g. 'pfa-revenue'
  affectedTax: string; // e.g. 'cas', 'cass', 'vat'
  effectiveDate: string;
  /**
   * Distance at which `warning` triggers. This is a **presentation band chosen by the app
   * (10% of the threshold), NOT a statutory figure** — it carries no citation and must not
   * acquire one.
   */
  warningDistance: number;
  ruleRelease: string;
  source: string;
  status: ThresholdStatus;
  /** The fiscal base this threshold was evaluated against. */
  fiscalBase: FiscalBase;
  /**
   * Human-readable explanation of what a breach means for this threshold type.
   * - `min-base`: below the minimum base → disqualification from the regime.
   * - `max-base`: above the maximum base → regime change.
   * - `registration`: at/above the threshold → registration obligation triggered.
   * - `income`: above the income threshold → additional tax obligation triggered.
   * - `tier-floor`: at/above the tier → the minimum contribution base steps up a tier.
   */
  breachMeaning: string;
  /** Present only when `status === 'review_required'`: why no verdict could be given. */
  reviewReason?: string;
}

export interface ThresholdQuery {
  taxYear: number;
  asOfDate: string;
  /**
   * Every amount the caller can supply, keyed by the base it represents. One query can
   * therefore serve specs that need different bases; a spec whose base is absent becomes a
   * `review_required` row rather than disappearing.
   */
  bases: ThresholdBases;
  ruleRelease: string; // releaseId
}

export interface ThresholdSpec {
  thresholdId: string;
  type: ThresholdType;
  ruleId: string;
  paramId: string;
  affectedDomain: string;
  affectedTax: string;
  /**
   * The fiscal base this threshold legally applies to. `computeThresholds` evaluates the
   * spec against `query.bases[requiredFiscalBase]`; if that base is absent the spec yields
   * a `review_required` row instead of being skipped.
   */
  requiredFiscalBase: FiscalBase;
  /**
   * The provision that defines the BASE (not merely the threshold value). Asserted by
   * `thresholds.test.ts` so a row can never travel without the article that names its base.
   */
  baseSourceArticle: string;
}

/**
 * Exported read-only so tests can prove every spec's `requiredFiscalBase` is actually
 * supplied by the production caller — the guard against a spec being dropped by a
 * base mismatch.
 */
export const THRESHOLD_SPECS: readonly ThresholdSpec[] = [
  {
    thresholdId: 'CAS_MIN_BASE',
    type: 'min-base',
    ruleId: 'CAS_2026',
    // `min_base` is the tier-1 floor (12 SM). CAS_MIN_BASE stays valid: crossing it is
    // what triggers the CAS obligation at all (CF art. 148 alin. (1)).
    paramId: 'min_base',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cas',
    // CAS is chosen on the contribution base, not on turnover: CF art. 148 alin. (1)-(2)
    // measures the 12 SM / 24 SM floors against "venitul net anual realizat".
    requiredFiscalBase: 'net-income',
    baseSourceArticle: 'Cod fiscal art. 148 alin. (1)-(2) lit. a) (baza: venitul net anual realizat)',
  },
  // CAS_MAX_BASE was removed in Phase 3 and is NOT restored. CF art. 148 alin. (2) sets FLOORS —
  // "venitul ales de contribuabil, care nu poate fi mai mic decât" 12 SM / 24 SM — and contains no
  // ceiling for CAS, so a `max-base` row on 97.200 lei asserted a statutory cap that does not exist
  // (docs/ai/phases/02_fiscal_baseline.md §2.1). The row below is the correct replacement the Phase 3
  // comment asked for: the same 97.200-lei figure, typed as the ladder step it legally is.
  // `max-base` itself remains in ThresholdType — CASS_MAX_BASE legitimately has a cap
  // (CF art. 170 alin. (1), "nu poate fi mai mare decât" 72 SM).
  {
    thresholdId: 'CAS_TIER2_FLOOR',
    type: 'tier-floor',
    ruleId: 'CAS_2026',
    // `tier2_base` is the tier-2 floor (24 SM). It is the SAME parameter `calcCas` uses to pick the
    // doubled floor (`tier2_cas`), so the threshold row and the computed CAS cannot drift apart.
    paramId: 'tier2_base',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cas',
    // Art. 148 alin. (2) measures the tier against realised net income, like tier 1.
    requiredFiscalBase: 'net-income',
    baseSourceArticle:
      'Cod fiscal art. 148 alin. (2) lit. b) (baza: venitul net anual realizat cel puțin egal cu 24 SM)',
  },
  {
    thresholdId: 'CASS_MIN_BASE',
    type: 'min-base',
    ruleId: 'CASS_2026',
    paramId: 'min_base',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cass',
    // CF art. 174 alin. (6) tops up the contribution to 6 SM by reference to VNA, and
    // art. 174 alin. (2) switches CASS off when VNA is zero — both measure the CASS base.
    requiredFiscalBase: 'net-income',
    baseSourceArticle: 'Cod fiscal art. 174 alin. (6) coroborat cu art. 170 alin. (1) (baza: venitul net anual)',
  },
  {
    thresholdId: 'CASS_MAX_BASE',
    type: 'max-base',
    ruleId: 'CASS_2026',
    paramId: 'max_annual_base',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cass',
    // CF art. 170 alin. (1): the 72 SM ceiling caps the *base de calcul*, i.e. VNA — not turnover.
    requiredFiscalBase: 'net-income',
    baseSourceArticle: 'Cod fiscal art. 170 alin. (1) (plafon de 72 SM din venitul net anual)',
  },
  {
    thresholdId: 'VAT_REGISTRATION',
    type: 'registration',
    ruleId: 'VAT_THRESHOLD_2026',
    paramId: 'threshold',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'vat',
    // The plafon is a VAT-EXCLUSIVE turnover test. See the art. 310 alin. (2) caveat in
    // docs/ai/phases/02_fiscal_baseline.md: "exclusiv taxa" attaches grammatically to the
    // *ieșire din evidență* case, and alin. (2) also excludes fixed-asset deliveries; the
    // VAT-exclusive reading holds because no provision anywhere measures the plafon
    // TVA-inclusiv — not because alin. (2) is a global definition.
    requiredFiscalBase: 'revenue-excl-vat',
    baseSourceArticle: 'Cod fiscal art. 310 alin. (1) (cifră de afaceri, exclusiv taxa)',
  },
];

export function statusFor(
  type: ThresholdType,
  distance: number,
  warningDistance: number,
): Exclude<ThresholdStatus, 'review_required'> {
  if (type === 'registration') {
    // current >= threshold means VAT registration is required
    if (distance >= 0) return 'breached';
    if (distance >= -warningDistance) return 'warning';
    return 'ok';
  }
  if (type === 'tier-floor') {
    // A tier floor is *crossed*, not exceeded harmfully: art. 148 alin. (2) lit. b) applies once
    // realised income is "cel puțin egal cu" 24 SM, so the boundary is INCLUSIVE — exactly the
    // predicate `calcCas` uses (`realized >= tier2Base`). Below it, the tier-1 floor applies.
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
 * - `tier-floor`: at/above the tier → the minimum CAS base steps up to the next tier.
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
    case 'tier-floor':
      // Deliberately NOT "schimbare de regim" and NOT "plafon": art. 148 alin. (2) lit. b) raises a
      // FLOOR. The amounts themselves (12.150 / 24.300 lei) are never written here — they come from
      // the `tier1_cas` / `tier2_cas` parameters of the CAS rule.
      return 'Peste pragul de 24 SM — baza minimă de calcul pentru CAS crește de la 12 SM la 24 SM (nu este plafon)';
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
    const rule = applicable.find((r) => r.ruleId === spec.ruleId);
    if (!rule) continue;
    const param = rule.parameters.find((p) => p.id === spec.paramId);
    if (!param || typeof param.value !== 'number') continue;

    const thresholdValue = param.value;
    // Presentation band only — 10% of the threshold, chosen by the app. Not a statutory
    // figure and deliberately never given a citation.
    const warningDistance = thresholdValue * 0.1;

    const currentValue = query.bases[spec.requiredFiscalBase];
    if (currentValue === undefined) {
      // A base mismatch used to `continue`, silently deleting a threshold card. It is now a
      // loud row: the threshold is citable, but it cannot be measured, so no verdict is faked.
      results.push({
        thresholdId: spec.thresholdId,
        type: spec.type,
        currentValue: null,
        thresholdValue,
        distance: 0,
        affectedDomain: spec.affectedDomain,
        affectedTax: spec.affectedTax,
        effectiveDate: rule.effectiveFrom,
        warningDistance,
        ruleRelease: query.ruleRelease,
        source: `${rule.sourceAct} ${rule.sourceArticle}`,
        status: 'review_required',
        fiscalBase: spec.requiredFiscalBase,
        breachMeaning: breachMeaningFor(spec.type),
        reviewReason: `Baza „${spec.requiredFiscalBase}” nu a fost furnizată; pragul nu poate fi evaluat.`,
      });
      continue;
    }

    const distance = currentValue - thresholdValue;

    results.push({
      thresholdId: spec.thresholdId,
      type: spec.type,
      currentValue,
      thresholdValue,
      distance,
      affectedDomain: spec.affectedDomain,
      affectedTax: spec.affectedTax,
      effectiveDate: rule.effectiveFrom,
      warningDistance,
      ruleRelease: query.ruleRelease,
      source: `${rule.sourceAct} ${rule.sourceArticle}`,
      status: statusFor(spec.type, distance, warningDistance),
      fiscalBase: spec.requiredFiscalBase,
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
