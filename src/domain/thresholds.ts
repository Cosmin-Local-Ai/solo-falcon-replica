import type { FiscalRule } from './fiscal/rules';
import { selectApplicableRules } from './fiscal/select';
import type { PfaProfile } from './models';
import {
  readCassExceptionFacts,
  readForeignSicknessInsuranceProved,
  readPensionerStatus,
} from './pensionFacts';
import { formatBaniLei, lei, subBani, type Bani } from './money';

/**
 * `tier-floor` is not a ceiling and not a disqualification — it is a **step in a ladder**.
 * CF art. 148 alin. (2) makes the chosen base "nu poate fi mai mic decât" 12 SM, and
 * lit. b) raises that floor to 24 SM once realised income is "cel puțin egal cu 24 de salarii
 * minime brute pe țară". Crossing it therefore *doubles the floor* (CAS 12.150 → 24.300 lei);
 * nothing is disqualified and nothing is capped. It is modelled separately precisely because
 * the `max-base` meaning ("schimbare de regim") would have been false — see the CAS_MAX_BASE
 * note below `THRESHOLD_SPECS`.
 */
export type ThresholdType = 'min-base' | 'max-base' | 'registration' | 'income' | 'tier-floor';

/**
 * The amount a threshold is legally measured against. Each member names ONE
 * amount concept so a threshold can never silently borrow a neighbouring one.
 *
 * Revenue / expense bases (from `selectYtd`, `src/domain/aggregation.ts`):
 * - `revenue-incl-vat`: cash actually collected, `valoareFaraTva + tva` (`YtdTotals.revenue`).
 * - `revenue-excl-vat`: **cifră de afaceri** — `valoareFaraTva` only (`YtdTotals.revenueNet`).
 *   This is the base CF art. 310 alin. (1) measures the 395.000-lei plafon against.
 * - `expense-incl-vat`: `valoareFaraTva + tva` (`YtdTotals.expenses`).
 * - `expense-excl-vat`: `valoareFaraTva` only (`YtdTotals.expenseNet`).
 *
 * Contribution base:
 * - `net-income`: **venitul net din activitate** — the base CAS is chosen on
 *   (CF art. 148 alin. (1)-(2)) and the base CASS is owed on (CF art. 170 alin. (1),
 *   art. 174 alin. (2) and (6)). Supplied ONLY by the tax engine
 *   (`src/domain/tax.ts`, the `net` behind the `'Venit net din activitate'` line),
 *   never by `selectYtd`. `YtdTotals.net` is `revenue - expenses` on VAT-INCLUSIVE
 *   operands and is NOT this quantity — do not wire it here.
 *
 * A spec whose required base the caller cannot supply yields a
 * `review_required` row, never a silently dropped row. See `computeThresholds`.
 */
export type FiscalBase =
  | 'revenue-incl-vat'
  | 'revenue-excl-vat'
  | 'expense-incl-vat'
  | 'expense-excl-vat'
  | 'net-income';

/**
 * Threshold status. `review_required` means the threshold itself is citable but the
 * amount it must be measured against was not available, so no verdict can be given.
 * It is deliberately NOT collapsed into `ok` — an unmeasured threshold must not look safe.
 */
export type ThresholdStatus = 'ok' | 'warning' | 'breached' | 'review_required';

/**
 * TASK 4 — what a crossing of this level MEANS in law. This is a different question from
 * `ThresholdType`, which is the arithmetic shape of the comparison (`min-base` reads "below the
 * number", `max-base` reads "above the number"). The arithmetic shape must never decide the legal
 * consequence: that is what produced `breachMeaningFor`, whose two floor strings asserted a
 * `dezcalificare din regim` and a `schimbare de regim` that no provision of the Cod fiscal creates
 * (`docs/ai/research/24_cas_floor_consequence_2026.md`, "What the app must not state" items 1-4 —
 * the word „decălificare" occurs zero times in the Cod fiscal).
 *
 * - `registration` — crossing the level triggers a registration duty (CF art. 310 alin. (1)).
 *   This is the only shipped kind where `status: 'breached'` is a defensible word: the duty exists.
 * - `tier_transition` — the level is a rung of a ladder: on one side of it one base applies, on the
 *   other another (CF art. 148 alin. (1)-(2), art. 174 alin. (6)). **A `tier_transition` row can
 *   never be `breached`**, in either direction. Below the CAS 12-SM level the consequence is
 *   `nu datorează contribuția de asigurări sociale`, with an optional election under art. 148 alin. (4).
 * - `over_limit` — the level is a statutory cap on the base (CF art. 170 alin. (1), 72 SM). Crossing
 *   it caps the base; it is not an offence.
 * - `informational` — the row states a fact with no duty attached. Never breached.
 */
export type ThresholdKind = 'registration' | 'tier_transition' | 'over_limit' | 'informational';

/**
 * TASK 4 — how much attention the row deserves from the user.
 *
 * This is deliberately a SEPARATE dimension from `ThresholdKind` and from `ThresholdStatus`:
 * `severityFor` does not take the kind at all, so a row cannot become urgent merely because of
 * which legal family it belongs to, and a legally load-bearing row is not automatically urgent.
 * Severity is a function of applicability, status and distance only.
 */
export type ThresholdSeverity = 'none' | 'low' | 'medium' | 'high';

/**
 * TASK 4 — does this threshold apply to THIS taxpayer at all? Applicability is computed from the
 * profile / fiscal context (`applicabilityFor`), never assumed. A row that does not apply renders as
 * not applicable and carries severity `none`; it cannot render as a breach.
 *
 * `unknown` is a real third state, not a synonym for `applicable`: it means the fact the rule needs
 * is not in the profile (no profile supplied, no salary amount for CF art. 174 alin. (7) lit. a),
 * a CASS status flag whose legal basis was never verified — B-19). The app must not decide an
 * exception it does not have the input for.
 */
export type Applicability = 'applicable' | 'not_applicable' | 'unknown';

/**
 * TASK 4 — which quantity the row actually measured. TASK 1 left a deliberate asymmetry: the four
 * contribution rows are measured against an ANNUAL figure (projected, or actuals when the projection
 * model could not run) while `VAT_REGISTRATION` is measured against YEAR-TO-DATE turnover. That split
 * is correct — CF art. 148 / art. 170 measure an annual value, art. 310 alin. (1) measures the
 * turnover realised in the year so far — so it is labelled here instead of being quietly unified.
 */
export type MeasuredBasis =
  | 'annual-projected'
  | 'annual-actual'
  | 'ytd-turnover'
  | 'unattributed'
  | 'unmeasured';

/**
 * TASK 4 — a lei amount that the law does NOT state in lei.
 *
 * CF art. 148 / art. 170 / art. 174 state multipliers of „salariul minim", never a lei figure, and
 * research 24 ("What the app must not state" item 6) forbids presenting a single lei amount as the
 * statutory FY2026 threshold: ANAF's 48.600 / 97.200 lei use the SM in force at 1 ianuarie 2026
 * (4.050 lei, HG 1.506/2024) while HG 146/2026 raised SM to 4.325 lei from 1 iulie 2026, and art. 148
 * carries no reference-date clause. So the lei figure is rendered as COMPUTED, with the SM value and
 * its act cited, and the unverified vintage stated.
 */
export interface ComputedLeiAmount {
  /** The multiplier the law states (6 / 12 / 24 / 72 salarii minime brute). */
  multiplier: number;
  /** The salariul minim value the app multiplied, in bani. */
  smValueBani: Bani;
  /** The act that set that SM value, e.g. 'HG 1506/2024'. */
  smAct: string;
  /** Factual note: the law states a multiplier, and which SM vintage governs is unverified. */
  note: string;
}

/** Every amount a caller can supply, keyed by the base it represents. Absent = unknown. */
export interface ThresholdBases {
  // Phase 10: integer bani. A threshold comparison is a comparison of amounts, so the unit has to be the
  // same one the rule package stores its `unit:'lei'` parameters in.
  'revenue-incl-vat'?: Bani;
  'revenue-excl-vat'?: Bani;
  'expense-incl-vat'?: Bani;
  'expense-excl-vat'?: Bani;
  'net-income'?: Bani;
}

export interface FiscalThreshold {
  thresholdId: string;
  type: ThresholdType;
  /** The amount measured, or `null` when the required base was unavailable. */
  currentValue: Bani | null;
  thresholdValue: Bani;
  distance: Bani; // currentValue - thresholdValue (negative = below threshold); 0 when unmeasured
  affectedDomain: string; // e.g. 'pfa-revenue'
  affectedTax: string; // e.g. 'cas', 'cass', 'vat'
  effectiveDate: string;
  /**
   * Distance at which `warning` triggers. This is a **presentation band chosen by the app
   * (10% of the threshold), NOT a statutory figure** — it carries no citation and must not
   * acquire one.
   */
  warningDistance: Bani;
  /**
   * TASK 6: the `releaseId` of the release that produced this row, or `null` when the caller had no
   * release to ask about. It used to be typed `string` and fed `PFA_2026_RELEASE.ruleIds[0]` — a rule id
   * wearing a release field's name, which is what a hard-coded constant turns into when nothing checks it.
   */
  ruleRelease: string | null;
  source: string;
  status: ThresholdStatus;
  /** The fiscal base this threshold was evaluated against. */
  fiscalBase: FiscalBase;
  /** TASK 4 — the legal kind of this row: what a crossing means. Decides whether `status`
   * may ever be `breached` (`statusFor`) and how an alert is worded. Never derived from `type`.
   */
  kind: ThresholdKind;
  /**
   * TASK 4 — is the measured value on the side of the level where the row's special consequence
   * applies (`engagedSide`)? `false` on an unmeasured row: there is no side to speak of.
   */
  engaged: boolean;
  /**
   * TASK 4 — how much user attention the row deserves. Computed by `severityFor`, which does not
   * read `kind`: legal kind and user severity are independent dimensions.
   */
  severity: ThresholdSeverity;
  /** TASK 4 — whether this threshold applies to this profile at all (`applicabilityFor`). */
  applicability: Applicability;
  /** Present whenever `applicability !== 'applicable'`: why, with the provision it rests on. */
  applicabilityReason?: string;
  /** TASK 4 — which quantity was measured: annual projected/actual VNA, or YTD turnover. */
  measuredBasis: MeasuredBasis;
  /**
   * TASK 4 — the factual, cited consequence of where the measured value sits. Replaces
   * `breachMeaning`, which asserted a regime change no provision creates. It states what the law
   * provides, not what the app fears.
   */
  consequence: string;
  /** Present when the threshold is an SM multiple: the lei amount is computed, not statutory. */
  computedFrom?: ComputedLeiAmount;
  /** Present only when `status === 'review_required'`: why no verdict could be given. */
  reviewReason?: string;
}

export interface ThresholdQuery {
  taxYear: number;
  asOfDate: string;
  /**
   * Every amount the caller can supply, keyed by the base it represents. One query can
   * therefore serve specs that need different bases; a spec whose base is absent becomes a
   * `review_required` row rather than disappearing.
   */
  bases: ThresholdBases;
  /** TASK 6: the releaseId in force for this query, or `null` when none is registered for the year. */
  ruleRelease: string | null; // releaseId
  /**
   * TASK 4 — the profile the applicability decision is derived from. Optional in the TYPE because
   * the domain function is also called with hand-built queries; omitting it yields
   * `applicability: 'unknown'`, never `'applicable'`. The production caller (`data/dashboard.ts
   * getThresholdStatuses`) always supplies it, and `dashboard.test.ts` pins that no production row
   * comes back `unknown`.
   */
  profile?: PfaProfile;
  /**
   * TASK 4 — how each supplied amount was produced (annual projected vs actuals vs YTD). Absent for
   * a supplied base renders as `unattributed`; a base that was never supplied renders as `unmeasured`.
   */
  measuredBasis?: Partial<Record<FiscalBase, MeasuredBasis>>;
}

export interface ThresholdSpec {
  thresholdId: string;
  type: ThresholdType;
  ruleId: string;
  paramId: string;
  affectedDomain: string;
  affectedTax: string;
  /**
   * The fiscal base this threshold legally applies to. `computeThresholds` evaluates the
   * spec against `query.bases[requiredFiscalBase]`; if that base is absent the spec yields
   * a `review_required` row instead of being skipped.
   */
  requiredFiscalBase: FiscalBase;
  /**
   * The provision that defines the BASE (not merely the threshold value). Asserted by
   * `thresholds.test.ts` so a row can never travel without the article that names its base.
   */
  baseSourceArticle: string;
  /** TASK 4 — what a crossing of this level means in law. See `ThresholdKind`. */
  kind: ThresholdKind;
  /**
   * TASK 4 — which applicability rule `applicabilityFor` runs for this row. A spec must name one:
   * an unlisted test is a bug, not a default to `applicable`.
   */
  applicabilityTest: 'cas-art-150-1' | 'cass-art-174-6' | 'cass-art-170-1' | 'vat-art-310';
  /**
   * TASK 4 — the multiplier of „salariul minim" the LAW states for this level, when the law states
   * one as a multiplier. Present ⇒ the lei amount is rendered as computed (`ComputedLeiAmount`);
   * absent ⇒ the lei figure is the statute's own number (CF art. 310 alin. (1): 395.000 lei).
   */
  statutorySmMultiplier?: number;
  /** TASK 4 — what the law provides while the measured value is at or above the level. */
  consequenceAtOrAbove: string;
  /** TASK 4 — what the law provides while the measured value is below the level. */
  consequenceBelow: string;
}

/**
 * TASK 4 — the side of the level on which the row's special consequence applies. Pure arithmetic:
 * a floor is engaged BELOW it, a cap or a duty level is engaged AT/ABOVE it. `statusFor` uses it to
 * decide whether the level is in play; the KIND then decides whether that may be called a breach.
 */
export function engagedSide(type: ThresholdType, distance: Bani): boolean {
  // A `min-base` level is engaged when the measured value fell under it; a duty level or a ladder rung
  // is engaged at or above it (CF art. 148 alin. (2) lit. b) applies once income is "cel puțin egal cu"
  // 24 SM, and art. 310 alin. (1) at the plafon itself). `max-base` and `income` keep their strict `>`:
  // reaching a cap exactly is not exceeding it.
  if (type === 'min-base') return distance < 0;
  if (type === 'max-base' || type === 'income') return distance > 0;
  return distance >= 0;
}

/**
 * Exported read-only so tests can prove every spec's `requiredFiscalBase` is actually
 * supplied by the production caller — the guard against a spec being dropped by a
 * base mismatch.
 */
export const THRESHOLD_SPECS: readonly ThresholdSpec[] = [
  {
    thresholdId: 'CAS_MIN_BASE',
    type: 'min-base',
    ruleId: 'CAS_2026',
    // `min_base` is the tier-1 floor (12 SM). CAS_MIN_BASE stays valid: crossing it is
    // what triggers the CAS obligation at all (CF art. 148 alin. (1)).
    paramId: 'min_base',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cas',
    // CAS is chosen on the contribution base, not on turnover: CF art. 148 alin. (1)-(2)
    // measures the 12 SM / 24 SM floors against "venitul net anual realizat".
    requiredFiscalBase: 'net-income',
    baseSourceArticle: 'Cod fiscal art. 148 alin. (1)-(2) lit. a) (baza: venitul net anual realizat)',
    // TASK 4: 12 SM is the ENTRY threshold for the CAS obligation and the tier-1 MINIMUM base. Below
    // it the law's only consequence is `nu datorează contribuția de asigurări sociale`, with an
    // optional election (art. 148 alin. (4)). It is not a breach, not a rectification, not a penalty
    // and not a regime change — research 24 searched the whole Cod fiscal and found zero occurrences
    // of „decălificare" and no provision attaching any consequence to a below-12-SM income.
    kind: 'tier_transition',
    applicabilityTest: 'cas-art-150-1',
    statutorySmMultiplier: 12,
    consequenceBelow:
      'Venitul net anual din activități independente este sub pragul de 12 salarii minime brute pe țară; în consecință, nu se datorează contribuția de asigurări sociale pentru acest an (art. 148 alin. (1) și (4) din Codul fiscal). Opțiunea pentru plata CAS este disponibilă, la un venit ales de cel puțin 12 salarii minime brute.',
    consequenceAtOrAbove:
      'Venitul net anual din activități independente este cel puțin egal cu 12 salarii minime brute pe țară; se datorează contribuția de asigurări sociale, la o bază de calcul nu mai mică de 12 salarii minime brute (art. 148 alin. (1) și (2) lit. a) din Codul fiscal).',
  },
  // CAS_MAX_BASE was removed in Phase 3 and is NOT restored. CF art. 148 alin. (2) sets FLOORS —
  // "venitul ales de contribuabil, care nu poate fi mai mic decât" 12 SM / 24 SM — and contains no
  // ceiling for CAS, so a `max-base` row on 97.200 lei asserted a statutory cap that does not exist
  // (docs/ai/phases/02_fiscal_baseline.md §2.1). The row below is the correct replacement the Phase 3
  // comment asked for: the same 97.200-lei figure, typed as the ladder step it legally is.
  // `max-base` itself remains in ThresholdType — CASS_MAX_BASE legitimately has a cap
  // (CF art. 170 alin. (1), "nu poate fi mai mare decât" 72 SM).
  {
    thresholdId: 'CAS_TIER2_FLOOR',
    type: 'tier-floor',
    ruleId: 'CAS_2026',
    // `tier2_base` is the tier-2 floor (24 SM). It is the SAME parameter `calcCas` uses to pick the
    // doubled floor (`tier2_cas`), so the threshold row and the computed CAS cannot drift apart.
    paramId: 'tier2_base',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cas',
    // Art. 148 alin. (2) measures the tier against realised net income, like tier 1.
    requiredFiscalBase: 'net-income',
    baseSourceArticle:
      'Cod fiscal art. 148 alin. (2) lit. b) (baza: venitul net anual realizat cel puțin egal cu 24 SM)',
    // A rung of the same ladder, so the same kind: crossing it raises the MINIMUM base, it does not
    // exceed a limit. `statusFor` refuses to call it `breached` for exactly this reason.
    kind: 'tier_transition',
    applicabilityTest: 'cas-art-150-1',
    statutorySmMultiplier: 24,
    consequenceBelow:
      'Venitul net anual este sub 24 de salarii minime brute; baza minimă de calcul pentru CAS rămâne 12 salarii minime brute (art. 148 alin. (2) lit. a) din Codul fiscal). Acest prag nu este un plafon.',
    consequenceAtOrAbove:
      'Venitul net anual este cel puțin egal cu 24 de salarii minime brute; baza minimă de calcul pentru CAS crește de la 12 SM la 24 SM (art. 148 alin. (2) lit. b) din Codul fiscal). Nu este un plafon.',
  },
  {
    thresholdId: 'CASS_MIN_BASE',
    type: 'min-base',
    ruleId: 'CASS_2026',
    paramId: 'min_base',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cass',
    // CF art. 174 alin. (6) tops up the contribution to 6 SM by reference to VNA, and
    // art. 174 alin. (2) switches CASS off when VNA is zero — both measure the CASS base.
    requiredFiscalBase: 'net-income',
    baseSourceArticle: 'Cod fiscal art. 174 alin. (6) coroborat cu art. 170 alin. (1) (baza: venitul net anual)',
    // CF art. 174 alin. (6): below a 6-SM base the taxpayer datorează „o diferență de contribuție” up
    // to that base. That is an AMOUNT OWED, not a violation — so this is a tier transition too, and
    // `statusFor` will not call it breached. CF art. 174 alin. (2) switches the whole contribution off
    // for a zero/loss year, and alin. (7) lit. a)/c) remove only this top-up: see `applicabilityFor`.
    kind: 'tier_transition',
    applicabilityTest: 'cass-art-174-6',
    statutorySmMultiplier: 6,
    consequenceBelow:
      'Venitul net anual este sub baza de calcul de 6 salarii minime brute; se datorează diferența de contribuție până la nivelul corespunzător bazei de 6 salarii minime brute (art. 174 alin. (6) coroborat cu art. 170 alin. (1) din Codul fiscal).',
    consequenceAtOrAbove:
      'Venitul net anual este cel puțin egal cu baza de calcul de 6 salarii minime brute; baza de calcul pentru CASS este venitul net anual, în limita plafonului de 72 de salarii minime brute (art. 170 alin. (1) din Codul fiscal).',
  },
  {
    thresholdId: 'CASS_MAX_BASE',
    type: 'max-base',
    ruleId: 'CASS_2026',
    paramId: 'max_annual_base',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'cass',
    // CF art. 170 alin. (1): the 72 SM ceiling caps the *base de calcul*, i.e. VNA — not turnover.
    requiredFiscalBase: 'net-income',
    baseSourceArticle: 'Cod fiscal art. 170 alin. (1) (plafon de 72 SM din venitul net anual)',
    // The only genuine cap on this path: art. 170 alin. (1) says „nu poate fi mai mare decât” 72 SM.
    // Crossing it caps the base — `over_limit`, the one contribution kind whose crossing may be
    // reported as `breached`, because the statutory limit really is exceeded (still not an offence).
    kind: 'over_limit',
    applicabilityTest: 'cass-art-170-1',
    statutorySmMultiplier: 72,
    consequenceBelow:
      'Venitul net anual este sub baza de calcul de 72 de salarii minime brute; plafonul din art. 170 alin. (1) din Codul fiscal nu limitează baza de calcul pentru CASS.',
    consequenceAtOrAbove:
      'Venitul net anual depășește baza de calcul de 72 de salarii minime brute; baza de calcul pentru CASS nu poate fi mai mare decât acest nivel, iar contribuția se calculează la plafon (art. 170 alin. (1) din Codul fiscal).',
  },
  {
    thresholdId: 'VAT_REGISTRATION',
    type: 'registration',
    ruleId: 'VAT_THRESHOLD_2026',
    paramId: 'threshold',
    affectedDomain: 'pfa-revenue',
    affectedTax: 'vat',
    // The plafon is a VAT-EXCLUSIVE turnover test. See the art. 310 alin. (2) caveat in
    // docs/ai/phases/02_fiscal_baseline.md: "exclusiv taxa" attaches grammatically to the
    // *ieșire din evidență* case, and alin. (2) also excludes fixed-asset deliveries; the
    // VAT-exclusive reading holds because no provision anywhere measures the plafon
    // TVA-inclusiv — not because alin. (2) is a global definition.
    requiredFiscalBase: 'revenue-excl-vat',
    baseSourceArticle: 'Cod fiscal art. 310 alin. (1) (cifră de afaceri, exclusiv taxa)',
    // A registration duty really does attach to this level, so this is the one row where `breached`
    // is a defensible word. The lei figure is the statute's own (art. 310 alin. (1): 395.000 lei), so
    // it carries NO `statutorySmMultiplier` and must never be labelled as computed.
    kind: 'registration',
    applicabilityTest: 'vat-art-310',
    consequenceBelow:
      'Cifra de afaceri de la începutul anului este sub plafonul de 395.000 lei; obligația de înregistrare în scopuri de TVA nu intervine (art. 310 alin. (1) din Codul fiscal).',
    consequenceAtOrAbove:
      'Cifra de afaceri de la începutul anului este cel puțin egală cu plafonul de 395.000 lei; intervine obligația de înregistrare în scopuri de TVA (art. 310 alin. (1) din Codul fiscal).',
  },
];

/**
 * TASK 4 — the legal/calculation status of a row.
 *
 * The signature gained `kind`, and that addition IS the change: whether an engaged level may be
 * called `breached` is a legal question, and the answer is carried by the KIND, never by the
 * arithmetic shape. `tier_transition` and `informational` rows are never `breached`, in either
 * direction: CF art. 148 alin. (1) makes the 12-SM figure the condition for the CAS obligation to
 * exist at all, and below it art. 148 alin. (4) plus art. 151 alin. (3) provide only
 * `nu datorează contribuția` with an optional election. Research 24 searched the consolidated Cod
 * fiscal and found no provision making a below-floor income a breach, a rectification duty, a
 * penalty or a reportable event — which is why `breachMeaningFor` and its two floor strings are
 * deleted rather than reworded.
 */
export function statusFor(
  type: ThresholdType,
  distance: Bani,
  warningDistance: Bani,
  kind: ThresholdKind,
): Exclude<ThresholdStatus, 'review_required'> {
  if (engagedSide(type, distance)) {
    if (kind === 'tier_transition' || kind === 'informational') return 'warning';
    return 'breached';
  }
  // Not engaged. The only thing left to say is that the measured value sits close to the level, and
  // that band is the app's own presentation policy (`warningDistance`, 10 % of the threshold) — it
  // is not a statutory distance and must never acquire a citation.
  if (Math.abs(distance) <= warningDistance) return 'warning';
  return 'ok';
}

/**
 * TASK 4 — how much attention the row deserves.
 *
 * Note what this function does NOT take: no `kind`, no `type`, no affected tax. Severity is a
 * separate dimension from the legal kind, so a row cannot become urgent just because of the legal
 * family it belongs to, and a legally load-bearing row is not automatically urgent. It is a function
 * of applicability, status and distance only — which is also what makes the independence testable.
 */
export function severityFor(facts: {
  applicability: Applicability;
  status: ThresholdStatus;
  distance: Bani;
  warningDistance: Bani;
}): ThresholdSeverity {
  // A threshold that does not apply to this taxpayer deserves no attention at all, whatever its
  // status says: an inapplicable row must never surface as a breach or an alert.
  if (facts.applicability === 'not_applicable') return 'none';
  // Citable but unmeasured: the user's job is to supply the missing base.
  if (facts.status === 'review_required') return 'medium';
  // If the profile does not even establish that the row applies, a crossing is not yet the user's
  // problem to fix — report it, but do not shout.
  if (facts.status === 'breached') return facts.applicability === 'unknown' ? 'medium' : 'high';
  if (facts.status === 'warning') return 'medium';
  // 'ok': the only urgency left is proximity. Two warning bands of the app's own 10 % policy is the
  // reading used here; it is a distance question, and `kind` is never consulted.
  if (facts.applicability === 'unknown') return 'low';
  return Math.abs(facts.distance) <= 2 * facts.warningDistance ? 'low' : 'none';
}

export interface ApplicabilityDecision {
  applicability: Applicability;
  /** Present whenever `applicability !== 'applicable'`: why, with the provision it rests on. */
  reason?: string;
}

/**
 * TASK 4 — decide whether a threshold applies to THIS profile, from the profile / fiscal context.
 *
 * Nothing here is assumed. Where the profile lacks the fact a rule needs, the answer is `unknown`
 * with a reason — the same honesty the engine already practices (`calcCass` refuses to guess the
 * CF art. 174 alin. (7) lit. a) comparison without the salary amount, and B-19 keeps the CASS status
 * flag unverified). An inapplicable row is rendered as inapplicable and carries severity `none`, so
 * it cannot render as a breach at all.
 */
export function applicabilityFor(
  spec: ThresholdSpec,
  profile: PfaProfile | undefined,
  measured: Bani | undefined,
  thresholdValue: Bani,
): ApplicabilityDecision {
  if (!profile) {
    return {
      applicability: 'unknown',
      reason:
        'Profilul nu a fost furnizat, deci excepțiile care guvernează acest prag nu au putut fi evaluate. Aplicația nu presupune că pragul se aplică.',
    };
  }

  switch (spec.applicabilityTest) {
    case 'cas-art-150-1': {
      // CF art. 150 alin. (1): pensioners and people insured in their own social insurance systems
      // owe NO CAS on art. 137 alin. (1) lit. b)/b^1) income. `salaryStatus` is deliberately NOT
      // consulted: art. 150 alin. (2) exempts salary earners only for lit. b^1), never for lit. b).
      //
      // TASK 5: this stays keyed on the pension STATUS — it is the one provision in this area where
      // status is the correct key. It reads `pensionerStatus`, not the deprecated `pensionStatus`.
      if (readPensionerStatus(profile) === 'da') {
        return {
          applicability: 'not_applicable',
          reason:
            'Persoană pensionară sau asigurată în sisteme proprii de asigurări sociale: nu datorează contribuția de asigurări sociale pentru veniturile din activități independente (art. 150 alin. (1) din Codul fiscal). Excepția nu depinde de cuantumul venitului.',
        };
      }
      return { applicability: 'applicable' };
    }

    case 'cass-art-174-6':
    case 'cass-art-170-1': {
      // B-19: the stored CASS status flag names the art. 154 alin. (1) categories, a closed list none
      // of which covers a PFA on independent-activity income. The engine marks that zero `reviewRequired`
      // rather than presenting it as an established exemption, and the threshold layer must not be more
      // confident than the engine.
      if (profile.socialInsuranceStatus !== 'obligatoriu') {
        return {
          applicability: 'unknown',
          reason:
            'Starea CASS din profil nu are temei legal verificat pentru un PFA cu activitate independentă (art. 154 alin. (1) din Codul fiscal este o listă închisă); aplicația nu poate stabili dacă contribuția se datorează.',
        };
      }
      if (measured === undefined) {
        return {
          applicability: 'unknown',
          reason: 'Baza de calcul nu a fost măsurată, deci aplicabilitatea contribuției nu a putut fi stabilită.',
        };
      }
      // CF art. 153 alin. (2): a person who holds sickness/maternity insurance in another EU/SEE /
      // Confederația Elvețiană or bilateral-agreement state and has proved it „nu au calitatea de
      // contribuabil la sistemul de asigurări sociale de sănătate”. That removes the CASS taxpayer
      // quality itself, so it reaches BOTH rows — unlike the art. 174 alin. (7) reliefs below, which
      // reach only the alin. (6) top-up. Both halves are required: holding the insurance without
      // proving it is reported as `unknown`, not as the exemption.
      if (readForeignSicknessInsuranceProved(profile, profile.fiscalYear) === 'da') {
        return {
          applicability: 'not_applicable',
          reason:
            'Persoana deține o asigurare pentru boală și maternitate în sistemul de securitate socială din alt stat membru al Uniunii Europene, Spațiului Economic European și Confederația Elvețiană sau dintr-un stat cu acord bilateral, și a făcut dovada valabilității ei: nu are calitatea de contribuabil la sistemul de asigurări sociale de sănătate (art. 153 alin. (2) din Codul fiscal). Temeiul nu privește pensia: art. 154 alin. (2) păstrează CASS pentru celelalte venituri din art. 155 alin. (1).',
        };
      }
      // CF art. 174 alin. (2): a zero net income or a fiscal loss owes no CASS „potrivit art. 170
      // alin. (1)”, so the 72-SM cap has nothing to cap. The same person may opt in under art. 180
      // alin. (1).
      //
      // TASK 5 — the row split is the whole point here. Whether the art. 174 alin. (6) 6-SM DIFFERENCE
      // survives a zero/loss year is NOT settled by the code: alin. (2) switches off the contribution
      // under art. 170 alin. (1), while alin. (6) speaks of a base „corespunzătoare veniturilor
      // realizate” below 6 SM. Research 25 gap 2 records this as unresolved and forbids settling it by
      // inference, and until TASK 5 the same `not_applicable` was returned for BOTH rows on the same
      // citation — an inference presented as law. The cap row keeps the citation; the top-up row
      // reports `unknown` with a Notă de interpretare.
      if (measured <= 0) {
        if (spec.applicabilityTest === 'cass-art-170-1') {
          return {
            applicability: 'not_applicable',
            reason:
              'Venit net anual egal cu zero sau pierdere fiscală: nu se datorează contribuția de asigurări sociale de sănătate stabilită potrivit art. 170 alin. (1) (art. 174 alin. (2) din Codul fiscal), deci plafonul de 72 de salarii minime brute nu are ce să limiteze. Aceeași persoană poate opta pentru plată potrivit art. 180 alin. (1). Pierderile fiscale anuale prevăzute la art. 118 nu intră în baza de calcul.',
          };
        }
        return {
          applicability: 'unknown',
          reason:
            'Notă de interpretare: venitul net anual este zero sau pierdere fiscală. art. 174 alin. (2) din Codul fiscal spune că nu se datorează contribuția „potrivit art. 170 alin. (1)”, iar art. 174 alin. (6) vorbește despre o diferență de contribuție pentru o bază „corespunzătoare veniturilor realizate” mai mică decât 6 salarii minime brute. Codul nu spune dacă diferența de la alin. (6) supraviețuiește unui an cu venit zero sau pierdere — research 25, gap 2 (NEVERIFICAT). Aplicația nu decide prin inferență: randul rămâne nehotărât până la o sursă primară.',
        };
      }
      if (spec.applicabilityTest === 'cass-art-170-1') {
        // The cap rides on the art. 170 alin. (1) contribution itself, which a pensioner still owes:
        // art. 174 alin. (7) lit. c) removes ONLY the art. 174 alin. (6) top-up. Never mirror the CAS
        // pensioner exemption into CASS.
        return { applicability: 'applicable' };
      }
      // Below here the row is the art. 174 alin. (6) TOP-UP, and only the top-up, so the reliefs in
      // art. 174 alin. (7) and alin. (8) make THIS row inapplicable while the CASS contribution keeps
      // applying.
      const facts = readCassExceptionFacts(profile, profile.fiscalYear);
      // CF art. 174 alin. (7) lit. c): pension sums received in the fiscal year, at ANY amount. This
      // is not pensioner status — a pensioner who received no pension sums in the year does not
      // qualify, and a person who was not a pensioner all year but received some does. No amount is
      // compared: lit. a) and lit. b) carry the 6-SM qualifier and lit. c) deliberately does not.
      if (facts.pensionSumsReceived === 'da') {
        return {
          applicability: 'not_applicable',
          reason:
            'Sume primite ca pensii (art. 99 alin. (1)) realizate în anul fiscal pentru care se depune declarația: diferența de contribuție până la baza de 6 salarii minime brute nu se datorează (art. 174 alin. (7) lit. c) din Codul fiscal). Fapta este încasarea din an, nu calitatea de pensionar, și lit. c) nu are niciun prag valoric. Contribuția de 10 % pe venitul net rămâne datorată — art. 174 alin. (7) lit. c) elimină doar diferența.' +
            (facts.suspensionNote ? ` ${facts.suspensionNote}` : ''),
        };
      }
      // CF art. 174 alin. (8): the same relief also reaches a person who in the PREVIOUS year was in
      // art. 154 alin. (1) lit. a), b), e) or f), or had opted under art. 180 alin. (1). That list
      // excludes pensioners, so this route needs its own recorded fact and can never be inferred from
      // `pensionerStatus`.
      if (facts.previousYearExceptedCategory === 'da' || facts.previousYearArt180Option === 'da') {
        return {
          applicability: 'not_applicable',
          reason:
            'În anul precedent persoana s-a încadrat în categoriile exceptate de la art. 154 alin. (1) lit. a), b), e) și f) sau a optat pentru plata contribuției potrivit art. 180 alin. (1): prevederile art. 174 alin. (7) se aplică și în cazul ei (art. 174 alin. (8) din Codul fiscal), deci diferența de contribuție până la 6 salarii minime brute nu se datorează. Lista alin. (8) lit. a) nu include pensionarii — această cale nu se deduce din calitatea de pensionar. Contribuția de 10 % pe venitul net rămâne datorată.',
        };
      }
      if (profile.salaryStatus === 'da' && profile.salaryIncomeLei === undefined) {
        return {
          applicability: 'unknown',
          reason:
            'Profilul declară venituri din salarii dar nu conține cuantumul lor, iar art. 174 alin. (7) lit. a) din Codul fiscal compară acel cuantum cu 6 salarii minime brute. Aplicația nu decide o excepție pentru care nu are inputul.',
        };
      }
      if (
        profile.salaryStatus === 'da' &&
        profile.salaryIncomeLei !== undefined &&
        profile.salaryIncomeLei >= thresholdValue
      ) {
        return {
          applicability: 'not_applicable',
          reason:
            'Venituri din salarii și asimilate realizate în anul fiscal cel puțin egale cu 6 salarii minime brute: diferența de contribuție până la baza de 6 salarii minime brute nu se datorează (art. 174 alin. (7) lit. a) din Codul fiscal). Contribuția de 10 % pe venitul net rămâne datorată.',
        };
      }
      // CF art. 174 alin. (7) lit. b): other art. 155 alin. (1) lit. c)-h) income at least equal to
      // 6 SM also removes the top-up. The profile records WHICH such incomes exist but the app holds no
      // amount for any of them, so the condition cannot be tested. It is reported as undecided —
      // assuming it satisfied would invent a relief, assuming it failed would invent a liability.
      if (profile.otherIncome.length > 0) {
        return {
          applicability: 'unknown',
          reason:
            'Profilul declară și alte venituri din art. 155 alin. (1) lit. c)-h), iar art. 174 alin. (7) lit. b) din Codul fiscal elimină diferența de la alin. (6) doar dacă acele venituri sunt cel puțin egale cu 6 salarii minime brute pe țară. Aplicația nu deține cuantumul lor, deci nu poate stabili condiția — nu o presupune nici îndeplinită, nici neîndeplinită.',
        };
      }
      // The state every payload written before TASK 5 lands in: a pensioner status is recorded, but the
      // receipt fact art. 174 alin. (7) lit. c) actually tests is not. The relief is neither granted on
      // the status nor refused on its absence — the missing fact is named.
      if (facts.receiptGapNote) {
        return { applicability: 'unknown', reason: facts.receiptGapNote };
      }
      return { applicability: 'applicable' };
    }

    case 'vat-art-310': {
      // The plafon only decides anything while the taxpayer is NOT already in the VAT system. A
      // profile that applies VAT (`vatExempt: false`) has already passed the registration test, so the
      // row would otherwise report a duty that has already been discharged.
      if (!profile.vatExempt) {
        return {
          applicability: 'not_applicable',
          reason:
            'Profilul aplică TVA (nu se află în scutirea de TVA): obligația de înregistrare în scopuri de TVA prevăzută de art. 310 alin. (1) din Codul fiscal a intervenit deja, deci acest plafon nu mai decide nicio obligație.',
        };
      }
      return { applicability: 'applicable' };
    }
  }
}

/** A `salariul minim` vintage carried by the rule package. */
interface SmVintage {
  valueBani: Bani;
  act: string;
  from: string;
}

/**
 * The SM value the package anchors the annual multiples to — the `reference` parameter of the
 * wage-reference rule (4.050 lei, HG 1506/2024 for 2026). Read from the package, never hardcoded
 * here, so the label cannot drift from the figures the thresholds are built from.
 */
function smReference(rules: FiscalRule[], taxYear: number): { valueBani: Bani; act: string } | null {
  const rule = rules.find(
    (r) => r.taxYear === taxYear && r.taxRegime === 'wage-reference' && r.parameters.some((p) => p.id === 'reference'),
  );
  const param = rule?.parameters.find((p) => p.id === 'reference');
  if (!rule || typeof param?.value !== 'number') return null;
  return { valueBani: param.value as Bani, act: rule.sourceAct };
}

/** Every SM vintage the package carries for the fiscal year — the H1/H2 pair, with its acts. */
function smVintages(rules: FiscalRule[], taxYear: number): SmVintage[] {
  return readMinimumWageVintages(rules, taxYear).map((v) => ({
    valueBani: v.valueBani,
    act: v.act,
    from: v.from,
  }));
}

/**
 * TASK 8 — the minimum-wage vintages the rule package carries for a fiscal year, with the window each
 * one is in force over.
 *
 * `smVintages` above is the threshold row's view: value, act, start date. The legislation surface also
 * needs the end of the window, because „în vigoare acum” and „a fost înlocuită în cursul anului” are
 * different statements, and because the one that matters for this user is the one that started
 * mid-year — the one that does NOT re-anchor the year.
 *
 * Read from the package, never hardcoded: the same two rules the threshold rows already measure
 * against (HG 1506/2024 from 2026-01-01, HG 146/2026 from 2026-07-01 for FY2026).
 */
export interface MinimumWageVintage {
  valueBani: Bani;
  act: string;
  from: string;
  to: string | null;
}

export function readMinimumWageVintages(
  rules: FiscalRule[],
  taxYear: number,
): MinimumWageVintage[] {
  return rules
    .filter((r) => r.taxYear === taxYear && r.taxRegime === 'wage-reference')
    .filter((r) => r.parameters.some((p) => p.id === 'monthly'))
    .map((r) => {
      const param = r.parameters.find((p) => p.id === 'monthly')!;
      return {
        valueBani: param.value as Bani,
        act: r.sourceAct,
        from: r.effectiveFrom,
        to: r.effectiveTo,
      };
    })
    .sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * Build the "this lei amount is computed, not statutory" label for an SM-multiple threshold.
 *
 * It is attached only when the arithmetic actually verifies against the package's own SM value: a
 * label that does not check out would be a fabricated provenance, which is worse than no label. The
 * `thresholds.test.ts` guard makes a drift fail a test instead of silently dropping the label.
 */
function computedLeiFor(
  spec: ThresholdSpec,
  thresholdValue: Bani,
  smRef: { valueBani: Bani; act: string } | null,
  vintages: SmVintage[],
  taxYear: number,
): ComputedLeiAmount | undefined {
  if (spec.statutorySmMultiplier === undefined || smRef === null) return undefined;
  if (smRef.valueBani * spec.statutorySmMultiplier !== thresholdValue) return undefined;
  const list = vintages.map((v) => `${formatBaniLei(v.valueBani)} de la ${v.from} (${v.act})`).join('; ');
  return {
    multiplier: spec.statutorySmMultiplier,
    smValueBani: smRef.valueBani,
    smAct: smRef.act,
    note:
      `Codul fiscal exprimă acest prag în multipli de salariu minim brut pe țară, nu în lei; suma în lei este calculată de aplicație. ` +
      `Nivelul de referință care guvernează pragurile pentru ${taxYear} nu este verificat — salariul minim purtat de pachetul de reguli: ${list}.`,
  };
}

/** Stated on an unmeasured row instead of a legal consequence: nothing may be claimed about a side the app never measured. */
const UNMEASURED_CONSEQUENCE =
  'Efectul acestui prag nu poate fi stabilit: baza de calcul prevăzută de lege nu a fost măsurată.';

export function computeThresholds(
  rules: FiscalRule[],
  query: ThresholdQuery,
): FiscalThreshold[] {
  const applicable = selectApplicableRules(rules, {
    taxYear: query.taxYear,
    asOfDate: query.asOfDate,
  });

  // TASK 4: the SM anchor is read from the package (not from `applicable`, which is filtered by
  // asOfDate and would hide the 1 iulie vintage in a March query) so the computed-amount label can
  // state every vintage the fiscal year carries.
  const smRef = smReference(rules, query.taxYear);
  const vintages = smVintages(rules, query.taxYear);

  const results: FiscalThreshold[] = [];
  for (const spec of THRESHOLD_SPECS) {
    const rule = applicable.find((r) => r.ruleId === spec.ruleId);
    if (!rule) continue;
    const param = rule.parameters.find((p) => p.id === spec.paramId);
    if (!param || typeof param.value !== 'number') continue;

    // Phase 10: a `unit: 'lei'` rule parameter is an integer number of bani, so the threshold, the
    // distance and the warning band are all `Bani` and compare against a `Bani` base without a conversion.
    const thresholdValue = param.value as Bani;
    // Presentation band only — 10% of the threshold, chosen by the app. Not a statutory
    // figure and deliberately never given a citation.
    //
    // This used to be `thresholdValue * 0.1`, a float multiply: 486000 * 0.1 is 48600.000000000004 in
    // IEEE-754, which is how a purely presentational band acquired a fraction of a ban. Every stored
    // threshold is a whole leu, so dividing its bani by 10 is exact; the floor only guards a future
    // parameter that is not, and it can never widen the band past 10%.
    const warningDistance = Math.floor(thresholdValue / 10) as Bani;
    const computedFrom = computedLeiFor(spec, thresholdValue, smRef, vintages, query.taxYear);

    const currentValue = query.bases[spec.requiredFiscalBase];
    const applicability = applicabilityFor(spec, query.profile, currentValue, thresholdValue);
    if (currentValue === undefined) {
      // A base mismatch used to `continue`, silently deleting a threshold card. It is now a
      // loud row: the threshold is citable, but it cannot be measured, so no verdict is faked.
      const status: ThresholdStatus = 'review_required';
      results.push({
        thresholdId: spec.thresholdId,
        type: spec.type,
        currentValue: null,
        thresholdValue,
        distance: lei(0),
        affectedDomain: spec.affectedDomain,
        affectedTax: spec.affectedTax,
        effectiveDate: rule.effectiveFrom,
        warningDistance,
        ruleRelease: query.ruleRelease,
        source: `${rule.sourceAct} ${rule.sourceArticle}`,
        status,
        fiscalBase: spec.requiredFiscalBase,
        kind: spec.kind,
        // `engaged` is meaningless without a measurement: distance is a placeholder 0, and a
        // `registration` row would read `engagedSide(0) === true` out of nothing. Force it false.
        engaged: false,
        severity: severityFor({
          applicability: applicability.applicability,
          status,
          distance: lei(0),
          warningDistance,
        }),
        applicability: applicability.applicability,
        applicabilityReason: applicability.reason,
        measuredBasis: 'unmeasured',
        consequence: UNMEASURED_CONSEQUENCE,
        computedFrom,
        reviewReason: `Baza „${spec.requiredFiscalBase}” nu a fost furnizată; pragul nu poate fi evaluat.`,
      });
      continue;
    }

    const distance = subBani(currentValue, thresholdValue);
    const engaged = engagedSide(spec.type, distance);
    const status = statusFor(spec.type, distance, warningDistance, spec.kind);
    results.push({
      thresholdId: spec.thresholdId,
      type: spec.type,
      currentValue,
      thresholdValue,
      distance,
      affectedDomain: spec.affectedDomain,
      affectedTax: spec.affectedTax,
      effectiveDate: rule.effectiveFrom,
      warningDistance,
      ruleRelease: query.ruleRelease,
      source: `${rule.sourceAct} ${rule.sourceArticle}`,
      status,
      fiscalBase: spec.requiredFiscalBase,
      kind: spec.kind,
      engaged,
      severity: severityFor({
        applicability: applicability.applicability,
        status,
        distance,
        warningDistance,
      }),
      applicability: applicability.applicability,
      applicabilityReason: applicability.reason,
      measuredBasis: query.measuredBasis?.[spec.requiredFiscalBase] ?? 'unattributed',
      // Chosen by which SIDE of the level the measured value sits on, not by `engagedSide`: for a
      // `min-base` row the two are opposite, and the law's consequence follows the side, not the
      // arithmetic label. Below 12 SM the CAS obligation never arises; at/above it it does.
      consequence: distance < 0 ? spec.consequenceBelow : spec.consequenceAtOrAbove,
      computedFrom,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Ratio-based threshold rules (Step 29 — additive)
//
// The dashboard snapshot represents fiscal limits (CAS, CASS, VAT, income tax)
// as ratio-based rules of the shape produced by `src/data/dashboard.ts`:
// `{ id, label, current, limit, ratio, breached }`. This section names that
// shape (`RatioRule`) and adds explicit `status` semantics on top of the
// existing `breached` flag, which is kept exactly as-is for backward
// compatibility.
// ---------------------------------------------------------------------------

/** Explicit three-state status derived from a ratio rule. */
export type RatioRuleStatus = 'ok' | 'warning' | 'breached';

/**
 * A ratio-based fiscal threshold rule.
 *
 * - `limit === 0` means "no cap": the rule is breached only when
 *   `current > 0` (encoded by the caller in `breached`), and `ratio` stays
 *   `null` because a percentage of a zero limit is undefined.
 * - `limit > 0`: `ratio` is `current / limit`; `breached` is `current >= limit`.
 *
 * `status` is optional so existing rule values (which predate Step 29 and
 * carry no `status`) remain assignable; use `withRatioRuleStatus` to derive it.
 */
export interface RatioRule {
  id: string;
  label: string;
  current: Bani;
  limit: Bani;
  /** Backward-compatible flag — kept exactly as-is, never re-derived. */
  breached: boolean;
  /** `current / limit`, or `null` when `limit === 0` (no cap). */
  ratio: number | null;
  /** Derived status (Step 29); see `statusForRatioRule`. */
  status?: RatioRuleStatus;
}

/**
 * Derive the explicit status of a ratio rule:
 *
 * 1. `breached` → `'breached'` (the flag always wins, unchanged semantics).
 * 2. `ratio !== null && ratio >= 0.8` → `'warning'` (close to the limit).
 * 3. otherwise → `'ok'`.
 *
 * Zero-limit rule ("no cap"): `limit === 0` means `ratio` is `null`, so a
 * non-breached zero-limit rule is always `'ok'`; a zero-limit rule is
 * `'breached'` only when `current > 0` (which the caller encodes as
 * `breached: true`).
 */
export function statusForRatioRule(rule: RatioRule): RatioRuleStatus {
  if (rule.breached) return 'breached';
  // Zero-limit rule: no cap, ratio is null — never warns, only breaches.
  if (rule.limit === 0) return 'ok';
  if (rule.ratio !== null && rule.ratio >= 0.8) return 'warning';
  return 'ok';
}

/**
 * Return a copy of `rule` with the derived `status` attached. The input is
 * not mutated and the `breached` flag is preserved exactly as-is.
 */
export function withRatioRuleStatus<T extends RatioRule>(rule: T): T & { status: RatioRuleStatus } {
  return { ...rule, status: statusForRatioRule(rule) };
}
