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
 * The epistemic states of the tax estimate, widened by PG-1.
 *
 * They are not several spellings of one number: a computed figure, a figure that does not cover what
 * was recorded, a conclusion the engine withheld, and the absence of any calculation are different
 * claims, and each gets its own word, its own badge and its own sentence. `refused` got its trigger in
 * PG-6a — the scenario registry, and nothing else.
 *
 * B-79 removed `closed_final`. It had a word and no producer: `estimateStateOf` never returns it, and
 * the only existing fact that could have driven it — `year.closed` — does not mean what the word says.
 * A closed year can still carry an `incomplete` or a `refused` estimate, and PG-4 already renders the
 * closed-year fact in three places (`YearLifecycleBanner`, the hero's `finalCalculation` label and the
 * disclosure's `finalCalculationNote`). Triggering it would have replaced a true distinction with a
 * coarser one; deleting it is the honest move. The reason is recorded on the B-79 row of
 * `docs/ai/PHASE_PLAN_11_34.md`.
 */
export const estimateState = {
  badges: {
    complete: 'Calculat',
    incomplete: 'Estimare incompletă',
    review_required: 'De verificat',
    refused: 'Nu putem calcula',
    unavailable: 'Indisponibil',
  },
  complete: 'Estimare calculată pe datele înregistrate acum, care acoperă tot ce este înregistrat.',
  /**
   * PG-1 — the figure is real and the register is not empty; what is missing is coverage. The count is
   * the number of records left out, so the sentence never claims a defect it cannot enumerate.
   */
  incompleteOne: 'Estimarea nu acoperă tot ce ai înregistrat: o înregistrare rămâne în afara cifrei.',
  incompleteMany: (n: number): string =>
    `Estimarea nu acoperă tot ce ai înregistrat: ${n} înregistrări rămân în afara cifrei.`,
  /**
   * B-106 — the refusal reason is rendered here, beside the figure that is missing, in the engine's own
   * words. It used to be rendered only in the chart note further down the page while this sentence pointed
   * at it: a person reading the hero saw a refusal announced and a direction to walk in. The chart points
   * here instead now, exactly as it already points for a scenario refusal, so the cited paragraph still
   * reaches the screen once and where the missing figure is.
   */
  reviewRequired:
    'Motorul de calcul a refuzat estimarea pe datele înregistrate. Refuzul lui, în cuvintele lui:',
  /**
   * B-28 — what the hero prints where a figure should be. `—` is this app's token for „not known yet”,
   * and it is honest only while a figure could still arrive. A refusal is not a number still coming: the
   * engine ran and withheld the conclusion, or the rules never let it run. Both get their own word, so
   * the figure slot stops being one glyph standing for two opposite situations.
   */
  noFigure: {
    review_required: 'Calcul refuzat',
    refused: 'Calcul refuzat',
  },
  /**
   * PG-6a — the state a scenario refusal carries, and the one word the hero is allowed to say when no
   * number exists. It is not a softer `De verificat`: `review_required` means an engine ran and withheld
   * a conclusion, `refused` means the calculation was never allowed to run. The cause and the control
   * that fixes it are rendered in the hero itself — not deferred to the chart the way a withheld
   * conclusion is — because there is no figure on screen for the reader to be confused about.
   */
  refused:
    'Nu există nicio cifră de verificat: calculul nu a fost permis de regulile acestui an fiscal. Motivul și unde se corectează sunt mai jos.',
  unavailable:
    'Niciun calcul nu este disponibil pentru aceste date — cifra lipsește, nu este zero.',
} as const;
