/**
 * TASK 7 — copy for the *Praguri* section.
 *
 * The label maps are typed as `Record<Union, string>`, which is what makes "never render an enum"
 * structural instead of a convention: TypeScript has to see a wording for every member of the union,
 * so a new member is a compile error rather than a row that prints `review_required` on screen. The
 * `?? rawValue` fallbacks that used to sit in `ThresholdSection.tsx` / `DeadlineSection.tsx` /
 * `LegislationSection.tsx` / `checkLabels.ts` are the leak path, and they are gone.
 *
 * What is NOT here: the `consequence`, `applicabilityReason` and `reviewReason` sentences. Those are
 * legal conclusions produced by `src/domain/thresholds.ts` with a citation attached, and
 * `thresholds.language.test.ts` pins their wording at the site that produces them.
 */
import type {
  FiscalThreshold,
  MeasuredBasis,
  ThresholdStatus,
  ThresholdType,
} from '../../domain/thresholds';

export const thresholdStatusLabels: Record<ThresholdStatus, string> = {
  ok: 'În limite',
  warning: 'Atenție',
  breached: 'Depășit',
  // An unmeasured row is not a safe row: it gets its own words rather than folding into „În limite".
  review_required: 'De verificat',
};

/**
 * Which quantity the row measured. The contribution rows and the VAT row are measured on different
 * bases on purpose (CF art. 148 / 170 / 174 measure an annual value, art. 310 alin. (1) measures the
 * turnover realised so far), so the two labels must never be merged into one.
 */
export const measuredBasisLabels: Record<MeasuredBasis, string> = {
  'annual-projected': 'venit net anual estimat pentru întreg anul',
  'annual-actual': 'venit net anual înregistrat până acum (fără proiecție disponibilă)',
  'ytd-turnover': 'cifra de afaceri înregistrată de la începutul anului',
  unattributed: 'bază măsurată, dar fără origine declarată',
  unmeasured: 'bază nemăsurată',
};

/** Labels for the affected-domain keys. Exhaustive over the keys the data layer emits. */
export const thresholdDomainLabels: Record<string, string> = {
  'pfa-revenue': 'Venit PFA',
};

/**
 * Row captions. `tier-floor` is a rung of a ladder, never a ceiling — the wording must not read as a
 * maximum (research 24, must-not-state 1-4 and 7).
 */
export const thresholdRowLabels: Record<ThresholdType, (tax: string) => string> = {
  'min-base': (tax) => `Prag minim ${tax}`,
  'max-base': (tax) => `Prag maxim ${tax}`,
  registration: (tax) => `Prag de înregistrare ${tax}`,
  income: (tax) => `Prag de venit ${tax}`,
  'tier-floor': (tax) => `Treaptă de calcul ${tax}`,
};

export const thresholds = {
  title: 'Praguri',
  description: 'Praguri fiscale față de valorile curente',
  empty: 'Niciun prag',
  current: 'Curent:',
  threshold: 'Prag:',
  distance: 'Distanță:',
  measuredBasis: 'Bază măsurată:',
  notApplicable: 'Nu se aplică:',
  applicabilityUnknown: 'Aplicabilitate nesigură:',
  /**
   * The lei amount the law expresses as a multiple of salariul minim. Split in two fragments so the
   * amount keeps its own `<strong>` node (the shape the e2e and the component tests match on).
   */
  computedAmountLead: (multiplier: number): string =>
    `Sumă calculată de aplicație: ${multiplier} × salariul minim de`,
  computedAmountTail: (act: string, note: string): string => `(${act}). ${note}`,
  /**
   * The 10 % band is this app's presentation policy. It is stated as policy and never acquires a
   * citation — pinned by `ThresholdSection.test.tsx` and by the TASK 4 language test.
   */
  warningBandPolicy:
    'Bandă de avertizare la 10 % din prag — politică de afișare a aplicației, nu o prevedere legală.',
} as const;

/** The `kind` of a row, in words — TASK 8 renders severity from `severity`, not from these. */
export const thresholdKindLabels: Record<FiscalThreshold['kind'], string> = {
  registration: 'prag de înregistrare',
  tier_transition: 'treaptă de calcul',
  over_limit: 'plafon',
  informational: 'informare',
};
