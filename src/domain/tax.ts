/**
 * PFA 2026 deterministic tax calculation engine (Step 15).
 * Consumes TaxInputsReference (derived.ts) + active rule release.
 * Domain purity: no React, DOM, localStorage, or store imports.
 */
import type { PfaProfile } from './models';
import { cassLadderForYear } from './models';
import type { FiscalRule, RuleRelease } from './fiscal/rules';
import type { TaxInputsReference } from './derived';
import type { CalculationLine, CalculationOutput, TaxCalculationSnapshot } from './snapshots/types';
import { selectApplicableRules } from './fiscal/select';
import { calculatorRegistry } from './fiscal/calculators';
import { readCassExceptionFacts, readPensionSuspension, readPensionerStatus } from './pensionFacts';
import { regimeRefusalReason } from './regimes';
import { createCalculationSnapshot } from './snapshots/snapshot';
import Decimal from 'decimal.js-light';
import { lei, leiText, subBani, sumBani, type Bani } from './money';

export interface TaxCalculationInput {
  inputs: TaxInputsReference;
  profile: PfaProfile;
  revenues: Bani;
  expenses: Bani;
  /** Total revenues without VAT (valoareFaraTva only). */
  revenuesNet: Bani;
  /** Total expenses without VAT (valoareFaraTva only). */
  expensesNet: Bani;
  /**
   * PG-6h-1 — CF art. 68^3: the GROSS of an accommodation register whose net the law fixes at 70 % of
   * gross (alin. (2)), already converted to lei at the per-collection BNR rate (alin. (4)).
   *
   * It is a GROSS, and it is a separate operand from `revenues` for a reason. art. 68^3 alin. (2) does
   * not deduct the register's expenses at all — it replaces them with the flat ratio — so feeding these
   * receipts through the sistem-real expense path would apply art. 68 alin. (4) to a taxpayer art. 68
   * alin. (1) expressly excepts. Absent or `null` means this taxpayer has no art. 68^3 source, which is
   * the state every pre-PG-6h payload is in and the state in which this whole path stays inert.
   */
  flatRatioGross?: Bani | null;
  /**
   * TASK 6: the release the calculation is bound to, or `null` when this build registers none for the
   * profile's fiscal year. `null` makes the engine refuse instead of writing a snapshot that names no law
   * — the old behaviour was to hand in the 2026 release whatever the year said, which is how a call site
   * could silently re-bind a calculation to rules from a year it was not asking about.
   */
  ruleRelease: RuleRelease | null;
  rules: FiscalRule[];
}

/** CF art. 118 alin. (2) lit. a) + alin. (4)-(5): a fiscal loss on this source, surfaced for
 * display. Phase 5 does NOT persist it — there is no prior-year store yet (Phase 7). */
export interface FiscalLossCarryForward {
  amount: Bani;
  years: number;
  capPercent: number;
  sameSourceOnly: true;
  rule: string;
}

/**
 * The amounts the engine actually computed on, in lei. Named explicitly so no consumer has
 * to guess which candidate quantity a figure is — this is the value thresholds and any
 * future report must read instead of re-deriving an amount from `lines` labels.
 */
export interface TaxAmountBases {
  /**
   * Venit brut — the revenue base the engine selected: `revenuesNet` (VAT-exclusive) for a
   * VAT payer, `revenues` (VAT-inclusive) otherwise. See CF art. 68 alin. (2)-(3).
   */
  venitulBrut: Bani;
  /** Cheltuieli deductibile — the expense base selected by the same VAT rule. */
  cheltuieliDeductibile: Bani;
  /**
   * Venit net din activitate = `venitulBrut - cheltuieliDeductibile`. This IS the base CAS is
   * chosen on (CF art. 148 alin. (1)-(2)) and the base CASS is owed on (CF art. 170 alin. (1),
   * art. 174 alin. (2) și (6)) — the exact value passed as `base` to `calcCas` and `calcCass`.
   * It is NOT `YtdTotals.net`, which subtracts VAT-inclusive operands.
   *
   * B-85: it is the net of the ONE determination method this profile-year is run under. For an
   * art. 68^3 register that net is 70 % of the receipts under art. 68^3 alin. (2), not the difference
   * between the register's receipts and its recorded expenses — the flat ratio replaces those expenses,
   * it does not sit beside them. A consumer reading this field must not have to know which method ran.
   */
  venitulNetDinActivitate: Bani;
  /**
   * PG-6h-1 — the amount the CAS and CASS figures in this result were actually measured on, i.e. the
   * cumulated art. 155 alin. (1) lit. b) base of art. 148 alin. (3) and art. 170 alin. (1). Present only
   * when a second lit. b) source (art. 68^3) was in play; with one source it equals
   * `venitulNetDinActivitate`, and saying so twice would be two numbers for one quantity.
   *
   * It exists because a threshold row that measures on a different amount than the engine did is the
   * B-71 defect class: the percentage and the figure disagreeing about the same record.
   *
   * B-85 narrowed what "a second source" means. A `cazare` register supplies ONE source, determined by
   * ONE method, so it writes this field not at all — the flat ratio beside the sistem-real difference is
   * two methods over one source, not two sources, and cumulating them produced 1,7 × the receipts.
   */
  venitulNetCumulatPentruContributii?: Bani;
  /**
   * PG-6d — the annual CASS base the art. 155 alin. (1) lit. c)-h) ladder chose for this person, per
   * art. 170 alin. (3). Present only when that ladder actually ran.
   *
   * It is a SEPARATE field from the two above because it is a separate basin: art. 170 alin. (1) measures
   * the lit. b) net (capped at 72 SM), art. 170 alin. (2)-(4) measures the lit. c)-h) cumulation (no cap,
   * and a 6-SM condition precedent). A surface that reads one of these as the other is the B-71 defect
   * class — a figure and a percentage disagreeing about the same money.
   */
  bazaDeCalculCassArt155LitCH?: Bani;
}

/**
 * B-85 — how the engine holds income: one LEG per SOURCE, each determined by ONE method.
 *
 * The name matters. A leg is not "a method" and it is not "a record set": it is one source of art. 155
 * alin. (1) lit. b) income together with the net that source's determination method produced. art. 148
 * alin. (3) and art. 170 alin. (1) cumulate across SOURCES, so the leg list is a list of sources. Two
 * methods over one source are not two legs — that is defect B-85, and the method gate in
 * `computeTaxEstimate` is what keeps the list at one entry per register.
 */
export type IncomeDeterminationMethodTag = 'sistem-real' | 'accommodation-flat-ratio';

export interface ContributionLeg {
  method: IncomeDeterminationMethodTag;
  net: Bani;
}

/** The three quantities the art. 68^3 calculator returns for one register, kept together so no consumer
 *  can pair one leg's gross with another leg's net. */
interface FlatRatioLeg {
  gross: Bani;
  net: Bani;
  tax: Bani;
}

/**
 * The cumulated art. 155 alin. (1) lit. b) base the contributions are measured on.
 *
 * art. 148 alin. (3) (CAS) and art. 170 alin. (1) (CASS) both measure on the amount CUMULATED across
 * lit. b) sources, and art. 170 alin. (1) keeps art. 118 fiscal losses out of it. With a single source
 * this is that source's net itself — sign included, because `calcCass` reads a negative as the art. 174
 * alin. (2) zero/loss case rather than as a positive base it has to be told about. Only once a SECOND
 * SOURCE exists does it become a sum, and then the loss term is what drops out, which is why the legs are
 * floored at zero from the second entry onward and not before it.
 *
 * Exported because this is the half of the composition that had to survive B-85's fix. The cumulation is
 * the law and it is not what was wrong; what was wrong is that one register was allowed to supply two
 * legs. `art68x3.arithmetic.test.ts` pins both directions: two genuine sources still sum, one register
 * never does.
 */
export function cumulateContributionBase(legs: readonly ContributionLeg[]): Bani {
  if (legs.length === 0) return lei(0);
  if (legs.length === 1) return legs[0].net;
  return sumBani(legs.map((leg) => (leg.net > 0 ? leg.net : lei(0))));
}

/**
 * CF art. 118 alin. (2^2) and (2^3): the share of each contribution the sistem-real source may deduct.
 *
 * Both letters divide the same numerator — „venit net anual determinat în sistem real” — by a cumulated
 * denominator, art. 148 alin. (3) for CAS and art. 170 alin. (1) for CASS. Those two denominators are the
 * same quantity in this build, so both ratios come out of this one helper; they stay two calls at the call
 * site because the law states them as two ratios and a later year may give them different bases.
 *
 * While there is one source the denominator IS the sistem-real net, so the ratio is exactly 1 and the
 * proration is a no-op — no profile that computed before B-85 sees a deduction move. With a second genuine
 * source the denominator is larger, the ratio falls below 1, and the sistem-real deduction is prorated
 * instead of inherited whole. That is also what keeps the art. 68^3 tax ring-fenced: alin. (11) delimits
 * the INCOME TAX, not the contributions, so a second source enlarges the denominator without ever
 * receiving a deduction. With NO sistem-real leg there is nothing to apportion and 1 is the honest answer
 * rather than 0: a ratio is not a deduction, and 0 would read like one.
 */
export function sistemRealContributionRatio(legs: readonly ContributionLeg[]): Decimal {
  const sistemReal = legs.find((leg) => leg.method === 'sistem-real');
  if (sistemReal === undefined) return new Decimal(1);
  const total = cumulateContributionBase(legs);
  if (total > 0) return new Decimal(sistemReal.net > 0 ? sistemReal.net : lei(0)).div(total);
  return new Decimal(1);
}

export type TaxEstimateResult =
  | {
      status: 'computed';
      lines: CalculationLine[];
      output: CalculationOutput;
      snapshot: TaxCalculationSnapshot;
      /** The bases the computation ran on, typed (not recoverable only from `lines` labels). */
      bases: TaxAmountBases;
      lossCarryForward?: FiscalLossCarryForward;
    }
  | { status: 'review_required'; reason: string; lines: CalculationLine[] };

function rr(reason: string, lines: CalculationLine[] = []): TaxEstimateResult {
  return { status: 'review_required', reason, lines };
}

/**
 * Accept a Decimal money amount only when it is already a whole number of bani.
 *
 * Deliberately NOT a rounding function. CF art. 66 alin. (1) rounds the sums that are DUE; it says nothing
 * about a deduction or a base, and rounding either of those changes the tax itself. So an inexact
 * intermediate is reported, never repaired.
 */
function exactBani(value: Decimal): Bani | null {
  return value.isInteger() ? (value.toNumber() as Bani) : null;
}

/**
 * B-19 — the one sentence the engine says out loud whenever CASS is zeroed by the profile flag
 * rather than by a rule. Exported as a constant so the engine line, the persisted snapshot and any
 * UI that surfaces it use the SAME words instead of three paraphrases that can drift apart.
 *
 * Established: CF art. 154 alin. (1) is headed „Categorii de persoane fizice exceptate de la plata
 * contribuției de asigurări sociale de sănătate" and is a CLOSED list; none of its live letters
 * reaches a persoană fizică cu activitate independentă. NOT established: any legal basis for
 * zeroing a PFA's CASS from this flag — which is exactly why the line carries `reviewRequired`.
 * The words „scutit"/„scutire" appear nowhere in Titlul V, so they appear nowhere here either.
 */
export const CASS_FLAG_REVIEW_REASON =
  'CASS = 0 provine din steagul profilului (socialInsuranceStatus), nu dintr-o regulă aplicabilă. '
  + 'Art. 154 alin. (1) este o listă închisă de categorii „exceptate de la plata contribuției de '
  + 'asigurări sociale de sănătate", iar niciuna nu acoperă o persoană fizică cu activitate '
  + 'independentă (PFA); nu a fost găsit niciun temei care să scutească un PFA de CASS. CASS = 0 lei '
  + 'rămâne valoarea calculată, dar nu poate fi prezentată ca o scutire dovedită.';

export async function computeTaxEstimate(input: TaxCalculationInput): Promise<TaxEstimateResult> {
  const { inputs, profile, revenues, expenses, revenuesNet, expensesNet, flatRatioGross, ruleRelease, rules } = input;
  // `leiText`, not the raw value: these sentences are read by a person, and a person reads leu.
  if (!Number.isFinite(revenues) || revenues < 0) return rr(`Veniturile trebuie să fie >= 0, s-a obținut ${leiText(revenues)}`);
  if (!Number.isFinite(expenses) || expenses < 0) return rr(`Cheltuielile trebuie să fie >= 0, s-a obținut ${leiText(expenses)}`);
  if (!Number.isFinite(revenuesNet) || revenuesNet < 0) return rr(`Veniturile nete (fără TVA) trebuie să fie >= 0, s-a obținut ${leiText(revenuesNet)}`);
  if (!Number.isFinite(expensesNet) || expensesNet < 0) return rr(`Cheltuielile nete (fără TVA) trebuie să fie >= 0, s-a obținut ${leiText(expensesNet)}`);
  if (!profile?.id) return rr('Profilul lipsește sau nu are id');
  const lines: CalculationLine[] = [];
  // TASK 6: no release registered for this fiscal year ⇒ no arithmetic may run and no snapshot may be
  // written. Falling back to a release from another year is exactly the silent re-binding this phase
  // removes, so the refusal names the year instead.
  if (!ruleRelease) {
    return rr(
      `Niciun set de reguli înregistrat pentru anul fiscal ${inputs.fiscalYear}; calculul nu poate fi legat de nicio regulă.`,
      lines,
    );
  }
  const asOf = `${inputs.fiscalYear}-01-01`;
  const applicable = selectApplicableRules(rules, { taxYear: inputs.fiscalYear, asOfDate: asOf });
  const casRule = applicable.find((r) => r.taxRegime === 'cas');
  const cassRule = applicable.find((r) => r.taxRegime === 'cass');
  const incomeTaxRule = applicable.find((r) => r.taxRegime === 'income-tax');
  // PG-6h-1: the art. 68^3 method rule. A FOURTH regime string, deliberately not a reuse of the three
  // above — see the note on `FiscalRegime` in `fiscal/rules.ts`. Its absence is not neutral: it is the
  // year-scoping guard. A fiscal year with no art. 68^3 rule (FY2027 today) must refuse a 68^3 gross
  // rather than compute it under 2026 percentages it was never given.
  const flatRatioRule = applicable.find((r) => r.taxRegime === 'accommodation-flat-ratio');
  if (!casRule) return rr(`Regula CAS nu a fost găsită pentru anul fiscal ${inputs.fiscalYear}`, lines);
  if (!cassRule) return rr(`Regula CASS nu a fost găsită pentru anul fiscal ${inputs.fiscalYear}`, lines);
  if (!incomeTaxRule) return rr(`Regula de impozit pe venit nu a fost găsită pentru anul fiscal ${inputs.fiscalYear}`, lines);

  // B-14: THE REGIME GATE WAS INVERTED. A PFA cannot be a CIT taxpayer in 2026: CF art. 13 alin. (1)
  // makes impozitul pe profit owed "de persoanele juridice", and art. 14 and art. 15 each define the
  // Titlul II taxpayer as a persoană juridică. The vehicle that once let an individual opt into it —
  // CF art. 120 — is Abrogat (OUG 128/2024 pct. 11 Art. I, MO 1125/11.11.2024, de la 01.01.2025).
  // So `impozit_pe_venit` (CF art. 123 alin. (1) + art. 118, Titlul IV sistem real) is the ONLY regime
  // this package can compute — and it is also the default regime of every profile (profile.ts:38).
  // `impozit_pe_cit` is therefore NOT "a different base applies": it is a data-integrity failure.
  // Either the recorded regime is wrong or the entity is not a PFA at all. No Titlul II rule exists in
  // the rule set and none may legally apply to a persoană fizică, so the engine must refuse and say why
  // instead of computing a number under a regime the taxpayer cannot have.
  const regimeRefusal = regimeRefusalReason(inputs.regime);
  if (regimeRefusal) return rr(regimeRefusal, lines);
  // Phase 6 moved the wording into `regimes.ts` so the profile editor and the engine refuse with the
  // SAME text, and added `norma_venit`: a regime the app can record but cannot compute (no norm rule
  // in the 2026 package, no norm values — none invented). Both surface as REVIEW_REQUIRED.

  // ── PG-6h-2b (B-85): ONE determination method per profile-year ─────────────────────────
  //
  // The defect this gate exists to make impossible. `revenues`/`expenses` and `flatRatioGross` are not two
  // sources. The assembler measures both on the SAME register — `estimateBasis.ts selectEstimateOperands`
  // takes the flat gross from the same `selectYtd` pass it takes the sistem-real operands from. For a
  // `cazare` register the expense engine returns an empty deductible set, so the sistem-real leg was
  // „revenue with zero deductions" and the flat leg was „70 % of that same revenue", and the composition
  // added them: `cumulatedNet` came out at 1,7 × the register's receipts, with an art. 123 income tax and
  // an art. 68^3 alin. (6) income tax stacked on top of each other. Nothing structural prevented it — only
  // an upstream scenario refusal did, and a refusal that lives in another module is not a guard.
  //
  // The honest shape is one method per profile-year. Where the law supplies the flat-ratio method the
  // sistem-real leg is not run at all: not zeroed after the fact, not subtracted back out, not clamped —
  // never constructed. That is why the flat leg is resolved BEFORE the leg list is built and before any
  // line is pushed: the suppression has to be upstream of the combination, or the next refactor that
  // reorders this function puts the 1,7 × back.
  //
  // What is deliberately NOT done here is the opposite fix — deciding which RECEIPTS belong to which
  // method. A `Revenue` record carries no category, no activity marker and no source; its `tip` is
  // 'factura' | 'notafactura', a document type. The app cannot attribute a receipt to a determination
  // method, so it must not pretend one register is partly this method and partly that one. A genuinely
  // mixed year is refused upstream, by `scenarios.ts`, naming the missing attribution.
  //
  // Area 6: VAT is not taxable income. Non-exempt profiles are taxed on the net base
  // (VAT excluded); exempt profiles keep the gross base. These are the sistem-real operands only; the flat
  // gross already carries the same VAT rule, applied per receipt by `estimateBasis.ts flatRatioGrossFromYtd`.
  const sistemRealGross = inputs.vatExempt ? revenues : revenuesNet;
  const sistemRealExpenseBase = inputs.vatExempt ? expenses : expensesNet;

  // ── PG-6h-1: art. 68^3 — the flat-ratio source, computed by its own registered calculator ──────
  //
  // Two things this block is, and two things it is not.
  //
  // It IS the composition: it calls the registered `calc-accommodation-flat-ratio`, which reads the 30 %
  // and the 10 % from ACCOMMODATION_68X3_2026, and it decides where the resulting net goes. It does not
  // do arithmetic of its own — there is no 0.7 and no 0.1 anywhere in this file.
  //
  // It is NOT a second opinion about who qualifies for art. 68^3. The caller decided that, from a fact
  // the person declared; this block only honours the operand it was handed.
  //
  // Where the net goes is the part most likely to be got wrong, so it is stated once, here:
  //   - CAS  (art. 148 alin. (3)) — the net joins the CUMULATED amount that SELECTS the 12 / 24-SM tier.
  //     It never becomes the CAS base: art. 148 alin. (2) makes the base „venitul ales de contribuabil",
  //     never below the tier floor. `calcCas` already encodes that, and it is fed an amount, not a base.
  //   - CASS (art. 170 alin. (1)) — the net IS the base, floored at 6 SM by art. 174 alin. (6) and capped
  //     at 72 SM. The 6/12/24-SM ladder of art. 170 alin. (2)-(4) is expressly limited to art. 155 alin.
  //     (1) lit. c)-h) and does not reach this income, which is lit. b).
  //   - Income tax — ring-fenced. alin. (6) says „impozitul fiind final", and alin. (11) ring-fences the
  //     INCOME TAX only: contributions cumulate, the tax does not. So this tax is 10 % of this net and
  //     is not routed through the art. 118 alin. (2) deduction composition below.
  let flatLeg: FlatRatioLeg | null = null;
  if (typeof flatRatioGross === 'number') {
    if (!flatRatioRule) {
      return rr(
        `Regula de stabilire a venitului din prestarea de servicii de cazare (art. 68^3) nu a fost găsită ` +
          `pentru anul fiscal ${inputs.fiscalYear}; un venit brut din art. 68^3 nu poate fi calculat după ` +
          'regulile unui alt an.',
        lines,
      );
    }
    const flatRes = calculatorRegistry['calc-accommodation-flat-ratio'](flatRatioRule, {
      gross: flatRatioGross,
    });
    if ('reviewRequired' in flatRes) return rr(flatRes.reason, lines);
    if (typeof flatRes.determinedNet !== 'number') {
      // Defensive, and reported rather than assumed: the composition needs the net the rule determined,
      // and re-deriving it here by subtracting a ratio this file does not hold is exactly how a figure
      // and the sentence beside it start disagreeing.
      return rr(
        'Regula art. 68^3 nu a raportat venitul net determinat; compoziția nu îl recalculează pe cont propriu.',
        lines,
      );
    }
    flatLeg = { gross: flatRatioGross, net: flatRes.determinedNet, tax: flatRes.value };
  }

  // THE GATE. One leg per source, and the operand the assembler supplied decides which one this register
  // is. `flatRatioGross` is attached by `estimateBasis.ts withFlatRatioGross` only when
  // `selectIncomeDeterminationMethod` answered `accommodation-flat-ratio`, so its presence IS the method
  // decision — read here, not re-derived. When it is present the sistem-real operands do not become a leg:
  // they are the same receipts seen twice, and adding them would be the 1,7 × again.
  const legs: ContributionLeg[] =
    flatLeg === null
      ? [{ method: 'sistem-real', net: subBani(sistemRealGross, sistemRealExpenseBase) }]
      : [{ method: 'accommodation-flat-ratio', net: flatLeg.net }];

  // The three quantities every consumer reads, stated once per method so `gross - deductibleBase === net`
  // holds on either branch and no surface has to know which method ran in order to read them. For the
  // flat method the expense here is the deemed ratio, not a recorded cost: art. 68^3 alin. (2) replaces
  // the register's expenses with it, which is precisely why the sistem-real expense leg is not run beside it.
  const net = legs[0].net;
  const gross = flatLeg === null ? sistemRealGross : flatLeg.gross;
  const deductibleBase =
    flatLeg === null ? sistemRealExpenseBase : subBani(flatLeg.gross, flatLeg.net);
  const flatTax: Bani = flatLeg === null ? lei(0) : flatLeg.tax;

  if (flatLeg === null) {
    lines.push({ label: 'Venit brut', value: gross });
    // B-16: this used to be `Math.min(deductibleBase, gross)`. That clamp forced the net to stay >= 0, so
    // a fiscal loss was UNREPRESENTABLE — an expense-heavy year came out as "no tax, no loss" and the
    // loss was silently thrown away. CF art. 118 alin. (2) lit. a) names „pierderea netă recalculată pe
    // fiecare sursă” as a figure the taxpayer must determine, so a negative sistem-real difference is a
    // legal number the engine has to carry, not clamp to zero.
    // Still out of scope (recorded as an input gap, not faked into a rule): whether each individual
    // expense is deductibilă under CF art. 68 alin. (4) — the app holds no per-expense nature data.
    lines.push({ label: 'Cheltuieli deductibile', value: deductibleBase });
    // `subBani`, not `-`: integer minus integer stays integer, and the Bani brand survives.
    lines.push({ label: 'Venit net din activitate', value: net });
  } else {
    lines.push({ label: 'Venit brut art. 68^3 (încasări)', value: gross });
    lines.push({ label: 'Cheltuieli forfetare 30 % (art. 68^3 alin. (2))', value: deductibleBase });
    lines.push({ label: 'Venit net art. 68^3', value: net });
  }

  // CF art. 118 alin. (3) verbatim: „Veniturile din categoriile prevăzute la art. 61 lit. a), a^1), c) și
  // f), ce se realizează într-o fracțiune de an sau în perioade diferite ce reprezintă fracțiuni ale
  // aceluiași an, se consideră venit anual.” A PFA that started mid-year is taxed on the full-year
  // basis — the CAS/CASS floors are NOT prorated. Surfaced from the profile's start date so the user
  // sees the rule that applies; no figure changes. Date semantics stay Phase 9. It sits below the gate
  // because the figure beside it is whichever net the method produced, not a sistem-real one.
  if (profile.pfaStartDate && !profile.pfaStartDate.endsWith('-01-01')) {
    lines.push({ label: 'Fracțiune de an (art. 118 alin. (3)): venit anual', value: net });
  }

  // art. 148 alin. (3) (CAS) and art. 170 alin. (1) (CASS) both measure the contributions on the amount
  // CUMULATED across art. 155 alin. (1) lit. b) SOURCES — see `cumulateContributionBase`. With one source
  // this is that source's net itself, sign included; the cumulation only becomes a sum when a second
  // genuine source exists, and B-85 is the reason one register never supplies two.
  const cumulatedNet = cumulateContributionBase(legs);
  if (legs.length > 1) {
    lines.push({ label: 'Venit cumulat pentru contribuții (art. 148 alin. (3), art. 170 alin. (1))', value: cumulatedNet });
  }

  // CF art. 150 alin. (1): pensioners and persons insured in their own social insurance system owe no
  // CAS. TASK 5 reads it from `pensionerStatus` — the STATUS fact, which is the correct key here and the
  // only place in this area where a status is the correct key. `inputs.salaryStatus` is deliberately NOT
  // passed: art. 150 alin. (2) exempts salary earners only for art. 137 alin. (1) lit. b^1) (drepturi de
  // proprietate intelectuală), not lit. b), so a salaried PFA owner still owes full CAS on
  // independent-activity income. A CAS of 0 (exemption, or income below 12 SM) flows through `taxable`
  // and the lines unchanged. NOTE the asymmetry: nothing in this CAS block feeds the CASS block below —
  // CAS art. 150 alin. (1) exempts entirely, CASS art. 174 alin. (7) lit. c) waives only a difference,
  // and it keys on pension sums received in the year, not on the status that keys this call.
  const pensionerStatus = readPensionerStatus(inputs);
  const cassFacts = readCassExceptionFacts(inputs, inputs.fiscalYear);
  const casRes = calculatorRegistry['calc-cas'](casRule, {
    // PG-6h-1: the CUMULATED lit. b) amount, per art. 148 alin. (3). With one source this is exactly the
    // value this call always received. It is an amount that SELECTS the statutory tier — `calcCas` never
    // makes it the base, which is what art. 148 alin. (2) forbids.
    base: cumulatedNet,
    pensionerStatus,
  });
  if ('reviewRequired' in casRes) return rr(casRes.reason, lines);
  lines.push({ label: 'CAS (25%)', value: casRes.value });

  let cassValue: Bani = lei(0);
  let cassNonDeductibila: Bani = lei(0);
  // ── PG-6d (D-OTH-1, B-41): the SECOND CASS track — art. 155 alin. (1) lit. c)-h) ──────────
  //
  // This is a different contribution route, not a second opinion about the first one:
  //
  //   art. 170 alin. (1) — the cumulated **lit. b)** net IS the base, floored at 6 SM by the art. 174
  //     alin. (6) difference and capped at 72 SM. That is `calcCass` above.
  //   art. 170 alin. (2)-(4) + art. 174¹ alin. (1) — the amount cumulated across lit. c)-h) only SELECTS
  //     one of three bases (6 / 12 / 24 SM); below 6 SM cumulated nothing is owed at all, and the 72-SM
  //     cap does not reach this basin. That is `calc-cass-ladder` here.
  //
  // The two never merge: the PFA's own net never enters the 6/12/24 test, and the ladder never enters the
  // 72-SM cap — the same discipline `research/38` §1.5 applies to art. 68^3, and the reason the ladder gets
  // its own operand instead of a bigger `base`.
  //
  // What the ladder DOES feed is the art. 174 alin. (7) lit. b) test inside `calcCass`: that litera waives
  // the alin. (6) difference where the person owes CASS on lit. c)-h) income „la un nivel cel puțin egal
  // cu 6 salarii minime brute”, and until now the app had only a flag to answer with.
  //
  // The ladder's own contribution is deliberately NOT routed into the art. 118 alin. (2) deduction
  // composition below: alin. (2^3) prorates „contribuția … calculată potrivit art. 174 alin. (1)”, and the
  // ladder contribution is calculated under art. 174¹ alin. (1). Deducting it from the Titlul IV base
  // would borrow a deduction from a provision that does not grant it.
  let cassLadderValue: Bani = lei(0);
  let cassLadderBase: Bani | undefined;
  let cassLadderDivergence: string | undefined;
  // CASS AND CAS TREAT PENSIONERS DIFFERENTLY — and TASK 5 split the fact that used to serve both.
  //   CAS:  CF art. 150 alin. (1) — a pensioner owes NO CAS at all on art. 137 alin. (1) lit. b)/b^1)
  //         income (the call above). Key: pensioner STATUS.
  //   CASS: CF art. 174 alin. (7) lit. c) — pension SUMS RECEIVED in that fiscal year remove ONLY the
  //         art. 174 alin. (6) top-up to 6 SM. 10% × net is still owed whenever net > 0, so no pension
  //         fact may zero CASS here. Key: RECEIPT in the year, at any amount.
  // The two facts travel separately precisely so neither branch can borrow the other's key.
  // `salaryStatus` is passed for CASS only: art. 174 alin. (7) lit. a) makes the top-up conditional on
  // salary income of at least 6 SM. It is deliberately NOT passed to calcCas (art. 150 alin. (2)
  // covers only lit. b^1)).
  // A CASS of 0 — art. 174 alin. (2) zero/loss year, or the art. 153 alin. (2) exclusion — flows through
  // `taxable` and the lines unchanged; the reviewRequired case aborts with the reason and the partial
  // lines rather than reporting a wrong number.
  if (inputs.socialInsuranceStatus === 'obligatoriu') {
    const ladderYear = cassLadderForYear(inputs.cassLadderYears, inputs.fiscalYear);
    if (ladderYear !== undefined) {
      const ladderRes = calculatorRegistry['calc-cass-ladder'](cassRule, {
        cassLadder: {
          amounts: {
            proprietate_intelectuala: ladderYear.proprietateIntelectuala,
            asociere_persoana_juridica: ladderYear.asocierePersoanaJuridica,
            cedarea_folosintei_bunurilor: ladderYear.cedareaFolosinteiBunurilor,
            activitati_agricole: ladderYear.activitatiAgricole,
            investitii: ladderYear.investitii,
            alte_surse: ladderYear.alteSurse,
          },
          neimpozabil: ladderYear.neimpozabil,
          cassRetinutLaSursa: ladderYear.cassRetinutLaSursa,
          alteSurseArt114: ladderYear.alteSurseArt114,
          cedareaSursa: ladderYear.cedareaSursa,
        },
      });
      if ('reviewRequired' in ladderRes) return rr(ladderRes.reason, lines);
      if (typeof ladderRes.determinedNet !== 'number') {
        // Defensive, and reported rather than assumed: the art. 174 alin. (7) lit. b) test compares the
        // base the ladder chose, and re-deriving it here would be a second calculation of a legal figure.
        return rr(
          'Scara de la art. 170 alin. (2)-(4) nu a raportat baza anuală de calcul aleasă; compoziția nu o ' +
            'recalculează pe cont propriu.',
          lines,
        );
      }
      cassLadderValue = ladderRes.value;
      cassLadderBase = ladderRes.determinedNet;
      cassLadderDivergence = ladderRes.readingDivergence;
      lines.push({
        label: 'CASS pe veniturile din art. 155 alin. (1) lit. c)-h) (10 %, art. 174¹ alin. (1))',
        value: cassLadderValue,
      });
    }
    const cassRes = calculatorRegistry['calc-cass'](cassRule, {
      // PG-6h-1: the CUMULATED lit. b) amount, per art. 170 alin. (1) — which names art. 68^3 expressly
      // (Legea 239/2025 art. XII pct. 19). Here the amount IS the base, floored at 6 SM by art. 174 alin.
      // (6) and capped at 72 SM. Same number as the CAS call above, a different job: threshold test there,
      // base here. That asymmetry is the law, not an accident, and it is why one shared "68^3 base"
      // variable handed to both calculators would be wrong.
      base: cumulatedNet,
      // Read by calcCass for ONE purpose — noticing that the receipt fact is missing. It switches
      // nothing off in this calculator.
      pensionerStatus,
      pensionSumsReceived: cassFacts.pensionSumsReceived,
      previousYearExceptedCategory: cassFacts.previousYearExceptedCategory,
      previousYearArt180Option: cassFacts.previousYearArt180Option,
      foreignSicknessInsuranceProved: cassFacts.foreignSicknessInsuranceProved,
      pensionSuspensionMonths: readPensionSuspension(inputs, inputs.fiscalYear)?.months,
      salaryStatus: inputs.salaryStatus,
      // PG-6d: what the art. 174 alin. (7) lit. b) test compares with 6 SM. `undefined` means the ladder
      // never ran (the person was never asked), which `calcCass` reports as an unevaluated condition
      // rather than resolving in either direction. A `lei(0)` is the opposite: the ladder ran and found
      // the cumulation below the art. 170 alin. (2) threshold, so the test fails on its merits.
      ladderBase: cassLadderBase,
      ladderReadingDivergence: cassLadderDivergence,
      // Phase 6: the amount CF art. 174 alin. (7) lit. a) compares to the 6 SM floor. With it both
      // branches compute; without it (a pre-Phase-6 payload) calcCass still refuses rather than guess.
      salaryIncomeLei: inputs.salaryIncomeLei ?? undefined,
    });
    if ('reviewRequired' in cassRes) return rr(cassRes.reason, lines);
    cassValue = cassRes.value;
    // CF art. 118 alin. (2) lit. b): only the part of CASS that art. 170 alin. (1) provides enters
    // the taxable base; calcCass reports the art. 174 alin. (6) difference as `nonDeductible`.
    cassNonDeductibila = cassRes.nonDeductible ?? lei(0);
    lines.push({ label: 'CASS (10%)', value: cassValue });
  } else {
    // B-19 — the flag short-circuit, now an honest one. This zero is NOT a rule's output: it comes
    // from a stored profile flag whose legal basis was never found (see CASS_FLAG_REVIEW_REASON).
    // The flag itself stays (deleting it would destroy user data) and the amount stays 0 lei, but the
    // line carries `reviewRequired` so no consumer can read this zero as an established exemption.
    // The label uses the code's own vocabulary: Titlul V separates „exceptat" (art. 154 alin. (1), a
    // status on a closed list) from „nu se datorează" (a conditional non-due — and art. 174 alin. (7)
    // reaches only the art. 174 alin. (6) difference, never the whole contribution). Neither „scutit"
    // nor „scutire" occurs anywhere in Titlul V, so neither may ever label a CASS result.
    lines.push({
      label:
        inputs.socialInsuranceStatus === 'exempt'
          ? 'CASS (exceptat — art. 154 alin. (1); temeiul nu a fost verificat)'
          : 'CASS (nu se datorează — temeiul nu a fost verificat)',
      value: lei(0),
      reviewRequired: true,
      reason: CASS_FLAG_REVIEW_REASON,
    });
    // Provenance travels with the result, not with the screen: the snapshot embeds these lines, so
    // an audit of a stored calculation sees the same admission the engine made at compute time.
    lines.push({ label: `PROVENANȚĂ CASS: ${CASS_FLAG_REVIEW_REASON}`, value: lei(0) });
  }

  // B-85 — the second half of the gate. With no sistem-real leg there is no art. 118 alin. (2) composition
  // to run: alin. (6) settles the art. 68^3 tax on its own net, „impozitul fiind final", and the
  // alin. (2^2)-(2^3) ratios apportion a deduction onto the SISTEM-REAL base, which this register does not
  // have. Returning here is what makes "the sistem-real leg does not run" true of the code path and not
  // merely true of the arithmetic — a reader who deletes the gate above still cannot reach a 1,7 × base,
  // because there is no place left for a second leg to be added.
  if (legs[0].method === 'accommodation-flat-ratio') {
    const total = sumBani([casRes.value, cassValue, cassLadderValue, flatTax]);
    lines.push({ label: 'Impozit art. 68^3 (10 %, impozitul fiind final)', value: flatTax });
    lines.push({ label: 'Total taxe', value: total });
    const snap = await createCalculationSnapshot({ profile, revenues: gross, expenses: deductibleBase, ruleRelease, rules: applicable, calculationLines: lines, output: { total } });
    return {
      status: 'computed',
      lines,
      output: { total },
      snapshot: snap,
      bases: contributionBases(gross, deductibleBase, net, legs, cassLadderBase),
    };
  }

  // ---- CF art. 118 alin. (2): the taxable base, composed in the order the law states it ----
  // alin. (2) lit. a): „venit net anual recalculat = venit net anual (sistem real) − pierderi fiscale
  // reportate”, PE SURSĂ, before incomes are summed. The app models one sistem-real source and has no
  // prior-year loss store (Phase 7 owns persistence), so the reported-loss term is 0 here and the
  // current-year loss is surfaced below rather than silently dropped.
  const pierderiReportate: Bani = lei(0);
  const vnaRecalculat = subBani(net, pierderiReportate);

  // alin. (2^2): CAS deductibilă = (venit net anual determinat în sistem real ÷ total venituri cumulate
  // potrivit art. 148 alin. (3)) × contribuția de asigurări sociale calculată potrivit art. 151 alin. (1).
  // alin. (2^3): CASS deductibilă = (venit net anual determinat în sistem real ÷ total venituri cumulate
  // potrivit art. 170 alin. (1)) × contribuția de asigurări sociale de sănătate calculată potrivit
  // art. 174 alin. (1).
  // While there is a single source, the cumulated denominator IS the sistem-real net, so both ratios are
  // exactly 1 and the proration is a no-op — the numbers do not move. Once a second genuine lit. b) source
  // exists the denominator is genuinely larger than the numerator, the ratios fall below 1, and the
  // sistem-real deduction is prorated instead of inherited whole. That is what art. 118 alin. (2^2)-(2^3)
  // ask for, and it is also what keeps the 68^3 tax ring-fenced: alin. (11) delimits the INCOME TAX, not
  // the contributions, so a second source enlarges the denominator without ever receiving a deduction.
  // B-85 is the reason this paragraph speaks of a second SOURCE: a `cazare` register has one source and one
  // method, and the flat ratio beside a sistem-real difference would have made the denominator 1,7 × the
  // numerator while deducting a contribution from a base that was itself double-counted.
  // Phase 10: the ratios and their products are Decimal, not float. A float ratio is exactly how the
  // fractional line values `7_128.1` and `52_002.9` got into this engine in the first place.
  const ratioCas = sistemRealContributionRatio(legs); // art. 118 alin. (2^2), denominator art. 148 alin. (3)
  const ratioCass = sistemRealContributionRatio(legs); // art. 118 alin. (2^3), denominator art. 170 alin. (1)
  const casDeductibilaDec = ratioCas.times(casRes.value);
  // B-13: the art. 174 alin. (6) difference up to the 6 SM floor is OWED but never deductible — art. 118
  // alin. (2) lit. b) deducts the contributions „datorate potrivit prevederilor titlului V” „cu
  // excepția diferenței de contribuție de asigurări sociale de sănătate prevăzută la art. 174 alin. (6)”,
  // and alin. (2^3) prorates over the contribution „calculată potrivit art. 174 alin. (1)”. Deducting
  // the whole floor overstates the deduction in the 0 < VNA < 6 SM band and understates the tax.
  const cassRaw = ratioCass.times(subBani(cassValue, cassNonDeductibila));
  // decimal.js-light has no static `Decimal.max`; and the comparison keeps the Decimal, not a float.
  const cassDeductibilaDec = cassRaw.isNegative() ? new Decimal(0) : cassRaw;
  // A deduction is NOT one of the three sums CF art. 66 alin. (1) governs, so `roundArt66` must not touch it:
  // rounding a deduction changes the taxable base, and art. 66 rounds sums due, never bases (the A-3 boundary
  // in docs/ai/phases/10_money_precision.md). With a single income source each ratio is exactly 1, so these
  // products are already whole bani. If a second source ever makes one fractional, the engine REFUSES rather
  // than inventing a rounding rule the law does not state.
  const casDeductibila = exactBani(casDeductibilaDec);
  const cassDeductibila = exactBani(cassDeductibilaDec);
  if (casDeductibila === null || cassDeductibila === null) {
    return rr(
      'Deducerile CAS/CASS prorotate (art. 118 alin. (2^2) și (2^3)) nu sunt numere întregi de bani; '
      + 'art. 66 alin. (1) rotunjește sumele datorate, nu deducerile sau bazele, deci nu se aplică nicio rotunjire aici.',
      lines,
    );
  }
  lines.push({ label: 'CAS deductibilă (art. 118 alin. (2^2))', value: casDeductibila });
  lines.push({ label: 'CASS deductibilă (art. 118 alin. (2^3), fără diferența art. 174 alin. (6))', value: cassDeductibila });

  // alin. (2^4): „Nivelul contribuției de asigurări sociale și al contribuției de asigurări sociale de
  // sănătate deductibile … nu poate depăși nivelul venitului net anual recalculat.” Without this cap a
  // low-net year could drive the base negative and hide a loss behind a negative tax.
  const deduceriCalculat = sumBani([casDeductibila, cassDeductibila]);
  const plafonDeduceri: Bani = vnaRecalculat > 0 ? vnaRecalculat : lei(0);
  const deduceriRetinute: Bani = deduceriCalculat < plafonDeduceri ? deduceriCalculat : plafonDeduceri;
  if (deduceriRetinute < deduceriCalculat) {
    lines.push({ label: 'Deduceri blocate de plafonul art. 118 alin. (2^4)', value: subBani(deduceriCalculat, deduceriRetinute) });
  }

  const taxable = subBani(vnaRecalculat, deduceriRetinute);
  lines.push({ label: 'Venit net anual impozabil (art. 118 alin. (2) lit. b))', value: taxable });

  if (taxable <= 0) {
    // B-16: a zero or negative base is a FACT, not a review item. The status stays 'computed' and the
    // total stays the contributions actually owed — but a loss year must not be reported as a plain 0.
    let lossCarryForward: FiscalLossCarryForward | undefined;
    if (vnaRecalculat < 0) {
      lines.push({ label: 'Pierdere fiscală pe sursă (art. 118 alin. (2) lit. a))', value: subBani(lei(0), vnaRecalculat) });
      lossCarryForward = {
        amount: subBani(lei(0), vnaRecalculat),
        years: 5,
        capPercent: 70,
        sameSourceOnly: true,
        rule: 'CF art. 118 alin. (4): „Pierderea fiscală anuală înregistrată pe fiecare sursă din activități independente … determinată în sistem real, se reportează și se compensează de către contribuabil în limita a 70% din veniturile nete anuale, obținute din aceeași sursă de venit în următorii 5 ani fiscali consecutivi.” Alin. (5): reportul se face cronologic pe 5 ani consecutivi, dreptul este personal și netransmisibil, iar pierderea necompensată la expirarea perioadei este pierdere definitivă.',
      };
    }
    const total = sumBani([casRes.value, cassValue, cassLadderValue, flatTax]);
    lines.push({ label: 'Impozit pe venit (fără bază impozabilă)', value: lei(0) });
    if (flatLeg !== null) {
      lines.push({ label: 'Impozit art. 68^3 (10 %, impozitul fiind final)', value: flatTax });
    }
    lines.push({ label: 'Total taxe', value: total });
    const snap = await createCalculationSnapshot({ profile, revenues: gross, expenses: deductibleBase, ruleRelease, rules: applicable, calculationLines: lines, output: { total } });
    const computed: TaxEstimateResult = {
      status: 'computed',
      lines,
      output: { total },
      snapshot: snap,
      bases: contributionBases(gross, deductibleBase, net, legs, cassLadderBase),
    };
    if (lossCarryForward) computed.lossCarryForward = lossCarryForward;
    return computed;
  }

  const incomeTaxRes = calculatorRegistry['calc-income-tax'](incomeTaxRule, { base: taxable });
  if ('reviewRequired' in incomeTaxRes) return rr(incomeTaxRes.reason, lines);
  lines.push({ label: 'Impozit pe venit (rată de bază 10%)', value: incomeTaxRes.value });
  if (flatLeg !== null) {
    // alin. (6) + alin. (11): this sum is 10 % of the 68^3 net and nothing else. It is not reduced by the
    // CAS/CASS deductions the art. 118 composition above applies to the sistem-real source, because
    // „impozitul fiind final" settles it on the net and the ring-fence runs on the tax, not the
    // contributions.
    lines.push({ label: 'Impozit art. 68^3 (10 %, impozitul fiind final)', value: flatTax });
  }
  // Art. 66 was already applied to each of the three sums, inside their calculators. Summing the rounded
  // integers is exact, and it is why no second rounding can happen anywhere downstream.
  const total = sumBani([casRes.value, cassValue, cassLadderValue, incomeTaxRes.value, flatTax]);
  lines.push({ label: 'Total taxe', value: total });
  const snap = await createCalculationSnapshot({ profile, revenues: gross, expenses: deductibleBase, ruleRelease, rules: applicable, calculationLines: lines, output: { total } });
  return {
    status: 'computed',
    lines,
    output: { total },
    snapshot: snap,
    bases: contributionBases(gross, deductibleBase, net, legs, cassLadderBase),
  };
}

/**
 * The `bases` block, built in one place so the return paths cannot report different quantities.
 *
 * `venitulNetCumulatPentruContributii` is written only when a second lit. b) SOURCE was actually in play.
 * Writing it always would put two numbers on screen for one quantity whenever there is only one source —
 * and a consumer that reads the wrong one of two always-present fields is a defect waiting to be picked.
 * B-85 is why the test is `legs.length > 1` and not "a flat ratio was supplied": one register is one leg,
 * whichever method determined it.
 */
function contributionBases(
  venitulBrut: Bani,
  cheltuieliDeductibile: Bani,
  venitulNetDinActivitate: Bani,
  legs: readonly ContributionLeg[],
  cassLadderBase?: Bani,
): TaxAmountBases {
  const bases: TaxAmountBases = { venitulBrut, cheltuieliDeductibile, venitulNetDinActivitate };
  if (legs.length > 1) bases.venitulNetCumulatPentruContributii = cumulateContributionBase(legs);
  if (cassLadderBase !== undefined) bases.bazaDeCalculCassArt155LitCH = cassLadderBase;
  return bases;
}
