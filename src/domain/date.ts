// Step 27 — single injectable date source for the financial domain.
//
// Calendar dates (asOfDate, fiscal year, dataInregistrare, dataTrimitere)
// must be derived from the ROMANIAN local calendar date (Europe/Bucharest:
// EET UTC+2 winter / EEST UTC+3 summer), never from the UTC calendar date.
// Around midnight the UTC calendar date can differ from the Romanian local
// calendar date (e.g. instant 2026-03-20T22:30:00Z → UTC date 2026-03-20,
// Romanian local date 2026-03-21).
//
// Audit timestamps (generatedAt, updatedAt) stay full ISO instant strings
// (UTC) — that is correct for instants; they are NOT calendar dates.
//
// This module is the ONLY place in src/ that touches the real clock
// (`new Date()`). Every other function takes an injectable `instant: Date`.

const RO_TIME_ZONE = 'Europe/Bucharest';

/** The single real-clock access point. All other date functions take an
 *  injectable instant and default to this. */
export function now(): Date {
  return new Date();
}

/** Romanian local calendar date (YYYY-MM-DD) for an instant. */
export function localDateISO(instant: Date = now()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: RO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Romanian local calendar year for an instant. */
export function localYear(instant: Date = now()): number {
  return Number(localDateISO(instant).slice(0, 4));
}

/** Full ISO instant string (UTC) — for audit timestamps (updatedAt, etc.). */
export function toInstantISO(instant: Date = now()): string {
  return instant.toISOString();
}

/** Epoch milliseconds for an instant — for time-based IDs (uid), not dates. */
export function epochMs(instant: Date = now()): number {
  return instant.getTime();
}

/** Number of days in a calendar month (1-12) of a given year. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ── B-21: the calendar-date shape a stored record date must have ───────────────
//
// Every record date in this app is a CALENDAR date, not an instant. The aggregate
// (`domain/aggregation.ts`) attributes a record to a fiscal year and to a period by
// comparing that string, so a value that is merely "some string in a date field" is not
// data — it is a record that silently stops existing in every total (B-21). The shape
// below is what makes the comparison meaningful, and it is the shape the write path
// enforces and the aggregate audits for.

/** Fixed-width, zero-padded ISO `YYYY-MM-DD`. */
export const ISO_CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Why `value` is not a usable ISO calendar date, or `null` when it is one.
 *
 * Shape alone is not enough: `2026-13-01` and `2026-02-30` are well-shaped and name no
 * real day, and a date that does not exist cannot be compared to a period. So this checks
 * the shape, then the month range, then the day against `daysInMonth`.
 */
export function isoCalendarDateProblem(value: string): string | null {
  if (typeof value !== 'string' || value.length === 0) return 'missing';
  if (!ISO_CALENDAR_DATE.test(value)) {
    // A near-miss is worth naming separately: `2026-6-1` is a real day, it is just not
    // fixed-width, and it is the single most likely thing a user or an import produces.
    return /^\d{4}-\d{1,2}-\d{1,2}$/.test(value) ? 'not zero-padded' : 'not an ISO calendar date';
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12) return 'month out of range';
  if (day < 1 || day > daysInMonth(year, month)) return 'day out of range';
  return null;
}

/** True when `value` is a real calendar day in fixed-width ISO `YYYY-MM-DD` form. */
export function isISOCalendarDate(value: string): boolean {
  return isoCalendarDateProblem(value) === null;
}

/**
 * Romanian wording for a problem code, for every user-visible surface. The codes stay
 * machine-readable English so tests and logs can match them; only the presentation is
 * translated, and it is translated once, so the write path and the aggregate cannot drift.
 *
 * The wording describes what is wrong in terms a person can act on. It deliberately does not
 * say "ISO" or "AAAA-LL-ZZ": nobody in this app types a date by hand — every date field is an
 * `<input type="date">` whose submitted value is machine-produced — so a shape name is not an
 * instruction, it is a puzzle. The example is what makes the message actionable.
 */
export function isoCalendarDateProblemText(problem: string): string {
  switch (problem) {
    case 'missing': return 'nu este completată';
    case 'not zero-padded': return 'luna și ziua trebuie scrise cu două cifre (1 iunie 2026 se scrie 2026-06-01)';
    case 'month out of range': return 'luna nu este între 1 și 12';
    case 'day out of range': return 'ziua nu există în luna respectivă';
    case 'not an ISO calendar date': return 'nu poate fi citită ca o dată calendaristică (an-lună-zi, exemplu 2026-06-01)';
    default: return 'nu este o dată calendaristică';
  }
}

// ── The human-facing form of a stored date ────────────────────────────────────
//
// Stored dates are ISO `YYYY-MM-DD` and that is load-bearing, not a style choice:
// `localYear()` reads the year positionally with `slice(0, 4)`, and `aggregation.inPeriod()`
// compares date strings directly. ISO fixed-width, zero-padded, year-first is the only order
// in which both are correct — a `DD-MM-YYYY` store would make `slice(0, 4)` return the day and
// would sort `01-02-2000` before `02-01-1999`, i.e. records moving between fiscal years with
// nothing to see. So the machine format stays ISO and only the PRESENTATION is Romanian.
//
// This is the single presentation formatter. It existed twice — `components/dashboard/
// DeadlineSection.tsx` and `domain/insights.ts` each carried a byte-identical private
// `formatDate` — which is the same defect class as B-17: two display paths free to drift apart
// with nothing forcing them to agree. Do not add a third.

/**
 * Render a stored calendar date the way a Romanian reader expects: `DD.MM.YYYY`, dots not
 * hyphens.
 *
 * A value that is not a real calendar date is flagged in place rather than rendered as
 * `undefined.undefined.undefined` (what the old copies did) and rather than thrown: this runs
 * inside a render path, and an exception there would blank the whole dashboard — turning a
 * single bad field into a data-loss-shaped outage. The bad value stays visible so the user can
 * find and fix it, which is the same refusal-not-deletion rule as B-21.
 */
export function formatRoCalendarDate(iso: string): string {
  if (!isISOCalendarDate(iso)) return `${iso} (dată invalidă)`;
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}

