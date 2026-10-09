/**
 * TASK 7 — copy for the dashboard surface: the cockpit, the estimate hero, the chart, the summary,
 * the insights, the reserve card and the five lower sections.
 *
 * Sentences that state a legal fact (a threshold consequence, an insight description, a tax line
 * label, the projection basis explanation) are produced by `src/domain` and `src/data` with their
 * citations and stay there — see the boundary note in `common.ts`.
 */
import type { Insight } from '../../domain/insights';
import type { ActionItem, LegislationItem } from '../../data/dashboard';
import type { Deadline, DeadlineEventType } from '../../domain/deadlines';
import type { MoneyPrecisionNotice } from '../../data/migration';

export const dashboard = {
  title: 'Tablou de bord',
  fiscalYearPrefix: 'An fiscal',
  updatedAt: '· actualizat la',
  greeting: 'Bună,',
  onboarding: {
    title: 'Începe înregistrarea activității',
    body: 'Adaugă prima factură de venit și prima cheltuială pentru a vedea estimarea taxelor, termenele limită și recomandarea de rezervă lunară.',
    addRevenue: 'Adaugă un venit',
    addExpense: 'Adaugă o cheltuială',
  },
  cards: {
    revenueYear: 'Venituri PFA (an)',
    taxEstimate: 'Impozit estimat',
    taxEstimateHint: 'de pus deoparte',
    monthlyReserve: 'Rezervă lunară',
    remainingToSetAside: 'Rămâne de pus deoparte',
    completeness: 'Date complete',
    checksHint: 'verificări',
  },
  estimate: {
    title: 'Estimare impozit',
    completenessPrefix: 'Date complete:',
    /** Split around the interpolated monthly amount so the figure keeps its own node. */
    setAsideLead: 'Impozit estimat de pus deoparte. Pune deoparte',
    setAsideTail: 'pe lună.',
  },
} as const;

export const chart = {
  title: 'Grafic financiar',
  rangeGroupAria: 'Interval afișat',
  monthSelectAria: 'Lună selectată',
  projectedLegend: 'Proiecție (linia punctată)',
  /** The chart's own accessible description; `{range}` is the range caption. */
  imageAria: (range: string): string =>
    `Grafic ${range} — venituri, cheltuieli și profit net în lei; segmente solide = realizat, segmente punctate = proiecție.`,
  tableCaption: (range: string): string =>
    `Grafic financiar — interval ${range}. Perioadă, venituri, cheltuieli, profit net (lei) și stare (realizat/proiecție).`,
  columns: {
    period: 'Perioadă',
    revenue: 'Venituri',
    expenses: 'Cheltuieli',
    net: 'Profit net',
  },
  ranges: {
    monthly: 'Lunar',
    ytd: 'YTD',
    annual: 'An',
  },
  /** Whether a point is money that happened or money assumed. */
  state: {
    actual: 'Realizat',
    projected: 'Proiecție',
  },
  metrics: {
    revenue: 'Venituri',
    expenses: 'Cheltuieli',
    net: 'Profit net',
  },
  /** The estimate is not computed: say so, then give the engine's reason. */
  taxNoteReview: 'Estimare impozit: revizuire necesară —',
} as const;

export const summary = {
  title: 'Rezumat',
  revenue: 'Venituri',
  expenses: 'Cheltuieli',
  net: 'Profit net',
} as const;

export const insights = {
  title: 'Observații',
  empty: 'Ești la zi. Nu există probleme de rezolvat în momentul de față.',
  severityLabels: {
    info: 'Info',
    warning: 'Atenție',
    danger: 'Urgent',
  } satisfies Record<Insight['severity'], string>,
} as const;

export const reserve = {
  title: 'Rezervă fiscală',
  inputLabel: 'Cât ai pus deoparte pentru impozit (lei)',
  inputPlaceholder: 'ex: 1500',
  clear: 'Șterge înregistrarea',
  refusedAmount: 'Suma nu este o valoare validă în lei — nimic nu a fost salvat.',
  noEstimate: 'Nu există o estimare fiscală disponibilă — rezerva recomandată nu poate fi calculată.',
  recommendedMonthly: 'Recomandat de pus deoparte lunar',
  remainingLead: 'Rămâne de pus deoparte',
  remainingMonthsTail: (months: number): string => `în următoarele ${months} luni.`,
  fullyCovered: 'Rezerva este complet acoperită.',
  alreadyReserved: 'Rezervat deja',
  nothingRecorded: 'Nicio sumă înregistrată.',
  estimatedLiability: 'Estimare obligație fiscală',
} as const;

export const actions = {
  title: 'Ce trebuie să faci',
  emptyDescription: 'Nimic nu necesită atenția ta în acest moment.',
  emptyBody: 'Totul este la zi — nimic nu necesită atenție.',
  /**
   * The old wording counted these with the English `item`, which is a calque; Romanian counts them as
   * `element` and agrees the plural with the numeral. Re-pinned in `ActionSection.test.tsx` and
   * `e2e/dashboard.spec.ts`.
   */
  count: (n: number): string => `${n} ${n === 1 ? 'element de rezolvat' : 'elemente de rezolvat'}`,
  sourceLabels: {
    deadline: 'Termen limită',
    completeness: 'Completitudine',
    tax: 'Impozit',
  } satisfies Record<ActionItem['source'], string>,
} as const;

/**
 * Labels for the deadline `appliesTo` keys the rule package can emit. `ActionSection` and
 * `DeadlineSection` used to keep two different wordings for the same key; they share this map now.
 * `copy.guard.test.ts` pins the key list so a new rule key without a label fails the suite instead
 * of printing the raw key.
 */
export const deadlineAppliesToLabels: Record<string, string> = {
  pfa: 'PFA',
  new_pfa: 'PFA nou',
  'vat-registered-pfa': 'PFA înregistrat în scop de TVA',
  cas_annual: 'CAS anual',
  cass_annual: 'CASS anual',
  vat_periodic: 'TVA periodic',
  vat_registration: 'Înregistrare în scop de TVA',
};

/** The action list's shorter form of the same key. */
export const actionAppliesToLabels: Record<string, string> = {
  pfa: 'PFA',
  new_pfa: 'PFA nou',
  'vat-registered-pfa': 'Înregistrare în scop de TVA',
  cas_annual: 'CAS anual',
  cass_annual: 'CASS anual',
  vat_periodic: 'TVA periodic',
  vat_registration: 'Înregistrare în scop de TVA',
};

export const deadlines = {
  title: 'Termene limită',
  descriptionLead: 'Termene limită viitoare de depunere, la data de',
  empty: 'Niciun termen limită viitor',
  notApplicable: 'Neaplicabil',
  oneDayLeft: '1 zi rămasă',
  daysLeft: (n: number): string => `${n} zile rămase`,
  statusLabels: {
    active: 'Activ',
    not_applicable: 'Neaplicabil',
  } satisfies Record<Deadline['status'], string>,
  eventLabels: {
    d212_filing: 'Depunere D212',
    vat_registration: 'Înregistrare TVA',
  } satisfies Record<DeadlineEventType, string>,
} as const;

export const completeness = {
  title: 'Completitudine date',
  ofWord: 'din',
  checksSatisfied: 'verificări îndeplinite',
  empty: 'Nicio verificare de completitudine',
  satisfiedBadge: 'Complet',
  unsatisfiedBadge: 'Lipsă',
} as const;

/**
 * Display labels for the completeness check keys the data layer emits. The raw keys
 * (`profile`, `income`, …) are internal names; `checkLabel` is the only place that turns one into
 * Romanian. The fallback to the raw key stays for a key this map has never seen — no check may be
 * dropped — and `copy.guard.test.ts` fails if a key the data layer emits is missing here.
 */
export const CHECK_LABELS: Record<string, string> = {
  profile: 'Profil',
  income: 'Venituri înregistrate',
  expenses: 'Cheltuieli înregistrate',
  clients: 'Clienți',
  documents: 'Documente',
  companyDocuments: 'Documente de firmă',
  declarations: 'Declarații',
  statements: 'Declarații fiscale',
  taxEstimate: 'Estimare impozit',
};

export function checkLabel(key: string): string {
  return CHECK_LABELS[key] ?? key;
}

export const legislation = {
  title: 'Legislație',
  empty: 'Nicio modificare viitoare verificată.',
  cardTitleCurrent: 'Modificare legislativă care te afectează',
  cardTitleUpcoming: 'Modificare viitoare',
  source: 'Sursă',
  published: 'Publicat',
  effectiveFrom: 'În vigoare de la',
  state: 'Stare',
  affectedArea: 'Zonă afectată',
  statusLabels: {
    CURRENT: 'În vigoare',
    UPCOMING: 'Viitoare',
  } satisfies Record<LegislationItem['status'], string>,
} as const;

export const moneyPrecision = {
  collectionLabels: {
    revenues: 'venituri',
    expenses: 'cheltuieli',
    declarations: 'declarații',
    profile: 'profil',
    snapshot: 'calcul salvat',
  } satisfies Record<MoneyPrecisionNotice['collection'], string>,
  noun: (n: number): string => (n === 1 ? 'valoare' : 'valori'),
  /**
   * The headline agrees in number and carries the article a Romanian reader expects: „O sumă…" for
   * one, „Sumele…" for more than one — not „2 sume…", which reads as a bare noun with no article.
   * The count itself is stated by the sentence that follows, which is where it agrees with a noun
   * anyway („2 valori au fost rotunjite").
   */
  headline: (n: number): string =>
    n === 1 ? 'O sumă nu a putut fi reprodusă exact.' : 'Sumele nu au putut fi reproduse exact.',
  /**
   * „la banul cel mai apropiat (0,01 lei)", not „la leul cel mai apropiat": the conversion rounds to
   * 0,01 lei, while rounding to a whole leu is CF art. 66 alin. (1) and happens only at the three
   * tax lines. Saying „leu" here would overstate what happened to the money by 100×.
   */
  adjusted: (n: number): string =>
    n === 1
      ? `${n} ${moneyPrecision.noun(n)} a fost rotunjită la banul cel mai apropiat (0,01 lei), jumătate în jos — aceeași direcție pe care o folosește art. 66 alin. (1).`
      : `${n} ${moneyPrecision.noun(n)} au fost rotunjite la banul cel mai apropiat (0,01 lei), jumătate în jos — aceeași direcție pe care o folosește art. 66 alin. (1).`,
  carried: (n: number): string =>
    n === 1
      ? `${n} ${moneyPrecision.noun(n)} nu este un număr valid și a fost păstrată neschimbată, nu înlocuită cu 0.`
      : `${n} ${moneyPrecision.noun(n)} nu sunt numere valide și au fost păstrate neschimbate, nu înlocuite cu 0.`,
  nothingDeleted: 'Nicio sumă nu a fost ștearsă.',
  storedValueTail: 'lei (așa cum a fost salvat) →',
  keptUnchanged: 'păstrată neschimbată',
} as const;
