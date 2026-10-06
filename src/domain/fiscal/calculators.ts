import type { FiscalRule } from './rules';

export type ReviewRequired = { reviewRequired: true; reason: string };

export type CalculatorResult =
  | { value: number; breakdown: string[] }
  | ReviewRequired;

export type CalculatorInput = {
  /** Realized net income for the tax year. For CAS it only SELECTS the applicable
   * statutory floor — it is never itself the CAS base (see `calcCas`). */
  base?: number;
  /**
   * CF art. 150 alin. (1): a natural person earning independent-activity income who
   * is a pensioner or is insured in their own social insurance system owes NO CAS
   * for art. 137 alin. (1) lit. b) and b^1) income. Automatic, independent of the
   * income amount, not optional.
   *
   * DELIBERATELY NO SALARY HOOK: CF art. 150 alin. (2) exempts persons with salary
   * income only for art. 137 alin. (1) lit. b^1) (drepturi de proprietate
   * intelectuală), NOT lit. b). A PFA owner who is also an employee still owes full
   * CAS on independent-activity income, so `salaryStatus` must never map here.
   */
  pensionStatus?: 'da' | 'nu';
  /**
   * CF art. 148 alin. (2): the CAS base is "venitul ales de contribuabil". An
   * explicitly chosen base is honoured, but never below the applicable statutory
   * floor. Wired to no persisted field and no UI input; when the election is
   * implemented it must be its own persisted field, never an override of realized
   * income. Absent means "no election made", so the statutory minimum (the floor
   * itself) is the headline figure.
   */
  chosenBase?: number;
};

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

// CF art. 148 alin. (2): the CAS base is "venitul ales de contribuabil, care nu
// poate fi mai mic decât" 12 SM (income between 12 SM and 24 SM) or 24 SM (income
// at or above 24 SM). That is a LADDER OF FLOORS, not a clamp: realized income only
// selects which floor applies, and there is NO upper cap. Contrast CASS
// art. 170 alin. (1), which says "nu poate fi mai mare decât" — that one is a cap.
// CF art. 148 alin. (1): below 12 SM the obligation never arises, so CAS is 0 —
// NOT the 12 SM figure.
function calcCas(rule: FiscalRule, input?: CalculatorInput): CalculatorResult {
  const rate = paramNumber(rule, 'rate') / 100;
  const tier1Base = paramNumber(rule, 'min_base'); // 12 SM floor
  const tier2Base = paramNumber(rule, 'tier2_base'); // 24 SM floor
  const tier1Cas = paramNumber(rule, 'tier1_cas');
  const tier2Cas = paramNumber(rule, 'tier2_cas');
  const realized = input?.base ?? 0;

  if (input?.pensionStatus === 'da') {
    return {
      value: 0,
      breakdown: [
        'pensionar sau asigurat in propriul sistem de asigurari sociale — exceptie CF art. 150 alin. (1)',
        `venit realizat: ${realized} lei`,
        'CAS = 0 lei (exceptia nu depinde de cuantumul venitului si nu este optionala)',
      ],
    };
  }

  if (realized < tier1Base) {
    return {
      value: 0,
      breakdown: [
        `venit realizat: ${realized} lei`,
        `sub 12 SM anual (${tier1Base} lei) — conditia din CF art. 148 alin. (1) nu este indeplinita`,
        `CAS = 0 lei (CF art. 148 alin. (4) permite optiunea voluntara la o baza >= ${tier1Base} lei; neimplementata in aceasta faza)`,
      ],
    };
  }

  const inTier2 = realized >= tier2Base;
  const floor = inTier2 ? tier2Base : tier1Base;
  const floorCas = inTier2 ? tier2Cas : tier1Cas;
  const chosen = input?.chosenBase;
  const base = chosen === undefined ? floor : Math.max(chosen, floor);
  const cas = base * rate;
  const breakdown = [
    `venit realizat: ${realized} lei`,
    `prag aplicabil (CF art. 148 alin. (2) lit. ${inTier2 ? 'b' : 'a'}): ${floor} lei`,
    `baza de calcul = venitul ales: ${base} lei`,
    `CAS = ${base} x ${rate} = ${cas} lei`,
    `OPTIUNE INFORMATIONALA: minimul legal in acest prag este ${floorCas} lei (baza ${floor} lei); CF art. 148 alin. (2) nu prevede nicio plafonare superioara, deci o baza mai mare poate fi aleasa voluntar doar pentru o pensie mai mare`,
    `CAS la pragul de 12 SM = ${tier1Cas} lei; la pragul de 24 SM = ${tier2Cas} lei; fara plafon superior`,
  ];
  if (chosen !== undefined && chosen < floor) {
    breakdown.push(
      `baza aleasa ${chosen} lei este sub pragul legal de ${floor} lei si a fost ridicata la acest prag — CF art. 148 alin. (2) prevede un MINIM, nu o plafonare`,
    );
  }
  return { value: cas, breakdown };
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
