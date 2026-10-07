import type { FiscalRule, FiscalParameter } from './rules';
import { applyRateDecimal, lei, leiText, roundArt66, subBani, type Bani } from '../money';

export type ReviewRequired = { reviewRequired: true; reason: string };

export type CalculatorResult =
  | {
      /** The amount this rule computes as DUE, in integer bani. For the three sums art. 66 alin. (1)
       * governs (income tax, CAS, CASS) this is already rounded exactly once, by `roundArt66` — no caller may
       * round it again, and no caller may round a base to get here. */
      value: Bani;
      breakdown: string[];
      /** Part of `value` that CF art. 118 alin. (2) lit. b) does NOT allow into the income-tax base.
       * Today exactly one contribution has such a part: the CF art. 174 alin. (6) CASS difference
       * (defect B-13). Art. 118 alin. (2) lit. b) verbatim: „venitul net anual impozabil care se
       * determină prin însumarea tuturor veniturilor nete anuale, recalculate, prevăzute la lit. a),
       * din care se deduc contribuția de asigurări sociale și contribuția de asigurări sociale de
       * sănătate datorate potrivit prevederilor titlului V, cu excepția diferenței de contribuție de
       * asigurări sociale de sănătate prevăzută la art. 174 alin. (6).” (modified by OUG 128/2024 pct.
       * 10 Art. I, MO 1125/11.11.2024, eff. 01-01-2025). Art. 118 alin. (2^3) then prorates the
       * deductible CASS over „contribuția … calculată potrivit art. 174 alin. (1)”, which is the 10% on
       * the art. 68 net income — not the top-up to the 6 SM floor. Absent or 0 = fully deductible. */
      nonDeductible?: Bani;
    }
  | ReviewRequired;

export type CalculatorInput = {
  /** Realized net income for the tax year. For CAS it only SELECTS the applicable
   * statutory floor — it is never itself the CAS base (see `calcCas`). For CASS it
   * IS the base (venitul net anual, art. 68 sistem real), before deducting CAS —
   * see `calcCass`. */
  base?: Bani;
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
   * owed where salary and assimilated income realised in that fiscal year is "cel puțin
   * egal cu 6 salarii minime brute".
   *
   * Phase 6 supplies the amount through `salaryIncomeLei`, so both branches now
   * COMPUTE: amount >= 6 SM -> the top-up is not owed (CASS stays 10% x VNA, fully
   * deductible); amount < 6 SM -> the top-up is owed and stays non-deductible per
   * art. 118 alin. (2) lit. b). When the flag is 'da' but the amount is absent (a
   * payload written before Phase 6), `calcCass` still returns `reviewRequired` rather
   * than guessing in either direction.
   *
   * MUST NEVER REACH CAS: CF art. 150 alin. (2) exempts salary earners only for
   * art. 137 alin. (1) lit. b^1) (drepturi de proprietate intelectuală), NOT lit. b).
   * A PFA owner who is also an employee still owes full CAS on independent-activity
   * income, so `salaryStatus` must never map into `calcCas`.
   */
  salaryStatus?: 'da' | 'nu';
  /**
   * CASS only — salary and assimilated income (CF art. 155 alin. (1) lit. a)) actually
   * realised in the fiscal year, in lei. This is the figure CF art. 174 alin. (7) lit. a)
   * compares against the 6 SM floor. Absent means "not known", which is reported, not
   * assumed. Never an input to CAS (art. 150 alin. (2) covers only lit. b^1)).
   */
  salaryIncomeLei?: Bani;
  /**
   * CF art. 148 alin. (2): the CAS base is "venitul ales de contribuabil". An
   * explicitly chosen base is honoured, but never below the applicable statutory
   * floor. Wired to no persisted field and no UI input; when the election is
   * implemented it must be its own persisted field, never an override of realized
   * income. Absent means "no election made", so the statutory minimum (the floor
   * itself) is the headline figure.
   */
  chosenBase?: Bani;
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

/**
 * Phase 10: the unit-aware funnel. `FiscalParameter.value` is `number | string` shared by lei, percent,
 * date, count, days and text, so the type alone cannot say which unit a number is in — `unit` is the only
 * machine-readable marker in the rule store. This is the one place that question gets answered: a `lei`
 * parameter is read as integer **bani** (the rule package stores it that way), and reading a percent,
 * date or count through here is a hard error rather than a silently mis-scaled amount.
 *
 * Rates deliberately do NOT come through here: they stay unscaled integer percents (25, 10) and are
 * applied by `applyRateDecimal`, so a rate never inherits a money scale by accident.
 */
function paramBani(rule: FiscalRule, id: string): Bani {
  const p = rule.parameters.find((x: FiscalParameter) => x.id === id);
  if (!p || typeof p.value !== 'number') {
    throw new Error(`Missing numeric parameter '${id}' for rule ${rule.ruleId}`);
  }
  if (p.unit !== 'lei') {
    throw new Error(
      `Parameter '${id}' of rule ${rule.ruleId} has unit '${p.unit}', not 'lei' — refusing to read it as money`,
    );
  }
  if (!Number.isInteger(p.value)) {
    throw new Error(
      `Parameter '${id}' of rule ${rule.ruleId} is not an integer number of bani (${p.value})`,
    );
  }
  return p.value as Bani;
}

function calcWageReference(rule: FiscalRule): CalculatorResult {
  const has = rule.parameters.some((p) => p.id === 'reference' || p.id === 'monthly');
  if (!has) {
    return {
      reviewRequired: true,
      reason: `Rule ${rule.ruleId} has no numeric 'reference' or 'monthly' parameter`,
    };
  }
  const value = paramBani(rule, rule.parameters.some((p) => p.id === 'reference') ? 'reference' : 'monthly');
  return { value, breakdown: [`value: ${leiText(value)} lei`] };
}

// CF art. 148 alin. (2): the CAS base is "venitul ales de contribuabil, care nu
// poate fi mai mic decât" 12 SM (income between 12 SM and 24 SM) or 24 SM (income
// at or above 24 SM). That is a LADDER OF FLOORS, not a clamp: realized income only
// selects which floor applies, and there is NO upper cap. Contrast CASS
// art. 170 alin. (1), which says "nu poate fi mai mare decât" — that one is a cap.
// CF art. 148 alin. (1): below 12 SM the obligation never arises, so CAS is 0 —
// NOT the 12 SM figure.
function calcCas(rule: FiscalRule, input?: CalculatorInput): CalculatorResult {
  const ratePercent = paramNumber(rule, 'rate'); // unscaled integer percent — never a money amount
  const tier1Base = paramBani(rule, 'min_base'); // 12 SM floor
  const tier2Base = paramBani(rule, 'tier2_base'); // 24 SM floor
  const tier1Cas = paramBani(rule, 'tier1_cas');
  const tier2Cas = paramBani(rule, 'tier2_cas');
  const realized = input?.base ?? lei(0);

  if (input?.pensionStatus === 'da') {
    return {
      value: lei(0),
      breakdown: [
        'pensionar sau asigurat in propriul sistem de asigurari sociale — exceptie CF art. 150 alin. (1)',
        `venit realizat: ${leiText(realized)} lei`,
        'CAS = 0 lei (exceptia nu depinde de cuantumul venitului si nu este optionala)',
      ],
    };
  }

  if (realized < tier1Base) {
    return {
      value: lei(0),
      breakdown: [
        `venit realizat: ${leiText(realized)} lei`,
        `sub 12 SM anual (${leiText(tier1Base)} lei) — conditia din CF art. 148 alin. (1) nu este indeplinita`,
        `CAS = 0 lei (CF art. 148 alin. (4) permite optiunea voluntara la o baza >= ${leiText(tier1Base)} lei; neimplementata in aceasta faza)`,
      ],
    };
  }

  const inTier2 = realized >= tier2Base;
  const floor = inTier2 ? tier2Base : tier1Base;
  const floorCas = inTier2 ? tier2Cas : tier1Cas;
  const chosen = input?.chosenBase;
  // Not Math.max: that returns a plain `number` and would drop the Bani brand. Same comparison, kept typed.
  const base = chosen === undefined ? floor : chosen > floor ? chosen : floor;
  // CF art. 66 alin. (1) — EXTENDED to CAS by this app's policy (Titlul V states no rounding rule). The base
  // stays exact integer bani; only the contribution owed is rounded, and it is rounded here, once.
  const cas = roundArt66(applyRateDecimal(base, ratePercent));
  const breakdown = [
    `venit realizat: ${leiText(realized)} lei`,
    `prag aplicabil (CF art. 148 alin. (2) lit. ${inTier2 ? 'b' : 'a'}): ${leiText(floor)} lei`,
    `baza de calcul = venitul ales: ${leiText(base)} lei`,
    `CAS = ${leiText(base)} x ${ratePercent / 100} = ${leiText(cas)} lei`,
    `OPTIUNE INFORMATIONALA: minimul legal in acest prag este ${leiText(floorCas)} lei (baza ${leiText(floor)} lei); CF art. 148 alin. (2) nu prevede nicio plafonare superioara, deci o baza mai mare poate fi aleasa voluntar doar pentru o pensie mai mare`,
    `CAS la pragul de 12 SM = ${leiText(tier1Cas)} lei; la pragul de 24 SM = ${leiText(tier2Cas)} lei; fara plafon superior`,
  ];
  if (chosen !== undefined && chosen < floor) {
    breakdown.push(
      `baza aleasa ${leiText(chosen)} lei este sub pragul legal de ${leiText(floor)} lei si a fost ridicata la acest prag — CF art. 148 alin. (2) prevede un MINIM, nu o plafonare`,
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
  const ratePercent = paramNumber(rule, 'rate'); // unscaled integer percent
  const floorBase = paramBani(rule, 'min_base'); // 6 SM — CF art. 174 alin. (6) top-up floor
  const maxBase = paramBani(rule, 'max_annual_base'); // 72 SM — CF art. 170 alin. (1) ceiling
  const vna = input?.base ?? lei(0);
  // Derived, never declared as separate parameters (one legal figure, one source of truth) — and rounded
  // by the same single art. 66 call as every other sum due, so the floor figure and the computed figure
  // cannot disagree about how rounding works.
  const floorCass = roundArt66(applyRateDecimal(floorBase, ratePercent)); // 2,430 lei for 2026
  const ceilingCass = roundArt66(applyRateDecimal(maxBase, ratePercent)); // 29,160 lei for 2026

  // CF art. 174 alin. (2): a fiscal loss or a net income equal to zero owes NO CASS.
  if (vna <= 0) {
    return {
      value: lei(0),
      breakdown: [
        `venit net anual (VNA): ${leiText(vna)} lei`,
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
      const cass = roundArt66(applyRateDecimal(vna, ratePercent));
      return {
        value: cass,
        breakdown: [
          `venit net anual (VNA): ${leiText(vna)} lei`,
          `VNA sub pragul de 6 SM (${leiText(floorBase)} lei): art. 174 alin. (6) ar cere o diferenta de contributie pana la ${leiText(floorCass)} lei`,
          'exceptie: venituri din pensii (art. 99) REALIZATE in anul fiscal — CF art. 174 alin. (7) lit. c); fara prag valoric, nu e un simplu statut',
          'lit. c) elimina DOAR diferenta de la art. 174 alin. (6) — contributia de 10% pe VNA ramane datorata (art. 170 alin. (1)); pensia NU scuteste de CASS, spre deosebire de CAS unde art. 150 alin. (1) scuteste integral',
          `CASS = ${leiText(vna)} x ${ratePercent / 100} = ${leiText(cass)} lei`,
        ],
      };
    }
    // CF art. 174 alin. (7) lit. a): the top-up is not owed if salary and assimilated
    // income REALISED in that fiscal year is at least 6 SM. Phase 6 supplies the amount
    // (`salaryIncomeLei`), so the branch now computes instead of halting.
    // Note what the relief does and does not do: alin. (7) removes only the alin. (6)
    // DIFFERENCE. The art. 174 alin. (1) / art. 170 alin. (1) contribution of 10% x VNA
    // is still owed, and unlike the top-up it IS deductible under art. 118 alin. (2) lit. b)
    // (which carves out only „diferența … prevăzută la art. 174 alin. (6)”).
    if (input?.salaryStatus === 'da') {
      const salary = input.salaryIncomeLei;
      if (salary === undefined) {
        return {
          reviewRequired: true,
          reason:
            `VNA ${leiText(vna)} lei este sub pragul de 6 SM (${leiText(floorBase)} lei), dar diferenta de contributie din CF art. 174 alin. (6) nu se datoreaza daca veniturile din salarii si asimilate ale anului fiscal sunt cel putin egale cu 6 salarii minime brute (art. 174 alin. (7) lit. a)). Profilul are salaryStatus = da dar nu contine cuantumul salarial — nu se poate stabili.`,
        };
      }
      if (salary >= floorBase) {
        const cass = roundArt66(applyRateDecimal(vna, ratePercent));
        return {
          value: cass,
          breakdown: [
            `venit net anual (VNA): ${leiText(vna)} lei`,
            `VNA sub pragul de 6 SM (${leiText(floorBase)} lei): art. 174 alin. (6) ar cere o diferenta de contributie pana la ${leiText(floorCass)} lei`,
            `exceptie: venituri din salarii si asimilate realizate in anul fiscal = ${leiText(salary)} lei, cel putin egal cu 6 salarii minime brute (${leiText(floorBase)} lei) — CF art. 174 alin. (7) lit. a)`,
            'lit. a) elimina DOAR diferenta de la art. 174 alin. (6) — contributia de 10% pe VNA ramane datorata (art. 174 alin. (1), art. 170 alin. (1))',
            `CASS = ${leiText(vna)} x ${ratePercent / 100} = ${leiText(cass)} lei (fara diferenta de contributie; intreaga contributie este deductibila per art. 118 alin. (2) lit. b))`,
          ],
        };
      }
      // salary < 6 SM: the condition in alin. (7) lit. a) is not met, so the top-up stands.
      // Falls through to the art. 174 alin. (6) branch below.
    }
    // B-13: the top-up is OWED but NOT DEDUCTIBLE. art. 174 alin. (6) creates a „diferență de
    // contribuție” up to a 6 SM base when the art. 68 net income is positive but smaller than 6 SM; the
    // art. 174 alin. (1) / art. 170 alin. (1) contribution itself stays 10% × net income. Art. 118 alin.
    // (2) lit. b) deducts the contributions „datorate potrivit prevederilor titlului V” but expressly
    // „cu excepția diferenței de contribuție de asigurări sociale de sănătate prevăzută la art. 174 alin.
    // (6)”, and alin. (2^3) prorates over the contribution „calculată potrivit art. 174 alin. (1)”.
    // So the deductible part is `due`, while the whole `floorCass` stays payable. Reported as
    // `nonDeductible` so the income-tax base composes correctly instead of absorbing the difference.
    const due = roundArt66(applyRateDecimal(vna, ratePercent)); // art. 174 alin. (1) / art. 170 alin. (1): 10% x VNA
    // Derived by subtraction from the already-rounded total, so `value - nonDeductible === due` holds
    // exactly. Rounding the two parts independently could have left them one ban apart.
    const difference = subBani(floorCass, due); // art. 174 alin. (6): differenta de contributie — neimputabila
    return {
      value: floorCass,
      nonDeductible: difference,
      breakdown: [
        `venit net anual (VNA): ${leiText(vna)} lei`,
        `baza de calcul = pragul de 6 SM: ${leiText(floorBase)} lei — CF art. 174 alin. (6) (NU art. 170 alin. (2)-(3), care vizeaza doar art. 155 alin. (1) lit. c)-h))`,
        `CASS = ${leiText(floorBase)} x ${ratePercent / 100} = ${leiText(floorCass)} lei — o diferenta de contributie pana la baza de 6 SM, nu inlocuirea bazei`,
        'CF art. 118 alin. (2) lit. b): diferenta de la art. 174 alin. (6) NU se scade din baza impozabila (reparație de coerență, nu de calcul)',
        `CASS deductibila din baza impozabila = ${leiText(vna)} x ${ratePercent / 100} = ${leiText(due)} lei (art. 174 alin. (1)); diferenta neimputabila = ${leiText(difference)} lei (art. 174 alin. (6), exclusa expres de art. 118 alin. (2) lit. b))`,
        ...(input?.salaryStatus === 'da'
          ? [
              `conditia din art. 174 alin. (7) lit. a) nu este indeplinita: venituri din salarii ${leiText(input.salaryIncomeLei!)} lei < 6 salarii minime brute (${leiText(floorBase)} lei), deci diferenta ramane datorata`,
            ]
          : []),
      ],
    };
  }

  // Not Math.min: it returns a plain `number` and would drop the Bani brand.
  const base = vna < maxBase ? vna : maxBase;
  const cass = roundArt66(applyRateDecimal(base, ratePercent));
  const breakdown = [
    `venit net anual (VNA): ${leiText(vna)} lei`,
    `baza de calcul: ${leiText(base)} lei`,
    `CASS = ${leiText(base)} x ${ratePercent / 100} = ${leiText(cass)} lei`,
  ];
  if (vna > maxBase) {
    breakdown.push(
      `VNA depaseste plafonul de 72 SM (${leiText(maxBase)} lei) — baza se plafoneaza: CF art. 170 alin. (1) "nu poate fi mai mare decât"`,
      `CASS la plafon = ${leiText(ceilingCass)} lei, derivata din ${leiText(maxBase)} x ${ratePercent / 100} (nu exista un parametru separat pentru acest numar)`,
    );
  }
  return { value: cass, breakdown };
}

function calcIncomeTax(rule: FiscalRule, input?: CalculatorInput): CalculatorResult {
  const baseRatePercent = paramNumber(rule, 'base_rate'); // unscaled integer percent
  const base = input?.base;
  if (typeof base !== 'number') {
    return { reviewRequired: true, reason: 'No base provided for income tax calculation' };
  }
  // CF art. 66 alin. (1) proper — this is the sum the article actually governs. One rounding, here.
  const tax = roundArt66(applyRateDecimal(base, baseRatePercent));
  return {
    value: tax,
    breakdown: [
      `base: ${leiText(base)} lei`,
      `income tax = ${leiText(base)} x ${baseRatePercent / 100} = ${leiText(tax)} lei (10% base rate)`,
      // The 16% "surcharge" note was removed (Phase 5 — the cleanup named in defect B-4's "Fixed in"
      // cell): CF art. 115 alin. (1) lit. b)
      // applies 16% only to art. 114 alin. (2) lit. h)/i) "alte venituri", and art. 114 alin. (1)
      // confines that category to incomes NOT under art. 61 lit. a)-h). PFA sistem real income is
      // art. 61 lit. a) / art. 68, so it is outside art. 114 entirely and takes the flat 10% of
      // art. 123 alin. (1). There is no second rate for this entity type and nothing to review.
      'CF art. 123 alin. (1): cota de 10% se aplica asupra venitului net anual impozabil determinat potrivit art. 118; nu exista cota progresiva pentru venitul din art. 68 (art. 114 alin. (1), art. 115 alin. (1) lit. b))',
    ],
  };
}

function calcVatThreshold(rule: FiscalRule): CalculatorResult {
  const threshold = paramBani(rule, 'threshold');
  return { value: threshold, breakdown: [`VAT threshold: ${leiText(threshold)} lei`] };
}

function calcDeadline(rule: FiscalRule): CalculatorResult {
  const deadline = paramValue(rule, 'deadline');
  if (typeof deadline !== 'string') {
    return {
      reviewRequired: true,
      reason: `Rule ${rule.ruleId} has no date parameter 'deadline'`,
    };
  }
  return { value: lei(0), breakdown: [`deadline: ${deadline}`] };
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
