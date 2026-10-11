/**
 * TASK 7 — copy for the *Praguri* section.
 *
 * The label maps are typed as `Record<Union, string>`, which is what makes "never render an enum"
 * structural instead of a convention: TypeScript has to see a wording for every member of the union,
 * so a new member is a compile error rather than a row that prints `review_required` on screen. The
 * `?? rawValue` fallbacks that used to sit in `ThresholdSection.tsx` / `DeadlineSection.tsx` /
 * `LegislationSection.tsx` / `checkLabels.ts` are the leak path, and they are gone.
 *
 * **One map is not exhaustive, and says so.** `thresholdDomainLabels` is keyed by
 * `FiscalThreshold.affectedDomain`, which `src/domain/thresholds.ts` declares as an open `string`
 * (`// e.g. 'pfa-revenue'`), not a union — so there is no union for TypeScript to check coverage
 * against, and `ThresholdSection.tsx:92` still has a `?? t.affectedDomain` fallback for a key this map
 * does not know. That fallback is the leak path this file's header otherwise claims is gone; it stays
 * only because the domain key is open. Closing `affectedDomain` to a union in the domain would let this
 * map become `Record<AffectedDomain, string>` and delete the fallback — a domain change, so TASK 7 did
 * not make it.
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
 *
 * `'annual-projected'` is gone from the union it keys, and its wording went with it. A label kept for a
 * member nothing can emit is a sentence waiting to be attached to a number that no longer exists.
 *
 * `annual-actual` has to carry its own denial. D-PROJ-1's unresolved half is that a mid-year reader can
 * take a threshold result as settled for the whole year; naming the quantity as realised money, with no
 * annualisation, is what keeps the row from implying an answer it does not have.
 */
export const measuredBasisLabels: Record<MeasuredBasis, string> = {
  'annual-actual': 'venit net anual realizat — încasări încasate și plăți plătite, fără annualizare',
  'ytd-turnover': 'cifra de afaceri înregistrată de la începutul anului',
  unattributed: 'bază măsurată, dar fără origine declarată',
  unmeasured: 'bază nemăsurată',
};

/**
 * Labels for the affected-domain keys. **Not** exhaustive over a union: `affectedDomain` is an open
 * `string` in the domain (see the header), so this is `Record<string, string>` by necessity and the
 * call site keeps a raw-key fallback. One key is emitted today.
 */
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
  /**
   * PG-5C — the date the measured value was measured at. A threshold compared against a register read
   * at a date is only meaningful together with that date, and D-PROJ-1 asks for the figure to be
   * labelled with it. It states no conclusion about the rest of the year.
   */
  measuredAt: (asOf: string): string => `Valoare măsurată la data de ${asOf}.`,
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

/**
 * The `kind` of a row, in words — TASK 8 renders severity from `severity`, not from these.
 * `over_limit` is the 72-SM ceiling on the CASS base (CF art. 170 alin. (1)), which is the same concept
 * the row caption calls `Prag maxim` in `thresholdRowLabels['max-base']`. One concept, one name, because
 * both can appear on one screen. It stays distinct from the `min-base` rows — crossing this one caps a
 * base, it never raises a minimum (research 24, must-not-state 7).
 */
export const thresholdKindLabels: Record<FiscalThreshold['kind'], string> = {
  registration: 'prag de înregistrare',
  tier_transition: 'treaptă de calcul',
  over_limit: 'prag maxim',
  informational: 'informare',
};
