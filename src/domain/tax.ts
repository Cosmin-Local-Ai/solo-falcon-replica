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
  /** Total revenues without VAT (valoareFaraTva only), lei. */
  revenuesNet: number;
  /** Total expenses without VAT (valoareFaraTva only), lei. */
  expensesNet: number;
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
  const { inputs, profile, revenues, expenses, revenuesNet, expensesNet, ruleRelease, rules } = input;
  if (!Number.isFinite(revenues) || revenues < 0) return rr(`Veniturile trebuie să fie >= 0, s-a obținut ${revenues}`);
  if (!Number.isFinite(expenses) || expenses < 0) return rr(`Cheltuielile trebuie să fie >= 0, s-a obținut ${expenses}`);
  if (!Number.isFinite(revenuesNet) || revenuesNet < 0) return rr(`Veniturile nete (fără TVA) trebuie să fie >= 0, s-a obținut ${revenuesNet}`);
  if (!Number.isFinite(expensesNet) || expensesNet < 0) return rr(`Cheltuielile nete (fără TVA) trebuie să fie >= 0, s-a obținut ${expensesNet}`);
  if (!profile?.id) return rr('Profilul lipsește sau nu are id');
  const lines: CalculationLine[] = [];
  const asOf = `${inputs.fiscalYear}-01-01`;
  const applicable = selectApplicableRules(rules, { taxYear: inputs.fiscalYear, asOfDate: asOf });
  const casRule = applicable.find((r) => r.taxRegime === 'cas');
  const cassRule = applicable.find((r) => r.taxRegime === 'cass');
  const incomeTaxRule = applicable.find((r) => r.taxRegime === 'income-tax');
  if (!casRule) return rr(`Regula CAS nu a fost găsită pentru anul fiscal ${inputs.fiscalYear}`, lines);
  if (!cassRule) return rr(`Regula CASS nu a fost găsită pentru anul fiscal ${inputs.fiscalYear}`, lines);
  if (!incomeTaxRule) return rr(`Regula de impozit pe venit nu a fost găsită pentru anul fiscal ${inputs.fiscalYear}`, lines);

  if (inputs.regime === 'impozit_pe_venit') {
    return rr('Plafonul cheltuielilor deductibile pentru impozit pe venit (30% din brut) nu este în stocul de reguli.', lines);
  }

  // Area 6: VAT is not taxable income. Non-exempt profiles are taxed on the net base
  // (VAT excluded); exempt profiles keep the gross base.
  const gross = inputs.vatExempt ? revenues : revenuesNet;
  const deductibleBase = inputs.vatExempt ? expenses : expensesNet;
  lines.push({ label: 'Venit brut', value: gross });
  const deductible = Math.min(deductibleBase, gross);
  lines.push({ label: 'Cheltuieli deductibile', value: deductible });
  const net = gross - deductible;
  lines.push({ label: 'Venit net din activitate', value: net });

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
  lines.push({ label: 'Venit impozabil (net - CAS - CASS)', value: taxable });

  if (taxable <= 0) {
    const total = casRes.value + cassValue;
    lines.push({ label: 'Impozit pe venit (fără bază impozabilă)', value: 0 });
    lines.push({ label: 'Total taxe', value: total });
    const snap = await createCalculationSnapshot({ profile, revenues: gross, expenses: deductibleBase, ruleRelease, calculationLines: lines, output: { total } });
    return { status: 'computed', lines, output: { total }, snapshot: snap };
  }

  const incomeTaxRes = calculatorRegistry['calc-income-tax'](incomeTaxRule, { base: taxable });
  if ('reviewRequired' in incomeTaxRes) return rr(incomeTaxRes.reason, lines);
  lines.push({ label: 'Impozit pe venit (rată de bază 10%)', value: incomeTaxRes.value });
  const total = casRes.value + cassValue + incomeTaxRes.value;
  lines.push({ label: 'Total taxe', value: total });
  const snap = await createCalculationSnapshot({ profile, revenues: gross, expenses: deductibleBase, ruleRelease, calculationLines: lines, output: { total } });
  return { status: 'computed', lines, output: { total }, snapshot: snap };
}
