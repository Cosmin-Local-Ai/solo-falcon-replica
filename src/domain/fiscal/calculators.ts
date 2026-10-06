import type { FiscalRule } from './rules';

export type ReviewRequired = { reviewRequired: true; reason: string };

export type CalculatorResult =
  | { value: number; breakdown: string[] }
  | ReviewRequired;

export type CalculatorInput = {
  /** Realized net income for the tax year. For CAS it only SELECTS the applicable
   * statutory floor — it is never itself the CAS base (see `calcCas`). For CASS it
   * IS the base (venitul net anual, art. 68 sistem real), before deducting CAS —
   * see `calcCass`. */
  base?: number;
  /**
   * CAS — CF art. 150 alin. (1): a natural person earning independent-activity income
   * who is a pensioner or is insured in their own social insurance system owes NO CAS
   * for art. 137 alin. (1) lit. b) and b^1) income. Automatic, independent of the
   * income amount, not optional.
   *
   * CASS — CF art. 174 alin. (7) lit. c): the SAME flag does NOT exempt. Pension
   * income realised in that fiscal year removes ONLY the art. 174 alin. (6) top-up to
   * 6 SM; 10% × net still stands whenever net > 0. CAS and CASS treat pensioners
   * DIFFERENTLY — do not mirror one branch in the other. See `calcCas` vs `calcCass`.
   */
  pensionStatus?: 'da' | 'nu';
  /**
   * CASS only — CF art. 174 alin. (7) lit. a): the art. 174 alin. (6) top-up is not
   * owed where salary and assimilated income in that fiscal year is "cel puțin egal cu
   * 6 salarii minime brute". The profile carries only a yes/no flag, NOT the salary
   * amount, so the condition cannot be evaluated — `calcCass` returns
   * `reviewRequired` rather than guessing either way.
   *
   * MUST NEVER REACH CAS: CF art. 150 alin. (2) exempts salary earners only for
   * art. 137 alin. (1) lit. b^1) (drepturi de proprietate intelectuală), NOT lit. b).
   * A PFA owner who is also an employee still owes full CAS on independent-activity
   * income, so `salaryStatus` must never map into `calcCas`.
   */
  salaryStatus?: 'da' | 'nu';
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

// CASS — CF Titlul V Cap. III. The base is the annual NET income (art. 68 sistem real,
// before deducting CAS). The floor and the ceiling come from DIFFERENT articles:
//   CF art. 170 alin. (1)  ceiling — the base "nu poate fi mai mare decât" 72 SM. This
//                          article also excludes art. 118 fiscal losses from the base.
//   CF art. 174 alin. (6)  the 6-SM floor for art. 155 alin. (1) lit. b) income, owed as
//                          "o diferență de contribuție … până la nivelul celei corespunzătoare
//                          bazei de calcul egale cu 6 salarii minime brute". It is a TOP-UP, not
//                          a substitution — proven by CF art. 118 alin. (2) lit. b), which makes
//                          CASS deductible from the income-tax base "cu excepția diferenței de
//                          contribuție … prevăzută la art. 174 alin. (6)". NOT art. 170 alin.
//                          (2)-(3): those rungs reach only art. 155 alin. (1) lit. c)-h), and
//                          art. 68 income is lit. b) — a different door.
//   CF art. 174 alin. (2)  zero net income / fiscal loss → "nu datorează contribuția" at all.
//                          The 6-SM floor is NOT self-executing there; they may opt in under
//                          art. 180 alin. (1) (elective, deadline-bound — not modelled).
//   CF art. 174 alin. (7)  the top-up is not owed where the person REALISED, in that fiscal
//     lit. a)/c)             year, (a) salary ≥ 6 SM or (c) pension income per art. 99.
//                          lit. c) has no monetary threshold and removes ONLY the top-up:
//                          10% × net still stands. A pensioner with art. 68 net income is NOT
//                          CASS-free — unlike CAS art. 150 alin. (1), which exempts entirely.
// Every figure below is read from parameters; the CASS amounts at the floor and the ceiling
// are DERIVED as rate × base, never declared as separate parameters (one legal figure, one
// source of truth).
function calcCass(rule: FiscalRule, input?: CalculatorInput): CalculatorResult {
  const rate = paramNumber(rule, 'rate') / 100;
  const floorBase = paramNumber(rule, 'min_base'); // 6 SM — CF art. 174 alin. (6) top-up floor
  const maxBase = paramNumber(rule, 'max_annual_base'); // 72 SM — CF art. 170 alin. (1) ceiling
  const vna = input?.base ?? 0;
  const floorCass = floorBase * rate; // derived: 2,430 lei for 2026
  const ceilingCass = maxBase * rate; // derived: 29,160 lei for 2026

  // CF art. 174 alin. (2): a fiscal loss or a net income equal to zero owes NO CASS.
  if (vna <= 0) {
    return {
      value: 0,
      breakdown: [
        `venit net anual (VNA): ${vna} lei`,
        'VNA egal cu zero sau pierdere fiscala — nu se datoreaza CASS: CF art. 174 alin. (2); pierderile fiscale nu intra nici in baza de calcul (art. 170 alin. (1))',
        `OPTIUNE NEMODELATA: aceeasi persoana poate opta pentru plata CASS potrivit CF art. 180 alin. (1) — optiune cu termen, iar baza din art. 180 alin. (2) nu este verificata`,
        'CASS = 0 lei (pragul de 6 SM din art. 174 alin. (6) NU se aplica automat aici)',
      ],
    };
  }

  if (vna < floorBase) {
    // Checked BEFORE the salary relief: art. 174 alin. (7) lit. c) has no monetary
    // threshold, so it is certain in exactly the case where lit. a) cannot be evaluated.
    if (input?.pensionStatus === 'da') {
      const cass = vna * rate;
      return {
        value: cass,
        breakdown: [
          `venit net anual (VNA): ${vna} lei`,
          `VNA sub pragul de 6 SM (${floorBase} lei): art. 174 alin. (6) ar cere o diferenta de contributie pana la ${floorCass} lei`,
          'exceptie: venituri din pensii (art. 99) REALIZATE in anul fiscal — CF art. 174 alin. (7) lit. c); fara prag valoric, nu e un simplu statut',
          'lit. c) elimina DOAR diferenta de la art. 174 alin. (6) — contributia de 10% pe VNA ramane datorata (art. 170 alin. (1)); pensia NU scuteste de CASS, spre deosebire de CAS unde art. 150 alin. (1) scuteste integral',
          `CASS = ${vna} x ${rate} = ${cass} lei`,
        ],
      };
    }
    // CF art. 174 alin. (7) lit. a): the top-up is not owed if salary income in that
    // year is at least 6 SM. The profile carries no salary amount, so this cannot be
    // decided — surface it instead of guessing in either direction.
    if (input?.salaryStatus === 'da') {
      return {
        reviewRequired: true,
        reason:
          `VNA ${vna} lei este sub pragul de 6 SM (${floorBase} lei), dar diferenta de contributie din CF art. 174 alin. (6) nu se datoreaza daca veniturile din salarii si asimilate ale anului fiscal sunt cel putin egale cu 6 salarii minime brute (art. 174 alin. (7) lit. a)). Profilul nu contine cuantumul salarial — nu se poate stabili.`,
      };
    }
    return {
      value: floorCass,
      breakdown: [
        `venit net anual (VNA): ${vna} lei`,
        `baza de calcul = pragul de 6 SM: ${floorBase} lei — CF art. 174 alin. (6) (NU art. 170 alin. (2)-(3), care vizeaza doar art. 155 alin. (1) lit. c)-h))`,
        `CASS = ${floorBase} x ${rate} = ${floorCass} lei — o diferenta de contributie pana la baza de 6 SM, nu inlocuirea bazei`,
        'CF art. 118 alin. (2) lit. b): diferenta de la art. 174 alin. (6) NU se scade din baza impozabila (reparație de coerență, nu de calcul)',
      ],
    };
  }

  const base = Math.min(vna, maxBase);
  const cass = base * rate;
  const breakdown = [
    `venit net anual (VNA): ${vna} lei`,
    `baza de calcul: ${base} lei`,
    `CASS = ${base} x ${rate} = ${cass} lei`,
  ];
  if (vna > maxBase) {
    breakdown.push(
      `VNA depaseste plafonul de 72 SM (${maxBase} lei) — baza se plafoneaza: CF art. 170 alin. (1) "nu poate fi mai mare decât"`,
      `CASS la plafon = ${ceilingCass} lei, derivata din ${maxBase} x ${rate} (nu exista un parametru separat pentru acest numar)`,
    );
  }
  return { value: cass, breakdown };
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
