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
