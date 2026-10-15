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
 * (`// e.g. 'pfa-revenue'`), not a union — so there is no union for TypeScript to check coverage against.
 * B-74 moved the fallback that used to sit inline in `ThresholdSection.tsx` (line 111, cited as 92 in the
 * old comment) into `thresholdDomainLabel` below, so there is exactly one place that decides what an
 * unknown domain key renders — and it renders the RAW key, the way `deadlineLabelFor` and `checkLabel`
 * do, because a plausible generic is how a new key ships unnamed. `src/ui/copy/labels.test.ts` pins it.
 * Closing `affectedDomain` to a union in the domain would let this map become `Record<AffectedDomain,
 * string>` and delete the fallback — a domain change, so it is still not made here.
 *
 * **B-55 changed what is not here.** The `consequence` and `applicabilityReason` sentences are still legal
 * conclusions produced by `src/domain/thresholds.ts` with a citation attached. The `reviewReason` for an
 * unmeasured basis is not: it interpolated `spec.requiredFiscalBase`, a machine enum, straight into a
 * Romanian sentence, so the person read `Baza „net-income” nu a fost furnizată`. The sentence now lives
 * here as `unmeasuredBasisReason`, keyed by the same `FiscalBase` code the domain already uses — the copy
 * layer had no slot for that family, so one was added rather than hand-translating a second dictionary at
 * the call site.
 */
import type { CapBase } from '../../domain/fiscal/deductibility';
import type {
  FiscalBase,
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
 * `string` in the domain (see the header), so this is `Record<string, string>` by necessity and
 * `thresholdDomainLabel` below keeps a raw-key fallback. One key is emitted today.
 *
 * B-74: this is now the only spelling of these words. `src/domain/insights.ts` carried a second map with
 * the same `'pfa-revenue': 'Venit PFA'` row, which the copy guard's duplicate check cannot see because it
 * scans `src/ui/copy/**` only.
 */
export const thresholdDomainLabels: Record<string, string> = {
  'pfa-revenue': 'Venit PFA',
};

/**
 * The label for one affected-domain key.
 *
 * An unknown key renders its RAW key. It used to render 'Prag fiscal' — a plausible generic that made a
 * threshold nobody had named look named, and `src/domain/insights.test.ts` was green because of it. A raw
 * key on screen is ugly in a way the reader notices, and `src/ui/copy/labels.test.ts` fails on it before
 * it ships. Same contract as `deadlineLabelFor` and `checkLabel`; this is the third member of that family
 * and the last one that had not been migrated.
 */
export function thresholdDomainLabel(key: string): string {
  return thresholdDomainLabels[key] ?? key;
}

/**
 * What each fiscal base the threshold specs can require actually counts (B-55).
 *
 * `FiscalBase` is a machine-readable union in `src/domain/thresholds.ts`, and until now nothing spelled it
 * in Romanian — so the one sentence that interpolated it printed the enum. Keyed by the same code the
 * domain uses, and exhaustive over the union, so a new base is a compile error here rather than a word
 * nobody wrote.
 */
export const fiscalBaseLabels: Record<FiscalBase, string> = {
  'revenue-incl-vat': 'venitul încasat cu TVA',
  'revenue-excl-vat': 'venitul fără TVA',
  'expense-incl-vat': 'cheltuiala cu TVA',
  'expense-excl-vat': 'cheltuiala fără TVA',
  'net-income': 'venitul net',
};

/**
 * The review reason for a threshold whose base was never supplied.
 *
 * Produced here rather than in the domain because it is language, not a legal conclusion: it carries no
 * citation and asserts nothing about the law, it says a number is missing. The domain still decides WHEN
 * to show it; it no longer decides how it reads, which is what put `net-income` on a person's screen.
 */
export function unmeasuredBasisReason(base: FiscalBase): string {
  return `Baza „${fiscalBaseLabels[base]}” nu a fost furnizată; pragul nu poate fi evaluat.`;
}

/**
 * B-138 — what each `CapBase` a deductibility rule can name actually measures, in Romanian.
 *
 * The same B-55 leak in the other identifier family: `estimateBasis.ts unresolvedCapDetail` interpolated
 * `cap.base` straight into a sentence, so a person read `Plafonul se calculează pe baza
 * „annual_eur_per_person”`. Keyed by the same code the domain uses and exhaustive over the union, so a
 * sixth base is a compile error here rather than a word nobody wrote. The legal sentences that follow this
 * one stay in the domain — they carry citations and decide what the app may claim — but naming a datum in
 * Romanian is language, not a legal conclusion.
 */
export const capBaseLabels: Record<CapBase, string> = {
  expense_itself: 'cheltuiala însăși',
  art68_alin6_base: 'baza de calcul de la art. 68 alin. (6)',
  gross_income: 'venitul brut',
  annual_salary_expense: 'valoarea anuală a cheltuielilor cu salariile personalului',
  annual_eur_per_person: 'un plafon anual exprimat în euro pe persoană',
};

/**
 * B-138 — the opening of the sentence that names an unmeasurable cap base. The domain supplies the
 * article and decides when the sentence is said; the wording of the base is here, so the enum never
 * reaches the screen.
 */
export function capBaseSentence(base: CapBase, article: string): string {
  return `Plafonul se calculează pe baza „${capBaseLabels[base]}” (${article})`;
}

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
