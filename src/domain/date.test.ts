import { describe, expect, it } from 'vitest';
import {
  ISO_CALENDAR_DATE,
  daysInMonth,
  formatRoCalendarDate,
  isISOCalendarDate,
  isoCalendarDateProblem,
  isoCalendarDateProblemText,
  localDateISO,
  localYear,
} from './date';

// B-21 — what a stored record date has to be before the aggregate can use it at all.
// No test here reads the wall clock (B-23 is a standing rule): every instant is pinned.

describe('isoCalendarDateProblem — the shape a record date must have', () => {
  it('accepts a real calendar day', () => {
    expect(isoCalendarDateProblem('2026-06-01')).toBeNull();
    expect(isoCalendarDateProblem('2026-12-31')).toBeNull();
    expect(isISOCalendarDate('2026-02-28')).toBe(true);
  });

  it('names an empty value', () => {
    expect(isoCalendarDateProblem('')).toBe('missing');
  });

  it('names a real day that is not zero-padded', () => {
    // The most likely value from an import or a hand-edited row — and the one that used to
    // mis-SORT rather than vanish: '2026-6-1' > '2026-06-15' because '6' > '0'.
    expect(isoCalendarDateProblem('2026-6-1')).toBe('not zero-padded');
    expect(isoCalendarDateProblem('2026-06-1')).toBe('not zero-padded');
  });

  it('names a month that does not exist', () => {
    expect(isoCalendarDateProblem('2026-13-01')).toBe('month out of range');
    expect(isoCalendarDateProblem('2026-00-01')).toBe('month out of range');
  });

  it('names a day that does not exist in that month', () => {
    // Shape alone would let these through, and a day that does not exist cannot be compared
    // to a period.
    expect(isoCalendarDateProblem('2026-02-30')).toBe('day out of range');
    expect(isoCalendarDateProblem('2026-04-31')).toBe('day out of range');
    expect(isoCalendarDateProblem('2026-02-29')).toBe('day out of range'); // 2026 is not a leap year
    expect(isoCalendarDateProblem('2026-06-00')).toBe('day out of range');
  });

  it('accepts 29 February only in a leap year', () => {
    expect(isoCalendarDateProblem('2024-02-29')).toBeNull();
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it('names anything that is not a calendar date at all', () => {
    expect(isoCalendarDateProblem('not-a-date')).toBe('not an ISO calendar date');
    expect(isoCalendarDateProblem('2026-06')).toBe('not an ISO calendar date');
    expect(isoCalendarDateProblem('01-06-2026')).toBe('not an ISO calendar date');
    expect(isoCalendarDateProblem('2026-06-01T12:00:00Z')).toBe('not an ISO calendar date');
  });

  it('rejects the DD-MM-YYYY order rather than guessing at it', () => {
    // A Romanian-style stored value would be ambiguous ('01-06-2026' — 1 June or 6 January?)
    // and would break the year-first ordering the aggregate depends on. Refusing it is the
    // honest answer; reinterpreting it would move records between fiscal years on a guess.
    expect(isoCalendarDateProblem('01-06-2026')).not.toBeNull();
    expect(ISO_CALENDAR_DATE.test('01-06-2026')).toBe(false);
  });

  it('gives every code Romanian wording a person can act on, and never a format name', () => {
    // Nobody types these by hand — every date field is an <input type="date"> — so "AAAA-LL-ZZ"
    // would be a puzzle, not an instruction.
    const codes = ['missing', 'not zero-padded', 'month out of range', 'day out of range', 'not an ISO calendar date'];
    for (const code of codes) {
      const text = isoCalendarDateProblemText(code);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toContain('AAAA-LL-ZZ');
      expect(text).not.toContain('ISO');
    }
    // The codes themselves stay machine-readable for tests and logs.
    expect(isoCalendarDateProblemText('month out of range')).toContain('1 și 12');
  });
});

describe('formatRoCalendarDate — the one presentation formatter', () => {
  it('renders DD.MM.YYYY with dots', () => {
    expect(formatRoCalendarDate('2026-06-01')).toBe('01.06.2026');
    expect(formatRoCalendarDate('2026-12-31')).toBe('31.12.2026');
    expect(formatRoCalendarDate('2027-05-25')).toBe('25.05.2027');
  });

  it('flags a malformed value instead of emitting undefined.undefined.undefined', () => {
    // The two private copies this replaced did exactly that: '2026-6-1'.split('-') gives
    // ['2026','6','1'] (fine by luck) but 'not-a-date' gives one element and renders
    // 'undefined.undefined.not-a-date'.
    expect(formatRoCalendarDate('not-a-date')).toBe('not-a-date (dată invalidă)');
    expect(formatRoCalendarDate('')).toBe(' (dată invalidă)');
    expect(formatRoCalendarDate('2026-13-01')).toBe('2026-13-01 (dată invalidă)');
    for (const bad of ['not-a-date', '', '2026-13-01', '01-06-2026']) {
      expect(formatRoCalendarDate(bad)).not.toContain('undefined');
    }
  });

  it('never changes the stored value — presentation only', () => {
    const iso = '2026-06-01';
    expect(isoCalendarDateProblem(formatRoCalendarDate(iso))).not.toBeNull(); // rendered form is not storable
    expect(isoCalendarDateProblem(iso)).toBeNull(); // stored form still is
  });
});

describe('the stored format is ISO because the aggregate reads it positionally', () => {
  it('a Bucharest calendar day, not a UTC day', () => {
    // 23:30Z on 31 Dec is already 01:30 on 1 Jan in Bucharest: the fiscal year is the LOCAL one.
    const instant = new Date('2026-12-31T23:30:00Z');
    expect(localDateISO(instant)).toBe('2027-01-01');
    expect(localYear(instant)).toBe(2027);
  });

  it('year extraction is positional on the year coming first', () => {
    // This is why the store cannot become DD.MM.YYYY: slice(0,4) would return the day.
    expect(Number(localDateISO(new Date('2026-06-01T10:00:00Z')).slice(0, 4))).toBe(2026);
  });
});
