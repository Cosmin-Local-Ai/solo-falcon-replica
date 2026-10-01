/**
 * PFA 2026 deterministic tax calculation engine (Step 15).
 * Consumes TaxInputsReference (derived.ts) + active rule release.
 * Domain purity: no React, DOM, localStorage, or store imports.
 */
import type { PfaProfile } from './models';
import type { FiscalRule, RuleRelease } from './fiscal/rules';
import type { TaxInputsReference } from './derived';
import type { CalculationLine, CalculationOutput, TaxCalculationSnapshot } from './snapshots/types';
import { selectApplicableRules } from './fiscal/select';
import { calculatorRegistry } from './fiscal/calculators';
import { createCalculationSnapshot } from './snapshots/snapshot';

export interface TaxCalculationInput {
  inputs: TaxInputsReference;
  profile: PfaProfile;
  revenues: number;
  expenses: number;
  ruleRelease: RuleRelease;
  rules: FiscalRule[];
}

export type TaxEstimateResult =
  | { status: 'computed'; lines: CalculationLine[]; output: CalculationOutput; snapshot: TaxCalculationSnapshot }
  | { status: 'review_required'; reason: string; lines: CalculationLine[] };

function rr(reason: string, lines: CalculationLine[] = []): TaxEstimateResult {
  return { status: 'review_required', reason, lines };
}

export async function computeTaxEstimate(input: TaxCalculationInput): Promise<TaxEstimateResult> {
  const { inputs, profile, revenues, expenses, ruleRelease, rules } = input;
  if (!Number.isFinite(revenues) || revenues < 0) return rr(`Revenues must be >= 0, got ${revenues}`);
  if (!Number.isFinite(expenses) || expenses < 0) return rr(`Expenses must be >= 0, got ${expenses}`);
  if (!profile?.id) return rr('Profile is missing or has no id');
  const lines: CalculationLine[] = [];
  const asOf = `${inputs.fiscalYear}-01-01`;
  const applicable = selectApplicableRules(rules, { taxYear: inputs.fiscalYear, asOfDate: asOf });
  const casRule = applicable.find((r) => r.taxRegime === 'cas');
  const cassRule = applicable.find((r) => r.taxRegime === 'cass');
  const incomeTaxRule = applicable.find((r) => r.taxRegime === 'income-tax');
  if (!casRule) return rr(`CAS rule not found for tax year ${inputs.fiscalYear}`, lines);
  if (!cassRule) return rr(`CASS rule not found for tax year ${inputs.fiscalYear}`, lines);
  if (!incomeTaxRule) return rr(`Income tax rule not found for tax year ${inputs.fiscalYear}`, lines);

  if (inputs.regime === 'impozit_pe_venit') {
    return rr('Deductible expense limit for impozit pe venit (30% of gross) is not in the rule store.', lines);
  }

  const gross = revenues;
  lines.push({ label: 'Gross revenue', value: gross });
  const deductible = Math.min(expenses, gross);
  lines.push({ label: 'Deductible expenses', value: deductible });
  const net = gross - deductible;
  lines.push({ label: 'Net business income', value: net });

  const casRes = calculatorRegistry['calc-cas'](casRule, { base: net });
  if ('reviewRequired' in casRes) return rr(casRes.reason, lines);
  lines.push({ label: 'CAS (25%)', value: casRes.value });

  let cassValue = 0;
  if (inputs.socialInsuranceStatus === 'obligatoriu') {
    const cassRes = calculatorRegistry['calc-cass'](cassRule, { base: net });
    if ('reviewRequired' in cassRes) return rr(cassRes.reason, lines);
    cassValue = cassRes.value;
    lines.push({ label: 'CASS (10%)', value: cassValue });
  } else {
    lines.push({ label: `CASS (${inputs.socialInsuranceStatus})`, value: 0 });
  }

  const taxable = net - casRes.value - cassValue;
  lines.push({ label: 'Taxable income (net - CAS - CASS)', value: taxable });

  if (taxable <= 0) {
    const total = casRes.value + cassValue;
    lines.push({ label: 'Income tax (no taxable base)', value: 0 });
    lines.push({ label: 'Total tax', value: total });
    const snap = await createCalculationSnapshot({ profile, revenues, expenses, ruleRelease, calculationLines: lines, output: { total } });
    return { status: 'computed', lines, output: { total }, snapshot: snap };
  }

  const incomeTaxRes = calculatorRegistry['calc-income-tax'](incomeTaxRule, { base: taxable });
  if ('reviewRequired' in incomeTaxRes) return rr(incomeTaxRes.reason, lines);
  lines.push({ label: 'Income tax (10% base rate)', value: incomeTaxRes.value });
  const total = casRes.value + cassValue + incomeTaxRes.value;
  lines.push({ label: 'Total tax', value: total });
  const snap = await createCalculationSnapshot({ profile, revenues, expenses, ruleRelease, calculationLines: lines, output: { total } });
  return { status: 'computed', lines, output: { total }, snapshot: snap };
}
