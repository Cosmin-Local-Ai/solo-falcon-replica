/**
 * PFA 2026 deterministic tax calculation engine (Step 15).
 * Consumes TaxInputsReference (derived.ts) + active rule release.
 * Domain purity: no React, DOM, localStorage, or store imports.
 */
import type { PfaProfile } from './models';
import { cassLadderForYear } from './models';
import type { FiscalRule, RuleRelease } from './fiscal/rules';
import type { DepreciationLeg } from './estimateBasis';
import type { TaxInputsReference } from './derived';
import type { CalculationLine, CalculationOutput, TaxCalculationSnapshot } from './snapshots/types';
import { selectApplicableRules } from './fiscal/select';
import { calculatorRegistry } from './fiscal/calculators';
import { readCassExceptionFacts, readPensionSuspension, readPensionerStatus } from './pensionFacts';
import { regimeRefusalReason } from './regimes';
// PG-6f (B-30) — the base selection is the defect this phase owns, and the vocabulary it selects on
// lives in `fiscal/vat.ts`. Importing the predicate rather than re-spelling the six states is what keeps
// the engine and the Settings screen from disagreeing about which states charge TVA.
import {
  TITLUL_II_VAT_ORDERING_RULE,
  registrationChargesVat,
  type ExpenseBaseWithVat,
} from './fiscal/vat';
import { formatBani } from './money';
import { createCalculationSnapshot } from './snapshots/snapshot';
import Decimal from 'decimal.js-light';
import { addBani, lei, leiText, subBani, sumBani, type Bani } from './money';

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
   * PG-6f (B-30, D-VAT-2) — the expense base the **per-line** input-VAT decision produced, in its two
   * candidate forms, replacing the `vatExempt ? expenses : expensesNet` selection.
   *
   * `netFirst` measures a half-count rule on the VAT-exclusive amount; `grossFirst` measures it over the
   * amount including the VAT the taxpayer could not claim back. For a company the second is explicit —
   * Titlul II norm pct. 16 alin. (3), with a worked example (2.000 + 240 = 2.240 → 1.120). **For a PFA no
   * such rule exists**: `research/35` §1.5 swept the Titlul IV Norme, and `research/42` §10 gap 2 swept
   * 463.145 characters of Titlul VII law and found `nedeductibil` 0 and `cheltuial` 0. So when the two
   * differ the engine computes **neither** and reports `review_required` with both numbers; when they are
   * equal the choice cannot change the figure and the engine runs on it.
   *
   * Required, and that is the enforcement: a call site cannot reach the engine without having run the
   * per-line decision, exactly as `EstimateAmounts.asOfDate` makes a projected operand unrepresentable.
   * There is deliberately no fallback to the retired boolean.
   */
  expenseBase: ExpenseBaseWithVat;
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
   * B-88 — WHICH flat-ratio article that gross is a gross of.
   *
   * The number cannot say it: art. 68^3 alin. (2) and art. 85 alin. (2) both take 30 % of a gross, and the
   * two articles then send the net to different contribution basins (art. 155 alin. (1) lit. b) measured
   * under art. 170 alin. (1), versus lit. e) feeding the cumul at art. 170 alin. (4) lit. c) where the base
   * is the rung). The assembler decided which one applies, from facts the person declared; the engine reads
   * that decision rather than making its own. Absent means a call site that predates B-88 — a hand-built
   * fixture or a stored snapshot — and for those the only flat method that has ever existed is art. 68^3.
   */
  flatRatioMethod?: IncomeDeterminationMethodTag | null;
  /**
   * B-105 — whether art. 84^1 alin. (8) has switched the withholding off for this register.
   *
   * Where the gross is paid **exclusively in kind**, or a **contractual guarantee is applied to the rent**,
   * the payer does not withhold: the owner determines the net, computes the tax and files the Declarația
   * Unică up to the art. 122 alin. (3) term. The arithmetic is unchanged; what changes is whose sum the tax
   * is. The engine reads this rather than re-reading the profile's lease facts, for the same reason it reads
   * `flatRatioMethod` rather than re-deriving the article.
   */
  flatRatioWithholdingBlocked?: boolean;
  /**
   * TASK 6: the release the calculation is bound to, or `null` when this build registers none for the
   * profile's fiscal year. `null` makes the engine refuse instead of writing a snapshot that names no law
   * — the old behaviour was to hand in the 2026 release whatever the year said, which is how a call site
   * could silently re-bind a calculation to rules from a year it was not asking about.
   */
  ruleRelease: RuleRelease | null;
  rules: FiscalRule[];
  /**
   * B-109 — the asset leg the assembler struck for this calculation, threaded and not re-read: the same
   * discipline as `expenseBase`, `flatRatioMethod` and `flatRatioWithholdingBlocked`. The engine does not
   * consult the register; it hands the leg to the snapshot, which content-addresses it as
   * `assetRegisterHash` beside `inputsHash`.
   *
   * Optional, and that is a deliberate difference from `expenseBase`: the leg changes no arithmetic here, so
   * a call site that predates B-109 still computes the same number it always did. What it cannot do is
   * pretend the register was addressed — with no leg supplied the snapshot records `assetRegisterHash: null`,
   * which says out loud that this number's register was never addressed. Both production call sites
   * (`data/derived.ts`, `data/dashboard.ts`) pass the leg the assembler produced.
   */
  depreciation?: DepreciationLeg | null;
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
export type IncomeDeterminationMethodTag =
  | 'sistem-real'
  | 'accommodation-flat-ratio'
  | 'short-term-rooms-art85'
  // B-105 — the two ordinary *cedarea folosinței bunurilor* regimes. The tag mirrors
  // `estimateBasis.ts IncomeDeterminationMethod` because the engine reads the assembler's decision and is
  // never entitled to re-derive it; adding a method there without adding it here is a compile error, which
  // is the point.
  | 'cedare-art84'
  | 'cedare-art84x1';

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
 * B-112 STAGE 2 — the CAS cumulation of CF art. 148 alin. (3), which is a WIDER set than the CASS one.
 *
 * The two ceiling tests have looked identical in this build until now, and they are not the same test:
 *
 * - **CASS, art. 170 alin. (1)** cumulates art. 155 alin. (1) **lit. b)** sources only. That is
 *   `cumulateContributionBase(legs)`, and it does not change here.
 * - **CAS, art. 148 alin. (3)** cumulates *„veniturile nete … din activități independente determinate
 *   potrivit **art. 68, 68³ și 69**, a venitului brut realizat în baza contractelor de activitate sportivă
 *   potrivit **art. 68¹**, precum și a **veniturilor nete din drepturi de proprietate intelectuală
 *   determinate potrivit art. 72, art. 72¹ și art. 73**”*. DPI is art. 137 alin. (1) **lit. b¹)**, and it
 *   belongs in this one and not in the other.
 *
 * That single missing litera is defect B-112 in its arithmetic half. ANAF DGRFP București's Exemplul 3
 * cumulates 68.000 lei AI + 50.000 lei DPI = 118.000 lei, which clears 24 SMN (97.200 lei) and gives CAS
 * 24.300 lei; the engine saw 68.000 lei, selected the 12-SMN tier, and produced 12.150 lei. The tier
 * function was right throughout — 12.150 = 25 % × 48.600 is the correct CAS for 68.000 alone. What was
 * missing was an input.
 *
 * **Why the DPI amount is a parameter and not another `ContributionLeg`.** A leg is one *register* under
 * one determination method, and `IncomeDeterminationMethodTag` is the tag for that. DPI is not a register
 * and has no determination method in that sense — it has a quota (art. 72 alin. (2)) or an election
 * (art. 73). Adding a fake method tag would put art. 70 income into the leg list, and the leg list is what
 * `computeTaxEstimate`'s method gate counts to keep B-85's one-method-per-register invariant true. Keeping
 * DPI outside it means the gate keeps meaning what it says.
 *
 * **Sign.** Same rule as `cumulateContributionBase`: with a DPI amount present there are at least two
 * sources, so a negative art. 68 net is floored at zero rather than carried. That is also what ANAF's own
 * worked example shows — Exemplul 3 states a *„Pierdere fiscală reportată = 20.000”* and still cumulates
 * the full 118.000 lei, because art. 148 alin. (3) cumulates the net incomes realised in the year, not the
 * art. 118 losses carried into it.
 *
 * **What this does NOT decide, and says so rather than guessing.** CF art. 150 alin. (2) exempts salaried
 * persons from CAS *for art. 137 alin. (1) lit. b¹) income only*. Whether that exemption removes the DPI
 * amount from the art. 148 alin. (3) ceiling test, or only from the contribution the payer withholds, is
 * not resolved by the text: alin. (3) speaks of the ceiling test and names DPI without carve-out, while
 * alin. (2) speaks of the contribution. This function always cumulates, which is the literal reading of
 * alin. (3); the exemption bites at the withholding step (art. 151 alin. (5), Stage 4). Recorded as an
 * inference, not a fact, and `tax.dpiCas.test.ts` pins the reading so a later change is a decision.
 */
export function casCumulationBase(legs: readonly ContributionLeg[], dpiNet: Bani | null): Bani {
  const independent = cumulateContributionBase(legs);
  if (dpiNet === null) return independent;
  const independentPart = legs.length === 0 ? lei(0) : independent > 0 ? independent : lei(0);
  return addBani(independentPart, dpiNet > 0 ? dpiNet : lei(0));
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
export function sistemRealContributionRatio(
  legs: readonly ContributionLeg[],
  // B-112 stage 2 — the denominator is now passed in, because the two ratios the law states have two
  // different denominators once DPI exists in the build: art. 118 alin. (2^2) divides by the art. 148
  // alin. (3) cumulation (lit. b) **and** b^1)) and alin. (2^3) divides by the art. 170 alin. (1) one
  // (lit. b) only). They were the same quantity while the app held no DPI income; passing it keeps the two
  // call sites honest about which one each ratio answers.
  denominator: Bani,
): Decimal {
  const sistemReal = legs.find((leg) => leg.method === 'sistem-real');
  if (sistemReal === undefined) return new Decimal(1);
  if (denominator > 0) return new Decimal(sistemReal.net > 0 ? sistemReal.net : lei(0)).div(denominator);
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
 * Bani held as a Decimal → the lei text a refusal sentence shows. B-118 uses it for the two candidate
 * readings of the art. 118 alin. (2²) proration, which are Decimals that have already been reduced to a
 * whole ban for display. It is deliberately a *display* helper: it returns a string, never a `Bani`, so it
 * cannot become a rounding path by accident the way a `Decimal → Bani` conversion would.
 */
function leiFromDecimal(bani: Decimal): string {
  return leiText(bani.toNumber() as Bani);
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
  const { inputs, profile, revenues, expenses, revenuesNet, expensesNet, expenseBase, flatRatioGross, flatRatioMethod, flatRatioWithholdingBlocked, ruleRelease, rules, depreciation } = input;
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
  // B-88: the art. 85 rule for 1–7 rooms let pe termen scurt. A FIFTH regime string, and the reason it is
  // not a reuse of the one above is the whole point of this block: the two articles share a percentage and
  // share nothing else, and a single lookup would resolve whichever ruleId sorts first.
  const shortTermRoomsRule = applicable.find((r) => r.taxRegime === 'short-term-rooms-flat-ratio');
  // B-105: the two ordinary *cedarea folosinței* rules. Two more regime strings, for the same reason as the
  // one above — the three articles share a rate and share nothing else, and one lookup would resolve
  // whichever ruleId sorts first. art. 84 alin. (3) and art. 84^1 alin. (3) both say 20 %; art. 85 alin. (2)
  // says 30 %; all three are taxed at 10 %, but art. 84's rate sits at art. 123 alin. (2) and is NOT final,
  // while art. 84^1's is withheld by the payer and IS final (alin. (5)-(6)).
  const cedareArt84Rule = applicable.find((r) => r.taxRegime === 'cedare-art84-flat-ratio');
  const cedareArt84x1Rule = applicable.find((r) => r.taxRegime === 'cedare-art84x1-withheld');
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
  // ── PG-6f (B-30): the money measure is a registration fact, not an „exempt" flag ─────────
  //
  // These two lines were the defect. `vatExempt ? revenues : revenuesNet` and its mirror settled, for a
  // whole register at once, both whether the person charges TVA and whether every leu of input VAT was
  // recoverable. The first is a question about the tax office's register (art. 310 vs art. 316); the
  // second is decided line by line by art. 297 alin. (7), art. 298 alin. (1), art. 300 alin. (4) and
  // art. 11 alin. (7)-(9). One boolean answered both, wrongly, in both directions.
  //
  // An unanswered registration refuses. Guessing it would move the measure of every record in the
  // register, which is the same class of invented legal fact this project refuses elsewhere.
  if (inputs.vatRegistration === null) {
    return rr(
      'Starea de înregistrare în scopuri de TVA nu este declarată în profil. Fără ea aplicația nu poate alege '
        + 'măsura banilor pe care o calculează: un PFA în scutirea art. 310 păstrează TVA-ul în venit și nu are '
        + 'niciun drept de deducere (art. 310 alin. (10) lit. a)), iar unul înregistrat conform art. 316 scoate '
        + 'TVA colectată din venit și deduce potrivit art. 297 și urm. Aplicația nu alege între ele.',
      lines,
    );
  }
  // Area 6: VAT is not taxable income. The revenue measure follows from whether this person charges TVA at
  // all. These are the sistem-real operands only; the flat gross already carries the same rule, applied
  // per receipt by `estimateBasis.ts flatRatioGrossFromYtd`.
  const sistemRealGross = registrationChargesVat(inputs.vatRegistration.status) ? revenuesNet : revenues;

  // D-VAT-2 — where a half-count rule met VAT the taxpayer could not claim back, the ordering changes the
  // figure and no PFA rule settles which ordering applies. Compute neither; show both, and quote the only
  // text that exists while saying plainly that it is a corporate-tax rule and not a Titlul IV one.
  if (expenseBase.divergent) {
    lines.push({ label: 'Cheltuieli deductibile — jumătate din baza fără TVA', value: expenseBase.netFirst });
    lines.push({ label: 'Cheltuieli deductibile — jumătate din baza cu TVA nedeductibilă', value: expenseBase.grossFirst });
    return rr(
      `Regula de limitare la jumătate întâlnește TVA pe care contribuabilul nu o poate recupera, iar cele două `
        + 'ordini posibile dau cifre diferite: ' + formatBani(expenseBase.netFirst) + ' lei față de '
        + formatBani(expenseBase.grossFirst) + ' lei. Pentru impozitul pe profit ordinea este explicită — '
        + TITLUL_II_VAT_ORDERING_RULE.quote + ' ' + TITLUL_II_VAT_ORDERING_RULE.scope
        + ' Nicio regulă echivalentă nu există pentru un PFA, deci aplicația nu calculează niciuna dintre ele.',
      lines,
    );
  }
  // The choice cannot change this figure — no line is both half-count-limited and carrying non-recoverable
  // VAT — so the engine runs on the single number the per-line decision produced.
  const sistemRealExpenseBase = expenseBase.netFirst;

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
  // B-88 — the art. 85 leg. Same shape, separate rule, separate calculator, separate citations.
  let roomsLeg: FlatRatioLeg | null = null;
  // B-105 — the ordinary *cedarea folosinței* leg. One leg, whichever of the two regimes the tenant fact
  // selected, because only one method ever runs for one register.
  let cedareLeg: FlatRatioLeg | null = null;
  // True when the tax on this leg is the PAYER'S to withhold, not the owner's to pay: art. 84^1 alin. (5)-(6)
  // with alin. (8) not triggered. It decides whether the sum enters the total the owner owes.
  let cedareWithheldAtSource = false;
  if (typeof flatRatioGross === 'number') {
    // Which article this gross belongs to is read off the operand, never re-derived here: the assembler
    // decided it once from the declared room count and the declared answer to the art. 85 alin. (1)
    // exclusion. Absent means a call site that predates B-88, and for those art. 68^3 is the only flat
    // method that has ever existed — the default is stated, not implied by a fallthrough.
    const flatMethod: IncomeDeterminationMethodTag =
      flatRatioMethod === 'short-term-rooms-art85' ||
      flatRatioMethod === 'cedare-art84' ||
      flatRatioMethod === 'cedare-art84x1'
        ? flatRatioMethod
        : 'accommodation-flat-ratio';
    if (flatMethod === 'cedare-art84' || flatMethod === 'cedare-art84x1') {
      const rule = flatMethod === 'cedare-art84' ? cedareArt84Rule : cedareArt84x1Rule;
      if (!rule) {
        return rr(
          flatMethod === 'cedare-art84'
            ? `Regula de stabilire a venitului din cedarea folosinței bunurilor (art. 84) nu a fost găsită pentru ` +
              `anul fiscal ${inputs.fiscalYear}; un venit brut din art. 84 nu poate fi calculat după regulile unui alt an.`
            : 'Regula de stabilire a impozului pentru cedarea folosinței bunurilor plătite de persoane juridice ' +
              `(art. 84^1) nu a fost găsită pentru anul fiscal ${inputs.fiscalYear}; un venit brut din art. 84^1 nu ` +
              'poate fi calculat după regulile unui alt an.',
          lines,
        );
      }
      const cedareRes = calculatorRegistry[
        flatMethod === 'cedare-art84' ? 'calc-cedare-art84-flat-ratio' : 'calc-cedare-art84x1-withheld'
      ](rule, { gross: flatRatioGross });
      if ('reviewRequired' in cedareRes) return rr(cedareRes.reason, lines);
      if (typeof cedareRes.determinedNet !== 'number') {
        return rr(
          `Regula ${flatMethod === 'cedare-art84' ? 'art. 84' : 'art. 84^1'} nu a raportat venitul net determinat; `
            + 'compoziția nu îl recalculează pe cont propriu.',
          lines,
        );
      }
      cedareLeg = { gross: flatRatioGross, net: cedareRes.determinedNet, tax: cedareRes.value };
      // art. 84^1 alin. (5)-(6) makes the payer the one who calculates, withholds, declares and remits the
      // tax, and alin. (8) is the exception that puts all of it back on the owner. The assembler read the two
      // declared facts; this only honours the answer.
      cedareWithheldAtSource = flatMethod === 'cedare-art84x1' && flatRatioWithholdingBlocked !== true;
    } else if (flatMethod === 'short-term-rooms-art85') {
      if (!shortTermRoomsRule) {
        return rr(
          `Regula de stabilire a venitului din închirierea pe termen scurt a 1–7 camere în locuință proprietate ` +
            `personală (art. 85) nu a fost găsită pentru anul fiscal ${inputs.fiscalYear}; un venit brut din ` +
            'art. 85 nu poate fi calculat după regulile unui alt an.',
          lines,
        );
      }
      const roomsRes = calculatorRegistry['calc-short-term-rooms-flat-ratio'](shortTermRoomsRule, {
        gross: flatRatioGross,
      });
      if ('reviewRequired' in roomsRes) return rr(roomsRes.reason, lines);
      if (typeof roomsRes.determinedNet !== 'number') {
        return rr(
          'Regula art. 85 nu a raportat venitul net determinat; compoziția nu îl recalculează pe cont propriu.',
          lines,
        );
      }
      roomsLeg = { gross: flatRatioGross, net: roomsRes.determinedNet, tax: roomsRes.value };
    } else {
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
  }
  // One label for the ring-fenced tax, so the three return paths below cannot print the wrong article.
  const flatTaxLabel =
    cedareLeg !== null
      ? cedareWithheldAtSource
        ? 'Impozit reținut la sursă de plătitor (art. 84^1 alin. (5)-(6), 10 %, impozit final — nu se achită de contribuabil)'
        : 'Impozit art. 84^1 alin. (8) (10 %, stabilit de contribuabil pentru că reținerea nu se aplică)'
      : roomsLeg !== null
        ? 'Impozit art. 85 (10 %, impozitul fiind final)'
        : 'Impozit art. 68^3 (10 %, impozitul fiind final)';
  // The label art. 84's own tax carries — it is NOT „final”, and that is the difference from the other three.
  const cedareArt84TaxLabel = 'Impozit art. 84 (10 % din venitul net, art. 123 alin. (2), stabilit de contribuabil)';

  // THE GATE. One leg per source, and the operand the assembler supplied decides which one this register
  // is. `flatRatioGross` is attached by `estimateBasis.ts withFlatRatioGross` only when
  // `selectIncomeDeterminationMethod` answered a flat-ratio method, so its presence IS the method
  // decision — read here, not re-derived. When it is present the sistem-real operands do not become a leg:
  // they are the same receipts seen twice, and adding them would be the 1,7 × again.
  //
  // B-88 added a THIRD possibility, and it is the one that had to be thought about rather than copied.
  // An art. 85 register supplies **no lit. b) leg at all**. art. 155 alin. (1) puts *cedarea folosinței
  // bunurilor* at lit. e), not lit. b), so the art. 85 net never joins the cumulated amount that art. 148
  // alin. (3) and art. 170 alin. (1) measure — it goes to the art. 170 alin. (4) cumul instead, below.
  // Putting it in the leg list beside the sistem-real difference would have been the 1,7 × in a new
  // costume; putting it in the leg list alone would have made it a lit. b) source, which is the same
  // mistake under a different sign. The list is empty for this method, and that is a statement about the
  // law, not an omission: CAS is not owed on rent income, and art. 170 alin. (1) does not reach it.
  const legs: ContributionLeg[] =
    roomsLeg !== null || cedareLeg !== null
      ? []
      : flatLeg !== null
        ? [{ method: 'accommodation-flat-ratio', net: flatLeg.net }]
        : [{ method: 'sistem-real', net: subBani(sistemRealGross, sistemRealExpenseBase) }];
  // True whenever a flat-ratio method ran, whichever article supplied it. The art. 118 alin. (2) composition
  // below must not run for any of them, and `legs[0].method` cannot express that for art. 85 or for the two
  // cedare regimes — there is no leg to read.
  const flatMethodRan = roomsLeg !== null || flatLeg !== null || cedareLeg !== null;

  // The three quantities every consumer reads, stated once per method so `gross - deductibleBase === net`
  // holds on either branch and no surface has to know which method ran in order to read them. For a flat
  // method the expense here is the deemed ratio, not a recorded cost: art. 68^3 alin. (2) and art. 85
  // alin. (2) each replace the register's expenses with it, which is precisely why the sistem-real expense
  // leg is not run beside either.
  const net = roomsLeg?.net ?? flatLeg?.net ?? cedareLeg?.net ?? subBani(sistemRealGross, sistemRealExpenseBase);
  const gross = roomsLeg?.gross ?? flatLeg?.gross ?? cedareLeg?.gross ?? sistemRealGross;
  const deductibleBase =
    roomsLeg !== null
      ? subBani(roomsLeg.gross, roomsLeg.net)
      : flatLeg !== null
        ? subBani(flatLeg.gross, flatLeg.net)
        : cedareLeg !== null
          ? subBani(cedareLeg.gross, cedareLeg.net)
          : sistemRealExpenseBase;
  const flatTax: Bani = roomsLeg?.tax ?? flatLeg?.tax ?? cedareLeg?.tax ?? lei(0);
  // B-105 — the part of that tax the OWNER owes. art. 84^1 alin. (4)-(6) puts the calculation, the withholding,
  // the declaration and the remittance of a FINAL 10 % on the plătitor de venit, so for a withheld-at-source
  // register the sum is reported (it is the owner's income tax, withheld from their rent, and they are
  // entitled to the alin. (4) certificate proving it) but it is NOT added to what the owner must pay. Adding
  // it would tell a landlord to pay twice the same leu. alin. (8) — rent paid exclusively in kind, or a
  // guarantee applied to the rent — switches the withholding off, and then the same sum is the owner's.
  const withheldAtSourceTax: Bani = cedareWithheldAtSource ? cedareLeg?.tax ?? lei(0) : lei(0);
  const taxDueByOwner: Bani = subBani(flatTax, withheldAtSourceTax);

  if (flatLeg === null && roomsLeg === null && cedareLeg === null) {
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
  } else if (roomsLeg !== null) {
    lines.push({ label: 'Venit brut art. 85 (încasări în cursul anului fiscal)', value: gross });
    lines.push({ label: 'Cheltuieli forfetare 30 % (art. 85 alin. (2))', value: deductibleBase });
    lines.push({ label: 'Venit net art. 85', value: net });
  } else if (cedareLeg !== null) {
    // The label says which measure the gross is, because the three rent regimes measure it differently and
    // the figure beside the label is not interchangeable between them.
    lines.push({
      label:
        flatRatioMethod === 'cedare-art84'
          ? 'Venit brut art. 84 (chiria prevăzută în contract pentru anul fiscal, indiferent de încasare)'
          : 'Venit brut art. 84^1 (sumele plătite de chiriaș în anul fiscal)',
      value: gross,
    });
    lines.push({ label: 'Cheltuieli forfetare 20 % (art. 84 alin. (3) / art. 84^1 alin. (3))', value: deductibleBase });
    lines.push({
      label: flatRatioMethod === 'cedare-art84' ? 'Venit net art. 84' : 'Venit net art. 84^1',
      value: net,
    });
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

  // art. 148 alin. (3) (CAS) and art. 170 alin. (1) (CASS) both measure the contributions on a CUMULATED
  // amount, but they cumulate DIFFERENT sets — see `cumulateContributionBase` and `casCumulationBase`.
  // CASS cumulates art. 155 alin. (1) lit. b) sources. CAS cumulates those **plus** the net income from
  // drepturi de proprietate intelectuală determined under art. 72 / 72¹ / 73, because art. 137 alin. (1)
  // lit. b¹) is inside the art. 148 alin. (3) ceiling test and outside the art. 170 alin. (1) one.
  // With one source and no DPI the two are the same number, sign included; the cumulation only becomes a
  // sum when a second genuine source exists, and B-85 is the reason one register never supplies two.
  const cumulatedNet = cumulateContributionBase(legs);
  // B-112 STAGE 2 — the art. 137 alin. (1) lit. b¹) amount. Read, not derived: `CassLadderYear`'s
  // `proprietateIntelectuala` is documented as „lit. c) venitul net after the art. 72 / 72¹ forfetar, or
  // net per art. 73”, which is the same quantity art. 148 alin. (3) asks for, so one stored figure answers
  // both the CASS ladder (art. 170 alin. (4) lit. c)) and the CAS ceiling test (art. 148 alin. (3)) —
  // legitimately, because those are two different tests over one amount, not one test counted twice.
  //
  // The B-116 hazard is the other direction: if a recorded DPI document ALSO reached this cumul, the same
  // income would enter twice and select a higher tier. It cannot, and that is structural rather than a
  // check added here — `estimateBasis.ts selectEstimateOperands` scopes recorded DPI receipts out of the
  // engine's record set entirely, so the ladder amount is the only DPI quantity the engine can see. Pinned
  // in `tax.dpiCas.test.ts`, because a future stage that routes recorded DPI into the engine has to come
  // and break that test on purpose.
  const dpiNet = cassLadderForYear(inputs.cassLadderYears, inputs.fiscalYear)?.proprietateIntelectuala ?? null;
  const casCumulatedNet = casCumulationBase(legs, dpiNet);
  // Two lines, because they are now two quantities. They are only printed when they differ from the net
  // the block above already shows, so a single-source year still says nothing it has no figure for.
  if (legs.length > 1 || casCumulatedNet !== cumulatedNet) {
    lines.push({
      label: 'Venit cumulat pentru CAS (art. 148 alin. (3): art. 68, 68³, 69, 68¹ și art. 72/72¹/73)',
      value: casCumulatedNet,
    });
  }
  if (legs.length > 1 || casCumulatedNet !== cumulatedNet) {
    lines.push({ label: 'Venit cumulat pentru CASS (art. 170 alin. (1))', value: cumulatedNet });
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
    // PG-6h-1: the CUMULATED amount, per art. 148 alin. (3). With one source and no DPI this is exactly the
    // value this call always received. It is an amount that SELECTS the statutory tier — `calcCas` never
    // makes it the base, which is what art. 148 alin. (2) forbids.
    //
    // B-112 STAGE 2: this is where the defect lived. The set art. 148 alin. (3) cumulates includes art.
    // 137 alin. (1) lit. b¹) — DPI — and the engine only ever had the lit. b) legs, so ANAF's Exemplul 3
    // (68.000 lei AI + 50.000 lei DPI = 118.000 lei, over 24 SMN, CAS 24.300 lei) came out at 12.150 lei.
    // The tier function is untouched: 12.150 lei is the correct CAS for 68.000 lei alone. The fix is the
    // input, not the arithmetic.
    base: casCumulatedNet,
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
    // B-88 — the art. 85 net is a lit. e) amount this app COMPUTED, and art. 170 alin. (4) lit. c) names it
    // by article: „venitul net pentru veniturile din cedarea folosinței bunurilor, stabilite potrivit
    // art. 84-85”. So the ladder runs when either the person declared the six amounts or the engine holds
    // one of them, and the rung it chooses is the base (art. 170 alin. (3)) — never the net itself.
    //
    // Two things this deliberately does not do. It does not merge the two CASS basins: the art. 85 net goes
    // to the ladder and never to the art. 170 alin. (1) base, and the PFA's own net never enters the
    // 6/12/24 test — a person with both has two parallel computations, which is what acceptance of this
    // task exists to keep true. And it does not silently overwrite a declared amount: if the person typed a
    // cedarea folosinței figure for this year and the engine computed a different one, two producers are
    // claiming one figure, and the engine reports that rather than picking a winner.
    const computedCedareNet = roomsLeg?.net ?? cedareLeg?.net;
    if (ladderYear !== undefined || computedCedareNet !== undefined) {
      const declaredCedare = ladderYear?.cedareaFolosinteiBunurilor;
      if (computedCedareNet !== undefined && declaredCedare !== undefined && declaredCedare !== computedCedareNet) {
        return rr(
          `Venitul net din cedarea folosinței bunurilor pentru ${inputs.fiscalYear} are doi producători care nu ` +
            `cad de acord: persoana a declarat ${leiText(declaredCedare)} lei, iar regula ` +
            // The message names the rule that actually produced the figure. Saying „regula art. 85” about a net
            // the art. 84 or art. 84^1 rule determined would send the person to the wrong article to fix it.
            (flatRatioMethod === 'cedare-art84'
              ? 'art. 84'
              : flatRatioMethod === 'cedare-art84x1'
                ? 'art. 84^1'
                : 'art. 85') +
            ` a determinat ${leiText(computedCedareNet)} lei din registrul de venituri. Scara de la art. 170 ` +
            'alin. (2)-(4) cumulează o singură sumă per categorie, deci aplicația nu alege între ele.',
          lines,
        );
      }
      const ladderRes = calculatorRegistry['calc-cass-ladder'](cassRule, {
        cassLadder: {
          amounts: {
            proprietate_intelectuala: ladderYear?.proprietateIntelectuala,
            asociere_persoana_juridica: ladderYear?.asocierePersoanaJuridica,
            cedarea_folosintei_bunurilor: computedCedareNet ?? declaredCedare,
            activitati_agricole: ladderYear?.activitatiAgricole,
            investitii: ladderYear?.investitii,
            alte_surse: ladderYear?.alteSurse,
          },
          neimpozabil: ladderYear?.neimpozabil,
          cassRetinutLaSursa: ladderYear?.cassRetinutLaSursa,
          alteSurseArt114: ladderYear?.alteSurseArt114,
          // Read as declared, never inferred. The gate inside `calcCassLadder` refuses a cedarea amount
          // declared as the PFA's own activity (art. 83 alin. (1)), and an art. 85 register that carried
          // that answer is exactly the contradiction the gate is for — the app does not repair it by
          // overwriting the person's declaration with the opposite one.
          cedareaSursa: ladderYear?.cedareaSursa,
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
      // B-118: the rung the ladder selected is printed beside the contribution it produced. It used to live
      // only in `bases`, which the `computed` branch alone carries — so a year that later refused on the
      // art. 118 proration lost the one figure that shows the ladder ran correctly, and a refusal that
      // carries no numbers reads as a broken calculation rather than as an undecided rule.
      lines.push({
        label: 'Baza de calcul CASS art. 155 alin. (1) lit. c)-h) (scara art. 170 alin. (2)-(4))',
        value: cassLadderBase,
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
  // to run: alin. (6) of each flat article settles the tax on its own net, „impozitul fiind final", and the
  // alin. (2^2)-(2^3) ratios apportion a deduction onto the SISTEM-REAL base, which this register does not
  // have. Returning here is what makes "the sistem-real leg does not run" true of the code path and not
  // merely true of the arithmetic — a reader who deletes the gate above still cannot reach a 1,7 × base,
  // because there is no place left for a second leg to be added.
  //
  // B-88 widened the test from `legs[0].method` to "a flat-ratio method ran", because an art. 85 register
  // has no leg to read: its net is art. 155 alin. (1) lit. e), not lit. b), so it never enters the leg list
  // at all. The guard is on the method, not on the presence of a leg — which is the difference between
  // guarding the arithmetic and guarding the code path.
  if (flatMethodRan) {
    const total = sumBani([casRes.value, cassValue, cassLadderValue, taxDueByOwner]);
    lines.push({
      label:
        cedareLeg !== null && flatRatioMethod === 'cedare-art84'
          ? cedareArt84TaxLabel
          : flatTaxLabel,
      value: flatTax,
    });
    if (withheldAtSourceTax > 0) {
      // Reported, not charged. The owner sees what was taken out of their rent and knows the sum is not
      // theirs to pay again; art. 84^1 alin. (4) last sentence gives them the right to ask the payer for the
      // document that proves it.
      lines.push({
        label:
          'Din care: reținut și virat de plătitorul de venit (art. 84^1 alin. (4)-(6)) — nu se achită de contribuabil; la cerere, plătitorul emite documentul care atestă impozitul reținut și virat',
        value: withheldAtSourceTax,
      });
    }
    lines.push({ label: 'Total taxe', value: total });
    const snap = await createCalculationSnapshot({ profile, revenues: gross, expenses: deductibleBase, ruleRelease, rules: applicable, depreciation: depreciation ?? null, calculationLines: lines, output: { total } });
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
  const ratioCas = sistemRealContributionRatio(legs, casCumulatedNet); // art. 118 alin. (2^2), denominator art. 148 alin. (3)
  const ratioCass = sistemRealContributionRatio(legs, cumulatedNet); // art. 118 alin. (2^3), denominator art. 170 alin. (1)
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
    // B-118 — the refusal names its cause, and it names it because a bare „nu putem calcula” tells the
    // person the app is broken when in fact the app is refusing to guess. The precedent is B-93's
    // `depreciation_conflict`: two routes to one fiscal quantity, both defensible, no authority saying
    // which, and the app states the conflict instead of picking one silently.
    //
    // What is undecided is NOT whether to round. It is **at what precision the ponderea of art. 118 alin.
    // (2^2) is carried**, and the two readings give different money:
    //
    //   A. round the product to the nearest ban            — exact ratio, rounded result
    //   B. round the ratio first (to 0,1 %), then multiply  — what ANAF's own worked example appears to do
    //
    // On ANAF DGRFP București's Exemplul 3 (ratio 68.000 ÷ 118.000 over a CAS of 24.300 lei) A gives
    // 14.003 lei and B gives 13.997 lei — **6 lei apart, inferred from a single example.** Adopting either
    // here would bake one worked case into a rule, which is the exact thing `exactBani` exists to prevent.
    // So both candidates are computed and shown, and neither is used.
    const ratioPct = ratioCas.times(100);
    const produsRotunjit = casDeductibilaDec.toDecimalPlaces(0);
    const pondereRotunjita = ratioCas.toDecimalPlaces(3).times(casRes.value).toDecimalPlaces(0);
    const diferenta = produsRotunjit.minus(pondereRotunjita).abs();
    return rr(
      'Nu putem stabili partea din contribuția de asigurări sociale care se deduce din impozit '
      + '(art. 118 alin. (2²)). '
      + `Ponderea venitului net anual în sistem real în veniturile cumulate potrivit art. 148 alin. (3) este `
      + `${ratioPct.toFixed(4)} %, iar Codul fiscal nu spune cu ce precizie se păstrează acea pondere. `
      + 'Cele două lecturi posibile dau sume diferite: rotunjind produsul la banul cel mai apropiat rezultă '
      + `${leiFromDecimal(produsRotunjit)} lei, iar rotunjind întâi ponderea la 0,1 % rezultă ${leiFromDecimal(pondereRotunjita)} lei — `
      + `${leiFromDecimal(diferenta)} lei diferență pe o singură deducere. `
      + 'Contribuțiile calculate mai sus sunt corecte; deducerea este cea care nu poate fi stabilită. '
      + 'Art. 66 alin. (1) rotunjește sumele datorate, nu deducerile sau bazele, deci o regulă de rotunjire '
      + 'luată dintr-un singur exemplu ar modifica baza impozabilă în funcție de acel exemplu. Aplicația nu '
      + 'ghicește: așteptăm îndrumarea oficială despre precizia ponderii.',
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
    const total = sumBani([casRes.value, cassValue, cassLadderValue, taxDueByOwner]);
    lines.push({ label: 'Impozit pe venit (fără bază impozabilă)', value: lei(0) });
    if (flatLeg !== null || roomsLeg !== null || cedareLeg !== null) {
      lines.push({ label: flatTaxLabel, value: flatTax });
    }
    lines.push({ label: 'Total taxe', value: total });
    const snap = await createCalculationSnapshot({ profile, revenues: gross, expenses: deductibleBase, ruleRelease, rules: applicable, depreciation: depreciation ?? null, calculationLines: lines, output: { total } });
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
  if (flatLeg !== null || roomsLeg !== null || cedareLeg !== null) {
    // alin. (6) + alin. (11) of the flat article: this sum is 10 % of that net and nothing else. It is not
    // reduced by the CAS/CASS deductions the art. 118 composition above applies to the sistem-real source,
    // because „impozitul fiind final" settles it on the net and the ring-fence runs on the tax, not the
    // contributions.
    lines.push({ label: flatTaxLabel, value: flatTax });
  }
  // Art. 66 was already applied to each of the three sums, inside their calculators. Summing the rounded
  // integers is exact, and it is why no second rounding can happen anywhere downstream.
  const total = sumBani([casRes.value, cassValue, cassLadderValue, incomeTaxRes.value, taxDueByOwner]);
  lines.push({ label: 'Total taxe', value: total });
  const snap = await createCalculationSnapshot({ profile, revenues: gross, expenses: deductibleBase, ruleRelease, rules: applicable, depreciation: depreciation ?? null, calculationLines: lines, output: { total } });
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
 * `venitulNetCumulatPentruContributii` is written whenever the register is NOT a single lit. b) source.
 * Writing it always would put two numbers on screen for one quantity whenever there is only one source —
 * and a consumer that reads the wrong one of two always-present fields is a defect waiting to be picked.
 * B-85 is why the test is the leg count and not "a flat ratio was supplied": one register is one leg,
 * whichever method determined it. B-88 adds the other side of the same test: an art. 85 register supplies
 * no lit. b) leg at all, and the amount the engine measured CAS and CASS on is then zero — a row that read
 * the rent net instead would test a different amount than the engine did.
 */
function contributionBases(
  venitulBrut: Bani,
  cheltuieliDeductibile: Bani,
  venitulNetDinActivitate: Bani,
  legs: readonly ContributionLeg[],
  cassLadderBase?: Bani,
): TaxAmountBases {
  // B-88 — the one field whose meaning the art. 85 register changes. `venitulNetDinActivitate` is the
  // art. 155 alin. (1) lit. b) net: it is what art. 148 alin. (3) and art. 170 alin. (1) measure, and
  // `data/dashboard.ts buildThresholdBases` reads it for the CAS and CASS threshold rows. A register
  // determined under art. 85 supplies no lit. b) net at all — its net is art. 155 alin. (1) lit. e), which
  // goes to the art. 170 alin. (4) cumul instead — so the amount beside that name is 0, not the letting net
  // the caller holds. Reporting the letting net here would put a row and a figure in disagreement about the
  // same money, which is the B-71 defect this field exists to prevent.
  const bases: TaxAmountBases = {
    venitulBrut,
    cheltuieliDeductibile,
    venitulNetDinActivitate: legs.length === 0 ? lei(0) : venitulNetDinActivitate,
  };
  if (legs.length !== 1) {
    // B-88: with NO lit. b) source the cumulated amount the contributions were measured on is zero, and
    // the threshold rows have to read that zero rather than the rent net sitting beside it. Writing it is
    // the B-71 discipline — a row and a figure disagreeing about the same money is the defect, not the
    // extra field.
    bases.venitulNetCumulatPentruContributii = cumulateContributionBase(legs);
  }
  if (cassLadderBase !== undefined) bases.bazaDeCalculCassArt155LitCH = cassLadderBase;
  return bases;
}
