/**
 * PG-6g — the VAT filing calendar and the record of what was filed.
 *
 * ## Three different kinds of obligation, not one list of dates
 *
 * The brief is explicit that these must not collapse into a single date list, and art. 322/323 give them
 * three different generators:
 *
 * 1. **The decont** — art. 323 alin. (1): „pentru fiecare perioadă fiscală, un decont de taxă, până la
 *    data de 25 inclusiv a lunii următoare celei în care se încheie perioada fiscală respectivă". The
 *    formula is the same monthly and quarterly; what differs is the period it is applied to. **The
 *    consequence the brief flags is the fourth quarter:** Q4 2026 ends 31 December, so its term is
 *    **25 ianuarie 2027** — a date in the following calendar year, not „the 25th after the quarter" in the
 *    same year. research/33 §10 pins exactly this.
 * 2. **The declarație de mențiuni until 25 ianuarie** — art. 322 alin. (6). A recurring duty owed by those
 *    quarterly „potrivit alin. (2) și (5)", carrying the preceding year's turnover and the statement that
 *    no intra-community goods acquisitions were made. **It is not a decont and must not be modelled as
 *    one**, and note who is *not* named: alin. (3) and alin. (4) are absent from alin. (6), so a person
 *    whose quarterly status comes from the registration-year estimate does not owe it for that year.
 * 3. **The 5-working-day AIC duty** — art. 322 alin. (8): a mențiuni declaration within „maximum 5 zile
 *    lucrătoare de la finele lunii în care intervine exigibilitatea achiziției intracomunitare".
 *
 * Payment is not a fourth kind: art. 326 alin. (1) makes the payment date the filing date („până la data
 * la care are obligația depunerii unuia dintre deconturile sau declarațiile prevăzute la art. 323 și
 * 324"), so each obligation carries its own `paymentDueOn` equal to its term rather than a second date.
 *
 * ## Why these rows are not produced by the rule registry
 *
 * Every other deadline in this app comes from a `taxRegime: 'deadlines'` rule in `fiscal/package2026.ts`,
 * registered in `fiscal/release2026.ts`. This phase may not touch `release2026.ts`, and `registry.ts`
 * refuses a release whose `ruleIds` and rule set do not match in both directions — so a new deadline rule
 * cannot be added without editing a file this brief put off-limits. The calendar is therefore generated
 * here, from the article, with the citation carried on each row. Recorded as a boundary deviation in
 * `docs/ai/phases/45_pg6g_form300.md`.
 *
 * ## What is deliberately NOT encoded
 *
 * - **No holiday calendar for the 5-working-day term.** Reg. (CEE, Euratom) 1182/71 art. 2 alin. (2)
 *   defines a working day as „toate zilele, altele decât zilele de sărbători legale, duminicile și
 *   sâmbetele" (research/19 Q1). The app holds no list of sărbători legale, so only Saturdays and Sundays
 *   are skipped and the omission is stated on the row rather than silently ignored.
 * - **No term is ever backfilled.** An absent filing record means none was recorded, never that none was
 *   made.
 * - **No claim that anything was or will be filed for the user.** B-56 is open precisely because success
 *   messages already promise operations that do not happen; nothing here submits anything.
 */
import type { Bani } from '../money';
import { formatBani } from '../money';
import { isISOCalendarDate } from '../date';
import type { VatPeriodicity } from './vatPeriodicity';

// ── 1. The fiscal period ─────────────────────────────────────────────────────────

/**
 * A fiscal period under art. 322.
 *
 * `partial` exists because of art. 322 alin. (7) lit. b): when a quarterly person makes a taxable
 * intra-community acquisition of goods in the **second** month of a quarter, the first two months of that
 * quarter become „o perioadă fiscală distinctă" with their own decont under art. 323 alin. (1). Modelling
 * that as "just a quarter" would drop an obligation; modelling it as two months would invent one.
 */
export type VatFiscalPeriod =
  | { kind: 'month'; year: number; month: number }
  | { kind: 'quarter'; year: number; quarter: number }
  | { kind: 'partial'; year: number; fromMonth: number; toMonth: number };

export const DAY_MS = 86_400_000;

function isoFromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function utcMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

export function periodStart(p: VatFiscalPeriod): string {
  if (p.kind === 'month') return `${p.year}-${String(p.month).padStart(2, '0')}-01`;
  if (p.kind === 'quarter') return `${p.year}-${String((p.quarter - 1) * 3 + 1).padStart(2, '0')}-01`;
  return `${p.year}-${String(p.fromMonth).padStart(2, '0')}-01`;
}

export function periodEnd(p: VatFiscalPeriod): string {
  const lastMonth = p.kind === 'month' ? p.month : p.kind === 'quarter' ? p.quarter * 3 : p.toMonth;
  const days = new Date(Date.UTC(p.year, lastMonth, 0)).getUTCDate();
  return `${p.year}-${String(lastMonth).padStart(2, '0')}-${String(days).padStart(2, '0')}`;
}

/**
 * art. 323 alin. (1) — „până la data de 25 inclusiv a lunii următoare celei în care se încheie perioada
 * fiscală respectivă".
 *
 * The month rollover is the whole point for the fourth quarter: a period ending in December is due on
 * 25 **January of the next year**. Anything that renders these terms must not assume the term and the
 * period share a calendar year.
 */
export function decontTerm(p: VatFiscalPeriod): string {
  const end = periodEnd(p);
  const year = Number(end.slice(0, 4));
  const month = Number(end.slice(5, 7));
  return month === 12
    ? `${year + 1}-01-25`
    : `${year}-${String(month + 1).padStart(2, '0')}-25`;
}

export function periodLabel(p: VatFiscalPeriod): string {
  if (p.kind === 'month') return `${String(p.month).padStart(2, '0')}.${p.year}`;
  if (p.kind === 'quarter') return `T${p.quarter} ${p.year}`;
  return `${String(p.fromMonth).padStart(2, '0')}-${String(p.toMonth).padStart(2, '0')}.${p.year}`;
}

/** The ordinary periods of a calendar year under a given periodicity. */
export function vatFiscalPeriods(periodicity: VatPeriodicity, year: number): VatFiscalPeriod[] {
  if (periodicity === 'quarter') {
    return [1, 2, 3, 4].map(q => ({ kind: 'quarter', year, quarter: q }));
  }
  return Array.from({ length: 12 }, (_, i) => ({ kind: 'month' as const, year, month: i + 1 }));
}

/**
 * art. 322 alin. (7) — where a taxable intra-community goods acquisition lands inside a quarter.
 *
 * The three letters give three different answers, and only one of them creates a distinct period:
 * - lit. a) exigibilitatea in month 1 → monthly from month 1; no distinct period.
 * - lit. b) exigibilitatea in month 2 → months 1–2 become a distinct fiscal period with its own decont,
 *   and month 3 is already monthly.
 * - lit. c) exigibilitatea in month 3 → the current quarter is untouched; monthly starts with the first
 *   month of the NEXT quarter.
 */
export type AicFlip = {
  quarter: number;
  letter: 'a' | 'b' | 'c';
  /** The periods that replace the quarter from that quarter onwards. */
  periods: VatFiscalPeriod[];
  note: string;
};

export function aicFlipForQuarter(year: number, quarter: number, monthOfExigibility: number): AicFlip | null {
  const first = (quarter - 1) * 3 + 1;
  const offset = monthOfExigibility - first;
  if (offset < 0 || offset > 2) return null;
  if (offset === 0) {
    return {
      quarter,
      letter: 'a',
      periods: [
        { kind: 'month', year, month: first },
        { kind: 'month', year, month: first + 1 },
        { kind: 'month', year, month: first + 2 },
      ],
      note: 'art. 322 alin. (7) lit. a): exigibilitatea în prima lună a trimestrului → luna calendaristică de la prima lună; nicio perioadă distinctă.',
    };
  }
  if (offset === 1) {
    return {
      quarter,
      letter: 'b',
      periods: [
        { kind: 'partial', year, fromMonth: first, toMonth: first + 1 },
        { kind: 'month', year, month: first + 2 },
      ],
      note: 'art. 322 alin. (7) lit. b): primele două luni ale trimestrului constituie o perioadă fiscală distinctă, cu decont propriu conform art. 323 alin. (1).',
    };
  }
  return {
    quarter,
    letter: 'c',
    periods: [{ kind: 'quarter', year, quarter }],
    note: 'art. 322 alin. (7) lit. c): exigibilitatea în a treia lună → trimestrul în curs rămâne neatins; luna calendaristică începe cu prima lună a trimestrului următor.',
  };
}

// ── 2. The three obligations ─────────────────────────────────────────────────────

export type VatObligationKind = 'decont' | 'mentiuni_annuale' | 'mentiuni_achizitie';

export interface VatObligation {
  /** Stable id, used as the row key and as the join to a filing record. */
  id: string;
  kind: VatObligationKind;
  /** The calendar year the obligation belongs to — for a Q4 decont this is the year of the PERIOD. */
  year: number;
  /** The term itself. */
  dueOn: string;
  /** art. 326 alin. (1): the payment is due the same day as the filing. */
  paymentDueOn: string;
  citation: string;
  /** What the obligation IS, in Romanian. */
  label: string;
  /** The period a decont covers; absent for the two mențiuni duties, which are not deconturi. */
  period?: VatFiscalPeriod;
  /** Set when the 5-working-day term could not account for sărbători legale. */
  holidayCaveat?: string;
  /** Set when an exception in the article could not be checked against the record. */
  exceptionNote?: string;
}

/**
 * The deconturi for a year, one per fiscal period.
 *
 * `throughAsOf` limits the list to periods that have already closed on or before the as-of date, so the
 * surface does not present a decont for a period still running. It never drops a closed period whose term
 * has passed — an overdue decont is exactly what the surface has to show.
 */
export function decontObligations(
  periodicity: VatPeriodicity,
  year: number,
  opts: { flips?: readonly AicFlip[]; closedThrough?: string } = {},
): VatObligation[] {
  const flips = opts.flips ?? [];
  const periods: VatFiscalPeriod[] = [];
  for (const p of vatFiscalPeriods(periodicity, year)) {
    const flip = p.kind === 'quarter' ? flips.find(f => f.quarter === p.quarter) : undefined;
    if (flip) periods.push(...flip.periods);
    else periods.push(p);
  }
  return periods
    .map(p => ({
      id: `decont-${periodLabel(p).replace(/\s+/g, '-')}`,
      kind: 'decont' as const,
      year,
      dueOn: decontTerm(p),
      paymentDueOn: decontTerm(p),
      citation: 'CF art. 323 alin. (1); plată art. 326 alin. (1)',
      label: `Decont de taxă pe TVA ${periodLabel(p)}`,
      period: p,
    }))
    .filter(o => {
      if (!opts.closedThrough) return true;
      if (!o.period) return true;
      return utcMs(periodEnd(o.period)) <= utcMs(opts.closedThrough);
    });
}

/**
 * art. 322 alin. (6) — the declarație de mențiuni until 25 ianuarie.
 *
 * Returns `null` when this person does not owe it, and says why. The two exclusions are in the article
 * itself and both have to be honoured:
 * - it is owed by those quarterly „potrivit alin. (2) și (5)" — **alin. (3) and alin. (4) are not named**,
 *   so a quarterly status that came from the registration-year estimate or the registration-year annualised
 *   actual does not carry this duty for that year;
 * - „Fac excepție … persoanele impozabile care solicită scoaterea din evidența persoanelor înregistrate în
 *   scopuri de TVA conform art. 316, în vederea aplicării regimului special de scutire prevăzut la
 *   art. 310."
 */
export function annualMentiuniObligation(input: {
  year: number;
  quarterlyUnder: 'alin2' | 'alin5' | 'alin3' | 'alin4' | null;
  requestingArt310Return: boolean;
  /**
   * True when the dataset cannot say whether the art. 316→art. 310 return was requested. The obligation is
   * still emitted — the duty exists unless the taxpayer exercised the exception — but the row says the
   * exception was not checked, rather than implying that it was.
   */
  art310ReturnUnknown?: boolean;
}): VatObligation | null {
  if (input.quarterlyUnder === null) return null;
  if (input.quarterlyUnder === 'alin3' || input.quarterlyUnder === 'alin4') return null;
  if (input.requestingArt310Return) return null;
  const dueOn = `${input.year}-01-25`;
  return {
    id: `mentiuni-25-ianuarie-${input.year}`,
    kind: 'mentiuni_annuale',
    year: input.year,
    dueOn,
    paymentDueOn: dueOn,
    citation: 'CF art. 322 alin. (6)',
    label:
      `Declarație de mențiuni până la 25 ianuarie ${input.year}: cifra de afaceri din ${input.year - 1} și `
      + 'mențiunea că nu ai efectuat achiziții intracomunitare de bunuri în anul precedent. Nu este un decont.',
    ...(input.art310ReturnUnknown
      ? {
          exceptionNote:
            'Art. 322 alin. (6) ultima teză scutește persoana care cere scoaterea din evidența persoanelor '
            + 'înregistrate conform art. 316, în vederea aplicării regimului de scutire de la art. 310. '
            + 'Aplicația nu are înregistrată nicio astfel de cerere, deci obligația este afișată ca '
            + 'existentă; dacă ai făcut cererea, excepția se aplică și termenul nu există.',
        }
      : {}),
  };
}

/**
 * art. 322 alin. (8) — „în termen de maximum 5 zile lucrătoare de la finele lunii în care intervine
 * exigibilitatea achiziției intracomunitare".
 *
 * Working days are counted per Reg. (CEE, Euratom) 1182/71 art. 2 alin. (2) as anything that is not a
 * Saturday or a Sunday — **sărbători legale are NOT subtracted, because the app holds no holiday list**.
 * That is stated on the row rather than left out, because a term that silently ignores a public holiday is
 * a term shown too early, and the taxpayer would see a false margin.
 */
export function addWorkingDays(fromExclusive: string, days: number): { date: string; skippedWeekendDays: number } {
  let cursor = utcMs(fromExclusive);
  let added = 0;
  let skipped = 0;
  while (added < days) {
    cursor += DAY_MS;
    const weekday = new Date(cursor).getUTCDay();
    if (weekday === 0 || weekday === 6) { skipped += 1; continue; }
    added += 1;
  }
  return { date: isoFromUtc(cursor), skippedWeekendDays: skipped };
}

export function aicMentiuniObligation(input: {
  year: number;
  monthOfExigibility: number;
}): VatObligation | null {
  if (input.monthOfExigibility < 1 || input.monthOfExigibility > 12) return null;
  const lastDay = new Date(Date.UTC(input.year, input.monthOfExigibility, 0)).getUTCDate();
  const monthEnd = `${input.year}-${String(input.monthOfExigibility).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const { date, skippedWeekendDays } = addWorkingDays(monthEnd, 5);
  return {
    id: `mentiuni-aic-${input.year}-${String(input.monthOfExigibility).padStart(2, '0')}`,
    kind: 'mentiuni_achizitie',
    year: input.year,
    dueOn: date,
    paymentDueOn: date,
    citation: 'CF art. 322 alin. (8)',
    label:
      `Declarație de mențiuni în maximum 5 zile lucrătoare de la 31.${String(input.monthOfExigibility).padStart(2, '0')}.${input.year} `
      + '(finele lunii în care a intervenit exigibilitatea achiziției intracomunitare de bunuri).',
    holidayCaveat:
      `Termenul a fost numărat sărind doar sâmbăta și duminica (${skippedWeekendDays} zile); aplicația nu are `
      + 'nicio listă de sărbători legale, iar Reg. (CEE, Euratom) 1182/71 art. 2 alin. (2) definește ziua '
      + 'lucrătoare ca orice zi care nu este sărbătoare legală, duminică sau sâmbătă. Verifică sărbătorile.',
  };
}

// ── 3. Where 6f's numbers land — the D300 lines ──────────────────────────────────

/**
 * The D300 lines the claimable-VAT figure touches.
 *
 * research/42 §7 is unambiguous that this is **not one number on one line**:
 * - **rd. 30** „TOTAL TAXĂ DEDUCTIBILĂ (sumă de la rd. 20 până la rd. 28, cu excepția rd. 20.1, 22.1, 26.1, 26.2)";
 * - **rd. 33** „Regularizări taxă dedusă" — corrections „conform art. 297 și 298 … sau art. 298 și 300 …
 *   în cazul persoanelor impozabile cu regim mixt";
 * - **rd. 34** „Ajustări conform pro-rata / ajustări de taxă".
 *
 * The 50 % vehicle cut and the pro rata therefore land **partly inside rd. 20–28 and partly on rd. 33/34**.
 * Presenting `claimableTotal` under a single rubric would be the defect the brief names, so the layout
 * below is a list of lines with what may and may not be placed on each, and no line is given a computed
 * value the app cannot attribute to it.
 *
 * This is a **line layout, not a facsimile of the form** — the brief says so outright. Form 300 is approved
 * by OPANAF nr. 174/2026 (MO I 105/09.02.2026), „se completează de persoanele impozabile înregistrate în
 * scopuri de TVA conform art. 316", with the new model from the first fiscal period of 2026.
 */
export interface D300Line {
  row: string;
  title: string;
  citation: string;
  /** What the app may place here, or why it places nothing. */
  appTreatment: string;
}

export const D300_DEDUCTIBLE_LINES: readonly D300Line[] = [
  {
    row: 'rd. 20–28',
    title: 'Taxă deductibilă pe categorii de achiziții',
    citation: 'OPANAF 174/2026, formular 300; CF art. 323 alin. (2)',
    appTreatment:
      'Aici intră cota de 50 % din TVA pentru vehiculele limitate de art. 298 alin. (1) și achizițiile '
      + 'claimable. Aplicația nu repartizează pe literele rd. 20–28: aceeași linie din registru nu poartă '
      + 'indicativul rubricii, deci orice repartizare ar fi o atribuire inventată.',
  },
  {
    row: 'rd. 30',
    title: 'TOTAL TAXĂ DEDUCTIBILĂ (sumă de la rd. 20 până la rd. 28, cu excepția rd. 20.1, 22.1, 26.1, 26.2)',
    citation: 'OPANAF 174/2026, formular 300',
    appTreatment:
      'Totalul calculat de aplicație (research/42 §7) se așază aici NUMAI pentru partea claimable rămasă '
      + 'în rd. 20–28. Nu este egal cu totalul calculat, pentru că regularizările și pro-rata ies din rd. 20–28.',
  },
  {
    row: 'rd. 33',
    title: 'Regularizări taxă dedusă',
    citation: 'CF art. 304; OPANAF 174/2026, formular 300',
    appTreatment:
      'Aici ar intra regularizările pentru bunuri capitalizate și pentru vehiculele trecute în regim mixt. '
      + 'Aplicația calculează grafia de regularizare (art. 305) dar nu a aplicat nicio regularizare la niciun '
      + 'total — PG-6f a lăsat acest lucru neimplementat, deci rubrica rămâne fără valoare.',
  },
  {
    row: 'rd. 34',
    title: 'Ajustări conform pro-rata / ajustări de taxă',
    citation: 'CF art. 300 alin. (14); OPANAF 174/2026, formular 300',
    appTreatment:
      'Cota pro-rata declarată se aplică linie cu linie în decizia de deductibilitate, dar ajustarea '
      + 'anuală definită de art. 300 alin. (14) nu este calculată. Rubrica rămâne fără valoare.',
  },
];

/**
 * The three parked lists from PG-6f, kept parked.
 *
 * D-VAT-3's mitigations are part of the decision, not optional: a line whose deductibility is unresolved
 * is excluded from the total and listed separately. Folding one into a line total would be the exact
 * failure the decision was taken to prevent.
 */
export interface ParkedVatGroup {
  reason: string;
  count: number;
  amountBani: Bani;
  /** Why it is parked, in Romanian, with the rule that leaves it open. */
  why: string;
}

export function parkedGroups(
  lines: readonly { tvaBani: Bani; outcome: { kind: string; reason?: string } }[],
  whyFor: (reason: string) => string,
): ParkedVatGroup[] {
  const byReason = new Map<string, { count: number; amount: Bani }>();
  for (const l of lines) {
    if (l.outcome.kind !== 'unresolved' && l.outcome.kind !== 'deferred' && l.outcome.kind !== 'zero') continue;
    const reason = l.outcome.reason ?? l.outcome.kind;
    const prev = byReason.get(reason) ?? { count: 0, amount: 0 as Bani };
    byReason.set(reason, { count: prev.count + 1, amount: (prev.amount + l.tvaBani) as Bani });
  }
  return [...byReason.entries()].map(([reason, v]) => ({
    reason,
    count: v.count,
    amountBani: v.amount,
    why: whyFor(reason),
  }));
}

/** The one sentence the surface may put beside a computed VAT figure. */
export function unfiledFigureNote(totalBani: Bani): string {
  return (
    `Total calculat: ${formatBani(totalBani)}. Nimic nu a fost depus și nimic nu se depune din această `
    + 'aplicație; cifra nu este verificată cu nicio declarație.'
  );
}

/** True when `date` is a usable ISO calendar date — the guard every term above assumes. */
export function isUsableDate(date: string): boolean {
  return isISOCalendarDate(date);
}
