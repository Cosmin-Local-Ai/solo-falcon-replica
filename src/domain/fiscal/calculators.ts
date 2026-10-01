import type { FiscalRule } from './rules';

export type ReviewRequired = { reviewRequired: true; reason: string };

export type CalculatorResult =
  | { value: number; breakdown: string[] }
  | ReviewRequired;

export type CalculatorInput = { base?: number };

export type CalculatorFunction = (
  rule: FiscalRule,
  input?: CalculatorInput,
) => CalculatorResult;

function paramValue(rule: FiscalRule, id: string): number | string | undefined {
  return rule.parameters.find((p) => p.id === id)?.value;
}

function paramNumber(rule: FiscalRule, id: string): number {
  const v = paramValue(rule, id);
  if (typeof v !== 'number') {
    throw new Error(`Missing numeric parameter '${id}' for rule ${rule.ruleId}`);
  }
  return v;
}

function calcWageReference(rule: FiscalRule): CalculatorResult {
  const value = paramValue(rule, 'reference') ?? paramValue(rule, 'monthly');
  if (typeof value !== 'number') {
    return {
      reviewRequired: true,
      reason: `Rule ${rule.ruleId} has no numeric 'reference' or 'monthly' parameter`,
    };
  }
  return { value, breakdown: [`value: ${value} lei`] };
}

function calcCas(rule: FiscalRule, input?: CalculatorInput): CalculatorResult {
  const rate = paramNumber(rule, 'rate') / 100;
  const minBase = paramNumber(rule, 'min_base');
  const maxBase = paramValue(rule, 'max_base');
  const minCas = paramNumber(rule, 'min_cas');
  const base = input?.base ?? minBase;
  let effectiveBase = Math.max(base, minBase);
  if (typeof maxBase === 'number') {
    effectiveBase = Math.min(effectiveBase, maxBase);
  }
  const cas = Math.max(effectiveBase * rate, minCas);
  return {
    value: cas,
    breakdown: [
      `base: ${base} lei`,
      `effective base: ${effectiveBase} lei (min ${minBase}, max ${typeof maxBase === 'number' ? maxBase : 'none'})`,
      `CAS = ${effectiveBase} x ${rate} = ${cas} lei (minimum ${minCas} lei)`,
    ],
  };
}

function calcCass(rule: FiscalRule, input?: CalculatorInput): CalculatorResult {
  const rate = paramNumber(rule, 'rate') / 100;
  const minBase = paramNumber(rule, 'min_base');
  const maxBase = paramNumber(rule, 'max_annual_base');
  const minCass = paramNumber(rule, 'min_cass');
  const base = input?.base ?? minBase;
  if (base < minBase) {
    return {
      reviewRequired: true,
      reason: `Base ${base} lei is below the minimum base ${minBase} lei`,
    };
  }
  const cappedBase = Math.min(base, maxBase);
  const cass = Math.max(cappedBase * rate, minCass);
  return {
    value: cass,
    breakdown: [
      `base: ${base} lei`,
      `capped base: ${cappedBase} lei (maximum ${maxBase} lei)`,
      `CASS = ${cappedBase} x ${rate} = ${cass} lei (minimum ${minCass} lei)`,
    ],
  };
}

function calcIncomeTax(rule: FiscalRule, input?: CalculatorInput): CalculatorResult {
  const baseRate = paramNumber(rule, 'base_rate') / 100;
  const base = input?.base;
  if (typeof base !== 'number') {
    return { reviewRequired: true, reason: 'No base provided for income tax calculation' };
  }
  const tax = base * baseRate;
  return {
    value: tax,
    breakdown: [
      `base: ${base} lei`,
      `income tax = ${base} x ${baseRate} = ${tax} lei (10% base rate)`,
      `NOTE: 16% progressive surcharge threshold (6x national avg gross salary) is not a fixed number — REVIEW_REQUIRED for the surcharge portion`,
    ],
  };
}

function calcVatThreshold(rule: FiscalRule): CalculatorResult {
  const threshold = paramNumber(rule, 'threshold');
  return { value: threshold, breakdown: [`VAT threshold: ${threshold} lei`] };
}

function calcDeadline(rule: FiscalRule): CalculatorResult {
  const deadline = paramValue(rule, 'deadline');
  if (typeof deadline !== 'string') {
    return {
      reviewRequired: true,
      reason: `Rule ${rule.ruleId} has no date parameter 'deadline'`,
    };
  }
  return { value: 0, breakdown: [`deadline: ${deadline}`] };
}

export function computeFiscal(
  release: { rules: FiscalRule[] },
  ruleId: string,
  input?: CalculatorInput,
): CalculatorResult {
  const rule = release.rules.find((r) => r.ruleId === ruleId);
  if (!rule) throw new Error(`Unknown rule: ${ruleId}`);
  const fn = calculatorRegistry[rule.calculatorId];
  if (!fn) throw new Error(`No calculator registered for rule: ${ruleId}`);
  return fn(rule, input);
}

export const calculatorRegistry: Record<string, CalculatorFunction> = {
  'calc-wage-reference': calcWageReference,
  'calc-cas': calcCas,
  'calc-cass': calcCass,
  'calc-income-tax': calcIncomeTax,
  'calc-vat-threshold': calcVatThreshold,
  'calc-deadline': calcDeadline,
};
