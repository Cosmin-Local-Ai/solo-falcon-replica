import type { FiscalRule } from './fiscal/rules';
import { selectApplicableRules } from './fiscal/select';

export type ThresholdType = 'min-base' | 'max-base' | 'registration';

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
}

export interface ThresholdQuery {
  taxYear: number;
  asOfDate: string;
  currentValue: number;
  ruleRelease: string; // releaseId
}

interface ThresholdSpec {
  thresholdId: string;
  type: ThresholdType;
  ruleId: string;
  paramId: string;
  affectedDomain: string;
  affectedTax: string;
}

const THRESHOLD_SPECS: ThresholdSpec[] = [
  {
    thresholdId: 'CAS_MIN_BASE',
    type: 'min-base',
    ruleId: 'CAS_2026',
    paramId: 'min_base',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cas',
  },
  {
    thresholdId: 'CAS_MAX_BASE',
    type: 'max-base',
    ruleId: 'CAS_2026',
    paramId: 'max_base',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cas',
  },
  {
    thresholdId: 'CASS_MIN_BASE',
    type: 'min-base',
    ruleId: 'CASS_2026',
    paramId: 'min_base',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cass',
  },
  {
    thresholdId: 'CASS_MAX_BASE',
    type: 'max-base',
    ruleId: 'CASS_2026',
    paramId: 'max_annual_base',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cass',
  },
  {
    thresholdId: 'VAT_REGISTRATION',
    type: 'registration',
    ruleId: 'VAT_THRESHOLD_2026',
    paramId: 'threshold',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'vat',
  },
];

function statusFor(
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
  const breached = type === 'min-base' ? distance < 0 : distance > 0;
  if (breached) return 'breached';
  if (Math.abs(distance) <= warningDistance) return 'warning';
  return 'ok';
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
    });
  }
  return results;
}
