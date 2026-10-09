/**
 * TASK 8 — copy for the attention surfaces: the record items that finally surface, the link that
 * opens them, and the three epistemic states of the tax estimate.
 *
 * Every sentence here states only what the record itself holds. A rejected document carries its own
 * `statusDetail` (`CUI nevalid`, `Document neconform`) and that string is interpolated verbatim; where
 * the record holds no reason, the sentence says only what the status says and invents nothing. The
 * declaration item says the app has **no recorded submission date**, not that the declaration was not
 * filed — the app cannot see what happened at ANAF.
 */
import { formatRoCalendarDate } from '../../domain/date';

/** A record reference is data (an invoice number, `2026-06`); the date is formatted, never re-stated. */
const at = (iso: string): string => formatRoCalendarDate(iso);

export const attention = {
  /** Link text for an attention item that points at something. */
  openTarget: 'Deschide',
  /** The reference carried on the link, so the person knows which record they are being sent to. */
  recordReference: (reference: string): string => `înregistrarea ${reference}`,

  titles: {
    rejectedRevenue: (reference: string): string => `Document de venit respins: ${reference}`,
    rejectedExpense: (reference: string): string => `Document de cheltuială respins: ${reference}`,
    awaitingRevenue: (reference: string): string => `Transmitere în așteptare: ${reference}`,
    notSubmittedDeclaration: (reference: string): string =>
      `Declarație fără depunere înregistrată: ${reference}`,
  },

  descriptions: {
    /**
     * The rejection reason is the record's own `statusDetail`, quoted. The second sentence is a fact
     * about this app's arithmetic, not a legal claim: `aggregation.ts` sums only records whose status
     * is `inregistrata`, so a rejected record is out of the totals until it is corrected.
     */
    rejectedRevenue: (reference: string, date: string, reason: string | null): string =>
      `Documentul ${reference} din ${at(date)} este respins${reason ? `: ${reason}` : ''}. Cât timp rămâne respins, suma nu intră în totalurile înregistrate.`,
    rejectedExpense: (reference: string, date: string, reason: string | null): string =>
      `Documentul ${reference} din ${at(date)} este respins${reason ? `: ${reason}` : ''}. Cât timp rămâne respins, cheltuiala nu intră în cheltuielile deductibile.`,
    awaitingRevenueWithStatus: (reference: string, date: string, status: string): string =>
      `Documentul ${reference} din ${at(date)} are starea e-Factura „${status}”. Transmiterea nu este confirmată, deci suma nu intră în totalurile înregistrate.`,
    awaitingRevenue: (reference: string, date: string): string =>
      `Documentul ${reference} din ${at(date)} este în așteptare. Transmiterea nu este confirmată, deci suma nu intră în totalurile înregistrate.`,
    /**
     * What the app holds: a registration date and no submission date. It does not hold the filing
     * itself, so the sentence cannot say the declaration was not filed — only that nothing records it.
     */
    notSubmittedDeclaration: (reference: string, registeredOn: string): string =>
      `Declarația pentru ${reference} este înregistrată în aplicație din ${at(registeredOn)}, dar nu are nicio dată de depunere înregistrată.`,
  },

  actions: {
    rejectedWithReason: (reason: string): string =>
      `Corectează motivul („${reason}”) și înregistrează din nou documentul.`,
    rejected: 'Verifică de ce a fost respins documentul și înregistrează-l din nou.',
    awaiting: 'Verifică statusul transmiterii în SPV.',
    notSubmitted: 'Înregistrează data depunerii sau depune declarația.',
  },
} as const;

/**
 * The three epistemic states of the tax estimate. They are not three spellings of one number: a
 * computed figure, a conclusion the engine withheld, and the absence of any calculation are different
 * claims, and each gets its own word, its own badge and its own sentence.
 */
export const estimateState = {
  badges: {
    computed: 'Calculat',
    review_required: 'De verificat',
    unavailable: 'Indisponibil',
  },
  computed: 'Estimare calculată pe datele înregistrate acum.',
  /**
   * The refusal reason itself is rendered once, in the chart note under the figure, where it is pinned
   * by name (`e2e/dashboard.spec.ts`, the B-14 describe). Repeating the same cited paragraph in the
   * hero would put two copies of a legal sentence on one screen.
   */
  reviewRequired:
    'Motorul de calcul a refuzat estimarea pe datele înregistrate. Cauza este redată integral la graficul financiar.',
  unavailable:
    'Niciun calcul nu este disponibil pentru aceste date — cifra lipsește, nu este zero.',
} as const;
