/**
 * TASK 7 — copy for the dashboard surface: the cockpit, the estimate hero, the chart, the summary,
 * the insights, the reserve card and the five lower sections.
 *
 * Sentences that state a legal fact (a threshold consequence, an insight description, a tax line
 * label, the projection basis explanation) are produced by `src/domain` and `src/data` with their
 * citations and stay there — see the boundary note in `common.ts`.
 */
import type { AttentionSource } from '../../domain/attention';
import type { CoverageReason } from '../../domain/estimateBasis';
import type { LegislationItem } from '../../data/dashboard';
import type { Deadline, DeadlineEventType } from '../../domain/deadlines';
import type { MoneyPrecisionNotice } from '../../data/migration';

export const dashboard = {
  title: 'Tablou de bord',
  fiscalYearPrefix: 'An fiscal',
  updatedAt: '· actualizat la',
  greeting: 'Bună,',
  /**
   * Phase 11: the block that stood here is **deleted, not reworded.** Its title said
   * „Începe înregistrarea activității” and it rendered as a page that replaced the dashboard. A profile
   * with no records is not a first run — the profile exists, the registers do not — and a deadline does not
   * stop existing because the ledger is empty (B-68). `noRecords` below reports the absence while the page
   * keeps rendering; the first run itself is `pages/Onboarding.tsx`, with its own copy in
   * `ui/copy/onboarding.ts`.
   */
  /**
   * Phase 11 — the zero-record state, which is NOT the first-run state.
   *
   * B-68 is the standing name for what the old gate did: `Dashboard.tsx` gated the whole page on
   * `pfaRevenue > 0`, so a ledger whose records were all excluded — foreign amounts with no rate, records
   * with a non-registered status — rendered the "go and record something" card and the deadlines,
   * thresholds and completeness card disappeared with it. A record the totals leave out is still a
   * record. The card below now sits ABOVE the sections instead of replacing them: with nothing recorded
   * the person still gets the next deadline, the profile completeness and what to do next.
   */
  noRecords: {
    title: 'Nicio înregistrare de venit sau cheltuială',
    body: 'Estimarea nu se poate calcula fără documente, dar termenele, pragurile și completitudinea profilului se afișează și acum.',
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
    /**
     * Phase 11 — the hero's own incomplete-profile state. It is driven by the `profile` check of
     * `assessCompleteness`, the same report the completeness card renders, so the hero cannot disagree
     * with the card the way a second predicate would.
     */
    completeProfile: 'Completează profilul',
    completeProfileBody:
      'Profilul încă nu are faptele obligatorii. Fără ele estimarea rămâne neîndeplinită în loc să fie aproximată.',
    /**
     * PG-1 — the coverage rows under the hero figure. One row per reason group, never one row per
     * record: a profile with nine uncategorised invoices has one thing to fix, not nine screens of
     * noise. The count, the amount that left the figure and the link to the first record of the group
     * are all data the estimate already carries.
     */
    coverage: {
      title: 'Ce nu intră în estimare',
      /** Exhaustive over `CoverageReason`: a new reason is a compile error here, not a raw token on screen. */
      reasonLabels: {
        unclassified: 'fără categorie',
        undetermined: 'regulă fără faptă consemnată',
        asset_not_modelled: 'mijloc fix fără registru de amortizare',
        missing_fx_rate: 'fără curs BNR înregistrat',
        cap_unresolved: 'plafon care nu poate fi măsurat',
        non_deductible: 'nu este deductibilă prin lege',
        rejected: 'document respins',
        pending: 'transmitere în așteptare',
        fact_missing: 'faptă de profil care lipsește',
      } satisfies Record<CoverageReason, string>,
      countOne: 'o înregistrare',
      countMany: (n: number): string => `${n} înregistrări`,
      open: 'Deschide înregistrarea',
      /**
       * Stated because the amount beside a `missing_fx_rate` row is not a lei figure — the app holds no
       * rate, so it holds no lei equivalent either. Saying „lei” about it would invent the very number
       * whose absence the row reports.
       */
      amountUnitNote: 'sumele sunt în unitatea în care a fost înregistrată fiecare sumă',
    },
    /**
     * PG-4 — a closed fiscal year is not a projection, and the hero must not read like one. The figure
     * is the year's own actuals, so it is named as a final calculation and dated, and the run-rate
     * explanation is replaced rather than kept as a footnote.
     */
    finalCalculation: (year: number): string => `Calcul final pentru ${year}`,
    finalCalculationNote: (asOf: string): string =>
      `Anul fiscal s-a încheiat. Cifrele de mai jos sunt calculate din înregistrările reale, la data de ${asOf}. Nu sunt o rată de desfășurare și nu se mai modifică odată cu trecerea zilelor.`,
  },
  /**
   * PG-4 (D-YEAR-1) — the year lifecycle banner.
   *
   * The sentence about missing rules is the whole point of the banner: a year with no rule package
   * yields no figure, and the banner says why instead of letting the cockpit show an em dash or a
   * number carried over from the previous year. It claims nothing about when the rules will arrive.
   */
  year: {
    advanced: (year: number): string => `Anul fiscal a fost avansat automat la ${year}.`,
    rulesMissing: (year: number): string => `Regulile pentru ${year} nu sunt încărcate.`,
    rulesMissingBody:
      'Aplicația nu calculează cu regulile unui alt an fiscal și nu afișează nicio cifră pentru acest an până când regulile lui sunt încărcate. Cifrele anului încheiat rămân disponibile.',
    switchTo: (year: number): string => `Vezi anul fiscal ${year}`,
    closedArchive: (year: number): string => `Anul fiscal ${year} este încheiat; cifrele lui sunt finale.`,
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

/**
 * TASK 8 — the observations surface. The severity words moved to `copy.severity`
 * (`ui/copy/provenance.ts`, the four-level scale TASK 7 supplied), and the empty sentence went with
 * the empty card: a section with nothing to say is not mounted at all, so there is no large empty
 * card to caption.
 */
export const insights = {
  title: 'Observații',
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
  /**
   * Every attention source has a label, and the map is exhaustive over `AttentionSource`, so a new
   * family is a compile error here rather than a raw key on screen.
   */
  sourceLabels: {
    deadline: 'Termen limită',
    completeness: 'Completitudine',
    tax: 'Impozit',
    revenue: 'Venit',
    expense: 'Cheltuială',
    declaration: 'Declarație',
    threshold: 'Prag fiscal',
    reserve: 'Rezervă fiscală',
    integrity: 'Integritatea datelor',
  } satisfies Record<AttentionSource, string>,
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

/**
 * PG-5 — what a deadline row IS, named for the taxpayer rather than for the rule's audience key.
 *
 * `deadlineAppliesToLabels` above answers „cui i se aplică?” and stays a chip. This answers „ce
 * termen este?” for the action row, and it takes the tax year because a return is identified by the
 * year it declares: „Termen depășit: PFA” told a taxpayer that something was late without saying what,
 * and the D212 row used to read exactly that way.
 *
 * Replaces `actionAppliesToLabels`, which was the same seven keys spelled a third time and had no call
 * site — the B-70 shape (one idea, several spellings) in the language layer.
 */
export const deadlineLabels: Record<string, (taxYear: number) => string> = {
  pfa: (taxYear) => `Declarația unică (D212) pentru ${taxYear}`,
  new_pfa: () => 'Declarația unică a unui PFA nou',
  'vat-registered-pfa': () => 'Înregistrare în scop de TVA',
  cas_annual: () => 'Declarație și plată CAS',
  cass_annual: () => 'Declarație și plată CASS',
  vat_periodic: () => 'Declarație periodică de TVA',
  vat_registration: () => 'Înregistrare în scop de TVA',
};

/**
 * The label for one deadline row.
 *
 * An unknown key renders its RAW key. It used to render 'Termen fiscal', a plausible generic that
 * made a brand-new obligation look handled; a raw key on screen is ugly in a way the reader notices,
 * and `src/ui/copy/labels.test.ts` fails on it before it can ship.
 */
export function deadlineLabelFor(appliesTo: string, taxYear: number): string {
  const phrase = deadlineLabels[appliesTo];
  return phrase ? phrase(taxYear) : appliesTo;
}

/**
 * B-35, in one sentence with one home. The completeness check and the Termene limită card both say
 * this, and they say it with the same words: the obligation exists, and the facts that would fix its
 * period (CF art. 322 alin. (1)-(4)) are not in the record.
 */
export const vatFilingPeriodUnknown =
  'Perioada de depunere nu poate fi stabilită — completează data înregistrării în TVA și venitul de TVA pe anul precedent (CF art. 322 alin. (1)-(4)).';

export const deadlines = {
  title: 'Termene limită',
  descriptionLead: 'Termene limită viitoare de depunere, la data de',
  empty: 'Niciun termen limită viitor',
  notApplicable: 'Neaplicabil',
  oneDayLeft: '1 zi rămasă',
  daysLeft: (n: number): string => `${n} zile rămase`,
  /** PG-5: a term the record already discharges says so, instead of going quiet. */
  doneBadge: 'Depusă',
  filedOn: (date: string): string => `Depusă pe ${date}`,
  /** PG-5 / B-35: the section for terms the rules resolved but the facts cannot date. */
  undatedLead: 'Termen a cărui perioadă nu poate fi stabilită',
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
  /**
   * PG-1 — the weighted half. The counts say how many kinds of fact are present; this says how much of
   * the recorded money the estimate actually describes. The percentage is floored, never rounded up.
   */
  amountLead: 'Din sumele înregistrate, intră în estimare',
  /** Shown instead of a percentage when nothing is recorded — a share of nothing is not 0%. */
  amountNothingRecorded: 'Nicio sumă înregistrată de ponderat.',
  /**
   * Why the denominator is not a lei total: a record with no recorded rate has no lei amount, and the
   * app would have to invent one to weigh it in lei. It is weighed in the unit it was written in, and
   * the card says so rather than letting the figure read as a lei ratio.
   */
  amountNote:
    'se ponderază sumele așa cum sunt înregistrate; o sumă în valută fără curs nu are echivalent în lei de ponderat',
} as const;

/**
 * Display labels for the completeness check keys the data layer emits. The raw keys
 * (`profile`, `income`, …) are internal names; `checkLabel` is the only place that turns one into
 * Romanian. The fallback to the raw key stays for a key this map has never seen — no check may be
 * dropped — and `copy.guard.test.ts` fails if a key the data layer emits is missing here.
 *
 * `taxEstimate` is gone with the check it labelled: PG-1 removed the check that asked whether an
 * estimate had been calculated and counted that as evidence the estimate was complete.
 */
export const CHECK_LABELS: Record<string, string> = {
  profile: 'Profil',
  income: 'Venituri înregistrate',
  expenses: 'Cheltuieli înregistrate',
  clients: 'Clienți',
  documents: 'Documente',
  companyDocuments: 'Documente de firmă',
  /**
   * PG-5: `declarations` is gone with the check it labelled — „any declaration record exists” was
   * satisfied by a monthly row for any year and unsatisfied forever on a profile that had correctly
   * filed nothing yet. `annualFiling` asks about the return this fiscal year owes.
   */
  annualFiling: 'Declarația unică (D212)',
  vatFilingPeriod: 'Perioada de depunere TVA',
  statements: 'Declarații fiscale',
};

export function checkLabel(key: string): string {
  return CHECK_LABELS[key] ?? key;
}

export const legislation = {
  title: 'Legislație',
  /**
   * TASK 8 — the honesty fix. `getLegislationState` sits on a placeholder boundary: there is no
   * ingestion at all, so the section has never verified anything. „Nicio modificare viitoare
   * verificată.” read as reassurance to a user who has no monitor: it stated the negative of a
   * question nobody asked. The section now says what is absent — the monitor — not what is absent
   * from the world.
   */
  monitorUnavailable:
    'Monitorul de modificări legislative nu este activ: aplicația nu verifică nicio sursă, deci nu poate spune nici că există o modificare, nici că nu există.',
  monitorActive: 'Modificări legislative verificate de aplicație.',
  monitorLabel: 'Monitor',
  /** What the section CAN report without a monitor: what the app's own rule package carries. */
  fromRulePackage: 'Din pachetul de reguli pe care îl folosește calculul',
  impactLabel: 'Efect pentru tine',
  affectsLabels: {
    yes: 'Te afectează',
    no: 'Nu te afectează în acest an fiscal',
    unknown: 'Efectul nu este stabilit de nicio prevedere verificată',
  },
  /**
   * The minimum-wage case. The amount is stated as what the hotărâre de Guvern sets, with the act
   * attached — it is not a Cod fiscal multiple, so it is not a computed lei amount either.
   */
  minimumWageSummary: (value: string, from: string, act: string): string =>
    `Salariul minim brut pe țară este ${value} de la ${from} (${act}).`,
  minimumWageArea: 'Salariul minim brut pe țară',
  /**
   * The vintage the year is actually anchored to. Stated because it is the reason the other one does
   * not move anything: the thresholds on this screen are measured against this value.
   */
  minimumWageAnchor: (taxYear: number, citation: string, from: string): string =>
    `Pragurile anului ${taxYear} sunt calculate pe această valoare, pentru că ${citation} ia în calcul salariul minim în vigoare la 1 ianuarie a anului de realizare a venitului (${from}).`,
  /**
   * The part that is the whole point: whether it changes anything for THIS user. It does not
   * re-anchor the fiscal year, and the sentence names the provision that fixes the anchor.
   */
  minimumWageNoImpact: (taxYear: number, citation: string): string =>
    `Nu recalcalează pragurile anului ${taxYear}: ${citation} ia în calcul valoarea în vigoare la 1 ianuarie a anului de realizare a venitului, indiferent de valorile folosite în cursul anului. Pragurile rămân calculate pe valoarea de la 1 ianuarie.`,
  /**
   * The card title states only what the item is. It used to read „Modificare legislativă care te
   * afectează”, which asserted the impact before anything in the app had established one — and for the
   * one real case in the rule store the assertion was false. The impact is its own field now.
   */
  cardTitleCurrent: 'Modificare legislativă în vigoare',
  cardTitleUpcoming: 'Modificare viitoare',
  source: 'Sursă',
  published: 'Publicat',
  effectiveFrom: 'În vigoare de la',
  state: 'Stare',
  affectedArea: 'Zonă afectată',
  statusLabels: {
    CURRENT: 'În vigoare',
    UPCOMING: 'Viitoare',
    PAST: 'A fost în vigoare',
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
