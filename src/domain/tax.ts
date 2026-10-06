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
import { regimeRefusalReason } from './regimes';
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

/** CF art. 118 alin. (2) lit. a) + alin. (4)-(5): a fiscal loss on this source, surfaced for
 * display. Phase 5 does NOT persist it — there is no prior-year store yet (Phase 7). */
export interface FiscalLossCarryForward {
  amount: number;
  years: number;
  capPercent: number;
  sameSourceOnly: true;
  rule: string;
}

export type TaxEstimateResult =
  | {
      status: 'computed';
      lines: CalculationLine[];
      output: CalculationOutput;
      snapshot: TaxCalculationSnapshot;
      lossCarryForward?: FiscalLossCarryForward;
    }
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

  // Area 6: VAT is not taxable income. Non-exempt profiles are taxed on the net base
  // (VAT excluded); exempt profiles keep the gross base.
  const gross = inputs.vatExempt ? revenues : revenuesNet;
  const deductibleBase = inputs.vatExempt ? expenses : expensesNet;
  lines.push({ label: 'Venit brut', value: gross });
  // B-16: this used to be `Math.min(deductibleBase, gross)`. That clamp forced the net to stay >= 0, so
  // a fiscal loss was UNREPRESENTABLE — an expense-heavy year came out as "no tax, no loss" and the
  // loss was silently thrown away. CF art. 118 alin. (2) lit. a) names „pierderea netă recalculată pe
  // fiecare sursă” as a figure the taxpayer must determine, so a negative sistem-real difference is a
  // legal number the engine has to carry, not clamp to zero.
  // Still out of scope (recorded as an input gap, not faked into a rule): whether each individual
  // expense is deductibilă under CF art. 68 alin. (4) — the app holds no per-expense nature data.
  lines.push({ label: 'Cheltuieli deductibile', value: deductibleBase });
  const net = gross - deductibleBase;
  lines.push({ label: 'Venit net din activitate', value: net });

  // CF art. 118 alin. (3) verbatim: „Veniturile din categoriile prevăzute la art. 61 lit. a), a^1), c) și
  // f), ce se realizează într-o fracțiune de an sau în perioade diferite ce reprezintă fracțiuni ale
  // aceluiași an, se consideră venit anual.” A PFA that started mid-year is taxed on the full-year
  // basis — the CAS/CASS floors are NOT prorated. Surfaced from the profile's start date so the user
  // sees the rule that applies; no figure changes. Date semantics stay Phase 9.
  if (profile.pfaStartDate && !profile.pfaStartDate.endsWith('-01-01')) {
    lines.push({ label: 'Fracțiune de an (art. 118 alin. (3)): venit anual', value: net });
  }

  // CF art. 150 alin. (1): pensioners and persons insured in their own social insurance
  // system owe no CAS. `inputs.pensionStatus` carries it, mirroring how
  // `inputs.socialInsuranceStatus` gates CASS below. `inputs.salaryStatus` is
  // deliberately NOT passed: art. 150 alin. (2) exempts salary earners only for
  // art. 137 alin. (1) lit. b^1) (drepturi de proprietate intelectuală), not lit. b),
  // so a salaried PFA owner still owes full CAS on independent-activity income.
  // A CAS of 0 (exemption, or income below 12 SM) flows through `taxable` and the
  // lines unchanged. NOTE the asymmetry: the same `pensionStatus` flag does NOT exempt
  // from CASS — see the CASS block below (CAS art. 150 alin. (1) vs CASS art. 174 alin. (7) lit. c)).
  const casRes = calculatorRegistry['calc-cas'](casRule, {
    base: net,
    pensionStatus: inputs.pensionStatus,
  });
  if ('reviewRequired' in casRes) return rr(casRes.reason, lines);
  lines.push({ label: 'CAS (25%)', value: casRes.value });

  let cassValue = 0;
  let cassNonDeductibila = 0;
  // CASS AND CAS TREAT PENSIONERS DIFFERENTLY — never mirror one branch into the other.
  //   CAS:  CF art. 150 alin. (1) — a pensioner owes NO CAS at all on art. 137 alin. (1)
  //         lit. b)/b^1) income (the call above).
  //   CASS: CF art. 174 alin. (7) lit. c) — pension income realised in that fiscal year
  //         removes ONLY the art. 174 alin. (6) top-up to 6 SM. 10% × net is still owed
  //         whenever net > 0, so `pensionStatus` must never zero CASS here.
  // `salaryStatus` is passed for CASS only: art. 174 alin. (7) lit. a) makes the top-up
  // conditional on salary income of at least 6 SM, an amount the profile does not carry, so
  // calcCass returns reviewRequired instead of guessing. It is deliberately NOT passed to
  // calcCas (art. 150 alin. (2) covers only lit. b^1)).
  // A CASS of 0 — art. 174 alin. (2) zero/loss year, or a relief — flows through `taxable`
  // and the lines unchanged; the reviewRequired case aborts with the reason and the partial
  // lines rather than reporting a wrong number.
  if (inputs.socialInsuranceStatus === 'obligatoriu') {
    const cassRes = calculatorRegistry['calc-cass'](cassRule, {
      base: net,
      pensionStatus: inputs.pensionStatus,
      salaryStatus: inputs.salaryStatus,
      // Phase 6: the amount CF art. 174 alin. (7) lit. a) compares to the 6 SM floor. With it both
      // branches compute; without it (a pre-Phase-6 payload) calcCass still refuses rather than guess.
      salaryIncomeLei: inputs.salaryIncomeLei ?? undefined,
    });
    if ('reviewRequired' in cassRes) return rr(cassRes.reason, lines);
    cassValue = cassRes.value;
    // CF art. 118 alin. (2) lit. b): only the part of CASS that art. 170 alin. (1) provides enters
    // the taxable base; calcCass reports the art. 174 alin. (6) difference as `nonDeductible`.
    cassNonDeductibila = cassRes.nonDeductible ?? 0;
    lines.push({ label: 'CASS (10%)', value: cassValue });
  } else {
    lines.push({ label: `CASS (${inputs.socialInsuranceStatus})`, value: 0 });
  }

  // ---- CF art. 118 alin. (2): the taxable base, composed in the order the law states it ----
  // alin. (2) lit. a): „venit net anual recalculat = venit net anual (sistem real) − pierderi fiscale
  // reportate”, PE SURSĂ, before incomes are summed. The app models one sistem-real source and has no
  // prior-year loss store (Phase 7 owns persistence), so the reported-loss term is 0 here and the
  // current-year loss is surfaced below rather than silently dropped.
  const pierderiReportate = 0;
  const vnaRecalculat = net - pierderiReportate;

  // alin. (2^2): CAS deductibilă = (venit net anual determinat în sistem real ÷ total venituri cumulate
  // potrivit art. 148 alin. (3)) × contribuția de asigurări sociale calculată potrivit art. 151 alin. (1).
  // alin. (2^3): CASS deductibilă = (venit net anual determinat în sistem real ÷ total venituri cumulate
  // potrivit art. 170 alin. (1)) × contribuția de asigurări sociale de sănătate calculată potrivit
  // art. 174 alin. (1).
  // While there is a single source, each denominator IS the sistem-real net, so both ratios are exactly
  // 1 and the proration is a no-op — the numbers do not move. It is written out anyway so that a second
  // income source (Phase 6) cannot silently inherit a full deduction it is not entitled to.
  const vnaSistemReal = Math.max(net, 0);
  const totalCumulatCass = vnaSistemReal; // art. 170 alin. (1)
  const totalCumulatCas = vnaSistemReal; // art. 148 alin. (3)
  const ratioCas = totalCumulatCas > 0 ? vnaSistemReal / totalCumulatCas : 1;
  const ratioCass = totalCumulatCass > 0 ? vnaSistemReal / totalCumulatCass : 1;
  const casDeductibila = ratioCas * casRes.value;
  // B-13: the art. 174 alin. (6) difference up to the 6 SM floor is OWED but never deductible — art. 118
  // alin. (2) lit. b) deducts the contributions „datorate potrivit prevederilor titlului V” „cu
  // excepția diferenței de contribuție de asigurări sociale de sănătate prevăzută la art. 174 alin. (6)”,
  // and alin. (2^3) prorates over the contribution „calculată potrivit art. 174 alin. (1)”. Deducting
  // the whole floor overstates the deduction in the 0 < VNA < 6 SM band and understates the tax.
  const cassDeductibila = Math.max(0, ratioCass * (cassValue - cassNonDeductibila));
  lines.push({ label: 'CAS deductibilă (art. 118 alin. (2^2))', value: casDeductibila });
  lines.push({ label: 'CASS deductibilă (art. 118 alin. (2^3), fără diferența art. 174 alin. (6))', value: cassDeductibila });

  // alin. (2^4): „Nivelul contribuției de asigurări sociale și al contribuției de asigurări sociale de
  // sănătate deductibile … nu poate depăși nivelul venitului net anual recalculat.” Without this cap a
  // low-net year could drive the base negative and hide a loss behind a negative tax.
  const deduceriCalculat = casDeductibila + cassDeductibila;
  const plafonDeduceri = Math.max(0, vnaRecalculat);
  const deduceriRetinute = Math.min(deduceriCalculat, plafonDeduceri);
  if (deduceriRetinute < deduceriCalculat) {
    lines.push({ label: 'Deduceri blocate de plafonul art. 118 alin. (2^4)', value: deduceriCalculat - deduceriRetinute });
  }

  const taxable = vnaRecalculat - deduceriRetinute;
  lines.push({ label: 'Venit net anual impozabil (art. 118 alin. (2) lit. b))', value: taxable });

  if (taxable <= 0) {
    // B-16: a zero or negative base is a FACT, not a review item. The status stays 'computed' and the
    // total stays the contributions actually owed — but a loss year must not be reported as a plain 0.
    let lossCarryForward: FiscalLossCarryForward | undefined;
    if (vnaRecalculat < 0) {
      lines.push({ label: 'Pierdere fiscală pe sursă (art. 118 alin. (2) lit. a))', value: -vnaRecalculat });
      lossCarryForward = {
        amount: -vnaRecalculat,
        years: 5,
        capPercent: 70,
        sameSourceOnly: true,
        rule: 'CF art. 118 alin. (4): „Pierderea fiscală anuală înregistrată pe fiecare sursă din activități independente … determinată în sistem real, se reportează și se compensează de către contribuabil în limita a 70% din veniturile nete anuale, obținute din aceeași sursă de venit în următorii 5 ani fiscali consecutivi.” Alin. (5): reportul se face cronologic pe 5 ani consecutivi, dreptul este personal și netransmisibil, iar pierderea necompensată la expirarea perioadei este pierdere definitivă.',
      };
    }
    const total = casRes.value + cassValue;
    lines.push({ label: 'Impozit pe venit (fără bază impozabilă)', value: 0 });
    lines.push({ label: 'Total taxe', value: total });
    const snap = await createCalculationSnapshot({ profile, revenues: gross, expenses: deductibleBase, ruleRelease, calculationLines: lines, output: { total } });
    const computed: TaxEstimateResult = { status: 'computed', lines, output: { total }, snapshot: snap };
    if (lossCarryForward) computed.lossCarryForward = lossCarryForward;
    return computed;
  }

  const incomeTaxRes = calculatorRegistry['calc-income-tax'](incomeTaxRule, { base: taxable });
  if ('reviewRequired' in incomeTaxRes) return rr(incomeTaxRes.reason, lines);
  lines.push({ label: 'Impozit pe venit (rată de bază 10%)', value: incomeTaxRes.value });
  const total = casRes.value + cassValue + incomeTaxRes.value;
  lines.push({ label: 'Total taxe', value: total });
  const snap = await createCalculationSnapshot({ profile, revenues: gross, expenses: deductibleBase, ruleRelease, calculationLines: lines, output: { total } });
  return { status: 'computed', lines, output: { total }, snapshot: snap };
}
